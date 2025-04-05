/// <reference path="../types/electron.d.ts" />
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { BaseWidgetProps } from './BaseWidget';
import { withWidgetRegistration } from './WidgetManager';

// Extend WidgetState to include telemetry-specific properties
declare module './BaseWidget' {
  interface WidgetState {
    selectedMetric: string;
  }
}

interface TelemetryWidgetProps extends BaseWidgetProps {
  metric?: string; // Default metric to display
}

// Telemetry widget as a function component with hooks
function TelemetryWidgetBase(props: TelemetryWidgetProps) {
  // Get initial metric from URL or props
  const getInitialMetric = () => {
    // Check URL parameters first (highest priority)
    let initialMetric = props.metric || 'speed_kph';
    
    // When in Electron, check URL parameters
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const metricParam = searchParams.get('metric');
      if (metricParam) {
        console.log(`Found metric in URL parameters: ${metricParam}`);
        initialMetric = metricParam;
      }
    }
    
    console.log(`TelemetryWidget initialized with metric: ${initialMetric}`);
    return initialMetric;
  };

  // State hooks
  const [selectedMetric, setSelectedMetric] = useState<string>(getInitialMetric());
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [connected, setConnected] = useState<boolean>(false);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  // Connect to WebSocket for telemetry data
  const connectWebSocket = useCallback(() => {
    const wsUrl = 'ws://localhost:8080';
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('Connected to telemetry WebSocket');
        setConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setTelemetryData(data);
        } catch (error) {
          console.error('Failed to parse telemetry data:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected from telemetry WebSocket');
        setConnected(false);
        
        // Try to reconnect after a delay
        reconnectTimerRef.current = window.setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  }, []);

  // Disconnect WebSocket
  const disconnectWebSocket = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Initial setup
  useEffect(() => {
    // Connect to WebSocket
    connectWebSocket();
    
    // Set up listener for parameter updates
    if (window.electronAPI) {
      console.log(`Widget ${props.id}: Setting up widget:params listener`);
      window.electronAPI.on('widget:params', (params) => {
        console.log(`Widget ${props.id}: Received widget:params event:`, params);
        
        // Update metric if provided
        if (params.metric && params.metric !== selectedMetric) {
          console.log(`Updating metric from ${selectedMetric} to ${params.metric}`);
          setSelectedMetric(params.metric);
        }
      });
    }
    
    // Cleanup function
    return () => {
      console.log(`Widget ${props.id} unmounting`);
      disconnectWebSocket();
      
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('widget:params');
      }
    };
  }, [props.id, connectWebSocket, disconnectWebSocket, selectedMetric]);

  // Update based on prop changes
  useEffect(() => {
    if (props.metric && props.metric !== selectedMetric) {
      console.log(`Metric prop changed to ${props.metric}`);
      setSelectedMetric(props.metric);
    }
  }, [props.metric, selectedMetric]);

  // Format the metric value for display
  const formatMetricValue = useCallback((metric: string, value: any): string => {
    if (value === undefined || value === null) {
      return 'N/A';
    }
    
    // Format based on metric type
    switch (metric) {
      case 'speed_kph':
        return `${value.toFixed(1)} km/h`;
      case 'speed_mph':
        return `${value.toFixed(1)} mph`;
      case 'rpm':
        return `${value.toFixed(0)} RPM`;
      case 'throttle_pct':
      case 'brake_pct':
      case 'clutch_pct':
      case 'fuel_pct':
        return `${value.toFixed(1)}%`;
      case 'gear':
        return value;
      case 'g_force_lat':
      case 'g_force_lon':
        return `${value.toFixed(2)}G`;
      case 'current_lap_time':
      case 'last_lap_time':
      case 'best_lap_time':
        // Format time as mm:ss.ms
        const minutes = Math.floor(value / 60);
        const seconds = value % 60;
        return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
      case 'fuel_level':
        return `${value.toFixed(1)}L`;
      case 'position':
      case 'lap_completed':
        return `${value}`;
      default:
        return `${value}`;
    }
  }, []);

  // Get a user-friendly name for the metric
  const getMetricName = useCallback((metric: string): string => {
    const metricNames: Record<string, string> = {
      'speed_kph': 'Speed (KPH)',
      'speed_mph': 'Speed (MPH)',
      'rpm': 'RPM',
      'gear': 'Gear',
      'throttle_pct': 'Throttle',
      'brake_pct': 'Brake',
      'clutch_pct': 'Clutch',
      'g_force_lat': 'Lateral G',
      'g_force_lon': 'Longitudinal G',
      'fuel_level': 'Fuel Level',
      'fuel_pct': 'Fuel Percentage',
      'current_lap_time': 'Current Lap',
      'last_lap_time': 'Last Lap',
      'best_lap_time': 'Best Lap',
      'position': 'Position',
      'lap_completed': 'Lap'
    };
    
    return metricNames[metric] || metric;
  }, []);

  // Render telemetry content
  const renderTelemetryContent = () => {
    if (!connected) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-red-500 font-bold mb-2">Disconnected</div>
          <div className="text-sm">Attempting to connect...</div>
        </div>
      );
    }
    
    if (!telemetryData) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-blue-500 font-bold mb-2">Connected</div>
          <div className="text-sm">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-lg font-semibold">
          {getMetricName(selectedMetric)}
        </div>
        <div className="text-4xl font-bold mt-2">
          {formatMetricValue(selectedMetric, telemetryData[selectedMetric])}
        </div>
      </div>
    );
  };

  // Render the component
  return (
    <div className="widget-container rounded-lg overflow-hidden bg-gray-800 text-white draggable relative"
         style={{ 
           width: `${props.defaultWidth || 300}px`, 
           height: `${props.defaultHeight || 200}px`,
         }}>
      {renderTelemetryContent()}
    </div>
  );
}

// Use a simple wrapper to make the function component look like a class component for withWidgetRegistration
// Create a higher-order component for widget registration
export const TelemetryWidget = withWidgetRegistration<TelemetryWidgetProps>(
  TelemetryWidgetBase as any, 'telemetry'
); 