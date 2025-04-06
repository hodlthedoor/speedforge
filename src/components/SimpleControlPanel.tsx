import React, { useState, useEffect } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import { Widget } from './Widget';
import { SimpleTelemetryWidget } from './SimpleTelemetryWidget';
import { v4 as uuidv4 } from 'uuid';

interface WidgetData {
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
  onAddWidget?: (widget: any) => void;
}

const SimpleControlPanel: React.FC<SimpleControlPanelProps> = ({ 
  initialPosition = { x: 20, y: 20 },
  onClickThrough,
  onAddWidget
}) => {
  const [clickThrough, setClickThrough] = useState(false);
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
    if (!onAddWidget) return;
    
    const id = uuidv4();
    const widgetContent = (
      <Widget
        key={id}
        title="New Widget"
        onClose={() => closeWidget(id)}
      >
        Widget content goes here
      </Widget>
    );
    
    onAddWidget({
      id,
      content: widgetContent
    });
  };

  const addTelemetryWidget = (metric: string, name: string) => {
    if (!onAddWidget) return;
    
    const id = uuidv4();
    const widgetContent = (
      <SimpleTelemetryWidget
        key={id}
        id={id}
        name={name}
        metric={metric}
        onClose={() => closeWidget(id)}
      />
    );
    
    onAddWidget({
      id,
      content: widgetContent
    });
    
    setShowTelemetryOptions(false);
  };

  const closeWidget = (id: string) => {
    console.log(`Closing widget ${id}`);
    // We don't need to update state here since widgets are managed in the parent
  };

  // Update local click-through state when App component changes it
  useEffect(() => {
    const handleToggleFromApp = (e: any) => {
      if (e.detail && typeof e.detail.state === 'boolean') {
        setClickThrough(e.detail.state);
      }
    };
    
    window.addEventListener('app:toggle-click-through', handleToggleFromApp);
    return () => window.removeEventListener('app:toggle-click-through', handleToggleFromApp);
  }, []);

  // Debug: Monitor focus-related events
  useEffect(() => {
    const handleFocus = () => {
      console.log('DEBUG: Window focus event');
    };
    
    const handleBlur = () => {
      console.log('DEBUG: Window blur event');
    };
    
    const handleFocusin = (e: FocusEvent) => {
      console.log(`DEBUG: Focus-in event on: ${(e.target as any)?.tagName || 'unknown'}`);
    };
    
    const handleFocusout = (e: FocusEvent) => {
      console.log(`DEBUG: Focus-out event from: ${(e.target as any)?.tagName || 'unknown'}`);
    };
    
    const handleMousedown = (e: MouseEvent) => {
      console.log(`DEBUG: Mouse down on: ${(e.target as any)?.className || 'unknown'}`);
    };
    
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('focusin', handleFocusin);
    document.addEventListener('focusout', handleFocusout);
    document.addEventListener('mousedown', handleMousedown);
    
    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('focusin', handleFocusin);
      document.removeEventListener('focusout', handleFocusout);
      document.removeEventListener('mousedown', handleMousedown);
    };
  }, []);

  const toggleClickThrough = () => {
    const newValue = !clickThrough;
    setClickThrough(newValue);
    
    // Call the parent component's handler with the new value
    if (onClickThrough) {
      console.log(`SimpleControlPanel: toggle click-through to ${newValue}`);
      onClickThrough(newValue);
    }
    
    // If running in Electron, also toggle via the API
    if (window.electronAPI) {
      console.log(`SimpleControlPanel: requesting Electron to set click-through to ${newValue}`);
      window.electronAPI.app.toggleClickThrough(newValue)
        .then(response => {
          console.log('Electron click-through response:', response);
        })
        .catch(error => {
          console.error('Error toggling click-through via Electron:', error);
        });
    }
  };

  // Add telemetry widget options toggle with debug
  const toggleTelemetryOptions = () => {
    console.log(`Telemetry options toggle: ${!showTelemetryOptions}`);
    setShowTelemetryOptions(!showTelemetryOptions);
  };

  const quitApplication = () => {
    console.log('Quitting application');
    if (window.electronAPI) {
      window.electronAPI.app.quit()
        .then(result => console.log('Quit result:', result))
        .catch(error => console.error('Error quitting:', error));
    }
  };

  return (
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
          
          <details className="telemetry-details">
            <summary className="btn btn-primary telemetry-summary">
              Add Telemetry Widget
            </summary>
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
          </details>
          
          <button 
            className="btn btn-danger"
            onClick={quitApplication}
          >
            Quit Application
          </button>
        </div>
      </div>
    </BaseDraggableComponent>
  );
};

export default SimpleControlPanel; 