const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  read: p => ipcRenderer.invoke('file:read', p),
  write: (p, text) => ipcRenderer.invoke('file:write', p, text)
});
