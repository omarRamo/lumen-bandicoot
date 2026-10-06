// STUB — replaced by the crates team.
import * as THREE from 'three';
import { registerEntity } from '../../core/registry.js';

registerEntity('crate', (def, ctx) => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: def.kind === 'tnt' ? 0xd04030 : 0xb07a3a }));
  mesh.position.set(def.x, def.y + 0.5, def.z);
  const e = {
    object3d: mesh, solid: true, counts: true,
    box: { min: { x: def.x - 0.5, y: def.y, z: def.z - 0.5 }, max: { x: def.x + 0.5, y: def.y + 1, z: def.z + 0.5 } },
    onLand(p, c) { e.dead = true; c.level.crateBroken(e); p.bounce(); c.sfx('crate_break'); c.game.addLights(5); },
    onSpin(p, c) { e.dead = true; c.level.crateBroken(e); c.sfx('crate_break'); c.game.addLights(5); },
  };
  return e;
});
