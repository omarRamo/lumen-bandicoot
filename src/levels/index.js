// World structure + level registry. Level files export `default` an array of built level data.
import w1 from './w1.js';
import w2 from './w2.js';
import w3 from './w3.js';
import w4 from './w4.js';
import secret from './secret.js';
import bosses from './bosses.js';

export const WORLDS = [
  { id: 1, name: { fr: 'Île des Lucioles', en: 'Firefly Island' }, color: '#6fd3a8',
    levels: ['1-1', '1-2', '1-3', '1-4', '1-5'], boss: 'B1' },
  { id: 2, name: { fr: 'Dunes de Tozeur', en: 'Tozeur Dunes' }, color: '#f0b45a',
    levels: ['2-1', '2-2', '2-3', '2-4', '2-5'], boss: 'B2' },
  { id: 3, name: { fr: 'Glacier des Pingouins Grognons', en: 'Grumpy Penguin Glacier' }, color: '#9fd8ff',
    levels: ['3-1', '3-2', '3-3', '3-4', '3-5'], boss: 'B3' },
  { id: 4, name: { fr: 'Usine du Dr Cortisol', en: 'Dr Cortisol\'s Factory' }, color: '#c58cff',
    levels: ['4-1', '4-2', '4-3', '4-4', '4-5'], boss: 'B4' },
  { id: 5, name: { fr: 'La Lune Dorée', en: 'The Golden Moon' }, color: '#ffd76a', secret: true,
    levels: ['S-1'], boss: 'BS' },
];

/** Story order of every stage (linear unlocks). */
export const ORDER = WORLDS.flatMap((w) => [...w.levels, w.boss]);

export const LEVELS = {};
for (const l of [...w1, ...w2, ...w3, ...w4, ...secret, ...bosses]) {
  if (l && l.id) LEVELS[l.id] = l;
}

/** Golden socks needed to open the secret world. */
export const SECRET_SOCKS_NEEDED = 12;

export function isUnlocked(id, save) {
  if (id === 'S-1') return !!save.levels.B4?.done && goldSockCount(save) >= SECRET_SOCKS_NEEDED;
  if (id === 'BS') return !!save.levels['S-1']?.done;
  const i = ORDER.indexOf(id);
  if (i <= 0) return true;
  const prev = ORDER[i - 1];
  return !!save.levels[prev]?.done;
}

export function goldSockCount(save) {
  return Object.values(save.levels).filter((l) => l && l.crates).length;
}

export function worldOf(id) {
  return WORLDS.find((w) => w.levels.includes(id) || w.boss === id) || null;
}
