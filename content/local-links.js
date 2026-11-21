// Finds the clickable elements on screen (cf. Vimium C content/local_links.ts), and the
// "next"/"previous" links used by ]] and [[.
const LocalLinks = (() => {
  const CLICKABLE = [
    'a[href]', 'area[href]', 'button', 'input:not([type=hidden])', 'select', 'textarea', 'summary', 'label[for]',
    '[onclick]', '[contenteditable]:not([contenteditable=false])', '[jsaction]', '[tabindex]:not([tabindex="-1"])',
    ...['button', 'link', 'checkbox', 'radio', 'tab', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'option',
      'switch', 'treeitem', 'combobox'].map(r => `[role=${r}]`)
  ].join(',');

  // filter(el) → keep? ; returns [{ el, rect }]
  function collect(filter) {
    const out = [];
    const seen = new Set();
    const visit = root => {
      for (const el of root.querySelectorAll(CLICKABLE)) {
        if (seen.has(el) || el.disabled || el.getAttribute('aria-disabled') === 'true') continue;
        seen.add(el);
        if (filter && !filter(el)) continue;
        const rect = DomUtils.visibleRect(el);
        if (rect) out.push({ el, rect });
      }
      for (const e of root.querySelectorAll('*')) if (e.shadowRoot) visit(e.shadowRoot);
    };
    visit(document);
    // An element inside another hinted element with the same top-left corner gets no hint of its own
    return out.filter(a => !out.some(b => b !== a && DomUtils.containsDeep(b.el, a.el) &&
      Math.abs(b.rect.left - a.rect.left) < 4 && Math.abs(b.rect.top - a.rect.top) < 4));
  }

  const linkOf = el => (el.closest ? el.closest('a[href], area[href]') : null);

  const NEXT = ['next', 'more', 'newer', '>', '›', '→', '»', '≫', '>>', '次へ', '次'];
  const PREV = ['prev', 'previous', 'back', 'older', '<', '‹', '←', '«', '≪', '<<', '前へ', '前'];
  const textOf = el => (el.innerText || el.value || el.getAttribute('aria-label') || el.title || '').trim().toLowerCase();

  // The link to follow for ]] (next = true) or [[, or null
  function pagination(next) {
    const rel = next ? 'next' : 'prev';
    const relEl = document.querySelector(`a[rel~=${rel}][href], link[rel~=${rel}][href]`);
    if (relEl) return relEl;
    const items = collect(el => el.matches('a[href], button, [role=link], [role=button], input[type=submit], input[type=button]'))
      .map(x => x.el).filter(el => { const t = textOf(el); return t && t.length <= 30; });
    for (const word of next ? NEXT : PREV) {
      const isSymbol = !/\w/.test(word);
      const match = items.find(el => {
        const t = textOf(el);
        return isSymbol ? t === word || t.startsWith(word + ' ') || t.endsWith(' ' + word)
          : new RegExp(`(^|\\W)${word}(\\W|$)`, 'i').test(t) || t.startsWith(word);
      });
      if (match) return match;
    }
    return null;
  }

  return { collect, linkOf, pagination };
})();
