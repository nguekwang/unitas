// Marks (cf. Vimium C content/marks.ts): m{a-z} marks this page's scroll position, m{A-Z} a global
// one that also remembers the page; `{letter} jumps back; `` returns to where you were before.
const Marks = (() => {
  let waiting = null;  // null | "create" | "goto"
  let previous = null; // position before the last jump

  const here = () => ({ x: scrollX, y: scrollY });
  const jump = p => { previous = here(); scrollTo({ left: p.x, top: p.y, behavior: 'instant' }); };

  function activateCreate() { waiting = 'create'; HUD.show('Create mark: a-z this page, A-Z global'); KeyHandler.report(); }
  function activate() { waiting = 'goto'; HUD.show('Go to mark: a-z, A-Z, or ` for the last position'); KeyHandler.report(); }

  async function onKey(key) {
    const what = waiting;
    waiting = null;
    HUD.hide();
    KeyHandler.report();
    if (key === '<esc>' || key.length !== 1) return;
    if (what === 'create') {
      const p = here();
      Port.send('marks:set', { name: key, x: p.x, y: p.y });
      return;
    }
    if (key === '`' || key === "'") {
      if (previous) jump(previous); else HUD.tip('No previous position');
      return;
    }
    if (/^[A-Z]$/.test(key)) { previous = here(); Port.send('marks:gotoGlobal', { name: key }); return; }
    if (/^[a-z]$/.test(key)) {
      const p = await Port.invoke('marks:getLocal', { name: key });
      if (p) jump(p); else HUD.tip(`Mark '${key}' is not set`);
    }
  }

  // A global mark that opened or switched to this tab
  Port.on('scrollTo', p => jump(p));

  return { activateCreate, activate, onKey, isWaiting: () => !!waiting };
})();
