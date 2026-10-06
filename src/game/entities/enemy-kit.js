// Shared toolkit for enemies / hazards / platforms (agent Ennemis).
// Everything here is cached at module level: unit geometries scaled per mesh, one material per colour.
// No per-frame allocation: use the exported temp vectors (_a, _b, _c…) inside update() code.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { groundBelow } from '../../core/physics.js';

// ------------------------------------------------------------------ temps
export const _a = new THREE.Vector3();
export const _b = new THREE.Vector3();
export const _c = new THREE.Vector3();
export const _d = new THREE.Vector3();
export const _q = new THREE.Quaternion();
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, k) => a + (b - a) * k;
export const smooth = (k) => k * k * (3 - 2 * k);
export const easeOut = (k) => 1 - (1 - k) * (1 - k);
export const easeIn = (k) => k * k;
export function angDiff(a, b) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return d; }
export function turnTo(cur, target, maxStep) { const d = angDiff(cur, target); return cur + clamp(d, -maxStep, maxStep); }

// ------------------------------------------------------------------ geometry cache (unit primitives)
const GEO = new Map();
export function geo(key) {
  let g = GEO.get(key);
  if (g) return g;
  switch (key) {
    case 'sphere': g = new THREE.IcosahedronGeometry(1, 1); break;
    case 'ico': g = new THREE.IcosahedronGeometry(1, 0); break;
    case 'ball': g = new THREE.SphereGeometry(1, 14, 10); break;            // smooth (eyes, moon)
    case 'dome': g = new THREE.SphereGeometry(1, 12, 6, 0, TAU, 0, Math.PI / 2); break;
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'cyl': g = new THREE.CylinderGeometry(1, 1, 1, 12); break;
    case 'cyl6': g = new THREE.CylinderGeometry(1, 1, 1, 6); break;
    case 'cyl20': g = new THREE.CylinderGeometry(1, 1, 1, 22); break;
    case 'cone': g = new THREE.ConeGeometry(1, 1, 8); break;
    case 'cone4': g = new THREE.ConeGeometry(1, 1, 4); break;
    case 'cone16': g = new THREE.ConeGeometry(1, 1, 16); break;
    case 'torus': g = new THREE.TorusGeometry(1, 0.22, 6, 16); break;
    case 'torusThin': g = new THREE.TorusGeometry(1, 0.08, 4, 20); break;
    case 'halfTorus': g = new THREE.TorusGeometry(1, 0.22, 6, 10, Math.PI); break;
    case 'plane': g = new THREE.PlaneGeometry(1, 1); break;
    case 'disc': g = new THREE.CircleGeometry(1, 20); break;
    case 'ring': g = new THREE.RingGeometry(0.75, 1, 24); break;
    case 'saw': {
      // flat toothed disc in the XY plane, thickness 1 along Z (scale it)
      const s = new THREE.Shape();
      const n = 14;
      for (let i = 0; i < n * 2; i++) {
        const a = (i / (n * 2)) * TAU, r = i % 2 ? 0.78 : 1;
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
      }
      const hole = new THREE.Path(); hole.absarc(0, 0, 0.18, 0, TAU, true); s.holes.push(hole);
      g = new THREE.ExtrudeGeometry(s, { depth: 1, bevelEnabled: false, curveSegments: 6 });
      g.translate(0, 0, -0.5);
      break;
    }
    case 'blade': {
      // crescent axe blade in XY plane
      const s = new THREE.Shape();
      s.moveTo(0, 0.5); s.quadraticCurveTo(0.9, 0, 0, -0.5); s.quadraticCurveTo(0.35, 0, 0, 0.5);
      g = new THREE.ExtrudeGeometry(s, { depth: 0.12, bevelEnabled: false, curveSegments: 6 });
      g.translate(0, 0, -0.06);
      break;
    }
    default: throw new Error(`[enemy-kit] unknown geo ${key}`);
  }
  GEO.set(key, g);
  return g;
}

// ------------------------------------------------------------------ material cache
const MATS = new Map();
/** Flat-shaded Lambert (cheap, low-poly look). */
export function mat(color) {
  const k = `l${color}`;
  let m = MATS.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color, flatShading: true }); MATS.set(k, m); }
  return m;
}
/** Smooth Lambert (eyes, moon). */
export function smoothMat(color) {
  const k = `s${color}`;
  let m = MATS.get(k);
  if (!m) { m = new THREE.MeshLambertMaterial({ color }); MATS.set(k, m); }
  return m;
}
/** Unlit, bright (eyes whites, glows, lasers, fire). */
export function glow(color, opacity = 1, additive = false) {
  const k = `g${color}_${opacity}_${additive}`;
  let m = MATS.get(k);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: opacity < 1 || additive, opacity,
      depthWrite: !(opacity < 1 || additive), blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending });
    MATS.set(k, m);
  }
  return m;
}
/** Translucent lit material (water, clouds, ghosts). */
export function seeThrough(color, opacity, emissive = 0) {
  const k = `t${color}_${opacity}_${emissive}`;
  let m = MATS.get(k);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, transparent: true, opacity, depthWrite: false, emissive, flatShading: true });
    MATS.set(k, m);
  }
  return m;
}
const resolveMat = (m) => (typeof m === 'number' ? mat(m) : m);

/** Add a mesh of a cached unit geometry. s = [sx,sy,sz] | number, p = [x,y,z], r = [rx,ry,rz]. */
export function part(parent, g, m, s = 1, p = null, r = null) {
  const mesh = new THREE.Mesh(geo(g), resolveMat(m));
  if (typeof s === 'number') mesh.scale.setScalar(s); else mesh.scale.set(s[0], s[1], s[2]);
  if (p) mesh.position.set(p[0], p[1], p[2]);
  if (r) mesh.rotation.set(r[0], r[1], r[2]);
  parent.add(mesh);
  return mesh;
}
export function group(parent, p = null, r = null) {
  const g = new THREE.Group();
  if (p) g.position.set(p[0], p[1], p[2]);
  if (r) g.rotation.set(r[0], r[1], r[2]);
  parent?.add(g);
  return g;
}

// ------------------------------------------------------------------ bake: fewer draw calls
const BAKED = new Map();
/**
 * Merge static leaf meshes that share a parent and a material into one mesh (≈ 3× fewer draw calls).
 * Meshes in `keep`, meshes with children, hidden meshes and anything under a node with userData.noBake stay untouched.
 * With a `key` the merged geometries are cached and shared by every instance (the model must be deterministic);
 * without, the created geometries are returned so the caller can dispose them.
 */
export function bake(root, key = null, keep = null) {
  const created = [];
  let idx = 0;
  const visit = (node) => {
    const i = idx++;
    if (node.userData.noBake) return;
    const kids = node.children.slice();
    for (const c of kids) if (!c.isMesh || c.children.length) visit(c);
    const byMat = new Map();
    for (const c of kids) {
      if (!c.isMesh || c.children.length || !c.visible || keep?.has(c) || c.userData.noBake) continue;
      let arr = byMat.get(c.material);
      if (!arr) byMat.set(c.material, (arr = []));
      arr.push(c);
    }
    for (const [m, arr] of byMat) {
      if (arr.length < 2) continue;
      const ck = key ? `${key}#${i}#${m.uuid}#${arr.length}` : null;
      let g = ck ? BAKED.get(ck) : null;
      if (!g) {
        const parts = arr.map((mesh) => {
          mesh.updateMatrix();
          const gg = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
          gg.clearGroups();
          return gg.applyMatrix4(mesh.matrix);
        });
        g = mergeGeometries(parts, false);
        for (const p of parts) p.dispose();
        if (ck) BAKED.set(ck, g); else created.push(g);
      }
      for (const mesh of arr) node.remove(mesh);
      const merged = new THREE.Mesh(g, m);
      merged.renderOrder = arr[0].renderOrder;
      node.add(merged);
    }
  };
  visit(root);
  return created;
}
/** Every Mesh referenced from an object of parts (values or arrays). */
export function meshesOf(obj) {
  const set = new Set();
  for (const v of Object.values(obj)) {
    if (v?.isMesh) set.add(v);
    else if (Array.isArray(v)) for (const x of v) if (x?.isMesh) set.add(x);
  }
  return set;
}

// ------------------------------------------------------------------ eyes (the soul of every enemy)
/**
 * A pair of googly eyes. opts: { r, gap, y, z, pupil (0..1), color (white), lids (body colour or null), brows (colour or null) }
 * Returns { root, look(yawRel, pitch), blink(dt), mood(name) } — mood ∈ calm | angry | scared | dizzy | sneaky
 */
export function makeEyes(parent, opts = {}) {
  const r = opts.r ?? 0.12, gap = opts.gap ?? 0.13, slit = opts.slit ?? 1;
  const root = group(parent, [0, opts.y ?? 0.5, opts.z ?? 0.3]);
  root.userData.noBake = true;
  const eyes = [], pupils = [], brows = [], lids = [];
  for (const sx of [-1, 1]) {
    const eye = group(root, [sx * gap, 0, 0]);
    part(eye, 'ball', glow(opts.color ?? 0xffffff), [r, r * (opts.tall ?? 1.15), r * 0.8]);
    const pr = r * (opts.pupil ?? 0.48);
    const pupil = part(eye, 'ball', glow(0x14102a), [pr * slit, pr * 1.15, pr * 0.5], [0, 0, r * 0.68]);
    part(pupil, 'ball', glow(0xffffff), [0.32, 0.32, 0.4], [0.35, 0.4, 0.6]); // catch-light
    if (opts.lids != null) {
      const lid = part(eye, 'dome', mat(opts.lids), [r * 1.08, r * 1.08, r * 0.9], [0, 0, 0], [-0.25, 0, 0]);
      lid.visible = false;
      lids.push(lid);
    }
    if (opts.brows != null) {
      const b = part(root, 'box', mat(opts.brows), [r * 1.5, r * 0.32, r * 0.35], [sx * gap, r * 1.45, r * 0.4]);
      b.userData.sx = sx;
      brows.push(b);
    }
    eyes.push(eye); pupils.push(pupil);
  }
  let blinkT = 1 + Math.random() * 3, closed = 0, moodName = 'calm', dizzyT = 0;
  const api = {
    root, eyes, pupils,
    /** yawRel = angle of the target relative to the face (rad, + = to the model's left/+X), pitch + = up */
    look(yawRel, pitch = 0) {
      if (moodName === 'dizzy') return;
      const px = clamp(Math.sin(yawRel), -1, 1) * r * 0.42, py = clamp(pitch, -1, 1) * r * 0.35;
      for (const p of pupils) { p.position.x = px; p.position.y = py; }
    },
    update(dt) {
      blinkT -= dt;
      if (blinkT <= 0) { closed = 0.12; blinkT = 1.8 + Math.random() * 3.5; }
      if (closed > 0) closed -= dt;
      const sy = closed > 0 ? 0.12 : 1;
      for (const e of eyes) e.scale.y += (sy - e.scale.y) * Math.min(1, dt * 30);
      if (moodName === 'dizzy') {
        dizzyT += dt * 9;
        pupils.forEach((p, i) => { p.position.x = Math.cos(dizzyT + i * 3) * r * 0.35; p.position.y = Math.sin(dizzyT + i * 3) * r * 0.35; });
      }
    },
    mood(name) {
      if (name === moodName) return;
      moodName = name;
      const big = name === 'scared' ? 1.25 : name === 'angry' ? 0.95 : 1;
      for (const e of eyes) e.scale.x = e.scale.z = big;
      const pupilS = name === 'scared' ? 0.55 : name === 'angry' ? 1.15 : 1;
      const pr = r * (opts.pupil ?? 0.48);
      for (const p of pupils) p.scale.set(pr * pupilS * slit, pr * 1.15 * pupilS, pr * 0.5);
      for (const b of brows) {
        const sx = b.userData.sx;
        b.rotation.z = name === 'angry' ? -sx * 0.5 : name === 'scared' ? sx * 0.45 : name === 'sneaky' ? -sx * 0.2 : 0;
        b.position.y = r * (name === 'scared' ? 1.75 : name === 'angry' ? 1.2 : 1.45);
      }
      for (const l of lids) { l.visible = name === 'sneaky' || name === 'angry'; l.rotation.x = name === 'sneaky' ? 0.05 : -0.35; }
    },
  };
  return api;
}

/** Bright "!" telegraph marker (shown during anticipation). */
export function makeAlert(parent, y) {
  const g = group(parent, [0, y, 0]);
  part(g, 'box', glow(0xffd23f), [0.12, 0.34, 0.12], [0, 0.22, 0]);
  part(g, 'ball', glow(0xffd23f), 0.075, [0, -0.06, 0]);
  part(g, 'box', glow(0x1c1640), [0.18, 0.4, 0.06], [0, 0.2, -0.04]);
  part(g, 'ball', glow(0x1c1640), [0.11, 0.11, 0.06], [0, -0.06, -0.04]);
  g.visible = false;
  return g;
}
/** Animate the alert marker (pop + wobble). k = 0..1 progress of the anticipation, or < 0 to hide. */
export function showAlert(alert, k, t) {
  if (k < 0) { alert.visible = false; return; }
  alert.visible = true;
  const s = k < 0.2 ? easeOut(k / 0.2) * 1.3 : 1 + Math.sin(t * 30) * 0.08;
  alert.scale.setScalar(s);
  alert.rotation.z = Math.sin(t * 24) * 0.15;
}

/** Ring of yellow stars over a dizzy head. */
export function makeStars(parent, y, r = 0.3) {
  const g = group(parent, [0, y, 0]);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    part(g, 'ico', glow(0xffe26a), 0.07, [Math.cos(a) * r, 0, Math.sin(a) * r]);
  }
  g.visible = false;
  return g;
}

/** Real shadows only for big things and only when the quality allows it. */
export function castShadows(obj, ctx, minLevel = 1, receive = false) {
  if (!ctx?.quality?.shadows || (ctx.quality.level ?? 0) < minLevel) return;
  obj.traverse((o) => { if (o.isMesh && !o.material.transparent) { o.castShadow = true; if (receive) o.receiveShadow = true; } });
}
/** Cheap blob shadow (shared material). */
export function blob(parent, rx, rz) {
  const m = part(parent, 'disc', glow(0x000000, 0.22), [rx, rz, 1], [0, 0.035, 0], [-Math.PI / 2, 0, 0]);
  m.renderOrder = 1;
  return m;
}

// ------------------------------------------------------------------ ground probe
export function groundAt(level, x, z, fromY, maxDown = 6) {
  return groundBelow(level.world, x, z, fromY, maxDown);
}

// ------------------------------------------------------------------ box helpers
export function newBox() { return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }; }
export function setBox(b, x, y, z, hx, h, hz) {
  b.min.x = x - hx; b.max.x = x + hx; b.min.y = y; b.max.y = y + h; b.min.z = z - hz; b.max.z = z + hz;
  return b;
}
export function playerCenter(player, out) { return out.set(player.pos.x, player.pos.y + 0.55, player.pos.z); }

// ------------------------------------------------------------------ projectile pool (pits, snowballs, barrels…)
/**
 * Small pool of simple projectiles living in world space. makeMesh() → Object3D (added to parent).
 * fire(pos, vel) launches one. update(dt, ctx, hooks) moves, collides with the player, ground.
 * opts: { radius, gravity, life, cause, spinBreak (true: the spin destroys it), color (burst) }
 */
export function makeProjectiles(parent, count, makeMesh, opts = {}) {
  const list = [];
  for (let i = 0; i < count; i++) {
    const mesh = makeMesh();
    mesh.visible = false;
    parent.add(mesh);
    list.push({ mesh, on: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), t: 0 });
  }
  const R = opts.radius ?? 0.2, G = opts.gravity ?? 0, LIFE = opts.life ?? 3;
  const pool = {
    list,
    fire(pos, vel) {
      let p = list.find((x) => !x.on);
      if (!p) p = list[0];
      p.on = true; p.t = 0; p.pos.copy(pos); p.vel.copy(vel);
      p.mesh.visible = true; p.mesh.position.copy(pos);
      return p;
    },
    kill(p, ctx, burst = true) {
      p.on = false; p.mesh.visible = false;
      if (burst && ctx) ctx.fx?.burst(p.pos, opts.color ?? 0xffffff, 8, { speed: 3, dy: 0 });
    },
    clear() { for (const p of list) { p.on = false; p.mesh.visible = false; } },
    update(dt, ctx) {
      const pl = ctx.player;
      for (const p of list) {
        if (!p.on) continue;
        p.t += dt;
        p.vel.y -= G * dt;
        p.pos.addScaledVector(p.vel, dt);
        p.mesh.position.copy(p.pos);
        p.mesh.rotation.x += dt * 9; p.mesh.rotation.z += dt * 5;
        if (p.t > LIFE) { pool.kill(p, ctx, false); continue; }
        // ground hit
        if (p.vel.y <= 0 || G === 0) {
          const g = groundBelow(ctx.level.world, p.pos.x, p.pos.z, p.pos.y + 0.6, 1.2);
          if (g > -Infinity && p.pos.y - R <= g) { opts.onGround?.(p, ctx); pool.kill(p, ctx); continue; }
        }
        if (pl.dead) continue;
        playerCenter(pl, _c);
        const dx = p.pos.x - _c.x, dy = p.pos.y - _c.y, dz = p.pos.z - _c.z;
        const d2 = dx * dx + dy * dy * 0.5 + dz * dz;
        if ((pl.spinning || pl.sliding) && opts.spinBreak !== false && d2 < 1.3 * 1.3) {
          ctx.sfx('enemy_hit', { pos: p.pos }); ctx.fx?.ring?.(p.pos, 0xffffff, 0.8);
          pool.kill(p, ctx); continue;
        }
        const rr = R + 0.32;
        if (d2 < rr * rr) { ctx.game.hurt(opts.cause ?? 'generic'); pool.kill(p, ctx); }
      }
    },
  };
  return pool;
}

// ------------------------------------------------------------------ kill words
const KICK_WORDS = ['SPLAT !', 'PAF !', 'BONK !', 'SPLOTCH !', 'PLOC !', 'SCHLAK !'];
export function kickWord(i) { return KICK_WORDS[(i ?? Math.floor(Math.random() * KICK_WORDS.length)) % KICK_WORDS.length]; }

/** Theme → world family ('island' | 'desert' | 'ice' | 'factory' | 'golden'). */
export function family(theme = '') {
  if (/beach|jungle|river|boss_beach/.test(theme)) return 'island';
  if (/desert|medina|sidibou|boss_desert/.test(theme)) return 'desert';
  if (/ice|cave|aurora|boss_ice/.test(theme)) return 'ice';
  if (/factory|lab|space|tower|boss_lab/.test(theme)) return 'factory';
  if (/golden/.test(theme)) return 'golden';
  return 'island';
}
