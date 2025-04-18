import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';

interface ShiftIndicatorWidgetProps {
  id: string;
  onClose: () => void;
}

interface ShiftData {
  timestamp: number;
  shiftIndicator: number;
  rpm: number;
}

const ShiftIndicatorWidgetComponent: React.FC<ShiftIndicatorWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<ShiftData[]>([]);
  const dataRef = useRef<ShiftData[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashingTimerRef = useRef<number | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const [shiftRpm, setShiftRpm] = useState<number>(0);
  
  // Add width state
  const [widgetWidth, setWidgetWidth] = useState<number>(400);
  
  // Use the widget state update hook to listen for width changes
  useWidgetStateUpdates(id, (state) => {
    if (state.widgetWidth !== undefined) {
      const newWidth = Number(state.widgetWidth);
      if (widgetWidth !== newWidth) {
        console.log(`Setting width to ${newWidth} from useWidgetStateUpdates`);
        setWidgetWidth(newWidth);
      }
    }
  });
  
  // Initialize widget state
  useEffect(() => {
    // Get initial state from WidgetManager
    const widget = WidgetManager.getWidget(id);
    if (widget?.state?.widgetWidth) {
      const savedWidth = Number(widget.state.widgetWidth);
      console.log(`Initializing width to ${savedWidth} from WidgetManager`);
      setWidgetWidth(savedWidth);
    } else {
      // Set initial state in WidgetManager
      console.log(`Setting initial width ${widgetWidth} in WidgetManager`);
      WidgetManager.updateWidgetState(id, { widgetWidth });
    }
    
    // Subscribe to WidgetManager updates
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id && event.state.widgetWidth) {
        const newWidth = Number(event.state.widgetWidth);
        console.log(`Width update from WidgetManager: ${newWidth}`);
        setWidgetWidth(newWidth);
      }
    });
    
    return unsubscribe;
  }, [id]);
  
  // Sync width changes back to WidgetManager
  useEffect(() => {
    // This should run on all widgetWidth changes except the initial render
    console.log(`Width changed to ${widgetWidth}, updating WidgetManager`);
    WidgetManager.updateWidgetState(id, { widgetWidth });
  }, [widgetWidth, id]);
  
  // Use our custom hook with shift indicator metric and RPM using typed metrics
  const { data: telemetryData, sessionData } = useTelemetryData(id, { 
    metrics: ['shift_indicator_pct', 'rpm'] as TelemetryMetric[]
  });

  // Get shift RPM from session data
  useEffect(() => {
    if (sessionData?.drivers?.shift_light_shift_rpm) {
      setShiftRpm(sessionData.drivers.shift_light_shift_rpm);
    }
  }, [sessionData]);

  // Transform telemetry data into our visualization format
  useEffect(() => {
    if (telemetryData) {
      const newData: ShiftData = {
        timestamp: Date.now(),
        shiftIndicator: telemetryData.shift_indicator_pct || 0,
        rpm: telemetryData.rpm || 0
      };

      dataRef.current = [newData];
      
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
  }, [telemetryData]);

  // Handle flashing effect for overrev
  useEffect(() => {
    if (flashingTimerRef.current) {
      clearInterval(flashingTimerRef.current);
      flashingTimerRef.current = null;
    }
    
    if (data.length > 0 && data[0].shiftIndicator >= 90) {
      flashingTimerRef.current = window.setInterval(() => {
        setIsFlashing(prev => !prev);
      }, 200); // Faster flashing for better feedback
    } else {
      setIsFlashing(false);
    }
    
    return () => {
      if (flashingTimerRef.current) {
        clearInterval(flashingTimerRef.current);
        flashingTimerRef.current = null;
      }
    };
  }, [data]);

  // Get bar color based on percentage
  const getBarColor = (percentage: number): string => {
    if (percentage < 60) {
      return '#4CAF50'; // Green
    } else if (percentage < 75) {
      return '#FFEB3B'; // Yellow
    } else if (percentage < 90) {
      return '#FF9800'; // Orange
    } else {
      return '#F44336'; // Red
    }
  };

  // D3 drawing logic
  const updateChart = useCallback(() => {
    if (!svgRef.current) return;

    console.log(`Running updateChart with width: ${widgetWidth}px`);
    
    const svg = d3.select(svgRef.current);
    const width = widgetWidth; // Use dynamic width
    const height = 120;
    const margin = { top: 15, right: 10, bottom: 25, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Set SVG dimensions explicitly
    svg.attr('width', width)
       .attr('height', height);

    // Clear previous content
    svg.selectAll('*').remove();

    // Create the main group with margins
    const g = svg.append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // Create scales
    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([0, innerWidth]);

    // Add background bar
    g.append('rect')
      .attr('x', 0)
      .attr('y', 0)
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('rx', 4)
      .attr('fill', '#1a1a1a')
      .attr('stroke', '#333')
      .attr('stroke-width', 1);

    // Add tick marks
    const ticks = [0, 25, 50, 75, 90, 100];
    ticks.forEach(tick => {
      g.append('line')
        .attr('x1', x(tick))
        .attr('x2', x(tick))
        .attr('y1', innerHeight)
        .attr('y2', innerHeight + 5)
        .attr('stroke', '#666')
        .attr('stroke-width', 1);

      g.append('text')
        .attr('x', x(tick))
        .attr('y', innerHeight + 15)
        .attr('text-anchor', 'middle')
        .attr('fill', '#666')
        .attr('font-size', '10px')
        .text(tick + '%');
    });

    if (data.length > 0) {
      const currentValue = data[0].shiftIndicator;
      const displayValue = Math.min(currentValue, 100);
      const barColor = getBarColor(currentValue);

      // Add glow filter for overrev state
      const defs = svg.append('defs');
      const filter = defs.append('filter')
        .attr('id', 'glow');
      
      filter.append('feGaussianBlur')
        .attr('stdDeviation', '2')
        .attr('result', 'coloredBlur');
      
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode')
        .attr('in', 'coloredBlur');
      feMerge.append('feMergeNode')
        .attr('in', 'SourceGraphic');

      // Add the solid color bar
      g.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', x(displayValue))
        .attr('height', innerHeight)
        .attr('rx', 4)
        .attr('fill', barColor)
        .attr('opacity', currentValue >= 90 && isFlashing ? 0.9 : 0.7)
        .attr('filter', currentValue >= 90 ? 'url(#glow)' : null);

      // Add RPM and shift point info
      if (shiftRpm > 0 && data[0].rpm > 0) {
        const rpm = data[0].rpm;
        const rpmPercentage = Math.min(100, (rpm / shiftRpm) * 100);
        
        // Add current RPM text
        g.append('text')
          .attr('x', innerWidth / 2)
          .attr('y', innerHeight / 2 - 10)
          .attr('text-anchor', 'middle')
          .attr('fill', '#ccc')
          .attr('font-size', '12px')
          .text(`${Math.round(rpm)} / ${Math.round(shiftRpm)} RPM`);
          
        // Add percentage text
        g.append('text')
          .attr('x', innerWidth / 2)
          .attr('y', innerHeight / 2 + 15)
          .attr('text-anchor', 'middle')
          .attr('fill', currentValue >= 90 && isFlashing ? '#ff0000' : '#fff')
          .attr('font-size', '24px')
          .attr('font-weight', 'bold')
          .text(`${Math.round(rpmPercentage)}%`);
      } else {
        // Fallback to just percentage if RPM data not available
        g.append('text')
          .attr('x', innerWidth / 2)
          .attr('y', innerHeight / 2 + 5)
          .attr('text-anchor', 'middle')
          .attr('fill', currentValue >= 90 && isFlashing ? '#ff0000' : '#fff')
          .attr('font-size', '24px')
          .attr('font-weight', 'bold')
          .text(`${Math.round(currentValue)}%`);
      }

      // Add shift indicator line at 90%
      if (currentValue >= 85) {
        g.append('line')
          .attr('x1', x(90))
          .attr('x2', x(90))
          .attr('y1', 0)
          .attr('y2', innerHeight)
          .attr('stroke', '#ff0000')
          .attr('stroke-width', 2)
          .attr('stroke-dasharray', '4,4')
          .attr('opacity', isFlashing ? 1 : 0.7);
      }
    }
  }, [data, isFlashing, shiftRpm, widgetWidth]); // Include widgetWidth

  // General chart update for data changes
  useEffect(() => {
    updateChart();
  }, [updateChart]);

  // Special effect to force chart update on width changes
  useEffect(() => {
    // This is a dedicated effect just for width changes
    console.log(`Width changed to ${widgetWidth}, forcing chart redraw`);
    if (svgRef.current) {
      // Immediately update SVG dimensions to match new width
      const svg = d3.select(svgRef.current);
      svg.attr('width', widgetWidth);
      
      // Schedule an immediate chart redraw
      requestAnimationFrame(() => {
        updateChart();
      });
    }
  }, [widgetWidth]);

  return (
    <Widget id={id} title="Shift Indicator" className="p-2" onClose={onClose}>
      <div 
        className="flex items-center justify-center overflow-visible" 
        style={{ width: `${widgetWidth}px`, height: "120px", maxWidth: "100%" }}
      >
        <svg
          ref={svgRef}
          width={widgetWidth}
          height={120}
          className="bg-transparent"
          style={{ pointerEvents: 'none' }}
        />
      </div>
    </Widget>
  );
};

// Define control definitions for the widget registry
const getShiftIndicatorControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default to 400 if not set
  const widgetWidth = widgetState.widgetWidth || 400;
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'widgetWidth',
      type: 'slider' as WidgetControlType,
      label: `Width: ${widgetWidth}px`,
      value: widgetWidth,
      options: [
        { value: 300, label: 'Small' },
        { value: 450, label: 'Medium' },
        { value: 600, label: 'Large' },
        { value: 750, label: 'X-Large' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        console.log(`Slider changed to: ${numericValue}px`);
        
        // Direct update to widget manager for immediate effect
        WidgetManager.updateWidgetState(widgetState.id, { widgetWidth: numericValue });
        
        // Update widget through the registry
        updateWidget({ widgetWidth: numericValue });
        
        // Also use direct dispatch as fallback
        try {
          dispatchWidgetStateUpdate(widgetState.id, { widgetWidth: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    }
  ];
  
  return controls;
};

// Wrap component with controls and export
const ShiftIndicatorWidget = withControls(ShiftIndicatorWidgetComponent, getShiftIndicatorControls);

export default ShiftIndicatorWidget; 