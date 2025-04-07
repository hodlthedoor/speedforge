import { useState, useEffect } from 'react';
import { WebSocketService } from '../services/WebSocketService';

// Typescript interface for telemetry data
export interface TelemetryData {
  // Car State
  speed_kph?: number;
  speed_mph?: number;
  rpm?: number;
  gear?: string;
  gear_num?: number;
  velocity_ms?: number;
  shift_indicator_pct?: number;
  on_pit_road?: boolean;
  track_surface?: string;
  
  // Driver Inputs
  throttle_pct?: number;
  brake_pct?: number;
  clutch_pct?: number;
  steering_angle_deg?: number;
  
  // Dynamics
  lateral_accel_ms2?: number;
  longitudinal_accel_ms2?: number;
  vertical_accel_ms2?: number;
  yaw_rate_deg_s?: number;
  g_force_lat?: number;
  g_force_lon?: number;
  car_slip_angle_deg?: number;
  
  // Timing
  current_lap_time?: number;
  last_lap_time?: number;
  best_lap_time?: number;
  lap_completed?: number;
  delta_best?: number;
  delta_session_best?: number;
  delta_optimal?: number;
  position?: number;
  
  // Fuel & Temps
  fuel_level?: number;
  fuel_pct?: number;
  fuel_use_per_hour?: number;
  
  // Additional fields from SimpleTelemetryWidget metrics
  // Any other fields that might be present in the data
  [key: string]: any;
}

interface UseTelemetryDataOptions {
  metrics?: string[];
  throttleUpdates?: boolean;
  updateInterval?: number;
}

/**
 * Custom hook for accessing telemetry data from WebSocketService
 * 
 * @param id - Unique identifier for this data consumer (typically widget id)
 * @param options - Configuration options
 * @returns TelemetryData object and connection status
 */
export function useTelemetryData(
  id: string,
  options: UseTelemetryDataOptions = {}
): { data: TelemetryData | null; connected: boolean } {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const { metrics, throttleUpdates = false, updateInterval = 100 } = options;

  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    let timer: number | null = null;
    
    // Add connection status listener
    webSocketService.addConnectionListener(id, (isConnected) => {
      setConnected(isConnected);
    });
    
    // Handler function for data updates
    const handleData = (newData: TelemetryData) => {
      // If specific metrics are requested, filter the data
      if (metrics && metrics.length > 0) {
        const filteredData: TelemetryData = {};
        metrics.forEach(metric => {
          if (metric in newData) {
            filteredData[metric] = newData[metric];
          }
        });
        setData(filteredData);
      } else {
        setData(newData);
      }
    };
    
    if (throttleUpdates) {
      // Throttled updates using an interval
      let latestData: TelemetryData | null = null;
      
      // Add data listener that captures but doesn't immediately update state
      webSocketService.addDataListener(id, (newData) => {
        latestData = newData;
      });
      
      // Set up interval to update state with latest data
      timer = window.setInterval(() => {
        if (latestData) {
          handleData(latestData);
        }
      }, updateInterval);
    } else {
      // Direct updates on each data message
      webSocketService.addDataListener(id, handleData);
    }
    
    // Clean up on unmount
    return () => {
      webSocketService.removeListeners(id);
      if (timer !== null) {
        window.clearInterval(timer);
      }
    };
  }, [id, metrics, throttleUpdates, updateInterval]);

  return { data, connected };
}

/**
 * Format telemetry values for display
 * @param metric The metric name/key
 * @param value The value to format
 * @returns Formatted string
 */
export function formatTelemetryValue(metric: string, value: any): string {
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
    case 'shift_indicator_pct':
      return `${value.toFixed(1)}%`;
    case 'gear':
      return String(value);
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

/**
 * Get a user-friendly name for a metric
 * @param metric The metric key
 * @returns Human-readable name
 */
export function getMetricName(metric: string): string {
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
    'lap_completed': 'Lap',
    'shift_indicator_pct': 'Shift Indicator'
  };
  
  return metricNames[metric] || metric;
} 