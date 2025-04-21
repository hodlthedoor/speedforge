import React, { useState, useEffect, useCallback } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import { Widget } from './Widget';
import { SimpleTelemetryWidget, availableMetrics } from './SimpleTelemetryWidget';
import { v4 as uuidv4 } from 'uuid';
import PedalTraceWidget from './PedalTraceWidget';
import ShiftIndicatorWidget from './ShiftIndicatorWidget';
import TrackMapWidget from './TrackMapWidget';
import SpeedWidget from './SpeedWidget';
import WidgetRegistry from '../widgets/WidgetRegistry';
import { WebSocketService } from '../services/WebSocketService';
import { useTelemetryData } from '../hooks/useTelemetryData';
import { WidgetManager } from '../services/WidgetManager';

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
  const [widgetBackgroundTransparent, setWidgetBackgroundTransparent] = useState<Record<string, boolean>>({});
  const [trackMapWidgetStates, setTrackMapWidgetStates] = useState<Record<string, TrackMapWidgetState>>({});
  const [reconnecting, setReconnecting] = useState(false);
  const [autoNewWindowsForDisplays, setAutoNewWindowsForDisplays] = useState(true);
  const [displays, setDisplays] = useState<any[]>([]);
  const [currentDisplayId, setCurrentDisplayId] = useState<number | null>(null);
  
  // Use telemetry hook to get connection status
  const { data, isConnected } = useTelemetryData('control-panel', {
    metrics: ['PlayerTrackSurface'],
    throttleUpdates: true,
    updateInterval: 1000
  });

  // Auto-reconnect when connection is lost
  useEffect(() => {
    if (!isConnected && !reconnecting) {
      console.log('Connection lost, attempting auto-reconnect...');
      handleReconnect();
    }
  }, [isConnected, reconnecting]);

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

  // Function to manually reconnect
  const handleReconnect = () => {
    setReconnecting(true);
    const webSocketService = WebSocketService.getInstance();
    if (webSocketService.reconnect) {
      console.log('Triggering manual WebSocket reconnect');
      webSocketService.reconnect();
      
      // Reset reconnecting state after a timeout regardless of connection status
      setTimeout(() => {
        setReconnecting(false);
      }, 5000);
    } else {
      console.warn('WebSocketService.reconnect() method not found');
      setReconnecting(false);
    }
  };
  
  // Handle track map widget state changes - defined early
  const handleTrackMapStateChange = useCallback((widgetId: string, state: TrackMapWidgetState) => {
    setTrackMapWidgetStates(prev => ({
      ...prev,
      [widgetId]: state
    }));
  }, []);
  
  // Update widget state for any widget type
  const updateWidgetState = useCallback((widgetId: string, updates: any) => {
    // Get the widget
    const widget = activeWidgets.find(w => w.id === widgetId);
    if (!widget) {
      console.error(`[CRITICAL] Cannot update widget state: widget with ID ${widgetId} not found`);
      return;
    }
    
    console.log(`[SimpleControlPanel] updateWidgetState called for widget ${widgetId} with updates:`, updates);
    
    // Update widget state in the widget object itself
    if (!widget.state) widget.state = {};
    widget.state = { ...widget.state, ...updates };
    console.log(`[SimpleControlPanel] Widget state after update:`, widget.state);
    
    // Handle track map widgets specifically
    if (widget.type === 'track-map') {
      const event = new CustomEvent('track-map:control', { 
        detail: { widgetId, updates }
      });
      window.dispatchEvent(event);
      
      // Also update local track map state
      setTrackMapWidgetStates(prev => ({
        ...prev,
        [widgetId]: { ...(prev[widgetId] || {}), ...updates }
      }));
    }
    
    // Update the widget state using WidgetManager
    console.log(`[SimpleControlPanel] Calling WidgetManager.updateWidgetState for widget ${widgetId}`);
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

  const toggleAutoNewWindows = () => {
    const newState = !autoNewWindowsForDisplays;
    console.log(`Toggling automatic new windows for displays: ${newState}`);
    setAutoNewWindowsForDisplays(newState);
    
    // If running in Electron, also toggle via the API - use type assertion for TypeScript
    if (window.electronAPI) {
      // Call the API if it exists, using type assertion to avoid TypeScript errors
      try {
        const api = window.electronAPI.app as any;
        if (typeof api.toggleAutoNewWindows === 'function') {
          api.toggleAutoNewWindows(newState);
        }
      } catch (error) {
        console.error('Error toggling auto new windows:', error);
      }
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

  const handleBackgroundTransparencyToggle = (widgetId: string) => {
    const newValue = !(widgetBackgroundTransparent[widgetId] || false);
    
    setWidgetBackgroundTransparent(prev => ({
      ...prev,
      [widgetId]: newValue
    }));
    
    // Dispatch event to update widget background transparency
    const event = new CustomEvent('widget:background-transparent', { 
      detail: { widgetId, transparent: newValue }
    });
    window.dispatchEvent(event);
    
    // If running in Electron, set the widget background transparency via API
    if (window.electronAPI) {
      try {
        console.log(`Requesting Electron to set background transparency for widget ${widgetId} to ${newValue}`);
        // Use type assertion to access the widgets API
        const widgetsAPI = window.electronAPI as unknown as { widgets: { updateParams: (id: string, params: any) => Promise<any> } };
        if (widgetsAPI.widgets && widgetsAPI.widgets.updateParams) {
          widgetsAPI.widgets.updateParams(widgetId, { backgroundTransparent: newValue })
            .catch((error: any) => {
              console.error('Error setting widget background transparency:', error);
            });
        }
      } catch (error) {
        console.error('Error accessing widget API:', error);
      }
    }
  };

  // Get controls for selected widget
  const getWidgetControls = useCallback((widget: any) => {
    if (!widget || !widget.type) return [];
    
    // Get widget state based on widget type
    let widgetState: Record<string, any> = {};
    
    // Special handling for track-map widgets
    if (widget.type === 'track-map') {
      widgetState = trackMapWidgetStates[widget.id] || {};
    } 
    // For all widgets, include any state stored in the widget object
    if (widget.state) {
      widgetState = { ...widgetState, ...widget.state };
    }
    
    // For pedal-trace widgets, ensure historyLength is included if not already present
    if (widget.type === 'pedal-trace') {
      widgetState = { 
        ...widgetState,
        historyLength: widgetState.historyLength || 100, // Default to 100 if not set
        width: widgetState.width || 480 // Default to 480px if not set
      };
    }
    
    console.log(`Getting controls for widget ${widget.id} (${widget.type}) with state:`, widgetState);
      
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
            className="btn btn-sm btn-primary bg-blue-500 hover:bg-blue-600 text-white transition-all rounded px-3 py-1.5 text-xs font-medium shadow-sm hover:shadow"
            onClick={() => control.onChange(control.value)}
          >
            {control.label}
          </button>
        );
        
      case 'select':
        return (
          <div key={control.id} className="mt-3">
            <label className="detail-label text-sm text-gray-300 mb-1.5 block">{control.label}:</label>
            <div className="flex gap-1.5">
              {control.options.map((option: any) => (
                <button 
                  key={option.value}
                  className={`px-2.5 py-1 rounded-md text-xs ${
                    control.value === option.value 
                      ? 'bg-blue-500 hover:bg-blue-600 text-white shadow-sm' 
                      : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                  } transition-all`}
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
                  
                  // Special logging for historyLength which seems to have issues
                  if (control.id === 'historyLength') {
                    console.log(`[Debug] historyLength slider changed to: ${numericValue}. Current widget state:`, selectedWidget?.state);
                    
                    // Add debugging for callback
                    console.log(`[DEBUG] About to call control.onChange with value: ${numericValue}`);
                    console.log(`[DEBUG] control.onChange is:`, control.onChange);
                    console.log(`[DEBUG] Selected widget:`, selectedWidget);
                  }
                  
                  control.onChange(numericValue);
                }}
                className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              {control.options && control.options.length > 0 && (
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  {control.options.map((option: any) => (
                    <span 
                      key={option.value} 
                      className="cursor-pointer hover:text-blue-300 transition-colors" 
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
          <div key={control.id} className="mt-3 flex items-center justify-between">
            <label className="detail-label text-sm text-gray-300">{control.label}</label>
            <div
              className={`relative inline-flex items-center w-11 h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${
                control.value ? 'bg-blue-600' : 'bg-gray-700'
              }`}
              onClick={() => control.onChange(!control.value)}
            >
              <span className="sr-only">Toggle {control.label}</span>
              <div
                className={`absolute left-0.5 inline-block w-5 h-5 transform rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
                  control.value ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </div>
          </div>
        );
        
      default:
        return (
          <div key={control.id} className="mt-3 text-xs text-red-400 p-2 border border-red-400/20 rounded bg-red-400/10">
            Unsupported control type: {control.type}
          </div>
        );
    }
  };

  // Fetch displays information
  const fetchDisplays = useCallback(() => {
    if (window.electronAPI) {
      const api = window.electronAPI.app as any;
      if (api && typeof api.getDisplays === 'function') {
        api.getDisplays()
          .then((response: any) => {
            if (response.success && response.displays) {
              setDisplays(response.displays);
            }
          })
          .catch((error: any) => {
            console.error('Error getting displays:', error);
          });
      }
    }
  }, []);
  
  // Get display information when component mounts
  useEffect(() => {
    fetchDisplays();
  }, [fetchDisplays]);
  
  // Function to show all widgets (reset opacity and transparency)
  const handleShowAllWidgets = () => {
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
        
        // If running in Electron, update widget parameters via API
        if (window.electronAPI) {
          try {
            const widgetsAPI = window.electronAPI as unknown as { 
              widgets: { 
                updateParams: (id: string, params: any) => Promise<any>,
                setOpacity: (id: string, opacity: number) => Promise<any>
              } 
            };
            
            // Update opacity through Electron API
            if (widgetsAPI.widgets?.setOpacity) {
              widgetsAPI.widgets.setOpacity(widget.id, 1)
                .catch((error: any) => {
                  console.error('Error updating widget opacity:', error);
                });
            }
            
            // Update transparency through Electron API
            if (widgetsAPI.widgets?.updateParams) {
              widgetsAPI.widgets.updateParams(widget.id, { backgroundTransparent: false })
                .catch((error: any) => {
                  console.error('Error updating widget transparency:', error);
                });
            }
          } catch (error) {
            console.error('Error accessing widget API:', error);
          }
        }
      }
    });
    
    // Update state
    setWidgetOpacity(newOpacity);
    setWidgetBackgroundTransparent(newTransparency);
  };
  
  // Listen for display ID from main process
  useEffect(() => {
    // Check if we already have a stored display ID
    if ((window as any).electronDisplayId) {
      setCurrentDisplayId((window as any).electronDisplayId);
      return;
    }
    
    if (window.electronAPI) {
      // Get current display ID
      const api = window.electronAPI.app as any;
      if (api && typeof api.getCurrentDisplayId === 'function') {
        api.getCurrentDisplayId()
          .then((response: any) => {
            if (response.success && response.displayId) {
              console.log(`Current display ID: ${response.displayId}`);
              setCurrentDisplayId(response.displayId);
              (window as any).electronDisplayId = response.displayId;
            }
          })
          .catch((error: any) => {
            console.error('Error getting current display ID:', error);
          });
      }
      
      // Listen for display ID messages
      if (window.electronAPI.on) {
        const removeListener = window.electronAPI.on('display:id', (displayId: number) => {
          console.log(`Received display ID from main process: ${displayId}`);
          setCurrentDisplayId(displayId);
          (window as any).electronDisplayId = displayId;
        });
        
        return () => {
          if (removeListener) removeListener();
        };
      }
    }
  }, []);
  
  // Function to close a specific display window
  const closeDisplayWindow = (displayId: number) => {
    if (window.electronAPI) {
      const api = window.electronAPI.app as any;
      if (api && typeof api.closeWindowForDisplay === 'function') {
        console.log(`Closing window for display ID: ${displayId}`);
        
        // If this is our own display, close widgets first
        if (currentDisplayId === displayId) {
          console.log('Closing our own window - cleaning up widgets first');
          // Close all active widgets first
          if (Array.isArray(activeWidgets)) {
            activeWidgets.forEach(widget => {
              if (widget.enabled) {
                console.log(`Closing widget ${widget.id}`);
                closeWidget(widget.id);
              }
            });
          }
        }
        
        // Close the window
        api.closeWindowForDisplay(displayId)
          .then((response: any) => {
            console.log('Close window response:', response);
            // Update displays list after closing
            if (api.getDisplays) {
              api.getDisplays().then((res: any) => {
                if (res.success && res.displays) {
                  setDisplays(res.displays);
                }
              });
            }
          })
          .catch((error: any) => {
            console.error('Error closing window:', error);
          });
      }
    }
  };

  // Function to close all widgets and then close the window
  const closeWindowAndWidgets = () => {
    console.log('Closing all widgets and current window');
    
    // Close all active widgets first
    if (Array.isArray(activeWidgets)) {
      activeWidgets.forEach(widget => {
        if (widget.enabled) {
          console.log(`Closing widget ${widget.id}`);
          closeWidget(widget.id);
        }
      });
    }
    
    // Then close the window using Electron API
    if (window.electronAPI) {
      const api = window.electronAPI.app as any;
      if (api && typeof api.closeWindowForDisplay === 'function') {
        console.log('Closing current window');
        api.closeWindowForDisplay()
          .then((response: any) => {
            console.log('Close window response:', response);
          })
          .catch((error: any) => {
            console.error('Error closing window:', error);
          });
      } else {
        console.error('closeWindowForDisplay function not available');
      }
    }
  };

  return (
    <BaseDraggableComponent 
      initialPosition={initialPosition}
      className={`w-[400px] max-h-[80vh] p-4 flex flex-col shadow-xl border border-blue-300/10 bg-gray-900/90 rounded-lg text-gray-100 z-[1000] backdrop-blur-md ${clickThrough ? 'click-through opacity-90 hover:opacity-100' : ''} transition-all duration-200`}
    >
      {/* Header */}
      <div className="w-full flex items-center justify-between bg-gradient-to-r from-gray-900/90 to-gray-800/90 border-b border-gray-700 px-6 py-4 drag-handle shadow-sm">
        <h2 className="text-base font-semibold tracking-wide flex items-center">
          <span className="text-blue-400 mr-2">•</span>
          Control Panel
        </h2>
        
        <div className="flex items-center gap-3">
          <div 
            className={`w-2.5 h-2.5 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'} transition-colors duration-300`}
            title={`Game ${isConnected ? 'Connected' : 'Disconnected'}`}
          ></div>
          
          <button 
            onClick={handleReconnect}
            disabled={reconnecting}
            title="Force WebSocket reconnection"
            className={`text-xs px-3 py-1 rounded-md transition-all ${
              reconnecting 
                ? 'bg-gray-700 text-gray-400 cursor-not-allowed' 
                : 'bg-gray-700 hover:bg-blue-500 text-gray-200 hover:text-white'
            }`}
          >
            {reconnecting ? 'Connecting...' : 'Reconnect'}
          </button>
        </div>
      </div>

      {/* Selected Widget Section - Fixed */}
      {selectedWidget && (
        <div className="border-b border-gray-700 bg-gradient-to-b from-gray-900/70 to-gray-800/60">
          <div className="px-6 py-4">
            <div className="widget-details-panel space-y-4">
              <div className="widget-details-header flex items-center justify-between">
                <h4 className="text-sm font-semibold text-blue-300">
                  {selectedWidget.title || `Widget ${selectedWidget.id.slice(0, 6)}`}
                </h4>
                <button 
                  className="hover:text-red-400 transition-colors p-1.5 rounded-full hover:bg-gray-700/50" 
                  onClick={() => closeWidget(selectedWidget.id)}
                  title="Close Widget"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-3 text-sm bg-gray-800/30 rounded-lg p-3">
                <div className="flex items-center justify-between text-gray-300">
                  <span className="font-medium text-gray-400">ID:</span>
                  <span className="font-mono text-xs bg-gray-900/50 px-2 py-0.5 rounded">{selectedWidget.id.slice(0, 8)}...</span>
                </div>
                <div className="flex items-center justify-between text-gray-300">
                  <span className="font-medium text-gray-400">Type:</span>
                  <span className="bg-blue-900/30 text-blue-200 px-2 py-0.5 rounded-md text-xs">{selectedWidget.type || 'default'}</span>
                </div>
                {selectedWidget.options?.metric && (
                  <div className="flex items-center justify-between text-gray-300">
                    <span className="font-medium text-gray-400">Metric:</span>
                    <span className="bg-gray-700/50 px-2 py-0.5 rounded-md text-xs">{selectedWidget.options.metric}</span>
                  </div>
                )}
              </div>
              
              {/* Dynamic Widget Controls from Registry */}
              {getWidgetControls(selectedWidget).length > 0 && (
                <div className="space-y-3 pt-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-300">Widget Controls</span>
                    <div className="h-px flex-grow bg-gray-700/50"></div>
                  </div>
                  <div className="space-y-3 bg-gray-800/30 rounded-lg p-3">
                    {getWidgetControls(selectedWidget).map(control => 
                      renderWidgetControl(control)
                    )}
                  </div>
                </div>
              )}
              
              <div className="space-y-3 pt-1">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-300">Appearance</span>
                  <div className="h-px flex-grow bg-gray-700/50"></div>
                </div>
                <div className="space-y-3 bg-gray-800/30 rounded-lg p-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-400">Opacity</label>
                      <span className="text-xs text-gray-400">
                        {Math.round((widgetOpacity[selectedWidget.id] ?? 1) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.3"
                      max="1"
                      step="0.1"
                      value={widgetOpacity[selectedWidget.id] ?? 1}
                      onChange={(e) => handleOpacityChange(selectedWidget.id, parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between pt-2">
                    <span className="text-sm font-medium text-gray-400">Background</span>
                    <button
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                        widgetBackgroundTransparent[selectedWidget.id] 
                          ? 'bg-blue-500/80 hover:bg-blue-500 text-white' 
                          : 'bg-gray-700 hover:bg-gray-600 text-gray-200'
                      }`}
                      onClick={() => handleBackgroundTransparencyToggle(selectedWidget.id)}
                    >
                      {widgetBackgroundTransparent[selectedWidget.id] 
                        ? '✓ Transparent' 
                        : 'Make Transparent'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-none">
        <div className="p-6">
          {/* Main Controls Section */}
          <div className="flex flex-col gap-4 bg-gray-800/60 rounded-lg p-5 shadow-inner border border-gray-700/30">
            {/* Top Buttons */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <button 
                  className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm ${
                    clickThrough 
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-gray-900 hover:shadow' 
                      : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow'
                  }`}
                  onClick={toggleClickThrough}
                >
                  {clickThrough ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Show Panel
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      Hide Panel
                    </span>
                  )}
                </button>
                
                <button 
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-indigo-500 hover:bg-indigo-600 text-white transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                  onClick={handleShowAllWidgets}
                  title="Reset all widgets to default visibility"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Show All
                </button>
              </div>
              
              <button 
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-blue-500 hover:bg-blue-600 text-white transition-all shadow-sm hover:shadow flex items-center justify-center gap-2"
                onClick={toggleTelemetryOptions}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {showTelemetryOptions ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  )}
                </svg>
                {showTelemetryOptions ? 'Hide Widget Menu' : 'Show Widget Menu'}
              </button>
            </div>

            {/* Quit Button */}
            {window.electronAPI && (
              <button 
                className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-red-500/80 hover:bg-red-600 text-white transition-all shadow-sm hover:shadow-md duration-200 flex items-center justify-center gap-2 group"
                onClick={quitApplication}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:rotate-90 transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span className="group-hover:tracking-wider transition-all duration-300">Quit Application</span>
              </button>
            )}

            {/* Widget Options */}
            {showTelemetryOptions && (
              <div className="flex flex-col gap-4">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-gray-200">Widgets Library</h3>
                  <div className="h-px flex-grow bg-gray-700/50"></div>
                </div>
                
                <div className="flex flex-col gap-3">
                  <details className="group bg-gray-800/40 rounded-lg overflow-hidden">
                    <summary className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium bg-gradient-to-r from-blue-600/80 to-blue-500/80 hover:from-blue-600 hover:to-blue-500 text-white rounded-lg cursor-pointer transition-all outline-none">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Add Telemetry Widget
                      </div>
                      <svg className="w-4 h-4 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="p-4 bg-gray-800/60">
                      <div className="grid grid-cols-2 gap-4 debug-border debug-padding">
                        {availableMetrics.map(metric => (
                          <button 
                            key={metric.id}
                            style={{
                              padding: '12px 16px',
                              margin: '8px',
                              backgroundColor: 'rgba(55, 65, 81, 0.8)',
                              borderRadius: '8px',
                              fontSize: '12px',
                              fontWeight: '500',
                              color: 'white',
                              width: 'calc(100% - 16px)',
                              border: 'none',
                              boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                            }}
                            onClick={() => addTelemetryWidget(metric.id, metric.name)}
                          >
                            {metric.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </details>

                  <details className="group bg-gray-800/40 rounded-lg overflow-hidden">
                    <summary className="flex items-center justify-between w-full px-4 py-3 text-sm font-medium bg-gradient-to-r from-indigo-600/80 to-indigo-500/80 hover:from-indigo-600 hover:to-indigo-500 text-white rounded-lg cursor-pointer transition-all outline-none">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        Add Speedforge Widget
                      </div>
                      <svg className="w-4 h-4 transition-transform duration-300 group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <div className="p-4 bg-gray-800/60">
                      {Object.entries(widgetsByCategory()).map(([category, widgets]) => (
                        <div key={category} className="mb-4 last:mb-0">
                          <h4 className="text-xs font-medium uppercase tracking-wider text-blue-300 mb-2 flex items-center">
                            <span className="w-1.5 h-1.5 bg-blue-400 rounded-full mr-2"></span>
                            {category}
                          </h4>
                          <div className="grid grid-cols-2 gap-4 debug-border debug-padding">
                            {widgets.map(widget => (
                              <button 
                                key={widget.type}
                                style={{
                                  padding: '12px 16px',
                                  margin: '8px',
                                  backgroundColor: 'rgba(55, 65, 81, 0.8)',
                                  borderRadius: '8px',
                                  fontSize: '12px',
                                  fontWeight: '500',
                                  color: 'white',
                                  width: 'calc(100% - 16px)',
                                  border: 'none',
                                  boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
                                }}
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
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseDraggableComponent>
  );
};

export default SimpleControlPanel;