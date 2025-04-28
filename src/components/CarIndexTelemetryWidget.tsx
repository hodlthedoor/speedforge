import React, { useState, useEffect, useMemo } from 'react';
import Widget from './Widget';
import { useTelemetryData, formatTelemetryValue, getMetricName, TelemetryMetric } from '../hooks/useTelemetryData';

interface CarIndexTelemetryWidgetProps {
  id: string;
  name: string;
  metric: TelemetryMetric;
  carIndex?: number; // Optional car index, defaults to player car (0)
  showAllCars?: boolean; // Whether to display data for all cars
  initialPosition?: { x: number, y: number };
  onClose?: (id: string) => void;
}

const CarIndexTelemetryWidget: React.FC<CarIndexTelemetryWidgetProps> = ({ 
  id, 
  name,
  metric,
  carIndex = 0, // Default to player's car
  showAllCars = false,
  initialPosition,
  onClose
}) => {
  // Use hook with the specific metric we want to track
  const { data, sessionData } = useTelemetryData(id, { metrics: [metric] });
  
  // Get information about cars for labeling
  const carInfo = useMemo(() => {
    if (!sessionData?.drivers?.other_drivers) return [];
    
    const cars = sessionData.drivers.other_drivers.map((driver, index) => ({
      index,
      number: driver.car_number,
      name: driver.user_name,
      teamName: driver.team_name,
      carClass: driver.car_class_name
    }));
    
    return cars;
  }, [sessionData]);
  
  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };

  // Render the widget content
  const renderContent = () => {
    if (!data) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">{getMetricName(metric)}</div>
          <div className="text-sm text-gray-400">Waiting for data...</div>
        </div>
      );
    }
    
    // Handle case where metric is not an array (not a CarIdx* metric)
    if (!metric.startsWith('CarIdx') || !Array.isArray(data[metric])) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium text-slate-300 mb-2">
            {getMetricName(metric)}
          </div>
          <div className="text-2xl font-bold">
            {formatTelemetryValue(metric, data[metric])}
          </div>
          <div className="text-xs text-red-400">
            Warning: Not a car index metric
          </div>
        </div>
      );
    }
    
    const metricArray = data[metric] as any[];
    
    // If showing just one car
    if (!showAllCars) {
      // Make sure carIndex is within bounds
      const safeCarIndex = Math.min(carIndex, metricArray.length - 1);
      const value = metricArray[safeCarIndex];
      const car = carInfo.find(c => c.index === safeCarIndex);
      
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium text-slate-300 mb-2">
            {getMetricName(metric)}
          </div>
          {car && (
            <div className="text-xs text-slate-400 mb-1">
              Car #{car.number} - {car.name}
            </div>
          )}
          <div className="text-2xl font-bold">
            {formatTelemetryValue(metric, value)}
          </div>
        </div>
      );
    }
    
    // Show all cars in a list
    return (
      <div className="h-full w-full p-2 overflow-auto">
        <div className="text-sm font-medium text-slate-300 mb-2 text-center">
          {getMetricName(metric)}
        </div>
        <div className="grid grid-cols-1 gap-1">
          {metricArray.map((value, idx) => {
            if (value === undefined || value === null) return null;
            
            const car = carInfo.find(c => c.index === idx);
            return (
              <div key={idx} className="grid grid-cols-5 py-1 border-b border-slate-700 text-xs items-center">
                <div className="col-span-1 font-semibold text-slate-400">
                  {car ? `#${car.number}` : `Car ${idx}`}
                </div>
                <div className="col-span-2 truncate text-slate-300">
                  {car?.name || '-'}
                </div>
                <div className="col-span-2 text-right font-mono text-slate-200">
                  {formatTelemetryValue(metric, value)}
                </div>
              </div>
            );
          })}
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
      <div className="w-full h-full min-h-[180px] min-w-[220px] flex items-center justify-center">
        {renderContent()}
      </div>
    </Widget>
  );
};

export default CarIndexTelemetryWidget; 