// Pickups — `type: 'pickup'`: floating winged lights (instanced, magnetized into Lumen), secret socks, the golden
// sock, wooden joke signs and the end-of-level "Portail Lumineux".
import * as THREE from 'three';
import { registerEntity } from '../../core/registry.js';
import { boxOverlap } from '../../core/physics.js';
import { bus } from '../../core/events.js';
import { crateFx, trs } from './crate-fx.js';
import { sockToast, tr, wrapText, PICKUP_KINDS } from './crate-logic.js';
import {
  geo, lambertMat, basicMat, cachedMat, sockGeometry, sockMaterial, signTexture, measureSign, swirlTexture, haloTexture,
} from './crate-art.js';

const MAGNET = 2.4;
const _q = new THREE.Quaternion();

registerEntity('pickup', (def, ctx) => {
  switch (def.kind) {
    case 'light': return new LightPickup(def, ctx);
    case 'sock': return ctx.level.stats.socks.includes(def.color || 'red') ? null : new SockPickup(def, ctx, false);
    case 'goldSock': return ctx.level.stats.goldSock ? null : new SockPickup(def, ctx, true);
    case 'sign': return new Sign(def, ctx);
    case 'goal': return new Goal(def, ctx);
    default:
      if (!PICKUP_KINDS.includes(def.kind)) console.warn(`[pickups] unknown pickup kind "${def.kind}"`);
      return null;
  }
});

function boxAround(x, y, z, hx, hy, hz, out = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }) {
  out.min.x = x - hx; out.max.x = x + hx; out.min.y = y - hy; out.max.y = y + hy; out.min.z = z - hz; out.max.z = z + hz;
  return out;
}

// ------------------------------------------------------------------ light (luciole)
class LightPickup {
  constructor(def, ctx) {
    this.ctx = ctx;
    this.fx = crateFx(ctx);
    this.d = def;
    this.x = def.x; this.y = def.y; this.z = def.z;
    this.object3d = new THREE.Group();
    this.object3d.position.set(this.x, this.y, this.z);
    this.box = boxAround(this.x, this.y, this.z, 0.3, 0.3, 0.3);
    this.phase = Math.random() * Math.PI * 2;
    this.rotY = Math.random() * Math.PI * 2;
    this.homing = false; this.speed = 0;
    this.body = this.fx.lightBody.alloc();
    this.halo = this.fx.lightHalo.alloc();
    this.wings = this.fx.lightWings.alloc();
    this.oy = 0;
    this.draw(0);
  }

  update(dt, ctx) {
    const p = ctx.player, t = ctx.time;
    if (this.homing) {
      if (p.dead) { this.homing = false; }
      else {
        const tx = p.pos.x, ty = p.pos.y + 0.7, tz = p.pos.z;
        const dx = tx - this.x, dy = ty - (this.y + this.oy), dz = tz - this.z;
        const d = Math.hypot(dx, dy, dz) || 1e-3;
        this.speed = Math.min(26, this.speed + dt * 45);
        const step = Math.min(d, this.speed * dt);
        this.x += dx / d * step; this.y += dy / d * step; this.z += dz / d * step;
        if (d < 0.5) { this.collect(); return; }
      }
    } else {
      this.oy = Math.sin(t * 2.4 + this.phase) * 0.12;
      if (!p.dead && !ctx.level.finished) {
        const dx = p.pos.x - this.x, dy = p.pos.y + 0.6 - this.y, dz = p.pos.z - this.z;
        if (dx * dx + dy * dy + dz * dz < MAGNET * MAGNET) { this.homing = true; this.speed = 4; }
      }
    }
    boxAround(this.x, this.y + this.oy, this.z, 0.3, 0.3, 0.3, this.box);
    this.draw(t);
  }

  draw(t) {
    const fx = this.fx, y = this.y + this.oy;
    const pulse = 1 + 0.12 * Math.sin(t * 6 + this.phase);
    fx.lightBody.matrix(this.body, trs(this.x, y, this.z, 0, 0, 0, 1, 1, 1));
    const camQ = this.ctx.camera?.quaternion || _q;
    fx.lightHalo.matrix(this.halo, trs(0, 0, 0, 0, 0, 0, 1, 1, 1).compose(_tmpP.set(this.x, y, this.z), camQ, _tmpS.set(0.95 * pulse, 0.95 * pulse, 1)));
    const flap = Math.cos(t * 30 + this.phase);
    const ry = this.homing ? Math.atan2(this.ctx.player.pos.x - this.x, this.ctx.player.pos.z - this.z) : this.rotY + Math.sin(t * 0.8 + this.phase) * 0.6;
    fx.lightWings.matrix(this.wings, trs(this.x, y + 0.03, this.z, 0, ry, 0, 1, flap, 1));
  }

  collect() {
    const ctx = this.ctx;
    this.dead = true;
    ctx.level.markGone(this.d.id);
    this.fx.credit(1);
    this.fx.lightSfx();
    ctx.fx?.burst?.({ x: this.x, y: this.y - 0.4, z: this.z }, [0xfff1a0, 0xffd76a], 4, { speed: 2.2, life: 0.35, size: 0.6 });
    this.release();
  }

  onRespawn() {
    this.x = this.d.x; this.y = this.d.y; this.z = this.d.z;
    this.homing = false; this.speed = 0;
  }

  release() {
    const fx = this.fx;
    if (this.body) { fx.lightBody.free(this.body); fx.lightHalo.free(this.halo); fx.lightWings.free(this.wings); }
    this.body = this.halo = this.wings = null;
  }

  dispose() { this.release(); }
}
const _tmpP = new THREE.Vector3();
const _tmpS = new THREE.Vector3();

// ------------------------------------------------------------------ socks
class SockPickup {
  constructor(def, ctx, gold) {
    this.ctx = ctx;
    this.d = def;
    this.gold = gold;
    this.color = gold ? 'gold' : (def.color || 'red');
    this.object3d = new THREE.Group();
    this.object3d.position.set(def.x, def.y, def.z);
    const s = gold ? 1.5 : 1.1;
    const sock = new THREE.Mesh(sockGeometry(), sockMaterial(this.color));
    sock.scale.setScalar(s);
    sock.castShadow = ctx.quality?.level === 2;
    this.spin = new THREE.Group();
    this.spin.add(sock);
    this.object3d.add(this.spin);
    const glow = new THREE.Sprite(cachedMat(`sock-glow:${gold ? 1 : 0}`, () => new THREE.SpriteMaterial({
      map: haloTexture(gold ? 'gold' : 'sock', gold ? 'rgba(255,240,170,1)' : 'rgba(255,255,255,0.8)', gold ? 'rgba(255,200,60,0.5)' : 'rgba(200,220,255,0.25)'),
      blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    })));
    glow.scale.setScalar(gold ? 2.6 : 1.6);
    this.glow = glow;
    this.object3d.add(glow);
    this.box = boxAround(def.x, def.y, def.z, 0.45, 0.5, 0.45);
    this.t = Math.random() * 3;
    this.sparkT = 0;
  }

  update(dt, ctx) {
    this.t += dt;
    this.spin.rotation.y += dt * (this.gold ? 2.4 : 3);
    this.spin.position.y = Math.sin(this.t * 2.2) * 0.12;
    this.glow.scale.setScalar((this.gold ? 2.6 : 1.6) * (1 + 0.08 * Math.sin(this.t * 5)));
    this.sparkT -= dt;
    if (this.sparkT <= 0) {
      this.sparkT = this.gold ? 0.15 : 0.5;
      const o = this.object3d.position;
      ctx.fx?.burst?.({ x: o.x + (Math.random() - 0.5) * 0.6, y: o.y - 0.4, z: o.z + (Math.random() - 0.5) * 0.6 }, this.gold ? [0xffd34a, 0xfff1c4] : [0xffffff], 1, { speed: 1, life: 0.6, size: 0.6, gravity: -2, up: 0 });
    }
  }

  onTouch(p, ctx) {
    if (this.dead) return;
    this.dead = true;
    const o = this.object3d.position;
    if (this.gold) {
      ctx.level.stats.goldSock = true;
      ctx.sfx('gold_sock');
      bus.emit('toast', { text: { fr: 'CHAUSSETTE DORÉE ! Le grand luxe.', en: 'GOLDEN SOCK! Pure luxury.' }, kind: 'big' });
    } else {
      ctx.level.stats.socks.push(this.color);
      ctx.sfx('sock');
      bus.emit('toast', { text: sockToast(this.color), kind: 'info' });
    }
    ctx.level.markGone(this.d.id);
    ctx.fx?.burst?.(o, this.gold ? [0xffd34a, 0xfff1c4, 0xffffff] : [0xffffff, 0xffd76a, 0x9fd8ff], 26, { speed: 6, life: 0.9 });
    ctx.fx?.ring?.({ x: o.x, y: o.y - 0.5, z: o.z }, this.gold ? 0xffd34a : 0xffffff, 1.8);
  }
}

// ------------------------------------------------------------------ signs
class Sign {
  constructor(def, ctx) {
    this.ctx = ctx;
    this.d = def;
    const lang = ctx.lang || 'fr';
    const str = tr(def.text, lang) || '…';
    const lines = wrapText(str, 440, measureSign(str.length > 60 ? 34 : 42), 5);
    this.tex = signTexture(lines, lang);
    this.front = new THREE.MeshLambertMaterial({ map: this.tex });
    const wood = lambertMat(0x9a6230);
    this.object3d = new THREE.Group();
    this.object3d.position.set(def.x, def.y, def.z);
    this.object3d.rotation.y = def.r ?? def.ry ?? 0;
    this.board = new THREE.Group();
    this.board.position.y = 1.35;
    const board = new THREE.Mesh(geo('sign-board', () => new THREE.BoxGeometry(1.7, 0.85, 0.08)), [wood, wood, wood, wood, this.front, wood]);
    this.board.add(board);
    this.object3d.add(this.board);
    for (const sx of [-0.62, 0.62]) {
      const post = new THREE.Mesh(geo('sign-post', () => new THREE.BoxGeometry(0.1, 1.4, 0.1).translate(0, 0.7, 0)), wood);
      post.position.set(sx, 0, -0.07);
      this.object3d.add(post);
    }
    if (ctx.quality?.level === 2) this.object3d.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.box = boxAround(def.x, def.y + 1, def.z, 0.9, 1, 0.3);
    this.shown = false;
    this.wob = 0; this.t = 0;
  }

  update(dt, ctx) {
    this.t += dt;
    if (!this.shown) {
      const p = ctx.player;
      const dx = p.pos.x - this.d.x, dz = p.pos.z - this.d.z;
      if (!p.dead && dx * dx + dz * dz < 9 && Math.abs(p.pos.y - this.d.y) < 3) {
        this.shown = true;
        this.wob = 1;
        bus.emit('toast', { text: this.d.text, kind: 'joke' });
      }
    }
    if (this.wob > 0) {
      this.wob = Math.max(0, this.wob - dt * 1.2);
      this.board.rotation.z = Math.sin(this.t * 14) * 0.08 * this.wob;
    }
  }

  onSpin() { this.wob = 1; this.ctx.sfx('crate_bounce', { vol: 0.4, pitch: 0.7 }); }

  dispose() { this.tex.dispose(); this.front.dispose(); }
}

// ------------------------------------------------------------------ goal portal
class Goal {
  constructor(def, ctx) {
    this.ctx = ctx;
    this.d = def;
    const side = ctx.level.data?.dir === 'x';
    this.object3d = new THREE.Group();
    this.object3d.position.set(def.x, def.y, def.z);
    if (side) this.object3d.rotation.y = Math.PI / 2;
    const gold = lambertMat(0xffd76a, { emissive: 0xffb43a, ei: 0.9 });
    const teal = lambertMat(0x7ad7c4, { emissive: 0x3fc1b4, ei: 0.8 });
    // pad
    const pad = new THREE.Mesh(geo('goal-pad', () => new THREE.CylinderGeometry(1.5, 1.65, 0.16, 28)), lambertMat(0x6a5a8a));
    pad.position.y = 0.08; this.object3d.add(pad);
    const padGlow = new THREE.Mesh(geo('goal-padring', () => new THREE.TorusGeometry(1.35, 0.06, 6, 40).rotateX(Math.PI / 2)), teal);
    padGlow.position.y = 0.17; this.object3d.add(padGlow);
    const disc = new THREE.Mesh(geo('goal-paddisc', () => new THREE.CircleGeometry(1.3, 28).rotateX(-Math.PI / 2)),
      cachedMat('goal-paddisc', () => new THREE.MeshBasicMaterial({ map: swirlTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, opacity: 0.55 })));
    disc.position.y = 0.18; this.padDisc = disc; this.object3d.add(disc);
    // ring
    this.ring = new THREE.Group();
    this.ring.position.y = 1.75;
    const torus = new THREE.Mesh(geo('goal-torus', () => new THREE.TorusGeometry(1.15, 0.13, 10, 40)), gold);
    this.ring.add(torus);
    const inner = new THREE.Mesh(geo('goal-torus2', () => new THREE.TorusGeometry(0.98, 0.04, 6, 40)), teal);
    this.ring.add(inner);
    for (let i = 0; i < 8; i++) {
      const gem = new THREE.Mesh(geo('goal-gem', () => new THREE.OctahedronGeometry(0.11, 0)), i % 2 ? teal : lambertMat(0xff7f6a, { emissive: 0xff5a3a, ei: 0.7 }));
      const a = i / 8 * Math.PI * 2;
      gem.position.set(Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0.12);
      this.ring.add(gem);
    }
    this.swirl = new THREE.Mesh(geo('goal-swirl', () => new THREE.CircleGeometry(1.0, 32)),
      cachedMat('goal-swirl', () => new THREE.MeshBasicMaterial({ map: swirlTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, side: THREE.DoubleSide })));
    this.ring.add(this.swirl);
    this.swirl2 = new THREE.Mesh(geo('goal-swirl'), cachedMat('goal-swirl'));
    this.swirl2.scale.setScalar(0.7);
    this.swirl2.position.z = 0.01;
    this.ring.add(this.swirl2);
    this.object3d.add(this.ring);
    // light column + orbiting motes
    const beam = new THREE.Mesh(geo('goal-beam', () => new THREE.CylinderGeometry(1.05, 1.3, 6, 20, 1, true).translate(0, 3, 0)),
      basicMat(0xfff1c4, { add: true, opacity: 0.12, side: THREE.DoubleSide }));
    this.object3d.add(beam);
    this.motes = [];
    for (let i = 0; i < 7; i++) {
      const m = new THREE.Mesh(geo('goal-mote', () => new THREE.SphereGeometry(0.07, 6, 4)), basicMat(i % 2 ? 0xfff1a0 : 0x9ff3e4));
      this.object3d.add(m);
      this.motes.push(m);
    }
    const glow = new THREE.Sprite(cachedMat('goal-glow', () => new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, opacity: 0.8 })));
    glow.position.y = 1.75; glow.scale.setScalar(4.2);
    this.object3d.add(glow);
    this.box = side ? boxAround(def.x, def.y + 1.5, def.z, 0.7, 1.5, 1.3) : boxAround(def.x, def.y + 1.5, def.z, 1.3, 1.5, 0.7);
    this.t = 0;
    this.done = false;
    this.alwaysVisible = true;
  }

  update(dt, ctx) {
    this.t += dt;
    const spd = this.done ? 9 : 1.6;
    this.swirl.rotation.z -= dt * spd;
    this.swirl2.rotation.z += dt * spd * 1.6;
    this.padDisc.rotation.y += dt * spd * 0.6;
    this.ring.rotation.z = Math.sin(this.t * 0.7) * 0.08;
    this.ring.position.y = 1.75 + Math.sin(this.t * 1.6) * 0.06;
    this.motes.forEach((m, i) => {
      const a = this.t * (1.2 + i * 0.13) + i * 0.9, r = 1.25 + 0.2 * Math.sin(this.t * 2 + i);
      m.position.set(Math.cos(a) * r, 0.4 + ((this.t * 0.5 + i / 7) % 1) * 3, Math.sin(a) * r);
    });
    if (this.done) this.ring.scale.setScalar(1 + 0.15 * Math.sin(this.t * 20) * Math.max(0, 1 - (this.t - this.doneT)));
  }

  onTouch(p, ctx) {
    if (this.done || p.dead || ctx.level.finished) return;
    this.done = true;
    this.doneT = this.t;
    const o = this.object3d.position;
    ctx.fx?.burst?.({ x: o.x, y: o.y + 1.2, z: o.z }, [0xffd76a, 0x7ad7c4, 0xfff1c4, 0xff7f6a], 50, { speed: 8, life: 1.2 });
    ctx.fx?.ring?.({ x: o.x, y: o.y, z: o.z }, 0xffd76a, 3.5);
    ctx.shake(0.25);
    ctx.level.complete();
  }
}
