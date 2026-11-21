// Commands that run inside the page (cf. Vimium C content/commands.ts). Each gets (count, keyEvent?).
// The rest (tabs, URLs, vomnibar, ...) run in the main process: background/run-commands.js.
const Commands = (() => {
  const step = count => Settings.scrollStepSize * count;
  const half = count => Math.round(innerHeight / 2) * count;
  const repeat = ev => !!(ev && ev.repeat);

  function focusInput(count) {
    const inputs = LocalLinks.collect(el => DomUtils.isEditable(el)).map(x => x.el);
    if (!inputs.length) { HUD.tip('No text inputs on this page'); return; }
    const el = inputs[Math.min(count, inputs.length) - 1];
    el.focus();
    if (el.select && el.tagName === 'INPUT') el.select();
  }

  function follow(next) {
    const el = LocalLinks.pagination(next);
    if (!el) { HUD.tip(`No ${next ? 'next' : 'previous'} link found`); return; }
    // links are often below the fold, where a click can't land: just go to their URL
    if (el.href && /^https?:|^file:/i.test(el.href)) location.href = el.href;
    else { el.scrollIntoView({ block: 'center' }); LinkActions.click(el); }
  }

  return {
    scrollDown: (c, ev) => Scroller.by('y', step(c), repeat(ev)),
    scrollUp: (c, ev) => Scroller.by('y', -step(c), repeat(ev)),
    scrollLeft: (c, ev) => Scroller.by('x', -step(c), repeat(ev)),
    scrollRight: (c, ev) => Scroller.by('x', step(c), repeat(ev)),
    scrollPageDown: (c, ev) => Scroller.by('y', half(c), repeat(ev)),
    scrollPageUp: (c, ev) => Scroller.by('y', -half(c), repeat(ev)),
    scrollToTop: () => Scroller.to('y', 'start'),
    scrollToBottom: () => Scroller.to('y', 'end'),
    scrollToLeft: () => Scroller.to('x', 'start'),
    scrollToRight: () => Scroller.to('x', 'end'),
    enterInsertMode: () => InsertMode.enter(),
    enterVisualMode: () => VisualMode.enter(false),
    enterVisualLineMode: () => VisualMode.enter(true),
    focusInput,
    'LinkHints.activate': () => LinkHints.activate('open'),
    'LinkHints.activateOpenInNewTab': () => LinkHints.activate('newTab'),
    'LinkHints.activateCopyLinkUrl': () => LinkHints.activate('copy'),
    goPrevious: () => follow(false),
    goNext: () => follow(true),
    'Marks.activateCreate': () => Marks.activateCreate(),
    'Marks.activate': () => Marks.activate(),
    enterFindMode: () => FindMode.enter(),
    performFind: c => FindMode.next(false, c),
    performBackwardsFind: c => FindMode.next(true, c),
    showHelp: () => HelpDialog.toggle()
  };
})();
