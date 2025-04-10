import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as PIXI from 'pixi.js';
import Widget from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';
import { TrackSurface } from '../types/telemetry';
import { useTrackMapControls } from '../widgets/TrackMapControls';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { withControls } from '../widgets/WidgetRegistryAdapter';

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

  // Create PIXI app on mount
  useEffect(() => {
    if (pixiContainerRef.current && !pixiAppRef.current) {
      try {
        console.log('Initializing PIXI application...');
        // Initialize with simpler options for PIXI v8
        const app = new PIXI.Application();
        
        // Configure the renderer
        app.renderer.background.color = 0x1f2937;
        app.renderer.resize(
          pixiContainerRef.current.clientWidth || 400,
          pixiContainerRef.current.clientHeight || 300
        );
        
        // Configure the canvas element
        app.canvas.style.width = '100%';
        app.canvas.style.height = '100%';
        app.canvas.style.display = 'block';
        
        // Clear container and append the canvas
        while (pixiContainerRef.current.firstChild) {
          pixiContainerRef.current.removeChild(pixiContainerRef.current.firstChild);
        }
        
        pixiContainerRef.current.appendChild(app.canvas);
        pixiAppRef.current = app;
        
        console.log('PIXI application initialized successfully');
        
        // Add a simple debug graphics test to verify rendering works
        const testGraphics = new PIXI.Graphics();
        
        // Draw a simple cross pattern to verify rendering
        testGraphics.lineStyle(4, 0xff0000);
        testGraphics.moveTo(20, 20);
        testGraphics.lineTo(app.renderer.width - 20, app.renderer.height - 20);
        
        testGraphics.lineStyle(4, 0x00ff00);
        testGraphics.moveTo(app.renderer.width - 20, 20);
        testGraphics.lineTo(20, app.renderer.height - 20);
        
        app.stage.addChild(testGraphics);
        
        // Add resize observer
        const resizeObserver = new ResizeObserver(() => {
          if (pixiContainerRef.current && pixiAppRef.current) {
            pixiAppRef.current.renderer.resize(
              pixiContainerRef.current.clientWidth || 400,
              pixiContainerRef.current.clientHeight || 300
            );
            debouncedRenderPixiMap();
          }
        });
        
        resizeObserver.observe(pixiContainerRef.current);
        
        return () => {
          console.log('Cleaning up PIXI application');
          resizeObserver.disconnect();
          app.destroy(true);
          pixiAppRef.current = null;
        };
      } catch (error) {
        console.error('Error initializing PIXI:', error);
      }
    }
    return () => {
      if (pixiAppRef.current) {
        pixiAppRef.current.destroy(true);
        pixiAppRef.current = null;
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

  // PIXI rendering using Graphics (replacing d3)
  const renderPixiMap = useCallback(() => {
    try {
      const app = pixiAppRef.current;
      if (!app) {
        console.warn('No PIXI app available for rendering');
        return;
      }
      
      // Clear the stage
      app.stage.removeChildren();
      
      if (trackPoints.length < 2) {
        console.log('Not enough track points to render map');
        return;
      }
      
      console.log('Rendering track with', trackPoints.length, 'points');
      
      // Get the actual dimensions of the canvas
      const width = app.renderer.width;
      const height = app.renderer.height;
      const padding = 10;
      
      // Use a copy of trackPoints to avoid any mutation issues
      const points = [...trackPoints];
      const xVals = points.map(p => p.x);
      const yVals = points.map(p => p.y);
      
      // Check for valid coordinates
      if (xVals.some(isNaN) || yVals.some(isNaN)) {
        console.warn('Track contains invalid coordinates');
        return;
      }
      
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
      
      // Create and add graphics object
      const graphics = new PIXI.Graphics();
      
      // Draw track lines - using simpler approach for PIXI v8
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        
        graphics.lineStyle(2.5, getLineColor(p2));
        graphics.moveTo(xScale(p1.x), yScale(p1.y));
        graphics.lineTo(xScale(p2.x), yScale(p2.y));
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
          
          // Create S/F text - PIXI v8 compatible
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
        // Draw car position circle
        graphics.beginFill(hexToNumber("#fbbf24"));
        graphics.drawCircle(xScale(carPos.x), yScale(carPos.y), 5);
        graphics.endFill();
        
        // Draw heading line if available
        if (carPos.heading !== undefined) {
          const headingLength = 8;
          const headingX = xScale(carPos.x) + Math.cos(carPos.heading) * headingLength;
          const headingY = yScale(carPos.y) + Math.sin(carPos.heading) * headingLength;
          
          graphics.lineStyle(2, hexToNumber("#fbbf24"));
          graphics.moveTo(xScale(carPos.x), yScale(carPos.y));
          graphics.lineTo(headingX, headingY);
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
      
      console.log('Track map rendered successfully');
    } catch (error) {
      console.error('Error rendering track map:', error);
    }
  }, [trackPoints, colorMode, currentPositionIndex, mapBuildingState, telemetryData?.lap_dist_pct, findPositionAtLapDistance]);

  // Debounce PIXI re-rendering similar to previous implementation
  const debouncedRenderPixiMap = useCallback(() => {
    console.log('Attempting to render map, track points:', trackPoints.length);
    
    // Check if we have a valid app and track points before rendering
    if (!pixiAppRef.current) {
      console.warn('No PIXI app available for rendering');
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
    debouncedRenderPixiMap();
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [debouncedRenderPixiMap, trackPoints, colorMode, mapBuildingState, currentPositionIndex, telemetryData]);

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

  return (
    <Widget id={id} title="Track Map" className="w-auto max-w-[600px]" onClose={onClose}>
      <div className="w-full max-w-[550px] h-[300px]">
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
