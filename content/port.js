// Messaging with the main process (cf. Vimium C content/port.ts). Channels are "vc:<name>".
const Port = {
  send: (name, data) => ipcRenderer.send('vc:' + name, data),
  invoke: (name, data) => ipcRenderer.invoke('vc:' + name, data),
  on: (name, fn) => ipcRenderer.on('vc:' + name, (_e, data) => fn(data || {}))
};
