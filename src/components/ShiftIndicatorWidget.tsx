import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { WebSocketService } from '../services/WebSocketService';
import BaseWidget from './BaseWidget';

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

  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    
    const handleTelemetry = (telemetry: any) => {
      const newData: ShiftData = {
        timestamp: Date.now(),
        shiftIndicator: telemetry.shift_indicator_pct || 0
      };

      setData(prev => {
        const updated = [...prev, newData].slice(-100); // Keep last 100 points
        return updated;
      });
    };

    webSocketService.addDataListener(id, handleTelemetry);

    return () => {
      webSocketService.removeListeners(id);
    };
  }, [id]);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 200;
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

    // Create line generator
    const line = d3.line<ShiftData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.shiftIndicator))
      .curve(d3.curveMonotoneX);

    // Add overrev zone (90-100%)
    svg.append('rect')
      .attr('x', margin.left)
      .attr('y', y(90))
      .attr('width', width - margin.left - margin.right)
      .attr('height', y(0) - y(90))
      .attr('fill', 'rgba(255, 0, 0, 0.1)')
      .attr('stroke', 'rgba(255, 0, 0, 0.3)')
      .attr('stroke-width', 1);

    // Add shift indicator line
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#4CAF50')
      .attr('stroke-width', 2)
      .attr('stroke-linejoin', 'round')
      .attr('stroke-linecap', 'round')
      .attr('d', line);

    // Add 90% threshold line
    svg.append('line')
      .attr('x1', margin.left)
      .attr('x2', width - margin.right)
      .attr('y1', y(90))
      .attr('y2', y(90))
      .attr('stroke', 'rgba(255, 0, 0, 0.5)')
      .attr('stroke-width', 1)
      .attr('stroke-dasharray', '4,4');

    // Add current value text
    if (data.length > 0) {
      const currentValue = data[data.length - 1].shiftIndicator;
      svg.append('text')
        .attr('x', width - margin.right - 5)
        .attr('y', y(currentValue) - 5)
        .attr('text-anchor', 'end')
        .attr('fill', currentValue >= 90 ? '#ff0000' : '#4CAF50')
        .attr('font-size', '12px')
        .text(`${currentValue.toFixed(1)}%`);
    }

  }, [data]);

  return (
    <BaseWidget id={id} title="Shift Indicator" className="">
      <svg
        ref={svgRef}
        width={400}
        height={200}
        className="bg-transparent"
      />
    </BaseWidget>
  );
};

export default ShiftIndicatorWidget; 