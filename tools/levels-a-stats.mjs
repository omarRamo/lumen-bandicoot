// node tools/levels-a-stats.mjs [w1|w2] — prints stats + analysis problems for Level design A levels.
import { bounceTraps, stats, goalReachable, unsupportedCrates, unreachableCrates, catalogErrors, explore, PROFILES } from './levels-a-lib.mjs';
const which = process.argv.slice(2);
const mods = which.length ? which : ['w1', 'w2'];
for (const m of mods) {
  const levels = (await import(`../src/levels/${m}.js`)).default;
  for (const L of levels) {
    const s = stats(L);
    const prof = L.world === 1 ? PROFILES.base : PROFILES.base;
    const probs = [];
    if (!goalReachable(L, PROFILES.base)) probs.push('GOAL UNREACHABLE (base)');
    const ce = catalogErrors(L); if (ce.length) probs.push('catalog: ' + ce.join(', '));
    const us = unsupportedCrates(L); if (us.length) probs.push('unsupported: ' + us.map((c) => `${c.id}:${c.kind}@${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}`).join(' '));
    const ur = unreachableCrates(L, L.world === 2 ? PROFILES.doubleJump : PROFILES.base);
    if (ur.length) probs.push('unreachable: ' + ur.map((c) => `${c.id}:${c.kind}@${c.x.toFixed(1)},${c.y.toFixed(1)},${c.z.toFixed(1)}${c.bonus ? '(bonus)' : ''}`).join(' '));
    // bonus crates must NOT be reachable without powers
    const leak = explore(L, PROFILES.base);
    const leaks = L.entities.filter((c) => c.type === 'crate' && c.bonus && c.bonus !== 'superSlam' && leak.ok.has(c));
    if (leaks.length) probs.push('bonus leaks: ' + leaks.map((c) => c.id).join(' '));
    const traps = L.mode === 'ride' ? [] : bounceTraps(L);
    if (traps.length) probs.push('bounce traps: ' + traps.map((t) => `${t.crate.id}:${t.crate.kind}@f${(L.dir === 'x' ? t.crate.x : -t.crate.z).toFixed(1)}(${t.dist}m)`).join(' '));
    console.log(`${s.id} ${s.mode.padEnd(5)} len ${s.length}m crates ${s.crates} lights ${s.lights} enemies ${s.enemies} hz ${s.hazards} plat ${s.platforms} signs ${s.signs} socks ${s.socks} cp ${s.checkpoints} zones ${s.zones}`);
    console.log('    ', JSON.stringify(s.kinds));
    for (const p of probs) console.log('   !', p);
  }
}
