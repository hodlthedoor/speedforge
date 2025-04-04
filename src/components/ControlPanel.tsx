/// <reference path="../types/electron.d.ts" />
import React, { useState, useEffect } from 'react';
import { useWidgetManager } from '../widgets/WidgetManager';
import { WidgetContainer } from './WidgetContainer';

interface WidgetConfig {
  id: string;
  type: 'clock' | 'weather';
  name: string;
  params?: Record<string, any>;
  isLaunched: boolean;
  isVisible: boolean;
  opacity?: number;
}

export const ControlPanel: React.FC = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: 'clock-widget-1', type: 'clock', name: 'Clock Widget', params: { format24h: false }, isLaunched: false, isVisible: true, opacity: 1 },
    { id: 'weather-widget-1', type: 'weather', name: 'Weather Widget', params: { location: 'New York' }, isLaunched: false, isVisible: true, opacity: 1 }
  ]);
  const [activeWidgetId, setActiveWidgetId] = useState<string | null>(null);
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
  }, [isElectron]);

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
        width: 300,
        height: 200,
        params: widget.params,
      });
      
      if (result.success) {
        // Mark as launched
        setWidgets(prevWidgets => 
          prevWidgets.map(w => 
            w.id === widget.id ? { ...w, isLaunched: true } : w
          )
        );
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

  // For controlling widget in a separate window
  const setWidgetOpacity = async (widgetId: string, opacity: number) => {
    if (!isElectron) return;
    
    try {
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

  return (
    <div className="control-panel bg-gray-100 p-4 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4">Widget Control Panel</h2>
      
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
                defaultChecked={activeWidget.isVisible !== false}
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
                min="0" 
                max="100" 
                defaultValue="100"
                className="w-full"
                onChange={(e) => {
                  const opacity = parseInt(e.target.value) / 100;
                  setWidgetOpacity(activeWidget.id, opacity);
                }}
              />
              <span className="text-sm font-medium w-10 text-right">
                {activeWidget.opacity ? Math.round(activeWidget.opacity * 100) : 100}%
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Width (px)
              </label>
              <input 
                type="number" 
                min="50" 
                max="800" 
                defaultValue="300"
                className="border border-gray-300 rounded px-2 py-1 w-full"
                onChange={(e) => {
                  const width = parseInt(e.target.value);
                  const height = 200; // You would get this from the widget
                  if (!isNaN(width)) {
                    setWidgetSize(activeWidget.id, width, height);
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
                defaultValue="200"
                className="border border-gray-300 rounded px-2 py-1 w-full"
                onChange={(e) => {
                  const height = parseInt(e.target.value);
                  const width = 300; // You would get this from the widget
                  if (!isNaN(height)) {
                    setWidgetSize(activeWidget.id, width, height);
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
    </div>
  );
}; 