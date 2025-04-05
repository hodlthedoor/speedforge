import { BrowserWindow } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
// In ES modules, we need to recreate __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class WidgetWindowManager {
    constructor(mainUrl) {
        this.mainUrl = mainUrl;
        this.windows = new Map();
    }
    createWidgetWindow(options) {
        const { widgetId, widgetType, width = 300, height = 200, x, y, alwaysOnTop = false, params = {} } = options;
        // Check if window already exists
        if (this.windows.has(widgetId)) {
            const existingWindow = this.windows.get(widgetId);
            existingWindow?.focus();
            return existingWindow;
        }
        // Create window with frame: false for frameless window
        const win = new BrowserWindow({
            width,
            height,
            x,
            y,
            frame: false, // No window frame
            transparent: true, // Transparent background
            backgroundColor: '#00000000', // Fully transparent
            webPreferences: {
                preload: path.join(__dirname, 'preload.js'),
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false // Allow loading of local resources
            },
            alwaysOnTop,
            skipTaskbar: true,
            movable: true, // Allow window to be moved
            resizable: false, // Not resizable as requested
            hasShadow: false, // No shadow
            autoHideMenuBar: true, // Hide the menu bar
            titleBarStyle: 'hidden', // Hidden title bar for cleaner look
            titleBarOverlay: false,
            thickFrame: false, // Thin frame
            vibrancy: null,
            visualEffectState: null,
            fullscreenable: false,
            show: false, // Don't show until ready-to-show
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
    closeWidgetWindow(widgetId) {
        const win = this.windows.get(widgetId);
        if (win && !win.isDestroyed()) {
            win.close();
            return true;
        }
        return false;
    }
    getWidgetWindow(widgetId) {
        return this.windows.get(widgetId);
    }
    getAllWidgetWindows() {
        return this.windows;
    }
    setWidgetPosition(widgetId, x, y) {
        const win = this.windows.get(widgetId);
        if (win && !win.isDestroyed()) {
            win.setPosition(x, y);
            return true;
        }
        return false;
    }
    setWidgetSize(widgetId, width, height) {
        const win = this.windows.get(widgetId);
        if (win && !win.isDestroyed()) {
            win.setSize(width, height);
            return true;
        }
        return false;
    }
    setWidgetAlwaysOnTop(widgetId, alwaysOnTop) {
        const win = this.windows.get(widgetId);
        if (win && !win.isDestroyed()) {
            win.setAlwaysOnTop(alwaysOnTop);
            return true;
        }
        return false;
    }
    setWidgetOpacity(widgetId, opacity) {
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
    setWidgetVisible(widgetId, visible) {
        const win = this.windows.get(widgetId);
        if (win && !win.isDestroyed()) {
            if (visible) {
                win.show();
            }
            else {
                win.hide();
            }
            return true;
        }
        return false;
    }
    // Update widget parameters by reloading the window with new URL parameters
    updateWidgetParams(widgetId, params) {
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
