#!/usr/bin/env node
// =============================================================================
// tools/sfx.js — renders the sound-effects track for the Diwali card.
//
//   node tools/sfx.js            → writes sfx.wav in the project folder
//
// Output: ONE 37-second WAV (44.1 kHz, 16-bit, stereo) with every sound placed
// at the exact moment its event happens on screen. No dependencies: the
// synthesiser, mixer and WAV writer are all below in plain Node.
//
// The sounds are chiptune-style, built the same way as reference/js/audio.js
// (cardiHero): square / triangle oscillators and filtered noise, each shaped
// by an envelope. The difference is that WebAudio played them live in the
// browser, while here we calculate every sample ourselves and write a file.
//
// File layout:
//   1. Timeline mirror   – converts "scene N, t seconds in" to video seconds
//   2. CUE TABLE         – every sound and its time (edit this to tweak!)
//   3. Synth engine      – oscillators, noise, filters, envelopes, panning
//   4. Sound library     – rumble, boom, twang, bell, ting, rocket, …
//   5. Render            – mix all cues, fade out, normalise, write WAV
// =============================================================================
'use strict';
const fs = require('fs');
const path = require('path');

// =============================================================================
// 1. TIMELINE MIRROR — copied from js/main.js and js/scenes.js
// =============================================================================
// main.js: FPS = 30, each scene lasts Math.round(dur * FPS) frames, and frame f
// shows scene progress p = (f - start) / (frames - 1). Scenes use t = p * dur.
// Solving for f:  f = start + t * (frames - 1) / dur,  and seconds = f / 30.
// So at(scene, t) gives the EXACT video time the renderer shows that moment.
const FPS = 30;
const SCENE_DURS = [4, 8, 5, 5, 5, 4, 6];        // scenes.js SCENES[].dur (1..7)
const SCENE_START = [];
{ let acc = 0; for (const d of SCENE_DURS) { SCENE_START.push(acc); acc += Math.round(d * FPS); } }
function at(scene, t) {
  const d = SCENE_DURS[scene - 1], frames = Math.round(d * FPS);
  return (SCENE_START[scene - 1] + (t * (frames - 1)) / d) / FPS;
}
const LENGTH = 37;                                   // seconds (1110 frames)

// Data copied from js/scenes.js (if you change the visuals, update these too)
const ROCKETS3 = [[2.0, 120], [2.25, 340], [2.55, 240], [2.85, 60], [3.1, 410],     // scene 3 ROCKETS
  [3.35, 180], [3.6, 300], [3.85, 440], [4.05, 100], [4.3, 260]];                    //  [launch t, x]
const RISE3 = 0.65;                                                                   // FX.firework rise
const ANAARS3 = [[70, 2.1], [190, 2.3], [300, 2.2], [420, 2.4]];                     // ANAARS [x, lit t]
const RANGOLI = [[8, 0], [8, Math.PI / 8], [16, 0], [16, Math.PI / 16]];            // [count, angle offset]
const RANGOLI_T0 = 1.0, PETAL_GAP = 0.05;
const ROCKETS7 = [[1.6, 70], [2.1, 410], [2.7, 110], [3.1, 380], [3.6, 40],          // scene 7 ROCKETS7
  [4.0, 440], [4.5, 140], [4.9, 350]];
const RISE7 = 0.7;
const TITLE = 'HAPPY DIWALI', T_TITLE = 1.3, PER_TITLE = 0.09;
const BYLINE = 'FROM ABHIRAM TAWALARE', T_BY = 2.5, PER_BY = 0.035;
const T_FADE = 5.25;                                                                  // scene 7 fade start

const panX = (x) => Math.max(-1, Math.min(1, x / 240 - 1)) * 0.8;   // screen x → stereo pan

// =============================================================================
// 2. CUE TABLE — [video seconds, sound name, options]
//    Each time is written as at(scene, seconds-into-scene) using the same
//    constants as scenes.js, so the comments tell you where it comes from.
//    `vol` multiplies a sound's default loudness (1 = default).
// =============================================================================
const CUES = [
  // ---- Scene 1 · RAVANA ------------------------------------------- (LAND = 1.45)
  [at(1, 0.00), 'rumble', { dur: at(1, 1.45) }],                         // from 0 s, builds to the landing
  [at(1, 0.15), 'spinWhoosh', { dur: at(1, 1.45) - at(1, 0.15), turns: 2 }], // spin = seg(t, 0.15, LAND), 2 turns
  [at(1, 1.45), 'boom', {}],                                             // LAND
  [at(1, 1.80), 'evilLaugh', {}],                                        // eyes ignite: seg(t, LAND+0.35, …)

  // ---- Scene 2 · RAMA --------------- (CUT_B = 2.4, CUT_C = 5.4, power = seg(u, 0.4, 2.6))
  [at(2, 0.00), 'swish', {}],                                            // walk-in starts
  [at(2, 2.80), 'bowCreak', { dur: at(2, 5.0) - at(2, 2.8) }],           // CUT_B+0.4 → CUT_B+2.6
  // lightning arcs re-seed every 2 frames (Math.floor(u * 15)); one crackle per new arc shape
  ...Array.from({ length: 39 }, (_, i) => {
    const u = (i + 6) / 15;                                              // u = 0.4 … 2.93
    return [at(2, 2.4 + u), 'crackle', { power: Math.min(1, Math.max(0, (u - 0.4) / 2.2)), seed: i }];
  }),
  [at(2, 5.40), 'twang', {}],                                            // CUT_C: release
  [at(2, 5.40), 'releaseWhoosh', {}],

  // ---- Scene 3 · VICTORY ----------------------------------------- (HIT = 0.15, BURST = 0.55)
  [at(3, 0.15), 'impact', {}],                                           // arrow strikes
  [at(3, 0.55), 'explosion', {}],                                        // Ravana bursts
  [at(3, 0.85), 'fireRoar', {                                            // fire: rise 0.85→1.4, calm 1.75→2.6
    dur: at(3, 5) - at(3, 0.85),
    env: [[at(3, 0.85), 0], [at(3, 1.4), 1], [at(3, 1.75), 1], [at(3, 2.6), 0.3], [at(3, 5), 0.2]],
  }],
  ...ROCKETS3.map(([t0, x], i) => [at(3, t0), 'rocket', { rise: at(3, t0 + RISE3) - at(3, t0), pan: panX(x), seed: 30 + i }]),
  ...ANAARS3.map(([x, lit], i) => [at(3, lit), 'anaar', { dur: at(3, 5) - at(3, lit), pan: panX(x), seed: 40 + i }]),

  // ---- Scene 4 · SITA ---------------------------- (kIn = seg(t, 0.5, 0.9), RANGOLI_T0 = 1.0)
  [at(4, 0.50), 'bell', { f: 1047, vol: 1 }],                            // Sita appears
  [at(4, 0.80), 'ting', { f: 1568, pan: 0 }],                            // centre flower: seg(t, T0-0.2, …)
  ...rangoliCues(),                                                      // 48 petals, 0.05 s apart
  [at(4, RANGOLI_T0 + 48 * PETAL_GAP), 'shimmer', {}],                   // outer ring of dots completes

  // ---- Scene 5 · AYODHYA ------------------- (viman x = lerp(-80, 560, t/5); diya t0 = 0.5 + x/480·3)
  [at(5, 0.00), 'vimanWhoosh', { dur: at(5, 5) - at(5, 0) }],
  ...diyaCues(),                                                         // one rising ting per riverbank diya

  // ---- Scene 6 · COURT --------------------------------------------------------------
  [at(6, 0.15), 'fanfare', {}],                                          // just after the 0.2 s crossfade

  // ---- Scene 7 · TEMPLE + TITLE ---------- (corridor exit = 1.25, T_TITLE = 1.3, T_BY = 2.5)
  [at(7, 1.25), 'templeBell', { f: 523 }],                               // camZ reaches the temple
  [at(7, 1.75), 'templeBell', { f: 523, vol: 0.7 }],
  ...typingCues(TITLE, T_TITLE, PER_TITLE, 880, 1),
  ...typingCues(BYLINE, T_BY, PER_BY, 1320, 0.6),
  ...ROCKETS7.map(([t0, x], i) => [at(7, t0), 'rocket', { rise: at(7, t0 + RISE7) - at(7, t0), pan: panX(x), seed: 70 + i }]),
];
const FADE_START = at(7, T_FADE);   // audio fades out with the picture, silent at 37 s

function rangoliCues() {
  const out = [];
  const ringNotes = [1047, 1175, 1319, 1568];           // C6 D6 E6 G6 — each ring a little higher
  let n = 0;
  RANGOLI.forEach(([count, off], ring) => {
    for (let i = 0; i < count; i++) {
      const ang = off + (i / count) * Math.PI * 2;
      const f = ringNotes[ring] * (i % 2 ? 1.5 : 1);     // alternate root / fifth = sparkly
      out.push([at(4, RANGOLI_T0 + (n++) * PETAL_GAP), 'ting', { f, pan: Math.cos(ang) * 0.7, vol: 0.8 }]);
    }
  });
  return out;
}
function diyaCues() {
  const xs = [];
  for (let x = 6; x < 480; x += 12) xs.push(x);          // scenes.js: riverbank diyas
  return xs.map((x, i) => [at(5, 0.5 + (x / 480) * 3.0), 'diyaTing', { i, n: xs.length, pan: panX(x) }]);
}
function typingCues(text, t0, per, f, vol) {
  const out = [];
  [...text].forEach((ch, i) => {                         // Font.typed: letter i appears at t0 + i·per
    if (ch !== ' ') out.push([at(7, t0 + i * per), 'blip', { f: f * (i % 3 === 1 ? 1.125 : 1), vol }]);
  });
  return out;
}

// =============================================================================
// 3. SYNTH ENGINE
// =============================================================================
const SR = 44100;
const N = Math.round(LENGTH * SR);
const L = new Float32Array(N), R = new Float32Array(N);

// Deterministic noise: same seed → same hiss every run (like FX.hash in the visuals).
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}

// Add one sample at index i with equal-power panning (-1 left … +1 right).
function add(i, v, pan) {
  if (i < 0 || i >= N) return;
  const a = (Math.max(-1, Math.min(1, pan)) + 1) * Math.PI / 4;
  L[i] += v * Math.cos(a);
  R[i] += v * Math.sin(a);
}
const val = (x, tr) => (typeof x === 'function' ? x(tr) : x);   // number or function of time

// Envelope from breakpoints [[time, gain], …], straight lines between them.
function envPoints(points) {
  return (tr) => {
    if (tr <= points[0][0]) return points[0][1];
    for (let k = 1; k < points.length; k++) {
      const [t1, g1] = points[k];
      if (tr <= t1) { const [t0, g0] = points[k - 1]; return g0 + ((g1 - g0) * (tr - t0)) / (t1 - t0 || 1); }
    }
    return points[points.length - 1][1];
  };
}
// The reference's envelope: start at full volume, decay exponentially to 0.001.
// A 3 ms fade-in avoids a click at the start.
const expDecay = (dur) => (tr) => Math.min(1, tr / 0.003) * Math.exp((Math.log(0.001) * tr) / dur);

// Oscillator shapes, phase in cycles (0..1)
const WAVES = {
  square: (p) => (p < 0.5 ? 1 : -1),
  pulse25: (p) => (p < 0.25 ? 1 : -1),        // thinner, nasal NES-style tone
  triangle: (p) => 4 * Math.abs(p - 0.5) - 1,
  saw: (p) => 2 * p - 1,
  sine: (p) => Math.sin(2 * Math.PI * p),
};

// tone(): one oscillator note.  Options mirror reference/js/audio.js:
//   type, vol, slide (frequency multiplier reached at the end, exponential),
//   plus vib / vibHz (vibrato), env (custom envelope fn), pan (number or fn).
function tone(t0, freq, dur, o = {}) {
  const wave = WAVES[o.type || 'square'];
  const env = o.env || expDecay(dur);
  const vol = o.vol ?? 1;
  const start = Math.round(t0 * SR), n = Math.round(dur * SR);
  let ph = 0;
  for (let i = 0; i < n; i++) {
    const tr = i / SR;
    let f = freq * (o.slide ? Math.pow(o.slide, tr / dur) : 1);
    if (o.vib) f *= 1 + o.vib * Math.sin(2 * Math.PI * (o.vibHz || 6) * tr);
    ph += f / SR; ph -= Math.floor(ph);
    add(start + i, wave(ph) * env(tr) * vol, val(o.pan || 0, tr));
  }
}

// noise(): filtered white noise.
//   lp: low-pass cutoff in Hz (number or fn of time) — lower = darker, rumblier
//   hp: high-pass cutoff in Hz — higher = thinner, hissier
// Each filter is a "one-pole" filter run twice for a steeper slope:
//   y += a · (x − y),  with a = 1 − e^(−2π·fc/SR)
function noise(t0, dur, o = {}) {
  const rand = rng(o.seed ?? 7);
  const env = o.env || expDecay(dur);
  const vol = o.vol ?? 1;
  const start = Math.round(t0 * SR), n = Math.round(dur * SR);
  let l1 = 0, l2 = 0, h1 = 0, h2 = 0;
  const coef = (fc) => 1 - Math.exp((-2 * Math.PI * Math.min(fc, SR * 0.45)) / SR);
  const aH = o.hp ? coef(o.hp) : 0;
  for (let i = 0; i < n; i++) {
    const tr = i / SR;
    let x = rand() * 2 - 1;
    if (o.lp) { const a = coef(val(o.lp, tr)); l1 += a * (x - l1); l2 += a * (l1 - l2); x = l2; }
    if (o.hp) { h1 += aH * (x - h1); h2 += aH * (h1 - h2); x = x - h2; }
    add(start + i, x * env(tr) * vol, val(o.pan || 0, tr));
  }
}

// =============================================================================
// 4. SOUND LIBRARY — each takes (start time, options)
//    Rough loudness plan: big hits ≈ 1.0, fire/fireworks ≈ 0.5,
//    whooshes ≈ 0.35, bells ≈ 0.3, tings ≈ 0.12, blips ≈ 0.08.
// =============================================================================
const S = {
  // low, growing earthquake rumble under Ravana's entrance
  rumble(t, o) {
    const env = envPoints([[0, 0], [0.4, 0.6], [o.dur, 1], [o.dur + 0.4, 0]]);
    noise(t, o.dur + 0.4, { lp: 110, vol: 1.6, env, seed: 1 });
    tone(t, 38, o.dur + 0.4, { type: 'triangle', slide: 1.4, vol: 0.45, env });
  },
  // whooshes that peak each time Ravana turns edge-on (scaleX passes 0)
  spinWhoosh(t, o) {
    const shape = (tr) => Math.abs(Math.sin((tr / o.dur) * o.turns * 2 * Math.PI));
    const env = (tr) => Math.pow(shape(tr), 1.5) * (0.4 + 0.6 * (tr / o.dur));
    noise(t, o.dur, { lp: (tr) => 300 + 3000 * shape(tr), hp: 150, vol: 0.9, env, seed: 2,
      pan: (tr) => Math.sin((tr / o.dur) * o.turns * 2 * Math.PI) * 0.5 });
  },
  // landing: deep boom with a falling pitch
  boom(t) {
    noise(t, 1.3, { lp: (tr) => 900 * Math.exp(-tr * 3) + 70, vol: 2.2, seed: 3 });
    tone(t, 72, 1.0, { type: 'triangle', slide: 0.45, vol: 1.0 });
    tone(t, 110, 0.4, { type: 'square', slide: 0.3, vol: 0.45 });
  },
  // "MWA-HA-HA-HA-HA": a long note then quick falling pulses, with vibrato
  evilLaugh(t) {
    const notes = [[0, 196, 0.24], [0.3, 233, 0.1], [0.44, 220, 0.1], [0.58, 208, 0.1], [0.72, 196, 0.1], [0.86, 175, 0.18]];
    for (const [dt, f, d] of notes) {
      const env = envPoints([[0, 0], [0.01, 1], [d * 0.6, 0.8], [d, 0]]);
      tone(t + dt, f, d, { type: 'pulse25', vol: 0.32, vib: 0.03, vibHz: 9, slide: 0.92, env });
      tone(t + dt, f / 2, d, { type: 'triangle', vol: 0.25, env });
      noise(t + dt, 0.04, { lp: 2500, vol: 0.15, seed: Math.round(f) });   // the breathy "h"
    }
  },
  // Rama strides in from the left
  swish(t) {
    const env = envPoints([[0, 0], [0.25, 1], [0.5, 0]]);
    noise(t, 0.5, { lp: (tr) => 1500 + tr * 9000, hp: 600, vol: 0.5, env, seed: 4, pan: (tr) => -0.8 + tr * 1.6 });
  },
  // bowstring under tension: wooden creak clicks speeding up + a rising hum
  bowCreak(t, o) {
    let tr = 0;
    while (tr < o.dur) {
      const p = tr / o.dur;
      tone(t + tr, 170 + p * 80, 0.025, { type: 'square', vol: 0.09 + p * 0.07, slide: 0.7 });
      tr += 1 / (10 + p * 26);
    }
    tone(t, 110, o.dur, { type: 'triangle', slide: 1.5, vol: 0.12, env: envPoints([[0, 0], [o.dur * 0.8, 1], [o.dur, 0.6]]) });
  },
  // one electric zap; louder as the bow's power builds
  crackle(t, o) {
    const r = rng(100 + o.seed);
    const pan = (r() - 0.5) * 0.6, p = o.power;
    tone(t, 1500 + r() * 1700, 0.04, { type: 'square', slide: 0.35, vol: 0.05 + 0.12 * p, pan });
    noise(t, 0.035, { hp: 3000, vol: 0.08 + 0.2 * p, seed: 200 + o.seed, pan });
  },
  // string snaps: a pluck that wobbles
  twang(t) {
    tone(t, 196, 0.5, { type: 'triangle', slide: 0.85, vib: 0.05, vibHz: 18, vol: 0.6 });
    tone(t, 392, 0.12, { type: 'square', slide: 0.5, vol: 0.3 });
    noise(t, 0.05, { hp: 2000, vol: 0.4, seed: 5 });
  },
  // the arrow leaves, left to right
  releaseWhoosh(t) {
    noise(t, 0.6, { lp: (tr) => 5000 * Math.exp(-tr * 3.5) + 500, hp: 200, vol: 0.7, seed: 6,
      env: envPoints([[0, 0], [0.03, 1], [0.6, 0]]), pan: (tr) => -0.3 + tr * 2 });
  },
  // arrow hits Ravana: sharp crack
  impact(t) {
    noise(t, 0.3, { lp: 6000, vol: 1.3, seed: 8 });
    tone(t, 160, 0.3, { type: 'square', slide: 0.3, vol: 0.6 });
  },
  // Ravana bursts: the biggest sound in the film, wide and long, with debris pops
  explosion(t) {
    for (const [seed, pan] of [[9, -0.5], [10, 0.5]]) {
      noise(t, 2.4, { lp: (tr) => 3000 * Math.exp(-tr * 1.8) + 120, vol: 2.0, seed, pan });
    }
    tone(t, 55, 1.5, { type: 'triangle', slide: 0.5, vol: 1.1 });
    tone(t, 82, 0.5, { type: 'square', slide: 0.25, vol: 0.5 });
    const r = rng(11);
    for (let i = 0; i < 30; i++) noise(t + 0.1 + r() * 1.5, 0.02, { hp: 2500, vol: 0.25, seed: 300 + i, pan: r() * 2 - 1 });
  },
  // the fire wall: a roaring body plus random crackles, following the visual envelope
  fireRoar(t, o) {
    const env = envPoints(o.env.map(([gt, g]) => [gt - t, g]));
    noise(t, o.dur, { lp: 700, vol: 1.1, env, seed: 12, pan: -0.4 });
    noise(t, o.dur, { lp: 700, vol: 1.1, env, seed: 13, pan: 0.4 });
    noise(t, o.dur, { lp: 4000, hp: 1200, vol: 0.25, env, seed: 14 });
    const r = rng(15);
    for (let i = 0; i < 90; i++) {
      const tr = r() * o.dur;
      noise(t + tr, 0.015, { hp: 2000, vol: 0.4 * env(tr), seed: 400 + i, pan: r() * 2 - 1 });
    }
  },
  // firework rocket: quiet whistle up, POP, then a crackling tail
  rocket(t, o) {
    const r = rng(500 + o.seed);
    tone(t, 700, o.rise, { type: 'triangle', slide: 2.2, vol: 0.07, pan: o.pan,
      env: envPoints([[0, 0], [0.05, 1], [o.rise, 0.6]]) });
    const tp = t + o.rise;
    noise(tp, 0.35, { lp: 4000, vol: 0.9, seed: 600 + o.seed, pan: o.pan });
    tone(tp, 120, 0.18, { type: 'square', slide: 0.4, vol: 0.4, pan: o.pan });
    for (let i = 0; i < 18; i++) {
      noise(tp + 0.15 + r() * 1.05, 0.015, { hp: 3000, vol: 0.15, seed: 700 + o.seed * 20 + i, pan: o.pan + (r() - 0.5) * 0.6 });
    }
  },
  // anaar fountain: steady sparkly hiss for as long as it burns
  anaar(t, o) {
    const env = envPoints([[0, 0], [0.3, 1], [o.dur - 0.2, 1], [o.dur, 0]]);
    noise(t, o.dur, { hp: 2500, lp: 9000, vol: 0.12, env, seed: 800 + o.seed, pan: o.pan });
    const r = rng(900 + o.seed);
    for (let i = 0; i < o.dur * 25; i++) noise(t + r() * o.dur, 0.01, { hp: 4000, vol: 0.07, seed: 1000 + o.seed * 100 + i, pan: o.pan });
  },
  // soft bell: triangle fundamental + inharmonic sine partials (that's what makes a bell)
  bell(t, o) {
    const f = o.f || 1047, v = 0.35 * (o.vol ?? 1);
    tone(t, f, 2.2, { type: 'triangle', vol: v });
    [[2.0, 0.45, 1.6], [2.76, 0.3, 1.1], [5.4, 0.15, 0.6]].forEach(([ratio, amp, d]) => tone(t, f * ratio, d, { type: 'sine', vol: v * amp }));
  },
  // a small sparkle "ting"
  ting(t, o) {
    const v = 0.12 * (o.vol ?? 1);
    tone(t, o.f, 0.16, { type: 'triangle', vol: v, pan: o.pan || 0 });
    tone(t, o.f * 2, 0.08, { type: 'sine', vol: v * 0.5, pan: o.pan || 0 });
  },
  // the rangoli's outer ring closing: a quick upward run of tings
  shimmer(t) {
    [1568, 1760, 2093, 2349, 2637].forEach((f, i) => S.ting(t + i * 0.06, { f, pan: -0.6 + i * 0.3, vol: 0.9 }));
  },
  // Pushpak Viman: airy whoosh that travels left → right with the chariot
  vimanWhoosh(t, o) {
    const env = (tr) => envPoints([[0, 0], [0.8, 1], [o.dur - 0.6, 1], [o.dur, 0]])(tr) * (0.8 + 0.2 * Math.sin(tr * 4.4));
    const pan = (tr) => Math.max(-1, Math.min(1, ((-80 + (640 * tr) / o.dur) - 240) / 260)); // follows vx
    noise(t, o.dur, { lp: 900, vol: 0.5, env, seed: 16, pan });
    noise(t, o.dur, { lp: 3500, hp: 1200, vol: 0.18, env, seed: 17, pan });
  },
  // a diya lights: tiny "fff" + a ting whose pitch rises along the row
  diyaTing(t, o) {
    const f = 523 * Math.pow(2, (1.5 * o.i) / (o.n - 1));   // 1.5 octaves, left → right
    noise(t, 0.04, { hp: 4000, vol: 0.05, seed: 1100 + o.i, pan: o.pan });
    S.ting(t, { f, pan: o.pan, vol: 0.85 });
  },
  // royal fanfare: square-wave melody over a triangle bass, cymbal on the last note
  fanfare(t) {
    [[0, 523, 0.14], [0.12, 659, 0.14], [0.24, 784, 0.14], [0.36, 1047, 0.3], [0.66, 784, 0.12], [0.78, 1047, 0.6]]
      .forEach(([dt, f, d]) => tone(t + dt, f, d, { type: 'square', vol: 0.22, env: envPoints([[0, 0], [0.01, 1], [d * 0.7, 0.7], [d, 0]]) }));
    [[0, 131, 0.36], [0.36, 196, 0.42], [0.78, 262, 0.7]]
      .forEach(([dt, f, d]) => tone(t + dt, f, d, { type: 'triangle', vol: 0.35, env: envPoints([[0, 0], [0.01, 1], [d * 0.8, 0.8], [d, 0]]) }));
    noise(t + 0.78, 0.6, { hp: 5000, vol: 0.18, seed: 18 });
  },
  // big temple bell: lower, longer, with a low "hum" partial
  templeBell(t, o) {
    const f = o.f || 523, v = 0.45 * (o.vol ?? 1);
    tone(t, f, 3.0, { type: 'triangle', vol: v });
    tone(t, f * 0.5, 3.2, { type: 'sine', vol: v * 0.5 });
    [[2.0, 0.4, 2.2], [2.76, 0.3, 1.5], [5.4, 0.15, 0.7]].forEach(([ratio, amp, d]) => tone(t, f * ratio, d, { type: 'sine', vol: v * amp }));
    noise(t, 0.03, { hp: 3000, vol: 0.2, seed: 19 });     // the strike
  },
  // typewriter blip for each letter
  blip(t, o) {
    tone(t, o.f, 0.035, { type: 'square', vol: 0.08 * (o.vol ?? 1) });
  },
};

// =============================================================================
// 5. RENDER
// =============================================================================
const t0 = Date.now();
const counts = {};
for (const [time, name, opts] of CUES) {
  if (!S[name]) throw new Error('Unknown sound in CUES: ' + name);
  S[name](time, opts);
  counts[name] = (counts[name] || 0) + 1;
}

// fade out together with the picture (scene 7 fades to black from T_FADE)
const fs0 = Math.round(FADE_START * SR);
for (let i = fs0; i < N; i++) {
  const k = (i - fs0) / (N - 1 - fs0);
  const g = 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, k)); // smooth 1 → 0
  L[i] *= g; R[i] *= g;
}

// normalise so the loudest sample sits at −1 dBFS: no clipping, full volume
let peak = 0;
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const target = Math.pow(10, -1 / 20);           // −1 dB ≈ 0.891
const gain = peak > 0 ? target / peak : 1;

// 16-bit PCM WAV: a 44-byte header, then interleaved L/R samples
const bytes = 44 + N * 4;
const buf = Buffer.alloc(bytes);
buf.write('RIFF', 0); buf.writeUInt32LE(bytes - 8, 4); buf.write('WAVE', 8);
buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);   // PCM
buf.writeUInt16LE(2, 22); buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28);
buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write('data', 36); buf.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) {
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * gain)) * 32767), 44 + i * 4);
  buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * gain)) * 32767), 46 + i * 4);
}
const out = path.join(__dirname, '..', 'sfx.wav');
fs.writeFileSync(out, buf);

// report (plain ASCII so every Windows terminal shows it correctly)
console.log('Cues placed:');
for (const [name, n] of Object.entries(counts)) {
  const times = CUES.filter((c) => c[1] === name).map((c) => c[0].toFixed(3));
  console.log(`  ${name.padEnd(13)} x${String(n).padEnd(3)} ${times.length > 6 ? times.slice(0, 3).join(', ') + ' ... ' + times.slice(-2).join(', ') : times.join(', ')} s`);
}
console.log(`Peak before normalising: ${peak.toFixed(3)} -> gain ${gain.toFixed(3)} (peak now -1.0 dBFS)`);
console.log(`Wrote ${out} (${(bytes / 1e6).toFixed(2)} MB, ${LENGTH} s, ${SR} Hz, 16-bit stereo) in ${Date.now() - t0} ms`);
