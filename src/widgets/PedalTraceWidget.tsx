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
    
    // Get the parent container dimensions
    const container = canvas.parentElement;
    if (!container) return;
    
    // Set canvas dimensions to match container
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;
    
    // Redraw with new dimensions
    this.drawTrace();
  }
  
  // Draw the trace on the canvas
  drawTrace = () => {
    const canvas = this.canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get the actual canvas dimensions
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear the entire canvas
    ctx.clearRect(0, 0, width, height);
    
    // Fill background
    ctx.fillStyle = '#1f2937'; // Dark gray background
    ctx.fillRect(0, 0, width, height);
    
    const { throttleHistory, brakeHistory, clutchHistory } = this.state;
    
    // If no data, show empty grid
    if (throttleHistory.length === 0) {
      this.drawEmptyGrid(ctx, width, height);
      return;
    }
    
    // Draw grid lines
    this.drawGrid(ctx, width, height);
    
    // Calculate margins and usable area
    const margin = {
      top: Math.max(10, height * 0.1),
      right: Math.max(10, width * 0.05),
      bottom: Math.max(30, height * 0.15), // Extra space for legend
      left: Math.max(10, width * 0.05)
    };
    
    const graphWidth = width - margin.left - margin.right;
    const graphHeight = height - margin.top - margin.bottom;
    
    // Only proceed if we have a valid area to draw
    if (graphWidth <= 0 || graphHeight <= 0) return;
    
    // Calculate step size for x-axis based on available data points
    const xStep = graphWidth / Math.max(1, (this.state.traceLength - 1));
    
    // Draw each trace line
    this.drawTraceLine(ctx, throttleHistory, xStep, margin, graphHeight, '#34d399'); // Green for throttle
    this.drawTraceLine(ctx, brakeHistory, xStep, margin, graphHeight, '#ef4444');    // Red for brake
    this.drawTraceLine(ctx, clutchHistory, xStep, margin, graphHeight, '#3b82f6');   // Blue for clutch
    
    // Draw legend
    this.drawLegend(ctx, width, height, margin);
  }
  
  // Draw an empty grid when no data is available
  drawEmptyGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.strokeStyle = '#4b5563'; // Gray for grid lines
    ctx.lineWidth = 0.5;
    
    // Draw horizontal grid lines (25%, 50%, 75%)
    for (let i = 1; i < 4; i++) {
      const y = height * (i / 4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
  
  // Draw background grid
  drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.strokeStyle = '#4b5563'; // Gray for grid lines
    ctx.lineWidth = 0.5;
    ctx.setLineDash([5, 5]); // Dashed lines
    
    // Draw horizontal grid lines (25%, 50%, 75%)
    for (let i = 1; i < 4; i++) {
      const y = height * (i / 4);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    
    // Reset line style
    ctx.setLineDash([]);
  }
  
  // Draw a single trace line
  drawTraceLine(
    ctx: CanvasRenderingContext2D,
    dataPoints: number[],
    xStep: number,
    margin: { top: number, right: number, bottom: number, left: number },
    graphHeight: number,
    color: string
  ) {
    if (dataPoints.length === 0) return;
    
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    
    // Start from the leftmost point and work right
    dataPoints.forEach((value, index) => {
      // Calculate x position (from left margin)
      const x = margin.left + (index * xStep);
      
      // Calculate y position (from top, inverted since 0,0 is top-left)
      // Map value (0-100) to graph height, ensuring it stays within bounds
      const normalizedValue = Math.max(0, Math.min(100, value)) / 100;
      const y = margin.top + (graphHeight - (normalizedValue * graphHeight));
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
  }
  
  // Draw legend showing the trace colors
  drawLegend(
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number,
    margin: { top: number, right: number, bottom: number, left: number }
  ) {
    const legendY = height - margin.bottom + 15; // Position legend in bottom margin
    const itemWidth = Math.min(80, width / 4); // Space items evenly, up to 80px
    const lineWidth = 15;
    const fontSize = Math.max(10, Math.min(12, width / 40)); // Responsive font size
    
    ctx.font = `${fontSize}px sans-serif`;
    
    // Throttle legend
    let x = margin.left;
    ctx.fillStyle = '#34d399'; // Green
    ctx.fillRect(x, legendY, lineWidth, 2);
    ctx.fillStyle = '#fff';
    ctx.fillText('Throttle', x + lineWidth + 4, legendY + 4);
    
    // Brake legend
    x += itemWidth;
    ctx.fillStyle = '#ef4444'; // Red
    ctx.fillRect(x, legendY, lineWidth, 2);
    ctx.fillStyle = '#fff';
    ctx.fillText('Brake', x + lineWidth + 4, legendY + 4);
    
    // Clutch legend
    x += itemWidth;
    ctx.fillStyle = '#3b82f6'; // Blue
    ctx.fillRect(x, legendY, lineWidth, 2);
    ctx.fillStyle = '#fff';
    ctx.fillText('Clutch', x + lineWidth + 4, legendY + 4);
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
      <div className="widget-content p-0 w-full h-full">
        <canvas 
          ref={this.canvasRef}
          className="w-full h-full"
        />
      </div>
    );
  }
}

// Export the widget with registration
export const PedalTraceWidget = withWidgetRegistration<PedalTraceWidgetProps>(
  PedalTraceWidgetBase as any, 'pedaltrace'
); 