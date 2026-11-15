// System clipboard access for yank / paste commands (cf. Vimium C background/clipboard.ts).
const { clipboard } = require('electron');

exports.copy = text => clipboard.writeText(String(text));
exports.paste = () => clipboard.readText().trim();
