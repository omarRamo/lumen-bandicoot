// Environment test levels (one per theme): ids T-env-<theme>. Several platform kinds, gaps, steps, explicit decor.
// ?debug&level=T-env-jungle
import { level, t } from '../builder.js';

const THEMES = ['beach', 'jungle', 'river', 'desert', 'medina', 'sidibou', 'ice', 'cave', 'aurora', 'factory', 'lab',
  'space', 'tower', 'boss_beach', 'boss_desert', 'boss_ice', 'boss_lab', 'golden'];

// per theme: [kindA, kindB, kindC (stones), deco list]
const KINDS = {
  beach: ['grass', 'wood', 'stone', [['palm', -4, 4], ['umbrella', 4.5, 6], ['totem', -4, 12]]],
  jungle: ['wood', 'stone', 'stone', [['tree', -4.5, 6], ['mushroom', 4, 3], ['tiki_torch', 2.4, 1], ['tiki_torch', -2.4, 1]]],
  river: ['wood', 'grass', 'stone', [['reeds', 3.5, 2], ['lilypad', -3, 8], ['hut', -7, 10]]],
  desert: ['stone', 'tile', 'sand', [['cactus', 3.5, 4], ['camel_vacation', -6, 8], ['pot', 2.4, 1]]],
  medina: ['brick', 'wood', 'stone', [['lantern', 0, 2, 0], ['pot', 0.5, 6], ['arch', 1, 10]]],
  sidibou: ['tile', 'stone', 'brick', [['bougainvillea', -3.5, 4], ['house_blue', 7, 6], ['pot', 2.2, 2]]],
  ice: ['ice', 'wood', 'snow', [['snowman', 3.5, 4], ['igloo', -6, 6], ['pine', 5, 12]]],
  cave: ['crystal', 'lava_rock', 'stone', [['crystal', 3.5, 4], ['stalagmite', -4, 6]]],
  aurora: ['ice', 'cloud', 'crystal', [['aurora_tree', 4, 4], ['pine', -5, 6]]],
  factory: ['conveyor', 'glass', 'metal', [['gear', 4, 4], ['pipe', -5, 6], ['barrel', 2.2, 1]]],
  lab: ['glass', 'conveyor', 'metal', [['tube', 0.5, 3], ['tank', 1, 8]]],
  space: ['metal', 'glass', 'crystal', [['planet', -14, 10, 6], ['satellite', 4, 6]]],
  tower: ['brick', 'conveyor', 'metal', [['gear', 4, 4], ['chimney', -7, 8]]],
  golden: ['cloud', 'crystal', 'grass', [['statue_sock', 4, 4], ['palm', -4, 6]]],
};

function course(theme) {
  const sideScroll = theme === 'medina' || theme === 'lab';
  const b = level({ id: `T-env-${theme}`, world: 0, index: 0, name: t(`Env ${theme}`), theme, mode: sideScroll ? 'side' : 'run', dir: sideScroll ? 'x' : 'z' });
  const [ka, kb, kc, deco] = KINDS[theme] || KINDS.beach;
  b.floor(16, { w: 5 }).crate('basic', 0, 9).crate('basic', 1, 9);
  for (const [k, lat, fwd, up] of deco) b.deco(k, lat, fwd, up ?? 0);
  b.sign(t('Panneau de test', 'Test sign'), -2, 3);
  b.gap(3).floor(8, { kind: ka, w: 4, conveyor: ka === 'conveyor' ? 2.5 : undefined });
  b.step(1, 8, { kind: kb, w: 4, conveyor: kb === 'conveyor' ? -2 : undefined }).crate('basic', 0, 4);
  b.stones(3, { kind: kc, size: 1.8, gap: 1.3 });
  b.floor(10, { kind: 'bridge', w: 2.2, thick: 0.35 });
  b.step(-1, 12, { w: 6 }).walls(12, { h: 1.2, kind: 'stone', spread: 6 }).crate('basic', -1, 6);
  b.deco('billboard', 5, 6, 0, 1, 0);
  b.gap(4);
  if (theme === 'river') b.hazard('water', 0, 2, { w: 8, d: 4, up: -1.6 });
  b.floor(6, { kind: theme === 'tower' || theme === 'factory' ? 'lava_rock' : kb, w: 4, damage: theme === 'tower' ? 'burn' : undefined });
  b.step(2, 10, { w: 4 });
  b.gap(3).goal();
  return b.build();
}

function arena(theme) {
  const b = level({ id: `T-env-${theme}`, world: 0, index: 0, name: t(`Env ${theme}`), theme, mode: 'boss' });
  b.floor(6, { w: 6 }).floor(26, { w: 24 });
  b.block(-8, 1.5, 6, 3, 1.5, 3, { kind: theme === 'boss_ice' ? 'ice' : theme === 'boss_lab' ? 'metal' : 'stone' });
  b.block(8, 1.5, 6, 3, 1.5, 3, { kind: theme === 'boss_ice' ? 'ice' : theme === 'boss_lab' ? 'glass' : 'wood' });
  b.deco('lantern', -11, 2).deco('lantern', 11, 2);
  return b.build();
}

export default THEMES.map((th) => (th.startsWith('boss_') ? arena(th) : course(th)));
