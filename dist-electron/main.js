import { ipcMain as d, BrowserWindow as k, app as m, globalShortcut as V, screen as v, dialog as q } from "electron";
import * as p from "path";
import { fileURLToPath as ee } from "url";
import J, { spawn as K } from "child_process";
import * as S from "fs";
import "os";
function re(r) {
  return r && r.__esModule && Object.prototype.hasOwnProperty.call(r, "default") ? r.default : r;
}
var T = { exports: {} }, A, H;
function te() {
  return H || (H = 1, A = function(e) {
    var s = 0, o;
    function t() {
      return s || (s = 1, o = e.apply(this, arguments), e = null), o;
    }
    return t.displayName = e.displayName || e.name || t.displayName || t.name, t;
  }), A;
}
var O, M;
function _() {
  if (M) return O;
  M = 1;
  const r = J, e = te();
  class s {
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
      let { command: l, args: u, pipedData: f, options: w } = this.buildSpeakCommand({ text: t, voice: n, speed: c });
      this.child = r.spawn(l, u, w), this.child.stdin.setEncoding("ascii"), this.child.stderr.setEncoding("ascii"), f && this.child.stdin.end(f), this.child.stderr.once("data", (b) => {
        a(new Error(b));
      }), this.child.addListener("exit", (b, y) => {
        if (b === null || y !== null)
          return a(new Error(`say.speak(): could not talk, had an error [code: ${b}] [signal: ${y}]`));
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
        var { command: u, args: f, pipedData: w, options: b } = this.buildExportCommand({ text: t, voice: n, speed: c, filename: a });
      } catch (y) {
        return setImmediate(() => {
          l(y);
        });
      }
      this.child = r.spawn(u, f, b), this.child.stdin.setEncoding("ascii"), this.child.stderr.setEncoding("ascii"), w && this.child.stdin.end(w), this.child.stderr.once("data", (y) => {
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
      }), this.child.addListener("exit", (l, u) => {
        if (l === null || u !== null)
          return t(new Error(`say.getInstalledVoices(): could not get installed voices, had an error [code: ${l}] [signal: ${u}]`));
        a.length > 0 && (a = a.split(`\r
`), a = a[a.length - 1] === "" ? a.slice(0, a.length - 1) : a), this.child = null, t(null, a);
      }), this.child.stdin.end();
    }
  }
  return O = s, O;
}
var B, L;
function oe() {
  if (L) return B;
  L = 1;
  const r = _(), e = 100, s = "festival";
  class o extends r {
    constructor() {
      super(), this.baseSpeed = e;
    }
    buildSpeakCommand({ text: n, voice: c, speed: a }) {
      let l = [], u = "", f = {};
      return l.push("--pipe"), a && (u += `(Parameter.set 'Audio_Command "aplay -q -c 1 -t raw -f s16 -r $(($SR*${this.convertSpeed(a)}/100)) $FILE") `), c && (u += `(${c}) `), u += `(SayText "${n}")`, { command: s, args: l, pipedData: u, options: f };
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
  return B = o, B;
}
var j, U;
function se() {
  if (U) return j;
  U = 1;
  const r = _(), e = 175, s = "say";
  class o extends r {
    constructor() {
      super(), this.baseSpeed = e;
    }
    buildSpeakCommand({ text: n, voice: c, speed: a }) {
      let l = [], u = "", f = {};
      return c ? l.push("-v", c, n) : l.push(n), a && l.push("-r", this.convertSpeed(a)), { command: s, args: l, pipedData: u, options: f };
    }
    buildExportCommand({ text: n, voice: c, speed: a, filename: l }) {
      let u = [], f = "", w = {};
      return c ? u.push("-v", c, n) : u.push(n), a && u.push("-r", this.convertSpeed(a)), l && u.push("-o", l, "--data-format=LEF32@32000"), { command: s, args: u, pipedData: f, options: w };
    }
    runStopCommand() {
      this.child.stdin.pause(), this.child.kill();
    }
    getVoices() {
      throw new Error(`say.export(): does not support platform ${this.platform}`);
    }
  }
  return j = o, j;
}
var N, z;
function ne() {
  if (z) return N;
  z = 1;
  const r = J, e = _(), s = 0, o = "powershell";
  class t extends e {
    constructor() {
      super(), this.baseSpeed = s;
    }
    buildSpeakCommand({ text: c, voice: a, speed: l }) {
      let u = [], f = "", w = {}, b = "Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;";
      if (a && (b += `$speak.SelectVoice('${a}');`), l) {
        let y = this.convertSpeed(l || 1);
        b += `$speak.Rate = ${y};`;
      }
      return b += "$speak.Speak([Console]::In.ReadToEnd())", f += c, u.push(b), w.shell = !0, { command: o, args: u, pipedData: f, options: w };
    }
    buildExportCommand({ text: c, voice: a, speed: l, filename: u }) {
      let f = [], w = "", b = {}, y = "Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;";
      if (a && (y += `$speak.SelectVoice('${a}');`), l) {
        let C = this.convertSpeed(l || 1);
        y += `$speak.Rate = ${C};`;
      }
      if (u) y += `$speak.SetOutputToWaveFile('${u}');`;
      else
        throw new Error("Filename must be provided in export();");
      return y += "$speak.Speak([Console]::In.ReadToEnd());$speak.Dispose()", w += c, f.push(y), b.shell = !0, { command: o, args: f, pipedData: w, options: b };
    }
    runStopCommand() {
      this.child.stdin.pause(), r.exec(`taskkill /pid ${this.child.pid} /T /F`);
    }
    convertSpeed(c) {
      return Math.max(-10, Math.min(Math.round(9.0686 * Math.log(c) - 0.1806), 10));
    }
    getVoices() {
      let c = [];
      return c.push("Add-Type -AssemblyName System.speech;$speak = New-Object System.Speech.Synthesis.SpeechSynthesizer;$speak.GetInstalledVoices() | % {$_.VoiceInfo.Name}"), { command: o, args: c };
    }
  }
  return N = t, N;
}
var G;
function ie() {
  if (G) return T.exports;
  G = 1;
  const r = oe(), e = se(), s = ne(), o = "darwin", t = "linux", n = "win32";
  class c {
    constructor(l) {
      if (l || (l = process.platform), l === o)
        return new e();
      if (l === t)
        return new r();
      if (l === n)
        return new s();
      throw new Error(`new Say(): unsupported platorm! ${l}`);
    }
  }
  return T.exports = new c(), T.exports.Say = c, T.exports.platforms = {
    WIN32: n,
    MACOS: o,
    LINUX: t
  }, T.exports;
}
var ae = ie();
const W = /* @__PURE__ */ re(ae);
let $ = [], D = /* @__PURE__ */ new Map(), ce = 1;
const le = [
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
function de(r) {
  if (process.platform !== "darwin") return r;
  let e = r;
  return le.forEach((s) => {
    const o = new RegExp(`\\b${s}\\b`, "gi");
    if (o.test(e))
      switch (s) {
        case "fuck":
          e = e.replace(o, "f​uck");
          break;
        case "shit":
          e = e.replace(o, "sh​it");
          break;
        case "ass":
          e = e.replace(o, "a​s");
          break;
        case "damn":
          e = e.replace(o, "d​amn");
          break;
        case "bitch":
          e = e.replace(o, "b​itch");
          break;
        default:
          const t = Math.floor(s.length / 2), n = s.slice(0, t) + "​" + s.slice(t);
          e = e.replace(o, n);
      }
  }), e;
}
function ue(r) {
  let e = r;
  return e = e.replace(/\s+/g, " ").trim(), process.platform === "darwin" && (e = e.replace(/\b([A-Z]{2,})\b/g, "[[emph +]]$1[[emph -]]"), e = e.replace(/([^!]+)(!+)/g, "$1[[rate +0.1]]$2[[rate -0.1]]"), e = e.replace(/([^?]+)(\?+)/g, "$1[[inpt EMPH]]$2"), process.platform !== "darwin" && (e = e.replace(/\[\[.*?\]\]/g, ""))), e;
}
function pe() {
  try {
    console.log("Initializing native speech module..."), Q().catch((r) => {
      console.error("Error refreshing voice cache:", r);
    }), d.handle("speech:getVoices", fe), d.handle("speech:speak", (r, e, s, o, t) => ge(e, s, o, t)), d.handle("speech:stop", (r, e) => he(e)), console.log("Speech module initialized");
  } catch (r) {
    console.error("Error initializing speech module:", r);
  }
}
async function Q() {
  return new Promise((r) => {
    try {
      if (!process.platform || !["darwin", "win32", "linux"].includes(process.platform)) {
        console.error(`Unsupported platform: ${process.platform}`), $ = [], r([]);
        return;
      }
      W.getInstalledVoices((e, s) => {
        if (e) {
          console.error("Error getting installed voices:", e), $ = [], r([]);
          return;
        }
        Array.isArray(s) ? (console.log(`Found ${s.length} voices`), $ = s) : (console.log("No voices found or voices are not in expected format"), console.log("Voices:", s), $ = []), r($);
      });
    } catch (e) {
      console.error("Exception in refreshVoiceCache:", e), $ = [], r([]);
    }
  });
}
async function fe() {
  return $.length === 0 && await Q(), $;
}
async function ge(r, e, s = 1, o = 1) {
  const t = ce++;
  try {
    let n = de(r);
    return n = ue(n), new Promise((a, l) => {
      try {
        const u = process.platform === "darwin" ? Math.min(Math.max(s, 0.5), 2) : s;
        console.log(`Speaking with voice: ${e}, rate: ${s}, id: ${t}`), W.speak(n, e, u, (f) => {
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
      } catch (u) {
        console.error(`Exception in speech (id: ${t}):`, u), l(u);
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
    return r && D.has(r) ? (console.log(`Stopping speech with id: ${r}`), D.delete(r)) : (console.log("Stopping all speech"), D.clear()), W.stop(), { success: !0 };
  } catch (e) {
    return console.error("Error stopping speech:", e), { success: !1, error: e.message };
  }
}
function we() {
  W.stop(), D.clear(), d.removeHandler("speech:getVoices"), d.removeHandler("speech:speak"), d.removeHandler("speech:stop");
}
const me = ee(import.meta.url), x = p.dirname(me);
process.env.DIST = p.join(x, "../dist");
process.env.VITE_PUBLIC = m.isPackaged ? process.env.DIST : p.join(x, "../public");
const h = [], E = /* @__PURE__ */ new Map();
let R = null, X = !0, g = null, I = !1;
function i(...r) {
  try {
    const e = (/* @__PURE__ */ new Date()).toISOString();
    console.log(`[${e}] DEBUG:`, ...r);
  } catch {
    try {
      const o = `[${(/* @__PURE__ */ new Date()).toISOString()}] DEBUG: ${r.map(
        (t) => typeof t == "object" ? JSON.stringify(t) : String(t)
      ).join(" ")}
`;
      process.stderr.write(o);
    } catch {
    }
  }
}
async function ye(r) {
  return new Promise((e) => {
    import("net").then((s) => {
      const o = new s.default.Socket();
      o.setTimeout(1e3), o.on("connect", () => {
        o.destroy(), console.log(`WebSocket server is running on port ${r}`), e(!0);
      }), o.on("timeout", () => {
        o.destroy(), console.log(`Timeout connecting to WebSocket server on port ${r}`), e(!1);
      }), o.on("error", (t) => {
        o.destroy(), console.log(`WebSocket server is not running on port ${r}: ${t.message}`), e(!1);
      }), o.connect(r, "localhost");
    }).catch((s) => {
      console.error("Error importing net module:", s), e(!1);
    });
  });
}
async function Se(r = 10) {
  console.log("Waiting for WebSocket server to start...");
  for (let e = 1; e <= r; e++) {
    if (console.log(`Checking WebSocket server (attempt ${e}/${r})...`), await ye(8080))
      return console.log("WebSocket server is running!"), !0;
    await new Promise((s) => setTimeout(s, 500));
  }
  return console.error(`WebSocket server did not start after ${r} attempts`), !1;
}
function P(r, e, s) {
  m.isReady() ? q.showErrorBox(r, `${e}

${s || ""}`) : m.on("ready", () => {
    q.showErrorBox(r, `${e}

${s || ""}`);
  });
}
async function F(r = 3) {
  try {
    i("Starting Rust backend initialization");
    let e, s = !1;
    if (i("Process environment:", {
      cwd: process.cwd(),
      resourcesPath: process.resourcesPath,
      isPackaged: m.isPackaged,
      platform: process.platform
    }), m.isPackaged && (e = p.join(process.resourcesPath, "rust_backend", process.platform === "win32" ? "speedforge.exe" : "speedforge"), s = S.existsSync(e), i(`Production Rust binary path: ${e}, exists: ${s}`)), !m.isPackaged || !s) {
      const o = [
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
      i("Checking for Rust binary at these locations:"), o.forEach((t) => {
        const n = S.existsSync(t);
        if (i(` - ${t} (exists: ${n})`), n)
          try {
            const c = S.statSync(t);
            i(`   - File stats: size=${c.size}, mode=${c.mode.toString(8)}, isExecutable=${c.mode & 73}`);
          } catch (c) {
            i(`   - Error getting file stats: ${c}`);
          }
      });
      for (const t of o)
        if (S.existsSync(t)) {
          e = t, s = !0, i(`Found Rust binary at: ${e}`);
          break;
        }
    }
    if (!s) {
      const o = "ERROR: Rust binary not found at any expected location!";
      return i(o), console.error(o), console.error("Current working directory:", process.cwd()), P(
        "Rust Backend Not Found",
        "The application could not find the Rust backend executable.",
        "The application will continue to run, but some features may not work correctly."
      ), !1;
    }
    if (i(`Starting Rust backend from: ${e}`), i(`Working directory will be: ${p.dirname(e)}`), g = K(e, ["--verbose"], {
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
    }), !g || !g.pid)
      throw new Error("Failed to start Rust process - no process handle or PID");
    return i(`Rust process started with PID: ${g.pid}`), g.stdout ? g.stdout.on("data", (o) => {
      const t = o.toString().trim();
      console.log(`Rust backend stdout: ${t}`);
    }) : i("WARNING: Rust process stdout is null"), g.stderr ? g.stderr.on("data", (o) => {
      const t = o.toString().trim();
      console.error(`Rust backend stderr: ${t}`);
    }) : i("WARNING: Rust process stderr is null"), g.on("exit", (o, t) => {
      i(`Rust backend exited with code ${o} and signal ${t}`), g = null;
    }), g.on("error", (o) => {
      i(`Failed to start Rust backend: ${o.message}`, o), console.error("Failed to start Rust backend:", o), g = null;
    }), new Promise((o) => {
      setTimeout(() => {
        g && g.exitCode === null ? (i("Rust process is running successfully"), o(!0)) : (i("Rust process failed to start or exited immediately"), r > 0 ? (i(`Retrying... (${r} attempts left)`), o(F(r - 1))) : (P(
          "Rust Backend Failed",
          "The Rust backend process failed to start after multiple attempts.",
          "The application will continue to run, but some features may not work correctly."
        ), o(!1)));
      }, 1e3);
    });
  } catch (e) {
    return i(`Error starting Rust backend: ${e}`), console.error("Error starting Rust backend:", e), r > 0 ? (i(`Retrying... (${r} attempts left)`), F(r - 1)) : (P(
      "Rust Backend Error",
      "There was an error starting the Rust backend.",
      e instanceof Error ? e.message : String(e)
    ), !1);
  }
}
function be() {
  if (g) {
    console.log("Stopping Rust backend...");
    try {
      process.platform === "win32" ? K("taskkill", ["/pid", g.pid.toString(), "/f", "/t"]) : (g.kill("SIGTERM"), setTimeout(() => {
        g && g.kill("SIGKILL");
      }, 1e3));
    } catch (r) {
      console.error("Error stopping Rust backend:", r);
    }
    g = null;
  }
}
function Z() {
  const r = v.getAllDisplays();
  console.log(`Found ${r.length} displays`);
  for (const e of r) {
    console.log(`Creating window for display: ${e.id}`, {
      bounds: e.bounds,
      workArea: e.workArea
    });
    const s = new k({
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
    process.platform === "darwin" ? (s.setWindowButtonVisibility(!1), s.setAlwaysOnTop(!0, "screen-saver", 1), s.setBackgroundColor("#00000000"), s.setOpacity(1)) : process.platform === "win32" ? s.setAlwaysOnTop(!0, "screen-saver") : s.setAlwaysOnTop(!0), s.setIgnoreMouseEvents(!0, { forward: !0 }), s.setTitle("Speedforge (click-through:true)");
    const o = process.env.VITE_DEV_SERVER_URL || `file://${p.join(process.env.DIST, "index.html")}`;
    s.loadURL(o), h.push(s), E.set(e.id, s), s.displayId = e.id, s.webContents.on("did-finish-load", () => {
      try {
        if (s.isDestroyed()) {
          console.warn("Window was destroyed before we could send display:id");
          return;
        }
        if (s.webContents.send("display:id", e.id, e.bounds), s.isDestroyed()) {
          console.warn("Window was destroyed before we could send app:initial-state");
          return;
        }
        s.webContents.send("app:initial-state", {
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
    }), process.env.VITE_DEV_SERVER_URL && e.id === v.getPrimaryDisplay().id && s.webContents.openDevTools({ mode: "detach" });
  }
}
function Y(r) {
  console.log(`Attempting to close window for display ID: ${r}`);
  const e = E.get(r);
  if (!e)
    return console.log(`No window found for display ID: ${r}`), !1;
  try {
    if (e.isDestroyed()) {
      console.log(`Window for display ID: ${r} was already destroyed`), E.delete(r);
      const s = h.indexOf(e);
      return s >= 0 && h.splice(s, 1), !0;
    } else {
      console.log(`Closing window for display ID: ${r}`), e.removeAllListeners(), e.setClosable(!0), e.hide(), e.webContents.setDevToolsWebContents(null), e.close(), e.destroy(), E.delete(r);
      const s = h.indexOf(e);
      return s >= 0 && h.splice(s, 1), console.log(`Successfully closed and destroyed window for display ID: ${r}`), !0;
    }
  } catch (s) {
    console.error(`Error closing window for display ID: ${r}`, s), E.delete(r);
    const o = h.indexOf(e);
    o >= 0 && h.splice(o, 1);
  }
  return !1;
}
function ve(r, e, s) {
  try {
    return !r || r.isDestroyed() || !r.webContents ? (i(`Cannot send ${e} - window is invalid`), !1) : (r.webContents.send(e, s), !0);
  } catch (o) {
    try {
      i(`Error sending ${e} to renderer:`, o);
    } catch {
      process.stderr.write(`Error sending ${e} to renderer: ${o}
`);
    }
    return !1;
  }
}
function $e(r) {
  try {
    let e = !0;
    for (const s of h)
      try {
        if (s.isDestroyed()) continue;
        s.setTitle(`Speedforge (click-through:${r})`), ve(s, "app:toggle-click-through", r) || (e = !1);
      } catch (o) {
        i("Error toggling click-through for window:", o), e = !1;
      }
    return e;
  } catch (e) {
    return i("Error in toggleClickThroughForAllWindows:", e), !1;
  }
}
function Ee() {
  d.handle("app:quit", () => {
    console.log("Quitting application");
    try {
      if (I)
        return { success: !0 };
      I = !0;
      for (const r of h)
        if (!r.isDestroyed())
          try {
            r.webContents.send("app:before-quit");
          } catch (e) {
            console.error("Error sending before-quit notification:", e);
          }
      return setTimeout(() => {
        for (const r of h)
          r.isDestroyed() || r.close();
        h.length = 0, setTimeout(() => {
          try {
            process.exit(0);
          } catch (r) {
            console.log("Error during process.exit():", r), process.exit(1);
          }
        }, 100);
      }, 300), { success: !0 };
    } catch (r) {
      return console.error("Error during quit process:", r), process.exit(1), { success: !1, error: String(r) };
    }
  }), d.handle("app:toggleAutoNewWindows", (r, e) => (console.log(`Toggling auto-create new windows for displays from main process to: ${e}`), X = e, { success: !0, state: e })), d.handle("app:toggleClickThrough", (r, e) => {
    console.log(`Toggling click-through from main process to: ${e}`);
    const s = k.fromWebContents(r.sender);
    if (!s)
      return console.error("Could not find window associated with this request"), { success: !1, error: "Window not found" };
    try {
      e === !0 ? (console.log("Setting ignore mouse events with forwarding"), s.setIgnoreMouseEvents(!0, { forward: !0 }), s.focusOnWebView(), process.platform === "darwin" ? s.setAlwaysOnTop(!0, "screen-saver", 1) : process.platform === "win32" ? s.setAlwaysOnTop(!0, "screen-saver") : s.setAlwaysOnTop(!0), console.log("Click-through enabled with forwarding. UI controls use CSS to handle clicks.")) : (console.log("Disabling ignore mouse events"), s.setIgnoreMouseEvents(!1), process.platform === "darwin" ? s.setAlwaysOnTop(!0, "screen-saver", 1) : process.platform === "win32" ? s.setAlwaysOnTop(!0, "screen-saver") : s.setAlwaysOnTop(!0), console.log("Click-through disabled"));
      const o = { success: !0, state: e };
      return console.log("Returning response:", o), o;
    } catch (o) {
      console.error("Error toggling click-through:", o);
      const t = { success: !1, error: String(o) };
      return console.log("Returning error response:", t), t;
    }
  }), d.handle("app:closeWindowForDisplay", (r, e) => {
    if (console.log(`Received request to close window for display ID: ${e}`), e === void 0) {
      const o = k.fromWebContents(r.sender);
      o && (e = o.displayId);
    }
    return e === void 0 ? { success: !1, error: "No display ID provided or found" } : { success: Y(e) };
  }), d.handle("app:getDisplays", () => {
    try {
      const r = v.getAllDisplays(), e = v.getPrimaryDisplay();
      return { success: !0, displays: r.map((o) => ({
        id: o.id,
        bounds: o.bounds,
        workArea: o.workArea,
        isPrimary: o.id === e.id,
        scaleFactor: o.scaleFactor,
        rotation: o.rotation,
        size: o.size,
        label: o.label || `Display ${o.id}`
      })) };
    } catch (r) {
      return console.error("Error getting displays:", r), { success: !1, error: String(r) };
    }
  }), d.handle("app:getCurrentDisplayId", (r) => {
    try {
      const e = k.fromWebContents(r.sender);
      if (e) {
        const s = e.displayId, o = e.getBounds(), t = { x: o.x + o.width / 2, y: o.y + o.height / 2 }, c = v.getDisplayNearestPoint(t).bounds;
        return console.log(`Returning display ID ${s} with bounds:`, c), {
          success: !0,
          displayId: s,
          displayBounds: c
        };
      }
      return { success: !1, error: "No window found for web contents" };
    } catch (e) {
      return console.error("Error getting current display ID:", e), { success: !1, error: String(e) };
    }
  }), d.handle("config:save", async (r, e, s, o) => {
    try {
      i(`Saving config: type=${e}, name=${s}, size=${JSON.stringify(o).length}`);
      const t = m.getPath("userData"), n = p.join(t, "configs", e);
      S.existsSync(n) || S.mkdirSync(n, { recursive: !0 });
      const c = p.join(n, `${s}.json`);
      return S.writeFileSync(c, JSON.stringify(o, null, 2)), i(`Config saved successfully to ${c}`), !0;
    } catch (t) {
      return i("Error saving config:", t), !1;
    }
  }), d.handle("config:load", async (r, e, s) => {
    try {
      i(`Loading config: type=${e}, name=${s}`);
      const o = m.getPath("userData"), t = p.join(o, "configs", e, `${s}.json`);
      if (!S.existsSync(t))
        return i(`Config file does not exist: ${t}`), null;
      const n = S.readFileSync(t, "utf8"), c = JSON.parse(n);
      return i(`Config loaded successfully from ${t}`), c;
    } catch (o) {
      return i("Error loading config:", o), null;
    }
  }), d.handle("config:list", async (r, e) => {
    try {
      i(`Listing configs for type: ${e}`);
      const s = m.getPath("userData"), o = p.join(s, "configs", e);
      if (!S.existsSync(o))
        return i(`Config directory does not exist: ${o}`), [];
      const t = S.readdirSync(o).filter((n) => n.endsWith(".json")).map((n) => n.replace(".json", ""));
      return i(`Found ${t.length} config files: ${t.join(", ")}`), t;
    } catch (s) {
      return i("Error listing configs:", s), [];
    }
  }), d.handle("config:delete", async (r, e, s) => {
    try {
      i(`Deleting config: type=${e}, name=${s}`);
      const o = m.getPath("userData"), t = p.join(o, "configs", e, `${s}.json`);
      return S.existsSync(t) ? (S.unlinkSync(t), i(`Config deleted successfully: ${t}`), !0) : (i(`Config file does not exist: ${t}`), !1);
    } catch (o) {
      return i("Error deleting config:", o), !1;
    }
  }), d.handle("app:getUserDataPath", async () => {
    try {
      return m.getPath("userData");
    } catch (r) {
      return console.error("Error getting user data path:", r), "";
    }
  }), d.handle("debug:listConfigFiles", async () => {
    try {
      const r = m.getPath("userData"), e = p.join(r, "configs");
      if (!S.existsSync(e))
        return { success: !1, message: "Config directory does not exist", files: [] };
      const s = S.readdirSync(e, { withFileTypes: !0 }).filter((t) => t.isDirectory()).map((t) => t.name), o = {};
      for (const t of s) {
        const n = p.join(e, t), c = S.readdirSync(n).filter((a) => a.endsWith(".json"));
        o[t] = c;
      }
      return {
        success: !0,
        path: e,
        subdirectories: s,
        files: o
      };
    } catch (r) {
      return console.error("Error listing config files:", r), {
        success: !1,
        message: r.message,
        files: {}
      };
    }
  }), d.handle("app:openDevTools", async (r) => {
    try {
      const e = r.sender;
      return e ? (e.openDevTools({ mode: "detach" }), !0) : !1;
    } catch (e) {
      return console.error("Error opening developer tools:", e), !1;
    }
  });
}
function ke() {
  console.log("Cleaning up IPC handlers..."), d.removeHandler("app:quit"), d.removeHandler("app:toggleClickThrough"), d.removeHandler("app:toggleAutoNewWindows"), d.removeHandler("app:closeWindowForDisplay"), d.removeHandler("app:getDisplays"), d.removeHandler("app:getCurrentDisplayId"), d.removeHandler("app:getUserDataPath"), d.removeHandler("app:openDevTools"), d.removeHandler("widget:create"), d.removeHandler("widget:close"), d.removeHandler("widget:getAll"), d.removeHandler("widget:setPosition"), d.removeHandler("widget:setSize"), d.removeHandler("widget:setAlwaysOnTop"), d.removeHandler("widget:setOpacity"), d.removeHandler("widget:setVisible"), d.removeHandler("widget:updateParams"), d.removeHandler("config:save"), d.removeHandler("config:load"), d.removeHandler("config:list"), d.removeHandler("config:delete"), d.removeHandler("debug:listConfigFiles");
}
m.on("window-all-closed", () => {
  V.unregisterAll(), process.platform !== "darwin" && m.quit();
});
m.on("activate", () => {
  h.length === 0 && Z();
});
m.on("before-quit", (r) => {
  if (!I) {
    i("App before-quit event received"), I = !0;
    for (const e of h)
      if (!e.isDestroyed())
        try {
          e.webContents.send("app:before-quit"), i(`Sent app:before-quit to window ${e.displayId || "unknown"}`);
        } catch (s) {
          i("Error sending before-quit notification:", s);
        }
    console.log("App is quitting, cleaning up resources..."), be(), console.log("Performing cleanup before quit"), R && (clearInterval(R), R = null), V.unregisterAll(), ke(), we(), r.preventDefault(), setTimeout(() => {
      i("Proceeding with app quit after delay"), process.exit(0);
    }, 1500);
  }
});
m.whenReady().then(async () => {
  m.setName("Speedforge"), pe(), i("Starting Rust backend process");
  const r = await F();
  i(`Rust backend started: ${r}`), r ? (i("Waiting for WebSocket server to become available"), await Se(20) ? i("WebSocket server is running properly") : (i("WebSocket server didn't start, but continuing anyway..."), P(
    "WebSocket Server Warning",
    "The WebSocket server did not start properly.",
    "The application will continue to run, but some features may not work correctly."
  ))) : i("Skipping WebSocket server check since Rust backend failed to start"), Z(), Ee(), R = setInterval(() => {
    for (const o of h)
      o.isDestroyed() || (process.platform === "darwin" ? o.setAlwaysOnTop(!0, "screen-saver", 1) : process.platform === "win32" ? o.setAlwaysOnTop(!0, "screen-saver") : o.setAlwaysOnTop(!0));
  }, 1e3), V.register("CommandOrControl+Space", () => {
    try {
      i("Global Ctrl+Space shortcut triggered");
      let o = !0;
      h.length > 0 && !h[0].isDestroyed() && (o = h[0].getTitle().includes("click-through:true"));
      const t = !o;
      i(`Global shortcut toggling click-through from ${o} to ${t}`), $e(t);
    } catch (o) {
      try {
        i("Error in global shortcut handler:", o);
      } catch {
        process.stderr.write(`Error in global shortcut handler: ${o}
`);
      }
    }
  }), v.on("display-added", (o, t) => {
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
          if (n.webContents.send("display:id", t.id, t.bounds), n.isDestroyed()) {
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
      }), h.push(n), E.set(t.id, n), n.displayId = t.id, i(`Created new window for display ${t.id}`);
    } catch (n) {
      try {
        i("Error handling display-added event:", n);
      } catch {
        process.stderr.write(`Error handling display-added event: ${n}
`);
      }
    }
  }), v.on("display-removed", (o, t) => {
    try {
      i("Display removed:", t);
      const n = E.get(t.id), c = Y(t.id);
      if (i(`Window for removed display ${t.id} was ${c ? "closed" : "not found or could not be closed"}`), !c && n && !n.isDestroyed()) {
        i(`Forcing additional cleanup for display ${t.id}`);
        try {
          n.removeAllListeners(), n.hide(), n.destroy(), E.delete(t.id);
          const a = h.indexOf(n);
          a >= 0 && h.splice(a, 1);
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
  const e = v.getAllDisplays(), s = v.getPrimaryDisplay();
  console.log("Primary display:", s), console.log("All displays:", e);
});
