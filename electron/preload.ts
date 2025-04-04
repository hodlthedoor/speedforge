/// <reference types="electron" />
const { contextBridge, ipcRenderer } = require('electron');

// Define the WidgetWindowOptions type without importing it
interface WidgetWindowOptions {
  widgetId: string;
  widgetType: string;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  alwaysOnTop?: boolean;
  params?: Record<string, any>;
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('electronAPI', {
  ping: () => ipcRenderer.invoke('ping'),
  // Invoke methods
  invoke: (channel: string, ...args: any[]) => {
    return ipcRenderer.invoke(channel, ...args);
  },
  // Send methods
  send: (channel: string, ...args: any[]) => {
    ipcRenderer.send(channel, ...args);
  },
  // Receive methods
  on: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.on(channel, (_event, ...args) => callback(...args));
  },
  // Remove listener
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  },
  // Widget specific methods
  widgets: {
    create: (options: WidgetWindowOptions) => {
      return ipcRenderer.invoke('widget:create', options);
    },
    close: (widgetId: string) => {
      return ipcRenderer.invoke('widget:close', widgetId);
    },
    getAll: () => {
      return ipcRenderer.invoke('widget:getAll');
    },
    setPosition: (widgetId: string, x: number, y: number) => {
      return ipcRenderer.invoke('widget:setPosition', { widgetId, x, y });
    },
    setSize: (widgetId: string, width: number, height: number) => {
      return ipcRenderer.invoke('widget:setSize', { widgetId, width, height });
    },
    setAlwaysOnTop: (widgetId: string, alwaysOnTop: boolean) => {
      return ipcRenderer.invoke('widget:setAlwaysOnTop', { widgetId, alwaysOnTop });
    },
    setOpacity: (widgetId: string, opacity: number) => {
      return ipcRenderer.invoke('widget:setOpacity', { widgetId, opacity });
    },
    setVisible: (widgetId: string, visible: boolean) => {
      return ipcRenderer.invoke('widget:setVisible', { widgetId, visible });
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
