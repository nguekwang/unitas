// Shared state for the content script (cf. Vimium C lib/utils.ts).
// Settings are filled in from the main process by content/frontend.js.
const Settings = {
  linkHintCharacters: 'sadjklewcmpgh',
  scrollStepSize: 100,
  smoothScroll: true,
  grabBackFocus: false
};

const Utils = {
  clamp: (n, lo, hi) => Math.max(lo, Math.min(hi, n)),
  // Unitas's own tab pages mark their <html> (data-unitas-app="editor" | "terminal") so page commands
  // can talk to Monaco / xterm.js instead of the DOM. null for every other page.
  appPage: () => (document.documentElement && document.documentElement.dataset.unitasApp) || null,
  // Events cross from this isolated world to the page's main world; pass data as JSON text
  // because objects created here aren't readable there.
  toPage: (type, detail) => dispatchEvent(new CustomEvent(type, { detail: detail === undefined ? null : JSON.stringify(detail) }))
};
