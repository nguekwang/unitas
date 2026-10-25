const { contextBridge, ipcRenderer } = require('electron');

const SEND = new Set(['new-tab', 'activate', 'close', 'open-dialog', 'edit-current', 'go', 'nav']);

contextBridge.exposeInMainWorld('shellApi', {
  send: (channel, ...args) => { if (SEND.has(channel)) ipcRenderer.send(channel, ...args); },
  onTabs: cb => ipcRenderer.on('tabs', (_e, state) => cb(state)),
  onFocusAddress: cb => ipcRenderer.on('focus-address', () => cb())
});
