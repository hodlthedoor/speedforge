declare global {
  interface Window {
    electronAPI: {
      isElectron: boolean;
      platform: string;
      invoke: (channel: string, data?: any) => Promise<any>;
      on: (channel: string, callback: (data: any) => void) => (() => void) | undefined;
      removeAllListeners: (channel: string) => void;
      app: {
        quit: () => Promise<{ success: boolean }>;
        toggleClickThrough: (state: boolean) => Promise<{ success: boolean, state: boolean, error?: string }>;
      };
    };
  }
}

export {}; 