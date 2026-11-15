// Unitas entry point (cf. Vimium C background/main.ts): window, app lifecycle, wiring.
// Tabs live in background/browser.js; keys and commands in background/ + content/ (see README).
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const path = require('path');
const store = require('./background/store');
const settings = require('./background/settings');
const browser = require('./background/browser');
const ports = require('./background/ports');
const vomnibar = require('./background/vomnibar');
const contentBundle = require('./background/content_bundle');
const history = require('./background/browsing_data_manager');

// Present a plain Chrome UA: the default includes "unitas/x Electron/x", which
// makes Google (and others) treat searches as bot traffic and show a CAPTCHA.
app.userAgentFallback = app.userAgentFallback
  .replace(/\s+unitas\/\S+/i, '')
  .replace(/\s+Electron\/\S+/, '');

// No application menu: it would bring Electron's default Ctrl accelerators (reload, zoom, quit, ...)
Menu.setApplicationMenu(null);

// tab strip (shell.html)
ipcMain.on('activate', (_e, id) => browser.activate(id));
ipcMain.on('close', (_e, id) => browser.closeTab(id));

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'Unitas',
    backgroundColor: '#1e1e1e',
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'shell-preload.js') }
  });
  store.win = win;
  store.shellWC = win.webContents;
  vomnibar.create();
  for (const ev of ['resize', 'maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(ev, browser.layout);
  win.webContents.loadFile(path.join(__dirname, 'shell.html'));
  win.webContents.once('did-finish-load', () => {
    // Switches may come before the app path (e.g. flags from electron-flags.conf), so drop them first
    const args = process.argv.slice(1).filter(a => !a.startsWith('-'));
    if (process.defaultApp) args.shift(); // the app path in `electron <app> ...`
    if (args.length) args.forEach(a => browser.createTab(a)); else browser.createTab('');
  });
}

app.whenReady().then(() => {
  settings.load();
  settings.watch();
  contentBundle.build();
  ports.init();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => history.flush());
