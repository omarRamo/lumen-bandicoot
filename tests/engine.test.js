// Engine unit tests (pure Node, no DOM): physics + builder.
import test from 'node:test';
import assert from 'node:assert/strict';
import { StaticWorld, moveBody, groundBelow } from '../src/core/physics.js';
import { level } from '../src/levels/builder.js';

const HALF = { x: 0.3, y: 0.56, z: 0.3 };

test('body lands on a floor and stops', () => {
  const w = new StaticWorld();
  w.add({ min: { x: -2, y: -1, z: -10 }, max: { x: 2, y: 0, z: 0 } });
  const pos = { x: 0, y: 2, z: -5 };
  let grounded = false;
  for (let i = 0; i < 120 && !grounded; i++) grounded = !!moveBody(w, pos, HALF, 0, -0.1, 0, null).ground;
  assert.ok(grounded);
  assert.equal(pos.y, 0);
});

test('walls block horizontal motion; small steps are climbed', () => {
  const w = new StaticWorld();
  w.add({ min: { x: -2, y: -1, z: -20 }, max: { x: 2, y: 0, z: 0 } });
  w.add({ min: { x: -2, y: 0, z: -6 }, max: { x: 2, y: 0.25, z: -5 } }); // step
  w.add({ min: { x: -2, y: 0, z: -12 }, max: { x: 2, y: 3, z: -11 } }); // wall
  const pos = { x: 0, y: 0, z: -1 };
  for (let i = 0; i < 200; i++) moveBody(w, pos, HALF, 0, -0.02, -0.08, null, { stepUp: 0.32 });
  assert.ok(pos.z > -11 + 0.29 && pos.z < -10.5, `stopped by wall at ${pos.z}`);
});

test('dynamic solids collide and expose their owner', () => {
  const w = new StaticWorld();
  w.add({ min: { x: -2, y: -1, z: -10 }, max: { x: 2, y: 0, z: 0 } });
  const crate = { solid: true, box: { min: { x: -0.5, y: 0, z: -6.5 }, max: { x: 0.5, y: 1, z: -5.5 } } };
  const pos = { x: 0, y: 0, z: -4 };
  let wall = null;
  for (let i = 0; i < 40 && !wall; i++) wall = moveBody(w, pos, HALF, 0, -0.02, -0.08, [crate]).wall;
  assert.equal(wall?.__owner, crate);
  assert.ok(groundBelow(w, 0, -6, 5, 50, [crate]) === 1);
});

test('one-way platforms can be jumped through from below', () => {
  const w = new StaticWorld();
  w.add({ min: { x: -2, y: 2, z: -2 }, max: { x: 2, y: 2.3, z: 2 }, oneWay: true });
  const pos = { x: 0, y: 0.5, z: 0 };
  for (let i = 0; i < 30; i++) moveBody(w, pos, HALF, 0, 0.15, 0, null);
  assert.ok(pos.y > 2.3);
  const r = moveBody(w, pos, HALF, 0, -0.5, 0, null);
  for (let i = 0; i < 80 && !r.ground; i++) Object.assign(r, moveBody(w, pos, HALF, 0, -0.1, 0, null));
  assert.equal(pos.y, 2.3);
});

test('builder anchors entity offsets to the last segment', () => {
  const b = level({ id: 'T', world: 0, index: 0, name: { fr: 't', en: 't' }, theme: 'beach' });
  b.floor(10).crate('basic', 0, 4).gap(4).floor(6).crate('basic', 1, 2).goal(6);
  const d = b.build();
  assert.deepEqual([d.entities[0].x, d.entities[0].z], [0, -4]);
  assert.deepEqual([d.entities[1].x, d.entities[1].z], [1, -16]);
  assert.equal(d.platforms.length, 3);
  assert.ok(d.goal[2] < -20);
  assert.ok(d.killY < -10);
  assert.ok(new Set(d.entities.map((e) => e.id)).size === d.entities.length);
});

test('builder side levels map forward to +X', () => {
  const b = level({ id: 'T2', world: 0, index: 0, name: { fr: 't', en: 't' }, theme: 'lab', dir: 'x', mode: 'side' });
  b.floor(10).crate('basic', 0, 5).goal();
  const d = b.build();
  assert.equal(d.entities[0].x, 5);
  assert.equal(d.entities[0].z, -0);
});
