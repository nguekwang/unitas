const { contextBridge, ipcRenderer } = require('electron');

// Terminal tab (terminal.html): talks to its own shell in background/terminal.js
contextBridge.exposeInMainWorld('termApi', {
  start: (cols, rows) => ipcRenderer.send('term:start', { cols, rows }),
  input: data => ipcRenderer.send('term:input', String(data)),
  resize: (cols, rows) => ipcRenderer.send('term:resize', { cols, rows }),
  onData: cb => ipcRenderer.on('term:data', (_e, data) => cb(data))
});
