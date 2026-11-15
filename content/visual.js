// Visual mode: select text with the keyboard, y to copy (cf. Vimium C content/visual.ts).
const VisualMode = (() => {
  let mode = null;   // null | "VISUAL" | "VISUAL LINE"
  let pendingG = false;

  const MOVES = {
    h: ['backward', 'character'], l: ['forward', 'character'],
    j: ['forward', 'line'], k: ['backward', 'line'],
    w: ['forward', 'word'], e: ['forward', 'word'], b: ['backward', 'word'],
    '0': ['backward', 'lineboundary'], '$': ['forward', 'lineboundary'],
    ')': ['forward', 'sentence'], '(': ['backward', 'sentence'],
    '}': ['forward', 'paragraph'], '{': ['backward', 'paragraph'],
    G: ['forward', 'documentboundary']
  };

  function enter(lineMode) {
    const sel = getSelection();
    if (!sel.rangeCount || sel.isCollapsed) {
      const node = DomUtils.firstVisibleText();
      if (!node) { HUD.tip('No text to select'); return; }
      const start = node.data.search(/\S/);
      sel.setBaseAndExtent(node, start, node, start + 1);
    }
    mode = lineMode ? 'VISUAL LINE' : 'VISUAL';
    if (lineMode) toLines();
    HUD.show(lineMode ? 'Visual line mode · y to copy' : 'Visual mode · y to copy');
    KeyHandler.report();
  }

  function exit() {
    if (!mode) return;
    mode = null;
    pendingG = false;
    const sel = getSelection();
    if (sel.rangeCount) sel.collapseToEnd();
    HUD.hide();
    KeyHandler.report();
  }

  // Line mode: grow the selection to whole lines at both ends
  function toLines() {
    const sel = getSelection();
    const forward = isForward(sel);
    const { anchorNode, anchorOffset } = sel;
    sel.collapse(anchorNode, anchorOffset);
    sel.modify('move', forward ? 'backward' : 'forward', 'lineboundary');
    const a = [sel.anchorNode, sel.anchorOffset];
    sel.setBaseAndExtent(a[0], a[1], focusSaved.node, focusSaved.offset);
    sel.modify('extend', forward ? 'forward' : 'backward', 'lineboundary');
  }
  let focusSaved = { node: null, offset: 0 };
  function isForward(sel) {
    focusSaved = { node: sel.focusNode, offset: sel.focusOffset };
    if (sel.anchorNode === sel.focusNode) return sel.anchorOffset <= sel.focusOffset;
    return !!(sel.anchorNode.compareDocumentPosition(sel.focusNode) & Node.DOCUMENT_POSITION_FOLLOWING);
  }

  function reveal() {
    const n = getSelection().focusNode;
    const el = n && (n.nodeType === 1 ? n : n.parentElement);
    if (el) el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  // Every key goes here in visual mode; returns true when consumed
  function onKey(key) {
    const sel = getSelection();
    if (key === '<esc>') { exit(); return true; }
    if (key === 'y') {
      const text = sel.toString();
      Port.send('copy', { text });
      HUD.tip(`Copied ${text.length} characters`);
      mode = 'VISUAL'; exit();
      return true;
    }
    if (key === 'o') { sel.setBaseAndExtent(sel.focusNode, sel.focusOffset, sel.anchorNode, sel.anchorOffset); reveal(); return true; }
    if (key === 'v' || key === 'V') {
      const want = key === 'V' ? 'VISUAL LINE' : 'VISUAL';
      if (mode === want) exit(); else { mode = want; if (want === 'VISUAL LINE') toLines(); KeyHandler.report(); }
      return true;
    }
    if (key === 'g') {
      if (pendingG) { pendingG = false; sel.modify('extend', 'backward', 'documentboundary'); reveal(); }
      else pendingG = true;
      return true;
    }
    pendingG = false;
    if (Object.hasOwn(MOVES, key)) {
      const [dir, unit] = MOVES[key];
      sel.modify('extend', dir, unit);
      if (mode === 'VISUAL LINE') toLines();
      reveal();
      return true;
    }
    return key.length === 1; // swallow other printable keys; let <tab> etc. through
  }

  return { enter, exit, onKey, mode: () => mode };
})();
