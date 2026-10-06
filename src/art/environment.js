// STUB — replaced by the environment team. Contract: createEnvironment(scene, data, opts) → { update, dispose }.
import * as THREE from 'three';

export function createEnvironment(scene, data) {
  const root = new THREE.Group();
  scene.background = new THREE.Color(0x9fd8ff);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x446644, 1.4); root.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2); sun.position.set(5, 10, 4); root.add(sun);
  const mat = new THREE.MeshStandardMaterial({ color: 0xd9c08a });
  for (const p of data.platforms) {
    const w = p.max[0] - p.min[0], h = p.max[1] - p.min[1], d = p.max[2] - p.min[2];
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set((p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2);
    root.add(m);
  }
  scene.add(root);
  return { update() {}, dispose() { scene.remove(root); } };
}
