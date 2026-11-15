// User settings, persisted as JSON in the app's userData folder (cf. Vimium C background/settings.ts).
// Edit them with the :settings command; changes are picked up while the app runs.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  // One line per entry: "map <keys> <command>", "unmap <keys>", "unmapAll". "#" starts a comment.
  // Keys use Vimium notation: "gg", "<space>", "<esc>". Ctrl mappings ("<c-…>") are ignored by design.
  keyMappings: [
    '# map j scrollDown',
    '# unmap x'
  ],
  linkHintCharacters: 'sadjklewcmpgh',
  scrollStepSize: 100,
  smoothScroll: true,
  // Keep pages from focusing a text field on load (the page stays in NORMAL mode)
  grabBackFocus: false,
  searchUrl: 'https://www.google.com/search?q=%s',
  // "<keyword>: <url with %s> <name>" — type "<keyword> <terms>" in the vomnibar
  searchEngines: [
    'g: https://www.google.com/search?q=%s Google',
    'd: https://duckduckgo.com/?q=%s DuckDuckGo',
    'w: https://en.wikipedia.org/w/index.php?search=%s Wikipedia',
    'aw: https://wiki.archlinux.org/index.php?search=%s ArchWiki',
    'gh: https://github.com/search?q=%s GitHub',
    'y: https://www.youtube.com/results?search_query=%s YouTube'
  ]
};

let current = { ...DEFAULTS };
const listeners = [];

exports.file = () => path.join(app.getPath('userData'), 'settings.json');
exports.get = () => current;
exports.onChange = fn => listeners.push(fn);

exports.load = () => {
  const file = exports.file();
  try {
    current = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (e) {
    current = { ...DEFAULTS };
    if (e.code === 'ENOENT') {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, JSON.stringify(DEFAULTS, null, 2) + '\n');
    } else {
      console.error('settings.json could not be read, using defaults:', e.message);
    }
  }
  return current;
};

exports.watch = () => {
  fs.watchFile(exports.file(), { interval: 1000 }, () => {
    exports.load();
    listeners.forEach(fn => fn(current));
  });
};

// "key: url name" lines → { key: { url, name } }
exports.searchEngines = () => {
  const out = {};
  for (const line of current.searchEngines || []) {
    const m = String(line).match(/^\s*([^\s:#]+)\s*:\s*(\S+)\s*(.*)$/);
    if (m && m[2].includes('%s')) out[m[1]] = { url: m[2], name: m[3].trim() || m[1] };
  }
  return out;
};
