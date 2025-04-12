/**
 * Native speech module using the 'say' package
 * This module provides high-quality text-to-speech using the operating system's native speech engines:
 * - macOS: uses 'say' command and the native macOS voices
 * - Windows: uses SAPI voices
 * - Linux: uses speech-dispatcher
 */
import say from 'say';
import { ipcMain } from 'electron';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { BrowserWindow } from 'electron';

// Map to store voice information and settings
let voiceCache = [];
let speakingInstances = new Map(); // Track speaking instances by id
let nextSpeakId = 1;

// List of "prohibited" words that may need special handling for profanity filters
const prohibitedWords = [
  'fuck', 'shit', 'ass', 'damn', 'bastard', 
  'bitch', 'cunt', 'dick', 'cock', 'twat', 'prick'
];

// Custom profanity handler - returns modified text to bypass filters
function bypassProfanityFilters(text) {
  // Only do this processing if we're on macOS which has stricter filters
  if (process.platform !== 'darwin') return text;
  
  let modifiedText = text;
  
  // Replace prohibited words with slight modifications that still sound similar
  // when spoken but may bypass filters
  prohibitedWords.forEach(word => {
    // Create a regex that matches the word as a whole word
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    
    // Replace with various techniques:
    // 1. Insert invisible character (zero-width space) between letters
    // 2. Slightly alter spelling while maintaining pronunciation
    if (regex.test(modifiedText)) {
      // Choose a bypass method based on the word
      switch(word) {
        case 'fuck':
          modifiedText = modifiedText.replace(regex, 'f\u200Buck'); // Insert zero-width space
          break;
        case 'shit':
          modifiedText = modifiedText.replace(regex, 'sh\u200Bit'); // Insert zero-width space
          break;
        case 'ass':
          modifiedText = modifiedText.replace(regex, 'a\u200Bs'); // Insert zero-width space
          break;
        case 'damn':
          modifiedText = modifiedText.replace(regex, 'd\u200Bamn'); // Insert zero-width space
          break;
        case 'bitch':
          modifiedText = modifiedText.replace(regex, 'b\u200Bitch'); // Insert zero-width space
          break;
        default:
          // Insert zero-width space in the middle for other words
          const middleIndex = Math.floor(word.length / 2);
          const modifiedWord = word.slice(0, middleIndex) + '\u200B' + word.slice(middleIndex);
          modifiedText = modifiedText.replace(regex, modifiedWord);
      }
    }
  });
  
  return modifiedText;
}

// Process text for more natural speech
function processTextForNaturalSpeech(text) {
  let processedText = text;
  
  // Clean up and normalize whitespace
  processedText = processedText.replace(/\s+/g, ' ').trim();
  
  if (process.platform === 'darwin') {
    // On macOS, we can use special markers that the 'say' command understands
    // See: https://ss64.com/osx/say.html
    
    // Handle all-caps words by adding emphasis
    processedText = processedText.replace(/\b([A-Z]{2,})\b/g, '[[emph +]]$1[[emph -]]');
    
    // Handle exclamation points by slightly raising pitch
    processedText = processedText.replace(/([^!]+)(!+)/g, '$1[[rate +0.1]]$2[[rate -0.1]]');
    
    // Add slight emphasis to questions
    processedText = processedText.replace(/([^?]+)(\?+)/g, '$1[[inpt EMPH]]$2');
    
    // Process SSML-like markers that we allow in input:
    // 1. [[emph +]] and [[emph -]] - already handled natively
    // 2. [[rate +0.15]] and [[rate -0.15]] - already handled natively
    
    // For Windows or Linux, strip any SSML-like markers since they won't work there
    if (process.platform !== 'darwin') {
      processedText = processedText.replace(/\[\[.*?\]\]/g, '');
    }
  }
  
  return processedText;
}

// Initialize speech module
function initSpeechModule() {
  console.log('Initializing native speech module...');
  
  // Get available voices asynchronously
  refreshVoiceCache();
  
  // Register IPC handlers for speech functions
  ipcMain.handle('speech:getVoices', getVoices);
  ipcMain.handle('speech:speak', (event, text, voice, rate, volume) => speak(text, voice, rate, volume));
  ipcMain.handle('speech:stop', (event, id) => stop(id));
  
  console.log('Speech module initialized');
}

// Refresh the voice cache
async function refreshVoiceCache() {
  return new Promise((resolve) => {
    say.getInstalledVoices((err, voices) => {
      if (err) {
        console.error('Error getting installed voices:', err);
        voiceCache = [];
        resolve([]);
        return;
      }
      
      if (Array.isArray(voices)) {
        console.log(`Found ${voices.length} voices`);
        voiceCache = voices;
      } else {
        console.log('No voices found or voices are not in expected format');
        console.log('Voices:', voices);
        voiceCache = [];
      }
      
      resolve(voiceCache);
    });
  });
}

// Get available voices
async function getVoices() {
  if (voiceCache.length === 0) {
    await refreshVoiceCache();
  }
  
  // Return cached voices
  return voiceCache;
}

// Speak text with specified voice and parameters
async function speak(text, voice, rate = 1.0, volume = 1.0) {
  // Generate a unique ID for this speaking instance
  const speakId = nextSpeakId++;
  
  try {
    // Handle profanity to bypass filters - especially important on macOS
    let processedText = bypassProfanityFilters(text);
    
    // Process text for natural-sounding speech with appropriate prosody
    processedText = processTextForNaturalSpeech(processedText);
    
    // Create a promise to handle the speech completion
    const speechPromise = new Promise((resolve, reject) => {
      try {
        // Calculate effective speed based on platform
        // macOS 'say' command works better with values closer to 1.0
        const speed = process.platform === 'darwin' 
          ? Math.min(Math.max(rate, 0.5), 2.0)        // Clamp between 0.5 and 2.0
          : rate;
        
        // Start speaking
        console.log(`Speaking with voice: ${voice}, rate: ${rate}, id: ${speakId}`);
        
        say.speak(processedText, voice, speed, (err) => {
          if (err) {
            console.error(`Error speaking (id: ${speakId}):`, err);
            
            // Send error event to renderer
            for (const window of BrowserWindow.getAllWindows()) {
              if (!window.isDestroyed()) {
                window.webContents.send('speech:error', { id: speakId, error: err.toString() });
              }
            }
            
            reject(err);
          } else {
            console.log(`Speech completed (id: ${speakId})`);
            
            // Send completion event to renderer
            for (const window of BrowserWindow.getAllWindows()) {
              if (!window.isDestroyed()) {
                window.webContents.send('speech:complete', { id: speakId });
              }
            }
            
            // Remove from active instances
            if (speakingInstances.has(speakId)) {
              speakingInstances.delete(speakId);
            }
            resolve();
          }
        });
        
        // Store this instance for potential stopping later
        speakingInstances.set(speakId, { voice, text: processedText });
        
      } catch (error) {
        console.error(`Exception in speech (id: ${speakId}):`, error);
        reject(error);
      }
    });
    
    // Handle the promise internally instead of returning it
    speechPromise.catch(error => {
      console.error(`Speech promise rejected (id: ${speakId}):`, error);
    });
    
    // Return just the speak ID so the client can stop it if needed
    return { id: speakId, success: true };
    
  } catch (error) {
    console.error('Error in speak function:', error);
    return { id: -1, success: false, error: error.message };
  }
}

// Stop speech
function stop(id) {
  try {
    // If an ID is provided, stop only that instance
    if (id && speakingInstances.has(id)) {
      console.log(`Stopping speech with id: ${id}`);
      speakingInstances.delete(id);
    } 
    // Otherwise stop all speech
    else {
      console.log('Stopping all speech');
      speakingInstances.clear();
    }
    
    // Stop any ongoing speech
    say.stop();
    
    return { success: true };
  } catch (error) {
    console.error('Error stopping speech:', error);
    return { success: false, error: error.message };
  }
}

// Cleanup function to be called when app is closing
function cleanup() {
  // Stop any active speech
  say.stop();
  speakingInstances.clear();
  
  // Remove IPC handlers
  ipcMain.removeHandler('speech:getVoices');
  ipcMain.removeHandler('speech:speak');
  ipcMain.removeHandler('speech:stop');
}

// Export functions
export {
  initSpeechModule,
  cleanup,
  getVoices,
  speak,
  stop
}; 