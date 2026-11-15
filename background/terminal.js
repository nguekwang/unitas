// Integrated terminal: one shell per terminal tab, run with node-pty in the main process and drawn by
// xterm.js in terminal.html. The terminal page only gets input/resize/output channels, and only a
// terminal tab's own webContents may use them.
const { ipcMain } = require('electron');
const os = require('os');
const pty = require('node-pty');
const store = require('./store');
const browser = require('./browser');

const shells = new Map(); // tab id → pty

const terminalTab = e => {
  const t = browser.tabOf(e.sender);
  return t && t.kind === 'terminal' ? t : null;
};
const size = n => Math.max(2, Math.min(1000, Number(n) | 0 || 80));

function start(t, cols, rows) {
  const wc = t.view.webContents;
  const shell = process.env.SHELL || '/bin/bash';
  const p = pty.spawn(shell, [], {
    name: 'xterm-256color',
    cols: size(cols),
    rows: size(rows),
    cwd: t.cwd || os.homedir(),
    env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'unitas' }
  });
  shells.set(t.id, p);

  // Coalesce output a little: a burst (cat of a big file) becomes a few IPC messages, not thousands
  let buf = '';
  let timer = null;
  const flush = () => { timer = null; if (buf && !wc.isDestroyed()) wc.send('term:data', buf); buf = ''; };
  p.onData(d => { buf += d; if (!timer) timer = setTimeout(flush, 4); });
  // The shell exited (exit, Ctrl+D): close its tab, as VS Code does
  p.onExit(() => {
    flush();
    shells.delete(t.id);
    if (store.tabs.includes(t)) browser.closeTab(t.id);
  });
  // The tab closed first: end the shell
  wc.once('destroyed', () => kill(t.id));
}

function kill(id) {
  const p = shells.get(id);
  if (!p) return;
  shells.delete(id);
  try { p.kill(); } catch { /* already gone */ }
}

exports.init = () => {
  ipcMain.on('term:start', (e, { cols, rows } = {}) => {
    const t = terminalTab(e);
    if (!t) return;
    const p = shells.get(t.id);
    if (p) p.resize(size(cols), size(rows)); // the page was reloaded: keep the same shell
    else start(t, cols, rows);
  });
  ipcMain.on('term:input', (e, data) => {
    const t = terminalTab(e);
    const p = t && shells.get(t.id);
    if (p && typeof data === 'string') p.write(data);
  });
  ipcMain.on('term:resize', (e, { cols, rows } = {}) => {
    const t = terminalTab(e);
    const p = t && shells.get(t.id);
    if (p) p.resize(size(cols), size(rows));
  });
};

exports.killAll = () => [...shells.keys()].forEach(kill);
