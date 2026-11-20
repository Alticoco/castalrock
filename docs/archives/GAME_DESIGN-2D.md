# Document de cadrage : jeu solo d'exploration, craft et village (titre provisoire)

> **Archive : ancienne version 2D, abandonnée.** Le jeu est devenu Castalrock, en 3D low poly. La référence actuelle est `docs/cahier-des-charges.md`. Ce document est conservé pour mémoire et n'est plus à jour.
>
> Contenu d'origine : ce document était la référence de la version 2D. Si une idée n'y était pas, on la discutait avant de la coder.

## 1. Le concept en deux phrases

Un jeu solo 2D, détendu, en médiéval fantasy (magie et épée). Le joueur est un simple villageois qui explore un monde ouvert, récolte, combat, fabrique, et fait grandir son village, ses compagnons et ses compétences.

## 2. Ce que doit ressentir le joueur

- Détente : on peut jouer 20 minutes ou 2 heures, quitter à tout moment sans perdre sa progression.
- Un peu de tension (risque de perdre ce qu'on transporte), mais jamais de frustration. Pas de morts répétées qui punissent.
- Satisfaction à voir le village, le personnage et les possibilités grandir.
- Moments « pilote automatique » : farm de ressources ou d'XP sans réfléchir.
- Le grind est accepté, mais jamais trop lent : une amélioration de base doit demander au moins une soirée, pas un mois.
- Aucun PVP, rien de compétitif.

## 3. Piliers (les 3 choses à ne jamais sacrifier)

1. Explorer pour récolter des ressources.
2. Crafter et améliorer le village.
3. Progresser (XP, compétences, quêtes) avec un équilibrage détendu.

## 4. Décisions déjà prises

**Vue et style**
- Vue de dessus « 3/4 » à la Stardew Valley, pixel art. Effets semi-3D par astuces 2D : le personnage passe derrière les arbres et toits, ombres, lumière jour/nuit, lueur du feu de camp.
- Pas de vraie vue isométrique (trop complexe, peu d'assets gratuits).

**Contrôles**
- Déplacement : ZQSD.
- Attaque automatique quand un ennemi est proche.
- Touches pour les compétences (magie : boule de feu, soin).
- Bouton « pilote automatique » : le personnage reste dans une zone et récolte ou combat seul, avec 10 % de vitesse en moins que le jeu actif.

**Monde**
- Monde ouvert, une seule région en V1, découpée en zones qui se chargent au fil du déplacement.
- Lieux principaux fixes (village, forêt, etc.). Ce qui se trouve sur les trajets varie (arbres tombés, buissons qui bloquent, ennemis, ressources, événements), sans changer de biome.
- Quelques trésors cachés et coffres en V1 (XP bonus, objets rares).

**Sauvegarde**
- Échap puis quitter : la progression est sauvegardée, partout, à tout moment.
- Auberges à des endroits fixes : point de réapparition, accès au coffre, envoi d'équipement vers le village.
- Feu de camp posable n'importe où contre du bois : point de réapparition.

**Mort (douce)**
- On perd les ressources collectées depuis le départ de la base (récupérables en retournant à l'endroit de la mort, à confirmer en test).
- L'équipement perd de la durabilité sans se casser. Il faut dépenser des ressources pour le réparer.
- Réapparition à la dernière auberge ou au dernier feu de camp.
- Le « sac magique » (inventaire protégé) s'agrandit avec le niveau ou l'argent. Son contenu n'est jamais perdu.

**Progression**
- XP gagnée à l'usage : couper du bois, miner, tuer des monstres, quêtes, trésors.
- Un point de compétence par niveau.
- Compétences : combat, récolte, craft, résistance, capacité de transport, magie.

**Village et base**
- Le village est un lieu visible qui grandit (plus de maisons, nouveaux habitants) ET un menu d'améliorations accessible depuis l'inventaire.
- Habitants à terme : bûcheron (récolte à la place du joueur), forgeron (réparations moins chères, améliorations), guilde de marchands (commerce, argent).
- Compagnons qui peuvent accompagner au combat et à l'exploration (plus tard).

**Missions envoyées (type jeu mobile)**
- On envoie un compagnon en mission de récolte, on ferme le jeu, et au retour le temps réel écoulé est comptabilisé (plafond à définir, ex. 8 à 12 h).
- Calcul fait à l'ouverture à partir de l'heure de départ enregistrée (aucun serveur).

**Quêtes**
- Au début : quêtes simples données par les villageois (« rapporte 10 bois »).
- Ensuite la montée en puissance : le seigneur voisin demande de tuer un monstre dans la forêt, de repousser des démons, etc.

**Ennemis**
- Pas de zombies. Animaux sauvages, monstres (slimes, gobelins, orques plus tard), bandits, et à terme chevaliers et mages.

**Difficulté**
- Un seul niveau, tranquille. À revoir plus tard.

## 5. Contenu de la V1 (le minimum jouable)

- 1 région ouverte, 2 ou 3 zones (autour du village, forêt, grotte ou mine).
- 4 ressources : bois, pierre, minerai, plante.
- Inventaire + sac magique.
- Craft : 6 à 8 recettes (outils, arme, armure légère, soin, établi).
- 3 ou 4 types d'ennemis (slime, gobelin, loup, bandit).
- Combat automatique + 2 compétences magiques (boule de feu, soin).
- XP, niveaux, points de compétence.
- Mort douce avec durabilité et réparation.
- Village : 2 ou 3 niveaux d'amélioration, 1 habitant (forgeron).
- 5 à 8 quêtes simples.
- Quelques coffres et trésors cachés.
- Auberge + feu de camp.
- Pilote automatique.
- Sauvegarde locale.

## 6. Repoussé après la V1

- Missions envoyées avec compagnons, bûcheron et guilde de marchands, compagnons de combat.
- Locomotives magiques (voyage rapide).
- Plus de magie, plus de monstres, quêtes du seigneur et boss.
- Événements sur les trajets, météo, cycle jour/nuit complet.
- Application PC installable, musique et sons, mobile.
- Plusieurs mondes ou univers (espace, etc.) : abandonné pour l'instant.

## 7. Choix techniques (décidés par Claude, le concepteur n'a pas à s'en occuper)

- Web d'abord : JavaScript/TypeScript avec la bibliothèque Phaser, projet créé avec Vite.
- Sauvegarde dans le navigateur (localStorage ou IndexedDB).
- Plus tard : emballage en application PC (Electron ou Tauri).
- Code découpé en fichiers clairs (carte, joueur, inventaire, craft, ennemis, quêtes, village, sauvegarde, interface), pour que chaque session ne touche que peu de fichiers.
- Versionnement avec git : un commit après chaque étape qui fonctionne.

## 8. Graphismes

- Un seul pack d'assets gratuit au style cohérent, choisi ensemble AVANT l'étape 2 (licence vérifiée, notée dans un fichier CREDITS.md).
- Avant ça, formes simples reconnaissables en attendant.
- L'IA peut compléter (icônes d'objets, illustrations, interface) mais pas remplacer un pack pour les personnages animés et les décors.

## 9. Règles de travail pour Claude Code

- Le concepteur ne lit ni ne modifie le code. Claude explique en français simple et dit exactement quoi faire (commandes, clics).
- Une session = une étape ou moins. Ne jamais lancer plusieurs gros systèmes d'un coup.
- Chaque étape doit être jouable et testée avant de passer à la suivante.
- Avant de coder : annoncer le plan de la session en 5 lignes max.
- Après : dire comment tester (« ouvre le jeu, appuie sur... »), faire un commit git, mettre à jour la section « Avancement » ci-dessous.
- Ne pas ajouter de fonctionnalité absente de ce document sans demander.
- Garder les valeurs d'équilibrage (vitesses, coûts, XP) dans un seul fichier de configuration facile à ajuster.

## 10. Découpage en étapes

0. Préparation : installer les outils, créer le projet, choisir le pack d'assets.
1. Un personnage qui se déplace (ZQSD) sur une petite carte avec collisions.
2. Ressources à récolter, inventaire, sac magique.
3. Menu Échap, sauvegarde et chargement.
4. Village de départ, coffre, établi, craft.
5. Un premier ennemi, combat automatique, vie du joueur.
6. Mort douce : perte des ressources, durabilité, réparation, réapparition.
7. XP, niveaux, points de compétence, 2 sorts.
8. Quêtes des villageois, première amélioration du village.
9. Auberge, feu de camp, pilote automatique.
10. Agrandir la région, plus d'ennemis, coffres et trésors, équilibrage.
11. Version « V1 » complète puis seulement missions envoyées et compagnons.

## 11. Avancement

- [ ] Étape 0
- [ ] Étape 1
(à compléter au fil des sessions)

## 12. Questions encore ouvertes

- Nom du jeu.
- Durée maximale des missions envoyées.
- Choix du pack d'assets.
- Récupération du corps : seulement les ressources perdues sur place, ou aussi une équipe de secours (reporté).
