// Shared helpers for the environment modules: math, noise, seeded RNG, colour utilities, canvas textures
// and a tiny "part builder" that assembles vertex-coloured low-poly props from primitives.
import * as THREE from 'three';

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** mulberry32 — deterministic RNG in [0,1). */
export function rng(seed = 1) {
  let s = (seed >>> 0) || 1;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function strSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
export function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
export function vnoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  let fx = x - ix, fz = z - iz;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const a = hash2(ix, iz), b = hash2(ix + 1, iz), c = hash2(ix, iz + 1), d = hash2(ix + 1, iz + 1);
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}
export function fbm(x, z, oct = 3) {
  let s = 0, a = 0.5, f = 1, n = 0;
  for (let i = 0; i < oct; i++) { s += vnoise(x * f, z * f) * a; n += a; a *= 0.5; f *= 2.03; }
  return s / n;
}

// ---------------------------------------------------------------- colours
export const LUMEN = {
  teal: 0x387d76, mint: 0x99d1b7, cream: 0xfff7dc, coral: 0xe98c73, gold: 0xedc371,
  night: 0x1c1640, aurora: 0xb5f3d0, dawn: 0xffc193, comet: 0xdbb2f6,
};
export const css = (h) => '#' + (h >>> 0).toString(16).padStart(6, '0').slice(-6);
export function mixHex(a, b, t) {
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  return (Math.round(lerp(ar, br, t)) << 16) | (Math.round(lerp(ag, bg, t)) << 8) | Math.round(lerp(ab, bb, t));
}
export function mulHex(a, k) {
  const f = (v) => clamp(Math.round(v * k), 0, 255);
  return (f((a >> 16) & 255) << 16) | (f((a >> 8) & 255) << 8) | f(a & 255);
}
export const cssA = (h, a) => `rgba(${(h >> 16) & 255},${(h >> 8) & 255},${h & 255},${a})`;

// ---------------------------------------------------------------- canvas textures
let ANISO = 4;
export function setAnisotropy(renderer, level) {
  try {
    const max = renderer?.capabilities?.getMaxAnisotropy?.() || 4;
    ANISO = Math.min(max, level >= 2 ? 8 : 4);
  } catch { ANISO = 4; }
}
export function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
export function canvasTex(c, { repeat = true, srgb = true, mips = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) { t.wrapS = THREE.RepeatWrapping; t.wrapT = THREE.RepeatWrapping; }
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = ANISO;
  t.generateMipmaps = mips;
  t.minFilter = mips ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}
/** Calls draw(x, y) for every wrapped copy needed so a shape of radius r tiles seamlessly. */
export function wrapDraw(W, H, x, y, r, draw) {
  for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx * W;
    if (xx + r < 0 || xx - r > W) continue;
    for (let dy = -1; dy <= 1; dy++) {
      const yy = y + dy * H;
      if (yy + r < 0 || yy - r > H) continue;
      draw(xx, yy);
    }
  }
}
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
export const FONT = '"Fredoka", "Arial Rounded MT Bold", "Trebuchet MS", "Verdana", sans-serif';

// ---------------------------------------------------------------- part builder (vertex-coloured props)
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Assembles a prop from primitives. Each part gets a flat colour (with a little jitter), an optional sway weight
 * (wind animation in the shader, scaled by height) and can be "glow" (unlit material, e.g. flames, lanterns).
 * build() → { lit: {pos, nrm, col, sway, count}, glow: {...}|null, height, radius }
 */
export class Parts {
  constructor(seed = 7) {
    this.lit = { pos: [], nrm: [], col: [], sway: [] };
    this.glow = { pos: [], nrm: [], col: [], sway: [] };
    this.r = rng(seed);
  }
  /** add any BufferGeometry (disposed after) */
  add(geo, color, o = {}) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    if (g !== geo) geo.dispose();
    if (o.flat !== false && !o.smooth) { g.deleteAttribute('normal'); g.computeVertexNormals(); }
    _e.set(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ');
    _q.setFromEuler(_e);
    const sc = o.s ?? 1;
    _s.set(o.sx ?? sc, o.sy ?? sc, o.sz ?? sc);
    _p.set(o.x || 0, o.y || 0, o.z || 0);
    _m.compose(_p, _q, _s);
    g.applyMatrix4(_m);
    const P = g.attributes.position, N = g.attributes.normal;
    const dst = o.glow ? this.glow : this.lit;
    const j = o.jitter ?? 0.06;
    _c.setHex(color);
    const k = 1 + (this.r() - 0.5) * 2 * j;
    const cr = _c.r * k, cg = _c.g * k, cb = _c.b * k;
    const sway = o.sway || 0;
    for (let i = 0; i < P.count; i++) {
      dst.pos.push(P.getX(i), P.getY(i), P.getZ(i));
      dst.nrm.push(N.getX(i), N.getY(i), N.getZ(i));
      dst.col.push(cr, cg, cb);
      dst.sway.push(sway);
    }
    g.dispose();
    return this;
  }
  box(w, h, d, color, o = {}) { return this.add(new THREE.BoxGeometry(w, h, d), color, o); }
  _seg(n) { return this.lod ? Math.max(4, Math.min(n, 5)) : n; }
  cyl(rt, rb, h, color, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, this._seg(o.seg ?? 7), o.hseg ?? 1, !!o.open), color, o); }
  cone(r, h, color, o = {}) { return this.add(new THREE.ConeGeometry(r, h, this._seg(o.seg ?? 7), o.hseg ?? 1), color, o); }
  ball(r, color, o = {}) { return this.add(new THREE.IcosahedronGeometry(r, this.lod ? 0 : (o.detail ?? 1)), color, o); }
  sphere(r, color, o = {}) { const k = this.lod ? 0.6 : 1; return this.add(new THREE.SphereGeometry(r, Math.max(5, Math.round((o.ws ?? 10) * k)), Math.max(3, Math.round((o.hs ?? 7) * k)), 0, Math.PI * 2, 0, o.cap ?? Math.PI), color, { smooth: true, ...o }); }
  torus(r, t, color, o = {}) { return this.add(new THREE.TorusGeometry(r, t, o.rs ?? 5, o.ts ?? 12, o.arc ?? Math.PI * 2), color, o); }
  /** a tapered segment between two points (branches, palm trunk pieces, pipes) */
  seg(a, b, ra, rb, color, o = {}) {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
    const len = Math.hypot(dx, dy, dz) || 1e-3;
    const g = new THREE.CylinderGeometry(rb, ra, len, this._seg(o.seg ?? 6), 1, !!o.open);
    g.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / len, dy / len, dz / len));
    g.applyQuaternion(q);
    g.translate(a[0], a[1], a[2]);
    return this.add(g, color, { ...o, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, s: 1 });
  }
  /** a flat leaf/blade quad (double-sided via two faces), from base point along direction with width */
  leaf(base, dir, len, width, color, o = {}) {
    const [dx, dy, dz] = dir;
    const L = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / L, uy = dy / L, uz = dz / L;
    // side vector: horizontal perpendicular
    let sx = -uz, sz = ux; const sl = Math.hypot(sx, sz) || 1; sx /= sl; sz /= sl;
    const droop = o.droop ?? 0.35;
    const pts = [];
    const n = this.lod ? 2 : 3;
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const w = width * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * 0.5;
      const cx = base[0] + ux * len * t, cy = base[1] + uy * len * t - droop * len * t * t, cz = base[2] + uz * len * t;
      pts.push([cx - sx * w, cy, cz - sz * w], [cx + sx * w, cy, cz + sz * w]);
    }
    const P = [];
    for (let i = 0; i < n; i++) {
      const a = pts[i * 2], b = pts[i * 2 + 1], c = pts[i * 2 + 2], d = pts[i * 2 + 3];
      P.push(...a, ...b, ...c, ...b, ...d, ...c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    return this.add(g, color, o);
  }
  build() {
    const pack = (b) => {
      if (!b.pos.length) return null;
      return { pos: new Float32Array(b.pos), nrm: new Float32Array(b.nrm), col: new Float32Array(b.col), sway: new Float32Array(b.sway), count: b.pos.length / 3 };
    };
    // height-scaled sway + fake ambient occlusion near the ground
    let hmax = 0.01, rmax = 0.01;
    for (const b of [this.lit, this.glow]) for (let i = 0; i < b.pos.length; i += 3) {
      hmax = Math.max(hmax, b.pos[i + 1]); rmax = Math.max(rmax, Math.hypot(b.pos[i], b.pos[i + 2]));
    }
    for (const b of [this.lit, this.glow]) {
      for (let i = 0, v = 0; i < b.pos.length; i += 3, v++) {
        const y = b.pos[i + 1];
        b.sway[v] *= clamp(y / hmax, 0, 1) ** 1.5;
        if (b === this.lit && !this.noAO) {
          const ao = 0.62 + 0.38 * smoothstep(-0.1, Math.min(1.4, hmax * 0.5), y);
          b.col[i] *= ao; b.col[i + 1] *= ao; b.col[i + 2] *= ao;
        }
      }
    }
    return { lit: pack(this.lit), glow: pack(this.glow), height: hmax, radius: rmax };
  }
}

/** Accumulates baked prop instances (world transforms) into one BufferGeometry. */
export class Baker {
  constructor() { this.parts = []; this.count = 0; }
  push(t, m4, tint = 1, tintCol = null) {
    if (!t) return;
    this.parts.push([t, m4.clone(), tint, tintCol]);
    this.count += t.count;
  }
  build() {
    if (!this.count) return null;
    const pos = new Float32Array(this.count * 3), nrm = new Float32Array(this.count * 3), col = new Float32Array(this.count * 3), sway = new Float32Array(this.count);
    const nm = new THREE.Matrix3();
    let o = 0;
    for (const [t, m, tint, tc] of this.parts) {
      const e = m.elements;
      nm.getNormalMatrix(m);
      const n = nm.elements;
      for (let i = 0; i < t.count; i++) {
        const x = t.pos[i * 3], y = t.pos[i * 3 + 1], z = t.pos[i * 3 + 2];
        pos[o * 3] = e[0] * x + e[4] * y + e[8] * z + e[12];
        pos[o * 3 + 1] = e[1] * x + e[5] * y + e[9] * z + e[13];
        pos[o * 3 + 2] = e[2] * x + e[6] * y + e[10] * z + e[14];
        const nx = t.nrm[i * 3], ny = t.nrm[i * 3 + 1], nz = t.nrm[i * 3 + 2];
        let ax = n[0] * nx + n[3] * ny + n[6] * nz, ay = n[1] * nx + n[4] * ny + n[7] * nz, az = n[2] * nx + n[5] * ny + n[8] * nz;
        const l = Math.hypot(ax, ay, az) || 1;
        nrm[o * 3] = ax / l; nrm[o * 3 + 1] = ay / l; nrm[o * 3 + 2] = az / l;
        if (tc) {
          col[o * 3] = t.col[i * 3] * tc[0]; col[o * 3 + 1] = t.col[i * 3 + 1] * tc[1]; col[o * 3 + 2] = t.col[i * 3 + 2] * tc[2];
        } else {
          col[o * 3] = t.col[i * 3] * tint; col[o * 3 + 1] = t.col[i * 3 + 1] * tint; col[o * 3 + 2] = t.col[i * 3 + 2] * tint;
        }
        sway[o] = t.sway[i];
        o++;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('sway', new THREE.BufferAttribute(sway, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}
