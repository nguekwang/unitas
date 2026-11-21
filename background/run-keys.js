// Key handling done in the main process (cf. Vimium C background/run_keys.ts).
// Only used for PDF tabs: Chromium's PDF viewer is a plugin, so keys typed into it never reach the
// content script. Here they are matched against the same key mappings via before-input-event.
const keyMappings = require('./key-mappings');
const settings = require('./settings');

const NAMED = {
  ' ': 'space', Escape: 'esc', Enter: 'enter', Tab: 'tab', Backspace: 'backspace', Delete: 'delete',
  ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
  PageUp: 'pageup', PageDown: 'pagedown', Home: 'home', End: 'end', Insert: 'insert'
};
const tokenOf = input => {
  const k = input.key;
  if (!k) return null;
  if (k.length === 1) return k === ' ' ? '<space>' : k;
  if (NAMED[k]) return `<${input.shift ? 's-' : ''}${NAMED[k]}>`;
  return null;
};
const startsWith = (keys, seq) => seq.every((k, i) => keys[i] === k);

exports.attach = tab => {
  const wc = tab.view.webContents;
  let pending = [];
  let count = '';
  const report = () => {
    tab.pending = count + pending.join('');
    require('./browser').pushState();
  };
  const reset = () => { pending = []; count = ''; report(); };

  wc.on('before-input-event', (event, input) => {
    if (tab.kind !== 'pdf' || input.type !== 'keyDown') return;
    if (input.control || input.meta || input.alt) return;
    const key = tokenOf(input);
    if (!key) return;
    if (key === '<esc>') { if (pending.length || count) reset(); return; }
    if (!pending.length && /^[0-9]$/.test(key) && (count || key !== '0')) {
      event.preventDefault();
      count += key;
      report();
      return;
    }
    let seq = [...pending, key];
    let matches = keyMappings.get().filter(m => startsWith(m.keys, seq));
    if (!matches.length && pending.length) { seq = [key]; matches = keyMappings.get().filter(m => startsWith(m.keys, seq)); }
    if (!matches.length) { if (pending.length || count) reset(); return; } // unmapped: the viewer gets it
    event.preventDefault();
    const exact = matches.find(m => m.keys.length === seq.length);
    if (exact && matches.length === 1) {
      const n = parseInt(count || '1', 10);
      pending = []; count = ''; report();
      require('./run-commands').run(exact.command, n, tab);
      return;
    }
    pending = seq;
    report();
  });
};

// Page commands for the PDF viewer. Chromium's viewer runs in its own frame
// (chrome-extension://mhjf…/index.html) and exposes viewer.viewport.position / setPosition().
// That is internal to Chromium: if a future version changes it, a HUD message says so.
const PDF_FRAME = 'chrome-extension://mhjfbmdgcfjbbpaeojofohoefgiehjai/';

exports.runInPdf = async (name, count, tab) => {
  const wc = tab.view.webContents;
  const { height } = tab.view.getBounds();
  const step = settings.get().scrollStepSize * count;
  const half = Math.round(height / 2) * count;
  // [dx, dy] relative, or "top" / "bottom"
  const MOVES = {
    scrollDown: [0, step], scrollUp: [0, -step], scrollLeft: [-step, 0], scrollRight: [step, 0],
    scrollPageDown: [0, half], scrollPageUp: [0, -half], scrollToTop: 'top', scrollToBottom: 'bottom'
  };
  if (!Object.hasOwn(MOVES, name)) { require('./browser').hud('Not available in the PDF viewer', tab); return; }
  const move = MOVES[name];

  const frame = wc.mainFrame.framesInSubtree.find(f => f.url.startsWith(PDF_FRAME));
  if (frame) {
    const js = `(() => {
      const v = window.viewer && viewer.viewport;
      if (!v || typeof v.setPosition !== 'function') return false;
      const p = v.position, m = ${JSON.stringify(move)};
      if (m === 'top') v.setPosition({ x: p.x, y: 0 });
      else if (m === 'bottom') v.setPosition({ x: p.x, y: v.contentSize.height });
      else v.setPosition({ x: p.x + m[0], y: p.y + m[1] });
      return true;
    })()`;
    try { if (await frame.executeJavaScript(js)) return; } catch { /* reported below */ }
  }
  require('./browser').hud('PDF scrolling is unavailable in this Chromium version', tab);
};
