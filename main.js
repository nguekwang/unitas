const { app, BrowserWindow, WebContentsView, Menu, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL, fileURLToPath } = require('url');

// Present a plain Chrome UA: the default includes "unitas/x Electron/x", which
// makes Google (and others) treat searches as bot traffic and show a CAPTCHA.
app.userAgentFallback = app.userAgentFallback
  .replace(/\s+unitas\/\S+/i, '')
  .replace(/\s+Electron\/\S+/, '');

const TOP = 36; // height of tab strip (px)
const VIEW_EXT = { pdf: 'pdf', html: 'html', htm: 'html', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image' };

let win;
let shellWC;
let palette = null;      // search palette overlay (WebContentsView)
let paletteOpen = false;
const tabs = [];
let activeId = null;
let nextId = 1;

// ---------- input classification ----------
function classify(raw) {
  let input = (raw || '').trim();
  if (!input) return { kind: 'start' };
  if (/^file:\/\//i.test(input)) {
    try { input = fileURLToPath(input); } catch { /* keep */ }
  }
  if (/^https?:\/\//i.test(input)) return { kind: 'web', url: input };
  if (input.startsWith('~')) input = path.join(os.homedir(), input.slice(1));
  const abs = path.resolve(input);
  try {
    if (fs.statSync(abs).isFile()) {
      const ext = path.extname(abs).slice(1).toLowerCase();
      return { kind: VIEW_EXT[ext] || 'editor', file: abs };
    }
  } catch { /* not a file */ }
  if (/^localhost(:\d+)?(\/.*)?$/i.test(input)) return { kind: 'web', url: 'http://' + input };
  if (!/\s/.test(input) && /\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(input)) return { kind: 'web', url: 'https://' + input };
  return { kind: 'web', search: true, url: 'https://www.google.com/search?q=' + encodeURIComponent(input) };
}

// ---------- tabs ----------
function activeTab() { return tabs.find(t => t.id === activeId); }
// PDF and raster images are binary; only text-based viewers can be opened in the editor
function canEdit(t) { return !!(t && t.file && (t.kind === 'html' || /\.svg$/i.test(t.file))); }

function layout() {
  const t = activeTab();
  if (!win || !t) return;
  const b = win.getContentBounds();
  t.view.setBounds({ x: 0, y: TOP, width: b.width, height: Math.max(0, b.height - TOP) });
  if (paletteOpen) palette.setBounds({ x: 0, y: 0, width: b.width, height: b.height });
}

function pushState() {
  if (!shellWC || shellWC.isDestroyed()) return;
  shellWC.send('tabs', {
    activeId,
    mode,
    pending,
    tabs: tabs.map(x => ({ id: x.id, kind: x.kind, title: x.title, addr: x.file || x.url || '' }))
  });
}

function activate(id) {
  const t = tabs.find(x => x.id === id);
  if (!t) return;
  if (paletteOpen) closePalette(false);
  mode = 'NORMAL'; // every tab starts in NORMAL, like a freshly opened buffer
  clearPending();
  const cur = activeTab();
  if (cur && cur !== t) win.contentView.removeChildView(cur.view);
  activeId = id;
  win.contentView.addChildView(t.view);
  layout();
  t.view.webContents.focus();
  pushState();
}

function createTab(raw, opts = {}) {
  const c = classify(raw);
  if (opts.edit && c.file) c.kind = 'editor';
  const id = nextId++;
  // opts.webContents: a popup created by a page (window.open, target=_blank). Chromium has already
  // set it up with the opener link, so it is wrapped as-is instead of creating a new one.
  const view = opts.webContents ? new WebContentsView({ webContents: opts.webContents }) : new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: c.kind === 'editor' ? path.join(__dirname, 'editor-preload.js') : undefined
    }
  });
  const tab = { id, view, kind: c.kind, file: c.file || null, url: c.url || null, openerId: opts.openerId || null,
    title: c.file ? path.basename(c.file) : (c.url || 'New Tab') };
  tabs.push(tab);
  const wc = view.webContents;

  wc.on('page-title-updated', (_e, title) => { tab.title = title; pushState(); });
  wc.on('did-navigate', (_e, url) => { if (tab.kind === 'web') tab.url = url; pushState(); });
  wc.on('did-navigate-in-page', (_e, url) => { if (tab.kind === 'web') tab.url = url; pushState(); });
  // Never open a separate window: popups (login windows, target=_blank links) become tabs here.
  // Web pages keep the opener link, so "Sign in with ..." popups can report back and close themselves.
  // Other tab kinds (editor, viewers) just get a plain new tab: no opener, no inherited preload.
  wc.setWindowOpenHandler(({ url }) => {
    if (tab.kind !== 'web') { createTab(url); return { action: 'deny' }; }
    return {
      action: 'allow',
      createWindow: options => createTab(url, { webContents: options.webContents, openerId: id }).view.webContents
    };
  });
  // A popup that closes itself (window.close() after login) removes its tab
  wc.once('destroyed', () => { if (win && !win.isDestroyed() && tabs.includes(tab)) closeTab(id, { destroyed: true }); });
  attachKeys(wc);
  watchFocus(wc);
  // The editor preload exposes file IO, so an editor tab must never navigate away (e.g. on drag & drop)
  if (c.kind === 'editor') wc.on('will-navigate', e => e.preventDefault());

  if (c.kind === 'start') { tab.title = 'New Tab'; wc.loadFile(path.join(__dirname, 'start.html')); }
  else if (c.kind === 'editor') wc.loadFile(path.join(__dirname, 'editor.html'), { query: { file: c.file, url: pathToFileURL(c.file).href } });
  else if (opts.webContents) { /* the opener is already loading it */ }
  else if (c.kind === 'web') wc.loadURL(c.url);
  else wc.loadURL(pathToFileURL(c.file).href); // pdf / html / image: Chromium built-in viewers

  activate(id);
  return tab;
}

function closeTab(id, opts = {}) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  if (id === activeId) { win.contentView.removeChildView(t.view); activeId = null; }
  if (!opts.destroyed) t.view.webContents.close();
  if (!tabs.length) { createTab(''); return; }
  if (activeId === null) {
    // closing a popup returns to the page that opened it
    const opener = tabs.find(x => x.id === t.openerId);
    activate(opener ? opener.id : tabs[Math.min(i, tabs.length - 1)].id);
  } else pushState();
}

function cycleTab(dir) {
  if (tabs.length < 2) return;
  const i = tabs.findIndex(t => t.id === activeId);
  activate(tabs[(i + dir + tabs.length) % tabs.length].id);
}

async function openDialog() {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile', 'multiSelections'] });
  if (!r.canceled) r.filePaths.forEach(p => createTab(p));
}

function editCurrent() {
  const t = activeTab();
  if (canEdit(t)) createTab(t.file, { edit: true });
}

// ---------- search palette (o / : / O in NORMAL mode) ----------
function createPalette() {
  palette = new WebContentsView({
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'palette-preload.js') }
  });
  palette.setBackgroundColor('#00000000');
  palette.webContents.on('will-navigate', e => e.preventDefault());
  palette.webContents.loadFile(path.join(__dirname, 'palette.html'));
}

function openPalette(prefill = '') {
  const t = activeTab();
  const nh = t && t.view.webContents.navigationHistory;
  paletteOpen = true;
  win.contentView.addChildView(palette); // (re)adding puts it on top of the tab view
  layout();
  palette.webContents.focus();
  palette.webContents.send('palette:open', {
    prefill,
    activeId,
    editable: canEdit(t),
    canSave: !!(t && t.kind === 'editor'),
    canPreview: !!(t && t.kind === 'editor' && /\.(md|markdown)$/i.test(t.file)),
    canReload: !!(t && t.kind !== 'editor'),
    canBack: !!(nh && nh.canGoBack()),
    canForward: !!(nh && nh.canGoForward()),
    tabs: tabs.map(x => ({ id: x.id, kind: x.kind, title: x.title, addr: x.file || x.url || '' }))
  });
}

function closePalette(refocus = true) {
  if (!paletteOpen) return;
  paletteOpen = false;
  win.contentView.removeChildView(palette);
  const t = activeTab();
  if (refocus && t) t.view.webContents.focus();
}

// ---------- vi-style modes (there are no Ctrl shortcuts) ----------
// NORMAL: single keys control the app; printable keys never reach the page.
// INSERT: every key goes to the page; Esc returns to NORMAL.
let mode = 'NORMAL';
let pending = '';        // first key of a two-key command ("g" of "gt" / "gg")
let pendingTimer = null;

function setMode(m) {
  if (mode === m) return;
  mode = m;
  clearPending();
  pushState();
}
function clearPending() { pending = ''; clearTimeout(pendingTimer); }

function focusActive() { const t = activeTab(); if (t) t.view.webContents.focus(); }
function currentAddr() { const t = activeTab(); return t ? (t.file || t.url || '') : ''; }
function editorActive() { const t = activeTab(); return !!(t && t.kind === 'editor'); }

// Movement is done by sending the equivalent non-printable key to the page, so it works the same
// in web pages, the PDF viewer and Monaco (where j/k then move the cursor, as in vim).
function key(keyCode, modifiers = []) {
  const t = activeTab();
  if (!t) return;
  t.view.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
  t.view.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
}
const top = () => editorActive() ? key('Home', ['control']) : key('Home');
const bottom = () => editorActive() ? key('End', ['control']) : key('End');

const NORMAL_KEYS = {
  i: () => { setMode('INSERT'); focusActive(); },
  o: () => openPalette(''),
  ':': () => openPalette(':'),
  O: () => openPalette(currentAddr()),
  t: () => createTab(''),
  x: () => closeTab(activeId),
  J: () => cycleTab(1),
  K: () => cycleTab(-1),
  H: () => navActive('back'),
  L: () => navActive('forward'),
  r: () => navActive('reload'),
  e: editCurrent,
  h: () => key('Left'),
  j: () => key('Down'),
  k: () => key('Up'),
  l: () => key('Right'),
  d: () => key('PageDown'),
  u: () => key('PageUp'),
  ' ': () => key('PageDown'),
  G: bottom
};
const G_KEYS = { t: () => cycleTab(1), T: () => cycleTab(-1), g: top };

function attachKeys(wc) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (mode === 'INSERT') {
      if (input.key === 'Escape') setMode('NORMAL'); // the page still gets Esc (closes its popups, Monaco widgets, ...)
      return;
    }
    // Modified keys (copy/paste etc.) and non-printable keys (arrows, PageDown, Enter, Tab) pass through
    if (input.control || input.meta || input.alt) return;
    const k = input.key;
    if (k.length !== 1 && k !== 'Backspace' && k !== 'Delete') return;
    event.preventDefault();
    if (pending === 'g') {
      clearPending();
      pushState();
      if (Object.hasOwn(G_KEYS, k)) G_KEYS[k]();
      return;
    }
    if (k === 'g') {
      pending = 'g';
      pendingTimer = setTimeout(() => { clearPending(); pushState(); }, 1000);
      pushState();
      return;
    }
    if (/^[1-9]$/.test(k)) { // 1-8: that tab, 9: last tab
      const t = k === '9' ? tabs[tabs.length - 1] : tabs[Number(k) - 1];
      if (t) activate(t.id);
      return;
    }
    if (Object.hasOwn(NORMAL_KEYS, k)) NORMAL_KEYS[k]();
  });
}

// Clicking into a text field switches to INSERT; clicking anywhere else switches back to NORMAL.
const EDITABLE_JS = `(() => {
  let e = document.activeElement;
  while (e && e.shadowRoot && e.shadowRoot.activeElement) e = e.shadowRoot.activeElement;
  if (!e || e.tagName === 'IFRAME') return null; // can't see inside (cross-origin) frames: keep the mode
  if (e.isContentEditable || e.tagName === 'TEXTAREA' || e.tagName === 'SELECT') return true;
  return e.tagName === 'INPUT' && !/^(button|checkbox|radio|submit|reset|image|file|range|color)$/i.test(e.type);
})()`;
function watchFocus(wc) {
  wc.on('before-mouse-event', (_e, m) => {
    if (m.type !== 'mouseDown') return;
    setTimeout(() => {
      if (wc.isDestroyed()) return;
      wc.executeJavaScript(EDITABLE_JS, true)
        .then(editable => { if (editable !== null) setMode(editable ? 'INSERT' : 'NORMAL'); })
        .catch(() => { /* e.g. the PDF viewer: leave the mode alone */ });
    }, 60);
  });
}

// ---------- IPC ----------
ipcMain.on('new-tab', (_e, input) => createTab(input || ''));
ipcMain.on('activate', (_e, id) => activate(id));
ipcMain.on('close', (_e, id) => closeTab(id));
function go(input) {
  const t = activeTab();
  const c = classify(input);
  if (t && t.kind === 'web' && c.kind === 'web') { t.view.webContents.loadURL(c.url); return; }
  createTab(input);
  if (t && t.kind === 'start') closeTab(t.id);
}
const fromPalette = e => palette && e.sender === palette.webContents;
ipcMain.handle('palette:classify', (e, input) => {
  if (!fromPalette(e)) throw new Error('denied');
  const c = classify(input);
  return { kind: c.kind, search: !!c.search };
});
ipcMain.on('palette:close', e => { if (fromPalette(e)) closePalette(); });
ipcMain.on('palette:run', (e, a) => {
  if (!fromPalette(e) || !a) return;
  closePalette();
  if (a.type === 'go') go(String(a.input || ''));
  else if (a.type === 'tab') activate(a.id);
  else if (a.type === 'cmd') {
    const cmds = {
      'new-tab': () => createTab(''),
      'open-file': openDialog,
      'edit': editCurrent,
      'close-tab': () => closeTab(activeId),
      'reload': () => navActive('reload'),
      'back': () => navActive('back'),
      'forward': () => navActive('forward'),
      'save': () => editorCmd('save'),
      'preview': () => editorCmd('preview')
    };
    if (Object.hasOwn(cmds, a.name)) cmds[a.name]();
  }
});
function editorCmd(name) {
  const t = activeTab();
  if (t && t.kind === 'editor') t.view.webContents.send('editor:cmd', name);
}
function navActive(action) {
  const t = activeTab();
  if (!t) return;
  const wc = t.view.webContents;
  if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  else if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  else if (action === 'reload' && t.kind !== 'editor') wc.reload();
}
// File IO is bound to the calling editor tab: it can only read/write the file it was opened with.
function editorFile(e) {
  const t = tabs.find(x => x.view.webContents === e.sender);
  if (!t || t.kind !== 'editor' || !t.file) throw new Error('file access denied');
  return t.file;
}
ipcMain.handle('file:read', e => fs.promises.readFile(editorFile(e), 'utf8'));
ipcMain.handle('file:write', (e, text) => fs.promises.writeFile(editorFile(e), String(text), 'utf8'));

// ---------- app ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'Unitas',
    backgroundColor: '#1e1e1e',
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'shell-preload.js') }
  });
  shellWC = win.webContents;
  attachKeys(shellWC);
  createPalette();
  win.on('resize', layout);
  win.on('maximize', layout);
  win.on('unmaximize', layout);
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', layout);
  shellWC.loadFile(path.join(__dirname, 'shell.html'));
  shellWC.once('did-finish-load', () => {
    // Switches may come before the app path (e.g. flags from electron-flags.conf), so drop them first
    const args = process.argv.slice(1).filter(a => !a.startsWith('-'));
    if (process.defaultApp) args.shift(); // the app path in `electron <app> ...`
    if (args.length) args.forEach(a => createTab(a)); else createTab('');
  });
}

// No application menu: it would bring Electron's default Ctrl accelerators (reload, zoom, quit, ...)
Menu.setApplicationMenu(null);
app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
