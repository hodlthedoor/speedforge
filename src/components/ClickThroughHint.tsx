import React, { useEffect, useState } from 'react';

interface ClickThroughHintProps {
  onDismiss: () => void;
}

const ClickThroughHint: React.FC<ClickThroughHintProps> = ({ onDismiss }) => {
  const [isVisible, setIsVisible] = useState(true);

  // Auto-dismiss after 10 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onDismiss();
    }, 10000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!isVisible) return null;

  return (
    <div 
      className="fixed top-16 right-4 z-[10001] animate-fade-in"
      style={{
        position: 'fixed',
        top: '64px', // 16 * 4 = 64px
        right: '16px', // 4 * 4 = 16px
        zIndex: 10001
      }}
    >
      <div className="relative">
        {/* Speech bubble */}
        <div 
          className="bg-black/70 text-white p-4 rounded-lg shadow-lg max-w-xs"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            padding: '1rem',
            borderRadius: '0.5rem',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
            maxWidth: '20rem'
          }}
        >
          <p className="text-sm" style={{ fontSize: '0.875rem' }}>
            Hover over the red dot or press <span className="font-mono bg-gray-800/50 px-1 rounded" style={{ fontFamily: 'monospace', backgroundColor: 'rgba(31, 41, 55, 0.5)', padding: '0 0.25rem', borderRadius: '0.25rem' }}>⌘+Space</span> to show controls
          </p>
        </div>
        {/* Speech bubble pointer */}
        <div 
          className="absolute -bottom-2 right-2 w-4 h-4 transform rotate-45 bg-black/70"
          style={{
            position: 'absolute',
            bottom: '-0.5rem',
            right: '0.5rem',
            width: '1rem',
            height: '1rem',
            transform: 'rotate(45deg)',
            backgroundColor: 'rgba(0, 0, 0, 0.7)'
          }}
        />
      </div>
    </div>
  );
};

export default ClickThroughHint; 