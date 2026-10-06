# Lumen Bandicoot

**Une aventure de plateforme 3D, mauvaise copie *officielle* de Crash Bandicoot, avec Lumen, le petit renard à l'écharpe.**
Lumen n'est pas un bandicoot. C'est un renard. Personne ne l'écoute.

▶ **[Jouer dans le navigateur](https://omarramo.github.io/lumen-bandicoot/)** — PC (clavier / manette) ou mobile
(paysage, contrôles tactiles). Déployé automatiquement sur GitHub Pages à chaque push sur `main`.

## L'histoire

Le **Docteur Néo Cortisol** — savant à la tête énorme, gonflée de stress — veut stresser le monde entier avec son
*Stressotron*, et il a kidnappé **Zina la fennec**. Lumen traverse quatre îles pour la sauver, accompagné d'**Oku Oku**,
un masque tiki en carton qui donne d'excellents mauvais conseils.

## Contenu

- **4 îles, 20 niveaux + 4 boss**, et un **monde secret** (La Lune Dorée + boss secret) :
  - Île des Lucioles — plage, jungle, poursuite d'une lune géante, escargot turbo, rivière de nénuphars, Papa Crabe Royal
  - Dunes de Tozeur — dunes, médina en 2.5D, escaliers de Sidi Bou Saïd, tajine fou, chameau express, le Djinn mal poli
  - Glacier des Pingouins Grognons — glissades, grotte de cristal, avalanche, bobsleigh pingouin, aurores, le Yéti Influenceur
  - Usine du Dr Cortisol — chaîne de montage, labo toxique, roomba géant, fusée en carton, tour du stress, Dr Cortisol
- **Moveset Crash** : saut, toupie d'écharpe, glissade, glissade-saut, body-slam — et des **pouvoirs à débloquer** sur les
  boss : double saut, tornade (planer), super slam, turbo.
- **Caisses** : basique, « ? » à rebonds, ressort, vie, masque, checkpoint, fer, TNT « BOUM », Nitro « PAF », switch/fantômes,
  chrono, caisse à pattes qui s'enfuit, caisse mystère (parfois une poule).
- **Collectibles** : lucioles (100 = 1 vie), masques Oku Oku (3 = MODE DISCO invincible), chaussettes dorées (toutes les
  caisses d'un niveau), chaussettes colorées secrètes, cuillères de contre-la-montre (bronze / argent / or), écharpes de couleur.
- **Morts comiques** dédiées (brûlé, aplati, électrocuté, explosé, avalé…), ennemis éjectés vers la caméra à la toupie.
- Musique et sons **100 % procéduraux** (WebAudio), graphismes **100 % procéduraux** (Three.js) : aucun fichier binaire.
- Français / anglais, sauvegarde locale, qualité graphique automatique, réduction des effets.

## Commandes

| Action | Clavier | Manette | Mobile |
|---|---|---|---|
| Bouger | Flèches / WASD / ZQSD | Stick gauche / croix | Joystick (gauche) |
| Sauter | Espace | A | Bouton Saut |
| Toupie | J / X / Shift | X / Y | Bouton Toupie |
| Glissade (au sol) / Body-slam (en l'air) | K / C / Ctrl | B / R2 | Bouton Glisse |
| Pause | Échap / P | Start | ⏸ |

## Développement

Prérequis : **Node.js ≥ 22.12**.

```sh
npm ci
npm run dev                         # http://localhost:5173
npm test                            # tests Node (moteur, niveaux, audio…)
node tests/browser/smoke.mjs        # lance chaque niveau dans Chromium headless + captures dans test-results/
npm run build                       # build de production dans dist/
```

Accès direct à un niveau : `http://localhost:5173/?debug&level=2-3` (`&tt` = contre-la-montre). Avec `?debug`,
`window.__LB` expose le niveau, le joueur et quelques triches de test (`play(id)`, `setPower(p)`, `unlockAll()`…).

## Architecture

Three.js r170 + Vite, modules ES. Voir [`docs/CONTRACTS.md`](docs/CONTRACTS.md) — la « bible » de l'équipe : API des entités,
format des niveaux, événements, catalogue.

```
src/
  main.js            boucle, rendu, flux (titre → carte → niveau → résultats)
  core/              bus d'événements, entrées, physique AABB, caméra, effets
  game/              joueur, niveau (checkpoints, morts, fin), session, sauvegarde
  game/entities/     caisses, collectibles, ennemis, pièges, plateformes, boss
  art/               Lumen + Oku Oku + montures, environnements des 18 thèmes
  audio/             synthé SFX + séquenceur musical
  ui/                titre, cinématiques, carte du monde, HUD, menus, contrôles tactiles
  levels/            DSL de construction + les 26 niveaux
```

Fait par une équipe d'agents Claude (moteur, personnage, environnements, caisses, ennemis, boss, level design ×2, audio,
UI) pour Omar Trabelsi. Lumen vient de [LUMEN](https://github.com/omarRamo/lumen) et
[Lumen Kart](https://github.com/omarRamo/lumen-kart).

*Crash Bandicoot est une marque d'Activision. Ce projet de fan, parodique et non commercial, n'y est pas affilié.
Aucun bandicoot n'a été blessé.*

Licence MIT.
