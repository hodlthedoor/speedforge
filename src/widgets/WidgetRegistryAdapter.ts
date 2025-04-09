import React from 'react';
import { WidgetControlDefinition } from './WidgetRegistry';

/**
 * Make a component's getControls method available statically
 * This allows function components to provide controls to the widget registry
 */
export function withControls<P extends {}>(
  Component: React.FC<P>,
  getControls: (widgetState: any, updateWidget: (updates: any) => void) => WidgetControlDefinition[]
): React.FC<P> & { getControls: typeof getControls } {
  // Create a wrapper component that maintains the original component's behavior
  const WrappedComponent: React.FC<P> & { getControls?: typeof getControls } = (props: P) => {
    return React.createElement(Component, props);
  };
  
  // Add the static getControls method
  WrappedComponent.getControls = getControls;
  
  return WrappedComponent as React.FC<P> & { getControls: typeof getControls };
}

/**
 * Register a component's controls directly with the prototype
 * This is used to manually add controls when registering a component
 */
export function registerComponentControls<T extends React.ComponentType<any>>(
  ComponentClass: T,
  getControls: (widgetState: any, updateWidget: (updates: any) => void) => WidgetControlDefinition[]
): T {
  const anyComponent = ComponentClass as any;
  anyComponent.prototype.getControls = getControls;
  return ComponentClass;
}

/**
 * Get controls from a component, either from static method or prototype
 */
export function getComponentControls(
  Component: React.ComponentType<any>,
  widgetState: any,
  updateWidget: (updates: any) => void
): WidgetControlDefinition[] {
  // Check for static getControls method
  if ((Component as any).getControls) {
    // Static getControls - passed from withControls - has parameters
    return (Component as any).getControls(widgetState, updateWidget);
  }
  
  // For class components that extend BaseWidget and override getControls without parameters,
  // we need to create an instance with mock props and state
  if (Component.prototype?.getControls) {
    try {
      // Check if it's a BaseWidget with parameter-less getControls
      const isBaseWidgetSubclass = Component.prototype instanceof React.Component;
      
      if (isBaseWidgetSubclass) {
        // Create a mock instance to call the parameter-less getControls
        const mockProps = { id: 'mock-id', onClose: () => {} };
        // @ts-ignore - We're intentionally creating a partial instance for testing
        const instance = new Component(mockProps);
        
        // Set state directly since setState won't work without mounting
        instance.state = widgetState;
        
        // Store the updateWidget function for the instance to use if needed
        (instance as any)._updateWidget = updateWidget;
        
        // Call the parameter-less getControls
        return instance.getControls();
      } else {
        // For non-BaseWidget components, try the old way with parameters
        return Component.prototype.getControls(widgetState, updateWidget);
      }
    } catch (error) {
      console.error('Error getting controls from component:', error);
      return [];
    }
  }
  
  // No controls found
  return [];
} 