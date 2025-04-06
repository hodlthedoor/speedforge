import React from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';

export interface WidgetProps {
  title: string;
  initialPosition?: { x: number, y: number };
  onClose?: () => void;
  children?: React.ReactNode;
}

export const Widget: React.FC<WidgetProps> = ({ title, initialPosition, onClose, children }) => {
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

  return (
    <BaseDraggableComponent 
      initialPosition={defaultPosition} 
      className="widget-component-wrapper"
    >
      <div className="widget-component">
        <div className="widget-header drag-handle">
          <h3>{title}</h3>
          {onClose && (
            <button className="widget-close-btn" onClick={handleClose}>
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