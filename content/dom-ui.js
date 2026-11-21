// One closed shadow root that holds all UI drawn in the page — hints, HUD, find bar, help — so page
// styles can't reach it and page scripts can't see inside (cf. Vimium C content/dom_ui.ts).
const DomUI = (() => {
  let host = null;
  let root = null;
  let style = null;
  let css = '';

  function ensure() {
    if (host && host.isConnected) return root;
    if (!host) {
      host = document.createElement('unitas-ui');
      host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;' +
        'z-index:2147483647!important;pointer-events:none!important;display:block!important;';
      root = host.attachShadow({ mode: 'closed' });
      style = document.createElement('style');
      style.textContent = css;
      root.appendChild(style);
    }
    (document.documentElement || document).appendChild(host);
    return root;
  }

  return {
    add(el) { ensure().appendChild(el); return el; },
    setCss(text) { css = text; if (style) style.textContent = text; },
    // true for our own host element (focus inside our UI is retargeted to it)
    isOurs: node => !!node && node === host,
    el(tag, className, text) {
      const e = document.createElement(tag);
      if (className) e.className = className;
      if (text != null) e.textContent = text;
      return e;
    }
  };
})();
