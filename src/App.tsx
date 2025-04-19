import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import ControlPanel from './components/ControlPanel';
import ClickThroughHint from './components/ClickThroughHint';
import { WebSocketService } from './services/WebSocketService';
import { SimpleTelemetryWidget } from './components/SimpleTelemetryWidget';
import PedalTraceWidget from './components/PedalTraceWidget';
import ShiftIndicatorWidget from './components/ShiftIndicatorWidget';
import TrackMapWidget from './components/TrackMapWidget';
import WidgetRegistry from './widgets/WidgetRegistry';
import { v4 as uuidv4 } from 'uuid';

// Initialize WebSocketService as a global singleton
// This ensures the connection persists regardless of component lifecycle
const globalWebSocketService = WebSocketService.getInstance();

function App() {
  // Track all active widgets
  const [widgets, setWidgets] = useState<any[]>([]);
  
  // Track WebSocket connection status
  const [isConnected, setIsConnected] = useState<boolean>(false);
  
  // Toggle click-through mode state
  const [isClickThrough, setIsClickThrough] = useState(false);
  const clickThroughRef = useRef(false);
  
  // Track control panel visibility
  const [controlPanelHidden, setControlPanelHidden] = useState(false);
  
  // Ensure proper cleanup of WebSocket connections when the app exits
  useEffect(() => {
    // Listen for the beforeunload event to clean up WebSocket connections
    const handleBeforeUnload = () => {
      console.log('App beforeunload event: closing WebSocket connections...');
      // Explicitly close the WebSocketService connection
      globalWebSocketService.close();
    };
    
    // Handle window close events
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Additionally, listen for Electron-specific app quit event if available
    if (window.electronAPI?.on) {
      const removeListener = window.electronAPI.on('app:before-quit', () => {
        console.log('App before-quit event received: closing WebSocket connections...');
        
        // Force all widgets to close their connections
        widgets.forEach(widget => {
          // Dispatch a close event that widget components can listen for
          const closeEvent = new CustomEvent('widget:force-close-connections', { 
            detail: { widgetId: widget.id }
          });
          window.dispatchEvent(closeEvent);
        });
        
        // Explicitly close the main WebSocketService connection
        globalWebSocketService.close();
        
        // Also force any other potential connections to close by dispatching a global event
        const globalCloseEvent = new CustomEvent('app:force-close-connections');
        window.dispatchEvent(globalCloseEvent);
        
        console.log('All WebSocket connections should now be closed');
      });
      
      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
        if (removeListener) removeListener();
      };
    }
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [widgets]);
  
  // Listen for WebSocket connection status changes
  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    const handleConnectionChange = (connected: boolean) => {
      setIsConnected(connected);
      console.log(`WebSocket connection status changed: ${connected ? 'Connected' : 'Disconnected'}`);
    };
    
    webSocketService.addConnectionListener('app', handleConnectionChange);
    
    return () => {
      webSocketService.removeListeners('app');
    };
  }, []);
  
  // Listen for initial state event from main process
  useEffect(() => {
    if (window.electronAPI?.on) {
      console.log('Setting up listener for initial state from main process');
      
      // Add listener for initial state
      const removeListener = window.electronAPI.on('app:initial-state', (state: any) => {
        console.log('Received initial state from main process:', state);
        if (state.clickThrough !== undefined) {
          setIsClickThrough(state.clickThrough);
        }
        if (state.controlPanelHidden !== undefined) {
          setControlPanelHidden(state.controlPanelHidden);
        }
      });
      
      // Clean up listener on unmount
      return () => {
        if (removeListener) removeListener();
      };
    }
  }, []);
  
  // Callback for when SimpleControlPanel adds a widget
  const handleAddWidget = useCallback((newWidget: any) => {
    // Check if this widget already exists (for updates)
    if (newWidget.id) {
      setWidgets(prev => {
        const existingIndex = prev.findIndex(w => w.id === newWidget.id);
        
        // If widget exists, update it
        if (existingIndex >= 0) {
          // If enabled is false, remove the widget
          if (newWidget.enabled === false) {
            return prev.filter(w => w.id !== newWidget.id);
          }
          
          // Otherwise update the widget
          const updatedWidgets = [...prev];
          updatedWidgets[existingIndex] = newWidget;
          return updatedWidgets;
        }
        
        // If it's a new widget, add it
        return [...prev, newWidget];
      });
    } else {
      // If no ID, just add as a new widget
      setWidgets(prev => [...prev, newWidget]);
    }
  }, []);
  
  // Callback for when a widget is closed
  const handleCloseWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(widget => widget.id !== id));
  }, []);
  
  // Toggle control panel visibility
  const toggleControlPanel = useCallback(() => {
    setControlPanelHidden(prev => !prev);
  }, []);
  
  // Track window width for positioning
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  
  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Update the ref when state changes to ensure event handlers have the latest value
  useEffect(() => {
    clickThroughRef.current = isClickThrough;
    
    // Dispatch custom event for other components to know about click-through changes
    const event = new CustomEvent('app:toggle-click-through', { 
      detail: { state: isClickThrough }
    });
    window.dispatchEvent(event);
    
    // Use Electron's native click-through functionality
    if (window.electronAPI) {
      console.log(`Requesting Electron to set click-through to: ${isClickThrough}`);
      
      window.electronAPI.app.toggleClickThrough(isClickThrough)
        .then(response => {
          console.log('Electron response:', response);
        })
        .catch(error => {
          console.error('Error toggling click-through:', error);
        });
    } else {
      console.warn('Electron API not available for click-through toggle');
      
      // Fallback for non-electron environments (browser testing)
      if (isClickThrough) {
        document.body.classList.add('click-through-mode');
      } else {
        document.body.classList.remove('click-through-mode');
      }
    }
    
    console.log(`Click-through state updated: ${isClickThrough}`);
  }, [isClickThrough]);
  
  // Listen for toggle events from main process
  useEffect(() => {
    if (window.electronAPI?.on) {
      console.log('Setting up listener for toggle events from main process');
      
      // Add listener for global shortcut toggling
      const removeListener = window.electronAPI.on('app:toggle-click-through', (newState: boolean) => {
        console.log(`Received toggle event from main process, new state: ${newState}`);
        setIsClickThrough(newState);
      });
      
      // Clean up listener on unmount
      return () => {
        if (removeListener) removeListener();
      };
    }
  }, []);
  
  // Handle key presses to toggle click-through mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Toggle click-through on Ctrl+Space
      if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); // Prevent default space behavior
        setIsClickThrough(prevState => !prevState);
      }
      
      // Quit on Ctrl+Q
      if (e.key === 'q' && (e.ctrlKey || e.metaKey)) {
        if (window.electronAPI) {
          window.electronAPI.app.quit();
        }
      }
    };
    
    // Add keydown listener with capture: true to ensure we get the events
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
    };
  }, []);
  
  // Track if hint has been shown during this session
  const [showHint, setShowHint] = useState(true);  // Start with hint visible
  const [hintShownThisSession, setHintShownThisSession] = useState(false);
  
  // Only show hint the first time click-through is enabled in a session
  useEffect(() => {
    if (isClickThrough) {
      if (!hintShownThisSession) {
        setShowHint(true);
        setHintShownThisSession(true);
      } else {
        setShowHint(false);
      }
    }
  }, [isClickThrough, hintShownThisSession]);
  
  // Add event listener for track map control updates
  useEffect(() => {
    const handleTrackMapControl = (e: any) => {
      if (e.detail && e.detail.widgetId && e.detail.updates) {
        const { widgetId, updates } = e.detail;
        
        // Find the widget and apply the updates
        setWidgets(prev => prev.map(widget => {
          if (widget.id === widgetId && widget.type === 'track-map') {
            return {
              ...widget,
              externalControls: updates
            };
          }
          return widget;
        }));
      }
    };
    
    window.addEventListener('track-map:control', handleTrackMapControl);
    
    return () => {
      window.removeEventListener('track-map:control', handleTrackMapControl);
    };
  }, []);
  
  return (
    <div 
      className={`app-container ${isClickThrough ? 'click-through' : ''}`}
      data-click-through={isClickThrough.toString()}
    >
      {/* Always render the control panel but hide it with CSS when needed */}
      <div style={{ 
        display: (!isClickThrough && !controlPanelHidden) ? 'block' : 'none',
        // Ensure it's actually hidden when display:none is applied
        pointerEvents: (!isClickThrough && !controlPanelHidden) ? 'auto' : 'none'
      }}>
        <ControlPanel 
          initialPosition={{ x: windowWidth - 420, y: 20 }}
          onClickThrough={setIsClickThrough}
          onAddWidget={handleAddWidget}
          activeWidgets={widgets}
          clickThrough={isClickThrough}
        />
      </div>
      
      {/* Widgets are rendered at app level, separate from control panel */}
      {widgets.map(widget => {
        // Get the widget component from registry
        const widgetDef = WidgetRegistry.get(widget.type);
        
        if (widgetDef) {
          // Create widget with component from registry
          const WidgetComponent = widgetDef.component;
          const widgetProps = {
            id: widget.id,
            onClose: () => handleCloseWidget(widget.id),
            ...widget.options,
            ...widget.externalControls
          };
          
          // Add special props for track-map widget
          if (widget.type === 'track-map') {
            widgetProps.onStateChange = (state: any) => {
              // Update widgets for state tracking in the control panel
              const stateEvent = new CustomEvent('track-map:state', {
                detail: { widgetId: widget.id, state }
              });
              window.dispatchEvent(stateEvent);
            };
          }
          
          return (
            <React.Fragment key={widget.id}>
              <WidgetComponent {...widgetProps} />
            </React.Fragment>
          );
        } else if (widget.content) {
          // Fallback for legacy widgets
          return (
            <React.Fragment key={widget.id}>
              {widget.content}
            </React.Fragment>
          );
        }
        
        return null;
      })}
      
      {/* When click-through is enabled, show a small indicator to disable it */}
      {isClickThrough && (
        <>
          <div 
            className="interactive"
            onClick={() => setIsClickThrough(false)}
            onMouseEnter={() => {
              setIsClickThrough(false);
              setShowHint(false);  // Hide hint on first hover
            }}
            style={{
              position: 'fixed',
              top: '10px',
              right: '10px',
              width: '20px',
              height: '20px',
              backgroundColor: 'rgba(255, 50, 50, 0.9)',
              borderRadius: '50%',
              cursor: 'pointer',
              zIndex: 10000,
              boxShadow: '0 0 8px 2px rgba(255, 50, 50, 0.5)',
              border: '2px solid rgba(255, 255, 255, 0.7)'
            }}
          />
          {showHint && (
            <ClickThroughHint onDismiss={() => setShowHint(false)} />
          )}
        </>
      )}
      
      {/* Button to toggle control panel when it's hidden */}
      {!isClickThrough && controlPanelHidden && (
        <div 
          className="interactive"
          onClick={toggleControlPanel}
          style={{
            position: 'fixed',
            top: '10px',
            right: '10px',
            width: '24px',
            height: '24px',
            backgroundColor: 'rgba(50, 50, 255, 0.9)',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 10000,
            boxShadow: '0 0 8px 2px rgba(50, 50, 255, 0.5)',
            border: '2px solid rgba(255, 255, 255, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px'
          }}
        >
          CP
        </div>
      )}
    </div>
  );
}

export default App;
