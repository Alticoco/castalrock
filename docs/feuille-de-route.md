# Castalrock — feuille de route

État : `[ ]` à faire · `[~]` fait, à tester par le concepteur · `[x]` validé par le concepteur.

**Difficulté** : mécanique (aucun choix à faire) · standard (bien défini) · délicate (3D fine, ressenti, logique complexe).
**Modèle** : le plus économe capable de faire l'étape.
- **Haiku** : seulement lire, chercher, trier, résumer (rien d'écrit qui reste).
- **Sonnet** : le minimum dès qu'il faut écrire du code ou du texte bien défini.
- **Opus** : conception, logique complexe, relecture finale.
- **Fable** : choisi par le concepteur le 19/11/2026 pour la 3D qui se voit (personnage, caméras, modèles d'après les images concept, combat, grotte). Jamais pour une étape mécanique ou standard.

**Type** : auto (faisable sans le concepteur) · à valider (le concepteur doit tester ou décider).

## Palier 0 — prototype de ressenti

| N° | Étape | Difficulté | Dépend de | Modèle | Type | État |
|---|---|---|---|---|---|---|
| 0 | Préparation : projet Vite + TypeScript + Three.js + Vitest, dossiers, lancement, git | mécanique | — | Sonnet (agent developpeur) | auto | [~] |
| 0b | Prompts d'images concept pour ChatGPT (`docs/prompts-images.md`) | standard | — | Sonnet (agent redacteur-doc) | auto | [~] |
| 1 | Monde : bruit à graine, relief (collines, falaises, montagnes, rivières, lacs), biomes, village aplani, chunks, eau, brouillard | délicate | 0 | Opus (agent developpeur) | auto | [~] |
| 2 | Personnage et caméras : déplacement ZQSD sur le relief, saut, pente maximale, modèle en code et animations, bras en 1re personne, 3 vues (touche V), transparence des obstacles | délicate | 1 | **Fable** (agent developpeur) | auto | [~] |
| 3 | Décor par biome : arbres, rochers, filons, plantes, baies (instanciés), collisions ; modèles d'après les images concept | délicate | 1, 2 | **Fable** (agent developpeur) | auto | [~] |
| 4 | Récolte : viser, clic maintenu, coups, arbre qui tombe, rocher qui éclate, ressources ramassées, compteur | standard | 3 | Sonnet (agent developpeur) | auto | [~] |
| 5 | Cycle jour/nuit simple, ciel, ombres | standard | 1 | Sonnet (agent developpeur) | auto | [~] |
| 6 | Écran d'aide des touches, compteur d'images par seconde | mécanique | 2 | Sonnet (agent developpeur) | auto | [~] |
| 7 | Relecture du prototype | — | 1 à 6 | Opus (agent relecteur) | auto | [ ] |
| 8 | **Test par le concepteur : choisir la vue**, juger le relief et la récolte (19/11 : 1re personne retenue pour l'instant ; la 3e personne sera embellie plus tard) | — | 7 | Concepteur | à valider | [x] |

## Palier 1 — V1

| N° | Étape | Difficulté | Dépend de | Modèle | Type | État |
|---|---|---|---|---|---|---|
| 10 | Données des ressources et inventaire + sac magique (règles pures, testées) | standard | 8 | Sonnet | auto | [~] |
| 11 | Menu Échap, sauvegarde et chargement (monde par graine + modifications) | standard | 10 | Sonnet | auto | [~] |
| 12 | Repousse : pierre et minerai, pousses d'arbre à replanter qui grandissent | standard | 10 | Sonnet | auto | [~] |
| 13 | Prompts et images concept du village (le concepteur génère les images) | — | 0b | Concepteur | à valider | [x] |
| 14 | Village fixe : maisons, coffre, établi, forgeron (modèles en code) | délicate | 13 | **Fable** | auto | [~] |
| 15 | Craft (6 à 8 recettes), outils en main qui changent | standard | 10, 14 | Sonnet | auto | [~] |
| 16 | Premier ennemi (loup), combat au clic, vie du joueur | délicate | 8 | **Fable** | auto | [~] |
| 17 | Mort douce : perte des ressources, durabilité, réparation, réapparition | standard | 11, 16 | Sonnet | auto | [~] |
| 18 | XP, niveaux, points de compétence, sorts à débloquer (boule de feu, soin) | standard | 16 | Sonnet (effets visuels des sorts : Opus) | auto | [~] |
| 19 | Quêtes des villageois, améliorations du village (2 ou 3 niveaux) | standard | 14, 15 | Sonnet | auto | [~] |
| 20 | Grotte ou mine : zone intérieure séparée, entrée dans une falaise | délicate | 12 | **Fable** | auto | [~] |
| 21 | Auberge, feu de camp, pilote automatique | standard | 17 | Sonnet | auto | [~] |
| 22 | Ennemis restants : loup, bandit (modèles d'après les images) | standard | 16 | **Fable** (modèles) | auto | [~] |
| 23 | ~~Choix et intégration d'un pack de personnages animés~~ — **mis de côté le 19/11** (plan de fin) | délicate | 8 | — | — | — |
| 24 | Équilibrage, options graphiques, relecture de la V1 (options graphiques faites le 19/11) | délicate | 10 à 23 | Opus | auto | [ ] |
| 25 | Commandes demandées par le concepteur : Tab inventaire, barre d'outils 1-4 et molette, sorts sur A/X/C, sensibilité de la souris | standard | 10 | Sonnet | auto | [~] |
| 26 | Grand passage de modélisation d'après toutes les images (outils et bras en 1re personne, décor, village, mine, pousse en main) | délicate | 13 | **Fable** | auto | [~] |
| 27 | Découpage de `main.ts` en modules (`src/jeu/`) | mécanique | — | Sonnet (refactoreur) | auto | [~] |

## Palier 2 — contenu (voir `docs/conception-palier2.md`)

| N° | Étape | Difficulté | Dépend de | Modèle | Type | État |
|---|---|---|---|---|---|---|
| 28 | Torche (case 5, lumière préparée d'avance), fourrure du loup | standard | 25 | **Fable** (modèle en main) | auto | [~] |
| 29 | Mini-carte (M), à gauche, taille réglable | standard | — | Sonnet | auto | [~] |
| 30 | **Lot 2a** — matériaux et paliers : cuivre, charbon, acier, outils et armures par palier, verrous de récolte | standard | 15 | Sonnet (règles), filons en code | auto | [~] |
| 31 | **Lot 2a** — arbre de compétences (vrai arbre, migration des points) | délicate | 30 | Sonnet (règles) + écran | auto | [~] |
| 32 | **Lot 2a** — quêtes en 4 chaînes, fil rouge des bandits, nouveaux objectifs et récompenses | standard | 30, 31 | Sonnet | auto | [~] |
| 33 | **Lot 2a** — bouclier et parade, sort Barrière (C) | délicate | 31 | **Fable** | auto | [~] |
| 34 | Test du lot 2a par le concepteur | — | 30 à 33 | Concepteur | à valider | [ ] |
| 35 | **Lot 2b** — animaux, arc et flèches, pièges, cuisine, maison du joueur (fait le 19/11 : maison, animaux, arc, pièges, cuisine, formes d'armes par palier) | délicate | 34 | **Fable** (modèles) + Sonnet (règles) | à valider | [~] |
| 36 | **Lot 2c** — lieux, chefs, fin du fil rouge : **remplacé par l'étape 45 réduite** (voir « Plan de fin ») | délicate | 35 | — | — | — |

## Histoire et vie du jeu (voir `docs/conception-histoire.md`)

| N° | Étape | Difficulté | Dépend de | Modèle | Type | État |
|---|---|---|---|---|---|---|
| 40 | Habitants visibles et routines | délicate | — | **Fable** | auto | [~] |
| 41 | Dialogues, quêtes en personne, repères ! et ? | standard | 40 | Sonnet | auto | [~] |
| 42 | Chaîne principale : prologue, actes, objectif affiché (voir `docs/conception-chaine-principale.md` ; acte IV provisoire jusqu'à l'étape 45) | standard | 41 | Sonnet | à valider (histoire) | [~] |
| 43 | Marchand ambulant et usage de l'or (fait le 19/11 : règles, écran ; modèle d'après l'image fait le 19/11 au soir) | standard | 40 | Fable (modèle) + Sonnet | auto | [~] |
| 44 | Attaques de bandits sur le village (F7 pour tester) | standard | 40 | Sonnet | auto | [~] |
| 45 | Lieux et chefs, **réduit** : camp des bandits, Morvan le Balafré, autel du Cœur (remplace l'acte IV provisoire) | délicate | 42 | **Fable** + Sonnet | auto | [~] |
| 46 | ~~Pierres de légende, coffres cachés, quêtes du jour, lune bleue~~ — **mis de côté le 19/11** (plan de fin) | standard | 45 | — | — | — |

## Plan de fin (décidé par le concepteur le 19/11/2026)

Castalrock sert à jauger ce que Claude sait faire : on le **finit proprement** sans l'agrandir (histoire jouable jusqu'au bout, petites animations). **Ligne d'arrivée : l'histoire se joue du prologue à l'épilogue en environ 3 h.** Toute nouvelle idée va dans « Mis de côté », sauf accord du concepteur.

| Session | N° | Contenu | Modèle | État |
|---|---|---|---|---|
| 1 | 50 | Test et fusion de la branche `autonome/2026-11-19-histoire` (**palier en bois, textes de Gaspard et outils en bois faits le 19/11 au soir ; reste le test et la fusion par le concepteur**) ; palier de départ « en bois » (noms, textes du prologue : Gaspard prête les outils) ; la belle épée de départ passe à un palier plus haut (fer ou acier, à comparer à l'image) | Concepteur, puis Sonnet | [ ] |
| 1b | 55 | **Ne plus rester coincé** (bug signalé par le concepteur : trous et crevasses sans sortie) : **bouton et escalade faits le 19/11 (à tester)** ; (1) bouton « Je suis coincé » dans le menu Échap, qui ramène **au bord d'où l'on est tombé** (dernier point sûr noté avant la chute, reculé d'un ou deux mètres), sans perte et sans renvoyer au village ; au village seulement s'il n'y a aucun point sûr ; (2) **escalade lente** : face à une paroi trop raide, Espace maintenu fait grimper doucement ; l'outil en main est rangé pendant l'escalade et les deux mains vides montent l'une après l'autre (1re personne), l'outil revient en haut. Corriger le relief lui-même : écarté (trop coûteux, à prévoir dans un prochain jeu) | Sonnet (bouton) + **Fable** (mains qui grimpent) | [~] |
| 2 | 51 | Remodelage des épées, haches et pioches d'après « Cinq épées, du bois au cristal » et « Haches et pioches » (l'épée en cuivre ne doit plus ressembler à un gourdin) ; modèle du marchand d'après son image | **Fable** | [~] |
| 3 | 45 | Étape 45 réduite : camp des bandits, Morvan le Balafré (vrai combat de chef), autel où l'on reforge le Cœur ; l'acte IV provisoire est remplacé | **Fable** + Sonnet | [~] |
| 3b | 54 | **Monde moins répétitif** (demande du concepteur) : ruines semées dans tout le monde, de temps en temps et jamais pareilles (muret cassé, colonne, arche, tour effondrée, maison sans toit, ancien avant-poste), assemblées à partir de pièces avec morceaux manquants, rotation et taille tirées à la graine ; petites grottes peu profondes au pied des falaises (entrée dans la roche, quelques mètres, cristaux ou petit coffre) ; quelques ruines avec un petit coffre pour que l'exploration rapporte. Les vraies grottes explorables (réseau de galeries) restent de côté | **Fable** (pièces) + Sonnet (placement par chunk, collisions) | [~] |
| 4 | 52 | Fin de la relecture (habitants, animaux, parade, cuisine, interface) ; partie complète accélérée pour vérifier l'histoire de bout en bout | Opus (relecteur) + Sonnet | [ ] |
| 5 | 53 | Partie de test du concepteur, puis retouches finales (petites animations, équilibrage) | selon les retours | [ ] |
| 4b | 56 | **Refonte de l'interface** (`docs/refonte-interface.md`, maquette validée le 19/11) : thème « Ardoise et laiton », bas et haut de l'écran, boussole sans guidage vers les quêtes, repères personnels sur une carte ronde, inventaire en glisser-déposer, compétences en étoile. **Reste : textes d'indices (attendent le concepteur)** | Opus (conception, relecture) + Sonnet | [~] |

### Session autonome de la nuit du 19 au 20/11 : graphismes et équipement (étape 57)

Demande du concepteur (19/11, nuit) : **améliorer les graphismes sans faire baisser la fluidité**. Le cahier des charges est modifié en conséquence : armures visibles et casques ajoutés. Le choix de l'équipement est laissé à Claude ; tout se fait **d'après les images de référence** de `docs/concepts/`. Proposition détaillée : « Castalrock : apparence du personnage (étape 57) » (recommandations de Claude retenues). **Personnage 3D dans l'inventaire : abandonné pour l'instant** (décision du concepteur du 19/11, nuit) : la silhouette simple reste, on verra plus tard si ça vaut le coup.

Règles de la nuit : branche `autonome/2026-11-20-graphismes`, un commit par étape, `npm test` et `npm run build` verts à chaque commit, **pas de fusion dans `main`, pas de push**. Fluidité : chaque étape 3D compare images par seconde, appels de dessin et triangles avant / après sur une scène fixe ; un outil reste en un seul objet fusionné par matériau. Fable seulement pour la 3D qui se voit. Un choix non tranché : la solution la plus simple à défaire, et la question dans le journal.

| Ordre | N° | Étape | Difficulté | Dépend de | Modèle | État |
|---|---|---|---|---|---|---|
| 1 | 57a | Page d'essai `essai/` (personnage de face, profil, dos ; outils des 5 paliers ; armures et casques) et mesure de référence de la fluidité | mécanique | — | Opus (session principale, petite étape) | [~] |
| 2 (en parallèle de 3) | 57b | **Casques, règles** : 4 casques (bonnet de cuir, chapka de fourrure, camail de mailles, heaume d'acier), recettes, −4 / −6 / −8 / −10 %, plafond total 75 %, pas d'usure, sauvegarde v22, emplacement « Casque » en glisser-déposer, icônes | standard | 57a | Sonnet (developpeur) | [~] |
| 3 | 57c | **Cheveux et tête** : une seule masse à facettes sans trou, d'après « Référence low poly d'un villageois », plus de polygones sur la tête | délicate | 57a | **Fable** | [~] |
| 4 | 57d | **Armures visibles** (3e personne) : fibres (inventée), cuir, fourrure, mailles (motif d'anneaux dessiné en code), plaques, bottes assorties ; d'après « Quatre armures fantasy » | délicate | 57c | **Fable** | [~] |
| 5 | 57e | **Manches d'armure en 1re personne** (gants gris, gantelets acier) | délicate | 57d | **Fable** | [~] |
| 6 | 57f | **Casques sur la tête** d'après « Coiffes et bottes » (cheveux cachés, frange sous le bonnet) | délicate | 57b, 57e | **Fable** | [~] |
| 7 (en parallèle de 3 à 6) | 57g | **Épées, haches, pioches plus détaillées**, 5 paliers, d'après « Cinq épées » et « Haches et pioches » (sans changer la prise en main) ; arc, bouclier et torche s'ils jurent à côté | délicate | 57a | **Fable** | [~] |
| 8 | 57j | **Barre d'outils** : l'arc passe en case 4, les pousses d'arbre (et le piège) en case 6 (demande du concepteur) | standard | 57b | Sonnet (developpeur) | [~] |
| 9 | 57k | **Arc aligné en 1re personne** : quand on vise, l'arc et la flèche pointent droit vers le centre de l'écran (« midi »), plus de flèche qui semble partir vers « 10 h » | délicate | 57f | **Fable** | [~] |
| 10 | 57i | Vérification dans le navigateur (port 5177, sauvegarde à part) et de la fluidité, relecture, corrections, journal | — | 57g, 57j, 57k | Opus (relecteur) | [~] |

**Suite du 20/11** (demandes du concepteur après les premiers essais) :

| Ordre | N° | Étape | Difficulté | Modèle | État |
|---|---|---|---|---|---|
| 1 (en parallèle) | 57l | **Cotte de mailles retravaillée** (rendu jugé peu réussi) : anneaux bien plus petits et plus fins, aspect métal plus soigné, sur le corps, les manches en 1re personne et le camail | délicate | **Fable** | [~] |
| 1 (en parallèle) | 58 | **Icônes refaites**, plus soignées : barre d'outils 1 à 6, outils **par palier** (l'épée en bois doit avoir l'air en bois, pas en fer), puis les autres objets de l'inventaire dans le même style | délicate | Opus (developpeur) | [~] |
| 1 (en parallèle) | 59 | **Écrans restants au style « Ardoise et laiton »** : menu pause, journal des quêtes, fabrication, marchand, dialogues, aide, écran de chute | standard | Sonnet (developpeur) | [~] |
| 2 | 57m | Vérification, relecture Opus, journal | — | Opus | [ ] |

**Si du temps reste** (même règles, graphismes seulement, rien de nouveau dans les règles du jeu), dans cet ordre :
1. Bandits et Morvan habillés avec les nouvelles pièces d'armure (cuir, plaques sombres) — Fable.
2. Coiffures des villageois refaites comme celle du héros (même défaut de blocs) — Fable.
3. Reste déjà prévu au journal : pièces de ruines, petite grotte et outils en bois d'après les images, mains d'escalade, modèle et icône de l'Éclat du Cœur — Fable.
4. Relecture Opus de ces ajouts, journal.

**Mis de côté** (pas pour cette version) : tanière et loup alpha, ruines à fouiller avec des fragments de légende (les ruines de décor, elles, sont faites en 3b), grottes explorables en réseau, mine de lave, étape 46 (pierres de légende, coffres cachés, quêtes du jour, lune bleue), étape 23 (pack de personnages animés), récolte à mains nues, palier « pierre », factions, monstres évolués et chefs gobelins, élevage, et tout « Après la V1 ».

## Étape 60 — finir l'histoire (décidé par le concepteur le 20/11 au soir, voir `docs/conception-fin-histoire.md`)

But : pouvoir finir l'histoire une fois, puis bêta (dépôt GitHub et page hébergée). Branche `etape/60-finir-histoire`.

| Ordre | N° | Étape | Difficulté | Modèle | État |
|---|---|---|---|---|---|
| 0 | 60 | Carquois posé sur l'armure (mesuré, suit la cape) | délicate (petit) | Opus (session principale) | [~] |
| 1 (en parallèle) | 60a | Bandits plus fréquents la nuit, embuscades quand une quête en demande, indice de Gaspard | standard | Sonnet (developpeur) | [~] |
| 1 (en parallèle) | 60b | XP remaniée (courbe, gains, conversion des parties), bouton de remise à zéro des compétences | standard | Sonnet (developpeur) | [~] |
| 1 (en parallèle) | 60c | Maison de chaume endommagée, reconstruction commencée (modèle statique, sans feu) | délicate | **Fable** (developpeur) | [~] |
| 2 | 60d | Village attaqué pendant l'absence : étapes d'histoire, chaîne « Relever le village », maisons endommagées branchées, répliques, indices de direction | standard | Sonnet (developpeur), conception Opus | [~] |
| 3 | 60e | Quête du potager, seau au puits, potager arrosé qui donne | standard | Sonnet (developpeur) | [~] |
| 4 | 60f | Partie accélérée de bout en bout, relecture, journal | — | Opus (relecteur) + Sonnet (testeur) | [~] |
| 5 | 60g | Coffres de butin au camp des bandits (demande du concepteur) | standard | Sonnet | [~] |
| 5 | 60h | Poules, moutons et enclos au village ; cabane d'Aldric, Aldric loin du camp ; Morvan absent avant l'acte IV ; horloge près de la mini-carte | standard | Fable (modèles) + Sonnet + Opus | [~] |

Écarté le 20/11 : la pêche. Laissé tel quel (« passable », décision du concepteur) : cristaux décoratifs des grottes, coiffure du héros. Armure de fibres (aspect jugé trop moderne, proche d'un gilet tactique) : à retoucher seulement s'il reste du temps.

## Étape 61 — clôture (décidé par le concepteur le 20/11, nuit)

Après le second audit : on finit proprement, sans agrandir. Branche `etape/61-cloture`. Steam écarté ; page GitHub plus tard.

| N° | Étape | Modèle | État |
|---|---|---|---|
| 61a | Ménage git (branches fusionnées, copies de travail) et nettoyage du code (code mort, doublons, commentaires) | Sonnet (refactoreur) | [~] |
| 61b | Souris : un clic à côté ferme l'écran ou le dialogue et reprend la vue ; aide du coin retirée | Sonnet (developpeur) | [~] |
| 61c | Menu « Parties » : 3 emplacements (charger, nouvelle partie, recommencer, effacer) | Sonnet (developpeur) | [~] |
| 61d | Outils en cristal à la forge dès l'acte III | Sonnet (developpeur) | [~] |
| 61e | Livre de fin (la reconstruction du château y est racontée) | Sonnet (composant) + session principale (textes, branchement) | [~] |
| 61f | README, touches de test en développement seulement, chemins relatifs | Sonnet (redacteur-doc) + session principale | [~] |
| 61g | Relecture | Opus (relecteur) | [~] |
| 62 | Publication : anonymisation, documents nettoyés, licence, nouvel historique, page GitHub | Session principale + Sonnet (redacteur-doc) + Opus (relecteur) | [~] |

Les étapes restées `[ ]` plus haut (7, 24, 34, 50, 52, 53, 57m) ont été couvertes par les relectures et les parties de test faites depuis : plus rien à faire dessus. Reste possible, hors projet : retrait des anciennes versions de sauvegarde (le dépôt et la page GitHub sont faits à l'étape 62).

## Après la V1 (pas de numéro tant que la V1 n'est pas finie)

Missions de compagnons, construction façon Valheim, caméra qui tourne, météo, nouveaux biomes et ressources, boss.

Sons : avancés le 19/11/2026 (branche `etape/sons`, Opus) : bruitages des outils, pas, combat, cris des créatures spatialisés, musique à l'auberge, volumes dans le menu pause. Reste possible plus tard : arc, sorts, coffres, interface, ambiance (vent, oiseaux, rivière), plus de musiques.

## Règles de parallélisme

Deux agents ne tournent en même temps que si leurs étapes sont indépendantes **et** ne touchent pas les mêmes fichiers (exemples : 0 et 0b ; 5 et 6 ; 12 et 16). Sinon, les étapes passent l'une après l'autre.
