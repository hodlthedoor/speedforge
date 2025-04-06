import React, { useState, useEffect, useCallback, ReactNode } from 'react';
import { WidgetProps } from '../types/widget';

interface BaseWidgetComponentProps extends WidgetProps {
  title?: string;
  className?: string;
  children?: ReactNode;
  showControls?: boolean;
}

const BaseWidgetComponent: React.FC<BaseWidgetComponentProps> = ({
  id,
  title,
  width,
  height,
  opacity = 1,
  visible = true,
  alwaysOnTop = false,
  params = {},
  className = '',
  children,
  showControls = true,
  onClose,
  onOpacityChange,
  onVisibilityChange,
  onAlwaysOnTopChange,
  onParamsUpdate
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Effect to handle escape key for closing settings
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showSettings) {
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showSettings]);

  // Visibility toggle
  const toggleVisibility = useCallback(() => {
    onVisibilityChange?.(!visible);
  }, [visible, onVisibilityChange]);

  // Always on top toggle
  const toggleAlwaysOnTop = useCallback(() => {
    onAlwaysOnTopChange?.(!alwaysOnTop);
  }, [alwaysOnTop, onAlwaysOnTopChange]);

  // Opacity change handler
  const handleOpacityChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseFloat(e.target.value);
    onOpacityChange?.(newOpacity);
  }, [onOpacityChange]);

  // Close handler
  const handleClose = useCallback(() => {
    onClose?.();
  }, [onClose]);

  if (!visible) return null;

  return (
    <div
      className={`widget bg-gray-800 text-white rounded-lg shadow-lg ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ 
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}
    >
      {/* Widget header */}
      <div className="widget-header p-2 flex justify-between items-center bg-gray-900">
        <h3 className="text-sm font-medium truncate">{title || `Widget ${id}`}</h3>
        
        {showControls && (isHovered || showSettings) && (
          <div className="widget-controls flex space-x-1">
            <button
              className="settings-btn bg-gray-700 hover:bg-gray-600 text-white rounded p-1"
              title="Settings"
              onClick={() => setShowSettings(!showSettings)}
            >
              ⚙️
            </button>
            <button
              className="close-btn bg-red-500 hover:bg-red-700 text-white rounded p-1"
              title="Close"
              onClick={handleClose}
            >
              ✕
            </button>
          </div>
        )}
      </div>
      
      {/* Settings panel */}
      {showSettings && (
        <div className="widget-settings p-2 bg-gray-700">
          <div className="setting-row flex justify-between items-center mb-2">
            <label htmlFor={`opacity-${id}`} className="text-xs">Opacity:</label>
            <input
              id={`opacity-${id}`}
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={opacity}
              onChange={handleOpacityChange}
              className="w-32"
            />
          </div>
          
          <div className="setting-row flex justify-between items-center mb-2">
            <label htmlFor={`alwaysOnTop-${id}`} className="text-xs">Always on top:</label>
            <input
              id={`alwaysOnTop-${id}`}
              type="checkbox"
              checked={alwaysOnTop}
              onChange={toggleAlwaysOnTop}
            />
          </div>
        </div>
      )}
      
      {/* Widget content */}
      <div className="widget-content flex-1 overflow-auto p-2">
        {children}
      </div>
    </div>
  );
};

export default BaseWidgetComponent; 