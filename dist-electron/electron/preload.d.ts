declare const contextBridge: any, ipcRenderer: any;
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
