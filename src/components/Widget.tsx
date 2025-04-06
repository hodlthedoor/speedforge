import React, { useState, useEffect } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';

export interface WidgetProps {
  title: string;
  initialPosition?: { x: number, y: number };
  onClose?: () => void;
  children?: React.ReactNode;
  id: string;
}

export const Widget: React.FC<WidgetProps> = ({ title, initialPosition, onClose, children, id }) => {
  const [isHighlighted, setIsHighlighted] = useState(false);
  
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

  // Generate a random position if none provided
  const defaultPosition = initialPosition || {
    x: 200 + Math.random() * 300,
    y: 200 + Math.random() * 200
  };

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

  return (
    <BaseDraggableComponent 
      initialPosition={defaultPosition} 
      className="widget-component-wrapper"
    >
      <div 
        className={`widget-component ${isHighlighted ? 'widget-highlighted' : ''}`}
        onClick={handleWidgetClick}
      >
        <div className="widget-header drag-handle">
          <h3>{title}</h3>
          {onClose && (
            <button 
              className="widget-close-btn" 
              onClick={(e) => {
                e.stopPropagation(); // Prevent click from bubbling to parent
                handleClose();
              }}
            >
              ×
            </button>
          )}
        </div>
        <div className="widget-content">
          {children}
        </div>
      </div>
    </BaseDraggableComponent>
  );
};

export default Widget; 