import React, { useEffect, useRef, useState } from 'react';
import 'pixi.js/unsafe-eval';
import * as PIXI from 'pixi.js';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

interface PedalTracePixiWidgetProps {
  id: string;
  onClose: () => void;
}

const PedalTracePixiWidgetComponent: React.FC<PedalTracePixiWidgetProps> = ({ id, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const throttleRef = useRef<PIXI.Graphics | null>(null);
  const brakeRef = useRef<PIXI.Graphics | null>(null);

  const [historyLength, setHistoryLength] = useState<number>(100);
  const historyRef = useRef<number>(100);
  const [width, setWidth] = useState<number>(480);

  // Keep refs in sync
  useEffect(() => { historyRef.current = historyLength; }, [historyLength]);

  // Widget state init
  useEffect(() => {
    const widget = WidgetManager.getWidget(id);
    if (widget?.state) {
      if (widget.state.historyLength != null) setHistoryLength(Number(widget.state.historyLength));
      else WidgetManager.updateWidgetState(id, { historyLength });
      if (widget.state.width != null) setWidth(Number(widget.state.width));
      else WidgetManager.updateWidgetState(id, { width });
    } else {
      WidgetManager.updateWidgetState(id, { historyLength, width });
    }
    const unsub = WidgetManager.subscribe(event => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.historyLength != null) setHistoryLength(Number(event.state.historyLength));
        if (event.state.width != null) setWidth(Number(event.state.width));
      }
    });
    return () => unsub();
  }, [id]);

  // Wait for telemetry connection before initializing Pixi (ensures BaseWidget has rendered children)
  const { data: telemetryData, isConnected: telemetryConnected } = useTelemetryData(id, {
    metrics: ['throttle_pct', 'brake_pct'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 20
  });

  // Data buffer
  const bufferRef = useRef<{t:number; thr:number; brk:number}[]>([]);
  // Ref to ensure Pixi init only happens once
  const pixiInitializedRef = useRef<boolean>(false);

  // Update buffer on data
  useEffect(() => {
    if (telemetryData) {
      const now = Date.now();
      const thr = telemetryData.throttle_pct ?? 0;
      const brk = telemetryData.brake_pct ?? 0;
      bufferRef.current = [...bufferRef.current, { t: now, thr, brk }].slice(-500);
    }
  }, [telemetryData]);

  // Draw
  useEffect(() => {
    const app = appRef.current;
    const thrG = throttleRef.current;
    const brkG = brakeRef.current;
    if (!app || !thrG || !brkG) return;

    const pts = bufferRef.current.slice(-historyRef.current);
    const w = width;
    const h = 150;
    const margin = { top: 3, right: 0, bottom: 5, left: 0 };
    const usableW = w - margin.left - margin.right;
    const usableH = h - margin.top - margin.bottom;
    const len = pts.length;
    if (len < 2) return;

    // Clear previous graphics and start new paths
    thrG.clear().beginPath();
    brkG.clear().beginPath();

    // Build throttle path
    pts.forEach((p, i) => {
      const x = margin.left + (i / (historyRef.current - 1)) * usableW;
      const y = (h - margin.bottom) - p.thr / 100 * usableH;
      if (i === 0) thrG.moveTo(x, y);
      else thrG.lineTo(x, y);
    });
    // Stroke the throttle path
    thrG.stroke({ color: 0x4CAF50, width: 2.8 });

    // Build brake path
    pts.forEach((p, i) => {
      const x = margin.left + (i / (historyRef.current - 1)) * usableW;
      const y = (h - margin.bottom) - p.brk / 100 * usableH;
      if (i === 0) brkG.moveTo(x, y);
      else brkG.lineTo(x, y);
    });
    // Stroke the brake path
    brkG.stroke({ color: 0xF44336, width: 2.8 });
  }, [telemetryData, width, historyLength]);

  useEffect(() => {
    // Only initialize once after telemetry connects and container is mounted
    if (!telemetryConnected || !containerRef.current || pixiInitializedRef.current) {
      return;
    }
    pixiInitializedRef.current = true;

    const initOptions = { width, height: 150, backgroundAlpha: 0 };
    const app = new PIXI.Application();
    app.init(initOptions)
      .then(() => {
        containerRef.current!.appendChild(app.canvas);
        appRef.current = app;
        throttleRef.current = new PIXI.Graphics();
        brakeRef.current = new PIXI.Graphics();
        app.stage.addChild(throttleRef.current, brakeRef.current);
      })
      .catch(() => {});
    return () => {
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
      }
    };
  }, [telemetryConnected, containerRef.current]);

  // Resize Pixi canvas when width changes
  useEffect(() => {
    const app = appRef.current;
    if (app) {
      app.renderer.resize(width, 150);
    }
  }, [width]);

  return (
    <Widget id={id} title="Pedal Inputs (Pixi)" width={width} onClose={onClose}>
      <div ref={containerRef} />
    </Widget>
  );
};

const getPedalTracePixiControls = (state: any, update: (u: any) => void): WidgetControlDefinition[] => {
  const historyLength = state.historyLength || 100;
  const width = state.width || 480;
  return [
    {
      id: 'historyLength',
      type: 'slider' as WidgetControlType,
      label: `History: ${historyLength} points`,
      value: historyLength,
      options: [
        { value: 20, label: 'Very Short' },
        { value: 50, label: 'Short' },
        { value: 100, label: 'Medium' },
        { value: 200, label: 'Long' },
        { value: 500, label: 'Very Long' }
      ],
      onChange: v => { const h = Number(v); WidgetManager.updateWidgetState(state.id, { historyLength: h }); update({ historyLength: h }); }
    },
    {
      id: 'width',
      type: 'slider' as WidgetControlType,
      label: `Width: ${width}px`,
      value: width,
      options: [
        { value: 400, label: '400px' },
        { value: 500, label: '500px' },
        { value: 600, label: '600px' },
        { value: 700, label: '700px' },
        { value: 800, label: '800px' },
        { value: 1000, label: '1000px' }
      ],
      onChange: v => { const w = Number(v); WidgetManager.updateWidgetState(state.id, { width: w }); update({ width: w }); }
    }
  ];
};

export default withControls(PedalTracePixiWidgetComponent, getPedalTracePixiControls); 