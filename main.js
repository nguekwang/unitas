const { app, BrowserWindow, WebContentsView, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { pathToFileURL, fileURLToPath } = require('url');

const TOP = 80; // height of tab strip + toolbar (px)
const VIEW_EXT = { pdf: 'pdf', html: 'html', htm: 'html', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image' };

let win;
let shellWC;
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
  return { kind: 'web', url: 'https://www.google.com/search?q=' + encodeURIComponent(input) };
}

// ---------- tabs ----------
function activeTab() { return tabs.find(t => t.id === activeId); }

function layout() {
  const t = activeTab();
  if (!win || !t) return;
  const b = win.getContentBounds();
  t.view.setBounds({ x: 0, y: TOP, width: b.width, height: Math.max(0, b.height - TOP) });
}

function pushState() {
  if (!shellWC || shellWC.isDestroyed()) return;
  const t = activeTab();
  const nh = t && t.view.webContents.navigationHistory;
  shellWC.send('tabs', {
    activeId,
    canBack: !!(nh && nh.canGoBack()),
    canForward: !!(nh && nh.canGoForward()),
    tabs: tabs.map(x => ({ id: x.id, kind: x.kind, title: x.title, addr: x.file || x.url || '', file: x.file || null }))
  });
}

function activate(id) {
  const t = tabs.find(x => x.id === id);
  if (!t) return;
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
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      preload: c.kind === 'editor' ? path.join(__dirname, 'editor-preload.js') : undefined
    }
  });
  const tab = { id, view, kind: c.kind, file: c.file || null, url: c.url || null, title: c.file ? path.basename(c.file) : (c.url || 'New Tab') };
  tabs.push(tab);
  const wc = view.webContents;

  wc.on('page-title-updated', (_e, title) => { tab.title = title; pushState(); });
  wc.on('did-navigate', (_e, url) => { if (tab.kind === 'web') tab.url = url; pushState(); });
  wc.on('did-navigate-in-page', (_e, url) => { if (tab.kind === 'web') tab.url = url; pushState(); });
  wc.setWindowOpenHandler(({ url }) => { createTab(url); return { action: 'deny' }; });
  attachShortcuts(wc);

  if (c.kind === 'start') { tab.title = 'New Tab'; wc.loadFile(path.join(__dirname, 'start.html')); }
  else if (c.kind === 'editor') wc.loadFile(path.join(__dirname, 'editor.html'), { query: { file: c.file, url: pathToFileURL(c.file).href } });
  else if (c.kind === 'web') wc.loadURL(c.url);
  else wc.loadURL(pathToFileURL(c.file).href); // pdf / html / image: Chromium built-in viewers

  activate(id);
  return tab;
}

function closeTab(id) {
  const i = tabs.findIndex(t => t.id === id);
  if (i < 0) return;
  const [t] = tabs.splice(i, 1);
  if (id === activeId) { win.contentView.removeChildView(t.view); activeId = null; }
  t.view.webContents.close();
  if (!tabs.length) { createTab(''); return; }
  if (activeId === null) activate(tabs[Math.min(i, tabs.length - 1)].id);
  else pushState();
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
  if (t && t.file && t.kind !== 'editor') createTab(t.file, { edit: true });
}

// ---------- shortcuts (work even when focus is inside a page) ----------
function attachShortcuts(wc) {
  wc.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const mod = input.control || input.meta;
    if (!mod) return;
    const k = input.key.toLowerCase();
    const run = fn => { event.preventDefault(); fn(); };
    if (k === 't') run(() => createTab(''));
    else if (k === 'w') run(() => closeTab(activeId));
    else if (k === 'l') run(() => { shellWC.focus(); shellWC.send('focus-address'); });
    else if (k === 'o') run(openDialog);
    else if (k === 'e') run(editCurrent);
    else if (k === 'tab') run(() => cycleTab(input.shift ? -1 : 1));
    else if (k === 'r' && !input.shift) run(() => { const t = activeTab(); if (t && t.kind !== 'editor') t.view.webContents.reload(); });
  });
}

// ---------- IPC ----------
ipcMain.on('new-tab', (_e, input) => createTab(input || ''));
ipcMain.on('activate', (_e, id) => activate(id));
ipcMain.on('close', (_e, id) => closeTab(id));
ipcMain.on('open-dialog', openDialog);
ipcMain.on('edit-current', editCurrent);
ipcMain.on('go', (_e, input) => {
  const t = activeTab();
  const c = classify(input);
  if (t && t.kind === 'web' && c.kind === 'web') { t.view.webContents.loadURL(c.url); return; }
  const n = createTab(input);
  if (t && t.kind === 'start') closeTab(t.id);
  return n;
});
ipcMain.on('nav', (_e, action) => {
  const t = activeTab();
  if (!t) return;
  const wc = t.view.webContents;
  if (action === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  else if (action === 'forward' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  else if (action === 'reload' && t.kind !== 'editor') wc.reload();
});
ipcMain.handle('file:read', (_e, p) => fs.promises.readFile(p, 'utf8'));
ipcMain.handle('file:write', (_e, p, text) => fs.promises.writeFile(p, text, 'utf8'));

// ---------- app ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    title: 'Unitas',
    backgroundColor: '#1e1e1e',
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, 'shell-preload.js') }
  });
  win.setMenuBarVisibility(false);
  shellWC = win.webContents;
  attachShortcuts(shellWC);
  win.on('resize', layout);
  win.on('maximize', layout);
  win.on('unmaximize', layout);
  win.on('enter-full-screen', layout);
  win.on('leave-full-screen', layout);
  shellWC.loadFile(path.join(__dirname, 'shell.html'));
  shellWC.once('did-finish-load', () => {
    const args = process.argv.slice(app.isPackaged ? 1 : 2).filter(a => !a.startsWith('-'));
    if (args.length) args.forEach(a => createTab(a)); else createTab('');
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
