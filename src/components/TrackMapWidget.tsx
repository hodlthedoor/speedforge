import React, { useEffect, useRef, useState, useCallback } from 'react';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { TrackSurface } from '../types/telemetry';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetManager } from '../services/WidgetManager';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';

interface TrackMapWidgetProps {
  id: string;
  onClose: () => void;
  onStateChange?: (state: { 
    mapBuildingState: MapBuildingState;
    colorMode: 'curvature' | 'acceleration' | 'none';
    width: number;
    height: number;
  }) => void;
  externalControls?: {
    mapBuildingState?: MapBuildingState;
    colorMode?: 'curvature' | 'acceleration' | 'none';
    width?: number;
    height?: number;
  };
}

interface TrackPoint {
  x: number;
  y: number;
  lapDistPct: number;
  heading?: number;
  curvature?: number;
  longitudinalAccel?: number;
}

interface TrackPosition {
  lapDistPct: number;
}

type MapBuildingState = 'idle' | 'recording' | 'complete';

const TrackMapWidgetComponent: React.FC<TrackMapWidgetProps> = ({ 
  id, 
  onClose,
  onStateChange,
  externalControls 
}) => {
  console.log(`[TrackMapWidget] Initializing with ID: ${id}`);

  // Replace PIXI container with Canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastPositionRef = useRef<TrackPoint | null>(null);
  const trackPointsRef = useRef<TrackPoint[]>([]);
  const mapCompleteRef = useRef<boolean>(false);
  const startLapDistPctRef = useRef<number>(-1);
  const lastTimeRef = useRef<number | null>(null);
  const offTrackCountRef = useRef<number>(0);
  const invalidationTimerRef = useRef<number | null>(null);

  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [mapBuildingState, setMapBuildingState] = useState<MapBuildingState>('idle');
  const [currentPosition, setCurrentPosition] = useState<TrackPosition>({ lapDistPct: 0 });
  const [colorMode, setColorMode] = useState<'curvature' | 'acceleration' | 'none'>('none');
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(-1);
  const [lapInvalidated, setLapInvalidated] = useState<boolean>(false);
  
  // Replace scaleFactor with explicit width and height
  const [width, setWidth] = useState<number>(550);
  const [height, setHeight] = useState<number>(300);
  const widthRef = useRef<number>(550);
  const heightRef = useRef<number>(300);
  
  // Update refs when state changes
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  
  useEffect(() => {
    heightRef.current = height;
  }, [height]);

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
    ] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 75
  });

  // Modify the resizeCanvas function
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Use width and height directly
      canvas.width = widthRef.current;
      canvas.height = heightRef.current;
      
      // Re-render after resize
      renderCanvas();
    };

    window.addEventListener('resize', resizeCanvas);
    
    // Observe container for size changes
    const observer = new ResizeObserver(() => {
      resizeCanvas();
    });
    
    if (canvasRef.current?.parentElement) {
      observer.observe(canvasRef.current.parentElement);
    }
    
    // Initial resize
    resizeCanvas();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (canvasRef.current?.parentElement) {
        observer.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, []);

  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'idle') return;
    if (mapCompleteRef.current) return;
    
    const speed = telemetryData.velocity_ms || 0;
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    const trackSurface = telemetryData.PlayerTrackSurface as number;
    if (speed > 10 && (lapDistPct < 0.05 || lapDistPct > 0.95) && trackSurface === TrackSurface.OnTrack) {
      startRecording();
    }
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
      const sortedPoints = [...trackPointsRef.current].sort((a, b) => a.lapDistPct - b.lapDistPct);
      const normalizedTrack = normalizeTrack(sortedPoints);
      setTrackPoints(normalizedTrack);
    }
  }, []);

  const cancelRecording = useCallback(() => {
    trackPointsRef.current = [];
    setTrackPoints([]);
    lastPositionRef.current = null;
    offTrackCountRef.current = 0;
    setMapBuildingState('idle');
    setLapInvalidated(true);
    if (invalidationTimerRef.current) {
      window.clearTimeout(invalidationTimerRef.current);
    }
    invalidationTimerRef.current = window.setTimeout(() => {
      setLapInvalidated(false);
      invalidationTimerRef.current = null;
    }, 5000);
  }, []);

  const normalizeTrack = useCallback((points: TrackPoint[]): TrackPoint[] => {
    if (points.length < 10) return points;
    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distToClose = Math.sqrt((lastPoint.x - firstPoint.x) ** 2 + (lastPoint.y - firstPoint.y) ** 2);
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
        const dist = Math.sqrt((points[i].x - avgX) ** 2 + (points[i].y - avgY) ** 2);
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
    if (animationFrameId.current) return;
    
    animationFrameId.current = requestAnimationFrame(() => {
      const now = performance.now();
      const lapDistPct = telemetryData.lap_dist_pct || 0;
      const velocity = telemetryData.velocity_ms || 0;
      const lateralAccel = telemetryData.lateral_accel_ms2 || 0;
      const longitudinalAccel = telemetryData.longitudinal_accel_ms2 || 0;
      const velForward = telemetryData.VelocityX || 0;
      const velSide = telemetryData.VelocityY || 0;
      const trackSurface = telemetryData.PlayerTrackSurface as number;
      
      if (trackSurface !== TrackSurface.OnTrack) {
        offTrackCountRef.current += 1;
        if (offTrackCountRef.current >= 4) {
          cancelRecording();
          animationFrameId.current = null;
          return;
        }
      } else {
        offTrackCountRef.current = 0;
      }
      
      if (velocity < 5 || trackSurface !== TrackSurface.OnTrack) {
        animationFrameId.current = null;
        return;
      }
      
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
              if (dist < 10 && trackPointsRef.current.length > 50) {
                stopRecording();
                animationFrameId.current = null;
                return;
              }
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
        let completedLap = false;
        if (lastPositionRef.current) {
          const lastLapPct = lastPositionRef.current.lapDistPct;
          if ((lastLapPct > 0.9 && lapDistPct < 0.1) || 
              (lastLapPct < 0.1 && lapDistPct > 0.9)) {
            completedLap = true;
          }
        }
        if (completedLap) {
          stopRecording();
          animationFrameId.current = null;
          return;
        }
      }
      
      setTrackPoints([...trackPointsRef.current]);
      setCurrentPosition({ lapDistPct });
      
      animationFrameId.current = null;
    });
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [telemetryData, mapBuildingState, stopRecording, cancelRecording]);

  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'complete') return;
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    setCurrentPosition({ lapDistPct });
  }, [telemetryData, mapBuildingState]);

  const findPositionAtLapDistance = (lapDistPct: number): TrackPoint | null => {
    const points = trackPointsRef.current;
    if (points.length === 0) return null;
    
    // Make sure the lap distance is between 0 and 1
    const normalizedLapDist = lapDistPct % 1;
    const positiveLapDist = normalizedLapDist < 0 ? normalizedLapDist + 1 : normalizedLapDist;
    
    // Find the closest points before and after the given lap distance
    let beforeIndex = -1;
    let afterIndex = -1;
    
    for (let i = 0; i < points.length; i++) {
      if (points[i].lapDistPct <= positiveLapDist && 
          (beforeIndex === -1 || points[i].lapDistPct > points[beforeIndex].lapDistPct)) {
        beforeIndex = i;
      }
      
      if (points[i].lapDistPct >= positiveLapDist && 
          (afterIndex === -1 || points[i].lapDistPct < points[afterIndex].lapDistPct)) {
        afterIndex = i;
      }
    }
    
    // Handle the case when we cross the start/finish line
    if (beforeIndex === -1) {
      beforeIndex = points.findIndex(p => p.lapDistPct === Math.max(...points.map(p => p.lapDistPct)));
    }
    
    if (afterIndex === -1) {
      afterIndex = points.findIndex(p => p.lapDistPct === Math.min(...points.map(p => p.lapDistPct)));
    }
    
    if (beforeIndex === -1 || afterIndex === -1) return null;
    
    const before = points[beforeIndex];
    const after = points[afterIndex];
    
    // Calculate the interpolation factor
    let t;
    if (after.lapDistPct < before.lapDistPct) {
      // We're crossing the start/finish line
      const afterPct = after.lapDistPct + 1;
      t = (positiveLapDist < after.lapDistPct 
           ? positiveLapDist + 1 
           : positiveLapDist) - before.lapDistPct;
      t /= afterPct - before.lapDistPct;
    } else {
      t = (positiveLapDist - before.lapDistPct) / (after.lapDistPct - before.lapDistPct);
    }
    
    // Interpolate the position
    const interpolatedPoint: TrackPoint = {
      x: before.x + t * (after.x - before.x),
      y: before.y + t * (after.y - before.y),
      lapDistPct: positiveLapDist
    };
    
    // If both points have heading, interpolate that too
    if (before.heading !== undefined && after.heading !== undefined) {
      // Ensure we interpolate along the shortest arc
      let headingDiff = after.heading - before.heading;
      if (headingDiff > Math.PI) headingDiff -= 2 * Math.PI;
      if (headingDiff < -Math.PI) headingDiff += 2 * Math.PI;
      
      interpolatedPoint.heading = before.heading + t * headingDiff;
    }
    
    return interpolatedPoint;
  };

  // Replace PIXI rendering with Canvas rendering
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const points = trackPointsRef.current;
    if (points.length < 2) return;
    
    // Clear the canvas with transparent background (not drawing a background fill)
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get computed opacity of parent element to respect Widget's opacity control
    const computedStyle = window.getComputedStyle(canvas.parentElement || canvas);
    const parentOpacity = parseFloat(computedStyle.opacity) || 1;
    
    // Apply parent opacity to all canvas drawing
    ctx.globalAlpha = parentOpacity;
    
    // Calculate bounds to determine scale
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    const padding = 20; // Padding around the track
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    
    // Calculate the scale to fit the track in the canvas, applying the user's scale factor
    const xScale = width / (maxX - minX) * widthRef.current;
    const yScale = height / (maxY - minY) * heightRef.current;
    const baseScale = Math.min(xScale, yScale);
    
    // Calculate center for positioning the scaled track
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Function to transform track coordinates to canvas coordinates with proper centering
    const transformPoint = (point: { x: number, y: number }) => {
      const trackCenterX = (minX + maxX) / 2;
      const trackCenterY = (minY + maxY) / 2;
      
      return {
        x: centerX + (point.x - trackCenterX) * baseScale,
        y: centerY + (point.y - trackCenterY) * baseScale
      };
    };
    
    // Create the path for the track
    const firstPoint = transformPoint(points[0]);
    const lastPoint = transformPoint(points[points.length - 1]);
    const isNearlyComplete = mapBuildingState === 'complete' || 
      (Math.sqrt(
        Math.pow(firstPoint.x - lastPoint.x, 2) + 
        Math.pow(firstPoint.y - lastPoint.y, 2)
      ) < 10); // 10px threshold for "nearly complete"
    
    // Draw the track with white borders and black fill by drawing:
    // 1. First a thick white line
    // 2. Then a slightly thinner black line over it
    
    // Draw the thick white line for the border
    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < points.length; i++) {
      const point = transformPoint(points[i]);
      ctx.lineTo(point.x, point.y);
    }
    
    if (isNearlyComplete) {
      ctx.lineTo(firstPoint.x, firstPoint.y);
    }
    
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 6.0; // Thicker white line for the border
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw the slightly thinner black line over it
    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < points.length; i++) {
      const point = transformPoint(points[i]);
      ctx.lineTo(point.x, point.y);
    }
    
    if (isNearlyComplete) {
      ctx.lineTo(firstPoint.x, firstPoint.y);
    }
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4.0; // Thinner black line to leave white borders
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw the start/finish line
    if (points.length > 0) {
      // Find the point with lap distance closest to 0
      let startPoint = points[0];
      let nextPoint = points[1];
      
      for (let i = 1; i < points.length; i++) {
        if (points[i].lapDistPct < startPoint.lapDistPct) {
          startPoint = points[i];
          nextPoint = points[(i + 1) % points.length];
        }
      }
      
      const start = transformPoint(startPoint);
      const next = transformPoint(nextPoint);
      
      // Calculate perpendicular vector for the start/finish line
      const dx = next.x - start.x;
      const dy = next.y - start.y;
      const length = Math.sqrt(dx * dx + dy * dy);
      
      if (length > 0) {
        const perpX = -dy / length * 8; // 8px length for each start/finish line
        const perpY = dx / length * 8;
        
        // Draw two thin white start/finish lines with a small gap between them
        // First line
        ctx.beginPath();
        ctx.moveTo(start.x - perpX, start.y - perpY);
        ctx.lineTo(start.x, start.y);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Second line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(start.x + perpX, start.y + perpY);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
    
    // Draw the current car position if available
    let carPos: TrackPoint | null = null;
    if (mapBuildingState === 'complete' && telemetryData?.lap_dist_pct !== undefined) {
      carPos = findPositionAtLapDistance(telemetryData.lap_dist_pct);
    } else if (currentPositionIndex >= 0 && trackPoints[currentPositionIndex]) {
      carPos = trackPoints[currentPositionIndex];
    }
    
    if (carPos) {
      const carPosTransformed = transformPoint(carPos);
      
      // Draw the car as a circle with a direction indicator
      ctx.beginPath();
      ctx.arc(carPosTransformed.x, carPosTransformed.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#00FF00';
      ctx.fill();
      
      // Draw direction indicator if heading is available
      if (carPos.heading !== undefined) {
        const headingX = carPosTransformed.x + Math.cos(carPos.heading) * 10;
        const headingY = carPosTransformed.y + Math.sin(carPos.heading) * 10;
        
        ctx.beginPath();
        ctx.moveTo(carPosTransformed.x, carPosTransformed.y);
        ctx.lineTo(headingX, headingY);
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    
    // Draw recording indicator if currently recording
    if (mapBuildingState === 'recording') {
      ctx.beginPath();
      ctx.arc(canvas.width - 20, 20, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FF0000';
      ctx.fill();
    }
    
    // Reset global alpha
    ctx.globalAlpha = 1.0;
  }, [trackPoints, colorMode, currentPositionIndex, mapBuildingState, telemetryData, findPositionAtLapDistance, widthRef, heightRef]);

  const debouncedRenderCanvas = useCallback(() => {
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
        renderCanvas();
        animationFrameId.current = null;
      });
    }
  }, [renderCanvas]);

  useEffect(() => {
    debouncedRenderCanvas();
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [debouncedRenderCanvas]);

  useEffect(() => {
    if (trackPoints.length === 0 || currentPosition.lapDistPct === undefined || mapBuildingState !== 'recording') {
      setCurrentPositionIndex(-1);
      return;
    }
    
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
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
        animationFrameId.current = null;
      });
    }
  }, [currentPosition.lapDistPct, trackPoints, mapBuildingState]);

  // Update the externalControls effect
  useEffect(() => {
    if (externalControls) {
      if (externalControls.mapBuildingState !== undefined) {
        setMapBuildingState(externalControls.mapBuildingState);
      }
      if (externalControls.colorMode !== undefined) {
        setColorMode(externalControls.colorMode);
      }
      if (externalControls.width !== undefined) {
        setWidth(externalControls.width);
      }
      if (externalControls.height !== undefined) {
        setHeight(externalControls.height);
      }
    }
  }, [externalControls]);

  // Update the onStateChange effect
  useEffect(() => {
    onStateChange?.({ mapBuildingState, colorMode, width, height });
  }, [mapBuildingState, colorMode, width, height, onStateChange]);

  // Replace the scaleFactor effect with width/height effects
  useEffect(() => {
    widthRef.current = width;
    
    // Update WidgetManager with the new width
    WidgetManager.updateWidgetState(id, { width });
    
    // Only render if we already have a track
    if (trackPointsRef.current.length > 0) {
      renderCanvas();
    }
  }, [width, id]);
  
  useEffect(() => {
    heightRef.current = height;
    
    // Update WidgetManager with the new height
    WidgetManager.updateWidgetState(id, { height });
    
    // Only render if we already have a track
    if (trackPointsRef.current.length > 0) {
      renderCanvas();
    }
  }, [height, id]);

  // Update the widget state update hook
  useWidgetStateUpdates(id, (state) => {
    if (state.width !== undefined) {
      const newWidth = Number(state.width);
      // Only update if the value has actually changed
      if (widthRef.current !== newWidth) {
        setWidth(newWidth);
      }
    }
    
    if (state.height !== undefined) {
      const newHeight = Number(state.height);
      // Only update if the value has actually changed
      if (heightRef.current !== newHeight) {
        setHeight(newHeight);
      }
    }
    
    if (state.colorMode !== undefined) {
      if (colorMode !== state.colorMode) {
        setColorMode(state.colorMode);
      }
    }
    
    if (state.mapBuildingState !== undefined) {
      if (mapBuildingState !== state.mapBuildingState) {
        setMapBuildingState(state.mapBuildingState);
      }
    }
  });
  
  // Add better logging in the WidgetManager sync effect
  useEffect(() => {
    console.log(`[TrackMapWidget:${id}] Setting up WidgetManager sync with ID: ${id}`);
    
    // Force resyncing from WidgetManager on every mount
    const widget = WidgetManager.getWidget(id);
    console.log(`[TrackMapWidget:${id}] WidgetManager.getWidget result:`, widget);
    
    if (widget) {
      // Always resync with WidgetManager's state on mount
      if (widget.state) {
        if (widget.state.width !== undefined) {
          const storedWidth = Number(widget.state.width);
          
          // Force update our local state to match WidgetManager
          if (storedWidth !== widthRef.current) {
            setWidth(storedWidth);
          }
        } else {
          // If widget exists but doesn't have width, set it
          WidgetManager.updateWidgetState(id, { width: widthRef.current });
        }
        
        if (widget.state.height !== undefined) {
          const storedHeight = Number(widget.state.height);
          
          // Force update our local state to match WidgetManager
          if (storedHeight !== heightRef.current) {
            setHeight(storedHeight);
          }
        } else {
          // If widget exists but doesn't have height, set it
          WidgetManager.updateWidgetState(id, { height: heightRef.current });
        }
      } else {
        // If widget exists but state is empty, initialize both values
        WidgetManager.updateWidgetState(id, { 
          width: widthRef.current,
          height: heightRef.current
        });
      }
    } else {
      // If widget doesn't exist in WidgetManager at all
      WidgetManager.updateWidgetState(id, { 
        width: widthRef.current,
        height: heightRef.current
      });
    }
    
    // Subscribe to future state changes
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.width !== undefined) {
          const newWidth = Number(event.state.width);
          
          // Only update if the value has actually changed
          if (widthRef.current !== newWidth) {
            setWidth(newWidth);
          }
        }
        
        if (event.state.height !== undefined) {
          const newHeight = Number(event.state.height);
          
          // Only update if the value has actually changed
          if (heightRef.current !== newHeight) {
            setHeight(newHeight);
          }
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]);

  const getTrackSurfaceName = (surface: number): string => {
    switch (surface) {
      case TrackSurface.OnTrack:
        return 'On Track';
      case TrackSurface.OffTrack:
        return 'Off Track';
      case TrackSurface.PitLane:
        return 'Pit Lane';
      case TrackSurface.PitStall:
        return 'Pit Stall';
      default:
        return 'Unknown';
    }
  };

  useEffect(() => {
    const styleId = 'track-map-pulse-animation';
    if (!document.getElementById(styleId) && mapBuildingState === 'recording') {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes pulse {
          0% { opacity: 0.8; }
          50% { opacity: 0.4; }
          100% { opacity: 0.8; }
        }
        .recording-indicator {
          animation: pulse 2s infinite;
        }
      `;
      document.head.appendChild(style);
    }
    return () => {
      const styleElement = document.getElementById(styleId);
      if (styleElement && mapBuildingState !== 'recording') {
        document.head.removeChild(styleElement);
      }
    };
  }, [mapBuildingState]);

  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
      if (invalidationTimerRef.current) {
        clearTimeout(invalidationTimerRef.current);
        invalidationTimerRef.current = null;
      }
      trackPointsRef.current = [];
      lastPositionRef.current = null;
      if (canvasRef.current) {
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
      const styleElement = document.getElementById('track-map-pulse-animation');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  return (
    <Widget 
      id={id} 
      title="Track Map" 
      className="w-auto"
      width={width}
      height={height}
      onClose={onClose}
    >
      <div className="w-full h-full rounded">
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
          <div className="w-full h-full rounded">
            <canvas 
              ref={canvasRef}
              className="w-full h-full rounded bg-transparent"
              width={width}
              height={height}
            />
          </div>
        )}
      </div>
      <div className="mt-2 flex justify-end text-xs">
        <span>Size: {width}x{height}px</span>
      </div>
    </Widget>
  );
};

const getTrackMapControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  console.log(`[TrackMapWidget] getTrackMapControls with state:`, widgetState);
  console.log(`[TrackMapWidget] widgetState ID:`, widgetState.id);
  
  const mapBuildingState = widgetState.mapBuildingState || 'idle';
  const colorMode = widgetState.colorMode || 'none';
  const width = widgetState.width || 550;
  const height = widgetState.height || 300;

  console.log(`[TrackMapWidget] widgetState:, ${widgetState}`);
  
  const controls: WidgetControlDefinition[] = [
    {
      type: 'select' as WidgetControlType,
      id: 'colorMode',
      label: 'Color Mode',
      value: colorMode,
      options: [
        { value: 'none', label: 'Default' },
        { value: 'curvature', label: 'Curvature' },
        { value: 'acceleration', label: 'Acceleration' }
      ],
      onChange: (value) => updateWidget({ colorMode: value })
    },
    {
      type: 'slider' as WidgetControlType,
      id: 'width',
      label: `Width: ${width}px`,
      value: width,
      options: [
        { value: 400, label: '400px' },
        { value: 550, label: '550px' },
        { value: 650, label: '650px' },
        { value: 750, label: '750px' },
        { value: 850, label: '850px' },
        { value: 1000, label: '1000px' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        
        // Update both the widget state and dispatch a direct update for redundancy
        updateWidget({ width: numericValue });
        
        // Also try direct update mechanism as fallback
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { width: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    },
    {
      type: 'slider' as WidgetControlType,
      id: 'height',
      label: `Height: ${height}px`,
      value: height,
      options: [
        { value: 200, label: '200px' },
        { value: 300, label: '300px' },
        { value: 400, label: '400px' },
        { value: 500, label: '500px' },
        { value: 600, label: '600px' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        
        // Update both the widget state and dispatch a direct update for redundancy
        updateWidget({ height: numericValue });
        
        // Also try direct update mechanism as fallback
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { height: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    }
  ];
  
  if (mapBuildingState === 'recording') {
    controls.push({
      type: 'button' as WidgetControlType,
      id: 'stopRecording',
      label: 'Stop Recording',
      value: undefined,
      options: [],
      onChange: () => updateWidget({ mapBuildingState: 'complete' })
    });
  } else if (mapBuildingState === 'complete') {
    controls.push({
      type: 'button' as WidgetControlType,
      id: 'startRecording',
      label: 'Start New Recording',
      value: undefined,
      options: [],
      onChange: () => updateWidget({ mapBuildingState: 'idle' })
    });
  }
  
  return controls;
};

const TrackMapWidget = withControls(TrackMapWidgetComponent, getTrackMapControls);

export default TrackMapWidget;

