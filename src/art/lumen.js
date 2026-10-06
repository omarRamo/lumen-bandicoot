// STUB — replaced by the character team. Contract: see docs/CONTRACTS.md + src/game/player.js usage.
import * as THREE from 'three';

export function createLumen() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.5, 4, 8), new THREE.MeshStandardMaterial({ color: 0x387d76 }));
  body.position.y = 0.55; g.add(body);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.07, 6, 12), new THREE.MeshStandardMaterial({ color: 0xe98c73 }));
  scarf.rotation.x = Math.PI / 2; scarf.position.y = 0.8; g.add(scarf);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.08), new THREE.MeshStandardMaterial({ color: 0xfff7dc }));
  nose.position.set(0, 0.95, 0.3); g.add(nose);
  let dead = false;
  return {
    object3d: g,
    update(dt, s) { g.rotation.y = s.anim === 'spin' ? g.rotation.y + dt * 30 : 0; g.scale.y = dead ? 0.2 : 1; },
    playDeath() { dead = true; return 1.2; },
    reset() { dead = false; g.scale.y = 1; },
    setScarf() {}, dispose() {},
  };
}

export function createOku() {
  const g = new THREE.Group();
  return { object3d: g, update() {}, dispose() {} };
}

export function createMount() {
  const g = new THREE.Group();
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.5, 1.4), new THREE.MeshStandardMaterial({ color: 0xc58c5a }));
  m.position.y = 0.25; g.add(m);
  return { object3d: g, seat: new THREE.Vector3(0, 0.5, 0), update() {}, dispose() {} };
}
