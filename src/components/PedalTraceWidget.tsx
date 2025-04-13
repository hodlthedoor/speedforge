import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

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
  
  // Debug logs for first render
  console.log(`PedalTraceWidget Initial render, id=${id}, historyLength=${historyLength}`);
  
  // Debug log function for PedalTraceWidget with ID prefix
  const debugLog = (message: string) => {
    console.log(`[PedalTrace:${id}] ${message}`);
  };
  
  // Listen for widget state updates to sync the historyLength
  useEffect(() => {
    debugLog(`Setting up WidgetManager subscription, id=${id}`);
    
    const unsubscribe = WidgetManager.subscribe((event) => {
      debugLog(`Received WidgetManager event: ${event.type}`);
      
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        debugLog(`Received state update event with state: ${JSON.stringify(event.state)}`);
        
        if (event.state.historyLength !== undefined) {
          const newHistoryLength = Number(event.state.historyLength);
          debugLog(`Widget state update: historyLength changing from ${historyLength} to ${newHistoryLength}`);
          
          // Use the functional form of setState to avoid dependency on current historyLength
          setHistoryLength(prevLength => {
            debugLog(`Updating historyLength from ${prevLength} to ${newHistoryLength}`);
            return newHistoryLength;
          });
        }
      }
    });
    
    return unsubscribe;
  }, [id]);

  // Add a new effect to update existing data when historyLength changes
  useEffect(() => {
    console.log(`historyLength changed to ${historyLength}`);
    
    // Immediately resize the existing data buffer when historyLength changes
    if (dataRef.current.length > 0) {
      const oldLength = dataRef.current.length;
      dataRef.current = dataRef.current.slice(-historyLength);
      const newLength = dataRef.current.length;
      console.log(`Resized data buffer from ${oldLength} to ${newLength} points`);
      
      setData([...dataRef.current]);
    }
  }, [historyLength]);
  
  // Use our custom hook with throttle and brake metrics
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: ['throttle_pct', 'brake_pct'],
    throttleUpdates: true,
    updateInterval: 50
  });

  // Transform telemetry data into our visualization format
  useEffect(() => {
    if (telemetryData) {
      const newData: PedalData = {
        timestamp: Date.now(),
        throttle: telemetryData.throttle_pct || 0,
        brake: telemetryData.brake_pct || 0
      };

      // Log the current history length for debugging
      if (dataRef.current.length % 10 === 0) { // Only log every 10 points to avoid spam
        console.log(`Processing telemetry with historyLength=${historyLength}, current data points=${dataRef.current.length}`);
      }

      // Update ref without causing a state update
      // Use historyLength from state for the slice limit
      dataRef.current = [...dataRef.current, newData].slice(-historyLength);
      
      // Only update state when we need to redraw
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(() => {
          setData([...dataRef.current]);
          animationFrameId.current = null;
        });
      }
    }
    
    // Clean up function
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [telemetryData, historyLength]);

  // D3 drawing logic
  const updateChart = useCallback(() => {
    if (!svgRef.current || data.length === 0) return;
    
    console.log(`Running updateChart with historyLength=${historyLength}, data points=${data.length}`);

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 150;
    const margin = { top: 3, right: 0, bottom: 20, left: 0 }; // Increased bottom margin for label

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales - Use fixed time range based on historyLength rather than just data min/max
    // This ensures consistent scrolling speed regardless of how many points are stored
    const now = Date.now();
    const timeWindow = 50 * historyLength; // 50ms is the update interval
    
    const x = d3.scaleTime()
      .domain([now - timeWindow, now])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);
      
    // Add axis to show time scale
    const xAxis = d3.axisBottom(x)
      .ticks(3)
      .tickFormat(d => `-${((now - Number(d)) / 1000).toFixed(1)}s`);
      
    svg.append("g")
      .attr("transform", `translate(0,${height - margin.bottom})`)
      .call(xAxis);

    // Create line generators
    const line = d3.line<PedalData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.throttle))
      .curve(d3.curveMonotoneX);

    const brakeLine = d3.line<PedalData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.brake))
      .curve(d3.curveMonotoneX);

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
      
    // Add a label with history length
    svg.append('text')
      .attr('x', width / 2)
      .attr('y', height - 5)
      .attr('text-anchor', 'middle')
      .attr('fill', 'white')
      .attr('font-size', '10px')
      .text(`History: ${historyLength} points (${(timeWindow/1000).toFixed(1)}s)`);
  }, [data, historyLength]);

  // Apply D3 visualization when data changes
  useEffect(() => {
    updateChart();
  }, [updateChart]);

  // Clean up everything when component unmounts
  useEffect(() => {
    return () => {
      // Clean up all D3 related resources
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
      
      // Ensure dataRef is cleared to help garbage collection
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
    </Widget>
  );
};

// Define the controls that will appear in the control panel
const getPedalTraceControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default to 100 if not set
  const historyLength = widgetState.historyLength || 100;
  
  console.log(`getPedalTraceControls called with widgetState:`, widgetState);
  console.log(`[DEBUG] getPedalTraceControls - updateWidget function:`, updateWidget);
  
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
        console.log(`Slider onChange called with value: ${value}`);
        console.log(`[DEBUG] Slider onChange - Will call updateWidget with:`, { historyLength: value });
        
        // Call updateWidget with the new value
        updateWidget({ historyLength: value });
        
        console.log(`[DEBUG] Slider onChange - After calling updateWidget`);
      }
    }
  ];
  
  return controls;
};

// Wrap the component with the controls
const PedalTraceWidget = withControls(PedalTraceWidgetComponent, getPedalTraceControls);

export default PedalTraceWidget; 