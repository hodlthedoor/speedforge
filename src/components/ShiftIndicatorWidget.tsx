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
    const height = 32;
    const margin = { top: 0, right: 0, bottom: 0, left: 0 };

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const x = d3.scaleLinear()
      .domain([0, 100])
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

  return (
    <BaseWidget id={id} title="Shift Indicator" className="p-0">
      <div className="w-full py-2 flex items-center justify-center">
        <svg
          ref={svgRef}
          width={400}
          height={32}
          className="bg-transparent"
          style={{ pointerEvents: 'none' }}
        />
      </div>
    </BaseWidget>
  );
};

export default ShiftIndicatorWidget; 