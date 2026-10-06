// Lumen Bandicoot — offline rendering helpers for QA tools (tools/audio-check.mjs). Not used by the game.
// Renders one SFX or a slice of a track through the real master graph with OfflineAudioContext and
// returns level statistics (peak, RMS, loudest 100 ms window, clipping, silence).
import { buildGraph, playSfxInto, MUSIC_LEVEL, SFX_LEVEL } from './audio.js';
import { Synth } from './synth.js';
import { Sequencer } from './sequencer.js';
import { SONGS } from './songs.js';

export async function renderOffline(kind, name, { seconds = 3, mods = {}, sampleRate = 44100, pitch = 1, raw = false, music = 0.7, sfx = 0.9, keep = false } = {}) {
  const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
  const ctx = new OAC(2, Math.ceil(sampleRate * seconds), sampleRate);
  const G = buildGraph(ctx, ctx.destination, { raw });
  G.musicVol.gain.value = MUSIC_LEVEL * music * music;
  G.sfxVol.gain.value = SFX_LEVEL * sfx * sfx;
  const S = new Synth(ctx);
  S.verbSend = G.sfxEchoIn;
  let seq = null;
  if (kind === 'sfx') {
    const v = ctx.createGain(); v.connect(G.sfxBus);
    playSfxInto(S, name, 0.02, v, { pitch }, {});
  } else {
    seq = new Sequencer(S, SONGS[name], G.musicBus, { verb: G.verbIn, echo: G.echoIn }, { tempo: 1, ...mods });
    G.echo.delayTime.value = SONGS[name].echoTime || (60 / SONGS[name].bpm) * 0.75;
    seq.start(0.02);
    seq.pump(seconds, -Infinity);
  }
  const buf = await ctx.startRendering();
  if (keep) return buf;
  return { ...analyse(buf), errors: seq?.errors || 0 };
}

export function analyse(buf) {
  const L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  const n = L.length, sr = buf.sampleRate;
  let peak = 0, sum = 0, clip = 0, last = 0;
  const win = Math.floor(sr * 0.1);
  let wsum = 0, wmax = 0;
  for (let i = 0; i < n; i++) {
    const a = Math.max(Math.abs(L[i]), Math.abs(R[i]));
    if (a > peak) peak = a;
    if (a >= 0.999) clip++;
    if (a > 0.003) last = i;
    const e = (L[i] * L[i] + R[i] * R[i]) / 2;
    sum += e; wsum += e;
    if (i >= win) { const o = (L[i - win] * L[i - win] + R[i - win] * R[i - win]) / 2; wsum -= o; }
    if (i >= win && wsum > wmax) wmax = wsum;
  }
  return {
    peak: +peak.toFixed(3),
    rms: +Math.sqrt(sum / n).toFixed(4),
    loud: +Math.sqrt(wmax / win).toFixed(4),
    clip,
    tail: +(last / sr).toFixed(2),
    silent: peak < 0.01,
  };
}

/** Draws a log-frequency spectrogram of an AudioBuffer onto a canvas (QA visualisation). */
export function spectrogram(buf, canvas, { fft = 1024, hop = 256, fmin = 40, fmax = 12000 } = {}) {
  const x = buf.getChannelData(0), sr = buf.sampleRate;
  const cols = Math.floor((x.length - fft) / hop);
  const W = canvas.width = Math.min(1600, cols), H = canvas.height = 300;
  const g = canvas.getContext('2d');
  const img = g.createImageData(W, H);
  const re = new Float32Array(fft), im = new Float32Array(fft);
  const win = Float32Array.from({ length: fft }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (fft - 1)));
  for (let c = 0; c < W; c++) {
    const off = Math.floor((c * cols) / W) * hop;
    for (let i = 0; i < fft; i++) { re[i] = x[off + i] * win[i]; im[i] = 0; }
    fftInPlace(re, im);
    for (let y = 0; y < H; y++) {
      const f = fmin * Math.pow(fmax / fmin, 1 - y / H);
      const k = Math.min(fft / 2 - 1, Math.round((f * fft) / sr));
      const mag = Math.hypot(re[k], im[k]);
      const db = 20 * Math.log10(mag + 1e-9);
      const v = Math.max(0, Math.min(1, (db + 60) / 60));
      const p = (y * W + c) * 4;
      img.data[p] = 255 * Math.min(1, v * 1.6); img.data[p + 1] = 255 * Math.max(0, v * 1.6 - 0.6); img.data[p + 2] = 80 + 100 * v; img.data[p + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
}

function fftInPlace(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k), wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2], ai = im[i + k + len / 2];
        const tr = ar * wr - ai * wi, ti = ar * wi + ai * wr;
        re[i + k + len / 2] = re[i + k] - tr; im[i + k + len / 2] = im[i + k] - ti;
        re[i + k] += tr; im[i + k] += ti;
      }
    }
  }
}
