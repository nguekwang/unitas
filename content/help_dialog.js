// The "?" help dialog, listing every command and its keys (cf. Vimium C front/help_dialog.html).
const HelpDialog = (() => {
  let box = null;

  async function show() {
    const groups = await Port.invoke('help');
    if (!groups) return;
    hide();
    box = DomUI.el('div', 'help');
    const head = DomUI.el('div', 'help-head');
    head.append(DomUI.el('b', null, 'Unitas'), DomUI.el('span', null, 'Esc or ? to close · change keys with :settings'));
    box.appendChild(head);
    const cols = DomUI.el('div', 'help-cols');
    for (const g of groups) {
      if (!g.rows.length) continue;
      const sec = DomUI.el('section');
      sec.appendChild(DomUI.el('h3', null, g.title));
      for (const r of g.rows) {
        const row = DomUI.el('div', 'help-row');
        const keys = DomUI.el('span', 'help-keys');
        for (const k of r.keys) keys.appendChild(DomUI.el('kbd', null, k));
        if (r.alias) keys.appendChild(DomUI.el('kbd', 'alias', r.alias));
        row.append(keys, DomUI.el('span', 'help-desc', r.desc));
        sec.appendChild(row);
      }
      cols.appendChild(sec);
    }
    box.appendChild(cols);
    DomUI.add(box);
  }

  function hide() { if (box) { box.remove(); box = null; } }

  return { toggle: () => (box ? hide() : show()), hide, isOpen: () => !!box };
})();
