import React, { useEffect, useState } from 'react';
import './App.css';
import { WidgetManagerProvider } from './widgets/WidgetManager';
import { ControlPanel } from './components/ControlPanel';
import { WidgetContainer } from './widgets/WidgetContainer';
import { WebSocketProvider } from './services/WebSocketContext';

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
  
  // Widget windows don't need WebSocketProvider - they use IPC
  if (isWidgetMode) {
    return (
      <WidgetManagerProvider>
        <div className="min-h-screen bg-transparent">
          <WidgetContainer />
        </div>
      </WidgetManagerProvider>
    );
  }
  
  // Main window with WebSocketProvider
  return (
    <WebSocketProvider>
      <WidgetManagerProvider>
        <div className="min-h-screen bg-gray-200 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">Widget Dashboard</h1>
            <ControlPanel />
          </div>
        </div>
      </WidgetManagerProvider>
    </WebSocketProvider>
  );
}

export default App;
