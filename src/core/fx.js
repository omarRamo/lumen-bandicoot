// Shared lightweight effects: particle bursts (one InstancedMesh pool), expanding rings, floating text sprites.
import * as THREE from 'three';

const MAX = 400;
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _p = new THREE.Vector3();
const _c = new THREE.Color();

export class FX {
  constructor(scene, quality = 1) {
    this.scene = scene;
    this.quality = quality;
    const geo = new THREE.IcosahedronGeometry(0.09, 0);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    this.mesh = new THREE.InstancedMesh(geo, mat, MAX);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, _c.set(0xffffff));
    scene.add(this.mesh);
    this.parts = [];
    this.rings = [];
    this.texts = [];
  }

  burst(pos, color = 0xffe2ac, count = 14, opts = {}) {
    const n = Math.round(count * (this.quality === 0 ? 0.5 : 1));
    const speed = opts.speed ?? 5;
    for (let i = 0; i < n && this.parts.length < MAX; i++) {
      const a = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, r = Math.sqrt(1 - u * u);
      const sp = speed * (0.4 + Math.random() * 0.8);
      this.parts.push({
        x: pos.x, y: pos.y + (opts.dy ?? 0.5), z: pos.z,
        vx: Math.cos(a) * r * sp, vy: Math.abs(u) * sp + (opts.up ?? 2), vz: Math.sin(a) * r * sp,
        life: 0, max: (opts.life ?? 0.7) * (0.6 + Math.random() * 0.6), size: (opts.size ?? 1) * (0.6 + Math.random() * 0.9),
        color: Array.isArray(color) ? color[i % color.length] : color, g: opts.gravity ?? 14,
      });
    }
  }

  ring(pos, color = 0xffffff, size = 1.6) {
    const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 32),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, toneMapped: false, depthWrite: false }));
    m.rotation.x = Math.PI / 2;
    m.position.set(pos.x, pos.y + 0.1, pos.z);
    this.scene.add(m);
    this.rings.push({ m, t: 0, size });
  }

  text(pos, str, color = '#fff7dc', opts = {}) {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 96;
    const g = c.getContext('2d');
    g.font = `900 ${opts.px ?? 58}px "Baloo 2", "Trebuchet MS", system-ui, sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = '#1c1640'; g.strokeText(str, 128, 50);
    g.fillStyle = color; g.fillText(str, 128, 50);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, toneMapped: false }));
    sp.scale.set(2.2 * (opts.scale ?? 1), 0.82 * (opts.scale ?? 1), 1);
    sp.position.set(pos.x, pos.y + 1.4, pos.z);
    sp.renderOrder = 10;
    this.scene.add(sp);
    this.texts.push({ sp, t: 0, max: opts.life ?? 1.1 });
  }

  update(dt) {
    let n = 0;
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life += dt;
      if (p.life >= p.max) { this.parts[i] = this.parts[this.parts.length - 1]; this.parts.pop(); continue; }
      p.vy -= p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    }
    for (const p of this.parts) {
      const k = 1 - p.life / p.max;
      _s.setScalar(p.size * (0.3 + 0.7 * k));
      _m.compose(_p.set(p.x, p.y, p.z), _q, _s);
      this.mesh.setMatrixAt(n, _m);
      this.mesh.setColorAt(n, _c.set(p.color));
      n++;
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      const k = r.t / 0.45;
      r.m.scale.setScalar(0.2 + k * r.size);
      r.m.material.opacity = 0.9 * (1 - k);
      if (k >= 1) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); this.rings.splice(i, 1); }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt;
      t.sp.position.y += dt * 1.2;
      t.sp.material.opacity = Math.min(1, 3 * (1 - t.t / t.max));
      if (t.t >= t.max) { this.scene.remove(t.sp); t.sp.material.map.dispose(); t.sp.material.dispose(); this.texts.splice(i, 1); }
    }
  }

  clear() {
    this.parts.length = 0;
    for (const r of this.rings) { this.scene.remove(r.m); r.m.geometry.dispose(); r.m.material.dispose(); }
    for (const t of this.texts) { this.scene.remove(t.sp); t.sp.material.map.dispose(); t.sp.material.dispose(); }
    this.rings.length = 0; this.texts.length = 0;
  }

  dispose() { this.clear(); this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); }
}
