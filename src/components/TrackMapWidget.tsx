import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import BaseWidget from './BaseWidget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface TrackMapWidgetProps {
  id: string;
  onClose: () => void;
  onStateChange?: (state: { 
    mapBuildingState: MapBuildingState;
    colorMode: 'curvature' | 'acceleration' | 'none';
  }) => void;
  externalControls?: {
    mapBuildingState?: MapBuildingState;
    colorMode?: 'curvature' | 'acceleration' | 'none';
  };
}

interface TrackPoint {
  x: number;
  y: number;
  lapDistPct: number;
  curvature?: number;
  longitudinalAccel?: number;
}

interface TrackPosition {
  lapDistPct: number;
}

// Map building state
type MapBuildingState = 'idle' | 'recording' | 'complete';

const TrackMapWidget: React.FC<TrackMapWidgetProps> = ({ 
  id, 
  onClose,
  onStateChange,
  externalControls 
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const trackPointsRef = useRef<TrackPoint[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const lastPositionRef = useRef<TrackPoint | null>(null);
  const [mapBuildingState, setMapBuildingState] = useState<MapBuildingState>('idle');
  const [currentPosition, setCurrentPosition] = useState<TrackPosition>({ lapDistPct: 0 });
  const mapCompleteRef = useRef<boolean>(false);
  const startLapDistPctRef = useRef<number>(-1); // Reference to track starting position
  const [colorMode, setColorMode] = useState<'curvature' | 'acceleration' | 'none'>('none');
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(-1);
  
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
    
    // If first point, set it at origin
    if (trackPointsRef.current.length === 0) {
      newX = 0;
      newY = 0;
    }
    // Use inertia-based model for track points
    else if (lastPositionRef.current) {
      const timeDelta = 0.05; // Based on update interval of 50ms
      
      // Get the last position
      const lastX = lastPositionRef.current.x;
      const lastY = lastPositionRef.current.y;
      
      // Use a completely different approach:
      // 1. Primarily rely on the lap_dist_pct for track shape
      // 2. Use minimal turning input from vehicle
      
      // Extract direction of movement from previous points
      let heading = 0;
      
      // For the very beginning, establish an initial heading eastward
      if (trackPointsRef.current.length === 1) {
        heading = 0; // Start heading east (positive X axis)
      } 
      // Otherwise, get heading from previous movement
      else if (trackPointsRef.current.length >= 2) {
        // Use last 3 points for a more stable heading (if available)
        const numPointsToUse = Math.min(3, trackPointsRef.current.length - 1);
        const startIdx = trackPointsRef.current.length - 1 - numPointsToUse;
        
        // Average the heading over the last few points
        let sumDx = 0;
        let sumDy = 0;
        
        for (let i = startIdx; i < trackPointsRef.current.length - 1; i++) {
          const p1 = trackPointsRef.current[i];
          const p2 = trackPointsRef.current[i + 1];
          sumDx += p2.x - p1.x;
          sumDy += p2.y - p1.y;
        }
        
        // Use the average heading
        if (sumDx !== 0 || sumDy !== 0) {
          heading = Math.atan2(sumDy, sumDx);
        }
      }
      
      // EXTREMELY minimal yaw influence - just enough to indicate turning
      // This prevents spiral artifacts entirely
      const yawInfluence = Math.min(0.02, 1 / (velocity + 1)); // Even less influence at higher speeds
      heading += (yawRate * Math.PI / 180) * timeDelta * yawInfluence;
      
      // Base movement is just in the heading direction, scaled by velocity
      // This is the primary shape driver - simply moving forward at the current speed
      const distance = velocity * timeDelta;
      newX = lastX + distance * Math.cos(heading);
      newY = lastY + distance * Math.sin(heading);
      
      // Add minimal lateral adjustment to hint at track curvature without distorting
      // Use the actual change in lap_dist_pct to decide how much to curve the track
      if (trackPointsRef.current.length > 5) {
        const lapDistDelta = Math.abs(lapDistPct - lastPositionRef.current.lapDistPct);
        
        // Only apply this correction when moving significantly around the track
        // This helps avoid artifacts when the car is stationary or moving very slowly
        if (lapDistDelta > 0.001) {
          // Scale factor based on how far along track we've moved (keeps corners proportional)
          const cornerFactor = 0.0005 / Math.max(0.001, lapDistDelta);
          
          // Minimal lateral influence, capped to prevent extreme values
          const maxLateralInfluence = 0.5;
          const lateralInfluence = Math.sign(lateralAccel) * Math.min(Math.abs(lateralAccel) / 20, maxLateralInfluence);
          
          // Apply a very small perpendicular adjustment based on lateral acceleration
          newX += distance * lateralInfluence * -Math.sin(heading) * cornerFactor;
          newY += distance * lateralInfluence * Math.cos(heading) * cornerFactor;
        }
      }
      
      // Force track to close as we near completion of the lap (only when we're near the start)
      if (trackPointsRef.current.length > 20) {
        // If we're near the end of the lap (over 99%) and started near the beginning,
        // start gradually pulling the track toward the starting point
        if (lapDistPct > 0.99 && startLapDistPctRef.current < 0.01) {
          const firstPoint = trackPointsRef.current[0];
          const closingFactor = (lapDistPct - 0.99) / 0.01; // 0 at 99%, 1 at 100%
          
          // Pull toward the first point with increasing strength
          newX = newX * (1 - closingFactor) + firstPoint.x * closingFactor;
          newY = newY * (1 - closingFactor) + firstPoint.y * closingFactor;
        }
      }
    }
    
    // Create new track point
    const newPoint: TrackPoint = {
      x: newX,
      y: newY,
      lapDistPct: lapDistPct,
      curvature: curvature,
      longitudinalAccel: longitudinalAccel // Store longitudinal acceleration in track points
    };
    
    // Detect if we've completed a lap (only after collecting some points)
    if (trackPointsRef.current.length > 20) {
      // Use stored start position for comparison to detect a complete lap
      const lapStartPosition = startLapDistPctRef.current;
      
      // If we've completed a full lap (crossed start line)
      // For tracks where start position is near 0: we went from high pct to low pct
      // For tracks where start position is elsewhere: we're back to the same pct
      const completedLap = 
        (lapStartPosition < 0.01 && lapDistPct > 0.99 && lastPositionRef.current?.lapDistPct < 0.01) || 
        (Math.abs(lapDistPct - lapStartPosition) < 0.005 && 
         Math.abs(lapDistPct - lastPositionRef.current?.lapDistPct) > 0.003);
         
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
    setCurrentPosition({ lapDistPct });
    
  }, [telemetryData, mapBuildingState, stopRecording]);

  // Normalize track to create a closed loop
  const normalizeTrack = (points: TrackPoint[]): TrackPoint[] => {
    if (points.length < 10) return points;
    
    // First, ensure the track is properly closed
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    
    // If the track doesn't naturally close, add a final connecting point
    if (Math.sqrt(Math.pow(lastPoint.x - firstPoint.x, 2) + Math.pow(lastPoint.y - firstPoint.y, 2)) > 2) {
      points.push({
        ...firstPoint,
        lapDistPct: 1.0
      });
    }
    
    // Apply extremely lightweight smoothing
    const smoothedPoints: TrackPoint[] = [];
    const windowSize = 2; // Minimal smoothing window - just enough to remove jitter
    
    for (let i = 0; i < points.length; i++) {
      // Simple box filter - just average with adjacent points
      let sumX = points[i].x;
      let sumY = points[i].y;
      let count = 1;
      
      for (let j = Math.max(0, i - windowSize); j <= Math.min(points.length - 1, i + windowSize); j++) {
        if (j !== i) {
          // Use a rapidly decreasing weight for further points
          const weight = 0.5 / (Math.abs(i - j));
          sumX += points[j].x * weight;
          sumY += points[j].y * weight;
          count += weight;
        }
      }
      
      smoothedPoints.push({
        ...points[i],
        x: sumX / count,
        y: sumY / count
      });
    }
    
    // Adjust coordinates to center the track and ensure it closes
    const minX = Math.min(...smoothedPoints.map(p => p.x));
    const maxX = Math.max(...smoothedPoints.map(p => p.x));
    const minY = Math.min(...smoothedPoints.map(p => p.y));
    const maxY = Math.max(...smoothedPoints.map(p => p.y));
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Normalize points around center
    return smoothedPoints.map(point => ({
      ...point,
      x: point.x - centerX,
      y: point.y - centerY
    }));
  };

  // Track current position when map is complete
  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'complete') return;
    setCurrentPosition({ lapDistPct: telemetryData.lap_dist_pct || 0 });
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
      
      // Create line generator with proper interpolation for smooth curves
      const line = d3.line<TrackPoint>()
        .x(d => xScale(d.x))
        .y(d => yScale(d.y))
        .curve(d3.curveCatmullRom.alpha(0.3)); // Less aggressive smoothing
      
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
      
      // Highlight high lateral G corners with glowing markers
      const highGPoints = trackPoints.filter(p => p.curvature && Math.abs(p.curvature) > 0.01);
      highGPoints.forEach(point => {
        const cornerMagnitude = Math.min(1, Math.abs(point.curvature || 0) * 100);
        const cornerColor = point.curvature && point.curvature > 0 
          ? 'rgba(255,100,100,0.7)' // Right turn (positive curvature)
          : 'rgba(100,100,255,0.7)'; // Left turn (negative curvature)
          
        // Draw corner marker with size proportional to G force
        trackGroup.append('circle')
          .attr('cx', xScale(point.x))
          .attr('cy', yScale(point.y))
          .attr('r', 2 + cornerMagnitude * 3)
          .attr('fill', cornerColor)
          .attr('opacity', 0.5);
      });
      
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
            Math.abs(point.lapDistPct - currentPosition.lapDistPct),
            Math.abs(point.lapDistPct - currentPosition.lapDistPct + 1),
            Math.abs(point.lapDistPct - currentPosition.lapDistPct - 1)
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
        .text(`Position: ${(currentPosition.lapDistPct * 100).toFixed(1)}%`);
      
    } else if (mapBuildingState === 'recording') {
      // Show recording status with a more visual representation
      
      // Progress bar background
      svg.append('rect')
        .attr('x', 50)
        .attr('y', height / 2 - 40)
        .attr('width', width - 100)
        .attr('height', 4)
        .attr('rx', 2)
        .attr('fill', 'rgba(255, 255, 255, 0.2)');
      
      // Add percentage markers
      [0, 0.25, 0.5, 0.75, 1].forEach(pct => {
        // Marker dots
        svg.append('circle')
          .attr('cx', 50 + (width - 100) * pct)
          .attr('y', height / 2 - 40)
          .attr('r', pct === (telemetryData?.lap_dist_pct || 0) ? 5 : 3)
          .attr('fill', pct <= (telemetryData?.lap_dist_pct || 0) ? '#FFFFFF' : 'rgba(255, 255, 255, 0.3)');
          
        // Percentage labels
        svg.append('text')
          .attr('x', 50 + (width - 100) * pct)
          .attr('y', height / 2 - 50)
          .attr('text-anchor', 'middle')
          .attr('font-size', '10px')
          .attr('fill', 'rgba(255, 255, 255, 0.7)')
          .text(`${Math.round(pct * 100)}%`);
      });
      
      // Progress bar fill based on current position
      const currentPct = telemetryData?.lap_dist_pct || 0;
      const progressWidth = Math.max(0, Math.min(1, currentPct)) * (width - 100);
      
      svg.append('rect')
        .attr('x', 50)
        .attr('y', height / 2 - 40)
        .attr('width', progressWidth)
        .attr('height', 4)
        .attr('rx', 2)
        .attr('fill', () => {
          // Color changes as we progress
          if (currentPct < 0.33) return '#4CAF50'; // Green
          if (currentPct < 0.66) return '#FFEB3B'; // Yellow
          return '#F44336'; // Red
        });
      
      // Current position marker
      svg.append('circle')
        .attr('cx', 50 + progressWidth)
        .attr('cy', height / 2 - 38)
        .attr('r', 5)
        .attr('fill', 'white');
      
      // Status text
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('font-size', '16px')
        .attr('fill', '#FFFFFF')
        .text('Recording track data...');
      
      // Track position percentage
      svg.append('text')
        .attr('x', width / 2)
        .attr('y', height / 2 + 30)
        .attr('text-anchor', 'middle')
        .attr('font-size', '18px')
        .attr('fill', '#FFFFFF')
        .attr('font-weight', 'bold')
        .text(`Position: ${(currentPct * 100).toFixed(1)}%`);
      
      // Display telemetry data
      if (telemetryData) {
        // Speed display
        const speed = telemetryData.velocity_ms * 3.6; // to km/h
        svg.append('text')
          .attr('x', width / 2)
          .attr('y', height / 2 + 60)
          .attr('text-anchor', 'middle')
          .attr('font-size', '14px')
          .attr('fill', '#AAAAAA')
          .text(`Speed: ${speed.toFixed(0)} km/h`);
          
        // Lateral G display
        const lateralG = telemetryData.g_force_lat || 0;
        svg.append('text')
          .attr('x', width / 2 - 50)
          .attr('y', height / 2 + 85)
          .attr('text-anchor', 'middle')
          .attr('font-size', '14px')
          .attr('fill', Math.abs(lateralG) > 1.5 ? '#FFEB3B' : '#AAAAAA')
          .text(`Lat G: ${lateralG.toFixed(2)}`);
          
        // Longitudinal G display
        const longG = telemetryData.g_force_lon || 0;
        svg.append('text')
          .attr('x', width / 2 + 50)
          .attr('y', height / 2 + 85)
          .attr('text-anchor', 'middle')
          .attr('font-size', '14px')
          .attr('fill', Math.abs(longG) > 1.5 ? '#FFEB3B' : '#AAAAAA')
          .text(`Lon G: ${longG.toFixed(2)}`);
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

  // Update chart with D3
  useEffect(() => {
    if (!svgRef.current || trackPoints.length === 0) return;

    // Clear existing SVG
    d3.select(svgRef.current).selectAll("*").remove();

    // Create D3 selections
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    // Get the bounding box of our track
    const xValues = trackPoints.map(d => d.x);
    const yValues = trackPoints.map(d => d.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    // Calculate the scale to fit the track in the SVG with padding
    const padding = 20;
    const xScale = (width - 2 * padding) / (maxX - minX);
    const yScale = (height - 2 * padding) / (maxY - minY);
    const scale = Math.min(xScale, yScale);

    // Calculate the center adjustment
    const centerX = (width / 2) - (((maxX + minX) / 2) * scale);
    const centerY = (height / 2) - (((maxY + minY) / 2) * scale);

    // Create a group for the track
    const trackGroup = svg.append("g")
      .attr("transform", `translate(${centerX}, ${centerY})`);

    // Define color scale for curvature
    const curvatureColorScale = d3.scaleLinear<string>()
      .domain([-0.01, 0, 0.01])
      .range(["#ff0000", "#ffffff", "#0000ff"]);

    // Define color scale for longitudinal acceleration (braking to acceleration)
    const accelerationColorScale = d3.scaleLinear<string>()
      .domain([-8, -2, 0, 2, 8]) 
      .range(["#ff0000", "#ff9900", "#ffffff", "#66cc00", "#00cc00"]);

    // Draw the track as a series of line segments with color based on both curvature and longitudinal accel
    for (let i = 1; i < trackPoints.length; i++) {
      const p1 = trackPoints[i - 1];
      const p2 = trackPoints[i];
      
      // Choose color based on user preference
      let segmentColor;
      if (colorMode === 'curvature') {
        segmentColor = curvatureColorScale(p2.curvature || 0);
      } else if (colorMode === 'acceleration') {
        segmentColor = accelerationColorScale(p2.longitudinalAccel || 0);
      } else {
        segmentColor = "#ffffff"; // Default white
      }
      
      trackGroup.append("line")
        .attr("x1", p1.x * scale)
        .attr("y1", p1.y * scale)
        .attr("x2", p2.x * scale)
        .attr("y2", p2.y * scale)
        .attr("stroke", segmentColor)
        .attr("stroke-width", 2);
    }

    // Draw a marker at the start/finish line
    if (trackPoints.length > 0) {
      trackGroup.append("circle")
        .attr("cx", trackPoints[0].x * scale)
        .attr("cy", trackPoints[0].y * scale)
        .attr("r", 5)
        .attr("fill", "#00ff00");
    }

    // Draw the current position
    if (currentPositionIndex >= 0 && currentPositionIndex < trackPoints.length) {
      const currentPoint = trackPoints[currentPositionIndex];
      trackGroup.append("circle")
        .attr("cx", currentPoint.x * scale)
        .attr("cy", currentPoint.y * scale)
        .attr("r", 7)
        .attr("fill", "#ffff00");
    }
  }, [trackPoints, currentPositionIndex, colorMode]);

  // Update current position marker when lap distance changes
  useEffect(() => {
    if (trackPoints.length > 0 && currentPosition.lapDistPct !== undefined) {
      // Find the closest track point to the current lap distance percentage
      const index = trackPoints.findIndex(point => 
        point.lapDistPct >= currentPosition.lapDistPct
      );
      setCurrentPositionIndex(index !== -1 ? index : -1);
    } else {
      setCurrentPositionIndex(-1);
    }
  }, [currentPosition.lapDistPct, trackPoints]);

  // Sync with external controls
  useEffect(() => {
    if (externalControls?.mapBuildingState) {
      setMapBuildingState(externalControls.mapBuildingState);
    }
    if (externalControls?.colorMode) {
      setColorMode(externalControls.colorMode);
    }
  }, [externalControls]);

  // Notify parent component of state changes
  useEffect(() => {
    onStateChange?.({
      mapBuildingState,
      colorMode
    });
  }, [mapBuildingState, colorMode, onStateChange]);

  return (
    <BaseWidget id={id} title="Track Map" className="track-map-widget">
      <div className="track-map-container" style={{ height: '350px' }}>
        <svg
          ref={svgRef}
          width={400}
          height={300}
          className="bg-gray-800/80"
        />
        {mapBuildingState === 'idle' && (
          <div className="text-sm text-gray-300 text-center mt-2">
            Waiting for car movement near start/finish line...
          </div>
        )}
        {mapBuildingState === 'recording' && (
          <div className="text-sm text-gray-300 text-center mt-2">
            Recording track data...
          </div>
        )}
      </div>
    </BaseWidget>
  );
};

export default TrackMapWidget; 