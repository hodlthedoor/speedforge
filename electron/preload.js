// Expose protected methods that allow the renderer process to use the ipcRenderer
contextBridge.exposeInMainWorld('electronAPI', {
  send: (channel, data) => {
    // Allowed channels that can be sent from renderer to main process
    const validSendChannels = [
      'telemetry:update',
      'telemetry:connectionChange',
      'widget:closeByEscape',
      'widget:registerForUpdates',
    ];
    if (validSendChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },
  invoke: (channel, ...args) => {
    // Allowed channels that can be invoked from renderer to main process
    const validInvokeChannels = [
      'app:quit',
      'app:toggleClickThrough',
      'app:toggleAutoNewWindows',
      'app:closeWindowForDisplay',
      'app:getDisplays',
      'app:getCurrentDisplayId',
      'app:getUserDataPath',
      'config:save',
      'config:load',
      'config:list',
      'debug:listConfigFiles',
      'telemetry:getData',
      'telemetry:getConnectionStatus',
      'widget:registerForUpdates',
      'widget:create',
      'widget:close',
      'widget:getAll',
      'widget:setPosition',
      'widget:setSize',
      'widget:setAlwaysOnTop',
      'widget:setOpacity',
      'widget:setVisible',
      'widget:updateParams',
    ];
    if (validInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Channel ${channel} is not allowed for invoke`));
  },
  on: (channel, func) => {
    // Allowed channels that can be received from main process to renderer
    const validReceiveChannels = [
      'main-process-message',
      'app:toggle-click-through',
      'app:initial-state',
      'display:id',
      'telemetry:update',
      'telemetry:connectionChange',
      'telemetry:connectionStatus',
      'widget:params',
      'widget:opacity',
      'widget:visibility',
      'widget:focus',
      'memory:warning',
    ];
    if (validReceiveChannels.includes(channel)) {
      const subscription = (event, ...args) => func(...args);
      ipcRenderer.on(channel, subscription);
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
  removeAllListeners: (channel) => {
    // Allowed channels that can be cleared from renderer
    const validClearChannels = [
      'telemetry:update',
      'telemetry:connectionChange',
      'telemetry:connectionStatus',
      'widget:params',
      'widget:opacity',
      'widget:visibility',
      'widget:focus',
      'memory:warning',
    ];
    if (validClearChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  // Application control API
  app: {
    quit: () => ipcRenderer.invoke('app:quit'),
    toggleClickThrough: (state) => ipcRenderer.invoke('app:toggleClickThrough', state),
    toggleAutoNewWindows: (state) => ipcRenderer.invoke('app:toggleAutoNewWindows', state),
    closeWindowForDisplay: (displayId) => ipcRenderer.invoke('app:closeWindowForDisplay', displayId),
    getDisplays: () => ipcRenderer.invoke('app:getDisplays'),
    getCurrentDisplayId: () => ipcRenderer.invoke('app:getCurrentDisplayId'),
    getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
  },
  // Configuration API
  config: {
    saveConfig: (type, name, data) => {
      return ipcRenderer.invoke('config:save', type, name, data);
    },
    loadConfig: (type, name) => {
      return ipcRenderer.invoke('config:load', type, name);
    },
    listConfigs: (type) => {
      return ipcRenderer.invoke('config:list', type);
    }
  },
  // Widget management API
  widgets: {
    // Create a new widget window
    create: (options) => {
      return ipcRenderer.invoke('widget:create', options);
    },
    // Close a widget window
    close: (widgetId) => {
      return ipcRenderer.invoke('widget:close', widgetId);
    },
    // Get all widget windows
    getAll: () => {
      return ipcRenderer.invoke('widget:getAll');
    },
    // Set widget position
    setPosition: (widgetId, x, y) => {
      return ipcRenderer.invoke('widget:setPosition', { widgetId, x, y });
    },
    // Set widget size
    setSize: (widgetId, width, height) => {
      return ipcRenderer.invoke('widget:setSize', { widgetId, width, height });
    },
    // Set widget always-on-top status
    setAlwaysOnTop: (widgetId, alwaysOnTop) => {
      return ipcRenderer.invoke('widget:setAlwaysOnTop', { widgetId, alwaysOnTop });
    },
    // Set widget opacity
    setOpacity: (widgetId, opacity) => {
      return ipcRenderer.invoke('widget:setOpacity', { widgetId, opacity });
    },
    // Set widget visibility
    setVisible: (widgetId, visible) => {
      return ipcRenderer.invoke('widget:setVisible', { widgetId, visible });
    },
    // Update widget parameters
    updateParams: (widgetId, params) => {
      return ipcRenderer.invoke('widget:updateParams', { widgetId, params });
    }
  },
  // Debug API
  debug: {
    // List all config files
    listConfigFiles: () => {
      return ipcRenderer.invoke('debug:listConfigFiles');
    }
  }
}); 