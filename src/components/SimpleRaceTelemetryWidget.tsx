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
  // Log props for debugging
  useEffect(() => {
    console.log('SimpleRaceTelemetryWidget props:', { id, name, metric, maxItems });
  }, [id, name, metric, maxItems]);
  
  // Use the hook with the specific metric we want to track
  const { data, sessionData } = useTelemetryData(id, { metrics: [metric] });
  
  // Format car data to include driver information
  const formattedCarData = useMemo(() => {
    if (!data || !sessionData?.drivers || !data[metric]) return [];
    
    // Skip if the metric isn't a CarIdx metric or not an array
    if (!metric.startsWith('CarIdx') || !Array.isArray(data[metric])) {
      return [];
    }
    
    const metricArray = data[metric] as any[];
    const drivers = sessionData.drivers.other_drivers || [];
    const playerCarIdx = sessionData.drivers.player_car_idx || 0;
    
    const formattedData = metricArray.map((value, idx) => {
      // Skip undefined/null values
      if (value === undefined || value === null) return null;
      
      // Find the driver data for this car
      const driver = drivers.find(d => d.car_idx === idx) || null;
      
      return {
        index: idx,
        value,
        formattedValue: formatTelemetryValue(metric, value),
        carNumber: driver?.car_number ? String(driver.car_number) : `#${idx}`,
        name: driver?.user_name || `Driver ${idx}`,
        isPlayerCar: idx === playerCarIdx
      };
    }).filter(Boolean); // Remove null entries
    
    // Sort by position if it's position-related data
    if (metric === 'CarIdxPosition') {
      formattedData.sort((a, b) => a.value - b.value);
    }
    
    // Limit items if needed
    if (maxItems > 0 && formattedData.length > maxItems) {
      return formattedData.slice(0, maxItems);
    }
    
    return formattedData;
  }, [data, sessionData, metric, maxItems]);
  
  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };

  // Render the widget content
  const renderContent = () => {
    // Handle the case where metric is undefined
    if (!metric) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">Error</div>
          <div className="text-sm text-red-400">No metric specified</div>
        </div>
      );
    }
    
    // If not a CarIdx metric, show an error
    if (!metric.startsWith('CarIdx')) {
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
          <div className="text-sm font-medium mb-1">{getMetricName(metric)}</div>
          <div className="text-sm text-gray-400">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col h-full w-full p-2">
        <div className="text-sm font-medium text-slate-300 mb-2 text-center">
          {getMetricName(metric)}
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