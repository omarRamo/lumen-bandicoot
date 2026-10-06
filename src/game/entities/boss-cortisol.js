// B4 — Docteur Néo Cortisol (finale) & BS — Cortisol Doré (boss secret, remix doré, plus dur, il chante faux,
// invoque des caisses nitro). Tête ÉNORME gonflée de stress, « C » sur le front, blouse trop courte, hover-pod.
// Phases 1-2 : hover-pod (bombes de stress, lasers balayants à sauter, rats de labo) → le pod surchauffe et se pose
// = vulnérable (toupie dans la soucoupe / saut sur la tête). Phase 3 : il s'arrime au STRESSOTRON qui crache des boules
// d'énergie : on les renvoie à la toupie (il en renvoie de plus en plus : tennis !). Fin : Zina la fennec est libérée.
import * as THREE from 'three';
import { BossBase, mk, grp, std, basic, googly, wobbleEye, cylBetween, setBox, aabb, rand, clamp, t2, pick, damp, TAU, angDiff } from './boss-kit.js';

const NAMES = { cortisol: t2('Docteur Néo Cortisol', 'Doctor Neo Cortisol'), golden: t2('Cortisol Doré', 'Golden Cortisol') };
const TUNE = {
  hover: 3.6, bombs: [3, 4, 5], bombEvery: [0.6, 0.5, 0.42], fuse: [1.7, 1.45, 1.25],
  beams: [1, 2, 2], omega: [1.45, 1.75, 2.0], turns: [1.1, 1.25, 1.25], overheat: [4.4, 3.8, 3.2],
  rats: [0, 3, 3], ball: [8.0, 8.0, 8.5], sweepSpeed: [1.3, 1.3, 1.5], nitro: [3, 4, 5],
};
const GOLD_MUL = 1.18;
const SCRIPTS = {
  cortisol: [
    ['hover', 'bombs', 'laser'],
    ['rats', 'hover', 'bombs', 'laser'],
    ['ball', 'bombs', 'ball', 'sweep'],
  ],
  golden: [
    ['hover', 'bombs', 'nitro', 'laser'],
    ['sing', 'rats', 'hover', 'nitro', 'laser'],
    ['ball', 'nitro', 'ball', 'sweep', 'sing'],
  ],
};
const L = {
  intro: [t2('Ah, Lumen ! Le petit bandicoot !', 'Ah, Lumen! The little bandicoot!'), t2('Je suis un renard.', 'I\'m a fox.'),
    t2('Peu importe ! Bienvenue dans mon usine. Ici, tout le monde STRESSE !', 'Whatever! Welcome to my factory. Here, everybody STRESSES!'),
    t2('Lumen ! Il a mangé toutes mes chips ! Fais-lui sa fête !', 'Lumen! He ate all my chips! Get him!')],
  gIntro: [t2('Tu croyais m\'avoir battu ? J\'ai pris un bain d\'or. Ça détend.', 'Thought you beat me? I took a gold bath. Very relaxing.'),
    t2('Il brille. Pourquoi il brille ?', 'He\'s shiny. Why is he shiny?'),
    t2('♪ Je suis doré, je suis doréééé ♪', '♪ I am golden, I am gooolden ♪'),
    t2('Encore lui ?! Et il chante, maintenant ?!', 'Him again?! And now he sings?!')],
  bombs: [t2('Bombes de stress ! Livrées en 30 secondes !', 'Stress bombs! Delivered in 30 seconds!'), t2('Tiens, un petit ulcère !', 'Here, have a little ulcer!')],
  laser: [t2('LASER ! Sautez, sautez, petit bandicoot !', 'LASER! Jump, jump, little bandicoot!'), t2('Ça s\'appelle un « burn-out laser ».', 'It\'s called a "burnout laser".')],
  overheat: [t2('Surchauffe ?! Pas maintenant !', 'Overheating?! Not now!'), t2('Qui a branché la bouilloire sur le pod ?!', 'Who plugged the kettle into the pod?!')],
  hint: t2('Il surchauffe ! Toupie dans la soucoupe ! Ou saute sur sa grosse tête !', 'He\'s overheating! Spin the saucer! Or jump on his big head!'),
  hint2: t2('Renvoie ses boules d\'énergie à la toupie ! Comme au tennis, mais en plus stressant.', 'Spin his energy balls back! Like tennis, but more stressful.'),
  restart: t2('Redémarrage… Ne touchez à rien !', 'Rebooting… Don\'t touch anything!'),
  rats: t2('Mes rats ! Ils ont un doctorat !', 'My rats! They have PhDs!'),
  ouch: [t2('AAARGH ! Mon taux de cortisol !', 'AAARGH! My cortisol levels!'), t2('Ce n\'est PAS une crise de nerfs !', 'This is NOT a meltdown!'),
    t2('Ma tête ! Elle gonfle ! Encore !', 'My head! It\'s swelling! Again!')],
  rage1: t2('Bon. Plan B : des rats. Des rats en blouse. Diplômés.', 'Fine. Plan B: rats. Rats in lab coats. Graduated.'),
  rage2: t2('Assez joué ! STRESSOTRON, PLEINE PUISSANCE !', 'Enough! STRESSOTRON, FULL POWER!'),
  volley: [t2('Ha ! Revers !', 'Ha! Backhand!'), t2('Quinze-zéro !', 'Fifteen-love!'), t2('J\'ai fait du tennis au lycée !', 'I played tennis in high school!')],
  machine: [t2('Il SURCHAUFFE ! Mon beau Stressotron !', 'It\'s OVERHEATING! My beautiful Stressotron!'), t2('La jauge ! Regardez la jauge !', 'The gauge! Look at the gauge!')],
  taunt: t2('Hé hé ! Respire, petit bandicoot. Respire…', 'Heh heh! Breathe, little bandicoot. Breathe…'),
  sing: [t2('♪ Stressotron, mon amour, tu chauffes nuit et jouuur ♪', '♪ Stressotron, my love, you overheat from above ♪'),
    t2('♪ Do, ré, mi, fa… SOL-DORÉ ♪', '♪ Do, re, mi, fa… SO-GOLDEN ♪'), t2('♪ Je suis le plus beau, le plus brillaaant ♪', '♪ I\'m the fairest, the shiniest of aaall ♪')],
  nitro: [t2('Caisses nitro ! Elles sont en or aussi ! (Non.)', 'Nitro crates! They\'re gold too! (No.)'), t2('Livraison de nitro express !', 'Express nitro delivery!')],
  defeat: t2('Je reviendraiii… après une sieeeste !', 'I\'ll be baaack… after a naaap!'),
  gDefeat: t2('Mon costume… en or… massif…', 'My suit… solid… gold…'),
  zina: t2('Lumen ! Tu en as mis du temps ! …Et c\'est quoi ce masque qui parle ?', 'Lumen! You took your time! …And what\'s with the talking mask?'),
  oku: t2('Je suis un masque ANCESTRAL, madame.', 'I am an ANCESTRAL mask, madam.'),
  gZina: t2('Bon. Il était doré. On rentre ? J\'ai faim.', 'Okay. He was golden. Can we go home? I\'m hungry.'),
  gOku: t2('Je suis toujours en carton, au cas où.', 'I\'m still made of cardboard, just so you know.'),
};

export function createCortisol(def, ctx, golden) { return new Cortisol(def, ctx, golden).entity; }

class Cortisol extends BossBase {
  constructor(def, ctx, golden) {
    super(def, ctx, {
      name: golden ? NAMES.golden : NAMES.cortisol, speaker: 'cortisol', hitsPerPhase: golden ? [3, 3, 3] : [2, 2, 3], defeatTime: 4.4,
    });
    this.golden = golden;
    this.k = golden ? GOLD_MUL : 1;
    this.scripts = SCRIPTS[golden ? 'golden' : 'cortisol'];
    this.hitModes = { stomp: true, spin: true, slam: true };
    this.preferSpin = true;
    this.podBox = aabb(); this.headBox = aabb(); this.podBox.cause = 'generic';
    this.body = [this.podBox, this.headBox];
    this.spinTarget = this.podBox;
    this.goal = new THREE.Vector3(def.x, this.floor + TUNE.hover, def.z);
    const mp = def.machine || [def.x, this.floor, def.z - 10];
    const cp = def.cage || [def.x + 5, this.floor, def.z - 9.5];
    this.machinePos = new THREE.Vector3(mp[0], mp[1], mp[2]);
    this.cagePos = new THREE.Vector3(cp[0], cp[1], cp[2]);
    this.dock = new THREE.Vector3(mp[0] - 3.2, mp[1] + 2.8, mp[2] + 2.6);
    this.beams = [];
    this.inflate = 0; this.heat = 0; this.power = 0;
    this.build();
    this.pos.set(def.x, this.floor + TUNE.hover + 12, def.z);
    this.go('intro');
  }

  sp(arr) { return this.pp(arr) * this.k; }

  // ------------------------------------------------------------------ model
  build() {
    const g = this.geo, G = this.golden;
    g.saucer = new THREE.CylinderGeometry(1.75, 1.1, 0.65, 28);
    g.edges = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const gold = (c, o = {}) => (G ? std(0xffcf40, { rough: 0.22, metal: 0.95, ...o, emissive: o.emissive ?? 0x3a2800 }) : std(c, o));
    this.mats = {
      pod: gold(0x8b7fa8, { metal: 0.6, rough: 0.35 }), podDark: gold(0x4a4060, { metal: 0.5, rough: 0.4 }),
      skin: G ? std(0xffd75e, { rough: 0.3, metal: 0.7, emissive: 0x403000 }) : std(0xf3d9a6, { rough: 0.55 }),
      coat: G ? std(0xfff1b0, { rough: 0.4, metal: 0.4 }) : std(0xffffff, { rough: 0.6 }), pants: gold(0x5d2d8a),
      tie: std(0xd8262f), C: std(0xd8262f, { emissive: 0x400000 }), vein: std(0xd84a4a), hair: G ? std(0xfff2a8, { metal: 0.6 }) : std(0x9a9aa8),
      black: std(0x111111), white: std(0xffffff, { rough: 0.3 }), lens: std(0xbfe8ff, { opacity: 0.45, rough: 0.05, depthWrite: false }),
      glove: std(0x1a1a1a), light: basic(0xff4fd8), flame: basic(0xffa23c, { opacity: 0.85, additive: true }),
      machine: gold(0x3d3550, { metal: 0.6, rough: 0.35 }), copper: G ? std(0xffe08a, { metal: 1, rough: 0.2 }) : std(0xd9823b, { metal: 0.8, rough: 0.3 }),
      glass: std(0xc8b5ff, { opacity: 0.35, rough: 0.05, depthWrite: false }), core: basic(0xb44cff),
      stripeY: std(0xffd23f), stripeK: std(0x1a1a1a), dial: std(0xfff7e8), needle: std(0xff2a2a),
      beam: basic(0xff2a4a), beamGlow: basic(0xff2a4a, { opacity: 0.35, additive: true }),
      ball: basic(0x6dffe0), ballGlow: basic(0x3dffc0, { opacity: 0.35, additive: true }),
      bomb: std(0x8a2bd8, { emissive: 0x3a0060, rough: 0.4 }), bombMark: basic(0xffe14a),
      fur: std(0xf2d39a), furIn: std(0xffb0c0), bow: std(0xff5fa2), bar: std(0x8a8a98, { metal: 0.8, rough: 0.3 }),
      rat: std(0x9a8f99), ratPink: std(0xffa8c0), goggle: std(0x6ff0ff, { emissive: 0x106070 }),
      nitro: std(0x35e04a, { emissive: 0x0c5a14, rough: 0.5 }), nitroEdge: new THREE.LineBasicMaterial({ color: 0x0a2a0a }),
    };
    this.buildPod();
    this.buildMachine();
    this.buildCage();
    this.buildTemplates();
    const q = this.ctx.quality?.level ?? 1;
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = q >= 2; });
  }

  buildPod() {
    const g = this.geo, m = this.mats;
    const pod = grp(this.model);
    this.pod = pod;
    mk(g.saucer, m.pod, pod, 0, 0.32, 0);
    mk(g.torus, m.podDark, pod, 0, 0.64, 0, [1.72, 1.72, 0.55]).rotation.x = Math.PI / 2;
    this.lights = [];
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      this.lights.push(mk(g.sphereLo, m.light.clone(), pod, Math.cos(a) * 1.55, 0.42, Math.sin(a) * 1.55, 0.1));
    }
    this.flames = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU + 0.5;
      const j = mk(g.cone, m.podDark, pod, Math.cos(a) * 0.65, -0.05, Math.sin(a) * 0.65, [0.25, 0.35, 0.25]);
      j.rotation.x = Math.PI;
      const f = mk(g.cone, m.flame, pod, Math.cos(a) * 0.65, -0.45, Math.sin(a) * 0.65, [0.2, 0.6, 0.2]);
      f.rotation.x = Math.PI;
      this.flames.push(f);
    }
    // the doctor
    const doc = grp(pod, 0, 0.5, 0);
    this.doc = doc;
    mk(g.cyl, m.pants, doc, 0, 0.3, 0, [0.42, 0.6, 0.42]);
    mk(g.cyl, m.coat, doc, 0, 0.85, 0, [0.55, 0.6, 0.5]); // too short, obviously
    mk(g.box, m.tie, doc, 0, 0.85, 0.5, [0.14, 0.5, 0.05]);
    this.arms = [-1, 1].map((s) => {
      const sh = new THREE.Vector3(s * 0.55, 1.05, 0.05);
      const arm = mk(g.cyl, m.coat, doc), hand = mk(g.sphere, m.glove, doc, 0, 0, 0, 0.16);
      return { s, sh, arm, hand, handPos: new THREE.Vector3(s * 0.7, 0.55, 0.7) };
    });
    // THE HEAD
    const head = grp(doc, 0, 2.35, 0.05);
    this.head = head;
    this.skull = mk(g.sphere, m.skin, head, 0, 0, 0, [1.28, 1.2, 1.22]);
    const C = mk(g.arcC, m.C, head, 0, 0.42, 1.12, [0.34, 0.34, 0.4]);
    C.rotation.z = 0.87;
    C.rotation.x = -0.35;
    this.veins = [];
    for (const [x, y, z, r] of [[0.75, 0.6, 0.6, 0.6], [-0.8, 0.5, 0.55, -0.5], [0.3, 0.95, 0.4, 0.2]]) {
      const v = mk(g.arcHalf, m.vein, head, x, y, z, [0.2, 0.2, 0.3]);
      v.rotation.set(-0.5, 0, r);
      this.veins.push(v);
    }
    for (const s of [-1, 1]) {
      mk(g.torusThin, m.black, head, s * 0.34, -0.12, 1.13, 0.22);
      mk(g.disc, m.lens, head, s * 0.34, -0.12, 1.15, 0.2);
      mk(g.sphereLo, m.black, head, s * 0.34, -0.12, 1.08, 0.07);
      const brow = mk(g.box, m.hair, head, s * 0.34, 0.15, 1.12, [0.36, 0.07, 0.07]);
      brow.rotation.z = s * 0.35;
      mk(g.sphereLo, m.skin, head, s * 1.25, -0.3, 0, [0.14, 0.24, 0.12]);
      for (let i = 0; i < 4; i++) {
        const tuft = mk(g.cone, m.hair, head, s * 1.15, -0.05 + i * 0.22, -0.35 + (i % 2) * 0.25, [0.13, 0.5, 0.13]);
        tuft.rotation.z = -s * (1.1 + i * 0.12);
      }
    }
    mk(g.sphere, m.skin, head, 0, -0.38, 1.2, [0.16, 0.14, 0.16]);
    const frown = mk(g.arcHalf, m.black, head, 0, -0.72, 1.06, [0.3, 0.16, 0.25]);
    void frown;
    mk(g.box, m.white, head, 0, -0.8, 1.08, [0.42, 0.1, 0.05]);
    const goatee = mk(g.cone, m.hair, head, 0, -1.2, 0.92, [0.13, 0.35, 0.13]);
    goatee.rotation.x = Math.PI;
    // blob shadow
    this.shadow = mk(g.disc, new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }), this.root);
    this.shadow.rotation.x = -Math.PI / 2;
  }

  buildMachine() {
    const g = this.geo, m = this.mats;
    const M = grp(this.root, this.machinePos.x, this.machinePos.y, this.machinePos.z);
    this.machine = M;
    mk(g.box, m.machine, M, 0, 0.55, 0, [5.2, 1.1, 3.2]);
    for (let i = 0; i < 8; i++) {
      const s = mk(g.box, i % 2 ? m.stripeY : m.stripeK, M, -2.275 + i * 0.65, 0.55, 1.62, [0.65, 0.6, 0.04]);
      s.rotation.z = 0.5;
    }
    this.coreGlow = mk(g.cyl, m.core, M, 0, 2.7, 0, [0.6, 3.0, 0.6]);
    mk(g.cyl, m.glass, M, 0, 2.7, 0, [1.15, 3.3, 1.15]);
    this.coils = [1.5, 2.6, 3.7].map((y) => mk(g.torus, m.copper, M, 0, y, 0, [1.35, 1.35, 1.0]));
    this.coils.forEach((c) => { c.rotation.x = Math.PI / 2; });
    mk(g.hemi, m.machine, M, 0, 4.35, 0, 1.25);
    mk(g.cyl, m.copper, M, 0, 5.8, 0, [0.06, 1.6, 0.06]);
    this.antenna = mk(g.sphereLo, m.core, M, 0, 6.65, 0, 0.22);
    // nozzle
    const nz = mk(g.cyl, m.copper, M, 0, 2.6, 1.35, [0.4, 0.9, 0.4]);
    nz.rotation.x = Math.PI / 2;
    this.nozzleGlow = mk(g.sphere, m.ball, M, 0, 2.6, 1.9, 0.01);
    // gauge
    mk(g.box, m.machine, M, 2.3, 2.6, 0.9, [1.6, 1.6, 0.4]);
    mk(g.disc, m.dial, M, 2.3, 2.7, 1.11, 0.62);
    this.needle = grp(M, 2.3, 2.7, 1.13);
    mk(g.box, m.needle, this.needle, 0, 0.25, 0, [0.06, 0.5, 0.02]);
    // tubes
    for (const s of [-1, 1]) cylBetween(mk(g.cyl, m.copper, M), new THREE.Vector3(s * 2.4, 1.1, 0), new THREE.Vector3(s * 1.0, 4.0, 0), 0.12);
  }

  buildCage() {
    const g = this.geo, m = this.mats;
    const C = grp(this.root, this.cagePos.x, this.cagePos.y, this.cagePos.z);
    this.cage = C;
    mk(g.cyl, m.bar, C, 0, 0.08, 0, [1.0, 0.16, 1.0]);
    this.cageTop = grp(C);
    mk(g.cyl, m.bar, this.cageTop, 0, 2.3, 0, [1.0, 0.14, 1.0]);
    mk(g.torus, m.bar, this.cageTop, 0, 2.65, 0, [0.25, 0.25, 0.3]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      mk(g.cyl, m.bar, this.cageTop, Math.cos(a) * 0.95, 1.2, Math.sin(a) * 0.95, [0.04, 2.2, 0.04]);
    }
    // Zina the fennec
    const z = grp(C, 0, 0.16, 0);
    this.zina = z;
    mk(g.sphere, m.fur, z, 0, 0.45, 0, [0.32, 0.42, 0.28]);
    const head = grp(z, 0, 1.0, 0.02);
    this.zinaHead = head;
    mk(g.sphere, m.fur, head, 0, 0, 0, 0.3);
    mk(g.sphere, m.fur, head, 0, -0.06, 0.25, [0.13, 0.11, 0.18]);
    mk(g.sphereLo, m.black, head, 0, -0.04, 0.42, 0.045);
    for (const s of [-1, 1]) {
      const ear = mk(g.cone, m.fur, head, s * 0.24, 0.42, -0.02, [0.17, 0.6, 0.08]);
      ear.rotation.z = -s * 0.35;
      const inner = mk(g.cone, m.furIn, head, s * 0.23, 0.4, 0.02, [0.11, 0.45, 0.04]);
      inner.rotation.z = -s * 0.35;
      mk(g.sphereLo, m.black, head, s * 0.11, 0.06, 0.25, 0.05);
    }
    mk(g.sphereLo, m.bow, head, 0.3, 0.38, 0.05, [0.14, 0.09, 0.07]);
    mk(g.sphereLo, m.fur, z, 0, 0.3, -0.35, [0.14, 0.14, 0.28]);
    this.zinaArm = mk(g.cyl, m.fur, z, 0.3, 0.65, 0.1, [0.06, 0.35, 0.06]);
  }

  buildTemplates() {
    const g = this.geo, m = this.mats;
    // stress bomb: purple ball with a "!" on top
    const b = new THREE.Group();
    mk(g.sphere, m.bomb, b, 0, 0, 0, 0.42);
    mk(g.box, m.bombMark, b, 0, 0.66, 0, [0.12, 0.32, 0.12]);
    mk(g.sphereLo, m.bombMark, b, 0, 0.38, 0, 0.07);
    this.bombTpl = b;
    // energy ball
    const e = new THREE.Group();
    mk(g.sphere, m.ball, e, 0, 0, 0, 0.42);
    mk(g.sphere, m.ballGlow, e, 0, 0, 0, 0.7);
    const ring = mk(g.torusThin, m.ball, e, 0, 0, 0, 0.75);
    ring.rotation.x = 1.2;
    this.ballTpl = e;
    // lab rat in a lab coat
    const r = new THREE.Group();
    mk(g.sphere, m.rat, r, 0, 0.3, 0, [0.3, 0.26, 0.45]);
    mk(g.box, m.white, r, 0, 0.36, -0.05, [0.62, 0.32, 0.62]);
    const nose = mk(g.cone, m.rat, r, 0, 0.36, 0.55, [0.16, 0.35, 0.16]);
    nose.rotation.x = Math.PI / 2;
    mk(g.sphereLo, m.ratPink, r, 0, 0.36, 0.74, 0.06);
    for (const s of [-1, 1]) {
      mk(g.sphereLo, m.ratPink, r, s * 0.18, 0.6, 0.3, [0.12, 0.12, 0.04]);
      mk(g.torusThin, m.goggle, r, s * 0.1, 0.48, 0.42, 0.08);
    }
    cylBetween(mk(g.cyl, m.ratPink, r), new THREE.Vector3(0, 0.25, -0.4), new THREE.Vector3(0, 0.15, -1.0), 0.03);
    r.scale.setScalar(1.3);
    this.ratTpl = r;
    // nitro crate (golden fight)
    const n = new THREE.Group();
    mk(g.box, m.nitro, n, 0, 0.45, 0, 0.9);
    const ed = new THREE.LineSegments(g.edges, m.nitroEdge);
    ed.position.y = 0.45; ed.scale.setScalar(0.92);
    n.add(ed);
    mk(g.box, m.stripeK, n, 0, 0.45, 0.455, [0.5, 0.12, 0.01]);
    this.nitroTpl = n;
    // beams
    for (let i = 0; i < 3; i++) {
      const bg = new THREE.Group();
      mk(g.box, m.beam, bg, 0.5, 0, 0, [1, 0.16, 0.16]);
      mk(g.box, m.beamGlow, bg, 0.5, 0, 0, [1, 0.45, 0.45]);
      bg.visible = false;
      this.root.add(bg);
      this.beams.push({ g: bg, ang: 0, on: false });
    }
    this.extraDispose.push(b, e, r, n);
  }

  // ------------------------------------------------------------------ helpers
  headWorld(out) { return out.set(this.pos.x, this.pos.y + 0.5 + 2.35 * this.headLift(), this.pos.z); }
  headLift() { return 1; }
  nozzleWorld(out) { return out.set(this.machinePos.x, this.machinePos.y + 2.6, this.machinePos.z + 2.0); }
  moveTo(x, y, z, dt, rate = 2.5) {
    this.pos.x = damp(this.pos.x, x, rate, dt); this.pos.y = damp(this.pos.y, y, rate, dt); this.pos.z = damp(this.pos.z, z, rate, dt);
  }

  // ------------------------------------------------------------------ AI
  onEnter(state) {
    this.vulnerable = false;
    this.contactHurts = !['ouch', 'rage', 'intro', 'regroup', 'overheat', 'toMachine'].includes(state);
    for (const b of this.beams) { b.on = false; b.g.visible = false; }
    if (state === 'hover') {
      const a = this.arena, ang = rand(0, TAU), r = rand(2, a.r - 4);
      this.goal.set(a.x + Math.cos(ang) * r, this.floor + TUNE.hover + rand(0, 0.8), a.z + Math.sin(ang) * r);
    }
    if (state === 'bombs') { this.left = this.pp(TUNE.bombs) + (this.golden ? 1 : 0); this.bombT = 0.3; }
    if (state === 'laser') { this.ls = { sub: 'move', t: 0 }; }
    if (state === 'ball') { this.bs = { sub: 'charge', t: 0, ball: null }; }
    if (state === 'sweep') { this.sw = { sub: 'tele', t: 0, mark: null }; }
  }

  think(dt) {
    const a = this.arena;
    const docked = this.phase >= 2 && this.state !== 'toMachine';
    if (docked && this.state !== 'ouch') this.moveTo(this.dock.x, this.dock.y + Math.sin(this.time * 2) * 0.15, this.dock.z, dt, 3);
    this.facePlayer(dt, 3);
    switch (this.state) {
      case 'intro': {
        this.moveTo(this.home.x, this.floor + TUNE.hover, this.home.z, dt, 2.2);
        if (this.at(0)) {
          const lines = this.golden ? L.gIntro : L.intro;
          const speakers = ['cortisol', 'lumen', 'cortisol', 'zina'];
          lines.forEach((ln, i) => this.sayLater(0.3 + i * 2.6, ln, speakers[i]));
        }
        if (this.golden && this.st > 4.6) this.singTick();
        if (this.at(0.8)) { this.sfx('boss_roar'); this.shake(0.5); }
        if (this.st > 5.2) this.next();
        break;
      }
      case 'regroup':
        if (!docked) this.moveTo(this.home.x, this.floor + TUNE.hover, this.home.z, dt);
        if (this.at(0.2)) this.say(L.taunt);
        if (this.st > 1.6) this.next();
        break;
      case 'hover':
        this.moveTo(this.goal.x, this.goal.y, this.goal.z, dt, 2.2);
        if (this.st > 1.5) this.next();
        break;
      case 'bombs':
        if (!docked) this.moveTo(this.goal.x, this.floor + TUNE.hover + 0.4, this.goal.z, dt, 1);
        if (this.at(0.1)) this.say(pick(L.bombs));
        this.bombT -= dt;
        if (this.left > 0 && this.bombT <= 0) { this.dropBomb(); this.left--; this.bombT = this.pp(TUNE.bombEvery) / this.k; }
        if (this.left <= 0 && this.bombT < -0.8) this.next();
        break;
      case 'laser': this.thinkLaser(dt); break;
      case 'overheat': {
        this.moveTo(this.pos.x, this.floor, this.pos.z, dt, 9);
        this.vulnerable = this.st > 0.45;
        if (this.at(0.2)) {
          this.shake(0.5); this.sfx('crate_iron', { pitch: 0.6 }); this.sfx('robot');
          if (!this.saidOnce.has('hint')) this.sayOnce('hint', L.hint, 'oku'); else this.say(pick(L.overheat));
        }
        if (this.every(0.18)) this.burst(_v.set(this.pos.x + rand(-1, 1), this.pos.y + 1, this.pos.z + rand(-1, 1)), [0x666677, 0x999aa8, 0xffa23c], 4, { speed: 2, up: 4, life: 1 });
        if (this.st > this.pp(TUNE.overheat)) this.go('liftoff');
        break;
      }
      case 'liftoff':
        if (this.at(0)) this.say(L.restart);
        this.moveTo(this.pos.x, this.floor + TUNE.hover, this.pos.z, dt, 3);
        if (this.st > 0.9) this.next();
        break;
      case 'rats':
        if (this.at(0.1)) this.say(L.rats);
        if (this.at(0.6)) this.spawnRats(this.pp(TUNE.rats) || 3);
        if (this.st > 1.4) this.next();
        break;
      case 'nitro':
        if (this.at(0.1)) this.say(pick(L.nitro));
        if (this.at(0.3)) this.spawnNitro(this.pp(TUNE.nitro));
        if (this.st > 2.0) this.next();
        break;
      case 'sing':
        if (this.at(0.05)) this.say(pick(L.sing));
        this.singTick();
        if (this.st > 2.2) this.next();
        break;
      case 'ball': this.thinkBall(dt); break;
      case 'sweep': this.thinkSweep(dt); break;
      case 'ouch':
        if (this.at(0)) { this.say(pick(this.phase >= 2 && !this.pendingRage ? L.machine : L.ouch)); this.ouchFrom = this.pos.y; }
        if (this.phase < 2 || this.pendingRage) this.moveTo(this.pos.x, this.floor + TUNE.hover + 1, this.pos.z, dt, 2);
        if (this.st > 2.1) { if (this.pendingRage) this.go(this.phase >= 2 ? 'toMachine' : 'rage'); else this.next(); }
        break;
      case 'rage':
        if (this.at(0.15)) { this.sfx('boss_roar'); this.shake(0.7); this.say(L.rage1); }
        if (this.st > 1.9) { this.pendingRage = false; this.next(); }
        break;
      case 'toMachine':
        if (this.at(0.1)) { this.say(L.rage2); this.sfx('boss_roar'); }
        this.moveTo(this.dock.x, this.dock.y, this.dock.z, dt, 1.6);
        this.power = clamp(this.st / 2.6, 0, 1);
        if (this.at(1.6)) { this.shake(0.8); this.sfx('rumble'); this.sfx('robot', { pitch: 0.7 }); }
        if (this.every(0.2, 1.6)) this.burst(_v.set(this.machinePos.x, this.floor + 6.6, this.machinePos.z), [0xb44cff, 0xffffff], 6, { speed: 4 });
        if (this.st > 2.8) { this.pendingRage = false; this.sayOnce('hint2', L.hint2, 'oku'); this.next(); }
        break;
      default: this.next();
    }
    void a;
  }

  singTick() {
    if (this.every(0.22)) {
      this.sfx('honk', { pitch: rand(0.6, 1.8), vol: 0.5 });
      this.headWorld(_v);
      this.burst(_v.set(_v.x + rand(-1, 1), _v.y + 1.2, _v.z), [0xffd23f, 0xffffff, 0xff5fa2], 2, { speed: 1.5, up: 3, life: 1.1, gravity: 1 });
    }
  }

  dropBomb() {
    const from = new THREE.Vector3(this.pos.x, this.pos.y - 0.2, this.pos.z);
    const to = this.aimPoint(0.35);
    if (this.left % 2 === 0) { to.x += rand(-2, 2); to.z += rand(-2, 2); this.clampArena(to, 0.8); }
    to.y = this.floor + 0.42;
    const T = 0.95, Gr = 22;
    const s = this.shot({ mesh: this.bombTpl.clone(), pos: from, vel: this.lobVel(from, to, T, Gr), r: 0.42, grav: Gr, life: 8, cause: 'explode', poofColor: 0x8a2bd8 });
    s.mark = this.mark(to.x, to.z, 1.2, 0xb44cff, T + 0.1);
    s.onLand = (sh, boss) => {
      sh.landed = true; sh.vel.set(0, 0, 0); sh.fuse = boss.pp(TUNE.fuse) / boss.k;
      sh.mark?.done(); sh.mark = boss.mark(sh.pos.x, sh.pos.z, 1.8, 0xb44cff, 0, { blink: 12 });
      boss.sfx('crate_bounce', { pos: sh.pos, pitch: 0.8 });
    };
    s.update = (sh, dt, boss) => {
      if (!sh.landed) return;
      sh.fuse -= dt;
      sh.mesh.scale.setScalar(1 + Math.abs(Math.sin(boss.time * (10 + (1 - sh.fuse) * 20))) * 0.15);
      sh.tick = (sh.tick ?? 0) - dt;
      if (sh.tick <= 0) { sh.tick = 0.35; boss.sfx('tnt_tick', { pos: sh.pos, pitch: 0.9 }); }
      if (sh.fuse <= 0) { boss.removeShot(sh); boss.boom(_v.copy(sh.pos), 1.8, [0xb44cff, 0xff5fd8, 0xffffff, 0x5a2a8a]); }
    };
    this.sfx('spin', { pitch: 0.5 });
  }

  spawnRats(n) {
    for (let i = 0; i < n; i++) {
      const pos = new THREE.Vector3(this.pos.x + rand(-1.2, 1.2), this.pos.y, this.pos.z + rand(-1.2, 1.2));
      const mn = this.minion({ mesh: this.ratTpl.clone(), pos, r: 0.45, h: 0.75, speed: (3.2 + i * 0.3) * this.k, life: 16, wake: 0.8, color: 0x9a8f99 });
      mn.anim = (m, dt, boss) => { m.mesh.children[0].position.y = 0.3 + Math.abs(Math.sin(boss.time * 16 + m.age * 3)) * 0.05; };
    }
    this.sfx('robot', { pitch: 1.6 });
  }

  spawnNitro(n) {
    const a = this.arena, p = this.player;
    for (let i = 0; i < n; i++) {
      const pos = new THREE.Vector3();
      if (i === 0) pos.set(p.pos.x + rand(-1.5, 1.5), this.floor, p.pos.z + rand(-1.5, 1.5));
      else { const ang = rand(0, TAU), r = rand(2, a.r - 1.5); pos.set(a.x + Math.cos(ang) * r, this.floor, a.z + Math.sin(ang) * r); }
      this.clampArena(pos, 1.2);
      const mark = this.mark(pos.x, pos.z, 1.0, 0x35e04a, 1.0);
      void mark;
      const spawnAt = pos.clone(); spawnAt.y = this.floor + 9;
      const mn = this.minion({ mesh: this.nitroTpl.clone(), pos: spawnAt, r: 0.5, h: 0.95, speed: 1.1, life: 11, explodeOnTouch: true, boomR: 1.9,
        boomColors: [0x35e04a, 0xb6ff8a, 0xffffff, 0x0c5a14], color: 0x35e04a });
      mn.think = (m, dt, boss) => {
        if (!m.grounded) return;
        m.hop = (m.hop ?? rand(0, 0.6)) - dt;
        if (m.hop <= 0) {
          m.hop = 0.8;
          m.vel.y = 5;
          const pp = boss.player.pos;
          _v.set(pp.x - m.pos.x, 0, pp.z - m.pos.z).normalize();
          const ahead = boss.floorAt(m.pos.x + _v.x, m.pos.z + _v.z, m.pos.y + 1);
          if (ahead > -Infinity) { m.vel.x = _v.x * m.speed; m.vel.z = _v.z * m.speed; } else { m.vel.x = 0; m.vel.z = 0; }
          boss.sfx('nitro_bounce', { pos: m.pos, vol: 0.4 });
        }
      };
      mn.onExpire = (m, boss) => { boss.removeMinion(m); boss.boom(_v.set(m.pos.x, m.pos.y + 0.5, m.pos.z), 1.9, m.boomColors); };
    }
  }

  // --- radial laser sweep from the pod (phases 1-2), then overheat
  thinkLaser(dt) {
    const S = this.ls, a = this.arena;
    S.t += dt;
    const nb = this.pp(TUNE.beams) + (this.golden && this.phase >= 1 ? 1 : 0);
    if (S.sub === 'move') {
      this.moveTo(a.x, this.floor + 0.9, a.z, dt, 2.6);
      if (S.t > 1.3) {
        S.sub = 'tele'; S.t = 0; S.base = rand(0, TAU); S.dir = Math.random() < 0.5 ? 1 : -1;
        this.say(pick(L.laser));
        S.marks = [];
        for (let i = 0; i < nb; i++) {
          const ang = S.base + i * TAU / nb, len = a.r + 2;
          const dx = Math.cos(ang), dz = -Math.sin(ang);
          S.marks.push(this.lineMark(this.pos.x + dx * 1.2, this.pos.z + dz * 1.2, this.pos.x + dx * len, this.pos.z + dz * len, 0.5, 0xff2a4a, 1.15));
        }
        this.sfx('laser', { pitch: 0.6 });
      }
    } else if (S.sub === 'tele') {
      this.moveTo(a.x, this.floor + 0.9, a.z, dt, 4);
      if (S.t > 1.1) { S.sub = 'sweep'; S.t = 0; S.ang = S.base; this.sfx('laser'); }
    } else if (S.sub === 'sweep') {
      const w = this.pp(TUNE.omega) * this.k;
      S.ang += S.dir * w * dt;
      const dur = (this.pp(TUNE.turns) * TAU) / w;
      this.updateBeams(nb, S.ang, TAU / nb, _v.set(a.x, this.floor + 0.5, a.z), a.r + 2.5, 1.1);
      if (this.every(0.3)) this.sfx('laser', { vol: 0.4, pitch: 1.2 });
      if (S.t > dur) { for (const b of this.beams) { b.on = false; b.g.visible = false; } this.go('overheat'); }
    }
  }

  /** Beams from `c`, n beams spaced `step`, starting at angle a0; hurts the player if they don't jump. */
  updateBeams(n, a0, step, c, len, r0) {
    const p = this.player;
    for (let i = 0; i < this.beams.length; i++) {
      const b = this.beams[i];
      b.on = i < n;
      b.g.visible = b.on;
      if (!b.on) continue;
      b.ang = a0 + i * step;
      b.g.position.set(c.x + Math.cos(b.ang) * r0, c.y, c.z - Math.sin(b.ang) * r0);
      b.g.rotation.y = b.ang;
      b.g.scale.set(len, 1 + Math.sin(this.time * 40) * 0.15, 1 + Math.sin(this.time * 40) * 0.15);
      if (p.dead) continue;
      const dx = Math.cos(b.ang), dz = -Math.sin(b.ang);
      const rx = p.pos.x - b.g.position.x, rz = p.pos.z - b.g.position.z;
      const along = rx * dx + rz * dz, perp = Math.abs(rx * dz - rz * dx);
      if (along > -0.3 && along < len && perp < 0.45 && p.pos.y < c.y + 0.25 && p.pos.y + 1.1 > c.y - 0.1) this.hurtPlayer('zap', _v2.set(p.pos.x - dz, 0, p.pos.z + dx));
    }
  }

  // --- phase 3: energy balls from the Stressotron (reflect them!)
  thinkBall(dt) {
    const S = this.bs;
    S.t += dt;
    if (S.sub === 'charge') {
      const k = clamp(S.t / 1.1, 0, 1);
      this.nozzleGlow.scale.setScalar(0.05 + k * 0.5);
      if (this.at(0.05)) this.sfx('laser', { pitch: 0.5 });
      if (S.t > 1.1) {
        this.nozzleGlow.scale.setScalar(0.01);
        const from = this.nozzleWorld(new THREE.Vector3());
        const sp = this.pp(TUNE.ball) * (this.golden ? 1.06 : 1);
        const vel = new THREE.Vector3(this.pv.x - from.x, this.pv.y + 0.6 - from.y, this.pv.z - from.z).normalize().multiplyScalar(sp);
        const s = this.shot({ mesh: this.ballTpl.clone(), pos: from, vel, r: 0.55, life: 7, reflectable: true, cause: 'zap', speed: sp,
          hitR: 1.9, reflectSpeed: 16, poofColor: 0x6dffe0 });
        s.volleysLeft = Math.min(2, this.phaseHits);
        s.update = (sh, dt2, boss) => {
          sh.mesh.rotation.y += dt2 * 6;
          if (sh.age < 1.6) {
            _v.set(boss.pv.x, boss.pv.y + 0.6, boss.pv.z).sub(sh.pos).normalize().multiplyScalar(sh.speed);
            sh.vel.lerp(_v, 1 - Math.exp(-dt2 * 1.4)).setLength(sh.speed);
          }
          if (sh.pos.y < boss.floor + 0.3) sh.vel.y = Math.abs(sh.vel.y) * 0.5;
        };
        s.onExpire = (sh, boss) => { boss.removeShot(sh); boss.boom(_v.copy(sh.pos), 1.2, [0x6dffe0, 0xffffff], 'zap', 0.2); };
        S.ball = s; S.sub = 'wait'; S.t = 0;
        this.sfx('laser', { pitch: 1.4 });
      }
    } else if (S.sub === 'wait') {
      if (!S.ball || S.ball.dead || S.t > 9) this.next();
    }
  }

  thinkSweep(dt) {
    const S = this.sw, a = this.arena;
    S.t += dt;
    const c = _v3.set(this.machinePos.x, this.floor + 0.5, this.machinePos.z + 2.0);
    const len = Math.hypot(a.x - c.x, a.z - c.z) + a.r + 2;
    const mid = Math.atan2(-(a.z - c.z), a.x - c.x); // beam angle pointing at the arena centre
    const span = 1.15;
    if (S.sub === 'tele') {
      if (S.t < 0.05) {
        this.say(pick(L.laser));
        S.from = Math.random() < 0.5 ? -1 : 1;
        const ang = mid + S.from * span;
        S.mark = this.lineMark(c.x, c.z, c.x + Math.cos(ang) * len, c.z - Math.sin(ang) * len, 0.6, 0xff2a4a, 1.0);
        this.sfx('laser', { pitch: 0.6 });
      }
      if (S.t > 1.0) { S.sub = 'go'; S.t = 0; }
    } else {
      const w = this.pp(TUNE.sweepSpeed) * this.k;
      const k = S.t * w / (2 * span); // 0..1 one way, 1..2 back
      const u = k <= 1 ? k : 2 - k;
      const ang = mid + S.from * span * (1 - 2 * u);
      this.updateBeams(1, ang, 0, c, len, 0.5);
      if (this.every(0.3)) this.sfx('laser', { vol: 0.4, pitch: 1.2 });
      if (k >= 2) { for (const b of this.beams) { b.on = false; b.g.visible = false; } this.next(); }
    }
  }

  // ------------------------------------------------------------------ hits
  reflectTarget() { return this.headWorld(_t); }
  onReflectArrive(s) {
    if (this.defeated) return;
    if (s.volleysLeft > 0 && this.state !== 'ouch') {
      // tennis! put the ball back in play
      s.volleysLeft--;
      this.revive(s);
      this.volley(s, 1.08);
      if (Math.random() < 0.5) this.say(pick(L.volley));
      if (this.bs) { this.bs.ball = s; this.bs.t = 0; }
      return;
    }
    if (this.invulnT > 0 || this.state === 'ouch' || this.state === 'toMachine') { this.burst(s.pos, 0x6dffe0, 10, { speed: 4 }); return; }
    this.heat = clamp(this.heat + 0.34, 0, 1);
    this.burst(_v.set(this.machinePos.x, this.floor + 3, this.machinePos.z + 1), [0xff5a3c, 0xffffff, 0xb44cff], 24, { speed: 7 });
    this.takeHit('reflect', s.pos);
  }
  onHit(how, phaseUp) {
    this.pendingRage = phaseUp;
    this.inflate = 1;
    this.go('ouch');
  }
  onReset() {
    this.pendingRage = false;
    for (const b of this.beams) { b.on = false; b.g.visible = false; }
    this.nozzleGlow.scale.setScalar(0.01);
    if (this.phase < 2) this.pos.set(this.home.x, this.floor + TUNE.hover, this.home.z);
    else { this.pos.copy(this.dock); this.power = 1; }
    this.go('regroup');
  }
  onDefeat() {
    for (const b of this.beams) { b.on = false; b.g.visible = false; }
    this.go('defeat');
    this.spiralFrom = this.pos.clone();
  }
  defeatFocus() { return _t.set((this.machinePos.x + this.cagePos.x) / 2, this.floor + 0.5, this.machinePos.z + 4); }

  defeatAnim(dt, t) {
    const M = this.machine;
    // the Stressotron explodes in confetti
    if (this.at(0.05) || this.at(0.35) || this.at(0.7)) {
      this.sfx('explosion'); this.shake(0.8);
      this.confetti(_v.set(this.machinePos.x + rand(-1.5, 1.5), this.floor + rand(1, 5), this.machinePos.z + 1), 40,
        this.golden ? [0xffd23f, 0xffe98a, 0xffffff, 0xffb000] : undefined);
    }
    const k = clamp(t / 1.2, 0, 1);
    M.scale.set(1 + k * 0.3, Math.max(0.001, 1 - k), 1 + k * 0.3);
    M.rotation.z = Math.sin(t * 30) * 0.05 * (1 - k);
    // the doctor deflates like a balloon and zips away
    if (this.at(0.3)) { this.say(this.golden ? L.gDefeat : L.defeat); this.sfx('wind', { pitch: 1.6 }); }
    const ft = Math.max(0, t - 0.3);
    const r = 1.5 + ft * 1.5;
    this.pos.set(this.spiralFrom.x + Math.sin(ft * 9) * r, this.spiralFrom.y + ft * ft * 4 + ft * 2, this.spiralFrom.z + Math.cos(ft * 9) * r);
    this.yaw += dt * 14;
    this.inflate = -clamp(ft / 1.6, 0, 0.85);
    if (this.every(0.08, 0.3) && t < 2.4) this.burst(_v.set(this.pos.x, this.pos.y + 0.5, this.pos.z), 0xffffff, 2, { speed: 1, up: 0, life: 0.5 });
    // Zina is freed
    if (t > 2.0) {
      const c = clamp((t - 2.0) / 0.8, 0, 1);
      this.cageTop.position.y = c * 6;
      this.cageTop.rotation.y = c * 4;
    }
    if (this.at(2.2)) { this.sfx('switch'); this.say(this.golden ? L.gZina : L.zina, 'zina'); }
    if (t > 2.4) {
      const z = this.zina;
      z.position.y = 0.16 + Math.abs(Math.sin((t - 2.4) * 7)) * 0.5;
      z.position.z = Math.min(2.4, (t - 2.4) * 2);
    }
    if (this.at(3.3)) this.say(this.golden ? L.gOku : L.oku, 'oku');
  }

  // ------------------------------------------------------------------ visuals
  animate(dt) {
    const t = this.time, m = this.mats;
    // stress: the head inflates per phase, after hits, and pulses
    this.inflate = this.defeated ? this.inflate : damp(this.inflate, 0, 1.8, dt);
    const base = 1 + this.phase * 0.07;
    const pulse = Math.sin(t * (6 + this.phase * 3)) * (0.025 + this.phase * 0.01);
    const s = Math.max(0.15, base + pulse + this.inflate * 0.35);
    this.head.scale.setScalar(s);
    this.head.position.y = 2.35 + (s - 1) * 1.1;
    if (!this.golden) m.skin.color.setHex(0xf3d9a6).lerp(_c.setHex(0xff7a6a), clamp(this.phase * 0.25 + Math.max(0, this.inflate) * 0.6, 0, 1));
    this.veins.forEach((v, i) => { v.scale.setScalar(0.2 * (1 + Math.max(0, Math.sin(t * 8 + i)) * 0.3 * (this.phase + 1) / 3)); });
    // pod wobble + lights + flames
    const ouch = this.state === 'ouch';
    this.pod.rotation.z = ouch ? Math.sin(t * 22) * 0.2 : Math.sin(t * 1.3) * 0.05;
    this.pod.rotation.x = Math.cos(t * 1.1) * 0.05;
    this.lights.forEach((l, i) => l.material.color.setHSL(((t * 0.5 + i / 10) % 1), 1, Math.sin(t * 10 + i) > 0 ? 0.6 : 0.3));
    const grounded = this.state === 'overheat';
    this.flames.forEach((f, i) => { f.visible = !grounded; f.scale.set(0.2, 0.5 + Math.abs(Math.sin(t * 30 + i)) * 0.4, 0.2); });
    // arms on the controls / flailing
    for (const a of this.arms) {
      if (ouch || grounded) a.handPos.set(a.s * 0.95, 1.6 + Math.sin(t * 20 + a.s) * 0.35, 0.3);
      else a.handPos.set(a.s * 0.7, 0.6 + Math.sin(t * 6 + a.s) * 0.05, 0.75);
      cylBetween(a.arm, a.sh, a.handPos, 0.12);
      a.hand.position.copy(a.handPos);
    }
    for (const e of this.eyes || []) wobbleEye(e, t);
    // Stressotron: power, coils, gauge, heat colour
    const pw = this.phase >= 2 ? Math.max(this.power, 1) : this.power;
    this.coils.forEach((c, i) => { c.rotation.z += dt * pw * (2 + i); c.position.y = [1.5, 2.6, 3.7][i] + Math.sin(t * 3 + i) * 0.08 * pw; });
    m.core.color.setHex(this.golden ? 0xffd23f : 0xb44cff).lerp(_c.setHex(0xff3a2a), this.heat);
    this.coreGlow.scale.set(0.6 + Math.sin(t * 12) * 0.08 * pw, 3.0, 0.6 + Math.sin(t * 12) * 0.08 * pw);
    this.needle.rotation.z = damp(this.needle.rotation.z, 1.2 - this.heat * 2.4 + (this.heat > 0.6 ? Math.sin(t * 30) * 0.1 : 0), 6, dt);
    if (this.heat > 0.3 && Math.random() < dt * 4 * this.heat && !this.defeated) this.burst(_v.set(this.machinePos.x + rand(-1, 1), this.floor + 4.5, this.machinePos.z), [0xffffff, 0xcccccc], 3, { speed: 2, up: 4 });
    // Zina: hops and waves in her cage
    if (!this.defeated) {
      this.zina.position.y = 0.16 + Math.max(0, Math.sin(t * 3)) * 0.15;
      this.zinaArm.rotation.z = Math.sin(t * 9) * 0.6 - 0.6;
      this.zinaHead.rotation.y = Math.sin(t * 0.8) * 0.4;
    }
    // shadow + hit boxes
    const gy = this.floorAt(this.pos.x, this.pos.z, this.pos.y + 0.5);
    this.shadow.visible = gy > -Infinity && !this.defeated;
    this.shadow.position.set(this.pos.x, (gy > -Infinity ? gy : this.floor) + 0.03, this.pos.z);
    this.shadow.scale.setScalar(1.9);
    setBox(this.podBox, this.pos.x, this.pos.y - 0.2, this.pos.z, 1.75, 1.3, 1.75);
    const hy = this.pos.y + 0.5 + this.head.position.y;
    setBox(this.headBox, this.pos.x, hy - 1.2 * s, this.pos.z, 1.2 * s, 2.4 * s, 1.2 * s);
    setBox(this.weak, this.pos.x, hy, this.pos.z, 1.1 * s, 1.15 * s, 1.1 * s);
  }

  botHint() {
    if (this.defeated) return null;
    const r = this.reflectables();
    if (r.length) {
      const s = r[0];
      const d = Math.hypot(s.pos.x - this.pv.x, s.pos.z - this.pv.z);
      if (d < 6 && this.inArena(s.pos.x, s.pos.z, 1)) return { action: 'reflect', pos: [s.pos.x + s.vel.x * 0.2, this.floor, s.pos.z + s.vel.z * 0.2] };
      return null;
    }
    if (!this.vulnerable || this.invulnT > 0) return null;
    return { action: 'spin', pos: this.towardCenter(this.pos.x, this.pos.z, 2.3) };
  }
}

const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _t = new THREE.Vector3();
const _c = new THREE.Color();
void angDiff;
