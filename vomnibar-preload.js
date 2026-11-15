const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vomnibarApi', {
  onOpen: cb => ipcRenderer.on('vomnibar:open', (_e, opts) => cb(opts)),
  query: (q, mode) => ipcRenderer.invoke('vomnibar:query', { q: String(q), mode: String(mode) }),
  run: (run, newTab) => ipcRenderer.send('vomnibar:run', { run, newTab: !!newTab }),
  close: () => ipcRenderer.send('vomnibar:close')
});
