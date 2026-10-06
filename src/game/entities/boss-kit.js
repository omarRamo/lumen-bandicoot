// Boss toolkit (Agent Boss) — shared base class + helpers for the 5 boss fights.
// A boss is ONE entity (type 'boss') that handles every interaction itself (stomp / spin / slam / reflect,
// projectiles, shockwaves, minions, telegraph markers, screen flash) so it never depends on other entity types.
// Pure three.js, no DOM: it also runs in Node (tests/bosses.test.js simulates whole fights headless).
import * as THREE from 'three';
import { bus } from '../../core/events.js';
import { groundBelow } from '../../core/physics.js';

export const TAU = Math.PI * 2;
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, k) => a + (b - a) * k;
export const damp = (a, b, rate, dt) => a + (b - a) * (1 - Math.exp(-rate * dt));
export const t2 = (fr, en) => ({ fr, en: en ?? fr });
export const angDiff = (a, b) => Math.atan2(Math.sin(b - a), Math.cos(b - a));

export function aabb() { return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }; }
/** Box from a bottom-centre point, half extents x/z and full height. */
export function setBox(b, cx, y0, cz, hx, h, hz = hx) {
  b.min.x = cx - hx; b.max.x = cx + hx; b.min.y = y0; b.max.y = y0 + h; b.min.z = cz - hz; b.max.z = cz + hz;
  return b;
}
export function overlap(a, b) {
  return a.min.x < b.max.x && a.max.x > b.min.x && a.min.y < b.max.y && a.max.y > b.min.y && a.min.z < b.max.z && a.max.z > b.min.z;
}
export function overlapXZ(a, b, pad = 0) {
  return a.min.x < b.max.x + pad && a.max.x > b.min.x - pad && a.min.z < b.max.z + pad && a.max.z > b.min.z - pad;
}
export function distToBox(p, b) {
  const dx = Math.max(b.min.x - p.x, 0, p.x - b.max.x);
  const dy = Math.max(b.min.y - p.y, 0, p.y - b.max.y);
  const dz = Math.max(b.min.z - p.z, 0, p.z - b.max.z);
  return Math.hypot(dx, dy, dz);
}

// ------------------------------------------------------------------ model helpers
export function std(color, o = {}) {
  return new THREE.MeshStandardMaterial({
    color, roughness: o.rough ?? 0.62, metalness: o.metal ?? 0,
    emissive: o.emissive ?? 0x000000, emissiveIntensity: o.ei ?? 1,
    transparent: o.opacity !== undefined && o.opacity < 1, opacity: o.opacity ?? 1,
    flatShading: !!o.flat, side: o.side ?? THREE.FrontSide, depthWrite: o.depthWrite ?? true,
  });
}
export function basic(color, o = {}) {
  return new THREE.MeshBasicMaterial({
    color, transparent: o.opacity !== undefined, opacity: o.opacity ?? 1, depthWrite: o.depthWrite ?? false,
    side: o.side ?? THREE.FrontSide, toneMapped: false, blending: o.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
}
/** Mesh helper: geometry, material, position, scale (number or [x,y,z]), parent. */
export function mk(geo, mat, parent, x = 0, y = 0, z = 0, s = null) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  if (s !== null) { if (Array.isArray(s)) m.scale.set(s[0], s[1], s[2]); else m.scale.setScalar(s); }
  if (parent) parent.add(m);
  return m;
}
export function grp(parent, x = 0, y = 0, z = 0) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  if (parent) parent.add(g);
  return g;
}
const _up = new THREE.Vector3(0, 1, 0);
const _d = new THREE.Vector3();
/** Orient a unit cylinder (height 1, centred) between a and b; r = radius scale. */
export function cylBetween(mesh, a, b, r = null) {
  _d.subVectors(b, a);
  const len = _d.length() || 1e-4;
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.quaternion.setFromUnitVectors(_up, _d.multiplyScalar(1 / len));
  mesh.scale.y = len;
  if (r !== null) { mesh.scale.x = r; mesh.scale.z = r; }
  return mesh;
}

/** Shared per-boss geometry cache (disposed with the boss). */
export function makeGeoKit() {
  return {
    sphere: new THREE.SphereGeometry(1, 24, 16),
    sphereLo: new THREE.SphereGeometry(1, 12, 8),
    hemi: new THREE.SphereGeometry(1, 20, 10, 0, TAU, 0, Math.PI / 2),
    box: new THREE.BoxGeometry(1, 1, 1),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 16),
    cylOpen: new THREE.CylinderGeometry(1, 1, 1, 48, 1, true),
    cone: new THREE.ConeGeometry(1, 1, 16),
    cone6: new THREE.ConeGeometry(1, 1, 6),
    torus: new THREE.TorusGeometry(1, 0.25, 10, 28),
    torusThin: new THREE.TorusGeometry(1, 0.08, 6, 32),
    arcC: new THREE.TorusGeometry(1, 0.2, 8, 24, Math.PI * 1.45),
    arcHalf: new THREE.TorusGeometry(1, 0.22, 8, 20, Math.PI),
    ring: new THREE.RingGeometry(0.8, 1, 40),
    disc: new THREE.CircleGeometry(1, 32),
    plane: new THREE.PlaneGeometry(1, 1),
  };
}

/** Googly eye: white ball + black pupil that jiggles. */
export function googly(parent, geo, mats, size, x, y, z) {
  const g = grp(parent, x, y, z);
  mk(geo.sphere, mats.white, g, 0, 0, 0, size);
  const pupil = mk(geo.sphere, mats.black, g, 0, 0, size * 0.62, size * 0.5);
  return { group: g, pupil, size, seed: Math.random() * 10 };
}
export function wobbleEye(e, t, k = 1, dizzy = false) {
  const s = e.size;
  if (dizzy) {
    e.pupil.position.x = Math.cos(t * 14 + e.seed) * s * 0.32;
    e.pupil.position.y = Math.sin(t * 14 + e.seed) * s * 0.32;
  } else {
    e.pupil.position.x = Math.sin(t * 6.1 + e.seed) * s * 0.16 * k;
    e.pupil.position.y = Math.cos(t * 4.7 + e.seed * 2) * s * 0.13 * k;
  }
  e.pupil.position.z = s * 0.6;
}

const CONFETTI = [0xff5a7a, 0xffd23f, 0x3ec7ff, 0x7dff7a, 0xc58cff, 0xffffff, 0xff9a3c];
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

// ------------------------------------------------------------------ base class
/**
 * cfg: { name:{fr,en}, speaker, speakerName?, hitsPerPhase:[a,b,c], defeatTime }
 * Subclasses implement: think(dt), animate(dt), onHit(how, phaseUp), onReset(), onBegin(), onDefeat(), defeatAnim(dt, t),
 * reflectTarget(shot) → Vector3, onReflectArrive(shot), and keep this.weak / this.body / this.vulnerable / this.contactHurts updated.
 */
export class BossBase {
  constructor(def, ctx, cfg) {
    this.def = def;
    this.ctx = ctx;
    this.cfg = cfg;
    this.hitsPerPhase = cfg.hitsPerPhase || [2, 2, 2];
    this.maxHp = this.hitsPerPhase.reduce((a, b) => a + b, 0);
    this.hp = this.maxHp;
    this.phase = 0;
    this.floor = def.y ?? 0;
    this.home = new THREE.Vector3(def.x, this.floor, def.z);
    const ar = def.arena || {};
    this.arena = { x: ar.x ?? def.x, z: ar.z ?? def.z + 8, r: ar.r ?? 10, square: ar.shape === 'square' };
    this.pos = this.home.clone();
    this.yaw = 0;
    this.root = new THREE.Group();
    this.root.name = `boss-${def.kind}`;
    this.model = new THREE.Group();
    this.root.add(this.model);
    this.geo = makeGeoKit();
    this.shots = []; this.waves = []; this.marks = []; this.minions = [];
    this.state = 'intro'; this.st = 0; this.prevSt = -1; this.time = 0;
    this.script = null; this.si = 0;
    this.vulnerable = false;
    this.contactHurts = true;
    this.hitModes = { stomp: true, spin: true, slam: true };
    this.weak = aabb();
    this.spinTarget = null;    // optional separate box for spin hits (defaults to weak)
    this.body = [];            // AABBs that hurt on contact
    this.box = aabb();
    this.invulnT = 0;
    this.defeated = false; this.completed = false; this.started = false;
    this.lastSpinKey = null;
    this.wasSlamming = false;
    this.flashA = 0; this.flashMesh = null;
    this.saidOnce = new Set();
    this.extraDispose = [];
    this.hits = 0;             // total hits landed (debug / tests)
    const self = this;
    this.entity = {
      object3d: this.root, box: this.box, alwaysUpdate: true, alwaysVisible: true, boss: this,
      update(dt, c) { self.update(dt, c); },
      onRespawn(c) { self.respawn(c); },
      dispose() { self.dispose(); },
    };
  }

  // ---------------------------------------------------------------- helpers
  tr(s) { return typeof s === 'string' ? s : (this.ctx.lang === 'en' ? s.en : s.fr) ?? s.fr; }
  say(text, speaker = this.cfg.speaker) {
    const p = { speaker, text };
    if (speaker === this.cfg.speaker) p.name = this.cfg.speakerName || this.cfg.name;
    bus.emit('dialog', p);
  }
  /** Queue a line `delay` seconds from now (the HUD only keeps 2 pending bubbles: space them out). */
  sayLater(delay, text, speaker) { (this.later ||= []).push({ t: this.time + delay, text, speaker }); }
  updateLater() {
    if (!this.later?.length) return;
    for (let i = this.later.length - 1; i >= 0; i--) {
      const l = this.later[i];
      if (this.time >= l.t) { this.later.splice(i, 1); this.say(l.text, l.speaker); }
    }
  }
  sayOnce(key, text, speaker) { if (this.saidOnce.has(key)) return; this.saidOnce.add(key); this.say(text, speaker); }
  toast(text, kind = 'joke', duration) { bus.emit('toast', { text, kind, ...(duration ? { duration } : {}) }); }
  sfx(name, opts) { this.ctx.sfx?.(name, opts); }
  shake(a) { this.ctx.shake?.(a); }
  burst(pos, color, n, opts) { this.ctx.fx?.burst?.(pos, color, n, opts); }
  ringFx(pos, color, size) { this.ctx.fx?.ring?.(pos, color, size); }
  textFx(pos, str, color, opts) { this.ctx.fx?.text?.(pos, this.tr(str), color, opts); }
  confetti(pos, n = 30, colors = CONFETTI) {
    this.burst(pos, colors, n, { speed: 9, up: 7, life: 1.8, gravity: 7, size: 1.4 });
  }
  /** Fires once when the state timer crosses t (seconds since entering the state). */
  at(t) { return this.prevSt < t && this.st >= t; }
  /** Fires every `period` seconds within the current state, starting at `start`. */
  every(period, start = 0) {
    if (this.st < start) return false;
    return Math.floor((this.st - start) / period) !== Math.floor((this.prevSt - start) / period) || this.at(start);
  }
  go(state) { this.state = state; this.st = 0; this.prevSt = -1; this.fresh = true; this.onEnter?.(state); }
  /** Next action from the current phase script. */
  next() {
    const s = this.scripts[this.phase];
    const a = s[this.si % s.length];
    this.si++;
    this.go(a);
  }
  /** Apply pos/yaw to the model and refresh world matrices (needed before reading world positions of parts). */
  syncModel() { this.model.position.copy(this.pos); this.model.rotation.y = this.yaw; this.model.updateMatrixWorld(true); }
  get player() { return this.ctx.player; }
  get pv() { return this.ctx.player.pos; }
  phaseStartHp(ph) { let hp = this.maxHp; for (let i = 0; i < ph; i++) hp -= this.hitsPerPhase[i]; return hp; }
  phaseForHp(hp) { let dmg = this.maxHp - hp, ph = 0; while (ph < 2 && dmg >= this.hitsPerPhase[ph]) { dmg -= this.hitsPerPhase[ph]; ph++; } return ph; }
  /** Hits already landed inside the current phase. */
  get phaseHits() { return this.phaseStartHp(this.phase) - this.hp; }
  pp(arr) { return arr[Math.min(this.phase, arr.length - 1)]; }
  emitHud() { bus.emit('hud:boss', { name: this.cfg.name, hp: Math.max(0, this.hp), maxHp: this.maxHp }); }
  floorAt(x, z, fromY = this.floor + 3) {
    const w = this.ctx.level?.world;
    if (!w) return this.inArena(x, z, 0) ? this.floor : -Infinity;
    return groundBelow(w, x, z, fromY, 8, null);
  }
  inArena(x, z, margin = 0) {
    const a = this.arena;
    if (a.square) return Math.abs(x - a.x) <= a.r - margin && Math.abs(z - a.z) <= a.r - margin;
    return Math.hypot(x - a.x, z - a.z) <= a.r - margin;
  }
  clampArena(v, margin = 1.5) {
    const a = this.arena;
    if (a.square) { v.x = clamp(v.x, a.x - a.r + margin, a.x + a.r - margin); v.z = clamp(v.z, a.z - a.r + margin, a.z + a.r - margin); return v; }
    const dx = v.x - a.x, dz = v.z - a.z, d = Math.hypot(dx, dz), m = a.r - margin;
    if (d > m) { v.x = a.x + dx / d * m; v.z = a.z + dz / d * m; }
    return v;
  }
  faceTo(x, z, dt, rate = 6) {
    const want = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.yaw += angDiff(this.yaw, want) * Math.min(1, dt * rate);
  }
  facePlayer(dt, rate = 6) { this.faceTo(this.pv.x, this.pv.z, dt, rate); }
  distToPlayerXZ(from = this.pos) { return Math.hypot(this.pv.x - from.x, this.pv.z - from.z); }
  /** Ballistic launch velocity from a to b in T seconds under gravity g. */
  lobVel(a, b, T, g, out = new THREE.Vector3()) {
    return out.set((b.x - a.x) / T, (b.y - a.y + 0.5 * g * T * T) / T, (b.z - a.z) / T);
  }
  /** Where to aim at the player (with a little lead), clamped inside the arena. */
  aimPoint(lead = 0.3, out = new THREE.Vector3()) {
    const p = this.player;
    out.set(p.pos.x + p.vel.x * lead, this.floor, p.pos.z + p.vel.z * lead);
    return this.clampArena(out, 0.8);
  }

  // ---------------------------------------------------------------- player interaction
  hurtPlayer(cause = 'generic', from = null) {
    const p = this.player;
    if (!p || p.dead || p.celebrating || this.defeated) return false;
    const ok = this.ctx.game.hurt(cause);
    if (ok && !p.dead && from) {
      const dx = p.pos.x - from.x, dz = p.pos.z - from.z, d = Math.hypot(dx, dz) || 1;
      p.launch(dx / d * 7, 8, dz / d * 7);
    }
    return ok;
  }

  checkPlayer() {
    const p = this.player;
    const slamLanded = this.wasSlamming && !p.slamming && p.grounded;
    this.wasSlamming = p.slamming;
    if (this.vulnerable && this.invulnT <= 0) {
      const w = this.weak, m = this.hitModes;
      if (m.stomp && p.vel.y <= 1.5 && p.pos.y >= w.max.y - 0.8 && p.pos.y <= w.max.y + 0.7 && overlapXZ(p.box, w, 0.2)) {
        this.hit('stomp'); return;
      }
      if (m.spin && (p.spinning || p.sliding)) {
        const key = p.sliding ? `s${p.slideId ?? 0}` : `p${p.spinId}`;
        if (key !== this.lastSpinKey && overlap(p.getSpinBox(), this.spinTarget || w)) { this.lastSpinKey = key; this.hit('spin'); return; }
      }
      if (m.slam && slamLanded) {
        const cx = (w.min.x + w.max.x) / 2, cz = (w.min.z + w.max.z) / 2;
        const r = (this.ctx.game.hasPower?.('superSlam') ? 3.4 : 1.6) + (w.max.x - w.min.x) / 2;
        if (Math.hypot(p.pos.x - cx, p.pos.z - cz) <= r && p.pos.y > w.min.y - 1.5) { this.hit('slam'); return; }
      }
    }
    if (this.contactHurts && !this.vulnerable && this.invulnT <= 0) {
      for (const b of this.body) {
        if (b.off || !overlap(p.box, b)) continue;
        _v.set((b.min.x + b.max.x) / 2, p.pos.y, (b.min.z + b.max.z) / 2);
        this.hurtPlayer(b.cause || 'generic', _v);
        break;
      }
    }
  }

  hit(how) {
    const p = this.player;
    const w = this.weak;
    _v.set((w.min.x + w.max.x) / 2, w.max.y, (w.min.z + w.max.z) / 2);
    let dx = p.pos.x - this.pos.x, dz = p.pos.z - this.pos.z;
    const d = Math.hypot(dx, dz) || 1; dx /= d; dz /= d;
    if (how === 'stomp') p.launch(dx * 5.5, 14.5, dz * 5.5);
    else if (how === 'slam') p.launch(dx * 6, 11, dz * 6);
    else { p.vel.x = dx * 8; p.vel.z = dz * 8; }
    this.takeHit(how, _v);
  }

  takeHit(how = 'debug', at = null) {
    if (this.defeated || this.invulnT > 0) return false;
    this.hp--; this.hits++;
    this.invulnT = 1.2;
    this.vulnerable = false;
    const pos = at || _w.set(this.pos.x, this.pos.y + 2, this.pos.z);
    this.sfx('boss_hit', { pos });
    this.shake(0.55);
    this.burst(pos, [0xffffff, 0xffe066, 0xff7a4a], 26, { speed: 8 });
    this.ringFx(pos, 0xffffff, 2.5);
    this.textFx(pos, how === 'reflect' ? t2('PAF !', 'POW!') : t2('BOING !', 'BONK!'), '#ffe066', { scale: 1.3 });
    this.emitHud();
    if (this.hp <= 0) { this.defeat(); return true; }
    const ph = this.phaseForHp(this.hp);
    const phaseUp = ph > this.phase;
    if (phaseUp) {
      this.phase = ph;
      this.si = 0;
      bus.emit('music:mod', { boss: true, rate: 1 + ph * 0.06 });
    }
    this.onHit(how, phaseUp);
    return true;
  }

  // ---------------------------------------------------------------- projectiles
  shot(o) {
    const s = Object.assign({
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.3, grav: 0, life: 8, age: 0, cause: 'generic',
      reflectable: false, reflected: false, harmful: true, landed: false, dead: false,
    }, o);
    if (s.mesh) { s.mesh.position.copy(s.pos); this.root.add(s.mesh); }
    this.shots.push(s);
    return s;
  }
  removeShot(s, poof = false) {
    if (s.dead) return;
    s.dead = true;
    if (s.mesh) this.root.remove(s.mesh);
    if (s.mark) { s.mark.done(); s.mark = null; }
    if (poof) this.burst(s.pos, s.poofColor ?? 0xffffff, 10, { speed: 4 });
    s.onRemove?.(s, this);
  }
  /** Bring a just-removed shot back into play (e.g. the boss hits it back). */
  revive(s) {
    s.dead = false;
    if (s.mesh) this.root.add(s.mesh);
    if (!this.shots.includes(s)) this.shots.push(s);
  }
  reflect(s) {
    s.reflected = true; s.landed = false; s.grav = 0;
    s.reflects = (s.reflects || 0) + 1;
    if (s.mark) { s.mark.done(); s.mark = null; }
    const tgt = this.reflectTarget(s);
    s.vel.subVectors(tgt, s.pos).normalize().multiplyScalar(s.reflectSpeed ?? 15);
    s.vel.y += 4;
    this.sfx('enemy_kick', { pos: s.pos });
    this.ringFx(this.pv, 0xfff1a8, 1.6);
    this.textFx(s.pos, t2('RETOUR !', 'RETURN!'), '#9ff7ff');
    s.onReflect?.(s, this);
  }
  /** Boss sends a reflected shot back at the player (tennis!). */
  volley(s, speedMul = 1.15) {
    s.reflected = false;
    s.speed = (s.speed ?? 8) * speedMul;
    _v.set(this.pv.x, this.pv.y + 0.6, this.pv.z).sub(s.pos).normalize().multiplyScalar(s.speed);
    s.vel.copy(_v);
    s.age = 0;
    this.sfx('enemy_kick', { pos: s.pos, pitch: 0.8 });
    this.ringFx(s.pos, 0xff7ad9, 2);
  }
  updateShots(dt) {
    const p = this.player;
    const live = !p.dead && !this.defeated && !this.ctx.level?.finished;
    for (const s of this.shots) {
      if (s.dead) continue;
      s.age += dt;
      if (s.reflected) {
        const tgt = this.reflectTarget(s);
        _v.subVectors(tgt, s.pos);
        const d = _v.length();
        if (d < (s.hitR ?? 1.7)) { this.removeShot(s); this.onReflectArrive(s); continue; }
        _v.multiplyScalar((s.reflectSpeed ?? 15) / d);
        s.vel.lerp(_v, 1 - Math.exp(-dt * 7));
        s.pos.addScaledVector(s.vel, dt);
      } else {
        s.update?.(s, dt, this);
        if (s.dead) continue;
        if (!s.landed) {
          s.vel.y -= s.grav * dt;
          s.pos.addScaledVector(s.vel, dt);
          if (s.grav > 0 && s.vel.y < 0) {
            const gy = this.floorAt(s.pos.x, s.pos.z, s.pos.y + s.r + 0.6);
            if (gy > -Infinity && s.pos.y - s.r <= gy) {
              s.pos.y = gy + s.r;
              if (s.onLand) s.onLand(s, this); else this.removeShot(s, true);
              if (s.dead) continue;
            }
          }
          if (s.pos.y < this.floor - 14) { this.removeShot(s); continue; }
        }
        if (live) {
          if (s.reflectable && (p.spinning || p.sliding) && distToBox(s.pos, p.getSpinBox()) < s.r + 0.2) this.reflect(s);
          else if (s.harmful && distToBox(s.pos, p.box) < s.r * 0.85) {
            this.hurtPlayer(s.cause, s.pos);
            if (s.onHitPlayer) s.onHitPlayer(s, this); else this.removeShot(s, true);
            if (s.dead) continue;
          }
        }
      }
      if (!s.dead && s.age > s.life) { if (s.onExpire) s.onExpire(s, this); else this.removeShot(s, true); }
      if (!s.dead && s.mesh) {
        s.mesh.position.copy(s.pos);
        if (s.spin) { s.mesh.rotation.x += s.spin * dt; s.mesh.rotation.y += s.spin * 0.7 * dt; }
      }
    }
    compact(this.shots);
  }
  reflectables() { return this.shots.filter((s) => !s.dead && s.reflectable && !s.reflected); }

  /** Explosion: particles, sound, shake, hurts the player within radius. */
  boom(pos, radius = 1.8, colors = [0xffc193, 0xff7a4a, 0xfff1c4, 0x5a4a4a], cause = 'explode', shake = 0.35) {
    this.burst(pos, colors, 22, { speed: 8 });
    this.ringFx(pos, Array.isArray(colors) ? colors[0] : colors, radius);
    this.sfx('explosion', { pos, vol: 0.8 });
    this.shake(shake);
    const p = this.player;
    if (!p.dead && !this.defeated && distToBox(pos, p.box) < radius * 0.8) this.hurtPlayer(cause, pos);
  }

  // ---------------------------------------------------------------- shockwaves (jump over them)
  wave({ x, z, speed = 6, maxR = 12, width = 0.7, height = 0.6, color = 0xfff0c8, cause = 'generic' }) {
    const mat = basic(color, { opacity: 0.8, side: THREE.DoubleSide });
    const mesh = mk(this.geo.cylOpen, mat, this.root, x, this.floor + height / 2, z);
    mesh.scale.set(0.1, height, 0.1);
    const w = { x, z, r: 0.2, speed, maxR, width, height, mesh, mat, hit: false, cause, dead: false };
    this.waves.push(w);
    return w;
  }
  updateWaves(dt) {
    const p = this.player;
    for (const w of this.waves) {
      w.r += w.speed * dt;
      w.mesh.scale.set(w.r, w.height, w.r);
      w.mat.opacity = 0.85 * Math.min(1, (w.maxR - w.r) / 2);
      if (!w.hit && !p.dead && !this.defeated) {
        const d = Math.hypot(p.pos.x - w.x, p.pos.z - w.z);
        if (Math.abs(d - w.r) < w.width / 2 + 0.3 && p.pos.y < this.floor + w.height * 0.85) {
          w.hit = true;
          this.hurtPlayer(w.cause, _v.set(w.x, 0, w.z));
        }
      }
      if (w.r >= w.maxR) { w.dead = true; this.root.remove(w.mesh); w.mat.dispose(); }
    }
    compact(this.waves);
  }

  // ---------------------------------------------------------------- telegraph markers
  mark(x, z, r, color = 0xff3b3b, life = 1, { y = null, blink = 16, opacity = 0.85 } = {}) {
    const mat = basic(color, { opacity, side: THREE.DoubleSide });
    const mesh = mk(this.geo.ring, mat, this.root, x, (y ?? this.floor) + 0.05, z);
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.setScalar(r);
    mesh.renderOrder = 2;
    return this._addMark({ mesh, mat, life, age: 0, blink, opacity });
  }
  lineMark(x0, z0, x1, z1, width, color = 0xff3b3b, life = 1, { y = null, blink = 14, opacity = 0.55 } = {}) {
    const mat = basic(color, { opacity, side: THREE.DoubleSide });
    const g = grp(this.root, (x0 + x1) / 2, (y ?? this.floor) + 0.05, (z0 + z1) / 2);
    g.rotation.y = Math.atan2(x1 - x0, z1 - z0);
    const pl = mk(this.geo.plane, mat, g);
    pl.rotation.x = -Math.PI / 2;
    pl.scale.set(width, Math.hypot(x1 - x0, z1 - z0), 1);
    pl.renderOrder = 2;
    return this._addMark({ mesh: g, mat, life, age: 0, blink, opacity });
  }
  _addMark(m) {
    const self = this;
    m.done = () => { if (m.dead) return; m.dead = true; self.root.remove(m.mesh); m.mat.dispose(); };
    this.marks.push(m);
    return m;
  }
  updateMarks(dt) {
    for (const m of this.marks) {
      if (m.dead) continue;
      m.age += dt;
      m.mat.opacity = m.opacity * (m.blink ? 0.55 + 0.45 * Math.sin(m.age * m.blink) : 1);
      if (m.life > 0 && m.age >= m.life) m.done();
    }
    compact(this.marks);
  }

  // ---------------------------------------------------------------- minions (baby crabs, lab rats, nitro…)
  minion(o) {
    const m = Object.assign({ pos: new THREE.Vector3(), vel: new THREE.Vector3(), r: 0.4, h: 0.6, speed: 3, age: 0,
      life: 0, dead: false, grounded: false, box: aabb(), lights: 1 }, o);
    this.root.add(m.mesh);
    m.mesh.position.copy(m.pos);
    this.minions.push(m);
    return m;
  }
  removeMinion(m, poof = false) {
    if (m.dead) return;
    m.dead = true;
    this.root.remove(m.mesh);
    if (poof) this.burst(m.pos, m.color ?? 0xffffff, 10, { speed: 4 });
  }
  updateMinions(dt) {
    const p = this.player, live = !p.dead && !this.defeated && !this.ctx.level?.finished;
    for (const m of this.minions) {
      if (m.dead) continue;
      m.age += dt;
      if (m.flyT !== undefined) {
        m.vel.y -= 20 * dt;
        m.pos.addScaledVector(m.vel, dt);
        m.mesh.rotation.x += dt * 14; m.mesh.rotation.z += dt * 9;
        m.mesh.scale.multiplyScalar(1 + dt * 1.5);
        m.flyT -= dt;
        if (m.flyT <= 0) this.removeMinion(m);
      } else if (m.squashT !== undefined) {
        m.squashT -= dt;
        m.mesh.scale.y = Math.max(0.08, m.squashT * 2.5);
        if (m.squashT <= 0) this.removeMinion(m, true);
      } else {
        if (m.think) m.think(m, dt, this);
        else if (live && m.grounded && m.age > (m.wake ?? 0.4)) {
          _v.set(p.pos.x - m.pos.x, 0, p.pos.z - m.pos.z);
          const d = _v.length();
          if (d > 0.3) {
            _v.multiplyScalar(1 / d);
            const ahead = this.floorAt(m.pos.x + _v.x * 0.7, m.pos.z + _v.z * 0.7, m.pos.y + 1);
            const go = ahead > m.pos.y - 0.6 ? m.speed : 0;
            m.vel.x = _v.x * go; m.vel.z = _v.z * go;
            m.mesh.rotation.y = Math.atan2(_v.x, _v.z);
          }
        } else if (!live) { m.vel.x *= 0.9; m.vel.z *= 0.9; }
        m.vel.y -= 30 * dt;
        m.pos.x += m.vel.x * dt; m.pos.z += m.vel.z * dt; m.pos.y += m.vel.y * dt;
        const gy = this.floorAt(m.pos.x, m.pos.z, m.pos.y - m.vel.y * dt + 0.5);
        if (gy > -Infinity && m.pos.y <= gy && m.vel.y <= 0) { m.pos.y = gy; m.vel.y = 0; m.grounded = true; } else m.grounded = false;
        if (m.pos.y < this.floor - 12) { this.removeMinion(m); continue; }
        if (m.life && m.age > m.life) { if (m.onExpire) m.onExpire(m, this); else this.removeMinion(m, true); continue; }
        m.anim?.(m, dt, this);
        setBox(m.box, m.pos.x, m.pos.y, m.pos.z, m.r, m.h, m.r);
        if (live && m.age > 0.25) this.minionVsPlayer(m);
      }
      if (!m.dead) m.mesh.position.copy(m.pos);
    }
    compact(this.minions);
  }
  minionVsPlayer(m) {
    const p = this.player;
    const spin = (p.spinning || p.sliding) && overlap(p.getSpinBox(), m.box);
    if (m.explodeOnTouch) {
      if (spin || overlap(p.box, m.box)) { this.removeMinion(m); this.boom(_v.set(m.pos.x, m.pos.y + 0.5, m.pos.z), m.boomR ?? 1.8, m.boomColors); }
      return;
    }
    if (p.vel.y < 0 && p.pos.y > m.pos.y + m.h * 0.4 && overlap(p.box, m.box)) {
      m.squashT = 0.35;
      p.bounce(11.5);
      this.sfx('enemy_squash', { pos: m.pos });
      if (m.lights) this.ctx.game.addLights?.(m.lights);
      return;
    }
    if (spin) {
      const cam = this.ctx.camera?.position;
      if (cam) _v.subVectors(cam, m.pos).normalize().multiplyScalar(16); else _v.set(0, 0, 16);
      m.vel.copy(_v); m.vel.y += 4;
      m.flyT = 0.75;
      this.sfx('enemy_kick', { pos: m.pos });
      if (m.lights) this.ctx.game.addLights?.(m.lights);
      return;
    }
    if (overlap(p.box, m.box)) this.hurtPlayer('generic', m.pos);
  }

  // ---------------------------------------------------------------- screen flash (selfies, explosions)
  flash(a = 0.95) {
    if (!this.flashMesh) {
      const mat = basic(0xffffff, { opacity: 0, side: THREE.DoubleSide });
      mat.depthTest = false;
      this.flashMesh = new THREE.Mesh(this.geo.plane, mat);
      this.flashMesh.renderOrder = 9999;
      this.flashMesh.frustumCulled = false;
      this.flashMesh.scale.set(4, 4, 1);
      this.root.add(this.flashMesh);
    }
    this.flashA = a;
  }
  updateFlash(dt) {
    const m = this.flashMesh;
    if (!m) return;
    this.flashA = Math.max(0, this.flashA - dt * 1.25);
    m.visible = this.flashA > 0.005;
    m.material.opacity = Math.min(1, this.flashA);
    const cam = this.ctx.camera;
    if (cam && m.visible) {
      cam.getWorldDirection(_v);
      m.position.copy(cam.position).addScaledVector(_v, 0.35);
      m.quaternion.copy(cam.quaternion);
    }
  }

  /** Bobbing arrow above the weak point while the boss is vulnerable (readability first). */
  updateIndicator(dt) {
    const show = this.vulnerable && this.invulnT <= 0 && !this.defeated;
    if (!this.arrow) {
      if (!show) return;
      this.arrow = new THREE.Group();
      const mat = basic(0xffe14a, { opacity: 0.95 });
      mat.depthWrite = true;
      const c = mk(this.geo.cone, mat, this.arrow, 0, 0, 0, [0.42, 0.75, 0.42]);
      c.rotation.x = Math.PI;
      mk(this.geo.cyl, mat, this.arrow, 0, 0.62, 0, [0.15, 0.6, 0.15]);
      this.root.add(this.arrow);
    }
    this.arrow.visible = show;
    if (!show) return;
    const w = this.spinTarget && !this.hitModes.stomp ? this.spinTarget : this.weak;
    this.arrow.position.set((w.min.x + w.max.x) / 2, w.max.y + 1.1 + Math.abs(Math.sin(this.time * 6)) * 0.45, (w.min.z + w.max.z) / 2);
    this.arrow.rotation.y += dt * 4;
  }

  clearAll(poof = false) {
    for (const s of this.shots) this.removeShot(s, poof);
    for (const w of this.waves) { w.dead = true; this.root.remove(w.mesh); w.mat.dispose(); }
    for (const m of this.marks) m.done();
    for (const m of this.minions) this.removeMinion(m, poof);
    compact(this.shots); compact(this.marks); compact(this.minions);
    this.waves.length = 0;
  }

  // ---------------------------------------------------------------- lifecycle
  begin() {
    this.started = true;
    this.emitHud();
    bus.emit('music:mod', { boss: true, rate: 1 });
    this.onBegin?.();
  }

  update(dt, ctx) {
    this.ctx = ctx;
    if (!this.started) this.begin();
    const p = ctx.player;
    this.time += dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    this.prevSt = this.fresh ? -1 : this.st;
    this.fresh = false;
    this.st += dt;
    if (this.defeated) this.updateDefeat(dt);
    else if (!p.dead && !ctx.level?.finished) this.think(dt);
    this.updateShots(dt);
    this.updateWaves(dt);
    this.updateMarks(dt);
    this.updateMinions(dt);
    this.updateFlash(dt);
    this.updateLater();
    this.animate(dt);
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    this.updateIndicator(dt);
    if (!this.defeated && !p.dead && !ctx.level?.finished) this.checkPlayer();
    this.syncBox();
  }

  syncBox() {
    const b = this.box;
    if (!this.body.length) { setBox(b, this.pos.x, this.pos.y, this.pos.z, 1, 2); return; }
    b.min.x = b.min.y = b.min.z = Infinity; b.max.x = b.max.y = b.max.z = -Infinity;
    for (const s of this.body) {
      b.min.x = Math.min(b.min.x, s.min.x); b.min.y = Math.min(b.min.y, s.min.y); b.min.z = Math.min(b.min.z, s.min.z);
      b.max.x = Math.max(b.max.x, s.max.x); b.max.y = Math.max(b.max.y, s.max.y); b.max.z = Math.max(b.max.z, s.max.z);
    }
  }

  respawn(ctx) {
    this.ctx = ctx;
    if (this.defeated) return;
    this.clearAll();
    this.hp = this.phaseStartHp(this.phase);
    this.vulnerable = false;
    this.invulnT = 0;
    this.si = 0;
    this.flashA = 0;
    this.emitHud();
    this.onReset();
  }

  defeat() {
    this.defeated = true;
    this.vulnerable = false;
    this.dT = 0;
    this.clearAll(true);
    this.sfx('boss_defeat');
    this.shake(0.9);
    bus.emit('music:mod', { boss: false, rate: 1 });
    const p = this.player;
    if (p && !p.dead) { p.frozen = true; p.vel.x = 0; p.vel.z = 0; }
    const rig = this.ctx.rig;
    if (rig?.setMode) {
      const c = this.defeatFocus ? this.defeatFocus() : this.pos;
      rig.setMode('arena', { center: [c.x, c.y, c.z], dist: 11, height: 6.5, lateral: 0.25, lookUp: 1.6, fov: 52 });
    }
    this.onDefeat?.();
  }

  updateDefeat(dt) {
    this.dT += dt;
    this.defeatAnim?.(dt, this.dT);
    const p = this.player;
    if (!this.completed && this.dT >= (this.cfg.defeatTime ?? 2.8) && !p.dead) {
      this.completed = true;
      p.frozen = false;
      bus.emit('hud:boss', null);
      this.ctx.level?.complete?.();
    }
  }

  /** Debug/QA: a point `dist` m from `from` towards the arena centre (safe place to stand next to something). */
  towardCenter(x, z, dist) {
    const a = this.arena;
    let dx = a.x - x, dz = a.z - z;
    const d = Math.hypot(dx, dz);
    if (d < 0.01) { dx = 0; dz = 1; } else { dx /= d; dz /= d; }
    return [x + dx * dist, this.floor, z + dz * dist];
  }
  /** Debug/QA: what a bot should do right now to damage the boss (used by tools/boss-fight.mjs and tests). */
  botHint() {
    if (this.defeated) return null;
    const r = this.reflectables();
    if (r.length) {
      const s = r.reduce((a, b) => (Math.hypot(a.pos.x - this.pv.x, a.pos.z - this.pv.z) < Math.hypot(b.pos.x - this.pv.x, b.pos.z - this.pv.z) ? a : b));
      if (s.landed || s.pos.y < this.floor + 1.6) return { action: 'reflect', pos: this.towardCenter(s.pos.x, s.pos.z, 0.6) };
    }
    if (!this.vulnerable || this.invulnT > 0) return null;
    const w = this.weak;
    const cx = (w.min.x + w.max.x) / 2, cz = (w.min.z + w.max.z) / 2;
    if (this.hitModes.spin && this.spinTarget !== undefined && (this.preferSpin || !this.hitModes.stomp)) {
      const t = this.spinTarget || w;
      const sx = (t.min.x + t.max.x) / 2, sz = (t.min.z + t.max.z) / 2;
      return { action: 'spin', pos: this.towardCenter(sx, sz, (t.max.x - t.min.x) / 2 + 0.6) };
    }
    return { action: 'stomp', pos: [cx, w.max.y + 1.2, cz] };
  }

  dispose() {
    if (!this.completed) bus.emit('hud:boss', null);
    bus.emit('music:mod', { boss: false, rate: 1 });
    const geos = new Set(), mats = new Set();
    const collect = (o) => o.traverse((c) => {
      if (c.geometry) geos.add(c.geometry);
      if (c.material) (Array.isArray(c.material) ? c.material : [c.material]).forEach((m) => mats.add(m));
    });
    collect(this.root);
    for (const o of this.extraDispose) collect(o);
    for (const s of this.shots) if (s.mesh) collect(s.mesh);
    for (const m of this.minions) collect(m.mesh);
    for (const g of Object.values(this.geo)) geos.add(g);
    if (this.mats) for (const m of Object.values(this.mats)) mats.add(m);
    geos.forEach((g) => g.dispose());
    mats.forEach((m) => m.dispose());
  }
}

function compact(arr) {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (!arr[i].dead) arr[j++] = arr[i];
  arr.length = j;
}
