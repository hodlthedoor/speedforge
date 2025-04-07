interface ElectronAPI {
  isElectron: boolean;
  platform: string;
  invoke: (channel: string, data?: any) => Promise<any>;
  send: (channel: string, data?: any) => void;
  on: (channel: string, callback: (data: any) => void) => (() => void) | undefined;
  removeAllListeners: (channel: string) => void;
  app: {
    quit: () => Promise<void>;
    toggleClickThrough: (state: boolean) => Promise<{ success: boolean, state: boolean, error?: string }>;
  };
  widgets: {
    getAll: () => Promise<{ success: boolean; widgets: string[] }>;
    create: (config: { widgetId: string; widgetType: string; width: number; height: number; params?: any }) => Promise<{ success: boolean }>;
    close: (widgetId: string) => Promise<{ success: boolean }>;
    setOpacity: (widgetId: string, opacity: number) => Promise<void>;
    setVisible: (widgetId: string, visible: boolean) => Promise<void>;
    setSize: (widgetId: string, width: number, height: number) => Promise<void>;
    setAlwaysOnTop: (widgetId: string, alwaysOnTop: boolean) => Promise<void>;
    updateParams: (widgetId: string, params: any) => Promise<{ success: boolean }>;
  };
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {}; 