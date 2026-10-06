// Persistent progress (localStorage, defensive). Shape is versioned; unknown/corrupt data → fresh save.
const KEY = 'lumen-bandicoot-save-v1';

export function defaultSave() {
  return {
    v: 1,
    lang: (typeof navigator !== 'undefined' && /^fr/i.test(navigator.language || '')) ? 'fr' : 'en',
    settings: { music: 0.7, sfx: 0.9, quality: 'auto', reduceMotion: false, touchLayout: 'default', showFps: false },
    lives: 5,
    lights: 0,
    levels: {},          // id → { done, crates:boolean (gold sock), socks:[colors], deaths, bestTime, spoon:'gold'|'silver'|'bronze'|null }
    powers: [],          // 'doubleJump' | 'tornado' | 'superSlam' | 'turbo'
    seenStories: [],
    scarf: null,         // unlocked scarf colour chosen
    unlockedScarves: [],
    totalDeaths: 0,
    lastLevel: '1-1',
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return defaultSave();
    const d = defaultSave();
    return { ...d, ...data, settings: { ...d.settings, ...(data.settings || {}) }, levels: data.levels || {} };
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try { localStorage.setItem(KEY, JSON.stringify(save)); return true; } catch { return false; }
}

export function resetSave() {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return defaultSave();
}
