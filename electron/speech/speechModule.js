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

// Map to store voice information and settings
let voiceCache = [];
let speakingInstances = new Map(); // Track speaking instances by id
let nextSpeakId = 1;

// List of "prohibited" words that may need special handling for profanity filters
const prohibitedWords = [

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
    const processedText = bypassProfanityFilters(text);
    
    // Create a promise to handle the speech completion
    const speechPromise = new Promise((resolve, reject) => {
      try {
        // Default speed is 1.0 in say.js
        const speed = rate;
        
        // Start speaking
        console.log(`Speaking with voice: ${voice}, rate: ${rate}, id: ${speakId}`);
        
        say.speak(processedText, voice, speed, (err) => {
          if (err) {
            console.error(`Error speaking (id: ${speakId}):`, err);
            reject(err);
          } else {
            console.log(`Speech completed (id: ${speakId})`);
            
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
    
    // Return the speak ID so the client can stop it if needed
    return { id: speakId, promise: speechPromise };
    
  } catch (error) {
    console.error('Error in speak function:', error);
    return { id: -1, error: error.message };
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