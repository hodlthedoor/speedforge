import React from 'react';
import { WidgetType, WidgetDefinition, WidgetProps } from '../types/widget';

// Map to store widget registrations
const widgetRegistry: Map<WidgetType, WidgetDefinition> = new Map();

// Register a widget type
export function registerWidget(definition: WidgetDefinition): void {
  widgetRegistry.set(definition.type, definition);
  console.log(`Registered widget type: ${definition.type}`);
}

// Get all registered widget definitions
export function getWidgetDefinitions(): WidgetDefinition[] {
  return Array.from(widgetRegistry.values());
}

// Get a specific widget definition
export function getWidgetDefinition(type: WidgetType): WidgetDefinition | undefined {
  return widgetRegistry.get(type);
}

// Create a new widget instance with default values
export function createWidget(
  type: WidgetType, 
  id: string, 
  x: number, 
  y: number, 
  params?: Record<string, any>
): any {
  const definition = widgetRegistry.get(type);
  
  if (!definition) {
    throw new Error(`Widget type not registered: ${type}`);
  }
  
  return {
    id,
    type,
    x,
    y,
    width: definition.defaultWidth,
    height: definition.defaultHeight,
    params: { ...definition.defaultParams, ...params },
    visible: true,
    alwaysOnTop: false,
    opacity: 1.0
  };
}

// Component to render a widget by type
export const WidgetRenderer: React.FC<WidgetProps & { type: WidgetType }> = ({ type, ...props }) => {
  const definition = widgetRegistry.get(type);
  
  if (!definition) {
    return (
      <div className="error-widget bg-red-500 text-white p-4 rounded">
        Unknown widget type: {type}
      </div>
    );
  }
  
  const WidgetComponent = definition.component;
  return <WidgetComponent {...props} />;
}; 