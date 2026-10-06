// Level design B — islands 3, 4 and the secret world. Pure Node tests on the level data:
// structure (ids, catalogue kinds, metadata), placement (spawn/goal on ground, crates supported, nothing buried)
// and a jump-graph reachability check using the real player tuning (src/game/player.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import w3 from '../src/levels/w3.js';
import w4 from '../src/levels/w4.js';
import secret from '../src/levels/secret.js';

const LEVELS = [...w3, ...w4, ...secret];
const EXPECT = {
  '3-1': { mode: 'run', theme: 'ice' }, '3-2': { mode: 'run', theme: 'cave' }, '3-3': { mode: 'chase', theme: 'ice' },
  '3-4': { mode: 'ride', theme: 'ice', mount: 'penguin' }, '3-5': { mode: 'run', theme: 'aurora' },
  '4-1': { mode: 'run', theme: 'factory' }, '4-2': { mode: 'side', theme: 'lab' }, '4-3': { mode: 'chase', theme: 'factory' },
  '4-4': { mode: 'ride', theme: 'space', mount: 'rocket' }, '4-5': { mode: 'run', theme: 'tower' }, 'S-1': { mode: 'run', theme: 'golden' },
};
const CATALOG = {
  crate: 'basic lights bounce life mask checkpoint iron ironBounce tnt nitro nitroSwitch switch outline time1 time2 time3 legs mystery',
  pickup: 'light sock goldSock sign goal',
  enemy: 'crab turtle plant bat porcupine scorpion camel pigeon cat penguin yetiKid robot drone cactus skunk rat chicken',
  hazard: 'spikes fireJet pendulum crusher laser water lava saw barrels wind boulder',
  platform: 'moving falling sinking bouncy rotating vanishing',
  boss: 'crabKing djinn yeti cortisol goldenCortisol',
};
const PLATFORM_KINDS = 'ground grass sand stone wood metal ice tile brick crystal cloud conveyor glass lava_rock snow bridge'.split(' ');
const MUSIC = 'title map beach jungle river desert medina sidibou ice cave aurora factory lab space tower golden boss final_boss chase ride victory gameover results'.split(' ');
const NOT_COUNTED = new Set(['iron', 'ironBounce', 'time1', 'time2', 'time3']);
const POWERS = { 3: ['doubleJump', 'tornado'], 4: ['doubleJump', 'tornado', 'superSlam'], 5: ['doubleJump', 'tornado', 'superSlam', 'turbo'] };
const ALL = ['doubleJump', 'tornado', 'superSlam', 'turbo'];

// ------------------------------------------------------------------ jump model (player.js tuning)
const G = 34, JUMP = 12.4, DJUMP = 11.2, TORN = -2.6, TORN_AIR = 1.95, DT = 1 / 240;
const curves = new Map();
/** samples [t, y] of the best-height trajectory for a take-off vy and powers */
function curve(v0, dbl, torn) {
  const k = `${v0}|${dbl}|${torn}`;
  if (curves.has(k)) return curves.get(k);
  const out = [];
  let y = 0, vy = v0, t = 0, usedD = !dbl;
  while (t < 4 && y > -40) {
    vy -= G * DT;
    if (vy <= 0 && !usedD) { vy = DJUMP; usedD = true; }
    if (torn && usedD && vy < 0 && t < TORN_AIR) vy = Math.max(vy, TORN);
    y += vy * DT; t += DT;
    out.push([t, y]);
  }
  curves.set(k, out);
  return out;
}
/** horizontal reach (m) to land at relative height dh, or -1 if too high */
function reach(dh, speed, v0, powers) {
  const c = curve(v0, powers.includes('doubleJump'), powers.includes('tornado'));
  let best = -1;
  for (const [tt, y] of c) if (y >= dh) best = tt;
  return best < 0 ? -1 : best * speed;
}
const maxH = (v0, powers) => Math.max(...curve(v0, powers.includes('doubleJump'), false).map((s) => s[1]));

function rectDist(a, b) {
  const dx = Math.max(0, a.x0 - b.x1, b.x0 - a.x1), dz = Math.max(0, a.z0 - b.z1, b.z0 - a.z1);
  return Math.hypot(dx, dz);
}

/** nodes = walkable tops: static platforms, crates (springboards), platform entities (both ends of a mover) */
function nodesOf(L) {
  const nodes = [];
  const side = L.mode === 'side';
  const lz = L.lockZ ?? L.spawn[2];
  for (const p of L.platforms) {
    if (p.damage) continue;
    if (side && (p.min[2] > lz + 0.01 || p.max[2] < lz - 0.01)) continue;
    nodes.push({ x0: p.min[0], x1: p.max[0], z0: p.min[2], z1: p.max[2], y: p.max[1], v0: JUMP, src: p });
  }
  for (const e of L.entities) {
    if (e.type === 'crate' && !['nitro', 'outline', 'legs'].includes(e.kind) && !/^time/.test(e.kind)) {
      const v0 = /bounce/i.test(e.kind) ? 16 : 12.5;
      nodes.push({ x0: e.x - 0.5, x1: e.x + 0.5, z0: e.z - 0.5, z1: e.z + 0.5, y: e.y + 1, v0, src: e, gate: e.gate });
    }
    if (e.type === 'platform') {
      const w = e.kind === 'rotating' ? Math.min(e.w, e.d) * 0.7 : e.w, d = e.kind === 'rotating' ? w : e.d;
      const top = e.y; // hazard-platforms.js: def.y is the TOP surface
      const v0 = e.kind === 'bouncy' ? 16 : JUMP;
      const a = { x0: e.x - w / 2, x1: e.x + w / 2, z0: e.z - d / 2, z1: e.z + d / 2, y: top, v0, src: e };
      nodes.push(a);
      if (e.to) {
        const bnode = { x0: a.x0 + e.to.x, x1: a.x1 + e.to.x, z0: a.z0 + e.to.z, z1: a.z1 + e.to.z, y: top + (e.to.y || 0), v0, src: e };
        a.link = bnode; bnode.link = a;
        nodes.push(bnode);
      }
    }
  }
  return nodes;
}

function reachable(L, powers, { margin = 0.9 } = {}) {
  const nodes = nodesOf(L);
  const speed = L.mode === 'ride' ? (L.autoRun ?? 11) : powers.includes('turbo') ? 10.8 : 7.6;
  const start = nodes.find((n) => on(n, L.spawn));
  const seen = new Set();
  if (!start) return { nodes, seen, speed };
  const q = [start];
  seen.add(start);
  while (q.length) {
    const a = q.pop();
    if (a.gate && !powers.includes(a.gate)) continue;
    for (const b of nodes) {
      if (seen.has(b)) continue;
      let ok = a.link === b;
      if (!ok) {
        const d = Math.max(0, rectDist(a, b) - 0.6), dh = b.y - a.y;
        const r = reach(dh + 0.02, speed, a.v0, powers);
        ok = r >= 0 && r * margin >= d;
        if (ok && d === 0 && dh > 0 && dh > maxH(a.v0, powers) - 0.05) ok = false;
      }
      if (ok) { seen.add(b); q.push(b); }
    }
  }
  return { nodes, seen, speed };
}
function on(n, p) { return p[0] >= n.x0 - 0.01 && p[0] <= n.x1 + 0.01 && p[2] >= n.z0 - 0.01 && p[2] <= n.z1 + 0.01 && Math.abs(p[1] - n.y) < 0.06; }

/** can the player break crate c from one of the reachable nodes (spin from the ground, jump-spin, or land on it) */
function crateReachable(c, R, powers) {
  const box = { x0: c.x - 0.5, x1: c.x + 0.5, z0: c.z - 0.5, z1: c.z + 0.5 };
  for (const n of R.seen) {
    if (n.gate && !powers.includes(n.gate)) continue;
    if (n.src === c) return true;
    const hd = Math.max(0, rectDist(n, box) - 0.3 - 1.05); // stand at the edge, spin radius 1.05
    const dy = c.y - n.y;
    if (dy < -0.2 && hd <= 0.3 && dy > -1.4) return true; // slam / spin down onto it
    if (dy <= 1.1 && dy >= -0.5 && hd <= 0.01) return true;
    const r = reach(dy - 1.1, R.speed, n.v0, powers);
    if (dy >= -0.5 && r >= 0 && r * 0.9 >= hd) return true;
  }
  return false;
}

const inRect = (p, x, z, pad = 0) => x >= p.min[0] - pad && x <= p.max[0] + pad && z >= p.min[2] - pad && z <= p.max[2] + pad;
const supportedBy = (L, x, y, z) => L.platforms.some((p) => inRect(p, x, z, 0.05) && Math.abs(p.max[1] - y) < 0.02);

for (const L of LEVELS) {
  test(`${L.id} — metadata`, () => {
    const ex = EXPECT[L.id];
    assert.ok(ex, `unexpected level id ${L.id}`);
    assert.equal(L.mode, ex.mode);
    assert.equal(L.theme, ex.theme);
    if (ex.mount) assert.equal(L.mount, ex.mount);
    assert.ok(L.name?.fr && L.name?.en, 'name fr/en');
    assert.ok(L.intro?.fr && L.intro?.en, 'intro fr/en');
    assert.ok(MUSIC.includes(L.music), `music ${L.music}`);
    assert.ok(L.timeTrial && L.timeTrial.gold < L.timeTrial.silver && L.timeTrial.silver < L.timeTrial.bronze, 'timeTrial order');
    assert.equal(L.world, L.id === 'S-1' ? 5 : Number(L.id[0]));
    assert.ok(L.index >= 1);
    if (L.mode === 'side') assert.equal(L.dir, 'x');
    if (L.mode === 'ride') assert.ok(L.autoRun >= 12 && L.autoRun <= 15);
    assert.ok(L.pathLength >= 300 && L.pathLength <= 520, `path length ${L.pathLength}`);
  });

  test(`${L.id} — entities & catalogue`, () => {
    const ids = new Set();
    for (const e of L.entities) {
      assert.ok(!ids.has(e.id), `duplicate id ${e.id}`);
      ids.add(e.id);
      assert.ok(CATALOG[e.type]?.split(' ').includes(e.kind), `unknown ${e.type}/${e.kind}`);
      assert.ok([e.x, e.y, e.z].every(Number.isFinite), `bad position ${e.id}`);
    }
    for (const p of L.platforms) {
      assert.ok(PLATFORM_KINDS.includes(p.kind), `platform kind ${p.kind}`);
      for (let i = 0; i < 3; i++) assert.ok(p.max[i] > p.min[i], `degenerate platform ${JSON.stringify(p)}`);
    }
    const crates = L.entities.filter((e) => e.type === 'crate');
    const counted = crates.filter((e) => !NOT_COUNTED.has(e.kind));
    const by = (k) => crates.filter((e) => e.kind === k).length;
    assert.ok(counted.length >= 50 && counted.length <= 100, `${counted.length} counted crates`);
    assert.ok(by('checkpoint') >= 2 && by('checkpoint') <= 3, `${by('checkpoint')} checkpoints`);
    assert.ok(by('legs') + by('mystery') >= 1, 'a legs or mystery crate');
    assert.equal(L.entities.filter((e) => e.kind === 'sock').length, 1, 'exactly one secret sock');
    assert.ok(L.entities.filter((e) => e.kind === 'sign').length >= 2, 'at least 2 joke signs');
    if (by('nitro')) assert.ok(by('nitroSwitch') === 1, 'nitro crates need one nitroSwitch');
    for (const g of new Set(crates.filter((e) => e.kind === 'outline').map((e) => e.group))) {
      assert.ok(crates.some((e) => e.kind === 'switch' && e.group === g), `outline group ${g} has a switch`);
    }
    assert.ok(L.entities.filter((e) => e.kind === 'light').length >= 60, 'plenty of lights');
    if (L.mode === 'chase') assert.equal(L.entities.filter((e) => e.kind === 'boulder').length, 1, 'one boulder');
  });

  test(`${L.id} — placement`, () => {
    assert.ok(supportedBy(L, ...L.spawn), 'spawn stands on a platform');
    assert.ok(L.goal && supportedBy(L, ...L.goal), 'goal stands on a platform');
    const crates = L.entities.filter((e) => e.type === 'crate');
    const key = (x, y, z) => `${x.toFixed(2)},${y.toFixed(2)},${z.toFixed(2)}`;
    const at = new Set();
    for (const c of crates) {
      const k = key(c.x, c.y, c.z);
      assert.ok(!at.has(k), `two crates at ${k}`);
      at.add(k);
    }
    for (const c of crates) {
      const below = at.has(key(c.x, c.y - 1, c.z)) || (at.has(key(c.x - 0.5, c.y - 1, c.z)) && at.has(key(c.x + 0.5, c.y - 1, c.z))) ||
        (at.has(key(c.x, c.y - 1, c.z - 0.5)) && at.has(key(c.x, c.y - 1, c.z + 0.5))) || // builder pyramids are offset by half a crate
        (at.has(key(c.x - 1, c.y - 1, c.z)) && at.has(key(c.x + 1, c.y - 1, c.z))) || (at.has(key(c.x, c.y - 1, c.z - 1)) && at.has(key(c.x, c.y - 1, c.z + 1))); // cage roof (lintel)
      assert.ok(below || supportedBy(L, c.x, c.y, c.z), `crate ${c.id} ${c.kind} floats at ${key(c.x, c.y, c.z)}`);
      const buried = L.platforms.find((p) => c.x + 0.45 > p.min[0] && c.x - 0.45 < p.max[0] && c.z + 0.45 > p.min[2] && c.z - 0.45 < p.max[2] && c.y + 0.95 > p.min[1] && c.y + 0.05 < p.max[1]);
      assert.ok(!buried, `crate ${c.id} inside platform ${JSON.stringify(buried)}`);
    }
    for (const e of L.entities.filter((x) => x.type === 'pickup' || x.type === 'enemy')) {
      const buried = L.platforms.find((p) => inRect(p, e.x, e.z, -0.05) && e.y + 0.3 > p.min[1] && e.y + 0.05 < p.max[1]);
      assert.ok(!buried, `${e.kind} ${e.id} buried in ${JSON.stringify(buried)}`);
    }
    if (L.mode === 'side') for (const e of L.entities.filter((x) => x.type === 'crate' || x.kind === 'light')) {
      assert.ok(Math.abs(e.z - (L.lockZ ?? L.spawn[2])) < 0.01 || e.gate, `${e.kind} ${e.id} off the side-scroll plane`);
    }
  });

  test(`${L.id} — reachability (powers of the island)`, () => {
    const powers = POWERS[L.world];
    const R = reachable(L, powers);
    const goalNode = R.nodes.find((n) => on(n, L.goal));
    assert.ok(goalNode && R.seen.has(goalNode), 'goal reachable');
    const bad = L.entities.filter((e) => e.type === 'crate' && !NOT_COUNTED.has(e.kind) && !e.gate && !crateReachable(e, R, powers));
    assert.deepEqual(bad.map((c) => `${c.id}:${c.kind}@${c.x},${c.y},${c.z}`), [], 'unreachable crates');
    // and with every power (gated bonuses) — the sock must be reachable at least then
    const Rall = reachable(L, ALL);
    const sock = L.entities.find((e) => e.kind === 'sock');
    const sockOk = [...Rall.seen].some((n) => Math.abs(sock.y - 0.9 - n.y) < 2.6 && rectDist(n, { x0: sock.x, x1: sock.x, z0: sock.z, z1: sock.z }) < 1);
    assert.ok(sockOk, 'sock reachable (all powers)');
    const gated = L.entities.filter((e) => e.type === 'crate' && e.gate && !NOT_COUNTED.has(e.kind) && !crateReachable(e, Rall, ALL));
    assert.deepEqual(gated.map((c) => c.id), [], 'gated crates reachable with all powers');
  });
}

test('levels-w34 — summary', () => {
  for (const L of LEVELS) {
    const crates = L.entities.filter((e) => e.type === 'crate' && !NOT_COUNTED.has(e.kind)).length;
    const lights = L.entities.filter((e) => e.kind === 'light').length;
    console.log(`  ${L.id.padEnd(4)} ${L.name.fr.padEnd(24)} ${String(L.pathLength).padStart(4)} m  ${String(crates).padStart(3)} caisses  ${String(lights).padStart(3)} lucioles  ${L.platforms.length} plateformes  ${L.entities.length} entités`);
  }
  assert.equal(new Set(LEVELS.map((l) => l.id)).size, LEVELS.length);
});
