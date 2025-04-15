import React from 'react';
import { CarLeftRight } from '../types/telemetry';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface CarLeftIndicatorWidgetProps {
  id: string;
  initialPosition?: { x: number; y: number };
  onClose?: () => void;
  title?: string;
}

const CarLeftIndicatorWidget: React.FC<CarLeftIndicatorWidgetProps> = ({
  id,
  initialPosition = { x: 200, y: 200 },
  onClose,
  title = 'Car Left'
}) => {
  // Use the telemetry hook instead of direct WebSocket connection
  const { data, isConnected } = useTelemetryData(id, {
    metrics: ['car_left_right'],
    throttleUpdates: false
  });
  
  const carStatus = data?.car_left_right || CarLeftRight.Off;

  // Determine CSS classes based on car status
  const getIndicatorClasses = () => {
    switch (carStatus) {
      case CarLeftRight.CarLeft:
        return 'bg-amber-500'; // Yellow for a car on the left
      case CarLeftRight.TwoCarsLeft:
        return 'bg-red-600'; // Red for two cars on the left
      case CarLeftRight.CarLeftRight:
        return 'bg-amber-500'; // Yellow for cars on both sides
      default:
        return 'bg-slate-800'; // Dark gray when inactive
    }
  };

  return (
    <Widget
      id={id}
      title={title}
      initialPosition={initialPosition}
      onClose={onClose}
      className="w-20 h-20"
    >
      <div className="flex flex-col justify-center items-center h-full w-full p-2">
        <div 
          className={`w-full h-full rounded transition-all duration-200 ${getIndicatorClasses()}`}
          data-testid="car-left-indicator"
        />
      </div>
    </Widget>
  );
};

export default CarLeftIndicatorWidget; 