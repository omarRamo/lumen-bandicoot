// Enemies (agent Ennemis) — type 'enemy'. Crash rules:
//   • jump on it (info.fromAbove) → squashed (comic flat pancake), player bounces
//   • spin / slide → kicked TOWARDS THE CAMERA: spins, grows, splats on the lens ("SPLAT !"), slides down, gone
//   • body slam → squashed · explosion → blown away · touching it otherwise → ctx.game.hurt(cause)
// Every attack is telegraphed (a yellow "!" + an anticipation pose) and has a recovery window.
// Common params: patrol: { axis:'x'|'z', range, speed }, yaw (initial facing, rad), phase (patrol phase).
// Per-kind params are documented on each spec (fly, range, interval, period, offset, leash…).
import * as THREE from 'three';
import { registerEntity } from '../../core/registry.js';
import { bus } from '../../core/events.js';
import {
  _a, _b, _c, _d, TAU, clamp, lerp, smooth, easeOut, angDiff, turnTo, group, part, glow, newBox, setBox,
  showAlert, makeProjectiles, kickWord, groundAt, playerCenter, blob, castShadows, bake, meshesOf,
} from './enemy-kit.js';
import { MODELS, makeCloud } from './enemy-models.js';

const RED_GLOW = glow(0xff3a3a);
const DARK_RED = glow(0x661111);

// ------------------------------------------------------------------ helpers used by specs
function setSt(e, st) { e.st = st; e.stT = 0; e.flag = false; }
function patrolStep(e, dt, mul = 1) {
  const p = e.patrol;
  if (!p) return 0;
  e.pph += dt * mul * p.speed / Math.max(0.3, p.range);
  e.pos[p.axis] = e.home[p.axis] + p.range * Math.sin(e.pph);
  return Math.cos(e.pph) >= 0 ? 1 : -1;
}
function yawForAxis(axis, dir) { return axis === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI); }
function walkLegs(legs, t, speed, amp = 0.5) {
  for (let i = 0; i < legs.length; i++) legs[i].rotation.x = Math.sin(t * speed + (legs[i].userData.ph ?? i * Math.PI)) * amp;
}
function fwd(e, out) { return out.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)); }
/** Extend the hit box `b` forward (along e.yaw) by `reach` metres. */
function reachBox(e, b, reach) {
  const fx = Math.sin(e.yaw) * reach, fz = Math.cos(e.yaw) * reach;
  if (fx > 0) b.max.x += fx; else b.min.x += fx;
  if (fz > 0) b.max.z += fz; else b.min.z += fz;
}
/** Can a walker step to (x,z)? returns ground height or null (pit / wall). */
function walkable(e, ctx, x, z) {
  const g = groundAt(ctx.level, x, z, e.pos.y + 0.45, 1.2);
  return g > -Infinity ? g : null;
}
const toast = (text, kind = 'joke') => bus.emit('toast', { text, kind });

// ------------------------------------------------------------------ specs
// hw/hz: half extents, h: height of the hit box, y0: box offset above pos (flyers use pos as bottom).
const SPECS = {
  // ---------------------------------------------------------------- crab: sideways patrol, claws clack
  crab: {
    hw: 0.48, h: 0.62, patrol: { axis: 'x', range: 1.5, speed: 1.6 },
    update(e, dt, ctx) {
      const dir = patrolStep(e, dt);
      const ax = e.patrol?.axis ?? 'x';
      const a1 = ax === 'x' ? 0 : Math.PI / 2, a2 = a1 + Math.PI;
      const tgt = e.dist < 10 ? (Math.abs(angDiff(e.pyaw, a1)) < Math.PI / 2 ? a1 : a2) : a1;
      e.yaw = turnTo(e.yaw, tgt, dt * 4);
      const near = e.dist < 2.8;
      e.eyes.mood(near ? 'angry' : 'calm');
      walkLegs(e.m.legs, e.t, 18, dir ? 0.55 : 0.1);
      e.m.shell.position.y = Math.abs(Math.sin(e.t * 9)) * 0.03;
      e.m.shell.rotation.z = Math.sin(e.t * 9) * 0.06 * (e.patrol ? 1 : 0);
      const snapF = near ? 14 : 5;
      for (const c of e.m.claws) {
        c.arm.rotation.z = c.sx * (near ? -0.9 : -0.5) + Math.sin(e.t * 3 + c.sx) * 0.12;
        c.jaw.rotation.z = c.sx * (Math.sin(e.t * snapF + c.sx) > 0.3 ? 0.6 : 0.05);
      }
    },
  },

  // ---------------------------------------------------------------- turtle: stomp → flips, becomes a trampoline
  turtle: {
    hw: 0.52, h: 0.72, patrol: { axis: 'x', range: 1.5, speed: 0.9 },
    init(e) { setSt(e, 'walk'); e.m.flip.rotation.set(0, 0, 0); e.m.flip.position.set(0, 0, 0); },
    harmful: (e) => e.st === 'walk',
    onStomp(e, ctx, p) {
      if (e.st === 'walk') {
        setSt(e, 'flipped');
        p.bounce(13);
        ctx.sfx('enemy_squash', { pos: e.pos });
        ctx.fx.text(_a.copy(e.pos), 'TOING !', '#b5f3d0', { scale: 0.7 });
        e.eyes.mood('dizzy');
      } else {
        p.bounce(16.5);
        e.boing = 0.25;
        ctx.sfx('spring', { pos: e.pos });
        ctx.fx.ring(e.pos, 0xb5f3d0, 1.2);
      }
      return true;
    },
    box(e, b) { setBox(b, e.pos.x, e.pos.y, e.pos.z, 0.52, e.st === 'flipped' ? 0.62 : 0.72, 0.52); },
    update(e, dt) {
      const m = e.m;
      if (e.st === 'walk') {
        const dir = patrolStep(e, dt);
        if (e.patrol) e.yaw = turnTo(e.yaw, yawForAxis(e.patrol.axis, dir), dt * 5);
        walkLegs(m.legs, e.t, 7, 0.45);
        m.head.position.z = 0.55 + Math.sin(e.t * 7) * 0.03;
        m.flip.rotation.z = Math.sin(e.t * 7) * 0.04;
      } else {
        // flipping animation then helpless wiggle
        const k = clamp(e.stT / 0.3, 0, 1);
        m.flip.rotation.z = Math.PI * easeOut(k);
        m.flip.position.y = 0.66 * k + Math.sin(k * Math.PI) * 0.5;
        for (const l of m.legs) l.rotation.x = Math.sin(e.t * 22 + l.position.x * 5) * 0.7;
        m.stars.visible = true;
        m.stars.rotation.y += dt * 4;
        m.stars.position.y = 0.95;
        e.boing = Math.max(0, (e.boing || 0) - dt);
        const s = 1 - Math.sin((e.boing / 0.25) * Math.PI) * 0.25;
        e.model.scale.set(2 - s, s, 2 - s);
      }
    },
  },

  // ---------------------------------------------------------------- plant: fixed, bites (no stomp while attacking)
  // params: reach (trigger distance, default 2.7)
  plant: {
    hw: 0.36, h: 1.4, cause: 'eaten',
    init(e) { setSt(e, 'idle'); e.cd = 0; },
    stompable: (e) => e.st === 'idle' || e.st === 'recover',
    box(e, b) {
      setBox(b, e.pos.x, e.pos.y, e.pos.z, 0.36, 1.4, 0.36);
      if (e.st === 'bite') reachBox(e, b, 1.6 * clamp(e.stT / 0.12, 0, 1));
      else if (e.st === 'recover' && e.stT < 0.25) reachBox(e, b, 1.3);
    },
    update(e, dt, ctx) {
      const m = e.m;
      e.cd -= dt;
      const reach = e.def.reach ?? 2.7;
      let lean = 0, open = 0.15 + Math.sin(e.t * 3) * 0.08, slide = 0;
      if (e.st === 'idle') {
        if (e.dist < 9) e.yaw = turnTo(e.yaw, e.pyaw, dt * 2.5);
        m.stem.rotation.z = Math.sin(e.t * 2) * 0.1;
        e.eyes.mood(e.dist < 5 ? 'angry' : 'calm');
        showAlert(m.alert, -1);
        m.stars.visible = false;
        if (e.dist < reach && Math.abs(e.dy) < 1.6 && e.cd <= 0) setSt(e, 'windup');
      } else if (e.st === 'windup') {
        const k = clamp(e.stT / 0.55, 0, 1);
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 1.6);
        lean = -0.5 * smooth(k); open = 0.15 + 0.85 * k;
        m.stem.rotation.z = Math.sin(e.t * 40) * 0.05 * k;
        e.eyes.mood('angry');
        showAlert(m.alert, k, e.t);
        if (k >= 1) { setSt(e, 'bite'); ctx.sfx('enemy_hit', { pos: e.pos, pitch: 0.7 }); }
      } else if (e.st === 'bite') {
        const k = clamp(e.stT / 0.22, 0, 1);
        lean = -0.5 + 1.55 * easeOut(k); open = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4; slide = 0.85 * easeOut(k);
        showAlert(m.alert, -1);
        if (k >= 1) setSt(e, 'recover');
      } else if (e.st === 'recover') {
        const k = clamp(e.stT / 0.95, 0, 1);
        lean = 1.05 * (1 - smooth(k)); slide = 0.85 * (1 - smooth(k)); open = 0.05;
        e.eyes.mood('dizzy');
        m.stars.visible = true; m.stars.rotation.y += dt * 5;
        if (k >= 1) { setSt(e, 'idle'); e.cd = 0.5; e.eyes.mood('calm'); }
      }
      m.stem.rotation.x = lean;
      m.stem.position.z = slide;
      m.jawU.rotation.x = -0.95 * open;
      m.jawL.rotation.x = 0.55 * open;
      m.tongue.position.z = 0.3 + Math.sin(e.t * 8) * 0.04 * open;
    },
  },

  // ---------------------------------------------------------------- bat: sinusoidal flight. params: fly (1.3), amp (0.6), range (1.4)
  bat: {
    hw: 0.34, h: 0.66, fly: true, flyDefault: 1.3,
    update(e, dt) {
      const m = e.m, d = e.def;
      const baseY = e.flyBase;
      e.pos.y = baseY + Math.sin(e.t * 2.2 + e.ph0) * (d.amp ?? 0.6);
      if (e.patrol) patrolStep(e, dt);
      else e.pos.x = e.home.x + Math.sin(e.t * 0.9 + e.ph0) * (d.range ?? 1.4);
      e.yaw = turnTo(e.yaw, e.dist < 12 ? e.pyaw : 0, dt * 3);
      const f = Math.sin(e.t * 17);
      for (const w of m.wings) { w.w.rotation.z = w.sx * f * 0.75; w.tip.rotation.z = w.sx * Math.sin(e.t * 17 - 0.7) * 0.5; }
      m.core.position.y = -f * 0.04;
      m.core.rotation.z = Math.cos(e.t * 0.9) * 0.2;
      e.eyes.mood(e.dist < 4 ? 'angry' : 'calm');
    },
  },

  // ---------------------------------------------------------------- porcupine: calm (stompable) → shiver "!" → spiked (no stomp, spin bounces off)
  // params: calm (2.2 s), spiked (1.8 s), offset (s)
  porcupine: {
    hw: 0.45, h: 0.78,
    init(e) { setSt(e, 'calm'); e.stT = -(e.def.offset ?? 0); },
    stompable: (e) => e.st === 'calm' || e.st === 'warn',
    spinBlocked: (e) => e.st === 'spiked',
    update(e, dt, ctx) {
      const m = e.m, d = e.def;
      let L = 0.55, puff = 1;
      if (e.st === 'calm') {
        patrolStep(e, dt);
        if (e.patrol) e.yaw = turnTo(e.yaw, yawForAxis(e.patrol.axis, Math.cos(e.pph) >= 0 ? 1 : -1), dt * 5);
        else if (e.dist < 10) e.yaw = turnTo(e.yaw, e.pyaw, dt * 2);
        showAlert(m.alert, -1);
        e.eyes.mood('calm');
        m.core.position.y = Math.abs(Math.sin(e.t * 6)) * 0.02;
        if (e.stT > (d.calm ?? 2.2)) setSt(e, 'warn');
      } else if (e.st === 'warn') {
        const k = e.stT / 0.6;
        L = 0.55 + Math.abs(Math.sin(e.t * 30)) * 0.25;
        m.core.position.x = Math.sin(e.t * 50) * 0.02;
        showAlert(m.alert, k, e.t);
        e.eyes.mood('angry');
        if (k >= 1) { setSt(e, 'spiked'); ctx.sfx('enemy_hit', { pos: e.pos, pitch: 1.6 }); }
      } else if (e.st === 'spiked') {
        L = 1.7 - Math.max(0, 0.15 - e.stT) * 6; puff = 1.12;
        m.core.position.x = 0;
        showAlert(m.alert, -1);
        if (e.stT > (d.spiked ?? 1.8)) setSt(e, 'relax');
      } else {
        L = lerp(1.7, 0.55, clamp(e.stT / 0.3, 0, 1));
        if (e.stT > 0.3) setSt(e, 'calm');
      }
      m.quillG.scale.setScalar(0.6 + L * 0.4);
      m.core.scale.setScalar(puff);
    },
  },

  // ---------------------------------------------------------------- scorpion: tail strike in front (curl + glowing stinger first)
  scorpion: {
    hw: 0.42, h: 0.6, patrol: { axis: 'x', range: 1.2, speed: 1.1 },
    init(e) { setSt(e, 'walk'); e.cd = 0; e.m.stinger.material = e.m.stingerMat; },
    box(e, b) {
      setBox(b, e.pos.x, e.pos.y, e.pos.z, 0.42, 0.6, 0.42);
      if (e.st === 'strike' || (e.st === 'stuck' && e.stT < 0.2)) reachBox(e, b, 1.05);
    },
    update(e, dt, ctx) {
      const m = e.m;
      e.cd -= dt;
      let curl = 0.5, root = -0.35, shake = 0;
      if (e.st === 'walk') {
        const dir = patrolStep(e, dt);
        const tgt = e.dist < 5 ? e.pyaw : (e.patrol ? yawForAxis(e.patrol.axis, dir) : e.yaw);
        e.yaw = turnTo(e.yaw, tgt, dt * 4);
        walkLegs(m.legs, e.t, 16, 0.4);
        curl = 0.5 + Math.sin(e.t * 3) * 0.08;
        showAlert(m.alert, -1); m.stars.visible = false;
        e.eyes.mood(e.dist < 4 ? 'angry' : 'calm');
        if (e.dist < 2.6 && Math.abs(e.dy) < 1.2 && e.cd <= 0) { setSt(e, 'windup'); m.stinger.material = RED_GLOW; }
      } else if (e.st === 'windup') {
        const k = clamp(e.stT / 0.5, 0, 1);
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 3);
        curl = 0.5 + 0.25 * k; root = -0.35 - 0.35 * k; shake = 0.05 * k;
        showAlert(m.alert, k, e.t);
        if (k >= 1) { setSt(e, 'strike'); ctx.sfx('enemy_hit', { pos: e.pos, pitch: 1.3 }); }
      } else if (e.st === 'strike') {
        const k = clamp(e.stT / 0.16, 0, 1);
        curl = 0.75 + 0.35 * easeOut(k); root = -0.7 + 1.5 * easeOut(k);
        showAlert(m.alert, -1);
        if (k >= 1) { setSt(e, 'stuck'); m.stinger.material = m.stingerMat; ctx.fx.burst(_a.copy(e.pos).addScaledVector(fwd(e, _b), 1.1), 0xe8c27a, 6, { speed: 2, dy: 0 }); }
      } else {
        const k = clamp(e.stT / 0.85, 0, 1);
        curl = 1.1 - 0.6 * smooth(k); root = 0.8 - 1.15 * smooth(k);
        shake = k < 0.6 ? 0.08 : 0;
        e.eyes.mood('dizzy');
        if (k >= 1) { setSt(e, 'walk'); e.cd = 0.8; e.eyes.mood('calm'); }
      }
      m.tailRoot.rotation.x = root;
      for (let i = 0; i < m.tail.length; i++) m.tail[i].rotation.x = curl + Math.sin(e.t * 40 + i) * shake;
      for (const c of m.claws) c.jaw.rotation.y = c.sx * (Math.sin(e.t * 6 + c.sx) > 0 ? 0.4 : 0);
    },
  },

  // ---------------------------------------------------------------- camel: puffs cheeks then spits date pits. params: range (12), interval (2.4), pitSpeed (8.5)
  camel: {
    hw: 0.62, h: 1.9,
    init(e) { setSt(e, 'idle'); e.cd = 1; e.pits?.clear(); },
    setup(e, ctx) {
      e.pits = makeProjectiles(e.object3d, 3, () => {
        const g = new THREE.Group();
        part(g, 'sphere', 0x6a3a1a, [0.1, 0.1, 0.16]);
        part(g, 'sphere', 0x8a5a2a, [0.06, 0.06, 0.1], [0.03, 0.04, 0]);
        return g;
      }, { radius: 0.14, gravity: 3, life: 3, color: 0x8a5a2a, cause: 'generic' });
    },
    onStomp(e, ctx, p) { startSquash(e, ctx); p.bounce(14); return true; },
    onDie(e) { e.pits.clear(); },
    update(e, dt, ctx) {
      const m = e.m, d = e.def;
      e.cd -= dt;
      e.pits.update(dt, ctx);
      let puff = 0.08, neck = -0.35;
      const range = d.range ?? 12;
      if (e.st === 'idle') {
        if (e.dist < range + 4) e.yaw = turnTo(e.yaw, e.pyaw, dt * 1.6);
        m.lip.position.y = -0.15 + Math.sin(e.t * 5) * 0.015;
        m.lip.position.x = Math.sin(e.t * 2.5) * 0.02;
        neck = -0.35 + Math.sin(e.t * 1.3) * 0.05;
        showAlert(m.alert, -1);
        if (e.cd <= 0 && e.dist < range && e.dist > 1.6 && Math.abs(angDiff(e.yaw, e.pyaw)) < 0.45 && Math.abs(e.dy) < 4) setSt(e, 'windup');
      } else if (e.st === 'windup') {
        const k = clamp(e.stT / 0.7, 0, 1);
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 1.2);
        puff = 0.08 + 0.09 * smooth(k); neck = -0.35 - 0.4 * smooth(k);
        showAlert(m.alert, k, e.t);
        e.eyes.mood(k > 0.5 ? 'angry' : 'sneaky');
        if (k >= 1) {
          setSt(e, 'spit');
          const f = fwd(e, _b);
          _a.set(e.pos.x + f.x * 1.25, e.pos.y + 2.0, e.pos.z + f.z * 1.25);
          playerCenter(ctx.player, _c).sub(_a);
          const dist = _c.length();
          const sp = d.pitSpeed ?? 8.5;
          _c.multiplyScalar(sp / Math.max(0.01, dist));
          _c.y += 3 * (dist / sp) * 0.5; // compensate the light gravity
          e.pits.fire(_a, _c);
          ctx.sfx('honk', { pos: e.pos, pitch: 0.8 });
        }
      } else {
        const k = clamp(e.stT / 0.45, 0, 1);
        puff = 0.17 - 0.09 * k; neck = -0.75 + 0.4 * easeOut(k);
        e.eyes.mood('sneaky');
        showAlert(m.alert, -1);
        if (k >= 1) { setSt(e, 'idle'); e.cd = d.interval ?? 2.4; }
      }
      for (const c of m.cheeks) c.scale.setScalar(puff);
      m.neck.rotation.x = neck;
      m.head.rotation.x = -neck;
    },
  },

  // ---------------------------------------------------------------- pigeon: perched in the air, coos, then dives at where you WERE. params: fly (2.6), range (6)
  pigeon: {
    hw: 0.3, h: 0.6, fly: true, flyDefault: 2.6,
    init(e) { setSt(e, 'perch'); e.cd = 0.5; e.perch.copy(e.home); e.perch.y = e.flyBase; e.pos.copy(e.perch); },
    setup(e) { e.perch = new THREE.Vector3(); e.target = new THREE.Vector3(); e.from = new THREE.Vector3(); },
    update(e, dt, ctx) {
      const m = e.m, d = e.def;
      e.cd -= dt;
      let flap = 10, pitch = 0;
      m.stars.visible = false;
      if (e.st === 'perch') {
        e.pos.copy(e.perch); e.pos.y += Math.sin(e.t * 3) * 0.12;
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 3);
        m.head.position.z = 0.2 + Math.max(0, Math.sin(e.t * 6)) * 0.06;
        showAlert(m.alert, -1);
        e.eyes.mood('calm');
        if (e.cd <= 0 && e.dist < (d.range ?? 6) && ctx.player.pos.y < e.pos.y && !ctx.player.dead) { setSt(e, 'warn'); ctx.sfx('honk', { pos: e.pos, pitch: 1.5 }); }
      } else if (e.st === 'warn') {
        const k = clamp(e.stT / 0.65, 0, 1);
        e.pos.copy(e.perch); e.pos.y += 0.35 * smooth(k);
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 6);
        m.chest.scale.setScalar(0.2 + 0.08 * Math.sin(k * Math.PI));
        flap = 22; pitch = -0.3 * k;
        showAlert(m.alert, k, e.t);
        e.eyes.mood('angry');
        if (k >= 1) {
          setSt(e, 'dive');
          e.from.copy(e.pos);
          e.target.copy(ctx.player.pos); e.target.y += 0.2;
          showAlert(m.alert, -1);
        }
      } else if (e.st === 'dive') {
        _a.copy(e.target).sub(e.pos);
        const l = _a.length(), step = 11 * dt;
        flap = 4; pitch = 0.9;
        e.yaw = Math.atan2(_a.x, _a.z);
        if (l <= step) {
          e.pos.copy(e.target);
          const g = groundAt(ctx.level, e.pos.x, e.pos.z, e.pos.y + 0.5, 2.5);
          if (g > -Infinity) { e.pos.y = g; setSt(e, 'dazed'); ctx.fx.burst(e.pos, 0xb0b8c8, 8, { speed: 2, dy: 0.1 }); ctx.sfx('land', { pos: e.pos }); }
          else { e.from.copy(e.pos); setSt(e, 'back'); }
        } else e.pos.addScaledVector(_a, step / l);
      } else if (e.st === 'dazed') {
        flap = 0; pitch = 0;
        e.yaw += dt * 2.5;
        m.stars.visible = true; m.stars.rotation.y += dt * 5;
        e.eyes.mood('dizzy');
        m.head.position.z = 0.2 + Math.max(0, Math.sin(e.t * 8)) * 0.08;
        if (e.stT > 1.5) { e.from.copy(e.pos); setSt(e, 'back'); e.eyes.mood('calm'); }
      } else if (e.st === 'back') {
        const k = clamp(e.stT / 1.1, 0, 1);
        e.pos.lerpVectors(e.from, e.perch, smooth(k));
        e.pos.y += Math.sin(k * Math.PI) * 1.0;
        flap = 20;
        e.yaw = turnTo(e.yaw, Math.atan2(e.perch.x - e.pos.x, e.perch.z - e.pos.z), dt * 6);
        if (k >= 1) { setSt(e, 'perch'); e.cd = 1.4; }
      }
      const f = flap ? Math.sin(e.t * flap) : 0;
      for (const w of m.wings) w.w.rotation.z = w.sx * (flap ? 0.4 + f * 0.7 : 0);
      if (e.st !== 'warn') m.chest.scale.setScalar(0.2);
      m.core.rotation.x = pitch;
    },
  },

  // ---------------------------------------------------------------- cat: harmless thief. params: range (2.8), steal (5)
  cat: {
    hw: 0.3, h: 0.7, harmless: true,
    init(e) { setSt(e, 'sit'); e.loot = 0; e.m.loot.visible = false; e.cd = 0; e.turn = 1; },
    update(e, dt, ctx) {
      const m = e.m, d = e.def, g = ctx.game;
      e.cd -= dt;
      if (e.st === 'sit' || e.st === 'scoff') {
        if (e.dist < 7) e.yaw = turnTo(e.yaw, e.pyaw, dt * 2);
        for (let i = 0; i < m.tail.length; i++) m.tail[i].rotation.z = Math.sin(e.t * 2 - i * 0.6) * 0.35;
        const groom = Math.sin(e.t * 0.7) > 0.6;
        m.head.rotation.z = groom ? Math.sin(e.t * 9) * 0.15 : 0;
        m.head.rotation.x = groom ? 0.25 : 0;
        for (const l of m.legs) l.rotation.x = 0;
        e.eyes.mood(e.dist < 4 ? 'sneaky' : 'calm');
        if (e.st === 'scoff' && e.stT > 2.5) setSt(e, 'sit');
        if (e.st === 'sit' && e.cd <= 0 && e.dist < (d.range ?? 2.8) && Math.abs(e.dy) < 1.5 && !ctx.player.dead) {
          const n = Math.min(d.steal ?? 5, g.lights);
          ctx.sfx('meow', { pos: e.pos });
          if (n <= 0) {
            setSt(e, 'scoff'); e.cd = 4;
            ctx.fx.text(_a.copy(e.pos), 'PFFF…', '#d9f59a', { scale: 0.6 });
            toast({ fr: 'Le chat te trouve trop pauvre pour être volé.', en: 'The cat finds you too poor to rob.' });
          } else {
            g.addLights(-n);
            e.loot = n; m.loot.visible = true;
            ctx.fx.burst(ctx.player.pos, [0xfff1a0, 0xffd23f], 12, { speed: 4 });
            ctx.fx.text(_a.copy(e.pos), `-${n}`, '#ffd23f', { scale: 0.7 });
            toast({ fr: `Un chat de Sidi Bou Saïd t'a chipé ${n} lucioles ! Toupie-le !`, en: `A Sidi Bou Said cat swiped ${n} fireflies! Spin it!` });
            setSt(e, 'flee');
            e.yaw = e.pyaw + Math.PI;
          }
        }
      } else if (e.st === 'flee') {
        const sp = d.fleeSpeed ?? 6.2;
        const nx = e.pos.x + Math.sin(e.yaw) * sp * dt, nz = e.pos.z + Math.cos(e.yaw) * sp * dt;
        const gy = walkable(e, ctx, nx + Math.sin(e.yaw) * 0.5, nz + Math.cos(e.yaw) * 0.5);
        if (gy === null) { e.yaw += e.turn * Math.PI / 2; e.turn = -e.turn; }
        else { e.pos.x = nx; e.pos.z = nz; e.pos.y = gy; }
        walkLegs(m.legs, e.t, 22, 0.8);
        m.core.position.y = Math.abs(Math.sin(e.t * 11)) * 0.08;
        for (let i = 0; i < m.tail.length; i++) m.tail[i].rotation.x = -0.3;
        m.loot.rotation.y += dt * 5;
        e.eyes.mood('sneaky');
        if (e.stT > (d.fleeTime ?? 5) || e.dist > 28) {
          ctx.fx.text(_a.copy(e.pos), 'MIAOU ♪', '#d9f59a', { scale: 0.6 });
          startPoof(e, ctx);
        }
      }
    },
    /** spin / stomp: gives the loot back and runs off */
    caught(e, ctx, p) {
      if (e.loot > 0) {
        ctx.game.addLights(e.loot);
        ctx.fx.burst(e.pos, [0xfff1a0, 0xffd23f], 16, { speed: 5 });
        ctx.sfx('light_many', { pos: e.pos });
        toast({ fr: 'Lucioles récupérées. Le chat nie tout.', en: 'Fireflies recovered. The cat denies everything.' });
      }
      ctx.sfx('meow', { pos: e.pos, pitch: 1.4 });
      ctx.fx.text(_a.copy(e.pos), 'MIAOU !', '#ffffff', { scale: 0.8 });
      e.loot = 0;
      startPoof(e, ctx, 0.5);
      if (p && p.vel.y < 0) p.bounce(11);
    },
  },

  // ---------------------------------------------------------------- penguin: stands grumpily, crouches, belly-slides to the other end. params: wait (1.4)
  penguin: {
    hw: 0.36, h: 0.88, patrol: { axis: 'x', range: 2.5, speed: 5 },
    init(e) { setSt(e, 'stand'); e.off = 0; e.end = 1; },
    box(e, b) {
      const sl = e.st === 'slide';
      setBox(b, e.pos.x, e.pos.y, e.pos.z, sl ? 0.45 : 0.36, sl ? 0.5 : 0.88, sl ? 0.45 : 0.36);
    },
    update(e, dt, ctx) {
      const m = e.m, p = e.patrol;
      let lie = 0;
      if (e.st === 'stand') {
        e.yaw = turnTo(e.yaw, e.dist < 12 ? e.pyaw : 0, dt * 4);
        for (const f of m.flippers) f.f.rotation.z = f.sx * (0.2 + Math.abs(Math.sin(e.t * 5)) * 0.4);
        m.feet[1].position.y = 0.03 + Math.max(0, Math.sin(e.t * 10)) * 0.04;
        m.core.rotation.z = Math.sin(e.t * 5) * 0.06;
        showAlert(m.alert, -1);
        if (e.stT > (e.def.wait ?? 1.4)) setSt(e, 'crouch');
      } else if (e.st === 'crouch') {
        const k = clamp(e.stT / 0.45, 0, 1);
        e.yaw = turnTo(e.yaw, yawForAxis(p.axis, e.end), dt * 10);
        lie = -0.25 * k;
        for (const f of m.flippers) f.f.rotation.z = f.sx * (0.3 + Math.sin(e.t * 30) * 0.4);
        showAlert(m.alert, k, e.t);
        if (k >= 1) { setSt(e, 'slide'); showAlert(m.alert, -1); }
      } else {
        const target = e.end * p.range, step = p.speed * dt;
        lie = Math.PI / 2 * 0.92;
        e.yaw = yawForAxis(p.axis, e.end);
        if (Math.abs(target - e.off) <= step) { e.off = target; e.end = -e.end; setSt(e, 'stand'); ctx.fx.burst(e.pos, 0xeaf6ff, 6, { speed: 2, dy: 0 }); }
        else e.off += Math.sign(target - e.off) * step;
        for (const f of m.flippers) f.f.rotation.z = f.sx * 1.3;
        if (Math.random() < dt * 8) ctx.fx.burst(e.pos, 0xeaf6ff, 1, { speed: 1, dy: 0, life: 0.4 });
      }
      e.pos[p.axis] = e.home[p.axis] + e.off;
      m.core.rotation.x = lie;
      m.core.position.y = lie > 1 ? 0.3 : 0;
      if (e.st !== 'stand') m.core.rotation.z = 0;
    },
  },

  // ---------------------------------------------------------------- yetiKid: raises a snowball over its head, lobs it at your position. params: range (11), interval (2.6)
  yetiKid: {
    hw: 0.4, h: 1.0,
    init(e) { setSt(e, 'idle'); e.cd = 1; e.balls?.clear(); e.m.ball.visible = false; e.m.tongue.visible = false; },
    setup(e) {
      e.balls = makeProjectiles(e.object3d, 2, () => {
        const g = new THREE.Group();
        part(g, 'sphere', 0xffffff, 0.22);
        part(g, 'ico', 0xdfefff, 0.12, [0.12, 0.08, 0.05]);
        return g;
      }, { radius: 0.22, gravity: 14, life: 3, color: 0xffffff, cause: 'generic' });
    },
    onDie(e) { e.balls.clear(); },
    update(e, dt, ctx) {
      const m = e.m, d = e.def;
      e.cd -= dt;
      e.balls.update(dt, ctx);
      if (e.patrol && e.st === 'idle') patrolStep(e, dt);
      let arm = 0, lean = 0;
      if (e.st === 'idle') {
        e.yaw = turnTo(e.yaw, e.dist < 14 ? e.pyaw : 0, dt * 3);
        m.core.position.y = Math.abs(Math.sin(e.t * 4)) * 0.04;
        arm = Math.sin(e.t * 4) * 0.2;
        showAlert(m.alert, -1);
        e.eyes.mood('calm');
        if (e.cd <= 0 && e.dist < (d.range ?? 11) && e.dist > 1.3 && Math.abs(e.dy) < 4 && !ctx.player.dead) {
          setSt(e, 'windup'); m.ball.visible = true; m.tongue.visible = true;
        }
      } else if (e.st === 'windup') {
        const k = clamp(e.stT / 0.7, 0, 1);
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 5);
        arm = -2.7 * smooth(k); lean = -0.2 * k;
        m.core.position.x = Math.sin(e.t * 40) * 0.015 * k;
        showAlert(m.alert, k, e.t);
        e.eyes.mood('angry');
        if (k >= 1) {
          setSt(e, 'throw');
          m.ball.visible = false; m.tongue.visible = false;
          const f = fwd(e, _b);
          _a.set(e.pos.x + f.x * 0.3, e.pos.y + 1.3, e.pos.z + f.z * 0.3);
          _c.copy(ctx.player.pos); _c.y += 0.4;
          const dist = Math.hypot(_c.x - _a.x, _c.z - _a.z);
          const T = clamp(dist / 9, 0.5, 1.15);
          _d.subVectors(_c, _a).multiplyScalar(1 / T);
          _d.y += 0.5 * 14 * T;
          e.balls.fire(_a, _d);
          ctx.sfx('spin', { pos: e.pos, pitch: 1.5 });
        }
      } else {
        const k = clamp(e.stT / 0.35, 0, 1);
        arm = -2.7 + 3.6 * easeOut(k); lean = -0.2 + 0.4 * easeOut(k);
        showAlert(m.alert, -1);
        if (k >= 1) { setSt(e, 'idle'); e.cd = d.interval ?? 2.6; }
      }
      m.arms[1].rotation.x = arm;
      m.arms[0].rotation.x = e.st === 'windup' ? 0.5 : -arm * 0.3;
      m.core.rotation.x = lean;
    },
  },

  // ---------------------------------------------------------------- robot: vacuum that revs (siren + "!"), then charges in a straight line. params: range (7), chargeDist (7), chargeSpeed (8.5)
  robot: {
    hw: 0.48, h: 0.5,
    init(e) { setSt(e, 'roam'); e.cd = 0.5; e.m.siren.material = DARK_RED; },
    update(e, dt, ctx) {
      const m = e.m, d = e.def;
      e.cd -= dt;
      let brush = 4, shake = 0;
      m.stars.visible = false;
      if (e.st === 'roam') {
        const dir = patrolStep(e, dt);
        if (e.patrol) e.yaw = turnTo(e.yaw, yawForAxis(e.patrol.axis, dir), dt * 4);
        else e.yaw = turnTo(e.yaw, e.dist < 10 ? e.pyaw : e.yaw, dt * 1.5);
        showAlert(m.alert, -1);
        e.eyes.mood('calm');
        m.antenna.rotation.z = Math.sin(e.t * 3) * 0.2;
        if (e.cd <= 0 && e.dist < (d.range ?? 7) && Math.abs(e.dy) < 1.2 && !ctx.player.dead) { setSt(e, 'rev'); ctx.sfx('robot', { pos: e.pos }); }
      } else if (e.st === 'rev') {
        const k = clamp(e.stT / 0.75, 0, 1);
        if (k < 0.7) e.yaw = turnTo(e.yaw, e.pyaw, dt * 6);
        brush = 30; shake = 0.03;
        m.siren.material = Math.sin(e.t * 30) > 0 ? RED_GLOW : DARK_RED;
        showAlert(m.alert, k, e.t);
        e.eyes.mood('angry');
        if (Math.random() < dt * 10) ctx.fx.burst(e.pos, 0xcfd6e0, 1, { speed: 1, dy: 0.3, life: 0.5 });
        if (k >= 1) { setSt(e, 'charge'); e.run = 0; showAlert(m.alert, -1); }
      } else if (e.st === 'charge') {
        const sp = d.chargeSpeed ?? 8.5, f = fwd(e, _b);
        const nx = e.pos.x + f.x * sp * dt, nz = e.pos.z + f.z * sp * dt;
        const gy = walkable(e, ctx, nx + f.x * 0.5, nz + f.z * 0.5);
        brush = 40;
        m.siren.material = Math.sin(e.t * 30) > 0 ? RED_GLOW : DARK_RED;
        e.run += sp * dt;
        if (gy === null || e.run > (d.chargeDist ?? 7)) {
          setSt(e, 'dazed'); m.siren.material = DARK_RED;
          ctx.fx.burst(e.pos, 0x9aa3b5, 8, { speed: 2.5 });
          ctx.sfx('crate_iron', { pos: e.pos, vol: 0.5 });
        } else { e.pos.x = nx; e.pos.z = nz; e.pos.y = gy; }
      } else if (e.st === 'dazed') {
        brush = 0;
        m.stars.visible = true; m.stars.rotation.y += dt * 5;
        e.eyes.mood('dizzy');
        if (e.stT > 1.2) setSt(e, 'back');
      } else {
        // drive back home (patrol resumes from the centre)
        _a.copy(e.home).sub(e.pos); _a.y = 0;
        const l = _a.length(), step = 2.6 * dt;
        e.eyes.mood('calm');
        if (l <= step) { e.pos.copy(e.home); e.pph = 0; setSt(e, 'roam'); e.cd = 1; }
        else { e.pos.addScaledVector(_a, step / l); e.yaw = turnTo(e.yaw, Math.atan2(_a.x, _a.z), dt * 6); }
      }
      for (const b of m.brushes) b.rotation.y += dt * brush;
      m.core.position.x = Math.sin(e.t * 60) * shake;
    },
  },

  // ---------------------------------------------------------------- drone: hovers, vertical laser on a fixed rhythm (thin targeting beam first)
  // params: fly (2.6), period (3.2), offset (0)
  drone: {
    hw: 0.42, h: 0.5, fly: true, flyDefault: 2.6,
    setup(e) {
      const root = e.object3d;
      e.beam = group(root);
      e.thin = part(e.beam, 'cyl', glow(0xff4a4a, 0.55, true), [0.035, 1, 0.035], [0, -0.5, 0]);
      e.thick = group(e.beam);
      part(e.thick, 'cyl', glow(0xff3a5a, 0.55, true), [0.3, 1, 0.3], [0, -0.5, 0]);
      part(e.thick, 'cyl', glow(0xfff0f0), [0.1, 1, 0.1], [0, -0.5, 0]);
      e.spot = part(root, 'disc', glow(0xff3a3a, 0.6, true), 0.4, null, [-Math.PI / 2, 0, 0]);
      e.beam.visible = false; e.spot.visible = false;
    },
    init(e) { e.beam.visible = false; e.spot.visible = false; e.fired = false; },
    onDie(e) { e.beam.visible = false; e.spot.visible = false; },
    update(e, dt, ctx) {
      const m = e.m, d = e.def, P = d.period ?? 3.2;
      const ph = (((ctx.time + (d.offset ?? 0)) % P) + P) % P;
      const firing = ph >= P - 0.8, tele = !firing && ph >= P - 1.5;
      if (!firing && !tele) patrolStep(e, dt);
      e.pos.y = e.flyBase + Math.sin(e.t * 3) * 0.08;
      e.yaw = turnTo(e.yaw, e.dist < 12 ? e.pyaw : 0, dt * 2);
      for (let i = 0; i < m.rotors.length; i++) m.rotors[i].rotation.y += dt * (i % 2 ? 40 : -40);
      m.core.rotation.z = Math.sin(e.t * 1.7) * 0.08;
      const g = groundAt(ctx.level, e.pos.x, e.pos.z, e.pos.y - 0.05, 40);
      const gy = g > -Infinity ? g : e.pos.y - 30;
      const len = Math.max(0.1, e.pos.y + 0.05 - gy);
      e.beam.visible = firing || tele;
      e.spot.visible = firing || tele;
      m.emitter.material = firing || (tele && Math.sin(e.t * 40) > 0) ? RED_GLOW : DARK_RED;
      if (e.beam.visible) {
        e.beam.position.set(e.pos.x, e.pos.y + 0.05, e.pos.z);
        e.beam.scale.set(1, len, 1);
        e.thin.visible = tele && Math.sin(e.t * 45) > -0.3;
        e.thick.visible = firing;
        if (firing) e.thick.scale.set(1 + Math.sin(e.t * 50) * 0.15, 1, 1 + Math.sin(e.t * 50) * 0.15);
        e.spot.position.set(e.pos.x, gy + 0.03, e.pos.z);
        e.spot.scale.setScalar(firing ? 0.5 + Math.sin(e.t * 30) * 0.08 : 0.3 + (ph - (P - 1.5)) * 0.3);
      }
      showAlert(m.alert, tele ? (ph - (P - 1.5)) / 0.7 : -1, e.t);
      e.eyes.mood(tele || firing ? 'angry' : 'calm');
      if (firing && !e.fired) { e.fired = true; ctx.sfx('laser', { pos: e.pos }); }
      if (!firing) e.fired = false;
      if (firing) {
        const p = ctx.player;
        if (!p.dead && Math.abs(p.pos.x - e.pos.x) < 0.45 && Math.abs(p.pos.z - e.pos.z) < 0.45 && p.pos.y < e.pos.y && p.pos.y + 1.1 > gy) ctx.game.hurt('zap');
      }
    },
  },

  // ---------------------------------------------------------------- cactus: crouches ("!") then hops at you. Spiky: no stomp, spin it! params: range (6), leash (6)
  cactus: {
    hw: 0.34, h: 1.15,
    stompable: () => false,
    init(e) { setSt(e, 'idle'); e.from = e.from || new THREE.Vector3(); e.to = e.to || new THREE.Vector3(); },
    update(e, dt, ctx) {
      const m = e.m, d = e.def, range = d.range ?? 6;
      let sy = 1, hopY = 0;
      if (e.st === 'idle' || e.st === 'land') {
        const k = e.st === 'land' ? clamp(e.stT / 0.8, 0, 1) : 1;
        sy = e.st === 'land' ? 1 - Math.sin(k * Math.PI) * 0.25 * (1 - k) - (k < 0.15 ? 0.2 : 0) : 1 + Math.sin(e.t * 3) * 0.03;
        if (e.dist < range + 3) e.yaw = turnTo(e.yaw, e.pyaw, dt * 3);
        for (const a of m.arms) a.rotation.z = Math.sin(e.t * 3 + a.position.x * 5) * 0.12;
        showAlert(m.alert, -1);
        const homeD = Math.hypot(e.pos.x - e.home.x, e.pos.z - e.home.z);
        if (k >= 1 && ((e.dist < range && Math.abs(e.dy) < 2 && !ctx.player.dead) || homeD > 0.6)) setSt(e, 'crouch');
      } else if (e.st === 'crouch') {
        const k = clamp(e.stT / 0.5, 0, 1);
        const chase = e.dist < range && !ctx.player.dead;
        e.yaw = turnTo(e.yaw, chase ? e.pyaw : Math.atan2(e.home.x - e.pos.x, e.home.z - e.pos.z), dt * 6);
        sy = 1 - 0.28 * smooth(k);
        m.core.position.x = Math.sin(e.t * 45) * 0.02 * k;
        if (chase) showAlert(m.alert, k, e.t);
        if (k >= 1) {
          // pick the landing spot: towards the player (or home), max 2.2 m, inside the leash, on solid ground
          e.from.copy(e.pos);
          const tx = chase ? ctx.player.pos.x : e.home.x, tz = chase ? ctx.player.pos.z : e.home.z;
          _a.set(tx - e.pos.x, 0, tz - e.pos.z);
          const l = _a.length();
          const hop = Math.min(2.2, l);
          e.to.set(e.pos.x + (l > 0.01 ? _a.x / l * hop : 0), e.pos.y, e.pos.z + (l > 0.01 ? _a.z / l * hop : 0));
          const leash = d.leash ?? 6;
          _b.set(e.to.x - e.home.x, 0, e.to.z - e.home.z);
          if (_b.length() > leash) { _b.setLength(leash); e.to.x = e.home.x + _b.x; e.to.z = e.home.z + _b.z; }
          const g = groundAt(ctx.level, e.to.x, e.to.z, e.pos.y + 1.5, 3);
          if (g > -Infinity) e.to.y = g; else e.to.copy(e.pos);
          setSt(e, 'hop');
          ctx.sfx('jump', { pos: e.pos, pitch: 0.7, vol: 0.6 });
          showAlert(m.alert, -1);
        }
      } else if (e.st === 'hop') {
        const k = clamp(e.stT / 0.55, 0, 1);
        e.pos.lerpVectors(e.from, e.to, k);
        hopY = Math.sin(k * Math.PI) * 1.1;
        sy = 1.15;
        if (k >= 1) { setSt(e, 'land'); ctx.fx.burst(e.pos, 0xe8c27a, 8, { speed: 2.5, dy: 0 }); ctx.sfx('land', { pos: e.pos, vol: 0.6 }); }
      }
      m.core.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
      m.core.position.y = hopY;
      e.hopY = hopY;
    },
    box(e, b) { setBox(b, e.pos.x, e.pos.y + (e.hopY || 0), e.pos.z, 0.34, 1.15, 0.34); },
  },

  // ---------------------------------------------------------------- skunk: turns its back, raises its tail ("!"), releases a lingering toxic cloud
  skunk: {
    hw: 0.34, h: 0.62, patrol: { axis: 'x', range: 1.5, speed: 1 },
    setup(e) { e.cloud = makeCloud(e.object3d); e.cloudPos = new THREE.Vector3(); },
    init(e) { setSt(e, 'walk'); e.cd = 0; e.cloudT = -1; e.cloud.visible = false; },
    onDie(e) { e.cloud.visible = false; e.cloudT = -1; },
    update(e, dt, ctx) {
      const m = e.m;
      e.cd -= dt;
      let tail = -0.4, fluff = 1;
      if (e.st === 'walk') {
        const dir = patrolStep(e, dt);
        if (e.patrol) e.yaw = turnTo(e.yaw, yawForAxis(e.patrol.axis, dir), dt * 5);
        walkLegs(m.legs, e.t, 12, 0.4);
        tail = -0.4 + Math.sin(e.t * 3) * 0.1;
        showAlert(m.alert, -1);
        e.eyes.mood('sneaky');
        if (e.cd <= 0 && e.dist < 3.6 && Math.abs(e.dy) < 1.5 && !ctx.player.dead) setSt(e, 'aim');
      } else if (e.st === 'aim') {
        const k = clamp(e.stT / 0.65, 0, 1);
        e.yaw = turnTo(e.yaw, e.pyaw + Math.PI, dt * 7);
        tail = -0.4 + 1.0 * smooth(k); fluff = 1 + 0.4 * k;
        m.core.position.x = Math.sin(e.t * 45) * 0.02 * k;
        showAlert(m.alert, k, e.t);
        if (k >= 1) {
          setSt(e, 'spray');
          const f = fwd(e, _b);
          e.cloudPos.set(e.pos.x - f.x * 1.0, e.pos.y + 0.55, e.pos.z - f.z * 1.0);
          e.cloud.position.copy(e.cloudPos);
          e.cloudT = 0; e.cloud.visible = true;
          ctx.sfx('wind', { pos: e.pos, pitch: 0.55 });
          showAlert(m.alert, -1);
        }
      } else {
        tail = 0.6; fluff = 1.4 - clamp(e.stT, 0, 0.4);
        e.eyes.mood('calm');
        if (e.stT > 1.6) { setSt(e, 'walk'); e.cd = 1.8; }
      }
      m.tail.rotation.x = tail;
      m.tail.scale.setScalar(fluff);
      // cloud lifetime: grow 0.3 s, linger, shrink
      if (e.cloudT >= 0) {
        e.cloudT += dt;
        const T = 2.1, s = e.cloudT < 0.3 ? easeOut(e.cloudT / 0.3) : e.cloudT > T - 0.4 ? Math.max(0, (T - e.cloudT) / 0.4) : 1;
        const R = 1.25 * s;
        e.cloud.scale.setScalar(R + Math.sin(e.t * 6) * 0.04);
        e.cloud.rotation.y += dt * 0.8;
        e.cloud.position.y = e.cloudPos.y + e.cloudT * 0.15;
        if (e.cloudT > T) { e.cloudT = -1; e.cloud.visible = false; }
        else if (s > 0.4) {
          playerCenter(ctx.player, _a);
          if (_a.distanceTo(e.cloud.position) < R * 0.85 + 0.25) ctx.game.hurt('generic');
        }
      }
    },
  },

  // ---------------------------------------------------------------- rat: lab rat in a coat. Scurries, stands up ("!"), chases you inside its leash
  rat: {
    hw: 0.3, h: 0.6, patrol: { axis: 'x', range: 2, speed: 2.4 },
    init(e) { setSt(e, 'scurry'); e.cd = 0.5; e.lost = 0; },
    update(e, dt, ctx) {
      const m = e.m, d = e.def, leash = (e.patrol?.range ?? 2) + (d.leash ?? 2.5);
      e.cd -= dt;
      let stand = 0, legs = 20;
      if (e.st === 'scurry') {
        const dir = patrolStep(e, dt);
        if (e.patrol) e.yaw = turnTo(e.yaw, yawForAxis(e.patrol.axis, dir), dt * 8);
        showAlert(m.alert, -1);
        e.eyes.mood('calm');
        if (e.cd <= 0 && e.dist < 5 && Math.abs(e.dy) < 1.2 && !ctx.player.dead) { setSt(e, 'alert'); ctx.sfx('meow', { pos: e.pos, pitch: 2.6, vol: 0.5 }); }
      } else if (e.st === 'alert') {
        const k = clamp(e.stT / 0.45, 0, 1);
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 8);
        stand = -0.7 * Math.sin(k * Math.PI); legs = 0;
        showAlert(m.alert, k, e.t);
        e.eyes.mood('angry');
        if (k >= 1) setSt(e, 'chase');
      } else if (e.st === 'chase') {
        showAlert(m.alert, -1);
        e.yaw = turnTo(e.yaw, e.pyaw, dt * 6);
        const sp = 3.6 * dt;
        const nx = e.pos.x + Math.sin(e.yaw) * sp, nz = e.pos.z + Math.cos(e.yaw) * sp;
        const inLeash = Math.abs(nx - e.home.x) < leash && Math.abs(nz - e.home.z) < leash;
        const gy = inLeash ? walkable(e, ctx, nx, nz) : null;
        if (gy !== null) { e.pos.x = nx; e.pos.z = nz; e.pos.y = gy; e.lost = 0; } else { e.lost += dt; legs = 6; }
        if (e.dist > 7 || e.lost > 1.2 || ctx.player.dead) setSt(e, 'back');
      } else {
        _a.copy(e.home).sub(e.pos); _a.y = 0;
        const l = _a.length(), step = 2.4 * dt;
        e.eyes.mood('calm');
        if (l <= step) { e.pos.copy(e.home); e.pph = 0; setSt(e, 'scurry'); e.cd = 1.5; }
        else { e.pos.addScaledVector(_a, step / l); e.yaw = turnTo(e.yaw, Math.atan2(_a.x, _a.z), dt * 8); }
      }
      walkLegs(m.legs, e.t, legs, legs ? 0.7 : 0);
      for (let i = 0; i < m.tail.length; i++) m.tail[i].rotation.z = Math.sin(e.t * 8 - i) * 0.3;
      m.core.rotation.x = stand;
      m.head.rotation.x = Math.sin(e.t * 14) * 0.05;
    },
  },

  // ---------------------------------------------------------------- chicken: harmless gag. Runs around panicking; you bounce on it; spin = kicked "COT !"
  // params: range (3)
  chicken: {
    hw: 0.3, h: 0.7, harmless: true, word: 'COT COT !',
    init(e) { setSt(e, 'run'); e.turnT = 0; e.squish = 0; e.yaw = Math.random() * TAU; },
    touch(e, ctx, p, info) {
      if (info.fromAbove) {
        p.bounce(13);
        e.squish = 0.3;
        ctx.sfx('quack', { pos: e.pos, pitch: 1.3 });
        ctx.fx.burst(e.pos, [0xffffff, 0xfff1d0], 10, { speed: 3, gravity: 3, life: 1.1 });
        if (Math.random() < 0.5) ctx.fx.text(_a.copy(e.pos), 'COT !', '#ffffff', { scale: 0.6 });
      } else {
        e.yaw = e.pyaw + Math.PI; e.turnT = 0.8;
      }
    },
    update(e, dt, ctx) {
      const m = e.m, R = e.def.range ?? 3;
      const panic = e.dist < 3;
      e.turnT -= dt;
      if (e.turnT <= 0) {
        e.turnT = 0.3 + Math.random() * 0.7;
        const hx = e.home.x - e.pos.x, hz = e.home.z - e.pos.z;
        if (Math.hypot(hx, hz) > R) e.yaw = Math.atan2(hx, hz) + (Math.random() - 0.5);
        else if (panic) e.yaw = e.pyaw + Math.PI + (Math.random() - 0.5) * 1.5;
        else e.yaw += (Math.random() - 0.5) * 3;
        if (panic && Math.random() < 0.3) { ctx.sfx('quack', { pos: e.pos, pitch: 1.2 + Math.random() * 0.4, vol: 0.5 }); ctx.fx.burst(e.pos, 0xffffff, 3, { speed: 2, gravity: 2, life: 1 }); }
      }
      const sp = (panic ? 4.6 : 2.0) * dt;
      const nx = e.pos.x + Math.sin(e.yaw) * sp, nz = e.pos.z + Math.cos(e.yaw) * sp;
      const gy = walkable(e, ctx, nx + Math.sin(e.yaw) * 0.4, nz + Math.cos(e.yaw) * 0.4);
      if (gy === null) { e.yaw += Math.PI * (0.6 + Math.random() * 0.8); e.turnT = 0.4; }
      else { e.pos.x = nx; e.pos.z = nz; e.pos.y = gy; }
      walkLegs(m.legs, e.t, 26, 0.8);
      const f = Math.sin(e.t * (panic ? 30 : 12));
      for (const w of m.wings) w.w.rotation.z = w.sx * (0.3 + f * (panic ? 0.9 : 0.3));
      m.core.position.y = Math.abs(Math.sin(e.t * (panic ? 14 : 9))) * (panic ? 0.16 : 0.06);
      m.head.position.z = 0.2 + Math.max(0, Math.sin(e.t * 10)) * 0.05;
      e.squish = Math.max(0, e.squish - dt);
      const s = 1 - Math.sin((e.squish / 0.3) * Math.PI) * 0.45;
      e.model.scale.set(1 + (1 - s) * 0.8, s, 1 + (1 - s) * 0.8);
    },
  },
};

// ------------------------------------------------------------------ deaths (shared)
function startSquash(e, ctx) {
  if (e.state !== 'live') return;
  e.state = 'squash'; e.dT = 0; e.box = null;
  ctx.level.markGone(e.def.id);
  ctx.sfx('enemy_squash', { pos: e.pos });
  ctx.fx.burst(e.pos, [0xffffff, 0xffe26a], 10, { speed: 3.5, dy: 0.2 });
  ctx.fx.ring(e.pos, 0xffffff, 1.0);
  e.eyes?.mood('dizzy');
  showAlert(e.m.alert, -1);
  e.spec.onDie?.(e, ctx);
}
function startKick(e, ctx) {
  if (e.state !== 'live') return;
  e.state = 'kick'; e.dT = 0; e.box = null; e.splat = false;
  ctx.level.markGone(e.def.id);
  const h = e.spec.h;
  e.kFrom.copy(e.pos); e.kFrom.y += (e.spec.fly ? 0.3 : h * 0.5);
  e.model.position.y = -(e.spec.fly ? 0.3 : h * 0.5);
  e.kSide = (Math.random() - 0.5) * 0.7;
  e.kScale = clamp(1.05 / Math.max(h, e.spec.hw * 2), 0.5, 1.7);
  e.kSpin.set(8 + Math.random() * 6, 14 + Math.random() * 8, 3);
  ctx.sfx('enemy_kick', { pos: e.pos });
  ctx.fx.burst(e.kFrom, [0xffffff, 0xffe26a, 0x7ad7c4], 10, { speed: 5, dy: 0 });
  e.eyes?.mood('scared');
  showAlert(e.m.alert, -1);
  e.spec.onDie?.(e, ctx);
}
function startBlast(e, ctx) {
  if (e.state !== 'live') return;
  e.state = 'blast'; e.dT = 0; e.box = null;
  ctx.level.markGone(e.def.id);
  const cam = ctx.camera.position;
  _a.set(cam.x - e.pos.x, 0, cam.z - e.pos.z).normalize();
  e.kVel.set(_a.x * 3 + (Math.random() - 0.5) * 4, 11, _a.z * 3 + (Math.random() - 0.5) * 4);
  e.model.position.y = -e.spec.h * 0.5;
  e.body.position.y += e.spec.h * 0.5;
  ctx.fx.burst(e.pos, [0x5a4a4a, 0x2b2d42], 10, { speed: 4 });
  e.eyes?.mood('dizzy');
  e.spec.onDie?.(e, ctx);
}
function startPoof(e, ctx, delay = 0) {
  if (e.state !== 'live') return;
  e.state = 'poof'; e.dT = -delay; e.box = null;
  ctx.level.markGone(e.def.id);
  if (delay > 0) { e.kVel.set(0, 8, 0); }
  e.spec.onDie?.(e, ctx);
}

function updateDeath(e, dt, ctx) {
  e.dT += dt;
  if (e.m.blob && e.state !== 'squash') e.m.blob.visible = false;
  const b = e.body;
  if (e.state === 'squash') {
    const k = e.dT;
    const flat = k < 0.08 ? 1 - k / 0.08 * 0.85 : 0.15 + Math.sin(Math.min(1, (k - 0.08) / 0.2) * Math.PI) * 0.06;
    const wide = 1 + (1 - flat) * 0.6;
    const shrink = k > 0.7 ? Math.max(0, 1 - (k - 0.7) / 0.25) : 1;
    b.scale.set(wide * shrink, flat * shrink, wide * shrink);
    e.eyes?.update(dt);
    if (k > 0.95) finish(e);
  } else if (e.state === 'kick') {
    const cam = ctx.camera;
    cam.getWorldDirection(_a);                              // forward
    _b.set(0, 1, 0).applyQuaternion(cam.quaternion);         // screen up
    _d.set(1, 0, 0).applyQuaternion(cam.quaternion);         // screen right
    _c.copy(cam.position).addScaledVector(_a, 1.9).addScaledVector(_b, -0.05).addScaledVector(_d, e.kSide);
    const T1 = 0.42;
    if (e.dT < T1) {
      const k = e.dT / T1, kk = k * k * 0.55 + k * 0.45;
      b.position.lerpVectors(e.kFrom, _c, kk);
      b.position.y += Math.sin(k * Math.PI) * 1.3;
      b.rotation.x += dt * e.kSpin.x; b.rotation.y += dt * e.kSpin.y; b.rotation.z += dt * e.kSpin.z;
      b.scale.setScalar(lerp(1, e.kScale, k));
    } else {
      const k2 = e.dT - T1;
      if (!e.splat) {
        e.splat = true;
        ctx.sfx('enemy_hit', { pos: _c, vol: 1 });
        ctx.shake(0.22);
        _d.copy(cam.position).addScaledVector(_a, 3.4).addScaledVector(_b, 0.4);
        _d.y -= 1.4;
        ctx.fx.text(_d, e.spec.word ?? kickWord(), '#ffe26a', { scale: 0.95, life: 1.0 });
      }
      const slide = k2 > 0.35 ? (k2 - 0.35) * (k2 - 0.35) * 2.6 + (k2 - 0.35) * 0.2 : 0;
      b.position.copy(_c).addScaledVector(_b, -slide);
      b.lookAt(cam.position);
      b.rotateZ(Math.sin(k2 * 7) * 0.12 * Math.max(0, 1 - k2));
      const pop = k2 < 0.1 ? 1 + (0.1 - k2) * 3 : 1;
      b.scale.set(e.kScale * 1.35 * pop, e.kScale * 1.25 * pop, e.kScale * 0.3);
      if (k2 > 1.15) finish(e);
    }
  } else if (e.state === 'blast') {
    e.kVel.y -= 22 * dt;
    b.position.addScaledVector(e.kVel, dt);
    b.rotation.x += dt * 9; b.rotation.z += dt * 6;
    if (e.dT > 1.3) finish(e);
  } else if (e.state === 'poof') {
    if (e.dT < 0) { e.kVel.y -= 30 * dt; b.position.addScaledVector(e.kVel, dt); b.rotation.y += dt * 12; return; }
    if (!e.flag2) { e.flag2 = true; ctx.fx.burst(b.position, [0xffffff, 0xe0e8ff], 12, { speed: 3 }); }
    b.scale.setScalar(Math.max(0.001, 1 - e.dT / 0.2));
    if (e.dT > 0.2) finish(e);
  }
}
function finish(e) { e.dead = true; e.object3d.visible = false; }

// ------------------------------------------------------------------ factory
const DEFAULT_SPEC = SPECS.crab;

export function createEnemy(def, ctx) {
  let spec = SPECS[def.kind];
  if (!spec) { console.warn(`[enemies] unknown enemy kind "${def.kind}" → crab`); spec = DEFAULT_SPEC; }
  const kind = SPECS[def.kind] ? def.kind : 'crab';
  if (ctx.level?.isCommitted?.(def.id)) return null;
  const root = new THREE.Group();
  root.name = `enemy-${kind}-${def.id}`;
  const body = group(root);
  const model = group(body);
  const yaw0 = def.yaw ?? 0;
  const e = {
    object3d: root, body, model, def, kind, spec, m: {}, eyes: null,
    pos: new THREE.Vector3(def.x, def.y, def.z), home: new THREE.Vector3(def.x, def.y, def.z),
    yaw: yaw0, state: 'live', st: 'idle', stT: 0, t: Math.random() * 10, ph0: (def.phase ?? 0),
    dx: 0, dz: 0, dy: 0, dist: 99, pyaw: 0, cd: 0, blockT: 0, flag: false,
    pph: def.phase ?? 0,
    patrol: def.patrol ? { axis: def.patrol.axis === 'z' ? 'z' : 'x', range: def.patrol.range ?? 2, speed: def.patrol.speed ?? 1.5 }
      : (def.patrol === false || !spec.patrol ? null : { ...spec.patrol }),
    kFrom: new THREE.Vector3(), kVel: new THREE.Vector3(), kSpin: new THREE.Vector3(), kSide: 0, kScale: 1,
    _box: newBox(), box: null, dead: false, dT: 0,
  };
  e.box = e._box;
  // flyers: height above the ground below = def.fly, or def.y itself when the designer lifted it with `up`
  if (spec.fly) {
    const g = ctx.level?.world ? groundAt(ctx.level, def.x, def.z, def.y + 0.05, 40) : -Infinity;
    const gy = g > -Infinity ? g : def.y;
    e.flyBase = def.fly != null ? gy + def.fly : def.y - gy > 0.5 ? def.y : gy + spec.flyDefault;
  }
  MODELS[kind](e, ctx);
  if (def.scale) model.scale.setScalar(def.scale);
  if (!spec.fly) e.m.blob = blob(body, spec.hw * 1.15 * (def.scale ?? 1), (spec.hz ?? spec.hw) * 1.15 * (def.scale ?? 1));
  bake(model, `enemy:${kind}`, meshesOf(e.m));
  castShadows(model, ctx, 2);
  spec.setup?.(e, ctx);

  const resetVisual = () => {
    body.position.copy(e.pos); body.rotation.set(0, e.yaw, 0); body.scale.set(1, 1, 1);
    model.position.set(0, 0, 0); model.rotation.set(0, 0, 0); model.scale.setScalar(def.scale ?? 1);
    root.visible = true;
    if (e.m.blob) e.m.blob.visible = true;
    showAlert(e.m.alert, -1);
    if (e.m.stars) e.m.stars.visible = false;
    e.eyes?.mood(kind === 'chicken' ? 'scared' : kind === 'penguin' || kind === 'cactus' ? 'angry' : kind === 'camel' || kind === 'skunk' ? 'sneaky' : 'calm');
  };
  const syncBox = () => {
    if (spec.box) spec.box(e, e._box);
    else setBox(e._box, e.pos.x, e.pos.y, e.pos.z, spec.hw, spec.h, spec.hz ?? spec.hw);
  };
  spec.init?.(e, ctx);
  resetVisual();
  syncBox();

  const stompable = () => (spec.stompable ? spec.stompable(e) : true);
  const harmful = () => !spec.harmless && (spec.harmful ? spec.harmful(e) : true);

  Object.assign(e, {
    update(dt, c) {
      e.t += dt;
      if (e.state !== 'live') { updateDeath(e, dt, c); return; }
      const p = c.player;
      e.dx = p.pos.x - e.pos.x; e.dz = p.pos.z - e.pos.z; e.dy = p.pos.y - e.pos.y;
      e.dist = Math.hypot(e.dx, e.dz); e.pyaw = Math.atan2(e.dx, e.dz);
      e.stT += dt;
      e.blockT = Math.max(0, e.blockT - dt);
      spec.update(e, dt, c);
      if (e.state !== 'live') return;
      if (e.eyes) {
        e.eyes.update(dt);
        e.eyes.look(angDiff(e.yaw, e.pyaw), clamp((e.dy + 0.3) / Math.max(1, e.dist), -1, 1));
      }
      body.position.copy(e.pos);
      body.rotation.y = e.yaw;
      if (e.m.stars?.visible) e.m.stars.rotation.y += dt * 4;
      syncBox();
    },
    onTouch(player, c, info) {
      if (e.state !== 'live' || player.dead) return;
      if (spec.harmless) {
        if (player.invincible || player.spinning || player.sliding) { e.onSpin(player, c); return; }
        if (spec.caught && info.fromAbove) { spec.caught(e, c, player); return; }
        spec.touch?.(e, c, player, info);
        return;
      }
      if (player.invincible) { startKick(e, c); return; }
      if (player.spinning || player.sliding) {
        e.onSpin(player, c);
        if (e.state !== 'live' || e.blockT > 0) return;
      }
      if (info.fromAbove && player.vel.y <= 0.5) {
        if (stompable()) {
          if (spec.onStomp?.(e, c, player)) return;
          startSquash(e, c);
          player.bounce();
          return;
        }
        if (harmful()) { c.game.hurt(spec.cause ?? 'generic'); player.bounce(9); }
        return;
      }
      if (harmful() && e.blockT <= 0) c.game.hurt(spec.cause ?? 'generic');
    },
    onSpin(player, c) {
      if (e.state !== 'live') return;
      if (spec.caught) { spec.caught(e, c, null); return; }
      if (spec.spinBlocked?.(e) && !player.invincible) {
        // spiky: the spin bounces off (no damage either way) — "TOING"
        if (e.blockT > 0) return;
        e.blockT = 0.4;
        _a.set(player.pos.x - e.pos.x, 0, player.pos.z - e.pos.z);
        const l = _a.length() || 1;
        player.launch(_a.x / l * 7, 6, _a.z / l * 7);
        c.sfx('crate_iron', { pos: e.pos });
        c.fx.text(_b.copy(e.pos), 'TOING !', '#ffffff', { scale: 0.6 });
        return;
      }
      startKick(e, c);
    },
    onSlam(player, c) { if (e.state === 'live') { if (spec.caught) spec.caught(e, c, null); else startSquash(e, c); } },
    onExplode(c) { if (e.state === 'live') startBlast(e, c); },
    onRespawn(c) {
      if (c.level.isCommitted(def.id)) { e.dead = true; return; }
      e.state = 'live'; e.dead = false; e.box = e._box; e.flag2 = false;
      e.pos.copy(e.home); e.yaw = yaw0; e.pph = def.phase ?? 0; e.cd = 0; e.blockT = 0;
      setSt(e, 'idle');
      spec.init?.(e, c);
      resetVisual();
      syncBox();
    },
    dispose() { /* geometries & materials are shared (module cache) */ },
  });
  return e;
}

registerEntity('enemy', createEnemy);

export const ENEMY_KINDS = Object.keys(SPECS);
