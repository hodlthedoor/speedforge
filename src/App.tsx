import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import SimpleControlPanel from './components/SimpleControlPanel';
import { WebSocketService } from './services/WebSocketService';

interface ClickIndicator {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

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
    setWidgets(prev => [...prev, newWidget]);
  }, []);
  
  // Callback for when a widget is closed
  const handleCloseWidget = useCallback((id: string) => {
    setWidgets(prev => prev.filter(widget => widget.id !== id));
  }, []);
  
  // Start with click-through disabled for debugging
  const [isClickThrough, setIsClickThrough] = useState(false);
  const clickThroughRef = useRef(false);
  const [clickIndicators, setClickIndicators] = useState<ClickIndicator[]>([]);
  const [clickCount, setClickCount] = useState(0);
  const [debugInfo, setDebugInfo] = useState({
    timestamp: new Date().toISOString(),
    platform: window.electronAPI?.platform || 'unknown',
    lastClick: 'None',
    clickCount: 0,
    clickThroughState: 'OFF',
    lastToggle: 'None',
    electronResponse: 'None'
  });
  
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
          console.log('Electron response raw:', response);
          
          // Add additional logging to debug JSON issues
          try {
            // Check if response is already a parsed object
            const isObject = typeof response === 'object' && response !== null;
            console.log('Response type:', typeof response, isObject ? '(object)' : '(not object)');
            
            if (!isObject) {
              // If it's a string, try to parse it
              console.log('Response as string:', String(response));
              
              // Try parsing in case it's a JSON string
              try {
                const parsedResponse = JSON.parse(String(response));
                console.log('Parsed response:', parsedResponse);
                response = parsedResponse;
              } catch (parseError) {
                console.error('Failed to parse response as JSON:', parseError);
                throw new Error(`Invalid response format: ${String(response).substring(0, 100)}...`);
              }
            }
            
            // Update debug info with the response
            setDebugInfo(prev => ({
              ...prev,
              electronResponse: JSON.stringify(response, null, 2),
              clickThroughState: response.success ? (response.state ? 'ON' : 'OFF') : 'ERROR'
            }));
          } catch (error) {
            console.error('Error processing response:', error);
            setDebugInfo(prev => ({
              ...prev,
              electronResponse: `Error processing: ${String(error)}`,
              clickThroughState: 'ERROR'
            }));
          }
        })
        .catch(error => {
          console.error('Error toggling click-through:', error);
          console.error('Error details:', error.message, error.stack);
          
          setDebugInfo(prev => ({
            ...prev,
            electronResponse: `Error: ${error.message || String(error)}`,
            clickThroughState: 'ERROR'
          }));
        });
    } else {
      console.warn('Electron API not available for click-through toggle');
      
      // Fallback for non-electron environments (browser testing)
      setDebugInfo(prev => ({
        ...prev,
        clickThroughState: isClickThrough ? 'ON (CSS only)' : 'OFF (CSS only)',
        electronResponse: 'Electron API not available'
      }));
      
      // Apply the class as a CSS fallback for browser testing
      if (isClickThrough) {
        document.body.classList.add('click-through-mode');
      } else {
        document.body.classList.remove('click-through-mode');
      }
    }
    
    console.log(`Click-through state updated: ${isClickThrough}`);
  }, [isClickThrough]);
  
  // Update debug info periodically
  useEffect(() => {
    const timer = setInterval(() => {
      setDebugInfo(prev => ({
        ...prev,
        timestamp: new Date().toISOString()
      }));
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Handle clicks to show visual indicators
  const handleWindowClick = useCallback((e: MouseEvent) => {
    const newIndicator = {
      id: Date.now(),
      x: e.clientX,
      y: e.clientY,
      timestamp: Date.now()
    };
    
    // Add the new indicator to the array
    setClickIndicators(prev => [...prev, newIndicator]);
    
    // Increment click count
    setClickCount(prev => prev + 1);
    
    // Update debug info
    setDebugInfo(prev => ({
      ...prev,
      lastClick: `X: ${e.clientX}, Y: ${e.clientY}`,
      clickCount: prev.clickCount + 1
    }));
    
    // Log to console
    console.log(`Click #${clickCount + 1} detected at X: ${e.clientX}, Y: ${e.clientY}, click-through mode: ${clickThroughRef.current}`);
  }, [clickCount]);
  
  // Remove indicators after they fade out
  useEffect(() => {
    if (clickIndicators.length === 0) return;
    
    const timeout = setTimeout(() => {
      // Remove indicators older than 2 seconds (increased for visibility)
      const now = Date.now();
      setClickIndicators(prev => 
        prev.filter(indicator => now - indicator.timestamp < 2000)
      );
    }, 2000);
    
    return () => clearTimeout(timeout);
  }, [clickIndicators]);
  
  // Set up click listener
  useEffect(() => {
    window.addEventListener('click', handleWindowClick, { capture: true });
    return () => window.removeEventListener('click', handleWindowClick, { capture: true });
  }, [handleWindowClick]);
  
  // Listen for toggle events from main process
  useEffect(() => {
    if (window.electronAPI?.on) {
      console.log('Setting up listener for toggle events from main process');
      
      // Add listener for global shortcut toggling
      const removeListener = window.electronAPI.on('app:toggle-click-through', (newState: boolean) => {
        console.log(`Received toggle event from main process, new state: ${newState}`);
        setIsClickThrough(newState);
        
        // Update debug info
        setDebugInfo(prev => ({
          ...prev,
          lastToggle: new Date().toISOString() + ' (global shortcut)'
        }));
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
      console.log(`Key pressed: ${e.key}, metaKey: ${e.metaKey}, ctrlKey: ${e.ctrlKey}`);
      
      // Toggle click-through on Ctrl+Space
      if (e.key === ' ' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); // Prevent default space behavior
        
        // Use the ref for the current value
        const newState = !clickThroughRef.current;
        console.log(`Toggling click-through from ${clickThroughRef.current} to ${newState} (via Ctrl+Space)`);
        
        // Update state using the ref value to ensure we're toggling correctly
        setIsClickThrough(prevState => !prevState);
        
        // Update debug info for toggling
        setDebugInfo(prev => ({
          ...prev,
          lastToggle: new Date().toISOString() + ' (Ctrl+Space)'
        }));
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
  }, []); // Dependencies array is empty to avoid recreating the handler
  
  // Toggle click-through with a button for testing as an alternative to ESC key
  const toggleClickThrough = useCallback(() => {
    const newState = !isClickThrough;
    console.log(`Manual toggle click-through from ${isClickThrough} to ${newState} (via button)`);
    
    setIsClickThrough(newState);
    
    // Update debug info for toggling
    setDebugInfo(prev => ({
      ...prev,
      lastToggle: new Date().toISOString() + ' (button)'
    }));
  }, [isClickThrough]);
  
  return (
    <div 
      className={`app-container ${isClickThrough ? 'click-through' : ''}`}
      data-click-through={isClickThrough.toString()}
    >
      {/* Click indicators */}
      {clickIndicators.map(indicator => (
        <div 
          key={indicator.id}
          className="click-indicator"
          style={{ 
            left: `${indicator.x}px`, 
            top: `${indicator.y}px` 
          }}
        />
      ))}
      
      {/* When click-through is enabled, hide control panel completely */}
      {!isClickThrough ? (
        <SimpleControlPanel 
          initialPosition={{ x: 20, y: 20 }}
          onClickThrough={setIsClickThrough}
          onAddWidget={handleAddWidget}
        />
      ) : null}
      
      {/* Widgets are rendered at app level, separate from control panel */}
      {widgets.map(widget => (
        <React.Fragment key={widget.id}>
          {widget.content}
        </React.Fragment>
      ))}
      
      {/* When click-through is enabled, show a small indicator to disable it */}
      {isClickThrough && (
        <div 
          className="click-through-toggle"
          onClick={() => setIsClickThrough(false)}
          onMouseEnter={() => setIsClickThrough(false)}
          style={{
            position: 'fixed',
            top: '10px',
            left: '10px',
            width: '15px',
            height: '15px',
            backgroundColor: 'rgba(255, 100, 100, 0.7)',
            borderRadius: '50%',
            cursor: 'pointer',
            zIndex: 10000,
            boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
          }}
        />
      )}
    </div>
  );
}

export default App;
