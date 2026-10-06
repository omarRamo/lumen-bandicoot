// Character team tests (Node, no DOM): Lumen / Oku Oku / mounts API contract, animations, deaths, disposal.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createLumen, createOku, createMount, DEATH_DURATION } from '../src/art/lumen.js';

const ANIMS = ['idle', 'run', 'jump', 'flip', 'fall', 'land', 'spin', 'slide', 'slam', 'ride', 'victory'];
const CAUSES = ['fall', 'burn', 'squash', 'water', 'zap', 'explode', 'eaten', 'generic'];

function finiteTree(root) {
  let ok = true;
  root.traverse((o) => {
    for (const v of [o.position.x, o.position.y, o.position.z, o.scale.x, o.scale.y, o.scale.z, o.rotation.x, o.rotation.y, o.rotation.z]) if (!Number.isFinite(v)) ok = false;
  });
  return ok;
}

test('createLumen: contract shape', () => {
  const L = createLumen({ scarf: '#e98c73' });
  assert.ok(L.object3d instanceof THREE.Object3D);
  for (const k of ['update', 'playDeath', 'reset', 'setScarf', 'dispose']) assert.equal(typeof L[k], 'function', k);
  // feet at the origin, ~1.1 m tall
  L.update(1 / 60, { anim: 'idle', t: 0, grounded: true, speed: 0, vy: 0 });
  const box = new THREE.Box3().setFromObject(L.joints.headMesh);
  assert.ok(box.max.y > 0.95 && box.max.y < 1.25, `head top ${box.max.y}`);
  L.dispose();
});

test('Lumen: every animation runs and stays finite (with a moving parent)', () => {
  const parent = new THREE.Group();
  const L = createLumen();
  parent.add(L.object3d);
  let t = 0;
  for (const anim of ANIMS) {
    for (let i = 0; i < 90; i++) {
      t += 1 / 60;
      parent.position.z -= 0.12; parent.rotation.y = Math.sin(t) * 0.5;
      L.update(1 / 60, { anim, t, speed: 7, vy: anim === 'fall' ? -10 : 8, grounded: !['jump', 'flip', 'fall', 'slam'].includes(anim), invincible: i % 2 === 0, spinT: 0.3, tornado: i > 45 });
    }
    assert.ok(finiteTree(L.object3d), `finite after ${anim}`);
  }
  // idle long enough to trigger every gag
  for (let i = 0; i < 60 * 40; i++) L.update(1 / 60, { anim: 'idle', t: i / 60, grounded: true, speed: 0, vy: 0 });
  assert.ok(finiteTree(L.object3d));
});

test('Lumen: deaths return 1.2–2 s, animate, and reset() restores everything', () => {
  const L = createLumen();
  const visibleCount = () => { let n = 0; L.object3d.traverse((o) => { if (o.isMesh && o.visible) n++; }); return n; };
  L.update(1 / 60, { anim: 'idle', t: 0, grounded: true });
  const before = visibleCount();
  for (const c of CAUSES) {
    const d = L.playDeath(c);
    assert.ok(d >= 1.2 && d <= 2, `${c}: ${d}`);
    assert.equal(d, DEATH_DURATION[c]);
    for (let i = 0; i < Math.ceil(d * 60) + 10; i++) L.update(1 / 60, { anim: 'dead', t: i / 60, speed: 0, vy: 0 });
    assert.ok(finiteTree(L.object3d), `finite during ${c}`);
    L.reset();
    L.update(1 / 60, { anim: 'idle', t: 0, grounded: true });
    assert.equal(visibleCount(), before, `visibility restored after ${c}`);
    assert.equal(L.joints.fxPivot.rotation.x, 0);
  }
  assert.ok(L.playDeath('banana') >= 1.2, 'unknown cause → generic');
});

test('Lumen: setScarf accepts css strings and numbers', () => {
  const L = createLumen();
  L.setScarf('#7ad7c4');
  assert.equal(L.joints.wrap.material.color.getHex(), 0x7ad7c4);
  L.setScarf(0xffd76a);
  assert.equal(L.joints.wrap.material.color.getHex(), 0xffd76a);
});

test('Oku: counts 0..3, follows the target with lag', () => {
  const O = createOku();
  const target = new THREE.Group();
  target.position.set(5, 0, -3);
  target.updateMatrixWorld(true);
  O.update(1 / 60, { count: 0, target, time: 0, facing: Math.PI });
  assert.equal(O.object3d.visible, false);
  for (const count of [1, 2, 3]) {
    for (let i = 0; i < 120; i++) { target.position.z -= 0.05; target.updateMatrixWorld(true); O.update(1 / 60, { count, target, time: i / 60, facing: Math.PI }); }
    assert.equal(O.object3d.visible, true);
    assert.ok(O.object3d.position.distanceTo(target.position) < 2.5, `close to the target (count ${count})`);
    assert.ok(finiteTree(O.object3d));
  }
  O.dispose();
});

test('mounts: seat + animation for each kind', () => {
  for (const kind of ['snail', 'camel', 'penguin', 'rocket']) {
    const M = createMount(kind);
    assert.ok(M.seat instanceof THREE.Vector3, kind);
    assert.ok(M.seat.y > 0.3 && M.seat.y < 2, `${kind} seat height`);
    for (let i = 0; i < 120; i++) M.update(1 / 60, { speed: 10, turning: Math.sin(i / 20), jumping: i > 100, t: i / 60 });
    assert.ok(finiteTree(M.object3d), kind);
    assert.equal(M.object3d.userData.ride.kind, kind);
    M.dispose();
  }
});

test('dispose() never disposes shared geometries / materials', () => {
  const disposed = [];
  const g0 = THREE.BufferGeometry.prototype.dispose, m0 = THREE.Material.prototype.dispose;
  THREE.BufferGeometry.prototype.dispose = function () { disposed.push(this); return g0.call(this); };
  THREE.Material.prototype.dispose = function () { disposed.push(this); return m0.call(this); };
  try {
    const L = createLumen(), O = createOku(), M = createMount('camel');
    L.update(1 / 60, { anim: 'idle' });
    L.dispose(); O.dispose(); M.dispose();
    assert.ok(disposed.length > 0);
    assert.ok(disposed.every((r) => !r.userData?.shared), 'a shared resource was disposed');
  } finally {
    THREE.BufferGeometry.prototype.dispose = g0;
    THREE.Material.prototype.dispose = m0;
  }
});
