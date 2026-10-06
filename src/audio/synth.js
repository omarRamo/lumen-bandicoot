// Lumen Bandicoot — low-level WebAudio voice helpers shared by SFX and music.
// Everything is synthesised: oscillators, filtered noise, FM, formant "voices" and Karplus-Strong plucks
// (pre-rendered into small cached buffers — cheaper than feedback delay lines and pitch-accurate).
// Nothing here touches WebAudio at import time, so the module can be imported from Node tests.

export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

const EPS = 0.0001;

// Vowel formants (F1, F2, F3) — a cartoon "voice box" for Oku Oku, cats, ducks and bosses.
export const VOWELS = {
  u: [320, 800, 2240],
  o: [470, 840, 2400],
  a: [760, 1220, 2500],
  e: [480, 1850, 2550],
  i: [300, 2250, 2950],
  eu: [420, 1300, 2300],
  m: [250, 1000, 2200],
};

export class Synth {
  constructor(ctx) {
    this.ctx = ctx;
    this.sr = ctx.sampleRate;
    // 1 s of white noise, shared by every noise voice (random start offsets avoid audible repetition)
    const len = Math.floor(this.sr * 1.0);
    this.noiseBuf = ctx.createBuffer(1, len, this.sr);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.ks = new Map();      // Karplus-Strong buffer cache
    this.curves = new Map();  // waveshaper curves
    this.waves = new Map();   // periodic waves
    this.verbSend = null;     // set by the engine (music / sfx reverb send)
  }

  get now() { return this.ctx.currentTime; }

  gain(v, out) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    if (out) g.connect(out);
    return g;
  }

  /** Attack / exponential decay envelope on a GainNode param. */
  env(g, t, attack, peak, decay, hold = 0) {
    const p = g.gain;
    p.setValueAtTime(EPS, t);
    p.linearRampToValueAtTime(Math.max(EPS * 2, peak), t + attack);
    if (hold > 0) p.setValueAtTime(Math.max(EPS * 2, peak), t + attack + hold);
    p.exponentialRampToValueAtTime(EPS, t + attack + hold + Math.max(0.01, decay));
  }

  /**
   * Oscillator voice. o: { a: attack, hold, f2: end freq, ft: glide time, curve:'lin', detune, wave, vib:[rate, depth Hz], pan }
   * Returns { o, g } so callers can automate further.
   */
  osc(type, f, t, dur, vol, out, o = {}) {
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    if (type === 'custom' && o.wave) osc.setPeriodicWave(o.wave); else osc.type = type;
    osc.frequency.setValueAtTime(Math.max(1, f), t);
    if (o.f2) {
      const ft = t + (o.ft ?? dur);
      if (o.curve === 'lin') osc.frequency.linearRampToValueAtTime(o.f2, ft);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f2), ft);
    }
    if (o.detune) osc.detune.value = o.detune;
    const g = ctx.createGain();
    const a = o.a ?? 0.004;
    this.env(g, t, a, vol, dur, o.hold || 0);
    osc.connect(g);
    g.connect(out);
    const end = t + a + (o.hold || 0) + dur + 0.03;
    if (o.vib) this.lfo(osc.frequency, o.vib[0], o.vib[1], t, end, o.vibDelay || 0);
    osc.start(t);
    osc.stop(end);
    return { o: osc, g, end };
  }

  /** Sine LFO added to an AudioParam (vibrato, tremolo, wobble filters). */
  lfo(param, rate, depth, t, end, delay = 0, type = 'sine') {
    const ctx = this.ctx;
    const l = ctx.createOscillator();
    l.type = type;
    l.frequency.setValueAtTime(rate, t);
    const lg = ctx.createGain();
    if (delay > 0) { lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(depth, t + delay); } else lg.gain.value = depth;
    l.connect(lg);
    lg.connect(param);
    l.start(t);
    l.stop(end);
    return { l, lg };
  }

  /**
   * Filtered noise burst. o: { type, f, f2, ft, q, a, hold, rate (playbackRate), pan }
   */
  noise(t, dur, vol, out, o = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    s.loop = true;
    if (o.rate) s.playbackRate.value = o.rate;
    let node = s;
    let f = null;
    if (o.type !== 'none') {
      f = ctx.createBiquadFilter();
      f.type = o.type || 'bandpass';
      f.frequency.setValueAtTime(o.f || 1000, t);
      if (o.f2) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + (o.ft ?? dur));
      f.Q.value = o.q ?? 1;
      s.connect(f);
      node = f;
    }
    const g = ctx.createGain();
    const a = o.a ?? 0.003;
    this.env(g, t, a, vol, dur, o.hold || 0);
    node.connect(g);
    g.connect(out);
    const end = t + a + (o.hold || 0) + dur + 0.03;
    s.start(t, Math.random() * 0.9);
    s.stop(end);
    return { s, f, g, end };
  }

  /** Two-operator FM voice (bells, metal, clangs, electric piano). */
  fm(t, f, ratio, index, dur, vol, out, o = {}) {
    const ctx = this.ctx;
    const car = ctx.createOscillator();
    car.type = o.carType || 'sine';
    car.frequency.setValueAtTime(f, t);
    const mod = ctx.createOscillator();
    mod.frequency.setValueAtTime(f * ratio, t);
    const mg = ctx.createGain();
    const idx = f * ratio * index;
    mg.gain.setValueAtTime(idx, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, idx * (o.indexEnd ?? 0.05)), t + (o.indexTime ?? dur * 0.6));
    mod.connect(mg);
    mg.connect(car.frequency);
    if (o.f2) {
      car.frequency.exponentialRampToValueAtTime(o.f2, t + (o.ft ?? dur));
      mod.frequency.exponentialRampToValueAtTime(o.f2 * ratio, t + (o.ft ?? dur));
    }
    const g = ctx.createGain();
    const a = o.a ?? 0.002;
    this.env(g, t, a, vol, dur, o.hold || 0);
    car.connect(g);
    g.connect(out);
    const end = t + a + (o.hold || 0) + dur + 0.03;
    car.start(t); mod.start(t);
    car.stop(end); mod.stop(end);
    return { car, mod, g, end };
  }

  /** Simple biquad inserted before `out`. */
  filter(type, f, q, out, t) {
    const fl = this.ctx.createBiquadFilter();
    fl.type = type;
    fl.frequency.setValueAtTime(f, t ?? this.ctx.currentTime);
    fl.Q.value = q ?? 0.7;
    if (out) fl.connect(out);
    return fl;
  }

  /** Stereo panner (falls back to a plain gain where StereoPanner is missing). */
  panner(pan, out) {
    const ctx = this.ctx;
    if (!ctx.createStereoPanner) return this.gain(1, out);
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    if (out) p.connect(out);
    return p;
  }

  /** Soft-clip waveshaper (cached curves). */
  shaper(amount, out) {
    let c = this.curves.get(amount);
    if (!c) {
      const n = 1024; c = new Float32Array(n);
      for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(x * amount) / Math.tanh(amount); }
      this.curves.set(amount, c);
    }
    const ws = this.ctx.createWaveShaper();
    ws.curve = c;
    ws.oversample = 'none';
    if (out) ws.connect(out);
    return ws;
  }

  /** Cached PeriodicWave from harmonic amplitudes (organ drawbars, reed, pulse…). */
  wave(key, harmonics) {
    let w = this.waves.get(key);
    if (!w) {
      const real = new Float32Array(harmonics.length + 1);
      const imag = new Float32Array(harmonics.length + 1);
      harmonics.forEach((a, i) => { imag[i + 1] = a; });
      w = this.ctx.createPeriodicWave(real, imag);
      this.waves.set(key, w);
    }
    return w;
  }

  /**
   * Karplus-Strong plucked string, pre-rendered (22.05 kHz, cached per midi note + flavour).
   * bright 0..1 (initial noise colour), decay ≈ seconds of ring.
   */
  ksBuffer(midi, flavour = 'oud') {
    const key = flavour + ':' + midi;
    let b = this.ks.get(key);
    if (b) return b;
    if (this.ks.size > 96) this.ks.clear();
    const sr = 22050;
    const P = FLAVOURS[flavour] || FLAVOURS.oud;
    const f = mtof(midi);
    const N = Math.max(2, Math.floor(sr / f - 0.5));
    const len = Math.floor(sr * P.len);
    const buf = this.ctx.createBuffer(1, len, sr);
    const y = buf.getChannelData(0);
    // excitation: coloured noise burst (one-pole lowpass → darker for oud, brighter for harp)
    let lp = 0;
    for (let i = 0; i < N; i++) {
      const w = Math.random() * 2 - 1;
      lp += P.bright * (w - lp);
      y[i] = lp + (P.pick ? Math.sin((i / N) * Math.PI) * 0.4 : 0);
    }
    // per-period loss so high and low notes ring for roughly the same time
    const loss = Math.pow(0.001, 1 / (P.ring * (sr / (N + 0.5))));
    for (let i = N; i < len; i++) {
      const a = y[i - N], b2 = i - N - 1 >= 0 ? y[i - N - 1] : 0;
      y[i] = loss * (P.blend * a + (1 - P.blend) * b2);
    }
    // normalise
    let pk = 0;
    for (let i = 0; i < len; i++) { const v = Math.abs(y[i]); if (v > pk) pk = v; }
    if (pk > 0) for (let i = 0; i < len; i++) y[i] /= pk;
    // fundamental actually produced: sr / (N + (1 - blend)) — store a rate correction
    b = { buf, rate: f / (sr / (N + (1 - P.blend))) };
    this.ks.set(key, b);
    return b;
  }

  pluck(t, midi, vol, out, flavour = 'oud', dur = 1.2) {
    const ctx = this.ctx;
    const { buf, rate } = this.ksBuffer(Math.round(midi), flavour);
    const s = ctx.createBufferSource();
    s.buffer = buf;
    s.playbackRate.value = rate * Math.pow(2, (midi - Math.round(midi)) / 12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    const end = t + Math.min(dur, buf.duration);
    g.gain.setValueAtTime(vol, end - 0.05);
    g.gain.linearRampToValueAtTime(0, end);
    s.connect(g);
    g.connect(out);
    s.start(t);
    s.stop(end + 0.01);
    return { s, g, end };
  }

  /**
   * Formant voice: a buzzy glottal source through three parallel band-pass formants.
   * syl: [{ v: vowel, d: duration, f0, f1 (end pitch), c: consonant 'g'|'b'|'k'|'m'|'w'|null, vol }]
   */
  voice(t, syl, vol, out, o = {}) {
    const ctx = this.ctx;
    const src = ctx.createOscillator();
    src.setPeriodicWave(this.wave('glottal', GLOTTAL));
    const total = syl.reduce((s, x) => s + x.d + (x.gap || 0), 0);
    const end = t + total + 0.08;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(EPS, t);
    const fs = [0, 1, 2].map((i) => {
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = [7, 10, 12][i] * (o.q || 1);
      const fg = ctx.createGain();
      fg.gain.value = [1, 0.7, 0.35][i] * 2.4 / Math.max(1, (o.formantScale || 1) * 1.1);
      amp.connect(bp); bp.connect(fg); fg.connect(out);
      return bp;
    });
    const scale = o.formantScale || 1;
    let tt = t;
    const first = VOWELS[syl[0].v] || VOWELS.a;
    fs.forEach((bp, i) => bp.frequency.setValueAtTime(first[i] * scale, t));
    src.frequency.setValueAtTime(syl[0].f0, t);
    for (const s of syl) {
      const fv = VOWELS[s.v] || VOWELS.a;
      const sv = (s.vol ?? 1) * vol;
      // consonant onset
      if (s.c === 'g' || s.c === 'k' || s.c === 'b' || s.c === 'd') {
        amp.gain.setValueAtTime(EPS, tt);
        const burstF = s.c === 'b' ? 600 : s.c === 'd' ? 3000 : s.c === 'k' ? 2600 : 1600;
        this.noise(tt, 0.03, sv * 0.35, out, { type: 'bandpass', f: burstF, q: 2 });
        if (s.c === 'b' || s.c === 'd') this.osc('sine', s.f0 * 0.9, tt, 0.05, sv * 0.4, out);
        tt += 0.035;
      } else if (s.c === 'm' || s.c === 'w') {
        // nasal / glide: start closed, open into the vowel
        fs.forEach((bp, i) => bp.frequency.setValueAtTime(VOWELS[s.c === 'm' ? 'm' : 'u'][i] * scale, tt));
      }
      src.frequency.setValueAtTime(s.f0, tt);
      if (s.f1) src.frequency.exponentialRampToValueAtTime(s.f1, tt + s.d);
      fs.forEach((bp, i) => bp.frequency.linearRampToValueAtTime(fv[i] * scale, tt + Math.min(0.06, s.d * 0.4)));
      amp.gain.linearRampToValueAtTime(sv, tt + 0.025);
      amp.gain.setValueAtTime(sv, tt + s.d * 0.7);
      amp.gain.linearRampToValueAtTime(s.tail ? sv * 0.5 : EPS, tt + s.d);
      tt += s.d;
      if (s.gap) { amp.gain.setValueAtTime(EPS, tt); tt += s.gap; }
    }
    amp.gain.linearRampToValueAtTime(EPS, tt + 0.05);
    src.connect(amp);
    if (o.vib) this.lfo(src.frequency, o.vib[0], o.vib[1], t, end);
    src.start(t);
    src.stop(end);
    return { src, amp, end };
  }
}

// glottal-ish pulse: rich harmonics falling at ~ -9 dB/oct
const GLOTTAL = Array.from({ length: 28 }, (_, i) => 1 / Math.pow(i + 1, 1.5));

const FLAVOURS = {
  oud: { bright: 0.35, blend: 0.5, ring: 1.4, len: 1.3, pick: true },
  harp: { bright: 0.8, blend: 0.5, ring: 1.6, len: 1.6, pick: false },
  guitar: { bright: 0.6, blend: 0.5, ring: 1.1, len: 1.2, pick: true },
  koto: { bright: 0.9, blend: 0.6, ring: 1.0, len: 1.1, pick: false },
  bass: { bright: 0.25, blend: 0.5, ring: 0.9, len: 1.0, pick: true },
  mute: { bright: 0.5, blend: 0.5, ring: 0.18, len: 0.4, pick: true },
};

/** Procedural stereo room impulse (short, bright, cheap). */
export function makeImpulse(ctx, seconds = 1.5, decay = 2.8) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const ch = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const k = i / len;
      // darken over time: one-pole lowpass with a falling coefficient
      lp += (0.9 - 0.75 * k) * ((Math.random() * 2 - 1) - lp);
      ch[i] = lp * Math.pow(1 - k, decay) * (i < 40 ? i / 40 : 1);
    }
  }
  return ir;
}
