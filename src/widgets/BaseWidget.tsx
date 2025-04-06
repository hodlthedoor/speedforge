/// <reference path="../types/electron.d.ts" />
import React from 'react';
import { WebSocketService } from '../services/WebSocketService';

export interface BaseWidgetProps {
  id: string;
  defaultVisible?: boolean;
  defaultOpacity?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  showControls?: boolean;
  webSocketService?: WebSocketService;
}

export interface WidgetState {
  visible: boolean;
  opacity: number;
  width: number;
  height: number;
  showingControls: boolean;
  telemetryData?: any;
  connected: boolean;
}

interface WidgetControls {
  onClose: () => void;
}

// Simple controls component for widgets
const WidgetControls: React.FC<WidgetControls> = ({ onClose }) => {
  return (
    <div className="widget-controls absolute top-0 right-0 z-10 p-1">
      <button 
        className="close-btn bg-red-500 hover:bg-red-700 text-white rounded-full w-6 h-6 flex items-center justify-center"
        onClick={onClose}
      >
        ×
      </button>
    </div>
  );
};

export abstract class BaseWidget<P extends BaseWidgetProps = BaseWidgetProps> extends React.Component<P, any> {
  // Use the WebSocketService instead of creating a new WebSocket
  private webSocketService: WebSocketService;
  
  constructor(props: P) {
    super(props);
    
    // Get or create the WebSocketService instance
    this.webSocketService = props.webSocketService || WebSocketService.getInstance();
    
    // Initialize the base state
    this.state = {
      visible: props.defaultVisible ?? true,
      opacity: props.defaultOpacity ?? 1,
      width: props.defaultWidth ?? 300,
      height: props.defaultHeight ?? 200,
      showingControls: false,
      telemetryData: null,
      connected: false
    };
  }
  
  componentDidMount() {
    // Register listeners with the WebSocketService
    this.webSocketService.addDataListener(this.props.id, this.handleTelemetryData);
    this.webSocketService.addConnectionListener(this.props.id, this.handleConnectionChange);
    
    // Listen for parameter updates from the main process
    if (window.electronAPI) {
      console.log(`Widget ${this.props.id}: Setting up widget:params listener`);
      window.electronAPI.on('widget:params', (params) => {
        console.log(`Widget ${this.props.id}: Received widget:params event:`, params);
        this.handleParamsUpdate(params);
      });
    } else {
      console.warn(`Widget ${this.props.id}: electronAPI not available`);
    }
  }
  
  componentWillUnmount() {
    // Remove listeners from the WebSocketService
    this.webSocketService.removeListeners(this.props.id);
    
    // Remove parameter update listener
    if (window.electronAPI) {
      window.electronAPI.removeAllListeners('widget:params');
    }
    
    // Log widget unmounting for debugging
    console.log(`Widget ${this.props.id} unmounting and cleaning up resources`);
  }
  
  // Handle parameter updates from the main process
  handleParamsUpdate = (params: Record<string, any>) => {
    // This method can be overridden by child widgets to handle specific parameters
    console.log(`BaseWidget ${this.props.id} received parameter update:`, params);
    console.log(`BaseWidget instance:`, this);
    
    // The base implementation does nothing with the params
    // Child widgets can use componentDidUpdate to respond to prop changes
  }

  // Handle telemetry data from the WebSocketService
  handleTelemetryData = (data: any) => {
    this.setState({ telemetryData: data });
    this.onTelemetryDataReceived(data);
  }
  
  // Handle connection status changes from the WebSocketService
  handleConnectionChange = (connected: boolean) => {
    this.setState({ connected });
  }
  
  // Method that can be overridden by widgets to handle new telemetry data
  protected onTelemetryDataReceived(data: any) {
    // Default implementation does nothing, widgets can override
  }

  setVisibility = (visible: boolean) => {
    this.setState({ visible });
    
    // When using in Electron, notify the main process
    if (window.electronAPI) {
      window.electronAPI.widgets.setVisible(this.props.id, visible);
    }
  };

  setOpacity = (opacity: number) => {
    opacity = Math.max(0.1, Math.min(1, opacity));
    this.setState({ opacity });
    
    // When using in Electron, notify the main process
    if (window.electronAPI) {
      window.electronAPI.widgets.setOpacity(this.props.id, opacity);
    }
  };

  setSize = (width: number, height: number) => {
    this.setState({ width, height });
  };
  
  closeWidget = () => {
    // When using in Electron, close the widget window
    if (window.electronAPI) {
      window.electronAPI.widgets.close(this.props.id);
    }
  };
  
  toggleControls = () => {
    this.setState(prevState => ({ 
      showingControls: !prevState.showingControls 
    }));
  };

  abstract renderContent(): React.ReactNode;

  render() {
    const { visible, opacity, width, height, showingControls } = this.state;
    const { showControls = true } = this.props;

    if (!visible) return null;

    return (
      <div 
        className="widget-container rounded-lg overflow-hidden bg-gray-800 text-white draggable relative"
        style={{ 
          opacity, 
          width: `${width}px`, 
          height: `${height}px`,
          transition: 'opacity 0.3s',
        }}
        onDoubleClick={this.toggleControls}
      >
        {showControls && showingControls && (
          <WidgetControls
            onClose={this.closeWidget}
          />
        )}
        {this.renderContent()}
      </div>
    );
  }
} 