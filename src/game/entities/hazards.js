// Hazards (agent Ennemis) — type 'hazard'. Also imports the chase boulder and the 'platform' type.
// All timed hazards use the LEVEL clock (ctx.time) so they stay in sync and are predictable:
// phase = (ctx.time + offset) mod period. Every dangerous phase is preceded by a readable warning phase.
import * as THREE from 'three';
import { registerEntity } from '../../core/registry.js';
import {
  _a, _b, _c, TAU, clamp, lerp, smooth, easeIn, part, group, mat, glow, seeThrough, newBox, setBox, makeEyes,
  groundAt, playerCenter, family, castShadows, bake,
} from './enemy-kit.js';
import { createBoulder } from './hazard-boulder.js';
import './hazard-platforms.js';

const phaseOf = (ctx, d, P) => ((((ctx.time + (d.offset ?? 0)) % P) + P) % P);
function overlapP(p, b) { return overlapB(p.box, b); }
function overlapB(pb, b) {
  return pb.min.x < b.max.x && pb.max.x > b.min.x && pb.min.y < b.max.y && pb.max.y > b.min.y && pb.min.z < b.max.z && pb.max.z > b.min.z;
}
const PAL = {
  island: { stone: 0x8a8f7a, metal: 0x6b6f7a, wood: 0x9a6a3a, dark: 0x3a3a3a, accent: 0xff7a3a },
  desert: { stone: 0xd9b27a, metal: 0x8a7a6a, wood: 0xa8733a, dark: 0x5a3a22, accent: 0x2a6fdb },
  ice: { stone: 0xb8d6ec, metal: 0x7a8fa8, wood: 0x8a6a5a, dark: 0x3a4a66, accent: 0x7ab8ff },
  factory: { stone: 0x7a8296, metal: 0x5c6b8a, wood: 0x6a5a4a, dark: 0x2b2d42, accent: 0xffd23f },
  golden: { stone: 0xe8c86a, metal: 0xc8a040, wood: 0xb8903a, dark: 0x6a5020, accent: 0xffffff },
};
const palOf = (ctx) => PAL[family(ctx.theme)] || PAL.island;

// ------------------------------------------------------------------ SPIKES (period 2.4, offset, w 2, d 1.2) — period 0 = always out
function spikes(def, ctx) {
  const pal = palOf(ctx), w = def.w ?? 2, d = def.d ?? 1.2, P = def.period ?? 2.4;
  const root = group(null, [def.x, def.y, def.z]);
  part(root, 'box', pal.dark, [w + 0.1, 0.06, d + 0.1], [0, 0.03, 0]);
  const holes = glow(0x111111);
  const pins = group(root);
  const nx = Math.max(1, Math.round(w / 0.4)), nz = Math.max(1, Math.round(d / 0.4));
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const x = -w / 2 + (i + 0.5) * (w / nx), z = -d / 2 + (j + 0.5) * (d / nz);
    part(root, 'cyl', holes, [0.09, 0.01, 0.09], [x, 0.065, z]);
    part(pins, 'cone4', 0xdfe6f0, [0.11, 0.6, 0.11], [x, 0.3, z], [0, Math.PI / 4, 0]);
  }
  const box = newBox();
  let hgt = 0, was = false;
  return {
    object3d: root, box,
    update(dt, c) {
      let target;
      if (!P) target = 1;
      else {
        const ph = phaseOf(c, def, P);
        if (ph < P * 0.5) target = 1;                                   // out
        else if (ph > P - 0.5) target = 0.22 + Math.abs(Math.sin(c.time * 40)) * 0.06; // warning: peeking + rattling
        else target = 0;
      }
      hgt += (target - hgt) * Math.min(1, dt * (target > hgt ? 30 : 12));
      pins.position.y = -0.62 + hgt * 0.62;
      const out = hgt > 0.6;
      if (out && !was && P) c.sfx('switch', { pos: _a.set(def.x, def.y, def.z), vol: 0.5, pitch: 1.6 });
      was = out;
      setBox(box, def.x, def.y, def.z, w / 2, 0.15 + hgt * 0.45, d / 2);
    },
    onTouch(p, c) { if (hgt > 0.6) c.game.hurt('generic'); },
  };
}

// ------------------------------------------------------------------ FIRE JET (period 3, offset, h 2.4)
function fireJet(def, ctx) {
  const pal = palOf(ctx), P = def.period ?? 3, H = def.h ?? 2.4;
  const root = group(null, [def.x, def.y, def.z]);
  part(root, 'cyl', pal.dark, [0.42, 0.12, 0.42], [0, 0.06, 0]);
  part(root, 'cyl', pal.metal, [0.3, 0.16, 0.3], [0, 0.1, 0]);
  part(root, 'cyl', glow(0x1a0a05), [0.2, 0.02, 0.2], [0, 0.19, 0]);
  const flame = group(root, [0, 0.18, 0]);
  const f1 = part(flame, 'cone', glow(0xff4a1a, 0.85, true), [0.42, 1, 0.42], [0, 0.5, 0]);
  const f2 = part(flame, 'cone', glow(0xffa21a, 0.9, true), [0.28, 0.8, 0.28], [0, 0.4, 0]);
  const f3 = part(flame, 'cone', glow(0xfff2a0), [0.14, 0.55, 0.14], [0, 0.27, 0]);
  flame.visible = false;
  const box = newBox();
  let on = false, k = 0;
  return {
    object3d: root, box, _keep: new Set([f1, f2, f3]),
    update(dt, c) {
      const ph = phaseOf(c, def, P);
      const nowOn = ph < P * 0.4, warn = ph > P - 0.55;
      if (nowOn && !on) c.sfx('fire', { pos: _a.set(def.x, def.y, def.z) });
      on = nowOn;
      const target = on ? 1 : warn ? 0.18 + Math.abs(Math.sin(c.time * 25)) * 0.12 : 0;
      k += (target - k) * Math.min(1, dt * (target > k ? 18 : 10));
      flame.visible = k > 0.03;
      const fl = 1 + Math.sin(c.time * 37) * 0.08 + Math.sin(c.time * 23) * 0.06;
      flame.scale.set(fl, H * k * fl, fl);
      f1.rotation.y += dt * 6; f2.rotation.y -= dt * 9;
      if (warn && Math.random() < dt * 10) c.fx.burst(_a.set(def.x, def.y + 0.2, def.z), 0x666666, 1, { speed: 1, up: 2, gravity: -2, life: 0.6 });
      setBox(box, def.x, def.y + 0.15, def.z, 0.35, Math.max(0.05, H * k), 0.35);
    },
    onTouch(p, c) { if (k > 0.55) c.game.hurt('burn'); },
  };
}

// ------------------------------------------------------------------ PENDULUM (length 3, speed 1.8 (rad/s), angle 1.05, axis 'x', offset (s) | phase (rad), r 0.7)
function pendulum(def, ctx) {
  const fam = family(ctx.theme), pal = palOf(ctx);
  const L = def.length ?? 3, R = def.r ?? 0.7, S = def.speed ?? 1.8, A = def.angle ?? 1.05;
  const pivotY = def.y + L + 0.85;
  const root = group(null, [def.x, pivotY, def.z]);
  if (def.axis === 'z') root.rotation.y = Math.PI / 2;
  // portal frame: crossbar over the swing + two posts just outside the arc (param frame = half span)
  const span = def.frame ?? (L * Math.sin(A) + R + 0.5);
  part(root, 'box', pal.wood, [span * 2 + 0.4, 0.35, 0.35], [0, 0.18, 0]);
  for (const sx of [-1, 1]) {
    part(root, 'box', pal.wood, [0.3, pivotY - def.y + 0.35, 0.3], [sx * span, 0.35 - (pivotY - def.y + 0.35) / 2, 0]);
    part(root, 'box', pal.dark, [0.5, 0.15, 0.5], [sx * span, def.y - pivotY + 0.07, 0]);
  }
  part(root, 'cyl', pal.metal, [0.1, 0.5, 0.1], [0, 0, 0], [Math.PI / 2, 0, 0]);
  const arm = group(root);
  part(arm, 'cyl', pal.dark, [0.06, L, 0.06], [0, -L / 2, 0]);
  for (let i = 1; i < 6; i++) part(arm, 'torus', pal.metal, [0.08, 0.08, 1], [0, -L * i / 6, 0], [0, i % 2 ? Math.PI / 2 : 0, 0]);
  const bob = group(arm, [0, -L, 0]);
  const BALL = fam === 'ice' ? 0xdfefff : fam === 'factory' ? 0x3a3f52 : fam === 'desert' ? 0xb07e3a : 0x6b5a4a;
  part(bob, 'sphere', BALL, R);
  for (let i = 0; i < 10; i++) {
    const u = i < 2 ? (i ? -1 : 1) : 0, a = (i - 2) / 8 * TAU;
    const n = _a.set(u ? 0 : Math.cos(a), u, u ? 0 : Math.sin(a));
    if (!u && i % 2) n.y = 0.5;
    n.normalize();
    const sp = part(bob, 'cone', 0xdfe6f0, [0.12, 0.36, 0.12], [n.x * R, n.y * R, n.z * R]);
    sp.quaternion.setFromUnitVectors(_b.set(0, 1, 0), n);
  }
  const eyes = makeEyes(bob, { r: 0.13, gap: 0.16, y: 0.08, z: R * 0.85, brows: 0x1c1640 });
  eyes.mood('angry');
  if (def.axis === 'z') { eyes.root.rotation.y = -Math.PI / 2; eyes.root.position.set(-R * 0.85, 0.08, 0); }
  const box = newBox(), bobPos = new THREE.Vector3();
  setBox(box, def.x, pivotY - L - R, def.z, L * Math.sin(A) + R, L + R, R);
  let lastSide = 0;
  return {
    object3d: root, box,
    update(dt, c) {
      const ph = (c.time + (def.offset ?? 0)) * S + (def.phase ?? 0);
      const ang = A * Math.sin(ph);
      arm.rotation.z = ang;
      eyes.update(dt);
      bob.rotation.z = -ang * 0.6;
      const lx = Math.sin(ang) * L, ly = -Math.cos(ang) * L;
      if (def.axis === 'z') bobPos.set(def.x, pivotY + ly, def.z - lx);
      else bobPos.set(def.x + lx, pivotY + ly, def.z);
      eyes.look(Math.sin(ang * 3), 0);
      const side = Math.sign(Math.sin(ph));
      if (side !== lastSide && Math.abs(c.player.pos.z - def.z) < 12) c.sfx('wind', { pos: bobPos, vol: 0.35, pitch: 1.4 });
      lastSide = side;
      const p = c.player;
      if (!p.dead) {
        playerCenter(p, _c);
        if (_c.distanceToSquared(bobPos) < (R + 0.45) * (R + 0.45)) c.game.hurt('generic');
      }
    },
  };
}

// ------------------------------------------------------------------ CRUSHER (period 3.4, offset, w 2, d 2, drop 2.6) — solid, rides you up, squashes you down
function crusher(def, ctx) {
  const fam = family(ctx.theme), pal = palOf(ctx);
  const w = def.w ?? 2, d = def.d ?? 2, hb = def.hb ?? 1.4, drop = def.drop ?? 2.6;
  const P = Math.max(1.6, def.period ?? 3.4);
  const root = group(null, [def.x, def.y + drop, def.z]);
  const COL = fam === 'ice' ? 0xa8d8f0 : fam === 'factory' ? 0x7a8296 : fam === 'desert' ? 0xd9b27a : 0x8a8f7a;
  const blk = group(root);
  part(blk, 'box', COL, [w, hb, d], [0, hb / 2, 0]);
  part(blk, 'box', pal.dark, [w + 0.06, 0.12, d + 0.06], [0, 0.06, 0]);
  if (fam === 'factory') for (let i = 0; i < 5; i++) part(blk, 'box', i % 2 ? 0x2b2d42 : 0xffd23f, [w / 5, 0.14, d + 0.08], [-w / 2 + (i + 0.5) * w / 5, hb - 0.1, 0]);
  else if (fam === 'desert') for (const x of [-0.3, 0, 0.3]) part(blk, 'ball', 0x2a6fdb, 0.06, [x * w, hb - 0.2, d / 2 + 0.02]);
  else part(blk, 'box', pal.dark, [w * 0.8, 0.06, d * 0.8], [0, hb + 0.01, 0]);
  part(root, 'cyl', pal.metal, [0.16, 8, 0.16], [0, hb + 4, 0]);
  const eyes = makeEyes(blk, { r: 0.16, gap: 0.27, y: hb * 0.62, z: d / 2 + 0.02, brows: pal.dark, pupil: 0.42 });
  eyes.mood('angry');
  const teeth = group(blk, [0, hb * 0.27, d / 2 + 0.02]);
  part(teeth, 'box', glow(0x1c1640), [w * 0.5, 0.2, 0.03]);
  for (let i = 0; i < 5; i++) part(teeth, 'box', glow(0xfffaf0), [w * 0.08, 0.12, 0.04], [-w * 0.2 + i * w * 0.1, 0.02, 0.01]);
  castShadows(root, ctx, 1);
  const box = newBox(), delta = { x: 0, y: 0, z: 0 };
  // short periods (2–3 s) compress warn/down/rise but keep the fall speed and a readable warning
  const kT = Math.min(1, (P * 0.72) / 2.3);
  const WARN = 0.6 * kT, FALL = 0.14, DOWN = 0.7 * kT, RISE = 1.0 * kT, UP = P - WARN - FALL - DOWN - RISE;
  let y = def.y + drop, wasDown = false;
  const e = {
    object3d: root, box, solid: true, delta,
    update(dt, c) {
      const ph = phaseOf(c, def, P);
      let ny, shake = 0, falling = false;
      if (ph < UP) ny = def.y + drop;
      else if (ph < UP + WARN) { ny = def.y + drop; shake = 0.04; }
      else if (ph < UP + WARN + FALL) { ny = lerp(def.y + drop, def.y, easeIn((ph - UP - WARN) / FALL)); falling = true; }
      else if (ph < UP + WARN + FALL + DOWN) ny = def.y;
      else ny = lerp(def.y, def.y + drop, smooth((ph - UP - WARN - FALL - DOWN) / RISE));
      delta.y = ny - y; delta.x = 0; delta.z = 0;
      if (Math.abs(delta.y) > 1.5) delta.y = 0;
      y = ny;
      root.position.y = y;
      blk.position.x = Math.sin(c.time * 60) * shake;
      eyes.update(dt);
      eyes.look(0, -0.8);
      if (shake && Math.random() < dt * 8) c.fx.burst(_a.set(def.x + (Math.random() - 0.5) * w, y, def.z + (Math.random() - 0.5) * d), pal.stone, 1, { speed: 0.5, up: -2, life: 0.8 });
      setBox(box, def.x, y, def.z, w / 2, hb, d / 2);
      const down = ny <= def.y + 0.01;
      if (down && !wasDown) {
        c.sfx('slam', { pos: _a.set(def.x, def.y, def.z) });
        const dist = Math.hypot(c.player.pos.x - def.x, c.player.pos.z - def.z);
        if (dist < 9) c.shake(0.35 * (1 - dist / 9) + 0.05);
        c.fx.burst(_a.set(def.x, def.y, def.z), pal.stone, 10, { speed: 3, dy: 0 });
      }
      wasDown = down;
      // squash check: player under the block footprint while it comes down
      const p = c.player;
      if ((falling || (down && delta.y < 0)) && !p.dead) {
        const m = 0.12;
        if (p.pos.x > box.min.x + m - 0.3 && p.pos.x < box.max.x - m + 0.3 && p.pos.z > box.min.z + m - 0.3 && p.pos.z < box.max.z - m + 0.3 &&
          p.pos.y < box.min.y && p.pos.y + 1.0 > box.min.y) c.game.kill('squash');
      }
    },
  };
  return e;
}

// ------------------------------------------------------------------ LASER fence (axis 'x', width 4, period 0 = always, offset, h 0.55)
function laser(def, ctx) {
  const pal = palOf(ctx), W = def.width ?? 4, H = def.h ?? 0.55, P = def.period ?? 0;
  const alongZ = def.axis === 'z';
  const root = group(null, [def.x, def.y, def.z], [0, alongZ ? Math.PI / 2 : 0, 0]);
  for (const sx of [-1, 1]) {
    const post = group(root, [sx * (W / 2 + 0.15), 0, 0]);
    part(post, 'box', pal.metal, [0.22, H + 0.5, 0.22], [0, (H + 0.5) / 2, 0]);
    part(post, 'box', 0xffd23f, [0.24, 0.08, 0.24], [0, H + 0.45, 0]);
    part(post, 'ball', glow(0xff3a3a), 0.09, [-sx * 0.12, H, 0]);
  }
  const beam = group(root, [0, H, 0]);
  const outer = part(beam, 'cyl', glow(0xff2a4a, 0.5, true), [0.1, W, 0.1], null, [0, 0, Math.PI / 2]);
  const core = part(beam, 'cyl', glow(0xffe0e0), [0.035, W, 0.035], null, [0, 0, Math.PI / 2]);
  const box = newBox();
  if (alongZ) setBox(box, def.x, def.y + H - 0.09, def.z, 0.09, 0.18, W / 2);
  else setBox(box, def.x, def.y + H - 0.09, def.z, W / 2, 0.18, 0.09);
  let on = true, was = false;
  return {
    object3d: root, box, _keep: new Set([outer, core]),
    update(dt, c) {
      let warn = false;
      if (P) {
        const ph = phaseOf(c, def, P);
        on = ph < P * 0.5; warn = !on && ph > P - 0.6;
      }
      if (on && !was && P && Math.abs(c.player.pos.z - def.z) < 15) c.sfx('laser', { pos: _a.set(def.x, def.y, def.z), vol: 0.6 });
      was = on;
      beam.visible = on || (warn && Math.sin(c.time * 40) > 0);
      outer.visible = on;
      core.scale.x = on ? 0.035 + Math.sin(c.time * 60) * 0.006 : 0.012;
      core.scale.z = core.scale.x;
      outer.scale.x = outer.scale.z = 0.1 + Math.sin(c.time * 45) * 0.02;
    },
    onTouch(p, c) { if (on) c.game.hurt('zap'); },
  };
}

// ------------------------------------------------------------------ WATER / LAVA (w, d) — surface at def.y; you die when your feet go 0.25 m under
const WATER_COL = { island: 0x3fc1c9, desert: 0x2a8fdb, ice: 0x8fd3ff, factory: 0x7be05a, golden: 0xffe08a };
function liquid(def, ctx, lava) {
  const fam = family(ctx.theme), w = def.w ?? 4, d = def.d ?? 4;
  const root = group(null, [def.x, def.y, def.z]);
  const col = lava ? 0xff6a1a : (def.color ?? WATER_COL[fam] ?? 0x3fc1c9);
  const surf = part(root, 'plane', lava ? glow(0xff5a10) : seeThrough(col, 0.78, 0x0a1a22), [w, d, 1], [0, -0.02, 0], [-Math.PI / 2, 0, 0]);
  const shine = part(root, 'plane', lava ? glow(0xffc23a, 0.55, true) : seeThrough(0xffffff, 0.18), [w * 0.92, d * 0.92, 1], [0, 0.0, 0], [-Math.PI / 2, 0, 0]);
  const spots = [];
  const n = Math.min(10, Math.max(2, Math.round(w * d / 6)));
  for (let i = 0; i < n; i++) {
    const s = part(root, lava ? 'sphere' : 'disc', lava ? mat(0x7a1a05) : seeThrough(0xffffff, 0.35),
      lava ? [0.25, 0.08, 0.25] : 0.2, [(Math.random() - 0.5) * w * 0.85, 0.01, (Math.random() - 0.5) * d * 0.85], lava ? null : [-Math.PI / 2, 0, 0]);
    s.userData.ph = Math.random() * TAU;
    spots.push(s);
  }
  const box = newBox();
  setBox(box, def.x, def.y - 30, def.z, w / 2, 30 - 0.25, d / 2);
  return {
    object3d: root, box, _noBake: true,
    update(dt, c) {
      const t = c.time;
      surf.position.y = -0.02 + Math.sin(t * 1.3) * 0.03;
      shine.position.y = surf.position.y + 0.01;
      shine.scale.set(w * (0.9 + Math.sin(t * 0.8) * 0.04), d * (0.9 + Math.cos(t * 0.7) * 0.04), 1);
      for (const s of spots) {
        const k = (Math.sin(t * (lava ? 2.2 : 1.1) + s.userData.ph) + 1) / 2;
        s.scale.setScalar(lava ? 0.1 + k * 0.25 : 0.1 + k * 0.3);
        if (lava) s.scale.y = 0.06 + k * 0.08;
        s.position.y = surf.position.y + 0.02;
      }
      if (lava && Math.random() < dt * 2 && Math.abs(c.player.pos.z - def.z) < 25) {
        c.fx.burst(_a.set(def.x + (Math.random() - 0.5) * w, def.y, def.z + (Math.random() - 0.5) * d), [0xffc23a, 0xff5a10], 3, { speed: 1.5, up: 3, life: 0.8 });
      }
    },
    onTouch(p, c) {
      if (p.dead) return;
      c.fx.burst(_a.set(p.pos.x, def.y, p.pos.z), lava ? [0xffc23a, 0xff5a10] : [0xffffff, col], 14, { speed: 4, up: 4 });
      c.sfx(lava ? 'fire' : 'splash', { pos: p.pos });
      c.game.kill(lava ? 'burn' : 'water');
    },
  };
}

// ------------------------------------------------------------------ SAW (patrol {axis,range,speed} | path [[dx,dy,dz]…] + speed, r 0.6)
function saw(def, ctx) {
  const pal = palOf(ctx), R = def.r ?? 0.6;
  const root = group(null);
  const cy = def.y + R * 0.75;
  // waypoints (relative offsets, world axes); patrol → two ends
  const pts = [];
  if (Array.isArray(def.path) && def.path.length) {
    pts.push(new THREE.Vector3(def.x, cy, def.z));
    for (const p of def.path) {
      const [dx, dy, dz] = Array.isArray(p) ? p : [p.x ?? 0, p.y ?? 0, p.z ?? 0];
      pts.push(new THREE.Vector3(def.x + dx, cy + dy, def.z + dz));
    }
  } else {
    const pa = def.patrol ?? { axis: 'x', range: 2, speed: 2.5 };
    const r = pa.range ?? 2;
    pts.push(new THREE.Vector3(def.x - (pa.axis === 'z' ? 0 : r), cy, def.z - (pa.axis === 'z' ? r : 0)));
    pts.push(new THREE.Vector3(def.x + (pa.axis === 'z' ? 0 : r), cy, def.z + (pa.axis === 'z' ? r : 0)));
  }
  const speed = def.speed ?? def.patrol?.speed ?? 2.5;
  // slots on the ground
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    const len = Math.hypot(b.x - a.x, b.z - a.z);
    if (len < 0.05) continue;
    part(root, 'box', glow(0x1a1a22), [0.12, 0.02, len + 0.2], [(a.x + b.x) / 2, Math.min(a.y, b.y) - R * 0.75 + 0.015, (a.z + b.z) / 2], [0, Math.atan2(b.x - a.x, b.z - a.z), 0]);
  }
  const holder = group(root);
  const spin = group(holder);
  part(spin, 'saw', 0xdfe6f0, [R, R, 0.06]);
  part(spin, 'cyl', pal.dark, [R * 0.35, 0.1, R * 0.35], null, [Math.PI / 2, 0, 0]);
  part(spin, 'cyl', 0xffd23f, [R * 0.15, 0.12, R * 0.15], null, [Math.PI / 2, 0, 0]);
  // segment lengths for ping-pong travel
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length - 1; i++) { const l = pts[i].distanceTo(pts[i + 1]); segs.push(l); total += l; }
  const box = newBox(), pos = new THREE.Vector3().copy(pts[0]);
  let s = (def.phase ?? 0) * total, dir = 1;
  return {
    object3d: root, box,
    update(dt, c) {
      if (total > 0.01) {
        s += dir * speed * dt;
        if (s > total) { s = total; dir = -1; } else if (s < 0) { s = 0; dir = 1; }
        let acc = 0, i = 0;
        while (i < segs.length - 1 && acc + segs[i] < s) { acc += segs[i]; i++; }
        const k = segs[i] > 0 ? (s - acc) / segs[i] : 0;
        pos.lerpVectors(pts[i], pts[i + 1], k);
        holder.rotation.y = Math.atan2(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z) - Math.PI / 2;
      }
      holder.position.copy(pos);
      spin.rotation.z -= dt * 18 * dir;
      if (Math.random() < dt * 6) c.fx.burst(_a.set(pos.x, pos.y - R * 0.7, pos.z), 0xffd23f, 1, { speed: 2.5, dy: 0, life: 0.3 });
      setBox(box, pos.x, pos.y - R, pos.z, R * 0.8, R * 1.8, R * 0.8);
    },
    onTouch(p, c) { c.game.hurt('generic'); },
  };
}

// ------------------------------------------------------------------ BARRELS launcher (interval 2.2, speed 5, dir {x,z} (default {x:0,z:1} = towards the level start), range 30)
function barrels(def, ctx) {
  const fam = family(ctx.theme), pal = palOf(ctx);
  const root = group(null);
  const dir = new THREE.Vector3(def.dir?.x ?? 0, 0, def.dir?.z ?? 1).normalize();
  const yaw = Math.atan2(dir.x, dir.z);
  const base = group(root, [def.x, def.y, def.z], [0, yaw, 0]);
  // chute + a pile of barrels behind it
  part(base, 'box', pal.wood, [1.6, 0.2, 1.8], [0, 0.4, -0.2], [0.15, 0, 0]);
  for (const sx of [-1, 1]) part(base, 'box', pal.wood, [0.12, 0.5, 1.8], [sx * 0.78, 0.6, -0.2], [0.15, 0, 0]);
  const BAR = fam === 'factory' ? 0x2a6fdb : fam === 'desert' ? 0xc0643a : fam === 'ice' ? 0x9a7a5a : 0x9a6a3a;
  const HOOP = fam === 'factory' ? 0xffd23f : fam === 'desert' ? 0x2a6fdb : 0x4a3a2a;
  const makeBarrel = () => {
    const g = new THREE.Group();
    const r = new THREE.Group(); g.add(r); g.userData.roll = r;
    part(r, 'cyl', BAR, [0.45, 0.9, 0.45], null, [0, 0, Math.PI / 2]);
    for (const x of [-0.3, 0.3]) part(r, 'cyl', HOOP, [0.47, 0.07, 0.47], [x, 0, 0], [0, 0, Math.PI / 2]);
    part(r, 'cyl', glow(0x2a1a0a), [0.3, 0.92, 0.3], null, [0, 0, Math.PI / 2]);
    if (fam === 'ice') part(r, 'dome', 0xffffff, [0.4, 0.15, 0.4], [0, 0.36, 0]);
    return g;
  };
  for (const [x, y, z] of [[-0.5, 0.45, -1.4], [0.5, 0.45, -1.4], [0, 1.25, -1.4]]) {
    const b = makeBarrel(); b.position.set(x, y, z); b.rotation.y = 0; base.add(b);
  }
  const peek = makeBarrel(); peek.position.set(0, 0.95, -0.9); base.add(peek);
  const eyes = makeEyes(peek, { r: 0.1, gap: 0.14, y: 0.05, z: 0.44, brows: 0x2a1a0a });
  eyes.mood('angry');
  const N = 5, list = [];
  for (let i = 0; i < N; i++) {
    const mesh = makeBarrel(); mesh.visible = false; root.add(mesh);
    mesh.rotation.y = yaw;
    list.push({ mesh, on: false, pos: new THREE.Vector3(), vy: 0, travel: 0, box: newBox() });
  }
  const interval = def.interval ?? 2.2, speed = def.speed ?? 5, range = def.range ?? 30;
  const box = newBox();
  setBox(box, def.x, def.y, def.z, 1.2, 2, 1.2);
  let timer = def.offset ?? 0.8;
  const kill = (b, c, burst = true) => {
    b.on = false; b.mesh.visible = false;
    if (burst) { c.fx.burst(b.pos, [BAR, HOOP, 0xffe2ac], 12, { speed: 4 }); c.sfx('crate_break', { pos: b.pos }); }
  };
  return {
    object3d: root, box,
    update(dt, c) {
      timer -= dt;
      const warn = timer < 0.5;
      peek.position.z = -0.9 + (warn ? 0.25 + Math.sin(c.time * 40) * 0.04 : 0);
      peek.position.x = warn ? Math.sin(c.time * 50) * 0.03 : 0;
      eyes.update(dt);
      const near = Math.hypot(c.player.pos.x - def.x, c.player.pos.z - def.z) < (def.trigger ?? 40);
      if (timer <= 0) {
        timer = interval;
        if (near) {
          const b = list.find((x) => !x.on) || list[0];
          b.on = true; b.travel = 0; b.vy = 0;
          b.pos.set(def.x + dir.x * 0.6, def.y + 0.75, def.z + dir.z * 0.6);
          b.mesh.visible = true;
          c.sfx('crate_bounce', { pos: b.pos, pitch: 0.6 });
        }
      }
      const p = c.player;
      for (const b of list) {
        if (!b.on) continue;
        const step = speed * dt;
        b.pos.x += dir.x * step; b.pos.z += dir.z * step; b.travel += step;
        const g = groundAt(c.level, b.pos.x, b.pos.z, b.pos.y - 0.45 + 0.35, 0.8);
        if (g > -Infinity && b.vy <= 0) { b.pos.y = g + 0.45; b.vy = 0; }
        else { b.vy -= 25 * dt; b.pos.y += b.vy * dt; }
        b.mesh.position.copy(b.pos);
        b.mesh.userData.roll.rotation.x += step / 0.45;
        if (b.travel > range || b.pos.y < def.y - 15) { kill(b, c, false); continue; }
        setBox(b.box, b.pos.x, b.pos.y - 0.45, b.pos.z, 0.5, 0.9, 0.5);
        if (p.dead) continue;
        if ((p.spinning || p.sliding) && overlapB(p.getSpinBox(), b.box)) { kill(b, c); c.sfx('enemy_kick'); continue; }
        if (overlapP(p, b.box)) {
          if (p.vel.y < 0.5 && p.pos.y > b.pos.y) { p.bounce(); kill(b, c); }
          else { c.game.hurt('squash'); kill(b, c); }
        }
      }
    },
    onRespawn() { for (const b of list) { b.on = false; b.mesh.visible = false; } timer = def.offset ?? 0.8; },
  };
}

// ------------------------------------------------------------------ WIND zone (w 4, d 6, h 4, force {x,z} world m/s)
function wind(def, ctx) {
  const fam = family(ctx.theme), w = def.w ?? 4, d = def.d ?? 6, h = def.h ?? 4;
  const fx = def.force?.x ?? 0, fz = def.force?.z ?? 0, F = Math.hypot(fx, fz) || 1;
  const ux = fx / F, uz = fz / F;
  const root = group(null);
  const box = newBox();
  setBox(box, def.x, def.y, def.z, w / 2, h, d / 2);
  // streaks
  const COL = fam === 'desert' ? 0xf0d9a0 : fam === 'ice' ? 0xffffff : fam === 'factory' ? 0xcfe6ff : 0xffffff;
  const streakMat = glow(COL, 0.45, true);
  const n = Math.min(18, Math.max(6, Math.round(w * d * 0.5)));
  const streaks = [];
  for (let i = 0; i < n; i++) {
    const s = part(root, 'box', streakMat, [0.03, 0.03, 0.7 + Math.random() * 0.6]);
    s.rotation.y = Math.atan2(ux, uz);
    s.userData.k = Math.random();
    s.userData.o = [(Math.random() - 0.5) * w, def.y + 0.2 + Math.random() * h * 0.8, (Math.random() - 0.5) * d];
    streaks.push(s);
  }
  // the blower at the upstream edge: a fan in the factory, a puffing cloud face elsewhere
  const ex = def.x - ux * (Math.abs(ux) * w / 2 + 0.6), ez = def.z - uz * (Math.abs(uz) * d / 2 + 0.6);
  const blower = group(root, [ex, def.y + Math.min(h * 0.45, 1.6), ez], [0, Math.atan2(ux, uz), 0]);
  let blades = null, cheeks = null;
  if (fam === 'factory') {
    part(blower, 'torus', 0x5c6b8a, [0.9, 0.9, 1.2]);
    part(blower, 'box', 0x5c6b8a, [0.16, 1.6, 0.16], [0, -0.9, 0]);
    blades = group(blower);
    for (let i = 0; i < 4; i++) part(blades, 'box', 0xdfe6f0, [0.22, 0.75, 0.04], [Math.cos(i * Math.PI / 2) * 0.4, Math.sin(i * Math.PI / 2) * 0.4, 0], [0, 0.3, i * Math.PI / 2]);
    part(blower, 'cyl', 0xffd23f, [0.15, 0.15, 0.15], null, [Math.PI / 2, 0, 0]);
  } else {
    const CL = fam === 'desert' ? 0xf5e6c8 : 0xffffff;
    for (const [x, y, s] of [[0, 0, 0.75], [-0.6, -0.1, 0.5], [0.6, -0.05, 0.55], [0.25, 0.45, 0.45], [-0.3, 0.4, 0.42]]) part(blower, 'sphere', CL, s, [x, y, -0.2]);
    const eyes = makeEyes(blower, { r: 0.12, gap: 0.18, y: 0.2, z: 0.45, brows: 0x6a7a9a });
    eyes.mood('angry');
    cheeks = [part(blower, 'sphere', 0xffc0c8, 0.2, [-0.33, -0.08, 0.38]), part(blower, 'sphere', 0xffc0c8, 0.2, [0.33, -0.08, 0.38])];
    part(blower, 'torus', glow(0x1c1640), [0.1, 0.1, 0.5], [0, -0.2, 0.55]);
  }
  let sfxT = 0;
  return {
    object3d: root, box, _keep: new Set([...streaks, ...(cheeks || [])]),
    update(dt, c) {
      for (const s of streaks) {
        const u = s.userData;
        u.k += dt * F * 0.12;
        if (u.k > 1) { u.k -= 1; u.o[0] = (Math.random() - 0.5) * w; u.o[2] = (Math.random() - 0.5) * d; }
        const along = (u.k - 0.5);
        s.position.set(def.x + u.o[0] * Math.abs(uz) + ux * along * w, u.o[1], def.z + u.o[2] * Math.abs(ux) + uz * along * d);
        s.scale.x = s.scale.y = 0.03 * Math.sin(u.k * Math.PI) + 0.005;
      }
      if (blades) blades.rotation.z += dt * F * 3;
      if (cheeks) for (const ch of cheeks) ch.scale.setScalar(0.2 + Math.sin(c.time * 6) * 0.03);
      sfxT -= dt;
    },
    onTouch(p, c) {
      p.ext.x += fx; p.ext.z += fz;
      if (sfxT <= 0) { sfxT = 1.3; c.sfx('wind', { pos: p.pos, vol: 0.5 }); }
    },
  };
}

// ------------------------------------------------------------------ registry
const HAZARDS = {
  spikes, fireJet, pendulum, crusher, laser, saw, barrels, wind,
  water: (d, c) => liquid(d, c, false), lava: (d, c) => liquid(d, c, true),
  boulder: createBoulder,
};
export const HAZARD_KINDS = Object.keys(HAZARDS);

registerEntity('hazard', (def, ctx) => {
  const f = HAZARDS[def.kind];
  if (!f) { console.warn(`[hazards] unknown hazard kind "${def.kind}"`); return null; }
  const e = f(def, ctx);
  if (!e) return null;
  // merge static sub-meshes (per instance: sizes vary) → far fewer draw calls; free them on dispose
  const baked = e._noBake ? [] : bake(e.object3d, null, e._keep);
  const own = e.dispose;
  e.dispose = () => { own?.(); for (const g of baked) g.dispose(); };
  return e;
});
