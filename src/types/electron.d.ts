declare global {
  interface Window {
    electronAPI: {
      ping: () => Promise<string>;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      send: (channel: string, ...args: any[]) => void;
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeAllListeners: (channel: string) => void;
      widgets: {
        create: (options: any) => Promise<{ success: boolean, id: string }>;
        close: (widgetId: string) => Promise<{ success: boolean }>;
        getAll: () => Promise<{ success: boolean, widgets: string[] }>;
        setPosition: (widgetId: string, x: number, y: number) => Promise<{ success: boolean }>;
        setSize: (widgetId: string, width: number, height: number) => Promise<{ success: boolean }>;
        setAlwaysOnTop: (widgetId: string, alwaysOnTop: boolean) => Promise<{ success: boolean }>;
        setOpacity: (widgetId: string, opacity: number) => Promise<{ success: boolean }>;
        setVisible: (widgetId: string, visible: boolean) => Promise<{ success: boolean }>;
      };
    };
    electronDrag: {
      enableDrag: () => void;
    };
  }
}

export {}; 