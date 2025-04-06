import React, { useState } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';

interface WidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
}

export const SimpleControlPanel: React.FC = () => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: 'speed', name: 'Speed Indicator', enabled: false },
    { id: 'rpm', name: 'RPM Gauge', enabled: false },
    { id: 'lap-time', name: 'Lap Timer', enabled: false }
  ]);

  const toggleWidget = (id: string) => {
    setWidgets(prevWidgets => 
      prevWidgets.map(widget => 
        widget.id === id ? { ...widget, enabled: !widget.enabled } : widget
      )
    );
    console.log(`Toggled widget: ${id}`);
  };

  const quitApplication = () => {
    console.log('Quit button clicked');
    try {
      if (window.electronAPI) {
        window.electronAPI.app.quit()
          .then(result => {
            console.log('Quit result:', result);
            if (window.location) {
              window.location.href = 'about:blank';
            }
          })
          .catch(error => {
            console.error('Error quitting:', error);
          });
      } else {
        console.warn('Electron API not available for quitting');
      }
    } catch (error) {
      console.error('Unexpected error during quit:', error);
    }
  };

  return (
    <BaseDraggableComponent initialPosition={{ x: 100, y: 100 }} className="simple-control-panel-wrapper">
      <div className="simple-control-panel visible-panel">
        <div className="panel-header visible-header drag-handle">
          <h2 className="visible-title">Widget Control Panel</h2>
        </div>
        
        <div className="widget-list visible-list">
          <h3 className="visible-subtitle">Available Widgets</h3>
          <div className="widget-items visible-items">
            {widgets.map(widget => (
              <div 
                key={widget.id}
                className="widget-item visible-item"
              >
                <span className="widget-name visible-text">{widget.name}</span>
                <button
                  className={`widget-toggle visible-button ${widget.enabled ? 'enabled' : 'disabled'}`}
                  onClick={() => toggleWidget(widget.id)}
                >
                  {widget.enabled ? 'Enabled' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </div>
        
        <div className="panel-footer visible-footer">
          <button 
            className="quit-app-button visible-quit-button"
            onClick={quitApplication}
          >
            Quit Application
          </button>
        </div>
      </div>
    </BaseDraggableComponent>
  );
}; 