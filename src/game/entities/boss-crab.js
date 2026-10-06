// B1 — Papa Crabe Royal (île 1, plage). Pinces géantes télescopiques qui frappent le sable (ondes de choc à sauter),
// charge latérale (phase 2+), bébés crabes (phase 3). Vulnérable quand une pince reste coincée dans le sable :
// il se penche, on saute sur sa couronne en coquillage.
import * as THREE from 'three';
import { BossBase, mk, grp, std, googly, wobbleEye, cylBetween, setBox, aabb, rand, clamp, t2, pick, damp, TAU } from './boss-kit.js';

const CFG = {
  name: t2('Papa Crabe Royal', 'King Papa Crab'), speaker: 'crab', hitsPerPhase: [2, 2, 2], defeatTime: 3.2,
};
const TUNE = {
  raise: [1.1, 0.85, 0.7], wave: [6, 7.5, 9], stuck: [4.6, 4.0, 3.5], charge: [12, 13, 16], wind: [1.2, 1.1, 0.85],
  walk: [3.6, 4.4, 5.4], babies: [0, 0, 3],
};
const SCRIPTS = [
  ['slam', 'slam', 'slamStuck'],
  ['charge', 'slam', 'slamStuck'],
  ['summon', 'charge', 'slamDouble', 'slamStuck'],
];
const L = {
  intro: t2('Qui ose marcher sur MA plage sans payer le parking ?', 'Who dares walk on MY beach without paying for parking?'),
  oku: t2('Conseil d\'Oku Oku : les crabes adorent les câlins. Va le serrer fort !', 'Oku Oku tip: crabs love hugs. Go squeeze him!'),
  hint: t2('Sa pince est coincée ! Saute sur sa couronne ! (Celui-là, il est gratuit.)', 'His claw is stuck! Jump on his crown! (That one\'s free.)'),
  stuck: [t2('Euh… c\'est le sable qui me retient, pas moi.', 'Uh… the sand is holding me, not the other way round.'),
    t2('Personne ne regarde, d\'accord ?', 'Nobody\'s looking, okay?'),
    t2('Pince coincée. Dignité aussi.', 'Claw stuck. Dignity too.')],
  free: t2('Ha ! Libéré ! Vous avez rien vu.', 'Ha! Free! You saw nothing.'),
  ouch: [t2('AÏE ! Ma couronne de collection !', 'OUCH! My collector\'s crown!'),
    t2('Pas la couronne ! Elle est de location !', 'Not the crown! It\'s a rental!'),
    t2('Ça pince, hein ? Ah non, c\'est moi qui pince d\'habitude.', 'Pinches, huh? Wait, I\'m the one who pinches.')],
  rage1: t2('Bon. Papa se fâche. Papa fait des CHARGES LATÉRALES.', 'Right. Papa\'s mad. Papa does SIDEWAYS CHARGES.'),
  rage2: t2('Les enfants ! Venez aider Papa !', 'Kids! Come help Papa!'),
  charge: [t2('Attention, j\'arrive de côté ! C\'est ma spécialité !', 'Watch out, coming in sideways! My speciality!'),
    t2('Charge royale ! Écartez-vous, roturier !', 'Royal charge! Make way, peasant!')],
  summon: t2('Les enfants ! Pincez-le ! Mais poliment !', 'Kids! Pinch him! But politely!'),
  taunt: t2('Hé hé ! Le sable, c\'est mon terrain.', 'Heh heh! Sand is my turf.'),
  defeat: t2('Bon… gardez la plage. Je retourne vivre chez ma mère.', 'Fine… keep the beach. I\'m moving back in with my mom.'),
};

export function createCrabKing(def, ctx) {
  return new CrabKing(def, ctx).entity;
}

class CrabKing extends BossBase {
  constructor(def, ctx) {
    super(def, ctx, CFG);
    this.scripts = SCRIPTS;
    this.hitModes = { stomp: true, spin: false, slam: true };
    this.bodyBox = aabb();
    this.body = [this.bodyBox];
    this.moveSpeed = 0;
    this.lean = 0;
    this.sink = 0;
    this.anger = 0;
    this.build();
    this.sink = 3.2;
    this.go('intro');
  }

  // ------------------------------------------------------------------ model
  build() {
    const g = this.geo;
    const q = this.ctx.quality?.level ?? 1;
    this.mats = {
      shell: std(0xe2553a, { rough: 0.45 }), shellDark: std(0xb73a28, { rough: 0.5 }), belly: std(0xf6b48b),
      white: std(0xffffff, { rough: 0.3 }), black: std(0x111111, { rough: 0.2 }), stache: std(0x4a2a1a),
      crown: std(0xfbe7c6, { rough: 0.35 }), pink: std(0xff9fb8, { rough: 0.4 }), pearl: std(0xf8f4ff, { rough: 0.15, metal: 0.2 }),
      gold: std(0xffcc4d, { rough: 0.3, metal: 0.6 }), flag: std(0xffffff, { side: THREE.DoubleSide }), stick: std(0x8a5a32),
      tip: std(0xffd6c2), baby: std(0xff6b4a),
    };
    const m = this.mats;
    this.bodyG = grp(this.model);
    const b = this.bodyG;
    mk(g.sphere, m.shell, b, 0, 1.5, 0, [1.75, 0.95, 1.3]);
    mk(g.sphere, m.belly, b, 0, 1.2, 0.2, [1.55, 0.6, 1.15]);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      mk(g.sphereLo, m.shellDark, b, Math.cos(a) * 0.9, 2.25, Math.sin(a) * 0.6 - 0.1, 0.22);
    }
    // eye stalks + googly eyes
    this.eyes = [];
    for (const s of [-1, 1]) {
      cylBetween(mk(g.cyl, m.shell, b), new THREE.Vector3(s * 0.45, 2.1, 0.75), new THREE.Vector3(s * 0.62, 2.85, 0.95), 0.1);
      this.eyes.push(googly(b, g, m, 0.34, s * 0.64, 3.0, 0.98));
      const brow = mk(g.box, m.stache, b, s * 0.64, 3.4, 1.15, [0.55, 0.1, 0.1]);
      brow.rotation.z = -s * 0.25;
      (this.brows ||= []).push(brow);
    }
    // mustache + mouth
    for (const s of [-1, 1]) {
      const st = mk(g.sphere, m.stache, b, s * 0.34, 1.6, 1.24, [0.38, 0.11, 0.13]);
      st.rotation.z = s * 0.35;
      const curl = mk(g.arcHalf, m.stache, b, s * 0.74, 1.8, 1.16, [0.13, 0.13, 0.4]);
      curl.rotation.z = s > 0 ? -0.6 : Math.PI + 0.6;
    }
    const mouth = mk(g.arcHalf, m.black, b, 0, 1.38, 1.26, [0.28, 0.18, 0.2]);
    mouth.rotation.z = Math.PI;
    // crown of shells
    this.crown = grp(b, 0, 2.38, 0.1);
    mk(g.torus, m.crown, this.crown, 0, 0, 0, [0.62, 0.62, 0.5]).rotation.x = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const sh = mk(g.cone6, i % 2 ? m.pink : m.crown, this.crown, Math.cos(a) * 0.6, 0.32, Math.sin(a) * 0.6, [0.17, 0.6, 0.17]);
      sh.rotation.z = -Math.cos(a) * 0.25; sh.rotation.x = Math.sin(a) * 0.25;
      mk(g.sphereLo, m.pearl, this.crown, Math.cos(a) * 0.66, 0.66, Math.sin(a) * 0.66, 0.09);
    }
    mk(g.sphere, m.pearl, this.crown, 0, 0.35, 0, 0.24);
    // legs (3 per side)
    this.legs = [];
    for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
      const z = -0.6 + i * 0.55;
      const leg = grp(b, s * 1.3, 1.1, z);
      const knee = new THREE.Vector3(s * 0.9, 0.55, 0), foot = new THREE.Vector3(s * 1.35, -1.1, 0.05);
      cylBetween(mk(g.cyl, m.shell, leg), new THREE.Vector3(0, 0, 0), knee, 0.12);
      cylBetween(mk(g.cyl, m.shellDark, leg), knee, foot, 0.09);
      mk(g.sphereLo, m.shellDark, leg, knee.x, knee.y, knee.z, 0.14);
      this.legs.push({ g: leg, s, i });
    }
    // claws (world space, telescopic arms)
    this.claws = [-1, 1].map((s) => this.makeClaw(s));
    // white flag (defeat)
    this.flag = grp(null);
    cylBetween(mk(g.cyl, m.stick, this.flag), new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2.2, 0), 0.05);
    this.flagCloth = mk(g.plane, m.flag, this.flag, 0.5, 1.85, 0, [1.0, 0.65, 1]);
    this.flag.visible = false;
    this.extraDispose.push(this.flag);
    this.model.traverse((o) => { if (o.isMesh) o.castShadow = q >= 2; });
    this.makeBabyTemplate();
  }

  makeClaw(side) {
    const g = this.geo, m = this.mats;
    const grpC = grp(this.root);
    const pincer = grp(grpC);
    mk(g.sphere, m.shell, pincer, 0, 0, 0.1, [0.78, 0.62, 0.82]);
    const up = grp(pincer, 0, 0.18, 0.5);
    mk(g.sphere, m.shell, up, 0, 0.1, 0.62, [0.58, 0.32, 0.95]);
    mk(g.cone, m.tip, up, 0, 0.08, 1.55, [0.18, 0.4, 0.18]).rotation.x = Math.PI / 2;
    const lo = grp(pincer, 0, -0.18, 0.5);
    mk(g.sphere, m.shellDark, lo, 0, -0.06, 0.52, [0.46, 0.26, 0.8]);
    mk(g.cone, m.tip, lo, 0, -0.04, 1.3, [0.14, 0.32, 0.14]).rotation.x = Math.PI / 2;
    const arm = mk(g.cyl, m.shell, this.root);
    const c = {
      side, group: grpC, pincer, up, lo, arm,
      pos: new THREE.Vector3(this.pos.x + side * 2, this.floor + 1, this.pos.z + 1.6), goal: new THREE.Vector3(), rate: 6,
      mode: 'rest', sub: 'idle', subT: 0, target: new THREE.Vector3(), delay: 0, stick: false, open: 0.3,
      shoulderLocal: new THREE.Vector3(side * 1.5, 1.55, 0.55), restLocal: new THREE.Vector3(side * 2.15, 0.95, 1.75),
      shoulder: new THREE.Vector3(), box: aabb(), mark: null,
    };
    c.box.cause = 'squash';
    this.body.push(c.box);
    return c;
  }

  makeBabyTemplate() {
    const g = this.geo, m = this.mats;
    const t = new THREE.Group();
    mk(g.sphere, m.baby, t, 0, 0.32, 0, [0.38, 0.24, 0.3]);
    for (const s of [-1, 1]) {
      mk(g.sphereLo, m.baby, t, s * 0.4, 0.32, 0.25, [0.14, 0.11, 0.18]);
      mk(g.sphereLo, m.white, t, s * 0.12, 0.6, 0.2, 0.09);
      mk(g.sphereLo, m.black, t, s * 0.12, 0.6, 0.27, 0.045);
      for (let i = 0; i < 2; i++) cylBetween(mk(g.cyl, m.shellDark, t), new THREE.Vector3(s * 0.25, 0.3, -0.1 + i * 0.18), new THREE.Vector3(s * 0.5, 0, -0.1 + i * 0.18), 0.04);
    }
    mk(g.torus, m.gold, t, 0, 0.56, -0.02, [0.13, 0.13, 0.2]).rotation.x = Math.PI / 2;
    this.babyTpl = t;
    this.extraDispose.push(t);
  }

  // ------------------------------------------------------------------ AI
  onBegin() {}
  onEnter(state) {
    this.vulnerable = false;
    this.contactHurts = !['ouch', 'rage', 'intro', 'regroup'].includes(state);
    if (state === 'slam' || state === 'slamStuck' || state === 'slamDouble') {
      this.slamPlan = { stuck: state === 'slamStuck', double: state === 'slamDouble', started: false };
    }
  }

  think(dt) {
    const a = this.arena, p = this.player;
    this.moveSpeed = damp(this.moveSpeed, 0, 6, dt);
    switch (this.state) {
      case 'intro':
        this.sink = Math.max(0, 3.2 * (1 - this.st / 1.0));
        if (this.every(0.18) && this.st < 1.1) this.burst(this.pos, [0xf2d39a, 0xe8c27d], 10, { speed: 5 });
        if (this.at(0.2)) this.say(L.intro);
        if (this.at(1.1)) { this.sfx('boss_roar'); this.shake(0.6); }
        if (this.at(2.2)) this.say(L.oku, 'oku');
        this.facePlayer(dt, 3);
        if (this.st > 3.4) this.next();
        break;
      case 'regroup':
        this.walkTo(this.home.x, this.home.z, dt, 6);
        this.facePlayer(dt);
        if (this.at(0.2)) this.say(L.taunt);
        if (this.st > 1.6) this.next();
        break;
      case 'slam': case 'slamStuck': case 'slamDouble':
        this.thinkSlam(dt);
        break;
      case 'stuck': {
        this.vulnerable = this.st > 0.25;
        if (this.at(0.3)) {
          if (!this.saidOnce.has('hint')) this.sayOnce('hint', L.hint, 'oku');
          else this.say(pick(L.stuck));
        }
        if (this.every(0.4)) this.burst(this.stuckClaw.pos, [0xf2d39a, 0xe8c27d], 5, { speed: 3 });
        if (this.every(0.9, 0.5)) this.sfx('rumble', { vol: 0.4 });
        if (this.st > this.pp(TUNE.stuck)) this.go('unstuck');
        break;
      }
      case 'unstuck':
        if (this.at(0)) { this.stuckClaw.mode = 'rest'; this.stuckClaw.sub = 'idle'; this.burst(this.stuckClaw.pos, [0xf2d39a, 0xe8c27d], 16, { speed: 6 }); this.say(L.free); }
        if (this.st > 0.7) this.next();
        break;
      case 'ouch':
        if (this.at(0)) {
          this.say(pick(L.ouch));
          for (const c of this.claws) { c.mode = 'rest'; c.sub = 'idle'; if (c.mark) { c.mark.done(); c.mark = null; } }
        }
        this.walkTo(this.home.x, this.home.z, dt, 2.5);
        if (this.st > 1.9) { if (this.pendingRage) this.go('rage'); else this.next(); }
        break;
      case 'rage':
        if (this.at(0.15)) { this.sfx('boss_roar'); this.shake(0.7); this.say(this.phase === 1 ? L.rage1 : L.rage2); }
        if (this.every(0.2) && this.st < 1.4) this.burst(_tmp.set(this.pos.x, this.floor + 3.2, this.pos.z), [0xffffff, 0xdddddd], 4, { speed: 3, up: 4 });
        this.facePlayer(dt);
        if (this.st > 2.0) { this.pendingRage = false; this.next(); }
        break;
      case 'charge': this.thinkCharge(dt); break;
      case 'summon':
        this.facePlayer(dt);
        if (this.at(0.1)) { this.say(L.summon); this.sfx('honk', { pitch: 1.3 }); }
        if (this.at(0.5)) this.sfx('honk', { pitch: 1.6 });
        if (this.at(0.8)) this.spawnBabies(this.pp(TUNE.babies) || 3);
        if (this.st > 1.6) this.next();
        break;
      default: this.next();
    }
    // stay in the arena
    this.clampArena(this.pos, 2.2);
    void a; void p;
  }

  walkTo(x, z, dt, speed) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.1) return true;
    const step = Math.min(d, speed * dt);
    this.pos.x += dx / d * step; this.pos.z += dz / d * step;
    this.moveSpeed = speed;
    return d < 0.3;
  }

  thinkSlam(dt) {
    const plan = this.slamPlan;
    const p = this.player;
    this.facePlayer(dt, 4);
    if (!plan.started) {
      const d = this.distToPlayerXZ();
      if (d > 6 && this.st < 1.4) { this.walkTo(p.pos.x, p.pos.z, dt, this.pp(TUNE.walk)); return; }
      plan.started = true;
      // choose the claw on the player's side
      const right = Math.cos(this.yaw) * (p.pos.x - this.pos.x) - Math.sin(this.yaw) * (p.pos.z - this.pos.z);
      const first = this.claws[right >= 0 ? 1 : 0];
      const second = this.claws[right >= 0 ? 0 : 1];
      this.startClawSlam(first, 0, plan.stuck && !plan.double);
      if (plan.double) this.startClawSlam(second, 0.45, false, 2.6);
      return;
    }
    let busy = false;
    for (const c of this.claws) {
      if (c.sub === 'idle') continue;
      busy = true;
      this.updateClawSlam(c, dt);
      if (c.sub === 'stuck') { this.stuckClaw = c; this.go('stuck'); return; }
    }
    if (!busy) this.next();
  }

  startClawSlam(c, delay, stick, offset = 0) {
    c.sub = 'wait'; c.subT = 0; c.delay = delay; c.stick = stick;
    this.aimPoint(0.25, c.target);
    if (offset) { const a = rand(0, TAU); c.target.x += Math.cos(a) * offset; c.target.z += Math.sin(a) * offset; }
    // reach limit: 7.5 m from the body
    const dx = c.target.x - this.pos.x, dz = c.target.z - this.pos.z, d = Math.hypot(dx, dz);
    if (d > 7.5) { c.target.x = this.pos.x + dx / d * 7.5; c.target.z = this.pos.z + dz / d * 7.5; }
    this.clampArena(c.target, 1);
    c.target.y = this.floor;
  }

  updateClawSlam(c, dt) {
    c.subT += dt;
    const raiseT = this.pp(TUNE.raise);
    switch (c.sub) {
      case 'wait':
        if (c.subT >= c.delay) {
          c.sub = 'raise'; c.subT = 0; c.mode = 'raise';
          c.mark = this.mark(c.target.x, c.target.z, 1.5, 0xff3b3b, raiseT + 0.2);
          this.sfx('wind', { vol: 0.5 });
        }
        break;
      case 'raise':
        if (this.phase >= 2 && c.subT < raiseT * 0.4 && !c.stick) {
          // phase 3: the claw keeps tracking a bit
          this.aimPoint(0.2, _tmp);
          c.target.x = damp(c.target.x, _tmp.x, 3, dt); c.target.z = damp(c.target.z, _tmp.z, 3, dt);
          c.mark?.mesh.position.set(c.target.x, this.floor + 0.05, c.target.z);
        }
        c.goal.set(c.target.x + Math.sin(this.time * 40) * 0.08, this.floor + 4.4, c.target.z);
        c.rate = 7; c.open = 0.7;
        if (c.subT >= raiseT) { c.sub = 'down'; c.subT = 0; c.mode = 'down'; }
        break;
      case 'down':
        c.goal.set(c.target.x, this.floor + 0.3, c.target.z);
        c.rate = 40; c.open = 0.1;
        if (c.subT >= 0.1) {
          c.pos.copy(c.goal);
          if (c.mark) { c.mark.done(); c.mark = null; }
          this.shake(0.5);
          this.sfx('slam', { pos: c.pos });
          this.burst(c.pos, [0xf2d39a, 0xe8c27d, 0xffffff], 22, { speed: 7 });
          this.wave({ x: c.target.x, z: c.target.z, speed: this.pp(TUNE.wave), maxR: 13, width: 0.8, height: 0.55, color: 0xfff0c8 });
          const p = this.player;
          if (Math.hypot(p.pos.x - c.target.x, p.pos.z - c.target.z) < 1.5 && p.pos.y < this.floor + 1.3) this.hurtPlayer('squash', c.target);
          if (c.stick) { c.sub = 'stuck'; c.mode = 'stuck'; } else { c.sub = 'recover'; c.subT = 0; }
        }
        break;
      case 'recover':
        c.goal.copy(c.target); c.goal.y = this.floor + 0.3;
        if (c.subT > 0.45) { c.sub = 'idle'; c.mode = 'rest'; }
        break;
    }
  }

  thinkCharge(dt) {
    const a = this.arena, p = this.player;
    const P = (this.cp ||= {});
    if (this.at(0)) {
      const z = clamp(p.pos.z, a.z - 6, a.z + 6);
      const half = Math.sqrt(Math.max(4, (a.r - 2.3) ** 2 - (z - a.z) ** 2));
      const side = this.pos.x >= a.x ? 1 : -1;
      Object.assign(P, { z, startX: a.x + side * half, endX: a.x - side * half, sub: 'move', t: 0, runs: this.phase >= 2 ? 2 : 1, mark: null });
    }
    P.t += dt;
    this.faceTo(this.pos.x, this.pos.z + 5, dt, 5); // a crab charges sideways, staring at you
    switch (P.sub) {
      case 'move':
        if (this.walkTo(P.startX, P.z, dt, 9) || P.t > 1.8) {
          P.sub = 'wind'; P.t = 0;
          P.mark = this.lineMark(P.startX, P.z, P.endX, P.z, 3.4, 0xff3b3b, this.pp(TUNE.wind) + 0.1);
          if (P.runs === 2 || this.phase < 2) this.say(pick(L.charge));
          this.sfx('boss_roar', { vol: 0.5, pitch: 1.4 });
        }
        break;
      case 'wind':
        if (this.every(0.15)) this.burst(_tmp.set(this.pos.x, this.floor, this.pos.z), [0xf2d39a, 0xe8c27d], 6, { speed: 4 });
        this.moveSpeed = 14; // legs scrabbling
        if (P.t > this.pp(TUNE.wind)) { P.sub = 'run'; P.t = 0; this.sfx('rumble'); }
        break;
      case 'run': {
        const sp = this.pp(TUNE.charge);
        const dir = Math.sign(P.endX - this.pos.x);
        this.pos.x += dir * sp * dt;
        this.pos.z = P.z;
        this.moveSpeed = sp;
        if (this.every(0.08)) this.burst(_tmp.set(this.pos.x, this.floor, this.pos.z), [0xf2d39a, 0xe8c27d], 4, { speed: 3 });
        if ((dir > 0 && this.pos.x >= P.endX) || (dir < 0 && this.pos.x <= P.endX) || P.t > 3) {
          this.pos.x = P.endX;
          P.sub = 'bonk'; P.t = 0;
          this.shake(0.4); this.sfx('crate_iron', { pos: this.pos });
          this.burst(_tmp.set(this.pos.x, this.floor + 3, this.pos.z), [0xffe066, 0xffffff], 12, { speed: 4, up: 3 });
        }
        break;
      }
      case 'bonk':
        this.dizzy = true;
        if (P.t > 0.75) {
          this.dizzy = false;
          P.runs--;
          if (P.runs > 0) {
            const s = P.startX; P.startX = P.endX; P.endX = s;
            P.sub = 'wind'; P.t = 0.35;
            P.mark = this.lineMark(P.startX, P.z, P.endX, P.z, 3.4, 0xff3b3b, this.pp(TUNE.wind) - 0.25);
          } else this.next();
        }
        break;
    }
  }

  spawnBabies(n) {
    const a = this.arena, p = this.player;
    const alive = this.minions.filter((m) => !m.dead).length;
    for (let i = 0; i < Math.min(n, 4 - alive); i++) {
      let x = 0, z = 0;
      for (let k = 0; k < 8; k++) {
        const ang = rand(0, TAU);
        x = a.x + Math.cos(ang) * (a.r - 1.5); z = a.z + Math.sin(ang) * (a.r - 1.5);
        if (Math.hypot(x - p.pos.x, z - p.pos.z) > 4) break;
      }
      const mesh = this.babyTpl.clone();
      mesh.scale.setScalar(1.25);
      const mn = this.minion({ mesh, pos: new THREE.Vector3(x, this.floor + 0.5, z), r: 0.45, h: 0.75, speed: 3.1 + i * 0.25, life: 15, wake: 0.6, color: 0xff6b4a });
      mn.anim = (m, dt2, boss) => { m.mesh.children[0].position.y = 0.32 + Math.abs(Math.sin(boss.time * 14 + m.age)) * 0.06; };
      this.burst(mn.pos, [0xf2d39a, 0xe8c27d], 10, { speed: 4 });
    }
    this.sfx('crumble');
  }

  // ------------------------------------------------------------------ hits / reset / defeat
  onHit(how, phaseUp) {
    this.pendingRage = phaseUp;
    this.crownPopT = 0;
    this.go('ouch');
  }

  onReset() {
    this.pos.copy(this.home);
    this.sink = 0; this.lean = 0; this.dizzy = false; this.pendingRage = false;
    for (const c of this.claws) { c.mode = 'rest'; c.sub = 'idle'; c.mark = null; }
    this.go('regroup');
  }

  onDefeat() {
    for (const c of this.claws) { c.mode = 'rest'; c.sub = 'idle'; }
    this.go('defeat');
    this.flag.visible = false;
    this.root.add(this.flag);
  }

  defeatAnim(dt, t) {
    const b = this.bodyG;
    // hop and flip onto its back
    const k = clamp(t / 0.7, 0, 1);
    b.rotation.z = k * Math.PI;
    b.position.y = Math.sin(k * Math.PI) * 2 + k * 2.6;
    this.sink = 0; this.lean = 0;
    for (const l of this.legs) l.g.rotation.z = Math.sin(t * 30 + l.i) * 0.5;
    if (this.at(0.25)) this.say(L.defeat);
    if (this.at(0.7)) { this.shake(0.6); this.sfx('land'); this.burst(this.pos, [0xf2d39a, 0xe8c27d], 30, { speed: 7 }); }
    if (this.at(0.9)) this.confetti(_tmp.set(this.pos.x, this.floor + 2, this.pos.z), 50);
    // the crown rolls away
    this.crown.position.y = 2.38 + Math.min(t, 1.2) * 0.8;
    this.crown.rotation.z += dt * 6;
    // white flag
    if (t > 1.1) {
      this.flag.visible = true;
      const c = this.claws[1];
      this.flag.position.copy(c.pos);
      this.flag.rotation.z = Math.sin(t * 5) * 0.2;
      this.flagCloth.rotation.y = Math.sin(t * 9) * 0.4;
    }
    for (const c of this.claws) c.goal.set(this.pos.x + c.side * 2.2, this.floor + 2.6 + Math.sin(t * 8 + c.side) * 0.4, this.pos.z + 0.8);
  }

  // ------------------------------------------------------------------ visuals + hit boxes
  animate(dt) {
    const t = this.time, b = this.bodyG;
    const stuck = this.state === 'stuck';
    this.sink = damp(this.sink, stuck ? 0.95 : (this.state === 'intro' ? this.sink : 0), stuck ? 8 : 5, dt);
    this.lean = damp(this.lean, stuck ? 0.3 : 0, 6, dt);
    if (this.state !== 'defeat') {
      b.position.y = -this.sink + Math.sin(t * 3) * 0.04;
      b.rotation.x = this.lean + (this.state === 'ouch' ? Math.sin(t * 30) * 0.06 : 0);
      b.rotation.z = (this.state === 'rage' ? Math.sin(t * 25) * 0.05 : 0) + (stuck ? Math.sin(t * 9) * 0.06 : 0);
      for (const l of this.legs) {
        const sp = Math.min(1, this.moveSpeed / 6);
        l.g.rotation.z = Math.sin(t * (6 + this.moveSpeed * 2) + l.i * 2 + (l.s > 0 ? 1 : 0)) * 0.35 * sp * l.s + (stuck ? -l.s * 0.35 : 0);
      }
    }
    // anger tint
    this.anger = damp(this.anger, this.phase / 2, 2, dt);
    this.mats.shell.color.setHex(0xe2553a).lerp(_col.setHex(0xc0202a), this.anger);
    this.mats.shell.emissive.setHex(0x330000).multiplyScalar(this.anger);
    for (let i = 0; i < 2; i++) this.brows[i].rotation.z = (i ? 1 : -1) * (-0.2 + this.anger * 0.6);
    const dizzy = this.dizzy || this.state === 'ouch' || this.state === 'defeat';
    for (const e of this.eyes) wobbleEye(e, t, 1, dizzy);
    // crown pop when hit
    if (this.state === 'ouch') {
      const k = this.st;
      this.crown.position.y = 2.38 + Math.max(0, 9 * k - 7 * k * k) * 0.9;
      this.crown.rotation.y += dt * 14;
      this.crown.rotation.z = k < 1.2 ? Math.sin(k * 10) * 0.3 : damp(this.crown.rotation.z, 0.25, 5, dt);
    } else if (this.state !== 'defeat') {
      this.crown.position.y = damp(this.crown.position.y, 2.38, 8, dt);
      this.crown.rotation.y = damp(this.crown.rotation.y % TAU, 0, 3, dt);
    }
    // model transform now (the claws need world-space shoulders this frame)
    this.model.position.copy(this.pos);
    this.model.rotation.y = this.yaw;
    this.model.updateMatrixWorld(true);
    for (const c of this.claws) this.animateClaw(c, dt);
    // hit boxes
    const top = stuck ? 1.25 : 2.5 - this.sink;
    setBox(this.bodyBox, this.pos.x, this.floor, this.pos.z, 1.55, Math.max(0.5, top), 1.55);
    this.crown.getWorldPosition(_tmp);
    setBox(this.weak, _tmp.x, _tmp.y - 0.5, _tmp.z, 0.95, 1.05, 0.95);
  }

  animateClaw(c, dt) {
    c.shoulder.copy(c.shoulderLocal);
    this.bodyG.localToWorld(c.shoulder);
    if (c.mode === 'rest' && this.state !== 'defeat') {
      c.goal.copy(c.restLocal);
      c.goal.y += Math.sin(this.time * 2 + c.side) * 0.1 + (this.state === 'rage' || this.state === 'summon' ? 1.6 : 0);
      this.bodyG.localToWorld(c.goal);
      c.rate = 6;
      c.open = 0.25 + Math.max(0, Math.sin(this.time * 3 + c.side * 2)) * 0.4;
    }
    if (c.mode === 'stuck') {
      c.goal.set(c.target.x + Math.sin(this.time * 22) * 0.06, this.floor - 0.35, c.target.z);
      c.rate = 20;
      c.open = 0.05;
    }
    c.pos.x = damp(c.pos.x, c.goal.x, c.rate, dt);
    c.pos.y = damp(c.pos.y, c.goal.y, c.rate, dt);
    c.pos.z = damp(c.pos.z, c.goal.z, c.rate, dt);
    c.group.position.copy(c.pos);
    // pincer orientation: forward at rest, pointing down when slamming
    if (c.mode === 'rest') {
      _dir.set(Math.sin(this.yaw) + c.side * 0.3 * Math.cos(this.yaw), 0.15, Math.cos(this.yaw) - c.side * 0.3 * Math.sin(this.yaw)).normalize();
    } else _dir.set(Math.sin(this.yaw) * 0.25, -1, Math.cos(this.yaw) * 0.25).normalize();
    _q.setFromUnitVectors(_Z, _dir);
    c.pincer.quaternion.slerp(_q, 1 - Math.exp(-dt * 10));
    c.up.rotation.x = -c.open;
    c.lo.rotation.x = c.open * 0.7;
    cylBetween(c.arm, c.shoulder, c.pos, 0.22);
    setBox(c.box, c.pos.x, c.pos.y - 0.55, c.pos.z, 0.75, 1.1, 0.75);
    c.box.off = c.mode === 'stuck' || this.state === 'ouch' || this.state === 'defeat';
  }

  reflectTarget() { return this.pos; }
  onReflectArrive() {}
  defeatFocus() { return _tmp.set(this.pos.x, this.floor + 1, this.pos.z); }

  botHint() {
    if (!this.vulnerable || this.invulnT > 0 || this.defeated) return null;
    const w = this.weak;
    return { action: 'stomp', pos: [(w.min.x + w.max.x) / 2, w.max.y + 1.0, (w.min.z + w.max.z) / 2] };
  }
}

const _tmp = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _col = new THREE.Color();
