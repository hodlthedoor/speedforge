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
  const startLapDistPctRef = useRef<number>(-1); // Reference to track starting position
  
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

  // Auto-start recording when conditions are met
  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'idle') return;

    const speed = telemetryData.velocity_ms || 0;
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    
    // Auto-start recording when:
    // 1. Car is moving reasonably fast (above 10 m/s or ~36 km/h)
    // 2. We're near the start/finish line (within 5% of 0.0 or 1.0)
    if (speed > 10 && (lapDistPct < 0.05 || lapDistPct > 0.95)) {
      console.log('Auto-starting track recording');
      startRecording();
    }
  }, [telemetryData, mapBuildingState]);

  // Start recording track data
  const startRecording = useCallback(() => {
    trackPointsRef.current = [];
    setTrackPoints([]);
    lastPositionRef.current = null;
    mapCompleteRef.current = false;
    
    // Store the starting lap distance percentage
    const currentLapDistPct = telemetryData?.lap_dist_pct || 0;
    startLapDistPctRef.current = currentLapDistPct;
    
    setMapBuildingState('recording');
    console.log('Started recording track map data');
  }, [telemetryData]);

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
      // Use stored start position for comparison to detect a complete lap
      const lapStartPosition = startLapDistPctRef.current;
      
      // If we've completed a full lap (crossed start line)
      // For tracks where start position is near 0: we went from high pct to low pct
      // For tracks where start position is elsewhere: we're back to the same pct
      const completedLap = 
        (lapStartPosition < 0.05 && lapDistPct > 0.95 && lastPositionRef.current?.lapDistPct < 0.05) || 
        (Math.abs(lapDistPct - lapStartPosition) < 0.02 && 
         Math.abs(lapDistPct - lastPositionRef.current?.lapDistPct) > 0.01);
         
      if (completedLap) {
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
      
      // Calculate scale to maintain aspect ratio
      const xRange = xExtent[1] - xExtent[0];
      const yRange = yExtent[1] - yExtent[0];
      const scale = Math.min(
        (width - margin.left - margin.right) / xRange,
        (height - margin.top - margin.bottom) / yRange
      ) * 0.9; // 10% padding
      
      // Center the track in the available space
      const centerX = (width - margin.left - margin.right) / 2 + margin.left;
      const centerY = (height - margin.top - margin.bottom) / 2 + margin.top;
      
      // Create custom scales that maintain aspect ratio
      const xScale = (x: number) => centerX + (x - (xExtent[0] + xExtent[1]) / 2) * scale;
      const yScale = (y: number) => centerY + (y - (yExtent[0] + yExtent[1]) / 2) * scale;
      
      // Create line generator
      const line = d3.line<TrackPoint>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.5));
      
      // Draw track sectors
      // Sector 1: 0-33%, Sector 2: 33-66%, Sector 3: 66-100%
      const sector1Points = trackPoints.filter(p => p.lapDistPct >= 0 && p.lapDistPct < 0.33);
      const sector2Points = trackPoints.filter(p => p.lapDistPct >= 0.33 && p.lapDistPct < 0.66);
      const sector3Points = trackPoints.filter(p => p.lapDistPct >= 0.66 && p.lapDistPct <= 1);
      
      if (sector1Points.length > 0) {
        trackGroup.append('path')
          .datum(sector1Points)
          .attr('fill', 'none')
          .attr('stroke', '#4CAF50') // Green
          .attr('stroke-width', 3)
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .attr('d', line);
      }
      
      if (sector2Points.length > 0) {
        trackGroup.append('path')
          .datum(sector2Points)
          .attr('fill', 'none')
          .attr('stroke', '#FFEB3B') // Yellow
          .attr('stroke-width', 3)
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .attr('d', line);
      }
      
      if (sector3Points.length > 0) {
        trackGroup.append('path')
          .datum(sector3Points)
          .attr('fill', 'none')
          .attr('stroke', '#F44336') // Red
          .attr('stroke-width', 3)
          .attr('stroke-linejoin', 'round')
          .attr('stroke-linecap', 'round')
          .attr('d', line);
      }
      
      // Add start/finish line
      const startPoint = trackPoints.find(p => p.lapDistPct < 0.01);
      if (startPoint) {
        // Find direction by looking at next point
        const nextPoint = trackPoints.find(p => p.lapDistPct > 0.01 && p.lapDistPct < 0.02);
        if (nextPoint) {
          const dx = nextPoint.x - startPoint.x;
          const dy = nextPoint.y - startPoint.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const unitX = dx / length;
          const unitY = dy / length;
          
          // Perpendicular vector
          const perpX = -unitY;
          const perpY = unitX;
          
          // Draw start/finish line
          trackGroup.append('line')
            .attr('x1', xScale(startPoint.x + perpX * 5))
            .attr('y1', yScale(startPoint.y + perpY * 5))
            .attr('x2', xScale(startPoint.x - perpX * 5))
            .attr('y2', yScale(startPoint.y - perpY * 5))
            .attr('stroke', 'white')
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '2,2');
        }
      }
      
      // Draw current position marker if map is complete
      if (mapBuildingState === 'complete' || mapBuildingState === 'recording') {
        // Find the closest point by lapDistPct
        let closestPoint = trackPoints[0];
        let minDist = 1;
        
        for (const point of trackPoints) {
          const dist = Math.min(
            Math.abs(point.lapDistPct - currentPosition),
            Math.abs(point.lapDistPct - currentPosition + 1),
            Math.abs(point.lapDistPct - currentPosition - 1)
          );
          
          if (dist < minDist) {
            minDist = dist;
            closestPoint = point;
          }
        }
        
        // Draw car position
        trackGroup.append('circle')
          .attr('cx', xScale(closestPoint.x))
          .attr('cy', yScale(closestPoint.y))
          .attr('r', 5)
          .attr('fill', 'white')
          .attr('stroke', 'black')
          .attr('stroke-width', 1.5);
        
        // Add motion blur/trail behind car
        const trailPoints = [];
        let trailIndex = trackPoints.indexOf(closestPoint);
        for (let i = 1; i <= 10; i++) {
          const prevIndex = (trailIndex - i + trackPoints.length) % trackPoints.length;
          trailPoints.push(trackPoints[prevIndex]);
        }
        
        trailPoints.forEach((point, i) => {
          const opacity = 0.8 - (i / 10) * 0.8;
          const size = 4 - (i / 10) * 3;
          
          trackGroup.append('circle')
            .attr('cx', xScale(point.x))
            .attr('cy', yScale(point.y))
            .attr('r', size)
            .attr('fill', 'white')
            .attr('opacity', opacity);
        });
      }
      
      // Add sector markers
      [0.33, 0.66].forEach(sector => {
        const sectorPoint = trackPoints.find(p => Math.abs(p.lapDistPct - sector) < 0.01);
        if (sectorPoint) {
          trackGroup.append('circle')
            .attr('cx', xScale(sectorPoint.x))
            .attr('cy', yScale(sectorPoint.y))
            .attr('r', 3)
            .attr('fill', 'white')
            .attr('opacity', 0.8);
        }
      });
      
      // Add track percentage labels
      [0, 0.25, 0.5, 0.75].forEach(pct => {
        const labelPoint = trackPoints.find(p => Math.abs(p.lapDistPct - pct) < 0.01);
        if (labelPoint) {
          trackGroup.append('text')
            .attr('x', xScale(labelPoint.x))
            .attr('y', yScale(labelPoint.y) - 8)
            .attr('text-anchor', 'middle')
            .attr('font-size', '10px')
            .attr('fill', 'rgba(255,255,255,0.7)')
            .text(`${Math.round(pct * 100)}%`);
        }
      });
      
      // Add current percentage display
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height - 5)
        .attr('text-anchor', 'middle')
        .attr('font-size', '12px')
        .attr('fill', 'white')
        .text(`Position: ${(currentPosition * 100).toFixed(1)}%`);
      
    } else if (mapBuildingState === 'recording') {
      // Show recording status
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('fill', '#FFFFFF')
        .text('Recording track data...');
      
      // Show lap percentage
      if (telemetryData?.lap_dist_pct) {
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2 + 30)
          .attr('text-anchor', 'middle')
          .attr('font-size', '14px')
          .attr('fill', '#AAAAAA')
          .text(`Track position: ${(telemetryData.lap_dist_pct * 100).toFixed(1)}%`);
      }
    } else {
      // Show start instructions
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 - 20)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('fill', '#FFFFFF')
        .text('Drive near start/finish line');
        
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 + 10)
        .attr('text-anchor', 'middle')
        .attr('font-size', '14px')
        .attr('fill', '#AAAAAA')
        .text('Recording will start automatically');
      
      if (telemetryData?.velocity_ms) {
        const speed = telemetryData.velocity_ms * 3.6; // Convert to km/h
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2 + 40)
          .attr('text-anchor', 'middle')
          .attr('font-size', '12px')
          .attr('fill', speed > 30 ? '#4CAF50' : '#AAAAAA')
          .text(`Current speed: ${speed.toFixed(1)} km/h`);
      }
    }
  }, [trackPoints, mapBuildingState, currentPosition, telemetryData]);

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
            <div className="text-sm text-gray-300">
              Waiting for car movement near start/finish line...
            </div>
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