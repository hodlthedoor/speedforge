import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface ShiftIndicatorWidgetProps {
  id: string;
  onClose: () => void;
}

interface ShiftData {
  timestamp: number;
  shiftIndicator: number;
}

const ShiftIndicatorWidget: React.FC<ShiftIndicatorWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<ShiftData[]>([]);
  const dataRef = useRef<ShiftData[]>([]);
  const [isFlashing, setIsFlashing] = useState(false);
  const flashingTimerRef = useRef<number | null>(null);
  const animationFrameId = useRef<number | null>(null);
  
  // Use our custom hook with shift indicator metric
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: ['shift_indicator_pct']
  });

  // Transform telemetry data into our visualization format
  useEffect(() => {
    if (telemetryData) {
      const newData: ShiftData = {
        timestamp: Date.now(),
        shiftIndicator: telemetryData.shift_indicator_pct || 0
      };

      // Update ref without causing a state update
      dataRef.current = [newData]; // Only keep the latest value
      
      // Only update state when needed
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
    // Clear any existing interval
    if (flashingTimerRef.current) {
      clearInterval(flashingTimerRef.current);
      flashingTimerRef.current = null;
    }
    
    if (data.length > 0 && data[0].shiftIndicator >= 90) {
      flashingTimerRef.current = window.setInterval(() => {
        setIsFlashing(prev => !prev);
      }, 500);
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

  // D3 drawing logic
  const updateChart = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 80;
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const x = d3.scaleLinear()
      .domain([0, 90])
      .range([0, width]);

    // Define color zones
    const zones = [
      { start: 0, end: 60, color: '#4CAF50' },    // Green
      { start: 60, end: 75, color: '#FFEB3B' },   // Yellow
      { start: 75, end: 85, color: '#FF9800' },   // Orange
      { start: 85, end: 90, color: '#F44336' }    // Red
    ];

    // Add color zones
    zones.forEach(zone => {
      svg.append('rect')
        .attr('x', x(zone.start))
        .attr('y', 0)
        .attr('width', x(zone.end) - x(zone.start))
        .attr('height', height)
        .attr('fill', zone.color)
        .attr('opacity', 0.3);
    });

    // Add current value bar
    if (data.length > 0) {
      const currentValue = data[0].shiftIndicator;
      const displayValue = Math.min(currentValue, 90); // Cap at 90% for display
      const currentColor = zones.find(zone => currentValue >= zone.start && currentValue < zone.end)?.color || '#4CAF50';
      
      // Add the main bar
      svg.append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', x(displayValue))
        .attr('height', height)
        .attr('fill', currentValue >= 90 && isFlashing ? '#F44336' : currentColor)
        .attr('opacity', 0.7);

      // If in overrev, add a thin red line at 90%
      if (currentValue >= 90) {
        svg.append('line')
          .attr('x1', x(90))
          .attr('x2', x(90))
          .attr('y1', 0)
          .attr('y2', height)
          .attr('stroke', '#F44336')
          .attr('stroke-width', 2)
          .attr('opacity', isFlashing ? 1 : 0.5);
      }
    }
  }, [data, isFlashing]);

  // Only update chart when data or flashing state changes
  useEffect(() => {
    updateChart();
  }, [updateChart]);

  return (
    <Widget id={id} title="Shift Indicator" className="p-0" onClose={onClose}>
      <div className="w-full h-full">
        <svg
          ref={svgRef}
          width={400}
          height={80}
          className="bg-transparent w-full h-full"
          style={{ pointerEvents: 'none' }}
        />
      </div>
    </Widget>
  );
};

export default ShiftIndicatorWidget; 