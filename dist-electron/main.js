import { ipcMain, BrowserWindow, app, globalShortcut, screen } from "electron";
import * as path from "path";
import { fileURLToPath } from "url";
import require$$0 from "child_process";
import "fs";
import "os";
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var say$1 = { exports: {} };
var oneTime;
var hasRequiredOneTime;
function requireOneTime() {
  if (hasRequiredOneTime) return oneTime;
  hasRequiredOneTime = 1;
  oneTime = function one(fn) {
    var called = 0, value;
    function onetime() {
      if (called) return value;
      called = 1;
      value = fn.apply(this, arguments);
      fn = null;
      return value;
    }
    onetime.displayName = fn.displayName || fn.name || onetime.displayName || onetime.name;
    return onetime;
  };
  return oneTime;
}
var base;
var hasRequiredBase;
function requireBase() {
  if (hasRequiredBase) return base;
  hasRequiredBase = 1;
  const childProcess = require$$0;
  const once = requireOneTime();
  class SayPlatformBase {
    constructor() {
      this.child = null;
      this.baseSpeed = 0;
    }
    /**
     * Uses system libraries to speak text via the speakers.
     *
     * @param {string} text Text to be spoken
     * @param {string|null} voice Name of voice to be spoken with
     * @param {number|null} speed Speed of text (e.g. 1.0 for normal, 0.5 half, 2.0 double)
     * @param {Function|null} callback A callback of type function(err) to return.
     */
    speak(text, voice, speed, callback) {
      if (typeof callback !== "function") {
        callback = () => {
        };
      }
      callback = once(callback);
      if (!text) {
        return setImmediate(() => {
          callback(new TypeError("say.speak(): must provide text parameter"));
        });
      }
      let { command, args, pipedData, options } = this.buildSpeakCommand({ text, voice, speed });
      this.child = childProcess.spawn(command, args, options);
      this.child.stdin.setEncoding("ascii");
      this.child.stderr.setEncoding("ascii");
      if (pipedData) {
        this.child.stdin.end(pipedData);
      }
      this.child.stderr.once("data", (data) => {
        callback(new Error(data));
      });
      this.child.addListener("exit", (code, signal) => {
        if (code === null || signal !== null) {
          return callback(new Error(`say.speak(): could not talk, had an error [code: ${code}] [signal: ${signal}]`));
        }
        this.child = null;
        callback(null);
      });
    }
    /**
     * Uses system libraries to speak text via the speakers.
     *
     * @param {string} text Text to be spoken
     * @param {string|null} voice Name of voice to be spoken with
     * @param {number|null} speed Speed of text (e.g. 1.0 for normal, 0.5 half, 2.0 double)
     * @param {string} filename Path to file to write audio to, e.g. "greeting.wav"
     * @param {Function|null} callback A callback of type function(err) to return.
     */
    export(text, voice, speed, filename, callback) {
      if (typeof callback !== "function") {
        callback = () => {
        };
      }
      callback = once(callback);
      if (!text) {
        return setImmediate(() => {
          callback(new TypeError("say.export(): must provide text parameter"));
        });
      }
      if (!filename) {
        return setImmediate(() => {
          callback(new TypeError("say.export(): must provide filename parameter"));
        });
      }
      try {
        var { command, args, pipedData, options } = this.buildExportCommand({ text, voice, speed, filename });
      } catch (error) {
        return setImmediate(() => {
          callback(error);
        });
      }
      this.child = childProcess.spawn(command, args, options);
      this.child.stdin.setEncoding("ascii");
      this.child.stderr.setEncoding("ascii");
      if (pipedData) {
        this.child.stdin.end(pipedData);
      }
      this.child.stderr.once("data", (data) => {
        callback(new Error(data));
      });
      this.child.addListener("exit", (code, signal) => {
        if (code === null || signal !== null) {
          return callback(new Error(`say.export(): could not talk, had an error [code: ${code}] [signal: ${signal}]`));
        }
        this.child = null;
        callback(null);
      });
    }
    /**
     * Stops currently playing audio. There will be unexpected results if multiple audios are being played at once
     *
     * TODO: If two messages are being spoken simultaneously, childD points to new instance, no way to kill previous
     *
     * @param {Function|null} callback A callback of type function(err) to return.
     */
    stop(callback) {
      if (typeof callback !== "function") {
        callback = () => {
        };
      }
      callback = once(callback);
      if (!this.child) {
        return setImmediate(() => {
          callback(new Error("say.stop(): no speech to kill"));
        });
      }
      this.runStopCommand();
      this.child = null;
      callback(null);
    }
    convertSpeed(speed) {
      return Math.ceil(this.baseSpeed * speed);
    }
    /**
     * Get Installed voices on system
     * @param {Function} callback A callback of type function(err,voices) to return.
     */
    getInstalledVoices(callback) {
      if (typeof callback !== "function") {
        callback = () => {
        };
      }
      callback = once(callback);
      let { command, args } = this.getVoices();
      var voices = [];
      this.child = childProcess.spawn(command, args);
      this.child.stdin.setEncoding("ascii");
      this.child.stderr.setEncoding("ascii");
      this.child.stderr.once("data", (data) => {
        callback(new Error(data));
      });
      this.child.stdout.on("data", function(data) {
        voices += data;
      });
      this.child.addListener("exit", (code, signal) => {
        if (code === null || signal !== null) {
          return callback(new Error(`say.getInstalledVoices(): could not get installed voices, had an error [code: ${code}] [signal: ${signal}]`));
        }
        if (voices.length > 0) {
          voices = voices.split("\r\n");
          voices = voices[voices.length - 1] === "" ? voices.slice(0, voices.length - 1) : voices;
        }
        this.child = null;
        callback(null, voices);
      });
      this.child.stdin.end();
    }
  }
  base = SayPlatformBase;
  return base;
}
var linux;
var hasRequiredLinux;
function requireLinux() {
  if (hasRequiredLinux) return linux;
  hasRequiredLinux = 1;
  const SayPlatformBase = requireBase();
  const BASE_SPEED = 100;
  const COMMAND = "festival";
  class SayPlatformLinux extends SayPlatformBase {
    constructor() {
      super();
      this.baseSpeed = BASE_SPEED;
    }
    buildSpeakCommand({ text, voice, speed }) {
      let args = [];
      let pipedData = "";
      let options = {};
      args.push("--pipe");
      if (speed) {
        pipedData += `(Parameter.set 'Audio_Command "aplay -q -c 1 -t raw -f s16 -r $(($SR*${this.convertSpeed(speed)}/100)) $FILE") `;
      }
      if (voice) {
        pipedData += `(${voice}) `;
      }
      pipedData += `(SayText "${text}")`;
      return { command: COMMAND, args, pipedData, options };
    }
    buildExportCommand({ text, voice, speed, filename }) {
      throw new Error(`say.export(): does not support platform ${this.platform}`);
    }
    runStopCommand() {
      process.kill(this.child.pid + 2);
    }
    getVoices() {
      throw new Error(`say.export(): does not support platform ${this.platform}`);
    }
  }
  linux = SayPlatformLinux;
  return linux;
}
var darwin;
var hasRequiredDarwin;
function requireDarwin() {
  if (hasRequiredDarwin) return darwin;
  hasRequiredDarwin = 1;
  const SayPlatformBase = requireBase();
  const BASE_SPEED = 175;
  const COMMAND = "say";
  class SayPlatformDarwin extends SayPlatformBase {
    constructor() {
      super();
      this.baseSpeed = BASE_SPEED;
    }
    buildSpeakCommand({ text, voice, speed }) {
      let args = [];
      let pipedData = "";
      let options = {};
      if (!voice) {
        args.push(text);
      } else {
        args.push("-v", voice, text);
      }
      if (speed) {
        args.push("-r", this.convertSpeed(speed));
      }
      return { command: COMMAND, args, pipedData, options };
    }
    buildExportCommand({ text, voice, speed, filename }) {
      let args = [];
      let pipedData = "";
      let options = {};
      if (!voice) {
        args.push(text);
      } else {
        args.push("-v", voice, text);
      }
      if (speed) {
        args.push("-r", this.convertSpeed(speed));
      }
      if (filename) {
        args.push("-o", filename, "--data-format=LEF32@32000");
      }
      return { command: COMMAND, args, pipedData, options };
    }
    runStopCommand() {
      this.child.stdin.pause();
      this.child.kill();
    }
    getVoices() {
      throw new Error(`say.export(): does not support platform ${this.platform}`);
    }
  }
  darwin = SayPlatformDarwin;
  return darwin;
}
var win32;
var hasRequiredWin32;
function requireWin32() {
  if (hasRequiredWin32) return win32;
  hasRequiredWin32 = 1;
  const childProcess = require$$0;
  const SayPlatformBase = requireBase();
  const BASE_SPEED = 0;
  const COMMAND = "powershell";
  class SayPlatformWin32 extends SayPlatformBase {
    constructor() {
      super();
      this.baseSpeed = BASE_SPEED;
    }
    buildSpeakCommand({ text, voice, speed }) {
      let args = [];
      let pipedData = "";
      let options = {};
      let psCommand = `Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;`;
      if (voice) {
        psCommand += `$speak.SelectVoice('${voice}');`;
      }
      if (speed) {
        let adjustedSpeed = this.convertSpeed(speed || 1);
        psCommand += `$speak.Rate = ${adjustedSpeed};`;
      }
      psCommand += `$speak.Speak([Console]::In.ReadToEnd())`;
      pipedData += text;
      args.push(psCommand);
      options.shell = true;
      return { command: COMMAND, args, pipedData, options };
    }
    buildExportCommand({ text, voice, speed, filename }) {
      let args = [];
      let pipedData = "";
      let options = {};
      let psCommand = `Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;`;
      if (voice) {
        psCommand += `$speak.SelectVoice('${voice}');`;
      }
      if (speed) {
        let adjustedSpeed = this.convertSpeed(speed || 1);
        psCommand += `$speak.Rate = ${adjustedSpeed};`;
      }
      if (!filename) throw new Error("Filename must be provided in export();");
      else {
        psCommand += `$speak.SetOutputToWaveFile('${filename}');`;
      }
      psCommand += `$speak.Speak([Console]::In.ReadToEnd());$speak.Dispose()`;
      pipedData += text;
      args.push(psCommand);
      options.shell = true;
      return { command: COMMAND, args, pipedData, options };
    }
    runStopCommand() {
      this.child.stdin.pause();
      childProcess.exec(`taskkill /pid ${this.child.pid} /T /F`);
    }
    convertSpeed(speed) {
      return Math.max(-10, Math.min(Math.round(9.0686 * Math.log(speed) - 0.1806), 10));
    }
    getVoices() {
      let args = [];
      let psCommand = "Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;$speak.GetInstalledVoices() | % {$_.VoiceInfo.Name}";
      args.push(psCommand);
      return { command: COMMAND, args };
    }
  }
  win32 = SayPlatformWin32;
  return win32;
}
var hasRequiredSay;
function requireSay() {
  if (hasRequiredSay) return say$1.exports;
  hasRequiredSay = 1;
  const SayLinux = requireLinux();
  const SayMacos = requireDarwin();
  const SayWin32 = requireWin32();
  const MACOS = "darwin";
  const LINUX = "linux";
  const WIN32 = "win32";
  class Say {
    constructor(platform) {
      if (!platform) {
        platform = process.platform;
      }
      if (platform === MACOS) {
        return new SayMacos();
      } else if (platform === LINUX) {
        return new SayLinux();
      } else if (platform === WIN32) {
        return new SayWin32();
      }
      throw new Error(`new Say(): unsupported platorm! ${platform}`);
    }
  }
  say$1.exports = new Say();
  say$1.exports.Say = Say;
  say$1.exports.platforms = {
    WIN32,
    MACOS,
    LINUX
  };
  return say$1.exports;
}
var sayExports = requireSay();
const say = /* @__PURE__ */ getDefaultExportFromCjs(sayExports);
let voiceCache = [];
let speakingInstances = /* @__PURE__ */ new Map();
let nextSpeakId = 1;
const prohibitedWords = [
  "fuck",
  "shit",
  "ass",
  "damn",
  "bastard",
  "bitch",
  "cunt",
  "dick",
  "cock",
  "twat",
  "prick"
];
function bypassProfanityFilters(text) {
  if (process.platform !== "darwin") return text;
  let modifiedText = text;
  prohibitedWords.forEach((word) => {
    const regex = new RegExp(`\\b${word}\\b`, "gi");
    if (regex.test(modifiedText)) {
      switch (word) {
        case "fuck":
          modifiedText = modifiedText.replace(regex, "f​uck");
          break;
        case "shit":
          modifiedText = modifiedText.replace(regex, "sh​it");
          break;
        case "ass":
          modifiedText = modifiedText.replace(regex, "a​s");
          break;
        case "damn":
          modifiedText = modifiedText.replace(regex, "d​amn");
          break;
        case "bitch":
          modifiedText = modifiedText.replace(regex, "b​itch");
          break;
        default:
          const middleIndex = Math.floor(word.length / 2);
          const modifiedWord = word.slice(0, middleIndex) + "​" + word.slice(middleIndex);
          modifiedText = modifiedText.replace(regex, modifiedWord);
      }
    }
  });
  return modifiedText;
}
function processTextForNaturalSpeech(text) {
  let processedText = text;
  processedText = processedText.replace(/\s+/g, " ").trim();
  if (process.platform === "darwin") {
    processedText = processedText.replace(/\b([A-Z]{2,})\b/g, "[[emph +]]$1[[emph -]]");
    processedText = processedText.replace(/([^!]+)(!+)/g, "$1[[rate +0.1]]$2[[rate -0.1]]");
    processedText = processedText.replace(/([^?]+)(\?+)/g, "$1[[inpt EMPH]]$2");
    if (process.platform !== "darwin") {
      processedText = processedText.replace(/\[\[.*?\]\]/g, "");
    }
  }
  return processedText;
}
function initSpeechModule() {
  console.log("Initializing native speech module...");
  refreshVoiceCache();
  ipcMain.handle("speech:getVoices", getVoices);
  ipcMain.handle("speech:speak", (event, text, voice, rate, volume) => speak(text, voice, rate, volume));
  ipcMain.handle("speech:stop", (event, id) => stop(id));
  console.log("Speech module initialized");
}
async function refreshVoiceCache() {
  return new Promise((resolve) => {
    say.getInstalledVoices((err, voices) => {
      if (err) {
        console.error("Error getting installed voices:", err);
        voiceCache = [];
        resolve([]);
        return;
      }
      if (Array.isArray(voices)) {
        console.log(`Found ${voices.length} voices`);
        voiceCache = voices;
      } else {
        console.log("No voices found or voices are not in expected format");
        console.log("Voices:", voices);
        voiceCache = [];
      }
      resolve(voiceCache);
    });
  });
}
async function getVoices() {
  if (voiceCache.length === 0) {
    await refreshVoiceCache();
  }
  return voiceCache;
}
async function speak(text, voice, rate = 1, volume = 1) {
  const speakId = nextSpeakId++;
  try {
    let processedText = bypassProfanityFilters(text);
    processedText = processTextForNaturalSpeech(processedText);
    const speechPromise = new Promise((resolve, reject) => {
      try {
        const speed = process.platform === "darwin" ? Math.min(Math.max(rate, 0.5), 2) : rate;
        console.log(`Speaking with voice: ${voice}, rate: ${rate}, id: ${speakId}`);
        say.speak(processedText, voice, speed, (err) => {
          if (err) {
            console.error(`Error speaking (id: ${speakId}):`, err);
            for (const window of BrowserWindow.getAllWindows()) {
              if (!window.isDestroyed()) {
                window.webContents.send("speech:error", { id: speakId, error: err.toString() });
              }
            }
            reject(err);
          } else {
            console.log(`Speech completed (id: ${speakId})`);
            for (const window of BrowserWindow.getAllWindows()) {
              if (!window.isDestroyed()) {
                window.webContents.send("speech:complete", { id: speakId });
              }
            }
            if (speakingInstances.has(speakId)) {
              speakingInstances.delete(speakId);
            }
            resolve();
          }
        });
        speakingInstances.set(speakId, { voice, text: processedText });
      } catch (error) {
        console.error(`Exception in speech (id: ${speakId}):`, error);
        reject(error);
      }
    });
    speechPromise.catch((error) => {
      console.error(`Speech promise rejected (id: ${speakId}):`, error);
    });
    return { id: speakId, success: true };
  } catch (error) {
    console.error("Error in speak function:", error);
    return { id: -1, success: false, error: error.message };
  }
}
function stop(id) {
  try {
    if (id && speakingInstances.has(id)) {
      console.log(`Stopping speech with id: ${id}`);
      speakingInstances.delete(id);
    } else {
      console.log("Stopping all speech");
      speakingInstances.clear();
    }
    say.stop();
    return { success: true };
  } catch (error) {
    console.error("Error stopping speech:", error);
    return { success: false, error: error.message };
  }
}
function cleanup() {
  say.stop();
  speakingInstances.clear();
  ipcMain.removeHandler("speech:getVoices");
  ipcMain.removeHandler("speech:speak");
  ipcMain.removeHandler("speech:stop");
}
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
process.env.DIST = path.join(__dirname, "../dist");
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(__dirname, "../public");
const windows = [];
const displayWindowMap = /* @__PURE__ */ new Map();
let stayOnTopInterval = null;
let autoCreateWindowsForNewDisplays = true;
function createWindows() {
  const displays = screen.getAllDisplays();
  console.log(`Found ${displays.length} displays`);
  for (const display of displays) {
    console.log(`Creating window for display: ${display.id}`, {
      bounds: display.bounds,
      workArea: display.workArea
    });
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      },
      // Make the window transparent
      transparent: true,
      backgroundColor: "#00000000",
      // Fully transparent
      frame: false,
      skipTaskbar: true,
      hasShadow: false,
      titleBarStyle: "hidden",
      titleBarOverlay: false,
      fullscreen: false,
      // Don't use simpleFullscreen as it can create issues on macOS
      simpleFullscreen: false,
      // Set to floating window type on macOS
      type: "panel",
      // Important for macOS transparency
      // Remove vibrancy - it can cause transparency issues
      vibrancy: null,
      visualEffectState: null,
      // Ensure the window accepts focus when needed
      focusable: true,
      // Always stay on top of other windows
      alwaysOnTop: true
    });
    if (process.platform === "darwin") {
      win.setWindowButtonVisibility(false);
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.setBackgroundColor("#00000000");
      win.setOpacity(1);
    } else if (process.platform === "win32") {
      win.setAlwaysOnTop(true, "screen-saver");
    } else {
      win.setAlwaysOnTop(true);
    }
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setTitle("Speedforge (click-through:true)");
    const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, "index.html")}`;
    win.loadURL(mainUrl);
    windows.push(win);
    displayWindowMap.set(display.id, win);
    win.displayId = display.id;
    win.webContents.on("did-finish-load", () => {
      console.log(`Window for display ${display.id} is ready`);
      win.webContents.send("display:id", display.id);
      if (process.platform === "darwin") {
        win.setBounds({
          x: display.bounds.x,
          y: display.bounds.y,
          width: display.bounds.width,
          height: display.bounds.height
        });
        win.setOpacity(0.99);
        setTimeout(() => win.setOpacity(1), 100);
      }
    });
    if (process.env.VITE_DEV_SERVER_URL && display.id === screen.getPrimaryDisplay().id) {
      win.webContents.openDevTools({ mode: "detach" });
    }
  }
}
function closeWindowForDisplay(displayId) {
  console.log(`Attempting to close window for display ID: ${displayId}`);
  const win = displayWindowMap.get(displayId);
  if (!win) {
    console.log(`No window found for display ID: ${displayId}`);
    return false;
  }
  try {
    if (!win.isDestroyed()) {
      console.log(`Closing window for display ID: ${displayId}`);
      win.removeAllListeners();
      win.setClosable(true);
      win.hide();
      win.webContents.setDevToolsWebContents(null);
      win.close();
      win.destroy();
      displayWindowMap.delete(displayId);
      const windowIndex = windows.indexOf(win);
      if (windowIndex >= 0) {
        windows.splice(windowIndex, 1);
      }
      console.log(`Successfully closed and destroyed window for display ID: ${displayId}`);
      return true;
    } else {
      console.log(`Window for display ID: ${displayId} was already destroyed`);
      displayWindowMap.delete(displayId);
      const windowIndex = windows.indexOf(win);
      if (windowIndex >= 0) {
        windows.splice(windowIndex, 1);
      }
      return true;
    }
  } catch (error) {
    console.error(`Error closing window for display ID: ${displayId}`, error);
    displayWindowMap.delete(displayId);
    const windowIndex = windows.indexOf(win);
    if (windowIndex >= 0) {
      windows.splice(windowIndex, 1);
    }
  }
  return false;
}
function setupIpcListeners() {
  ipcMain.handle("app:quit", () => {
    console.log("Quitting application");
    try {
      for (const win of windows) {
        if (!win.isDestroyed()) {
          win.close();
        }
      }
      windows.length = 0;
      setTimeout(() => {
        try {
          app.quit();
        } catch (error) {
          console.log("Error during app.quit():", error);
          process.exit(0);
        }
      }, 100);
      return { success: true };
    } catch (error) {
      console.error("Error during quit process:", error);
      process.exit(0);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("app:toggleAutoNewWindows", (event, state) => {
    console.log(`Toggling auto-create new windows for displays from main process to: ${state}`);
    autoCreateWindowsForNewDisplays = state;
    return { success: true, state };
  });
  ipcMain.handle("app:toggleClickThrough", (event, state) => {
    console.log(`Toggling click-through from main process to: ${state}`);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      console.error("Could not find window associated with this request");
      return { success: false, error: "Window not found" };
    }
    try {
      if (state === true) {
        console.log("Setting ignore mouse events with forwarding");
        win.setIgnoreMouseEvents(true, { forward: true });
        win.focusOnWebView();
        if (process.platform === "darwin") {
          win.setAlwaysOnTop(true, "screen-saver", 1);
        } else if (process.platform === "win32") {
          win.setAlwaysOnTop(true, "screen-saver");
        } else {
          win.setAlwaysOnTop(true);
        }
        console.log("Click-through enabled with forwarding. UI controls use CSS to handle clicks.");
      } else {
        console.log("Disabling ignore mouse events");
        win.setIgnoreMouseEvents(false);
        if (process.platform === "darwin") {
          win.setAlwaysOnTop(true, "screen-saver", 1);
        } else if (process.platform === "win32") {
          win.setAlwaysOnTop(true, "screen-saver");
        } else {
          win.setAlwaysOnTop(true);
        }
        console.log("Click-through disabled");
      }
      const response = { success: true, state };
      console.log("Returning response:", response);
      return response;
    } catch (error) {
      console.error("Error toggling click-through:", error);
      const errorResponse = { success: false, error: String(error) };
      console.log("Returning error response:", errorResponse);
      return errorResponse;
    }
  });
  ipcMain.handle("app:closeWindowForDisplay", (event, displayId) => {
    console.log(`Received request to close window for display ID: ${displayId}`);
    if (displayId === void 0) {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        displayId = win.displayId;
      }
    }
    if (displayId === void 0) {
      return { success: false, error: "No display ID provided or found" };
    }
    const success = closeWindowForDisplay(displayId);
    return { success };
  });
  ipcMain.handle("app:getDisplays", () => {
    try {
      const displays = screen.getAllDisplays();
      const primaryDisplay = screen.getPrimaryDisplay();
      const displayInfo = displays.map((display) => ({
        id: display.id,
        bounds: display.bounds,
        workArea: display.workArea,
        isPrimary: display.id === primaryDisplay.id,
        scaleFactor: display.scaleFactor,
        rotation: display.rotation,
        size: display.size,
        label: display.label || `Display ${display.id}`
      }));
      return { success: true, displays: displayInfo };
    } catch (error) {
      console.error("Error getting displays:", error);
      return { success: false, error: String(error) };
    }
  });
  ipcMain.handle("app:getCurrentDisplayId", (event) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (win) {
        const displayId = win.displayId;
        return { success: true, displayId };
      }
      return { success: false, error: "No window found for web contents" };
    } catch (error) {
      console.error("Error getting current display ID:", error);
      return { success: false, error: String(error) };
    }
  });
}
app.on("window-all-closed", () => {
  globalShortcut.unregisterAll();
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", () => {
  if (windows.length === 0) createWindows();
});
app.on("before-quit", () => {
  console.log("Performing cleanup before quit");
  if (stayOnTopInterval) {
    clearInterval(stayOnTopInterval);
    stayOnTopInterval = null;
  }
  globalShortcut.unregisterAll();
  ipcMain.removeHandler("app:quit");
  ipcMain.removeHandler("app:toggleAutoNewWindows");
  ipcMain.removeHandler("app:toggleClickThrough");
  ipcMain.removeHandler("app:closeWindowForDisplay");
  ipcMain.removeHandler("app:getDisplays");
  ipcMain.removeHandler("app:getCurrentDisplayId");
  cleanup();
  for (const win of windows) {
    try {
      if (!win.isDestroyed()) {
        win.removeAllListeners();
        win.setClosable(true);
        win.close();
      }
    } catch (error) {
      console.error("Error closing window:", error);
    }
  }
  windows.length = 0;
});
app.whenReady().then(() => {
  app.setName("Speedforge");
  initSpeechModule();
  createWindows();
  setupIpcListeners();
  stayOnTopInterval = setInterval(() => {
    for (const win of windows) {
      if (!win.isDestroyed()) {
        if (process.platform === "darwin") {
          win.setAlwaysOnTop(true, "screen-saver", 1);
        } else if (process.platform === "win32") {
          win.setAlwaysOnTop(true, "screen-saver");
        } else {
          win.setAlwaysOnTop(true);
        }
      }
    }
  }, 1e3);
  globalShortcut.register("CommandOrControl+Space", () => {
    console.log("Global Ctrl+Space shortcut triggered");
    for (const win of windows) {
      const isCurrentlyClickThrough = win.getTitle().includes("click-through:true");
      const newState = !isCurrentlyClickThrough;
      console.log(`Global shortcut toggling click-through from ${isCurrentlyClickThrough} to ${newState}`);
      win.webContents.send("app:toggle-click-through", newState);
      win.setTitle(`Speedforge (click-through:${newState})`);
    }
  });
  screen.on("display-added", (event, display) => {
    console.log("New display detected:", display);
    if (!autoCreateWindowsForNewDisplays) {
      console.log("Auto-create new windows is disabled, skipping window creation for new display");
      return;
    }
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      webPreferences: {
        preload: path.join(__dirname, "preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
        backgroundThrottling: false
      },
      transparent: true,
      backgroundColor: "#00000000",
      frame: false,
      skipTaskbar: true,
      hasShadow: false,
      titleBarStyle: "hidden",
      titleBarOverlay: false,
      fullscreen: false,
      type: "panel",
      vibrancy: null,
      visualEffectState: null,
      focusable: true,
      alwaysOnTop: true
    });
    if (process.platform === "darwin") {
      win.setWindowButtonVisibility(false);
      win.setAlwaysOnTop(true, "screen-saver", 1);
      win.setBackgroundColor("#00000000");
      win.setOpacity(1);
    } else if (process.platform === "win32") {
      win.setAlwaysOnTop(true, "screen-saver");
    } else {
      win.setAlwaysOnTop(true);
    }
    win.setIgnoreMouseEvents(true, { forward: true });
    win.setTitle("Speedforge (click-through:true)");
    const mainUrl = process.env.VITE_DEV_SERVER_URL || `file://${path.join(process.env.DIST, "index.html")}`;
    win.loadURL(mainUrl);
    windows.push(win);
    displayWindowMap.set(display.id, win);
    win.displayId = display.id;
    console.log(`Created new window for display ${display.id}`);
  });
  screen.on("display-removed", (event, display) => {
    console.log("Display removed:", display);
    const win = displayWindowMap.get(display.id);
    const result = closeWindowForDisplay(display.id);
    console.log(`Window for removed display ${display.id} was ${result ? "closed" : "not found or could not be closed"}`);
    if (!result && win && !win.isDestroyed()) {
      console.log(`Forcing additional cleanup for display ${display.id}`);
      try {
        win.removeAllListeners();
        win.hide();
        win.destroy();
        displayWindowMap.delete(display.id);
        const windowIndex = windows.indexOf(win);
        if (windowIndex >= 0) {
          windows.splice(windowIndex, 1);
        }
      } catch (cleanupError) {
        console.error(`Error during forced cleanup for display ${display.id}:`, cleanupError);
      }
    }
    if (displayWindowMap.has(display.id)) {
      console.warn(`Window for display ${display.id} is still in displayWindowMap after cleanup attempt`);
      displayWindowMap.delete(display.id);
    }
  });
  const displays = screen.getAllDisplays();
  const primary = screen.getPrimaryDisplay();
  console.log("Primary display:", primary);
  console.log("All displays:", displays);
});
//# sourceMappingURL=main.js.map
