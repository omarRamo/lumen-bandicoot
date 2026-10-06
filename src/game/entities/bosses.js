// Boss entities (Agent Boss). type 'boss', kinds: crabKing · djinn · yeti · cortisol · goldenCortisol.
// Each boss is a self-contained entity (see boss-kit.js): HUD via 'hud:boss', 'music:mod' {boss:true},
// 3 phases, telegraphed attacks → vulnerability window → hit → comic reaction → next phase, a short defeat
// cinematic and then ctx.level.complete(). Debug: window.__LB.level.entities.find(e => e.boss).boss
import { registerEntity } from '../../core/registry.js';
import { createCrabKing } from './boss-crab.js';
import { createDjinn } from './boss-djinn.js';
import { createYeti } from './boss-yeti.js';
import { createCortisol } from './boss-cortisol.js';

const FACTORIES = {
  crabKing: createCrabKing,
  djinn: createDjinn,
  yeti: createYeti,
  cortisol: (def, ctx) => createCortisol(def, ctx, false),
  goldenCortisol: (def, ctx) => createCortisol(def, ctx, true),
};

export const BOSS_KINDS = Object.keys(FACTORIES);

registerEntity('boss', (def, ctx) => {
  const f = FACTORIES[def.kind];
  if (!f) { console.warn(`[boss] unknown boss kind "${def.kind}"`); return null; }
  return f(def, ctx);
});
