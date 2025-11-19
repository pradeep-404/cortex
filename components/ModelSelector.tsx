import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Zap, Brain, Globe } from 'lucide-react';
import { ModelId, ModelConfig } from '../types';

export const MODELS: Record<ModelId, ModelConfig> = {
  flash: {
    id: 'flash',
    name: 'Flash',
    description: 'Fast & efficient',
    apiModel: 'gemini-2.5-flash',
  },
  reasoning: {
    id: 'reasoning',
    name: 'Reasoning',
    description: 'High intelligence',
    apiModel: 'gemini-3-pro-preview',
  },
  research: {
    id: 'research',
    name: 'Research',
    description: 'Web grounded',
    apiModel: 'gemini-2.5-flash',
    useGrounding: true
  }
};

interface ModelSelectorProps {
  currentModelId: ModelId;
  onSelect: (id: ModelId) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ currentModelId, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (id: ModelId) => {
    switch (id) {
      case 'flash': return <Zap size={16} className="text-yellow-400" />;
      case 'reasoning': return <Brain size={16} className="text-purple-400" />;
      case 'research': return <Globe size={16} className="text-blue-400" />;
    }
  };

  const currentModel = MODELS[currentModelId];

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-cortex-surface transition-colors text-cortex-text text-sm font-medium"
      >
        {getIcon(currentModelId)}
        <span>{currentModel.name}</span>
        <ChevronDown size={14} className={`text-cortex-subtext transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-56 bg-cortex-surfaceAlt border border-cortex-border rounded-xl shadow-xl overflow-hidden z-50 animate-fade-in">
          <div className="p-1">
            {Object.values(MODELS).map((model) => (
              <button
                key={model.id}
                onClick={() => {
                  onSelect(model.id as ModelId);
                  setIsOpen(false);
                }}
                className={`w-full flex items-start gap-3 p-2 rounded-lg transition-colors text-left ${
                  currentModelId === model.id 
                    ? 'bg-cortex-surface' 
                    : 'hover:bg-cortex-surface/50'
                }`}
              >
                <div className="mt-0.5">{getIcon(model.id as ModelId)}</div>
                <div>
                  <div className={`text-sm font-medium ${currentModelId === model.id ? 'text-cortex-text' : 'text-cortex-text/80'}`}>
                    {model.name}
                  </div>
                  <div className="text-xs text-cortex-subtext">
                    {model.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};