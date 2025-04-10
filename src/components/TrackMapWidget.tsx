import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
// Import the unsafe-eval module to enable support for environments that don't allow unsafe-eval
import '@pixi/unsafe-eval';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';
import { TrackSurface } from '../types/telemetry';
import { useTrackMapControls } from '../widgets/TrackMapControls';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { withControls } from '../widgets/WidgetRegistryAdapter';

// Import specific renderer based on the need - we'll import WebGL
import { autoDetectRenderer } from 'pixi.js';

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

const TrackMapWidgetComponent: React.FC<TrackMapWidgetProps> = ({ 
  id, 
  onClose,
  onStateChange,
  externalControls 
}) => {
  const pixiContainerRef = useRef<HTMLDivElement | null>(null);
  const pixiAppRef = useRef<PIXI.Application | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const lastPositionRef = useRef<TrackPoint | null>(null);
  const trackPointsRef = useRef<TrackPoint[]>([]);
  const mapCompleteRef = useRef<boolean>(false);
  const startLapDistPctRef = useRef<number>(-1);
  const lastTimeRef = useRef<number | null>(null);
  const offTrackCountRef = useRef<number>(0);
  const invalidationTimerRef = useRef<number | null>(null);
  const pixiInitializedRef = useRef<boolean>(false);

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

  // Add a dedicated debug function to render with basic graphics only - defined first
  // to avoid circular dependencies
  const forceBasicRender = useCallback(() => {
    if (!pixiAppRef.current || trackPoints.length < 2) {
      console.warn('Cannot force basic render: app or track points missing');
      return;
    }

    console.log('Forcing basic render of track with', trackPoints.length, 'points');
    
    try {
      const app = pixiAppRef.current;
      
      // Clear all children
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }
      
      // Create a simple graphics object
      const g = new PIXI.Graphics();
      
      // Draw background
      g.beginFill(0x333333);
      g.drawRect(0, 0, app.renderer.width, app.renderer.height);
      g.endFill();
      
      // Prepare to scale points
      const points = [...trackPoints];
      const xVals = points.map(p => p.x).filter(x => !isNaN(x));
      const yVals = points.map(p => p.y).filter(y => !isNaN(y));
      
      if (xVals.length < 2 || yVals.length < 2) {
        console.warn('Not enough valid coordinates for basic render');
        return;
      }
      
      const minX = Math.min(...xVals);
      const maxX = Math.max(...xVals);
      const minY = Math.min(...yVals);
      const maxY = Math.max(...yVals);
      
      const width = app.renderer.width;
      const height = app.renderer.height;
      const padding = 20;
      
      // Simple scaling function
      const scaleX = (x: number) => {
        return padding + (x - minX) * (width - 2 * padding) / (maxX - minX || 1);
      };
      
      const scaleY = (y: number) => {
        return padding + (y - minY) * (height - 2 * padding) / (maxY - minY || 1);
      };
      
      // Draw track outline
      g.lineStyle(3, 0xFFFFFF);
      
      // Draw a test rectangle
      g.drawRect(padding, padding, width - 2 * padding, height - 2 * padding);
      
      // Draw the actual track
      g.lineStyle(2, 0x00AAFF);
      
      let firstPoint = true;
      for (const point of points) {
        if (isNaN(point.x) || isNaN(point.y)) continue;
        
        const x = scaleX(point.x);
        const y = scaleY(point.y);
        
        if (firstPoint) {
          g.moveTo(x, y);
          firstPoint = false;
        } else {
          g.lineTo(x, y);
        }
      }
      
      // Add the graphics to the stage
      app.stage.addChild(g);
      
      console.log('Basic render completed');
    } catch (error) {
      console.error('Error in basic render:', error);
    }
  }, [trackPoints]);

  // Create PIXI app on mount
  useEffect(() => {
    if (pixiContainerRef.current && !pixiAppRef.current) {
      try {
        console.log('Initializing PIXI application...');
        
        // Initialize with proper options for PIXI v8
        const initializePixi = async () => {
          try {
            // Create a new application
            const app = new PIXI.Application();
            
            // Calculate the initial size
            const width = pixiContainerRef.current?.clientWidth || 400;
            const height = pixiContainerRef.current?.clientHeight || 300;
            
            console.log('Container size:', width, height);
            
            // Initialize the application with the correct parameters
            await app.init({
              background: '#1f2937',
              antialias: true,
              width,
              height,
              resolution: window.devicePixelRatio || 1,
            });
            
            console.log('PIXI init completed');
            
            // Check if container is still available
            if (!pixiContainerRef.current) {
              console.warn('Container ref lost during async initialization');
              return;
            }
            
            // Clear container and append the canvas
            while (pixiContainerRef.current.firstChild) {
              pixiContainerRef.current.removeChild(pixiContainerRef.current.firstChild);
            }
            
            // Set canvas style
            app.canvas.style.width = '100%';
            app.canvas.style.height = '100%';
            app.canvas.style.display = 'block';
            
            // Append the application canvas to the container
            pixiContainerRef.current.appendChild(app.canvas);
            pixiAppRef.current = app;
            
            console.log('PIXI canvas appended to container');
            
            // Add a simple debug graphics test to verify rendering works
            const testGraphics = new PIXI.Graphics();
            
            // Draw a simple cross pattern to verify rendering
            testGraphics.lineStyle(4, 0xff0000);
            testGraphics.moveTo(20, 20);
            testGraphics.lineTo(width - 20, height - 20);
            
            testGraphics.lineStyle(4, 0x00ff00);
            testGraphics.moveTo(width - 20, 20);
            testGraphics.lineTo(20, height - 20);
            
            app.stage.addChild(testGraphics);
            
            console.log('PIXI test graphics added');
            
            pixiInitializedRef.current = true;
            
            // Add resize observer to handle container size changes
            const resizeObserver = new ResizeObserver(() => {
              if (pixiContainerRef.current && pixiAppRef.current) {
                const newWidth = pixiContainerRef.current.clientWidth || 400;
                const newHeight = pixiContainerRef.current.clientHeight || 300;
                
                pixiAppRef.current.renderer.resize(newWidth, newHeight);
                console.log('Resized to:', newWidth, newHeight);
                
                // Trigger a re-render by setting a flag in state
                if (trackPoints.length >= 2) {
                  // This will trigger the useEffect that watches trackPoints
                  // which will cause a re-render
                  setCurrentPosition({ ...currentPosition });
                }
              }
            });
            
            resizeObserver.observe(pixiContainerRef.current);
            
            // Return cleanup function
            return () => {
              console.log('Cleaning up PIXI application');
              resizeObserver.disconnect();
              if (pixiAppRef.current) {
                pixiAppRef.current.destroy(true);
                pixiAppRef.current = null;
              }
              pixiInitializedRef.current = false;
            };
          } catch (error) {
            console.error('Error in async PIXI initialization:', error);
            pixiInitializedRef.current = false;
          }
        };
        
        // Start the async initialization
        initializePixi();
      } catch (error) {
        console.error('Error initializing PIXI:', error);
        pixiInitializedRef.current = false;
      }
    }
    
    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true);
        pixiAppRef.current = null;
      }
      pixiInitializedRef.current = false;
    };
  }, []);

  // Trigger rendering when track points change and PIXI is initialized
  useEffect(() => {
    if (pixiInitializedRef.current && trackPoints.length >= 2) {
      console.log('Track points or state changed, rendering map');
      
      // Debounce to avoid excessive rendering
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
      
      animationFrameId.current = requestAnimationFrame(() => {
        renderPixiMap();
        animationFrameId.current = null;
      });
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [trackPoints, colorMode, mapBuildingState, currentPosition]);

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
    console.log('Starting recording');
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
    console.log('Stopping recording, points:', trackPointsRef.current.length);
    setMapBuildingState('complete');
    mapCompleteRef.current = true;
    if (trackPointsRef.current.length > 10) {
      const sortedPoints = [...trackPointsRef.current].sort((a, b) => a.lapDistPct - b.lapDistPct);
      const normalizedTrack = normalizeTrack(sortedPoints);
      console.log('Normalized track points:', normalizedTrack.length);
      setTrackPoints(normalizedTrack);
      
      // Force a re-render after setting track points
      setTimeout(() => {
        if (pixiInitializedRef.current && pixiAppRef.current) {
          console.log('Forcing re-render after recording complete');
          debouncedRenderPixiMap();
        }
      }, 100);
    }
  }, []);

  const cancelRecording = useCallback(() => {
    console.log('Cancelling recording');
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
              if (dist < 20 && trackPointsRef.current.length > 50) {
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

  const findPositionAtLapDistance = useCallback((lapDistPct: number): TrackPoint | null => {
    if (trackPoints.length === 0) return null;
    
    let targetDist = lapDistPct;
    if (targetDist > 1) targetDist -= 1;
    if (targetDist < 0) targetDist += 1;
    
    const exactMatch = trackPoints.find(p => Math.abs(p.lapDistPct - targetDist) < 0.001);
    if (exactMatch) return exactMatch;
    
    let prevPoint = trackPoints[0];
    let nextPoint = trackPoints[0];
    
    for (let i = 0; i < trackPoints.length; i++) {
      if (trackPoints[i].lapDistPct <= targetDist && 
          (i === trackPoints.length - 1 || trackPoints[i + 1].lapDistPct > targetDist)) {
        prevPoint = trackPoints[i];
        nextPoint = i < trackPoints.length - 1 ? trackPoints[i + 1] : trackPoints[0];
        break;
      }
    }
    
    if (targetDist < trackPoints[0].lapDistPct) {
      prevPoint = trackPoints[trackPoints.length - 1];
      nextPoint = trackPoints[0];
    }
    
    let t = 0;
    const prevDist = prevPoint.lapDistPct;
    const nextDist = nextPoint.lapDistPct;
    
    if (nextDist < prevDist) {
      if (targetDist >= prevDist) {
        t = (targetDist - prevDist) / ((1 - prevDist) + nextDist);
      } else {
        t = ((1 - prevDist) + targetDist) / ((1 - prevDist) + nextDist);
      }
    } else {
      t = (targetDist - prevDist) / (nextDist - prevDist);
    }
    
    t = Math.max(0, Math.min(1, t));
    
    return {
      x: prevPoint.x * (1 - t) + nextPoint.x * t,
      y: prevPoint.y * (1 - t) + nextPoint.y * t,
      lapDistPct: targetDist,
      heading: prevPoint.heading,
      curvature: prevPoint.curvature,
      longitudinalAccel: prevPoint.longitudinalAccel
    };
  }, [trackPoints]);

  // PIXI rendering using Graphics
  const renderPixiMap = useCallback(() => {
    try {
      const app = pixiAppRef.current;
      if (!app) {
        console.warn('No PIXI app available for rendering');
        return;
      }
      
      // Clear the stage
      while (app.stage.children.length > 0) {
        app.stage.removeChildAt(0);
      }
      
      if (trackPoints.length < 2) {
        console.log('Not enough track points to render map');
        
        // Add a simple placeholder/debug graphic
        const placeholderGraphics = new PIXI.Graphics();
        placeholderGraphics.lineStyle(2, 0xff00ff);
        placeholderGraphics.drawRect(10, 10, app.renderer.width - 20, app.renderer.height - 20);
        app.stage.addChild(placeholderGraphics);
        
        return;
      }
      
      console.log('Rendering track with', trackPoints.length, 'points, state:', mapBuildingState);
      
      try {
        // Get the actual dimensions of the canvas
        const width = app.renderer.width;
        const height = app.renderer.height;
        const padding = 10;
        
        // Use a copy of trackPoints to avoid any mutation issues
        const points = [...trackPoints].filter(p => 
          p && typeof p.x === 'number' && !isNaN(p.x) && 
          typeof p.y === 'number' && !isNaN(p.y)
        );
        
        if (points.length < 2) {
          console.warn('Not enough valid points after filtering');
          return;
        }
        
        const xVals = points.map(p => p.x);
        const yVals = points.map(p => p.y);
        
        const minX = Math.min(...xVals);
        const maxX = Math.max(...xVals);
        const minY = Math.min(...yVals);
        const maxY = Math.max(...yVals);
        const xRange = maxX - minX || 1;
        const yRange = maxY - minY || 1;
        
        // Ensure we have a valid range
        const maxRange = Math.max(xRange, yRange);
        
        // Calculate domain with padding
        const xDomainMin = minX - 0.05 * maxRange;
        const xDomainMax = maxX + 0.05 * maxRange;
        const yDomainMin = minY - 0.05 * maxRange;
        const yDomainMax = maxY + 0.05 * maxRange;
        
        // Maintain aspect ratio by adjusting the scale
        const xScale = (x: number) => padding + ((x - xDomainMin) * (width - 2 * padding)) / (xDomainMax - xDomainMin);
        const yScale = (y: number) => height - padding - ((y - yDomainMin) * (height - 2 * padding)) / (yDomainMax - yDomainMin);
        
        const hexToNumber = (hex: string) => parseInt(hex.replace("#", ""), 16);
        const getLineColor = (p: TrackPoint) => {
          let color = "#ffffff";
          if (colorMode === 'curvature' && p.curvature !== undefined) {
            color = p.curvature < 0 ? "#3b82f6" : (p.curvature > 0 ? "#ef4444" : "#ffffff");
          } else if (colorMode === 'acceleration' && p.longitudinalAccel !== undefined) {
            const acc = p.longitudinalAccel;
            if (acc <= -3) color = "#ef4444";
            else if (acc < 0) color = "#fb923c";
            else if (acc === 0) color = "#ffffff";
            else if (acc <= 3) color = "#4ade80";
            else color = "#22c55e";
          }
          return hexToNumber(color);
        };
        
        // Create graphics object
        const graphics = new PIXI.Graphics();
        
        // Draw track lines
        for (let i = 1; i < points.length; i++) {
          const p1 = points[i - 1];
          const p2 = points[i];
          
          const x1 = xScale(p1.x);
          const y1 = yScale(p1.y);
          const x2 = xScale(p2.x);
          const y2 = yScale(p2.y);
          
          // Skip any invalid coordinates
          if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
            continue;
          }
          
          graphics.lineStyle(2.5, getLineColor(p2));
          graphics.moveTo(x1, y1);
          graphics.lineTo(x2, y2);
        }
        
        // Draw start/finish line
        if (points.length > 5) {
          let startFinishIndex = -1;
          for (let i = 1; i < points.length; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            if ((p1.lapDistPct > 0.9 && p2.lapDistPct < 0.1) || 
                (p1.lapDistPct < 0.1 && p2.lapDistPct > 0.9)) {
              startFinishIndex = i;
              break;
            }
          }
          
          if (startFinishIndex !== -1) {
            const p1 = points[startFinishIndex - 1];
            const p2 = points[startFinishIndex];
            const x1 = xScale(p1.x);
            const y1 = yScale(p1.y);
            const x2 = xScale(p2.x);
            const y2 = yScale(p2.y);
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const perpX = -dy / len;
            const perpY = dx / len;
            const lineLength = 15;
            
            // Draw start/finish line
            graphics.lineStyle(3, hexToNumber("#ffff00"));
            graphics.moveTo(mx - perpX * lineLength, my - perpY * lineLength);
            graphics.lineTo(mx + perpX * lineLength, my + perpY * lineLength);
            
            // Create S/F text
            const textStyle = new PIXI.TextStyle({
              fontSize: 10,
              fill: 0xffff00
            });
            
            const sfText = new PIXI.Text({
              text: "S/F",
              style: textStyle
            });
            
            sfText.anchor.set(0.5);
            sfText.position.set(mx, my - 10);
            app.stage.addChild(sfText);
          }
        }
        
        // Draw car position
        let carPos: TrackPoint | null = null;
        if (mapBuildingState === 'complete' && telemetryData?.lap_dist_pct !== undefined) {
          carPos = findPositionAtLapDistance(telemetryData.lap_dist_pct);
        } else if (currentPositionIndex >= 0 && points[currentPositionIndex]) {
          carPos = points[currentPositionIndex];
        }
        
        if (carPos) {
          const carX = xScale(carPos.x);
          const carY = yScale(carPos.y);
          
          // Skip if invalid coordinates
          if (!isNaN(carX) && !isNaN(carY)) {
            // Draw car position circle
            graphics.beginFill(hexToNumber("#fbbf24"));
            graphics.drawCircle(carX, carY, 5);
            graphics.endFill();
            
            // Draw heading line if available
            if (carPos.heading !== undefined) {
              const headingLength = 8;
              const headingX = carX + Math.cos(carPos.heading) * headingLength;
              const headingY = carY + Math.sin(carPos.heading) * headingLength;
              
              graphics.lineStyle(2, hexToNumber("#fbbf24"));
              graphics.moveTo(carX, carY);
              graphics.lineTo(headingX, headingY);
            }
          }
        }
        
        // Draw recording indicator
        if (mapBuildingState === 'recording') {
          graphics.beginFill(hexToNumber("#ef4444"), 0.8);
          graphics.drawCircle(width - 15, height - 15, 6);
          graphics.endFill();
        }
        
        // Add the graphics to the stage
        app.stage.addChild(graphics);
        
        console.log('Track render completed successfully');
      } catch (error) {
        console.error('Error during track rendering:', error);
        
        // Add a simple error indicator
        const errorGraphics = new PIXI.Graphics();
        errorGraphics.beginFill(0xff0000, 0.5);
        errorGraphics.drawRect(0, 0, app.renderer.width, app.renderer.height);
        errorGraphics.endFill();
        app.stage.addChild(errorGraphics);
      }
    } catch (error) {
      console.error('Error rendering track map:', error);
    }
  }, [trackPoints, colorMode, mapBuildingState, currentPositionIndex, telemetryData?.lap_dist_pct, findPositionAtLapDistance]);

  // Debounce PIXI re-rendering similar to previous implementation
  const debouncedRenderPixiMap = useCallback(() => {
    console.log('Attempting to render map, track points:', trackPoints.length, 'initialized:', pixiInitializedRef.current);
    
    // Check if we have a valid app and track points before rendering
    if (!pixiAppRef.current) {
      console.warn('No PIXI app available for rendering');
      return;
    }
    
    if (!pixiInitializedRef.current) {
      console.warn('PIXI not fully initialized yet');
      return;
    }
    
    if (trackPoints.length < 2) {
      console.log('Not enough track points to render map');
      return;
    }
    
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    
    animationFrameId.current = requestAnimationFrame(() => {
      console.log('Rendering PIXI map with points:', trackPoints.length);
      renderPixiMap();
      animationFrameId.current = null;
    });
  }, [renderPixiMap, trackPoints]);

  // Add logging when trackPoints changes
  useEffect(() => {
    console.log('Track points updated:', trackPoints.length, 'map state:', mapBuildingState);
  }, [trackPoints, mapBuildingState]);

  // Add effect that triggers render when track points or map state changes
  useEffect(() => {
    if (mapBuildingState === 'complete' && trackPoints.length >= 2 && pixiInitializedRef.current) {
      console.log('Map is complete with valid track, triggering render');
      debouncedRenderPixiMap();
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [debouncedRenderPixiMap, trackPoints, mapBuildingState, animationFrameId]);

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
          const direct = Math.abs(trackPoints[i].lapDistPct - currentPosition.lapDistPct);
          const wrapLow = Math.abs(trackPoints[i].lapDistPct - (currentPosition.lapDistPct + 1));
          const wrapHigh = Math.abs(trackPoints[i].lapDistPct - (currentPosition.lapDistPct - 1));
          const dist = Math.min(direct, wrapLow, wrapHigh);
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

  useEffect(() => {
    if (externalControls) {
      if (externalControls.mapBuildingState !== undefined) {
        setMapBuildingState(externalControls.mapBuildingState);
      }
      if (externalControls.colorMode !== undefined) {
        setColorMode(externalControls.colorMode);
      }
    }
  }, [externalControls]);

  useEffect(() => {
    onStateChange?.({ mapBuildingState, colorMode });
  }, [mapBuildingState, colorMode, onStateChange]);

  const getTrackSurfaceName = (surface: number): string => {
    switch (surface) {
      case TrackSurface.OnTrack: return "On Track";
      case TrackSurface.OffTrack: return "Off Track";
      case TrackSurface.PitLane: return "Pit Lane";
      case TrackSurface.PitStall: return "Pit Stall";
      case TrackSurface.NotInWorld: return "Not In World";
      default: return `Unknown (${surface})`;
    }
  };

  // Create pulse animation style on mount if recording
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
      if (pixiContainerRef.current && pixiAppRef.current) {
        pixiAppRef.current.stage.removeChildren();
      }
      const styleElement = document.getElementById('track-map-pulse-animation');
      if (styleElement) {
        document.head.removeChild(styleElement);
      }
    };
  }, []);

  // Add button to trigger basic render for debugging
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl+Shift+D to force basic render
      if (e.ctrlKey && e.shiftKey && e.key === 'D') {
        console.log('Debug key combination pressed');
        if (pixiInitializedRef.current) {
          console.log('Forcing PIXI render');
          renderPixiMap();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    
    return () => {
      window.removeEventListener('keydown', handleKeyPress);
    };
  }, []);
  
  // Create a debug button
  const debugButton = (
    <button 
      onClick={() => {
        if (pixiInitializedRef.current) {
          console.log('Debug button clicked, forcing render');
          renderPixiMap();
        }
      }}
      className="absolute bottom-2 right-2 bg-blue-700 text-white text-xs px-2 py-1 rounded opacity-50 hover:opacity-100"
    >
      Debug Render
    </button>
  );

  return (
    <Widget id={id} title="Track Map" className="w-auto max-w-[600px]" onClose={onClose}>
      <div className="w-full max-w-[550px] h-[300px] relative">
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
          <div ref={pixiContainerRef} className="w-full h-full rounded overflow-hidden" />
        )}
        {debugButton}
      </div>
    </Widget>
  );
};

const getTrackMapControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  const mapBuildingState = widgetState.mapBuildingState || 'idle';
  const colorMode = widgetState.colorMode || 'none';
  
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
