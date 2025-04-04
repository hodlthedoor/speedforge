import React, { useState } from 'react';

export interface BaseWidgetProps {
  id: string;
  defaultVisible?: boolean;
  defaultOpacity?: number;
  defaultWidth?: number;
  defaultHeight?: number;
}

export interface WidgetState {
  visible: boolean;
  opacity: number;
  width: number;
  height: number;
}

export abstract class BaseWidget<P extends BaseWidgetProps = BaseWidgetProps> extends React.Component<P, WidgetState> {
  constructor(props: P) {
    super(props);
    this.state = {
      visible: props.defaultVisible ?? true,
      opacity: props.defaultOpacity ?? 1,
      width: props.defaultWidth ?? 300,
      height: props.defaultHeight ?? 200
    };
  }

  setVisibility = (visible: boolean) => {
    this.setState({ visible });
  };

  setOpacity = (opacity: number) => {
    this.setState({ opacity: Math.max(0, Math.min(1, opacity)) });
  };

  setSize = (width: number, height: number) => {
    this.setState({ width, height });
  };

  abstract renderContent(): React.ReactNode;

  render() {
    const { visible, opacity, width, height } = this.state;

    if (!visible) return null;

    return (
      <div 
        className="widget-container rounded-lg overflow-hidden bg-white"
        style={{ 
          opacity, 
          width: `${width}px`, 
          height: `${height}px`,
          transition: 'opacity 0.3s',
        }}
      >
        {this.renderContent()}
      </div>
    );
  }
} 