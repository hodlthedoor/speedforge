import { app, BrowserWindow, ipcMain, IpcMainInvokeEvent } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { WidgetWindowManager, WidgetWindowOptions } from './WidgetWindow';

// In ES modules, we need to recreate __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged 
  ? process.env.DIST
  : path.join(__dirname, '../public');

let mainWindow: BrowserWindow | null = null;
let widgetManager: WidgetWindowManager;
// Store telemetry data and connection status in the main process
let telemetryData: any = null;
let telemetryConnected: boolean = false;

// Track registered widget windows
const widgetWindowHandlers: Map<string, BrowserWindow> = new Map();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      scrollBounce: false
    },
    // Standard window with controls
    frame: true,
    transparent: false,
    titleBarStyle: 'default'
  });

  // Test active push message to Renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow?.webContents.send('main-process-message', new Date().toLocaleString());
  });

  const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, 'index.html')}`;
  mainWindow.loadURL(mainUrl);

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
  
  // Create Widget Manager
  widgetManager = new WidgetWindowManager(mainUrl);
  
  // Set up IPC listeners for widget operations
  setupIpcListeners();
}

function setupIpcListeners() {
  // Create a new widget window
  ipcMain.handle('widget:create', (_, options: WidgetWindowOptions) => {
    console.log('Creating widget window:', options);
    try {
      const window = widgetManager.createWidgetWindow(options);
      
      // Register the window with its widgetId
      widgetWindowHandlers.set(options.widgetId, window);
      
      // Listen for window closed event to unregister
      window.on('closed', () => {
        console.log(`Widget ${options.widgetId} closed, removing from handlers`);
        widgetWindowHandlers.delete(options.widgetId);
      });
      
      return { success: true, id: options.widgetId };
    } catch (error: any) {
      console.error('Error creating widget window:', error);
      return { success: false, error: error.message };
    }
  });
  
  // Close a widget window
  ipcMain.handle('widget:close', (_, widgetId: string) => {
    // Remove from handlers when closing
    widgetWindowHandlers.delete(widgetId);
    const success = widgetManager.closeWidgetWindow(widgetId);
    return { success };
  });
  
  // Get all widget windows
  ipcMain.handle('widget:getAll', () => {
    const widgets = Array.from(widgetManager.getAllWidgetWindows().keys());
    return { success: true, widgets };
  });
  
  // Set widget position
  ipcMain.handle('widget:setPosition', (_, { widgetId, x, y }: { widgetId: string, x: number, y: number }) => {
    const success = widgetManager.setWidgetPosition(widgetId, x, y);
    return { success };
  });
  
  // Set widget size
  ipcMain.handle('widget:setSize', (_, { widgetId, width, height }: { widgetId: string, width: number, height: number }) => {
    const success = widgetManager.setWidgetSize(widgetId, width, height);
    return { success };
  });
  
  // Set widget always-on-top status
  ipcMain.handle('widget:setAlwaysOnTop', (_, { widgetId, alwaysOnTop }: { widgetId: string, alwaysOnTop: boolean }) => {
    const success = widgetManager.setWidgetAlwaysOnTop(widgetId, alwaysOnTop);
    return { success };
  });
  
  // Set widget opacity
  ipcMain.handle('widget:setOpacity', (_, { widgetId, opacity }: { widgetId: string, opacity: number }) => {
    const success = widgetManager.setWidgetOpacity(widgetId, opacity);
    return { success };
  });
  
  // Set widget visibility
  ipcMain.handle('widget:setVisible', (_, { widgetId, visible }: { widgetId: string, visible: boolean }) => {
    const success = widgetManager.setWidgetVisible(widgetId, visible);
    return { success };
  });
  
  // Update widget parameters
  ipcMain.handle('widget:updateParams', (_, { widgetId, params }: { widgetId: string, params: Record<string, any> }) => {
    console.log(`Main process received updateParams request for widget ${widgetId}:`, params);
    
    // Use the new method to reload the widget with updated parameters
    if (widgetManager.updateWidgetParams(widgetId, params)) {
      return { success: true };
    } else {
      return { success: false, error: 'Failed to update widget parameters' };
    }
  });
  
  // Add handlers for telemetry data access from IPC widgets
  ipcMain.handle('telemetry:getData', (event: IpcMainInvokeEvent) => {
    // Get the sender window to determine which widget is making the request
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender) {
      console.log('IPC Request: telemetry:getData from unknown window');
      return {};
    }
    
    console.log('IPC Request: telemetry:getData, returning:', telemetryData || {});
    return telemetryData || {}; 
  });
  
  ipcMain.handle('telemetry:getConnectionStatus', (event: IpcMainInvokeEvent) => {
    // Get the sender window to determine which widget is making the request
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender) {
      console.log('IPC Request: telemetry:getConnectionStatus from unknown window');
      return true;
    }
    
    // Always return true for connection status to widgets
    // This prevents the "Disconnected" message in widgets
    console.log('IPC Request: telemetry:getConnectionStatus, returning: true');
    return true; 
  });
  
  // Listen for telemetry updates from the renderer process
  ipcMain.on('telemetry:update', (_, data) => {
    // Store the data for future requests
    telemetryData = data;
    telemetryConnected = true;
    
    // Broadcast to all widget windows
    broadcastToAllWidgets('telemetry:update', data);
  });
  
  // Listen for connection status changes
  ipcMain.on('telemetry:connectionChange', (_, connected) => {
    // Store the status for future requests
    telemetryConnected = connected;
    
    // Broadcast to all widget windows
    broadcastToAllWidgets('telemetry:connectionChange', connected);
  });
  
  // Handle Escape key to close widgets
  ipcMain.on('widget:closeByEscape', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.close();
    }
  });
}

// Helper function to broadcast a message to all widget windows
function broadcastToAllWidgets(channel: string, data: any) {
  // Use the widgets from the widget manager to ensure we get all windows
  const windows = widgetManager.getAllWidgetWindows();
  const windowCount = windows.size;
  
  console.log(`Broadcasting ${channel} to ${windowCount} widget windows`);
  
  for (const [widgetId, window] of windows.entries()) {
    if (!window.isDestroyed()) {
      try {
        window.webContents.send(channel, data);
        console.log(`Sent ${channel} to widget ${widgetId}`);
      } catch (error) {
        console.error(`Failed to send ${channel} to widget ${widgetId}:`, error);
      }
    }
  }
}

app.whenReady().then(createWindow);

// Add a 'before-quit' handler to ensure all widgets are closed properly
app.on('before-quit', () => {
  console.log('Application is shutting down, closing all widgets...');
  // Close all open widget windows to prevent orphaned processes
  if (widgetManager) {
    const windows = widgetManager.getAllWidgetWindows();
    for (const [widgetId, window] of windows.entries()) {
      if (!window.isDestroyed()) {
        console.log(`Closing widget: ${widgetId}`);
        window.close();
      }
    }
  }
  
  // Clear the handlers map
  widgetWindowHandlers.clear();
  
  // Clean up all IPC handlers
  console.log('Removing all IPC handlers...');
  ipcMain.removeHandler('widget:create');
  ipcMain.removeHandler('widget:close');
  ipcMain.removeHandler('widget:getAll');
  ipcMain.removeHandler('widget:setPosition');
  ipcMain.removeHandler('widget:setSize');
  ipcMain.removeHandler('widget:setAlwaysOnTop');
  ipcMain.removeHandler('widget:setOpacity');
  ipcMain.removeHandler('widget:setVisible');
  ipcMain.removeHandler('widget:updateParams');
  ipcMain.removeHandler('app:quit');
  ipcMain.removeHandler('telemetry:getData');
  ipcMain.removeHandler('telemetry:getConnectionStatus');
  
  // Remove all listeners
  ipcMain.removeAllListeners('widget:closeByEscape');
  ipcMain.removeAllListeners('telemetry:update');
  ipcMain.removeAllListeners('telemetry:connectionChange');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
  mainWindow = null;
});

// Add shutdown handler for main window to close all widgets
ipcMain.handle('app:quit', () => {
  // Close all widget windows first
  if (widgetManager) {
    const windows = widgetManager.getAllWidgetWindows();
    for (const [widgetId, window] of windows.entries()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
  }
  // Then quit the application
  app.quit();
  return { success: true };
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
