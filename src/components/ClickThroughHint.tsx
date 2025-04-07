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
    <div className="fixed top-16 right-4 z-[10001] animate-fade-in">
      <div className="relative">
        {/* Speech bubble */}
        <div className="bg-black/70 text-white p-4 rounded-lg shadow-lg max-w-xs">
          <p className="text-sm">
            Hover over the red dot or press <span className="font-mono bg-gray-800/50 px-1 rounded">⌘+Space</span> to show controls
          </p>
        </div>
        {/* Speech bubble pointer */}
        <div className="absolute -bottom-2 right-2 w-4 h-4 transform rotate-45 bg-black/70" />
      </div>
    </div>
  );
};

export default ClickThroughHint; 