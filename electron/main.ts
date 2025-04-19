import { app, BrowserWindow, ipcMain, screen, globalShortcut, dialog } from 'electron';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';

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

// Reference to the Rust backend process
let rustBackendProcess: ChildProcess | null = null;

// Track if we're already in the quit process to prevent loops
let isQuitting = false;

// Add a debug log function with timestamps
function debugLog(...args: any[]) {
  try {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] DEBUG:`, ...args);
  } catch (error) {
    // If console.log fails, try using stderr directly
    try {
      const timestamp = new Date().toISOString();
      const message = `[${timestamp}] DEBUG: ${args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
      ).join(' ')}\n`;
      process.stderr.write(message);
    } catch (stderr_error) {
      // At this point we can't do much more
    }
  }
}

// Function to check if the WebSocket server is running
async function isWebSocketServerRunning(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    // Use ES module-compatible import instead of require
    import('net').then(net => {
      const client = new net.default.Socket();
      
      client.setTimeout(1000);
      
      client.on('connect', () => {
        client.destroy();
        console.log(`WebSocket server is running on port ${port}`);
        resolve(true);
      });
      
      client.on('timeout', () => {
        client.destroy();
        console.log(`Timeout connecting to WebSocket server on port ${port}`);
        resolve(false);
      });
      
      client.on('error', (err) => {
        client.destroy();
        console.log(`WebSocket server is not running on port ${port}: ${err.message}`);
        resolve(false);
      });
      
      client.connect(port, 'localhost');
    }).catch(err => {
      console.error('Error importing net module:', err);
      resolve(false);
    });
  });
}

// Function to wait for the WebSocket server to be ready
async function waitForWebSocketServer(maxAttempts = 10): Promise<boolean> {
  console.log('Waiting for WebSocket server to start...');
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`Checking WebSocket server (attempt ${attempt}/${maxAttempts})...`);
    
    if (await isWebSocketServerRunning(8080)) {
      console.log('WebSocket server is running!');
      return true;
    }
    
    // Wait before checking again
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.error(`WebSocket server did not start after ${maxAttempts} attempts`);
  return false;
}

// Function to show an error dialog
function showErrorDialog(title: string, message: string, detail?: string) {
  if (app.isReady()) {
    dialog.showErrorBox(title, `${message}\n\n${detail || ''}`);
  } else {
    app.on('ready', () => {
      dialog.showErrorBox(title, `${message}\n\n${detail || ''}`);
    });
  }
}

// Function to start the Rust backend with retry functionality
async function startRustBackend(retryCount = 3): Promise<boolean> {
  try {
    debugLog('Starting Rust backend initialization');
    // Determine the path to the Rust binary
    let rustBinaryPath: string;
    let binaryExists = false;

    debugLog('Process environment:', {
      cwd: process.cwd(),
      resourcesPath: process.resourcesPath,
      isPackaged: app.isPackaged,
      platform: process.platform
    });

    // In production, use the binary from the app's resources
    if (app.isPackaged) {
      rustBinaryPath = path.join(process.resourcesPath, 'rust_backend', process.platform === 'win32' ? 'speedforge.exe' : 'speedforge');
      binaryExists = fs.existsSync(rustBinaryPath);
      debugLog(`Production Rust binary path: ${rustBinaryPath}, exists: ${binaryExists}`);
    } 
    
    // In development, try multiple possible paths
    if (!app.isPackaged || !binaryExists) {
      // List of possible binary locations in development
      const possiblePaths = [
        // Debug build
        path.join(process.cwd(), 'rust_app', 'target', 'debug', process.platform === 'win32' ? 'speedforge.exe' : 'speedforge'),
        // Release build
        path.join(process.cwd(), 'rust_app', 'target', 'release', process.platform === 'win32' ? 'speedforge.exe' : 'speedforge'),
        // Relative paths from electron directory
        path.join(__dirname, '..', 'rust_app', 'target', 'debug', process.platform === 'win32' ? 'speedforge.exe' : 'speedforge'),
        path.join(__dirname, '..', 'rust_app', 'target', 'release', process.platform === 'win32' ? 'speedforge.exe' : 'speedforge'),
        // Windows-specific paths that might be used
        path.join('rust_app', 'target', 'debug', 'speedforge.exe'),
        path.join('rust_app', 'target', 'release', 'speedforge.exe')
      ];

      // Log all paths we're checking
      debugLog('Checking for Rust binary at these locations:');
      possiblePaths.forEach(p => {
        const exists = fs.existsSync(p);
        debugLog(` - ${p} (exists: ${exists})`);
        if (exists) {
          try {
            const stats = fs.statSync(p);
            debugLog(`   - File stats: size=${stats.size}, mode=${stats.mode.toString(8)}, isExecutable=${stats.mode & 0o111}`);
          } catch (err) {
            debugLog(`   - Error getting file stats: ${err}`);
          }
        }
      });

      // Find the first path that exists
      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          rustBinaryPath = p;
          binaryExists = true;
          debugLog(`Found Rust binary at: ${rustBinaryPath}`);
          break;
        }
      }
    }

    // If binary still doesn't exist, log error and show dialog
    if (!binaryExists) {
      const errorMsg = 'ERROR: Rust binary not found at any expected location!';
      debugLog(errorMsg);
      console.error(errorMsg);
      console.error('Current working directory:', process.cwd());
      
      showErrorDialog(
        'Rust Backend Not Found', 
        'The application could not find the Rust backend executable.',
        'The application will continue to run, but some features may not work correctly.'
      );
      
      return false;
    }

    debugLog(`Starting Rust backend from: ${rustBinaryPath}`);
    debugLog(`Working directory will be: ${path.dirname(rustBinaryPath)}`);

    // Start the Rust process with explicit working directory and args
    rustBackendProcess = spawn(rustBinaryPath, ['--verbose'], {
      stdio: 'pipe', // Capture stdout and stderr
      detached: false, // Keep attached to the parent process
      cwd: path.dirname(rustBinaryPath), // Set working directory to binary location
      env: { 
        ...process.env,
        // Add any environment variables needed by the Rust app
        RUST_LOG: 'debug',
        RUST_BACKTRACE: '1'
      },
      windowsHide: false // Show console window on Windows for debugging
    });

    if (!rustBackendProcess || !rustBackendProcess.pid) {
      throw new Error('Failed to start Rust process - no process handle or PID');
    }

    debugLog(`Rust process started with PID: ${rustBackendProcess.pid}`);

    // Log process output
    if (rustBackendProcess.stdout) {
      rustBackendProcess.stdout.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`Rust backend stdout: ${output}`);
      });
    } else {
      debugLog('WARNING: Rust process stdout is null');
    }

    if (rustBackendProcess.stderr) {
      rustBackendProcess.stderr.on('data', (data) => {
        const output = data.toString().trim();
        console.error(`Rust backend stderr: ${output}`);
      });
    } else {
      debugLog('WARNING: Rust process stderr is null');
    }

    // Handle process exit
    rustBackendProcess.on('exit', (code, signal) => {
      debugLog(`Rust backend exited with code ${code} and signal ${signal}`);
      rustBackendProcess = null;
    });

    // Handle process error
    rustBackendProcess.on('error', (err) => {
      debugLog(`Failed to start Rust backend: ${err.message}`, err);
      console.error('Failed to start Rust backend:', err);
      rustBackendProcess = null;
    });

    // Check if process is still running after a short delay
    return new Promise<boolean>((resolve) => {
      setTimeout(() => {
        if (rustBackendProcess && rustBackendProcess.exitCode === null) {
          // Process is still running
          debugLog('Rust process is running successfully');
          resolve(true);
        } else {
          debugLog('Rust process failed to start or exited immediately');
          
          // Retry if we have attempts left
          if (retryCount > 0) {
            debugLog(`Retrying... (${retryCount} attempts left)`);
            resolve(startRustBackend(retryCount - 1));
          } else {
            showErrorDialog(
              'Rust Backend Failed', 
              'The Rust backend process failed to start after multiple attempts.',
              'The application will continue to run, but some features may not work correctly.'
            );
            resolve(false);
          }
        }
      }, 1000);
    });

  } catch (error) {
    debugLog(`Error starting Rust backend: ${error}`);
    console.error('Error starting Rust backend:', error);
    
    // Retry if we have attempts left
    if (retryCount > 0) {
      debugLog(`Retrying... (${retryCount} attempts left)`);
      return startRustBackend(retryCount - 1);
    }
    
    showErrorDialog(
      'Rust Backend Error', 
      'There was an error starting the Rust backend.',
      error instanceof Error ? error.message : String(error)
    );
    
    return false;
  }
}

// Function to stop the Rust backend
function stopRustBackend() {
  if (rustBackendProcess) {
    console.log('Stopping Rust backend...');
    
    try {
      // First try to kill it gracefully
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', rustBackendProcess.pid.toString(), '/f', '/t']);
      } else {
        rustBackendProcess.kill('SIGTERM');
        
        // Give it some time to terminate gracefully
        setTimeout(() => {
          if (rustBackendProcess) {
            // If still running, force kill
            rustBackendProcess.kill('SIGKILL');
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error stopping Rust backend:', error);
    }
    
    rustBackendProcess = null;
  }
}

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
      try {
        // Check if the window is still valid
        if (win.isDestroyed()) {
          console.warn('Window was destroyed before we could send display:id');
          return;
        }
        
        // Send display ID to the renderer process
        win.webContents.send('display:id', display.id);
        
        // Check again if the window is still valid
        if (win.isDestroyed()) {
          console.warn('Window was destroyed before we could send app:initial-state');
          return;
        }
        
        // Send initial UI state to the renderer
        win.webContents.send('app:initial-state', {
          clickThrough: true,
          controlPanelHidden: true
        });
      } catch (error) {
        // Log error using the safer debugLog function
        try {
          debugLog('Error in did-finish-load handler:', error);
        } catch (loggingError) {
          process.stderr.write(`Error in did-finish-load handler: ${error}\n`);
        }
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

// Send message to renderer safely with error handling
function safelySendToRenderer(win: BrowserWindow, channel: string, data: any) {
  try {
    if (!win || win.isDestroyed() || !win.webContents) {
      debugLog(`Cannot send ${channel} - window is invalid`);
      return false;
    }
    
    win.webContents.send(channel, data);
    return true;
  } catch (error) {
    try {
      debugLog(`Error sending ${channel} to renderer:`, error);
    } catch (loggingError) {
      process.stderr.write(`Error sending ${channel} to renderer: ${error}\n`);
    }
    return false;
  }
}

// Toggle click-through for all windows safely
function toggleClickThroughForAllWindows(newState: boolean) {
  try {
    // Track success status
    let allSucceeded = true;
    
    for (const win of windows) {
      try {
        if (win.isDestroyed()) continue;
        
        // Update window title with state for tracking
        win.setTitle(`Speedforge (click-through:${newState})`);
        
        // Send message to renderer
        const sendSuccess = safelySendToRenderer(win, 'app:toggle-click-through', newState);
        if (!sendSuccess) {
          allSucceeded = false;
        }
      } catch (windowError) {
        debugLog(`Error toggling click-through for window:`, windowError);
        allSucceeded = false;
      }
    }
    
    return allSucceeded;
  } catch (error) {
    debugLog('Error in toggleClickThroughForAllWindows:', error);
    return false;
  }
}

// Setup basic IPC listeners
function setupIpcListeners() {
  // Quit the application
  ipcMain.handle('app:quit', () => {
    console.log('Quitting application');
    try {
      // If already quitting, don't do duplicate work
      if (isQuitting) {
        return { success: true };
      }
      
      isQuitting = true;
      
      // Notify all windows to close their WebSocket connections first
      for (const win of windows) {
        if (!win.isDestroyed()) {
          try {
            // Send message to renderers to close WebSocket connections
            win.webContents.send('app:before-quit');
          } catch (err) {
            console.error('Error sending before-quit notification:', err);
          }
        }
      }
      
      // Give a short delay for connections to close
      setTimeout(() => {
        // Try to close all windows
        for (const win of windows) {
          if (!win.isDestroyed()) {
            win.close();
          }
        }
        
        // Clear out the windows array
        windows.length = 0;
        
        // Exit directly to avoid triggering more before-quit events
        setTimeout(() => {
          try {
            // Use process.exit instead of app.quit to avoid additional before-quit events
            process.exit(0);
          } catch (error) {
            console.log('Error during process.exit():', error);
            // Force exit as a last resort
            process.exit(1);
          }
        }, 100);
      }, 300); // Wait for WebSocket connections to close
      
      return { success: true };
    } catch (error) {
      console.error('Error during quit process:', error);
      // Force exit as a last resort
      process.exit(1);
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

  // Configuration handlers
  ipcMain.handle('config:save', async (event, type: string, name: string, data: any) => {
    try {
      debugLog(`Saving config: type=${type}, name=${name}, size=${JSON.stringify(data).length}`);
      
      const userDataPath = app.getPath('userData');
      const configDir = path.join(userDataPath, 'configs', type);
      
      // Ensure directory exists
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      
      const configPath = path.join(configDir, `${name}.json`);
      fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
      
      debugLog(`Config saved successfully to ${configPath}`);
      return true;
    } catch (error) {
      debugLog('Error saving config:', error);
      return false;
    }
  });

  ipcMain.handle('config:load', async (event, type: string, name: string) => {
    try {
      debugLog(`Loading config: type=${type}, name=${name}`);
      
      const userDataPath = app.getPath('userData');
      const configPath = path.join(userDataPath, 'configs', type, `${name}.json`);
      
      if (!fs.existsSync(configPath)) {
        debugLog(`Config file does not exist: ${configPath}`);
        return null;
      }
      
      const data = fs.readFileSync(configPath, 'utf8');
      const result = JSON.parse(data);
      debugLog(`Config loaded successfully from ${configPath}`);
      return result;
    } catch (error) {
      debugLog('Error loading config:', error);
      return null;
    }
  });

  ipcMain.handle('config:list', async (event, type: string) => {
    try {
      debugLog(`Listing configs for type: ${type}`);
      
      const userDataPath = app.getPath('userData');
      const configDir = path.join(userDataPath, 'configs', type);
      
      if (!fs.existsSync(configDir)) {
        debugLog(`Config directory does not exist: ${configDir}`);
        return [];
      }
      
      const files = fs.readdirSync(configDir)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
      
      debugLog(`Found ${files.length} config files: ${files.join(', ')}`);
      return files;
    } catch (error) {
      debugLog('Error listing configs:', error);
      return [];
    }
  });

  ipcMain.handle('config:delete', async (event, type: string, name: string) => {
    try {
      debugLog(`Deleting config: type=${type}, name=${name}`);
      
      const userDataPath = app.getPath('userData');
      const configPath = path.join(userDataPath, 'configs', type, `${name}.json`);
      
      if (!fs.existsSync(configPath)) {
        debugLog(`Config file does not exist: ${configPath}`);
        return false;
      }
      
      fs.unlinkSync(configPath);
      debugLog(`Config deleted successfully: ${configPath}`);
      return true;
    } catch (error) {
      debugLog('Error deleting config:', error);
      return false;
    }
  });

  ipcMain.handle('app:getUserDataPath', async () => {
    try {
      const userDataPath = app.getPath('userData');
      return userDataPath;
    } catch (error) {
      console.error('Error getting user data path:', error);
      return '';
    }
  });

  // Debug handler to list files in config directory
  ipcMain.handle('debug:listConfigFiles', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const configDir = path.join(userDataPath, 'configs');
      
      if (!fs.existsSync(configDir)) {
        return { success: false, message: 'Config directory does not exist', files: [] };
      }
      
      // Get all subdirectories in the configs directory
      const subdirs = fs.readdirSync(configDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
      
      const result: Record<string, string[]> = {};
      
      // For each subdirectory, get all files
      for (const subdir of subdirs) {
        const subdirPath = path.join(configDir, subdir);
        const files = fs.readdirSync(subdirPath)
          .filter(file => file.endsWith('.json'));
        
        result[subdir] = files;
      }
      
      return { 
        success: true, 
        path: configDir,
        subdirectories: subdirs,
        files: result
      };
    } catch (error) {
      console.error('Error listing config files:', error);
      return { 
        success: false, 
        message: (error as Error).message, 
        files: {} 
      };
    }
  });
}

// Clean up all IPC handlers
function cleanupIpcHandlers() {
  console.log('Cleaning up IPC handlers...');
  
  // Clean up app handlers
  ipcMain.removeHandler('app:quit');
  ipcMain.removeHandler('app:toggleClickThrough');
  ipcMain.removeHandler('app:toggleAutoNewWindows');
  ipcMain.removeHandler('app:closeWindowForDisplay');
  ipcMain.removeHandler('app:getDisplays');
  ipcMain.removeHandler('app:getCurrentDisplayId');
  ipcMain.removeHandler('app:getUserDataPath');
  
  // Clean up widget handlers
  ipcMain.removeHandler('widget:create');
  ipcMain.removeHandler('widget:close');
  ipcMain.removeHandler('widget:getAll');
  ipcMain.removeHandler('widget:setPosition');
  ipcMain.removeHandler('widget:setSize');
  ipcMain.removeHandler('widget:setAlwaysOnTop');
  ipcMain.removeHandler('widget:setOpacity');
  ipcMain.removeHandler('widget:setVisible');
  ipcMain.removeHandler('widget:updateParams');
  
  // Clean up configuration handlers
  ipcMain.removeHandler('config:save');
  ipcMain.removeHandler('config:load');
  ipcMain.removeHandler('config:list');
  ipcMain.removeHandler('config:delete');

  // Clean up debug handler
  ipcMain.removeHandler('debug:listConfigFiles');
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
  // If we're already in the quit process, don't do this again
  if (isQuitting) return;
  
  console.log('App is quitting, cleaning up resources...');
  isQuitting = true;
  
  // Stop the Rust backend
  stopRustBackend();
  
  console.log('Performing cleanup before quit');
  
  // Clear the stay-on-top interval
  if (stayOnTopInterval) {
    clearInterval(stayOnTopInterval);
    stayOnTopInterval = null;
  }
  
  // Unregister global shortcuts
  globalShortcut.unregisterAll();
  
  // Remove all IPC handlers
  cleanupIpcHandlers();
  
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
app.whenReady().then(async () => {
  // Set application name for process manager
  app.setName('Speedforge');
  
  // Initialize the speech module
  initSpeechModule();
  
  // Start the Rust backend and wait for it to be ready
  debugLog('Starting Rust backend process');
  const rustStarted = await startRustBackend();
  debugLog(`Rust backend started: ${rustStarted}`);
  
  // Wait for the WebSocket server to start before creating windows
  if (rustStarted) {
    debugLog('Waiting for WebSocket server to become available');
    const wsServerRunning = await waitForWebSocketServer(20); // Try 20 times (10 seconds)
    if (!wsServerRunning) {
      debugLog('WebSocket server didn\'t start, but continuing anyway...');
      // Show a warning dialog
      showErrorDialog(
        'WebSocket Server Warning',
        'The WebSocket server did not start properly.',
        'The application will continue to run, but some features may not work correctly.'
      );
    } else {
      debugLog('WebSocket server is running properly');
    }
  } else {
    debugLog('Skipping WebSocket server check since Rust backend failed to start');
  }
  
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
    try {
      debugLog('Global Ctrl+Space shortcut triggered');
      
      // Get current click-through state from the first window (if any)
      let isCurrentlyClickThrough = true;
      if (windows.length > 0 && !windows[0].isDestroyed()) {
        isCurrentlyClickThrough = windows[0].getTitle().includes('click-through:true');
      }
      
      // Toggle to opposite state
      const newState = !isCurrentlyClickThrough;
      debugLog(`Global shortcut toggling click-through from ${isCurrentlyClickThrough} to ${newState}`);
      
      // Apply the new state to all windows
      toggleClickThroughForAllWindows(newState);
    } catch (error) {
      // Use the debugLog function which is more robust
      try {
        debugLog('Error in global shortcut handler:', error);
      } catch (loggingError) {
        // If even debugLog fails, last resort is to write to stderr directly
        process.stderr.write(`Error in global shortcut handler: ${error}\n`);
      }
    }
  });
  
  // Setup screen event listeners now that the app is ready
  screen.on('display-added', (event, display) => {
    try {
      debugLog('New display detected:', display);
      
      // Only create window if auto-create is enabled
      if (!autoCreateWindowsForNewDisplays) {
        debugLog('Auto-create new windows is disabled, skipping window creation for new display');
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
      
      // Send initial UI state when the window is loaded
      win.webContents.on('did-finish-load', () => {
        try {
          // Check if the window is still valid
          if (win.isDestroyed()) {
            console.warn('Window was destroyed before we could send display:id');
            return;
          }
          
          // Send display ID to the renderer process
          win.webContents.send('display:id', display.id);
          
          // Check again if the window is still valid
          if (win.isDestroyed()) {
            console.warn('Window was destroyed before we could send app:initial-state');
            return;
          }
          
          // Send initial UI state to the renderer
          win.webContents.send('app:initial-state', {
            clickThrough: true,
            controlPanelHidden: true
          });
        } catch (error) {
          // Log error using the safer debugLog function
          try {
            debugLog('Error in did-finish-load handler:', error);
          } catch (loggingError) {
            process.stderr.write(`Error in did-finish-load handler: ${error}\n`);
          }
        }
      });
      
      // Store the window reference
      windows.push(win);
      
      // Map this window to its display ID
      displayWindowMap.set(display.id, win);
      
      // Store the display ID in the window's metadata for reference
      (win as any).displayId = display.id;
      
      debugLog(`Created new window for display ${display.id}`);
    } catch (error) {
      try {
        debugLog('Error handling display-added event:', error);
      } catch (loggingError) {
        process.stderr.write(`Error handling display-added event: ${error}\n`);
      }
    }
  });

  screen.on('display-removed', (event, display) => {
    try {
      debugLog('Display removed:', display);
      
      // Get window before attempting to close it
      const win = displayWindowMap.get(display.id);
      
      // Close the window associated with this display
      const result = closeWindowForDisplay(display.id);
      debugLog(`Window for removed display ${display.id} was ${result ? 'closed' : 'not found or could not be closed'}`);
      
      // Force additional cleanup if the window was found but not properly closed
      if (!result && win && !win.isDestroyed()) {
        debugLog(`Forcing additional cleanup for display ${display.id}`);
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
          debugLog(`Error during forced cleanup for display ${display.id}:`, cleanupError);
        }
      }
    } catch (error) {
      try {
        debugLog('Error handling display-removed event:', error);
      } catch (loggingError) {
        process.stderr.write(`Error handling display-removed event: ${error}\n`);
      }
    }
  });
  
  // Log display information for debugging
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  console.log('Primary display:', primary);
  console.log('All displays:', displays);
});
