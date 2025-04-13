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
import_electron.contextBridge.exposeInMainWorld("electronSpeech", {
  // Get available voices
  getVoices: async () => {
    try {
      return await import_electron.ipcRenderer.invoke("speech:getVoices");
    } catch (error) {
      console.error("Error getting voices:", error);
      return [];
    }
  },
  // Speak text with specified voice and parameters
  speak: async (text, voice, rate, volume) => {
    try {
      console.log(`Preload: Speaking "${text}" with voice=${voice}, rate=${rate}, volume=${volume}`);
      return await import_electron.ipcRenderer.invoke("speech:speak", text, voice, rate, volume);
    } catch (error) {
      console.error("Error speaking:", error);
      throw error;
    }
  },
  // Stop speech
  stop: async (id) => {
    try {
      return await import_electron.ipcRenderer.invoke("speech:stop", id);
    } catch (error) {
      console.error("Error stopping speech:", error);
      throw error;
    }
  },
  // Add listener for speech completion
  onSpeechComplete: (callback) => {
    const wrappedCallback = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("speech:complete", wrappedCallback);
    return () => {
      import_electron.ipcRenderer.removeListener("speech:complete", wrappedCallback);
    };
  },
  // Add listener for speech errors
  onSpeechError: (callback) => {
    const wrappedCallback = (_event, data) => callback(data);
    import_electron.ipcRenderer.on("speech:error", wrappedCallback);
    return () => {
      import_electron.ipcRenderer.removeListener("speech:error", wrappedCallback);
    };
  }
});
console.log("Preload script executed successfully");
//# sourceMappingURL=preload.js.map
