import React, { useEffect, useState } from 'react';
import './App.css';
import { WidgetManagerProvider } from './widgets/WidgetManager';
import { ControlPanel } from './components/ControlPanel';
import { WidgetContainer } from './widgets/WidgetContainer';

function App() {
  // Check if we're in widget mode based on URL hash
  const [isWidgetMode, setIsWidgetMode] = useState(false);
  
  useEffect(() => {
    const checkWidgetMode = () => {
      const isWidget = window.location.hash === '#/widget' || 
                       new URLSearchParams(window.location.search).has('widgetId');
      setIsWidgetMode(isWidget);
      
      console.log('App mode check:', { 
        hash: window.location.hash,
        search: window.location.search,
        isWidget
      });
    };
    
    // Check on initial load
    checkWidgetMode();
    
    // Listen for hash changes
    window.addEventListener('hashchange', checkWidgetMode);
    
    // Cleanup
    return () => {
      window.removeEventListener('hashchange', checkWidgetMode);
    };
  }, []);
  
  return (
    <WidgetManagerProvider>
      {isWidgetMode ? (
        // Widget mode - show just the widget container
        <div className="min-h-screen bg-transparent">
          <WidgetContainer />
        </div>
      ) : (
        // Main control panel mode with explicit scrolling enabled
        <div className="min-h-screen bg-gray-200 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Widget Dashboard</h1>
            <ControlPanel />
          </div>
        </div>
      )}
    </WidgetManagerProvider>
  );
}

export default App;
