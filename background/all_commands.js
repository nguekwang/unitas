// Every command a key can be mapped to (cf. Vimium C background/all_commands.ts).
// where: "content" runs inside the page (content/commands.js), "background" runs here (run_commands.js).
// alias: names accepted on the ":" command line (":w", ":q", ...).

exports.GROUPS = {
  page: 'Navigating the page',
  vomnibar: 'Using the vomnibar',
  find: 'Using find',
  history: 'Navigating history',
  tabs: 'Manipulating tabs',
  files: 'Files and settings',
  misc: 'Miscellaneous'
};

const c = (desc, group, where, alias = []) => ({ desc, group, where, alias });

exports.COMMANDS = {
  scrollDown: c('Scroll down', 'page', 'content'),
  scrollUp: c('Scroll up', 'page', 'content'),
  scrollLeft: c('Scroll left', 'page', 'content'),
  scrollRight: c('Scroll right', 'page', 'content'),
  scrollToTop: c('Scroll to the top of the page', 'page', 'content'),
  scrollToBottom: c('Scroll to the bottom of the page', 'page', 'content'),
  scrollToLeft: c('Scroll all the way to the left', 'page', 'content'),
  scrollToRight: c('Scroll all the way to the right', 'page', 'content'),
  scrollPageDown: c('Scroll a half page down', 'page', 'content'),
  scrollPageUp: c('Scroll a half page up', 'page', 'content'),
  reload: c('Reload the page', 'page', 'background', ['r', 'reload']),
  copyCurrentUrl: c("Copy the current URL to the clipboard", 'page', 'background', ['yank']),
  openCopiedUrlInCurrentTab: c("Open the clipboard's URL in the current tab", 'page', 'background'),
  openCopiedUrlInNewTab: c("Open the clipboard's URL in a new tab", 'page', 'background'),
  goUp: c('Go up the URL hierarchy', 'page', 'background'),
  goToRoot: c('Go to the root of the URL hierarchy', 'page', 'background'),
  enterInsertMode: c('Enter insert mode', 'page', 'content'),
  enterVisualMode: c('Enter visual mode', 'page', 'content'),
  enterVisualLineMode: c('Enter visual line mode', 'page', 'content'),
  focusInput: c('Focus the first text input on the page', 'page', 'content'),
  'LinkHints.activate': c('Open a link in the current tab', 'page', 'content'),
  'LinkHints.activateOpenInNewTab': c('Open a link in a new tab', 'page', 'content'),
  'LinkHints.activateCopyLinkUrl': c('Copy a link URL to the clipboard', 'page', 'content'),
  goPrevious: c('Follow the link labeled previous or <', 'page', 'content'),
  goNext: c('Follow the link labeled next or >', 'page', 'content'),
  'Marks.activateCreate': c('Create a new mark (a-z: this page, A-Z: global)', 'page', 'content'),
  'Marks.activate': c('Go to a mark', 'page', 'content'),

  'Vomnibar.activate': c('Open URL, history entry, or search', 'vomnibar', 'background'),
  'Vomnibar.activateInNewTab': c('Open URL, history entry, or search, in a new tab', 'vomnibar', 'background'),
  'Vomnibar.activateTabs': c('Search through your open tabs', 'vomnibar', 'background'),
  'Vomnibar.activateEditUrl': c('Edit the current URL', 'vomnibar', 'background'),
  'Vomnibar.activateEditUrlInNewTab': c('Edit the current URL and open in a new tab', 'vomnibar', 'background'),
  'Vomnibar.activateCommandLine': c('Command line (:w, :q, :e, …)', 'vomnibar', 'background'),

  enterFindMode: c('Enter find mode', 'find', 'content'),
  performFind: c('Cycle forward to the next find match', 'find', 'content'),
  performBackwardsFind: c('Cycle backward to the previous find match', 'find', 'content'),

  goBack: c('Go back in history', 'history', 'background', ['back']),
  goForward: c('Go forward in history', 'history', 'background', ['forward', 'fwd']),

  nextTab: c('Go one tab right', 'tabs', 'background', ['tabnext', 'tn']),
  previousTab: c('Go one tab left', 'tabs', 'background', ['tabprevious', 'tp']),
  firstTab: c('Go to the first tab', 'tabs', 'background', ['tabfirst']),
  lastTab: c('Go to the last tab', 'tabs', 'background', ['tablast']),
  visitPreviousTab: c('Go to previously-visited tab', 'tabs', 'background'),
  createTab: c('Create new tab', 'tabs', 'background', ['tabnew', 'new']),
  duplicateTab: c('Duplicate current tab', 'tabs', 'background', ['dup']),
  removeTab: c('Close current tab', 'tabs', 'background', ['q', 'close', 'quit']),
  restoreTab: c('Restore closed tab', 'tabs', 'background', ['undo']),
  moveTabLeft: c('Move tab to the left', 'tabs', 'background'),
  moveTabRight: c('Move tab to the right', 'tabs', 'background'),

  openFile: c('Open a file', 'files', 'background', ['e', 'open']),
  editFile: c('Edit the file being viewed', 'files', 'background', ['edit']),
  saveFile: c('Save the file (editor)', 'files', 'background', ['w', 'save']),
  togglePreview: c('Toggle Markdown preview (editor)', 'files', 'background', ['p', 'preview']),
  openTerminal: c("Open a terminal (in the current file's folder)", 'files', 'background', ['term', 'terminal']),
  openSettings: c('Edit settings: key mappings, search engines, hint characters', 'files', 'background', ['settings', 'set']),

  toggleDevTools: c('Open / close the developer tools for this tab', 'misc', 'background', ['devtools', 'dev']),
  showHelp: c('Show help', 'misc', 'content', ['help', 'h'])
};
