// Unified input: keyboard + gamepad + virtual (touch) state.
// input.move = {x, y} in [-1,1] (x: right, y: forward/up). Buttons: jump, spin, slide, pause, confirm, back.
const KEYMAP = {
  ArrowLeft: 'left', KeyA: 'left', KeyQ: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ArrowUp: 'up', KeyW: 'up', KeyZ: 'up',
  ArrowDown: 'down', KeyS: 'down',
  Space: 'jump',
  KeyJ: 'spin', KeyX: 'spin', ShiftLeft: 'spin', ShiftRight: 'spin',
  KeyK: 'slide', KeyC: 'slide', ControlLeft: 'slide', ControlRight: 'slide',
  Escape: 'pause', KeyP: 'pause',
  Enter: 'confirm', NumpadEnter: 'confirm',
  Backspace: 'back',
};
const BUTTONS = ['jump', 'spin', 'slide', 'pause', 'confirm', 'back', 'left', 'right', 'up', 'down'];

class Input {
  constructor() {
    this.keys = new Set();
    this.virtual = { x: 0, y: 0, jump: false, spin: false, slide: false, pause: false };
    this.move = { x: 0, y: 0 };
    this.down = {};
    this.prev = {};
    this.lastDevice = 'keyboard';
    this.enabled = true;
    for (const b of BUTTONS) { this.down[b] = false; this.prev[b] = false; }
    this._queued = new Set();
  }

  attach(target = window) {
    target.addEventListener('keydown', (e) => {
      const a = KEYMAP[e.code];
      if (!a) return;
      if (e.target && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      this.keys.add(a);
      this._queued.add(a); // guarantees a press is seen even if released within one frame
      this.lastDevice = 'keyboard';
      if (a !== 'back') e.preventDefault();
    });
    target.addEventListener('keyup', (e) => {
      const a = KEYMAP[e.code];
      if (a) this.keys.delete(a);
    });
    target.addEventListener('blur', () => this.keys.clear());
  }

  setVirtual(state) {
    Object.assign(this.virtual, state);
    if (state.jump || state.spin || state.slide || state.pause) this.lastDevice = 'touch';
    for (const b of ['jump', 'spin', 'slide', 'pause']) if (state[b]) this._queued.add(b);
  }

  update() {
    for (const b of BUTTONS) this.prev[b] = this.down[b];
    const k = this.keys;
    let x = (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0);
    let y = (k.has('up') ? 1 : 0) - (k.has('down') ? 1 : 0);
    const now = {
      jump: k.has('jump'), spin: k.has('spin'), slide: k.has('slide'), pause: k.has('pause'),
      confirm: k.has('confirm'), back: k.has('back'),
      left: k.has('left'), right: k.has('right'), up: k.has('up'), down: k.has('down'),
    };
    // gamepad
    const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
    for (const p of pads) {
      if (!p || !p.connected) continue;
      const ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      const dz = 0.22;
      const bx = (p.buttons[15]?.pressed ? 1 : 0) - (p.buttons[14]?.pressed ? 1 : 0);
      const by = (p.buttons[12]?.pressed ? 1 : 0) - (p.buttons[13]?.pressed ? 1 : 0);
      if (Math.abs(ax) > dz || Math.abs(ay) > dz || bx || by) this.lastDevice = 'gamepad';
      if (Math.abs(ax) > dz) x = ax;
      if (Math.abs(ay) > dz) y = -ay;
      if (bx) x = bx;
      if (by) y = by;
      const b = (i) => !!p.buttons[i]?.pressed;
      if (b(0)) { now.jump = true; now.confirm = true; this.lastDevice = 'gamepad'; }
      if (b(2) || b(3)) now.spin = true;
      if (b(1) || b(7) || b(6)) now.slide = true;
      if (b(1)) now.back = true;
      if (b(9)) now.pause = true;
      now.left ||= x < -0.5; now.right ||= x > 0.5; now.up ||= y > 0.5; now.down ||= y < -0.5;
    }
    // touch
    const v = this.virtual;
    if (Math.abs(v.x) > 0.05 || Math.abs(v.y) > 0.05) { x = v.x; y = v.y; }
    now.jump ||= !!v.jump; now.spin ||= !!v.spin; now.slide ||= !!v.slide; now.pause ||= !!v.pause;
    for (const q of this._queued) now[q] = true;
    this._queued.clear();

    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    this.move.x = this.enabled ? x : 0;
    this.move.y = this.enabled ? y : 0;
    for (const b of BUTTONS) this.down[b] = now[b];
  }

  held(b) { return this.enabled && !!this.down[b]; }
  pressed(b) { return this.enabled && !!this.down[b] && !this.prev[b]; }
  released(b) { return !this.down[b] && !!this.prev[b]; }
}

export const input = new Input();
