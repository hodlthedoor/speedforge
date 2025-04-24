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
    const validChannels = [
      "main-process-message",
      "app:toggle-click-through",
      "app:initial-state",
      "app:before-quit",
      "display:id"
    ];
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
    const validChannels = [
      "main-process-message",
      "app:toggle-click-through",
      "app:initial-state",
      "app:before-quit",
      "display:id"
    ];
    if (validChannels.includes(channel)) {
      import_electron.ipcRenderer.removeAllListeners(channel);
    }
  },
  // Invoke a function in the main process
  invoke: async (channel, data) => {
    const validChannels = [
      "app:quit",
      "app:toggleClickThrough",
      "app:getCurrentDisplayId",
      "app:getUserDataPath",
      "app:openDevTools",
      "config:save",
      "config:load",
      "config:list",
      "config:delete",
      "debug:listConfigFiles"
    ];
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
    },
    // Get current display ID
    getCurrentDisplayId: async () => {
      return await import_electron.ipcRenderer.invoke("app:getCurrentDisplayId");
    },
    // Get user data path
    getUserDataPath: async () => {
      return await import_electron.ipcRenderer.invoke("app:getUserDataPath");
    },
    // Open DevTools
    openDevTools: async () => {
      return await import_electron.ipcRenderer.invoke("app:openDevTools");
    },
    // Application control functions
    appControl: {
      quit: () => import_electron.ipcRenderer.invoke("app:quit"),
      toggleClickThrough: () => import_electron.ipcRenderer.invoke("app:toggleClickThrough"),
      toggleAutoNewWindows: () => import_electron.ipcRenderer.invoke("app:toggleAutoNewWindows"),
      closeWindowForDisplay: (displayId) => import_electron.ipcRenderer.invoke("app:closeWindowForDisplay", displayId),
      getDisplays: () => import_electron.ipcRenderer.invoke("app:getDisplays"),
      getCurrentDisplayId: () => import_electron.ipcRenderer.invoke("app:getCurrentDisplayId"),
      getUserDataPath: () => import_electron.ipcRenderer.invoke("app:getUserDataPath"),
      openDevTools: () => import_electron.ipcRenderer.invoke("app:openDevTools")
    }
  },
  // Configuration API
  config: {
    // Save a configuration
    saveConfig: async (type, name, data) => {
      try {
        return await import_electron.ipcRenderer.invoke("config:save", type, name, data);
      } catch (error) {
        console.error("Error saving config:", error);
        return false;
      }
    },
    // Load a configuration
    loadConfig: async (type, name) => {
      try {
        return await import_electron.ipcRenderer.invoke("config:load", type, name);
      } catch (error) {
        console.error("Error loading config:", error);
        return null;
      }
    },
    // List available configurations
    listConfigs: async (type) => {
      try {
        return await import_electron.ipcRenderer.invoke("config:list", type);
      } catch (error) {
        console.error("Error listing configs:", error);
        return [];
      }
    },
    // Delete a configuration
    deleteConfig: async (type, name) => {
      try {
        return await import_electron.ipcRenderer.invoke("config:delete", type, name);
      } catch (error) {
        console.error("Error deleting config:", error);
        return false;
      }
    }
  },
  // Debug API
  debug: {
    // List all config files
    listConfigFiles: async () => {
      return await import_electron.ipcRenderer.invoke("debug:listConfigFiles");
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
