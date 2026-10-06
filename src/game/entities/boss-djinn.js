// B2 — Djinn de la Lampe Mal Polie (île 2, désert). Flotte au-dessus de sa lampe, lance des théières-bombes
// (qu'on RENVOIE à la toupie pour le toucher), fait balayer l'arène par des tapis volants (rouges = bas → sauter,
// bleus = hauts → rester au sol), et insulte poliment.
import * as THREE from 'three';
import { BossBase, mk, grp, std, googly, wobbleEye, cylBetween, setBox, aabb, rand, clamp, t2, pick, damp, TAU } from './boss-kit.js';

const CFG = {
  name: t2('Djinn de la Lampe Mal Polie', 'The Rude Lamp Djinn'), speaker: 'djinn', hitsPerPhase: [2, 2, 2], defeatTime: 3.4,
};
const TUNE = {
  pots: [3, 4, 5], potEvery: [1.05, 0.85, 0.7], flight: [1.2, 1.05, 0.95], fuse: [2.3, 1.9, 1.5],
  carpetSpeed: [9, 10.5, 12], sway: [3, 4, 5], hover: 1.7,
  skin: [0x4f6dff, 0x7a4fff, 0xc23a7a],
};
const SCRIPTS = [
  ['teapots', 'sip', 'carpets'],
  ['teapots', 'carpets', 'teapots', 'sip'],
  ['carpets', 'teapots', 'sip'],
];
const CARPETS = [
  [{ d: 0, axis: 'z', dir: 1, high: false }],
  [{ d: 0, axis: 'z', dir: 1, high: false }, { d: 1.4, axis: 'z', dir: -1, high: false }],
  [{ d: 0, axis: 'x', dir: 1, high: false }, { d: 1.1, axis: 'z', dir: 1, high: true }, { d: 2.2, axis: 'z', dir: -1, high: false }],
];
const L = {
  intro: t2('Bonjour. Je vous prie de bien vouloir disparaître.', 'Good day. I kindly request that you vanish.'),
  oku: t2('Conseil d\'Oku Oku : un génie, ça se frotte. Va lui frotter la lampe !', 'Oku Oku tip: genies like a good rub. Go rub his lamp!'),
  hint: t2('Une théière ! Renvoie-la-lui à la toupie ! C\'est poli : retour à l\'envoyeur.', 'A teapot! Spin it back at him! Very polite: return to sender.'),
  pots: [t2('Auriez-vous l\'obligeance d\'exploser ?', 'Would you be so kind as to explode?'),
    t2('Une petite tasse ? Elle est piégée, naturellement.', 'A spot of tea? It\'s rigged, naturally.'),
    t2('Je vous en prie, prenez-en plusieurs.', 'Please, do help yourself to several.')],
  sip: [t2('Navré, mais vous êtes d\'un ridicule…', 'Terribly sorry, but you are ridiculous…'),
    t2('Avec tout mon respect : dégagez.', 'With all due respect: scram.'),
    t2('Puis-je vous suggérer de perdre ?', 'May I suggest that you lose?')],
  carpets: [t2('Tapis volants ! Essuyez vos pieds, je vous prie.', 'Flying carpets! Kindly wipe your feet.'),
    t2('Le rouge, on saute. Le bleu, on reste poli… et au sol.', 'Red: you jump. Blue: you stay polite… and grounded.')],
  ouch: [t2('Quelle impolitesse !', 'How rude!'), t2('On ne renvoie pas le thé d\'un hôte !', 'One does not return a host\'s tea!'),
    t2('Ma moustache ! Elle était repassée !', 'My moustache! It was ironed!')],
  rage1: t2('Je vous prie de bien vouloir disparaître… IMMÉDIATEMENT.', 'I kindly request that you vanish… IMMEDIATELY.'),
  rage2: t2('Très bien. Je retire mes salutations distinguées.', 'Very well. I withdraw my kindest regards.'),
  miss: t2('Raté. Mais merci d\'avoir essayé.', 'Missed. But thank you for trying.'),
  taunt: t2('Oh, vous revoilà. Quel dommage.', 'Oh, you\'re back. What a pity.'),
  defeat: t2('Je… je retourne dans ma lampe. Fermez la porte en sortant, merci.', 'I… I shall return to my lamp. Close the door on your way out, thank you.'),
};

export function createDjinn(def, ctx) { return new Djinn(def, ctx).entity; }

class Djinn extends BossBase {
  constructor(def, ctx) {
    super(def, ctx, CFG);
    this.scripts = SCRIPTS;
    this.hitModes = { stomp: false, spin: false, slam: false };
    this.bodyBox = aabb();
    this.body = [this.bodyBox];
    this.carpets = [];
    this.rise = 0;
    this.tint = 0;
    this.build();
    this.pos.y = this.floor + TUNE.hover;
    this.go('intro');
  }

  build() {
    const g = this.geo;
    this.mats = {
      skin: std(TUNE.skin[0], { rough: 0.5 }), skin2: std(0x7d97ff, { rough: 0.5 }),
      smoke: std(0x8fa6ff, { rough: 0.9, opacity: 0.75, depthWrite: false }),
      gold: std(0xffc93c, { rough: 0.25, metal: 0.85 }), white: std(0xffffff, { rough: 0.3 }), black: std(0x15131c, { rough: 0.4 }),
      turban: std(0xfff1d6, { rough: 0.8 }), ruby: std(0xff2850, { rough: 0.15, emissive: 0x550010 }), pink: std(0xff7ab8),
      porcelain: std(0xf4f7ff, { rough: 0.25 }), blue: std(0x3d6bd8, { rough: 0.3 }), vest: std(0x8a2bc0, { rough: 0.7 }),
      carpetRed: std(0xb8323a, { rough: 0.9, side: THREE.DoubleSide }), carpetBlue: std(0x2f5fc8, { rough: 0.9, side: THREE.DoubleSide }),
      fringe: std(0xffd34d, { rough: 0.8 }),
    };
    const m = this.mats;
    // lamp
    this.lamp = grp(this.model);
    const lp = this.lamp;
    mk(g.cyl, m.gold, lp, 0, 0.08, 0, [0.4, 0.16, 0.4]);
    mk(g.sphere, m.gold, lp, 0, 0.45, 0, [0.95, 0.42, 0.62]);
    mk(g.sphere, m.gold, lp, 0, 0.82, 0, 0.3);
    mk(g.sphereLo, m.ruby, lp, 0, 1.1, 0, 0.1);
    const spout = mk(g.cone, m.gold, lp, 0, 0.6, 1.05, [0.16, 1.0, 0.16]);
    spout.rotation.x = Math.PI / 2 - 0.45;
    mk(g.torus, m.gold, lp, 0, 0.5, -0.9, [0.32, 0.32, 0.5]).rotation.y = Math.PI / 2;
    // the spirit (everything above the lamp) — scales out of the lamp in the intro
    this.spirit = grp(this.model, 0, 0.9, 0);
    const sp = this.spirit;
    this.tail = [];
    for (let i = 0; i < 4; i++) {
      const tl = mk(g.sphere, i < 2 ? m.smoke : m.skin, sp, 0, 0.25 + i * 0.38, 0, 0.25 + i * 0.16);
      this.tail.push(tl);
    }
    const torso = grp(sp, 0, 1.9, 0);
    this.torso = torso;
    mk(g.sphere, m.skin, torso, 0, 0, 0, [1.25, 1.05, 0.95]);
    mk(g.sphere, m.vest, torso, -0.55, 0.15, 0.25, [0.62, 0.85, 0.72]);
    mk(g.sphere, m.vest, torso, 0.55, 0.15, 0.25, [0.62, 0.85, 0.72]);
    mk(g.torus, m.gold, torso, 0, -0.62, 0, [1.05, 1.05, 0.6]).rotation.x = Math.PI / 2;
    // head
    const head = grp(torso, 0, 1.45, 0.05);
    this.head = head;
    mk(g.sphere, m.skin2, head, 0, 0, 0, 0.78);
    for (const s of [-1, 1]) {
      const ear = mk(g.cone, m.skin2, head, s * 0.82, 0.05, 0, [0.16, 0.55, 0.12]);
      ear.rotation.z = -s * Math.PI / 2.4;
      mk(g.torus, m.gold, head, s * 0.8, -0.25, 0.05, [0.1, 0.1, 0.15]);
    }
    this.eyes = [-1, 1].map((s) => googly(head, g, m, 0.21, s * 0.28, 0.17, 0.62));
    this.brows = [-1, 1].map((s) => { const b = mk(g.box, m.black, head, s * 0.29, 0.43, 0.7, [0.38, 0.09, 0.1]); b.rotation.z = s * 0.15; return b; });
    mk(g.sphere, m.skin2, head, 0, -0.05, 0.78, [0.2, 0.22, 0.22]);
    for (const s of [-1, 1]) {
      const st = mk(g.sphere, m.black, head, s * 0.3, -0.24, 0.72, [0.36, 0.08, 0.1]);
      st.rotation.z = s * 0.3;
      mk(g.torus, m.black, head, s * 0.66, -0.06, 0.66, [0.1, 0.1, 0.12]);
    }
    const beard = mk(g.cone, m.black, head, 0, -0.75, 0.48, [0.24, 0.75, 0.2]);
    beard.rotation.x = Math.PI - 0.25;
    // turban
    this.turban = grp(head, 0, 0.55, 0);
    mk(g.torus, m.turban, this.turban, 0, 0, 0, [0.68, 0.68, 0.9]).rotation.x = Math.PI / 2;
    mk(g.sphere, m.turban, this.turban, 0, 0.22, 0, [0.66, 0.5, 0.66]);
    mk(g.sphereLo, m.ruby, this.turban, 0, 0.12, 0.78, 0.15);
    const feather = mk(g.cone, m.pink, this.turban, 0, 0.75, 0.5, [0.07, 0.8, 0.07]);
    feather.rotation.x = 0.4;
    // arms
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Vector3(s * 1.15, 0.45, 0);
      const upper = mk(g.cyl, m.skin, torso), lower = mk(g.cyl, m.skin, torso);
      const hand = mk(g.sphere, m.skin2, torso, 0, 0, 0, 0.27);
      const cuff = mk(g.torus, m.gold, torso, 0, 0, 0, [0.22, 0.22, 0.4]);
      return { s, shoulder, upper, lower, hand, cuff, elbow: new THREE.Vector3(), handPos: new THREE.Vector3(s * 1.6, -0.2, 0.8) };
    });
    // teacup with pinky up (left hand)
    this.cup = grp(this.arms[0].hand);
    mk(g.cyl, m.porcelain, this.cup, 0, 0.55, 0.2, [0.75, 0.6, 0.75]);
    mk(g.disc, m.porcelain, this.cup, 0, 0.26, 0.2, 1.2).rotation.x = -Math.PI / 2;
    mk(g.cyl, m.skin2, this.cup, -0.9, 0.5, 0.2, [0.14, 0.7, 0.14]).rotation.z = -1.1;
    this.cup.scale.setScalar(0.45);
    // blob shadow
    this.shadow = mk(g.disc, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), this.root);
    this.shadow.rotation.x = -Math.PI / 2;
    this.model.traverse((o) => { if (o.isMesh) o.castShadow = (this.ctx.quality?.level ?? 1) >= 2; });
    this.makeTeapotTemplate();
  }

  makeTeapotTemplate() {
    const g = this.geo, m = this.mats;
    const t = new THREE.Group();
    const body = grp(t);
    mk(g.sphere, m.porcelain, body, 0, 0, 0, [0.36, 0.3, 0.36]);
    mk(g.torus, m.blue, body, 0, 0, 0, [0.35, 0.35, 0.25]).rotation.x = Math.PI / 2;
    mk(g.sphere, m.porcelain, body, 0, 0.27, 0, [0.17, 0.08, 0.17]);
    mk(g.sphereLo, m.blue, body, 0, 0.36, 0, 0.06);
    const sp = mk(g.cone, m.porcelain, body, 0, 0.06, 0.4, [0.07, 0.38, 0.07]);
    sp.rotation.x = 0.9;
    mk(g.torus, m.blue, body, 0, 0.04, -0.36, [0.15, 0.15, 0.25]).rotation.y = Math.PI / 2;
    t.scale.setScalar(1.25);
    this.potTpl = t;
    this.extraDispose.push(t);
  }

  // ------------------------------------------------------------------ AI
  onEnter(state) {
    this.contactHurts = !['ouch', 'rage', 'intro', 'regroup'].includes(state);
    if (state === 'teapots') { this.potsLeft = this.pp(TUNE.pots); this.potT = 0.5; this.throwT = 0; }
    if (state === 'carpets') this.startCarpets();
  }

  think(dt) {
    const a = this.arena;
    const swayAmp = this.pp(TUNE.sway);
    const tx = a.x + Math.sin(this.time * 0.55) * swayAmp;
    this.pos.x = damp(this.pos.x, ['ouch', 'rage', 'intro'].includes(this.state) ? this.pos.x : tx, 2, dt);
    this.pos.z = damp(this.pos.z, this.home.z, 2, dt);
    this.facePlayer(dt, 3);
    switch (this.state) {
      case 'intro':
        this.rise = clamp(this.st / 1.3, 0, 1);
        if (this.every(0.15) && this.st < 1.4) this.burst(_v.set(this.pos.x, this.pos.y + 1, this.pos.z), [0x8fa6ff, 0xc9d4ff], 6, { speed: 3, up: 3 });
        if (this.at(0.3)) this.sfx('wind');
        if (this.at(1.4)) { this.say(L.intro); this.sfx('boss_roar', { pitch: 1.2 }); }
        if (this.at(2.6)) this.say(L.oku, 'oku');
        if (this.st > 3.6) this.next();
        break;
      case 'regroup':
        if (this.at(0.2)) this.say(L.taunt);
        if (this.st > 1.6) this.next();
        break;
      case 'teapots':
        if (this.at(0.1)) this.say(pick(L.pots));
        this.potT -= dt;
        if (this.potsLeft > 0 && this.potT <= 0) {
          this.throwT = 0.35;
          this.potT = this.pp(TUNE.potEvery);
          this.potsLeft--;
        }
        if (this.throwT > 0) { this.throwT -= dt; if (this.throwT <= 0) this.throwPot(); }
        if (this.potsLeft <= 0 && this.throwT <= 0 && this.potT < this.pp(TUNE.potEvery) - 0.8) this.next();
        break;
      case 'sip':
        if (this.at(0.4)) this.say(pick(L.sip));
        if (this.st > 2.4) this.next();
        break;
      case 'carpets':
        if (this.at(0.1)) this.say(pick(L.carpets));
        if (this.carpets.every((c) => c.done)) this.next();
        break;
      case 'ouch':
        if (this.at(0)) { this.say(pick(L.ouch)); this.clearCarpets(); for (const s of this.shots) this.removeShot(s, true); }
        if (this.st > 2.0) { if (this.pendingRage) this.go('rage'); else this.next(); }
        break;
      case 'rage':
        if (this.at(0.15)) { this.sfx('boss_roar'); this.shake(0.6); this.say(this.phase === 1 ? L.rage1 : L.rage2); }
        if (this.every(0.12) && this.st < 1.5) this.burst(_v.set(this.pos.x, this.pos.y + 4.5, this.pos.z), [0xff5a3c, 0xffb03c], 5, { speed: 4, up: 4 });
        if (this.st > 2.0) { this.pendingRage = false; this.next(); }
        break;
      default: this.next();
    }
    this.updateCarpets(dt);
  }

  handWorld(i, out) {
    this.syncModel();
    out.copy(this.arms[i].handPos);
    return this.torso.localToWorld(out);
  }

  throwPot() {
    const from = this.handWorld(1, new THREE.Vector3());
    const to = this.aimPoint(0.35);
    if (this.potsLeft % 2 === 1 && this.phase >= 1) { to.x += rand(-1.5, 1.5); to.z += rand(-1.5, 1.5); this.clampArena(to, 0.8); }
    const T = this.pp(TUNE.flight), G = 20;
    to.y = this.floor + 0.4;
    const mesh = this.potTpl.clone();
    const s = this.shot({ mesh, pos: from, vel: this.lobVel(from, to, T, G), r: 0.45, grav: G, life: 12, reflectable: true, cause: 'explode',
      poofColor: 0xf4f7ff, spin: 5, hitR: 1.9, reflectSpeed: 16 });
    s.mark = this.mark(to.x, to.z, 1.2, 0xff7a3a, T + 0.1);
    s.onLand = (sh, boss) => {
      sh.landed = true; sh.vel.set(0, 0, 0); sh.fuse = boss.pp(TUNE.fuse); sh.spin = 0;
      sh.mesh.rotation.set(0, rand(0, TAU), 0);
      if (sh.mark) sh.mark.done();
      sh.mark = boss.mark(sh.pos.x, sh.pos.z, 1.9, 0xff4a2a, 0, { blink: 10 });
      boss.sfx('crate_bounce', { pos: sh.pos, pitch: 1.4 });
      if (!boss.saidOnce.has('hint')) boss.sayOnce('hint', L.hint, 'oku');
    };
    s.update = (sh, dt, boss) => {
      if (!sh.landed) return;
      sh.fuse -= dt;
      const k = 1 - sh.fuse / boss.pp(TUNE.fuse);
      sh.mesh.rotation.z = Math.sin(boss.time * (18 + k * 30)) * 0.18 * (0.4 + k);
      sh.mesh.scale.setScalar(1.25 * (1 + Math.max(0, k - 0.7) * 0.5 * Math.abs(Math.sin(boss.time * 30))));
      sh.tick = (sh.tick ?? 0) - dt;
      if (sh.tick <= 0) {
        sh.tick = 0.45 - k * 0.3;
        boss.sfx('tnt_tick', { pos: sh.pos, pitch: 1.3 + k });
        boss.burst(_v.set(sh.pos.x, sh.pos.y + 0.5, sh.pos.z), 0xffffff, 3, { speed: 1.5, up: 3, life: 0.6 });
      }
      if (sh.fuse <= 0) {
        boss.removeShot(sh);
        boss.boom(_v.set(sh.pos.x, sh.pos.y, sh.pos.z), 1.9, [0xf4f7ff, 0x3d6bd8, 0xffc93c, 0xffffff]);
      }
    };
    s.onReflect = (sh) => { sh.spin = 14; };
    this.sfx('spin', { pitch: 0.7 });
  }

  // ------------------------------------------------------------------ carpets
  startCarpets() {
    this.clearCarpets();
    const a = this.arena, list = this.pp(CARPETS);
    for (const c of list) {
      const g = this.makeCarpet(c.high, a.r * 2 + 2);
      const start = -c.dir * (a.r + 1.6);
      const car = { ...c, mesh: g, t: -c.d, along: start, end: c.dir * (a.r + 2.5), done: false, hit: false, mark: null, phase: 'wait' };
      g.rotation.y = c.axis === 'z' ? 0 : Math.PI / 2;
      g.visible = false;
      this.root.add(g);
      this.carpets.push(car);
    }
  }

  makeCarpet(high, len) {
    const g = this.geo, m = this.mats;
    const grpC = new THREE.Group();
    const main = mk(g.box, high ? m.carpetBlue : m.carpetRed, grpC, 0, 0, 0, [len, 0.1, 1.9]);
    void main;
    mk(g.box, m.fringe, grpC, 0, 0.03, 0.82, [len, 0.11, 0.16]);
    mk(g.box, m.fringe, grpC, 0, 0.03, -0.82, [len, 0.11, 0.16]);
    mk(g.box, m.fringe, grpC, 0, 0.04, 0, [len * 0.98, 0.11, 0.12]);
    for (let i = -6; i <= 6; i++) mk(g.cyl, m.fringe, grpC, (len / 2 + 0.2) * Math.sign(i || 1), -0.05, i * 0.14, [0.03, 0.35, 0.03]).rotation.z = Math.PI / 2;
    return grpC;
  }

  updateCarpets(dt) {
    const a = this.arena, p = this.player;
    for (const c of this.carpets) {
      if (c.done) continue;
      c.t += dt;
      if (c.t < 0) continue;
      const y = this.floor + (c.high ? 1.65 : 0.4);
      const tele = 1.0;
      if (c.phase === 'wait') {
        c.phase = 'tele';
        c.mesh.visible = true;
        const e = a.r + 0.6;
        if (c.axis === 'z') c.mark = this.lineMark(a.x - e, a.z + c.along * 0.92, a.x + e, a.z + c.along * 0.92, 1.4, c.high ? 0x3d7bff : 0xff3b3b, tele);
        else c.mark = this.lineMark(a.x + c.along * 0.92, a.z - e, a.x + c.along * 0.92, a.z + e, 1.4, c.high ? 0x3d7bff : 0xff3b3b, tele);
        this.sfx('wind', { vol: 0.6 });
      }
      if (c.phase === 'tele' && c.t >= tele) { c.phase = 'go'; this.sfx('wind', { vol: 0.9, pitch: 1.3 }); }
      if (c.phase === 'go') c.along += c.dir * this.pp(TUNE.carpetSpeed) * dt;
      const wob = Math.sin(this.time * 8 + c.along) * 0.06;
      if (c.axis === 'z') c.mesh.position.set(a.x, y + wob, a.z + c.along);
      else c.mesh.position.set(a.x + c.along, y + wob, a.z);
      c.mesh.rotation.x = c.axis === 'z' ? Math.sin(this.time * 9 + c.along) * 0.05 : 0;
      c.mesh.rotation.z = c.axis === 'x' ? Math.sin(this.time * 9 + c.along) * 0.05 : 0;
      if (c.phase === 'go' && !c.hit && !p.dead) {
        const pa = c.axis === 'z' ? p.pos.z - a.z : p.pos.x - a.x;
        if (Math.abs(pa - c.along) < 1.2) {
          const hitLow = !c.high && p.pos.y < this.floor + 0.75;
          const hitHigh = c.high && p.pos.y + 1.1 > this.floor + 1.4 && p.pos.y < this.floor + 2.0;
          if (hitLow || hitHigh) { c.hit = true; this.hurtPlayer('generic', _v.set(c.axis === 'z' ? p.pos.x : a.x + c.along, 0, c.axis === 'z' ? a.z + c.along : p.pos.z)); }
        }
      }
      if (c.phase === 'go' && (c.dir > 0 ? c.along >= c.end : c.along <= c.end)) { c.done = true; this.root.remove(c.mesh); }
    }
  }

  clearCarpets() {
    for (const c of this.carpets) { if (!c.done) { c.done = true; this.root.remove(c.mesh); } c.mark?.done(); }
    for (const c of this.carpets) this.extraDispose.push(c.mesh);
    this.carpets.length = 0;
  }

  // ------------------------------------------------------------------ hits
  reflectTarget() { return _t.set(this.pos.x, this.pos.y + 2.8, this.pos.z); }
  onReflectArrive(s) {
    if (this.invulnT > 0 || ['ouch', 'rage', 'intro'].includes(this.state) || this.defeated) {
      this.burst(s.pos, [0xf4f7ff, 0x3d6bd8], 12, { speed: 5 });
      this.sfx('crate_bounce', { pos: s.pos });
      this.say(L.miss);
      return;
    }
    this.boom(_v.copy(s.pos), 0.1, [0xf4f7ff, 0x3d6bd8, 0xffc93c], 'explode', 0.5);
    this.takeHit('reflect', s.pos);
  }
  onHit(how, phaseUp) {
    this.pendingRage = phaseUp;
    this.soot = 1;
    this.go('ouch');
  }
  onReset() {
    this.clearCarpets();
    this.pos.set(this.home.x, this.floor + TUNE.hover, this.home.z);
    this.pendingRage = false;
    this.go('regroup');
  }
  onDefeat() { this.clearCarpets(); this.go('defeat'); }
  defeatFocus() { return _t.set(this.pos.x, this.floor + 1.5, this.pos.z); }

  defeatAnim(dt, t) {
    const k = clamp(t / 1.5, 0, 1);
    this.spirit.scale.setScalar(Math.max(0.001, 1 - k));
    this.spirit.rotation.y += dt * (6 + k * 20);
    if (this.at(0.1)) this.say(L.defeat);
    if (this.every(0.12) && t < 1.6) this.burst(_v.set(this.pos.x, this.pos.y + 1.2 + (1 - k) * 2, this.pos.z), [0x8fa6ff, 0xc9d4ff, 0xffffff], 6, { speed: 3 });
    if (this.at(0.4)) this.confetti(_v.set(this.pos.x, this.pos.y + 3, this.pos.z), 45);
    // the lamp drops and rattles
    if (t > 1.5) {
      const ft = t - 1.5;
      this.pos.y = Math.max(this.floor, this.floor + TUNE.hover - ft * ft * 12);
      if (this.pos.y === this.floor && !this.landedLamp) { this.landedLamp = true; this.shake(0.4); this.sfx('crate_iron'); }
      if (this.landedLamp) this.lamp.rotation.z = Math.sin(t * 30) * 0.2 * Math.max(0, 1 - (t - 2.2));
    }
    if (this.at(2.4)) { this.sfx('honk', { pitch: 0.7 }); this.burst(_v.set(this.pos.x, this.pos.y + 1.2, this.pos.z), 0xffffff, 10, { speed: 3 }); }
  }

  // ------------------------------------------------------------------ visuals
  animate(dt) {
    const t = this.time, m = this.mats;
    const bob = Math.sin(t * 1.6) * 0.25;
    if (!this.defeated) this.pos.y = this.floor + TUNE.hover + bob;
    if (this.state === 'intro') this.spirit.scale.set(0.2 + this.rise * 0.8, Math.max(0.05, this.rise), 0.2 + this.rise * 0.8);
    else if (!this.defeated) this.spirit.scale.setScalar(1);
    // tail swirl
    this.tail.forEach((tl, i) => { tl.position.x = Math.sin(t * 3 + i) * 0.12 * (4 - i); tl.position.z = Math.cos(t * 2.5 + i) * 0.1 * (4 - i); });
    // colour: phase tint + soot after a hit
    this.soot = Math.max(0, (this.soot || 0) - dt * 0.6);
    _c.setHex(this.pp(TUNE.skin)).lerp(_c2.setHex(0x222222), this.soot * 0.8);
    m.skin.color.lerp(_c, 1 - Math.exp(-dt * 5));
    m.skin2.color.copy(m.skin.color).offsetHSL(0, 0, 0.08);
    // body pose
    const ouch = this.state === 'ouch';
    if (!this.defeated) this.spirit.rotation.y = ouch ? clamp(this.st / 1.5, 0, 1) * TAU * 3 : 0;
    this.torso.rotation.x = this.state === 'intro' && this.st > 2 && this.st < 2.8 ? 0.45 : damp(this.torso.rotation.x, 0, 4, dt);
    this.turban.position.y = 0.55 + (ouch ? Math.max(0, Math.sin(this.st * 5)) * 0.7 : 0);
    for (const e of this.eyes) wobbleEye(e, t, 1, ouch || this.defeated);
    const angry = this.phase / 2;
    this.brows.forEach((b, i) => { b.rotation.z = (i ? 1 : -1) * (0.15 + angry * 0.4); });
    // arms: right throws, left holds the cup (sips during 'sip')
    const throwing = this.state === 'teapots' && this.throwT > 0;
    const conduct = this.state === 'carpets' || this.state === 'rage';
    const right = this.arms[1], left = this.arms[0];
    right.handPos.set(1.65, throwing ? 1.6 : (conduct ? 1.4 + Math.sin(t * 8) * 0.4 : -0.2 + Math.sin(t * 2) * 0.1), throwing ? -0.2 : 0.8);
    const sipping = this.state === 'sip' && this.st > 0.3 && this.st < 1.8;
    left.handPos.set(sipping ? -0.35 : -1.55, sipping ? 1.2 : (conduct ? 1.4 + Math.cos(t * 8) * 0.4 : 0.25), sipping ? 1.0 : 0.85);
    for (const arm of this.arms) {
      arm.elbow.copy(arm.shoulder).lerp(arm.handPos, 0.5); arm.elbow.x += arm.s * 0.35; arm.elbow.y -= 0.25;
      cylBetween(arm.upper, arm.shoulder, arm.elbow, 0.2);
      cylBetween(arm.lower, arm.elbow, arm.handPos, 0.17);
      arm.hand.position.copy(arm.handPos);
      cylBetween(arm.cuff, _v.copy(arm.handPos).lerp(arm.elbow, 0.25), _v2.copy(arm.handPos).lerp(arm.elbow, 0.3), 0.21);
      arm.cuff.scale.y = 0.08;
    }
    this.cup.rotation.x = sipping ? -0.9 : 0;
    // shadow + hit box
    const gy = this.floorAt(this.pos.x, this.pos.z, this.pos.y + 1);
    this.shadow.visible = gy > -Infinity;
    this.shadow.position.set(this.pos.x, (gy > -Infinity ? gy : this.floor) + 0.03, this.pos.z);
    this.shadow.scale.setScalar(1.6);
    setBox(this.bodyBox, this.pos.x, this.pos.y + 1.6, this.pos.z, 1.3, 3.6, 1.1);
  }
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
