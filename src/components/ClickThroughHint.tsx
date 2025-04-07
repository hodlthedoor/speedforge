import React from 'react';

interface ClickThroughHintProps {
  onDismiss: () => void;
}

const ClickThroughHint: React.FC<ClickThroughHintProps> = ({ onDismiss }) => {
  return (
    <div className="fixed top-3 right-12 z-[10001] animate-fade-in">
      <div className="relative">
        {/* Speech bubble */}
        <div className="bg-black/80 text-white px-6 py-4 rounded-2xl shadow-lg max-w-xs">
          <p className="text-base font-medium leading-snug">
            Hover over this red dot or press <span className="font-mono bg-gray-800/70 px-2 py-0.5 rounded text-sm">⌘+Space</span> to show controls
          </p>
        </div>
        {/* Speech bubble pointer - positioned to point at the red dot */}
        <div 
          className="absolute -left-2 top-4 w-4 h-4 transform rotate-45 bg-black/80"
          style={{
            clipPath: 'polygon(0% 0%, 100% 100%, 0% 100%)',
            marginTop: '2px'
          }}
        />
      </div>
    </div>
  );
};

export default ClickThroughHint; 