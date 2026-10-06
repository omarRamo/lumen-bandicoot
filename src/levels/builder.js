// Level authoring DSL. A cursor walks along the level's forward axis (default: -Z, into the screen;
// `dir: 'x'` for 2.5D side levels walking +X). All helpers take RELATIVE coordinates:
//   lat  = sideways offset from the cursor (+ = right of the player when facing forward; for dir 'x': + = away from camera)
//   up   = height above the cursor's floor height
//   fwd  = distance along the forward axis measured from the ANCHOR = start of the last segment laid by
//          floor()/step()/gap()/stones()/goal() (or the cursor after at()/move()). So `.floor(14).crate('basic', 0, 6)`
//          puts the crate 6 m into that 14 m floor, and `.gap(6).block(0, 0, 3, 2, 0.5, 2)` floats a block mid-gap.
// Helpers return `this` so calls chain. `build()` returns the plain data object of docs/CONTRACTS.md.
//
//   const b = level({ id: '1-1', world: 1, index: 1, name: {fr, en}, theme: 'beach', mode: 'run' });
//   b.floor(12).crate('basic', 0, 6).lights(5, 0, 2).gap(3).floor(10, { kind: 'wood' }).checkpoint(0, 4) … .goal();
//   export default b.build();

export class LevelBuilder {
  constructor(meta) {
    this.meta = { mode: 'run', music: meta.theme, ...meta };
    this.dir = meta.dir || 'z';
    this.platforms = [];
    this.entities = [];
    this.zones = [];
    this.decor = [];
    this.lat = 0;          // cursor lateral position
    this.y = 0;            // cursor floor height
    this.f = 0;            // cursor forward distance (end of what has been laid)
    this.a = 0;            // anchor: start of the last segment (entity offsets are relative to it)
    this.width = meta.width ?? 4;
    this.kind = meta.ground ?? 'ground';
    this.thick = meta.thick ?? 4;
    this._n = 0;
    this.spawnAt = null;
    this.goalAt = null;
  }

  // ---- coordinate mapping (lat, y, fwd) → world [x, y, z]
  W(lat, y, fwd) {
    return this.dir === 'x' ? [fwd, y, -lat] : [lat, y, -fwd];
  }

  /** Axis-aligned box from relative ranges (lat0..lat1, y0..y1, f0..f1). */
  rawBox(lat0, lat1, y0, y1, f0, f1, opts = {}) {
    const a = this.W(lat0, y0, f0), b = this.W(lat1, y1, f1);
    this.platforms.push({
      min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
      kind: opts.kind ?? this.kind,
      ...(opts.slippery ? { slippery: true } : {}),
      ...(opts.conveyor ? { conveyor: this.dir === 'x' ? [opts.conveyor, 0] : [0, -opts.conveyor] } : {}),
      ...(opts.damage ? { damage: opts.damage } : {}),
      ...(opts.oneWay ? { oneWay: true } : {}),
    });
    return this;
  }

  // ---- cursor
  at(lat, y, f) { this.lat = lat; this.y = y; this.f = f; this.a = f; return this; }
  move(dLat = 0, dy = 0, dF = 0) { this.lat += dLat; this.y += dy; this.f += dF; this.a = this.f; return this; }
  up(dy) { this.y += dy; return this; }
  down(dy) { this.y -= dy; return this; }
  side(dLat) { this.lat += dLat; return this; }
  setWidth(w) { this.width = w; return this; }
  setKind(k) { this.kind = k; return this; }
  /** Spawn point relative to the cursor END (call it first, before laying floor, or with explicit offsets). */
  spawn(lat = 0, up = 0, fwd = 1) { this.spawnAt = this.W(this.lat + lat, this.y + up, this.f + fwd); return this; }

  /** Ground ahead of the cursor; advances the cursor by len. opts: w, kind, lat (offset), thick, slippery, conveyor (speed along forward), damage */
  floor(len, opts = {}) {
    const w = opts.w ?? this.width, lat = this.lat + (opts.lat ?? 0), th = opts.thick ?? this.thick;
    this.rawBox(lat - w / 2, lat + w / 2, this.y - th, this.y, this.f, this.f + len, opts);
    this.a = this.f;
    if (opts.advance !== false) this.f += len;
    return this;
  }
  /** Empty space (a pit). */
  gap(len) { this.a = this.f; this.f += len; return this; }
  /** Raised step: changes height then lays floor. */
  step(dy, len, opts = {}) { this.y += dy; return this.floor(len, opts); }
  /** A floating platform (does not move the cursor). pos relative to cursor. */
  block(lat, up, fwd, w, h, d, opts = {}) {
    const L = this.lat + lat, Y = this.y + up, F = this.a + fwd;
    return this.rawBox(L - w / 2, L + w / 2, Y - h, Y, F - d / 2, F + d / 2, opts);
  }
  /** Stepping stones: n blocks of size s separated by gap g, advancing the cursor. dy per stone optional. */
  stones(n, { size = 1.6, gap = 1.6, dy = 0, kind, zigzag = 0, h = 1 } = {}) {
    const start = this.f;
    for (let i = 0; i < n; i++) {
      this.y += i ? dy : 0;
      const L = zigzag ? (i % 2 ? zigzag : -zigzag) : 0;
      this.a = this.f;
      this.block(L, 0, gap + size / 2, size, h, size, { kind: kind ?? this.kind });
      this.f += gap + size;
    }
    this.f += gap;
    this.a = start;
    return this;
  }
  /** Side walls along the next len (decorative + keeps the player in). */
  /** Side walls over `len` starting at the anchor (call right after floor()). */
  walls(len, { h = 2, w = 0.6, kind = 'stone', spread } = {}) {
    const half = (spread ?? this.width) / 2;
    this.rawBox(this.lat - half - w, this.lat - half, this.y, this.y + h, this.a, this.a + len, { kind });
    this.rawBox(this.lat + half, this.lat + half + w, this.y, this.y + h, this.a, this.a + len, { kind });
    return this;
  }

  // ---- entities (relative to cursor floor)
  ent(type, kind, lat = 0, fwd = 0, up = 0, params = {}) {
    const [x, y, z] = this.W(this.lat + lat, this.y + up, this.a + fwd);
    this.entities.push({ type, kind, x, y, z, id: `${type[0]}${this._n++}`, ...params });
    return this;
  }
  crate(kind = 'basic', lat = 0, fwd = 0, up = 0, params = {}) { return this.ent('crate', kind, lat, fwd, up, params); }
  /** Vertical stack of crate kinds, bottom first. */
  stack(kinds, lat = 0, fwd = 0, up = 0) { kinds.forEach((k, i) => this.crate(k, lat, fwd, up + i)); return this; }
  /** Row of crates across (axis 'lat') or along (axis 'fwd'). */
  row(kind, n, lat = 0, fwd = 0, { axis = 'lat', spacing = 1, up = 0 } = {}) {
    const kinds = Array.isArray(kind) ? kind : null;
    const off = (n - 1) * spacing / 2;
    for (let i = 0; i < n; i++) {
      const k = kinds ? kinds[i % kinds.length] : kind;
      if (axis === 'lat') this.crate(k, lat - off + i * spacing, fwd, up);
      else this.crate(k, lat, fwd + i * spacing, up);
    }
    return this;
  }
  /** Pyramid of crates (base n). */
  pyramid(n, lat = 0, fwd = 0, kind = 'basic') {
    for (let lvl = 0; lvl < n; lvl++) for (let i = 0; i < n - lvl; i++) this.crate(Array.isArray(kind) ? kind[(i + lvl) % kind.length] : kind, lat - (n - lvl - 1) / 2 + i, fwd, lvl);
    return this;
  }
  /** Floating lights in a line (or an arc over a gap with `arc` height). */
  lights(n, lat = 0, fwd = 0, { spacing = 1, up = 0.8, arc = 0, axis = 'fwd' } = {}) {
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 0.5;
      const h = up + arc * 4 * t * (1 - t);
      if (axis === 'fwd') this.ent('pickup', 'light', lat, fwd + i * spacing, h);
      else this.ent('pickup', 'light', lat - (n - 1) * spacing / 2 + i * spacing, fwd, h);
    }
    return this;
  }
  enemy(kind, lat = 0, fwd = 0, params = {}) {
    const p = { ...params };
    if (p.patrol && this.dir === 'x' && p.patrol.axis) p.patrol = { ...p.patrol, axis: p.patrol.axis === 'x' ? 'z' : 'x' };
    return this.ent('enemy', kind, lat, fwd, params.up ?? 0, p);
  }
  hazard(kind, lat = 0, fwd = 0, params = {}) { return this.ent('hazard', kind, lat, fwd, params.up ?? 0, params); }
  /** Entity platform (moving/falling/sinking/bouncy/rotating/vanishing). `to` is relative {lat, up, fwd}. */
  platform(kind, lat = 0, fwd = 0, params = {}) {
    const p = { w: 2, h: 0.5, d: 2, ...params };
    if (p.to) {
      const t = p.to;
      const [dx, dy, dz] = this.dir === 'x' ? [t.fwd ?? 0, t.up ?? 0, -(t.lat ?? 0)] : [t.lat ?? 0, t.up ?? 0, -(t.fwd ?? 0)];
      p.to = { x: dx, y: dy, z: dz };
    }
    return this.ent('platform', kind, lat, fwd, p.up ?? 0, p);
  }
  checkpoint(lat = 0, fwd = 0, up = 0) { return this.crate('checkpoint', lat, fwd, up); }
  sign(text, lat = -1.8, fwd = 0) { return this.ent('pickup', 'sign', lat, fwd, 0, { text }); }
  sock(color, lat = 0, fwd = 0, up = 1) { return this.ent('pickup', 'sock', lat, fwd, up, { color }); }
  boss(kind, lat = 0, fwd = 0, params = {}) { return this.ent('boss', kind, lat, fwd, 0, params); }
  deco(kind, lat, fwd, up = 0, s = 1, r = 0) {
    const [x, y, z] = this.W(this.lat + lat, this.y + up, this.a + fwd);
    this.decor.push({ kind, x, y, z, s, r });
    return this;
  }

  /** Zone starting at the cursor END (where the next segment begins) covering `len` ahead (full height), with optional camera override / toast / lockZ / autoRun. */
  zone(len, opts = {}, { w = 40, lat = 0 } = {}) {
    const a = this.W(this.lat + lat - w / 2, this.y - 30, this.f), b = this.W(this.lat + lat + w / 2, this.y + 60, this.f + len);
    this.zones.push({
      min: [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])],
      max: [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])],
      ...opts,
    });
    return this;
  }

  /** Lays a final floor and puts the goal portal on it. */
  goal(len = 8, opts = {}) {
    this.floor(len, opts);
    this.goalAt = this.W(this.lat, this.y, this.f - len / 2);
    return this;
  }

  build() {
    const m = this.meta;
    if (!this.spawnAt) {
      // default spawn: just after the start on the first floor
      this.spawnAt = this.W(0, this.platforms[0] ? this.platforms[0].max[1] : 0, 1.5);
    }
    let minY = Infinity;
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const p of this.platforms) {
      minY = Math.min(minY, p.max[1]);
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], p.min[i]); hi[i] = Math.max(hi[i], p.max[i]); }
    }
    const data = {
      ...m,
      dir: this.dir,
      spawn: this.spawnAt,
      killY: m.killY ?? (Number.isFinite(minY) ? minY - 14 : -15),
      platforms: this.platforms,
      entities: this.entities,
      zones: this.zones,
      decor: this.decor,
      goal: this.goalAt,
      bounds: { min: lo, max: hi },
    };
    delete data.ground; delete data.thick; delete data.width;
    return data;
  }
}

export function level(meta) { return new LevelBuilder(meta); }

/** Little helper for bilingual strings. */
export const t = (fr, en) => ({ fr, en: en ?? fr });
