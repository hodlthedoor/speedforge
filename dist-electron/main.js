import { ipcMain as u, BrowserWindow as k, app as m, globalShortcut as F, screen as v, dialog as M } from "electron";
import * as p from "path";
import { fileURLToPath as Y } from "url";
import G, { spawn as J } from "child_process";
import * as S from "fs";
import "os";
function ee(r) {
  return r && r.__esModule && Object.prototype.hasOwnProperty.call(r, "default") ? r.default : r;
}
var T = { exports: {} }, W, V;
function re() {
  return V || (V = 1, W = function(e) {
    var o = 0, s;
    function t() {
      return o || (o = 1, s = e.apply(this, arguments), e = null), s;
    }
    return t.displayName = e.displayName || e.name || t.displayName || t.name, t;
  }), W;
}
var A, L;
function _() {
  if (L) return A;
  L = 1;
  const r = G, e = re();
  class o {
    constructor() {
      this.child = null, this.baseSpeed = 0;
    }
    /**
     * Uses system libraries to speak text via the speakers.
     *
     * @param {string} text Text to be spoken
     * @param {string|null} voice Name of voice to be spoken with
     * @param {number|null} speed Speed of text (e.g. 1.0 for normal, 0.5 half, 2.0 double)
     * @param {Function|null} callback A callback of type function(err) to return.
     */
    speak(t, n, c, a) {
      if (typeof a != "function" && (a = () => {
      }), a = e(a), !t)
        return setImmediate(() => {
          a(new TypeError("say.speak(): must provide text parameter"));
        });
      let { command: l, args: d, pipedData: f, options: w } = this.buildSpeakCommand({ text: t, voice: n, speed: c });
      this.child = r.spawn(l, d, w), this.child.stdin.setEncoding("ascii"), this.child.stderr.setEncoding("ascii"), f && this.child.stdin.end(f), this.child.stderr.once("data", ($) => {
        a(new Error($));
      }), this.child.addListener("exit", ($, y) => {
        if ($ === null || y !== null)
          return a(new Error(`say.speak(): could not talk, had an error [code: ${$}] [signal: ${y}]`));
        this.child = null, a(null);
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
    export(t, n, c, a, l) {
      if (typeof l != "function" && (l = () => {
      }), l = e(l), !t)
        return setImmediate(() => {
          l(new TypeError("say.export(): must provide text parameter"));
        });
      if (!a)
        return setImmediate(() => {
          l(new TypeError("say.export(): must provide filename parameter"));
        });
      try {
        var { command: d, args: f, pipedData: w, options: $ } = this.buildExportCommand({ text: t, voice: n, speed: c, filename: a });
      } catch (y) {
        return setImmediate(() => {
          l(y);
        });
      }
      this.child = r.spawn(d, f, $), this.child.stdin.setEncoding("ascii"), this.child.stderr.setEncoding("ascii"), w && this.child.stdin.end(w), this.child.stderr.once("data", (y) => {
        l(new Error(y));
      }), this.child.addListener("exit", (y, C) => {
        if (y === null || C !== null)
          return l(new Error(`say.export(): could not talk, had an error [code: ${y}] [signal: ${C}]`));
        this.child = null, l(null);
      });
    }
    /**
     * Stops currently playing audio. There will be unexpected results if multiple audios are being played at once
     *
     * TODO: If two messages are being spoken simultaneously, childD points to new instance, no way to kill previous
     *
     * @param {Function|null} callback A callback of type function(err) to return.
     */
    stop(t) {
      if (typeof t != "function" && (t = () => {
      }), t = e(t), !this.child)
        return setImmediate(() => {
          t(new Error("say.stop(): no speech to kill"));
        });
      this.runStopCommand(), this.child = null, t(null);
    }
    convertSpeed(t) {
      return Math.ceil(this.baseSpeed * t);
    }
    /**
     * Get Installed voices on system
     * @param {Function} callback A callback of type function(err,voices) to return.
     */
    getInstalledVoices(t) {
      typeof t != "function" && (t = () => {
      }), t = e(t);
      let { command: n, args: c } = this.getVoices();
      var a = [];
      this.child = r.spawn(n, c), this.child.stdin.setEncoding("ascii"), this.child.stderr.setEncoding("ascii"), this.child.stderr.once("data", (l) => {
        t(new Error(l));
      }), this.child.stdout.on("data", function(l) {
        a += l;
      }), this.child.addListener("exit", (l, d) => {
        if (l === null || d !== null)
          return t(new Error(`say.getInstalledVoices(): could not get installed voices, had an error [code: ${l}] [signal: ${d}]`));
        a.length > 0 && (a = a.split(`\r
`), a = a[a.length - 1] === "" ? a.slice(0, a.length - 1) : a), this.child = null, t(null, a);
      }), this.child.stdin.end();
    }
  }
  return A = o, A;
}
var O, q;
function te() {
  if (q) return O;
  q = 1;
  const r = _(), e = 100, o = "festival";
  class s extends r {
    constructor() {
      super(), this.baseSpeed = e;
    }
    buildSpeakCommand({ text: n, voice: c, speed: a }) {
      let l = [], d = "", f = {};
      return l.push("--pipe"), a && (d += `(Parameter.set 'Audio_Command "aplay -q -c 1 -t raw -f s16 -r $(($SR*${this.convertSpeed(a)}/100)) $FILE") `), c && (d += `(${c}) `), d += `(SayText "${n}")`, { command: o, args: l, pipedData: d, options: f };
    }
    buildExportCommand({ text: n, voice: c, speed: a, filename: l }) {
      throw new Error(`say.export(): does not support platform ${this.platform}`);
    }
    runStopCommand() {
      process.kill(this.child.pid + 2);
    }
    getVoices() {
      throw new Error(`say.export(): does not support platform ${this.platform}`);
    }
  }
  return O = s, O;
}
var j, H;
function se() {
  if (H) return j;
  H = 1;
  const r = _(), e = 175, o = "say";
  class s extends r {
    constructor() {
      super(), this.baseSpeed = e;
    }
    buildSpeakCommand({ text: n, voice: c, speed: a }) {
      let l = [], d = "", f = {};
      return c ? l.push("-v", c, n) : l.push(n), a && l.push("-r", this.convertSpeed(a)), { command: o, args: l, pipedData: d, options: f };
    }
    buildExportCommand({ text: n, voice: c, speed: a, filename: l }) {
      let d = [], f = "", w = {};
      return c ? d.push("-v", c, n) : d.push(n), a && d.push("-r", this.convertSpeed(a)), l && d.push("-o", l, "--data-format=LEF32@32000"), { command: o, args: d, pipedData: f, options: w };
    }
    runStopCommand() {
      this.child.stdin.pause(), this.child.kill();
    }
    getVoices() {
      throw new Error(`say.export(): does not support platform ${this.platform}`);
    }
  }
  return j = s, j;
}
var B, U;
function oe() {
  if (U) return B;
  U = 1;
  const r = G, e = _(), o = 0, s = "powershell";
  class t extends e {
    constructor() {
      super(), this.baseSpeed = o;
    }
    buildSpeakCommand({ text: c, voice: a, speed: l }) {
      let d = [], f = "", w = {}, $ = "Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;";
      if (a && ($ += `$speak.SelectVoice('${a}');`), l) {
        let y = this.convertSpeed(l || 1);
        $ += `$speak.Rate = ${y};`;
      }
      return $ += "$speak.Speak([Console]::In.ReadToEnd())", f += c, d.push($), w.shell = !0, { command: s, args: d, pipedData: f, options: w };
    }
    buildExportCommand({ text: c, voice: a, speed: l, filename: d }) {
      let f = [], w = "", $ = {}, y = "Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;";
      if (a && (y += `$speak.SelectVoice('${a}');`), l) {
        let C = this.convertSpeed(l || 1);
        y += `$speak.Rate = ${C};`;
      }
      if (d) y += `$speak.SetOutputToWaveFile('${d}');`;
      else
        throw new Error("Filename must be provided in export();");
      return y += "$speak.Speak([Console]::In.ReadToEnd());$speak.Dispose()", w += c, f.push(y), $.shell = !0, { command: s, args: f, pipedData: w, options: $ };
    }
    runStopCommand() {
      this.child.stdin.pause(), r.exec(`taskkill /pid ${this.child.pid} /T /F`);
    }
    convertSpeed(c) {
      return Math.max(-10, Math.min(Math.round(9.0686 * Math.log(c) - 0.1806), 10));
    }
    getVoices() {
      let c = [];
      return c.push("Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;$speak.GetInstalledVoices() | % {$_.VoiceInfo.Name}"), { command: s, args: c };
    }
  }
  return B = t, B;
}
var z;
function ne() {
  if (z) return T.exports;
  z = 1;
  const r = te(), e = se(), o = oe(), s = "darwin", t = "linux", n = "win32";
  class c {
    constructor(l) {
      if (l || (l = process.platform), l === s)
        return new e();
      if (l === t)
        return new r();
      if (l === n)
        return new o();
      throw new Error(`new Say(): unsupported platorm! ${l}`);
    }
  }
  return T.exports = new c(), T.exports.Say = c, T.exports.platforms = {
    WIN32: n,
    MACOS: s,
    LINUX: t
  }, T.exports;
}
var ie = ne();
const I = /* @__PURE__ */ ee(ie);
let b = [], D = /* @__PURE__ */ new Map(), ae = 1;
const ce = [
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
function le(r) {
  if (process.platform !== "darwin") return r;
  let e = r;
  return ce.forEach((o) => {
    const s = new RegExp(`\\b${o}\\b`, "gi");
    if (s.test(e))
      switch (o) {
        case "fuck":
          e = e.replace(s, "f​uck");
          break;
        case "shit":
          e = e.replace(s, "sh​it");
          break;
        case "ass":
          e = e.replace(s, "a​s");
          break;
        case "damn":
          e = e.replace(s, "d​amn");
          break;
        case "bitch":
          e = e.replace(s, "b​itch");
          break;
        default:
          const t = Math.floor(o.length / 2), n = o.slice(0, t) + "​" + o.slice(t);
          e = e.replace(s, n);
      }
  }), e;
}
function de(r) {
  let e = r;
  return e = e.replace(/\s+/g, " ").trim(), process.platform === "darwin" && (e = e.replace(/\b([A-Z]{2,})\b/g, "[[emph +]]$1[[emph -]]"), e = e.replace(/([^!]+)(!+)/g, "$1[[rate +0.1]]$2[[rate -0.1]]"), e = e.replace(/([^?]+)(\?+)/g, "$1[[inpt EMPH]]$2"), process.platform !== "darwin" && (e = e.replace(/\[\[.*?\]\]/g, ""))), e;
}
function ue() {
  try {
    console.log("Initializing native speech module..."), K().catch((r) => {
      console.error("Error refreshing voice cache:", r);
    }), u.handle("speech:getVoices", pe), u.handle("speech:speak", (r, e, o, s, t) => fe(e, o, s, t)), u.handle("speech:stop", (r, e) => he(e)), console.log("Speech module initialized");
  } catch (r) {
    console.error("Error initializing speech module:", r);
  }
}
async function K() {
  return new Promise((r) => {
    try {
      if (!process.platform || !["darwin", "win32", "linux"].includes(process.platform)) {
        console.error(`Unsupported platform: ${process.platform}`), b = [], r([]);
        return;
      }
      I.getInstalledVoices((e, o) => {
        if (e) {
          console.error("Error getting installed voices:", e), b = [], r([]);
          return;
        }
        Array.isArray(o) ? (console.log(`Found ${o.length} voices`), b = o) : (console.log("No voices found or voices are not in expected format"), console.log("Voices:", o), b = []), r(b);
      });
    } catch (e) {
      console.error("Exception in refreshVoiceCache:", e), b = [], r([]);
    }
  });
}
async function pe() {
  return b.length === 0 && await K(), b;
}
async function fe(r, e, o = 1, s = 1) {
  const t = ae++;
  try {
    let n = le(r);
    return n = de(n), new Promise((a, l) => {
      try {
        const d = process.platform === "darwin" ? Math.min(Math.max(o, 0.5), 2) : o;
        console.log(`Speaking with voice: ${e}, rate: ${o}, id: ${t}`), I.speak(n, e, d, (f) => {
          if (f) {
            console.error(`Error speaking (id: ${t}):`, f);
            for (const w of k.getAllWindows())
              w.isDestroyed() || w.webContents.send("speech:error", { id: t, error: f.toString() });
            l(f);
          } else {
            console.log(`Speech completed (id: ${t})`);
            for (const w of k.getAllWindows())
              w.isDestroyed() || w.webContents.send("speech:complete", { id: t });
            D.has(t) && D.delete(t), a();
          }
        }), D.set(t, { voice: e, text: n });
      } catch (d) {
        console.error(`Exception in speech (id: ${t}):`, d), l(d);
      }
    }).catch((a) => {
      console.error(`Speech promise rejected (id: ${t}):`, a);
    }), { id: t, success: !0 };
  } catch (n) {
    return console.error("Error in speak function:", n), { id: -1, success: !1, error: n.message };
  }
}
function he(r) {
  try {
    return r && D.has(r) ? (console.log(`Stopping speech with id: ${r}`), D.delete(r)) : (console.log("Stopping all speech"), D.clear()), I.stop(), { success: !0 };
  } catch (e) {
    return console.error("Error stopping speech:", e), { success: !1, error: e.message };
  }
}
function ge() {
  I.stop(), D.clear(), u.removeHandler("speech:getVoices"), u.removeHandler("speech:speak"), u.removeHandler("speech:stop");
}
const me = Y(import.meta.url), x = p.dirname(me);
process.env.DIST = p.join(x, "../dist");
process.env.VITE_PUBLIC = m.isPackaged ? process.env.DIST : p.join(x, "../public");
const g = [], E = /* @__PURE__ */ new Map();
let R = null, X = !0, h = null;
function i(...r) {
  try {
    const e = (/* @__PURE__ */ new Date()).toISOString();
    console.log(`[${e}] DEBUG:`, ...r);
  } catch {
    try {
      const s = `[${(/* @__PURE__ */ new Date()).toISOString()}] DEBUG: ${r.map(
        (t) => typeof t == "object" ? JSON.stringify(t) : String(t)
      ).join(" ")}
`;
      process.stderr.write(s);
    } catch {
    }
  }
}
async function we(r) {
  return new Promise((e) => {
    import("net").then((o) => {
      const s = new o.default.Socket();
      s.setTimeout(1e3), s.on("connect", () => {
        s.destroy(), console.log(`WebSocket server is running on port ${r}`), e(!0);
      }), s.on("timeout", () => {
        s.destroy(), console.log(`Timeout connecting to WebSocket server on port ${r}`), e(!1);
      }), s.on("error", (t) => {
        s.destroy(), console.log(`WebSocket server is not running on port ${r}: ${t.message}`), e(!1);
      }), s.connect(r, "localhost");
    }).catch((o) => {
      console.error("Error importing net module:", o), e(!1);
    });
  });
}
async function ye(r = 10) {
  console.log("Waiting for WebSocket server to start...");
  for (let e = 1; e <= r; e++) {
    if (console.log(`Checking WebSocket server (attempt ${e}/${r})...`), await we(8080))
      return console.log("WebSocket server is running!"), !0;
    await new Promise((o) => setTimeout(o, 500));
  }
  return console.error(`WebSocket server did not start after ${r} attempts`), !1;
}
function P(r, e, o) {
  m.isReady() ? M.showErrorBox(r, `${e}

${o || ""}`) : m.on("ready", () => {
    M.showErrorBox(r, `${e}

${o || ""}`);
  });
}
async function N(r = 3) {
  try {
    i("Starting Rust backend initialization");
    let e, o = !1;
    if (i("Process environment:", {
      cwd: process.cwd(),
      resourcesPath: process.resourcesPath,
      isPackaged: m.isPackaged,
      platform: process.platform
    }), m.isPackaged && (e = p.join(process.resourcesPath, "rust_backend", process.platform === "win32" ? "speedforge.exe" : "speedforge"), o = S.existsSync(e), i(`Production Rust binary path: ${e}, exists: ${o}`)), !m.isPackaged || !o) {
      const s = [
        // Debug build
        p.join(process.cwd(), "rust_app", "target", "debug", process.platform === "win32" ? "speedforge.exe" : "speedforge"),
        // Release build
        p.join(process.cwd(), "rust_app", "target", "release", process.platform === "win32" ? "speedforge.exe" : "speedforge"),
        // Relative paths from electron directory
        p.join(x, "..", "rust_app", "target", "debug", process.platform === "win32" ? "speedforge.exe" : "speedforge"),
        p.join(x, "..", "rust_app", "target", "release", process.platform === "win32" ? "speedforge.exe" : "speedforge"),
        // Windows-specific paths that might be used
        p.join("rust_app", "target", "debug", "speedforge.exe"),
        p.join("rust_app", "target", "release", "speedforge.exe")
      ];
      i("Checking for Rust binary at these locations:"), s.forEach((t) => {
        const n = S.existsSync(t);
        if (i(` - ${t} (exists: ${n})`), n)
          try {
            const c = S.statSync(t);
            i(`   - File stats: size=${c.size}, mode=${c.mode.toString(8)}, isExecutable=${c.mode & 73}`);
          } catch (c) {
            i(`   - Error getting file stats: ${c}`);
          }
      });
      for (const t of s)
        if (S.existsSync(t)) {
          e = t, o = !0, i(`Found Rust binary at: ${e}`);
          break;
        }
    }
    if (!o) {
      const s = "ERROR: Rust binary not found at any expected location!";
      return i(s), console.error(s), console.error("Current working directory:", process.cwd()), P(
        "Rust Backend Not Found",
        "The application could not find the Rust backend executable.",
        "The application will continue to run, but some features may not work correctly."
      ), !1;
    }
    if (i(`Starting Rust backend from: ${e}`), i(`Working directory will be: ${p.dirname(e)}`), h = J(e, ["--verbose"], {
      stdio: "pipe",
      // Capture stdout and stderr
      detached: !1,
      // Keep attached to the parent process
      cwd: p.dirname(e),
      // Set working directory to binary location
      env: {
        ...process.env,
        // Add any environment variables needed by the Rust app
        RUST_LOG: "debug",
        RUST_BACKTRACE: "1"
      },
      windowsHide: !1
      // Show console window on Windows for debugging
    }), !h || !h.pid)
      throw new Error("Failed to start Rust process - no process handle or PID");
    return i(`Rust process started with PID: ${h.pid}`), h.stdout ? h.stdout.on("data", (s) => {
      const t = s.toString().trim();
      console.log(`Rust backend stdout: ${t}`);
    }) : i("WARNING: Rust process stdout is null"), h.stderr ? h.stderr.on("data", (s) => {
      const t = s.toString().trim();
      console.error(`Rust backend stderr: ${t}`);
    }) : i("WARNING: Rust process stderr is null"), h.on("exit", (s, t) => {
      i(`Rust backend exited with code ${s} and signal ${t}`), h = null;
    }), h.on("error", (s) => {
      i(`Failed to start Rust backend: ${s.message}`, s), console.error("Failed to start Rust backend:", s), h = null;
    }), new Promise((s) => {
      setTimeout(() => {
        h && h.exitCode === null ? (i("Rust process is running successfully"), s(!0)) : (i("Rust process failed to start or exited immediately"), r > 0 ? (i(`Retrying... (${r} attempts left)`), s(N(r - 1))) : (P(
          "Rust Backend Failed",
          "The Rust backend process failed to start after multiple attempts.",
          "The application will continue to run, but some features may not work correctly."
        ), s(!1)));
      }, 1e3);
    });
  } catch (e) {
    return i(`Error starting Rust backend: ${e}`), console.error("Error starting Rust backend:", e), r > 0 ? (i(`Retrying... (${r} attempts left)`), N(r - 1)) : (P(
      "Rust Backend Error",
      "There was an error starting the Rust backend.",
      e instanceof Error ? e.message : String(e)
    ), !1);
  }
}
function Se() {
  if (h) {
    console.log("Stopping Rust backend...");
    try {
      process.platform === "win32" ? J("taskkill", ["/pid", h.pid.toString(), "/f", "/t"]) : (h.kill("SIGTERM"), setTimeout(() => {
        h && h.kill("SIGKILL");
      }, 1e3));
    } catch (r) {
      console.error("Error stopping Rust backend:", r);
    }
    h = null;
  }
}
function Q() {
  const r = v.getAllDisplays();
  console.log(`Found ${r.length} displays`);
  for (const e of r) {
    console.log(`Creating window for display: ${e.id}`, {
      bounds: e.bounds,
      workArea: e.workArea
    });
    const o = new k({
      x: e.bounds.x,
      y: e.bounds.y,
      width: e.bounds.width,
      height: e.bounds.height,
      webPreferences: {
        preload: p.join(x, "preload.js"),
        nodeIntegration: !1,
        contextIsolation: !0,
        backgroundThrottling: !1
      },
      // Make the window transparent
      transparent: !0,
      backgroundColor: "#00000000",
      // Fully transparent
      frame: !1,
      skipTaskbar: !0,
      hasShadow: !1,
      titleBarStyle: "hidden",
      titleBarOverlay: !1,
      fullscreen: !1,
      // Don't use simpleFullscreen as it can create issues on macOS
      simpleFullscreen: !1,
      // Set to floating window type on macOS
      type: "panel",
      // Important for macOS transparency
      // Remove vibrancy - it can cause transparency issues
      vibrancy: null,
      visualEffectState: null,
      // Ensure the window accepts focus when needed
      focusable: !0,
      // Always stay on top of other windows
      alwaysOnTop: !0
    });
    process.platform === "darwin" ? (o.setWindowButtonVisibility(!1), o.setAlwaysOnTop(!0, "screen-saver", 1), o.setBackgroundColor("#00000000"), o.setOpacity(1)) : process.platform === "win32" ? o.setAlwaysOnTop(!0, "screen-saver") : o.setAlwaysOnTop(!0), o.setIgnoreMouseEvents(!0, { forward: !0 }), o.setTitle("Speedforge (click-through:true)");
    const s = process.env.VITE_DEV_SERVER_URL || `file://${p.join(process.env.DIST, "index.html")}`;
    o.loadURL(s), g.push(o), E.set(e.id, o), o.displayId = e.id, o.webContents.on("did-finish-load", () => {
      try {
        if (o.isDestroyed()) {
          console.warn("Window was destroyed before we could send display:id");
          return;
        }
        if (o.webContents.send("display:id", e.id), o.isDestroyed()) {
          console.warn("Window was destroyed before we could send app:initial-state");
          return;
        }
        o.webContents.send("app:initial-state", {
          clickThrough: !0,
          controlPanelHidden: !0
        });
      } catch (t) {
        try {
          i("Error in did-finish-load handler:", t);
        } catch {
          process.stderr.write(`Error in did-finish-load handler: ${t}
`);
        }
      }
    }), process.env.VITE_DEV_SERVER_URL && e.id === v.getPrimaryDisplay().id && o.webContents.openDevTools({ mode: "detach" });
  }
}
function Z(r) {
  console.log(`Attempting to close window for display ID: ${r}`);
  const e = E.get(r);
  if (!e)
    return console.log(`No window found for display ID: ${r}`), !1;
  try {
    if (e.isDestroyed()) {
      console.log(`Window for display ID: ${r} was already destroyed`), E.delete(r);
      const o = g.indexOf(e);
      return o >= 0 && g.splice(o, 1), !0;
    } else {
      console.log(`Closing window for display ID: ${r}`), e.removeAllListeners(), e.setClosable(!0), e.hide(), e.webContents.setDevToolsWebContents(null), e.close(), e.destroy(), E.delete(r);
      const o = g.indexOf(e);
      return o >= 0 && g.splice(o, 1), console.log(`Successfully closed and destroyed window for display ID: ${r}`), !0;
    }
  } catch (o) {
    console.error(`Error closing window for display ID: ${r}`, o), E.delete(r);
    const s = g.indexOf(e);
    s >= 0 && g.splice(s, 1);
  }
  return !1;
}
function $e(r, e, o) {
  try {
    return !r || r.isDestroyed() || !r.webContents ? (i(`Cannot send ${e} - window is invalid`), !1) : (r.webContents.send(e, o), !0);
  } catch (s) {
    try {
      i(`Error sending ${e} to renderer:`, s);
    } catch {
      process.stderr.write(`Error sending ${e} to renderer: ${s}
`);
    }
    return !1;
  }
}
function be(r) {
  try {
    let e = !0;
    for (const o of g)
      try {
        if (o.isDestroyed()) continue;
        o.setTitle(`Speedforge (click-through:${r})`), $e(o, "app:toggle-click-through", r) || (e = !1);
      } catch (s) {
        i("Error toggling click-through for window:", s), e = !1;
      }
    return e;
  } catch (e) {
    return i("Error in toggleClickThroughForAllWindows:", e), !1;
  }
}
function ve() {
  u.handle("app:quit", () => {
    console.log("Quitting application");
    try {
      for (const r of g)
        r.isDestroyed() || r.close();
      return g.length = 0, setTimeout(() => {
        try {
          m.quit();
        } catch (r) {
          console.log("Error during app.quit():", r), process.exit(0);
        }
      }, 100), { success: !0 };
    } catch (r) {
      return console.error("Error during quit process:", r), process.exit(0), { success: !1, error: String(r) };
    }
  }), u.handle("app:toggleAutoNewWindows", (r, e) => (console.log(`Toggling auto-create new windows for displays from main process to: ${e}`), X = e, { success: !0, state: e })), u.handle("app:toggleClickThrough", (r, e) => {
    console.log(`Toggling click-through from main process to: ${e}`);
    const o = k.fromWebContents(r.sender);
    if (!o)
      return console.error("Could not find window associated with this request"), { success: !1, error: "Window not found" };
    try {
      e === !0 ? (console.log("Setting ignore mouse events with forwarding"), o.setIgnoreMouseEvents(!0, { forward: !0 }), o.focusOnWebView(), process.platform === "darwin" ? o.setAlwaysOnTop(!0, "screen-saver", 1) : process.platform === "win32" ? o.setAlwaysOnTop(!0, "screen-saver") : o.setAlwaysOnTop(!0), console.log("Click-through enabled with forwarding. UI controls use CSS to handle clicks.")) : (console.log("Disabling ignore mouse events"), o.setIgnoreMouseEvents(!1), process.platform === "darwin" ? o.setAlwaysOnTop(!0, "screen-saver", 1) : process.platform === "win32" ? o.setAlwaysOnTop(!0, "screen-saver") : o.setAlwaysOnTop(!0), console.log("Click-through disabled"));
      const s = { success: !0, state: e };
      return console.log("Returning response:", s), s;
    } catch (s) {
      console.error("Error toggling click-through:", s);
      const t = { success: !1, error: String(s) };
      return console.log("Returning error response:", t), t;
    }
  }), u.handle("app:closeWindowForDisplay", (r, e) => {
    if (console.log(`Received request to close window for display ID: ${e}`), e === void 0) {
      const s = k.fromWebContents(r.sender);
      s && (e = s.displayId);
    }
    return e === void 0 ? { success: !1, error: "No display ID provided or found" } : { success: Z(e) };
  }), u.handle("app:getDisplays", () => {
    try {
      const r = v.getAllDisplays(), e = v.getPrimaryDisplay();
      return { success: !0, displays: r.map((s) => ({
        id: s.id,
        bounds: s.bounds,
        workArea: s.workArea,
        isPrimary: s.id === e.id,
        scaleFactor: s.scaleFactor,
        rotation: s.rotation,
        size: s.size,
        label: s.label || `Display ${s.id}`
      })) };
    } catch (r) {
      return console.error("Error getting displays:", r), { success: !1, error: String(r) };
    }
  }), u.handle("app:getCurrentDisplayId", (r) => {
    try {
      const e = k.fromWebContents(r.sender);
      return e ? { success: !0, displayId: e.displayId } : { success: !1, error: "No window found for web contents" };
    } catch (e) {
      return console.error("Error getting current display ID:", e), { success: !1, error: String(e) };
    }
  }), u.handle("config:save", async (r, e, o, s) => {
    try {
      i(`Saving config: type=${e}, name=${o}, size=${JSON.stringify(s).length}`);
      const t = m.getPath("userData"), n = p.join(t, "configs", e);
      S.existsSync(n) || S.mkdirSync(n, { recursive: !0 });
      const c = p.join(n, `${o}.json`);
      return S.writeFileSync(c, JSON.stringify(s, null, 2)), i(`Config saved successfully to ${c}`), !0;
    } catch (t) {
      return i("Error saving config:", t), !1;
    }
  }), u.handle("config:load", async (r, e, o) => {
    try {
      i(`Loading config: type=${e}, name=${o}`);
      const s = m.getPath("userData"), t = p.join(s, "configs", e, `${o}.json`);
      if (!S.existsSync(t))
        return i(`Config file does not exist: ${t}`), null;
      const n = S.readFileSync(t, "utf8"), c = JSON.parse(n);
      return i(`Config loaded successfully from ${t}`), c;
    } catch (s) {
      return i("Error loading config:", s), null;
    }
  }), u.handle("config:list", async (r, e) => {
    try {
      i(`Listing configs for type: ${e}`);
      const o = m.getPath("userData"), s = p.join(o, "configs", e);
      if (!S.existsSync(s))
        return i(`Config directory does not exist: ${s}`), [];
      const t = S.readdirSync(s).filter((n) => n.endsWith(".json")).map((n) => n.replace(".json", ""));
      return i(`Found ${t.length} config files: ${t.join(", ")}`), t;
    } catch (o) {
      return i("Error listing configs:", o), [];
    }
  }), u.handle("config:delete", async (r, e, o) => {
    try {
      i(`Deleting config: type=${e}, name=${o}`);
      const s = m.getPath("userData"), t = p.join(s, "configs", e, `${o}.json`);
      return S.existsSync(t) ? (S.unlinkSync(t), i(`Config deleted successfully: ${t}`), !0) : (i(`Config file does not exist: ${t}`), !1);
    } catch (s) {
      return i("Error deleting config:", s), !1;
    }
  }), u.handle("app:getUserDataPath", async () => {
    try {
      return m.getPath("userData");
    } catch (r) {
      return console.error("Error getting user data path:", r), "";
    }
  }), u.handle("debug:listConfigFiles", async () => {
    try {
      const r = m.getPath("userData"), e = p.join(r, "configs");
      if (!S.existsSync(e))
        return { success: !1, message: "Config directory does not exist", files: [] };
      const o = S.readdirSync(e, { withFileTypes: !0 }).filter((t) => t.isDirectory()).map((t) => t.name), s = {};
      for (const t of o) {
        const n = p.join(e, t), c = S.readdirSync(n).filter((a) => a.endsWith(".json"));
        s[t] = c;
      }
      return {
        success: !0,
        path: e,
        subdirectories: o,
        files: s
      };
    } catch (r) {
      return console.error("Error listing config files:", r), {
        success: !1,
        message: r.message,
        files: {}
      };
    }
  });
}
m.on("window-all-closed", () => {
  F.unregisterAll(), process.platform !== "darwin" && m.quit();
});
m.on("activate", () => {
  g.length === 0 && Q();
});
m.on("before-quit", () => {
  console.log("App is quitting, cleaning up resources..."), Se(), console.log("Performing cleanup before quit"), R && (clearInterval(R), R = null), F.unregisterAll(), u.removeHandler("app:quit"), u.removeHandler("app:toggleAutoNewWindows"), u.removeHandler("app:toggleClickThrough"), u.removeHandler("app:closeWindowForDisplay"), u.removeHandler("app:getDisplays"), u.removeHandler("app:getCurrentDisplayId"), u.removeHandler("config:save"), u.removeHandler("config:load"), u.removeHandler("config:list"), u.removeHandler("config:delete"), u.removeHandler("app:getUserDataPath"), u.removeHandler("debug:listConfigFiles"), ge();
  for (const r of g)
    try {
      r.isDestroyed() || (r.removeAllListeners(), r.setClosable(!0), r.close());
    } catch (e) {
      console.error("Error closing window:", e);
    }
  g.length = 0;
});
m.whenReady().then(async () => {
  m.setName("Speedforge"), ue(), i("Starting Rust backend process");
  const r = await N();
  i(`Rust backend started: ${r}`), r ? (i("Waiting for WebSocket server to become available"), await ye(20) ? i("WebSocket server is running properly") : (i("WebSocket server didn't start, but continuing anyway..."), P(
    "WebSocket Server Warning",
    "The WebSocket server did not start properly.",
    "The application will continue to run, but some features may not work correctly."
  ))) : i("Skipping WebSocket server check since Rust backend failed to start"), Q(), ve(), R = setInterval(() => {
    for (const s of g)
      s.isDestroyed() || (process.platform === "darwin" ? s.setAlwaysOnTop(!0, "screen-saver", 1) : process.platform === "win32" ? s.setAlwaysOnTop(!0, "screen-saver") : s.setAlwaysOnTop(!0));
  }, 1e3), F.register("CommandOrControl+Space", () => {
    try {
      i("Global Ctrl+Space shortcut triggered");
      let s = !0;
      g.length > 0 && !g[0].isDestroyed() && (s = g[0].getTitle().includes("click-through:true"));
      const t = !s;
      i(`Global shortcut toggling click-through from ${s} to ${t}`), be(t);
    } catch (s) {
      try {
        i("Error in global shortcut handler:", s);
      } catch {
        process.stderr.write(`Error in global shortcut handler: ${s}
`);
      }
    }
  }), v.on("display-added", (s, t) => {
    try {
      if (i("New display detected:", t), !X) {
        i("Auto-create new windows is disabled, skipping window creation for new display");
        return;
      }
      const n = new k({
        x: t.bounds.x,
        y: t.bounds.y,
        width: t.bounds.width,
        height: t.bounds.height,
        webPreferences: {
          preload: p.join(x, "preload.js"),
          nodeIntegration: !1,
          contextIsolation: !0,
          backgroundThrottling: !1
        },
        transparent: !0,
        backgroundColor: "#00000000",
        frame: !1,
        skipTaskbar: !0,
        hasShadow: !1,
        titleBarStyle: "hidden",
        titleBarOverlay: !1,
        fullscreen: !1,
        type: "panel",
        vibrancy: null,
        visualEffectState: null,
        focusable: !0,
        alwaysOnTop: !0
      });
      process.platform === "darwin" ? (n.setWindowButtonVisibility(!1), n.setAlwaysOnTop(!0, "screen-saver", 1), n.setBackgroundColor("#00000000"), n.setOpacity(1)) : process.platform === "win32" ? n.setAlwaysOnTop(!0, "screen-saver") : n.setAlwaysOnTop(!0), n.setIgnoreMouseEvents(!0, { forward: !0 }), n.setTitle("Speedforge (click-through:true)");
      const c = process.env.VITE_DEV_SERVER_URL || `file://${p.join(process.env.DIST, "index.html")}`;
      n.loadURL(c), n.webContents.on("did-finish-load", () => {
        try {
          if (n.isDestroyed()) {
            console.warn("Window was destroyed before we could send display:id");
            return;
          }
          if (n.webContents.send("display:id", t.id), n.isDestroyed()) {
            console.warn("Window was destroyed before we could send app:initial-state");
            return;
          }
          n.webContents.send("app:initial-state", {
            clickThrough: !0,
            controlPanelHidden: !0
          });
        } catch (a) {
          try {
            i("Error in did-finish-load handler:", a);
          } catch {
            process.stderr.write(`Error in did-finish-load handler: ${a}
`);
          }
        }
      }), g.push(n), E.set(t.id, n), n.displayId = t.id, i(`Created new window for display ${t.id}`);
    } catch (n) {
      try {
        i("Error handling display-added event:", n);
      } catch {
        process.stderr.write(`Error handling display-added event: ${n}
`);
      }
    }
  }), v.on("display-removed", (s, t) => {
    try {
      i("Display removed:", t);
      const n = E.get(t.id), c = Z(t.id);
      if (i(`Window for removed display ${t.id} was ${c ? "closed" : "not found or could not be closed"}`), !c && n && !n.isDestroyed()) {
        i(`Forcing additional cleanup for display ${t.id}`);
        try {
          n.removeAllListeners(), n.hide(), n.destroy(), E.delete(t.id);
          const a = g.indexOf(n);
          a >= 0 && g.splice(a, 1);
        } catch (a) {
          i(`Error during forced cleanup for display ${t.id}:`, a);
        }
      }
    } catch (n) {
      try {
        i("Error handling display-removed event:", n);
      } catch {
        process.stderr.write(`Error handling display-removed event: ${n}
`);
      }
    }
  });
  const e = v.getAllDisplays(), o = v.getPrimaryDisplay();
  console.log("Primary display:", o), console.log("All displays:", e);
});
