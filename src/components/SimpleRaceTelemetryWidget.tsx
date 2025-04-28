import React, { useEffect, useState, useMemo } from 'react';
import Widget from './Widget';
import { useTelemetryData, formatTelemetryValue, getMetricName, TelemetryMetric } from '../hooks/useTelemetryData';
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

  // Process the telemetry data to create the table rows
  const formattedCarData = useMemo(() => {
    if (!telemetryData || !sessionData) return [];

    // Debug: Log session data to inspect available driver information
    console.log('SESSION DATA:', sessionData);
    console.log('DRIVERS INFO:', sessionData.drivers);
    console.log('PLAYER INFO:', sessionData.drivers?.player);
    console.log('OTHER DRIVERS:', sessionData.drivers?.other_drivers);

    // Extract driver information from session data
    const driverInfo = sessionData.drivers?.other_drivers || [];
    const playerInfo = sessionData.drivers?.player || null;

    // Get array of car indices (0 to max car index)
    const carIndices = telemetryData[selectedMetric] 
      ? Array.from({ length: telemetryData[selectedMetric].length }, (_, i) => i)
      : [];

    // Create a row for each car with all the relevant data
    const carRows = carIndices.map(carIdx => {
      // Find driver info for this car
      const driver = driverInfo.find(d => d.car_idx === carIdx) || playerInfo;
      const isPlayer = playerInfo && playerInfo.car_idx === carIdx;

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
        sortedCars.sort((a, b) => a.carNumber.localeCompare(b.carNumber));
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

  return (
    <Widget 
      id={id} 
      title={name || 'Race Data'}
      onClose={onClose}
      className="w-full h-full"
    >
      <div className="w-full h-full min-h-[240px] min-w-[240px] flex flex-col overflow-hidden p-2">
        {telemetryData && formattedCarData.length > 0 ? (
          <div className="w-full h-full overflow-auto scrollbar-thin">
            <table className="w-full text-left text-sm table-fixed">
              <thead className="sticky top-0 bg-slate-800 text-gray-300 text-xs">
                <tr>
                  <th className="py-1 px-2 w-[40px]">Pos</th>
                  {showDetails && (
                    <>
                      <th className="py-1 px-2 w-[50px]">Car</th>
                      <th className="py-1 px-2 w-[15%] min-w-[80px]">Team</th>
                    </>
                  )}
                  <th className="py-1 px-2 w-[25%] min-w-[100px]">Driver</th>
                  {highlightClass && <th className="py-1 px-2 w-[80px]">Class</th>}
                  {showDetails && (
                    <>
                      <th className="py-1 px-2 w-[40px]">Lap</th>
                      <th className="py-1 px-2 w-[60px]">iRating</th>
                      <th className="py-1 px-2 w-[60px]">License</th>
                      <th className="py-1 px-2 w-[40px]">Inc</th>
                    </>
                  )}
                  <th className="py-1 px-2 w-[15%] min-w-[80px]">
                    {getMetricName(selectedMetric)}
                  </th>
                </tr>
              </thead>
              <tbody className="text-xs md:text-sm">
                {formattedCarData.map((car) => (
                  <tr 
                    key={car.carIdx} 
                    className={`${car.isPlayer ? 'bg-blue-900/30' : 'hover:bg-slate-700/50'} border-b border-slate-700/50 text-ellipsis`}
                  >
                    <td className="py-1 px-2 font-medium">
                      {car.position}
                    </td>
                    
                    {showDetails && (
                      <>
                        <td className="py-1 px-2">
                          {car.carNumber}
                        </td>
                        <td className="py-1 px-2 truncate" title={car.teamName}>
                          {car.teamName || '-'}
                        </td>
                      </>
                    )}
                    
                    <td className="py-1 px-2 truncate" title={car.driverName}>
                      {car.driverName}
                    </td>
                    
                    {highlightClass && (
                      <td className="py-1 px-2">
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-white text-xs font-medium text-center"
                          style={{ backgroundColor: getClassColor(car.carClass) }}
                        >
                          {car.carClass}
                        </span>
                      </td>
                    )}
                    
                    {showDetails && (
                      <>
                        <td className="py-1 px-2 text-center">
                          {car.currentLap}
                        </td>
                        <td className="py-1 px-2 text-right">
                          {car.iRating || '-'}
                        </td>
                        <td className="py-1 px-2 text-center">
                          {car.license || '-'}
                        </td>
                        <td className="py-1 px-2 text-center">
                          {car.incidents !== undefined ? car.incidents : '-'}
                        </td>
                      </>
                    )}
                    
                    <td className="py-1 px-2 font-mono">
                      {formatTelemetryValue(selectedMetric, car.metricValue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4">
            <div className="text-slate-400">
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
    }
  ];
};

// Apply the withControls HOC to the component
const SimpleRaceTelemetryWidget = withControls(SimpleRaceTelemetryWidgetComponent, getControls);

export default SimpleRaceTelemetryWidget; 