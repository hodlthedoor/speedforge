/// <reference path="../types/electron.d.ts" />
import React, { useEffect, useState } from 'react';

// Import the TelemetryWidget
import { TelemetryWidget } from './TelemetryWidget';
import { TraceWidget } from '../widgets/TraceWidget';

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
      <div className="widget-content" style={{ backgroundColor: '#1f2937', height: '100%', width: '100%', padding: 0, margin: 0 }}>
        <div className="status-disconnected">Disconnected</div>
        <div className="status-message">Attempting to connect...</div>
      </div>
    );
  }
  
  if (!telemetryData) {
    return (
      <div className="widget-content" style={{ backgroundColor: '#1f2937', height: '100%', width: '100%', padding: 0, margin: 0 }}>
        <div className="status-connected">Connected</div>
        <div className="status-message">Waiting for data...</div>
      </div>
    );
  }
  
  // Display the single selected metric
  return (
    <div className="widget-content" style={{ backgroundColor: '#1f2937', height: '100%', width: '100%', padding: 0, margin: 0 }}>
      <div className="widget-label">
        {getMetricName(selectedMetric)}
      </div>
      <div className="widget-value">
        {formatMetricValue(selectedMetric, telemetryData[selectedMetric])}
      </div>
    </div>
  );
};

const TraceWidgetComponent = (props: any) => {
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [throttleHistory, setThrottleHistory] = useState<number[]>([]);
  const [brakeHistory, setBrakeHistory] = useState<number[]>([]);
  const wsRef = React.useRef<WebSocket | null>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  
  // Get trace length from props or use default
  const traceLength = props.traceLength || 75;
  
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
          
          // Update throttle and brake history
          if (data && typeof data.throttle_pct === 'number' && typeof data.brake_pct === 'number') {
            setThrottleHistory(prev => {
              const newHistory = [...prev, data.throttle_pct];
              return newHistory.slice(-traceLength);
            });
            
            setBrakeHistory(prev => {
              const newHistory = [...prev, data.brake_pct];
              return newHistory.slice(-traceLength);
            });
          }
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
  }, [traceLength]);
  
  // Draw function for the canvas
  const drawTrace = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get canvas dimensions
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);
    
    // Set line styles
    ctx.lineWidth = 2;
    
    // Only draw if we have data
    if (throttleHistory.length > 0 && brakeHistory.length > 0) {
      // Calculate x step
      const xStep = width / (traceLength - 1);
      
      // Apply padding at top and bottom (5% of height)
      const paddingY = height * 0.05;
      const graphHeight = height - (paddingY * 2);
      
      // Draw throttle trace
      ctx.strokeStyle = '#34d399'; // Green
      ctx.beginPath();
      throttleHistory.forEach((value, index) => {
        const x = index * xStep;
        // Apply padding to keep values from touching top and bottom
        const y = paddingY + (graphHeight - (value / 100 * graphHeight));
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
      
      // Draw brake trace
      ctx.strokeStyle = '#ef4444'; // Red
      ctx.beginPath();
      brakeHistory.forEach((value, index) => {
        const x = index * xStep;
        // Apply padding to keep values from touching top and bottom
        const y = paddingY + (graphHeight - (value / 100 * graphHeight));
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  };
  
  // Draw trace whenever data changes
  useEffect(() => {
    drawTrace();
  }, [throttleHistory, brakeHistory, telemetryData]);
  
  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          canvasRef.current.width = container.clientWidth;
          canvasRef.current.height = container.clientHeight;
          drawTrace();
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    // Initial sizing
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  
  if (!connected) {
    return (
      <div className="widget-content" style={{ backgroundColor: '#1f2937', height: '100%', width: '100%', padding: 0, margin: 0 }}>
        <div className="status-disconnected">Disconnected</div>
        <div className="status-message">Attempting to connect...</div>
      </div>
    );
  }
  
  return (
    <div className="widget-content" style={{ backgroundColor: '#1f2937', height: '100%', width: '100%', padding: 0, margin: 0 }}>
      <canvas 
        ref={canvasRef} 
        width="300" 
        height="200"
        style={{ width: '100%', height: '100%' }}
      />
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
  
  // Make sure to apply styles to html and body as well
  useEffect(() => {
    // Apply styles to HTML and body elements to ensure full coverage
    document.documentElement.style.backgroundColor = '#1f2937';
    document.documentElement.style.margin = '0';
    document.documentElement.style.padding = '0';
    document.documentElement.style.height = '100%';
    document.documentElement.style.width = '100%';
    document.documentElement.style.overflow = 'hidden';
    
    document.body.style.backgroundColor = '#1f2937';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    document.body.style.height = '100%';
    document.body.style.width = '100%';
    document.body.style.overflow = 'hidden';
  }, []);
  
  // Render based on widget type
  const renderWidget = () => {
    console.log(`Rendering widget: ${widgetType} with params:`, widgetParams);
    
    if (widgetType === 'clock') {
      return (
        <div className="widget" style={{ width: '100%', height: '100%' }}>
          <ClockWidgetComponent 
            format24h={widgetParams.format24h} 
            showTelemetry={widgetParams.showTelemetry}
          />
        </div>
      );
    } else if (widgetType === 'weather') {
      return (
        <div className="widget" style={{ width: '100%', height: '100%' }}>
          <WeatherWidgetComponent location={widgetParams.location} />
        </div>
      );
    } else if (widgetType === 'telemetry') {
      return (
        <div className="widget" style={{ width: '100%', height: '100%' }}>
          <TelemetryWidgetComponent metric={widgetParams.metric} />
        </div>
      );
    } else if (widgetType === 'trace') {
      return (
        <div className="widget" style={{ width: '100%', height: '100%' }}>
          <TraceWidgetComponent traceLength={widgetParams.traceLength} />
        </div>
      );
    } else {
      return (
        <div className="widget" style={{ width: '100%', height: '100%' }}>
          <div className="widget-content">
            <div className="status-message">Unknown widget type: {widgetType}</div>
          </div>
        </div>
      );
    }
  };
  
  return (
    <div style={{ 
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      height: '100vh', 
      width: '100vw', 
      opacity,
      backgroundColor: '#1f2937',
      padding: 0,
      margin: 0,
      border: 'none',
      overflow: 'hidden',
      // @ts-ignore - WebkitAppRegion is a valid CSS property for Electron but not recognized by TypeScript
      WebkitAppRegion: 'drag' // Add this to make the widget draggable
    }}>
      {renderWidget()}
    </div>
  );
}; 