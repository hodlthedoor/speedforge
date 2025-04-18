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
  const widgetWidthRef = useRef<number>(400);
  
  // Update the ref whenever width changes
  useEffect(() => {
    widgetWidthRef.current = widgetWidth;
  }, [widgetWidth]);
  
  // Use the widget state update hook to listen for width changes
  useWidgetStateUpdates(id, (state) => {
    if (state.widgetWidth !== undefined) {
      const newWidth = Number(state.widgetWidth);
      if (widgetWidthRef.current !== newWidth) {
        setWidgetWidth(newWidth);
      }
    }
  });
  
  // WidgetManager integration
  useEffect(() => {
    // Get initial state from WidgetManager
    const widget = WidgetManager.getWidget(id);
    if (widget) {
      if (widget.state) {
        if (widget.state.widgetWidth !== undefined && widget.state.widgetWidth !== widgetWidth) {
          setWidgetWidth(Number(widget.state.widgetWidth));
        }
      } else {
        // Set initial state in WidgetManager
        WidgetManager.updateWidgetState(id, { widgetWidth });
      }
    } else {
      // If widget doesn't exist in WidgetManager at all
      WidgetManager.updateWidgetState(id, { widgetWidth });
    }
    
    // Subscribe to future state changes
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.widgetWidth !== undefined && event.state.widgetWidth !== widgetWidthRef.current) {
          setWidgetWidth(Number(event.state.widgetWidth));
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]);
  
  // Sync width changes with WidgetManager
  useEffect(() => {
    // Skip initial render
    if (widgetWidthRef.current === widgetWidth) return;
    
    WidgetManager.updateWidgetState(id, { widgetWidth });
    
    // Redraw when width changes
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
        updateChart();
        animationFrameId.current = null;
      });
    }
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

    const svg = d3.select(svgRef.current);
    const width = widgetWidth; // Use dynamic width
    const height = 120;
    const margin = { top: 15, right: 10, bottom: 25, left: 10 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Set SVG dimensions
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
  }, [data, isFlashing, shiftRpm, widgetWidth]);

  useEffect(() => {
    updateChart();
  }, [updateChart]);

  return (
    <Widget id={id} title="Shift Indicator" className="p-2" onClose={onClose}>
      <div className="w-full h-full flex items-center justify-center">
        <svg
          ref={svgRef}
          width={widgetWidth}
          height={120}
          className="bg-transparent w-full h-full"
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
        
        // Update widget state through the registry
        updateWidget({ widgetWidth: numericValue });
        
        // Also use direct update mechanism as fallback
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { widgetWidth: numericValue });
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