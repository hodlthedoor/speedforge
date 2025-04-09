import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import BaseWidget from './BaseWidget';
import { useTelemetryData } from '../hooks/useTelemetryData';

// Track Surface enum
enum TrackSurface {
  OffTrack = 0,
  PitStall = 1,
  PitLane = 2,
  OnTrack = 3,
  NotInWorld = 4
}

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
  heading?: number;
}

interface TrackPosition {
  lapDistPct: number;
}

type MapBuildingState = 'idle' | 'recording' | 'complete';

const TrackMapWidget: React.FC<TrackMapWidgetProps> = ({ 
  id, 
  onClose,
  onStateChange,
  externalControls 
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastPositionRef = useRef<TrackPoint | null>(null);
  const trackPointsRef = useRef<TrackPoint[]>([]);
  const mapCompleteRef = useRef<boolean>(false);
  const startLapDistPctRef = useRef<number>(-1);
  const lastTimeRef = useRef<number | null>(null);
  const offTrackCountRef = useRef<number>(0);

  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [mapBuildingState, setMapBuildingState] = useState<MapBuildingState>('idle');
  const [currentPosition, setCurrentPosition] = useState<TrackPosition>({ lapDistPct: 0 });
  const [colorMode, setColorMode] = useState<'curvature' | 'acceleration' | 'none'>('none');
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(-1);
  const [lapInvalidated, setLapInvalidated] = useState<boolean>(false);

  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: [
      'lateral_accel_ms2', 
      'longitudinal_accel_ms2',
      'lap_dist_pct',
      'lap_dist',
      'velocity_ms',
      'yaw_rate_deg_s',
      'VelocityX',
      'VelocityY',
      'VelocityZ',
      'PlayerTrackSurface'
    ],
    throttleUpdates: true,
    updateInterval: 50
  });

  useEffect(() => {
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'idle') return;
    
    // Never restart recording if we've completed a lap previously
    if (mapCompleteRef.current) return;
    
    const speed = telemetryData.velocity_ms || 0;
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    const trackSurface = telemetryData.PlayerTrackSurface as number;
    if (speed > 10 && (lapDistPct < 0.05 || lapDistPct > 0.95) && trackSurface === TrackSurface.OnTrack) startRecording();
  }, [telemetryData, mapBuildingState]);

  const startRecording = useCallback(() => {
    trackPointsRef.current = [];
    setTrackPoints([]);
    lastPositionRef.current = null;
    mapCompleteRef.current = false;
    lastTimeRef.current = null;
    offTrackCountRef.current = 0;
    startLapDistPctRef.current = telemetryData?.lap_dist_pct || 0;
    setMapBuildingState('recording');
  }, [telemetryData]);

  const stopRecording = useCallback(() => {
    setMapBuildingState('complete');
    mapCompleteRef.current = true;
    if (trackPointsRef.current.length > 10) {
      // Sort points by lap distance percentage to ensure correct order
      const sortedPoints = [...trackPointsRef.current].sort((a, b) => a.lapDistPct - b.lapDistPct);
      const normalizedTrack = normalizeTrack(sortedPoints);
      setTrackPoints(normalizedTrack);
    }
  }, []);

  const cancelRecording = useCallback(() => {
    // Reset the state but don't set mapCompleteRef.current to true
    // so we can start a new recording
    trackPointsRef.current = [];
    setTrackPoints([]);
    lastPositionRef.current = null;
    offTrackCountRef.current = 0;
    setMapBuildingState('idle');
    
    // Set lap invalidated flag to show message
    setLapInvalidated(true);
    
    // Clear the invalidated message after 5 seconds
    setTimeout(() => {
      setLapInvalidated(false);
    }, 5000);
  }, []);

  const normalizeTrack = useCallback((points: TrackPoint[]): TrackPoint[] => {
    if (points.length < 10) return points;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distToClose = Math.sqrt((lastPoint.x - firstPoint.x)**2 + (lastPoint.y - firstPoint.y)**2);
    if (distToClose > 2) {
      points.push({ ...firstPoint, lapDistPct: 1.0 });
    }
    const smoothedPoints: TrackPoint[] = [];
    const windowSize = 2;
    for (let i = 0; i < points.length; i++) {
      const neighbors: TrackPoint[] = [];
      for (let j = Math.max(0, i - windowSize); j <= Math.min(points.length - 1, i + windowSize); j++) {
        if (j !== i) neighbors.push(points[j]);
      }
      if (neighbors.length > 0) {
        const avgX = neighbors.reduce((sum, p) => sum + p.x, 0) / neighbors.length;
        const avgY = neighbors.reduce((sum, p) => sum + p.y, 0) / neighbors.length;
        const dist = Math.sqrt((points[i].x - avgX)**2 + (points[i].y - avgY)**2);
        const distThreshold = 5;
        if (dist > distThreshold) {
          smoothedPoints.push({
            ...points[i],
            x: points[i].x * 0.7 + avgX * 0.3,
            y: points[i].y * 0.7 + avgY * 0.3
          });
        } else {
          smoothedPoints.push(points[i]);
        }
      } else {
        smoothedPoints.push(points[i]);
      }
    }
    const xVals = smoothedPoints.map(p => p.x);
    const yVals = smoothedPoints.map(p => p.y);
    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    return smoothedPoints.map(p => ({ ...p, x: p.x - centerX, y: p.y - centerY }));
  }, []);

  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'recording') return;
    const now = performance.now();
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    const velocity = telemetryData.velocity_ms || 0;
    const lateralAccel = telemetryData.lateral_accel_ms2 || 0;
    const longitudinalAccel = telemetryData.longitudinal_accel_ms2 || 0;
    const velForward = telemetryData.VelocityX || 0;
    const velSide = telemetryData.VelocityY || 0;
    const trackSurface = telemetryData.PlayerTrackSurface as number;
    
    // Check if the car is on track
    if (trackSurface !== TrackSurface.OnTrack) {
      offTrackCountRef.current += 1;
      
      // If we have 4 consecutive off-track datapoints, cancel the recording
      if (offTrackCountRef.current >= 4) {
        cancelRecording();
        return;
      }
    } else {
      // Reset off-track counter when back on track
      offTrackCountRef.current = 0;
    }
    
    // Only record when on track and moving
    if (velocity < 5 || trackSurface !== TrackSurface.OnTrack) return;
    
    let timeDelta = 0.05;
    if (lastTimeRef.current !== null) {
      timeDelta = (now - lastTimeRef.current) / 1000;
      if (timeDelta > 0.2) timeDelta = 0.05;
    }
    lastTimeRef.current = now;
    let curvature = 0;
    if (velocity > 10) curvature = lateralAccel / (velocity * velocity);
    let newX = 0, newY = 0, currentHeading = 0;
    if (trackPointsRef.current.length === 0) {
      newX = 0; newY = 0; currentHeading = 0;
    } else if (lastPositionRef.current) {
      const lastX = lastPositionRef.current.x;
      const lastY = lastPositionRef.current.y;
      const yawRateDegSec = telemetryData.yaw_rate_deg_s || 0;
      const yawRateRadSec = (yawRateDegSec * Math.PI) / 180;
      currentHeading = lastPositionRef.current.heading || 0;
      currentHeading += yawRateRadSec * timeDelta;
      const worldDx = (velForward * Math.cos(currentHeading) - velSide * Math.sin(currentHeading)) * timeDelta;
      const worldDy = (velForward * Math.sin(currentHeading) + velSide * Math.cos(currentHeading)) * timeDelta;
      newX = lastX + worldDx;
      newY = lastY + worldDy;
      if (trackPointsRef.current.length > 20) {
        const distFromStart = Math.min(
          Math.abs(lapDistPct - startLapDistPctRef.current),
          Math.abs(lapDistPct - startLapDistPctRef.current + 1),
          Math.abs(lapDistPct - startLapDistPctRef.current - 1)
        );
        if (distFromStart < 0.02 && Math.abs(lapDistPct - lastPositionRef.current.lapDistPct) < 0.05) {
          const firstPoint = trackPointsRef.current[0];
          const distX = newX - firstPoint.x;
          const distY = newY - firstPoint.y;
          const dist = Math.sqrt(distX * distX + distY * distY);
          if (dist < 50) {
            const closingFactor = Math.max(0, Math.min(1, 1 - distFromStart / 0.02));
            newX = newX * (1 - closingFactor) + firstPoint.x * closingFactor;
            newY = newY * (1 - closingFactor) + firstPoint.y * closingFactor;
          }
        }
      }
    }
    const newPoint: TrackPoint = {
      x: newX,
      y: newY,
      lapDistPct,
      curvature,
      longitudinalAccel,
      heading: currentHeading
    };
    trackPointsRef.current = [...trackPointsRef.current, newPoint];
    lastPositionRef.current = newPoint;
    if (trackPointsRef.current.length > 20) {
      const lapStart = startLapDistPctRef.current;
      let completedLap = false;
      if (lastPositionRef.current) {
        completedLap = (
          (lapStart < 0.05 && lapDistPct < 0.05 && lastPositionRef.current.lapDistPct > 0.95) ||
          (lapStart > 0.95 && lapDistPct > 0.95 && lastPositionRef.current.lapDistPct < 0.05) ||
          (Math.abs(lapDistPct - lapStart) < 0.01 && 
           Math.abs(lapDistPct - lastPositionRef.current.lapDistPct) > 0.01)
        );
      }
      if (completedLap) {
        stopRecording();
        return;
      }
    }
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
        setTrackPoints([...trackPointsRef.current]);
        animationFrameId.current = null;
      });
    }
    setCurrentPosition({ lapDistPct });
  }, [telemetryData, mapBuildingState, stopRecording, cancelRecording]);

  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'complete') return;
    
    // Update current position based on telemetry lap distance when track is complete
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    setCurrentPosition({ lapDistPct });
  }, [telemetryData, mapBuildingState]);

  const findPositionAtLapDistance = useCallback((lapDistPct: number): TrackPoint | null => {
    if (trackPoints.length === 0) return null;
    
    // Handle wrap-around at start/finish line
    let targetDist = lapDistPct;
    if (targetDist > 1) targetDist -= 1;
    if (targetDist < 0) targetDist += 1;
    
    // First, try to find exact match
    const exactMatch = trackPoints.find(p => Math.abs(p.lapDistPct - targetDist) < 0.001);
    if (exactMatch) return exactMatch;
    
    // Find the two closest points and interpolate
    let prevPoint = trackPoints[0];
    let nextPoint = trackPoints[0];
    
    for (let i = 0; i < trackPoints.length; i++) {
      if (trackPoints[i].lapDistPct <= targetDist && 
          (i === trackPoints.length - 1 || trackPoints[i+1].lapDistPct > targetDist)) {
        prevPoint = trackPoints[i];
        nextPoint = i < trackPoints.length - 1 ? trackPoints[i+1] : trackPoints[0];
        break;
      }
    }
    
    // Handle case where target is before first point or after last point
    if (targetDist < trackPoints[0].lapDistPct) {
      prevPoint = trackPoints[trackPoints.length - 1];
      nextPoint = trackPoints[0];
    }
    
    // Calculate interpolation factor
    let t = 0;
    const prevDist = prevPoint.lapDistPct;
    const nextDist = nextPoint.lapDistPct;
    
    if (nextDist < prevDist) { // Handling wrap around 0/1 boundary
      if (targetDist >= prevDist) {
        t = (targetDist - prevDist) / ((1 - prevDist) + nextDist);
      } else {
        t = ((1 - prevDist) + targetDist) / ((1 - prevDist) + nextDist);
      }
    } else {
      t = (targetDist - prevDist) / (nextDist - prevDist);
    }
    
    // Clamp t between 0 and 1
    t = Math.max(0, Math.min(1, t));
    
    // Interpolate position
    return {
      x: prevPoint.x * (1 - t) + nextPoint.x * t,
      y: prevPoint.y * (1 - t) + nextPoint.y * t,
      lapDistPct: targetDist,
      heading: prevPoint.heading, // Just use the heading from the previous point
      curvature: prevPoint.curvature,
      longitudinalAccel: prevPoint.longitudinalAccel
    };
  }, [trackPoints]);

  const renderTrackMap = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const width = svgRef.current.clientWidth || 400;
    const height = svgRef.current.clientHeight || 300;
    svg.selectAll('*').remove();
    if (trackPoints.length < 2) return;

    const xVals = trackPoints.map(d => d.x);
    const yVals = trackPoints.map(d => d.y);
    const xExtent = d3.extent(xVals) as [number, number];
    const yExtent = d3.extent(yVals) as [number, number];
    const xRange = xExtent[1] - xExtent[0];
    const yRange = yExtent[1] - yExtent[0];
    const maxRange = Math.max(xRange, yRange) || 1;
    const padding = 10;

    const xScale = d3.scaleLinear()
      .domain([xExtent[0] - 0.05*maxRange, xExtent[0] + maxRange*1.05])
      .range([padding, width - padding]);
    const yScale = d3.scaleLinear()
      .domain([yExtent[0] - 0.05*maxRange, yExtent[0] + maxRange*1.05])
      .range([height - padding, padding]);

    const curvatureScale = d3.scaleLinear<string>()
      .domain([-0.01, 0, 0.01])
      .range(["#3b82f6","#ffffff","#ef4444"]);
    const accelScale = d3.scaleLinear<string>()
      .domain([-10, -3, 0, 3, 10])
      .range(["#ef4444","#fb923c","#ffffff","#4ade80","#22c55e"]);

    for (let i = 1; i < trackPoints.length; i++) {
      const p1 = trackPoints[i - 1];
      const p2 = trackPoints[i];
      let strokeColor = "#ffffff";
      if (colorMode === 'curvature' && p2.curvature !== undefined) {
        strokeColor = curvatureScale(p2.curvature);
      } else if (colorMode === 'acceleration' && p2.longitudinalAccel !== undefined) {
        strokeColor = accelScale(p2.longitudinalAccel);
      }
      svg.append("line")
        .attr("x1", xScale(p1.x))
        .attr("y1", yScale(p1.y))
        .attr("x2", xScale(p2.x))
        .attr("y2", yScale(p2.y))
        .attr("stroke", strokeColor)
        .attr("stroke-width", 2.5)
        .attr("stroke-linecap", "round");
    }

    // Draw start/finish line
    if (trackPoints.length > 5) {
      // Find the transition between high and low lap distance percentage
      let startFinishIndex = -1;
      for (let i = 1; i < trackPoints.length; i++) {
        const p1 = trackPoints[i - 1];
        const p2 = trackPoints[i];
        
        // Look for transition near 0/100% lap distance
        if ((p1.lapDistPct > 0.9 && p2.lapDistPct < 0.1) || 
            (p1.lapDistPct < 0.1 && p2.lapDistPct > 0.9)) {
          startFinishIndex = i;
          break;
        }
      }
      
      if (startFinishIndex !== -1) {
        const p1 = trackPoints[startFinishIndex - 1];
        const p2 = trackPoints[startFinishIndex];
        
        // Calculate a perpendicular line at the transition point
        const x1 = xScale(p1.x);
        const y1 = yScale(p1.y);
        const x2 = xScale(p2.x);
        const y2 = yScale(p2.y);
        
        // Find midpoint of the segment
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        
        // Calculate perpendicular direction
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        const perpX = -dy / len;
        const perpY = dx / len;
        
        // Draw a perpendicular line segment
        const lineLength = 15;
        svg.append("line")
          .attr("x1", mx - perpX * lineLength)
          .attr("y1", my - perpY * lineLength)
          .attr("x2", mx + perpX * lineLength)
          .attr("y2", my + perpY * lineLength)
          .attr("stroke", "#ffff00")
          .attr("stroke-width", 3)
          .attr("stroke-linecap", "round")
          .attr("stroke-dasharray", "3,2");
          
        // Add a small "S/F" label
        svg.append("text")
          .attr("x", mx)
          .attr("y", my - 10)
          .attr("text-anchor", "middle")
          .attr("fill", "#ffff00")
          .attr("font-size", "10px")
          .text("S/F");
      }
    }

    if (mapBuildingState === 'complete' && telemetryData?.lap_dist_pct !== undefined) {
      // When track is complete, use lap_dist_pct to position the car
      const carPos = findPositionAtLapDistance(telemetryData.lap_dist_pct);
      
      if (carPos) {
        svg.append("circle")
          .attr("cx", xScale(carPos.x))
          .attr("cy", yScale(carPos.y))
          .attr("r", 5)
          .attr("fill", "#fbbf24");
          
        // Add direction indicator to show heading
        if (carPos.heading !== undefined) {
          const headingLength = 8;
          // Calculate endpoint using the heading angle
          const headingX = xScale(carPos.x) + Math.cos(carPos.heading) * headingLength;
          const headingY = yScale(carPos.y) + Math.sin(carPos.heading) * headingLength;
          
          // Draw heading indicator line
          svg.append("line")
            .attr("x1", xScale(carPos.x))
            .attr("y1", yScale(carPos.y))
            .attr("x2", headingX)
            .attr("y2", headingY)
            .attr("stroke", "#fbbf24")
            .attr("stroke-width", 2);
        }
      }
    } else if (currentPositionIndex >= 0 && trackPoints[currentPositionIndex]) {
      // During recording, use the current position index
      const carPos = trackPoints[currentPositionIndex];
      svg.append("circle")
        .attr("cx", xScale(carPos.x))
        .attr("cy", yScale(carPos.y))
        .attr("r", 5)
        .attr("fill", "#fbbf24");
        
      // Add direction indicator to show heading
      if (carPos.heading !== undefined) {
        const headingLength = 8;
        // Calculate endpoint using the heading angle
        const headingX = xScale(carPos.x) + Math.cos(carPos.heading) * headingLength;
        const headingY = yScale(carPos.y) + Math.sin(carPos.heading) * headingLength;
        
        // Draw heading indicator line
        svg.append("line")
          .attr("x1", xScale(carPos.x))
          .attr("y1", yScale(carPos.y))
          .attr("x2", headingX)
          .attr("y2", headingY)
          .attr("stroke", "#fbbf24")
          .attr("stroke-width", 2);
      }
    }
    
    // Add recording indicator in the bottom right if currently recording
    if (mapBuildingState === 'recording') {
      svg.append("circle")
        .attr("cx", width - 15)
        .attr("cy", height - 15)
        .attr("r", 6)
        .attr("fill", "#ef4444") // Red color
        .attr("opacity", 0.8)
        .attr("class", "recording-indicator")
        .style("animation", "pulse 2s infinite");
      
      // Add a pulse animation for the recording indicator
      const style = document.createElement('style');
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 0.8; }
          50% { opacity: 0.4; }
          100% { opacity: 0.8; }
        }
      `;
      document.head.appendChild(style);
    }
  }, [trackPoints, colorMode, currentPositionIndex, mapBuildingState, telemetryData, findPositionAtLapDistance]);

  useEffect(() => {
    renderTrackMap();
  }, [renderTrackMap]);

  useEffect(() => {
    if (trackPoints.length > 0 && currentPosition.lapDistPct !== undefined && mapBuildingState === 'recording') {
      let closestIndex = 0;
      let minDistance = Number.MAX_VALUE;
      for (let i = 0; i < trackPoints.length; i++) {
        const distDirect = Math.abs(trackPoints[i].lapDistPct - currentPosition.lapDistPct);
        const distWrapLow = Math.abs(trackPoints[i].lapDistPct - (currentPosition.lapDistPct + 1));
        const distWrapHigh = Math.abs(trackPoints[i].lapDistPct - (currentPosition.lapDistPct - 1));
        const dist = Math.min(distDirect, distWrapLow, distWrapHigh);
        if (dist < minDistance) {
          minDistance = dist;
          closestIndex = i;
        }
      }
      setCurrentPositionIndex(closestIndex);
    } else {
      setCurrentPositionIndex(-1);
    }
  }, [currentPosition.lapDistPct, trackPoints, mapBuildingState]);

  useEffect(() => {
    if (externalControls?.mapBuildingState) setMapBuildingState(externalControls.mapBuildingState);
    if (externalControls?.colorMode) setColorMode(externalControls.colorMode);
  }, [externalControls]);

  useEffect(() => {
    onStateChange?.({ mapBuildingState, colorMode });
  }, [mapBuildingState, colorMode, onStateChange]);

  // Helper function to get track surface display name
  const getTrackSurfaceName = (surface: number): string => {
    switch(surface) {
      case TrackSurface.OnTrack: return "On Track";
      case TrackSurface.OffTrack: return "Off Track";
      case TrackSurface.PitLane: return "Pit Lane";
      case TrackSurface.PitStall: return "Pit Stall";
      case TrackSurface.NotInWorld: return "Not In World";
      default: return `Unknown (${surface})`;
    }
  };

  return (
    <BaseWidget id={id} title="Track Map" className="track-map-widget" onClose={onClose}>
      <div className="track-map-container" style={{ height: '300px', width: '100%' }}>
        {mapBuildingState === 'idle' && trackPoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            {lapInvalidated ? (
              <>
                <div className="text-red-400 text-lg mb-2">Lap Invalidated</div>
                <div className="text-gray-500 text-sm">
                  Recording stopped - car was off track for too long
                </div>
              </>
            ) : (
              <>
                <div className="text-gray-300 text-lg mb-2">Waiting to Start Recording</div>
                <div className="text-gray-500 text-sm">
                  Drive near start/finish line at &gt;10 m/s to begin
                </div>
              </>
            )}
            <div className="mt-4 flex items-center space-x-2">
              {telemetryData?.PlayerTrackSurface !== undefined && (
                <span className={`px-2 py-1 rounded text-xs ${
                  telemetryData.PlayerTrackSurface === TrackSurface.OnTrack 
                    ? 'bg-green-900 text-green-300' 
                    : 'bg-yellow-900 text-yellow-300'
                }`}>
                  {getTrackSurfaceName(telemetryData.PlayerTrackSurface as number)}
                </span>
              )}
              {telemetryData?.velocity_ms !== undefined && (
                <span className="px-2 py-1 rounded text-xs bg-blue-900 text-blue-300">
                  {Math.round(telemetryData.velocity_ms * 3.6)} km/h
                </span>
              )}
            </div>
          </div>
        ) : (
          <svg
            ref={svgRef}
            width="100%"
            height="300"
            className="bg-gray-800/80 rounded"
          />
        )}
      </div>
    </BaseWidget>
  );
};

export default TrackMapWidget;
