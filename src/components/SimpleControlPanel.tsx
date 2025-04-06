import React, { useState } from 'react';
import BaseDraggableComponent from './BaseDraggableComponent';
import Widget from './Widget';

interface WidgetConfig {
  id: string;
  name: string;
  enabled: boolean;
  position?: { x: number, y: number };
}

interface SimpleControlPanelProps {
  showControlPanel: boolean;
}

export const SimpleControlPanel: React.FC<SimpleControlPanelProps> = ({ showControlPanel }) => {
  const [widgets, setWidgets] = useState<WidgetConfig[]>([
    { id: 'speed', name: 'Speed Indicator', enabled: false, position: { x: 100, y: 100 } },
    { id: 'rpm', name: 'RPM Gauge', enabled: false, position: { x: 350, y: 100 } },
    { id: 'lap-time', name: 'Lap Timer', enabled: false, position: { x: 600, y: 100 } }
  ]);

  const toggleWidget = (id: string) => {
    setWidgets(prevWidgets => 
      prevWidgets.map(widget => 
        widget.id === id ? { ...widget, enabled: !widget.enabled } : widget
      )
    );
    console.log(`Toggled widget: ${id}`);
  };

  const closeWidget = (id: string) => {
    setWidgets(prevWidgets => 
      prevWidgets.map(widget => 
        widget.id === id ? { ...widget, enabled: false } : widget
      )
    );
    console.log(`Closed widget: ${id}`);
  };

  const updateWidgetPosition = (id: string, position: { x: number, y: number }) => {
    setWidgets(prevWidgets => 
      prevWidgets.map(widget => 
        widget.id === id ? { ...widget, position } : widget
      )
    );
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
    <>
      {/* Render active widgets (always visible) */}
      {widgets.filter(widget => widget.enabled).map(widget => (
        <Widget 
          key={widget.id}
          id={widget.id}
          name={widget.name}
          initialPosition={widget.position}
          onClose={closeWidget}
        />
      ))}

      {/* Control Panel (conditionally visible) */}
      {showControlPanel && (
        <BaseDraggableComponent initialPosition={{ x: 100, y: 400 }} className="simple-control-panel-wrapper">
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
      )}
    </>
  );
}; 