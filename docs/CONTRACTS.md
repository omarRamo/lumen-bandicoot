# Lumen Bandicoot — contrats d'équipe (lire AVANT d'écrire du code)

Jeu 3D Three.js r170 + Vite, ES modules, aucun asset binaire : **tout est procédural** (géométries, textures
canvas, sons WebAudio). PC (clavier/manette) et mobile (tactile, paysage). Ton : *mauvaise copie assumée* de
Crash Bandicoot, drôle, créative, généreuse. Héros : **Lumen**, le petit renard turquoise à l'écharpe corail.

## Pitch / histoire
Le **Docteur Néo Cortisol** (savant à tête énorme gonflée de stress, un « C » sur le front, blouse trop courte)
veut rendre le monde entier stressé avec son *Stressotron*. Il a kidnappé **Zina la fennec** (amie de Lumen).
Lumen — qui n'est PAS un bandicoot, c'est un renard, mais personne ne l'écoute — traverse 4 îles pour la sauver,
aidé par **Oku Oku**, un masque tiki en carton aux yeux qui bougent (parodie d'Aku Aku) qui donne de mauvais conseils.
Running gag : des panneaux et le jeu lui-même s'excusent d'être une copie (« Ceci n'est pas Crash. Nos avocats insistent. »).

## Arborescence et propriétaires (chaque agent ne modifie QUE ses fichiers)
| Fichier(s) | Propriétaire |
|---|---|
| `src/main.js`, `src/core/*`, `src/game/player.js`, `src/game/level.js`, `src/game/game.js`, `src/game/save.js`, `src/levels/builder.js`, `src/levels/index.js`, `src/game/entities/index.js` | Lead (moteur) |
| `src/art/lumen.js` (Lumen, Oku Oku, montures, animations de mort) | Agent Personnage |
| `src/art/environment.js` (+ `src/art/env-*.js` libres) thèmes, ciel, lumières, plateformes, décor | Agent Environnement |
| `src/game/entities/crates.js`, `src/game/entities/pickups.js` (caisses, lucioles, chaussettes, panneaux, portail de fin) | Agent Caisses |
| `src/game/entities/enemies.js`, `src/game/entities/hazards.js` (ennemis, pièges, plateformes mobiles, poursuivants) | Agent Ennemis |
| `src/game/entities/bosses.js`, `src/levels/bosses.js` | Agent Boss |
| `src/levels/w1.js`, `src/levels/w2.js` | Agent Level design A |
| `src/levels/w3.js`, `src/levels/w4.js`, `src/levels/secret.js` | Agent Level design B |
| `src/audio/*` | Agent Audio |
| `src/ui/*` (+ `src/ui/*.css`) | Agent UI |
| `tests/*` | chacun peut AJOUTER un fichier `tests/<domaine>.test.js` (tests Node purs, sans DOM) |

Fichiers « fx » partagés : aucun. Si tu as besoin d'un utilitaire, mets-le dans TES fichiers.
Dépendances : uniquement `three` (et `three/examples/jsm/...` si utile). Pas de nouveaux paquets npm.

## Repère & unités
- Unité = 1 mètre. Lumen mesure ~1.1 m. Les caisses font **1×1×1**, origine **au centre du bas**.
- Les niveaux avancent vers **-Z** (on « rentre dans l'écran »). +Y en haut. +X à droite.
- Position d'entité `{x,y,z}` = **centre du bas** (pieds).

## Bus d'événements (`src/core/events.js`)
`import { bus } from '../core/events.js'` — `bus.on(name, fn) → off()`, `bus.emit(name, payload)`.

| Événement | Payload | Émis par |
|---|---|---|
| `sfx` | `{ name, pos?: Vector3, vol?: number, pitch?: number }` | tout le monde (via `ctx.sfx(name, opts)`) |
| `music` | `{ track: string }` (`'' ` = stop) | moteur |
| `music:mod` | `{ invincible?: bool, boss?: bool, danger?: bool, rate?: number }` | moteur / boss |
| `hud:lights` `hud:lives` `hud:masks` | `{ value }` | moteur |
| `hud:crates` | `{ broken, total }` | moteur |
| `hud:boss` | `{ name, hp, maxHp }` ou `null` | boss |
| `hud:timer` | `{ t, frozen }` (contre-la-montre) | moteur |
| `toast` | `{ text: {fr,en} \| string, kind?: 'info'\|'joke'\|'warn'\|'big', duration? }` | tout le monde |
| `dialog` | `{ speaker: 'oku'\|'cortisol'\|'zina'\|'lumen', text:{fr,en} }` (bulle courte non bloquante) | tout le monde |
| `level:start` `level:complete` `level:death` `level:respawn` `level:checkpoint` | objets (cf. game.js) | moteur |
| `power:unlock` | `{ power }` | moteur |
| `shake` | `{ amount }` | tout le monde (secousse caméra) |

### Noms de SFX (l'audio DOIT tous les implémenter ; inconnu = ignoré sans erreur)
`jump, double_jump, land, spin, slide, slam, footstep, crate_break, crate_bounce, crate_iron, light, light_many,
life, mask_get, mask_lose, mask_invincible, checkpoint, tnt_tick, explosion, nitro_bounce, switch, outline_on,
enemy_hit, enemy_kick, enemy_squash, hurt, death_fall, death_burn, death_squash, death_water, death_zap,
death_explode, death_eaten, respawn, goal, sock, gold_sock, menu_move, menu_ok, menu_back, boss_hit, boss_roar,
boss_defeat, laser, fire, splash, spring, crumble, wind, rumble, honk, meow, quack, robot, power_unlock, time_freeze`

### Pistes musicales
`title, map, beach, jungle, river, desert, medina, sidibou, ice, cave, aurora, factory, lab, space, tower, golden,
boss, final_boss, chase, ride, victory, gameover, results, ending`

## Contexte `ctx` passé aux entités
```js
ctx = {
  scene, camera,            // THREE.Scene, THREE.PerspectiveCamera
  level,                    // runtime Level (voir plus bas)
  player,                   // Player (voir plus bas)
  game,                     // session : game.addLights(n), game.addLife(n=1), game.addMask(), game.hurt(cause) ,
                            //   game.kill(cause), game.lives, game.lights, game.masks, game.timeTrial (bool),
                            //   game.freezeTimer(seconds), game.hasPower(name)
  time,                     // secondes écoulées dans le niveau
  sfx(name, opts),          // raccourci bus 'sfx'
  shake(amount),            // secousse caméra (0.1 léger … 1 énorme)
  fx,                       // effets partagés simples : fx.burst(pos, color, count), fx.ring(pos, color), fx.text(pos, str, color)
  lang,                     // 'fr' | 'en'
  quality,                  // { level: 0|1|2, shadows: bool }   0 = mobile faible
  theme,                    // id de thème courant
}
```

## Interface d'entité (registre `src/core/registry.js`)
```js
import { registerEntity } from '../../core/registry.js';
registerEntity('crate', (def, ctx) => entity);   // un type = une fabrique ; switch(def.kind) dedans
```
`def` = objet de niveau `{ type, kind, x, y, z, id, ...params }` (`id` unique fourni par le builder).

Objet entité retourné (tous champs optionnels sauf `object3d`) :
```js
{
  object3d,                 // THREE.Object3D ajouté à la scène par le niveau
  box,                      // { min:{x,y,z}, max:{x,y,z} } AABB monde (à garder à jour si l'entité bouge)
  solid: false,             // true → le joueur entre en collision / peut se tenir dessus (caisses, plateformes)
  oneWay: false,            // solide traversable par dessous
  delta: {x,y,z},           // déplacement de la frame (plateformes mobiles), le joueur debout est transporté
  slippery, conveyor:{x,z}, // propriétés de sol si solid
  counts: false,            // true → compte dans le total de caisses (le niveau lit ce flag à la création)
  update(dt, ctx),
  onLand(player, ctx),      // le joueur ATTERRIT dessus (solide uniquement) → ex: casser la caisse et rebondir
  onWall(player, ctx),      // le joueur pousse contre ce solide de côté (chaque frame de contact)
  onBump(player, ctx),      // le joueur la cogne par DESSOUS de la tête (solide)
  onTouch(player, ctx, info),// chevauchement AABB (non solide) ; info = { fromAbove: bool } (le joueur tombait et ses pieds étaient au-dessus du milieu)
  onSpin(player, ctx),      // touché par la toupie (une fois par toupie) ; aussi appelé par la glissade (player.sliding)
  onSlam(player, ctx, power),// body-slam qui atterrit dessus ou dans le rayon ; power=2 si super slam
  onExplode(ctx, source),   // prise dans une explosion (TNT/Nitro) → casser / tuer
  onRespawn(ctx),           // après la mort du joueur : se réinitialiser (voir ctx.level.isCommitted(id))
  dead: false,              // true → le niveau retire l'entité (object3d retiré, dispose() appelé)
  dispose(),
}
```

### API utile côté niveau (`ctx.level`)
- `level.crateBroken(entity)` → à appeler quand une caisse **qui compte** est cassée (une seule fois).
- `level.isCommitted(id)` → true si l'entité a été cassée AVANT le dernier checkpoint (doit rester cassée au respawn).
- `level.markGone(id)` → mémorise qu'une entité non-caisse (luciole ramassée, ennemi tué) a disparu (même logique checkpoint).
- `level.setCheckpoint(pos)`, `level.explode(pos, radius, source)` → appelle `onExplode` des entités dans le rayon + blesse le joueur s'il est dedans.
- `level.entities` (tableau), `level.spawn(def)` → crée une entité à la volée (ex: lucioles qui sautent d'une caisse).
- `level.findByGroup(group)` → entités dont `def.group === group` (caisses switch/outline).
- `level.complete()` → fin de niveau (le portail l'appelle).
- `level.data` → les données du niveau.

### API utile côté joueur (`ctx.player`)
`player.pos` (Vector3, pieds), `player.vel` (Vector3), `player.box` (AABB), `player.grounded`, `player.spinning`,
`player.sliding`, `player.slamming`, `player.dead`, `player.invincible` (bool, 3 masques), `player.facing` (radians),
`player.bounce(vy = 12)` (rebond forcé type caisse/ennemi), `player.launch(vx, vy, vz)`, `player.object3d`.
Blesser le joueur : `ctx.game.hurt(cause)` (perd un masque ou meurt). Tuer net : `ctx.game.kill(cause)`.
Causes de mort (animations dédiées) : `fall, burn, squash, water, zap, explode, eaten, generic`.

## Catalogue d'entités (noms FIGÉS — les level designers s'en servent, les agents les implémentent)
### `type: 'crate'` (agent Caisses) — 1×1×1, solide
`basic` (5 lucioles qui jaillissent) · `lights` (caisse « ? » à rebonds : +1 luciole par rebond, max 10, puis cassée) ·
`bounce` (ressort : rebond plus haut, se casse à la toupie) · `life` (tête de Lumen, +1 vie) · `mask` (masque Oku Oku) ·
`checkpoint` (« C » : checkpoint) · `iron` (indestructible, sauf super slam) · `ironBounce` (ressort indestructible) ·
`tnt` (« BOUM » : sauter dessus → compte 3-2-1 puis explose ; toupie → explose de suite) · `nitro` (« PAF » vert qui
sautille : explose au moindre contact) · `nitroSwitch` (fait exploser tous les nitro du niveau) · `switch` (« ! » :
matérialise les `outline` du même `group`) · `outline` (caisse fantôme fil de fer, intangible jusqu'au switch) ·
`time1|time2|time3` (n'existent qu'en contre-la-montre : gèle le chrono 1/2/3 s) · `legs` (caisse à pattes qui
s'enfuit en criant quand on approche !) · `mystery` (surprise aléatoire : lucioles, masque, vie, ou… une poule) ·
`stack` n'est PAS une caisse : le builder empile.
Comptent dans le total : tout sauf `iron, ironBounce, time*`. Les `outline` comptent.
### `type: 'pickup'` (agent Caisses)
`light` (luciole flottante, +1) · `sock` (chaussette colorée secrète, param `color: 'red'|'blue'|'green'|'purple'`) ·
`goldSock` (posée par le moteur à la fin si toutes les caisses sont cassées) · `sign` (panneau en bois, param `text:{fr,en}`,
affiche un toast blague quand on passe devant) · `goal` (portail de fin « Portail Lumineux » → `ctx.level.complete()`).
### `type: 'enemy'` (agent Ennemis) — params communs : `patrol: { axis:'x'|'z', range, speed }`
`crab` (va-et-vient latéral) · `turtle` (sauter dessus → la retourne, elle sert alors de trampoline ; toupie → envolée) ·
`plant` (plante carnivore fixe qui croque : on ne peut pas sauter dessus quand elle attaque) · `bat` (vol sinusoïdal) ·
`porcupine` (piquants : impossible de sauter dessus quand hérissé) · `scorpion` · `camel` (crache des noyaux) ·
`pigeon` (pique sur le joueur) · `cat` (chat de Sidi Bou Saïd, inoffensif, vole 5 lucioles et s'enfuit, toupie = les rend) ·
`penguin` (glisse sur le ventre) · `yetiKid` (lance des boules de neige) · `robot` (aspirateur qui fonce) ·
`drone` (tire un laser vertical périodique) · `cactus` (saute vers le joueur) · `skunk` (nuage toxique) ·
`rat` (rat de labo en blouse) · `chicken` (poule paniquée inoffensive, rebondit).
Règle Crash : **la toupie éjecte l'ennemi VERS LA CAMÉRA** (il s'écrase sur l'écran façon dessin animé), sauter dessus l'écrase.
### `type: 'hazard'` (agent Ennemis)
`spikes` (`period, offset`) · `fireJet` (`period, offset`) · `pendulum` (`length, speed`) · `crusher` (`period`) ·
`laser` (`axis:'x', width, period`) · `water` / `lava` (zones `w,d` : mort `water`/`burn`) · `saw` (`path` ou `patrol`) ·
`barrels` (lanceur de tonneaux qui roulent vers le joueur, `interval`) · `wind` (`w,d,h, force:{x,z}`) ·
`boulder` (le POURSUIVANT des niveaux `chase` : `style: 'moon'|'tajine'|'snowball'|'roomba'`, `speed`) — il suit l'axe -Z
derrière le joueur, l'écrase au contact (cause `squash`), accélère si le joueur prend trop d'avance, s'arrête au portail.
### `type: 'platform'` (agent Ennemis) — solides — ATTENTION : pour les plateformes, `y` = la surface du DESSUS
`moving` (`w,h,d`, `to:{x,y,z}` delta, `period`) · `falling` (tremble puis tombe, `delay`) · `sinking` (nénuphar qui coule) ·
`bouncy` (champignon/nuage trampoline) · `rotating` (`w,d`, `speed` : tourne autour de Y, transporte) ·
`vanishing` (`period, offset` : clignote/apparait).
### `type: 'boss'` (agent Boss)
`crabKing` (Papa Crabe Royal, île 1) · `djinn` (Djinn de la Lampe Mal Polie, île 2) · `yeti` (Yéti Influenceur, île 3) ·
`cortisol` (Docteur Néo Cortisol, finale) · `goldenCortisol` (boss secret).
Un boss gère son HUD via `hud:boss`, appelle `ctx.level.complete()` à sa défaite (après une petite cinématique).

## Format des données de niveau (sortie du builder `src/levels/builder.js`)
```js
{
  id: '1-1', world: 1, index: 1, name: { fr, en }, theme: 'beach', music: 'beach',
  mode: 'run' | 'chase' | 'ride' | 'side' | 'boss',
  spawn: [x, y, z], killY: -15,
  platforms: [ { min:[x,y,z], max:[x,y,z], kind: 'ground', slippery?, conveyor?:[vx,vz], damage?:'burn', oneWay? } ],
  entities: [ { type, kind, x, y, z, id, ...params } ],
  zones: [ { min:[x,y,z], max:[x,y,z], camera?: {...}, autoRun?: speed } ],
  decor: [ { kind, x, y, z, s?, r? } ],          // décor explicite (en plus du décor procédural du thème)
  goal: [x, y, z],
  mount?: 'snail'|'camel'|'penguin'|'rocket', autoRun?: 10,
  camera: { mode: 'behind'|'front'|'side'|'arena', ... },
  timeTrial: { gold, silver, bronze },           // secondes
  intro: { fr, en },                             // phrase d'accroche affichée au début
  bounds: { min:[...], max:[...] }               // calculé par le builder
}
```
### Types de plateforme (`kind`) que l'environnement sait peindre (inconnu → `ground`)
`ground, grass, sand, stone, wood, metal, ice, tile, brick, crystal, cloud, conveyor, glass, lava_rock, snow, bridge`

## Thèmes (`theme`) — l'environnement les implémente TOUS
`beach, jungle, river, desert, medina, sidibou, ice, cave, aurora, factory, lab, space, tower, boss_beach,
boss_desert, boss_ice, boss_lab, golden`

## Monde (src/levels/index.js)
- Île 1 **Île des Lucioles** : 1-1 Plage du Débutant (run, beach) · 1-2 Jungle Toupie (run, jungle) · 1-3 La Lune qui
  Roule (chase, jungle) · 1-4 Escargot Turbo (ride snail, beach) · 1-5 Rivière des Nénuphars (run, river) · B1 Papa Crabe Royal
- Île 2 **Dunes de Tozeur** : 2-1 Les Dunes qui Chantent (run, desert) · 2-2 Médina Labyrinthe (side, medina) ·
  2-3 Escaliers de Sidi Bou Saïd (run, sidibou) · 2-4 Le Tajine Fou (chase, desert) · 2-5 Chameau Express (ride camel, desert) · B2 Djinn
- Île 3 **Glacier des Pingouins Grognons** : 3-1 Glissade Frileuse (run, ice) · 3-2 Grotte Cristal (run, cave) ·
  3-3 Avalanche ! (chase, ice) · 3-4 Bobsleigh Pingouin (ride penguin, ice) · 3-5 Aurores Suspendues (run, aurora) · B3 Yéti
- Île 4 **Usine du Dr Cortisol** : 4-1 Chaîne de Montage (run, factory) · 4-2 Labo Toxique (side, lab) ·
  4-3 Roomba Géant (chase, factory) · 4-4 Fusée en Carton (ride rocket, space) · 4-5 La Tour du Stress (run, tower) · B4 Cortisol
- Secret **S-1 La Lune Dorée** (run, golden) + boss secret `goldenCortisol`, débloqué avec toutes les chaussettes dorées.

Pouvoirs débloqués par les boss : B1 → `doubleJump` · B2 → `tornado` (maintenir toupie = planer) · B3 → `superSlam` ·
B4 → `turbo` (course rapide en maintenant glissade au sol). Chaussettes dorées → écharpes de couleur.

## Commandes
Clavier : flèches/WASD bouger · Espace saut · J / X / Shift toupie · K / C / Ctrl glissade (au sol) / body-slam (en l'air) ·
Échap/P pause. Manette : A saut, X/B toupie, B/R2 glissade, Start pause. Mobile : joystick gauche, boutons à droite.

## Qualité / perf
Viser 60 fps sur un téléphone moyen : partager géométries/matériaux (cache module), éviter les allocations par frame,
`ctx.quality.level === 0` → moins de particules/ombres. Pas d'ombres sur les petites entités sauf qualité 2.

## Entité : champ supplémentaire
- `intangible: true` → un `solid` qui est temporairement ignoré par la physique (caisses `outline` avant le switch).
- `alwaysUpdate: true` → mise à jour même loin du joueur (poursuivants, boss). Sinon, les entités à > 70 m ne sont ni mises à jour ni visibles.

## Builder (src/levels/builder.js) — rappel
Les offsets `fwd` sont relatifs à l'**ancre** = début du dernier segment posé (`floor`, `step`, `gap`, `stones`, `goal`).
`.floor(14).crate('basic', 0, 6)` → caisse à 6 m dans ce sol. `.gap(6).block(0, 0.5, 3, 2, 0.5, 2)` → bloc au milieu du trou.
`.floor(len, { w, kind, lat, slippery, conveyor, damage })`, `.step(dy, len)`, `.stones(n, {size, gap, dy, zigzag})`,
`.walls(len)`, `.crate / stack / row / pyramid / lights / enemy / hazard / platform / checkpoint / sign / sock / boss / deco`,
`.zone(len, { camera:{mode,…}, toast, lockZ, autoRun })`, `.goal()`, `.build()`. Lire le fichier, il est court.

## API art — `src/art/lumen.js` (agent Personnage)
```js
createLumen({ scarf }) → {
  object3d,                       // pieds à l'origine, regarde vers +Z (le contrôleur fait tourner le parent)
  update(dt, s),                  // s = { anim, speed, vy, t, invincible, grounded, spinT, tornado }
                                  // anim ∈ idle, run, jump, flip (double saut), fall, land, spin, slide, slam, ride, victory, dead
  playDeath(cause) → secondes,    // lance l'animation de mort (fall, burn, squash, water, zap, explode, eaten, generic)
  reset(),                        // revient à l'état normal après respawn
  setScarf(colorHex), dispose()
}
createOku() → { object3d, update(dt, { count, target: Object3D, time, facing }), dispose() }
   // le masque flotte près de l'épaule de Lumen ; count 0 = invisible, 1 = carton, 2 = + plumes, 3 = DORÉ géant disco devant Lumen
createMount(kind) → { object3d, seat: Vector3 (position locale où poser Lumen), update(dt, { speed, turning, jumping, t }), dispose() }
   // kind ∈ snail (escargot turbo), camel, penguin (bobsleigh), rocket (fusée en carton)
```

## API environnement — `src/art/environment.js`
```js
createEnvironment(scene, levelData, { quality, renderer, camera }) → { update(dt, { camera, player, time }), dispose() }
```
Responsable de : `scene.background`/ciel, `scene.fog`, lumières (dont soleil avec ombres si `quality.shadows`),
**le maillage de TOUTES les `levelData.platforms`** (par `kind` et thème), le décor explicite `levelData.decor`,
et un **décor procédural** autour du parcours (palmiers, cactus, maisons bleues, pics de glace, tuyaux…) placé hors du
chemin (pas sur les plateformes, utiliser `bounds` et les boîtes). Eau/lave décoratives sous le niveau selon le thème.
Doit tout retirer/disposer dans `dispose()` (on charge plusieurs niveaux d'affilée).

## API audio — `src/audio/audio.js`
`createAudio({ bus, save }) → { unlock(), setVolumes({ music, sfx }), dispose() }` — écoute `sfx`, `music`, `music:mod`.
`unlock()` est appelé au premier geste utilisateur (AudioContext). Volumes dans `save.settings.music / sfx` (0..1).

## API UI — `src/ui/ui.js`
```js
createUI({ root, bus, input, save, worlds, levels, order, isUnlocked(id), goldSockCount(), audio, isTouch, onSettingsChange, game }) → {
  title(): Promise<void>,                 // écran titre ; se résout au premier appui (clic/touche/tap)
  story(id): Promise<void>,               // cinématiques (panneaux illustrés + texte) : intro, island2, island3, island4, ending, secret, secret_ending
  map({ save, game }): Promise<{ levelId, timeTrial }>, // carte du monde, choix niveau, mode chrono si niveau fini ; contient aussi Options
  hud: { show(levelData), hide() },       // HUD en jeu (écoute hud:* , toast, dialog, power:unlock)
  pause(): Promise<'resume'|'restart'|'map'>,
  results(stats, { goldSock, newSpoon, powerUnlocked, firstClear }): Promise<void>,
  gameOver(): Promise<'continue'|'map'>,
  powerUnlocked(power): Promise<void>,    // panneau tuto du nouveau pouvoir
  loading(show, text),
  touch: { setVisible(bool) },            // contrôles tactiles → input.setVirtual({ x, y, jump, spin, slide, pause })
}
```
Menus navigables au clavier/manette via `input.pressed('up'|'down'|'left'|'right'|'confirm'|'back'|'jump')` (boucle rAF
interne à l'UI) ET à la souris/tactile. Langue : `save.lang` ('fr' par défaut si navigateur FR).

## Outils de test
- `npm run dev` puis `http://localhost:5173/?debug&level=2-3` lance directement un niveau (`&tt` = contre-la-montre).
- `window.__LB` (avec `?debug`) : `level, player, game, save, play(id), setPower(p), teleport(x,y,z), completeLevel(), unlockAll(), fps`.
- `node tests/browser/smoke.mjs [ids…]` : lance chaque niveau dans Chromium headless, échoue sur toute erreur console,
  screenshots dans `test-results/level-<id>.png` (REGARDE-LES avec l'outil Read pour vérifier visuellement).
- `node tools/trace.mjs <id> [out.png]` : trace position joueur/caméra en courant tout droit.
- Niveaux de test : chaque équipe peut créer `src/levels/sandbox/<equipe>.js` (export default [données…], ids `T-<equipe>-…`), ils sont chargés automatiquement (`?debug&level=T-crates-1`).
- `npm test` : tests Node (`tests/*.test.js`).
