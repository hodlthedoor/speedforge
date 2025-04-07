import React from 'react';

interface ClickThroughHintProps {
  onDismiss: () => void;
}

const ClickThroughHint: React.FC<ClickThroughHintProps> = ({ onDismiss }) => {
  return (
    <div className="fixed top-2 right-10 z-[10001] animate-fade-in">
      <div className="relative">
        {/* Speech bubble */}
        <div className="bg-black/90 text-white p-8 rounded-xl shadow-lg max-w-[380px]">
          <div className="m-6">
            <p className="text-xl leading-relaxed">
              Hover over this red dot to show the control panel
            </p>
            <p className="text-lg mt-8 text-gray-300">
              Or press <span className="inline-flex items-center bg-white/10 px-2.5 py-1 rounded text-lg font-mono">⌘+Space</span>
            </p>
          </div>
        </div>
        {/* Speech bubble pointer */}
        <div 
          className="absolute -right-2 top-10 w-4 h-4 transform rotate-45 bg-black/90"
        />
      </div>
    </div>
  );
};

export default ClickThroughHint; 