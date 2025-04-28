import React, { useState, useEffect, useMemo } from 'react';
import Widget from './Widget';
import { useTelemetryData, formatTelemetryValue, getMetricName, TelemetryMetric } from '../hooks/useTelemetryData';

interface SimpleRaceTelemetryWidgetProps {
  id: string;
  name: string;
  metric: TelemetryMetric;
  initialPosition?: { x: number, y: number };
  onClose?: (id: string) => void;
  maxItems?: number; // Maximum number of cars to display
}

export const SimpleRaceTelemetryWidget: React.FC<SimpleRaceTelemetryWidgetProps> = ({ 
  id, 
  name,
  metric = 'CarIdxPosition', // Provide a default value for metric
  initialPosition,
  onClose,
  maxItems = 10 // Default to showing top 10 cars
}) => {
  // Add state for the selected metric
  const [selectedMetric, setSelectedMetric] = useState<TelemetryMetric>(metric);
  
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
  
  // Log props for debugging
  useEffect(() => {
    console.log('SimpleRaceTelemetryWidget props:', { id, name, metric, maxItems });
  }, [id, name, metric, maxItems]);
  
  // Use the hook with ALL CarIdx metrics to ensure we get all possible data
  const { data, sessionData } = useTelemetryData(id, { metrics: carIdxMetrics });
  
  // Debug log whenever telemetry data updates
  useEffect(() => {
    console.log(`[${id}] Telemetry data updated:`, {
      dataExists: !!data,
      metric: selectedMetric,
      metricData: data?.[selectedMetric],
      isArray: data && data[selectedMetric] ? Array.isArray(data[selectedMetric]) : false,
      arrayLength: data && data[selectedMetric] && Array.isArray(data[selectedMetric]) ? data[selectedMetric].length : 0,
      sessionData: !!sessionData,
      drivers: sessionData?.drivers?.other_drivers?.length || 0
    });
    
    // Log the first few elements of the array if it exists
    if (data && data[selectedMetric] && Array.isArray(data[selectedMetric]) && data[selectedMetric].length > 0) {
      console.log(`[${id}] First 5 ${selectedMetric} values:`, data[selectedMetric].slice(0, 5));
    }
    
    // Log what fields are available in data
    if (data) {
      const carIdxKeysInData = Object.keys(data).filter(key => key.startsWith('CarIdx'));
      console.log(`[${id}] Available CarIdx keys in data:`, carIdxKeysInData);
    }
  }, [data, sessionData, id, selectedMetric]);
  
  // Format car data to include driver information
  const formattedCarData = useMemo(() => {
    if (!data || !sessionData?.drivers) {
      console.log(`[${id}] No data or session data available`);
      return [];
    }
    
    // Debug the metric field data
    console.log(`[${id}] Formatting car data:`, {
      metric: selectedMetric,
      metricExists: selectedMetric in data,
      metricValue: data[selectedMetric],
      isArray: Array.isArray(data[selectedMetric]),
      metricLength: Array.isArray(data[selectedMetric]) ? data[selectedMetric].length : 'not an array'
    });
    
    // Check if the metric exists in the data at all
    if (!(selectedMetric in data)) {
      console.log(`[${id}] Metric "${selectedMetric}" does not exist in data object. Available keys:`, Object.keys(data).filter(k => k.startsWith('CarIdx')));
      return [];
    }
    
    // Skip if the metric isn't a CarIdx metric or not an array
    if (!selectedMetric.startsWith('CarIdx') || !Array.isArray(data[selectedMetric])) {
      console.log(`[${id}] Not a CarIdx array metric`, { metric: selectedMetric, dataType: typeof data[selectedMetric] });
      return [];
    }
    
    // If the array exists but is empty, log that fact
    if (Array.isArray(data[selectedMetric]) && data[selectedMetric].length === 0) {
      console.log(`[${id}] CarIdx array exists but is empty`, { metric: selectedMetric });
      return [];
    }
    
    const metricArray = data[selectedMetric] as any[];
    const drivers = sessionData.drivers.other_drivers || [];
    const playerCarIdx = sessionData.drivers.player_car_idx || 0;
    
    console.log(`[${id}] Processing driver data:`, {
      metricArrayLength: metricArray.length,
      driversCount: drivers.length,
      playerCarIdx
    });
    
    // Log non-null values in the metric array to help debugging
    const nonNullCount = metricArray.filter(val => val !== null && val !== undefined).length;
    console.log(`[${id}] Non-null values in ${selectedMetric}:`, {
      nonNullCount,
      totalLength: metricArray.length,
      percentage: Math.round((nonNullCount / metricArray.length) * 100) + '%'
    });
    
    const formattedData = metricArray.map((value, idx) => {
      // Skip undefined/null values
      if (value === undefined || value === null) return null;
      
      // Find the driver data for this car
      const driver = drivers.find(d => d.car_idx === idx) || null;
      
      return {
        index: idx,
        value,
        formattedValue: formatTelemetryValue(selectedMetric, value),
        carNumber: driver?.car_number ? String(driver.car_number) : `#${idx}`,
        name: driver?.user_name || `Driver ${idx}`,
        isPlayerCar: idx === playerCarIdx
      };
    }).filter(Boolean); // Remove null entries
    
    console.log(`[${id}] Final formatted data:`, {
      formattedCount: formattedData.length,
      firstFew: formattedData.slice(0, 3)
    });
    
    // Sort by position if it's position-related data
    if (selectedMetric === 'CarIdxPosition') {
      formattedData.sort((a, b) => a.value - b.value);
    }
    
    // Limit items if needed
    if (maxItems > 0 && formattedData.length > maxItems) {
      return formattedData.slice(0, maxItems);
    }
    
    return formattedData;
  }, [data, sessionData, selectedMetric, maxItems, id]);
  
  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };
  
  // Handle metric change
  const handleMetricChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedMetric(e.target.value as TelemetryMetric);
  };

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
      console.log(`[${id}] No data to display:`, {
        dataExists: !!data,
        formattedCarDataLength: formattedCarData.length
      });
      
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">{getMetricName(selectedMetric)}</div>
          <div className="text-sm text-gray-400">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full w-full p-2">
        {/* Dropdown for metric selection */}
        <div className="mb-2">
          <select 
            value={selectedMetric}
            onChange={handleMetricChange}
            className="w-full p-1 text-xs bg-slate-700 border border-slate-600 rounded text-slate-200"
          >
            {carIdxMetrics.map(m => (
              <option key={m} value={m}>
                {getMetricName(m)}
              </option>
            ))}
          </select>
        </div>
        
        <div className="text-sm font-medium text-slate-300 mb-2 text-center">
          {getMetricName(selectedMetric)}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-1">
            {formattedCarData.map((car) => (
              <div 
                key={car.index}
                className={`grid grid-cols-12 py-1 px-2 border-b border-slate-700 text-xs items-center
                ${car.isPlayerCar ? 'bg-blue-900/30 rounded' : ''}`}
              >
                <div className="col-span-2 font-semibold text-slate-400">
                  {car.carNumber}
                </div>
                <div className="col-span-6 truncate text-slate-300">
                  {car.name}
                </div>
                <div className="col-span-4 text-right font-mono text-slate-100">
                  {car.formattedValue}
                </div>
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
      title={name}
      initialPosition={initialPosition}
      onClose={() => handleClose()}
      className="w-full h-full"
    >
      <div className="w-full h-full min-h-[240px] min-w-[220px] flex items-center justify-center">
        {renderContent()}
      </div>
    </Widget>
  );
};

export default SimpleRaceTelemetryWidget; 