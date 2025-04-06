import React from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';

export interface WidgetProps {
  id: string;
  name: string;
  initialPosition?: { x: number, y: number };
}

export const Widget: React.FC<WidgetProps> = ({ id, name, initialPosition }) => {
  // Generate a random position if none provided
  const defaultPosition = initialPosition || {
    x: 200 + Math.random() * 300,
    y: 200 + Math.random() * 200
  };

  return (
    <BaseDraggableComponent 
      initialPosition={defaultPosition} 
      className="widget-component-wrapper"
    >
      <div className="widget-component">
        <div className="widget-header drag-handle">
          <h3>{name}</h3>
        </div>
        <div className="widget-content">
          {id === 'speed' && (
            <div className="speed-widget">
              <div className="speed-value">78</div>
              <div className="speed-unit">KPH</div>
            </div>
          )}
          {id === 'rpm' && (
            <div className="rpm-widget">
              <div className="rpm-gauge">
                <div className="rpm-needle" style={{ transform: 'rotate(45deg)' }}></div>
                <div className="rpm-value">6500</div>
              </div>
            </div>
          )}
          {id === 'lap-time' && (
            <div className="lap-widget">
              <div className="lap-current">
                <span className="lap-label">Current:</span>
                <span className="lap-value">1:24.356</span>
              </div>
              <div className="lap-best">
                <span className="lap-label">Best:</span>
                <span className="lap-value best">1:23.012</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseDraggableComponent>
  );
};

export default Widget; 