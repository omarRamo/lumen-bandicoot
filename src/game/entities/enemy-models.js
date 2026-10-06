// Procedural low-poly enemy models (agent Ennemis). Each builder fills e.model (feet at origin, facing +Z),
// stores animated parts in e.m and the googly eyes in e.eyes. Geometries/materials come from the shared cache.
import * as THREE from 'three';
import { part, group, mat, glow, seeThrough, makeEyes, makeAlert, makeStars, TAU } from './enemy-kit.js';

const BLACK = 0x1c1640, WHITE = 0xfffaf0, PINK = 0xff8fa8;

function mouth(parent, y, z, w = 0.12, color = BLACK) {
  return part(parent, 'box', glow(color), [w, 0.03, 0.03], [0, y, z]);
}
function smile(parent, y, z, w = 0.1) {
  const g = group(parent, [0, y, z]);
  part(g, 'box', glow(BLACK), [w, 0.025, 0.02], [0, 0, 0]);
  part(g, 'box', glow(BLACK), [0.03, 0.025, 0.02], [-w / 2, 0.015, 0], [0, 0, -0.6]);
  part(g, 'box', glow(BLACK), [0.03, 0.025, 0.02], [w / 2, 0.015, 0], [0, 0, 0.6]);
  return g;
}
/** Leg pivot hanging down from (x,y,z). */
function leg(parent, x, y, z, len, r, color, rz = 0) {
  const g = group(parent, [x, y, z], [0, 0, rz]);
  part(g, 'cyl', color, [r, len, r], [0, -len / 2, 0]);
  return g;
}
function common(e, alertY) {
  e.m.alert = makeAlert(e.model, alertY);
  e.m.stars = makeStars(e.model, alertY - 0.15);
}

// ------------------------------------------------------------------ CRAB — beach
export function crab(e) {
  const M = e.model, m = e.m, C = 0xff6b4a;
  m.shell = group(M);
  part(m.shell, 'sphere', C, [0.42, 0.25, 0.33], [0, 0.32, 0]);
  part(m.shell, 'sphere', 0xffb38a, [0.36, 0.16, 0.26], [0, 0.25, 0.07]);
  for (const sx of [-1, 1]) part(m.shell, 'ico', 0xff8a66, 0.06, [sx * 0.18, 0.5, -0.05]);
  smile(m.shell, 0.3, 0.33, 0.13);
  for (const sx of [-1, 1]) part(m.shell, 'cyl', C, [0.03, 0.26, 0.03], [sx * 0.12, 0.6, 0.12], [0.15, 0, sx * -0.15]);
  e.eyes = makeEyes(m.shell, { r: 0.1, gap: 0.15, y: 0.76, z: 0.16, brows: 0xb03a20 });
  m.claws = [];
  for (const sx of [-1, 1]) {
    const arm = group(m.shell, [sx * 0.38, 0.32, 0.12], [0, 0, sx * -0.5]);
    part(arm, 'cyl', C, [0.05, 0.22, 0.05], [0, 0.1, 0]);
    const claw = group(arm, [0, 0.24, 0]);
    part(claw, 'sphere', 0xff5533, [0.16, 0.13, 0.11], [0, 0.06, 0]);
    part(claw, 'cone', 0xff5533, [0.07, 0.2, 0.07], [sx * -0.06, 0.2, 0], [0, 0, sx * 0.3]);
    const jaw = group(claw, [sx * 0.07, 0.08, 0]);
    part(jaw, 'cone', 0xff7a55, [0.05, 0.16, 0.05], [0, 0.08, 0]);
    m.claws.push({ arm, claw, jaw, sx });
  }
  m.legs = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const l = leg(m.shell, sx * 0.3, 0.26, -0.12 + i * 0.12, 0.3, 0.025, 0xe0502f, sx * 0.9);
    l.userData.ph = i * 2 + (sx > 0 ? 1 : 0); m.legs.push(l);
  }
  common(e, 1.05);
}

// ------------------------------------------------------------------ TURTLE — beach / river (bandana: we copy everything)
export function turtle(e) {
  const M = e.model, m = e.m, SKIN = 0xb8e07a;
  m.flip = group(M);
  const F = m.flip;
  part(F, 'dome', 0x3f9e5a, [0.5, 0.42, 0.55], [0, 0.22, 0]);
  part(F, 'cyl', 0x2f7a45, [0.53, 0.07, 0.58], [0, 0.22, 0]);
  part(F, 'cyl', 0xe8d58a, [0.45, 0.08, 0.5], [0, 0.16, 0]);
  part(F, 'cyl6', 0x7fcf6a, [0.18, 0.05, 0.18], [0, 0.62, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    part(F, 'cyl6', 0x7fcf6a, [0.13, 0.05, 0.13], [Math.cos(a) * 0.3, 0.5, Math.sin(a) * 0.32], [Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6]);
  }
  m.head = group(F, [0, 0.36, 0.55]);
  part(m.head, 'sphere', SKIN, [0.2, 0.19, 0.22], [0, 0.04, 0.08]);
  part(m.head, 'cyl', 0xff7a3a, [0.205, 0.07, 0.205], [0, 0.11, 0.06]);              // bandana
  part(m.head, 'box', 0xff7a3a, [0.04, 0.18, 0.04], [0.06, 0.06, -0.15], [0.8, 0.3, 0]);
  part(m.head, 'box', 0xff7a3a, [0.04, 0.16, 0.04], [-0.04, 0.05, -0.15], [0.9, -0.3, 0]);
  e.eyes = makeEyes(m.head, { r: 0.075, gap: 0.085, y: 0.11, z: 0.24, brows: 0x2f7a45 });
  smile(m.head, -0.04, 0.29, 0.09);
  m.legs = [];
  for (const [x, z] of [[-0.33, 0.28], [0.33, 0.28], [-0.33, -0.28], [0.33, -0.28]]) {
    const l = leg(F, x, 0.22, z, 0.2, 0.085, SKIN);
    part(l, 'sphere', SKIN, [0.1, 0.06, 0.12], [0, -0.2, 0.03]);
    m.legs.push(l);
  }
  part(F, 'cone', SKIN, [0.06, 0.14, 0.06], [0, 0.18, -0.58], [-1.6, 0, 0]);
  common(e, 1.0);
}

// ------------------------------------------------------------------ PLANT — jungle (Piranha cousin, very rude)
export function plant(e) {
  const M = e.model, m = e.m, POT = 0xc0643a, G = 0x3fa55a;
  part(M, 'cyl', POT, [0.3, 0.34, 0.3], [0, 0.17, 0]);
  part(M, 'torus', 0xd9774a, [0.31, 0.31, 0.5], [0, 0.34, 0], [Math.PI / 2, 0, 0]);
  part(M, 'cyl', 0x5a3a22, [0.27, 0.02, 0.27], [0, 0.34, 0]);
  for (const a of [0.4, 2.5, 4.4]) part(M, 'sphere', 0x2e8b57, [0.32, 0.04, 0.12], [Math.cos(a) * 0.25, 0.4, Math.sin(a) * 0.25], [0, -a, 0.3]);
  m.stem = group(M, [0, 0.36, 0]);
  part(m.stem, 'cyl', G, [0.06, 0.62, 0.06], [0, 0.31, 0]);
  part(m.stem, 'sphere', 0x2e8b57, [0.22, 0.03, 0.1], [0.14, 0.3, 0], [0, 0, 0.5]);
  part(m.stem, 'sphere', 0x2e8b57, [0.2, 0.03, 0.09], [-0.13, 0.42, 0], [0, 0, -0.5]);
  m.head = group(m.stem, [0, 0.66, 0]);
  const H = m.head, RED = 0xe0325f;
  m.jawU = group(H, [0, 0, -0.26]);
  part(m.jawU, 'dome', RED, [0.34, 0.3, 0.34], [0, 0, 0.26]);
  for (const [x, y, z] of [[0.15, 0.2, 0.3], [-0.18, 0.15, 0.36], [0.02, 0.27, 0.16], [-0.06, 0.12, 0.5]]) part(m.jawU, 'ball', glow(WHITE), 0.05, [x, y, z]);
  m.jawL = group(H, [0, 0, -0.26]);
  part(m.jawL, 'dome', RED, [0.32, 0.22, 0.32], [0, 0, 0.26], [Math.PI, 0, 0]);
  part(m.jawL, 'disc', glow(0x7a1030), [0.28, 0.28, 1], [0, 0.005, 0.26], [-Math.PI / 2, 0, 0]);
  for (let i = 0; i < 7; i++) {
    const a = -1.2 + (i / 6) * 2.4;
    part(m.jawU, 'cone4', glow(WHITE), [0.035, 0.09, 0.035], [Math.sin(a) * 0.3, -0.04, 0.26 + Math.cos(a) * 0.3], [Math.PI, 0, 0]);
    part(m.jawL, 'cone4', glow(WHITE), [0.03, 0.08, 0.03], [Math.sin(a + 0.15) * 0.28, 0.04, 0.26 + Math.cos(a + 0.15) * 0.28]);
  }
  e.eyes = makeEyes(m.jawU, { r: 0.1, gap: 0.12, y: 0.24, z: 0.42, brows: 0x7a1030 });
  e.eyes.root.rotation.x = -0.3;
  m.tongue = part(m.jawL, 'sphere', 0xff7aa0, [0.08, 0.03, 0.16], [0, 0.03, 0.3]);
  common(e, 1.75);
}

// ------------------------------------------------------------------ BAT — jungle / cave
export function bat(e) {
  const M = e.model, m = e.m, P = 0x6b4f9e;
  m.core = group(M);
  part(m.core, 'sphere', P, [0.26, 0.28, 0.24], [0, 0.3, 0]);
  part(m.core, 'sphere', 0x9b7fcf, [0.19, 0.2, 0.12], [0, 0.26, 0.14]);
  for (const sx of [-1, 1]) {
    part(m.core, 'cone4', P, [0.09, 0.22, 0.07], [sx * 0.13, 0.6, 0], [0, 0, sx * -0.3]);
    part(m.core, 'cone4', PINK, [0.05, 0.14, 0.03], [sx * 0.13, 0.59, 0.04], [0, 0, sx * -0.3]);
  }
  e.eyes = makeEyes(m.core, { r: 0.1, gap: 0.1, y: 0.38, z: 0.18, color: 0xfff3a0, brows: 0x3a2860 });
  smile(m.core, 0.24, 0.24, 0.1);
  for (const sx of [-1, 1]) part(m.core, 'cone4', glow(WHITE), [0.02, 0.05, 0.02], [sx * 0.03, 0.2, 0.245], [Math.PI, 0, 0]);
  m.wings = [];
  for (const sx of [-1, 1]) {
    const w = group(m.core, [sx * 0.2, 0.36, 0]);
    part(w, 'box', 0x4a3570, [0.42, 0.02, 0.3], [sx * 0.22, 0, 0]);
    const tip = group(w, [sx * 0.42, 0, 0]);
    part(tip, 'box', 0x4a3570, [0.34, 0.02, 0.26], [sx * 0.16, 0, -0.02]);
    for (const z of [-0.1, 0.02, 0.12]) part(tip, 'cone4', 0x4a3570, [0.05, 0.1, 0.02], [sx * 0.3, 0, z], [Math.PI / 2, 0, 0]);
    m.wings.push({ w, tip, sx });
  }
  for (const sx of [-1, 1]) part(m.core, 'cone', 0x3a2860, [0.03, 0.08, 0.03], [sx * 0.08, 0.02, 0], [Math.PI, 0, 0]);
  common(e, 0.95);
}

// ------------------------------------------------------------------ PORCUPINE — jungle / desert
export function porcupine(e) {
  const M = e.model, m = e.m, B = 0x8d6e63;
  m.core = group(M);
  part(m.core, 'sphere', B, [0.42, 0.36, 0.46], [0, 0.36, 0]);
  part(m.core, 'sphere', 0xd7b8a0, [0.2, 0.17, 0.2], [0, 0.32, 0.4]);
  part(m.core, 'ball', glow(PINK), 0.06, [0, 0.36, 0.6]);
  e.eyes = makeEyes(m.core, { r: 0.075, gap: 0.1, y: 0.46, z: 0.5, brows: 0x4e342e });
  smile(m.core, 0.26, 0.56, 0.07);
  for (const [x, z] of [[-0.25, 0.22], [0.25, 0.22], [-0.25, -0.22], [0.25, -0.22]]) part(m.core, 'sphere', 0x6d4c41, [0.09, 0.07, 0.12], [x, 0.05, z]);
  // quills: one group centred in the body, oriented along the back normals, built at full "spiked" length.
  // Scaling the group < 1 sinks them into the fur (calm), > 1 bristles them (spiked) → bakes to 2 draw calls.
  m.quillG = group(m.core, [0, 0.36, 0]);
  const up = new THREE.Vector3(0, 1, 0), n = new THREE.Vector3(), q = new THREE.Quaternion();
  for (let i = 0; i < 22; i++) {
    const a = i * 2.39996, yy = 0.15 + (i / 22) * 0.85;
    n.set(Math.cos(a) * Math.sqrt(1 - yy * yy), yy, Math.sin(a) * Math.sqrt(1 - yy * yy) - 0.35).normalize();
    if (n.z > 0.55) n.z = 0.2;
    n.normalize();
    q.setFromUnitVectors(up, n);
    const r0 = 0.3, L = 0.42;
    const spike = part(m.quillG, 'cone', 0xf5e6c8, [0.05, L, 0.05], [n.x * (r0 + L / 2), n.y * (r0 + L / 2) * 0.85, n.z * (r0 + L / 2)]);
    spike.quaternion.copy(q);
    const tip = part(m.quillG, 'cone', 0x3e2723, [0.04, 0.14, 0.04], [n.x * (r0 + L * 0.93), n.y * (r0 + L * 0.93) * 0.85, n.z * (r0 + L * 0.93)]);
    tip.quaternion.copy(q);
  }
  common(e, 1.15);
}

// ------------------------------------------------------------------ SCORPION — desert
export function scorpion(e) {
  const M = e.model, m = e.m, S = 0xe0a040, D = 0xb87320;
  part(M, 'sphere', S, [0.3, 0.15, 0.36], [0, 0.2, -0.02]);
  for (let i = 0; i < 3; i++) part(M, 'cyl', D, [0.29 - i * 0.02, 0.02, 0.06], [0, 0.32 - i * 0.01, -0.18 + i * 0.13]);
  m.head = group(M, [0, 0.22, 0.32]);
  part(m.head, 'sphere', S, [0.2, 0.13, 0.17], [0, 0, 0]);
  e.eyes = makeEyes(m.head, { r: 0.08, gap: 0.09, y: 0.12, z: 0.1, brows: 0x7a3e10 });
  smile(m.head, -0.02, 0.17, 0.08);
  m.claws = [];
  for (const sx of [-1, 1]) {
    const arm = group(M, [sx * 0.24, 0.22, 0.32], [0, sx * 0.4, 0]);
    part(arm, 'cyl', D, [0.04, 0.26, 0.04], [0, 0, 0.13], [Math.PI / 2, 0, 0]);
    const claw = group(arm, [0, 0, 0.3]);
    part(claw, 'sphere', S, [0.11, 0.08, 0.13], [0, 0, 0.04]);
    const jaw = group(claw, [sx * -0.05, 0, 0.1]);
    part(jaw, 'cone', D, [0.04, 0.15, 0.04], [0, 0, 0.07], [Math.PI / 2, 0, 0]);
    part(claw, 'cone', S, [0.045, 0.16, 0.045], [sx * 0.04, 0, 0.17], [Math.PI / 2, 0, 0]);
    m.claws.push({ arm, jaw, sx });
  }
  m.legs = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const l = leg(M, sx * 0.24, 0.2, -0.16 + i * 0.13, 0.26, 0.022, D, sx * 1.0);
    l.userData.ph = i * 2 + (sx > 0 ? 1 : 0); m.legs.push(l);
  }
  // segmented tail (each segment a child of the previous)
  m.tail = [];
  let parent = group(M, [0, 0.26, -0.34]);
  m.tailRoot = parent;
  const sizes = [0.1, 0.09, 0.085, 0.08, 0.075];
  for (let i = 0; i < sizes.length; i++) {
    const seg = group(parent, i === 0 ? [0, 0, 0] : [0, 0.15, 0]);
    part(seg, 'sphere', i % 2 ? D : S, [sizes[i], sizes[i] * 1.1, sizes[i]], [0, 0.07, 0]);
    m.tail.push(seg);
    parent = seg;
  }
  m.stingerG = group(parent, [0, 0.15, 0]);
  part(m.stingerG, 'sphere', 0x7a2e1a, [0.09, 0.1, 0.09], [0, 0.02, 0]);
  m.stinger = part(m.stingerG, 'cone', 0x3a1408, [0.04, 0.16, 0.04], [0, 0.04, 0.12], [Math.PI / 2, 0, 0]);
  m.stingerMat = m.stinger.material;
  common(e, 1.25);
}

// ------------------------------------------------------------------ CAMEL — desert (chéchia rouge, regard blasé)
export function camel(e) {
  const M = e.model, m = e.m, C = 0xd8a45a, D = 0xb07e3a;
  part(M, 'sphere', C, [0.42, 0.38, 0.78], [0, 1.15, -0.05]);
  part(M, 'sphere', C, [0.34, 0.36, 0.38], [0, 1.5, -0.1]);
  part(M, 'box', 0xc0392b, [0.9, 0.5, 0.5], [0, 1.28, -0.1]);
  for (const y of [1.1, 1.42]) part(M, 'box', 0x2a6fdb, [0.92, 0.06, 0.52], [0, y, -0.1]);
  for (let i = 0; i < 4; i++) part(M, 'cone4', 0xffd23f, [0.04, 0.08, 0.04], [0.46, 1.0, -0.28 + i * 0.12], [Math.PI, 0, 0]);
  for (let i = 0; i < 4; i++) part(M, 'cone4', 0xffd23f, [0.04, 0.08, 0.04], [-0.46, 1.0, -0.28 + i * 0.12], [Math.PI, 0, 0]);
  m.legs = [];
  for (const [x, z] of [[-0.22, 0.45], [0.22, 0.45], [-0.22, -0.5], [0.22, -0.5]]) {
    const l = leg(M, x, 0.95, z, 0.92, 0.075, C);
    part(l, 'sphere', D, [0.1, 0.06, 0.13], [0, -0.92, 0.03]);
    part(l, 'sphere', C, [0.09, 0.08, 0.09], [0, -0.48, 0]);
    m.legs.push(l);
  }
  part(M, 'cone', D, [0.05, 0.4, 0.05], [0, 1.05, -0.85], [0.5, 0, 0]);
  m.neck = group(M, [0, 1.25, 0.6], [-0.35, 0, 0]);
  part(m.neck, 'cyl', C, [0.13, 0.7, 0.13], [0, 0.32, 0.05]);
  m.head = group(m.neck, [0, 0.7, 0.05], [0.35, 0, 0]);
  const H = m.head;
  part(H, 'sphere', C, [0.2, 0.19, 0.24], [0, 0, 0]);
  part(H, 'sphere', 0xe6bd80, [0.15, 0.13, 0.2], [0, -0.05, 0.22]);
  m.lip = part(H, 'sphere', 0xc98f50, [0.13, 0.06, 0.1], [0, -0.15, 0.3]);
  m.cheeks = [];
  for (const sx of [-1, 1]) m.cheeks.push(part(H, 'sphere', 0xe6bd80, 0.08, [sx * 0.12, -0.07, 0.2]));
  for (const sx of [-1, 1]) part(H, 'ball', glow(0x5a3a22), [0.025, 0.02, 0.02], [sx * 0.05, -0.02, 0.41]);
  for (const sx of [-1, 1]) part(H, 'cone4', C, [0.05, 0.1, 0.04], [sx * 0.15, 0.17, -0.08], [0, 0, sx * -0.6]);
  part(H, 'cyl', 0xd0202a, [0.13, 0.13, 0.13], [0, 0.22, -0.02]);       // chéchia
  part(H, 'cyl', 0xd0202a, [0.11, 0.02, 0.11], [0, 0.29, -0.02]);
  part(H, 'cyl', BLACK, [0.012, 0.16, 0.012], [0.07, 0.22, -0.1], [0.4, 0, 0.6]);
  e.eyes = makeEyes(H, { r: 0.075, gap: 0.11, y: 0.06, z: 0.16, lids: C, brows: D });
  e.eyes.mood('sneaky');
  common(e, 2.6);
}

// ------------------------------------------------------------------ PIGEON — médina / Sidi Bou Saïd
export function pigeon(e) {
  const M = e.model, m = e.m, G = 0x9aa3b5;
  m.core = group(M);
  part(m.core, 'sphere', G, [0.25, 0.24, 0.33], [0, 0.3, -0.02]);
  m.chest = part(m.core, 'sphere', 0x8a7fb5, [0.2, 0.2, 0.18], [0, 0.36, 0.17]);
  part(m.core, 'box', 0x5a6276, [0.2, 0.03, 0.22], [0, 0.3, -0.38], [0.3, 0, 0]);
  m.head = group(m.core, [0, 0.55, 0.2]);
  part(m.head, 'sphere', G, [0.15, 0.15, 0.16], [0, 0.04, 0.02]);
  part(m.head, 'torus', 0x4fb38a, [0.12, 0.12, 0.3], [0, -0.07, 0], [Math.PI / 2, 0, 0]);
  part(m.head, 'cone4', 0xe8a040, [0.04, 0.12, 0.04], [0, 0.02, 0.2], [Math.PI / 2, 0, 0]);
  part(m.head, 'ball', glow(0xffffff), [0.05, 0.03, 0.04], [0, 0.06, 0.15]);
  e.eyes = makeEyes(m.head, { r: 0.065, gap: 0.075, y: 0.09, z: 0.1, color: 0xffd9a0, pupil: 0.4, brows: 0x4a5266 });
  m.wings = [];
  for (const sx of [-1, 1]) {
    const w = group(m.core, [sx * 0.2, 0.42, 0]);
    part(w, 'box', 0x7a8296, [0.04, 0.2, 0.34], [sx * 0.03, -0.08, -0.02], [0, 0, sx * 0.15]);
    part(w, 'box', 0x3a4256, [0.045, 0.04, 0.3], [sx * 0.04, -0.12, -0.02]);
    m.wings.push({ w, sx });
  }
  m.feet = [];
  for (const sx of [-1, 1]) m.feet.push(leg(m.core, sx * 0.08, 0.1, 0.02, 0.1, 0.02, 0xe8804a));
  common(e, 0.95);
}

// ------------------------------------------------------------------ CAT — Sidi Bou Saïd (voleur de lucioles)
export function cat(e) {
  const M = e.model, m = e.m, W = 0xfaf6ee, O = 0xf0a050;
  m.core = group(M);
  part(m.core, 'sphere', W, [0.24, 0.24, 0.34], [0, 0.3, -0.04]);
  part(m.core, 'sphere', O, [0.2, 0.12, 0.2], [0.04, 0.47, -0.12]);
  m.legs = [];
  for (const [x, z] of [[-0.12, 0.18], [0.12, 0.18], [-0.12, -0.24], [0.12, -0.24]]) {
    const l = leg(m.core, x, 0.18, z, 0.18, 0.05, W);
    part(l, 'sphere', W, [0.06, 0.04, 0.07], [0, -0.18, 0.02]);
    m.legs.push(l);
  }
  m.tail = [];
  let parent = group(m.core, [0, 0.38, -0.36], [-0.6, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const seg = group(parent, i ? [0, 0.12, 0] : [0, 0, 0]);
    part(seg, 'cyl', i === 3 ? O : W, [0.04, 0.13, 0.04], [0, 0.06, 0]);
    m.tail.push(seg); parent = seg;
  }
  m.head = group(m.core, [0, 0.58, 0.24]);
  const H = m.head;
  part(H, 'sphere', W, [0.22, 0.19, 0.19], [0, 0, 0]);
  part(H, 'sphere', O, [0.12, 0.08, 0.12], [-0.1, 0.1, -0.02]);
  for (const sx of [-1, 1]) {
    part(H, 'cone4', sx < 0 ? O : W, [0.08, 0.15, 0.05], [sx * 0.12, 0.18, -0.02], [0, 0, sx * -0.35]);
    part(H, 'cone4', PINK, [0.045, 0.09, 0.02], [sx * 0.12, 0.17, 0.02], [0, 0, sx * -0.35]);
    part(H, 'sphere', 0xffffff, [0.06, 0.045, 0.05], [sx * 0.04, -0.07, 0.16]);
    for (const dy of [-0.02, 0.02]) part(H, 'box', glow(0x9a8a7a), [0.16, 0.006, 0.006], [sx * 0.15, -0.06 + dy, 0.15], [0, sx * 0.2, sx * dy * 6]);
  }
  part(H, 'ball', glow(PINK), [0.03, 0.022, 0.02], [0, -0.03, 0.19]);
  e.eyes = makeEyes(H, { r: 0.07, gap: 0.085, y: 0.03, z: 0.14, color: 0xd9f59a, slit: 0.4, pupil: 0.6, lids: W });
  part(m.core, 'torus', 0x2a6fdb, [0.13, 0.13, 0.4], [0, 0.48, 0.2], [Math.PI / 2 - 0.4, 0, 0]);
  part(m.core, 'ball', glow(0xffd23f), 0.04, [0, 0.4, 0.3]);
  m.loot = group(M, [0, 1.0, 0]);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    part(m.loot, 'ico', glow(0xfff1a0), 0.07, [Math.cos(a) * 0.3, Math.sin(i * 1.7) * 0.06, Math.sin(a) * 0.3]);
  }
  m.loot.visible = false;
  common(e, 1.2);
}

// ------------------------------------------------------------------ PENGUIN — glacier (grognon, écharpe)
export function penguin(e) {
  const M = e.model, m = e.m, K = 0x2b2d42;
  m.core = group(M);
  part(m.core, 'sphere', K, [0.3, 0.42, 0.28], [0, 0.42, 0]);
  part(m.core, 'sphere', 0xffffff, [0.23, 0.33, 0.13], [0, 0.38, 0.17]);
  part(m.core, 'cone4', 0xff9a3a, [0.06, 0.15, 0.06], [0, 0.6, 0.32], [Math.PI / 2, 0, 0]);
  e.eyes = makeEyes(m.core, { r: 0.08, gap: 0.09, y: 0.67, z: 0.24, brows: 0x111222 });
  e.eyes.mood('angry');
  part(m.core, 'torus', 0x7ab8ff, [0.22, 0.22, 0.45], [0, 0.5, 0], [Math.PI / 2, 0, 0]);
  part(m.core, 'box', 0x7ab8ff, [0.07, 0.22, 0.03], [0.12, 0.38, 0.22], [0, 0, 0.2]);
  m.flippers = [];
  for (const sx of [-1, 1]) {
    const f = group(m.core, [sx * 0.27, 0.55, 0]);
    part(f, 'sphere', K, [0.05, 0.22, 0.11], [sx * 0.02, -0.18, 0]);
    m.flippers.push({ f, sx });
  }
  m.feet = [];
  for (const sx of [-1, 1]) m.feet.push(part(m.core, 'sphere', 0xff9a3a, [0.09, 0.04, 0.13], [sx * 0.11, 0.03, 0.1]));
  common(e, 1.15);
}

// ------------------------------------------------------------------ YETI KID — glacier (bonnet, lance des boules)
export function yetiKid(e) {
  const M = e.model, m = e.m, W = 0xf4f8ff;
  m.core = group(M);
  part(m.core, 'sphere', W, [0.36, 0.4, 0.32], [0, 0.44, 0]);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    part(m.core, 'ico', W, 0.09, [Math.cos(a) * 0.33, 0.2 + (i % 3) * 0.18, Math.sin(a) * 0.29]);
  }
  part(m.core, 'sphere', 0x8fb8de, [0.22, 0.2, 0.08], [0, 0.62, 0.26]);
  e.eyes = makeEyes(m.core, { r: 0.08, gap: 0.09, y: 0.67, z: 0.31, brows: 0x5a7fa6 });
  m.mouth = group(m.core, [0, 0.53, 0.33]);
  part(m.mouth, 'box', glow(BLACK), [0.12, 0.05, 0.02]);
  part(m.mouth, 'box', glow(0xffffff), [0.03, 0.03, 0.02], [0.03, 0.01, 0.005]);
  m.tongue = part(m.mouth, 'sphere', glow(0xff6f8a), [0.035, 0.025, 0.03], [-0.04, -0.03, 0.01]);
  m.tongue.visible = false;
  part(m.core, 'dome', 0xe04848, [0.3, 0.24, 0.3], [0, 0.78, 0]);
  part(m.core, 'cyl', 0xffd23f, [0.31, 0.07, 0.31], [0, 0.8, 0]);
  part(m.core, 'ico', 0xffd23f, 0.09, [0, 1.04, 0]);
  m.arms = [];
  for (const sx of [-1, 1]) {
    const a = group(m.core, [sx * 0.33, 0.58, 0.02], [0, 0, sx * 0.25]);
    part(a, 'cyl', W, [0.08, 0.32, 0.08], [0, -0.16, 0]);
    part(a, 'sphere', 0x8fb8de, 0.08, [0, -0.33, 0]);
    m.arms.push(a);
  }
  m.ball = part(m.arms[1], 'sphere', 0xffffff, 0.14, [0, -0.43, 0.06]);
  m.ball.visible = false;
  for (const sx of [-1, 1]) part(m.core, 'sphere', 0xb8d0ea, [0.13, 0.06, 0.18], [sx * 0.15, 0.04, 0.06]);
  common(e, 1.4);
}

// ------------------------------------------------------------------ ROBOT — usine (aspirateur kamikaze)
export function robot(e) {
  const M = e.model, m = e.m;
  m.core = group(M);
  part(m.core, 'cyl20', 0xb0b8c8, [0.46, 0.22, 0.46], [0, 0.16, 0]);
  part(m.core, 'cyl20', 0x5c6b8a, [0.4, 0.06, 0.4], [0, 0.29, 0]);
  part(m.core, 'box', 0x2b2d42, [0.6, 0.12, 0.12], [0, 0.12, 0.4]);
  part(m.core, 'box', 0xffd23f, [0.12, 0.02, 0.05], [-0.18, 0.33, -0.12]);
  part(m.core, 'box', 0x2b2d42, [0.12, 0.02, 0.05], [-0.06, 0.33, -0.12]);
  part(m.core, 'box', 0xffd23f, [0.12, 0.02, 0.05], [0.06, 0.33, -0.12]);
  part(m.core, 'cyl', 0x2b2d42, [0.15, 0.06, 0.15], [0, 0.35, 0.05]);
  e.eyes = makeEyes(m.core, { r: 0.075, gap: 0.12, y: 0.22, z: 0.43, color: 0x9fffe0, brows: 0x2b2d42 });
  m.antenna = group(m.core, [0.18, 0.3, -0.1]);
  part(m.antenna, 'cyl', 0x2b2d42, [0.012, 0.3, 0.012], [0, 0.15, 0]);
  m.siren = part(m.antenna, 'ball', glow(0x661111), 0.05, [0, 0.31, 0]);
  m.brushes = [];
  for (const sx of [-1, 1]) {
    const b = group(m.core, [sx * 0.34, 0.05, 0.3]);
    for (let i = 0; i < 3; i++) part(b, 'box', 0x8a6a4a, [0.24, 0.015, 0.025], [0, 0, 0], [0, (i / 3) * Math.PI, 0]);
    m.brushes.push(b);
  }
  common(e, 0.85);
}

// ------------------------------------------------------------------ DRONE — usine / labo
export function drone(e) {
  const M = e.model, m = e.m;
  m.core = group(M);
  part(m.core, 'sphere', 0x5c6b8a, [0.3, 0.17, 0.3], [0, 0.22, 0]);
  part(m.core, 'dome', 0x8fa0c0, [0.2, 0.14, 0.2], [0, 0.32, 0]);
  part(m.core, 'cyl20', 0xffd23f, [0.31, 0.04, 0.31], [0, 0.2, 0]);
  e.eyes = makeEyes(m.core, { r: 0.08, gap: 0.09, y: 0.24, z: 0.25, color: 0xffd0d0, brows: 0x2b2d42 });
  m.emitter = part(m.core, 'cone', glow(0x661111), [0.07, 0.12, 0.07], [0, 0.03, 0], [Math.PI, 0, 0]);
  m.rotors = [];
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    part(m.core, 'box', 0x2b2d42, [0.04, 0.03, 0.42], [x * 0.2, 0.28, z * 0.2], [0, Math.atan2(x, z), 0]);
    const r = group(m.core, [x * 0.36, 0.34, z * 0.36]);
    part(r, 'cyl', 0x2b2d42, [0.03, 0.06, 0.03], [0, -0.02, 0]);
    part(r, 'box', 0xdfe6f0, [0.34, 0.012, 0.05]);
    part(r, 'box', 0xdfe6f0, [0.05, 0.012, 0.34]);
    m.rotors.push(r);
  }
  common(e, 0.75);
}

// ------------------------------------------------------------------ CACTUS — désert (saute, piquant)
export function cactus(e) {
  const M = e.model, m = e.m, G = 0x5dae4a, D = 0x3f8a35;
  m.core = group(M);
  part(m.core, 'cyl', G, [0.27, 0.8, 0.27], [0, 0.48, 0]);
  part(m.core, 'dome', G, [0.27, 0.22, 0.27], [0, 0.88, 0]);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU;
    part(m.core, 'box', D, [0.03, 0.85, 0.03], [Math.cos(a) * 0.255, 0.5, Math.sin(a) * 0.255], [0, -a, 0]);
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 2.2, y = 0.2 + (i % 5) * 0.16;
    part(m.core, 'cone4', glow(0xfff6d0), [0.015, 0.08, 0.015], [Math.cos(a) * 0.3, y, Math.sin(a) * 0.3], [Math.sin(a) * 1.57, 0, -Math.cos(a) * 1.57]);
  }
  m.arms = [];
  for (const sx of [-1, 1]) {
    const a = group(m.core, [sx * 0.25, sx > 0 ? 0.55 : 0.45, 0]);
    part(a, 'cyl', G, [0.1, 0.24, 0.1], [sx * 0.12, 0, 0], [0, 0, Math.PI / 2]);
    part(a, 'cyl', G, [0.1, 0.3, 0.1], [sx * 0.22, sx > 0 ? 0.14 : -0.1, 0]);
    part(a, 'dome', G, [0.1, 0.08, 0.1], [sx * 0.22, sx > 0 ? 0.29 : 0.05, 0]);
    m.arms.push(a);
  }
  e.eyes = makeEyes(m.core, { r: 0.1, gap: 0.11, y: 0.7, z: 0.26, brows: 0x24521f });
  e.eyes.mood('angry');
  m.mouth = smile(m.core, 0.55, 0.275, 0.12);
  m.mouth.rotation.z = Math.PI;
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    part(m.core, 'sphere', 0xff6fb0, [0.07, 0.04, 0.07], [Math.cos(a) * 0.07, 1.1, Math.sin(a) * 0.07]);
  }
  part(m.core, 'ball', glow(0xffd23f), 0.045, [0, 1.13, 0]);
  for (const sx of [-1, 1]) part(m.core, 'sphere', 0x8a5a3a, [0.1, 0.06, 0.12], [sx * 0.12, 0.04, 0.04]);
  common(e, 1.55);
}

// ------------------------------------------------------------------ SKUNK — jungle / médina (nuage toxique)
export function skunk(e) {
  const M = e.model, m = e.m, K = 0x2d2d3a;
  m.core = group(M);
  part(m.core, 'sphere', K, [0.28, 0.26, 0.38], [0, 0.3, 0]);
  part(m.core, 'box', 0xffffff, [0.1, 0.05, 0.66], [0, 0.55, -0.02]);
  m.legs = [];
  for (const [x, z] of [[-0.14, 0.2], [0.14, 0.2], [-0.14, -0.2], [0.14, -0.2]]) m.legs.push(leg(m.core, x, 0.16, z, 0.16, 0.05, K));
  m.head = group(m.core, [0, 0.4, 0.34]);
  part(m.head, 'sphere', K, [0.2, 0.18, 0.19], [0, 0, 0]);
  part(m.head, 'box', 0xffffff, [0.04, 0.16, 0.03], [0, 0.07, 0.16], [0.4, 0, 0]);
  part(m.head, 'ball', glow(PINK), 0.04, [0, -0.04, 0.2]);
  for (const sx of [-1, 1]) part(m.head, 'sphere', K, [0.06, 0.07, 0.04], [sx * 0.12, 0.16, -0.02]);
  e.eyes = makeEyes(m.head, { r: 0.07, gap: 0.085, y: 0.04, z: 0.13, lids: K, brows: 0x111111 });
  e.eyes.mood('sneaky');
  m.tail = group(m.core, [0, 0.42, -0.34], [-0.4, 0, 0]);
  part(m.tail, 'sphere', K, [0.2, 0.32, 0.2], [0, 0.26, -0.05]);
  part(m.tail, 'sphere', K, [0.24, 0.24, 0.24], [0, 0.55, 0.05]);
  part(m.tail, 'sphere', 0xffffff, [0.1, 0.3, 0.12], [0, 0.42, -0.15]);
  common(e, 1.2);
}

// ------------------------------------------------------------------ RAT — labo (blouse, lunettes)
export function rat(e) {
  const M = e.model, m = e.m, G = 0xb0a8b0;
  m.core = group(M);
  part(m.core, 'sphere', G, [0.22, 0.22, 0.3], [0, 0.3, 0]);
  part(m.core, 'cyl', 0xffffff, [0.25, 0.28, 0.28], [0, 0.24, -0.02]);
  part(m.core, 'box', 0x7ab8ff, [0.08, 0.06, 0.02], [0.12, 0.28, 0.27]);
  part(m.core, 'cyl', 0x2a6fdb, [0.01, 0.1, 0.01], [0.14, 0.33, 0.275]);
  m.legs = [];
  for (const sx of [-1, 1]) m.legs.push(leg(m.core, sx * 0.1, 0.12, 0.05, 0.12, 0.04, PINK));
  m.head = group(m.core, [0, 0.45, 0.24]);
  part(m.head, 'sphere', G, [0.16, 0.15, 0.17], [0, 0, 0]);
  part(m.head, 'cone', G, [0.1, 0.22, 0.1], [0, -0.03, 0.2], [Math.PI / 2, 0, 0]);
  part(m.head, 'ball', glow(PINK), 0.035, [0, -0.03, 0.32]);
  for (const sx of [-1, 1]) {
    part(m.head, 'cyl', G, [0.1, 0.02, 0.1], [sx * 0.13, 0.15, -0.02], [Math.PI / 2, 0, sx * 0.3]);
    part(m.head, 'cyl', PINK, [0.07, 0.025, 0.07], [sx * 0.13, 0.15, 0], [Math.PI / 2, 0, sx * 0.3]);
    part(m.head, 'torusThin', glow(BLACK), 0.065, [sx * 0.07, 0.05, 0.14]);
  }
  part(m.head, 'box', glow(BLACK), [0.05, 0.01, 0.01], [0, 0.06, 0.15]);
  e.eyes = makeEyes(m.head, { r: 0.055, gap: 0.07, y: 0.05, z: 0.11, pupil: 0.55 });
  m.tail = [];
  let parent = group(m.core, [0, 0.18, -0.3], [-1.2, 0, 0]);
  for (let i = 0; i < 4; i++) {
    const s = group(parent, i ? [0, 0.12, 0] : [0, 0, 0], [0.4, 0, 0]);
    part(s, 'cyl', PINK, [0.02, 0.13, 0.02], [0, 0.06, 0]);
    m.tail.push(s); parent = s;
  }
  common(e, 1.0);
}

// ------------------------------------------------------------------ CHICKEN — gag (panique totale)
export function chicken(e) {
  const M = e.model, m = e.m;
  m.core = group(M);
  part(m.core, 'sphere', WHITE, [0.26, 0.26, 0.32], [0, 0.36, 0]);
  for (let i = 0; i < 3; i++) part(m.core, 'box', WHITE, [0.06, 0.22, 0.04], [(i - 1) * 0.07, 0.5, -0.3], [-0.5, 0, (i - 1) * 0.4]);
  m.head = group(m.core, [0, 0.62, 0.2]);
  part(m.head, 'sphere', WHITE, [0.15, 0.16, 0.15], [0, 0, 0]);
  for (let i = 0; i < 3; i++) part(m.head, 'sphere', 0xe8322f, [0.04, 0.06, 0.05], [0, 0.17 + (i === 1 ? 0.02 : 0), -0.04 + i * 0.05]);
  part(m.head, 'cone4', 0xffc23a, [0.05, 0.11, 0.05], [0, -0.02, 0.18], [Math.PI / 2, 0, 0]);
  part(m.head, 'sphere', 0xe8322f, [0.03, 0.06, 0.03], [0, -0.1, 0.13]);
  e.eyes = makeEyes(m.head, { r: 0.075, gap: 0.075, y: 0.05, z: 0.1, pupil: 0.4 });
  e.eyes.mood('scared');
  m.wings = [];
  for (const sx of [-1, 1]) {
    const w = group(m.core, [sx * 0.24, 0.42, 0]);
    part(w, 'sphere', 0xf0e8d8, [0.05, 0.14, 0.2], [sx * 0.03, -0.08, 0]);
    m.wings.push({ w, sx });
  }
  m.legs = [];
  for (const sx of [-1, 1]) {
    const l = leg(m.core, sx * 0.09, 0.14, 0, 0.14, 0.02, 0xff9a3a);
    part(l, 'box', 0xff9a3a, [0.1, 0.02, 0.1], [0, -0.14, 0.03]);
    m.legs.push(l);
  }
  common(e, 1.1);
}

/** Toxic cloud puff (skunk). */
export function makeCloud(parent) {
  const g = group(parent);
  const M = seeThrough(0x9be35a, 0.55, 0x223300);
  for (const [x, y, z, s] of [[0, 0, 0, 0.6], [0.45, 0.1, 0.1, 0.45], [-0.4, 0.05, -0.1, 0.5], [0.1, 0.4, -0.2, 0.42], [-0.15, -0.1, 0.4, 0.4]]) {
    part(g, 'sphere', M, s, [x, y, z]);
  }
  g.visible = false;
  return g;
}

export const MODELS = { crab, turtle, plant, bat, porcupine, scorpion, camel, pigeon, cat, penguin, yetiKid, robot, drone, cactus, skunk, rat, chicken };
export { mat, glow };
