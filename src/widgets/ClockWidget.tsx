/// <reference path="../types/electron.d.ts" />
import React from 'react';
import { BaseWidget, BaseWidgetProps } from './BaseWidget';
import { withWidgetRegistration } from './WidgetManager';

// Extend the WidgetState to include time property
declare module './BaseWidget' {
  interface WidgetState {
    time?: Date;
  }
}

interface ClockWidgetProps extends BaseWidgetProps {
  format24h?: boolean;
}

class ClockWidgetBase extends BaseWidget<ClockWidgetProps> {
  private timerID: NodeJS.Timeout | null = null;

  constructor(props: ClockWidgetProps) {
    super(props);
    // Initialize the time property in the state
    this.state = {
      ...this.state,
      time: new Date()
    };
  }

  componentDidMount() {
    this.timerID = setInterval(() => {
      this.setState({ time: new Date() });
    }, 1000);
  }

  componentWillUnmount() {
    if (this.timerID) {
      clearInterval(this.timerID);
    }
  }

  formatTime() {
    const time = this.state.time || new Date();
    const { format24h } = this.props;
    
    let hours = time.getHours();
    const minutes = time.getMinutes().toString().padStart(2, '0');
    const seconds = time.getSeconds().toString().padStart(2, '0');
    
    if (!format24h) {
      const period = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      return `${hours}:${minutes}:${seconds} ${period}`;
    }
    
    return `${hours.toString().padStart(2, '0')}:${minutes}:${seconds}`;
  }

  renderContent() {
    const time = this.state.time || new Date();
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-4xl font-bold">{this.formatTime()}</div>
        <div className="text-md mt-2">{time.toDateString()}</div>
      </div>
    );
  }
}

export const ClockWidget = withWidgetRegistration<ClockWidgetProps>(ClockWidgetBase, 'clock'); 