// Insert mode (cf. Vimium C content/insert.ts): on whenever a text field has focus, or after "i".
// Esc leaves it and blurs the field, so keys go back to Unitas.
const InsertMode = (() => {
  let explicit = false;  // entered with "i" while no field has focus
  let userActed = false; // for grabBackFocus: has the user clicked or typed yet?

  const focused = () => {
    const e = DomUtils.deepActive();
    return DomUI.isOurs(e) ? null : e;
  };
  const active = () => explicit || DomUtils.isEditable(focused());

  function enter() {
    if (Utils.appPage()) { Utils.toPage('unitas:app-focus'); return; } // focusing Monaco / xterm → insert
    explicit = true;
    HUD.show('Insert mode · Esc to leave');
    KeyHandler.report();
  }

  function exit() {
    explicit = false;
    HUD.hide();
    const e = focused();
    if (DomUtils.isEditable(e)) e.blur();
    KeyHandler.report();
  }

  addEventListener('mousedown', e => { if (e.isTrusted) userActed = true; }, true);
  addEventListener('keydown', e => { if (e.isTrusted) userActed = true; }, true);
  addEventListener('focusin', e => {
    // Pages that focus a field on load (search boxes) would otherwise start in insert mode
    if (Settings.grabBackFocus && !userActed && DomUtils.isEditable(DomUtils.deepActive())) {
      const target = DomUtils.deepActive();
      setTimeout(() => target.blur(), 0);
    }
    KeyHandler.report();
  }, true);
  addEventListener('focusout', () => setTimeout(() => KeyHandler.report(), 0), true);

  return { active, enter, exit, isExplicit: () => explicit };
})();
