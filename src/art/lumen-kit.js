// Lumen art kit — shared helpers for the character, Oku Oku and the mounts (agent Personnage).
// Everything here is cached at module level: geometries / materials / textures are built once and
// shared by every instance (they are flagged userData.shared so nobody disposes them).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const PI = Math.PI, TAU = Math.PI * 2;
export const PAL = {
  teal: 0x387d76, deep: 0x306f70, mint: 0x99d1b7, leaf: 0xa6dfc6, cream: 0xfff7dc,
  scarf: 0xe98c73, stitch: 0xffe2ac, starGold: 0xedc371, chestStar: 0xf3d096, eye: 0x25575b,
  cheek: 0xedba9c, mouth: 0xd9785f, feet: 0x234f53, belly: 0x99d1b7, bellyStitch: 0xd2e4b3, core: 0xfff0ce,
};

export const HAS_DOM = typeof document !== 'undefined' && typeof document.createElement === 'function';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
export const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const easeOut = (t) => { t = clamp(t, 0, 1); return 1 - (1 - t) * (1 - t); };
export const easeIn = (t) => { t = clamp(t, 0, 1); return t * t; };
/** 0→1→0 bump over [a,b]. */
export const bump = (t, a, b) => (t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * PI));
/** Damped spring "boing" (1 at t=0 → 0). */
export const boing = (t, f = 14, d = 6) => Math.exp(-d * t) * Math.cos(f * t);
export const wrapAngle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ caches
const _geo = new Map();
const _mat = new Map();
const _tex = new Map();
export function cachedGeo(key, make) {
  let g = _geo.get(key);
  if (!g) { g = make(); g.userData.shared = true; _geo.set(key, g); }
  return g;
}
export function cachedMat(key, make) {
  let m = _mat.get(key);
  if (!m) { m = make(); m.userData.shared = true; _mat.set(key, m); }
  return m;
}
/** Canvas texture (null when there is no DOM — Node tests). */
export function cachedTex(key, w, h, draw, opts = {}) {
  if (!HAS_DOM) return null;
  let t = _tex.get(key);
  if (!t) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    draw(g, w, h);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = opts.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
    t.anisotropy = 2;
    if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
    t.userData.shared = true;
    _tex.set(key, t);
  }
  return t;
}

/** Dispose only non-shared resources of a subtree. */
export function disposeOwned(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const m = o.material;
    if (m) for (const mm of Array.isArray(m) ? m : [m]) if (!mm.userData.shared) mm.dispose();
  });
}

// ------------------------------------------------------------------ materials
// "Felt" look: matte standard material + a soft fresnel rim (reads on any background, even from behind)
// + a small emissive lift so pastel colours never go muddy in shade.
export const RIM = { color: { value: new THREE.Color(0xfff2d6) }, strength: { value: 0.32 } };
export const LUMEN_RIM = { color: { value: new THREE.Color(0xfff2d6) }, strength: { value: 0.28 } };
function addRim(m, rim, lift) {
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uRimColor = rim.color;
    sh.uniforms.uRimStrength = rim.strength;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uRimColor;\nuniform float uRimStrength;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ vec3 rv = normalize(vViewPosition); float rf = 1.0 - clamp(dot(normal, rv), 0.0, 1.0);
  totalEmissiveRadiance += uRimColor * (rf * rf * rf) * uRimStrength + diffuseColor.rgb * ${lift.toFixed(3)}; }`);
  };
  m.customProgramCacheKey = () => `lbrim:${lift.toFixed(3)}:${rim === LUMEN_RIM ? 'L' : 'G'}`;
  return m;
}
/** Vertex-coloured felt (merged parts). */
export function feltVC(rim = RIM, lift = 0.1) {
  return cachedMat(`feltvc:${rim === LUMEN_RIM}:${lift}`, () => addRim(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0 }), rim, lift));
}
export function felt(color, rough = 0.8, lift = 0.1, rim = RIM, extra = null) {
  return cachedMat(`felt:${color}:${rough}:${lift}:${rim === LUMEN_RIM}`, () => addRim(new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, ...(extra || {}) }), rim, lift));
}
export function std(color, rough = 0.6, metal = 0, extra = null, tag = '') {
  return cachedMat(`std:${color}:${rough}:${metal}:${tag}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...(extra || {}) }));
}
export function glow(color, intensity = 0.5, tag = '') {
  return cachedMat(`glow:${color}:${intensity}:${tag}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.25, emissive: color, emissiveIntensity: intensity }));
}
export function basic(color, extra = null, tag = '') {
  return cachedMat(`basic:${color}:${tag}`, () => new THREE.MeshBasicMaterial({ color, ...(extra || {}) }));
}
export function additive(color, opacity = 0.6, tag = '', map = null) {
  return cachedMat(`add:${color}:${opacity}:${tag}`, () => new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, map, toneMapped: false,
  }));
}

// ------------------------------------------------------------------ shapes
export function sparkleShape(r, pinch = 0.26) {
  const s = new THREE.Shape(), k = r * pinch;
  s.moveTo(0, r);
  s.quadraticCurveTo(k, k, r, 0);
  s.quadraticCurveTo(k, -k, 0, -r);
  s.quadraticCurveTo(-k, -k, -r, 0);
  s.quadraticCurveTo(-k, k, 0, r);
  return s;
}
/** Leaf (base at origin, tip at +Y 1.5*size). */
export function leafShape(size, w = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(-size * 0.62 * w, size * 0.4, -size * 0.52 * w, size, 0, size * 1.5);
  s.bezierCurveTo(size * 0.52 * w, size, size * 0.62 * w, size * 0.4, 0, 0);
  return s;
}
export function star5Shape(outer, inner) {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = PI / 2 + (i / 10) * TAU, r = i % 2 ? inner : outer;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  return s;
}
export function extrude(shape, depth, bevel = 0, curveSegments = 8) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 2, curveSegments });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// ------------------------------------------------------------------ primitive geometries (shared)
export const G = {
  sphere: (w = 18, h = 12) => cachedGeo(`sph:${w}:${h}`, () => new THREE.SphereGeometry(1, w, h)),
  box: () => cachedGeo('box', () => new THREE.BoxGeometry(1, 1, 1)),
  cyl: (s = 12) => cachedGeo(`cyl:${s}`, () => new THREE.CylinderGeometry(1, 1, 1, s)),
  cone: (s = 12) => cachedGeo(`cone:${s}`, () => new THREE.ConeGeometry(1, 1, s)),
  /** capsule of radius 1 whose cylinder part is `len` (local Y). */
  capsule: (len, r = 1) => cachedGeo(`cap:${len}:${r}`, () => new THREE.CapsuleGeometry(r, len, 4, 10)),
  torus: (R, t, rs = 8, ts = 20, arc = TAU) => cachedGeo(`tor:${R}:${t}:${rs}:${ts}:${arc}`, () => new THREE.TorusGeometry(R, t, rs, ts, arc)),
  plane: () => cachedGeo('plane', () => new THREE.PlaneGeometry(1, 1)),
  circle: (s = 20) => cachedGeo(`circ:${s}`, () => new THREE.CircleGeometry(1, s)),
};

export function mesh(geo, mat, p = null, r = null, s = null) {
  const m = new THREE.Mesh(geo, mat);
  if (p) m.position.set(p[0], p[1], p[2]);
  if (r) m.rotation.set(r[0], r[1], r[2]);
  if (s != null) { if (typeof s === 'number') m.scale.setScalar(s); else m.scale.set(s[0], s[1], s[2]); }
  return m;
}
export function group(p = null, r = null, name = '') {
  const g = new THREE.Group();
  if (p) g.position.set(p[0], p[1], p[2]);
  if (r) g.rotation.set(r[0], r[1], r[2]);
  if (name) g.name = name;
  return g;
}

// ------------------------------------------------------------------ vertex-coloured merger
const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();
/** Collects coloured parts and merges them into ONE geometry (1 draw call). */
export class Parts {
  constructor() { this.list = []; }
  /** add(geo, color | (pos,normal)=>Color, p, r, s) — r = Euler [x,y,z] or a Quaternion */
  add(geo, color, p = [0, 0, 0], r = null, s = 1) {
    if (r && r.isQuaternion) _q.copy(r); else _q.setFromEuler(_e.set(r ? r[0] : 0, r ? r[1] : 0, r ? r[2] : 0));
    _s.set(...(typeof s === 'number' ? [s, s, s] : s));
    _m4.compose(_p.set(p[0], p[1], p[2]), _q, _s);
    const g = (geo.index ? geo.toNonIndexed() : geo.clone());
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    // colour in object space BEFORE transform (so functions can use the primitive's own normal)
    const n = g.attributes.position.count, col = new Float32Array(n * 3);
    const P = g.attributes.position, N = g.attributes.normal;
    for (let i = 0; i < n; i++) {
      if (typeof color === 'function') color(_p.set(P.getX(i), P.getY(i), P.getZ(i)), _s.set(N.getX(i), N.getY(i), N.getZ(i)), _c);
      else _c.set(color);
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.applyMatrix4(_m4);
    g.groups.length = 0;
    this.list.push(g);
    return this;
  }
  build() {
    const g = this.list.length ? mergeGeometries(this.list, false) : new THREE.BufferGeometry();
    for (const x of this.list) x.dispose();
    this.list = [];
    g.computeBoundingSphere();
    return g;
  }
}

/** Point on an ellipsoid head-like surface: yaw (around Y, 0 = +Z), pitch (up). Returns {p, n}. */
export function ellipsoidSurf(R, sc, center = [0, 0, 0]) {
  return (yaw, pitch, out = 0) => {
    const dir = V3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    const p = V3(dir.x * R * sc[0], dir.y * R * sc[1], dir.z * R * sc[2]);
    const n = V3(p.x / (sc[0] * sc[0]), p.y / (sc[1] * sc[1]), p.z / (sc[2] * sc[2])).normalize();
    p.addScaledVector(n, out).add(V3(center[0], center[1], center[2]));
    return { p, n };
  };
}
const ZF = V3(0, 0, 1);
export function faceQ(n, roll = 0) {
  const q = new THREE.Quaternion().setFromUnitVectors(ZF, n.clone().normalize());
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(ZF, roll));
  return q;
}
export function qFromTo(a, b) { return new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize()); }

// ------------------------------------------------------------------ textures
export function css(hex) { return '#' + (hex >>> 0).toString(16).padStart(6, '0').slice(-6); }
export function shade(hex, mul = 1, add = 0) {
  const c = new THREE.Color(hex), hsl = {};
  c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, clamp(hsl.l * mul + add, 0, 1));
  return c.getHex();
}
function rr(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
export const roundRect = rr;
/** The knitted scarf ribbon texture (u across, v=1 at the neck, v=0 at the fringed tip). */
export function scarfTexture(color) {
  return cachedTex(`scarf:${color}`, 64, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    const base = css(color), edge = css(shade(color, 0.8)), hi = css(shade(color, 1, 0.07));
    const body = h * 0.88;
    const grd = g.createLinearGradient(0, 0, w, 0);
    grd.addColorStop(0, edge); grd.addColorStop(0.22, base); grd.addColorStop(0.5, hi); grd.addColorStop(0.78, base); grd.addColorStop(1, edge);
    g.fillStyle = grd; g.fillRect(0, 0, w, body);
    g.strokeStyle = 'rgba(106,64,88,0.16)'; g.lineWidth = 1;
    for (let y = -w; y < body; y += 5) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y + w * 0.6); g.stroke(); }
    // ribbing stripes
    g.fillStyle = 'rgba(255,255,255,0.10)';
    for (let y = 18; y < body; y += 36) g.fillRect(0, y, w, 6);
    g.fillStyle = css(PAL.stitch);
    for (let y = 4; y < body - 2; y += 9) { rr(g, w * 0.5 - 1.8, y, 3.6, 5.4, 1.6); g.fill(); }
    g.globalAlpha = 0.6;
    for (let y = 8; y < body - 2; y += 9) {
      g.beginPath(); g.arc(w * 0.13, y, 1.4, 0, TAU); g.fill();
      g.beginPath(); g.arc(w * 0.87, y, 1.4, 0, TAU); g.fill();
    }
    g.globalAlpha = 1;
    g.fillStyle = edge;
    for (let i = 0; i < 5; i++) { const x0 = (i / 5) * w + 2, x1 = ((i + 1) / 5) * w - 2; rr(g, x0, body - 4, x1 - x0, h - body + 2, 3); g.fill(); }
  });
}
/** Soft radial dot / ring / sparkle atlas (2×2) for the particle points. */
export function particleAtlas() {
  return cachedTex('lb-particles', 128, 128, (g) => {
    g.clearRect(0, 0, 128, 128);
    // 0: soft puff (top-left)
    let grd = g.createRadialGradient(32, 32, 2, 32, 32, 30);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.55, 'rgba(255,255,255,0.75)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(32, 32, 30, 0, TAU); g.fill();
    // 1: bubble ring (top-right)
    g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 4; g.beginPath(); g.arc(96, 32, 24, 0, TAU); g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.arc(96, 32, 22, 0, TAU); g.fill();
    g.fillStyle = 'rgba(255,255,255,1)'; g.beginPath(); g.ellipse(88, 23, 6, 4, -0.6, 0, TAU); g.fill();
    // 2: sparkle (bottom-left)
    g.save(); g.translate(32, 96); g.fillStyle = '#fff';
    g.beginPath(); g.moveTo(0, -30); g.quadraticCurveTo(5, -5, 30, 0); g.quadraticCurveTo(5, 5, 0, 30); g.quadraticCurveTo(-5, 5, -30, 0); g.quadraticCurveTo(-5, -5, 0, -30); g.fill();
    grd = g.createRadialGradient(0, 0, 1, 0, 0, 14); grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(0, 0, 14, 0, TAU); g.fill();
    g.restore();
    // 3: flake / ash chunk (bottom-right)
    g.fillStyle = '#fff'; g.beginPath();
    g.moveTo(80, 82); g.lineTo(108, 76); g.lineTo(116, 100); g.lineTo(98, 116); g.lineTo(76, 106); g.closePath(); g.fill();
  });
}

// ------------------------------------------------------------------ particles (one Points, world-space sim)
const PVS = `attribute float size; attribute vec4 rgba; attribute float frame; varying vec4 vC; varying float vF;
uniform float uScale;
void main(){ vC = rgba; vF = frame; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * uScale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const PFS = `uniform sampler2D uMap; uniform float uHasMap; varying vec4 vC; varying float vF;
void main(){ vec2 uv = gl_PointCoord; uv.y = 1.0 - uv.y; vec2 o = vec2(mod(vF, 2.0), 1.0 - floor(vF / 2.0)) * 0.5;
 float a = uHasMap > 0.5 ? texture2D(uMap, o + uv * 0.5).a : (1.0 - smoothstep(0.3, 0.5, length(gl_PointCoord - 0.5)));
 gl_FragColor = vec4(vC.rgb, vC.a * a); if (gl_FragColor.a < 0.02) discard; }`;
export const FRAME = { puff: 0, bubble: 1, spark: 2, flake: 3 };

export class Particles {
  constructor(cap = 64) {
    this.cap = cap;
    this.pos = new Float32Array(cap * 3);
    this.rgba = new Float32Array(cap * 4);
    this.size = new Float32Array(cap);
    this.frame = new Float32Array(cap);
    this.p = [];
    for (let i = 0; i < cap; i++) this.p.push({ on: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, g: 0, drag: 0, life: 0, max: 1, s0: 0.1, s1: 0.1, r: 1, gg: 1, b: 1, a: 1, frame: 0, wob: 0, ph: 0, fadeIn: 0.05 });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('rgba', new THREE.BufferAttribute(this.rgba, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('frame', new THREE.BufferAttribute(this.frame, 1).setUsage(THREE.DynamicDrawUsage));
    const map = particleAtlas();
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uMap: { value: map }, uHasMap: { value: map ? 1 : 0 }, uScale: { value: 400 } },
      vertexShader: PVS, fragmentShader: PFS, transparent: true, depthWrite: false,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 5;
    const u = this.mat.uniforms.uScale;
    const _v = new THREE.Vector2();
    this.points.onBeforeRender = (renderer, scene, camera) => {
      renderer.getDrawingBufferSize(_v);
      u.value = _v.y * 0.5 * (camera.projectionMatrix.elements[5] || 1);
    };
    this.inv = new THREE.Matrix4();
    this.count = 0;
  }
  emit(x, y, z, o) {
    let slot = null;
    for (const q of this.p) if (!q.on) { slot = q; break; }
    if (!slot) return null;
    const c = _c.set(o.color ?? 0xffffff), q = slot;
    q.on = true; q.x = x; q.y = y; q.z = z; q.vx = o.vx ?? 0; q.vy = o.vy ?? 0; q.vz = o.vz ?? 0; q.g = o.g ?? 0; q.drag = o.drag ?? 0;
    q.life = 0; q.max = o.life ?? 1; q.s0 = o.s0 ?? 0.15; q.s1 = o.s1 ?? 0.05; q.r = c.r; q.gg = c.g; q.b = c.b; q.a = o.a ?? 1;
    q.frame = o.frame ?? 0; q.wob = o.wob ?? 0; q.ph = Math.random() * 10; q.fadeIn = o.fadeIn ?? 0.05;
    return slot;
  }
  clear() { for (const q of this.p) q.on = false; }
  /** Simulate in world space, write positions in the local space of `parent` (matrixWorld must be fresh). */
  update(dt, parent) {
    this.inv.copy(parent.matrixWorld).invert();
    const e = this.inv.elements;
    let n = 0;
    for (const q of this.p) {
      if (!q.on) continue;
      q.life += dt;
      if (q.life >= q.max) { q.on = false; continue; }
      const k = Math.exp(-q.drag * dt);
      q.vx *= k; q.vz *= k; q.vy = q.vy * k - q.g * dt;
      q.x += q.vx * dt + (q.wob ? Math.sin(q.life * 9 + q.ph) * q.wob * dt : 0);
      q.y += q.vy * dt; q.z += q.vz * dt;
      const t = q.life / q.max;
      const i3 = n * 3, i4 = n * 4;
      this.pos[i3] = e[0] * q.x + e[4] * q.y + e[8] * q.z + e[12];
      this.pos[i3 + 1] = e[1] * q.x + e[5] * q.y + e[9] * q.z + e[13];
      this.pos[i3 + 2] = e[2] * q.x + e[6] * q.y + e[10] * q.z + e[14];
      this.rgba[i4] = q.r; this.rgba[i4 + 1] = q.gg; this.rgba[i4 + 2] = q.b;
      this.rgba[i4 + 3] = q.a * Math.min(1, q.life / Math.max(0.001, q.fadeIn)) * (1 - t * t);
      this.size[n] = lerp(q.s0, q.s1, t);
      this.frame[n] = q.frame;
      n++;
    }
    this.count = n;
    const g = this.points.geometry;
    g.setDrawRange(0, n);
    g.attributes.position.needsUpdate = true; g.attributes.rgba.needsUpdate = true;
    g.attributes.size.needsUpdate = true; g.attributes.frame.needsUpdate = true;
    this.points.visible = n > 0;
  }
  dispose() { this.points.geometry.dispose(); this.mat.dispose(); }
}

/** Tiny deterministic RNG. */
export function rng(seed = 1) {
  let s = seed * 9301 + 49297;
  return () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
}
