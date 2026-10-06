// Lumen Bandicoot — audio engine (100 % procedural WebAudio: no samples, no files).
// Contract (docs/CONTRACTS.md): createAudio({ bus, save }) → { unlock(), setVolumes({ music, sfx }), dispose() }
// Listens to bus events: 'sfx' { name, vol?, pitch?, pos? }, 'music' { track } ('' = stop), 'music:mod'
// { invincible?, boss?, danger?, rate? }. Silently does nothing until unlock() (or the first user gesture)
// and never throws when WebAudio is missing (Node, old browsers).
import { Synth, makeImpulse, clamp } from './synth.js';
import { SFX, SFX_NAMES } from './sfx.js';
import { SONGS, TRACK_NAMES } from './songs.js';
import { Sequencer, LOOKAHEAD } from './sequencer.js';

export { SFX_NAMES, TRACK_NAMES };

export const MUSIC_LEVEL = 0.5;   // music bus trim (at settings.music = 1)
export const SFX_LEVEL = 0.75;    // sfx bus trim (at settings.sfx = 1)
const MAX_VOICES = 18;     // concurrent SFX events
const CROSSFADE = 0.9;     // seconds

/**
 * Master graph shared by the live engine and the offline renderer.
 *   music parts → musicBus ─┬→ musicLP (pause muffle) → musicDuck → musicVol ─┐
 *        sends → reverb/echo ┘                                                  ├→ comp → limiter → out
 *   sfx voices → sfxBus → sfxVol ───────────────────────────────────────────────┘
 */
export function buildGraph(ctx, out = ctx.destination, opts = {}) {
  const g = (v) => { const n = ctx.createGain(); n.gain.value = v; return n; };
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 10; comp.ratio.value = 4;
  comp.attack.value = 0.004; comp.release.value = 0.2;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20;
  limiter.attack.value = 0.001; limiter.release.value = 0.1;
  const master = g(0.95);
  if (opts.raw) master.connect(out); // debug: measure levels before the dynamics
  else { master.connect(comp); comp.connect(limiter); limiter.connect(out); }

  const musicVol = g(MUSIC_LEVEL); musicVol.connect(master);
  const musicDuck = g(1); musicDuck.connect(musicVol);
  const musicLP = ctx.createBiquadFilter(); musicLP.type = 'lowpass'; musicLP.frequency.value = 20000; musicLP.Q.value = 0.5;
  musicLP.connect(musicDuck);
  const musicBus = g(1); musicBus.connect(musicLP);

  // music reverb (one convolver, shared by every track)
  const verbIn = g(1);
  let verb = null;
  try {
    verb = ctx.createConvolver();
    verb.buffer = makeImpulse(ctx, 1.6, 2.6);
    const verbOut = g(0.8);
    verbIn.connect(verb); verb.connect(verbOut); verbOut.connect(musicLP);
  } catch { verbIn.connect(musicLP); }
  // music echo (tempo-synced delay, set per song)
  const echoIn = g(1);
  const echo = ctx.createDelay(1.5); echo.delayTime.value = 0.33;
  const echoFb = g(0.32);
  const echoLP = ctx.createBiquadFilter(); echoLP.type = 'lowpass'; echoLP.frequency.value = 2400;
  echoIn.connect(echo); echo.connect(echoLP); echoLP.connect(echoFb); echoFb.connect(echo);
  const echoOut = g(0.7); echoLP.connect(echoOut); echoOut.connect(musicLP);

  const sfxVol = g(SFX_LEVEL); sfxVol.connect(master);
  const sfxBus = g(1); sfxBus.connect(sfxVol);
  // tiny slap-back for sparkly SFX (cheap alternative to a second reverb)
  const sfxEchoIn = g(1);
  const sfxEcho = ctx.createDelay(0.5); sfxEcho.delayTime.value = 0.12;
  const sfxEchoFb = g(0.3);
  const sfxEchoLP = ctx.createBiquadFilter(); sfxEchoLP.type = 'lowpass'; sfxEchoLP.frequency.value = 3500;
  sfxEchoIn.connect(sfxEcho); sfxEcho.connect(sfxEchoLP); sfxEchoLP.connect(sfxEchoFb); sfxEchoFb.connect(sfxEcho);
  const sfxEchoOut = g(0.5); sfxEchoLP.connect(sfxEchoOut); sfxEchoOut.connect(sfxBus);

  return { comp, limiter, master, musicVol, musicDuck, musicLP, musicBus, verbIn, verb, echoIn, echo, sfxVol, sfxBus, sfxEchoIn };
}

/** Play one SFX into `dest` at time t. Returns its duration (seconds) or 0 if unknown. */
export function playSfxInto(S, name, t, dest, opts = {}, state = {}) {
  const def = SFX[name];
  if (!def) return 0;
  const p = clamp(Number(opts.pitch) || 1, 0.25, 4);
  return def.play(S, t, dest, p, state) || 0.3;
}

export function createAudio({ bus, save } = {}) {
  const settings = () => (save && save.settings) || {};
  const vol = {
    music: clamp(Number(settings().music ?? 0.7), 0, 1),
    sfx: clamp(Number(settings().sfx ?? 0.9), 0, 1),
  };
  let ctx = null, S = null, G = null;
  let timer = null;
  let disposed = false;
  let wantTrack = null;     // requested track name ('' or null = none)
  let pendingStart = false; // a track was requested before the context existed
  let current = null;      // { name, seq }
  const fading = [];        // sequencers fading out
  const mods = { invincible: false, boss: false, danger: false, tempo: 1, mute: false };
  let paused = false;
  const voices = [];        // { g, end, prio, name }
  const lastPlay = new Map();
  const sfxState = {};
  let listener = null;
  const offs = [];

  // ------------------------------------------------------------------ context
  function unlock() {
    if (disposed) return;
    try {
      if (!ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        if (!AC) return;
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
        S = new Synth(ctx);
        G = buildGraph(ctx);
        S.verbSend = G.sfxEchoIn;
        applyVolumes(true);
        // iOS: play a 1-sample silent buffer inside the gesture to fully unlock output
        try {
          const b = ctx.createBuffer(1, 1, ctx.sampleRate);
          const src = ctx.createBufferSource(); src.buffer = b; src.connect(ctx.destination); src.start(0);
        } catch { /* ignore */ }
        timer = setInterval(tick, 25);
      }
      if (ctx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) ctx.resume().catch(() => {});
      if (pendingStart) { pendingStart = false; if (wantTrack) startTrack(wantTrack); }
    } catch (err) {
      console.warn('[audio] unlock failed', err);
    }
  }
  const ready = () => !!(ctx && S && ctx.state !== 'closed');

  function applyVolumes(instant = false) {
    if (!ready()) return;
    const t = ctx.currentTime;
    const set = (param, v) => { if (instant) param.value = v; else param.setTargetAtTime(v, t, 0.04); };
    set(G.musicVol.gain, MUSIC_LEVEL * vol.music * vol.music); // perceptual-ish curve
    set(G.sfxVol.gain, SFX_LEVEL * vol.sfx * vol.sfx);
    mods.mute = vol.music <= 0.001;
  }

  function setVolumes(v = {}) {
    if (v.music != null) vol.music = clamp(Number(v.music) || 0, 0, 1);
    if (v.sfx != null) vol.sfx = clamp(Number(v.sfx) || 0, 0, 1);
    applyVolumes();
  }

  // ------------------------------------------------------------------ music
  function startTrack(name) {
    if (!ready()) return;
    const song = SONGS[name];
    const t = ctx.currentTime + 0.05;
    if (current) { current.seq.stop(t, CROSSFADE); fading.push(current.seq); current = null; }
    // a new track resets the per-level modifiers (disco from the previous level must not leak)
    mods.invincible = false; mods.boss = false; mods.danger = false;
    if (!song) return;
    try {
      const seq = new Sequencer(S, song, G.musicBus, { verb: G.verbIn, echo: G.echoIn }, mods);
      const beat = 60 / song.bpm;
      G.echo.delayTime.setTargetAtTime(clamp(song.echoTime || beat * 0.75, 0.05, 1.2), t, 0.05);
      seq.start(t + (fading.length ? 0.15 : 0), fading.length ? 0.6 : 0.05);
      current = { name, seq };
    } catch (err) { console.warn('[audio] track failed', name, err); }
  }

  function music(track) {
    const name = track || '';
    if (name === wantTrack && current && current.name === name) return; // same track: keep playing
    wantTrack = name;
    if (!ready()) { pendingStart = true; return; }
    if (!name) { if (current) { current.seq.stop(ctx.currentTime, CROSSFADE); fading.push(current.seq); current = null; } return; }
    if (current && current.name === name && !current.seq.done) return;
    startTrack(name);
  }

  function musicMod(p = {}) {
    if (p.invincible != null) mods.invincible = !!p.invincible;
    if (p.boss != null) mods.boss = !!p.boss;
    if (p.danger != null) mods.danger = !!p.danger;
    if (p.rate != null) {
      const r = Number(p.rate);
      paused = !(r > 0.05);
      if (!paused) mods.tempo = clamp(r, 0.5, 1.5);
      if (ready()) {
        const t = ctx.currentTime;
        G.musicLP.frequency.setTargetAtTime(paused ? 520 : 20000, t, paused ? 0.06 : 0.12);
        G.musicDuck.gain.setTargetAtTime(paused ? 0.4 : 1, t, 0.08);
      }
    }
    if (ready() && current) current.seq.applyMods(ctx.currentTime);
  }

  // ------------------------------------------------------------------ sfx
  function sfx(p) {
    if (!p || !ready() || ctx.state !== 'running') return;
    const name = p.name;
    const def = SFX[name];
    if (!def || vol.sfx <= 0.001) return;
    const now = ctx.currentTime;
    const last = lastPlay.get(name);
    if (last != null && now - last < (def.gap ?? 0.03)) return;
    let v = p.vol == null ? 1 : clamp(Number(p.vol) || 0, 0, 2);
    if (p.pos && listener) v *= distanceGain(p.pos);
    if (v < 0.02) return;
    // polyphony: per-name cap, then global cap (steal the oldest, lowest-priority voice)
    reap(now);
    const prio = def.prio ?? 1;
    const same = voices.filter((x) => x.name === name);
    if (def.max && same.length >= def.max) steal(same[0]);
    if (voices.length >= MAX_VOICES) {
      let victim = null;
      for (const x of voices) if (x.prio <= prio && (!victim || x.prio < victim.prio || (x.prio === victim.prio && x.start < victim.start))) victim = x;
      if (!victim) return; // everything playing is more important
      steal(victim);
    }
    lastPlay.set(name, now);
    try {
      const g = ctx.createGain();
      g.gain.value = v;
      g.connect(G.sfxBus);
      const t = now + 0.005;
      const dur = playSfxInto(S, name, t, g, p, sfxState);
      voices.push({ g, name, prio, start: now, end: t + dur + 0.1 });
    } catch (err) { console.warn('[audio] sfx failed', name, err); }
  }

  function steal(x) {
    const i = voices.indexOf(x);
    if (i >= 0) voices.splice(i, 1);
    try {
      const t = ctx.currentTime;
      x.g.gain.cancelScheduledValues(t);
      x.g.gain.setValueAtTime(x.g.gain.value, t);
      x.g.gain.linearRampToValueAtTime(0, t + 0.03);
      setTimeout(() => { try { x.g.disconnect(); } catch { /* */ } }, 80);
    } catch { /* */ }
  }

  function reap(now) {
    for (let i = voices.length - 1; i >= 0; i--) {
      if (voices[i].end < now) { try { voices[i].g.disconnect(); } catch { /* */ } voices.splice(i, 1); }
    }
  }

  function distanceGain(pos) {
    const l = listener.position || listener;
    if (!l || pos.x == null) return 1;
    const dx = pos.x - l.x, dy = pos.y - l.y, dz = pos.z - l.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return clamp(1.15 - d / 45, 0, 1);
  }

  // ------------------------------------------------------------------ scheduler tick
  function tick() {
    if (!ready() || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const until = now + LOOKAHEAD;
    if (current) {
      current.seq.pump(until, mods.mute ? Infinity : now);
      if (current.seq.done && now > current.seq.endTime) { current.seq.dispose(); current = null; }
    }
    for (let i = fading.length - 1; i >= 0; i--) {
      const s = fading[i];
      s.pump(until, now);
      if (now > s.endTime || (s.done && now > s.endTime)) { s.dispose(); fading.splice(i, 1); }
    }
    reap(now);
  }

  // ------------------------------------------------------------------ wiring
  if (bus && typeof bus.on === 'function') {
    const safe = (fn) => (p) => { try { fn(p || {}); } catch (err) { console.warn('[audio]', err); } };
    offs.push(bus.on('sfx', safe(sfx)));
    offs.push(bus.on('music', safe((p) => music(p.track))));
    offs.push(bus.on('music:mod', safe(musicMod)));
  }
  const onGesture = () => unlock();
  const onVis = () => {
    if (!ctx) return;
    try { if (document.hidden) ctx.suspend().catch(() => {}); else ctx.resume().catch(() => {}); } catch { /* */ }
  };
  if (typeof window !== 'undefined' && window.addEventListener) {
    for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) window.addEventListener(ev, onGesture, { capture: true, passive: true });
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('visibilitychange', onVis);

  function dispose() {
    disposed = true;
    offs.forEach((f) => { try { f(); } catch { /* */ } });
    offs.length = 0;
    if (typeof window !== 'undefined' && window.removeEventListener) {
      for (const ev of ['pointerdown', 'keydown', 'touchend', 'mousedown']) window.removeEventListener(ev, onGesture, { capture: true });
    }
    if (typeof document !== 'undefined' && document.removeEventListener) document.removeEventListener('visibilitychange', onVis);
    if (timer) clearInterval(timer);
    timer = null;
    try { current?.seq.dispose(); fading.forEach((s) => s.dispose()); } catch { /* */ }
    current = null; fading.length = 0; voices.length = 0;
    try { ctx?.close(); } catch { /* */ }
    ctx = null; S = null; G = null;
  }

  return {
    unlock,
    setVolumes,
    dispose,
    /** Optional: give the engine a listener (camera / player object with .position or {x,y,z}) for distance falloff. */
    setListener(obj) { listener = obj || null; },
    // conveniences for UI / debug tools
    play(name, opts = {}) { sfx({ ...opts, name }); },
    music,
    mod: musicMod,
    get context() { return ctx; },
    get state() {
      return { unlocked: !!ctx, ctx: ctx?.state || 'none', track: current?.name || '', want: wantTrack, voices: voices.length, fading: fading.length, mods: { ...mods }, paused, vol: { ...vol } };
    },
  };
}
