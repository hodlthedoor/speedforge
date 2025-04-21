import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';

interface PedalTraceWidgetProps {
  id: string;
  onClose: () => void;
}

interface PedalData {
  timestamp: number;
  throttle: number;
  brake: number;
}

const PedalTraceWidgetComponent: React.FC<PedalTraceWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<PedalData[]>([]);
  const dataRef = useRef<PedalData[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const [historyLength, setHistoryLength] = useState<number>(100);
  const historyLengthRef = useRef<number>(100);
  // Add width state with direct pixel values
  const [width, setWidth] = useState<number>(480);
  const widthRef = useRef<number>(480);
  
  // Maximum history buffer size - we'll store up to this many points
  const MAX_HISTORY_BUFFER = 500;
  
  // Update the ref whenever historyLength changes
  useEffect(() => {
    historyLengthRef.current = historyLength;
  }, [historyLength]);
  
  // Update the ref whenever width changes
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  
  // Create a callback to be usable by controls
  const updateHistoryLength = useCallback((newLength: number) => {
    // Only update if the value has actually changed
    if (historyLengthRef.current !== newLength) {
      setHistoryLength(newLength);
    }
  }, []);
  
  // Create a callback for updating width
  const updateWidth = useCallback((newWidth: number) => {
    // Only update if the value has actually changed
    if (widthRef.current !== newWidth) {
      setWidth(newWidth);
    }
  }, []);
  
  // Expose these functions via static properties for the component
  (PedalTraceWidgetComponent as any).updateHistoryLength = updateHistoryLength;
  (PedalTraceWidgetComponent as any).updateWidth = updateWidth;
  
  // Use the generic widget state update hook
  useWidgetStateUpdates(id, (state) => {
    if (state.historyLength !== undefined) {
      const newLength = Number(state.historyLength);
      // Only update if the value has actually changed
      if (historyLengthRef.current !== newLength) {
        setHistoryLength(newLength);
      }
    }
    
    if (state.width !== undefined) {
      const newWidth = Number(state.width);
      // Only update if the value has actually changed
      if (widthRef.current !== newWidth) {
        setWidth(newWidth);
      }
    }
  });
  
  // Listen for state updates from WidgetManager
  useEffect(() => {
    console.log(`[PedalTrace:${id}] Setting up WidgetManager listener with initial historyLength=${historyLengthRef.current}, width=${widthRef.current}px`);
    
    // Force resyncing from WidgetManager on every mount
    const widget = WidgetManager.getWidget(id);
    if (widget) {
      console.log(`[PedalTrace:${id}] Found widget in WidgetManager:`, widget.state);
      
      // Always resync with WidgetManager's state on mount
      if (widget.state) {
        if (widget.state.historyLength !== undefined) {
          const storedLength = Number(widget.state.historyLength);
          console.log(`[PedalTrace:${id}] Found existing historyLength=${storedLength} in WidgetManager`);
          
          // Force update our local state to match WidgetManager
          if (storedLength !== historyLengthRef.current) {
            console.log(`[PedalTrace:${id}] Updating local historyLength to ${storedLength}`);
            setHistoryLength(storedLength);
          }
        }
        
        if (widget.state.width !== undefined) {
          const storedWidth = Number(widget.state.width);
          console.log(`[PedalTrace:${id}] Found existing width=${storedWidth}px in WidgetManager`);
          
          // Force update our local state to match WidgetManager
          if (storedWidth !== widthRef.current) {
            console.log(`[PedalTrace:${id}] Updating local width to ${storedWidth}px`);
            setWidth(storedWidth);
          }
        } else {
          // If widget exists but doesn't have width, set it
          console.log(`[PedalTrace:${id}] Setting initial width=${widthRef.current}px in WidgetManager`);
          WidgetManager.updateWidgetState(id, { width: widthRef.current });
        }
      } else {
        // If widget exists but state is empty, initialize both values
        console.log(`[PedalTrace:${id}] Setting initial historyLength=${historyLengthRef.current} and width=${widthRef.current}px in WidgetManager`);
        WidgetManager.updateWidgetState(id, { 
          historyLength: historyLengthRef.current,
          width: widthRef.current
        });
      }
    } else {
      // If widget doesn't exist in WidgetManager at all
      console.log(`[PedalTrace:${id}] Widget not found in WidgetManager, registering with historyLength=${historyLengthRef.current} and width=${widthRef.current}px`);
      WidgetManager.updateWidgetState(id, { 
        historyLength: historyLengthRef.current,
        width: widthRef.current
      });
    }
    
    // Subscribe to future state changes
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        console.log(`[PedalTrace:${id}] Received WidgetManager update:`, event.state);
        
        if (event.state.historyLength !== undefined) {
          const newLength = Number(event.state.historyLength);
          console.log(`[PedalTrace:${id}] New historyLength=${newLength}, current=${historyLengthRef.current}`);
          
          // Only update if the value has actually changed
          if (historyLengthRef.current !== newLength) {
            console.log(`[PedalTrace:${id}] Updating historyLength state to ${newLength}`);
            setHistoryLength(newLength);
          }
        }
        
        if (event.state.width !== undefined) {
          const newWidth = Number(event.state.width);
          console.log(`[PedalTrace:${id}] New width=${newWidth}px, current=${widthRef.current}px`);
          
          // Only update if the value has actually changed
          if (widthRef.current !== newWidth) {
            console.log(`[PedalTrace:${id}] Updating width state to ${newWidth}px`);
            setWidth(newWidth);
          }
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]); // Only depends on id, not historyLength or width
  
  // Sync historyLength changes with WidgetManager
  useEffect(() => {
    // Skip initial render
    if (historyLengthRef.current === historyLength) return;
    
    console.log(`[PedalTrace:${id}] historyLength changed to ${historyLength}, updating WidgetManager`);
    WidgetManager.updateWidgetState(id, { historyLength });
    
    // When historyLength changes, update displayed data with what we have in buffer
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
        // Slice the buffer to match current historyLength
        setData(dataRef.current.slice(-historyLength));
        animationFrameId.current = null;
      });
    }
  }, [historyLength, id]);
  
  // Sync width changes with WidgetManager
  useEffect(() => {
    // Skip initial render
    if (widthRef.current === width) return;
    
    console.log(`[PedalTrace:${id}] width changed to ${width}px, updating WidgetManager`);
    WidgetManager.updateWidgetState(id, { width });
    
    // When width changes, force update chart to match new dimensions
    updateChart();
  }, [width, id]);
  
  // Use our custom hook to get telemetry data with typed metrics
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: ['throttle_pct', 'brake_pct'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 20
  });

  // Process telemetry data, maintaining full buffer but displaying based on historyLength
  useEffect(() => {
    if (telemetryData) {
      const newData: PedalData = {
        timestamp: Date.now(),
        throttle: telemetryData.throttle_pct || 0,
        brake: telemetryData.brake_pct || 0
      };

      // Update ref with full buffer (up to MAX_HISTORY_BUFFER)
      dataRef.current = [...dataRef.current, newData].slice(-MAX_HISTORY_BUFFER);
      
      // Only update display state when we need to redraw, using current historyLength
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(() => {
          // Slice from the buffer based on current historyLength
          setData(dataRef.current.slice(-historyLengthRef.current));
          animationFrameId.current = null;
        });
      }
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [telemetryData]);

  // D3 drawing logic
  const updateChart = useCallback(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    // Use direct width in pixels
    const currentWidth = widthRef.current;
    const height = 150;
    const margin = { top: 3, right: 0, bottom: 5, left: 0 };

    // Update the SVG element size directly
    svg
      .attr('width', currentWidth)
      .attr('height', height);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create fixed time window based on historyLength
    const now = Date.now();
    const timeWindow = 50 * historyLength; // 50ms is update interval
    
    const x = d3.scaleTime()
      .domain([now - timeWindow, now])
      .range([margin.left, currentWidth - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);
    
    // Create line generators
    const line = d3.line<PedalData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.throttle))
      // Using a smoother curve interpolation:
      // - curveMonotoneX: Preserves monotonicity but can be slightly angular
      // - curveBasis: Very smooth but can overshoot
      // - curveCardinal: Good balance, tension can be adjusted (0.5 = moderate smoothing)
      // - curveCatmullRom: Similar to cardinal but with different parameterization
      .curve(d3.curveCardinal.tension(0.5));

    const brakeLine = d3.line<PedalData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.brake))
      .curve(d3.curveCardinal.tension(0.5));

    // Add lines with proper styling
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#4CAF50')
      .attr('stroke-width', 2.8) // 40% wider than previous 2
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', line);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#F44336')
      .attr('stroke-width', 2.8) // 40% wider than previous 2
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', brakeLine);
  }, [data, historyLength, width]);

  // Apply D3 visualization when data changes
  useEffect(() => {
    updateChart();
  }, [updateChart]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
      dataRef.current = [];
    };
  }, []);

  return (
    <Widget id={id} title="Pedal Trace" onClose={onClose} width={width}>
      <svg
        ref={svgRef}
        width={width}
        height={150}
        className="bg-transparent"
      />
    </Widget>
  );
};

// This function provides control definitions to the WidgetRegistry
// It's called when the control panel needs to render controls for this widget
const getPedalTraceControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default to 100 if not set
  const historyLength = widgetState.historyLength || 100;
  // Default to 480 if not set
  const width = widgetState.width || 480;
  
  console.log(`[Controls] getPedalTraceControls called with historyLength=${historyLength}, width=${width}px`);
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'historyLength',
      type: 'slider' as WidgetControlType,
      label: `History Length: ${historyLength} points`,
      value: historyLength,
      options: [
        { value: 20, label: 'Very Short' },
        { value: 50, label: 'Short' },
        { value: 100, label: 'Medium' },
        { value: 200, label: 'Long' },
        { value: 500, label: 'Very Long' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        console.log(`[Controls] Slider onChange: setting historyLength to ${numericValue}`);
        
        // Update both the widget state and dispatch a direct update for redundancy
        updateWidget({ historyLength: numericValue });
        
        // Also try direct update mechanism as fallback
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { historyLength: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    },
    {
      id: 'width',
      type: 'slider' as WidgetControlType,
      label: `Width: ${width}px`,
      value: width,
      options: [
        { value: 400, label: '400px' },
        { value: 500, label: '500px' },
        { value: 600, label: '600px' },
        { value: 700, label: '700px' },
        { value: 800, label: '800px' },
        { value: 1000, label: '1000px' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        console.log(`[Controls] Slider onChange: setting width to ${numericValue}px`);
        
        // Update both the widget state and dispatch a direct update for redundancy
        updateWidget({ width: numericValue });
        
        // Also try direct update mechanism as fallback
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { width: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    }
  ];
  
  return controls;
};

// Wrap the component with controls for the registry
const PedalTraceWidget = withControls(PedalTraceWidgetComponent, getPedalTraceControls);

export default PedalTraceWidget; 