// STUB — replaced by the level design team. Minimal test level so the engine boots.
import { level, t } from './builder.js';

const b = level({ id: '1-1', world: 1, index: 1, name: t('Plage du Débutant', 'Beginner Beach'), theme: 'beach', mode: 'run',
  intro: t('Ceci n\'est pas Crash Bandicoot.', 'This is not Crash Bandicoot.'), timeTrial: { gold: 30, silver: 40, bronze: 55 } });
b.floor(14).crate('basic', 0, 6).crate('basic', 1, 6).stack(['basic', 'lights'], -1, 9).lights(4, 0, 2)
  .gap(2.5).floor(8, { kind: 'wood' }).checkpoint(0, 3).enemy('crab', 0, 6, { patrol: { axis: 'x', range: 1.5, speed: 1.5 } })
  .up(1).floor(10).crate('tnt', 1, 4).crate('mask', -1, 4).gap(3).goal();
export default [b.build()];
