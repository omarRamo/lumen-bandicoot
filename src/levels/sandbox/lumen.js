// Test levels of the character team (Lumen, Oku Oku, mounts). ?debug&level=T-lumen-…
import { level, t } from '../builder.js';

const run = level({ id: 'T-lumen-run', world: 0, index: 1, name: t('Labo Lumen', 'Lumen Lab'), theme: 'beach', mode: 'run' });
run.floor(16).crate('mask', -1, 5).crate('mask', 1, 7).crate('mask', 0, 9).lights(4, 0, 11)
  .gap(3).floor(10).crate('basic', 0, 4).enemy('crab', 0, 7, { patrol: { axis: 'x', range: 1.2, speed: 1.2 } })
  .step(1, 8).stones(3, { size: 1.6, gap: 1.4 }).floor(12).crate('tnt', 1, 6).goal();

const rides = ['camel', 'snail', 'penguin', 'rocket'].map((mount, i) => {
  const theme = { camel: 'desert', snail: 'beach', penguin: 'ice', rocket: 'space' }[mount];
  const b = level({ id: `T-lumen-${mount}`, world: 0, index: 2 + i, name: t(`Monture ${mount}`, `Mount ${mount}`), theme, mode: 'ride', mount, autoRun: 10 });
  b.floor(30, { w: 6 }).lights(5, 0, 12).crate('basic', 1.5, 20).gap(2.5).floor(30, { w: 6 }).crate('basic', -1.5, 10).floor(30, { w: 6 }).goal();
  return b.build();
});

export default [run.build(), ...rides];
