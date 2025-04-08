import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import BaseWidget from './BaseWidget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface TrackMapWidgetProps {
  id: string;
  onClose: () => void;
}

interface TrackPoint {
  x: number;
  y: number;
  lapDistPct: number;
  curvature?: number;
}

// Map building state
type MapBuildingState = 'idle' | 'recording' | 'complete';

const TrackMapWidget: React.FC<TrackMapWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const trackPointsRef = useRef<TrackPoint[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const lastPositionRef = useRef<TrackPoint | null>(null);
  const [mapBuildingState, setMapBuildingState] = useState<MapBuildingState>('idle');
  const [currentPosition, setCurrentPosition] = useState<number>(0);
  const mapCompleteRef = useRef<boolean>(false);
  
  // Use telemetry data with relevant metrics for track mapping
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: [
      'lateral_accel_ms2', 
      'longitudinal_accel_ms2',
      'lap_dist_pct',
      'lap_dist',
      'velocity_ms',
      'yaw_rate_deg_s'
    ],
    throttleUpdates: true,
    updateInterval: 50
  });

  // Start recording track data
  const startRecording = useCallback(() => {
    trackPointsRef.current = [];
    setTrackPoints([]);
    lastPositionRef.current = null;
    mapCompleteRef.current = false;
    setMapBuildingState('recording');
    console.log('Started recording track map data');
  }, []);

  // Stop recording and finalize track
  const stopRecording = useCallback(() => {
    setMapBuildingState('complete');
    mapCompleteRef.current = true;
    
    // Normalize the track to close the loop
    if (trackPointsRef.current.length > 10) {
      const normalizedTrack = normalizeTrack([...trackPointsRef.current]);
      setTrackPoints(normalizedTrack);
      console.log(`Track map completed with ${normalizedTrack.length} points`);
    }
  }, []);

  // Process telemetry data to build track map
  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'recording') return;

    const lapDistPct = telemetryData.lap_dist_pct || 0;
    const velocity = telemetryData.velocity_ms || 0;
    const lateralAccel = telemetryData.lateral_accel_ms2 || 0;
    const longitudinalAccel = telemetryData.longitudinal_accel_ms2 || 0;
    const yawRate = telemetryData.yaw_rate_deg_s || 0;
    
    // Skip if velocity is too low (car is nearly stationary)
    if (velocity < 5) return;
    
    // Calculate curvature (when speed is significant)
    let curvature = 0;
    if (velocity > 10) {
      curvature = lateralAccel / (velocity * velocity);
    }
    
    // Create new point - initially with relative positioning
    let newX = 0;
    let newY = 0;
    
    // If we have a previous point, calculate new position
    if (lastPositionRef.current) {
      const timeDelta = 0.05; // Based on update interval of 50ms
      
      // Simple dead reckoning - more sophisticated methods can be implemented
      const heading = Math.atan2(lastPositionRef.current.y, lastPositionRef.current.x) + 
                      (yawRate * Math.PI / 180) * timeDelta;
      
      // Calculate distance traveled
      const distance = velocity * timeDelta;
      
      // Update position
      newX = lastPositionRef.current.x + distance * Math.cos(heading);
      newY = lastPositionRef.current.y + distance * Math.sin(heading);
    }
    
    // Create new track point
    const newPoint: TrackPoint = {
      x: newX,
      y: newY,
      lapDistPct: lapDistPct,
      curvature: curvature
    };
    
    // Detect if we've completed a lap (only after collecting some points)
    if (trackPointsRef.current.length > 20) {
      const firstPoint = trackPointsRef.current[0];
      
      // If we've come back to the start point (within 2% of track), consider lap complete
      if (Math.abs(lapDistPct - firstPoint.lapDistPct) < 0.02) {
        stopRecording();
        return;
      }
    }
    
    // Update reference without causing a state update
    trackPointsRef.current = [...trackPointsRef.current, newPoint];
    lastPositionRef.current = newPoint;
    
    // Only update state when we need to redraw
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
        setTrackPoints([...trackPointsRef.current]);
        animationFrameId.current = null;
      });
    }
    
    // Always update current position for the car marker
    setCurrentPosition(lapDistPct);
    
  }, [telemetryData, mapBuildingState, stopRecording]);

  // Normalize track to create a closed loop
  const normalizeTrack = (points: TrackPoint[]): TrackPoint[] => {
    if (points.length < 10) return points;
    
    // Adjust coordinates to center the track and ensure it closes
    const minX = Math.min(...points.map(p => p.x));
    const maxX = Math.max(...points.map(p => p.x));
    const minY = Math.min(...points.map(p => p.y));
    const maxY = Math.max(...points.map(p => p.y));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Normalize points around center
    return points.map(point => ({
      ...point,
      x: point.x - centerX,
      y: point.y - centerY
    }));
  };

  // Track current position when map is complete
  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'complete') return;
    setCurrentPosition(telemetryData.lap_dist_pct || 0);
  }, [telemetryData, mapBuildingState]);

  // D3 drawing logic
  const updateChart = useCallback(() => {
    if (!svgRef.current) return;

    const svg = d3.select(svgRef.current);
    const width = 400;
    const height = 300;
    const margin = { top: 10, right: 10, bottom: 10, left: 10 };

    // Clear previous content
    svg.selectAll('*').remove();
    
    // Create a group for the track
    const trackGroup = svg.append('g');
    
    // Draw track if we have points
    if (trackPoints.length > 5) {
      // Scale track to fit in the SVG
      const xValues = trackPoints.map(p => p.x);
      const yValues = trackPoints.map(p => p.y);
      
      const xExtent = d3.extent(xValues) as [number, number];
      const yExtent = d3.extent(yValues) as [number, number];
      
      const xScale = d3.scaleLinear()
        .domain([xExtent[0] * 1.1, xExtent[1] * 1.1])
        .range([margin.left, width - margin.right]);
      
      const yScale = d3.scaleLinear()
        .domain([yExtent[0] * 1.1, yExtent[1] * 1.1])
        .range([height - margin.bottom, margin.top]);
        
      // Create line generator
      const line = d3.line<TrackPoint>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5));
      
      // Create track outline
      trackGroup.append('path')
        .datum(trackPoints)
        .attr('fill', 'none')
        .attr('stroke', '#4CAF50')
        .attr('stroke-width', 2)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', line);
      
      // Draw current position marker if map is complete
      if (mapBuildingState === 'complete') {
        // Find the closest point by lapDistPct
        const closestPointIndex = trackPoints.findIndex(
          point => Math.abs(point.lapDistPct - currentPosition) < 0.01
        );
        
        if (closestPointIndex >= 0) {
          const point = trackPoints[closestPointIndex];
          trackGroup.append('circle')
            .attr('cx', xScale(point.x))
            .attr('cy', yScale(point.y))
            .attr('r', 5)
            .attr('fill', 'red');
        }
      }
    } else if (mapBuildingState === 'recording') {
      // Show recording status
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('fill', '#FFFFFF')
        .text('Recording track data...');
    } else {
      // Show start instructions
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('fill', '#FFFFFF')
        .text('Drive a lap to map the track');
        
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 + 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#AAAAAA')
        .text('Click "Start Recording" to begin');
    }
  }, [trackPoints, mapBuildingState, currentPosition]);

  // Update chart when data changes
  useEffect(() => {
    updateChart();
  }, [updateChart]);

  return (
    <BaseWidget id={id} title="Track Map" className="track-map-widget">
      <div className="track-map-container" style={{ height: '350px' }}>
        <svg
          ref={svgRef}
          width={400}
          height={300}
          className="bg-gray-800/80"
        />
        <div className="controls mt-2 flex justify-between">
          {mapBuildingState === 'idle' && (
            <button 
              className="btn btn-sm btn-success"
              onClick={startRecording}>
              Start Recording
            </button>
          )}
          {mapBuildingState === 'recording' && (
            <button 
              className="btn btn-sm btn-warning"
              onClick={stopRecording}>
              Stop Recording
            </button>
          )}
          {mapBuildingState === 'complete' && (
            <button 
              className="btn btn-sm btn-primary"
              onClick={startRecording}>
              Record New Track
            </button>
          )}
        </div>
      </div>
    </BaseWidget>
  );
};

export default TrackMapWidget; 