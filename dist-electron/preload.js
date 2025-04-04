import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("electronAPI", {
  ping: () => ipcRenderer.invoke("ping"),
  // Invoke methods
  invoke: (channel, ...args) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  // Send methods
  send: (channel, ...args) => {
    ipcRenderer.send(channel, ...args);
  },
  // Receive methods
  on: (channel, callback) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  // Remove listener
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
//# sourceMappingURL=preload.js.map
