import React, { useState, useEffect } from 'react';
import { WebSocketService } from '../services/WebSocketService';
import BaseWidget from './BaseWidget';

interface SimpleTelemetryWidgetProps {
  id: string;
  name: string;
  metric: string;
  initialPosition?: { x: number, y: number };
  onClose?: (id: string) => void;
}

export const SimpleTelemetryWidget: React.FC<SimpleTelemetryWidgetProps> = ({ 
  id, 
  name,
  metric,
  initialPosition,
  onClose
}) => {
  const [telemetryData, setTelemetryData] = useState<any>(null);
  
  // Initialize with WebSocketService
  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    
    // Add data listener
    webSocketService.addDataListener(id, (data) => {
      setTelemetryData(data);
    });
    
    // Cleanup on unmount
    return () => {
      webSocketService.removeListeners(id);
    };
  }, [id]);
  
  // Generate a random position if none provided
  const defaultPosition = initialPosition || {
    x: 200 + Math.random() * 300,
    y: 200 + Math.random() * 200
  };
  
  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };
  
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
      case 'shift_indicator_pct':
        return `${value.toFixed(1)}%`;
      case 'gear':
        return String(value);
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
      'lap_completed': 'Lap',
      'shift_indicator_pct': 'Shift Indicator'
    };
    
    return metricNames[metric] || metric;
  };

  // Render the widget content
  const renderContent = () => {
    if (!telemetryData) {
      return (
        <div className="telemetry-content">
          <div className="status-message">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="telemetry-content">
        <div className="telemetry-label">
          {getMetricName(metric)}
        </div>
        <div className="telemetry-value">
          {formatMetricValue(metric, telemetryData[metric])}
        </div>
      </div>
    );
  };

  return (
    <BaseWidget 
      id={id} 
      title={name}
      initialPosition={defaultPosition}
      className="telemetry-widget-wrapper"
    >
      <div className="telemetry-widget">
        {renderContent()}
      </div>
    </BaseWidget>
  );
}; 