import React, { useState, useEffect } from 'react';
import { Widget } from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface SessionInfoWidgetProps {
  id: string;
  onClose?: () => void;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  title?: string;
}

const SessionInfoWidget: React.FC<SessionInfoWidgetProps> = ({
  id,
  onClose,
  initialWidth = 600,
  initialHeight = 400,
  initialX = 20,
  initialY = 20,
  title = 'Session Info'
}) => {
  const [sessionInfo, setSessionInfo] = useState<string>('');
  
  // Use telemetry hook to get session info data
  const { data, isConnected } = useTelemetryData(`session-info-${id}`, {
    metrics: [],
    throttleUpdates: true,
    updateInterval: 5000 // Less frequent updates for session info
  });
  
  useEffect(() => {
    if (data && data.session_info !== undefined) {
      setSessionInfo(data.session_info);
    }
  }, [data]);
  
  return (
    <Widget
      id={id}
      title={title}
      onClose={onClose}
      width={initialWidth}
      height={initialHeight}
      initialPosition={{ x: initialX, y: initialY }}
    >
      <div className="session-info-widget">
        {!isConnected && (
          <div className="connection-status error">Not connected to telemetry</div>
        )}
        
        <div className="session-info-content" style={{ 
          height: 'calc(100% - 10px)', 
          overflow: 'auto',
          padding: '5px',
          fontFamily: 'monospace',
          fontSize: '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all'
        }}>
          {sessionInfo || 'No session info available'}
        </div>
      </div>
    </Widget>
  );
};

export default SessionInfoWidget; 