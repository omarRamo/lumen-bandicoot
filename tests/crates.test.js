// Pure Node tests for crate/pickup rules (src/game/entities/crate-logic.js). Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CRATE_KINDS, PICKUP_KINDS, crateCounts, breaksOn, lightsFor, LIGHTS_CRATE_MAX, tntDigit, comboLabel, pickMystery,
  MYSTERY_TABLE, sockToast, tr, wrapText, designedSupport, overlapXZ, fleeDir,
} from '../src/game/entities/crate-logic.js';

test('catalogue is complete', () => {
  for (const k of ['basic', 'lights', 'bounce', 'life', 'mask', 'checkpoint', 'iron', 'ironBounce', 'tnt', 'nitro',
    'nitroSwitch', 'switch', 'outline', 'time1', 'time2', 'time3', 'legs', 'mystery']) assert.ok(CRATE_KINDS.includes(k), k);
  for (const k of ['light', 'sock', 'goldSock', 'sign', 'goal']) assert.ok(PICKUP_KINDS.includes(k), k);
});

test('counting rule: everything but iron, ironBounce and time crates', () => {
  for (const k of CRATE_KINDS) {
    const expected = !['iron', 'ironBounce', 'time1', 'time2', 'time3'].includes(k);
    assert.equal(crateCounts(k), expected, k);
  }
  assert.ok(crateCounts('outline'));
  assert.ok(crateCounts('nitro'));
});

test('break rules', () => {
  assert.ok(breaksOn('basic', 'land'));
  assert.ok(!breaksOn('iron', 'spin'));
  assert.ok(!breaksOn('iron', 'slam'));
  assert.ok(breaksOn('iron', 'slam2'));
  assert.ok(!breaksOn('ironBounce', 'slam2'));
  assert.ok(!breaksOn('bounce', 'land'));
  assert.ok(breaksOn('bounce', 'spin'));
  assert.ok(!breaksOn('lights', 'land'));
  assert.ok(breaksOn('lights', 'spin'));
  assert.ok(!breaksOn('tnt', 'land'));
  assert.ok(breaksOn('tnt', 'spin'));
});

test('lights per crate', () => {
  assert.equal(lightsFor('basic'), 5);
  assert.equal(lightsFor('iron'), 0);
  assert.equal(LIGHTS_CRATE_MAX, 10);
});

test('TNT countdown digits 3-2-1', () => {
  assert.equal(tntDigit(3), 3);
  assert.equal(tntDigit(2.5), 3);
  assert.equal(tntDigit(2), 2);
  assert.equal(tntDigit(1.01), 2);
  assert.equal(tntDigit(0.5), 1);
  assert.equal(tntDigit(0), 1);
});

test('combo labels', () => {
  assert.equal(comboLabel(2), null);
  assert.equal(comboLabel(3), 'COMBO x3 !');
  assert.match(comboLabel(5, 'fr'), /CRASH QUI/);
  assert.match(comboLabel(5, 'en'), /CRASH WHO/);
  assert.match(comboLabel(12, 'fr'), /x12/);
});

test('mystery table covers [0,1) and includes the chicken', () => {
  const total = MYSTERY_TABLE.reduce((a, [, w]) => a + w, 0);
  assert.ok(Math.abs(total - 1) < 1e-9);
  const seen = new Set();
  for (let r = 0; r < 1; r += 0.01) seen.add(pickMystery(r));
  for (const k of ['lights', 'chicken', 'disco', 'mask', 'life']) assert.ok(seen.has(k), k);
  assert.equal(pickMystery(0.999999), MYSTERY_TABLE.at(-1)[0]);
});

test('i18n helpers', () => {
  assert.equal(tr({ fr: 'Bonjour', en: 'Hello' }, 'en'), 'Hello');
  assert.equal(tr({ fr: 'Bonjour' }, 'en'), 'Bonjour');
  assert.equal(tr('plain', 'en'), 'plain');
  assert.match(sockToast('red').fr, /rouge/);
  assert.match(sockToast('blue').en, /blue/);
});

test('wrapText keeps lines under the width', () => {
  const measure = (s) => s.length * 10;
  const lines = wrapText('Ceci n\'est pas une caisse de Crash. C\'est une caisse de Lumen.', 200, measure);
  assert.ok(lines.length > 1);
  for (const l of lines) assert.ok(measure(l) <= 200 || !l.includes(' '), l);
  assert.equal(wrapText('a b c d e f g h', 10, measure, 2).length, 2);
});

test('designed support: stacked or on the ground, not floating', () => {
  const below = { x: 0, y: 0, z: 0 };
  const top = { x: 0, y: 1, z: 0 };
  const floating = { x: 0, y: 3, z: 0 };
  const pyramidTop = { x: 0.5, y: 1, z: 0 };
  assert.ok(designedSupport(top, [below], -Infinity));
  assert.ok(designedSupport(pyramidTop, [below], -Infinity));
  assert.ok(!designedSupport(floating, [below], -Infinity));
  assert.ok(designedSupport(below, [], 0));
  assert.ok(!designedSupport({ x: 1, y: 1, z: 0 }, [below], -Infinity)); // only touching edges
});

test('overlapXZ ignores touching neighbours', () => {
  const a = { min: { x: 0, z: 0 }, max: { x: 1, z: 1 } };
  assert.ok(!overlapXZ(a, { min: { x: 1, z: 0 }, max: { x: 2, z: 1 } }));
  assert.ok(overlapXZ(a, { min: { x: 0.5, z: 0 }, max: { x: 1.5, z: 1 } }));
});

test('legs crate flees away from the player', () => {
  for (let t = 0; t < 3; t += 0.37) {
    const d = fleeDir(0, 0, 0, 3, t); // player at +Z → run toward -Z
    assert.ok(Math.abs(Math.hypot(d.x, d.z) - 1) < 1e-9);
    assert.ok(d.z < 0, `t=${t}`);
  }
});
