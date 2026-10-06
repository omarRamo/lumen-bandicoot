// The chase boulder (hazard kind 'boulder') for 'chase' levels: it rolls along -Z behind Lumen.
// params: style 'moon'|'tajine'|'snowball'|'roomba' (default from theme), speed (7.0 m/s, a bit less than Lumen's 7.6 run),
//   maxGap (14: farther than that it accelerates to catch up), gap (10: start distance behind the SPAWN and respawn
//   distance behind the checkpoint — def.z is ignored), respawnGap (= gap),
//   delay (1.0 s before it starts rolling), r (radius), lateral (2.5: max sideways drift from def.x), followX (true),
//   suck (roomba: suction m/s, 1.6), grow (snowball: +50 % size), growDist (snowball: 150 m).
// Contact = ctx.game.kill('squash'). Stops when ctx.level.finished. Camera shake + 'rumble' scale with proximity.
import * as THREE from 'three';
import { bus } from '../../core/events.js';
import { _a, clamp, part, group, mat, glow, seeThrough, newBox, setBox, makeEyes, groundAt, family, castShadows, meshesOf } from './enemy-kit.js';

function defaultStyle(theme) {
  const f = family(theme);
  return f === 'desert' ? 'tajine' : f === 'ice' ? 'snowball' : f === 'factory' ? 'roomba' : 'moon';
}

// ------------------------------------------------------------------ models (roll = rotating part, face = stays facing the camera at -Z)
function buildMoon(root, R) {
  const roll = group(root, [0, R, 0]);
  part(roll, 'sphere', 0xf3eac0, R);
  for (let i = 0; i < 11; i++) {
    const a = i * 2.4, u = ((i * 0.37) % 1) * 2 - 1, s = Math.sqrt(1 - u * u);
    const n = _a.set(Math.cos(a) * s, u, Math.sin(a) * s);
    const c = part(roll, 'sphere', 0xd8cc98, [R * 0.22, R * 0.06, R * 0.22], [n.x * R * 0.97, n.y * R * 0.97, n.z * R * 0.97]);
    c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  }
  const face = group(root, [0, R * 1.05, -R * 0.93], [0, Math.PI, 0]);
  const eyes = makeEyes(face, { r: R * 0.17, gap: R * 0.22, y: R * 0.12, z: 0, brows: 0x8a7a4a, pupil: 0.35 });
  eyes.mood('scared');
  const mouth = part(face, 'sphere', glow(0x3a2a1a), [R * 0.16, R * 0.2, R * 0.06], [0, -R * 0.32, 0.02]);
  for (const sx of [-1, 1]) part(face, 'sphere', glow(0xffa0a0, 0.6), [R * 0.1, R * 0.06, 0.02], [sx * R * 0.38, -R * 0.12, 0.02]);
  const drops = [];
  for (const sx of [-1, 1]) drops.push(part(face, 'sphere', seeThrough(0x9fe0ff, 0.8), [R * 0.05, R * 0.08, R * 0.05], [sx * R * 0.45, R * 0.35, 0.05]));
  return { roll, face, eyes, mouth, drops, h: 2 * R };
}

function buildTajine(root, R) {
  const roll = group(root, [0, R, 0]);
  const TERRA = 0xc0643a;
  // dish (wheel in the YZ plane) + conical lid pointing +X
  part(roll, 'cyl20', TERRA, [R, 0.5, R], [-0.35, 0, 0], [0, 0, Math.PI / 2]);
  part(roll, 'torus', 0x2a6fdb, [R * 0.98, R * 0.98, 1.2], [-0.35, 0, 0], [0, Math.PI / 2, 0]);
  const lid = group(roll, [-0.1, 0, 0]);
  part(lid, 'cone16', 0xd9774a, [R * 0.92, R * 1.35, R * 0.92], [R * 0.675, 0, 0], [0, 0, -Math.PI / 2]);
  for (const [k, c] of [[0.2, 0xffd23f], [0.45, 0x2a6fdb], [0.7, 0x3fa55a]]) {
    part(lid, 'torus', c, [R * 0.92 * (1 - k), R * 0.92 * (1 - k), 0.5], [R * 1.35 * k, 0, 0], [0, Math.PI / 2, 0]);
  }
  part(lid, 'sphere', 0xffd23f, R * 0.14, [R * 1.4, 0, 0]);
  const steam = group(root, [R * 0.6, R * 2.0, 0]);
  for (let i = 0; i < 3; i++) part(steam, 'sphere', seeThrough(0xffffff, 0.6), R * (0.12 + i * 0.05), [i * 0.2, i * 0.35, 0]);
  steam.visible = false;
  const face = group(root, [0.2, R * 1.15, -R * 0.98], [0, Math.PI, 0]);
  const eyes = makeEyes(face, { r: R * 0.15, gap: R * 0.2, y: 0, z: 0, color: 0xfff2a0, brows: 0x5a2a10, pupil: 0.5 });
  eyes.mood('angry');
  const mouth = part(face, 'box', glow(0x2a0a05), [R * 0.4, R * 0.12, 0.05], [0, -R * 0.3, 0]);
  return { roll, lid, steam, face, eyes, mouth, h: 2 * R };
}

function buildSnowball(root, R) {
  const roll = group(root, [0, R, 0]);
  part(roll, 'sphere', 0xf4f8ff, R);
  for (let i = 0; i < 8; i++) {
    const a = i * 2.1, u = ((i * 0.53) % 1) * 2 - 1, s = Math.sqrt(1 - u * u);
    part(roll, 'ico', 0xdfefff, R * 0.28, [Math.cos(a) * s * R * 0.92, u * R * 0.92, Math.sin(a) * s * R * 0.92]);
  }
  // penguins stuck in the snow: bodies, flapping feet, panicked eyes
  const stuck = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 1.26 + 0.4, u = [0.5, -0.3, 0.1, 0.8, -0.7][i], s = Math.sqrt(1 - u * u);
    const n = new THREE.Vector3(Math.cos(a) * s, u, Math.sin(a) * s);
    const pg = group(roll, [n.x * R * 0.88, n.y * R * 0.88, n.z * R * 0.88]);
    pg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    pg.scale.setScalar(1.8);
    const out = i % 2 === 0; // head out or feet out
    if (out) {
      part(pg, 'sphere', 0x2b2d42, [0.26, 0.3, 0.24], [0, 0.18, 0]);
      part(pg, 'sphere', 0xffffff, [0.18, 0.2, 0.1], [0, 0.18, 0.16]);
      part(pg, 'cone4', 0xff9a3a, [0.05, 0.14, 0.05], [0, 0.26, 0.26], [Math.PI / 2, 0, 0]);
      const ey = makeEyes(pg, { r: 0.07, gap: 0.08, y: 0.34, z: 0.18 });
      ey.mood('scared');
      const fl = part(pg, 'sphere', 0x2b2d42, [0.05, 0.18, 0.09], [0.26, 0.2, 0], [0, 0, -0.8]);
      stuck.push(fl);
    } else {
      for (const sx of [-1, 1]) {
        const f = part(pg, 'sphere', 0xff9a3a, [0.08, 0.04, 0.14], [sx * 0.1, 0.12, 0]);
        stuck.push(f);
      }
      part(pg, 'sphere', 0x2b2d42, [0.18, 0.12, 0.16], [0, 0.04, 0]);
    }
  }
  return { roll, stuck, h: 2 * R };
}

function buildRoomba(root, R) {
  const body = group(root);
  part(body, 'cyl20', 0x3a3f52, [R, 1.0, R], [0, 0.6, 0]);
  part(body, 'cyl20', 0xb0b8c8, [R * 0.96, 0.12, R * 0.96], [0, 1.15, 0]);
  part(body, 'torus', 0x1c1640, [R, R, 0.8], [0, 0.3, 0], [Math.PI / 2, 0, 0]);
  part(body, 'dome', seeThrough(0x9fe0ff, 0.55), [R * 0.6, R * 0.55, R * 0.6], [0, 1.2, 0.2]);
  part(body, 'sphere', 0x8a7a6a, [R * 0.4, R * 0.25, R * 0.4], [0, 1.25, 0.2]);   // dust inside the bin (yuck)
  const siren = part(body, 'ball', glow(0xff3a3a), 0.22, [0, 1.25 + R * 0.55, 0.2]);
  // front panel facing -Z with angry LED eyes
  const face = group(body, [0, 0.75, -R * 0.97], [0, Math.PI, 0]);
  part(face, 'box', 0x1c1640, [R * 1.1, 0.42, 0.08], [0, 0, -0.02]);
  const eyes = makeEyes(face, { r: 0.17, gap: 0.42, y: 0, z: 0.04, color: 0xff6a6a, brows: 0x1c1640, pupil: 0.4 });
  eyes.mood('angry');
  const brushes = [];
  for (const sx of [-1, 1]) {
    const b = group(body, [sx * R * 0.7, 0.12, -R * 0.75]);
    for (let i = 0; i < 3; i++) part(b, 'box', 0x8a6a4a, [R * 0.7, 0.04, 0.08], [0, 0, 0], [0, (i / 3) * Math.PI, 0]);
    brushes.push(b);
  }
  // dust being sucked in
  const dust = [];
  for (let i = 0; i < 10; i++) {
    const d = part(root, 'ico', mat(0x9a8a7a), 0.08 + Math.random() * 0.06);
    d.userData.k = Math.random();
    d.userData.x = (Math.random() - 0.5) * R * 1.8;
    d.userData.y = 0.1 + Math.random() * 0.8;
    dust.push(d);
  }
  return { body, face, eyes, siren, brushes, dust, h: 2.7 };
}

// ------------------------------------------------------------------ entity
export function createBoulder(def, ctx) {
  const style = def.style || defaultStyle(ctx.theme);
  const R0 = def.r ?? (style === 'roomba' ? 2.3 : style === 'snowball' ? 1.6 : 2.0);
  const root = group(null);
  root.name = `boulder-${style}`;
  const holder = group(root);
  const M = style === 'tajine' ? buildTajine(holder, R0) : style === 'snowball' ? buildSnowball(holder, R0)
    : style === 'roomba' ? buildRoomba(holder, R0) : buildMoon(holder, R0);
  castShadows(holder, ctx, 1);
  const level = ctx.level;
  const spawn = level?.data?.spawn ?? [def.x, def.y, def.z];
  const startGap = def.gap ?? 10;
  // always starts `gap` metres behind the spawn point (def.z is ignored: place the hazard anywhere near the start)
  const pos = new THREE.Vector3(def.x, def.y, spawn[2] + startGap);
  const z0 = pos.z;
  const box = newBox();
  const base = def.speed ?? 7.0, maxGap = def.maxGap ?? 14, lateral = def.lateral ?? 2.5;
  let sp = 0, wait = def.delay ?? 1.0, shakeT = 0, rumbleT = 0, danger = false, R = R0, lidT = 0, scale = 1;

  const settleY = (fromY) => {
    const g = groundAt(level, pos.x, pos.z, fromY, 40);
    return g > -Infinity ? g : null;
  };
  { const g = settleY(pos.y + 3); if (g !== null) pos.y = g; }

  const e = {
    object3d: root, box, alwaysUpdate: true, alwaysVisible: true, _keep: meshesOf(M),
    get speed() { return sp; },
    get pos() { return pos; },
    style,
    update(dt, c) {
      const p = c.player, L = c.level;
      // ---- speed: a bit slower than the player's run, catches up when Lumen dawdles, accelerates when too far
      const gap = pos.z - p.pos.z;
      let target = base;
      if (gap > maxGap) target = Math.min(base * 2.2, base + (gap - maxGap) * 1.6);
      if (L.finished || p.dead) target = 0;
      if (wait > 0) { wait -= dt; target = 0; }
      sp += (target - sp) * Math.min(1, dt * (target > sp ? 2.5 : target === 0 ? 4 : 1.5));
      const step = sp * dt;
      pos.z -= step;
      if (def.followX !== false && !p.dead) pos.x += clamp(p.pos.x - pos.x, -1.6 * dt, 1.6 * dt);
      pos.x = clamp(pos.x, def.x - lateral, def.x + lateral);
      // ---- hug the ground (climbs steps up to ~R, rolls over gaps)
      const g = settleY(pos.y + R * 0.9);
      if (g !== null) pos.y += (g - pos.y) * Math.min(1, dt * 8);
      // ---- snowball grows as it rolls
      if (style === 'snowball') {
        scale = 1 + clamp((z0 - pos.z) / (def.growDist ?? 150), 0, 1) * (def.grow ?? 0.5);
        R = R0 * scale;
      }
      holder.position.copy(pos);
      holder.scale.setScalar(scale);
      // ---- animation per style
      const t = c.time;
      if (M.roll) M.roll.rotation.x -= step / R;
      if (style === 'moon') {
        M.face.position.y = R0 * 1.05 + Math.abs(Math.sin(t * 8)) * 0.08 * (sp > 1 ? 1 : 0);
        M.mouth.scale.y = R0 * (0.18 + Math.abs(Math.sin(t * 6)) * 0.08);
        for (const d of M.drops) { d.position.y = R0 * 0.35 - ((t * 0.9 + d.position.x) % 1) * R0 * 0.5; }
        M.eyes.update(dt);
        M.eyes.mood(L.finished ? 'calm' : 'scared');
        M.eyes.look(Math.sin(t * 3) * 0.6, 0.2);
      } else if (style === 'tajine') {
        lidT += dt;
        const clap = (lidT % 0.9) < 0.18;
        M.lid.position.x = clap ? -0.1 + 0.55 : -0.1;
        if (clap && !e._clapped && sp > 1) {
          e._clapped = true;
          if (Math.abs(gap) < 30) c.sfx('crate_iron', { pos, vol: 0.5, pitch: 0.7 });
          M.steam.visible = true;
        }
        if (!clap) e._clapped = false;
        if (M.steam.visible) { M.steam.position.y += dt * 2; if (M.steam.position.y > R0 * 3.2) { M.steam.visible = false; M.steam.position.y = R0 * 2; } }
        M.eyes.update(dt);
        M.eyes.look(clamp(-(p.pos.x - pos.x) * 0.2, -1, 1), 0);
        M.mouth.scale.y = R0 * (0.08 + (clap ? 0.12 : 0));
      } else if (style === 'snowball') {
        for (let i = 0; i < M.stuck.length; i++) M.stuck[i].rotation.x = Math.sin(t * 20 + i) * 0.6;
        if (sp > 2 && Math.random() < dt * 12) c.fx.burst(_a.set(pos.x + (Math.random() - 0.5) * R, pos.y + 0.1, pos.z + R * 0.6), 0xffffff, 2, { speed: 3, dy: 0, life: 0.5 });
      } else if (style === 'roomba') {
        for (const b of M.brushes) b.rotation.y += dt * 14;
        M.body.rotation.z = Math.sin(t * 20) * 0.01 * (sp > 1 ? 1 : 0);
        M.siren.visible = Math.sin(t * 10) > 0;
        M.eyes.update(dt);
        M.eyes.look(clamp(-(p.pos.x - pos.x) * 0.3, -1, 1), 0);
        for (const d of M.dust) {
          const u = d.userData;
          u.k += dt * 1.2;
          if (u.k > 1) { u.k = 0; u.x = (Math.random() - 0.5) * R0 * 1.8; }
          d.position.set(pos.x + u.x * (1 - u.k * 0.7), pos.y + u.y * (1 - u.k), pos.z - R0 - 3.5 * (1 - u.k));
          d.rotation.y += dt * 8;
        }
        // suction: pulls Lumen backwards when close
        if (!p.dead && !L.finished && gap > 0 && gap < 9) p.ext.z += (1 - gap / 9) * (def.suck ?? 1.6);
      }
      // ---- hit box & squash
      const H = style === 'roomba' ? 3.0 : 2 * R;
      setBox(box, pos.x, pos.y, pos.z, R, H, R);
      if (!p.dead && !L.finished) {
        if (gap < R * 0.92 + 0.25 && gap > -R && Math.abs(p.pos.x - pos.x) < R * 0.95 + 0.3 && p.pos.y < pos.y + H * 0.92 && p.pos.y + 1 > pos.y) {
          c.game.kill('squash');
        }
      }
      // ---- rumble & shake by proximity
      shakeT -= dt; rumbleT -= dt;
      const prox = clamp(1 - gap / 18, 0, 1);
      if (sp > 1 && shakeT <= 0 && gap < 18) { shakeT = 0.12; c.shake(0.04 + 0.32 * prox * prox); }
      if (sp > 1 && rumbleT <= 0) { rumbleT = 0.55; c.sfx(style === 'roomba' ? 'robot' : 'rumble', { pos, vol: clamp(1 - gap / 26, 0.15, 1) }); }
      const dg = gap < 6 && !p.dead && !L.finished;
      if (dg !== danger) { danger = dg; bus.emit('music:mod', { danger }); }
    },
    onRespawn(c) {
      const cp = c.level.checkpoint;
      pos.set(clamp(cp[0], def.x - lateral, def.x + lateral), cp[1], cp[2] + (def.respawnGap ?? startGap));
      const g2 = settleY(pos.y + 6);
      if (g2 !== null) pos.y = g2;
      sp = 0; wait = def.delay ?? 1.0;
      if (danger) { danger = false; bus.emit('music:mod', { danger: false }); }
      holder.position.copy(pos);
    },
    dispose() { if (danger) bus.emit('music:mod', { danger: false }); },
  };
  return e;
}
