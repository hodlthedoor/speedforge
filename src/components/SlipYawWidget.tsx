import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';

interface SlipYawWidgetProps {
  id: string;
  onClose: () => void;
}

const SlipYawWidgetComponent: React.FC<SlipYawWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  const [widgetSize, setWidgetSize] = useState<number>(300);
  const widgetSizeRef = useRef<number>(300);
  const [slipMax, setSlipMax] = useState<number>(10);
  const slipMaxRef = useRef<number>(10);
  const [yawMax, setYawMax] = useState<number>(100);
  const yawMaxRef = useRef<number>(100);

  // Keep refs in sync
  useEffect(() => { widgetSizeRef.current = widgetSize; }, [widgetSize]);
  useEffect(() => { slipMaxRef.current = slipMax; }, [slipMax]);
  useEffect(() => { yawMaxRef.current = yawMax; }, [yawMax]);

  // Initialize and subscribe to widget state
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
      if (widget.state.slipMax !== undefined) {
        const sm = Number(widget.state.slipMax);
        setSlipMax(sm);
        slipMaxRef.current = sm;
      } else {
        WidgetManager.updateWidgetState(id, { slipMax: slipMaxRef.current });
      }
      if (widget.state.yawMax !== undefined) {
        const ym = Number(widget.state.yawMax);
        setYawMax(ym);
        yawMaxRef.current = ym;
      } else {
        WidgetManager.updateWidgetState(id, { yawMax: yawMaxRef.current });
      }
    } else {
      WidgetManager.updateWidgetState(id, {
        widgetSize: widgetSizeRef.current,
        slipMax: slipMaxRef.current,
        yawMax: yawMaxRef.current
      });
    }

    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.widgetSize !== undefined) {
          const sz = Number(event.state.widgetSize);
          setWidgetSize(sz);
          widgetSizeRef.current = sz;
        }
        if (event.state.slipMax !== undefined) {
          const sm = Number(event.state.slipMax);
          setSlipMax(sm);
          slipMaxRef.current = sm;
        }
        if (event.state.yawMax !== undefined) {
          const ym = Number(event.state.yawMax);
          setYawMax(ym);
          yawMaxRef.current = ym;
        }
      }
    });
    return () => unsubscribe();
  }, [id]);

  const { data: telemetryData } = useTelemetryData(id, {
    metrics: ['car_slip_angle_deg', 'yaw_rate_deg_s'] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 50
  });

  // Render the bubble plot
  const renderChart = useCallback(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const size = widgetSizeRef.current;
    const margin = { top: 20, right: 20, bottom: 20, left: 20 };
    const width = size;
    const height = size;

    const slip = telemetryData?.car_slip_angle_deg ?? 0;
    const yaw = telemetryData?.yaw_rate_deg_s ?? 0;
    const maxSlip = slipMaxRef.current;
    const maxYaw = yawMaxRef.current;

    const svg = d3.select(svgEl)
      .attr('width', width)
      .attr('height', height);

    // Clear previous
    svg.selectAll('.axis, .bubble').remove();

    // Scales
    const xScale = d3.scaleLinear()
      .domain([-maxSlip, maxSlip])
      .range([margin.left, width - margin.right]);
    const yScale = d3.scaleLinear()
      .domain([-maxYaw, maxYaw])
      .range([height - margin.bottom, margin.top]);

    // Axes
    svg.append('line').classed('axis', true)
      .attr('x1', xScale(-maxSlip)).attr('y1', yScale(0))
      .attr('x2', xScale(maxSlip)).attr('y2', yScale(0))
      .attr('stroke', '#555').attr('stroke-width', 1);
    svg.append('line').classed('axis', true)
      .attr('x1', xScale(0)).attr('y1', yScale(-maxYaw))
      .attr('x2', xScale(0)).attr('y2', yScale(maxYaw))
      .attr('stroke', '#555').attr('stroke-width', 1);

    // Bubble
    const bubbleData = [{ slip, yaw }];
    const bubbleSel = svg.selectAll<SVGCircleElement, typeof bubbleData[number]>('circle.bubble').data(bubbleData);
    bubbleSel.enter().append('circle').classed('bubble', true)
      .attr('cx', xScale(0)).attr('cy', yScale(0))
      .attr('r', 6)
      .attr('fill', '#FF9800')
      .attr('stroke', '#fff').attr('stroke-width', 1.5)
    .merge(bubbleSel)
      .transition().duration(100)
      .attr('cx', xScale(slip))
      .attr('cy', yScale(yaw));
    bubbleSel.exit().remove();
  }, [telemetryData]);

  useEffect(() => { renderChart(); }, [renderChart, slipMax, yawMax, widgetSize]);

  return (
    <Widget id={id} title="Slip & Yaw" width={widgetSize} height={widgetSize} onClose={onClose}>
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

const getSlipYawControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  const widgetSize = widgetState.widgetSize || 300;
  const slipMax = widgetState.slipMax || 10;
  const yawMax = widgetState.yawMax || 100;

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
      id: 'slipMax',
      type: 'slider' as WidgetControlType,
      label: `Slip Range: ±${slipMax}°`,
      value: slipMax,
      options: [
        { value: 5, label: '±5°' },
        { value: 10, label: '±10°' },
        { value: 15, label: '±15°' },
        { value: 20, label: '±20°' }
      ],
      onChange: (value) => {
        const newMax = Number(value);
        WidgetManager.updateWidgetState(widgetState.id, { slipMax: newMax });
        updateWidget({ slipMax: newMax });
      }
    },
    {
      id: 'yawMax',
      type: 'slider' as WidgetControlType,
      label: `Yaw Range: ±${yawMax}°/s`,
      value: yawMax,
      options: [
        { value: 50, label: '±50°/s' },
        { value: 100, label: '±100°/s' },
        { value: 150, label: '±150°/s' },
        { value: 200, label: '±200°/s' }
      ],
      onChange: (value) => {
        const newMax = Number(value);
        WidgetManager.updateWidgetState(widgetState.id, { yawMax: newMax });
        updateWidget({ yawMax: newMax });
      }
    }
  ];
};

export default withControls(SlipYawWidgetComponent, getSlipYawControls); 