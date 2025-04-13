import React, { useEffect } from 'react';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { useWidgetState } from '../hooks/useWidgetState';

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
  // Use our custom hook for widget state (much cleaner!)
  const [displaySize, setDisplaySize, displaySizeRef] = useWidgetState<number>(id, 'displaySize', 100);
  const [unit, setUnit] = useWidgetState<'kph' | 'mph'>(id, 'unit', initialUnit);
  
  // Use telemetry data
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: [unit === 'kph' ? 'speed_kph' : 'speed_mph'],
    throttleUpdates: true,
    updateInterval: 100
  });

  // Get the speed value to display
  const speedValue = telemetryData 
    ? (unit === 'kph' ? telemetryData.speed_kph : telemetryData.speed_mph) || 0 
    : 0;

  // Calculate font size based on the display size setting
  const fontSizeValue = 2.4 * (displaySize / 100);
  const fontSizeUnit = 1.2 * (displaySize / 100);
  
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