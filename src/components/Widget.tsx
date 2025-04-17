import React, { useState, useEffect } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import BaseWidget from './BaseWidget';

export interface WidgetProps {
  title: string;
  initialPosition?: { x: number, y: number };
  onClose?: () => void;
  children?: React.ReactNode;
  id: string;
  className?: string;
  width?: string | number;
  height?: string | number;
}

export const Widget: React.FC<WidgetProps> = ({ 
  title, 
  initialPosition, 
  onClose, 
  children, 
  id,
  className = '',
  width = 'auto',
  height = 'auto'
}) => {
  const [isHighlighted, setIsHighlighted] = useState(false);
  const [isBackgroundTransparent, setIsBackgroundTransparent] = useState(false);
  const [position, setPosition] = useState(initialPosition || {
    x: 200 + Math.random() * 300,
    y: 200 + Math.random() * 200
  });
  
  // Listen for highlight events
  useEffect(() => {
    const handleHighlight = (e: CustomEvent) => {
      const eventDetail = e.detail as { widgetId: string };
      if (eventDetail && typeof eventDetail.widgetId === 'string') {
        // If this component has an ID that matches the highlighted ID
        if (eventDetail.widgetId === id) {
          setIsHighlighted(true);
          
          // Auto-clear highlight after 2 seconds
          setTimeout(() => {
            setIsHighlighted(false);
          }, 2000);
        }
      }
    };
    
    window.addEventListener('widget:highlight', handleHighlight as EventListener);
    return () => window.removeEventListener('widget:highlight', handleHighlight as EventListener);
  }, [id]);

  // Listen for position update events
  useEffect(() => {
    const handlePositionUpdate = (e: CustomEvent) => {
      if (e.detail && e.detail.widgetId === id && e.detail.position) {
        console.log(`Widget component received position update for ${id}:`, e.detail.position);
        setPosition(e.detail.position);
      }
    };
    
    window.addEventListener('widget:position', handlePositionUpdate as EventListener);
    return () => window.removeEventListener('widget:position', handlePositionUpdate as EventListener);
  }, [id]);

  // Listen for transparency changes
  useEffect(() => {
    const handleBackgroundTransparency = (e: CustomEvent) => {
      if (e.detail && e.detail.widgetId === id) {
        setIsBackgroundTransparent(e.detail.transparent);
      }
    };
    
    window.addEventListener('widget:background-transparent', handleBackgroundTransparency as EventListener);
    
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
    
    return () => {
      window.removeEventListener('widget:background-transparent', handleBackgroundTransparency as EventListener);
    };
  }, [id]);

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
  };
  
  // Handle widget click to emit event for control panel
  const handleWidgetClick = () => {
    const event = new CustomEvent('widget:clicked', { 
      detail: { widgetId: id }
    });
    window.dispatchEvent(event);
  };

  // Handle position changes from the BaseDraggableComponent
  const handlePositionChange = (newPosition: { x: number, y: number }) => {
    setPosition(newPosition);
  };

  return (
    <BaseDraggableComponent 
      initialPosition={position} 
      className={`z-10 ${isBackgroundTransparent ? 'no-shadow' : ''}`}
      onPositionChange={handlePositionChange}
    >
      <BaseWidget
        id={id}
        title={title}
        onClose={handleClose}
        className={`${className} ${isHighlighted && !isBackgroundTransparent ? 'shadow-blue-500/50 animate-pulse' : ''}`}
        style={{
          width: width ? (typeof width === 'number' ? `${width}px` : width) : undefined,
          height: height ? (typeof height === 'number' ? `${height}px` : height) : undefined,
          transition: 'width 0.3s, height 0.3s'
        }}
      >
        {children}
      </BaseWidget>
    </BaseDraggableComponent>
  );
};

export default Widget; 