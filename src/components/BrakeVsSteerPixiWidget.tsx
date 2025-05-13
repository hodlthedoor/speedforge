import React, { useEffect, useRef, useState } from 'react';
import 'pixi.js/unsafe-eval';
import * as PIXI from 'pixi.js';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

interface BrakeVsSteerProps {
  id: string;
  onClose: () => void;
}

const BrakeVsSteerPixiWidget: React.FC<BrakeVsSteerProps> = ({ id, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const scatterRef = useRef<PIXI.Graphics | null>(null);

  const [historyLength, setHistoryLength] = useState(100);
  const historyRef = useRef(historyLength);
  const [width, setWidth] = useState(480);
  const [maxAngle, setMaxAngle] = useState(270);

  useEffect(() => { historyRef.current = historyLength; }, [historyLength]);

  useEffect(() => {
    const widget = WidgetManager.getWidget(id);
    if (widget?.state) {
      if (widget.state.historyLength != null) setHistoryLength(+widget.state.historyLength);
      if (widget.state.width != null) setWidth(+widget.state.width);
      if (widget.state.maxAngle != null) setMaxAngle(+widget.state.maxAngle);
    } else {
      WidgetManager.updateWidgetState(id, { historyLength, width, maxAngle });
    }
    const unsub = WidgetManager.subscribe(e => {
      if (e.type === 'widget:state:updated' && e.widgetId === id) {
        if (e.state.historyLength != null) setHistoryLength(+e.state.historyLength);
        if (e.state.width != null) setWidth(+e.state.width);
        if (e.state.maxAngle != null) setMaxAngle(+e.state.maxAngle);
      }
    });
    return () => unsub();
  }, [id]);

  const { data: telemetry, isConnected } = useTelemetryData(id, {
    metrics: ['brake_pct', 'steering_angle_deg'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 20
  });

  const bufferRef = useRef<{ brk: number; steer: number }[]>([]);

  useEffect(() => {
    if (telemetry) {
      const brk = telemetry.brake_pct ?? 0;
      const steer = telemetry.steering_angle_deg ?? 0;
      bufferRef.current = [...bufferRef.current, { brk, steer }].slice(-500);
    }
  }, [telemetry]);

  // Ensure Pixi initializes once and only when container is ready
  const pixiInitializedRef = useRef<boolean>(false);
  const [isPixiReady, setIsPixiReady] = useState<boolean>(false);
  useEffect(() => {
    if (pixiInitializedRef.current || !isConnected || !containerRef.current) return;
    pixiInitializedRef.current = true;
    const app = new PIXI.Application();
    app.init({ width, height: 300, backgroundAlpha: 0 }).then(() => {
      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;
      scatterRef.current = new PIXI.Graphics();
      app.stage.addChild(scatterRef.current!);
      setIsPixiReady(true);
    }).catch(() => {});
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
        appRef.current = null;
        scatterRef.current = null;
        setIsPixiReady(false);
      }
    };
  }, [isConnected, containerRef.current]);

  // Draw scatter points
  useEffect(() => {
    const app = appRef.current;
    const gfx = scatterRef.current;
    if (!isPixiReady || !app || !gfx) return;

    const pts = bufferRef.current.slice(-historyRef.current);
    const w = width;
    const h = 300;
    const margin = 20;
    const usableW = w - margin * 2;
    const usableH = h - margin * 2;
    gfx.clear();

    // Draw historical points
    pts.forEach((p, i) => {
      const alpha = i / pts.length;
      const x = margin + Math.min(Math.abs(p.steer), maxAngle) / maxAngle * usableW;
      const y = h - margin - (p.brk / 100) * usableH;
      gfx.beginPath();
      gfx.circle(x, y, 4);
      gfx.fill({ color: 0xF44336, alpha });
    });

    // highlight latest
    if (pts.length) {
      const p = pts[pts.length - 1];
      const x = margin + Math.min(Math.abs(p.steer), maxAngle) / maxAngle * usableW;
      const y = h - margin - (p.brk / 100) * usableH;
      gfx.beginPath();
      gfx.circle(x, y, 6);
      gfx.fill({ color: 0xFFFFFF });
    }
  }, [telemetry, width, historyLength, maxAngle]);

  // Resize the Pixi canvas when width changes
  useEffect(() => {
    const app = appRef.current;
    if (app) {
      app.renderer.resize(width, 300);
    }
  }, [width]);

  return (
    <Widget id={id} title="Brake vs Steering (Pixi)" width={width} onClose={onClose}>
      <div ref={containerRef} />
    </Widget>
  );
};

const getControls = (state: any, update: (u: any) => void): WidgetControlDefinition[] => {
  const hist = state.historyLength || 100;
  const w = state.width || 480;
  const mA = state.maxAngle || 270;
  return [
    { id: 'historyLength', type: 'slider' as WidgetControlType, label: `History: ${hist}`, value: hist,
      options: [20,50,100,200,500].map(v=>({ value: v, label: `${v}` })),
      onChange: v => { WidgetManager.updateWidgetState(state.id, { historyLength: +v }); update({ historyLength: +v }); }
    },
    { id: 'width', type: 'slider' as WidgetControlType, label: `Width: ${w}px`, value: w,
      options: [400,500,600,700,800,1000].map(v=>({ value: v, label: `${v}px` })),
      onChange: v => { WidgetManager.updateWidgetState(state.id, { width: +v }); update({ width: +v }); }
    },
    { id: 'maxAngle', type: 'slider' as WidgetControlType, label: `Max Steering: ${mA}°`, value: mA,
      options: [180,270,360,540].map(v=>({ value: v, label: `${v}°` })),
      onChange: v => { WidgetManager.updateWidgetState(state.id, { maxAngle: +v }); update({ maxAngle: +v }); }
    }
  ];
};

export default withControls(BrakeVsSteerPixiWidget, getControls);
