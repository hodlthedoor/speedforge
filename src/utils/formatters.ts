/**
 * Utility functions for formatting telemetry data values
 */
import { CarLeftRight } from '../types/telemetry';

export function formatSpeed(value: number, unit: 'kph' | 'mph' = 'kph'): string {
  if (unit === 'kph') {
    return `${value.toFixed(1)} km/h`;
  }
  return `${value.toFixed(1)} mph`;
}

export function formatGear(value: string | number): string {
  return String(value);
}

export function formatFuel(value: number): string {
  return `${value.toFixed(1)}L`;
}

export function formatTorque(value: number): string {
  return `${value.toFixed(1)} Nm`;
}

export function formatTemperature(value: number, unit: 'c' | 'f' = 'c'): string {
  if (unit === 'c') {
    return `${value.toFixed(1)}°C`;
  }
  return `${value.toFixed(1)}°F`;
}

export function formatLapTime(value: number): string {
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return `${minutes}:${seconds.toFixed(3).padStart(6, '0')}`;
}

export function formatPosition(value: number): string {
  return String(value);
}

export function formatBatteryLevel(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Format car left/right indicator status into a human-readable string
 */
export function formatCarLeftRight(status: CarLeftRight): string {
  switch (status) {
    case CarLeftRight.Off:
      return 'Off';
    case CarLeftRight.Clear:
      return 'Clear';
    case CarLeftRight.CarLeft:
      return 'Car Left';
    case CarLeftRight.CarRight:
      return 'Car Right';
    case CarLeftRight.CarLeftRight:
      return 'Cars Left & Right';
    case CarLeftRight.TwoCarsLeft:
      return 'Two Cars Left';
    case CarLeftRight.TwoCarsRight:
      return 'Two Cars Right';
    default:
      return 'Unknown';
  }
} 