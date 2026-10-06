// Dev tool (agent Ennemis): visible mesh count (≈ draw calls) per enemy / hazard / platform kind.
import * as THREE from 'three';
import { StaticWorld } from '../src/core/physics.js';
import { createEntity } from '../src/core/registry.js';
import { ENEMY_KINDS } from '../src/game/entities/enemies.js';
import { HAZARD_KINDS } from '../src/game/entities/hazards.js';
import { PLATFORM_KINDS } from '../src/game/entities/hazard-platforms.js';
const world = new StaticWorld();
world.add({ min: { x: -20, y: -4, z: -200 }, max: { x: 20, y: 0, z: 20 } });
const player = { pos: new THREE.Vector3(0, 0, 30), vel: new THREE.Vector3(), ext: new THREE.Vector3(), box: { min: {}, max: {} } };
const ctx = { level: { world, data: { spawn: [0, 0, 0] }, checkpoint: [0, 0, 0], markGone() {}, isCommitted: () => false }, player, game: {}, camera: new THREE.PerspectiveCamera(), time: 0, theme: process.argv[2] || 'beach', quality: { level: 1 }, fx: {}, sfx() {} };
const count = (o) => { let n = 0; o.traverseVisible((m) => { if (m.isMesh) n++; }); return n; };
const out = [];
for (const [type, kinds] of [['enemy', ENEMY_KINDS], ['hazard', HAZARD_KINDS], ['platform', PLATFORM_KINDS]]) {
  for (const k of kinds) { const e = createEntity({ type, kind: k, x: 0, y: 0, z: 0, id: k }, ctx); out.push(`${type}/${k}: ${count(e.object3d)}`); }
}
console.log(out.join('\n'));
