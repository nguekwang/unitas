// Tab primitives: create, activate, close, layout (cf. Vimium C background/browser.ts, which wraps chrome.tabs).
const { WebContentsView, dialog } = require('electron');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');
const store = require('./store');
const { classify } = require('./normalize-urls');
const history = require('./browsing-data-manager');
const runKeys = require('./run-keys');

const ROOT = path.join(__dirname, '..');
const TOP = 36; // height of the tab strip (px)
const PRELOAD = { editor: 'editor-preload.js', terminal: 'terminal-preload.js' };

const activeTab = () => store.tabs.find(t => t.id === store.activeId);
const tabOf = wc => store.tabs.find(t => !t.view.webContents.isDestroyed() && t.view.webContents === wc);
const addrOf = t => (t && (t.file || t.url)) || '';
// PDF and raster images are binary; only text-based viewers can be opened in the editor
const canEdit = t => !!(t && t.file && (t.kind === 'html' || /\.svg$/i.test(t.file)));
exports.activeTab = activeTab;
exports.tabOf = tabOf;
exports.addrOf = addrOf;
exports.canEdit = canEdit;

exports.layout = () => {
  const t = activeTab();
  const { win } = store;
  if (!win || win.isDestroyed()) return;
  const b = win.getContentBounds();
  const page = { x: 0, y: TOP, width: b.width, height: Math.max(0, b.height - TOP) };
  if (t && t.devtools) {
    // DevTools panel beside the page: on the right in a wide window, below it in a tall one
    const side = page.width >= page.height * 1.2;
    const dv = side ? { ...page, x: Math.round(page.width * 0.55), width: page.width - Math.round(page.width * 0.55) }
      : { ...page, y: page.y + Math.round(page.height * 0.55), height: page.height - Math.round(page.height * 0.55) };
    t.view.setBounds(side ? { ...page, width: dv.x } : { ...page, height: dv.y - page.y });
    t.devtools.setBounds(dv);
  } else if (t) t.view.setBounds(page);
  if (store.vomnibarOpen) store.vomnibar.setBounds({ x: 0, y: 0, width: b.width, height: b.height });
};

exports.pushState = () => {
  const { shellWC } = store;
  if (!shellWC || shellWC.isDestroyed()) return;
  const t = activeTab();
  shellWC.send('tabs', {
    activeId: store.activeId,
    mode: (t && t.mode) || 'NORMAL',
    pending: (t && t.pending) || '',
    tabs: store.tabs.map(x => ({ id: x.id, kind: x.kind, title: x.title, addr: addrOf(x) }))
  });
};

exports.activate = id => {
  const t = store.tabs.find(x => x.id === id);
  if (!t) return;
  require('./vomnibar').close(false);
  const cur = activeTab();
  if (cur && cur !== t) {
    store.win.contentView.removeChildView(cur.view);
    if (cur.devtools) store.win.contentView.removeChildView(cur.devtools);
    store.previousTabId = cur.id;
  }
  store.activeId = id;
  store.win.contentView.addChildView(t.view);
  if (t.devtools) store.win.contentView.addChildView(t.devtools);
  exports.layout();
  t.view.webContents.focus();
  exports.pushState();
};

// raw: what the user typed / a URL / a path.
// opts.edit: open the file in the editor. opts.index: position in the tab strip.
// opts.webContents + opts.openerId: a popup the page created (window.open / target=_blank).
// opts.terminal: a terminal tab (raw is ignored), with its shell started in opts.cwd.
exports.createTab = (raw, opts = {}) => {
  const c = opts.terminal ? { kind: 'terminal' } : classify(raw);
  if (opts.edit && c.file) c.kind = 'editor';
  const id = store.nextId++;
  // Popups are wrapped as-is: Chromium already set them up with the opener link.
  const view = opts.webContents ? new WebContentsView({ webContents: opts.webContents }) : new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      // The content script comes from the session (content-bundle.js); editor tabs add file IO,
      // terminal tabs their shell's input and output
      preload: PRELOAD[c.kind] ? path.join(ROOT, PRELOAD[c.kind]) : undefined
    }
  });
  const tab = {
    id, view, kind: c.kind, file: c.file || null, url: c.url || null, openerId: opts.openerId || null,
    title: c.kind === 'terminal' ? 'Terminal' : c.file ? path.basename(c.file) : (c.url || 'New Tab'),
    cwd: opts.cwd || null, mode: 'NORMAL', pending: ''
  };
  const index = Number.isInteger(opts.index) ? Math.max(0, Math.min(opts.index, store.tabs.length)) : store.tabs.length;
  store.tabs.splice(index, 0, tab);
  const wc = view.webContents;

  wc.on('page-title-updated', (_e, title) => {
    tab.title = title;
    if (tab.kind === 'web') history.setTitle(tab.url, title);
    exports.pushState();
  });
  const navigated = (_e, url) => {
    if (tab.kind === 'web') { tab.url = url; history.record(url, wc.getTitle()); }
    exports.pushState();
  };
  wc.on('did-navigate', navigated);
  wc.on('did-navigate-in-page', navigated);
  // A page that failed to load (offline, DNS, TLS) shows Chromium's error page: keep its address
  // anyway, so the tab strip, yy, gu and ge show what was asked for, not the previous page
  wc.on('did-fail-load', (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 || tab.kind !== 'web') return; // -3: aborted (e.g. a new navigation)
    tab.url = url;
    tab.title = url;
    exports.pushState();
  });
  wc.on('found-in-page', (_e, r) => {
    if (r.finalUpdate) exports.sendToTab(tab, 'findResult', { active: r.activeMatchOrdinal, matches: r.matches });
  });
  // Never open a separate window: popups (login windows, target=_blank links) become tabs here.
  // Web pages keep the opener link, so "Sign in with ..." popups can report back and close themselves.
  // Other tab kinds (editor, viewers) just get a plain new tab: no opener, no inherited editor preload.
  wc.setWindowOpenHandler(({ url }) => {
    const at = store.tabs.indexOf(tab) + 1;
    if (tab.kind !== 'web') { exports.createTab(url, { index: at }); return { action: 'deny' }; }
    return {
      action: 'allow',
      createWindow: options => exports.createTab(url, { webContents: options.webContents, openerId: id, index: at }).view.webContents
    };
  });
  // A popup that closes itself (window.close() after login) removes its tab
  wc.once('destroyed', () => {
    if (store.win && !store.win.isDestroyed() && store.tabs.includes(tab)) exports.closeTab(id, { destroyed: true });
  });
  // The editor and terminal preloads expose file IO / a shell, so those tabs must never navigate away
  // (e.g. on drag & drop)
  if (PRELOAD[c.kind]) wc.on('will-navigate', e => e.preventDefault());
  // The PDF viewer is a plugin the content script can't see into: keys are handled here instead
  runKeys.attach(tab);

  if (opts.webContents) { /* the opener is already loading it */ }
  else if (c.kind === 'start') { tab.title = 'New Tab'; wc.loadFile(path.join(ROOT, 'start.html')); }
  else if (c.kind === 'editor') wc.loadFile(path.join(ROOT, 'editor.html'), { query: { file: c.file, url: pathToFileURL(c.file).href } });
  else if (c.kind === 'terminal') wc.loadFile(path.join(ROOT, 'terminal.html'));
  else if (c.kind === 'web') wc.loadURL(c.url);
  else wc.loadURL(pathToFileURL(c.file).href); // pdf / html / image: Chromium built-in viewers

  if (!opts.background) exports.activate(id); else exports.pushState();
  return tab;
};

exports.closeTab = (id, opts = {}) => {
  const i = store.tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const [t] = store.tabs.splice(i, 1);
  const addr = addrOf(t);
  if (addr) {
    store.closedTabs.push({ addr, kind: t.kind, index: i });
    if (store.closedTabs.length > 30) store.closedTabs.shift();
  }
  closeDevTools(t);
  if (id === store.activeId) { store.win.contentView.removeChildView(t.view); store.activeId = null; }
  if (!opts.destroyed) t.view.webContents.close();
  if (!store.tabs.length) { exports.createTab(''); return; }
  if (store.activeId === null) {
    // closing a popup returns to the page that opened it
    const opener = store.tabs.find(x => x.id === t.openerId);
    exports.activate(opener ? opener.id : store.tabs[Math.min(i, store.tabs.length - 1)].id);
  } else exports.pushState();
};

// Open what the user typed: reuse the current web tab for web → web, replace the start page.
exports.go = input => {
  const t = activeTab();
  const c = classify(input);
  if (t && t.kind === 'web' && c.kind === 'web') { t.view.webContents.loadURL(c.url); return; }
  exports.createTab(input, { index: t ? store.tabs.indexOf(t) + 1 : undefined });
  if (t && t.kind === 'start') exports.closeTab(t.id);
};

exports.openDialog = async () => {
  const r = await dialog.showOpenDialog(store.win, { properties: ['openFile', 'multiSelections'] });
  if (!r.canceled) r.filePaths.forEach(p => exports.createTab(p));
};

// A terminal in the folder of the file being viewed, else in the home folder
exports.openTerminal = (t = activeTab(), opts = {}) => {
  const cwd = (t && t.kind === 'terminal' && t.cwd) || (t && t.file && path.dirname(t.file)) || os.homedir();
  return exports.createTab('', { terminal: true, cwd, index: t ? store.tabs.indexOf(t) + 1 : undefined, ...opts });
};

exports.editCurrent = () => {
  const t = activeTab();
  if (canEdit(t)) exports.createTab(t.file, { edit: true, index: store.tabs.indexOf(t) + 1 });
};

// Chromium DevTools for the active tab, docked inside the window (no separate window):
// the DevTools frontend is loaded into our own view with setDevToolsWebContents.
// Safe to call more than once and in any order with the tab closing: every object is checked first.
function closeDevTools(t) {
  const dv = t.devtools;
  if (!dv) return;
  t.devtools = null; // first, so the handlers below find nothing left to do
  const wc = t.view.webContents;
  // isDevToolsOpened() is always false with setDevToolsWebContents (Electron 43), so don't check it
  if (wc && !wc.isDestroyed()) wc.closeDevTools();
  if (store.win && !store.win.isDestroyed()) store.win.contentView.removeChildView(dv);
  if (dv.webContents && !dv.webContents.isDestroyed()) dv.webContents.close();
}

exports.toggleDevTools = (t = activeTab()) => {
  if (!t) return;
  const wc = t.view.webContents;
  if (t.devtools) {
    closeDevTools(t);
    exports.layout();
    if (t.id === store.activeId && !wc.isDestroyed()) wc.focus();
    return;
  }
  const dv = new WebContentsView();
  t.devtools = dv;
  wc.setDevToolsWebContents(dv.webContents);
  wc.openDevTools({ mode: 'detach', activate: false });
  // The panel went away on its own (closed from inside DevTools, its renderer crashed): drop it too
  const gone = () => {
    if (t.devtools !== dv) return; // already closed by us
    closeDevTools(t);
    exports.layout();
  };
  wc.once('devtools-closed', gone);
  dv.webContents.once('destroyed', gone);
  dv.webContents.on('render-process-gone', gone);
  if (t.id === store.activeId) store.win.contentView.addChildView(dv);
  exports.layout();
};

exports.navigate = action => {
  const t = activeTab();
  if (!t) return;
  const nh = t.view.webContents.navigationHistory;
  if (action === 'back' && nh.canGoBack()) nh.goBack();
  else if (action === 'forward' && nh.canGoForward()) nh.goForward();
  else if (action === 'reload' && !PRELOAD[t.kind]) t.view.webContents.reload();
};

// Message the page's content script (content/port.js) or show a HUD message there
exports.sendToTab = (t, channel, data) => {
  if (t && !t.view.webContents.isDestroyed()) t.view.webContents.send('vc:' + channel, data);
};
exports.hud = (text, t = activeTab()) => exports.sendToTab(t, 'hud', { text });

exports.TOP = TOP;
