// Boss arenas (Agent Boss): B1 Papa Crabe Royal · B2 Djinn · B3 Yéti · B4 Docteur Néo Cortisol · BS Cortisol Doré.
// Arenas are built in WORLD coordinates (cursor at the origin: lat = x, fwd = -z, up = y). The player spawns on the
// +Z side, the boss stands on the -Z side, the 'arena' camera looks from +Z at camera.center.
import { level, t } from './builder.js';

/** Axis-aligned box in world coords. */
function box(b, x0, x1, y0, y1, z0, z1, kind, opts = {}) {
  return b.rawBox(x0, x1, y0, y1, -z0, -z1, { kind, ...opts });
}
/** Disc approximated by strips along Z (pixel-art circle — assumed). */
function disk(b, cx, cz, r, y, kind, { step = 1.5, thick = 4, opts = {} } = {}) {
  const n = Math.ceil((2 * r) / step);
  for (let i = 0; i < n; i++) {
    const z0 = cz - r + i * step, z1 = Math.min(cz + r, z0 + step), zm = (z0 + z1) / 2;
    const hw = Math.sqrt(Math.max(0, r * r - (zm - cz) ** 2));
    if (hw < 0.6) continue;
    box(b, cx - hw, cx + hw, y - thick, y, z0, z1, kind, opts);
  }
}
/** Entity at world coords. */
function at(b, type, kind, x, y, z, params = {}) { return b.ent(type, kind, x, -z, y, params); }
function newArena(meta) {
  const b = level({ mode: 'boss', index: 6, ...meta });
  b.at(0, 0, 0);
  return b;
}

// ------------------------------------------------------------------ B1 — Papa Crabe Royal (beach)
function b1() {
  const b = newArena({ id: 'B1', world: 1, name: t('Papa Crabe Royal', 'King Papa Crab'), theme: 'boss_beach', music: 'boss',
    intro: t('Papa Crabe Royal : il pince, il charge, il a une couronne. Nous, on a un renard.',
      'King Papa Crab: he pinches, he charges, he has a crown. We have a fox.'),
    camera: { center: [0, 0, -9.5], dist: 15.5, height: 10.5 }, killY: -7 });
  disk(b, 0, -10, 11, 0, 'sand');
  // two rocks on the edge with goodies
  box(b, -9.4, -7.8, 0, 0.9, -5.6, -4.0, 'stone');
  box(b, 7.8, 9.4, 0, 0.9, -5.6, -4.0, 'stone');
  at(b, 'crate', 'mask', -8.6, 0.9, -4.8);
  at(b, 'crate', 'basic', 8.6, 0.9, -4.8);
  at(b, 'crate', 'basic', -6.2, 0, -16.6);
  at(b, 'crate', 'basic', 6.2, 0, -16.6);
  at(b, 'boss', 'crabKing', 0, 0, -15.5, { arena: { x: 0, z: -10, r: 11 } });
  b.spawn(0, 0, 1.6); // world (0,0,-1.6)
  b.deco('palm', -12.5, 4, 0, 1.2);
  b.deco('palm', 12.5, 6, 0, 1.1);
  return b.build();
}

// ------------------------------------------------------------------ B2 — Djinn (desert)
function b2() {
  const b = newArena({ id: 'B2', world: 2, name: t('Djinn de la Lampe Mal Polie', 'The Rude Lamp Djinn'), theme: 'boss_desert', music: 'boss',
    intro: t('Djinn de la Lampe Mal Polie : trois vœux, zéro savoir-vivre.', 'The Rude Lamp Djinn: three wishes, zero manners.'),
    camera: { center: [0, 0, -9.5], dist: 16.5, height: 11.5 }, killY: -7 });
  box(b, -10, 10, -4, 0, -20, 0, 'tile');
  // sandstone border strips (cosmetic, same height)
  box(b, -11, -10, -4, 0, -20, 0, 'sand');
  box(b, 10, 11, -4, 0, -20, 0, 'sand');
  // four pillars to hop on
  for (const [x, z] of [[-7.5, -3.5], [7.5, -3.5], [-7.5, -16.5], [7.5, -16.5]]) box(b, x - 0.9, x + 0.9, 0, 1.3, z - 0.9, z + 0.9, 'stone');
  at(b, 'crate', 'mask', -7.5, 1.3, -3.5);
  at(b, 'crate', 'basic', 7.5, 1.3, -3.5);
  at(b, 'crate', 'basic', -9.2, 0, -10);
  at(b, 'crate', 'basic', 9.2, 0, -10);
  at(b, 'boss', 'djinn', 0, 0, -15.5, { arena: { x: 0, z: -10, r: 10, shape: 'square' } });
  b.spawn(0, 0, 1.6);
  return b.build();
}

// ------------------------------------------------------------------ B3 — Yéti Influenceur (ice)
function b3() {
  const b = newArena({ id: 'B3', world: 3, name: t('Yéti Influenceur', 'Influencer Yeti'), theme: 'boss_ice', music: 'boss',
    intro: t('Yéti Influenceur : 12 abonnés, 0 scrupules. Pensez à sourire.', 'Influencer Yeti: 12 followers, 0 scruples. Remember to smile.'),
    camera: { center: [0, 0, -10], dist: 16.5, height: 11.5 }, killY: -7 });
  // snow frame + slippery ice rink in the middle
  box(b, -11, 11, -4, 0, -21, -18, 'snow');
  box(b, -11, 11, -4, 0, -2, 1, 'snow');
  box(b, -11, -8, -4, 0, -18, -2, 'snow');
  box(b, 8, 11, -4, 0, -18, -2, 'snow');
  box(b, -8, 8, -4, 0, -18, -2, 'ice');
  // ice blocks in the corners
  box(b, -10.6, -9, 0, 1.2, -20.6, -19, 'ice');
  box(b, 9, 10.6, 0, 1.2, -20.6, -19, 'ice');
  at(b, 'crate', 'mask', -9.6, 0, -1);
  at(b, 'crate', 'basic', 9.6, 0, -1);
  at(b, 'crate', 'basic', -9.8, 1.2, -19.8);
  at(b, 'crate', 'basic', 9.8, 1.2, -19.8);
  at(b, 'boss', 'yeti', 0, 0, -15.5, { arena: { x: 0, z: -10, r: 11, shape: 'square' } });
  b.spawn(0, 0, 0.5);
  return b.build();
}

// ------------------------------------------------------------------ B4 — Docteur Néo Cortisol (lab)
function b4() {
  const b = newArena({ id: 'B4', world: 4, name: t('Docteur Néo Cortisol', 'Doctor Neo Cortisol'), theme: 'boss_lab', music: 'final_boss',
    intro: t('Docteur Néo Cortisol. Taux de stress : 9000. Taille de la tête : oui.', 'Doctor Neo Cortisol. Stress level: 9000. Head size: yes.'),
    camera: { center: [0, 0, -13.5], dist: 18, height: 12.5, lookUp: 2.2 }, killY: -8 });
  disk(b, 0, -12, 12, 0, 'metal');
  // the Stressotron + Zina's cage stand on a platform behind the arena
  box(b, -8, 8, -4, 0, -32, -26, 'metal');
  at(b, 'crate', 'mask', -9.5, 0, -6);
  at(b, 'crate', 'mask', 9.5, 0, -6);
  at(b, 'crate', 'basic', -10.4, 0, -14);
  at(b, 'crate', 'basic', 10.4, 0, -14);
  at(b, 'boss', 'cortisol', 0, 0, -19, { arena: { x: 0, z: -12, r: 12 }, machine: [0, 0, -29], cage: [5, 0, -28.5] });
  b.spawn(0, 0, 1.5);
  return b.build();
}

// ------------------------------------------------------------------ BS — Cortisol Doré (secret)
function bs() {
  const b = newArena({ id: 'BS', world: 5, name: t('Cortisol Doré', 'Golden Cortisol'), theme: 'golden', music: 'final_boss',
    intro: t('Cortisol Doré. Il chante. Faux. En or massif.', 'Golden Cortisol. He sings. Off-key. In solid gold.'),
    camera: { center: [0, 0, -13.5], dist: 19, height: 13, lookUp: 2.2 }, killY: -8 });
  disk(b, 0, -12, 9.5, 0, 'tile');
  // four golden islets around the arena
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + i * Math.PI / 2, x = Math.sin(a) * 12.2, z = -12 + Math.cos(a) * 12.2;
    box(b, x - 1.8, x + 1.8, -4, 0, z - 1.8, z + 1.8, 'crystal');
  }
  const isl = (i) => { const a = Math.PI / 4 + i * Math.PI / 2; return [Math.sin(a) * 12.2, -12 + Math.cos(a) * 12.2]; };
  at(b, 'crate', 'mask', isl(0)[0], 0, isl(0)[1]);
  at(b, 'crate', 'mask', isl(3)[0], 0, isl(3)[1]);
  at(b, 'crate', 'basic', isl(1)[0], 0, isl(1)[1]);
  at(b, 'crate', 'basic', isl(2)[0], 0, isl(2)[1]);
  box(b, -8, 8, -4, 0, -32, -26, 'tile');
  at(b, 'boss', 'goldenCortisol', 0, 0, -19, { arena: { x: 0, z: -12, r: 9.5 }, machine: [0, 0, -29], cage: [5, 0, -28.5] });
  b.spawn(0, 0, 4.5);
  return b.build();
}

export default [b1(), b2(), b3(), b4(), bs()];
