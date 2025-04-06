import { app, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

// In ES modules, we need to recreate __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged 
  ? process.env.DIST
  : path.join(__dirname, '../public');

// Store references to all windows
const windows: BrowserWindow[] = [];

// Create a window for each display
function createWindows() {
  // Get all displays
  const displays = screen.getAllDisplays();
  console.log(`Found ${displays.length} displays`);
  
  // Create a window for each display
  for (const display of displays) {
    console.log(`Creating window for display: ${display.id}`, {
      bounds: display.bounds,
      workArea: display.workArea
    });
    
    // Create the window with macOS-specific settings
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false,
      },
      // Make the window transparent
      transparent: true,
      backgroundColor: '#00000000', // Fully transparent
      frame: false,
      skipTaskbar: true,
      hasShadow: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      fullscreen: false,
      // Don't use simpleFullscreen as it can create issues on macOS
      simpleFullscreen: false,
      // Set to floating window type on macOS
      type: 'panel', // Important for macOS transparency
      // Remove vibrancy - it can cause transparency issues
      vibrancy: null as any,
      visualEffectState: null as any,
      // Ensure the window accepts focus when needed
      focusable: true
    });

    // Set specific window properties for macOS
    if (process.platform === 'darwin') {
      win.setWindowButtonVisibility(false);
      // Use level 'floating' for macOS to keep window above others
      win.setAlwaysOnTop(true, 'floating', 1);
      
      // Additional macOS configuration to ensure transparency
      win.setBackgroundColor('#00000000');
      
      // On macOS, we need to set opacity to ensure transparency
      win.setOpacity(1.0);
    }

    // Start with click-through disabled for easier debugging
    win.setIgnoreMouseEvents(false);
    
    // Load the app
    const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, 'index.html')}`;
    win.loadURL(mainUrl);
    
    // Store the window reference
    windows.push(win);
    
    // Log when window is ready
    win.webContents.on('did-finish-load', () => {
      console.log(`Window for display ${display.id} is ready`);
      
      // For macOS, make sure we're the right size after loading
      if (process.platform === 'darwin') {
        win.setBounds({
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height
        });
        
        // Force an opacity update to ensure transparency
        win.setOpacity(0.99);
        setTimeout(() => win.setOpacity(1.0), 100);
      }
    });
    
    // Open DevTools for primary display in dev mode (as a separate window)
    if (process.env.VITE_DEV_SERVER_URL && display.id === screen.getPrimaryDisplay().id) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  }
}

// Setup basic IPC listeners
function setupIpcListeners() {
  // Quit the application
  ipcMain.handle('app:quit', () => {
    console.log('Quitting application');
    app.quit();
    return { success: true };
  });
  
  // Toggle click-through mode
  ipcMain.handle('app:toggleClickThrough', (event, state) => {
    console.log(`Toggling click-through from main process to: ${state}`);
    
    // Get the window that sent this request
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      console.error('Could not find window associated with this request');
      return { success: false, error: 'Window not found' };
    }
    
    try {
      // When we set ignore mouse events, we can choose to forward specific elements
      if (state === true) {
        // Enable click-through but forward clicks on specific UI elements
        // The 'forward' option in Electron 13+ only accepts boolean values
        // We'll use true to forward all events to the web contents
        console.log('Setting ignore mouse events with forwarding');
        
        // Important: Only ignore mouse events, not keyboard events
        // This ensures that keyboard shortcuts like ESC still work when click-through is active
        win.setIgnoreMouseEvents(true, { forward: true });
        
        // Ensure the window can still receive keyboard focus - needed for ESC key
        win.focusOnWebView();
        
        // Using pointer-events CSS in the renderer will control which elements receive clicks
        // This approach allows renderer to decide which elements should get mouse events
        console.log('Click-through enabled with forwarding. UI controls use CSS to handle clicks.');
      } else {
        // Disable click-through completely
        console.log('Disabling ignore mouse events');
        win.setIgnoreMouseEvents(false);
        console.log('Click-through disabled');
      }
      
      const response = { success: true, state };
      console.log('Returning response:', response);
      return response;
    } catch (error) {
      console.error('Error toggling click-through:', error);
      const errorResponse = { success: false, error: String(error) };
      console.log('Returning error response:', errorResponse);
      return errorResponse;
    }
  });
}

// When Electron is ready
app.whenReady().then(() => {
  createWindows();
  setupIpcListeners();
  
  // Register global shortcut for ESC to toggle click-through
  // This ensures ESC works even when the window isn't focused or click-through is enabled
  globalShortcut.register('Escape', () => {
    console.log('Global ESC shortcut triggered');
    
    // Toggle click-through for all windows
    for (const win of windows) {
      // Get current click-through state from window
      const isCurrentlyClickThrough = win.getTitle().includes('click-through:true');
      const newState = !isCurrentlyClickThrough;
      
      console.log(`Global shortcut toggling click-through from ${isCurrentlyClickThrough} to ${newState}`);
      
      // Send message to renderer
      win.webContents.send('app:toggle-click-through', newState);
      
      // Update window title with state for tracking
      win.setTitle(`SpeedForge (click-through:${newState})`);
    }
  });
  
  // Log display information for debugging
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  console.log('Primary display:', primary);
  console.log('All displays:', displays);
});

// Clean up when all windows are closed
app.on('window-all-closed', () => {
  // Unregister global shortcuts
  globalShortcut.unregisterAll();
  
  if (process.platform !== 'darwin') app.quit();
});

// Re-create windows if activated and no windows exist
app.on('activate', () => {
  if (windows.length === 0) createWindows();
});

// Clean up before quitting
app.on('before-quit', () => {
  // Unregister global shortcuts
  globalShortcut.unregisterAll();
  
  // Remove all IPC handlers
  ipcMain.removeHandler('app:quit');
  ipcMain.removeHandler('app:toggleClickThrough');
});
