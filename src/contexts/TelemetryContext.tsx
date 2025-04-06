import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WebSocketService } from '../services/WebSocketService';

// Define the shape of our telemetry data
interface TelemetryData {
  [key: string]: any;
}

// Define the shape of our context
interface TelemetryContextType {
  telemetryData: TelemetryData | null;
  isConnected: boolean;
  lastUpdated: Date | null;
  updateInterval: number;
  setUpdateInterval: (interval: number) => void;
  connect: (url?: string) => Promise<boolean>;
  disconnect: () => void;
}

// Create the context with a default value
const TelemetryContext = createContext<TelemetryContextType>({
  telemetryData: null,
  isConnected: false,
  lastUpdated: null,
  updateInterval: 1000,
  setUpdateInterval: () => {},
  connect: async () => false,
  disconnect: () => {},
});

// Provider component
export const TelemetryProvider: React.FC<{ children: ReactNode, initialUrl?: string }> = ({ 
  children, 
  initialUrl 
}) => {
  const [telemetryData, setTelemetryData] = useState<TelemetryData | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [updateInterval, setUpdateInterval] = useState<number>(1000);
  const [wsService] = useState(() => WebSocketService.getInstance());
  
  // Handle data updates
  const handleDataUpdate = (data: TelemetryData) => {
    setTelemetryData(data);
    setLastUpdated(new Date());
  };
  
  // Handle connection status changes
  const handleConnectionChange = (connected: boolean) => {
    setIsConnected(connected);
    
    // If disconnected, clear the telemetry data
    if (!connected) {
      setTelemetryData(null);
    }
  };
  
  // Connect to the WebSocket server
  const connect = async (url?: string): Promise<boolean> => {
    try {
      const connected = await wsService.connect(url || initialUrl);
      return connected;
    } catch (error) {
      console.error('Failed to connect to telemetry service:', error);
      return false;
    }
  };
  
  // Disconnect from the WebSocket server
  const disconnect = () => {
    wsService.disconnect();
  };
  
  // Set up event listeners when the component mounts
  useEffect(() => {
    // Set up global listeners for telemetry data
    wsService.addDataListener('telemetry-context', handleDataUpdate);
    wsService.addConnectionListener('telemetry-context', handleConnectionChange);
    
    // Automatically connect if initialUrl is provided
    if (initialUrl) {
      connect(initialUrl).catch(console.error);
    }
    
    // Clean up event listeners when the component unmounts
    return () => {
      wsService.removeListeners('telemetry-context');
    };
  }, []);
  
  // Set the update interval on the WebSocket service
  useEffect(() => {
    wsService.setUpdateInterval(updateInterval);
  }, [updateInterval]);
  
  // Provide the telemetry data and functions to consumers
  const value: TelemetryContextType = {
    telemetryData,
    isConnected,
    lastUpdated,
    updateInterval,
    setUpdateInterval,
    connect,
    disconnect,
  };
  
  return (
    <TelemetryContext.Provider value={value}>
      {children}
    </TelemetryContext.Provider>
  );
};

// Custom hook for consuming the context
export const useTelemetry = () => {
  const context = useContext(TelemetryContext);
  
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  
  return context;
}; 