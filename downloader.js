const fs = require('fs');
// const cheerio = require('cheerio');
const request = require('request-promise-native');
const timesLimit = require('async/timesLimit');
const path = require('path');

class SerialDownloader {

    constructor(args, fnEach, fnEnd) {
        this.numbers = {
            end: args.ending_number,
            start: args.starting_number,
        };
        this.fnEach = fnEach;
        this.fnEnd = fnEnd;
        this.directory = args.directory;
        this.concurrency = args.concurrency || 5;
        this.url = args.url;
        this.filenameFormat = args.options.filename_format;
        this.maxTries = 5;
        this.downloadHTML = args.downloadHTML;
        this.n = 0;
        this.cancel = false;
    }

    prepareURL(n){
        return this.url.replace('${serial}', n);
    }

    prepareFilename(res, n) {
        n += "";
        let regexp = /filename=\"(.*)\"/gi;
        // extract filename from content-disposition
        let filename;
        if (res.headers['content-disposition']) {
           filename = regexp.exec( res.headers['content-disposition'] )[1];
        }
        if (!filename) {
            return n;
        }
        let extension = 'undef';
        let original = filename;
        if (filename.indexOf('.') != -1) {
            extension = filename.split('.').slice(-1).pop();
            original = filename.replace(new RegExp(`\.${extension}$`), '');
        }
        
        switch (this.filenameFormat) {
            case 'original': 
                return filename;
            case 'id':
                return extension ? `${n}.${extension}` : n;
            case 'id_original':
                return extension ? `${n}_${original}.${extension}` : `${n}_${original}`;
        }
    }

    cancel() {
        this.cancel = true;
    }

    async start() {
        console.log("Ok. Starting to download");
        console.log(this.numbers.end, this.numbers.start, this.concurrency);
        let dl = this;
        let total = dl.numbers.end - dl.numbers.start + 1;
        this.total = total;
        await timesLimit(
            total,
            dl.concurrency,
            async function (n) {
                
                if (dl.cancel) {
                    let err = new Error('Download canceled.');
                    err.cancel = true;
                    throw err;
                }

                let i = parseInt(dl.numbers.start) + n;
                console.log(`Downloading ${i}/${dl.numbers.end}`);
                let url = dl.prepareURL(i);
                let response;
                try {
                    response = await dl.downloadFile(url);
                } catch (err) {
                    console.error(err);
                    return dl.onFileDownload(err, undefined, i, url);
                }
                let filename = dl.prepareFilename(response, i);
                try {
                    await dl.saveFile(filename, response.body);
                } catch (err) {
                    console.error(err);
                    return dl.onFileDownload(err, filename, url);
                }
                dl.onFileDownload(undefined, filename, url);
            },
            function (errOrStop) {
                if (errOrStop) {
                    if (errOrStop.cancel)
                        dl.onCompletion();
                    else
                        dl.onCompletion(err);
                }
                else {
                    dl.onCompletion();
                }
            }
        );
    }

    async downloadFile(url, tries) {

        let options = {
            uri: url,
            method: 'GET',
            encoding: null,
            resolveWithFullResponse: true
        };
    
        tries = !isNaN(tries) ? tries : 1;
        
        try {
            let response = await request(options);
            if (response && response.statusCode == 200)
                return response;
            else
                throw new Error("Download failed.");
        } catch (err) {
            if (err && err.statusCode == 404) {
                throw new Error("File doesn't exist [404]");
            }
            if (tries <= this.maxTries) {
                await timeout(3000);
                tries++;
                return this.downloadFile(url, tries);
            } else {
                throw new Error(`Couldn't download, even after ${tries}, something is wrong. Status = ` + err.statusCode);
            }            
        }
    }
    async saveFile(filename, file) {
        return new Promise((success, failure) => {
            fs.writeFile(path.join(this.directory, filename), file, (err) => {
                if (err) return failure(err);
                return success();
            });
        });	
    }

    onFileDownload(err, filename, url) {
        this.n++;
        if (this.fnEach && typeof this.fnEach == "function")
            this.fnEach(err, filename, url, this.n, this.total);
    }

    onCompletion(err) {
        if (this.fnEach && typeof this.fnEach == "function")
            this.fnEnd(err);
    }
}

function timeout(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

module.exports = SerialDownloader;