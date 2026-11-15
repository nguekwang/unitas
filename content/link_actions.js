// What happens to the element a hint picked (cf. Vimium C content/link_actions.ts).
const LinkActions = (() => {
  // A real click, sent by the main process as trusted input at the element's center
  function click(el) {
    if (DomUtils.isEditable(el)) { el.focus(); return; } // → insert mode
    const r = DomUtils.visibleRect(el) || el.getBoundingClientRect();
    Port.send('click', { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }

  // mode: "open" | "newTab" | "copy"
  function run(mode, el) {
    const link = LocalLinks.linkOf(el);
    if (mode === 'copy') {
      if (!link) { HUD.tip('Not a link'); return; }
      Port.send('copy', { text: link.href });
      HUD.tip('Copied: ' + link.href);
      return;
    }
    if (mode === 'newTab' && link && /^https?:/i.test(link.href)) {
      Port.send('openUrl', { url: link.href, newTab: true });
      return;
    }
    click(el);
  }

  return { run, click };
})();
