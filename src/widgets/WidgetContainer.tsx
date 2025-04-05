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
    <div className="p-4 flex flex-col items-center justify-center h-full">
      <div className="text-4xl font-bold">
        {time.toLocaleTimeString()}
      </div>
      <div className="text-md mt-2">
        {time.toDateString()}
      </div>
    </div>
  );
};

const WeatherWidgetComponent = (props: any) => {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full">
      <div className="text-xl font-semibold mb-2">Weather</div>
      <div className="text-sm text-gray-600 mb-4">{props.location || 'Current Location'}</div>
      <div className="text-5xl">☀️</div>
      <div className="text-3xl font-bold mt-2">23°C</div>
      <div className="text-gray-600">Sunny</div>
    </div>
  );
};

// Add the TelemetryWidgetComponent
const TelemetryWidgetComponent = (props: any) => {
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(props.metric || 'speed_kph');
  const wsRef = React.useRef<WebSocket | null>(null);
  
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
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="text-red-500 font-bold mb-2">Disconnected</div>
        <div className="text-sm">Attempting to connect...</div>
      </div>
    );
  }
  
  if (!telemetryData) {
    return (
      <div className="p-4 flex flex-col items-center justify-center h-full">
        <div className="text-blue-500 font-bold mb-2">Connected</div>
        <div className="text-sm">Waiting for data...</div>
      </div>
    );
  }
  
  // Get available metrics from the telemetry data
  const metrics = Object.keys(telemetryData).filter(key => 
    typeof telemetryData[key] !== 'object' && 
    !Array.isArray(telemetryData[key]) &&
    key !== 'raw_values' &&
    key !== 'warnings' &&
    key !== 'active_flags' &&
    key !== 'session_flags'
  );
  
  return (
    <div className="p-4 flex flex-col h-full">
      <div className="mb-3">
        <select 
          value={selectedMetric}
          onChange={(e) => setSelectedMetric(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded text-sm"
        >
          {metrics.map((metric) => (
            <option key={metric} value={metric}>
              {getMetricName(metric)}
            </option>
          ))}
        </select>
      </div>
      
      <div className="flex-grow flex flex-col items-center justify-center">
        <div className="text-lg font-semibold">
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
          if (key !== 'widgetId' && key !== 'widgetType') {
            // Convert boolean strings
            if (value === 'true') params[key] = true;
            else if (value === 'false') params[key] = false;
            // Convert numbers
            else if (!isNaN(Number(value))) params[key] = Number(value);
            else params[key] = value;
          }
        });
        
        setWidgetId(id);
        setWidgetType(type);
        setWidgetParams(params);
      } catch (error) {
        console.error('Failed to get window parameters:', error);
      }
    };
    
    getWindowParams();
    
    // Listen for opacity changes
    const handleOpacityChange = (newOpacity: number) => {
      console.log('Received opacity change:', newOpacity);
      setOpacity(newOpacity);
    };
    
    window.electronAPI.on('widget:opacity', handleOpacityChange);
    
    // Add keyboard handler for Escape key to close widget
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.electronAPI) {
        console.log('Escape key pressed - closing widget');
        window.electronAPI.send('widget:closeByEscape');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.electronAPI.removeAllListeners('widget:opacity');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Debug output
  console.log('Widget container state:', { widgetId, widgetType, params: widgetParams, opacity });
  
  const widgetProps = {
    id: widgetId,
    ...widgetParams
  };
  
  // Setup CSS for the container
  const containerStyle = {
    opacity,
    height: '100%',
    width: '100%',
    cursor: 'default', // Show default cursor for draggable area
  };
  
  // CSS for areas we don't want draggable (like buttons)
  const noDragStyle = {
    WebkitAppRegion: 'no-drag' as any,
  };
  
  // Basic error checking
  if (!widgetId || !widgetType) {
    return (
      <div className="error-container p-4 bg-red-100 text-red-800 rounded draggable" style={containerStyle}>
        <h3 className="font-bold mb-2">Widget Parameters Missing</h3>
        <p>Required URL parameters missing:</p>
        <ul className="list-disc ml-5 mt-2 non-draggable">
          {!widgetId && <li>widgetId</li>}
          {!widgetType && <li>widgetType</li>}
        </ul>
        <p className="mt-2 text-sm">URL Parameters:</p>
        <pre className="mt-1 p-2 bg-gray-100 text-xs rounded non-draggable">
          {JSON.stringify({ search: window.location.search }, null, 2)}
        </pre>
      </div>
    );
  }
  
  // Render widget based on type
  return (
    <div className="widget-container h-full draggable" style={containerStyle}>
      {widgetType === 'clock' && (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <ClockWidgetComponent {...widgetProps} />
        </div>
      )}
      {widgetType === 'weather' && (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <WeatherWidgetComponent {...widgetProps} />
        </div>
      )}
      {widgetType === 'telemetry' && (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <TelemetryWidgetComponent {...widgetProps} />
        </div>
      )}
      {widgetType !== 'clock' && widgetType !== 'weather' && widgetType !== 'telemetry' && (
        <div className="error-container p-4 bg-red-100 text-red-800 rounded">
          <h3 className="font-bold mb-2">Unknown Widget Type</h3>
          <p>Widget type "{widgetType}" is not supported.</p>
          <p className="mt-2">Supported types:</p>
          <ul className="list-disc ml-5 non-draggable">
            <li>clock</li>
            <li>weather</li>
            <li>telemetry</li>
          </ul>
        </div>
      )}
    </div>
  );
}; 