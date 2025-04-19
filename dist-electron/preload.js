var n = require("electron");
n.contextBridge.exposeInMainWorld("electronAPI", {
  // Basic info and communication functions
  isElectron: !0,
  platform: process.platform,
  // Send message to main process
  send: (e, r) => {
    [
      "telemetry:update",
      "telemetry:connectionChange",
      "widget:closeByEscape",
      "widget:registerForUpdates"
    ].includes(e) ? n.ipcRenderer.send(e, r) : console.warn(`Channel ${e} is not allowed for sending`);
  },
  // Add event listener to receive messages from main process
  on: (e, r) => {
    if ([
      "main-process-message",
      "app:toggle-click-through",
      "app:initial-state",
      "display:id"
    ].includes(e)) {
      const i = (t, a) => r(a);
      return n.ipcRenderer.on(e, i), () => {
        n.ipcRenderer.removeListener(e, i);
      };
    }
  },
  // Remove all listeners for a channel
  removeAllListeners: (e) => {
    [
      "main-process-message",
      "app:toggle-click-through",
      "app:initial-state",
      "display:id"
    ].includes(e) && n.ipcRenderer.removeAllListeners(e);
  },
  // Invoke a function in the main process
  invoke: async (e, r) => {
    if ([
      "app:quit",
      "app:toggleClickThrough",
      "app:getCurrentDisplayId",
      "app:getUserDataPath",
      "config:save",
      "config:load",
      "config:list",
      "config:delete",
      "debug:listConfigFiles"
    ].includes(e))
      return await n.ipcRenderer.invoke(e, r);
    throw new Error(`Invoke not allowed for channel: ${e}`);
  },
  // Application control functions
  app: {
    // Quit the application
    quit: async () => await n.ipcRenderer.invoke("app:quit"),
    // Toggle click-through mode
    toggleClickThrough: async (e) => {
      console.log(`Preload: Requesting toggleClickThrough with state=${e}`);
      try {
        const r = await n.ipcRenderer.invoke("app:toggleClickThrough", e);
        return console.log("Preload: Toggle response received:", r), r;
      } catch (r) {
        throw console.error("Preload: Error in toggleClickThrough:", r), r;
      }
    },
    // Get current display ID
    getCurrentDisplayId: async () => await n.ipcRenderer.invoke("app:getCurrentDisplayId"),
    // Get user data path
    getUserDataPath: async () => await n.ipcRenderer.invoke("app:getUserDataPath")
  },
  // Configuration API
  config: {
    // Save a configuration
    saveConfig: async (e, r, o) => {
      try {
        return await n.ipcRenderer.invoke("config:save", e, r, o);
      } catch (i) {
        return console.error("Error saving config:", i), !1;
      }
    },
    // Load a configuration
    loadConfig: async (e, r) => {
      try {
        return await n.ipcRenderer.invoke("config:load", e, r);
      } catch (o) {
        return console.error("Error loading config:", o), null;
      }
    },
    // List available configurations
    listConfigs: async (e) => {
      try {
        return await n.ipcRenderer.invoke("config:list", e);
      } catch (r) {
        return console.error("Error listing configs:", r), [];
      }
    },
    // Delete a configuration
    deleteConfig: async (e, r) => {
      try {
        return await n.ipcRenderer.invoke("config:delete", e, r);
      } catch (o) {
        return console.error("Error deleting config:", o), !1;
      }
    }
  },
  // Debug API
  debug: {
    // List all config files
    listConfigFiles: async () => await n.ipcRenderer.invoke("debug:listConfigFiles")
  }
});
n.contextBridge.exposeInMainWorld("electronSpeech", {
  // Get available voices
  getVoices: async () => {
    try {
      return await n.ipcRenderer.invoke("speech:getVoices");
    } catch (e) {
      return console.error("Error getting voices:", e), [];
    }
  },
  // Speak text with specified voice and parameters
  speak: async (e, r, o, i) => {
    try {
      return console.log(`Preload: Speaking "${e}" with voice=${r}, rate=${o}, volume=${i}`), await n.ipcRenderer.invoke("speech:speak", e, r, o, i);
    } catch (t) {
      throw console.error("Error speaking:", t), t;
    }
  },
  // Stop speech
  stop: async (e) => {
    try {
      return await n.ipcRenderer.invoke("speech:stop", e);
    } catch (r) {
      throw console.error("Error stopping speech:", r), r;
    }
  },
  // Add listener for speech completion
  onSpeechComplete: (e) => {
    const r = (o, i) => e(i);
    return n.ipcRenderer.on("speech:complete", r), () => {
      n.ipcRenderer.removeListener("speech:complete", r);
    };
  },
  // Add listener for speech errors
  onSpeechError: (e) => {
    const r = (o, i) => e(i);
    return n.ipcRenderer.on("speech:error", r), () => {
      n.ipcRenderer.removeListener("speech:error", r);
    };
  }
});
console.log("Preload script executed successfully");
