// Lumen Bandicoot — title, pause, results, game over, power unlock, options, controls, loading.
import { FocusGroup } from './nav.js';
import { h, esc, bigHTML, setBig, logoHTML, restartAnim } from './dom.js';
import { STR, POWERS, GAMEOVER_QUIPS, PAUSE_TIPS, deathsLine } from './i18n.js';
import { tr, formatTime, clamp, rand, PALETTE as P } from './util.js';
import { drawLumen, drawOku, drawZina, drawCrate, drawFirefly, iconURL, makeCanvas, ell, line, star4 } from './art.js';
import { sky, sea, stars, moon, palm, sparkles } from './scenery.js';
import { resetSave } from '../game/save.js';

const TAU = Math.PI * 2;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Generic modal screen with a FocusGroup; resolves with whatever `done(value)` is called with. */
function modal(env, cls, build, { layout = 'vertical', onBack, onPause, tick } = {}) {
  return new Promise((resolve) => {
    const el = h('div', `lb-screen lb-modal ${cls}`, env.root);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    let closed = false;
    const ctx = { el, group: null, close: null };
    const close = (value) => {
      if (closed) return; closed = true;
      pop();
      el.classList.add('lb-out');
      setTimeout(() => el.remove(), 220);
      resolve(value);
    };
    ctx.close = close;
    const items = build(ctx) || [];
    const title = el.querySelector('.lb-h2 .lb-big, .lb-confirm-q');
    if (title) el.setAttribute('aria-label', title.textContent);
    ctx.group = new FocusGroup(env.nav, items, { layout });
    const pop = env.nav.push({
      tick: (dt) => tick?.(dt, ctx),
      onDir: (d) => ctx.group.onDir(d),
      onConfirm: () => (ctx.onConfirm ? ctx.onConfirm() : ctx.group.confirm()),
      onBack: () => onBack?.(ctx),
      onPause: () => (onPause || onBack)?.(ctx),
    });
  });
}

function button(label, cls = '', icon = '') {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `lb-btn ${cls}`;
  b.innerHTML = `${icon ? `<img alt="" src="${icon}" />` : ''}<span>${esc(label)}</span>`;
  return b;
}

// =========================================================================================== TITLE
export function titleScreen(env) {
  const { root, save, nav } = env;
  const L = () => save.lang || 'fr';
  return new Promise((resolve) => {
    const el = h('div', 'lb-screen lb-title', root);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Lumen Bandicoot');
    const cv = makeCanvas('lb-title-canvas', 1.5);
    el.appendChild(cv.canvas);
    el.insertAdjacentHTML('beforeend', `
      <div class="lb-title-logo" aria-hidden="true">
        <div class="lb-logo lb-logo-1">${logoHTML('LUMEN', 3)}</div>
        <div class="lb-logo lb-logo-2">${logoHTML('BANDICOOT', 11)}</div>
        <div class="lb-sticker"><span>${esc(tr(STR.notCrash, L()))}</span></div>
        <div class="lb-ribbon">${esc(tr(STR.badCopy, L()))}</div>
      </div>
      <h1 class="lb-sr">Lumen Bandicoot</h1>
      <div class="lb-press"><span>${esc(tr(env.isTouch ? STR.tapAny : STR.pressAny, L()))}</span></div>
      <div class="lb-legal"><p>${esc(tr(STR.legal, L()))}</p><p class="lb-legal-2">${esc(tr(STR.legal2, L()))}</p></div>
      <button type="button" class="lb-btn lb-btn-ghost lb-lang" aria-label="Language">${L() === 'fr' ? 'FR · <s>EN</s>' : '<s>FR</s> · EN'}</button>`);
    let time = 0, done = false;
    const langBtn = el.querySelector('.lb-lang');
    langBtn.addEventListener('pointerdown', (e) => e.stopPropagation());
    langBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      save.lang = L() === 'fr' ? 'en' : 'fr';
      env.onSettingsChange?.();
      langBtn.innerHTML = save.lang === 'fr' ? 'FR · <s>EN</s>' : '<s>FR</s> · EN';
      el.querySelector('.lb-press span').textContent = tr(env.isTouch ? STR.tapAny : STR.pressAny, L());
      el.querySelector('.lb-legal p').textContent = tr(STR.legal, L());
      el.querySelector('.lb-legal-2').textContent = tr(STR.legal2, L());
      el.querySelector('.lb-sticker span').textContent = tr(STR.notCrash, L());
      el.querySelector('.lb-ribbon').textContent = tr(STR.badCopy, L());
    });
    const finish = () => {
      if (done || time < 0.35) return;
      done = true;
      env.sfx('menu_ok');
      window.removeEventListener('keydown', onKey, true);
      pop();
      el.classList.add('lb-out');
      setTimeout(() => { el.remove(); resolve(); }, 320);
    };
    const onKey = (e) => { if (e.repeat || e.key === 'Tab') return; finish(); };
    window.addEventListener('keydown', onKey, true);
    el.addEventListener('pointerdown', (e) => { if (e.button === 0 || e.pointerType !== 'mouse') finish(); });
    const pop = nav.push({
      tick(dt) { time += dt; drawTitle(cv, time); },
      onConfirm: finish, onBack: finish, onPause: finish,
      onDir: () => {},
    });
  });
}

function drawTitle(cv, t) {
  cv.resize();
  const { g, w, h: H } = cv;
  sky(g, w, H, ['#1c1640', '#4b3f86', '#c27aa8', '#ffc193']);
  stars(g, w, H * 0.6, t, 70, 9);
  const s = Math.min(w / 1280, H / 720) * 1.0;
  moon(g, w * 0.86, H * 0.18, 38 * s, '#fff1c8');
  sea(g, H * 0.7, w, H, t * 0.6, '#6a5aa8', '#2a2366');
  // island under Lumen
  g.fillStyle = '#2a2148'; g.beginPath(); g.ellipse(w * 0.76, H * 0.86, w * 0.26, H * 0.16, 0, Math.PI, TAU); g.fill();
  g.fillStyle = '#3b2d7a'; g.beginPath(); g.ellipse(w * 0.16, H * 0.74, w * 0.14, H * 0.05, 0, Math.PI, TAU); g.fill();
  palm(g, w * 0.92, H * 0.8, 1.2 * s, t, -0.2);
  palm(g, w * 0.1, H * 0.74, 0.7 * s, t, 0.25);
  // fireflies
  const R = rand(4);
  for (let i = 0; i < 14; i++) {
    const bx = R() * w, by = H * (0.2 + R() * 0.55), ph = R() * 6;
    g.save(); g.translate(bx + Math.sin(t * 0.7 + ph) * 30 * s, by + Math.cos(t + ph) * 20 * s); g.scale(0.22 * s, 0.22 * s); drawFirefly(g, 100, t + ph); g.restore();
  }
  // Lumen (big, waving) + Oku
  const ls = 2.9 * s * (w < 700 ? 0.8 : 1);
  g.save(); g.translate(w * 0.75, H * 0.86 - 4 * s); g.scale(ls, ls);
  const pose = (t % 6) < 2.2 ? 'wave' : 'stand';
  drawLumen(g, { t, pose, mood: pose === 'wave' ? 'happy' : 'normal', flip: true });
  g.restore();
  g.save(); g.translate(w * 0.63, H * 0.47 + Math.sin(t * 1.3) * 8 * s); g.scale(1.1 * s, 1.1 * s); drawOku(g, { t, mood: 'talk', look: -1 }); g.restore();
}

// =========================================================================================== OPTIONS
export function optionsScreen(env, { inGame = false } = {}) {
  const { save } = env;
  const L = () => save.lang || 'fr';
  const QUAL = ['auto', 'low', 'medium', 'high'];
  const QLBL = { auto: STR.qAuto, low: STR.qLow, medium: STR.qMedium, high: STR.qHigh };
  return modal(env, 'lb-options', (ctx) => {
    const panel = h('div', 'lb-panel lb-options-panel', ctx.el);
    panel.innerHTML = `<h2 class="lb-h2">${bigHTML(tr(STR.options, L()), 'lb-big-md')}</h2><div class="lb-opt-list"></div>`;
    const list = panel.querySelector('.lb-opt-list');
    const items = [];
    const apply = () => { env.onSettingsChange?.(); env.applyLocalSettings?.(); };

    const slider = (key, label) => {
      const row = h('div', 'lb-opt-row lb-opt-slider', list);
      row.tabIndex = 0;
      row.setAttribute('role', 'slider');
      row.setAttribute('aria-valuemin', '0'); row.setAttribute('aria-valuemax', '100');
      row.innerHTML = `<span class="lb-opt-lbl"></span><span class="lb-slider"><span class="lb-slider-fill"></span><span class="lb-slider-knob"></span></span><span class="lb-opt-val"></span>`;
      const set = (v, sound = true) => {
        v = clamp(Math.round(v * 10) / 10, 0, 1);
        save.settings[key] = v;
        row.querySelector('.lb-slider-fill').style.width = `${v * 100}%`;
        row.querySelector('.lb-slider-knob').style.left = `${v * 100}%`;
        row.querySelector('.lb-opt-val').textContent = `${Math.round(v * 100)}`;
        row.setAttribute('aria-valuenow', String(Math.round(v * 100)));
        if (sound) { apply(); env.sfx(key === 'sfx' ? 'light' : 'menu_move'); }
      };
      const lbl = () => { row.querySelector('.lb-opt-lbl').textContent = tr(label, L()); row.setAttribute('aria-label', tr(label, L())); };
      lbl(); set(save.settings[key] ?? 0.7, false);
      const track = row.querySelector('.lb-slider');
      let dragging = false;
      const fromX = (x) => { const r = track.getBoundingClientRect(); set((x - r.left) / r.width); };
      track.addEventListener('pointerdown', (e) => { dragging = true; track.setPointerCapture(e.pointerId); fromX(e.clientX); });
      track.addEventListener('pointermove', (e) => { if (dragging) fromX(e.clientX); });
      track.addEventListener('pointerup', () => { dragging = false; });
      track.addEventListener('pointercancel', () => { dragging = false; });
      items.push({ el: row, adjust: (d) => set((save.settings[key] ?? 0.7) + d * 0.1), activate: () => {}, relabel: lbl });
    };
    const cycler = (label, values, get, setv, fmt) => {
      const row = h('button', 'lb-opt-row lb-opt-cycle', list);
      row.type = 'button';
      row.innerHTML = `<span class="lb-opt-lbl"></span><span class="lb-cycle"><b class="lb-arr" aria-hidden="true">◀</b><span class="lb-opt-val"></span><b class="lb-arr" aria-hidden="true">▶</b></span>`;
      const render = () => { row.querySelector('.lb-opt-lbl').textContent = tr(label, L()); row.querySelector('.lb-opt-val').textContent = fmt(get()); };
      const step = (d) => { const i = values.indexOf(get()); setv(values[(i + d + values.length) % values.length]); apply(); env.sfx('menu_move'); renderAll(); };
      render();
      const [la, ra] = row.querySelectorAll('.lb-arr');
      la.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
      ra.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
      items.push({ el: row, adjust: step, activate: () => step(1), relabel: render });
    };
    const action = (label, fn, cls = '') => {
      const row = h('button', `lb-opt-row lb-opt-action ${cls}`, list);
      row.type = 'button';
      const render = () => { row.innerHTML = `<span class="lb-opt-lbl">${esc(tr(label, L()))}</span><b aria-hidden="true">›</b>`; };
      render();
      items.push({ el: row, activate: fn, relabel: render });
    };
    const renderAll = () => {
      panel.querySelector('.lb-h2').innerHTML = bigHTML(tr(STR.options, L()), 'lb-big-md');
      for (const it of items) it.relabel?.();
      closeBtn.querySelector('span').textContent = tr(STR.close, L());
    };

    slider('music', STR.music);
    slider('sfx', STR.sfx);
    cycler(STR.quality, QUAL, () => save.settings.quality || 'auto', (v) => { save.settings.quality = v; }, (v) => tr(QLBL[v], L()));
    cycler(STR.language, ['fr', 'en'], () => save.lang || 'fr', (v) => { save.lang = v; env.refreshLang?.(); }, (v) => (v === 'fr' ? 'Français' : 'English'));
    cycler(STR.reduceMotion, [false, true], () => !!save.settings.reduceMotion, (v) => { save.settings.reduceMotion = v; }, (v) => tr(v ? STR.on : STR.off, L()));
    action(STR.controls, async () => { ctx.group.nav.sfx('menu_ok'); await controlsScreen(env); });
    if (!inGame) {
      action(STR.resetSave, async () => {
        env.sfx('menu_ok');
        const yes = await confirmScreen(env, tr(STR.resetConfirm, L()), tr(STR.resetYes, L()), tr(STR.resetNo, L()));
        if (yes) {
          const lang = save.lang;
          const fresh = resetSave();
          for (const k of Object.keys(save)) delete save[k];
          Object.assign(save, fresh, { lang });
          if (env.game) { env.game.lives = save.lives; env.game.lights = save.lights; env.game.masks = 0; }
          apply();
          env.toast?.(tr(STR.resetDone, L()), 'warn');
          env.onReset?.();
          renderAll();
        }
      }, 'lb-opt-danger');
    }
    const closeBtn = button(tr(STR.close, L()), 'lb-btn-primary lb-opt-close');
    panel.appendChild(closeBtn);
    items.push({ el: closeBtn, activate: () => { env.sfx('menu_back'); ctx.close(); } });
    return items;
  }, { onBack: (ctx) => { env.sfx('menu_back'); ctx.close(); } });
}

export function confirmScreen(env, question, yes, no) {
  return modal(env, 'lb-confirm', (ctx) => {
    const panel = h('div', 'lb-panel lb-confirm-panel', ctx.el);
    const cv = makeCanvas('lb-confirm-oku');
    panel.appendChild(cv.canvas);
    ctx.cv = cv;
    h('p', 'lb-confirm-q', panel, esc(question));
    const row = h('div', 'lb-row', panel);
    const bNo = button(no, 'lb-btn-primary'); const bYes = button(yes, 'lb-btn-danger');
    row.append(bNo, bYes);
    return [
      { el: bNo, activate: () => { env.sfx('menu_back'); ctx.close(false); } },
      { el: bYes, activate: () => { env.sfx('menu_ok'); ctx.close(true); } },
    ];
  }, {
    layout: 'horizontal', onBack: (ctx) => ctx.close(false),
    tick: (dt, ctx) => { ctx.t = (ctx.t || 0) + dt; const c = ctx.cv.resize(); c.g.clearRect(0, 0, c.w, c.h); c.g.save(); c.g.translate(c.w / 2, c.h / 2 + 4); const k = c.h / 100; c.g.scale(k, k); drawOku(c.g, { t: ctx.t, mood: 'talk' }); c.g.restore(); },
  });
}

export function controlsScreen(env) {
  const L = () => env.save.lang || 'fr';
  const dev = env.input?.lastDevice || 'keyboard';
  return modal(env, 'lb-controls', (ctx) => {
    const panel = h('div', 'lb-panel lb-controls-panel', ctx.el);
    const rows = [['aMove', 'kMove', 'pMove', 'tMove'], ['aJump', 'kJump', 'pJump', 'tJump'], ['aSpin', 'kSpin', 'pSpin', 'tSpin'], ['aSlide', 'kSlide', 'pSlide', 'tSlide'], ['aPause', 'kPause', 'pPause', 'tPause']];
    const col = { keyboard: 1, gamepad: 2, touch: 3 }[env.isTouch ? 'touch' : dev] || 1;
    panel.innerHTML = `<h2 class="lb-h2">${bigHTML(tr(STR.ctlTitle, L()), 'lb-big-md')}</h2>
      <div class="lb-ctl-table" role="table">
        <div class="lb-ctl-row lb-ctl-head" role="row"><span></span>${[STR.ctlKeyboard, STR.ctlPad, STR.ctlTouch].map((s, i) => `<span role="columnheader" class="${i + 1 === col ? 'on' : ''}">${esc(tr(s, L()))}</span>`).join('')}</div>
        ${rows.map((r) => `<div class="lb-ctl-row" role="row">${r.map((k, i) => `<span role="cell" class="${i === 0 ? 'lb-ctl-act' : i === col ? 'on' : ''}">${i ? `<kbd>${esc(tr(STR[k], L()))}</kbd>` : esc(tr(STR[k], L()))}</span>`).join('')}</div>`).join('')}
      </div>`;
    const b = button(tr(STR.back, L()), 'lb-btn-primary');
    panel.appendChild(b);
    return [{ el: b, activate: () => { env.sfx('menu_back'); ctx.close(); } }];
  }, { onBack: (ctx) => { env.sfx('menu_back'); ctx.close(); } });
}

// =========================================================================================== PAUSE
export function pauseScreen(env, info) {
  const L = () => env.save.lang || 'fr';
  return modal(env, 'lb-pause', (ctx) => {
    const panel = h('div', 'lb-panel lb-pause-panel', ctx.el);
    const tip = pick(PAUSE_TIPS);
    panel.innerHTML = `
      <h2 class="lb-h2">${bigHTML(tr(STR.paused, L()), 'lb-big-lg')}</h2>
      <p class="lb-sub">${esc(info.name || '')}</p>
      <div class="lb-pause-stats">
        <span><img alt="" src="${iconURL('firefly', 96)}" /><b>${info.lights ?? 0}</b><small>${esc(tr(STR.lights, L()))}</small></span>
        <span><img alt="" src="${iconURL('crate', 96)}" /><b>${info.crates ?? 0}/${info.cratesTotal ?? 0}</b><small>${esc(tr(STR.crates, L()))}</small></span>
        <span><img alt="" src="${iconURL('lumen', 96)}" /><b>${info.lives ?? 0}</b><small>${esc(tr(STR.lives, L()))}</small></span>
      </div>
      <div class="lb-menu"></div>
      <p class="lb-tip"><img alt="" src="${iconURL('oku', 96)}" /><span>${esc(tr(tip, L()))}</span></p>`;
    const menu = panel.querySelector('.lb-menu');
    const mk = (label, cls, fn) => { const b = button(tr(label, L()), cls); menu.appendChild(b); return { el: b, activate: fn }; };
    return [
      mk(STR.resume, 'lb-btn-primary', () => { env.sfx('menu_ok'); ctx.close('resume'); }),
      mk(STR.restart, '', () => { env.sfx('menu_ok'); ctx.close('restart'); }),
      mk(STR.options, '', async () => { env.sfx('menu_ok'); await optionsScreen(env, { inGame: true }); }),
      mk(STR.toMap, '', () => { env.sfx('menu_back'); ctx.close('map'); }),
    ];
  }, {
    onBack: (ctx) => { env.sfx('menu_back'); ctx.close('resume'); },
    onPause: (ctx) => { env.sfx('menu_back'); ctx.close('resume'); },
  });
}

// =========================================================================================== RESULTS
export function resultsScreen(env, stats = {}, extra = {}) {
  const L = () => env.save.lang || 'fr';
  const name = tr(stats.name, L()) || stats.id || '';
  return modal(env, 'lb-results', (ctx) => {
    const panel = h('div', 'lb-panel lb-results-panel', ctx.el);
    const crTot = stats.cratesTotal ?? 0;
    const socks = stats.socks || [];
    panel.innerHTML = `
      ${extra.firstClear ? `<div class="lb-stamp">${esc(tr(STR.firstClear, L()))}</div>` : ''}
      <h2 class="lb-h2">${bigHTML(tr(STR.levelDone, L()), 'lb-big-lg')}</h2>
      <p class="lb-sub">${esc(stats.id ? `${stats.id} · ${name}` : name)}</p>
      <div class="lb-res-rows">
        <div class="lb-res-row lb-res-crates"><img alt="" src="${iconURL('crate', 96)}" /><span class="lb-res-lbl">${esc(tr(STR.crates, L()))}</span><span class="lb-res-val">${bigHTML(`0/${crTot}`, 'lb-big-sm')}</span></div>
        <div class="lb-res-row lb-res-lights"><img alt="" src="${iconURL('firefly', 96)}" /><span class="lb-res-lbl">${esc(tr(STR.lights, L()))}</span><span class="lb-res-val">${bigHTML('0', 'lb-big-sm')}</span></div>
        ${stats.timeTrial || stats.time != null ? `<div class="lb-res-row lb-res-time"><span class="lb-res-ico" aria-hidden="true">⏱</span><span class="lb-res-lbl">${esc(tr(STR.time, L()))}</span><span class="lb-res-val">${bigHTML(formatTime(stats.time || 0), 'lb-big-sm')}</span></div>` : ''}
        ${socks.length ? `<div class="lb-res-row lb-res-socks"><span class="lb-res-lbl">${esc(tr(STR.socksFound, L()))}</span><span class="lb-res-socklist">${socks.map((c) => `<img alt="${esc(c)}" src="${iconURL('sock:' + c, 96)}" />`).join('')}</span></div>` : ''}
        <p class="lb-res-deaths"><img alt="" src="${iconURL('oku', 96)}" />${esc(deathsLine(stats.deaths || 0, L()))}</p>
      </div>
      <div class="lb-res-rewards"></div>
      <div class="lb-menu lb-menu-row"></div>`;
    ctx.env = env;
    const menu = panel.querySelector('.lb-menu');
    const cont = button(tr(STR.continue, L()), 'lb-btn-primary');
    menu.appendChild(cont);
    ctx.anim = { t: 0, crates: 0, lights: 0, crTot, crGot: Math.min(stats.crates ?? 0, crTot || Infinity), lightsTot: stats.lights || 0, stage: 0, lastTick: -1, extra, panel, done: false };
    ctx.onConfirm = () => {
      if (!ctx.anim.done) { finishAnim(ctx); return; }
      ctx.group.confirm();
    };
    return [{ el: cont, activate: () => { if (!ctx.anim.done) { finishAnim(ctx); return; } env.sfx('menu_ok'); ctx.close(); } }];
  }, {
    onBack: (ctx) => { if (!ctx.anim.done) finishAnim(ctx); },
    tick: (dt, ctx) => tickResults(env, dt, ctx),
  });
}

function rewardsHTML(env, extra) {
  const L = env.save.lang || 'fr';
  let html = '';
  if (extra.goldSock) html += `<div class="lb-reward lb-reward-sock"><img alt="" src="${iconURL('sock:gold', 160)}" /><div><b>${bigHTML(tr(STR.goldSockGet, L), 'lb-big-sm lb-big-gold')}</b><small>${esc(tr(STR.goldSockSub, L))}</small></div></div>`;
  if (extra.newSpoon) html += `<div class="lb-reward lb-reward-spoon"><img alt="" src="${iconURL('spoon:' + extra.newSpoon, 160)}" /><div><b>${bigHTML(tr(STR.newSpoon, L), 'lb-big-sm')}</b><small>${esc(tr(STR['spoon_' + extra.newSpoon], L))} ${esc(tr(STR.spoonWhy, L))}</small></div></div>`;
  return html;
}

function finishAnim(ctx) {
  const a = ctx.anim;
  a.crates = a.crGot; a.lights = a.lightsTot; a.stage = 3; a.t = 99;
  renderResults(ctx);
  if (!a.rewardsShown) showRewards(ctx);
  a.done = true;
}
function showRewards(ctx) {
  const a = ctx.anim;
  a.rewardsShown = true;
  const box = a.panel.querySelector('.lb-res-rewards');
  box.innerHTML = rewardsHTML(ctx.env, a.extra);
  if (a.extra.goldSock) ctx.env.sfx('gold_sock');
  else if (a.extra.newSpoon) ctx.env.sfx('sock');
}
function renderResults(ctx) {
  const a = ctx.anim;
  setBig(a.panel.querySelector('.lb-res-crates .lb-big'), `${Math.floor(a.crates)}/${a.crTot}`);
  setBig(a.panel.querySelector('.lb-res-lights .lb-big'), String(Math.floor(a.lights)));
  a.panel.querySelector('.lb-res-crates').classList.toggle('is-full', a.crTot > 0 && Math.floor(a.crates) >= a.crTot);
}
function tickResults(env, dt, ctx) {
  const a = ctx.anim;
  if (!a || a.done) return;
  ctx.env = env;
  a.t += dt;
  if (a.t < 0.5) return;
  if (a.stage === 0) {
    const rate = Math.max(8, a.crGot / 1.6);
    a.crates = Math.min(a.crGot, a.crates + dt * rate);
    const n = Math.floor(a.crates);
    if (n !== a.lastTick) { a.lastTick = n; if (n > 0) env.sfx('crate_break', { vol: 0.35, pitch: 0.9 + (n / Math.max(1, a.crTot)) * 0.5 }); restartAnim(a.panel.querySelector('.lb-res-crates .lb-big'), 'lb-bump'); }
    if (a.crates >= a.crGot) { a.stage = 1; a.lastTick = -1; }
  } else if (a.stage === 1) {
    const rate = Math.max(20, a.lightsTot / 1.2);
    a.lights = Math.min(a.lightsTot, a.lights + dt * rate);
    const n = Math.floor(a.lights / 3);
    if (n !== a.lastTick) { a.lastTick = n; env.sfx('light', { vol: 0.3 }); }
    if (a.lights >= a.lightsTot) { a.stage = 2; a.t2 = a.t; }
  } else if (a.stage === 2 && a.t - a.t2 > 0.3) {
    showRewards(ctx); a.done = true;
  }
  renderResults(ctx);
}

// =========================================================================================== GAME OVER
export function gameOverScreen(env) {
  const L = () => env.save.lang || 'fr';
  const quip = pick(GAMEOVER_QUIPS);
  return modal(env, 'lb-gameover', (ctx) => {
    const cv = makeCanvas('lb-gameover-canvas', 1.5);
    ctx.el.appendChild(cv.canvas);
    ctx.cv = cv; ctx.t = 0;
    const panel = h('div', 'lb-gameover-panel', ctx.el);
    panel.innerHTML = `<h2 class="lb-h2">${bigHTML(tr(STR.gameOver, L()), 'lb-big-xl lb-big-sad')}</h2>
      <p class="lb-bubble"><b>Oku Oku</b>${esc(tr(quip, L()))}</p><div class="lb-menu lb-menu-row"></div>`;
    const menu = panel.querySelector('.lb-menu');
    const b1 = button(tr(STR.tryAgain, L()), 'lb-btn-primary'); const b2 = button(tr(STR.toMap, L()));
    menu.append(b1, b2);
    return [
      { el: b1, activate: () => { env.sfx('menu_ok'); ctx.close('continue'); } },
      { el: b2, activate: () => { env.sfx('menu_back'); ctx.close('map'); } },
    ];
  }, {
    layout: 'horizontal',
    onBack: (ctx) => ctx.close('map'),
    tick: (dt, ctx) => {
      ctx.t += dt;
      const c = ctx.cv.resize(); const { g, w, h: H } = c;
      const gr = g.createRadialGradient(w / 2, H * 0.4, 10, w / 2, H * 0.4, Math.max(w, H) * 0.7);
      gr.addColorStop(0, '#4b3f86'); gr.addColorStop(1, '#0f0b2a');
      g.fillStyle = gr; g.fillRect(0, 0, w, H);
      const s = Math.min(w, H) / 720;
      for (let i = 0; i < 16; i++) { const a = (i / 16) * TAU + ctx.t * 0.2; line(g, [[w / 2, H * 0.34], [w / 2 + Math.cos(a) * w, H * 0.34 + Math.sin(a) * w]], 'rgba(219,178,246,0.07)', 60 * s); }
      g.save(); g.translate(w / 2, H * 0.3 + Math.sin(ctx.t * 2) * 6); g.scale(2.6 * s, 2.6 * s); g.rotate(Math.sin(ctx.t * 7) * 0.08); drawOku(g, { t: ctx.t, mood: 'laugh' }); g.restore();
      for (let i = 0; i < 3; i++) {
        const k = (ctx.t * 0.7 + i / 3) % 1;
        g.globalAlpha = 1 - k; g.font = `${Math.round(26 * s + 8)}px "Lilita One", system-ui`; g.fillStyle = P.gold; g.textAlign = 'center';
        g.fillText('HA', w / 2 + (i - 1) * 150 * s + Math.sin(k * 6) * 10, H * 0.24 - k * 90 * s);
      }
      g.globalAlpha = 1;
    },
  });
}

// =========================================================================================== POWER UNLOCKED
export function powerScreen(env, power) {
  const L = () => env.save.lang || 'fr';
  const p = POWERS[power] || { name: { fr: power, en: power }, desc: { fr: '', en: '' }, keys: { kb: '', pad: '', touch: '' } };
  const dev = env.isTouch ? 'touch' : env.input?.lastDevice === 'gamepad' ? 'pad' : 'kb';
  env.sfx('power_unlock');
  return modal(env, 'lb-power', (ctx) => {
    const panel = h('div', 'lb-panel lb-power-panel', ctx.el);
    panel.innerHTML = `<div class="lb-power-art"></div><div class="lb-power-body">
      <p class="lb-kicker">${esc(tr(STR.newPower, L()))}</p>
      <h2 class="lb-h2">${bigHTML(tr(p.name, L()), 'lb-big-md')}</h2>
      <p class="lb-power-desc">${esc(tr(p.desc, L()))}</p>
      <div class="lb-power-keys">
        ${[['kb', STR.ctlKeyboard], ['pad', STR.ctlPad], ['touch', STR.ctlTouch]].map(([k, lbl]) => `<div class="${k === dev ? 'on' : ''}"><small>${esc(tr(lbl, L()))}</small><kbd>${esc(tr(p.keys[k], L()))}</kbd></div>`).join('')}
      </div><div class="lb-menu lb-menu-row"></div></div>`;
    const cv = makeCanvas('lb-power-canvas');
    panel.querySelector('.lb-power-art').appendChild(cv.canvas);
    ctx.cv = cv; ctx.t = 0; ctx.power = power;
    const b = button(tr(STR.gotIt, L()), 'lb-btn-primary');
    panel.querySelector('.lb-menu').appendChild(b);
    return [{ el: b, activate: () => { env.sfx('menu_ok'); ctx.close(); } }];
  }, {
    onBack: (ctx) => ctx.close(),
    tick: (dt, ctx) => { ctx.t += dt; drawPowerArt(ctx.cv, ctx.power, ctx.t); },
  });
}

function drawPowerArt(cv, power, t) {
  cv.resize();
  const { g, w, h: H } = cv;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#2a2366'); gr.addColorStop(1, '#4b3f86');
  g.fillStyle = gr; g.fillRect(0, 0, w, H);
  sparkles(g, w, H, t, 12, 5);
  const s = H / 230;
  const gy = H * 0.86;
  g.fillStyle = '#1c1640'; g.fillRect(0, gy, w, H - gy);
  const cx = w / 2;
  g.save(); g.translate(cx, gy); g.scale(s, s);
  if (power === 'doubleJump') {
    const k = (t % 1.6) / 1.6;
    const y = -Math.sin(k * Math.PI) * 90 - (k > 0.35 && k < 0.8 ? Math.sin((k - 0.35) / 0.45 * Math.PI) * 50 : 0);
    for (const [ry, a] of [[-20, 0.6], [-70, k > 0.35 ? 0.8 : 0.2]]) { g.globalAlpha = a; g.strokeStyle = P.aurora; g.lineWidth = 4; g.beginPath(); g.ellipse(0, ry, 34, 9, 0, 0, TAU); g.stroke(); }
    g.globalAlpha = 1;
    g.translate(0, y);
    if (k > 0.35 && k < 0.8) g.rotate((k - 0.35) / 0.45 * TAU);
    g.translate(0, 0);
    drawLumen(g, { t, pose: 'jump', noShadow: true });
  } else if (power === 'tornado') {
    g.translate(0, -60 + Math.sin(t * 2) * 8);
    for (let i = 0; i < 6; i++) { const a = t * 10 + i; g.strokeStyle = `rgba(181,243,208,${0.25 + (i % 3) * 0.15})`; g.lineWidth = 4; g.beginPath(); g.ellipse(0, -40 + i * 8, 40 - i * 3, 9, 0, a % TAU, a % TAU + 4); g.stroke(); }
    g.scale(Math.cos(t * 14) > 0 ? 1 : -1, 1);
    drawLumen(g, { t, pose: 'jump', noShadow: true });
  } else if (power === 'superSlam') {
    const k = (t % 1.4) / 1.4;
    g.save(); g.translate(60, -24); drawCrate(g, 44, 'basic'); g.fillStyle = 'rgba(160,170,190,0.85)'; g.fillRect(-22, -22, 44, 44); g.restore();
    if (k > 0.55) { const r = (k - 0.55) / 0.45; g.globalAlpha = 1 - r; g.strokeStyle = P.gold; g.lineWidth = 6; g.beginPath(); g.ellipse(0, 0, 40 + r * 120, 10 + r * 24, 0, 0, TAU); g.stroke(); g.globalAlpha = 1; for (let i = 0; i < 6; i++) line(g, [[0, 0], [Math.cos(i) * 60 * r, -Math.abs(Math.sin(i)) * 40 * r]], '#fff6c8', 3); }
    const y = k < 0.55 ? -110 + (k / 0.55) ** 2 * 110 : 0;
    g.translate(-10, y);
    drawLumen(g, { t, pose: k < 0.55 ? 'jump' : 'stand', mood: 'determined', noShadow: true });
  } else {
    for (let i = 0; i < 7; i++) { const x = -260 + ((t * 600 + i * 90) % 520); line(g, [[x, -20 - i * 12], [x + 60, -20 - i * 12]], 'rgba(255,193,147,0.6)', 4); }
    for (let i = 0; i < 4; i++) ell(g, -26 - i * 10, -6 + Math.sin(t * 30 + i) * 3, 8 - i, 5 - i * 0.8, i % 2 ? '#ffb347' : '#ff6b3d');
    drawLumen(g, { t: t * 1.8, pose: 'run', mood: 'happy' });
  }
  g.restore();
}

// =========================================================================================== LOADING
export function createLoading(env) {
  const el = h('div', 'lb-loading', env.root);
  el.setAttribute('role', 'status');
  el.innerHTML = '<span class="lb-loading-star" aria-hidden="true"></span><span class="lb-loading-txt"></span>';
  el.hidden = true;
  return (show, text) => {
    el.hidden = !show;
    el.querySelector('.lb-loading-txt').textContent = text || tr(STR.loading, env.save.lang || 'fr');
  };
}

export { drawZina, star4 };
