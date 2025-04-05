/// <reference path="../types/electron.d.ts" />
import React, { useState, useEffect } from 'react';
import { useWidgetManager } from '../widgets/WidgetManager';
import { WidgetContainer } from './WidgetContainer';

interface WidgetConfig {
  id: string;
  type: 'clock' | 'weather' | 'telemetry' | 'trace';
  name: string;
  params?: Record<string, any>;
  isLaunched: boolean;
  isVisible: boolean;
  opacity: number;
  width: number;
  height: number;
}

// For getting available telemetry metrics
const defaultTelemetryMetrics = [
  { value: 'speed_kph', label: 'Speed (KPH)' },
  { value: 'speed_mph', label: 'Speed (MPH)' },
  { value: 'rpm', label: 'RPM' },
  { value: 'gear', label: 'Gear' },
  { value: 'throttle_pct', label: 'Throttle' },
  { value: 'brake_pct', label: 'Brake' },
  { value: 'clutch_pct', label: 'Clutch' },
  { value: 'g_force_lat', label: 'Lateral G' },
  { value: 'g_force_lon', label: 'Longitudinal G' },
  { value: 'fuel_level', label: 'Fuel Level' },
  { value: 'fuel_pct', label: 'Fuel Percentage' },
  { value: 'current_lap_time', label: 'Current Lap' },
  { value: 'last_lap_time', label: 'Last Lap' },
  { value: 'best_lap_time', label: 'Best Lap' },
  { value: 'position', label: 'Position' },
  { value: 'lap_completed', label: 'Lap' }
];

// Define available widget types
const availableWidgets = [
  { id: 'clock', type: 'clock', name: 'Clock' },
  { id: 'weather', type: 'weather', name: 'Weather' },
  { id: 'telemetry', type: 'telemetry', name: 'Telemetry' },
  { id: 'trace', type: 'trace', name: 'Throttle/Brake Trace' },
];

export const ControlPanel: React.FC = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: 'clock-widget-1', type: 'clock', name: 'Clock Widget', params: { format24h: false, showTelemetry: true }, isLaunched: false, isVisible: true, opacity: 1, width: 300, height: 200 },
    { id: 'weather-widget-1', type: 'weather', name: 'Weather Widget', params: { location: 'New York' }, isLaunched: false, isVisible: true, opacity: 1, width: 300, height: 200 },
    { id: 'telemetry-widget-1', type: 'telemetry', name: 'Telemetry Widget', params: { metric: 'speed_kph' }, isLaunched: false, isVisible: true, opacity: 1, width: 300, height: 200 }
  ]);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
  const [availableTelemetryMetrics, setAvailableTelemetryMetrics] = useState(defaultTelemetryMetrics);
  const isElectron = window.electronAPI !== undefined;

  useEffect(() => {
    // On component mount, check for already running widgets
    if (isElectron) {
      const checkRunningWidgets = async () => {
        try {
          const result = await window.electronAPI.widgets.getAll();
          if (result.success) {
            setWidgets(prevWidgets => 
              prevWidgets.map(widget => ({
                ...widget,
                isLaunched: result.widgets.includes(widget.id)
              }))
            );
          }
        } catch (error) {
          console.error('Failed to get widget list:', error);
        }
      };
      
      checkRunningWidgets();
    }
    
    // Attempt to connect to telemetry service to get actual available fields
    // This is optional - we'll use the default list if connection fails
    fetchTelemetryFields();
  }, [isElectron]);
  
  // Function to fetch available telemetry fields from the backend
  const fetchTelemetryFields = () => {
    try {
      const ws = new WebSocket('ws://localhost:8080');
      
      ws.onopen = () => {
        console.log('Connected to telemetry service to fetch fields');
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Get actual available metrics from the telemetry data
          const metrics = Object.keys(data)
            .filter(key => 
              typeof data[key] !== 'object' && 
              !Array.isArray(data[key]) &&
              key !== 'raw_values' &&
              key !== 'warnings' &&
              key !== 'active_flags' &&
              key !== 'session_flags'
            )
            .map(key => ({
              value: key,
              label: getMetricLabel(key)
            }));
          
          setAvailableTelemetryMetrics(metrics);
          // Close the connection after we get the data
          ws.close();
        } catch (error) {
          console.error('Failed to parse telemetry data:', error);
        }
      };
      
      ws.onerror = () => {
        console.log('Failed to connect to telemetry service, using default metrics');
      };
      
      // Set a timeout to close the connection if we don't get a response
      setTimeout(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      }, 5000);
    } catch (error) {
      console.error('Failed to connect to telemetry service:', error);
    }
  };
  
  // Helper function to get a user-friendly label for a metric
  const getMetricLabel = (metric: string): string => {
    const metricNames: Record<string, string> = {
      'speed_kph': 'Speed (KPH)',
      'speed_mph': 'Speed (MPH)',
      'rpm': 'RPM',
      'gear': 'Gear',
      'throttle_pct': 'Throttle',
      'brake_pct': 'Brake',
      'clutch_pct': 'Clutch',
      'g_force_lat': 'Lateral G',
      'g_force_lon': 'Longitudinal G',
      'fuel_level': 'Fuel Level',
      'fuel_pct': 'Fuel Percentage',
      'current_lap_time': 'Current Lap',
      'last_lap_time': 'Last Lap',
      'best_lap_time': 'Best Lap',
      'position': 'Position',
      'lap_completed': 'Lap'
    };
    
    return metricNames[metric] || metric;
  };

  const handleSelect = (id: string) => {
    setActiveWidgetId(id === activeWidgetId ? null : id);
  };

  const getActiveWidget = () => {
    if (!activeWidgetId) return null;
    return widgets.find(w => w.id === activeWidgetId);
  };

  const activeWidget = getActiveWidget();

  const launchWidget = async (widget: WidgetConfig) => {
    if (!isElectron) return;
    
    try {
      // Create the widget window using Electron API
      const result = await window.electronAPI.widgets.create({
        widgetId: widget.id,
        widgetType: widget.type.toLowerCase(),
        width: widget.width,
        height: widget.height,
        params: widget.params,
      });
      
      if (result.success) {
        // Mark as launched
        setWidgets(prevWidgets => 
          prevWidgets.map(w => 
            w.id === widget.id ? { ...w, isLaunched: true } : w
          )
        );
        
        // Apply the stored opacity to the newly launched widget
        if (widget.opacity !== 1.0) {
          await window.electronAPI.widgets.setOpacity(widget.id, widget.opacity);
        }
      }
    } catch (error) {
      console.error('Failed to launch widget:', error);
    }
  };

  const closeWidget = async (widgetId: string) => {
    if (!isElectron) return;
    
    try {
      const result = await window.electronAPI.widgets.close(widgetId);
      if (result.success) {
        setWidgets(prevWidgets => 
          prevWidgets.map(w => 
            w.id === widgetId ? { ...w, isLaunched: false } : w
          )
        );
      }
    } catch (error) {
      console.error('Failed to close widget:', error);
    }
  };

  const setWidgetOpacity = async (widgetId: string, opacity: number) => {
    if (!isElectron) return;
    
    try {
      // Update widget opacity in Electron
      await window.electronAPI.widgets.setOpacity(widgetId, opacity);
      
      // Update the widget state to reflect opacity change
      setWidgets(prevWidgets => 
        prevWidgets.map(w => 
          w.id === widgetId ? { ...w, opacity } : w
        )
      );
    } catch (error) {
      console.error('Failed to set widget opacity:', error);
    }
  };
  
  const setWidgetVisibility = async (widgetId: string, visible: boolean) => {
    if (!isElectron) return;
    
    try {
      await window.electronAPI.widgets.setVisible(widgetId, visible);
      
      // Update the widget state to reflect visibility change
      setWidgets(prevWidgets => 
        prevWidgets.map(w => 
          w.id === widgetId ? { ...w, isVisible: visible } : w
        )
      );
    } catch (error) {
      console.error('Failed to set widget visibility:', error);
    }
  };

  const setWidgetSize = async (widgetId: string, width: number, height: number) => {
    if (!isElectron) return;
    
    try {
      await window.electronAPI.widgets.setSize(widgetId, width, height);
      
      // Update the widget state to reflect size change
      setWidgets(prevWidgets => 
        prevWidgets.map(w => 
          w.id === widgetId ? { ...w, width, height } : w
        )
      );
    } catch (error) {
      console.error('Failed to set widget size:', error);
    }
  };

  const setWidgetAlwaysOnTop = async (widgetId: string, alwaysOnTop: boolean) => {
    if (!isElectron) return;
    
    try {
      await window.electronAPI.widgets.setAlwaysOnTop(widgetId, alwaysOnTop);
    } catch (error) {
      console.error('Failed to set widget always-on-top:', error);
    }
  };
  
  const updateWidgetParams = async (widgetId: string, params: Record<string, any>) => {
    if (!isElectron) return;
    
    console.log(`Updating widget ${widgetId} with params:`, params);
    
    // Update params in our React state
    setWidgets(prevWidgets => 
      prevWidgets.map(w => {
        if (w.id === widgetId) {
          const updatedParams = { ...w.params, ...params };
          
          // If the widget is already launched, update it via IPC
          if (w.isLaunched && window.electronAPI) {
            console.log(`Sending params update to widget ${widgetId}:`, updatedParams);
            window.electronAPI.widgets.updateParams(widgetId, updatedParams)
              .then(result => {
                console.log(`Update result for ${widgetId}:`, result);
                if (!result.success) {
                  console.error(`Failed to update widget ${widgetId}`);
                }
              })
              .catch(error => console.error('Failed to update widget params:', error));
          } else {
            console.log(`Widget ${widgetId} not launched, only updating local state`);
          }
          
          return { ...w, params: updatedParams };
        }
        return w;
      })
    );
  };

  // Add quit application function
  const quitApplication = async () => {
    if (!isElectron) return;
    
    try {
      // Ask for confirmation before quitting
      if (window.confirm('Are you sure you want to quit SpeedForge?')) {
        console.log('Quitting application...');
        await window.electronAPI.app.quit();
      }
    } catch (error) {
      console.error('Failed to quit application:', error);
    }
  };

  // Create a new widget
  const createWidget = async (type: string) => {
    // Find the widget configuration from available widgets
    const widgetConfig = availableWidgets.find(w => w.type === type);
    if (!widgetConfig) {
      console.error(`Unknown widget type: ${type}`);
      return;
    }

    // Generate a unique ID
    const id = `${type}-${Date.now()}`;
    
    // Set default parameters based on widget type
    let params: Record<string, any> = {};
    let width = 300;
    let height = 200;
    
    if (type === 'clock') {
      params = { format24h: false, showTelemetry: false };
    } else if (type === 'weather') {
      params = { location: 'New York' };
    } else if (type === 'telemetry') {
      params = { metric: 'speed_kph' };
    } else if (type === 'trace') {
      params = { traceLength: 75 };
      width = 500;
      height = 160;
    }
    
    // Create widget through Electron
    try {
      const result = await window.electronAPI.widgets.create({
        widgetId: id,
        widgetType: type,
        width,
        height,
        params
      });
      
      if (result.success) {
        // Add widget to local state
        setWidgets(prev => [...prev, {
          id,
          type: type as any,
          name: widgetConfig.name,
          params,
          isLaunched: true,
          isVisible: true,
          opacity: 1.0,
          width,
          height
        }]);
      } else {
        console.error('Failed to create widget');
      }
    } catch (error) {
      console.error('Error creating widget:', error);
    }
  };

  // Button to add a new widget section
  const renderAddWidgetSection = () => {
    return (
      <div className="bg-white shadow-md rounded-lg p-4 mb-4">
        <h2 className="text-lg font-semibold mb-3">Add Widget</h2>
        <div className="flex flex-wrap gap-2">
          {availableWidgets.map((widget) => (
            <button
              key={widget.type}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              onClick={() => createWidget(widget.type)}
            >
              {widget.name}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="control-panel bg-gray-100 p-4 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Widget Control Panel</h2>
        <button 
          className="px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
          onClick={quitApplication}
        >
          Quit Application
        </button>
      </div>
      
      <div className="widget-list mb-6">
        <h3 className="text-lg font-semibold mb-2">Available Widgets</h3>
        <div className="space-y-2">
          {widgets.map(widget => (
            <div 
              key={widget.id}
              className={`p-3 rounded cursor-pointer ${activeWidgetId === widget.id 
                ? 'bg-blue-200 border-blue-400 border' 
                : 'bg-white border border-gray-300 hover:bg-gray-50'}`}
              onClick={() => handleSelect(widget.id)}
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{widget.name}</div>
                  <div className="text-xs text-gray-600">ID: {widget.id}</div>
                </div>
                <div className="flex space-x-2">
                  {widget.isLaunched ? (
                    <button 
                      className="px-2 py-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeWidget(widget.id);
                      }}
                    >
                      Close
                    </button>
                  ) : (
                    <button 
                      className="px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        launchWidget(widget);
                      }}
                    >
                      Launch
                    </button>
                  )}
                </div>
              </div>
              
              {/* Always show basic controls for launched widgets */}
              {widget.isLaunched && (
                <div className="mt-3 pt-2 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-2">
                    <label className="flex items-center space-x-2">
                      <input 
                        type="checkbox" 
                        checked={widget.isVisible}
                        onChange={(e) => {
                          setWidgetVisibility(widget.id, e.target.checked);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-sm">Visible</span>
                    </label>
                    <span className="text-xs font-medium">
                      {Math.round(widget.opacity * 100)}%
                    </span>
                  </div>
                  
                  <div 
                    className="opacity-slider" 
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input 
                      type="range" 
                      min="10" 
                      max="100" 
                      value={widget.opacity * 100}
                      className="w-full"
                      onChange={(e) => {
                        const opacity = parseInt(e.target.value) / 100;
                        setWidgetOpacity(widget.id, opacity);
                      }}
                    />
                  </div>
                  
                  {/* Add metric selector for telemetry widgets */}
                  {widget.type === 'telemetry' && widget.isLaunched && (
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Telemetry Metric:
                      </label>
                      <select
                        value={widget.params?.metric || 'speed_kph'}
                        onChange={(e) => {
                          updateWidgetParams(widget.id, { metric: e.target.value });
                        }}
                        className="w-full p-2 border border-gray-300 rounded text-sm"
                      >
                        {availableTelemetryMetrics.map((metric) => (
                          <option key={metric.value} value={metric.value}>
                            {metric.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Add trace length slider for trace widgets */}
                  {widget.type === 'trace' && widget.isLaunched && (
                    <div className="mt-3" onClick={(e) => e.stopPropagation()}>
                      <label className="text-sm font-medium text-gray-700 block mb-1">
                        Trace Length: {widget.params?.traceLength || 75} points
                      </label>
                      <input 
                        type="range" 
                        min="25" 
                        max="200" 
                        step="25"
                        value={widget.params?.traceLength || 75}
                        className="w-full"
                        onChange={(e) => {
                          const traceLength = parseInt(e.target.value);
                          updateWidgetParams(widget.id, { traceLength });
                        }}
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Faster</span>
                        <span>Slower</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {activeWidget && activeWidget.isLaunched && (
        <div className="widget-controls p-4 bg-white rounded border border-gray-300">
          <h3 className="text-lg font-semibold mb-3">Control: {activeWidget.name}</h3>
          
          <div className="mb-4">
            <label className="flex items-center space-x-2 mb-3">
              <input 
                type="checkbox" 
                checked={activeWidget.isVisible}
                onChange={(e) => {
                  setWidgetVisibility(activeWidget.id, e.target.checked);
                }}
              />
              <span className="text-sm font-medium text-gray-700">Visible</span>
            </label>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Opacity: 
            </label>
            <div className="flex items-center space-x-2">
              <input 
                type="range" 
                min="10" 
                max="100" 
                value={activeWidget.opacity * 100}
                className="w-full"
                onChange={(e) => {
                  const opacity = parseInt(e.target.value) / 100;
                  setWidgetOpacity(activeWidget.id, opacity);
                }}
              />
              <span className="text-sm font-medium w-10 text-right">
                {Math.round(activeWidget.opacity * 100)}%
              </span>
            </div>
          </div>
          
          {/* Widget-specific controls */}
          {activeWidget.type === 'telemetry' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Telemetry Metric:
              </label>
              <select
                value={activeWidget.params?.metric || 'speed_kph'}
                onChange={(e) => {
                  updateWidgetParams(activeWidget.id, { metric: e.target.value });
                }}
                className="w-full p-2 border border-gray-300 rounded"
              >
                {availableTelemetryMetrics.map((metric) => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>
          )}
          
          {activeWidget.type === 'trace' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Trace Length: {activeWidget.params?.traceLength || 75} points
              </label>
              <div className="flex items-center space-x-2">
                <input 
                  type="range" 
                  min="25" 
                  max="200" 
                  step="25"
                  value={activeWidget.params?.traceLength || 75}
                  className="w-full"
                  onChange={(e) => {
                    const traceLength = parseInt(e.target.value);
                    updateWidgetParams(activeWidget.id, { traceLength });
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>Faster</span>
                <span>Slower</span>
              </div>
            </div>
          )}
          
          {activeWidget.type === 'clock' && (
            <div className="mb-4">
              <label className="flex items-center space-x-2 mb-3">
                <input 
                  type="checkbox" 
                  checked={activeWidget.params?.format24h || false}
                  onChange={(e) => {
                    updateWidgetParams(activeWidget.id, { format24h: e.target.checked });
                  }}
                />
                <span className="text-sm font-medium text-gray-700">24-hour format</span>
              </label>
              
              <label className="flex items-center space-x-2">
                <input 
                  type="checkbox" 
                  checked={activeWidget.params?.showTelemetry || false}
                  onChange={(e) => {
                    updateWidgetParams(activeWidget.id, { showTelemetry: e.target.checked });
                  }}
                />
                <span className="text-sm font-medium text-gray-700">Show telemetry data</span>
              </label>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Width (px)
              </label>
              <input 
                type="number" 
                min="50" 
                max="800" 
                value={activeWidget.width}
                className="border border-gray-300 rounded px-2 py-1 w-full"
                onChange={(e) => {
                  const width = parseInt(e.target.value);
                  if (!isNaN(width)) {
                    setWidgetSize(activeWidget.id, width, activeWidget.height);
                  }
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Height (px)
              </label>
              <input 
                type="number" 
                min="50" 
                max="800" 
                value={activeWidget.height}
                className="border border-gray-300 rounded px-2 py-1 w-full"
                onChange={(e) => {
                  const height = parseInt(e.target.value);
                  if (!isNaN(height)) {
                    setWidgetSize(activeWidget.id, activeWidget.width, height);
                  }
                }}
              />
            </div>
          </div>
          
          <div className="mb-4">
            <label className="flex items-center space-x-2">
              <input 
                type="checkbox" 
                defaultChecked={false}
                onChange={(e) => {
                  setWidgetAlwaysOnTop(activeWidget.id, e.target.checked);
                }}
              />
              <span className="text-sm font-medium text-gray-700">Always on top</span>
            </label>
          </div>
        </div>
      )}

      {renderAddWidgetSection()}
    </div>
  );
}; 