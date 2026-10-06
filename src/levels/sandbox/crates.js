// Crates & collectibles test levels (agent Caisses). ?debug&level=T-crates-1 (showcase) / T-crates-2 (respawn).
import { level, t } from '../builder.js';

// ---------------------------------------------------------------- T-crates-1: every kind on one long floor
const a = level({ id: 'T-crates-1', world: 0, index: 1, name: t('Bac à sable des caisses', 'Crate sandbox'), theme: 'beach', mode: 'run',
  intro: t('Toutes les caisses. Toutes. Même la poule.', 'Every crate. Every one. Even the chicken.'), timeTrial: { gold: 40, silver: 55, bronze: 70 }, width: 10 });
a.floor(8)
  .sign(t('Ceci n\'est pas une caisse de Crash. C\'est une caisse de Lumen.', 'This is not a Crash crate. It is a Lumen crate.'), -3.2, 3)
  .lights(4, 0, 2, { spacing: 1.2 })
  .floor(64)
  // row 1: basics, ? crate, spring, life
  .row('basic', 3, 0, 3)
  .crate('lights', -3, 6).crate('bounce', 0, 6).crate('life', 3, 6)
  // row 2: mask, mystery, legs
  .crate('mask', -3, 10).crate('mystery', 0, 10).crate('legs', 3.5, 11)
  // stacks / pyramid
  .stack(['basic', 'basic', 'lights'], -3, 14).pyramid(3, 2, 14)
  // iron
  .crate('iron', -3, 18).crate('ironBounce', 0, 18).stack(['iron', 'basic'], 3, 18)
  // checkpoint
  .checkpoint(0, 22)
  // TNT chain + nitro
  .crate('tnt', -3, 26).crate('tnt', -2, 26).crate('basic', -3, 27).crate('basic', -2, 27)
  .crate('nitro', 3, 26).crate('basic', 2, 26)
  // switch + outlines (group A): a little bridge of outlines
  .crate('switch', -3.5, 30, 0, { group: 'A' })
  .row('outline', 5, 1, 31, { axis: 'lat' }).crate('outline', 1, 32, 1, { group: 'A' }).crate('outline', 1, 33, 2, { group: 'A' })
  // nitro switch + far nitros
  .crate('nitroSwitch', 3.5, 35)
  .row('nitro', 4, 0, 39, { axis: 'lat', spacing: 1.5 })
  // time crates (time trial only)
  .crate('time1', -2, 44).crate('time2', 0, 44).crate('time3', 2, 44)
  // pickups
  .lights(6, -2, 46, { spacing: 0.9, arc: 1.2 })
  .sock('red', 2, 47).sock('blue', 3.2, 47)
  .sign(t('Panneau : les panneaux sont des blagues. Sauf celui-ci.', 'Sign: signs are jokes. Except this one.'), -3.6, 52)
  .crate('basic', 0, 55, 2).crate('basic', 1, 55, 2)
  .gap(3)
  .goal();
const outlines = a.entities.filter((e) => e.kind === 'outline');
for (const e of outlines) e.group = 'A';
const T1 = a.build();

// ---------------------------------------------------------------- T-crates-2: respawn / checkpoint rules
const b = level({ id: 'T-crates-2', world: 0, index: 2, name: t('Caisses : respawn', 'Crates: respawn'), theme: 'jungle', mode: 'run', width: 8 });
b.floor(40)
  .crate('basic', 0, 4)                         // broken BEFORE the checkpoint → must stay broken
  .checkpoint(0, 8)
  .crate('basic', 0, 12)                        // broken AFTER the checkpoint → must come back
  .stack(['basic', 'basic', 'basic'], 2, 12)    // bottom broken after cp → top must return to its place
  .crate('tnt', -2, 16)
  .crate('switch', -2, 20, 0, { group: 'B' }).crate('outline', 0, 20, 0, { group: 'B' }).crate('outline', 1, 20, 0, { group: 'B' })
  .crate('lights', 2, 20)
  .crate('legs', 0, 26)
  .lights(3, -2, 28)
  .sock('green', 2, 30)
  .gap(4)
  .goal();
const T2 = b.build();

export default [T1, T2];
