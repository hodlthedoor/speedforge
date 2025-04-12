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
import { useTelemetryData } from '../hooks/useTelemetryData';
import { withControls } from '../widgets/WidgetRegistryAdapter';
import { WidgetControlDefinition, WidgetControlType } from '../widgets/WidgetRegistry';
import WidgetManager from '../services/WidgetManager';

/*
 * Speech Synthesis Options in Electron:
 * 
 * 1. Web Speech API (Current Implementation):
 *    - Uses browser's built-in speech synthesis
 *    - Works cross-platform but with variable quality
 *    - Limited control over voice characteristics
 * 
 * 2. Native Node.js Modules (Potential Enhancement):
 *    - Can provide higher quality, more natural speech
 *    - Better for profanity and realistic intonation
 *    - Implementation example with 'say' module:
 * 
 * ```typescript
 * // In preload.js - expose the speech API to renderer
 * const say = require('say');
 * 
 * contextBridge.exposeInMainWorld('electronSpeech', {
 *   speak: (text, voice, rate, callback) => {
 *     // Using system-specific speech synthesis
 *     say.speak(text, voice, rate, callback);
 *   },
 *   stop: () => {
 *     say.stop();
 *   }
 * });
 * 
 * // Then in this component, check for and use native speech if available:
 * const speakText = (text: string) => {
 *   if (window.electronSpeech) {
 *     // Use native speech synthesis
 *     window.electronSpeech.speak(
 *       processedText,
 *       state.selectedVoice,
 *       state.rate * styleRateModifier,
 *       () => setState(prev => ({ ...prev, speaking: false }))
 *     );
 *   } else if (window.speechSynthesis) {
 *     // Fall back to Web Speech API
 *     // ... existing implementation ...
 *   }
 * };
 * ```
 */

// Type definitions for Electron's speech module (if available)
declare global {
  interface Window {
    electronSpeech?: {
      speak: (text: string, voice: string, rate: number, volume: number) => Promise<{id: number, success: boolean, error?: string}>;
      stop: () => Promise<any>;
      getVoices: () => Promise<string[]>;
      onSpeechComplete: (callback: (data: {id: number}) => void) => () => void;
      onSpeechError: (callback: (data: {id: number, error: string}) => void) => () => void;
    };
    electronAPI?: {
      app: {
        toggleClickThrough: (state: boolean) => Promise<any>; 
        quit: () => void;
      };
      on: (channel: string, callback: (data: any) => void) => () => void; 
      send: (channel: string, data: any) => void;
    };
  }
}

// Define talker style types
type TalkerStyle = "normal" | "excited" | "calm" | "angry" | "disappointed";

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
  voiceStyle: 'normal' | 'aggressive' | 'panicked'; // Voice style setting
}

const SpotterWidgetComponent: React.FC<SpotterWidgetProps> = ({ id, onClose }) => {
  // Use the telemetry data hook to get real-time updates
  const { data: telemetryData, isConnected } = useTelemetryData(id);
  
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
    editingTriggerId: null,
    voiceStyle: 'aggressive' // Default to aggressive for our colorful phrases
  });
  
  // This function handles state updates from the control panel
  useEffect(() => {
    // Make the component handle state updates from the widget system
    const unsubscribe = WidgetManager.subscribe((event) => {
      if (event.type === 'widget:state:updated' && event.widgetId === id) {
        // Merge the incoming updates with current state
        setState(prev => ({
          ...prev,
          ...event.state
        }));
      }
    });
    
    return unsubscribe;
  }, [id]);
  
  // Reference to track if component is mounted
  const isMounted = useRef(true);
  const timerId = useRef<number | null>(null);

  // Process telemetry data whenever it changes
  useEffect(() => {
    if (telemetryData && isMounted.current) {
      // Map car_left_right enum to carLeft, carRight, etc. boolean flags
      const processedData = { 
        ...state.telemetryData, // Preserve existing values, especially lastCarAlert
        ...telemetryData 
      };
      
      // Add carLeft and carRight based on car_left_right enum
      if (processedData.car_left_right) {
        // Set carLeft to true if car_left_right is CarLeft, CarLeftRight, or TwoCarsLeft
        processedData.carLeft = processedData.car_left_right === "CarLeft" || 
                              processedData.car_left_right === "CarLeftRight" || 
                              processedData.car_left_right === "TwoCarsLeft";
        
        // Set carRight to true if car_left_right is CarRight, CarLeftRight, or TwoCarsRight
        processedData.carRight = processedData.car_left_right === "CarRight" || 
                               processedData.car_left_right === "CarLeftRight" || 
                               processedData.car_left_right === "TwoCarsRight";
                               
        // Set twoCarsLeft to true if car_left_right is TwoCarsLeft
        processedData.twoCarsLeft = processedData.car_left_right === "TwoCarsLeft";
        
        // Set twoCarsRight to true if car_left_right is TwoCarsRight
        processedData.twoCarsRight = processedData.car_left_right === "TwoCarsRight";
        
        // Set carsLeftRight to true if car_left_right is CarLeftRight (cars on both sides)
        processedData.carsLeftRight = processedData.car_left_right === "CarLeftRight";
      }
      
      setState(prev => ({ ...prev, telemetryData: processedData }));
    }
  }, [telemetryData, state.telemetryData.lastCarAlert]);

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
    
    // Setup speech event listeners
    let speechCompleteUnsubscribe: (() => void) | null = null;
    let speechErrorUnsubscribe: (() => void) | null = null;
    
    if (window.electronSpeech) {
      // Listen for speech completion events
      speechCompleteUnsubscribe = window.electronSpeech.onSpeechComplete((data) => {
        console.log(`Speech complete event received for id: ${data.id}`);
        
        // Clear any timeout for this speech ID
        if ((window as any).__speakingTimeouts && (window as any).__speakingTimeouts[data.id]) {
          clearTimeout((window as any).__speakingTimeouts[data.id]);
          delete (window as any).__speakingTimeouts[data.id];
        }
        
        // Set speaking state to false if we're still mounted
        if (isMounted.current) {
          setState(prev => ({ ...prev, speaking: false }));
        }
      });
      
      // Listen for speech error events
      speechErrorUnsubscribe = window.electronSpeech.onSpeechError((data) => {
        console.error(`Speech error event received for id: ${data.id}:`, data.error);
        
        // Clear any timeout for this speech ID
        if ((window as any).__speakingTimeouts && (window as any).__speakingTimeouts[data.id]) {
          clearTimeout((window as any).__speakingTimeouts[data.id]);
          delete (window as any).__speakingTimeouts[data.id];
        }
        
        // Set speaking state to false if we're still mounted
        if (isMounted.current) {
          setState(prev => ({ ...prev, speaking: false }));
        }
      });
    }
    
    // Return cleanup function
    return () => {
      isMounted.current = false;
      
      // Remove event listeners
      if (speechCompleteUnsubscribe) speechCompleteUnsubscribe();
      if (speechErrorUnsubscribe) speechErrorUnsubscribe();
      
      // Cancel any ongoing speech
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
      }
      
      // Stop any native speech
      if (window.electronSpeech) {
        window.electronSpeech.stop().catch(e => console.error("Error stopping speech during cleanup", e));
      }
      
      // Clear any active timers
      if (timerId.current) {
        window.clearInterval(timerId.current);
        timerId.current = null;
      }
      
      // Clear any speaking timeouts
      if ((window as any).__speakingTimeouts) {
        Object.values((window as any).__speakingTimeouts).forEach((timeout: any) => {
          clearTimeout(timeout);
        });
        (window as any).__speakingTimeouts = {};
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
    
    // Global cooldown for car proximity alerts (twoCarsLeft, twoCarsRight, carLeft, carRight)
    const globalCarAlertCooldown = 5000; // 5 seconds
    const lastCarAlertKey = 'lastCarAlert';
    const lastCarAlert = state.telemetryData[lastCarAlertKey] || 0;
    
    // Check if we're in global cooldown period for car alerts
    const inGlobalCarAlertCooldown = (now - lastCarAlert) < globalCarAlertCooldown;
    
    // Sort triggers to check in priority order:
    // 1. Cars on both sides alert (highest priority)
    // 2. Two cars alerts second (high priority)
    // 3. Single car alerts third (medium priority)
    // 4. All other alerts unchanged (lowest priority)
    const prioritizedTriggers = [...state.triggers].sort((a, b) => {
      // Put cars both sides alert at the very top (highest priority)
      const aIsCarsLeftRight = a.trigger.telemetryKey === 'carsLeftRight';
      const bIsCarsLeftRight = b.trigger.telemetryKey === 'carsLeftRight';
      
      if (aIsCarsLeftRight && !bIsCarsLeftRight) return -1;
      if (!aIsCarsLeftRight && bIsCarsLeftRight) return 1;
      
      // Then prioritize two cars alerts
      const aIsTwoCars = a.trigger.telemetryKey === 'twoCarsLeft' || a.trigger.telemetryKey === 'twoCarsRight';
      const bIsTwoCars = b.trigger.telemetryKey === 'twoCarsLeft' || b.trigger.telemetryKey === 'twoCarsRight';
      
      if (aIsTwoCars && !bIsTwoCars) return -1;
      if (!aIsTwoCars && bIsTwoCars) return 1;
      
      // Then prioritize single car alerts
      const aIsSingleCar = a.trigger.telemetryKey === 'carLeft' || a.trigger.telemetryKey === 'carRight';
      const bIsSingleCar = b.trigger.telemetryKey === 'carLeft' || b.trigger.telemetryKey === 'carRight';
      
      if (aIsSingleCar && !bIsSingleCar) return -1;
      if (!aIsSingleCar && bIsSingleCar) return 1;
      
      return 0;
    });
    
    // Check each trigger event
    for (const triggerEvent of prioritizedTriggers) {
      if (!triggerEvent.enabled || triggerEvent.phrases.length === 0) continue;
      
      const trigger = triggerEvent.trigger;
      const lastTriggered = trigger.lastTriggered || 0;
      const cooldown = trigger.cooldown || 0;
      
      // Skip if in cooldown period for this specific trigger
      if (now - lastTriggered < cooldown) continue;
      
      // For car alerts, also check the global cooldown
      const isCarAlert = trigger.telemetryKey === 'carLeft' || 
                        trigger.telemetryKey === 'carRight' || 
                        trigger.telemetryKey === 'twoCarsLeft' || 
                        trigger.telemetryKey === 'twoCarsRight' ||
                        trigger.telemetryKey === 'carsLeftRight';
      
      if (isCarAlert && inGlobalCarAlertCooldown) continue;
      
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
              if (trigger.telemetryKey === 'carLeft' || 
                 trigger.telemetryKey === 'carRight' ||
                 trigger.telemetryKey === 'twoCarsLeft' ||
                 trigger.telemetryKey === 'twoCarsRight' ||
                 trigger.telemetryKey === 'carsLeftRight') {
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
        
        // Try to avoid repeating the last phrase if possible and there are multiple phrases
        if (triggerEvent.lastUsedPhraseIndex !== undefined && 
            triggerEvent.phrases.length > 1) {
            
          // Try up to 3 times to get a different index 
          // (this helps avoid repetition while still being random)
          for (let i = 0; i < 3; i++) {
            const newIndex = Math.floor(Math.random() * triggerEvent.phrases.length);
            // If found a different index, use it
            if (newIndex !== triggerEvent.lastUsedPhraseIndex) {
              phraseIndex = newIndex;
              break;
            }
          }
          
          // If we still got the same index after trying, just pick the next one
          if (phraseIndex === triggerEvent.lastUsedPhraseIndex) {
            phraseIndex = (phraseIndex + 1) % triggerEvent.phrases.length;
          }
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
          
          // If this is a car alert, also update the global car alert timestamp
          const updatedTelemetryData = {...prev.telemetryData};
          if (isCarAlert) {
            updatedTelemetryData[lastCarAlertKey] = now;
          }
          
          return { 
            ...prev, 
            triggers: updatedTriggers,
            telemetryData: updatedTelemetryData
          };
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

  // Handle voice style selection
  const handleVoiceStyleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setState(prev => ({ 
      ...prev, 
      voiceStyle: e.target.value as 'normal' | 'aggressive' | 'panicked' 
    }));
  };

  // Toggle auto mode
  const toggleAutoMode = () => {
    setState(prev => ({ ...prev, autoMode: !prev.autoMode }));
  };

  // Speak the current text
  const speak = () => {
    speakText(state.text);
  };

  // Speak specific text using available speech synthesis method
  const speakText = (text: string) => {
    if (!text) return;
    
    // Cancel any ongoing speech
    stopSpeech();
    
    // Apply style-specific adjustments
    let styleRateModifier = 1.0;
    let stylePitchModifier = 1.0;
    
    switch (state.voiceStyle) {
      case 'aggressive':
        // Aggressive style: lower pitch, slightly faster rate, more emphasis
        stylePitchModifier = 0.85;
        styleRateModifier = 1.1;
        break;
      case 'panicked':
        // Panicked style: higher pitch, much faster rate
        stylePitchModifier = 1.15;
        styleRateModifier = 1.25;
        break;
      case 'normal':
      default:
        // Normal style: no modifications
        break;
    }
    
    // Preprocess text to add more natural speech patterns
    let processedText = text
      // Clean up any excessive spaces
      .replace(/\s+/g, ' ')
      .trim()
      
      // Handle punctuation more naturally
      .replace(/—/g, ', ') // Replace em dashes with commas and space
      .replace(/\.\.\./g, '... ') // Add space after ellipsis
      
      // Remove the pattern that introduces random pauses in longer sentences
      // This was causing unnatural speech patterns
      
      // Handle profanity - add emphasis for appropriate styles
      .replace(/(fuck|shit|ass|cunt|bitch|bastard|dick|prick|twat|nuts|goddamn)/gi, (match) => {
        // In real speech, profanity is often emphasized but without artificial pauses
        return state.voiceStyle === 'aggressive' ? 
          `${match.toUpperCase()}` : // Aggressive style emphasizes profanity more
          match;                    // Normal emphasis for other styles
      })
      
      // Add emphasis to directional warnings based on style, but without artificial pauses
      .replace(/(car|cars on both sides|two cars|left|right|both sides)/gi, (match) => {
        if (state.voiceStyle === 'panicked') {
          // Panicked style adds more emphasis to directional words
          return `${match.toUpperCase()}`;
        } else {
          // Normal emphasis for other styles
          return match;
        }
      });
    
    // For native voices, we can also use SSML to improve speech if the system supports it
    if (window.electronSpeech && process.platform === 'darwin') {
      // On macOS, we can use some SSML-like formatting that the say command supports
      if (state.voiceStyle === 'aggressive') {
        // Add more intensity to aggressive style without artificial pauses
        processedText = processedText.replace(/(watch out|careful|caution)/gi, '[[emph +]] $1 [[emph -]]');
      }
      
      if (state.voiceStyle === 'panicked') {
        // Add urgency to panicked style
        processedText = processedText.replace(/(watch out|careful|caution)/gi, '[[rate +0.15]] $1 [[rate -0.15]]');
      }
    }
      
    // Set speaking state
    setState(prev => ({ ...prev, speaking: true }));
    
    // Check if native speech synthesis is available via Electron (preferred method)
    if (window.electronSpeech) {
      console.log('Using native speech synthesis via Electron');
      
      // Determine which voice to use
      const voiceToUse = state.selectedVoice || '';
      
      // Use native speech synthesis for better quality
      window.electronSpeech.speak(
        processedText,
        voiceToUse,
        state.rate * styleRateModifier,
        state.volume
      ).then(response => {
        console.log('Native speech started:', response);
        
        if (response.success) {
          // Speech has started successfully
          // No need to wait for speech completion - the speech module will handle it
          // The widget will show as speaking until we manually stop it or it finishes
          
          // Set a timeout to check the speaking state after a reasonable time
          // This is a fallback in case we don't receive the "completed" event
          const speakingTimeout = setTimeout(() => {
            if (isMounted.current) {
              setState(prev => ({ ...prev, speaking: false }));
            }
          }, 30000); // 30 seconds max for most utterances
          
          // Store the timeout so we can clear it if component unmounts
          (window as any).__speakingTimeouts = (window as any).__speakingTimeouts || {};
          (window as any).__speakingTimeouts[response.id] = speakingTimeout;
        } else {
          // Speech failed to start
          console.error('Failed to start native speech:', response.error);
          if (isMounted.current) {
            setState(prev => ({ ...prev, speaking: false }));
          }
          
          // Fall back to Web Speech API if native speech fails
          if (window.speechSynthesis && isMounted.current) {
            console.log('Falling back to Web Speech API');
            useWebSpeechAPI(processedText, styleRateModifier, stylePitchModifier);
          }
        }
      }).catch(error => {
        console.error('Error in native speech API call:', error);
        
        // Fall back to Web Speech API if native speech fails
        if (window.speechSynthesis && isMounted.current) {
          console.log('Falling back to Web Speech API due to error');
          useWebSpeechAPI(processedText, styleRateModifier, stylePitchModifier);
        } else {
          if (isMounted.current) {
            setState(prev => ({ ...prev, speaking: false }));
          }
        }
      });
    } 
    // Fall back to Web Speech API
    else if (window.speechSynthesis) {
      console.log('Native speech not available, using Web Speech API');
      useWebSpeechAPI(processedText, styleRateModifier, stylePitchModifier);
    }
    // No speech synthesis available
    else {
      console.error("No speech synthesis available");
      setState(prev => ({ ...prev, speaking: false }));
    }
  };
  
  // Helper function to use Web Speech API
  const useWebSpeechAPI = (text: string, rateModifier: number, pitchModifier: number) => {
    // Create a new utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Add slight randomness to speech parameters for more natural sound
    const rateVariation = 0.05; // Small random variation in rate
    const pitchVariation = 0.05; // Small random variation in pitch
    
    // Apply voice settings with style modifications and slight randomization
    utterance.rate = state.rate * rateModifier * (1 + (Math.random() * 2 - 1) * rateVariation);
    utterance.pitch = state.pitch * pitchModifier * (1 + (Math.random() * 2 - 1) * pitchVariation);
    utterance.volume = state.volume;
    
    // Set the selected voice
    if (state.selectedVoice) {
      const voice = state.availableVoices.find(v => v.name === state.selectedVoice);
      if (voice) {
        utterance.voice = voice;
      }
    }
    
    // Add event handlers
    utterance.onend = () => {
      if (isMounted.current) {
        setState(prev => ({ ...prev, speaking: false }));
      }
    };
    
    utterance.onerror = (event) => {
      console.error('Speech synthesis error:', event);
      if (isMounted.current) {
        setState(prev => ({ ...prev, speaking: false }));
      }
    };
    
    // Speak
    window.speechSynthesis.speak(utterance);
  };

  // Create a dedicated stop function that works with both APIs
  const stopSpeech = () => {
    if (window.electronSpeech) {
      // Using the native speech synthesis
      window.electronSpeech.stop()
        .then(() => {
          console.log('Native speech stopped');
        })
        .catch(error => {
          console.error('Error stopping native speech:', error);
        });
    } else if (window.speechSynthesis) {
      // Using the Web Speech API
      window.speechSynthesis.cancel();
    }
  };

  // Replace the existing stop function with this updated version
  const stop = () => {
    // Stop speech using the appropriate method
    stopSpeech();
    
    // Clear any speaking timeouts
    if ((window as any).__speakingTimeouts) {
      Object.values((window as any).__speakingTimeouts).forEach((timeout: any) => {
        clearTimeout(timeout);
      });
      (window as any).__speakingTimeouts = {};
    }
    
    // Reset speaking state
    setState(prev => ({ ...prev, speaking: false }));
  };

  // Warm up the speech synthesis engine for better quality
  const warmUpVoice = () => {
    // Skip if already speaking
    if (window.speechSynthesis.speaking) return;
    
    // Create and immediately cancel an utterance to "wake up" the speech engine
    // This can lead to more consistent voice quality
    const warmupUtterance = new SpeechSynthesisUtterance("");
    window.speechSynthesis.speak(warmupUtterance);
    window.speechSynthesis.cancel();
  };
  
  // Add voice warmup on component initialization
  useEffect(() => {
    // Warm up the voice engine when the component is mounted
    const warmupInterval = setInterval(warmUpVoice, 10000); // Every 10 seconds
    warmUpVoice(); // Initial warmup
    
    return () => {
      clearInterval(warmupInterval);
    };
  }, []);

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

  // State for voice control
  const [selectedStyle, setSelectedStyle] = useState<TalkerStyle>("normal");
  const [volume, setVolume] = useState(0.75);
  const [rate, setRate] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [availableNativeVoices, setAvailableNativeVoices] = useState<string[]>([]);
  const [useNativeSpeech, setUseNativeSpeech] = useState(false);
  
  // Check for native speech capabilities
  useEffect(() => {
    const checkNativeSpeech = async () => {
      if (window.electronSpeech) {
        try {
          console.log("Checking for native speech capabilities...");
          const voices = await window.electronSpeech.getVoices();
          
          if (Array.isArray(voices) && voices.length > 0) {
            console.log("Native voices available:", voices);
            
            // Convert the voice strings to SpeechSynthesisVoice objects for compatibility
            const voiceObjects = voices.map(voiceName => {
              // Extract language code if available (usually in format: "Alex (en-US)")
              const langMatch = voiceName.match(/\(([a-z]{2}(-[A-Z]{2})?)\)/);
              const lang = langMatch ? langMatch[1] : 'en-US'; // Default to en-US if not found
              
              // Create a simplified voice object that matches SpeechSynthesisVoice interface
              return {
                name: voiceName,
                lang: lang,
                localService: true,
                default: false,
                voiceURI: voiceName
              } as SpeechSynthesisVoice;
            });
            
            setAvailableNativeVoices(voices);
            setUseNativeSpeech(true);
            
            // Update state with voice objects and select the first voice
            setState(prev => ({
              ...prev,
              availableVoices: voiceObjects,
              selectedVoice: voiceObjects.length > 0 ? voiceObjects[0].name : ''
            }));
            
            console.log("Native speech synthesis initialized with", voiceObjects.length, "voices");
          } else {
            console.log("No native voices found, falling back to Web Speech API");
            setUseNativeSpeech(false);
            
            // Fall back to Web Speech API
            loadWebSpeechVoices();
          }
        } catch (error) {
          console.error("Error loading native voices:", error);
          setUseNativeSpeech(false);
          
          // Fall back to Web Speech API
          loadWebSpeechVoices();
        }
      } else {
        console.log("Native speech module not available, using Web Speech API");
        setUseNativeSpeech(false);
        
        // Use Web Speech API
        loadWebSpeechVoices();
      }
    };
    
    // Helper function to load Web Speech API voices
    const loadWebSpeechVoices = () => {
      const voices = window.speechSynthesis?.getVoices() || [];
      if (voices.length > 0) {
        console.log("Web Speech API voices loaded:", voices.length, "voices");
        setState(prev => ({ 
          ...prev, 
          availableVoices: voices,
          selectedVoice: voices.length > 0 ? voices[0].name : ''
        }));
      } else {
        // Chrome loads voices asynchronously, set up event handler
        if (window.speechSynthesis?.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = () => {
            const updatedVoices = window.speechSynthesis.getVoices();
            console.log("Web Speech API voices loaded (async):", updatedVoices.length, "voices");
            if (isMounted.current) {
              setState(prev => ({ 
                ...prev, 
                availableVoices: updatedVoices,
                selectedVoice: updatedVoices.length > 0 ? updatedVoices[0].name : ''
              }));
            }
          };
        }
      }
    };
    
    checkNativeSpeech();
  }, []);

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
            
            {/* Debug test button */}
            <button 
              onClick={() => {
                // Simulate car on left
                setState(prev => ({
                  ...prev,
                  telemetryData: {
                    ...prev.telemetryData,
                    car_left_right: "CarLeft",
                    carLeft: true,
                    // Reset other car flags to prevent interference
                    carRight: false,
                    twoCarsLeft: false,
                    twoCarsRight: false,
                    carsLeftRight: false
                  }
                }));
                // Immediately check triggers
                setTimeout(checkTriggers, 100);
              }}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-1 px-3 rounded text-sm non-draggable interactive"
            >
              Test Left Car
            </button>
            
            {/* Debug test button for right car */}
            <button 
              onClick={() => {
                // Simulate car on right
                setState(prev => ({
                  ...prev,
                  telemetryData: {
                    ...prev.telemetryData,
                    car_left_right: "CarRight",
                    carRight: true,
                    // Reset other car flags
                    carLeft: false,
                    twoCarsLeft: false,
                    twoCarsRight: false,
                    carsLeftRight: false
                  }
                }));
                // Immediately check triggers
                setTimeout(checkTriggers, 100);
              }}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-bold py-1 px-3 rounded text-sm non-draggable interactive"
            >
              Test Right Car
            </button>
            
            {/* Debug test button for two cars left */}
            <button 
              onClick={() => {
                // Simulate two cars on left
                setState(prev => ({
                  ...prev,
                  telemetryData: {
                    ...prev.telemetryData,
                    car_left_right: "TwoCarsLeft",
                    carLeft: true,
                    twoCarsLeft: true,
                    // Reset other car flags
                    carRight: false,
                    twoCarsRight: false,
                    carsLeftRight: false
                  }
                }));
                // Immediately check triggers
                setTimeout(checkTriggers, 100);
              }}
              className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-1 px-3 rounded text-sm non-draggable interactive"
            >
              Test Two Left
            </button>
            
            {/* Debug test button for two cars right */}
            <button 
              onClick={() => {
                // Simulate two cars on right
                setState(prev => ({
                  ...prev,
                  telemetryData: {
                    ...prev.telemetryData,
                    car_left_right: "TwoCarsRight",
                    carRight: true,
                    twoCarsRight: true,
                    // Reset other car flags
                    carLeft: false,
                    twoCarsLeft: false,
                    carsLeftRight: false
                  }
                }));
                // Immediately check triggers
                setTimeout(checkTriggers, 100);
              }}
              className="flex-1 bg-orange-600 hover:bg-orange-700 text-white font-bold py-1 px-3 rounded text-sm non-draggable interactive"
            >
              Test Two Right
            </button>
            
            {/* Debug test button for cars on both sides */}
            <button 
              onClick={() => {
                // Simulate cars on both sides
                setState(prev => ({
                  ...prev,
                  telemetryData: {
                    ...prev.telemetryData,
                    car_left_right: "CarLeftRight",
                    carLeft: true,
                    carRight: true,
                    carsLeftRight: true,
                    // Reset other car flags
                    twoCarsLeft: false,
                    twoCarsRight: false
                  }
                }));
                // Immediately check triggers
                setTimeout(checkTriggers, 100);
              }}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-1 px-3 rounded text-sm non-draggable interactive"
            >
              Test Both Sides
            </button>
            
            {/* Demo priority test button */}
            {/* This button demonstrates:
                1. Highest priority for "cars on both sides" alerts
                2. Higher priority for "two cars" alerts over single car alerts
                3. Global cooldown - clicking multiple car alert buttons within 5 seconds
                   will only trigger the first one due to the global cooldown */}
            <button 
              onClick={() => {
                // Simulate a complex scenario with multiple alerts at once
                // Highest priority should win (carsLeftRight)
                setState(prev => ({
                  ...prev,
                  telemetryData: {
                    ...prev.telemetryData,
                    car_left_right: "CarLeftRight", // This should determine the state
                    carLeft: true,                  // Lower priority
                    carRight: true,                 // Lower priority
                    twoCarsLeft: true,              // Medium priority
                    twoCarsRight: false,            // Not active
                    carsLeftRight: true             // Highest priority - this should win
                  }
                }));
                
                // Immediately check triggers
                setTimeout(checkTriggers, 100);
              }}
              className="flex-1 bg-pink-600 hover:bg-pink-700 text-white font-bold py-1 px-3 rounded text-sm non-draggable interactive"
            >
              Test Priority
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

            <div>
              <label className="block text-sm mb-1">Voice Style:</label>
              <div className="flex space-x-2">
                <select 
                  className="flex-1 bg-gray-700 text-white border border-gray-600 rounded p-1 text-sm non-draggable interactive"
                  value={state.voiceStyle}
                  onChange={handleVoiceStyleChange}
                >
                  <option value="normal">Normal (Calm, measured delivery)</option>
                  <option value="aggressive">Aggressive (Lower, intense delivery)</option>
                  <option value="panicked">Panicked (Higher, urgent delivery)</option>
                </select>
                <button
                  onClick={() => {
                    // Test the current style with a sample phrase
                    const samplePhrases = {
                      normal: "Car on your left, check your mirrors",
                      aggressive: "Car on your left, don't let that bastard through!",
                      panicked: "Watch your left, shit—he's coming in hot!"
                    };
                    const phrase = samplePhrases[state.voiceStyle] || samplePhrases.normal;
                    speakText(phrase);
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded non-draggable interactive"
                >
                  Test
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                {state.voiceStyle === 'normal' && "Professional, calm race engineer style"}
                {state.voiceStyle === 'aggressive' && "Intense, authoritative drill sergeant style"}
                {state.voiceStyle === 'panicked' && "Urgent, high-pressure warning style"}
              </p>
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
          <summary className="font-medium cursor-pointer text-sm non-draggable interactive">
            Telemetry Values {isConnected ? 
              <span className="text-green-500">(Connected)</span> : 
              <span className="text-red-500">(Disconnected)</span>
            }
          </summary>
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

// Define the controls that will appear in the control panel
const getSpotterControls = (widgetState: any, updateWidget: (updates: any) => void): WidgetControlDefinition[] => {
  const voiceStyle = widgetState.voiceStyle || 'aggressive';
  const rate = widgetState.rate || 1;
  const pitch = widgetState.pitch || 1;
  const volume = widgetState.volume || 1;
  const autoMode = widgetState.autoMode || false;
  const availableVoices = widgetState.availableVoices || [];
  const selectedVoice = widgetState.selectedVoice || '';
  
  const controls: WidgetControlDefinition[] = [
    {
      id: 'voiceStyle',
      type: 'select' as WidgetControlType,
      label: 'Voice Style',
      value: voiceStyle,
      options: [
        { value: 'normal', label: 'Normal' },
        { value: 'aggressive', label: 'Aggressive' },
        { value: 'panicked', label: 'Panicked' }
      ],
      onChange: (value) => updateWidget({ voiceStyle: value })
    },
    {
      id: 'rate',
      type: 'slider' as WidgetControlType,
      label: `Speech Rate: ${rate.toFixed(1)}`,
      value: rate,
      options: [
        { value: '0.5', label: 'Slow' },
        { value: '1', label: 'Normal' },
        { value: '2', label: 'Fast' }
      ],
      onChange: (value) => updateWidget({ rate: value })
    },
    {
      id: 'pitch',
      type: 'slider' as WidgetControlType,
      label: `Pitch: ${pitch.toFixed(1)}`,
      value: pitch,
      options: [
        { value: '0.5', label: 'Low' },
        { value: '1', label: 'Normal' },
        { value: '2', label: 'High' }
      ],
      onChange: (value) => updateWidget({ pitch: value })
    },
    {
      id: 'volume',
      type: 'slider' as WidgetControlType,
      label: `Volume: ${volume.toFixed(1)}`,
      value: volume,
      options: [
        { value: '0', label: 'Mute' },
        { value: '0.5', label: 'Half' },
        { value: '1', label: 'Max' }
      ],
      onChange: (value) => updateWidget({ volume: value })
    },
    {
      id: 'autoMode',
      type: 'toggle' as WidgetControlType,
      label: 'Auto Announcements',
      value: autoMode,
      onChange: (value) => updateWidget({ autoMode: value })
    }
  ];
  
  // Only add voice selection if there are voices available
  if (availableVoices && availableVoices.length > 0) {
    controls.push({
      id: 'selectedVoice',
      type: 'select' as WidgetControlType,
      label: 'Voice',
      value: selectedVoice,
      options: availableVoices.map((voice: SpeechSynthesisVoice) => ({
        value: voice.name,
        label: `${voice.name} (${voice.lang})`
      })),
      onChange: (value) => updateWidget({ selectedVoice: value })
    });
  }
  
  return controls;
};

// Wrap the component with the controls
const SpotterWidget = withControls(SpotterWidgetComponent, getSpotterControls);

export default SpotterWidget; 