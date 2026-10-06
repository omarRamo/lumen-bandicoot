// Crates ("caisses") — every `type: 'crate'` kind of docs/CONTRACTS.md, with Crash-style juice:
// squash & stretch, plank debris, lights that burst out and fly into Lumen, TNT 3-2-1, jittery nitros,
// stacks that fall when what holds them breaks, outlines that materialize one by one, a running crate on
// chicken legs and a rainbow mystery crate. Rendering: one InstancedMesh per crate look (see crate-fx.js),
// so hundreds of crates cost a handful of draw calls. Rules live in crate-logic.js (unit-tested).
import * as THREE from 'three';
import { registerEntity } from '../../core/registry.js';
import { boxOverlap, groundBelow, moveBody } from '../../core/physics.js';
import { bus } from '../../core/events.js';
import { crateFx, existingFx, trs, WOOD } from './crate-fx.js';
import {
  CRATE_KINDS, crateCounts, breaksOn, BOUNCE, LIGHTS_CRATE_MAX, lightsFor, TNT_FUSE, tntDigit, pickMystery,
  OKU_ADVICE, designedSupport, fleeDir,
} from './crate-logic.js';
import { geo, lambertMat, basicMat, cachedMat, flagTexture, haloTexture } from './crate-art.js';

const DEBRIS = {
  wood: WOOD,
  iron: [0x8f989f, 0xc4ccd1, 0x5c656b],
  tnt: [0xd8452e, 0xffd34a, 0x5a1408, 0xb86a28],
  nitro: [0x2f6b2a, 0x9dff6a, 0x1f4a1c],
  time: [0xffd23f, 0x3a7bd5, 0xf0b81a],
  mystery: [0xff5a5a, 0xffa64a, 0xffe14a, 0x5ad66a, 0x4a9cff, 0x9a6aff],
  switch: [...WOOD, 0x3a7bd5],
  nitroSwitch: [0x5d7a5a, 0x9dff6a, 0x2f6b2a],
  checkpoint: [...WOOD, 0xffd76a],
};
function debrisColors(kind) {
  if (kind === 'iron' || kind === 'ironBounce') return DEBRIS.iron;
  if (kind === 'tnt') return DEBRIS.tnt;
  if (kind === 'nitro') return DEBRIS.nitro;
  if (/^time/.test(kind)) return DEBRIS.time;
  return DEBRIS[kind] || DEBRIS.wood;
}

const LEGS_TRIGGER = 5.5, LEGS_FORGET = 16, LEGS_SPEED = 5.3, LEGS_LIFT = 0.55;
const _v = new THREE.Vector3();
const _dir = { x: 0, z: 0 };
const _probe = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
const LEGS_HALF = { x: 0.45, y: 0.5 + LEGS_LIFT / 2, z: 0.45 };

let okuAdviceI = 0;

registerEntity('crate', (def, ctx) => {
  if (def.kind === '__fx') return existingFx(ctx)?.entity ?? null;
  const fx = crateFx(ctx);
  if (!fx) return null;
  if (!CRATE_KINDS.includes(def.kind)) console.warn(`[crates] unknown crate kind "${def.kind}", using basic`);
  return new Crate(def, ctx, fx);
});

class Crate {
  constructor(def, ctx, fx) {
    this.ctx = ctx;
    this.fx = fx;
    this.d = def;
    this.isCrate = true;
    this.kind = CRATE_KINDS.includes(def.kind) ? def.kind : 'basic';
    this.x = def.x; this.y = def.y; this.z = def.z;
    this.cpX = def.x; this.cpY = def.y; this.cpZ = def.z;
    this.solid = true;
    this.counts = crateCounts(this.kind);
    this.box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
    this.delta = { x: 0, y: 0, z: 0 };
    this.object3d = new THREE.Group();
    this.object3d.name = `crate-${this.kind}`;
    this.broken = false;
    this.dead = false;
    this.recreated = (ctx.level.time || 0) > 0;
    // animation state
    this.sq = 0; this.sqv = 0; this.hop = 0; this.hopv = 0; this.wob = 0; this.flash = 0; this.flashCol = 0;
    this.pop = 1; this.popv = 0; this.lift = 0; this.rotY = 0; this.animating = false;
    // physics
    this.falling = false; this.vy = 0; this.checkSupport = this.recreated; this.designed = undefined;
    // kind state
    this.given = 0; this.fuseT = 0; this.digit = 0; this.chainT = -1; this.chainSoft = false; this.remoteT = -1;
    this.clangT = 0;
    if (this.kind === 'outline') {
      this.active = this.switchCommitted();
      this.intangible = !this.active;
    }
    if (this.kind === 'nitro') { this.nitroT = 0.3 + Math.random() * 1.2; this.rotY = (Math.random() - 0.5) * 0.1; }
    if (this.kind === 'legs') { this.state = 'idle'; this.pos = new THREE.Vector3(this.x, this.y, this.z); this.runT = 0; this.vyL = 0; this.legT = 0; this.buildLegs(); }
    this.look = this.baseLook();
    this.handle = fx.crateBatch(this.look).alloc();
    fx.register(this);
    this.syncBox();
    this.draw();
  }

  get beh() { return this.kind === 'outline' ? (this.active ? 'basic' : 'ghost') : this.kind; }

  baseLook() {
    if (this.kind === 'outline') return this.active ? 'basic' : 'outline';
    return this.kind;
  }

  setLook(look) {
    if (look === this.look || this.broken) return;
    this.fx.crateBatch(this.look).free(this.handle);
    this.look = look;
    this.handle = this.fx.crateBatch(look).alloc();
    this.draw();
  }

  switchCommitted() {
    const g = this.d.group;
    if (g == null) return false;
    const lvl = this.ctx.level;
    return (lvl.data.entities || []).some((d) => d.type === 'crate' && d.kind === 'switch' && d.group === g && lvl.isCommitted(d.id));
  }

  syncBox() {
    const b = this.box;
    b.min.x = this.x - 0.5; b.max.x = this.x + 0.5;
    b.min.z = this.z - 0.5; b.max.z = this.z + 0.5;
    b.min.y = this.y; b.max.y = this.y + 1 + this.lift;
    this.object3d.position.set(this.x, this.y, this.z);
  }

  draw() {
    if (this.broken || !this.handle) return;
    const t = this.ctx.time || 0;
    const sy = (1 - this.sq) * this.pop, sxz = (1 + this.sq * 0.5) * this.pop;
    const cy = this.y + this.lift + this.hop + 0.5 * sy;
    const w = this.wob * 0.16;
    const b = this.fx.crateBatch(this.look);
    b.matrix(this.handle, trs(this.x, cy, this.z, Math.sin(t * 31) * w, this.rotY, Math.cos(t * 27) * w, sxz, sy, sxz));
    const f = this.flash;
    if (this.flashCol === 1) b.color(this.handle, 1 + f * 1.6, 1 + f * 0.3, 1 + f * 0.2);
    else b.color(this.handle, 1 + f * 1.2, 1 + f * 1.2, 1 + f * 1.2);
  }

  // ------------------------------------------------------------------ feedback helpers
  squash(a = 0.3) { this.sqv += a * 14; this.animating = true; }
  bumpUp(v = 3) { this.hopv = Math.max(this.hopv, v); this.animating = true; }
  shine(a = 1, col = 0) { this.flash = Math.max(this.flash, a); this.flashCol = col; this.animating = true; }
  wobble(a = 1) { this.wob = Math.max(this.wob, a); this.animating = true; }
  center(out = _v) { return out.set(this.x, this.y + this.lift + 0.5, this.z); }
  sfx(name, opts = {}) { this.ctx.sfx(name, { pos: new THREE.Vector3(this.x, this.y + 0.5, this.z), ...opts }); }

  // ------------------------------------------------------------------ entity hooks
  onLand(p) { this.hit('land', p); }
  onBump(p) { this.hit('bump', p); }
  onSpin(p) { this.hit('spin', p); }
  onSlam(p, ctx, power) { this.hit(power >= 2 ? 'slam2' : 'slam', p); }
  onExplode(ctx, source) { this.hit('explode', null, source); }

  hit(how, p, source = null) {
    if (this.broken || this.dead) return;
    const beh = this.beh;
    if (beh === 'ghost') return;
    switch (beh) {
      case 'nitro':
        if (how === 'explode') return this.chain(0.09, !!source?.softBoom);
        return this.detonate();
      case 'tnt':
        if (how === 'land' || how === 'bump') {
          if (how === 'land') p.bounce(BOUNCE.crate); else this.bumpDown(p);
          this.squash(0.25); this.wobble(0.6);
          this.lightFuse();
          return;
        }
        if (how === 'explode') return this.chain(0.13, !!source?.softBoom);
        return this.detonate();
      case 'iron':
      case 'ironBounce':
        if (breaksOn(beh, how)) return this.smash(how, p, source);
        if (how === 'land') {
          if (beh === 'ironBounce') return this.spring(p);
          this.squash(0.06);
          return;
        }
        if (how === 'spin' || how === 'bump' || how === 'slam') this.clang();
        if (how === 'bump') { this.bumpDown(p); this.bumpUp(1.5); }
        return;
      case 'bounce':
        if (how === 'land') return this.spring(p);
        if (how === 'bump') this.bumpDown(p);
        return this.smash(how, p, source);
      case 'lights':
        if (how === 'land' || how === 'bump') {
          if (how === 'land') { p.bounce(BOUNCE.crate); this.squash(0.32); } else { this.bumpDown(p); this.bumpUp(3.2); }
          this.given++;
          this.fx.flyLights(this.x, this.y + (how === 'land' ? 1.1 : 1.0), this.z, 1, { spread: 0.5, up: 5 });
          this.sfx('crate_bounce', { pitch: 1 + this.given * 0.04 });
          this.shine(0.6);
          if (this.given >= LIGHTS_CRATE_MAX) this.smash(how, p, source);
          return;
        }
        return this.smash(how, p, source);
      default:
        if (how === 'land') p.bounce(BOUNCE.crate);
        else if (how === 'bump') this.bumpDown(p);
        return this.smash(how, p, source);
    }
  }

  bumpDown(p) { if (p) p.vel.y = Math.min(p.vel.y, BOUNCE.bumpDown); }

  spring(p) {
    p.bounce(BOUNCE.spring);
    this.squash(0.5);
    this.shine(0.4);
    this.sfx('spring');
    this.sfx('crate_bounce', { vol: 0.6 });
    this.ctx.fx?.ring?.({ x: this.x, y: this.y + 1, z: this.z }, 0xffe2ac, 1.1);
  }

  clang() {
    if (this.clangT > 0) return;
    this.clangT = 0.2;
    this.sfx('crate_iron');
    this.wobble(0.5);
    this.shine(0.5);
    this.ctx.fx?.burst?.({ x: this.x, y: this.y + 0.3, z: this.z }, [0xfff1a0, 0xffffff], 6, { speed: 5, life: 0.35 });
  }

  lightFuse() {
    if (this.fuseT > 0) return;
    this.fuseT = TNT_FUSE;
    this.digit = 3;
    this.setLook('tnt3');
    this.sfx('tnt_tick');
    this.shine(1, 1);
    this.showFuse(true);
  }

  chain(delay, soft) {
    if (this.chainT < 0 || this.chainT > delay) this.chainT = delay;
    this.chainSoft = this.chainSoft || soft;
    this.animating = true;
  }

  // ------------------------------------------------------------------ breaking
  /** Break the crate: debris, rewards, counter, combo, then remove (or leave the checkpoint lantern). */
  smash(how, p, source = null) {
    if (this.broken) return;
    const ctx = this.ctx, fx = this.fx, beh = this.beh;
    const cx = this.x, cy = this.y + this.lift + 0.5, cz = this.z;
    // direction of the debris: forward for spins/slides, away from the blast for explosions
    let dx = 0, dz = 0, push = 0;
    if (p && (how === 'spin')) {
      dx = cx - p.pos.x; dz = cz - p.pos.z;
      if (Math.abs(dx) + Math.abs(dz) < 0.05) { dx = Math.sin(p.facing); dz = Math.cos(p.facing); }
      push = p.sliding ? 9 : 7;
    } else if (how === 'explode' && source?.box) {
      dx = cx - (source.box.min.x + source.box.max.x) / 2; dz = cz - (source.box.min.z + source.box.max.z) / 2; push = 6;
    }
    const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
    const gy = groundBelow(ctx.level.world, cx, cz, this.y + 0.01, 30, ctx.level.solids);
    fx.debrisBurst(cx, this.y + this.lift, cz, debrisColors(this.kind), dx, dz, push, 9, gy > -Infinity ? gy : this.y - 20);
    ctx.fx?.burst?.({ x: cx, y: this.y, z: cz }, [0xf3d3a0, 0xd9a868, 0xffffff], 8, { speed: 3, life: 0.45, size: 0.8 });
    this.sfx(this.kind === 'iron' || this.kind === 'ironBounce' ? 'crate_iron' : 'crate_break', { pitch: 0.92 + Math.random() * 0.2 });
    if (how === 'spin' || how === 'land' || how === 'bump') ctx.shake(0.06);

    this.broken = true;
    fx.flagAbove(this);

    // rewards
    const lights = beh === 'lights' ? (how === 'land' || how === 'bump' ? 0 : Math.max(1, LIGHTS_CRATE_MAX - this.given)) : lightsFor(beh);
    if (lights) fx.flyLights(cx, cy, cz, lights, { spread: push ? 1.4 : 1 });
    if (lights >= 5) this.sfx('light_many', { vol: 0.5 });
    if (beh === 'lights' && this.given >= LIGHTS_CRATE_MAX) fx.text(cx, cy, cz, `x${LIGHTS_CRATE_MAX} !`, '#fff1a0');
    switch (beh) {
      case 'life':
        ctx.game.addLife(1);
        fx.popup('life', cx, cy, cz, 1.2);
        fx.text(cx, cy + 0.6, cz, ctx.lang === 'en' ? '+1 LIFE' : '+1 VIE', '#7ad7c4');
        break;
      case 'mask':
        ctx.game.addMask();
        fx.popup('mask', cx, cy, cz, 1.2);
        if (okuAdviceI === 0 || Math.random() < 0.45) bus.emit('dialog', { speaker: 'oku', text: OKU_ADVICE[okuAdviceI++ % OKU_ADVICE.length] });
        break;
      case 'time1': case 'time2': case 'time3': {
        const n = +beh.slice(4);
        ctx.game.freezeTimer?.(n);
        fx.popup('clock', cx, cy, cz, 0.9);
        fx.text(cx, cy + 0.5, cz, ctx.lang === 'en' ? `FREEZE ${n}s` : `GEL ${n} s`, '#9fd8ff');
        break;
      }
      case 'switch': this.activateOutlines(); break;
      case 'nitroSwitch': this.detonateAllNitros(); break;
      case 'mystery': this.mystery(cx, cy, cz); break;
      case 'legs': this.releaseLegs(dx || 0, dz || -1); break;
      default: break;
    }

    if (this.counts) ctx.level.crateBroken(this);
    if (beh === 'checkpoint') ctx.level.setCheckpoint({ x: this.x, y: this.y, z: this.z });
    fx.comboHit(cx, cy, cz);

    this.removeVisual();
    if (beh === 'checkpoint') { this.makeLantern(gy); return; }
    this.dead = true;
  }

  /** TNT / Nitro explosion. soft = remote (nitro switch): never hurts Lumen. */
  detonate(soft = false) {
    if (this.broken) return;
    const ctx = this.ctx, fx = this.fx;
    const c = new THREE.Vector3(this.x, this.y + this.lift + 0.5, this.z);
    const nitro = this.kind === 'nitro';
    this.broken = true;
    fx.flagAbove(this);
    fx.boom(c.x, c.y, c.z, nitro ? 0x7dff4a : 0xffa040, nitro ? 2.4 : 2.7);
    fx.debrisBurst(c.x, this.y, c.z, debrisColors(this.kind), 0, 0, 0, 12, this.y);
    if (this.counts) ctx.level.crateBroken(this);
    fx.comboHit(c.x, c.y, c.z);
    this.removeVisual();
    this.showFuse(false);
    this.dead = true;
    this.softBoom = soft;
    if (soft) fx.softExplode(c, 2.2, this);
    else ctx.level.explode(c, 2.2, this);
  }

  removeVisual() {
    if (this.handle) { this.fx.crateBatch(this.look).free(this.handle); this.handle = null; }
    this.solid = false;
    this.delta.x = this.delta.y = this.delta.z = 0;
  }

  activateOutlines() {
    this.sfx('switch');
    const g = this.d.group;
    if (g == null) return;
    const list = this.ctx.level.findByGroup(g).filter((e) => e.isCrate && e.kind === 'outline' && !e.active && !e.broken);
    list.sort((a, b) => Math.hypot(a.x - this.x, a.z - this.z, a.y - this.y) - Math.hypot(b.x - this.x, b.z - this.z, b.y - this.y));
    list.forEach((e, i) => { e.activateT = 0.18 + i * 0.09; e.activateI = i; e.animating = true; });
  }

  detonateAllNitros() {
    this.sfx('switch');
    const g = this.d.group;
    const list = this.ctx.level.entities.filter((e) => e.isCrate && e.kind === 'nitro' && !e.broken && (g == null || e.d.group == null || e.d.group === g));
    list.sort((a, b) => Math.hypot(a.x - this.x, a.z - this.z) - Math.hypot(b.x - this.x, b.z - this.z));
    list.forEach((e, i) => { e.remoteT = 0.35 + i * 0.13; e.animating = true; });
    this.fx.text(this.x, this.y + 1, this.z, this.ctx.lang === 'en' ? 'NITRO PARTY!' : 'FÊTE DES NITROS !', '#b6ff7a');
  }

  mystery(cx, cy, cz) {
    const fx = this.fx, ctx = this.ctx, en = ctx.lang === 'en';
    const out = pickMystery(Math.random());
    if (out === 'lights') { fx.flyLights(cx, cy, cz, 10, { spread: 1.5, up: 8 }); fx.text(cx, cy + 0.5, cz, 'JACKPOT ?', '#ffd76a'); this.sfx('light_many'); }
    else if (out === 'mask') { ctx.game.addMask(); fx.popup('mask', cx, cy, cz, 1.2); }
    else if (out === 'life') { ctx.game.addLife(1); fx.popup('life', cx, cy, cz, 1.2); fx.text(cx, cy + 0.6, cz, en ? '+1 LIFE' : '+1 VIE', '#7ad7c4'); }
    else if (out === 'chicken') fx.chicken(cx, this.y + 0.2, cz);
    else fx.disco(cx, this.y, cz);
    this.lastMystery = out;
  }

  // ------------------------------------------------------------------ update
  update(dt) {
    const ctx = this.ctx;
    if (this.broken) { if (this.lantern) this.updateLantern(dt); return; }
    if (this.clangT > 0) this.clangT -= dt;
    const k = this.kind;

    if (this.chainT >= 0) {
      this.chainT -= dt;
      this.wob = 1;
      if (this.chainT < 0) { this.detonate(this.chainSoft); return; }
    }
    if (this.remoteT >= 0) {
      this.remoteT -= dt;
      this.wob = 1; this.shine(0.6);
      if (this.remoteT < 0) { this.detonate(true); return; }
    }
    if (k === 'tnt' && this.fuseT > 0) {
      this.fuseT -= dt;
      const d = tntDigit(this.fuseT);
      if (d !== this.digit && this.fuseT > 0) {
        this.digit = d;
        this.setLook(`tnt${d}`);
        this.sfx('tnt_tick', { pitch: 1 + (3 - d) * 0.18 });
        this.shine(1, 1); this.squash(-0.2);
      }
      this.updateFuse(dt);
      this.animating = true;
      if (this.fuseT <= 0) { this.detonate(); return; }
    }
    if (k === 'nitro') this.updateNitro(dt);
    if (k === 'legs') this.updateLegs(dt);
    if (k === 'outline' && this.activateT >= 0) this.updateActivation(dt);
    if (this.broken) return;

    // stacks: fall when what's below disappears
    if (this.checkSupport && k !== 'legs') this.runSupportCheck();
    if (this.falling) this.fall(dt);
    else if (this.delta.y !== 0 && k !== 'legs') this.delta.y = 0;
    if (this.broken) return;

    if (this.animating) this.animate(dt);
  }

  animate(dt) {
    let busy = false;
    // squash spring
    if (this.sq !== 0 || this.sqv !== 0) {
      this.sqv += -this.sq * 420 * dt;
      this.sqv *= Math.exp(-dt * 14);
      this.sq += this.sqv * dt;
      if (Math.abs(this.sq) < 0.002 && Math.abs(this.sqv) < 0.02) { this.sq = 0; this.sqv = 0; } else busy = true;
    }
    if (this.hop > 0 || this.hopv !== 0) {
      this.hopv -= 30 * dt;
      this.hop += this.hopv * dt;
      if (this.hop <= 0) { this.hop = 0; this.hopv = 0; } else busy = true;
    }
    if (this.wob > 0) { this.wob = Math.max(0, this.wob - dt * 2.5); busy = true; }
    if (this.flash > 0) { this.flash = Math.max(0, this.flash - dt * 4); busy = true; }
    if (this.pop !== 1 || this.popv !== 0) {
      this.popv += (1 - this.pop) * 380 * dt;
      this.popv *= Math.exp(-dt * 13);
      this.pop += this.popv * dt;
      if (Math.abs(1 - this.pop) < 0.002 && Math.abs(this.popv) < 0.02) { this.pop = 1; this.popv = 0; } else busy = true;
    }
    if (this.falling || this.fuseT > 0 || this.chainT >= 0 || this.remoteT >= 0 || this.kind === 'nitro' || (this.kind === 'legs' && this.state !== 'idle')) busy = true;
    this.draw();
    this.animating = busy;
  }

  // ------------------------------------------------------------------ stacks
  runSupportCheck() {
    this.checkSupport = false;
    if (this.designed === undefined) {
      const lvl = this.ctx.level;
      const gTop = groundBelow(lvl.world, this.d.x, this.d.z, this.d.y + 0.02, 60, null);
      this.designed = designedSupport(this.d, this.fx.defsAt(this.d.y - 1), gTop) || this.y !== this.d.y;
    }
    if (!this.designed) return;
    const top = this.fx.supportTop(this);
    if (top < this.y - 0.03 || this.fx.supOwner?.falling) {
      this.falling = true;
      this.vy = 0;
      this.animating = true;
      this.fx.flagAbove(this);
    }
  }

  fall(dt) {
    const fx = this.fx, lvl = this.ctx.level;
    this.vy = Math.max(-25, this.vy - 30 * dt);
    let ny = this.y + this.vy * dt;
    const top = fx.supportTop(this);
    const owner = fx.supOwner;
    let landed = false;
    if (ny <= top) {
      ny = top;
      if (owner?.falling) this.vy = owner.vy;
      else landed = true;
    }
    this.delta.y = ny - this.y;
    this.y = ny;
    this.syncBox();
    if (landed) {
      const impact = -this.vy;
      this.falling = false; this.vy = 0; this.designed = true;
      this.squash(Math.min(0.35, impact * 0.03));
      if (impact > 2) {
        this.sfx('land', { vol: Math.min(0.7, impact / 20) });
        this.ctx.fx?.burst?.({ x: this.x, y: this.y - 0.4, z: this.z }, [0xe8d8b8, 0xc9b28a], 5, { speed: 2, life: 0.4, size: 0.7 });
      }
    }
    // a crate falling on Lumen's head: BONK (it breaks)
    const p = this.ctx.player;
    if (!p.dead && boxOverlap(p.box, this.box) && this.box.min.y > p.pos.y + 0.3) {
      this.fx.text(this.x, this.y + 0.3, this.z, 'BONK !', '#ffd76a');
      this.hit('bump', null);
      return;
    }
    if (this.y < (lvl.data.killY ?? -15)) {
      // lost in a pit: count it anyway so 100% stays possible
      this.broken = true;
      if (this.counts) lvl.crateBroken(this);
      this.removeVisual();
      this.dead = true;
    }
  }

  // ------------------------------------------------------------------ nitro
  updateNitro(dt) {
    const ctx = this.ctx, p = ctx.player;
    this.animating = true;
    this.nitroT -= dt;
    if (this.nitroT <= 0 && this.hop <= 0) {
      this.nitroT = 0.45 + Math.random() * 1.3;
      this.hopv = 1.8 + Math.random() * 1.6;
      this.rotY = (Math.random() - 0.5) * 0.16;
      this.wob = 0.5;
      const dx = p.pos.x - this.x, dz = p.pos.z - this.z, d2 = dx * dx + dz * dz;
      if (d2 < 196) {
        this.sfx('nitro_bounce', { vol: 0.25 + 0.5 * (1 - Math.sqrt(d2) / 14), pitch: 0.9 + Math.random() * 0.3 });
        if (ctx.quality?.level !== 0) ctx.fx?.burst?.({ x: this.x, y: this.y + 0.3, z: this.z }, [0x9dff6a, 0xeaffd0], 3, { speed: 3, life: 0.3, size: 0.6 });
      }
    }
    // any contact → boom (solids never overlap, so test a slightly inflated box)
    if (!p.dead) {
      const b = this.box, pb = p.box, m = 0.07;
      if (pb.min.x < b.max.x + m && pb.max.x > b.min.x - m && pb.min.y < b.max.y + m && pb.max.y > b.min.y - m &&
        pb.min.z < b.max.z + m && pb.max.z > b.min.z - m) this.detonate();
    }
  }

  // ------------------------------------------------------------------ outline
  updateActivation(dt) {
    this.activateT -= dt;
    if (this.activateT > 0) return;
    // never materialize inside Lumen
    const pb = this.ctx.player.box;
    if (boxOverlap(pb, this.box)) { this.activateT = 0.05; return; }
    this.activateT = -1;
    this.active = true;
    this.intangible = false;
    this.setLook('basic');
    this.pop = 0.15; this.popv = 0;
    this.shine(1);
    this.animating = true;
    this.sfx('outline_on', { pitch: 1 + Math.min(12, this.activateI || 0) * 0.06 });
    this.ctx.fx?.ring?.({ x: this.x, y: this.y, z: this.z }, 0xbfefff, 0.9);
  }

  // ------------------------------------------------------------------ legs
  buildLegs() {
    const orange = lambertMat(0xf2a33a), toe = lambertMat(0xe08a22);
    const legs = new THREE.Group();
    legs.userData.legs = [];
    for (const sx of [-1, 1]) {
      const hip = new THREE.Group();
      hip.position.set(sx * 0.22, LEGS_LIFT, 0);
      const thigh = new THREE.Mesh(geo('legs-thigh', () => new THREE.CylinderGeometry(0.06, 0.045, LEGS_LIFT, 6).translate(0, -LEGS_LIFT / 2, 0)), orange);
      hip.add(thigh);
      const foot = new THREE.Group();
      foot.position.y = -LEGS_LIFT;
      for (const a of [-0.55, 0, 0.55]) {
        const t = new THREE.Mesh(geo('legs-toe', () => new THREE.BoxGeometry(0.05, 0.04, 0.24).translate(0, 0.02, 0.1)), toe);
        t.rotation.y = a; foot.add(t);
      }
      const back = new THREE.Mesh(geo('legs-toe'), toe);
      back.rotation.y = Math.PI; back.scale.set(1, 1, 0.5); foot.add(back);
      hip.add(foot);
      legs.add(hip);
      legs.userData.legs.push(hip);
    }
    legs.scale.y = 0.001;
    this.legs = legs;
    this.object3d.add(legs);
  }

  updateLegs(dt) {
    const ctx = this.ctx, p = ctx.player, lvl = ctx.level;
    const dxp = this.x - p.pos.x, dzp = this.z - p.pos.z;
    const dist = Math.hypot(dxp, dzp);
    this.legT += dt;
    const near = !p.dead && dist < LEGS_TRIGGER && Math.abs(p.pos.y - this.y) < 3;
    if (this.state === 'idle') {
      if (!near) {
        this.delta.x = this.delta.y = this.delta.z = 0;
        if (this.lift < 0.005) { if (this.lift) { this.lift = 0; this.legs.scale.y = 0.001; this.syncBox(); } return; }
      } else {
      this.state = 'run'; this.runT = 0; this.cluckT = 0;
      this.fx.flagAbove(this);
      this.hopv = 4; this.animating = true;
      this.fx.text(this.x, this.y + 1.2, this.z, ctx.lang === 'en' ? 'AAAAAH!' : 'AAAAAH !', '#ff7aa8');
      this.sfx('honk', { pitch: 1.4 });
      }
    }
    this.animating = true;
    // stand up / sit down
    const wantLift = this.state === 'idle' ? 0 : LEGS_LIFT;
    this.lift += (wantLift - this.lift) * Math.min(1, dt * 12);
    this.legs.scale.y = Math.max(0.001, this.lift / LEGS_LIFT);

    let speed = 0;
    if (this.state === 'run') {
      this.runT += dt;
      if (dist > LEGS_FORGET || p.dead) { this.state = 'calm'; this.calmT = 1.2; }
      else if (this.runT > 7) {
        this.state = 'tired'; this.tiredT = 2.2;
        this.fx.text(this.x, this.y + 1.4, this.z, ctx.lang === 'en' ? 'pant… pant…' : 'pff… pff…', '#fff7dc', { px: 40 });
      } else {
        fleeDir(this.x, this.z, p.pos.x, p.pos.z, this.legT, _dir);
        if (!this.safeAhead(_dir.x, _dir.z)) {
          // try other headings, prefer those still away from Lumen
          let found = false;
          const bx = _dir.x, bz = _dir.z;
          for (const a of [0.8, -0.8, 1.6, -1.6, 2.4, -2.4]) {
            const c = Math.cos(a), s = Math.sin(a);
            const tx = bx * c - bz * s, tz = bx * s + bz * c;
            if (this.safeAhead(tx, tz)) { _dir.x = tx; _dir.z = tz; found = true; break; }
          }
          if (!found) { _dir.x = 0; _dir.z = 0; this.wob = 1; }
        }
        speed = _dir.x || _dir.z ? LEGS_SPEED : 0;
        this.cluckT -= dt;
        if (this.cluckT <= 0) { this.cluckT = 0.45 + Math.random() * 0.3; this.sfx('quack', { pitch: 1.3 + Math.random() * 0.5, vol: 0.6 }); }
      }
    } else if (this.state === 'tired') {
      this.tiredT -= dt;
      this.sq = 0.06 * Math.sin(this.legT * 10);
      if (this.tiredT <= 0) { this.state = near ? 'run' : 'calm'; this.runT = 0; this.calmT = 1; }
    } else if (this.state === 'calm') {
      this.calmT -= dt;
      if (near) { this.state = 'run'; this.runT = 0; }
      else if (this.calmT <= 0) this.state = 'idle';
    }

    // move with collisions (ignoring itself)
    const vx = _dir.x * speed, vz = _dir.z * speed;
    this.vyL = Math.max(-25, this.vyL - 30 * dt);
    const ox = this.x, oy = this.y, oz = this.z;
    this.pos.set(this.x, this.y, this.z);
    this.intangible = true;
    const res = moveBody(lvl.world, this.pos, LEGS_HALF, speed ? vx * dt : 0, this.vyL * dt, speed ? vz * dt : 0, lvl.solids, { stepUp: 0.3 });
    this.intangible = false;
    if (res.ground) this.vyL = 0;
    // don't run into Lumen
    this.x = this.pos.x; this.y = this.pos.y; this.z = this.pos.z;
    this.delta.x = this.x - ox; this.delta.y = this.y - oy; this.delta.z = this.z - oz;
    if (speed) {
      const want = Math.atan2(_dir.x, _dir.z);
      let d = want - this.rotY; d = Math.atan2(Math.sin(d), Math.cos(d));
      this.rotY += d * Math.min(1, dt * 10);
    }
    this.syncBox();
    this.object3d.rotation.y = this.rotY;
    // leg cycle
    const run = speed > 0 ? 1 : 0;
    this.legs.userData.legs.forEach((l, i) => { l.rotation.x = run * Math.sin(this.legT * 22 + i * Math.PI) * 0.9; });
    if (speed) this.hop = Math.abs(Math.sin(this.legT * 22)) * 0.08;
    if (this.y < (lvl.data.killY ?? -15)) {
      this.broken = true;
      if (this.counts) lvl.crateBroken(this);
      this.removeVisual();
      this.dead = true;
    }
  }

  safeAhead(dx, dz) {
    const lvl = this.ctx.level;
    const px = this.x + dx * 0.9, pz = this.z + dz * 0.9;
    const gy = groundBelow(lvl.world, px, pz, this.y + 0.35, 4, null);
    return gy > this.y - 1.05;
  }

  releaseLegs(dx, dz) {
    if (!this.legs) return;
    const g = this.legs;
    this.object3d.remove(g);
    g.scale.y = Math.max(0.6, g.scale.y);
    this.legs = null;
    this.fx.runner(g, this.x, this.y, this.z, dx, dz);
    this.fx.text(this.x, this.y + 1, this.z, this.ctx.lang === 'en' ? 'bye!' : 'salut !', '#fff7dc', { px: 40 });
  }

  // ------------------------------------------------------------------ TNT fuse
  showFuse(on) {
    if (!on) { if (this.fuse) this.fuse.visible = false; return; }
    if (!this.fuse) {
      const f = new THREE.Group();
      const rope = new THREE.Mesh(geo('fuse-rope', () => new THREE.CylinderGeometry(0.03, 0.03, 0.34, 5).translate(0, 0.17, 0)), lambertMat(0x3a2a1a));
      rope.rotation.z = 0.35;
      f.add(rope);
      const spark = new THREE.Sprite(cachedMat('fuse-spark', () => new THREE.SpriteMaterial({ map: haloTexture('spark', 'rgba(255,255,220,1)', 'rgba(255,150,40,0.7)'), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
      spark.position.set(-0.11, 0.32, 0);
      spark.scale.setScalar(0.5);
      f.add(spark);
      f.position.set(0.15, 1, 0.1);
      this.spark = spark;
      this.fuse = f;
      this.object3d.add(f);
    }
    this.fuse.visible = true;
    this.fuseSparkT = 0;
  }

  updateFuse(dt) {
    if (!this.fuse) return;
    this.fuse.position.y = 1 + this.hop - this.sq * 0.5;
    const s = 0.35 + Math.random() * 0.4;
    this.spark.scale.setScalar(s);
    this.fuse.scale.y = Math.max(0.2, this.fuseT / TNT_FUSE);
    this.fuseSparkT -= dt;
    if (this.fuseSparkT <= 0) {
      this.fuseSparkT = this.ctx.quality?.level === 0 ? 0.12 : 0.06;
      const w = this.object3d.position;
      this.ctx.fx?.burst?.({ x: w.x + 0.05, y: w.y + 0.8 + this.fuse.scale.y * 0.3, z: w.z + 0.1 }, [0xffd34a, 0xff8a3a, 0xffffff], 2, { speed: 2.5, life: 0.25, size: 0.5, up: 1 });
    }
  }

  // ------------------------------------------------------------------ checkpoint lantern
  makeLantern(gy) {
    this.dead = false;
    const g = new THREE.Group();
    const base = Number.isFinite(gy) ? gy - this.y : 0;
    g.position.y = base;
    const wood = lambertMat(0x8a5428);
    const post = new THREE.Mesh(geo('cp-post', () => new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6).translate(0, 0.8, 0)), wood);
    g.add(post);
    const arm = new THREE.Mesh(geo('cp-arm', () => new THREE.BoxGeometry(0.42, 0.05, 0.05).translate(0.19, 0, 0)), wood);
    arm.position.y = 1.55; g.add(arm);
    const lamp = new THREE.Mesh(geo('cp-lamp', () => new THREE.CylinderGeometry(0.13, 0.11, 0.26, 8)), lambertMat(0xffd76a, { emissive: 0xffb43a, ei: 1.1 }));
    lamp.position.set(0.38, 1.36, 0); g.add(lamp);
    const cap = new THREE.Mesh(geo('cp-cap', () => new THREE.ConeGeometry(0.17, 0.12, 8)), lambertMat(0x5a3414));
    cap.position.set(0.38, 1.54, 0); g.add(cap);
    const glow = new THREE.Sprite(cachedMat('cp-glow', () => new THREE.SpriteMaterial({ map: haloTexture(), blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
    glow.position.set(0.38, 1.36, 0); glow.scale.setScalar(1.2); g.add(glow);
    const flag = new THREE.Mesh(geo('cp-flag', () => new THREE.PlaneGeometry(0.62, 0.46).translate(0.31, 0, 0)),
      cachedMat('cp-flag', () => new THREE.MeshLambertMaterial({ map: flagTexture(), side: THREE.DoubleSide })));
    flag.position.set(0.04, 1.05, 0); g.add(flag);
    g.scale.setScalar(0.01);
    this.object3d.add(g);
    this.lantern = { g, glow, flag, t: 0 };
    this.ctx.fx?.ring?.({ x: this.x, y: this.y + base, z: this.z }, 0xffd76a, 2.2);
    this.ctx.fx?.burst?.({ x: this.x, y: this.y + base + 0.8, z: this.z }, [0xffd76a, 0xfff1c4, 0xff7f6a], 24, { speed: 5, life: 0.9 });
    this.fx.text(this.x, this.y + base + 1.2, this.z, 'CHECKPOINT !', '#ffd76a', { px: 44 });
  }

  updateLantern(dt) {
    const L = this.lantern;
    L.t += dt;
    const k = Math.min(1, L.t / 0.35);
    const s = k < 1 ? 1.25 * Math.sin(k * Math.PI / 2) : 1 + 0.25 * Math.exp(-(L.t - 0.35) * 6) * Math.cos((L.t - 0.35) * 18);
    L.g.scale.setScalar(Math.max(0.01, s));
    L.flag.rotation.y = Math.sin(L.t * 3.2) * 0.35;
    L.glow.scale.setScalar(1.1 + 0.15 * Math.sin(L.t * 5));
  }

  // ------------------------------------------------------------------ checkpoints / respawn
  snapshot() { if (!this.broken) { this.cpX = this.x; this.cpY = this.y; this.cpZ = this.z; } }

  onRespawn() {
    if (this.broken) return; // only the checkpoint lantern survives broken (it is committed)
    this.x = this.cpX; this.y = this.cpY; this.z = this.cpZ;
    this.falling = false; this.vy = 0;
    this.delta.x = this.delta.y = this.delta.z = 0;
    this.sq = this.sqv = this.hop = this.hopv = this.wob = this.flash = 0; this.pop = 1; this.popv = 0;
    this.chainT = -1; this.chainSoft = false; this.remoteT = -1;
    this.given = 0;
    if (this.kind === 'tnt') { this.fuseT = 0; this.digit = 0; this.showFuse(false); this.setLook('tnt'); }
    if (this.kind === 'legs') {
      this.state = 'idle'; this.lift = 0; this.vyL = 0; this.rotY = 0; this.object3d.rotation.y = 0;
      if (this.legs) this.legs.scale.y = 0.001;
    }
    if (this.kind === 'outline') {
      this.activateT = -1;
      if (this.active && !this.switchCommitted()) { this.active = false; this.intangible = true; this.setLook('outline'); }
    }
    this.syncBox();
    this.animating = false;
    this.draw();
  }

  dispose() {
    this.removeVisual();
    this.fx.unregister(this);
  }
}
