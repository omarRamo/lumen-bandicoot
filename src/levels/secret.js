// Monde secret — S-1 La Lune Dorée (Level design B). Expert remix of every mechanic of the game, with every power
// (doubleJump, tornado, superSlam, turbo). Helpers from w3.js.
import { mk, t } from './w3.js';

const HALF_PI = Math.PI / 2;

function luneDoree() {
  const b = mk({
    id: 'S-1', world: 5, index: 1, name: t('La Lune Dorée', 'The Golden Moon'), theme: 'golden', music: 'golden', mode: 'run',
    ground: 'ground', width: 4.5,
    intro: t('Niveau secret. Si vous lisez ceci, vous avez beaucoup trop joué. Bravo.', 'Secret level. If you can read this, you played way too much. Well done.'),
    timeTrial: { gold: 100, silver: 122, bronze: 150 },
  });
  const corner = (dir) => b.floor(5, { w: 5 }).turn(dir, { pad: 5 });

  // A — the golden carpet (and its chickens)
  b.floor(20, { w: 6 })
    .sign(t('Bienvenue sur la Lune Dorée : tout est en or, sauf le scénario.', 'Welcome to the Golden Moon: everything is gold except the plot.'), -2.6, 3)
    .lights(12, 0, 2, { spacing: 1.1 }).pyramid(3, 0, 15).crate('mystery', -2.5, 17)
    .enemy('chicken', -1.6, 6).enemy('chicken', 1.6, 7).enemy('chicken', 0, 9, { range: 4 })
    .deco('statue_sock', -4.2, 8, 0, 1.4).deco('statue_sock', 4.2, 8, 0, 1.4).ttCrate(3, 2.5, 17);
  // B — golden ice bridge in a crosswind, a belly-sliding penguin
  b.pit(4.5, { arc: 2 })
    .floor(22, { kind: 'ice', w: 2.6 }).hazard('wind', 0, 11, { w: 2.6, d: 22, h: 5, force: { lat: -2.6 } })
    .enemy('penguin', 0, 11, { patrol: { axis: 'z', range: 5, speed: 6 } })
    .crate('basic', 0.8, 2).crate('lights', 0.8, 20).lights(8, 0.6, 3, { spacing: 2.2 })
    .sign(t('Remix « Glissade Frileuse ». En pire.', '"Chilly Slide" remix. Worse.'), 0.9, 0.5)
    .pit(5, { arc: 2.2 }).floor(6, { w: 4 }).crate('basic', -1.2, 3).crate('basic', 1.2, 3);
  // C — fast shy platforms over the void, bats
  b.gap(18)
    .platform('vanishing', 0, 2.2, { w: 2, d: 2, up: -0.5, period: 2.2, offset: 0 })
    .platform('vanishing', 0.9, 6.6, { w: 2, d: 2, up: -0.5, period: 2.2, offset: 0.55 })
    .platform('vanishing', -0.9, 11, { w: 2, d: 2, up: -0.5, period: 2.2, offset: 1.1 })
    .platform('vanishing', 0, 15.4, { w: 2, d: 2, up: -0.5, period: 2.2, offset: 1.65 })
    .enemy('bat', 0, 9, { fly: 2.6, patrol: { axis: 'x', range: 2, speed: 2.6 } })
    .lights(12, 0, 0.8, { spacing: 1.45, up: 1.4, arc: 1 })
    .floor(10).checkpoint(0, 3).crate('basic', -1.6, 7).crate('basic', 1.6, 7).crate('lights', 0, 8);
  corner('left');
  // D — leg 2 (-X): sideways belt under crushers, rising cloud stones
  b.floor(22, { kind: 'conveyor', conveyorLat: 3.2 })
    .hazard('crusher', 0, 6, { period: 2, offset: 0 }).hazard('crusher', 0, 14, { period: 2, offset: 1 })
    .crate('basic', -1.6, 3).crate('basic', -1.6, 10).crate('lights', -1.6, 17).crate('basic', -1.6, 21)
    .enemy('robot', 0.5, 18, { patrol: { axis: 'z', range: 2, speed: 2 } })
    .lights(8, -0.8, 2, { spacing: 2.6 })
    .sign(t('Tapis + presse + robot : la sainte trinité de l\'usine.', 'Belt + press + robot: the factory holy trinity.'), -1.8, 1)
    .stones(4, { size: 2, gap: 2.4, dy: 0.8, kind: 'cloud', zigzag: 1 })
    .crate('lights', -1, 3.4, -2.4).crate('basic', 1, 7.8, -1.6).crate('basic', -1, 12.2, -0.8).crate('basic', 1, 16.6)
    .floor(6, { w: 5 }).crate('basic', 0, 3);
  // E — side-view golden wall (zigzag up) with laser and springs; the secret sock above it
  b.camZone(30, { mode: 'side', yaw: b.yaw + HALF_PI, travelYaw: b.yaw, dist: 12, lookUp: 2.2, height: 3 }, {}, { ylo: -3, yhi: 30 });
  b.floor(5).crate('basic', 0, 3);
  {
    const z0 = b.f, rel = (f) => f - (b.a - z0);
    [[1.5, 2], [6, 4], [1.5, 6], [6, 8], [1.5, 10], [6, 12]].forEach(([f, up], i) => {
      b.block(0, up, rel(f + 1.3), 2.6, 0.5, 2.6, { kind: 'cloud' });
      if (i % 2 === 0) b.crate(i === 2 ? 'lights' : 'basic', 0, rel(f + 1.3), up);
      else b.lights(2, 0, rel(f + 0.8), { up: up + 0.9, spacing: 1 });
    });
    b.hazard('laser', 0, rel(7.3), { axis: 'x', width: 2.6, period: 2, up: 8 })
      .enemy('drone', 0, rel(2.8), { fly: 6.6, period: 3 });
    // secret: spring on the top shelf → hidden cloud far above (double jump + tornado back down)
    b.crate('ironBounce', 0, rel(7.3), 12)
      .block(0, 18.2, rel(11), 2.6, 0.5, 2.6, { kind: 'cloud' }).sock('purple', 0, rel(11), 19)
      .lights(6, 0, rel(7.3), { spacing: 0.7, up: 14, arc: 4 });
    b.at(b.lat, b.y + 14, z0 + 10.5).floor(12, { w: 5 })
      .sign(t('Vertige ? Le jeu ne rembourse pas.', 'Vertigo? The game offers no refunds.'), -1.8, 2)
      .crate('basic', -1.5, 4).crate('basic', 1.5, 4).crate('basic', 0, 8).crate('basic', 0, 8, 1);
  }
  corner('right');
  // F — leg 3 (-Z again): front camera "for nostalgia", barrels rolling at you
  b.camZone(34, { mode: 'front', yaw: b.yaw + Math.PI }, {}, { ylo: -6, yhi: 12 });
  b.floor(34, { w: 6 }).hazard('barrels', 0, 33, { interval: 2 })
    .sign(t('Caméra de face, par nostalgie. Pas de boule : budget épuisé.', 'Front camera, for nostalgia. No boulder: out of budget.'), -2.6, 1, b.yaw + Math.PI)
    .hazard('spikes', -1.5, 9, { period: 1.6 }).hazard('spikes', 1.5, 9, { period: 1.6, offset: 0.8 })
    .row(['basic', 'basic', 'tnt', 'basic', 'basic'], 5, 0, 15).crate('basic', -2.6, 22).crate('lights', 2.6, 22)
    .hazard('spikes', 0, 27, { period: 1.4, offset: 0.4 }).lights(10, 0, 2, { spacing: 3.2 })
    .floor(8).checkpoint(0, 4).crate('mask', -2, 6);
  // G — the gold-plated bridge (falls behind you; turbo strongly advised)
  b.floor(4).crate('basic', 0, 2);
  {
    b.gap(32);
    for (let i = 0; i < 12; i++) b.platform('falling', 0, 1.3 + i * 2.6, { w: 3, d: 2.6, up: -0.5, delay: 0.3 });
    b.lights(16, 0, 1, { spacing: 2, up: 1 })
      .sign(t('Pont en or massif (plaqué). Turbo vivement conseillé.', 'Solid gold bridge (plated). Turbo strongly advised.'), -2, -2.5);
  }
  // H — rotating bars, pigeons, bouncy chain up to a cloud plateau
  b.floor(8).crate('basic', -1.5, 4).crate('basic', 1.5, 4)
    .gap(14)
    .platform('rotating', 0, 3.5, { w: 2.8, d: 2.8, h: 0.5, up: -0.5, speed: 1.8 })
    .platform('rotating', 0, 10, { w: 2.8, d: 2.8, h: 0.5, up: -0.5, speed: -2.1 })
    .enemy('pigeon', 0, 7, { fly: 3 }).lights(8, 0, 1, { spacing: 1.7, up: 1.4, arc: 1.2 })
    .floor(6, { w: 4 }).crate('lights', 0, 3)
    .gap(12).platform('bouncy', 0, 3, { w: 2, d: 2, h: 0.4, up: -0.4 }).platform('bouncy', 0, 8.5, { w: 2, d: 2, h: 0.4, up: 1 })
    .lights(6, 0, 0.5, { spacing: 0.6, up: 1.4, arc: 3 }).lights(6, 0, 5, { spacing: 0.6, up: 2.6, arc: 3.4 })
    .step(3, 14, { kind: 'cloud', w: 6 }).crate('basic', -2, 4).crate('basic', 2, 4).stack(['basic', 'basic', 'lights'], 0, 9)
    .enemy('cat', 1.8, 11).sign(t('Ce chat vole des lucioles. Toupie = remboursement.', 'This cat steals fireflies. Spin = refund.'), -2.4, 11);
  corner('left');
  // I — leg 4 (-X): the nitro field (and the switch that ends it)
  b.floor(28, { w: 8 })
    .sign(t('Champ de nitro. Marchez sur la pointe des pattes.', 'Nitro field. Tiptoe.'), -3.4, 1)
    .crate('nitro', -2, 5).crate('nitro', 2, 5).crate('nitro', 0, 9).crate('nitro', -3, 12).crate('nitro', 3, 12).crate('nitro', -1, 15)
    .crate('nitro', 1.5, 18).crate('nitro', -2.5, 21).crate('nitro', 2.5, 24)
    .crate('basic', 0, 5).crate('basic', -3, 8).crate('basic', 3, 8).crate('lights', 0, 12).crate('basic', 1, 15).crate('basic', -2, 18)
    .crate('basic', 3, 18).crate('basic', 0, 21).crate('basic', -0.5, 24).crate('nitroSwitch', 0, 27)
    .lights(9, 0, 2.5, { spacing: 3 })
    .crate('switch', -3.4, 26, 0, { group: 'gS' })
    .floor(10, { w: 5 }).outlines('gS', [[-1, 3], [0, 3], [1, 3], [-0.5, 3, 1], [0.5, 3, 1], [0, 3, 2]])
    .crate('iron', -1, 7.5).crate('iron', 1, 7.5).crate('life', 0, 7.5).crate('iron', 0, 6.5).crate('iron', 0, 8.5)
    .crate('iron', 0, 7.5, 1)
    .sign(t('Une vie en cage. Super plongeon requis. Libérez-la !', 'A caged life. Super slam required. Free it!'), 2, 5);
  corner('right');
  // J — leg 5 (-Z): tower remix (lasers + elevators + drones)
  b.floor(14).checkpoint(0, 2)
    .hazard('laser', 0, 6, { axis: 'x', width: 4.5, period: 1.8 }).hazard('laser', 0, 10, { axis: 'x', width: 4.5, period: 1.8, offset: 0.9 })
    .crate('basic', -1.7, 8).crate('basic', 1.7, 8).lights(4, 0, 12, { spacing: 0.6 })
    .gap(5).platform('moving', 0, 2.5, { w: 2.2, d: 2.2, up: -0.5, to: { up: 3.2 }, period: 2.6 })
    .step(3.2, 8).crate('basic', -1.6, 3).crate('lights', 1.6, 5).enemy('drone', 0, 4, { fly: 2.8, period: 2.6 })
    .gap(5).platform('moving', 0, 2.5, { w: 2.2, d: 2.2, up: -0.5, to: { up: 3.2 }, period: 2.6, offset: 1.3 })
    .step(3.2, 8).crate('basic', 0, 3).crate('basic', 0, 3, 1).enemy('porcupine', 0, 6, { patrol: { axis: 'x', range: 1.5, speed: 1.2 } })
    .pit(6, { arc: 2.4 }).floor(6).crate('basic', 0, 3);
  // K — the parade of every enemy of the game, then the golden staircase
  b.floor(40, { w: 7 })
    .sign(t('Grande parade des ennemis. Ils ont tous été payés en lucioles.', 'Grand enemy parade. All paid in fireflies.'), -3, 1)
    .enemy('crab', 0, 4, { patrol: { axis: 'x', range: 1.6, speed: 2 } }).enemy('turtle', -2, 8).enemy('porcupine', 2, 10)
    .enemy('scorpion', -1.5, 13).enemy('cactus', 2.5, 16).enemy('skunk', -2.5, 19).enemy('rat', 0.5, 22, { patrol: { axis: 'x', range: 1.2, speed: 2 } })
    .enemy('plant', -2.6, 25).enemy('camel', 2.6, 28).enemy('yetiKid', -2.4, 31).enemy('chicken', 0, 34)
    .crate('basic', 3, 4).crate('basic', -3, 6).crate('lights', 3, 12).crate('basic', -3, 15).crate('basic', 3, 21)
    .crate('basic', 0, 24.5).crate('lights', 0, 27).crate('basic', 3, 32).crate('legs', 0, 37)
    .lights(14, 0, 2, { spacing: 2.6 })
    .step(1, 4).crate('basic', 1.6, 2).step(1, 4).crate('basic', -1.6, 2).step(1, 4).crate('basic', 1.6, 2)
    .step(1, 4).crate('basic', -1.6, 2).step(1, 4).crate('lights', 0, 2)
    .sign(t('Le vrai trésor, c\'était les chaussettes perdues en chemin.', 'The real treasure was the socks we lost along the way.'), -1.8, 1)
    .goal(12, { w: 7 }).deco('statue_sock', -4, 6, 0, 2).deco('statue_sock', 4, 6, 0, 2).deco('planet', 0, 30, 18, 4);
  return b.build();
}

export default [luneDoree()];
