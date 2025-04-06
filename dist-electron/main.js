import { BrowserWindow, ipcMain, app } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename$1 = fileURLToPath(import.meta.url);
const __dirname$1 = path.dirname(__filename$1);
class WidgetWindowManager {
  constructor(mainUrl) {
    this.mainUrl = mainUrl;
    this.windows = /* @__PURE__ */ new Map();
  }
  createWidgetWindow(options) {
    const { widgetId, widgetType, width = 300, height = 200, x, y, alwaysOnTop = false, params = {} } = options;
    if (this.windows.has(widgetId)) {
      const existingWindow = this.windows.get(widgetId);
      existingWindow == null ? void 0 : existingWindow.focus();
      return existingWindow;
    }
    const win = new BrowserWindow({
      width,
      height,
      x,
      y,
      frame: false,
      // No window frame
      transparent: true,
      // Transparent background
      backgroundColor: "#1f2937",
      // Match the dark background color
      webPreferences: {
        preload: path.join(__dirname$1, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        webSecurity: false,
        // Allow loading of local resources
        scrollBounce: false,
        // Improves scrollbar behavior
        backgroundThrottling: true,
        // Allow background throttling to reduce CPU/GPU usage
        disableHtmlFullscreenWindowResize: true,
        // Disable unnecessary resize events
        devTools: process.env.NODE_ENV === "development"
        // Only enable devtools in dev mode
      },
      alwaysOnTop,
      skipTaskbar: true,
      movable: true,
      // Allow window to be moved
      resizable: false,
      // Not resizable as requested
      hasShadow: false,
      // No shadow
      autoHideMenuBar: true,
      // Hide the menu bar
      titleBarStyle: "hidden",
      // Hidden title bar for cleaner look
      titleBarOverlay: false,
      thickFrame: false,
      // Thin frame
      vibrancy: null,
      visualEffectState: null,
      fullscreenable: false,
      show: false
      // Don't show until ready-to-show
    });
    win.once("ready-to-show", () => {
      if (process.platform === "darwin") {
        win.setWindowButtonVisibility(false);
      }
      win.show();
    });
    win.webContents.on("did-finish-load", () => {
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
    this.windows.set(widgetId, win);
    const queryParams = new URLSearchParams();
    queryParams.append("widgetId", widgetId);
    queryParams.append("widgetType", widgetType);
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value));
      console.log(`Setting param for widget ${widgetId}: ${key}=${value}`);
    });
    const widgetUrl = `${this.mainUrl}?${queryParams.toString()}#/widget`;
    console.log("Loading widget URL:", widgetUrl);
    console.log("Widget parameters:", { widgetId, widgetType, params });
    win.loadURL(widgetUrl);
    win.on("closed", () => {
      this.windows.delete(widgetId);
      ipcMain.emit("widget:closed", {}, options.widgetId);
    });
    win.webContents.setWindowOpenHandler(() => {
      return { action: "deny" };
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
      win.setOpacity(opacity);
      win.webContents.send("widget:opacity", opacity);
      return true;
    }
    return false;
  }
  setWidgetVisible(widgetId, visible) {
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
  updateWidgetParams(widgetId, params) {
    const win = this.windows.get(widgetId);
    if (win && !win.isDestroyed()) {
      const currentUrl = new URL(win.webContents.getURL());
      const searchParams = new URLSearchParams(currentUrl.search);
      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, String(value));
        console.log(`Setting param for widget ${widgetId}: ${key}=${value}`);
      });
      const newUrl = `${this.mainUrl}?${searchParams.toString()}#/widget`;
      console.log(`Reloading widget ${widgetId} with URL:`, newUrl);
      win.loadURL(newUrl);
      return true;
    }
    return false;
  }
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, "../public");
let mainWindow = null;
let widgetManager;
let telemetryData = null;
let telemetryConnected = false;
const widgetWindowHandlers = /* @__PURE__ */ new Map();
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1e3,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false,
      scrollBounce: false
    },
    // Standard window with controls
    frame: true,
    transparent: false,
    titleBarStyle: "default"
  });
  mainWindow.webContents.on("did-finish-load", () => {
    mainWindow == null ? void 0 : mainWindow.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, "index.html")}`;
  mainWindow.loadURL(mainUrl);
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.webContents.openDevTools();
  }
  widgetManager = new WidgetWindowManager(mainUrl);
  setupIpcListeners();
}
function setupIpcListeners() {
  ipcMain.handle("widget:create", (_, options) => {
    try {
      const window = widgetManager.createWidgetWindow(options);
      widgetWindowHandlers.set(options.widgetId, window);
      window.on("closed", () => {
        widgetWindowHandlers.delete(options.widgetId);
      });
      return { success: true, id: options.widgetId };
    } catch (error) {
      console.error("Error creating widget window:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("widget:close", (_, widgetId) => {
    widgetWindowHandlers.delete(widgetId);
    const success = widgetManager.closeWidgetWindow(widgetId);
    return { success };
  });
  ipcMain.handle("widget:getAll", () => {
    const widgets = Array.from(widgetManager.getAllWidgetWindows().keys());
    return { success: true, widgets };
  });
  ipcMain.handle("widget:setPosition", (_, { widgetId, x, y }) => {
    const success = widgetManager.setWidgetPosition(widgetId, x, y);
    return { success };
  });
  ipcMain.handle("widget:setSize", (_, { widgetId, width, height }) => {
    const success = widgetManager.setWidgetSize(widgetId, width, height);
    return { success };
  });
  ipcMain.handle("widget:setAlwaysOnTop", (_, { widgetId, alwaysOnTop }) => {
    const success = widgetManager.setWidgetAlwaysOnTop(widgetId, alwaysOnTop);
    return { success };
  });
  ipcMain.handle("widget:setOpacity", (_, { widgetId, opacity }) => {
    const success = widgetManager.setWidgetOpacity(widgetId, opacity);
    return { success };
  });
  ipcMain.handle("widget:setVisible", (_, { widgetId, visible }) => {
    const success = widgetManager.setWidgetVisible(widgetId, visible);
    return { success };
  });
  ipcMain.handle("widget:updateParams", (_, { widgetId, params }) => {
    console.log(`Main process received updateParams request for widget ${widgetId}:`, params);
    if (widgetManager.updateWidgetParams(widgetId, params)) {
      return { success: true };
    } else {
      return { success: false, error: "Failed to update widget parameters" };
    }
  });
  ipcMain.handle("telemetry:getData", (event) => {
    return telemetryData;
  });
  ipcMain.handle("telemetry:getConnectionStatus", (event) => {
    return telemetryConnected;
  });
  ipcMain.on("telemetry:update", (_, data) => {
    telemetryData = { ...data };
    telemetryConnected = true;
    const windows = widgetManager.getAllWidgetWindows();
    if (windows.size > 0 || widgetWindowHandlers.size > 0) {
      broadcastToAllWidgets("telemetry:update", telemetryData);
    }
  });
  ipcMain.on("telemetry:connectionChange", (_, connected) => {
    telemetryConnected = connected;
    const windows = widgetManager.getAllWidgetWindows();
    if (windows.size > 0 || widgetWindowHandlers.size > 0) {
      broadcastToAllWidgets("telemetry:connectionChange", connected);
    }
  });
  ipcMain.on("widget:closeByEscape", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.close();
    }
  });
  ipcMain.on("widget:registerForUpdates", (event, { widgetId }) => {
    const sender = BrowserWindow.fromWebContents(event.sender);
    if (!sender) {
      return;
    }
    widgetWindowHandlers.set(widgetId, sender);
    if (telemetryData) {
      try {
        sender.webContents.send("telemetry:update", telemetryData);
      } catch (error) {
        console.error(`Failed to send initial data to widget ${widgetId}:`, error);
      }
    }
    try {
      sender.webContents.send("telemetry:connectionChange", true);
    } catch (error) {
      console.error(`Failed to send connection status to widget ${widgetId}:`, error);
    }
  });
  ipcMain.on("widget:closed", (_, widgetId) => {
    if (widgetWindowHandlers.has(widgetId)) {
      widgetWindowHandlers.delete(widgetId);
    }
  });
}
function broadcastToAllWidgets(channel, data) {
  const messaged = /* @__PURE__ */ new Set();
  const windows = widgetManager.getAllWidgetWindows();
  if (windows.size === 0 && widgetWindowHandlers.size === 0) {
    return;
  }
  for (const [widgetId, window] of windows.entries()) {
    if (!window.isDestroyed()) {
      try {
        window.webContents.send(channel, data);
        messaged.add(widgetId);
      } catch (error) {
        console.error(`Failed to send ${channel} to widget ${widgetId}:`, error);
      }
    }
  }
  for (const [widgetId, window] of widgetWindowHandlers.entries()) {
    if (messaged.has(widgetId) || window.isDestroyed()) {
      if (window.isDestroyed()) {
        widgetWindowHandlers.delete(widgetId);
      }
      continue;
    }
    try {
      window.webContents.send(channel, data);
    } catch (error) {
      console.error(`Failed to send ${channel} to widget ${widgetId}:`, error);
      widgetWindowHandlers.delete(widgetId);
    }
  }
}
app.whenReady().then(() => {
  createWindow();
  setupMemoryManagement();
});
function setupMemoryManagement() {
  setInterval(() => {
    for (const [widgetId, window] of widgetWindowHandlers.entries()) {
      if (window.isDestroyed()) {
        widgetWindowHandlers.delete(widgetId);
      }
    }
    const memoryInfo = process.memoryUsage();
    const memoryUsageMB = Math.round(memoryInfo.heapUsed / 1024 / 1024);
    if (memoryUsageMB > 500) {
      telemetryData = null;
      if (global.gc) {
        global.gc();
      }
    }
  }, 3e4);
}
app.on("before-quit", () => {
  console.log("Application is shutting down, closing all widgets...");
  if (widgetManager) {
    const windows = widgetManager.getAllWidgetWindows();
    for (const [widgetId, window] of windows.entries()) {
      if (!window.isDestroyed()) {
        console.log(`Closing widget: ${widgetId}`);
        window.close();
      }
    }
  }
  widgetWindowHandlers.clear();
  console.log("Removing all IPC handlers...");
  ipcMain.removeHandler("widget:create");
  ipcMain.removeHandler("widget:close");
  ipcMain.removeHandler("widget:getAll");
  ipcMain.removeHandler("widget:setPosition");
  ipcMain.removeHandler("widget:setSize");
  ipcMain.removeHandler("widget:setAlwaysOnTop");
  ipcMain.removeHandler("widget:setOpacity");
  ipcMain.removeHandler("widget:setVisible");
  ipcMain.removeHandler("widget:updateParams");
  ipcMain.removeHandler("app:quit");
  ipcMain.removeHandler("telemetry:getData");
  ipcMain.removeHandler("telemetry:getConnectionStatus");
  ipcMain.removeAllListeners("widget:closeByEscape");
  ipcMain.removeAllListeners("telemetry:update");
  ipcMain.removeAllListeners("telemetry:connectionChange");
  ipcMain.removeAllListeners("widget:registerForUpdates");
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
  mainWindow = null;
});
ipcMain.handle("app:quit", () => {
  if (widgetManager) {
    const windows = widgetManager.getAllWidgetWindows();
    for (const [widgetId, window] of windows.entries()) {
      if (!window.isDestroyed()) {
        window.close();
      }
    }
  }
  app.quit();
  return { success: true };
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
//# sourceMappingURL=main.js.map
