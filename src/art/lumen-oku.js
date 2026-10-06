// Oku Oku — Lumen's cardboard tiki mask (parody of Aku Aku): marker-drawn face, masking tape, googly eyes
// whose pupils roll with gravity and inertia, feathers. Follows the player's shoulder with lag.
// count 0 = hidden, 1 = plain cardboard, 2 = + golden feathers, 3 = GIANT golden disco shield in front of Lumen.
import * as THREE from 'three';
import {
  PI, TAU, G, Parts, feltVC, RIM, cachedGeo, cachedMat, cachedTex, felt, std, basic, glow, additive, mesh, group, clamp, lerp, damp, smooth, boing,
  wrapAngle, roundRect, Particles, FRAME, leafShape, extrude, disposeOwned,
} from './lumen-kit.js';

// mask outline (metres), face towards +Z
function maskShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.33);
  s.quadraticCurveTo(0.2, -0.33, 0.235, -0.12);
  s.quadraticCurveTo(0.26, 0.08, 0.25, 0.22);
  s.quadraticCurveTo(0.27, 0.3, 0.2, 0.33);
  s.quadraticCurveTo(0.17, 0.4, 0.1, 0.36);
  s.quadraticCurveTo(0.05, 0.44, 0, 0.42);
  s.quadraticCurveTo(-0.05, 0.44, -0.1, 0.36);
  s.quadraticCurveTo(-0.17, 0.4, -0.2, 0.33);
  s.quadraticCurveTo(-0.27, 0.3, -0.25, 0.22);
  s.quadraticCurveTo(-0.26, 0.08, -0.235, -0.12);
  s.quadraticCurveTo(-0.2, -0.33, 0, -0.33);
  return s;
}
const BOX = { x0: -0.28, x1: 0.28, y0: -0.36, y1: 0.46 }; // texture mapping box
function fitUV(g) {
  const uv = g.attributes.uv, pos = g.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - BOX.x0) / (BOX.x1 - BOX.x0), (pos.getY(i) - BOX.y0) / (BOX.y1 - BOX.y0));
  return g;
}
const DEPTH = 0.035;
function bodyGeo() {
  return cachedGeo('oku:body', () => {
    const g = new THREE.ExtrudeGeometry(maskShape(), { depth: DEPTH, bevelEnabled: false, curveSegments: 6 });
    g.translate(0, 0, -DEPTH / 2);
    return fitUV(g);
  });
}
function faceGeo() {
  return cachedGeo('oku:face', () => fitUV(new THREE.ShapeGeometry(maskShape(), 8)));
}

function drawFace(g, w, h, gold) {
  const X = (x) => ((x - BOX.x0) / (BOX.x1 - BOX.x0)) * w, Y = (y) => (1 - (y - BOX.y0) / (BOX.y1 - BOX.y0)) * h;
  // background: cardboard or gold mosaic
  if (gold) {
    g.fillStyle = '#e8b93c'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 12) for (let x = 0; x < w; x += 12) {
      const v = Math.sin(x * 0.37 + y * 0.91) * 0.5 + 0.5;
      g.fillStyle = `hsl(${42 + v * 10}, ${70 + v * 25}%, ${50 + v * 30}%)`;
      g.fillRect(x + 1, y + 1, 10, 10);
    }
  } else {
    g.fillStyle = '#c99862'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,80,40,0.18)'; g.lineWidth = 3;
    for (let x = -h; x < w; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.08, h); g.stroke(); }
    // stains
    g.fillStyle = 'rgba(110,70,30,0.12)';
    g.beginPath(); g.ellipse(w * 0.75, h * 0.8, 26, 18, 0.4, 0, TAU); g.fill();
  }
  const ink = '#1d1611';
  g.lineCap = 'round'; g.lineJoin = 'round';
  // forehead zig-zags (felt-tip)
  const zig = (y, col, amp) => { g.strokeStyle = col; g.lineWidth = 7; g.beginPath(); for (let i = 0; i <= 8; i++) { const x = X(-0.17 + i * 0.0425); const yy = Y(y) + (i % 2 ? -amp : amp); if (i) g.lineTo(x, yy); else g.moveTo(x, yy); } g.stroke(); };
  zig(0.3, gold ? '#b5121b' : '#d6342b', 7);
  zig(0.24, gold ? '#0c6f5b' : '#2f9a5f', 5);
  // big angry/friendly brows
  g.strokeStyle = ink; g.lineWidth = 14;
  g.beginPath(); g.moveTo(X(-0.19), Y(0.15)); g.quadraticCurveTo(X(-0.1), Y(0.21), X(-0.03), Y(0.14)); g.stroke();
  g.beginPath(); g.moveTo(X(0.19), Y(0.15)); g.quadraticCurveTo(X(0.1), Y(0.21), X(0.03), Y(0.14)); g.stroke();
  // eye rings (painted white, the googly eyes sit on them)
  g.fillStyle = gold ? '#fff3c4' : '#f4ecd9'; g.strokeStyle = ink; g.lineWidth = 5;
  for (const sx of [-1, 1]) { g.beginPath(); g.ellipse(X(sx * 0.1), Y(0.06), w * 0.15, h * 0.1, 0, 0, TAU); g.fill(); g.stroke(); }
  // nose
  g.fillStyle = gold ? '#d0751c' : '#e07a2c';
  g.beginPath(); g.moveTo(X(0), Y(0.05)); g.lineTo(X(0.055), Y(-0.07)); g.quadraticCurveTo(X(0), Y(-0.1), X(-0.055), Y(-0.07)); g.closePath(); g.fill();
  g.lineWidth = 5; g.stroke();
  // grin with teeth
  g.fillStyle = '#3b1414';
  g.beginPath(); g.moveTo(X(-0.17), Y(-0.13)); g.quadraticCurveTo(X(0), Y(-0.3), X(0.17), Y(-0.13)); g.quadraticCurveTo(X(0), Y(-0.19), X(-0.17), Y(-0.13)); g.fill();
  g.fillStyle = '#fffaf0';
  for (let i = -3; i <= 3; i++) { const x = X(i * 0.035) - 6; g.fillRect(x, Y(-0.15) - 2, 12, 12 - Math.abs(i) * 1.2); }
  g.strokeStyle = ink; g.lineWidth = 6;
  g.beginPath(); g.moveTo(X(-0.17), Y(-0.13)); g.quadraticCurveTo(X(0), Y(-0.3), X(0.17), Y(-0.13)); g.quadraticCurveTo(X(0), Y(-0.19), X(-0.17), Y(-0.13)); g.stroke();
  // cheek swirls
  g.strokeStyle = gold ? '#a3122a' : '#c8406a'; g.lineWidth = 5;
  for (const sx of [-1, 1]) { g.beginPath(); g.arc(X(sx * 0.19), Y(-0.06), 12, 0, PI * 1.6); g.stroke(); }
  // chin doodles
  g.fillStyle = ink; g.font = `bold ${Math.round(h * 0.04)}px sans-serif`; g.textAlign = 'center';
  g.fillText(gold ? '★ DISCO ★' : 'fait main', X(0), Y(-0.27));
}
function faceTex(gold) { return cachedTex(`oku-face:${gold}`, 256, 368, (g, w, h) => drawFace(g, w, h, gold)); }
function backTex() {
  return cachedTex('oku-back', 256, 368, (g, w, h) => {
    g.fillStyle = '#bf8c57'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(110,70,35,0.2)'; g.lineWidth = 3;
    for (let x = -h; x < w; x += 9) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.08, h); g.stroke(); }
    g.save(); g.translate(w / 2, h * 0.42); g.rotate(-0.18);
    g.strokeStyle = '#c0262d'; g.lineWidth = 6; roundRect(g, -100, -30, 200, 60, 8); g.stroke();
    g.fillStyle = '#c0262d'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('FRAGILE', 0, 2);
    g.restore();
    g.fillStyle = '#2a1d14'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center';
    g.fillText('↑ HAUT ↑', w / 2, h * 0.68);
    g.font = '15px monospace'; g.fillText('BANANES — 18 KG', w / 2, h * 0.78);
    // barcode
    for (let i = 0; i < 26; i++) { g.fillRect(w * 0.3 + i * 4.2, h * 0.84, (i * 7) % 3 + 1, 20); }
  });
}
function edgeTex() {
  return cachedTex('oku-edge', 64, 16, (g, w, h) => {
    g.fillStyle = '#d8b07a'; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#9b6f3f'; g.lineWidth = 2; g.beginPath();
    for (let x = 0; x <= w; x += 2) g.lineTo(x, h / 2 + Math.sin(x * 0.8) * h * 0.3);
    g.stroke();
  }, { repeat: true });
}

const MAT = {
  face(gold) { return cachedMat(`oku-face:${gold}`, () => new THREE.MeshStandardMaterial({ map: faceTex(gold), color: faceTex(gold) ? 0xffffff : (gold ? 0xe8b93c : 0xc99862), roughness: gold ? 0.3 : 0.9, metalness: gold ? 0.6 : 0, emissive: gold ? 0x6b4a10 : 0x000000, emissiveIntensity: gold ? 0.6 : 0 })); },
  back(gold) { return gold ? cachedMat('oku-back-gold', () => new THREE.MeshStandardMaterial({ color: 0xe6b640, roughness: 0.25, metalness: 0.8, emissive: 0x5a3a08, emissiveIntensity: 0.5 })) : cachedMat('oku-back', () => new THREE.MeshStandardMaterial({ map: backTex(), color: backTex() ? 0xffffff : 0xbf8c57, roughness: 0.92 })); },
  edge(gold) { return gold ? cachedMat('oku-edge-gold', () => new THREE.MeshStandardMaterial({ color: 0xffd76a, roughness: 0.3, metalness: 0.7 })) : cachedMat('oku-edge', () => new THREE.MeshStandardMaterial({ map: edgeTex(), color: edgeTex() ? 0xffffff : 0xd8b07a, roughness: 0.95 })); },
  tape: () => cachedMat('oku-tape', () => new THREE.MeshStandardMaterial({ color: 0xf3e2a6, roughness: 0.55, transparent: true, opacity: 0.82 })),
  white: () => cachedMat('oku-eye-white', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 })),
  pupil: () => cachedMat('oku-pupil', () => new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.2 })),
  dome: () => cachedMat('oku-dome', () => new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.05, transparent: true, opacity: 0.22, depthWrite: false })),
  paper: (c) => felt(c, 0.9, 0.08),
  gold: () => cachedMat('oku-gold-feather', () => new THREE.MeshStandardMaterial({ color: 0xffd25e, roughness: 0.28, metalness: 0.75, emissive: 0x7a5410, emissiveIntensity: 0.45 })),
};
function featherGeo(size, w) { return cachedGeo(`oku-feather:${size}:${w}`, () => extrude(leafShape(size, w), 0.012, 0, 6)); }

export function createOku() {
  const root = group(null, null, 'oku');
  const body = group(); root.add(body); // scale / bob / spin
  const mask = group(); body.add(mask);
  const shell = mesh(bodyGeo(), [MAT.back(false), MAT.edge(false)]);
  const face = mesh(faceGeo(), MAT.face(false), [0, 0, DEPTH / 2 + 0.002]);
  // seen from behind, a PI-rotated copy of the face shape reads the right way round
  const backFace = mesh(faceGeo(), MAT.back(false), [0, 0, -DEPTH / 2 - 0.002], [0, PI, 0]);
  mask.add(shell, face, backFace);
  shell.castShadow = true;
  // masking tape strips
  const tapes = [
    [[-0.2, 0.33, 0], [0, 0, 0.75], [0.15, 0.045]],
    [[0.235, -0.04, 0], [0, 0, -1.45], [0.17, 0.045]],
    [[0.06, -0.31, 0], [0, 0, 0.25], [0.14, 0.04]],
  ];
  for (const [p, r, [w, h]] of tapes) {
    const t = mesh(G.box(), MAT.tape(), p, r, [w, h, DEPTH + 0.008]);
    mask.add(t);
  }
  // googly eyes
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = group([sx * 0.1, 0.06, DEPTH / 2 + 0.012]);
    const white = mesh(G.cyl(20), MAT.white(), [0, 0, 0], [PI / 2, 0, 0], [0.068, 0.014, 0.068]);
    const pupil = mesh(G.cyl(16), MAT.pupil(), [0, -0.03, 0.009], [PI / 2, 0, 0], [0.034, 0.01, 0.034]);
    const dome = mesh(G.sphere(16, 8), MAT.dome(), [0, 0, 0.004], null, [0.07, 0.07, 0.025]);
    e.add(white, pupil, dome);
    mask.add(e);
    eyes.push({ e, pupil, x: 0, y: -0.03, vx: 0, vy: 0 });
  }
  // paper feathers (always) + golden feathers (count >= 2)
  const paperF = group(), goldF = group();
  mask.add(paperF, goldF);
  paperF.add(mesh(cachedGeo('oku:paperFeathers', () => {
    const P = new Parts();
    for (const [x, y, a, c] of [[-0.12, 0.36, 0.35, 0xd6342b], [0.12, 0.36, -0.35, 0x2f9a5f], [0, 0.4, 0, 0xf2c53d]]) P.add(featherGeo(0.08, 0.8), c, [x, y, -0.012], [0, 0, a]);
    return P.build();
  }), feltVC(RIM, 0.08)));
  goldF.add(mesh(cachedGeo('oku:goldFeathers', () => {
    const P = new Parts();
    for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; P.add(featherGeo(0.15 - Math.abs(i - 3) * 0.012, 0.9), 0xffffff, [Math.sin(a) * 0.17, 0.3 + Math.cos(a) * 0.08, -0.03], [0, 0, -a]); }
    for (const sx of [-1, 1]) P.add(featherGeo(0.12, 0.85), 0xffffff, [sx * 0.25, -0.05, -0.025], [0, 0, -sx * 1.9]);
    return P.build();
  }), MAT.gold()));
  // disco: beams + sparkles
  const disco = group(); body.add(disco);
  const beamMats = [0xff6ad5, 0x6ae0ff, 0xfff36a, 0x8aff8a].map((c) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  for (let i = 0; i < 6; i++) {
    const b = mesh(G.cone(10), beamMats[i % 4], [0, 0, 0], null, [0.1, 1.3, 0.1]);
    const piv = group(null, [0, 0, (i / 6) * TAU]);
    b.position.set(0, 0.72, -0.05); b.rotation.set(PI, 0, 0);
    piv.add(b); disco.add(piv);
  }
  disco.visible = false;
  const parts = new Particles(48);
  root.add(parts.points);

  const st = { count: 0, shown: 0, popT: 9, time: 0, init: false, yaw: 0, gold: false, spin: 0 };
  const pos = new THREE.Vector3(), prevPos = new THREE.Vector3(), vel = new THREE.Vector3(), prevVel = new THREE.Vector3(), acc = new THREE.Vector3();
  const tp = new THREE.Vector3(), tPrev = new THREE.Vector3(), camW = new THREE.Vector3(), tmp = new THREE.Vector3(), q = new THREE.Quaternion(), qi = new THREE.Quaternion();
  let hasCam = false, tSpeed = 0;
  face.onBeforeRender = (r, s, cam) => { camW.setFromMatrixPosition(cam.matrixWorld); hasCam = true; };
  shell.onBeforeRender = face.onBeforeRender;

  function setGold(g) {
    if (st.gold === g) return;
    st.gold = g;
    shell.material = [MAT.back(g), MAT.edge(g)];
    face.material = MAT.face(g);
    backFace.material = MAT.back(g);
    paperF.visible = !g;
  }

  function update(dt, o = {}) {
    dt = Math.min(dt || 0, 0.05);
    st.time += dt;
    const count = clamp(Math.floor(o.count || 0), 0, 3);
    if (count !== st.count) { st.popT = 0; st.count = count; }
    st.popT += dt;
    if (!o.target) { root.visible = false; return; }
    // follow Lumen's art when it exists (on a mount, the art sits on the seat, above the player's feet)
    if (o.target !== st.target) { st.target = o.target; st.anchor = o.target.getObjectByName?.('lumen-art') || o.target; }
    st.anchor.getWorldPosition(tp);
    if (!st.init) { tPrev.copy(tp); }
    tSpeed = damp(tSpeed, dt > 0 ? tmp.copy(tp).sub(tPrev).setY(0).length() / dt : 0, 5, dt);
    tPrev.copy(tp);
    const facing = o.facing ?? 0;
    const fx = Math.sin(facing), fz = Math.cos(facing), rx = -Math.cos(facing), rz = Math.sin(facing);
    const T = st.time;
    // target position
    let ox, oy, oz, k;
    if (count >= 3) { ox = fx * 0.8; oz = fz * 0.8; oy = 0.62 + Math.sin(T * 3) * 0.05; k = 14; }
    else { ox = rx * 0.6 - fx * 0.3; oz = rz * 0.6 - fz * 0.3; oy = 1.1 + Math.sin(T * 2.4) * 0.07; k = 5.5; }
    tmp.set(tp.x + ox, tp.y + oy, tp.z + oz);
    if (!st.init || st.popT === 0 && count > 0 && st.shown === 0) { pos.copy(tmp); prevPos.copy(tmp); st.init = true; }
    pos.x = damp(pos.x, tmp.x, k, dt); pos.y = damp(pos.y, tmp.y, k * 1.2, dt); pos.z = damp(pos.z, tmp.z, k, dt);
    if (dt > 0) { vel.copy(pos).sub(prevPos).divideScalar(dt); acc.copy(vel).sub(prevVel).divideScalar(dt); }
    prevPos.copy(pos); prevVel.copy(vel);
    if (acc.lengthSq() > 2500) acc.setLength(50);
    root.position.copy(pos);
    // visibility & size (pop in / out)
    const want = count > 0 ? 1 : 0;
    st.shown = damp(st.shown, want, want ? 10 : 7, dt);
    const visible = st.shown > 0.02;
    root.visible = visible;
    if (!visible) { parts.update(dt, root); return; }
    setGold(count >= 3);
    goldF.visible = count >= 2;
    const big = count >= 3 ? 2.3 : 1;
    const pop = st.popT < 0.8 ? boing(st.popT, 16, 5) * 0.35 : 0;
    body.scale.setScalar(Math.max(0.001, st.shown * big * (1 + pop)) * 0.9);
    // orientation: faces where Lumen goes, turned towards the camera when he stands still
    let camYaw = facing;
    if (hasCam) camYaw = Math.atan2(camW.x - pos.x, camW.z - pos.z);
    const toward = count >= 3 ? 0 : (tSpeed < 1 ? 0.75 : 0.28);
    const targetYaw = facing + wrapAngle(camYaw - facing) * toward;
    st.yaw += wrapAngle(targetYaw - st.yaw) * (1 - Math.exp(-6 * dt));
    if (count >= 3) {
      st.spin += dt * (2.5 + Math.sin(T * 0.7) * 1.5);
      body.rotation.set(Math.sin(T * 5) * 0.08, st.yaw + Math.sin(st.spin) * 0.7, Math.sin(T * 4) * 0.12);
    } else {
      // sway with the motion (lateral velocity → roll, forward accel → pitch)
      const lat = vel.x * rx + vel.z * rz, fwdA = acc.x * fx + acc.z * fz;
      body.rotation.set(clamp(-fwdA * 0.01, -0.4, 0.4) + Math.sin(T * 1.7) * 0.05, st.yaw + Math.sin(T * 1.3) * 0.1, clamp(lat * 0.05, -0.45, 0.45) + Math.sin(T * 2.1) * 0.06);
    }
    // googly pupils: gravity + inertia, bouncing inside the white
    body.updateWorldMatrix(true, false);
    q.setFromRotationMatrix(body.matrixWorld); qi.copy(q).invert();
    tmp.set(0, -9.8, 0).sub(acc.multiplyScalar(0.6)).applyQuaternion(qi);
    for (const e of eyes) {
      e.vx += tmp.x * dt * 0.12; e.vy += tmp.y * dt * 0.12;
      if (count >= 3) { e.vx += Math.cos(T * 9) * dt * 1.2; e.vy += Math.sin(T * 9) * dt * 1.2; }
      const d = Math.exp(-2.5 * dt); e.vx *= d; e.vy *= d;
      e.x += e.vx * dt; e.y += e.vy * dt;
      const R = 0.032, L = Math.hypot(e.x, e.y);
      if (L > R) {
        const nx = e.x / L, ny = e.y / L;
        e.x = nx * R; e.y = ny * R;
        const vn = e.vx * nx + e.vy * ny;
        if (vn > 0) { e.vx -= 1.5 * vn * nx; e.vy -= 1.5 * vn * ny; }
      }
      e.pupil.position.set(e.x, e.y, 0.009);
    }
    // disco mode: beams + glitter
    disco.visible = count >= 3;
    if (count >= 3) {
      disco.rotation.z += dt * 1.8;
      beamMats.forEach((m, i) => { m.opacity = 0.1 + 0.07 * Math.sin(T * 8 + i * 1.7); });
      if (Math.random() < 0.8) {
        const a = Math.random() * TAU, r = 0.4 + Math.random() * 0.5;
        const c = [0xfff2a0, 0xff9be6, 0x9be8ff, 0xffffff][Math.floor(Math.random() * 4)];
        parts.emit(pos.x + Math.cos(a) * r, pos.y + (Math.random() - 0.3) * 1.0, pos.z + Math.sin(a) * r, { vy: -0.3, drag: 1, life: 0.6, s0: 0.22, s1: 0.03, color: c, frame: FRAME.spark });
      }
    } else if (st.popT < 0.3 && count > 0 && Math.random() < 0.6) {
      parts.emit(pos.x, pos.y, pos.z, { vx: (Math.random() - 0.5) * 3, vy: Math.random() * 2, vz: (Math.random() - 0.5) * 3, drag: 2, life: 0.5, s0: 0.15, s1: 0.03, color: count >= 2 ? 0xffe27a : 0xfff4dc, frame: FRAME.spark });
    }
    parts.update(dt, root);
  }

  return {
    object3d: root,
    update,
    dispose() { parts.dispose(); beamMats.forEach((m) => m.dispose()); disposeOwned(root); },
  };
}
