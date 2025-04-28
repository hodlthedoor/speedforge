import React, { useState, useEffect, useMemo } from 'react';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface RacePositionWidgetProps {
  id: string;
  name?: string;
  initialPosition?: { x: number, y: number };
  onClose?: (id: string) => void;
  highlightPlayerCar?: boolean;
  maxCarsToShow?: number;
}

// Type for race car data to display in the widget
interface RaceCar {
  index: number;
  carNumber: string;
  name: string;
  position: number;
  lapDistPct: number; // Track position as percentage
  gap: string; // Gap to leader or car ahead
  isPlayerCar: boolean;
}

const RacePositionWidget: React.FC<RacePositionWidgetProps> = ({ 
  id, 
  name = "Race Positions",
  initialPosition,
  onClose,
  highlightPlayerCar = true,
  maxCarsToShow = 20,
}) => {
  // Use the hook with the specific metrics we need
  const { data, sessionData } = useTelemetryData(id, { 
    metrics: [
      'CarIdxPosition', 
      'CarIdxLapDistPct', 
      'CarIdxLap',
      'CarIdxLapCompleted', 
      'CarIdxF2Time',
      'CarIdxClassPosition'
    ] 
  });
  
  // Get combined race data with car information
  const raceData = useMemo(() => {
    if (!data || !sessionData?.drivers) return [];
    
    const positions = data.CarIdxPosition as number[] || [];
    const lapDistPcts = data.CarIdxLapDistPct as number[] || [];
    const laps = data.CarIdxLap as number[] || [];
    const completedLaps = data.CarIdxLapCompleted as number[] || [];
    const gapTimes = data.CarIdxF2Time as number[] || [];
    
    let carData: RaceCar[] = [];
    
    // Get information about each driver from session data
    const drivers = sessionData.drivers.other_drivers || [];
    const playerCarIdx = sessionData.drivers.player_car_idx || 0;
    
    // Process each car index
    positions.forEach((position, idx) => {
      // Skip invalid positions or empty entries
      if (!position || position <= 0) return;
      
      // Find the driver data for this car
      const driver = drivers.find(d => d.car_idx === idx) || null;
      if (!driver) return;
      
      // Calculate gap information
      let gapDisplay = '';
      if (position === 1) {
        gapDisplay = 'Leader';
      } else if (gapTimes && gapTimes[idx]) {
        // Format the gap time (seconds)
        const gapTime = gapTimes[idx];
        gapDisplay = `+${gapTime.toFixed(1)}s`;
      }
      
      // Add this car to our data array
      carData.push({
        index: idx,
        carNumber: driver.car_number ? String(driver.car_number) : `#${idx}`,
        name: driver.user_name || `Driver ${idx}`,
        position,
        lapDistPct: lapDistPcts[idx] || 0,
        gap: gapDisplay,
        isPlayerCar: idx === playerCarIdx
      });
    });
    
    // Sort by position
    carData.sort((a, b) => a.position - b.position);
    
    // Limit to max cars to show
    if (maxCarsToShow > 0 && carData.length > maxCarsToShow) {
      carData = carData.slice(0, maxCarsToShow);
    }
    
    return carData;
  }, [data, sessionData, maxCarsToShow]);
  
  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };

  // Render the widget content
  const renderContent = () => {
    if (!raceData || raceData.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">Race Positions</div>
          <div className="text-sm text-gray-400">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="h-full w-full p-2 overflow-auto">
        <div className="text-sm font-semibold text-slate-300 mb-2 px-1">
          Race Positions
        </div>
        <div className="grid grid-cols-1 gap-1">
          {raceData.map((car) => (
            <div 
              key={car.index} 
              className={`grid grid-cols-12 py-1 border-b border-slate-700 text-xs items-center
                ${car.isPlayerCar && highlightPlayerCar ? 'bg-blue-900/30 rounded px-1' : ''}`}
            >
              <div className="col-span-1 font-semibold text-slate-400">
                {car.position}
              </div>
              <div className="col-span-2 font-medium text-slate-400">
                #{car.carNumber}
              </div>
              <div className="col-span-5 truncate text-slate-200">
                {car.name}
              </div>
              <div className="col-span-4 text-right font-mono text-slate-300">
                {car.gap}
              </div>
            </div>
          ))}
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
      <div className="w-full h-full min-h-[240px] min-w-[280px] flex items-center justify-center">
        {renderContent()}
      </div>
    </Widget>
  );
};

export default RacePositionWidget; 