// Level design A — static validation of islands 1 and 2 (src/levels/w1.js, src/levels/w2.js). Pure Node, no DOM.
// The geometry checks (reachability, supports) use the jump model of src/game/player.js, see tools/levels-a-lib.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import w1 from '../src/levels/w1.js';
import w2 from '../src/levels/w2.js';
import {
  CATALOG, counts, PROFILES, explore, goalReachable, unsupportedCrates, unreachableCrates, catalogErrors, stats,
} from '../tools/levels-a-lib.mjs';

const LEVELS = [...w1, ...w2];
const EXPECTED = {
  '1-1': ['run', 'beach'], '1-2': ['run', 'jungle'], '1-3': ['chase', 'jungle'], '1-4': ['ride', 'beach'], '1-5': ['run', 'river'],
  '2-1': ['run', 'desert'], '2-2': ['side', 'medina'], '2-3': ['run', 'sidibou'], '2-4': ['chase', 'desert'], '2-5': ['ride', 'desert'],
};
const MUSIC = ['title', 'map', 'beach', 'jungle', 'river', 'desert', 'medina', 'sidibou', 'chase', 'ride'];
const fmt = (c) => `${c.id}:${c.kind}@(${c.x.toFixed(1)}, ${c.y.toFixed(1)}, ${c.z.toFixed(1)})${c.bonus ? ` bonus:${c.bonus}` : ''}`;

test('w1 / w2 export the 10 levels in order', () => {
  assert.deepEqual(w1.map((l) => l.id), ['1-1', '1-2', '1-3', '1-4', '1-5']);
  assert.deepEqual(w2.map((l) => l.id), ['2-1', '2-2', '2-3', '2-4', '2-5']);
});

for (const L of LEVELS) {
  test(`${L.id} metadata`, () => {
    const [mode, theme] = EXPECTED[L.id];
    assert.equal(L.mode, mode);
    assert.equal(L.theme, theme);
    assert.equal(L.world, +L.id[0]);
    assert.equal(L.index, +L.id[2]);
    assert.ok(L.name?.fr && L.name?.en, 'name {fr,en}');
    assert.ok(L.intro?.fr && L.intro?.en, 'intro {fr,en}');
    assert.ok(MUSIC.includes(L.music), `music ${L.music}`);
    if (mode === 'chase') assert.equal(L.music, 'chase');
    if (mode === 'ride') assert.equal(L.music, 'ride');
    const tt = L.timeTrial;
    assert.ok(tt && tt.gold < tt.silver && tt.silver < tt.bronze, 'timeTrial gold < silver < bronze');
    if (mode === 'ride') { assert.ok(['snail', 'camel'].includes(L.mount)); assert.ok(L.autoRun >= 9); }
    if (mode === 'side') assert.equal(L.dir, 'x');
  });

  test(`${L.id} entities: unique ids, catalogue kinds, params`, () => {
    const ids = L.entities.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, 'duplicate entity ids');
    assert.deepEqual(catalogErrors(L), []);
    for (const e of L.entities) {
      for (const k of ['x', 'y', 'z']) assert.ok(Number.isFinite(e[k]), `${e.id} ${k}`);
      if (e.kind === 'sign') assert.ok(e.text?.fr && e.text?.en, `${e.id} sign text`);
      if (e.kind === 'sock') assert.ok(['red', 'blue', 'green', 'purple'].includes(e.color), `${e.id} sock color`);
      if (e.bonus) assert.ok(['doubleJump', 'tornado', 'superSlam'].includes(e.bonus), `${e.id} bonus ${e.bonus}`);
      if (e.type === 'platform' && e.kind === 'moving') assert.ok(e.to && e.period > 0, `${e.id} moving needs to/period`);
    }
    for (const p of L.platforms) for (let i = 0; i < 3; i++) assert.ok(p.min[i] < p.max[i], 'degenerate platform box');
  });

  test(`${L.id} spawn and goal stand on platforms, goal reachable without powers`, () => {
    const S = L.platforms;
    const on = ([x, y, z]) => S.some((p) => Math.abs(p.max[1] - y) < 0.05 && x >= p.min[0] && x <= p.max[0] && z >= p.min[2] && z <= p.max[2]);
    assert.ok(on(L.spawn), `spawn ${L.spawn} not on a platform`);
    assert.ok(L.goal, 'goal');
    assert.ok(on(L.goal), `goal ${L.goal} not on a platform`);
    // main path: no gap wider than 4.8 m at run speed (scaled by the ride speed for mounts), no power needed
    assert.ok(goalReachable(L, PROFILES.base), 'goal unreachable with plain jumps (gaps ≤ 4.8 m)');
    assert.ok(L.killY < Math.min(...S.map((p) => p.max[1])), 'killY under every floor');
  });

  test(`${L.id} crates: supported, reachable, 40–90 counting`, () => {
    const total = L.entities.filter(counts).length;
    assert.ok(total >= 40 && total <= 90, `crate total ${total}`);
    assert.deepEqual(unsupportedCrates(L).map(fmt), [], 'crates floating without `float: true`');
    const prof = L.world === 1 ? PROFILES.base : PROFILES.doubleJump;
    assert.deepEqual(unreachableCrates(L, prof).map(fmt), [], 'crates that cannot be broken');
    // "come back later" areas must really be gated (super slam vaults are walled: not modelled here)
    const a = explore(L, prof);
    const leaks = L.entities.filter((c) => c.type === 'crate' && c.bonus && c.bonus !== 'superSlam' && c.bonus !== prof.name && a.ok.has(c));
    assert.deepEqual(leaks.map(fmt), [], 'bonus crates reachable without the power');
  });

  test(`${L.id} design checklist`, () => {
    const s = stats(L);
    assert.ok(s.length >= 250 && s.length <= 460, `length ${s.length} m`);
    assert.equal(s.socks, 1, 'one secret sock');
    assert.ok(s.signs >= 2, 'at least two joke signs');
    assert.ok(s.checkpoints >= 2 && s.checkpoints <= 3, `checkpoints ${s.checkpoints}`);
    assert.ok(s.lights >= 60, `lights ${s.lights}`);
    assert.ok(s.kinds.legs || s.kinds.mystery, 'a legs or mystery crate');
    const kinds = (k) => L.entities.filter((e) => e.type === 'crate' && e.kind === k);
    if (L.id !== '1-1') {
      assert.ok(kinds('switch').length >= 1, 'a switch puzzle');
      for (const sw of kinds('switch')) assert.ok(kinds('outline').some((o) => o.group === sw.group), `switch ${sw.group} has outlines`);
      for (const o of kinds('outline')) assert.ok(kinds('switch').some((sw) => sw.group === o.group), `outline ${o.id} group ${o.group} has a switch`);
    }
    if (kinds('nitro').length) assert.equal(kinds('nitroSwitch').length, 1, 'nitro crates need a nitroSwitch');
    if (L.mode !== 'ride' && L.mode !== 'chase') assert.ok(L.zones.some((z) => z.camera), 'a camera zone');
    if (L.mode === 'chase') {
      const b = L.entities.filter((e) => e.type === 'hazard' && e.kind === 'boulder');
      assert.equal(b.length, 1, 'one boulder');
      assert.ok(b[0].z > L.spawn[2] + 5, 'boulder behind the spawn');
      assert.equal(b[0].style, L.world === 1 ? 'moon' : 'tajine');
    }
    // the gap rule of island 1 is checked by goalReachable; island 2 secrets may use the double jump
    for (const e of L.entities) if (e.type === 'enemy') assert.ok(CATALOG.enemy.includes(e.kind));
  });
}

test('islands 1 and 2: difficulty and totals', () => {
  const rows = LEVELS.map(stats);
  const total = rows.reduce((n, r) => n + r.crates, 0);
  assert.ok(total >= 450, `total crates ${total}`);
  // 1-1 is the gentlest level: fewest enemies among the run levels, widest gaps of the game are elsewhere
  const runs = rows.filter((r) => r.mode === 'run');
  assert.ok(rows[0].enemies <= Math.min(...runs.map((r) => r.enemies)), '1-1 has the fewest enemies');
  // island 2 is busier than island 1
  const avg = (w) => rows.filter((r) => r.id[0] === w).reduce((n, r) => n + r.enemies + r.hazards, 0) / 5;
  assert.ok(avg('2') > avg('1'), 'island 2 has more enemies + hazards on average');
});
