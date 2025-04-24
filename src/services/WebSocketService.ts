/**
 * WebSocketService - Singleton service for managing a shared WebSocket connection
 */
export class WebSocketService {
  private static instance: WebSocketService;
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  private connectionListeners: Map<string, ((connected: boolean) => void)[]> = new Map();
  private connected: boolean = false;
  private lastReceivedData: any = null;
  private url: string;
  private isWidgetWindow: boolean;
  private connectionInProgress: boolean = false;

  private constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
    
    // Skip WebSocket connection in widget windows
    this.isWidgetWindow = window.location.search.includes('widgetId=') && 
                        window.location.search.includes('widgetType=');
    
    console.log(`WebSocketService initialized: ${this.isWidgetWindow ? 'Widget window - skipping connection' : 'Main window - connecting'}`);
    
    if (!this.isWidgetWindow) {
      this.connect();
    } else {
      console.log('WebSocketService: Running in widget window, WebSocket connection skipped');
    }
  }

  /**
   * Get the singleton instance of WebSocketService
   */
  public static getInstance(url?: string): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService(url);
    }
    return WebSocketService.instance;
  }

  /**
   * Connect to the WebSocket server
   */
  private connect(): void {
    // Skip creating a connection in widget windows
    if (this.isWidgetWindow) {
      console.log('WebSocketService: Not connecting in widget window mode');
      return;
    }
    
    // Prevent duplicate connection attempts
    if (this.connectionInProgress) {
      console.log('WebSocketService: Connection attempt already in progress, skipping');
      return;
    }
    
    this.connectionInProgress = true;
    
    try {
      console.log('WebSocketService: Connecting to', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocketService: Connected');
        this.connected = true;
        this.connectionInProgress = false;
        this.notifyConnectionListeners(true);
        
        // Broadcast connection status to widget windows
        if (window.electronAPI) {
          window.electronAPI.send('telemetry:connectionChange', true);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.lastReceivedData = data;
          this.notifyDataListeners(data);
          
          // Broadcast to widget windows via IPC
          if (window.electronAPI) {
            window.electronAPI.send('telemetry:update', data);
          }
        } catch (error) {
          console.error('WebSocketService: Failed to parse data:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocketService: Disconnected');
        this.connected = false;
        this.connectionInProgress = false;
        this.notifyConnectionListeners(false);
        
        // Broadcast connection status to widget windows
        if (window.electronAPI) {
          window.electronAPI.send('telemetry:connectionChange', false);
        }

        // Clear any existing reconnect timer
        if (this.reconnectTimer) {
          window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }

        // Try to reconnect after a delay
        this.reconnectTimer = window.setTimeout(() => {
          console.log('WebSocketService: Attempting to reconnect...');
          this.connect();
        }, 3000);
      };

      this.ws.onerror = (error) => {
        console.error('WebSocketService: Error:', error);
        this.ws?.close();
      };
    } catch (error) {
      console.error('WebSocketService: Failed to create WebSocket:', error);
    }
  }

  /**
   * Force a reconnection to the WebSocket server
   * Can be called manually to reconnect after an error
   */
  public reconnect(): void {
    console.log('WebSocketService: Manual reconnection requested');
    
    // Skip if in widget window mode
    if (this.isWidgetWindow) {
      console.log('WebSocketService: Not reconnecting in widget window mode');
      return;
    }
    
    // Skip if connection is already in progress
    if (this.connectionInProgress) {
      console.log('WebSocketService: Connection already in progress, skipping manual reconnection');
      return;
    }
    
    // Close existing connection if any
    if (this.ws) {
      console.log('WebSocketService: Closing existing connection');
      // Only close if it's already in an open state
      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        try {
          this.ws.close();
        } catch (err) {
          console.error('WebSocketService: Error closing WebSocket:', err);
        }
      }
      this.ws = null;
    }
    
    // Clear any pending reconnect timer
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Connect after a small delay to allow previous connections to clean up
    console.log('WebSocketService: Starting new connection');
    setTimeout(() => {
      this.connect();
    }, 500);
    
    return;
  }

  /**
   * Register a listener for data updates
   * @param id Unique ID for the listener (typically widget ID)
   * @param callback Function to call when data is received
   */
  public addDataListener(id: string, callback: (data: any) => void): void {
    if (!this.listeners.has(id)) {
      this.listeners.set(id, []);
    }
    this.listeners.get(id)?.push(callback);
    console.log(`WebSocketService: Added data listener for ${id}`);
    
    // If we already have data, immediately notify the new listener
    if (this.lastReceivedData) {
      callback(this.lastReceivedData);
    }
  }

  /**
   * Register a listener for connection status updates
   * @param id Unique ID for the listener (typically widget ID)
   * @param callback Function to call when connection status changes
   */
  public addConnectionListener(id: string, callback: (connected: boolean) => void): void {
    if (!this.connectionListeners.has(id)) {
      this.connectionListeners.set(id, []);
    }
    this.connectionListeners.get(id)?.push(callback);
    
    // Immediately notify the listener of the current connection status
    callback(this.connected);
    console.log(`WebSocketService: Added connection listener for ${id}`);
  }

  /**
   * Remove all listeners for a specific ID
   * @param id Unique ID for the listener to remove
   */
  public removeListeners(id: string): void {
    this.listeners.delete(id);
    this.connectionListeners.delete(id);
    console.log(`WebSocketService: Removed all listeners for ${id}`);
  }

  /**
   * Notify all data listeners about new data
   * @param data The data received from the WebSocket
   */
  private notifyDataListeners(data: any): void {
    // In widget windows, we don't notify listeners directly
    // as data will come through IPC
    if (this.isWidgetWindow) {
      return;
    }
    
    this.listeners.forEach((callbacks, id) => {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`WebSocketService: Error notifying listener ${id}:`, error);
        }
      });
    });
  }

  /**
   * Notify all connection listeners about connection status
   * @param connected Whether the WebSocket is connected
   */
  private notifyConnectionListeners(connected: boolean): void {
    // In widget windows, we don't notify listeners directly
    // as status will come through IPC
    if (this.isWidgetWindow) {
      return;
    }
    
    this.connectionListeners.forEach((callbacks, id) => {
      callbacks.forEach(callback => {
        try {
          callback(connected);
        } catch (error) {
          console.error(`WebSocketService: Error notifying connection listener ${id}:`, error);
        }
      });
    });
  }

  /**
   * Check if the WebSocket is currently connected
   */
  public isConnected(): boolean {
    return this.connected;
  }
  
  /**
   * Get the last received telemetry data
   */
  public getLastData(): any {
    return this.lastReceivedData;
  }

  /**
   * Close the WebSocket connection
   */
  public close(): void {
    console.log('WebSocketService: Closing connection');
    
    if (this.ws) {
      // Remove all event listeners to prevent any reconnection attempts
      this.ws.onclose = null;
      this.ws.onerror = null;
      this.ws.onmessage = null;
      this.ws.onopen = null;
      
      // Set connection status to disconnected before closing
      this.connected = false;
      this.notifyConnectionListeners(false);
      
      // Close the connection with code 1000 (normal closure)
      this.ws.close(1000, "Application closing");
      console.log('WebSocketService: WebSocket connection closed');
      this.ws = null;
    } else {
      console.log('WebSocketService: No active connection to close');
    }

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
      console.log('WebSocketService: Cleared reconnect timer');
    }

    this.listeners.clear();
    this.connectionListeners.clear();
    console.log('WebSocketService: Cleared all listeners');
  }

  /**
   * Check if we're running in a widget window
   */
  public runningInWidgetWindow(): boolean {
    return this.isWidgetWindow;
  }
}

export default WebSocketService; 