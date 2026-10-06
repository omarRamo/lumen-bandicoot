// UI pure-logic tests (no DOM): strings, formatting, joystick maths, cinematic script integrity.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tr, formatTime, spoonFor, stickVector, levelName, levelMode, sockSlots, LEVEL_NAMES, clamp } from '../src/ui/util.js';
import { STR, POWERS, MODE_LABEL, GAMEOVER_QUIPS, PAUSE_TIPS, SPEAKERS, deathsLine } from '../src/ui/i18n.js';
import { STORIES, STORY_IDS } from '../src/ui/story-data.js';
import { STORY_SCENES } from '../src/ui/story.js';

const bilingual = (o, label) => {
  assert.ok(o && typeof o === 'object', `${label} missing`);
  assert.ok(typeof o.fr === 'string' && o.fr.trim(), `${label}.fr empty`);
  assert.ok(typeof o.en === 'string' && o.en.trim(), `${label}.en empty`);
};

test('tr picks the language and tolerates plain strings / missing values', () => {
  assert.equal(tr({ fr: 'Bonjour', en: 'Hello' }, 'en'), 'Hello');
  assert.equal(tr({ fr: 'Bonjour', en: 'Hello' }, 'fr'), 'Bonjour');
  assert.equal(tr({ fr: 'Seul' }, 'en'), 'Seul');
  assert.equal(tr('brut', 'en'), 'brut');
  assert.equal(tr(null), '');
  assert.equal(tr(42), '42');
});

test('formatTime renders m:ss.cc and clamps junk', () => {
  assert.equal(formatTime(0), '0:00.00');
  assert.equal(formatTime(9.1), '0:09.10');
  assert.equal(formatTime(83.456), '1:23.45');
  assert.equal(formatTime(600), '10:00.00');
  assert.equal(formatTime(-3), '0:00.00');
  assert.equal(formatTime(NaN), '0:00.00');
});

test('spoonFor follows gold/silver/bronze thresholds', () => {
  const tt = { gold: 30, silver: 40, bronze: 55 };
  assert.equal(spoonFor(29.9, tt), 'gold');
  assert.equal(spoonFor(30, tt), 'gold');
  assert.equal(spoonFor(39, tt), 'silver');
  assert.equal(spoonFor(55, tt), 'bronze');
  assert.equal(spoonFor(70, tt), null);
  assert.equal(spoonFor(10, null), null);
});

test('stickVector: dead zone, y up, unit clamp, direction', () => {
  assert.deepEqual(stickVector(0, 0, 60), { x: 0, y: 0, mag: 0 });
  assert.equal(stickVector(5, 0, 60).mag, 0, 'inside dead zone');
  const up = stickVector(0, -60, 60);
  assert.ok(up.y > 0.99 && Math.abs(up.x) < 1e-9, 'dragging up the screen = forward (+y)');
  const right = stickVector(200, 0, 60);
  assert.ok(Math.abs(right.x - 1) < 1e-9, 'clamped to 1 beyond the radius');
  const diag = stickVector(40, 40, 60);
  assert.ok(diag.x > 0 && diag.y < 0 && Math.abs(Math.hypot(diag.x, diag.y) - diag.mag) < 1e-9);
  for (let a = 0; a < 6.28; a += 0.3) {
    const v = stickVector(Math.cos(a) * 90, Math.sin(a) * 90, 60);
    assert.ok(Math.hypot(v.x, v.y) <= 1 + 1e-9);
  }
});

test('level helpers fall back gracefully when level data is missing', () => {
  assert.equal(levelName('1-3', {}, 'fr'), 'La Lune qui Roule');
  assert.equal(levelName('1-3', {}, 'en'), 'The Rolling Moon');
  assert.equal(levelName('1-1', { '1-1': { name: { fr: 'A', en: 'B' } } }, 'en'), 'B');
  assert.equal(levelName('Z-9', {}, 'fr'), 'Z-9');
  assert.equal(levelMode('B2', {}), 'boss');
  assert.equal(levelMode('2-4', { '2-4': { mode: 'chase' } }), 'chase');
  assert.deepEqual(sockSlots({ entities: [{ type: 'pickup', kind: 'sock', color: 'blue' }, { type: 'crate', kind: 'basic' }] }), ['blue']);
  assert.deepEqual(sockSlots(undefined), []);
  for (const id of ['1-1', '1-5', 'B1', '2-3', 'B2', '3-3', 'B3', '4-4', 'B4', 'S-1', 'BS']) assert.ok(LEVEL_NAMES[id], `name for ${id}`);
  assert.equal(clamp(5, 0, 3), 3);
});

test('every UI string exists in FR and EN', () => {
  for (const [k, v] of Object.entries(STR)) bilingual(v, `STR.${k}`);
  for (const [k, v] of Object.entries(MODE_LABEL)) bilingual(v, `MODE_LABEL.${k}`);
  for (const [k, v] of Object.entries(SPEAKERS)) bilingual(v, `SPEAKERS.${k}`);
  GAMEOVER_QUIPS.forEach((q, i) => bilingual(q, `GAMEOVER_QUIPS[${i}]`));
  PAUSE_TIPS.forEach((q, i) => bilingual(q, `PAUSE_TIPS[${i}]`));
});

test('the four powers have a bilingual tutorial with keyboard / pad / touch keys', () => {
  for (const p of ['doubleJump', 'tornado', 'superSlam', 'turbo']) {
    const d = POWERS[p];
    bilingual(d.name, `${p}.name`); bilingual(d.desc, `${p}.desc`);
    for (const k of ['kb', 'pad', 'touch']) bilingual(d.keys[k], `${p}.keys.${k}`);
  }
});

test('deathsLine is funny in both languages and says the number', () => {
  for (const n of [0, 1, 3, 12, 40]) {
    assert.match(deathsLine(n, 'fr'), new RegExp(`\\b${n}\\b`));
    assert.match(deathsLine(n, 'en'), new RegExp(n === 1 ? 'once' : `\\b${n}\\b`));
  }
  assert.equal(deathsLine(12, 'fr'), 'Lumen est mort 12 fois (bravo)');
});

test('cinematics: every contract id exists, panels are bilingual and use known scenes/speakers', () => {
  for (const id of ['intro', 'island2', 'island3', 'island4', 'ending', 'secret', 'secret_ending']) {
    assert.ok(STORY_IDS.includes(id), `story ${id}`);
    assert.ok(STORIES[id].length >= 2, `story ${id} has panels`);
    STORIES[id].forEach((p, i) => {
      bilingual(p.text, `${id}[${i}].text`);
      assert.ok(STORY_SCENES.includes(p.scene), `${id}[${i}] unknown scene ${p.scene}`);
      assert.ok(SPEAKERS[p.speaker], `${id}[${i}] unknown speaker ${p.speaker}`);
    });
  }
});
