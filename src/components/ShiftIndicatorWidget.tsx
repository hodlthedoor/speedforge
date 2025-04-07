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
  const [isFlashing, setIsFlashing] = useState(false);

  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    
    const handleTelemetry = (telemetry: any) => {
      const newData: ShiftData = {
        timestamp: Date.now(),
        shiftIndicator: telemetry.shift_indicator_pct || 0
      };

      setData(prev => {
        const updated = [...prev, newData].slice(-1); // Only keep the latest value
        return updated;
      });
    };

    webSocketService.addDataListener(id, handleTelemetry);

    return () => {
      webSocketService.removeListeners(id);
    };
  }, [id]);

  // Handle flashing effect for overrev
  useEffect(() => {
    if (data.length > 0 && data[0].shiftIndicator >= 90) {
      const interval = setInterval(() => {
        setIsFlashing(prev => !prev);
      }, 500);
      return () => clearInterval(interval);
    } else {
      setIsFlashing(false);
    }
  }, [data]);

  useEffect(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 60;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([margin.left, width - margin.right]);

    // Define color zones
    const zones = [
      { start: 0, end: 60, color: '#4CAF50' },    // Green
      { start: 60, end: 75, color: '#FFEB3B' },   // Yellow
      { start: 75, end: 85, color: '#FF9800' },   // Orange
      { start: 85, end: 90, color: '#F44336' },   // Red
      { start: 90, end: 100, color: '#F44336' }   // Red (overrev)
    ];

    // Add color zones
    zones.forEach(zone => {
      svg.append('rect')
        .attr('x', x(zone.start))
        .attr('y', margin.top)
        .attr('width', x(zone.end) - x(zone.start))
        .attr('height', height - margin.top - margin.bottom)
        .attr('fill', zone.color)
        .attr('opacity', 0.3);
    });

    // Add current value bar
    if (data.length > 0) {
      const currentValue = data[0].shiftIndicator;
      const currentColor = zones.find(zone => currentValue >= zone.start && currentValue < zone.end)?.color || '#4CAF50';
      
      svg.append('rect')
        .attr('x', margin.left)
        .attr('y', margin.top)
        .attr('width', x(currentValue) - x(0))
        .attr('height', height - margin.top - margin.bottom)
        .attr('fill', currentValue >= 90 && isFlashing ? '#F44336' : currentColor)
        .attr('opacity', 0.7);
    }

    // Add tick marks and labels
    const ticks = [0, 20, 40, 60, 75, 85, 90, 100];
    ticks.forEach(tick => {
      // Add tick line
      svg.append('line')
        .attr('x1', x(tick))
        .attr('x2', x(tick))
        .attr('y1', height - margin.bottom - 5)
        .attr('y2', height - margin.bottom)
        .attr('stroke', '#666')
        .attr('stroke-width', 1);

      // Add tick label
      svg.append('text')
        .attr('x', x(tick))
        .attr('y', height - margin.bottom + 12)
        .attr('text-anchor', 'middle')
        .attr('fill', '#fff')
        .attr('font-size', '10px')
        .text(`${tick}%`);
    });

    // Add current value text
    if (data.length > 0) {
      const currentValue = data[0].shiftIndicator;
      svg.append('text')
        .attr('x', width - margin.right - 5)
        .attr('y', margin.top + 15)
        .attr('text-anchor', 'end')
        .attr('fill', '#fff')
        .attr('font-size', '14px')
        .text(`${currentValue.toFixed(1)}%`);
    }

  }, [data, isFlashing]);

  return (
    <BaseWidget id={id} title="Shift Indicator" className="">
      <svg
        ref={svgRef}
        width={400}
        height={60}
        className="bg-transparent"
      />
    </BaseWidget>
  );
};

export default ShiftIndicatorWidget; 