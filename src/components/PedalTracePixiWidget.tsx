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
  // Debug: log on each render to see when component renders and ref state
  console.log('[PedalTracePixiWidget] component render, containerRef.current:', containerRef.current);
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

  // Debug: log telemetry connection status changes
  useEffect(() => {
    console.log('[PedalTracePixiWidget] telemetryConnected:', telemetryConnected);
  }, [telemetryConnected]);

  useEffect(() => {
    if (!telemetryConnected) {
      console.log('[PedalTracePixiWidget] telemetry not connected yet, delaying Pixi init');
      return;
    }
    if (appRef.current) return;
    console.log('[PedalTracePixiWidget] initializing Pixi, containerRef.current:', containerRef.current);
    if (!containerRef.current) {
      console.warn('[PedalTracePixiWidget] container missing after telemetryConnected');
      return;
    }
    const initOptions = { width, height: 150, backgroundAlpha: 0 };
    console.log('[PedalTracePixiWidget] creating PIXI.Application with options:', initOptions);
    const app = new PIXI.Application();
    app.init(initOptions)
      .then(() => {
        console.log('[PedalTracePixiWidget] app.init() resolved, canvas:', app.canvas);
        containerRef.current!.appendChild(app.canvas);
        appRef.current = app;
        throttleRef.current = new PIXI.Graphics();
        brakeRef.current = new PIXI.Graphics();
        app.stage.addChild(throttleRef.current, brakeRef.current);
        // Debug: add a red square to verify rendering without deprecated APIs
        const debugRect = new PIXI.Graphics();
        // Draw path and fill using new API
        debugRect.rect(0, 0, 20, 20).fill({ color: 0xff0000, alpha: 1 });
        app.stage.addChild(debugRect);
        console.log('[PedalTracePixiWidget] debugRect added to stage');
      })
      .catch(error => {
        console.error('[PedalTracePixiWidget] app.init() failed:', error);
      });
    return () => {
      if (appRef.current) {
        console.log('[PedalTracePixiWidget] destroying PIXI.Application');
        appRef.current.destroy(true, { children: true });
      }
    };
  }, [telemetryConnected, containerRef.current, width]);

  // Data buffer
  const bufferRef = useRef<{t:number; thr:number; brk:number}[]>([]);

  // Update buffer on data
  useEffect(() => {
    console.log('[PedalTracePixiWidget] telemetryData update:', telemetryData);
    if (telemetryData) {
      const now = Date.now();
      const thr = telemetryData.throttle_pct ?? 0;
      const brk = telemetryData.brake_pct ?? 0;
      bufferRef.current = [...bufferRef.current, { t: now, thr, brk }].slice(-500);
    }
  }, [telemetryData]);

  // Draw
  useEffect(() => {
    console.log('[PedalTracePixiWidget] draw effect running, appRef:', appRef.current, 'graphicsRefs:', throttleRef.current, brakeRef.current);
    const app = appRef.current;
    const thrG = throttleRef.current;
    const brkG = brakeRef.current;
    if (!app || !thrG || !brkG) return;

    const pts = bufferRef.current.slice(-historyRef.current);
    console.log('[PedalTracePixiWidget] drawing pts length:', pts.length);
    const w = width;
    const h = 150;
    const margin = { top: 3, right: 0, bottom: 5, left: 0 };
    const usableW = w - margin.left - margin.right;
    const usableH = h - margin.top - margin.bottom;
    const len = pts.length;
    if (len < 2) return;

    // Clear
    thrG.clear(); brkG.clear();

    // Draw throttle line
    thrG.lineStyle(2.8, 0x4CAF50, 1);
    pts.forEach((p, i) => {
      const x = margin.left + (i / (historyRef.current - 1)) * usableW;
      const y = (h - margin.bottom) - p.thr / 100 * usableH;
      if (i === 0) thrG.moveTo(x, y);
      else thrG.lineTo(x, y);
    });
    // Draw brake line
    brkG.lineStyle(2.8, 0xF44336, 1);
    pts.forEach((p, i) => {
      const x = margin.left + (i / (historyRef.current - 1)) * usableW;
      const y = (h - margin.bottom) - p.brk / 100 * usableH;
      if (i === 0) brkG.moveTo(x, y);
      else brkG.lineTo(x, y);
    });
  }, [telemetryData, width, historyLength]);

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