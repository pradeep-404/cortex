import React from 'react';
import { Brain } from 'lucide-react';

export const TypingIndicator: React.FC = () => {
  return (
    <div className="flex w-full justify-start mb-6 animate-fade-in">
      <div className="flex gap-4 max-w-[80%]">
        <div className="flex-shrink-0 h-8 w-8 mt-1 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white">
          <Brain size={18} />
        </div>
        <div className="flex items-center gap-1 pt-2">
           <span className="text-sm text-cortex-subtext animate-pulse">Thinking...</span>
        </div>
      </div>
    </div>
  );
};