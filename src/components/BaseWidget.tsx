import React from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';

interface BaseWidgetProps {
  id: string;
  title: string;
  onClose: () => void;
  initialPosition?: { x: number, y: number };
  className?: string;
  children: React.ReactNode;
}

const BaseWidget: React.FC<BaseWidgetProps> = ({
  id,
  title,
  onClose,
  initialPosition = { x: 100, y: 100 },
  className = '',
  children
}) => {
  return (
    <BaseDraggableComponent
      initialPosition={initialPosition}
      className={`interactive ${className}`}
    >
      <div 
        className="bg-gray-800 text-white p-4 rounded-lg shadow-lg w-[440px]"
        onClick={() => {
          // Emit widget:clicked event
          const event = new CustomEvent('widget:clicked', { 
            detail: { widgetId: id }
          });
          window.dispatchEvent(event);
        }}
      >
        <div className="flex justify-between items-center mb-4 drag-handle">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={(e) => {
              e.stopPropagation(); // Prevent click from bubbling to parent
              onClose();
            }}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </BaseDraggableComponent>
  );
};

export default BaseWidget; 