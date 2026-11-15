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
  // The editor tab marks its <html> so page commands can talk to Monaco instead of the DOM
  isEditorPage: () => !!(document.documentElement && document.documentElement.dataset.unitasEditor === '1'),
  // Events cross from this isolated world to the page's main world; pass data as JSON text
  // because objects created here aren't readable there.
  toPage: (type, detail) => dispatchEvent(new CustomEvent(type, { detail: detail === undefined ? null : JSON.stringify(detail) }))
};
