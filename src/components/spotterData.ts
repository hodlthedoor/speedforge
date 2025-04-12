// Define trigger conditions for automatic TTS
export type TriggerCondition = 'manual' | 'interval' | 'telemetry' | 'threshold';

export interface TriggerConfig {
  condition: TriggerCondition;
  interval?: number; // in ms, for interval
  telemetryKey?: string; // for telemetry-based triggers
  threshold?: number; // for threshold-based triggers
  comparison?: 'gt' | 'lt' | 'eq' | 'change'; // greater than, less than, equal, any change
  lastValue?: any; // to track changes
  lastTriggered?: number; // timestamp of last trigger
  cooldown?: number; // minimum time between triggers in ms
}

// Interface for trigger events
export interface TriggerEvent {
  id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerConfig;
  phrases: string[]; // Array of possible phrases to choose from randomly
  lastUsedPhraseIndex?: number; // Optionally track last used phrase to avoid repetition
}

// Default spotter triggers
export const defaultTriggers: TriggerEvent[] = [
  { 
    id: '1',
    name: 'Speed Announcement',
    enabled: true,
    trigger: { 
      condition: 'interval',
      interval: 30000, // Every 30 seconds
      lastTriggered: 0,
      cooldown: 20000 // At least 20 seconds between announcements
    },
    phrases: [
      'Current speed: {speed} kilometers per hour',
      'You are going {speed} kilometers per hour',
      'Speed is now {speed}',
    ]
  },
  { 
    id: '2',
    name: 'Low Fuel Warning',
    enabled: true,
    trigger: { 
      condition: 'threshold',
      telemetryKey: 'fuel',
      threshold: 10,
      comparison: 'lt',
      cooldown: 30000 // Only announce every 30 seconds
    },
    phrases: [
      'Warning: low fuel',
      'Fuel level critical',
      'Running out of fuel, box this lap',
    ]
  },
  { 
    id: '3',
    name: 'Car Left Alert',
    enabled: true,
    trigger: { 
      condition: 'telemetry',
      telemetryKey: 'carLeft',
      comparison: 'change',
      lastValue: false,
      cooldown: 3000
    },
    phrases: [
      'Car on your left',
      'Vehicle approaching on left side',
      'Left side, left side',
    ]
  },
  { 
    id: '4',
    name: 'Car Right Alert',
    enabled: true,
    trigger: { 
      condition: 'telemetry',
      telemetryKey: 'carRight',
      comparison: 'change',
      lastValue: false,
      cooldown: 3000
    },
    phrases: [
      'Car on your right',
      'Vehicle approaching on right side',
      'Right side, right side',
    ]
  }
];

// Default telemetry data
export const defaultTelemetryData = {
  speed: 0,
  rpm: 0,
  gear: 0,
  fuel: 100,
  lap: 1,
  position: 1,
  carLeft: false,
  carRight: false
};

// Helper function to process placeholder text with telemetry data
export function processText(text: string, telemetryData: Record<string, any>): string {
  return text.replace(/{([^}]+)}/g, (match, key) => {
    const value = telemetryData[key];
    
    if (value === undefined) {
      return match; // Keep original placeholder if key not found
    }
    
    // Format value based on type
    if (typeof value === 'number') {
      // Check if it's an integer by using Number.isInteger
      return value.toFixed(Number.isInteger(value) ? 0 : 1);
    }
    
    return String(value);
  });
}

// Create a new trigger with default values
export function createNewTrigger(): TriggerEvent {
  return {
    id: Date.now().toString(),
    name: 'New Trigger',
    enabled: true,
    trigger: {
      condition: 'manual'
    },
    phrases: ['New phrase']
  };
} 