import WidgetRegistry, { WidgetControlType } from './WidgetRegistry';
import TrackMapWidget from '../components/TrackMapWidget';
import { SimpleTelemetryWidget } from '../components/SimpleTelemetryWidget';
import PedalTraceWidget from '../components/PedalTraceWidget';
import ShiftIndicatorWidget from '../components/ShiftIndicatorWidget';
import GearShiftWidget from '../components/GearShiftWidget';
import CarLeftIndicatorWidget from '../components/CarLeftIndicatorWidget';
import CarRightIndicatorWidget from '../components/CarRightIndicatorWidget';
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

// Register Track Map Widget
WidgetRegistry.register('track-map', {
  component: TrackMapWidget,
  defaultTitle: 'Track Map',
  defaultOptions: {
    colorMode: 'none'
  },
  defaultState: {
    width: 550,
    height: 300,
    colorMode: 'none',
    mapBuildingState: 'idle'
  },
  description: 'Visualize the race track and car position',
  category: 'Visualization'
});

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

// Register Gear Shift Widget
WidgetRegistry.register('gear-shift', {
  component: GearShiftWidget,
  defaultTitle: 'Gear Shift Indicator',
  defaultOptions: { width: 300 },
  description: 'Display a gear shift indicator bar that transitions from green to amber to red based on telemetry data',
  category: 'Driving Aids'
});

// Register Car Left Indicator Widget
WidgetRegistry.register('car-left-indicator', {
  component: CarLeftIndicatorWidget,
  defaultTitle: 'Car Left',
  defaultOptions: {},
  description: 'Display indicator when cars are to your left',
  category: 'Spotter Aids'
});

// Register Car Right Indicator Widget
WidgetRegistry.register('car-right-indicator', {
  component: CarRightIndicatorWidget,
  defaultTitle: 'Car Right',
  defaultOptions: {},
  description: 'Display indicator when cars are to your right',
  category: 'Spotter Aids'
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

// Register Race Position Widget
WidgetRegistry.register('race-positions', {
  component: RacePositionWidget,
  defaultTitle: 'Race Positions',
  defaultOptions: {},
  defaultState: {
    width: 300,
    height: 400,
    highlightPlayerCar: true,
    maxCarsToShow: 20
  },
  description: 'Display race positions and gaps for all cars',
  category: 'Race Data'
});

// Register Track Position Widget
WidgetRegistry.register('track-positions', {
  component: TrackPositionWidget,
  defaultTitle: 'Track Map',
  defaultOptions: {},
  defaultState: {
    width: 350,
    height: 250
  },
  description: 'Visualize car positions on the track',
  category: 'Race Data'
});

// Register Simple Race Telemetry Widget
WidgetRegistry.register('simple-race-telemetry', {
  component: SimpleRaceTelemetryWidget,
  defaultTitle: 'Race Standings',
  defaultOptions: {},
  defaultState: {
    width: 600,
    height: 400,
    selectedMetric: 'CarIdxLastLapTime',
    sortBy: 'position',
    showDetails: true,
    highlightClass: true,
    maxItems: 20
  },
  description: 'Display detailed race standings with customizable metrics for all cars',
  category: 'Race Data'
});

export default WidgetRegistry; 