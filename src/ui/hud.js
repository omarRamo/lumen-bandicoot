// Lumen Bandicoot — in-level HUD, Crash style: counters pop in when they change then hide after a while.
import { h, esc, bigHTML, setBig, restartAnim } from './dom.js';
import { iconURL } from './art.js';
import { STR, SPEAKERS, POWERS } from './i18n.js';
import { tr, formatTime, clamp } from './util.js';

const SHOW_FOR = 3.2;
const TOAST_DUR = { info: 2.8, joke: 4.2, warn: 3.2, big: 2.8 };

export function createHUD(env) {
  const { root, bus, save } = env;
  const L = () => save.lang || 'fr';
  const el = h('div', 'lb-hud', root);
  el.hidden = true;
  el.innerHTML = `
    <div class="lb-hud-tl">
      <div class="lb-hud-grp lb-hud-lights" aria-label="lights"><img alt="" src="${iconURL('firefly', 128)}" />${bigHTML('0', 'lb-big-hud')}</div>
      <div class="lb-hud-grp lb-hud-crates"><img alt="" src="${iconURL('crate', 128)}" />${bigHTML('0/0', 'lb-big-hud lb-big-hud-sm')}</div>
      <div class="lb-hud-masks" aria-hidden="true"></div>
    </div>
    <div class="lb-hud-tr">
      <div class="lb-hud-grp lb-hud-lives">${bigHTML('5', 'lb-big-hud')}<img alt="" src="${iconURL('lumen', 128)}" /></div>
    </div>
    <div class="lb-hud-top">
      <div class="lb-hud-timer" hidden><span class="lb-hud-timer-ico" aria-hidden="true">⏱</span>${bigHTML('0:00.00', 'lb-big-hud lb-big-hud-sm lb-big-time')}<span class="lb-hud-frozen"></span></div>
      <div class="lb-hud-boss" hidden><span class="lb-hud-boss-name"></span><span class="lb-hud-boss-bar"><span class="lb-hud-boss-fill"></span><span class="lb-hud-boss-pips"></span></span></div>
    </div>
    <div class="lb-hud-center"></div>`;
  const topcol = h('div', 'lb-topcol', root);
  topcol.appendChild(el.querySelector('.lb-hud-top'));
  const bigLayer = h('div', 'lb-bigtoasts', topcol);
  const toastLayer = h('div', 'lb-toasts', topcol);
  toastLayer.setAttribute('aria-live', 'polite');
  const dialogLayer = h('div', 'lb-dialogs', root);
  dialogLayer.setAttribute('aria-live', 'polite');

  const q = (s) => el.querySelector(s) || topcol.querySelector(s);
  const hudTop = topcol.querySelector('.lb-hud-top');
  hudTop.hidden = true;
  const lightsG = q('.lb-hud-lights'), cratesG = q('.lb-hud-crates'), livesG = q('.lb-hud-lives');
  const lightsN = lightsG.querySelector('.lb-big'), cratesN = cratesG.querySelector('.lb-big'), livesN = livesG.querySelector('.lb-big');
  const masksEl = q('.lb-hud-masks');
  const timerEl = q('.lb-hud-timer'), timerN = timerEl.querySelector('.lb-big'), frozenEl = q('.lb-hud-frozen');
  const bossEl = q('.lb-hud-boss'), bossFill = q('.lb-hud-boss-fill'), bossName = q('.lb-hud-boss-name'), bossPips = q('.lb-hud-boss-pips');
  const center = q('.lb-hud-center');

  let active = false;
  const timers = { lights: 0, crates: 0, lives: 0 };
  const st = { lights: 0, lives: 0, masks: 0, crates: 0, cratesTotal: 0, timer: 0, frozen: false, timerDirty: false, levelName: '' };
  let toasts = [];
  let bigToasts = [];
  let dialogQueue = [], dialogCur = null;

  function showGroup(name, dur = SHOW_FOR) { timers[name] = dur; }
  function bump(n) { restartAnim(n, 'lb-bump'); }

  // ---------------------------------------------------------------- events
  bus.on('hud:lights', (p) => {
    const v = p?.value ?? 0;
    const gain = v > st.lights || (v < st.lights && st.lights > 90);
    st.lights = v; setBig(lightsN, String(v));
    if (active) { showGroup('lights'); if (gain) bump(lightsN); }
  });
  bus.on('hud:lives', (p) => {
    const v = p?.value ?? 0;
    const up = v > st.lives;
    st.lives = v; setBig(livesN, String(Math.max(0, v)));
    if (active) { showGroup('lives'); bump(livesN); if (up) restartAnim(livesG, 'lb-glow'); }
  });
  bus.on('hud:masks', (p) => {
    st.masks = clamp(p?.value ?? 0, 0, 3);
    renderMasks();
  });
  bus.on('hud:crates', (p) => {
    const b = p?.broken ?? 0, tot = p?.total ?? 0;
    const changed = b !== st.crates;
    st.crates = b; st.cratesTotal = tot;
    setBig(cratesN, `${b}/${tot}`);
    cratesG.classList.toggle('is-full', tot > 0 && b >= tot);
    if (active && changed && b > 0) { showGroup('crates'); bump(cratesN); }
  });
  bus.on('hud:boss', (p) => {
    if (!p) { bossEl.hidden = true; return; }
    bossEl.hidden = false;
    bossName.textContent = tr(p.name, L()) || 'BOSS';
    const k = p.maxHp > 0 ? clamp(p.hp / p.maxHp, 0, 1) : 0;
    bossFill.style.width = `${k * 100}%`;
    if (p.maxHp <= 12 && bossPips.childElementCount !== p.maxHp) bossPips.innerHTML = '<i></i>'.repeat(Math.max(0, p.maxHp - 1));
    if (bossEl.dataset.hp && +bossEl.dataset.hp > p.hp) restartAnim(bossEl, 'lb-shake');
    bossEl.dataset.hp = String(p.hp);
  });
  bus.on('hud:timer', (p) => {
    st.timer = p?.t ?? 0; st.frozen = !!p?.frozen; st.timerDirty = true;
    if (timerEl.hidden && active) timerEl.hidden = false;
  });
  bus.on('toast', (p) => { if (p) toast(p.text, p.kind || 'info', p.duration); });
  bus.on('dialog', (p) => { if (p) dialog(p.speaker, p.text); });
  bus.on('power:unlock', (p) => {
    if (!active || !p) return;
    const pw = POWERS[p.power];
    toast(`${tr(STR.newPower, L())} ${pw ? tr(pw.name, L()) : p.power}`, 'big');
  });
  bus.on('level:checkpoint', () => { if (active) bigWord(tr(STR.checkpoint, L()), 'lb-cp'); });
  bus.on('level:death', () => { if (active) { showGroup('lives', 4); restartAnim(livesG, 'lb-shake'); } });

  function renderMasks() {
    const n = st.masks;
    if (masksEl.childElementCount !== n) masksEl.innerHTML = Array.from({ length: n }, () => `<img alt="" src="${iconURL('oku', 96)}" />`).join('');
    masksEl.classList.toggle('is-gold', n >= 3);
  }

  function bigWord(text, cls = '') {
    const w = h('div', `lb-bigword ${cls}`, center, bigHTML(text, 'lb-big-xl'));
    setTimeout(() => w.remove(), 1500);
  }

  // ---------------------------------------------------------------- toasts
  function toast(text, kind = 'info', duration) {
    const str = tr(text, L());
    if (!str) return;
    if (kind === 'big') {
      const w = h('div', 'lb-toast-big', bigLayer, bigHTML(str, 'lb-big-toast'));
      bigToasts.push({ el: w, life: duration || TOAST_DUR.big });
      while (bigToasts.length > 2) bigToasts.shift().el.remove();
      return;
    }
    const t = h('div', `lb-toast lb-toast-${kind}`, toastLayer);
    t.innerHTML = kind === 'joke' ? `<span class="lb-toast-nail" aria-hidden="true"></span>${esc(str)}` : kind === 'warn' ? `<b aria-hidden="true">!</b>${esc(str)}` : esc(str);
    const item = { el: t, life: duration || TOAST_DUR[kind] || 3 };
    toasts.push(item);
    const max = window.innerHeight < 500 ? 2 : 3;
    while (toasts.length > max) { const o = toasts.shift(); o.el.remove(); }
  }

  // ---------------------------------------------------------------- dialog bubbles
  function dialog(speaker, text) {
    const str = tr(text, L());
    if (!str) return;
    dialogQueue.push({ speaker: speaker || 'oku', text: str });
    if (dialogQueue.length > 2) dialogQueue.shift();
    if (!dialogCur) nextDialog();
  }
  function nextDialog() {
    const d = dialogQueue.shift();
    if (!d) { dialogCur = null; return; }
    const icon = { oku: 'oku', cortisol: 'cortisol', zina: 'zina', lumen: 'lumen' }[d.speaker] || 'oku';
    const b = h('div', `lb-dialog lb-dialog-${d.speaker}`, dialogLayer);
    b.innerHTML = `<span class="lb-dialog-face"><img alt="" src="${iconURL(icon, 128)}" /></span><span class="lb-dialog-bubble"><b>${esc(tr(SPEAKERS[d.speaker] || d.speaker, L()))}</b><span>${esc(d.text)}</span></span>`;
    dialogCur = { el: b, life: clamp(2.2 + d.text.length * 0.045, 2.6, 6.5) };
  }

  // ---------------------------------------------------------------- per-frame (called by ui loop)
  function tick(dt) {
    for (const list of [toasts, bigToasts]) tickList(list, Math.min(dt, 0.1));
    tickRest(dt);
  }
  function tickList(list, dt) {
    for (let i = list.length - 1; i >= 0; i--) {
      const it = list[i];
      it.life -= dt;
      if (it.life < 0.3 && !it.out) { it.out = true; it.el.classList.add('lb-out'); }
      if (it.life <= 0) { it.el.remove(); list.splice(i, 1); }
    }
  }
  function tickRest(dt) {
    if (dialogCur) {
      dialogCur.life -= dt;
      if (dialogCur.life < 0.3 && !dialogCur.out) { dialogCur.out = true; dialogCur.el.classList.add('lb-out'); }
      if (dialogCur.life <= 0) { dialogCur.el.remove(); dialogCur = null; nextDialog(); }
    }
    if (!active) return;
    for (const k of Object.keys(timers)) {
      if (timers[k] > 0) timers[k] -= dt;
    }
    lightsG.classList.toggle('is-shown', timers.lights > 0);
    cratesG.classList.toggle('is-shown', timers.crates > 0 && st.cratesTotal > 0);
    livesG.classList.toggle('is-shown', timers.lives > 0);
    if (st.timerDirty) {
      st.timerDirty = false;
      setBig(timerN, formatTime(st.timer));
      timerEl.classList.toggle('is-frozen', st.frozen);
      frozenEl.textContent = st.frozen ? tr(STR.frozen, L()) : '';
    }
  }

  return {
    tick,
    toast,
    show(levelData) {
      active = true;
      el.hidden = false; hudTop.hidden = false;
      st.levelName = tr(levelData?.name, L());
      const tt = !!env.game?.timeTrial;
      timerEl.hidden = !tt;
      if (tt) { st.timer = 0; st.timerDirty = true; }
      bossEl.hidden = true; delete bossEl.dataset.hp; bossPips.innerHTML = '';
      if (env.game) {
        st.lives = env.game.lives; setBig(livesN, String(Math.max(0, st.lives)));
        st.lights = env.game.lights; setBig(lightsN, String(st.lights));
        st.masks = env.game.masks || 0; renderMasks();
      }
      timers.lights = timers.lives = SHOW_FOR + 0.8;
      timers.crates = 0;
      el.classList.toggle('is-boss', levelData?.mode === 'boss');
    },
    hide() {
      active = false;
      el.hidden = true; hudTop.hidden = true;
      for (const t of toasts) t.el.remove();
      toasts = [];
      for (const t of bigToasts) t.el.remove();
      bigToasts = [];
      dialogQueue = [];
      if (dialogCur) { dialogCur.el.remove(); dialogCur = null; }
      center.innerHTML = ''; bigLayer.innerHTML = '';
    },
    get info() {
      return { name: st.levelName, lights: st.lights, lives: st.lives, crates: st.crates, cratesTotal: st.cratesTotal };
    },
    get active() { return active; },
  };
}
