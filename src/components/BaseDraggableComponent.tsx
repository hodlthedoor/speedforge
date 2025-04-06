import React, { useState, useEffect, useRef, ReactNode } from 'react';

export interface BaseDraggableProps {
  initialPosition?: { x: number, y: number };
  className?: string;
  style?: React.CSSProperties;
  children: ReactNode;
  onPositionChange?: (position: { x: number, y: number }) => void;
}

export const BaseDraggableComponent: React.FC<BaseDraggableProps> = ({
  initialPosition = { x: 50, y: 50 }, // Default position
  className = '',
  style = {},
  children,
  onPositionChange
}) => {
  const [position, setPosition] = useState(initialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // Handle mouse down to start dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Only initiate drag from the header area, identified by a class
    if (!(e.target as HTMLElement).closest('.drag-handle')) {
      return;
    }

    // Prevent text selection during drag
    e.preventDefault();
    
    // Calculate the offset of the click relative to the component position
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;
    
    setDragOffset({ x: offsetX, y: offsetY });
    setIsDragging(true);
  };

  // Mouse move handler - update position when dragging
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    // Calculate new position considering the original click offset
    const newX = e.clientX - dragOffset.x;
    const newY = e.clientY - dragOffset.y;
    
    // Update the position
    setPosition({ x: newX, y: newY });
    
    // Notify parent about position change if callback provided
    if (onPositionChange) {
      onPositionChange({ x: newX, y: newY });
    }
  };

  // Mouse up handler - stop dragging
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Set up and clean up event listeners
  useEffect(() => {
    if (isDragging) {
      // Add global event listeners for dragging
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    
    // Cleanup function
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div
      ref={containerRef}
      className={`draggable-component ${isDragging ? 'dragging' : ''} ${className}`}
      style={{
        position: 'absolute',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default',
        userSelect: 'none',
        ...style
      }}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
};

export default BaseDraggableComponent; 