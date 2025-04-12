import { app, BrowserWindow, ipcMain, screen, globalShortcut } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import our speech module
import { initSpeechModule, cleanup as cleanupSpeech } from './speech/speechModule.mjs';

// In ES modules, we need to recreate __dirname and __filename
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged 
  ? process.env.DIST
  : path.join(__dirname, '../public');

// Store references to all windows
const windows: BrowserWindow[] = [];

// Map to track which window belongs to which display
const displayWindowMap = new Map<number, BrowserWindow>();

// Create a variable to hold the interval ID
let stayOnTopInterval: NodeJS.Timeout | null = null;

// Add display-related events to handle monitors being added/removed
let autoCreateWindowsForNewDisplays = true;

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
      focusable: true,
      // Always stay on top of other windows
      alwaysOnTop: true
    });

    // Set specific window properties for macOS
    if (process.platform === 'darwin') {
      win.setWindowButtonVisibility(false);
      // Use level 'floating' for macOS to keep window above others
      win.setAlwaysOnTop(true, 'screen-saver', 1); // Use screen-saver level which is higher than floating
      
      // Additional macOS configuration to ensure transparency
      win.setBackgroundColor('#00000000');
      
      // On macOS, we need to set opacity to ensure transparency
      win.setOpacity(1.0);
    } else if (process.platform === 'win32') {
      // For Windows, set a more aggressive always-on-top level
      win.setAlwaysOnTop(true, 'screen-saver');
    } else {
      // For Linux and other platforms
      win.setAlwaysOnTop(true);
    }

    // Start with click-through enabled
    win.setIgnoreMouseEvents(true, { forward: true });
    
    // Set window title to reflect click-through state
    win.setTitle('Speedforge (click-through:true)');
    
    // Load the app
    const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, 'index.html')}`;
    win.loadURL(mainUrl);
    
    // Store the window reference
    windows.push(win);
    
    // Map this window to its display ID
    displayWindowMap.set(display.id, win);
    
    // Store the display ID in the window's metadata for reference
    (win as any).displayId = display.id;
    
    // Log when window is ready
    win.webContents.on('did-finish-load', () => {
      console.log(`Window for display ${display.id} is ready`);
      
      // Send display ID to the renderer process
      win.webContents.send('display:id', display.id);
      
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

// Function to close a specific window by display ID
function closeWindowForDisplay(displayId: number): boolean {
  console.log(`Attempting to close window for display ID: ${displayId}`);
  
  // Get the window for this display
  const win = displayWindowMap.get(displayId);
  
  if (!win) {
    console.log(`No window found for display ID: ${displayId}`);
    return false;
  }
  
  try {
    if (!win.isDestroyed()) {
      console.log(`Closing window for display ID: ${displayId}`);
      
      // Remove all listeners to prevent memory leaks
      win.removeAllListeners();
      
      // Ensure the window can be closed
      win.setClosable(true);
      
      // Hide the window immediately
      win.hide();
      
      // Set to null to help garbage collection
      win.webContents.setDevToolsWebContents(null);
      
      // Force close the window
      win.close();
      
      // Explicitly destroy the window
      win.destroy();
      
      // Remove from our tracking maps
      displayWindowMap.delete(displayId);
      const windowIndex = windows.indexOf(win);
      if (windowIndex >= 0) {
        windows.splice(windowIndex, 1);
      }
      
      console.log(`Successfully closed and destroyed window for display ID: ${displayId}`);
      return true;
    } else {
      console.log(`Window for display ID: ${displayId} was already destroyed`);
      
      // Clean up tracking even if window was already destroyed
      displayWindowMap.delete(displayId);
      const windowIndex = windows.indexOf(win);
      if (windowIndex >= 0) {
        windows.splice(windowIndex, 1);
      }
      
      return true;
    }
  } catch (error) {
    console.error(`Error closing window for display ID: ${displayId}`, error);
    
    // Try to clean up tracking even if there was an error
    displayWindowMap.delete(displayId);
    const windowIndex = windows.indexOf(win);
    if (windowIndex >= 0) {
      windows.splice(windowIndex, 1);
    }
  }
  
  return false;
}

// Setup basic IPC listeners
function setupIpcListeners() {
  // Quit the application
  ipcMain.handle('app:quit', () => {
    console.log('Quitting application');
    try {
      // Try to close all windows first
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.close();
        }
      }
      
      // Clear out the windows array
      windows.length = 0;
      
      // Schedule app quit to happen after current event loop
      setTimeout(() => {
        try {
          app.quit();
        } catch (error) {
          console.log('Error during app.quit():', error);
          // Force exit as a last resort
          process.exit(0);
        }
      }, 100);
      
      return { success: true };
    } catch (error) {
      console.error('Error during quit process:', error);
      // Force exit as a last resort
      process.exit(0);
      return { success: false, error: String(error) };
    }
  });
  
  // Toggle auto-create windows for new displays
  ipcMain.handle('app:toggleAutoNewWindows', (event, state) => {
    console.log(`Toggling auto-create new windows for displays from main process to: ${state}`);
    autoCreateWindowsForNewDisplays = state;
    return { success: true, state };
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
        
        // Ensure the window stays on top with the highest level
        if (process.platform === 'darwin') {
          win.setAlwaysOnTop(true, 'screen-saver', 1);
        } else if (process.platform === 'win32') {
          win.setAlwaysOnTop(true, 'screen-saver');
        } else {
          win.setAlwaysOnTop(true);
        }
        
        // Using pointer-events CSS in the renderer will control which elements receive clicks
        // This approach allows renderer to decide which elements should get mouse events
        console.log('Click-through enabled with forwarding. UI controls use CSS to handle clicks.');
      } else {
        // Disable click-through completely
        console.log('Disabling ignore mouse events');
        win.setIgnoreMouseEvents(false);
        
        // Make sure window still stays on top with the highest level
        if (process.platform === 'darwin') {
          win.setAlwaysOnTop(true, 'screen-saver', 1);
        } else if (process.platform === 'win32') {
          win.setAlwaysOnTop(true, 'screen-saver');
        } else {
          win.setAlwaysOnTop(true);
        }
        
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
  
  // New handler to close a specific window by display ID
  ipcMain.handle('app:closeWindowForDisplay', (event, displayId) => {
    console.log(`Received request to close window for display ID: ${displayId}`);
    
    // Get the display ID of the window making the request if no ID was provided
    if (displayId === undefined) {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        displayId = (win as any).displayId;
      }
    }
    
    if (displayId === undefined) {
      return { success: false, error: 'No display ID provided or found' };
    }
    
    const success = closeWindowForDisplay(displayId);
    return { success };
  });
  
  // New handler to get all displays
  ipcMain.handle('app:getDisplays', () => {
    try {
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();
      
      // Create a simplified display info object
      const displayInfo = displays.map(display => ({
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        isPrimary: display.id === primaryDisplay.id,
        scaleFactor: display.scaleFactor,
        rotation: display.rotation,
        size: display.size,
        label: display.label || `Display ${display.id}`
      }));
      
      return { success: true, displays: displayInfo };
    } catch (error) {
      console.error('Error getting displays:', error);
      return { success: false, error: String(error) };
    }
  });
  
  // New handler to get current window's display ID
  ipcMain.handle('app:getCurrentDisplayId', (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        const displayId = (win as any).displayId;
        return { success: true, displayId };
      }
      return { success: false, error: 'No window found for web contents' };
    } catch (error) {
      console.error('Error getting current display ID:', error);
      return { success: false, error: String(error) };
    }
  });
}

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
  console.log('Performing cleanup before quit');
  
  // Clear the stay-on-top interval
  if (stayOnTopInterval) {
    clearInterval(stayOnTopInterval);
    stayOnTopInterval = null;
  }
  
  // Unregister global shortcuts
  globalShortcut.unregisterAll();
  
  // Remove all IPC handlers
  ipcMain.removeHandler('app:quit');
  ipcMain.removeHandler('app:toggleAutoNewWindows');
  ipcMain.removeHandler('app:toggleClickThrough');
  ipcMain.removeHandler('app:closeWindowForDisplay');
  ipcMain.removeHandler('app:getDisplays');
  ipcMain.removeHandler('app:getCurrentDisplayId');
  
  // Clean up speech module
  cleanupSpeech();
  
  // Close windows gracefully
  for (const win of windows) {
    try {
      if (!win.isDestroyed()) {
        win.removeAllListeners();
        win.setClosable(true);
        win.close();
      }
    } catch (error) {
      console.error('Error closing window:', error);
    }
  }
  
  // Clear windows array
  windows.length = 0;
});

// When Electron is ready
app.whenReady().then(() => {
  // Set application name for process manager
  app.setName('Speedforge');
  
  // Initialize the speech module
  initSpeechModule();
  
  createWindows();
  setupIpcListeners();
  
  // Set up an interval to periodically ensure all windows stay on top
  stayOnTopInterval = setInterval(() => {
    for (const win of windows) {
      if (!win.isDestroyed()) {
        if (process.platform === 'darwin') {
          win.setAlwaysOnTop(true, 'screen-saver', 1);
        } else if (process.platform === 'win32') {
          win.setAlwaysOnTop(true, 'screen-saver');
        } else {
          win.setAlwaysOnTop(true);
        }
      }
    }
  }, 1000); // Check every second
  
  // Register global shortcut for Ctrl+Space to toggle click-through
  globalShortcut.register('CommandOrControl+Space', () => {
    console.log('Global Ctrl+Space shortcut triggered');
    
    // Toggle click-through for all windows
    for (const win of windows) {
      // Get current click-through state from window
      const isCurrentlyClickThrough = win.getTitle().includes('click-through:true');
      const newState = !isCurrentlyClickThrough;
      
      console.log(`Global shortcut toggling click-through from ${isCurrentlyClickThrough} to ${newState}`);
      
      // Send message to renderer
      win.webContents.send('app:toggle-click-through', newState);
      
      // Update window title with state for tracking
      win.setTitle(`Speedforge (click-through:${newState})`);
    }
  });
  
  // Setup screen event listeners now that the app is ready
  screen.on('display-added', (event, display) => {
    console.log('New display detected:', display);
    
    // Only create window if auto-create is enabled
    if (!autoCreateWindowsForNewDisplays) {
      console.log('Auto-create new windows is disabled, skipping window creation for new display');
      return;
    }
    
    // Create a window for the newly added display
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
      transparent: true,
      backgroundColor: '#00000000',
      frame: false,
      skipTaskbar: true,
      hasShadow: false,
      titleBarStyle: 'hidden',
      titleBarOverlay: false,
      fullscreen: false,
      type: 'panel',
      vibrancy: null as any,
      visualEffectState: null as any,
      focusable: true,
      alwaysOnTop: true
    });

    // Set platform-specific settings
    if (process.platform === 'darwin') {
      win.setWindowButtonVisibility(false);
      win.setAlwaysOnTop(true, 'screen-saver', 1);
      win.setBackgroundColor('#00000000');
      win.setOpacity(1.0);
    } else if (process.platform === 'win32') {
      win.setAlwaysOnTop(true, 'screen-saver');
    } else {
      win.setAlwaysOnTop(true);
    }

    // Start with click-through enabled
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setTitle('Speedforge (click-through:true)');
    
    // Load the app
    const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, 'index.html')}`;
    win.loadURL(mainUrl);
    
    // Store the window reference
    windows.push(win);
    
    // Map this window to its display ID
    displayWindowMap.set(display.id, win);
    
    // Store the display ID in the window's metadata for reference
    (win as any).displayId = display.id;
    
    console.log(`Created new window for display ${display.id}`);
  });

  screen.on('display-removed', (event, display) => {
    console.log('Display removed:', display);
    
    // Get window before attempting to close it
    const win = displayWindowMap.get(display.id);
    
    // Close the window associated with this display
    const result = closeWindowForDisplay(display.id);
    console.log(`Window for removed display ${display.id} was ${result ? 'closed' : 'not found or could not be closed'}`);
    
    // Force additional cleanup if the window was found but not properly closed
    if (!result && win && !win.isDestroyed()) {
      console.log(`Forcing additional cleanup for display ${display.id}`);
      try {
        win.removeAllListeners();
        win.hide();
        win.destroy();
        
        // Clean up tracking maps
        displayWindowMap.delete(display.id);
        const windowIndex = windows.indexOf(win);
        if (windowIndex >= 0) {
          windows.splice(windowIndex, 1);
        }
      } catch (cleanupError) {
        console.error(`Error during forced cleanup for display ${display.id}:`, cleanupError);
      }
    }
    
    // Verify cleanup was successful
    if (displayWindowMap.has(display.id)) {
      console.warn(`Window for display ${display.id} is still in displayWindowMap after cleanup attempt`);
      displayWindowMap.delete(display.id);
    }
  });
  
  // Log display information for debugging
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  console.log('Primary display:', primary);
  console.log('All displays:', displays);
});
