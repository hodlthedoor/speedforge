import React, { useState, useEffect } from 'react';
import { WidgetProps, WidgetType } from '../types/widget';
import BaseWidgetComponent from './BaseWidgetComponent';
import { registerWidget } from './WidgetFactory';

interface ClockWidgetParams {
  format24Hour?: boolean;
  showDate?: boolean;
  showSeconds?: boolean;
  timezone?: string;
}

const ClockWidgetComponent: React.FC<WidgetProps> = (props) => {
  const {
    id,
    params = {}
  } = props;
  
  const {
    format24Hour = false,
    showDate = true,
    showSeconds = true,
    timezone = 'local'
  } = params as ClockWidgetParams;
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Update the clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Format the time string based on preferences
  const formatTimeString = () => {
    const options: Intl.DateTimeFormatOptions = {
      hour: 'numeric',
      minute: 'numeric',
      ...(showSeconds ? { second: 'numeric' } : {}),
      hour12: !format24Hour
    };
    
    if (timezone !== 'local') {
      options.timeZone = timezone;
    }
    
    return new Intl.DateTimeFormat('en-US', options).format(currentTime);
  };
  
  // Format the date string
  const formatDateString = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    
    if (timezone !== 'local') {
      options.timeZone = timezone;
    }
    
    return new Intl.DateTimeFormat('en-US', options).format(currentTime);
  };
  
  return (
    <BaseWidgetComponent
      {...props}
      title="Clock"
      className="clock-widget"
    >
      <div className="flex flex-col items-center justify-center h-full">
        <div className="text-2xl font-bold">{formatTimeString()}</div>
        {showDate && (
          <div className="text-sm mt-2">{formatDateString()}</div>
        )}
      </div>
    </BaseWidgetComponent>
  );
};

// Register this widget type
registerWidget({
  type: WidgetType.CLOCK,
  label: 'Clock',
  description: 'Displays the current time and date',
  defaultWidth: 250,
  defaultHeight: 150,
  defaultParams: {
    format24Hour: false,
    showDate: true,
    showSeconds: true,
    timezone: 'local'
  },
  component: ClockWidgetComponent
});

export default ClockWidgetComponent; 