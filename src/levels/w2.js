// Île 2 — Dunes de Tozeur (Level design A). 2-1 … 2-5.
// The double jump is unlocked (B1) but the main path never needs it. "Come back later" areas (crates tagged
// `bonus: 'tornado' | 'superSlam'`) need the powers of B2 / B3.
// Same conventions as w1.js ("f 26" comments = forward distance from the origin).
import { t } from './builder.js';
import { make, hop, spawnAt, pads, collapse, CAM } from './w1.js';

const S = {
  dunes: t('Les dunes chantent. Faux. Très faux.', 'The dunes sing. Off-key. Very off-key.'),
  mirage: t('Mirage : ce panneau n\'existe pas.', 'Mirage: this sign does not exist.'),
  scorpion: t('Scorpions : ils pincent ET piquent. Double peine.', 'Scorpions: they pinch AND sting. Double whammy.'),
  cactus: t('Ce cactus saute. Ne demande pas comment. Ne demande rien.', 'This cactus jumps. Don\'t ask how. Don\'t ask anything.'),
  wind: t('Rafales ! Le vent chante faux, lui aussi.', 'Gusts! The wind sings off-key too.'),
  quicksand: t('Sables mouvants : ne reste pas planté là à lire ce panneau.', 'Quicksand: don\'t just stand there reading this sign.'),
  glide: t('Trop loin ? Il faudrait planer… Reviens après le Djinn.', 'Too far? You\'d need to glide… Come back after the Djinn.'),
  iron: t('Caisses en fer : il faudra un SUPER body-slam. Reviens plus tard, costaud.', 'Iron crates: you\'ll need a SUPER body slam. Come back later, champ.'),
  oasis: t('Oasis à 2 km. Ou à 2 m. Les mirages, c\'est pas précis.', 'Oasis 2 km ahead. Or 2 m. Mirages are not precise.'),
  doubleJump: t('Double saut : appuie deux fois. Comme pour un ascenseur pressé.', 'Double jump: press twice. Like an elevator you\'re late for.'),
  notCrash: t('Toujours pas Crash. Toujours des avocats.', 'Still not Crash. Still lawyers.'),
  medina: t('Médina : si tu te perds, c\'est normal. Les habitants aussi.', 'Medina: if you get lost, that\'s normal. So do the locals.'),
  cats: t('Les chats volent tes lucioles. Une toupie et ils les rendent. Les chats, quoi.', 'Cats steal your fireflies. Spin them and they give them back. Cats, right.'),
  roofs: t('Toits privés. Le propriétaire est un pigeon.', 'Private roofs. The owner is a pigeon.'),
  carpet: t('Tapis volant d\'occasion. Sans garantie. Sans pilote.', 'Second-hand flying carpet. No warranty. No pilot.'),
  lantern: t('Lanternes décoratives. Et contondantes.', 'Decorative lanterns. Also blunt.'),
  hammam: t('Hammam : vapeur brûlante. Serviette non fournie.', 'Hammam: scalding steam. Towel not included.'),
  souk: t('Souk : tout est négociable. Sauf les caisses. Elles, on les casse.', 'Souk: everything is negotiable. Except crates. Those we smash.'),
  chicken: t('Une poule. Inoffensive. Elle est juste là pour l\'ambiance.', 'A chicken. Harmless. It\'s just here for the vibe.'),
  stairs: t('312 marches. On a compté. Deux fois.', '312 steps. We counted. Twice.'),
  blue: t('Bleu et blanc : la seule palette autorisée par la mairie.', 'Blue and white: the only palette the town hall allows.'),
  pots: t('Les pots de fleurs tombent pour attirer l\'attention. Comme Oku Oku.', 'Flower pots fall to get attention. Like Oku Oku.'),
  view: t('Belle vue, hein ? Ne regarde pas en bas. Trop tard.', 'Nice view, huh? Don\'t look down. Too late.'),
  boat: t('Les barques font la navette. Pourboire apprécié.', 'Boats run a shuttle. Tips appreciated.'),
  beignet: t('Bambalouni à 200 m. Non, c\'est faux. Pas de budget beignets.', 'Bambalouni 200 m ahead. No, it\'s a lie. No donut budget.'),
  tajine: t('Le tajine est brûlant. Et très, très vexé.', 'The tajine is scalding. And very, very upset.'),
  recipe: t('Recette du jour : renard aux épices. NON MERCI. COURS.', 'Today\'s recipe: spiced fox. NO THANKS. RUN.'),
  camel: t('Chameau Express : pas de remboursement, pas de freins.', 'Camel Express: no refunds, no brakes.'),
  spit: t('Les chameaux sauvages crachent. Le tien aussi, mais poliment.', 'Wild camels spit. Yours too, but politely.'),
  turbo: t('Le chameau a vu une oasis. TURBO.', 'The camel saw an oasis. TURBO.'),
  canyon: t('Canyon étroit. Respire par le nez.', 'Narrow canyon. Breathe through your nose.'),
  almost: t('Le portail est derrière cette dune. Ou la suivante. Ou… bon.', 'The portal is behind this dune. Or the next. Or… well.'),
  hole: t('Attention : trou. Le sable aussi a peur du vide.', 'Warning: hole. Even sand is afraid of heights.'),
};

/** n stairs of `rise` (≤ 0.32 → walkable without jumping) and `run` deep. */
function stairs(b, n, rise, run, opts = {}) {
  for (let i = 0; i < n; i++) b.step(rise, run, opts);
  return b;
}

/**
 * A closed rock alcove on the side of the path, its doorway filled with 2-high iron crates (super slam to open).
 * side = ±1, `half` = half width of the floor it sits next to. Walls are 5 m high (more than a double jump).
 */
function ironVault(b, side, fwd, { depth = 4, len = 4, half = b.width / 2 } = {}) {
  const mid = side * (half + depth / 2);
  b.block(mid, 0, fwd, depth, 4, len + 1.2, { kind: 'stone' });
  b.block(mid, 5, fwd - len / 2 - 0.3, depth, 5, 0.6, { kind: 'stone' });
  b.block(mid, 5, fwd + len / 2 + 0.3, depth, 5, 0.6, { kind: 'stone' });
  b.block(side * (half + depth + 0.3), 5, fwd, 0.6, 5, len + 1.2, { kind: 'stone' });
  for (let i = 0; i < len; i++) {
    const f = fwd - len / 2 + 0.5 + i;
    b.crate('iron', side * (half + 0.5), f).crate('iron', side * (half + 0.5), f, 1);
  }
  b.block(side * (half + 0.5), 5, fwd, 1, 3, len, { kind: 'stone' });
  const inner = side * (half + 2.2), bonus = { bonus: 'superSlam' };
  b.crate('life', inner, fwd - 1, 0, bonus).crate('basic', inner, fwd + 1, 0, bonus)
    .crate('basic', inner + side * 1.1, fwd, 0, bonus).crate('lights', inner + side * 1.1, fwd, 1, bonus)
    .lights(4, inner, fwd - 1.5, { spacing: 1, up: 2.2 });
  return b;
}

// ================================================================== 2-1 Les Dunes qui Chantent
const L21 = make({
  id: '2-1', world: 2, index: 1, name: t('Les Dunes qui Chantent', 'The Singing Dunes'), theme: 'desert', music: 'desert', mode: 'run',
  ground: 'sand',
  intro: t('Bienvenue à Tozeur ! Il fait 52 °C. À l\'ombre. Il n\'y a pas d\'ombre.', 'Welcome to Tozeur! It\'s 52 °C. In the shade. There is no shade.'),
  timeTrial: { gold: 62, silver: 78, bronze: 100 },
}, (b) => {
  // --- arrival (f 0 … 24)
  b.floor(24); spawnAt(b, 0, 1.5); b.gag('tozeur', -6, 18);
  b.sign(S.dunes, -2.1, 4).sign(S.doubleJump, 2.1, 9).lights(6, 0, 5, { spacing: 1.2 })
    .crate('basic', -1.6, 9).stack(['basic', 'basic'], 1.6, 12).crate('lights', -1.6, 15).crate('time1', 0.8, 18)
    .enemy('scorpion', 0, 20, { patrol: { axis: 'x', range: 1.6, speed: 1.4 } })
    .deco('cactus', -4, 3).deco('palm', 4.5, 8, 0, 1.3).deco('cactus', 4, 16).deco('dune', -7, 14, 0, 2);
  // --- singing dunes: up & down, seen from the side (f 24 … 54)
  b.zone(30, { camera: CAM.sideZ });
  b.step(1, 5).crate('basic', 1.5, 2.5).lights(3, 0, 0.5, { up: 1.2 });
  b.step(1, 5).enemy('cactus', -1.5, 3).lights(3, 0, 1, { up: 1.2 });
  b.step(-1, 5).crate('basic', -1.5, 2.5).crate('basic', 1.5, 2.5);
  b.step(-1, 5).lights(3, 0, 1, { up: 0.8 });
  hop(b, 3.5).sign(S.hole, -2.1, -3);
  b.floor(7).crate('basic', 0, 1).crate('basic', 1.8, 4).deco('rock', 4, 3, 0, 1.6);
  // --- quicksand: sinking platforms over a sandy pit (f 54 … 66)
  pads(b, 2, 'sinking', { w: 3 }); b.sign(S.quicksand, 2.1, -2);
  // --- checkpoint oasis (f 66 … 84)
  b.floor(18, { w: 7 }).checkpoint(-2, 3).crate('mask', 2.4, 3).sign(S.oasis, -3, 7)
    .enemy('camel', 3.8, 10).enemy('scorpion', -1, 12, { patrol: { axis: 'x', range: 2, speed: 1.6 } })
    .row('basic', 3, 0, 15, { spacing: 1.2 }).deco('palm', -5, 5, 0, 1.4).deco('camel_vacation', 5, 4).deco('palm', 5.5, 15);
  // the sock: walk around the back of the big dune on the left (narrow ledge, hidden from the camera)
  b.block(-6.2, 0, 9, 1.6, 4, 12, { kind: 'sand' }).deco('dune', -4.8, 9, 0, 2.6)
    .sock('green', -6.4, 4, 0.7).lights(4, -6.2, 6, { spacing: 1.6 });
  // --- wind walkway: gusts push sideways (f 84 … 112)
  b.floor(28, { w: 3.4, kind: 'stone' }).sign(S.wind, -2.2, 1)
    .hazard('wind', 0, 7, { w: 6, d: 8, h: 4, force: { x: 3.2, z: 0 } })
    .hazard('wind', 0, 20, { w: 6, d: 8, h: 4, force: { x: -3.2, z: 0 } })
    .crate('basic', -1.1, 5).crate('basic', 1.1, 10).crate('lights', 0, 14).crate('basic', 1.1, 17).crate('basic', -1.1, 20)
    .lights(12, 0, 2, { spacing: 2 });
  hop(b, 3.5);
  // --- ruins: switch staircase to an ancient wall (f 115.5 … 139.5)
  b.floor(24, { w: 7, kind: 'stone' }).crate('switch', -2.6, 3, 0, { group: 'ruins' }).sign(S.notCrash, -3.2, 6)
    .crate('outline', 2.4, 6, 0, { group: 'ruins' }).crate('outline', 2.4, 7.2, 0, { group: 'ruins' }).crate('outline', 2.4, 7.2, 1, { group: 'ruins' })
    .block(4.4, 3.4, 12, 3, 7.4, 8, { kind: 'stone' })
    .crate('basic', 4.4, 9.5, 3.4).crate('basic', 4.4, 11, 3.4).crate('life', 4.4, 12.5, 3.4).crate('basic', 4.4, 14.5, 3.4)
    .lights(5, 4.4, 9, { spacing: 1.3, up: 4.3 })
    .enemy('cactus', -1, 13).crate('tnt', -2.6, 18).crate('basic', -2.6, 19.1).crate('basic', -1.5, 18)
    .deco('arch', -4.5, 4, 0, 1.4).deco('arch', -4.5, 14, 0, 1.4);
  // --- tornado bonus: a floating ruin far to the right of the next dune top
  hop(b, 3);
  b.step(1.2, 8).enemy('scorpion', 0, 4, { patrol: { axis: 'x', range: 1.5, speed: 1.8 } });
  b.step(1.2, 8).sign(S.glide, 2.1, 2).crate('basic', -1.6, 4).lights(3, 0, 4, { up: 1.2 })
    .block(16.5, 0, 4, 4, 1, 4, { kind: 'stone' }).crate('basic', 16, 3.2, 0, { bonus: 'tornado' })
    .crate('lights', 17, 4.8, 0, { bonus: 'tornado' }).lights(8, 6, 4, { spacing: 1.2, axis: 'lat', up: 1.4 })
    .deco('arch', 18, 4, 0, 1.3);
  b.step(-2.4, 10).checkpoint(1.8, 3).crate('basic', -1.8, 6).lights(4, 0, 2, { spacing: 1.4 });
  // --- scorpion arena + iron vault (f ~171 … 193)
  b.floor(22, { w: 8 }).sign(S.scorpion, -3.4, 1)
    .enemy('scorpion', -2, 6, { patrol: { axis: 'x', range: 2.4, speed: 2 } })
    .enemy('scorpion', 2, 11, { patrol: { axis: 'x', range: 2.4, speed: 2.2 } })
    .enemy('cactus', 0, 16).crate('mystery', -3, 9).crate('legs', 2.5, 15).row('basic', 2, -2.5, 19, { spacing: 1.2 })
    .sign(S.iron, 3.4, 4);
  ironVault(b, 1, 9, { depth: 4, len: 4, half: 4 });
  b.lights(6, 0, 3, { spacing: 1.2 });
  // --- climax: quicksand + cactus + nitro (f 193 … )
  hop(b, 4, { crate: 'basic' });
  b.floor(10).enemy('cactus', 1.5, 5).crate('basic', -1.6, 3).crate('time2', 0, 7);
  pads(b, 3, 'sinking', { zig: 1 });
  b.floor(16).checkpoint(0, 2).crate('nitro', -1.8, 6).crate('nitro', 1.8, 6).crate('basic', 0, 8)
    .enemy('scorpion', 0, 12, { patrol: { axis: 'x', range: 1.8, speed: 2.4 } }).lights(5, 0, 4, { spacing: 2 });
  b.step(1, 6).crate('basic', 1.6, 3);
  b.step(1, 6).crate('basic', -1.6, 3).enemy('cactus', 1.4, 4);
  hop(b, 4, { arc: 1.8 });
  b.step(-2, 18, { w: 6 }).crate('nitroSwitch', -2.2, 4).crate('time3', 1.5, 5)
    .pyramid(3, 1, 10, ['basic', 'lights', 'basic']).crate('basic', -2.2, 10).crate('basic', -2.2, 12)
    .sign(S.almost, -2.6, 14).sign(S.mirage, 2.8, 15).lights(6, -1, 7, { spacing: 1.3 });
  b.goal(10).deco('palm', -4, 5, 0, 1.6).deco('palm', 4, 5, 0, 1.6);
});

// ================================================================== 2-2 Médina Labyrinthe (side-scroller, walks +X)
const L22 = make({
  id: '2-2', world: 2, index: 2, name: t('Médina Labyrinthe', 'Medina Maze'), theme: 'medina', music: 'medina', mode: 'side',
  dir: 'x', ground: 'tile', width: 4,
  intro: t('La médina vue de côté. Les ruelles sont plus simples comme ça. Plus plates, surtout.', 'The medina from the side. The alleys are simpler like that. Flatter, mostly.'),
  timeTrial: { gold: 58, silver: 74, bronze: 96 },
}, (b) => {
  const sign = (text, fwd) => b.sign(text, 1.4, fwd);
  // --- street (f 0 … 22)
  b.floor(22); spawnAt(b, 0, 1.5); b.gag('carpets', 3.2, 14);
  sign(S.medina, 3); b.lights(5, 0, 5, { spacing: 1.2 }).crate('basic', 0, 9).enemy('chicken', 0, 12, { patrol: { axis: 'z', range: 2, speed: 1 } })
    .stack(['basic', 'basic'], 0, 16).crate('time1', 0, 19)
    .deco('house_white', 0, 4, 0, 1, 0).deco('house_blue', 0, 10).deco('lantern', 0, 14, 3);
  sign(S.chicken, 11);
  // --- stairs up to the rooftops (f 22 … 31)
  b.step(1, 3).step(1, 3).step(1.2, 3).lights(3, 0, 0.5, { up: 1 });
  // --- rooftops with gaps, pigeons (f 31 … 80), y 3.2
  b.floor(10, { kind: 'brick' }).crate('basic', 0, 2.5).enemy('pigeon', 0, 8, { up: 2.5 });
  sign(S.roofs, 2);
  hop(b, 3);
  b.floor(8, { kind: 'brick' }).crate('lights', 0, 1.5);
  hop(b, 3.5, { crate: 'basic' });
  b.step(1, 8, { kind: 'brick' }).crate('basic', 0, 1.6).enemy('cat', 0, 4.5);
  sign(S.cats, 1);
  hop(b, 3);
  b.step(-1.5, 9, { kind: 'brick' }).stack(['basic', 'mask'], 0, 1.6).enemy('pigeon', 0, 6, { up: 2.5 });
  // --- clothesline: moving platform across the wide alley (f 80 … 92)
  b.gap(12).platform('moving', 0, 2.5, { w: 2.4, d: 2, to: { fwd: 7 }, period: 4 }).lights(8, 0, 1, { spacing: 1.4, up: 1.2 });
  sign(S.carpet, -1);
  b.floor(8, { kind: 'brick' }).checkpoint(0, 1.5);
  // --- drop to the souk: lanterns swing (f 100 … 132)
  b.step(-2.7, 32);
  sign(S.souk, 2); sign(S.lantern, 8);
  b.hazard('pendulum', 0, 9, { length: 3, speed: 1.6 }).stack(['basic', 'basic'], 0, 3).crate('basic', 0, 6).crate('basic', 0, 12)
    .enemy('cat', 0, 15).crate('mystery', 0, 18).hazard('pendulum', 0, 21, { length: 3, speed: 1.9, offset: 0.8 })
    .crate('legs', 0, 25).lights(12, 0, 3, { spacing: 2.2 }).crate('time2', 0, 29)
    .deco('lantern', 0, 6, 2.5).deco('pot', 0, 12).deco('lantern', 0, 20, 2.5).deco('lantern', 0, 27, 3);
  // the cellar: a hole in the street floor drops into a little cellar full of fireflies, a step leads back up
  b.gap(2.2).block(0, -2, 1.1, 4, 0.5, 2.2).lights(3, 0, 0.5, { spacing: 0.6, up: -1.4 }).crate('basic', 0, 0.6, -2);
  b.floor(3).block(0, -1, -0.5, 4, 0.5, 1);
  // --- minaret: switch puzzle, outline staircase to the balcony (f 137 … 157)
  b.floor(20).crate('switch', 0, 2, 0, { group: 'minaret' }).enemy('chicken', 0, 5, { patrol: { axis: 'z', range: 1.5, speed: 1.2 } })
    .crate('outline', 0, 9, 0, { group: 'minaret' }).crate('outline', 0, 10.2, 0, { group: 'minaret' }).crate('outline', 0, 10.2, 1, { group: 'minaret' })
    .block(0, 3.4, 14.5, 4, 3.4, 4, { kind: 'brick' }).crate('life', 0, 13.5, 3.4).crate('basic', 0, 15.5, 3.4)
    .lights(4, 0, 13, { spacing: 1, up: 4.3 }).deco('minaret', -0.5, 14.5, 0, 1.4)
    // the sock: on the very top of the minaret, a double jump above the balcony (off the top of the screen)
    .block(0, 7, 14.5, 2, 0.6, 2, { kind: 'brick' }).sock('purple', 0, 14.5, 7.7).lights(3, 0, 14.5, { spacing: 0.01, up: 5.2 });
  // --- hammam vents (f 157 … 181)
  b.floor(24, { kind: 'tile' }).hazard('fireJet', 0, 5, { period: 2.2 }).hazard('fireJet', 0, 10, { period: 2.2, offset: 1.1 })
    .hazard('fireJet', 0, 15, { period: 2.2 }).crate('basic', 0, 7.5).crate('basic', 0, 12.5).crate('lights', 0, 19)
    .lights(8, 0, 3, { spacing: 2, up: 1.4 }).checkpoint(0, 22);
  sign(S.hammam, 2);
  // --- awnings bounce you up to the roofs again (or climb the market stall) (f 181 … 187)
  b.floor(6).platform('bouncy', 0, 2.5, { w: 1.6, d: 2, h: 0.6, up: 0.6 }).block(0, 1.7, 5.2, 4, 1.7, 1.6, { kind: 'wood' });
  sign(S.carpet, 0);
  // roof A (y 3.4)
  b.step(3.4, 12, { kind: 'brick' }).crate('basic', 0, 3).enemy('pigeon', 0, 7, { up: 2.4 }).crate('basic', 0, 10);
  // roof B: thin roof with an iron hatch; under it a closed room (super slam the hatch, a spring brings you back up)
  sign(S.iron, 4);
  b.floor(7, { kind: 'brick', thick: 0.6 }).lights(3, 0, 5, { up: 1.2, spacing: 1 });
  b.gap(1).crate('iron', 0, 0.5, -1, { float: true });
  b.floor(8, { kind: 'brick', thick: 0.6 });
  b.a -= 8; // room coordinates from the start of roof B
  b.block(0, -4.4, 8, 4, 0.5, 16, { kind: 'wood' })                       // room floor
    .block(0, -0.6, 0.25, 4, 3.8, 0.5, { kind: 'brick' }).block(0, -0.6, 15.75, 4, 3.8, 0.5, { kind: 'brick' }) // walls
    .crate('iron', 0, 7.5, -4.4).crate('ironBounce', 0, 7.5, -3.4)
    .crate('basic', 0, 3, -4.4, { bonus: 'superSlam' }).crate('life', 0, 5, -4.4, { bonus: 'superSlam' })
    .crate('basic', 0, 11, -4.4, { bonus: 'superSlam' }).crate('lights', 0, 13, -4.4, { bonus: 'superSlam' })
    .lights(4, 0, 9.5, { spacing: 1, up: -3.6 });
  b.a += 8;
  b.zone(36, { camera: { mode: 'side', dist: 15, height: 4.5, lookUp: 2 } });
  // --- the alley: the main path drops 5 m; the tornado roof stays up there, 14 m away (f 203 … 225)
  b.step(-5, 22, { kind: 'tile' }).crate('basic', 0, 4).enemy('cat', 0, 9).crate('basic', 0, 12).crate('time2', 0, 18)
    .lights(6, 0, 3, { spacing: 2.4 })
    .block(0, 5.6, 15.5, 4, 0.6, 6, { kind: 'wood' }).crate('basic', 0, 14, 5.6, { bonus: 'tornado' })
    .crate('lights', 0, 16, 5.6, { bonus: 'tornado' }).lights(8, 0, -1, { spacing: 1.7, up: 6.6, arc: 0.8 })
    .deco('lantern', 0, 15.5, 6.2);
  sign(S.glide, -1);
  b.step(1.3, 4);
  b.step(1.3, 4).lights(2, 0, 1, { spacing: 2 });
  // --- final rooftops (f 245 … )
  b.step(1.3, 10, { kind: 'brick' }).crate('basic', 0, 2.5).enemy('pigeon', 0, 7, { up: 2.5 });
  hop(b, 3.5);
  b.step(-1, 8, { kind: 'brick' }).stack(['basic', 'basic'], 0, 1.6);
  hop(b, 4, { crate: 'lights' });
  b.step(-1.2, 8).enemy('cat', 0, 4).crate('time3', 0, 6);
  b.step(0, 16).crate('basic', 0, 3).stack(['basic', 'basic'], 0, 6).crate('basic', 0, 9).lights(5, 0, 10, { spacing: 1 });
  sign(S.almost, 12);
  b.goal(10).deco('arch', -1, 5, 0, 1.6);
});

// ================================================================== 2-3 Escaliers de Sidi Bou Saïd
const L23 = make({
  id: '2-3', world: 2, index: 3, name: t('Escaliers de Sidi Bou Saïd', 'Sidi Bou Said Stairs'), theme: 'sidibou', music: 'sidibou', mode: 'run',
  ground: 'tile',
  intro: t('Le plus beau village du monde. Et le plus d\'escaliers au mètre carré.', 'The most beautiful village in the world. And the most stairs per square metre.'),
  timeTrial: { gold: 66, silver: 84, bronze: 110 },
}, (b) => {
  // --- harbour (f 0 … 20)
  b.floor(20, { kind: 'stone' }); spawnAt(b, 0, 1.5); b.gag('bluepaint', 5.5, 16);
  b.sign(S.blue, -2.1, 4).lights(5, 0, 4, { spacing: 1.2 }).crate('basic', 1.6, 8).enemy('cat', -1, 12)
    .stack(['basic', 'lights'], 1.6, 15).crate('time1', -1, 17)
    .deco('cat_wall', -4.2, 6, 0, 1).deco('house_blue', 5, 10, 0, 1.4).deco('bougainvillea', -4, 15);
  // --- first staircase, walkable (f 20 … 32, +3 m)
  b.zone(26, { camera: CAM.high });
  b.sign(S.stairs, 2.1, -1);
  stairs(b, 10, 0.3, 0.6);
  b.lights(6, 0, -5, { spacing: 1, up: 1 });
  b.floor(8).crate('basic', -1.6, 3).crate('basic', 1.6, 3).enemy('pigeon', 0, 6, { up: 2.4 });
  stairs(b, 8, 0.3, 0.6);
  b.floor(10, { w: 6 }).checkpoint(-2, 3).crate('mask', 2, 3).lights(4, 0, 5, { spacing: 1.2 })
    .deco('house_blue', -3.6, 6).deco('house_white', 4.5, 6, 0, 1.3);
  // --- terraces zig-zag up (big steps: jump) (f ~51 …)
  b.side(2).step(1.2, 6).crate('basic', 1.4, 3).deco('pot', -2.4, 2);
  b.side(-3).step(1.2, 6).enemy('cat', 0, 3).deco('pot', 2.4, 2);
  b.side(3).step(1.2, 6).crate('lights', 1.5, 3);
  b.side(-2).step(1.2, 8).sign(S.pots, 2.2, 1).crate('basic', -1.6, 5).lights(4, 0, 2, { spacing: 1.4 });
  // --- falling flower pots bridge (f ~77 …)
  collapse(b, 5, { delay: 0.4 });
  b.floor(12).crate('basic', 0, 4).enemy('pigeon', 0, 8, { up: 2.4 }).stack(['basic', 'basic'], -1.6, 10);
  // --- the dome: the sock sits on top (double jump from the balcony)
  b.block(4.6, 1.8, 6, 3, 1.8, 3, { kind: 'tile' }).block(4.6, 5.4, 6, 2, 0.6, 2, { kind: 'tile' })
    .sock('blue', 4.6, 6, 6.1).deco('dome', 4.6, 6, 1.8, 1.6).crate('basic', 4.6, 5, 1.8).lights(3, 4.6, 6, { spacing: 0.01, up: 3.4 });
  // --- big staircase with gaps, high camera (f ~102 …, +5.4 m). The outline crates of the café switch wait here:
  // the "!" is at the top, so you have to come back down (Crash rule: backtracking is a feature).
  b.zone(40, { camera: CAM.high });
  stairs(b, 6, 0.3, 0.6);
  b.floor(3).crate('outline', 1.4, 1.5, 0, { group: 'cafe' }).crate('outline', -1.4, 1.5, 0, { group: 'cafe' });
  hop(b, 2.5);
  stairs(b, 6, 0.3, 0.6, { w: 4 });
  b.floor(4).enemy('cat', 0, 2).crate('outline', 1.4, 3, 0, { group: 'cafe' });
  hop(b, 3);
  stairs(b, 6, 0.3, 0.6, { w: 4 });
  b.floor(10, { w: 6 }).checkpoint(0, 2).crate('basic', -2, 6).crate('basic', 2, 6).sign(S.view, -2.6, 4)
    .crate('switch', 2.2, 9, 0, { group: 'cafe' });
  // --- clifftop café terrace on the left (a little jump up)
  b.block(-6.5, 1, 5, 4, 5, 6, { kind: 'tile' }).crate('outline', -6.5, 3, 1, { group: 'cafe' })
    .crate('basic', -6.5, 4.5, 1).crate('life', -7.4, 6.5, 1).crate('basic', -5.6, 6.5, 1).lights(4, -6.5, 3, { spacing: 1, up: 2 })
    .deco('umbrella', -7.5, 4, 1).deco('pot', -6, 6, 1);
  // --- windy cliff path (f ~146 …)
  b.floor(24, { w: 3.2, kind: 'stone' }).sign(S.wind, -2.1, 1)
    .hazard('wind', 0, 8, { w: 6, d: 10, h: 4, force: { x: 3, z: 0 } }).hazard('wind', 0, 19, { w: 6, d: 6, h: 4, force: { x: -3, z: 0 } })
    .crate('basic', -1, 4).crate('basic', 1, 8).crate('lights', 0, 13).enemy('pigeon', 0, 16, { up: 2.4 }).crate('basic', 1, 17)
    .lights(10, 0, 2, { spacing: 2 });
  // --- tornado bonus: the lighthouse rock out at sea (13 m to the right)
  b.block(16.5, 0, 12, 4, 6, 4, { kind: 'stone' }).crate('basic', 16, 11, 0, { bonus: 'tornado' }).crate('basic', 17, 13, 0, { bonus: 'tornado' })
    .crate('life', 16.5, 12, 0, { bonus: 'tornado' }).deco('tower', 17.5, 12, 0, 1.2).sign(S.glide, 1.8, 11);
  // --- boats shuttle across the bay (f ~170 …)
  b.step(-3, 6, { kind: 'stone' }).sign(S.boat, 2.1, 2);
  b.gap(14).platform('moving', 0, 2.5, { w: 3, d: 2.6, to: { fwd: 9 }, period: 4.5 })
    .lights(8, 0, 1, { spacing: 1.6, up: 1.2 }).hazard('water', 0, 7, { w: 30, d: 14, up: -0.6 });
  b.floor(10, { kind: 'stone' }).checkpoint(-1.6, 2).crate('basic', 1.6, 5).enemy('cat', 0, 7);
  // --- the last climb: blue stairs + doors + iron vault café (f ~200 …)
  b.zone(30, { camera: CAM.high });
  stairs(b, 8, 0.3, 0.6, { w: 5 });
  b.lights(6, 0, -4, { spacing: 0.8, up: 1 });
  b.floor(14, { w: 6 }).crate('mystery', -2, 3).enemy('pigeon', 0, 6, { up: 2.4 }).crate('legs', 1.5, 10).sign(S.beignet, -2.6, 9)
    .sign(S.iron, 2.6, 2);
  ironVault(b, 1, 6, { depth: 4, len: 3, half: 3 });
  hop(b, 3.5);
  b.step(1.2, 6).crate('basic', 0, 1);
  hop(b, 3.5, { crate: 'basic' });
  b.step(1.2, 6).enemy('cat', 0, 3);
  b.step(1.2, 6).stack(['basic', 'basic'], -1.6, 3).crate('time2', 1, 4);
  stairs(b, 6, 0.3, 0.6);
  b.floor(16, { w: 6 }).pyramid(3, -1.2, 6, ['basic', 'lights']).crate('time3', 1.8, 9).lights(6, 2, 2, { spacing: 1.4 })
    .sign(S.almost, 2.6, 12).deco('house_blue', -5, 8, 0, 1.4).deco('house_white', 5, 4, 0, 1.4);
  b.goal(10).deco('house_blue', 0, 8, 0, 1.6);
});

// ================================================================== 2-4 Le Tajine Fou (chase)
const L24 = make({
  id: '2-4', world: 2, index: 4, name: t('Le Tajine Fou', 'The Mad Tajine'), theme: 'desert', music: 'chase', mode: 'chase',
  ground: 'sand', width: 5.5,
  intro: t('Un tajine géant a perdu la tête. Et son couvercle. Il te veut. COURS.', 'A giant tajine lost its mind. And its lid. It wants you. RUN.'),
  timeTrial: { gold: 42, silver: 52, bronze: 68 },
}, (b) => {
  b.at(0, 0, -18).floor(18).hazard('boulder', 0, 4, { style: 'tajine', speed: 7 });
  b.floor(16); spawnAt(b, 0, 1); b.gag('mirage', 6, 10);
  b.sign(S.tajine, 2.4, 3).sign(S.recipe, -2.4, 8).lights(6, 0, 4, { spacing: 1.4 }).crate('basic', -2.2, 10).crate('time1', 2.2, 12);
  hop(b, 3);
  b.floor(14).enemy('scorpion', -1.8, 10, { patrol: { axis: 'x', range: 0.6, speed: 1.2 } }).crate('basic', 2.2, 9)
    .block(0, 0.7, 6, 5.5, 0.7, 0.9, { kind: 'wood' }).lights(3, 0, 5, { spacing: 1, up: 1.8 });
  hop(b, 3.5);
  b.step(1, 12).crate('switch', 2.2, 2, 0, { group: 'spice' }).crate('basic', -2.2, 5).enemy('cactus', -2, 9)
    .lights(6, 0.5, 3, { spacing: 1.4 });
  hop(b, 3);
  b.floor(16).checkpoint(-2.2, 2).crate('outline', 2.2, 5, 0, { group: 'spice' }).crate('outline', 2.2, 8, 0, { group: 'spice' })
    .crate('outline', 2.2, 11, 0, { group: 'spice' }).crate('tnt', -0.8, 9).lights(6, 0, 4, { spacing: 2 });
  hop(b, 3.5, { crate: 'basic' });
  b.step(-1, 12).hazard('fireJet', -1.4, 4, { period: 2 }).hazard('fireJet', 1.4, 8, { period: 2, offset: 1 })
    .crate('basic', 2.2, 4).crate('basic', -2.2, 8).lights(5, 0, 2, { spacing: 2 });
  // sock: in a niche on the left, behind a column
  b.floor(10).block(-4.3, 0, 5, 3, 4, 3, { kind: 'stone' }).sock('red', -4.6, 5.5, 0.8).deco('arch', -3.4, 4, 0, 1.3)
    .crate('basic', -4, 4.2).stack(['basic', 'basic'], 2.2, 6);
  hop(b, 4);
  b.zone(14, { camera: { mode: 'front', dist: 8.5, height: 4.4, lookAhead: -2 } });
  b.floor(14, { w: 4, kind: 'bridge' }).sign(S.hole, 2.4, 1).crate('tnt', 1, 4).crate('tnt', -1, 8).crate('tnt', 1, 12)
    .crate('basic', -1, 4).crate('basic', 1, 8).lights(8, 0, 1, { spacing: 1.7 });
  hop(b, 3);
  b.floor(16).checkpoint(2.2, 2).enemy('scorpion', 0, 7, { patrol: { axis: 'x', range: 2, speed: 2 } })
    .crate('mystery', -2.2, 6).crate('legs', 2, 10).crate('mask', -2.2, 12).lights(5, 0, 3, { spacing: 2.4 });
  hop(b, 3.5);
  b.step(1, 10).enemy('cactus', 2, 5).crate('basic', -2.2, 5).lights(4, 0, 3, { spacing: 1.2 });
  hop(b, 3, { crate: 'lights' });
  b.step(-1, 12);
  pads(b, 2, 'sinking', { zig: 0.8 });
  b.floor(14).hazard('fireJet', 0, 4, { period: 1.8 }).crate('basic', -2.2, 4).crate('basic', 2.2, 4)
    .enemy('scorpion', -1.2, 9, { patrol: { axis: 'x', range: 1.2, speed: 2.4 } }).crate('time2', 1.6, 11).lights(5, 0, 6, { spacing: 1.4 });
  hop(b, 4);
  b.floor(12).row('basic', 2, 0, 3, { spacing: 4.4 }).crate('tnt', 0, 7).row('basic', 2, 0, 10, { spacing: 4.4 })
    .lights(4, 1.2, 4, { spacing: 1.6 });
  hop(b, 3.5, { crate: 'basic' });
  // dune switchback: up, a gap, down, sinking sand again
  b.step(1, 10).crate('basic', -2.2, 3).crate('basic', 2.2, 3).enemy('scorpion', 0, 7, { patrol: { axis: 'x', range: 1.8, speed: 2.6 } });
  hop(b, 3.5);
  b.step(1, 10).crate('lights', 2.2, 4).hazard('fireJet', -1, 6, { period: 1.6 }).lights(5, 1, 2, { spacing: 1.6 });
  hop(b, 4, { arc: 1.8 });
  b.step(-2, 12).checkpoint(-2.2, 2).crate('basic', 2.2, 6).crate('tnt', 0, 9).crate('basic', -2.2, 9.5).lights(5, 1.2, 4, { spacing: 1.4 });
  pads(b, 2, 'sinking', { zig: -0.8 });
  b.floor(12).row('basic', 2, 0, 4, { spacing: 4.4 }).enemy('cactus', 0, 8).lights(4, 0, 2, { spacing: 1.2 });
  hop(b, 3);
  b.floor(16).enemy('cactus', -2, 4).enemy('cactus', 2, 9).crate('basic', 0, 6).stack(['basic', 'basic'], 2.2, 13)
    .crate('time3', -1.5, 14).lights(6, 0, 2, { spacing: 1.2 }).sign(S.almost, -2.4, 12);
  b.goal(12).deco('palm', -4, 5, 0, 1.8).deco('palm', 4, 5, 0, 1.8);
});

// ================================================================== 2-5 Chameau Express (ride)
const L25 = make({
  id: '2-5', world: 2, index: 5, name: t('Chameau Express', 'Camel Express'), theme: 'desert', music: 'ride', mode: 'ride',
  mount: 'camel', autoRun: 12, ground: 'sand', width: 7,
  intro: t('Le chameau ne s\'arrête jamais. Tu non plus, du coup.', 'The camel never stops. So neither do you.'),
  timeTrial: { gold: 42, silver: 50, bronze: 62 },
}, (b) => {
  b.floor(30); spawnAt(b, 0, 2); b.gag('camel', -6.5, 20);
  b.sign(S.camel, -3, 6).weave(16, 8, { amp: 2.5, spacing: 1.3 }).row('basic', 3, 0, 24, { spacing: 1.3 }).crate('time1', -2.6, 27)
    .deco('cactus', -5, 6).deco('palm', 5.5, 14).deco('dune', -8, 22, 0, 2);
  b.floor(30).sign(S.spit, 3.5, 2).enemy('camel', -4.6, 8).enemy('camel', 4.6, 18)
    .block(-2, 1.2, 6, 2.6, 1.2, 1.4, { kind: 'stone' }).block(2, 1.2, 13, 2.6, 1.2, 1.4, { kind: 'stone' })
    .crate('basic', 2, 6).crate('basic', -2, 13).enemy('scorpion', 0, 20, { patrol: { axis: 'x', range: 2.5, speed: 2.2 } })
    .crate('lights', -2.4, 24).crate('basic', 2.4, 24).weave(10, 14, { amp: 2, spacing: 1.5 });
  hop(b, 4.5, { arc: 2 });
  b.floor(24).checkpoint(0, 2).hazard('fireJet', -2.3, 8, { period: 2 }).hazard('fireJet', 0, 8, { period: 2, offset: 1 })
    .hazard('fireJet', 2.3, 8, { period: 2 }).row('basic', 3, 0, 14, { spacing: 2.3 })
    .crate('nitro', -2.6, 19).crate('nitro', 2.6, 19).weave(8, 16, { amp: 0, spacing: 1 });
  hop(b, 5, { arc: 2.2, crate: 'basic', crateUp: 0.6 });
  // switch lane
  b.floor(28).crate('switch', 0, 3, 0, { group: 'caravan' })
    .crate('outline', -2.4, 12, 0, { group: 'caravan' }).crate('outline', -2.4, 14, 0, { group: 'caravan' })
    .crate('outline', -2.4, 16, 0, { group: 'caravan' }).crate('outline', -2.4, 18, 0, { group: 'caravan' })
    .block(2, 1.2, 10, 3, 1.2, 1.4, { kind: 'stone' }).crate('tnt', 2.4, 18).crate('basic', 2.4, 22).crate('basic', 0, 25)
    .weave(10, 6, { amp: 1.5, spacing: 1.6 });
  // canyon: slow and tight
  b.zone(46, { autoRun: 9, toast: S.canyon });
  b.floor(46, { w: 4.4, kind: 'stone' }).walls(46, { h: 5, kind: 'stone', spread: 4.4 })
    .block(-1.2, 1.2, 6, 2, 1.2, 1, { kind: 'stone' }).block(1.2, 1.2, 12, 2, 1.2, 1, { kind: 'stone' })
    .block(-1.2, 1.2, 18, 2, 1.2, 1, { kind: 'stone' }).block(1.2, 1.2, 24, 2, 1.2, 1, { kind: 'stone' })
    .crate('basic', 1.2, 6).crate('basic', -1.2, 12).crate('basic', 1.2, 18).crate('basic', -1.2, 24)
    .hazard('spikes', 0, 30, { period: 2.4 }).crate('lights', 0, 34).crate('mask', 1.2, 38)
    .enemy('scorpion', 0, 42, { patrol: { axis: 'x', range: 1.2, speed: 1.4 } }).weave(18, 4, { amp: 1.2, spacing: 2, period: 6 });
  b.floor(20, { w: 7 }).checkpoint(-2.4, 3).row('basic', 3, 1.2, 9, { axis: 'fwd', spacing: 1.4 }).crate('legs', -2, 14)
    .crate('mystery', 2.6, 16).weave(10, 2, { amp: 2.4, spacing: 1.6 });
  hop(b, 4.5, { arc: 2 });
  // fork: right = main, left = narrow ridge with the sock
  b.floor(34, { w: 4, lat: 1.5, advance: false }).floor(34, { w: 1.8, lat: -3.7, kind: 'stone' });
  b.sock('purple', -3.7, 24, 0.8).lights(12, -3.7, 3, { spacing: 1.7 })
    .crate('basic', 1.5, 5).enemy('camel', 4.8, 10).crate('basic', 2.6, 12).crate('tnt', 0.6, 16).crate('basic', 2.6, 20)
    .hazard('fireJet', 1.5, 25, { period: 1.6 }).crate('basic', 0.5, 29).crate('time2', 2.5, 31);
  hop(b, 4, { arc: 1.8 });
  // turbo stretch
  b.zone(66, { autoRun: 16, toast: S.turbo });
  b.floor(30).weave(16, 2, { amp: 2, spacing: 1.7, period: 12 }).row('basic', 3, 0, 27, { spacing: 1.3 })
    .crate('nitro', 0, 10).crate('tnt', -2.6, 18).crate('tnt', 2.6, 18);
  hop(b, 6, { arc: 2.4 });
  b.floor(30).row('basic', 3, -1, 5, { spacing: 1.3 }).crate('nitro', 2.6, 5).crate('lights', 0, 12)
    .block(-2.4, 1.2, 18, 2.4, 1.2, 1.2, { kind: 'stone' }).block(2.4, 1.2, 18, 2.4, 1.2, 1.2, { kind: 'stone' })
    .lights(6, 0, 15, { spacing: 1.2 }).enemy('scorpion', 0, 24, { patrol: { axis: 'x', range: 2.5, speed: 2.6 } });
  hop(b, 5);
  b.floor(30).checkpoint(0, 3).hazard('fireJet', -2.3, 10, { period: 1.6 }).hazard('fireJet', 2.3, 10, { period: 1.6, offset: 0.8 })
    .enemy('camel', -4.8, 14).enemy('camel', 4.8, 20).row('basic', 2, 0, 16, { spacing: 2.6 })
    .crate('nitro', 0, 22).row(['basic', 'lights', 'basic'], 3, 0, 27, { spacing: 2.3 }).weave(10, 4, { amp: 2.4, spacing: 1.4 });
  hop(b, 5, { arc: 2.2 });
  b.floor(30).crate('nitroSwitch', -2.6, 10).row('basic', 3, 2, 8, { axis: 'fwd', spacing: 1.3 }).crate('time3', 0, 16)
    .pyramid(2, 0, 22).sign(S.almost, 3.6, 12).deco('palm', -5, 6).deco('palm', 5, 16).deco('camel_vacation', -5, 24);
  b.goal(14);
});

export default [L21, L22, L23, L24, L25];
