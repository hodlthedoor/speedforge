var import_electron = require("electron");
import_electron.contextBridge.exposeInMainWorld("electronAPI", {
  // Basic info and communication functions
  isElectron: true,
  platform: process.platform,
  // Send message to main process
  send: (channel, data) => {
    const validChannels = [
      "telemetry:update",
      "telemetry:connectionChange",
      "widget:closeByEscape",
      "widget:registerForUpdates"
    ];
    if (validChannels.includes(channel)) {
      import_electron.ipcRenderer.send(channel, data);
    } else {
      console.warn(`Channel ${channel} is not allowed for sending`);
    }
  },
  // Add event listener to receive messages from main process
  on: (channel, callback) => {
    const validChannels = ["main-process-message", "app:toggle-click-through"];
    if (validChannels.includes(channel)) {
      const subscription = (_event, data) => callback(data);
      import_electron.ipcRenderer.on(channel, subscription);
      return () => {
        import_electron.ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
  // Remove all listeners for a channel
  removeAllListeners: (channel) => {
    const validChannels = ["main-process-message", "app:toggle-click-through"];
    if (validChannels.includes(channel)) {
      import_electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  // Invoke a function in the main process
  invoke: async (channel, data) => {
    const validChannels = ["app:quit", "app:toggleClickThrough"];
    if (validChannels.includes(channel)) {
      return await import_electron.ipcRenderer.invoke(channel, data);
    }
    throw new Error(`Invoke not allowed for channel: ${channel}`);
  },
  // Application control functions
  app: {
    // Quit the application
    quit: async () => {
      return await import_electron.ipcRenderer.invoke("app:quit");
    },
    // Toggle click-through mode
    toggleClickThrough: async (state) => {
      console.log(`Preload: Requesting toggleClickThrough with state=${state}`);
      try {
        const result = await import_electron.ipcRenderer.invoke("app:toggleClickThrough", state);
        console.log("Preload: Toggle response received:", result);
        return result;
      } catch (error) {
        console.error("Preload: Error in toggleClickThrough:", error);
        throw error;
      }
    }
  }
});
console.log("Preload script executed successfully");
//# sourceMappingURL=preload.js.map
