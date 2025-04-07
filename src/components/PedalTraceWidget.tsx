import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { WebSocketService } from '../services/WebSocketService';
import BaseWidget from './BaseWidget';

interface PedalTraceWidgetProps {
  id: string;
  onClose: () => void;
}

interface PedalData {
  timestamp: number;
  throttle: number;
  brake: number;
  clutch: number;
}

const PedalTraceWidget: React.FC<PedalTraceWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<PedalData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    
    const handleTelemetry = (telemetry: any) => {
      setIsConnected(true);
      setIsLoading(false);
      
      const newData: PedalData = {
        timestamp: Date.now(),
        throttle: telemetry.throttle_pct || 0,
        brake: telemetry.brake_pct || 0,
        clutch: telemetry.clutch_pct || 0
      };

      setData(prev => {
        const updated = [...prev, newData].slice(-100); // Keep last 100 points
        return updated;
      });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    webSocketService.addDataListener(id, handleTelemetry);
    webSocketService.addConnectionListener(id, (status) => {
      setIsConnected(status);
      setIsLoading(false);
    });

    return () => {
      webSocketService.removeListeners(id);
    };
  }, [id]);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 200;
    const margin = { top: 20, right: 20, bottom: 30, left: 40 };

    // Clear previous content
    svg.selectAll('*').remove();

    // Create scales
    const x = d3.scaleTime()
      .domain([data[0].timestamp, data[data.length - 1].timestamp])
      .range([margin.left, width - margin.right]);

    const y = d3.scaleLinear()
      .domain([0, 100])
      .range([height - margin.bottom, margin.top]);

    // Create axes
    const xAxis = d3.axisBottom(x)
      .ticks(5)
      .tickFormat(d3.timeFormat('%H:%M:%S') as any);

    const yAxis = d3.axisLeft(y)
      .ticks(5)
      .tickFormat(d => `${d}%`);

    // Add axes
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(xAxis);

    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(yAxis);

    // Create line generators
    const line = d3.line<PedalData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.throttle));

    const brakeLine = d3.line<PedalData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.brake));

    const clutchLine = d3.line<PedalData>()
      .x(d => x(d.timestamp))
      .y(d => y(d.clutch));

    // Add lines
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#4CAF50')
      .attr('stroke-width', 2)
      .attr('d', line);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#F44336')
      .attr('stroke-width', 2)
      .attr('d', brakeLine);

    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#2196F3')
      .attr('stroke-width', 2)
      .attr('d', clutchLine);

    // Add legend
    const legend = svg.append('g')
      .attr('transform', `translate(${width - margin.right - 100},${margin.top})`);

    legend.append('rect')
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', '#4CAF50');

    legend.append('text')
      .attr('x', 15)
      .attr('y', 10)
      .text('Throttle')
      .style('font-size', '12px');

    legend.append('rect')
      .attr('y', 20)
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', '#F44336');

    legend.append('text')
      .attr('x', 15)
      .attr('y', 30)
      .text('Brake')
      .style('font-size', '12px');

    legend.append('rect')
      .attr('y', 40)
      .attr('width', 10)
      .attr('height', 10)
      .attr('fill', '#2196F3');

    legend.append('text')
      .attr('x', 15)
      .attr('y', 50)
      .text('Clutch')
      .style('font-size', '12px');

  }, [data]);

  return (
    <BaseWidget
      id={id}
      title="Pedal Traces"
      onClose={onClose}
    >
      {isLoading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
          <p className="mt-2">Connecting to telemetry...</p>
        </div>
      ) : !isConnected ? (
        <div className="text-center py-8">
          <p className="text-red-500">Disconnected from telemetry</p>
        </div>
      ) : (
        <svg
          ref={svgRef}
          width={400}
          height={200}
          className="bg-gray-900 rounded"
        />
      )}
    </BaseWidget>
  );
};

export default PedalTraceWidget; 