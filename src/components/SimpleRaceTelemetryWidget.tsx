import React, { useEffect, useMemo, useState } from 'react';
import Widget from './Widget';
import { useTelemetryData, formatTelemetryValue, getMetricName, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';

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

const SimpleRaceTelemetryWidgetComponent: React.FC<SimpleRaceTelemetryWidgetProps> = ({
  id,
  onClose,
  selectedMetric = 'CarIdxPosition',
  sortBy = 'position',
  showDetails = false,
  highlightClass = true,
  maxItems = 10,
  name = 'Race Data'
}) => {
  // List of all available CarIdx metrics
  const carIdxMetrics = useMemo(() => [
    'CarIdxPosition',
    'CarIdxLapDistPct',
    'CarIdxLap',
    'CarIdxLapCompleted',
    'CarIdxF2Time',
    'CarIdxClassPosition',
    'CarIdxClass',
    'CarIdxGear',
    'CarIdxRPM',
    'CarIdxOnPitRoad',
    'CarIdxP2P_Count',
    'CarIdxP2P_Status',
    'CarIdxBestLapNum',
    'CarIdxBestLapTime',
    'CarIdxEstTime',
    'CarIdxFastRepairsUsed',
    'CarIdxPaceFlags',
    'CarIdxPaceLine',
    'CarIdxPaceRow',
    'CarIdxQualTireCompound',
    'CarIdxQualTireCompoundLocked',
    'CarIdxSteer',
    'CarIdxTireCompound',
    'CarIdxTrackSurface',
    'CarIdxTrackSurfaceMaterial'
  ] as TelemetryMetric[], []);
  
  // Use the hook with ALL CarIdx metrics to ensure we get all possible data
  const { data, sessionData } = useTelemetryData(id, { metrics: carIdxMetrics });
  
  // Format car data to include driver information
  const formattedCarData = useMemo(() => {
    if (!data || !sessionData?.drivers) {
      return [];
    }
    
    // Check if the metric exists in the data at all
    if (!(selectedMetric in data)) {
      return [];
    }
    
    // Skip if the metric isn't a CarIdx metric or not an array
    if (!selectedMetric.startsWith('CarIdx') || !Array.isArray(data[selectedMetric])) {
      return [];
    }
    
    // If the array exists but is empty, return empty array
    if (Array.isArray(data[selectedMetric]) && data[selectedMetric].length === 0) {
      return [];
    }
    
    const metricArray = data[selectedMetric] as any[];
    const drivers = sessionData.drivers.other_drivers || [];
    const playerCarIdx = sessionData.drivers.player_car_idx || 0;
    
    // Get the player's class for highlighting
    const playerDriver = drivers.find(d => d.car_idx === playerCarIdx);
    const playerClass = playerDriver?.car_class_id;
    
    // Get position data for sorting if available
    const positionArray = data['CarIdxPosition'] as number[] || [];
    const lapDistPctArray = data['CarIdxLapDistPct'] as number[] || [];
    const lapArray = data['CarIdxLap'] as number[] || [];
    const lapTimeArray = data['CarIdxLastLapTime'] as number[] || [];
    const bestLapTimeArray = data['CarIdxBestLapTime'] as number[] || [];
    const classArray = data['CarIdxClass'] as number[] || [];
    
    const formattedData = metricArray.map((value, idx) => {
      // Skip undefined/null values
      if (value === undefined || value === null) return null;
      
      // Find the driver data for this car
      const driver = drivers.find(d => d.car_idx === idx) || null;
      
      // Check if driver is in same class as player
      const isPlayerClass = driver?.car_class_id === playerClass;
      
      // Additional data for sorting
      const position = positionArray[idx] || 999;
      const lapDistPct = lapDistPctArray[idx] || 0;
      const lap = lapArray[idx] || 0;
      const lastLapTime = lapTimeArray[idx] || 0;
      const bestLapTime = bestLapTimeArray[idx] || 0;
      const carClass = classArray[idx] || 0;
      
      return {
        index: idx,
        value,
        formattedValue: formatTelemetryValue(selectedMetric, value),
        carNumber: driver?.car_number ? String(driver.car_number) : `#${idx}`,
        name: driver?.user_name || `Driver ${idx}`,
        team: driver?.team_name || '',
        iRating: driver?.i_rating || 0,
        license: driver?.license || '',
        carClass,
        isPlayerCar: idx === playerCarIdx,
        isPlayerClass,
        // For sorting
        position,
        lap,
        lapDistPct,
        lastLapTime,
        bestLapTime,
        // Combined track position (lap + distance)
        trackPosition: lap + lapDistPct
      };
    }).filter(Boolean); // Remove null entries
    
    // Sort the data based on selected sort option
    let sortedData = [...formattedData];
    
    switch(sortBy) {
      case 'position':
        // Sort by position (lower is better)
        sortedData.sort((a, b) => a.position - b.position);
        break;
      case 'laptime':
        // Sort by best lap time (lower is better, but ignore zeros)
        sortedData.sort((a, b) => {
          if (a.bestLapTime === 0) return 1;
          if (b.bestLapTime === 0) return -1;
          return a.bestLapTime - b.bestLapTime;
        });
        break;
      case 'name':
        // Sort by driver name
        sortedData.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'number':
        // Sort by car number
        sortedData.sort((a, b) => parseInt(a.carNumber) - parseInt(b.carNumber));
        break;
      case 'class':
        // Sort by class, then position within class
        sortedData.sort((a, b) => {
          if (a.carClass !== b.carClass) {
            return a.carClass - b.carClass;
          }
          return a.position - b.position;
        });
        break;
      case 'metric':
        // Sort by the current metric value
        sortedData.sort((a, b) => {
          // Handle special cases
          if (selectedMetric === 'CarIdxPosition') {
            return a.value - b.value; // Lower position is better
          }
          if (selectedMetric === 'CarIdxLapDistPct') {
            return b.trackPosition - a.trackPosition; // Higher lap+position is better
          }
          return b.value - a.value; // Most other metrics, higher is better
        });
        break;
    }
    
    // Limit items if needed
    if (maxItems > 0 && sortedData.length > maxItems) {
      return sortedData.slice(0, maxItems);
    }
    
    return sortedData;
  }, [data, sessionData, selectedMetric, maxItems, sortBy]);

  // Render the widget content
  const renderContent = () => {
    // Handle the case where metric is undefined
    if (!selectedMetric) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">Error</div>
          <div className="text-sm text-red-400">No metric specified</div>
        </div>
      );
    }
    
    // If not a CarIdx metric, show an error
    if (!selectedMetric.startsWith('CarIdx')) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">Error</div>
          <div className="text-sm text-red-400">Not a car index metric</div>
        </div>
      );
    }
    
    // If no data yet
    if (!data || formattedCarData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">{getMetricName(selectedMetric)}</div>
          <div className="text-sm text-gray-400">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full w-full p-2">
        <div className="text-sm font-medium text-slate-300 mb-2 text-center">
          {getMetricName(selectedMetric)} - {formattedCarData.length} Cars
        </div>
        
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-1">
            {formattedCarData.map((car) => (
              <div 
                key={car.index}
                className={`grid ${showDetails ? 'grid-cols-1' : 'grid-cols-12'} py-1 px-2 border-b border-slate-700 text-xs items-center
                ${car.isPlayerCar ? 'bg-blue-900/50 rounded' : ''}
                ${highlightClass && car.isPlayerClass && !car.isPlayerCar ? 'bg-green-900/20 rounded' : ''}`}
              >
                {showDetails ? (
                  // Detailed view
                  <div className="w-full">
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center">
                        <span className={`px-1 ${car.isPlayerCar ? 'bg-blue-700' : 'bg-slate-700'} rounded mr-1`}>
                          P{car.position}
                        </span>
                        <span className="font-semibold text-slate-300">
                          {car.carNumber} - {car.name}
                        </span>
                      </div>
                      <span className="font-mono text-slate-100">
                        {car.formattedValue}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 text-2xs ml-5">
                      {car.iRating > 0 && (
                        <div className="text-slate-400">iRating: <span className="text-slate-300">{car.iRating}</span></div>
                      )}
                      {car.license && (
                        <div className="text-slate-400">License: <span className="text-slate-300">{car.license}</span></div>
                      )}
                      {car.team && (
                        <div className="text-slate-400 col-span-2 truncate">Team: <span className="text-slate-300">{car.team}</span></div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Compact view
                  <>
                    <div className="col-span-2 font-semibold text-slate-400 flex items-center">
                      {car.isPlayerCar && (
                        <span className="inline-block w-2 h-2 bg-blue-500 rounded-full mr-1"></span>
                      )}
                      {car.carNumber}
                    </div>
                    <div className="col-span-6 truncate text-slate-300">
                      {car.name}
                    </div>
                    <div className="col-span-4 text-right font-mono text-slate-100">
                      {car.formattedValue}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <Widget 
      id={id} 
      title={name || `Race Data: ${getMetricName(selectedMetric)}`}
      onClose={onClose}
      className="w-full h-full"
    >
      <div className="w-full h-full min-h-[240px] min-w-[240px] flex items-center justify-center">
        {renderContent()}
      </div>
    </Widget>
  );
};

// Create the control definitions for the widget
const getControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
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
        { value: 'CarIdxBestLapTime', label: 'Best Lap Time' },
        { value: 'CarIdxLastLapTime', label: 'Last Lap Time' },
        { value: 'CarIdxClass', label: 'Car Class' },
        { value: 'CarIdxClassPosition', label: 'Class Position' },
        { value: 'CarIdxGear', label: 'Gear' },
        { value: 'CarIdxRPM', label: 'RPM' },
        { value: 'CarIdxOnPitRoad', label: 'On Pit Road' },
        { value: 'CarIdxF2Time', label: 'Gap Time' },
        { value: 'CarIdxFastRepairsUsed', label: 'Fast Repairs Used' },
      ],
      onChange: (value: string) => {
        updateWidget({ selectedMetric: value });
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
      onChange: (value: string) => {
        updateWidget({ sortBy: value });
      }
    },
    {
      id: 'showDetails',
      type: 'toggle',
      label: 'Show Details',
      value: widgetState.showDetails !== undefined ? widgetState.showDetails : false,
      onChange: (value: boolean) => {
        updateWidget({ showDetails: value });
      }
    },
    {
      id: 'highlightClass',
      type: 'toggle',
      label: 'Highlight Class',
      value: widgetState.highlightClass !== undefined ? widgetState.highlightClass : true,
      onChange: (value: boolean) => {
        updateWidget({ highlightClass: value });
      }
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
      onChange: (value: number) => {
        updateWidget({ maxItems: value });
      }
    }
  ];
};

// Apply the withControls HOC to the component
const SimpleRaceTelemetryWidget = withControls(SimpleRaceTelemetryWidgetComponent, getControls);

export default SimpleRaceTelemetryWidget; 