import React, { useEffect, useState } from 'react';
import { BaseWidgetProps, WidgetControlDefinition } from './WidgetRegistry';
import WidgetManager from '../services/WidgetManager';

// Base props that all widgets must accept
export interface WidgetProps extends BaseWidgetProps {
  // Any additional props that all widgets should accept
}

// Generic interface to define widget state
export interface WidgetState {
  [key: string]: any;
}

// The base widget component class
abstract class BaseWidget<P extends WidgetProps, S extends WidgetState> extends React.Component<P, S> {
  // Register the widget component's state with the WidgetManager
  componentDidMount() {
    // Update the widget manager with the initial state
    WidgetManager.updateWidgetState(this.props.id, this.state);
  }

  // Update the widget manager when state changes
  componentDidUpdate(prevProps: P, prevState: S) {
    if (prevState !== this.state) {
      WidgetManager.updateWidgetState(this.props.id, this.state);
    }
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

// React hook for functional components to update their widget state
export function useWidgetState<T extends WidgetState>(
  widgetId: string, 
  initialState: T
): [T, (updates: Partial<T>) => void] {
  const [state, setState] = useState<T>(initialState);
  
  // Update the widget manager when state changes
  useEffect(() => {
    WidgetManager.updateWidgetState(widgetId, state);
  }, [widgetId, state]);
  
  // Create a function to update state
  const updateState = (updates: Partial<T>) => {
    setState(prev => ({ ...prev, ...updates }));
  };
  
  return [state, updateState];
}

// React hook to get controls for a widget
export function useWidgetControls(
  widgetId: string,
  controls: WidgetControlDefinition[]
): WidgetControlDefinition[] {
  // Register controls with the widget manager
  useEffect(() => {
    // This could be expanded to register controls with the manager if needed
  }, [widgetId, controls]);
  
  return controls;
}

export default BaseWidget; 