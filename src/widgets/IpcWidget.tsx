/// <reference path="../types/electron.d.ts" />
import React, { useState, useEffect } from 'react';
import { withWidgetRegistration } from './WidgetManager';
import { BaseWidgetProps } from './BaseWidget';

// Widget props interface
export interface IpcWidgetProps extends BaseWidgetProps {
  id: string;
  metric?: string; // Default metric to display
  defaultVisible?: boolean;
  defaultOpacity?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  showControls?: boolean;
}

// Controls component for widgets
const WidgetControls: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  return (
    <div className="widget-controls absolute top-0 right-0 z-10 p-1">
      <button 
        className="close-btn bg-red-500 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
};

// Main IpcWidget component
const IpcWidgetBase: React.FC<IpcWidgetProps> = (props) => {
  const { 
    id, 
    metric: initialMetric, 
    defaultVisible = true,
    defaultOpacity = 1,
    defaultWidth = 300,
    defaultHeight = 200,
    showControls = true
  } = props;

  // State management
  const [visible, setVisible] = useState(defaultVisible);
  const [opacity, setOpacity] = useState(defaultOpacity);
  const [width, setWidth] = useState(defaultWidth);
  const [height, setHeight] = useState(defaultHeight);
  const [showingControls, setShowingControls] = useState(false);
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [connected, setConnected] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState(initialMetric || 'speed_kph');

  // Effect to handle IPC communication
  useEffect(() => {
    if (!window.electronAPI) {
      console.warn(`IpcWidget ${id}: electronAPI not available`);
      return;
    }

    // Reconnection state
    let reconnectTimeout: number | null = null;
    let dataCheckInterval: number | null = null;
    
    // Function to request data from main process
    const requestTelemetryData = () => {
      window.electronAPI.invoke('telemetry:getData')
        .then((data: any) => {
          if (data) {
            setTelemetryData(data);
          }
        })
        .catch((err: any) => {
          console.error(`IpcWidget ${id}: Failed to get telemetry data:`, err);
          scheduleReconnect();
        });
    };
    
    // Function to request connection status from main process
    const requestConnectionStatus = () => {
      window.electronAPI.invoke('telemetry:getConnectionStatus')
        .then((status: boolean) => {
          setConnected(status);
          
          if (status) {
            requestTelemetryData();
          } else {
            scheduleReconnect();
          }
        })
        .catch((err: any) => {
          console.error(`IpcWidget ${id}: Failed to get connection status:`, err);
          scheduleReconnect();
        });
    };
    
    // Function to schedule a reconnection attempt
    const scheduleReconnect = () => {
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
      }
      
      reconnectTimeout = window.setTimeout(() => {
        requestConnectionStatus();
      }, 2000); // Increased to 2 seconds
    };

    // Setup a polling interval to ensure we get regular updates
    // This helps recover from any missed events or disconnections
    const setupDataCheckInterval = () => {
      if (dataCheckInterval !== null) {
        window.clearInterval(dataCheckInterval);
      }
      
      dataCheckInterval = window.setInterval(() => {
        // Only make IPC calls if the component is still mounted
        if (!window.electronAPI) return;
        
        // If we're not connected or we've been disconnected, try to reconnect
        if (!connected) {
          requestConnectionStatus();
        }
        // Only request data again if we're connected but don't have any
        else if (connected && (!telemetryData || Object.keys(telemetryData || {}).length === 0)) {
          requestTelemetryData();
        }
      }, 10000); // Increased to 10 seconds to significantly reduce IPC traffic
    };

    // Listen for parameter updates from the main process
    window.electronAPI.on('widget:params', (params: Record<string, any>) => {
      if (params.metric && params.metric !== selectedMetric) {
        setSelectedMetric(params.metric);
      }
    });

    // Initial requests for data and connection status
    requestConnectionStatus();
    
    // Set up periodic data check
    setupDataCheckInterval();

    // Listen for telemetry data updates
    window.electronAPI.on('telemetry:update', (data: any) => {
      setTelemetryData(data);
      setConnected(true);
      
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    });

    // Listen for connection status updates
    window.electronAPI.on('telemetry:connectionChange', (status: boolean) => {
      setConnected(status);
      
      if (!status) {
        scheduleReconnect();
      } else if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
        requestTelemetryData();
      }
    });

    // Listen for Escape key to close widget
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        window.electronAPI?.send('widget:closeByEscape', id);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);

    // Special case: If this is a widget window with its own ID in URL,
    // request a specific registration with the main process to ensure updates
    if (window.location.search.includes(`widgetId=${id}`)) {
      window.electronAPI.send('widget:registerForUpdates', { widgetId: id });
    }

    // Cleanup function
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      
      // Clear any pending reconnection attempt
      if (reconnectTimeout !== null) {
        window.clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
      
      // Clear data check interval
      if (dataCheckInterval !== null) {
        window.clearInterval(dataCheckInterval);
        dataCheckInterval = null;
      }
      
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('widget:params');
        window.electronAPI.removeAllListeners('telemetry:update');
        window.electronAPI.removeAllListeners('telemetry:connectionChange');
      }
    };
  }, [id, selectedMetric]); // Reduced dependencies to prevent re-running effect too often

  // Visibility control
  const handleSetVisibility = (isVisible: boolean) => {
    setVisible(isVisible);
    
    // Notify main process
    if (window.electronAPI) {
      window.electronAPI.widgets.setVisible(id, isVisible);
    }
  };

  // Opacity control
  const handleSetOpacity = (newOpacity: number) => {
    const validOpacity = Math.max(0.1, Math.min(1, newOpacity));
    setOpacity(validOpacity);
    
    // Notify main process
    if (window.electronAPI) {
      window.electronAPI.widgets.setOpacity(id, validOpacity);
    }
  };

  // Size control
  const handleSetSize = (newWidth: number, newHeight: number) => {
    setWidth(newWidth);
    setHeight(newHeight);
  };
  
  // Close widget
  const handleCloseWidget = () => {
    if (window.electronAPI) {
      window.electronAPI.widgets.close(id);
    }
  };
  
  // Toggle controls
  const handleToggleControls = () => {
    setShowingControls(!showingControls);
  };

  // Format the metric value for display (Same as TelemetryWidget)
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
  
  // Get a user-friendly name for the metric (Same as TelemetryWidget)
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

  // Render widget content
  const renderContent = () => {
    if (!connected) {
      return (
        <div className="widget-content">
          <div className="status-message">Connecting...</div>
        </div>
      );
    }
    
    if (!telemetryData || Object.keys(telemetryData).length === 0) {
      return (
        <div className="widget-content">
          <div className="status-message">Waiting for data...</div>
        </div>
      );
    }
    
    // Check if the selected metric exists in the telemetry data
    const value = telemetryData[selectedMetric];
    if (value === undefined || value === null) {
      return (
        <div className="widget-content">
          <div className="widget-label">
            {getMetricName(selectedMetric)}
          </div>
          <div className="widget-value">
            N/A
          </div>
        </div>
      );
    }
    
    return (
      <div className="widget-content">
        <div className="widget-label">
          {getMetricName(selectedMetric)}
        </div>
        <div className="widget-value">
          {formatMetricValue(selectedMetric, value)}
        </div>
      </div>
    );
  };

  if (!visible) return null;

  return (
    <div 
      className="widget-container rounded-lg overflow-hidden bg-gray-800 text-white draggable relative"
      style={{ 
        opacity, 
        width: `${width}px`, 
        height: `${height}px`,
        transition: 'opacity 0.3s',
      }}
      onMouseEnter={() => showControls && setShowingControls(true)}
      onMouseLeave={() => showControls && setShowingControls(false)}
    >
      {showingControls && showControls && (
        <WidgetControls onClose={handleCloseWidget} />
      )}
      {renderContent()}
    </div>
  );
};

// Export the widget with registration
export const IpcWidget = withWidgetRegistration<IpcWidgetProps>(
  IpcWidgetBase, 'ipc'
); 