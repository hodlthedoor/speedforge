import React, { useEffect, useRef } from 'react';
import { ClockWidget } from '../widgets/ClockWidget';
import { WeatherWidget } from '../widgets/WeatherWidget';
import { TelemetryWidget } from '../widgets/TelemetryWidget';

/// <reference path="../types/electron.d.ts" />

interface WidgetContainerProps {
  id: string;
  widget: 'clock' | 'weather' | 'telemetry';
  params?: Record<string, any>;
  width?: number;
  height?: number;
  position?: { x: number, y: number };
  alwaysOnTop?: boolean;
}

const getWidgetTitle = (type: string) => {
  switch (type) {
    case 'clock': return 'Clock Widget';
    case 'weather': return 'Weather Widget';
    default: return 'Widget';
  }
};

export const WidgetContainer: React.FC<WidgetContainerProps> = ({ 
  id, 
  widget, 
  params = {},
  width = 300,
  height = 200,
  position,
  alwaysOnTop = false
}) => {
  const isElectron = window.electronAPI !== undefined;
  const hasCreatedWidget = useRef(false);
  
  useEffect(() => {
    const createWidget = async () => {
      if (!isElectron || hasCreatedWidget.current) return;
      
      try {
        const result = await window.electronAPI.widgets.create({
          widgetId: id,
          widgetType: widget,
          width,
          height,
          x: position?.x,
          y: position?.y,
          alwaysOnTop,
          params
        });
        
        if (result.success) {
          hasCreatedWidget.current = true;
          console.log(`Widget created with ID: ${result.id}`);
        }
      } catch (error) {
        console.error('Failed to create widget:', error);
      }
    };
    
    createWidget();
    
    return () => {
      if (isElectron && hasCreatedWidget.current) {
        window.electronAPI.widgets.close(id).catch(console.error);
      }
    };
  }, [id, widget, isElectron]);
  
  // For non-Electron environments or during development, render the widget directly
  if (!isElectron) {
    return renderWidget();
  }
  
  // In Electron, check if this is the widget window
  const searchParams = new URLSearchParams(window.location.search);
  const widgetId = searchParams.get('widgetId');
  const widgetType = searchParams.get('widgetType');
  
  if (widgetId === id && widgetType === widget) {
    // Add keyboard shortcut to close the widget
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          window.electronAPI.widgets.close(id);
        }
      };
      
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [id]);
    
    return (
      <div 
        className="h-screen w-screen overflow-hidden bg-transparent cursor-move"
        style={{ 
          // For Electron drag support
          // @ts-ignore
          WebkitAppRegion: 'drag'
        }}
      >
        <div className="widget-content">
          {renderWidget()}
        </div>
      </div>
    );
  }
  
  // This is not the widget window, render nothing
  return null;
  
  function renderWidget() {
    switch (widget) {
      case 'clock':
        return <ClockWidget id={id} defaultWidth={width} defaultHeight={height} {...params} />;
      case 'weather':
        return <WeatherWidget id={id} defaultWidth={width} defaultHeight={height} {...params} />;
      case 'telemetry':
        return <TelemetryWidget id={id} defaultWidth={width} defaultHeight={height} {...params} />;
      default:
        return <div>Unknown widget type: {widget}</div>;
    }
  }
}; 