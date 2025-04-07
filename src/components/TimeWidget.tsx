import React, { useState, useEffect } from 'react';
import Widget from './Widget';

interface TimeWidgetProps {
  id: string;
  onClose?: () => void;
}

const TimeWidget: React.FC<TimeWidgetProps> = ({ id, onClose }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit',
      hour12: true 
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString([], {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Widget 
      id={id}
      title="Time"
      onClose={onClose}
    >
      <div className="time-widget">
        <div className="time-value">{formatTime(currentTime)}</div>
        <div className="date-value">{formatDate(currentTime)}</div>
      </div>
    </Widget>
  );
};

export default TimeWidget; 