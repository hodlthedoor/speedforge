import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { WebSocketService } from '../services/WebSocketService';
import BaseDraggableComponent from './BaseDraggableComponent';

interface PedalTraceWidgetProps {
  id: string;
  onClose: () => void;
}

interface PedalData {
  timestamp: number;
  throttle: number;
  brake: number;
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
        brake: telemetry.brake_pct || 0
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

  return (
    <BaseDraggableComponent className="bg-gray-800/70 rounded overflow-hidden drag-handle">
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
          className="bg-transparent"
        />
      )}
    </BaseDraggableComponent>
  );
};

export default PedalTraceWidget; 