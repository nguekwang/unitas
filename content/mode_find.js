// Find mode (cf. Vimium C content/mode_find.ts). The bar is drawn here; the searching itself is
// Chromium's find-in-page (run by the main process), so every match is highlighted and the page's
// own selection and focus are left alone while typing.
const FindMode = (() => {
  let bar = null;
  let input = null;
  let count = null;
  let last = '';            // last accepted query in this tab
  let sessionOpen = false;  // a find session is showing highlights (n / N continue it)

  const isActive = () => !!bar;

  function enter() {
    if (bar) return;
    bar = DomUI.el('div', 'find-bar');
    input = DomUI.el('input', 'find-input');
    input.spellcheck = false;
    count = DomUI.el('span', 'find-count');
    bar.append(input, count);
    DomUI.add(bar);
    input.addEventListener('input', () => {
      const q = input.value;
      if (q) { Port.send('find', { query: q, forward: true, newSession: true }); sessionOpen = true; }
      else { stop('clearSelection'); count.textContent = ''; }
    });
    input.focus();
    KeyHandler.report();
  }

  function stop(action) {
    if (!sessionOpen) return;
    sessionOpen = false;
    Port.send('find:stop', { action });
  }

  // accept: Enter keeps the match selected (ready for visual mode); Esc clears it
  function exit(accept) {
    if (!bar) return;
    const q = input.value;
    bar.remove();
    bar = input = count = null;
    if (accept && q) {
      last = q;
      Port.send('findQuery', { query: q });
      stop('keepSelection');
    } else stop('clearSelection');
    KeyHandler.report();
  }

  // While the bar is open: Esc / Enter close it, everything else is typed into it
  function onKey(key) {
    if (key === '<esc>') { exit(false); return true; }
    if (key === '<enter>') { exit(true); return true; }
    return false;
  }

  async function next(backwards, times = 1) {
    const q = last || await Port.invoke('findQuery');
    if (!q) { HUD.tip('Nothing to find yet: press / first'); return; }
    last = q;
    for (let i = 0; i < times; i++) {
      Port.send('find', { query: q, forward: !backwards, newSession: !sessionOpen });
      sessionOpen = true;
    }
  }

  // Results from the main process: { active, matches }
  Port.on('findResult', ({ active, matches }) => {
    const text = matches ? `${active} / ${matches}` : 'No matches';
    if (count) count.textContent = text;
    else HUD.tip(`/${last}  ${text}`);
  });

  return { enter, exit, onKey, next, isActive, clearHighlights: () => stop('keepSelection') };
})();
