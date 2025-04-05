/// <reference path="../types/electron.d.ts" />
import React from 'react';
import { BaseWidget, BaseWidgetProps } from './BaseWidget';
import { withWidgetRegistration } from './WidgetManager';

// Extend the WidgetState to include time property
declare module './BaseWidget' {
  interface WidgetState {
    time?: Date;
    showTelemetry?: boolean;
  }
}

interface ClockWidgetProps extends BaseWidgetProps {
  format24h?: boolean;
  showTelemetry?: boolean;
}

class ClockWidgetBase extends BaseWidget<ClockWidgetProps> {
  private timerID: NodeJS.Timeout | null = null;

  constructor(props: ClockWidgetProps) {
    super(props);
    // Initialize the time property in the state
    this.state = {
      ...this.state,
      time: new Date(),
      showTelemetry: props.showTelemetry ?? false
    };
  }

  componentDidMount() {
    super.componentDidMount(); // Call the base class method to connect to telemetry
    this.timerID = setInterval(() => {
      this.setState({ time: new Date() });
    }, 1000);
  }

  componentWillUnmount() {
    super.componentWillUnmount(); // Call the base class method to clean up telemetry connection
    if (this.timerID) {
      clearInterval(this.timerID);
    }
  }
  
  // Handle parameter updates from the control panel
  handleParamsUpdate = (params: Record<string, any>) => {
    console.log('ClockWidget received params update:', params);
    
    // Update format24h and showTelemetry if present in the update
    if (params.showTelemetry !== undefined && params.showTelemetry !== this.state.showTelemetry) {
      this.setState({ showTelemetry: params.showTelemetry });
    }
    
    // The format24h is used directly from props in the render method, no need to store in state
  }

  formatTime() {
    const time = this.state.time || new Date();
    const { format24h } = this.props;
    
    let hours = time.getHours();
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    
    if (!format24h) {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes}:${seconds} ${period}`;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
  }
  
  toggleTelemetry = () => {
    this.setState(prevState => ({
      showTelemetry: !prevState.showTelemetry
    }));
  }
  
  // Format lap time values from telemetry
  formatLapTime(seconds: number): string {
    if (seconds <= 0) return "N/A";
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toFixed(3).padStart(6, '0')}`;
  }

  renderContent() {
    const { time, showTelemetry, telemetryData, connected } = this.state;
    const currentTime = time || new Date();
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-4xl font-bold">{this.formatTime()}</div>
        <div className="text-md mt-2 mb-4">{currentTime.toDateString()}</div>
        
        {/* Toggle button to show/hide telemetry */}
        <button 
          className="px-3 py-1 mt-2 mb-3 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
          onClick={this.toggleTelemetry}
        >
          {showTelemetry ? "Hide Telemetry" : "Show Telemetry"}
        </button>
        
        {/* Telemetry data display */}
        {showTelemetry && (
          <div className="telemetry-data text-sm border-t pt-3 w-full">
            {!connected && <div className="text-red-500">Telemetry disconnected</div>}
            {connected && !telemetryData && <div className="text-blue-500">Waiting for data...</div>}
            {connected && telemetryData && (
              <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                <div className="text-gray-600">Speed:</div>
                <div className="font-medium">{telemetryData.speed_kph?.toFixed(1) || "N/A"} km/h</div>
                
                <div className="text-gray-600">Current Lap:</div>
                <div className="font-medium">{this.formatLapTime(telemetryData.current_lap_time || 0)}</div>
                
                <div className="text-gray-600">Last Lap:</div>
                <div className="font-medium">{this.formatLapTime(telemetryData.last_lap_time || 0)}</div>
                
                <div className="text-gray-600">Lap:</div>
                <div className="font-medium">{telemetryData.lap_completed || "N/A"}</div>
                
                <div className="text-gray-600">Position:</div>
                <div className="font-medium">{telemetryData.position || "N/A"}</div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

export const ClockWidget = withWidgetRegistration<ClockWidgetProps>(ClockWidgetBase, 'clock'); 