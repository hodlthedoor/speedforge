import WidgetRegistry, { WidgetControlType } from './WidgetRegistry';
import TrackMapWidget from '../components/TrackMapWidget';
import { SimpleTelemetryWidget } from '../components/SimpleTelemetryWidget';
import PedalTraceWidget from '../components/PedalTraceWidget';
import ShiftIndicatorWidget from '../components/ShiftIndicatorWidget';

// Register Track Map Widget
WidgetRegistry.register('track-map', {
  component: TrackMapWidget,
  defaultTitle: 'Track Map',
  defaultOptions: {
    colorMode: 'none'
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

export default WidgetRegistry; 