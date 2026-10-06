// Lumen Bandicoot — tiny event bus shared by every module (see docs/CONTRACTS.md for event names).
export class Emitter {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    let set = this.map.get(name);
    if (!set) { set = new Set(); this.map.set(name, set); }
    set.add(fn);
    return () => set.delete(fn);
  }
  once(name, fn) {
    const off = this.on(name, (p) => { off(); fn(p); });
    return off;
  }
  emit(name, payload) {
    const set = this.map.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try { fn(payload); } catch (err) { console.error(`[bus] ${name}`, err); }
    }
  }
}

export const bus = new Emitter();
