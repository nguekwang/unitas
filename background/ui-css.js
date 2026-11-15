// CSS for the UI drawn inside pages (hints, HUD, find bar, help), sent to each content script
// (cf. Vimium C background/ui_css.ts). The styles live in ui.css.
const fs = require('fs');
const path = require('path');

let css = null;
exports.get = () => css || (css = fs.readFileSync(path.join(__dirname, '..', 'ui.css'), 'utf8'));
