// Decides what each key press does (cf. Vimium C content/key_handler.ts).
// Listens on window in the capture phase before any page script, so a mapped key never reaches the
// page. Modes, in priority order: find bar, link hints, mark letter, help, visual, insert, normal.
// In normal mode only mapped keys are taken (with a count prefix: "5j"); everything else, and every
// Ctrl/Alt combination, goes to the page as usual.
const KeyHandler = (() => {
  let trie = {};      // key → { command?, next? }
  let node = null;    // position inside a multi-key mapping ("g" of "gg")
  let pending = [];   // keys typed so far in that mapping
  let count = '';
  let swallowKeyUp = new Set(); // codes whose keydown we took: hide their keyup too
  let lastReport = '';

  function setMappings(list) {
    trie = {};
    for (const { keys, command } of list) {
      if (!keys.length) continue;
      let level = trie;
      keys.forEach((k, i) => {
        const n = level[k] || (level[k] = {});
        if (i === keys.length - 1) n.command = command;
        else level = n.next || (n.next = {});
      });
    }
    reset();
  }

  function reset() { node = null; pending = []; count = ''; report(); }

  function modeName() {
    if (FindMode.isActive()) return 'FIND';
    if (LinkHints.isActive()) return 'HINTS';
    if (Marks.isWaiting()) return 'MARK';
    if (VisualMode.mode()) return VisualMode.mode();
    if (InsertMode.active()) return 'INSERT';
    return 'NORMAL';
  }

  // Tell the main process (mode badge in the tab strip)
  function report() {
    const mode = modeName();
    const p = count + pending.join('');
    const now = mode + '|' + p;
    if (now === lastReport) return;
    lastReport = now;
    Port.send('mode', { mode, pending: p });
  }

  function consume(ev) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    swallowKeyUp.add(ev.code);
  }

  function run(command, n, ev) {
    if (Object.hasOwn(Commands, command)) Commands[command](n, ev);
    else Port.send('cmd', { name: command, count: n });
  }

  function onKeydown(ev) {
    if (!ev.isTrusted) return;
    const key = KeyboardUtils.keyOf(ev);
    if (!key) return;

    if (FindMode.isActive()) { if (FindMode.onKey(key)) consume(ev); return; }
    if (LinkHints.isActive()) { consume(ev); LinkHints.onKey(key); return; }
    if (Marks.isWaiting()) { consume(ev); Marks.onKey(key); return; }
    if (HelpDialog.isOpen() && (key === '<esc>' || key === '?')) { consume(ev); HelpDialog.hide(); return; }
    if (VisualMode.mode()) { if (VisualMode.onKey(key)) consume(ev); return; }
    if (InsertMode.active()) {
      // In a terminal Esc belongs to the shell (vim, less, fzf ...): Shift+Esc leaves insert mode there
      const leave = Utils.appPage() === 'terminal' ? '<s-esc>' : '<esc>';
      if (key === leave) { consume(ev); InsertMode.exit(); }
      return;
    }

    // normal mode
    if (key === '<esc>') {
      if (pending.length || count) { consume(ev); reset(); return; }
      HelpDialog.hide();
      FindMode.clearHighlights();
      return; // the page also gets Esc
    }
    if (!pending.length && /^[0-9]$/.test(key) && (count || key !== '0')) {
      consume(ev);
      count += key;
      report();
      return;
    }
    let n = (node || trie)[key];
    if (!n && node) { node = null; pending = []; n = trie[key]; } // broken sequence: start over with this key
    if (!n) { if (count) reset(); return; }                     // unmapped: the page gets it
    consume(ev);
    if (n.next && !n.command) { node = n.next; pending.push(key); report(); return; }
    const times = Math.max(1, parseInt(count || '1', 10));
    node = null; pending = []; count = '';
    report();
    run(n.command, times, ev);
  }

  addEventListener('keydown', onKeydown, true);
  addEventListener('keyup', ev => {
    if (swallowKeyUp.delete(ev.code)) { ev.preventDefault(); ev.stopImmediatePropagation(); }
  }, true);
  addEventListener('blur', () => { if (pending.length || count) reset(); });

  return { setMappings, report, run, reset };
})();
