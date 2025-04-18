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
  formatTorque,
  formatCarLeftRight
} from '../utils/formatters';
import { TrackSurface, CarLeftRight } from '../types/telemetry';
import { SessionData } from '../types/SessionData';

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
  car_left_right?: CarLeftRight; // Cars to left/right indicator
  
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
  
  // Session info data
  session_info?: string;
  
  // Additional fields from SimpleTelemetryWidget metrics
  // Any other fields that might be present in the data
  [key: string]: any;
}

// Create a union type from TelemetryData keys for type safety
export type TelemetryMetric = 
  // Car State
  | 'speed_kph'
  | 'speed_mph'
  | 'rpm'
  | 'gear'
  | 'gear_num'
  | 'velocity_ms'
  | 'shift_indicator_pct'
  | 'on_pit_road'
  | 'track_surface'
  | 'PlayerTrackSurfaceStatus'
  | 'PlayerTrackSurface'
  | 'car_left_right'
  
  // Velocity Vectors
  | 'VelocityX'
  | 'VelocityY'
  | 'VelocityZ'
  
  // Driver Inputs
  | 'throttle_pct'
  | 'brake_pct'
  | 'clutch_pct'
  | 'steering_angle_deg'
  
  // Dynamics
  | 'lateral_accel_ms2'
  | 'longitudinal_accel_ms2'
  | 'vertical_accel_ms2'
  | 'yaw_rate_deg_s'
  | 'g_force_lat'
  | 'g_force_lon'
  | 'car_slip_angle_deg'
  
  // Track Position
  | 'lap_dist_pct'
  | 'lap_dist'
  
  // Location
  | 'lat'
  | 'lon'
  
  // Timing
  | 'current_lap_time'
  | 'last_lap_time'
  | 'best_lap_time'
  | 'lap_completed'
  | 'delta_best'
  | 'delta_session_best'
  | 'delta_optimal'
  | 'position'
  
  // Fuel & Temps
  | 'fuel_level'
  | 'fuel_pct'
  | 'fuel_use_per_hour'
  
  // Session info
  | 'session_info';

interface UseTelemetryDataOptions {
  metrics?: TelemetryMetric[];
  throttleUpdates?: boolean;
  updateInterval?: number;
}

/**
 * Custom hook for accessing telemetry data from WebSocketService
 * 
 * @param id - Unique identifier for this data consumer (typically widget id)
 * @param options - Configuration options
 * @returns TelemetryData object, parsed SessionData and connection status
 */
export function useTelemetryData(
  id: string,
  options: UseTelemetryDataOptions = {}
): { data: TelemetryData | null; sessionData: SessionData | null; isConnected: boolean } {
  const [data, setData] = useState<TelemetryData | null>(null);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const { metrics, throttleUpdates = false, updateInterval = 100 } = options;
  
  // Use refs to store the latest values without causing re-renders
  const latestDataRef = useRef<TelemetryData | null>(null);
  const timerRef = useRef<number | null>(null);
  const isMountedRef = useRef<boolean>(true);
  
  // Store metrics in a ref to avoid dependency changes
  const metricsRef = useRef(metrics);
  metricsRef.current = metrics;

  // Parse Rust struct format into JavaScript object
  const parseRustStruct = useCallback((structStr: string): any => {
    const result: any = {};
    
    // Match field: value pairs
    const fieldPattern = /(\w+): ([^,]+),?/g;
    let match;
    
    while ((match = fieldPattern.exec(structStr)) !== null) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Convert string representations to actual types
      if (value === 'None') {
        result[key] = null;
      } else if (value.startsWith('Some(') && value.endsWith(')')) {
        // Extract value from Some()
        const innerValue = value.substring(5, value.length - 1);
        // Remove quotes if string
        if (innerValue.startsWith('"') && innerValue.endsWith('"')) {
          result[key] = innerValue.substring(1, innerValue.length - 1);
        } else {
          // Try to parse as number
          const num = parseFloat(innerValue);
          result[key] = isNaN(num) ? innerValue : num;
        }
      } else if (value === 'true' || value === 'false') {
        result[key] = value === 'true';
      } else if (!isNaN(Number(value))) {
        result[key] = Number(value);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.substring(1, value.length - 1);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  }, []);

  // Parse session info string into structured data
  const parseSessionInfo = useCallback((sessionInfoStr: string): SessionData => {
    const parsedObj: SessionData = {};
    
    try {
      // Extract weekend information
      const weekendMatch = sessionInfoStr.match(/weekend: WeekendInfo \{([^}]+)\}/);
      if (weekendMatch && weekendMatch[1]) {
        parsedObj.weekend = parseRustStruct(weekendMatch[1]);
      }
      
      // Extract session information
      const sessionMatch = sessionInfoStr.match(/session: SessionInfo \{([^}]+)\}/);
      if (sessionMatch && sessionMatch[1]) {
        parsedObj.session = parseRustStruct(sessionMatch[1]);
        
        // Parse sessions array
        const sessionsMatch = sessionInfoStr.match(/sessions: \[(.*?)\]/s);
        if (sessionsMatch && sessionsMatch[1]) {
          const sessionsStr = sessionsMatch[1];
          const sessionEntries = sessionsStr.match(/Session \{([^}]+)\}/g);
          
          if (sessionEntries) {
            parsedObj.session.sessions = sessionEntries.map(entry => {
              const contentMatch = entry.match(/Session \{([^}]+)\}/);
              return contentMatch ? parseRustStruct(contentMatch[1]) : {};
            });
          }
        }
      }
      
      // Extract driver information
      const driversMatch = sessionInfoStr.match(/drivers: DriverInfo \{([^}]+)\}/);
      if (driversMatch && driversMatch[1]) {
        parsedObj.drivers = parseRustStruct(driversMatch[1]);
        
        // Parse other_drivers array
        const otherDriversMatch = sessionInfoStr.match(/other_drivers: \[(.*?)\]/s);
        if (otherDriversMatch && otherDriversMatch[1]) {
          const driversStr = otherDriversMatch[1];
          const driverEntries = driversStr.match(/Driver \{([^}]+)\}/g);
          
          if (driverEntries) {
            parsedObj.drivers.other_drivers = driverEntries.map(entry => {
              const contentMatch = entry.match(/Driver \{([^}]+)\}/);
              return contentMatch ? parseRustStruct(contentMatch[1]) : {};
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to parse session info:', err);
    }
    
    return parsedObj;
  }, [parseRustStruct]);

  // Memoized handler function to prevent recreation on every render
  const handleData = useCallback((newData: TelemetryData) => {
    if (!isMountedRef.current) return;
    
    // Process session info if available
    if (newData.session_info) {
      const parsedSessionData = parseSessionInfo(newData.session_info);
      setSessionData(parsedSessionData);
    }
    
    // If specific metrics are requested, filter the data
    if (metricsRef.current && metricsRef.current.length > 0) {
      const filteredData: TelemetryData = {};
      metricsRef.current.forEach(metric => {
        if (metric in newData) {
          // Use type assertion to fix the type error
          filteredData[metric as keyof TelemetryData] = newData[metric as keyof TelemetryData];
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
    
    // Update connected status based on PlayerTrackSurface
    if (isMountedRef.current && newData.PlayerTrackSurface !== undefined) {
      setConnected(true);
    }
  }, [throttleUpdates, parseSessionInfo]);

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

  // Calculate connection status based on PlayerTrackSurface
  const isConnected = data !== null && data.PlayerTrackSurface !== undefined;

  return { data, sessionData, isConnected };
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
    case 'car_left_right':
      return formatCarLeftRight(value);
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
 * Get a human-readable name for a telemetry metric
 * @param metric The metric key
 * @returns Human-readable name
 */
export function getMetricName(metric: string): string {
  const metricNames: Record<string, string> = {
    // Car State
    'speed_kph': 'Speed (km/h)',
    'speed_mph': 'Speed (mph)',
    'rpm': 'RPM',
    'gear': 'Gear',
    'gear_num': 'Gear Number',
    'velocity_ms': 'Velocity (m/s)',
    'shift_indicator_pct': 'Shift Indicator',
    'on_pit_road': 'On Pit Road',
    'track_surface': 'Track Surface',
    'car_left_right': 'Cars Nearby',
    
    // Velocity Vectors
    'VelocityX': 'Forward Velocity',
    'VelocityY': 'Lateral Velocity',
    'VelocityZ': 'Vertical Velocity',
    
    // Driver Inputs
    'throttle_pct': 'Throttle',
    'brake_pct': 'Brake',
    'clutch_pct': 'Clutch',
    'steering_angle_deg': 'Steering Angle',
    
    // Dynamics
    'lateral_accel_ms2': 'Lateral Acceleration',
    'longitudinal_accel_ms2': 'Longitudinal Acceleration',
    'vertical_accel_ms2': 'Vertical Acceleration',
    'yaw_rate_deg_s': 'Yaw Rate',
    'g_force_lat': 'Lateral G',
    'g_force_lon': 'Longitudinal G',
    'car_slip_angle_deg': 'Car Slip Angle',
    
    // Track Position
    'lap_dist_pct': 'Track Position',
    'lap_dist': 'Lap Distance',
    
    // Location
    'lat': 'Latitude',
    'lon': 'Longitude',
    
    // Timing
    'current_lap_time': 'Current Lap',
    'last_lap_time': 'Last Lap',
    'best_lap_time': 'Best Lap',
    'lap_completed': 'Lap',
    'delta_best': 'Delta Best',
    'delta_session_best': 'Delta Session Best',
    'delta_optimal': 'Delta Optimal',
    'position': 'Position',
    
    // Fuel & Temps
    'fuel_level': 'Fuel Level',
    'fuel_pct': 'Fuel Percentage',
    'fuel_use_per_hour': 'Fuel Use Per Hour',
  };
  
  return metricNames[metric] || metric;
} 