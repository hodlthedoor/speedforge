import { WidgetInstance } from '../services/WidgetManager';
import WidgetManager from '../services/WidgetManager';
import type { ElectronConfigAPI } from '../types/electron';

export interface WidgetLayout {
  id: string;
  type: string;
  title: string;
  position: { x: number, y: number };
  state: Record<string, any>;
  options: Record<string, any>;
  opacity?: number;
  isBackgroundTransparent?: boolean;
  enabled: boolean;
}

export interface PanelConfig {
  name: string;
  displayId: number;
  widgets: WidgetLayout[];
  lastModified: string; // ISO date string
}

export class ConfigService {
  private static instance: ConfigService;
  private configPath: string = '';
  private currentDisplayId: number | null = null;
  private electronAPI: ElectronConfigAPI | undefined;
  private widgetManager: typeof WidgetManager;
  private configDirectory = '';

  constructor() {
    this.widgetManager = WidgetManager;
    this.electronAPI = window.electronAPI;
    console.log('ConfigService initialized');
    
    // Use default values for immediate rendering even before electronAPI is available
    this.configPath = '';
    this.currentDisplayId = 1; // Default to display 1
    
    // Initialize with electron's app.getPath to get the proper user data folder
    if (this.electronAPI) {
      try {
        // Use type assertions to access methods
        const api = this.electronAPI as any;
        if (api.app && typeof api.app.getUserDataPath === 'function') {
          api.app.getUserDataPath().then((path: string) => {
            this.configPath = path;
            console.log('ConfigService: Set user data path to', path);
          }).catch((err: Error) => {
            console.error('Error getting user data path:', err);
          });
        }

        // Get the current display ID
        if (api.app && typeof api.app.getCurrentDisplayId === 'function') {
          api.app.getCurrentDisplayId().then((response: any) => {
            console.log('ConfigService: getCurrentDisplayId response:', response);
            if (response.success && response.displayId) {
              console.log(`ConfigService: Set current display ID to ${response.displayId}`);
              this.currentDisplayId = response.displayId;
            }
          }).catch((err: Error) => {
            console.error('Error getting current display ID:', err);
          });
        }

        // Listen for display ID changes
        if (typeof api.on === 'function') {
          api.on('display:id', (displayId: number) => {
            console.log(`ConfigService: Received display:id event, updating to ${displayId}`);
            this.currentDisplayId = displayId;
          });
        }
      } catch (error) {
        console.error('Error initializing ConfigService:', error);
      }
    } else {
      console.warn('ConfigService: electronAPI not available in this context');
    }
  }

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  // Get current display ID
  getCurrentDisplayId(): number | null {
    return this.currentDisplayId;
  }

  // Save the current panel configuration for the current display
  async savePanelConfig(name: string, widgets: WidgetInstance[]): Promise<boolean> {
    try {
      if (!this.electronAPI || this.currentDisplayId === null) {
        console.error('Cannot save panel config: electronAPI not available or currentDisplayId is null');
        return false;
      }
      
      console.log(`Saving panel config "${name}" with ${widgets.length} widgets for display ${this.currentDisplayId}`);
      
      const layout: WidgetLayout[] = widgets.map(widget => {
        const position = this.getWidgetPosition(widget.id);
        const opacity = this.getWidgetOpacity(widget.id);
        const isTransparent = this.isWidgetBackgroundTransparent(widget.id);
        
        console.log(`  Widget ${widget.id} (${widget.type}): position=${JSON.stringify(position)}, opacity=${opacity}, transparent=${isTransparent}`);
        
        return {
          id: widget.id,
          type: widget.type,
          title: widget.title,
          position: position,
          state: widget.state || {},
          options: widget.options || {},
          opacity: opacity,
          isBackgroundTransparent: isTransparent,
          enabled: widget.enabled
        };
      });

      const config: PanelConfig = {
        name,
        displayId: this.currentDisplayId,
        widgets: layout,
        lastModified: new Date().toISOString()
      };

      // Use display ID as part of the configuration key
      console.log('Saving config via electronAPI', {
        type: 'panel',
        key: `${this.currentDisplayId}_${name}`,
        configSize: JSON.stringify(config).length
      });
      
      // Use type assertion to access the config API
      const api = this.electronAPI;
      if (api.config && typeof api.config.saveConfig === 'function') {
        const result = await api.config.saveConfig(
          'panel', 
          `${this.currentDisplayId}_${name}`, 
          config
        );
        
        console.log(`Save result: ${result}`);
        return result;
      } else {
        console.error('electronAPI.config.saveConfig is not available');
        return false;
      }
    } catch (error) {
      console.error('Failed to save panel config:', error);
      return false;
    }
  }

  // Load a panel configuration for the current display
  async loadPanelConfig(name: string): Promise<PanelConfig | null> {
    try {
      if (!this.electronAPI || this.currentDisplayId === null) {
        console.error('Cannot load panel config: electronAPI not available or currentDisplayId is null');
        return null;
      }
      
      console.log(`Loading panel config "${name}" for display ${this.currentDisplayId}`);
      
      // Use type assertion
      const api = this.electronAPI;
      if (!api.config || typeof api.config.loadConfig !== 'function') {
        console.error('electronAPI.config.loadConfig is not available');
        return null;
      }
      
      // First try to load a display-specific config
      const displaySpecificKey = `${this.currentDisplayId}_${name}`;
      console.log(`Trying to load display-specific config with key: "${displaySpecificKey}"`);
      
      let config = await api.config.loadConfig('panel', displaySpecificKey);
      
      // If no display-specific config exists, try the generic name
      if (!config) {
        console.log(`No display-specific config found, trying generic name: "${name}"`);
        config = await api.config.loadConfig('panel', name);
      }
      
      if (config) {
        console.log(`Successfully loaded config with ${config.widgets?.length || 0} widgets`);
      } else {
        console.log(`No config found for name: "${name}"`);
      }
      
      return config;
    } catch (error) {
      console.error('Failed to load panel config:', error);
      return null;
    }
  }

  // List available panel configurations for the current display
  async listPanelConfigs(): Promise<string[]> {
    try {
      if (!this.electronAPI || this.currentDisplayId === null) {
        console.error('Cannot list panel configs: electronAPI not available or currentDisplayId is null');
        return [];
      }
      
      console.log(`Listing panel configs for display ${this.currentDisplayId}`);
      
      // Check if config API is available
      const api = this.electronAPI;
      if (!api.config || typeof api.config.listConfigs !== 'function') {
        console.error('electronAPI.config.listConfigs is not available');
        return [];
      }
      
      // Get all configs
      console.log('Calling api.config.listConfigs("panel")');
      const allConfigs = await api.config.listConfigs('panel');
      console.log(`Retrieved ${allConfigs?.length || 0} total configs:`, allConfigs);
      
      // Filter to only include configs for this display or generic configs
      const displayPrefix = `${this.currentDisplayId}_`;
      const filteredConfigs = allConfigs
        .filter((name: string) => name.startsWith(displayPrefix))
        .map((name: string) => name.substring(displayPrefix.length));
      
      console.log(`Filtered to ${filteredConfigs.length} configs for display ${this.currentDisplayId}:`, filteredConfigs);
      return filteredConfigs;
    } catch (error) {
      console.error('Failed to list panel configs:', error);
      return [];
    }
  }

  // Delete a panel configuration
  async deletePanelConfig(name: string): Promise<boolean> {
    try {
      if (!this.electronAPI || this.currentDisplayId === null) {
        console.error('Cannot delete panel config: electronAPI not available or currentDisplayId is null');
        return false;
      }
      
      console.log(`Deleting panel config "${name}" for display ${this.currentDisplayId}`);
      
      // Use type assertion to access the config API
      const api = this.electronAPI;
      if (!api.config || typeof api.config.deleteConfig !== 'function') {
        console.error('electronAPI.config.deleteConfig is not available');
        return false;
      }
      
      // Delete the display-specific config
      const displaySpecificKey = `${this.currentDisplayId}_${name}`;
      console.log(`Deleting config with key: "${displaySpecificKey}"`);
      
      const result = await api.config.deleteConfig('panel', displaySpecificKey);
      console.log(`Delete result: ${result}`);
      
      return result;
    } catch (error) {
      console.error('Failed to delete panel config:', error);
      return false;
    }
  }

  // Helper methods to get widget properties
  private getWidgetPosition(widgetId: string): { x: number, y: number } {
    // Try to get position from DOM using data-widget-id attribute first
    try {
      // Find the draggable container that contains this widget
      const container = document.querySelector(`[data-widget-id="${widgetId}"]`);
      if (container) {
        // The container itself has the position we need
        const parentContainer = container.closest('div');
        if (parentContainer) {
          const style = window.getComputedStyle(parentContainer);
          const left = parseInt(style.left, 10);
          const top = parseInt(style.top, 10);
          
          if (!isNaN(left) && !isNaN(top)) {
            console.log(`Found position for widget ${widgetId}: x=${left}, y=${top}`);
            return { x: left, y: top };
          }
        }
      }
      
      // Fallback: Check any element that might contain the widget ID
      const widgetElements = document.querySelectorAll(`[id="${widgetId}"]`);
      for (let i = 0; i < widgetElements.length; i++) {
        const element = widgetElements[i];
        const parentContainer = element.closest('div[style*="position: absolute"]');
        
        if (parentContainer) {
          const style = window.getComputedStyle(parentContainer);
          const left = parseInt(style.left, 10);
          const top = parseInt(style.top, 10);
          
          if (!isNaN(left) && !isNaN(top)) {
            console.log(`Fallback: Found position for widget ${widgetId}: x=${left}, y=${top}`);
            return { x: left, y: top };
          }
        }
      }
      
      console.warn(`Could not find position for widget ${widgetId}, using default`);
      return { x: 100 + Math.random() * 300, y: 100 + Math.random() * 200 };
    } catch (error) {
      console.error(`Error getting position for widget ${widgetId}:`, error);
      return { x: 50, y: 50 };
    }
  }

  private getWidgetOpacity(widgetId: string): number {
    // Get opacity from DOM or stored state
    const element = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (element) {
      const opacity = window.getComputedStyle(element).opacity;
      return opacity ? parseFloat(opacity) : 1.0;
    }
    return 1.0; // Default
  }

  private isWidgetBackgroundTransparent(widgetId: string): boolean {
    // First check the DOM element with data-widget-id
    const element = document.querySelector(`[data-widget-id="${widgetId}"]`);
    if (element) {
      // Check for the data-bg-transparent attribute first
      const dataAttr = element.getAttribute('data-bg-transparent');
      if (dataAttr === 'true') {
        console.log(`[ConfigService] Found transparent widget ${widgetId} from data-bg-transparent attribute`);
        return true;
      }
      
      // Also check if the element has the bg-transparent class
      if (element.classList.contains('bg-transparent')) {
        console.log(`[ConfigService] Found transparent widget ${widgetId} from bg-transparent class`);
        return true;
      }
    }
    
    return false; // Default to non-transparent
  }
}

export default ConfigService; 