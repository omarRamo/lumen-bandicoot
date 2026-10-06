// Lumen Bandicoot — UI entry point (contract: docs/CONTRACTS.md « API UI »).
// DOM + CSS overlay, canvas 2D illustrations. Owns: title, cinematics, world map + options, HUD, pause, results,
// game over, power tutorial, loading, touch controls, rotate-your-phone hint.
import './ui.css';
import { createNav } from './nav.js';
import { h, esc } from './dom.js';
import { createHUD } from './hud.js';
import { createTouch } from './touch.js';
import { playStory } from './story.js';
import { mapScreen } from './map.js';
import { titleScreen, pauseScreen, resultsScreen, gameOverScreen, powerScreen, createLoading } from './screens.js';
import { STR } from './i18n.js';
import { tr } from './util.js';

function injectFonts() {
  if (typeof document === 'undefined' || document.getElementById('lb-fonts')) return;
  const pre = document.createElement('link');
  pre.rel = 'preconnect'; pre.href = 'https://fonts.gstatic.com'; pre.crossOrigin = '';
  const l = document.createElement('link');
  l.id = 'lb-fonts'; l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Lilita+One&display=swap';
  document.head.append(pre, l);
}

export function createUI({ root, bus, input, save, worlds, levels, order, isUnlocked, goldSockCount, audio, isTouch, onSettingsChange, game }) {
  injectFonts();
  const el = h('div', 'lb-ui', root);
  if (isTouch) el.classList.add('lb-is-touch');

  const env = {
    root: el, bus, input, save, worlds, levels, order, isTouch: !!isTouch, game, audio,
    isUnlocked: isUnlocked || (() => true),
    goldSockCount: goldSockCount || (() => 0),
    onSettingsChange: () => { try { onSettingsChange?.(); } catch (err) { console.error(err); } },
    sfx: (name, opts) => bus.emit('sfx', { name, ...(opts || {}) }),
  };
  const nav = createNav(input, { sfx: (n) => env.sfx(n) });
  env.nav = nav;

  const hud = createHUD(env);
  const touch = createTouch(env);
  const loading = createLoading(env);
  env.toast = (text, kind) => hud.toast(text, kind);
  nav.push({ tick: (dt) => hud.tick(dt) }); // base layer: HUD timers always tick

  // rotate-your-phone hint (touch devices in portrait)
  const rot = h('div', 'lb-rotate', el);
  rot.setAttribute('role', 'alert');
  const renderRot = () => {
    const L = save.lang || 'fr';
    rot.innerHTML = `<div class="lb-rotate-phone" aria-hidden="true"><span></span></div><p class="lb-rotate-t">${esc(tr(STR.rotate, L))}</p><p class="lb-rotate-s">${esc(tr(STR.rotateSub, L))}</p><button type="button" class="lb-btn lb-btn-ghost">${esc(tr(STR.rotateAnyway, L))}</button>`;
    rot.querySelector('button').addEventListener('click', () => el.classList.add('lb-rotate-ok'));
  };
  renderRot();

  env.applyLocalSettings = () => {
    el.classList.toggle('lb-reduce', !!save.settings?.reduceMotion);
    try { document.documentElement.lang = save.lang || 'fr'; } catch { /* ignore */ }
  };
  env.refreshLang = () => { env.applyLocalSettings(); touch.relabel(); renderRot(); env.relabelMap?.(); };
  env.applyLocalSettings();

  let busy = Promise.resolve();
  // serialise full-screen screens (main.js awaits them in sequence anyway; this guards debug re-entry)
  const run = (fn) => { const p = busy.then(fn, fn); busy = p.catch(() => {}); return p; };

  return {
    title: () => run(() => titleScreen(env)),
    story: (id) => run(() => playStory(env, id)),
    map: (opts = {}) => run(() => mapScreen(env, opts)),
    hud: {
      show: (levelData) => hud.show(levelData),
      hide: () => hud.hide(),
    },
    pause: async () => {
      touch.reset();
      el.classList.add('lb-paused');
      try { return await pauseScreen(env, hud.info); } finally { el.classList.remove('lb-paused'); }
    },
    results: (stats, extra = {}) => run(() => resultsScreen(env, stats, extra)),
    gameOver: () => run(() => gameOverScreen(env)),
    powerUnlocked: (power) => run(() => powerScreen(env, power)),
    loading: (show, text) => loading(show, text),
    touch: { setVisible: (v) => touch.setVisible(v) },
  };
}
