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

// Global connection state to track if we've already set up the primary connection
let globalConnectionEstablished = false;
// Global ID for the main connection across all hook instances
const SHARED_CONNECTION_ID = 'global-telemetry-connection';

// Insert the following above the TelemetryData interface
export interface WeekendInfo {
  track_name: string;
  track_config: string;
  track_length_km: number;
  session_type?: string;
  speed_unit?: string;
}

// Add GapData interface
interface GapData {
  car_idx: number;
  position: number;
  gap_to_leader: number;
  gap_to_next: number;
  gap_to_prev: number;
  last_checkpoint: number;
  last_checkpoint_time: number;
}

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
  BrakeABSactive?: boolean; // ABS activation status
  
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
  SessionTime?: number;
  
  // Fuel & Temps
  fuel_level?: number;
  fuel_pct?: number;
  fuel_use_per_hour?: number;
  track_temp_c?: number;
  air_temp_c?: number;
  humidity_pct?: number;
  fog_level_pct?: number;
  wind_vel_ms?: number;
  wind_dir_rad?: number;
  skies?: string;
  weekend_info?: WeekendInfo;
  
  // Session info data
  session_info?: string;
  
  // Additional fields from SimpleTelemetryWidget metrics
  // Any other fields that might be present in the data
  [key: string]: any;
  
  // Add gap_data field
  gap_data?: GapData[];
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
  | 'BrakeABSactive'
  
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
  | 'SessionTime'
  
  // Fuel & Temps
  | 'fuel_level'
  | 'fuel_pct'
  | 'fuel_use_per_hour'
  | 'track_temp_c'
  | 'air_temp_c'
  | 'humidity_pct'
  | 'fog_level_pct'
  | 'wind_vel_ms'
  | 'wind_dir_rad'
  | 'skies'
  | 'weekend_info'
  
  // Session info
  | 'session_info'
  
  // Car Index metrics (arrays with data for each car)
  | 'CarIdxBestLapNum'
  | 'CarIdxBestLapTime'
  | 'CarIdxClass'
  | 'CarIdxClassPosition'
  | 'CarIdxEstTime'
  | 'CarIdxF2Time'
  | 'CarIdxFastRepairsUsed'
  | 'CarIdxGear'
  | 'CarIdxLap'
  | 'CarIdxLapCompleted'
  | 'CarIdxLapDistPct'
  | 'CarIdxLastLapTime'
  | 'CarIdxOnPitRoad'
  | 'CarIdxP2P_Count'
  | 'CarIdxP2P_Status'
  | 'CarIdxPaceFlags'
  | 'CarIdxPaceLine'
  | 'CarIdxPaceRow'
  | 'CarIdxPosition'
  | 'CarIdxQualTireCompound'
  | 'CarIdxQualTireCompoundLocked'
  | 'CarIdxRPM'
  | 'CarIdxSteer'
  | 'CarIdxTireCompound'
  | 'CarIdxTrackSurface'
  | 'CarIdxTrackSurfaceMaterial'
  | 'CarIdxGapToLeader';

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

  // Get reference to the WebSocketService singleton
  const webSocketServiceRef = useRef<WebSocketService>(WebSocketService.getInstance());

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
    
    // Update positions and gaps using backend-calculated data
    if (newData.gap_data) {
      // Filter out cars without a valid class position (<= 0)
      newData.gap_data = newData.gap_data.filter(gap => {
        const classPosArr = newData.CarIdxClassPosition;
        const classPos = classPosArr ? classPosArr[gap.car_idx] : undefined;
        return classPos && classPos !== undefined && classPos > 0;
      });
      // Initialize arrays with the correct size (64 cars)
      newData.CarIdxPosition = new Array(64).fill(0);
      newData.CarIdxF2Time = new Array(64).fill(0);
      newData.CarIdxGapToLeader = new Array(64).fill(0);

      // Debug log the gap data
      console.log('Received gap data:', newData.gap_data);

      // Update positions and gaps from gap_data
      newData.gap_data.forEach(gap => {
        // Ensure car_idx is within bounds
        if (gap.car_idx >= 0 && gap.car_idx < 64) {
          newData.CarIdxPosition[gap.car_idx] = gap.position;
          newData.CarIdxF2Time[gap.car_idx] = gap.gap_to_next;
          newData.CarIdxGapToLeader[gap.car_idx] = gap.gap_to_leader;
          
        }
      });

      // Debug log the final arrays
      console.log('Updated position array:', newData.CarIdxPosition);
      console.log('Updated gap to next array:', newData.CarIdxF2Time);
      console.log('Updated gap to leader array:', newData.CarIdxGapToLeader);
    }
    
    // If specific metrics are requested, filter the data
    if (metricsRef.current && metricsRef.current.length > 0) {
      const filteredData: TelemetryData = {};
      metricsRef.current.forEach(metric => {
        if (metric in newData) {
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
    
    // Update connected status based on receiving data
    if (isMountedRef.current) {
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

  // Initialize connection once and set up listeners specific to this instance
  useEffect(() => {
    isMountedRef.current = true;
    const webSocketService = webSocketServiceRef.current;
    
    // Set initial connection state from the service
    setConnected(webSocketService.isConnected());
    
    // Only add a connection listener with the shared ID if it hasn't been established yet
    if (!globalConnectionEstablished) {
      console.log('useTelemetryData: Setting up global connection with ID:', SHARED_CONNECTION_ID);
      globalConnectionEstablished = true;
    }
    
    // Always add a connection listener for this specific instance
    webSocketService.addConnectionListener(id, handleConnection);
    
    // Add data listener for this specific instance
    webSocketService.addDataListener(id, handleData);
    
    // Add a handler for the global force close event
    const handleForceClose = () => {
      console.log(`useTelemetryData (${id}): Received force-close event, closing connection`);
      // Force close the WebSocket connection
      webSocketService.close();
    };
    
    // Listen for both global and widget-specific force close events
    window.addEventListener('app:force-close-connections', handleForceClose);
    window.addEventListener('widget:force-close-connections', (e: any) => {
      // Check if this event is for this specific widget
      if (e.detail && e.detail.widgetId === id) {
        console.log(`useTelemetryData (${id}): Received widget-specific force-close event`);
        handleForceClose();
      }
    });
    
    // Set up throttling timer if needed
    setupThrottledUpdates();
    
    // Clean up on unmount
    return () => {
      isMountedRef.current = false;
      
      // Remove this instance's listeners
      webSocketService.removeListeners(id);
      
      // Remove force close event listeners
      window.removeEventListener('app:force-close-connections', handleForceClose);
      window.removeEventListener('widget:force-close-connections', handleForceClose);
      
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

  return { data, sessionData, isConnected: connected };
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
    case 'CarIdxRPM':
      return `${value.toFixed(0)} RPM`;
    case 'throttle_pct':
    case 'brake_pct':
    case 'clutch_pct':
    case 'fuel_pct':
    case 'shift_indicator_pct':
    case 'humidity_pct':
    case 'fog_level_pct':
      return `${value.toFixed(1)}%`;
    case 'gear':
    case 'gear_num':
    case 'CarIdxGear':
      return String(value);
    case 'car_left_right':
      return formatCarLeftRight(value);
    case 'BrakeABSactive':
      return value ? 'Active' : 'Inactive';
    case 'skies':
    case 'track_surface':
    case 'CarIdxTrackSurface':
    case 'CarIdxTrackSurfaceMaterial':
    case 'CarIdxTireCompound':
    case 'CarIdxQualTireCompound':
      return String(value);
    case 'g_force_lat':
    case 'g_force_lon':
      return `${value.toFixed(2)}G`;
    case 'current_lap_time':
    case 'last_lap_time':
    case 'best_lap_time':
    case 'CarIdxLastLapTime':
    case 'CarIdxBestLapTime':
    case 'CarIdxEstTime':
    case 'CarIdxF2Time':
      // Format time as mm:ss.ms
      const minutes = Math.floor(value / 60);
      const seconds = value % 60;
      return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
    case 'fuel_level':
      return `${value.toFixed(1)}L`;
    case 'fuel_use_per_hour':
      return `${value.toFixed(1)}L/h`;
    case 'position':
    case 'lap_completed':
    case 'incident_count':
    case 'session_flags':
    case 'CarIdxPosition':
    case 'CarIdxLap':
    case 'CarIdxLapCompleted':
    case 'CarIdxBestLapNum':
    case 'CarIdxClass':
    case 'CarIdxClassPosition':
    case 'CarIdxFastRepairsUsed':
    case 'CarIdxP2P_Count':
    case 'CarIdxPaceRow':
    case 'CarIdxPaceLine':
      return `${value}`;
    case 'CarIdxP2P_Status':
    case 'CarIdxQualTireCompoundLocked':
    case 'CarIdxOnPitRoad':
      return value ? 'Yes' : 'No';
    case 'lat':
    case 'lon':
      return `${value.toFixed(6)}`;
    case 'lap_dist':
      return `${value.toFixed(1)}m`;
    case 'lap_dist_pct':
    case 'CarIdxLapDistPct':
      return `${(value * 100).toFixed(1)}%`;
    case 'lateral_accel_ms2':
    case 'longitudinal_accel_ms2':
    case 'vertical_accel_ms2':
      return `${value.toFixed(2)} m/s²`;
    case 'velocity_ms':
    case 'VelocityX':
    case 'VelocityY':
    case 'VelocityZ':
    case 'wind_vel_ms':
      return `${value.toFixed(2)} m/s`;
    case 'yaw_rate_deg_s':
    case 'steering_angle_deg':
    case 'car_slip_angle_deg':
    case 'CarIdxSteer':
      return `${value.toFixed(1)}°`;
    case 'wind_dir_rad':
      // Convert radians to degrees for display
      return `${(value * 180 / Math.PI).toFixed(1)}°`;
    case 'PlayerTrackSurface':
      return getTrackSurfaceName(value);
    case 'on_pit_road':
      return value ? 'In Pits' : 'On Track';
    case 'water_temp_c':
    case 'oil_temp_c':
    case 'track_temp_c':
    case 'air_temp_c':
    case 'tire_temps_c_lf':
    case 'tire_temps_c_rf':
    case 'tire_temps_c_lr':
    case 'tire_temps_c_rr':
    case 'brake_temps_c_lf':
    case 'brake_temps_c_rf':
    case 'brake_temps_c_lr':
    case 'brake_temps_c_rr':
      return `${value.toFixed(1)}°C`;
    case 'tire_pressures_kpa_lf':
    case 'tire_pressures_kpa_rf':
    case 'tire_pressures_kpa_lr':
    case 'tire_pressures_kpa_rr':
      return `${value.toFixed(1)} kPa`;
    case 'ride_height_mm_lf':
    case 'ride_height_mm_rf':
    case 'ride_height_mm_lr':
    case 'ride_height_mm_rr':
    case 'shock_defl_mm_lf':
    case 'shock_defl_mm_rf':
    case 'shock_defl_mm_lr':
    case 'shock_defl_mm_rr':
      return `${value.toFixed(1)} mm`;
    case 'delta_best':
    case 'delta_session_best':
    case 'delta_optimal':
      // Add + for positive deltas
      const sign = value >= 0 ? '+' : '';
      return `${sign}${value.toFixed(3)}s`;
    case 'repair_required_sec':
    case 'opt_repair_sec':
      return `${value.toFixed(1)}s`;
    case 'SessionTime':
      return `${value.toFixed(1)}s`;
    default:
      // For any CarIdx metrics not specially handled above
      if (metric.startsWith('CarIdx')) {
        return `${value}`;
      }
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
    'BrakeABSactive': 'ABS Status',
    
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
    'SessionTime': 'Session Time',
    
    // Fuel & Temps
    'fuel_level': 'Fuel Level',
    'fuel_pct': 'Fuel Percentage',
    'fuel_use_per_hour': 'Fuel Use Per Hour',
    'track_temp_c': 'Track Temperature',
    'air_temp_c': 'Air Temperature',
    'humidity_pct': 'Humidity',
    'fog_level_pct': 'Fog Level',
    'wind_vel_ms': 'Wind Velocity',
    'wind_dir_rad': 'Wind Direction',
    'skies': 'Skies',
    'weekend_info': 'Weekend Info',
    
    // Car Index metrics
    'CarIdxBestLapNum': 'Best Lap Number',
    'CarIdxBestLapTime': 'Best Lap Time',
    'CarIdxClass': 'Car Class',
    'CarIdxClassPosition': 'Class Position',
    'CarIdxEstTime': 'Estimated Lap Time',
    'CarIdxF2Time': 'Gap Time',
    'CarIdxFastRepairsUsed': 'Fast Repairs Used',
    'CarIdxGear': 'Current Gear',
    'CarIdxLap': 'Current Lap',
    'CarIdxLapCompleted': 'Last Completed Lap',
    'CarIdxLapDistPct': 'Track Position %',
    'CarIdxLastLapTime': 'Last Lap Time',
    'CarIdxOnPitRoad': 'On Pit Road',
    'CarIdxP2P_Count': 'Push-to-Pass Left',
    'CarIdxP2P_Status': 'Push-to-Pass Active',
    'CarIdxPaceFlags': 'Pace Flags',
    'CarIdxPaceLine': 'Pace Line',
    'CarIdxPaceRow': 'Pace Row',
    'CarIdxPosition': 'Overall Position',
    'CarIdxQualTireCompound': 'Qualifying Tire',
    'CarIdxQualTireCompoundLocked': 'Qual Tire Locked',
    'CarIdxRPM': 'RPM',
    'CarIdxSteer': 'Steering Angle',
    'CarIdxTireCompound': 'Tire Compound',
    'CarIdxTrackSurface': 'Track Surface',
    'CarIdxTrackSurfaceMaterial': 'Surface Material'
  };
  
  return metricNames[metric] || metric;
}

/**
 * Helper function to get a readable track surface name from the numeric value
 */
function getTrackSurfaceName(value: number): string {
  switch (value) {
    case TrackSurface.OnTrack:
      return 'On Track';
    case TrackSurface.OffTrack:
      return 'Off Track';
    case TrackSurface.PitLane:
      return 'Pit Lane';
    case TrackSurface.PitStall:
      return 'Pit Stall';
    case TrackSurface.NotInWorld:
      return 'Not In World';
    default:
      return `Unknown (${value})`;
  }
} 