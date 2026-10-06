// Lumen Bandicoot — boot, render loop and the game flow (title → story → map → level → results …).
import * as THREE from 'three';
import { bus } from './core/events.js';
import { input } from './core/input.js';
import { CameraRig } from './core/camera.js';
import { FX } from './core/fx.js';
import { loadSave, writeSave } from './game/save.js';
import { Game, POWERS_BY_BOSS } from './game/game.js';
import { Level } from './game/level.js';
import './game/entities/index.js';
import { LEVELS, WORLDS, ORDER, isUnlocked, worldOf, goldSockCount } from './levels/index.js';
import { createAudio } from './audio/audio.js';
import { createUI } from './ui/ui.js';

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');

// ---------------------------------------------------------------- quality
const coarse = matchMedia('(pointer: coarse)').matches;
const isTouch = coarse || 'ontouchstart' in window;
function pickQuality(setting) {
  if (setting === 'low') return 0;
  if (setting === 'medium') return 1;
  if (setting === 'high') return 2;
  const mem = navigator.deviceMemory || 4;
  if (coarse) return mem >= 6 ? 1 : 0;
  return 2;
}

const save = loadSave();
let qualityLevel = pickQuality(params.get('quality') || save.settings.quality);
const quality = { level: qualityLevel, shadows: qualityLevel >= 1 };

// ---------------------------------------------------------------- renderer
const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: qualityLevel >= 1, powerPreference: 'high-performance', preserveDrawingBuffer: DEBUG });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = quality.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.1, 400);
const rig = new CameraRig(camera);
rig.reduceMotion = !!save.settings.reduceMotion;
const fx = new FX(scene, qualityLevel);

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  const maxDpr = [1.25, 1.6, 2][qualityLevel];
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxDpr));
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // portrait phones: widen the view a little so the level stays readable
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

input.attach(window);

// ---------------------------------------------------------------- systems
const game = new Game(save);
const audio = createAudio({ bus, save });
const ui = createUI({
  root: document.getElementById('ui'), bus, input, save, worlds: WORLDS, levels: LEVELS, order: ORDER,
  isUnlocked: (id) => isUnlocked(id, save), goldSockCount: () => goldSockCount(save), audio, isTouch,
  onSettingsChange: applySettings, game,
});
document.getElementById('boot')?.remove();

bus.on('shake', (p) => rig.shake(p?.amount ?? 0.3));

function applySettings() {
  writeSave(save);
  audio.setVolumes?.({ music: save.settings.music, sfx: save.settings.sfx });
  rig.reduceMotion = !!save.settings.reduceMotion;
  const q = pickQuality(save.settings.quality);
  if (q !== qualityLevel) {
    qualityLevel = q; quality.level = q; quality.shadows = q >= 1;
    renderer.shadowMap.enabled = quality.shadows;
    resize();
  }
}

// ---------------------------------------------------------------- loop
let level = null;
let paused = false;
let pausePending = false;
let last = performance.now();
const STEP = 1 / 90;
let fpsAcc = 0, fpsFrames = 0, fps = 60;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 1 / 20);
  fpsAcc += dt; fpsFrames++;
  if (fpsAcc > 0.5) { fps = fpsFrames / fpsAcc; fpsAcc = 0; fpsFrames = 0; }
  input.update();

  if (level && !paused) {
    if (input.pressed('pause') && !level.finished && !pausePending) openPause();
    let remaining = dt;
    while (remaining > 1e-6) {
      const h = Math.min(STEP, remaining);
      game.update(h);
      level.update(h);
      remaining -= h;
    }
    fx.update(dt);
    rig.update(level.player, dt);
  }
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);

async function openPause() {
  pausePending = true;
  paused = true;
  bus.emit('sfx', { name: 'menu_back' });
  bus.emit('music:mod', { rate: 0.0 });
  const choice = await ui.pause();
  bus.emit('music:mod', { rate: 1 });
  paused = false;
  pausePending = false;
  input.update(); // swallow the button that closed the menu
  if (choice === 'restart') levelSignal?.({ type: 'restart' });
  else if (choice === 'map') levelSignal?.({ type: 'quit' });
}
// on mobile, leaving the app pauses
document.addEventListener('visibilitychange', () => { if (document.hidden && level && !paused && !level.finished) openPause(); });

// ---------------------------------------------------------------- flow
let levelSignal = null;

function shared() {
  return { scene, camera, rig, game, fx, quality, lang: save.lang, renderer };
}

function startLevel(id, timeTrial) {
  if (level) { level.dispose(); level = null; }
  const data = LEVELS[id];
  if (!data) throw new Error(`Unknown level ${id}`);
  game.timeTrial = !!timeTrial;
  game.timer = 0; game.freezeT = 0;
  game.masks = 0; game.invincibleT = 0;
  if (game.lives < 0) game.lives = 4;
  level = new Level(data, shared());
  save.lastLevel = id;
  bus.emit('music', { track: data.music || data.theme });
  bus.emit('level:start', { id, data, timeTrial: !!timeTrial });
  if (data.intro) bus.emit('toast', { text: data.intro, kind: 'big', duration: 3.2 });
  ui.hud.show(data);
  ui.touch.setVisible(isTouch);
  return level;
}

function stopLevel() {
  if (level) { level.dispose(); level = null; }
  ui.hud.hide();
  ui.touch.setVisible(false);
}

function playLevel(id, timeTrial) {
  return new Promise((resolve) => {
    const offs = [];
    const done = (r) => { offs.forEach((f) => f()); levelSignal = null; resolve(r); };
    offs.push(bus.on('level:complete', (stats) => done({ type: 'complete', stats })));
    offs.push(bus.on('level:gameover', () => done({ type: 'gameover' })));
    levelSignal = (r) => done(r);
    try { startLevel(id, timeTrial); } catch (err) { console.error(err); done({ type: 'error', err }); }
  });
}

const SPOONS = ['gold', 'silver', 'bronze'];
function recordResult(id, stats) {
  const data = LEVELS[id];
  const prev = save.levels[id] || {};
  const firstClear = !prev.done;
  const rec = { ...prev, done: true };
  let goldSock = false, newSpoon = null;
  if (stats.allCrates && !prev.crates) { rec.crates = true; goldSock = true; }
  rec.socks = [...new Set([...(prev.socks || []), ...stats.socks])];
  rec.deaths = (prev.deaths || 0) + stats.deaths;
  if (stats.timeTrial) {
    if (!prev.bestTime || stats.time < prev.bestTime) rec.bestTime = stats.time;
    const tt = data.timeTrial || {};
    const got = stats.time <= tt.gold ? 'gold' : stats.time <= tt.silver ? 'silver' : stats.time <= tt.bronze ? 'bronze' : null;
    if (got && (!prev.spoon || SPOONS.indexOf(got) < SPOONS.indexOf(prev.spoon))) { rec.spoon = got; newSpoon = got; }
  }
  save.levels[id] = rec;
  let powerUnlocked = null;
  if (data.mode === 'boss' && POWERS_BY_BOSS[id] && game.unlockPower(POWERS_BY_BOSS[id])) powerUnlocked = POWERS_BY_BOSS[id];
  if (goldSock) {
    const scarves = ['#e98c73', '#7ad7c4', '#ffd76a', '#c58cff', '#ff7aa8', '#7ab8ff', '#ffffff', '#1c1640'];
    const n = goldSockCount(save);
    const c = scarves[Math.min(scarves.length - 1, Math.floor(n / 3))];
    if (!save.unlockedScarves.includes(c)) save.unlockedScarves.push(c);
  }
  game.persist();
  return { goldSock, newSpoon, powerUnlocked, firstClear };
}

const STORY_AFTER = { B1: 'island2', B2: 'island3', B3: 'island4', B4: 'ending', BS: 'secret_ending' };

async function runLevel(id, timeTrial) {
  for (;;) {
    const r = await playLevel(id, timeTrial);
    if (r.type === 'restart') { continue; }
    if (r.type === 'complete') {
      stopLevel();
      const extra = recordResult(id, r.stats);
      bus.emit('music', { track: 'results' });
      await ui.results(r.stats, extra);
      if (extra.powerUnlocked) await ui.powerUnlocked(extra.powerUnlocked);
      const story = STORY_AFTER[id];
      if (story && extra.firstClear) await showStory(story);
      if (id === 'B4' && extra.firstClear && goldSockCount(save) >= 12) await showStory('secret');
      return;
    }
    if (r.type === 'gameover') {
      stopLevel();
      bus.emit('music', { track: 'gameover' });
      const c = await ui.gameOver();
      game.lives = 4; game.lights = 0;
      game.persist();
      if (c === 'continue') continue;
      return;
    }
    stopLevel();
    return;
  }
}

async function showStory(id) {
  await ui.story(id);
  if (!save.seenStories.includes(id)) save.seenStories.push(id);
  writeSave(save);
}

async function main() {
  bus.emit('music', { track: 'title' });
  const direct = params.get('level');
  if (direct && LEVELS[direct]) {
    await runLevel(direct, params.has('tt'));
  } else {
    await ui.title();
    audio.unlock?.();
    if (!save.seenStories.includes('intro')) await showStory('intro');
  }
  for (;;) {
    bus.emit('music', { track: 'map' });
    const pick = await ui.map({ save, game });
    if (!pick || !LEVELS[pick.levelId]) continue;
    await runLevel(pick.levelId, pick.timeTrial);
  }
}

// ---------------------------------------------------------------- debug / QA hooks
window.__LB = {
  get level() { return level; }, get player() { return level?.player; }, game, save, LEVELS, ORDER, bus, input, rig,
  get fps() { return fps; },
  play(id, tt = false) { levelSignal?.({ type: 'quit' }); setTimeout(() => runLevel(id, tt), 50); },
  setPower(p) { if (!save.powers.includes(p)) save.powers.push(p); },
  teleport(x, y, z) { level?.player.pos.set(x, y, z); },
  completeLevel() { level?.complete(); },
  unlockAll() { for (const id of ORDER) save.levels[id] = { ...(save.levels[id] || {}), done: true }; writeSave(save); },
  worldOf,
};

main().catch((err) => {
  console.error(err);
  const d = document.createElement('pre');
  d.style.cssText = 'position:fixed;inset:auto 0 0 0;color:#fff;background:#a33;padding:8px;font:12px monospace;z-index:99;white-space:pre-wrap';
  d.textContent = String(err?.stack || err);
  document.body.appendChild(d);
});
