import React, { useState, useEffect, useMemo } from 'react';
import Widget from './Widget';
import { useTelemetryData, formatTelemetryValue, getMetricName, TelemetryMetric } from '../hooks/useTelemetryData';

interface SimpleTelemetryWidgetProps {
  id: string;
  name: string;
  metric: TelemetryMetric;
  initialPosition?: { x: number, y: number };
  onClose?: (id: string) => void;
}

export   // Add metrics options
const availableMetrics = [
  { id: 'speed_kph', name: 'Speed (KPH)' },
  { id: 'speed_mph', name: 'Speed (MPH)' },
  { id: 'rpm', name: 'RPM' },
  { id: 'shift_indicator_pct', name: 'Shift Indicator %' },
  { id: 'gear', name: 'Gear' },
  { id: 'throttle_pct', name: 'Throttle' },
  { id: 'brake_pct', name: 'Brake' },
  { id: 'clutch_pct', name: 'Clutch' },
  { id: 'BrakeABSactive', name: 'ABS Active' },
  { id: 'g_force_lat', name: 'Lateral G' },
  { id: 'g_force_lon', name: 'Longitudinal G' },
  { id: 'lateral_accel_ms2', name: 'Lateral Accel (m/s²)' },
  { id: 'longitudinal_accel_ms2', name: 'Longitudinal Accel (m/s²)' },
  { id: 'fuel_level', name: 'Fuel Level' },
  { id: 'current_lap_time', name: 'Current Lap' },
  { id: 'last_lap_time', name: 'Last Lap' },
  { id: 'best_lap_time', name: 'Best Lap' },
  { id: 'position', name: 'Position' },
  { id: 'lap_completed', name: 'Lap' },
  { id: 'lat', name: 'Latitude' },
  { id: 'lon', name: 'Longitude' },
  { id: 'lap_dist', name: 'Lap Distance' },
  { id: 'lap_dist_pct', name: 'Track Position' },
  // Velocity vectors for track mapping
  { id: 'VelocityX', name: 'Forward Velocity' },
  { id: 'VelocityY', name: 'Side Velocity' },
  { id: 'VelocityZ', name: 'Vertical Velocity' },
  // Additional metrics that are used in other components
  { id: 'yaw_rate_deg_s', name: 'Yaw Rate (deg/s)' },
  { id: 'velocity_ms', name: 'Velocity (m/s)' },
  { id: 'PlayerTrackSurface', name: 'Track Surface' },
  // More useful metrics from useTelemetryData.ts
  { id: 'steering_angle_deg', name: 'Steering Angle (deg)' },
  { id: 'vertical_accel_ms2', name: 'Vertical Accel (m/s²)' },
  { id: 'car_slip_angle_deg', name: 'Car Slip Angle (deg)' },
  { id: 'fuel_pct', name: 'Fuel Percentage' },
  { id: 'fuel_use_per_hour', name: 'Fuel Use Rate' },
  { id: 'track_temp_c', name: 'Track Temp (°C)' },
  { id: 'air_temp_c', name: 'Air Temp (°C)' },
  { id: 'on_pit_road', name: 'On Pit Road' },
  { id: 'delta_best', name: 'Delta to Best' },
  { id: 'delta_session_best', name: 'Delta to Session Best' },
  { id: 'humidity_pct', name: 'Humidity (%)' },
  { id: 'wind_vel_ms', name: 'Wind Speed (m/s)' },
  // Additional metrics from telemetry_fields.rs
  { id: 'gear_num', name: 'Gear Number' },
  { id: 'track_surface', name: 'Track Surface Description' },
  { id: 'car_left_right', name: 'Cars Nearby' },
  { id: 'water_temp_c', name: 'Water Temp (°C)' },
  { id: 'oil_temp_c', name: 'Oil Temp (°C)' },
  { id: 'wind_dir_rad', name: 'Wind Direction (rad)' },
  { id: 'skies', name: 'Sky Conditions' },
  { id: 'repair_required_sec', name: 'Required Repairs (s)' },
  { id: 'opt_repair_sec', name: 'Optional Repairs (s)' },
  { id: 'incident_count', name: 'Incident Count' },
  { id: 'session_flags', name: 'Session Flags' },
  { id: 'delta_optimal', name: 'Delta to Optimal' },
  // Tire and brake temperature metrics (individual wheels)
  { id: 'tire_temps_c_lf', name: 'LF Tire Temp (°C)' },
  { id: 'tire_temps_c_rf', name: 'RF Tire Temp (°C)' },
  { id: 'tire_temps_c_lr', name: 'LR Tire Temp (°C)' },
  { id: 'tire_temps_c_rr', name: 'RR Tire Temp (°C)' },
  { id: 'brake_temps_c_lf', name: 'LF Brake Temp (°C)' },
  { id: 'brake_temps_c_rf', name: 'RF Brake Temp (°C)' },
  { id: 'brake_temps_c_lr', name: 'LR Brake Temp (°C)' },
  { id: 'brake_temps_c_rr', name: 'RR Brake Temp (°C)' },
  { id: 'tire_pressures_kpa_lf', name: 'LF Tire Pressure (kPa)' },
  { id: 'tire_pressures_kpa_rf', name: 'RF Tire Pressure (kPa)' },
  { id: 'tire_pressures_kpa_lr', name: 'LR Tire Pressure (kPa)' },
  { id: 'tire_pressures_kpa_rr', name: 'RR Tire Pressure (kPa)' },
  { id: 'ride_height_mm_lf', name: 'LF Ride Height (mm)' },
  { id: 'ride_height_mm_rf', name: 'RF Ride Height (mm)' },
  { id: 'ride_height_mm_lr', name: 'LR Ride Height (mm)' },
  { id: 'ride_height_mm_rr', name: 'RR Ride Height (mm)' },
  { id: 'shock_defl_mm_lf', name: 'LF Shock Defl (mm)' },
  { id: 'shock_defl_mm_rf', name: 'RF Shock Defl (mm)' },
  { id: 'shock_defl_mm_lr', name: 'LR Shock Defl (mm)' },
  { id: 'shock_defl_mm_rr', name: 'RR Shock Defl (mm)' },
  // Car Index metrics (arrays with data for each car)
  { id: 'CarIdxBestLapNum', name: 'Cars Best Lap Number' },
  { id: 'CarIdxBestLapTime', name: 'Cars Best Lap Time' },
  { id: 'CarIdxClass', name: 'Cars Class' },
  { id: 'CarIdxClassPosition', name: 'Cars Class Position' },
  { id: 'CarIdxEstTime', name: 'Cars Estimated Lap Time' },
  { id: 'CarIdxF2Time', name: 'Cars Gap Time' },
  { id: 'CarIdxFastRepairsUsed', name: 'Cars Fast Repairs Used' },
  { id: 'CarIdxGear', name: 'Cars Current Gear' },
  { id: 'CarIdxLap', name: 'Cars Current Lap' },
  { id: 'CarIdxLapCompleted', name: 'Cars Last Completed Lap' },
  { id: 'CarIdxLapDistPct', name: 'Cars Track Position %' },
  { id: 'CarIdxLastLapTime', name: 'Cars Last Lap Time' },
  { id: 'CarIdxOnPitRoad', name: 'Cars On Pit Road' },
  { id: 'CarIdxP2P_Count', name: 'Cars Push-to-Pass Left' },
  { id: 'CarIdxP2P_Status', name: 'Cars Push-to-Pass Active' },
  { id: 'CarIdxPaceFlags', name: 'Cars Pace Flags' },
  { id: 'CarIdxPaceLine', name: 'Cars Pace Line' },
  { id: 'CarIdxPaceRow', name: 'Cars Pace Row' },
  { id: 'CarIdxPosition', name: 'Cars Overall Position' },
  { id: 'CarIdxQualTireCompound', name: 'Cars Qualifying Tire' },
  { id: 'CarIdxQualTireCompoundLocked', name: 'Cars Qual Tire Locked' },
  { id: 'CarIdxRPM', name: 'Cars RPM' },
  { id: 'CarIdxSteer', name: 'Cars Steering Angle' },
  { id: 'CarIdxTireCompound', name: 'Cars Tire Compound' },
  { id: 'CarIdxTrackSurface', name: 'Cars Track Surface' },
  { id: 'CarIdxTrackSurfaceMaterial', name: 'Cars Surface Material' }
];

export const SimpleTelemetryWidget: React.FC<SimpleTelemetryWidgetProps> = ({ 
  id, 
  name,
  metric,
  initialPosition,
  onClose
}) => {
  // Use the new hook with the specific metric we want to track
  const { data } = useTelemetryData(id, { metrics: [metric] });
  
  // Transform array data for individual wheel metrics
  const transformedData = useMemo(() => {
    if (!data) return null;
    
    const transformed = { ...data };
    
    // Handle tire temperatures (array indices: 0=LF, 1=RF, 2=LR, 3=RR)
    if (data.tire_temps_c) {
      transformed.tire_temps_c_lf = data.tire_temps_c[0];
      transformed.tire_temps_c_rf = data.tire_temps_c[1];
      transformed.tire_temps_c_lr = data.tire_temps_c[2];
      transformed.tire_temps_c_rr = data.tire_temps_c[3];
    }
    
    // Handle brake temperatures
    if (data.brake_temps_c) {
      transformed.brake_temps_c_lf = data.brake_temps_c[0];
      transformed.brake_temps_c_rf = data.brake_temps_c[1];
      transformed.brake_temps_c_lr = data.brake_temps_c[2];
      transformed.brake_temps_c_rr = data.brake_temps_c[3];
    }
    
    // Handle tire pressures
    if (data.tire_pressures_kpa) {
      transformed.tire_pressures_kpa_lf = data.tire_pressures_kpa[0];
      transformed.tire_pressures_kpa_rf = data.tire_pressures_kpa[1];
      transformed.tire_pressures_kpa_lr = data.tire_pressures_kpa[2];
      transformed.tire_pressures_kpa_rr = data.tire_pressures_kpa[3];
    }
    
    // Handle ride heights
    if (data.ride_height_mm) {
      transformed.ride_height_mm_lf = data.ride_height_mm[0];
      transformed.ride_height_mm_rf = data.ride_height_mm[1];
      transformed.ride_height_mm_lr = data.ride_height_mm[2];
      transformed.ride_height_mm_rr = data.ride_height_mm[3];
    }
    
    // Handle shock deflection
    if (data.shock_defl_mm) {
      transformed.shock_defl_mm_lf = data.shock_defl_mm[0];
      transformed.shock_defl_mm_rf = data.shock_defl_mm[1];
      transformed.shock_defl_mm_lr = data.shock_defl_mm[2];
      transformed.shock_defl_mm_rr = data.shock_defl_mm[3];
    }
    
    // For Car Index arrays, preserve the full arrays - don't extract just the player's car
    // These will be used by race widgets that need data for all cars
    
    return transformed;
  }, [data]);
  
  // DEBUG: Log telemetry data when it changes to check if fields exist
  useEffect(() => {
    if (data) {
      // Check for all added fields
      const newMetrics = [
        'yaw_rate_deg_s',
        'velocity_ms',
        'PlayerTrackSurface',
        'steering_angle_deg',
        'vertical_accel_ms2',
        'car_slip_angle_deg'
      ];
      
      // Only log once when data first arrives
      const fieldsPresent = newMetrics.map(m => ({ 
        metric: m, 
        exists: data[m] !== undefined,
        value: data[m]
      }));
      
      // console.log(`[SimpleTelemetryWidget] Checking telemetry data for newly added metrics:`, fieldsPresent);
    }
  }, [data]);
  
  const handleClose = () => {
    if (onClose) {
      onClose(id);
    }
  };

  // Render the widget content
  const renderContent = () => {
    if (!transformedData) {
      return (
        <div className="flex flex-col items-center justify-center h-full w-full p-4">
          <div className="text-sm font-medium mb-1">{getMetricName(metric)}</div>
          <div className="text-sm text-gray-400">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full w-full p-4">
        <div className="text-sm font-medium text-slate-300 mb-2">
          {getMetricName(metric)}
        </div>
        <div className="text-2xl font-bold">
          {formatTelemetryValue(metric, transformedData[metric])}
        </div>
      </div>
    );
  };

  return (
    <Widget 
      id={id} 
      title={name}
      initialPosition={initialPosition}
      onClose={() => handleClose()}
      className="w-full h-full"
    >
      <div className="w-full h-full min-h-[100px] min-w-[120px] flex items-center justify-center">
        {renderContent()}
      </div>
    </Widget>
  );
};

export default SimpleTelemetryWidget; 