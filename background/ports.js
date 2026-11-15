// IPC between the content scripts in each tab and the main process (cf. Vimium C background/ports.ts).
// Only messages from a known tab's webContents are accepted; the content script runs in an isolated
// world, so the pages themselves can't reach these channels.
const { ipcMain } = require('electron');
const fs = require('fs');
const store = require('./store');
const settings = require('./settings');
const keyMappings = require('./key_mappings');
const browser = require('./browser');
const clipboard = require('./clipboard');
const help = require('./help_dialog');
const uiCss = require('./ui_css');
const { COMMANDS } = require('./all_commands');
const { Marks } = require('./tools');

const payload = () => {
  const s = settings.get();
  return {
    mappings: keyMappings.get(),
    settings: {
      linkHintCharacters: String(s.linkHintCharacters || 'sadjklewcmpgh'),
      scrollStepSize: Number(s.scrollStepSize) || 100,
      smoothScroll: s.smoothScroll !== false,
      grabBackFocus: !!s.grabBackFocus
    },
    css: uiCss.get()
  };
};

// Scroll a tab to a saved position once its page has loaded
const scrollWhenLoaded = (t, pos) => {
  const wc = t.view.webContents;
  const send = () => browser.sendToTab(t, 'scrollTo', pos);
  if (wc.isLoading()) wc.once('did-finish-load', send); else send();
};

exports.init = () => {
  // from: the sender must be a tab's own webContents
  const on = (channel, fn) => ipcMain.on('vc:' + channel, (e, data) => {
    const t = browser.tabOf(e.sender);
    if (t) fn(t, data == null ? {} : data, e);
  });
  const handle = (channel, fn) => ipcMain.handle('vc:' + channel, (e, data) => {
    const t = browser.tabOf(e.sender);
    return t ? fn(t, data == null ? {} : data, e) : null;
  });

  handle('init', () => payload());
  handle('help', () => help.data());
  handle('findQuery', () => store.findQuery);
  handle('marks:getLocal', (t, { name }) => Marks.getLocal(String(name), t.view.webContents.getURL()));

  on('mode', (t, { mode, pending }) => {
    t.mode = String(mode || 'NORMAL');
    t.pending = String(pending || '');
    if (t.id === store.activeId) browser.pushState();
  });
  on('cmd', (t, { name, count }) => {
    // content commands run in the page itself; only background ones are accepted here
    if (Object.hasOwn(COMMANDS, name) && COMMANDS[name].where === 'background') require('./run_commands').run(name, count, t);
  });
  on('copy', (t, { text }) => { if (typeof text === 'string' && text.length < 1e6) clipboard.copy(text); });
  on('findQuery', (_t, { query }) => { store.findQuery = String(query || ''); });
  // Find mode uses Chromium's find-in-page: every match highlighted, page selection/focus untouched
  on('find', (t, { query, forward, newSession }) => {
    const q = String(query || '');
    if (q) t.view.webContents.findInPage(q, { forward: forward !== false, findNext: !!newSession, matchCase: /[A-Z]/.test(q) });
  });
  on('find:stop', (t, { action }) => {
    const ok = ['clearSelection', 'keepSelection', 'activateSelection'];
    t.view.webContents.stopFindInPage(ok.includes(action) ? action : 'keepSelection');
  });
  // A real (trusted) click at page coordinates, used by link hints: sites that ignore synthetic
  // clicks still react, and target=_blank links still become tabs.
  on('click', (t, { x, y }) => {
    const wc = t.view.webContents;
    const z = wc.getZoomFactor();
    const at = { x: Math.round(Number(x) * z), y: Math.round(Number(y) * z) };
    if (!Number.isFinite(at.x) || !Number.isFinite(at.y)) return;
    wc.sendInputEvent({ type: 'mouseMove', ...at });
    wc.sendInputEvent({ type: 'mouseDown', ...at, button: 'left', clickCount: 1 });
    wc.sendInputEvent({ type: 'mouseUp', ...at, button: 'left', clickCount: 1 });
  });
  on('openUrl', (t, { url, newTab }) => {
    if (!/^https?:\/\//i.test(String(url))) return;
    require('./open_urls').openUrl(String(url), { newTab: !!newTab, tab: t });
  });
  on('marks:set', (t, { name, x, y }) => {
    const ok = Marks.set({ name: String(name), url: t.view.webContents.getURL(), x: Number(x) || 0, y: Number(y) || 0 });
    browser.hud(ok ? `Created ${/^[A-Z]$/.test(name) ? 'global' : 'local'} mark '${name}'` : 'Marks are a-z (this page) or A-Z (global)', t);
  });
  on('marks:gotoGlobal', (t, { name }) => {
    const m = Marks.getGlobal(String(name));
    if (!m) { browser.hud(`Mark '${name}' is not set`, t); return; }
    const page = u => String(u).split('#')[0];
    const target = store.tabs.find(x => page(x.view.webContents.getURL()) === page(m.url));
    if (target) { browser.activate(target.id); scrollWhenLoaded(target, m); return; }
    scrollWhenLoaded(browser.createTab(m.url), m);
  });

  // Editor tabs (editor-preload.js): file IO is bound to the calling editor tab and can only
  // read/write the one file it was opened with — there is no path argument.
  const editorFile = e => {
    const t = browser.tabOf(e.sender);
    if (!t || t.kind !== 'editor' || !t.file) throw new Error('file access denied');
    return t.file;
  };
  ipcMain.handle('file:read', e => fs.promises.readFile(editorFile(e), 'utf8'));
  ipcMain.handle('file:write', (e, text) => fs.promises.writeFile(editorFile(e), String(text), 'utf8'));

  settings.onChange(() => {
    keyMappings.build();
    const p = payload();
    store.tabs.forEach(t => browser.sendToTab(t, 'settings', p));
  });
};
