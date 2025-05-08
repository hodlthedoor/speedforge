import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

interface GForceMeterWidgetProps {
  id: string;
  onClose: () => void;
}

const GForceMeterWidgetComponent: React.FC<GForceMeterWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [widgetSize, setWidgetSize] = useState<number>(300);
  const widgetSizeRef = useRef<number>(300);
  const [maxG, setMaxG] = useState<number>(3);
  const maxGRef = useRef<number>(3);
  const [showTrail, setShowTrail] = useState<boolean>(false);
  const showTrailRef = useRef<boolean>(false);
  const trailRef = useRef<Array<{lat:number; lon:number; t:number}>>([]);

  // Keep refs in sync
  useEffect(() => { widgetSizeRef.current = widgetSize; }, [widgetSize]);
  useEffect(() => { maxGRef.current = maxG; }, [maxG]);
  useEffect(() => { showTrailRef.current = showTrail; }, [showTrail]);

  // Initialize from WidgetManager and subscribe to state changes
  useEffect(() => {
    const widget = WidgetManager.getWidget(id);
    if (widget?.state) {
      if (widget.state.widgetSize !== undefined) {
        const sz = Number(widget.state.widgetSize);
        setWidgetSize(sz);
        widgetSizeRef.current = sz;
      } else {
        WidgetManager.updateWidgetState(id, { widgetSize: widgetSizeRef.current });
      }
      if (widget.state.maxG !== undefined) {
        const mg = Number(widget.state.maxG);
        setMaxG(mg);
        maxGRef.current = mg;
      } else {
        WidgetManager.updateWidgetState(id, { maxG: maxGRef.current });
      }
      if (widget.state.showTrail !== undefined) {
        const st = widget.state.showTrail === true || widget.state.showTrail === 'true';
        setShowTrail(st);
        showTrailRef.current = st;
      } else {
        WidgetManager.updateWidgetState(id, { showTrail: false });
      }
    } else {
      WidgetManager.updateWidgetState(id, { widgetSize: widgetSizeRef.current, maxG: maxGRef.current, showTrail: false });
    }
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.widgetSize !== undefined) {
          const sz = Number(event.state.widgetSize);
          setWidgetSize(sz);
          widgetSizeRef.current = sz;
        }
        if (event.state.maxG !== undefined) {
          const mg = Number(event.state.maxG);
          setMaxG(mg);
          maxGRef.current = mg;
        }
        if (event.state.showTrail !== undefined) {
          const st = event.state.showTrail === true || event.state.showTrail === 'true';
          setShowTrail(st);
          showTrailRef.current = st;
        }
      }
    });
    return () => unsubscribe();
  }, [id]);

  const { data: telemetryData } = useTelemetryData(id, {
    metrics: ['g_force_lat', 'g_force_lon'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 50
  });

  // Update trail history on telemetry changes (keep last 2s)
  useEffect(() => {
    if (telemetryData) {
      const now = Date.now();
      const lat = telemetryData.g_force_lat ?? 0;
      const lon = telemetryData.g_force_lon ?? 0;
      trailRef.current.push({ lat, lon, t: now });
      trailRef.current = trailRef.current.filter(pt => pt.t >= now - 2000);
    }
  }, [telemetryData]);

  const renderChart = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;
    const size = widgetSizeRef.current;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const width = size;
    const height = size;
    const lat = telemetryData?.g_force_lat ?? 0;
    const lon = telemetryData?.g_force_lon ?? 0;
    const max = maxGRef.current;
    const svg = d3.select(svgEl)
      .attr('width', width)
      .attr('height', height);
    // Clear only axes/trail/bubble
    svg.selectAll('.axis, .trail, .bubble').remove();

    const xScale = d3.scaleLinear().domain([-max, max]).range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear().domain([-max, max]).range([height - margin.bottom, margin.top]);

    // Draw axes lines
    const axes = [[-max,0, max,0], [0,-max, 0,max]];
    axes.forEach(([x1,y1,x2,y2]) => {
      svg.append('line').classed('axis', true)
        .attr('x1', xScale(x1)).attr('y1', yScale(y1))
        .attr('x2', xScale(x2)).attr('y2', yScale(y2))
        .attr('stroke', '#555').attr('stroke-width', 1);
    });

    // Ticks and labels
    for (let i = -max; i <= max; i++) {
      const xi = xScale(i);
      const yi = yScale(i);
      // X-axis tick
      svg.append('line').classed('axis', true)
        .attr('x1', xi).attr('y1', yScale(0) - 4)
        .attr('x2', xi).attr('y2', yScale(0) + 4)
        .attr('stroke', '#888').attr('stroke-width', 1);
      svg.append('text').classed('axis', true)
        .attr('x', xi).attr('y', yScale(0) + 15)
        .attr('fill', '#ccc').attr('font-size', '10px')
        .attr('text-anchor', 'middle')
        .text(i.toString());
      // Y-axis tick
      svg.append('line').classed('axis', true)
        .attr('x1', xScale(0) - 4).attr('y1', yi)
        .attr('x2', xScale(0) + 4).attr('y2', yi)
        .attr('stroke', '#888').attr('stroke-width', 1);
      if (i !== 0) {
        svg.append('text').classed('axis', true)
          .attr('x', xScale(0) - 10).attr('y', yi + 4)
          .attr('fill', '#ccc').attr('font-size', '10px')
          .attr('text-anchor', 'end')
          .text(i.toString());
      }
    }

    // Draw trail if enabled
    if (showTrailRef.current) {
      const lineGen = d3.line<{lat:number;lon:number;}>()
        .x(d => xScale(d.lat)).y(d => yScale(d.lon));
      const trailSel = svg.selectAll<SVGPathElement, typeof trailRef.current>('path.trail').data([trailRef.current]);
      trailSel.enter().append('path').classed('trail', true)
        .attr('fill', 'none')
        .attr('stroke', 'steelblue')
        .attr('stroke-width', 2)
        .attr('opacity', 0.5)
      .merge(trailSel)
        .attr('d', lineGen(trailRef.current));
      trailSel.exit().remove();
    }

    // Bubble with discrete color zones
    const magnitude = Math.sqrt(lat*lat + lon*lon);
    const rel = magnitude / max;
    let fillColor = '#4CAF50';
    if (rel < 0.5) fillColor = '#4CAF50';
    else if (rel < 0.8) fillColor = '#FFEB3B';
    else if (rel <= 1) fillColor = '#FF9800';
    else fillColor = '#F44336';
    const bubbleData = [{ lat, lon }];
    const bubbleSel = svg.selectAll<SVGCircleElement, typeof bubbleData[number]>('circle.bubble').data(bubbleData);
    bubbleSel.enter().append('circle').classed('bubble', true)
      .attr('cx', xScale(0)).attr('cy', yScale(0))
      .attr('r', 6).attr('stroke', '#fff').attr('stroke-width', 1.5)
      .attr('fill', fillColor)
    .merge(bubbleSel)
      .transition().duration(100)
      .attr('cx', xScale(lat)).attr('cy', yScale(lon))
      .attr('fill', fillColor);
    bubbleSel.exit().remove();
  }, [telemetryData]);

  useEffect(() => { renderChart(); }, [renderChart, maxG, widgetSize, showTrail]);

  return (
    <Widget id={id} title="G-Force Meter" width={widgetSize} height={widgetSize} onClose={onClose}>
      <svg
        ref={svgRef}
        width={widgetSize}
        height={widgetSize}
        className="bg-transparent"
        style={{ pointerEvents: 'none' }}
      />
    </Widget>
  );
};

const getGForceMeterControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  const widgetSize = widgetState.widgetSize || 300;
  const maxG = widgetState.maxG || 3;
  const showTrail = widgetState.showTrail || false;
  return [
    {
      id: 'widgetSize',
      type: 'slider' as WidgetControlType,
      label: `Size: ${widgetSize}px`,
      value: widgetSize,
      options: [
        { value: 200, label: 'Small' },
        { value: 300, label: 'Medium' },
        { value: 400, label: 'Large' },
        { value: 500, label: 'X-Large' }
      ],
      onChange: (value) => {
        const newSize = Number(value);
        WidgetManager.updateWidgetState(widgetState.id, { widgetSize: newSize });
        updateWidget({ widgetSize: newSize });
      }
    },
    {
      id: 'maxG',
      type: 'slider' as WidgetControlType,
      label: `Max G: ${maxG}`,
      value: maxG,
      options: [
        { value: 1, label: '1G' },
        { value: 2, label: '2G' },
        { value: 3, label: '3G' },
        { value: 4, label: '4G' },
        { value: 5, label: '5G' }
      ],
      onChange: (value) => {
        const newMax = Number(value);
        WidgetManager.updateWidgetState(widgetState.id, { maxG: newMax });
        updateWidget({ maxG: newMax });
      }
    },
    {
      id: 'showTrail',
      type: 'toggle' as WidgetControlType,
      label: `Trail: ${showTrail ? 'On' : 'Off'}`,
      value: showTrail,
      onChange: (value) => {
        const st = Boolean(value);
        WidgetManager.updateWidgetState(widgetState.id, { showTrail: st });
        updateWidget({ showTrail: st });
      }
    }
  ];
};

export default withControls(GForceMeterWidgetComponent, getGForceMeterControls); 