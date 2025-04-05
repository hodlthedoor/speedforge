/// <reference path="../types/electron.d.ts" />
import React from 'react';
import { BaseWidget, BaseWidgetProps } from './BaseWidget';
import { withWidgetRegistration } from './WidgetManager';

// Extend WidgetState to include telemetry-specific properties
declare module './BaseWidget' {
  interface WidgetState {
    selectedMetric: string;
  }
}

interface TelemetryWidgetProps extends BaseWidgetProps {
  metric?: string; // Default metric to display
}

class TelemetryWidgetBase extends BaseWidget<TelemetryWidgetProps> {
  constructor(props: TelemetryWidgetProps) {
    super(props);
    
    // Initialize state with telemetry-specific properties
    this.state = {
      ...this.state,
      selectedMetric: props.metric || 'speed_kph', // Default to speed if not specified
    };
  }

  // Handle param updates from the main process
  handleParamsUpdate = (params: Record<string, any>) => {
    console.log('TelemetryWidget received params update:', params);
    
    // Check if metric parameter is included in the update
    if (params.metric && params.metric !== this.state.selectedMetric) {
      this.setState({ selectedMetric: params.metric });
    }
  }

  // When the component receives new props (like a new metric from the control panel)
  componentDidUpdate(prevProps: TelemetryWidgetProps) {
    // Check if the metric prop has changed
    if (prevProps.metric !== this.props.metric && this.props.metric) {
      this.setState({ selectedMetric: this.props.metric });
    }
  }

  // Format the metric value for display
  formatMetricValue = (metric: string, value: any): string => {
    if (value === undefined || value === null) {
      return 'N/A';
    }
    
    // Format based on metric type
    switch (metric) {
      case 'speed_kph':
        return `${value.toFixed(1)} km/h`;
      case 'speed_mph':
        return `${value.toFixed(1)} mph`;
      case 'rpm':
        return `${value.toFixed(0)} RPM`;
      case 'throttle_pct':
      case 'brake_pct':
      case 'clutch_pct':
      case 'fuel_pct':
        return `${value.toFixed(1)}%`;
      case 'gear':
        return value;
      case 'g_force_lat':
      case 'g_force_lon':
        return `${value.toFixed(2)}G`;
      case 'current_lap_time':
      case 'last_lap_time':
      case 'best_lap_time':
        // Format time as mm:ss.ms
        const minutes = Math.floor(value / 60);
        const seconds = value % 60;
        return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
      default:
        return `${value}`;
    }
  };

  // Get a user-friendly name for the metric
  getMetricName = (metric: string): string => {
    const metricNames: Record<string, string> = {
      'speed_kph': 'Speed (KPH)',
      'speed_mph': 'Speed (MPH)',
      'rpm': 'RPM',
      'gear': 'Gear',
      'throttle_pct': 'Throttle',
      'brake_pct': 'Brake',
      'clutch_pct': 'Clutch',
      'g_force_lat': 'Lateral G',
      'g_force_lon': 'Longitudinal G',
      'fuel_level': 'Fuel Level',
      'fuel_pct': 'Fuel Percentage',
      'current_lap_time': 'Current Lap',
      'last_lap_time': 'Last Lap',
      'best_lap_time': 'Best Lap',
      'position': 'Position',
      'lap_completed': 'Lap'
    };
    
    return metricNames[metric] || metric;
  };

  renderContent() {
    const { telemetryData, connected, selectedMetric } = this.state;
    
    if (!connected) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-red-500 font-bold mb-2">Disconnected</div>
          <div className="text-sm">Attempting to connect...</div>
        </div>
      );
    }
    
    if (!telemetryData) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-blue-500 font-bold mb-2">Connected</div>
          <div className="text-sm">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-lg font-semibold">
          {this.getMetricName(selectedMetric)}
        </div>
        <div className="text-4xl font-bold mt-2">
          {this.formatMetricValue(selectedMetric, telemetryData[selectedMetric])}
        </div>
      </div>
    );
  }
}

export const TelemetryWidget = withWidgetRegistration<TelemetryWidgetProps>(TelemetryWidgetBase, 'telemetry'); 