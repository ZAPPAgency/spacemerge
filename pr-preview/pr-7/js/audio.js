// Godspark - synthesized audio (Web Audio API only, zero external files)
"use strict";

let audioCtx = null;
// Shared final stage EVERY sound (SFX beeps/sweeps and the music pad alike)
// routes through, instead of connecting straight to ctx.destination. Without
// this, muting on background only ever reached the music pad (see
// MusicService below) - any SFX whose decay was still in flight right as the
// app closed (e.g. the click sound from the very tap that triggered closing
// it) had no mute point at all, which is what the residual "dull thud" on
// close was actually coming from even after the pad-only fix.
let masterOutGain = null;
function ensureAudio() {
  const wasUnset = !audioCtx;
  if (!audioCtx) {
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* noop */ }
  }
  if (audioCtx && !masterOutGain) {
    masterOutGain = audioCtx.createGain();
    masterOutGain.gain.value = 1;
    masterOutGain.connect(audioCtx.destination);
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
  // Mobile browsers only allow audio (including our generative music) to
  // start from a real user gesture - this is that first gesture.
  // (Storage Access is requested separately, before boot - see main.js.)
  if (wasUnset && window.Game && Game.settings.music) MusicService.start();
  return audioCtx;
}

// Called from main.js on visibilitychange: ramps the single shared output
// gain to 0 (covers SFX and music together) so nothing is left mid-envelope
// at a non-zero amplitude for the OS to cut off abruptly when it tears down
// audio for a backgrounded/closed app - that discontinuity is the click/thud.
let suspendTimer = null;
function muteAllAudio() {
  if (!audioCtx || !masterOutGain) return;
  const now = audioCtx.currentTime;
  masterOutGain.gain.cancelScheduledValues(now);
  masterOutGain.gain.setValueAtTime(masterOutGain.gain.value, now);
  masterOutGain.gain.linearRampToValueAtTime(0, now + 0.04);
  // Beyond muting our own graph: proactively suspending the AudioContext
  // once silent stops the render thread on our terms, before the OS forces
  // the issue by tearing down the audio session on its own - which on iOS
  // can itself produce a route-change pop independent of anything a gain
  // node controls (the "unplugging a cable" sound). This can't be fully
  // ruled out from JS since it happens at the OS/WebKit layer, but ending
  // the session cleanly while already silent is the best mitigation available.
  if (suspendTimer) clearTimeout(suspendTimer);
  suspendTimer = setTimeout(() => {
    if (audioCtx && audioCtx.state === "running") audioCtx.suspend();
  }, 90);
}
function unmuteAllAudio() {
  if (suspendTimer) { clearTimeout(suspendTimer); suspendTimer = null; }
  if (!audioCtx || !masterOutGain) return;
  if (audioCtx.state === "suspended") audioCtx.resume();
  const now = audioCtx.currentTime;
  masterOutGain.gain.cancelScheduledValues(now);
  masterOutGain.gain.setValueAtTime(1, now);
}

function beep(freq, dur, type, vol) {
  if (!Game.settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (dur || 0.2));
  osc.connect(gain); gain.connect(masterOutGain);
  osc.start(); osc.stop(ctx.currentTime + (dur || 0.2));
}

function chime(freqs, gap, type, vol) {
  freqs.forEach((f, i) => setTimeout(() => beep(f, 0.18, type, vol), i * gap));
}

// Pitch-glide from freqFrom to freqTo over dur seconds - used for the merge
// sound's "converging" whoosh, distinct from the flat beeps used elsewhere.
function sweep(freqFrom, freqTo, dur, type, vol) {
  if (!Game.settings.sound) return;
  const ctx = ensureAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type || "sine";
  osc.frequency.setValueAtTime(freqFrom, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(freqTo, ctx.currentTime + dur);
  gain.gain.setValueAtTime(vol || 0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
  osc.connect(gain); gain.connect(masterOutGain);
  osc.start(); osc.stop(ctx.currentTime + dur);
}

const Sfx = {
  click() { beep(920, 0.05, "sine", 0.035); },
  // A quick rising whoosh (two tiles converging) followed by a bright two-note
  // chime (the pop of becoming one) - deliberately distinct from tap/click,
  // and scales up a little with tier so late-game fusions feel more powerful.
  merge(newTier) {
    const base = 220 + newTier * 18;
    sweep(base * 0.55, base * 1.7, 0.15, "sine", 0.085);
    setTimeout(() => chime([base * 1.7, base * 2.5], 55, "triangle", 0.08), 140);
  },
  tap() { beep(700, 0.08, "square", 0.04); },
  spawn() { beep(500, 0.12, "sine", 0.05); },
  error() { beep(140, 0.18, "sawtooth", 0.05); },
  unlock() { beep(880, 0.25, "sine", 0.07); },
  purchase() { chime([520, 780, 1040], 70, "sine", 0.06); },
  bigBang() { chime([80, 160, 320, 640, 960], 90, "sawtooth", 0.09); },
  chest() { chime([440, 660, 880], 90, "triangle", 0.07); },
  quest() { chime([660, 880], 90, "sine", 0.06); },
};

// Generative ambient pad - upbeat major-key progression (I-V-vi-IV), quiet
// and non-intrusive, entirely synthesized (no audio files). Deliberately
// avoids a low, minor-key drone (reads as sad/tense) in favor of a brighter
// register that still feels calm rather than childish.
const MusicService = (function () {
  let masterGain = null;
  let running = false;
  let timer = null;
  let sparkleTimer = null;
  let chordIndex = 0;
  const CHORD_DURATION_S = 8;
  const CHORDS = [
    [261.63, 329.63, 392.00],  // C4 E4 G4 - C major
    [196.00, 246.94, 293.66],  // G3 B3 D4 - G major
    [220.00, 261.63, 329.63],  // A3 C4 E4 - A minor (brief passing chord, not the tonic)
    [174.61, 220.00, 261.63],  // F3 A3 C4 - F major
  ];
  const SPARKLE_NOTES = [523.25, 659.25, 783.99, 880.00]; // C5 E5 G5 A5 - stays inside the current key

  function playChord(freqs, durationS) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const chordGain = ctx.createGain();
    const now = ctx.currentTime;
    chordGain.gain.setValueAtTime(0, now);
    chordGain.gain.linearRampToValueAtTime(1, now + 2);
    chordGain.gain.linearRampToValueAtTime(0, now + durationS);
    chordGain.connect(masterGain);
    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = f * (1 + (Math.random() - 0.5) * 0.003); // tiny detune, avoids a sterile/robotic pad
      osc.connect(chordGain);
      osc.start(now);
      osc.stop(now + durationS + 0.1);
    });
  }

  function playSparkle() {
    if (!running || !Game.settings.music) return;
    const ctx = ensureAudio();
    if (ctx) {
      const note = SPARKLE_NOTES[Math.floor(Math.random() * SPARKLE_NOTES.length)];
      const gain = ctx.createGain();
      const now = ctx.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.6, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.4);
      gain.connect(masterGain);
      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.value = note;
      osc.connect(gain);
      osc.start(now);
      osc.stop(now + 1.5);
    }
    sparkleTimer = setTimeout(playSparkle, 5000 + Math.random() * 6000);
  }

  function scheduleNext() {
    if (!running) return;
    playChord(CHORDS[chordIndex % CHORDS.length], CHORD_DURATION_S);
    chordIndex++;
    timer = setTimeout(scheduleNext, (CHORD_DURATION_S - 1.5) * 1000);
  }

  const MASTER_LEVEL = 0.026; // quiet ambience, well under the SFX

  return {
    start() {
      if (running) return;
      const ctx = ensureAudio();
      if (!ctx) return;
      if (!masterGain) {
        masterGain = ctx.createGain();
        masterGain.gain.value = MASTER_LEVEL;
        masterGain.connect(masterOutGain); // shared final mute point - see muteAllAudio() above
      }
      running = true;
      scheduleNext();
      sparkleTimer = setTimeout(playSparkle, 4000);
    },
    stop() {
      running = false;
      if (timer) clearTimeout(timer);
      if (sparkleTimer) clearTimeout(sparkleTimer);
      timer = null; sparkleTimer = null;
    },
    setEnabled(on) { if (on) this.start(); else this.stop(); },
  };
})();

// Global settings reference filled by main.js at boot (Game = window.Game)
window.Game = window.Game || { settings: { sound: true, music: true } };

// HapticService: no-op on web; the same call sites are ready for
// Capacitor's Haptics plugin (impact/notification) once wrapped natively.
const HapticService = {
  impact(type) { /* type: 'light' | 'medium' | 'heavy' | 'success' — no-op on web */ },
};
