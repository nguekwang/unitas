// Vomnibar suggestions: typed URL/search, tabs, history, commands (cf. Vimium C background/completion.ts).
const store = require('./store');
const browser = require('./browser');
const history = require('./browsing_data_manager');
const keyMappings = require('./key_mappings');
const { COMMANDS } = require('./all_commands');
const { classify } = require('./normalize_urls');

const ICON = { web: '🌐', pdf: '📕', html: '🧩', image: '🖼', editor: '📝', start: '✦' };

// Substring match ranks first (by position); otherwise a subsequence match ranked by gaps. -1 = no match.
function score(q, text) {
  text = String(text).toLowerCase();
  const at = text.indexOf(q);
  if (at >= 0) return at;
  let i = 0, last = -1, gaps = 0;
  for (const ch of q) {
    const j = text.indexOf(ch, i);
    if (j < 0) return -1;
    if (last >= 0) gaps += j - last - 1;
    last = j; i = j + 1;
  }
  return 1000 + gaps;
}
// every space-separated word must match
const scoreAll = (q, text) => {
  let total = 0;
  for (const w of q.split(/\s+/).filter(Boolean)) {
    const s = score(w, text);
    if (s < 0) return -1;
    total += s;
  }
  return total;
};
const rank = (q, arr, key, tiebreak = () => 0) => {
  if (!q) return arr;
  return arr.map(x => [scoreAll(q, key(x)), x]).filter(p => p[0] >= 0)
    .sort((a, b) => (a[0] - b[0]) || tiebreak(a[1], b[1])).map(p => p[1]);
};

const available = (name, t) => {
  if (name === 'saveFile') return !!(t && t.kind === 'editor');
  if (name === 'togglePreview') return !!(t && t.kind === 'editor' && /\.(md|markdown)$/i.test(t.file));
  if (name === 'editFile') return browser.canEdit(t);
  if (name === 'goUp' || name === 'goToRoot') return !!(t && t.kind === 'web');
  return true;
};

// mode: "omni" | "tabs" | "command"
exports.query = (raw, mode) => {
  raw = String(raw || '');
  const t = browser.activeTab();
  const isCmd = mode === 'command' || /^\s*:/.test(raw);
  const body = raw.replace(/^\s*:/, '');
  const q = body.trim().toLowerCase();
  const out = [];

  const cmds = Object.entries(COMMANDS).filter(([name]) => available(name, t))
    .map(([name, d]) => ({ name, ...d, keys: keyMappings.keysFor(name) }));
  const cmdItem = (c, sec) => ({
    sec, icon: '›', title: c.desc, sub: c.alias.length ? ':' + c.alias[0] : '', key: c.keys[0] || '',
    run: { type: 'cmd', name: c.name }
  });

  // ":w", ":q", ... exact command names first
  const exact = q ? cmds.filter(c => c.alias.includes(q)) : [];
  exact.forEach(c => out.push(cmdItem(c, 'Run')));

  if (mode !== 'tabs' && !isCmd && q) {
    const c = classify(body);
    const title = c.kind === 'web'
      ? (c.search ? (c.engine ? `Search ${c.engine}` : 'Search the web') : 'Open page')
      : 'Open file';
    out.push({ sec: 'Open', icon: c.kind === 'web' ? (c.search ? '🔍' : '🌐') : (ICON[c.kind] || '📄'), title, sub: body.trim(), run: { type: 'go', input: body } });
  }

  if (!isCmd) {
    for (const x of rank(q, store.tabs, x => x.title + ' ' + browser.addrOf(x))) {
      out.push({ sec: 'Tabs', icon: ICON[x.kind] || '·', title: x.title, sub: x.id === store.activeId ? 'Current tab' : browser.addrOf(x), run: { type: 'tab', id: x.id } });
    }
  }

  if (mode === 'omni' && !isCmd) {
    const open = new Set(store.tabs.map(browser.addrOf));
    const all = history.all().filter(h => !open.has(h.url));
    const byRecent = (a, b) => b.last - a.last;
    const list = q ? rank(q, all, h => (h.title || '') + ' ' + h.url, byRecent) : all.sort(byRecent);
    for (const h of list.slice(0, q ? 10 : 6)) {
      out.push({ sec: 'History', icon: '🕘', title: h.title || h.url, sub: h.url, run: { type: 'url', url: h.url } });
    }
  }

  if (isCmd || (mode === 'omni' && q)) {
    const rest = rank(q, cmds.filter(c => !exact.includes(c)), c => `${c.desc} ${c.name} ${c.alias.join(' ')}`);
    rest.slice(0, isCmd ? 100 : 6).forEach(c => out.push(cmdItem(c, 'Commands')));
  }
  return out;
};
