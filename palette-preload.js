const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('paletteApi', {
  onOpen: cb => ipcRenderer.on('palette:open', (_e, state) => cb(state)),
  classify: input => ipcRenderer.invoke('palette:classify', String(input)),
  run: action => ipcRenderer.send('palette:run', action),
  close: () => ipcRenderer.send('palette:close')
});
