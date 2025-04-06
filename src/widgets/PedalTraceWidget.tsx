/// <reference path="../types/electron.d.ts" />
import React, { createRef } from 'react';
import { BaseWidget, BaseWidgetProps, WidgetState } from './BaseWidget';
import { withWidgetRegistration } from './WidgetManager';

interface PedalTraceWidgetProps extends BaseWidgetProps {
  traceLength?: number; // Number of data points in the trace history
}

// Extended widget state
interface PedalTraceWidgetState extends WidgetState {
  throttleHistory: number[];
  brakeHistory: number[];
  clutchHistory: number[];
  traceLength: number;
}

export class PedalTraceWidgetBase extends BaseWidget<PedalTraceWidgetProps> {
  // Use the extended state type
  state: PedalTraceWidgetState;
  
  // Reference to the canvas element
  private canvasRef = createRef<HTMLCanvasElement>();
  
  // Animation frame request ID
  private animationFrameId: number | null = null;
  
  constructor(props: PedalTraceWidgetProps) {
    super(props);
    
    // Get trace length from props or URL parameters
    const traceLength = this.getInitialTraceLength();
    
    // Initialize with base state from parent class
    this.state = {
      ...this.state,
      throttleHistory: [],
      brakeHistory: [],
      clutchHistory: [],
      traceLength
    };
  }
  
  // Get initial trace length from URL or props
  getInitialTraceLength(): number {
    // Check URL parameters first (highest priority)
    let initialTraceLength = this.props.traceLength || 75;
    
    // When in Electron, check URL parameters
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const traceLengthParam = searchParams.get('traceLength');
      if (traceLengthParam) {
        const parsedLength = parseInt(traceLengthParam, 10);
        if (!isNaN(parsedLength) && parsedLength > 0) {
          console.log(`Found traceLength in URL parameters: ${parsedLength}`);
          initialTraceLength = parsedLength;
        }
      }
    }
    
    console.log(`PedalTraceWidget initialized with traceLength: ${initialTraceLength}`);
    return initialTraceLength;
  }
  
  // Override parent method to handle parameter updates
  handleParamsUpdate = (params: Record<string, any>) => {
    console.log(`PedalTraceWidget ${this.props.id} received parameter update:`, params);
    
    // Update traceLength if provided
    if (params.traceLength && typeof params.traceLength === 'number') {
      console.log(`Updating traceLength from ${this.state.traceLength} to ${params.traceLength}`);
      this.setState({ traceLength: params.traceLength });
    }
  }
  
  // Override method to handle new telemetry data
  protected onTelemetryDataReceived(data: any) {
    if (!data) return;
    
    // Update pedal histories
    this.setState(prevState => {
      const { traceLength } = prevState;
      
      // Create new throttle history
      const throttleHistory = [...prevState.throttleHistory];
      if (typeof data.throttle_pct === 'number') {
        throttleHistory.push(data.throttle_pct);
        // Keep only the most recent 'traceLength' entries
        if (throttleHistory.length > traceLength) {
          throttleHistory.shift();
        }
      }
      
      // Create new brake history
      const brakeHistory = [...prevState.brakeHistory];
      if (typeof data.brake_pct === 'number') {
        brakeHistory.push(data.brake_pct);
        // Keep only the most recent 'traceLength' entries
        if (brakeHistory.length > traceLength) {
          brakeHistory.shift();
        }
      }
      
      // Create new clutch history
      const clutchHistory = [...prevState.clutchHistory];
      if (typeof data.clutch_pct === 'number') {
        clutchHistory.push(data.clutch_pct);
        // Keep only the most recent 'traceLength' entries
        if (clutchHistory.length > traceLength) {
          clutchHistory.shift();
        }
      }
      
      return { throttleHistory, brakeHistory, clutchHistory };
    });
    
    // Trigger a redraw
    this.drawTrace();
  }
  
  // Component lifecycle methods
  componentDidMount() {
    super.componentDidMount();
    
    // Set up resize handler
    window.addEventListener('resize', this.handleResize);
    
    // Initial canvas setup
    this.handleResize();
  }
  
  componentWillUnmount() {
    super.componentWillUnmount();
    
    // Clean up resize handler
    window.removeEventListener('resize', this.handleResize);
    
    // Cancel any pending animation frame
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
  }
  
  // Handle resize events
  handleResize = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const container = canvas.parentElement;
    if (container) {
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
      this.drawTrace();
    }
  }
  
  // Draw the trace on the canvas
  drawTrace = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get canvas dimensions
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set background
    ctx.fillStyle = '#1f2937'; // Dark gray background
    ctx.fillRect(0, 0, width, height);
    
    // Set line styles
    ctx.lineWidth = 2;
    
    const { throttleHistory, brakeHistory, clutchHistory } = this.state;
    
    // Only draw if we have data
    if (throttleHistory.length === 0) return;
    
    // Calculate x step
    const xStep = width / (this.state.traceLength - 1);
    
    // Apply padding at top and bottom (5% of height)
    const paddingY = height * 0.05;
    const graphHeight = height - (paddingY * 2);
    
    // Draw throttle trace (green)
    ctx.strokeStyle = '#34d399'; // Green
    ctx.beginPath();
    throttleHistory.forEach((value, index) => {
      const x = index * xStep;
      // Apply padding to keep values from touching top and bottom
      const y = paddingY + (graphHeight - (value / 100 * graphHeight));
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw brake trace (red)
    ctx.strokeStyle = '#ef4444'; // Red
    ctx.beginPath();
    brakeHistory.forEach((value, index) => {
      const x = index * xStep;
      // Apply padding to keep values from touching top and bottom
      const y = paddingY + (graphHeight - (value / 100 * graphHeight));
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
    
    // Draw clutch trace (blue) if available
    if (clutchHistory.length > 0) {
      ctx.strokeStyle = '#3b82f6'; // Blue
      ctx.beginPath();
      clutchHistory.forEach((value, index) => {
        const x = index * xStep;
        // Apply padding to keep values from touching top and bottom
        const y = paddingY + (graphHeight - (value / 100 * graphHeight));
        if (index === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
    
    // Draw legend
    const legendY = height - 20;
    const legendItemWidth = 80;
    
    // Throttle legend
    ctx.fillStyle = '#34d399';
    ctx.fillRect(10, legendY, 15, 2);
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText('Throttle', 30, legendY + 4);
    
    // Brake legend
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(10 + legendItemWidth, legendY, 15, 2);
    ctx.fillStyle = '#fff';
    ctx.fillText('Brake', 30 + legendItemWidth, legendY + 4);
    
    // Clutch legend
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(10 + legendItemWidth * 2, legendY, 15, 2);
    ctx.fillStyle = '#fff';
    ctx.fillText('Clutch', 30 + legendItemWidth * 2, legendY + 4);
  }
  
  // Required renderContent method from BaseWidget
  renderContent(): React.ReactNode {
    const { connected, telemetryData } = this.state;
    
    if (!connected) {
      return (
        <div className="widget-content">
          <div className="status-disconnected">Disconnected</div>
          <div className="status-message">Attempting to connect...</div>
        </div>
      );
    }
    
    if (!telemetryData) {
      return (
        <div className="widget-content">
          <div className="status-connected">Connected</div>
          <div className="status-message">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="widget-content p-0">
        <canvas 
          ref={this.canvasRef} 
          width="500" 
          height="160"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  }
}

// Export the widget with registration
export const PedalTraceWidget = withWidgetRegistration<PedalTraceWidgetProps>(
  PedalTraceWidgetBase as any, 'pedaltrace'
); 