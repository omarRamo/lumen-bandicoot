// Lumen Bandicoot — environment art direction: sky, fog, lights (+ following shadow camera), the mesh of EVERY
// level platform (per kind & theme, merged per material), terrain banks, the animated plane under the level,
// distant backdrop, procedural + explicit decor (baked per chunk), parody billboards and ambient particles.
//
//   createEnvironment(scene, levelData, { quality, renderer, camera, lang? }) → { update(dt, { camera, player, time }), dispose() }
//
// ---------------------------------------------------------------------------------------------------------------
// DECOR KINDS for level designers — `levelData.decor: [{ kind, x, y, z, s?, r?, ... }]` (builder: `.deco(kind, lat, fwd, up, s, r)`)
//   s = uniform scale (1 = natural size), r = rotation around Y (radians). Unknown kinds fall back to `rock`.
//   Outside platforms the prop snaps onto the terrain; over the void/water it gets a small rock pedestal
//   (add `free: true` to keep the exact y, e.g. floating things).
//   Nature  : palm, tree, pine, fern, bush, bougainvillea, flowers, grass_tuft, mushroom, log, reeds, lilypad (water),
//             rock, boulder, pebbles, dune, cactus, coral, shell, stalagmite, stalactite (hangs down), crystal,
//             ice_spike, aurora_tree, cloud_puff
//   Beach   : umbrella, deckchair, hut, totem, tiki_torch (glow), camel_vacation (camel on holiday + parasol)
//   Tunisia : house (medina, ochre), house_blue (Sidi Bou Saïd), arch, dome, minaret, lantern (glow), pot,
//             cat, cat_wall (Sidi Bou Saïd cat asleep on a wall)
//   Ice     : igloo, snowman, pine (snowy in ice themes)
//   Factory : pipe, gear, tube (lab tube, glow), tank, barrel, chimney (with smoke), robot_arm, satellite,
//             crate_pile (fake crates, NOT breakable), fence, flag, sign_post, strut
//   Space   : planet (ringed, use free:true to float), ufo, rock
//   Misc    : statue_sock (giant golden sock), billboard, poster, sign (text gags, see below)
//   Aliases : palm_tree, palmier, stone, moon_rock, torch, fir, sapin, camel, chameau, spike, crystals, smokestack,
//             pipes, crates, amphora, jar, house_white, maison_bleue, mosque, tower, sock_statue, antenna, puff, tuft
// Text gags: { kind: 'billboard' | 'poster' | 'sign', gag?: '<id>', text?: string | [line1, line2, line3] | {fr:[…], en:[…]} }
//   gag ids (env-gags.js): notcrash, lawyers, sunscreen, nobandicoot, moonroll, jungletm, okutips, lilypads, noswim,
//   camel, mirage, tozeur, cortisol, carpets, sales, catnap, bluepaint, cafe, penguins, slide, yeti, crystals, echo,
//   aurora_trial, accidents, stressotron, labban, redbutton, rats, cardboard, spacestress, stresstower, elevator,
//   crabking, arena, djinn, finalboss, goldnotcrash, socks
// Optional level fields read here: `waterY` (height of the decorative sea/lava/goo plane, default killY + 3, or the
//   lowest `water`/`lava` hazard zone), `envDensity` (multiplier of the procedural decor), `noAutoDecor` (true = only
//   explicit decor), `noGags` (true = no automatic parody billboards).
// ---------------------------------------------------------------------------------------------------------------
import * as THREE from 'three';
import { rng, strSeed, fbm, clamp, lerp, smoothstep, setAnisotropy, Baker, mixHex } from './env-util.js';
import { STYLES, styleMaterials, conveyorMaterial, terrainDetailTex, signTexture } from './env-textures.js';
import { getTemplate, resolveKind, VARIANT_COUNT } from './env-props.js';
import { PALS, DEFAULT_KINDS, getTheme } from './env-themes.js';
import { GAGS, gagSpec } from './env-gags.js';
import { createSky, createClouds, createBackdrop, createUnder, createParticles } from './env-sky.js';

const SHARED_TIME = { value: 0 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------- shared materials (never disposed)
function addSway(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = SHARED_TIME;
    sh.vertexShader = 'attribute float sway;\nuniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      float swPh = position.x * 0.37 + position.z * 0.23;
      transformed.x += sway * (sin(uTime * 1.6 + swPh) * 0.11 + sin(uTime * 3.3 + swPh * 2.1) * 0.035);
      transformed.z += sway * cos(uTime * 1.25 + swPh * 1.3) * 0.08;`);
  };
  mat.customProgramCacheKey = () => 'lb-sway';
  return mat;
}
let propMat = null, glowMat = null, terrainMat = null, ceilMat = null, faceGeoBig = null, faceGeoSmall = null;
function sharedMats() {
  if (propMat) return;
  propMat = addSway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  glowMat = addSway(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }));
  terrainMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: terrainDetailTex() });
  ceilMat = new THREE.MeshLambertMaterial({ vertexColors: true, map: terrainDetailTex(), side: THREE.DoubleSide });
  faceGeoBig = new THREE.PlaneGeometry(5.4, 2.4);
  faceGeoSmall = new THREE.PlaneGeometry(1.8, 1.35);
}

// ---------------------------------------------------------------- geometry accumulator (indexed quads)
class Acc {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.i = []; }
  quad(v, nx, ny, nz, uv, cols) {
    const b = this.p.length / 3;
    for (let k = 0; k < 4; k++) {
      this.p.push(v[k][0], v[k][1], v[k][2]); this.n.push(nx, ny, nz); this.uv.push(uv[k][0], uv[k][1]);
      const c = cols[k]; this.c.push(c, c, c);
    }
    this.i.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  tri(v, uv, cols) {
    const b = this.p.length / 3;
    const ax = v[1][0] - v[0][0], ay = v[1][1] - v[0][1], az = v[1][2] - v[0][2];
    const bx = v[2][0] - v[0][0], by = v[2][1] - v[0][1], bz = v[2][2] - v[0][2];
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    for (let k = 0; k < 3; k++) { this.p.push(...v[k]); this.n.push(nx, ny, nz); this.uv.push(...uv[k]); this.c.push(cols[k], cols[k], cols[k]); }
    this.i.push(b, b + 1, b + 2);
  }
  build() {
    if (!this.p.length) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.i);
    g.computeBoundingSphere();
    return g;
  }
}

// styles whose material accepts vertex colours (shared materials are flagged once)
function vc(mat) { if (mat && !mat.vertexColors) { mat.vertexColors = true; mat.needsUpdate = true; } return mat; }

const NO_SUPPORT = new Set(['cloud', 'cloud_gold', 'bridge', 'glass']);
const WOOD = new Set(['wood', 'wood_pale']);
const METALLIC = new Set(['metal', 'metal_dark', 'conveyor', 'tile_lab', 'panel_space']);
const NIGHT = new Set(['cave', 'aurora', 'space', 'lab', 'boss_desert', 'boss_lab', 'tower']);

export function createEnvironment(scene, data, opts = {}) {
  const quality = opts.quality || { level: 1, shadows: true };
  const Q = clamp(quality.level ?? 1, 0, 2);
  const renderer = opts.renderer;
  const lang = opts.lang || (typeof navigator !== 'undefined' && /^en/i.test(navigator.language || '') ? 'en' : 'fr');
  setAnisotropy(renderer, Q);
  sharedMats();
  const th = getTheme(data.theme);
  const pal = PALS[th.pal] || PALS.tropic;
  const palId = th.pal || 'tropic';
  const seed = strSeed(String(data.id ?? '') + ':' + String(data.theme));
  const R = rng(seed);
  const root = new THREE.Group();
  root.name = 'environment';
  scene.add(root);
  const geos = [];      // per-level geometries to dispose
  const mats = [];      // per-level materials to dispose
  const parts = [];     // sub-systems with update/dispose
  const camera = opts.camera;

  // ============================================================ level analysis (2-D distance field: turns, spirals, side levels…)
  const PRESET_YAW = { behind: 0, front: Math.PI, side: 0, ride: 0, arena: 0 };
  const PRESET_DIST = { behind: 7.2, front: 6.6, side: 11, ride: 8.4, arena: 15 };
  const baseMode = data.mode === 'chase' ? 'front' : data.mode === 'side' ? 'side' : data.mode === 'ride' ? 'ride' : data.mode === 'boss' ? 'arena' : (data.camera?.mode || 'behind');
  const baseCam = { ...(data.camera || {}), mode: baseMode };
  /** camera at a point (zones override the level camera): { mode, vx, vz (unit vector focus → camera), dist } */
  function camAt(x, y, z) {
    let zone = null;
    for (const zn of data.zones || []) {
      if (zn.camera && x >= zn.min[0] && x <= zn.max[0] && z >= zn.min[2] && z <= zn.max[2] && (y == null || (y >= zn.min[1] - 2 && y <= zn.max[1] + 2))) zone = zn;
    }
    const c = zone ? zone.camera : baseCam;
    const mode = c.mode || 'behind';
    const yaw = c.yaw ?? PRESET_YAW[mode] ?? 0;
    return { mode, vx: Math.sin(yaw), vz: Math.cos(yaw), dist: c.dist ?? PRESET_DIST[mode] ?? 8 };
  }
  const dirX = data.dir === 'x';
  const right0 = dirX ? [0, -1] : [1, 0];

  const plats = (data.platforms || []).filter((p) => p && p.min && p.max && p.max[0] > p.min[0] && p.max[2] > p.min[2] && p.max[1] >= p.min[1]);
  // every walkable footprint: static platforms + dynamic platform entities (with their sweep)
  const solids = plats.map((p) => ({ x0: p.min[0], x1: p.max[0], z0: p.min[2], z1: p.max[2], top: p.max[1], thin: p.max[1] - p.min[1] < 0.6 }));
  for (const e of data.entities || []) {
    if (e.type !== 'platform' || !Number.isFinite(e.x) || !Number.isFinite(e.z)) continue;
    let hw = (e.w ?? 2) / 2, hd = (e.d ?? 2) / 2;
    if (e.kind === 'rotating') hw = hd = Math.hypot(hw, hd);
    const tx = e.to?.x ?? 0, tz = e.to?.z ?? 0, ty = e.to?.y ?? 0;
    solids.push({ x0: Math.min(e.x, e.x + tx) - hw, x1: Math.max(e.x, e.x + tx) + hw, z0: Math.min(e.z, e.z + tz) - hd, z1: Math.max(e.z, e.z + tz) + hd, top: (e.y ?? 0) + Math.max(0, ty), thin: true, dyn: true });
  }
  // liquid hazard zones: no decor in them either
  const liquids = [];
  for (const e of data.entities || []) {
    if (e.type === 'hazard' && (e.kind === 'water' || e.kind === 'lava') && Number.isFinite(e.x)) {
      liquids.push({ x0: e.x - (e.w ?? 4) / 2, x1: e.x + (e.w ?? 4) / 2, z0: e.z - (e.d ?? 4) / 2, z1: e.z + (e.d ?? 4) / 2 });
    }
  }
  let X0 = Infinity, X1 = -Infinity, Z0 = Infinity, Z1 = -Infinity, lowestTop = Infinity, topSum = 0, topN = 0;
  for (const s of solids) {
    X0 = Math.min(X0, s.x0); X1 = Math.max(X1, s.x1); Z0 = Math.min(Z0, s.z0); Z1 = Math.max(Z1, s.z1);
  }
  for (const p of plats) { lowestTop = Math.min(lowestTop, p.max[1]); topSum += p.max[1]; topN++; }
  if (!solids.length) { const sp = data.spawn || [0, 0, 0]; X0 = sp[0] - 3; X1 = sp[0] + 3; Z0 = sp[2] - 10; Z1 = sp[2] + 3; }
  if (!Number.isFinite(lowestTop)) lowestTop = data.spawn?.[1] ?? 0;
  const meanTop = topN ? topSum / topN : lowestTop;
  const killY = data.killY ?? lowestTop - 14;
  const under = th.under?.type || 'void';
  let waterY = killY + 3;
  if (Number.isFinite(data.waterY)) waterY = data.waterY;
  else {
    const want = under === 'lava' || under === 'goo' ? 'lava' : under === 'water' || under === 'ice' ? 'water' : null;
    let hy = Infinity;
    for (const e of data.entities || []) if (e.type === 'hazard' && want && e.kind === want && e.y <= lowestTop + 0.5) hy = Math.min(hy, e.y - 0.12);
    if (Number.isFinite(hy) && hy > killY) waterY = hy;
  }
  const deepY = waterY - 4;
  const baseY = data.spawn?.[1] ?? meanTop;

  // ---- distance field on a regular grid: D (distance to the nearest walkable footprint or gap connector),
  //      Q (nearest point), path height (weighted), CLR (keep clear for side / arena cameras)
  const MARGIN = 78, RMAX = 34;
  let CELL = [2.6, 2.0, 1.6][Q];
  {
    const n = ((X1 - X0 + 2 * MARGIN) / CELL) * ((Z1 - Z0 + 2 * MARGIN) / CELL);
    if (n > 70000) CELL *= Math.sqrt(n / 70000);
  }
  const GX0 = X0 - MARGIN, GZ0 = Z0 - MARGIN;
  const NX = Math.ceil((X1 - X0 + 2 * MARGIN) / CELL) + 1, NZ = Math.ceil((Z1 - Z0 + 2 * MARGIN) / CELL) + 1;
  const NN = NX * NZ;
  const D = new Float32Array(NN).fill(RMAX), QX = new Float32Array(NN), QZ = new Float32Array(NN);
  const SW = new Float32Array(NN), SY = new Float32Array(NN), CLR = new Uint8Array(NN), QT = new Float32Array(NN);
  const camClear = (cx, cz, y) => { const c = camAt(cx, y, cz); return c.mode === 'side' || c.mode === 'arena' ? c : null; };
  function rasterRect(x0, x1, z0, z1, top, wa, cam) {
    const R2 = RMAX + (cam ? cam.dist : 0);
    const i0 = Math.max(0, Math.floor((x0 - R2 - GX0) / CELL)), i1 = Math.min(NX - 1, Math.ceil((x1 + R2 - GX0) / CELL));
    const j0 = Math.max(0, Math.floor((z0 - R2 - GZ0) / CELL)), j1 = Math.min(NZ - 1, Math.ceil((z1 + R2 - GZ0) / CELL));
    for (let j = j0; j <= j1; j++) {
      const z = GZ0 + j * CELL, qz = z < z0 ? z0 : z > z1 ? z1 : z;
      for (let i = i0; i <= i1; i++) {
        const x = GX0 + i * CELL, qx = x < x0 ? x0 : x > x1 ? x1 : x;
        const d = Math.hypot(x - qx, z - qz), k = j * NX + i;
        if (d < D[k]) { D[k] = d; QX[k] = qx; QZ[k] = qz; QT[k] = top; }
        if (d < RMAX) { const w = Math.exp(-d / 5) * wa; SW[k] += w; SY[k] += w * top; }
        if (cam && d > 0.01 && d < cam.dist + 4 && ((x - qx) * cam.vx + (z - qz) * cam.vz) > 0.3 * d) CLR[k] = 1;
      }
    }
  }
  function rasterSeg(ax, az, bx, bz, ya, yb, r) {
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - r - RMAX - GX0) / CELL)), i1 = Math.min(NX - 1, Math.ceil((Math.max(ax, bx) + r + RMAX - GX0) / CELL));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - r - RMAX - GZ0) / CELL)), j1 = Math.min(NZ - 1, Math.ceil((Math.max(az, bz) + r + RMAX - GZ0) / CELL));
    const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const x = GX0 + i * CELL, z = GZ0 + j * CELL;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
      const qx = ax + dx * t, qz = az + dz * t;
      const d = Math.max(0, Math.hypot(x - qx, z - qz) - r), k = j * NX + i;
      if (d < D[k]) { D[k] = d; QX[k] = qx; QZ[k] = qz; QT[k] = Math.min(ya, yb); }
      if (d < RMAX) { const w = Math.exp(-d / 5) * 0.6; SW[k] += w; SY[k] += w * lerp(ya, yb, t); }
    }
  }
  for (const s of solids) {
    const area = (s.x1 - s.x0) * (s.z1 - s.z0);
    rasterRect(s.x0, s.x1, s.z0, s.z1, s.top, Math.sqrt(Math.min(area, 64)) * (s.thin ? 0.3 : 1), camClear((s.x0 + s.x1) / 2, (s.z0 + s.z1) / 2, s.top));
  }
  // gap connectors: each footprint to its 2 nearest neighbours (edge gap < 22 m) so pits stay open between them
  {
    const gapOf = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));
    const done = new Set();
    for (let i = 0; i < solids.length; i++) {
      const a = solids[i], near = [];
      for (let j = 0; j < solids.length; j++) if (j !== i) { const g = gapOf(a, solids[j]); if (g > 0.05 && g < 22) near.push([g, j]); }
      near.sort((p, q) => p[0] - q[0]);
      for (const [, j] of near.slice(0, 2)) {
        const key = i < j ? i + ':' + j : j + ':' + i;
        if (done.has(key)) continue;
        done.add(key);
        const b = solids[j];
        const ax = (a.x0 + a.x1) / 2, az = (a.z0 + a.z1) / 2, bx = (b.x0 + b.x1) / 2, bz = (b.z0 + b.z1) / 2;
        const L = Math.hypot(bx - ax, bz - az) || 1, ux = (bx - ax) / L, uz = (bz - az) / L;
        const across = (s) => Math.abs(uz) * (s.x1 - s.x0) / 2 + Math.abs(ux) * (s.z1 - s.z0) / 2;
        rasterSeg(ax, az, bx, bz, a.top, b.top, clamp(Math.min(across(a), across(b)), 0.8, 6));
      }
    }
  }
  const PY = new Float32Array(NN);
  for (let k = 0; k < NN; k++) PY[k] = SW[k] > 1e-4 ? SY[k] / SW[k] : meanTop;
  // keep the area right behind the spawn free of props (the camera starts there)
  const spawnCam = data.spawn ? camAt(data.spawn[0], data.spawn[1], data.spawn[2]) : null;
  function nearSpawnCam(x, z) {
    if (!spawnCam) return false;
    const dx = x - data.spawn[0], dz = z - data.spawn[2];
    const along = dx * spawnCam.vx + dz * spawnCam.vz, side = Math.abs(dx * spawnCam.vz - dz * spawnCam.vx);
    return along > -1 && along < spawnCam.dist + 4 && side < 5.5;
  }
  // bilinear samplers
  function bil(arr, x, z) {
    const fx = clamp((x - GX0) / CELL, 0, NX - 1.001), fz = clamp((z - GZ0) / CELL, 0, NZ - 1.001);
    const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * NX + i;
    return lerp(lerp(arr[k], arr[k + 1], tx), lerp(arr[k + NX], arr[k + NX + 1], tx), tz);
  }
  const nodeOf = (x, z) => clamp(Math.round((z - GZ0) / CELL), 0, NZ - 1) * NX + clamp(Math.round((x - GX0) / CELL), 0, NX - 1);
  /** exact distance to the nearest walkable footprint */
  function exactD(x, z) {
    let m = Infinity;
    for (const s of solids) {
      const dx = Math.max(s.x0 - x, 0, x - s.x1), dz = Math.max(s.z0 - z, 0, z - s.z1);
      const d = dx * dx + dz * dz;
      if (d < m) m = d;
    }
    for (const s of liquids) if (x > s.x0 - 0.5 && x < s.x1 + 0.5 && z > s.z0 - 0.5 && z < s.z1 + 0.5) return 0;
    return Math.sqrt(m);
  }
  function inPlatform(x, z, m = 0.6) {
    for (const p of plats) if (x > p.min[0] - m && x < p.max[0] + m && z > p.min[2] - m && z < p.max[2] + m) return p;
    return null;
  }

  // ---- route polyline (big footprints in data order): local forward / right for gags, landmarks, decks
  const route = plats.filter((p) => Math.min(p.max[0] - p.min[0], p.max[2] - p.min[2]) >= 1.2 && (p.max[0] - p.min[0]) * (p.max[2] - p.min[2]) >= 3)
    .map((p) => ({ x: (p.min[0] + p.max[0]) / 2, z: (p.min[2] + p.max[2]) / 2, y: p.max[1], p, s: 0 }));
  for (let i = 1; i < route.length; i++) route[i].s = route[i - 1].s + Math.min(30, Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z));
  function frameAt(i) {
    const a = route[Math.max(0, i - 2)], b = route[Math.min(route.length - 1, i + 2)];
    let fx = b.x - a.x, fz = b.z - a.z, l = Math.hypot(fx, fz);
    if (l < 0.5) { const c = camAt(route[i].x, route[i].y, route[i].z); fx = -c.vx; fz = -c.vz; l = 1; }
    fx /= l; fz /= l;
    return { fx, fz, rx: -fz, rz: fx };
  }
  const acrossOf = (p, rx, rz) => Math.abs(rx) * (p.max[0] - p.min[0]) / 2 + Math.abs(rz) * (p.max[2] - p.min[2]) / 2;

  // ============================================================ terrain height model (per grid node)
  const T = th.terrain;
  const seaDir = T?.sea ? [right0[0] * T.sea, right0[1] * T.sea] : null;
  const HT = new Float32Array(NN);
  if (T) {
    for (let k = 0; k < NN; k++) {
      const x = GX0 + (k % NX) * CELL, z = GZ0 + Math.floor(k / NX) * CELL;
      const e = D[k], py = PY[k];
      const n = fbm(x * 0.09 + 3.1, z * 0.09 - 1.7, 3);
      const shelfY = Math.max(py - T.shelf + (n - 0.5) * 1.1, waterY + 0.7);
      const ch = T.channel || 0, bed = ch ? waterY - 1.3 : deepY;
      let h;
      if (e < 0.9) h = deepY;
      else if (e < 0.9 + ch) h = lerp(deepY, bed, smoothstep(0.9, 2.5, e));
      else {
        h = lerp(bed, shelfY, smoothstep(0.9 + ch, 2.7 + ch * 1.3, e));
        const vx = e > 0.01 ? (x - QX[k]) / e : 0, vz = e > 0.01 ? (z - QZ[k]) / e : 0;
        const sd = vx * right0[0] + vz * right0[1];
        const hill = sd < 0 ? T.hillL : T.hillR;
        h += smoothstep(5 + ch, 14, e) * 0.9 * (fbm(x * 0.05, z * 0.05, 2) - 0.3);
        h += smoothstep(13 + ch, 34 + ch, e) * hill * (0.3 + 0.95 * fbm(x * 0.035 + 11, z * 0.035 - 5, 3));
        if (T.dunes) h += Math.pow(1 - Math.abs(Math.sin(x * 0.11 + z * 0.045 + n * 3)), 2) * 3.2 * smoothstep(5, 18, e);
        if (seaDir && vx * seaDir[0] + vz * seaDir[1] > 0.25) h = lerp(h, waterY - 3.5, smoothstep(6, 18, e) * (0.85 + 0.3 * fbm(x * 0.05, z * 0.05)));
      }
      // never above the nearby walkable surfaces (cameras swing around at turns)
      if (D[k] < RMAX) h = Math.min(h, lerp(Math.min(QT[k], py) - 1.0, h, smoothstep(12, 16, e)));
      if (CLR[k]) h = Math.min(h, Math.max(py - 4.5, deepY));
      HT[k] = h;
    }
  }
  const terrainAt = (x, z) => (T ? bil(HT, x, z) : -Infinity);
  const ceilAt = (x, z) => bil(PY, x, z) + 11 + fbm(x * 0.06, z * 0.06 + 9, 3) * 9;

  // ============================================================ sky, fog, lights
  const time = { value: 0 };
  const sky = createSky(th, time);
  root.add(sky.mesh);
  parts.push(sky);
  const sunDir = sky.sunDir;
  const fogCol = th.fogCol ?? mixHex(th.sky[2], th.sky[1], 0.2);
  const prev = { fog: scene.fog, bg: scene.background, env: scene.environment, envI: scene.environmentIntensity, exposure: renderer?.toneMappingExposure };
  scene.fog = new THREE.Fog(fogCol, th.fog[0], th.fog[1]);
  scene.background = new THREE.Color(th.sky[2]);
  if (renderer && th.exposure) renderer.toneMappingExposure = th.exposure;

  const hemi = new THREE.HemisphereLight(th.hemi[0], th.hemi[1], th.hemi[2]);
  root.add(hemi);
  const sun = new THREE.DirectionalLight(th.sun[0], th.sun[1]);
  const lightDir = sunDir.clone();
  if (lightDir.y < 0.55) { lightDir.y = 0.55; lightDir.normalize(); }
  sun.position.copy(lightDir).multiplyScalar(60);
  root.add(sun); root.add(sun.target);
  const SH = Q >= 2 ? 20 : 15, SM = Q >= 2 ? 2048 : 1024;
  if (quality.shadows) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(SM, SM);
    Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 140 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.035;
  }
  const texel = (SH * 2) / SM;
  function focusShadow(x, y, z) {
    const fx = Math.round(x / texel) * texel, fz = Math.round(z / texel) * texel, fy = Math.round(y);
    sun.target.position.set(fx, fy, fz);
    sun.position.set(fx, fy, fz).addScaledVector(lightDir, 60);
    sun.target.updateMatrixWorld();
  }
  if (data.spawn) focusShadow(data.spawn[0], data.spawn[1], data.spawn[2]);

  // environment map from the sky for other agents' PBR materials
  let envRT = null;
  if (renderer?.isWebGLRenderer && Q >= 1) {
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const es = new THREE.Scene();
      es.add(new THREE.Mesh(sky.mesh.geometry, sky.mesh.material));
      envRT = pm.fromScene(es, 0, 0.1, 1000);
      pm.dispose();
      scene.environment = envRT.texture;
      if ('environmentIntensity' in scene) scene.environmentIntensity = 0.6;
    } catch { envRT = null; }
  }

  // ============================================================ under plane, backdrop, clouds, particles
  const underPlane = createUnder(th, waterY, time, sunDir, fogCol);
  if (underPlane) { root.add(underPlane.mesh); parts.push(underPlane); }
  const backdrop = createBackdrop(th, Math.min(baseY - 6, waterY - 1), seed, sunDir);
  if (backdrop) { root.add(backdrop.mesh); parts.push(backdrop); }
  const clouds = createClouds(th, baseY, seed);
  if (clouds) { root.add(clouds.mesh); parts.push(clouds); }
  const particles = createParticles(th, quality);
  if (particles) { root.add(particles.mesh); parts.push(particles); }

  // ============================================================ decor bakers (chunks along the route)
  const CH = 64;
  const kindVerts = {};
  const placed = []; // [kind, x, y, z, source] for QA (env.debug.placed)
  let placeSrc = 'auto';
  const chunks = new Map();
  function chunkAt(x, z) {
    const k = Math.floor(x / CH) + ',' + Math.floor(z / CH);
    let c = chunks.get(k);
    if (!c) { c = { near: new Baker(), far: new Baker(), glow: new Baker() }; chunks.set(k, c); }
    return c;
  }
  /** bake a prop instance. o: { rx, rz, sx, sy, sz, far, variant, tint, tintCol } */
  function place(kind, x, y, z, ry = 0, s = 1, o = {}) {
    const k = resolveKind(kind) ? kind : 'rock';
    const t = getTemplate(k, pal, palId, o.variant ?? Math.floor(R() * VARIANT_COUNT), o.far || Q === 0 ? 1 : 0);
    if (!t) return null;
    _e.set(o.rx || 0, ry, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    _s.set((o.sx ?? 1) * s, (o.sy ?? 1) * s, (o.sz ?? 1) * s);
    _v.set(x, y, z);
    _m.compose(_v, _q, _s);
    const c = chunkAt(x, z);
    if (k !== 'unit_box' && k !== 'unit_cyl' && k !== 'cloud_puff') placed.push([k, +x.toFixed(2), +y.toFixed(2), +z.toFixed(2), placeSrc]);
    kindVerts[k + (o.far ? '*' : '')] = (kindVerts[k + (o.far ? '*' : '')] || 0) + (t.lit?.count || 0) + (t.glow?.count || 0);
    const tint = o.tint ?? (0.9 + R() * 0.18);
    (o.far ? c.far : c.near).push(t.lit, _m, tint, o.tintCol);
    c.glow.push(t.glow, _m, 1);
    return t;
  }
  /** a unit box/cylinder stretched between two points (ropes, posts, struts, frames) */
  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();
  function beam(a, b, thick, color, cyl = false, far = false) {
    _a.set(...a); _b.set(...b); _d.subVectors(_b, _a);
    const len = _d.length();
    if (len < 1e-3) return;
    _q.setFromUnitVectors(UP, _d.normalize());
    _s.set(thick, len, thick);
    _m.compose(_a, _q, _s);
    const t = getTemplate(cyl ? 'unit_cyl' : 'unit_box', pal, palId, 0);
    const cc = new THREE.Color(color);
    const c = chunkAt(a[0], a[2]);
    (far ? c.far : c.near).push(t.lit, _m, 1, [cc.r, cc.g, cc.b]);
  }

  // ============================================================ platforms (merged per material)
  const accs = new Map();
  function accFor(key, mat) {
    let a = accs.get(key);
    if (!a) { a = { acc: new Acc(), mat }; accs.set(key, a); }
    return a.acc;
  }
  const convMats = [];
  function convMat(speed) {
    const key = speed.toFixed(2);
    let c = convMats.find((m) => m.key === key);
    if (!c) { c = { key, speed, mat: vc(conveyorMaterial()) }; convMats.push(c); mats.push(c.mat); }
    return c;
  }
  function styleFor(p) {
    if (p.damage === 'burn') return 'lava';
    const k = p.kind || 'ground';
    if (k === 'ground') return th.ground;
    return th.kinds?.[k] ?? DEFAULT_KINDS[k] ?? th.ground;
  }
  function supportFor(styleId, p, hasBelow) {
    if (NO_SUPPORT.has(styleId) || hasBelow) return 'none';
    if (WOOD.has(styleId)) return under === 'void' ? 'none' : 'stilts';
    if (styleId === 'crystal') return 'float';
    if (METALLIC.has(styleId)) return under === 'void' ? 'none' : 'strut';
    const s = th.support || 'pillar';
    if (s === 'pillar' && under === 'void') return 'float';
    return s;
  }
  const lavaMats = [];
  /**
   * mesh one box. o: { shade, decor (no shadows cast), support }
   */
  function meshBox(min, max, styleId, o = {}) {
    const sm = styleMaterials(styleId);
    const st = sm.style;
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const w = x1 - x0, d = z1 - z0, h = y1 - y0;
    const shade = o.shade ?? 1;
    const ts = st.ts || 3, ss = st.ss || 3;
    const support = o.support || 'none';
    const tag = o.decor ? ':d' : '';
    // ---- top
    let topAcc, uvTop;
    if (st.mat === 'conveyor' && o.conveyor) {
      const [vx, vz] = o.conveyor;
      const alongX = Math.abs(vx) >= Math.abs(vz), sp = alongX ? vx : vz, sg = Math.sign(sp) || 1;
      const cm = convMat(Math.abs(sp));
      topAcc = accFor('conv' + cm.key + tag, cm.mat);
      uvTop = alongX ? (x, z) => [(z - z0) / d, sg * x / ts] : (x, z) => [(x - x0) / w, sg * z / ts];
    } else {
      const rot = st.plankAlong === true ? w > d : st.plankAlong === false ? d >= w : false;
      topAcc = accFor(styleId + ':top' + tag, vc(sm.top));
      uvTop = rot ? (x, z) => [z / ts, x / ts] : (x, z) => [x / ts, -z / ts];
      if (st.mat === 'lava' && !lavaMats.includes(sm.top)) lavaMats.push(sm.top);
    }
    const tv = [[x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0]];
    topAcc.quad(tv, 0, 1, 0, tv.map((v) => uvTop(v[0], v[2])), [shade, shade, shade, shade]);
    // ---- sides
    const sideAcc = accFor(styleId + ':side' + tag, vc(sm.side));
    const yb = support === 'pillar' ? Math.min(y0, deepY) : y0;
    const cTop = shade, cBot = (y) => shade * (1 - 0.5 * smoothstep(0, 10, y1 - y));
    const cb = cBot(yb);
    const sideUv = (u0, u1) => [[u0 / ss, yb / ss], [u1 / ss, yb / ss], [u1 / ss, y1 / ss], [u0 / ss, y1 / ss]];
    sideAcc.quad([[x0, yb, z1], [x1, yb, z1], [x1, y1, z1], [x0, y1, z1]], 0, 0, 1, sideUv(x0, x1), [cb, cb, cTop, cTop]);
    sideAcc.quad([[x1, yb, z0], [x0, yb, z0], [x0, y1, z0], [x1, y1, z0]], 0, 0, -1, sideUv(-x1, -x0), [cb, cb, cTop, cTop]);
    sideAcc.quad([[x1, yb, z1], [x1, yb, z0], [x1, y1, z0], [x1, y1, z1]], 1, 0, 0, sideUv(-z1, -z0), [cb, cb, cTop, cTop]);
    sideAcc.quad([[x0, yb, z0], [x0, yb, z1], [x0, y1, z1], [x0, y1, z0]], -1, 0, 0, sideUv(z0, z1), [cb, cb, cTop, cTop]);
    if (support !== 'pillar' && support !== 'float') {
      const c0 = shade * 0.6;
      sideAcc.quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], 0, -1, 0, [[x0 / ss, z0 / ss], [x1 / ss, z0 / ss], [x1 / ss, z1 / ss], [x0 / ss, z1 / ss]], [c0, c0, c0, c0]);
    }
    // ---- fringe band (grass tufts, drips, trims, hazard stripes)
    if (sm.band && h >= 0.12 && !o.decor) {
      const bandAcc = accFor(styleId + ':band' + tag, vc(sm.band));
      const bh = Math.min(st.bandH ?? 0.45, h + 0.05), o2 = 0.035, yt = y1 + 0.025, ybb = y1 - bh;
      const B = 2;
      const c = shade;
      bandAcc.quad([[x0 - o2, ybb, z1 + o2], [x1 + o2, ybb, z1 + o2], [x1 + o2, yt, z1 + o2], [x0 - o2, yt, z1 + o2]], 0, 0, 1, [[x0 / B, 0], [x1 / B, 0], [x1 / B, 1], [x0 / B, 1]], [c, c, c, c]);
      bandAcc.quad([[x1 + o2, ybb, z0 - o2], [x0 - o2, ybb, z0 - o2], [x0 - o2, yt, z0 - o2], [x1 + o2, yt, z0 - o2]], 0, 0, -1, [[-x1 / B, 0], [-x0 / B, 0], [-x0 / B, 1], [-x1 / B, 1]], [c, c, c, c]);
      bandAcc.quad([[x1 + o2, ybb, z1 + o2], [x1 + o2, ybb, z0 - o2], [x1 + o2, yt, z0 - o2], [x1 + o2, yt, z1 + o2]], 1, 0, 0, [[-z1 / B, 0], [-z0 / B, 0], [-z0 / B, 1], [-z1 / B, 1]], [c, c, c, c]);
      bandAcc.quad([[x0 - o2, ybb, z0 - o2], [x0 - o2, ybb, z1 + o2], [x0 - o2, yt, z1 + o2], [x0 - o2, yt, z0 - o2]], -1, 0, 0, [[z0 / B, 0], [z1 / B, 0], [z1 / B, 1], [z0 / B, 1]], [c, c, c, c]);
    }
    // ---- floating-island rocky underside
    if (support === 'float' && w * d >= 1.2) {
      const r2 = rng(strSeed(`${x0},${z0}`));
      const depth = clamp(Math.min(w, d) * 0.7 + 0.8, 1.2, 7);
      const cx = (x0 + x1) / 2 + (r2() - 0.5) * w * 0.25, cz = (z0 + z1) / 2 + (r2() - 0.5) * d * 0.25;
      const ym = y0 - depth * 0.45, k = 0.62;
      const ring0 = [[x0, y0, z1], [x1, y0, z1], [x1, y0, z0], [x0, y0, z0]];
      const ring1 = ring0.map(([x, , z]) => [cx + (x - cx) * k + (r2() - 0.5) * 0.4, ym + (r2() - 0.5) * 0.4, cz + (z - cz) * k + (r2() - 0.5) * 0.4]);
      const tip = [cx, y0 - depth, cz];
      const cMid = shade * 0.75, cTip = shade * 0.5;
      for (let i = 0; i < 4; i++) {
        const a = ring0[i], b = ring0[(i + 1) % 4], a1 = ring1[i], b1 = ring1[(i + 1) % 4];
        const ua = (a[0] + a[2]) / ss, ub = (b[0] + b[2]) / ss;
        sideAcc.tri([a, b1, b], [[ua, a[1] / ss], [ub, b1[1] / ss], [ub, b[1] / ss]], [cTop, cMid, cTop]);
        sideAcc.tri([a, a1, b1], [[ua, a[1] / ss], [ua, a1[1] / ss], [ub, b1[1] / ss]], [cTop, cMid, cMid]);
        sideAcc.tri([a1, tip, b1], [[ua, a1[1] / ss], [(ua + ub) / 2, tip[1] / ss], [ub, b1[1] / ss]], [cMid, cTip, cMid]);
      }
    }
    // ---- supports baked with the decor
    if (support === 'strut' || support === 'stilts') {
      const col = support === 'stilts' ? 0x6a4428 : (pal.strutCol ?? 0x5a6270);
      const thick = support === 'stilts' ? 0.28 : 0.4;
      const ins = Math.min(0.5, w * 0.25, d * 0.25);
      const pts = (w > 2.6 || d > 2.6)
        ? [[x0 + ins, z0 + ins], [x1 - ins, z0 + ins], [x0 + ins, z1 - ins], [x1 - ins, z1 - ins]]
        : [[(x0 + x1) / 2, (z0 + z1) / 2]];
      const yBottom = under === 'void' ? y0 - 6 : deepY;
      for (const [px, pz] of pts) beam([px, yBottom, pz], [px, y0, pz], thick, col, support === 'stilts');
      if (support === 'strut' && pts.length === 4) {
        beam([pts[0][0], y0 - 0.1, pts[0][1]], [pts[3][0], y0 - 0.1, pts[3][1]], 0.18, col);
        beam([pts[1][0], y0 - 0.1, pts[1][1]], [pts[2][0], y0 - 0.1, pts[2][1]], 0.18, col);
      }
    }
  }

  // level platforms
  for (const p of plats) {
    const sid = styleFor(p);
    let hasBelow = false;
    for (const q of plats) {
      if (q === p || q.max[1] > p.min[1] + 0.05) continue;
      if (q.min[0] < p.max[0] - 0.1 && q.max[0] > p.min[0] + 0.1 && q.min[2] < p.max[2] - 0.1 && q.max[2] > p.min[2] + 0.1) { hasBelow = true; break; }
    }
    const support = supportFor(sid, p, hasBelow);
    meshBox(p.min, p.max, sid, { support, conveyor: p.conveyor });
    // per-kind dressing
    const [x0, y0, z0] = p.min, [x1, y1, z1] = p.max, w = x1 - x0, d = z1 - z0;
    if (sid === 'cloud' || sid === 'cloud_gold') {
      const per = 2 * (w + d), n = Math.max(4, Math.round(per / (Q >= 1 ? 1.5 : 2.2)));
      for (let i = 0; i < n; i++) {
        let t = (i / n) * per, x, z;
        if (t < w) { x = x0 + t; z = z1 + 0.1; } else if ((t -= w) < d) { x = x1 + 0.1; z = z1 - t; } else if ((t -= d) < w) { x = x1 - t; z = z0 - 0.1; } else { t -= w; x = x0 - 0.1; z = z0 + t; }
        place('cloud_puff', x, y1 - 0.45, z, R() * 6, 0.6 + R() * 0.3, { tint: 1, far: true });
      }
      place('cloud_puff', (x0 + x1) / 2, y0 - 0.1, (z0 + z1) / 2, R() * 6, Math.min(w, d) * 0.6, { tint: 0.95, sy: 0.6 });
    } else if (sid === 'bridge') {
      const alongZ = d >= w, L = alongZ ? d : w, n = Math.max(2, Math.round(L / 2) + 1);
      for (const side of [0, 1]) {
        const posts = [];
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const pt = alongZ ? [side ? x1 + 0.08 : x0 - 0.08, y1, lerp(z0 + 0.15, z1 - 0.15, t)] : [lerp(x0 + 0.15, x1 - 0.15, t), y1, side ? z1 + 0.08 : z0 - 0.08];
          posts.push(pt);
          beam([pt[0], y0 - 0.3, pt[2]], [pt[0], y1 + 1.0, pt[2]], 0.13, 0x8a5a34, true);
        }
        for (let i = 0; i < n - 1; i++) {
          const a = posts[i], b = posts[i + 1];
          beam([a[0], a[1] + 0.9, a[2]], [b[0], b[1] + 0.82, b[2]], 0.05, 0xd8b07a, true);
          beam([a[0], a[1] + 0.45, a[2]], [b[0], b[1] + 0.4, b[2]], 0.04, 0xc8a070, true);
        }
      }
    } else if (sid === 'glass') {
      const c = 0xc8e8f0, t = 0.08;
      const E = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      for (let i = 0; i < 4; i++) {
        const a = E[i], b = E[(i + 1) % 4];
        beam([a[0], y1, a[1]], [b[0], y1, b[1]], t, c); beam([a[0], y0, a[1]], [b[0], y0, b[1]], t, c);
        beam([a[0], y0, a[1]], [a[0], y1, a[1]], t, c);
      }
    }
  }

  // ============================================================ terrain (heightfield banks) + cave ceiling
  if (T) {
    const buildField = (hFn, colorFn, down) => {
      const pos = new Float32Array(NN * 3), colr = new Float32Array(NN * 3), uv = new Float32Array(NN * 2);
      for (let k = 0; k < NN; k++) {
        const x = GX0 + (k % NX) * CELL, z = GZ0 + Math.floor(k / NX) * CELL;
        pos[k * 3] = x; pos[k * 3 + 1] = hFn(k, x, z); pos[k * 3 + 2] = z;
        uv[k * 2] = x / 4; uv[k * 2 + 1] = z / 4;
      }
      const idx = [];
      for (let j = 0; j < NZ - 1; j++) for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i, b = a + 1, c = a + NX, d = c + 1;
        if (!down) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      g.setIndex(idx);
      g.computeVertexNormals();
      const nrm = g.attributes.normal;
      for (let k = 0; k < NN; k++) {
        const c = colorFn(k, pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2], Math.abs(nrm.getY(k)));
        colr[k * 3] = c.r; colr[k * 3 + 1] = c.g; colr[k * 3 + 2] = c.b;
      }
      g.setAttribute('color', new THREE.BufferAttribute(colr, 3));
      g.computeBoundingSphere();
      geos.push(g);
      return g;
    };
    const cG = new THREE.Color(T.grass), cS = new THREE.Color(T.shore), cC = new THREE.Color(T.cliff), cH = new THREE.Color(T.high), tmp = new THREE.Color();
    const terr = buildField((k) => HT[k], (k, x, y, z, ny) => {
      const n = fbm(x * 0.07, z * 0.07, 2);
      tmp.copy(cG).multiplyScalar(0.86 + 0.24 * n);
      tmp.lerp(cH, smoothstep(PY[k] + 2, PY[k] + 13, y) * 0.75);
      tmp.lerp(cS, 1 - smoothstep(0.5, 2.0, y - waterY));
      tmp.lerp(cC, smoothstep(0.62, 0.38, ny));
      if (y < waterY) tmp.multiplyScalar(0.7);
      return tmp.multiplyScalar(0.84);
    }, false);
    const tm = new THREE.Mesh(terr, terrainMat);
    tm.receiveShadow = !!quality.shadows;
    tm.name = 'terrain';
    root.add(tm);
    if (T.ceiling) {
      const cDark = new THREE.Color(0x2a2048), cLight = new THREE.Color(0x4a3e78);
      const ceil = buildField((k, x, z) => ceilAt(x, z), (k, x, y, z) => tmp.copy(cDark).lerp(cLight, fbm(x * 0.1, z * 0.1, 2)), true);
      const cm = new THREE.Mesh(ceil, ceilMat);
      cm.name = 'ceiling';
      root.add(cm);
    }
  }

  // ============================================================ decor-only ground for industrial / floating themes
  const decks = []; // world rects { x0, x1, z0, z1, top }
  const deckStyle = th.deckStyle ?? (th.industrial ? 'metal_dark' : th.ground);
  function rectFree(x0, x1, z0, z1, m) {
    for (const s of solids) if (x0 < s.x1 + m && x1 > s.x0 - m && z0 < s.z1 + m && z1 > s.z0 - m) return false;
    for (const s of decks) if (x0 < s.x1 + 0.5 && x1 > s.x0 - 0.5 && z0 < s.z1 + 0.5 && z1 > s.z0 - 0.5) return false;
    if (CLR[nodeOf((x0 + x1) / 2, (z0 + z1) / 2)]) return false;
    return true;
  }
  function addDeck(x0, x1, z0, z1, top, thick, support) {
    meshBox([x0, top - thick, z0], [x1, top, z1], deckStyle, { shade: 0.55, decor: true, support });
    decks.push({ x0, x1, z0, z1, top });
  }
  if (!T && (th.industrial || th.floating) && route.length) {
    const ind = !!th.industrial;
    let next = R() * 6;
    for (let i = 0; i < route.length; i++) {
      if (route[i].s < next) continue;
      next = route[i].s + (ind ? 9 : 12) + R() * (ind ? 6 : 9);
      const r0 = route[i], { fx, fz, rx, rz } = frameAt(i);
      for (const side of [-1, 1]) {
        const len = ind ? 6 + R() * 9 : 3 + R() * 5, wdt = ind ? 5 + R() * 7 : 3 + R() * 5;
        const off = acrossOf(r0.p, rx, rz) + (ind ? 2.4 + R() * 1.5 : 3 + R() * 9) + wdt / 2;
        const cx = r0.x + rx * side * off, cz = r0.z + rz * side * off;
        const alongX = Math.abs(fx) >= Math.abs(fz);
        const ex = (alongX ? len : wdt) / 2, ez = (alongX ? wdt : len) / 2;
        if (!rectFree(cx - ex, cx + ex, cz - ez, cz + ez, ind ? 1.6 : 2.5)) continue;
        const top = r0.y - (ind ? 2.0 + R() * 2.2 : 1.5 + R() * 5);
        addDeck(cx - ex, cx + ex, cz - ez, cz + ez, top, ind ? 0.5 : 1.2, ind ? 'strut' : 'float');
      }
    }
  }
  function deckAt(x, z, m = 0.5) {
    for (const d of decks) if (x > d.x0 + m && x < d.x1 - m && z > d.z0 + m && z < d.z1 - m) return d;
    return null;
  }
  /** ground height for decor at (x, z) → number or null (nothing to stand on) */
  function groundAt(x, z) {
    if (T) { const h = terrainAt(x, z); return h > waterY + 0.25 ? h : null; }
    const d = deckAt(x, z);
    return d ? d.top : null;
  }
  /** yaw so that the prop's front (+Z) faces the vector (vx, vz) */
  const yawTo = (vx, vz) => Math.atan2(vx, vz);
  const FACING = new Set(['house', 'house_blue', 'hut', 'dome', 'arch', 'minaret', 'camel_vacation', 'cat_wall', 'igloo', 'totem', 'deckchair', 'robot_arm', 'statue_sock', 'snowman', 'satellite', 'sign_post', 'gear']);

  // ============================================================ procedural decor (jittered lattice over the distance field)
  const dens = [0.3, 0.55, 1][Q] * (data.envDensity ?? th.density ?? 1);
  const pickW = (list) => {
    let tot = 0; for (const it of list) tot += it[1];
    let x = R() * tot;
    for (const it of list) { x -= it[1]; if (x <= 0) return it; }
    return list[list.length - 1];
  };
  const props = th.props;
  const LX0 = GX0 + 4, LX1 = GX0 + (NX - 1) * CELL - 4, LZ0 = GZ0 + 4, LZ1 = GZ0 + (NZ - 1) * CELL - 4;
  /** is a prop of footprint radius `rad` far enough from every walkable surface? */
  function propClear(x, z, rad) {
    const need = 1.0 + Math.min(rad, 3.5) * 0.7;
    const approx = bil(D, x, z);
    if (approx > need + CELL) return true;
    return exactD(x, z) >= need;
  }
  function scatter(list, e0, e1, spacing, far) {
    if (!list?.length) return;
    for (let gz = LZ0; gz < LZ1; gz += spacing) for (let gx = LX0; gx < LX1; gx += spacing) {
      const x = gx + (R() - 0.5) * spacing * 0.9, z = gz + (R() - 0.5) * spacing * 0.9;
      const d = bil(D, x, z);
      if (d < e0 || d > e1) continue;
      const k0 = nodeOf(x, z);
      if (CLR[k0] || nearSpawnCam(x, z)) continue;
      const it = pickW(list);
      const sc = lerp(it[2], it[3], R());
      const variant = Math.floor(R() * VARIANT_COUNT);
      const y = groundAt(x, z);
      if (y == null) {
        // water / goo / void: a few aquatic or standing-in-the-sea items, asteroids, cloud puffs
        if (T && props.water?.length && R() < 0.35 && terrainAt(x, z) < waterY - 0.2 && exactD(x, z) > 1.6) {
          const w = pickW(props.water);
          place(w[0], x, w[0] === 'lilypad' ? waterY + 0.01 : waterY - 0.35, z, R() * 6.28, lerp(w[2], w[3], R()), { far });
        } else if (!T && th.industrial && far && exactD(x, z) > 4) {
          place(it[0], x, waterY - 0.8, z, R() * 6.28, sc * 1.2, { far: true, variant });
        } else if (!T && th.floating && d >= 8 && R() < 0.5) {
          const fk = th.backdrop?.type === 'tower' ? 'cloud_puff' : 'rock';
          const py = bil(PY, x, z), above = R() < 0.3 && d > 14;
          place(fk, x, above ? py + 7 + R() * 8 : py - 4 - R() * 10, z, R() * 6.28, (fk === 'rock' ? 1 : 2) * (0.8 + R() * 1.8), { far, rx: R() * 3, rz: R() * 3 });
        }
        continue;
      }
      const kk = resolveKind(it[0]) || 'rock';
      const t = getTemplate(kk, pal, palId, variant, far || Q === 0 ? 1 : 0);
      if (!t || !propClear(x, z, t.radius * sc)) continue;
      let ry = R() * Math.PI * 2;
      if (FACING.has(kk)) { const k = nodeOf(x, z); ry = yawTo(QX[k] - x, QZ[k] - z) + (R() - 0.5) * 0.5; }
      place(kk, x, y - 0.06, z, ry, sc, { far, variant });
    }
  }
  if (!data.noAutoDecor && props) {
    scatter(props.near, 1.7, 5.5, 2.8 / Math.sqrt(dens), false);
    scatter(props.mid, 5, 15, 5.0 / Math.sqrt(dens), false);
    scatter(props.far, 15, 42, 14 / Math.sqrt(dens), true);
    if (Q >= 2) scatter(props.far, 42, 72, 28, true);
    // cave ceiling decorations
    if (T?.ceiling) {
      const sp = 9 / Math.sqrt(dens);
      for (let gz = LZ0; gz < LZ1; gz += sp) for (let gx = LX0; gx < LX1; gx += sp) {
        const x = gx + (R() - 0.5) * sp, z = gz + (R() - 0.5) * sp, d = bil(D, x, z);
        if (d < 1.5 || d > 22 || CLR[nodeOf(x, z)]) continue;
        place('stalactite', x, ceilAt(x, z) + 0.6, z, R() * 6.28, 0.8 + R() * 1.2, { far: true });
      }
    }
    // landmarks: one every ~55 m of route, alternating sides, close enough to be seen from the path
    const lm = props.landmarks || [];
    if (lm.length && route.length) {
      let side = R() < 0.5 ? -1 : 1, k = 0, next = 30 + R() * 10;
      for (let i = 0; i < route.length; i++) {
        if (route[i].s < next) continue;
        next = route[i].s + 50 + R() * 25;
        const r0 = route[i], { rx, rz } = frameAt(i), cam = camAt(r0.x, r0.y, r0.z);
        if (cam.mode === 'side') side = -Math.sign(rx * cam.vx + rz * cam.vz) || side;
        const off = acrossOf(r0.p, rx, rz) + 5 + R() * 4;
        const x = r0.x + rx * side * off, z = r0.z + rz * side * off;
        const y = groundAt(x, z), kind = lm[k++ % lm.length];
        const t = getTemplate(kind, pal, palId, 0);
        if (y != null && t && !CLR[nodeOf(x, z)] && propClear(x, z, t.radius)) place(kind, x, y - 0.05, z, yawTo(cam.vx - rx * side, cam.vz - rz * side), 1 + R() * 0.2, { variant: 0 });
        side = -side;
      }
    }
  }

  // ============================================================ gags (parody billboards & posters)
  const gagMeshes = [];
  const night = NIGHT.has(data.theme);
  function makeGag(id, x, y, z, ry, s = 1, override = null, typeOverride = null) {
    const g = GAGS[id] || GAGS.notcrash;
    const type = typeOverride || g.type;
    const spec = gagSpec(id, lang, override);
    if (typeOverride === 'sign') spec.style = 'sign';
    if (type !== 'billboard') { spec.w = 512; spec.h = 384; }
    const tex = signTexture(spec);
    place(type === 'billboard' ? 'billboard' : 'poster_board', x, y, z, ry, s, { variant: 0, tint: 1 });
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: night ? 0.55 : 0.2 });
    mats.push(mat);
    const mesh = new THREE.Mesh(type === 'billboard' ? faceGeoBig : faceGeoSmall, mat);
    const fy = type === 'billboard' ? 3.65 : 1.85, fz = type === 'billboard' ? -0.01 : -0.015;
    mesh.position.set(x + Math.sin(ry) * fz * s, y + fy * s, z + Math.cos(ry) * fz * s);
    mesh.rotation.y = ry;
    mesh.scale.setScalar(s);
    mesh.name = 'gag-' + id;
    root.add(mesh);
    gagMeshes.push(mesh);
    if (g.extra) {
      const ex = g.extra === 'camel_vacation' ? 3.2 : 2.4;
      const gx = x + Math.cos(ry) * ex * s, gz = z - Math.sin(ry) * ex * s;
      const gy = inPlatform(gx, gz, 0) ? y : (groundAt(gx, gz) ?? y);
      if (exactD(gx, gz) > 1.2 || inPlatform(x, z, 0)) place(g.extra, gx, gy, gz, ry + (g.extra === 'cat_wall' ? 0 : -0.5), s, { variant: 0 });
    }
  }
  /** pedestal under something placed over the void */
  function pedestal(x, y, z, size = 2.4) {
    const h = 1.2;
    const sp = T || th.industrial ? (th.industrial ? 'strut' : 'pillar') : 'float';
    meshBox([x - size / 2, y - h, z - size / 2], [x + size / 2, y, z + size / 2], deckStyle, { shade: 0.62, decor: true, support: under === 'void' ? 'float' : sp });
  }
  // explicit text gags in the level → no automatic ones nearby and no duplicates
  const explicitGags = (data.decor || []).filter((d) => d && /^(billboard|poster|sign)$/.test(d.kind));
  const usedGags = new Set(explicitGags.map((d) => d.gag).filter(Boolean));
  if (!data.noGags && th.gags?.length && route.length) {
    const order = th.gags.filter((g) => !usedGags.has(g));
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const total = route[route.length - 1].s;
    const n = Math.min(order.length, Math.max(explicitGags.length ? 0 : 1, Math.floor(total / 45) - explicitGags.length));
    let side = R() < 0.5 ? -1 : 1;
    for (let k = 0, i = 0; k < n && i < route.length; k++) {
      const target = 12 + (k + 0.5) / n * Math.max(10, total - 20);
      while (i < route.length - 1 && route[i].s < target) i++;
      const id = order[k], big = GAGS[id]?.type === 'billboard';
      const r0 = route[i], { rx, rz } = frameAt(i), cam = camAt(r0.x, r0.y, r0.z);
      if (explicitGags.some((d) => Math.hypot(d.x - r0.x, d.z - r0.z) < 30)) continue;
      if (cam.mode === 'side') side = -Math.sign(rx * cam.vx + rz * cam.vz) || side;
      for (const sd of [side, -side]) {
        const off = acrossOf(r0.p, rx, rz) + (big ? 4.5 + R() * 2.5 : 2.6 + R() * 1.6);
        const x = r0.x + rx * sd * off, z = r0.z + rz * sd * off;
        if (exactD(x, z) < (big ? 3.2 : 1.6) || CLR[nodeOf(x, z)]) continue;
        let y = groundAt(x, z);
        if (y == null) { y = r0.y - (big ? 1.5 : 0.6); pedestal(x, y, z, big ? 6 : 2.6); }
        makeGag(id, x, y - 0.05, z, yawTo(cam.vx - rx * sd * 0.5, cam.vz - rz * sd * 0.5), big ? 1 : 1.1);
        side = -sd;
        break;
      }
    }
  }

  // ============================================================ explicit decor (level data)
  placeSrc = 'explicit';
  const FREE = new Set(['planet', 'ufo', 'cloud_puff', 'stalactite']);
  for (const dd of data.decor || []) {
    if (!dd || !Number.isFinite(dd.x) || !Number.isFinite(dd.z)) continue;
    let kind = String(dd.kind || 'rock');
    const s = dd.s ?? 1, r = dd.r ?? 0;
    let x = dd.x, y = dd.y ?? baseY, z = dd.z;
    const free = dd.free || FREE.has(resolveKind(kind) || kind);
    if (!free && !inPlatform(x, z, 0.05)) {
      let g = groundAt(x, z);
      if (g == null && kind !== 'lilypad' && T) {
        // slide outward (away from the nearest walkable surface) onto the bank, up to 5 m
        const k = nodeOf(x, z);
        let vx = x - QX[k], vz = z - QZ[k];
        const l = Math.hypot(vx, vz);
        if (l < 0.01) { vx = right0[0]; vz = right0[1]; } else { vx /= l; vz /= l; }
        for (let st = 1; st <= 10 && g == null; st++) {
          const x2 = x + vx * st * 0.5, z2 = z + vz * st * 0.5;
          if (exactD(x2, z2) < 1) continue;
          g = groundAt(x2, z2);
          if (g != null) { x = x2; z = z2; }
        }
      }
      if (g != null) y = g;
      else if (kind !== 'lilypad') pedestal(x, y, z, Math.max(1.6, 1.8 * s));
      else y = waterY + 0.01;
    }
    if (kind === 'billboard' || kind === 'poster' || kind === 'sign') {
      let override = null;
      if (dd.text) override = typeof dd.text === 'string' ? [dd.text, dd.sub || '', dd.small || ''] : Array.isArray(dd.text) ? dd.text : (dd.text[lang] || dd.text.fr);
      const id = dd.gag && GAGS[dd.gag] ? dd.gag : kind === 'billboard' ? 'notcrash' : 'nobandicoot';
      makeGag(id, x, y, z, r, s, override, kind === 'billboard' ? 'billboard' : kind === 'sign' ? 'sign' : 'poster');
      continue;
    }
    if (!resolveKind(kind)) kind = 'rock';
    place(kind, x, y, z, r, s, { variant: dd.variant });
  }

  // ============================================================ build meshes
  for (const [key, { acc, mat }] of accs) {
    const g = acc.build();
    if (!g) continue;
    geos.push(g);
    const mesh = new THREE.Mesh(g, mat);
    mesh.name = 'plat-' + key;
    const isDecor = key.endsWith(':d');
    mesh.receiveShadow = !!quality.shadows;
    mesh.castShadow = !!quality.shadows && !isDecor && !key.includes(':band');
    if (mat.transparent) mesh.renderOrder = 2;
    root.add(mesh);
  }
  let propVerts = 0;
  const decorMeshes = [];
  for (const [k, c] of chunks) {
    for (const [which, mat] of [['near', propMat], ['far', propMat], ['glow', glowMat]]) {
      const g = c[which].build();
      if (!g) continue;
      geos.push(g);
      propVerts += g.attributes.position.count;
      const mesh = new THREE.Mesh(g, mat);
      mesh.name = `decor-${which}-${k}`;
      if (which === 'near') { mesh.castShadow = !!quality.shadows; mesh.receiveShadow = !!quality.shadows; }
      root.add(mesh);
      decorMeshes.push(mesh);
    }
  }

  // ============================================================ runtime
  let t = 0;
  const baseHemi = th.hemi[2];
  const env = {
    root,
    stats: { propVerts, chunks: chunks.size, platformMeshes: accs.size, kindVerts },
    debug: { placed, terrainAt, camAt, distAt: (x, z) => bil(D, x, z), clearAt: (x, z) => CLR[nodeOf(x, z)], waterY },
    update(dt, ctx = {}) {
      t += dt || 0;
      time.value = t;
      SHARED_TIME.value = t;
      const cam = ctx.camera || camera;
      if (cam) {
        for (const p of parts) p.update?.(dt, cam, t);
        // distance culling: decor chunks fully inside the fog are skipped (frustum culling ignores fog)
        const far = th.fog[1] + 8, cp = cam.position;
        for (const m of decorMeshes) {
          const bs = m.geometry.boundingSphere;
          m.visible = bs.center.distanceTo(cp) - bs.radius < far;
        }
      }
      for (const c of convMats) {
        c.mat.map.offset.y -= (c.speed * dt) / (STYLES.conveyor.ts || 2);
        if (c.mat.map.offset.y < -1000) c.mat.map.offset.y += 1000;
      }
      for (const m of lavaMats) { m.map.offset.x = t * 0.015; m.map.offset.y = t * 0.025; }
      if (th.alarm) hemi.intensity = baseHemi * (0.8 + 0.2 * (0.5 + 0.5 * Math.sin(t * 4)));
      const pl = ctx.player;
      if (sun.castShadow && pl?.pos) focusShadow(pl.pos.x, pl.pos.y, pl.pos.z);
    },
    dispose() {
      scene.remove(root);
      for (const g of geos) g.dispose();
      for (const m of mats) m.dispose();
      for (const p of parts) p.dispose?.();
      if (sun.shadow?.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      sun.dispose?.(); hemi.dispose?.();
      if (envRT) { envRT.dispose(); if (scene.environment === envRT.texture) scene.environment = prev.env ?? null; }
      if ('environmentIntensity' in scene && prev.envI != null) scene.environmentIntensity = prev.envI;
      if (scene.fog && scene.fog.isFog) scene.fog = null;
      scene.background = null;
      if (renderer && prev.exposure != null) renderer.toneMappingExposure = prev.exposure;
      geos.length = 0; mats.length = 0; parts.length = 0;
    },
  };
  return env;
}
