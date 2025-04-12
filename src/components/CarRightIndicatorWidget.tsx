import React, { useEffect, useState } from 'react';
import { WebSocketService } from '../services/WebSocketService';
import { CarLeftRight } from '../types/telemetry';
import Widget from './Widget';

interface CarRightIndicatorWidgetProps {
  id: string;
  initialPosition?: { x: number; y: number };
  onClose?: () => void;
  title?: string;
}

const CarRightIndicatorWidget: React.FC<CarRightIndicatorWidgetProps> = ({
  id,
  initialPosition = { x: 400, y: 200 },
  onClose,
  title = 'Car Right'
}) => {
  const [carStatus, setCarStatus] = useState<CarLeftRight>(CarLeftRight.Off);

  useEffect(() => {
    // Get WebSocket service
    const wsService = WebSocketService.getInstance();

    // Add data listener to update the component when telemetry data is received
    wsService.addDataListener(id, (data) => {
      if (data && data.car_left_right) {
        setCarStatus(data.car_left_right);
      }
    });

    // Clean up on unmount
    return () => {
      wsService.removeListeners(id);
    };
  }, [id]);

  // Determine CSS classes based on car status
  const getIndicatorClasses = () => {
    switch (carStatus) {
      case CarLeftRight.CarRight:
        return 'bg-amber-500'; // Orange for a car on the right
      case CarLeftRight.TwoCarsRight:
        return 'bg-red-600'; // Red for two cars on the right
      case CarLeftRight.CarLeftRight:
        return 'bg-amber-500'; // Orange for cars on both sides
      default:
        return 'bg-slate-800'; // Dark gray when inactive
    }
  };

  // Determine text to display
  const getIndicatorText = () => {
    switch (carStatus) {
      case CarLeftRight.CarRight:
        return 'CAR ▶';
      case CarLeftRight.TwoCarsRight:
        return 'CARS ▶▶';
      case CarLeftRight.CarLeftRight:
        return 'CAR ▶';
      default:
        return '';
    }
  };

  return (
    <Widget
      id={id}
      title={title}
      initialPosition={initialPosition}
      onClose={onClose}
      className="w-40 h-40"
    >
      <div className="flex flex-col justify-center items-center h-full w-full">
        <div 
          className={`flex justify-center items-center w-full h-full rounded text-white text-xl font-bold font-mono transition-all duration-200 ${getIndicatorClasses()}`}
          data-testid="car-right-indicator"
        >
          {getIndicatorText()}
        </div>
      </div>
    </Widget>
  );
};

export default CarRightIndicatorWidget; 