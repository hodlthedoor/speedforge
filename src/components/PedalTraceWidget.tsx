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
  
  // Listen for widget state updates to sync the historyLength
  useEffect(() => {
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.historyLength !== undefined) {
          setHistoryLength(Number(event.state.historyLength));
        }
      }
    });
    
    return unsubscribe;
  }, [id]);
  
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

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 150;
    const margin = { top: 3, right: 0, bottom: 3, left: 0 };

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const x = d3.scaleTime()
      .domain([data[0].timestamp, data[data.length - 1].timestamp])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

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
  }, [data]);

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
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'historyLength',
      type: 'slider' as WidgetControlType,
      label: `History Length: ${historyLength} points`,
      value: historyLength,
      options: [
        { value: '20', label: 'Very Short' },
        { value: '50', label: 'Short' },
        { value: '100', label: 'Medium' },
        { value: '200', label: 'Long' },
        { value: '500', label: 'Very Long' }
      ],
      onChange: (value) => updateWidget({ historyLength: Number(value) })
    }
  ];
  
  return controls;
};

// Wrap the component with the controls
const PedalTraceWidget = withControls(PedalTraceWidgetComponent, getPedalTraceControls);

export default PedalTraceWidget; 