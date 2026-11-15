// Commands that act on tabs (cf. Vimium C background/tab_commands.ts). Each takes (count, tab).
const store = require('./store');
const browser = require('./browser');

const indexOf = t => store.tabs.indexOf(t);
const at = i => store.tabs[((i % store.tabs.length) + store.tabs.length) % store.tabs.length];

exports.nextTab = (count, t) => browser.activate(at(indexOf(t) + count).id);
exports.previousTab = (count, t) => browser.activate(at(indexOf(t) - count).id);
// "3g0" → third tab, "2g$" → second to last, as in Vimium C
exports.firstTab = count => browser.activate(at(Math.min(count, store.tabs.length) - 1).id);
exports.lastTab = count => browser.activate(at(store.tabs.length - Math.min(count, store.tabs.length)).id);

exports.visitPreviousTab = () => {
  if (store.tabs.some(x => x.id === store.previousTabId)) browser.activate(store.previousTabId);
};

exports.createTab = count => { for (let i = 0; i < count; i++) browser.createTab(''); };

exports.duplicateTab = (count, t) => {
  const addr = browser.addrOf(t);
  for (let i = 0; i < count; i++) {
    browser.createTab(addr, { edit: t.kind === 'editor', index: indexOf(t) + 1, background: i < count - 1 });
  }
};

exports.removeTab = (count, t) => {
  const ids = store.tabs.slice(indexOf(t), indexOf(t) + count).map(x => x.id);
  ids.forEach(id => browser.closeTab(id));
};

exports.restoreTab = count => {
  for (let i = 0; i < count; i++) {
    const c = store.closedTabs.pop();
    if (!c) break;
    browser.createTab(c.addr, { edit: c.kind === 'editor', index: c.index });
  }
};

function move(t, delta) {
  const i = indexOf(t);
  const j = Math.max(0, Math.min(store.tabs.length - 1, i + delta));
  if (i === j) return;
  store.tabs.splice(i, 1);
  store.tabs.splice(j, 0, t);
  browser.pushState();
}
exports.moveTabLeft = (count, t) => move(t, -count);
exports.moveTabRight = (count, t) => move(t, count);
