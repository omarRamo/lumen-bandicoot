// Île 4 — Usine du Dr Cortisol (Level design B). Helpers come from w3.js (TurtleBuilder & co).
// Powers available here: doubleJump, tornado, superSlam. Socks gated by turbo = "come back later".
import { mk, t, JOKES } from './w3.js';

const HALF_PI = Math.PI / 2;

// =====================================================================================================================
// 4-1 Chaîne de Montage — run, factory. Lobby → conveyors (with and against) → lateral belts over the goo → iron &
// springs (superSlam!) → saws → backwards belt under crushers. Secret: express belt tunnel (turbo).
// =====================================================================================================================
function chaine() {
  const b = mk({
    id: '4-1', world: 4, index: 1, name: t('Chaîne de Montage', 'Assembly Line'), theme: 'factory', music: 'factory', mode: 'run',
    ground: 'metal', width: 4.5,
    intro: t('Bienvenue à l\'usine ! Votre badge : « Stagiaire jetable ».', 'Welcome to the factory! Your badge: "Disposable intern".'),
    timeTrial: { gold: 66, silver: 80, bronze: 102 },
  });
  // A — lobby
  b.floor(16).sign(JOKES.stress, -1.8, 3)
    .row('basic', 3, 0, 8).crate('lights', 0, 12).lights(4, 0, 2, { spacing: 1.4 })
    .deco('robot_arm', -4.2, 6, 0, 1.2).deco('barrel', 3.4, 12).deco('crate_pile', -3.6, 14)
    .floor(12).enemy('robot', 0, 7, { patrol: { axis: 'x', range: 1.5, speed: 1.5 } })
    .stack(['basic', 'basic'], -1.6, 3).crate('basic', 1.6, 3).ttCrate(1, 1.6, 10);
  // B — conveyors, with you then against you
  b.floor(16, { kind: 'conveyor', conveyor: 3 })
    .sign(t('Tapis roulant : il vous aide. Pour l\'instant.', 'Conveyor belt: it helps you. For now.'), -1.8, 1)
    .crate('basic', -1.2, 6).crate('basic', 1.2, 10).crate('lights', 0, 14).lights(5, 0, 2, { spacing: 2.5 })
    .pit(3.5)
    .floor(18, { kind: 'conveyor', conveyor: -3.5 })
    .sign(t('Ce tapis va dans l\'autre sens. Comme la direction.', 'This belt goes the other way. Like management.'), -1.8, 1)
    .crate('basic', 1.5, 4).crate('basic', -1.5, 8).stack(['basic', 'lights'], 1.5, 11).hazard('crusher', 0, 15, { period: 2.6 })
    .lights(4, -1, 3, { spacing: 2.4 })
    .floor(8).checkpoint(0, 3).crate('mask', 1.6, 6);
  // C — lateral belts over the goo
  b.floor(20, { kind: 'conveyor', conveyorLat: 2.6, w: 5 })
    .sign(t('Tapis latéral : la sortie, c\'est par là. Non, l\'autre là.', 'Sideways belt: the exit is that way. No, the other way.'), -2, 1)
    .crate('basic', -2, 5).crate('basic', -2, 10).crate('lights', -2, 15).lights(6, -1, 2, { spacing: 3 })
    .enemy('robot', 0.5, 12, { patrol: { axis: 'z', range: 3, speed: 2 } })
    .floor(4).crate('basic', 0, 2)
    .floor(20, { kind: 'conveyor', conveyorLat: -2.6, w: 5 })
    .crate('basic', 2, 4).stack(['basic', 'basic'], 2, 9).crate('tnt', 2, 14).crate('basic', 1, 14).crate('basic', 2, 15)
    .lights(6, 1, 2, { spacing: 3 })
    .floor(4);
  // C2 — quality control: rolling barrels, then stamping stones over the goo
  b.floor(22, { w: 5 }).hazard('barrels', 0, 21, { interval: 2.8 })
    .sign(t('Contrôle qualité : vous n\'êtes pas conforme.', 'Quality control: you are not compliant.'), -2, 1)
    .crate('basic', -2, 5).crate('basic', 2, 5).crate('lights', -2, 11).stack(['basic', 'basic'], 2, 11).crate('basic', -2, 17)
    .lights(7, 0, 2, { spacing: 2.8 })
    .stones(4, { size: 2.4, gap: 2.4, kind: 'metal' })
    .hazard('crusher', 0, 3.6, { period: 2.8, offset: 0.4 }).hazard('crusher', 0, 13.2, { period: 2.8, offset: 1.8 })
    .crate('basic', 0, 8.4).crate('lights', 0, 18).lights(8, 0, 2.4, { spacing: 2.2, up: 1.6, arc: 0.6 })
    .floor(6).crate('basic', -1.5, 3).crate('basic', 1.5, 3);
  // D — iron, springs, a cage for superSlam
  b.floor(24, { w: 7 })
    .sign(t('Caisses en fer : seul un SUPER plongeon les impressionne.', 'Iron crates: only a SUPER slam impresses them.'), -3, 2)
    .row('iron', 7, 0, 5)
    .crate('iron', -1, 12).crate('iron', 1, 12).crate('iron', 0, 11).crate('iron', 0, 13).crate('life', 0, 12).crate('iron', 0, 12, 1)
    .crate('basic', -2.6, 9).crate('basic', 2.6, 9).crate('lights', 2.6, 14)
    .crate('ironBounce', -2.6, 18).block(-1.5, 4.2, 23, 4, 0.5, 8, { kind: 'metal' })
    .crate('switch', -2.4, 20, 4.2, { group: 'g41' }).crate('basic', -0.8, 20, 4.2).crate('lights', -0.8, 23, 4.2)
    .lights(5, -1.5, 19, { spacing: 1.4, up: 5 })
    .enemy('robot', 1.5, 20, { patrol: { axis: 'x', range: 1, speed: 1.2 } })
    .floor(14, { w: 5 }).outlines('g41', [[-1.5, 3], [0, 3], [1.5, 3], [-1.5, 3, 1], [1.5, 3, 1], [0, 8], [0, 9]]);
  // E — saws
  b.pit(4).floor(24, { w: 5 })
    .hazard('saw', 0, 7, { patrol: { axis: 'x', range: 1.8, speed: 2 } }).hazard('saw', 0, 16, { patrol: { axis: 'x', range: 1.8, speed: 2.8 } })
    .crate('basic', -2, 4).crate('basic', 2, 11).crate('lights', -2, 11).crate('basic', 2, 20).crate('mystery', -2, 21)
    .lights(6, 0, 3, { spacing: 3.4 })
    .sign(JOKES.coffee, 2.2, 1);
  // the secret: an express belt tunnel on the right (belt -9 m/s, low glass ceiling) — only turbo outruns it
  b.branch((s) => {
    const F = s.f, y = s.y;
    s.rawBox(2.5, 5.5, y - 1, y, F - 6, F - 4, { kind: 'metal' });                                // landing
    s.rawBox(5.5, 8, y - 1, y, F - 6, F + 10, { kind: 'conveyor', conveyor: -9 });                // belt pushing back
    s.rawBox(5.5, 8, y + 1.3, y + 1.6, F - 4, F + 10, { kind: 'glass' });                         // low glass ceiling
    s.rawBox(8, 8.5, y, y + 1.6, F - 6, F + 10, { kind: 'metal' });                               // outer wall
    s.rawBox(5, 5.5, y, y + 1.6, F - 4, F + 10, { kind: 'metal' });                               // inner wall
    s.rawBox(5.5, 8, y, y + 1.6, F + 10, F + 10.5, { kind: 'metal' });                            // end wall
    s.at(6.75, y, F + 8.5).sock('green', 0, 0, 0.4).lights(4, 0, -6, { spacing: 1.6, up: 0.6 });
    s.at(4, y, F - 5).sign(t('Tapis express : réservé aux employés pressés (turbo).', 'Express belt: for employees in a hurry (turbo).'), 0, 0);
  });
  // F — backwards belt under three crushers, nitro guards, the stairs
  b.floor(6).checkpoint(0, 3)
    .floor(26, { kind: 'conveyor', conveyor: -4, w: 5 })
    .hazard('crusher', 0, 6, { period: 2.4, offset: 0 }).hazard('crusher', 0, 13, { period: 2.4, offset: 0.8 }).hazard('crusher', 0, 20, { period: 2.4, offset: 1.6 })
    .crate('basic', -2, 9.5).crate('basic', 2, 9.5).crate('lights', -2, 16.5).crate('basic', 2, 16.5).lights(8, 0, 2, { spacing: 3 })
    .sign(t('Productivité +3 % : nous avons supprimé les chaises.', 'Productivity +3%: we removed the chairs.'), 2.2, 1)
    .floor(16, { w: 7 }).crate('legs', 0, 8)
    .crate('nitro', -2.5, 4).crate('basic', -3, 5).crate('basic', -2, 5).crate('nitro', 2.5, 12).stack(['basic', 'basic'], 3, 13).crate('basic', 2, 13)
    .enemy('robot', 0, 15.5, { patrol: { axis: 'x', range: 2, speed: 2 } })
    .step(1, 6).crate('basic', 1.5, 3).step(1, 6).crate('basic', -1.5, 3).step(1, 6).crate('lights', 0, 3)
    .pit(4).floor(12, { w: 6 })
    .crate('nitroSwitch', 2.4, 8).crate('basic', -2, 3).crate('basic', -2, 4).crate('basic', -2, 5).ttCrate(3, 2.4, 3)
    .sign(t('Fin de poste. Pointez à la sortie. Ne souriez pas.', 'End of shift. Clock out. Do not smile.'), -2.4, 9)
    .goal(10, { w: 6 }).deco('robot_arm', 3.6, 5, 0, 1.4).deco('tank', -4, 5, 0, 1.2);
  return b.build();
}

// =====================================================================================================================
// 4-2 Labo Toxique — side (2.5D along +X). Toxic goo pools, rats in lab coats, drones with vertical lasers, laser
// gates, elevators, falling shelves. Secret: walk LEFT at the start (the shelf behind the spawn).
// =====================================================================================================================
function labo() {
  const b = mk({
    id: '4-2', world: 4, index: 2, name: t('Labo Toxique', 'Toxic Lab'), theme: 'lab', music: 'lab', mode: 'side', dir: 'x',
    ground: 'tile', width: 4,
    intro: t('Expérience n°42 : un renard dans un labo. Hypothèse : chaos.', 'Experiment #42: a fox in a lab. Hypothesis: chaos.'),
    timeTrial: { gold: 65, silver: 80, bronze: 100 },
  });
  b.boot({ lockZ: 0 });
  const goo = (len) => b.pit(len).hazard('lava', 0, len / 2, { w: 4, d: len, up: -1.2 });
  // the secret shelf behind the spawn (go left!)
  b.at(0, 0, -14).floor(14)
    .block(0, 3.6, 4, 3, 0.5, 3, { kind: 'metal' }).sock('purple', 0, 4, 4.6)
    .block(0, 1.8, 8.5, 2, 0.5, 2, { kind: 'metal' })
    .lights(3, 0, 8, { spacing: 0.5, up: 2.6 }).lights(3, 0, 3.5, { spacing: 0.5, up: 4.4 });
  b.spawn(0, 0, 1.5);
  // A — the lab
  b.floor(16)
    .sign(t('Blouse obligatoire. Lumen n\'en a pas. Personne ne dit rien.', 'Lab coat mandatory. Lumen has none. Nobody says a thing.'), 1.4, 3)
    .row('basic', 3, 0, 8, { axis: 'fwd' }).crate('lights', 0, 13).lights(4, 0, 2, { spacing: 1.2 })
    .deco('tube', 3.2, 6, 0, 1.2).deco('tank', 4, 12, 0, 1.3);
  goo(3.5);
  b.floor(12).enemy('rat', 0, 6, { patrol: { axis: 'z', range: 2.5, speed: 1.6 } }).crate('basic', 0, 1.5).crate('basic', 0, 11)
    .sign(t('Ne buvez pas le liquide vert. Ni le bleu. Ni le rose.', 'Don\'t drink the green liquid. Nor the blue. Nor the pink.'), 1.4, 2);
  goo(9);
  b.platform('moving', 0, 2, { w: 2.4, d: 2.4, up: -0.5, to: { fwd: 5 }, period: 3.2 }).lights(5, 0, 1, { spacing: 1.6, up: 1.3 });
  // B — climbing the shelves
  b.floor(6).crate('basic', 0, 3)
    .step(1.4, 5).crate('lights', 0, 2.5)
    .step(1.4, 5).enemy('drone', 0, 2.5, { fly: 2.8, period: 3.2, patrol: { axis: 'z', range: 1.5, speed: 1 } })
    .step(1.4, 6).stack(['basic', 'basic'], 0, 4)
    .gap(4).platform('moving', 0, 2, { w: 2.2, d: 2.2, up: -0.5, to: { up: 3 }, period: 3 })
    .step(3, 10).crate('basic', 0, 3).crate('basic', 0, 4).crate('lights', 0, 7)
    .lights(4, 0, 1, { spacing: 2.6, up: 1 })
    .floor(6).checkpoint(0, 3);
  // C — laser gates
  b.floor(24)
    .sign(t('Lasers de sécurité. Ils sécurisent surtout le fait que vous allez mourir.', 'Safety lasers. Mostly they secure your death.'), 1.4, 1)
    .hazard('laser', 0, 6, { axis: 'x', width: 4, period: 2.2, offset: 0 }).hazard('laser', 0, 12, { axis: 'x', width: 4, period: 2.2, offset: 0.7 })
    .hazard('laser', 0, 18, { axis: 'x', width: 4, period: 2.2, offset: 1.4 })
    .crate('basic', 0, 9).crate('lights', 0, 15).crate('basic', 0, 19.5).lights(6, 0, 2, { spacing: 3.6 })
    .enemy('rat', 0, 22, { patrol: { axis: 'z', range: 1.2, speed: 1.4 } });
  goo(5);
  b.step(-1, 10).crate('tnt', 0, 3).crate('basic', 0, 4).crate('basic', 0, 5).crate('basic', 0, 5, 1);
  goo(12);
  b.platform('falling', 0, 3, { w: 2.2, d: 2.2, up: -0.5, delay: 0.5 }).platform('falling', 0, 6.5, { w: 2.2, d: 2.2, up: -0.5, delay: 0.5 })
    .platform('falling', 0, 10, { w: 2, d: 2, up: -0.5, delay: 0.5 })
    .lights(6, 0, 1, { spacing: 2, up: 1.3 });
  // C2 — the centrifuge and the specimen shelves
  b.floor(8).crate('basic', 0, 4).lights(3, 0, 2);
  goo(9);
  b.platform('rotating', 0, 4.5, { w: 3, d: 3, h: 0.5, up: -0.5, speed: 1.4 }).lights(5, 0, 1, { spacing: 1.7, up: 1.4, arc: 1 })
    .sign(t('Centrifugeuse : tourne à 3000 tours. Enfin, 1,4.', 'Centrifuge: spins at 3000 rpm. Well, 1.4.'), 1.4, -1);
  b.floor(18)
    .stack(['basic', 'basic', 'lights'], 0, 4).stack(['basic', 'basic'], 0, 9).crate('basic', 0, 14).crate('basic', 0, 15).crate('basic', 0, 15, 1)
    .enemy('rat', 0, 11.5, { patrol: { axis: 'z', range: 0.8, speed: 1.2 } }).lights(5, 0, 2, { spacing: 3.5, up: 2.6 })
    .step(1.4, 5).crate('lights', 0, 2.5).step(1.4, 5).crate('basic', 0, 2).crate('basic', 0, 3)
    .step(-2.8, 6).crate('basic', 0, 3);
  // D — the switch room (outline staircase to the top shelf)
  b.floor(24)
    .crate('switch', 0, 3, 0, { group: 'g42' })
    .outlines('g42', [[0, 8], [0, 9], [0, 9, 1], [0, 10], [0, 10, 1], [0, 10, 2]])
    .block(0, 4.2, 15, 6, 0.5, 4, { kind: 'metal' }).crate('basic', 0, 13, 4.2).crate('lights', 0, 15, 4.2).crate('basic', 0, 17, 4.2)
    .lights(4, 0, 12.5, { spacing: 1.6, up: 5.2 })
    .enemy('rat', 0, 20.5, { patrol: { axis: 'z', range: 0.9, speed: 1.4 } }).crate('mask', 0, 23)
    .sign(t('Escalier en caisses fantômes. Validé par la sécurité (non).', 'Ghost crate staircase. Approved by safety (no).'), 1.4, 1)
    .floor(6).checkpoint(0, 3);
  // E — drones over vanishing bench tops
  goo(14);
  b.platform('vanishing', 0, 3, { w: 2.4, d: 2.4, up: -0.5, period: 3, offset: 0 }).platform('vanishing', 0, 7, { w: 2.4, d: 2.4, up: -0.5, period: 3, offset: 1 })
    .platform('vanishing', 0, 11, { w: 2.4, d: 2.4, up: -0.5, period: 3, offset: 2 })
    .lights(7, 0, 1, { spacing: 2, up: 1.4, arc: 1 });
  b.floor(22)
    .enemy('drone', 0, 6, { fly: 3, period: 2.8, offset: 0 }).enemy('drone', 0, 14, { fly: 3, period: 2.8, offset: 1.4 })
    .crate('basic', 0, 3).crate('basic', 0, 10).crate('lights', 0, 10, 1).crate('basic', 0, 18).crate('legs', 0, 20)
    .lights(5, 0, 4, { spacing: 3.5 })
    .step(1.2, 6).crate('nitro', 0, 3)
    .step(1.2, 6).crate('basic', 0, 2).crate('basic', 0, 4);
  goo(5);
  b.floor(12).enemy('rat', 0, 6.5, { patrol: { axis: 'z', range: 2.4, speed: 2.2 } }).crate('basic', 0, 2).crate('basic', 0, 11)
    .hazard('laser', 0, 9, { axis: 'x', width: 4, period: 1.8, offset: 0.4 });
  goo(4);
  b.floor(12).crate('nitroSwitch', 0, 8).crate('basic', 0, 2).crate('basic', 0, 3).crate('basic', 0, 3, 1).ttCrate(2, 0, 10)
    .sign(t('Résultat de l\'expérience : le renard a gagné. Ajouter plus de lasers.', 'Experiment result: the fox won. Add more lasers.'), 1.4, 5)
    .goal(10).deco('satellite', 4, 5, 0, 1.3);
  return b.build();
}

// =====================================================================================================================
// 4-3 Roomba Géant — chase, factory. A giant vacuum robot behind you, belts that pull you back, crushers on a beat,
// iron walls, laser gates and a final sprint. Secret: the sock is in an iron cage on a side ledge (superSlam, fast!).
// =====================================================================================================================
function roomba() {
  const b = mk({
    id: '4-3', world: 4, index: 3, name: t('Roomba Géant', 'Giant Roomba'), theme: 'factory', music: 'chase', mode: 'chase',
    ground: 'metal', width: 6,
    intro: t('L\'aspirateur du Dr Cortisol a faim. Vous êtes une miette.', 'Dr Cortisol\'s vacuum is hungry. You are a crumb.'),
    timeTrial: { gold: 50, silver: 58, bronze: 72 },
  });
  const wall = (fwd, h = 0.9) => b.block(0, h, fwd, 6, h, 0.8, { kind: 'metal' });
  b.spawn(0, 0, 13);
  b.floor(30).hazard('boulder', 0, 3.5, { style: 'roomba', speed: 6.8 })
    .sign(t('Le Roomba nettoie tout. Y compris les renards.', 'The Roomba cleans everything. Foxes included.'), -2.6, 16)
    .lights(6, 0, 15, { spacing: 2.4 }).crate('basic', 2.2, 21).crate('lights', -2.2, 25).crate('basic', 2.2, 28)
    .deco('tank', -4.6, 10, 0, 1.3).deco('chimney', 4.8, 22);
  b.floor(16); wall(6);
  b.lights(5, 0, 4, { spacing: 0.9, arc: 1.4, up: 1.4 }).crate('basic', -2.2, 11).crate('basic', 2.2, 11)
    .enemy('robot', 0, 13, { patrol: { axis: 'x', range: 2.4, speed: 2 } })
    .pit(3.5).floor(14, { kind: 'conveyor', conveyor: 2.5 })
    .sign(t('Un tapis dans le bon sens. Méfiance.', 'A belt going the right way. Suspicious.'), -2.6, 1)
    .row(['basic', 'basic', 'tnt', 'basic', 'basic'], 5, 0, 7).lights(4, 0, 10, { spacing: 1.1 })
    .floor(10).hazard('crusher', 0, 5, { period: 2 })
    .crate('basic', -2.4, 2).crate('basic', 2.4, 8)
    .pit(4).floor(8).checkpoint(0, 4).crate('mask', -2, 6);
  // middle — laser gates, iron walls, the caged sock on a ledge
  b.floor(20)
    .hazard('laser', 0, 6, { axis: 'x', width: 6, period: 2, offset: 0 }).hazard('laser', 0, 13, { axis: 'x', width: 6, period: 2, offset: 1 })
    .crate('basic', -2.4, 9.5).crate('basic', 2.4, 9.5).crate('lights', 0, 17).lights(6, 0, 2, { spacing: 3 })
    .floor(16, { w: 7 }).row('iron', 7, 0, 5).crate('basic', -2.5, 9).crate('basic', 2.5, 9).crate('basic', 0, 12)
    .lights(4, 0, 4.2, { spacing: 0.6, up: 1.9 })
    .block(4.8, 1.2, 9, 3.4, 1.2, 4, { kind: 'metal' })
    .crate('iron', 4.6, 8, 1.2).crate('iron', 4.6, 10, 1.2).crate('iron', 3.6, 9, 1.2).crate('iron', 5.6, 9, 1.2).crate('iron', 4.6, 9, 2.2)
    .sock('red', 4.6, 9, 1.6)
    .sign(t('Chaussette en cage. Pas le temps ! (Ou si ?)', 'Caged sock. No time! (Or is there?)'), -3, 1);
  wall(14);
  b.slope(-1, 6, 3)
    .floor(14, { w: 2.4, kind: 'metal' }).lights(6, 0, 1, { spacing: 2.2 }).enemy('robot', 0, 8, { patrol: { axis: 'z', range: 3, speed: 2.6 } })
    .floor(8).checkpoint(0, 4);
  // the warehouse — rolling barrels, stepping stones over the goo, sideways belts
  b.floor(22, { w: 7 }).hazard('barrels', 0, 21, { interval: 2.4 })
    .sign(t('Entrepôt : les tonneaux roulent vers vous. C\'est la politique de l\'entreprise.', 'Warehouse: barrels roll at you. Company policy.'), -3, 1)
    .stack(['basic', 'basic'], -3, 5).crate('basic', 3, 5).crate('lights', 3, 11).stack(['basic', 'lights'], -3, 15).crate('basic', 3, 18)
    .lights(8, 0, 2, { spacing: 2.5 })
    .slope(-1.2, 6, 3)
    .stones(3, { size: 2.6, gap: 2, kind: 'metal' }).crate('basic', 0, 3.3).lights(3, 0, 7.9, { up: 1.4, spacing: 0.6 })
    .floor(18, { kind: 'conveyor', conveyorLat: 3, w: 6 })
    .crate('basic', -2.5, 4).crate('basic', -2.5, 9).crate('lights', -2.5, 14).enemy('robot', 1, 10, { patrol: { axis: 'z', range: 3, speed: 2.4 } })
    .lights(6, -1, 2, { spacing: 2.8 })
    .floor(18, { kind: 'conveyor', conveyorLat: -3, w: 6 })
    .crate('basic', 2.5, 4).crate('basic', 2.5, 9).crate('basic', 2.5, 14).crate('mask', -2.5, 9)
    .lights(6, 1, 2, { spacing: 2.8 })
    .slope(-1.2, 6, 3)
    .floor(20).hazard('laser', 0, 5, { axis: 'x', width: 6, period: 1.6, offset: 0.3 }).hazard('laser', 0, 12, { axis: 'x', width: 6, period: 1.6, offset: 1.1 })
    .row(['basic', 'basic', 'lights', 'basic', 'basic'], 5, 0, 8.5, { spacing: 1.3 }).lights(4, 0, 15, { spacing: 1.2 })
    .sign(t('Pause café : 0 min. Pause roomba : jamais.', 'Coffee break: 0 min. Roomba break: never.'), 2.6, 1);
  wall(18);
  // finale — belts, crushers, falling floor, pyramid at the portal
  b.floor(22, { kind: 'conveyor', conveyorLat: 2.4 })
    .hazard('crusher', -1.5, 6, { period: 2.2, offset: 0 }).hazard('crusher', 1.5, 12, { period: 2.2, offset: 1.1 }).hazard('crusher', -1.5, 18, { period: 2.2, offset: 0.5 })
    .crate('basic', 2, 6).crate('basic', -2, 12).crate('lights', 2, 18).lights(8, 0, 2, { spacing: 2.6 })
    .sign(t('Rythme des presses : boum, boum, vous.', 'Press rhythm: boom, boom, you.'), -2.6, 1);
  wall(21);
  b.pit(4).floor(10).crate('legs', 0, 5).crate('basic', -2.4, 8).crate('basic', 2.4, 8).lights(3, 0, 1)
    .gap(4).platform('falling', -1.2, 2, { w: 2, d: 2, up: -0.5, delay: 0.5 }).platform('falling', 1.2, 2, { w: 2, d: 2, up: -0.5, delay: 0.5 })
    .lights(4, 0, 0.5, { spacing: 1, arc: 1, up: 1 })
    .floor(18).row(['basic', 'lights', 'basic', 'lights', 'basic'], 5, 0, 5)
    .crate('nitro', -2.5, 10).crate('nitro', 2.5, 10).crate('basic', 0, 10).stack(['basic', 'basic'], -1, 14).stack(['basic', 'basic'], 1, 14)
    .enemy('robot', 0, 16, { patrol: { axis: 'x', range: 2.5, speed: 2.4 } }).ttCrate(1, 2.5, 3)
    .floor(10).crate('nitroSwitch', -2.4, 4).pyramid(3, 1, 6).crate('basic', -2.5, 8)
    .sign(t('Le Roomba s\'arrête ici : son sac est plein. De vos espoirs.', 'The Roomba stops here: its bag is full. Of your hopes.'), 2.8, 2)
    .goal(12).deco('robot_arm', -4.4, 6, 0, 1.4);
  return b.build();
}

// =====================================================================================================================
// 4-4 Fusée en Carton — ride (rocket), autoRun 14, space. A panel highway in the void: asteroid slalom, gaps, laser
// gates, drifting panels, light rings to jump through, a high lane with the sock.
// =====================================================================================================================
function fusee() {
  const b = mk({
    id: '4-4', world: 4, index: 4, name: t('Fusée en Carton', 'Cardboard Rocket'), theme: 'space', music: 'ride', mode: 'ride',
    mount: 'rocket', autoRun: 14, ground: 'metal', width: 8,
    intro: t('La fusée ne vole pas. Budget. Elle roule très vite, par contre.', 'The rocket doesn\'t fly. Budget. It rolls very fast though.'),
    timeTrial: { gold: 29, silver: 34, bronze: 42 },
  });
  b.boot({ autoRun: 14 });
  const rock = (lat, fwd, s = 1.6) => b.block(lat, s, fwd, s, s, s, { kind: 'stone' });
  /** vertical ring of lights to jump through */
  const hoop = (lat, fwd, up = 2.2, r = 1.2, n = 8) => {
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; b.lights(1, lat + Math.cos(a) * r, fwd, { up: up + Math.sin(a) * r }); }
    return b;
  };
  b.floor(24)
    .sign(t('Attention : l\'espace est très grand. Restez sur la route.', 'Warning: space is very big. Stay on the road.'), -3, 5)
    .lights(6, 0, 10, { spacing: 2.2 }).deco('planet', -14, 20, 6, 3).deco('satellite', 10, 14, 0, 1.4);
  // asteroid slalom
  b.floor(46).sign(t('Astéroïdes : ils ne s\'écartent pas. Vous, si.', 'Asteroids: they won\'t move. You will.'), 3, 1);
  rock(-2, 8); rock(2.4, 15); rock(-1, 22, 2); rock(2, 30); rock(-2.4, 37);
  b.crate('basic', 2, 8).crate('basic', -2.4, 15).crate('lights', 2.4, 22).crate('basic', -2, 30).crate('basic', 2.4, 37)
    .lights(3, 1.6, 4).lights(3, -1.6, 11).lights(3, 1.6, 18).lights(3, -1.6, 26).lights(3, 0.5, 33).crate('basic', -3.4, 4).crate('lights', 3.4, 26).crate('basic', 0, 42).crate('basic', -1, 42)
    .pit(7, { arc: 2.4, n: 7 });
  b.floor(24).row('basic', 4, 0, 6, { spacing: 2 }).stack(['basic', 'basic'], -3, 14).stack(['basic', 'basic'], 3, 14).crate('mask', 0, 18);
  hoop(0, 22);
  b.slope(2.1, 14, 7, { lightsLat: 0 })
    .floor(20).crate('nitro', -1.5, 6).crate('nitro', 1.5, 6).crate('basic', -3, 6).crate('basic', 3, 6)
    .crate('nitro', 0, 13).crate('basic', -2, 13).crate('basic', 2, 13).lights(4, -3, 2, { spacing: 1.2 })
    .slope(-2.1, 14, 7)
    .floor(10).checkpoint(0, 5);
  // laser gates & drifting panels
  b.floor(30)
    .sign(t('Barrières laser : sautez quand c\'est rouge. Ou quand c\'est pas rouge. On sait plus.', 'Laser gates: jump when red. Or when not red. We forgot.'), -3, 1)
    .hazard('laser', 0, 8, { axis: 'x', width: 8, period: 2, offset: 0 }).hazard('laser', 0, 18, { axis: 'x', width: 8, period: 2, offset: 0.6 })
    .crate('basic', -2.4, 12).crate('basic', 2.4, 12).crate('lights', 0, 24).lights(8, 0, 2, { spacing: 3.4 });
  b.gap(26)
    .platform('moving', -2, 2.5, { w: 3.6, h: 0.5, d: 5, up: -0.5, to: { lat: 4 }, period: 2.6 })
    .platform('moving', 2, 9.5, { w: 3.6, h: 0.5, d: 5, up: -0.5, to: { lat: -4 }, period: 2.6 })
    .platform('moving', -2, 16.5, { w: 3.6, h: 0.5, d: 5, up: -0.5, to: { lat: 4 }, period: 2.6 })
    .lights(10, 0, 1, { spacing: 2.6, up: 1.2 })
    .sign(t('Panneaux dérivants. Le GPS recalcule.', 'Drifting panels. GPS recalculating.'), -3, -1);
  b.floor(30)
    .enemy('drone', -2, 8, { fly: 3, period: 2.6 }).enemy('drone', 2, 16, { fly: 3, period: 2.6, offset: 1.3 })
    .row(['basic', 'lights'], 4, -2.4, 6, { axis: 'fwd', spacing: 3 }).row('basic', 4, 2.4, 9, { axis: 'fwd', spacing: 3 })
    .crate('bounce', 0, 24).block(0, 4, 36, 3, 0.5, 14, { kind: 'metal' })
    .floor(8).checkpoint(-2.5, 4).crate('basic', 2.5, 4)
    .branch((s) => { s.at(0, s.y + 4, s.f - 8).sock('red', 0, 2, 1).lights(6, 0, -5, { spacing: 1.2, up: 1 }); });
  // finale: falling panels, rings, last asteroids, goal
  b.gap(18)
    .platform('falling', 0, 3, { w: 4, d: 5, up: -0.5, delay: 0.35 }).platform('falling', 0, 10, { w: 4, d: 5, up: -0.5, delay: 0.35 })
    .lights(8, 0, 1, { spacing: 2.1, up: 1.3 })
    .floor(46);
  hoop(-2, 6); hoop(2, 16); rock(0, 11, 1.8); rock(-2.6, 24); rock(2.6, 24);
  b.crate('legs', 0, 30).crate('basic', -2.6, 30).crate('basic', 2.6, 30).row('basic', 3, 0, 38, { spacing: 2.6 }).crate('mystery', 0, 42)
    .crate('tnt', -1.3, 20).crate('tnt', 1.3, 20).crate('lights', 0, 34)
    .lights(4, 0, 22, { spacing: 1.5 })
    .pit(7, { arc: 2.4, n: 7 })
    .floor(20).crate('nitroSwitch', -3, 8).stack(['basic', 'basic'], 3, 8).row('basic', 3, 0, 14, { spacing: 2 }).ttCrate(3, -3, 14).row('basic', 2, 0, 4, { spacing: 3 })
    .sign(t('Arrivée ! La fusée en carton est recyclable à 100 %.', 'Arrival! The cardboard rocket is 100% recyclable.'), 3, 2)
    .goal(14).deco('ufo', -8, 7, 4, 1.5);
  return b.build();
}

// =====================================================================================================================
// 4-5 La Tour du Stress — run, tower. A square spiral climbing around the Stressotron's tower: every leg turns the
// camera 90°, stairs, belts, crushers, lasers, elevators; then a side-view zigzag shaft to the roof.
// =====================================================================================================================
function tour() {
  const b = mk({
    id: '4-5', world: 4, index: 5, name: t('La Tour du Stress', 'The Stress Tower'), theme: 'tower', music: 'tower', mode: 'run',
    ground: 'metal', width: 4.5, thick: 1.5,
    intro: t('Chaque étage = une dose de cortisol. Il y en a beaucoup.', 'Every floor = one dose of cortisol. There are many.'),
    timeTrial: { gold: 80, silver: 98, bronze: 122 },
  });
  const corner = (dir, opts = {}) => b.floor(5, { w: 5, ...opts }).turn(dir, { pad: 5 });
  // leg 1 (-Z): the lobby, three stairs
  b.floor(10).sign(t('Tour du Stress : l\'ascenseur est en panne depuis 1997.', 'Stress Tower: the lift has been broken since 1997.'), -1.8, 3)
    .row('basic', 3, 0, 6).lights(3, 0, 2)
    .step(1, 6).crate('basic', 1.5, 3).step(1, 6).stack(['basic', 'lights'], -1.5, 3).step(1, 6).crate('basic', 1.5, 2).crate('basic', 1.5, 3)
    .enemy('robot', -0.6, 5.2, { patrol: { axis: 'x', range: 1, speed: 1.2 } }).lights(3, 0, 1, { spacing: 1.5, up: 1.2 });
  corner('left');
  // leg 2 (-X): belt stairs pushing down, a crusher
  b.floor(4).crate('basic', 0, 2)
    .step(1, 6, { kind: 'conveyor', conveyor: -2.5 }).crate('basic', -1.6, 3)
    .step(1, 6, { kind: 'conveyor', conveyor: -2.5 }).hazard('crusher', 0, 3, { period: 2.4 })
    .step(1, 6, { kind: 'conveyor', conveyor: -2.5 }).crate('lights', 1.6, 3)
    .floor(6).crate('basic', -1.6, 3).crate('basic', 1.6, 3).lights(4, 0, 1, { spacing: 1.2 })
    .sign(t('Escalier roulant : il roule. Dans le mauvais sens.', 'Escalator: it escalates. The wrong way.'), 1.8, 2);
  corner('left');
  // leg 3 (+Z): lasers + elevator
  b.floor(12).hazard('laser', 0, 4, { axis: 'x', width: 4.5, period: 2.2 }).hazard('laser', 0, 8.5, { axis: 'x', width: 4.5, period: 2.2, offset: 1.1 })
    .crate('basic', -1.6, 6.2).crate('basic', 1.6, 6.2).lights(3, 0, 10)
    .gap(5).platform('moving', 0, 2.5, { w: 2.2, d: 2.2, up: -0.5, to: { up: 3 }, period: 3 }).lights(3, 0, 2.5, { spacing: 0.1, up: 1.2, arc: 3 })
    .step(3, 8).checkpoint(0, 4).crate('mask', 1.6, 6).crate('basic', -1.6, 6).crate('basic', -1.6, 7).lights(3, 0, 1)
  corner('left');
  // leg 4 (+X): saws & gaps
  b.floor(10).hazard('saw', 0, 5, { patrol: { axis: 'x', range: 1.6, speed: 2.2 } }).crate('basic', -1.8, 2).crate('basic', 1.8, 8)
    .pit(3.5).step(1, 8).crate('switch', 1.6, 4, 0, { group: 'g45' }).enemy('robot', -0.8, 5, { patrol: { axis: 'z', range: 2, speed: 1.6 } })
    .pit(3.5).step(1, 6).crate('lights', 0, 3).lights(3, 0, 1, { up: 1.4 });
  corner('left');
  // leg 5 (-Z, above leg 1): iron crates and springs
  b.floor(14, { w: 6 }).row('iron', 6, 0, 3).crate('ironBounce', -2.2, 9).block(0, 3.6, 13, 6, 0.5, 2, { kind: 'metal' })
    .crate('basic', 2.2, 7).crate('basic', 2.2, 8).outlines('g45', [[-1.5, 13, 3.6], [0, 13, 3.6], [1.5, 13, 3.6]])
    .lights(4, 0, 7, { spacing: 1.4, up: 1.4 })
    .sign(t('Fer + super plongeon = moins de fer.', 'Iron + super slam = less iron.'), 2.6, 1)
    .step(1.5, 8).crate('basic', 0, 4).step(1.5, 8).enemy('drone', 0, 4, { fly: 2.8, period: 3 }).step(1.5, 6).crate('basic', 1.6, 3).crate('lights', -1.6, 3);
  corner('left');
  // leg 6 (-X): vanishing shelves around the tower
  b.floor(4).gap(13)
    .platform('vanishing', 0, 3, { w: 2.2, d: 2.2, up: -0.5, period: 3, offset: 0 })
    .platform('vanishing', 0, 6.5, { w: 2.2, d: 2.2, up: -0.5, period: 3, offset: 1 })
    .platform('vanishing', 0, 10, { w: 2.2, d: 2.2, up: -0.5, period: 3, offset: 2 })
    .lights(6, 0, 1, { spacing: 2.2, up: 1.4, arc: 1 })
    .floor(10).crate('basic', -1.6, 3).crate('lights', 1.6, 6).checkpoint(0, 8).stack(['basic', 'basic'], -1.6, 6).lights(3, 0, 2, { spacing: 1.2 });
  corner('left');
  // leg 7 (+Z): conveyor up + crushers + nitro
  b.floor(16, { kind: 'conveyor', conveyor: -3 })
    .hazard('crusher', 0, 5, { period: 2.2 }).hazard('crusher', 0, 11, { period: 2.2, offset: 1.1 })
    .crate('nitro', -1.8, 8).crate('basic', 1.8, 8).crate('basic', 1.8, 9).lights(5, 0, 2, { spacing: 3 })
    .step(1.2, 6).crate('basic', 0, 3).step(1.2, 6).crate('basic', 1.6, 3).step(1.2, 8).crate('legs', 0, 4)
    .sign(JOKES.coffee, -1.8, 1);
  corner('left');
  // leg 8 (+X): the bridge to the shaft
  b.floor(8).crate('basic', -1.6, 4).crate('basic', 1.6, 4).lights(3, 0, 2)
    .floor(16, { w: 2.2, kind: 'bridge' }).lights(6, 0, 1, { spacing: 2.6 })
    .sign(t('Rien à voir à droite. Circulez.', 'Nothing to see on the right. Move along.'), -1.4, 4)
    .branch((s) => { s.block(12, 0, 8, 2.4, 0.5, 2.4, { kind: 'metal' }).sock('blue', 12, 8, 0.6).lights(7, 6.5, 8, { axis: 'lat', spacing: 1.4, up: 2.2, arc: 1.4 }); })
    .floor(6).crate('mystery', 0, 3);
  // vertical shaft, side view (camera on the right), zigzag up ~19 m
  b.camZone(26, { mode: 'side', yaw: b.yaw + HALF_PI, travelYaw: b.yaw, dist: 12, lookUp: 2.4, height: 3 }, {}, { ylo: -3, yhi: 30 });
  b.floor(6).crate('basic', 0, 3);
  const z0 = b.f, y0 = b.y;
  const shelves = [[2, 2], [7, 4], [2, 6], [7, 8], [2, 10], [7, 12], [2, 14], [7, 16]];
  shelves.forEach(([f, up], i) => {
    b.block(0, up, f + 1.5 - (b.a - z0), 3, 0.5, 3, { kind: 'metal' });
    if (i % 2) b.crate(i === 5 ? 'lights' : 'basic', 0, f + 1.5 - (b.a - z0), up).lights(3, 0, f + 0.5 - (b.a - z0), { up: up + 1.6, spacing: 1 });
    else b.lights(2, 0, f + 1 - (b.a - z0), { up: up + 0.8, spacing: 1 }).crate('basic', 0, f + 0.55 - (b.a - z0), up);
  });
  b.enemy('drone', 0, 4.5 + (z0 - b.a), { fly: 7.5, period: 3.4 }).hazard('laser', 0, 4 + (z0 - b.a), { axis: 'x', width: 3, period: 2.4, up: 10 });
  b.at(b.lat, y0 + 18, z0 + 12).floor(14, { w: 6 })
    .sign(t('Vue imprenable sur votre propre stress.', 'Breathtaking view of your own stress.'), -2.4, 2)
    .crate('nitroSwitch', 2.2, 6).pyramid(3, 0, 10).crate('basic', -2.2, 6).ttCrate(2, 2.2, 12).lights(8, 0, 1, { spacing: 1.1, up: 1 })
    .goal(10, { w: 6 }).deco('gear', 3.6, 5, 0, 1.6);
  return b.build();
}

export default [chaine(), labo(), roomba(), fusee(), tour()];
