// Lumen — the hero (agent Personnage). Procedural model + cartoon animations (squash & stretch), the
// signature scarf ribbon, idle gags, dedicated silly deaths, Oku Oku (lumen-oku.js) and the mounts
// (lumen-mounts.js). Contract: docs/CONTRACTS.md « API art ».
import * as THREE from 'three';
import {
  PAL, PI, TAU, G, LUMEN_RIM, RIM, Parts, Particles, FRAME, cachedGeo, cachedMat, felt, feltVC, glow, basic, std, additive,
  mesh, group, clamp, lerp, damp, smooth, bump, boing, easeOut, easeIn, wrapAngle, disposeOwned, cachedTex, HAS_DOM,
} from './lumen-kit.js';
import { buildLumen, LM, SCALE, DIM, sparkleGeo, star5Geo, leafGeo } from './lumen-body.js';
import { ScarfRibbon } from './lumen-scarf.js';
export { createOku } from './lumen-oku.js';
export { createMount } from './lumen-mounts.js';

// ------------------------------------------------------------------ pose channels
const DEF = {
  px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0, sq: 1, sw: 1,
  torX: 0, torY: 0, torZ: 0, headX: 0, headY: 0, headZ: 0,
  earLx: 0, earLz: 0, earRx: 0, earRz: 0,
  shLx: 0.05, shLy: 0, shLz: 0.16, elL: 0.3, shRx: 0.05, shRy: 0, shRz: 0.16, elR: 0.3,
  hipLx: 0, hipLz: 0.03, knL: 0.06, ftL: 0, hipRx: 0, hipRz: 0.03, knR: 0.06, ftR: 0,
  tailX: 0, tailY: 0, lookX: 0, lookY: 0, blink: 0, blinkL: 0, blinkR: 0, eyeS: 1, mouthO: 0, smile: 1,
};
const KEYS = Object.keys(DEF);

export const DEATH_DURATION = { fall: 1.9, burn: 1.9, squash: 1.8, water: 1.8, zap: 1.6, explode: 1.9, eaten: 1.7, generic: 1.5 };
const GAGS = ['dance', 'yoyo', 'yawn', 'shrug', 'tap'];
const GAG_DUR = { dance: 3.4, yoyo: 3.8, yawn: 2.8, shrug: 2.6, tap: 2.8 };
const AIR = new Set(['jump', 'flip', 'fall', 'slam']);
const AIRBORNE_DEATHS = new Set(['fall', 'water', 'eaten']);

// ------------------------------------------------------------------ shared prop geometry / materials
function swirlGeo() {
  return cachedGeo('lumen:swirl', () => {
    const pts = [[0.3, -0.02], [0.48, 0.25], [0.62, 0.62], [0.7, 0.98], [0.62, 1.22]].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(pts, 28);
  });
}
function swirlTex() {
  return cachedTex('lumen-swirl', 256, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    for (let i = 0; i < 7; i++) {
      const x = (i / 7) * w;
      const grd = g.createLinearGradient(x, 0, x + 34, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.75, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(x, h); g.lineTo(x + 26, h); g.lineTo(x + 60, 0); g.lineTo(x + 34, 0); g.closePath(); g.fill();
    }
    // fade top/bottom
    g.globalCompositeOperation = 'destination-in';
    const v = g.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(0.3, 'rgba(0,0,0,1)'); v.addColorStop(0.8, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
  }, { repeat: true });
}
function lifeRingGeo() {
  return cachedGeo('lumen:lifering', () => {
    const P = new Parts();
    P.add(G.torus(0.2, 0.07, 10, 32), (p, n, out) => out.set(Math.floor(((Math.atan2(p.y, p.x) + PI) / TAU) * 8) % 2 ? 0xf6f1e4 : 0xe0453a));
    return P.build();
  });
}
function fireflyGeo() {
  return cachedGeo('lumen:firefly', () => {
    const P = new Parts();
    P.add(G.sphere(10, 8), 0x3b3a2e, [0, 0.03, 0], null, [0.03, 0.03, 0.04]);
    P.add(G.sphere(8, 6), 0xd9f4ff, [0.035, 0.05, 0], [0, 0, -0.5], [0.035, 0.012, 0.022]);
    P.add(G.sphere(8, 6), 0xd9f4ff, [-0.035, 0.05, 0], [0, 0, 0.5], [0.035, 0.012, 0.022]);
    return P.build();
  });
}
function skeletonParts(J) {
  // X-ray skeleton (zap death): attached to the joints so it follows the pose. Hidden by default.
  const bone = basic(0xf4fbff, null, 'bone'), hole = basic(0x0b1e2c, null, 'bonehole');
  const list = [];
  const add = (parent, m) => { m.visible = false; parent.add(m); list.push(m); return m; };
  // skull
  add(J.head, mesh(G.sphere(16, 12), bone, [0, 0.01, 0], null, [0.26, 0.23, 0.24]));
  for (const sx of [-1, 1]) add(J.head, mesh(G.sphere(10, 8), hole, [sx * 0.085, 0.03, 0.2], null, [0.055, 0.07, 0.04]));
  add(J.head, mesh(G.sphere(8, 6), hole, [0, -0.05, 0.225], null, [0.025, 0.02, 0.02]));
  for (let i = -2; i <= 2; i++) add(J.head, mesh(G.box(), bone, [i * 0.028, -0.14, 0.2], null, [0.022, 0.03, 0.02]));
  for (const e of J.ears) add(e.g, mesh(G.cyl(5), bone, [0, 0.22, 0.03], null, [0.012, 0.42, 0.012]));
  // spine, ribs, pelvis
  add(J.torso, mesh(G.cyl(6), bone, [0, 0.2, -0.08], null, [0.022, 0.4, 0.022]));
  for (let i = 0; i < 4; i++) add(J.torso, mesh(G.torus(0.13 - i * 0.012, 0.014, 5, 16, PI * 1.5), bone, [0, 0.29 - i * 0.055, -0.03], [PI / 2, 0, PI * 0.25 + PI], [1.2, 1, 1]));
  add(J.hips, mesh(G.sphere(10, 8), bone, [0, 0.03, -0.02], null, [0.13, 0.06, 0.08]));
  for (const a of J.arms) {
    add(a.sh, mesh(G.cyl(5), bone, [0, -0.065, 0], null, [0.016, 0.13, 0.016]));
    add(a.el, mesh(G.cyl(5), bone, [0, -0.06, 0], null, [0.014, 0.12, 0.014]));
    for (let i = -1; i <= 1; i++) add(a.el, mesh(G.box(), bone, [i * 0.022, -0.14, 0.01], null, [0.012, 0.05, 0.012]));
  }
  for (const l of J.legs) {
    add(l.hp, mesh(G.cyl(5), bone, [0, -0.06, 0], null, [0.02, 0.12, 0.02]));
    add(l.kn, mesh(G.cyl(5), bone, [0, -0.06, 0], null, [0.018, 0.12, 0.018]));
    add(l.an, mesh(G.box(), bone, [0, -0.02, 0.05], null, [0.05, 0.02, 0.12]));
  }
  for (let i = 0; i < 5; i++) add(J.tail, mesh(G.sphere(6, 5), bone, [0, i * 0.075, -0.06 - Math.sin(i * 0.6) * 0.12], null, 0.022));
  return list;
}

// ------------------------------------------------------------------ factory
export function createLumen({ scarf } = {}) {
  let scarfColor = toHex(scarf, PAL.scarf);
  const J = buildLumen(scarfColor);
  const root = J.root;
  root.name = 'lumen-art';
  for (const m of J.bodyMeshes) m.userData.mat0 = m.material;

  // ---- scarf ribbon
  const ribbon = new ScarfRibbon(scarfColor);
  root.add(ribbon.mesh);

  // ---- particles (world-space sim, one draw call)
  const parts = new Particles(72);
  root.add(parts.points);

  // ---- spin swirl
  const swirlMatA = new THREE.MeshBasicMaterial({ color: 0xd8fff0, map: swirlTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const swirlMatB = new THREE.MeshBasicMaterial({ color: scarfColor, map: swirlTex(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const swirlA = mesh(swirlGeo(), swirlMatA, [0, 0.02, 0], null, [1, 1, 1]);
  const swirlB = mesh(swirlGeo(), swirlMatB, [0, 0.08, 0], null, [0.82, 0.85, 0.82]);
  swirlA.visible = swirlB.visible = false;
  swirlA.renderOrder = swirlB.renderOrder = 4;
  root.add(swirlA, swirlB);

  // ---- yo-yo firefly (idle gag) in base space
  const yoyo = group(null, null, 'yoyo');
  const yoString = mesh(G.cyl(4), basic(0x6b4a3a, null, 'string'), [0, 0, 0], null, [0.006, 1, 0.006]);
  const firefly = group();
  firefly.add(mesh(fireflyGeo(), feltVC(RIM, 0.1)));
  firefly.add(mesh(G.sphere(10, 8), glow(0xd6ff5c, 1.4, 'firefly'), [0, -0.02, -0.03], null, [0.035, 0.035, 0.04]));
  const fireGlow = mesh(G.sphere(10, 8), additive(0xc8ff5a, 0.28, 'fireglow'), [0, -0.02, -0.03], null, 0.07);
  firefly.add(fireGlow);
  yoyo.add(yoString, firefly); yoyo.visible = false;
  J.base.add(yoyo);

  // ---- death props (root space)
  const props = group(null, null, 'lumen-death-props');
  root.add(props);
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 1, depthWrite: false, toneMapped: false });
  const flash = mesh(G.sphere(16, 12), flashMat); props.add(flash);
  const halo = mesh(G.torus(0.13, 0.022, 8, 28), glow(0xffe08a, 1.2, 'halo'), null, [PI / 2, 0, 0]);
  const wingL = mesh(leafGeo(0.17, 1.35, 0.025), felt(0xffffff, 0.6, 0.35));
  const wingR = mesh(leafGeo(0.17, 1.35, 0.025), felt(0xffffff, 0.6, 0.35));
  const spirit = group(); spirit.add(halo);
  const wingPivL = group([0.05, -0.12, -0.05]); wingPivL.add(wingL); wingL.rotation.set(0, 0, -1.25);
  const wingPivR = group([-0.05, -0.12, -0.05]); wingPivR.add(wingR); wingR.rotation.set(0, 0, 1.25);
  spirit.add(wingPivL, wingPivR); props.add(spirit);
  const lifeRing = mesh(lifeRingGeo(), feltVC(RIM, 0.12), null, [PI / 2, 0, 0]); props.add(lifeRing);
  const rippleMats = [0, 1].map(() => new THREE.MeshBasicMaterial({ color: 0xe8fbff, transparent: true, opacity: 0, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
  const ripples = rippleMats.map((m) => { const r = mesh(G.torus(1, 0.04, 4, 32), m, null, [PI / 2, 0, 0]); props.add(r); return r; });
  const ash = mesh(G.cone(14), felt(0x3a3533, 0.95, 0.04), null, null, [0.3, 0.15, 0.3]); props.add(ash);
  const ashEyes = group(); props.add(ashEyes);
  for (const sx of [-1, 1]) ashEyes.add(mesh(G.sphere(10, 8), basic(0xffffff, null, 'ash-eye'), [sx * 0.05, 0, 0], null, [0.028, 0.045, 0.02]));
  const ring = mesh(G.torus(0.165, 0.064, 10, 24), LM.scarf(scarfColor), null, [PI / 2, 0, 0], SCALE); props.add(ring);
  const flyEars = [0, 1].map(() => { const e = mesh(J.ears[0].m.geometry, LM.body, null, null, SCALE); e.castShadow = true; props.add(e); return e; });
  const koStars = group();
  for (let i = 0; i < 3; i++) koStars.add(mesh(star5Geo(0.06, 0.02), glow(0xffe36b, 0.9, 'kostar')));
  props.add(koStars);
  const skeleton = skeletonParts(J);
  const charMat = felt(0x1d1918, 0.95, 0.02, RIM);
  const xrayMat = additive(0x6fe3ff, 0.35, 'xray');
  const whiteEye = basic(0xffffff, null, 'white-eye');

  // ---- state
  const T = { ...DEF }, Cur = { ...DEF };
  const st = {
    anim: 'idle', prev: 'idle', animT: 0, time: 0, idleT: 0, gag: null, gagT: 0, gagI: Math.floor(Math.random() * GAGS.length),
    runPh: 0, spinYaw: 0, spinning: false, flipT: 9, slamRoll: 0, impactT: 9, impactAmp: 0, lastVy: 0,
    blinkT: 2, blinkDur: 0, lookT: 0, lookX: 0, lookY: 0, earTw: 0, earTwT: 3,
    dead: false, cause: null, deathT: 0, emitAcc: 0, invT: 0, wasInv: false, yaw: 0, turn: 0, rate: 14,
    toCam: PI, hasCam: false,
  };
  const camW = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), rootW = new THREE.Vector3(), rootPrev = new THREE.Vector3();
  const vel = new THREE.Vector3(), anchorW = new THREE.Vector3(), backW = new THREE.Vector3(), rightW = new THREE.Vector3(), upW = new THREE.Vector3();
  const windV = new THREE.Vector3(), bodyC = new THREE.Vector3(), headC = new THREE.Vector3(), gulpDir = new THREE.Vector3(), q = new THREE.Quaternion();
  const ribbonOpts = { anchor: anchorW, back: backW, right: rightW, vel, speed: 0, spin: 0, spinYaw: 0, tornado: false, pinned: true, gravity: 6.5, groundY: null, bodyC, bodyR: 0.24, headC, headR: 0.3, gulp: null, gulpDir, wind: windV, widthMul: 1 };
  let firstFrame = true;
  // capture the camera (to turn towards it in gags / victory / deaths)
  J.headMesh.onBeforeRender = (r, s, cam) => { camW.setFromMatrixPosition(cam.matrixWorld); st.hasCam = true; };

  function setMaterials(mat) { for (const m of J.bodyMeshes) m.material = mat || m.userData.mat0; }
  function setBodyVisible(v, exceptShoes = false) {
    for (const m of J.bodyMeshes) m.visible = v || (exceptShoes && J.legs.some((l) => l.shoe === m));
    J.chest.visible = J.core.visible = J.brow.visible = v;
    J.torso.visible = v; J.tail.visible = v;
  }
  function hideProps() {
    for (const c of props.children) c.visible = false;
    for (const s of skeleton) s.visible = false;
    yoyo.visible = false;
  }

  function resetAll() {
    st.dead = false; st.cause = null; st.deathT = 0; st.gag = null; st.idleT = 0; st.flipT = 9; st.impactT = 9;
    st.spinYaw = 0; st.slamRoll = 0; st.anim = 'idle'; st.prev = 'idle'; st.animT = 0;
    Object.assign(T, DEF); Object.assign(Cur, DEF);
    setMaterials(null); setBodyVisible(true);
    J.wrap.visible = J.wrapStitch.visible = J.knot.visible = true;
    for (const e of J.eyes) { e.ball.material = LM.eye; e.sh1.visible = e.sh2.visible = true; e.x.visible = false; e.arc.visible = false; e.lid.visible = true; }
    hideProps();
    J.fxPivot.position.set(0, 0, 0); J.fxPivot.rotation.set(0, 0, 0); J.fxPivot.scale.set(1, 1, 1);
    J.squash.position.set(0, 0, 0);
    ribbon.mesh.visible = true; ribbon.lenMul = 1; ribbon.initialized = false;
    ribbon.setColor(scarfColor);
    J.smile.material = LM.mouth; J.mouth.visible = true;
    ribbonOpts.pinned = true; ribbonOpts.gulp = null; ribbonOpts.gravity = 6.5; ribbonOpts.widthMul = 1;
    parts.clear();
    swirlA.visible = swirlB.visible = false;
    LUMEN_RIM.color.value.set(0xfff2d6); LUMEN_RIM.strength.value = 0.28;
    firstFrame = true;
    apply(0);
  }

  // ------------------------------------------------------------------ apply pose → joints
  function apply(extraSpin) {
    const C = Cur;
    J.mover.position.set(C.px, DIM.centerY + C.py, C.pz);
    J.mover.rotation.set(C.rx + flipAngle() + st.slamRoll, C.ry + st.spinYaw + (extraSpin || 0), C.rz);
    const sq = Math.max(0.03, C.sq), sw = C.sw / Math.sqrt(sq);
    J.squash.scale.set(SCALE * sw, SCALE * sq, SCALE * sw);
    J.torso.rotation.set(C.torX, C.torY, C.torZ);
    J.neck.rotation.set(C.headX, C.headY, C.headZ);
    for (const e of J.ears) {
      const L = e.side > 0;
      e.g.rotation.set(e.tilt + (L ? C.earLx : C.earRx), 0, -e.side * (e.splay + (L ? C.earLz : C.earRz)));
    }
    const a0 = J.arms[0], a1 = J.arms[1];
    a0.sh.rotation.set(-C.shLx, C.shLy, C.shLz); a0.el.rotation.x = -C.elL;
    a1.sh.rotation.set(-C.shRx, -C.shRy, -C.shRz); a1.el.rotation.x = -C.elR;
    const l0 = J.legs[0], l1 = J.legs[1];
    l0.hp.rotation.set(-C.hipLx, 0, C.hipLz); l0.kn.rotation.x = C.knL; l0.an.rotation.x = C.hipLx - C.knL - C.ftL;
    l1.hp.rotation.set(-C.hipRx, 0, -C.hipRz); l1.kn.rotation.x = C.knR; l1.an.rotation.x = C.hipRx - C.knR - C.ftR;
    J.tail.rotation.set(C.tailX, C.tailY, 0);
    for (const e of J.eyes) {
      const bl = clamp(C.blink + (e.side > 0 ? C.blinkL : C.blinkR), 0, 1);
      e.lid.scale.set(C.eyeS, Math.max(0.08, (1 - bl)) * C.eyeS, C.eyeS);
      e.g.position.set(e.base.x + C.lookX * 0.018, e.base.y + C.lookY * 0.014, e.base.z);
    }
    const open = C.mouthO > 0.12;
    J.smile.visible = !open && J.open.userData.hidden !== true;
    J.open.visible = open;
    J.tongue.visible = open && C.mouthO > 0.55;
    J.open.scale.set(0.034 + C.mouthO * 0.02, 0.012 + C.mouthO * 0.05, 0.02);
    J.smile.rotation.z = C.smile >= 0 ? PI : 0;
    J.smile.scale.set(1, 0.3 + 0.35 * Math.abs(C.smile), 1);
    J.smile.position.y = C.smile >= 0 ? 0.012 : -0.016;
  }
  function flipAngle() { return st.flipT < 0.5 ? easeOut(st.flipT / 0.5) * TAU : 0; }

  // ------------------------------------------------------------------ helpers for the pose
  function faceCam(P, k = 1) {
    if (!st.hasCam) { P.ry = PI * k; return; }
    P.ry = st.toCam * k;
  }
  function happyEyes(on) { for (const e of J.eyes) { e.arc.visible = on; e.lid.visible = !on; } }

  // ------------------------------------------------------------------ animations (write target pose)
  function animIdle(P, s, dt) {
    const t = st.time;
    P.sq = 1 + Math.sin(t * 2.3) * 0.016;
    P.torX = -0.02 + Math.sin(t * 2.3) * 0.015;
    P.headX = Math.sin(t * 0.7) * 0.05; P.headZ = Math.sin(t * 0.53) * 0.06;
    P.headY = st.lookX * 0.25;
    P.lookX = st.lookX; P.lookY = st.lookY;
    P.shLz = 0.18 + Math.sin(t * 2.3) * 0.03; P.shRz = 0.18 + Math.sin(t * 2.3) * 0.03;
    P.tailY = Math.sin(t * 1.6) * 0.25; P.tailX = 0.05;
    P.earLx = st.earTw * 0.4; P.earRx = Math.sin(t * 0.9) * 0.05;
    // saccades
    st.lookT -= dt;
    if (st.lookT <= 0) {
      st.lookT = 1.2 + Math.random() * 2.2;
      const r = Math.random();
      st.lookX = r < 0.35 ? 0 : (Math.random() * 2 - 1) * 0.9;
      st.lookY = (Math.random() * 2 - 1) * 0.4;
    }
    if (st.gag) animGag(P, s, dt);
  }

  function animGag(P, s, dt) {
    const g = st.gag, t = st.gagT, D = GAG_DUR[g];
    const inOut = smooth(t / 0.3) * smooth((D - t) / 0.35);
    switch (g) {
      case 'dance': {
        // awkward little dance facing the camera
        faceCam(P, inOut);
        const b = t * 7.5;
        P.py = Math.abs(Math.sin(b)) * 0.05 * inOut;
        P.rz = Math.sin(b) * 0.16 * inOut;
        P.torZ = -Math.sin(b) * 0.2 * inOut; P.torY = Math.sin(b * 0.5) * 0.3 * inOut;
        P.headZ = Math.sin(b + 1) * 0.25 * inOut; P.headX = -0.1 * inOut;
        const up = Math.sin(b) > 0;
        P.shLx = lerp(P.shLx, up ? 2.7 : 0.5, inOut); P.shLz = lerp(P.shLz, 0.5, inOut); P.elL = lerp(P.elL, up ? 0.4 : 1.6, inOut);
        P.shRx = lerp(P.shRx, up ? 0.5 : 2.7, inOut); P.shRz = lerp(P.shRz, 0.5, inOut); P.elR = lerp(P.elR, up ? 1.6 : 0.4, inOut);
        P.hipLx = (up ? 0.5 : 0) * inOut; P.knL = (up ? 0.9 : 0.1) * inOut;
        P.hipRx = (up ? 0 : 0.5) * inOut; P.knR = (up ? 0.1 : 0.9) * inOut;
        P.tailY = Math.sin(b * 2) * 0.8; P.smile = 1; P.mouthO = 0.35 * inOut;
        P.lookX = 0; P.lookY = 0;
        happyEyes(inOut > 0.5);
        break;
      }
      case 'yoyo': {
        // plays yo-yo with a firefly on a string
        const cyc = (t - 0.4) / 1.1;
        const ph = cyc - Math.floor(cyc);
        const L = t < 0.4 ? 0.05 : (ph < 0.45 ? easeIn(ph / 0.45) : 1 - easeOut((ph - 0.45) / 0.55)) * 0.36 + 0.05;
        P.shRx = lerp(P.shRx, 1.15 + (ph < 0.2 && t > 0.4 ? 0.4 : 0), inOut); P.elR = lerp(P.elR, 0.9, inOut); P.shRz = lerp(P.shRz, 0.25, inOut);
        P.headX = 0.25 * inOut + L * 0.6; P.lookY = -0.4 - L * 1.5; P.lookX = -0.3;
        P.headY = -0.2 * inOut;
        P.torZ = 0.06 * inOut;
        P.smile = 1; P.mouthO = t > D - 0.9 ? 0.6 : 0;
        yoyo.visible = inOut > 0.05;
        yoyo.userData.L = L;
        if (t > D - 0.8) { yoyo.userData.escape = (t - (D - 0.8)) / 0.8; P.lookY = 0.6; P.headX = -0.3; P.blink = 0; }
        else yoyo.userData.escape = 0;
        break;
      }
      case 'yawn': {
        const k = bump(t, 0.1, 1.9);
        P.sq = 1 + k * 0.1; P.sw = 1 - k * 0.04;
        P.shLx = lerp(P.shLx, 2.9, k); P.shRx = lerp(P.shRx, 2.9, k); P.shLz = lerp(P.shLz, 0.5, k); P.shRz = lerp(P.shRz, 0.5, k);
        P.elL = lerp(P.elL, 0.5, k); P.elR = lerp(P.elR, 0.5, k);
        P.headX = -0.35 * k; P.mouthO = k; P.blink = Math.min(1, k * 1.3); P.torX = -0.15 * k;
        P.earLz = -0.3 * k; P.earRz = -0.3 * k;
        if (t > 1.9) { // scratches his belly, satisfied
          const k2 = bump(t, 1.9, D);
          P.shLx = 0.7 * k2; P.elL = 1.8 * k2 + Math.sin(t * 30) * 0.15 * k2; P.shLz = 0.1;
          P.blink = 0.6 * k2; P.smile = 1;
        }
        break;
      }
      case 'shrug': {
        // looks at the camera and shrugs: ¯\_(ツ)_/¯
        faceCam(P, inOut);
        const k = bump(t, 0.5, D - 0.2);
        P.shLz = lerp(P.shLz, 0.95, k); P.shRz = lerp(P.shRz, 0.95, k);
        P.shLx = lerp(P.shLx, 0.4, k); P.shRx = lerp(P.shRx, 0.4, k);
        P.shLy = 0.4 * k; P.shRy = 0.4 * k;
        P.elL = lerp(P.elL, 1.6, k); P.elR = lerp(P.elR, 1.6, k);
        P.py = 0.03 * k; P.headZ = 0.32 * k; P.headX = -0.05;
        P.smile = -0.6 * k + (1 - k); P.lookX = 0; P.lookY = 0.1;
        P.earLz = 0.3 * k; P.earRz = 0.3 * k; P.earLx = -0.2 * k;
        break;
      }
      case 'tap': {
        // impatient foot tapping, checks an imaginary watch
        const k = inOut;
        P.ftR = Math.max(0, Math.sin(t * 16)) * 0.5 * k; P.hipRx = 0.12 * k;
        P.shLz = lerp(P.shLz, 0.5, k); P.elL = lerp(P.elL, 2.0, k); P.shLx = lerp(P.shLx, 0.2, k); // hand on hip
        const w = bump(t, 1.0, D - 0.2);
        P.shRx = lerp(P.shRx, 1.3, w); P.elR = lerp(P.elR, 1.7, w); P.shRy = -0.6 * w;
        P.headX = 0.25 * w; P.headY = -0.3 * w; P.lookY = -0.6 * w; P.lookX = -0.4 * w;
        P.smile = -0.5 * w + (1 - w) * 0.6;
        P.tailY = Math.sin(t * 10) * 0.4 * k;
        break;
      }
    }
  }

  function animRun(P, s, dt) {
    const sp = s.speed || 0;
    st.runPh += dt * (5 + sp * 1.5);
    const ph = st.runPh, k = clamp(sp / 7.6, 0.25, 1.25);
    const sn = Math.sin(ph), cs = Math.cos(ph);
    P.py = Math.abs(cs) * 0.06 * k - 0.02;
    P.sq = 1 + (Math.abs(cs) - 0.6) * 0.07 * k;
    P.torX = 0.24 + 0.12 * k; P.torY = sn * 0.22 * k; P.torZ = 0;
    P.headX = -0.2 - 0.06 * k; P.headY = -sn * 0.12 * k; P.headZ = 0;
    P.hipLx = sn * 1.0 * k + 0.1; P.hipRx = -sn * 1.0 * k + 0.1;
    P.knL = 0.25 + Math.max(0, cs) * 1.3 * k; P.knR = 0.25 + Math.max(0, -cs) * 1.3 * k;
    P.ftL = -0.15 * sn; P.ftR = 0.15 * sn;
    P.shLx = -sn * 1.05 * k; P.shRx = sn * 1.05 * k; P.elL = 1.1; P.elR = 1.1; P.shLz = 0.22; P.shRz = 0.22;
    P.earLx = -0.45 - Math.abs(cs) * 0.15; P.earRx = -0.45 - Math.abs(sn) * 0.15; P.earLz = 0.1; P.earRz = 0.1;
    P.tailX = 0.7 * k; P.tailY = Math.sin(ph) * 0.35;
    P.lookX = 0; P.lookY = 0.1; P.smile = 1; P.mouthO = sp > 9 ? 0.4 : 0;
    P.rz = -st.turn * 0.06;
  }

  function animJump(P, s) {
    const t = st.animT;
    const k = clamp((s.vy || 0) / 12, -0.4, 1);
    P.sq = 1 + 0.14 * Math.max(0, k) * smooth(1 - t / 0.35) + 0.05 * Math.max(0, k);
    P.torX = 0.12; P.headX = -0.15;
    P.hipLx = 0.9; P.knL = 1.5; P.hipRx = 0.1; P.knR = 0.5;
    P.shLx = 2.4; P.shRx = 1.2; P.shLz = 0.5; P.shRz = 0.7; P.elL = 0.4; P.elR = 0.6;
    P.earLx = -0.6; P.earRx = -0.6; P.tailX = 0.2;
    P.lookY = 0.3; P.mouthO = 0.25; P.smile = 1;
  }
  function animFlip(P) {
    // tucked salto (rotation itself is applied directly, see flipAngle)
    P.sq = 1;
    P.torX = 0.4; P.headX = 0.3;
    P.hipLx = 1.6; P.knL = 2.0; P.hipRx = 1.6; P.knR = 2.0;
    P.shLx = 1.0; P.shRx = 1.0; P.elL = 1.8; P.elR = 1.8; P.shLz = 0.3; P.shRz = 0.3;
    P.earLx = -0.7; P.earRx = -0.7; P.blink = 0.7; P.mouthO = 0.5;
  }
  function animFall(P, s) {
    const t = st.animT, T0 = st.time;
    const f = smooth((t - 0.18) / 0.3); // short falls look calm, long ones panic
    P.sq = 1 + 0.06 * f;
    P.torX = -0.05; P.headX = -0.15 * f;
    P.hipLx = lerp(0.5, 0.6 + Math.sin(T0 * 13) * 0.8, f); P.knL = lerp(1.0, 1.0 + Math.cos(T0 * 13) * 0.6, f);
    P.hipRx = lerp(0.2, 0.6 - Math.sin(T0 * 13) * 0.8, f); P.knR = lerp(0.6, 1.0 - Math.cos(T0 * 13) * 0.6, f);
    // windmilling arms
    P.shLx = lerp(1.6, 1.4 + Math.sin(T0 * 15) * 1.5, f); P.shLz = lerp(0.6, 0.9 + Math.cos(T0 * 15) * 0.6, f);
    P.shRx = lerp(1.0, 1.4 - Math.sin(T0 * 15) * 1.5, f); P.shRz = lerp(0.6, 0.9 + Math.cos(T0 * 15 + PI) * 0.6, f);
    P.elL = 0.3; P.elR = 0.3;
    P.earLx = 0.4 * f + Math.sin(T0 * 30) * 0.1; P.earRx = 0.4 * f - Math.sin(T0 * 30) * 0.1;
    P.eyeS = 1 + 0.25 * f; P.mouthO = 0.2 + 0.6 * f; P.smile = -1; P.lookY = -0.6 * f;
    P.tailX = -0.4 * f;
  }
  function animSpin(P, s) {
    const tor = !!s.tornado;
    P.sq = tor ? 1.04 : 0.97; P.sw = 1.04;
    P.shLz = 1.45; P.shRz = 1.45; P.shLx = 0.2; P.shRx = 0.2; P.elL = 0.15; P.elR = 0.15;
    P.hipLx = 0.5; P.knL = 1.2; P.hipRx = 0.05; P.knR = 0.2; P.hipRz = 0.2;
    P.torX = 0.05; P.headX = 0.05;
    P.earLz = 0.6; P.earRz = 0.6; P.earLx = -0.3; P.earRx = -0.3;
    P.tailX = 1.2;
    P.mouthO = 0.45; P.blink = 0.4; P.smile = 1;
    if (tor) { P.py = 0.05 + Math.sin(st.time * 12) * 0.03; P.shLx = 0.6; P.shRx = 0.6; P.hipLx = 0.2; P.knL = 0.4; }
  }
  function animSlide(P, s) {
    // baseball slide: leaning back, one leg forward, the other folded, one arm up ("SAFE!")
    P.py = -0.16; P.rx = -0.7; P.pz = 0.05;
    P.torX = 0.15; P.headX = -0.45;
    P.hipLx = 0.85; P.knL = 0.05; P.ftL = 0.5; P.hipLz = 0.05;
    P.hipRx = 0.15; P.knR = 1.9; P.hipRz = 0.25;
    P.shLx = -0.6; P.shLz = 0.6; P.elL = 0.3;
    P.shRx = 2.6; P.shRz = 0.3; P.elR = 0.25;
    P.earLx = -0.8; P.earRx = -0.8; P.tailX = 0.4;
    P.mouthO = 0.3; P.smile = 1; P.lookY = 0.3; P.eyeS = 1.05;
  }
  function animSlam(P, s) {
    const t = st.animT;
    // ball tuck, rolling forward, then the stretched dive
    P.hipLx = 1.7; P.knL = 2.2; P.hipRx = 1.7; P.knR = 2.2;
    P.shLx = 1.4; P.shRx = 1.4; P.elL = 2.0; P.elR = 2.0; P.shLz = 0.25; P.shRz = 0.25;
    P.torX = 0.5; P.headX = 0.4; P.blink = 0.85; P.mouthO = 0.2;
    P.earLx = -0.8; P.earRx = -0.8;
    P.sq = t < 0.16 ? 0.92 : 1.12; P.sw = 1.0;
    P.py = 0.1;
  }
  function animLand(P) { /* handled by the impact squash; pose = idle-ish with bent knees */
    P.knL = 0.6; P.knR = 0.6; P.hipLx = 0.3; P.hipRx = 0.3; P.torX = 0.15; P.shLz = 0.5; P.shRz = 0.5;
  }
  function animRide(P, s) {
    // read the mount state (sibling in the player group)
    let ride = null;
    const par = root.parent;
    if (par) for (const c of par.children) if (c.userData && c.userData.ride) { ride = c.userData.ride; break; }
    const kind = ride ? ride.kind : 'snail';
    P.py = -0.28 + (ride ? ride.bob : 0);
    P.rx = ride ? ride.pitch * 0.6 : 0; P.rz = (ride ? ride.roll : 0) - st.turn * 0.05;
    P.torX = 0.3; P.headX = -0.3;
    P.hipLx = 1.25; P.hipRx = 1.25; P.knL = 1.3; P.knR = 1.3; P.hipLz = 0.45; P.hipRz = 0.45;
    P.shLx = 1.0; P.shRx = 1.0; P.elL = 0.7; P.elR = 0.7; P.shLz = 0.25; P.shRz = 0.25;
    if (kind === 'penguin') { P.torX = 0.15; P.hipLx = 1.45; P.hipRx = 1.45; P.knL = 0.5; P.knR = 0.5; P.hipLz = 0.2; P.hipRz = 0.2; P.shLx = 0.7; P.shRx = 0.7; P.elL = 0.2; P.elR = 0.2; P.shLz = 0.5; P.shRz = 0.5; }
    if (kind === 'rocket') { P.torX = 0.55; P.headX = -0.5; P.shLx = 1.4; P.shRx = 1.4; P.elL = 0.9; P.elR = 0.9; P.hipLz = 0.55; P.hipRz = 0.55; P.knL = 1.6; P.knR = 1.6; }
    if (kind === 'camel') { P.hipLz = 0.75; P.hipRz = 0.75; P.knL = 1.1; P.knR = 1.1; P.shLx = 0.8 + Math.sin(st.time * 9) * 0.15; P.shRx = 0.8 + Math.sin(st.time * 9) * 0.15; }
    const sp = s.speed || 0;
    P.earLx = -0.5 - Math.min(0.5, sp * 0.03) + Math.sin(st.time * 20) * 0.08; P.earRx = -0.5 - Math.min(0.5, sp * 0.03) + Math.cos(st.time * 19) * 0.08;
    P.tailX = 1.0; P.tailY = Math.sin(st.time * 6) * 0.3;
    P.smile = 1; P.mouthO = sp > 12 ? 0.6 : 0.25; P.lookY = 0.1;
  }
  function animVictory(P, s) {
    const t = st.animT, L = 3.4, u = t % L;
    faceCam(P, smooth(t / 0.3));
    happyEyes(false);
    P.smile = 1; P.mouthO = 0.5;
    if (u < 1.3) {
      // hop-hop side to side, arms pumping like a maniac
      const b = u * 2 * PI * 2.2;
      P.py = Math.abs(Math.sin(b * 0.5)) * 0.18;
      P.px = Math.sin(b * 0.25) * 0.12;
      P.sq = 1 + Math.cos(b) * 0.08;
      P.shLx = 1.9 + Math.sin(b) * 1.0; P.shRx = 1.9 - Math.sin(b) * 1.0; P.shLz = 0.5; P.shRz = 0.5; P.elL = 1.1; P.elR = 1.1;
      P.hipLx = Math.max(0, Math.sin(b * 0.5)) * 0.9; P.knL = P.hipLx * 1.4; P.hipRx = Math.max(0, -Math.sin(b * 0.5)) * 0.9; P.knR = P.hipRx * 1.4;
      P.headZ = Math.sin(b * 0.5) * 0.25; P.tailY = Math.sin(b) * 0.9; P.rz = Math.sin(b * 0.25) * 0.12;
      happyEyes(true);
    } else if (u < 1.9) {
      // pirouette
      const k = smooth((u - 1.3) / 0.6);
      P.ry += k * TAU;
      P.py = bump(u, 1.3, 1.9) * 0.3; P.shLz = 1.5; P.shRz = 1.5; P.elL = 0.1; P.elR = 0.1; P.hipLx = 0.6; P.knL = 1.4;
      P.earLz = 0.5; P.earRz = 0.5; P.mouthO = 0.8;
    } else {
      // ridiculous pose: one leg up, thumbs up, wink. Then a little wiggle.
      const k = smooth((u - 1.9) / 0.25);
      P.hipLx = 1.1 * k; P.knL = 1.6 * k; P.hipLz = 0.3 * k;
      P.shRx = 1.5 * k; P.elR = 1.3 * k; P.shRz = 0.4;
      P.shLz = 0.75 * k + 0.2; P.elL = 2.0 * k; P.shLx = 0.2; P.shLy = -0.5 * k;
      P.torZ = -0.18 * k + Math.sin(u * 14) * 0.05 * k; P.headZ = 0.25 * k;
      P.blinkR = 1 * k; P.mouthO = 0.35; P.smile = 1; P.rz = 0.08 * k;
      P.tailY = Math.sin(u * 18) * 0.7;
      P.sq = 1 + Math.sin(u * 14) * 0.02;
    }
  }

  // ------------------------------------------------------------------ deaths
  function deathPose(P, dt) {
    const t = st.deathT, c = st.cause;
    P.lookX = 0; P.lookY = 0;
    switch (c) {
      case 'fall': {
        faceCam(P, 1);
        P.eyeS = 1.15; P.smile = -1;
        P.hipLx = 0.2 + Math.sin(t * 7) * 0.2; P.hipRx = 0.2 - Math.sin(t * 7) * 0.2; P.knL = 0.5; P.knR = 0.5;
        P.earLx = 0.3; P.earRx = 0.3; P.earLz = -0.25; P.earRz = -0.25; // droopy
        if (t < 0.3) { P.shLz = 0.5; P.shRz = 0.5; P.mouthO = 0.4; P.lookY = -0.8; P.headX = 0.3; }
        else if (t < 0.95) {
          // "bye bye..."
          P.shRx = 0.9; P.shRz = 1.9; P.elR = 0.9 + Math.sin(t * 22) * 0.6; P.shRy = -0.6;
          P.shLz = 0.25; P.headZ = 0.2; P.mouthO = 0; P.smile = -0.4; P.blink = 0.25;
        } else {
          const f = t - 0.95;
          P.py = -0.5 * 26 * f * f; P.rx = -f * 2.5; P.rz = f * 1.5;
          P.shLx = 3; P.shRx = 3; P.shLz = 0.4; P.shRz = 0.4; P.elL = 0.2; P.elR = 0.2;
          P.mouthO = 0.9; P.eyeS = 1.3; P.earLx = 1.0; P.earRx = 1.0;
        }
        break;
      }
      case 'burn': {
        faceCam(P, 1);
        P.eyeS = 1.1; P.smile = -0.3;
        P.py = bump(t, 0, 0.25) * 0.35;
        P.sq = 1 + bump(t, 0, 0.25) * 0.15;
        P.earLz = -0.45; P.earRz = -0.45; P.earLx = 0.25; P.earRx = 0.25; // straight up, frizzled
        P.shLz = 0.35; P.shRz = 0.35; P.elL = 0.1; P.elR = 0.1;
        P.blink = (t > 0.55 && t < 0.66) || (t > 0.85 && t < 0.95) ? 1 : 0;
        P.mouthO = t > 1.0 && t < 1.15 ? 0.6 : 0.15; // cough
        if (t > 1.15) { const k = easeIn((t - 1.15) / 0.6); P.sq = Math.max(0.03, 1 - k); P.sw = 1 + k * 0.5; }
        break;
      }
      case 'squash': {
        P.eyeS = 1.2; P.mouthO = 0.5; P.smile = -1;
        P.shLz = 1.3; P.shRz = 1.3; P.hipLz = 0.4; P.hipRz = 0.4; P.elL = 0.1; P.elR = 0.1; P.knL = 0; P.knR = 0;
        P.earLz = 0.5; P.earRz = 0.5;
        break;
      }
      case 'water': {
        faceCam(P, 1);
        P.eyeS = 1.2; P.mouthO = 0.7; P.smile = -1;
        const sink = t < 0.3 ? bump(t, 0, 0.3) * 0.3 : -easeIn((t - 0.3) / 1.0) * 1.6;
        P.py = sink + Math.sin(t * 9) * 0.03;
        P.shLx = 2.7 + Math.sin(t * 14) * 0.4; P.shRx = 2.7 - Math.sin(t * 14) * 0.4; P.shLz = 0.35 + Math.cos(t * 14) * 0.2; P.shRz = 0.35 - Math.cos(t * 14) * 0.2;
        P.elL = 0.3; P.elR = 0.3; P.headX = -0.4;
        P.hipLx = Math.sin(t * 10) * 0.6; P.hipRx = -Math.sin(t * 10) * 0.6; P.knL = 0.8; P.knR = 0.8;
        P.earLx = 0.4; P.earRx = 0.4;
        break;
      }
      case 'zap': {
        faceCam(P, 1);
        const j = t < 1.1 ? 1 : 0;
        P.px = (Math.random() - 0.5) * 0.05 * j; P.pz = (Math.random() - 0.5) * 0.05 * j;
        P.shLz = 2.4; P.shRz = 2.4; P.elL = 0; P.elR = 0; P.hipLz = 0.45; P.hipRz = 0.45; P.knL = 0; P.knR = 0;
        P.earLz = -0.5; P.earRz = -0.5; P.earLx = 0.25; P.earRx = 0.25; P.tailX = 1.2;
        P.mouthO = 0.9; P.eyeS = 1.3; P.sq = 1.05;
        if (t > 1.1) { const k = easeIn((t - 1.1) / 0.35); P.rx = -k * PI / 2; P.py = -k * 0.35; P.eyeS = 1; P.mouthO = 0.3; P.blink = 0.4; }
        break;
      }
      case 'explode': break; // only the shoes remain (pose = rest)
      case 'eaten': {
        faceCam(P, 1);
        P.eyeS = 1.3; P.mouthO = 0.8; P.shLx = 2.8; P.shRx = 2.8; P.shLz = 0.3; P.shRz = 0.3; P.sq = 1 + t * 2;
        break;
      }
      default: { // generic: bonk! sits down hard, dizzy, X eyes, stars circling
        faceCam(P, 1);
        const k = easeOut(t / 0.25);
        P.py = bump(t, 0, 0.25) * 0.35 - k * 0.27;
        P.sq = 1 + (t > 0.25 ? boing(t - 0.25, 20, 6) * -0.18 : 0.1);
        P.rx = -0.35 * k; P.rz = Math.sin(t * 5) * 0.12 * k;
        P.hipLx = 1.45 * k; P.hipRx = 1.45 * k; P.knL = 0.25; P.knR = 0.25; P.hipLz = 0.35; P.hipRz = 0.35; P.ftL = 0.5; P.ftR = 0.5;
        P.shLz = 0.7; P.shRz = 0.7; P.shLx = -0.3; P.shRx = -0.3; P.elL = 0.2; P.elR = 0.2;
        P.headZ = Math.sin(t * 5) * 0.3 * k; P.headX = 0.15 + Math.cos(t * 5) * 0.1;
        P.torZ = Math.sin(t * 5 + 1) * 0.12;
        P.mouthO = 0.4; P.smile = -1;         P.earLz = 0.6; P.earRz = 0.6; P.earLx = 0.3; P.earRx = 0.3; P.tailX = -0.6;
      }
    }
  }

  function startDeath(cause) {
    st.dead = true; st.cause = DEATH_DURATION[cause] ? cause : 'generic'; st.deathT = 0;
    st.gag = null; st.flipT = 9; st.slamRoll = 0;
    st.spinYaw = 0;
    swirlA.visible = swirlB.visible = false; yoyo.visible = false;
    happyEyes(false);
    const c = st.cause;
    if (c === 'burn') {
      setMaterials(charMat);
      for (const e of J.eyes) { e.ball.material = whiteEye; e.sh1.visible = e.sh2.visible = false; }
      ribbon.mesh.material = charRibbonMat();
      J.smile.material = charMat;
    }
    if (c === 'generic') for (const e of J.eyes) { e.lid.visible = false; e.x.visible = true; }
    if (c === 'squash') for (const e of J.eyes) { e.sh2.visible = false; }
    if (c === 'explode') {
      setBodyVisible(false, true);
      J.wrap.visible = J.wrapStitch.visible = J.knot.visible = false;
      ribbonOpts.pinned = false;
      ribbon.kick(0, 3, 0, 2);
      ring.visible = true; ring.position.set(0, 0.69 * SCALE * 1, 0); ring.userData.vy = 6.5; ring.userData.spin = 0;
      for (const [i, e] of flyEars.entries()) { e.visible = true; e.position.set((i ? -1 : 1) * 0.12, 1.1, 0); e.userData.vx = (i ? -1 : 1) * 0.9; e.userData.vy = 4 + i * 0.6; e.rotation.set(0, 0, (i ? 1 : -1) * 0.5); }
      flash.visible = true; flash.position.set(0, 0.55, 0); flash.scale.setScalar(0.1); flashMat.opacity = 1;
      // fur bits + smoke burst
      if (firstEmitReady()) {
        for (let i = 0; i < 18; i++) {
          const a = Math.random() * TAU, u = Math.random();
          parts.emit(rootW.x, rootW.y + 0.6, rootW.z, { vx: Math.cos(a) * 4 * u, vy: 3 + Math.random() * 4, vz: Math.sin(a) * 4 * u, g: 9, drag: 1.2, life: 1.2, s0: 0.09, s1: 0.06, color: i % 3 ? PAL.teal : PAL.cream, frame: FRAME.flake });
          parts.emit(rootW.x, rootW.y + 0.5, rootW.z, { vx: Math.cos(a) * 2 * u, vy: 1 + Math.random() * 2, vz: Math.sin(a) * 2 * u, g: -1, drag: 2, life: 1.4, s0: 0.35, s1: 0.7, color: 0x5d5450, a: 0.7, frame: FRAME.puff });
        }
      }
    }
    if (c === 'eaten') { ribbonOpts.gulp = 0; }
    if (c === 'squash') {
      J.fxPivot.rotation.set(0, 0, 0);
    }
    return DEATH_DURATION[st.cause];
  }
  function firstEmitReady() { return true; }
  let _charRibbon = null;
  function charRibbonMat() { return _charRibbon || (_charRibbon = cachedMat('lumen-scarf-char', () => new THREE.MeshStandardMaterial({ color: 0x1d1918, roughness: 1, side: THREE.DoubleSide }))); }

  /** Direct transforms / props / particles for deaths (after the pose is applied). */
  function deathFX(dt) {
    const t = st.deathT, c = st.cause;
    const hx = rootW.x, hy = rootW.y, hz = rootW.z;
    switch (c) {
      case 'fall': {
        if (t > 0.95) {
          spirit.visible = true;
          const f = t - 0.95;
          spirit.position.set(Math.sin(f * 3) * 0.15, 1.15 + f * 1.3, 0);
          const s = 1 - smooth((t - 1.6) / 0.3);
          spirit.scale.setScalar(s * smooth(f / 0.2));
          spirit.rotation.y = st.toCam;
          wingPivL.rotation.y = -0.4 + Math.sin(t * 18) * 0.7; wingPivR.rotation.y = 0.4 - Math.sin(t * 18) * 0.7;
          halo.position.y = 0.06 + Math.sin(t * 6) * 0.02;
          st.emitAcc += dt;
          if (st.emitAcc > 0.08) { st.emitAcc = 0; tmp.setFromMatrixPosition(spirit.matrixWorld); parts.emit(tmp.x, tmp.y, tmp.z, { vy: -0.3, life: 0.6, s0: 0.12, s1: 0.02, color: 0xfff2b0, frame: FRAME.spark }); }
        }
        break;
      }
      case 'burn': {
        st.emitAcc += dt;
        if (st.emitAcc > 0.06 && t < 1.6) {
          st.emitAcc = 0;
          parts.emit(hx + (Math.random() - 0.5) * 0.3, hy + (t > 1.15 ? 0.3 : 1.15), hz + (Math.random() - 0.5) * 0.3, { vy: 1.2, drag: 0.5, life: 1.1, s0: 0.2, s1: 0.5, color: 0x4a4442, a: 0.65, frame: FRAME.puff, wob: 0.4 });
        }
        if (t > 1.0 && t < 1.1 && st.emitAcc === 0) {
          tmp.setFromMatrixPosition(J.mouth.matrixWorld);
          parts.emit(tmp.x, tmp.y, tmp.z, { vx: 0, vy: 0.6, life: 0.7, s0: 0.12, s1: 0.35, color: 0x2e2a29, a: 0.85, frame: FRAME.puff });
        }
        if (t > 1.15) {
          const k = smooth((t - 1.15) / 0.6);
          ash.visible = true; ash.position.set(0, 0.07 * k, 0); ash.scale.set(0.32 * k + 0.01, 0.16 * k + 0.01, 0.32 * k + 0.01);
          if (Math.random() < 0.7 && t < 1.8) parts.emit(hx + (Math.random() - 0.5) * 0.4, hy + 0.2 + Math.random() * 0.7 * (1 - k), hz + (Math.random() - 0.5) * 0.4, { vy: -0.3, vx: (Math.random() - 0.5), g: 4, life: 0.6, s0: 0.09, s1: 0.04, color: Math.random() < 0.3 ? 0x8a3b1d : 0x2a2423, frame: FRAME.flake });
          // the two little white eyes are the last thing left, blinking on the ash pile
          ashEyes.visible = t > 1.55;
          ashEyes.position.set(0, 0.2, 0.06); ashEyes.rotation.y = st.toCam;
          ashEyes.scale.set(1, (t > 1.72 && t < 1.8) ? 0.15 : 1, 1);
        }
        break;
      }
      case 'squash': {
        // flattened into a pancake (lying on his back), wobbles, then peels off like paper and flutters away
        const P = J.fxPivot;
        if (t < 0.08) { P.rotation.x = -easeOut(t / 0.08) * PI / 2; }
        else if (t < 0.75) P.rotation.x = -PI / 2;
        else if (t < 1.25) { const k = smooth((t - 0.75) / 0.5); P.rotation.x = -PI / 2 * (1 - k) + Math.sin(k * PI) * 0.25; }
        else { P.rotation.x = Math.sin((t - 1.25) * 9) * 0.25; }
        P.rotation.y = st.toCam;
        const flat = t < 0.06 ? 1 - t / 0.06 * 0.94 : 0.06;
        const wob = t < 0.75 ? boing(t - 0.06, 22, 5) * 0.25 : 0;
        // thickness is along the body's Z (he is lying down): squash group scale z
        J.squash.scale.set(SCALE * (1.55 + wob), SCALE * (1.25 - wob * 0.5), SCALE * flat);
        if (t > 1.25) {
          const f = t - 1.25;
          P.position.set(Math.sin(f * 5) * 0.3 * f, f * 1.2 + Math.sin(f * 7) * 0.1, f * 0.4);
          P.rotation.z = Math.sin(f * 6) * 0.5;
          P.scale.setScalar(1 - smooth((t - 1.55) / 0.25));
        }
        if (t > 0.75 && t < 0.8) for (let i = 0; i < 2; i++) parts.emit(hx, hy + 0.05, hz, { vx: (Math.random() - 0.5) * 2, vy: 1, g: 3, life: 0.5, s0: 0.2, s1: 0.05, color: 0xfff7dc, frame: FRAME.spark });
        break;
      }
      case 'water': {
        // bubbles, ripples, and a little life ring that pops up (too late)
        st.emitAcc += dt;
        if (st.emitAcc > 0.07 && t > 0.3 && t < 1.75) {
          st.emitAcc = 0;
          tmp.setFromMatrixPosition(J.head.matrixWorld);
          parts.emit(tmp.x + (Math.random() - 0.5) * 0.2, Math.min(tmp.y, hy + 0.1), tmp.z + (Math.random() - 0.5) * 0.2, { vy: 1.4, life: 0.6, s0: 0.08 + Math.random() * 0.08, s1: 0.12, color: 0xdff9ff, frame: FRAME.bubble, wob: 1.2 });
        }
        ripples.forEach((r, i) => {
          const tt = (t - 0.25 - i * 0.35);
          r.visible = tt > 0;
          const k = clamp(tt / 1.1, 0, 1);
          r.position.set(0, 0.08, 0); r.scale.set(0.2 + k * 0.9, 0.2 + k * 0.9, 1); rippleMats[i].opacity = 0.7 * (1 - k);
        });
        if (t > 0.8) {
          lifeRing.visible = true;
          const k = t - 0.8;
          lifeRing.position.set(0.15, Math.min(0.08, -0.6 + k * 3) + Math.sin(t * 5) * 0.03 + boing(Math.max(0, k - 0.23), 14, 5) * 0.08, 0.1);
          lifeRing.rotation.set(PI / 2 + Math.sin(t * 3) * 0.12, 0, t * 0.8);
        }
        break;
      }
      case 'zap': {
        const flick = t < 1.1 && Math.floor(t * 14) % 2 === 0;
        setMaterials(flick ? xrayMat : t > 1.1 ? charMat : null);
        for (const s of skeleton) s.visible = flick;
        for (const e of J.eyes) e.lid.visible = !flick;
        J.mouth.visible = !flick;
        if (t > 1.1) for (const e of J.eyes) { e.ball.material = whiteEye; e.sh1.visible = e.sh2.visible = false; }
        if (t > 1.1 && t < 1.12) ribbon.mesh.material = charRibbonMat();
        st.emitAcc += dt;
        if (st.emitAcc > 0.05) {
          st.emitAcc = 0;
          if (t < 1.1) { const a = Math.random() * TAU; parts.emit(hx + Math.cos(a) * 0.4, hy + 0.3 + Math.random() * 0.9, hz + Math.sin(a) * 0.4, { vx: Math.cos(a), vy: Math.random() * 2 - 1, vz: Math.sin(a), life: 0.18, s0: 0.25, s1: 0.1, color: 0xbff4ff, frame: FRAME.spark }); }
          else parts.emit(hx + (Math.random() - 0.5) * 0.4, hy + 0.3, hz + (Math.random() - 0.5) * 0.4, { vy: 1, life: 0.9, s0: 0.15, s1: 0.4, color: 0x4f4a48, a: 0.6, frame: FRAME.puff, wob: 0.5 });
        }
        break;
      }
      case 'explode': {
        flash.visible = t < 0.3;
        flash.scale.setScalar(0.25 + easeOut(t / 0.22) * 0.75);
        flashMat.opacity = 0.95 * (1 - smooth((t - 0.08) / 0.22));
        flashMat.color.setHSL(0.11 - t * 0.25, 1, 0.62 - t * 0.6);
        // ring of scarf falls back down, bounces and lies on the ground
        const r = ring.userData;
        r.vy -= 16 * dt; ring.position.y += r.vy * dt;
        if (ring.position.y < 0.04) { ring.position.y = 0.04; r.vy = Math.abs(r.vy) > 1 ? -r.vy * 0.3 : 0; }
        r.spin = (r.spin || 0) + dt * (ring.position.y > 0.05 ? 9 : 0);
        ring.rotation.set(PI / 2 + Math.sin(r.spin) * 0.6, 0, r.spin);
        ring.position.x = Math.min(0.3, t * 0.4); ring.position.z = 0.1;
        // leaf ears flutter down
        for (const e of flyEars) {
          const u = e.userData;
          u.vy = Math.max(-1.1, u.vy - 12 * dt);
          e.position.x += u.vx * dt + Math.sin(t * 8 + u.vx) * 0.5 * dt; e.position.y += u.vy * dt;
          u.vx *= Math.exp(-dt * 1.5);
          if (e.position.y < 0.03) { e.position.y = 0.03; e.rotation.set(-PI / 2, 0, e.rotation.z); }
          else { e.rotation.z += Math.sin(t * 7 + u.vx) * dt * 3; e.rotation.x = Math.sin(t * 6) * 0.6; }
        }
        // the smoking shoes (and a last little twitch)
        st.emitAcc += dt;
        if (st.emitAcc > 0.09 && t > 0.3) {
          st.emitAcc = 0;
          for (const l of J.legs) { tmp.setFromMatrixPosition(l.shoe.matrixWorld); parts.emit(tmp.x, tmp.y + 0.08, tmp.z, { vy: 0.8, life: 1.0, s0: 0.1, s1: 0.32, color: 0x625a57, a: 0.55, frame: FRAME.puff, wob: 0.6 }); }
        }
        break;
      }
      case 'eaten': {
        // gulp: shrinks into the mouth, scarf tip sticks out and wiggles… then SLURP
        const k = easeIn(clamp(t / 0.22, 0, 1));
        J.squash.scale.multiplyScalar(Math.max(0.001, 1 - k));
        J.squash.position.set(0, 0.45 * k, 0.25 * k);
        setBodyVisible(t < 0.22);
        J.wrap.visible = J.knot.visible = J.wrapStitch.visible = t < 0.22;
        tmp.set(0, 0.5, 0.3); root.localToWorld(tmp);
        anchorW.copy(tmp);
        gulpDir.set(camW.x - tmp.x, 0, camW.z - tmp.z);
        if (gulpDir.lengthSq() < 1e-4 || !st.hasCam) gulpDir.set(0, 0, 1).transformDirection(root.matrixWorld);
        gulpDir.y = 0; gulpDir.normalize();
        let L = 0;
        if (t < 0.22) L = 0.15;
        else if (t < 0.35) L = 0.15 + easeOut((t - 0.22) / 0.13) * 1.25;
        else if (t < 1.15) L = 1.4 + Math.sin(t * 9) * 0.08;
        else L = Math.max(0, 1.4 * (1 - easeIn((t - 1.15) / 0.16)));
        ribbonOpts.widthMul = 1.35;
        ribbonOpts.gulp = L;
        ribbon.mesh.visible = L > 0.01;
        if (t > 1.35 && t < 1.38) parts.emit(tmp.x, tmp.y + 0.1, tmp.z, { vy: 0.8, life: 0.7, s0: 0.15, s1: 0.4, color: 0xd9ffe9, frame: FRAME.bubble, a: 0.9 });
        break;
      }
      default: {
        // KO stars circling above the head
        koStars.visible = st.deathT > 0.3;
        tmp.setFromMatrixPosition(J.head.matrixWorld);
        root.worldToLocal(tmp);
        koStars.position.set(tmp.x, tmp.y + 0.22, tmp.z);
        koStars.children.forEach((s, i) => {
          const a = t * 6 + (i / 3) * TAU;
          s.position.set(Math.cos(a) * 0.22, Math.sin(a * 2) * 0.03, Math.sin(a) * 0.22);
          s.rotation.set(0, -a, t * 4);
        });
      }
    }
  }

  // ------------------------------------------------------------------ main update
  function update(dt, s = {}) {
    dt = Math.min(dt || 0, 0.05);
    st.time += dt;
    let anim = s.anim || 'idle';
    if (anim === 'dead' && !st.dead) startDeath('generic');
    if (anim !== 'dead' && st.dead) resetAll();

    // world-space bookkeeping (needed for the scarf, particles, turning)
    root.updateWorldMatrix(true, false);
    rootW.setFromMatrixPosition(root.matrixWorld);
    if (firstFrame) { rootPrev.copy(rootW); }
    if (dt > 0) vel.copy(rootW).sub(rootPrev).divideScalar(dt); else vel.set(0, 0, 0);
    if (vel.lengthSq() > 900) vel.setLength(30);
    rootPrev.copy(rootW);
    const e = root.matrixWorld.elements;
    const yaw = Math.atan2(e[8], e[10]);
    st.turn = damp(st.turn, firstFrame ? 0 : clamp(wrapAngle(yaw - st.yaw) / Math.max(dt, 1e-3), -8, 8), 10, dt);
    st.yaw = yaw;
    if (st.hasCam) { tmp.copy(camW); root.worldToLocal(tmp); st.toCam = Math.atan2(tmp.x, tmp.z); }

    if (!st.dead) {
      if (anim !== st.anim) {
        st.prev = st.anim; st.anim = anim; st.animT = 0;
        if (anim === 'flip') st.flipT = 0;
        // landing impact squash
        if (AIR.has(st.prev) && !AIR.has(anim)) {
          st.impactT = 0;
          st.impactAmp = st.prev === 'slam' ? 0.5 : clamp(-st.lastVy / 32, 0.1, 0.38);
          dust(st.prev === 'slam' ? 14 : Math.round(st.impactAmp * 18), st.prev === 'slam' ? 3.2 : 1.6);
        }
        if (anim === 'spin') st.spinning = true;
        if (anim === 'slam') st.slamRoll = 0;
      }
      st.animT += dt;
      if (AIR.has(anim)) st.lastVy = s.vy || 0;
      st.flipT += dt;
      if (s.grounded) st.flipT = 9;

      // idle timer / gags
      if (anim === 'idle') {
        st.idleT += dt;
        if (!st.gag && st.idleT > 5) { st.gag = GAGS[st.gagI++ % GAGS.length]; st.gagT = 0; }
      } else { st.idleT = 0; if (st.gag) { st.gag = null; yoyo.visible = false; happyEyes(false); } }
      if (st.gag) { st.gagT += dt; if (st.gagT >= GAG_DUR[st.gag]) { st.gag = null; yoyo.visible = false; happyEyes(false); st.idleT = 1 + Math.random() * 2; } }

      // build target pose
      Object.assign(T, DEF);
      st.rate = 14;
      switch (anim) {
        case 'run': animRun(T, s, dt); st.rate = 16; break;
        case 'jump': animJump(T, s); st.rate = 18; break;
        case 'flip': animFlip(T, s); st.rate = 20; break;
        case 'fall': animFall(T, s); st.rate = 14; break;
        case 'land': animLand(T, s); st.rate = 30; break;
        case 'spin': animSpin(T, s); st.rate = 30; break;
        case 'slide': animSlide(T, s); st.rate = 24; break;
        case 'slam': animSlam(T, s); st.rate = 26; break;
        case 'ride': animRide(T, s); st.rate = 12; break;
        case 'victory': animVictory(T, s); st.rate = 16; break;
        default: animIdle(T, s, dt);
      }
      if (anim !== 'victory' && !(anim === 'idle' && st.gag === 'dance')) happyEyes(false);
      // blink (unless the pose closes the eyes)
      st.blinkT -= dt;
      if (st.blinkT <= 0) { st.blinkDur = 0.13; st.blinkT = 1.8 + Math.random() * 3.2; if (Math.random() < 0.2) st.blinkT = 0.25; }
      if (st.blinkDur > 0) { st.blinkDur -= dt; T.blink = Math.max(T.blink, 1); }
      // ear twitch
      st.earTwT -= dt;
      if (st.earTwT <= 0) { st.earTwT = 2 + Math.random() * 4; st.earTw = 1; }
      st.earTw = Math.max(0, st.earTw - dt * 5);
      // impact squash (landing / slam)
      st.impactT += dt;
      if (st.impactT < 0.6) {
        const b = boing(st.impactT, 16, 7.5) * st.impactAmp;
        T.sq -= b; T.sw += b * 0.25;
        T.knL += b * 2.5; T.knR += b * 2.5; T.hipLx += b * 1.2; T.hipRx += b * 1.2; T.torX += b * 0.8;
        T.earLx += b * 1.5; T.earRx += b * 1.5; T.py -= b * 0.2;
      }
      // slam roll (direct)
      if (anim === 'slam') st.slamRoll += dt * (st.animT < 0.16 ? 14 : 4); else st.slamRoll = 0;
      // spin yaw (direct): fast rotation, then finish the turn cleanly
      if (anim === 'spin') st.spinYaw += dt * (s.tornado ? 26 : 30);
      else if (st.spinYaw !== 0) {
        const before = st.spinYaw;
        st.spinYaw += dt * 22;
        if (Math.floor(st.spinYaw / TAU) !== Math.floor(before / TAU) || st.spinYaw - before > TAU) st.spinYaw = 0;
      }
      if (st.spinYaw > TAU * 1000) st.spinYaw %= TAU;
    } else {
      st.deathT += dt;
      Object.assign(T, DEF);
      st.rate = 20;
      deathPose(T, dt);
    }

    // blend
    const kk = 1 - Math.exp(-st.rate * dt);
    for (const key of KEYS) {
      if (firstFrame) Cur[key] = T[key];
      else if (key === 'ry') Cur.ry += wrapAngle(T.ry - Cur.ry) * kk;
      else Cur[key] += (T[key] - Cur[key]) * kk;
    }
    // jitter-free direct channels for the cartoon timing
    if (st.dead && (st.cause === 'zap')) { Cur.px = T.px; Cur.pz = T.pz; }
    apply(0);
    if (st.dead) deathFX(dt);

    root.updateWorldMatrix(false, true);
    updateSwirl(dt, s, anim);
    updateYoyo(dt);
    updateInvincible(dt, s);
    updateScarf(dt, s, anim);
    parts.update(dt, root);
    firstFrame = false;
  }

  function dust(n, sp) {
    for (let i = 0; i < n; i++) {
      const a = (i / Math.max(1, n)) * TAU + Math.random() * 0.3;
      parts.emit(rootW.x + Math.cos(a) * 0.15, rootW.y + 0.05, rootW.z + Math.sin(a) * 0.15, { vx: Math.cos(a) * sp, vy: 0.5 + Math.random() * 0.6, vz: Math.sin(a) * sp, drag: 4, g: 1, life: 0.55, s0: 0.22, s1: 0.4, color: 0xe9dcc4, a: 0.7, frame: FRAME.puff });
    }
  }

  function updateSwirl(dt, s, anim) {
    const on = anim === 'spin' && !st.dead;
    const tor = on && !!s.tornado;
    const target = on ? 1 : 0;
    const op = damp(swirlMatA.opacity / 0.5, target, on ? 30 : 12, dt);
    swirlMatA.opacity = op * 0.5; swirlMatB.opacity = op * 0.6;
    swirlA.visible = swirlB.visible = op > 0.02;
    if (!swirlA.visible) return;
    const big = tor ? 1.5 : 1;
    swirlA.scale.set(big, tor ? 1.35 : 1, big); swirlB.scale.set(big * 0.8, tor ? 1.2 : 0.85, big * 0.8);
    swirlA.rotation.y += dt * 24; swirlB.rotation.y -= dt * 17;
    swirlA.position.y = tor ? -0.05 : 0.02;
    swirlMatB.color.setHex(scarfColor);
    // a few sparks flung off the toupie
    if (Math.random() < (tor ? 0.6 : 0.35)) {
      const a = Math.random() * TAU;
      parts.emit(rootW.x + Math.cos(a) * 0.6 * big, rootW.y + 0.2 + Math.random() * 0.8, rootW.z + Math.sin(a) * 0.6 * big, { vx: -Math.sin(a) * 4, vy: 0.5, vz: Math.cos(a) * 4, drag: 3, life: 0.3, s0: 0.14, s1: 0.04, color: Math.random() < 0.5 ? 0xfff1d0 : scarfColor, frame: FRAME.spark });
    }
  }

  function updateYoyo(dt) {
    if (!yoyo.visible) return;
    const hand = J.arms[1].hand;
    tmp.setFromMatrixPosition(hand.matrixWorld);
    J.base.worldToLocal(tmp);
    const L = yoyo.userData.L || 0.05, esc = yoyo.userData.escape || 0;
    yoString.position.set(tmp.x, tmp.y - L / 2, tmp.z);
    yoString.scale.set(0.006, Math.max(0.001, L * (1 - Math.min(1, esc * 3))), 0.006);
    yoString.visible = esc < 0.33;
    firefly.position.set(tmp.x + esc * 0.8, tmp.y - L + esc * 1.6 + Math.sin(st.time * 30) * 0.004, tmp.z + esc * 0.4);
    firefly.rotation.y = st.time * (esc > 0 ? 12 : 3);
    fireGlow.scale.setScalar(0.06 + Math.sin(st.time * 9) * 0.012);
  }

  function updateInvincible(dt, s) {
    const inv = !!s.invincible && !st.dead;
    if (inv) {
      st.invT += dt;
      LUMEN_RIM.color.value.setHSL((st.invT * 0.6) % 1, 0.9, 0.62);
      LUMEN_RIM.strength.value = 0.9 + Math.sin(st.invT * 14) * 0.35;
      st.emitAcc += dt;
      if (st.emitAcc > 0.045) {
        st.emitAcc = 0;
        const a = Math.random() * TAU, r = 0.35 + Math.random() * 0.25;
        const c = Math.random() < 0.5 ? 0xfff0a0 : Math.random() < 0.5 ? 0xb5f3d0 : 0xffc6e6;
        parts.emit(rootW.x + Math.cos(a) * r, rootW.y + 0.15 + Math.random() * 1.0, rootW.z + Math.sin(a) * r, { vy: 0.6, drag: 1, life: 0.55, s0: 0.2, s1: 0.03, color: c, frame: FRAME.spark });
      }
    } else if (st.wasInv) {
      LUMEN_RIM.color.value.set(0xfff2d6); LUMEN_RIM.strength.value = 0.28;
    }
    st.wasInv = inv;
  }

  function updateScarf(dt, s, anim) {
    // anchor & body frame in world space
    anchorW.setFromMatrixPosition(J.knotAnchor.matrixWorld);
    J.torso.getWorldQuaternion(q);
    backW.set(0, -0.25, -1).applyQuaternion(q).normalize();
    J.mover.getWorldQuaternion(q);
    rightW.set(1, 0, 0).applyQuaternion(q).normalize();
    bodyC.setFromMatrixPosition(J.torso.matrixWorld); tmp2.set(0, 0.17 * SCALE, 0).applyQuaternion(q); bodyC.add(tmp2);
    headC.setFromMatrixPosition(J.head.matrixWorld);
    const spinning = anim === 'spin' && !st.dead;
    ribbonOpts.spin = damp(ribbonOpts.spin, spinning ? 1 : 0, spinning ? 25 : 6, dt);
    ribbonOpts.tornado = !!s.tornado;
    J.mover.getWorldDirection(tmp2); // +Z of mover in world
    ribbonOpts.spinYaw = Math.atan2(-tmp2.x, -tmp2.z);
    ribbonOpts.speed = Math.hypot(vel.x, vel.z);
    ribbonOpts.bodyR = st.dead ? 0 : 0.21;
    ribbonOpts.headR = st.dead ? 0 : 0.27;
    const onGround = st.dead ? !AIRBORNE_DEATHS.has(st.cause) : !!s.grounded && anim !== 'ride';
    ribbonOpts.groundY = onGround ? rootW.y : null;
    if (st.dead && st.cause === 'explode') { ribbonOpts.gravity = 14; vel.set(0, 0, 0); ribbonOpts.speed = 0; }
    // a gentle breeze so the scarf floats even when standing still
    const calm = 1 - clamp(ribbonOpts.speed / 4, 0, 1);
    windV.set(backW.x, 0, backW.z).normalize().multiplyScalar(2.2 * calm * (0.8 + 0.4 * Math.sin(st.time * 1.7)));
    windV.y = 3.4 * calm;
    if (st.dead) windV.set(0, 0, 0);
    if (firstFrame || !ribbon.initialized) ribbon.snap(anchorW, backW);
    ribbon.update(dt, ribbonOpts, root);
  }

  resetAll();

  return {
    object3d: root,
    update,
    playDeath(cause = 'generic') { return startDeath(cause); },
    reset() { resetAll(); },
    setScarf(color) {
      scarfColor = toHex(color, PAL.scarf);
      const m = LM.scarf(scarfColor);
      J.wrap.material = m; J.knot.material = m; J.wrap.userData.mat0 = m; J.knot.userData.mat0 = m;
      ring.material = m;
      ribbon.setColor(scarfColor);
    },
    dispose() {
      ribbon.dispose(); parts.dispose();
      swirlMatA.dispose(); swirlMatB.dispose(); flashMat.dispose(); rippleMats.forEach((m) => m.dispose());
      disposeOwned(root);
    },
    /** debug / tests */
    get state() { return st; },
    joints: J,
    ribbon,
  };
}

function toHex(c, fallback) {
  if (c == null || c === '') return fallback;
  if (typeof c === 'number') return c;
  try { return new THREE.Color(c).getHex(); } catch { return fallback; }
}
