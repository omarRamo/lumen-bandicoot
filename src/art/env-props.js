// Low-poly vertex-coloured decor props. Each kind is a template built once per palette (cached) and then baked
// (world transform) into per-chunk merged meshes by environment.js. Origin = centre of the base, front = +Z.
import * as THREE from 'three';
import { Parts, rng, strSeed, hash2, mixHex, mulHex } from './env-util.js';

// ---------------------------------------------------------------- helpers
/** watertight random deformation (same position → same offset) */
function lumpy(geo, amt, seed = 1, sy = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const h = hash2(Math.round(x * 100) + seed * 13.1, Math.round(y * 100) * 1.7 + Math.round(z * 100) * 0.37);
    const k = 1 + (h - 0.5) * 2 * amt;
    p.setXYZ(i, x * k, y * k * sy, z * k);
  }
  return geo;
}
let LOD = 0;
const ico = (r, d = 0) => new THREE.IcosahedronGeometry(r, LOD ? 0 : d);
/** cheap faceted blob (foliage, bushes, clouds) */
const blob = (r, seed = 1, amt = 0.14) => lumpy(new THREE.SphereGeometry(r, LOD ? 5 : 7, LOD ? 3 : 4), amt, seed);
const dot = (r) => new THREE.OctahedronGeometry(r, 0);
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

// ---------------------------------------------------------------- templates
// signature: (P, pal, r) where P = Parts builder, pal = theme prop palette, r = rng
const T = {
  palm(P, pal, r) {
    const H = 4.6 + r() * 1.4, bend = 0.9 + r() * 0.6;
    const pts = [], NS = P.lod ? 3 : 6;
    for (let i = 0; i <= NS; i++) { const t = i / NS; pts.push([bend * t * t, H * t, 0]); }
    for (let i = 0; i < NS; i++) {
      P.seg(pts[i], pts[i + 1], 0.2 - i * 0.014, 0.19 - (i + 1) * 0.014, i % 2 ? pal.trunk : mulHex(pal.trunk, 0.85), { seg: 6, sway: 0.25, open: true });
      if (!P.lod) P.cyl(0.22 - i * 0.014, 0.2 - i * 0.014, 0.08, mulHex(pal.trunk, 0.7), { x: pts[i][0], y: pts[i][1] + 0.02, seg: 6, sway: 0.25, open: true });
    }
    const top = pts[NS];
    for (let k = 0; k < 3; k++) P.add(dot(0.17), pal.coconut ?? 0x6a4a2a, { x: top[0] + Math.cos(k * 2.1) * 0.18, y: top[1] - 0.15, z: Math.sin(k * 2.1) * 0.18, sway: 1 });
    const n = P.lod ? 5 : 8;
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + r() * 0.3;
      const len = 2.2 + r() * 0.7;
      P.leaf(top, [Math.cos(a), 0.35 + r() * 0.2, Math.sin(a)], len, 0.75, pick(r, pal.leaf), { droop: 0.55, sway: 1 });
    }
    P.add(dot(0.3), pal.leaf[2], { x: top[0], y: top[1] + 0.05, sway: 1 });
  },
  tree(P, pal, r) {
    const H = 2.6 + r() * 1.2;
    P.seg([0, 0, 0], [0.1, H, 0], 0.32, 0.2, pal.trunk, { seg: 7, sway: 0.15 });
    if (!P.lod) P.seg([0.05, H * 0.7, 0], [-0.8, H + 0.6, -0.3], 0.12, 0.08, pal.trunk, { sway: 0.4 });
    let blobs = [[0, H + 0.9, 0, 1.5], [0.9, H + 0.5, 0.3, 1.1], [-0.9, H + 0.7, -0.2, 1.15], [0.2, H + 1.7, -0.3, 1.0], [-0.2, H + 0.4, 0.8, 0.95]];
    if (P.lod) blobs = [[0, H + 0.9, 0, 1.75], [0.9, H + 0.6, 0.3, 1.25], [-0.8, H + 0.8, -0.2, 1.3]];
    if (!P.lod) P.seg([0.05, H * 0.6, 0], [0.9, H + 0.4, 0.2], 0.12, 0.08, pal.trunk, { sway: 0.4 });
    for (const [x, y, z, s] of blobs) P.add(blob(s * (0.9 + r() * 0.2), r() * 99, 0.12), pick(r, pal.leaf), { x, y, z, sway: 0.6 });
  },
  pine(P, pal, r) {
    const H = 3.5 + r() * 1.5;
    P.cyl(0.18, 0.24, 1.0, pal.trunk, { y: 0.5 });
    for (let i = 0; i < 4; i++) {
      const t = i / 4, rad = 1.5 * (1 - t * 0.7), y = 0.9 + t * (H - 1.2);
      P.cone(rad, 1.5, pal.pine ?? pal.leaf[2], { y: y + 0.75, seg: 8, sway: 0.3 });
      if (pal.snowy) P.cone(rad * 0.72, 0.55, 0xf6faff, { y: y + 1.25, seg: 8, sway: 0.3 });
    }
  },
  fern(P, pal, r) {
    const n = 7 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const a = k / n * Math.PI * 2 + r() * 0.4;
      P.leaf([0, 0.05, 0], [Math.cos(a), 0.9 + r() * 0.4, Math.sin(a)], 0.9 + r() * 0.5, 0.35, pick(r, pal.leaf), { droop: 0.7, sway: 1 });
    }
  },
  grass_tuft(P, pal, r) {
    for (let k = 0; k < 6; k++) {
      const a = r() * Math.PI * 2;
      P.leaf([Math.cos(a) * 0.1, 0, Math.sin(a) * 0.1], [Math.cos(a) * 0.3, 1, Math.sin(a) * 0.3], 0.45 + r() * 0.3, 0.12, pick(r, pal.leaf), { droop: 0.2, sway: 1 });
    }
  },
  bush(P, pal, r) {
    const n = 3 + Math.floor(r() * 2);
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.28 + r(), d = k ? 0.45 : 0;
      P.add(blob(0.55 + r() * 0.25, r() * 50, 0.15), pick(r, pal.leaf), { x: Math.cos(a) * d, y: 0.4 + r() * 0.2, z: Math.sin(a) * d, sy: 0.85, sway: 0.25 });
    }
    if (pal.flower && r() < 0.6) {
      const fc = pick(r, pal.flower);
      for (let k = 0; k < 6; k++) { const a = r() * 6.28; P.add(dot(0.09), fc, { x: Math.cos(a) * 0.6, y: 0.55 + r() * 0.4, z: Math.sin(a) * 0.6, sway: 0.3 }); }
    }
  },
  bougainvillea(P, pal, r) {
    for (let k = 0; k < 5; k++) {
      const a = k / 5 * 6.28, d = k ? 0.6 : 0;
      P.add(blob(0.6 + r() * 0.3, r() * 50, 0.2), k % 2 ? 0xd94a9a : 0xf06ab8, { x: Math.cos(a) * d, y: 0.6 + r() * 0.5, z: Math.sin(a) * d, sway: 0.3 });
    }
    P.add(blob(0.5, 3, 0.2), 0x4f9a48, { x: 0.3, y: 0.3, z: 0.3 });
  },
  flowers(P, pal, r) {
    const cols = pal.flower ?? [0xe98c73, 0xffd76a];
    for (let k = 0; k < 5; k++) {
      const x = (r() - 0.5) * 0.8, z = (r() - 0.5) * 0.8, h = 0.25 + r() * 0.3;
      P.seg([x, 0, z], [x, h, z], 0.02, 0.02, pal.leaf[1], { seg: 3, sway: 1, open: true });
      P.add(dot(0.09), pick(r, cols), { x, y: h, z, sway: 1 });
    }
  },
  rock(P, pal, r) {
    P.add(lumpy(ico(0.8, 0), 0.25, r() * 999, 0.7), pal.rock, { y: 0.35, sy: 0.75, ry: r() * 6 });
    if (r() < 0.5) P.add(lumpy(ico(0.4, 0), 0.25, r() * 999), pal.rockDark ?? mulHex(pal.rock, 0.8), { x: 0.7, y: 0.15, z: 0.2 });
    if (pal.moss && r() < 0.5) P.add(lumpy(ico(0.5, 0), 0.2, 4), pal.moss, { y: 0.78, sy: 0.25, x: -0.1 });
  },
  boulder(P, pal, r) { P.add(lumpy(ico(1.6, 1), 0.18, r() * 999), pal.rock, { y: 0.9, sy: 0.7 }); },
  totem(P, pal, r) {
    const cols = [0xc0703e, 0x8a5a34, 0xe98c73];
    for (let i = 0; i < 3; i++) {
      const y = i * 0.85;
      P.box(0.8, 0.8, 0.7, cols[i % 3], { y: y + 0.4 });
      P.box(0.18, 0.18, 0.06, 0xfff7dc, { x: -0.18, y: y + 0.55, z: 0.36 });
      P.box(0.18, 0.18, 0.06, 0xfff7dc, { x: 0.18, y: y + 0.55, z: 0.36 });
      P.box(0.08, 0.08, 0.08, 0x1c1640, { x: -0.18, y: y + 0.55, z: 0.4 });
      P.box(0.08, 0.08, 0.08, 0x1c1640, { x: 0.18, y: y + 0.55, z: 0.4 });
      P.box(0.46, 0.12, 0.06, i === 1 ? 0xffffff : 0x1c1640, { y: y + 0.22, z: 0.36 });
    }
    P.box(1.6, 0.18, 0.3, 0x387d76, { y: 2.6 });
    P.cone(0.3, 0.5, 0xedc371, { y: 2.95, seg: 4 });
  },
  tiki_torch(P, pal, r) {
    P.cyl(0.06, 0.08, 1.8, 0xc8a060, { y: 0.9 });
    for (let i = 0; i < 4; i++) P.cyl(0.085, 0.085, 0.05, 0x8a6040, { y: 0.3 + i * 0.4 });
    P.cyl(0.2, 0.1, 0.25, 0x6a4428, { y: 1.9 });
    P.cone(0.17, 0.5, 0xff9a3a, { y: 2.25, glow: true, seg: 6 });
    P.cone(0.09, 0.32, 0xfff0a0, { y: 2.2, glow: true, seg: 5 });
  },
  lilypad(P, pal, r) {
    P.add(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 14, 1, false, 0.3, Math.PI * 1.8), 0x4fae5a, { y: 0.02 });
    if (r() < 0.4) { P.cone(0.18, 0.2, 0xf6a6c6, { y: 0.15, seg: 6, x: 0.2 }); P.ball(0.06, 0xffe08a, { y: 0.22, x: 0.2 }); }
  },
  reeds(P, pal, r) {
    for (let k = 0; k < 7; k++) {
      const x = (r() - 0.5) * 0.7, z = (r() - 0.5) * 0.7, h = 1.1 + r() * 0.8;
      P.seg([x, 0, z], [x + (r() - 0.5) * 0.2, h, z], 0.035, 0.02, 0x6aa048, { seg: 3, sway: 1 });
      if (r() < 0.6) P.cyl(0.06, 0.06, 0.3, 0x7a4a2a, { x: x, y: h - 0.1, z, seg: 5, sway: 1 });
    }
  },
  mushroom(P, pal, r) {
    const H = 1.2 + r() * 1.2, R = 0.8 + r() * 0.6, c = pick(r, [0xe85a4a, 0xe98c73, 0xdbb2f6, 0x5ad0b0]);
    P.cyl(0.18, 0.26, H, 0xfff2dc, { y: H / 2, seg: 6, open: true });
    P.sphere(R, c, { y: H - 0.1, cap: Math.PI / 2, ws: 9, hs: 3, sy: 0.7 });
    P.cyl(R * 0.98, R * 0.7, 0.12, 0xf4e2c8, { y: H - 0.12, seg: 9, open: true });
    for (let k = 0; k < 6; k++) { const a = r() * 6.28, d = R * (0.3 + r() * 0.45); P.add(dot(0.13), 0xffffff, { x: Math.cos(a) * d, y: H - 0.1 + Math.sqrt(Math.max(0, R * R - d * d)) * 0.7, z: Math.sin(a) * d, sy: 0.4 }); }
  },
  log(P, pal, r) {
    P.cyl(0.35, 0.35, 2.4, pal.trunk, { y: 0.32, rz: Math.PI / 2, seg: 8 });
    P.cyl(0.3, 0.3, 2.42, 0xd8b07a, { y: 0.32, rz: Math.PI / 2, seg: 8, sy: 1 });
    P.cyl(0.36, 0.36, 2.3, pal.trunk, { y: 0.32, rz: Math.PI / 2, seg: 8 });
    if (pal.moss) P.add(lumpy(ico(0.4, 0), 0.2, 5), pal.moss, { y: 0.6, x: 0.4, sy: 0.4 });
  },
  hut(P, pal, r) {
    P.cyl(1.4, 1.5, 1.8, 0xd8b07a, { y: 0.9, seg: 10 });
    P.box(0.7, 1.2, 0.2, 0x4a2c18, { y: 0.6, z: 1.42 });
    P.cone(2.2, 1.7, 0xe8c060, { y: 2.6, seg: 10 });
    P.cone(2.25, 0.4, 0xc89a40, { y: 1.95, seg: 10, open: true });
    for (let k = 0; k < 4; k++) P.cyl(0.07, 0.07, 2, 0x8a5a34, { x: Math.cos(k * 1.57 + 0.78) * 1.5, y: 1, z: Math.sin(k * 1.57 + 0.78) * 1.5 });
  },
  umbrella(P, pal, r) {
    const cols = [pick(r, [0xe98c73, 0x387d76, 0x2a6fd0, 0xedc371]), 0xfff7dc];
    P.cyl(0.04, 0.04, 2.2, 0xd8d0c0, { y: 1.1, rz: 0.08 });
    for (let k = 0; k < 8; k++) P.add(new THREE.ConeGeometry(1.4, 0.6, 2, 1, false, k * Math.PI / 4, Math.PI / 4), cols[k % 2], { y: 2.3, x: 0.08, sway: 0.15 });
    P.box(0.6, 0.05, 1.6, cols[0], { x: 0.9, y: 0.03, z: 0.4, ry: 0.4 });
  },
  deckchair(P, pal, r) {
    const c = pick(r, [0xe98c73, 0x387d76, 0x2a6fd0]);
    P.box(0.6, 0.05, 1.3, c, { y: 0.35, rx: -0.35 });
    P.box(0.6, 0.05, 0.6, c, { y: 0.6, z: -0.7, rx: 0.9 });
    for (const x of [-0.3, 0.3]) { P.box(0.05, 0.05, 1.5, 0xd8b07a, { x, y: 0.3, rx: -0.35 }); P.box(0.05, 0.8, 0.05, 0xd8b07a, { x, y: 0.4, z: -0.6 }); }
  },
  shell(P, pal, r) {
    P.add(new THREE.ConeGeometry(0.6, 1.4, 9, 4).rotateZ(Math.PI / 2.4), 0xf6c6b8, { y: 0.45 });
    P.torus(0.45, 0.12, 0xf0a090, { y: 0.4, x: -0.4, ry: Math.PI / 2 });
  },
  coral(P, pal, r) {
    const c = pick(r, [0xf06a8a, 0xf0a060, 0xdbb2f6]);
    for (let k = 0; k < 5; k++) {
      const a = r() * 6.28, h = 0.6 + r() * 0.6;
      P.seg([0, 0, 0], [Math.cos(a) * 0.4, h, Math.sin(a) * 0.4], 0.12, 0.07, c);
      P.add(dot(0.1), mixHex(c, 0xffffff, 0.3), { x: Math.cos(a) * 0.4, y: h, z: Math.sin(a) * 0.4 });
    }
  },
  cactus(P, pal, r) {
    const H = 1.6 + r() * 1.2, g = pal.cactus ?? 0x4f9a5a;
    P.cyl(0.28, 0.32, H, g, { y: H / 2, seg: 8 });
    P.sphere(0.28, g, { y: H, cap: Math.PI / 2, ws: 8, hs: 3 });
    const arm = (side, y0, h) => {
      P.seg([side * 0.2, y0, 0], [side * 0.65, y0 + 0.1, 0], 0.15, 0.15, g, { seg: 6 });
      P.seg([side * 0.62, y0, 0], [side * 0.62, y0 + h, 0], 0.16, 0.15, g, { seg: 6 });
      P.sphere(0.15, g, { x: side * 0.62, y: y0 + h, cap: Math.PI / 2, ws: 6, hs: 3 });
    };
    arm(1, H * 0.4, 0.6 + r() * 0.4);
    if (r() < 0.7) arm(-1, H * 0.55, 0.4 + r() * 0.4);
    if (r() < 0.5) P.ball(0.12, 0xf06ab8, { y: H + 0.25, detail: 0 });
    for (let k = 0; k < 5; k++) P.add(dot(0.05), 0xfff7dc, { x: Math.cos(k * 2.4) * 0.3, y: 0.3 + k * H / 6, z: Math.sin(k * 2.4) * 0.3, sy: 1.6 });
  },
  dune(P, pal, r) {
    P.add(lumpy(new THREE.SphereGeometry(3, 12, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0.08, r() * 99), pal.sand, { sy: 0.45, sx: 1.6, smooth: true });
  },
  house_blue(P, pal, r) {
    const w = 3 + r() * 1.2, h = 2.6 + r() * 1.8, d = 3;
    const blue = 0x2a6fd0;
    P.box(w, h, d, 0xfbf8f0, { y: h / 2 });
    P.box(w + 0.2, 0.25, d + 0.2, 0xf2ede2, { y: h + 0.1 });
    // arched door
    P.box(0.9, 1.4, 0.12, blue, { y: 0.7, z: d / 2 + 0.02, x: -w * 0.15 });
    P.cyl(0.45, 0.45, 0.12, blue, { y: 1.4, z: d / 2 + 0.02, x: -w * 0.15, rx: Math.PI / 2, seg: 10 });
    for (let k = 0; k < 3; k++) P.ball(0.05, 0x1c1640, { x: -w * 0.15 + (k - 1) * 0.25, y: 0.9, z: d / 2 + 0.1, detail: 0 });
    // window with moucharabieh
    P.box(0.8, 0.9, 0.3, blue, { y: h * 0.62, z: d / 2 + 0.12, x: w * 0.22 });
    P.box(0.9, 0.12, 0.38, 0x1a4fa0, { y: h * 0.62 - 0.5, z: d / 2 + 0.16, x: w * 0.22 });
    if (r() < 0.5) P.sphere(0.9, 0xfbf8f0, { y: h + 0.2, x: w * 0.2, cap: Math.PI / 2, ws: 10, hs: 4 });
    if (r() < 0.6) for (let k = 0; k < 4; k++) P.add(lumpy(ico(0.35, 0), 0.2, k), k % 2 ? 0xd94a9a : 0xf06ab8, { x: -w / 2 + 0.2 + k * 0.3, y: h * 0.85 - k * 0.3, z: d / 2 + 0.15 });
  },
  house(P, pal, r) {
    const w = 3 + r() * 1.5, h = 3 + r() * 2.5, d = 3.2;
    const wall = pick(r, pal.walls ?? [0xe4b880, 0xd8a468, 0xecc898]);
    P.box(w, h, d, wall, { y: h / 2 });
    P.box(w + 0.15, 0.3, d + 0.15, mulHex(wall, 0.9), { y: h + 0.15 });
    for (let k = 0; k < 4; k++) P.box(0.15, 0.15, 0.6, 0x8a5a34, { x: -w / 2 + 0.4 + k * (w - 0.8) / 3, y: h - 0.4, z: d / 2 + 0.2 });
    P.box(0.9, 1.6, 0.1, 0x8a5a34, { y: 0.8, z: d / 2 + 0.02 });
    P.cyl(0.45, 0.45, 0.1, 0x8a5a34, { y: 1.6, z: d / 2 + 0.02, rx: Math.PI / 2, seg: 10 });
    P.box(0.6, 0.6, 0.1, 0x387d76, { x: w * 0.28, y: h * 0.65, z: d / 2 + 0.03 });
    P.box(0.6, 0.6, 0.1, 0x387d76, { x: -w * 0.28, y: h * 0.65, z: d / 2 + 0.03 });
    if (r() < 0.4) P.box(1.2, 0.05, 0.8, pick(r, [0xe98c73, 0x2a6fd0, 0xedc371]), { y: 2.1, z: d / 2 + 0.4, rx: 0.4 }); // awning
  },
  arch(P, pal, r) {
    const c = pal.archCol ?? 0xe8c898, tile = 0x387d76;
    P.box(0.7, 3, 0.7, c, { x: -1.4, y: 1.5 });
    P.box(0.7, 3, 0.7, c, { x: 1.4, y: 1.5 });
    P.add(new THREE.TorusGeometry(1.4, 0.36, 5, 14, Math.PI * 1.15).rotateZ(-Math.PI * 0.075), c, { y: 3 });
    P.box(3.9, 0.7, 0.8, c, { y: 4.5 });
    P.box(3.9, 0.18, 0.86, tile, { y: 4.1 });
    for (let k = 0; k < 5; k++) P.box(0.4, 0.35, 0.8, c, { x: -1.6 + k * 0.8, y: 5 });
  },
  dome(P, pal, r) {
    P.box(3, 2.4, 3, 0xfbf8f0, { y: 1.2 });
    P.cyl(1.2, 1.3, 0.5, 0xfbf8f0, { y: 2.6, seg: 12 });
    P.sphere(1.25, pal.domeCol ?? 0xfbf8f0, { y: 2.8, cap: Math.PI / 2, ws: 14, hs: 6 });
    P.cyl(0.04, 0.04, 0.7, 0xedc371, { y: 4.3 });
    P.ball(0.1, 0xedc371, { y: 4.5 });
    P.box(0.8, 1.4, 0.1, 0x387d76, { y: 0.7, z: 1.52 });
  },
  minaret(P, pal, r) {
    const c = pal.archCol ?? 0xe8c898;
    P.box(1.6, 8, 1.6, c, { y: 4 });
    P.box(1.9, 0.3, 1.9, mulHex(c, 0.9), { y: 6.6 });
    for (let k = 0; k < 4; k++) P.box(0.3, 0.4, 0.3, c, { x: (k % 2 ? 0.8 : -0.8), y: 6.95, z: (k > 1 ? 0.8 : -0.8) });
    P.box(1.0, 1.4, 1.0, c, { y: 7.5 + 0.4 });
    P.box(0.3, 0.6, 0.1, 0x387d76, { y: 7.8, z: 0.51 });
    P.box(0.3, 0.9, 0.1, 0x387d76, { y: 4.6, z: 0.81 });
    P.sphere(0.5, 0x387d76, { y: 8.6, cap: Math.PI / 2, ws: 8, hs: 3 });
    P.cyl(0.03, 0.03, 0.6, 0xedc371, { y: 9.3 });
  },
  lantern(P, pal, r) {
    P.cyl(0.05, 0.07, 2.2, 0x2a2630, { y: 1.1 });
    P.box(0.5, 0.05, 0.05, 0x2a2630, { y: 2.15, x: 0.25 });
    P.cyl(0.18, 0.22, 0.5, pal.lanternGlow ?? 0xffc860, { x: 0.45, y: 1.75, glow: true, seg: 6 });
    P.cone(0.25, 0.25, 0x387d76, { x: 0.45, y: 2.12, seg: 6 });
    P.cyl(0.22, 0.12, 0.08, 0x2a2630, { x: 0.45, y: 1.48, seg: 6 });
  },
  pot(P, pal, r) {
    const pts = [[0.0, 0], [0.22, 0.02], [0.35, 0.25], [0.38, 0.5], [0.26, 0.8], [0.16, 0.92], [0.2, 1.0]].map(([x, y]) => new THREE.Vector2(x, y));
    P.add(new THREE.LatheGeometry(pts, 9), pal.potCol ?? 0xc8703e, { smooth: true });
    P.cyl(0.385, 0.385, 0.08, 0x2a6fd0, { y: 0.5, seg: 9 });
  },
  camel_vacation(P, pal, r) {
    const c = 0xd8a060;
    P.add(new THREE.SphereGeometry(0.8, 10, 7), c, { y: 0.55, sx: 1.4, sy: 0.6, smooth: true });
    P.sphere(0.45, c, { y: 1.0, x: -0.3, sy: 0.9 });
    P.sphere(0.4, c, { y: 0.95, x: 0.35, sy: 0.9 });
    P.seg([0.95, 0.6, 0], [1.3, 1.6, 0], 0.2, 0.16, c, { seg: 6 });
    P.add(new THREE.SphereGeometry(0.3, 8, 6), c, { x: 1.45, y: 1.7, sx: 1.4, sy: 0.8, smooth: true });
    P.box(0.12, 0.1, 0.5, 0x1c1640, { x: 1.62, y: 1.78 }); // sunglasses
    P.box(0.05, 0.04, 0.5, 0x1c1640, { x: 1.52, y: 1.8 });
    P.cyl(0.25, 0.3, 0.3, 0xe98c73, { x: 1.4, y: 2.0, seg: 8 }); // little hat
    P.cyl(0.42, 0.42, 0.03, 0xe98c73, { x: 1.4, y: 1.86, seg: 10 });
    P.box(2.6, 0.03, 1.4, 0x387d76, { y: 0.02, x: 0.2 }); // beach towel
    P.box(0.6, 0.032, 1.4, 0xfff7dc, { y: 0.03, x: -0.4 });
    // parasol
    P.cyl(0.04, 0.04, 2.4, 0xd8d0c0, { x: -1.4, y: 1.2, z: -0.6 });
    for (let k = 0; k < 8; k++) P.add(new THREE.ConeGeometry(1.5, 0.6, 2, 1, false, k * Math.PI / 4, Math.PI / 4), k % 2 ? 0xfff7dc : 0xe98c73, { x: -1.4, y: 2.5, z: -0.6, sway: 0.1 });
    // cocktail
    P.cyl(0.08, 0.04, 0.2, 0x9fe8f0, { x: 0.7, y: 0.12, z: 0.9 });
    P.ball(0.05, 0xedc371, { x: 0.75, y: 0.24, z: 0.9 });
  },
  cat(P, pal, r) {
    const c = pick(r, [0xf4f0e8, 0xf0b060, 0x8a8a90]);
    P.add(new THREE.SphereGeometry(0.3, 8, 6), c, { y: 0.17, sx: 1.4, sy: 0.6, smooth: true });
    P.sphere(0.17, c, { x: 0.38, y: 0.22 });
    P.cone(0.07, 0.14, c, { x: 0.33, y: 0.4, z: -0.08, seg: 4 });
    P.cone(0.07, 0.14, c, { x: 0.33, y: 0.4, z: 0.08, seg: 4 });
    P.add(new THREE.TorusGeometry(0.28, 0.05, 4, 10, Math.PI), c, { y: 0.05, x: -0.1, rx: Math.PI / 2 });
    P.box(0.02, 0.02, 0.1, 0x1c1640, { x: 0.52, y: 0.25, z: -0.06 });
    P.box(0.02, 0.02, 0.1, 0x1c1640, { x: 0.52, y: 0.25, z: 0.06 });
  },
  cat_wall(P, pal, r) {
    P.box(3, 1.1, 0.7, 0xfbf8f0, { y: 0.55 });
    P.box(3.1, 0.12, 0.8, 0x2a6fd0, { y: 1.14 });
    P.push({ y: 1.2, ry: Math.PI / 2 * 0 });
    T.cat(P, pal, r);
    P.pop();
  },
  igloo(P, pal, r) {
    P.sphere(1.6, 0xf4f8ff, { cap: Math.PI / 2, ws: 14, hs: 6 });
    for (let k = 1; k < 4; k++) P.cyl(1.6 * Math.cos(k * 0.38) + 0.01, 1.6 * Math.cos(k * 0.38) + 0.01, 0.03, 0xc8d8ec, { y: 1.6 * Math.sin(k * 0.38), seg: 14 });
    P.add(new THREE.CylinderGeometry(0.6, 0.6, 1.2, 10, 1, false, 0, Math.PI), 0xf4f8ff, { y: 0, z: 1.6, rx: Math.PI / 2, rz: Math.PI / 2 });
    P.box(0.8, 0.7, 0.1, 0x2a3a5a, { y: 0.35, z: 2.15 });
  },
  ice_spike(P, pal, r) {
    const n = 3 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const h = 1.2 + r() * 2.4, a = r() * 6.28, d = k ? 0.4 + r() * 0.4 : 0;
      P.cone(0.3 + h * 0.08, h, pick(r, [0xbfe8ff, 0x9fd8f4, 0xe4f6ff]), { x: Math.cos(a) * d, y: h / 2, z: Math.sin(a) * d, rz: (r() - 0.5) * 0.3, seg: 5 });
    }
  },
  snowman(P, pal, r) {
    P.sphere(0.55, 0xf6faff, { y: 0.5 });
    P.sphere(0.4, 0xf6faff, { y: 1.2 });
    P.sphere(0.28, 0xf6faff, { y: 1.75 });
    P.cone(0.06, 0.35, 0xff8a30, { y: 1.75, z: 0.4, rx: Math.PI / 2, seg: 5 });
    P.ball(0.04, 0x1c1640, { x: -0.1, y: 1.85, z: 0.24, detail: 0 }); P.ball(0.04, 0x1c1640, { x: 0.1, y: 1.85, z: 0.24, detail: 0 });
    P.torus(0.3, 0.07, 0xe98c73, { y: 1.5, rx: Math.PI / 2 });
    P.box(0.12, 0.4, 0.06, 0xe98c73, { x: 0.2, y: 1.3, z: 0.3 });
    P.seg([0.35, 1.25, 0], [0.9, 1.6, 0], 0.03, 0.02, 0x6a4428);
    P.seg([-0.35, 1.25, 0], [-0.85, 1.5, 0.1], 0.03, 0.02, 0x6a4428);
    P.cyl(0.2, 0.2, 0.3, 0x1c1640, { y: 2.1 }); P.cyl(0.3, 0.3, 0.04, 0x1c1640, { y: 1.97 });
  },
  crystal(P, pal, r) {
    const cols = pal.crystal ?? [0xb88af0, 0x6ad8d0, 0xdbb2f6];
    const n = 4 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const h = 0.8 + r() * 1.8, a = r() * 6.28, d = k ? 0.3 + r() * 0.3 : 0;
      P.add(new THREE.OctahedronGeometry(0.3, 0), pick(r, cols), { x: Math.cos(a) * d, y: h * 0.45, z: Math.sin(a) * d, sy: h / 0.6 * 0.9, rz: Math.cos(a) * 0.4, rx: Math.sin(a) * 0.4, glow: k % 2 === 0 });
    }
    P.add(lumpy(ico(0.5, 0), 0.2, 9), pal.rockDark ?? 0x3a3060, { y: 0.1, sy: 0.4 });
  },
  stalagmite(P, pal, r) {
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const h = 1 + r() * 3, a = r() * 6.28, d = k ? 0.5 : 0;
      P.add(lumpy(new THREE.ConeGeometry(0.35 + h * 0.12, h, P.lod ? 5 : 6, P.lod ? 1 : 2), 0.12, r() * 99), pal.rock, { x: Math.cos(a) * d, y: h / 2, z: Math.sin(a) * d });
    }
  },
  pipe(P, pal, r) {
    const c = pick(r, pal.pipes ?? [0x387d76, 0xe98c73, 0x8a92a0]);
    const H = 3 + r() * 2;
    P.cyl(0.4, 0.4, H, c, { y: H / 2, seg: 10 });
    P.add(new THREE.TorusGeometry(0.9, 0.4, 8, 10, Math.PI / 2), c, { x: 0.9, y: H, rz: 0, ry: 0, rx: 0, smooth: true });
    P.cyl(0.4, 0.4, 2.5, c, { x: 2.1, y: H + 0.9, rz: Math.PI / 2, seg: 10 });
    for (const y of [0.3, H * 0.5]) P.cyl(0.5, 0.5, 0.15, 0x5a6270, { y, seg: 10 });
    P.cyl(0.5, 0.5, 0.15, 0x5a6270, { x: 2.0, y: H + 0.9, rz: Math.PI / 2, seg: 10 });
    P.cyl(0.25, 0.25, 0.3, 0xedc371, { x: 0.45, y: H * 0.7, rz: Math.PI / 2, seg: 8 }); // valve
  },
  gear(P, pal, r) {
    const R = 1.4, c = pal.gearCol ?? 0xa8a090;
    P.cyl(R, R, 0.4, c, { y: R + 0.3, rx: Math.PI / 2, seg: 16 });
    for (let k = 0; k < 12; k++) { const a = k / 12 * Math.PI * 2; P.box(0.4, 0.45, 0.4, c, { x: Math.cos(a) * (R + 0.15), y: R + 0.3 + Math.sin(a) * (R + 0.15), rz: a }); }
    P.cyl(0.4, 0.4, 0.5, 0x5a6270, { y: R + 0.3, rx: Math.PI / 2, seg: 8 });
    P.box(0.3, R + 0.3, 0.3, 0x5a6270, { y: (R + 0.3) / 2, z: -0.35 });
  },
  tube(P, pal, r) {
    const H = 2.4 + r() * 1.2, liq = pick(r, [0x7af07a, 0x7ff0e0, 0xdbb2f6]);
    P.cyl(0.6, 0.6, 0.35, 0x6a7280, { y: 0.17, seg: 10 });
    P.cyl(0.42, 0.42, H * 0.7, liq, { y: 0.35 + H * 0.35, seg: 10, glow: true });
    P.cyl(0.5, 0.5, H, 0xcff4ff, { y: 0.35 + H / 2, seg: 10, open: true });
    P.cyl(0.6, 0.6, 0.3, 0x6a7280, { y: 0.35 + H + 0.15, seg: 10 });
    for (let k = 0; k < 3; k++) P.ball(0.08, mixHex(liq, 0xffffff, 0.5), { y: 0.6 + k * H * 0.2, x: (r() - 0.5) * 0.4, glow: true, detail: 0 });
    P.seg([0.4, 0.35 + H + 0.2, 0], [1.4, 0.35 + H + 0.6, 0], 0.08, 0.08, 0x8a92a0);
  },
  tank(P, pal, r) {
    const H = 2.2 + r(), c = pick(r, [0xedc371, 0x99d1b7, 0xe98c73]);
    P.cyl(1, 1, H, c, { y: H / 2, seg: 12 });
    P.cyl(1.02, 1.02, 0.4, 0x2a2630, { y: H * 0.6, seg: 12 });
    P.sphere(1, c, { y: H, cap: Math.PI / 2, ws: 12, hs: 4, sy: 0.4 });
    for (let k = 0; k < 6; k++) P.box(0.4, 0.05, 0.05, 0x5a6270, { x: 1.05, y: 0.3 + k * H / 6 });
    P.box(0.05, H, 0.05, 0x5a6270, { x: 1.05, z: 0.2, y: H / 2 }); P.box(0.05, H, 0.05, 0x5a6270, { x: 1.05, z: -0.2, y: H / 2 });
  },
  barrel(P, pal, r) {
    const c = pick(r, [0x8a5a34, 0x387d76, 0xe98c73]);
    P.cyl(0.42, 0.42, 1.1, c, { y: 0.55, seg: 10, sy: 1 });
    P.cyl(0.45, 0.45, 0.08, 0x5a6270, { y: 0.2, seg: 10 }); P.cyl(0.45, 0.45, 0.08, 0x5a6270, { y: 0.9, seg: 10 });
  },
  chimney(P, pal, r) {
    const H = 9 + r() * 6;
    P.cyl(0.9, 1.3, H, 0x9a4a3a, { y: H / 2, seg: 10 });
    for (let k = 0; k < 2; k++) P.cyl(1.0 + k * 0.05, 1.05 + k * 0.05, 0.6, 0xfff7dc, { y: H * (0.65 + k * 0.2), seg: 10 });
    P.cyl(1.05, 0.95, 0.5, 0x3a3440, { y: H + 0.25, seg: 10 });
    for (let k = 0; k < 4; k++) P.add(blob(0.8 + k * 0.35, k, 0.15), mixHex(pal.smoke ?? 0xb0a8b8, 0xffffff, k * 0.08), { x: k * 0.6, y: H + 1 + k * 1.1, z: -k * 0.2, sway: 1 });
  },
  billboard(P, pal, r) {
    // frame only (the face is a separate textured plane added by env-gags)
    P.box(0.25, 4.2, 0.25, 0x5a6270, { x: -2.2, y: 2.1 });
    P.box(0.25, 4.2, 0.25, 0x5a6270, { x: 2.2, y: 2.1 });
    P.box(5.6, 2.9, 0.18, 0x3a3440, { y: 3.65, z: -0.12 });
    P.box(5.8, 0.15, 0.6, 0x5a6270, { y: 2.2, z: 0.2 });
    for (const x of [-1.8, 0, 1.8]) { P.box(0.08, 0.4, 0.08, 0x2a2630, { x, y: 5.35, z: 0.25 }); P.cone(0.18, 0.22, 0xfff0b0, { x, y: 5.12, z: 0.35, rx: -2.3, glow: true, seg: 6 }); }
  },
  poster_board(P, pal, r) {
    P.box(0.12, 2.6, 0.12, 0x8a5a34, { x: -0.8, y: 1.3 });
    P.box(0.12, 2.6, 0.12, 0x8a5a34, { x: 0.8, y: 1.3 });
    P.box(2.0, 1.5, 0.1, 0x6a4428, { y: 1.85, z: -0.08 });
  },
  sign_round(P, pal, r) {
    P.cyl(0.06, 0.06, 2.6, 0x8a92a0, { y: 1.3 });
    P.cyl(0.7, 0.7, 0.06, 0xffffff, { y: 2.4, z: -0.05, rx: Math.PI / 2, seg: 18 });
  },
  planet(P, pal, r) {
    const c = pick(r, [0xe98c73, 0x99d1b7, 0xdbb2f6, 0xedc371]);
    P.sphere(2, c, { y: 2, ws: 16, hs: 12 });
    for (let k = 0; k < 4; k++) { const a = r() * 6.28, b = r() * 3; P.sphere(0.4 + r() * 0.3, mulHex(c, 0.8), { x: Math.cos(a) * Math.sin(b) * 1.75, y: 2 + Math.cos(b) * 1.75, z: Math.sin(a) * Math.sin(b) * 1.75, sy: 0.4, ws: 6, hs: 4 }); }
    P.add(new THREE.RingGeometry(2.6, 3.6, 24, 1), 0xfff7dc, { y: 2, rx: -Math.PI / 2 + 0.4, rz: 0.2 });
    P.add(new THREE.RingGeometry(2.6, 3.6, 24, 1), 0xfff7dc, { y: 2, rx: Math.PI / 2 + 0.4, rz: -0.2 });
  },
  statue_sock(P, pal, r) {
    P.box(1.6, 0.8, 1.6, 0xfff7dc, { y: 0.4 });
    P.box(1.8, 0.15, 1.8, 0xedc371, { y: 0.85 });
    const g = 0xffd76a;
    P.box(0.8, 2.2, 0.6, g, { y: 2.0 });
    P.box(0.8, 0.6, 1.4, g, { y: 1.2, z: 0.4 });
    P.sphere(0.4, g, { y: 1.2, z: 1.1, sx: 1, sy: 0.75 });
    P.box(0.85, 0.35, 0.65, 0xe98c73, { y: 3.0 });
    P.box(0.85, 0.12, 0.65, 0x387d76, { y: 2.5 });
    for (let k = 0; k < 6; k++) { const a = k * 1.05; P.cone(0.07, 0.4, 0xfff0a0, { x: Math.cos(a) * 1.2, y: 3.4 + (k % 2) * 0.3, z: Math.sin(a) * 1.2, glow: true, seg: 4 }); }
  },
  crate_pile(P, pal, r) {
    const crate = (x, y, z, ry) => {
      P.box(1, 1, 1, 0xc08a52, { x, y: y + 0.5, z, ry });
      P.box(1.02, 0.12, 1.02, 0x6a4428, { x, y: y + 0.94, z, ry }); P.box(1.02, 0.12, 1.02, 0x6a4428, { x, y: y + 0.06, z, ry });
      P.box(0.12, 1.02, 1.02, 0x6a4428, { x: x + Math.cos(ry) * 0.45, y: y + 0.5, z: z - Math.sin(ry) * 0.45, ry });
      P.box(0.12, 1.02, 1.02, 0x6a4428, { x: x - Math.cos(ry) * 0.45, y: y + 0.5, z: z + Math.sin(ry) * 0.45, ry });
    };
    crate(0, 0, 0, 0.1); crate(1.1, 0, 0.2, -0.2); crate(0.5, 1, 0.1, 0.3);
  },
  fence(P, pal, r) {
    const c = pal.fenceCol ?? 0xc8a070;
    for (let k = 0; k < 4; k++) P.box(0.14, 1.1, 0.14, c, { x: -1.5 + k, y: 0.55, rz: (r() - 0.5) * 0.12 });
    P.box(3.2, 0.12, 0.06, c, { y: 0.8, z: 0.08, rz: (r() - 0.5) * 0.06 });
    P.box(3.2, 0.12, 0.06, c, { y: 0.4, z: 0.08, rz: (r() - 0.5) * 0.06 });
  },
  flag(P, pal, r) {
    P.cyl(0.05, 0.06, 4, 0xd8d0c0, { y: 2 });
    const c = pick(r, [0xe98c73, 0x387d76, 0xedc371, 0xdbb2f6]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 3.9, 0, 1.4, 3.55, 0, 0, 3.2, 0, 0, 3.9, 0, 0, 3.2, 0, 1.4, 3.55, 0], 3));
    P.add(g, c, { sway: 1 });
    P.ball(0.08, 0xedc371, { y: 4.05 });
  },
  sign_post(P, pal, r) {
    P.box(0.14, 2.2, 0.14, 0x8a5a34, { y: 1.1 });
    P.box(1.2, 0.3, 0.06, 0xd8b07a, { y: 1.85, x: 0.4, ry: 0.2 });
    P.box(1.0, 0.3, 0.06, 0xd8b07a, { y: 1.45, x: -0.3, ry: -0.3 });
    P.cone(0.2, 0.3, 0xd8b07a, { y: 1.85, x: 1.05, rz: -Math.PI / 2, seg: 3 });
  },
  satellite(P, pal, r) {
    P.cyl(0.1, 0.15, 2.4, 0x8a92a0, { y: 1.2 });
    P.sphere(1.1, 0xe4e8f0, { y: 2.0, rx: -1.0, cap: Math.PI / 3, ws: 12, hs: 3 });
    P.seg([0, 2.6, 0], [0, 3.1, 0.7], 0.03, 0.03, 0x5a6270);
    P.ball(0.1, 0xe98c73, { y: 3.1, z: 0.7, glow: true });
  },
  robot_arm(P, pal, r) {
    const c = 0xedc371;
    P.cyl(0.7, 0.8, 0.5, 0x3a3440, { y: 0.25, seg: 10 });
    P.seg([0, 0.4, 0], [0.6, 2.2, 0], 0.3, 0.25, c);
    P.ball(0.35, 0x3a3440, { x: 0.6, y: 2.2 });
    P.seg([0.6, 2.2, 0], [1.9, 2.6, 0], 0.22, 0.18, c);
    P.box(0.15, 0.6, 0.2, 0x5a6270, { x: 2.0, y: 2.35, z: 0.15 }); P.box(0.15, 0.6, 0.2, 0x5a6270, { x: 2.0, y: 2.35, z: -0.15 });
    P.ball(0.08, 0xe94f4f, { x: 0.1, y: 0.6, z: 0.6, glow: true, detail: 0 });
  },
  strut(P, pal, r) {
    // unit-height metal support (scaled in Y by the caller)
    P.box(0.3, 1, 0.3, pal.strutCol ?? 0x5a6270, { y: 0.5, jitter: 0 });
  },
  pebbles(P, pal, r) {
    for (let k = 0; k < 5; k++) P.add(lumpy(ico(0.12 + r() * 0.12, 0), 0.2, k), pal.rock, { x: (r() - 0.5) * 0.9, y: 0.05, z: (r() - 0.5) * 0.9, sy: 0.6 });
  },
  rope_post(P, pal, r) {
    P.cyl(0.07, 0.08, 1.2, 0x8a5a34, { y: 0.6, seg: 6 });
    P.ball(0.09, 0x6a4428, { y: 1.22, detail: 0 });
  },
  cloud_puff(P, pal, r) {
    for (let k = 0; k < 3; k++) P.add(new THREE.SphereGeometry(0.55 + r() * 0.35, P.lod ? 5 : 7, P.lod ? 3 : 4), pal.cloudCol ?? 0xffffff, { x: (k - 1) * 0.55 + (r() - 0.5) * 0.3, y: r() * 0.25, z: (r() - 0.5) * 0.5, smooth: true });
  },
  geyser_vent(P, pal, r) {
    P.add(lumpy(new THREE.CylinderGeometry(0.4, 0.9, 0.5, 8, 1, true), 0.15, 3), pal.rock, { y: 0.25 });
    P.cyl(0.38, 0.38, 0.05, 0x9fe8f0, { y: 0.4, glow: true, seg: 8 });
  },
  ufo(P, pal, r) {
    P.sphere(1.5, 0xa8a8c0, { y: 0.4, sy: 0.25, ws: 16, hs: 8 });
    P.sphere(0.7, 0x9ff0e0, { y: 0.6, cap: Math.PI / 2, glow: true });
    for (let k = 0; k < 8; k++) P.ball(0.1, 0xedc371, { x: Math.cos(k * 0.785) * 1.35, y: 0.38, z: Math.sin(k * 0.785) * 1.35, glow: true, detail: 0 });
  },
  unit_box(P) { P.noAO = true; P.box(1, 1, 1, 0xffffff, { y: 0.5, jitter: 0 }); },
  unit_cyl(P) { P.noAO = true; P.cyl(0.5, 0.5, 1, 0xffffff, { y: 0.5, jitter: 0, seg: 6 }); },
  stalactite(P, pal, r) {
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const h = 1.5 + r() * 3.5, a = r() * 6.28, d = k ? 0.6 : 0;
      P.add(lumpy(new THREE.ConeGeometry(0.4 + h * 0.12, h, 5, 1), 0.12, r() * 99), pal.rockDark ?? pal.rock, { x: Math.cos(a) * d, y: -h / 2, z: Math.sin(a) * d, rx: Math.PI });
      if (r() < 0.4) P.add(new THREE.OctahedronGeometry(0.25, 0), pick(r, pal.crystal ?? [0x9ff0e0]), { x: Math.cos(a) * d + 0.3, y: -h * 0.4, z: Math.sin(a) * d, sy: 2.2, glow: true });
    }
  },
  aurora_tree(P, pal, r) {
    P.seg([0, 0, 0], [0, 2.2, 0], 0.14, 0.1, 0x3a3060);
    for (let k = 0; k < 6; k++) { const a = k * 1.05 + r(); P.seg([0, 1.2 + k * 0.15, 0], [Math.cos(a) * 1.1, 2.0 + r() * 0.6, Math.sin(a) * 1.1], 0.05, 0.03, 0x3a3060); P.ball(0.12, pick(r, [0xb5f3d0, 0xdbb2f6, 0x9fe8f0]), { x: Math.cos(a) * 1.1, y: 2.0 + r() * 0.6, z: Math.sin(a) * 1.1, glow: true, detail: 0, sway: 1 }); }
  },
};
// aliases (more names for designers)
const ALIAS = {
  palm_tree: 'palm', palmier: 'palm', bush_flower: 'bush', stone: 'rock', moon_rock: 'rock', rocks: 'rock', torch: 'tiki_torch',
  fir: 'pine', sapin: 'pine', cactus_big: 'cactus', camel: 'camel_vacation', chameau: 'camel_vacation', igloo_big: 'igloo',
  spike: 'ice_spike', crystals: 'crystal', smokestack: 'chimney', pipes: 'pipe', sign: 'sign_post', crates: 'crate_pile',
  amphora: 'pot', jar: 'pot', house_white: 'house_blue', maison_bleue: 'house_blue', mosque: 'dome', tower: 'minaret',
  sock_statue: 'statue_sock', poster: 'poster_board', antenna: 'satellite', puff: 'cloud_puff', tuft: 'grass_tuft',
};
export const PROP_KINDS = Object.keys(T);
export function resolveKind(kind) { return T[kind] ? kind : ALIAS[kind] && T[ALIAS[kind]] ? ALIAS[kind] : null; }

// Parts offset stack (used by composite templates like cat_wall)
Parts.prototype.push = function push(o) {
  this._stack = this._stack || [];
  this._stack.push({ lit: this.lit.pos.length, glow: this.glow.pos.length, o });
};
Parts.prototype.pop = function pop() {
  const st = this._stack.pop();
  const m = new THREE.Matrix4().compose(new THREE.Vector3(st.o.x || 0, st.o.y || 0, st.o.z || 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, st.o.ry || 0, 0)), new THREE.Vector3(st.o.s || 1, st.o.s || 1, st.o.s || 1));
  const v = new THREE.Vector3(), nm = new THREE.Matrix3().getNormalMatrix(m);
  for (const [b, from] of [[this.lit, st.lit], [this.glow, st.glow]]) {
    for (let i = from; i < b.pos.length; i += 3) {
      v.set(b.pos[i], b.pos[i + 1], b.pos[i + 2]).applyMatrix4(m); b.pos[i] = v.x; b.pos[i + 1] = v.y; b.pos[i + 2] = v.z;
      v.set(b.nrm[i], b.nrm[i + 1], b.nrm[i + 2]).applyMatrix3(nm).normalize(); b.nrm[i] = v.x; b.nrm[i + 1] = v.y; b.nrm[i + 2] = v.z;
    }
  }
};

// ---------------------------------------------------------------- template cache
const cache = new Map();
const VARIANTS = 3; // a few random variants per kind
/** template for kind / palette id / variant → { lit, glow, height, radius } or null */
export function getTemplate(kind, pal, palId, variant = 0, lod = 0) {
  const k = resolveKind(kind);
  if (!k) return null;
  const v = variant % VARIANTS;
  const key = `${k}|${palId}|${v}|${lod ? 1 : 0}`;
  let t = cache.get(key);
  if (!t) {
    const seed = strSeed(`${k}|${palId}|${v}`);
    const P = new Parts(seed);
    P.lod = !!lod;
    LOD = lod ? 1 : 0;
    T[k](P, pal, rng(seed + 17));
    LOD = 0;
    t = P.build();
    cache.set(key, t);
  }
  return t;
}
export const VARIANT_COUNT = VARIANTS;
