import React, { useEffect, useRef, useState } from 'react';
import 'pixi.js/unsafe-eval';
import * as PIXI from 'pixi.js';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

interface SlipYawPixiWidgetProps {
  id: string;
  onClose: () => void;
}

const SlipYawPixiWidgetComponent: React.FC<SlipYawPixiWidgetProps> = ({ id, onClose }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const axesRef = useRef<PIXI.Graphics | null>(null);
  const bubbleRef = useRef<PIXI.Graphics | null>(null);

  const [widgetSize, setWidgetSize] = useState<number>(300);
  const [slipMax, setSlipMax] = useState<number>(10);
  const [yawMax, setYawMax] = useState<number>(100);

  // Initialize and subscribe to widget state
  useEffect(() => {
    const widget = WidgetManager.getWidget(id);
    if (widget?.state) {
      if (widget.state.widgetSize != null) setWidgetSize(Number(widget.state.widgetSize));
      else WidgetManager.updateWidgetState(id, { widgetSize });
      if (widget.state.slipMax != null) setSlipMax(Number(widget.state.slipMax));
      else WidgetManager.updateWidgetState(id, { slipMax });
      if (widget.state.yawMax != null) setYawMax(Number(widget.state.yawMax));
      else WidgetManager.updateWidgetState(id, { yawMax });
    } else {
      WidgetManager.updateWidgetState(id, { widgetSize, slipMax, yawMax });
    }
    const unsub = WidgetManager.subscribe(event => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.widgetSize != null) setWidgetSize(Number(event.state.widgetSize));
        if (event.state.slipMax != null) setSlipMax(Number(event.state.slipMax));
        if (event.state.yawMax != null) setYawMax(Number(event.state.yawMax));
      }
    });
    return () => unsub();
  }, [id]);

  // Setup Pixi.js application
  useEffect(() => {
    if (!containerRef.current) return;
    // Create the application and initialize with options
    const app = new PIXI.Application();
    app.init({ width: widgetSize, height: widgetSize, backgroundAlpha: 0 }).then(() => {
      // Append canvas after initialization
      containerRef.current!.appendChild(app.canvas);
      appRef.current = app;
      axesRef.current = new PIXI.Graphics();
      bubbleRef.current = new PIXI.Graphics();
      app.stage.addChild(axesRef.current, bubbleRef.current);
    });
    return () => {
      app.destroy(true, { children: true });
    };
  }, []);

  // Get telemetry data
  const { data: telemetryData } = useTelemetryData(id, {
    metrics: ['car_slip_angle_deg', 'yaw_rate_deg_s'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 50
  });

  // Redraw axes and bubble on data or settings change
  useEffect(() => {
    const app = appRef.current;
    const axes = axesRef.current;
    const bubble = bubbleRef.current;
    if (!app || !axes || !bubble) return;

    const size = widgetSize;
    const margin = 20;

    // Resize renderer to match widget
    app.renderer.resize(size, size);

    // Clear and draw X axis
    axes.clear();
    axes.beginPath();
    axes.moveTo(margin, size / 2);
    axes.lineTo(size - margin, size / 2);
    axes.stroke({ color: 0x555555, width: 1 });

    // Draw Y axis
    axes.beginPath();
    axes.moveTo(size / 2, margin);
    axes.lineTo(size / 2, size - margin);
    axes.stroke({ color: 0x555555, width: 1 });

    // Draw reference rings
    [0.5, 1].forEach(pct => {
      const rx = pct * (size / 2 - margin);
      axes.beginPath();
      axes.circle(size / 2, size / 2, rx);
      axes.stroke({ color: 0x666666, width: 1 });
    });

    // Draw bubble at current slip/yaw
    bubble.clear();
    const slip = telemetryData?.car_slip_angle_deg ?? 0;
    const yawRate = telemetryData?.yaw_rate_deg_s ?? 0;
    const x = ((slip + slipMax) / (2 * slipMax)) * (size - 2 * margin) + margin;
    const y = size - ((yawRate + yawMax) / (2 * yawMax) * (size - 2 * margin) + margin);
    bubble.beginPath();
    bubble.circle(x, y, 6);
    bubble.fill({ color: 0xff9800 });
    bubble.stroke({ color: 0xffffff, width: 1 });
  }, [telemetryData, widgetSize, slipMax, yawMax]);

  return (
    <Widget id={id} title="Slip & Yaw (Pixi)" width={widgetSize} height={widgetSize} onClose={onClose}>
      <div ref={containerRef} />
    </Widget>
  );
};

const getSlipYawPixiControls = (state: any, update: (u: any) => void): WidgetControlDefinition[] => {
  const widgetSize = state.widgetSize || 300;
  const slipMax = state.slipMax || 10;
  const yawMax = state.yawMax || 100;
  return [
    { id: 'widgetSize', type: 'slider' as WidgetControlType, label: `Size: ${widgetSize}px`, value: widgetSize,
      options: [ { value:200,label:'Small'},{value:300,label:'Medium'},{value:400,label:'Large'},{value:500,label:'X-Large'} ],
      onChange: v=>{ const s=Number(v); WidgetManager.updateWidgetState(state.id,{widgetSize:s}); update({widgetSize:s}); }
    },
    { id: 'slipMax', type: 'slider' as WidgetControlType,label:`Slip ±${slipMax}°`,value:slipMax,
      options:[{value:5,label:'±5°'},{value:10,label:'±10°'},{value:15,label:'±15°'},{value:20,label:'±20°'}],
      onChange:v=>{ const s=Number(v); WidgetManager.updateWidgetState(state.id,{slipMax:s}); update({slipMax:s}); }
    },
    { id: 'yawMax', type: 'slider' as WidgetControlType,label:`Yaw ±${yawMax}°/s`,value:yawMax,
      options:[{value:50,label:'±50°/s'},{value:100,label:'±100°/s'},{value:150,label:'±150°/s'},{value:200,label:'±200°/s'}],
      onChange:v=>{ const y=Number(v); WidgetManager.updateWidgetState(state.id,{yawMax:y}); update({yawMax:y}); }
    }
  ];
};

export default withControls(SlipYawPixiWidgetComponent, getSlipYawPixiControls); 