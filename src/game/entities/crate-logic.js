// Pure crate/pickup rules (no three.js, no DOM) — shared by crates.js / pickups.js and unit-tested in Node
// (tests/crates.test.js). Keep this file free of side effects.

/** Every crate kind of the catalogue (docs/CONTRACTS.md). */
export const CRATE_KINDS = [
  'basic', 'lights', 'bounce', 'life', 'mask', 'checkpoint', 'iron', 'ironBounce', 'tnt', 'nitro', 'nitroSwitch',
  'switch', 'outline', 'time1', 'time2', 'time3', 'legs', 'mystery',
];
export const PICKUP_KINDS = ['light', 'sock', 'goldSock', 'sign', 'goal'];

/** Counts in the level crate total: everything but iron, ironBounce and time crates. */
export function crateCounts(kind) {
  return !(kind === 'iron' || kind === 'ironBounce' || /^time[123]$/.test(kind));
}

/** Can this crate be destroyed by a given hit? how ∈ land|spin|bump|slam|slam2|explode */
export function breaksOn(kind, how) {
  switch (kind) {
    case 'iron': return how === 'slam2';
    case 'ironBounce': return false;
    case 'bounce': return how !== 'land';          // springy: landing bounces, anything else breaks it
    case 'lights': return how !== 'land' && how !== 'bump'; // "?" crate: bounces/bumps give lights one by one
    case 'tnt': return how === 'spin' || how === 'slam' || how === 'slam2' || how === 'explode';
    case 'outline': return true;                    // only once materialized (checked by the entity)
    default: return true;
  }
}

/** Bounce speeds (player.bounce). */
export const BOUNCE = { crate: 12.5, spring: 17.5, bumpDown: -4 };
/** Max lights given by a "?" crate before it breaks. */
export const LIGHTS_CRATE_MAX = 10;
/** Lights by crate kind when it breaks. */
export function lightsFor(kind) {
  if (kind === 'basic' || kind === 'outline' || kind === 'legs') return 5;
  if (kind === 'bounce') return 3;
  return 0;
}
export const TNT_FUSE = 3;           // seconds (3-2-1)
export const COMBO_WINDOW = 1.15;    // seconds between two breaks to keep a combo alive

/** TNT countdown digit shown for remaining fuse time (3 → 2 → 1). */
export function tntDigit(remaining) {
  return Math.max(1, Math.min(3, Math.ceil(remaining - 1e-6)));
}

/** Combo label for n consecutive breaks (null under 3). */
export function comboLabel(n, lang = 'fr') {
  if (n < 3) return null;
  const en = lang === 'en';
  if (n >= 15) return en ? `x${n} ! UNSTOPPABLE` : `x${n} ! IMPARABLE`;
  if (n >= 10) return en ? `x${n} ! LEGENDARY-ISH` : `x${n} ! LÉGENDAIRE (OU PRESQUE)`;
  if (n >= 8) return en ? `x${n} ! LAWYERS NERVOUS` : `x${n} ! AVOCATS INQUIETS`;
  if (n >= 5) return en ? `x${n} ! CRASH WHO ?` : `x${n} ! CRASH QUI ?`;
  return `COMBO x${n} !`;
}
/** Colour of the combo text (warmer as it grows). */
export function comboColor(n) {
  if (n >= 10) return '#ff7aa8';
  if (n >= 8) return '#c58cff';
  if (n >= 5) return '#ffd76a';
  return '#fff7dc';
}

/** Mystery crate outcome from a uniform random r ∈ [0,1). */
export const MYSTERY_TABLE = [
  ['lights', 0.34], ['chicken', 0.22], ['disco', 0.18], ['mask', 0.14], ['life', 0.12],
];
export function pickMystery(r) {
  let acc = 0;
  for (const [k, w] of MYSTERY_TABLE) { acc += w; if (r < acc) return k; }
  return MYSTERY_TABLE[MYSTERY_TABLE.length - 1][0];
}

/** Bad advice from Oku Oku when a mask crate is broken. */
export const OKU_ADVICE = [
  { fr: 'Oku Oku : « Conseil : saute sur les TNT, c\'est relaxant. »', en: 'Oku Oku: "Tip: jumping on TNT is very relaxing."' },
  { fr: 'Oku Oku : « Les caisses vertes ? Des bonbons. Fais-moi confiance. »', en: 'Oku Oku: "Green crates? Candy. Trust me."' },
  { fr: 'Oku Oku : « Je suis en carton. Ne me mouille pas. »', en: 'Oku Oku: "I\'m cardboard. Keep me dry."' },
  { fr: 'Oku Oku : « Ma garantie ne couvre pas les ravins. »', en: 'Oku Oku: "My warranty doesn\'t cover pits."' },
  { fr: 'Oku Oku : « Tourne plus vite, ça impressionne les crabes. »', en: 'Oku Oku: "Spin faster, crabs love it."' },
];

export const SOCK_COLORS = { red: 0xff5a5a, blue: 0x4a8cff, green: 0x4ad66a, purple: 0xb06aff };
export const SOCK_NAMES = {
  red: { fr: 'rouge', en: 'red' }, blue: { fr: 'bleue', en: 'blue' },
  green: { fr: 'verte', en: 'green' }, purple: { fr: 'violette', en: 'purple' },
};
export function sockToast(color) {
  const n = SOCK_NAMES[color] || { fr: color, en: color };
  return {
    fr: `Chaussette ${n.fr} trouvée ! (Lumen n'en porte pas, mais bon.)`,
    en: `Found a ${n.en} sock! (Lumen doesn't wear socks, but hey.)`,
  };
}

/** Text of a sign/toast in a language: accepts {fr,en} or a plain string. */
export function tr(text, lang = 'fr') {
  if (text == null) return '';
  if (typeof text === 'string') return text;
  return text[lang] ?? text.fr ?? text.en ?? '';
}

/** Greedy word-wrap using a measure(str) → width function. */
export function wrapText(str, maxWidth, measure, maxLines = 5) {
  const words = String(str).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? `${cur} ${w}` : w;
    if (measure(t) <= maxWidth || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] += '…'; }
  return lines;
}

/** Do two XZ footprints overlap (with a small inset so touching neighbours don't count)? */
export function overlapXZ(a, b, inset = 0.02) {
  return a.min.x < b.max.x - inset && a.max.x > b.min.x + inset && a.min.z < b.max.z - inset && a.max.z > b.min.z + inset;
}

/**
 * "Designed" support: is a crate at (x,y,z) resting on another crate of the level data, or on a ground top
 * at height groundTop? Used to know which crates should fall when what's below them disappears (floating crates
 * placed in the air by level designers never fall).
 */
export function designedSupport(def, defsBelow, groundTop) {
  if (Number.isFinite(groundTop) && Math.abs(groundTop - def.y) < 0.06) return true;
  for (const d of defsBelow) {
    if (d === def) continue;
    if (Math.abs(d.y + 1 - def.y) < 0.06 && Math.abs(d.x - def.x) < 0.98 && Math.abs(d.z - def.z) < 0.98) return true;
  }
  return false;
}

/** Legs-crate escape direction: away from the player with a zigzag (unit XZ vector written in out). */
export function fleeDir(cx, cz, px, pz, t, out = { x: 0, z: 0 }) {
  let dx = cx - px, dz = cz - pz;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  const zig = Math.sin(t * 5.2) * 0.75;
  out.x = dx - dz * zig; out.z = dz + dx * zig;
  const l2 = Math.hypot(out.x, out.z) || 1;
  out.x /= l2; out.z /= l2;
  return out;
}
