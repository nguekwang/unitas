const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  read: () => ipcRenderer.invoke('file:read'),
  write: text => ipcRenderer.invoke('file:write', text)
});
