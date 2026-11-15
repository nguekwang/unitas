const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set(['new-tab', 'activate', 'close']);

contextBridge.exposeInMainWorld('shellApi', {
  send: (channel, ...args) => { if (SEND.has(channel)) ipcRenderer.send(channel, ...args); },
  onTabs: cb => ipcRenderer.on('tabs', (_e, state) => cb(state))
});
