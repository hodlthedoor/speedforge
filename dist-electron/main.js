import { BrowserWindow, app, ipcMain } from "electron";
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
      backgroundColor: "#00000000",
      // Fully transparent
      webPreferences: {
        preload: path.join(__dirname$1, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true
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
    this.windows.set(widgetId, win);
    const queryParams = new URLSearchParams();
    queryParams.append("widgetId", widgetId);
    queryParams.append("widgetType", widgetType);
    Object.entries(params).forEach(([key, value]) => {
      queryParams.append(key, String(value));
    });
    const widgetUrl = `${this.mainUrl}?${queryParams.toString()}#/widget`;
    console.log("Loading widget URL:", widgetUrl);
    console.log("Widget parameters:", { widgetId, widgetType, params });
    win.loadURL(widgetUrl);
    win.on("closed", () => {
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
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, "../public");
let mainWindow = null;
let widgetManager;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1e3,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true
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
    console.log("Creating widget window:", options);
    try {
      const window = widgetManager.createWidgetWindow(options);
      return { success: true, id: options.widgetId };
    } catch (error) {
      console.error("Error creating widget window:", error);
      return { success: false, error: error.message };
    }
  });
  ipcMain.handle("widget:close", (_, widgetId) => {
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
  ipcMain.on("widget:closeByEscape", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      win.close();
    }
  });
}
app.whenReady().then(createWindow);
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
  mainWindow = null;
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
//# sourceMappingURL=main.js.map
