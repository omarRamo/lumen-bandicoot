// Sandbox levels of the Enemies team (?debug&level=T-enemies-1 …). Not part of the story.
import { level, t } from '../builder.js';

const levels = [];

// ---------------------------------------------------------------- 1. Gallery: every enemy, two per row
{
  const b = level({ id: 'T-enemies-1', world: 0, index: 1, name: t('Galerie des ennemis', 'Enemy gallery'), theme: 'beach', mode: 'run', width: 14 });
  const kinds = ['crab', 'turtle', 'plant', 'bat', 'porcupine', 'scorpion', 'camel', 'pigeon', 'cat', 'penguin', 'yetiKid', 'robot', 'drone', 'cactus', 'skunk', 'rat', 'chicken'];
  b.floor(6);
  b.floor(kinds.length * 5 + 10);
  kinds.forEach((k, i) => {
    const params = k === 'drone' ? { fly: 2.2 } : {};
    b.enemy(k, i % 2 ? 3.2 : -3.2, 4 + Math.floor(i / 2) * 9 + (i % 2) * 4, params);
  });
  b.goal();
  levels.push(b.build());
}

// ---------------------------------------------------------------- 2. Hazards course
{
  const b = level({ id: 'T-enemies-2', world: 0, index: 2, name: t('Parcours de pièges', 'Hazard course'), theme: 'jungle', mode: 'run', width: 5 });
  b.floor(8)
    .floor(10).hazard('spikes', 0, 5, { w: 5, d: 1.2, period: 2.4 })
    .floor(10).hazard('fireJet', -1, 4, { period: 2.6 }).hazard('fireJet', 1, 7, { period: 2.6, offset: 1.3 })
    .floor(12).hazard('pendulum', 0, 6, { length: 3, speed: 1.8 })
    .floor(10).hazard('crusher', 0, 5, { period: 3.4 })
    .floor(10).hazard('laser', 0, 4, { width: 5, period: 2.4 }).hazard('laser', 0, 8, { width: 5, h: 1.0 })
    .floor(3).gap(5).hazard('water', 0, 2.5, { w: 5, d: 5, up: -0.8 }).floor(3)
    .floor(12).hazard('saw', 0, 6, { patrol: { axis: 'x', range: 2, speed: 2.5 } })
    .floor(16).hazard('barrels', 0, 15, { interval: 2.2, dir: { x: 0, z: 1 } })
    .floor(14, { w: 10 }).hazard('wind', 0, 7, { w: 10, d: 12, h: 4, force: { x: 4, z: 0 } })
    .floor(3).gap(5).hazard('lava', 0, 2.5, { w: 5, d: 5, up: -0.8 }).floor(3)
    .goal();
  levels.push(b.build());
}

// ---------------------------------------------------------------- 3-6. Chase levels (one per boulder style). Press DOWN (towards the camera) to run!
const chase = (id, idx, theme, style, name) => {
  const b = level({ id, world: 0, index: idx, name: t(name, name), theme, mode: 'chase', music: 'chase', width: 5 });
  b.floor(16);
  b.spawn(0, 0, -2);
  b.hazard('boulder', 0, 0, { style });
  b.floor(30).crate('basic', -1, 12).crate('basic', 1, 20)
    .gap(2.5).floor(20).enemy('crab', 0, 10, { patrol: { axis: 'x', range: 1.5, speed: 1.5 } })
    .step(0.6, 20).gap(3).floor(25).crate('tnt', 1.5, 12)
    .step(-0.6, 30).goal(10);
  return b.build();
};
levels.push(chase('T-enemies-3', 3, 'jungle', 'moon', 'La Lune qui Roule (test)'));
levels.push(chase('T-enemies-4', 4, 'desert', 'tajine', 'Le Tajine Fou (test)'));
levels.push(chase('T-enemies-5', 5, 'ice', 'snowball', 'Avalanche (test)'));
levels.push(chase('T-enemies-6', 6, 'factory', 'roomba', 'Roomba Géant (test)'));

// ---------------------------------------------------------------- 7. Platforms
{
  const b = level({ id: 'T-enemies-7', world: 0, index: 7, name: t('Plateformes', 'Platforms'), theme: 'river', mode: 'run', width: 4 });
  b.floor(8)
    .gap(9).platform('moving', 0, 1.5, { up: -0.5, w: 2.4, d: 2.4, to: { fwd: 6 }, period: 4 }).floor(5)
    .gap(8).platform('falling', 0, 2, { up: -0.5, w: 2.2, d: 2.2 }).platform('falling', 0, 5.5, { up: -0.5, w: 2.2, d: 2.2 }).floor(5)
    .gap(9).hazard('water', 0, 4.5, { w: 6, d: 9, up: -0.05 })
      .platform('sinking', 0, 2.2, { up: -0.5, w: 2.2, d: 2.2 }).platform('sinking', 0, 5.8, { up: -0.5, w: 2.2, d: 2.2 }).floor(5)
    .floor(4).platform('bouncy', 0, 2, { w: 2, d: 2, up: -0.2 }).step(4.5, 8)
    .gap(7).platform('rotating', 0, 3.5, { up: -0.5, w: 4.5, d: 4.5, speed: 1.2 }).floor(5)
    .gap(9).platform('vanishing', 0, 2, { up: -0.5, period: 3 }).platform('vanishing', 0, 5, { up: -0.5, period: 3, offset: 1.4 }).platform('vanishing', 0, 7.6, { up: -0.5, period: 3 }).floor(4)
    .gap(6).platform('moving', 0, 3, { up: -0.5, w: 2, d: 2, to: { up: 3 }, period: 3.5 }).step(3, 6)
    .goal();
  levels.push(b.build());
}

// ---------------------------------------------------------------- 8. Desert / factory variants (visual check of every family)
{
  const b = level({ id: 'T-enemies-8', world: 0, index: 8, name: t('Variantes désert', 'Desert variants'), theme: 'desert', mode: 'run', width: 6 });
  b.floor(8)
    .gap(8).platform('moving', 0, 1.5, { up: -0.5, w: 2.4, d: 2.4, to: { fwd: 5 }, period: 4 }).floor(6)
    .enemy('camel', 0, 5).enemy('scorpion', 2, 3).enemy('cactus', -2, 3)
    .floor(8).platform('bouncy', 2, 4, { up: -0.2 }).platform('rotating', -1.5, 4, { up: -0.5, w: 3, d: 3 })
    .floor(10).hazard('crusher', 0, 5).hazard('barrels', 0, 9.5, { interval: 2.5 })
    .floor(10).hazard('pendulum', 0, 5).enemy('cat', 2, 8).enemy('pigeon', -2, 8)
    .gap(5).platform('vanishing', 0, 2.5, { up: -0.5, period: 3 }).floor(4)
    .goal();
  levels.push(b.build());
}
{
  const b = level({ id: 'T-enemies-9', world: 0, index: 9, name: t('Variantes usine', 'Factory variants'), theme: 'factory', mode: 'run', width: 6 });
  b.floor(8)
    .floor(10).enemy('robot', 0, 6).enemy('drone', 2, 3, { fly: 2.2 })
    .floor(10).enemy('rat', 0, 4).hazard('crusher', 0, 8).platform('bouncy', -2.5, 3, { up: -0.2 })
    .floor(10).hazard('wind', 0, 5, { w: 6, d: 10, force: { x: -3, z: 0 } }).hazard('saw', 0, 5, { path: [[0, 0, -4], [2, 0, -4]] })
    .gap(8).platform('moving', 0, 1.5, { up: -0.5, to: { fwd: 5 } }).floor(4)
    .floor(8).enemy('penguin', 0, 4).enemy('yetiKid', 2, 6).enemy('skunk', -2, 6)
    .floor(4).hazard('laser', 0, 2, { width: 6 })
    .goal();
  levels.push(b.build());
}

export default levels;
