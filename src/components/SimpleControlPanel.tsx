import React, { useState, useEffect, useCallback } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import { Widget } from './Widget';
import { SimpleTelemetryWidget, availableMetrics } from './SimpleTelemetryWidget';
import { v4 as uuidv4 } from 'uuid';
import PedalTraceWidget from './PedalTraceWidget';
import ShiftIndicatorWidget from './ShiftIndicatorWidget';
import TrackMapWidget from './TrackMapWidget';
import WidgetRegistry from '../widgets/WidgetRegistry';

interface WidgetData {
  id: string;
  type: 'default' | 'telemetry' | 'pedal-trace' | 'shift-indicator' | 'track-map';
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

// Define the widget state interfaces
interface TrackMapWidgetState {
  mapBuildingState: 'idle' | 'recording' | 'complete';
  colorMode: 'curvature' | 'acceleration' | 'none';
}

const SimpleControlPanel: React.FC<SimpleControlPanelProps> = ({ 
  initialPosition = { x: 20, y: 20 },
  onClickThrough,
  onAddWidget,
  activeWidgets = []
}) => {
  const [clickThrough, setClickThrough] = useState(false);
  const [showTelemetryOptions, setShowTelemetryOptions] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [widgetOpacity, setWidgetOpacity] = useState<Record<string, number>>({});
  const [trackMapWidgetStates, setTrackMapWidgetStates] = useState<Record<string, TrackMapWidgetState>>({});
  
  // Function to close a widget - defined early to avoid reference errors
  const closeWidget = useCallback((id: string) => {
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
  }, [onAddWidget, selectedWidget, activeWidgets]);
  
  // Handle track map widget state changes - defined early
  const handleTrackMapStateChange = useCallback((widgetId: string, state: TrackMapWidgetState) => {
    setTrackMapWidgetStates(prev => ({
      ...prev,
      [widgetId]: state
    }));
  }, []);
  
  // Update track map widget controls
  const updateWidgetState = useCallback((widgetId: string, updates: any) => {
    // Check if it's a track map widget and dispatch event
    if (activeWidgets.find(w => w.id === widgetId && w.type === 'track-map')) {
      const event = new CustomEvent('track-map:control', { 
        detail: { widgetId, updates }
      });
      window.dispatchEvent(event);
    }
    
    // For other widget types, we can implement their update logic here
  }, [activeWidgets]);
  
  // Start new track recording
  const handleStartRecording = useCallback((widgetId: string) => {
    updateWidgetState(widgetId, { mapBuildingState: 'idle' });
  }, [updateWidgetState]);
  
  // Stop current recording
  const handleStopRecording = useCallback((widgetId: string) => {
    updateWidgetState(widgetId, { mapBuildingState: 'complete' });
  }, [updateWidgetState]);
  
  // Change visualization mode
  const handleChangeColorMode = useCallback((widgetId: string, mode: 'curvature' | 'acceleration' | 'none') => {
    updateWidgetState(widgetId, { colorMode: mode });
  }, [updateWidgetState]);
  
  // Get all registered widget types with definitions
  const widgetDefinitions = useCallback(() => {
    const definitions = WidgetRegistry.getAllDefinitions();
    // Filter out telemetry widgets since they have their own section
    const filteredDefs = { ...definitions };
    delete filteredDefs['telemetry'];
    return filteredDefs;
  }, []);

  // Group widgets by category
  const widgetsByCategory = useCallback(() => {
    const defs = widgetDefinitions();
    const categories: Record<string, any[]> = {};
    
    Object.entries(defs).forEach(([type, def]) => {
      const category = def.category || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push({ type, ...def });
    });
    
    return categories;
  }, [widgetDefinitions]);
  
  // Now that we've defined the necessary functions, we can create other widget functions
  
  // Generic function to add any widget type from the registry
  const addWidgetFromRegistry = useCallback((type: string, customOptions?: any) => {
    if (!onAddWidget) return;
    
    const widgetDef = WidgetRegistry.get(type);
    if (!widgetDef) {
      console.warn(`Widget type "${type}" not found in registry`);
      return;
    }
    
    const id = uuidv4();
    const widget = {
      id,
      type,
      title: widgetDef.defaultTitle,
      options: { 
        ...widgetDef.defaultOptions,
        ...customOptions 
      },
      enabled: true
    };
    
    onAddWidget(widget);
    setSelectedWidget(widget);
  }, [onAddWidget]);

  // Add telemetry widget (special case that requires metric info)
  const addTelemetryWidget = useCallback((metric: string, name: string) => {
    addWidgetFromRegistry('telemetry', { metric, name });
  }, [addWidgetFromRegistry]);

  // Set the selected widget and highlight it
  const selectWidget = (widget: any) => {
    setSelectedWidget(widget);
    
    // Dispatch event to highlight the selected widget
    const event = new CustomEvent('widget:highlight', { 
      detail: { widgetId: widget.id }
    });
    window.dispatchEvent(event);
  };

  // Listen for track map state changes from widgets
  useEffect(() => {
    const handleTrackMapState = (e: any) => {
      if (e.detail && e.detail.widgetId && e.detail.state) {
        const { widgetId, state } = e.detail;
        
        // Update the track map widget state
        setTrackMapWidgetStates(prev => ({
          ...prev,
          [widgetId]: state
        }));
      }
    };
    
    window.addEventListener('track-map:state', handleTrackMapState);
    
    return () => {
      window.removeEventListener('track-map:state', handleTrackMapState);
    };
  }, []);

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
      window.electronAPI.app.toggleClickThrough(newValue);
    }
  };

  const quitApplication = () => {
    console.log('Quitting application');
    if (window.electronAPI) {
      window.electronAPI.app.quit();
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

  // Get controls for selected widget
  const getWidgetControls = useCallback((widget: any) => {
    if (!widget || !widget.type) return [];
    
    // Get widget state (if available)
    const widgetState = widget.type === 'track-map' 
      ? trackMapWidgetStates[widget.id] || {}
      : {};
      
    // Get controls from registry
    return WidgetRegistry.getWidgetControls(
      widget.type,
      widgetState,
      (updates: any) => updateWidgetState(widget.id, updates)
    );
  }, [trackMapWidgetStates, updateWidgetState]);

  // Render a control based on its type
  const renderWidgetControl = (control: any) => {
    // Check if conditional function exists and evaluates to false
    if (control.conditional && !control.conditional(selectedWidget)) {
      return null;
    }
    
    switch (control.type) {
      case 'button':
        return (
          <button 
            key={control.id}
            className="btn btn-sm btn-primary"
            onClick={() => control.onChange(control.value)}
          >
            {control.label}
          </button>
        );
        
      case 'select':
        return (
          <div key={control.id} className="mt-2">
            <label className="detail-label text-sm">{control.label}:</label>
            <div className="flex gap-1 mt-1">
              {control.options.map((option: any) => (
                <button 
                  key={option.value}
                  className={`btn btn-xs ${control.value === option.value ? 'btn-info' : 'btn-outline'}`}
                  onClick={() => control.onChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        );
        
      default:
        return null;
    }
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
              {Object.entries(widgetsByCategory()).map(([category, widgets]) => (
                <div key={category} className="widget-category mb-4">
                  <h3 className="text-sm uppercase tracking-wider text-gray-400 mb-2">{category}</h3>
                  <div className="metric-buttons">
                    {widgets.map(widget => (
                      <button 
                        key={widget.type}
                        className="btn btn-sm btn-secondary metric-btn"
                        onClick={() => addWidgetFromRegistry(widget.type)}
                        title={widget.description}
                      >
                        {widget.defaultTitle}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
              {selectedWidget.options?.metric && (
                <div className="widget-detail">
                  <span className="detail-label">Metric:</span>
                  <span className="detail-value">{selectedWidget.options.metric}</span>
                </div>
              )}
              
              {/* Dynamic Widget Controls from Registry */}
              {getWidgetControls(selectedWidget).length > 0 && (
                <div className="widget-controls mt-3">
                  <div className="flex flex-col gap-2">
                    <span className="detail-label">Widget Controls:</span>
                    
                    {getWidgetControls(selectedWidget).map(control => 
                      renderWidgetControl(control)
                    )}
                  </div>
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