import React, { useState, useEffect, useRef } from 'react';
import Widget from './Widget';
import { 
  TriggerEvent, 
  TriggerCondition, 
  TriggerConfig, 
  defaultTriggers, 
  defaultTelemetryData, 
  processText as processTextWithData,
  createNewTrigger
} from './spotterData';

interface SpotterWidgetProps {
  id: string;
  onClose?: () => void;
}

interface SpotterWidgetState {
  text: string;
  triggers: TriggerEvent[];
  rate: number;
  pitch: number;
  volume: number;
  selectedVoice: string;
  availableVoices: SpeechSynthesisVoice[];
  speaking: boolean;
  autoMode: boolean;
  telemetryData: Record<string, any>; 
  editingTriggerId: string | null; 
}

const SpotterWidget: React.FC<SpotterWidgetProps> = ({ id, onClose }) => {
  const [state, setState] = useState<SpotterWidgetState>({
    text: 'Hello, this is Speedforge spotter',
    triggers: defaultTriggers,
    rate: 1,
    pitch: 1,
    volume: 1,
    selectedVoice: '',
    availableVoices: [],
    speaking: false,
    autoMode: false,
    telemetryData: defaultTelemetryData,
    editingTriggerId: null
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
  }, [state.autoMode, state.triggers, state.telemetryData]);

  // Check all triggers for conditions
  const checkTriggers = () => {
    const now = Date.now();
    
    // Check each trigger event
    for (const triggerEvent of state.triggers) {
      if (!triggerEvent.enabled || triggerEvent.phrases.length === 0) continue;
      
      const trigger = triggerEvent.trigger;
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
              // Special handling for car proximity alerts
              if (trigger.telemetryKey === 'carLeft' || trigger.telemetryKey === 'carRight') {
                // Only trigger when changing from false to true (car appears)
                if (currentValue === true && lastValue === false) {
                  triggered = true;
                }
              } 
              // Default handling for other telemetry values
              else if (typeof currentValue === 'boolean') {
                if (currentValue === true) {
                  triggered = true;
                }
              } else if (typeof currentValue === 'number' && typeof lastValue === 'number') {
                // For numeric values, trigger if significant change
                if (lastValue !== 0) { // Avoid division by zero
                  const percentChange = Math.abs((currentValue - lastValue) / lastValue) * 100;
                  if (percentChange > 10) { // 10% change threshold
                    triggered = true;
                  }
                } else if (currentValue !== 0) {
                  // If last value was 0 and current is not, that's a significant change
                  triggered = true;
                }
              }
              
              // Update the last value
              setState(prev => {
                const updatedTriggers = prev.triggers.map(t => {
                  if (t.id === triggerEvent.id) {
                    return {
                      ...t,
                      trigger: {
                        ...t.trigger,
                        lastValue: currentValue
                      }
                    };
                  }
                  return t;
                });
                
                return { ...prev, triggers: updatedTriggers };
              });
            }
          }
          break;
          
        default:
          break;
      }
      
      if (triggered) {
        // Select a random phrase from the available phrases
        let phraseIndex = Math.floor(Math.random() * triggerEvent.phrases.length);
        
        // Avoid repeating the last phrase if possible and there are multiple phrases
        if (triggerEvent.lastUsedPhraseIndex !== undefined && 
            triggerEvent.phrases.length > 1 && 
            phraseIndex === triggerEvent.lastUsedPhraseIndex) {
          // Choose a different phrase
          phraseIndex = (phraseIndex + 1) % triggerEvent.phrases.length;
        }
        
        const selectedPhrase = triggerEvent.phrases[phraseIndex];
        
        // Update the last triggered time and last used phrase
        setState(prev => {
          const updatedTriggers = prev.triggers.map(t => {
            if (t.id === triggerEvent.id) {
              return {
                ...t,
                trigger: {
                  ...t.trigger,
                  lastTriggered: now
                },
                lastUsedPhraseIndex: phraseIndex
              };
            }
            return t;
          });
          
          return { ...prev, triggers: updatedTriggers };
        });
        
        // Process the phrase text by replacing placeholders with telemetry values
        const processedText = processText(selectedPhrase);
        
        // Speak the processed text
        speakText(processedText);
        
        // Only handle one trigger at a time to avoid multiple phrases speaking at once
        break;
      }
    }
  };

  // Process text to replace placeholders with telemetry data
  const processText = (text: string): string => {
    return processTextWithData(text, state.telemetryData);
  };

  // Handle text update for manual speaking
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setState(prev => ({ ...prev, text: e.target.value }));
  };

  // Handle rate change for voice
  const handleRateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rate = parseFloat(e.target.value);
    setState(prev => ({ ...prev, rate }));
  };

  // Handle pitch change for voice
  const handlePitchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const pitch = parseFloat(e.target.value);
    setState(prev => ({ ...prev, pitch }));
  };

  // Handle volume change for voice
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

  // Add a new trigger event
  const addTrigger = () => {
    const newTrigger = createNewTrigger();
    setState(prev => ({
      ...prev,
      triggers: [...prev.triggers, newTrigger],
      editingTriggerId: newTrigger.id // Automatically start editing the new trigger
    }));
  };

  // Update trigger name
  const updateTriggerName = (id: string, name: string) => {
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.map(trigger => 
        trigger.id === id ? { ...trigger, name } : trigger
      )
    }));
  };

  // Toggle trigger enabled state
  const toggleTriggerEnabled = (id: string) => {
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.map(trigger => 
        trigger.id === id ? { ...trigger, enabled: !trigger.enabled } : trigger
      )
    }));
  };

  // Delete a trigger
  const deleteTrigger = (id: string) => {
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.filter(trigger => trigger.id !== id),
      editingTriggerId: prev.editingTriggerId === id ? null : prev.editingTriggerId
    }));
  };

  // Set the editing trigger
  const setEditingTrigger = (id: string | null) => {
    setState(prev => ({
      ...prev,
      editingTriggerId: id
    }));
  };

  // Add a new phrase to a trigger
  const addPhrase = (triggerId: string) => {
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.map(trigger => {
        if (trigger.id === triggerId) {
          return {
            ...trigger,
            phrases: [...trigger.phrases, 'New phrase']
          };
        }
        return trigger;
      })
    }));
  };

  // Update a phrase in a trigger
  const updatePhrase = (triggerId: string, index: number, text: string) => {
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.map(trigger => {
        if (trigger.id === triggerId) {
          const updatedPhrases = [...trigger.phrases];
          updatedPhrases[index] = text;
          return {
            ...trigger,
            phrases: updatedPhrases
          };
        }
        return trigger;
      })
    }));
  };

  // Delete a phrase from a trigger
  const deletePhrase = (triggerId: string, index: number) => {
    setState(prev => ({
      ...prev,
      triggers: prev.triggers.map(trigger => {
        if (trigger.id === triggerId) {
          const updatedPhrases = [...trigger.phrases];
          updatedPhrases.splice(index, 1);
          return {
            ...trigger,
            phrases: updatedPhrases
          };
        }
        return trigger;
      })
    }));
  };

  // Test a random phrase from a trigger
  const testTrigger = (triggerId: string) => {
    const trigger = state.triggers.find(t => t.id === triggerId);
    if (trigger && trigger.phrases.length > 0) {
      // Select a random phrase
      const randomIndex = Math.floor(Math.random() * trigger.phrases.length);
      const processedText = processText(trigger.phrases[randomIndex]);
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
        
        {/* Trigger Events section */}
        <div className="mb-2 flex justify-between items-center">
          <h3 className="text-sm font-medium">Trigger Events</h3>
          <button 
            onClick={addTrigger}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded non-draggable interactive"
          >
            + Add Trigger
          </button>
        </div>
        
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {state.triggers.map(trigger => (
            <div key={trigger.id} className="bg-gray-800 rounded p-2 text-sm mb-3">
              {/* Trigger header with controls */}
              <div className="flex justify-between mb-1 items-center">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => toggleTriggerEnabled(trigger.id)}
                    className={`px-2 py-0.5 rounded-full text-xs non-draggable interactive ${
                      trigger.enabled ? 'bg-green-600' : 'bg-gray-600'
                    }`}
                  >
                    {trigger.enabled ? 'On' : 'Off'}
                  </button>
                  <input
                    type="text"
                    value={trigger.name}
                    onChange={(e) => updateTriggerName(trigger.id, e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded px-2 py-0.5 text-xs non-draggable interactive"
                  />
                </div>
                <div className="space-x-1">
                  <button
                    onClick={() => testTrigger(trigger.id)}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-0.5 rounded non-draggable interactive"
                    title="Test a random phrase from this trigger"
                  >
                    Test
                  </button>
                  <button
                    onClick={() => state.editingTriggerId === trigger.id ? setEditingTrigger(null) : setEditingTrigger(trigger.id)}
                    className="bg-gray-600 hover:bg-gray-500 text-white text-xs px-2 py-0.5 rounded non-draggable interactive"
                  >
                    {state.editingTriggerId === trigger.id ? 'Close' : 'Edit'}
                  </button>
                  <button
                    onClick={() => deleteTrigger(trigger.id)}
                    className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-0.5 rounded non-draggable interactive"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* Trigger details */}
              <div className="text-xs text-gray-400 mt-1 mb-2">
                Type: {trigger.trigger.condition}
                {trigger.trigger.condition === 'interval' && ` (every ${(trigger.trigger.interval || 0) / 1000}s)`}
                {trigger.trigger.condition === 'threshold' && ` (${trigger.trigger.telemetryKey} ${
                  trigger.trigger.comparison === 'lt' ? '<' : 
                  trigger.trigger.comparison === 'gt' ? '>' : 
                  trigger.trigger.comparison === 'eq' ? '=' : 
                  '≠'
                } ${trigger.trigger.threshold})`}
                • {trigger.phrases.length} phrase{trigger.phrases.length !== 1 ? 's' : ''}
              </div>

              {/* Expanded view for editing phrases */}
              {state.editingTriggerId === trigger.id && (
                <div className="mt-3 border-t border-gray-700 pt-2">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-medium">Phrases ({trigger.phrases.length})</span>
                    <button 
                      onClick={() => addPhrase(trigger.id)}
                      className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-1.5 py-0.5 rounded non-draggable interactive"
                    >
                      + Add Phrase
                    </button>
                  </div>
                  
                  {/* Phrase list */}
                  <div className="space-y-2">
                    {trigger.phrases.map((phrase, index) => (
                      <div key={`${trigger.id}-phrase-${index}`} className="flex items-center space-x-2">
                        <input
                          type="text"
                          value={phrase}
                          onChange={(e) => updatePhrase(trigger.id, index, e.target.value)}
                          className="flex-1 bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs non-draggable interactive"
                        />
                        <button
                          onClick={() => deletePhrase(trigger.id, index)}
                          disabled={trigger.phrases.length <= 1}
                          title={trigger.phrases.length <= 1 ? "At least one phrase is required" : "Delete phrase"}
                          className="text-red-500 hover:text-red-400 disabled:text-gray-500 text-xs non-draggable interactive"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
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