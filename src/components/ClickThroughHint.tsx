import React from 'react';

interface ClickThroughHintProps {
  onDismiss: () => void;
}

const ClickThroughHint: React.FC<ClickThroughHintProps> = ({ onDismiss }) => {
  return (
    <div className="fixed top-2 right-10 z-[10001] animate-fade-in">
      <div className="relative">
        {/* Speech bubble */}
        <div className="bg-black/90 text-white px-4 py-2.5 rounded-lg shadow-lg">
          <p className="text-sm whitespace-nowrap font-medium">
            Hover over this red dot or press{' '}
            <span className="inline-flex items-center bg-white/10 px-1.5 py-0.5 rounded text-xs font-mono">
              ⌘+Space
            </span>
          </p>
        </div>
        {/* Speech bubble pointer */}
        <div 
          className="absolute -right-1.5 top-2.5 w-3 h-3 transform rotate-45 bg-black/90"
        />
      </div>
    </div>
  );
};

export default ClickThroughHint; 