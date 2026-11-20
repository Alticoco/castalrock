# Castalrock — cahier des charges

> Nom provisoire : **Castalrock** (il changera plus tard).
> Rédigé le 19/11/2026 à partir du questionnaire « Jeu d'exploration en 3D low poly » rempli par le concepteur.
> Remplace l'ancien document 2D, gardé dans `docs/archives/GAME_DESIGN-2D.md`.
> Ce document est la référence. Une idée qui n'y est pas se discute avant d'être codée.

## 1. Le concept

Un jeu solo **en 3D low poly**, détendu, dans un monde médiéval fantasy (magie et épée). Le joueur est un simple villageois. Il explore un monde vallonné généré autour d'un village fixe, casse des arbres et des rochers pour récolter, combat au clic, fabrique, et fait grandir son village, ses compétences et plus tard ses compagnons.

Ce que le concepteur recherche : **l'immersion** de la 3D, un monde **qui n'est jamais plat ni monotone**, la sensation de **découvrir** un environnement.

## 2. Ce que doit ressentir le joueur (inchangé depuis la version 2D)

- Détente : on joue 20 minutes ou 2 heures, on quitte à tout moment sans rien perdre.
- Un peu de tension (perdre ce qu'on transporte), jamais de frustration ni de morts répétées qui punissent.
- Satisfaction de voir le village, le personnage et les possibilités grandir.
- Moments « pilote automatique » où l'on farme sans réfléchir.
- Grind accepté mais jamais trop lent : une amélioration de base demande au plus une soirée.
- Aucun PVP, rien de compétitif.

## 3. Piliers (à ne jamais sacrifier)

1. **Explorer** un monde en relief pour **récolter** des ressources.
2. **Crafter** et **améliorer le village**.
3. **Progresser** (XP, compétences, quêtes) avec un équilibrage détendu.

## 4. Décisions prises

### Vue et caméra
- **Deux vues**, on passe de l'une à l'autre avec la touche **V** :
  1. **1re personne** (vue principale, la partie démarre dedans) : on voit les bras et l'outil en main. Avantage retenu : le personnage complet n'a pas besoin d'être beau ni très animé.
  2. **3e personne** : caméra derrière le personnage (ses graphismes seront améliorés plus tard).
- En 3e personne, un arbre ou un rocher qui cache le personnage **devient transparent**.
- Historique : trois vues testées dans le prototype (1re, 3e, diagonale). Le 19/11/2026, après test, le concepteur retient la 1re personne et **abandonne la vue diagonale** (peu utilisée, rendu jugé insatisfaisant). La molette sert à changer d'outil.
- Le personnage n'est **pas personnalisable** dans la démo.

### Style graphique
- **Low poly** à faces plates, couleurs franches, brouillard en distance, ombres. Pas de photoréalisme.
- Décors, bâtiments, arbres, rochers : **modèles faits en code** (pas de modèles externes).
- Personnages et monstres : **modèle simple fait en code** pour le prototype ; ensuite **pack gratuit déjà animé** (licence CC0 vérifiée, notée dans `public/modeles/SOURCES.md`) si un pack convient, après accord du concepteur pour le téléchargement.
- **Images concept** : Claude écrit des prompts (`docs/prompts-images.md`), le concepteur génère les images avec ChatGPT et les range dans `docs/concepts/`, Claude modélise en s'en inspirant.
- Équipement visible sur le personnage : l'outil ou l'arme en main, le bouclier, et, **depuis le 19/11/2026 (décision du concepteur)**, l'armure portée (sur le corps et en manches en 1re personne) et un **casque** (4 casques, nouvel emplacement). L'inventaire garde pour l'instant une silhouette simple du personnage.

### Monde et relief
- Relief marqué et varié : **collines, falaises qu'on contourne, rivières et lacs, montagnes qu'on gravit, grottes et mine**. Jamais de grande plaine plate et vide.
- Monde **généré à partir d'une graine** (bruit procédural), découpé en morceaux (« chunks ») chargés autour du joueur, avec **plusieurs biomes**. Méthode reprise d'un projet précédent du concepteur.
- **Un point central fixe : le village**, sur un terrain aplani, toujours au même endroit (origine du monde).
- V1 : **la zone autour du village + 2 ou 3 biomes extérieurs** (prairie, forêt, montagne rocheuse ; marais possible) **+ une grotte ou mine**.
- Les grottes et la mine sont des **zones intérieures séparées** : on entre par une ouverture dans une falaise et le jeu charge l'intérieur (un terrain par hauteur ne sait pas faire de vrais tunnels).
- **Cycle jour/nuit simple dès le prototype** (soleil qui tourne, couleurs du ciel, nuit lisible). La météo vient après la V1.

### Récolte et monde cassable
- Les **objets** se cassent : l'arbre tombe et laisse des bûches et une souche, le rocher éclate en morceaux, le filon s'épuise.
- **Pas de terrain qu'on creuse** ni de constructions destructibles en V1.
- Récolte : **clic maintenu** (ou un clic qui lance l'animation et continue tant qu'on ne bouge pas). Chaque coup retire des points à l'objet.
- Repousse :
  - **Pierre et minerai** : réapparaissent après un délai, et toujours disponibles dans la grotte ou la mine.
  - **Arbres** : on récupère des **pousses** en coupant, on les **replante**, elles grandissent en quelques minutes de jeu (pas en temps réel).
  - Plantes et baies : repoussent seules.
  - Si on coupe tout trop vite, la zone peut se vider : c'est voulu.
- Ressources V1 (au moins 6, faciles à étendre car décrites dans un fichier de données) : **bois, pierre, minerai de fer, plantes médicinales, baies, fibres**. D'autres (cuivre, argile, cristal) seront ajoutées si tout va bien.

### Combat
- **Combat manuel au clic** (on frappe soi-même, même si ça ressemble à du clic répété). Il remplace le combat automatique de la version 2D.
- Le **pilote automatique** reste : le personnage récolte ou combat seul dans une zone, 10 % moins vite.
- Sorts : **boule de feu et soin, à débloquer** par la progression (pas disponibles au départ).

### Systèmes repris de la version 2D (validés le 19/11/2026)
- Ambiance détendue, aucun PVP.
- Mort douce : on perd les ressources portées depuis la base (récupérables là où on est mort), l'équipement s'use sans se casser, réparation contre ressources, réapparition à la dernière auberge ou au dernier feu de camp. Le **sac magique** ne perd jamais son contenu et s'agrandit avec le niveau ou l'argent.
- Auberges fixes et feu de camp posable contre du bois.
- Craft : 6 à 8 recettes (outils, arme, armure légère, soin, établi).
- **Village visible, qui s'agrandit et s'améliore** sur 2 ou 3 niveaux en V1, un habitant (forgeron).
- XP gagnée à l'usage, un point de compétence par niveau ; compétences : combat, récolte, craft, résistance, capacité de transport, magie.
- 5 à 8 quêtes de villageois.
- Ennemis V1 : slime, gobelin, loup, bandit. Pas de zombies.
- Sauvegarde locale à tout moment (Échap puis quitter).
- Missions de compagnons en temps réel : **gardées, après la V1**.

### Technique (choix de Claude, le concepteur n'a pas à s'en occuper)
- **Navigateur**, TypeScript, **Three.js** sans surcouche React (un jeu d'action a besoin d'une boucle de jeu simple et directe), **Vite**, tests **Vitest**.
- **Pas de moteur physique** en V1 : le sol est donné par la fonction de hauteur du terrain, les obstacles sont des cercles. Plus simple, plus rapide, testable.
- Machine cible : **PC fixe avec carte graphique dédiée récente** (développé et testé sur un PC haut de gamme). Un PC portable n'est pas une contrainte, mais les options graphiques (distance de vue, ombres) restent réglables.
- Sauvegarde dans le navigateur.
- Méthode : règles du jeu en TypeScript pur et testées, un commit par étape, modèles en code.

## 5. Contenu

### Prototype de ressenti (palier 0)
Un morceau de monde avec relief et biomes, le village aplani au centre, un personnage qui se déplace, saute et monte les pentes, les trois vues, des arbres et rochers à casser, un compteur de ressources, le cycle jour/nuit. **Le concepteur le teste et choisit la vue.**

### V1 (palier 1)
Inventaire et sac magique, sauvegarde, repousse et replantation, village avec coffre et établi, craft, ennemis et combat au clic, mort douce, XP et sorts à débloquer, quêtes, grotte ou mine, auberge et feu de camp, pilote automatique, pack de personnages animés.

### Après la V1
- Missions de compagnons, compagnons de combat, bûcheron, guilde de marchands.
- **Construction libre façon Valheim** (idée du concepteur du 19/11/2026).
- Caméra qui tourne, météo, plus de biomes, de ressources et de monstres, quêtes du seigneur et boss.
- Voyage rapide, application PC installable.
- Sons : **avancés le 19/11/2026** à la demande du concepteur : bruitages discrets (outils avec variations, pas, combat), cris des animaux et des monstres **spatialisés** (on entend d'où ils viennent), musique de taverne **seulement à l'auberge** pour commencer. Voix des villageois : **écartée** (ni voix de synthèse ni babillage pour l'instant).

## 6. Questions encore ouvertes

- Pack de personnages animés : lequel, et accord du concepteur pour le télécharger.
- Durée maximale des missions de compagnons.
- Récupération du corps après la mort : seulement les ressources sur place, ou aussi une équipe de secours.
