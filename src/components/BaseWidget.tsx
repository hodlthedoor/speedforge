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
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOpacity, setCurrentOpacity] = useState(1);
  const [isBackgroundTransparent, setIsBackgroundTransparent] = useState(false);

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
      }
    } catch (error) {
      console.error('Error parsing URL parameters:', error);
    }

    window.addEventListener('widget:opacity', handleOpacityChange as EventListener);
    window.addEventListener('widget:background-transparent', handleBackgroundTransparency as EventListener);

    return () => {
      webSocketService.removeListeners(id);
      window.removeEventListener('widget:opacity', handleOpacityChange as EventListener);
      window.removeEventListener('widget:background-transparent', handleBackgroundTransparency as EventListener);
    };
  }, [id]);

  // Handle click on the widget to bring it to front via custom event
  const handleWidgetClick = () => {
    const event = new CustomEvent('widget:clicked', { detail: { widgetId: id } });
    window.dispatchEvent(event);
  };

  return (
    <div 
      className={`drag-handle w-auto ${isBackgroundTransparent ? 'bg-transparent' : 'bg-slate-800/80'} ${isBackgroundTransparent ? '' : 'rounded-lg shadow-lg backdrop-blur-md border border-slate-600/30'} overflow-hidden m-0 ${className}`}
      style={{ opacity: currentOpacity, ...style }}
      onClick={handleWidgetClick}
      id={id}
      data-widget-id={id}
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