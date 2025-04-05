/// <reference path="../types/electron.d.ts" />
import React, { useState, useEffect, useRef } from 'react';
import { BaseWidgetProps } from './BaseWidget';
import { withWidgetRegistration } from './WidgetManager';

interface TraceWidgetProps extends BaseWidgetProps {
  traceLength?: number; // Number of data points to display in history
}

function TraceWidgetBase(props: TraceWidgetProps) {
  // State for telemetry data and connection status
  const [telemetryData, setTelemetryData] = useState<any>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [throttleHistory, setThrottleHistory] = useState<number[]>([]);
  const [brakeHistory, setBrakeHistory] = useState<number[]>([]);
  
  // WebSocket reference
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Default trace length if not provided
  const traceLength = props.traceLength || 75;

  // Connect to WebSocket for telemetry data
  const connectWebSocket = () => {
    const wsUrl = 'ws://localhost:8080';
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;
      
      ws.onopen = () => {
        console.log('Connected to telemetry WebSocket');
        setConnected(true);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setTelemetryData(data);
          
          // Update throttle and brake history
          if (data && typeof data.throttle_pct === 'number' && typeof data.brake_pct === 'number') {
            setThrottleHistory(prev => {
              const newHistory = [...prev, data.throttle_pct];
              return newHistory.slice(-traceLength);
            });
            
            setBrakeHistory(prev => {
              const newHistory = [...prev, data.brake_pct];
              return newHistory.slice(-traceLength);
            });
          }
        } catch (error) {
          console.error('Failed to parse telemetry data:', error);
        }
      };
      
      ws.onclose = () => {
        console.log('Disconnected from telemetry WebSocket');
        setConnected(false);
        
        // Try to reconnect after a delay
        reconnectTimerRef.current = window.setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        ws.close();
      };
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
    }
  };

  // Draw the trace on canvas
  const drawTrace = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Get canvas dimensions
    const { width, height } = canvas;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    // Set background
    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, width, height);
    
    // Set line styles
    ctx.lineWidth = 2;
    
    // Only draw if we have data
    if (throttleHistory.length > 0 && brakeHistory.length > 0) {
      // Calculate x step
      const xStep = width / (traceLength - 1);
      
      // Apply padding at top and bottom (5% of height)
      const paddingY = height * 0.05;
      const graphHeight = height - (paddingY * 2);
      
      // Draw throttle trace
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
      
      // Draw brake trace
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
    }
  };

  // Lifecycle hooks
  useEffect(() => {
    // Connect to WebSocket
    connectWebSocket();
    
    // Clean up
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
    };
  }, []);
  
  // Draw trace whenever data changes
  useEffect(() => {
    drawTrace();
  }, [throttleHistory, brakeHistory, telemetryData]);
  
  // Resize handling
  useEffect(() => {
    const handleResize = () => {
      if (canvasRef.current) {
        const container = canvasRef.current.parentElement;
        if (container) {
          canvasRef.current.width = container.clientWidth;
          canvasRef.current.height = container.clientHeight;
          drawTrace();
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    // Initial sizing
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Render content based on connection state
  const renderContent = () => {
    if (!connected) {
      return (
        <div className="widget-content">
          <div className="status-disconnected">Disconnected</div>
          <div className="status-message">Attempting to connect...</div>
        </div>
      );
    }
    
    return (
      <div className="widget-content" style={{ padding: 0 }}>
        <canvas 
          ref={canvasRef} 
          width="300" 
          height="200"
          style={{ width: '100%', height: '100%' }}
        />
      </div>
    );
  };

  // Render the component
  return (
    <div className="widget trace-widget"
         style={{ 
           width: `${props.defaultWidth || 500}px`, 
           height: `${props.defaultHeight || 160}px`
         }}>
      {renderContent()}
    </div>
  );
}

// Export the widget with registration
export const TraceWidget = withWidgetRegistration<TraceWidgetProps>(
  TraceWidgetBase as any, 'trace'
); 