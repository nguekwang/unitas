// Builds the content script and registers it as a session preload, so it runs at document start in
// every page of the session — popups included — in an isolated world, like an extension's content
// script. Pages are sandboxed, and a sandboxed preload can only require('electron'), so the
// content/ files are concatenated, in dependency order, into one file at startup (Vimium C does the
// same with its build step), written to userData/preload/content.js.
const { app, session } = require('electron');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORDER = [
  'content/utils.js',
  'content/keyboard-utils.js',
  'content/dom-utils.js',
  'content/port.js',
  'content/dom-ui.js',
  'content/hud.js',
  'content/insert.js',
  'content/scroller.js',
  'content/local-links.js',
  'content/link-actions.js',
  'content/link-hints.js',
  'content/mode-find.js',
  'content/visual.js',
  'content/marks.js',
  'content/help-dialog.js',
  'content/commands.js',
  'content/key-handler.js',
  'content/frontend.js'
];

exports.build = () => {
  const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
  const body = ORDER.map(f => `// ---- ${f} ----\n${read(f)}`).join('\n');
  // Not in: iframes (the top page handles keys), the tab strip and vomnibar (Unitas's own UI),
  // DevTools, and the PDF viewer (its keys are handled in background/run-keys.js).
  const skip = `if (window.top !== window || document.contentType === 'application/pdf' || location.protocol === 'devtools:' ||
    (location.protocol === 'file:' && /\\/(shell|vomnibar)\\.html$/.test(location.pathname))) return;`;
  // `module`/`exports` are shadowed: these files are browser code
  const content = `(function (module, exports) {\n'use strict';\n${skip}\nconst { ipcRenderer } = require('electron');\n${body}\n})();\n`;

  const dir = path.join(app.getPath('userData'), 'preload');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'content.js');
  fs.writeFileSync(file, content);
  session.defaultSession.registerPreloadScript({ type: 'frame', id: 'unitas-content', filePath: file });
  return file;
};
