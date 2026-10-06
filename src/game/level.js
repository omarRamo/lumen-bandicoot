// Runtime level: static collision world + environment art + entities + checkpoints/deaths + completion.
import * as THREE from 'three';
import { bus } from '../core/events.js';
import { StaticWorld, boxOverlap } from '../core/physics.js';
import { createEntity } from '../core/registry.js';
import { createEnvironment } from '../art/environment.js';
import { Player } from './player.js';

const DEATH_SFX = {
  fall: 'death_fall', burn: 'death_burn', squash: 'death_squash', water: 'death_water',
  zap: 'death_zap', explode: 'death_explode', eaten: 'death_eaten', generic: 'death_fall',
};

const DEATH_QUIPS = [
  { fr: 'Oku Oku : « Ça, c\'était voulu, non ? »', en: 'Oku Oku: "That was on purpose, right?"' },
  { fr: 'Oku Oku : « Le vrai bandicoot aurait réussi. »', en: 'Oku Oku: "The real bandicoot would have made it."' },
  { fr: 'Oku Oku : « Astuce : ne pas mourir. »', en: 'Oku Oku: "Pro tip: don\'t die."' },
  { fr: 'Oku Oku : « Je suis en carton, pas en miracle. »', en: 'Oku Oku: "I\'m made of cardboard, not miracles."' },
  { fr: 'Oku Oku : « On dira que c\'était un bug. »', en: 'Oku Oku: "We\'ll call it a bug."' },
];

export class Level {
  /**
   * @param data level data (see docs/CONTRACTS.md)
   * @param shared { scene, camera, rig, game, fx, quality, lang, renderer }
   */
  constructor(data, shared) {
    this.data = data;
    this.shared = shared;
    this.scene = shared.scene;
    this.world = new StaticWorld();
    this.root = new THREE.Group();
    this.root.name = `level-${data.id}`;
    this.scene.add(this.root);
    this.entities = [];
    this.solids = [];
    this.time = 0;
    this.finished = false;
    this.deathTimer = 0;
    this.completeTimer = 0;
    this.checkpoint = [...data.spawn];
    this.checkpointCount = 0;
    this.deathsAtCheckpoint = 0;
    this.brokenNow = new Set();       // crates broken since last checkpoint
    this.committed = new Set();       // broken/gone before last checkpoint
    this.goneNow = new Set();
    this.stats = { crates: 0, cratesTotal: 0, lights: 0, deaths: 0, socks: [], time: 0 };
    this.currentZone = null;
    this.game = shared.game;
    this.game.level = this;

    const g = this.game;
    this.ctx = {
      scene: this.scene, camera: shared.camera, rig: shared.rig, level: this, player: null, game: g,
      time: 0, fx: shared.fx, lang: shared.lang, quality: shared.quality, theme: data.theme,
      sfx: (name, opts = {}) => bus.emit('sfx', { name, ...opts }),
      shake: (amount) => shared.rig.shake(amount),
    };

    // environment (sky, lights, platforms art, decor)
    this.env = createEnvironment(this.scene, data, { quality: shared.quality, renderer: shared.renderer, camera: shared.camera });

    // static platforms
    for (const p of data.platforms) {
      const solid = {
        min: { x: p.min[0], y: p.min[1], z: p.min[2] }, max: { x: p.max[0], y: p.max[1], z: p.max[2] },
        kind: p.kind || 'ground', slippery: !!p.slippery || p.kind === 'ice', conveyor: p.conveyor || null,
        damage: p.damage || null, oneWay: !!p.oneWay,
      };
      this.world.add(solid);
    }

    // player
    this.player = new Player(this.ctx);
    g.player = this.player;
    this.ctx.player = this.player;
    this.root.add(this.player.object3d);
    this.root.add(this.player.shadow);
    if (this.player.oku?.object3d) this.root.add(this.player.oku.object3d);

    // entities
    for (const def of data.entities) {
      if (def.type === 'crate' && /^time[123]$/.test(def.kind) && !g.timeTrial) continue;
      this.addEntity(def);
    }
    this.stats.cratesTotal = this.entities.filter((e) => e.counts).length;
    if (data.goal && !data.entities.some((e) => e.type === 'pickup' && e.kind === 'goal') && data.mode !== 'boss') {
      this.addEntity({ type: 'pickup', kind: 'goal', x: data.goal[0], y: data.goal[1], z: data.goal[2], id: 'goal' });
    }

    this.player.spawn(data.spawn);
    this.applyMode();
    shared.rig.snap(this.player);
    bus.emit('hud:crates', { broken: 0, total: this.stats.cratesTotal });
    bus.emit('hud:lights', { value: g.lights });
    bus.emit('hud:lives', { value: g.lives });
    bus.emit('hud:masks', { value: g.masks });
  }

  addEntity(def) {
    const e = createEntity(def, this.ctx);
    if (!e) return null;
    e.def = def;
    e.id = def.id;
    if (e.object3d) this.root.add(e.object3d);
    this.entities.push(e);
    if (e.solid) this.solids.push(e);
    return e;
  }

  /** Spawn an entity at runtime (lights flying out of a crate, projectiles…). */
  spawn(def) {
    const d = { id: `rt-${Math.random().toString(36).slice(2, 9)}`, ...def, runtime: true };
    return this.addEntity(d);
  }

  applyMode() {
    const d = this.data, rig = this.shared.rig, p = this.player;
    p.lockZ = null; p.autoRun = 0;
    const cam = d.camera || {};
    switch (d.mode) {
      case 'chase': rig.setMode('front', cam); break;
      case 'side': rig.setMode('side', cam); p.lockZ = d.lockZ ?? d.spawn[2]; break;
      case 'ride': rig.setMode('ride', cam); p.autoRun = d.autoRun ?? 11; p.setMount(d.mount || 'snail'); break;
      case 'boss': rig.setMode('arena', { center: cam.center || [d.spawn[0], d.spawn[1], d.spawn[2] - 8], ...cam }); break;
      default: rig.setMode(cam.mode || 'behind', cam);
    }
    this.defaultCamera = { mode: rig.target, lockZ: p.lockZ, autoRun: p.autoRun };
  }

  findByGroup(group) { return this.entities.filter((e) => e.def?.group === group); }
  isCommitted(id) { return this.committed.has(id); }
  markGone(id) { this.goneNow.add(id); }

  crateBroken(entity) {
    if (!entity || entity._counted) return;
    entity._counted = true;
    this.brokenNow.add(entity.id);
    this.stats.crates++;
    bus.emit('hud:crates', { broken: this.stats.crates, total: this.stats.cratesTotal });
    if (this.stats.crates === this.stats.cratesTotal && this.stats.cratesTotal > 0) {
      bus.emit('toast', { text: { fr: 'Toutes les caisses ! Chaussette dorée en vue…', en: 'All crates! Golden sock incoming…' }, kind: 'big' });
    }
  }

  setCheckpoint(pos) {
    this.checkpoint = [pos.x ?? pos[0], (pos.y ?? pos[1]) + 0.05, pos.z ?? pos[2]];
    this.checkpointCount++;
    this.deathsAtCheckpoint = 0;
    for (const id of this.brokenNow) this.committed.add(id);
    for (const id of this.goneNow) this.committed.add(id);
    this.brokenNow.clear(); this.goneNow.clear();
    this.committedCrates = this.stats.crates;
    bus.emit('level:checkpoint', { pos: this.checkpoint });
    bus.emit('sfx', { name: 'checkpoint' });
  }

  explode(pos, radius = 2.2, source = null) {
    const r2 = radius * radius;
    for (const e of this.entities) {
      if (e === source || e.dead || !e.onExplode || !e.box) continue;
      const cx = (e.box.min.x + e.box.max.x) / 2, cy = (e.box.min.y + e.box.max.y) / 2, cz = (e.box.min.z + e.box.max.z) / 2;
      const dx = cx - pos.x, dy = cy - pos.y, dz = cz - pos.z;
      if (dx * dx + dy * dy + dz * dz <= r2) e.onExplode(this.ctx, source);
    }
    const p = this.player;
    const dx = p.pos.x - pos.x, dy = p.pos.y + 0.5 - pos.y, dz = p.pos.z - pos.z;
    if (dx * dx + dy * dy + dz * dz <= r2 * 0.9) this.game.hurt('explode');
    this.shared.rig.shake(0.6);
    this.shared.fx.burst(pos, [0xffc193, 0xff7a4a, 0xfff1c4, 0x5a4a4a], 30, { speed: 9 });
    bus.emit('sfx', { name: 'explosion', pos });
  }

  slam(player, power = 1) {
    const under = player.groundSolid?.__owner;
    if (under?.onSlam) under.onSlam(player, this.ctx, power);
    const r = power >= 2 ? 3.4 : 1.5;
    for (const e of this.entities) {
      if (e === under || e.dead || !e.onSlam || !e.box) continue;
      const cx = (e.box.min.x + e.box.max.x) / 2, cz = (e.box.min.z + e.box.max.z) / 2;
      const dy = e.box.min.y - player.pos.y;
      if (Math.hypot(cx - player.pos.x, cz - player.pos.z) <= r && dy < 1.2 && dy > -1.6) e.onSlam(player, this.ctx, power);
    }
  }

  playerDied(cause) {
    if (this.player.dead || this.finished) return;
    const dur = this.player.die(cause);
    this.deathTimer = Math.max(1.2, dur) + 0.5;
    this.stats.deaths++;
    this.deathsAtCheckpoint++;
    this.game.lives--;
    this.game.save.totalDeaths = (this.game.save.totalDeaths || 0) + 1;
    bus.emit('sfx', { name: DEATH_SFX[cause] || 'death_fall' });
    bus.emit('level:death', { cause, lives: this.game.lives });
    this.shared.rig.shake(cause === 'explode' ? 0.8 : 0.3);
    if (Math.random() < 0.55) bus.emit('dialog', { speaker: 'oku', text: DEATH_QUIPS[Math.floor(Math.random() * DEATH_QUIPS.length)] });
  }

  respawn() {
    const g = this.game;
    if (g.lives < 0) { bus.emit('level:gameover', {}); this.gameOver = true; return; }
    bus.emit('hud:lives', { value: g.lives });
    g.loseMasksOnDeath();
    // crates broken after the last checkpoint come back (Crash rules)
    this.stats.crates = this.committedCrates ?? 0;
    for (const e of this.entities) e._counted = this.committed.has(e.id) ? e._counted : false;
    this.brokenNow.clear(); this.goneNow.clear();
    // remove runtime spawns (flying lights, projectiles)
    for (const e of this.entities) if (e.def?.runtime && !e.keepOnRespawn) e.dead = true;
    this.reapEntities();
    // entities created from level data but removed (broken) must come back if not committed
    const alive = new Set(this.entities.map((e) => e.id));
    for (const def of this.data.entities) {
      if (alive.has(def.id) || this.committed.has(def.id)) continue;
      if (def.type === 'crate' && /^time[123]$/.test(def.kind) && !g.timeTrial) continue;
      this.addEntity(def);
    }
    for (const e of this.entities) e.onRespawn?.(this.ctx);
    if (g.timeTrial) { g.timer = 0; g.freezeT = 0; }
    this.player.spawn(this.checkpoint);
    this.applyMode();
    this.shared.rig.snap(this.player);
    bus.emit('hud:crates', { broken: this.stats.crates, total: this.stats.cratesTotal });
    // pity mask (Crash does it too)
    if (this.deathsAtCheckpoint >= 3 && g.masks === 0) {
      g.addMask();
      bus.emit('dialog', { speaker: 'oku', text: { fr: 'Bon… je t\'aide. Mais je le dirai à tout le monde.', en: 'Fine… I\'ll help. But I\'m telling everyone.' } });
    }
    bus.emit('level:respawn', {});
    bus.emit('sfx', { name: 'respawn' });
  }

  complete() {
    if (this.finished) return;
    this.finished = true;
    this.player.celebrate();
    this.completeTimer = 2.4;
    this.stats.time = this.time;
    bus.emit('sfx', { name: 'goal' });
    bus.emit('music', { track: 'victory' });
  }

  reapEntities() {
    let removedSolid = false;
    for (let i = this.entities.length - 1; i >= 0; i--) {
      const e = this.entities[i];
      if (!e.dead) continue;
      if (e.object3d) this.root.remove(e.object3d);
      try { e.dispose?.(); } catch (err) { console.error(err); }
      this.entities.splice(i, 1);
      if (e.solid) removedSolid = true;
    }
    if (removedSolid) this.solids = this.entities.filter((e) => e.solid);
  }

  updateZones() {
    const p = this.player.pos;
    let zone = null;
    for (const z of this.data.zones || []) {
      if (p.x >= z.min[0] && p.x <= z.max[0] && p.y >= z.min[1] && p.y <= z.max[1] && p.z >= z.min[2] && p.z <= z.max[2]) zone = z;
    }
    if (zone === this.currentZone) return;
    this.currentZone = zone;
    const rig = this.shared.rig;
    if (zone?.camera) rig.setMode(zone.camera.mode || 'behind', zone.camera);
    else if (!zone || !zone.camera) this.applyModeCameraOnly();
    if (zone && 'lockZ' in zone) this.player.lockZ = zone.lockZ;
    else this.player.lockZ = this.defaultCamera.lockZ;
    if (zone && 'autoRun' in zone) this.player.autoRun = zone.autoRun;
    else this.player.autoRun = this.defaultCamera.autoRun;
    if (zone?.toast) bus.emit('toast', { text: zone.toast, kind: 'joke' });
  }

  applyModeCameraOnly() {
    const d = this.data, rig = this.shared.rig, cam = d.camera || {};
    if (d.mode === 'chase') rig.setMode('front', cam);
    else if (d.mode === 'side') rig.setMode('side', cam);
    else if (d.mode === 'ride') rig.setMode('ride', cam);
    else if (d.mode === 'boss') rig.setMode('arena', { center: cam.center || [d.spawn[0], d.spawn[1], d.spawn[2] - 8], ...cam });
    else rig.setMode(cam.mode || 'behind', cam);
  }

  update(dt) {
    this.time += dt;
    this.ctx.time = this.time;
    const p = this.player;
    const ctx = this.ctx;

    if (!p.dead) this.updateZones();
    p.update(dt, ctx);

    // entities
    const px = p.pos.x, pz = p.pos.z;
    const spinBox = (p.spinning || p.sliding || (p.mount && !p.dead)) ? p.getSpinBox() : null;
    const hitId = p.sliding ? `s${p.slideId ?? 0}` : p.spinId;
    for (let i = 0; i < this.entities.length; i++) {
      const e = this.entities[i];
      if (e.dead) continue;
      const far = !e.alwaysUpdate && e.box && (Math.abs(e.box.min.x - px) > 70 || Math.abs(e.box.min.z - pz) > 70);
      if (e.object3d && !e.alwaysVisible) e.object3d.visible = !far || e.alwaysUpdate;
      if (far) continue;
      try { e.update?.(dt, ctx); } catch (err) { console.error('[entity]', e.def?.type, e.def?.kind, err); e.dead = true; continue; }
      if (p.dead || this.finished || !e.box) continue;
      if (e.onTouch && boxOverlap(p.box, e.box)) {
        const midY = (e.box.min.y + e.box.max.y) / 2;
        e.onTouch(p, ctx, { fromAbove: p.vel.y < 0.5 && p.pos.y >= midY - 0.05 });
      }
      if (spinBox && e.onSpin && e._spinHit !== hitId && boxOverlap(spinBox, e.box)) {
        e._spinHit = hitId;
        e.onSpin(p, ctx);
      }
    }
    this.reapEntities();

    this.env.update?.(dt, { camera: this.shared.camera, player: p, time: this.time });

    if (p.dead && this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) this.respawn();
    }
    if (this.finished && this.completeTimer > 0) {
      this.completeTimer -= dt;
      if (this.completeTimer <= 0) {
        this.completeTimer = 0;
        bus.emit('level:complete', this.resultStats());
      }
    }
  }

  resultStats() {
    const s = this.stats;
    return {
      id: this.data.id, name: this.data.name, time: this.game.timeTrial ? this.game.timer : s.time,
      crates: s.crates, cratesTotal: s.cratesTotal, allCrates: s.cratesTotal > 0 && s.crates >= s.cratesTotal,
      lights: s.lights, deaths: s.deaths, socks: [...s.socks], timeTrial: this.game.timeTrial,
    };
  }

  dispose() {
    for (const e of this.entities) { try { e.dispose?.(); } catch { /* ignore */ } }
    this.entities.length = 0;
    this.player.dispose();
    if (this.player.oku?.object3d) this.root.remove(this.player.oku.object3d);
    this.scene.remove(this.root);
    this.env.dispose?.();
    this.shared.fx.clear();
    if (this.game.level === this) this.game.level = null;
  }
}
