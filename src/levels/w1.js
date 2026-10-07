// Île 1 — Île des Lucioles (Level design A). 1-1 … 1-5.
// Coordinates: the builder cursor walks -Z. `lat` + = right, `up` = height, `fwd` = metres from the anchor (start of the
// last floor/gap/step). Comments "f 26" = forward distance from the origin, handy when reading the layout.
// The small helpers below are exported and reused by w2.js.
import { level, t } from './builder.js';

// ------------------------------------------------------------------ helpers (pieces)

/** Spawn on the current floor, `fwd` metres after the anchor. */
export function spawnAt(b, lat = 0, fwd = 1.5, up = 0) { b.spawnAt = b.W(b.lat + lat, b.y + up, b.a + fwd); return b; }

/** A pit of `len` with a firefly arc drawing the jump (from just before the edge to just after). */
export function hop(b, len, { lat = 0, arc = 1.5, up = 0.9, n, crate, crateUp = 0.15 } = {}) {
  b.gap(len);
  const N = n ?? Math.max(4, Math.round(len / 0.9) + 2);
  const span = len + 1.6;
  b.lights(N, lat, -0.8, { spacing: span / (N - 1), arc, up });
  // a crate floating mid-gap, top near jump height: land on it, it breaks and bounces you across
  if (crate) b.crate(crate, lat, len / 2, crateUp, { float: true });
  return b;
}

/**
 * A pit crossed on n entity platforms (sinking pads, quicksand…). Sized for RUNNING jumps: a full-speed jump covers
 * ~5.5 m from the edge, so pads are 3.4 m deep with 2.6 m gaps: you land mid-pad (2.6…6 m) jump after jump.
 * kinds: a string or an array per pad; zig = lateral zig-zag; params merged into each platform. Returns the pit length.
 */
export function pads(b, n, kinds, { size = 3.4, gap = 2.6, zig = 0, w, params = {}, up = 1.2 } = {}) {
  const len = n * (size + gap) + gap;
  b.gap(len);
  for (let i = 0; i < n; i++) {
    const k = Array.isArray(kinds) ? kinds[i % kinds.length] : kinds;
    const p = typeof params === 'function' ? params(i) : params;
    b.platform(k, zig ? (i % 2 ? zig : -zig) : 0, gap + size / 2 + i * (size + gap), { w: w ?? size, d: size, ...p });
  }
  b.lights(n * 2 + 1, 0, gap / 2, { spacing: (size + gap) / 2, up });
  return len;
}

/** A collapsing bridge: n planks (falling platforms) nearly touching — keep running! */
export function collapse(b, n, { size = 2.6, w = 2.4, delay = 0.5 } = {}) {
  const len = n * size + 0.4;
  b.gap(len);
  for (let i = 0; i < n; i++) b.platform('falling', 0, 0.2 + size / 2 + i * size, { w, d: size - 0.15, delay });
  b.lights(n * 2, 0, 0.6, { spacing: size / 2, up: 0.9 });
  return len;
}

/** Ring of fireflies standing up across the path (jump through it). */
export function ring(b, lat, fwd, { r = 1.1, n = 8, up = 1.6 } = {}) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    b.ent('pickup', 'light', lat + Math.cos(a) * r, fwd, up + Math.sin(a) * r);
  }
  return b;
}

/** Zig-zag line of fireflies along the path (ride levels: steer to collect). */
export function weave(b, n, fwd, { spacing = 1.6, amp = 2, period = 8, lat = 0, up = 0.9 } = {}) {
  for (let i = 0; i < n; i++) b.ent('pickup', 'light', lat + Math.sin((i / period) * Math.PI * 2) * amp, fwd + i * spacing, up);
  return b;
}

/** Decor on both sides of the last floor (deterministic). kinds = array; side offset = floor half width + margin. */
export function dress(b, len, kinds, { every = 7, margin = 1.6, spread = 2.5, from = 0, seed = 1, w } = {}) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const half = (w ?? b.width) / 2;
  for (let f = from + rnd() * every * 0.5; f < from + len; f += every * (0.6 + rnd() * 0.8)) {
    const side = rnd() < 0.5 ? -1 : 1;
    b.deco(kinds[Math.floor(rnd() * kinds.length)], side * (half + margin + rnd() * spread), f, 0, 0.8 + rnd() * 0.6, rnd() * Math.PI * 2);
  }
  return b;
}

/** Parody billboard from the environment's gag list (src/art/env-gags.js), e.g. 'notcrash', 'lilypads'. */
export function gag(b, id, lat, fwd, up = 0, r = 0) {
  const [x, y, z] = b.W(b.lat + lat, b.y + up, b.a + fwd);
  b.decor.push({ kind: 'billboard', gag: id, x, y, z, s: 1, r });
  return b;
}

/** Camera presets for zones inside a -Z level. */
export const CAM = {
  // 2.5D view of a stretch going -Z: camera on the right (+X) side, travel to the right of the screen
  sideZ: { mode: 'side', yaw: Math.PI / 2, travelYaw: 0, dist: 10.5, height: 2.6, lookAhead: 2.5, lateral: 1 },
  high: { mode: 'behind', dist: 9.5, height: 6.5, lookAhead: 3, lookUp: 0.5 },
  low: { mode: 'behind', dist: 6, height: 2.4, lookAhead: 4, lookUp: 1.4, fov: 62 },
};

/** Builds a level and stamps the common fields. */
export function make(meta, fn) {
  const b = level({ width: 5, ...meta });
  // chainable versions of the pieces above
  b.hop = (len, o) => hop(b, len, o);
  b.ring = (lat, fwd, o) => ring(b, lat, fwd, o);
  b.weave = (n, fwd, o) => weave(b, n, fwd, o);
  b.dress = (len, kinds, o) => dress(b, len, kinds, o);
  b.gag = (id, lat, fwd, up, r) => gag(b, id, lat, fwd, up, r);
  fn(b);
  return b.build();
}

// ------------------------------------------------------------------ jokes (signs)
const S = {
  notCrash: t('Ceci n\'est pas Crash. Nos avocats insistent.', 'This is not Crash. Our lawyers insist.'),
  behind: t('Tu marches à reculons ? Les vrais pros font ça.', 'Walking backwards? That\'s what the pros do.'),
  jump: t('SAUT : Espace / A. Une technologie révolutionnaire.', 'JUMP: Space / A. Revolutionary technology.'),
  hole: t('Attention : trou. Oui, déjà.', 'Warning: hole. Yes, already.'),
  spin: t('TOUPIE : J / X / Shift. Les crabes détestent. Les avocats aussi.', 'SPIN: J / X / Shift. Crabs hate it. So do lawyers.'),
  qcrate: t('Caisse « ? » : saute dessus encore et encore. C\'est thérapeutique.', '"?" crate: jump on it again and again. Very therapeutic.'),
  tnt: t('TNT : saute dessus puis cours. Ou reste et deviens confettis.', 'TNT: jump on it, then run. Or stay and become confetti.'),
  slam: t('BODY-SLAM : saute puis K / C en l\'air. Écrase ta colère.', 'BODY SLAM: jump, then K / C in mid-air. Crush your feelings.'),
  slide: t('GLISSADE : K / C en courant. Passe sous la barre. Personne ne regarde.', 'SLIDE: K / C while running. Get under the bar. Nobody\'s watching.'),
  side: t('Vue de côté ! Le budget 3D était épuisé.', 'Side view! We ran out of 3D budget.'),
  legs: t('Si une caisse s\'enfuit en hurlant, c\'est normal. Ici.', 'If a crate runs away screaming, that\'s normal. Here.'),
  later: t('Trop haut ? Reviens avec le double saut. Ou un escabeau.', 'Too high? Come back with the double jump. Or a ladder.'),
  checkpoint: t('Caisse « C » : on sauvegarde. Contrairement à ta dignité.', '"C" crate: progress saved. Unlike your dignity.'),
  almost: t('Le portail est juste là. Promis. Presque.', 'The portal is right there. Promise. Almost.'),
  hole2: t('Attention : trou. Oui, encore.', 'Warning: hole. Yes, again.'),
  plant: t('Les plantes carnivores mordent. Toupie-les avant qu\'elles te toupient.', 'Carnivorous plants bite. Spin them before they spin you.'),
  porcupine: t('Porc-épic : ne pas sauter dessus. Ne pas câliner non plus.', 'Porcupine: do not jump on. Do not hug either.'),
  switch: t('Caisse « ! » : fait apparaître des caisses fantômes. De la magie. Ou un bug.', '"!" crate: makes ghost crates appear. Magic. Or a bug.'),
  nitro: t('Caisse verte = NITRO. On ne touche pas. On ne la regarde même pas.', 'Green crate = NITRO. Don\'t touch. Don\'t even look at it.'),
  pendulum: t('Les troncs qui se balancent ont la priorité.', 'Swinging logs have right of way.'),
  bats: t('Chauves-souris : elles ne mordent pas. Elles volent dans ta figure. C\'est pire.', 'Bats: they don\'t bite. They fly in your face. Worse.'),
  moon: t('Pourquoi la lune roule ? Le budget scénario était épuisé aussi.', 'Why is the moon rolling? We ran out of story budget too.'),
  run: t('COURS. (Vers la caméra. Oui, c\'est perturbant.)', 'RUN. (Towards the camera. Yes, it\'s weird.)'),
  snail: t('Escargot Turbo : 0 à 40 km/h en… un certain temps.', 'Turbo Snail: 0 to 25 mph in… some time.'),
  snail2: t('Bave de qualité supérieure. Ne pas glisser.', 'Premium-grade slime. Don\'t slip.'),
  turbo: t('MODE TURBO. L\'escargot a bu trois cafés.', 'TURBO MODE. The snail had three coffees.'),
  river: t('Nénuphars : ils coulent. Comme mes espoirs de sortie sur console.', 'Lily pads: they sink. Like my hopes for a console release.'),
  water: t('Baignade interdite. Lumen est un renard, pas un castor.', 'No swimming. Lumen is a fox, not a beaver.'),
  waterfall: t('Derrière un gros rocher, il y a toujours un secret. C\'est la loi.', 'There\'s always a secret behind a big rock. It\'s the law.'),
  spring: t('Caisse ressort : boing. C\'est tout. Boing.', 'Spring crate: boing. That\'s it. Boing.'),
  bridge: t('Pont garanti 100 % solide. Garantie non valable sur ce pont.', 'Bridge 100% guaranteed solid. Warranty void on this bridge.'),
  tnt2: t('Une TNT au milieu du chemin. Qui a fait ça ? Oku Oku, sors de là.', 'A TNT in the middle of the path. Who did this? Oku Oku, come out.'),
  turtle: t('Saute sur la tortue : elle devient trampoline. Elle a signé une décharge.', 'Jump on the turtle: it becomes a trampoline. It signed a waiver.'),
};

// ================================================================== 1-1 Plage du Débutant
const L11 = make({
  id: '1-1', world: 1, index: 1, name: t('Plage du Débutant', 'Beginner Beach'), theme: 'beach', music: 'beach', mode: 'run',
  ground: 'sand',
  intro: t('Bienvenue sur l\'Île des Lucioles ! Tout est facile ici. Pour l\'instant.', 'Welcome to Firefly Island! Everything is easy here. For now.'),
  timeTrial: { gold: 44, silver: 56, bronze: 75 },
}, (b) => {
  // --- secret: walk backwards from the spawn, the sock hides behind a rock (f -16 … 0)
  b.at(0, 0, -16).floor(16)
    .sock('red', 1.5, 1.5, 0.7).deco('rock', 1.3, 3.2, 0, 2.2).deco('palm', -3.5, 2)
    .lights(4, 0, 6, { spacing: 1.2 }).sign(S.behind, -1.9, 10);
  // --- calm intro (f 0 … 26)
  b.floor(30); spawnAt(b, 0, 1.5); b.gag('sunscreen', 5.5, 20);
  b.sign(S.notCrash, -2, 4).lights(5, 0, 6, { spacing: 1.2 })
    .crate('basic', 1.4, 9).sign(S.jump, 2.1, 11).crate('basic', -1.4, 12)
    .block(0, 0.7, 15.5, 5, 0.7, 0.9, { kind: 'wood' }).lights(3, 0, 14.5, { spacing: 1, up: 1.8 })
    .crate('time1', 1.2, 21).stack(['basic', 'basic'], 1.5, 23)
    .sign(S.hole, -2, 27)
    .deco('palm', -4, 3).deco('palm', 4.3, 8, 0, 1.2).deco('umbrella', 3.8, 15).deco('palm', -4.5, 18, 0, 0.9)
    .deco('shell', -3.6, 11).deco('shell', 3, 22);
  // first pit
  hop(b, 2.5);
  // --- spin lesson (f 28.5 … 43.5)
  b.floor(15).sign(S.spin, 2.1, 1.5)
    .enemy('crab', 0, 6, { patrol: { axis: 'x', range: 1.6, speed: 1.2 } })
    .row('basic', 3, 0, 7, { spacing: 1.45 }).crate('lights', 1.9, 13.5).lights(4, -1.6, 3, { spacing: 1 })
    .deco('palm', -4.2, 6).deco('rock', 4, 12, 0, 1.4);
  hop(b, 3);
  // --- "?" crate + checkpoint (f 46.5 … 62.5)
  b.floor(16).sign(S.qcrate, -2, 1).crate('lights', 0, 4)
    .checkpoint(1.6, 8).sign(S.checkpoint, -2.1, 8)
    .enemy('turtle', -0.5, 12.5, { patrol: { axis: 'x', range: 1.2, speed: 0.7 } }).sign(S.turtle, 2.1, 11)
    .crate('basic', -1.9, 14.5).crate('mask', 1.9, 15)
    .deco('hut', -5, 9, 0, 1.2).deco('palm', 4.5, 4);
  // --- terraces: TNT + body slam lessons (f 62.5 … 82.5, y 1 then 2)
  b.step(1, 6).lights(3, 0, 1, { spacing: 1.4, up: 1 }).crate('basic', -1.7, 3.5);
  b.step(1, 14).pyramid(3, 0.8, 4)
    .crate('tnt', -1.8, 8).crate('basic', -1.8, 9.1).crate('basic', -0.8, 8).sign(S.tnt, 2.2, 7.5)
    .stack(['basic', 'basic'], 1.4, 11.5).sign(S.slam, -2.2, 11.5).lights(3, 0, 12, { spacing: 0.8, up: 2.6 })
    .deco('rock', -4.5, 3, -2, 2).deco('palm', 4.5, 10, -2);
  // --- slide lesson: limbo bar (f 82.5 … 94.5)
  b.step(-2, 12).sign(S.slide, -2.2, 1.5)
    .block(0, 4.6, 6, 5, 3.8, 1, { kind: 'wood' }).lights(5, 0, 4, { spacing: 0.9, up: 0.3 })
    .crate('basic', 1.8, 10).crate('time2', -1.2, 10.5)
    .deco('tiki_torch', -3.6, 6, 0, 1.3).deco('tiki_torch', 3.6, 6, 0, 1.3);
  // --- the jetty, seen from the side (f 94.5 … 136.5)
  b.zone(42, { camera: CAM.sideZ, toast: S.side });
  hop(b, 2);
  b.floor(9, { w: 3, kind: 'wood' }).crate('basic', 0, 1.5).lights(3, 0, 3.5, { spacing: 1 });
  hop(b, 2.5);
  b.floor(9, { w: 3, kind: 'wood' }).crate('lights', 0, 1.6).enemy('crab', 0, 5.5, { patrol: { axis: 'z', range: 1.5, speed: 1.3 } });
  hop(b, 3, { crate: 'basic' });
  b.floor(10, { w: 3, kind: 'wood' }).crate('basic', 0, 3).crate('basic', 0, 5.5).crate('life', 0, 8).lights(2, 0, 1)
    .sign(S.side, -1.4, 1);
  b.floor(8).checkpoint(0, 1.5).deco('umbrella', -3.5, 2).deco('deckchair', 3.4, 5);
  // --- rocks in the sea (f 136 … 154.6)
  b.stones(4, { size: 3.2, gap: 2.4, kind: 'stone' }).lights(8, 0, 1.2, { spacing: 2.8, up: 1.1 });
  // --- wide beach: legs crate, mystery crate, double-jump bonus pillar (f 154.6 … 176.6)
  b.floor(22, { w: 9 }).sign(S.legs, 3.6, 3)
    .crate('legs', 2, 10).crate('mystery', 2.8, 17)
    .enemy('turtle', -1, 6, { patrol: { axis: 'z', range: 2, speed: 0.8 } })
    .row('basic', 2, -2, 16, { spacing: 1.1 }).row('basic', 2, 3, 4, { spacing: 1.1 }).crate('time3', 0, 19)
    .block(-6.2, 3.7, 12, 3, 7.7, 3, { kind: 'stone' }).sign(S.later, -3.8, 9.5)
    .crate('life', -6.2, 12, 3.7, { bonus: 'doubleJump' }).lights(3, -6.2, 11, { spacing: 1, up: 4.6 })
    .deco('palm', 5.2, 4).deco('palm', 5.6, 14, 0, 1.3).deco('shell', -4.8, 18).deco('umbrella', 5, 20);
  ring(b, 0, 7, { up: 1.7 });
  // --- spring crate lesson: crates on a high dune (f 176.6 … 194.6)
  b.floor(18).sign(S.spring, -2.1, 2).crate('bounce', 1.4, 7)
    .block(3.6, 3, 10.5, 2.4, 7, 5, { kind: 'stone' }).row('basic', 3, 3.6, 9, { axis: 'fwd', spacing: 1.4, up: 3 })
    .ring(1.4, 7, { up: 3.2, r: 0.8, n: 6 }).lights(3, 3.6, 8.8, { spacing: 1.4, up: 3.9 })
    .enemy('crab', -1, 14, { patrol: { axis: 'x', range: 1.2, speed: 1.4 } }).deco('palm', -4.4, 10);
  // --- climax: crabs, TNT, crates over pits, a last climb (f 176.6 … )
  hop(b, 3);
  b.floor(12).enemy('crab', -1, 4, { patrol: { axis: 'x', range: 1.4, speed: 1.6 } })
    .enemy('crab', 1, 8, { patrol: { axis: 'x', range: 1.4, speed: 1.6 } })
    .crate('tnt', 1.9, 10.5).crate('basic', -1.9, 10.5).lights(4, 0, 2, { spacing: 2 });
  hop(b, 3.5, { crate: 'lights' });
  b.floor(8).stack(['basic', 'basic'], 1.6, 4).crate('basic', -1.6, 5).sign(S.hole2, -2, 7);
  hop(b, 3.5);
  b.step(1, 6).crate('basic', 0, 3);
  b.step(1, 6).crate('mask', -1.5, 3).lights(3, 0, 1, { spacing: 1.5 });
  hop(b, 3, { arc: 1.2 });
  b.floor(14, { kind: 'wood' }).pyramid(2, -1.2, 5, ['basic', 'lights']).lights(5, 1.4, 2, { spacing: 1.6 })
    .sign(S.almost, 2.2, 10).deco('palm', -4, 9).deco('palm', 4, 12);
  b.goal(10).deco('tiki_torch', -3.5, 5, 0, 1.6).deco('tiki_torch', 3.5, 5, 0, 1.6);
});

// ================================================================== 1-2 Jungle Toupie
const L12 = make({
  id: '1-2', world: 1, index: 2, name: t('Jungle Toupie', 'Spin Jungle'), theme: 'jungle', music: 'jungle', mode: 'run',
  ground: 'grass',
  intro: t('Une jungle pleine de bestioles. Tourne. Tourne encore. Vomis plus tard.', 'A jungle full of critters. Spin. Spin again. Throw up later.'),
  timeTrial: { gold: 58, silver: 74, bronze: 98 },
}, (b) => {
  // --- intro clearing (f 0 … 22)
  b.floor(22); spawnAt(b, 0, 1.5); b.gag('jungletm', -5.5, 18);
  b.sign(S.plant, -2.1, 4).lights(4, 0, 4, { spacing: 1.2 })
    .crate('basic', -1.5, 8).crate('basic', 1.5, 8).enemy('plant', 1.6, 13)
    .stack(['basic', 'lights'], -1.6, 16).crate('time1', 0.6, 18)
    .deco('fern', -4, 2).deco('tree', 4.5, 6, 0, 1.4).deco('fern', 3.8, 14).deco('tree', -4.8, 17, 0, 1.2);
  hop(b, 2.5);
  // --- porcupine corridor with walls (f 24.5 … 42.5)
  b.floor(18).walls(18, { h: 1.6, kind: 'wood' }).sign(S.porcupine, -1.8, 1)
    .enemy('porcupine', 0, 6, { patrol: { axis: 'x', range: 1.5, speed: 1.2 } })
    .crate('basic', -1.8, 9).crate('basic', 1.8, 10)
    .enemy('porcupine', 0, 13, { patrol: { axis: 'x', range: 1.5, speed: 1.5 } })
    .crate('lights', 0, 16.5).lights(6, 0, 3, { spacing: 2 });
  // --- terraces up (f 42.5 … 62.5)
  b.step(1.2, 5).crate('basic', 1.5, 2.5);
  b.step(1.2, 5).enemy('plant', -1.5, 2.5);
  b.step(1, 10).checkpoint(1.4, 3).crate('mask', -1.6, 7).lights(4, 0, 5, { spacing: 1.2 })
    .deco('tree', -5, 4, 0, 1.6).deco('totem', 4.2, 6);
  // --- rope bridge over a ravine; a ledge under it hides the sock (f 62.5 … 80.5)
  hop(b, 2, { arc: 1.2 });
  b.floor(14, { w: 2.6, kind: 'bridge', thick: 0.5 }).lights(6, 0, 1.5, { spacing: 2.2 })
    .crate('basic', 0, 5).crate('basic', 0, 9.5)
    .block(2.5, -1.8, 7, 2.2, 1, 2.6, { kind: 'stone' }).sock('purple', 2.5, 7, -1.1)
    .lights(2, 2.5, 6.2, { spacing: 1.6, up: -1.0 })
    .deco('fern', -2, 3).deco('fern', 2, 11);
  b.floor(10).sign(S.bats, 2.1, 1).enemy('bat', 0, 6, { up: 1.6 }).crate('basic', -1.7, 8)
    .deco('fern', -4, 5).deco('flowers', 3.6, 7);
  // --- switch puzzle: outline crates form a staircase to a canopy ledge (f 82.5 … 104.5)
  hop(b, 2.5);
  b.floor(22, { w: 7 }).sign(S.switch, -3, 1)
    .crate('switch', -2.4, 4, 0, { group: 'canopy' })
    .crate('outline', 2.3, 7, 0, { group: 'canopy' })
    .crate('outline', 2.3, 8.2, 0, { group: 'canopy' }).crate('outline', 2.3, 8.2, 1, { group: 'canopy' })
    .block(2.6, 3.4, 13, 3.2, 1, 6, { kind: 'wood' })
    .crate('basic', 2.6, 11.5, 3.4).crate('life', 2.6, 13.5, 3.4).crate('basic', 2.6, 15, 3.4)
    .lights(5, 2.6, 11, { spacing: 1, up: 4.2 })
    .enemy('porcupine', -1, 12, { patrol: { axis: 'z', range: 2.5, speed: 1.2 } })
    .crate('basic', -2.6, 14).crate('tnt', -2.6, 15.2).crate('basic', -1.5, 15.2)
    .deco('tree', -5.5, 8, 0, 1.8).deco('tree', 6, 18, 0, 1.6);
  // --- swinging logs (f 104.5 … 126.5)
  hop(b, 3);
  b.floor(19).sign(S.pendulum, -2.1, 1)
    .hazard('pendulum', 0, 5, { length: 4, speed: 1.4 })
    .hazard('pendulum', 0, 11, { length: 4, speed: 1.6, offset: 1.2 })
    .crate('basic', -1.9, 8).crate('basic', 1.9, 8).crate('lights', 1.9, 14.5)
    .hazard('pendulum', 0, 16, { length: 4, speed: 1.8, offset: 0.4 })
    .lights(8, 0, 2, { spacing: 2 });
  // --- side view: tree-trunk platforms (f 126.5 … ~160)
  b.zone(36, { camera: CAM.sideZ });
  b.floor(9).checkpoint(0, 1.5);
  b.stones(3, { size: 3.2, gap: 2.2, dy: 0.6, kind: 'wood' }).lights(6, 0, 1, { spacing: 2.7, up: 1.4 });
  b.floor(7, { w: 3 }).lights(3, 0, 0.5, { spacing: 0.8 }).enemy('plant', 0, 4.5);
  b.stones(3, { size: 3.2, gap: 2.6, dy: -0.6, kind: 'wood' }).lights(6, 0, 1, { spacing: 2.9, up: 1.2 });
  // --- nitro garden (f ~160 … 180)
  b.floor(20, { w: 6 }).sign(S.nitro, -2.6, 1)
    .crate('nitro', 0, 5).crate('basic', -2, 6).crate('basic', 2, 6).crate('nitro', -1.5, 10).crate('nitro', 1.5, 10)
    .crate('basic', 0, 12).crate('lights', -2.4, 14).crate('basic', 2.4, 14).enemy('bat', 0, 15, { up: 1.5 }).lights(5, 0, 14, { spacing: 1 })
    .deco('flowers', -4, 4).deco('fern', 4, 9).deco('tree', -5, 16);
  // --- double-jump bonus: a canopy too high, left of the path
  b.block(-4.6, 3.6, 16, 3, 1, 4, { kind: 'wood' }).crate('basic', -4.6, 15, 3.6, { bonus: 'doubleJump' })
    .crate('basic', -4.6, 17, 3.6, { bonus: 'doubleJump' }).lights(3, -4.6, 15, { up: 4.4 }).sign(S.later, -2.6, 15);
  // --- combination: plants on stones, bats, porcupines (f 180 … )
  hop(b, 3, { crate: 'basic' });
  b.floor(8).enemy('plant', 1.5, 4).crate('basic', -1.5, 4).crate('time2', 0, 6);
  hop(b, 3.5);
  b.floor(12).enemy('porcupine', 0, 5, { patrol: { axis: 'x', range: 1.6, speed: 1.8 } })
    .enemy('bat', 0, 9, { up: 1.4 }).row('basic', 2, 0, 10.5, { spacing: 2.6 }).checkpoint(-1.8, 2);
  b.step(1, 8).crate('basic', 1.6, 2).enemy('plant', -1.5, 5.5).lights(4, 0, 2, { spacing: 1.4 });
  b.step(1, 8).stack(['basic', 'basic'], -1.6, 3).crate('mystery', 1.7, 5);
  hop(b, 4, { arc: 1.8 });
  b.floor(10, { kind: 'bridge', w: 3 }).crate('legs', 0, 6).sign(S.legs, -1.8, 2);
  hop(b, 2.5);
  b.step(-1, 16, { w: 6 }).crate('nitroSwitch', 2.2, 5).crate('basic', -2.2, 5).crate('time3', 0, 8)
    .pyramid(3, -1, 11, ['basic', 'basic', 'lights']).lights(6, 2, 8, { spacing: 1.2 })
    .sign(S.almost, 2.6, 12);
  b.goal(10).deco('totem', -3.4, 5, 0, 1.5).deco('totem', 3.4, 5, 0, 1.5);
});

// ================================================================== 1-3 La Lune qui Roule (chase)
const L13 = make({
  id: '1-3', world: 1, index: 3, name: t('La Lune qui Roule', 'The Rolling Moon'), theme: 'jungle', music: 'chase', mode: 'chase',
  ground: 'grass', width: 6,
  intro: t('La lune est tombée. Elle roule. Vers toi. Ne pose pas de questions.', 'The moon fell. It rolls. At you. Don\'t ask questions.'),
  timeTrial: { gold: 40, silver: 50, bronze: 66 },
}, (b) => {
  // run-up behind the spawn: the moon starts here
  b.at(0, 0, -18).floor(18).hazard('boulder', 0, 4, { style: 'moon', speed: 6.6 });
  b.floor(20); spawnAt(b, 0, 1); b.gag('moonroll', 6, 12);
  b.sign(S.run, 2.6, 3).sign(S.moon, -2.6, 7).lights(6, 0, 5, { spacing: 1.5 })
    .crate('basic', -2.4, 10).crate('basic', 2.4, 13).crate('time1', 0, 15)
    .deco('tree', -5, 4, 0, 1.6).deco('tree', 5, 10, 0, 1.6).deco('fern', -4, 15);
  hop(b, 2.5);
  b.floor(16).block(0, 0.7, 6, 6, 0.7, 0.9, { kind: 'wood' }).lights(3, 0, 5, { spacing: 1, up: 1.8 })
    .crate('basic', 2.4, 9).crate('lights', -2.4, 9).enemy('plant', -2.4, 13).lights(4, 1.4, 11, { spacing: 1.2 });
  hop(b, 3);
  b.floor(14).crate('switch', 2.4, 3, 0, { group: 'moon' }).sign(S.switch, -2.6, 1)
    .row('basic', 2, 0, 9, { spacing: 4.6 }).lights(6, 0, 5, { spacing: 1.4 });
  hop(b, 2.5);
  b.floor(18).checkpoint(-2.3, 3)
    .crate('outline', 2.4, 6, 0, { group: 'moon' }).crate('outline', 2.4, 9, 0, { group: 'moon' }).crate('outline', 2.4, 12, 0, { group: 'moon' })
    .crate('tnt', -1, 10).crate('basic', -2.5, 14).lights(5, 0.6, 4, { spacing: 2.6 });
  // side alcove with the sock (a risky detour to the right)
  b.floor(10).block(4.5, 0, 5, 3, 4, 4, { kind: 'stone' }).sock('green', 4.8, 5.5, 0.8).crate('basic', 4.2, 4)
    .crate('basic', -2.4, 6).lights(3, 3.4, 4, { spacing: 1, axis: 'fwd' })
    .deco('rock', 6.5, 6, 0, 1.8);
  hop(b, 3);
  b.floor(12).block(0, 0.7, 4, 6, 0.7, 0.9, { kind: 'wood' })
    .lights(3, 0, 3, { up: 1.8, spacing: 1 }).crate('basic', 2.4, 6.5).crate('basic', -2.4, 6.5);
  hop(b, 3.5, { arc: 1.6 });
  b.step(-1, 16).crate('legs', 0, 6).sign(S.legs, -2.6, 2)
    .crate('mystery', 2.4, 11).crate('basic', -2.4, 12).enemy('plant', 2.5, 14.5).lights(5, -0.6, 8, { spacing: 1.3 });
  // double-jump bonus floating above the next pit
  hop(b, 3);
  b.block(4.2, 3.4, 1.5, 2, 0.6, 2, { kind: 'wood' }).crate('life', 4.2, 1.5, 3.4, { bonus: 'doubleJump' });
  b.floor(14).checkpoint(2.3, 2).crate('mask', -2.4, 4)
    .row('basic', 2, 0, 8, { spacing: 4.8 }).crate('time2', 0, 10).lights(6, 0, 7, { spacing: 1.2 });
  hop(b, 3);
  b.step(1, 12).crate('basic', -2.4, 3).crate('tnt', 0, 7).crate('basic', 2.4, 7).lights(4, -1.4, 5, { spacing: 1.2 })
    .enemy('plant', -2.4, 10);
  hop(b, 3, { crate: 'basic' });
  b.floor(12).block(0, 0.7, 5, 6, 0.7, 0.9, { kind: 'wood' }).stack(['basic', 'basic'], 2.4, 8).crate('basic', -2.4, 8)
    .lights(3, 0, 4, { spacing: 1, up: 1.8 });
  hop(b, 2.5);
  b.step(-1, 14).crate('lights', 0, 3).crate('basic', -2.4, 7).crate('basic', 2.4, 7).crate('basic', -2.4, 11)
    .crate('basic', 2.4, 11).lights(8, 0, 5, { spacing: 1 });
  // narrow log bridge with TNT slalom
  hop(b, 3);
  b.floor(18, { w: 4, kind: 'bridge' }).sign(S.tnt2, -2.4, 1).crate('tnt', -1, 5).crate('tnt', 1, 10)
    .crate('basic', 1.2, 5).crate('basic', -1.2, 10).crate('tnt', -1, 15).crate('lights', 1.2, 15)
    .lights(10, 0, 2, { spacing: 1.6 });
  hop(b, 2.5);
  b.step(1, 10).crate('basic', -2.4, 3).crate('basic', 2.4, 3).lights(4, 0, 4, { spacing: 1.2 });
  hop(b, 3.5, { crate: 'basic' });
  b.step(-1, 12).enemy('plant', -2.4, 4).enemy('plant', 2.4, 8).crate('basic', 2.4, 3).crate('basic', -2.4, 9)
    .lights(6, 0, 3, { spacing: 1.4 });
  hop(b, 2.5);
  b.floor(10).stack(['basic', 'basic'], -2.4, 5).crate('mask', 2.4, 5).lights(4, 0, 3, { spacing: 1.2 });
  hop(b, 3);
  b.floor(14).crate('basic', 0, 4).row('basic', 2, 0, 9, { spacing: 4.6 }).crate('time3', 0, 11)
    .lights(5, 0, 6, { spacing: 1.3 }).sign(S.almost, 2.6, 2);
  b.goal(12).deco('totem', -3.8, 7, 0, 1.4).deco('totem', 3.8, 7, 0, 1.4);
});

// ================================================================== 1-4 Escargot Turbo (ride)
const L14 = make({
  id: '1-4', world: 1, index: 4, name: t('Escargot Turbo', 'Turbo Snail'), theme: 'beach', music: 'ride', mode: 'ride',
  mount: 'snail', autoRun: 11, ground: 'sand', width: 7,
  intro: t('Monte sur l\'escargot. Il fonce. Toi, tu diriges. Lui, il bave.', 'Ride the snail. It goes fast. You steer. It drools.'),
  timeTrial: { gold: 40, silver: 48, bronze: 60 },
}, (b) => {
  b.floor(30); spawnAt(b, 0, 2); b.gag('notcrash', -6.5, 20);
  b.sign(S.snail, -3, 6).weave(18, 8, { amp: 2, spacing: 1.2 })
    .row('basic', 3, 0, 22, { spacing: 1.3 }).crate('time1', -2.5, 26)
    .deco('palm', -5, 4).deco('palm', 5.5, 12).deco('umbrella', -5, 20).deco('palm', 5, 27);
  // lanes: rocks to dodge
  b.floor(30).block(-2, 1.2, 4, 2, 1.2, 1.4, { kind: 'stone' }).block(2.2, 1.2, 10, 2.4, 1.2, 1.4, { kind: 'stone' })
    .crate('basic', 2.2, 4).crate('basic', -2, 10).crate('basic', -2.4, 16).crate('lights', 0, 16)
    .block(0, 1.2, 19, 3, 1.2, 1.4, { kind: 'stone' }).row('basic', 2, 0, 19, { spacing: 5.4 })
    .enemy('crab', 0, 24, { patrol: { axis: 'x', range: 2.5, speed: 2 } })
    .lights(6, -2.4, 1, { spacing: 1.4 }).sign(S.snail2, 3.6, 2);
  hop(b, 4, { arc: 2 });
  b.floor(24).checkpoint(-2.5, 3).crate('tnt', 0, 11).crate('tnt', 2.5, 11)
    .row('basic', 2, -2.5, 11, { axis: 'fwd', spacing: 1.2 })
    .crate('nitro', -2.5, 21).crate('nitro', 0, 21).row('basic', 2, 2.5, 20.4, { axis: 'fwd', spacing: 1.2 })
    .weave(10, 7, { amp: 2.5, spacing: 1.4, period: 10 }).deco('palm', -5, 8).deco('palm', 5, 18);
  // switch lane: ! crate in the middle, outlines further on the right lane
  b.floor(26).crate('switch', 0, 4, 0, { group: 'snail' }).sign(S.switch, -3.3, 1)
    .crate('outline', 2.3, 16, 0, { group: 'snail' }).crate('outline', 2.3, 18, 0, { group: 'snail' })
    .crate('outline', 2.3, 20, 0, { group: 'snail' }).crate('outline', 2.3, 22, 0, { group: 'snail' })
    .block(-1.8, 1.2, 12, 2.6, 1.2, 1.4, { kind: 'stone' }).crate('basic', -2.6, 19).crate('basic', -2.6, 21)
    .weave(8, 6, { amp: 1, lat: -1, spacing: 1.4 });
  hop(b, 3.5);
  // fork: right path is the main beach, left path (narrow sandbar) hides the sock
  b.floor(30, { w: 4, lat: 1.5, advance: false }).floor(30, { w: 2, lat: -3.6 });
  b.sock('blue', -3.5, 20, 0.7).lights(10, -3.5, 3, { spacing: 1.6 })
    .crate('basic', 1.5, 5).crate('basic', 2.5, 9).crate('lights', 1, 14).crate('basic', 2.5, 19).crate('basic', 0.5, 23)
    .enemy('crab', 1.5, 26, { patrol: { axis: 'x', range: 1.2, speed: 1.6 } }).crate('time2', 1.5, 28);
  hop(b, 3, { arc: 1.8 });
  b.floor(22).checkpoint(2.6, 2).crate('mask', -2.6, 2)
    .block(-1.5, 1.2, 9, 4, 1.2, 1.2, { kind: 'stone' }).block(2, 1.2, 15, 3, 1.2, 1.2, { kind: 'stone' })
    .row('basic', 3, 2.2, 9, { axis: 'fwd', spacing: 1.2 }).row('basic', 3, -2.2, 15, { axis: 'fwd', spacing: 1.2 })
    .weave(10, 4, { amp: 2.4, spacing: 1.6 });
  // TURBO stretch
  b.zone(60, { autoRun: 15, toast: S.turbo });
  b.floor(30).weave(16, 2, { amp: 0, spacing: 1.8 }).row('basic', 3, 0, 26, { spacing: 1.2 })
    .crate('tnt', -2.6, 12).crate('tnt', 2.6, 12).crate('nitro', -2.6, 20).crate('nitro', 2.6, 20);
  hop(b, 5, { arc: 2.2 });
  b.floor(25).row('basic', 4, 0, 5, { spacing: 1.2 }).crate('lights', 0, 12)
    .block(-2.2, 1.2, 17, 2.6, 1.2, 1.2, { kind: 'stone' }).block(2.2, 1.2, 17, 2.6, 1.2, 1.2, { kind: 'stone' })
    .lights(6, 0, 15, { spacing: 1 });
  // double-jump bonus: floating sandbar above the last pit
  hop(b, 4.5, { arc: 2 });
  b.block(0, 3.6, -2.2, 2.4, 0.6, 3, { kind: 'wood' }).crate('life', 0, -2.2, 3.6, { bonus: 'doubleJump' });
  b.floor(24).checkpoint(0, 2).enemy('crab', -2, 8, { patrol: { axis: 'x', range: 1.2, speed: 1.8 } })
    .enemy('crab', 2, 12, { patrol: { axis: 'x', range: 1.2, speed: 1.8 } })
    .crate('mystery', 0, 16).crate('legs', 2.4, 20).row('basic', 2, -2.4, 20, { axis: 'fwd', spacing: 1.4 })
    .weave(12, 4, { amp: 2, spacing: 1.6 });
  hop(b, 3.5);
  b.floor(30).crate('nitro', 0, 6).crate('nitroSwitch', -2.6, 12).row('basic', 3, 2.2, 10, { axis: 'fwd', spacing: 1.3 })
    .crate('time3', 0, 18).row(['basic', 'lights', 'basic'], 3, 0, 24, { spacing: 1.4 }).sign(S.almost, 3.6, 10)
    .deco('palm', -5, 6).deco('palm', 5, 16).deco('tiki_torch', -4.6, 26, 0, 1.5);
  b.goal(14);
});

// ================================================================== 1-5 Rivière des Nénuphars
const L15 = make({
  id: '1-5', world: 1, index: 5, name: t('Rivière des Nénuphars', 'Lily Pad River'), theme: 'river', music: 'river', mode: 'run',
  ground: 'grass',
  intro: t('Une rivière, des nénuphars, et zéro bouée. Bonne chance.', 'A river, lily pads, and zero life jackets. Good luck.'),
  timeTrial: { gold: 62, silver: 80, bronze: 105 },
}, (b) => {
  // water surface just under the pads' top (sinking pads go under it); you drown 0.25 m below
  const water = (len, fwd = 0, w = 30) => b.hazard('water', 0, fwd + len / 2, { w, d: len, up: -0.15 });
  b.floor(20); spawnAt(b, 0, 1.5); b.gag('lilypads', 5.5, 15);
  b.sign(S.water, -2.1, 4).lights(5, 0, 5, { spacing: 1.2 }).crate('basic', 1.6, 9).stack(['basic', 'basic'], -1.6, 12)
    .crate('time1', 0.5, 16).deco('reeds', -4, 3).deco('tree', 4.5, 8, 0, 1.4).deco('reeds', 3.8, 16);
  // first lily pads (sinking) — teach with short gaps
  water(pads(b, 2, 'sinking', { w: 3 })); b.sign(S.river, 2.1, -2);
  b.floor(14).crate('basic', -1.7, 3).stack(['basic', 'basic'], 1.8, 3).enemy('crab', 0, 7, { patrol: { axis: 'x', range: 1.6, speed: 1.4 } })
    .crate('lights', 1.7, 10).crate('basic', -1.8, 10).deco('reeds', -3.5, 6);
  // moving logs
  b.gap(12); water(12)
    .platform('moving', 0, 3, { w: 3, d: 2.2, h: 0.5, to: { lat: 0, fwd: 6 }, period: 4 })
    .lights(6, 0, 1.4, { spacing: 1.8, up: 1.1 });
  b.floor(16).checkpoint(1.6, 3).crate('mask', -1.6, 5).enemy('turtle', 0, 9, { patrol: { axis: 'x', range: 1.2, speed: 0.8 } })
    .sign(S.turtle, 2.1, 7)
    .block(-5, 2.3, 10, 2, 0.6, 2, { kind: 'wood' }).crate('basic', -5, 10, 2.3).lights(2, -5, 9, { up: 3.1 })
    .crate('basic', 1.7, 13).crate('basic', -1.8, 13).deco('tree', -4.2, 2);
  // switch puzzle: outlines become stepping stones to a small island (f ~ 72)
  b.floor(12, { w: 6 }).crate('switch', -2.2, 3, 0, { group: 'lily' }).sign(S.switch, 2.6, 1)
    .crate('outline', 4.5, 6, 0, { group: 'lily', float: true }).crate('outline', 6.6, 6, 0, { group: 'lily', float: true })
    .block(10.2, 2.4, 6, 3.6, 6.4, 4, { kind: 'grass' })
    .crate('basic', 9.4, 5.2, 2.4).crate('life', 11, 6.8, 2.4).crate('basic', 9.4, 6.8, 2.4)
    .lights(4, 10.2, 5, { spacing: 1, up: 3.4 }).hazard('water', 7, 6, { w: 10, d: 10, up: -0.6 });
  // stepping stones + crabs
  b.stones(4, { size: 3.2, gap: 2.4, kind: 'stone' }).lights(8, 0, 1, { spacing: 2.8, up: 1.1 });
  water(24.8);
  // the waterfall descent, seen from the side
  b.zone(34, { camera: CAM.sideZ });
  b.floor(6, { w: 3 }).crate('basic', 0, 3).sign(S.waterfall, -1.4, 1);
  b.step(-1.2, 4, { w: 3, kind: 'stone' }).enemy('plant', 0, 2.5);
  b.gap(2.5).step(-1.2, 4, { w: 3, kind: 'stone' }).lights(3, 0, 1, { spacing: 1 });
  b.gap(2.5).step(-1.2, 6, { w: 3, kind: 'stone' }).lights(3, 0, 1, { spacing: 1 });
  // behind the big rock (left, away from the camera): the sock
  b.block(-3.2, 0, 3, 2.6, 4, 3, { kind: 'stone' }).sock('blue', -3.4, 3.4, 0.8).deco('boulder', -2.2, 3, 0, 1.5);
  b.gap(3).step(-0.6, 8).checkpoint(0, 1.5).lights(4, 0, 3, { spacing: 1.5 });
  // big lagoon: lilies + logs combo (f ~140 …)
  water(pads(b, 3, ['sinking', 'moving', 'sinking'], { params: (i) => (i === 1 ? { to: { fwd: 1.6 }, period: 3 } : {}) }));
  b.floor(8).crate('basic', -1.5, 3).crate('basic', 1.5, 3).enemy('crab', 0, 6, { patrol: { axis: 'x', range: 1.5, speed: 1.8 } });
  // two rafts drifting sideways (they meet the path every 3.5 s), then a lily
  water(pads(b, 3, ['moving', 'moving', 'sinking'],
    { params: (i) => (i === 0 ? { to: { lat: 3.5 }, period: 3.5 } : i === 1 ? { to: { lat: -3.5 }, period: 3.5, offset: 1.75 } : {}) }));
  b.floor(16).checkpoint(-1.6, 2).stack(['basic', 'lights'], -1.6, 5).crate('mystery', -1.7, 9)
    .enemy('plant', 1.7, 12).crate('legs', 0, 13).sign(S.legs, -2, 13)
    .block(4.6, 3.6, 8, 3, 1, 4, { kind: 'wood' }).crate('basic', 4.6, 7, 3.6, { bonus: 'doubleJump' })
    .crate('basic', 4.6, 9, 3.6, { bonus: 'doubleJump' }).sign(S.later, 2.2, 6);
  // falling log bridge + turtle trampolines
  water(collapse(b, 5)); b.sign(S.bridge, -2.1, -2);
  b.floor(16).enemy('turtle', -1.4, 4, { patrol: { axis: 'x', range: 0.8, speed: 0.6 } }).sign(S.turtle, 2.1, 2)
    .crate('basic', 1.6, 4).crate('lights', 1.6, 9).enemy('crab', 0, 12, { patrol: { axis: 'x', range: 1.8, speed: 2 } })
    .ring(-1.4, 4, { up: 3.2, r: 0.8, n: 6 }).lights(6, 0, 8, { spacing: 1.2 }).deco('reeds', -3.6, 8).deco('tree', 4.2, 12);
  // final: lilies in a zig-zag, nitros on the banks
  water(pads(b, 4, 'sinking', { zig: 1.1 }));
  b.floor(14, { w: 6 }).crate('nitro', -2.4, 4).crate('nitro', 2.4, 4).crate('basic', 0, 6).crate('time2', 0, 8)
    .crate('nitroSwitch', -2.2, 11).row('basic', 3, 1, 11, { spacing: 1.1 });
  hop(b, 3, { crate: 'lights' });
  b.floor(10).pyramid(3, 0, 5, 'basic').crate('time3', -2, 8).sign(S.almost, 2.1, 2);
  b.goal(10).deco('tree', -4, 5, 0, 1.5).deco('tree', 4, 5, 0, 1.5);
});

export default [L11, L12, L13, L14, L15];
