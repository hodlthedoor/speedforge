/// <reference path="../types/electron.d.ts" />
import React from 'react';

export interface BaseWidgetProps {
  id: string;
  defaultVisible?: boolean;
  defaultOpacity?: number;
  defaultWidth?: number;
  defaultHeight?: number;
  showControls?: boolean;
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
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  
  constructor(props: P) {
    super(props);
    
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
    // Connect to telemetry WebSocket
    this.connectWebSocket();
    
    // Listen for parameter updates from the main process
    if (window.electronAPI) {
      window.electronAPI.on('widget:params', this.handleParamsUpdate);
    }
  }
  
  componentWillUnmount() {
    this.disconnectWebSocket();
    // Clear any reconnect timer
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
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
    console.log('Widget received parameter update:', params);
    
    // The base implementation does nothing with the params
    // Child widgets can use componentDidUpdate to respond to prop changes
  }

  connectWebSocket = () => {
    const wsUrl = 'ws://localhost:8080';
    
    try {
      this.ws = new WebSocket(wsUrl);
      
      this.ws.onopen = () => {
        console.log('Connected to telemetry WebSocket');
        this.setState({ connected: true });
      };
      
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.setState({ telemetryData: data });
          this.onTelemetryDataReceived(data);
        } catch (error) {
          console.error('Failed to parse telemetry data:', error);
        }
      };
      
      this.ws.onclose = () => {
        console.log('Disconnected from telemetry WebSocket');
        this.setState({ connected: false });
        
        // Try to reconnect after a delay
        this.reconnectTimer = window.setTimeout(() => {
          this.connectWebSocket();
        }, 3000);
      };
      
      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.ws?.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  };

  disconnectWebSocket = () => {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  };
  
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
        className="widget-container rounded-lg overflow-hidden bg-white draggable relative"
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