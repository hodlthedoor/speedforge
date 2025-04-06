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
          
          <button 
            className="btn btn-primary"
            onClick={() => setShowTelemetryOptions(!showTelemetryOptions)}
          >
            {showTelemetryOptions ? 'Hide Telemetry Options' : 'Add Telemetry Widget'}
          </button>
          
          <button 
            className="btn btn-danger"
            onClick={quitApplication}
          >
            Quit Application
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
  );
};

export default SimpleControlPanel; 