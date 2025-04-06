import React, { useState, useEffect } from 'react';
import { WidgetType } from '../types/widget';
import { WidgetRenderer } from '../widgets/WidgetFactory';

interface WidgetInstance {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  width: number;
  height: number;
  params: Record<string, any>;
  visible: boolean;
  alwaysOnTop: boolean;
  opacity: number;
}

interface WidgetBoardProps {
  initialWidgets?: WidgetInstance[];
  onWidgetAdd?: (widget: WidgetInstance) => void;
  onWidgetRemove?: (widgetId: string) => void;
  onWidgetUpdate?: (widget: WidgetInstance) => void;
}

const WidgetBoard: React.FC<WidgetBoardProps> = ({
  initialWidgets = [],
  onWidgetAdd,
  onWidgetRemove,
  onWidgetUpdate
}) => {
  const [widgets, setWidgets] = useState<WidgetInstance[]>(initialWidgets);
  const [isDragging, setIsDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Widget management functions
  const addWidget = (widget: WidgetInstance) => {
    setWidgets(prev => [...prev, widget]);
    onWidgetAdd?.(widget);
  };

  const removeWidget = (widgetId: string) => {
    setWidgets(prev => prev.filter(w => w.id !== widgetId));
    onWidgetRemove?.(widgetId);
  };

  const updateWidget = (widgetId: string, updates: Partial<WidgetInstance>) => {
    setWidgets(prev => prev.map(w => {
      if (w.id === widgetId) {
        const updated = { ...w, ...updates };
        onWidgetUpdate?.(updated);
        return updated;
      }
      return w;
    }));
  };

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent, widgetId: string) => {
    const widget = widgets.find(w => w.id === widgetId);
    if (!widget) return;
    
    // Calculate offset from mouse position to top-left corner of widget
    setDragOffset({
      x: e.clientX - widget.x,
      y: e.clientY - widget.y
    });
    
    setIsDragging(widgetId);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging) return;
    
    updateWidget(isDragging, {
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(null);
  };

  // Set up global mouse event listeners for dragging
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  return (
    <div className="widget-board relative w-full h-full">
      {widgets
        .filter(widget => widget.visible)
        .sort((a, b) => (a.alwaysOnTop === b.alwaysOnTop ? 0 : a.alwaysOnTop ? 1 : -1))
        .map(widget => (
          <div
            key={widget.id}
            className="absolute rounded-lg shadow-lg overflow-hidden"
            style={{
              left: `${widget.x}px`,
              top: `${widget.y}px`,
              width: `${widget.width}px`,
              height: `${widget.height}px`,
              opacity: widget.opacity,
              zIndex: widget.alwaysOnTop ? 10 : 1,
              transition: isDragging === widget.id ? 'none' : 'all 0.2s ease'
            }}
          >
            {/* Use the MouseDown handle on the header for dragging - not the entire widget */}
            <div 
              className="widget-handle absolute top-0 left-0 right-0 h-8 cursor-grab"
              onMouseDown={(e) => handleMouseDown(e, widget.id)}
            />
            
            {/* Use the WidgetRenderer to render the appropriate widget component */}
            <WidgetRenderer
              type={widget.type}
              id={widget.id}
              x={widget.x}
              y={widget.y}
              width={widget.width}
              height={widget.height}
              params={widget.params}
              opacity={widget.opacity}
              alwaysOnTop={widget.alwaysOnTop}
              visible={widget.visible}
              onClose={() => removeWidget(widget.id)}
              onMove={(x, y) => updateWidget(widget.id, { x, y })}
              onResize={(width, height) => updateWidget(widget.id, { width, height })}
              onParamsUpdate={(params) => updateWidget(widget.id, { params: { ...widget.params, ...params } })}
              onVisibilityChange={(visible) => updateWidget(widget.id, { visible })}
              onOpacityChange={(opacity) => updateWidget(widget.id, { opacity })}
              onAlwaysOnTopChange={(alwaysOnTop) => updateWidget(widget.id, { alwaysOnTop })}
            />
          </div>
        ))}
    </div>
  );
};

export default WidgetBoard; 