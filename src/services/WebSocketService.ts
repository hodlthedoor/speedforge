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
  private url: string;

  private constructor(url: string = 'ws://localhost:8080') {
    this.url = url;
    this.connect();
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
    try {
      console.log('WebSocketService: Connecting to', this.url);
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log('WebSocketService: Connected');
        this.connected = true;
        this.notifyConnectionListeners(true);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.notifyDataListeners(data);
        } catch (error) {
          console.error('WebSocketService: Failed to parse data:', error);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocketService: Disconnected');
        this.connected = false;
        this.notifyConnectionListeners(false);

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
    for (const callbacks of this.listeners.values()) {
      for (const callback of callbacks) {
        callback(data);
      }
    }
  }

  /**
   * Notify all connection listeners about connection status
   * @param connected Whether the WebSocket is connected
   */
  private notifyConnectionListeners(connected: boolean): void {
    for (const callbacks of this.connectionListeners.values()) {
      for (const callback of callbacks) {
        callback(connected);
      }
    }
  }

  /**
   * Check if the WebSocket is currently connected
   */
  public isConnected(): boolean {
    return this.connected;
  }

  /**
   * Close the WebSocket connection
   */
  public close(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.listeners.clear();
    this.connectionListeners.clear();
  }
}

export default WebSocketService; 