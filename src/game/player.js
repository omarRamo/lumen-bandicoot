// Lumen — the player controller. Crash-like moveset: run, jump (variable height), spin ("Toupie d'écharpe"),
// slide (+ slide-jump), body slam, plus unlockable powers: doubleJump, tornado (hold spin to glide),
// superSlam, turbo. Visuals come from src/art/lumen.js; this file only does gameplay.
import * as THREE from 'three';
import { input } from '../core/input.js';
import { moveBody, bodyBox, groundBelow } from '../core/physics.js';
import { createLumen, createOku, createMount } from '../art/lumen.js';

const T = {
  runSpeed: 7.6, turboSpeed: 10.8, accel: 60, decel: 48, airAccel: 30,
  iceAccel: 7, iceDecel: 1.6,
  gravity: 34, jumpVel: 12.4, doubleJumpVel: 11.2, jumpCut: 2.6, maxFall: 30,
  coyote: 0.11, buffer: 0.13,
  spinTime: 0.5, spinCooldown: 0.22, spinHangVy: -1.5, tornadoMax: 1.8, tornadoFall: -2.6,
  slideTime: 0.5, slideSpeed: 12, slideJumpSpeed: 10.5,
  slamVy: -28, slamHop: 5,
  bounceVy: 12.5,
};

const STAND_H = 0.56, SLIDE_H = 0.3;

export class Player {
  constructor(ctx) {
    this.ctx = ctx;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.ext = new THREE.Vector3(); // external velocity (conveyors, wind)
    this.half = { x: 0.3, y: STAND_H, z: 0.3 };
    this.box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    this.spinBox = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    this.object3d = new THREE.Group();
    this.object3d.name = 'player';
    this.art = createLumen({ scarf: ctx.game?.scarfColor });
    this.object3d.add(this.art.object3d);
    this.oku = createOku();
    this.mount = null;
    this.shadow = makeBlobShadow();
    this.reset();
  }

  reset() {
    this.vel.set(0, 0, 0);
    this.ext.set(0, 0, 0);
    this.grounded = false;
    this.groundSolid = null;
    this.coyoteT = 0;
    this.bufferT = 0;
    this.jumpHeld = false;
    this.usedDouble = false;
    this.spinT = 0;
    this.spinCd = 0;
    this.spinId = 0;
    this.spinning = false;
    this.slideT = 0;
    this.sliding = false;
    this.slamming = false;
    this.slamHopT = 0;
    this.dead = false;
    this.deathT = 0;
    this.hurtT = 0;
    this.invincible = false;
    this.facing = Math.PI; // facing -Z (into the screen)
    this.anim = 'idle';
    this.landT = 0;
    this.airT = 0;
    this.stepT = 0;
    this.celebrating = false;
    this.frozen = false;
    this.lockZ = null;
    this.autoRun = 0;
    this.half.y = STAND_H;
    this.art.reset?.();
  }

  spawn(p) {
    this.reset();
    this.pos.set(p[0], p[1], p[2]);
    this.syncBox();
    this.object3d.position.copy(this.pos);
    this.object3d.rotation.y = this.facing;
  }

  setMount(kind) {
    if (this.mount) { this.object3d.remove(this.mount.object3d); this.mount.dispose?.(); this.mount = null; }
    this.art.object3d.position.set(0, 0, 0);
    if (!kind) return;
    this.mount = createMount(kind);
    if (!this.mount) return;
    this.object3d.add(this.mount.object3d);
    const seat = this.mount.seat;
    if (seat) {
      this.mount.object3d.updateMatrixWorld(true);
      this.art.object3d.position.copy(seat.position || seat);
    }
  }

  syncBox() { bodyBox(this.pos, this.half, this.box); }

  /** Forced bounce (crate top, enemy stomp, spring). */
  bounce(vy = T.bounceVy) {
    this.vel.y = vy;
    this.grounded = false;
    this.coyoteT = 0;
    this.usedDouble = false;
    this.slamming = false;
    this.jumpHeld = input.held('jump');
    this.airT = 0.01;
    this.anim = 'jump';
  }

  launch(vx, vy, vz) { this.vel.set(vx, vy, vz); this.grounded = false; this.coyoteT = 0; this.slamming = false; }

  die(cause = 'generic') {
    if (this.dead) return 0;
    this.dead = true;
    this.spinning = false; this.sliding = false; this.slamming = false;
    this.vel.set(0, 0, 0);
    const dur = this.art.playDeath?.(cause) ?? 1.4;
    this.deathT = 0;
    return dur;
  }

  hurtFlash(seconds = 1.6) { this.hurtT = seconds; }

  celebrate() { this.celebrating = true; this.vel.set(0, 0, 0); }

  get speedXZ() { return Math.hypot(this.vel.x, this.vel.z); }

  update(dt, ctx) {
    const { level, game } = ctx;
    const rig = ctx.rig;
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.invincible = game.masks >= 3;

    if (this.dead) {
      this.deathT += dt;
      this.art.update(dt, { anim: 'dead', t: this.deathT, speed: 0, vy: 0 });
      this.oku.update?.(dt, { count: 0, target: this.object3d, time: ctx.time });
      return;
    }
    if (this.celebrating || this.frozen) {
      this.vel.x *= 0.8; this.vel.z *= 0.8;
      if (!this.grounded) this.vel.y -= T.gravity * dt;
      this.integrate(dt, ctx);
      this.anim = this.celebrating ? 'victory' : 'idle';
      this.animate(dt, ctx);
      return;
    }

    // ---- input → wished direction (camera relative)
    const wish = { x: 0, z: 0 };
    if (this.autoRun) {
      // ride/auto-run: forward is the level direction, stick X steers
      wish.x = input.move.x;
      wish.z = 0;
    } else if (rig) rig.toWorld(input.move.x, input.move.y, wish);
    if (this.lockZ !== null) wish.z = 0;
    const wishLen = Math.min(1, Math.hypot(wish.x, wish.z));

    // timers
    this.coyoteT = this.grounded ? T.coyote : Math.max(0, this.coyoteT - dt);
    this.bufferT = Math.max(0, this.bufferT - dt);
    this.spinCd = Math.max(0, this.spinCd - dt);
    this.landT = Math.max(0, this.landT - dt);
    if (input.pressed('jump')) this.bufferT = T.buffer;

    const ground = this.groundSolid;
    const slippery = this.grounded && ground && (ground.slippery || ground.__owner?.slippery);
    const turbo = game.hasPower('turbo') && this.grounded && input.held('slide') && !this.sliding && wishLen > 0.3;
    const maxSpeed = (turbo ? T.turboSpeed : T.runSpeed) * (this.spinning ? 1.08 : 1);

    // ---- spin
    const canSpin = !this.mount && !this.sliding && !this.slamming;
    if (canSpin && input.pressed('spin') && this.spinCd <= 0 && this.spinT <= 0) {
      this.spinT = T.spinTime;
      this.spinId++;
      ctx.sfx('spin');
      if (!this.grounded && this.vel.y < 2) this.vel.y = Math.max(this.vel.y, 2);
    }
    if (this.spinT > 0) {
      const tornado = game.hasPower('tornado') && input.held('spin') && !this.grounded && this.airT < T.tornadoMax + 0.4;
      if (tornado && this.spinT < 0.1) {
        this.spinT = 0.1;
        this.tornadoTick = (this.tornadoTick || 0) + dt;
        if (this.tornadoTick > 0.35) { this.tornadoTick = 0; this.spinId++; }
      }
      this.spinT -= dt;
      this.spinning = true;
      if (!this.grounded) this.vel.y = Math.max(this.vel.y, tornado ? T.tornadoFall : T.spinHangVy - 2);
      if (this.spinT <= 0) { this.spinning = false; this.spinCd = T.spinCooldown; }
    } else this.spinning = false;

    // ---- slide / slam (same button)
    if (input.pressed('slide') && !this.mount) {
      if (this.grounded && this.slideT <= 0 && !this.spinning) {
        this.slideT = T.slideTime;
        this.slideId = (this.slideId || 0) + 1;
        const dir = wishLen > 0.2 ? Math.atan2(wish.x, wish.z) : this.facing;
        this.facing = dir;
        this.vel.x = Math.sin(dir) * T.slideSpeed;
        this.vel.z = Math.cos(dir) * T.slideSpeed;
        ctx.sfx('slide');
      } else if (!this.grounded && !this.slamming && this.airT > 0.08) {
        this.slamming = true;
        this.slamHopT = 0.14;
        this.vel.set(0, T.slamHop, 0);
        this.spinT = 0; this.spinning = false;
      }
    }
    if (this.slideT > 0) {
      this.slideT -= dt;
      this.sliding = true;
      this.half.y = SLIDE_H;
      const f = 1 - Math.exp(-dt * 2.5);
      this.vel.x -= this.vel.x * f; this.vel.z -= this.vel.z * f;
      if (this.slideT <= 0) this.endSlide(level);
    }

    // ---- horizontal velocity
    if (!this.sliding && !this.slamming) {
      const tx = wish.x * maxSpeed, tz = wish.z * maxSpeed;
      let a;
      if (!this.grounded) a = T.airAccel;
      else if (slippery) a = wishLen > 0.1 ? T.iceAccel : T.iceDecel;
      else a = wishLen > 0.1 ? T.accel : T.decel;
      const dx = tx - this.vel.x, dz = tz - this.vel.z;
      const dl = Math.hypot(dx, dz), step = a * dt;
      if (dl <= step) { this.vel.x = tx; this.vel.z = tz; } else { this.vel.x += dx / dl * step; this.vel.z += dz / dl * step; }
      if (wishLen > 0.15) {
        const target = Math.atan2(wish.x, wish.z);
        let d = target - this.facing; d = Math.atan2(Math.sin(d), Math.cos(d));
        this.facing += d * Math.min(1, dt * (this.grounded ? 16 : 9));
      }
    }
    if (this.autoRun) {
      // forward speed forced along the level direction
      const f = rig ? rig.forward : { x: 0, z: -1 };
      const along = this.vel.x * f.x + this.vel.z * f.z;
      const add = (this.autoRun - along) * Math.min(1, dt * 4);
      this.vel.x += f.x * add; this.vel.z += f.z * add;
      const r = rig ? rig.right : { x: 1, z: 0 };
      this.facing = Math.atan2(f.x + r.x * input.move.x * 0.35, f.z + r.z * input.move.x * 0.35);
    }

    // ---- jump
    if (this.bufferT > 0 && !this.slamming) {
      if (this.coyoteT > 0) {
        const fromSlide = this.sliding;
        if (fromSlide) {
          const sp = Math.max(T.slideJumpSpeed, this.speedXZ);
          this.vel.x = Math.sin(this.facing) * sp; this.vel.z = Math.cos(this.facing) * sp;
          this.endSlide(level, true);
        }
        this.vel.y = T.jumpVel;
        this.grounded = false; this.coyoteT = 0; this.bufferT = 0; this.jumpHeld = true; this.usedDouble = false;
        this.slideJump = fromSlide;
        ctx.sfx('jump');
      } else if (game.hasPower('doubleJump') && !this.usedDouble && this.airT > 0.06 && input.pressed('jump')) {
        this.vel.y = T.doubleJumpVel;
        this.usedDouble = true; this.bufferT = 0; this.jumpHeld = true;
        ctx.sfx('double_jump');
        ctx.fx?.ring?.(this.pos, 0xb5f3d0);
      }
    }
    if (!input.held('jump')) this.jumpHeld = false;

    // ---- gravity
    if (this.slamming) {
      this.slamHopT -= dt;
      if (this.slamHopT <= 0) this.vel.y = T.slamVy;
      this.vel.x = 0; this.vel.z = 0;
    } else if (!this.grounded) {
      let g = T.gravity;
      if (this.vel.y > 0 && !this.jumpHeld) g *= T.jumpCut;
      this.vel.y = Math.max(-T.maxFall, this.vel.y - g * dt);
    }

    this.integrate(dt, ctx);
    this.animate(dt, ctx);
  }

  endSlide(level, keepSpeed = false) {
    this.slideT = 0; this.sliding = false;
    // stand up only if there is room
    this.half.y = STAND_H;
    if (!keepSpeed) { this.vel.x *= 0.5; this.vel.z *= 0.5; }
  }

  integrate(dt, ctx) {
    const { level, game } = ctx;
    // carried by moving platform
    const owner = this.groundSolid?.__owner;
    if (this.grounded && owner?.delta) {
      this.pos.x += owner.delta.x; this.pos.y += owner.delta.y; this.pos.z += owner.delta.z;
    }
    let ex = this.ext.x, ez = this.ext.z;
    const conv = this.grounded ? (this.groundSolid?.conveyor || owner?.conveyor) : null;
    if (conv) { ex += conv[0] ?? conv.x ?? 0; ez += conv[1] ?? conv.z ?? 0; }
    this.ext.set(0, 0, 0); // wind etc. must be re-applied every frame by the hazard

    const wasGrounded = this.grounded;
    const vyBefore = this.vel.y;
    const vy = this.grounded && this.vel.y <= 0 ? -2 : this.vel.y;
    const res = moveBody(level.world, this.pos, this.half, (this.vel.x + ex) * dt, vy * dt, (this.vel.z + ez) * dt,
      level.solids, { stepUp: wasGrounded ? 0.32 : 0 });
    if (this.lockZ !== null) this.pos.z = this.lockZ;

    this.grounded = !!res.ground && this.vel.y <= 0.01;
    this.groundSolid = this.grounded ? res.ground : null;
    this.syncBox();

    if (res.ceiling && this.vel.y > 0) {
      this.vel.y = 0;
      res.ceiling.__owner?.onBump?.(this, ctx);
    }
    if (res.wall && this.sliding) {
      res.wall.__owner?.onSpin?.(this, ctx);
    }
    if (res.wall && this.mount) {
      res.wall.__owner?.onSpin?.(this, ctx);
    }

    if (this.grounded) {
      const landed = !wasGrounded;
      if (landed) {
        this.airT = 0;
        this.usedDouble = false;
        this.slideJump = false;
        if (this.slamming) {
          this.slamming = false;
          const power = game.hasPower('superSlam') ? 2 : 1;
          ctx.sfx('slam');
          ctx.shake(power === 2 ? 0.7 : 0.35);
          ctx.fx?.ring?.(this.pos, 0xffe2ac, power === 2 ? 3 : 1.6);
          level.slam(this, power);
        } else if (vyBefore < -6) { ctx.sfx('land', { vol: Math.min(1, -vyBefore / 25) }); this.landT = 0.12; }
        this.vel.y = 0;
        // landing on an entity (crate top, turtle, spring…)
        if (owner?.onLand) owner.onLand(this, ctx);
        else if (res.ground.__owner?.onLand) res.ground.__owner.onLand(this, ctx);
      }
      if (this.groundSolid && this.groundSolid.damage && !this.dead) game.kill(this.groundSolid.damage);
    } else {
      this.airT += dt;
    }

    if (this.pos.y < (level.data.killY ?? -15) && !this.dead) game.kill('fall');
  }

  animate(dt, ctx) {
    const sp = this.speedXZ;
    let anim;
    if (this.celebrating) anim = 'victory';
    else if (this.slamming) anim = 'slam';
    else if (this.spinning) anim = 'spin';
    else if (this.sliding) anim = 'slide';
    else if (!this.grounded) anim = this.vel.y > 0 ? (this.usedDouble ? 'flip' : 'jump') : 'fall';
    else if (this.landT > 0) anim = 'land';
    else if (sp > 0.6) anim = 'run';
    else anim = 'idle';
    if (this.mount && anim !== 'victory') anim = 'ride';
    this.anim = anim;

    if (this.grounded && sp > 2 && !this.mount) {
      this.stepT -= dt * sp * 0.42;
      if (this.stepT <= 0) { this.stepT = 1; ctx.sfx('footstep', { vol: 0.35 }); }
    }

    this.object3d.position.copy(this.pos);
    let d = this.facing - this.object3d.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.object3d.rotation.y += d * Math.min(1, dt * 20);
    const blink = this.hurtT > 0 && Math.floor(this.hurtT * 14) % 2 === 0;
    this.art.update(dt, {
      anim, speed: sp, vy: this.vel.y, t: ctx.time, invincible: this.invincible,
      grounded: this.grounded, spinT: this.spinT, tornado: this.spinning && this.airT > T.spinTime,
    });
    this.art.object3d.visible = !blink;
    this.mount?.update?.(dt, { speed: sp, turning: input.move.x, jumping: !this.grounded, t: ctx.time });
    this.oku.update?.(dt, { count: ctx.game.masks, target: this.object3d, time: ctx.time, facing: this.facing });

    // blob shadow on the ground below
    const gy = groundBelow(ctx.level.world, this.pos.x, this.pos.z, this.pos.y + 0.05, 30, ctx.level.solids);
    if (gy > -Infinity) {
      this.shadow.visible = true;
      this.shadow.position.set(this.pos.x, gy + 0.02, this.pos.z);
      const h = this.pos.y - gy;
      const s = Math.max(0.35, 1 - h * 0.08);
      this.shadow.scale.setScalar(s);
      this.shadow.material.opacity = 0.42 * s;
    } else this.shadow.visible = false;
  }

  /** AABB used for spin hits (bigger, around Lumen). */
  getSpinBox() {
    const r = 1.05;
    const b = this.spinBox;
    b.min.x = this.pos.x - r; b.max.x = this.pos.x + r;
    b.min.z = this.pos.z - r; b.max.z = this.pos.z + r;
    b.min.y = this.pos.y - 0.1; b.max.y = this.pos.y + 1.2;
    return b;
  }

  dispose() {
    this.art.dispose?.();
    this.oku.dispose?.();
    this.mount?.dispose?.();
  }
}

let _shadowTex = null;
function makeBlobShadow() {
  if (!_shadowTex) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(0,0,0,0.9)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    _shadowTex = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: _shadowTex, transparent: true, depthWrite: false, opacity: 0.4 }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

export const PLAYER_TUNING = T;
