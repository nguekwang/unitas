// Keyboard events → Vimium-style key names (cf. Vimium C lib/keyboard_utils.ts).
//   "j", "J", "?", "<space>", "<esc>", "<enter>", "<a-j>", "<c-j>", "<s-tab>"
// Function keys (F1-F12) are never bound, so they get no name and always go to the page.
const KeyboardUtils = (() => {
  const NAMED = {
    ' ': 'space', Escape: 'esc', Enter: 'enter', Tab: 'tab', Backspace: 'backspace', Delete: 'delete',
    ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down',
    PageUp: 'pageup', PageDown: 'pagedown', Home: 'home', End: 'end', Insert: 'insert'
  };
  const MODIFIER = /^(Shift|Control|Alt|AltGraph|Meta|OS|CapsLock|NumLock|ScrollLock|Fn|Hyper|Super)$/;

  // null for lone modifiers and for IME composition (Japanese input etc.)
  function keyOf(ev) {
    const k = ev.key;
    if (!k || ev.isComposing || k === 'Process' || k === 'Unidentified' || k === 'Dead' || MODIFIER.test(k)) return null;
    const mods = (ev.ctrlKey ? 'c-' : '') + (ev.altKey ? 'a-' : '') + (ev.metaKey ? 'm-' : '');
    if (k.length === 1 && k !== ' ') {
      // Shift is already part of the character ("J", "?")
      return mods ? `<${mods}${k.toLowerCase() === k ? k : k.toLowerCase()}>` : k;
    }
    const name = NAMED[k] || null;
    if (!name) return null;
    return `<${mods}${ev.shiftKey ? 's-' : ''}${name}>`;
  }

  // "gg" → ["g","g"], "<space>j" → ["<space>","j"], "<<" → ["<","<"]
  const tokenize = keys => String(keys).match(/<[a-z0-9]+(?:-[a-z0-9$]+)*>|./giu) || [];

  return { keyOf, tokenize };
})();
