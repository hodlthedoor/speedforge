import React from 'react';
import { BaseWidgetProps } from './WidgetRegistry';
import { WidgetControlDefinition } from './WidgetRegistry';

// Generic interface to define widget state
export interface WidgetState {
  [key: string]: any;
}

// The base widget component class
abstract class BaseWidget<P extends BaseWidgetProps, S extends WidgetState> extends React.Component<P, S> {
  // Register the widget component's state with the WidgetManager
  componentDidMount() {
    // Update widget state if needed
  }

  // Override this method to provide widget-specific controls
  getControls(): WidgetControlDefinition[] {
    return [];
  }

  // Utility to safely update state
  protected safeSetState(state: Partial<S>, callback?: () => void) {
    this.setState(state as S, callback);
  }
}

export default BaseWidget; 