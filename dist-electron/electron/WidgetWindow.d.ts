import { BrowserWindow } from 'electron';
export interface WidgetWindowOptions {
    widgetId: string;
    widgetType: string;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    alwaysOnTop?: boolean;
    params?: Record<string, any>;
}
export declare class WidgetWindowManager {
    private mainUrl;
    private windows;
    constructor(mainUrl: string);
    createWidgetWindow(options: WidgetWindowOptions): BrowserWindow;
    closeWidgetWindow(widgetId: string): boolean;
    getWidgetWindow(widgetId: string): BrowserWindow | undefined;
    getAllWidgetWindows(): Map<string, BrowserWindow>;
    setWidgetPosition(widgetId: string, x: number, y: number): boolean;
    setWidgetSize(widgetId: string, width: number, height: number): boolean;
    setWidgetAlwaysOnTop(widgetId: string, alwaysOnTop: boolean): boolean;
    setWidgetOpacity(widgetId: string, opacity: number): boolean;
    setWidgetVisible(widgetId: string, visible: boolean): boolean;
    updateWidgetParams(widgetId: string, params: Record<string, any>): boolean;
}
