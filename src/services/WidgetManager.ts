import { v4 as uuidv4 } from 'uuid';
import WidgetRegistry, { WidgetDefinition } from '../widgets/WidgetRegistry';

// Widget instance type
export interface WidgetInstance {
  id: string;
  type: string;
  title: string;
  options: Record<string, any>;
  state: Record<string, any>;
  enabled: boolean;
}

// Events that the WidgetManager can dispatch
export type WidgetManagerEvent = 
  | { type: 'widget:added', widget: WidgetInstance }
  | { type: 'widget:removed', widgetId: string }
  | { type: 'widget:updated', widget: WidgetInstance }
  | { type: 'widget:selected', widgetId: string | null }
  | { type: 'widget:state:updated', widgetId: string, state: Record<string, any> };

class WidgetManagerService {
  private widgets: Map<string, WidgetInstance> = new Map();
  private listeners: Array<(event: WidgetManagerEvent) => void> = [];
  private selectedWidgetId: string | null = null;

  // Subscribe to widget events
  subscribe(listener: (event: WidgetManagerEvent) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  // Dispatch an event to all listeners
  private dispatch(event: WidgetManagerEvent): void {
    this.listeners.forEach(listener => listener(event));
  }

  // Create a new widget
  createWidget(type: string, options: Record<string, any> = {}): string {
    const widgetDef = WidgetRegistry.get(type);
    if (!widgetDef) {
      throw new Error(`Widget type '${type}' is not registered`);
    }

    const id = options.id || `${type}-${uuidv4()}`;
    const widget: WidgetInstance = {
      id,
      type,
      title: options.title || widgetDef.defaultTitle,
      options: { ...widgetDef.defaultOptions, ...options },
      state: { ...widgetDef.defaultState || {}, ...(options.state || {}) },
      enabled: true
    };

    this.widgets.set(id, widget);
    this.dispatch({ type: 'widget:added', widget });
    return id;
  }

  // Remove a widget
  removeWidget(widgetId: string): boolean {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;

    this.widgets.delete(widgetId);
    this.dispatch({ type: 'widget:removed', widgetId });

    // Clear selection if this widget was selected
    if (this.selectedWidgetId === widgetId) {
      this.selectWidget(null);
    }

    return true;
  }

  // Update a widget's options
  updateWidget(widgetId: string, updates: Partial<WidgetInstance>): boolean {
    const widget = this.widgets.get(widgetId);
    if (!widget) return false;

    const updatedWidget = {
      ...widget,
      ...updates,
      options: { ...widget.options, ...(updates.options || {}) },
      state: { ...widget.state, ...(updates.state || {}) }
    };

    this.widgets.set(widgetId, updatedWidget);
    this.dispatch({ type: 'widget:updated', widget: updatedWidget });
    return true;
  }

  // Update a widget's state
  updateWidgetState(widgetId: string, state: Record<string, any>): boolean {
    console.log(`[WidgetManager] updateWidgetState called for widget ${widgetId} with state:`, state);
    
    const widget = this.widgets.get(widgetId);
    if (!widget) {
      console.warn(`[WidgetManager] Widget with ID ${widgetId} not found, creating new entry`);
      // If widget doesn't exist, create it as a placeholder
      const newWidget: WidgetInstance = {
        id: widgetId,
        type: 'unknown',
        title: 'Unknown',
        options: {},
        state,
        enabled: true
      };
      this.widgets.set(widgetId, newWidget);
      console.log(`[WidgetManager] Created placeholder widget for ${widgetId}:`, newWidget);
      this.dispatch({ 
        type: 'widget:state:updated', 
        widgetId, 
        state
      });
      return true;
    }

    const oldState = { ...widget.state };
    const updatedWidget = {
      ...widget,
      state: { ...widget.state, ...state }
    };

    console.log(`[WidgetManager] Widget ${widgetId} state before:`, oldState);
    console.log(`[WidgetManager] Widget ${widgetId} state after:`, updatedWidget.state);
    
    this.widgets.set(widgetId, updatedWidget);
    
    console.log(`[WidgetManager] Dispatching widget:state:updated event for ${widgetId} with state:`, state);
    console.log(`[WidgetManager] Number of listeners: ${this.listeners.length}`);
    console.log(`[WidgetManager] Listeners:`, this.listeners.map((_, i) => `Listener ${i}`));
    
    this.dispatch({ 
      type: 'widget:state:updated', 
      widgetId, 
      state: updatedWidget.state 
    });
    
    return true;
  }

  // Get a widget by ID
  getWidget(widgetId: string): WidgetInstance | undefined {
    return this.widgets.get(widgetId);
  }

  // Get all widgets
  getAllWidgets(): WidgetInstance[] {
    return Array.from(this.widgets.values());
  }

  // Get the currently selected widget
  getSelectedWidget(): WidgetInstance | null {
    return this.selectedWidgetId ? this.widgets.get(this.selectedWidgetId) || null : null;
  }

  // Select a widget
  selectWidget(widgetId: string | null): void {
    this.selectedWidgetId = widgetId;
    this.dispatch({ type: 'widget:selected', widgetId });
  }
}

// Create a singleton instance
export const WidgetManager = new WidgetManagerService();

// Export the manager
export default WidgetManager; 