var o = require("electron");
o.contextBridge.exposeInMainWorld("electronAPI", {
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
    ].includes(e) ? o.ipcRenderer.send(e, r) : console.warn(`Channel ${e} is not allowed for sending`);
  },
  // Add event listener to receive messages from main process
  on: (e, r) => {
    if ([
      "main-process-message",
      "app:toggle-click-through",
      "app:initial-state",
      "app:before-quit",
      "display:id"
    ].includes(e)) {
      const i = (t, a) => r(a);
      return o.ipcRenderer.on(e, i), () => {
        o.ipcRenderer.removeListener(e, i);
      };
    }
  },
  // Remove all listeners for a channel
  removeAllListeners: (e) => {
    [
      "main-process-message",
      "app:toggle-click-through",
      "app:initial-state",
      "app:before-quit",
      "display:id"
    ].includes(e) && o.ipcRenderer.removeAllListeners(e);
  },
  // Invoke a function in the main process
  invoke: async (e, r) => {
    if ([
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
    ].includes(e))
      return await o.ipcRenderer.invoke(e, r);
    throw new Error(`Invoke not allowed for channel: ${e}`);
  },
  // Application control functions
  app: {
    // Quit the application
    quit: async () => await o.ipcRenderer.invoke("app:quit"),
    // Toggle click-through mode
    toggleClickThrough: async (e) => {
      console.log(`Preload: Requesting toggleClickThrough with state=${e}`);
      try {
        const r = await o.ipcRenderer.invoke("app:toggleClickThrough", e);
        return console.log("Preload: Toggle response received:", r), r;
      } catch (r) {
        throw console.error("Preload: Error in toggleClickThrough:", r), r;
      }
    },
    // Get current display ID
    getCurrentDisplayId: async () => await o.ipcRenderer.invoke("app:getCurrentDisplayId"),
    // Get user data path
    getUserDataPath: async () => await o.ipcRenderer.invoke("app:getUserDataPath"),
    // Open DevTools
    openDevTools: async () => await o.ipcRenderer.invoke("app:openDevTools"),
    // Application control functions
    appControl: {
      quit: () => o.ipcRenderer.invoke("app:quit"),
      toggleClickThrough: () => o.ipcRenderer.invoke("app:toggleClickThrough"),
      toggleAutoNewWindows: () => o.ipcRenderer.invoke("app:toggleAutoNewWindows"),
      closeWindowForDisplay: (e) => o.ipcRenderer.invoke("app:closeWindowForDisplay", e),
      getDisplays: () => o.ipcRenderer.invoke("app:getDisplays"),
      getCurrentDisplayId: () => o.ipcRenderer.invoke("app:getCurrentDisplayId"),
      getUserDataPath: () => o.ipcRenderer.invoke("app:getUserDataPath"),
      openDevTools: () => o.ipcRenderer.invoke("app:openDevTools")
    }
  },
  // Configuration API
  config: {
    // Save a configuration
    saveConfig: async (e, r, n) => {
      try {
        return await o.ipcRenderer.invoke("config:save", e, r, n);
      } catch (i) {
        return console.error("Error saving config:", i), !1;
      }
    },
    // Load a configuration
    loadConfig: async (e, r) => {
      try {
        return await o.ipcRenderer.invoke("config:load", e, r);
      } catch (n) {
        return console.error("Error loading config:", n), null;
      }
    },
    // List available configurations
    listConfigs: async (e) => {
      try {
        return await o.ipcRenderer.invoke("config:list", e);
      } catch (r) {
        return console.error("Error listing configs:", r), [];
      }
    },
    // Delete a configuration
    deleteConfig: async (e, r) => {
      try {
        return await o.ipcRenderer.invoke("config:delete", e, r);
      } catch (n) {
        return console.error("Error deleting config:", n), !1;
      }
    }
  },
  // Debug API
  debug: {
    // List all config files
    listConfigFiles: async () => await o.ipcRenderer.invoke("debug:listConfigFiles")
  }
});
o.contextBridge.exposeInMainWorld("electronSpeech", {
  // Get available voices
  getVoices: async () => {
    try {
      return await o.ipcRenderer.invoke("speech:getVoices");
    } catch (e) {
      return console.error("Error getting voices:", e), [];
    }
  },
  // Speak text with specified voice and parameters
  speak: async (e, r, n, i) => {
    try {
      return console.log(`Preload: Speaking "${e}" with voice=${r}, rate=${n}, volume=${i}`), await o.ipcRenderer.invoke("speech:speak", e, r, n, i);
    } catch (t) {
      throw console.error("Error speaking:", t), t;
    }
  },
  // Stop speech
  stop: async (e) => {
    try {
      return await o.ipcRenderer.invoke("speech:stop", e);
    } catch (r) {
      throw console.error("Error stopping speech:", r), r;
    }
  },
  // Add listener for speech completion
  onSpeechComplete: (e) => {
    const r = (n, i) => e(i);
    return o.ipcRenderer.on("speech:complete", r), () => {
      o.ipcRenderer.removeListener("speech:complete", r);
    };
  },
  // Add listener for speech errors
  onSpeechError: (e) => {
    const r = (n, i) => e(i);
    return o.ipcRenderer.on("speech:error", r), () => {
      o.ipcRenderer.removeListener("speech:error", r);
    };
  }
});
console.log("Preload script executed successfully");
