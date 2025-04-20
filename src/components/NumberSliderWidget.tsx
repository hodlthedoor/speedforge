import React, { useState, useEffect } from 'react';
import Widget from './Widget';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

interface NumberSliderWidgetProps {
  id: string;
  onClose: () => void;
  options?: {
    value?: number;
    fontSize?: number;
    textColor?: string;
    debug?: boolean;
  };
}

const NumberSliderWidgetComponent: React.FC<NumberSliderWidgetProps> = ({ 
  id, 
  onClose,
  options = {}
}) => {
  // Debug mode
  const [showDebug, setShowDebug] = useState(options.debug || false);

  // Default state values
  const defaultState = {
    value: options.value !== undefined ? options.value : 50,
    fontSize: options.fontSize !== undefined ? options.fontSize : 3,
    textColor: options.textColor !== undefined ? options.textColor : '#3B82F6'
  };
  
  // Create a re-render counter to update when state changes
  const [updateCounter, setUpdateCounter] = useState(0);
  
  // Get the current widget state directly from WidgetManager
  const getCurrentState = () => {
    const widget = WidgetManager.getWidget(id);
    return { ...defaultState, ...widget?.state };
  };
  
  // Listen for widget state updates from control panel
  useEffect(() => {
    const handleStateUpdate = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { widgetId } = customEvent.detail;
      if (widgetId === id) {
        // Force re-render to get new state
        setUpdateCounter(c => c + 1);
      }
    };
    
    window.addEventListener('widget:state:updated', handleStateUpdate);
    
    return () => {
      window.removeEventListener('widget:state:updated', handleStateUpdate);
    };
  }, [id]);

  // Current state for rendering
  const widgetState = getCurrentState();
  
  // Update slider value when changed
  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    WidgetManager.updateWidgetState(id, { value: newValue });
    // Force re-render
    setUpdateCounter(c => c + 1);
  };
  
  // Toggle debug display
  const toggleDebug = () => {
    setShowDebug(prev => !prev);
  };

  return (
    <Widget id={id} title="Number Slider" onClose={onClose}>
      <div className="number-slider-widget p-4 flex flex-col items-center justify-center min-h-[200px]">
        <div 
          className="value-display mb-4"
          style={{ 
            fontSize: `${widgetState.fontSize}rem`,
            color: widgetState.textColor,
            fontWeight: 'bold',
            transition: 'all 0.3s ease'
          }}
          onClick={toggleDebug}
        >
          {widgetState.value}
        </div>
        
        <div className="slider-control w-full">
          <input
            type="range"
            min="0"
            max="100"
            value={widgetState.value}
            onChange={handleSliderChange}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
        </div>
        
        {/* Debug information - click the number to toggle */}
        {showDebug && (
          <div className="debug-info mt-4 p-2 bg-gray-100 rounded text-xs text-left w-full">
            <div><strong>Widget ID:</strong> {id}</div>
            <div><strong>Widget State:</strong> {JSON.stringify(widgetState)}</div>
            <div><strong>Update Counter:</strong> {updateCounter}</div>
          </div>
        )}
      </div>
    </Widget>
  );
};

// Define control definitions for the widget registry
const getNumberSliderControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Use default values only if nothing is defined in widgetState
  const value = widgetState.value !== undefined ? widgetState.value : 50;
  const fontSize = widgetState.fontSize !== undefined ? widgetState.fontSize : 3;
  const textColor = widgetState.textColor !== undefined ? widgetState.textColor : '#3B82F6';
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'value',
      type: 'slider' as WidgetControlType,
      label: `Value: ${value}`,
      value: value,
      onChange: (newValue) => {
        updateWidget({ value: Number(newValue) });
      }
    },
    {
      id: 'fontSize',
      type: 'slider' as WidgetControlType,
      label: `Font Size: ${fontSize}rem`,
      value: fontSize,
      options: [
        { value: 1, label: 'Small' },
        { value: 3, label: 'Medium' },
        { value: 5, label: 'Large' },
        { value: 7, label: 'X-Large' }
      ],
      onChange: (newValue) => {
        updateWidget({ fontSize: Number(newValue) });
      }
    },
    {
      id: 'textColor',
      type: 'color-picker' as WidgetControlType,
      label: 'Text Color',
      value: textColor,
      onChange: (newValue) => {
        updateWidget({ textColor: newValue });
      }
    },
    {
      id: 'debug',
      type: 'toggle' as WidgetControlType,
      label: 'Debug Mode',
      value: false,
      onChange: (newValue) => {
        updateWidget({ debug: Boolean(newValue) });
      }
    }
  ];
  
  return controls;
};

// Set the display name to help with automatic type detection
NumberSliderWidgetComponent.displayName = 'NumberSliderWidget';

// Wrap component with controls and export
const NumberSliderWidget = withControls(NumberSliderWidgetComponent, getNumberSliderControls);
export default NumberSliderWidget; 