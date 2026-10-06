// Lumen's scarf tails: a tiny world-space verlet ribbon (2 strips), rendered as a dynamic strip in the
// local space of its parent. Inertia, running wind, flutter, body collisions, "toupie" stretch,
// free fall (explosion) and the "gulp" retract (eaten). No per-frame allocation.
import * as THREE from 'three';
import { cachedMat, scarfTexture, clamp, lerp } from './lumen-kit.js';

const STRIPS = [
  { n: 9, len: 0.46, w: 0.15, ox: 0.035, phase: 0, lift: 1 },
  { n: 7, len: 0.32, w: 0.125, ox: -0.035, phase: 1.9, lift: 0.8 },
];

export function scarfRibbonMat(color) {
  return cachedMat(`lumen-scarf-ribbon:${color}`, () => {
    const map = scarfTexture(color);
    return new THREE.MeshStandardMaterial({
      color: map ? 0xffffff : color, map, side: THREE.DoubleSide, alphaTest: 0.5, roughness: 0.85, metalness: 0,
      emissive: color, emissiveIntensity: 0.12,
    });
  });
}

const _a = new THREE.Vector3(), _d = new THREE.Vector3(), _w = new THREE.Vector3(), _n = new THREE.Vector3(), _t = new THREE.Vector3();
const _inv = new THREE.Matrix4();

export class ScarfRibbon {
  constructor(color) {
    this.strips = STRIPS.map((s) => ({
      ...s, seg: s.len / (s.n - 1),
      p: new Float32Array(s.n * 3), o: new Float32Array(s.n * 3),
    }));
    let verts = 0;
    for (const s of this.strips) verts += s.n * 2;
    this.pos = new Float32Array(verts * 3);
    this.nor = new Float32Array(verts * 3);
    const uv = new Float32Array(verts * 2);
    const idx = [];
    let v = 0;
    for (const s of this.strips) {
      for (let i = 0; i < s.n; i++) {
        const t = 1 - i / (s.n - 1);
        uv.set([0, t, 1, t], (v + i * 2) * 2);
        if (i < s.n - 1) { const a = v + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      s.v0 = v; v += s.n * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(this.nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 3);
    this.geo = geo;
    this.mesh = new THREE.Mesh(geo, scarfRibbonMat(color));
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = false;
    this.mesh.name = 'lumen-scarf';
    this.initialized = false;
    this.lenMul = 1;
    this.time = 0;
  }
  setColor(color) { this.mesh.material = scarfRibbonMat(color); }

  /** Put every point at the anchor, hanging down the back. */
  snap(anchor, back) {
    for (const s of this.strips) {
      for (let i = 0; i < s.n; i++) {
        const k = i * 3;
        s.p[k] = anchor.x + back.x * s.seg * i * 0.4; s.p[k + 1] = anchor.y - s.seg * i * 0.9; s.p[k + 2] = anchor.z + back.z * s.seg * i * 0.4;
        s.o[k] = s.p[k]; s.o[k + 1] = s.p[k + 1]; s.o[k + 2] = s.p[k + 2];
      }
    }
    this.initialized = true;
  }

  /** Launch all points (explosion): velocity in m/s. */
  kick(vx, vy, vz, spread = 1) {
    for (const s of this.strips) for (let i = 0; i < s.n; i++) {
      const k = i * 3, j = (i / s.n) * spread;
      s.o[k] = s.p[k] - (vx + Math.sin(i * 2.1) * j) / 60;
      s.o[k + 1] = s.p[k + 1] - (vy + i * 0.3 * spread) / 60;
      s.o[k + 2] = s.p[k + 2] - (vz + Math.cos(i * 1.7) * j) / 60;
    }
  }

  /**
   * o: { anchor, back, right, vel, speed, spin (0..1), spinYaw, tornado, pinned, gravity, groundY,
   *      bodyC, bodyR, headC, headR, gulp (0..1 → horizontal stick-out, then retract), gulpDir, wind }
   */
  update(dt, o, parent) {
    if (!this.initialized) this.snap(o.anchor, o.back);
    this.time += dt;
    const T = this.time;
    const steps = dt > 1 / 70 ? 2 : 1;
    const h = dt / steps;
    const damp = Math.exp(-(o.pinned ? 3.2 : 1.6) * h);
    const sp = o.speed || 0;
    for (const s of this.strips) {
      const P = s.p, O = s.o, n = s.n, seg = s.seg * this.lenMul;
      for (let st = 0; st < steps; st++) {
        // integrate
        for (let i = o.pinned ? 1 : 0; i < n; i++) {
          const k = i * 3, f = i / (n - 1);
          let ax = 0, ay = -(o.gravity ?? 6.5) * (1 - clamp(sp / 9, 0, 0.75)), az = 0;
          // relative wind from running (pushes the tail backward) + flutter
          ax += -o.vel.x * 2.4; az += -o.vel.z * 2.4; ay += -o.vel.y * 0.6 + sp * 0.35 * s.lift;
          const fl = (0.5 + sp * 0.9) * f;
          const w1 = Math.sin(T * 13 + i * 0.95 + s.phase), w2 = Math.cos(T * 9.3 + i * 0.7 + s.phase);
          ax += o.right.x * w1 * fl * 2.2; az += o.right.z * w1 * fl * 2.2; ay += w2 * fl * 1.6;
          if (o.wind) { ax += o.wind.x; ay += o.wind.y; az += o.wind.z; }
          const vx = (P[k] - O[k]) * damp, vy = (P[k + 1] - O[k + 1]) * damp, vz = (P[k + 2] - O[k + 2]) * damp;
          O[k] = P[k]; O[k + 1] = P[k + 1]; O[k + 2] = P[k + 2];
          P[k] += vx + ax * h * h; P[k + 1] += vy + ay * h * h; P[k + 2] += vz + az * h * h;
        }
        if (o.pinned) { P[0] = o.anchor.x; P[1] = o.anchor.y; P[2] = o.anchor.z; }
        // spin: the tails whip around, stretched out horizontally (Toupie d'écharpe)
        if (o.spin > 0.01) {
          const r0 = 0.12, k0 = o.spin * 0.55;
          for (let i = 1; i < n; i++) {
            const k = i * 3, f = i / (n - 1);
            const a = o.spinYaw - f * (0.9 + (o.tornado ? 0.4 : 0)) + s.phase * 0.15;
            const rad = r0 + i * seg * (1.25 + (o.tornado ? 0.35 : 0));
            const tx = o.bodyC.x + Math.sin(a) * rad, tz = o.bodyC.z + Math.cos(a) * rad;
            const ty = o.anchor.y + 0.03 * Math.sin(T * 30 + i) - f * 0.06 + (o.tornado ? f * 0.25 : 0);
            P[k] = lerp(P[k], tx, k0); P[k + 1] = lerp(P[k + 1], ty, k0); P[k + 2] = lerp(P[k + 2], tz, k0);
            O[k] = lerp(O[k], P[k], k0); O[k + 1] = lerp(O[k + 1], P[k + 1], k0); O[k + 2] = lerp(O[k + 2], P[k + 2], k0);
          }
        }
        // eaten: the tip sticks out of the monster's mouth, wiggles, then gets slurped
        if (o.gulp != null) {
          const L = o.gulp;
          for (let i = 0; i < n; i++) {
            const k = i * 3, f = i / (n - 1);
            const d = f * s.len * L;
            const wig = Math.sin(T * 16 - f * 6 + s.phase) * 0.05 * f * L;
            P[k] = o.anchor.x + o.gulpDir.x * d + o.right.x * (wig + s.ox * 0.5);
            P[k + 1] = o.anchor.y - f * 0.08 * L + Math.cos(T * 11 - f * 4) * 0.02 * f;
            P[k + 2] = o.anchor.z + o.gulpDir.z * d + o.right.z * (wig + s.ox * 0.5);
            O[k] = P[k]; O[k + 1] = P[k + 1]; O[k + 2] = P[k + 2];
          }
          continue;
        }
        // constraints
        for (let it = 0; it < 3; it++) {
          for (let i = 1; i < n; i++) {
            const a = (i - 1) * 3, b = i * 3;
            const dx = P[b] - P[a], dy = P[b + 1] - P[a + 1], dz = P[b + 2] - P[a + 2];
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-6;
            const diff = (d - seg) / d;
            if (o.pinned && i === 1) { P[b] -= dx * diff; P[b + 1] -= dy * diff; P[b + 2] -= dz * diff; }
            else { const hx = dx * diff * 0.5, hy = dy * diff * 0.5, hz = dz * diff * 0.5; P[a] += hx; P[a + 1] += hy; P[a + 2] += hz; P[b] -= hx; P[b + 1] -= hy; P[b + 2] -= hz; }
          }
          if (o.pinned) {
            P[0] = o.anchor.x; P[1] = o.anchor.y; P[2] = o.anchor.z;
            // leave the knot towards the back
            const k = 3;
            P[k] = lerp(P[k], o.anchor.x + o.back.x * seg, 0.35); P[k + 1] = lerp(P[k + 1], o.anchor.y + o.back.y * seg - seg * 0.3, 0.35); P[k + 2] = lerp(P[k + 2], o.anchor.z + o.back.z * seg, 0.35);
          }
          // collisions (body & head spheres, ground)
          for (let i = 1; i < n; i++) {
            const k = i * 3;
            if (o.bodyR) push(P, k, o.bodyC, o.bodyR);
            if (o.headR) push(P, k, o.headC, o.headR);
            if (o.groundY != null && P[k + 1] < o.groundY + 0.015) { P[k + 1] = o.groundY + 0.015; O[k] = lerp(O[k], P[k], 0.5); O[k + 2] = lerp(O[k + 2], P[k + 2], 0.5); }
          }
        }
      }
    }
    this.write(o, parent);
  }

  write(o, parent) {
    _inv.copy(parent.matrixWorld).invert();
    const pos = this.pos, nor = this.nor;
    for (const s of this.strips) {
      const P = s.p, n = s.n;
      for (let i = 0; i < n; i++) {
        const k = i * 3;
        if (i < n - 1) _d.set(P[k + 3] - P[k], P[k + 4] - P[k + 1], P[k + 5] - P[k + 2]);
        else _d.set(P[k] - P[k - 3], P[k + 1] - P[k - 2], P[k + 2] - P[k - 1]);
        _d.normalize();
        _w.copy(o.right).addScaledVector(_d, -o.right.dot(_d));
        if (_w.lengthSq() < 1e-4) _w.set(-_d.z, 0, _d.x);
        _w.normalize();
        // a little twist towards the tip
        const f = i / (n - 1);
        const roll = 0.35 * Math.sin(this.time * 7 + s.phase - f * 4) * f;
        _n.crossVectors(_w, _d).normalize();
        _t.copy(_w).multiplyScalar(Math.cos(roll)).addScaledVector(_n, Math.sin(roll));
        _n.crossVectors(_t, _d).normalize();
        const hw = s.w * 0.5 * (1 - 0.2 * f) * (o.widthMul ?? 1);
        const v = s.v0 + i * 2;
        _a.set(P[k] - _t.x * hw, P[k + 1] - _t.y * hw, P[k + 2] - _t.z * hw).applyMatrix4(_inv);
        pos[v * 3] = _a.x; pos[v * 3 + 1] = _a.y; pos[v * 3 + 2] = _a.z;
        _a.set(P[k] + _t.x * hw, P[k + 1] + _t.y * hw, P[k + 2] + _t.z * hw).applyMatrix4(_inv);
        pos[v * 3 + 3] = _a.x; pos[v * 3 + 4] = _a.y; pos[v * 3 + 5] = _a.z;
        _n.transformDirection(_inv);
        nor[v * 3] = _n.x; nor[v * 3 + 1] = _n.y; nor[v * 3 + 2] = _n.z;
        nor[v * 3 + 3] = _n.x; nor[v * 3 + 4] = _n.y; nor[v * 3 + 5] = _n.z;
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.normal.needsUpdate = true;
  }

  dispose() { this.geo.dispose(); }
}

function push(P, k, c, r) {
  const dx = P[k] - c.x, dy = P[k + 1] - c.y, dz = P[k + 2] - c.z;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 < r * r && d2 > 1e-8) { const d = Math.sqrt(d2), f = r / d; P[k] = c.x + dx * f; P[k + 1] = c.y + dy * f; P[k + 2] = c.z + dz * f; }
}
