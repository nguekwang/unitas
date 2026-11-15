// Link hints: label every clickable element, type the label to act on it (cf. Vimium C content/link_hints.ts).
const LinkHints = (() => {
  const TITLES = { open: 'Open link in current tab', newTab: 'Open link in new tab', copy: 'Copy link URL' };
  let state = null; // { mode, hints: [{ el, str, marker }], typed, box }

  // Vimium's scheme: the shortest labels that are never a prefix of another label
  function labels(count, chars) {
    const out = [''];
    let offset = 0;
    while (out.length - offset < count || out.length === 1) {
      const h = out[offset++];
      for (const c of chars) out.push(h + c);
    }
    return out.slice(offset, offset + count);
  }

  function activate(mode) {
    if (state) exit();
    const filter = mode === 'open' ? null : el => !!LocalLinks.linkOf(el) || mode === 'newTab';
    const links = LocalLinks.collect(filter);
    if (!links.length) { HUD.tip('No links to select'); return; }
    const chars = [...new Set(Settings.linkHintCharacters.toLowerCase())].join('') || 'sadjklewcmpgh';
    const strs = labels(links.length, chars);
    const box = DomUI.add(DomUI.el('div', 'hints'));
    const hints = links.map((l, i) => {
      const marker = DomUI.el('span', 'hint');
      marker.style.left = Math.max(0, l.rect.left) + 'px';
      marker.style.top = Math.max(0, l.rect.top) + 'px';
      box.appendChild(marker);
      return { el: l.el, str: strs[i], marker };
    });
    state = { mode, hints, typed: '', chars, box };
    render();
    HUD.show(TITLES[mode]);
    KeyHandler.report();
  }

  function render() {
    for (const h of state.hints) {
      const match = h.str.startsWith(state.typed);
      h.marker.style.display = match ? '' : 'none';
      if (!match) continue;
      h.marker.textContent = '';
      h.marker.append(DomUI.el('span', 'typed', h.str.slice(0, state.typed.length)), h.str.slice(state.typed.length));
    }
  }

  function exit() {
    if (!state) return;
    state.box.remove();
    state = null;
    HUD.hide();
    KeyHandler.report();
  }

  // Every key goes here while hints are shown
  function onKey(key) {
    if (key === '<esc>') { exit(); return; }
    if (key === '<backspace>') { state.typed = state.typed.slice(0, -1); render(); return; }
    const k = key.length === 1 ? key.toLowerCase() : null;
    if (!k || !state.chars.includes(k)) return;
    const typed = state.typed + k;
    const left = state.hints.filter(h => h.str.startsWith(typed));
    if (!left.length) return; // not a label: ignore the key
    state.typed = typed;
    const hit = left.find(h => h.str === typed);
    if (hit) {
      const { mode } = state;
      exit();
      LinkActions.run(mode, hit.el);
      return;
    }
    render();
  }

  return { activate, onKey, exit, isActive: () => !!state };
})();
