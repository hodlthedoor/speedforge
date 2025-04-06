/// <reference path="../types/electron.d.ts" />
import React, { useEffect, useState } from 'react';
import { IpcWidget } from './IpcWidget';

// Main Widget Container component
export const WidgetContainer: React.FC = () => {
  const [params, setParams] = useState<Record<string, any>>({});
  const [widgetId, setWidgetId] = useState<string>('');
  const [widgetType, setWidgetType] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get widget parameters from URL
    const searchParams = new URLSearchParams(window.location.search);
    const id = searchParams.get('widgetId');
    const type = searchParams.get('widgetType');
    
    if (id && type) {
      setWidgetId(id);
      setWidgetType(type);
      
      // Collect all other parameters
      const widgetParams: Record<string, any> = {};
      searchParams.forEach((value, key) => {
        if (key !== 'widgetId' && key !== 'widgetType') {
          widgetParams[key] = value;
        }
      });
      
      setParams(widgetParams);
      console.log('Widget parameters:', { id, type, params: widgetParams });
    } else {
      console.error('Missing required widget parameters');
    }
    
    setLoading(false);
    
    // Listen for Escape key to close widget
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.electronAPI) {
        console.log('Escape key pressed, closing widget');
        window.electronAPI.send('widget:closeByEscape');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Render the appropriate widget based on type
  const renderWidget = () => {
    if (loading) {
      return <div>Loading widget...</div>;
    }
    
    if (!widgetId || !widgetType) {
      return <div>Invalid widget configuration</div>;
    }
    
    console.log(`Rendering widget: ${widgetType} with ID: ${widgetId}`);
    
    // Only render IPC widget
    if (widgetType.toLowerCase() === 'ipc') {
      return (
        <IpcWidget
          id={widgetId}
          metric={params.metric || 'speed_kph'}
        />
      );
    } else {
      return <div>Unsupported widget type: {widgetType}</div>;
    }
  };

  return (
    <div className="widget-wrapper">
      {renderWidget()}
    </div>
  );
}; 