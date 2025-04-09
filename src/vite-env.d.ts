/// <reference types="vite/client" />

interface Window {
  electronAPI?: {
    app: {
      toggleClickThrough: (state: boolean) => Promise<any>;
      quit: () => void;
    };
    on: (channel: string, callback: (data: any) => void) => (() => void) | undefined;
    send: (channel: string, data: any) => void;
  };
}
