import WidgetRegistry, { WidgetControlType } from './WidgetRegistry';
import TrackMapWidget from '../components/TrackMapWidget';
import { SimpleTelemetryWidget } from '../components/SimpleTelemetryWidget';
import PedalTraceWidget from '../components/PedalTraceWidget';
import ShiftIndicatorWidget from '../components/ShiftIndicatorWidget';
import GearShiftWidget from '../components/GearShiftWidget';
import SpotterWidget from '../components/SpotterWidget';
import WeekendInfoWidget from '../components/WeekendInfoWidget';
import SpeedWidget from '../components/SpeedWidget';
import SessionInfoWidget from '../components/SessionInfoWidget';
import NumberWidget from '../components/NumberWidget';
import BasicMapWidget from '../components/BasicMapWidget';
import NearbyCarWidget from '../components/NearbyCarWidget';
import CarIndexTelemetryWidget from '../components/CarIndexTelemetryWidget';
import RacePositionWidget from '../components/RacePositionWidget';
import TrackPositionWidget from '../components/TrackPositionWidget';
import SimpleRaceTelemetryWidget from '../components/SimpleRaceTelemetryWidget';
import GForceMeterWidget from '../components/GForceMeterWidget';


// Register Telemetry Widget
WidgetRegistry.register('telemetry', {
  component: SimpleTelemetryWidget,
  defaultTitle: 'Telemetry',
  defaultOptions: {},
  description: 'Display telemetry data from the sim',
  category: 'Data'
});

// Register Pedal Trace Widget
WidgetRegistry.register('pedal-trace', {
  component: PedalTraceWidget,
  defaultTitle: 'Pedal Inputs',
  defaultOptions: {},
  defaultState: {
    width: 480,
    historyLength: 100
  },
  description: 'Visualize throttle and brake inputs',
  category: 'Visualization'
});

// Register Shift Indicator Widget
WidgetRegistry.register('shift-indicator', {
  component: ShiftIndicatorWidget,
  defaultTitle: 'Shift Indicator',
  defaultOptions: {},
  description: 'Display when to shift gears',
  category: 'Driving Aids'
});


// Register Spotter Widget
WidgetRegistry.register('spotter', {
  component: SpotterWidget,
  defaultTitle: 'Spotter',
  defaultOptions: {},
  description: 'Race spotter with customizable voice announcements',
  category: 'Audio'
});

// Register Weekend Info Widget
WidgetRegistry.register('weekend-info', {
  component: WeekendInfoWidget,
  defaultTitle: 'Track Info',
  defaultOptions: {},
  description: 'Display track and session information',
  category: 'Data'
});

// Register Speed Widget
WidgetRegistry.register('speed', {
  component: SpeedWidget,
  defaultTitle: 'Speed',
  defaultOptions: {
    unit: 'kph'
  },
  description: 'Display current speed with customizable size',
  category: 'Driving Data'
});

// Register G-Force Meter Widget
WidgetRegistry.register('g-force-meter', {
  component: GForceMeterWidget,
  defaultTitle: 'G-Force Meter',
  defaultOptions: {},
  defaultState: { widgetSize: 300, maxG: 3 },
  description: 'Display lateral and longitudinal g-forces in a bubble diagram',
  category: 'Driving Data'
});

// Register Session Info Widget
WidgetRegistry.register('session-info', {
  component: SessionInfoWidget,
  defaultTitle: 'Session Info',
  defaultOptions: {},
  description: 'Display raw session information data from iRacing',
  category: 'Advanced'
});

// Register Number Widget
WidgetRegistry.register('number', {
  component: NumberWidget,
  defaultTitle: 'Number Display',
  defaultOptions: {},
  defaultState: {
    width: 480,
    height: 200,
    value: 50
  },
  description: 'Display a configurable number',
  category: 'Visualization'
});

// Register Basic Map Widget
WidgetRegistry.register('basic-map', {
  component: BasicMapWidget,
  defaultTitle: 'Basic Map',
  defaultOptions: {},
  defaultState: {
    width: 480,
    height: 300,
    mapBuildingState: 'idle'
  },
  description: 'Display a simple track map with car position',
  category: 'Visualization'
});

// Register Nearby Car Widget
WidgetRegistry.register('nearby-car', {
  component: NearbyCarWidget,
  defaultTitle: 'Nearby Car Indicator',
  defaultOptions: {},
  defaultState: {
    width: 200,
    height: 200,
    side: 'left'
  },
  description: 'Display indicator when cars are nearby on your selected side',
  category: 'Spotter Aids'
});

// Register Car Index Telemetry Widget
WidgetRegistry.register('car-index-telemetry', {
  component: CarIndexTelemetryWidget,
  defaultTitle: 'Car Data',
  defaultOptions: {},
  defaultState: {
    width: 250,
    height: 180,
    metric: 'CarIdxPosition',
    carIndex: 0,
    showAllCars: false
  },
  description: 'Display telemetry data for any car in the race',
  category: 'Race Data'
});



// Register Simple Race Telemetry Widget
WidgetRegistry.register('simple-race-telemetry', {
  component: SimpleRaceTelemetryWidget,
  defaultTitle: 'Race Telemetry',
  defaultOptions: {},
  defaultState: {
    width: 600,
    height: 400,
    widgetWidth: 600,
    selectedMetric: 'CarIdxPosition',
    sortBy: 'position',
    maxItems: 10,
    name: 'Race Telemetry',
    fontSize: 'text-sm',
    selectedColumns: [
      'position', 
      'carNumber', 
      'driverName', 
      'carClass', 
      'currentLap', 
      'bestLapTime',
      'lastLapTime', 
      'metricValue'
    ]
  },
  description: 'Display detailed race standings with customizable metrics for all cars',
  category: 'Race Data'
});

export default WidgetRegistry; 