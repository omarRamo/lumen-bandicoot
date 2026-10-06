// Lumen Bandicoot — pattern-based music sequencer with sample-accurate look-ahead scheduling.
//
// Song notation (see songs.js):
//   song = { bpm, key (midi of degree 1), scale, swing, barSteps (16 = 4/4 in 16ths, 12 = 3/4),
//            parts: { name: { type: 'mel'|'bass'|'chord'|'arp'|'drums', inst, vol, oct, sus } },
//            sections: { A: { chords: [...per bar], <part>: [...bar patterns, cycled] } },
//            form: ['I', 'A', 'B'], loop: index to jump back to after the form (false = play once),
//            verb, echo (send levels), mods: { boss/disco tweaks } }
//   A bar pattern is split into equal tokens (space separated, or one char per token if no spaces).
//   mel  : scale degrees 1..7, accidentals b/#, octave ' or , ; '-' = hold, '.' = rest, suffix ! = accent
//   bass : like mel but relative to the bar's chord root (1 3 5 7 = chord tones, 8 = octave, 2 4 6 = steps)
//   chord: x / X = strike the chord (held through '-'), '.' = rest
//   arp  : 0..9 = chord tone index walking up octaves
//   drums: object { voice: '16 chars' } — x normal, X accent, o ghost (voices in instruments.js DRUM)
//   chords: '1', 'b7', '4m', '5M', '27' (+7th), two chords in one bar = '1 4'
import { INST, DRUM } from './instruments.js';
import { clamp } from './synth.js';

export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  hijaz: [0, 1, 4, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
};

function deg2semi(scale, deg) {
  const d = deg - 1;
  const oct = Math.floor(d / 7);
  return scale[((d % 7) + 7) % 7] + 12 * oct;
}

const words = (bar) => String(bar ?? '').trim().split(/\s+/).filter(Boolean);

function tokenize(bar) {
  if (bar == null) return [];
  const s = String(bar).trim();
  return /\s/.test(s) ? s.split(/\s+/) : s.split('');
}

const NOTE_RE = /^([b#]*)([1-9])([',]*)(!?)$/;
function parseDegree(tok) {
  const m = NOTE_RE.exec(tok);
  if (!m) return null;
  let acc = 0;
  for (const c of m[1]) acc += c === 'b' ? -1 : 1;
  let oct = 0;
  for (const c of m[3]) oct += c === "'" ? 12 : -12;
  return { deg: +m[2], acc, oct, accent: !!m[4] };
}

const CHORD_RE = /^([b#]*)([1-7])([Mmd+s]?)(7?)$/;
function parseChord(tok, scale) {
  const m = CHORD_RE.exec(tok);
  if (!m) return { root: 0, tones: [0, 4, 7], deg: 1, diatonic: false };
  let acc = 0;
  for (const c of m[1]) acc += c === 'b' ? -1 : 1;
  const deg = +m[2];
  const root = deg2semi(scale, deg) + acc;
  let tones;
  const q = m[3];
  if (q === 'M') tones = [0, 4, 7];
  else if (q === 'm') tones = [0, 3, 7];
  else if (q === 'd') tones = [0, 3, 6];
  else if (q === '+') tones = [0, 4, 8];
  else if (q === 's') tones = [0, 5, 7];
  else tones = [0, deg2semi(scale, deg + 2) - deg2semi(scale, deg), deg2semi(scale, deg + 4) - deg2semi(scale, deg)];
  if (m[4]) tones.push(q ? (q === 'd' ? 9 : 10) : deg2semi(scale, deg + 6) - deg2semi(scale, deg));
  return { root: ((root % 12) + 12) % 12, tones, deg, diatonic: !acc && !q };
}

/** Semitone offset (from chord root) for a bass token degree. */
function bassInterval(chord, scale, d) {
  if (d === 1) return 0;
  if (d === 3) return chord.tones[1];
  if (d === 5) return chord.tones[2];
  if (d === 7) return chord.tones[3] ?? 10;
  if (d === 8) return 12;
  if (d === 9) return 14;
  if (chord.diatonic) return deg2semi(scale, chord.deg + d - 1) - deg2semi(scale, chord.deg);
  return { 2: 2, 4: 5, 6: 9 }[d] ?? 0;
}

function velOf(ch) { return ch === 'X' ? 1 : ch === 'o' ? 0.45 : 0.78; }

/** Compile one section into per-step event buckets. */
function compileSection(song, sec, name) {
  const scale = SCALES[song.scale] || SCALES.major;
  const B = song.barSteps || 16;
  const chordsSrc = sec.chords || ['1'];
  const bars = sec.bars || chordsSrc.length;
  const steps = bars * B;
  const events = Array.from({ length: steps }, () => []);
  const chordAt = new Array(steps);

  // chords per step
  for (let b = 0; b < bars; b++) {
    const toks = words(chordsSrc[b % chordsSrc.length]);
    toks.forEach((tk, i) => {
      const c = parseChord(tk, scale);
      const s0 = b * B + Math.round((i * B) / toks.length), s1 = b * B + Math.round(((i + 1) * B) / toks.length);
      for (let s = s0; s < s1; s++) chordAt[s] = c;
    });
  }
  const push = (pos, ev) => {
    const s = Math.floor(pos + 1e-6);
    if (s < 0 || s >= steps) return;
    ev.off = pos - s;
    events[s].push(ev);
  };

  for (const [pname, part] of Object.entries(song.parts || {})) {
    const pats = sec[pname];
    if (!pats || part.type === 'drums') continue;
    const list = Array.isArray(pats) ? pats : [pats];
    let last = null;
    for (let b = 0; b < bars; b++) {
      const toks = tokenize(list[b % list.length]);
      if (!toks.length) continue;
      const len = B / toks.length;
      toks.forEach((tk, i) => {
        const pos = b * B + i * len;
        if (tk === '-') { if (last) last.dur += len; return; }
        last = null;
        if (tk === '.' || tk === '_') return;
        const chord = chordAt[Math.min(steps - 1, Math.floor(pos))];
        if (part.type === 'mel' || part.type === 'bass') {
          const p = parseDegree(tk);
          if (!p) return;
          let semi;
          if (part.type === 'mel') semi = deg2semi(scale, p.deg) + p.acc + p.oct;
          else semi = chord.root + bassInterval(chord, scale, p.deg) + p.acc + p.oct;
          last = { part: pname, midi: [song.key + (part.oct || 0) + semi], dur: len, vel: p.accent ? 1 : 0.8 };
          push(pos, last);
        } else if (part.type === 'chord') {
          if (tk !== 'x' && tk !== 'X' && tk !== 'o') return;
          const base = song.key + (part.oct || 0);
          const top = base + (part.span ?? 10);
          const midi = chord.tones.map((iv) => { let n = base + chord.root + iv; while (n > top) n -= 12; while (n < top - 12) n += 12; return n; });
          last = { part: pname, midi, dur: len, vel: velOf(tk) };
          push(pos, last);
        } else if (part.type === 'arp') {
          const idx = parseInt(tk, 10);
          if (!(idx >= 0)) return;
          const tones = chord.tones.length;
          const iv = chord.tones[idx % tones] + 12 * Math.floor(idx / tones);
          last = { part: pname, midi: [song.key + (part.oct || 0) + chord.root + iv], dur: len, vel: 0.8 };
          push(pos, last);
        }
      });
    }
  }

  // drums
  const dpart = Object.entries(song.parts || {}).find(([, p]) => p.type === 'drums');
  if (dpart && sec[dpart[0]]) {
    const [pname] = dpart;
    const list = Array.isArray(sec[pname]) ? sec[pname] : [sec[pname]];
    for (let b = 0; b < bars; b++) {
      let pat = list[b % list.length];
      if (typeof pat === 'string') pat = song.drumKit?.[pat] || DRUMPATS[pat];
      if (!pat) continue;
      for (const [voice, str] of Object.entries(pat)) {
        if (!DRUM[voice]) continue;
        const toks = tokenize(str);
        const len = B / toks.length;
        toks.forEach((ch, i) => {
          if (ch === '.' || ch === '-') return;
          push(b * B + i * len, { part: pname, drum: voice, vel: velOf(ch) });
        });
      }
    }
  }
  return { name, bars, steps, events, chordAt, barSteps: B };
}

const compiled = new WeakMap();
export function compileSong(song) {
  let c = compiled.get(song);
  if (c) return c;
  const sections = {};
  for (const [name, sec] of Object.entries(song.sections)) sections[name] = compileSection(song, sec, name);
  const form = (song.form || Object.keys(song.sections)).filter((n) => sections[n]);
  c = { sections, form };
  compiled.set(song, c);
  return c;
}

// -------------------------------------------------------------------------------- shared drum patterns
export const DRUMPATS = {
  none: {},
  island: { k: 'x.......x.x.....', s: '....x.......x...', r: 'x.xx.xx.x.xx.xx.', l: '..x..x.....x..x.', L: 'x.........x.....' },
  islandFill: { k: 'x.......x.......', s: '....x.......x...', r: 'x.xx.xx.x.xx.xx.', L: '........x.x.x...', l: '..........x.xxxx' },
  tribal: { k: 'x.....x...x.....', l: '..x.x..x..x.x..x', L: 'x..x......x..x..', r: 'xoxoxoxoxoxoxoxo', w: '....x.......x...' },
  tribalFill: { k: 'x.....x...x.....', t: '........x.x.x.xx', T: '..........x.x.x.', r: 'xoxoxoxoxoxoxoxo' },
  calypso: { k: 'x..x..x.x..x..x.', s: '....x.......x...', b: '..x..x.x..x..x.x', g: 'x.....x.....x...', r: 'xoxxxoxxxoxxxoxx' },
  soft: { k: 'x.......x.......', n: '....x.......x...', r: '..x...x...x...x.' },
  halftime: { k: 'x.........x.....', n: '........x.......', h: '..x...x...x...x.' },
  brush: { k: 'x.......x.......', s: '....o.......o...', r: 'xoxxxoxxxoxxxoxx' },
  rock: { k: 'x.....x.x.......', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.' },
  rockFill: { k: 'x.....x.x.......', s: '....X.......XxXx', t: '............x.x.', h: 'x.x.x.x.x.......' },
  maqsum: { d: 'x.......x.......', e: '..x...x.....x...', a: '.o..o.....o.o..o', q: 'x...x...x...x...' },
  maqsumFill: { d: 'x.......x...x...', e: '..x...x.xxx.xxxx', q: 'x...x...x...x...' },
  malfuf: { d: 'x.......x.......', e: '...x..x....x..x.', a: '.o...o...o...o.o', q: 'x.x.x.x.x.x.x.x.' },
  malfufFill: { d: 'x..x..x.x..x..x.', e: '.x.x.xxx.x.x.xxx', q: 'x.x.x.x.x.x.x.x.' },
  funk: { k: 'x..x......x..x..', s: '....X..o.o..X...', h: 'xoxoxoxoxoxoxoxo', m: '.......x.......x' },
  funkFill: { k: 'x..x......x.....', s: '....X..o.o..XoXX', h: 'xoxoxoxoxoxo....', m: '...x...x...x...x' },
  disco: { k: 'x...x...x...x...', c: '....x.......x...', o: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.' },
  chase: { k: 'x.x...x.x.x...x.', s: '....X.......X...', h: 'xxxxxxxxxxxxxxxx' },
  chaseFill: { k: 'x.x...x.x.......', s: '....X...XxXxXXXX', h: 'xxxxxxxx........' },
  gallop: { k: 'x..x..x.x..x..x.', s: '....x.......x...', T: 'x.xx..x.x.xx..x.', h: 'x.x.x.x.x.x.x.x.' },
  boss: { K: 'x.......x.......', k: '......x.......x.', s: '....X.......X...', h: 'x.x.x.x.x.x.x.x.', p: 'x.......x.......' },
  bossFill: { K: 'x.......x.......', s: '....X.......X...', t: '........x.x.xx..', T: '..........x..xxx', x: 'x...............' },
  march: { k: 'x.......x.......', s: '..o.x.o...o.x.oo', h: 'x...x...x...x...' },
  tick: { y: 'x...x...x...x...', k: 'x.......x.......', s: '....x.......x...' },
  space: { k: 'x.....x...x.....', c: '....x.......x...', h: '..x...x...x...x.', z: '.......x.......x' },
  ice: { k: 'x.......x.......', n: '....x.......x...', j: 'x.x.x.x.x.x.x.x.' },
  drip: { w: '..x.......x..x..', k: 'x.........x.....', r: '....x.......x...' },
};

// ------------------------------------------------------------------------------------------- runtime
const LOOKAHEAD = 0.16;

export class Sequencer {
  /**
   * @param S Synth, @param song definition, @param dest AudioNode (music bus), @param fx { verb, echo } send inputs
   * @param mods shared mods object { invincible, boss, danger, tempo }
   */
  constructor(S, song, dest, fx, mods) {
    this.S = S;
    this.song = song;
    this.c = compileSong(song);
    this.mods = mods || {};
    const ctx = S.ctx;
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(dest);
    this.partOut = {};
    for (const [name, p] of Object.entries(song.parts)) {
      const g = ctx.createGain();
      g.gain.value = p.vol ?? 1;
      g.connect(this.out);
      if (p.verb && fx?.verb) { const s = ctx.createGain(); s.gain.value = p.verb; g.connect(s); s.connect(fx.verb); this._sends = (this._sends || []).concat(s); }
      if (p.echo && fx?.echo) { const s = ctx.createGain(); s.gain.value = p.echo; g.connect(s); s.connect(fx.echo); this._sends = (this._sends || []).concat(s); }
      this.partOut[name] = g;
    }
    // overlay layers (disco + boss) have their own gains so they fade in/out smoothly
    this.disco = ctx.createGain(); this.disco.gain.value = 0; this.disco.connect(this.out);
    this.extra = ctx.createGain(); this.extra.gain.value = 0; this.extra.connect(this.out);
    this.formIdx = 0;
    this.step = 0;
    this.globalStep = 0;
    this.tempo = 1;
    this.nextTime = 0;
    this.done = false;
    this.stopAt = Infinity;
    this.endTime = Infinity;
    this.discoOn = false;
    this.bossOn = false;
  }

  get section() { return this.c.sections[this.c.form[this.formIdx]]; }

  start(t, fadeIn = 0.05) {
    this.nextTime = t;
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.0001, t);
    g.linearRampToValueAtTime(this.song.gain ?? 1, t + Math.max(0.02, fadeIn));
    this.applyMods(t, true);
  }

  /** Fade out and stop scheduling; returns the time the sequencer can be disposed. */
  stop(t, fade = 0.8) {
    const g = this.out.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + fade);
    this.stopAt = Math.min(this.stopAt, t + fade);
    this.endTime = this.stopAt + 0.3;
    return this.endTime;
  }

  applyMods(t, instant = false) {
    const m = this.mods;
    const tc = instant ? 0.01 : 0.25;
    const disco = !!m.invincible && this.song.disco !== false;
    if (disco !== this.discoOn) {
      this.discoOn = disco;
      this.disco.gain.setTargetAtTime(disco ? 0.62 : 0, t, disco ? 0.05 : 0.4);
    }
    const boss = !!m.boss;
    if (boss !== this.bossOn) {
      this.bossOn = boss;
      this.extra.gain.setTargetAtTime(boss ? 0.6 : 0, t, tc);
      const lead = this.partOut.lead;
      if (lead) lead.gain.setTargetAtTime((this.song.parts.lead.vol ?? 1) * (boss ? 1.25 : 1), t, tc);
    }
  }

  stepDur() {
    const target = (this.mods.danger ? 1.08 : 1) * (this.mods.tempo || 1);
    this.tempo += (target - this.tempo) * 0.02;
    return 60 / (this.song.bpm * this.tempo) / (this.song.stepsPerBeat || 4);
  }

  /** Schedule everything up to `until` (ctx time). */
  pump(until, now = -Infinity) {
    let guard = 0;
    while (!this.done && this.nextTime < until && this.nextTime < this.stopAt && guard++ < 512) {
      const sd = this.stepDur();
      const late = this.nextTime < now - 0.03; // tab was throttled: skip silently instead of bursting
      if (!late) this.scheduleStep(this.nextTime, sd);
      const sw = this.song.swing || 0;
      this.nextTime += sd * (this.step % 2 === 0 ? 1 + sw : 1 - sw);
      this.advance();
    }
  }

  advance() {
    this.step++;
    this.globalStep++;
    if (this.step >= this.section.steps) {
      this.step = 0;
      this.formIdx++;
      if (this.formIdx >= this.c.form.length) {
        if (this.song.loop === false) {
          this.done = true;
          this.endTime = this.nextTime + 2.5;
        } else this.formIdx = clamp(this.song.loop | 0, 0, this.c.form.length - 1);
      }
    }
  }

  scheduleStep(t, sd) {
    const S = this.S;
    const sec = this.section;
    const evs = sec.events[this.step];
    for (let i = 0; i < evs.length; i++) {
      const ev = evs[i];
      const tt = t + ev.off * sd;
      const out = this.partOut[ev.part];
      try {
        if (ev.drum) DRUM[ev.drum](S, tt, ev.vel, out);
        else {
          const p = this.song.parts[ev.part];
          const fn = INST[p.inst] || INST.marimba;
          const dur = ev.dur * sd * (p.sus ?? 1);
          for (let k = 0; k < ev.midi.length; k++) fn(S, tt, ev.midi[k] + (this.song.transpose || 0), dur, ev.vel, out);
        }
      } catch (err) { this.errors = (this.errors || 0) + 1; this.lastError = err; /* a bad event must never kill the scheduler */ }
    }
    const B = sec.barSteps;
    const s = this.step % B;
    const chord = sec.chordAt[this.step];
    if (this.discoOn) this.discoStep(t, sd, s, B, chord);
    if (this.bossOn) this.bossStep(t, sd, s, B, chord);
  }

  // DISCO overlay: four-on-the-floor, open hats on the off-beat, octave bass, string stabs.
  discoStep(t, sd, s, B, chord) {
    const S = this.S, o = this.disco;
    const beat = this.song.stepsPerBeat || 4, half = beat >> 1;
    const root = this.song.key - 24 + (chord?.root || 0);
    const inBeat = s % beat;
    if (inBeat === 0) DRUM.k(S, t, 0.9, o);
    if (inBeat === half) { DRUM.o(S, t, 0.8, o); INST.synbass(S, t, root + 12, sd * 1.6, 0.8, o); }
    if (inBeat === 0) INST.synbass(S, t, root, sd * 1.6, 0.9, o);
    if (inBeat === 0 && Math.floor(s / beat) % 2 === 1) DRUM.c(S, t, 0.7, o);
    if (inBeat !== 0 && inBeat !== half) DRUM.h(S, t, 0.35, o);
    if (s === B - beat + half && chord) for (const iv of chord.tones.slice(0, 3)) INST.strings(S, t, this.song.key + chord.root + iv, sd * 2, 0.6, o);
  }

  // BOSS overlay: driving toms, 16th hats and a sub pulse.
  bossStep(t, sd, s, B, chord) {
    const S = this.S, o = this.extra;
    const beat = this.song.stepsPerBeat || 4;
    if (s % 2 === 0) DRUM.h(S, t, 0.35, o);
    if (s >= B - 3) DRUM.T(S, t, 0.55, o);
    if (s === (B >> 1) + 2) DRUM.t(S, t, 0.6, o);
    if (s % beat === 0) INST.sub(S, t, this.song.key - 24 + (chord?.root || 0), sd * 2.5, 0.5, o);
  }

  dispose() {
    try { this.out.disconnect(); } catch { /* */ }
    for (const g of Object.values(this.partOut)) { try { g.disconnect(); } catch { /* */ } }
    for (const s of this._sends || []) { try { s.disconnect(); } catch { /* */ } }
    try { this.disco.disconnect(); this.extra.disconnect(); } catch { /* */ }
  }
}

export { LOOKAHEAD };

/**
 * Static checks for a score (pure JS, no WebAudio): unknown parts / tokens / chords / drum patterns,
 * bar patterns that do not divide the bar evenly, and notes outside a sane midi range.
 */
export function validateSong(song, name = '?') {
  const errs = [];
  const B = song.barSteps || 16;
  const parts = song.parts || {};
  if (!(song.bpm > 0)) errs.push(`${name}: bad bpm`);
  for (const [sname, sec] of Object.entries(song.sections || {})) {
    for (const key of Object.keys(sec)) {
      if (key === 'chords' || key === 'bars') continue;
      if (!parts[key]) errs.push(`${name}.${sname}: unknown part "${key}"`);
    }
    for (const c of sec.chords || []) for (const tk of words(c)) if (!CHORD_RE.test(tk)) errs.push(`${name}.${sname}: bad chord "${tk}"`);
    for (const [pname, part] of Object.entries(parts)) {
      const pats = sec[pname];
      if (!pats) continue;
      for (const pat of Array.isArray(pats) ? pats : [pats]) {
        if (part.type === 'drums') {
          const obj = typeof pat === 'string' ? (song.drumKit?.[pat] || DRUMPATS[pat]) : pat;
          if (!obj) { errs.push(`${name}.${sname}: unknown drum pattern "${pat}"`); continue; }
          for (const [v, str] of Object.entries(obj)) {
            if (!DRUM[v]) errs.push(`${name}.${sname}: unknown drum voice "${v}"`);
            const n = tokenize(str).length;
            if (B % n && n % B) errs.push(`${name}.${sname}: drum "${v}" has ${n} steps for a ${B}-step bar`);
          }
          continue;
        }
        const toks = tokenize(pat);
        if (!toks.length || (B / toks.length) % 1 > 1e-9 && (B * 2 / toks.length) % 1 > 1e-9) errs.push(`${name}.${sname}.${pname}: ${toks.length} tokens do not fit a ${B}-step bar ("${pat}")`);
        for (const tk of toks) {
          if (tk === '-' || tk === '.' || tk === '_') continue;
          if (part.type === 'mel' || part.type === 'bass') { if (!parseDegree(tk)) errs.push(`${name}.${sname}.${pname}: bad note "${tk}"`); }
          else if (part.type === 'chord') { if (!/^[xXo]$/.test(tk)) errs.push(`${name}.${sname}.${pname}: bad chord hit "${tk}"`); }
          else if (part.type === 'arp') { if (!/^\d$/.test(tk)) errs.push(`${name}.${sname}.${pname}: bad arp index "${tk}"`); }
        }
      }
    }
  }
  for (const [pname, part] of Object.entries(parts)) {
    if (part.type !== 'drums' && !INST[part.inst]) errs.push(`${name}: part ${pname} uses unknown instrument "${part.inst}"`);
  }
  for (const f of song.form || []) if (!song.sections?.[f]) errs.push(`${name}: form references missing section "${f}"`);
  if (!errs.length) {
    const c = compileSong(song);
    for (const sec of Object.values(c.sections)) for (const evs of sec.events) for (const ev of evs) {
      if (ev.midi) for (const m of ev.midi) if (!(m >= 24 && m <= 110)) errs.push(`${name}.${sec.name}: ${ev.part} note ${m} out of range`);
    }
  }
  return errs;
}
