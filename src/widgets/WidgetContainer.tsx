/// <reference path="../types/electron.d.ts" />
import React, { useEffect, useState } from 'react';

// Import the TelemetryWidget
import { TelemetryWidget } from './TelemetryWidget';
import { TraceWidget } from '../widgets/TraceWidget';
import { WebSocketService } from '../services/WebSocketService';

// Main Widget Container component
export const WidgetContainer: React.FC = () => {
  const [params, setParams] = useState<Record<string, any>>({});
  const [widgetId, setWidgetId] = useState<string>('');
  const [widgetType, setWidgetType] = useState<string>('');
  const [loading, setLoading] = useState(true);
  // Initialize WebSocketService as a singleton
  const [webSocketService] = useState(() => WebSocketService.getInstance());

  useEffect(() => {
    // Get widget parameters from URL
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get('widgetId');
    const type = searchParams.get('widgetType');
    
    if (id && type) {
      setWidgetId(id);
      setWidgetType(type);
      
      // Collect all other parameters
      const widgetParams: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        if (key !== 'widgetId' && key !== 'widgetType') {
          widgetParams[key] = value;
        }
      });
      
      setParams(widgetParams);
      console.log('Widget parameters:', { id, type, params: widgetParams });
    } else {
      console.error('Missing required widget parameters');
    }
    
    setLoading(false);
    
    // Listen for Escape key to close widget
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.electronAPI) {
        console.log('Escape key pressed, closing widget');
        window.electronAPI.send('widget:closeByEscape');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Render the appropriate widget based on type
  const renderWidget = () => {
    if (loading) {
      return <div>Loading widget...</div>;
    }
    
    if (!widgetId || !widgetType) {
      return <div>Invalid widget configuration</div>;
    }
    
    console.log(`Rendering widget: ${widgetType} with ID: ${widgetId}`);
    
    // Pass the WebSocketService to all widgets
    switch (widgetType.toLowerCase()) {
      case 'telemetry': 
        return (
          <TelemetryWidget 
            id={widgetId}
            metric={params.metric || 'speed_kph'}
            webSocketService={webSocketService}
          />
        );
      case 'trace':
        return (
          <TraceWidget
            id={widgetId}
            traceLength={parseInt(params.traceLength) || 75}
            webSocketService={webSocketService}
          />
        );
      case 'clock':
        return <ClockWidget id={widgetId} format24h={params.format24h === 'true'} showTelemetry={params.showTelemetry === 'true'} webSocketService={webSocketService} />;
      case 'weather':
        return <WeatherWidget id={widgetId} location={params.location} webSocketService={webSocketService} />;
      default:
        return <div>Unknown widget type: {widgetType}</div>;
    }
  };

  return (
    <div className="widget-wrapper">
      {renderWidget()}
    </div>
  );
};

// Individual widget components that use WebSocketService instead of creating their own connections
// These would be moved to their own files in a real refactoring

// Clock Widget
interface ClockWidgetProps {
  id: string;
  format24h?: boolean;
  showTelemetry?: boolean;
  webSocketService: WebSocketService;
}

const ClockWidget: React.FC<ClockWidgetProps> = (props) => {
  const [time, setTime] = useState(new Date());
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Update the clock every second
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    // Register for telemetry data if needed
    if (props.showTelemetry) {
      props.webSocketService.addDataListener(props.id, setTelemetryData);
      props.webSocketService.addConnectionListener(props.id, setConnected);
    }
    
    return () => {
      clearInterval(timer);
      if (props.showTelemetry) {
        props.webSocketService.removeListeners(props.id);
      }
    };
  }, [props.id, props.showTelemetry, props.webSocketService]);

  const formatTime = () => {
    if (props.format24h) {
      return time.toLocaleTimeString('en-US', { hour12: false });
    }
    return time.toLocaleTimeString();
  };

  return (
    <div className="p-4 flex flex-col items-center justify-center h-full bg-gray-800 text-white">
      <div className="text-4xl font-bold">
        {formatTime()}
      </div>
      <div className="text-md mt-2 text-gray-300">
        {time.toDateString()}
      </div>
      
      {props.showTelemetry && connected && telemetryData && (
        <div className="mt-4 text-sm">
          <div>Speed: {telemetryData.speed_kph?.toFixed(1)} km/h</div>
          <div>RPM: {telemetryData.rpm?.toFixed(0)}</div>
          <div>Gear: {telemetryData.gear || 'N'}</div>
        </div>
      )}
    </div>
  );
};

// Weather Widget
interface WeatherWidgetProps {
  id: string;
  location?: string;
  webSocketService: WebSocketService;
}

const WeatherWidget: React.FC<WeatherWidgetProps> = (props) => {
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