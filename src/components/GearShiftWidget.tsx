import React, { useEffect, useState, useCallback } from 'react';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';
import { WidgetManager } from '../services/WidgetManager';

interface GearShiftWidgetProps {
  id: string;
  onClose: () => void;
}

const GearShiftWidgetComponent: React.FC<GearShiftWidgetProps> = ({ id, onClose }) => {
  // Local state for widget width, defaulting to 300px
  const [widgetWidth, setWidgetWidth] = useState<number>(300);

  // Retrieve telemetry data including shift indicator metric
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: ['shift_indicator_pct', 'rpm'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 100
  });

  // Listen for widget state updates to update width from controls
  useWidgetStateUpdates(id, (state) => {
    if (state.width !== undefined) {
      setWidgetWidth(prevWidth => {
        const newWidth = Number(state.width);
        return newWidth !== prevWidth ? newWidth : prevWidth;
      });
    }
  });

  // Sync initial width with WidgetManager
  useEffect(() => {
    const widget = WidgetManager.getWidget(id);
    if (widget) {
      if (widget.state && widget.state.width !== undefined) {
        const storedWidth = Number(widget.state.width);
        if (storedWidth !== widgetWidth) {
          setWidgetWidth(storedWidth);
        }
      } else {
        WidgetManager.updateWidgetState(id, { width: widgetWidth });
      }
    } else {
      WidgetManager.updateWidgetState(id, { width: widgetWidth });
    }
  }, [id, widgetWidth]);

  // Function to compute color based on shift indicator percentage
  const getShiftColor = useCallback((value: number): string => {
    if (value < 33) return '#00FF00';      // Green
    else if (value < 66) return '#FFBF00'; // Amber
    return '#FF0000';                     // Red
  }, []);

  // Determine the current shift indicator value (defaulting to 0 if not available)
  const shiftIndicator = telemetryData && telemetryData.shift_indicator_pct !== undefined ? telemetryData.shift_indicator_pct : 0;
  // Compute the width of the filled bar proportional to the shift indicator percentage
  const filledWidth = (shiftIndicator / 100) * widgetWidth;

  return (
    <Widget id={id} title="Gear Shift Indicator" onClose={onClose} width={widgetWidth}>
      <div>
        <div style={{ border: '1px solid #ccc', borderRadius: '4px', background: '#eee', overflow: 'hidden' }}>
          <div
            style={{
              width: filledWidth,
              height: '20px',
              backgroundColor: getShiftColor(shiftIndicator),
              transition: 'width 0.2s'
            }}
          />
        </div>
        <div style={{ marginTop: '8px', textAlign: 'center', fontSize: '14px' }}>
          {`Shift Indicator: ${shiftIndicator.toFixed(0)}%`}
        </div>
      </div>
    </Widget>
  );
};

// Define control panel controls for this widget
const getGearShiftControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  const width = widgetState.width || 300;
  const controls: WidgetControlDefinition[] = [
    {
      id: 'width',
      type: 'slider' as WidgetControlType,
      label: `Width: ${width}px`,
      value: width,
      options: [
        { value: 200, label: 'Small' },
        { value: 300, label: 'Medium' },
        { value: 400, label: 'Large' },
        { value: 500, label: 'Extra Large' },
        { value: 600, label: 'Maximum' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ width: numericValue });
      }
    }
  ];
  return controls;
};

const GearShiftWidget = withControls(GearShiftWidgetComponent, getGearShiftControls);

export default GearShiftWidget; 