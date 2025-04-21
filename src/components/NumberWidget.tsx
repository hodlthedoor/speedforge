import React, { useEffect, useRef, useState, useCallback } from 'react';
import Widget from './Widget';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';

interface NumberWidgetProps {
  id: string;
  onClose: () => void;
}

const NumberWidgetComponent: React.FC<NumberWidgetProps> = ({ id, onClose }) => {
  // State for widget dimensions and value
  const [width, setWidth] = useState<number>(480);
  const [height, setHeight] = useState<number>(200);
  const [value, setValue] = useState<number>(50);
  
  // Refs to store current values
  const widthRef = useRef<number>(480);
  const heightRef = useRef<number>(200);
  const valueRef = useRef<number>(50);
  
  // Update refs when state changes
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  
  useEffect(() => {
    heightRef.current = height;
  }, [height]);
  
  useEffect(() => {
    valueRef.current = value;
  }, [value]);
  
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
  
  const updateValue = useCallback((newValue: number) => {
    if (valueRef.current !== newValue) {
      setValue(newValue);
    }
  }, []);
  
  // Expose functions via static properties
  (NumberWidgetComponent as any).updateWidth = updateWidth;
  (NumberWidgetComponent as any).updateHeight = updateHeight;
  (NumberWidgetComponent as any).updateValue = updateValue;
  
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
    
    if (state.value !== undefined) {
      const newValue = Number(state.value);
      if (valueRef.current !== newValue) {
        setValue(newValue);
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
      
      // Sync value from WidgetManager
      if (widget.state.value !== undefined) {
        const storedValue = Number(widget.state.value);
        if (storedValue !== valueRef.current) {
          setValue(storedValue);
        }
      }
    } else {
      // Initialize widget state if it doesn't exist
      WidgetManager.updateWidgetState(id, {
        width: widthRef.current,
        height: heightRef.current,
        value: valueRef.current
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
        
        if (event.state.value !== undefined) {
          const newValue = Number(event.state.value);
          if (valueRef.current !== newValue) {
            setValue(newValue);
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
    if (valueRef.current === value) return;
    WidgetManager.updateWidgetState(id, { value });
  }, [value, id]);

  return (
    <Widget id={id} title="Number Widget" onClose={onClose} width={width}>
      <div
        style={{
          width: width,
          height: height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: `${Math.min(width, height) / 3}px`,
          fontWeight: 'bold'
        }}
      >
        {value}
      </div>
    </Widget>
  );
};

// Control definitions for the widget registry
const getNumberWidgetControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default values if not set
  const width = widgetState.width || 480;
  const height = widgetState.height || 200;
  const value = widgetState.value || 50;
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'width',
      type: 'slider' as WidgetControlType,
      label: `Width: ${width}px`,
      value: width,
      options: [
        { value: 200, label: '200px' },
        { value: 300, label: '300px' },
        { value: 400, label: '400px' },
        { value: 500, label: '500px' },
        { value: 600, label: '600px' },
        { value: 800, label: '800px' }
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
        { value: 300, label: '300px' },
        { value: 400, label: '400px' }
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
    },
    {
      id: 'value',
      type: 'slider' as WidgetControlType,
      label: `Value: ${value}`,
      value: value,
      options: [
        { value: 1, label: '1' },
        { value: 20, label: '20' },
        { value: 40, label: '40' },
        { value: 60, label: '60' },
        { value: 80, label: '80' },
        { value: 100, label: '100' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ value: numericValue });
        
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { value: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    }
  ];
  
  return controls;
};

// Wrap the component with controls for the registry
const NumberWidget = withControls(NumberWidgetComponent, getNumberWidgetControls);

export default NumberWidget; 