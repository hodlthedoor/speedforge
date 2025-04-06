/// <reference types="electron" />
import { contextBridge, ipcRenderer } from 'electron';

// API exposed to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Basic info and communication functions
  isElectron: true,
  platform: process.platform,
  
  // Add event listener to receive messages from main process
  on: (channel: string, callback: (data: any) => void) => {
    const validChannels = ['main-process-message'];
    if (validChannels.includes(channel)) {
      // Deliberately strip event as it includes `sender` 
      const subscription = (_event: any, data: any) => callback(data);
      ipcRenderer.on(channel, subscription);
      
      return () => {
        ipcRenderer.removeListener(channel, subscription);
      };
    }
  },
  
  // Remove all listeners for a channel
  removeAllListeners: (channel: string) => {
    const validChannels = ['main-process-message'];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // Invoke a function in the main process
  invoke: async (channel: string, data?: any): Promise<any> => {
    const validChannels = ['app:quit', 'app:toggleClickThrough'];
    
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
    
    throw new Error(`Invoke not allowed for channel: ${channel}`);
  },

  // Application control functions
  app: {
    // Quit the application
    quit: async (): Promise<any> => {
      return await ipcRenderer.invoke('app:quit');
    },
    
    // Toggle click-through mode
    toggleClickThrough: async (state: boolean): Promise<any> => {
      return await ipcRenderer.invoke('app:toggleClickThrough', state);
    }
  }
});

// Log when preload script has completed
console.log('Preload script executed successfully');
