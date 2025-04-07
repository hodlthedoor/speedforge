import React, { useEffect, useState } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import { WebSocketService } from '../services/WebSocketService';

interface BaseWidgetProps {
  id: string;
  title?: string;
  initialPosition?: { x: number, y: number };
  className?: string;
  opacity?: number;
  children: React.ReactNode;
}

const BaseWidget: React.FC<BaseWidgetProps> = ({
  id,
  title,
  initialPosition = { x: 100, y: 100 },
  className = '',
  opacity = 1,
  children
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentOpacity, setCurrentOpacity] = useState(opacity);

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

  return (
    <BaseDraggableComponent
      initialPosition={initialPosition}
      className={`interactive overflow-hidden ${className}`}
    >
      <div 
        className="bg-gray-900 rounded-lg shadow-lg drag-handle min-w-[200px] min-h-[100px] flex flex-col"
        style={{ opacity: currentOpacity }}
        onClick={() => {
          // Emit widget:clicked event
          const event = new CustomEvent('widget:clicked', { 
            detail: { widgetId: id }
          });
          window.dispatchEvent(event);
        }}
      >
        <div className="flex-1 flex items-center justify-center p-4">
          {isLoading ? (
            <div className="text-center">
              {title && <p className="text-sm font-medium text-gray-400 mb-4">{title}</p>}
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
              <p className="mt-2 text-sm text-gray-400">Connecting to telemetry...</p>
            </div>
          ) : !isConnected ? (
            <div className="text-center">
              {title && <p className="text-sm font-medium text-gray-400 mb-4">{title}</p>}
              <div className="rounded-full h-3 w-3 bg-red-500 mx-auto animate-pulse"></div>
              <p className="mt-2 text-sm font-medium text-red-400">Disconnected</p>
              <p className="text-xs text-gray-500">Attempting to reconnect...</p>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </BaseDraggableComponent>
  );
};

export default BaseWidget; 