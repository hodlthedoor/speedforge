/**
 * Types for widget controls that can be used with the ControlPanel
 */

export type SelectOption = {
  value: string;
  label: string;
};

export type WidgetControlDefinition = 
  | {
      id: string;
      type: 'select';
      label: string;
      value: string;
      options: SelectOption[];
      onChange: (value: string) => void;
    }
  | {
      id: string;
      type: 'toggle';
      label: string;
      value: boolean;
      onChange: (value: boolean) => void;
    }
  | {
      id: string;
      type: 'slider';
      label: string;
      min: number;
      max: number;
      step: number;
      value: number;
      onChange: (value: number) => void;
    }
  | {
      id: string;
      type: 'color';
      label: string;
      value: string;
      onChange: (value: string) => void;
    };

// Type for a component with controls attached
export type ComponentWithControls<P> = React.FC<P> & {
  getControls: (widgetState: any, updateWidget: (updates: any) => void) => WidgetControlDefinition[];
}; 