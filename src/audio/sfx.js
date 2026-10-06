// Lumen Bandicoot — every sound effect, synthesised on the fly. Cartoon, juicy, short.
// Each entry: { prio (0 footstep … 3 death/fanfare), gap (min seconds between two plays), max (concurrent),
//               play(S, t, out, p, st) → duration }   p = pitch multiplier, st = persistent state (combos).
import { mtof, rand, pick } from './synth.js';

const PENTA = [0, 2, 4, 7, 9];

// ------------------------------------------------------------------------------------------ helpers
function boom(S, t, out, size = 1, p = 1) {
  const g = S.gain(0.8, out);
  const grit = S.shaper(2.5, g);
  S.osc('sine', 95 * p, t, 0.75 * size, 0.95, g, { a: 0.002, f2: 28, ft: 0.6 * size });
  S.noise(t, 0.9 * size, 0.85, grit, { type: 'lowpass', f: 3200 * p, f2: 140, ft: 0.8 * size, q: 0.8, a: 0.002 });
  S.noise(t, 0.22, 0.5, g, { type: 'bandpass', f: 900 * p, q: 0.8 });
  for (let i = 0; i < 5; i++) S.noise(t + 0.08 + Math.random() * 0.4 * size, 0.04, 0.16, g, { type: 'bandpass', f: rand(1800, 5200), q: 3 });
  return 0.95 * size;
}

function tink(S, t, m, vol, out, len = 0.35) {
  const f = mtof(m);
  S.osc('sine', f, t, len, vol, out, { a: 0.001 });
  S.osc('sine', f * 2.01, t, len * 0.45, vol * 0.35, out, { a: 0.001 });
  S.osc('sine', f * 4.17, t, len * 0.2, vol * 0.18, out, { a: 0.001 });
}

function slideWhistle(S, t, f1, f2, dur, vol, out) {
  S.osc('sine', f1, t, 0.08, vol, out, { a: 0.03, hold: dur, f2, ft: dur, vib: [7, f1 * 0.015] });
}

/** Sad trombone note with a lowpass "wah" (optionally wobbling). */
function bone(S, t, m, dur, vol, out, wobble = false) {
  const f = mtof(m);
  const lp = S.filter('lowpass', 350, 4, out, t);
  lp.frequency.linearRampToValueAtTime(1300, t + 0.08);
  lp.frequency.linearRampToValueAtTime(700, t + dur);
  if (wobble) S.lfo(lp.frequency, 5.5, 380, t, t + dur + 0.2, 0.15);
  S.osc('sawtooth', f * 0.97, t, 0.12, vol, lp, { a: 0.04, hold: dur, f2: f, ft: 0.06, vib: wobble ? [5.5, f * 0.025] : null, vibDelay: 0.15 });
  S.osc('square', f / 2, t, 0.12, vol * 0.25, lp, { a: 0.04, hold: dur });
}

function tikiVoice(S, t, out, vol, base, scale, sad) {
  const syl = sad
    ? [{ v: 'u', d: 0.14, f0: base * 1.1, f1: base }, { v: 'a', c: 'g', d: 0.42, f0: base, f1: base * 0.62 }]
    : [{ v: 'u', d: 0.12, f0: base, f1: base * 1.08 }, { v: 'a', c: 'g', d: 0.14, f0: base * 1.25, f1: base * 1.1, gap: 0.03 },
      { v: 'u', c: 'b', d: 0.12, f0: base * 0.95, f1: base * 1.05 }, { v: 'a', c: 'g', d: 0.24, f0: base * 1.35, f1: base * 0.95 }];
  return S.voice(t, syl, vol, out, { formantScale: scale, vib: [6, base * 0.03] });
}

function chord(S, t, notes, dur, vol, out, inst = 'brass') {
  for (const m of notes) {
    const f = mtof(m);
    if (inst === 'brass') {
      const lp = S.filter('lowpass', f * 1.5, 1.2, out, t);
      lp.frequency.linearRampToValueAtTime(f * 6, t + 0.05);
      S.osc('sawtooth', f, t, 0.18, vol, lp, { a: 0.02, hold: dur });
      S.osc('sawtooth', f, t, 0.18, vol * 0.7, lp, { a: 0.02, hold: dur, detune: 10 });
    } else tink(S, t, m, vol, out, dur + 0.3);
  }
}

// ---------------------------------------------------------------------------------------------- SFX
export const SFX = {
  // ------------------------------------------------------------------ movement
  jump: { prio: 1, gap: 0.05, play(S, t, o, p) {
    S.osc('sine', 250 * p, t, 0.17, 0.55, o, { f2: 640 * p, ft: 0.12, vib: [26, 22] });
    S.osc('triangle', 500 * p, t, 0.08, 0.12, o, { f2: 1250 * p, ft: 0.08 });
    S.noise(t, 0.08, 0.08, o, { type: 'bandpass', f: 1600, f2: 3600, q: 1.5 });
    return 0.2;
  } },
  double_jump: { prio: 1, gap: 0.05, play(S, t, o, p) {
    S.osc('sine', 420 * p, t, 0.16, 0.45, o, { f2: 1050 * p, ft: 0.12, vib: [30, 30] });
    S.noise(t, 0.14, 0.13, o, { type: 'bandpass', f: 1800, f2: 5200, q: 2 });
    tink(S, t + 0.06, 91, 0.1, o, 0.2);
    return 0.25;
  } },
  land: { prio: 0, gap: 0.06, play(S, t, o, p) {
    S.osc('sine', 150 * p, t, 0.12, 0.7, o, { f2: 55, ft: 0.1 });
    S.noise(t, 0.07, 0.3, o, { type: 'lowpass', f: 700 });
    return 0.14;
  } },
  footstep: { prio: 0, gap: 0.07, max: 2, play(S, t, o, p) {
    const r = rand(0.85, 1.2) * p;
    S.noise(t, 0.035, 0.5, o, { type: 'bandpass', f: 1100 * r, q: 1.5 });
    S.osc('sine', 190 * r, t, 0.05, 0.4, o, { f2: 95, ft: 0.05 });
    return 0.05;
  } },
  // THE signature spin: rotating "wouizz" — two whooshing band-passes swirling in stereo + a vibrato whistle
  spin: { prio: 2, gap: 0.08, play(S, t, o, p) {
    const dur = 0.5;
    const pan = S.panner(0, o);
    if (pan.pan) S.lfo(pan.pan, 7, 0.75, t, t + dur + 0.1);
    const trem = S.gain(0.75, pan);
    S.lfo(trem.gain, 17, 0.35, t, t + dur + 0.1);
    const n1 = S.noise(t, 0.2, 0.55, trem, { type: 'bandpass', f: 700 * p, q: 3.5, a: 0.03, hold: 0.25 });
    n1.f.frequency.linearRampToValueAtTime(2600 * p, t + 0.22);
    n1.f.frequency.linearRampToValueAtTime(900 * p, t + dur);
    S.lfo(n1.f.frequency, 14, 500, t, t + dur + 0.1);
    const n2 = S.noise(t, 0.2, 0.25, trem, { type: 'bandpass', f: 3800 * p, q: 6, a: 0.04, hold: 0.22 });
    S.lfo(n2.f.frequency, 11, 1200, t, t + dur + 0.1);
    const w = S.osc('triangle', 520 * p, t, 0.18, 0.17, trem, { a: 0.03, hold: 0.25, vib: [16, 110] });
    w.o.frequency.linearRampToValueAtTime(1350 * p, t + 0.24);
    w.o.frequency.linearRampToValueAtTime(720 * p, t + dur);
    S.osc('sine', 180 * p, t, 0.15, 0.2, o, { a: 0.02, f2: 320 * p, ft: 0.15 });
    return dur + 0.05;
  } },
  slide: { prio: 1, gap: 0.1, play(S, t, o, p) {
    S.noise(t, 0.35, 0.4, o, { type: 'lowpass', f: 2600 * p, f2: 500, q: 1.2, a: 0.01 });
    S.noise(t, 0.12, 0.15, o, { type: 'bandpass', f: 5200, q: 2 });
    S.osc('sine', 320 * p, t, 0.25, 0.15, o, { f2: 150, ft: 0.25 });
    return 0.38;
  } },
  slam: { prio: 2, gap: 0.1, play(S, t, o, p) {
    const g = S.gain(1, o);
    S.osc('sine', 130 * p, t, 0.45, 0.95, g, { a: 0.001, f2: 33, ft: 0.35 });
    S.noise(t, 0.4, 0.6, S.shaper(2, g), { type: 'lowpass', f: 1000 * p, f2: 90, q: 1, a: 0.001 });
    S.noise(t, 0.1, 0.4, g, { type: 'bandpass', f: 450, q: 1.2 });
    for (let i = 0; i < 3; i++) S.noise(t + 0.05 + i * 0.06, 0.04, 0.15, g, { type: 'bandpass', f: rand(1500, 3000), q: 3 });
    return 0.48;
  } },

  // ------------------------------------------------------------------ crates
  crate_break: { prio: 1, gap: 0.025, max: 4, play(S, t, o, p) {
    const r = p * rand(0.88, 1.14);
    S.osc('sine', 180 * r, t, 0.1, 0.55, o, { a: 0.001, f2: 70, ft: 0.09 });
    const n = 3 + ((Math.random() * 2) | 0);
    for (let i = 0; i < n; i++) {
      const tt = t + i * rand(0.01, 0.028);
      S.noise(tt, rand(0.025, 0.06), rand(0.38, 0.55), o, { type: 'bandpass', f: rand(1100, 2700) * r, q: rand(2.5, 5) });
    }
    S.osc('sine', 540 * r, t, 0.06, 0.25, o, { a: 0.001 });
    S.osc('sine', 860 * r, t + 0.015, 0.04, 0.15, o, { a: 0.001 });
    S.noise(t + 0.03, 0.12, 0.12, o, { type: 'highpass', f: 4200 });
    return 0.18;
  } },
  crate_bounce: { prio: 1, gap: 0.04, play(S, t, o, p) {
    S.osc('sine', 640 * p, t, 0.05, 0.3, o, { a: 0.001 });
    S.osc('sine', 230 * p, t, 0.2, 0.5, o, { f2: 560 * p, ft: 0.15, vib: [22, 25] });
    return 0.22;
  } },
  crate_iron: { prio: 1, gap: 0.05, play(S, t, o, p) {
    S.fm(t, 330 * p, 1.41, 3, 0.55, 0.3, o, { indexEnd: 0.08 });
    S.fm(t, 523 * p, 2.76, 1, 0.32, 0.12, o);
    S.noise(t, 0.03, 0.25, o, { type: 'bandpass', f: 3200, q: 2 });
    S.osc('sine', 95, t, 0.08, 0.4, o);
    return 0.55;
  } },
  // firefly: crystalline tinkle climbing a pentatonic ladder while you chain pickups (wumpa-style)
  light: { prio: 1, gap: 0.02, max: 4, play(S, t, o, p, st) {
    const now = S.now;
    st.lightCombo = now - (st.lightT ?? -9) < 0.9 ? Math.min(14, (st.lightCombo || 0) + 1) : 0;
    st.lightT = now;
    const c = st.lightCombo;
    const m = 79 + PENTA[c % 5] + 12 * Math.floor(c / 5);
    const f = mtof(m) * p;
    S.fm(t, f, 3.5, 0.5, 0.28, 0.3, o, { indexEnd: 0.05, indexTime: 0.1 });
    S.osc('sine', f * 2, t + 0.03, 0.16, 0.12, o, { a: 0.001 });
    S.osc('sine', 520, t, 0.04, 0.12, o, { f2: 900, ft: 0.04 });
    if (S.verbSend) S.osc('sine', f, t, 0.3, 0.12, S.verbSend, { a: 0.001 });
    return 0.32;
  } },
  light_many: { prio: 1, gap: 0.06, play(S, t, o, p) {
    for (let i = 0; i < 6; i++) tink(S, t + i * 0.045, 84 + PENTA[i % 5] + (i >= 5 ? 12 : 0), 0.18, o, 0.25);
    S.noise(t, 0.4, 0.06, o, { type: 'highpass', f: 7000, a: 0.05 });
    return 0.55;
  } },
  life: { prio: 3, gap: 0.2, play(S, t, o, p) {
    const notes = [72, 76, 79, 84];
    notes.forEach((m, i) => {
      const last = i === notes.length - 1;
      const f = mtof(m) * p;
      const lp = S.filter('lowpass', 3200, 1, o, t);
      S.osc('square', f, t + i * 0.09, last ? 0.3 : 0.06, 0.14, lp, { a: 0.004, hold: last ? 0.25 : 0.04, vib: last ? [7, f * 0.012] : null });
      tink(S, t + i * 0.09, m + 12, 0.1, o, last ? 0.6 : 0.2);
    });
    S.osc('sine', 200, t, 0.18, 0.3, o, { f2: 500, ft: 0.15 });
    return 0.95;
  } },
  mask_get: { prio: 3, gap: 0.2, play(S, t, o, p) {
    tikiVoice(S, t + 0.05, o, 0.85, 150 * p, 1, false);
    S.osc('sine', 330, t, 0.15, 0.4, o, { a: 0.001, f2: 290, ft: 0.1 });
    S.osc('sine', 220, t + 0.08, 0.15, 0.4, o, { a: 0.001, f2: 190, ft: 0.1 });
    for (let i = 0; i < 4; i++) tink(S, t + 0.6 + i * 0.04, 84 + PENTA[i], 0.08, o, 0.3);
    return 1.0;
  } },
  mask_lose: { prio: 3, gap: 0.2, play(S, t, o, p) {
    tikiVoice(S, t + 0.05, o, 0.8, 140 * p, 1, true);
    S.noise(t, 0.5, 0.35, o, { type: 'bandpass', f: 2400, f2: 300, q: 1.5, a: 0.01 });
    S.osc('sine', 600, t, 0.3, 0.2, o, { f2: 180, ft: 0.3 });
    S.noise(t + 0.35, 0.05, 0.25, o, { type: 'bandpass', f: 900, q: 3 });
    S.noise(t + 0.45, 0.05, 0.2, o, { type: 'bandpass', f: 1300, q: 3 });
    return 0.75;
  } },
  mask_invincible: { prio: 3, gap: 0.3, play(S, t, o, p) {
    tikiVoice(S, t, o, 1, 108 * p, 0.85, false);
    S.fm(t, 74, 1.47, 2.5, 2.2, 0.3, o, { indexEnd: 0.3, indexTime: 1.4, a: 0.01 });
    for (let i = 0; i < 10; i++) tink(S, t + 0.55 + i * 0.035, 72 + PENTA[i % 5] + 12 * Math.floor(i / 5), 0.11, o, 0.3);
    S.noise(t + 0.5, 0.6, 0.12, o, { type: 'bandpass', f: 800, f2: 7000, q: 1, a: 0.2 });
    for (let i = 0; i < 4; i++) S.osc('sine', 330, t + 0.6 + i * 0.1, 0.12, 0.35, o, { a: 0.001, f2: 280, ft: 0.08 });
    return 2.2;
  } },
  checkpoint: { prio: 3, gap: 0.3, play(S, t, o, p) {
    SFX.crate_break.play(S, t, o, p);
    S.fm(t + 0.05, mtof(88) * p, 3.5, 1.1, 0.7, 0.25, o, { indexEnd: 0.05 });
    S.fm(t + 0.15, mtof(93) * p, 3.5, 1.1, 0.9, 0.25, o, { indexEnd: 0.05 });
    S.noise(t + 0.05, 0.5, 0.1, o, { type: 'bandpass', f: 1500, f2: 8000, q: 1, a: 0.1 });
    return 1.05;
  } },
  tnt_tick: { prio: 2, gap: 0.12, play(S, t, o, p) {
    S.osc('sine', 1150, t, 0.04, 0.35, o, { a: 0.001 });
    S.osc('square', 880 * p, t + 0.02, 0.1, 0.16, S.filter('lowpass', 3000, 1, o, t), { a: 0.002, hold: 0.06 });
    return 0.2;
  } },
  explosion: { prio: 3, gap: 0.06, max: 3, play(S, t, o, p) { return boom(S, t, o, 1, p); } },
  nitro_bounce: { prio: 1, gap: 0.06, max: 3, play(S, t, o, p) {
    S.osc('sine', 300 * p, t, 0.08, 0.45, o, { f2: 700 * p, ft: 0.06 });
    S.noise(t, 0.09, 0.15, o, { type: 'highpass', f: 6000 });
    S.osc('square', 1400 * p, t + 0.02, 0.03, 0.08, o, { a: 0.001 });
    S.osc('square', 1400 * p, t + 0.08, 0.03, 0.08, o, { a: 0.001 });
    return 0.13;
  } },
  switch: { prio: 2, gap: 0.1, play(S, t, o, p) {
    S.noise(t, 0.03, 0.4, o, { type: 'bandpass', f: 2000, q: 2 });
    S.osc('sine', 300, t, 0.05, 0.4, o, { f2: 150, ft: 0.05 });
    tink(S, t + 0.06, 93, 0.2, o, 0.4);
    tink(S, t + 0.13, 100, 0.12, o, 0.4);
    return 0.55;
  } },
  outline_on: { prio: 2, gap: 0.15, play(S, t, o, p) {
    [72, 76, 79, 84, 88, 91, 96].forEach((m, i) => tink(S, t + i * 0.04, m, 0.12, o, 0.35));
    S.noise(t, 0.6, 0.08, o, { type: 'bandpass', f: 1200, f2: 9000, q: 1.2, a: 0.25 });
    return 0.8;
  } },

  // ------------------------------------------------------------------ enemies & damage
  enemy_hit: { prio: 2, gap: 0.05, play(S, t, o, p) {
    S.noise(t, 0.05, 0.6, o, { type: 'bandpass', f: 1500 * p, q: 1.5 });
    S.osc('sine', 260 * p, t, 0.08, 0.6, o, { a: 0.001, f2: 120, ft: 0.08 });
    S.osc('sine', 600 * p, t + 0.06, 0.35, 0.2, o, { a: 0.02, f2: 2600 * p, ft: 0.35 });
    return 0.45;
  } },
  enemy_kick: { prio: 2, gap: 0.05, play(S, t, o, p) {
    S.osc('sine', 170 * p, t, 0.1, 0.7, o, { a: 0.001, f2: 60, ft: 0.1 });
    S.noise(t, 0.08, 0.5, o, { type: 'lowpass', f: 1300 });
    S.noise(t + 0.04, 0.25, 0.25, o, { type: 'bandpass', f: 900, f2: 4200, q: 1.5 });
    return 0.32;
  } },
  enemy_squash: { prio: 2, gap: 0.05, play(S, t, o, p) {
    S.noise(t, 0.12, 0.5, o, { type: 'bandpass', f: 900, f2: 280, q: 2 });
    S.osc('sine', 420 * p, t, 0.1, 0.45, o, { f2: 110, ft: 0.1 });
    const bp = S.filter('bandpass', 1300, 3, o, t);
    S.osc('sawtooth', 950 * p, t + 0.05, 0.1, 0.25, bp, { f2: 480 * p, ft: 0.1 });
    return 0.2;
  } },
  hurt: { prio: 3, gap: 0.2, play(S, t, o, p) {
    const bp = S.filter('bandpass', 1400, 2, o, t);
    S.osc('square', 820 * p, t, 0.14, 0.3, bp, { f2: 480 * p, ft: 0.14 });
    S.osc('sine', 520 * p, t + 0.05, 0.3, 0.35, o, { f2: 190, ft: 0.3, vib: [18, 30] });
    S.osc('sine', 120, t, 0.1, 0.5, o, { f2: 60, ft: 0.1 });
    return 0.4;
  } },

  // ------------------------------------------------------------------ comic deaths
  death_fall: { prio: 3, gap: 0.5, play(S, t, o, p) {
    slideWhistle(S, t, 1500 * p, 260 * p, 0.75, 0.3, o);
    const t2 = t + 0.75;
    bone(S, t2, 58, 0.24, 0.3, o);
    bone(S, t2 + 0.32, 57, 0.24, 0.3, o);
    bone(S, t2 + 0.64, 56, 0.24, 0.3, o);
    bone(S, t2 + 0.96, 55, 0.95, 0.32, o, true);
    return 2.15;
  } },
  death_burn: { prio: 3, gap: 0.5, play(S, t, o, p) {
    S.noise(t, 0.5, 0.6, o, { type: 'bandpass', f: 400, f2: 2600, q: 0.9, a: 0.01 });
    S.voice(t + 0.08, [{ v: 'a', d: 0.12, f0: 420 * p, f1: 700 * p }, { v: 'i', d: 0.22, f0: 700 * p, f1: 560 * p }], 0.7, o, { formantScale: 1.35 });
    for (let i = 0; i < 8; i++) S.noise(t + 0.35 + Math.random() * 0.8, 0.02, 0.2, o, { type: 'highpass', f: 3500 });
    S.noise(t + 0.3, 0.9, 0.15, o, { type: 'highpass', f: 5000, a: 0.05 });
    return 1.3;
  } },
  death_squash: { prio: 3, gap: 0.5, play(S, t, o, p) {
    S.noise(t, 0.15, 0.8, o, { type: 'lowpass', f: 1300 });
    S.osc('sine', 160 * p, t, 0.2, 0.85, o, { a: 0.001, f2: 40, ft: 0.18 });
    // pancake raspberry: buzzy deflating "pfffrrt"
    const bp = S.filter('bandpass', 1100, 2.5, o, t);
    const tr = S.gain(0.6, bp);
    S.lfo(tr.gain, 26, 0.4, t + 0.2, t + 0.9);
    S.osc('sawtooth', 640 * p, t + 0.2, 0.15, 0.45, tr, { a: 0.02, hold: 0.45, f2: 190 * p, ft: 0.55 });
    return 0.9;
  } },
  death_water: { prio: 3, gap: 0.5, play(S, t, o, p) {
    S.noise(t, 0.4, 0.65, o, { type: 'bandpass', f: 1600, f2: 380, q: 0.9, a: 0.004 });
    S.osc('sine', 180, t, 0.2, 0.5, o, { f2: 70, ft: 0.2 });
    for (let i = 0; i < 7; i++) {
      const tt = t + 0.25 + i * rand(0.08, 0.16);
      const f = rand(280, 520) * p;
      S.osc('sine', f, tt, 0.05, 0.35, o, { a: 0.003, f2: f * 2.4, ft: 0.05 });
    }
    return 1.4;
  } },
  death_zap: { prio: 3, gap: 0.5, play(S, t, o, p) {
    const bp = S.filter('bandpass', 1500, 1.2, o, t);
    const tr = S.gain(0.5, bp);
    S.lfo(tr.gain, 32, 0.5, t, t + 1, 0, 'square');
    S.osc('sawtooth', 58 * p, t, 0.1, 0.6, tr, { a: 0.005, hold: 0.8 });
    S.osc('sawtooth', 117 * p, t, 0.1, 0.4, tr, { a: 0.005, hold: 0.8 });
    for (let i = 0; i < 12; i++) S.noise(t + Math.random() * 0.85, 0.015, 0.3, o, { type: 'highpass', f: 3000 });
    S.osc('square', 3000, t, 0.4, 0.06, o, { vib: [60, 900] });
    S.noise(t + 0.95, 0.35, 0.25, o, { type: 'lowpass', f: 900, a: 0.02 }); // smoke puff
    return 1.35;
  } },
  death_explode: { prio: 3, gap: 0.5, play(S, t, o, p) {
    boom(S, t, o, 1.1, p);
    slideWhistle(S, t + 0.5, 1800, 350, 0.9, 0.22, o);
    S.osc('sine', 400, t + 1.45, 0.1, 0.35, o, { f2: 900, ft: 0.08, vib: [30, 40] }); // a shoe lands: "boing"
    return 1.7;
  } },
  death_eaten: { prio: 3, gap: 0.5, play(S, t, o, p) {
    for (const dt of [0, 0.18]) {
      S.noise(t + dt, 0.07, 0.6, o, { type: 'bandpass', f: 650, q: 1.5 });
      S.osc('sine', 130, t + dt, 0.08, 0.55, o, { f2: 70, ft: 0.08 });
    }
    S.osc('sine', 420 * p, t + 0.4, 0.25, 0.45, o, { f2: 110, ft: 0.25 }); // gloup
    S.voice(t + 0.85, [{ v: 'eu', d: 0.15, f0: 95 * p, f1: 88 * p }, { v: 'o', d: 0.35, f0: 88 * p, f1: 68 * p }], 0.95, o, { formantScale: 0.85, vib: [28, 9] });
    return 1.45;
  } },
  respawn: { prio: 2, gap: 0.3, play(S, t, o, p) {
    [72, 76, 79, 84, 88, 91].forEach((m, i) => tink(S, t + i * 0.05, m, 0.13, o, 0.35));
    S.noise(t, 0.45, 0.15, o, { type: 'bandpass', f: 500, f2: 4500, q: 1.2, a: 0.15 });
    S.osc('sine', 300, t + 0.32, 0.08, 0.3, o, { f2: 700, ft: 0.06 });
    return 0.75;
  } },
  goal: { prio: 3, gap: 0.5, play(S, t, o, p) {
    S.osc('sine', 300, t, 0.2, 0.25, o, { a: 0.05, hold: 0.45, f2: 1300, ft: 0.55, vib: [12, 25] });
    S.noise(t, 0.6, 0.15, o, { type: 'bandpass', f: 600, f2: 6000, q: 1.5, a: 0.3 });
    [84, 88, 91, 96].forEach((m, i) => tink(S, t + 0.45 + i * 0.03, m, 0.13, o, 0.8));
    return 1.4;
  } },
  sock: { prio: 3, gap: 0.2, play(S, t, o, p) {
    S.osc('sine', 1100 * p, t, 0.07, 0.2, o, { f2: 1700 * p, ft: 0.06, vib: [40, 60] }); // squeak
    tink(S, t + 0.1, 89, 0.22, o, 0.4);
    tink(S, t + 0.22, 96, 0.22, o, 0.7);
    return 0.95;
  } },
  gold_sock: { prio: 3, gap: 0.3, play(S, t, o, p) {
    [84, 88, 91, 96, 100].forEach((m, i) => tink(S, t + i * 0.06, m, 0.16, o, 0.6));
    chord(S, t + 0.3, [65, 69, 72, 77], 0.6, 0.1, o, 'brass');
    S.noise(t + 0.25, 0.8, 0.1, o, { type: 'bandpass', f: 2000, f2: 9000, q: 1, a: 0.3 });
    return 1.5;
  } },

  // ------------------------------------------------------------------ menus
  menu_move: { prio: 1, gap: 0.03, max: 2, play(S, t, o, p) {
    S.osc('sine', 1600 * p, t, 0.035, 0.5, o, { a: 0.001 });
    S.osc('sine', 1200 * p, t, 0.05, 0.3, o, { a: 0.001 });
    return 0.06;
  } },
  menu_ok: { prio: 2, gap: 0.05, play(S, t, o, p) {
    tink(S, t, 79, 0.22, o, 0.25);
    tink(S, t + 0.07, 86, 0.24, o, 0.45);
    S.noise(t, 0.02, 0.15, o, { type: 'bandpass', f: 3000, q: 2 });
    return 0.5;
  } },
  menu_back: { prio: 2, gap: 0.05, play(S, t, o, p) {
    tink(S, t, 81, 0.2, o, 0.2);
    tink(S, t + 0.07, 74, 0.2, o, 0.35);
    return 0.42;
  } },

  // ------------------------------------------------------------------ bosses
  boss_hit: { prio: 3, gap: 0.1, play(S, t, o, p) {
    S.osc('sine', 300 * p, t, 0.15, 0.8, o, { a: 0.001, f2: 80, ft: 0.14 });
    S.noise(t, 0.08, 0.6, o, { type: 'bandpass', f: 1200, q: 1.2 });
    S.fm(t, 420, 1.41, 2, 0.25, 0.18, o, { indexEnd: 0.1 });
    S.osc('sine', 190 * p, t + 0.08, 0.3, 0.35, o, { f2: 480 * p, ft: 0.25, vib: [24, 30] });
    return 0.45;
  } },
  boss_roar: { prio: 3, gap: 0.4, play(S, t, o, p) {
    const g = S.gain(1, o);
    const ws = S.shaper(3, g);
    S.voice(t, [{ v: 'a', d: 0.5, f0: 90 * p, f1: 105 * p }, { v: 'o', d: 0.6, f0: 105 * p, f1: 62 * p, tail: true }], 0.9, ws, { formantScale: 0.75, vib: [24, 14] });
    S.noise(t, 0.8, 0.3, g, { type: 'bandpass', f: 520, q: 1.5, a: 0.08, hold: 0.3 });
    S.osc('sawtooth', 55 * p, t, 0.4, 0.25, S.filter('lowpass', 300, 1, g, t), { a: 0.1, hold: 0.7 });
    return 1.4;
  } },
  boss_defeat: { prio: 3, gap: 1, play(S, t, o, p) {
    boom(S, t, o, 0.6, 1.2);
    boom(S, t + 0.3, o, 0.6, 1);
    boom(S, t + 0.6, o, 0.8, 0.85);
    slideWhistle(S, t + 0.2, 1700, 200, 1.2, 0.2, o);
    chord(S, t + 1.5, [65, 69, 72, 77], 0.7, 0.12, o, 'brass');
    [84, 88, 91, 96].forEach((m, i) => tink(S, t + 1.5 + i * 0.05, m, 0.1, o, 0.8));
    return 2.6;
  } },

  // ------------------------------------------------------------------ hazards & world
  laser: { prio: 1, gap: 0.08, max: 3, play(S, t, o, p) {
    S.osc('square', 2400 * p, t, 0.18, 0.18, S.filter('lowpass', 5000, 1, o, t), { a: 0.001, f2: 300 * p, ft: 0.18 });
    S.fm(t, 1200 * p, 1.5, 2, 0.25, 0.12, o, { f2: 400 * p, ft: 0.25 });
    return 0.3;
  } },
  fire: { prio: 1, gap: 0.1, max: 3, play(S, t, o, p) {
    const n = S.noise(t, 0.3, 0.5, o, { type: 'lowpass', f: 400 * p, q: 1, a: 0.04, hold: 0.25 });
    n.f.frequency.linearRampToValueAtTime(1900 * p, t + 0.2);
    n.f.frequency.linearRampToValueAtTime(600, t + 0.6);
    for (let i = 0; i < 4; i++) S.noise(t + Math.random() * 0.5, 0.02, 0.18, o, { type: 'highpass', f: 3000 });
    S.osc('sine', 70, t, 0.3, 0.3, o, { a: 0.05, hold: 0.2 });
    return 0.62;
  } },
  splash: { prio: 1, gap: 0.08, max: 3, play(S, t, o, p) {
    S.noise(t, 0.3, 0.55, o, { type: 'bandpass', f: 2000 * p, f2: 500, q: 0.8 });
    for (let i = 0; i < 4; i++) { const f = rand(700, 1300) * p; S.osc('sine', f, t + 0.08 + i * rand(0.04, 0.08), 0.04, 0.2, o, { f2: f * 2, ft: 0.04 }); }
    return 0.45;
  } },
  spring: { prio: 2, gap: 0.06, play(S, t, o, p) {
    S.osc('sine', 210 * p, t, 0.5, 0.5, o, { f2: 560 * p, ft: 0.18, vib: [21, 70] });
    S.fm(t, 880 * p, 2.1, 0.6, 0.25, 0.08, o);
    S.noise(t, 0.03, 0.2, o, { type: 'bandpass', f: 2500, q: 2 });
    return 0.55;
  } },
  crumble: { prio: 1, gap: 0.1, max: 3, play(S, t, o, p) {
    for (let i = 0; i < 6; i++) S.noise(t + Math.random() * 0.5, rand(0.08, 0.15), rand(0.2, 0.4), o, { type: 'lowpass', f: rand(600, 1300) * p, q: 1.5 });
    S.osc('sine', 60, t, 0.4, 0.4, o, { a: 0.05, hold: 0.2 });
    return 0.7;
  } },
  wind: { prio: 1, gap: 0.3, max: 2, play(S, t, o, p) {
    const n = S.noise(t, 0.6, 0.6, o, { type: 'bandpass', f: 400 * p, q: 1.5, a: 0.35, hold: 0.4 });
    n.f.frequency.linearRampToValueAtTime(1200 * p, t + 0.6);
    n.f.frequency.linearRampToValueAtTime(500 * p, t + 1.35);
    S.noise(t, 0.6, 0.06, o, { type: 'bandpass', f: 2500 * p, f2: 1600 * p, q: 9, a: 0.4, hold: 0.3 });
    return 1.4;
  } },
  rumble: { prio: 2, gap: 0.4, max: 2, play(S, t, o, p) {
    const g = S.gain(0.7, o);
    S.lfo(g.gain, 8, 0.3, t, t + 1.8);
    S.noise(t, 0.8, 0.8, g, { type: 'lowpass', f: 170 * p, q: 1, a: 0.1, hold: 0.7 });
    S.osc('sine', 42 * p, t, 0.8, 0.6, g, { a: 0.1, hold: 0.7 });
    return 1.7;
  } },
  // clown horn "pouet-pouet"
  honk: { prio: 2, gap: 0.2, play(S, t, o, p) {
    for (const dt of [0, 0.19]) {
      const bp = S.filter('bandpass', 950, 1.8, o, t + dt);
      S.osc('square', 420 * p, t + dt, 0.06, 0.35, bp, { a: 0.01, hold: 0.1, f2: 470 * p, ft: 0.05 });
      S.osc('square', 527 * p, t + dt, 0.06, 0.22, bp, { a: 0.01, hold: 0.1 });
    }
    return 0.42;
  } },
  meow: { prio: 2, gap: 0.25, play(S, t, o, p) {
    S.voice(t, [{ v: 'i', c: 'm', d: 0.12, f0: 540 * p, f1: 720 * p }, { v: 'a', d: 0.18, f0: 720 * p, f1: 640 * p }, { v: 'u', d: 0.16, f0: 640 * p, f1: 430 * p }], 0.32, o, { formantScale: 1.55 });
    return 0.55;
  } },
  quack: { prio: 2, gap: 0.2, play(S, t, o, p) {
    for (const dt of [0, 0.2]) S.voice(t + dt, [{ v: 'a', c: 'k', d: 0.14, f0: 310 * p, f1: 240 * p }], 0.85, o, { formantScale: 1.35, q: 0.6 });
    return 0.45;
  } },
  robot: { prio: 1, gap: 0.15, max: 2, play(S, t, o, p) {
    const ring = S.gain(0, o);
    S.lfo(ring.gain, 90, 1, t, t + 0.5, 0, 'square');
    for (let i = 0; i < 5; i++) S.osc('square', pick([600, 800, 1000, 1200, 1600]) * p, t + i * 0.07, 0.04, 0.25, ring, { a: 0.002, hold: 0.03 });
    S.osc('sine', 400 * p, t, 0.4, 0.12, o, { vib: [12, 80] });
    return 0.45;
  } },
  power_unlock: { prio: 3, gap: 1, play(S, t, o, p) {
    for (let i = 0; i < 12; i++) tink(S, t + i * 0.045, 72 + PENTA[i % 5] + 12 * Math.floor(i / 5), 0.12, o, 0.4);
    chord(S, t + 0.55, [53, 65, 69, 72, 77], 0.9, 0.09, o, 'brass');
    S.fm(t + 0.55, 74, 1.47, 2.5, 2.0, 0.22, o, { indexEnd: 0.3, indexTime: 1.2, a: 0.01 });
    S.noise(t, 0.9, 0.1, o, { type: 'bandpass', f: 500, f2: 9000, q: 1, a: 0.5 });
    return 2.4;
  } },
  time_freeze: { prio: 3, gap: 0.3, play(S, t, o, p) {
    S.osc('sine', 1250, t, 0.03, 0.35, o, { a: 0.001 });
    S.osc('sine', 900, t + 0.13, 0.03, 0.35, o, { a: 0.001 });
    S.fm(t + 0.22, 2600 * p, 3.1, 0.8, 0.6, 0.15, o, { f2: 1300 * p, ft: 0.5 });
    S.noise(t + 0.2, 0.55, 0.15, o, { type: 'highpass', f: 9000, f2: 3000, ft: 0.5, a: 0.02 });
    tink(S, t + 0.3, 96, 0.12, o, 0.6);
    return 0.9;
  } },
};

export const SFX_NAMES = Object.keys(SFX);
