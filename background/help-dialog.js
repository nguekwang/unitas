// Data for the help dialog ("?"), built from the current key mappings (cf. Vimium C background/help_dialog.ts).
const { GROUPS, COMMANDS } = require('./all-commands');
const keyMappings = require('./key-mappings');

exports.data = () => Object.entries(GROUPS).map(([group, title]) => ({
  title,
  rows: Object.entries(COMMANDS)
    .filter(([, d]) => d.group === group)
    .map(([name, d]) => ({ keys: keyMappings.keysFor(name), desc: d.desc, alias: d.alias[0] ? ':' + d.alias[0] : '' }))
    .filter(r => r.keys.length || r.alias)
}));
