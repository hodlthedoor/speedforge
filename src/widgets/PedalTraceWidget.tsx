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
    // Pass props directly to parent
    super(props);
    
    // Get trace length from props or URL parameters
    const traceLength = this.getInitialTraceLength();
    
    // Initialize with base state from parent class
    this.state = {
      ...this.state,
      throttleHistory: [],
      brakeHistory: [],
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
        while (throttleHistory.length > traceLength) {
          throttleHistory.shift();
        }
      }
      
      // Create new brake history
      const brakeHistory = [...prevState.brakeHistory];
      if (typeof data.brake_pct === 'number') {
        brakeHistory.push(data.brake_pct);
        // Keep only the most recent 'traceLength' entries
        while (brakeHistory.length > traceLength) {
          brakeHistory.shift();
        }
      }
      
      return { throttleHistory, brakeHistory };
    });
    
    // Trigger a redraw
    this.drawTrace();
  }
  
  // Component lifecycle methods
  componentDidMount() {
    super.componentDidMount();
    
    // Set up resize handler
    window.addEventListener('resize', this.handleResize);
    
    // Initialize the canvas with proper dimensions
    // Try immediate initialization first
    this.handleResize();
    
    // Also try with a delay to ensure the DOM is fully rendered
    setTimeout(() => {
      this.handleResize();
    }, 50);
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
    
    // Get the parent container dimensions
    const container = canvas.parentElement;
    if (!container) return;
    
    console.log('Resizing canvas to match container:', container.offsetWidth, container.offsetHeight);
    
    // Set the canvas dimensions to match the container exactly
    // Use offsetWidth/offsetHeight for more accurate dimensions
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight; 
    
    // Trigger redraw with new dimensions
    this.drawTrace();
  }
  
  // Main drawing function
  drawTrace = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get the absolute width and height
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear the entire canvas with the background
    ctx.fillStyle = '#1f2937'; // Dark gray background
    ctx.fillRect(0, 0, width, height);
    
    // Draw the grid lines first
    this.drawGrid(ctx, width, height);
    
    const { throttleHistory, brakeHistory } = this.state;
    
    // Nothing to draw if no data yet
    if (throttleHistory.length === 0) {
      this.drawNoDataMessage(ctx, width, height);
      return;
    }
    
    // Use small vertical padding to ensure lines are visible at 0% and 100%
    const padding = {
      top: 3,     // Small top padding so 100% value is visible
      right: 0,
      bottom: 3,  // Small bottom padding so 0% value is visible
      left: 0
    };
    
    // Draw the traces using the full canvas width
    this.drawPedalTrace(ctx, throttleHistory, width, height, padding, '#34d399', 2); // Green for throttle
    this.drawPedalTrace(ctx, brakeHistory, width, height, padding, '#ef4444', 2);    // Red for brake
  }
  
  // Draw the grid background
  drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Draw the grid border - draw this exactly at the edge
    ctx.strokeStyle = '#4b5563'; // Medium gray
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, width, height);
    
    // Draw dashed grid lines
    ctx.strokeStyle = '#374151'; // Darker gray for grid lines
    ctx.lineWidth = 0.5;
    ctx.setLineDash([2, 3]);
    
    // Draw horizontal lines at 25%, 50%, 75% intervals
    for (let i = 1; i < 4; i++) {
      const y = Math.floor(height * (i / 4)) + 0.5; // Add 0.5 for sharp lines
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Draw vertical lines at 25%, 50%, 75% intervals
    for (let i = 1; i < 4; i++) {
      const x = Math.floor(width * (i / 4)) + 0.5; // Add 0.5 for sharp lines
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    
    // Reset the line style
    ctx.setLineDash([]);
  }
  
  // Display message when no data is available
  drawNoDataMessage(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.fillStyle = '#9ca3af'; // Light gray
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Waiting for pedal input...', width / 2, height / 2);
  }
  
  // Draw a single pedal trace
  drawPedalTrace(
    ctx: CanvasRenderingContext2D, 
    dataPoints: number[], 
    width: number, 
    height: number,
    padding: { top: number, right: number, bottom: number, left: number },
    color: string,
    lineWidth: number
  ) {
    if (dataPoints.length <= 1) return;
    
    // Set the line style
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    
    // Calculate the drawable height with padding
    const drawableHeight = height - padding.top - padding.bottom;
    
    // Iterate through each data point
    for (let i = 0; i < dataPoints.length; i++) {
      // Calculate x position from 0 to full width
      // Important: Start exactly at 0 and end exactly at width
      const xPos = i * (width / (dataPoints.length - 1));
      
      // Calculate y position (0-100% maps to drawable height)
      const value = Math.max(0, Math.min(100, dataPoints[i]));
      // Map from data value (0-100) to canvas coordinates with padding
      const yPos = height - padding.bottom - (value / 100 * drawableHeight);
      
      // Draw the point
      if (i === 0) {
        ctx.moveTo(xPos, yPos);
      } else {
        ctx.lineTo(xPos, yPos);
      }
    }
    
    // Render the trace
    ctx.stroke();
  }
  
  // Required renderContent method from BaseWidget
  renderContent(): React.ReactNode {
    const { connected, telemetryData } = this.state;
    
    if (!connected) {
      return (
        <div className="widget-content p-0 flex flex-col items-center justify-center h-full w-full">
          <div className="status-disconnected">Disconnected</div>
          <div className="status-message">Attempting to connect...</div>
        </div>
      );
    }
    
    if (!telemetryData) {
      return (
        <div className="widget-content p-0 flex flex-col items-center justify-center h-full w-full">
          <div className="status-connected">Connected</div>
          <div className="status-message">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="widget-content p-0 m-0 h-full w-full">
        <canvas 
          ref={this.canvasRef}
          className="w-full h-full border-0 p-0 m-0"
          style={{ 
            display: 'block', 
            padding: 0, 
            margin: 0, 
            border: 'none' 
          }}
        />
      </div>
    );
  }
}

// Export the widget with registration
export const PedalTraceWidget = withWidgetRegistration<PedalTraceWidgetProps>(
  PedalTraceWidgetBase as any, 'pedaltrace'
); 