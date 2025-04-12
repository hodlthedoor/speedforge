import React, { useEffect, useState } from 'react';
import { WebSocketService } from '../services/WebSocketService';

// Base props that all widgets must accept
export interface BaseWidgetProps {
  id: string;
  onClose: () => void;
  className?: string;
  title?: string;
}

const BaseWidget: React.FC<React.PropsWithChildren<BaseWidgetProps>> = ({
  id,
  onClose,
  className = '',
  title = 'Widget',
  children
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOpacity, setCurrentOpacity] = useState(1);

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

    window.addEventListener('widget:opacity', handleOpacityChange as EventListener);

    return () => {
      webSocketService.removeListeners(id);
      window.removeEventListener('widget:opacity', handleOpacityChange as EventListener);
    };
  }, [id]);

  // Handle click on the widget to bring it to front via custom event
  const handleWidgetClick = () => {
    const event = new CustomEvent('widget:clicked', { detail: { widgetId: id } });
    window.dispatchEvent(event);
  };

  return (
    <div 
      className={`drag-handle w-auto max-w-[500px] bg-slate-800/80 rounded-lg shadow-lg backdrop-blur-md overflow-hidden m-0 border border-slate-600/30 ${className}`}
      style={{ opacity: currentOpacity }}
      onClick={handleWidgetClick}
    >
      <div className="p-3 min-w-[200px] max-w-full min-h-[100px] max-h-[500px] overflow-auto">
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