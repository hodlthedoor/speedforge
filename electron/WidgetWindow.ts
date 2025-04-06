import { BrowserWindow, BrowserWindowConstructorOptions } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

// In ES modules, we need to recreate __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

export class WidgetWindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  
  constructor(private mainUrl: string) {}

  createWidgetWindow(options: WidgetWindowOptions): BrowserWindow {
    const { widgetId, widgetType, width = 300, height = 200, x, y, alwaysOnTop = false, params = {} } = options;
    
    // Check if window already exists
    if (this.windows.has(widgetId)) {
      const existingWindow = this.windows.get(widgetId);
      existingWindow?.focus();
      return existingWindow as BrowserWindow;
    }
    
    // Create window with frame: false for frameless window
    const win = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,                   // No window frame
      transparent: true,              // Transparent background
      backgroundColor: '#1f2937',     // Match the dark background color
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,            // Allow loading of local resources
        scrollBounce: false            // Improves scrollbar behavior
      },
      alwaysOnTop,
      skipTaskbar: true,
      movable: true,                  // Allow window to be moved
      resizable: false,               // Not resizable as requested
      hasShadow: false,               // No shadow
      autoHideMenuBar: true,          // Hide the menu bar
      titleBarStyle: 'hidden',        // Hidden title bar for cleaner look
      titleBarOverlay: false,
      thickFrame: false,              // Thin frame
      vibrancy: null,
      visualEffectState: null,
      fullscreenable: false,
      show: false,                    // Don't show until ready-to-show
    });
    
    // Show window once ready
    win.once('ready-to-show', () => {
      // Hide the standard window controls on macOS (traffic lights)
      if (process.platform === 'darwin') {
        // Set the window to have no title bar
        win.setWindowButtonVisibility(false);
      }
      
      win.show();
    });
    
    // Inject CSS to hide scrollbars when window content is loaded
    win.webContents.on('did-finish-load', () => {
      win.webContents.insertCSS(`
        html, body {
          overflow: hidden !important;
        }
        ::-webkit-scrollbar {
          display: none !important;
        }
        * {
          -ms-overflow-style: none !important;
          scrollbar-width: none !important;
        }
      `);
    });
    
    // Add window to tracking
    this.windows.set(widgetId, win);
    
    // Build the URL with query parameters for the widget
    const queryParams = new URLSearchParams();
    queryParams.append('widgetId', widgetId);
    queryParams.append('widgetType', widgetType);
    
    // Add any additional parameters
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value));
      console.log(`Setting param for widget ${widgetId}: ${key}=${value}`);
    });
    
    // Load the widget URL - use a direct approach to ensure parameters are passed correctly
    const widgetUrl = `${this.mainUrl}?${queryParams.toString()}#/widget`;
    console.log('Loading widget URL:', widgetUrl);
    console.log('Widget parameters:', { widgetId, widgetType, params });
    win.loadURL(widgetUrl);
    
    // Handle window closed event
    win.on('closed', () => {
      this.windows.delete(widgetId);
    });
    
    return win;
  }
  
  closeWidgetWindow(widgetId: string): boolean {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      win.close();
      return true;
    }
    return false;
  }
  
  getWidgetWindow(widgetId: string): BrowserWindow | undefined {
    return this.windows.get(widgetId);
  }
  
  getAllWidgetWindows(): Map<string, BrowserWindow> {
    return this.windows;
  }
  
  setWidgetPosition(widgetId: string, x: number, y: number): boolean {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      win.setPosition(x, y);
      return true;
    }
    return false;
  }
  
  setWidgetSize(widgetId: string, width: number, height: number): boolean {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      win.setSize(width, height);
      return true;
    }
    return false;
  }
  
  setWidgetAlwaysOnTop(widgetId: string, alwaysOnTop: boolean): boolean {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      win.setAlwaysOnTop(alwaysOnTop);
      return true;
    }
    return false;
  }
  
  setWidgetOpacity(widgetId: string, opacity: number): boolean {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      // Set the entire window's opacity directly
      win.setOpacity(opacity);
      
      // Also notify the renderer process to maintain state consistency
      win.webContents.send('widget:opacity', opacity);
      return true;
    }
    return false;
  }
  
  setWidgetVisible(widgetId: string, visible: boolean): boolean {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      if (visible) {
        win.show();
      } else {
        win.hide();
      }
      return true;
    }
    return false;
  }
  
  // Update widget parameters by reloading the window with new URL parameters
  updateWidgetParams(widgetId: string, params: Record<string, any>): boolean {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      // Build URL with new parameters
      const currentUrl = new URL(win.webContents.getURL());
      const searchParams = new URLSearchParams(currentUrl.search);
      
      // Add/update parameters
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, String(value));
        console.log(`Setting param for widget ${widgetId}: ${key}=${value}`);
      });
      
      // Create new URL with updated parameters
      const newUrl = `${this.mainUrl}?${searchParams.toString()}#/widget`;
      console.log(`Reloading widget ${widgetId} with URL:`, newUrl);
      
      // Reload window with new URL
      win.loadURL(newUrl);
      
      return true;
    }
    return false;
  }
} 