// Node tests (no DOM) for enemies / hazards / platforms (agent Ennemis). Run: node --test tests/enemies.test.js
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { StaticWorld, bodyBox } from '../src/core/physics.js';
import { createEntity } from '../src/core/registry.js';
import { ENEMY_KINDS } from '../src/game/entities/enemies.js';
import { HAZARD_KINDS } from '../src/game/entities/hazards.js';
import { PLATFORM_KINDS } from '../src/game/entities/hazard-platforms.js';

const ENEMIES = ['crab', 'turtle', 'plant', 'bat', 'porcupine', 'scorpion', 'camel', 'pigeon', 'cat', 'penguin', 'yetiKid',
  'robot', 'drone', 'cactus', 'skunk', 'rat', 'chicken'];
const HAZARDS = ['spikes', 'fireJet', 'pendulum', 'crusher', 'laser', 'water', 'lava', 'saw', 'barrels', 'wind', 'boulder'];
const PLATFORMS = ['moving', 'falling', 'sinking', 'bouncy', 'rotating', 'vanishing'];

function makeCtx(theme = 'beach') {
  const world = new StaticWorld();
  world.add({ min: { x: -20, y: -4, z: -200 }, max: { x: 20, y: 0, z: 20 }, kind: 'ground' });
  const half = { x: 0.3, y: 0.56, z: 0.3 };
  const player = {
    pos: new THREE.Vector3(0, 0, 8), vel: new THREE.Vector3(), ext: new THREE.Vector3(), half,
    box: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }, spinBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    grounded: true, groundSolid: null, dead: false, spinning: false, sliding: false, invincible: false, hurtT: 0, bounced: 0,
    syncBox() { bodyBox(this.pos, half, this.box); },
    bounce(vy = 12.5) { this.vel.y = vy; this.bounced = vy; this.grounded = false; },
    launch(x, y, z) { this.vel.set(x, y, z); },
    getSpinBox() { const r = 1.05, b = this.spinBox; b.min.x = this.pos.x - r; b.max.x = this.pos.x + r; b.min.z = this.pos.z - r; b.max.z = this.pos.z + r; b.min.y = this.pos.y - 0.1; b.max.y = this.pos.y + 1.2; return b; },
  };
  const game = {
    lights: 12, masks: 0, hurts: [], kills: [],
    hurt(c) { this.hurts.push(c); return true; }, kill(c) { this.kills.push(c); player.dead = true; },
    addLights(n) { this.lights += n; },
  };
  const gone = new Set();
  const level = {
    world, data: { spawn: [0, 0, 0] }, checkpoint: [0, 0, 0], finished: false, entities: [], solids: [],
    markGone: (id) => gone.add(id), isCommitted: () => false, gone, spawn() { return null; },
  };
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.1, 400);
  camera.position.set(0, 3.5, 15); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
  const ctx = {
    scene: new THREE.Scene(), camera, level, player, game, time: 0, lang: 'fr', theme,
    quality: { level: 1, shadows: false }, sfx() {}, shake() {},
    fx: { burst() {}, ring() {}, text() { ctx.texts = (ctx.texts || 0) + 1; } },
  };
  player.syncBox();
  return ctx;
}
let nid = 0;
const make = (ctx, type, kind, extra = {}) => createEntity({ type, kind, x: 0, y: 0, z: 0, id: `t${nid++}`, ...extra }, ctx);
function step(ctx, ents, seconds, each) {
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    ctx.time += dt;
    for (const e of ents) if (!e.dead) e.update?.(dt, ctx);
    each?.();
  }
}
const overlap = (a, b) => a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y && a.min.z < b.max.z && a.max.z > b.min.z;

test('catalogue is complete', () => {
  for (const k of ENEMIES) assert.ok(ENEMY_KINDS.includes(k), `enemy ${k}`);
  for (const k of HAZARDS) assert.ok(HAZARD_KINDS.includes(k), `hazard ${k}`);
  for (const k of PLATFORMS) assert.ok(PLATFORM_KINDS.includes(k), `platform ${k}`);
});

test('every enemy builds and lives 6 s near and far from the player, in every world', () => {
  for (const theme of ['beach', 'desert', 'ice', 'factory']) {
    for (const kind of ENEMIES) {
      const ctx = makeCtx(theme);
      const e = make(ctx, 'enemy', kind);
      assert.ok(e && e.object3d && e.box, kind);
      ctx.player.pos.set(1.5, 0, 2.5); ctx.player.syncBox();
      step(ctx, [e], 3);
      ctx.player.pos.set(30, 0, 30); ctx.player.syncBox();
      step(ctx, [e], 3);
      assert.ok(Number.isFinite(e.pos.x + e.pos.y + e.pos.z), `${kind} position finite`);
    }
  }
});

test('stomp squashes, bounces and marks the enemy gone; spin kicks it to the camera', () => {
  const ctx = makeCtx();
  const crab = make(ctx, 'enemy', 'crab', { patrol: false });
  ctx.player.pos.set(0, 0.5, 0); ctx.player.vel.y = -5; ctx.player.syncBox();
  crab.onTouch(ctx.player, ctx, { fromAbove: true });
  assert.equal(crab.state, 'squash');
  assert.ok(ctx.player.bounced > 0);
  assert.ok(ctx.level.gone.has(crab.def.id));
  step(ctx, [crab], 1.2);
  assert.ok(crab.dead);

  const s = make(ctx, 'enemy', 'scorpion', { patrol: false });
  ctx.player.dead = false;
  s.onSpin(ctx.player, ctx);
  assert.equal(s.state, 'kick');
  let minD = 99;
  step(ctx, [s], 2, () => { if (!s.dead) minD = Math.min(minD, s.body.position.distanceTo(ctx.camera.position)); });
  assert.ok(minD < 2.6, `flew to the lens (min ${minD.toFixed(2)})`);
  assert.ok(ctx.texts >= 1, 'SPLAT text');
  assert.ok(s.dead);
});

test('side touch hurts, harmless gags do not', () => {
  const ctx = makeCtx();
  const crab = make(ctx, 'enemy', 'crab');
  crab.onTouch(ctx.player, ctx, { fromAbove: false });
  assert.deepEqual(ctx.game.hurts, ['generic']);
  const plant = make(ctx, 'enemy', 'plant');
  plant.onTouch(ctx.player, ctx, { fromAbove: false });
  assert.equal(ctx.game.hurts.at(-1), 'eaten');
  const chicken = make(ctx, 'enemy', 'chicken');
  const cat = make(ctx, 'enemy', 'cat');
  const n = ctx.game.hurts.length;
  chicken.onTouch(ctx.player, ctx, { fromAbove: false });
  cat.onTouch(ctx.player, ctx, { fromAbove: false });
  assert.equal(ctx.game.hurts.length, n);
  ctx.player.vel.y = -3;
  chicken.onTouch(ctx.player, ctx, { fromAbove: true });
  assert.ok(ctx.player.bounced > 0, 'bounce on the chicken');
  assert.equal(chicken.state, 'live');
});

test('turtle flips then becomes a trampoline; spiked porcupine cannot be stomped', () => {
  const ctx = makeCtx();
  const t = make(ctx, 'enemy', 'turtle');
  ctx.player.vel.y = -4;
  t.onTouch(ctx.player, ctx, { fromAbove: true });
  assert.equal(t.st, 'flipped');
  ctx.player.vel.y = -4;
  t.onTouch(ctx.player, ctx, { fromAbove: true });
  assert.ok(ctx.player.bounced >= 16);
  t.onTouch(ctx.player, ctx, { fromAbove: false });
  assert.equal(ctx.game.hurts.length, 0, 'flipped turtle is harmless');

  const p = make(ctx, 'enemy', 'porcupine');
  p.st = 'spiked'; p.stT = -10;
  ctx.player.vel.y = -4;
  p.onTouch(ctx.player, ctx, { fromAbove: true });
  assert.equal(p.state, 'live');
  assert.equal(ctx.game.hurts.length, 1);
});

test('cat steals 5 fireflies, spin gives them back', () => {
  const ctx = makeCtx();
  const cat = make(ctx, 'enemy', 'cat');
  ctx.player.pos.set(0, 0, 2); ctx.player.syncBox();
  step(ctx, [cat], 0.1);
  assert.equal(ctx.game.lights, 7);
  assert.equal(cat.st, 'flee');
  cat.onSpin(ctx.player, ctx);
  assert.equal(ctx.game.lights, 12);
});

test('enemy onRespawn restores position and state', () => {
  const ctx = makeCtx();
  const r = make(ctx, 'enemy', 'robot', { x: 2 });
  ctx.player.pos.set(2, 0, 3); ctx.player.syncBox();
  step(ctx, [r], 2);
  assert.notEqual(r.st, 'roam');
  r.onRespawn(ctx);
  assert.equal(r.st, 'roam');
  assert.equal(r.pos.x, 2);
});

test('moving platform: bottom at def.y, delta = per-frame displacement, box follows', () => {
  const ctx = makeCtx();
  const m = make(ctx, 'platform', 'moving', { y: -0.5, w: 2, h: 0.5, d: 2, to: { x: 0, y: 0, z: -6 }, period: 4 });
  step(ctx, [m], 1 / 60);
  assert.ok(Math.abs(m.box.min.y - -0.5) < 1e-6 && Math.abs(m.box.max.y - 0) < 1e-6, 'flush with the floor');
  const z0 = (m.box.min.z + m.box.max.z) / 2;
  let sum = 0;
  step(ctx, [m], 1.5, () => { sum += m.delta.z; });
  const z1 = (m.box.min.z + m.box.max.z) / 2;
  assert.ok(Math.abs(sum - (z1 - z0)) < 1e-6);
  assert.ok(z1 - z0 < -1);
});

test('rotating platform carries the player around its centre', () => {
  const ctx = makeCtx();
  const r = make(ctx, 'platform', 'rotating', { y: -0.5, w: 3, d: 3, speed: 1 });
  r.box.__owner = r;
  const p = ctx.player;
  p.pos.set(1, 0, 0); p.groundSolid = r.box; p.grounded = true;
  const dt = 1 / 60;
  for (let i = 0; i < 60; i++) { ctx.time += dt; r.update(dt, ctx); p.pos.x += r.delta.x; p.pos.z += r.delta.z; }
  assert.ok(Math.abs(Math.hypot(p.pos.x, p.pos.z) - 1) < 1e-3, 'radius kept');
  assert.ok(Math.abs(Math.atan2(p.pos.x, p.pos.z) - Math.atan2(1, 0) + 1) < 0.02 || Math.abs(Math.atan2(-p.pos.z, p.pos.x) - 1) < 0.02, 'rotated ~1 rad');
});

test('falling / vanishing / sinking / bouncy platforms', () => {
  const ctx = makeCtx();
  const f = make(ctx, 'platform', 'falling', { y: -0.5 });
  ctx.player.groundSolid = f.box; f.box.__owner = f; ctx.player.grounded = true;
  step(ctx, [f], 0.3);
  assert.ok(Math.abs(f.box.max.y) < 1e-6, 'waits');
  step(ctx, [f], 1.0);
  assert.ok(f.box.max.y < -1, 'falls');
  f.onRespawn(ctx);
  assert.ok(Math.abs(f.box.max.y) < 1e-6 && !f.intangible, 'back on respawn');

  const v = make(ctx, 'platform', 'vanishing', { period: 2 });
  const seen = new Set();
  step(ctx, [v], 2.2, () => seen.add(v.intangible));
  assert.deepEqual([...seen].sort(), [false, true]);

  const s = make(ctx, 'platform', 'sinking', { y: -0.5 });
  ctx.player.groundSolid = s.box; s.box.__owner = s;
  step(ctx, [s], 1);
  assert.ok(s.box.max.y < -0.3);

  const b = make(ctx, 'platform', 'bouncy', {});
  b.onLand(ctx.player, ctx);
  assert.equal(ctx.player.bounced, 18);
});

test('wind pushes, water drowns, crusher squashes', () => {
  const ctx = makeCtx();
  const w = make(ctx, 'hazard', 'wind', { w: 4, d: 4, h: 3, force: { x: 3, z: 0 } });
  ctx.player.pos.set(0, 0, 0); ctx.player.syncBox();
  w.onTouch(ctx.player, ctx, { fromAbove: false });
  assert.equal(ctx.player.ext.x, 3);
  const water = make(ctx, 'hazard', 'water', { y: 0, w: 4, d: 4 });
  ctx.player.pos.set(0, -0.6, 0); ctx.player.syncBox();
  assert.ok(overlap(ctx.player.box, water.box));
  water.onTouch(ctx.player, ctx, {});
  assert.deepEqual(ctx.game.kills, ['water']);

  const ctx2 = makeCtx();
  const c = make(ctx2, 'hazard', 'crusher', { period: 3 });
  ctx2.player.pos.set(0, 0, 0); ctx2.player.syncBox();
  step(ctx2, [c], 3.2);
  assert.ok(ctx2.game.kills.includes('squash'));
});

test('boulder: slower than the run, catches a dawdler, accelerates when far, stops at the end', () => {
  const ctx = makeCtx('jungle');
  ctx.level.data.spawn = [0, 0, 0];
  const b = make(ctx, 'hazard', 'boulder', { style: 'moon' });
  assert.ok(b.alwaysUpdate);
  assert.ok(Math.abs(b.pos.z - 10) < 1e-6, 'starts 10 m behind the spawn');
  // player runs at 7.6 m/s towards -Z
  const p = ctx.player;
  p.pos.set(0, 0, 0);
  step(ctx, [b], 4, () => { p.pos.z -= 7.6 / 60; p.syncBox(); });
  assert.ok(b.speed > 6.5 && b.speed < 7.6, `speed ${b.speed}`);
  assert.equal(ctx.game.kills.length, 0);
  // player stops → squashed
  step(ctx, [b], 4);
  assert.deepEqual(ctx.game.kills, ['squash']);
  // respawn 10 m behind the checkpoint
  p.dead = false; ctx.level.checkpoint = [0, 0, -40];
  b.onRespawn(ctx);
  assert.ok(Math.abs(b.pos.z - -30) < 1e-6);
  // far ahead → accelerates
  p.pos.set(0, 0, -80); p.syncBox();
  step(ctx, [b], 3);
  assert.ok(b.speed > 9, `catch-up ${b.speed}`);
  ctx.level.finished = true;
  step(ctx, [b], 2);
  assert.ok(b.speed < 0.2);
});

test('every hazard / platform builds and updates in every world', () => {
  for (const theme of ['beach', 'desert', 'ice', 'factory', 'golden']) {
    const ctx = makeCtx(theme);
    const ents = [...HAZARDS.map((k) => make(ctx, 'hazard', k, { w: 3, d: 3, force: { x: 1, z: 0 }, path: [[2, 0, 0]] })),
      ...PLATFORMS.map((k) => make(ctx, 'platform', k, { to: { x: 2, y: 0, z: 0 } }))];
    for (const e of ents) assert.ok(e && e.object3d, 'built');
    step(ctx, ents, 3);
  }
});
