import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Widget from './Widget';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { TrackSurface } from '../types/telemetry';

interface BasicMapWidgetProps {
  id: string;
  onClose: () => void;
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

// Utility function for efficient animation frame management
const useAnimationFrame = (deps: any[] = []) => {
  const frameIdRef = useRef<number | null>(null);
  
  const requestFrame = useCallback((callback: () => void) => {
    if (frameIdRef.current) return;
    
    frameIdRef.current = requestAnimationFrame(() => {
      callback();
      frameIdRef.current = null;
    });
  }, deps);
  
  const cancelFrame = useCallback(() => {
    if (frameIdRef.current) {
      cancelAnimationFrame(frameIdRef.current);
      frameIdRef.current = null;
    }
  }, []);
  
  useEffect(() => {
    return cancelFrame;
  }, [cancelFrame]);
  
  return { requestFrame, cancelFrame, frameIdRef };
};

const BasicMapWidgetComponent: React.FC<BasicMapWidgetProps> = ({ id, onClose }) => {
  // Canvas and animation refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackPointsRef = useRef<TrackPoint[]>([]);
  const lastPositionRef = useRef<TrackPoint | null>(null);
  const mapCompleteRef = useRef<boolean>(false);
  const startLapDistPctRef = useRef<number>(-1);
  const lastTimeRef = useRef<number | null>(null);
  const offTrackCountRef = useRef<number>(0);
  const invalidationTimerRef = useRef<number | null>(null);
  
  // State for widget dimensions
  const [width, setWidth] = useState<number>(480);
  const [height, setHeight] = useState<number>(300);
  const [mapBuildingState, setMapBuildingState] = useState<MapBuildingState>('idle');
  const [currentPosition, setCurrentPosition] = useState<TrackPosition>({ lapDistPct: 0 });
  const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
  const [currentPositionIndex, setCurrentPositionIndex] = useState<number>(-1);
  const [lapInvalidated, setLapInvalidated] = useState<boolean>(false);
  const [trackWidth, setTrackWidth] = useState<number>(4); // Default track width (black line)
  
  // Use the animation frame hook
  const { requestFrame, cancelFrame, frameIdRef } = useAnimationFrame([]);
  
  // Refs to store current values
  const widthRef = useRef<number>(480);
  const heightRef = useRef<number>(300);
  const trackWidthRef = useRef<number>(4);
  
  // Telemetry data for car position with more metrics similar to TrackMapWidget
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
  
  // Update refs when state changes
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  
  useEffect(() => {
    heightRef.current = height;
  }, [height]);
  
  useEffect(() => {
    trackWidthRef.current = trackWidth;
  }, [trackWidth]);
  
  // Callbacks for updating widget properties
  const updateWidth = useCallback((newWidth: number) => {
    if (widthRef.current !== newWidth) {
      setWidth(newWidth);
    }
  }, []);
  
  const updateHeight = useCallback((newHeight: number) => {
    if (heightRef.current !== newHeight) {
      setHeight(newHeight);
    }
  }, []);
  
  const updateTrackWidth = useCallback((newTrackWidth: number) => {
    if (trackWidthRef.current !== newTrackWidth) {
      setTrackWidth(newTrackWidth);
    }
  }, []);
  
  // Recording functions
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
      // Find the minimum lap distance to properly identify the start of the lap
      const minLapDistPct = Math.min(...trackPointsRef.current.map(p => p.lapDistPct));
      
      // Sort points by lap distance percentage, but handle potential lap crossing
      // by using the distance from the minimum lap distance as the sorting key
      const sortedPoints = [...trackPointsRef.current].sort((a, b) => {
        // Calculate distance from minimum lap distance (handling wrap-around at 1.0)
        const distA = (a.lapDistPct >= minLapDistPct) 
          ? a.lapDistPct - minLapDistPct 
          : a.lapDistPct + 1.0 - minLapDistPct;
        
        const distB = (b.lapDistPct >= minLapDistPct) 
          ? b.lapDistPct - minLapDistPct 
          : b.lapDistPct + 1.0 - minLapDistPct;
          
        return distA - distB;
      });
      
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
    
    // First, clone the array to avoid mutating the original
    const workingPoints = [...points];
    
    const firstPoint = workingPoints[0];
    const lastPoint = workingPoints[workingPoints.length - 1];
    
    // Only auto-complete the circuit if we've actually completed a lap
    const isLapComplete = 
      (lastPoint.lapDistPct > 0.98 && firstPoint.lapDistPct < 0.1) ||
      (lastPoint.lapDistPct < 0.1 && firstPoint.lapDistPct > 0.98);
    
    const distToClose = Math.sqrt((lastPoint.x - firstPoint.x) ** 2 + (lastPoint.y - firstPoint.y) ** 2);
    
    // Only add the closing point if the lap is actually completed AND the track isn't already closed
    if (isLapComplete && distToClose > 2) {
      workingPoints.push({ ...firstPoint, lapDistPct: 1.0 });
    }
    
    // Smooth the track points with a moving average filter
    // This is more efficient than the previous approach
    const smoothedPoints: TrackPoint[] = [];
    const windowSize = 2; // Points on each side to consider
    
    // Pre-calculate some values for the first and last points
    // which will be used multiple times in the loop
    const startWindowIndices = Array.from(
      { length: Math.min(windowSize, workingPoints.length) }, 
      (_, i) => i + 1
    );
    
    const endWindowIndices = Array.from(
      { length: Math.min(windowSize, workingPoints.length) },
      (_, i) => workingPoints.length - 1 - i
    );
    
    for (let i = 0; i < workingPoints.length; i++) {
      const currentPoint = workingPoints[i];
      
      // Determine window indices efficiently based on position in array
      let windowIndices: number[];
      
      if (i === 0) {
        // First point - use cached start window
        windowIndices = startWindowIndices;
      } else if (i === workingPoints.length - 1) {
        // Last point - use cached end window
        windowIndices = endWindowIndices;
      } else {
        // Middle points - calculate window efficiently
        const startIdx = Math.max(0, i - windowSize);
        const endIdx = Math.min(workingPoints.length - 1, i + windowSize);
        
        windowIndices = [];
        for (let j = startIdx; j <= endIdx; j++) {
          if (j !== i) windowIndices.push(j);
        }
      }
      
      // Skip smoothing if no neighbors
      if (windowIndices.length === 0) {
        smoothedPoints.push(currentPoint);
        continue;
      }
      
      // Calculate average position of neighbors
      let sumX = 0, sumY = 0;
      for (const idx of windowIndices) {
        sumX += workingPoints[idx].x;
        sumY += workingPoints[idx].y;
      }
      
      const avgX = sumX / windowIndices.length;
      const avgY = sumY / windowIndices.length;
      
      // Calculate distance from average
      const dx = currentPoint.x - avgX;
      const dy = currentPoint.y - avgY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      // Apply smoothing based on distance - use more smoothing for outliers
      const distThreshold = 5;
      if (dist > distThreshold) {
        // Apply more smoothing to outliers
        const smoothingFactor = 0.3; // 30% smoothing
        smoothedPoints.push({
          ...currentPoint,
          x: currentPoint.x * (1 - smoothingFactor) + avgX * smoothingFactor,
          y: currentPoint.y * (1 - smoothingFactor) + avgY * smoothingFactor
        });
      } else {
        // Keep points that are already smooth
        smoothedPoints.push(currentPoint);
      }
    }
    
    // Center the track on (0,0) for better rendering and scaling
    // Calculate bounds in a single pass to improve performance
    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    
    for (const point of smoothedPoints) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    }
    
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Center all points in one pass
    return smoothedPoints.map(p => ({ 
      ...p, 
      x: p.x - centerX, 
      y: p.y - centerY 
    }));
  }, []);
  
  // Expose functions via static properties
  (BasicMapWidgetComponent as any).updateWidth = updateWidth;
  (BasicMapWidgetComponent as any).updateHeight = updateHeight;
  (BasicMapWidgetComponent as any).updateTrackWidth = updateTrackWidth;
  
  // Handle widget state updates
  useWidgetStateUpdates(id, (state) => {
    if (state.width !== undefined) {
      const newWidth = Number(state.width);
      if (widthRef.current !== newWidth) {
        setWidth(newWidth);
      }
    }
    
    if (state.height !== undefined) {
      const newHeight = Number(state.height);
      if (heightRef.current !== newHeight) {
        setHeight(newHeight);
      }
    }
    
    if (state.mapBuildingState !== undefined) {
      if (mapBuildingState !== state.mapBuildingState) {
        setMapBuildingState(state.mapBuildingState);
      }
    }

    if (state.trackWidth !== undefined) {
      const newTrackWidth = Number(state.trackWidth);
      if (trackWidthRef.current !== newTrackWidth) {
        setTrackWidth(newTrackWidth);
      }
    }
  });
  
  // Auto-start recording when conditions are right
  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'idle') return;
    if (mapCompleteRef.current) return;
    
    const speed = telemetryData.velocity_ms || 0;
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    const trackSurface = telemetryData.PlayerTrackSurface as number;
    if (speed > 10 && (lapDistPct < 0.05 || lapDistPct > 0.95) && trackSurface === TrackSurface.OnTrack) {
      startRecording();
    }
  }, [telemetryData, mapBuildingState, startRecording]);

  // Recording telemetry data to build the track
  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'recording') return;
    if (frameIdRef.current) return;
    
    requestFrame(() => {
      try {
        const now = performance.now();
        const lapDistPct = telemetryData.lap_dist_pct || 0;
        const velocity = telemetryData.velocity_ms || 0;
        const lateralAccel = telemetryData.lateral_accel_ms2 || 0;
        const longitudinalAccel = telemetryData.longitudinal_accel_ms2 || 0;
        const velForward = telemetryData.VelocityX || 0;
        const velSide = telemetryData.VelocityY || 0;
        const trackSurface = telemetryData.PlayerTrackSurface as number;
        
        // Check track surface first to minimize unnecessary processing
        if (trackSurface !== TrackSurface.OnTrack) {
          offTrackCountRef.current += 1;
          if (offTrackCountRef.current >= 4) {
            cancelRecording();
            return;
          }
        } else {
          offTrackCountRef.current = 0;
        }
        
        // Skip low speeds or when off track
        if (velocity < 5 || trackSurface !== TrackSurface.OnTrack) {
          return;
        }
        
        // Calculate time delta with safety bounds
        let timeDelta = 0.05;
        if (lastTimeRef.current !== null) {
          timeDelta = Math.min(0.2, Math.max(0.01, (now - lastTimeRef.current) / 1000));
        }
        lastTimeRef.current = now;
        
        // Calculate curvature
        let curvature = 0;
        if (velocity > 10) curvature = lateralAccel / (velocity * velocity);
        
        // Calculate new position
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
          
          // Calculate position updates with world coordinates
          const worldDx = (velForward * Math.cos(currentHeading) - velSide * Math.sin(currentHeading)) * timeDelta;
          const worldDy = (velForward * Math.sin(currentHeading) + velSide * Math.cos(currentHeading)) * timeDelta;
          newX = lastX + worldDx;
          newY = lastY + worldDy;
          
          // Auto-completion check constants
          const MIN_POINTS_FOR_COMPLETION = 300;
          
          // Only check for lap completion if we have enough points
          if (trackPointsRef.current.length > MIN_POINTS_FOR_COMPLETION) {
            // Check if we've made significant progress around the track
            let madeSignificantProgress = false;
            
            if (startLapDistPctRef.current <= 0.5) {
              // If we started in the first half of the lap, we should have crossed into the second half
              madeSignificantProgress = trackPointsRef.current.some(p => p.lapDistPct > 0.5);
            } else {
              // If we started in the second half of the lap, we should have crossed into the first half
              madeSignificantProgress = trackPointsRef.current.some(p => p.lapDistPct < 0.5);
            }
            
            if (madeSignificantProgress) {
              const distFromStart = Math.min(
                Math.abs(lapDistPct - startLapDistPctRef.current),
                Math.abs(lapDistPct - startLapDistPctRef.current + 1),
                Math.abs(lapDistPct - startLapDistPctRef.current - 1)
              );
              
              // Check if we're near our starting point to auto-complete
              if (distFromStart < 0.02 && Math.abs(lapDistPct - lastPositionRef.current.lapDistPct) < 0.05) {
                const firstPoint = trackPointsRef.current[0];
                const distX = newX - firstPoint.x;
                const distY = newY - firstPoint.y;
                const dist = Math.sqrt(distX * distX + distY * distY);
                
                // If we're close to the starting point in 3D space, assist lap completion
                if (dist < 150) {
                  // Apply a closing correction factor to smooth track completion
                  const closingFactor = Math.max(0, Math.min(1, 1 - distFromStart / 0.02));
                  newX = newX * (1 - closingFactor) + firstPoint.x * closingFactor;
                  newY = newY * (1 - closingFactor) + firstPoint.y * closingFactor;
                  
                  // Auto-complete if extremely close
                  if (dist < 50 && trackPointsRef.current.length > MIN_POINTS_FOR_COMPLETION) {
                    console.log(`[BasicMap:${id}] Lap completed - proximity to start point with ${trackPointsRef.current.length} points`);
                    stopRecording();
                    return;
                  }
                }
              }
            }
          }
        }
        
        // Create the new track point
        const newPoint: TrackPoint = {
          x: newX,
          y: newY,
          lapDistPct,
          curvature,
          longitudinalAccel,
          heading: currentHeading
        };
        
        // Add to track points array
        trackPointsRef.current = [...trackPointsRef.current, newPoint];
        lastPositionRef.current = newPoint;
        
        // Check for lap completion by crossing start/finish line
        if (trackPointsRef.current.length > 50) {
          let completedLap = false;
          if (lastPositionRef.current) {
            const lastLapPct = lastPositionRef.current.lapDistPct;
            // We've completed a lap if we cross from near the end (>0.98) to near the beginning (<0.1)
            if (lastLapPct > 0.98 && lapDistPct < 0.1) {
              completedLap = true;
              console.log(`[BasicMap:${id}] Lap completed - crossed start/finish line`);
            }
          }
          if (completedLap) {
            stopRecording();
            return;
          }
        }
        
        // Update state for rendering
        setTrackPoints([...trackPointsRef.current]);
        setCurrentPosition({ lapDistPct });
      } catch (error) {
        console.error(`[BasicMap:${id}] Error in recording loop:`, error);
      }
    });
    
    // Cleanup frame on unmount or change
    return () => {
      cancelFrame();
    };
  }, [telemetryData, mapBuildingState, stopRecording, cancelRecording, id, requestFrame, cancelFrame]);

  // Update current position when map is complete
  useEffect(() => {
    if (!telemetryData || mapBuildingState !== 'complete') return;
    const lapDistPct = telemetryData.lap_dist_pct || 0;
    setCurrentPosition({ lapDistPct });
  }, [telemetryData, mapBuildingState]);

  // Initialize and sync with WidgetManager
  useEffect(() => {
    // Force resyncing from WidgetManager on every mount
    const widget = WidgetManager.getWidget(id);
    if (widget && widget.state) {
      // Sync width from WidgetManager
      if (widget.state.width !== undefined) {
        const storedWidth = Number(widget.state.width);
        if (storedWidth !== widthRef.current) {
          setWidth(storedWidth);
        }
      }
      
      // Sync height from WidgetManager
      if (widget.state.height !== undefined) {
        const storedHeight = Number(widget.state.height);
        if (storedHeight !== heightRef.current) {
          setHeight(storedHeight);
        }
      }
      
      // Sync mapBuildingState from WidgetManager
      if (widget.state.mapBuildingState !== undefined) {
        setMapBuildingState(widget.state.mapBuildingState);
      }

      // Sync trackWidth from WidgetManager
      if (widget.state.trackWidth !== undefined) {
        const storedTrackWidth = Number(widget.state.trackWidth);
        if (storedTrackWidth !== trackWidthRef.current) {
          setTrackWidth(storedTrackWidth);
        }
      }
    } else {
      // Initialize widget state if it doesn't exist
      WidgetManager.updateWidgetState(id, {
        width: widthRef.current,
        height: heightRef.current,
        mapBuildingState: 'idle',
        trackWidth: trackWidthRef.current
      });
    }
    
    // Subscribe to WidgetManager updates
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.width !== undefined) {
          const newWidth = Number(event.state.width);
          if (widthRef.current !== newWidth) {
            setWidth(newWidth);
          }
        }
        
        if (event.state.height !== undefined) {
          const newHeight = Number(event.state.height);
          if (heightRef.current !== newHeight) {
            setHeight(newHeight);
          }
        }
        
        if (event.state.mapBuildingState !== undefined) {
          setMapBuildingState(event.state.mapBuildingState);
        }

        if (event.state.trackWidth !== undefined) {
          const newTrackWidth = Number(event.state.trackWidth);
          if (trackWidthRef.current !== newTrackWidth) {
            setTrackWidth(newTrackWidth);
          }
        }
      }
    });
    
    return () => {
      unsubscribe();
    };
  }, [id]);
  
  // Sync state changes with WidgetManager
  useEffect(() => {
    if (widthRef.current === width) return;
    WidgetManager.updateWidgetState(id, { width });
  }, [width, id]);
  
  useEffect(() => {
    if (heightRef.current === height) return;
    WidgetManager.updateWidgetState(id, { height });
  }, [height, id]);

  useEffect(() => {
    if (trackWidthRef.current === trackWidth) return;
    WidgetManager.updateWidgetState(id, { trackWidth });
  }, [trackWidth, id]);

  // Function to find position at a lap distance
  const findPositionAtLapDistance = useCallback((lapDistPct: number): TrackPoint | null => {
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
  }, []);

  // Cached transformation for track points to avoid recalculating during rendering
  const mapTransformData = useMemo(() => {
    const points = trackPointsRef.current;
    if (points.length < 2) return null;
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    points.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    
    const trackCenterX = (minX + maxX) / 2;
    const trackCenterY = (minY + maxY) / 2;
    
    return { minX, minY, maxX, maxY, trackCenterX, trackCenterY };
  }, [trackPoints]);

  // Map rendering logic
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    
    const points = trackPointsRef.current;
    if (points.length < 2) return;
    
    // Clear the canvas with transparent background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Get computed opacity of parent element to respect Widget's opacity control
    const computedStyle = window.getComputedStyle(canvas.parentElement || canvas);
    const parentOpacity = parseFloat(computedStyle.opacity) || 1;
    
    // Apply parent opacity to all canvas drawing
    ctx.globalAlpha = parentOpacity;
    
    if (!mapTransformData) return;
    
    const { minX, minY, maxX, maxY, trackCenterX, trackCenterY } = mapTransformData;
    
    const padding = 20; // Padding around the track
    const width = canvas.width - padding * 2;
    const height = canvas.height - padding * 2;
    
    // Calculate the scale to fit the track in the canvas
    const xScale = width / (maxX - minX);
    const yScale = height / (maxY - minY);
    const baseScale = Math.min(xScale, yScale);
    
    // Calculate center for positioning the scaled track
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    // Function to transform track coordinates to canvas coordinates with proper centering
    const transformPoint = (point: { x: number, y: number }) => {
      return {
        x: centerX + (point.x - trackCenterX) * baseScale,
        y: centerY + (point.y - trackCenterY) * baseScale
      };
    };
    
    // Draw the track
    // 1. First a thick white line
    // 2. Then a slightly thinner black line over it
    
    const firstPoint = transformPoint(points[0]);
    
    // Calculate white line width (always thicker than black line)
    const blackLineWidth = trackWidthRef.current;
    const whiteLineWidth = blackLineWidth + ((blackLineWidth / 2) - 1); // wider for white border
    
    // Draw the thick white line for the border
    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);
    
    for (let i = 1; i < points.length; i++) {
      const point = transformPoint(points[i]);
      ctx.lineTo(point.x, point.y);
    }
    
    // Only close the path if the map is complete
    if (mapBuildingState === 'complete') {
      // Close the path by connecting to the first point
      ctx.lineTo(firstPoint.x, firstPoint.y);
    }
    
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = whiteLineWidth;
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
    
    // Only close the path if the map is complete
    if (mapBuildingState === 'complete') {
      // Close the path
      ctx.lineTo(firstPoint.x, firstPoint.y);
    }
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = blackLineWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();
    
    // Draw the start/finish line
    if (points.length > 0 && mapBuildingState === 'complete') {
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
    if (telemetryData?.lap_dist_pct !== undefined) {
      const carPos = findPositionAtLapDistance(telemetryData.lap_dist_pct);
      
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
    }
    
    // Reset global alpha
    ctx.globalAlpha = 1.0;
  }, [telemetryData, findPositionAtLapDistance, mapBuildingState, mapTransformData]);

  // Resize canvas function
  useEffect(() => {
    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      // Use width and height directly
      canvas.width = widthRef.current;
      canvas.height = heightRef.current;
      
      // Re-render after resize
      renderMap();
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
  }, [renderMap]);

  // Debounced rendering function
  const debouncedRenderMap = useCallback(() => {
    if (!frameIdRef.current) {
      requestFrame(() => {
        renderMap();
      });
    }
  }, [renderMap, requestFrame]);

  // Trigger rendering when key dependencies change
  useEffect(() => {
    debouncedRenderMap();
    return () => {
      if (frameIdRef.current) {
        cancelFrame();
        frameIdRef.current = null;
      }
    };
  }, [debouncedRenderMap, width, height, telemetryData]);

  // Clean up when component unmounts
  useEffect(() => {
    return () => {
      if (frameIdRef.current) {
        cancelFrame();
      }
      if (canvasRef.current) {
        canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, []);

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

  return (
    <Widget id={id} title="Basic Map" onClose={onClose} width={width} height={height}>
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
            {mapBuildingState === 'recording' && (
              <div className="absolute top-2 right-2">
                <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse"></div>
              </div>
            )}
          </div>
        )}
      </div>
    </Widget>
  );
};

// Control definitions for the widget registry
const getBasicMapControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  // Default values if not set
  const width = widgetState.width || 480;
  const height = widgetState.height || 300;
  const mapBuildingState = widgetState.mapBuildingState || 'idle';
  const trackWidth = widgetState.trackWidth || 4;
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'width',
      type: 'slider' as WidgetControlType,
      label: `Width: ${width}px`,
      value: width,
      options: [
        { value: 400, label: '400px' },
        { value: 600, label: '600px' },
        { value: 800, label: '800px' },
        { value: 1000, label: '1000px' },
        { value: 1200, label: '1200px' },
        { value: 1400, label: '1400px' },
        
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ width: numericValue });
        
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { width: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    },
    {
      id: 'height',
      type: 'slider' as WidgetControlType,
      label: `Height: ${height}px`,
      value: height,
      options: [
        { value: 200, label: '200px' },
        { value: 400, label: '400px' },
        { value: 600, label: '600px' },
        { value: 800, label: '800px' },
        { value: 1000, label: '1000px' },
        
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ height: numericValue });
        
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { height: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    },
    {
      id: 'trackWidth',
      type: 'slider' as WidgetControlType,
      label: `Track Width: ${trackWidth}px`,
      value: trackWidth,
      options: [
        { value: 6, label: '6px' },
        { value: 8, label: '8px' },
        { value: 10, label: '10px' },
        { value: 12, label: '12px' },
        { value: 14, label: '14px' },
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ trackWidth: numericValue });
        
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { trackWidth: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    }
  ];
  
  // Add map recording controls based on current map state
  if (mapBuildingState === 'recording') {
    controls.push({
      id: 'stopRecording',
      type: 'button' as WidgetControlType,
      label: 'Stop Recording',
      value: undefined,
      options: [],
      onChange: () => {
        updateWidget({ mapBuildingState: 'complete' });
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { mapBuildingState: 'complete' });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    });
  } else if (mapBuildingState === 'complete') {
    controls.push({
      id: 'startNewRecording',
      type: 'button' as WidgetControlType,
      label: 'Start New Recording',
      value: undefined,
      options: [],
      onChange: () => {
        updateWidget({ mapBuildingState: 'idle' });
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { mapBuildingState: 'idle' });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    });
  }
  
  return controls;
};

// Wrap the component with controls for the registry
const BasicMapWidget = withControls(BasicMapWidgetComponent, getBasicMapControls);

export default BasicMapWidget; 