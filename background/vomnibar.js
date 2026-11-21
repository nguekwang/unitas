// The vomnibar overlay: a transparent view above the tab, showing vomnibar.html
// (cf. Vimium C content/omni.ts, which opens its vomnibar page in an iframe).
const { WebContentsView, ipcMain } = require('electron');
const path = require('path');
const store = require('./store');
const browser = require('./browser');
const completion = require('./completion');

const ROOT = path.join(__dirname, '..');

exports.create = () => {
  const v = new WebContentsView({
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(ROOT, 'vomnibar-preload.js') }
  });
  v.setBackgroundColor('#00000000');
  require('./security').lockAppView(v.webContents);
  v.webContents.loadFile(path.join(ROOT, 'vomnibar.html'));
  store.vomnibar = v;

  const fromVomnibar = e => e.sender === v.webContents;
  ipcMain.handle('vomnibar:query', (e, { q, mode } = {}) => (fromVomnibar(e) ? completion.query(q, mode) : []));
  ipcMain.on('vomnibar:close', e => { if (fromVomnibar(e)) exports.close(); });
  ipcMain.on('vomnibar:run', (e, { run, newTab } = {}) => {
    if (!fromVomnibar(e) || !run) return;
    exports.close();
    const t = browser.activeTab();
    const at = t ? store.tabs.indexOf(t) + 1 : undefined;
    if (run.type === 'tab') browser.activate(run.id);
    else if (run.type === 'cmd') require('./run_commands').run(String(run.name), 1, t);
    else if (run.type === 'url' || run.type === 'go') {
      const input = String(run.type === 'url' ? run.url : run.input);
      if (newTab) browser.createTab(input, { index: at }); else browser.go(input);
    }
  });
};

// opts: { mode: "omni" | "tabs" | "command", newTab, prefill }
exports.open = (opts = {}) => {
  const v = store.vomnibar;
  if (!v) return;
  store.vomnibarOpen = true;
  store.win.contentView.addChildView(v); // (re)adding puts it on top of the tab view
  browser.layout();
  v.webContents.focus();
  v.webContents.send('vomnibar:open', { mode: opts.mode || 'omni', newTab: !!opts.newTab, prefill: opts.prefill || '' });
};

exports.close = (refocus = true) => {
  if (!store.vomnibarOpen) return;
  store.vomnibarOpen = false;
  store.win.contentView.removeChildView(store.vomnibar);
  const t = browser.activeTab();
  if (refocus && t) t.view.webContents.focus();
};
