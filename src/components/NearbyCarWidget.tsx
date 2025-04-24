import React, { useEffect, useRef, useState, useCallback } from 'react';
import Widget from './Widget';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface NearbyCarWidgetProps {
  id: string;
  onClose: () => void;
}

const NearbyCarWidgetComponent: React.FC<NearbyCarWidgetProps> = ({ id, onClose }) => {
  // State for widget dimensions and side selection
  const [width, setWidth] = useState<number>(200);
  const [height, setHeight] = useState<number>(200);
  const [side, setSide] = useState<string>('left'); // 'left' or 'right'
  const [isClickThrough, setIsClickThrough] = useState<boolean>(false);
  
  // Get telemetry data
  const { data: telemetry } = useTelemetryData(id);
  
  // Refs to store current values
  const widthRef = useRef<number>(200);
  const heightRef = useRef<number>(200);
  const sideRef = useRef<string>('left');
  
  // Update refs when state changes
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  
  useEffect(() => {
    heightRef.current = height;
  }, [height]);
  
  useEffect(() => {
    sideRef.current = side;
  }, [side]);
  
  // Listen for app click-through state changes
  useEffect(() => {
    const handleClickThroughToggle = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail && customEvent.detail.state !== undefined) {
        setIsClickThrough(customEvent.detail.state);
      }
    };
    
    // Check URL parameters on load
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const clickThrough = urlParams.get('clickThrough');
      if (clickThrough === 'true') {
        setIsClickThrough(true);
      }
    } catch (error) {
      console.error('Error parsing URL parameters:', error);
    }
    
    window.addEventListener('app:toggle-click-through', handleClickThroughToggle as EventListener);
    
    return () => {
      window.removeEventListener('app:toggle-click-through', handleClickThroughToggle as EventListener);
    };
  }, []);
  
  // Callbacks for updating widget properties
  const updateWidth = useCallback((newWidth: number) => {
    if (widthRef.current !== newWidth) {
      setWidth(newWidth);
    }
  }, []);
  
  const updateHeight = useCallback((newHeight: number) => {
    if (heightRef.current !== newHeight) {
      setHeight(newHeight);
    }
  }, []);
  
  const updateSide = useCallback((newSide: string) => {
    if (sideRef.current !== newSide) {
      setSide(newSide);
    }
  }, []);
  
  // Expose functions via static properties
  (NearbyCarWidgetComponent as any).updateWidth = updateWidth;
  (NearbyCarWidgetComponent as any).updateHeight = updateHeight;
  (NearbyCarWidgetComponent as any).updateSide = updateSide;
  
  // Handle widget state updates
  useWidgetStateUpdates(id, (state) => {
    if (state.width !== undefined) {
      const newWidth = Number(state.width);
      if (widthRef.current !== newWidth) {
        setWidth(newWidth);
      }
    }
    
    if (state.height !== undefined) {
      const newHeight = Number(state.height);
      if (heightRef.current !== newHeight) {
        setHeight(newHeight);
      }
    }
    
    if (state.side !== undefined) {
      const newSide = String(state.side);
      if (sideRef.current !== newSide) {
        setSide(newSide);
      }
    }
  });
  
  // Initialize and sync with WidgetManager
  useEffect(() => {
    // Force resyncing from WidgetManager on every mount
    const widget = WidgetManager.getWidget(id);
    if (widget && widget.state) {
      // Sync width from WidgetManager
      if (widget.state.width !== undefined) {
        const storedWidth = Number(widget.state.width);
        if (storedWidth !== widthRef.current) {
          setWidth(storedWidth);
        }
      }
      
      // Sync height from WidgetManager
      if (widget.state.height !== undefined) {
        const storedHeight = Number(widget.state.height);
        if (storedHeight !== heightRef.current) {
          setHeight(storedHeight);
        }
      }
      
      // Sync side from WidgetManager
      if (widget.state.side !== undefined) {
        const storedSide = String(widget.state.side);
        if (storedSide !== sideRef.current) {
          setSide(storedSide);
        }
      }
    } else {
      // Initialize widget state if it doesn't exist
      WidgetManager.updateWidgetState(id, {
        width: widthRef.current,
        height: heightRef.current,
        side: sideRef.current
      });
    }
    
    // Subscribe to WidgetManager updates
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.width !== undefined) {
          const newWidth = Number(event.state.width);
          if (widthRef.current !== newWidth) {
            setWidth(newWidth);
          }
        }
        
        if (event.state.height !== undefined) {
          const newHeight = Number(event.state.height);
          if (heightRef.current !== newHeight) {
            setHeight(newHeight);
          }
        }
        
        if (event.state.side !== undefined) {
          const newSide = String(event.state.side);
          if (sideRef.current !== newSide) {
            setSide(newSide);
          }
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]);
  
  // Sync state changes with WidgetManager
  useEffect(() => {
    if (widthRef.current === width) return;
    WidgetManager.updateWidgetState(id, { width });
  }, [width, id]);
  
  useEffect(() => {
    if (heightRef.current === height) return;
    WidgetManager.updateWidgetState(id, { height });
  }, [height, id]);
  
  useEffect(() => {
    if (sideRef.current === side) return;
    WidgetManager.updateWidgetState(id, { side });
  }, [side, id]);
  
  // Determine the display state based on telemetry data and selected side
  const getDisplayState = () => {
    if (!telemetry || telemetry.car_left_right_raw === undefined) {
      return { color: 'transparent', text: side === 'left' ? 'L' : 'R' };
    }
    
    const carLeftRightValue = telemetry.car_left_right_raw;
    
    if (side === 'left') {
      // Check for left side cars
      if (carLeftRightValue === 2) { // One car on left
        return { color: 'yellow', text: 'L' };
      } else if (carLeftRightValue === 5) { // Two cars on left
        return { color: 'red', text: 'L' };
      } else if (carLeftRightValue === 4) { // Cars on both sides
        return { color: 'yellow', text: 'L' };
      }
    } else { // side === 'right'
      // Check for right side cars
      if (carLeftRightValue === 3) { // One car on right
        return { color: 'yellow', text: 'R' };
      } else if (carLeftRightValue === 6) { // Two cars on right
        return { color: 'red', text: 'R' };
      } else if (carLeftRightValue === 4) { // Cars on both sides
        return { color: 'yellow', text: 'R' };
      }
    }
    
    // No cars on the selected side
    return { color: 'transparent', text: side === 'left' ? 'L' : 'R' };
  };
  
  const displayState = getDisplayState();

  return (
    <Widget id={id} title="Nearby Car Indicator" onClose={onClose} width={width}>
      <div
        style={{
          width: width,
          height: height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.min(width, height) / 3}px`,
          fontWeight: 'bold',
          backgroundColor: displayState.color,
          color: displayState.color === 'transparent' ? '#333' : 'white',
          opacity: displayState.color === 'transparent' && isClickThrough ? 0 : 1
        }}
      >
        {!isClickThrough && displayState.text}
      </div>
    </Widget>
  );
};

// Control definitions for the widget registry
const getNearbyCarWidgetControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default values if not set
  const width = widgetState.width || 200;
  const height = widgetState.height || 200;
  const side = widgetState.side || 'left';
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'side',
      type: 'toggle' as WidgetControlType,
      label: 'Side',
      value: side === 'right',
      options: [
        { value: false, label: 'Left' },
        { value: true, label: 'Right' }
      ],
      onChange: (value) => {
        const sideValue = value ? 'right' : 'left';
        updateWidget({ side: sideValue });
        
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { side: sideValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    },
    {
      id: 'width',
      type: 'slider' as WidgetControlType,
      label: `Width: ${width}px`,
      value: width,
      options: [
        { value: 100, label: '100px' },
        { value: 150, label: '150px' },
        { value: 200, label: '200px' },
        { value: 250, label: '250px' },
        { value: 300, label: '300px' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ width: numericValue });
        
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { width: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    },
    {
      id: 'height',
      type: 'slider' as WidgetControlType,
      label: `Height: ${height}px`,
      value: height,
      options: [
        { value: 100, label: '100px' },
        { value: 150, label: '150px' },
        { value: 200, label: '200px' },
        { value: 250, label: '250px' },
        { value: 300, label: '300px' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ height: numericValue });
        
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { height: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    }
  ];
  
  return controls;
};

// Wrap the component with controls for the registry
const NearbyCarWidget = withControls(NearbyCarWidgetComponent, getNearbyCarWidgetControls);

export default NearbyCarWidget; 