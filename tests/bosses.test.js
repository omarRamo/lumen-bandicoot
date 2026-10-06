// Boss tests (Agent Boss) — pure Node, no DOM. Checks the 5 arenas' data and simulates every boss fight headless
// with a tiny bot (stomp/spin/reflect when the boss exposes a weak point) until ctx.level.complete() is called.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import bossLevels from '../src/levels/bosses.js';
import { createEntity } from '../src/core/registry.js';
import { StaticWorld } from '../src/core/physics.js';
import { bus } from '../src/core/events.js';
import '../src/game/entities/bosses.js';

const EXPECT = {
  B1: { world: 1, kind: 'crabKing', music: 'boss', theme: 'boss_beach' },
  B2: { world: 2, kind: 'djinn', music: 'boss', theme: 'boss_desert' },
  B3: { world: 3, kind: 'yeti', music: 'boss', theme: 'boss_ice' },
  B4: { world: 4, kind: 'cortisol', music: 'final_boss', theme: 'boss_lab' },
  BS: { world: 5, kind: 'goldenCortisol', music: 'final_boss', theme: 'golden' },
};
const byId = Object.fromEntries(bossLevels.map((l) => [l.id, l]));

function topAt(level, x, z) {
  let best = -Infinity;
  for (const p of level.platforms) if (x >= p.min[0] && x <= p.max[0] && z >= p.min[2] && z <= p.max[2]) best = Math.max(best, p.max[1]);
  return best;
}

test('boss arenas: data contract', () => {
  assert.deepEqual(Object.keys(byId).sort(), Object.keys(EXPECT).sort());
  for (const [id, e] of Object.entries(EXPECT)) {
    const l = byId[id];
    assert.equal(l.mode, 'boss', id);
    assert.equal(l.world, e.world, id);
    assert.equal(l.music, e.music, id);
    assert.equal(l.theme, e.theme, id);
    assert.ok(l.name?.fr && l.name?.en && l.intro?.fr && l.intro?.en, `${id} name/intro`);
    assert.equal(l.camera.center.length, 3, `${id} camera.center`);
    assert.ok(l.camera.dist > 0 && l.camera.height > 0, `${id} camera dist/height`);
    const bosses = l.entities.filter((d) => d.type === 'boss');
    assert.equal(bosses.length, 1, `${id} one boss`);
    assert.equal(bosses[0].kind, e.kind, id);
    assert.ok(bosses[0].arena?.r > 5, `${id} arena param`);
    assert.equal(topAt(l, bosses[0].x, bosses[0].z), bosses[0].y, `${id} boss stands on the floor`);
    assert.equal(topAt(l, l.spawn[0], l.spawn[2]), l.spawn[1], `${id} spawn on a platform`);
    assert.ok(l.killY < 0, `${id} killY`);
    const ids = new Set(l.entities.map((d) => d.id));
    assert.equal(ids.size, l.entities.length, `${id} unique entity ids`);
    for (const c of l.entities.filter((d) => d.type === 'crate')) {
      assert.ok(['mask', 'basic'].includes(c.kind), `${id} crate kinds`);
      assert.equal(topAt(l, c.x, c.z), c.y, `${id} crate ${c.id} on a platform`);
    }
  }
});

function fakePlayer(spawn) {
  const p = {
    pos: new THREE.Vector3(...spawn), vel: new THREE.Vector3(), box: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    spinBox: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
    dead: false, spinning: false, sliding: false, slamming: false, grounded: true, spinId: 0, slideId: 0,
    celebrating: false, frozen: false, hurtT: 0,
    syncBox() { this.box.min.x = this.pos.x - 0.3; this.box.max.x = this.pos.x + 0.3; this.box.min.y = this.pos.y; this.box.max.y = this.pos.y + 1.12; this.box.min.z = this.pos.z - 0.3; this.box.max.z = this.pos.z + 0.3; },
    getSpinBox() { const b = this.spinBox, r = 1.05; b.min.x = this.pos.x - r; b.max.x = this.pos.x + r; b.min.z = this.pos.z - r; b.max.z = this.pos.z + r; b.min.y = this.pos.y - 0.1; b.max.y = this.pos.y + 1.2; return b; },
    bounce(vy = 12) { this.vel.y = vy; this.grounded = false; },
    launch(x, y, z) { this.vel.set(x, y, z); this.grounded = false; },
    celebrate() { this.celebrating = true; },
  };
  p.syncBox();
  return p;
}

function setup(id) {
  const data = byId[id];
  const world = new StaticWorld();
  for (const p of data.platforms) world.add({ min: { x: p.min[0], y: p.min[1], z: p.min[2] }, max: { x: p.max[0], y: p.max[1], z: p.max[2] } });
  const player = fakePlayer(data.spawn);
  const stats = { hurts: 0, complete: 0 };
  const level = { world, solids: [], data, finished: false, complete() { stats.complete++; this.finished = true; player.celebrate(); }, spawn() { return null; } };
  const game = { hurt() { stats.hurts++; return false; }, kill() {}, hasPower: () => true, addLights() {}, player };
  const ctx = {
    scene: new THREE.Scene(), camera: new THREE.PerspectiveCamera(), level, player, game, time: 0, lang: 'fr',
    quality: { level: 1, shadows: false }, theme: data.theme, sfx() {}, shake() {},
    fx: { burst() {}, ring() {}, text() {} },
  };
  const def = data.entities.find((d) => d.type === 'boss');
  const ent = createEntity(def, ctx);
  return { data, ctx, ent, boss: ent.boss, player, stats };
}

/** Run a fight with a bot. Returns sim info. */
function simulate(id, { maxT = 600, checkRespawn = false } = {}) {
  const { data, ctx, ent, boss, player, stats } = setup(id);
  const hud = [];
  const offs = [bus.on('hud:boss', (p) => hud.push(p)), bus.on('dialog', () => { stats.dialogs = (stats.dialogs || 0) + 1; })];
  const dt = 1 / 60;
  let t = 0, spinT = 0, respawned = null;
  const phases = new Set();
  try {
    while (t < maxT && !stats.complete) {
      const h = boss.botHint();
      if (h && spinT <= 0 && !boss.defeated) {
        player.pos.set(...h.pos);
        if (h.action === 'stomp') { player.vel.set(0, -3, 0); player.grounded = false; spinT = 0.6; } else { player.spinning = true; player.spinId++; spinT = 0.3; player.vel.set(0, 0, 0); }
      } else if (!h && spinT <= 0 && player.grounded) {
        player.pos.set(...data.spawn);
      }
      // trivial physics
      if (!player.grounded) {
        player.vel.y -= 34 * dt;
        player.pos.addScaledVector(player.vel, dt);
        if (player.pos.y <= data.spawn[1] && player.vel.y <= 0) { player.pos.y = data.spawn[1]; player.vel.set(0, 0, 0); player.grounded = true; }
      }
      spinT -= dt;
      if (spinT <= 0) player.spinning = false;
      player.syncBox();
      ent.update(dt, ctx);
      ctx.time = t += dt;
      phases.add(boss.phase);
      if (checkRespawn && !respawned && boss.phase === 1 && boss.hp < boss.phaseStartHp(1) && !boss.defeated) {
        const before = boss.hp;
        ent.onRespawn(ctx);
        respawned = { before, after: boss.hp, start: boss.phaseStartHp(1), phase: boss.phase, state: boss.state, shots: boss.shots.length };
      }
    }
  } finally { offs.forEach((f) => f()); }
  ent.dispose();
  return { t, stats, hud, phases, boss, respawned };
}

for (const id of Object.keys(EXPECT)) {
  test(`boss ${id}: full fight can be won, 3 phases, level.complete() called`, () => {
    const r = simulate(id, { checkRespawn: true });
    assert.equal(r.stats.complete, 1, `${id} complete called once (t=${r.t.toFixed(1)}s, hp=${r.boss.hp}, state=${r.boss.state})`);
    assert.equal(r.boss.hp, 0);
    assert.deepEqual([...r.phases].sort(), [0, 1, 2], `${id} went through the 3 phases`);
    assert.ok(r.t > 30 && r.t < 300, `${id} fight lasted ${r.t.toFixed(1)}s with a perfect bot`);
    assert.ok(r.hud[0] && r.hud[0].hp === r.hud[0].maxHp && r.hud[0].name?.fr, `${id} hud:boss initial`);
    assert.equal(r.hud.at(-1), null, `${id} hud:boss null at the end`);
    assert.ok(r.stats.hurts > 0, `${id} the boss attacks connect`);
    assert.ok((r.stats.dialogs || 0) >= 5, `${id} talks`);
    assert.ok(r.respawned, `${id} respawn tested`);
    assert.equal(r.respawned.phase, 1, `${id} respawn keeps the phase`);
    assert.equal(r.respawned.after, r.respawned.start, `${id} respawn restores hp to the start of the phase`);
    assert.ok(r.respawned.after > r.respawned.before, `${id} respawn undoes the hits of the current phase`);
    assert.equal(r.respawned.shots, 0, `${id} respawn clears projectiles`);
  });
}

test('bosses never hurt a player who is busy celebrating / after defeat', () => {
  const { ctx, ent, boss, stats } = setup('B1');
  for (let i = 0; i < 60 * 4; i++) { ent.update(1 / 60, ctx); ctx.time += 1 / 60; }
  boss.hp = 1;
  boss.invulnT = 0;
  boss.takeHit('debug');
  assert.ok(boss.defeated);
  const hurtsAtDefeat = stats.hurts;
  for (let i = 0; i < 60 * 6; i++) { ctx.player.pos.copy(boss.pos); ctx.player.syncBox(); ent.update(1 / 60, ctx); ctx.time += 1 / 60; }
  assert.equal(stats.hurts, hurtsAtDefeat, 'no damage during the defeat cinematic');
  assert.equal(stats.complete, 1);
  ent.dispose();
});
