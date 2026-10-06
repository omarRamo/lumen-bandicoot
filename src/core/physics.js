// Axis-separated AABB collision against static boxes (spatial hash) + dynamic solids (entities).
// Bodies use a feet-origin: box = [pos.x±hx, pos.y .. pos.y+h, pos.z±hz].
const CELL = 8;
const EPS = 1e-4;

function key(ix, iz) { return ix * 73856093 ^ iz * 19349663; }

export class StaticWorld {
  constructor() { this.cells = new Map(); this.all = []; }

  add(solid) {
    // solid: { min:{x,y,z}, max:{x,y,z}, kind, slippery, conveyor, damage, oneWay }
    this.all.push(solid);
    const x0 = Math.floor(solid.min.x / CELL), x1 = Math.floor(solid.max.x / CELL);
    const z0 = Math.floor(solid.min.z / CELL), z1 = Math.floor(solid.max.z / CELL);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const k = key(ix, iz);
      let c = this.cells.get(k);
      if (!c) { c = []; this.cells.set(k, c); }
      c.push(solid);
    }
  }

  query(minX, minZ, maxX, maxZ, out) {
    const x0 = Math.floor(minX / CELL), x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL), z1 = Math.floor(maxZ / CELL);
    const stamp = (this._stamp = (this._stamp || 0) + 1);
    for (let ix = x0; ix <= x1; ix++) for (let iz = z0; iz <= z1; iz++) {
      const c = this.cells.get(key(ix, iz));
      if (!c) continue;
      for (const s of c) {
        if (s._stamp === stamp) continue;
        s._stamp = stamp;
        out.push(s);
      }
    }
    return out;
  }
}

export function boxOverlap(a, b) {
  return a.min.x < b.max.x && a.max.x > b.min.x &&
    a.min.y < b.max.y && a.max.y > b.min.y &&
    a.min.z < b.max.z && a.max.z > b.min.z;
}

export function bodyBox(pos, half, out = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } }) {
  out.min.x = pos.x - half.x; out.max.x = pos.x + half.x;
  out.min.y = pos.y; out.max.y = pos.y + half.y * 2;
  out.min.z = pos.z - half.z; out.max.z = pos.z + half.z;
  return out;
}

const _cands = [];
const _box = { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };

/**
 * Move a body by (dx,dy,dz) resolving collisions. `dynamic` = array of solids (entity boxes with .solid).
 * Returns { ground, ceiling, wall, hits: [{solid, axis, dir}] }.
 * opts.stepUp: max auto step height when grounded.
 */
export function moveBody(world, pos, half, dx, dy, dz, dynamic, opts = {}) {
  const res = { ground: null, ceiling: null, wall: null, hits: [] };
  const pad = 1.5;
  _cands.length = 0;
  world.query(pos.x - half.x - pad + Math.min(dx, 0), pos.z - half.z - pad + Math.min(dz, 0),
    pos.x + half.x + pad + Math.max(dx, 0), pos.z + half.z + pad + Math.max(dz, 0), _cands);
  if (dynamic) for (const e of dynamic) if (e && e.solid && e.box && !e.dead && !e.intangible) { e.box.__owner = e; _cands.push(e.box); }

  // --- Y
  pos.y += dy;
  bodyBox(pos, half, _box);
  for (const s of _cands) {
    if (!overlapXZ(_box, s)) continue;
    if (_box.min.y >= s.max.y || _box.max.y <= s.min.y) continue;
    if (dy <= 0 && pos.y - dy >= s.max.y - EPS - 0.05) {
      pos.y = s.max.y; res.ground = s; res.hits.push({ solid: s, axis: 'y', dir: -1 });
      bodyBox(pos, half, _box);
    } else if (dy > 0 && !s.oneWay && pos.y + half.y * 2 - dy <= s.min.y + EPS + 0.05) {
      pos.y = s.min.y - half.y * 2; res.ceiling = s; res.hits.push({ solid: s, axis: 'y', dir: 1 });
      bodyBox(pos, half, _box);
    }
  }

  // --- X then Z
  for (const axis of ['x', 'z']) {
    const d = axis === 'x' ? dx : dz;
    if (!d) continue;
    pos[axis] += d;
    bodyBox(pos, half, _box);
    for (const s of _cands) {
      if (s.oneWay) continue;
      if (!(_box.min.x < s.max.x && _box.max.x > s.min.x && _box.min.y < s.max.y - EPS && _box.max.y > s.min.y + EPS &&
        _box.min.z < s.max.z && _box.max.z > s.min.z)) continue;
      // step up small ledges
      const stepH = s.max.y - pos.y;
      if (opts.stepUp && stepH > 0 && stepH <= opts.stepUp && !blockedAbove(_cands, pos, half, s.max.y)) {
        pos.y = s.max.y; res.ground = s; bodyBox(pos, half, _box); continue;
      }
      if (d > 0) pos[axis] = s.min[axis] - half[axis] - EPS;
      else pos[axis] = s.max[axis] + half[axis] + EPS;
      res.wall = s; res.hits.push({ solid: s, axis, dir: Math.sign(d) });
      bodyBox(pos, half, _box);
    }
  }
  return res;
}

function overlapXZ(a, s) {
  return a.min.x < s.max.x - EPS && a.max.x > s.min.x + EPS && a.min.z < s.max.z - EPS && a.max.z > s.min.z + EPS;
}
function blockedAbove(cands, pos, half, y) {
  const b = { min: { x: pos.x - half.x, y: y + EPS, z: pos.z - half.z }, max: { x: pos.x + half.x, y: y + half.y * 2, z: pos.z + half.z } };
  for (const s of cands) if (!s.oneWay && boxOverlap(b, s)) return true;
  return false;
}

/** Highest solid top under (x,z) between yFrom and yFrom-maxDown, for shadows / probes. */
export function groundBelow(world, x, z, yFrom, maxDown = 50, dynamic = null) {
  _cands.length = 0;
  world.query(x - 0.01, z - 0.01, x + 0.01, z + 0.01, _cands);
  if (dynamic) for (const e of dynamic) if (e && e.solid && e.box && !e.dead && !e.intangible) _cands.push(e.box);
  let best = -Infinity;
  for (const s of _cands) {
    if (x < s.min.x || x > s.max.x || z < s.min.z || z > s.max.z) continue;
    if (s.max.y <= yFrom + 0.01 && s.max.y > best && s.max.y >= yFrom - maxDown) best = s.max.y;
  }
  return best;
}
