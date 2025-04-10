import { app, globalShortcut, ipcMain, screen, BrowserWindow } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, "../public");
const windows = [];
let stayOnTopInterval = null;
let autoCreateWindowsForNewDisplays = true;
function createWindows() {
  const displays = screen.getAllDisplays();
  console.log(`Found ${displays.length} displays`);
  for (const display of displays) {
    console.log(`Creating window for display: ${display.id}`, {
      bounds: display.bounds,
      workArea: display.workArea
    });
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      },
      // Make the window transparent
      transparent: true,
      backgroundColor: "#00000000",
      // Fully transparent
      frame: false,
      skipTaskbar: true,
      hasShadow: false,
      titleBarStyle: "hidden",
      titleBarOverlay: false,
      fullscreen: false,
      // Don't use simpleFullscreen as it can create issues on macOS
      simpleFullscreen: false,
      // Set to floating window type on macOS
      type: "panel",
      // Important for macOS transparency
      // Remove vibrancy - it can cause transparency issues
      vibrancy: null,
      visualEffectState: null,
      // Ensure the window accepts focus when needed
      focusable: true,
      // Always stay on top of other windows
      alwaysOnTop: true
    });
    if (process.platform === "darwin") {
      win.setWindowButtonVisibility(false);
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.setBackgroundColor("#00000000");
      win.setOpacity(1);
    } else if (process.platform === "win32") {
      win.setAlwaysOnTop(true, "screen-saver");
    } else {
      win.setAlwaysOnTop(true);
    }
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setTitle("Speedforge (click-through:true)");
    const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, "index.html")}`;
    win.loadURL(mainUrl);
    windows.push(win);
    win.webContents.on("did-finish-load", () => {
      console.log(`Window for display ${display.id} is ready`);
      if (process.platform === "darwin") {
        win.setBounds({
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height
        });
        win.setOpacity(0.99);
        setTimeout(() => win.setOpacity(1), 100);
      }
    });
    if (process.env.VITE_DEV_SERVER_URL && display.id === screen.getPrimaryDisplay().id) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  }
}
function setupIpcListeners() {
  ipcMain.handle("app:quit", () => {
    console.log("Quitting application");
    try {
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.close();
        }
      }
      windows.length = 0;
      setTimeout(() => {
        try {
          app.quit();
        } catch (error) {
          console.log("Error during app.quit():", error);
          process.exit(0);
        }
      }, 100);
      return { success: true };
    } catch (error) {
      console.error("Error during quit process:", error);
      process.exit(0);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("app:toggleAutoNewWindows", (event, state) => {
    console.log(`Toggling auto-create new windows for displays from main process to: ${state}`);
    autoCreateWindowsForNewDisplays = state;
    return { success: true, state };
  });
  ipcMain.handle("app:toggleClickThrough", (event, state) => {
    console.log(`Toggling click-through from main process to: ${state}`);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      console.error("Could not find window associated with this request");
      return { success: false, error: "Window not found" };
    }
    try {
      if (state === true) {
        console.log("Setting ignore mouse events with forwarding");
        win.setIgnoreMouseEvents(true, { forward: true });
        win.focusOnWebView();
        if (process.platform === "darwin") {
          win.setAlwaysOnTop(true, "screen-saver", 1);
        } else if (process.platform === "win32") {
          win.setAlwaysOnTop(true, "screen-saver");
        } else {
          win.setAlwaysOnTop(true);
        }
        console.log("Click-through enabled with forwarding. UI controls use CSS to handle clicks.");
      } else {
        console.log("Disabling ignore mouse events");
        win.setIgnoreMouseEvents(false);
        if (process.platform === "darwin") {
          win.setAlwaysOnTop(true, "screen-saver", 1);
        } else if (process.platform === "win32") {
          win.setAlwaysOnTop(true, "screen-saver");
        } else {
          win.setAlwaysOnTop(true);
        }
        console.log("Click-through disabled");
      }
      const response = { success: true, state };
      console.log("Returning response:", response);
      return response;
    } catch (error) {
      console.error("Error toggling click-through:", error);
      const errorResponse = { success: false, error: String(error) };
      console.log("Returning error response:", errorResponse);
      return errorResponse;
    }
  });
}
app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (windows.length === 0) createWindows();
});
app.on("before-quit", () => {
  console.log("Performing cleanup before quit");
  if (stayOnTopInterval) {
    clearInterval(stayOnTopInterval);
    stayOnTopInterval = null;
  }
  globalShortcut.unregisterAll();
  ipcMain.removeHandler("app:quit");
  ipcMain.removeHandler("app:toggleAutoNewWindows");
  ipcMain.removeHandler("app:toggleClickThrough");
  for (const win of windows) {
    try {
      if (!win.isDestroyed()) {
        win.removeAllListeners();
        win.setClosable(true);
        win.close();
      }
    } catch (error) {
      console.error("Error closing window:", error);
    }
  }
  windows.length = 0;
});
app.whenReady().then(() => {
  app.setName("Speedforge");
  createWindows();
  setupIpcListeners();
  stayOnTopInterval = setInterval(() => {
    for (const win of windows) {
      if (!win.isDestroyed()) {
        if (process.platform === "darwin") {
          win.setAlwaysOnTop(true, "screen-saver", 1);
        } else if (process.platform === "win32") {
          win.setAlwaysOnTop(true, "screen-saver");
        } else {
          win.setAlwaysOnTop(true);
        }
      }
    }
  }, 1e3);
  globalShortcut.register("CommandOrControl+Space", () => {
    console.log("Global Ctrl+Space shortcut triggered");
    for (const win of windows) {
      const isCurrentlyClickThrough = win.getTitle().includes("click-through:true");
      const newState = !isCurrentlyClickThrough;
      console.log(`Global shortcut toggling click-through from ${isCurrentlyClickThrough} to ${newState}`);
      win.webContents.send("app:toggle-click-through", newState);
      win.setTitle(`Speedforge (click-through:${newState})`);
    }
  });
  screen.on("display-added", (event, display) => {
    console.log("New display detected:", display);
    if (!autoCreateWindowsForNewDisplays) {
      console.log("Auto-create new windows is disabled, skipping window creation for new display");
      return;
    }
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      },
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      skipTaskbar: true,
      hasShadow: false,
      titleBarStyle: "hidden",
      titleBarOverlay: false,
      fullscreen: false,
      type: "panel",
      vibrancy: null,
      visualEffectState: null,
      focusable: true,
      alwaysOnTop: true
    });
    if (process.platform === "darwin") {
      win.setWindowButtonVisibility(false);
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.setBackgroundColor("#00000000");
      win.setOpacity(1);
    } else if (process.platform === "win32") {
      win.setAlwaysOnTop(true, "screen-saver");
    } else {
      win.setAlwaysOnTop(true);
    }
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setTitle("Speedforge (click-through:true)");
    const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, "index.html")}`;
    win.loadURL(mainUrl);
    windows.push(win);
    console.log(`Created new window for display ${display.id}`);
  });
  screen.on("display-removed", (event, display) => {
    console.log("Display removed:", display);
  });
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  console.log("Primary display:", primary);
  console.log("All displays:", displays);
});
//# sourceMappingURL=main.js.map
