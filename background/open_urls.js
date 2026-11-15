// Commands that open or copy URLs (cf. Vimium C background/open_urls.ts). Each takes (count, tab).
const store = require('./store');
const browser = require('./browser');
const clipboard = require('./clipboard');

exports.openUrl = (url, { newTab = false, tab = browser.activeTab() } = {}) => {
  if (newTab || !tab) browser.createTab(url, { index: tab ? store.tabs.indexOf(tab) + 1 : undefined });
  else browser.go(url);
};

exports.copyCurrentUrl = (_count, t) => {
  const addr = browser.addrOf(t);
  if (!addr) return;
  clipboard.copy(addr);
  browser.hud('Copied: ' + addr, t);
};

const openCopied = newTab => (_count, t) => {
  const text = clipboard.paste();
  if (!text) { browser.hud('The clipboard is empty', t); return; }
  exports.openUrl(text, { newTab, tab: t });
};
exports.openCopiedUrlInCurrentTab = openCopied(false);
exports.openCopiedUrlInNewTab = openCopied(true);

// "3gu" goes up three levels: /a/b/c/d → /a
exports.goUp = (count, t) => {
  if (!t || t.kind !== 'web') return;
  const u = new URL(t.url);
  if (u.hash || u.search) { u.hash = ''; u.search = ''; count--; }
  const parts = u.pathname.split('/').filter(Boolean);
  u.pathname = '/' + parts.slice(0, Math.max(0, parts.length - count)).join('/');
  t.view.webContents.loadURL(u.href);
};

exports.goToRoot = (_count, t) => {
  if (t && t.kind === 'web') t.view.webContents.loadURL(new URL(t.url).origin + '/');
};
