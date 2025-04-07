import React, { useState, useEffect } from 'react';
import BaseWidget from './BaseWidget';
import { useTelemetryData, formatTelemetryValue, getMetricName } from '../hooks/useTelemetryData';

interface SimpleTelemetryWidgetProps {
  id: string;
  name: string;
  metric: string;
  initialPosition?: { x: number, y: number };
  onClose?: (id: string) => void;
}

export   // Add metrics options
const availableMetrics = [
  { id: 'speed_kph', name: 'Speed (KPH)' },
  { id: 'speed_mph', name: 'Speed (MPH)' },
  { id: 'rpm', name: 'RPM' },
  { id: 'shift_indicator_pct', name: 'Shift Indicator %' },
  { id: 'gear', name: 'Gear' },
  { id: 'throttle_pct', name: 'Throttle' },
  { id: 'brake_pct', name: 'Brake' },
  { id: 'clutch_pct', name: 'Clutch' },
  { id: 'g_force_lat', name: 'Lateral G' },
  { id: 'g_force_lon', name: 'Longitudinal G' },
  { id: 'fuel_level', name: 'Fuel Level' },
  { id: 'current_lap_time', name: 'Current Lap' },
  { id: 'last_lap_time', name: 'Last Lap' },
  { id: 'best_lap_time', name: 'Best Lap' },
  { id: 'position', name: 'Position' },
  { id: 'lap_completed', name: 'Lap' }
];

export const SimpleTelemetryWidget: React.FC<SimpleTelemetryWidgetProps> = ({ 
  id, 
  name,
  metric,
  initialPosition,
  onClose
}) => {
  // Use the new hook with the specific metric we want to track
  const { data, connected } = useTelemetryData(id, { metrics: [metric] });
  
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

  // Render the widget content
  const renderContent = () => {
    if (!data) {
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
          {formatTelemetryValue(metric, data[metric])}
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