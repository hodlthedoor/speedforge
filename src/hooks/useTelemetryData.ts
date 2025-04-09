import { useState, useEffect, useRef, useCallback } from 'react';
import { WebSocketService } from '../services/WebSocketService';
import { 
  formatBatteryLevel, 
  formatFuel, 
  formatGear, 
  formatLapTime,
  formatPosition, 
  formatSpeed, 
  formatTemperature, 
  formatTorque
} from '../utils/formatters';
import { TrackSurface } from '../types/telemetry';

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
  PlayerTrackSurfaceStatus?: string;
  PlayerTrackSurface?: TrackSurface;
  
  // Velocity Vectors
  VelocityX?: number;     // Forward/backward velocity (car's local X axis)
  VelocityY?: number;     // Left/right velocity (car's local Y axis)
  VelocityZ?: number;     // Up/down velocity (car's local Z axis)
  
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
  
  // Track Position
  lap_dist_pct?: number;
  lap_dist?: number;
  
  // Location
  lat?: number;
  lon?: number;
  
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
  
  // Use refs to store the latest values without causing re-renders
  const latestDataRef = useRef<TelemetryData | null>(null);
  const timerRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  
  // Store metrics in a ref to avoid dependency changes
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  // Memoized handler function to prevent recreation on every render
  const handleData = useCallback((newData: TelemetryData) => {
    if (!isMountedRef.current) return;
    
    // If specific metrics are requested, filter the data
    if (metricsRef.current && metricsRef.current.length > 0) {
      const filteredData: TelemetryData = {};
      metricsRef.current.forEach(metric => {
        if (metric in newData) {
          filteredData[metric] = newData[metric];
        }
      });
      latestDataRef.current = filteredData;
      
      // Only update state if not throttling
      if (!throttleUpdates) {
        setData(filteredData);
      }
    } else {
      latestDataRef.current = newData;
      
      // Only update state if not throttling
      if (!throttleUpdates) {
        setData(newData);
      }
    }
  }, [throttleUpdates]);

  // Connection status handler
  const handleConnection = useCallback((isConnected: boolean) => {
    if (isMountedRef.current) {
      setConnected(isConnected);
    }
  }, []);

  // Set up the timer for throttled updates
  const setupThrottledUpdates = useCallback(() => {
    if (throttleUpdates && timerRef.current === null) {
      timerRef.current = window.setInterval(() => {
        if (isMountedRef.current && latestDataRef.current) {
          setData(latestDataRef.current);
        }
      }, updateInterval);
    }
  }, [throttleUpdates, updateInterval]);

  useEffect(() => {
    isMountedRef.current = true;
    const webSocketService = WebSocketService.getInstance();
    
    // Add connection status listener
    webSocketService.addConnectionListener(id, handleConnection);
    
    // Add data listener
    webSocketService.addDataListener(id, handleData);
    
    // Set up throttling timer if needed
    setupThrottledUpdates();
    
    // Clean up on unmount
    return () => {
      isMountedRef.current = false;
      webSocketService.removeListeners(id);
      
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [id, handleData, handleConnection, setupThrottledUpdates]);

  // If throttling options change during the lifetime of the component
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    
    // Restart timer with new settings if needed
    setupThrottledUpdates();
    
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [throttleUpdates, updateInterval, setupThrottledUpdates]);

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
    case 'lat':
    case 'lon':
      return `${value.toFixed(6)}`;
    case 'lap_dist':
      return `${value.toFixed(1)}m`;
    case 'lap_dist_pct':
      return `${(value * 100).toFixed(1)}%`;
    case 'lateral_accel_ms2':
    case 'longitudinal_accel_ms2':
      return `${value.toFixed(2)} m/s²`;
    case 'VelocityX':
    case 'VelocityY':
    case 'VelocityZ':
      return `${value.toFixed(3)} m/s`;
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
    'lateral_accel_ms2': 'Lateral Acceleration',
    'longitudinal_accel_ms2': 'Longitudinal Acceleration',
    'fuel_level': 'Fuel Level',
    'fuel_pct': 'Fuel Percentage',
    'current_lap_time': 'Current Lap',
    'last_lap_time': 'Last Lap',
    'best_lap_time': 'Best Lap',
    'position': 'Position',
    'lap_completed': 'Lap',
    'shift_indicator_pct': 'Shift Indicator',
    'lat': 'Latitude',
    'lon': 'Longitude',
    'lap_dist': 'Lap Distance',
    'lap_dist_pct': 'Track Position',
    'VelocityX': 'Forward Velocity',
    'VelocityY': 'Side Velocity',
    'VelocityZ': 'Vertical Velocity'
  };
  
  return metricNames[metric] || metric;
} 