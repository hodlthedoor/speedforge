/// <reference path="../types/electron.d.ts" />
import React from 'react';
import { BaseWidget, BaseWidgetProps, WidgetState } from './BaseWidget';

interface TelemetryWidgetProps extends BaseWidgetProps {
  metric?: string; // Default metric to display
}

// Extended widget state
interface TelemetryWidgetState extends WidgetState {
  selectedMetric: string;
}

export class TelemetryWidget extends BaseWidget<TelemetryWidgetProps> {
  // Use the extended state type
  state: TelemetryWidgetState;
  
  constructor(props: TelemetryWidgetProps) {
    super(props);
    
    // Initialize with base state from parent class
    this.state = {
      ...this.state,
      selectedMetric: this.getInitialMetric()
    };
  }
  
  // Get initial metric from URL or props
  getInitialMetric(): string {
    // Check URL parameters first (highest priority)
    let initialMetric = this.props.metric || 'speed_kph';
    
    // When in Electron, check URL parameters
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const metricParam = searchParams.get('metric');
      if (metricParam) {
        console.log(`Found metric in URL parameters: ${metricParam}`);
        initialMetric = metricParam;
      }
    }
    
    console.log(`TelemetryWidget initialized with metric: ${initialMetric}`);
    return initialMetric;
  }
  
  // Override parent method to handle parameter updates
  handleParamsUpdate = (params: Record<string, any>) => {
    // Call parent implementation first
    super.handleParamsUpdate(params);
    
    // Update metric if provided
    if (params.metric && params.metric !== this.state.selectedMetric) {
      console.log(`Updating metric from ${this.state.selectedMetric} to ${params.metric}`);
      this.setState({ selectedMetric: params.metric });
    }
  }
  
  // Override method to handle new telemetry data
  protected onTelemetryDataReceived(data: any) {
    // No special handling needed, the base class already sets telemetryData in state
  }
  
  // Format the metric value for display
  formatMetricValue(metric: string, value: any): string {
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
      case 'fuel_level':
        return `${value.toFixed(1)}L`;
      case 'position':
      case 'lap_completed':
        return `${value}`;
      default:
        return `${value}`;
    }
  }
  
  // Get a user-friendly name for the metric
  getMetricName(metric: string): string {
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
  }
  
  // Required renderContent method from BaseWidget
  renderContent(): React.ReactNode {
    const { connected, telemetryData } = this.state;
    const { selectedMetric } = this.state;
    
    if (!connected) {
      return (
        <div className="widget-content">
          <div className="status-disconnected">Disconnected</div>
          <div className="status-message">Attempting to connect...</div>
        </div>
      );
    }
    
    if (!telemetryData) {
      return (
        <div className="widget-content">
          <div className="status-connected">Connected</div>
          <div className="status-message">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="widget-content">
        <div className="widget-label">
          {this.getMetricName(selectedMetric)}
        </div>
        <div className="widget-value">
          {this.formatMetricValue(selectedMetric, telemetryData[selectedMetric])}
        </div>
      </div>
    );
  }
} 