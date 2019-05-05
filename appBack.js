const { app, BrowserWindow, ipcMain, Tray } = require('electron');
const SerialDownloader = require('./downloader');
const path = require('path');

const assetsDirectory = path.join(__dirname, 'img')

let tray = undefined;
let window = undefined;
/*
 if we ever support MacOS we're going to need this.
// Don't show the app in the dock
if (app.plataform == 'darwin')
  app.dock.hide();
*/

app.on('ready', () => {
  createTray();
  createWindow();
})

// Quit the app when the window is closed
app.on('window-all-closed', () => {
  app.quit()
});

const createTray = () => {
  tray = new Tray(path.join(assetsDirectory, 'icon.png'))
  tray.on('right-click', toggleWindow)
  tray.on('double-click', toggleWindow)
  tray.on('click', toggleWindow);
}

const getWindowPosition = () => {
  const windowBounds = window.getBounds();
  const trayBounds = tray.getBounds();

  // Center window horizontally below the tray icon
  const x = Math.round(trayBounds.x + (trayBounds.width / 2) - (windowBounds.width / 2));

  // Position window 4 pixels vertically above the tray icon
  const y = Math.round(trayBounds.y - windowBounds.height - 3);

  return {x: x, y: y};
}

let canHideWindow = true;

const createWindow = () => {
  window = new BrowserWindow({
		width: 400,
		height: 550,
		show: false,
		frame: false,
		fullscreenable: false,
		resizable: false,
    transparent: true,
    webPreferences: {
      contextIsolation:	false,
      nodeIntegration: true,
    }
	});
  
  window.loadURL('file://' + __dirname + '/index.html');
  // window.webContents.openDevTools({ mode: 'detach' });

  // Hide the window when it loses focus
  window.on('blur', () => {
    if (!window.webContents.isDevToolsOpened() && canHideWindow)
      window.hide();
  });
}

const toggleWindow = () => {
  if (window.isVisible()) {
    window.hide();
  } else {
    showWindow();
  }
}

const showWindow = () => {
  const position = getWindowPosition();
  window.setPosition(position.x, position.y, false);
  window.show();
  window.focus();
}

ipcMain.on('close-window', () => {
  app.quit();
});

ipcMain.on('can-hide', () => {
  canHideWindow = true;
});

ipcMain.on('dont-hide', () => {
  canHideWindow = false;
});

let downloader;
ipcMain.on('start-download', (event, args) => {
  downloader = new SerialDownloader(args, onFileDownloaded, onDownloadCompletion);
  downloader.start();
});

ipcMain.on('cancel-download', (event, args) => {
  downloader.cancel();
});

function onFileDownloaded(err, filename, url, n, total) {
  if (err)
    return console.err(err, filename, url, n, total);
  window.webContents.send('on-file-downloaded', {err: err, filename: filename, url: url, n:n, total:total});
}

function onDownloadCompletion(err) {
  if (err) return console.error(err);
  window.webContents.send('on-download-completion', [err]);
}