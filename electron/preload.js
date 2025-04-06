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
      'telemetry:getData',
      'telemetry:getConnectionStatus',
      'widget:registerForUpdates',
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
  }
}); 