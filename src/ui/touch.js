// Lumen Bandicoot — touch controls: dynamic analog stick (left half), action buttons (right), pause button.
// Multi-touch via pointer events; feeds input.setVirtual({ x, y, jump, spin, slide, pause }) (y up = +1).
import { h } from './dom.js';
import { stickVector } from './util.js';
import { STR } from './i18n.js';
import { tr } from './util.js';

const ICONS = {
  jump: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M24 8 L38 26 H29 V40 H19 V26 H10 Z" fill="currentColor"/></svg>',
  spin: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 14 Q24 4 40 14 M12 22 Q24 15 36 22 M16 30 Q24 25 32 30 M20 38 Q24 35 28 38" stroke="currentColor" stroke-width="4.5" fill="none" stroke-linecap="round"/></svg>',
  slide: '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M8 34 H40 M14 26 L22 34 M30 12 L30 26 M23 20 L30 27 L37 20" stroke="currentColor" stroke-width="4.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  pause: '<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="13" y="11" width="8" height="26" rx="3" fill="currentColor"/><rect x="27" y="11" width="8" height="26" rx="3" fill="currentColor"/></svg>',
};

export function createTouch(env) {
  const { root, input, save } = env;
  const L = () => save.lang || 'fr';
  const el = h('div', 'lb-touch', root);
  el.hidden = true;
  el.innerHTML = `
    <div class="lb-stick-zone" aria-hidden="true"><div class="lb-stick-base"><div class="lb-stick-knob"></div></div></div>
    <div class="lb-touch-btns">
      <button type="button" class="lb-tbtn lb-tbtn-slide" data-act="slide">${ICONS.slide}<span></span></button>
      <button type="button" class="lb-tbtn lb-tbtn-spin" data-act="spin">${ICONS.spin}<span></span></button>
      <button type="button" class="lb-tbtn lb-tbtn-jump" data-act="jump">${ICONS.jump}<span></span></button>
    </div>
    <button type="button" class="lb-tbtn lb-tbtn-pause" data-act="pause">${ICONS.pause}</button>`;
  const zone = el.querySelector('.lb-stick-zone');
  const base = el.querySelector('.lb-stick-base');
  const knob = el.querySelector('.lb-stick-knob');
  const state = { x: 0, y: 0, jump: false, spin: false, slide: false, pause: false };
  const held = new Map(); // pointerId → action
  let stickId = null, ox = 0, oy = 0;
  const RADIUS = () => Math.max(44, Math.min(70, Math.min(window.innerWidth, window.innerHeight) * 0.14));

  // hybrid devices (touch laptop): fade the overlay out while the keyboard/pad is being used, back on first touch
  const setIdle = (v) => el.classList.toggle('is-idle', v);
  window.addEventListener('keydown', () => setIdle(true));
  el.addEventListener('pointerdown', () => setIdle(false), true);
  const haptic = (ms = 8) => { if (!save.settings?.reduceMotion) { try { navigator.vibrate?.(ms); } catch { /* ignore */ } } };
  const push = () => input.setVirtual({ ...state });

  function labels() {
    const lbl = { jump: STR.aJump, spin: STR.aSpin, slide: { fr: 'Glisse', en: 'Slide' } };
    for (const b of el.querySelectorAll('.lb-touch-btns .lb-tbtn')) {
      const a = b.dataset.act;
      b.querySelector('span').textContent = tr(lbl[a], L());
      b.setAttribute('aria-label', tr(lbl[a], L()));
    }
    el.querySelector('.lb-tbtn-pause').setAttribute('aria-label', tr(STR.pauseBtn, L()));
  }
  labels();

  function placeBase(x, y) {
    const r = zone.getBoundingClientRect();
    base.style.transform = `translate(${x - r.left}px, ${y - r.top}px)`;
  }
  function restBase() {
    base.classList.remove('is-active');
    base.style.transform = '';
    knob.style.transform = '';
  }

  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    e.preventDefault();
    stickId = e.pointerId;
    try { zone.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    ox = e.clientX; oy = e.clientY;
    base.classList.add('is-active');
    placeBase(ox, oy);
    knob.style.transform = 'translate(-50%, -50%)';
  });
  zone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== stickId) return;
    const R = RADIUS();
    let dx = e.clientX - ox, dy = e.clientY - oy;
    const len = Math.hypot(dx, dy);
    // drag the base along if the thumb wanders far (keeps the stick under the thumb)
    if (len > R * 1.35) { const k = (len - R * 1.35) / len; ox += dx * k; oy += dy * k; placeBase(ox, oy); dx = e.clientX - ox; dy = e.clientY - oy; }
    const v = stickVector(dx, dy, R);
    state.x = v.x; state.y = v.y;
    const kl = Math.min(R, Math.hypot(dx, dy));
    const ang = Math.atan2(dy, dx);
    knob.style.transform = `translate(calc(-50% + ${Math.cos(ang) * kl}px), calc(-50% + ${Math.sin(ang) * kl}px))`;
    push();
  });
  const endStick = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null; state.x = 0; state.y = 0; push(); restBase();
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);
  zone.addEventListener('lostpointercapture', endStick);

  for (const b of el.querySelectorAll('.lb-tbtn')) {
    const act = b.dataset.act;
    b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try { b.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      held.set(e.pointerId, act);
      state[act] = true; b.classList.add('is-held');
      haptic(act === 'jump' ? 10 : 7);
      push();
    });
    const up = (e) => {
      if (!held.has(e.pointerId)) return;
      held.delete(e.pointerId);
      if (![...held.values()].includes(act)) { state[act] = false; b.classList.remove('is-held'); push(); }
    };
    b.addEventListener('pointerup', up);
    b.addEventListener('pointercancel', up);
    b.addEventListener('lostpointercapture', up);
    b.addEventListener('contextmenu', (e) => e.preventDefault());
    b.addEventListener('click', (e) => e.preventDefault());
  }

  function reset() {
    held.clear(); stickId = null;
    for (const k of Object.keys(state)) state[k] = typeof state[k] === 'number' ? 0 : false;
    for (const b of el.querySelectorAll('.is-held')) b.classList.remove('is-held');
    restBase();
    input.setVirtual({ x: 0, y: 0, jump: false, spin: false, slide: false, pause: false });
  }

  return {
    el,
    setVisible(v) {
      const vis = !!v;
      if (el.hidden === !vis) return;
      el.hidden = !vis;
      env.root.classList.toggle('lb-touch-on', vis);
      reset();
    },
    relabel: labels,
    reset,
  };
}
