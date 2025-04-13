import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';
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
  
  // Maximum history buffer size - we'll store up to this many points
  const MAX_HISTORY_BUFFER = 500;
  
  // Update the ref whenever historyLength changes
  useEffect(() => {
    historyLengthRef.current = historyLength;
  }, [historyLength]);
  
  // Create a callback to be usable by controls
  const updateHistoryLength = useCallback((newLength: number) => {
    // Only update if the value has actually changed
    if (historyLengthRef.current !== newLength) {
      setHistoryLength(newLength);
    }
  }, []);
  
  // Expose this function via a static property for the component
  (PedalTraceWidgetComponent as any).updateHistoryLength = updateHistoryLength;
  
  // Use the generic widget state update hook
  useWidgetStateUpdates(id, (state) => {
    if (state.historyLength !== undefined) {
      const newLength = Number(state.historyLength);
      // Only update if the value has actually changed
      if (historyLengthRef.current !== newLength) {
        setHistoryLength(newLength);
      }
    }
  });
  
  // Listen for state updates from WidgetManager
  useEffect(() => {
    console.log(`[PedalTrace:${id}] Setting up WidgetManager listener with initial historyLength=${historyLengthRef.current}`);
    
    // Force resyncing from WidgetManager on every mount
    const widget = WidgetManager.getWidget(id);
    if (widget) {
      console.log(`[PedalTrace:${id}] Found widget in WidgetManager:`, widget.state);
      
      // Always resync with WidgetManager's state on mount
      if (widget.state && widget.state.historyLength !== undefined) {
        const storedLength = Number(widget.state.historyLength);
        console.log(`[PedalTrace:${id}] Found existing historyLength=${storedLength} in WidgetManager`);
        
        // Force update our local state to match WidgetManager
        if (storedLength !== historyLengthRef.current) {
          console.log(`[PedalTrace:${id}] Updating local historyLength to ${storedLength}`);
          setHistoryLength(storedLength);
        }
      } else {
        // If widget exists but doesn't have historyLength, set it
        console.log(`[PedalTrace:${id}] Setting initial historyLength=${historyLengthRef.current} in WidgetManager`);
        WidgetManager.updateWidgetState(id, { historyLength: historyLengthRef.current });
      }
    } else {
      // If widget doesn't exist in WidgetManager at all
      console.log(`[PedalTrace:${id}] Widget not found in WidgetManager, registering with historyLength=${historyLengthRef.current}`);
      WidgetManager.updateWidgetState(id, { historyLength: historyLengthRef.current });
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
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]); // Only depends on id, not historyLength
  
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
  
  // Use our custom hook to get telemetry data
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: ['throttle_pct', 'brake_pct'],
    throttleUpdates: true,
    updateInterval: 50
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
    const width = 400;
    const height = 150;
    const margin = { top: 3, right: 0, bottom: 5, left: 0 };

    // Clear previous content
    svg.selectAll('*').remove();

    // Create fixed time window based on historyLength
    const now = Date.now();
    const timeWindow = 50 * historyLength; // 50ms is update interval
    
    const x = d3.scaleTime()
      .domain([now - timeWindow, now])
      .range([margin.left, width - margin.right]);

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
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', line);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#F44336')
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', brakeLine);
  }, [data, historyLength]);

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
    <Widget id={id} title="Pedal Trace" onClose={onClose}>
      <svg
        ref={svgRef}
        width={400}
        height={150}
        className="bg-transparent"
      />
      <div className="mt-2 flex justify-end text-xs">
        <span>Current: {historyLength}/{dataRef.current.length}</span>
      </div>
    </Widget>
  );
};

// This function provides control definitions to the WidgetRegistry
// It's called when the control panel needs to render controls for this widget
const getPedalTraceControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default to 100 if not set
  const historyLength = widgetState.historyLength || 100;
  
  console.log(`[Controls] getPedalTraceControls called with historyLength=${historyLength}`);
  
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
    }
  ];
  
  return controls;
};

// Wrap the component with controls for the registry
const PedalTraceWidget = withControls(PedalTraceWidgetComponent, getPedalTraceControls);

export default PedalTraceWidget; 