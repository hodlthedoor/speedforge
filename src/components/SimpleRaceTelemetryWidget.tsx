import React, { useEffect, useState, useMemo, useRef } from 'react';
import Widget from './Widget';
import { useTelemetryData, formatTelemetryValue, getMetricName, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
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
  widgetWidth?: number;
  fontSize?: 'text-xs' | 'text-sm' | 'text-base' | 'text-lg';
  selectedColumns?: string[]; // New property for column selection
}

// Define available columns
const AVAILABLE_COLUMNS = [
  { value: 'position', label: 'Position' },
  { value: 'carNumber', label: 'Car #' },
  { value: 'driverName', label: 'Driver' },
  { value: 'teamName', label: 'Team' },
  { value: 'carClass', label: 'Class' },
  { value: 'currentLap', label: 'Lap' },
  { value: 'iRating', label: 'iRating' },
  { value: 'license', label: 'License' },
  { value: 'incidents', label: 'Incidents' },
  { value: 'lastLapTime', label: 'Last Lap' },
  { value: 'bestLapTime', label: 'Best Lap' },
  { value: 'metricValue', label: 'Current Metric' }
];

// Default columns to show
const DEFAULT_COLUMNS = ['position', 'driverName', 'carClass', 'currentLap', 'metricValue'];

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
    widgetWidth = 600,
    fontSize = 'text-sm',
    selectedColumns = DEFAULT_COLUMNS,
    ...otherProps
  } = props;

  // Ensure we have a valid selectedColumns array
  const actualColumns = Array.isArray(selectedColumns) ? selectedColumns : DEFAULT_COLUMNS;
  
  // Reference to track width changes
  const widgetWidthRef = useRef<number>(widgetWidth);
  
  // Keep ref in sync with width prop
  useEffect(() => {
    widgetWidthRef.current = widgetWidth;
  }, [id, widgetWidth]);

  // Use the telemetry hook to get car index data
  const { data: telemetryData, sessionData } = useTelemetryData(id, {
    metrics: [
      'CarIdxPosition',
      'CarIdxLap',
      'CarIdxLapCompleted',
      'CarIdxLastLapTime',
      'CarIdxBestLapTime',
      'CarIdxClass',
      'CarIdxClassPosition',
      'CarIdxGear',
      'CarIdxRPM',
      'CarIdxOnPitRoad',
      'CarIdxLapDistPct',
      selectedMetric, // Always include the currently selected metric
    ],
  });

  // Log only the most important props - focused on columns
  console.log(`[SimpleRaceTelemetryWidget] Rendering with columns:`, {
    columnsSelected: actualColumns, 
    columnCount: actualColumns.length
  });
  
  // Process the telemetry data to create the table rows
  const formattedCarData = useMemo(() => {
    if (!telemetryData || !sessionData) return [];

    // Only log session data the first time
    if (process.env.NODE_ENV === 'development' && !formattedCarData.length) {
      console.log('SESSION DATA (abbreviated):', {
        hasWeekend: !!sessionData.weekend,
        hasSession: !!sessionData.session,
        hasDrivers: !!sessionData.drivers, 
        driverCount: sessionData.drivers?.other_drivers?.length
      });
    }

    // Extract driver information from session data
    // All drivers are in the other_drivers array
    const allDrivers = sessionData.drivers?.other_drivers || [];
    
    // Determine which driver is the player (usually the first one with index 0)
    // In the absence of explicit player info, we can use index 0 as a heuristic
    const playerCarIndex = sessionData.drivers?.car_index || 0;
    
    // Get array of car indices (0 to max car index)
    const carIndices = telemetryData[selectedMetric] 
      ? Array.from({ length: telemetryData[selectedMetric].length }, (_, i) => i)
      : [];

    // Create a row for each car with all the relevant data
    const carRows = carIndices.map(carIdx => {
      // Find driver info for this car by matching index
      const driver = allDrivers.find(d => d.index === carIdx);
      const isPlayer = carIdx === playerCarIndex;

      // Create data object for this car
      return {
        carIdx,
        isPlayer,
        driverName: driver?.user_name || `Car #${carIdx}`,
        carNumber: driver?.car_number || carIdx.toString(),
        teamName: driver?.team_name || '',
        iRating: driver?.i_rating,
        license: driver?.license || '',
        incidents: driver?.incidents,
        carClass: telemetryData.CarIdxClass?.[carIdx] || '',
        position: telemetryData.CarIdxPosition?.[carIdx] || 999,
        classPosition: telemetryData.CarIdxClassPosition?.[carIdx] || 999,
        currentLap: telemetryData.CarIdxLap?.[carIdx] || 0,
        lastLapCompleted: telemetryData.CarIdxLapCompleted?.[carIdx] || 0,
        lastLapTime: telemetryData.CarIdxLastLapTime?.[carIdx] || 0,
        bestLapTime: telemetryData.CarIdxBestLapTime?.[carIdx] || 0,
        gear: telemetryData.CarIdxGear?.[carIdx] || '-',
        rpm: telemetryData.CarIdxRPM?.[carIdx] || 0,
        onPitRoad: telemetryData.CarIdxOnPitRoad?.[carIdx] || false,
        trackPos: telemetryData.CarIdxLapDistPct?.[carIdx] || 0,
        // Add the selected metric value
        metricValue: telemetryData[selectedMetric]?.[carIdx] || 0,
      };
    });
    
    // Filter out invalid entries (position 0 or 999 usually means no car there)
    const validCars = carRows.filter(car => car.position > 0 && car.position < 999);
    
    // Sort the data based on the selected sort method
    let sortedCars = [...validCars];
    switch (sortBy) {
      case 'position':
        sortedCars.sort((a, b) => a.position - b.position);
        break;
      case 'laptime':
        // Sort by best lap time, but put 0 times at the end
        sortedCars.sort((a, b) => {
          if (a.bestLapTime === 0) return 1;
          if (b.bestLapTime === 0) return -1;
          return a.bestLapTime - b.bestLapTime;
        });
        break;
      case 'name':
        sortedCars.sort((a, b) => a.driverName.localeCompare(b.driverName));
        break;
      case 'number':
        sortedCars.sort((a, b) => {
          // Convert both to strings before comparing
          const aNum = String(a.carNumber);
          const bNum = String(b.carNumber);
          return aNum.localeCompare(bNum);
        });
        break;
      case 'class':
        sortedCars.sort((a, b) => {
          // First sort by class
          const classCompare = a.carClass.localeCompare(b.carClass);
          // Then by position within class
          return classCompare !== 0 ? classCompare : a.classPosition - b.classPosition;
        });
        break;
      case 'metric':
        // Sort by the selected metric value
        sortedCars.sort((a, b) => {
          // For boolean values, true comes first
          if (typeof a.metricValue === 'boolean') {
            return a.metricValue === b.metricValue ? 0 : a.metricValue ? -1 : 1;
          }
          // For numeric values, sort numerically
          return b.metricValue - a.metricValue;
        });
        break;
    }
    
    // Limit to maxItems
    return sortedCars.slice(0, maxItems);
  }, [telemetryData, sessionData, selectedMetric, sortBy, maxItems]);

  // Helper function to generate a color for car classes
  const getClassColor = (className: string) => {
    if (!className) return 'bg-gray-700';
    
    // Simple hash function to generate colors from class names
    let hash = 0;
    for (let i = 0; i < className.length; i++) {
      hash = className.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    // Generate HSL color with consistent saturation and lightness
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 70%, 40%)`;
  };

  // Calculate font size based on widget width for responsive text
  const getFontSize = () => {
    // If custom font size is set, use that instead of calculating based on width
    if (fontSize) {
      return fontSize;
    }
    
    // Fallback to width-based calculation if no custom size is set
    if (widgetWidth < 500) return 'text-xs';
    if (widgetWidth < 700) return 'text-sm';
    return 'text-base';
  };

  return (
    <Widget 
      id={id} 
      title={name || 'Race Data'}
      onClose={onClose}
      className="w-full h-full"
      width={widgetWidth}
    >
      <div className={`w-full h-full min-h-[240px] flex flex-col overflow-hidden p-2 ${getFontSize()}`}>
        {telemetryData && formattedCarData.length > 0 ? (
          <div className="w-full h-full overflow-auto scrollbar-thin">
            <table className="w-full text-left table-fixed">
              <thead className="sticky top-0 bg-slate-800 text-gray-300">
                <tr className="text-xs md:text-sm">
                  {actualColumns.includes('position') && (
                    <th className="py-2 px-3 w-[40px] md:w-[50px] font-semibold">Pos</th>
                  )}
                  {showDetails && actualColumns.includes('carNumber') && (
                    <th className="py-2 px-3 w-[50px] md:w-[60px] font-semibold">Car</th>
                  )}
                  {showDetails && actualColumns.includes('teamName') && (
                    <th className="py-2 px-3 w-[15%] min-w-[80px] font-semibold">Team</th>
                  )}
                  {actualColumns.includes('driverName') && (
                    <th className="py-2 px-3 w-[25%] min-w-[100px] font-semibold">Driver</th>
                  )}
                  {highlightClass && actualColumns.includes('carClass') && (
                    <th className="py-2 px-3 w-[80px] md:w-[90px] font-semibold">Class</th>
                  )}
                  {showDetails && actualColumns.includes('currentLap') && (
                    <th className="py-2 px-3 w-[40px] md:w-[50px] font-semibold">Lap</th>
                  )}
                  {showDetails && actualColumns.includes('iRating') && (
                    <th className="py-2 px-3 w-[60px] md:w-[70px] font-semibold">iRating</th>
                  )}
                  {showDetails && actualColumns.includes('license') && (
                    <th className="py-2 px-3 w-[60px] md:w-[70px] font-semibold">License</th>
                  )}
                  {showDetails && actualColumns.includes('incidents') && (
                    <th className="py-2 px-3 w-[40px] md:w-[50px] font-semibold">Inc</th>
                  )}
                  {actualColumns.includes('metricValue') && (
                    <th className="py-2 px-3 w-[15%] min-w-[80px] font-semibold">
                      {getMetricName(selectedMetric)}
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className={`${getFontSize()} text-gray-200`}>
                {formattedCarData.map((car) => (
                  <tr 
                    key={car.carIdx} 
                    className={`${car.isPlayer ? 'bg-blue-900/50' : 'hover:bg-slate-700/60'} border-b border-slate-700/50 text-ellipsis`}
                  >
                    {actualColumns.includes('position') && (
                      <td className="py-2 px-3 font-medium">
                        {car.position}
                      </td>
                    )}
                    
                    {showDetails && actualColumns.includes('carNumber') && (
                      <td className="py-2 px-3">
                        {car.carNumber}
                      </td>
                    )}
                    
                    {showDetails && actualColumns.includes('teamName') && (
                      <td className="py-2 px-3 truncate" title={car.teamName}>
                        {car.teamName || '-'}
                      </td>
                    )}
                    
                    {actualColumns.includes('driverName') && (
                      <td className="py-2 px-3 truncate" title={car.driverName}>
                        {car.driverName}
                      </td>
                    )}
                    
                    {highlightClass && actualColumns.includes('carClass') && (
                      <td className="py-2 px-3">
                        <span
                          className="inline-block px-2 py-1 rounded text-white text-xs font-medium text-center"
                          style={{ backgroundColor: getClassColor(car.carClass) }}
                        >
                          {car.carClass}
                        </span>
                      </td>
                    )}
                    
                    {showDetails && actualColumns.includes('currentLap') && (
                      <td className="py-2 px-3 text-center">
                        {car.currentLap}
                      </td>
                    )}
                    
                    {showDetails && actualColumns.includes('iRating') && (
                      <td className="py-2 px-3 text-right">
                        {car.iRating || '-'}
                      </td>
                    )}
                    
                    {showDetails && actualColumns.includes('license') && (
                      <td className="py-2 px-3 text-center">
                        {car.license || '-'}
                      </td>
                    )}
                    
                    {showDetails && actualColumns.includes('incidents') && (
                      <td className="py-2 px-3 text-center">
                        {car.incidents !== undefined ? car.incidents : '-'}
                      </td>
                    )}
                    
                    {actualColumns.includes('metricValue') && (
                      <td className="py-2 px-3 font-mono">
                        {formatTelemetryValue(selectedMetric, car.metricValue)}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <div className="text-slate-400 text-lg">
              {telemetryData ? 'No car data available' : 'Waiting for telemetry data...'}
            </div>
          </div>
        )}
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
  
  // Initialize width state from widget registry or default
  const [widgetWidth, setWidgetWidth] = useState<number>(initialState.widgetWidth || 600);
  
  // Subscribe to widget state updates
  useEffect(() => {
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        // Only log when selectedColumns change
        if (event.state.selectedColumns !== undefined) {
          console.log(`[SimpleRaceTelemetryWidget] Column selection updated:`, event.state.selectedColumns);
        }
        
        // Update width if it changed
        if (event.state.widgetWidth !== undefined) {
          setWidgetWidth(Number(event.state.widgetWidth));
        }
        
        // Force re-render
        setStateVersion(v => v + 1);
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]);
  
  // Get latest state from WidgetManager
  const currentWidget = WidgetManager.getWidget(id);
  const currentState = currentWidget?.state || initialState;
  
  // Only log column-related information
  console.log(`[SimpleRaceTelemetryWidget] Column selection status:`, {
    propsColumns: props.selectedColumns,
    stateColumns: currentState.selectedColumns,
    willUse: props.selectedColumns || currentState.selectedColumns || DEFAULT_COLUMNS
  });
  
  // Combine props with current widget state
  const combinedProps = {
    ...props,
    selectedMetric: currentState.selectedMetric,
    sortBy: currentState.sortBy,
    showDetails: currentState.showDetails,
    highlightClass: currentState.highlightClass,
    maxItems: currentState.maxItems,
    widgetWidth: widgetWidth,
    fontSize: currentState.fontSize,
    selectedColumns: props.selectedColumns || currentState.selectedColumns || DEFAULT_COLUMNS
  };
  
  return <SimpleRaceTelemetryWidgetInternal {...combinedProps} />;
};

// Create the control definitions for the widget
const getControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Only log column-related state
  if (widgetState.selectedColumns) {
    console.log('[SimpleRaceTelemetryWidget] getControls received selectedColumns:', widgetState.selectedColumns);
  }
  
  // Get the current width (or use default)
  const widgetWidth = widgetState.widgetWidth || 600;
  
  const onChange = (id: string, value: any) => {
    // Only log column-related changes
    if (id === 'selectedColumns') {
      console.log(`[SimpleRaceTelemetryWidget] Columns selection onChange:`, value);
    }
    
    const update = { [id]: value };
    updateWidget(update);
  };
  
  return [
    {
      id: 'widgetWidth',
      type: 'slider' as WidgetControlType,
      label: `Width: ${widgetWidth}px`,
      value: widgetWidth,
      options: [
        { value: 500, label: 'Small' },
        { value: 700, label: 'Medium' },
        { value: 900, label: 'Large' },
        { value: 1100, label: 'X-Large' }
      ],
      onChange: (value) => {
        const newWidth = Number(value);
        
        // Directly update the widget state using WidgetManager
        WidgetManager.updateWidgetState(widgetState.id, { 
          widgetWidth: newWidth 
        });
        
        // Also update through the control mechanism for completeness
        updateWidget({ widgetWidth: newWidth });
      }
    },
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
      label: 'Show Driver Details',
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
    },
    {
      id: 'fontSize',
      type: 'select',
      label: 'Font Size',
      value: widgetState.fontSize || 'text-sm',
      options: [
        { value: 'text-xs', label: 'Small' },
        { value: 'text-sm', label: 'Medium' },
        { value: 'text-base', label: 'Large' },
        { value: 'text-lg', label: 'X-Large' }
      ],
      onChange: (value) => onChange('fontSize', value)
    },
    {
      id: 'selectedColumns',
      type: 'multi-select' as WidgetControlType,
      label: 'Display Columns',
      value: widgetState.selectedColumns || DEFAULT_COLUMNS,
      options: AVAILABLE_COLUMNS,
      onChange: (value) => {
        console.log(`[SimpleRaceTelemetryWidget] Column selection changing from:`, widgetState.selectedColumns);
        console.log(`[SimpleRaceTelemetryWidget] Column selection changing to:`, value);
        
        // Make sure we have a valid array even if undefined is passed
        const columnValues = Array.isArray(value) ? value : DEFAULT_COLUMNS;
        
        // Directly update the widget state using WidgetManager
        WidgetManager.updateWidgetState(widgetState.id, { 
          selectedColumns: columnValues
        });
        
        // Also update through the control mechanism
        updateWidget({ selectedColumns: columnValues });
      }
    }
  ];
};

// Apply the withControls HOC to the component
const SimpleRaceTelemetryWidget = withControls(SimpleRaceTelemetryWidgetComponent, getControls);

export default SimpleRaceTelemetryWidget; 