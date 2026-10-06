// Per-level crate/pickup FX manager: instanced batches (crates, lights), plank debris pool, flying lights
// that get sucked into the player, explosion fireballs, pop-up icons, combos, the mystery chicken and the
// two-second disco. One manager per Level, living as an always-updated entity ('crate'/'__fx').
import * as THREE from 'three';
import { bus } from '../../core/events.js';
import { groundBelow } from '../../core/physics.js';
import {
  setArtQuality, crateGeometry, crateMaterial, debrisGeometry, debrisMaterial, lightBodyGeometry, lightBodyMaterial,
  haloGeometry, haloMaterial, wingsGeometry, wingsMaterial, spriteMaterial, basicMat, lambertMat, geo,
} from './crate-art.js';
import { COMBO_WINDOW, comboLabel, comboColor, overlapXZ } from './crate-logic.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

// ------------------------------------------------------------------ instanced batch with slot handles
export class Batch {
  constructor(parent, geometry, material, cap = 16, { shadows = false, renderOrder = 0 } = {}) {
    this.parent = parent; this.geometry = geometry; this.material = material;
    this.shadows = shadows; this.renderOrder = renderOrder;
    this.handles = [];
    this.count = 0;
    this.disposed = false;
    this.mesh = this.makeMesh(Math.max(4, cap));
  }

  makeMesh(cap) {
    const m = new THREE.InstancedMesh(this.geometry, this.material, cap);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    m.count = 0;
    m.frustumCulled = false;
    m.castShadow = this.shadows; m.receiveShadow = this.shadows;
    m.renderOrder = this.renderOrder;
    this.cap = cap;
    this.parent.add(m);
    return m;
  }

  grow() {
    const old = this.mesh;
    const m = this.makeMesh(this.cap * 2);
    m.instanceMatrix.array.set(old.instanceMatrix.array.subarray(0, this.count * 16));
    m.instanceColor.array.set(old.instanceColor.array.subarray(0, this.count * 3));
    m.count = this.count;
    m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
    this.parent.remove(old);
    old.dispose();
    this.mesh = m;
  }

  alloc() {
    if (this.disposed) return null;
    if (this.count >= this.cap) this.grow();
    const h = { b: this, i: this.count };
    this.handles[this.count] = h;
    this.count++;
    this.mesh.count = this.count;
    // hidden until positioned
    _m.makeScale(0, 0, 0);
    this.mesh.setMatrixAt(h.i, _m);
    this.color(h, 1, 1, 1);
    this.mesh.instanceMatrix.needsUpdate = true;
    return h;
  }

  free(h) {
    if (!h || h.b !== this || h.i < 0 || this.disposed) return;
    const last = this.count - 1, i = h.i;
    if (i !== last) {
      const ma = this.mesh.instanceMatrix.array, ca = this.mesh.instanceColor.array;
      ma.copyWithin(i * 16, last * 16, last * 16 + 16);
      ca.copyWithin(i * 3, last * 3, last * 3 + 3);
      const moved = this.handles[last];
      this.handles[i] = moved; moved.i = i;
    }
    this.handles[last] = undefined;
    this.count = last;
    this.mesh.count = last;
    h.i = -1;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor.needsUpdate = true;
  }

  matrix(h, m) {
    if (!h || h.i < 0) return;
    this.mesh.setMatrixAt(h.i, m);
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  color(h, r, g, b) {
    if (!h || h.i < 0) return;
    const a = this.mesh.instanceColor.array, k = h.i * 3;
    if (a[k] === r && a[k + 1] === g && a[k + 2] === b) return;
    a[k] = r; a[k + 1] = g; a[k + 2] = b;
    this.mesh.instanceColor.needsUpdate = true;
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.parent.remove(this.mesh);
    this.mesh.dispose();
  }
}

/** Compose a TRS matrix without allocations. */
export function trs(x, y, z, rx, ry, rz, sx, sy, sz) {
  _e.set(rx, ry, rz);
  _q.setFromEuler(_e);
  return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz));
}
function trsQ(x, y, z, q, sx, sy, sz) { return _m.compose(_p.set(x, y, z), q, _s.set(sx, sy, sz)); }

// ------------------------------------------------------------------ manager registry
const managers = new WeakMap();

/** Get (and lazily create) the FX manager of the ctx's level. */
export function crateFx(ctx) {
  const level = ctx.level;
  if (!level) return null;
  let m = managers.get(level);
  if (!m) {
    m = new CrateFx(ctx);
    managers.set(level, m);
    // register as a level entity so it gets update / onRespawn / dispose
    level.addEntity({ type: 'crate', kind: '__fx', id: '__crate_fx', x: 0, y: 0, z: 0 });
  }
  return m;
}
export function existingFx(ctx) { return ctx.level ? managers.get(ctx.level) : null; }

const DEBRIS_MAX = [90, 180, 260];
const FLY_MAX = 90;
const WOOD = [0xd98c3a, 0xb86a28, 0xf0ae5a, 0x9a5420];

class CrateFx {
  constructor(ctx) {
    this.ctx = ctx;
    this.level = ctx.level;
    this.q = ctx.quality?.level ?? 1;
    setArtQuality(this.q);
    this.root = new THREE.Group();
    this.root.name = 'crate-fx';
    this.level.root.add(this.root);
    this.crates = new Set();
    this.batches = new Map();
    // pre-count crate looks in the level data for initial capacities
    this.capHint = {};
    this.defsByY = new Map();
    for (const d of this.level.data.entities || []) {
      if (d.type !== 'crate') continue;
      this.capHint[d.kind] = (this.capHint[d.kind] || 0) + 1;
      const k = Math.round(d.y * 10);
      let l = this.defsByY.get(k); if (!l) { l = []; this.defsByY.set(k, l); } l.push(d);
    }
    let lights = 8;
    for (const d of this.level.data.entities || []) if (d.type === 'pickup' && d.kind === 'light') lights++;
    this.lightBody = new Batch(this.root, lightBodyGeometry(), lightBodyMaterial(), lights + 24);
    this.lightHalo = new Batch(this.root, haloGeometry(), haloMaterial(), lights + 24, { renderOrder: 2 });
    this.lightWings = new Batch(this.root, wingsGeometry(), wingsMaterial(), lights, { renderOrder: 1 });

    // debris pool (one InstancedMesh, fixed size)
    this.debrisMax = DEBRIS_MAX[this.q] ?? 180;
    this.debrisMesh = new THREE.InstancedMesh(debrisGeometry(), debrisMaterial(), this.debrisMax);
    this.debrisMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.debrisMax * 3).fill(1), 3);
    this.debrisMesh.count = 0;
    this.debrisMesh.frustumCulled = false;
    this.debrisMesh.castShadow = this.q === 2;
    this.root.add(this.debrisMesh);
    this.debris = [];
    for (let i = 0; i < this.debrisMax; i++) this.debris.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, rx: 0, ry: 0, rz: 0, wx: 0, wy: 0, wz: 0, t: 0, life: 1, gy: 0, s: 1, r: 1, g: 1, b: 1 });
    this.debrisNext = 0;

    // flying lights pool
    this.fly = [];
    this.flyFree = [];
    for (let i = 0; i < FLY_MAX; i++) this.flyFree.push({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, t: 0, delay: 0, value: 1, body: null, halo: null });
    this.pending = 0;          // lights not yet credited (in flight)
    this.lightSfxT = 0; this.lightChain = 0; this.lightChainT = 0;

    // explosions (pooled spheres with own materials so opacity can differ)
    this.booms = [];
    this.boomGeo = geo('boom', () => new THREE.IcosahedronGeometry(1, 2));
    for (let i = 0; i < 5; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending });
      const mesh = new THREE.Mesh(this.boomGeo, mat);
      mesh.visible = false;
      this.root.add(mesh);
      this.booms.push({ mesh, t: 1, max: 0.45, size: 2.4 });
    }
    this.popups = [];
    this.chickens = [];
    this.discos = [];
    this.runners = [];
    this.combo = 0; this.comboT = 0; this.comboShown = 0;
    this.time = 0;

    this.offCp = bus.on('level:checkpoint', () => { for (const c of this.crates) c.snapshot?.(); });

    const self = this;
    this.entity = {
      object3d: this.root,
      alwaysUpdate: true, alwaysVisible: true,
      update(dt, c) { self.update(dt, c); },
      onRespawn(c) { self.onRespawn(c); },
      dispose() { self.dispose(); },
    };
  }

  // ---------------------------------------------------------------- batches
  crateBatch(look) {
    let b = this.batches.get(look);
    if (!b) {
      const hint = (this.capHint[look] || 0) + (look.startsWith('tnt') ? (this.capHint.tnt || 0) : 0) + 4;
      b = new Batch(this.root, crateGeometry(), crateMaterial(look), hint, { shadows: this.q === 2 && look !== 'outline', renderOrder: look === 'outline' ? 3 : 0 });
      this.batches.set(look, b);
    }
    return b;
  }

  register(c) { this.crates.add(c); }
  unregister(c) { this.crates.delete(c); }

  /** Flag crates resting on top of `crate` so they check their support (and fall). */
  flagAbove(crate) {
    const top = crate.box.max.y;
    for (const c of this.crates) {
      if (c === crate || c.broken || !c.box) continue;
      if (Math.abs(c.box.min.y - top) < 0.08 && overlapXZ(c.box, crate.box)) c.checkSupport = true;
    }
  }

  /** Crate defs (level data) at height y (± rounding), for "designed support". */
  defsAt(y) { return this.defsByY.get(Math.round(y * 10)) || []; }

  /** Highest support top under a crate box (static ground + solid entities). Sets this.supOwner. */
  supportTop(c) {
    const b = c.box, lvl = this.level;
    const y = b.min.y;
    let best = -Infinity; this.supOwner = null;
    const cx = (b.min.x + b.max.x) / 2, cz = (b.min.z + b.max.z) / 2, i = 0.3;
    const pts = [cx, cz, cx - i, cz - i, cx + i, cz - i, cx - i, cz + i, cx + i, cz + i];
    for (let k = 0; k < pts.length; k += 2) {
      const gy = groundBelow(lvl.world, pts[k], pts[k + 1], y + 0.02, 60, null);
      if (gy > best) best = gy;
    }
    for (const e of lvl.solids) {
      if (e === c || !e.solid || e.dead || e.intangible || e.broken || !e.box) continue;
      const s = e.box;
      if (s.max.y > y + 0.03 || s.max.y <= best) continue;
      if (!overlapXZ(b, s, 0.04)) continue;
      best = s.max.y; this.supOwner = e;
    }
    return best;
  }

  // ---------------------------------------------------------------- debris
  /** Plank debris: colors array, (dx,dz) push direction (spin = forward), power. */
  debrisBurst(x, y, z, colors = WOOD, dx = 0, dz = 0, push = 0, n = 9, gy = y) {
    const count = this.q === 0 ? Math.ceil(n * 0.55) : n;
    for (let k = 0; k < count; k++) {
      const d = this.debris[this.debrisNext];
      this.debrisNext = (this.debrisNext + 1) % this.debrisMax;
      const a = Math.random() * Math.PI * 2, sp = 2.2 + Math.random() * 3.2;
      d.on = true;
      d.x = x + (Math.random() - 0.5) * 0.7; d.y = y + 0.2 + Math.random() * 0.7; d.z = z + (Math.random() - 0.5) * 0.7;
      d.vx = Math.cos(a) * sp + dx * push * (0.6 + Math.random() * 0.8);
      d.vz = Math.sin(a) * sp + dz * push * (0.6 + Math.random() * 0.8);
      d.vy = 4 + Math.random() * 5.5;
      d.rx = Math.random() * 6; d.ry = Math.random() * 6; d.rz = Math.random() * 6;
      d.wx = (Math.random() - 0.5) * 22; d.wy = (Math.random() - 0.5) * 22; d.wz = (Math.random() - 0.5) * 22;
      d.t = 0; d.life = 1.0 + Math.random() * 0.6; d.gy = gy; d.s = 0.7 + Math.random() * 0.6;
      _c.setHex(colors[k % colors.length]);
      d.r = _c.r; d.g = _c.g; d.b = _c.b;
    }
  }

  // ---------------------------------------------------------------- flying lights
  /** n lights burst from (x,y,z), then fly into the player. Each is credited on arrival. */
  flyLights(x, y, z, n, { spread = 1, up = 6, delay = 0 } = {}) {
    for (let k = 0; k < n; k++) {
      const f = this.flyFree.pop();
      if (!f) { this.credit(n - k); return; }   // pool full → credit immediately
      const a = (k / n) * Math.PI * 2 + Math.random() * 0.6, sp = (1.4 + Math.random() * 1.8) * spread;
      f.x = x; f.y = y; f.z = z;
      f.vx = Math.cos(a) * sp; f.vz = Math.sin(a) * sp; f.vy = up * (0.7 + Math.random() * 0.5);
      f.t = 0; f.delay = delay + k * 0.025; f.value = 1; f.home = 0.32 + Math.random() * 0.18;
      f.body = this.lightBody.alloc(); f.halo = this.lightHalo.alloc();
      this.fly.push(f);
      this.pending++;
    }
  }

  credit(n) {
    if (n <= 0) return;
    this.ctx.game.addLights(n);
  }

  lightSfx() {
    if (this.lightSfxT > 0) return;
    this.lightSfxT = 0.045;
    this.lightChain = this.lightChainT > 0 ? Math.min(this.lightChain + 1, 14) : 0;
    this.lightChainT = 0.5;
    this.ctx.sfx('light', { vol: 0.55, pitch: 1 + this.lightChain * 0.045 });
  }

  // ---------------------------------------------------------------- explosions & pops
  boom(x, y, z, color = 0xffa040, size = 2.6) {
    let b = this.booms.find((o) => o.t >= o.max) || this.booms[0];
    b.t = 0; b.max = 0.42; b.size = size;
    b.mesh.material.color.setHex(color);
    b.mesh.position.set(x, y, z);
    b.mesh.visible = true;
    this.ctx.fx?.ring?.({ x, y: y - 0.45, z }, color, size * 1.3);
  }

  /** Harmless explosion (remote nitro detonation): breaks things around, never hurts the player. */
  softExplode(pos, radius, source) {
    const r2 = radius * radius;
    for (const e of this.level.entities) {
      if (e === source || e.dead || !e.onExplode || !e.box) continue;
      const cx = (e.box.min.x + e.box.max.x) / 2, cy = (e.box.min.y + e.box.max.y) / 2, cz = (e.box.min.z + e.box.max.z) / 2;
      const dx = cx - pos.x, dy = cy - pos.y, dz = cz - pos.z;
      if (dx * dx + dy * dy + dz * dz <= r2) e.onExplode(this.ctx, source);
    }
    this.ctx.shake(0.35);
    this.ctx.fx?.burst?.(pos, [0x9dff6a, 0x3a8a2a, 0xeaffd0], 18, { speed: 7 });
    this.ctx.sfx('explosion', { pos: new THREE.Vector3(pos.x, pos.y, pos.z), vol: 0.8 });
  }

  /** Icon pop-up (life head, mask, clock) rising from a crate. */
  popup(kind, x, y, z, scale = 1) {
    const sp = new THREE.Sprite(spriteMaterial(kind));
    sp.position.set(x, y, z);
    sp.scale.setScalar(0.01);
    sp.renderOrder = 9;
    this.root.add(sp);
    this.popups.push({ sp, t: 0, y0: y, scale });
  }

  text(x, y, z, str, color = '#fff7dc', opts = {}) {
    // core fx.text paints on a 256 px wide canvas: shrink the font so long labels are not clipped
    const px = Math.min(opts.px ?? 58, Math.floor(232 / (Math.max(1, str.length) * 0.6)));
    this.ctx.fx?.text?.({ x, y, z }, str, color, { ...opts, px });
  }

  /** Register a crate break for the combo counter. */
  comboHit(x, y, z) {
    this.combo = this.comboT > 0 ? this.combo + 1 : 1;
    this.comboT = COMBO_WINDOW;
    const label = comboLabel(this.combo, this.ctx.lang);
    if (label && this.combo > this.comboShown) {
      this.comboShown = this.combo;
      this.text(x, y + 0.4, z, label, comboColor(this.combo), { scale: this.combo >= 5 ? 1.25 : 1 });
      if (this.combo % 5 === 0) { this.ctx.sfx('light_many', { vol: 0.8 }); this.flyLights(x, y + 0.6, z, 2); }
    }
  }

  // ---------------------------------------------------------------- mystery: chicken & disco
  chicken(x, y, z) {
    const g = new THREE.Group();
    const white = lambertMat(0xfffaf0), red = lambertMat(0xe8402a), yellow = lambertMat(0xffb428), black = basicMat(0x111111);
    const body = new THREE.Mesh(geo('ck-body', () => new THREE.SphereGeometry(0.28, 12, 10)), white);
    body.scale.set(1, 0.9, 1.2); body.position.y = 0.42; g.add(body);
    const head = new THREE.Mesh(geo('ck-head', () => new THREE.SphereGeometry(0.16, 10, 8)), white);
    head.position.set(0, 0.72, 0.22); g.add(head);
    const comb = new THREE.Mesh(geo('ck-comb', () => new THREE.BoxGeometry(0.05, 0.12, 0.16)), red);
    comb.position.set(0, 0.88, 0.22); g.add(comb);
    const beak = new THREE.Mesh(geo('ck-beak', () => new THREE.ConeGeometry(0.06, 0.14, 6).rotateX(Math.PI / 2)), yellow);
    beak.position.set(0, 0.7, 0.4); g.add(beak);
    const wings = [];
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(geo('ck-eye', () => new THREE.SphereGeometry(0.03, 6, 4)), black);
      eye.position.set(sx * 0.09, 0.76, 0.34); g.add(eye);
      const wing = new THREE.Mesh(geo('ck-wing', () => new THREE.SphereGeometry(0.16, 8, 6)), white);
      wing.scale.set(0.35, 0.7, 1); wing.position.set(sx * 0.27, 0.45, 0); g.add(wing); wings.push(wing);
      const leg = new THREE.Mesh(geo('ck-leg', () => new THREE.CylinderGeometry(0.025, 0.025, 0.2, 5)), yellow);
      leg.position.set(sx * 0.1, 0.1, 0); g.add(leg);
    }
    g.position.set(x, y, z);
    this.root.add(g);
    const a = Math.random() * Math.PI * 2;
    this.chickens.push({ g, x, y, z, vx: Math.cos(a) * 3, vz: Math.sin(a) * 3, vy: 8, t: 0, turnT: 0.4, clucks: 0, wings });
    this.text(x, y + 0.8, z, this.ctx.lang === 'en' ? 'BOK BOK!' : 'COT COT !', '#ffd76a');
    this.ctx.sfx('quack', { pitch: 1.6, pos: new THREE.Vector3(x, y, z) });
  }

  disco(x, y, z) {
    const g = new THREE.Group();
    const ball = new THREE.Mesh(geo('disco-ball', () => new THREE.IcosahedronGeometry(0.42, 1)),
      cachedDiscoMat());
    ball.position.y = 2.6; g.add(ball);
    const string = new THREE.Mesh(geo('disco-str', () => new THREE.CylinderGeometry(0.015, 0.015, 3, 4)), basicMat(0x222222));
    string.position.y = 4.4; g.add(string);
    const beams = [];
    const cols = [0xff5a9a, 0x5ad6ff, 0xffe14a, 0x9a6aff, 0x5aff8a, 0xff8a3a];
    for (let i = 0; i < 6; i++) {
      const b = new THREE.Mesh(geo('disco-beam', () => new THREE.ConeGeometry(0.5, 3, 10, 1, true).translate(0, -1.5, 0)), basicMat(cols[i], { add: true, opacity: 0.18 }));
      b.position.y = 2.6;
      b.rotation.z = 0.7; b.rotation.y = i * Math.PI / 3;
      const pivot = new THREE.Group(); pivot.add(b); pivot.position.y = 0; g.add(pivot);
      beams.push(pivot);
    }
    g.position.set(x, y, z);
    this.root.add(g);
    this.discos.push({ g, ball, beams, t: 0, x, y, z, confT: 0 });
    this.text(x, y + 1.2, z, this.ctx.lang === 'en' ? 'MINI DISCO!' : 'MINI DISCO !', '#ff7aa8', { scale: 1.2 });
    this.ctx.sfx('mask_invincible', { vol: 0.7 });
  }

  /** Chicken legs that keep running after their crate broke. */
  runner(group, x, y, z, dx, dz) {
    this.root.add(group);
    group.position.set(x, y, z);
    group.rotation.y = Math.atan2(dx, dz);
    this.runners.push({ g: group, x, y, z, dx, dz, t: 0 });
  }

  // ---------------------------------------------------------------- update
  update(dt, ctx) {
    this.time += dt;
    const p = ctx.player;
    this.lightSfxT -= dt; this.lightChainT -= dt;
    if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) { this.combo = 0; this.comboShown = 0; } }

    // shared material pulses
    const nitro = this.batches.get('nitro');
    if (nitro) nitro.material.emissiveIntensity = 0.3 + 0.25 * (0.5 + 0.5 * Math.sin(this.time * 19)) * (0.6 + 0.4 * Math.sin(this.time * 3.1));
    const mys = this.batches.get('mystery');
    if (mys) mys.material.color.setHSL((this.time * 0.25) % 1, 0.55, 0.78);
    const outl = this.batches.get('outline');
    if (outl) outl.material.opacity = 0.55 + 0.25 * Math.sin(this.time * 3);

    // debris
    let n = 0;
    const dm = this.debrisMesh, ca = dm.instanceColor.array;
    for (const d of this.debris) {
      if (!d.on) continue;
      d.t += dt;
      if (d.t >= d.life) { d.on = false; continue; }
      d.vy -= 26 * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      if (d.y < d.gy + 0.04 && d.vy < 0) {
        d.y = d.gy + 0.04; d.vy *= -0.32; d.vx *= 0.55; d.vz *= 0.55; d.wx *= 0.5; d.wy *= 0.5; d.wz *= 0.5;
      }
      d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      const k = d.t > d.life - 0.3 ? (d.life - d.t) / 0.3 : 1;
      const s = d.s * k;
      dm.setMatrixAt(n, trs(d.x, d.y, d.z, d.rx, d.ry, d.rz, s, s, s));
      ca[n * 3] = d.r; ca[n * 3 + 1] = d.g; ca[n * 3 + 2] = d.b;
      n++;
    }
    if (n || dm.count) {
      dm.count = n;
      dm.instanceMatrix.needsUpdate = true;
      dm.instanceColor.needsUpdate = true;
    }

    // flying lights
    const camQ = ctx.camera?.quaternion || _q;
    const tx = p.pos.x, ty = p.pos.y + 0.75, tz = p.pos.z;
    for (let i = this.fly.length - 1; i >= 0; i--) {
      const f = this.fly[i];
      f.t += dt;
      if (f.t < f.delay) continue;
      const lt = f.t - f.delay;
      if (lt < f.home) {
        f.vy -= 18 * dt;
        f.vx *= 0.97; f.vz *= 0.97;
      } else {
        const dx = tx - f.x, dy = ty - f.y, dz = tz - f.z;
        const dist = Math.hypot(dx, dy, dz) || 1e-3;
        const sp = 9 + (lt - f.home) * 40;
        const k = Math.min(1, dt * 9);
        f.vx += (dx / dist * sp - f.vx) * k; f.vy += (dy / dist * sp - f.vy) * k; f.vz += (dz / dist * sp - f.vz) * k;
        if (dist < 0.45 || lt > 3) { this.arrive(f, i); continue; }
      }
      f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
      const pulse = 1 + 0.15 * Math.sin(this.time * 20 + i);
      this.lightBody.matrix(f.body, trs(f.x, f.y, f.z, 0, 0, 0, 1.15, 1.15, 1.15));
      this.lightHalo.matrix(f.halo, trsQ(f.x, f.y, f.z, camQ, 0.85 * pulse, 0.85 * pulse, 1));
    }

    // explosions
    for (const b of this.booms) {
      if (b.t >= b.max) continue;
      b.t += dt;
      const k = Math.min(1, b.t / b.max);
      b.mesh.scale.setScalar(0.3 + b.size * (1 - (1 - k) * (1 - k)));
      b.mesh.material.opacity = 0.9 * (1 - k);
      if (k >= 1) b.mesh.visible = false;
    }

    // pop-ups
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const o = this.popups[i];
      o.t += dt;
      const k = o.t / 1.1;
      const s = (k < 0.2 ? k / 0.2 * 1.2 : k > 0.75 ? Math.max(0, (1 - k) / 0.25) : 1.2 - (k - 0.2) * 0.3) * o.scale;
      o.sp.scale.setScalar(s);
      o.sp.position.y = o.y0 + 0.4 + Math.min(1, k * 2.2) * 1.3;
      o.sp.material.rotation = Math.sin(o.t * 9) * 0.15;
      if (k >= 1) { this.root.remove(o.sp); this.popups.splice(i, 1); }
    }

    // chickens
    for (let i = this.chickens.length - 1; i >= 0; i--) {
      const c = this.chickens[i];
      c.t += dt;
      c.turnT -= dt;
      if (c.turnT <= 0) {
        c.turnT = 0.3 + Math.random() * 0.5;
        const a = Math.random() * Math.PI * 2, sp = 3 + Math.random() * 2.5;
        c.vx = Math.cos(a) * sp; c.vz = Math.sin(a) * sp;
        if (Math.random() < 0.35) { ctx.sfx('quack', { pitch: 1.5 + Math.random() * 0.4, vol: 0.6, pos: new THREE.Vector3(c.x, c.y, c.z) }); }
      }
      const nx = c.x + c.vx * dt, nz = c.z + c.vz * dt;
      const gy = groundBelow(this.level.world, nx, nz, c.y + 0.6, 6, this.level.solids);
      if (gy > -Infinity && gy <= c.y + 0.6) { c.x = nx; c.z = nz; } else { c.vx = -c.vx; c.vz = -c.vz; }
      c.vy -= 24 * dt;
      c.y += c.vy * dt;
      const floor = groundBelow(this.level.world, c.x, c.z, c.y + 0.5, 30, this.level.solids);
      if (c.y < floor) { c.y = floor; c.vy = Math.random() < 0.08 ? 5 : 0; }
      c.g.position.set(c.x, c.y + Math.abs(Math.sin(c.t * 18)) * 0.06, c.z);
      c.g.rotation.y = Math.atan2(c.vx, c.vz);
      for (const w of c.wings) w.rotation.z = Math.sin(c.t * 40) * 0.6 * Math.sign(w.position.x);
      if (c.t > 3.6 || c.y < (this.level.data.killY ?? -15)) {
        ctx.fx?.burst?.({ x: c.x, y: c.y + 0.2, z: c.z }, [0xffffff, 0xfff1d0, 0xffd76a], 22, { speed: 4, gravity: 3, life: 1.2 });
        this.flyLights(c.x, c.y + 0.6, c.z, 3, { up: 4 });
        ctx.sfx('quack', { pitch: 2, pos: new THREE.Vector3(c.x, c.y, c.z) });
        this.root.remove(c.g);
        this.chickens.splice(i, 1);
      }
    }

    // discos
    for (let i = this.discos.length - 1; i >= 0; i--) {
      const d = this.discos[i];
      d.t += dt;
      const appear = Math.min(1, d.t * 4), vanish = d.t > 1.8 ? Math.max(0, (2.1 - d.t) / 0.3) : 1;
      d.g.scale.setScalar(appear * vanish + 0.001);
      d.ball.rotation.y += dt * 4;
      d.ball.material.emissive.setHSL((d.t * 2) % 1, 1, 0.5);
      d.beams.forEach((b, k) => { b.rotation.y = d.t * (k % 2 ? 2.4 : -1.8) + k; });
      d.confT -= dt;
      if (d.confT <= 0 && d.t < 1.9) {
        d.confT = 0.12;
        ctx.fx?.burst?.({ x: d.x, y: d.y + 2.4, z: d.z }, [0xff5a9a, 0x5ad6ff, 0xffe14a, 0x9a6aff, 0x5aff8a], 6, { speed: 4, gravity: 4, life: 1.1 });
      }
      if (d.t >= 2.1) {
        this.root.remove(d.g);
        this.discos.splice(i, 1);
        this.flyLights(d.x, d.y + 2.4, d.z, 5, { up: 3 });
      }
    }

    // runaway legs
    for (let i = this.runners.length - 1; i >= 0; i--) {
      const r = this.runners[i];
      r.t += dt;
      r.x += r.dx * 7 * dt; r.z += r.dz * 7 * dt;
      r.g.position.set(r.x, r.y + Math.abs(Math.sin(r.t * 24)) * 0.12, r.z);
      const legs = r.g.userData.legs;
      if (legs) legs.forEach((l, k) => { l.rotation.x = Math.sin(r.t * 24 + k * Math.PI) * 0.9; });
      if (r.t > 1.4) r.g.scale.setScalar(Math.max(0.001, (1.8 - r.t) / 0.4));
      if (r.t > 1.8) { this.root.remove(r.g); this.runners.splice(i, 1); }
    }
  }

  arrive(f, i) {
    this.lightBody.free(f.body); this.lightHalo.free(f.halo);
    f.body = f.halo = null;
    this.fly[i] = this.fly[this.fly.length - 1];
    this.fly.pop();
    this.flyFree.push(f);
    this.pending--;
    this.credit(f.value);
    this.lightSfx();
  }

  onRespawn() {
    // lights in flight are credited (they were earned)
    for (let i = this.fly.length - 1; i >= 0; i--) this.arrive(this.fly[i], i);
    for (const d of this.debris) d.on = false;
    for (const c of this.chickens) this.root.remove(c.g);
    for (const d of this.discos) this.root.remove(d.g);
    for (const r of this.runners) this.root.remove(r.g);
    for (const o of this.popups) this.root.remove(o.sp);
    this.chickens.length = 0; this.discos.length = 0; this.runners.length = 0; this.popups.length = 0;
    this.combo = 0; this.comboT = 0; this.comboShown = 0;
  }

  dispose() {
    this.offCp?.();
    for (const b of this.batches.values()) b.dispose();
    this.lightBody.dispose(); this.lightHalo.dispose(); this.lightWings.dispose();
    this.root.remove(this.debrisMesh); this.debrisMesh.dispose();
    for (const b of this.booms) { this.root.remove(b.mesh); b.mesh.material.dispose(); }
    this.level.root.remove(this.root);
    managers.delete(this.level);
  }
}

let _discoMat = null;
function cachedDiscoMat() {
  if (!_discoMat) { _discoMat = new THREE.MeshLambertMaterial({ color: 0xdfe8ff, flatShading: true }); _discoMat.emissive.set(0xff00ff); _discoMat.emissiveIntensity = 0.7; }
  return _discoMat;
}

export { WOOD };
