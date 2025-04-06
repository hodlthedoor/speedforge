import React, { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';

interface ClickIndicator {
  id: number;
  x: number;
  y: number;
  timestamp: number;
}

function App() {
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
    
    // Use Electron's native click-through functionality
    if (window.electronAPI) {
      console.log(`Requesting Electron to set click-through to: ${isClickThrough}`);
      
      window.electronAPI.app.toggleClickThrough(isClickThrough)
        .then(response => {
          console.log('Electron response:', response);
          
          // Update debug info with the response
          setDebugInfo(prev => ({
            ...prev,
            electronResponse: JSON.stringify(response),
            clickThroughState: response.success ? (response.state ? 'ON' : 'OFF') : 'ERROR'
          }));
        })
        .catch(error => {
          console.error('Error toggling click-through:', error);
          
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
  
  // Handle key presses to toggle click-through mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      console.log(`Key pressed: ${e.key}, metaKey: ${e.metaKey}, ctrlKey: ${e.ctrlKey}`);
      
      // Toggle click-through on Escape key
      if (e.key === 'Escape') {
        e.preventDefault(); // Prevent default Escape behavior
        
        // Use the ref for the current value
        const newState = !clickThroughRef.current;
        console.log(`Toggling click-through from ${clickThroughRef.current} to ${newState} (via ESC key)`);
        
        // Update state
        setIsClickThrough(newState);
        
        // Update debug info for toggling
        setDebugInfo(prev => ({
          ...prev,
          lastToggle: new Date().toISOString() + ' (ESC key)'
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
  }, []); // Remove isClickThrough dependency to avoid recreating the handler
  
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
      {/* Always show click status and toggle button */}
      <div className="click-status">
        Click-through is: {isClickThrough ? 'ON' : 'OFF'}
        <button 
          onClick={toggleClickThrough}
          className="toggle-button"
        >
          Toggle
        </button>
      </div>
      
      {/* Render click indicators */}
      {clickIndicators.map(indicator => (
        <div 
          key={indicator.id}
          className="click-indicator"
          style={{
            left: indicator.x,
            top: indicator.y,
          }}
        />
      ))}
      
      {/* Debug panel */}
      <div className="debug-container">
        <div className="debug-panel">
          <div className="debug-info">
            Platform: {debugInfo.platform}<br />
            Time: {debugInfo.timestamp}<br />
            Last Click: {debugInfo.lastClick}<br />
            Click-Through: {debugInfo.clickThroughState}<br />
            Last Toggle: {debugInfo.lastToggle}<br />
            Total Clicks: {debugInfo.clickCount}<br />
            Electron Response: {debugInfo.electronResponse}
          </div>
          <button 
            onClick={() => {
              if (window.electronAPI) {
                window.electronAPI.app.quit();
              }
            }}
            className="quit-button"
          >
            Quit
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
