import React, { useEffect, useState } from 'react';
import WidgetManager, { WidgetInstance } from '../services/WidgetManager';
import WidgetRegistry, { WidgetControlDefinition } from '../widgets/WidgetRegistry';

interface WidgetControlPanelProps {
  className?: string;
}

// Generic control renderer
function ControlRenderer({ control, widgetId }: { control: WidgetControlDefinition, widgetId?: string }) {
  // Render different control types
  switch (control.type) {
    case 'button':
      return (
        <button
          className="btn btn-sm"
          onClick={() => control.onChange(null)}
        >
          {control.label}
        </button>
      );
    case 'select':
      return (
        <div className="flex flex-col">
          <label className="text-xs text-gray-400 mb-1">{control.label}</label>
          <select
            className="px-2 py-1 bg-gray-700 text-white text-sm rounded border border-gray-600"
            value={control.value}
            onChange={(e) => control.onChange(e.target.value)}
          >
            {control.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'slider':
      return (
        <div className="flex flex-col">
          <label className="text-xs text-gray-400 mb-1">
            {control.label}: {control.value}
          </label>
          <input
            type="range"
            className="w-full"
            value={control.value}
            onChange={(e) => {
              const newValue = parseFloat(e.target.value);
              console.log(`[WidgetControlPanel] Slider ${control.id} value changing to: ${newValue}`);
              console.log(`[WidgetControlPanel] Control value before: ${control.value}`);
              
              // For historyLength sliders, also dispatch a direct event to ensure the widget receives it
              if (control.id === 'historyLength' && widgetId) {
                const directEvent = new CustomEvent('pedal-trace:history-length', {
                  detail: {
                    widgetId,
                    historyLength: newValue
                  }
                });
                console.log(`[WidgetControlPanel] Dispatching direct pedal-trace:history-length event with value: ${newValue}`);
                window.dispatchEvent(directEvent);
              }
              
              control.onChange(newValue);
              console.log(`[WidgetControlPanel] After calling control.onChange(${newValue})`);
            }}
            {...control.options?.reduce((acc, opt) => ({ ...acc, [opt.value]: opt.label }), {})}
          />
        </div>
      );
    case 'toggle':
      return (
        <div className="flex items-center justify-between">
          <label className="text-xs text-gray-400">{control.label}</label>
          <div
            className={`w-10 h-5 rounded-full cursor-pointer ${
              control.value ? 'bg-blue-600' : 'bg-gray-700'
            }`}
            onClick={() => control.onChange(!control.value)}
          >
            <div
              className={`transform h-5 w-5 bg-white rounded-full transition-transform ${
                control.value ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </div>
        </div>
      );
    case 'color-picker':
      return (
        <div className="flex flex-col">
          <label className="text-xs text-gray-400 mb-1">{control.label}</label>
          <input
            type="color"
            className="w-full h-8 rounded border border-gray-600 bg-transparent"
            value={control.value}
            onChange={(e) => control.onChange(e.target.value)}
          />
        </div>
      );
    default:
      return <div>Unknown control type: {control.type}</div>;
  }
}

// Widget Control Panel Component
const WidgetControlPanel: React.FC<WidgetControlPanelProps> = ({ className }) => {
  const [selectedWidget, setSelectedWidget] = useState<WidgetInstance | null>(null);
  const [controls, setControls] = useState<WidgetControlDefinition[]>([]);

  // Listen for widget selection changes
  useEffect(() => {
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:selected') {
        const widget = event.widgetId ? WidgetManager.getWidget(event.widgetId) : null;
        setSelectedWidget(widget || null);
      } else if (
        event.type === 'widget:state:updated' &&
        selectedWidget &&
        event.widgetId === selectedWidget.id
      ) {
        // Refresh controls when the selected widget's state changes
        updateControls(selectedWidget.type, selectedWidget.id, event.state);
      }
    });

    return unsubscribe;
  }, [selectedWidget]);

  // Update controls when selected widget changes
  useEffect(() => {
    if (selectedWidget) {
      updateControls(selectedWidget.type, selectedWidget.id, selectedWidget.state);
    } else {
      setControls([]);
    }
  }, [selectedWidget]);

  // Function to update controls based on widget type and state
  const updateControls = (type: string, id: string, state: Record<string, any>) => {
    console.log(`[WidgetControlPanel] updateControls called for widget ${id} (${type}) with state:`, state);
    
    const updateWidget = (updates: Record<string, any>) => {
      console.log(`[WidgetControlPanel] updateWidget called with updates:`, updates);
      console.log(`[WidgetControlPanel] Current widget ID: ${id}`);
      WidgetManager.updateWidgetState(id, updates);
      console.log(`[WidgetControlPanel] Called WidgetManager.updateWidgetState(${id}, updates)`);
    };

    // Get controls from the widget registry
    console.log(`[WidgetControlPanel] Getting widget controls from registry for type: ${type}`);
    const widgetControls = WidgetRegistry.getWidgetControls(type, state, updateWidget);
    console.log(`[WidgetControlPanel] Got ${widgetControls.length} controls from registry`);
    
    // Filter controls based on conditionals
    const filteredControls = widgetControls.filter(
      (control) => !control.conditional || control.conditional(state)
    );
    
    console.log(`[WidgetControlPanel] Setting ${filteredControls.length} filtered controls`);
    setControls(filteredControls);
  };

  // Render nothing if no widget is selected
  if (!selectedWidget) {
    return null;
  }

  return (
    <div className={`widget-control-panel ${className || ''}`}>
      <div className="widget-details-header">
        <h4 className="text-sm font-medium text-gray-300">
          {selectedWidget.title || `Widget ${selectedWidget.id.slice(0, 6)}`}
        </h4>
        <button
          className="widget-close-btn text-gray-400 hover:text-white"
          onClick={() => WidgetManager.removeWidget(selectedWidget.id)}
          title="Close Widget"
        >
          ×
        </button>
      </div>
      
      <div className="widget-details">
        <div className="text-xs text-gray-500 mb-2">
          Type: {selectedWidget.type}
        </div>
      </div>
      
      {controls.length > 0 ? (
        <div className="widget-controls space-y-3 mt-4">
          {controls.map((control) => (
            <div key={control.id} className="control-item">
              <ControlRenderer control={control} widgetId={selectedWidget.id} />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-500 mt-4">
          No controls available for this widget
        </div>
      )}
    </div>
  );
};

export default WidgetControlPanel; 