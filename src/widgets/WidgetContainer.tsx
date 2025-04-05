/// <reference path="../types/electron.d.ts" />
import React, { useEffect, useState } from 'react';

// Import the TelemetryWidget
import { TelemetryWidget } from './TelemetryWidget';

// Direct widget components for testing
const ClockWidgetComponent = (props: any) => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);
  
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full bg-gray-800 text-white">
      <div className="text-4xl font-bold">
        {time.toLocaleTimeString()}
      </div>
      <div className="text-md mt-2 text-gray-300">
        {time.toDateString()}
      </div>
    </div>
  );
};

const WeatherWidgetComponent = (props: any) => {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full bg-gray-800 text-white">
      <div className="text-xl font-semibold mb-2">Weather</div>
      <div className="text-sm text-gray-300 mb-4">{props.location || 'Current Location'}</div>
      <div className="text-5xl">☀️</div>
      <div className="text-3xl font-bold mt-2">23°C</div>
      <div className="text-gray-300">Sunny</div>
    </div>
  );
};

// Add the TelemetryWidgetComponent - WITHOUT dropdown
const TelemetryWidgetComponent = (props: any) => {
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(props.metric || 'speed_kph');
  const wsRef = React.useRef<WebSocket | null>(null);
  
  // Update metric when props change
  useEffect(() => {
    if (props.metric && props.metric !== selectedMetric) {
      console.log(`Setting metric from props: ${props.metric}`);
      setSelectedMetric(props.metric);
    }
  }, [props.metric, selectedMetric]);
  
  useEffect(() => {
    // Connect to WebSocket
    const connectWebSocket = () => {
      const wsUrl = 'ws://localhost:8080';
      const ws = new WebSocket(wsUrl);
      
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
        setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };
      
      wsRef.current = ws;
    };
    
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);
  
  // Format the metric value for display
  const formatMetricValue = (metric: string, value: any): string => {
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
  };
  
  // Get a user-friendly name for the metric
  const getMetricName = (metric: string): string => {
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
  };
  
  if (!connected) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full bg-gray-800 text-white">
        <div className="text-red-400 font-bold mb-2">Disconnected</div>
        <div className="text-sm text-gray-300">Attempting to connect...</div>
      </div>
    );
  }
  
  if (!telemetryData) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full bg-gray-800 text-white">
        <div className="text-blue-400 font-bold mb-2">Connected</div>
        <div className="text-sm text-gray-300">Waiting for data...</div>
      </div>
    );
  }
  
  // Display the single selected metric
  return (
    <div className="p-4 flex flex-col h-full bg-gray-800 text-white">
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="text-lg font-semibold text-gray-300">
          {getMetricName(selectedMetric)}
        </div>
        <div className="text-4xl font-bold mt-2">
          {formatMetricValue(selectedMetric, telemetryData[selectedMetric])}
        </div>
      </div>
    </div>
  );
};

export const WidgetContainer: React.FC = () => {
  const [opacity, setOpacity] = useState(1);
  const [widgetId, setWidgetId] = useState('');
  const [widgetType, setWidgetType] = useState('');
  const [widgetParams, setWidgetParams] = useState<Record<string, any>>({});
  
  // On component mount, register for window messages
  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }
    
    // Enable dragging if available
    if (window.electronDrag) {
      console.log('Enabling widget dragging');
      window.electronDrag.enableDrag();
    } else {
      console.warn('Drag functionality not available');
    }
    
    // Get window parameters on load
    const getWindowParams = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        console.log('Raw URL:', window.location.href);
        console.log('Search string:', window.location.search);
        console.log('All URL params:', Array.from(searchParams.entries()));
        
        const id = searchParams.get('widgetId') || '';
        const type = searchParams.get('widgetType') || '';
        
        console.log('Window URL parameters:', { id, type });
        
        // Parse additional parameters
        const params: Record<string, any> = {};
        searchParams.forEach((value, key) => {
          // Skip the widget ID and type
          if (key !== 'widgetId' && key !== 'widgetType') {
            params[key] = value;
          }
        });
        
        setWidgetId(id);
        setWidgetType(type);
        setWidgetParams(params);
        
        console.log('Widget parameters:', params);
        
        // Listen for messages from the main process
        if (window.electronAPI) {
          // Set up event listeners
          window.electronAPI.on('widget:opacity', (opacity: number) => {
            console.log(`Setting widget opacity to ${opacity}`);
            setOpacity(opacity);
          });
          
          // Listen for widget:params events
          window.electronAPI.on('widget:params', (params: Record<string, any>) => {
            console.log('Received widget params update:', params);
            setWidgetParams(prev => ({ ...prev, ...params }));
          });
        }
      } catch (error) {
        console.error('Error getting window parameters:', error);
      }
    };
    
    getWindowParams();
    
    return () => {
      // Cleanup event listeners
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('widget:opacity');
        window.electronAPI.removeAllListeners('widget:params');
      }
    };
  }, []);
  
  // Render based on widget type
  const renderWidget = () => {
    console.log(`Rendering widget of type ${widgetType} with params:`, widgetParams);
    
    switch (widgetType) {
      case 'clock':
        return <ClockWidgetComponent {...widgetParams} />;
      case 'weather':
        return <WeatherWidgetComponent {...widgetParams} />;
      case 'telemetry':
        return <TelemetryWidgetComponent {...widgetParams} />;
      default:
        return (
          <div className="p-4">
            <h2>Unknown Widget Type: {widgetType}</h2>
            <div>ID: {widgetId}</div>
            <pre>{JSON.stringify(widgetParams, null, 2)}</pre>
          </div>
        );
    }
  };
  
  return (
    <div className="widget-window" style={{ opacity }}>
      <div 
        className="h-screen w-screen overflow-hidden bg-transparent cursor-move"
        style={{ 
          // For Electron drag support
          // @ts-ignore
          WebkitAppRegion: 'drag'
        }}
      >
        {renderWidget()}
      </div>
    </div>
  );
}; 