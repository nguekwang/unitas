// Runs a command by name with a count (cf. Vimium C background/run_commands.ts).
// Content commands are forwarded to the tab's content script; background ones run here.
const { COMMANDS } = require('./all-commands');
const settings = require('./settings');
const browser = require('./browser');
const tabCommands = require('./tab-commands');
const openUrls = require('./open-urls');

const editorCmd = (t, name) => { if (t && t.kind === 'editor') browser.sendToTab(t, 'editor', name); };
const history = (t, delta) => {
  const nh = t.view.webContents.navigationHistory;
  if (nh.canGoToOffset(delta)) nh.goToOffset(delta);
  else if (delta < 0 && nh.canGoBack()) nh.goBack();
  else if (delta > 0 && nh.canGoForward()) nh.goForward();
};
const vomnibar = opts => () => require('./vomnibar').open(opts);

const BACKGROUND = {
  ...tabCommands,
  copyCurrentUrl: openUrls.copyCurrentUrl,
  openCopiedUrlInCurrentTab: openUrls.openCopiedUrlInCurrentTab,
  openCopiedUrlInNewTab: openUrls.openCopiedUrlInNewTab,
  goUp: openUrls.goUp,
  goToRoot: openUrls.goToRoot,
  reload: () => browser.navigate('reload'),
  goBack: (count, t) => history(t, -count),
  goForward: (count, t) => history(t, count),
  'Vomnibar.activate': vomnibar({ mode: 'omni' }),
  'Vomnibar.activateInNewTab': vomnibar({ mode: 'omni', newTab: true }),
  'Vomnibar.activateTabs': vomnibar({ mode: 'tabs' }),
  'Vomnibar.activateEditUrl': (_c, t) => require('./vomnibar').open({ mode: 'omni', prefill: browser.addrOf(t) }),
  'Vomnibar.activateEditUrlInNewTab': (_c, t) => require('./vomnibar').open({ mode: 'omni', newTab: true, prefill: browser.addrOf(t) }),
  'Vomnibar.activateCommandLine': vomnibar({ mode: 'command', prefill: ':' }),
  toggleDevTools: (_c, t) => browser.toggleDevTools(t),
  openFile: () => browser.openDialog(),
  editFile: () => browser.editCurrent(),
  openTerminal: (_c, t) => browser.openTerminal(t),
  saveFile: (_c, t) => editorCmd(t, 'save'),
  togglePreview: (_c, t) => editorCmd(t, 'preview'),
  openSettings: (_c, t) => browser.createTab(settings.file(), { edit: true, index: t ? require('./store').tabs.indexOf(t) + 1 : undefined })
};

exports.run = (name, count = 1, tab = browser.activeTab()) => {
  const def = Object.hasOwn(COMMANDS, name) && COMMANDS[name];
  if (!def || !tab) return;
  count = Math.max(1, Math.min(999, Number(count) | 0 || 1));
  if (def.where === 'content') {
    if (tab.kind === 'pdf') require('./run-keys').runInPdf(name, count, tab);
    else browser.sendToTab(tab, 'run', { name, count });
    return;
  }
  if (Object.hasOwn(BACKGROUND, name)) BACKGROUND[name](count, tab);
};
