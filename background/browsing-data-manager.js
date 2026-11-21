// Visited pages, for the vomnibar's history suggestions (cf. Vimium C background/browsing_data_manager.ts).
// Stored locally in userData/history.json, like any browser's history.
const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const MAX = 5000;
let entries = null; // url → { url, title, visits, last }
let saveTimer = null;

const file = () => path.join(app.getPath('userData'), 'history.json');

function load() {
  if (entries) return entries;
  entries = new Map();
  try {
    for (const e of JSON.parse(fs.readFileSync(file(), 'utf8'))) entries.set(e.url, e);
  } catch { /* first run */ }
  return entries;
}

function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const list = [...load().values()].sort((a, b) => b.last - a.last).slice(0, MAX);
    fs.promises.writeFile(file(), JSON.stringify(list)).catch(e => console.error('history:', e.message));
  }, 2000);
}

exports.record = (url, title) => {
  if (!/^https?:\/\//i.test(url)) return;
  const e = load().get(url) || { url, title: '', visits: 0, last: 0 };
  e.visits++;
  e.last = Date.now();
  if (title) e.title = title;
  entries.set(url, e);
  save();
};

exports.setTitle = (url, title) => {
  const e = url && load().get(url);
  if (e && title) { e.title = title; save(); }
};

exports.all = () => [...load().values()];

exports.flush = () => {
  if (!saveTimer || !entries) return;
  clearTimeout(saveTimer);
  const list = [...entries.values()].sort((a, b) => b.last - a.last).slice(0, MAX);
  fs.writeFileSync(file(), JSON.stringify(list));
};
