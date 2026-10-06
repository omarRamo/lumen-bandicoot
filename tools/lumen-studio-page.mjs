// Browser-side studio for tools/lumen-studio.mjs: renders contact sheets (grids of labelled tiles) of
// Lumen / Oku / the mounts with their animations, outside of the game loop. Served by Vite.
import * as THREE from 'three';
import { createLumen, createOku, createMount } from '../src/art/lumen.js';

const TILE = 360;
let renderer, scene, out, octx;

function setup(cols, rows) {
  if (!renderer) {
    const c = document.createElement('canvas');
    renderer = new THREE.WebGLRenderer({ canvas: c, antialias: true, preserveDrawingBuffer: true });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setPixelRatio(1);
    renderer.setSize(TILE, TILE, false);
    out = document.createElement('canvas');
    out.id = 'studio';
    out.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#222';
    document.body.appendChild(out);
    octx = out.getContext('2d');
  }
  out.width = cols * TILE; out.height = rows * TILE;
}

function makeScene(sky = 0x9fd8e8, ground = 0xe8d6a8) {
  const s = new THREE.Scene();
  s.background = new THREE.Color(sky);
  s.add(new THREE.HemisphereLight(0xffffff, 0x6a7a5a, 1.3));
  const sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
  sun.position.set(3, 8, 4); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 20 });
  s.add(sun);
  s.add(sun.target);
  s.userData.sun = sun;
  const g = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ color: ground, roughness: 0.95 }));
  g.rotation.x = -Math.PI / 2; g.receiveShadow = true; s.add(g);
  return s;
}

const cam = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
/** yaw: 0 = camera in front of Lumen (on +Z), PI = behind. */
function place(c) {
  const { yaw = 0, pitch = 0.15, dist = 3, y = 0.6, fov = 40, tx = 0, tz = 0 } = c || {};
  cam.fov = fov; cam.updateProjectionMatrix();
  cam.position.set(tx + Math.sin(yaw) * Math.cos(pitch) * dist, y + Math.sin(pitch) * dist, tz + Math.cos(yaw) * Math.cos(pitch) * dist);
  cam.lookAt(tx, y, tz);
}

function lumenRig(opts = {}) {
  const player = new THREE.Group();
  const L = createLumen({ scarf: opts.scarf });
  player.add(L.object3d);
  let mount = null;
  if (opts.mount) {
    mount = createMount(opts.mount);
    player.add(mount.object3d);
    L.object3d.position.copy(mount.seat);
  }
  return { player, L, mount };
}

/** Simulate: steps = [[anim, seconds, sOverrides, (player)=>{} per frame]] */
function sim(rig, steps, sc) {
  const dt = 1 / 60;
  let t = 0;
  // a first render so Lumen knows where the camera is
  rig.L.update(dt, { anim: 'idle', t: 0, grounded: true, speed: 0, vy: 0 });
  renderer.render(sc, cam);
  for (const [anim, secs, so = {}, fn] of steps) {
    const n = Math.round(secs / dt);
    for (let i = 0; i < n; i++) {
      t += dt;
      if (fn) fn(rig.player, t, i * dt);
      const s = { anim, t, grounded: true, speed: 0, vy: 0, ...so };
      rig.L.update(dt, s);
      rig.mount?.update(dt, { speed: s.speed, turning: so.turning || 0, jumping: !s.grounded, t });
    }
  }
}

async function tile(i, cols, label, draw) {
  const sc = draw();
  renderer.render(sc, cam);
  const x = (i % cols) * TILE, y = Math.floor(i / cols) * TILE;
  octx.drawImage(renderer.domElement, x, y);
  octx.fillStyle = 'rgba(0,0,0,0.55)'; octx.fillRect(x, y, TILE, 22);
  octx.fillStyle = '#fff'; octx.font = '15px monospace'; octx.fillText(label, x + 6, y + 16);
  sc.traverse((o) => { if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
}

const SHEETS = {
  model: [
    ['front', { yaw: 0, y: 0.6, dist: 2.6 }],
    ['3/4 front', { yaw: 0.7, y: 0.65, dist: 2.6 }],
    ['side', { yaw: Math.PI / 2, y: 0.6, dist: 2.6 }],
    ['back', { yaw: Math.PI, y: 0.6, dist: 2.6 }],
    ['game cam (behind/above)', { yaw: Math.PI, pitch: 0.45, y: 1, dist: 7.2, fov: 58 }],
    ['face close', { yaw: 0.25, y: 0.95, dist: 1.1 }],
    ['3/4 back', { yaw: Math.PI - 0.7, y: 0.7, dist: 2.6 }],
    ['top', { yaw: 0.3, pitch: 1.2, y: 0.5, dist: 2.8 }],
  ].map(([label, c]) => ({ label, cam: c, steps: [['idle', 0.5]] })),
};

SHEETS.closeup = [
  ['ear front', { yaw: 0.3, y: 1.25, dist: 0.8, tx: 0.15 }],
  ['ear back', { yaw: Math.PI - 0.3, y: 1.25, dist: 0.8, tx: 0.15 }],
  ['face 3/4', { yaw: 0.8, y: 0.95, dist: 1.2 }],
  ['tail', { yaw: Math.PI - 1.2, y: 0.45, dist: 1.4 }],
].map(([label, c]) => ({ label, cam: c, steps: [['idle', 0.5]] }));
const F = { yaw: 0.6, y: 0.6, dist: 2.8 }, B = { yaw: Math.PI - 0.4, y: 0.7, dist: 3 }, SIDE = { yaw: Math.PI / 2, y: 0.6, dist: 3 };
SHEETS.moves = [
  { label: 'run a (back)', cam: B, steps: [['run', 0.5, { speed: 7.6 }, (p, t) => { p.position.z = 7.6 * t; }]], follow: true },
  { label: 'run b (side)', cam: SIDE, steps: [['run', 0.62, { speed: 7.6 }, (p, t) => { p.position.z = 7.6 * t; }]], follow: true },
  { label: 'run c (front)', cam: F, steps: [['run', 0.71, { speed: 7.6 }, (p, t) => { p.position.z = 7.6 * t; }]], follow: true },
  { label: 'jump', cam: F, steps: [['jump', 0.12, { vy: 10, grounded: false }]] },
  { label: 'flip (double jump)', cam: SIDE, steps: [['jump', 0.2, { vy: 6, grounded: false }], ['flip', 0.18, { vy: 6, grounded: false }]] },
  { label: 'fall (panic)', cam: F, steps: [['fall', 0.8, { vy: -12, grounded: false }]] },
  { label: 'spin', cam: B, steps: [['spin', 0.27, { spinT: 0.3 }]] },
  { label: 'spin tornado', cam: F, steps: [['spin', 0.3, { tornado: true, grounded: false }]] },
  { label: 'slide', cam: SIDE, steps: [['slide', 0.3, { speed: 10 }]] },
  { label: 'slam (ball)', cam: SIDE, steps: [['slam', 0.25, { vy: -20, grounded: false }]] },
  { label: 'land squash', cam: F, steps: [['fall', 0.5, { vy: -20, grounded: false }], ['land', 0.05]] },
  { label: 'idle', cam: F, steps: [['idle', 1.3]] },
];
SHEETS.idle = [
  ...[0.8, 1.6].map((t) => ({ label: `dance ${t}`, cam: B, steps: [], gag: 'dance', gagT: t })),
  ...[1.2, 2.4].map((t) => ({ label: `yoyo ${t}`, cam: F, steps: [], gag: 'yoyo', gagT: t })),
  { label: 'yawn', cam: F, steps: [['idle', 1.0]], gag: 'yawn', gagT: 0.9 },
  { label: 'shrug', cam: B, steps: [['idle', 1.0]], gag: 'shrug', gagT: 1.2 },
  { label: 'tap', cam: F, steps: [['idle', 1.0]], gag: 'tap', gagT: 1.5 },
  { label: 'yoyo escape', cam: F, steps: [['idle', 1.0]], gag: 'yoyo', gagT: 3.4 },
  { label: 'victory hop', cam: B, steps: [['victory', 0.45]] },
  { label: 'victory twirl', cam: B, steps: [['victory', 1.55]] },
  { label: 'victory pose', cam: B, steps: [['victory', 2.6]] },
  { label: 'invincible', cam: F, steps: [['run', 0.5, { speed: 6, invincible: true }, (p, t) => { p.position.z = 6 * t; }]], follow: true },
];
const DCAM = { yaw: Math.PI - 0.5, pitch: 0.35, y: 0.6, dist: 3.4 };
function deathTiles(times) {
  const list = [];
  for (const c of ['fall', 'burn', 'squash', 'water', 'zap', 'explode', 'eaten', 'generic']) {
    for (const t of times[c]) list.push({ label: `${c} ${t}s`, cam: c === 'fall' && t > 1 ? { ...DCAM, y: -0.6, dist: 5.5 } : DCAM, steps: [['idle', 0.3]], death: c, deathT: t, noGround: c === 'fall' || c === 'water' });
  }
  return list;
}
SHEETS.deaths1 = deathTiles({ fall: [0.6, 1.3], burn: [0.6, 1.5], squash: [0.4, 1.05], water: [0.5, 1.3], zap: [0.4, 1.4], explode: [], eaten: [], generic: [] });
SHEETS.deaths2 = deathTiles({ fall: [], burn: [], squash: [1.45], water: [], zap: [], explode: [0.15, 0.8, 1.7], eaten: [0.1, 0.7, 1.4], generic: [0.4, 1.2] });
SHEETS.oku = [
  ...[1, 2, 3].map((n) => ({ label: `oku ${n} (front)`, cam: { yaw: 0.35, y: 1.0, dist: n === 3 ? 4.2 : 3 }, steps: [['idle', 1.4]], oku: n })),
  ...[1, 2, 3].map((n) => ({ label: `oku ${n} (game cam)`, cam: { yaw: Math.PI, pitch: 0.45, y: 1, dist: 7.2, fov: 58 }, steps: [['run', 1.2, { speed: 6 }, (p, t) => { p.position.z = 6 * t; }]], oku: n, follow: true, face: Math.PI })),
  { label: 'oku close', cam: { yaw: -0.3, y: 1.25, dist: 1.4, tx: 0.45 }, steps: [['idle', 1.4]], oku: 1 },
  { label: 'oku back', cam: { yaw: Math.PI - 0.3, y: 1.2, dist: 1.8, tx: 0.45 }, steps: [['idle', 1.4]], oku: 2 },
];
SHEETS.mounts = [];
for (const k of ['snail', 'camel', 'penguin', 'rocket']) {
  SHEETS.mounts.push({ label: `${k} 3/4`, cam: { yaw: 0.8, y: 0.8, dist: k === 'camel' ? 4.6 : 3.6 }, steps: [['ride', 0.6, { speed: 9 }]], mount: k });
  SHEETS.mounts.push({ label: `${k} game cam`, cam: { yaw: Math.PI, pitch: 0.4, y: 1.2, dist: 8.4, fov: 64 }, steps: [['ride', 0.9, { speed: 11 }, (p, t) => { p.position.z = 11 * t; }]], mount: k, follow: true });
  SHEETS.mounts.push({ label: `${k} side`, cam: { yaw: Math.PI / 2, y: 0.8, dist: k === 'camel' ? 4.6 : 3.6 }, steps: [['ride', 0.75, { speed: 11 }]], mount: k });
}

export async function render(name, cols = 4) {
  const list = SHEETS[name];
  const rows = Math.ceil(list.length / cols);
  setup(cols, rows);
  for (let i = 0; i < list.length; i++) {
    const T = list[i];
    await tile(i, cols, T.label, () => {
      const sc = makeScene();
      if (T.noGround) sc.children.find((c) => c.isMesh).material.transparent = true, sc.children.find((c) => c.isMesh).material.opacity = 0.25, sc.children.find((c) => c.isMesh).material.depthWrite = false;
      const rig = lumenRig({ mount: T.mount });
      sc.add(rig.player);
      if (T.face != null) rig.player.rotation.y = T.face;
      place(T.cam);
      let oku = null;
      if (T.oku) { oku = createOku(); sc.add(oku.object3d); }
      if (T.gag) { rig.L.state.gagI = ['dance', 'yoyo', 'yawn', 'shrug', 'tap'].indexOf(T.gag); sim(rig, [['idle', 5.02 + T.gagT]], sc); }
      else sim(rig, T.steps.map((s) => { if (!oku) return s; const fn = s[3]; return [s[0], s[1], s[2], (p, t, lt) => { fn?.(p, t, lt); rig.player.updateMatrixWorld(true); oku.update(1 / 60, { count: T.oku, target: rig.player, time: t, facing: rig.player.rotation.y }); }]; }), sc);
      if (T.death) {
        rig.L.playDeath(T.death);
        const n = Math.round(T.deathT * 60);
        for (let k = 0; k < n; k++) rig.L.update(1 / 60, { anim: 'dead', t: k / 60, speed: 0, vy: 0 });
      }
      if (T.follow) { const p = rig.player.position; place({ ...T.cam, tx: p.x + (T.cam.tx || 0), tz: p.z }); }
      const sun = sc.userData.sun, pp = rig.player.position;
      sun.target.position.copy(pp); sun.position.set(pp.x + 3, pp.y + 8, pp.z + 4);
      return sc;
    });
  }
  return { w: out.width, h: out.height };
}
window.__studio = { render };
