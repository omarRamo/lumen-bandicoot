// Platforms (agent Ennemis) — type 'platform', all SOLID. Convention = the CONTRACT: def.y is the BOTTOM of the platform,
// the collision box spans [def.y, def.y + h] (so `up: -h` = flush with the floor). Size params w, h, d (builder defaults 2 × 0.5 × 2).
// (Internally the factories below work with the TOP surface: the registry wrapper converts.)
//   moving    to:{x,y,z} (world delta, builder converts lat/up/fwd), period (4 s), offset (s)  → sinusoidal, sets `delta`
//   falling   delay (0.5 s): shakes once stood on, then drops; back on respawn. respawnAfter (0 = only on respawn)
//   sinking   lily pad: sink (0.4 m/s), depth (1.6 m), rise (0.8 m/s). Put a 'water' hazard with its surface at the pad top
//   bouncy    power (18): mushroom / pouf / cloud / spring by world. Hold jump for the full height
//   rotating  w/d → radius, speed (1 rad/s, sign = direction): carries Lumen around the centre
//   vanishing period (3 s), offset (s): solid 55 % of the cycle (blinks before vanishing), ghost outline while gone
// Everything uses the LEVEL clock (ctx.time) so platforms stay in sync with each other.
import * as THREE from 'three';
import { registerEntity } from '../../core/registry.js';
import { _a, TAU, part, group, glow, seeThrough, newBox, setBox, makeEyes, family, castShadows, bake } from './enemy-kit.js';

const COLORS = {
  island: { slab: 0x9a6a3a, top: 0xb98a52, dark: 0x5a3a22, crack: 0x3a2a1a, accent: 0x3fa55a, glow: 0xd8ff8a },
  desert: { slab: 0xd9b27a, top: 0xe8c890, dark: 0x8a6a3a, crack: 0x6a4a2a, accent: 0x2a6fdb, glow: 0x7ad7ff },
  ice: { slab: 0xa8d8f0, top: 0xf4f8ff, dark: 0x5a7fa6, crack: 0x3a5a86, accent: 0x7ab8ff, glow: 0x9fffe0 },
  factory: { slab: 0x5c6b8a, top: 0x8a96aa, dark: 0x2b2d42, crack: 0x1c1640, accent: 0xffd23f, glow: 0x6af0ff },
  golden: { slab: 0xc8a040, top: 0xffd76a, dark: 0x8a6a20, crack: 0x6a5020, accent: 0xffffff, glow: 0xfff1a0 },
};
const palOf = (ctx) => COLORS[family(ctx.theme)] || COLORS.island;
const phase01 = (ctx, def, P) => ((((ctx.time + (def.offset ?? 0)) % P) + P) % P) / P;

function boxFor(b, x, top, z, w, h, d) { return setBox(b, x, top - h, z, w / 2, h, d / 2); }

// ------------------------------------------------------------------ visuals
function carpet(root, w, h, d) {
  const g = group(root);
  part(g, 'box', 0xc0392b, [w, 0.1, d], [0, -0.05, 0]);
  part(g, 'box', 0xffd23f, [w * 0.86, 0.105, d * 0.86], [0, -0.05, 0]);
  part(g, 'box', 0x8e1f2a, [w * 0.78, 0.11, d * 0.78], [0, -0.05, 0]);
  part(g, 'box', 0x2a6fdb, [w * 0.3, 0.115, d * 0.3], [0, -0.05, 0], [0, Math.PI / 4, 0]);
  for (const sz of [-1, 1]) for (let i = 0; i < 6; i++) part(g, 'cone4', 0xffd23f, [0.05, 0.16, 0.05], [-w / 2 + (i + 0.5) * w / 6, -0.12, sz * (d / 2 + 0.02)], [Math.PI, 0, 0]);
  return g;
}
function slab(root, pal, w, h, d, fam, kind) {
  const g = group(root);
  if (kind === 'moving' && fam === 'desert') return carpet(root, w, h, d);
  if (kind === 'moving' && fam === 'island') {
    const n = Math.max(2, Math.round(d / 0.45));
    for (let i = 0; i < n; i++) part(g, 'cyl', i % 2 ? pal.slab : pal.top, [0.22, w, 0.22], [0, -0.22, -d / 2 + (i + 0.5) * d / n], [0, 0, Math.PI / 2]);
    for (const x of [-w * 0.35, w * 0.35]) part(g, 'box', 0xe8d8a8, [0.08, 0.46, d + 0.04], [x, -0.22, 0]);
    return g;
  }
  part(g, 'box', pal.slab, [w, h, d], [0, -h / 2, 0]);
  part(g, 'box', pal.top, [w + 0.04, 0.08, d + 0.04], [0, -0.04, 0]);
  if (fam === 'factory') {
    for (let i = 0; i < 4; i++) part(g, 'box', i % 2 ? 0x2b2d42 : 0xffd23f, [w / 4, 0.05, 0.12], [-w / 2 + (i + 0.5) * w / 4, 0.0, d / 2 - 0.06]);
    if (kind === 'moving') for (const sx of [-1, 1]) part(g, 'cone', glow(0x6af0ff, 0.7, true), [0.15, 0.35, 0.15], [sx * w * 0.3, -h - 0.15, 0], [Math.PI, 0, 0]);
  } else if (fam === 'island') {
    part(g, 'sphere', pal.accent, [w * 0.18, 0.05, d * 0.15], [w * 0.25, 0.0, -d * 0.2]);
    part(g, 'sphere', pal.accent, [w * 0.12, 0.05, d * 0.1], [-w * 0.3, 0.0, d * 0.25]);
  } else if (fam === 'desert') {
    for (const sx of [-1, 1]) part(g, 'box', pal.accent, [0.1, 0.09, d * 0.8], [sx * w * 0.38, -0.04, 0]);
  } else if (fam === 'ice') {
    part(g, 'dome', 0xffffff, [w * 0.45, 0.12, d * 0.45], [0, 0, 0]);
  }
  return g;
}

// ------------------------------------------------------------------ MOVING
function moving(def, ctx) {
  const pal = palOf(ctx), fam = family(ctx.theme);
  const w = def.w ?? 2, h = def.h ?? 0.5, d = def.d ?? 2, P = def.period ?? 4;
  const to = { x: def.to?.x ?? 0, y: def.to?.y ?? 0, z: def.to?.z ?? 0 };
  const root = group(null, [def.x, def.y, def.z]);
  const vis = slab(root, pal, w, h, d, fam, 'moving');
  const box = newBox(), delta = { x: 0, y: 0, z: 0 };
  const cur = new THREE.Vector3(def.x, def.y, def.z);
  let init = false;
  const place = (t) => {
    const k = 0.5 - 0.5 * Math.cos(((t + (def.offset ?? 0)) / P) * TAU);
    return _a.set(def.x + to.x * k, def.y + to.y * k, def.z + to.z * k);
  };
  boxFor(box, def.x, def.y, def.z, w, h, d);
  return {
    object3d: root, box, solid: true, delta,
    update(dt, c) {
      const n = place(c.time);
      if (!init) { cur.copy(n); init = true; }
      delta.x = n.x - cur.x; delta.y = n.y - cur.y; delta.z = n.z - cur.z;
      if (Math.abs(delta.x) + Math.abs(delta.y) + Math.abs(delta.z) > 2) { delta.x = delta.y = delta.z = 0; }
      cur.copy(n);
      root.position.copy(cur);
      if (fam === 'desert') { vis.rotation.x = Math.sin(c.time * 3) * 0.03; vis.rotation.z = Math.sin(c.time * 2.3) * 0.03; }
      boxFor(box, cur.x, cur.y, cur.z, w, h, d);
    },
  };
}

// ------------------------------------------------------------------ FALLING
function falling(def, ctx) {
  const pal = palOf(ctx), fam = family(ctx.theme);
  const w = def.w ?? 2, h = def.h ?? 0.5, d = def.d ?? 2, delay = def.delay ?? 0.5;
  const root = group(null, [def.x, def.y, def.z]);
  const vis = slab(root, pal, w, h, d, fam, 'falling');
  for (const [x, z, r, l] of [[0.1, 0.1, 0.5, 0.8], [-0.25, -0.1, -0.7, 0.6], [0.3, -0.25, 1.4, 0.5]]) {
    part(vis, 'box', glow(pal.crack), [0.04, 0.02, l * Math.min(w, d) * 0.6], [x * w, 0.005, z * d], [0, r, 0]);
  }
  const box = newBox(), delta = { x: 0, y: 0, z: 0 };
  let st = 'idle', t = 0, y = def.y, vy = 0;
  const e = {
    object3d: root, box, solid: true, delta, intangible: false,
    update(dt, c) {
      delta.x = delta.y = delta.z = 0;
      const on = c.player.groundSolid?.__owner === e && c.player.grounded;
      if (st === 'idle' && on) { st = 'shake'; t = 0; c.sfx('crumble', { pos: _a.set(def.x, def.y, def.z) }); }
      if (st === 'shake') {
        t += dt;
        vis.position.x = Math.sin(t * 70) * 0.05 * (0.5 + t / delay);
        vis.position.z = Math.cos(t * 60) * 0.03;
        if (Math.random() < dt * 15) c.fx.burst(_a.set(def.x + (Math.random() - 0.5) * w, def.y - h, def.z + (Math.random() - 0.5) * d), pal.slab, 1, { speed: 0.5, up: -1, life: 0.6 });
        if (t >= delay) { st = 'fall'; t = 0; vy = 0; }
      } else if (st === 'fall') {
        t += dt;
        vy = Math.min(30, vy + 22 * dt);
        delta.y = -vy * dt;
        y += delta.y;
        vis.position.x = 0;
        vis.rotation.z = Math.min(0.6, t * 0.8);
        vis.rotation.x = Math.min(0.3, t * 0.4);
        if (y < def.y - 30) {
          st = 'gone'; t = 0; root.visible = false; e.intangible = true;
        }
      } else if (st === 'gone') {
        t += dt;
        if (def.respawnAfter && t > def.respawnAfter) e.onRespawn(c);
      }
      root.position.set(def.x, y, def.z);
      boxFor(box, def.x, y, def.z, w, h, d);
    },
    onRespawn(c) {
      st = 'idle'; t = 0; y = def.y; vy = 0; e.intangible = false; root.visible = true;
      vis.position.set(0, 0, 0); vis.rotation.set(0, 0, 0);
      root.position.set(def.x, y, def.z);
      boxFor(box, def.x, y, def.z, w, h, d);
      if (c && Math.hypot(c.player.pos.x - def.x, c.player.pos.z - def.z) < 20) c.fx?.ring?.(_a.set(def.x, def.y, def.z), pal.top, 1.2);
    },
  };
  boxFor(box, def.x, def.y, def.z, w, h, d);
  return e;
}

// ------------------------------------------------------------------ SINKING (lily pad / ice floe)
function sinking(def, ctx) {
  const fam = family(ctx.theme);
  const w = def.w ?? 2, h = def.h ?? 0.5, d = def.d ?? 2, r = Math.max(w, d) / 2;
  const root = group(null, [def.x, def.y, def.z]);
  const vis = group(root);
  if (fam === 'ice') {
    part(vis, 'cyl6', seeThrough(0xcfeeff, 0.92), [r, 0.3, r], [0, -0.15, 0]);
    part(vis, 'cyl6', 0xffffff, [r * 0.8, 0.05, r * 0.8], [0, 0.0, 0]);
  } else {
    part(vis, 'cyl20', 0x3fa55a, [r, 0.1, r], [0, -0.05, 0]);
    part(vis, 'cyl20', 0x5cc46a, [r * 0.92, 0.105, r * 0.92], [0, -0.05, 0]);
    part(vis, 'box', glow(0x2a7a40), [r * 0.55, 0.11, 0.12], [r * 0.7, -0.05, 0]); // the notch
    for (let i = 0; i < 6; i++) part(vis, 'box', 0x3a9a50, [0.04, 0.11, r * 0.85], [Math.sin(i * 1.05) * r * 0.42, -0.045, Math.cos(i * 1.05) * r * 0.42], [0, i * 1.05, 0]);
    const fl = group(vis, [-r * 0.45, 0.02, -r * 0.35]);
    for (let i = 0; i < 6; i++) part(fl, 'cone4', 0xff8fc8, [0.1, 0.28, 0.06], [Math.cos(i * 1.05) * 0.08, 0.1, Math.sin(i * 1.05) * 0.08], [Math.sin(i * 1.05) * 0.5, 0, -Math.cos(i * 1.05) * 0.5]);
    part(fl, 'ball', glow(0xffd23f), 0.06, [0, 0.08, 0]);
  }
  const ripple = part(root, 'ring', glow(0xffffff, 0.5, true), r, [0, 0.03, 0], [-Math.PI / 2, 0, 0]);
  ripple.userData.noBake = true;
  ripple.visible = false;
  const box = newBox(), delta = { x: 0, y: 0, z: 0 };
  const sink = def.sink ?? 0.4, depth = def.depth ?? 1.6, rise = def.rise ?? 0.8;
  let off = 0, dip = 0, rt = 0, wasOn = false;
  const e = {
    object3d: root, box, solid: true, delta,
    update(dt, c) {
      const on = c.player.groundSolid?.__owner === e && c.player.grounded;
      if (on && !wasOn) { dip = 0.12; c.sfx('splash', { pos: c.player.pos, vol: 0.4 }); }
      wasOn = on;
      const prev = off;
      if (on) off = Math.max(-depth, off - sink * dt);
      else off = Math.min(0, off + rise * dt);
      dip = Math.max(0, dip - dt * 0.6);
      const visOff = off - Math.sin((dip / 0.12) * Math.PI) * 0.05;
      delta.x = 0; delta.z = 0; delta.y = off - prev;
      root.position.set(def.x, def.y + off, def.z);
      vis.position.y = visOff - off;
      vis.rotation.y += dt * 0.05;
      ripple.visible = on || dip > 0;
      if (ripple.visible) { rt = (rt + dt * 1.4) % 1; ripple.scale.setScalar(r * (1 + rt * 0.6)); ripple.position.y = -off + 0.02; }
      boxFor(box, def.x, def.y + off, def.z, Math.min(w, r * 1.6), h, Math.min(d, r * 1.6));
    },
    onRespawn() { off = 0; dip = 0; root.position.set(def.x, def.y, def.z); boxFor(box, def.x, def.y, def.z, Math.min(w, r * 1.6), h, Math.min(d, r * 1.6)); },
  };
  boxFor(box, def.x, def.y, def.z, Math.min(w, r * 1.6), h, Math.min(d, r * 1.6));
  return e;
}

// ------------------------------------------------------------------ BOUNCY
function bouncy(def, ctx) {
  const fam = family(ctx.theme);
  const style = def.style || (fam === 'desert' ? 'pouf' : fam === 'ice' ? 'cloud' : fam === 'factory' ? 'spring' : fam === 'golden' ? 'cloud' : 'mushroom');
  const w = def.w ?? 2, h = def.h ?? 0.5, d = def.d ?? 2, r = Math.max(w, d) / 2;
  const root = group(null, [def.x, def.y, def.z]);
  const cap = group(root);
  let face = null;
  if (style === 'mushroom') {
    part(cap, 'dome', 0xe8322f, [r * 1.05, 0.65, r * 1.05], [0, -0.65, 0]);
    part(cap, 'cyl20', 0xfff1d0, [r * 0.98, 0.08, r * 0.98], [0, -0.66, 0]);
    for (const [x, y, z, s] of [[0, -0.02, 0, 0.22], [0.55, -0.22, 0.3, 0.17], [-0.5, -0.25, 0.35, 0.16], [0.2, -0.28, -0.6, 0.18], [-0.45, -0.2, -0.35, 0.15]]) {
      part(cap, 'sphere', 0xffffff, [s * r, 0.06, s * r], [x * r, y, z * r]);
    }
    const stemH = def.stem ?? 1.6;
    part(root, 'cyl', 0xfff1d0, [r * 0.32, stemH, r * 0.32], [0, -0.66 - stemH / 2, 0]);
    face = makeEyes(root, { r: 0.1, gap: 0.12, y: -0.95, z: r * 0.3, brows: 0xc0a080 });
    part(root, 'box', glow(0x1c1640), [0.12, 0.025, 0.02], [0, -1.15, r * 0.32]);
  } else if (style === 'pouf') {
    part(cap, 'cyl20', 0xc8743a, [r, 0.6, r], [0, -0.32, 0]);
    part(cap, 'dome', 0xd98a4a, [r, 0.12, r], [0, -0.02, 0]);
    part(cap, 'torus', 0xffd23f, [r * 0.98, r * 0.98, 0.6], [0, -0.3, 0], [Math.PI / 2, 0, 0]);
    for (let i = 0; i < 8; i++) part(cap, 'ball', 0x2a6fdb, 0.06, [Math.cos(i * TAU / 8) * r * 1.0, -0.45, Math.sin(i * TAU / 8) * r * 1.0]);
    part(cap, 'cyl6', 0x2a6fdb, [r * 0.3, 0.13, r * 0.3], [0, 0.0, 0]);
  } else if (style === 'cloud') {
    const C = fam === 'golden' ? 0xfff1a0 : 0xffffff;
    for (const [x, y, z, s] of [[0, -0.25, 0, 0.7], [0.55, -0.3, 0.2, 0.5], [-0.55, -0.3, -0.1, 0.55], [0.15, -0.3, -0.55, 0.45], [-0.2, -0.3, 0.55, 0.45]]) {
      part(cap, 'sphere', C, [s * r, s * 0.55, s * r], [x * r, y, z * r]);
    }
    face = makeEyes(cap, { r: 0.1, gap: 0.13, y: -0.25, z: r * 0.62 });
    for (const sx of [-1, 1]) part(cap, 'sphere', glow(0xffb0c0, 0.7), [0.09, 0.05, 0.02], [sx * 0.24, -0.38, r * 0.6]);
  } else {
    part(cap, 'box', 0xffd23f, [w * 0.9, 0.12, d * 0.9], [0, -0.06, 0]);
    part(cap, 'box', 0x2b2d42, [w * 0.6, 0.125, 0.1], [0, -0.06, 0]);
    for (let i = 0; i < 4; i++) part(root, 'torus', 0x8a96aa, [r * 0.45, r * 0.45, 1.5], [0, -0.2 - i * 0.1, 0], [Math.PI / 2, 0, 0]);
    part(root, 'box', 0x5c6b8a, [w, 0.1, d], [0, -h + 0.05, 0]);
  }
  const box = newBox();
  boxFor(box, def.x, def.y, def.z, w * 0.9, h, d * 0.9);
  let squish = 0;
  return {
    object3d: root, box, solid: true,
    update(dt, c) {
      squish = Math.max(0, squish - dt);
      const k = squish / 0.35;
      const s = 1 - Math.sin(k * Math.PI) * 0.35 * k;
      cap.scale.set(1 + (1 - s) * 0.5, s, 1 + (1 - s) * 0.5);
      if (face) { face.update(dt); face.mood(squish > 0 ? 'scared' : 'calm'); }
      if (style === 'cloud') cap.position.y = Math.sin(c.time * 1.6) * 0.05;
    },
    onLand(p, c) {
      p.bounce(def.power ?? 18);
      squish = 0.35;
      c.sfx('spring', { pos: p.pos });
      c.fx.ring(_a.set(def.x, def.y, def.z), 0xffffff, 1.2);
    },
  };
}

// ------------------------------------------------------------------ ROTATING (disc)
function rotating(def, ctx) {
  const pal = palOf(ctx), fam = family(ctx.theme);
  const w = def.w ?? 3, h = def.h ?? 0.5, d = def.d ?? 3, r = Math.max(w, d) / 2, S = def.speed ?? 1;
  const root = group(null, [def.x, def.y, def.z]);
  const disc = group(root);
  if (fam === 'factory') {
    part(disc, 'cyl20', 0x8a96aa, [r, h, r], [0, -h / 2, 0]);
    for (let i = 0; i < 14; i++) part(disc, 'box', 0x5c6b8a, [0.3, h * 0.9, 0.3], [Math.cos(i * TAU / 14) * (r + 0.08), -h / 2, Math.sin(i * TAU / 14) * (r + 0.08)], [0, -i * TAU / 14, 0]);
    part(disc, 'cyl', 0xffd23f, [r * 0.25, 0.04, r * 0.25], [0, 0.01, 0]);
  } else {
    const BASE = fam === 'desert' ? 0xf5f0e0 : pal.slab;
    part(disc, 'cyl20', BASE, [r, h, r], [0, -h / 2, 0]);
    const rings = fam === 'desert' ? [0x2a6fdb, 0xffd23f, 0x2a6fdb] : fam === 'ice' ? [0xffffff, 0x7ab8ff, 0xffffff] : [pal.dark, pal.top, pal.accent];
    rings.forEach((col, i) => part(disc, 'torusThin', col, [r * (0.9 - i * 0.28), r * (0.9 - i * 0.28), 1.2], [0, 0.01, 0], [Math.PI / 2, 0, 0]));
  }
  // arrows so the rotation reads
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4;
    part(disc, 'cone4', fam === 'factory' ? 0x2b2d42 : pal.accent, [0.14, 0.4, 0.04], [Math.cos(a) * r * 0.62, 0.02, Math.sin(a) * r * 0.62], [Math.PI / 2, 0, -a + (S > 0 ? Math.PI : 0)]);
  }
  part(disc, 'cyl', pal.dark, [0.2, 0.06, 0.2], [0, 0.02, 0]);
  part(root, 'cyl', pal.dark, [0.25, 3, 0.25], [0, -h - 1.5, 0]);
  const box = newBox(), delta = { x: 0, y: 0, z: 0 };
  const half = r * 0.82;
  setBox(box, def.x, def.y - h, def.z, half, h, half);
  const e = {
    object3d: root, box, solid: true, delta,
    update(dt, c) {
      const a = S * dt;
      disc.rotation.y += a;
      delta.x = delta.y = delta.z = 0;
      const p = c.player;
      if (p.grounded && p.groundSolid?.__owner === e) {
        const x = p.pos.x - def.x, z = p.pos.z - def.z;
        const ca = Math.cos(a), sa = Math.sin(a);
        delta.x = (x * ca + z * sa) - x;
        delta.z = (-x * sa + z * ca) - z;
      }
    },
  };
  return e;
}

// ------------------------------------------------------------------ VANISHING
function vanishing(def, ctx) {
  const pal = palOf(ctx), fam = family(ctx.theme);
  const w = def.w ?? 2, h = def.h ?? 0.5, d = def.d ?? 2, P = def.period ?? 3;
  const root = group(null, [def.x, def.y, def.z]);
  const main = group(root);
  const TILE = { island: 0xd8ff8a, desert: 0x2a6fdb, ice: 0x9fffe0, factory: 0x6af0ff, golden: 0xffd76a }[fam] ?? 0xd8ff8a;
  part(main, 'box', seeThrough(TILE, 0.85, 0x223322), [w, h, d], [0, -h / 2, 0]);
  part(main, 'box', glow(0xffffff, 0.8), [w * 0.7, 0.03, d * 0.7], [0, 0.005, 0]);
  if (fam === 'desert') for (const [x, z] of [[-0.25, -0.25], [0.25, 0.25], [-0.25, 0.25], [0.25, -0.25]]) part(main, 'box', glow(0xffd23f), [w * 0.18, 0.04, d * 0.18], [x * w, 0.01, z * d], [0, Math.PI / 4, 0]);
  else for (let i = 0; i < 3; i++) part(main, 'box', glow(TILE), [w * 0.9, 0.035, 0.05], [0, 0.01, -d * 0.3 + i * d * 0.3]);
  const ghost = group(root);
  const edge = glow(TILE, 0.55, true);
  for (const sz of [-1, 1]) part(ghost, 'box', edge, [w, 0.04, 0.04], [0, 0, sz * d / 2]);
  for (const sx of [-1, 1]) part(ghost, 'box', edge, [0.04, 0.04, d], [sx * w / 2, 0, 0]);
  part(ghost, 'box', seeThrough(TILE, 0.12), [w, h, d], [0, -h / 2, 0]);
  ghost.visible = false;
  const box = newBox();
  boxFor(box, def.x, def.y, def.z, w, h, d);
  let solidNow = true;
  const e = {
    object3d: root, box, solid: true, intangible: false,
    update(dt, c) {
      const k = phase01(c, def, P);
      const solidPh = k < 0.55;
      const blink = k > 0.4 && k < 0.55;
      main.visible = solidPh && !(blink && Math.floor(c.time * 14) % 2 === 0);
      ghost.visible = !solidPh;
      if (!solidPh) ghost.scale.setScalar(k > 0.88 ? 1 + Math.sin(c.time * 30) * 0.03 : 1);
      if (solidPh !== solidNow) {
        solidNow = solidPh;
        e.intangible = !solidPh;
        const near = Math.hypot(c.player.pos.x - def.x, c.player.pos.z - def.z) < 14;
        if (near) c.sfx(solidPh ? 'outline_on' : 'crumble', { pos: _a.set(def.x, def.y, def.z), vol: 0.4 });
        if (near && !solidPh) c.fx.burst(_a.set(def.x, def.y - h / 2, def.z), [TILE, 0xffffff], 8, { speed: 2, dy: 0 });
      }
      main.position.y = solidPh ? 0 : -0.1;
    },
  };
  return e;
}

const PLATFORMS = { moving, falling, sinking, bouncy, rotating, vanishing };
export const PLATFORM_KINDS = Object.keys(PLATFORMS);

registerEntity('platform', (def, ctx) => {
  const f = PLATFORMS[def.kind];
  if (!f) { console.warn(`[platforms] unknown platform kind "${def.kind}" → moving`); }
  const top = { ...def, y: def.y + (def.h ?? 0.5) };
  const e = (f || moving)(top, ctx);
  castShadows(e.object3d, ctx, 1, true);
  const baked = bake(e.object3d);
  e.dispose = () => { for (const g of baked) g.dispose(); };
  return e;
});
