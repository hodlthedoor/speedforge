import React, { useState, useEffect } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import { Widget } from './Widget';
import { SimpleTelemetryWidget } from './SimpleTelemetryWidget';
import { v4 as uuidv4 } from 'uuid';
import PedalTraceWidget from './PedalTraceWidget';
import ShiftIndicatorWidget from './ShiftIndicatorWidget';

interface WidgetData {
  id: string;
  type: 'default' | 'telemetry' | 'pedal-trace' | 'shift-indicator';
  title: string;
  content?: string;
  metric?: string;
  enabled: boolean;
}

interface SimpleControlPanelProps {
  initialPosition?: { x: number, y: number };
  onClickThrough?: (enabled: boolean) => void;
  onAddWidget?: (widget: any) => void;
  activeWidgets?: any[];
}

const SimpleControlPanel: React.FC<SimpleControlPanelProps> = ({ 
  initialPosition = { x: 20, y: 20 },
  onClickThrough,
  onAddWidget,
  activeWidgets = []
}) => {
  const [clickThrough, setClickThrough] = useState(false);
  const [showTelemetryOptions, setShowTelemetryOptions] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any | null>(null);
  const [widgetOpacity, setWidgetOpacity] = useState<{ [key: string]: number }>({});
  
  // Add metrics options
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

  const addWidget = () => {
    if (!onAddWidget) return;
    
    const id = uuidv4();
    const widgetData = {
      id,
      type: 'default',
      title: 'New Widget',
      text: 'Widget content goes here',
      enabled: true
    };
    
    const widgetContent = (
      <Widget
        key={id}
        id={id}
        title={widgetData.title}
        onClose={() => closeWidget(id)}
      >
        {widgetData.text}
      </Widget>
    );
    
    onAddWidget({
      ...widgetData,
      content: widgetContent
    });
    
    // Auto-select the new widget
    setSelectedWidget(widgetData);
  };

  const addTelemetryWidget = (metric: string, name: string) => {
    if (!onAddWidget) return;
    
    const id = uuidv4();
    const widgetData = {
      id,
      type: 'telemetry',
      title: name,
      metric: metric,
      enabled: true
    };
    
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
      ...widgetData,
      content: widgetContent
    });
    
    // Auto-select the new widget
    setSelectedWidget(widgetData);
  };

  const addPedalTraceWidget = () => {
    const widgetId = `pedal-trace-${Date.now()}`;
    const widget = {
      id: widgetId,
      type: 'pedal-trace',
      title: 'Pedal Traces',
      content: (
        <PedalTraceWidget
          id={widgetId}
          onClose={() => closeWidget(widgetId)}
        />
      )
    };
    onAddWidget(widget);
  };

  const addShiftIndicatorWidget = () => {
    const widgetId = `shift-indicator-${Date.now()}`;
    const widget = {
      id: widgetId,
      type: 'shift-indicator',
      title: 'Shift Indicator',
      content: (
        <ShiftIndicatorWidget
          id={widgetId}
          onClose={() => closeWidget(widgetId)}
        />
      )
    };
    onAddWidget(widget);
  };

  const closeWidget = (id: string) => {
    console.log(`Closing widget ${id}`);
    
    // Since we're just passing the widget state, we need to update it locally
    // Find the widget in the active widgets array and mark it as disabled
    if (Array.isArray(activeWidgets)) {
      const widgetToUpdate = activeWidgets.find(w => w.id === id);
      if (widgetToUpdate) {
        widgetToUpdate.enabled = false;
        
        // If App component passed an onClose handler, call it to update parent state
        if (onAddWidget) {
          // This is a hack since we don't have a dedicated onClose prop
          // Re-add the widget with enabled=false to have App update it
          onAddWidget({
            ...widgetToUpdate,
            enabled: false
          });
        }
      }
    }
    
    // If the closed widget was selected, clear the selection
    if (selectedWidget?.id === id) {
      setSelectedWidget(null);
    }
  };

  // Set the selected widget and highlight it
  const selectWidget = (widget: any) => {
    setSelectedWidget(widget);
    
    // Dispatch event to highlight the selected widget
    const event = new CustomEvent('widget:highlight', { 
      detail: { widgetId: widget.id }
    });
    window.dispatchEvent(event);
  };

  // Listen for widget click events from the application
  useEffect(() => {
    const handleWidgetClick = (e: any) => {
      if (e.detail && e.detail.widgetId) {
        // Find the widget with matching ID
        const clickedWidget = activeWidgets.find(w => w.id === e.detail.widgetId);
        if (clickedWidget) {
          console.log('Widget clicked:', clickedWidget);
          setSelectedWidget(clickedWidget);
        }
      }
    };
    
    window.addEventListener('widget:clicked', handleWidgetClick);
    return () => window.removeEventListener('widget:clicked', handleWidgetClick);
  }, [activeWidgets]);

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

  // Add telemetry widget options toggle with debug
  const toggleTelemetryOptions = () => {
    console.log(`Telemetry options toggle: ${!showTelemetryOptions}`);
    setShowTelemetryOptions(!showTelemetryOptions);
  };

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

  // Determine what widgets are active
  const enabledWidgets = Array.isArray(activeWidgets) 
    ? activeWidgets.filter(w => w && w.enabled !== false)
    : [];

  const handleOpacityChange = (widgetId: string, value: number) => {
    setWidgetOpacity(prev => ({
      ...prev,
      [widgetId]: value
    }));
    
    // Dispatch event to update widget opacity
    const event = new CustomEvent('widget:opacity', { 
      detail: { widgetId, opacity: value }
    });
    window.dispatchEvent(event);
  };

  return (
    <BaseDraggableComponent 
      initialPosition={initialPosition}
      className={`w-[400px] max-h-[80vh] overflow-y-auto overflow-x-hidden scrollbar-none shadow-lg border border-blue-200/20 bg-gray-800/85 rounded-lg text-gray-100 z-[1000] backdrop-blur-sm ${clickThrough ? 'click-through' : ''}`}
    >
      <div className="panel-header drag-handle w-full">
        <h2>Control Panel</h2>
      </div>
      <div className="panel-content w-full px-4 py-3">
        <div className="control-buttons flex flex-col gap-2 w-full">
          <button 
            className={`btn ${clickThrough ? 'btn-warning' : 'btn-primary'}`}
            onClick={toggleClickThrough}
          >
            {clickThrough ? 'Show Panel' : 'Hide Panel'}
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

          <details className="telemetry-details">
            <summary className="btn btn-primary telemetry-summary">
              Add Speedforge Widget
            </summary>
            <div className="telemetry-options">
              <h3>Select Widget</h3>
              <div className="metric-buttons">
                <button 
                  className="btn btn-sm btn-secondary metric-btn"
                  onClick={addPedalTraceWidget}
                >
                  Pedal Traces
                </button>
                <button 
                  className="btn btn-sm btn-secondary metric-btn"
                  onClick={addShiftIndicatorWidget}
                >
                  Shift Indicator
                </button>
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
        
        {/* Selected Widget Details Section */}
        {selectedWidget && (
          <div className="active-widgets-section">
            <h3>Selected Widget</h3>
            <div className="widget-details-panel">
              <div className="widget-details-header">
                <h4>{selectedWidget.title || `Widget ${selectedWidget.id.slice(0, 6)}`}</h4>
                <button 
                  className="widget-close-btn" 
                  onClick={() => closeWidget(selectedWidget.id)}
                  title="Close Widget"
                >
                  ×
                </button>
              </div>
              <div className="widget-detail">
                <span className="detail-label">ID:</span>
                <span className="detail-value">{selectedWidget.id.slice(0, 8)}...</span>
              </div>
              <div className="widget-detail">
                <span className="detail-label">Type:</span>
                <span className="detail-value">{selectedWidget.type || 'default'}</span>
              </div>
              {selectedWidget.type === 'telemetry' && selectedWidget.metric && (
                <div className="widget-detail">
                  <span className="detail-label">Metric:</span>
                  <span className="detail-value">{selectedWidget.metric}</span>
                </div>
              )}
              <div className="widget-detail">
                <span className="detail-label">Opacity:</span>
                <div className="pl-2">
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.1"
                    value={widgetOpacity[selectedWidget.id] ?? 1}
                    onChange={(e) => handleOpacityChange(selectedWidget.id, parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </BaseDraggableComponent>
  );
};

export default SimpleControlPanel; 