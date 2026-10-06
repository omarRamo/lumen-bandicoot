// Lumen's mounts for the 'ride' levels: snail (escargot turbo), camel (sunglasses, wobbly humps),
// penguin (grumpy belly-sled), rocket (cardboard + tape). Each faces +Z, touches the ground at y=0 and
// exposes `seat` (where Lumen's art origin goes). object3d.userData.ride = { kind, bob, pitch, roll }
// is read by Lumen's 'ride' animation so the rider bounces with the mount.
import * as THREE from 'three';
import {
  PI, TAU, G, Parts, cachedGeo, cachedMat, cachedTex, felt, feltVC, std, basic, glow, mesh, group, clamp, lerp, damp, smooth,
  roundRect, Particles, FRAME, extrude, disposeOwned, RIM, V3,
} from './lumen-kit.js';

const VC = () => feltVC(RIM, 0.1);

// ------------------------------------------------------------------ shared bits
function flameShape(len = 1) {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.08, 0.05, 0.12, 0.12 * len, 0.06, 0.2 * len);
  s.bezierCurveTo(0.12, 0.26 * len, 0.1, 0.36 * len, 0.03, 0.42 * len);
  s.bezierCurveTo(0.04, 0.33 * len, -0.02, 0.3 * len, -0.04, 0.26 * len);
  s.bezierCurveTo(-0.06, 0.32 * len, -0.1, 0.33 * len, -0.12, 0.3 * len);
  s.bezierCurveTo(-0.08, 0.2 * len, -0.1, 0.08, 0, 0);
  return s;
}
function flameDecalGeo() {
  return cachedGeo('mount:flamedecal', () => {
    const P = new Parts();
    P.add(new THREE.ShapeGeometry(flameShape(1.4), 8), 0xe8402a, [0, 0, 0]);
    P.add(new THREE.ShapeGeometry(flameShape(1.0), 8), 0xf7a531, [0.01, 0.02, 0.004], null, [0.75, 0.8, 1]);
    P.add(new THREE.ShapeGeometry(flameShape(0.7), 8), 0xffe36a, [0.015, 0.03, 0.008], null, [0.5, 0.6, 1]);
    return P.build();
  });
}
function exhaustFlameMats() {
  return [0xff7a2a, 0xffd04a].map((c, i) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: i ? 0.95 : 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
}
function googlyEye(r = 0.08) {
  const g = group();
  g.add(mesh(G.sphere(14, 10), std(0xffffff, 0.3, 0, null, 'mount-eye'), null, null, r));
  const p = mesh(G.sphere(10, 8), std(0x15131a, 0.2, 0, null, 'mount-pupil'), [0, -r * 0.2, r * 0.75], null, [r * 0.45, r * 0.45, r * 0.3]);
  g.add(p); g.userData.pupil = p;
  return g;
}
function cardboardTex(label) {
  return cachedTex(`mount-cardboard:${label}`, 512, 256, (g, w, h) => {
    g.fillStyle = '#c99862'; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(120,80,40,0.16)'; g.lineWidth = 3;
    for (let x = -h; x < w; x += 10) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + h * 0.1, h); g.stroke(); }
    // marker drawings
    g.lineWidth = 6; g.strokeStyle = '#1d1611'; g.fillStyle = '#9ad9f0';
    for (const x of [w * 0.32, w * 0.82]) { g.beginPath(); g.arc(x, h * 0.42, 34, 0, TAU); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,0.7)'; g.beginPath(); g.arc(x - 10, h * 0.34, 9, 0, TAU); g.fill(); g.fillStyle = '#9ad9f0'; }
    g.fillStyle = '#d6342b'; g.font = 'bold 46px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(label, w * 0.57, h * 0.75);
    g.strokeStyle = '#2f6fd6'; g.lineWidth = 8;
    g.beginPath(); for (let i = 0; i <= 12; i++) { const x = w * 0.05 + i * w * 0.075, y = h * 0.12 + (i % 2 ? -10 : 10); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.stroke();
    g.fillStyle = '#1d1611'; g.font = '18px monospace'; g.fillText('NE PAS PLIER', w * 0.57, h * 0.93);
  });
}
const TAPE = () => cachedMat('mount-tape', () => new THREE.MeshStandardMaterial({ color: 0xf3e2a6, roughness: 0.55, transparent: true, opacity: 0.85 }));
const CHROME = () => std(0xd8dde2, 0.18, 0.95, null, 'chrome');

// ------------------------------------------------------------------ snail
function buildSnail(R) {
  const root = R.root;
  const body = group(); root.add(body);
  // slug body
  const slug = cachedGeo('snail:body', () => {
    const P = new Parts();
    P.add(G.sphere(28, 16), (p, n, out) => out.set(n.y < -0.25 ? 0xe8e9a8 : 0xc4d65f).lerp(new THREE.Color(0x9fb84a), Math.max(0, n.y) * 0.3), [0, 0.2, -0.05], null, [0.42, 0.24, 0.98]);
    // neck + head
    P.add(G.capsule(0.3, 0.2), 0xc4d65f, [0, 0.42, 0.72], [0.55, 0, 0]);
    P.add(G.sphere(20, 14), 0xc9db66, [0, 0.62, 0.86], null, [0.24, 0.22, 0.24]);
    // smile + cheeks
    P.add(G.torus(0.09, 0.016, 6, 16, PI), 0x4a3b2a, [0, 0.56, 1.08], [0.1, 0, PI]);
    for (const sx of [-1, 1]) P.add(G.sphere(10, 8), 0xf09a8a, [sx * 0.15, 0.6, 1.02], null, [0.04, 0.025, 0.015]);
    return P.build();
  });
  const bodyM = mesh(slug, VC()); bodyM.castShadow = true; body.add(bodyM);
  // eye stalks with googly eyes (springy)
  const stalks = [];
  for (const sx of [-1, 1]) {
    const piv = group([sx * 0.09, 0.78, 0.86]);
    piv.add(mesh(G.cyl(8), felt(0xc4d65f), [0, 0.15, 0], null, [0.025, 0.3, 0.025]));
    const eye = googlyEye(0.075); eye.position.set(0, 0.32, 0.02); piv.add(eye);
    body.add(piv); stalks.push({ piv, sx, a: 0, v: 0 });
  }
  // shell: a coiled tube (cinnamon roll), spiral bands
  const shellGeo = cachedGeo('snail:shell', () => {
    const pts = [];
    const turns = 2.6, N = 90;
    for (let i = 0; i <= N; i++) {
      const u = i / N, th = u * turns * TAU, r = 0.04 + u * 0.34;
      pts.push(new THREE.Vector3(0, Math.sin(th) * r, Math.cos(th) * r));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tube = new THREE.TubeGeometry(curve, 140, 1, 12, false);
    // radius grows along the spiral: rescale around the centreline
    const pos = tube.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const seg = Math.floor(i / 13), u = seg / 140;
      const cp = curve.getPointAt(Math.min(1, u));
      const rad = 0.035 + u * 0.19;
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const dx = x - cp.x, dy = y - cp.y, dz = z - cp.z;
      pos.setXYZ(i, cp.x + dx * rad * 1.35, cp.y + dy * rad, cp.z + dz * rad);
      c.set(Math.floor(u * 26) % 2 ? 0xd08a4a : 0xe7b06a);
      if (u > 0.92) c.set(0xb86d35);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    tube.setAttribute('color', new THREE.BufferAttribute(col, 3));
    tube.computeVertexNormals();
    return tube;
  });
  const shell = group([0, 0.72, -0.2]); body.add(shell);
  const shellM = mesh(shellGeo, VC(), null, [0, 0, 0], [1, 1, 1]); shellM.castShadow = true; shell.add(shellM);
  // fill the middle so it reads as a solid shell
  shell.add(mesh(G.sphere(18, 12), felt(0xd99a55), [0, 0, 0], null, [0.24, 0.42, 0.42]));
  // racing flames on both sides
  for (const sx of [-1, 1]) {
    const f = mesh(flameDecalGeo(), VC(), [sx * 0.3, -0.12, 0.18], [0, sx * PI / 2, -PI / 2 - 0.25], 1.15);
    if (sx < 0) f.scale.x = -1.15;
    shell.add(f);
  }
  // "turbo" number plate
  shell.add(mesh(G.box(), felt(0xffffff), [0, 0.45, -0.05], [0.2, 0, 0], [0.12, 0.08, 0.18]));
  // exhaust pipes
  const flames = [], mats = exhaustFlameMats();
  for (const sx of [-1, 1]) {
    const pipe = group([sx * 0.16, 0.5, -0.55], [-0.35, 0, 0]);
    pipe.add(mesh(G.cyl(12), CHROME(), [0, 0, 0], [PI / 2, 0, 0], [0.06, 0.32, 0.06]));
    pipe.add(mesh(G.torus(0.06, 0.018, 6, 14), CHROME(), [0, 0, -0.16]));
    const fo = mesh(G.cone(10), mats[0], [0, 0, -0.32], [-PI / 2, 0, 0], [0.07, 0.3, 0.07]);
    const fi = mesh(G.cone(10), mats[1], [0, 0, -0.27], [-PI / 2, 0, 0], [0.04, 0.18, 0.04]);
    pipe.add(fo, fi); body.add(pipe);
    flames.push({ fo, fi, pipe });
  }
  R.mats.push(...mats);
  R.seat.set(0, 1.08, -0.18);
  R.update = (dt, s, st) => {
    const sp = s.speed || 0, T = st.t;
    const ph = T * (3 + sp * 0.6);
    // undulating slug + bouncy shell
    bodyM.scale.set(1, 1 + Math.sin(ph * 2) * 0.03, 1 + Math.sin(ph) * 0.04);
    const bob = Math.abs(Math.sin(ph)) * 0.05 * Math.min(1, sp / 6);
    shell.position.y = 0.72 + bob; shell.rotation.x = Math.sin(ph) * 0.05;
    st.ride.bob = bob * 1.1; st.ride.pitch = Math.sin(ph) * 0.04;
    for (const k of stalks) {
      const target = -0.25 * Math.min(1, sp / 10) + k.sx * s.turning * 0.25;
      k.v += ((target - k.a) * 120 - k.v * 8) * dt + Math.sin(ph * 2 + k.sx) * dt * 2;
      k.a += k.v * dt;
      k.piv.rotation.set(k.a, 0, k.sx * 0.25 + s.turning * 0.2);
    }
    const f = 0.6 + Math.min(1.6, sp / 8);
    for (const fl of flames) {
      const fk = f * (0.8 + Math.random() * 0.4);
      fl.fo.scale.set(0.07 * fk, 0.32 * fk, 0.07 * fk); fl.fo.position.z = -0.16 - 0.16 * fk;
      fl.fi.scale.set(0.04 * fk, 0.2 * fk, 0.04 * fk); fl.fi.position.z = -0.16 - 0.1 * fk;
    }
    if (Math.random() < 0.35 * f) { const p = flames[Math.random() < 0.5 ? 0 : 1].pipe; R.puff(p, 0, 0, -0.4, 0x8a8a8a, 0.18); }
  };
}

// ------------------------------------------------------------------ camel
function buildCamel(R) {
  const root = R.root;
  const TAN = 0xd9a865, DARK = 0xb98a50, LIGHT = 0xe8c48c;
  const body = group([0, 0, 0]); root.add(body);
  const torso = cachedGeo('camel:torso', () => {
    const P = new Parts();
    P.add(G.sphere(26, 16), (p, n, out) => out.set(n.y < -0.4 ? LIGHT : TAN), [0, 1.05, 0], null, [0.42, 0.4, 0.82]);
    // tail
    P.add(G.cyl(6), DARK, [0, 1.0, -0.86], [-0.5, 0, 0], [0.03, 0.4, 0.03]);
    P.add(G.sphere(8, 6), 0x6b4a2a, [0, 0.82, -0.96], null, [0.05, 0.1, 0.05]);
    return P.build();
  });
  const torsoM = mesh(torso, VC()); torsoM.castShadow = true; body.add(torsoM);
  // saddle blanket (Tunisian kilim stripes)
  const kilim = cachedTex('camel-kilim', 64, 128, (g, w, h) => {
    const cols = ['#c8303a', '#f2d27a', '#2f6fd6', '#f2d27a', '#c8303a', '#1d6b4f'];
    for (let i = 0; i < 16; i++) { g.fillStyle = cols[i % cols.length]; g.fillRect(0, (i / 16) * h, w, h / 16 + 1); }
    g.fillStyle = '#fff3d0';
    for (let i = 0; i < 4; i++) { const y = (i + 0.5) * h / 4; g.beginPath(); g.moveTo(w / 2, y - 9); g.lineTo(w / 2 + 9, y); g.lineTo(w / 2, y + 9); g.lineTo(w / 2 - 9, y); g.fill(); }
  });
  const kilimMat = cachedMat('camel-kilim', () => new THREE.MeshStandardMaterial({ map: kilim, color: kilim ? 0xffffff : 0xc8303a, roughness: 0.9, side: THREE.DoubleSide }));
  const blanket = cachedGeo('camel:blanket', () => {
    // a draped U shape over the back
    const g = new THREE.CylinderGeometry(0.44, 0.44, 0.62, 18, 1, true, -PI * 0.42, PI * 0.84);
    g.rotateX(-PI / 2); // arc on top, axis along the body
    return g;
  });
  const bl = mesh(blanket, kilimMat, [0, 1.06, 0]); body.add(bl);
  // humps (jiggly)
  const humps = [];
  for (const z of [0.42, -0.42]) {
    const h = mesh(G.sphere(18, 12), felt(TAN), [0, 1.36, z], null, [0.3, 0.34, 0.3]);
    h.castShadow = true; body.add(h); humps.push({ m: h, a: 0, v: 0, z });
  }
  // neck + head
  const neck = group([0, 1.2, 0.7]); body.add(neck);
  neck.add(mesh(G.capsule(0.55, 0.13), felt(TAN), [0, 0.32, 0.12], [0.45, 0, 0]));
  const head = group([0, 0.72, 0.32]); neck.add(head);
  const headGeo = cachedGeo('camel:head', () => {
    const P = new Parts();
    P.add(G.sphere(18, 12), TAN, [0, 0, 0.05], null, [0.17, 0.16, 0.24]);
    P.add(G.sphere(16, 12), LIGHT, [0, -0.05, 0.27], null, [0.14, 0.11, 0.14]); // snout
    P.add(G.sphere(10, 8), 0x5a3a20, [0.06, -0.02, 0.38], null, [0.02, 0.012, 0.012]);
    P.add(G.sphere(10, 8), 0x5a3a20, [-0.06, -0.02, 0.38], null, [0.02, 0.012, 0.012]);
    P.add(G.sphere(12, 8), 0xc89060, [0, -0.13, 0.3], null, [0.11, 0.04, 0.1]); // droopy lip
    for (const sx of [-1, 1]) P.add(G.sphere(10, 8), DARK, [sx * 0.15, 0.12, -0.05], [0, 0, sx * 0.6], [0.04, 0.08, 0.03]);
    // tuft
    P.add(G.sphere(10, 8), 0x8a6238, [0, 0.16, 0.02], null, [0.08, 0.05, 0.08]);
    return P.build();
  });
  head.add(mesh(headGeo, VC()));
  // sunglasses
  const shades = group([0, 0.05, 0.2]); head.add(shades);
  const lens = std(0x14141c, 0.08, 0.6, null, 'shades');
  for (const sx of [-1, 1]) {
    shades.add(mesh(G.cyl(16), lens, [sx * 0.09, 0, 0], [PI / 2, 0, 0], [0.075, 0.02, 0.06]));
    shades.add(mesh(G.box(), basic(0xff9be6, null, 'shine-pink'), [sx * 0.09 + 0.025, 0.02, 0.012], [0, 0, -0.6], [0.05, 0.008, 0.002]));
  }
  shades.add(mesh(G.box(), lens, [0, 0.01, 0], null, [0.06, 0.012, 0.012]));
  for (const sx of [-1, 1]) shades.add(mesh(G.box(), lens, [sx * 0.165, 0.01, -0.12], [0, sx * 0.25, 0], [0.012, 0.012, 0.24]));
  // legs
  const legs = [];
  const legGeoU = cachedGeo('camel:legU', () => { const P = new Parts(); P.add(G.capsule(0.32, 0.085), TAN, [0, -0.22, 0]); return P.build(); });
  const legGeoL = cachedGeo('camel:legL', () => { const P = new Parts(); P.add(G.capsule(0.3, 0.06), TAN, [0, -0.2, 0]); P.add(G.sphere(12, 8), 0x7a5a3a, [0, -0.42, 0.03], null, [0.09, 0.05, 0.12]); return P.build(); });
  [[0.24, 0.5, 0], [-0.24, 0.5, PI], [0.24, -0.5, PI * 0.6], [-0.24, -0.5, PI * 1.6]].forEach(([x, z, ph]) => {
    const hip = group([x, 0.95, z]); body.add(hip);
    hip.add(mesh(legGeoU, VC()));
    const knee = group([0, -0.44, 0]); hip.add(knee);
    knee.add(mesh(legGeoL, VC()));
    hip.children.forEach((c) => { c.castShadow = true; });
    legs.push({ hip, knee, ph });
  });
  R.seat.set(0, 1.42, 0);
  R.update = (dt, s, st) => {
    const sp = s.speed || 0, T = st.t;
    st.gait = (st.gait || 0) + dt * (2 + sp * 0.75);
    const g = st.gait, k = Math.min(1, sp / 8);
    for (const L of legs) {
      const a = Math.sin(g + L.ph);
      L.hip.rotation.x = a * 0.65 * k;
      L.knee.rotation.x = (0.15 + Math.max(0, Math.cos(g + L.ph)) * 1.0) * k;
    }
    const bob = Math.abs(Math.sin(g)) * 0.12 * k;
    body.position.y = bob - 0.06 * k;
    body.rotation.x = Math.sin(g) * 0.06 * k;
    body.rotation.z = -s.turning * 0.08;
    neck.rotation.x = -0.1 + Math.sin(g + 1) * 0.15 * k;
    head.rotation.set(0.05 - Math.sin(g + 1) * 0.12 * k, s.turning * 0.3, 0);
    // humps: spring jiggle driven by the bob acceleration
    for (const h of humps) {
      const force = -Math.cos(g) * 30 * k;
      h.v += (force - h.a * 160 - h.v * 9) * dt;
      h.a += h.v * dt;
      h.m.scale.set(0.3 * (1 - h.a * 0.4), 0.34 * (1 + h.a), 0.3 * (1 - h.a * 0.4));
      h.m.position.y = 1.36 + h.a * 0.1;
      h.m.rotation.z = Math.sin(T * 7 + h.z) * 0.12 * k;
    }
    st.ride.bob = body.position.y; st.ride.pitch = body.rotation.x; st.ride.roll = body.rotation.z;
    if (sp > 2 && Math.random() < 0.25) R.puff(root, (Math.random() - 0.5) * 0.5, 0.05, -0.4, 0xe2c792, 0.3);
  };
}

// ------------------------------------------------------------------ penguin (belly sled)
function buildPenguin(R) {
  const root = R.root;
  const body = group(); root.add(body);
  const BLACK = 0x23262f, WHITE = 0xf3f6fb, ORANGE = 0xf29a2e;
  const geo = cachedGeo('penguin:body', () => {
    const P = new Parts();
    // lying on its belly: black back on top, white belly below
    P.add(G.sphere(26, 18), (p, n, out) => out.set(n.y < -0.05 ? WHITE : BLACK), [0, 0.3, 0], null, [0.38, 0.3, 0.74]);
    // head
    P.add(G.sphere(20, 14), (p, n, out) => out.set(n.z > 0.35 && n.y < 0.55 ? WHITE : BLACK), [0, 0.42, 0.72], null, [0.25, 0.24, 0.24]);
    // beak
    P.add(G.cone(10), ORANGE, [0, 0.37, 1.0], [PI / 2, 0, 0], [0.07, 0.16, 0.05]);
    P.add(G.cone(10), 0xd9801f, [0, 0.33, 0.98], [PI / 2 + 0.25, 0, 0], [0.055, 0.12, 0.035]);
    // grumpy brows (white, angled down to the middle)
    for (const sx of [-1, 1]) P.add(G.box(), WHITE, [sx * 0.08, 0.55, 0.93], [0.2, 0, sx * 0.45], [0.11, 0.03, 0.03]);
    // feet sticking out the back
    for (const sx of [-1, 1]) P.add(G.sphere(10, 8), ORANGE, [sx * 0.13, 0.25, -0.78], [0.6, 0, 0], [0.09, 0.03, 0.14]);
    return P.build();
  });
  const bodyM = mesh(geo, VC()); bodyM.castShadow = true; body.add(bodyM);
  // half-closed grumpy eyes
  const eyes = [];
  for (const sx of [-1, 1]) {
    const e = group([sx * 0.09, 0.47, 0.92]);
    e.add(mesh(G.sphere(12, 8), std(0xffffff, 0.3, 0, null, 'mount-eye'), null, null, [0.05, 0.05, 0.03]));
    e.add(mesh(G.sphere(10, 8), std(0x15131a, 0.2, 0, null, 'mount-pupil'), [0, -0.01, 0.025], null, [0.025, 0.025, 0.012]));
    const lid = mesh(G.sphere(12, 8, ), felt(BLACK), [0, 0.02, 0.006], null, [0.056, 0.035, 0.036]);
    e.add(lid); eyes.push({ e, lid }); body.add(e);
  }
  // flippers
  const flips = [];
  for (const sx of [-1, 1]) {
    const piv = group([sx * 0.34, 0.32, 0.2]); body.add(piv);
    piv.add(mesh(G.sphere(12, 8), felt(BLACK), [sx * 0.18, 0, -0.05], [0, 0, 0], [0.2, 0.04, 0.1]));
    flips.push({ piv, sx });
  }
  R.seat.set(0, 0.58, -0.15);
  R.update = (dt, s, st) => {
    const sp = s.speed || 0, T = st.t;
    body.rotation.z = -s.turning * 0.22 + Math.sin(T * 9) * 0.02;
    body.rotation.x = Math.sin(T * 6) * 0.015 + (s.jumping ? -0.12 : 0);
    body.position.y = Math.abs(Math.sin(T * 12)) * 0.015 * Math.min(1, sp / 8);
    for (const f of flips) f.piv.rotation.set(0, 0, f.sx * (0.15 + Math.max(0, f.sx * s.turning) * 0.9 + Math.sin(T * 20) * 0.08 * Math.abs(s.turning)));
    // grumpy blink / glare
    const glare = (Math.sin(T * 0.9) > 0.85) ? 0.55 : 1;
    for (const e of eyes) e.lid.position.y = 0.02 - (1 - glare) * 0.02;
    st.ride.bob = body.position.y; st.ride.roll = body.rotation.z * 0.8; st.ride.pitch = body.rotation.x;
    if (sp > 2) for (const sx of [-1, 1]) if (Math.random() < 0.6) R.puff(root, sx * 0.32, 0.04, 0.55, 0xffffff, 0.09, sx * 1.8);
  };
}

// ------------------------------------------------------------------ rocket (cardboard)
function buildRocket(R) {
  const root = R.root;
  const body = group([0, 0.65, 0]); root.add(body);
  const tex = cardboardTex('FUSÉE');
  const cardMat = cachedMat('rocket-card', () => new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : 0xc99862, roughness: 0.9 }));
  const plain = felt(0xc99862, 0.92, 0.08);
  const hull = mesh(G.cyl(24), cardMat, [0, 0, 0], [PI / 2, PI / 2, 0], [0.32, 1.5, 0.32]);
  hull.castShadow = true; body.add(hull);
  const nose = mesh(G.cone(24), felt(0xd6342b, 0.85, 0.08), [0, 0, 1.0], [PI / 2, 0, 0], [0.32, 0.5, 0.32]); nose.castShadow = true; body.add(nose);
  body.add(mesh(G.cyl(24), plain, [0, 0, -0.78], [PI / 2, 0, 0], [0.3, 0.06, 0.3]));
  // fins
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + PI / 2;
    const f = mesh(G.box(), felt(0x2f6fd6, 0.85, 0.08), [Math.cos(a) * 0.4, Math.sin(a) * 0.4, -0.55], [0, 0, a], [0.28, 0.03, 0.4]);
    f.castShadow = true; body.add(f);
  }
  // masking tape rings + patch
  for (const z of [0.55, -0.45]) body.add(mesh(G.cyl(24), TAPE(), [0, 0, z], [PI / 2, 0, 0], [0.327, 0.07, 0.327]));
  body.add(mesh(G.box(), TAPE(), [0.2, 0.25, 0.1], [0.4, 0, 0.6], [0.22, 0.05, 0.01]));
  // handlebar (a wooden spoon, of course)
  body.add(mesh(G.cyl(8), felt(0xc58c5a), [0, 0.4, 0.45], [0, 0, PI / 2], [0.025, 0.5, 0.025]));
  body.add(mesh(G.cyl(8), felt(0xc58c5a), [0, 0.35, 0.45], null, [0.025, 0.12, 0.025]));
  // flames
  const mats = exhaustFlameMats(); R.mats.push(...mats);
  const fo = mesh(G.cone(14), mats[0], [0, 0, -1.2], [-PI / 2, 0, 0], [0.24, 0.8, 0.24]);
  const fi = mesh(G.cone(14), mats[1], [0, 0, -1.0], [-PI / 2, 0, 0], [0.14, 0.5, 0.14]);
  body.add(fo, fi);
  R.seat.set(0, 0.94, -0.15);
  R.update = (dt, s, st) => {
    const sp = s.speed || 0, T = st.t;
    body.position.y = 0.65 + Math.sin(T * 5) * 0.05 + (Math.random() - 0.5) * 0.012 * Math.min(1, sp / 6);
    body.rotation.z = -s.turning * 0.35 + Math.sin(T * 3) * 0.03;
    body.rotation.x = (s.jumping ? -0.15 : 0) + Math.sin(T * 4) * 0.02;
    const k = (0.7 + Math.min(1.4, sp / 9)) * (0.85 + Math.random() * 0.3);
    fo.scale.set(0.24, 0.8 * k, 0.24); fo.position.z = -0.8 - 0.4 * k;
    fi.scale.set(0.14, 0.5 * k, 0.14); fi.position.z = -0.8 - 0.25 * k;
    st.ride.bob = body.position.y - 0.65; st.ride.roll = body.rotation.z; st.ride.pitch = body.rotation.x;
    if (Math.random() < 0.6) R.puff(body, (Math.random() - 0.5) * 0.2, (Math.random() - 0.5) * 0.2, -1.3, Math.random() < 0.5 ? 0xffb347 : 0x9a9a9a, 0.25);
  };
}

const BUILDERS = { snail: buildSnail, camel: buildCamel, penguin: buildPenguin, rocket: buildRocket };

export function createMount(kind = 'snail') {
  if (!BUILDERS[kind]) kind = 'snail';
  const root = group(null, null, `mount-${kind}`);
  const parts = new Particles(56);
  root.add(parts.points);
  const tmp = new THREE.Vector3();
  const R = {
    root, seat: new THREE.Vector3(0, 0.5, 0), mats: [], update: null,
    /** smoke / snow / dust puff from a local point of `obj`, drifting back */
    puff(obj, x, y, z, color, size = 0.2, side = 0) {
      tmp.set(x, y, z); obj.localToWorld(tmp);
      parts.emit(tmp.x, tmp.y, tmp.z, { vx: (Math.random() - 0.5) * 0.6 + side * 0.5, vy: 0.4 + Math.random() * 0.5, vz: (Math.random() - 0.5) * 0.6, drag: 2, g: -0.2, life: 0.6, s0: size, s1: size * 2.2, color, a: 0.6, frame: FRAME.puff });
    },
  };
  BUILDERS[kind](R);
  const st = { t: 0, ride: { kind, bob: 0, pitch: 0, roll: 0 } };
  root.userData.ride = st.ride;
  return {
    object3d: root,
    seat: R.seat,
    kind,
    update(dt, s = {}) {
      dt = Math.min(dt || 0, 0.05);
      st.t += dt;
      R.update(dt, { speed: s.speed || 0, turning: clamp(s.turning || 0, -1, 1), jumping: !!s.jumping }, st);
      root.updateWorldMatrix(true, false);
      parts.update(dt, root);
    },
    dispose() { parts.dispose(); R.mats.forEach((m) => m.dispose()); disposeOwned(root); },
  };
}
