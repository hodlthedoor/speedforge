import React, { useLayoutEffect, useEffect, useState, useMemo, useRef } from 'react';
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
  fontSize?: 'text-sm' | 'text-base' | 'text-lg' | 'text-xl';
  selectedColumns?: string[]; // New property for column selection
}

// Update AVAILABLE_COLUMNS array with object format
const AVAILABLE_COLUMNS = [
  { value: 'position', label: 'Position' },
  { value: 'number', label: 'Car Number' },
  { value: 'driverName', label: 'Driver Name' },
  { value: 'carClass', label: 'Car Class' },
  { value: 'classPosition', label: 'Class Position' },
  { value: 'interval', label: 'Track Position %' },
  { value: 'gap', label: 'Gap to Ahead' },
  { value: 'gapToLeader', label: 'Gap to Leader' },
  { value: 'lap', label: 'Current Lap' },
  { value: 'lastLapCompleted', label: 'Last Completed Lap' },
  { value: 'bestLapTime', label: 'Best Lap Time' },
  { value: 'lastLapTime', label: 'Last Lap Time' },
  { value: 'gear', label: 'Gear' },
  { value: 'rpm', label: 'RPM' },
  { value: 'steer', label: 'Steering Input' },
  { value: 'isOnPitRoad', label: 'On Pit Road' },
  { value: 'fastRepairsUsed', label: 'Fast Repairs Used' },
  { value: 'p2pCount', label: 'Push-to-Pass Count' },
  { value: 'p2pStatus', label: 'Push-to-Pass Status' },
  { value: 'paceFlags', label: 'Pace Flags' },
  { value: 'paceLine', label: 'Pace Line' },
  { value: 'paceRow', label: 'Pace Row' },
  { value: 'qualTireCompound', label: 'Qualifying Tire' },
  { value: 'qualTireCompoundLocked', label: 'Qual Tire Locked' },
  { value: 'tireCompound', label: 'Tire Compound' },
  { value: 'trackSurface', label: 'Track Surface' },
  { value: 'trackSurfaceMaterial', label: 'Surface Material' },
  { value: 'currentMetric', label: 'Selected Metric' }
];

// Update DEFAULT_COLUMNS array with object format values
const DEFAULT_COLUMNS = [
  'position',
  'number',
  'driverName',
  'carClass',
  'classPosition',
  'interval',
  'gap',
  'lap',
  'bestLapTime',
  'currentMetric',
];

// Add formatLapTime helper function
const formatLapTime = (time: number | undefined): string => {
  if (time === undefined || time <= 0) return '--:--';
  
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  const milliseconds = Math.floor((time * 1000) % 1000);
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
};

/* ────────────────────────────────────────────
   helpers ─ keep once-per-sector timestamp and
   recover the last known one if a sector is missing
   ──────────────────────────────────────────── */
const rememberFirst = (
  store: Record<number, Record<number, number>>,
  idx: number,
  sector: number,
  t: number,
) => {
  if (!store[idx]) store[idx] = {};
  if (store[idx][sector] === undefined) store[idx][sector] = t;
};

const stampForSector = (
  store: Record<number, Record<number, number>>,
  idx: number,
  sector: number,
): number | undefined => {
  for (let s = sector; s >= 0; s--) {
    const ts = store[idx]?.[s];
    if (ts !== undefined) return ts;
  }
};

// helper for safe gap calculation
const safeGap = (
  prev: Record<number, number>,
  idx: number,
  value: number | undefined,
) => (value && value > 0 ? value : prev[idx]);

// Internal component that uses state from widget manager
const SimpleRaceTelemetryWidgetInternal: React.FC<SimpleRaceTelemetryWidgetProps> = (props) => {
  const {
    id,
    onClose,
    selectedMetric = 'CarIdxPosition',
    sortBy = 'position',
    maxItems = 10,
    name = 'Race Data',
    widgetWidth = 600,
    fontSize = 'text-sm',
    selectedColumns = DEFAULT_COLUMNS,
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
      'CarIdxF2Time',
      'CarIdxEstTime',
      'CarIdxFastRepairsUsed',
      'CarIdxP2P_Count',
      'CarIdxP2P_Status',
      'CarIdxSteer',
      'SessionTime',
      selectedMetric,
    ],
  });

  // Process the telemetry data to create the table rows
  const formattedCarData = useMemo(() => {
    if (!telemetryData || !sessionData) return [];

    // Extract driver information from session data
    const allDrivers = sessionData.drivers?.other_drivers || [];
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

      // Get the position from telemetry data
      const position = telemetryData.CarIdxPosition?.[carIdx] || 999;
      const trackPosition = telemetryData.CarIdxLapDistPct?.[carIdx] || 0;
      const currentLap = telemetryData.CarIdxLap?.[carIdx] || 0;

      // Get the gaps from telemetry data
      const gapVal = telemetryData.CarIdxF2Time?.[carIdx] || 0;
      const gapToLeader = telemetryData.CarIdxGapToLeader?.[carIdx] || 0;

      // Create data object for this car with only available CarIdx metrics
      const carData = {
        carIdx,
        isPlayer,
        driverName: driver?.user_name || `Car #${carIdx}`,
        carNumber: driver?.car_number || carIdx.toString(),
        teamName: driver?.team_name || '',
        iRating: driver?.i_rating,
        license: driver?.license || '',
        incidents: driver?.incidents,
        carClass: telemetryData.CarIdxClass?.[carIdx] || '',
        position,
        classPosition: telemetryData.CarIdxClassPosition?.[carIdx] ?? 0,
        currentLap,
        lastLapCompleted: telemetryData.CarIdxLapCompleted?.[carIdx] || 0,
        lastLapTime: telemetryData.CarIdxLastLapTime?.[carIdx] || 0,
        bestLapTime: telemetryData.CarIdxBestLapTime?.[carIdx] || 0,
        gapToAhead: gapVal,
        gapToLeader: gapToLeader,
        trackPosition,
        gear: telemetryData.CarIdxGear?.[carIdx] || '-',
        rpm: telemetryData.CarIdxRPM?.[carIdx] || 0,
        steer: telemetryData.CarIdxSteer?.[carIdx] || 0,
        onPitRoad: telemetryData.CarIdxOnPitRoad?.[carIdx] || false,
        trackPos: telemetryData.CarIdxLapDistPct?.[carIdx] || 0,
        gapTime: telemetryData.CarIdxF2Time?.[carIdx] || 0,
        estimatedTime: telemetryData.CarIdxEstTime?.[carIdx] || 0,
        fastRepairsUsed: telemetryData.CarIdxFastRepairsUsed?.[carIdx] || 0,
        p2pCount: telemetryData.CarIdxP2P_Count?.[carIdx] || 0,
        p2pStatus: telemetryData.CarIdxP2P_Status?.[carIdx] || 0,
        paceFlags: telemetryData.CarIdxPaceFlags?.[carIdx] || 0,
        paceLine: telemetryData.CarIdxPaceLine?.[carIdx] || 0,
        paceRow: telemetryData.CarIdxPaceRow?.[carIdx] || 0,
        qualTireCompound: telemetryData.CarIdxQualTireCompound?.[carIdx] || '',
        qualTireCompoundLocked: telemetryData.CarIdxQualTireCompoundLocked?.[carIdx] || false,
        tireCompound: telemetryData.CarIdxTireCompound?.[carIdx] || '',
        trackSurface: telemetryData.CarIdxTrackSurface?.[carIdx] || '',
        trackSurfaceMaterial: telemetryData.CarIdxTrackSurfaceMaterial?.[carIdx] || '',
        currentMetricValue: telemetryData[selectedMetric]?.[carIdx],
      };

      return carData;
    });
    
    // Filter out invalid entries (position 0 or 999 usually means no car there)
    const validCars = carRows.filter(car => car.position > 0 && car.position < 999 && car.classPosition > 0);
    
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
          const aNum = String(a.carNumber);
          const bNum = String(b.carNumber);
          return aNum.localeCompare(bNum);
        });
        break;
      case 'class':
        sortedCars.sort((a, b) => {
          const classCompare = a.carClass.localeCompare(b.carClass);
          return classCompare !== 0 ? classCompare : a.classPosition - b.classPosition;
        });
        break;
      case 'metric':
        sortedCars.sort((a, b) => {
          const aValue = a.currentMetricValue;
          const bValue = b.currentMetricValue;
          
          if (aValue === undefined && bValue === undefined) return 0;
          if (aValue === undefined) return 1;
          if (bValue === undefined) return -1;
          
          if (selectedMetric.toString() === 'bestLapTime' || selectedMetric.toString() === 'lastLapTime') {
            if (aValue <= 0) return 1;
            if (bValue <= 0) return -1;
            return aValue - bValue;
          }
          
          return bValue - aValue;
        });
        break;
    }
    
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

  // Update the renderColumnContent function
  const renderColumnContent = (column: string, car: any) => {
    switch (column) {
      case 'position':
        return car.position;
      case 'number':
        return car.carNumber;
      case 'driverName':
        return car.driverName;
      case 'carClass':
        return car.carClass;
      case 'classPosition':
        return car.classPosition || '-';
      case 'interval':
        return car.trackPos ? (car.trackPos * 100).toFixed(1) + '%' : '0%';
      case 'gap':
        const gapVal = telemetryData.CarIdxF2Time?.[car.carIdx];
        if (gapVal === undefined || gapVal === 0) return '--';
        return `${gapVal.toFixed(1)}s`;
      case 'gapToLeader':
        const leaderGap = telemetryData.CarIdxGapToLeader?.[car.carIdx];
        if (leaderGap === undefined || leaderGap === 0) return '--';
        return `${leaderGap.toFixed(1)}s`;
      case 'lap':
        return car.currentLap;
      case 'lastLapTime':
        return car.lastLapTime > 0 ? formatLapTime(car.lastLapTime) : '--:--';
      case 'bestLapTime':
        return car.bestLapTime > 0 ? formatLapTime(car.bestLapTime) : '--:--';
      case 'lapDelta':
        return car.lapDelta || '-';
      case 'raceStartPosition':
        return car.raceStartPosition || '-';
      case 'pitstops':
        return car.pitstops || '0';
      case 'behind':
        return car.behind || '-';
      case 'gear':
        return car.gear || 'N';
      case 'rpm':
        return car.rpm ? Math.round(car.rpm) : '0';
      case 'speed':
        return car.speed ? Math.round(car.speed) : '0';
      case 'steer':
        return car.steer || '0';
      case 'throttle':
        return car.throttle ? Math.round(car.throttle * 100) + '%' : '0%';
      case 'brake':
        return car.brake ? Math.round(car.brake * 100) + '%' : '0%';
      case 'clutch':
        return car.clutch ? Math.round(car.clutch * 100) + '%' : '0%';
      case 'fuelLevel':
        return car.fuelLevel || '0';
      case 'fuelUsePerHour':
        return car.fuelUsePerHour || '0';
      case 'estimatedLaps':
        return car.estimatedLaps || '0';
      case 'tireCompound':
        return car.tireCompound || '-';
      case 'trackSurface':
        return car.trackSurface || '-';
      case 'isPitting':
        return car.isPitting ? 'Yes' : 'No';
      case 'isOnPitRoad':
        return car.onPitRoad ? 'Yes' : 'No';
      case 'fastRepairsUsed':
        return car.fastRepairsUsed || '0';
      case 'p2pCount':
        return car.p2pCount || '0';
      case 'p2pStatus':
        return car.p2pStatus === 1 ? 'Active' : 'Inactive';
      case 'paceFlags':
        return car.paceFlags || '-';
      case 'paceLine':
        return car.paceLine || '-';
      case 'paceRow':
        return car.paceRow || '-';
      case 'currentMetric':
        // Format the current metric value appropriately
        if (selectedMetric.includes('Time') && typeof car.currentMetricValue === 'number') {
          return car.currentMetricValue > 0 ? formatLapTime(car.currentMetricValue) : '--:--';
        } else if (typeof car.currentMetricValue === 'boolean') {
          return car.currentMetricValue ? 'Yes' : 'No';
        } else if (typeof car.currentMetricValue === 'number') {
          // For percentage values
          if (selectedMetric.includes('Pct') || selectedMetric.includes('Percent')) {
            return (car.currentMetricValue * 100).toFixed(1) + '%';
          }
          // For integer-like values
          if (Number.isInteger(car.currentMetricValue)) {
            return car.currentMetricValue.toString();
          }
          // For floating point values
          return car.currentMetricValue.toFixed(2);
        }
        return car.currentMetricValue?.toString() || '-';
      default:
        return '—';
    }
  };

  // Get the display name for the current metric
  const getCurrentMetricDisplayName = () => {
    // Define a mapping of telemetry metrics to display names
    const metricDisplayNames: Record<string, string> = {
      'CarIdxPosition': 'Position',
      'CarIdxLapDistPct': 'Track Position %',
      'CarIdxLap': 'Current Lap',
      'CarIdxLapCompleted': 'Completed Lap',
      'CarIdxLastLapTime': 'Last Lap Time',
      'CarIdxBestLapTime': 'Best Lap Time',
      'CarIdxBestLapNum': 'Best Lap Number',
      'CarIdxClass': 'Car Class',
      'CarIdxClassPosition': 'Class Position',
      'CarIdxGear': 'Gear',
      'CarIdxRPM': 'RPM',
      'CarIdxOnPitRoad': 'On Pit Road',
      'CarIdxF2Time': 'Gap Time',
      'CarIdxEstTime': 'Estimated Time',
      'CarIdxFastRepairsUsed': 'Fast Repairs Used',
      'CarIdxP2P_Count': 'Push-to-Pass Count',
      'CarIdxP2P_Status': 'Push-to-Pass Status',
      'CarIdxPaceFlags': 'Pace Flags',
      'CarIdxPaceLine': 'Pace Line',
      'CarIdxPaceRow': 'Pace Row',
      'CarIdxQualTireCompound': 'Qualifying Tire Compound',
      'CarIdxQualTireCompoundLocked': 'Qual Tire Compound Locked',
      'CarIdxSteer': 'Steering Input',
      'CarIdxTireCompound': 'Tire Compound',
      'CarIdxTrackSurface': 'Track Surface',
      'CarIdxTrackSurfaceMaterial': 'Track Surface Material'
    };
    
    // Return the display name or the metric itself if not found
    return metricDisplayNames[selectedMetric] || selectedMetric;
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
                  {selectedColumns.map((column) => (
                    <th key={column} className="py-2 px-3 text-left">
                      {AVAILABLE_COLUMNS.find((c) => c.value === column)?.label || column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className={`${getFontSize()} text-gray-200`}>
                {formattedCarData.map((car) => (
                  <tr 
                    key={car.carIdx} 
                    className={`${car.isPlayer ? 'bg-blue-900/50' : 'hover:bg-slate-700/60'} border-b border-slate-700/50 text-ellipsis`}
                  >
                    {selectedColumns.map((column) => (
                      <td key={column} className={`py-2 px-3 truncate ${column === 'metric' ? 'font-mono' : ''}`}>
                        {renderColumnContent(column, car)}
                      </td>
                    ))}
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
  
  // Initialize width state and ref
  const [widgetWidth, setWidgetWidth] = useState<number>(600);
  const widgetWidthRef = useRef<number>(600);
  
  // Keep ref in sync with state
  useEffect(() => {
    widgetWidthRef.current = widgetWidth;
  }, [widgetWidth]);
  
  // Initialize width from saved state on mount
  useEffect(() => {
    // On mount, check if we have a saved width
    const widget = WidgetManager.getWidget(id);
    if (widget?.state?.widgetWidth) {
      const savedWidth = Number(widget.state.widgetWidth);
      // console.log(`[SimpleRaceTelemetryWidget] Loading saved width: ${savedWidth}px`);
      setWidgetWidth(savedWidth);
      widgetWidthRef.current = savedWidth;
    } else {
      // Set initial width in WidgetManager if not already set
      WidgetManager.updateWidgetState(id, { widgetWidth: 600 });
    }
    
    // Subscribe to widget state updates
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        // Only log when selectedColumns change
        // if (event.state.selectedColumns !== undefined) {
        //   console.log(`[SimpleRaceTelemetryWidget] Column selection updated:`, event.state.selectedColumns);
        // }
        
        // Update width if it changed
        if (event.state.widgetWidth !== undefined) {
          const newWidth = Number(event.state.widgetWidth);
          // console.log(`[SimpleRaceTelemetryWidget] Width updated to: ${newWidth}px`);
          setWidgetWidth(newWidth);
          widgetWidthRef.current = newWidth;
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
  //console.log(`[SimpleRaceTelemetryWidget] Column selection status:`, {
  //  propsColumns: props.selectedColumns,
  //  stateColumns: currentState.selectedColumns,
  //  willUse: props.selectedColumns || currentState.selectedColumns || DEFAULT_COLUMNS
  //});
  
  // Combine props with current widget state
  const combinedProps = {
    ...props,
    selectedMetric: currentState.selectedMetric,
    sortBy: currentState.sortBy,
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
    // if (widgetState.selectedColumns) {
    //   console.log('[SimpleRaceTelemetryWidget] getControls received selectedColumns:', widgetState.selectedColumns);
    // }
  
  // Get the current width (or use default)
  const widgetWidth = widgetState.widgetWidth || 600;
  
  const onChange = (id: string, value: any) => {
    // Only log column-related changes
    // if (id === 'selectedColumns') {
    //   console.log(`[SimpleRaceTelemetryWidget] Columns selection onChange:`, value);
    // }
    
    const update = { [id]: value };
    updateWidget(update);
  };

  // Get current columns and check if the metric column is included
  const currentColumns = widgetState.selectedColumns || DEFAULT_COLUMNS;
  const showsMetricColumn = currentColumns.includes('currentMetric');
  
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
      id: 'displayMetricColumn',
      type: 'toggle',
      label: 'Show metric as column',
      value: showsMetricColumn,
      onChange: (value) => {
        // Get the current columns
        const currentColumns = widgetState.selectedColumns || DEFAULT_COLUMNS;
        
        // If turning on, add the metric column if not already present
        // If turning off, remove the metric column if present
        let newColumns;
        if (value && !currentColumns.includes('currentMetric')) {
          newColumns = [...currentColumns, 'currentMetric'];
        } else if (!value && currentColumns.includes('currentMetric')) {
          newColumns = currentColumns.filter(c => c !== 'currentMetric');
        } else {
          // No change needed
          return;
        }
        
        // console.log(`[SimpleRaceTelemetryWidget] Toggling metric column. New columns:`, newColumns);
        
        // Update widget state
        WidgetManager.updateWidgetState(widgetState.id, { 
          selectedColumns: newColumns 
        });
        
        // Also update through control mechanism
        updateWidget({ selectedColumns: newColumns });
      }
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
        { value: 'text-sm', label: 'Small' },
        { value: 'text-base', label: 'Medium' },
        { value: 'text-lg', label: 'Large' },
        { value: 'text-xl', label: 'X-Large' }
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
        // console.log(`[SimpleRaceTelemetryWidget] Column selection changing from:`, widgetState.selectedColumns);
        // console.log(`[SimpleRaceTelemetryWidget] Column selection changing to:`, value);
        
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