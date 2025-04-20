/// <reference types="electron" />
import { contextBridge, ipcRenderer } from 'electron';

// API exposed to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // Basic info and communication functions
  isElectron: true,
  platform: process.platform,
  
  // Send message to main process
  send: (channel: string, data?: any) => {
    const validChannels = [
      'telemetry:update',
      'telemetry:connectionChange',
      'widget:closeByEscape',
      'widget:registerForUpdates'
    ];
    
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    } else {
      console.warn(`Channel ${channel} is not allowed for sending`);
    }
  },
  
  // Add event listener to receive messages from main process
  on: (channel: string, callback: (data: any) => void) => {
    const validChannels = [
      'main-process-message', 
      'app:toggle-click-through',
      'app:initial-state',
      'app:before-quit',
      'display:id'
    ];
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
    const validChannels = [
      'main-process-message', 
      'app:toggle-click-through', 
      'app:initial-state',
      'app:before-quit',
      'display:id'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    }
  },
  
  // Invoke a function in the main process
  invoke: async (channel: string, data?: any): Promise<any> => {
    const validChannels = [
      'app:quit', 
      'app:toggleClickThrough',
      'app:getCurrentDisplayId',
      'app:getUserDataPath',
      'app:openDevTools',
      'config:save',
      'config:load',
      'config:list',
      'config:delete',
      'debug:listConfigFiles'
    ];
    
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
      console.log(`Preload: Requesting toggleClickThrough with state=${state}`);
      try {
        const result = await ipcRenderer.invoke('app:toggleClickThrough', state);
        console.log('Preload: Toggle response received:', result);
        return result;
      } catch (error) {
        console.error('Preload: Error in toggleClickThrough:', error);
        throw error;
      }
    },

    // Get current display ID
    getCurrentDisplayId: async (): Promise<any> => {
      return await ipcRenderer.invoke('app:getCurrentDisplayId');
    },

    // Get user data path
    getUserDataPath: async (): Promise<string> => {
      return await ipcRenderer.invoke('app:getUserDataPath');
    },
    
    // Open DevTools
    openDevTools: async (): Promise<boolean> => {
      return await ipcRenderer.invoke('app:openDevTools');
    },

    // Application control functions
    appControl: {
      quit: () => ipcRenderer.invoke('app:quit'),
      toggleClickThrough: () => ipcRenderer.invoke('app:toggleClickThrough'),
      toggleAutoNewWindows: () => ipcRenderer.invoke('app:toggleAutoNewWindows'),
      closeWindowForDisplay: (displayId: number) => ipcRenderer.invoke('app:closeWindowForDisplay', displayId),
      getDisplays: () => ipcRenderer.invoke('app:getDisplays'),
      getCurrentDisplayId: () => ipcRenderer.invoke('app:getCurrentDisplayId'),
      getUserDataPath: () => ipcRenderer.invoke('app:getUserDataPath'),
      openDevTools: () => ipcRenderer.invoke('app:openDevTools')
    }
  },

  // Configuration API
  config: {
    // Save a configuration
    saveConfig: async (type: string, name: string, data: any): Promise<boolean> => {
      try {
        return await ipcRenderer.invoke('config:save', type, name, data);
      } catch (error) {
        console.error('Error saving config:', error);
        return false;
      }
    },
    
    // Load a configuration
    loadConfig: async (type: string, name: string): Promise<any> => {
      try {
        return await ipcRenderer.invoke('config:load', type, name);
      } catch (error) {
        console.error('Error loading config:', error);
        return null;
      }
    },
    
    // List available configurations
    listConfigs: async (type: string): Promise<string[]> => {
      try {
        return await ipcRenderer.invoke('config:list', type);
      } catch (error) {
        console.error('Error listing configs:', error);
        return [];
      }
    },
    
    // Delete a configuration
    deleteConfig: async (type: string, name: string): Promise<boolean> => {
      try {
        return await ipcRenderer.invoke('config:delete', type, name);
      } catch (error) {
        console.error('Error deleting config:', error);
        return false;
      }
    }
  },

  // Debug API
  debug: {
    // List all config files
    listConfigFiles: async (): Promise<any> => {
      return await ipcRenderer.invoke('debug:listConfigFiles');
    }
  }
});

// Expose speech synthesis API to renderer process
contextBridge.exposeInMainWorld('electronSpeech', {
  // Get available voices
  getVoices: async (): Promise<string[]> => {
    try {
      return await ipcRenderer.invoke('speech:getVoices');
    } catch (error) {
      console.error('Error getting voices:', error);
      return [];
    }
  },
  
  // Speak text with specified voice and parameters
  speak: async (text: string, voice?: string, rate?: number, volume?: number): Promise<any> => {
    try {
      console.log(`Preload: Speaking "${text}" with voice=${voice}, rate=${rate}, volume=${volume}`);
      return await ipcRenderer.invoke('speech:speak', text, voice, rate, volume);
    } catch (error) {
      console.error('Error speaking:', error);
      throw error;
    }
  },
  
  // Stop speech
  stop: async (id?: number): Promise<any> => {
    try {
      return await ipcRenderer.invoke('speech:stop', id);
    } catch (error) {
      console.error('Error stopping speech:', error);
      throw error;
    }
  },
  
  // Add listener for speech completion
  onSpeechComplete: (callback: (data: {id: number}) => void) => {
    const wrappedCallback = (_event: any, data: {id: number}) => callback(data);
    ipcRenderer.on('speech:complete', wrappedCallback);
    return () => {
      ipcRenderer.removeListener('speech:complete', wrappedCallback);
    };
  },
  
  // Add listener for speech errors
  onSpeechError: (callback: (data: {id: number, error: string}) => void) => {
    const wrappedCallback = (_event: any, data: {id: number, error: string}) => callback(data);
    ipcRenderer.on('speech:error', wrappedCallback);
    return () => {
      ipcRenderer.removeListener('speech:error', wrappedCallback);
    };
  }
});

// Log when preload script has completed
console.log('Preload script executed successfully');
