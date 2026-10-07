// Level design A — static analysis of built level data (no DOM, no three): catalogue check, crate supports,
// reachability graph (jump model from src/game/player.js), stats. Used by tests/levels-w12.test.js and
// tools/levels-a-stats.mjs.

export const CATALOG = {
  crate: ['basic', 'lights', 'bounce', 'life', 'mask', 'checkpoint', 'iron', 'ironBounce', 'tnt', 'nitro', 'nitroSwitch',
    'switch', 'outline', 'time1', 'time2', 'time3', 'legs', 'mystery'],
  pickup: ['light', 'sock', 'goldSock', 'sign', 'goal'],
  enemy: ['crab', 'turtle', 'plant', 'bat', 'porcupine', 'scorpion', 'camel', 'pigeon', 'cat', 'penguin', 'yetiKid', 'robot',
    'drone', 'cactus', 'skunk', 'rat', 'chicken'],
  hazard: ['spikes', 'fireJet', 'pendulum', 'crusher', 'laser', 'water', 'lava', 'saw', 'barrels', 'wind', 'boulder'],
  platform: ['moving', 'falling', 'sinking', 'bouncy', 'rotating', 'vanishing'],
  boss: ['crabKing', 'djinn', 'yeti', 'cortisol', 'goldenCortisol'],
};
export const NON_COUNTING = new Set(['iron', 'ironBounce', 'time1', 'time2', 'time3']);
export const counts = (e) => e.type === 'crate' && !NON_COUNTING.has(e.kind);

// ---- player physics (keep in sync with src/game/player.js)
const G = 34, RUN = 7.6, JUMP = 12.4, DJUMP = 11.2, SPRING = 17.5; // spring = crate-logic BOUNCE.spring (bouncy platform: 18)
const apex = (v) => (v * v) / (2 * G);
/** Horizontal distance covered when landing `dy` above take-off height with initial vy `v`. */
function reachSingle(dy, v) {
  const disc = v * v - 2 * G * dy;
  if (disc < 0) return -1;
  return RUN * (v + Math.sqrt(disc)) / G;
}
function reachDouble(dy, v) {
  const t1 = v / G, h1 = apex(v);
  const disc = DJUMP * DJUMP - 2 * G * (dy - h1);
  if (disc < 0) return -1;
  return RUN * (t1 + (DJUMP + Math.sqrt(disc)) / G);
}

/** Power profiles: maxGap caps the horizontal gap regardless of the parabola (comfort rule). */
export const PROFILES = {
  base: { name: 'base', double: false, glide: false, slam: false, maxGap: 4.8 },
  doubleJump: { name: 'doubleJump', double: true, glide: false, slam: false, maxGap: 7.2 },
  all: { name: 'all', double: true, glide: true, slam: true, maxGap: 15 },
};

function canJump(dy, d, spring, prof, speed = RUN) {
  const v = spring ? SPRING : JUMP;
  const margin = 0.88, k = speed / RUN;
  let r = reachSingle(dy, v);
  if (prof.double) r = Math.max(r, reachDouble(dy, v));
  if (prof.glide && dy <= (prof.double ? 3.5 : 1.8)) r = Math.max(r, 16);
  if (r < 0) return false;
  return d <= Math.min(r * margin * k, prof.maxGap * k) + 1e-6;
}

const rectDist = (a, b) => Math.hypot(Math.max(0, a.x0 - b.x1, b.x0 - a.x1), Math.max(0, a.z0 - b.z1, b.z0 - a.z1));

/** Standable surfaces: static platform tops + entity platforms + iron crates. */
export function surfaces(L, { withCrates = false } = {}) {
  const out = [];
  for (const p of L.platforms) {
    if (p.damage) continue;
    out.push({ x0: p.min[0], x1: p.max[0], z0: p.min[2], z1: p.max[2], y: p.max[1], src: 'static' });
  }
  for (const e of L.entities) {
    if (e.type === 'platform') {
      // convention (hazard-platforms.js): def.y is the TOP surface
      const w = e.w ?? 2, d = e.d ?? 2;
      let x0 = e.x - w / 2, x1 = e.x + w / 2, z0 = e.z - d / 2, z1 = e.z + d / 2, y = e.y;
      if (e.kind === 'rotating') { const r = Math.max(w, d) / 2; x0 = e.x - r; x1 = e.x + r; z0 = e.z - r; z1 = e.z + r; }
      if (e.to) {
        x0 = Math.min(x0, x0 + e.to.x); x1 = Math.max(x1, x1 + e.to.x);
        z0 = Math.min(z0, z0 + e.to.z); z1 = Math.max(z1, z1 + e.to.z);
        y = Math.max(y, y + e.to.y);
      }
      out.push({ x0, x1, z0, z1, y, src: 'platform', spring: e.kind === 'bouncy', id: e.id, bonus: e.bonus });
    } else if (e.type === 'crate' && (e.kind === 'iron' || e.kind === 'ironBounce' || (withCrates && e.kind !== 'outline' && e.kind !== 'legs'))) {
      out.push({ x0: e.x - 0.5, x1: e.x + 0.5, z0: e.z - 0.5, z1: e.z + 0.5, y: e.y + 1, src: 'crate', kind: e.kind,
        spring: e.kind === 'ironBounce' || e.kind === 'bounce', id: e.id, iron: e.kind === 'iron', bonus: e.bonus });
    }
  }
  return out;
}

function onTop(S, x, y, z, tol = 0.06) {
  return S.findIndex((s) => Math.abs(s.y - y) < tol && x >= s.x0 - 1e-6 && x <= s.x1 + 1e-6 && z >= s.z0 - 1e-6 && z <= s.z1 + 1e-6);
}

/**
 * Exploration: BFS over surfaces from the spawn; then crates that can be hit from a reachable surface become extra
 * springboards (landing on a crate bounces Lumen) and the BFS continues from their tops. Returns reachable surfaces
 * and breakable crates. `filter` selects which crates may be used / are evaluated.
 */
export function explore(L, prof = PROFILES.base, { filter = () => true, useCrates = true } = {}) {
  const S = surfaces(L);
  const start = onTop(S, L.spawn[0], L.spawn[1], L.spawn[2], 0.2);
  const seen = new Set();
  const ok = new Set();
  if (start < 0) return { S, seen, start, ok };
  const q = [start]; seen.add(start);
  const speed = L.mode === 'ride' ? Math.max(RUN, L.autoRun ?? 11) : RUN;
  const bfs = () => {
    while (q.length) {
      const i = q.shift(), a = S[i];
      for (let j = 0; j < S.length; j++) {
        if (seen.has(j)) continue;
        const b = S[j];
        const d = rectDist(a, b), dy = b.y - a.y;
        if ((d < 1e-6 && dy <= 0.33) || canJump(dy, d, a.spring, prof, speed)) { seen.add(j); q.push(j); }
      }
    }
  };
  bfs();
  if (!useCrates) return { S, seen, start, ok };
  const crates = L.entities.filter((e) => e.type === 'crate' && e.kind !== 'iron' && e.kind !== 'ironBounce' && filter(e));
  let changed = true;
  while (changed) {
    changed = false;
    for (const c of crates) {
      if (ok.has(c)) continue;
      const r = { x0: c.x - 0.5, x1: c.x + 0.5, z0: c.z - 0.5, z1: c.z + 0.5 };
      const hit = [...seen].some((i) => {
        const s = S[i];
        const d = rectDist(s, r), dy = c.y - s.y;
        const up = s.spring ? apex(SPRING) - 1 : (prof.double ? 3.2 : 1.25);
        // side / top hit; head bump from below only for floating crates (a supported crate has its support in the way)
        return (d <= 3.2 && dy <= up) || (c.float && d <= 0.6 && dy <= up + 2.1);
      });
      if (hit) {
        ok.add(c); changed = true;
        S.push({ ...r, y: c.y + 1, spring: c.kind === 'bounce', src: 'crateTop' });
        seen.add(S.length - 1); q.push(S.length - 1);
        bfs();
      }
    }
  }
  return { S, seen, start, ok };
}

export function goalReachable(L, prof) {
  const { S, seen } = explore(L, prof, { useCrates: false });
  const g = onTop(S, L.goal[0], L.goal[1], L.goal[2], 0.2);
  return g >= 0 && seen.has(g);
}

/** Crates not supported by a static platform, an entity platform or another crate (unless def.float). */
export function unsupportedCrates(L) {
  const S = surfaces(L);
  const crates = L.entities.filter((e) => e.type === 'crate');
  const bad = [];
  for (const c of crates) {
    if (c.float) continue;
    if (onTop(S, c.x, c.y, c.z) >= 0) continue;
    if (crates.some((o) => o !== c && Math.abs(o.x - c.x) < 0.6 && Math.abs(o.z - c.z) < 0.6 && Math.abs(o.y + 1 - c.y) < 0.06)) continue;
    bad.push(c);
  }
  return bad;
}

/**
 * Crates that cannot be broken with the given profile (non-bonus crates), or even with every power (crates tagged
 * `bonus: '<power>'`, the "come back later" areas).
 */
export function unreachableCrates(L, prof = PROFILES.base) {
  const res = [];
  const a = explore(L, prof, { filter: (c) => !c.bonus });
  for (const c of L.entities) if (c.type === 'crate' && !c.bonus && c.kind !== 'iron' && c.kind !== 'ironBounce' && !a.ok.has(c)) res.push(c);
  const b = explore(L, PROFILES.all);
  for (const c of L.entities) if (c.type === 'crate' && c.bonus && !b.ok.has(c)) res.push(c);
  return res;
}

/** Entities tagged as bonus that are ALSO reachable without powers (the gate leaks). */
export function leakyBonus(L, prof = PROFILES.base) {
  const a = explore(L, prof, { filter: (c) => !c.bonus });
  return L.entities.filter((c) => c.type === 'crate' && c.bonus && a.ok.has(c) === false && (() => {
    const r = { x0: c.x - 0.5, x1: c.x + 0.5, z0: c.z - 0.5, z1: c.z + 0.5 };
    return [...a.seen].some((i) => { const s = a.S[i]; return rectDist(s, r) <= 0.6 && c.y - s.y <= 1.25 && c.y - s.y >= -0.1; });
  })());
}

export function catalogErrors(L) {
  const errs = [];
  for (const e of L.entities) {
    if (!CATALOG[e.type]) errs.push(`${e.id}: unknown type ${e.type}`);
    else if (!CATALOG[e.type].includes(e.kind)) errs.push(`${e.id}: unknown ${e.type} kind ${e.kind}`);
  }
  return errs;
}

export function stats(L) {
  const ents = L.entities;
  const by = (type, kind) => ents.filter((e) => e.type === type && (!kind || e.kind === kind)).length;
  const fwd = L.dir === 'x' ? (p) => p[0] : (p) => -p[2];
  const length = fwd(L.goal) - fwd(L.spawn);
  const kinds = {};
  for (const e of ents) if (e.type === 'crate') kinds[e.kind] = (kinds[e.kind] || 0) + 1;
  return {
    id: L.id, mode: L.mode, length: Math.round(length), crates: ents.filter(counts).length, kinds,
    lights: by('pickup', 'light'), enemies: by('enemy'), hazards: by('hazard'), platforms: by('platform'),
    signs: by('pickup', 'sign'), socks: by('pickup', 'sock'), checkpoints: by('crate', 'checkpoint'),
    zones: L.zones.length, decor: L.decor.length,
  };
}

/**
 * Crates on the running line whose bounce (≈ 6 m) would throw Lumen into a pit: the crate's supporting platform ends
 * less than `min` metres after it and nothing at a similar height continues right after. Returns [{crate, dist}].
 */
export function bounceTraps(L, min = 6.5) {
  const fwdOf = L.dir === 'x' ? (x, z) => x : (x, z) => -z;
  const latOf = L.dir === 'x' ? (x, z) => -z : (x, z) => x;
  const P = L.platforms.map((p) => {
    const f0 = Math.min(fwdOf(p.min[0], p.min[2]), fwdOf(p.max[0], p.max[2])), f1 = Math.max(fwdOf(p.min[0], p.min[2]), fwdOf(p.max[0], p.max[2]));
    const l0 = Math.min(latOf(p.min[0], p.min[2]), latOf(p.max[0], p.max[2])), l1 = Math.max(latOf(p.min[0], p.min[2]), latOf(p.max[0], p.max[2]));
    return { f0, f1, l0, l1, y: p.max[1] };
  });
  const out = [];
  for (const c of L.entities) {
    if (c.type !== 'crate' || c.kind === 'iron' || c.kind === 'outline' || c.float || /^time/.test(c.kind)) continue;
    const f = fwdOf(c.x, c.z), l = latOf(c.x, c.z);
    const sup = P.find((p) => Math.abs(p.y - c.y) < 0.06 && f >= p.f0 && f <= p.f1 && l >= p.l0 && l <= p.l1);
    if (!sup) continue;
    if (Math.abs(l - (sup.l0 + sup.l1) / 2) > 1.3) continue;           // off the running line
    // walk forward along contiguous floors (same height ±1.2) to find the real edge
    let end = sup.f1, grew = true;
    while (grew) {
      grew = false;
      for (const p of P) if (p.f0 <= end + 0.05 && p.f1 > end && l >= p.l0 && l <= p.l1 && Math.abs(p.y - c.y) <= 1.25) { end = p.f1; grew = true; }
    }
    if (end - f < min) out.push({ crate: c, dist: +(end - f).toFixed(1) });
  }
  return out;
}
