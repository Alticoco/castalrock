# Castalrock — règles pour Claude

Jeu solo d'exploration, récolte et village en 3D low poly, dans le navigateur, univers médiéval fantasy. Nom provisoire. Projet personnel : le concepteur ne code pas, il fait le game design et les tests ; Claude écrit tout le code.

## Dépôt public : anonymat (règle absolue)

- Le dépôt GitHub `Alticoco/castalrock` est **public**. Dans tout fichier suivi par git (code, commentaires, documents, journal) et dans les messages de commit : jamais le prénom ni le nom du concepteur, ni e-mail, adresse, chemin de dossier personnel (`C:\Users\…`, `E:\…`, OneDrive) ou autre détail de sa vie. Écrire « le concepteur » ou tourner la phrase sans personne.
- Seule la branche `main` est envoyée : `git push origin main`, avec l'accord du concepteur. Chaque envoi republie la page du jeu.
- La branche locale `archive/historique-prive` garde l'ancien historique (avant publication), avec des données personnelles : **ne jamais l'envoyer**, ne jamais utiliser `git push --all`, `--mirror` ni `--tags`. La lire avec `git log` ou `git show`, sans la récupérer dans le dossier (`git switch` dessus effacerait `docs/concepts/` en revenant sur `main`).
- `docs/concepts/` (images de référence générées par IA) et `docs/prompts-images.md` restent sur le disque mais sont ignorés par git : ils ne sont pas publiés.

## À lire au début de chaque session

1. `docs/cahier-des-charges.md` : ce qu'on construit et les décisions prises (ne pas les rediscuter).
2. `docs/feuille-de-route.md` : les étapes, leur difficulté, leurs dépendances et le **modèle à utiliser**.
3. `docs/journal.md` : ce qu'ont fait les sessions précédentes, questions en attente.
4. `docs/concepts/` : images de référence (quand il y en a ; locales, non publiées).

## Lancer et tester

- `npm install` une fois, puis `npm run dev` : le jeu s'ouvre sur http://localhost:5175 (port fixe : la sauvegarde du navigateur y est liée). Configuration du navigateur de l'appli : `.claude/launch.json`.
- `npm test` : tests Vitest. `npm run build` : vérification TypeScript et construction.
- Avant chaque commit : `npm test` et `npm run build` passent.
- Version en ligne : https://alticoco.github.io/castalrock/ . Reconstruite et publiée automatiquement à chaque envoi de `main` (`.github/workflows/publier.yml` : tests, construction, puis GitHub Pages).

## Répartition du travail

- Chaque étape de la feuille de route indique son modèle. Claude (session principale) garde la conception, les étapes délicates qu'il ne délègue pas, l'assemblage et la correction des bugs diagnostiqués.
- Agents : `developpeur` (une étape précise), `testeur`, `refactoreur`, `redacteur-doc`, `enqueteur-bugs`, `relecteur` (fin de gros travail), `Explore` (recherche, Haiku).
- Consigne à un agent : objectif, fichiers, contraintes, critères de réussite, compte rendu attendu.
- Parallèle seulement si les étapes sont indépendantes et ne touchent pas les mêmes fichiers.

## Session autonome

- Prendre les étapes `[ ]` dont les dépendances sont faites, de type « auto ». S'arrêter sur « à valider ».
- Travailler sur une branche `autonome/<AAAA-MM-JJ>` ou `etape/<n°>-<mot-cle>`, un commit par étape, jamais de fusion dans `main` sans l'accord du concepteur. Jamais d'envoi sur GitHub en session autonome.
- En fin de session : étape à `[~]` dans la feuille de route, entrée en haut de `docs/journal.md` (fait, **à tester** en manipulations concrètes, questions).
- Un choix non tranché par le cahier des charges : ne pas deviner, écrire la question dans le journal.

## Architecture (à respecter)

- `src/regles/` : règles du jeu en TypeScript pur (inventaire, ressources, craft, XP, sauvegarde). **Aucun import de three.** Testé (`*.test.ts` à côté).
- `src/mine/` : la mine (zone intérieure séparée) : `plan.ts` pur et testé, `sceneMine.ts` et `mine.ts` pour three et le branchement.
- `src/maison/` : l'intérieur de la maison du joueur (autre zone séparée), même découpage : `plan.ts` pur et testé, `sceneMaison.ts`, `maison.ts`. Pour le reste du jeu, `ctx.mine` répond aussi pour la maison (`mineAvecMaison`) : `mine.contient` veut dire « mine ou maison », `mine.dedans` « mine seulement ».
- `src/monde/` : génération du terrain. `terrain.ts` et `bruit.ts` sont purs (hauteur, biome en un point, à partir d'une graine) et testés ; `maillage.ts` construit les objets three.
- `src/moteur/` : boucle de jeu, entrées clavier et souris, réglages du joueur (sensibilité), stockage des 3 emplacements de partie. `modeTest.ts` : les outils de test (F6, F7, F8, T, « Retour au village ») ne marchent qu'avec `npm run dev`, pas dans la version construite.
- `src/jeu/` : l'assemblage du jeu, un module par système (récolte, combat, mort, sorts, village, commandes…). L'état partagé de la partie est l'objet `EtatJeu` (`partie.ts`), les services créés au démarrage sont dans `contexte.ts`. `src/main.ts` ne fait que relier les modules et lancer la boucle.
- `src/scene/` : rendu three (lumière, ciel, caméras, modèles en code). Ne contient aucune règle de jeu.
- `src/ui/` : interface HTML par-dessus le canvas.
- `src/son/` : sons. `catalogue.ts` (fichiers et volumes) et `choix.ts` (variante, sol sous les pieds, cris des créatures) sont purs et testés ; `moteurSon.ts` joue les sons avec la Web Audio (oreille attachée à la caméra, sons placés dans le monde). Les branchements à chaque image sont dans `src/jeu/sons.ts`.
- `src/config.ts` : toutes les valeurs réglables (vitesses, distances, durées, couleurs des biomes).
- **Aléatoire uniquement via le générateur à graine** (pas de `Math.random()` dans `src/regles/` ni `src/monde/`).
- Pas de moteur physique : sol = fonction de hauteur, obstacles = cercles.
- Unités : 1 unité three = 1 mètre ; axe Y vers le haut.

## Conventions

- Textes du jeu, commentaires et noms du domaine en français (`arbre`, `rocher`, `recolte`, `biome`).
- Pas de nouvelle dépendance npm sans la noter dans le journal. Aucune API externe, aucune clé.
- Modèles 3D externes : licence CC0 seulement, dans `public/modeles/` avec leur source dans `public/modeles/SOURCES.md`. Télécharger un pack demande l'accord du concepteur.
- Sons : licence CC0 seulement, dans `public/sons/` avec leur source dans `public/sons/SOURCES.md`.
- Commits en français, courts.
- Noms de fichiers : jamais de mot filtré par les bloqueurs de pubs (`publicite`, `pub`, `ads`, `banner`, `tracking`, `analytics`).
- Le concepteur ne lit pas le code : expliquer en français simple ce qui a changé et quoi tester.
