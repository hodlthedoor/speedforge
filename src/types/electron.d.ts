export interface ElectronConfigAPI {
  config?: {
    saveConfig: (type: string, name: string, data: any) => Promise<boolean>;
    loadConfig: (type: string, name: string) => Promise<any>;
    listConfigs: (type: string) => Promise<string[]>;
  };
  app: {
    toggleClickThrough: (state: boolean) => Promise<any>;
    quit: () => void;
    getUserDataPath?: () => Promise<string>;
    getCurrentDisplayId?: () => Promise<any>;
    getDisplays?: () => Promise<any>;
    closeWindowForDisplay?: (displayId: number) => Promise<any>;
  };
  debug?: {
    listConfigFiles: () => Promise<any>;
  };
  on: (channel: string, callback: (data: any) => void) => (() => void);
  send: (channel: string, data: any) => void;
  widgets?: {
    create: (options: any) => Promise<any>;
    close: (widgetId: string) => Promise<any>;
    getAll: () => Promise<any>;
    setPosition: (widgetId: string, x: number, y: number) => Promise<any>;
    setSize: (widgetId: string, width: number, height: number) => Promise<any>;
    setAlwaysOnTop: (widgetId: string, alwaysOnTop: boolean) => Promise<any>;
    setOpacity: (widgetId: string, opacity: number) => Promise<any>;
    setVisible: (widgetId: string, visible: boolean) => Promise<any>;
    updateParams: (widgetId: string, params: any) => Promise<any>;
  };
}

declare global {
  interface Window {
    electronAPI?: ElectronConfigAPI;
  }
}

export {}; 