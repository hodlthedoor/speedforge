import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import SimpleControlPanel from './components/SimpleControlPanel';
import ClickThroughHint from './components/ClickThroughHint';
import { WebSocketService } from './services/WebSocketService';
import { SimpleTelemetryWidget } from './components/SimpleTelemetryWidget';
import PedalTraceWidget from './components/PedalTraceWidget';
import ShiftIndicatorWidget from './components/ShiftIndicatorWidget';
import TrackMapWidget from './components/TrackMapWidget';
import WidgetRegistry from './widgets/WidgetRegistry';
import { v4 as uuidv4 } from 'uuid';

function App() {
  // Initialize WebSocketService
  useEffect(() => {
    const webSocketService = WebSocketService.getInstance();
    console.log('WebSocketService initialized in App component');
    
    // Cleanup when component unmounts
    return () => {
      console.log('Closing WebSocketService connection');
      webSocketService.close();
    };
  }, []);
  
  // Track all active widgets
  const [widgets, setWidgets] = useState<any[]>([]);
  
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
  
  // Toggle click-through mode state
  const [isClickThrough, setIsClickThrough] = useState(false);
  const clickThroughRef = useRef(false);
  
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
  
  // Track if hint has been shown
  const [showHint, setShowHint] = useState(true);  // Start with hint visible
  
  // Reset hint visibility when click-through is enabled
  useEffect(() => {
    if (isClickThrough) {
      setShowHint(true);
    }
  }, [isClickThrough]);
  
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
      {/* When click-through is enabled, hide control panel completely */}
      {!isClickThrough ? (
        <SimpleControlPanel 
          initialPosition={{ x: windowWidth - 420, y: 20 }}
          onClickThrough={setIsClickThrough}
          onAddWidget={handleAddWidget}
          activeWidgets={widgets}
        />
      ) : null}
      
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
    </div>
  );
}

export default App;
