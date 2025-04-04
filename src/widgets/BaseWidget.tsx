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
}

// Widget control overlay component
const WidgetControls: React.FC<{
  onClose: () => void;
}> = ({ onClose }) => {
  return (
    <div className="widget-controls absolute top-0 right-0 p-2 bg-gray-100 bg-opacity-80 rounded-bl-lg shadow-sm non-draggable z-10">
      <button 
        className="p-1 bg-red-500 text-white rounded hover:bg-red-600 text-xs"
        onClick={onClose}
      >
        ✕
      </button>
    </div>
  );
};

export abstract class BaseWidget<P extends BaseWidgetProps = BaseWidgetProps> extends React.Component<P, any> {
  constructor(props: P) {
    super(props);
    
    // Initialize the base state
    this.state = {
      visible: props.defaultVisible ?? true,
      opacity: props.defaultOpacity ?? 1,
      width: props.defaultWidth ?? 300,
      height: props.defaultHeight ?? 200,
      showingControls: false
    };
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