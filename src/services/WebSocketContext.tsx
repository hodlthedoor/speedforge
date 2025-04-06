import React, { createContext, useContext, useState, useEffect } from 'react';
import { WebSocketService } from './WebSocketService';

// Create the context
interface WebSocketContextType {
  webSocketService: WebSocketService;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

// Hook to use the WebSocketService from context
export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context.webSocketService;
};

// Provider component
export const WebSocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize WebSocketService once when the provider mounts
  const [webSocketService] = useState(() => WebSocketService.getInstance());

  // Set up IPC forwarding for electron
  useEffect(() => {
    if (!window.electronAPI) return;

    // Forward telemetry data to the main process for IPC widgets
    webSocketService.addDataListener('global-ipc-forward', (data) => {
      window.electronAPI.send('telemetry:update', data);
    });
    
    // Forward connection status to the main process for IPC widgets
    webSocketService.addConnectionListener('global-ipc-forward', (connected) => {
      window.electronAPI.send('telemetry:connectionChange', connected);
    });
    
    // Clean up on unmount
    return () => {
      webSocketService.removeListeners('global-ipc-forward');
    };
  }, [webSocketService]);

  return (
    <WebSocketContext.Provider value={{ webSocketService }}>
      {children}
    </WebSocketContext.Provider>
  );
}; 