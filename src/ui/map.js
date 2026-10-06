// Lumen Bandicoot — world map: one island at a time, level nodes on a winding path, Lumen walking between them.
import { FocusGroup } from './nav.js';
import { h, esc, bigHTML } from './dom.js';
import { iconURL, makeCanvas, drawLumen, ell, star4 } from './art.js';
import { drawIsland, ISLAND_THEMES, sea, sparkles, cloud } from './scenery.js';
import { STR, MODE_LABEL } from './i18n.js';
import { tr, levelName, levelMode, sockSlots, formatTime, clamp } from './util.js';
import { optionsScreen } from './screens.js';

const LAYOUTS = {
  6: [[0.1, 0.64], [0.26, 0.34], [0.43, 0.62], [0.59, 0.3], [0.74, 0.6], [0.9, 0.34]],
  2: [[0.32, 0.58], [0.7, 0.4]],
};
function nodeLayout(n, world) {
  const base = LAYOUTS[n] || Array.from({ length: n }, (_, i) => [0.1 + (0.8 * i) / Math.max(1, n - 1), i % 2 ? 0.36 : 0.62]);
  return world % 2 === 0 ? base.map(([u, v]) => [u, 1 - v + 0.02]) : base;
}
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return [0, 1].map((k) => 0.5 * ((2 * p1[k]) + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3));
}

export function mapScreen(env, { save, game } = {}) {
  save = save || env.save;
  game = game || env.game;
  const { root, nav, worlds, levels, order, isUnlocked } = env;
  const L = () => save.lang || 'fr';
  const visibleWorlds = () => worlds.filter((w) => !w.secret || isUnlocked(w.levels[0]) || save.levels[w.levels[0]]?.done);
  const stagesOf = (w) => [...w.levels, w.boss].filter(Boolean);
  const worldOfId = (id) => worlds.find((w) => stagesOf(w).includes(id));

  return new Promise((resolve) => {
    const el = h('div', 'lb-screen lb-map', root);
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Map');
    const cv = makeCanvas('lb-map-canvas', 1.5);
    el.appendChild(cv.canvas);
    el.insertAdjacentHTML('beforeend', `
      <div class="lb-map-nodes"></div>
      <header class="lb-map-top">
        <div class="lb-map-pills">
          <span class="lb-pill" title=""><img alt="" src="${iconURL('lumen', 96)}" /><b class="lb-map-lives"></b></span>
          <span class="lb-pill"><img alt="" src="${iconURL('firefly', 96)}" /><b class="lb-map-lights"></b></span>
          <span class="lb-pill lb-pill-gold"><img alt="" src="${iconURL('sock:gold', 96)}" /><b class="lb-map-socks"></b></span>
        </div>
        <nav class="lb-map-tabs" aria-label="Islands"></nav>
        <button type="button" class="lb-btn lb-btn-icon lb-map-opt" aria-label="Options"><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M27.6 4l1.2 5.3a15.6 15.6 0 0 1 4.2 2.4l5.2-1.7 3.6 6.2-4 3.7a15.7 15.7 0 0 1 0 4.8l4 3.7-3.6 6.2-5.2-1.7a15.6 15.6 0 0 1-4.2 2.4L27.6 44h-7.2l-1.2-5.3a15.6 15.6 0 0 1-4.2-2.4l-5.2 1.7-3.6-6.2 4-3.7a15.7 15.7 0 0 1 0-4.8l-4-3.7 3.6-6.2 5.2 1.7a15.6 15.6 0 0 1 4.2-2.4L20.4 4zM24 17a7 7 0 1 0 0 14 7 7 0 0 0 0-14z"/></svg></button>
      </header>
      <div class="lb-map-title"></div>
      <section class="lb-map-card" aria-live="polite">
        <div class="lb-card-head"><span class="lb-card-code"></span><h2 class="lb-card-name"></h2><span class="lb-card-mode"></span></div>
        <div class="lb-card-badges"></div>
        <p class="lb-card-note"></p>
        <div class="lb-card-btns"></div>
      </section>`);
    const nodesEl = el.querySelector('.lb-map-nodes');
    const tabsEl = el.querySelector('.lb-map-tabs');
    const titleEl = el.querySelector('.lb-map-title');
    const card = el.querySelector('.lb-map-card');
    const optBtn = el.querySelector('.lb-map-opt');

    let world = null;          // current world object
    let nodes = [];            // [{ id, el, u, v, x, y, unlocked, done }]
    let sel = 0;               // selected node index in current world
    let walkS = 0;             // Lumen position along the path (node index, fractional)
    let time = 0, lastDt = 1 / 60, closing = false, mode = 'nodes', facing = 1, islandCache = null;
    let cardGroup = null;
    let rect = { x: 0, y: 0, w: 1, h: 1 };

    // --------------------------------------------------------------- data helpers
    const rec = (id) => save.levels[id] || {};
    const unlocked = (id) => !!isUnlocked(id) || !!rec(id).done;
    function defaultId() {
      const last = save.lastLevel;
      if (last && unlocked(last) && worldOfId(last) && visibleWorlds().includes(worldOfId(last))) {
        // after a clear, step onto the next stage
        const i = order.indexOf(last);
        if (rec(last).done && i >= 0 && order[i + 1] && unlocked(order[i + 1]) && !rec(order[i + 1]).done && visibleWorlds().includes(worldOfId(order[i + 1]))) return order[i + 1];
        return last;
      }
      const firstOpen = order.find((id) => unlocked(id) && !rec(id).done && visibleWorlds().includes(worldOfId(id)));
      return firstOpen || order[0];
    }

    // --------------------------------------------------------------- build
    function renderTop() {
      el.querySelector('.lb-map-lives').textContent = `×${Math.max(0, game?.lives ?? save.lives ?? 0)}`;
      el.querySelector('.lb-map-lights').textContent = String(game?.lights ?? save.lights ?? 0);
      el.querySelector('.lb-map-socks').textContent = String(env.goldSockCount());
      el.querySelector('.lb-pill-gold').title = tr(STR.goldSocks, L());
      el.querySelector('.lb-pill-gold').setAttribute('aria-label', `${tr(STR.goldSocks, L())}: ${env.goldSockCount()}`);
      tabsEl.innerHTML = '';
      for (const w of visibleWorlds()) {
        const open = stagesOf(w).some(unlocked);
        const allDone = stagesOf(w).every((id) => rec(id).done);
        const b = h('button', `lb-tab${w === world ? ' on' : ''}${open ? '' : ' locked'}${allDone ? ' done' : ''}`, tabsEl);
        b.type = 'button';
        b.style.setProperty('--wc', w.color);
        b.innerHTML = w.secret ? '★' : String(w.id);
        b.disabled = !open;
        b.setAttribute('aria-label', `${tr(w.secret ? STR.secretWorld : STR.island, L())} ${w.secret ? '' : w.id} — ${tr(w.name, L())}${open ? '' : ` (${tr(STR.locked, L())})`}`);
        b.addEventListener('click', () => {
          if (!open || w === world) return;
          env.sfx('menu_move');
          const ids = stagesOf(w);
          const target = ids.findIndex((id) => unlocked(id) && !rec(id).done);
          setWorld(w, target >= 0 ? target : Math.max(0, ids.filter(unlocked).length - 1), true);
        });
      }
    }

    function setWorld(w, index = 0, snap = true) {
      world = w;
      el.style.setProperty('--wc', w.color);
      el.dataset.world = String(w.id);
      islandCache = null;
      const ids = stagesOf(w);
      const lay = nodeLayout(ids.length, w.id);
      nodesEl.innerHTML = '';
      nodes = ids.map((id, i) => {
        const isBoss = id === w.boss;
        const r = rec(id);
        const n = { id, u: lay[i][0], v: lay[i][1], x: 0, y: 0, unlocked: unlocked(id), done: !!r.done, boss: isBoss, wip: !levels[id] };
        const b = h('button', `lb-node${isBoss ? ' boss' : ''}${n.unlocked ? '' : ' locked'}${n.done ? ' done' : ''}${n.wip ? ' wip' : ''}`, nodesEl);
        b.type = 'button';
        b.innerHTML = `<span class="lb-node-disc">${n.unlocked ? (isBoss ? '<i class="lb-node-crown" aria-hidden="true"></i>B' : esc(id.split('-')[1] || id)) : `<img alt="" src="${iconURL('lock', 64)}" />`}</span>
          <span class="lb-node-badges">${r.crates ? `<img alt="" src="${iconURL('sock:gold', 64)}" />` : ''}${r.spoon ? `<img alt="" src="${iconURL('spoon:' + r.spoon, 64)}" />` : ''}${(r.socks || []).map((c) => `<img alt="" src="${iconURL('sock:' + c, 64)}" />`).join('')}</span>`;
        b.setAttribute('aria-label', `${id} ${levelName(id, levels, L())}${n.done ? ` — ${tr(STR.done, L())}` : ''}${n.unlocked ? '' : ` — ${tr(STR.locked, L())}`}`);
        n.el = b;
        b.addEventListener('focus', () => { const i2 = nodes.indexOf(n); if (i2 !== sel && n.unlocked && !closing) selectNode(i2, false); });
        b.addEventListener('click', () => {
          if (nav.isDuplicateClick()) return;
          const i2 = nodes.indexOf(n);
          if (i2 === sel && mode === 'nodes') { confirmNode(); return; }
          if (!n.unlocked) { env.sfx('menu_back'); selectNode(i2, false); return; }
          selectNode(i2, true);
        });
        return n;
      });
      sel = clamp(index, 0, nodes.length - 1);
      if (!nodes[sel].unlocked) sel = Math.max(0, nodes.findIndex((n) => n.unlocked));
      if (snap) walkS = sel;
      titleEl.innerHTML = bigHTML(`${w.secret ? '★' : w.id} · ${tr(w.name, L())}`, 'lb-big-md lb-big-title');
      titleEl.classList.remove('lb-pop'); void titleEl.offsetWidth; titleEl.classList.add('lb-pop');
      renderTop();
      layoutNodes();
      renderCard();
    }

    function selectNode(i, sound = true) {
      if (i === sel) { renderCard(); return; }
      if (nodes[i].x < nodes[sel].x) facing = -1; else facing = 1;
      sel = i;
      if (sound) env.sfx('menu_move');
      setMode('nodes');
      renderCard();
    }

    function stepNode(dir) {
      // move along the ORDER, crossing islands; skip locked stages
      const ids = stagesOf(world);
      let i = sel + dir;
      if (i >= 0 && i < ids.length) {
        if (nodes[i].unlocked) selectNode(i);
        else env.sfx('menu_back');
        return;
      }
      const vw = visibleWorlds();
      const wi = vw.indexOf(world) + dir;
      if (wi < 0 || wi >= vw.length) return;
      const w2 = vw[wi];
      const ids2 = stagesOf(w2);
      const target = dir > 0 ? 0 : ids2.length - 1;
      if (!unlocked(ids2[target])) { env.sfx('menu_back'); return; }
      env.sfx('menu_move');
      setWorld(w2, target, true);
    }

    // --------------------------------------------------------------- card
    function renderCard() {
      const n = nodes[sel];
      if (!n) return;
      const id = n.id;
      const data = levels[id];
      const r = rec(id);
      const md = levelMode(id, levels);
      card.querySelector('.lb-card-code').textContent = n.boss ? 'BOSS' : id;
      card.querySelector('.lb-card-name').textContent = levelName(id, levels, L());
      const modeEl = card.querySelector('.lb-card-mode');
      modeEl.textContent = tr(MODE_LABEL[md] || MODE_LABEL.run, L());
      modeEl.dataset.mode = md;
      // badges
      const slots = sockSlots(data);
      const found = r.socks || [];
      const tt = data?.timeTrial;
      let badges = '';
      if (!n.boss) {
        badges += `<span class="lb-badge${r.crates ? ' on' : ''}" title="${esc(tr(STR.goldSocks, L()))}"><img alt="${esc(tr(STR.goldSocks, L()))}" src="${iconURL('sock:gold', 96)}" /></span>`;
        for (const c of slots) badges += `<span class="lb-badge${found.includes(c) ? ' on' : ''}"><img alt="${esc(c)}" src="${iconURL('sock:' + c, 96)}" /></span>`;
        if (tt) badges += `<span class="lb-badge lb-badge-spoon${r.spoon ? ' on' : ''}"><img alt="${esc(r.spoon ? tr(STR['spoon_' + r.spoon], L()) : '')}" src="${iconURL('spoon:' + (r.spoon || 'gold'), 96)}" />${r.bestTime ? `<small>${formatTime(r.bestTime)}</small>` : ''}</span>`;
      }
      if (r.deaths) badges += `<span class="lb-badge lb-badge-deaths on"><img alt="" src="${iconURL('oku', 96)}" /><small>${r.deaths} 💀</small></span>`;
      card.querySelector('.lb-card-badges').innerHTML = badges;
      let note = '';
      if (!n.unlocked) note = tr(STR.lockedHint, L());
      else if (n.wip) note = tr(STR.wip, L());
      else if (tt && r.done && !n.boss) note = `${tr(STR.target, L())} : 🥇 ${formatTime(tt.gold)} · 🥈 ${formatTime(tt.silver)} · 🥉 ${formatTime(tt.bronze)}`;
      card.querySelector('.lb-card-note').textContent = note;
      card.classList.toggle('is-locked', !n.unlocked);
      if (n.boss) el.dataset.boss = '1'; else delete el.dataset.boss;
      // buttons
      const btns = card.querySelector('.lb-card-btns');
      btns.innerHTML = '';
      const items = [];
      if (n.unlocked && !n.wip) {
        const bp = h('button', 'lb-btn lb-btn-primary', btns, `<span>${esc(tr(STR.play, L()))}</span>`);
        bp.type = 'button';
        items.push({ el: bp, activate: () => launch(false) });
        if (r.done && tt && !n.boss) {
          const bt = h('button', 'lb-btn lb-btn-tt', btns, `<span aria-hidden="true">⏱</span><span>${esc(tr(STR.timeTrial, L()))}</span>`);
          bt.type = 'button';
          items.push({ el: bt, activate: () => launch(true) });
        }
      }
      cardGroup = items.length ? new FocusGroup(nav, items, { layout: 'horizontal' }) : null;
      if (mode !== 'card') for (const it of items) it.el.classList.remove('is-focus');
      for (const [i, nn] of nodes.entries()) nn.el.classList.toggle('is-sel', i === sel);
      try { nodes[sel].el.focus({ preventScroll: true }); } catch { /* ignore */ }
    }

    function setMode(m) {
      mode = m;
      el.classList.toggle('is-card', m === 'card');
      if (m === 'nodes' && cardGroup) for (const it of cardGroup.items) it.el.classList.remove('is-focus');
      if (m === 'card' && cardGroup) cardGroup.focus(0, false, true);
    }

    function confirmNode() {
      const n = nodes[sel];
      if (!n.unlocked) { env.sfx('menu_back'); return; }
      if (n.wip) { env.sfx('menu_back'); card.classList.remove('lb-shake'); void card.offsetWidth; card.classList.add('lb-shake'); return; }
      if (cardGroup && cardGroup.items.length > 1) { env.sfx('menu_ok'); setMode('card'); return; }
      launch(false);
    }

    function launch(tt) {
      if (closing) return;
      const n = nodes[sel];
      if (!n?.unlocked || n.wip) return;
      closing = true;
      env.sfx('menu_ok');
      save.lastLevel = n.id;
      pop();
      el.classList.add('lb-out');
      setTimeout(() => { el.remove(); resolve({ levelId: n.id, timeTrial: !!tt }); }, 280);
    }

    async function openOptions() {
      if (closing) return;
      env.sfx('menu_ok');
      await optionsScreen(env, { inGame: false });
      // language / reset may have changed
      const keepId = nodes[sel]?.id;
      const w = visibleWorlds().includes(world) ? world : visibleWorlds()[0];
      const idx = stagesOf(w).indexOf(keepId);
      setWorld(w, idx >= 0 && unlocked(keepId) ? idx : stagesOf(w).findIndex(unlocked), true);
    }
    optBtn.addEventListener('click', () => { if (!nav.isDuplicateClick()) openOptions(); });

    // --------------------------------------------------------------- layout & drawing
    function layoutNodes() {
      cv.resize();
      const W = cv.w, H = cv.h;
      const top = el.querySelector('.lb-map-top').getBoundingClientRect().bottom;
      const titleB = titleEl.getBoundingClientRect().bottom;
      const cardTop = card.getBoundingClientRect().top;
      const y0 = Math.max(top, titleB) + 6, y1 = Math.max(y0 + 80, cardTop - 8);
      const side = Math.max(16, W * 0.04);
      rect = { x: side, y: y0, w: W - side * 2, h: y1 - y0 };
      for (const n of nodes) {
        n.x = rect.x + rect.w * (0.06 + n.u * 0.88);
        n.y = rect.y + rect.h * (0.1 + n.v * 0.8);
        n.el.style.transform = `translate(${n.x}px, ${n.y}px)`;
      }
      islandCache = null;
      void H;
    }

    function pathPoint(s) {
      const pts = nodes.map((n) => [n.x, n.y]);
      if (pts.length === 1) return pts[0];
      const i = clamp(Math.floor(s), 0, pts.length - 2);
      const t = clamp(s - i, 0, 1);
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      return catmull(p0, p1, p2, p3, t);
    }

    function buildIsland() {
      const c = document.createElement('canvas');
      c.width = cv.canvas.width; c.height = cv.canvas.height;
      const g = c.getContext('2d');
      g.setTransform(cv.dpr, 0, 0, cv.dpr, 0, 0);
      const pad = { x: rect.x - rect.w * 0.02, y: rect.y - rect.h * 0.06, w: rect.w * 1.04, h: rect.h * 1.12 };
      const avoid = nodes.map((n) => [n.x, n.y]);
      for (let k = 0; k <= nodes.length - 1; k += 0.2) avoid.push(pathPoint(k));
      drawIsland(g, world.id, pad, 0, { avoid });
      // path
      const pts = [];
      for (let s = 0; s <= nodes.length - 1 + 1e-6; s += 0.04) pts.push(pathPoint(s));
      g.lineCap = 'round'; g.lineJoin = 'round';
      g.strokeStyle = 'rgba(58,29,8,0.35)'; g.lineWidth = 16; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1] + 3) : g.moveTo(p[0], p[1] + 3))); g.stroke();
      g.strokeStyle = world.id === 4 ? '#c9c1e0' : world.id === 3 ? '#ffffff' : '#fff2c8'; g.lineWidth = 11; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); g.stroke();
      // dashes over unlocked part
      g.setLineDash([2, 14]); g.strokeStyle = world.color; g.lineWidth = 6;
      const lastOpen = nodes.reduce((m, n, i) => (n.unlocked ? i : m), 0);
      g.beginPath(); pts.forEach((p, i) => { if (i * 0.04 <= lastOpen) (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); }); g.stroke();
      g.setLineDash([]);
      islandCache = c;
    }

    function draw() {
      const resized = cv.resize();
      const { g, w: W, h: H } = resized;
      if (!islandCache || islandCache.width !== cv.canvas.width || islandCache.height !== cv.canvas.height) { layoutNodes(); buildIsland(); }
      const th = ISLAND_THEMES[world.id] || ISLAND_THEMES[1];
      sea(g, 0, W, H, time * 0.8, th.sea[0], th.sea[1]);
      if (world.id === 5) sparkles(g, W, H, time, 40, 13);
      cloud(g, ((time * 14) % (W + 300)) - 150, H * 0.2, Math.min(W, H) / 900, 'rgba(255,255,255,0.35)');
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.drawImage(islandCache, 0, 0); g.restore();
      // selection ring under the node
      const n = nodes[sel];
      if (n) {
        const pr = 1 + Math.sin(time * 5) * 0.08;
        g.strokeStyle = 'rgba(255,247,220,0.85)'; g.lineWidth = 4;
        g.beginPath(); g.ellipse(n.x, n.y + 16, 38 * pr, 13 * pr, 0, 0, Math.PI * 2); g.stroke();
      }
      // Lumen walking
      const target = sel;
      const diff = target - walkS;
      const walking = Math.abs(diff) > 0.01;
      if (walking) {
        const step = Math.sign(diff) * Math.min(Math.abs(diff), lastDt * 3.4);
        walkS += step;
        if (Math.abs(target - walkS) < 0.01) walkS = target;
        facing = diff > 0 ? 1 : -1;
      }
      const p = pathPoint(walkS);
      const s = clamp(Math.min(W, H) / 560, 0.78, 1.1);
      g.save(); g.translate(p[0] - (walking ? 0 : 42 * facing), p[1] + (walking ? -6 : 10)); g.scale(0.62 * s, 0.62 * s);
      drawLumen(g, { t: time, pose: walking ? 'run' : (time % 5 < 1.2 ? 'wave' : 'stand'), flip: facing < 0, scarf: save.scarf || undefined });
      g.restore();
      if (!walking && n && !n.unlocked) star4(g, n.x, n.y - 40, 6, '#fff');
      void ell;
    }

    // --------------------------------------------------------------- nav
    let drawnOnce = false;
    const handler = {
      tick(dt) { time += dt; lastDt = dt; if (!closing && (nav.top === handler || !drawnOnce)) { draw(); drawnOnce = true; } },
      onDir(d) {
        if (mode === 'card' && cardGroup) {
          if (d === 'left' || d === 'right') cardGroup.onDir(d);
          else if (d === 'up' || d === 'down') { setMode('nodes'); env.sfx('menu_back'); }
          return;
        }
        stepNode(d === 'left' || d === 'up' ? -1 : 1);
      },
      onConfirm() {
        if (mode === 'card' && cardGroup) { cardGroup.confirm(); return; }
        confirmNode();
      },
      onBack() { if (mode === 'card') { setMode('nodes'); env.sfx('menu_back'); } },
      onPause() { if (mode === 'card') { setMode('nodes'); env.sfx('menu_back'); } else openOptions(); },
    };
    const pop = nav.push(handler);
    const onResize = () => { islandCache = null; };
    window.addEventListener('resize', onResize);
    const origResolve = resolve;
    resolve = (v) => { window.removeEventListener('resize', onResize); origResolve(v); };

    env.relabelMap = () => { if (!closing) setWorld(world, sel, false); };
    // initial world
    const startId = defaultId();
    const w0 = worldOfId(startId) || visibleWorlds()[0];
    requestAnimationFrame(() => {}); // layout after insertion
    setWorld(w0, Math.max(0, stagesOf(w0).indexOf(startId)), true);
  });
}
