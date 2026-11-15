// Marks (cf. Vimium C background/tools.ts): a-z are per page, A-Z are global (they remember the page).
// Stored in userData/marks.json.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

let marks = null; // { local: { url: { a: {x, y} } }, global: { A: { url, x, y } } }
const file = () => path.join(app.getPath('userData'), 'marks.json');

function load() {
  if (marks) return marks;
  try { marks = JSON.parse(fs.readFileSync(file(), 'utf8')); } catch { marks = {}; }
  marks.local = marks.local || {};
  marks.global = marks.global || {};
  return marks;
}
const save = () => fs.promises.writeFile(file(), JSON.stringify(marks)).catch(e => console.error('marks:', e.message));
// local marks ignore the #fragment, like Vimium
const pageKey = url => String(url).split('#')[0];

exports.Marks = {
  set({ name, url, x, y }) {
    const m = load();
    if (/^[A-Z]$/.test(name)) m.global[name] = { url, x, y };
    else if (/^[a-z]$/.test(name)) (m.local[pageKey(url)] = m.local[pageKey(url)] || {})[name] = { x, y };
    else return false;
    save();
    return true;
  },
  getLocal(name, url) { return (load().local[pageKey(url)] || {})[name] || null; },
  getGlobal(name) { return load().global[name] || null; }
};
