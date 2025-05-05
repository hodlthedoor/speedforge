import React, { useState, useEffect, useRef, ReactNode } from 'react';

// Add grid constants at the top of the file after imports
const GRID_SIZE = 20; // Size of each grid cell in pixels
const SNAP_THRESHOLD = 5; // Distance in pixels to trigger snapping

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
  
  // Extract widget ID from children if possible
  const getWidgetId = () => {
    try {
      if (!containerRef.current) return null;
      
      // First, try finding a child with data-widget-id attribute
      const element = containerRef.current.querySelector('[data-widget-id]');
      if (element) {
        return element.getAttribute('data-widget-id');
      }
      
      // Next, try finding a child with id attribute
      const elementWithId = containerRef.current.querySelector('[id]');
      if (elementWithId) {
        return elementWithId.getAttribute('id');
      }
      
      return null;
    } catch (error) {
      console.error('Error getting widget ID:', error);
      return null;
    }
  };

  // Listen for widget:position events to update position
  useEffect(() => {
    const handlePositionUpdate = (e: CustomEvent) => {
      const widgetId = getWidgetId();
      if (!widgetId) return;
      
      try {
        if (e.detail && e.detail.widgetId === widgetId && e.detail.position) {
          const newPosition = e.detail.position;
          console.log(`Position update received for widget ${widgetId}:`, newPosition);
          
          // Update the position state
          setPosition(newPosition);
          
          // Notify parent if callback provided
          if (onPositionChange) {
            onPositionChange(newPosition);
          }
        }
      } catch (error) {
        console.error('Error handling position update:', error);
      }
    };
    
    window.addEventListener('widget:position', handlePositionUpdate as EventListener);
    
    return () => {
      window.removeEventListener('widget:position', handlePositionUpdate as EventListener);
    };
  }, [onPositionChange]);

  // Modify grid snapping helper function to only snap to left and top borders
  const snapToGrid = (value: number): number => {
    const remainder = value % GRID_SIZE;
    if (remainder < SNAP_THRESHOLD) {
      return value - remainder;
    }
    return value;
  };

  // Handle mouse down to start dragging
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    // Skip if the click originated from an input, button, or other interactive element
    const targetElement = e.target as HTMLElement;
    if (
      targetElement.tagName === 'INPUT' || 
      targetElement.tagName === 'TEXTAREA' || 
      targetElement.tagName === 'SELECT' || 
      targetElement.tagName === 'BUTTON' ||
      targetElement.closest('input, textarea, select, button')
    ) {
      return;
    }
    
    // Only initiate drag from the header area, identified by a class
    if (!(targetElement).closest('.drag-handle')) {
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

  // Modify handleMouseMove to include grid snapping
  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    // Calculate new position considering the original click offset
    let newX = e.clientX - dragOffset.x;
    let newY = e.clientY - dragOffset.y;
    
    // Snap the widget position directly to the grid
    newX = Math.round(newX / GRID_SIZE) * GRID_SIZE;
    newY = Math.round(newY / GRID_SIZE) * GRID_SIZE;
    
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

  // Combine style props with our required positioning
  const combinedStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${position.x}px`,
    top: `${position.y}px`,
    cursor: isDragging ? 'grabbing' : 'default',
    userSelect: 'none',
    // No default padding or border here - let the caller specify these
    ...style
  };

  return (
    <div
      ref={containerRef}
      className={`${isDragging ? 'dragging' : ''} ${className}`}
      style={combinedStyle}
      onMouseDown={handleMouseDown}
    >
      {children}
    </div>
  );
};

export default BaseDraggableComponent; 