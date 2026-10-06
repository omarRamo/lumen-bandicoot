// Sky dome (gradient + sun/moon + stars + aurora + nebula), clouds, distant backdrop ring, the animated plane under
// the level (water / lava / toxic goo / sand / cloud sea / frozen lake) and ambient particles.
// All follow the camera horizontally so they read as "infinitely far" and never pop.
import * as THREE from 'three';
import { rng, fbm, mixHex, lerp, makeCanvas, canvasTex } from './env-util.js';

const col = (h) => new THREE.Color(h);

// ---------------------------------------------------------------- sky dome
export function createSky(th, time) {
  const sunDir = new THREE.Vector3(...th.sunDir).normalize();
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTop: { value: col(th.sky[0]) }, uMid: { value: col(th.sky[1]) }, uHorizon: { value: col(th.sky[2]) }, uBottom: { value: col(th.sky[3]) },
      uSunDir: { value: sunDir }, uSunColor: { value: col(th.sunCol) }, uSunSize: { value: th.sunSize ?? 1 },
      uMoon: { value: th.moon ? 1 : 0 }, uStars: { value: th.stars ?? 0 }, uAurora: { value: th.aurora ?? 0 },
      uNebula: { value: th.nebula ?? 0 }, uGlow: { value: th.glowworms ?? 0 }, uTime: time,
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main() {
        vDir = position;
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = vec4(p.xy, p.w * 0.99999, p.w);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uMid, uHorizon, uBottom, uSunDir, uSunColor;
      uniform float uSunSize, uMoon, uStars, uAurora, uNebula, uGlow, uTime;
      varying vec3 vDir;
      float h31(vec3 q) { return fract(sin(dot(q, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
      float n3(vec3 p) {
        vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(h31(i), h31(i + vec3(1,0,0)), f.x), mix(h31(i + vec3(0,1,0)), h31(i + vec3(1,1,0)), f.x), f.y),
                   mix(mix(h31(i + vec3(0,0,1)), h31(i + vec3(1,0,1)), f.x), mix(h31(i + vec3(0,1,1)), h31(i + vec3(1,1,1)), f.x), f.y), f.z);
      }
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c;
        if (y > 0.0) {
          c = mix(uHorizon, uMid, smoothstep(0.0, 0.25, y));
          c = mix(c, uTop, smoothstep(0.2, 0.85, y));
        } else {
          c = mix(uHorizon, uBottom, smoothstep(0.0, -0.25, y));
        }
        // sun / moon
        float sd = max(dot(d, uSunDir), 0.0);
        if (uSunSize > 0.0) {
          float r0 = 0.9993 - 0.0012 * uSunSize;
          float disc = smoothstep(r0, r0 + 0.0004, sd);
          if (uMoon > 0.5) {
            vec3 off = normalize(uSunDir + vec3(0.025, 0.018, 0.0));
            float carve = smoothstep(r0, r0 + 0.0004, max(dot(d, off), 0.0));
            c = mix(c, uSunColor * 1.2, disc * (1.0 - carve * 0.9));
            c += uSunColor * (pow(sd, 120.0) * 0.25 + pow(sd, 10.0) * 0.06);
          } else {
            c = mix(c, uSunColor * 1.6, disc);
            c += uSunColor * (pow(sd, 90.0) * 0.5 + pow(sd, 8.0) * 0.18);
          }
        }
        // stars (+ big four-point twinklers)
        if (uStars > 0.0) {
          float band = uNebula > 0.5 ? 1.0 : smoothstep(0.02, 0.3, y);
          vec3 q = floor(d * 220.0);
          float h = h31(q);
          float tw = 0.6 + 0.4 * sin(uTime * (1.3 + fract(h * 31.0) * 3.0) + h * 60.0);
          vec3 sc = mix(vec3(1.0, 0.95, 0.85), vec3(0.8, 0.9, 1.0), fract(h * 13.0));
          if (uGlow > 0.5) sc = mix(vec3(0.6, 1.0, 0.9), vec3(0.85, 0.7, 1.0), fract(h * 13.0));
          c += sc * step(0.9955, h) * band * uStars * (0.5 + 0.5 * fract(h * 97.0)) * tw * 1.4;
          vec3 q2 = floor(d * 40.0);
          float h2 = h31(q2 + 7.0);
          if (h2 > 0.982) {
            vec3 c2 = normalize((q2 + 0.5) / 40.0);
            vec3 dd = (d - c2) * 40.0;
            float star = max(smoothstep(0.5, 0.0, length(dd)) , 0.0);
            star += smoothstep(0.06, 0.0, abs(dd.x)) * smoothstep(0.9, 0.0, abs(dd.y)) * 0.6;
            star += smoothstep(0.06, 0.0, abs(dd.y)) * smoothstep(0.9, 0.0, abs(dd.x)) * 0.6;
            c += sc * star * band * uStars * tw;
          }
        }
        // aurora curtains
        if (uAurora > 0.0 && y > 0.0) {
          float a = atan(d.z, d.x);
          float k = n3(vec3(a * 3.0, y * 2.0, uTime * 0.05));
          float curtain = pow(0.5 + 0.5 * sin(a * 7.0 + k * 6.0 + uTime * 0.15), 3.0);
          float hgt = smoothstep(0.08, 0.3, y) * (1.0 - smoothstep(0.45, 0.85, y));
          float stripes = 0.6 + 0.4 * sin(a * 80.0 + k * 20.0);
          vec3 ac = mix(vec3(0.55, 1.0, 0.75), vec3(0.85, 0.6, 1.0), smoothstep(0.2, 0.6, y) + k * 0.3);
          c += ac * curtain * hgt * stripes * uAurora * 0.75;
        }
        // nebula
        if (uNebula > 0.0) {
          float n = n3(d * 3.0) * 0.6 + n3(d * 7.0) * 0.4;
          float m = smoothstep(0.45, 0.85, n);
          c += mix(vec3(0.85, 0.35, 0.6), vec3(0.35, 0.8, 0.85), n3(d * 2.0 + 4.0)) * m * 0.35 * uNebula;
        }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false, fog: false,
  });
  const geo = new THREE.SphereGeometry(280, 40, 20);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false; mesh.renderOrder = -1000; mesh.name = 'sky';
  mesh.onBeforeRender = (r, s, cam) => { mesh.position.copy(cam.position); mesh.updateMatrixWorld(); };
  return { mesh, sunDir, dispose() { geo.dispose(); mat.dispose(); } };
}

// ---------------------------------------------------------------- baked-shading helpers (MeshBasic, no lights)
function shadeGeo(g, base, { sun, haze = null, hz = 0, topLight = 0.25, dark = 0.7, colorFn = null }) {
  const p = g.attributes.position;
  if (!g.attributes.normal) g.computeVertexNormals();
  const n = g.attributes.normal;
  const c = new THREE.Color(), out = new Float32Array(p.count * 3);
  let ymin = Infinity, ymax = -Infinity;
  for (let i = 0; i < p.count; i++) { ymin = Math.min(ymin, p.getY(i)); ymax = Math.max(ymax, p.getY(i)); }
  const hzc = haze ? col(haze) : null;
  for (let i = 0; i < p.count; i++) {
    const f = (p.getY(i) - ymin) / Math.max(0.01, ymax - ymin);
    c.copy(colorFn ? colorFn(p.getX(i), p.getY(i), p.getZ(i), f) : base);
    const lam = sun ? Math.max(0, n.getX(i) * sun.x + n.getY(i) * sun.y + n.getZ(i) * sun.z) : 0.5;
    c.multiplyScalar(dark + (1 - dark) * lam + topLight * f);
    if (hzc) c.lerp(hzc, hz);
    out[i * 3] = c.r; out[i * 3 + 1] = c.g; out[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(out, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
function mergeColored(geos0) {
  const geos = geos0.map((g) => { if (!g.index) return g; const ng = g.toNonIndexed(); g.dispose(); return ng; });
  let n = 0;
  for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), colr = new Float32Array(n * 3);
  let o = 0;
  for (const g of geos) {
    pos.set(g.attributes.position.array, o * 3);
    colr.set(g.attributes.color.array, o * 3);
    o += g.attributes.position.count;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(colr, 3));
  return out;
}

// ---------------------------------------------------------------- clouds
export function createClouds(th, baseY, seed) {
  if (!th.clouds) return null;
  const r = rng(seed + 5);
  const geos = [];
  const top = col(th.clouds.color), shade = col(th.clouds.shade);
  for (let k = 0; k < th.clouds.n; k++) {
    const a = r() * Math.PI * 2, d = 150 + r() * 100, y = 30 + r() * 55;
    const cx = Math.cos(a) * d, cz = Math.sin(a) * d;
    const puffs = 4 + Math.floor(r() * 5), w = 10 + r() * 16;
    for (let i = 0; i < puffs; i++) {
      const rr = 4 + r() * 6;
      const g = new THREE.IcosahedronGeometry(rr, 1);
      g.scale(1, 0.65, 1);
      g.translate(cx + (i / puffs - 0.5) * w * 2 * Math.cos(a + 1.57) + (r() - 0.5) * 4, y + r() * 3, cz + (i / puffs - 0.5) * w * 2 * Math.sin(a + 1.57) + (r() - 0.5) * 4);
      shadeGeo(g, top, { colorFn: (x, yy) => shade.clone().lerp(top, THREE.MathUtils.clamp((yy - y + rr * 0.3) / (rr * 0.9), 0, 1)), dark: 1, topLight: 0 });
      geos.push(g);
    }
  }
  const g = mergeColored(geos);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.95, depthWrite: false });
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.y = baseY;
  mesh.renderOrder = -900;
  mesh.frustumCulled = false;
  mesh.name = 'clouds';
  return {
    mesh,
    update(dt, cam, t) { mesh.position.x = cam.position.x; mesh.position.z = cam.position.z; mesh.rotation.y = t * 0.004; },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

// ---------------------------------------------------------------- distant backdrop ring
export function createBackdrop(th, baseY, seed, sunDir) {
  const bd = th.backdrop;
  if (!bd) return null;
  const r = rng(seed + 11);
  const [cNear, cMid, cFar] = bd.cols.map(col);
  const haze = th.fogCol ?? mixHex(th.sky[2], th.sky[1], 0.2);
  const geos = [];
  const ring = (count, d0, d1, make, a0 = 0, a1 = Math.PI * 2) => {
    for (let k = 0; k < count; k++) {
      const a = a0 + (k + r() * 0.7) / count * (a1 - a0), d = d0 + r() * (d1 - d0);
      const g = make(r, d, a);
      if (!g) continue;
      g.rotateY(-a + Math.PI / 2);
      g.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
      geos.push(g);
    }
  };
  const dome = (rad, h, cc, hz, sx = 1) => shadeGeo(new THREE.SphereGeometry(1, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2).scale(rad * sx, h, rad).translate(0, -4, 0), cc, { sun: sunDir, haze, hz });
  const box = (w, h, d, cc, hz) => shadeGeo(new THREE.BoxGeometry(w, h, d).translate(0, h / 2 - 4, 0), cc, { sun: sunDir, haze, hz, topLight: 0.1 });
  switch (bd.type) {
    case 'islands':
      ring(7, 220, 250, (rr) => (rr() < 0.4 ? null : dome(18 + rr() * 26, 10 + rr() * 22, cNear, 0.35, 1.4)));
      ring(5, 250, 265, (rr) => dome(30 + rr() * 30, 18 + rr() * 26, cMid, 0.5, 1.6));
      geos.push(shadeGeo(new THREE.ConeGeometry(34, 46, 10, 3).translate(0, 19, 0).translate(-140, 0, -190), cMid, { sun: sunDir, haze, hz: 0.45 }));
      break;
    case 'hills':
      ring(14, 235, 260, (rr) => dome(30 + rr() * 30, 14 + rr() * 16, cFar, 0.55, 1.5));
      ring(12, 205, 225, (rr) => dome(24 + rr() * 24, 10 + rr() * 14, cMid, 0.35, 1.4));
      break;
    case 'ridges':
      ring(14, 235, 262, (rr) => dome(26 + rr() * 22, 40 + rr() * 40, cFar, 0.5, 0.9));
      ring(10, 205, 225, (rr) => (rr() < 0.35 ? shadeGeo(new THREE.CylinderGeometry(18 + rr() * 10, 24 + rr() * 10, 40 + rr() * 25, 9).translate(0, 16, 0), cMid, { sun: sunDir, haze, hz: 0.35 }) : dome(22 + rr() * 18, 26 + rr() * 26, cMid, 0.35, 1)));
      break;
    case 'dunes':
      ring(14, 235, 262, (rr) => dome(40 + rr() * 40, 10 + rr() * 14, cFar, 0.5, 2.2));
      ring(10, 205, 225, (rr) => (rr() < 0.4 ? box(20 + rr() * 30, 18 + rr() * 22, 18, cNear, 0.25) : dome(30 + rr() * 30, 8 + rr() * 12, cMid, 0.3, 2)));
      break;
    case 'medina':
    case 'sidibou': {
      const white = bd.type === 'sidibou';
      ring(white ? 10 : 12, 235, 262, (rr) => dome(36 + rr() * 30, 18 + rr() * 22, cFar, 0.5, 1.6));
      ring(white ? 60 : 70, 195, 225, (rr) => {
        const h = 6 + rr() * 14 + (white ? 6 : 0), w = 6 + rr() * 8;
        const parts = [box(w, h, 6 + rr() * 4, rr() < 0.15 && white ? col(0x8ab0e0) : cMid, 0.3)];
        if (rr() < 0.12) parts.push(shadeGeo(new THREE.SphereGeometry(w * 0.45, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h - 4, 0), cNear, { sun: sunDir, haze, hz: 0.25 }));
        if (!white && rr() < 0.08) parts.push(box(3, h + 18, 3, cNear, 0.25));
        return mergeColored(parts);
      });
      break;
    }
    case 'peaks':
      ring(20, 215, 262, (rr, d) => {
        const rad = 22 + rr() * 22, hgt = 40 + rr() * 50;
        const g = new THREE.ConeGeometry(rad, hgt, 9, 5).toNonIndexed();
        const p = g.attributes.position, seed2 = rr() * 100;
        for (let k = 0; k < p.count; k++) {
          let x = p.getX(k), y = p.getY(k), z = p.getZ(k);
          const hr = (y + hgt / 2) / hgt, a = Math.atan2(z, x);
          const nn = fbm(Math.cos(a) * 2 + seed2, Math.sin(a) * 2 + hr * 3, 3);
          const s = 1 + (nn - 0.5) * 0.8 * (1 - hr);
          p.setXYZ(k, x * s, y, z * s);
        }
        g.translate(0, hgt / 2 - 6, 0);
        g.computeVertexNormals();
        return shadeGeo(g, cMid, { sun: sunDir, haze, hz: 0.25 + (d - 215) / 260, colorFn: (x, y, z, f) => (f > 0.62 ? cFar : f > 0.35 ? cMid : cNear) });
      });
      break;
    case 'cave':
      ring(26, 150, 200, (rr) => {
        const h = 60 + rr() * 60, rad = 12 + rr() * 16;
        const g = new THREE.ConeGeometry(rad, h, 7, 3).translate(0, h / 2 - 10, 0);
        return shadeGeo(g, cNear, { sun: sunDir, haze, hz: 0.2, colorFn: (x, y, z, f) => (Math.sin(x * 0.7 + y * 0.3) > 0.93 ? col(0x9ff0e0) : cNear.clone().lerp(cMid, f)) });
      });
      ring(22, 150, 200, (rr) => {
        const h = 50 + rr() * 50, rad = 10 + rr() * 14;
        const g = new THREE.ConeGeometry(rad, h, 7, 3).rotateX(Math.PI).translate(0, 90 - h / 2 + 30, 0);
        return shadeGeo(g, cMid, { sun: sunDir, haze, hz: 0.25 });
      });
      break;
    case 'factory':
    case 'lab': {
      const lab = bd.type === 'lab';
      ring(16, 240, 262, (rr) => dome(40 + rr() * 30, 12 + rr() * 12, cFar, 0.5, 1.8));
      ring(lab ? 30 : 46, 195, 230, (rr) => {
        const h = 10 + rr() * 26, w = 8 + rr() * 14;
        const parts = [box(w, h, 8 + rr() * 6, cMid, 0.3)];
        if (!lab && rr() < 0.4) { const ch = h + 14 + rr() * 16; parts.push(shadeGeo(new THREE.CylinderGeometry(1.4, 2.2, ch, 8).translate(w * 0.25, ch / 2 - 4, 0), cNear, { sun: sunDir, haze, hz: 0.25 })); }
        if (lab && rr() < 0.4) parts.push(shadeGeo(new THREE.SphereGeometry(w * 0.5, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2).translate(0, h - 4, 0), cNear, { sun: sunDir, haze, hz: 0.2 }));
        if (lab && rr() < 0.3) parts.push(box(2, h + 20, 2, cNear, 0.2));
        return mergeColored(parts);
      });
      break;
    }
    case 'tower':
      ring(18, 215, 260, (rr) => {
        const h = 50 + rr() * 80, w = 8 + rr() * 10;
        const parts = [box(w, h, w, cNear, 0.3), shadeGeo(new THREE.ConeGeometry(w * 0.6, 20, 4).translate(0, h + 6, 0), cMid, { sun: sunDir, haze, hz: 0.3 })];
        return mergeColored(parts);
      });
      ring(10, 240, 262, (rr) => dome(40 + rr() * 30, 30 + rr() * 20, cFar, 0.5, 1.6));
      break;
    case 'golden':
      ring(14, 225, 262, (rr) => dome(30 + rr() * 26, 14 + rr() * 18, rr() < 0.5 ? cMid : cFar, 0.4, 1.5));
      break;
    case 'space':
    default:
      break;
  }
  // big sky objects (planets) for space / golden / tower
  const planets = [];
  if (bd.type === 'space' || bd.type === 'golden') {
    const list = bd.type === 'space'
      ? [[0xe98c73, 40, 0.9, 0.35, 230, true], [0x99d1b7, 18, -1.2, 0.25, 240, false], [0xdbb2f6, 10, 2.4, 0.5, 235, true]]
      : [[0x387d76, 30, 1.1, 0.3, 240, false]];
    for (const [c, rad, a, el, d, ringed] of list) {
      const g = new THREE.SphereGeometry(rad, 24, 16);
      shadeGeo(g, col(c), { sun: sunDir, dark: 0.35, topLight: 0.05, colorFn: (x, y, z) => col(c).lerp(col(0xffffff), Math.max(0, Math.sin(y * 0.4 + x * 0.05)) * 0.18) });
      const gg = [g];
      if (ringed) {
        const rg = new THREE.RingGeometry(rad * 1.35, rad * 1.9, 48, 1).rotateX(-Math.PI / 2 + 0.35);
        shadeGeo(rg, col(0xfff7dc), { dark: 1, topLight: 0 });
        gg.push(rg);
      }
      const m = mergeColored(gg);
      m.translate(Math.cos(a) * d * Math.cos(el), Math.sin(el) * d, Math.sin(a) * d * Math.cos(el));
      planets.push(m);
    }
  }
  if (!geos.length && !planets.length) return null;
  const g = mergeColored([...geos, ...planets]);
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(g, mat);
  mesh.position.y = baseY;
  mesh.renderOrder = -800;
  mesh.frustumCulled = false;
  mesh.name = 'backdrop';
  return {
    mesh,
    update(dt, cam) { mesh.position.x = cam.position.x; mesh.position.z = cam.position.z; },
    dispose() { g.dispose(); mat.dispose(); },
  };
}

// ---------------------------------------------------------------- under-plane (water, lava, goo, sand, cloud sea, ice)
const UNDER_TYPES = { water: 0, lava: 1, goo: 2, sand: 3, cloud: 4, ice: 5 };
export function createUnder(th, y, time, sunDir, fogCol) {
  const refl = th.under?.sky ?? mixHex(th.sky[0], th.sky[1], 0.55);
  const u = th.under;
  if (!u || u.type === 'void') return null;
  const type = UNDER_TYPES[u.type] ?? 0;
  const c1 = u.deep ?? u.c1, c2 = u.shallow ?? u.c2, c3 = u.foam ?? u.c3;
  const mat = new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      uTime: { value: 0 }, uType: { value: type }, uC1: { value: col(c1) }, uC2: { value: col(c2) }, uC3: { value: col(c3) },
      uSky: { value: col(refl) }, uSunDir: { value: sunDir.clone() }, uGlow: { value: u.glow ?? 0 },
    }]),
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorld = wp.xyz;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uType, uGlow; uniform vec3 uC1, uC2, uC3, uSky, uSunDir;
      varying vec3 vWorld;
      #include <fog_pars_fragment>
      float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { return vn(p) * 0.55 + vn(p * 2.1 + 3.1) * 0.3 + vn(p * 4.3 - 1.7) * 0.15; }
      // cellular-ish caustic lines
      float caustic(vec2 p, float t) {
        vec2 q = p + vec2(sin(p.y * 0.7 + t), cos(p.x * 0.6 - t * 0.8)) * 0.6;
        float a = abs(sin(q.x * 1.1 + t * 0.5) + sin(q.y * 1.3 - t * 0.4) + sin((q.x + q.y) * 0.7 + t * 0.3));
        return smoothstep(0.35, 0.0, a);
      }
      void main() {
        vec2 p = vWorld.xz;
        float t = uTime;
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 c;
        if (uType < 0.5 || uType > 4.5) {
          // water / ice
          bool ice = uType > 4.5;
          float tt = ice ? 0.0 : t;
          vec2 g = vec2(cos(p.x * 0.35 + tt * 1.3) * 0.3 + cos((p.x + p.y) * 0.21 + tt) * 0.25, sin(p.y * 0.31 + tt * 1.1) * 0.3 + cos((p.x - p.y) * 0.17 - tt * 0.9) * 0.25);
          if (ice) g *= 0.15;
          vec3 n = normalize(vec3(-g.x * 0.25, 1.0, -g.y * 0.25));
          float m = fbm(p * 0.05 + tt * 0.02);
          c = mix(uC1, uC2, smoothstep(0.3, 0.75, m));
          if (!ice) {
            c += uC3 * caustic(p * 0.6, t * 0.8) * 0.14;
            float foam = smoothstep(0.78, 0.86, fbm(p * 0.18 + vec2(t * 0.15, -t * 0.1)));
            c = mix(c, uC3, foam * 0.4);
          } else {
            float crack = smoothstep(0.03, 0.0, abs(vn(p * 0.12) - 0.5)) * 0.6 + smoothstep(0.02, 0.0, abs(vn(p * 0.31 + 3.0) - 0.5)) * 0.4;
            c = mix(c, uC3, crack);
            c = mix(c, uC3, smoothstep(0.6, 0.9, fbm(p * 0.08)) * 0.35);
          }
          float fres = pow(1.0 - max(dot(n, V), 0.0), 3.0);
          c = mix(c, uSky, clamp(fres * 0.55, 0.0, 0.45));
          vec3 H = normalize(uSunDir + V);
          c += vec3(1.0, 0.97, 0.88) * pow(max(dot(n, H), 0.0), ice ? 60.0 : 320.0) * (ice ? 0.45 : 0.9);
          if (uGlow > 0.5) c += uC2 * caustic(p * 0.4, t * 0.6) * 0.5;
        } else if (uType < 1.5 || (uType > 1.5 && uType < 2.5)) {
          // lava (1) / toxic goo (2)
          bool goo = uType > 1.5;
          vec2 q = p * (goo ? 0.15 : 0.12) + vec2(t * 0.03, t * 0.02);
          float n = fbm(q + fbm(q * 1.5 + t * 0.05) * 1.5);
          c = mix(uC1, uC2, smoothstep(0.35, 0.75, n));
          float crust = smoothstep(0.55, 0.62, fbm(p * 0.08 - t * 0.01));
          c = mix(c, uC1 * 0.35, goo ? 0.0 : crust * 0.7);
          c += uC3 * smoothstep(0.75, 0.9, n) * 0.8;
          if (goo) {
            vec2 cell = floor(p * 0.4); vec2 f = fract(p * 0.4) - 0.5;
            float h = h21(cell);
            float ph = fract(t * (0.3 + h * 0.4) + h * 10.0);
            float ring = smoothstep(0.05, 0.0, abs(length(f) - ph * 0.45)) * (1.0 - ph) * step(0.6, h);
            c += uC3 * ring * 0.9;
          }
          c *= 1.15;
        } else if (uType < 3.5) {
          // sand sea: dune ripples lit by the sun
          float w = p.x * 0.05 + p.y * 0.12 + fbm(p * 0.03) * 4.0;
          float r = sin(w * 6.2831);
          vec3 n = normalize(vec3(cos(w * 6.2831) * 0.25, 1.0, cos(w * 6.2831) * 0.4));
          float lam = clamp(dot(n, normalize(uSunDir)), 0.0, 1.0);
          c = mix(uC2, uC3, smoothstep(-0.6, 0.9, r)) * (0.75 + 0.35 * lam);
          c = mix(c, uC1, smoothstep(0.4, 0.8, fbm(p * 0.04)) * 0.5);
        } else {
          // cloud sea
          vec2 q = p * 0.04 + vec2(t * 0.01, t * 0.006);
          float n = fbm(q) * 0.6 + fbm(q * 2.7 - t * 0.01) * 0.4;
          c = mix(uC2, uC1, smoothstep(0.3, 0.7, n));
          c = mix(c, uC3, smoothstep(0.62, 0.8, n));
        }
        gl_FragColor = vec4(c, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
    fog: true,
  });
  const geo = new THREE.PlaneGeometry(800, 800, 1, 1).rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = y;
  mesh.name = 'under';
  mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  mesh.receiveShadow = false;
  return {
    mesh, type: u.type,
    update(dt, cam, t) { mat.uniforms.uTime.value = t; mesh.position.x = Math.round(cam.position.x / 10) * 10; mesh.position.z = Math.round(cam.position.z / 10) * 10; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// ---------------------------------------------------------------- ambient particles
const PARTS = {
  fireflies: { vel: [0, 0.05, 0], wob: 0.6, size: 0.22, add: true, tw: 1 },
  snow: { vel: [0.15, -1.1, 0.1], wob: 0.4, size: 0.12, add: false, tw: 0 },
  blizzard: { vel: [3.5, -2.2, 1.0], wob: 0.5, size: 0.11, add: false, tw: 0 },
  dust: { vel: [0.5, 0.05, 0.1], wob: 0.3, size: 0.07, add: false, tw: 0 },
  petals: { vel: [0.6, -0.5, 0.2], wob: 0.8, size: 0.16, add: false, tw: 0 },
  motes: { vel: [0, 0.2, 0], wob: 0.5, size: 0.14, add: true, tw: 1 },
  sparks: { vel: [0.2, 1.6, 0], wob: 0.3, size: 0.09, add: true, tw: 1 },
  embers: { vel: [0.3, 1.0, 0.1], wob: 0.5, size: 0.11, add: true, tw: 1 },
  bubbles: { vel: [0, 0.9, 0], wob: 0.3, size: 0.18, add: false, tw: 0, ring: 1 },
  stardust: { vel: [0, 0, 0.6], wob: 0.2, size: 0.1, add: true, tw: 1 },
  sparkles: { vel: [0, 0.25, 0], wob: 0.4, size: 0.16, add: true, tw: 1, star: 1 },
};
export function createParticles(th, quality) {
  const pd = th.particles;
  if (!pd) return null;
  const def = PARTS[pd.type] || PARTS.dust;
  const n = Math.round(pd.n * [0.35, 0.7, 1][quality.level ?? 1]);
  if (n < 4) return null;
  const r = rng(n * 31);
  const pos = new Float32Array(n * 3), rnd = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    pos[i * 3] = r(); pos[i * 3 + 1] = r(); pos[i * 3 + 2] = r();
    rnd[i * 4] = 0.6 + r() * 0.8; rnd[i * 4 + 1] = r() * 6.28; rnd[i * 4 + 2] = 0.6 + r() * 0.8; rnd[i * 4 + 3] = r();
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
  const box = new THREE.Vector3(44, 20, 44);
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uBox: { value: box }, uVel: { value: new THREE.Vector3(...def.vel) },
      uWob: { value: def.wob }, uSize: { value: def.size * 520 }, uColor: { value: col(pd.color) }, uTw: { value: def.tw }, uRing: { value: def.ring ?? 0 }, uStar: { value: def.star ?? 0 },
    },
    vertexShader: /* glsl */`
      attribute vec4 aRnd;
      uniform float uTime, uWob, uSize, uTw; uniform vec3 uCam, uBox, uVel;
      varying float vA;
      void main() {
        vec3 p = position * uBox + uVel * uTime * aRnd.x;
        p += vec3(sin(uTime * 0.9 * aRnd.z + aRnd.y), sin(uTime * 0.7 + aRnd.y * 2.0), cos(uTime * 0.8 * aRnd.z + aRnd.y)) * uWob;
        vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
        vec3 wp = uCam + rel;
        vec4 mv = viewMatrix * vec4(wp, 1.0);
        gl_Position = projectionMatrix * mv;
        float d = length(rel.xz) / (uBox.x * 0.5);
        vA = (1.0 - smoothstep(0.65, 1.0, d)) * mix(1.0, 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 3.0 * aRnd.z + aRnd.y * 7.0)), uTw);
        gl_PointSize = uSize * aRnd.z / max(1.0, -mv.z);
      }`,
    fragmentShader: /* glsl */`
      uniform vec3 uColor; uniform float uRing, uStar;
      varying float vA;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float d = length(q);
        float a = smoothstep(0.5, 0.15, d);
        if (uRing > 0.5) a = smoothstep(0.5, 0.42, d) * smoothstep(0.25, 0.4, d) + smoothstep(0.2, 0.0, length(q + vec2(0.12, 0.12))) * 0.8;
        if (uStar > 0.5) a = max(smoothstep(0.5, 0.0, d) * 0.4, smoothstep(0.08, 0.0, abs(q.x)) * smoothstep(0.5, 0.0, abs(q.y)) + smoothstep(0.08, 0.0, abs(q.y)) * smoothstep(0.5, 0.0, abs(q.x)));
        if (a * vA < 0.02) discard;
        gl_FragColor = vec4(uColor, a * vA);
      }`,
    transparent: true, depthWrite: false, blending: def.add ? THREE.AdditiveBlending : THREE.NormalBlending,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  pts.name = 'particles';
  pts.renderOrder = 10;
  return {
    mesh: pts,
    update(dt, cam, t) { mat.uniforms.uTime.value = t; mat.uniforms.uCam.value.copy(cam.position); },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

// ---------------------------------------------------------------- small radial glow sprite texture (shared)
let _glow = null;
export function glowTexture() {
  if (_glow) return _glow;
  const c = makeCanvas(64), ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  _glow = canvasTex(c, { repeat: false });
  return _glow;
}
export { lerp };
