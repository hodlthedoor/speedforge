import { ComponentType } from 'react';
import { getComponentControls } from './WidgetRegistryAdapter';

// Define widget control types
export type WidgetControlType = 'button' | 'select' | 'slider' | 'toggle' | 'color-picker';

// Define widget control definition
export interface WidgetControlDefinition {
  id: string;
  type: WidgetControlType;
  label: string;
  value: any;
  options?: Array<{ value: any; label: string }>;
  conditional?: (widgetState: any) => boolean;
  onChange: (newValue: any) => void;
}

// Define base widget props that all widgets must support
export interface BaseWidgetProps {
  id: string;
  onClose: () => void;
}

// Define metadata for widget types
export interface WidgetDefinition {
  component: ComponentType<any>;
  defaultTitle: string;
  defaultOptions?: Record<string, any>;
  description: string;
  category?: string;
  getControls?: (widgetState: any, updateWidget: (updates: any) => void) => WidgetControlDefinition[];
}

// Create the registry as a Map
class WidgetRegistryClass {
  private registry: Map<string, WidgetDefinition> = new Map();

  // Register a new widget type
  register(type: string, definition: WidgetDefinition): void {
    if (this.registry.has(type)) {
      console.warn(`Widget type '${type}' is already registered. Overwriting.`);
    }
    this.registry.set(type, definition);
  }

  // Get a widget definition by type
  get(type: string): WidgetDefinition | undefined {
    return this.registry.get(type);
  }

  // Check if a widget type exists
  has(type: string): boolean {
    return this.registry.has(type);
  }

  // Get all registered widget types
  getAllTypes(): string[] {
    return Array.from(this.registry.keys());
  }

  // Get all widget definitions for UI presentation
  getAllDefinitions(): Record<string, WidgetDefinition> {
    const definitions: Record<string, WidgetDefinition> = {};
    this.registry.forEach((definition, type) => {
      definitions[type] = definition;
    });
    return definitions;
  }

  // Get controls for a specific widget instance
  getWidgetControls(
    type: string, 
    widgetState: any, 
    updateWidget: (updates: any) => void
  ): WidgetControlDefinition[] {
    console.log(`[WidgetRegistry] getWidgetControls called for type ${type} with state:`, widgetState);
    
    const definition = this.registry.get(type);
    if (!definition) {
      console.warn(`[WidgetRegistry] No definition found for widget type: ${type}`);
      return [];
    }
    
    // Get controls from the component itself
    console.log(`[WidgetRegistry] Getting controls from component for type: ${type}`);
    const componentControls = getComponentControls(
      definition.component,
      widgetState,
      updateWidget
    );
    
    if (componentControls.length > 0) {
      console.log(`[WidgetRegistry] Found ${componentControls.length} component controls for ${type}`);
      return componentControls;
    }
    
    // Fallback to definition.getControls if available (for backwards compatibility)
    if (definition.getControls) {
      console.log(`[WidgetRegistry] Using definition.getControls fallback for ${type}`);
      return definition.getControls(widgetState, updateWidget);
    }
    
    console.log(`[WidgetRegistry] No controls found for ${type}`);
    return [];
  }
}

// Create a singleton instance
export const WidgetRegistry = new WidgetRegistryClass();

// Export the registry
export default WidgetRegistry; 