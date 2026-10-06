// Crash-style follow camera rig. Modes are presets of a few parameters, blended smoothly so zones
// (side-scroll bits, chase sections, boss arenas) can switch without cuts.
import * as THREE from 'three';

export const CAMERA_PRESETS = {
  // classic: behind and above, level runs into the screen (-Z)
  behind: { yaw: 0, dist: 7.2, height: 3.6, lookAhead: 3.2, lookUp: 1.0, lateral: 0.8, fov: 58 },
  // chase: camera ahead of the player looking back (the boulder is behind Lumen)
  front: { yaw: Math.PI, dist: 6.6, height: 2.9, lookAhead: -1.5, lookUp: 1.1, lateral: 0.85, fov: 60 },
  // 2.5D: level runs along +X, camera on +Z
  side: { yaw: 0, travelYaw: -Math.PI / 2, dist: 11, height: 2.4, lookAhead: 2.5, lookUp: 1.2, lateral: 1, fov: 50 },
  // ride: a bit higher and further for speed
  ride: { yaw: 0, dist: 8.4, height: 4.2, lookAhead: 5, lookUp: 0.8, lateral: 0.7, fov: 64 },
  // boss arena: high, looking at the arena centre and the player
  arena: { yaw: 0, dist: 15, height: 10, lookAhead: 0, lookUp: 0.5, lateral: 0.35, fov: 55, arena: true },
};

const KEYS = ['yaw', 'dist', 'height', 'lookAhead', 'lookUp', 'lateral', 'fov'];

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.p = { ...CAMERA_PRESETS.behind };
    this.target = { ...CAMERA_PRESETS.behind };
    this.focus = new THREE.Vector3();
    this.groundY = 0;
    this.center = new THREE.Vector3(); // arena centre
    this.shakeAmt = 0;
    this.shakeT = 0;
    this.forward = new THREE.Vector3(0, 0, -1);
    this.right = new THREE.Vector3(1, 0, 0);
    this._look = new THREE.Vector3();
    this._pos = new THREE.Vector3();
    this._travel = new THREE.Vector3();
    this.reduceMotion = false;
  }

  setMode(mode, overrides = {}) {
    const base = CAMERA_PRESETS[mode] || CAMERA_PRESETS.behind;
    this.target = { ...base, ...overrides };
    if (overrides.center) this.center.set(...overrides.center);
  }

  snap(player) {
    this.p = { ...this.target };
    this.focus.copy(player.pos);
    this.groundY = player.pos.y;
    this.update(player, 1 / 60, true);
  }

  shake(amount) { if (!this.reduceMotion) this.shakeAmt = Math.min(1.2, Math.max(this.shakeAmt, amount)); }

  update(player, dt, instant = false) {
    const k = instant ? 1 : 1 - Math.exp(-dt * 3.2);
    for (const key of KEYS) {
      if (key === 'yaw') {
        let d = this.target.yaw - this.p.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        this.p.yaw += d * k;
      } else this.p[key] += (this.target[key] - this.p[key]) * k;
    }
    const p = this.p;
    const yaw = p.yaw;
    // basis: forward is the direction the level "goes" for this camera
    this.forward.set(-Math.sin(yaw), 0, -Math.cos(yaw));
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    // vertical focus: follow the ground height, not the jump arc (unless far away)
    if (player.grounded || player.pos.y < this.groundY) this.groundY += (player.pos.y - this.groundY) * (instant ? 1 : 1 - Math.exp(-dt * 5));
    else if (player.pos.y - this.groundY > 4) this.groundY += (player.pos.y - 4 - this.groundY) * (1 - Math.exp(-dt * 4));

    const fk = instant ? 1 : 1 - Math.exp(-dt * 7);
    if (this.target.arena) {
      // arena: blend between centre and player
      this._look.copy(this.center).lerp(player.pos, p.lateral);
      this.focus.lerp(this._look, fk);
    } else {
      // along the forward axis follow tightly; laterally follow partially (Crash-like)
      const fx = player.pos.x, fz = player.pos.z;
      const along = fx * this.forward.x + fz * this.forward.z;
      const side = fx * this.right.x + fz * this.right.z;
      const cAlong = this.focus.x * this.forward.x + this.focus.z * this.forward.z;
      const cSide = this.focus.x * this.right.x + this.focus.z * this.right.z;
      const nAlong = cAlong + (along - cAlong) * (instant ? 1 : 1 - Math.exp(-dt * 10));
      const nSide = cSide + (side * p.lateral + (this.target.anchorSide ?? side) * (1 - p.lateral) - cSide) * fk;
      this.focus.x = this.forward.x * nAlong + this.right.x * nSide;
      this.focus.z = this.forward.z * nAlong + this.right.z * nSide;
    }
    this.focus.y = this.groundY;

    const ty = this.target.travelYaw ?? yaw;
    this._travel.set(-Math.sin(ty), 0, -Math.cos(ty));
    this._look.copy(this.focus).addScaledVector(this._travel, p.lookAhead);
    this._look.y += p.lookUp;
    this._pos.copy(this.focus).addScaledVector(this.forward, -p.dist);
    this._pos.y += p.height;

    if (this.shakeAmt > 0.001) {
      this.shakeT += dt * 40;
      const a = this.shakeAmt * 0.35;
      this._pos.x += Math.sin(this.shakeT * 1.3) * a;
      this._pos.y += Math.sin(this.shakeT * 1.7 + 1) * a;
      this.shakeAmt *= Math.exp(-dt * 6);
    }
    this.camera.position.copy(this._pos);
    this.camera.lookAt(this._look);
    if (Math.abs(this.camera.fov - p.fov) > 0.01) { this.camera.fov = p.fov; this.camera.updateProjectionMatrix(); }
  }

  /** Map a stick vector (x right, y up) to a world XZ direction relative to the camera. */
  toWorld(mx, my, out) {
    out.x = this.right.x * mx + this.forward.x * my;
    out.z = this.right.z * mx + this.forward.z * my;
    return out;
  }
}
