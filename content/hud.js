// Small message box at the bottom right of the page (cf. Vimium C content/hud.ts).
const HUD = (() => {
  let box = null;
  let timer = null;

  function show(text, ms = 0) {
    if (!box) box = DomUI.add(DomUI.el('div', 'hud'));
    // drawn with ::before (ui.css): find-in-page doesn't search generated content, so "/foo  1 / 3"
    // never counts as a match for "foo", even while the HUD is fading out
    box.dataset.text = text;
    box.classList.add('on');
    clearTimeout(timer);
    if (ms) timer = setTimeout(hide, ms);
  }
  function hide() {
    clearTimeout(timer);
    if (box) box.classList.remove('on');
  }

  return { show, hide, tip: (text, ms = 1600) => show(text, ms) };
})();
