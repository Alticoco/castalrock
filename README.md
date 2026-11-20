# Castalrock

Castalrock est un jeu solo d'exploration, de récolte et de village, en 3D low poly, qui se joue dans le navigateur. L'univers est médiéval fantasy. Le nom est provisoire.

Le jeu raconte une histoire, celle du Cœur de Castal, un grand cristal brisé dont les éclats sont aux mains d'une bande de bandits. Elle se joue en 3 heures environ, du prologue à la fin.

<!-- capture d'écran à ajouter -->

## Jouer

**[Jouer dans le navigateur](https://alticoco.github.io/castalrock/)**, sans rien installer.

- Il faut un ordinateur avec clavier et souris (pas de version pour téléphone ni tablette) et un navigateur récent (Chrome, Edge, Firefox ou Safari).
- Clique dans la page pour prendre la souris ; Échap la rend.
- Ta partie est enregistrée dans **ton** navigateur, sur ton ordinateur : chaque joueur commence sa propre partie, et rien n'est envoyé ailleurs. Elle est perdue si tu effaces les données du site, et n'est pas gardée en navigation privée.

## Ce qu'on y fait

- Explorer un monde vallonné généré à partir d'une graine, avec 4 biomes (prairie, forêt, montagne, marais) et une mine.
- Récolter et fabriquer : outils et armes du bois au cristal, armures, casques, arc, pièges, cuisine.
- Faire grandir le village et parler à ses habitants.
- Combattre des slimes, des gobelins, des loups, des bandits et leur chef.
- Suivre l'histoire du Cœur de Castal jusqu'au livre de fin, qu'on feuillette une fois l'histoire terminée.
- Profiter du cycle jour et nuit.
- Jouer à son rythme : la partie est sauvegardée automatiquement dans le navigateur (toutes les 30 secondes), avec 3 emplacements de partie (Échap, puis « Parties »).

## Installer et lancer sur son ordinateur

Pour modifier le jeu ou le lancer sans connexion. Il faut [Node.js](https://nodejs.org/) (le jeu a été testé avec la version 24).

```bash
npm install
npm run dev
```

Ouvre ensuite http://localhost:5175 dans ton navigateur. Le port est fixe : la sauvegarde du navigateur y est liée (elle est séparée de celle de la version en ligne).

La version en ligne est reconstruite et publiée automatiquement à chaque envoi sur la branche `main` (`.github/workflows/publier.yml`).

Deux autres commandes :

```bash
npm run build   # vérifie le TypeScript et construit la version à publier, dans dist/
npm test        # lance les tests (Vitest)
```

## Touches principales

| Touche | Action |
|---|---|
| Z Q S D | se déplacer |
| Shift | courir |
| Espace | sauter |
| Clic | frapper, récolter, combattre |
| E | interagir (coffre, établi, forgeron, auberge, feu, butin) |
| 1 à 6 | choisir l'épée, la hache, la pioche, l'arc, la torche, les objets posables |
| A / X / C | sorts : boule de feu, soin, barrière |
| R | boire une potion de soin |
| Tab ou I | inventaire |
| K / J / M | compétences / quêtes / carte |
| V | changer de vue |

Appuie sur H pour afficher l'aide complète. Échap ouvre le menu (pause, sauvegarde, parties, graphismes). Un clic à côté d'un écran ou d'un dialogue le referme.

## Comment c'est fait

TypeScript, [Three.js](https://threejs.org/) pour la 3D, Vite pour le développement et la construction, Vitest pour les tests.

- Pas de moteur physique : le sol est une fonction de hauteur et les obstacles sont des cercles.
- Tous les modèles 3D sont écrits en code. Il n'y a aucun fichier de modèle.
- Les règles du jeu sont en TypeScript pur, sans Three.js, et testées (environ 950 tests).

Les dossiers de `src/` :

- `regles/` : les règles (inventaire, craft, XP, histoire, sauvegarde), testées.
- `monde/`, `mine/`, `maison/` : génération du terrain, mine, intérieur de la maison.
- `jeu/` : l'assemblage, un module par système (récolte, combat, village...).
- `scene/`, `ui/`, `son/`, `moteur/` : rendu 3D, interface, sons, boucle de jeu et entrées.

## Fait avec une IA

Le game design, les tests et les décisions sont d'Alticoco. Le code, les modèles 3D et les textes ont été écrits par Claude (Anthropic). Les documents de conception et le journal de travail sont dans `docs/`. Les images de référence générées par IA (`docs/concepts/`) et leurs consignes (`docs/prompts-images.md`), citées par endroits dans le code et les documents, ne sont pas publiées.

## Crédits et licences

- Jeu (code, textes, modèles 3D, documents) : © 2026 Alticoco, licence [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/deed.fr). Tu peux le copier, le modifier et le partager en citant l'auteur, sans usage commercial, et une version modifiée doit garder la même licence. Détails dans `LICENSE`.
- Sons : licence CC0, sources dans `public/sons/SOURCES.md`.
- Polices (Cinzel et Alegreya Sans) : licence SIL Open Font License, détails dans `public/polices/SOURCES.md`.
- [Three.js](https://threejs.org/) : licence MIT, texte dans `public/licences/three.js-LICENSE.txt`.

## État du projet

Projet personnel, terminé. Aucune suite n'est prévue.
