// Lumen Bandicoot — UI navigation: one internal rAF loop reading input.pressed(...) (main.js already calls
// input.update() every frame — we never call it here) and a stack of screen handlers. Only the top handler
// receives navigation events; every handler gets tick(dt) for animations.

const DIRS = ['up', 'down', 'left', 'right'];
const REPEAT_DELAY = 0.38, REPEAT_RATE = 0.11;

export function createNav(input, { sfx } = {}) {
  const stack = [];
  const hold = { up: 0, down: 0, left: 0, right: 0 };
  let last = performance.now();
  let lastActivate = 0;
  let running = true;

  function loop(now) {
    if (!running) return;
    requestAnimationFrame(loop);
    let dt = (now - last) / 1000; last = now;
    if (!(dt > 0) || dt > 0.25) dt = 1 / 60;
    for (const h of [...stack]) { h.__age = (h.__age || 0) + dt; h.__frames = (h.__frames || 0) + 1; try { h.tick?.(dt, now / 1000); } catch (err) { console.error('[ui]', err); } }
    const top = stack[stack.length - 1];
    // grace period: the key that opened a screen must not also act inside it
    if (!top || top.blocked || top.__age < 0.12 || top.__frames < 3) { for (const d of DIRS) hold[d] = input.held(d) ? REPEAT_DELAY * 0.5 : 0; return; }
    for (const d of DIRS) {
      if (input.held(d)) {
        const before = hold[d];
        hold[d] += dt;
        const fire = input.pressed(d) || (before >= REPEAT_DELAY && Math.floor((hold[d] - REPEAT_DELAY) / REPEAT_RATE) > Math.floor((before - REPEAT_DELAY) / REPEAT_RATE));
        if (fire && top.onDir) top.onDir(d, before > 0);
      } else hold[d] = 0;
    }
    if (input.pressed('confirm') || input.pressed('jump')) { top.onConfirm?.(); }
    else if (input.pressed('back')) { top.onBack?.(); }
    else if (input.pressed('pause')) { (top.onPause || top.onBack)?.(); }
  }
  requestAnimationFrame(loop);

  return {
    push(handler) {
      handler.__age = 0; handler.__frames = 0;
      stack.push(handler);
      return () => { const i = stack.indexOf(handler); if (i >= 0) stack.splice(i, 1); };
    },
    get top() { return stack[stack.length - 1]; },
    markActivate() { lastActivate = performance.now(); },
    /** true if a pointer click arrives right after a keyboard/pad activation (browser-synthesized duplicate). */
    isDuplicateClick() { return performance.now() - lastActivate < 350; },
    sfx: sfx || (() => {}),
    dispose() { running = false; },
  };
}

/**
 * Focus group over a list of activatable elements.
 * items: [{ el, activate(), adjust?(dir) , disabled? }]; layout: 'vertical' | 'horizontal' | 'grid' (cols)
 */
export class FocusGroup {
  constructor(nav, items = [], { layout = 'vertical', cols = 1, index = 0, onFocus } = {}) {
    this.nav = nav; this.layout = layout; this.cols = cols; this.onFocus = onFocus;
    this.items = [];
    this.index = -1;
    this.setItems(items, index);
  }

  setItems(items, index = 0) {
    for (const it of this.items) it.el.classList.remove('is-focus');
    this.items = items;
    for (const [i, it] of items.entries()) {
      if (it._wired) continue;
      it._wired = true;
      // hover focuses only when the mouse really moves (a panel opening under a resting cursor must not steal focus)
      it.el.addEventListener('pointermove', (e) => {
        if (e.pointerType !== 'mouse' || it.disabled || (!e.movementX && !e.movementY)) return;
        const i2 = this.items.indexOf(it);
        if (i2 !== this.index) this.focus(i2, false);
      });
      it.el.addEventListener('click', (e) => {
        e.preventDefault();
        if (it.disabled || this.nav.isDuplicateClick()) return;
        this.focus(this.items.indexOf(it), false);
        it.activate?.(e);
      });
      void i;
    }
    this.index = -1;
    this.focus(Math.max(0, Math.min(items.length - 1, index)), false, true);
  }

  focus(i, sound = true, silent = false) {
    if (i < 0 || i >= this.items.length) return;
    if (this.items[i].disabled) return;
    const prev = this.items[this.index];
    if (prev) prev.el.classList.remove('is-focus');
    const changed = i !== this.index;
    this.index = i;
    const it = this.items[i];
    it.el.classList.add('is-focus');
    try { it.el.focus({ preventScroll: true }); } catch { /* ignore */ }
    if (!silent) { try { it.el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch { /* ignore */ } }
    if (changed && sound && !silent) this.nav.sfx('menu_move');
    if (changed) this.onFocus?.(it, i);
  }

  get current() { return this.items[this.index]; }

  move(step) {
    const n = this.items.length;
    if (!n) return;
    let i = this.index;
    for (let k = 0; k < n; k++) {
      i = (i + step + n) % n;
      if (!this.items[i].disabled) { this.focus(i); return; }
    }
  }

  onDir(d) {
    const it = this.current;
    if (it?.adjust && (d === 'left' || d === 'right')) { it.adjust(d === 'left' ? -1 : 1); return true; }
    if (this.layout === 'vertical') { if (d === 'up') this.move(-1); else if (d === 'down') this.move(1); else return false; }
    else if (this.layout === 'horizontal') { if (d === 'left') this.move(-1); else if (d === 'right') this.move(1); else return false; }
    else {
      const step = d === 'left' ? -1 : d === 'right' ? 1 : d === 'up' ? -this.cols : this.cols;
      const ni = this.index + step;
      if (ni >= 0 && ni < this.items.length) this.focus(ni); else return false;
    }
    return true;
  }

  confirm() {
    const it = this.current;
    if (!it || it.disabled) return;
    this.nav.markActivate();
    it.el.classList.remove('is-press'); void it.el.offsetWidth; it.el.classList.add('is-press');
    it.activate?.();
  }
}
