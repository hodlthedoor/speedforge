import React, { useState } from 'react';
import { useWebSocket } from '../services/WebSocketContext';

interface WidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export const SimpleControlPanel: React.FC = () => {
  const webSocketService = useWebSocket();
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: 'speed', name: 'Speed Indicator', enabled: false },
    { id: 'rpm', name: 'RPM Gauge', enabled: false },
    { id: 'lap-time', name: 'Lap Timer', enabled: false }
  ]);
  const [connectionStatus, setConnectionStatus] = useState<string>('Disconnected');

  // Add connection listener when component mounts
  React.useEffect(() => {
    webSocketService.addConnectionListener('simple-control-panel', (connected) => {
      setConnectionStatus(connected ? 'Connected' : 'Disconnected');
    });

    return () => {
      webSocketService.removeListeners('simple-control-panel');
    };
  }, [webSocketService]);

  const toggleWidget = (id: string) => {
    setWidgets(prevWidgets => 
      prevWidgets.map(widget => 
        widget.id === id ? { ...widget, enabled: !widget.enabled } : widget
      )
    );
  };

  const quitApplication = () => {
    if (window.electronAPI) {
      window.electronAPI.app.quit();
    }
  };

  return (
    <div className="simple-control-panel">
      <div className="panel-header">
        <h2>Widget Control Panel</h2>
        <div className="connection-status">
          Status: <span className={connectionStatus === 'Connected' ? 'status-connected' : 'status-disconnected'}>
            {connectionStatus}
          </span>
        </div>
      </div>
      
      <div className="widget-list">
        <h3>Available Widgets</h3>
        <div className="widget-items">
          {widgets.map(widget => (
            <div 
              key={widget.id}
              className="widget-item"
            >
              <span className="widget-name">{widget.name}</span>
              <button
                className={`widget-toggle ${widget.enabled ? 'enabled' : 'disabled'}`}
                onClick={() => toggleWidget(widget.id)}
              >
                {widget.enabled ? 'Enabled' : 'Disabled'}
              </button>
            </div>
          ))}
        </div>
      </div>
      
      <div className="panel-footer">
        <button 
          className="quit-app-button"
          onClick={quitApplication}
        >
          Quit Application
        </button>
      </div>
    </div>
  );
}; 