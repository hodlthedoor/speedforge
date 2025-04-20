import React, { useState, useCallback, useEffect, useRef, useReducer, useMemo } from 'react';
import { v4 as uuidv4 } from 'uuid';
import BaseDraggableComponent from './BaseDraggableComponent';
import { WebSocketService } from '../services/WebSocketService';
import { useTelemetryData } from '../hooks/useTelemetryData';
import WidgetRegistry, { WidgetControlType } from '../widgets/WidgetRegistry';
import { availableMetrics } from './SimpleTelemetryWidget';
import ConfigService from '../services/ConfigService';
import WidgetManager from '../services/WidgetManager';

// Define the state shape and action types for our widget appearance reducer
type WidgetAppearanceState = {
  opacity: Record<string, number>;
  backgroundTransparent: Record<string, boolean>;
};

type WidgetAppearanceAction = 
  | { type: 'SET_OPACITY'; widgetId: string; value: number }
  | { type: 'SET_BACKGROUND_TRANSPARENT'; widgetId: string; value: boolean }
  | { type: 'RESET_ALL_WIDGETS' }
  | { type: 'BULK_UPDATE'; updates: Partial<WidgetAppearanceState> };

// Reducer function for widget appearance state
function widgetAppearanceReducer(state: WidgetAppearanceState, action: WidgetAppearanceAction): WidgetAppearanceState {
  switch (action.type) {
    case 'SET_OPACITY':
      return {
        ...state,
        opacity: {
          ...state.opacity,
          [action.widgetId]: action.value
        }
      };
    case 'SET_BACKGROUND_TRANSPARENT':
      return {
        ...state,
        backgroundTransparent: {
          ...state.backgroundTransparent,
          [action.widgetId]: action.value
        }
      };
    case 'RESET_ALL_WIDGETS':
      return {
        opacity: {},
        backgroundTransparent: {}
      };
    case 'BULK_UPDATE':
      return {
        ...state,
        ...(action.updates || {})
      };
    default:
      return state;
  }
}

interface ControlPanelProps {
  initialPosition?: { x: number, y: number };
  onClickThrough?: (enabled: boolean) => void;
  onAddWidget?: (widget: any) => void;
  activeWidgets?: any[];
  clickThrough?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  initialPosition = { x: 20, y: 20 },
  onClickThrough,
  onAddWidget,
  activeWidgets = [],
  clickThrough = false
}) => {
  // State
  const [showWidgetMenu, setShowWidgetMenu] = useState(false);
  const [selectedWidget, setSelectedWidget] = useState<any>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const [showActiveWidgets, setShowActiveWidgets] = useState(false);
  
  // Replace individual state variables with reducer
  const [widgetAppearance, dispatchWidgetAppearance] = useReducer(
    widgetAppearanceReducer, 
    { opacity: {}, backgroundTransparent: {} }
  );
  
  // Configuration state
  const [panelName, setPanelName] = useState<string>('Default');
  const [savedPanels, setSavedPanels] = useState<string[]>([]);
  const [currentDisplayId, setCurrentDisplayId] = useState<number | null>(null);
  const [showConfigPanel, setShowConfigPanel] = useState(false);
  
  // Hover states for buttons
  const [hideButtonHover, setHideButtonHover] = useState(false);
  const [showAllButtonHover, setShowAllButtonHover] = useState(false);
  const [menuButtonHover, setMenuButtonHover] = useState(false);
  const [quitButtonHover, setQuitButtonHover] = useState(false);
  const [activeWidgetsButtonHover, setActiveWidgetsButtonHover] = useState(false);
  const [debugButtonHover, setDebugButtonHover] = useState(false);
  
  // Telemetry connection
  const { isConnected } = useTelemetryData('control-panel-telemetry-connection', {
    metrics: ['PlayerTrackSurface'],
    throttleUpdates: true,
    updateInterval: 1000
  });

  // Ensure functions are declared before they're used in memoization
  
  // Handle widget close function
  const closeWidget = useCallback((id: string) => {
    if (!onAddWidget || !activeWidgets) return;
    
    const widgetToUpdate = activeWidgets.find(w => w.id === id);
    if (widgetToUpdate) {
      onAddWidget({
        ...widgetToUpdate,
        enabled: false
      });
      
      // Clear selection if this was the selected widget
      if (selectedWidget?.id === id) {
        setSelectedWidget(null);
      }
    }
  }, [onAddWidget, selectedWidget, activeWidgets]);

  // Handle reconnect to WebSocket
  const handleReconnect = useCallback(() => {
    setReconnecting(true);
    const webSocketService = WebSocketService.getInstance();
    
    if (webSocketService.reconnect) {
      webSocketService.reconnect();
      
      setTimeout(() => {
        setReconnecting(false);
      }, 5000);
    } else {
      setReconnecting(false);
    }
  }, []);
  
  // Handle opacity change
  const handleOpacityChange = useCallback((widgetId: string, value: number) => {
    // Update state with reducer
    dispatchWidgetAppearance({ 
      type: 'SET_OPACITY', 
      widgetId, 
      value 
    });
    
    // Dispatch event to update widget opacity
    const event = new CustomEvent('widget:opacity', { 
      detail: { widgetId, opacity: value }
    });
    window.dispatchEvent(event);
  }, [dispatchWidgetAppearance]);

  // Handle background transparency toggle
  const handleBackgroundTransparencyToggle = useCallback((widgetId: string) => {
    const currentValue = widgetAppearance.backgroundTransparent[widgetId] || false;
    const newValue = !currentValue;
    
    // Update state with reducer
    dispatchWidgetAppearance({ 
      type: 'SET_BACKGROUND_TRANSPARENT', 
      widgetId, 
      value: newValue 
    });
    
    // Dispatch event to update widget background transparency
    const event = new CustomEvent('widget:background-transparent', { 
      detail: { widgetId, transparent: newValue }
    });
    window.dispatchEvent(event);
  }, [dispatchWidgetAppearance, widgetAppearance.backgroundTransparent]);

  // Add telemetry widget
  const addTelemetryWidget = useCallback((metric: string, name: string) => {
    if (!onAddWidget) return;
    
    const widgetDef = WidgetRegistry.get('telemetry');
    if (!widgetDef) return;
    
    const id = uuidv4();
    const widget = {
      id,
      type: 'telemetry',
      title: widgetDef.defaultTitle,
      options: { 
        ...widgetDef.defaultOptions,
        metric,
        name
      },
      enabled: true
    };
    
    onAddWidget(widget);
  }, [onAddWidget]);

  // Add any widget type from registry
  const addWidgetFromRegistry = useCallback((type: string, customOptions?: any) => {
    if (!onAddWidget) return;
    
    const widgetDef = WidgetRegistry.get(type);
    if (!widgetDef) return;
    
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
  }, [onAddWidget]);

  // Function to select a widget and highlight it
  const selectWidget = useCallback((widget: any) => {
    setSelectedWidget(widget);
    
    // Dispatch event to highlight the selected widget
    const event = new CustomEvent('widget:highlight', { 
      detail: { widgetId: widget.id }
    });
    window.dispatchEvent(event);
  }, []);
  
  // Update widget state for any widget type
  const updateWidgetState = useCallback((widgetId: string, updates: any) => {
    // Get the widget
    const widget = activeWidgets.find(w => w.id === widgetId);
    if (!widget) {
      console.error(`[CRITICAL] Cannot update widget state: widget with ID ${widgetId} not found`);
      return;
    }
    
    console.log(`[ControlPanel] updateWidgetState called for widget ${widgetId} with updates:`, updates);
    
    // Update widget state in the widget object itself
    if (!widget.state) widget.state = {};
    widget.state = { ...widget.state, ...updates };
    console.log(`[ControlPanel] Widget state after update:`, widget.state);
    
    // Handle track map widgets specifically
    if (widget.type === 'track-map') {
      const event = new CustomEvent('track-map:control', { 
        detail: { widgetId, updates }
      });
      window.dispatchEvent(event);
    }
    
    // Update the widget state using WidgetManager
    console.log(`[ControlPanel] Calling WidgetManager.updateWidgetState for widget ${widgetId}`);
    WidgetManager.updateWidgetState(widgetId, updates);
    
    // For all widget types, dispatch a generic widget:state:update event
    const updateEvent = new CustomEvent('widget:state:updated', { 
      detail: { widgetId, state: updates }
    });
    window.dispatchEvent(updateEvent);
    
    // For Electron environments, update widget state through API
    if (window.electronAPI) {
      try {
        const widgetsAPI = window.electronAPI as unknown as { 
          widgets: { 
            updateState: (id: string, state: any) => Promise<any>
          } 
        };
        
        if (widgetsAPI.widgets && widgetsAPI.widgets.updateState) {
          widgetsAPI.widgets.updateState(widgetId, updates)
            .catch((error: any) => {
              console.error('Error updating widget state:', error);
            });
        }
      } catch (error) {
        console.error('Error accessing widget API:', error);
      }
    }
    
    // Force a re-render of controls by updating the selected widget
    if (selectedWidget && selectedWidget.id === widgetId) {
      setSelectedWidget({ ...widget });
    }
  }, [activeWidgets, selectedWidget]);

  // Helper function to generate a consistent color hash from a string
  const getColorFromString = useCallback((str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate colors in the blue-green spectrum for telemetry metrics
    const h = Math.abs(hash) % 180 + 180; // 180-360 range (blue to green hues)
    const s = 70 + (Math.abs(hash) % 20); // 70-90%
    const l = 45 + (Math.abs(hash) % 15); // 45-60%
    
    return `hsl(${h}, ${s}%, ${l}%)`;
  }, []);
  
  // Function to show all widgets (reset opacity and transparency)
  const handleShowAllWidgets = useCallback(() => {
    // Only proceed if there are active widgets
    if (!activeWidgets?.length) return;
    
    // Create a new opacity object with 1 (100%) for all widgets
    const newOpacity: Record<string, number> = {};
    // Create a new transparency object with false for all widgets
    const newTransparency: Record<string, boolean> = {};
    
    // Set values for all active widgets
    activeWidgets.forEach(widget => {
      if (widget.enabled) {
        newOpacity[widget.id] = 1;
        newTransparency[widget.id] = false;
        
        // Update widget opacity via event
        const opacityEvent = new CustomEvent('widget:opacity', { 
          detail: { widgetId: widget.id, opacity: 1 }
        });
        window.dispatchEvent(opacityEvent);
        
        // Update widget transparency via event
        const transparencyEvent = new CustomEvent('widget:background-transparent', { 
          detail: { widgetId: widget.id, transparent: false }
        });
        window.dispatchEvent(transparencyEvent);
      }
    });
    
    // Update state with bulk reducer action
    dispatchWidgetAppearance({
      type: 'BULK_UPDATE',
      updates: {
        opacity: newOpacity,
        backgroundTransparent: newTransparency
      }
    });
  }, [activeWidgets, dispatchWidgetAppearance]);

  // Get enabled widgets from the activeWidgets prop
  const enabledWidgets = useMemo(() => {
    return Array.isArray(activeWidgets) 
      ? activeWidgets.filter(w => w && w.enabled !== false)
      : [];
  }, [activeWidgets]);

  // Get widget categories with useMemo
  const widgetsByCategory = useMemo(() => {
    const defs = WidgetRegistry.getAllDefinitions();
    const categories: Record<string, any[]> = {};
    
    Object.entries(defs).forEach(([type, def]) => {
      // Filter out telemetry widgets since they have their own section
      if (type !== 'telemetry') {
        const category = def.category || 'Other';
        if (!categories[category]) {
          categories[category] = [];
        }
        categories[category].push({ type, ...def });
      }
    });
    
    return categories;
  }, []);

  // Get controls for selected widget
  const widgetControls = useMemo(() => {
    if (!selectedWidget || !selectedWidget.type) return [];
    
    // Get widget state based on widget type
    let widgetState: Record<string, any> = {};
    
    // For all widgets, include any state stored in the widget object
    if (selectedWidget.state) {
      widgetState = { ...widgetState, ...selectedWidget.state };
    }
    
    console.log(`Getting controls for widget ${selectedWidget.id} (${selectedWidget.type}) with state:`, widgetState);
      
    // Get controls from registry
    return WidgetRegistry.getWidgetControls(
      selectedWidget.type,
      widgetState,
      (updates: any) => updateWidgetState(selectedWidget.id, updates)
    );
  }, [selectedWidget, updateWidgetState]);

  // Memoize rendered widget control elements
  const renderedWidgetControls = useMemo(() => {
    return widgetControls.map(control => renderWidgetControl(control));
  }, [widgetControls]);

  // Memoize the telemetry widgets rendering
  const renderedTelemetryWidgets = useMemo(() => {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {availableMetrics.map(metric => (
          <div 
            key={metric.id} 
            style={{
              padding: '8px',
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              borderRadius: '8px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
            onClick={() => addTelemetryWidget(metric.id, metric.name)}
          >
            <div style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 500, color: 'white' }}>{metric.name}</div>
          </div>
        ))}
      </div>
    );
  }, [addTelemetryWidget]);

  // Memoize the widget categories rendering
  const renderedWidgetCategories = useMemo(() => {
    return Object.entries(widgetsByCategory).map(([category, widgets]) => (
      <div key={category} style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h4 style={{ fontSize: '12px', fontWeight: 500, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{category}</h4>
          <svg style={{ width: '16px', height: '16px', color: '#a5b4fc' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {widgets.map(widget => (
            <div 
              key={widget.type} 
              style={{
                padding: '8px',
                backgroundColor: 'rgba(30, 41, 59, 0.8)',
                borderRadius: '8px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => addWidgetFromRegistry(widget.type)}
              title={widget.description}
            >
              <div style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 500, color: 'white' }}>{widget.defaultTitle}</div>
            </div>
          ))}
        </div>
      </div>
    ));
  }, [widgetsByCategory, addWidgetFromRegistry]);

  // Memoize the active widgets list
  const renderedActiveWidgets = useMemo(() => {
    if (enabledWidgets.length === 0) {
      return (
        <div style={{ 
          padding: '16px', 
          backgroundColor: 'rgba(30, 41, 59, 0.6)', 
          borderRadius: '8px',
          textAlign: 'center',
          color: '#94a3b8'
        }}>
          No active widgets to display
        </div>
      );
    }

    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '8px',
        maxHeight: '280px',
        overflowY: 'auto',
        paddingRight: '10px',
        marginRight: '-10px'
      }}>
        {enabledWidgets.map(widget => (
          <div 
            key={widget.id}
            style={{
              padding: '10px',
              backgroundColor: selectedWidget?.id === widget.id 
                ? 'rgba(20, 184, 166, 0.2)' 
                : 'rgba(30, 41, 59, 0.8)',
              borderRadius: '6px',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              border: selectedWidget?.id === widget.id 
                ? '1px solid rgba(20, 184, 166, 0.5)' 
                : '1px solid transparent'
            }}
            onClick={() => selectWidget(widget)}
          >
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              fontSize: '12px',
              fontWeight: 500, 
              color: selectedWidget?.id === widget.id ? '#14b8a6' : 'white' 
            }}>
              <span>
                {widget.title || `Widget ${widget.id.slice(0, 6)}`}
                {widget.type === 'telemetry' && widget.options?.metric && (
                  <span style={{ 
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: '10px', 
                    marginTop: '2px',
                    color: selectedWidget?.id === widget.id ? '#2dd4bf' : '#94a3b8'
                  }}>
                    <span style={{
                      display: 'inline-block',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: getColorFromString(widget.options.metric),
                      marginRight: '5px'
                    }} />
                    {widget.options.name || widget.options.metric}
                  </span>
                )}
              </span>
              <span style={{ 
                fontSize: '10px', 
                padding: '2px 6px', 
                backgroundColor: widget.type === 'telemetry' 
                  ? 'rgba(56, 189, 248, 0.2)' 
                  : widget.type === 'track-map' 
                    ? 'rgba(168, 85, 247, 0.2)'
                    : widget.type === 'shift-indicator'
                      ? 'rgba(249, 115, 22, 0.2)'
                      : widget.type === 'pedal-trace'
                        ? 'rgba(34, 197, 94, 0.2)'
                        : 'rgba(20, 184, 166, 0.2)',
                color: widget.type === 'telemetry' 
                  ? '#38bdf8' 
                  : widget.type === 'track-map' 
                    ? '#a855f7'
                    : widget.type === 'shift-indicator'
                      ? '#f97316'
                      : widget.type === 'pedal-trace'
                        ? '#22c55e'
                        : '#14b8a6',
                borderRadius: '4px'
              }}>
                {widget.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  }, [enabledWidgets, selectedWidget, selectWidget, getColorFromString]);

  // Memoize the selected widget section UI
  const renderedSelectedWidgetSection = useMemo(() => {
    if (!selectedWidget) return null;

    return (
      <>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '10px 14px',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderRadius: '8px',
            border: '1px solid rgba(147, 197, 253, 0.5)',
            marginTop: '8px'
          }}
        >
          <div style={{ 
            display: 'flex', 
            alignItems: 'center',
            fontSize: '13px',
            fontWeight: 500,
            color: '#3b82f6',
            flex: 1
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Selected: {selectedWidget.title}
          </div>
          
          <button 
            onClick={() => closeWidget(selectedWidget.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              border: 'none',
              backgroundColor: 'rgba(60, 60, 60, 0.4)',
              color: '#9ca3af',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginLeft: '8px'
            }}
          >
            <svg style={{ width: '12px', height: '12px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div style={{ 
          backgroundColor: 'rgba(30, 41, 59, 0.4)',
          borderRadius: '8px',
          padding: '16px',
          marginTop: '4px'
        }}>
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            paddingRight: '10px',
            marginRight: '-10px'
          }}>
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'rgba(30, 41, 59, 0.6)', 
              borderRadius: '8px',
              fontSize: '12px',
              marginBottom: '16px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', paddingBottom: '4px' }}>
                <span style={{ color: '#9ca3af' }}>ID:</span>
                <span style={{ color: '#d1d5db', fontFamily: 'monospace' }}>{selectedWidget.id.slice(0, 8)}...</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', paddingBottom: '4px' }}>
                <span style={{ color: '#9ca3af' }}>Type:</span>
                <span style={{ color: '#d1d5db' }}>{selectedWidget.type}</span>
              </div>
              {selectedWidget.options?.metric && (
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '4px', paddingBottom: '4px' }}>
                  <span style={{ color: '#9ca3af' }}>Metric:</span>
                  <span style={{ color: '#d1d5db' }}>{selectedWidget.options.metric}</span>
                </div>
              )}
            </div>
            
            {/* Dynamic Widget Controls from Registry */}
            {widgetControls.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 500, color: '#d1d5db', marginRight: '8px' }}>Widget Controls</span>
                  <div style={{ height: '1px', flexGrow: 1, backgroundColor: 'rgba(100, 150, 255, 0.2)' }}></div>
                </div>
                <div style={{ 
                  padding: '12px', 
                  backgroundColor: 'rgba(30, 41, 59, 0.6)', 
                  borderRadius: '8px'
                }}>
                  {renderedWidgetControls}
                </div>
              </div>
            )}
            
            {/* Appearance Controls */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#d1d5db', marginRight: '8px' }}>Appearance</span>
                <div style={{ height: '1px', flexGrow: 1, backgroundColor: 'rgba(100, 150, 255, 0.2)' }}></div>
              </div>
              <div style={{ 
                padding: '12px', 
                backgroundColor: 'rgba(30, 41, 59, 0.6)', 
                borderRadius: '8px'
              }}>
                <div style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '12px', color: '#9ca3af' }}>Opacity</label>
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      backgroundColor: 'rgba(30, 41, 59, 0.8)', 
                      borderRadius: '9999px',
                      color: '#d1d5db' 
                    }}>
                      {Math.round((widgetAppearance.opacity[selectedWidget.id] ?? 1) * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.3"
                    max="1"
                    step="0.1"
                    value={widgetAppearance.opacity[selectedWidget.id] ?? 1}
                    onChange={(e) => handleOpacityChange(selectedWidget.id, parseFloat(e.target.value))}
                    style={{
                      width: '100%',
                      height: '6px',
                      borderRadius: '9999px',
                      backgroundColor: '#4b5563',
                      appearance: 'none',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  />
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#9ca3af' }}>Background</span>
                  <button
                    style={{
                      padding: '6px 10px',
                      borderRadius: '6px',
                      backgroundColor: widgetAppearance.backgroundTransparent[selectedWidget.id] ? '#3b82f6' : '#374151',
                      color: widgetAppearance.backgroundTransparent[selectedWidget.id] ? 'white' : '#d1d5db',
                      border: 'none',
                      fontSize: '11px',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={() => handleBackgroundTransparencyToggle(selectedWidget.id)}
                  >
                    {widgetAppearance.backgroundTransparent[selectedWidget.id] 
                      ? '✓ Transparent' 
                      : 'Make Transparent'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }, [selectedWidget, closeWidget, widgetControls, renderedWidgetControls, widgetAppearance, handleOpacityChange, handleBackgroundTransparencyToggle]);

  // Save the current panel configuration
  const handleSavePanel = useCallback(() => {
    console.log(`Attempting to save panel config "${panelName}" with ${activeWidgets.length} widgets`);
    if (!panelName || panelName.trim() === '') {
      console.error("Cannot save panel config: no panel name provided");
      return;
    }
    
    const configService = ConfigService.getInstance();
    console.log("Got ConfigService instance, saving panel config...");
    
    configService.savePanelConfig(panelName, activeWidgets)
      .then(success => {
        console.log(`Save panel config result: ${success}`);
        if (success) {
          // Update the list of saved panels
          configService.listPanelConfigs().then(configs => {
            console.log(`Updated saved panel list: ${configs.join(', ')}`);
            setSavedPanels(configs);
          });
        } else {
          console.error("Failed to save panel config");
        }
      })
      .catch(err => {
        console.error("Error saving panel config:", err);
      });
  }, [activeWidgets, panelName]);

  // Load a panel configuration
  const handleLoadPanel = useCallback((name: string) => {
    const configService = ConfigService.getInstance();
    configService.loadPanelConfig(name)
      .then(config => {
        if (config && config.widgets) {
          // Clear existing widgets for this panel
          activeWidgets.forEach(widget => {
            closeWidget(widget.id);
          });
          
          // Track widgets being added
          const newWidgetIds: string[] = [];
          
          // Add widgets from config
          config.widgets.forEach(widgetConfig => {
            if (widgetConfig.enabled) {
              // Add widget using onAddWidget
              const newWidget = {
                id: widgetConfig.id,
                type: widgetConfig.type,
                title: widgetConfig.title,
                options: widgetConfig.options,
                state: widgetConfig.state,
                enabled: true
              };
              
              if (onAddWidget) {
                onAddWidget(newWidget);
                newWidgetIds.push(widgetConfig.id);
              }
            }
          });
          
          // Set panel name
          setPanelName(name);
          
          // Apply widget positions and settings with a small delay to ensure widgets are mounted
          setTimeout(() => {
            console.log(`Applying positions and settings to ${newWidgetIds.length} widgets`);
            
            config.widgets.forEach(widgetConfig => {
              if (widgetConfig.enabled) {
                // Set widget position using its position info
                if (widgetConfig.position) {
                  // Dispatch a position update event
                  const posEvent = new CustomEvent('widget:position', { 
                    detail: { 
                      widgetId: widgetConfig.id, 
                      position: widgetConfig.position 
                    }
                  });
                  window.dispatchEvent(posEvent);
                  console.log(`Sent position update for widget ${widgetConfig.id}:`, widgetConfig.position);
                }
                
                // Set opacity if specified
                if (widgetConfig.opacity !== undefined) {
                  const opacityEvent = new CustomEvent('widget:opacity', { 
                    detail: { 
                      widgetId: widgetConfig.id, 
                      opacity: widgetConfig.opacity 
                    }
                  });
                  window.dispatchEvent(opacityEvent);
                  
                  // Update local state
                  dispatchWidgetAppearance({
                    type: 'SET_OPACITY',
                    widgetId: widgetConfig.id,
                    value: widgetConfig.opacity
                  });
                }
                
                // Set background transparency if specified
                if (widgetConfig.isBackgroundTransparent !== undefined) {
                  const bgEvent = new CustomEvent('widget:background-transparent', { 
                    detail: { 
                      widgetId: widgetConfig.id, 
                      transparent: widgetConfig.isBackgroundTransparent 
                    }
                  });
                  window.dispatchEvent(bgEvent);
                  
                  // Update local state
                  dispatchWidgetAppearance({
                    type: 'SET_BACKGROUND_TRANSPARENT',
                    widgetId: widgetConfig.id,
                    value: widgetConfig.isBackgroundTransparent
                  });
                }
              }
            });
          }, 100); // Small delay to ensure widgets are mounted
        }
      });
  }, [activeWidgets, closeWidget, onAddWidget]);

  // Delete a panel configuration
  const handleDeletePanel = useCallback((name: string, e: React.MouseEvent) => {
    // Prevent the click from bubbling up to the parent (which would load the panel)
    e.stopPropagation();
    
    // Ask for confirmation before deleting
    if (window.confirm(`Are you sure you want to delete the layout "${name}"?`)) {
      const configService = ConfigService.getInstance();
      configService.deletePanelConfig(name)
        .then(success => {
          console.log(`Delete panel config result: ${success}`);
          if (success) {
            // Update the list of saved panels
            configService.listPanelConfigs().then(configs => {
              console.log(`Updated saved panel list: ${configs.join(', ')}`);
              setSavedPanels(configs);
            });
            
            // If the deleted panel was the current one, clear the panel name
            if (name === panelName) {
              setPanelName('');
            }
          } else {
            console.error("Failed to delete panel config");
          }
        })
        .catch(err => {
          console.error("Error deleting panel config:", err);
        });
    }
  }, [panelName]);

  // Toggle configuration panel visibility
  const toggleConfigPanel = useCallback(() => {
    setShowConfigPanel(prev => !prev);
  }, []);

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
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginRight: '8px'
            }}
            onClick={() => control.onChange(control.value)}
          >
            {control.label}
          </button>
        );
        
      case 'select':
        return (
          <div key={control.id} style={{ marginTop: '12px' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', display: 'block' }}>{control.label}:</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {control.options.map((option: any) => (
                <button 
                  key={option.value}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '6px',
                    backgroundColor: control.value === option.value ? '#3b82f6' : '#374151',
                    color: control.value === option.value ? 'white' : '#d1d5db',
                    border: 'none',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                  onClick={() => control.onChange(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        );
      
      case 'slider':
        return (
          <div key={control.id} className="mt-3">
            <div className="flex justify-between items-center mb-1.5">
              <label className="detail-label text-sm text-gray-300">{control.label}</label>
              <span className="text-xs px-2 py-0.5 bg-gray-700 rounded-full text-gray-300">
                {control.value || 100}
              </span>
            </div>
            <div className="pl-0 mt-1">
              <input
                type="range"
                min={control.options && control.options[0] ? Number(control.options[0].value) : 0}
                max={control.options && control.options[control.options.length - 1] ? Number(control.options[control.options.length - 1].value) : 100}
                step={1}
                value={control.value || 100}
                onChange={(e) => {
                  const numericValue = Number(e.target.value);
                  console.log(`Slider value changed to: ${numericValue} for control ${control.id}`);
                  control.onChange(numericValue);
                }}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              {control.options && control.options.length > 0 && (
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '10px', 
                  color: '#9ca3af',
                  marginTop: '4px'
                }}>
                  {control.options.map((option: any) => (
                    <span 
                      key={option.value} 
                      style={{ cursor: 'pointer' }}
                      onClick={() => control.onChange(Number(option.value))}
                    >
                      {option.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
        
      case 'toggle':
        return (
          <div key={control.id} style={{ marginTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <label style={{ fontSize: '12px', color: '#9ca3af' }}>{control.label}</label>
            <div
              style={{
                position: 'relative',
                display: 'inline-flex',
                alignItems: 'center',
                width: '36px',
                height: '20px',
                borderRadius: '9999px',
                cursor: 'pointer',
                backgroundColor: control.value ? '#3b82f6' : '#4b5563',
                transition: 'background-color 0.2s ease'
              }}
              onClick={() => control.onChange(!control.value)}
            >
              <span style={{ position: 'absolute', left: '2px' }}>
                <div
                  style={{
                    position: 'absolute',
                    left: control.value ? '16px' : '2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '9999px',
                    backgroundColor: 'white',
                    transition: 'left 0.2s ease'
                  }}
                />
              </span>
            </div>
          </div>
        );
        
      default:
        return (
          <div key={control.id} style={{ 
            marginTop: '12px', 
            fontSize: '10px', 
            color: '#ef4444', 
            padding: '8px', 
            border: '1px solid rgba(239, 68, 68, 0.2)', 
            borderRadius: '6px', 
            backgroundColor: 'rgba(239, 68, 68, 0.1)' 
          }}>
            Unsupported control type: {control.type}
          </div>
        );
    }
  };

  // Toggle click-through mode
  const toggleClickThrough = () => {
    const newValue = !clickThrough;
    
    if (onClickThrough) {
      onClickThrough(newValue);
    }
    
    // The Electron API call is now handled in the App component
    // through the isClickThrough state effect
  };

  // Quit application
  const quitApplication = () => {
    if (window.electronAPI) {
      window.electronAPI.app.quit();
    }
  };

  // Toggle widget menu
  const toggleWidgetMenu = () => {
    setShowWidgetMenu(!showWidgetMenu);
  };

  // Toggle showing active widgets list
  const toggleActiveWidgetsList = () => {
    // If we're about to close the active widgets section and there's a selected widget, unselect it
    if (showActiveWidgets && selectedWidget) {
      setSelectedWidget(null);
    }
    
    setShowActiveWidgets(!showActiveWidgets);
  };

  // Auto-reconnect when connection is lost
  useEffect(() => {
    if (!isConnected && !reconnecting) {
      handleReconnect();
    }
  }, [isConnected, reconnecting, handleReconnect]);

  // Listen for widget click events
  useEffect(() => {
    const handleWidgetClick = (e: any) => {
      if (e && e.detail && e.detail.widget) {
        setSelectedWidget(e.detail.widget);
      }
    };

    window.addEventListener('widget:click', handleWidgetClick);
    
    return () => {
      window.removeEventListener('widget:click', handleWidgetClick);
    };
  }, []);

  // Ensure proper cleanup when component is unmounted
  useEffect(() => {
    // Get WebSocketService instance
    const webSocketService = WebSocketService.getInstance();
    
    return () => {
      // Clean up all listeners associated with this component
      webSocketService.removeListeners('control-panel-telemetry-connection');
    };
  }, []);

  // Initialize configuration and get display ID
  useEffect(() => {
    console.log('ControlPanel: Initializing configuration and getting display ID');
    
    // Get current display ID
    if (window.electronAPI && window.electronAPI.app) {
      // Use type assertion to handle the API method
      console.log('ControlPanel: electronAPI available, getting display ID');
      const appApi = window.electronAPI.app as any;
      if (appApi.getCurrentDisplayId) {
        appApi.getCurrentDisplayId().then((response: any) => {
          console.log('ControlPanel: getCurrentDisplayId response:', response);
          if (response.success) {
            // Calculate a consistent display ID based on dimensions instead of using the system-provided ID
            // This ensures the ID remains the same across reboots
            if (response.displayBounds) {
              // Calculate ID as height × width + width
              const { width, height } = response.displayBounds;
              const calculatedDisplayId = (height * width) + width;
              
              console.log(`ControlPanel: Using calculated display ID: ${calculatedDisplayId} from dimensions ${width}x${height}`);
              setCurrentDisplayId(calculatedDisplayId);
              
              // Load list of saved panels for this display
              console.log('ControlPanel: Loading saved panel configs for display:', calculatedDisplayId);
              const configService = ConfigService.getInstance();
              configService.listPanelConfigs().then(configs => {
                console.log('ControlPanel: Saved panel configs:', configs);
                setSavedPanels(configs);
              }).catch(err => {
                console.error('ControlPanel: Error listing panel configs:', err);
              });
            } else {
              // Fallback to system ID if bounds not available
              setCurrentDisplayId(response.displayId);
              console.warn('ControlPanel: Display bounds not available, using system ID:', response.displayId);
              
              // Load list of saved panels for this display
              const configService = ConfigService.getInstance();
              configService.listPanelConfigs().then(configs => {
                setSavedPanels(configs);
              }).catch(err => {
                console.error('ControlPanel: Error listing panel configs:', err);
              });
            }
          }
        }).catch(err => {
          console.error('ControlPanel: Error getting current display ID:', err);
        });
      } else {
        console.warn('ControlPanel: getCurrentDisplayId method not available');
      }
    } else {
      console.warn('ControlPanel: electronAPI or app not available');
    }

    // Listen for display ID changes
    if (window.electronAPI?.on) {
      console.log('ControlPanel: Setting up display:id event listener');
      const removeListener = window.electronAPI.on('display:id', (displayId: number, displayBounds?: { width: number, height: number }) => {
        console.log('ControlPanel: Received display:id event with ID:', displayId);
        
        // Calculate consistent ID based on dimensions if available
        if (displayBounds) {
          const { width, height } = displayBounds;
          const calculatedDisplayId = (height * width) + width;
          console.log(`ControlPanel: Using calculated display ID: ${calculatedDisplayId} from dimensions ${width}x${height}`);
          setCurrentDisplayId(calculatedDisplayId);
        } else {
          // Fallback to system ID
          setCurrentDisplayId(displayId);
          console.warn('ControlPanel: Display bounds not available in event, using system ID:', displayId);
        }
        
        // Reload panel list for the new display
        const configService = ConfigService.getInstance();
        configService.listPanelConfigs().then(configs => {
          console.log('ControlPanel: Updated saved panel configs:', configs);
          setSavedPanels(configs);
        }).catch(err => {
          console.error('ControlPanel: Error listing updated panel configs:', err);
        });
      });
      
      return () => {
        if (removeListener) removeListener();
      };
    } else {
      console.warn('ControlPanel: on method not available for event listening');
    }
  }, []);

  // Auto-load default panel configuration on startup
  useEffect(() => {
    // Only try to auto-load if we have current display ID and active widgets is empty
    if (currentDisplayId !== null && activeWidgets.length === 0) {
      // Try to load the default config for this display
      const configService = ConfigService.getInstance();
      configService.loadPanelConfig('Default').then(config => {
        if (config && config.widgets && config.widgets.length > 0) {
          // Apply config widgets
          config.widgets.forEach(widgetConfig => {
            if (widgetConfig.enabled) {
              const newWidget = {
                id: widgetConfig.id,
                type: widgetConfig.type,
                title: widgetConfig.title,
                options: widgetConfig.options,
                state: widgetConfig.state,
                enabled: true
              };
              
              if (onAddWidget) {
                onAddWidget(newWidget);
              }
              
              // Set widget position, opacity, etc.
              if (widgetConfig.position) {
                const posEvent = new CustomEvent('widget:position', { 
                  detail: { 
                    widgetId: widgetConfig.id, 
                    position: widgetConfig.position 
                  }
                });
                window.dispatchEvent(posEvent);
              }
              
              // Apply other widget properties
              if (widgetConfig.opacity !== undefined) {
                const opacityEvent = new CustomEvent('widget:opacity', { 
                  detail: { 
                    widgetId: widgetConfig.id, 
                    opacity: widgetConfig.opacity 
                  }
                });
                window.dispatchEvent(opacityEvent);
                
                // Update local state
                dispatchWidgetAppearance({
                  type: 'SET_OPACITY',
                  widgetId: widgetConfig.id,
                  value: widgetConfig.opacity
                });
              }
              
              // Set background transparency if specified
              if (widgetConfig.isBackgroundTransparent !== undefined) {
                const bgEvent = new CustomEvent('widget:background-transparent', { 
                  detail: { 
                    widgetId: widgetConfig.id, 
                    transparent: widgetConfig.isBackgroundTransparent 
                  }
                });
                window.dispatchEvent(bgEvent);
                
                // Update local state
                dispatchWidgetAppearance({
                  type: 'SET_BACKGROUND_TRANSPARENT',
                  widgetId: widgetConfig.id,
                  value: widgetConfig.isBackgroundTransparent
                });
              }
            }
          });
          
          setPanelName('Default');
        }
      });
    }
  }, [currentDisplayId, activeWidgets, onAddWidget, dispatchWidgetAppearance]);

  return (
    <>
      {/* Debug indicator */}
      <div 
        style={{
          position: 'fixed',
          top: '10px',
          left: '10px', 
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          padding: '5px',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '12px',
          pointerEvents: 'none'
        }}
      >
        Control Panel: {isConnected ? 'Connected' : 'Disconnected'}
      </div>
      
      {/* Main control panel */}
      <BaseDraggableComponent
        initialPosition={initialPosition}
        style={{ 
          width: '400px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.3), 0 0 0 1px rgba(100, 130, 255, 0.2)',
          border: '1px solid rgba(100, 130, 255, 0.2)',
          backgroundColor: 'rgba(20, 25, 40, 0.9)',
          borderRadius: '12px',
          color: '#f0f0f0',
          zIndex: 1000,
          backdropFilter: 'blur(5px)',
          transition: 'all 0.2s ease',
          overflow: 'hidden'
        }}
      >
        {/* Header */}
        <div 
          className="drag-handle"
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, rgba(20, 25, 40, 0.95), rgba(40, 60, 90, 0.9))',
            borderBottom: '1px solid rgba(100, 150, 255, 0.2)',
            padding: '12px 16px',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px'
          }}
        >
          <h2 style={{ fontSize: '16px', fontWeight: 600, letterSpacing: '0.5px', display: 'flex', alignItems: 'center' }}>
            <span style={{ color: '#3b82f6', marginRight: '8px', fontSize: '18px' }}>•</span>
            Control Panel
          </h2>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div 
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: isConnected ? '#22c55e' : '#ef4444',
                boxShadow: isConnected ? '0 0 8px rgba(34, 197, 94, 0.5)' : '0 0 8px rgba(239, 68, 68, 0.5)',
                animation: isConnected ? 'pulse 2s infinite' : 'none',
                transition: 'background-color 0.3s'
              }}
              title={`${isConnected ? 'Connected' : 'Disconnected'}`}
            />
            
            <button 
              onClick={handleReconnect}
              disabled={reconnecting}
              style={{
                fontSize: '11px',
                padding: '5px 10px',
                borderRadius: '6px',
                backgroundColor: reconnecting ? '#374151' : '#374151',
                color: reconnecting ? '#9ca3af' : '#e5e7eb',
                border: 'none',
                cursor: reconnecting ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              {reconnecting ? 'Connecting...' : 'Reconnect'}
            </button>
          </div>
        </div>

        {/* Content area */}
        <div style={{ 
          padding: '20px', 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '12px',
          maxHeight: 'calc(100vh - 120px)',
          overflowY: 'auto'
        }}>
          {/* Top Row: Hide Panel, Show All, and Quit buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 1fr 1fr', gap: '12px' }}>
            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: clickThrough 
                  ? (hideButtonHover ? '#ca8a04' : '#eab308') 
                  : (hideButtonHover ? '#1d4ed8' : '#2563eb'),
                color: clickThrough ? '#111827' : 'white',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: hideButtonHover 
                  ? '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(100, 130, 255, 0.2)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                transform: hideButtonHover ? 'translateY(-1px)' : 'none'
              }}
              onClick={toggleClickThrough}
              onMouseEnter={() => setHideButtonHover(true)}
              onMouseLeave={() => setHideButtonHover(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '14px', height: '14px', marginRight: '6px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                {clickThrough ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                )}
              </svg>
              {clickThrough ? 'Show Panel' : 'Hide Panel'}
            </button>
            
            <button 
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 500,
                backgroundColor: showAllButtonHover ? '#4338ca' : '#4f46e5',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: showAllButtonHover 
                  ? '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(100, 130, 255, 0.2)' 
                  : '0 2px 4px rgba(0, 0, 0, 0.1)',
                transform: showAllButtonHover ? 'translateY(-1px)' : 'none'
              }}
              onClick={handleShowAllWidgets}
              onMouseEnter={() => setShowAllButtonHover(true)}
              onMouseLeave={() => setShowAllButtonHover(false)}
            >
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '14px', height: '14px', marginRight: '6px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Show All
            </button>
            
            {window.electronAPI && (
              <>
                <button 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px 0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    backgroundColor: debugButtonHover ? '#0369a1' : '#0284c7',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: debugButtonHover 
                      ? '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(2, 132, 199, 0.3)' 
                      : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transform: debugButtonHover ? 'translateY(-1px)' : 'none'
                  }}
                  onClick={() => {
                    if (window.electronAPI) {
                      // Use type assertion to access invoke method
                      (window.electronAPI as any).invoke('app:openDevTools');
                    }
                  }}
                  onMouseEnter={() => setDebugButtonHover(true)}
                  onMouseLeave={() => setDebugButtonHover(false)}
                  title="Open Developer Tools"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                </button>
                
                <button 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '10px 0',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 500,
                    backgroundColor: quitButtonHover ? '#b91c1c' : '#dc2626',
                    color: 'white',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: quitButtonHover 
                      ? '0 4px 12px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(220, 38, 38, 0.3)' 
                      : '0 2px 4px rgba(0, 0, 0, 0.1)',
                    transform: quitButtonHover ? 'translateY(-1px)' : 'none'
                  }}
                  onClick={quitApplication}
                  onMouseEnter={() => setQuitButtonHover(true)}
                  onMouseLeave={() => setQuitButtonHover(false)}
                  title="Quit Application"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            )}
          </div>

          {/* Reconnect Button - shown when disconnected */}
          {!isConnected && (
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                padding: '8px 12px', 
                marginTop: '8px', 
                backgroundColor: 'rgba(239, 68, 68, 0.15)', 
                color: '#ef4444', 
                borderRadius: '8px',
                position: 'relative',
                cursor: 'pointer'
              }}
              onClick={handleReconnect}
            >
              {reconnecting ? (
                <>
                  <svg className="animate-spin" style={{ width: '16px', height: '16px', marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Reconnecting...
                </>
              ) : (
                <>
                  <svg style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Reconnect to WebSocket
                </>
              )}
            </div>
          )}
          
          {/* Configuration Button */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: showConfigPanel ? 'rgba(6, 182, 212, 0.2)' : 'rgba(6, 182, 212, 0.1)',
              borderRadius: '8px',
              border: showConfigPanel ? '1px solid rgba(6, 182, 212, 0.5)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginTop: '8px'
            }}
            onClick={toggleConfigPanel}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 500,
              color: '#06b6d4'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
              </svg>
              Panel Configurations {currentDisplayId !== null ? `(Display ${currentDisplayId})` : ''}
            </div>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              style={{ 
                width: '16px', 
                height: '16px', 
                color: '#06b6d4',
                transform: showConfigPanel ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease' 
              }} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {/* Configuration Panel */}
          {showConfigPanel && (
            <div style={{ 
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '4px'
            }}>
              <div style={{ display: 'flex', marginBottom: '10px', gap: '8px' }}>
                <input
                  type="text"
                  value={panelName}
                  onChange={(e) => setPanelName(e.target.value)}
                  style={{ 
                    flex: 1,
                    backgroundColor: 'rgba(30, 41, 59, 0.8)',
                    color: 'white',
                    border: '1px solid rgba(75, 85, 99, 0.4)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '12px'
                  }}
                  placeholder="Configuration name"
                />
                <button
                  onClick={(e) => {
                    console.log('Save Config button clicked');
                    e.preventDefault(); // Prevent any default action
                    handleSavePanel();
                  }}
                  style={{ 
                    backgroundColor: 'rgba(6, 182, 212, 0.15)',
                    color: '#06b6d4',
                    border: '1px solid rgba(6, 182, 212, 0.3)',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  Save Config
                </button>
              </div>
              
              {savedPanels.length > 0 ? (
                <div style={{ maxHeight: '120px', overflowY: 'auto' }}>
                  {savedPanels.map(name => (
                    <div
                      key={name}
                      style={{ 
                        padding: '8px 10px',
                        backgroundColor: 'rgba(30, 41, 59, 0.6)',
                        color: 'white',
                        borderRadius: '4px',
                        marginBottom: '4px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                      onClick={() => handleLoadPanel(name)}
                    >
                      <span>{name}</span>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {/* Delete Button */}
                        <button
                          onClick={(e) => handleDeletePanel(name, e)}
                          style={{ 
                            padding: '2px',
                            backgroundColor: 'rgba(220, 38, 38, 0.15)',
                            color: '#ef4444',
                            border: '1px solid rgba(220, 38, 38, 0.3)',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '20px',
                            height: '20px'
                          }}
                          title="Delete layout"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '14px', height: '14px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        
                        {/* Load Button */}
                        <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '14px', height: '14px', color: '#9ca3af' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  padding: '10px', 
                  backgroundColor: 'rgba(30, 41, 59, 0.6)', 
                  borderRadius: '4px',
                  fontSize: '12px',
                  color: '#9ca3af',
                  textAlign: 'center'
                }}>
                  No saved configurations for this display
                </div>
              )}
            </div>
          )}

          {/* Widgets Library Section Header */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'rgba(37, 99, 235, 0.15)',
              borderRadius: '8px',
              border: showWidgetMenu ? '1px solid rgba(147, 197, 253, 0.5)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginTop: '8px'
            }}
            onClick={toggleWidgetMenu}
            onMouseEnter={() => setMenuButtonHover(true)}
            onMouseLeave={() => setMenuButtonHover(false)}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 500,
              color: '#2563eb'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Widgets Library
            </div>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              style={{ 
                width: '16px', 
                height: '16px', 
                color: '#3b82f6',
                transform: showWidgetMenu ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease' 
              }} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Widget Menu Content */}
          {showWidgetMenu && (
            <div style={{ 
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '4px'
            }}>
              <div style={{ 
                maxHeight: '300px',
                overflowY: 'auto',
                paddingRight: '10px',
                marginRight: '-10px'
              }}>
                {/* Telemetry Widgets */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <h4 style={{ fontSize: '12px', fontWeight: 500, color: '#60a5fa', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Telemetry Data</h4>
                    <svg style={{ width: '16px', height: '16px', color: '#60a5fa' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  
                  {renderedTelemetryWidgets}
                </div>
                
                {/* Other Widget Types */}
                {renderedWidgetCategories}
              </div>
            </div>
          )}

          {/* Active Widgets Section Header */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '10px 14px',
              backgroundColor: 'rgba(20, 184, 166, 0.15)',
              borderRadius: '8px',
              border: showActiveWidgets ? '1px solid rgba(94, 234, 212, 0.5)' : '1px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginTop: '8px'
            }}
            onClick={toggleActiveWidgetsList}
            onMouseEnter={() => setActiveWidgetsButtonHover(true)}
            onMouseLeave={() => setActiveWidgetsButtonHover(false)}
          >
            <div style={{ 
              display: 'flex', 
              alignItems: 'center',
              fontSize: '13px',
              fontWeight: 500,
              color: '#14b8a6'
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', marginRight: '8px' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Active Widgets {enabledWidgets.length > 0 && `(${enabledWidgets.length})`}
            </div>
            <svg 
              xmlns="http://www.w3.org/2000/svg" 
              style={{ 
                width: '16px', 
                height: '16px', 
                color: '#14b8a6',
                transform: showActiveWidgets ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease' 
              }} 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {/* Active Widgets Content */}
          {showActiveWidgets && (
            <div style={{ 
              backgroundColor: 'rgba(30, 41, 59, 0.4)',
              borderRadius: '8px',
              padding: '16px',
              marginTop: '4px'
            }}>
              {renderedActiveWidgets}
            </div>
          )}
          
          {/* Selected Widget Section */}
          {renderedSelectedWidgetSection}
        </div>
      </BaseDraggableComponent>
    </>
  );
};

export default ControlPanel; 