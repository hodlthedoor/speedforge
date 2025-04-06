import React, { useState } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import { Widget } from './Widget';
import { SimpleTelemetryWidget } from './SimpleTelemetryWidget';
import { v4 as uuidv4 } from 'uuid';

interface Widget {
  id: string;
  type: 'default' | 'telemetry';
  title: string;
  content?: string;
  metric?: string;
  enabled: boolean;
}

interface SimpleControlPanelProps {
  initialPosition?: { x: number, y: number };
  onClickThrough?: (enabled: boolean) => void;
}

const SimpleControlPanel: React.FC<SimpleControlPanelProps> = ({ 
  initialPosition = { x: 20, y: 20 },
  onClickThrough
}) => {
  const [clickThrough, setClickThrough] = useState(false);
  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [showTelemetryOptions, setShowTelemetryOptions] = useState(false);
  
  // Add metrics options
  const availableMetrics = [
    { id: 'speed_kph', name: 'Speed (KPH)' },
    { id: 'speed_mph', name: 'Speed (MPH)' },
    { id: 'rpm', name: 'RPM' },
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

  const addWidget = () => {
    const newWidget: Widget = {
      id: uuidv4(),
      type: 'default',
      title: 'New Widget',
      content: 'Widget content goes here',
      enabled: true
    };
    setWidgets([...widgets, newWidget]);
  };

  const addTelemetryWidget = (metric: string, name: string) => {
    const newWidget: Widget = {
      id: uuidv4(),
      type: 'telemetry',
      title: name,
      metric: metric,
      enabled: true
    };
    setWidgets([...widgets, newWidget]);
    setShowTelemetryOptions(false);
  };

  const closeWidget = (id: string) => {
    console.log(`Closing widget ${id}`);
    setWidgets(widgets.map(widget => 
      widget.id === id 
        ? { ...widget, enabled: false } 
        : widget
    ));
  };

  const toggleClickThrough = () => {
    const newValue = !clickThrough;
    setClickThrough(newValue);
    if (onClickThrough) {
      onClickThrough(newValue);
    }
  };

  return (
    <>
      <BaseDraggableComponent 
        initialPosition={initialPosition}
        className={`control-panel ${clickThrough ? 'click-through' : ''}`}
      >
        <div className="panel-header drag-handle">
          <h2>Control Panel</h2>
        </div>
        <div className="panel-content">
          <div className="control-buttons">
            <button 
              className={`btn ${clickThrough ? 'btn-warning' : 'btn-primary'}`}
              onClick={toggleClickThrough}
            >
              {clickThrough ? 'Disable Click Through' : 'Enable Click Through'}
            </button>
            
            <button 
              className="btn btn-primary"
              onClick={addWidget}
            >
              Add Widget
            </button>
            
            <button 
              className="btn btn-primary"
              onClick={() => setShowTelemetryOptions(!showTelemetryOptions)}
            >
              {showTelemetryOptions ? 'Hide Telemetry Options' : 'Add Telemetry Widget'}
            </button>
          </div>
          
          {showTelemetryOptions && (
            <div className="telemetry-options">
              <h3>Select Telemetry Metric</h3>
              <div className="metric-buttons">
                {availableMetrics.map(metric => (
                  <button 
                    key={metric.id}
                    className="btn btn-sm btn-secondary metric-btn"
                    onClick={() => addTelemetryWidget(metric.id, metric.name)}
                  >
                    {metric.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </BaseDraggableComponent>

      {widgets.filter(widget => widget.enabled).map(widget => {
        if (widget.type === 'telemetry' && widget.metric) {
          return (
            <SimpleTelemetryWidget
              key={widget.id}
              id={widget.id}
              name={widget.title}
              metric={widget.metric}
              onClose={closeWidget}
            />
          );
        } else {
          return (
            <Widget
              key={widget.id}
              title={widget.title}
              onClose={() => closeWidget(widget.id)}
            >
              {widget.content || ''}
            </Widget>
          );
        }
      })}
    </>
  );
};

export default SimpleControlPanel; 