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
  
  // Create a callback to be usable by controls
  const updateHistoryLength = useCallback((newLength: number) => {
    console.log(`[PedalTrace:${id}] Direct updateHistoryLength called with value: ${newLength}`);
    setHistoryLength(newLength);
  }, [id]);
  
  // Expose this function via a static property for the component
  (PedalTraceWidgetComponent as any).updateHistoryLength = updateHistoryLength;
  
  // This logs each render to help with debugging 
  console.log(`[PedalTrace:${id}] Rendering with historyLength=${historyLength}`);
  
  // Use the generic widget state update hook
  useWidgetStateUpdates(id, (state) => {
    console.log(`[PedalTrace:${id}] Received state update from generic event system:`, state);
    if (state.historyLength !== undefined) {
      const newLength = Number(state.historyLength);
      console.log(`[PedalTrace:${id}] Updating historyLength to ${newLength} from generic event`);
      setHistoryLength(newLength);
    }
  });
  
  // Listen for state updates from WidgetManager
  useEffect(() => {
    console.log(`[PedalTrace:${id}] Setting up WidgetManager listener`);
    
    // Force resyncing from WidgetManager on every mount
    const widget = WidgetManager.getWidget(id);
    if (widget) {
      console.log(`[PedalTrace:${id}] Found widget in WidgetManager:`, widget);
      console.log(`[PedalTrace:${id}] Widget state:`, widget.state);
      
      // Always resync with WidgetManager's state on mount
      if (widget.state && widget.state.historyLength !== undefined) {
        const storedLength = Number(widget.state.historyLength);
        console.log(`[PedalTrace:${id}] Found existing historyLength=${storedLength} in WidgetManager`);
        
        // Force update our local state to match WidgetManager
        if (storedLength !== historyLength) {
          console.log(`[PedalTrace:${id}] Updating local historyLength to match WidgetManager`);
          setHistoryLength(storedLength);
        }
      } else {
        // If widget exists but doesn't have historyLength, set it
        console.log(`[PedalTrace:${id}] Registering historyLength=${historyLength} to existing widget`);
        WidgetManager.updateWidgetState(id, { historyLength });
      }
    } else {
      // If widget doesn't exist in WidgetManager at all
      console.log(`[PedalTrace:${id}] Widget not found in WidgetManager, registering default state`);
      WidgetManager.updateWidgetState(id, { historyLength });
    }
    
    // Log on each render to check for widget manager issues
    console.log(`[PedalTrace:${id}] Current WidgetManager instance:`, WidgetManager);
    
    // Subscribe to future state changes
    const unsubscribe = WidgetManager.subscribe((event) => {
      // Log ALL events for debugging
      console.log(`[PedalTrace:${id}] WidgetManager event:`, event.type, event);
      
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        console.log(`[PedalTrace:${id}] State update for this widget:`, event.state);
        
        if (event.state.historyLength !== undefined) {
          const newLength = Number(event.state.historyLength);
          console.log(`[PedalTrace:${id}] WidgetManager notified historyLength change: ${newLength}`);
          setHistoryLength(newLength);
        }
      }
    });
    
    // Test the WidgetManager subscription by directly calling updateWidgetState
    setTimeout(() => {
      console.log(`[PedalTrace:${id}] Testing WidgetManager subscription with setTimeout...`);
      WidgetManager.updateWidgetState(id, { historyLength });
    }, 1000);
    
    return () => {
      console.log(`[PedalTrace:${id}] Cleaning up WidgetManager listener`);
      unsubscribe();
    };
  }, [id]); // Only depends on id, not historyLength
  
  // Use our custom hook to get telemetry data
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: ['throttle_pct', 'brake_pct'],
    throttleUpdates: true,
    updateInterval: 50
  });

  // Process telemetry data, respecting historyLength
  useEffect(() => {
    if (telemetryData) {
      const newData: PedalData = {
        timestamp: Date.now(),
        throttle: telemetryData.throttle_pct || 0,
        brake: telemetryData.brake_pct || 0
      };

      // Update ref without causing a state update
      dataRef.current = [...dataRef.current, newData].slice(-historyLength);
      
      // Only update state when we need to redraw
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(() => {
          setData([...dataRef.current]);
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
  }, [telemetryData, historyLength]);

  // D3 drawing logic
  const updateChart = useCallback(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 150;
    const margin = { top: 3, right: 0, bottom: 20, left: 0 };

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
      <div className="mt-2 flex justify-between text-xs">
        <button 
          onClick={() => {
            console.log(`[PedalTrace:${id}] Test button: setting historyLength to 20`);
            // For testing, we'll directly update the WidgetManager
            WidgetManager.updateWidgetState(id, { historyLength: 20 });
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs"
        >
          Set to 20
        </button>
        <button 
          onClick={() => {
            console.log(`[PedalTrace:${id}] Test button: setting historyLength to 100`);
            WidgetManager.updateWidgetState(id, { historyLength: 100 });
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs"
        >
          Set to 100
        </button>
        <button 
          onClick={() => {
            console.log(`[PedalTrace:${id}] Test button: setting historyLength to 500`);
            WidgetManager.updateWidgetState(id, { historyLength: 500 });
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs"
        >
          Set to 500
        </button>
        <button 
          onClick={() => {
            // Test the new direct state update mechanism
            console.log(`[PedalTrace:${id}] Testing generic event system with value 200`);
            dispatchWidgetStateUpdate(id, { historyLength: 200 });
          }}
          className="bg-red-500 hover:bg-red-700 text-white py-1 px-2 rounded text-xs"
        >
          Direct 200
        </button>
        <span>Current: {historyLength}</span>
      </div>
    </Widget>
  );
};

// This function provides control definitions to the WidgetRegistry
// It's called when the control panel needs to render controls for this widget
const getPedalTraceControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default to 100 if not set
  const historyLength = widgetState.historyLength || 100;
  
  console.log(`[Controls] getPedalTraceControls called with widgetState:`, widgetState);
  console.log(`[Controls] updateWidget function:`, updateWidget);
  
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
        console.log(`[Controls] Slider onChange called with value: ${numericValue}`);
        
        // APPROACH 1: Update via WidgetManager (standard approach)
        console.log(`[Controls] APPROACH 1: Updating via provided updateWidget function`);
        updateWidget({ historyLength: numericValue });
        
        try {
          // APPROACH 2: Try to directly call our component's update method (if accessible)
          console.log(`[Controls] APPROACH 2: Attempting direct component update`);
          if ((PedalTraceWidgetComponent as any).updateHistoryLength) {
            console.log(`[Controls] Found static updateHistoryLength on component, calling it`);
            (PedalTraceWidgetComponent as any).updateHistoryLength(numericValue);
          } else {
            console.log(`[Controls] No static updateHistoryLength found on component`);
          }
          
          // APPROACH 3: Use our new generic event system
          console.log(`[Controls] APPROACH 3: Using generic widget state update system`);
          dispatchWidgetStateUpdate(widgetState.id, { historyLength: numericValue });
          
        } catch (error) {
          console.error(`[Controls] Error in direct update approaches:`, error);
        }
        
        console.log(`[Controls] After all update approaches, slider value: ${numericValue}`);
      }
    }
  ];
  
  return controls;
};

// Wrap the component with controls for the registry
const PedalTraceWidget = withControls(PedalTraceWidgetComponent, getPedalTraceControls);

export default PedalTraceWidget; 