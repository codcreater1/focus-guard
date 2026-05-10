const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('focusGuard', {
  startFocus: (config) => ipcRenderer.invoke('start-focus', config),
  stopFocus: () => ipcRenderer.invoke('stop-focus'),
  getStatus: () => ipcRenderer.invoke('get-status'),
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),
  onAppKilled: (cb) => ipcRenderer.on('app-killed', (_, data) => cb(data)),
  onExitBlocked: (cb) => ipcRenderer.on('exit-blocked', (_, msg) => cb(msg)),
  removeAllListeners: (ch) => ipcRenderer.removeAllListeners(ch),
});
