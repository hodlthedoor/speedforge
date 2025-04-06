import { app, screen, ipcMain, BrowserWindow } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, "../public");
const windows = [];
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
      focusable: true
    });
    if (process.platform === "darwin") {
      win.setWindowButtonVisibility(false);
      win.setAlwaysOnTop(true, "floating", 1);
      win.setBackgroundColor("#00000000");
      win.setOpacity(1);
    }
    win.setIgnoreMouseEvents(false);
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
    app.quit();
    return { success: true };
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
        win.setIgnoreMouseEvents(true, { forward: true });
        console.log("Click-through enabled with forwarding. UI controls use CSS to handle clicks.");
      } else {
        win.setIgnoreMouseEvents(false);
        console.log("Click-through disabled");
      }
      return { success: true, state };
    } catch (error) {
      console.error("Error toggling click-through:", error);
      return { success: false, error: String(error) };
    }
  });
}
app.whenReady().then(() => {
  createWindows();
  setupIpcListeners();
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  console.log("Primary display:", primary);
  console.log("All displays:", displays);
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (windows.length === 0) createWindows();
});
app.on("before-quit", () => {
  ipcMain.removeHandler("app:quit");
  ipcMain.removeHandler("app:toggleClickThrough");
});
//# sourceMappingURL=main.js.map
