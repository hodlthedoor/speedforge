import React, { useEffect, useState } from 'react';
import Widget from './Widget';
import { TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

interface SimpleRaceTelemetryWidgetProps {
  id: string;
  onClose: () => void;
  // Default state props passed from the widget registry
  selectedMetric?: TelemetryMetric;
  sortBy?: 'position' | 'laptime' | 'name' | 'number' | 'class' | 'metric';
  showDetails?: boolean;
  highlightClass?: boolean;
  maxItems?: number;
  name?: string;
}

// Internal component that uses state from widget manager
const SimpleRaceTelemetryWidgetInternal: React.FC<SimpleRaceTelemetryWidgetProps> = (props) => {
  const {
    id,
    onClose,
    selectedMetric = 'CarIdxPosition',
    sortBy = 'position',
    showDetails = false,
    highlightClass = true,
    maxItems = 10,
    name = 'Race Data',
    ...otherProps
  } = props;

  // Log ALL props received
  console.log(`[SimpleRaceTelemetryWidget ${id}] FULL PROPS OBJECT:`, props);
  
  // Log props when component renders
  console.log(`[SimpleRaceTelemetryWidget ${id}] Rendering with props:`, {
    selectedMetric,
    sortBy,
    showDetails,
    highlightClass,
    maxItems,
    name
  });
  
  // Log when props change
  useEffect(() => {
    console.log(`[SimpleRaceTelemetryWidget ${id}] selectedMetric changed to:`, selectedMetric);
  }, [id, selectedMetric]);
  
  useEffect(() => {
    console.log(`[SimpleRaceTelemetryWidget ${id}] sortBy changed to:`, sortBy);
  }, [id, sortBy]);
  
  useEffect(() => {
    console.log(`[SimpleRaceTelemetryWidget ${id}] showDetails changed to:`, showDetails);
  }, [id, showDetails]);
  
  useEffect(() => {
    console.log(`[SimpleRaceTelemetryWidget ${id}] highlightClass changed to:`, highlightClass);
  }, [id, highlightClass]);
  
  useEffect(() => {
    console.log(`[SimpleRaceTelemetryWidget ${id}] maxItems changed to:`, maxItems);
  }, [id, maxItems]);

  return (
    <Widget 
      id={id} 
      title={name || 'Race Data Controls Test'}
      onClose={onClose}
      className="w-full h-full"
    >
      <div className="w-full h-full min-h-[240px] min-w-[240px] flex flex-col items-center justify-center p-4">
        <h2 className="text-lg font-bold mb-4 text-center">Control Values</h2>
        
        <div className="w-full space-y-4 bg-slate-800/50 p-4 rounded">
          <div className="flex justify-between">
            <span className="font-medium text-slate-300">Metric:</span>
            <span className="font-mono text-slate-100">{selectedMetric}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-medium text-slate-300">Sort By:</span>
            <span className="font-mono text-slate-100">{sortBy}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-medium text-slate-300">Show Details:</span>
            <span className="font-mono text-slate-100">{showDetails ? 'Yes' : 'No'}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-medium text-slate-300">Highlight Class:</span>
            <span className="font-mono text-slate-100">{highlightClass ? 'Yes' : 'No'}</span>
          </div>
          
          <div className="flex justify-between">
            <span className="font-medium text-slate-300">Max Items:</span>
            <span className="font-mono text-slate-100">{maxItems}</span>
          </div>
        </div>
        
        <div className="mt-6 text-sm text-slate-400 text-center">
          This is a test widget to verify control values are passing through.
          <br />
          Try changing the controls in the Control Panel.
          <br />
          Check the browser console for detailed logs.
        </div>
      </div>
    </Widget>
  );
};

// Wrapper component that synchronizes with the WidgetManager
const SimpleRaceTelemetryWidgetComponent: React.FC<SimpleRaceTelemetryWidgetProps> = (props) => {
  const { id } = props;
  
  // Get initial state from WidgetManager
  const widget = WidgetManager.getWidget(id);
  const initialState = widget?.state || {};
  
  // Local state to force re-renders when widget state changes
  const [stateVersion, setStateVersion] = useState(0);
  
  // Subscribe to widget state updates
  useEffect(() => {
    console.log(`[SimpleRaceTelemetryWidgetComponent] Setting up subscription for widget ${id}`);
    
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        console.log(`[SimpleRaceTelemetryWidgetComponent] Received state update for widget ${id}:`, event.state);
        // Force re-render
        setStateVersion(v => v + 1);
      }
    });
    
    return () => {
      console.log(`[SimpleRaceTelemetryWidgetComponent] Cleaning up subscription for widget ${id}`);
      unsubscribe();
    };
  }, [id]);
  
  // Get latest state from WidgetManager
  const currentWidget = WidgetManager.getWidget(id);
  const currentState = currentWidget?.state || initialState;
  
  console.log(`[SimpleRaceTelemetryWidgetComponent] Rendering widget ${id} with state:`, currentState);
  console.log(`[SimpleRaceTelemetryWidgetComponent] State version: ${stateVersion}`);
  
  // Combine props with current widget state
  const combinedProps = {
    ...props,
    selectedMetric: currentState.selectedMetric,
    sortBy: currentState.sortBy,
    showDetails: currentState.showDetails,
    highlightClass: currentState.highlightClass,
    maxItems: currentState.maxItems
  };
  
  return <SimpleRaceTelemetryWidgetInternal {...combinedProps} />;
};

// Create the control definitions for the widget
const getControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  console.log('SimpleRaceTelemetryWidget getControls called with state:', widgetState);
  
  const onChange = (id: string, value: any) => {
    console.log(`[SimpleRaceTelemetryWidget Controls] Changing ${id} to:`, value);
    const update = { [id]: value };
    console.log(`[SimpleRaceTelemetryWidget Controls] Updating widget with:`, update);
    updateWidget(update);
  };
  
  return [
    {
      id: 'selectedMetric',
      type: 'select',
      label: 'Metric',
      value: widgetState.selectedMetric || 'CarIdxPosition',
      options: [
        { value: 'CarIdxPosition', label: 'Position' },
        { value: 'CarIdxLapDistPct', label: 'Track Position %' },
        { value: 'CarIdxLap', label: 'Current Lap' },
        { value: 'CarIdxLapCompleted', label: 'Completed Lap' },
        { value: 'CarIdxLastLapTime', label: 'Last Lap Time' },
        { value: 'CarIdxBestLapTime', label: 'Best Lap Time' },
        { value: 'CarIdxBestLapNum', label: 'Best Lap Number' },
        { value: 'CarIdxClass', label: 'Car Class' },
        { value: 'CarIdxClassPosition', label: 'Class Position' },
        { value: 'CarIdxGear', label: 'Gear' },
        { value: 'CarIdxRPM', label: 'RPM' },
        { value: 'CarIdxOnPitRoad', label: 'On Pit Road' },
        { value: 'CarIdxF2Time', label: 'Gap Time' },
        { value: 'CarIdxEstTime', label: 'Estimated Time' },
        { value: 'CarIdxFastRepairsUsed', label: 'Fast Repairs Used' },
        { value: 'CarIdxP2P_Count', label: 'Push-to-Pass Count' },
        { value: 'CarIdxP2P_Status', label: 'Push-to-Pass Status' },
        { value: 'CarIdxPaceFlags', label: 'Pace Flags' },
        { value: 'CarIdxPaceLine', label: 'Pace Line' },
        { value: 'CarIdxPaceRow', label: 'Pace Row' },
        { value: 'CarIdxQualTireCompound', label: 'Qualifying Tire Compound' },
        { value: 'CarIdxQualTireCompoundLocked', label: 'Qual Tire Compound Locked' },
        { value: 'CarIdxSteer', label: 'Steering Input' },
        { value: 'CarIdxTireCompound', label: 'Tire Compound' },
        { value: 'CarIdxTrackSurface', label: 'Track Surface' },
        { value: 'CarIdxTrackSurfaceMaterial', label: 'Track Surface Material' }
      ],
      onChange: (value) => onChange('selectedMetric', value)
    },
    {
      id: 'sortBy',
      type: 'select',
      label: 'Sort By',
      value: widgetState.sortBy || 'position',
      options: [
        { value: 'position', label: 'Position' },
        { value: 'laptime', label: 'Best Lap Time' },
        { value: 'name', label: 'Driver Name' },
        { value: 'number', label: 'Car Number' },
        { value: 'class', label: 'Car Class' },
        { value: 'metric', label: 'Current Metric' }
      ],
      onChange: (value) => onChange('sortBy', value)
    },
    {
      id: 'showDetails',
      type: 'toggle',
      label: 'Show Details',
      value: widgetState.showDetails !== undefined ? widgetState.showDetails : false,
      onChange: (value) => onChange('showDetails', value)
    },
    {
      id: 'highlightClass',
      type: 'toggle',
      label: 'Highlight Class',
      value: widgetState.highlightClass !== undefined ? widgetState.highlightClass : true,
      onChange: (value) => onChange('highlightClass', value)
    },
    {
      id: 'maxItems',
      type: 'slider',
      label: 'Max Cars',
      value: widgetState.maxItems || 10,
      options: [
        { value: 3, label: '3' },
        { value: 10, label: '10' },
        { value: 20, label: '20' },
        { value: 30, label: '30' }
      ],
      onChange: (value) => onChange('maxItems', value)
    }
  ];
};

// Apply the withControls HOC to the component
const SimpleRaceTelemetryWidget = withControls(SimpleRaceTelemetryWidgetComponent, getControls);

export default SimpleRaceTelemetryWidget; 