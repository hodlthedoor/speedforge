/// <reference types="electron" />
const { contextBridge, ipcRenderer } = require('electron');
// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
    ping: () => ipcRenderer.invoke('ping'),
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
    },
    // Widget specific methods
    widgets: {
        create: (options) => {
            return ipcRenderer.invoke('widget:create', options);
        },
        close: (widgetId) => {
            return ipcRenderer.invoke('widget:close', widgetId);
        },
        getAll: () => {
            return ipcRenderer.invoke('widget:getAll');
        },
        setPosition: (widgetId, x, y) => {
            return ipcRenderer.invoke('widget:setPosition', { widgetId, x, y });
        },
        setSize: (widgetId, width, height) => {
            return ipcRenderer.invoke('widget:setSize', { widgetId, width, height });
        },
        setAlwaysOnTop: (widgetId, alwaysOnTop) => {
            return ipcRenderer.invoke('widget:setAlwaysOnTop', { widgetId, alwaysOnTop });
        },
        setOpacity: (widgetId, opacity) => {
            return ipcRenderer.invoke('widget:setOpacity', { widgetId, opacity });
        },
        setVisible: (widgetId, visible) => {
            return ipcRenderer.invoke('widget:setVisible', { widgetId, visible });
        },
        updateParams: (widgetId, params) => {
            return ipcRenderer.invoke('widget:updateParams', { widgetId, params });
        }
    },
    // Add app-level methods
    app: {
        quit: () => {
            return ipcRenderer.invoke('app:quit');
        },
        toggleClickThrough: (state) => {
            return ipcRenderer.invoke('app:toggleClickThrough', state);
        },
        toggleAutoNewWindows: (state) => {
            return ipcRenderer.invoke('app:toggleAutoNewWindows', state);
        }
    }
});
// Add drag functionality
contextBridge.exposeInMainWorld('electronDrag', {
    // Function to enable dragging - we don't need this anymore since we use CSS
    enableDrag: () => {
        console.log('CSS-based dragging should be active');
    }
});
