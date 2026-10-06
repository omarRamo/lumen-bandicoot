// Lumen Bandicoot — procedural instruments for the music sequencer.
// Melodic: (S, t, midi, dur, vel, out) → end time.  Drums: (S, t, vel, out) → end time.
// Kept deliberately light (2–5 nodes per note) for mobile CPUs.
import { mtof, rand } from './synth.js';

// ------------------------------------------------------------------------------------------- melodic
export const INST = {
  // Crash-style wooden marimba: sine + the bright 4th partial, quick decay
  marimba(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.min(0.55, 0.25 + dur * 0.4);
    S.osc('sine', f, t, d, 0.42 * v, out, { a: 0.002 });
    S.osc('sine', f * 3.93, t, 0.05, 0.14 * v, out, { a: 0.001 });
    return t + d;
  },
  // softer, rounder log/xylophone for counter-lines
  xylo(S, t, m, dur, v, out) {
    const f = mtof(m);
    S.osc('triangle', f, t, 0.18, 0.32 * v, out, { a: 0.001 });
    S.osc('sine', f * 3, t, 0.04, 0.12 * v, out, { a: 0.001 });
    return t + 0.2;
  },
  kalimba(S, t, m, dur, v, out) {
    const f = mtof(m);
    S.osc('sine', f, t, 0.6, 0.34 * v, out, { a: 0.002 });
    S.osc('sine', f * 5.4, t, 0.05, 0.08 * v, out, { a: 0.001 });
    return t + 0.6;
  },
  glock(S, t, m, dur, v, out) {
    const f = mtof(m);
    S.osc('sine', f, t, 0.9, 0.26 * v, out, { a: 0.001 });
    S.osc('sine', f * 2.76, t, 0.35, 0.09 * v, out, { a: 0.001 });
    S.osc('sine', f * 5.4, t, 0.12, 0.05 * v, out, { a: 0.001 });
    return t + 0.9;
  },
  musicbox(S, t, m, dur, v, out) {
    const f = mtof(m);
    S.osc('sine', f, t, 0.7, 0.24 * v, out, { a: 0.001 });
    S.osc('sine', f * 4, t, 0.08, 0.06 * v, out, { a: 0.001 });
    return t + 0.7;
  },
  bell(S, t, m, dur, v, out) {
    S.fm(t, mtof(m), 3.5, 1.4, 1.3, 0.22 * v, out, { indexEnd: 0.1, indexTime: 0.8 });
    return t + 1.3;
  },
  // steel pan: bright attack, slight upward blip
  pan(S, t, m, dur, v, out) {
    const f = mtof(m);
    S.osc('sine', f * 0.985, t, 0.45, 0.3 * v, out, { a: 0.003, f2: f, ft: 0.03 });
    S.osc('sine', f * 2, t, 0.25, 0.12 * v, out, { a: 0.002 });
    S.osc('sine', f * 3.02, t, 0.12, 0.06 * v, out, { a: 0.002 });
    return t + 0.45;
  },
  // Karplus-Strong family
  oud(S, t, m, dur, v, out) { S.pluck(t, m, 0.42 * v, out, 'oud', Math.max(0.35, dur + 0.25)); return t + dur + 0.25; },
  harp(S, t, m, dur, v, out) { S.pluck(t, m, 0.32 * v, out, 'harp', 1.4); return t + 1.4; },
  guitar(S, t, m, dur, v, out) { S.pluck(t, m, 0.34 * v, out, 'guitar', Math.max(0.3, dur + 0.15)); return t + dur + 0.15; },
  koto(S, t, m, dur, v, out) { S.pluck(t, m, 0.32 * v, out, 'koto', 1); return t + 1; },
  mutegtr(S, t, m, dur, v, out) { S.pluck(t, m, 0.32 * v, out, 'mute', 0.35); return t + 0.35; },

  // ney / wooden flute: sine+triangle with breathy noise and delayed vibrato
  flute(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.12, dur);
    S.osc('sine', f, t, 0.12, 0.26 * v, out, { a: 0.04, hold: d * 0.8, vib: [5.2, f * 0.012], vibDelay: 0.15 });
    S.osc('triangle', f * 2, t, 0.1, 0.03 * v, out, { a: 0.05, hold: d * 0.7 });
    S.noise(t, 0.08, 0.025 * v, out, { type: 'bandpass', f: f * 2, q: 3, a: 0.03, hold: d * 0.6 });
    return t + d + 0.15;
  },
  // cartoon whistle with a little scoop up
  whistle(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.1, dur);
    S.osc('sine', f * 0.94, t, 0.1, 0.22 * v, out, { a: 0.02, hold: d * 0.8, f2: f, ft: 0.05, vib: [6, f * 0.01], vibDelay: 0.1 });
    return t + d + 0.12;
  },
  // mezoued (Tunisian bagpipe): nasal reed, fast vibrato, bandpassed buzz
  mezoued(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.1, dur);
    const bp = S.filter('bandpass', 1300, 1.1, out, t);
    const lp = S.filter('lowpass', 3800, 0.7, bp, t);
    S.osc('custom', f, t, 0.06, 0.34 * v, lp, { wave: S.wave('reed', REED), a: 0.02, hold: d * 0.92, vib: [6.5, f * 0.008] });
    S.osc('sawtooth', f * 1.004, t, 0.06, 0.07 * v, lp, { a: 0.02, hold: d * 0.92 });
    return t + d + 0.1;
  },
  // brass section: two detuned saws through an opening lowpass
  brass(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.1, dur);
    const lp = S.filter('lowpass', f * 1.2, 1.2, out, t);
    lp.frequency.linearRampToValueAtTime(f * 6, t + 0.06);
    lp.frequency.exponentialRampToValueAtTime(f * 2.5, t + 0.06 + d);
    S.osc('sawtooth', f, t, 0.08, 0.18 * v, lp, { a: 0.025, hold: d * 0.9 });
    S.osc('sawtooth', f, t, 0.08, 0.14 * v, lp, { a: 0.03, hold: d * 0.9, detune: 9 });
    return t + d + 0.1;
  },
  // comic trombone-ish lead with a lip slide
  bone(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.1, dur);
    const lp = S.filter('lowpass', f * 3, 2, out, t);
    S.osc('sawtooth', f * 0.95, t, 0.08, 0.24 * v, lp, { a: 0.03, hold: d * 0.9, f2: f, ft: 0.06, vib: [5, f * 0.015], vibDelay: 0.2 });
    return t + d + 0.1;
  },
  // cheesy combo organ (lab, tower, villain)
  organ(S, t, m, dur, v, out) {
    const d = Math.max(0.08, dur);
    S.osc('custom', mtof(m), t, 0.05, 0.2 * v, out, { wave: S.wave('organ', ORGAN), a: 0.006, hold: d * 0.95, vib: [6.8, 1.5] });
    return t + d + 0.06;
  },
  // square lead with vibrato (chase, factory, space)
  square(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.08, dur);
    const lp = S.filter('lowpass', 2600, 1, out, t);
    S.osc('square', f, t, 0.06, 0.13 * v, lp, { a: 0.005, hold: d * 0.85, vib: [6, f * 0.01], vibDelay: 0.12 });
    return t + d + 0.07;
  },
  // bright saw lead (boss, final boss)
  saw(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.08, dur);
    const lp = S.filter('lowpass', 3200, 2, out, t);
    S.osc('sawtooth', f, t, 0.08, 0.13 * v, lp, { a: 0.005, hold: d * 0.85 });
    S.osc('sawtooth', f * 1.006, t, 0.08, 0.09 * v, lp, { a: 0.005, hold: d * 0.85 });
    return t + d + 0.09;
  },
  // theremin for the mad lab
  theremin(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.12, dur);
    S.osc('sine', f * 0.97, t, 0.14, 0.24 * v, out, { a: 0.06, hold: d * 0.8, f2: f, ft: 0.08, vib: [5.5, f * 0.03] });
    S.osc('triangle', f, t, 0.12, 0.04 * v, out, { a: 0.06, hold: d * 0.8 });
    return t + d + 0.15;
  },
  // funky clavinet: pulse through a resonant bandpass, very short
  clav(S, t, m, dur, v, out) {
    const f = mtof(m);
    const bp = S.filter('bandpass', f * 3, 3, out, t);
    bp.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.12);
    S.osc('custom', f, t, 0.13, 0.5 * v, bp, { wave: S.wave('pulse', PULSE), a: 0.002 });
    return t + 0.15;
  },
  // electric piano (FM tine)
  epiano(S, t, m, dur, v, out) {
    const f = mtof(m);
    S.fm(t, f, 1, 0.9, Math.max(0.4, dur + 0.3), 0.2 * v, out, { indexEnd: 0.05, indexTime: 0.25 });
    S.osc('sine', f * 7, t, 0.04, 0.02 * v, out);
    return t + dur + 0.3;
  },
  // disco / orchestral string stab
  strings(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.08, dur);
    const lp = S.filter('lowpass', 2400, 0.8, out, t);
    S.osc('sawtooth', f, t, 0.12, 0.1 * v, lp, { a: 0.02, hold: d * 0.8, detune: -7 });
    S.osc('sawtooth', f, t, 0.12, 0.1 * v, lp, { a: 0.02, hold: d * 0.8, detune: 7 });
    return t + d + 0.14;
  },
  // pads: slow detuned saws, darker
  pad(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.3, dur);
    const lp = S.filter('lowpass', 900, 0.6, out, t);
    S.osc('sawtooth', f, t, 0.5, 0.06 * v, lp, { a: Math.min(0.4, d * 0.3), hold: d * 0.6, detune: -9 });
    S.osc('sawtooth', f, t, 0.5, 0.06 * v, lp, { a: Math.min(0.4, d * 0.3), hold: d * 0.6, detune: 9 });
    return t + d + 0.5;
  },
  glasspad(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.3, dur);
    S.osc('sine', f, t, 0.6, 0.1 * v, out, { a: d * 0.35, hold: d * 0.5, vib: [4, f * 0.004] });
    S.osc('triangle', f * 2.001, t, 0.6, 0.03 * v, out, { a: d * 0.4, hold: d * 0.4 });
    return t + d + 0.6;
  },
  choir(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.3, dur);
    const a1 = S.filter('bandpass', 700, 4, out, t);
    const a2 = S.filter('bandpass', 1150, 5, out, t);
    const g = S.gain(1, a1); g.connect(a2);
    S.osc('sawtooth', f, t, 0.4, 0.22 * v, g, { a: Math.min(0.3, d * 0.3), hold: d * 0.6, vib: [5, f * 0.006], detune: -6 });
    S.osc('sawtooth', f, t, 0.4, 0.22 * v, g, { a: Math.min(0.3, d * 0.3), hold: d * 0.6, detune: 6 });
    return t + d + 0.4;
  },

  // ---------------------------------------------------------------------------------------- basses
  // the rubbery Crash bass: sine+triangle with a downward "boing" on the attack
  boingbass(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.min(0.5, Math.max(0.12, dur));
    S.osc('sine', f * 1.5, t, d, 0.55 * v, out, { a: 0.003, f2: f, ft: 0.05 });
    S.osc('triangle', f, t, d * 0.7, 0.18 * v, out, { a: 0.003 });
    return t + d;
  },
  // round finger bass
  bass(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.1, dur * 0.95);
    const lp = S.filter('lowpass', 600, 1.2, out, t);
    lp.frequency.exponentialRampToValueAtTime(220, t + 0.15);
    S.osc('sawtooth', f, t, 0.06, 0.32 * v, lp, { a: 0.004, hold: d * 0.8 });
    S.osc('sine', f, t, 0.06, 0.3 * v, out, { a: 0.004, hold: d * 0.8 });
    return t + d + 0.07;
  },
  // synth bass (square, resonant) — factory, chase, space
  synbass(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.08, dur * 0.9);
    const lp = S.filter('lowpass', 1500, 6, out, t);
    lp.frequency.exponentialRampToValueAtTime(180, t + 0.18);
    S.osc('square', f, t, 0.05, 0.2 * v, lp, { a: 0.003, hold: d * 0.8 });
    S.osc('sine', f / 2, t, 0.05, 0.22 * v, out, { a: 0.003, hold: d * 0.8 });
    return t + d + 0.06;
  },
  // slap bass for funk
  slap(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.08, Math.min(0.4, dur));
    const lp = S.filter('lowpass', 2400, 3, out, t);
    lp.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    S.osc('sawtooth', f, t, d, 0.3 * v, lp, { a: 0.002 });
    S.osc('sine', f, t, d, 0.3 * v, out, { a: 0.002 });
    return t + d;
  },
  // oud-ish plucked bass for the Tunisian tracks
  pluckbass(S, t, m, dur, v, out) { S.pluck(t, m, 0.6 * v, out, 'bass', Math.max(0.25, dur)); S.osc('sine', mtof(m), t, Math.max(0.15, dur * 0.8), 0.22 * v, out); return t + dur; },
  // tuba / sousaphone for the comedy bits
  tuba(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.1, dur * 0.85);
    const lp = S.filter('lowpass', 500, 1.5, out, t);
    S.osc('sawtooth', f, t, 0.08, 0.36 * v, lp, { a: 0.02, hold: d * 0.8 });
    S.osc('sine', f, t, 0.08, 0.2 * v, out, { a: 0.02, hold: d * 0.8 });
    return t + d + 0.1;
  },
  sub(S, t, m, dur, v, out) {
    const f = mtof(m);
    const d = Math.max(0.15, dur);
    S.osc('sine', f * 2, t, d, 0.6 * v, out, { a: 0.003, f2: f, ft: 0.06 });
    return t + d;
  },
  // drone (mezoued / tanpura-ish): long held tone
  drone(S, t, m, dur, v, out) {
    const f = mtof(m);
    const lp = S.filter('lowpass', 700, 0.7, out, t);
    S.osc('custom', f, t, 0.3, 0.12 * v, lp, { wave: S.wave('reed', REED), a: 0.15, hold: Math.max(0.2, dur - 0.2) });
    return t + dur + 0.3;
  },
};

const REED = [1, 0.8, 0.9, 0.5, 0.65, 0.3, 0.4, 0.2, 0.25, 0.12, 0.15, 0.08];
const ORGAN = [1, 0.75, 0.5, 0.0, 0.35, 0, 0, 0.25];
const PULSE = Array.from({ length: 16 }, (_, i) => Math.sin(((i + 1) * Math.PI) / 4) / (i + 1));

// --------------------------------------------------------------------------------------------- drums
export const DRUM = {
  // kick
  k(S, t, v, out) {
    S.osc('sine', 150, t, 0.28, 0.85 * v, out, { a: 0.001, f2: 44, ft: 0.12 });
    S.noise(t, 0.012, 0.18 * v, out, { type: 'highpass', f: 2500 });
    return t + 0.3;
  },
  // big 808 boom (boss)
  K(S, t, v, out) {
    S.osc('sine', 120, t, 0.7, 0.9 * v, out, { a: 0.001, f2: 38, ft: 0.25 });
    return t + 0.7;
  },
  s(S, t, v, out) {
    S.noise(t, 0.16, 0.42 * v, out, { type: 'highpass', f: 1400, q: 0.6 });
    S.osc('triangle', 210, t, 0.08, 0.36 * v, out, { a: 0.001, f2: 150, ft: 0.08 });
    return t + 0.18;
  },
  c(S, t, v, out) {
    for (let i = 0; i < 3; i++) S.noise(t + i * 0.011, i === 2 ? 0.14 : 0.012, 0.42 * v, out, { type: 'bandpass', f: 1300, q: 1.4 });
    return t + 0.2;
  },
  n(S, t, v, out) { S.noise(t, 0.05, 0.36 * v, out, { type: 'bandpass', f: 2200, q: 3 }); return t + 0.06; }, // finger snap
  h(S, t, v, out) { S.noise(t, 0.035, 0.18 * v, out, { type: 'highpass', f: 8000, q: 0.7 }); return t + 0.05; },
  o(S, t, v, out) { S.noise(t, 0.26, 0.16 * v, out, { type: 'highpass', f: 7200, q: 0.7, a: 0.004 }); return t + 0.3; },
  r(S, t, v, out) { S.noise(t, 0.06, 0.12 * v, out, { type: 'bandpass', f: 6000, q: 1.5, a: 0.012 }); return t + 0.08; }, // shaker
  x(S, t, v, out) { S.noise(t, 1.3, 0.18 * v, out, { type: 'highpass', f: 5000, q: 0.5 }); S.noise(t, 0.4, 0.08 * v, out, { type: 'bandpass', f: 3200, q: 1 }); return t + 1.3; },
  // tribal log drums / toms (Crash!)
  l(S, t, v, out) {
    S.osc('sine', 330, t, 0.16, 0.5 * v, out, { a: 0.001, f2: 290, ft: 0.1 });
    S.osc('triangle', 660, t, 0.04, 0.16 * v, out, { a: 0.001 });
    return t + 0.18;
  },
  L(S, t, v, out) {
    S.osc('sine', 220, t, 0.18, 0.55 * v, out, { a: 0.001, f2: 190, ft: 0.1 });
    S.osc('triangle', 440, t, 0.04, 0.16 * v, out, { a: 0.001 });
    return t + 0.2;
  },
  t(S, t, v, out) { S.osc('sine', 120, t, 0.3, 0.7 * v, out, { a: 0.002, f2: 70, ft: 0.25 }); S.noise(t, 0.03, 0.12 * v, out, { type: 'lowpass', f: 900 }); return t + 0.32; },
  T(S, t, v, out) { S.osc('sine', 190, t, 0.22, 0.6 * v, out, { a: 0.002, f2: 120, ft: 0.2 }); S.noise(t, 0.025, 0.12 * v, out, { type: 'lowpass', f: 1400 }); return t + 0.24; },
  b(S, t, v, out) { S.osc('sine', 420, t, 0.1, 0.4 * v, out, { a: 0.001, f2: 360, ft: 0.06 }); return t + 0.12; },   // bongo hi
  g(S, t, v, out) { S.osc('sine', 230, t, 0.18, 0.5 * v, out, { a: 0.001, f2: 190, ft: 0.08 }); S.noise(t, 0.02, 0.1 * v, out, { type: 'bandpass', f: 1800 }); return t + 0.2; }, // conga
  w(S, t, v, out) { S.osc('sine', 1150, t, 0.05, 0.36 * v, out, { a: 0.001 }); S.osc('sine', 1720, t, 0.03, 0.14 * v, out, { a: 0.001 }); return t + 0.06; }, // woodblock
  // darbuka: doum (low resonant), tek (sharp rim), ka (muted slap)
  d(S, t, v, out) {
    S.osc('sine', 115, t, 0.32, 0.75 * v, out, { a: 0.002, f2: 92, ft: 0.15 });
    S.osc('sine', 230, t, 0.08, 0.15 * v, out, { a: 0.002 });
    return t + 0.34;
  },
  e(S, t, v, out) {
    S.noise(t, 0.045, 0.3 * v, out, { type: 'bandpass', f: 3400, q: 2.5 });
    S.osc('sine', 820, t, 0.05, 0.2 * v, out, { a: 0.001, f2: 700, ft: 0.04 });
    return t + 0.06;
  },
  a(S, t, v, out) {
    S.noise(t, 0.035, 0.24 * v, out, { type: 'bandpass', f: 2000, q: 2 });
    S.osc('sine', 560, t, 0.03, 0.16 * v, out, { a: 0.001 });
    return t + 0.05;
  },
  // riq / tambourine: a few jingly bursts
  q(S, t, v, out) {
    S.noise(t, 0.09, 0.14 * v, out, { type: 'bandpass', f: 8200, q: 4 });
    S.noise(t + 0.012, 0.07, 0.1 * v, out, { type: 'bandpass', f: 10500, q: 5 });
    return t + 0.12;
  },
  j(S, t, v, out) { // sleigh bells (ice)
    for (let i = 0; i < 3; i++) S.noise(t + i * 0.014, 0.08, 0.1 * v, out, { type: 'bandpass', f: 9000 + i * 900, q: 9 });
    return t + 0.14;
  },
  B(S, t, v, out) { // cowbell
    const bp = S.filter('bandpass', 800, 3, out, t);
    S.osc('square', 545, t, 0.16, 0.16 * v, bp, { a: 0.001 });
    S.osc('square', 815, t, 0.16, 0.12 * v, bp, { a: 0.001 });
    return t + 0.18;
  },
  m(S, t, v, out) { // factory metal clank
    S.fm(t, rand(310, 330), 1.414, 2.2, 0.22, 0.2 * v, out, { indexEnd: 0.2 });
    S.noise(t, 0.04, 0.2 * v, out, { type: 'bandpass', f: 3000, q: 2 });
    return t + 0.25;
  },
  M(S, t, v, out) { // anvil ping
    S.fm(t, 880, 2.63, 1.6, 0.5, 0.14 * v, out, { indexEnd: 0.1 });
    return t + 0.5;
  },
  f(S, t, v, out) { // steam hiss (factory)
    S.noise(t, 0.22, 0.12 * v, out, { type: 'highpass', f: 3500, q: 0.5, a: 0.02 });
    return t + 0.25;
  },
  p(S, t, v, out) { // timpani
    S.osc('sine', 98, t, 0.9, 0.7 * v, out, { a: 0.003, f2: 92, ft: 0.3 });
    S.osc('sine', 98 * 1.5, t, 0.4, 0.2 * v, out, { a: 0.003 });
    S.noise(t, 0.05, 0.12 * v, out, { type: 'lowpass', f: 700 });
    return t + 0.9;
  },
  P(S, t, v, out) { // high timpani
    S.osc('sine', 147, t, 0.8, 0.65 * v, out, { a: 0.003, f2: 139, ft: 0.3 });
    S.noise(t, 0.05, 0.12 * v, out, { type: 'lowpass', f: 900 });
    return t + 0.8;
  },
  G(S, t, v, out) { // gong
    S.fm(t, 74, 1.47, 2.5, 2.4, 0.25 * v, out, { indexEnd: 0.3, indexTime: 1.5, a: 0.01 });
    S.noise(t, 1.2, 0.04 * v, out, { type: 'bandpass', f: 1800, q: 1, a: 0.05 });
    return t + 2.4;
  },
  z(S, t, v, out) { // zap perc (lab / space)
    S.osc('square', 1600, t, 0.08, 0.08 * v, out, { a: 0.001, f2: 200, ft: 0.08 });
    return t + 0.1;
  },
  y(S, t, v, out) { // tick (clock)
    S.osc('sine', 2400, t, 0.015, 0.2 * v, out, { a: 0.0005 });
    S.noise(t, 0.01, 0.12 * v, out, { type: 'highpass', f: 5000 });
    return t + 0.03;
  },
  u(S, t, v, out) { // tabla-ish pitched bend "dun"
    S.osc('sine', 160, t, 0.35, 0.5 * v, out, { a: 0.002, f2: 230, ft: 0.12, curve: 'lin' });
    return t + 0.36;
  },
};
