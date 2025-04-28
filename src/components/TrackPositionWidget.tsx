import React, { useState, useEffect, useMemo, useRef } from 'react';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface TrackPositionWidgetProps {
  id: string;
  name?: string;
  initialPosition?: { x: number, y: number };
  onClose?: (id: string) => void;
}

// Type for car visualization data
interface CarVisualization {
  index: number;
  carNumber: string;
  name: string;
  position: number;
  trackPct: number; // 0-1 position on the track
  isPlayerCar: boolean;
  classColor: string; // For multi-class racing
}

const TrackPositionWidget: React.FC<TrackPositionWidgetProps> = ({ 
  id, 
  name = "Track Map",
  initialPosition,
  onClose
}) => {
  // Get track position data
  const { data, sessionData } = useTelemetryData(id, { 
    metrics: [
      'CarIdxPosition', 
      'CarIdxLapDistPct',
      'CarIdxClass'
    ]
  });
  
  // Reference to the canvas element
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Track shape - for now a simple oval
  // Later this could be replaced with actual track shape data
  const trackShape = useMemo(() => {
    return {
      type: 'oval',
      width: 240,
      height: 140,
      trackWidth: 20
    };
  }, []);
  
  // Class colors for multi-class racing
  const classColors = useMemo(() => {
    return [
      '#3b82f6', // Blue
      '#ef4444', // Red
      '#10b981', // Green
      '#f59e0b', // Yellow
      '#8b5cf6', // Purple
      '#ec4899', // Pink
    ];
  }, []);
  
  // Get car visualization data
  const carVisData = useMemo(() => {
    if (!data || !sessionData?.drivers) return [];
    
    const positions = data.CarIdxPosition as number[] || [];
    const trackPcts = data.CarIdxLapDistPct as number[] || [];
    const classes = data.CarIdxClass as number[] || [];
    
    let cars: CarVisualization[] = [];
    
    // Get information about each driver from session data
    const drivers = sessionData.drivers.other_drivers || [];
    const playerCarIdx = sessionData.drivers.player_car_idx || 0;
    
    // Process each car index
    positions.forEach((position, idx) => {
      // Skip invalid positions or empty entries
      if (!position || position <= 0) return;
      if (trackPcts[idx] === undefined || trackPcts[idx] === null) return;
      
      // Find the driver data for this car
      const driver = drivers.find(d => d.car_idx === idx) || null;
      if (!driver) return;
      
      // Get car class color
      const classIdx = classes[idx] || 0;
      const classColor = classColors[classIdx % classColors.length];
      
      // Add this car to our data array
      cars.push({
        index: idx,
        carNumber: driver.car_number ? String(driver.car_number) : `#${idx}`,
        name: driver.user_name || `Driver ${idx}`,
        position,
        trackPct: trackPcts[idx],
        isPlayerCar: idx === playerCarIdx,
        classColor
      });
    });
    
    return cars;
  }, [data, sessionData, classColors]);
  
  // Draw the track and cars
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw the track (oval)
    const { width, height, trackWidth } = trackShape;
    
    // Draw track outline
    ctx.beginPath();
    ctx.ellipse(canvas.width / 2, canvas.height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = trackWidth;
    ctx.stroke();
    
    // Draw the start/finish line
    const startX = canvas.width / 2;
    const startY = canvas.height / 2 - height / 2;
    ctx.beginPath();
    ctx.moveTo(startX, startY - trackWidth/2);
    ctx.lineTo(startX, startY + trackWidth/2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Draw the cars
    carVisData.forEach(car => {
      // Calculate position on the track ellipse
      const angle = car.trackPct * Math.PI * 2 - Math.PI / 2; // Start at top (270 degrees)
      const trackRadius = {
        x: width / 2,
        y: height / 2
      };
      
      const x = canvas.width / 2 + Math.cos(angle) * trackRadius.x;
      const y = canvas.height / 2 + Math.sin(angle) * trackRadius.y;
      
      // Draw car dot
      ctx.beginPath();
      ctx.arc(x, y, car.isPlayerCar ? 5 : 4, 0, Math.PI * 2);
      ctx.fillStyle = car.isPlayerCar ? '#ffffff' : car.classColor;
      ctx.fill();
      
      // Draw car position number
      ctx.font = '8px sans-serif';
      ctx.fillStyle = car.isPlayerCar ? '#ffffff' : '#d1d5db';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(car.position.toString(), x, y);
    });
    
  }, [carVisData, trackShape]);
  
  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };

  return (
    <Widget 
      id={id} 
      title={name}
      initialPosition={initialPosition}
      onClose={() => handleClose()}
      className="w-full h-full"
    >
      <div className="w-full h-full min-h-[240px] min-w-[320px] flex flex-col p-2">
        <canvas 
          ref={canvasRef}
          width={320}
          height={240}
          className="w-full h-full"
        />
      </div>
    </Widget>
  );
};

export default TrackPositionWidget; 