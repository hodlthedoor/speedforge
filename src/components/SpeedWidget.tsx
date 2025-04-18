import React, { useEffect, useState, useRef } from 'react';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';
import { WidgetManager } from '../services/WidgetManager';

interface SpeedWidgetProps {
  id: string;
  onClose: () => void;
  unit?: 'kph' | 'mph';
}

const SpeedWidgetComponent: React.FC<SpeedWidgetProps> = ({ 
  id, 
  onClose,
  unit: initialUnit = 'kph'
}) => {
  const [speed, setSpeed] = useState<number>(0);
  const [unit, setUnit] = useState<'kph' | 'mph'>('kph');
  const speedDisplayRef = useRef<HTMLDivElement>(null);
  
  // Subscribe to widget state updates
  useWidgetStateUpdates(id, (widgetState) => {
    if (widgetState && widgetState.unit) {
      setUnit(widgetState.unit as 'kph' | 'mph');
    }
  }, []);
  
  // Use telemetry data
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: [unit === 'kph' ? 'speed_kph' : 'speed_mph'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 100
  });
  
  // Initialize from WidgetManager and listen for its updates
  useEffect(() => {
    // Get initial state from WidgetManager
    const widget = WidgetManager.getWidget(id);
    if (widget) {
      if (widget.state) {
        if (widget.state.unit !== undefined && widget.state.unit !== unit) {
          setUnit(widget.state.unit);
        }
      } else {
        // Set initial state in WidgetManager
        WidgetManager.updateWidgetState(id, { unit });
      }
    } else {
      // Widget doesn't exist yet, create state
      WidgetManager.updateWidgetState(id, { unit });
    }
    
    // Subscribe to WidgetManager updates
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.unit !== undefined && event.state.unit !== unit) {
          setUnit(event.state.unit);
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]);
  
  // Sync local unit changes to WidgetManager
  useEffect(() => {
    // Skip initial render
    if (unit === WidgetManager.getWidget(id)?.state?.unit) return;
    
    // Update WidgetManager with new value
    WidgetManager.updateWidgetState(id, { unit });
  }, [unit, id]);
  
  // Get the speed value to display
  const speedValue = telemetryData 
    ? (unit === 'kph' ? telemetryData.speed_kph : telemetryData.speed_mph) || 0 
    : 0;

  // Calculate font size based on the display size setting
  const fontSizeValue = 2.4 * (100 / 100);
  const fontSizeUnit = 1.2 * (100 / 100);
  
  return (
    <Widget id={id} title="Speed" onClose={onClose}>
      <div className="speed-widget p-2 flex flex-col items-center justify-center min-h-[120px]">
        <div 
          className="speed-value font-bold" 
          style={{ fontSize: `${fontSizeValue}rem` }}
        >
          {Math.round(speedValue)}
        </div>
        <div 
          className="speed-unit text-gray-300" 
          style={{ fontSize: `${fontSizeUnit}rem` }}
        >
          {unit === 'kph' ? 'km/h' : 'mph'}
        </div>
      </div>
    </Widget>
  );
};

// Define control definitions for the widget registry
const getSpeedWidgetControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default to 100 if not set
  const displaySize = widgetState.displaySize || 100;
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'displaySize',
      type: 'slider' as WidgetControlType,
      label: `Display Size: ${displaySize}%`,
      value: displaySize,
      options: [
        { value: 50, label: 'Small' },
        { value: 100, label: 'Normal' },
        { value: 150, label: 'Large' },
        { value: 200, label: 'X-Large' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        // Update widget state through the registry
        updateWidget({ displaySize: numericValue });
      }
    },
    {
      id: 'unit',
      type: 'select' as WidgetControlType,
      label: 'Speed Unit',
      value: widgetState.unit || 'kph',
      options: [
        { value: 'kph', label: 'km/h' },
        { value: 'mph', label: 'mph' }
      ],
      onChange: (value) => {
        // Update widget state through the registry
        updateWidget({ unit: value });
      }
    }
  ];
  
  return controls;
};

// Wrap component with controls and export
const SpeedWidget = withControls(SpeedWidgetComponent, getSpeedWidgetControls);
export default SpeedWidget; 