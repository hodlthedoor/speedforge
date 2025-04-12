import React, { useState, useEffect, useRef } from 'react';
import Widget from './Widget';

interface SpotterWidgetProps {
  id: string;
  onClose?: () => void;
}

// Define trigger conditions for automatic TTS
type TriggerCondition = 'manual' | 'interval' | 'telemetry' | 'threshold';

interface TriggerConfig {
  condition: TriggerCondition;
  interval?: number; // in ms, for interval
  telemetryKey?: string; // for telemetry-based triggers
  threshold?: number; // for threshold-based triggers
  comparison?: 'gt' | 'lt' | 'eq' | 'change'; // greater than, less than, equal, any change
  lastValue?: any; // to track changes
  lastTriggered?: number; // timestamp of last trigger
  cooldown?: number; // minimum time between triggers in ms
}

interface SpotterWidgetState {
  text: string;
  phrases: { id: string, text: string, enabled: boolean, trigger: TriggerConfig }[];
  rate: number;
  pitch: number;
  volume: number;
  selectedVoice: string;
  availableVoices: SpeechSynthesisVoice[];
  speaking: boolean;
  autoMode: boolean;
  telemetryData: Record<string, any>; // Store latest telemetry data
}

const SpotterWidget: React.FC<SpotterWidgetProps> = ({ id, onClose }) => {
  const [state, setState] = useState<SpotterWidgetState>({
    text: 'Hello, this is Speedforge spotter',
    phrases: [
      { 
        id: '1', 
        text: 'Current speed: {speed} kilometers per hour', 
        enabled: true,
        trigger: { 
          condition: 'interval',
          interval: 10000, // Every 10 seconds
          lastTriggered: 0,
          cooldown: 5000 // At least 5 seconds between announcements
        }
      },
      { 
        id: '2', 
        text: 'Warning: low fuel', 
        enabled: true,
        trigger: { 
          condition: 'threshold',
          telemetryKey: 'fuel',
          threshold: 10,
          comparison: 'lt',
          cooldown: 30000 // Only announce every 30 seconds
        }
      },
      { 
        id: '3', 
        text: 'Car on your left', 
        enabled: true,
        trigger: { 
          condition: 'telemetry',
          telemetryKey: 'carLeft',
          comparison: 'change',
          lastValue: false,
          cooldown: 3000
        }
      }
    ],
    rate: 1,
    pitch: 1,
    volume: 1,
    selectedVoice: '',
    availableVoices: [],
    speaking: false,
    autoMode: false,
    telemetryData: {
      speed: 0,
      rpm: 0,
      gear: 0,
      fuel: 100,
      lap: 1,
      position: 1,
      carLeft: false,
      carRight: false
    }
  });
  
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  const timerId = useRef<number | null>(null);

  // Initialize speech synthesis
  useEffect(() => {
    // Load available voices
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (isMounted.current) {
        setState(prev => ({ 
          ...prev, 
          availableVoices: voices,
          // Select a default voice if one is available
          selectedVoice: voices.length > 0 ? voices[0].name : ''
        }));
      }
    };
    
    // Chrome loads voices asynchronously
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    // Initial voice loading
    loadVoices();
    
    // Setup listener for telemetry updates if window.electronAPI exists
    let unsubscribe: (() => void) | undefined;
    if (window.electronAPI) {
      unsubscribe = window.electronAPI.on('telemetry:update', (telemetryData: any) => {
        if (isMounted.current) {
          setState(prev => ({ ...prev, telemetryData }));
        }
      });
    }
    
    // Return cleanup function
    return () => {
      isMounted.current = false;
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      if (unsubscribe) {
        unsubscribe();
      }
      if (timerId.current) {
        window.clearInterval(timerId.current);
      }
    };
  }, []);

  // Setup auto-trigger checker
  useEffect(() => {
    if (state.autoMode && !timerId.current) {
      // Start checking triggers every second
      timerId.current = window.setInterval(() => {
        checkTriggers();
      }, 1000);
    } else if (!state.autoMode && timerId.current) {
      // Clear interval when auto mode is turned off
      window.clearInterval(timerId.current);
      timerId.current = null;
    }
    
    return () => {
      if (timerId.current) {
        window.clearInterval(timerId.current);
        timerId.current = null;
      }
    };
  }, [state.autoMode, state.phrases, state.telemetryData]);

  // Check all phrases for trigger conditions
  const checkTriggers = () => {
    const now = Date.now();
    let shouldSpeak = false;
    let textToSpeak = '';
    
    // Check each phrase
    for (const phrase of state.phrases) {
      if (!phrase.enabled) continue;
      
      const trigger = phrase.trigger;
      const lastTriggered = trigger.lastTriggered || 0;
      const cooldown = trigger.cooldown || 0;
      
      // Skip if in cooldown period
      if (now - lastTriggered < cooldown) continue;
      
      // Check trigger conditions
      let triggered = false;
      
      switch (trigger.condition) {
        case 'interval':
          if (trigger.interval && (now - lastTriggered >= trigger.interval)) {
            triggered = true;
          }
          break;
          
        case 'threshold':
          if (trigger.telemetryKey && trigger.comparison && trigger.threshold !== undefined) {
            const value = state.telemetryData[trigger.telemetryKey];
            
            if (trigger.comparison === 'gt' && value > trigger.threshold) {
              triggered = true;
            } else if (trigger.comparison === 'lt' && value < trigger.threshold) {
              triggered = true;
            } else if (trigger.comparison === 'eq' && value === trigger.threshold) {
              triggered = true;
            }
          }
          break;
          
        case 'telemetry':
          if (trigger.telemetryKey && trigger.comparison === 'change') {
            const currentValue = state.telemetryData[trigger.telemetryKey];
            const lastValue = trigger.lastValue;
            
            if (currentValue !== lastValue) {
              // Only trigger if the change is meaningful (e.g., false to true for boolean values)
              if (typeof currentValue === 'boolean' && currentValue === true) {
                triggered = true;
              } else if (typeof currentValue === 'number' && typeof lastValue === 'number') {
                // For numeric values, trigger if significant change
                const percentChange = Math.abs((currentValue - lastValue) / lastValue) * 100;
                if (percentChange > 10) { // 10% change threshold
                  triggered = true;
                }
              }
              
              // Update the last value
              setState(prev => {
                const updatedPhrases = prev.phrases.map(p => {
                  if (p.id === phrase.id) {
                    return {
                      ...p,
                      trigger: {
                        ...p.trigger,
                        lastValue: currentValue
                      }
                    };
                  }
                  return p;
                });
                
                return { ...prev, phrases: updatedPhrases };
              });
            }
          }
          break;
          
        default:
          break;
      }
      
      if (triggered) {
        // Update the last triggered time
        setState(prev => {
          const updatedPhrases = prev.phrases.map(p => {
            if (p.id === phrase.id) {
              return {
                ...p,
                trigger: {
                  ...p.trigger,
                  lastTriggered: now
                }
              };
            }
            return p;
          });
          
          return { ...prev, phrases: updatedPhrases };
        });
        
        // Process the phrase text by replacing placeholders with actual telemetry values
        const processedText = processText(phrase.text);
        textToSpeak = processedText;
        shouldSpeak = true;
        break; // Only speak one phrase at a time
      }
    }
    
    if (shouldSpeak && textToSpeak) {
      speakText(textToSpeak);
    }
  };

  // Process text to replace placeholders with telemetry data
  const processText = (text: string): string => {
    return text.replace(/{([^}]+)}/g, (match, key) => {
      const value = state.telemetryData[key];
      
      if (value === undefined) {
        return match; // Keep original placeholder if key not found
      }
      
      // Format value based on type
      if (typeof value === 'number') {
        // Fix: Check if it's an integer by using Number.isInteger
        return value.toFixed(Number.isInteger(value) ? 0 : 1);
      }
      
      return String(value);
    });
  };

  // Handle text update
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState(prev => ({ ...prev, text: e.target.value }));
  };

  // Handle rate change
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    setState(prev => ({ ...prev, rate }));
  };

  // Handle pitch change
  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pitch = parseFloat(e.target.value);
    setState(prev => ({ ...prev, pitch }));
  };

  // Handle volume change
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const volume = parseFloat(e.target.value);
    setState(prev => ({ ...prev, volume }));
  };

  // Handle voice selection
  const handleVoiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState(prev => ({ ...prev, selectedVoice: e.target.value }));
  };

  // Toggle auto mode
  const toggleAutoMode = () => {
    setState(prev => ({ ...prev, autoMode: !prev.autoMode }));
  };

  // Speak the current text
  const speak = () => {
    speakText(state.text);
  };

  // Speak specific text using the native Web Speech API
  const speakText = (text: string) => {
    if (!text || !window.speechSynthesis) return;
    
    // Cancel any ongoing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }
    
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Apply voice settings
    utterance.rate = state.rate;
    utterance.pitch = state.pitch;
    utterance.volume = state.volume;
    
    // Set the selected voice
    if (state.selectedVoice) {
      const voice = state.availableVoices.find(v => v.name === state.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }
    
    // Set speaking state
    setState(prev => ({ ...prev, speaking: true }));
    
    // Add event handlers
    utterance.onend = () => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, speaking: false }));
      }
    };
    
    utterance.onerror = () => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, speaking: false }));
      }
    };
    
    // Speak
    window.speechSynthesis.speak(utterance);
  };

  // Stop speaking
  const stop = () => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    setState(prev => ({ ...prev, speaking: false }));
  };

  // Add a new phrase
  const addPhrase = () => {
    const newId = Date.now().toString();
    setState(prev => ({
      ...prev,
      phrases: [
        ...prev.phrases,
        {
          id: newId,
          text: 'New phrase',
          enabled: true,
          trigger: {
            condition: 'manual'
          }
        }
      ]
    }));
  };

  // Update phrase text
  const updatePhraseText = (id: string, text: string) => {
    setState(prev => ({
      ...prev,
      phrases: prev.phrases.map(phrase => 
        phrase.id === id ? { ...phrase, text } : phrase
      )
    }));
  };

  // Toggle phrase enabled state
  const togglePhraseEnabled = (id: string) => {
    setState(prev => ({
      ...prev,
      phrases: prev.phrases.map(phrase => 
        phrase.id === id ? { ...phrase, enabled: !phrase.enabled } : phrase
      )
    }));
  };

  // Delete a phrase
  const deletePhrase = (id: string) => {
    setState(prev => ({
      ...prev,
      phrases: prev.phrases.filter(phrase => phrase.id !== id)
    }));
  };

  // Test a specific phrase
  const testPhrase = (id: string) => {
    const phrase = state.phrases.find(p => p.id === id);
    if (phrase) {
      const processedText = processText(phrase.text);
      speakText(processedText);
    }
  };

  return (
    <Widget 
      id={id}
      title="Spotter"
      onClose={onClose}
    >
      <div className="spotter-widget p-2">
        <div className="mb-4">
          <label className="block text-sm mb-1">Custom text:</label>
          <textarea 
            className="w-full bg-gray-800 text-white border border-gray-700 rounded p-2 non-draggable interactive" 
            rows={2}
            value={state.text}
            onChange={handleTextChange}
          />
          
          <div className="flex space-x-2 mt-2">
            <button 
              onClick={speak}
              disabled={state.speaking}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded disabled:opacity-50 text-sm non-draggable interactive"
            >
              Speak Now
            </button>
            <button 
              onClick={stop}
              disabled={!state.speaking}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded disabled:opacity-50 text-sm non-draggable interactive"
            >
              Stop
            </button>
          </div>
        </div>
        
        {/* Voice settings collapsible section */}
        <details className="mb-4 bg-gray-800 rounded p-2 non-draggable interactive">
          <summary className="font-medium cursor-pointer non-draggable interactive">Voice Settings</summary>
          <div className="mt-2 space-y-3">
            <div>
              <label className="block text-sm mb-1">Voice:</label>
              <select 
                className="w-full bg-gray-700 text-white border border-gray-600 rounded p-1 text-sm non-draggable interactive"
                value={state.selectedVoice}
                onChange={handleVoiceChange}
              >
                {state.availableVoices.map(voice => (
                  <option key={voice.name} value={voice.name} className="non-draggable interactive">
                    {voice.name} ({voice.lang})
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-1">Rate: {state.rate.toFixed(1)}</label>
              <input 
                type="range"
                min="0.5" 
                max="2" 
                step="0.1" 
                value={state.rate}
                onChange={handleRateChange}
                className="w-full non-draggable interactive"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Pitch: {state.pitch.toFixed(1)}</label>
              <input 
                type="range"
                min="0.5" 
                max="2" 
                step="0.1" 
                value={state.pitch}
                onChange={handlePitchChange}
                className="w-full non-draggable interactive"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Volume: {state.volume.toFixed(1)}</label>
              <input 
                type="range"
                min="0" 
                max="1" 
                step="0.1" 
                value={state.volume}
                onChange={handleVolumeChange}
                className="w-full non-draggable interactive"
              />
            </div>
          </div>
        </details>
        
        {/* Auto mode toggle */}
        <div className="flex items-center justify-between mb-4 bg-gray-800 p-2 rounded">
          <span className="text-sm font-medium">Auto Announcements</span>
          <button
            onClick={toggleAutoMode}
            className={`px-3 py-1 rounded text-white text-sm non-draggable interactive ${
              state.autoMode ? 'bg-green-600' : 'bg-gray-600'
            }`}
          >
            {state.autoMode ? 'On' : 'Off'}
          </button>
        </div>
        
        {/* Phrases section */}
        <div className="mb-2 flex justify-between items-center">
          <h3 className="text-sm font-medium">Automatic Phrases</h3>
          <button 
            onClick={addPhrase}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded non-draggable interactive"
          >
            + Add
          </button>
        </div>
        
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {state.phrases.map(phrase => (
            <div key={phrase.id} className="bg-gray-800 rounded p-2 text-sm">
              <div className="flex justify-between mb-1">
                <button
                  onClick={() => togglePhraseEnabled(phrase.id)}
                  className={`px-2 py-0.5 rounded text-xs non-draggable interactive ${
                    phrase.enabled ? 'bg-green-600' : 'bg-gray-600'
                  }`}
                >
                  {phrase.enabled ? 'Enabled' : 'Disabled'}
                </button>
                <div className="space-x-1">
                  <button
                    onClick={() => testPhrase(phrase.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-0.5 rounded non-draggable interactive"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => deletePhrase(phrase.id)}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-0.5 rounded non-draggable interactive"
                  >
                    Delete
                  </button>
                </div>
              </div>
              <input
                type="text"
                value={phrase.text}
                onChange={(e) => updatePhraseText(phrase.id, e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs mt-1 non-draggable interactive"
              />
              <div className="text-xs text-gray-400 mt-1">
                Trigger: {phrase.trigger.condition}
                {phrase.trigger.condition === 'interval' && ` (every ${(phrase.trigger.interval || 0) / 1000}s)`}
                {phrase.trigger.condition === 'threshold' && ` (${phrase.trigger.telemetryKey} ${
                  phrase.trigger.comparison === 'lt' ? '<' : 
                  phrase.trigger.comparison === 'gt' ? '>' : 
                  phrase.trigger.comparison === 'eq' ? '=' : 
                  '≠'
                } ${phrase.trigger.threshold})`}
              </div>
            </div>
          ))}
        </div>
        
        {/* Telemetry data preview */}
        <details className="mt-3 bg-gray-800 rounded p-2 non-draggable interactive">
          <summary className="font-medium cursor-pointer text-sm non-draggable interactive">Telemetry Values</summary>
          <div className="mt-2 text-xs grid grid-cols-2 gap-2">
            {Object.entries(state.telemetryData).map(([key, value]) => (
              <div key={key} className="flex justify-between">
                <span className="text-gray-400">{key}:</span>
                <span>{typeof value === 'number' ? value.toFixed(1) : String(value)}</span>
              </div>
            ))}
          </div>
        </details>
      </div>
    </Widget>
  );
};

export default SpotterWidget; 