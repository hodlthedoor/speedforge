/// <reference path="../types/electron.d.ts" />
import React, { useEffect, useState } from 'react';

// Direct widget components for testing
const ClockWidgetComponent = (props: any) => {
  const [time, setTime] = useState(new Date());
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    
    return () => {
      clearInterval(timer);
    };
  }, []);
  
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full">
      <div className="text-4xl font-bold">
        {time.toLocaleTimeString()}
      </div>
      <div className="text-md mt-2">
        {time.toDateString()}
      </div>
    </div>
  );
};

const WeatherWidgetComponent = (props: any) => {
  return (
    <div className="p-4 flex flex-col items-center justify-center h-full">
      <div className="text-xl font-semibold mb-2">Weather</div>
      <div className="text-sm text-gray-600 mb-4">{props.location || 'Current Location'}</div>
      <div className="text-5xl">☀️</div>
      <div className="text-3xl font-bold mt-2">23°C</div>
      <div className="text-gray-600">Sunny</div>
    </div>
  );
};

export const WidgetContainer: React.FC = () => {
  const [opacity, setOpacity] = useState(1);
  const [widgetId, setWidgetId] = useState('');
  const [widgetType, setWidgetType] = useState('');
  const [widgetParams, setWidgetParams] = useState<Record<string, any>>({});
  
  // On component mount, register for window messages
  useEffect(() => {
    if (!window.electronAPI) {
      return;
    }
    
    // Enable dragging if available
    if (window.electronDrag) {
      console.log('Enabling widget dragging');
      window.electronDrag.enableDrag();
    } else {
      console.warn('Drag functionality not available');
    }
    
    // Get window parameters on load
    const getWindowParams = async () => {
      try {
        const searchParams = new URLSearchParams(window.location.search);
        console.log('Raw URL:', window.location.href);
        console.log('Search string:', window.location.search);
        console.log('All URL params:', Array.from(searchParams.entries()));
        
        const id = searchParams.get('widgetId') || '';
        const type = searchParams.get('widgetType') || '';
        
        console.log('Window URL parameters:', { id, type });
        
        // Parse additional parameters
        const params: Record<string, any> = {};
        searchParams.forEach((value, key) => {
          if (key !== 'widgetId' && key !== 'widgetType') {
            // Convert boolean strings
            if (value === 'true') params[key] = true;
            else if (value === 'false') params[key] = false;
            // Convert numbers
            else if (!isNaN(Number(value))) params[key] = Number(value);
            else params[key] = value;
          }
        });
        
        setWidgetId(id);
        setWidgetType(type);
        setWidgetParams(params);
      } catch (error) {
        console.error('Failed to get window parameters:', error);
      }
    };
    
    getWindowParams();
    
    // Listen for opacity changes
    const handleOpacityChange = (newOpacity: number) => {
      console.log('Received opacity change:', newOpacity);
      setOpacity(newOpacity);
    };
    
    window.electronAPI.on('widget:opacity', handleOpacityChange);
    
    // Add keyboard handler for Escape key to close widget
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && window.electronAPI) {
        console.log('Escape key pressed - closing widget');
        window.electronAPI.send('widget:closeByEscape');
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.electronAPI.removeAllListeners('widget:opacity');
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
  
  // Debug output
  console.log('Widget container state:', { widgetId, widgetType, params: widgetParams, opacity });
  
  const widgetProps = {
    id: widgetId,
    ...widgetParams
  };
  
  // Setup CSS for the container
  const containerStyle = {
    opacity,
    height: '100%',
    width: '100%',
    cursor: 'default', // Show default cursor for draggable area
  };
  
  // CSS for areas we don't want draggable (like buttons)
  const noDragStyle = {
    WebkitAppRegion: 'no-drag' as any,
  };
  
  // Basic error checking
  if (!widgetId || !widgetType) {
    return (
      <div className="error-container p-4 bg-red-100 text-red-800 rounded draggable" style={containerStyle}>
        <h3 className="font-bold mb-2">Widget Parameters Missing</h3>
        <p>Required URL parameters missing:</p>
        <ul className="list-disc ml-5 mt-2 non-draggable">
          {!widgetId && <li>widgetId</li>}
          {!widgetType && <li>widgetType</li>}
        </ul>
        <p className="mt-2 text-sm">URL Parameters:</p>
        <pre className="mt-1 p-2 bg-gray-100 text-xs rounded non-draggable">
          {JSON.stringify({ search: window.location.search }, null, 2)}
        </pre>
      </div>
    );
  }
  
  // Render widget based on type
  return (
    <div className="widget-container h-full draggable" style={containerStyle}>
      {widgetType === 'clock' && (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <ClockWidgetComponent {...widgetProps} />
        </div>
      )}
      {widgetType === 'weather' && (
        <div className="p-4 flex flex-col items-center justify-center h-full">
          <WeatherWidgetComponent {...widgetProps} />
        </div>
      )}
      {widgetType !== 'clock' && widgetType !== 'weather' && (
        <div className="error-container p-4 bg-red-100 text-red-800 rounded">
          <h3 className="font-bold mb-2">Unknown Widget Type</h3>
          <p>Widget type "{widgetType}" is not supported.</p>
          <p className="mt-2">Supported types:</p>
          <ul className="list-disc ml-5 non-draggable">
            <li>clock</li>
            <li>weather</li>
          </ul>
        </div>
      )}
    </div>
  );
}; 