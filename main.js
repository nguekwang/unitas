// Unitas entry point (cf. Vimium C background/main.ts): window, app lifecycle, wiring.
// Tabs live in background/browser.js; keys and commands in background/ + content/ (see README).
const { app, BrowserWindow, Menu, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

// Unitas starts only when every feature can work. Anything missing stops it here, before any window,
// with the reason on stderr (no error dialog either: nothing may open a separate window).
(() => {
  const problems = [];
  // Native module: actually load it, so a missing or unbuilt binary is caught too
  try { require('node-pty'); } catch (e) { problems.push(`node-pty: ${e.message.split('\n')[0]}`); }
  // Loaded by the tab pages with <script>/<link> from node_modules
  for (const f of ['monaco-editor/min/vs/loader.js', 'marked/lib/marked.umd.js', 'dompurify/dist/purify.min.js',
    '@xterm/xterm/lib/xterm.js', '@xterm/xterm/css/xterm.css', '@xterm/addon-fit/lib/addon-fit.js']) {
    if (!fs.existsSync(path.join(__dirname, 'node_modules', f))) problems.push(`missing node_modules/${f}`);
  }
  if (!problems.length) return;
  console.error(`Unitas cannot start:\n  ${problems.join('\n  ')}\n` +
    'Run `npm install` in the Unitas folder (node-pty needs base-devel and python to build).');
  process.exit(1);
})();

const store = require('./background/store');
const settings = require('./background/settings');
const browser = require('./background/browser');
const ports = require('./background/ports');
const vomnibar = require('./background/vomnibar');
const contentBundle = require('./background/content-bundle');
const history = require('./background/browsing-data-manager');
const terminal = require('./background/terminal');

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
  terminal.init();
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('before-quit', () => history.flush());
app.on('will-quit', () => terminal.killAll());
