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
  const initialRenderRef = useRef<boolean>(true);
  
  // Debug logs for first render
  useEffect(() => {
    if (initialRenderRef.current) {
      console.log(`PedalTraceWidget Initial render, id=${id}, historyLength=${historyLength}`);
      initialRenderRef.current = false;
    }
  }, []);
  
  // Debug log function for PedalTraceWidget with ID prefix
  const debugLog = (message: string) => {
    console.log(`[PedalTrace:${id}] ${message}`);
  };
  
  // Listen for widget state updates to sync the historyLength
  useEffect(() => {
    debugLog(`Setting up WidgetManager subscription, id=${id}`);
    
    // Keep track of the previous historyLength to avoid circular updates
    let lastKnownExternalHistoryLength = historyLength;
    
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        debugLog(`Received state update event: ${JSON.stringify(event.state)}`);
        
        // Check if historyLength has changed
        if (event.state.historyLength !== undefined) {
          const newHistoryLength = Number(event.state.historyLength);
          
          // Only update if the value is different and not a result of our own sync
          if (newHistoryLength !== historyLength && newHistoryLength !== lastKnownExternalHistoryLength) {
            debugLog(`External historyLength change detected: ${newHistoryLength} (current: ${historyLength})`);
            lastKnownExternalHistoryLength = newHistoryLength;
            setHistoryLength(newHistoryLength);
          }
        }
      }
    });
    
    return () => {
      debugLog(`Cleaning up WidgetManager subscription`);
      unsubscribe();
    };
  }, [id, historyLength]);

  // Add a new effect to update existing data when historyLength changes
  useEffect(() => {
    debugLog(`historyLength changed to ${historyLength}`);
    
    // Immediately resize the existing data buffer when historyLength changes
    if (dataRef.current.length > 0) {
      const oldLength = dataRef.current.length;
      
      // Only slice if we need to (if current data is longer than the new history length)
      if (oldLength > historyLength) {
        dataRef.current = dataRef.current.slice(-historyLength);
        const newLength = dataRef.current.length;
        debugLog(`Resized data buffer from ${oldLength} to ${newLength} points`);
        
        // Update the displayed data
        setData([...dataRef.current]);
      }
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
        debugLog(`Processing telemetry with historyLength=${historyLength}, current data points=${dataRef.current.length}`);
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
  
  // Synchronize local state with WidgetManager
  // When our internal state changes, update the WidgetManager
  useEffect(() => {
    // We don't want to update WidgetManager on the initial render
    if (initialRenderRef.current) {
      return;
    }
    
    // This effect synchronizes our internal state with the WidgetManager
    // When historyLength changes internally, we update the WidgetManager
    debugLog(`Syncing historyLength=${historyLength} to WidgetManager`);
    WidgetManager.updateWidgetState(id, { historyLength });
  }, [id, historyLength]);

  // D3 drawing logic is created outside of component dependency arrays
  const updateChart = useCallback(() => {
    if (!svgRef.current || data.length === 0) return;
    
    const currentHistoryLength = historyLength; // Capture current history length
    console.log(`Running updateChart with historyLength=${currentHistoryLength}, data points=${data.length}`);

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 150;
    const margin = { top: 3, right: 0, bottom: 20, left: 0 }; // Increased bottom margin for label

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales - Use fixed time range based on historyLength rather than just data min/max
    // This ensures consistent scrolling speed regardless of how many points are stored
    const now = Date.now();
    const timeWindow = 50 * currentHistoryLength; // 50ms is the update interval
    
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
      .text(`History: ${currentHistoryLength} points (${(timeWindow/1000).toFixed(1)}s)`);
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

  // Initialize widget state with WidgetManager when component mounts
  useEffect(() => {
    debugLog(`Initializing widget state for id=${id}`);
    
    // Get current state from WidgetManager first
    const widget = WidgetManager.getWidget(id);
    const widgetState = widget?.state || {};
    
    // If there's already a historyLength in the widget state, use it
    if (widgetState.historyLength !== undefined) {
      const storedLength = Number(widgetState.historyLength);
      debugLog(`Found existing historyLength=${storedLength} in WidgetManager, using it`);
      setHistoryLength(storedLength);
    } else {
      // Otherwise, register our default historyLength with the WidgetManager
      debugLog(`No existing historyLength in WidgetManager, registering default (${historyLength})`);
      WidgetManager.updateWidgetState(id, { historyLength });
    }
    
    return () => {
      debugLog(`Cleaning up widget state for id=${id}`);
    };
  }, [id]); // Only run when id changes (i.e., on mount/unmount)

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
            debugLog(`Manually setting historyLength to 50`);
            // Just update the internal state, the effect will sync with WidgetManager
            setHistoryLength(50);
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs"
        >
          Set to 50
        </button>
        <button 
          onClick={() => {
            debugLog(`Manually setting historyLength to 200`);
            // Just update the internal state, the effect will sync with WidgetManager
            setHistoryLength(200);
          }}
          className="bg-blue-500 hover:bg-blue-700 text-white py-1 px-2 rounded text-xs"
        >
          Set to 200
        </button>
        <span>Current: {historyLength}</span>
      </div>
    </Widget>
  );
};

// Define the controls that will appear in the control panel
const getPedalTraceControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default to 100 if not set
  const historyLength = widgetState.historyLength || 100;
  
  console.log(`getPedalTraceControls called with widgetState:`, widgetState);
  
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
        console.log(`Slider onChange called with value: ${numericValue}`);
        
        // Call the updateWidget function from the registry adapter
        // This function will feed into SimpleControlPanel's updateWidgetState
        // which in turn calls WidgetManager.updateWidgetState
        updateWidget({ historyLength: numericValue });
        
        // Log after updating
        console.log(`After calling updateWidget with historyLength: ${numericValue}`);
      }
    }
  ];
  
  return controls;
};

// Wrap the component with the controls
const PedalTraceWidget = withControls(PedalTraceWidgetComponent, getPedalTraceControls);

export default PedalTraceWidget; 