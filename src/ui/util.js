// Lumen Bandicoot — UI pure helpers (no DOM at import time: also used by tests/ui.test.js).

export const PALETTE = {
  teal: '#387d76', deep: '#1f4f4c', mint: '#99d1b7', cream: '#fff7dc', coral: '#e98c73', gold: '#edc371',
  night: '#1c1640', aurora: '#b5f3d0', dawn: '#ffc193', comet: '#dbb2f6', orange: '#ff8a1e', ink: '#3a1d08',
};

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOutBack = (t) => { const c = 1.70158; return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2; };
export const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

/** Picks the right language from a {fr,en} object (or returns plain strings unchanged). */
export function tr(text, lang = 'fr') {
  if (text == null) return '';
  if (typeof text === 'string' || typeof text === 'number') return String(text);
  return text[lang] ?? text.fr ?? text.en ?? '';
}

/** 83.456 → "1:23.45" ; 9.1 → "0:09.10". Negative/NaN → "0:00.00". */
export function formatTime(t) {
  if (!Number.isFinite(t) || t < 0) t = 0;
  const cs = Math.floor(t * 100 + 1e-6);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  return `${m}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

/** Spoon tier earned for a time (null if slower than bronze). */
export function spoonFor(time, tt) {
  if (!tt || !Number.isFinite(time)) return null;
  if (time <= tt.gold) return 'gold';
  if (time <= tt.silver) return 'silver';
  if (time <= tt.bronze) return 'bronze';
  return null;
}

/**
 * Virtual joystick maths. dx, dy = finger offset from the stick origin in px (screen: +y down).
 * Returns { x, y, mag } with y pointing UP (+1 = forward), radial dead zone and a soft response curve.
 */
export function stickVector(dx, dy, radius = 60, dead = 0.14) {
  const len = Math.hypot(dx, dy);
  if (!(radius > 0) || len < 1e-6) return { x: 0, y: 0, mag: 0 };
  const raw = Math.min(1, len / radius);
  if (raw <= dead) return { x: 0, y: 0, mag: 0 };
  const mag = Math.min(1, ((raw - dead) / (1 - dead)) ** 1.15);
  return { x: (dx / len) * mag, y: (-dy / len) * mag, mag };
}

/** Level names fallback (levels authored by other teams may not exist yet). */
export const LEVEL_NAMES = {
  '1-1': ['Plage du Débutant', 'Beginner Beach'], '1-2': ['Jungle Toupie', 'Spinning Jungle'],
  '1-3': ['La Lune qui Roule', 'The Rolling Moon'], '1-4': ['Escargot Turbo', 'Turbo Snail'],
  '1-5': ['Rivière des Nénuphars', 'Lily Pad River'], B1: ['Papa Crabe Royal', 'Royal Papa Crab'],
  '2-1': ['Les Dunes qui Chantent', 'The Singing Dunes'], '2-2': ['Médina Labyrinthe', 'Maze Medina'],
  '2-3': ['Escaliers de Sidi Bou Saïd', 'Sidi Bou Saïd Stairs'], '2-4': ['Le Tajine Fou', 'The Mad Tajine'],
  '2-5': ['Chameau Express', 'Camel Express'], B2: ['Le Djinn Mal Poli', 'The Rude Djinn'],
  '3-1': ['Glissade Frileuse', 'Chilly Slide'], '3-2': ['Grotte Cristal', 'Crystal Cave'],
  '3-3': ['Avalanche !', 'Avalanche!'], '3-4': ['Bobsleigh Pingouin', 'Penguin Bobsleigh'],
  '3-5': ['Aurores Suspendues', 'Hanging Auroras'], B3: ['Le Yéti Influenceur', 'The Influencer Yeti'],
  '4-1': ['Chaîne de Montage', 'Assembly Line'], '4-2': ['Labo Toxique', 'Toxic Lab'],
  '4-3': ['Roomba Géant', 'Giant Roomba'], '4-4': ['Fusée en Carton', 'Cardboard Rocket'],
  '4-5': ['La Tour du Stress', 'Tower of Stress'], B4: ['Docteur Néo Cortisol', 'Doctor Neo Cortisol'],
  'S-1': ['La Lune Dorée', 'The Golden Moon'], BS: ['Cortisol Doré', 'Golden Cortisol'],
};

export function levelName(id, levels, lang) {
  const d = levels?.[id];
  if (d?.name) return tr(d.name, lang);
  const n = LEVEL_NAMES[id];
  return n ? (lang === 'en' ? n[1] : n[0]) : id;
}

/** Mode of a level, guessed from its id when the data is missing. */
export function levelMode(id, levels) {
  const d = levels?.[id];
  if (d?.mode) return d.mode;
  if (/^B/.test(id)) return 'boss';
  return 'run';
}

/** Count of secret coloured socks authored in a level (entities of type pickup/sock). */
export function sockSlots(data) {
  if (!data?.entities) return [];
  return data.entities.filter((e) => e && e.type === 'pickup' && e.kind === 'sock').map((e) => e.color || 'red');
}

export const SOCK_COLORS = { red: '#ff6b6b', blue: '#6fa8ff', green: '#6fe08a', purple: '#c58cff', gold: '#ffd76a' };
export const SPOON_COLORS = { gold: '#ffd76a', silver: '#dfe7ef', bronze: '#d89566' };

/** Deterministic pseudo random (for procedural art that must not flicker). */
export function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
