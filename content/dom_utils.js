// DOM helpers (cf. Vimium C lib/dom_utils.ts and lib/rect.ts).
const DomUtils = (() => {
  const NON_TEXT_INPUT = /^(button|checkbox|radio|submit|reset|image|file|range|color|hidden)$/i;

  // document.activeElement, looking through open shadow roots
  function deepActive() {
    let e = document.activeElement;
    while (e && e.shadowRoot && e.shadowRoot.activeElement) e = e.shadowRoot.activeElement;
    return e;
  }

  // Elements where typed keys belong to the page (→ insert mode)
  function isEditable(e) {
    if (!e || e.nodeType !== 1) return false;
    if (e.isContentEditable) return true;
    if (e.tagName === 'TEXTAREA') return !e.readOnly && !e.disabled;
    if (e.tagName === 'INPUT') return !NON_TEXT_INPUT.test(e.type) && !e.readOnly && !e.disabled;
    return false;
  }

  // a contains b, also across shadow boundaries
  function containsDeep(a, b) {
    for (let n = b; n; n = n.parentNode || n.host) if (n === a) return true;
    return false;
  }

  function deepElementFromPoint(x, y) {
    let el = document.elementFromPoint(x, y);
    while (el && el.shadowRoot) {
      const inner = el.shadowRoot.elementFromPoint(x, y);
      if (!inner || inner === el) break;
      el = inner;
    }
    return el;
  }

  // The part of the element that is inside the viewport and not covered by something else, or null
  function visibleRect(el) {
    const vw = innerWidth, vh = innerHeight;
    for (const r of el.getClientRects()) {
      const left = Math.max(0, r.left), top = Math.max(0, r.top);
      const right = Math.min(vw, r.right), bottom = Math.min(vh, r.bottom);
      if (right - left < 3 || bottom - top < 3) continue;
      const rect = { left, top, right, bottom, width: right - left, height: bottom - top };
      for (const [x, y] of [[(left + right) / 2, (top + bottom) / 2], [left + 2, top + 2], [right - 2, bottom - 2]]) {
        const hit = deepElementFromPoint(x, y);
        if (hit && (containsDeep(el, hit) || containsDeep(hit, el))) return rect;
      }
    }
    return null;
  }

  // First text node whose box starts inside the viewport (where visual mode begins)
  function firstVisibleText() {
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_TEXT, {
      acceptNode: n => (/\S/.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT)
    });
    const range = document.createRange();
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      range.selectNodeContents(n);
      const r = range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && r.top >= 0 && r.top < innerHeight && r.left < innerWidth && r.right > 0) return n;
    }
    return null;
  }

  return { deepActive, isEditable, containsDeep, deepElementFromPoint, visibleRect, firstVisibleText };
})();
