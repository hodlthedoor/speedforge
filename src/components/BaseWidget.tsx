import React, { useEffect, useState } from 'react';
import { WebSocketService } from '../services/WebSocketService';

// Base props that all widgets must accept
export interface BaseWidgetProps {
  id: string;
  onClose: () => void;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

// Constants for event names
export const WIDGET_STATE_UPDATE_EVENT = 'widget:state:direct-update';

// Type for widget state update events
interface WidgetStateUpdateEvent {
  widgetId: string;
  state: Record<string, any>;
}

// Function to dispatch a widget state update
export function dispatchWidgetStateUpdate(widgetId: string, state: Record<string, any>) {
  console.log(`[BaseWidget] Dispatching state update for widget ${widgetId}:`, state);
  
  const event = new CustomEvent<WidgetStateUpdateEvent>(WIDGET_STATE_UPDATE_EVENT, {
    detail: {
      widgetId,
      state,
    },
  });
  
  // Dispatch the event
  window.dispatchEvent(event);
}

// Hook to listen for widget state updates for a specific widget
export function useWidgetStateUpdates(widgetId: string, onStateUpdate: (state: Record<string, any>) => void) {
  // Use a ref to store the callback to prevent unnecessary effect runs
  const callbackRef = React.useRef(onStateUpdate);
  
  // Update the ref when the callback changes
  React.useEffect(() => {
    callbackRef.current = onStateUpdate;
  }, [onStateUpdate]);
  
  React.useEffect(() => {
    console.log(`[BaseWidget] Setting up state update listener for widget ${widgetId}`);
    
    const handleStateUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<WidgetStateUpdateEvent>;
      if (customEvent.detail && customEvent.detail.widgetId === widgetId) {
        console.log(`[BaseWidget] Widget ${widgetId} received state update:`, customEvent.detail.state);
        // Use the ref to get the latest callback
        callbackRef.current(customEvent.detail.state);
      }
    };

    window.addEventListener(WIDGET_STATE_UPDATE_EVENT, handleStateUpdate);
    
    return () => {
      console.log(`[BaseWidget] Removing state update listener for widget ${widgetId}`);
      window.removeEventListener(WIDGET_STATE_UPDATE_EVENT, handleStateUpdate);
    };
  }, [widgetId]); // Only re-run when widgetId changes
}

const BaseWidget: React.FC<React.PropsWithChildren<BaseWidgetProps>> = ({
  id,
  onClose,
  className = '',
  title = 'Widget',
  children,
  style
}) => {
  console.log(`[BaseWidget:${id}] Style props:`, style);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOpacity, setCurrentOpacity] = useState(1);
  const [isBackgroundTransparent, setIsBackgroundTransparent] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null);

  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    
    webSocketService.addConnectionListener(id, (status) => {
      setIsConnected(status);
      setIsLoading(false);
    });

    const handleOpacityChange = (e: CustomEvent) => {
      if (e.detail.widgetId === id) {
        setCurrentOpacity(e.detail.opacity);
      }
    };

    const handleBackgroundTransparency = (e: CustomEvent) => {
      if (e.detail.widgetId === id) {
        setIsBackgroundTransparent(e.detail.transparent);
      }
    };

    const handleBackgroundColorChange = (e: CustomEvent) => {
      if (e.detail.widgetId === id) {
        setBackgroundColor(e.detail.color);
      }
    };

    // Check URL parameters on load
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const widgetId = urlParams.get('widgetId');
      
      // If this component's ID matches the URL widgetId, check for transparency parameter
      if (widgetId === id) {
        const backgroundTransparent = urlParams.get('backgroundTransparent');
        if (backgroundTransparent === 'true') {
          setIsBackgroundTransparent(true);
        }
        
        const bgColor = urlParams.get('backgroundColor');
        if (bgColor) {
          setBackgroundColor(bgColor);
        }
      }
    } catch (error) {
      console.error('Error parsing URL parameters:', error);
    }

    window.addEventListener('widget:opacity', handleOpacityChange as EventListener);
    window.addEventListener('widget:background-transparent', handleBackgroundTransparency as EventListener);
    window.addEventListener('widget:background-color', handleBackgroundColorChange as EventListener);

    return () => {
      webSocketService.removeListeners(id);
      window.removeEventListener('widget:opacity', handleOpacityChange as EventListener);
      window.removeEventListener('widget:background-transparent', handleBackgroundTransparency as EventListener);
      window.removeEventListener('widget:background-color', handleBackgroundColorChange as EventListener);
    };
  }, [id]);

  // Handle click on the widget to bring it to front via custom event
  const handleWidgetClick = () => {
    const event = new CustomEvent('widget:clicked', { detail: { widgetId: id } });
    window.dispatchEvent(event);
  };

  // Determine the background styling
  const getBackgroundStyles = () => {
    if (isBackgroundTransparent) {
      return 'bg-transparent';
    } else if (backgroundColor) {
      // No Tailwind classes, we'll use inline style for custom color
      return '';
    } else {
      return 'bg-slate-800/80 rounded-lg shadow-lg backdrop-blur-md border border-slate-600/30';
    }
  };

  const combinedStyle = {
    opacity: currentOpacity,
    ...(backgroundColor && !isBackgroundTransparent ? { backgroundColor } : {}),
    ...style
  };

  return (
    <div 
      className={`drag-handle w-auto ${getBackgroundStyles()} overflow-hidden m-0 ${className}`}
      style={combinedStyle}
      onClick={handleWidgetClick}
      id={id}
      data-widget-id={id}
      data-bg-transparent={isBackgroundTransparent.toString()}
      data-bg-color={backgroundColor || ''}
    >
      <div className="p-3 min-w-[200px] min-h-[100px] overflow-auto">
        {isLoading ? (
          <div className="text-center">
            <div className="text-sm font-medium text-slate-300 mb-2">{title}</div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
            <p className="mt-2 text-sm text-gray-400">Connecting to telemetry...</p>
          </div>
        ) : !isConnected ? (
          <div className="text-center">
            <div className="text-sm font-medium text-slate-300 mb-2">{title}</div>
            <div className="rounded-full h-3 w-3 bg-red-500 mx-auto animate-pulse"></div>
            <p className="mt-2 text-sm font-medium text-red-400">Disconnected</p>
            <p className="text-xs text-gray-500">Waiting for connection...</p>
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
};

export default BaseWidget; 