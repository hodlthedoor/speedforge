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
  console.log(`[WidgetRegistryAdapter] withControls called for component: ${Component.displayName || Component.name || 'unnamed'}`);
  
  // Create a wrapper component that maintains the original component's behavior
  const WrappedComponent: React.FC<P> & { getControls?: typeof getControls } = (props: P) => {
    return React.createElement(Component, props);
  };
  
  // Add the static getControls method
  WrappedComponent.getControls = (widgetState: any, updateWidgetFn: (updates: any) => void) => {
    console.log(`[WidgetRegistryAdapter] WrappedComponent.getControls called with widgetState:`, widgetState);
    const result = getControls(widgetState, updateWidgetFn);
    console.log(`[WidgetRegistryAdapter] WrappedComponent.getControls returned:`, result);
    return result;
  };
  
  // Copy display name for better debugging
  WrappedComponent.displayName = `withControls(${Component.displayName || Component.name || 'Component'})`;
  
  console.log(`[WidgetRegistryAdapter] Created wrapped component with getControls: ${!!WrappedComponent.getControls}`);
  
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
  console.log(`[WidgetRegistryAdapter] getComponentControls called for Component:`, Component.name || 'unnamed');
  console.log(`[WidgetRegistryAdapter] Widget state:`, widgetState);
  
  // Check for static getControls method
  if ((Component as any).getControls) {
    console.log(`[WidgetRegistryAdapter] Found static getControls method`);
    // Static getControls - passed from withControls - has parameters
    const controls = (Component as any).getControls(widgetState, updateWidget);
    console.log(`[WidgetRegistryAdapter] Static getControls returned ${controls?.length || 0} controls`);
    return controls;
  }
  
  // For class components that extend BaseWidget and override getControls without parameters,
  // we need to create an instance with mock props and state
  if (Component.prototype?.getControls) {
    console.log(`[WidgetRegistryAdapter] Found prototype getControls method`);
    
    try {
      // Check if it's a BaseWidget with parameter-less getControls
      const isBaseWidgetSubclass = Component.prototype instanceof React.Component;
      
      if (isBaseWidgetSubclass) {
        console.log(`[WidgetRegistryAdapter] Component is a BaseWidget subclass, creating mock instance`);
        
        // Create a mock instance to call the parameter-less getControls
        const mockProps = { id: 'mock-id', onClose: () => {} };
        // @ts-ignore - We're intentionally creating a partial instance for testing
        const instance = new Component(mockProps);
        
        // Set state directly since setState won't work without mounting
        instance.state = widgetState;
        
        // Store the updateWidget function for the instance to use if needed
        (instance as any)._updateWidget = updateWidget;
        
        // Call the parameter-less getControls
        const controls = instance.getControls();
        console.log(`[WidgetRegistryAdapter] BaseWidget getControls returned ${controls?.length || 0} controls`);
        return controls;
      } else {
        console.log(`[WidgetRegistryAdapter] Component has prototype getControls but is not a BaseWidget, using with parameters`);
        
        // For non-BaseWidget components, try the old way with parameters
        const controls = Component.prototype.getControls(widgetState, updateWidget);
        console.log(`[WidgetRegistryAdapter] Prototype getControls returned ${controls?.length || 0} controls`);
        return controls;
      }
    } catch (error) {
      console.error('[WidgetRegistryAdapter] Error getting controls from component:', error);
      return [];
    }
  }
  
  console.log(`[WidgetRegistryAdapter] No controls found for component`);
  // No controls found
  return [];
} 