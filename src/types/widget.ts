export enum WidgetType {
  CLOCK = 'CLOCK',
  TELEMETRY = 'TELEMETRY',
  WEATHER = 'WEATHER',
  TRACE = 'TRACE',
  PEDAL_TRACE = 'PEDAL_TRACE',
  CUSTOM = 'CUSTOM'
}

export interface WidgetProps {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  params?: Record<string, any>;
  opacity?: number;
  alwaysOnTop?: boolean;
  visible?: boolean;
  onClose?: () => void;
  onMove?: (x: number, y: number) => void;
  onResize?: (width: number, height: number) => void;
  onParamsUpdate?: (params: Record<string, any>) => void;
  onVisibilityChange?: (visible: boolean) => void;
  onOpacityChange?: (opacity: number) => void;
  onAlwaysOnTopChange?: (alwaysOnTop: boolean) => void;
}

export interface WidgetDefinition {
  type: WidgetType;
  label: string;
  description: string;
  defaultWidth: number;
  defaultHeight: number;
  defaultParams?: Record<string, any>;
  component: React.ComponentType<WidgetProps>;
} 