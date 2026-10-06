// Game session: lives, lights (the "wumpa" of this knock-off), Oku Oku masks, powers, time trial clock.
// Exposed to entities as ctx.game (see docs/CONTRACTS.md).
import { bus } from '../core/events.js';
import { writeSave } from './save.js';

export const POWERS_BY_BOSS = { B1: 'doubleJump', B2: 'tornado', B3: 'superSlam', B4: 'turbo' };
export const INVINCIBLE_TIME = 16;

export class Game {
  constructor(save) {
    this.save = save;
    this.lives = save.lives ?? 5;
    this.lights = save.lights ?? 0;
    this.masks = 0;
    this.timeTrial = false;
    this.timer = 0;
    this.freezeT = 0;
    this.invincibleT = 0;
    this.level = null;   // runtime Level, set by Level itself
    this.player = null;
  }

  get scarfColor() { return this.save.scarf ?? null; }
  get lang() { return this.save.lang || 'fr'; }

  hasPower(name) { return this.save.powers.includes(name); }

  unlockPower(name) {
    if (!name || this.hasPower(name)) return false;
    this.save.powers.push(name);
    writeSave(this.save);
    bus.emit('power:unlock', { power: name });
    bus.emit('sfx', { name: 'power_unlock' });
    return true;
  }

  addLights(n = 1) {
    this.lights += n;
    if (this.level) this.level.stats.lights += n;
    let lives = 0;
    while (this.lights >= 100) { this.lights -= 100; lives++; }
    bus.emit('hud:lights', { value: this.lights });
    if (lives) this.addLife(lives);
  }

  addLife(n = 1) {
    this.lives = Math.min(99, this.lives + n);
    bus.emit('hud:lives', { value: this.lives });
    bus.emit('sfx', { name: 'life' });
  }

  addMask() {
    if (this.masks >= 3) { this.invincibleT = INVINCIBLE_TIME; return; }
    this.masks++;
    bus.emit('hud:masks', { value: this.masks });
    if (this.masks === 3) {
      this.invincibleT = INVINCIBLE_TIME;
      bus.emit('sfx', { name: 'mask_invincible' });
      bus.emit('music:mod', { invincible: true });
      bus.emit('toast', { text: { fr: 'MODE DISCO ! Oku Oku est en feu.', en: 'DISCO MODE! Oku Oku is on fire.' }, kind: 'big' });
    } else bus.emit('sfx', { name: 'mask_get' });
  }

  get invincible() { return this.masks >= 3; }

  /** Damage from an enemy/hazard: lose a mask or die. */
  hurt(cause = 'generic') {
    const p = this.player;
    if (!p || p.dead || p.celebrating) return false;
    if (this.invincible && cause !== 'fall' && cause !== 'water') return false;
    if (p.hurtT > 0) return false;
    if (this.masks > 0) {
      this.masks--;
      bus.emit('hud:masks', { value: this.masks });
      bus.emit('sfx', { name: 'mask_lose' });
      bus.emit('shake', { amount: 0.3 });
      p.hurtFlash(1.6);
      return true;
    }
    this.kill(cause);
    return true;
  }

  /** Instant death (pits, water, crushers). Invincibility still saves you from enemies, not from pits. */
  kill(cause = 'generic') {
    const p = this.player;
    if (!p || p.dead || p.celebrating) return;
    if (this.invincible && !['fall', 'water', 'squash'].includes(cause)) return;
    if (p.hurtT > 0 && !['fall', 'water', 'squash'].includes(cause)) return;
    this.level?.playerDied(cause);
  }

  loseMasksOnDeath() {
    this.masks = 0;
    this.invincibleT = 0;
    bus.emit('hud:masks', { value: 0 });
    bus.emit('music:mod', { invincible: false });
  }

  freezeTimer(seconds) {
    this.freezeT += seconds;
    bus.emit('sfx', { name: 'time_freeze' });
  }

  update(dt) {
    if (this.invincibleT > 0) {
      this.invincibleT -= dt;
      if (this.invincibleT <= 0 && this.masks >= 3) {
        this.masks = 2;
        bus.emit('hud:masks', { value: 2 });
        bus.emit('music:mod', { invincible: false });
      }
    }
    if (this.timeTrial && this.level && !this.level.finished && !this.player?.dead) {
      if (this.freezeT > 0) this.freezeT = Math.max(0, this.freezeT - dt);
      else this.timer += dt;
      bus.emit('hud:timer', { t: this.timer, frozen: this.freezeT > 0 });
    }
  }

  persist() {
    this.save.lives = Math.max(this.lives, 0);
    this.save.lights = this.lights;
    writeSave(this.save);
  }
}
