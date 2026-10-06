// Audio module tests (pure Node, no WebAudio): robustness without AudioContext, every contract SFX/track
// declared, scores valid, and every SFX / track exercised against a strict mock AudioContext.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Emitter } from '../src/core/events.js';
import { createAudio, SFX_NAMES, TRACK_NAMES, playSfxInto, buildGraph } from '../src/audio/audio.js';
import { SONGS } from '../src/audio/songs.js';
import { validateSong, Sequencer } from '../src/audio/sequencer.js';
import { Synth } from '../src/audio/synth.js';

const contracts = readFileSync(new URL('../docs/CONTRACTS.md', import.meta.url), 'utf8');
function listAfter(title) {
  const i = contracts.indexOf(title);
  assert.ok(i >= 0, `section ${title} in CONTRACTS.md`);
  const m = /`([^`]+)`/.exec(contracts.slice(i));
  return m[1].split(/[,\s]+/).filter(Boolean);
}
const CONTRACT_SFX = listAfter('### Noms de SFX');
const CONTRACT_TRACKS = listAfter('### Pistes musicales');

// ----------------------------------------------------------------------------- strict mock AudioContext
let nodeCount = 0;
function finite(v, what) { if (!Number.isFinite(v)) throw new TypeError(`${what}: non-finite ${v}`); }
class Param {
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v, t) { finite(v, 'setValueAtTime'); finite(t, 'time'); this.value = v; return this; }
  linearRampToValueAtTime(v, t) { finite(v, 'linearRamp'); finite(t, 'time'); return this; }
  exponentialRampToValueAtTime(v, t) { finite(v, 'expRamp'); finite(t, 'time'); if (v === 0) throw new RangeError('expRamp to 0'); return this; }
  setTargetAtTime(v, t, c) { finite(v, 'setTarget'); finite(t, 'time'); finite(c, 'tc'); return this; }
  cancelScheduledValues() { return this; }
}
class Node {
  constructor(ctx) { this.context = ctx; nodeCount++; this.outs = 0; }
  connect(dst) { if (!dst) throw new TypeError('connect(undefined)'); this.outs++; return dst; }
  disconnect() { this.outs = 0; }
}
class Source extends Node {
  start(t = 0) { finite(t, 'start'); if (this.started) throw new Error('start twice'); this.started = true; }
  stop(t = 0) { finite(t, 'stop'); if (!this.started) throw new Error('stop before start'); }
}
class MockCtx {
  constructor() { this.currentTime = 0; this.sampleRate = 44100; this.state = 'running'; this.destination = new Node(this); }
  createGain() { const n = new Node(this); n.gain = new Param(1); return n; }
  createOscillator() { const n = new Source(this); n.frequency = new Param(440); n.detune = new Param(0); n.type = 'sine'; n.setPeriodicWave = () => {}; return n; }
  createBiquadFilter() { const n = new Node(this); n.frequency = new Param(350); n.Q = new Param(1); n.gain = new Param(0); n.type = 'lowpass'; return n; }
  createBufferSource() { const n = new Source(this); n.playbackRate = new Param(1); n.buffer = null; n.loop = false; return n; }
  createBuffer(ch, len, sr) { finite(len, 'buffer len'); const data = Array.from({ length: ch }, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: (i) => data[i] }; }
  createDynamicsCompressor() { const n = new Node(this); for (const k of ['threshold', 'knee', 'ratio', 'attack', 'release']) n[k] = new Param(0); return n; }
  createConvolver() { const n = new Node(this); n.buffer = null; return n; }
  createDelay() { const n = new Node(this); n.delayTime = new Param(0); return n; }
  createWaveShaper() { const n = new Node(this); n.curve = null; return n; }
  createStereoPanner() { const n = new Node(this); n.pan = new Param(0); return n; }
  createPeriodicWave() { return {}; }
  resume() { this.state = 'running'; return Promise.resolve(); }
  suspend() { this.state = 'suspended'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
}

// ------------------------------------------------------------------------------------------------ tests
test('module imports and runs without WebAudio (Node)', () => {
  assert.equal(typeof globalThis.AudioContext, 'undefined');
  const bus = new Emitter();
  const audio = createAudio({ bus, save: { settings: { music: 0.7, sfx: 0.9 } } });
  assert.equal(typeof audio.unlock, 'function');
  assert.equal(typeof audio.setVolumes, 'function');
  assert.equal(typeof audio.dispose, 'function');
  // events before unlock are ignored silently
  bus.emit('music', { track: 'title' });
  bus.emit('sfx', { name: 'jump' });
  bus.emit('sfx', { name: 'does_not_exist' });
  bus.emit('music:mod', { invincible: true, rate: 0 });
  bus.emit('music:mod', { rate: 1 });
  audio.unlock(); // no AudioContext → no-op
  audio.setVolumes({ music: 0.2, sfx: 0 });
  audio.setVolumes({});
  assert.equal(audio.state.unlocked, false);
  assert.equal(audio.state.want, 'title');
  audio.dispose();
  for (const set of bus.map.values()) assert.equal(set.size, 0, 'listeners removed on dispose');
});

test('createAudio tolerates missing arguments', () => {
  const a = createAudio();
  a.unlock(); a.setVolumes({ music: 1 }); a.dispose();
  const b = createAudio({ bus: new Emitter(), save: {} });
  b.dispose();
});

test('every contract SFX name is implemented', () => {
  assert.ok(CONTRACT_SFX.length >= 50);
  for (const n of CONTRACT_SFX) assert.ok(SFX_NAMES.includes(n), `missing sfx ${n}`);
});

test('every contract music track is declared', () => {
  assert.ok(CONTRACT_TRACKS.length >= 20);
  for (const n of CONTRACT_TRACKS) assert.ok(TRACK_NAMES.includes(n), `missing track ${n}`);
});

test('every score is valid (parts, notes, chords, drum patterns, ranges)', () => {
  for (const [name, song] of Object.entries(SONGS)) assert.deepEqual(validateSong(song, name), [], name);
  assert.equal(SONGS.victory.loop, false, 'victory is a one-shot jingle');
  for (const n of TRACK_NAMES) if (n !== 'victory') assert.notEqual(SONGS[n].loop, false, `${n} loops`);
});

test('every SFX renders against a strict mock AudioContext', () => {
  const ctx = new MockCtx();
  const G = buildGraph(ctx);
  const S = new Synth(ctx);
  S.verbSend = G.sfxEchoIn;
  const state = {};
  for (const name of SFX_NAMES) {
    nodeCount = 0;
    const dur = playSfxInto(S, name, 0.01, G.sfxBus, { pitch: 1 }, state);
    assert.ok(dur > 0 && dur < 4, `${name} duration ${dur}`);
    assert.ok(nodeCount < 140, `${name} uses ${nodeCount} nodes`);
    playSfxInto(S, name, 0.5, G.sfxBus, { pitch: 1.3 }, state);
  }
  assert.equal(playSfxInto(S, 'nope', 0, G.sfxBus), 0);
});

test('every track schedules 40 s of music without errors and with a sane node budget', () => {
  const ctx = new MockCtx();
  const G = buildGraph(ctx);
  const S = new Synth(ctx);
  const budget = {};
  for (const name of TRACK_NAMES) {
    for (const mods of [{}, { invincible: true, boss: true, danger: true }]) {
      const seq = new Sequencer(S, SONGS[name], G.musicBus, { verb: G.verbIn, echo: G.echoIn }, { tempo: 1, ...mods });
      seq.start(0);
      nodeCount = 0;
      for (let t = 0; t < 40; t += 0.025) { seq.pump(t + 0.16, t); seq.applyMods(t); }
      assert.equal(seq.errors || 0, 0, `${name}: ${seq.lastError}`);
      const perSec = nodeCount / 40;
      if (!mods.invincible) budget[name] = Math.round(perSec);
      assert.ok(perSec < 450, `${name} ${JSON.stringify(mods)}: ${perSec.toFixed(0)} nodes/s`);
      if (name === 'victory') assert.ok(seq.done, 'victory ends');
      else assert.ok(!seq.done, `${name} keeps looping`);
      seq.stop(40, 0.5);
      seq.dispose();
    }
  }
  if (process.env.AUDIO_BUDGET) console.log(budget);
});

test('live engine with a mock AudioContext: unlock, music switching, mods, sfx polyphony, dispose', async () => {
  globalThis.AudioContext = MockCtx;
  try {
    const bus = new Emitter();
    const audio = createAudio({ bus, save: { settings: { music: 0.5, sfx: 0.5 } } });
    bus.emit('music', { track: 'title' }); // before unlock: remembered
    audio.unlock();
    assert.equal(audio.state.unlocked, true);
    assert.equal(audio.state.track, 'title');
    bus.emit('music', { track: 'title' }); // same track: not restarted
    assert.equal(audio.state.fading, 0);
    bus.emit('music', { track: 'beach' });
    assert.equal(audio.state.track, 'beach');
    assert.equal(audio.state.fading, 1, 'crossfade');
    bus.emit('music:mod', { invincible: true });
    assert.equal(audio.state.mods.invincible, true);
    bus.emit('music:mod', { rate: 0 });
    assert.equal(audio.state.paused, true);
    bus.emit('music:mod', { rate: 1, boss: true, danger: true });
    assert.equal(audio.state.paused, false);
    bus.emit('music', { track: 'jungle' });
    assert.equal(audio.state.mods.invincible, false, 'mods reset on track change');
    for (let i = 0; i < 60; i++) bus.emit('sfx', { name: SFX_NAMES[i % SFX_NAMES.length], vol: 0.8 });
    assert.ok(audio.state.voices <= 18, `voices capped (${audio.state.voices})`);
    bus.emit('sfx', { name: 'unknown_sound' });
    bus.emit('sfx', null);
    bus.emit('music', { track: 'no_such_track' });
    bus.emit('music', { track: '' });
    assert.equal(audio.state.track, '');
    audio.setVolumes({ music: 0, sfx: 0 });
    await new Promise((r) => setTimeout(r, 60)); // let the scheduler tick
    audio.dispose();
    for (const set of bus.map.values()) assert.equal(set.size, 0);
  } finally {
    delete globalThis.AudioContext;
  }
});
