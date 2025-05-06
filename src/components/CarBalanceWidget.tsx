import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import Widget from './Widget';
import { useTelemetryData, TelemetryMetric } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import { WidgetManager } from '../services/WidgetManager';
import { useWidgetStateUpdates, dispatchWidgetStateUpdate } from './BaseWidget';

interface CarBalanceWidgetProps {
  id: string;
  onClose: () => void;
}

interface BalanceData {
  timestamp: number;
  yawRate: number;
  slipAngle: number;
  lateralG: number;
  steeringAngle: number;
}

const CarBalanceWidgetComponent: React.FC<CarBalanceWidgetProps> = ({ id, onClose }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<BalanceData[]>([]);
  const dataRef = useRef<BalanceData[]>([]);
  const animationFrameId = useRef<number | null>(null);
  const [historyLength, setHistoryLength] = useState<number>(100);
  const historyLengthRef = useRef<number>(100);
  const [width, setWidth] = useState<number>(480);
  const widthRef = useRef<number>(480);
  
  // Maximum history buffer size
  const MAX_HISTORY_BUFFER = 500;
  
  // Update refs when state changes
  useEffect(() => {
    historyLengthRef.current = historyLength;
  }, [historyLength]);
  
  useEffect(() => {
    widthRef.current = width;
  }, [width]);
  
  // Callbacks for controls
  const updateHistoryLength = useCallback((newLength: number) => {
    if (historyLengthRef.current !== newLength) {
      setHistoryLength(newLength);
    }
  }, []);
  
  const updateWidth = useCallback((newWidth: number) => {
    if (widthRef.current !== newWidth) {
      setWidth(newWidth);
    }
  }, []);
  
  // Expose functions via static properties
  (CarBalanceWidgetComponent as any).updateHistoryLength = updateHistoryLength;
  (CarBalanceWidgetComponent as any).updateWidth = updateWidth;
  
  // Use widget state updates
  useWidgetStateUpdates(id, (state) => {
    if (state.historyLength !== undefined) {
      const newLength = Number(state.historyLength);
      if (historyLengthRef.current !== newLength) {
        setHistoryLength(newLength);
      }
    }
    
    if (state.width !== undefined) {
      const newWidth = Number(state.width);
      if (widthRef.current !== newWidth) {
        setWidth(newWidth);
      }
    }
  });
  
  // Initialize with WidgetManager
  useEffect(() => {
    const widget = WidgetManager.getWidget(id);
    if (widget) {
      if (widget.state) {
        if (widget.state.historyLength !== undefined) {
          const storedLength = Number(widget.state.historyLength);
          if (storedLength !== historyLengthRef.current) {
            setHistoryLength(storedLength);
          }
        }
        
        if (widget.state.width !== undefined) {
          const storedWidth = Number(widget.state.width);
          if (storedWidth !== widthRef.current) {
            setWidth(storedWidth);
          }
        } else {
          WidgetManager.updateWidgetState(id, { width: widthRef.current });
        }
      } else {
        WidgetManager.updateWidgetState(id, { 
          historyLength: historyLengthRef.current,
          width: widthRef.current
        });
      }
    } else {
      WidgetManager.updateWidgetState(id, { 
        historyLength: historyLengthRef.current,
        width: widthRef.current
      });
    }
    
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        if (event.state.historyLength !== undefined) {
          const newLength = Number(event.state.historyLength);
          if (historyLengthRef.current !== newLength) {
            setHistoryLength(newLength);
          }
        }
        
        if (event.state.width !== undefined) {
          const newWidth = Number(event.state.width);
          if (widthRef.current !== newWidth) {
            setWidth(newWidth);
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
    if (historyLengthRef.current === historyLength) return;
    WidgetManager.updateWidgetState(id, { historyLength });
    
    if (!animationFrameId.current) {
      animationFrameId.current = requestAnimationFrame(() => {
        setData(dataRef.current.slice(-historyLength));
        animationFrameId.current = null;
      });
    }
  }, [historyLength, id]);
  
  useEffect(() => {
    if (widthRef.current === width) return;
    WidgetManager.updateWidgetState(id, { width });
    updateChart();
  }, [width, id]);
  
  // Get telemetry data
  const { data: telemetryData } = useTelemetryData(id, { 
    metrics: [
      'yaw_rate_deg_s',
      'car_slip_angle_deg',
      'g_force_lat',
      'steering_angle_deg'
    ] as TelemetryMetric[],
    throttleUpdates: true,
    updateInterval: 20
  });

  // Process telemetry data
  useEffect(() => {
    if (telemetryData) {
      const newData: BalanceData = {
        timestamp: Date.now(),
        yawRate: telemetryData.yaw_rate_deg_s || 0,
        slipAngle: telemetryData.car_slip_angle_deg || 0,
        lateralG: telemetryData.g_force_lat || 0,
        steeringAngle: telemetryData.steering_angle_deg || 0
      };

      dataRef.current = [...dataRef.current, newData].slice(-MAX_HISTORY_BUFFER);
      
      if (!animationFrameId.current) {
        animationFrameId.current = requestAnimationFrame(() => {
          setData(dataRef.current.slice(-historyLengthRef.current));
          animationFrameId.current = null;
        });
      }
    }
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = null;
      }
    };
  }, [telemetryData]);

  // D3 drawing logic
  const updateChart = useCallback(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    const currentWidth = widthRef.current;
    const height = 300;
    const margin = { top: 20, right: 20, bottom: 30, left: 20 };

    // Update SVG size
    svg
      .attr('width', currentWidth)
      .attr('height', height);

    // Clear previous content
    svg.selectAll('*').remove();

    // Calculate dimensions for each gauge
    const gaugeWidth = (currentWidth - margin.left - margin.right) / 2;
    const gaugeHeight = (height - margin.top - margin.bottom) / 2;
    const radius = Math.min(gaugeWidth, gaugeHeight) * 0.4;

    // Create gauge groups
    const slipGauge = svg.append('g')
      .attr('transform', `translate(${margin.left + gaugeWidth/2}, ${margin.top + gaugeHeight/2})`);

    const yawGauge = svg.append('g')
      .attr('transform', `translate(${margin.left + gaugeWidth*1.5}, ${margin.top + gaugeHeight/2})`);

    const lateralGGauge = svg.append('g')
      .attr('transform', `translate(${margin.left + gaugeWidth/2}, ${margin.top + gaugeHeight*1.5})`);

    const steeringGauge = svg.append('g')
      .attr('transform', `translate(${margin.left + gaugeWidth*1.5}, ${margin.top + gaugeHeight*1.5})`);

    // Create arc generators for circular gauges
    const arc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(Math.PI / 2);

    // Draw slip angle gauge
    slipGauge.append('path')
      .datum({ endAngle: Math.PI / 2 })
      .style('fill', '#2196F3')
      .attr('d', arc);

    slipGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.5em')
      .style('fill', 'white')
      .text('Slip Angle');

    // Draw yaw rate gauge
    yawGauge.append('path')
      .datum({ endAngle: Math.PI / 2 })
      .style('fill', '#4CAF50')
      .attr('d', arc);

    yawGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.5em')
      .style('fill', 'white')
      .text('Yaw Rate');

    // Draw lateral G gauge
    const lateralGWidth = gaugeWidth * 0.8;
    const lateralGHeight = gaugeHeight * 0.2;

    lateralGGauge.append('rect')
      .attr('x', -lateralGWidth/2)
      .attr('y', -lateralGHeight/2)
      .attr('width', lateralGWidth)
      .attr('height', lateralGHeight)
      .style('fill', '#F44336');

    lateralGGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', -lateralGHeight)
      .style('fill', 'white')
      .text('Lateral G');

    // Draw steering angle gauge
    steeringGauge.append('path')
      .datum({ endAngle: Math.PI / 2 })
      .style('fill', '#FFC107')
      .attr('d', arc);

    steeringGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.5em')
      .style('fill', 'white')
      .text('Steering');

    // Update gauge values
    const latestData = data[data.length - 1];

    // Update slip angle gauge
    const slipArc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + (latestData.slipAngle / 45) * Math.PI);

    slipGauge.append('path')
      .datum({ endAngle: -Math.PI / 2 + (latestData.slipAngle / 45) * Math.PI })
      .style('fill', '#2196F3')
      .attr('d', slipArc);

    slipGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', radius + 20)
      .style('fill', 'white')
      .text(`${latestData.slipAngle.toFixed(1)}°`);

    // Update yaw rate gauge
    const yawArc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + (latestData.yawRate / 180) * Math.PI);

    yawGauge.append('path')
      .datum({ endAngle: -Math.PI / 2 + (latestData.yawRate / 180) * Math.PI })
      .style('fill', '#4CAF50')
      .attr('d', yawArc);

    yawGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', radius + 20)
      .style('fill', 'white')
      .text(`${latestData.yawRate.toFixed(1)}°/s`);

    // Update lateral G gauge
    const lateralGValue = latestData.lateralG;
    const lateralGIndicator = lateralGGauge.append('rect')
      .attr('x', -lateralGWidth/2)
      .attr('y', -lateralGHeight/2)
      .attr('width', (lateralGWidth * (lateralGValue + 2)) / 4)
      .attr('height', lateralGHeight)
      .style('fill', '#F44336');

    lateralGGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', lateralGHeight + 20)
      .style('fill', 'white')
      .text(`${latestData.lateralG.toFixed(2)}G`);

    // Update steering angle gauge
    const steeringArc = d3.arc()
      .innerRadius(radius * 0.6)
      .outerRadius(radius)
      .startAngle(-Math.PI / 2)
      .endAngle(-Math.PI / 2 + (latestData.steeringAngle / 180) * Math.PI);

    steeringGauge.append('path')
      .datum({ endAngle: -Math.PI / 2 + (latestData.steeringAngle / 180) * Math.PI })
      .style('fill', '#FFC107')
      .attr('d', steeringArc);

    steeringGauge.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', radius + 20)
      .style('fill', 'white')
      .text(`${latestData.steeringAngle.toFixed(1)}°`);

  }, [data, historyLength, width]);

  // Apply D3 visualization when data changes
  useEffect(() => {
    updateChart();
  }, [updateChart]);

  // Clean up
  useEffect(() => {
    return () => {
      if (svgRef.current) {
        d3.select(svgRef.current).selectAll('*').remove();
      }
      dataRef.current = [];
    };
  }, []);

  return (
    <Widget id={id} title="Car Balance Monitor" onClose={onClose} width={width}>
      <svg
        ref={svgRef}
        width={width}
        height={300}
        className="bg-transparent"
      />
    </Widget>
  );
};

// Control definitions
const getCarBalanceControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  const historyLength = widgetState.historyLength || 100;
  const width = widgetState.width || 480;
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'historyLength',
      type: 'slider' as WidgetControlType,
      label: `History Length: ${historyLength} points`,
      value: historyLength,
      options: [
        { value: 20, label: 'Very Short' },
        { value: 50, label: 'Short' },
        { value: 100, label: 'Medium' },
        { value: 200, label: 'Long' },
        { value: 500, label: 'Very Long' }
      ],
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ historyLength: numericValue });
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { historyLength: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
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
      onChange: (value) => {
        const numericValue = Number(value);
        updateWidget({ width: numericValue });
        try {
          dispatchWidgetStateUpdate(widgetState.id || 'unknown', { width: numericValue });
        } catch (err) {
          console.error(`[Controls] Error in direct update:`, err);
        }
      }
    }
  ];
  
  return controls;
};

// Wrap the component with controls
const CarBalanceWidget = withControls(CarBalanceWidgetComponent, getCarBalanceControls);

export default CarBalanceWidget; 