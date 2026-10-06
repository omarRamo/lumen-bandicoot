// Lumen — procedural model (hierarchy of joints). Built from shared, merged, vertex-coloured geometries
// (one draw call per bone) so the whole fox costs ~30 draw calls. Coordinates in "build units":
// feet at y=0, facing +Z; the root applies SCALE so Lumen is ~1.1 m tall (head top), ~1.35 m to the ear tips.
import * as THREE from 'three';
import {
  PAL, PI, TAU, V3, G, Parts, cachedGeo, felt, feltVC, glow, basic, std, LUMEN_RIM, mesh, group,
  ellipsoidSurf, faceQ, sparkleShape, leafShape, extrude, star5Shape, qFromTo, lerp, smooth,
} from './lumen-kit.js';

export const SCALE = 0.9;
export const DIM = {
  hipsY: 0.30, neckY: 0.37, headC: [0, 0.255, 0.01], headR: 0.3, headSc: [1.13, 0.95, 0.98],
  shoulder: [0.2, 0.27, 0.0], upper: 0.13, fore: 0.12, hip: [0.1, 0, 0], thigh: 0.12, shin: 0.12,
  centerY: 0.55, // salto pivot height
};

const C = (h) => new THREE.Color(h);
const TEAL = C(PAL.teal), DEEP = C(PAL.deep), CREAM = C(PAL.cream);
const Y_UP = V3(0, 1, 0);

// ------------------------------------------------------------------ shared geometries
function headGeo() {
  return cachedGeo('lumen:head', () => {
    const R = DIM.headR, sc = DIM.headSc;
    const P = new Parts();
    const tmp = new THREE.Color();
    // two-tone head: cream face/cheeks, teal "hood" on top & back (reads as a fox from behind)
    P.add(G.sphere(40, 28), (p, n, out) => {
      const peak = Math.max(0, 1 - Math.abs(n.x) * 3.2) * 0.22; // little widow's peak towards the brow star
      const f = n.z + 0.15 - 0.18 * n.y - 1.0 * Math.max(0, n.y - 0.3) - peak * (n.y > 0.25 ? 1 : 0);
      const k = smooth((f + 0.07) / 0.14);
      out.copy(TEAL).lerp(CREAM, k);
      // a hint of deeper teal at the nape
      if (n.z < -0.5) out.lerp(DEEP, Math.min(0.5, (-n.z - 0.5) * 1.2) * smooth((0.1 - n.y) / 0.6));
      return tmp;
    }, [0, 0, 0], null, [R * sc[0], R * sc[1], R * sc[2]]);
    const surf = ellipsoidSurf(R, sc);
    // cheeks
    for (const sx of [-1, 1]) {
      const { p, n } = surf(sx * 0.66, -0.17, 0.004);
      P.add(G.sphere(14, 10), PAL.cheek, [p.x, p.y, p.z], faceQ(n), [0.056, 0.033, 0.014]);
    }
    return P.build();
  });
}
function earGeo() {
  return cachedGeo('lumen:ear', () => {
    const size = 0.3;
    const P = new Parts();
    P.add(extrude(leafShape(size, 1), size * 0.16, 0, 14), PAL.deep);
    P.add(extrude(leafShape(size * 0.64, 0.92), size * 0.06, 0, 14), PAL.leaf, [0, size * 0.17, size * 0.09 + 0.014]);
    // central vein (leaf!)
    P.add(G.cyl(5), 0x86c9ad, [0, size * 0.55, size * 0.125 + 0.016], null, [0.006, size * 0.6, 0.004]);
    const g = P.build();
    // cup the leaf (edges forward) and curve it back towards the tip: volume from the side
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), v = y / (size * 1.5);
      pos.setZ(i, z + 1.1 * x * x - 0.05 * v * v);
    }
    return g;
  });
}
function torsoGeo() {
  return cachedGeo('lumen:torso', () => {
    const P = new Parts();
    const tw = [0.225, 0.25, 0.205];
    P.add(G.sphere(26, 18), PAL.teal, [0, 0.16, 0], null, tw);
    // belly
    const bc = [0, 0.135, 0.075], br = [0.155, 0.18, 0.145];
    P.add(G.sphere(22, 16), PAL.belly, bc, null, br);
    // dotted belly stitches (like the 2D art)
    for (let i = 0; i <= 12; i++) {
      const a = (160 + (i / 12) * 220) * PI / 180;
      const u = Math.cos(a) * 0.82, v = Math.sin(a) * 0.82;
      const z = br[2] * Math.sqrt(Math.max(0, 1 - u * u - v * v));
      P.add(G.sphere(6, 4), PAL.bellyStitch, [bc[0] + u * br[0], bc[1] + v * br[1], bc[2] + z + 0.004], null, [0.011, 0.011, 0.006]);
    }
    // shoulders
    for (const sx of [-1, 1]) P.add(G.sphere(12, 10), PAL.teal, [sx * DIM.shoulder[0] * 0.95, DIM.shoulder[1] + 0.005, 0], null, 0.07);
    return P.build();
  });
}
function upperArmGeo() {
  return cachedGeo('lumen:upperArm', () => { const P = new Parts(); P.add(G.capsule(0.07, 0.052), PAL.teal, [0, -0.065, 0]); return P.build(); });
}
function foreArmGeo() {
  return cachedGeo('lumen:foreArm', () => {
    const P = new Parts();
    P.add(G.capsule(0.06, 0.048), PAL.teal, [0, -0.05, 0]);
    // paw (cream glove-ish mitten) + thumb
    P.add(G.sphere(14, 10), PAL.cream, [0, -0.125, 0.005], null, [0.066, 0.062, 0.06]);
    P.add(G.sphere(10, 8), PAL.cream, [0, -0.1, 0.05], null, [0.026, 0.03, 0.028]);
    return P.build();
  });
}
function thighGeo() {
  return cachedGeo('lumen:thigh', () => { const P = new Parts(); P.add(G.capsule(0.05, 0.064), PAL.teal, [0, -0.06, 0]); return P.build(); });
}
function shinGeo() {
  return cachedGeo('lumen:shin', () => {
    const P = new Parts();
    P.add(G.capsule(0.06, 0.054), PAL.deep, [0, -0.055, 0]);
    return P.build();
  });
}
function shoeGeo() {
  return cachedGeo('lumen:shoe', () => {
    const P = new Parts();
    // chunky sneaker: dark teal upper, cream sole (flashes when running away from the camera), coral tongue
    P.add(G.sphere(18, 12), PAL.feet, [0, 0.0, 0.04], null, [0.088, 0.07, 0.13]);
    P.add(G.sphere(18, 8), PAL.cream, [0, -0.04, 0.04], null, [0.094, 0.03, 0.138]);
    P.add(G.sphere(10, 8), PAL.scarf, [0, 0.055, 0.0], null, [0.04, 0.03, 0.035]);
    P.add(G.box(), 0xfff3d0, [0, 0.045, 0.085], [0.5, 0, 0], [0.07, 0.012, 0.03]);
    return P.build();
  });
}
function tailGeo() {
  return cachedGeo('lumen:tail', () => {
    // bushy teardrop tail (lathe), bent upwards, cream tip
    const prof = [];
    const N = 14, L = 0.42;
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const r = 0.04 + Math.sin(Math.pow(u, 0.7) * PI) * 0.095;
      prof.push(new THREE.Vector2(Math.max(0.004, u >= 1 ? 0.004 : r), u * L));
    }
    const g = new THREE.LatheGeometry(prof, 14);
    const pos = g.attributes.position, col = new Float32Array(pos.count * 3), c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), u = y / L;
      // curve: centreline (0, cy, cz)
      // centreline: leaves the body backwards, then curls up (a fox brush)
      const cy = (1 - Math.cos(u * 1.9)) * L * 0.42, cz = -Math.sin(u * 1.9) * L * 0.5;
      const t = Math.sin(u * 1.9) * 1.9 * 0.42, w = -Math.cos(u * 1.9) * 1.9 * 0.5; // tangent (y,z)
      const tl = Math.hypot(t, w), ny = -w / tl, nz = t / tl; // normal in the YZ plane
      pos.setXYZ(i, x, cy + z * ny, cz + z * nz);
      c.set(u > 0.78 ? PAL.cream : PAL.teal);
      if (u > 0.72 && u <= 0.78) c.set(PAL.teal).lerp(new THREE.Color(PAL.cream), (u - 0.72) / 0.06);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.computeVertexNormals();
    return g;
  });
}
function wrapStitchGeo() {
  return cachedGeo('lumen:wrapStitch', () => {
    const P = new Parts();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * TAU;
      P.add(G.sphere(6, 4), PAL.stitch, [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], null, [0.013, 0.013, 0.013]);
    }
    return P.build();
  });
}
export function sparkleGeo(r, depth) { return cachedGeo(`sparkle:${r}:${depth}`, () => extrude(sparkleShape(r, 0.24), depth, depth * 0.4, 6)); }
export function star5Geo(r, depth) { return cachedGeo(`star5:${r}:${depth}`, () => extrude(star5Shape(r, r * 0.45), depth, depth * 0.3, 2)); }
export function leafGeo(size, w, depth) { return cachedGeo(`leaf:${size}:${w}:${depth}`, () => extrude(leafShape(size, w), depth, depth * 0.3, 8)); }

// ------------------------------------------------------------------ materials (shared)
export const LM = {
  get body() { return feltVC(LUMEN_RIM, 0.05); },
  get eye() { return std(PAL.eye, 0.22, 0.05, null, 'lumen-eye'); },
  get shine() { return basic(0xffffff, null, 'shine'); },
  get mouth() { return std(PAL.mouth, 0.5, 0, null, 'lumen-mouth'); },
  get mouthIn() { return std(0x7a3140, 0.6, 0, null, 'lumen-mouthin'); },
  get brow() { return glow(PAL.starGold, 0.45, 'brow'); },
  get chest() { return glow(PAL.chestStar, 0.35, 'chest'); },
  get core() { return glow(PAL.core, 0.6, 'core'); },
  get stitch() { return felt(PAL.stitch, 0.7, 0.15, LUMEN_RIM); },
  scarf(color) { return felt(color, 0.85, 0.12, LUMEN_RIM); },
};

/** Builds one Lumen. Returns the joint map. */
export function buildLumen(scarfColor) {
  const J = {};
  const root = group(null, null, 'lumen');
  const fxPivot = group(null, null, 'lumen-fxpivot');        // death transforms (pivot anywhere)
  fxPivot.rotation.order = 'YXZ';
  const squash = group(null, null, 'lumen-squash');          // squash & stretch about the feet
  const mover = group([0, DIM.centerY, 0], null, 'lumen-mover'); // rotation about the body centre
  const base = group([0, -DIM.centerY, 0], null, 'lumen-base');
  root.add(fxPivot); fxPivot.add(squash); squash.add(mover); mover.add(base);
  squash.scale.setScalar(SCALE);
  Object.assign(J, { root, fxPivot, squash, mover, base });
  const bodyMeshes = [];
  const reg = (m, cast = true) => { m.castShadow = cast; bodyMeshes.push(m); return m; };

  const hips = group([0, DIM.hipsY, 0], null, 'hips'); base.add(hips);
  const torso = group(null, null, 'torso'); hips.add(torso);
  reg(mesh(torsoGeo(), LM.body)); torso.add(bodyMeshes[bodyMeshes.length - 1]);
  // chest star (on the belly)
  const chest = reg(mesh(sparkleGeo(0.07, 0.018), LM.chest, [0, 0.165, 0.222], [-0.12, 0, 0]), false);
  torso.add(chest);
  const core = reg(mesh(G.sphere(8, 6), LM.core, [0, 0.165, 0.235], null, [0.017, 0.017, 0.008]), false);
  torso.add(core);
  // scarf wrap + knot
  const wrap = reg(mesh(G.torus(0.165, 0.064, 10, 24), LM.scarf(scarfColor), [0, DIM.neckY - 0.005, 0.0], [PI / 2 + 0.16, 0, 0], [1.06, 1, 0.95]));
  torso.add(wrap);
  const wrapStitch = reg(mesh(wrapStitchGeo(), LM.stitch, [0, DIM.neckY + 0.002, 0.0], [0.16, 0, 0], [1.06, 1, 0.95]), false);
  torso.add(wrapStitch);
  const knot = reg(mesh(G.sphere(12, 10), LM.scarf(scarfColor), [0.1, DIM.neckY - 0.035, -0.15], null, [0.07, 0.06, 0.055]));
  torso.add(knot);
  const knotAnchor = group([0.11, DIM.neckY - 0.05, -0.18]); torso.add(knotAnchor);

  // ---- head
  const neck = group([0, DIM.neckY, 0], null, 'neck'); torso.add(neck);
  const head = group([DIM.headC[0], DIM.headC[1], DIM.headC[2]], null, 'head'); neck.add(head);
  const headMesh = reg(mesh(headGeo(), LM.body)); head.add(headMesh);
  const surf = ellipsoidSurf(DIM.headR, DIM.headSc);
  {
    const { p, n } = surf(0, 0.6, 0.006);
    const bs = mesh(sparkleGeo(0.062, 0.016), LM.brow, [p.x, p.y, p.z]);
    bs.quaternion.copy(faceQ(n));
    head.add(reg(bs, false));
    J.brow = bs;
  }
  // eyes
  const eyes = [];
  for (const sx of [-1, 1]) {
    const { p, n } = surf(sx * 0.3, 0.06, -0.012);
    const eg = group([p.x, p.y, p.z], null, sx > 0 ? 'eyeL' : 'eyeR');
    eg.quaternion.copy(faceQ(n, sx * 0.05));
    const lid = group(); eg.add(lid); // scaled for blinks
    const ball = mesh(G.sphere(16, 12), LM.eye, [0, 0, 0], null, [0.05, 0.085, 0.032]);
    const sh1 = mesh(G.sphere(10, 8), LM.shine, [0.017, 0.032, 0.022], null, [0.017, 0.024, 0.01]);
    const sh2 = mesh(G.sphere(8, 6), LM.shine, [-0.014, -0.036, 0.024], null, [0.009, 0.01, 0.006]);
    lid.add(ball, sh1, sh2);
    // X eyes (death)
    const xg = group([0, 0, 0.02]); xg.visible = false;
    xg.add(mesh(G.box(), LM.eye, [0, 0, 0], [0, 0, 0.75], [0.1, 0.022, 0.012]));
    xg.add(mesh(G.box(), LM.eye, [0, 0, 0], [0, 0, -0.75], [0.1, 0.022, 0.012]));
    eg.add(xg);
    // happy closed arc (^) for dances
    const arc = mesh(G.torus(0.035, 0.011, 6, 14, PI), LM.eye, [0, -0.01, 0.02], null, [1, 1.1, 1]); arc.visible = false;
    eg.add(arc);
    head.add(eg);
    eyes.push({ g: eg, lid, ball, sh1, sh2, x: xg, arc, base: eg.position.clone(), side: sx });
    bodyMeshes.push(ball);
  }
  // mouth
  const mouthP = surf(0, -0.3, 0.003);
  const mouth = group([mouthP.p.x, mouthP.p.y, mouthP.p.z], null, 'mouth');
  mouth.quaternion.copy(faceQ(mouthP.n));
  const smile = mesh(G.torus(0.048, 0.014, 8, 18, PI), LM.mouth, [0, 0.012, 0], [0, 0, PI], [1, 0.62, 1]);
  const open = mesh(G.sphere(14, 10), LM.mouthIn, [0, -0.005, -0.004], null, [0.045, 0.05, 0.02]);
  const tongue = mesh(G.sphere(10, 8), std(0xf08c8c, 0.6, 0, null, 'tongue'), [0, -0.03, 0.006], null, [0.03, 0.017, 0.012]);
  open.visible = false; tongue.visible = false;
  mouth.add(smile, open, tongue);
  head.add(mouth);
  bodyMeshes.push(smile, open);
  // ears
  const ears = [];
  for (const sx of [-1, 1]) {
    const e = group([sx * 0.12, 0.14, -0.05], null, sx > 0 ? 'earL' : 'earR');
    const m = reg(mesh(earGeo(), LM.body)); e.add(m);
    head.add(e);
    ears.push({ g: e, m, side: sx, tilt: -0.22, splay: 0.52 });
  }
  // ---- arms (L = +X)
  const arms = [];
  for (const sx of [1, -1]) {
    const sh = group([sx * DIM.shoulder[0], DIM.shoulder[1], DIM.shoulder[2]], null, sx > 0 ? 'shoulderL' : 'shoulderR');
    sh.rotation.order = 'YXZ';
    const up = reg(mesh(upperArmGeo(), LM.body)); sh.add(up);
    const el = group([0, -DIM.upper, 0], null, 'elbow'); sh.add(el);
    const fo = reg(mesh(foreArmGeo(), LM.body)); el.add(fo);
    const hand = group([0, -0.125, 0.0], null, 'hand'); el.add(hand);
    torso.add(sh);
    arms.push({ sh, el, hand, up, fo, side: sx });
  }
  // ---- legs
  const legs = [];
  for (const sx of [1, -1]) {
    const hp = group([sx * DIM.hip[0], 0, 0], null, sx > 0 ? 'hipL' : 'hipR'); hp.rotation.order = 'YXZ';
    const th = reg(mesh(thighGeo(), LM.body)); hp.add(th);
    const kn = group([0, -DIM.thigh, 0], null, 'knee'); hp.add(kn);
    const sn = reg(mesh(shinGeo(), LM.body)); kn.add(sn);
    const an = group([0, -DIM.shin, 0], null, 'ankle'); kn.add(an);
    const shoe = reg(mesh(shoeGeo(), LM.body, [0, -0.0, 0.0])); an.add(shoe);
    hips.add(hp);
    legs.push({ hp, kn, an, th, sn, shoe, side: sx });
  }
  // ---- tail
  const tail = group([0, 0.06, -0.16], null, 'tail'); hips.add(tail);
  const tailMesh = reg(mesh(tailGeo(), LM.body)); tail.add(tailMesh);

  Object.assign(J, { hips, torso, neck, head, headMesh, eyes, mouth, smile, open, tongue, ears, arms, legs, tail, tailMesh, wrap, wrapStitch, knot, knotAnchor, chest, core, bodyMeshes });
  return J;
}
