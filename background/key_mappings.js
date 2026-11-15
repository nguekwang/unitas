// Default key mappings plus the user's map/unmap lines (cf. Vimium C background/key_mappings.ts).
const { COMMANDS } = require('./all_commands');
const settings = require('./settings');

// Vimium C's defaults, minus every Ctrl mapping (Unitas has no Ctrl shortcuts), plus ":" and "e".
// One deliberate difference: J = next tab, K = previous tab (Vimium C has them the other way round).
const DEFAULT_KEYS = {
  '?': 'showHelp',
  j: 'scrollDown', k: 'scrollUp', h: 'scrollLeft', l: 'scrollRight',
  gg: 'scrollToTop', G: 'scrollToBottom', zH: 'scrollToLeft', zL: 'scrollToRight',
  d: 'scrollPageDown', u: 'scrollPageUp',
  r: 'reload',
  yy: 'copyCurrentUrl', p: 'openCopiedUrlInCurrentTab', P: 'openCopiedUrlInNewTab',
  gu: 'goUp', gU: 'goToRoot',
  i: 'enterInsertMode', v: 'enterVisualMode', V: 'enterVisualLineMode',
  gi: 'focusInput',
  f: 'LinkHints.activate', F: 'LinkHints.activateOpenInNewTab', yf: 'LinkHints.activateCopyLinkUrl',
  '[[': 'goPrevious', ']]': 'goNext',
  m: 'Marks.activateCreate', '`': 'Marks.activate',
  o: 'Vomnibar.activate', O: 'Vomnibar.activateInNewTab', T: 'Vomnibar.activateTabs',
  ge: 'Vomnibar.activateEditUrl', gE: 'Vomnibar.activateEditUrlInNewTab',
  ':': 'Vomnibar.activateCommandLine',
  '/': 'enterFindMode', n: 'performFind', N: 'performBackwardsFind',
  H: 'goBack', L: 'goForward',
  J: 'nextTab', gt: 'nextTab', K: 'previousTab', gT: 'previousTab',
  g0: 'firstTab', 'g$': 'lastTab', '^': 'visitPreviousTab',
  t: 'createTab', yt: 'duplicateTab', x: 'removeTab', X: 'restoreTab',
  '<<': 'moveTabLeft', '>>': 'moveTabRight',
  e: 'editFile',
  '<f12>': 'toggleDevTools'
};

// "gg" → ["g","g"], "<space>j" → ["<space>","j"], "<<" → ["<","<"]
const tokenize = keys => String(keys).match(/<[a-z0-9]+(?:-[a-z0-9$]+)*>|./giu) || [];
exports.tokenize = tokenize;

const isCtrl = tokens => tokens.some(t => /^<(?:[ams]-)*c-/i.test(t));

let current = null;

exports.build = () => {
  const map = { ...DEFAULT_KEYS };
  const errors = [];
  for (const raw of settings.get().keyMappings || []) {
    const line = String(raw).trim();
    if (!line || line.startsWith('#') || line.startsWith('"')) continue;
    const [cmd, keys, name] = line.split(/\s+/);
    if (cmd === 'unmapAll') { for (const k of Object.keys(map)) delete map[k]; continue; }
    if (cmd === 'unmap' && keys) { delete map[keys]; continue; }
    if (cmd === 'map' && keys && name) {
      if (!Object.hasOwn(COMMANDS, name)) { errors.push(`unknown command: ${name}`); continue; }
      if (isCtrl(tokenize(keys))) { errors.push(`Ctrl mappings are not allowed: ${keys}`); continue; }
      map[keys] = name;
      continue;
    }
    errors.push(`can't parse: ${line}`);
  }
  if (errors.length) console.warn('keyMappings:', errors.join('; '));
  current = Object.entries(map).map(([keys, command]) => ({ keys: tokenize(keys), command }));
  return current;
};

exports.get = () => current || exports.build();

// command → keys, for help and the vomnibar
exports.keysFor = command => exports.get().filter(m => m.command === command).map(m => m.keys.join(''));
