document.getElementById('btn-download').addEventListener('click', startDownload);
document.getElementById('btn-cancel').addEventListener('click', cancelDownload);
document.getElementById('btn-close').addEventListener('click', close);
document.getElementById('btn-directory').addEventListener('click', chooseDirectory);

const {ipcRenderer} = require('electron');
const {dialog} = require('electron').remote;

ipcRenderer.on('on-file-downloaded', onFileDownloaded);
ipcRenderer.on('on-download-completion', onDownloadCompletion);

let inputs = document.getElementsByTagName('input');
for (input of inputs) {
    input.addEventListener('keypress', function (evt) {
        evt.target.setAttribute('data-touched', "1");
    });
    input.addEventListener('blur', function(evt) {
        verifyParams();
    });
}

function chooseDirectory() {
    ipcRenderer.send('dont-hide');
    var path = dialog.showOpenDialog({
        properties: ['openDirectory']
    });
    if (path) {
        document.getElementById('btn-directory').setAttribute('data-directory', path);
        toggleError(document.getElementById('btn-directory').parentNode, false);
    } else {
        toggleError(document.getElementById('btn-directory').parentNode, true);
    }
    ipcRenderer.send('can-hide');
}

function toggleError(parentElement, setError) {
    let els = parentElement.getElementsByClassName('text-error');
    for (let e of els) {
        if (!setError) {
            e.style.display = 'none'
        } else {
            e.style.display = 'block';
        }
    }
}

function verifyParams(testAll) {
    let args = getArgs();

    toggleError(document, false);

    let input; let touched; let value;

    input = document.querySelector('#btn-directory');
    touched = !!input.getAttribute('data-touched');
    value = args.directory;
    if ((touched || testAll) && !value) {
        toggleError(input.parentNode, true);
        return false;
    }

    input = document.querySelector('#input-url');
    touched = !!input.getAttribute('data-touched');
    value = args.url;
    if ((touched || testAll) && !validateURL(value)) {
        toggleError(input.parentNode, true);
        return false;
    }

    input = document.querySelector('#input-startingnumber');
    touched = !!input.getAttribute('data-touched');
    value = !isNaN(args.starting_number) ? parseInt(args.starting_number) : undefined;
    let endingNumber = !isNaN(args.ending_number) ? parseInt(args.ending_number) : +Infinity;
    if ((touched || testAll) && !value || value > endingNumber) {
        toggleError(input.parentNode, true);
        return false;
    }

    input = document.querySelector('#input-endingnumber');
    touched = !!input.getAttribute('data-touched');
    value = !isNaN(args.ending_number) ? parseInt(args.ending_number) : undefined;
    let startingnumber = !isNaN(args.starting_number) ? parseInt(args.starting_number) : -Infinity;
    if ((touched || testAll) && !value || value <= startingnumber) {
        toggleError(input.parentNode, true);
        return false;
    }

    return true;
}

/** @param {string} s */
function validateURL(s) {
    try {
        let url = new URL(s.replace('\$\{serial\}', ''));
        return s.indexOf('${serial}') != -1;
    } catch (_) {
        return false;  
    }
}

function startDownload() {
    if (verifyParams(true)) {
        let win1 = document.getElementById('pre-download');
        win1.style.display = 'none';
        let win2 = document.getElementById('downloading');
        win2.style.display = 'flex';
        let args = getArgs();
        ipcRenderer.send('start-download', args);
        updateDownloadingInterface(args);
    }
}

function updateDownloadingInterface(args) {
    document.getElementById('url-span').innerHTML = 
        args.url.replace(
            '\$\{serial\}', 
            '<strong style="color: #b15eda">${serial}</strong>'
        );
    document.getElementById('starting-number-span').innerHTML = args.starting_number;
    document.getElementById('ending-number-span').innerHTML = args.ending_number;
    document.getElementById('target-dir').innerHTML = args.directory;    
}

function cancelDownload() {
    let win1 = document.getElementById('pre-download');
    win1.style.display = 'flex';
    let win2 = document.getElementById('downloading');
    win2.style.display = 'none';
    ipcRenderer.send('cancel-download');
}   

function close() {
    ipcRenderer.send('close-window');
}

function getArgs() {
    let args = {
        directory: document.getElementById('btn-directory').getAttribute('data-directory'),
        url: document.getElementById('input-url').value,
        starting_number: document.getElementById('input-startingnumber').value,
        ending_number: document.getElementById('input-endingnumber').value,
        options : {
//            log_errors: !!document.getElementById('input-log').checked,
//            download_html: !document.getElementById('input-donthtml').checked,
            filename_format: document.querySelector('input[name="filename-format"]:checked').value
        }
    };
    return args;
}

function updateProgressBar(percentage) {
    document.getElementById('progress-bar').style.width = percentage + '%';
}

function setCurrentPercentage(n) {
    document.getElementById('n-percentage').innerHTML = n;
}

function setCurrentNumber(n) {
    document.getElementById('n-current').innerHTML = n;
}

let success = 0; let failed = 0;
function addSuccess() {
    success++;
    document.getElementById('n-success').innerHTML = success;
}
function addFailed() {
    failed++;
    document.getElementById('n-failed').innerHTML = failed;
}

function onFileDownloaded(evt, args) {
    console.log(evt, args);
    let percentage = parseInt(args.n / args.total * 100);
    updateProgressBar(percentage);
    setCurrentPercentage(percentage);
    setCurrentNumber(args.n);    
    if (args.err) {
        addFailed();
        document.getElementById('error-log').appendChild(new HTMLParagraphElement().innerHTML = args.err.toString());
    }
    else
        addSuccess();
}

function onDownloadCompletion(evt, args) {
    if (args[0]) {
        document.getElementById('error-log').appendChild(new HTMLParagraphElement().innerHTML = args[0].toString())
        console.error(args[0]);
    } else {
        console.log("Download successful");
    }
    document.getElementById('btn-cancel').innerHTML = 'Close &nbsp;<span class="icon icon-cancel"></span>&nbsp;';
    document.getElementById('btn-cancel').removeEventListener('click', cancelDownload);
    document.getElementById('btn-cancel').addEventListener('click', close); 
}