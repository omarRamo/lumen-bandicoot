// B3 — Yéti Influenceur (île 3, glacier). Lance des boules de neige « sponsorisées », glisse sur le ventre,
// roule une boule géante (phase 2+), et surtout prend des selfies : compte à rebours → FLASH (écran blanc) →
// il pose pour sa story = vulnérable (toupie ou saut sur la tête). « Ça va faire le buzz ! »
import * as THREE from 'three';
import { BossBase, mk, grp, std, basic, googly, wobbleEye, cylBetween, setBox, aabb, rand, clamp, t2, pick, damp, TAU } from './boss-kit.js';

const CFG = {
  name: t2('Yéti Influenceur', 'Influencer Yeti'), speaker: 'yeti', hitsPerPhase: [2, 2, 2], defeatTime: 3.4,
};
const TUNE = {
  balls: [3, 4, 5], ballEvery: [0.8, 0.62, 0.5], flight: [1.15, 1.0, 0.9],
  slideSpeed: [10.5, 12, 13.5], slides: [1, 2, 3], slideWind: [0.95, 0.8, 0.65],
  roll: [8, 8.5, 10], story: [4.4, 3.8, 3.2], countdown: [1.8, 1.6, 1.4],
};
const SCRIPTS = [
  ['snowballs', 'slide', 'selfie'],
  ['snowballs', 'slide', 'rollball', 'selfie'],
  ['rollball', 'slide', 'snowballs', 'selfie'],
];
const L = {
  intro: t2('Salut la commu ! Aujourd\'hui : j\'écrase un renard. Lâchez un like !', 'Hey fam! Today: I squash a fox. Smash that like!'),
  oku: t2('Conseil d\'Oku Oku : fais-lui un pouce bleu, il se calmera peut-être.', 'Oku Oku tip: give him a thumbs-up, maybe he\'ll calm down.'),
  hint: t2('Il pose pour sa story ! Fonce lui faire une toupie dans le cadre !', 'He\'s posing for his story! Go spin into the frame!'),
  balls: [t2('Boule de neige sponsorisée !', 'Sponsored snowball!'), t2('Code promo LUMEN : -10 % de dégâts !', 'Promo code LUMEN: 10% off damage!'),
    t2('Abonne-toi ou je tire !', 'Subscribe or I throw!')],
  slide: [t2('Regardez ce trick ! Glissade sur le ventre !', 'Check this trick! Belly slide!'), t2('Tuto glisse, épisode 47 !', 'Sliding tutorial, episode 47!')],
  roll: t2('Unboxing de ma boule de neige géante !', 'Unboxing my giant snowball!'),
  smile: t2('Souriez !', 'Say cheese!'),
  flash: t2('FLASH ! #SansFiltre', 'FLASH! #NoFilter'),
  story: [t2('Ça va faire le buzz !', 'This is gonna go viral!'), t2('#Glacier #NoFilter #RenardÉcrasé', '#Glacier #NoFilter #SquashedFox'),
    t2('Attends, je cherche le bon filtre…', 'Hold on, finding the right filter…')],
  posted: t2('Posté. Trois likes. Dont ma mère.', 'Posted. Three likes. One is my mom.'),
  ouch: [t2('MON TÉLÉPHONE ! J\'avais 2 % de batterie !', 'MY PHONE! I was at 2% battery!'), t2('Tu viens de ruiner mon contenu !', 'You just ruined my content!'),
    t2('Coupez ! On la refait !', 'Cut! Let\'s do it again!')],
  rage1: t2('Nouvelle vidéo : JE ME VENGE (pas clickbait). Avec perche à selfie.', 'New video: MY REVENGE (not clickbait). With a selfie stick.'),
  rage2: t2('EN DIRECT ! Coucou les 4 viewers !', 'GOING LIVE! Hi to all 4 viewers!'),
  taunt: t2('Ça, c\'était un fail. Je le mets en compilation.', 'That was a fail. Going in my compilation.'),
  defeat: t2('Bon… je fais une pause des réseaux. Jusqu\'à demain.', 'Okay… I\'m taking a break from social media. Until tomorrow.'),
};

export function createYeti(def, ctx) { return new Yeti(def, ctx).entity; }

class Yeti extends BossBase {
  constructor(def, ctx) {
    super(def, ctx, CFG);
    this.scripts = SCRIPTS;
    this.hitModes = { stomp: true, spin: true, slam: true };
    this.preferSpin = true;
    this.bodyBox = aabb();
    this.body = [this.bodyBox];
    this.spinBoxY = aabb();
    this.spinTarget = this.spinBoxY;
    this.vel = new THREE.Vector3();
    this.crouch = 0; this.belly = 0;
    this.build();
    this.go('intro');
  }

  build() {
    const g = this.geo;
    this.mats = {
      fur: std(0xe9ddff, { rough: 0.9 }), fur2: std(0xbfc6ec, { rough: 0.9 }), face: std(0x7fb2ff, { rough: 0.6 }),
      white: std(0xffffff, { rough: 0.3 }), black: std(0x121418, { rough: 0.35 }), beanie: std(0xff5fa2, { rough: 0.8 }),
      scarf: std(0x3fd0c0, { rough: 0.8 }), phone: std(0x1d1d28, { rough: 0.3, metal: 0.4 }),
      screen: std(0x6ff0ff, { emissive: 0x2bb8ff, ei: 1.2 }), glasses: std(0x101010, { rough: 0.1, metal: 0.6 }),
      tooth: std(0xfffbe8), stick: std(0xbfc6d0, { metal: 0.7, rough: 0.3 }), live: std(0xff2a2a, { emissive: 0xff0000 }),
      snow: std(0xffffff, { rough: 0.85 }), heart: basic(0xff4f8b),
    };
    const m = this.mats;
    this.bodyG = grp(this.model);
    const b = this.bodyG;
    // legs + feet
    for (const s of [-1, 1]) {
      mk(g.cyl, m.fur2, b, s * 0.65, 0.4, 0, [0.42, 0.8, 0.42]);
      mk(g.sphere, m.fur2, b, s * 0.7, 0.12, 0.25, [0.5, 0.2, 0.7]);
    }
    // body + fur clumps
    this.torso = grp(b, 0, 1.9, 0);
    mk(g.sphere, m.fur, this.torso, 0, 0, 0, [1.35, 1.45, 1.15]);
    mk(g.sphere, m.fur2, this.torso, 0, -0.2, 0.55, [0.9, 1.0, 0.7]);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU, y = (i % 3) * 0.5 - 0.5;
      mk(g.sphereLo, m.fur, this.torso, Math.cos(a) * 1.15, y, Math.sin(a) * 0.95, 0.42);
    }
    // scarf
    mk(g.torus, m.scarf, this.torso, 0, 1.15, 0, [0.95, 0.95, 1.1]).rotation.x = Math.PI / 2;
    const tail = mk(g.box, m.scarf, this.torso, 0.55, 0.65, 0.85, [0.35, 0.9, 0.12]);
    tail.rotation.z = 0.2;
    // head
    this.head = grp(this.torso, 0, 1.75, 0.05);
    const h = this.head;
    mk(g.sphere, m.fur, h, 0, 0, 0, 0.88);
    mk(g.sphere, m.face, h, 0, -0.08, 0.5, [0.62, 0.55, 0.42]);
    this.eyes = [-1, 1].map((s) => googly(h, g, m, 0.19, s * 0.24, 0.08, 0.86));
    const mouth = mk(g.arcHalf, m.black, h, 0, -0.3, 0.88, [0.28, 0.2, 0.25]);
    mouth.rotation.z = Math.PI;
    this.mouth = mouth;
    for (const s of [-1, 1]) mk(g.box, m.tooth, h, s * 0.08, -0.28, 0.9, [0.12, 0.14, 0.05]);
    // sunglasses on the forehead
    for (const s of [-1, 1]) mk(g.box, m.glasses, h, s * 0.26, 0.42, 0.78, [0.36, 0.18, 0.06]);
    mk(g.box, m.glasses, h, 0, 0.45, 0.8, [0.2, 0.04, 0.04]);
    // beanie + pompom
    this.beanie = grp(h, 0, 0.5, 0);
    mk(g.hemi, m.beanie, this.beanie, 0, 0, 0, [0.86, 0.75, 0.86]);
    mk(g.torus, m.beanie, this.beanie, 0, 0.02, 0, [0.82, 0.82, 0.8]).rotation.x = Math.PI / 2;
    mk(g.sphereLo, m.white, this.beanie, 0, 0.82, 0, 0.26);
    // arms
    this.arms = [-1, 1].map((s) => {
      const shoulder = new THREE.Vector3(s * 1.2, 0.7, 0);
      const upper = mk(g.cyl, m.fur, this.torso), lower = mk(g.cyl, m.fur, this.torso);
      const hand = mk(g.sphere, m.fur2, this.torso, 0, 0, 0, 0.36);
      return { s, shoulder, upper, lower, hand, elbow: new THREE.Vector3(), handPos: new THREE.Vector3(s * 1.6, -0.8, 0.3) };
    });
    // phone (+ selfie stick from phase 2, LIVE light in phase 3)
    this.phone = grp(this.torso);
    this.stick = mk(g.cyl, m.stick, this.phone, 0, -0.8, 0, [0.05, 1.6, 0.05]);
    this.phoneBody = grp(this.phone);
    mk(g.box, m.phone, this.phoneBody, 0, 0, 0, [0.5, 0.9, 0.08]);
    this.screen = mk(g.plane, m.screen, this.phoneBody, 0, 0, 0.045, [0.42, 0.78, 1]);
    mk(g.plane, m.screen, this.phoneBody, 0, 0, -0.045, [0.42, 0.78, 1]).rotation.y = Math.PI;
    this.liveDot = mk(g.sphereLo, m.live, this.phoneBody, 0, 0.62, 0, 0.1);
    this.model.traverse((o) => { if (o.isMesh) o.castShadow = (this.ctx.quality?.level ?? 1) >= 2; });
    // snowball templates
    this.ballTpl = new THREE.Mesh(g.sphereLo, m.snow);
    this.extraDispose.push(this.ballTpl);
    this.flyingPhone = null;
  }

  // ------------------------------------------------------------------ AI
  onEnter(state) {
    this.vulnerable = false;
    this.contactHurts = !['ouch', 'rage', 'intro', 'regroup', 'story', 'posted'].includes(state);
    if (state === 'snowballs') { this.left = this.pp(TUNE.balls); this.ballT = 0.4; }
    if (state === 'slide') { this.slidesLeft = this.pp(TUNE.slides); this.sl = { sub: 'wind', t: 0 }; this.aimSlide(); }
  }

  think(dt) {
    const p = this.player;
    switch (this.state) {
      case 'intro':
        this.facePlayer(dt, 3);
        if (this.at(0.3)) { this.say(L.intro); this.sfx('boss_roar', { pitch: 1.1 }); this.shake(0.5); }
        if (this.at(1.6)) { this.flash(0.7); this.sfx('switch'); }
        if (this.at(2.4)) this.say(L.oku, 'oku');
        if (this.st > 3.4) this.next();
        break;
      case 'regroup':
        this.walkTo(this.home.x, this.home.z, dt, 5);
        this.facePlayer(dt);
        if (this.at(0.2)) this.say(L.taunt);
        if (this.st > 1.8) this.next();
        break;
      case 'snowballs':
        this.facePlayer(dt);
        if (this.at(0.1)) this.say(pick(L.balls));
        this.ballT -= dt;
        if (this.left > 0 && this.ballT <= 0) { this.throwBall(); this.left--; this.ballT = this.pp(TUNE.ballEvery); }
        if (this.left <= 0 && this.ballT < -0.7) this.next();
        break;
      case 'slide': this.thinkSlide(dt); break;
      case 'rollball':
        this.facePlayer(dt);
        if (this.at(0.1)) this.say(L.roll);
        if (this.at(0)) this.packBall();
        if (this.st < 1.1 && this.bigBall) {
          const k = clamp(this.st / 1.1, 0, 1);
          this.bigBall.r = 0.3 + k * 0.9;
          this.bigBall.mesh.scale.setScalar(this.bigBall.r);
          this.syncModel();
          this.handWorld(1, this.bigBall.pos);
          this.bigBall.pos.y = this.floor + this.bigBall.r;
        }
        if (this.at(1.1) && this.bigBall) this.kickBall();
        if (this.st > 1.8) this.next();
        break;
      case 'selfie': {
        const cd = this.pp(TUNE.countdown);
        this.facePlayer(dt, 4);
        if (this.at(0.05)) this.say(L.smile);
        for (let i = 0; i < 3; i++) if (this.at(0.15 + i * cd / 3)) {
          this.syncModel();
          this.textFx(this.headWorld(_v), String(3 - i), '#ffffff', { scale: 1.4, life: 0.6 });
          this.sfx('tnt_tick', { pitch: 1 + i * 0.2 });
        }
        if (this.at(cd)) {
          this.flash(0.95);
          this.sfx('switch'); this.sfx('outline_on');
          this.toast(L.flash, 'joke', 1.6);
          this.go('story');
        }
        break;
      }
      case 'story':
        this.vulnerable = this.st > 0.35;
        if (this.at(0.4)) {
          if (!this.saidOnce.has('hint')) this.sayOnce('hint', L.hint, 'oku'); else this.say(pick(L.story));
        }
        if (this.every(0.35, 0.4)) { this.syncModel(); this.burst(this.phoneWorld(_v), [0xff4f8b, 0xff9ac1], 3, { speed: 1.5, up: 3, life: 1.0 }); }
        if (this.st > this.pp(TUNE.story)) this.go('posted');
        break;
      case 'posted':
        if (this.at(0.1)) this.say(L.posted);
        if (this.st > 0.9) this.next();
        break;
      case 'ouch':
        if (this.at(0)) { this.say(pick(L.ouch)); this.throwPhone(); }
        this.walkTo(this.home.x, this.home.z, dt, 2.5);
        if (this.st > 2.1) { if (this.pendingRage) this.go('rage'); else this.next(); }
        break;
      case 'rage':
        this.facePlayer(dt);
        if (this.at(0.15)) { this.sfx('boss_roar'); this.shake(0.7); this.say(this.phase === 1 ? L.rage1 : L.rage2); }
        if (this.every(0.15) && this.st < 1.4) this.burst(_v.set(this.pos.x, this.floor + 0.2, this.pos.z), [0xffffff, 0xcfe8ff], 8, { speed: 6 });
        if (this.st > 2.0) { this.pendingRage = false; this.next(); }
        break;
      default: this.next();
    }
    this.clampArena(this.pos, 2);
    void p;
  }

  walkTo(x, z, dt, speed) {
    const dx = x - this.pos.x, dz = z - this.pos.z, d = Math.hypot(dx, dz);
    if (d < 0.15) return true;
    const st = Math.min(d, speed * dt);
    this.pos.x += dx / d * st; this.pos.z += dz / d * st;
    this.walkSpeed = speed;
    return false;
  }

  handWorld(i, out) { out.copy(this.arms[i].handPos); return this.torso.localToWorld(out); }
  headWorld(out) { out.set(0, 1.2, 0); return this.head.localToWorld(out); }
  phoneWorld(out) { out.set(0, 0, 0); return this.phoneBody.localToWorld(out); }

  throwBall() {
    this.syncModel();
    const from = this.handWorld(1, new THREE.Vector3());
    from.y += 0.5;
    const to = this.aimPoint(0.4);
    to.y = this.floor + 0.3;
    const T = this.pp(TUNE.flight), G = 22;
    const mesh = this.ballTpl.clone();
    mesh.scale.setScalar(0.38);
    const s = this.shot({ mesh, pos: from, vel: this.lobVel(from, to, T, G), r: 0.4, grav: G, life: 6, cause: 'generic', poofColor: 0xffffff });
    s.mark = this.mark(to.x, to.z, 1.1, 0x3d9bff, T + 0.1);
    s.onLand = (sh, boss) => {
      boss.removeShot(sh);
      boss.burst(sh.pos, [0xffffff, 0xdff0ff], 14, { speed: 5 });
      boss.sfx('splash', { pos: sh.pos, pitch: 1.6, vol: 0.6 });
      const p = boss.player;
      if (Math.hypot(p.pos.x - sh.pos.x, p.pos.z - sh.pos.z) < 1.15 && p.pos.y < sh.pos.y + 0.9) boss.hurtPlayer('generic', sh.pos);
    };
    this.throwAnim = 0.3;
    this.sfx('spin', { pitch: 0.8 });
  }

  packBall() {
    const mesh = this.ballTpl.clone();
    mesh.scale.setScalar(0.3);
    this.bigBall = this.shot({ mesh, pos: new THREE.Vector3(this.pos.x, this.floor + 0.3, this.pos.z + 1.5), r: 0.3, life: 30, harmful: false, cause: 'squash' });
    this.bigBall.update = () => {};
  }

  kickBall() {
    const b = this.bigBall;
    this.bigBall = null;
    const p = this.player;
    _v.set(p.pos.x - b.pos.x, 0, p.pos.z - b.pos.z).normalize();
    const sp = this.pp(TUNE.roll);
    b.vel.set(_v.x * sp, 0, _v.z * sp);
    b.harmful = true;
    b.age = 0; b.life = 5;
    const a = this.arena;
    const ex = b.pos.x + _v.x * a.r * 2.4, ez = b.pos.z + _v.z * a.r * 2.4;
    b.mark = this.lineMark(b.pos.x, b.pos.z, ex, ez, 2.2, 0x3d9bff, 1.4);
    b.update = (sh, dt, boss) => {
      sh.mesh.rotation.x += dt * sp / sh.r * Math.sign(sh.vel.z || 1);
      sh.mesh.rotation.z -= dt * sp / sh.r * Math.sign(sh.vel.x || 1) * 0.5;
      const gy = boss.floorAt(sh.pos.x, sh.pos.z, sh.pos.y + 0.5);
      if (gy === -Infinity) { sh.vel.y -= 25 * dt; } else sh.pos.y = Math.max(sh.pos.y, gy + sh.r);
      if (boss.every(0.1)) boss.burst(_v2.set(sh.pos.x, boss.floor, sh.pos.z), 0xffffff, 3, { speed: 2 });
    };
    b.onHitPlayer = () => {}; // keeps rolling (a giant snowball does not care)
    this.sfx('enemy_kick', { pitch: 0.6 });
    this.shake(0.3);
  }

  aimSlide() {
    const p = this.player;
    this.sl.dir = new THREE.Vector3(p.pos.x - this.pos.x, 0, p.pos.z - this.pos.z);
    if (this.sl.dir.lengthSq() < 0.01) this.sl.dir.set(0, 0, 1);
    this.sl.dir.normalize();
    const len = this.arena.r * 2.2;
    this.sl.mark?.done();
    this.sl.mark = this.lineMark(this.pos.x, this.pos.z, this.pos.x + this.sl.dir.x * len, this.pos.z + this.sl.dir.z * len, 2.6, 0xff3b3b, this.pp(TUNE.slideWind) + 0.15);
  }

  thinkSlide(dt) {
    const S = this.sl;
    S.t += dt;
    if (S.sub === 'wind') {
      this.faceTo(this.pos.x + S.dir.x, this.pos.z + S.dir.z, dt, 10);
      if (S.t < 0.05 && this.slidesLeft === this.pp(TUNE.slides)) this.say(pick(L.slide));
      if (S.t > this.pp(TUNE.slideWind)) { S.sub = 'go'; S.t = 0; this.sfx('slide', { pitch: 0.7 }); this.vel.copy(S.dir).multiplyScalar(this.pp(TUNE.slideSpeed)); }
    } else if (S.sub === 'go') {
      this.pos.addScaledVector(this.vel, dt);
      if (this.every(0.07)) this.burst(_v.set(this.pos.x, this.floor, this.pos.z), [0xffffff, 0xcfe8ff], 3, { speed: 3 });
      if (!this.inArena(this.pos.x, this.pos.z, 2.2) || S.t > 2.4) {
        this.clampArena(this.pos, 2.2);
        this.shake(0.35); this.sfx('crate_iron', { pos: this.pos, pitch: 0.8 });
        this.burst(_v.set(this.pos.x, this.floor + 1, this.pos.z), [0xffffff, 0xcfe8ff], 18, { speed: 6 });
        S.sub = 'getup'; S.t = 0;
      }
    } else if (S.sub === 'getup') {
      if (S.t > 0.55) {
        this.slidesLeft--;
        if (this.slidesLeft > 0) { S.sub = 'wind'; S.t = 0; this.aimSlide(); } else this.next();
      }
    }
  }

  throwPhone() {
    // the phone flies off in an arc (cosmetic)
    this.syncModel();
    const from = this.phoneWorld(new THREE.Vector3());
    const ph = this.phoneBody.clone();
    ph.scale.setScalar(1);
    const s = this.shot({ mesh: ph, pos: from, vel: new THREE.Vector3(rand(-4, 4), 11, rand(2, 5)), r: 0.3, grav: 22, life: 3, harmful: false, spin: 12 });
    s.onLand = (sh, boss) => { boss.removeShot(sh, true); boss.sfx('crate_break', { pos: sh.pos, pitch: 1.6, vol: 0.5 }); };
    this.phoneBody.visible = false;
    this.phoneBack = 1.5;
  }

  // ------------------------------------------------------------------ hits
  reflectTarget() { return _t.set(this.pos.x, this.floor + 2, this.pos.z); }
  onReflectArrive() {}
  onHit(how, phaseUp) {
    this.pendingRage = phaseUp;
    this.go('ouch');
  }
  onReset() {
    this.pos.copy(this.home);
    this.pendingRage = false;
    this.bigBall = null;
    this.sl?.mark?.done();
    this.phoneBody.visible = true;
    this.go('regroup');
  }
  onDefeat() { this.go('defeat'); this.bigBall = null; }
  defeatFocus() { return _t.set(this.pos.x, this.floor + 1, this.pos.z); }

  defeatAnim(dt, t) {
    // slips on the ice, spins, falls flat on his back, cries snowflakes
    const b = this.bodyG;
    const k = clamp(t / 0.9, 0, 1);
    this.yaw += dt * Math.max(0, 1 - t) * 18;
    b.rotation.x = -k * Math.PI / 2;
    b.position.y = Math.sin(k * Math.PI) * 1.2 + k * 1.1;
    if (this.at(0.15)) { this.sfx('slide', { pitch: 0.6 }); this.say(L.defeat); }
    if (this.at(0.9)) { this.shake(0.7); this.sfx('land'); this.burst(_v.set(this.pos.x, this.floor, this.pos.z), [0xffffff, 0xcfe8ff], 40, { speed: 8 }); }
    if (this.at(1.1)) this.confetti(_v.set(this.pos.x, this.floor + 2.5, this.pos.z), 50, [0xffffff, 0xcfe8ff, 0xff5fa2, 0x3fd0c0, 0x6ff0ff]);
    if (t > 1.2 && this.every(0.25)) { this.syncModel(); this.burst(this.headWorld(_v), [0x9fd8ff, 0xffffff], 4, { speed: 2, up: 4 }); }
  }

  // ------------------------------------------------------------------ visuals
  animate(dt) {
    const t = this.time, m = this.mats;
    const story = this.state === 'story', selfie = this.state === 'selfie';
    const sliding = this.state === 'slide' && this.sl?.sub === 'go';
    this.crouch = damp(this.crouch, story ? 1 : (this.state === 'slide' && this.sl?.sub === 'wind' ? 0.6 : 0), 8, dt);
    this.belly = damp(this.belly, sliding ? 1 : 0, 12, dt);
    const b = this.bodyG;
    if (!this.defeated) {
      b.rotation.x = this.belly * Math.PI / 2 * 0.95;
      b.position.y = this.belly * 1.25 - this.crouch * 0.5 + (story ? Math.abs(Math.sin(t * 3)) * 0.06 : 0);
      b.rotation.z = story ? Math.sin(t * 2.2) * 0.12 : (this.state === 'ouch' ? Math.sin(t * 25) * 0.08 : 0);
      this.torso.scale.set(1 + this.crouch * 0.06, 1 - this.crouch * 0.1, 1);
    }
    // walking bob
    this.walkSpeed = damp(this.walkSpeed || 0, 0, 5, dt);
    for (const e of this.eyes) wobbleEye(e, t, 1, this.state === 'ouch' || this.defeated);
    this.mouth.scale.y = story ? 0.08 : 0.2; // duck face
    this.mouth.position.z = story ? 0.95 : 0.88;
    this.beanie.rotation.z = Math.sin(t * 2) * 0.08;
    // arms: phone up for selfies, throwing arm, flailing when hurt
    this.throwAnim = Math.max(0, (this.throwAnim || 0) - dt);
    const R = this.arms[1], Lh = this.arms[0];
    if (selfie || story) R.handPos.set(1.2, 1.3 + Math.sin(t * 2) * 0.05, 1.5);
    else if (this.throwAnim > 0 || this.state === 'rollball') R.handPos.set(1.5, 1.5, -0.4);
    else if (this.state === 'ouch' || this.state === 'rage') R.handPos.set(1.7, 1.4 + Math.sin(t * 20) * 0.4, 0.4);
    else if (sliding) R.handPos.set(1.2, 0.2, 1.6);
    else R.handPos.set(1.6, -0.8 + Math.sin(t * 2) * 0.08, 0.35);
    if (story) Lh.handPos.set(-1.2, 0.9 + Math.sin(t * 5) * 0.15, 1.1); // peace sign-ish
    else if (this.state === 'ouch' || this.state === 'rage') Lh.handPos.set(-1.7, 1.4 + Math.cos(t * 20) * 0.4, 0.4);
    else if (sliding) Lh.handPos.set(-1.2, 0.2, 1.6);
    else Lh.handPos.set(-1.6, -0.8 + Math.cos(t * 2) * 0.08, 0.35);
    for (const arm of this.arms) {
      arm.elbow.copy(arm.shoulder).lerp(arm.handPos, 0.5); arm.elbow.x += arm.s * 0.4; arm.elbow.y -= 0.2;
      cylBetween(arm.upper, arm.shoulder, arm.elbow, 0.34);
      cylBetween(arm.lower, arm.elbow, arm.handPos, 0.3);
      arm.hand.position.copy(arm.handPos);
    }
    // phone at the right hand; selfie stick from phase 2; LIVE dot in phase 3
    const stickOn = this.phase >= 1;
    this.phone.position.copy(R.handPos);
    this.stick.visible = stickOn;
    this.stick.position.set(0, stickOn ? 0.8 : 0, 0);
    this.phoneBody.position.set(0, stickOn ? 1.6 : 0.35, 0);
    this.phone.rotation.set(selfie || story ? -0.4 : 0, selfie || story ? Math.PI : 0, 0);
    this.liveDot.visible = this.phase >= 2 && Math.sin(t * 8) > 0;
    m.screen.emissiveIntensity = selfie ? 1.2 + Math.sin(t * 20) * 0.8 : 1.2;
    if (this.phoneBack > 0) { this.phoneBack -= dt; if (this.phoneBack <= 0) this.phoneBody.visible = true; }
    // hit boxes: body (contact + spin target), head top (stomp)
    const top = sliding ? 2.0 : 4.6 - this.crouch * 0.9;
    const half = sliding ? 1.8 : 1.45;
    setBox(this.bodyBox, this.pos.x, this.floor, this.pos.z, half, top, half);
    setBox(this.spinBoxY, this.pos.x, this.floor, this.pos.z, 1.5, 3.2, 1.5);
    setBox(this.weak, this.pos.x, this.floor + top - 1.0, this.pos.z, 1.3, 1.0, 1.3);
  }

  botHint() {
    if (this.defeated || !this.vulnerable || this.invulnT > 0) return null;
    return { action: 'spin', pos: this.towardCenter(this.pos.x, this.pos.z, 1.9) };
  }
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _t = new THREE.Vector3();
