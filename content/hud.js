// Small message box at the bottom right of the page (cf. Vimium C content/hud.ts).
const HUD = (() => {
  let box = null;
  let timer = null;

  function show(text, ms = 0) {
    if (!box) box = DomUI.add(DomUI.el('div', 'hud'));
    box.textContent = text;
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
