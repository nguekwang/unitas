// Scrolling (cf. Vimium C content/scroller.ts). Scrolls the element the user last clicked in (or its
// nearest scrollable ancestor), else the page, else the biggest visible scrollable element — so j/k
// also work in app-like pages whose body never scrolls. In the editor tab it scrolls Monaco.
const Scroller = (() => {
  let activated = null;
  let animating = null; // { el, axis, target, until }: keep adding to a smooth scroll in progress

  addEventListener('mousedown', e => { activated = e.composedPath()[0]; }, true);

  const pageEl = () => document.scrollingElement || document.documentElement;
  const parentOf = el => el.parentElement || (el.parentNode && el.parentNode.host) || null;
  const overflows = (el, axis) => (axis === 'y' ? el.scrollHeight > el.clientHeight + 1 : el.scrollWidth > el.clientWidth + 1);

  function scrollable(el, axis) {
    if (!el || el.nodeType !== 1 || !overflows(el, axis)) return false;
    if (el === pageEl()) return true;
    const s = getComputedStyle(el);
    const ov = axis === 'y' ? s.overflowY : s.overflowX;
    return ov === 'auto' || ov === 'scroll' || ov === 'overlay';
  }

  function find(axis) {
    for (let e = activated; e; e = parentOf(e)) {
      if (e === document.body || e === document.documentElement) break;
      if (e.isConnected && scrollable(e, axis)) return e;
    }
    if (scrollable(pageEl(), axis)) return pageEl();
    let best = null, bestArea = 0, n = 0;
    const walker = document.createTreeWalker(document.body || document.documentElement, NodeFilter.SHOW_ELEMENT);
    for (let e = walker.nextNode(); e && n < 20000; e = walker.nextNode(), n++) {
      if (e.clientHeight < 40 || !overflows(e, axis) || !scrollable(e, axis)) continue;
      const r = e.getBoundingClientRect();
      const w = Math.min(r.right, innerWidth) - Math.max(r.left, 0);
      const h = Math.min(r.bottom, innerHeight) - Math.max(r.top, 0);
      if (w > 0 && h > 0 && w * h > bestArea) { best = e; bestArea = w * h; }
    }
    if (best) activated = best;
    return best || pageEl();
  }

  const prop = axis => (axis === 'y' ? 'top' : 'left');
  const pos = (el, axis) => (axis === 'y' ? el.scrollTop : el.scrollLeft);

  // amount in px (positive: down / right). repeat: the key is held down → no smoothing
  function by(axis, amount, repeat = false) {
    if (Utils.isEditorPage()) { Utils.toPage('unitas:editor-scroll', { axis, by: amount }); return; }
    const el = find(axis);
    const smooth = Settings.smoothScroll && !repeat;
    const now = performance.now();
    const base = animating && animating.el === el && animating.axis === axis && now < animating.until ? animating.target : pos(el, axis);
    const target = base + amount;
    animating = smooth ? { el, axis, target, until: now + 400 } : null;
    el.scrollTo({ [prop(axis)]: target, behavior: smooth ? 'smooth' : 'instant' });
  }

  // where: "start" | "end"
  function to(axis, where) {
    if (Utils.isEditorPage()) { Utils.toPage('unitas:editor-scroll', { axis, to: where }); return; }
    const el = find(axis);
    animating = null;
    const end = axis === 'y' ? el.scrollHeight : el.scrollWidth;
    el.scrollTo({ [prop(axis)]: where === 'start' ? 0 : end, behavior: Settings.smoothScroll ? 'smooth' : 'instant' });
  }

  return { by, to };
})();
