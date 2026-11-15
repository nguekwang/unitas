// Turns what the user typed into something to open (cf. Vimium C background/normalize_urls.ts).
const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');
const settings = require('./settings');

const VIEW_EXT = { pdf: 'pdf', html: 'html', htm: 'html', png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', svg: 'image' };

// → { kind: 'start' | 'web' | 'pdf' | 'html' | 'image' | 'editor', url?, file?, search?, engine? }
exports.classify = raw => {
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
  // localhost and IP addresses (often dev servers without TLS) → http, like Chrome
  if (/^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?([/?#].*)?$/i.test(input)) return { kind: 'web', url: 'http://' + input };
  if (!/\s/.test(input) && /\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(input)) return { kind: 'web', url: 'https://' + input };
  // "w tokyo" → the "w" search engine
  const m = input.match(/^(\S+)\s+(.+)$/);
  const engines = settings.searchEngines();
  if (m && Object.hasOwn(engines, m[1])) {
    const e = engines[m[1]];
    return { kind: 'web', search: true, engine: e.name, url: e.url.replace(/%s/g, encodeURIComponent(m[2])) };
  }
  return { kind: 'web', search: true, engine: null, url: settings.get().searchUrl.replace(/%s/g, encodeURIComponent(input)) };
};
