// Shared main-process state (cf. Vimium C background/store.ts).
module.exports = {
  win: null,            // the BrowserWindow
  shellWC: null,        // its webContents: the tab strip (shell.html)
  tabs: [],             // { id, view, kind, file, url, title, openerId, mode, pending }
  activeId: null,
  nextId: 1,
  previousTabId: null,  // for visitPreviousTab (^)
  closedTabs: [],       // for restoreTab (X): { addr, kind, index }
  vomnibar: null,       // overlay WebContentsView (vomnibar.html)
  vomnibarOpen: false,
  findQuery: ''         // last find-mode query, shared by all tabs (n / N)
};
