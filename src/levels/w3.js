// Île 3 — Glacier des Pingouins Grognons (Level design B).
// Also exports the small authoring helpers shared by w4.js and secret.js (TurtleBuilder: the builder + a heading,
// so a level can turn corners with camera zones; slopes; pits with light arcs; perched crates; switch groups…).
import { LevelBuilder, t } from './builder.js';

export { t };
const HALF_PI = Math.PI / 2;
const FLYERS = new Set(['bat', 'pigeon', 'drone']);
const r6 = (v) => Math.round(v * 1e6) / 1e6 || 0;

/**
 * LevelBuilder + heading. `turn('left'|'right')` pivots around the centre of the last laid pad; each straight leg
 * gets a camera zone with the right yaw (only if the level turned at least once). Extra helpers below.
 * Data stays 100% contract-compatible (plus `pathLength`, informative).
 */
export class TurtleBuilder extends LevelBuilder {
  constructor(meta) {
    super(meta);
    this.yaw = 0; this.ox = 0; this.oz = 0;
    this.walked = 0; this.noCount = 0;
    this.legZones = []; this.turned = false;
    this.legCam = meta.legCam || { mode: 'behind' };
    this.legFirst = 0;
  }
  get F() { return this.dir === 'x' ? [1, 0] : [-Math.sin(this.yaw), -Math.cos(this.yaw)]; }
  get R() { return this.dir === 'x' ? [0, -1] : [Math.cos(this.yaw), -Math.sin(this.yaw)]; }
  W(lat, y, fwd) {
    const [fx, fz] = this.F, [rx, rz] = this.R;
    return [r6(this.ox + rx * lat + fx * fwd), r6(y), r6(this.oz + rz * lat + fz * fwd)];
  }
  /** world axis ('x'|'z') of a relative axis ('x' = lateral, 'z' = forward) */
  axisOf(a) { const v = a === 'x' ? this.R : this.F; return Math.abs(v[0]) > 0.5 ? 'x' : 'z'; }

  rawBox(lat0, lat1, y0, y1, f0, f1, opts = {}) {
    const { conveyor, conveyorLat, ...rest } = opts;
    super.rawBox(lat0, lat1, y0, y1, f0, f1, rest);
    if (conveyor || conveyorLat) {
      const [fx, fz] = this.F, [rx, rz] = this.R, c = conveyor || 0, l = conveyorLat || 0;
      this.platforms[this.platforms.length - 1].conveyor = [r6(fx * c + rx * l), r6(fz * c + rz * l)];
    }
    return this;
  }
  floor(len, opts = {}) { if (opts.advance !== false && !this.noCount) this.walked += len; return super.floor(len, opts); }
  gap(len) { if (!this.noCount) this.walked += len; return super.gap(len); }
  stones(n, o = {}) { const f0 = this.f; super.stones(n, o); if (!this.noCount) this.walked += this.f - f0; return this; }

  /** Flyers (bat, pigeon, drone) stand on the floor below and hover `fly` metres above it: `up` is turned into `fly`. */
  enemy(kind, lat = 0, fwd = 0, params = {}) {
    const p = { ...params };
    let up = p.up ?? 0;
    if (FLYERS.has(kind) && p.up !== undefined && p.fly === undefined) { p.fly = p.up; up = 0; }
    delete p.up;
    if (p.patrol?.axis) p.patrol = { ...p.patrol, axis: this.axisOf(p.patrol.axis) };
    return this.ent('enemy', kind, lat, fwd, up, p);
  }
  /** hazards: `axis` relative ('x' = across the path), zones `w` (across) × `d` (along), wind `force:{lat,fwd}` */
  hazard(kind, lat = 0, fwd = 0, params = {}) {
    const p = { ...params };
    if (p.axis) p.axis = this.axisOf(p.axis);
    if (p.patrol?.axis) p.patrol = { ...p.patrol, axis: this.axisOf(p.patrol.axis) };
    if ((p.w !== undefined || p.d !== undefined) && this.axisOf('x') === 'z') { const w = p.w; p.w = p.d; p.d = w; }
    if (p.force && ('lat' in p.force || 'fwd' in p.force)) {
      const [fx, fz] = this.F, [rx, rz] = this.R, a = p.force.lat ?? 0, f = p.force.fwd ?? 0;
      p.force = { x: r6(rx * a + fx * f), z: r6(rz * a + fz * f) };
    }
    return this.ent('hazard', kind, lat, fwd, params.up ?? 0, p);
  }
  /** Entity platform. `up` = height of its BOTTOM (contract: def.y = bottom), so `up: -h` is flush with the floor. */
  platform(kind, lat = 0, fwd = 0, params = {}) {
    const p = { w: 2, h: 0.5, d: 2, ...params };
    p.up = r6(p.up ?? 0);
    if (p.to) {
      const [fx, fz] = this.F, [rx, rz] = this.R, tt = p.to;
      p.to = { x: r6(rx * (tt.lat ?? 0) + fx * (tt.fwd ?? 0)), y: tt.up ?? 0, z: r6(rz * (tt.lat ?? 0) + fz * (tt.fwd ?? 0)) };
    }
    if (this.axisOf('x') === 'z') { const w = p.w; p.w = p.d; p.d = w; }
    return this.ent('platform', kind, lat, fwd, p.up ?? 0, p);
  }

  /** Joke sign facing the camera: heading yaw (+π in chase levels, whose camera looks back). `r` overrides. */
  sign(text, lat = -1.8, fwd = 0, r) {
    const face = r ?? r6(this.yaw + (this.meta.mode === 'chase' ? Math.PI : 0));
    return this.ent('pickup', 'sign', lat, fwd, 0, { text, ...(face ? { r: face } : {}) });
  }

  // ---------------------------------------------------------------- helpers
  /** Zone around the spawn that (re)applies autoRun / lockZ (works around Level applying the mode before spawn()). */
  boot(opts) { this.zones.push({ min: [-60, -40, -60], max: [60, 60, 60], ...opts, _boot: true }); return this; }
  /** Staircase slope: n steps of dy/n over len (downhill = negative dy). opts.walls = wall height (track),
   *  opts.lightsLat = put a light on every step at that lateral offset. Use sy(fwd) to place things on a step. */
  slope(dy, len, n = Math.max(2, Math.round(len / 2)), opts = {}) {
    const { walls, lightsLat, wallKind, ...fo } = opts;
    const a0 = this.f, y0 = this.y, sl = len / n;
    for (let i = 0; i < n; i++) {
      this.step(dy / n, sl, fo);
      if (lightsLat !== undefined && i % 2 === 0) this.lights(1, lightsLat, sl / 2, { up: 0.9 });
    }
    this.a = a0;
    if (walls) { // one wall per side over the whole slope (a canyon that deepens), cheaper than one per step
      const half = (fo.w ?? this.width) / 2, lo = Math.min(y0 + dy / n, y0 + dy), hi = Math.max(y0 + dy / n, y0 + dy) + walls;
      this.rawBox(this.lat - half - 0.6, this.lat - half, lo, hi, a0, a0 + len, { kind: wallKind ?? 'ice' });
      this.rawBox(this.lat + half, this.lat + half + 0.6, lo, hi, a0, a0 + len, { kind: wallKind ?? 'ice' });
    }
    this._slope = { y0, dy, sl, n };
    return this;
  }
  /** `up` value (relative to the cursor) of the step at `fwd` of the last slope. */
  sy(fwd) {
    const s = this._slope, k = Math.min(s.n - 1, Math.max(0, Math.floor(fwd / s.sl)));
    return r6(s.y0 + s.dy * (k + 1) / s.n - this.y);
  }
  /** Flat track piece with side walls (ride levels). */
  track(len, opts = {}) {
    const { walls = 1.3, wallKind = 'ice', ...fo } = opts;
    this.floor(len, fo);
    if (walls) this.walls(len, { h: walls, kind: wallKind, spread: fo.w ?? this.width });
    return this;
  }
  /** Pit with an arc of lights drawing the jump. */
  pit(len, { n = Math.max(3, Math.round(len)), arc = 1.6, up = 1, lat = 0 } = {}) {
    this.gap(len);
    if (n > 0) this.lights(n, lat, 0.4, { spacing: (len - 0.8) / Math.max(1, n - 1), up, arc });
    return this;
  }
  /** Crate sitting on a small ledge (over a pit, against a wall…). */
  perch(kind, lat, fwd, up = 0, { size = 1.3, kindP = undefined, params = {} } = {}) {
    this.block(lat, up, fwd, size, 0.5, size, kindP ? { kind: kindP } : {});
    return this.crate(kind, lat, fwd, up, params);
  }
  /** Switch-group crates: list of [lat, fwd, up]. */
  outlines(group, list) { for (const [l, f, u = 0] of list) this.crate('outline', l, f, u, { group }); return this; }
  ttCrate(n, lat, fwd, up = 0) { return this.crate(`time${n}`, lat, fwd, up); }
  /** Lights in a ring (bonus rooms). */
  ring(n, lat, fwd, up = 1, rad = 1.6) {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; this.ent('pickup', 'light', lat + Math.cos(a) * rad, fwd + Math.sin(a) * rad, up); }
    return this;
  }
  /** Small walled alcove on the side of the path, closed by a column of iron crates (needs superSlam).
   *  side = +1 right / -1 left. Content callback receives (b, latCentre, fwdCentre). */
  ironAlcove(side, fwd, content, { depth = 3, wallH = 4.6, door = 3 } = {}) {
    const half = this.width / 2, L0 = side > 0 ? half : -half - depth, L1 = side > 0 ? half + depth : -half;
    const F0 = this.a + fwd - 1.6, F1 = this.a + fwd + 1.6, y = this.y;
    this.rawBox(L0, L1, y - 1, y, F0, F1, { kind: 'stone' });                                       // floor
    this.rawBox(L0, L1, y, y + wallH, F0 - 0.6, F0, { kind: 'stone' });                            // walls
    this.rawBox(L0, L1, y, y + wallH, F1, F1 + 0.6, { kind: 'stone' });
    const back = side > 0 ? [L1, L1 + 0.6] : [L0 - 0.6, L0];
    this.rawBox(back[0], back[1], y, y + wallH, F0 - 0.6, F1 + 0.6, { kind: 'stone' });
    const doorL = side > 0 ? half + 0.5 : -half - 0.5;
    // front wall with a 1-wide doorway plugged by iron crates
    const fw = side > 0 ? [half, half + 1] : [-half - 1, -half];
    this.rawBox(fw[0], fw[1], y, y + wallH, F0, this.a + fwd - 0.5, { kind: 'stone' });
    this.rawBox(fw[0], fw[1], y, y + wallH, this.a + fwd + 0.5, F1, { kind: 'stone' });
    this.rawBox(fw[0], fw[1], y + door, y + wallH, this.a + fwd - 0.5, this.a + fwd + 0.5, { kind: 'stone' });
    for (let i = 0; i < door; i++) this.crate('iron', doorL, fwd, i);
    const cl = side > 0 ? half + 1 + (depth - 1) / 2 : -half - 1 - (depth - 1) / 2;
    content(this, cl, fwd);
    return this;
  }
  /** Lay a side branch without moving the main cursor (and without counting its length). */
  branch(fn) {
    const s = { lat: this.lat, y: this.y, f: this.f, a: this.a, yaw: this.yaw, ox: this.ox, oz: this.oz, w: this.width, k: this.kind };
    this.noCount++;
    fn(this);
    this.noCount--;
    Object.assign(this, { lat: s.lat, y: s.y, f: s.f, a: s.a, yaw: s.yaw, ox: s.ox, oz: s.oz, width: s.w, kind: s.k });
    return this;
  }
  /** Turn left/right around the centre of the last laid pad (lay a pad of length ≈ width just before). */
  turn(dir, { pad = this.width } = {}) {
    this.closeLeg();
    const pivot = this.W(this.lat, this.y, this.f - pad / 2);
    this.yaw += dir === 'left' ? HALF_PI : -HALF_PI;
    this.ox = pivot[0]; this.oz = pivot[2]; this.lat = 0; this.f = pad / 2; this.a = this.f;
    this.legFirst = this.platforms.length - 1; // the corner pad belongs to the new leg's zone too
    this.turned = true;
    return this;
  }
  closeLeg() {
    const ps = this.platforms.slice(this.legFirst);
    if (ps.length) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      let ylo = Infinity, yhi = -Infinity;
      for (const p of ps) for (let i = 0; i < 3; i += 2) { lo[i] = Math.min(lo[i], p.min[i]); hi[i] = Math.max(hi[i], p.max[i]); }
      for (const p of ps) { ylo = Math.min(ylo, p.max[1]); yhi = Math.max(yhi, p.max[1]); }
      // small horizontal margin: the next leg's zone must start AT its corner pad, or Lumen would turn above the void
      const m = 0.6;
      this.legZones.push({ min: [lo[0] - m, ylo - 7, lo[2] - m], max: [hi[0] + m, yhi + 9, hi[2] + m], camera: { ...this.legCam, yaw: r6(this.yaw) }, _leg: true });
    }
    this.legFirst = this.platforms.length;
    return this;
  }
  /** Explicit zone in the current heading (camera yaw defaults to the heading). */
  camZone(len, camera, extra = {}, { w = 40, ylo = -30, yhi = 60 } = {}) {
    this.zone(len, { camera: { yaw: r6(this.yaw), ...camera }, ...extra }, { w });
    const z = this.zones[this.zones.length - 1];
    z.min[1] = this.y + ylo; z.max[1] = this.y + yhi;
    return this;
  }
  build() {
    if (!this.spawnAt) { const p0 = this.platforms[0]; this.spawnAt = [0, p0 ? p0.max[1] : 0, -1.5]; }
    this.closeLeg();
    const boots = this.zones.filter((z) => z._boot);
    const rest = this.zones.filter((z) => !z._boot);
    // priority = last match wins: boot zone (whole level) < legs (later legs win at corners) < explicit zones
    this.zones = [...boots, ...(this.turned ? this.legZones : []), ...rest].map(({ _boot, _leg, ...z }) => z);
    const d = super.build();
    d.pathLength = Math.round(this.walked);
    return d;
  }
}

export const mk = (meta) => new TurtleBuilder(meta);

/** Joke signs reused a little everywhere (with variations per level). */
export const JOKES = {
  lawyer: t('Ceci n\'est pas Crash. Nos avocats insistent.', 'This is not Crash. Our lawyers insist.'),
  stress: t('Ici on stresse dans la bonne humeur.', 'Here we stress cheerfully.'),
  coffee: t('Pause café : 0 min.', 'Coffee break: 0 min.'),
};

// =====================================================================================================================
// 3-1 Glissade Frileuse — run, ice. Snow intro → learn ice → narrow bridges & penguins → icy stairs + blizzard → floes.
// =====================================================================================================================
function glissade() {
  const b = mk({
    id: '3-1', world: 3, index: 1, name: t('Glissade Frileuse', 'Chilly Slide'), theme: 'ice', music: 'ice', mode: 'run',
    ground: 'snow', width: 5,
    intro: t('Le sol est glissant. Le scénario aussi.', 'The floor is slippery. So is the plot.'),
    timeTrial: { gold: 61, silver: 76, bronze: 97 },
  });
  // A — calm snow intro
  b.floor(16)
    .sign(t('Attention : sol glissant. Le jeu décline toute responsabilité.', 'Caution: slippery floor. The game accepts no liability.'), -2, 4)
    .lights(4, 0, 3, { spacing: 1.5 }).row('basic', 3, 0, 10)
    .deco('snowman', -4.2, 6).deco('pine', 4.6, 3, 0, 1.3).deco('pine', -5, 13, 0, 1.1)
    .floor(14).pyramid(3, 1, 6).enemy('penguin', -1.4, 10, { patrol: { axis: 'x', range: 1, speed: 1.2 } }).lights(3, -1.4, 3)
    .pit(3.5).step(1, 12).stack(['basic', 'lights'], -1.5, 5).crate('basic', 1.5, 5).lights(3, 0, 8).ttCrate(2, 1.5, 9)
    .deco('igloo', 5, 6, 0, 1.2);
  // B — learn the ice
  b.floor(26, { kind: 'ice', w: 7 })
    .sign(t('Glace : freine trois jours à l\'avance.', 'Ice: start braking three days early.'), -3, 2)
    .crate('basic', -2, 7).crate('basic', 2, 10).stack(['basic', 'basic'], 0, 14).crate('lights', -2.6, 23.5).crate('mask', 2.6, 23.5)
    .lights(5, 0, 3, { spacing: 2.2 })
    .enemy('penguin', 0, 19, { patrol: { axis: 'x', range: 2.4, speed: 2.4 } })
    .pit(3).floor(5, { kind: 'snow', w: 5 }).checkpoint(0, 2.5)
    .floor(16, { kind: 'ice', w: 2.2 }).crate('basic', 0, 1.5).crate('basic', 0, 14.5).lights(5, 0, 3, { spacing: 2.4 })
    .enemy('penguin', 0, 8, { patrol: { axis: 'z', range: 3.5, speed: 3 } })
    .floor(12, { w: 6 })
    .sign(t('TNT : sauter dessus = 3 secondes pour regretter.', 'TNT: jump on it = 3 seconds of regret.'), 2.6, 2)
    .crate('tnt', 0, 6).crate('basic', -1.2, 6).crate('basic', 1.2, 6).stack(['basic', 'basic'], -2.4, 9).crate('basic', 2.4, 9);
  // C — ledges, yeti kids, the switch staircase, and the glide-only secret floe
  b.step(1.2, 10).enemy('yetiKid', 1.6, 7).crate('basic', -1.6, 3).crate('lights', -1.6, 7)
    .step(1.2, 22, { w: 7 })
    .crate('switch', -2.6, 3, 0, { group: 'g31' })
    .sign(t('« ! » = des caisses apparaissent. C\'est de la magie. Ou du code.', '"!" = crates appear. It\'s magic. Or code.'), 2.8, 1)
    .block(-2.2, 3.4, 17, 3, 0.6, 7, { kind: 'ice' })
    .outlines('g31', [[-2.2, 11], [-2.2, 12.5], [-2.2, 12.5, 1], [0, 8], [1.5, 8]])
    .row('basic', 2, -2.2, 15.5, { axis: 'fwd', up: 3.4 }).crate('lights', -2.2, 18, 3.4).crate('basic', -2.2, 19.5, 3.4)
    .lights(4, -2.2, 14.5, { spacing: 1.6, up: 4.3 })
    .enemy('penguin', 1.5, 14, { patrol: { axis: 'z', range: 4, speed: 2.6 } })
    // secret: the red sock floats on a floe far to the right — double jump + tornado glide (lights draw it)
    .branch((s) => {
      s.block(15.5, -0.5, 24, 2.4, 0.6, 2.4, { kind: 'ice' }).sock('red', 15.5, 24, 0.5);
      s.block(15.5, -0.5, 20.6, 2.4, 0.6, 2.4, { kind: 'ice' });
    })
    .lights(8, 9.5, 22.3, { spacing: 1.5, axis: 'lat', up: 2.6, arc: 1.6 })
    .pit(4).floor(14, { kind: 'snow' })
    .crate('basic', -1.5, 4).crate('basic', 1.5, 4).crate('lights', 0, 9)
    .ironAlcove(-1, 10, (s, l, f) => s.ring(10, l, f, 1, 0.8).lights(3, l, f - 0.8, { spacing: 0.8, up: 2 }))
    .sign(t('Porte en fer. Revenez avec un pouvoir qui tape fort.', 'Iron door. Come back with a power that hits hard.'), 1.8, 9);
  // D — icy stairs down into the blizzard
  b.slope(-2.4, 8, 4, { kind: 'ice' }).crate('basic', -1.5, 3, 1.2).crate('basic', 1.5, 7, 0)
    .floor(4, { kind: 'snow' }).checkpoint(0, 2)
    .floor(20, { kind: 'ice', w: 3 })
    .hazard('wind', 0, 10, { w: 3, d: 20, h: 5, force: { lat: 2.6, fwd: 0 } })
    .sign(t('Blizzard de niveau « Cortisol ». Penche-toi à gauche.', '"Cortisol-grade" blizzard. Lean left.'), -1, 1)
    .crate('basic', -1, 5).crate('basic', -1, 9).crate('lights', -1, 13).crate('basic', -1, 17).lights(6, 0.6, 3, { spacing: 2.8 })
    .floor(8, { w: 6 }).enemy('yetiKid', 2, 5).stack(['basic', 'basic', 'lights'], -2, 5)
    .stones(4, { size: 2.4, gap: 2.4, kind: 'ice' }).crate('lights', 0, 3.6).crate('basic', 0, 8.4).crate('basic', 0, 13.2)
    .lights(8, 0, 1.2, { spacing: 2.4, up: 1.6, arc: 1 })
    .floor(10, { kind: 'snow', w: 6 }).crate('mask', 2, 4).pyramid(2, -1.5, 6).ttCrate(3, 0, 8);
  // E — climax: drifting floes, a runaway crate, nitro guards
  b.gap(9).platform('moving', 0, 1.5, { w: 2.4, h: 0.5, d: 2.4, up: -0.5, to: { fwd: 5.5 }, period: 3.4 })
    .lights(5, 0, 1.5, { spacing: 1.4, up: 1.4 })
    .floor(24, { kind: 'ice', w: 9 })
    .sign(t('Cette caisse a des jambes. Ne lui demandez pas pourquoi.', 'This crate has legs. Don\'t ask why.'), -4, 2)
    .crate('legs', 0, 9).crate('nitro', -2, 14).crate('basic', -3, 14).crate('basic', -2, 15).crate('lights', -3, 15)
    .crate('nitro', 2.5, 18).stack(['basic', 'basic'], 3.5, 18).crate('basic', 2.5, 19)
    .enemy('penguin', 0, 11.5, { patrol: { axis: 'x', range: 3, speed: 3.2 } })
    .enemy('yetiKid', 3.6, 22).lights(6, 0, 3, { spacing: 3.2 })
    .step(1, 6, { kind: 'snow', w: 5 }).crate('basic', 1.5, 3)
    .step(1, 6).crate('basic', -1.5, 3)
    .step(1, 6).crate('basic', 1.5, 2).crate('basic', -1.5, 4)
    .pit(4.5, { arc: 2 }).floor(16, { w: 7 })
    .sign(t('Fort de neige du Yéti. Entrée libre, sortie compliquée.', 'Yeti\'s snow fort. Free entry, tricky exit.'), -3, 1)
    .block(-2.5, 1.2, 8, 2, 1.2, 6, { kind: 'snow' }).block(2.5, 1.2, 8, 2, 1.2, 6, { kind: 'snow' })
    .crate('lights', -2.5, 8, 1.2).crate('basic', 2.5, 7, 1.2).crate('basic', 2.5, 9, 1.2)
    .enemy('yetiKid', 0, 13).hazard('barrels', 0, 15.5, { interval: 3.2 })
    .lights(5, 0, 2, { spacing: 2 })
    .floor(10, { w: 6 })
    .crate('nitroSwitch', -2, 6).crate('basic', 2, 3).crate('basic', 2, 4).crate('mystery', 0, 8).ttCrate(1, 2, 7)
    .sign(t('Bravo ! Vous avez glissé avec style. Enfin, avec un style.', 'Bravo! You slid with style. Well, a style.'), -2.4, 2)
    .goal(10, { w: 6 }).deco('ice_spike', 3.6, 5, 0, 1.4).deco('snowman', -3.6, 5);
  return b.build();
}


// =====================================================================================================================
// 3-2 Grotte Cristal — run, cave. Bats → shy (vanishing) platforms → side-view crystal gallery → underground lake &
// crystal beams → staggered vanishing climax. Secret: the purple sock behind an iron door (come back with superSlam).
// =====================================================================================================================
function grotte() {
  const b = mk({
    id: '3-2', world: 3, index: 2, name: t('Grotte Cristal', 'Crystal Cave'), theme: 'cave', music: 'cave', mode: 'run',
    ground: 'stone', width: 4.5,
    intro: t('Il fait noir. Suivez les lucioles : ce sont elles qui paient l\'électricité.', 'It\'s dark. Follow the fireflies: they pay the power bill.'),
    timeTrial: { gold: 66, silver: 80, bronze: 100 },
  });
  // A — entrance & first bats
  b.floor(14)
    .sign(t('Ne léchez pas les cristaux. Oui, toi.', 'Do not lick the crystals. Yes, you.'), -1.8, 4)
    .lights(5, 0, 2, { spacing: 1.6 }).crate('basic', -1.2, 9).crate('basic', 1.2, 9).crate('lights', 0, 12)
    .deco('crystal', -3.5, 5, 0, 1.4).deco('stalagmite', 3.4, 9).deco('crystal', 3.6, 2, 0, 0.9)
    .floor(12).enemy('bat', 0, 6, { up: 1.4, patrol: { axis: 'x', range: 1.8, speed: 2 } })
    .stack(['basic', 'basic'], 1.5, 10).crate('basic', -1.5, 10).lights(3, 0, 2)
    .pit(3).step(0.8, 12, { kind: 'crystal' }).pyramid(2, 0, 5).lights(3, 0, 1).ttCrate(2, -1.6, 9)
    .sign(t('Plateformes timides : elles disparaissent si on les fixe.', 'Shy platforms: they vanish if you stare.'), 1.8, 10);
  // B — shy platforms
  b.gap(8).platform('vanishing', 0, 4, { w: 2.4, d: 2.4, up: -0.5, period: 3, offset: 0 })
    .lights(5, 0, 0.6, { spacing: 1.7, up: 1.2, arc: 1.2 })
    .floor(8, { kind: 'crystal' }).crate('basic', -1, 3).crate('lights', 1, 5)
    .gap(11).platform('vanishing', 0, 3, { w: 2.2, d: 2.2, up: -0.5, period: 3, offset: 0 })
    .platform('vanishing', 0, 7.6, { w: 2.2, d: 2.2, up: -0.5, period: 3, offset: 1.5 })
    .lights(7, 0, 0.6, { spacing: 1.6, up: 1.3, arc: 1.4 })
    .floor(14).checkpoint(0, 3).crate('mask', 1.6, 7).crate('basic', -1.6, 7).crate('basic', -1.6, 8)
    .enemy('porcupine', 0, 11, { patrol: { axis: 'x', range: 1.4, speed: 1 } });
  // C — side-view crystal gallery
  b.camZone(60, { mode: 'side', travelYaw: 0, yaw: Math.PI / 2, dist: 10.5 })
    .floor(6, { w: 3 }).crate('basic', 0, 3)
    .sign(t('Vue de côté : on a fait des économies sur la 3D.', 'Side view: we saved money on the 3D.'), -1, 1, Math.PI / 2)
    .step(1.2, 5, { w: 3, kind: 'crystal' }).crate('lights', 0, 2.5)
    .pit(3).step(1.2, 5, { w: 3 }).enemy('bat', 0, 2.5, { up: 1.8, patrol: { axis: 'z', range: 2, speed: 1.5 } })
    .gap(6).platform('vanishing', 0, 3, { w: 2.2, d: 2.2, up: -0.5, period: 2.6 })
    .lights(4, 0, 0.8, { spacing: 1.5, up: 1.2, arc: 1 })
    .floor(7, { w: 3, kind: 'crystal' }).hazard('spikes', 0, 3.5, { period: 2.2, offset: 0 }).lights(3, 0, 2.5, { up: 2.4 })
    .step(-1.2, 6, { w: 3 }).row('basic', 3, 0, 1.5, { axis: 'fwd' })
    .step(-1.2, 6, { w: 3 }).crate('switch', 0, 3, 0, { group: 'g32' }).lights(2, 0, 1)
    .gap(4).floor(12, { w: 3 }).enemy('porcupine', 0, 6, { patrol: { axis: 'z', range: 2.5, speed: 1.2 } })
    .crate('basic', 0, 1).crate('lights', 0, 11);
  // D — underground lake, crystal beams
  b.floor(6, { kind: 'crystal' }).lights(3, 0, 1)
    .stones(5, { size: 2.2, gap: 2.2, kind: 'crystal', zigzag: 1.2 })
    .crate('lights', -1.2, 3.3).crate('basic', 1.2, 7.7).crate('basic', -1.2, 12.1).crate('lights', 1.2, 16.5)
    .lights(1, 1.2, 3.3, { up: 1.2 }).lights(1, -1.2, 7.7, { up: 1.2 }).lights(1, 1.2, 12.1, { up: 1.2 }).lights(1, -1.2, 16.5, { up: 1.2 })
    .enemy('bat', 0, 10, { up: 2.4, patrol: { axis: 'x', range: 2, speed: 2.2 } })
    .floor(18).checkpoint(0, 2)
    .hazard('laser', 0, 7, { axis: 'x', width: 4.5, period: 2.4, offset: 0 })
    .hazard('laser', 0, 12, { axis: 'x', width: 4.5, period: 2.4, offset: 1.2 })
    .crate('basic', -1.7, 9.5).crate('basic', 1.7, 9.5).crate('lights', 0, 15).lights(4, 0, 4, { spacing: 2.5 })
    .sign(t('Rayons cristal : 100 % naturels, 0 % inoffensifs.', 'Crystal beams: 100% natural, 0% harmless.'), 1.8, 4)
    .pit(4).floor(14).hazard('pendulum', 0, 5, { length: 4, speed: 1.6 }).hazard('pendulum', 0, 10, { length: 4, speed: 1.6, phase: 1.5 })
    .crate('basic', 1.7, 2).crate('basic', -1.7, 7.5).crate('basic', 1.7, 12.5)
    .floor(26, { w: 7, kind: 'crystal' })
    .walls(26, { h: 3, kind: 'crystal', spread: 7 })
    .block(-1.5, 2, 9, 4, 2, 1, { kind: 'crystal' }).block(1.5, 2, 15, 4, 2, 1, { kind: 'crystal' })
    .enemy('porcupine', 2, 6, { patrol: { axis: 'x', range: 1, speed: 1 } }).enemy('porcupine', -2, 12, { patrol: { axis: 'x', range: 1, speed: 1 } })
    .row('basic', 2, 2.2, 9).row(['basic', 'lights'], 2, -2.2, 15).stack(['basic', 'basic'], 0, 20).crate('mystery', 2.5, 22).lights(6, 0, 3, { spacing: 3.6 })
    .outlines('g32', [[-2.6, 19], [-2.6, 20], [-2.6, 21], [-2.6, 19, 1], [-2.6, 20, 1]]);
  // E — staggered shy platforms, nitro guards, the iron door
  b.gap(14)
    .platform('vanishing', 0, 2.5, { w: 2.2, d: 2.2, up: -0.5, period: 3.3, offset: 0 })
    .platform('vanishing', 0.8, 7, { w: 2.2, d: 2.2, up: -0.5, period: 3.3, offset: 1.1 })
    .platform('vanishing', 0, 11.5, { w: 2.2, d: 2.2, up: -0.5, period: 3.3, offset: 2.2 })
    .lights(9, 0, 0.6, { spacing: 1.6, up: 1.4, arc: 1.4 })
    .enemy('bat', 0, 9, { up: 2.6, patrol: { axis: 'x', range: 2.2, speed: 2.4 } })
    .floor(20, { w: 6 }).checkpoint(-2, 2)
    .crate('nitro', 0, 7).crate('basic', 0, 8).crate('basic', -1, 8).crate('nitro', 1, 8).crate('lights', 0, 9)
    .ironAlcove(1, 14, (s, l, f) => s.sock('purple', l, f, 1).ring(6, l, f, 1.6, 0.7))
    .sign(t('Porte blindée. Ici, on garde les chaussettes. Revenez plus fort.', 'Armoured door. Socks are kept here. Come back stronger.'), -2.6, 13)
    .enemy('porcupine', -1.5, 17, { patrol: { axis: 'x', range: 1, speed: 1 } }).ttCrate(3, 2.4, 18)
    .step(1, 8, { kind: 'crystal' }).crate('basic', 1.5, 3).crate('basic', -1.5, 5)
    .step(1, 8).crate('lights', 0, 5).hazard('spikes', 0, 2, { period: 1.8, offset: 0.9 })
    .gap(5).platform('moving', 0, 2.5, { w: 2.2, d: 2.2, up: -0.5, to: { up: 2.5 }, period: 3 })
    .lights(4, 0, 2.5, { spacing: 0.1, up: 1.2, arc: 3 })
    .step(2.5, 12, { kind: 'crystal' }).crate('basic', -1.5, 3).crate('basic', -1.5, 4).crate('lights', 1.5, 6)
    .enemy('bat', 0, 9, { up: 1.5, patrol: { axis: 'x', range: 1.8, speed: 2.4 } })
    .slope(-2.5, 8, 4).crate('basic', 1.5, 7, 0)
    .pit(4.5, { arc: 2 }).floor(10, { w: 6 })
    .crate('nitroSwitch', 2.2, 6).crate('basic', -2, 3).crate('basic', -2, 4).crate('basic', -2, 5)
    .sign(t('Fin de la grotte. Vous pouvez à nouveau lécher des choses.', 'End of the cave. You may lick things again.'), 1.8, 2)
    .goal(10, { w: 6 }).deco('crystal', -3.4, 5, 0, 1.8).deco('crystal', 3.4, 4, 0, 1.3);
  return b.build();
}

// =====================================================================================================================
// 3-3 Avalanche ! — chase (front camera), downhill. Snowball behind, logs, sliding penguins, a TNT lesson, narrow
// bridge, ice patches, a high lane with the sock, then the final gauntlet.
// =====================================================================================================================
function avalanche() {
  const b = mk({
    id: '3-3', world: 3, index: 3, name: t('Avalanche !', 'Avalanche!'), theme: 'ice', music: 'chase', mode: 'chase',
    ground: 'snow', width: 6,
    intro: t('Une boule de neige géante. Évidemment. Courez vers la caméra !', 'A giant snowball. Of course. Run toward the camera!'),
    timeTrial: { gold: 50, silver: 58, bronze: 72 },
  });
  const log = (fwd, h = 0.9) => b.block(0, h, fwd, 6, h, 0.9, { kind: 'wood' });
  b.spawn(0, 0, 13);
  b.floor(30).hazard('boulder', 0, 3.5, { style: 'snowball', speed: 6.8 })
    .sign(t('Panneau inutile : COUREZ.', 'Useless sign: RUN.'), -2.6, 16)
    .lights(6, 0, 15, { spacing: 2.4 }).crate('basic', 2.2, 21).crate('lights', -2.2, 25).crate('basic', 2.2, 28)
    .deco('pine', -4.5, 10, 0, 1.4).deco('pine', 4.6, 18, 0, 1.2);
  b.slope(-1.5, 10, 5, { lightsLat: 0 })
    .floor(16); log(6); b.lights(5, 0, 4, { spacing: 0.9, arc: 1.4, up: 1.4 }).crate('basic', -2.2, 11).crate('basic', 2.2, 11)
    .enemy('penguin', 0, 13, { patrol: { axis: 'x', range: 2.4, speed: 2.6 } })
    .pit(3.5).floor(14).row(['basic', 'basic', 'tnt', 'basic', 'basic'], 5, 0, 6)
    .sign(t('Toupie sur la TNT = mauvaise idée. Saut sur la TNT = idée moyenne.', 'Spin the TNT = bad idea. Jump on the TNT = average idea.'), -2.6, 2)
    .lights(4, 0, 9, { spacing: 1.2 })
    .slope(-1.2, 8, 4).floor(14, { w: 2.2, kind: 'bridge' }).lights(6, 0, 1, { spacing: 2.4 })
    .enemy('penguin', 0, 9, { patrol: { axis: 'z', range: 3, speed: 3.4 } })
    .floor(8).checkpoint(0, 4).crate('mask', -2, 6);
  // penguin parade + ice corridor
  b.floor(18, { w: 7 }).walls(18, { h: 1.6, kind: 'ice', spread: 7 })
    .enemy('penguin', 0, 5, { patrol: { axis: 'x', range: 2.6, speed: 3 } }).enemy('penguin', 0, 10, { patrol: { axis: 'x', range: 2.6, speed: 3.6 } })
    .enemy('penguin', 0, 15, { patrol: { axis: 'x', range: 2.6, speed: 4.2 } })
    .crate('basic', -3, 3).crate('lights', 3, 7.5).crate('basic', -3, 12.5).crate('basic', 3, 17).lights(6, 0, 2.5, { spacing: 2.5, up: 1.6 })
    .sign(t('Défilé de pingouins. Ils ne s\'arrêteront pas pour vous.', 'Penguin parade. They won\'t stop for you.'), -2.6, 1)
    .slope(-1, 6, 3)
    .floor(16, { kind: 'ice', w: 5 }).walls(16, { h: 2.2, kind: 'ice', spread: 5 })
    .row('basic', 4, 0, 4, { spacing: 1.2 }).row(['lights', 'basic', 'basic', 'lights'], 4, 0, 11, { spacing: 1.2 }).lights(4, 0, 7, { spacing: 1 });
  // middle — ice, spikes, stones, yeti kids on the banks
  b.floor(18, { kind: 'ice' }).hazard('spikes', -1.5, 6, { period: 2, offset: 0 }).hazard('spikes', 1.5, 11, { period: 2, offset: 1 })
    .crate('basic', 1.5, 6).crate('basic', -1.5, 11).lights(6, 0, 3, { spacing: 2.6 })
    .sign(t('Glace + panique = chorégraphie.', 'Ice + panic = choreography.'), 2.6, 1)
    .stones(3, { size: 2.6, gap: 2.2, kind: 'ice' }).crate('lights', 0, 3.5).lights(3, 0, 7.6, { up: 1.5, spacing: 0.6 })
    .floor(20).enemy('yetiKid', -4, 8, { up: 0.4 }).enemy('yetiKid', 4, 15, { up: 0.4 })
    .block(-4, 0.4, 8, 2, 0.4, 2, { kind: 'snow' }).block(4, 0.4, 15, 2, 0.4, 2, { kind: 'snow' })
    .crate('basic', -1, 5).crate('basic', 1, 10).stack(['basic', 'lights'], 0, 16).lights(5, 0, 2, { spacing: 4 }).crate('basic', -2.6, 3).crate('basic', 2.6, 3);
  log(19);
  b.slope(-2, 10, 5, { lightsLat: 0 });
  // split: left high lane (bounce crate / double jump) with the green sock, right lane with nitro guards
  b.floor(30, { w: 8 })
    .block(-2.6, 2.6, 15, 2.8, 0.6, 22, { kind: 'snow' })
    .crate('bounce', -2.6, 2).sock('green', -2.6, 18, 3.6).lights(8, -2.6, 6, { spacing: 2.4, up: 3.4 })
    .crate('nitro', 1.4, 8).crate('basic', 2.6, 8).crate('nitro', 2.6, 14).crate('basic', 1.4, 14).crate('lights', 2, 20)
    .crate('basic', -2.6, 10, 2.6).crate('basic', -2.6, 22, 2.6)
    .sign(t('Voie de gauche réservée aux pingouins VIP.', 'Left lane reserved for VIP penguins.'), 3.6, 1)
    .floor(8).checkpoint(0, 4);
  // finale
  b.slope(-1.6, 8, 4).floor(16); log(5); log(11);
  b.crate('basic', -2.2, 8).crate('basic', 2.2, 8).lights(10, 0, 1, { spacing: 1.5, up: 1.2 })
    .enemy('penguin', 0, 14, { patrol: { axis: 'x', range: 2.4, speed: 3 } })
    .pit(4).floor(4).gap(3.5).floor(10).crate('legs', 0, 5).lights(3, 0, 1).crate('basic', -2.4, 8).crate('basic', 2.4, 8)
    .gap(4).platform('falling', -1.2, 2, { w: 2, d: 2, up: -0.5, delay: 0.5 }).platform('falling', 1.2, 2, { w: 2, d: 2, up: -0.5, delay: 0.5 })
    .lights(4, 0, 0.5, { spacing: 1, arc: 1, up: 1 })
    .floor(14).row(['basic', 'lights', 'basic', 'lights', 'basic'], 5, 0, 5).crate('nitroSwitch', -2.4, 10).ttCrate(1, 2.4, 10)
    .slope(-1, 6, 3)
    .floor(10).pyramid(3, 0, 5).crate('basic', -2.5, 8).crate('basic', 2.5, 8)
    .sign(t('La boule s\'arrête ici. Elle a un contrat syndical.', 'The ball stops here. Union contract.'), -2.6, 2)
    .goal(12).deco('pine', -4.4, 6, 0, 1.6).deco('igloo', 4.6, 6);
  return b.build();
}

// =====================================================================================================================
// 3-4 Bobsleigh Pingouin — ride (penguin), autoRun 13, a walled ice chute that keeps going down. Lanes, jumps, slalom
// between nitro gates, a raised bounce lane with the sock, a split track and a final plunge.
// =====================================================================================================================
function bobsleigh() {
  const b = mk({
    id: '3-4', world: 3, index: 4, name: t('Bobsleigh Pingouin', 'Penguin Bobsleigh'), theme: 'ice', music: 'ride', mode: 'ride',
    mount: 'penguin', autoRun: 13, ground: 'snow', width: 7,
    intro: t('Le pingouin est d\'accord. Enfin, il n\'a pas dit non.', 'The penguin agreed. Well, he didn\'t say no.'),
    timeTrial: { gold: 33, silver: 38, bronze: 48 },
  });
  b.boot({ autoRun: 13 });
  const W = { walls: 1.3 };
  b.track(22, W)
    .sign(t('Bobsleigh : on a perdu les freins. Et le bob.', 'Bobsleigh: we lost the brakes. And the bob.'), -2.6, 4)
    .lights(6, 0, 8, { spacing: 2.2 })
    .slope(-3, 30, 10, { walls: 1.3, lightsLat: 0 })
    .track(34, W).row('basic', 3, 0, 6, { spacing: 2.2 }).row(['basic', 'lights'], 2, -2.2, 14, { axis: 'fwd', spacing: 2 }).row('basic', 3, 2.2, 30, { axis: 'fwd', spacing: 1.2 })
    .enemy('penguin', 2.2, 18, { patrol: { axis: 'x', range: 1, speed: 1.5 } }).crate('basic', 2.2, 24).crate('basic', -2.2, 28)
    .lights(5, 0, 20, { spacing: 2.6 })
    .pit(6, { arc: 2.2, n: 6 })
    .track(20, W).stack(['basic', 'basic'], -2.2, 8).stack(['basic', 'basic'], 2.2, 12).crate('mask', 0, 16)
    .slope(-3, 24, 8, { walls: 1.3, lightsLat: 1.6 });
  // slalom on ice between nitro gates
  b.track(44, { ...W, kind: 'ice' })
    .sign(t('Slalom : les caisses vertes ne sont pas des bonbons.', 'Slalom: the green crates are not candy.'), 2.6, 1)
    .crate('nitro', -2.6, 6).crate('nitro', -1.6, 6).crate('nitro', 0, 14).crate('nitro', 2.6, 22).crate('nitro', 1.6, 22).crate('nitro', 0, 30)
    .crate('basic', 2.2, 6).crate('basic', -2.2, 14).crate('basic', 2.2, 14).crate('basic', -2.2, 22).crate('lights', 2.2, 30).crate('basic', -2.2, 30)
    .lights(3, 2.2, 3).lights(3, -2.2, 11).lights(3, 0, 19).lights(3, -2.2, 27).ttCrate(2, 0, 38)
    .track(8, W).checkpoint(0, 4);
  // raised plateau, bounce crates and the high lane (sock)
  b.step(1, 26, { w: 7 }).walls(26, { h: 1.3, kind: 'ice', spread: 7 })
    .crate('lights', -2.2, 6).crate('lights', 2.2, 10).enemy('penguin', 0, 14, { patrol: { axis: 'x', range: 2.4, speed: 2 } })
    .crate('bounce', -2.2, 18).block(-2.4, 3.2, 31, 2.2, 0.5, 18, { kind: 'ice' })
    .lights(5, 2.2, 16, { spacing: 2 })
    .slope(-4, 32, 11, { walls: 1.3, lightsLat: 2 })
    .branch((s) => { s.at(-2.4, s.y + 4 + 3.2, s.f - 32).sock('blue', 0, 6).lights(5, 0, 1, { spacing: 1.6, up: 1 }); });
  // split track: central divider, left crates / right lights
  b.track(34, { ...W, w: 8 }).block(0, 1.3, 17, 0.8, 1.3, 30, { kind: 'snow' })
    .row('basic', 5, -2.2, 4, { axis: 'fwd', spacing: 5 }).crate('tnt', -2.2, 28)
    .lights(10, 2.2, 3, { spacing: 2.8 }).enemy('penguin', 2.2, 18, { patrol: { axis: 'x', range: 1, speed: 2 } })
    .sign(t('Gauche : des caisses. Droite : des lucioles. Milieu : un mur. Choisissez.', 'Left: crates. Right: fireflies. Middle: a wall. Choose.'), 0, 1)
    .gap(7).perch('lights', 0, 3.5, -0.5).lights(5, -2, 0.5, { spacing: 1.5, arc: 2, up: 1.4 })
    .track(10, W).checkpoint(0, 5);
  // final plunge
  b.slope(-5, 40, 16, { walls: 1.3, lightsLat: 0 })
    .crate('tnt', -1.8, 8.75, b.sy(8.75)).crate('tnt', 1.8, 21.25, b.sy(21.25)).crate('basic', 1.8, 8.75, b.sy(8.75)).crate('basic', -1.8, 21.25, b.sy(21.25))
    .crate('basic', 0, 31.25, b.sy(31.25)).crate('legs', 0, 36.25, b.sy(36.25))
    .pit(5, { arc: 2 })
    .track(30, W).row('basic', 3, 0, 4, { spacing: 2.4 }).row('basic', 3, 0, 10, { spacing: 2.4 }).crate('mystery', 0, 16)
    .crate('nitroSwitch', -2.6, 22).stack(['basic', 'basic'], 2.6, 22).lights(8, 0, 2, { spacing: 3.2 })
    .sign(t('Le pingouin demande une augmentation.', 'The penguin is asking for a raise.'), 2.6, 26)
    .goal(14, { w: 7 }).deco('igloo', 5, 7, 0, 1.2);
  return b.build();
}

// =====================================================================================================================
// 3-5 Aurores Suspendues — run, aurora night. Floating platforms over the void: movers, bouncy pads, rotating discs,
// elevators, glides. Secret: the sock is BELOW the third island ("don't look down").
// =====================================================================================================================
function aurores() {
  const b = mk({
    id: '3-5', world: 3, index: 5, name: t('Aurores Suspendues', 'Hanging Auroras'), theme: 'aurora', music: 'aurora', mode: 'run',
    ground: 'glass', width: 4,
    intro: t('Il fait nuit, tout flotte, personne ne sait pourquoi. Même pas nous.', 'It\'s night, everything floats, nobody knows why. Not even us.'),
    timeTrial: { gold: 70, silver: 85, bronze: 108 },
  });
  // island 1
  b.floor(16, { kind: 'crystal', w: 6 })
    .sign(t('Ne regardez pas en bas. Il n\'y a rien. Vraiment rien.', 'Don\'t look down. There\'s nothing. Really nothing.'), -2.4, 3)
    .pyramid(3, 1, 9).crate('basic', -2, 9).lights(4, -1.5, 3, { spacing: 1.4 })
    .gap(10).platform('moving', 0, 1.8, { w: 2.6, h: 0.5, d: 2.6, up: -0.5, to: { fwd: 6.4 }, period: 3.6 })
    .lights(6, 0, 1, { spacing: 1.6, up: 1.3 })
    .floor(10, { kind: 'crystal' }).crate('basic', -1, 4).crate('lights', 1, 6).enemy('pigeon', 0, 8, { up: 2 })
    .gap(3.5).step(0.5, 8).platform('bouncy', 0, 6.5, { w: 1.8, d: 1.8, h: 0.4 }).lights(5, 0, 6.5, { spacing: 0.1, up: 1.4, arc: 3.6, axis: 'fwd' })
    .sign(t('Champignon de nuit : rebondir dessus. Ne pas le cuisiner.', 'Night mushroom: bounce on it. Do not cook it.'), -1.6, 2)
    .gap(2.5).step(3.4, 14, { kind: 'cloud', w: 5 })
    .crate('basic', -1.5, 4).crate('basic', 1.5, 4).stack(['basic', 'lights'], 0, 9).ttCrate(3, -1.8, 12);
  // the secret below island 3: drop off its right side, bounce back up
  b.branch((s) => {
    s.block(5.2, -5.5, 7, 3.2, 0.6, 5, { kind: 'cloud' }).sock('blue', 5.2, 7, 0.4 - 5.5)
      .platform('bouncy', 5.2, 9, { w: 1.6, d: 1.6, h: 0.4, up: -5.5 }).ring(5, 5.2, 6.4, -4.4, 0.8);
  });
  b.sign(t('Psst. En bas à droite. Non, rien.', 'Psst. Bottom right. No, nothing.'), 2, 7);
  // rotating discs
  b.gap(12).platform('rotating', 0, 3.2, { w: 3.2, d: 3.2, h: 0.5, up: -0.5, speed: 0.9 })
    .platform('rotating', 0, 8.6, { w: 3.2, d: 3.2, h: 0.5, up: -0.5, speed: -1.1 })
    .lights(7, 0, 0.8, { spacing: 1.7, up: 1.3, arc: 1 })
    .floor(14, { kind: 'crystal', w: 6 }).checkpoint(0, 3).crate('mask', -2, 9).crate('basic', 2, 9).crate('basic', 2, 10)
    .enemy('bat', 0, 11, { up: 1.6, patrol: { axis: 'x', range: 2, speed: 1.8 } });
  // elevators (vertical movers) up a cliff of light
  b.gap(4).platform('moving', 0, 2, { w: 2.4, d: 2.4, up: -0.5, to: { up: 3 }, period: 3.2 })
    .block(0, 3, 5.5, 2.4, 0.5, 2.4, { kind: 'glass' }).crate('basic', 0, 5.5, 3)
    .platform('moving', 0, 9, { w: 2.4, d: 2.4, up: 2.5, to: { up: 3 }, period: 3.2 })
    .lights(4, 0, 2, { spacing: 2.4, up: 3, arc: 2 })
    .gap(11).step(6, 12, { kind: 'cloud', w: 5 }).crate('lights', 0, 4).row('basic', 3, 0, 8)
    .enemy('pigeon', 1.5, 10, { up: 2.4 });
  // long glide down to the next island — doubleJump does it, tornado makes it comfy
  b.gap(8).lights(9, 0, 0.4, { spacing: 0.9, up: 1.2, arc: 2.6 })
    .step(-2, 10, { kind: 'crystal', w: 6 })
    .sign(t('Toupie maintenue = planer. Oku Oku : « J\'ai inventé ça. »', 'Hold spin = glide. Oku Oku: "I invented that."'), -2.4, 2)
    .crate('basic', -1.5, 5).crate('basic', 1.5, 5).crate('lights', 0, 7);
  // bouncy chain over the void
  b.gap(12).platform('bouncy', 0, 3, { w: 2, d: 2, h: 0.4, up: -0.4 }).platform('bouncy', 0, 8, { w: 2, d: 2, h: 0.4, up: 0.6 })
    .lights(5, 0, 0.6, { spacing: 0.6, up: 1.2, arc: 3 }).lights(5, 0, 4.4, { spacing: 0.7, up: 2.2, arc: 3.4 })
    .step(2, 14, { kind: 'cloud', w: 6 }).checkpoint(0, 3)
    .crate('switch', 2, 7, 0, { group: 'g35' }).crate('basic', -2, 8).crate('basic', -2, 9).enemy('bat', 0, 12, { up: 1.5, patrol: { axis: 'x', range: 2, speed: 2 } });
  // falling aurora panels (keep running!) then a tornado shortcut over a ring of lights
  b.gap(13)
    .platform('falling', 0, 2, { w: 2.2, d: 2.2, up: -0.5, delay: 0.45 }).platform('falling', 0.8, 5.2, { w: 2.2, d: 2.2, up: -0.5, delay: 0.45 })
    .platform('falling', -0.8, 8.4, { w: 2.2, d: 2.2, up: -0.5, delay: 0.45 }).platform('falling', 0, 11.2, { w: 2.2, d: 2.2, up: -0.5, delay: 0.45 })
    .lights(8, 0, 0.8, { spacing: 1.6, up: 1.3 })
    .sign(t('Panneaux d\'aurore : garantis 0,45 seconde.', 'Aurora panels: guaranteed for 0.45 seconds.'), -2.2, -1)
    .floor(12, { kind: 'crystal', w: 6 }).crate('basic', -2, 3).crate('basic', -2, 4).crate('lights', 2, 3.5).stack(['basic', 'basic'], 0, 9)
    .enemy('pigeon', 2, 7, { up: 2.2 })
    .gap(10).lights(8, 0, 0.6, { spacing: 1.2, up: 1.4, arc: 2.2 })
    .step(-0.5, 10, { kind: 'glass', w: 5 }).crate('basic', -1.5, 4).crate('basic', 1.5, 4).crate('mask', 0, 7)
    .sign(t('Trop loin ? Double saut, puis toupie maintenue. Oku Oku a dit « facile ».', 'Too far? Double jump, then hold spin. Oku Oku said "easy".'), -2, 2);
  // movers & shy platforms combined
  b.gap(15)
    .platform('moving', -2, 2.4, { w: 2.4, d: 2.4, up: -0.5, to: { lat: 4 }, period: 3 })
    .platform('vanishing', 0, 7.5, { w: 2.4, d: 2.4, up: -0.5, period: 3, offset: 0.5 })
    .platform('moving', 2, 12.4, { w: 2.4, d: 2.4, up: -0.5, to: { lat: -4 }, period: 3 })
    .lights(8, 0, 0.8, { spacing: 1.9, up: 1.4 })
    .floor(12, { kind: 'crystal', w: 6 }).outlines('g35', [[-1.5, 4], [-0.5, 4], [0.5, 4], [1.5, 4], [-1, 4, 1], [0, 4, 1], [1, 4, 1]])
    .crate('nitro', 2.4, 9).crate('basic', 2.4, 10).enemy('pigeon', -1.5, 9, { up: 2 })
    .stones(4, { size: 2, gap: 2.4, dy: 0.6, kind: 'glass', zigzag: 1 }).crate('basic', -1, 3.4, -1.8).crate('lights', 1, 7.8, -1.2).crate('basic', -1, 12.2, -0.6)
    .floor(10, { kind: 'crystal' }).crate('basic', 0, 3).crate('basic', 0, 6).enemy('bat', 0, 8, { up: 1.6, patrol: { axis: 'x', range: 1.6, speed: 2 } });
  // finale: two rotating bars, the last island
  b.gap(13).platform('rotating', 0, 3.4, { w: 3, d: 3, h: 0.5, up: -0.5, speed: 1.3 })
    .platform('rotating', 0, 9.4, { w: 3, d: 3, h: 0.5, up: -0.5, speed: -1.5 })
    .lights(7, 0, 0.8, { spacing: 1.9, up: 1.4, arc: 1.2 })
    .floor(18, { kind: 'crystal', w: 7 })
    .crate('nitroSwitch', -2.8, 15).crate('legs', 0, 6).pyramid(3, 1.5, 12).crate('basic', -2.5, 9).crate('basic', -2.5, 10)
    .lights(6, 0, 2, { spacing: 2.8 })
    .sign(t('Les aurores boréales sont sponsorisées par le Dr Cortisol. Non.', 'The northern lights are sponsored by Dr Cortisol. No.'), 2.8, 2)
    .goal(10, { w: 6, kind: 'crystal' }).deco('aurora_tree', -3, 6, 0, 1.4).deco('aurora_tree', 3, 6, 0, 1.2);
  return b.build();
}

export default [glissade(), grotte(), avalanche(), bobsleigh(), aurores()];
