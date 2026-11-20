# Castalrock — refonte de l'interface (ATH)

Document préparé le 19/11/2026. Rien n'est encore codé. Il contient :

1. le brief : ce qui change, ce qui reste, les points encore ouverts ;
2. les prompts d'images (ChatGPT) pour choisir une direction artistique ;
3. le prompt pour une maquette HTML avec Claude Design ;
4. le prompt à donner à la session de développement.

Ordre suivi : on passe directement à la maquette HTML ; les images ChatGPT (partie 2) restent en option, par exemple pour les icônes.

**Maquette Claude Design** (4 écrans, style et police à basculer dans Tweaks) : lien privé non reproduit ici.

### Décisions du concepteur (19/11, après la première version)

- **La maquette ne fixe que la mise en page et le style.** Le fond de la carte reste le vrai terrain dessiné par le jeu (relief, biomes, rivières, lieux), pas le dessin simplifié de la maquette. Les icônes de la maquette (repères, objets, sorts) sont provisoires : les vraies seront choisies ensuite, avec la même logique (pastille ronde, une couleur par type).

- Plus de liste des ressources à l'écran : on la voit en ouvrant l'inventaire. On garde le fil « +2 Bois » à chaque récolte (il existe déjà).
- Noms de ressources avec une majuscule (« Bois », « Minerai de fer »).
- Panneau de quêtes en haut à droite, compact et structuré : quête principale puis quêtes du village, semi-transparent mais avec du caractère. La boussole seule au centre en haut.
- Inventaire : **glisser-déposer manuel** des objets pour ranger soi-même, au lieu des clics qui rangent automatiquement.
- **Carte ronde au centre de l'écran, décor du jeu flouté derrière**, pas de panneau de quêtes en mode carte, petit bloc d'en-tête en haut à gauche (nom de la région, aide sur l'inexploré) à garder seulement s'il apporte une information. Anneau de boussole, encoche N, zoom + / − et molette, repères en pastilles à icône par type (Filon, Cueillette, Danger, Trésor, Lieu à revoir), petit menu discret à droite. Zones inexplorées assombries (proposition de Claude, à confirmer).
- **Plus aucun guidage vers les quêtes** (changement de règles, pas seulement d'interface) : on apprend des PNJ où aller (« les bandits se sont établis au sud-est ») et on explore. La boussole ne montre que les repères du joueur et le village. Aujourd'hui elle pointe vers la mine et affiche l'objectif de l'histoire : à retirer. Pour ne pas perdre le joueur : indices précis dans les dialogues, indice recopié dans le journal des quêtes, lieux visibles de loin (fumée, tour).
- **Barre d'outils centrée**, plus de cases de sorts à côté : les trois sorts sont de petites icônes sans cadre au-dessus de la barre, entre la vie et la mana. Allumées si prêtes, éteintes sinon ; en recharge, l'icône se colorie de bas en haut puis brille quand elle est prête.
- **Fil des récoltes** : essai à droite sous le panneau de quêtes ; repli possible sur le « +2 » près du centre de l'écran, comme aujourd'hui dans le jeu (avis de Claude : garder celui du centre).
- **Inventaire : le personnage tient l'objet en main** (celui de la case choisie dans la barre d'outils), dans la main droite, d'une seule main, le long du corps, avec un léger balancement de repos (pas de pose figée). Simple : silhouette + icône dans la main. Option plus coûteuse à trancher au développement : personnage 3D qui tourne, avec le vrai modèle de l'arme.
- **Gain d'XP visible** : le gain s'ajoute en clair et lumineux au bout de la partie déjà acquise, et « +24 XP · 108 / 200 » s'affiche quelques secondes sous la barre.
- **Compétences en étoile** : étoile au centre (niveau), 6 branches qui rayonnent, plus on s'éloigne plus c'est avancé. Toutes les branches vont du même cercle intérieur au même cercle extérieur. Zoom à la molette et aux boutons, déplacement en glissant. Bloc « points de compétence » en haut à droite (gros chiffre doré, progression vers le prochain point), compétences disponibles qui « respirent » tant qu'il reste un point.
- **Style retenu : « Ardoise et laiton »** (panneaux sombres transparents, filet doré, accent bleu cristal), avec les **coins arrondis** ajoutés par le concepteur dans la maquette (25 à 30 px sur les panneaux, boutons ronds).
- **Police : Cinzel** pour les titres, Alegreya Sans pour le texte (choix par défaut de la maquette, validé avec elle ; le concepteur peut encore changer).
- **Maquette validée le 19/11** : on passe au développement.

---

## 1. Brief

### Le problème

L'interface actuelle paraît datée : cases beiges sur cadre de bois, petits textes (« bois ») posés sur les icônes, blocs gris semi-transparents sans hiérarchie, police système. Elle reprend le parchemin et le bois de l'image `Inventaire médiéval au sac magique bleu.png` : **c'est cette direction qu'on quitte.**

### La direction visée

- Médiéval fantasy élégant, en accord avec le monde low poly : formes simples, aplats, angles coupés en biseau (comme les facettes du décor).
- Panneaux **transparents** mais nets : fond sombre fumé, filet fin doré, un peu de flou derrière si possible.
- Une couleur d'accent : le **bleu cristal** (Cœur de Castal, sac magique).
- Mots-clés colorés dans les textes : ressources en ambre, ennemis en rouge, lieux en bleu, personnages en vert.
- Interdit : science-fiction, néon, hologramme, clignotements, textures réalistes, dessins détaillés.
- Tout doit être homogène : même forme de panneau, même filet, même police partout.

### Élément par élément

| Élément | Aujourd'hui | Demandé |
|---|---|---|
| Mini-carte (haut gauche) | Cercle | Garder le cercle minimaliste. **Ajouter une grosse encoche « N » sur le bord**, qui tourne avec la carte quand la carte tournante est activée. |
| Carte agrandie (M) | Fixe | Molette pour zoomer / dézoomer. Clic pour poser un **repère personnel**, clic sur un repère pour le suivre ou le retirer. |
| Boussole vers l'objectif (haut centre) | Flèche vers le baluchon ou la mine | Garder le principe, refaire le style. La cible n'est plus imposée : **le joueur choisit** (quête principale, retour au village, un de ses repères). |
| Heure (haut droite) | Discrète | Ne pas changer, sauf le style pour coller au reste. |
| Suivi des quêtes (droite) | Petit bloc gris | **Grand panneau à droite** façon jeux Ubisoft : titre de quête bien visible, objectifs avec progression (barre ou « 1/3 »), mots-clés colorés. Transparent mais élégant. |
| Ressources (haut droite) | Liste permanente | **Déplacer en bas à droite** et refaire (voir point ouvert n° 1). |
| Barre d'outils + vie/mana/XP (bas centre) | Bois et cases beiges | À refaire entièrement : cases sombres en biseau, matériau indiqué par une petite pastille de couleur au lieu du mot « bois », usure en fine barre dans la case, nom affiché seulement pour l'outil choisi. |
| Sorts A / X / C | Cases grises | Même style que la barre d'outils. |
| Écran d'inventaire (I) | Simpliste | À refaire entièrement. |
| Écran des compétences (K) | Simple | À refaire entièrement (arbre ou constellation de nœuds ronds). |

### Points ouverts (à trancher par le concepteur avant la maquette)

1. **Ressources en bas à droite : liste permanente ou fil des récoltes ?** Avis de Claude : la liste permanente ne tiendra pas quand il y aura vingt ressources. Mieux : un fil qui affiche « +2 bois » quelques secondes à chaque récolte, plus les ressources utiles à la quête suivie ; la liste complète reste dans l'inventaire.
2. **Panneau de quêtes : combien de quêtes affichées en grand ?** Avis de Claude : une seule quête suivie en grand (titre + objectifs détaillés), les autres repliées sur une ligne chacune. Sinon le panneau mange la vue dans un jeu d'exploration.
3. **Repères personnels : combien, et de quelles sortes ?** Proposition : 8 au maximum, 4 couleurs au choix, effaçables, gardés dans la sauvegarde. « Retour au village » toujours disponible, sans repère à poser.
4. **Police d'écriture** : une police à empattements pour les titres (style gravure, ex. Cinzel) et une police simple pour le reste. Les fichiers seraient copiés dans le projet (licence libre OFL), pas chargés depuis Internet.
5. **Icônes** : garder les dessins actuels restylés, ou faire des icônes à partir des modèles 3D du jeu (plus homogène, plus de travail).

---

## 2. Prompts d'images (ChatGPT)

### Mode d'emploi

1. Commence par **2.1** : trois directions sur le même écran. Choisis-en une.
2. Pour les prompts suivants, **joins l'image choisie** et garde la première phrase : « Même style d'interface que l'image jointe. »
3. Enregistre chaque image dans `docs/concepts/` avec le nom indiqué.
4. Les générateurs écrivent mal les petits textes : ce n'est pas grave, on regarde les formes, les couleurs et la disposition. Si le texte gâche tout, relance avec « textes courts et bien lisibles ».

### Bloc de style commun (déjà inclus dans chaque prompt)

```
Capture d'écran d'un jeu vidéo à la première personne. Le monde est en 3D low poly : faces plates, facettes visibles, couleurs franches et douces, prairie verte ensoleillée, quelques arbres et rochers, ambiance médiévale fantasy chaleureuse. L'interface (ATH) est posée par-dessus. Interface élégante et sobre : formes simples, aplats, panneaux transparents, lisible sur un fond clair. Pas de science-fiction, pas de néon, pas d'hologramme, pas de lueurs fortes, pas de textures réalistes, pas de pixel art, pas de bois ni de parchemin. Textes en français, courts.
```

### 2.1 Écran de jeu complet, trois directions

Lance les trois prompts séparément. Même disposition, seul le style change.

Disposition commune (incluse dans les trois prompts) : mini-carte ronde en haut à gauche ; indicateur de cap en haut au centre ; heure en haut à droite ; grand panneau de quêtes à droite ; barre d'outils, vie, mana et expérience en bas au centre ; fil des récoltes en bas à droite.

**A — « Ardoise et laiton »** (direction recommandée) — fichier `ath-direction-ardoise.png`

```
Capture d'écran d'un jeu vidéo à la première personne. Le monde est en 3D low poly : faces plates, facettes visibles, couleurs franches et douces, prairie verte ensoleillée, quelques arbres et rochers, ambiance médiévale fantasy chaleureuse. L'interface (ATH) est posée par-dessus. Interface élégante et sobre : formes simples, aplats, panneaux transparents, lisible sur un fond clair. Pas de science-fiction, pas de néon, pas d'hologramme, pas de lueurs fortes, pas de textures réalistes, pas de pixel art, pas de bois ni de parchemin. Textes en français, courts.

Style de l'interface : panneaux en ardoise sombre fumée semi-transparente, coins coupés en biseau, filet doré très fin sur les bords, une seule couleur d'accent bleu cristal. Titres en petites capitales à empattements, élégantes.

Disposition :
- En haut à gauche : mini-carte ronde, simple, avec un cadre fin doré et une encoche bien visible marquée « N » sur le bord du cercle.
- En haut au centre : une petite capsule avec une flèche et « Village — 120 m ».
- En haut à droite : l'heure « 12:01 » avec un petit soleil, discrète.
- À droite, sous l'heure : un grand panneau de quêtes. En haut, la quête suivie en grand : titre « Des baies pour la tarte », puis l'objectif « Cueillir des baies » avec une fine barre de progression et « 6/10 ». Le mot « baies » est en ambre. En dessous, deux quêtes repliées sur une ligne : « Nuisibles  0/3 slimes » (le mot « slimes » en rouge) et « Le premier lingot  0/1 ».
- En bas au centre : une barre de six cases d'outils carrées à coins biseautés (épée, hache, pioche, pousses, torche, arc), la case choisie entourée de bleu cristal, une fine barre d'usure en bas de chaque case. Au-dessus de la barre : la vie (rouge doux), la mana (bleu) et une très fine barre d'expérience dorée. À droite de la barre, trois cases de sorts plus petites (feu, soin, bouclier) avec les lettres A, X, C.
- En bas à droite : un fil de récolte discret avec deux lignes qui s'effacent : « +2 bois » et « +1 minerai de fer ».
```

**B — « Noyer et cuir »** (plus proche de l'actuel, en plus raffiné) — fichier `ath-direction-noyer.png`

```
[Même premier paragraphe que A.]

Style de l'interface : panneaux en brun noyer très sombre semi-transparent, bordures fines en cuir cousu, coins arrondis, petits rivets dorés aux angles, accent bleu cristal. Titres en petites capitales à empattements.

[Même disposition que A.]
```

**C — « Facettes de cristal »** (la plus originale, risque de faire trop moderne) — fichier `ath-direction-cristal.png`

```
[Même premier paragraphe que A.]

Style de l'interface : panneaux en forme de facettes, comme des gemmes taillées à plat, dégradés très doux de bleu nuit à bleu cristal, transparents, arêtes nettes. Aucune lueur, aucun effet technologique : cela doit rester médiéval, comme du verre taillé. Titres en petites capitales à empattements.

[Même disposition que A.]
```

Avant de coller B ou C, remplace les crochets par le texte de A.

### 2.2 Panneau de quêtes, gros plan — fichier `ath-quetes.png`

```
Même style d'interface que l'image jointe. Gros plan sur le panneau de suivi des quêtes, à droite de l'écran, sur un fond de prairie low poly légèrement flou.

Le panneau est transparent et élégant. En haut, une petite étiquette « QUÊTE PRINCIPALE » en bleu cristal, puis un titre en grand. En dessous, la quête suivie : titre « Des baies pour la tarte », nom du villageois en vert en petit, objectif « Cueillir des baies » avec une fine barre de progression à 6 sur 10 et le nombre « 6/10 ». Le mot « baies » est en ambre. Puis deux quêtes repliées, une ligne chacune : « Nuisibles », « 0/3 slimes » avec « slimes » en rouge ; « Le premier lingot », « 0/1 ». Une petite coche dorée pour un objectif terminé. Hiérarchie claire : le titre suivi est bien plus gros que le reste. Pas de science-fiction, pas de bois, pas de parchemin.
```

### 2.3 Barre d'outils, vie et mana, gros plan — fichier `ath-barre-outils.png`

```
Même style d'interface que l'image jointe. Gros plan sur le bas de l'écran, au centre, sur un fond de prairie low poly légèrement flou.

Une barre de six cases carrées à coins biseautés : épée, hache, pioche, pousses d'arbre avec un petit « ×2 », torche, arc. Icônes simples en aplats, style low poly. Chaque case a un petit chiffre de 1 à 6 dans un coin, une petite pastille de couleur dans l'autre coin pour le matériau (brun clair pour le bois), et une fine barre d'usure en bas. La case 2 (hache) est choisie : contour bleu cristal, légèrement plus grande, et son nom « Hache » écrit au-dessus de la barre. Au-dessus : une barre de vie rouge doux avec « 100 », une barre de mana bleue avec « 50 », une très fine barre d'expérience dorée avec « Niv. 2 ». À droite, trois cases de sorts plus petites avec les lettres A, X, C : flamme, croix de soin, demi-bouclier ; une est grisée car indisponible. Pas de science-fiction, pas de bois, pas de parchemin.
```

### 2.4 Mini-carte et cap, gros plan — fichier `ath-minicarte.png`

```
Même style d'interface que l'image jointe. Gros plan sur le coin en haut à gauche d'un écran de jeu low poly.

Une mini-carte ronde et minimaliste : terrain vu du dessus en aplats de couleurs (prairie, forêt, rivière), une flèche blanche au centre pour le joueur, quelques petites icônes simples (maison pour le village, pioche pour la mine, un repère en forme de goutte orange posé par le joueur). Cadre fin. Sur le bord du cercle, en haut, une encoche bien visible avec la lettre « N », plus grosse que le reste, qui dépasse légèrement du cercle. Pas de science-fiction, pas de bois, pas de parchemin.
```

### 2.5 Carte agrandie avec repères — fichier `ath-carte-reperes.png`

```
Même style d'interface que l'image jointe. Écran de carte en plein écran par-dessus le jeu assombri.

Grande carte vue du dessus en aplats low poly : collines, forêts, rivière, lac, montagnes, un village au centre, une entrée de mine. Quelques repères posés par le joueur : gouttes de couleur (orange, vert, violet) avec un petit nom (« Gros filon », « Camp »). Un repère est suivi : il est entouré de bleu cristal. Dans un coin, un petit panneau transparent avec la liste des repères et un bouton « Retour au village ». En bas, une ligne d'aide discrète : « Clic : poser un repère · Molette : zoom · Clic sur un repère : suivre ». À droite, une petite échelle de zoom verticale. Pas de science-fiction, pas de bois, pas de parchemin.
```

### 2.6 Écran d'inventaire — fichier `ath-inventaire.png`

```
Même style d'interface que l'image jointe. Écran d'inventaire en plein écran par-dessus le jeu assombri et flou.

À gauche : le personnage vu en pied, style low poly simple, avec autour de lui des emplacements d'équipement (tête, torse, jambes, pieds, arme, bouclier). Au centre : une grille de cases à coins biseautés, rangée par onglets en haut (« Tout », « Ressources », « Outils », « Nourriture »), avec des icônes low poly en aplats et de petits nombres. Un objet est survolé : une fiche à droite montre son icône en grand, son nom « Minerai de fer », une courte description et sa quantité. Une zone distincte pour le sac magique, avec une touche de bleu cristal. En bas, la barre d'outils rappelée. Transparent, élégant, aéré. Pas de science-fiction, pas de bois, pas de parchemin.
```

### 2.7 Écran des compétences — fichier `ath-competences.png`

```
Même style d'interface que l'image jointe. Écran des compétences en plein écran par-dessus le jeu assombri et flou.

Cinq branches qui partent du bas comme les racines d'un arbre stylisé, chacune avec sa couleur douce : « Récolte » (vert), « Combat » (rouge), « Magie » (bleu cristal), « Chasse » (ambre), « Survie » (brun clair). Les compétences sont des nœuds ronds reliés par des traits fins. Nœuds débloqués : pleins et colorés ; nœud disponible : contour doré ; nœuds verrouillés : grisés. Un nœud survolé ouvre une petite fiche : nom, effet en une phrase, coût « 1 point ». En haut à droite : « Points : 1 ». Formes simples, aucun clignotement, aucune lueur forte. Pas de science-fiction, pas de bois, pas de parchemin.
```

Remarque : le jeu a déjà un arbre de 5 branches et 24 nœuds ; les noms ci-dessus sont des exemples. Les vraies branches et compétences sont celles du jeu ; la session de développement les reprendra.

---

## 3. Prompt pour la maquette HTML (Claude Design)

À utiliser une fois la direction choisie. Joindre l'image choisie en 2.1, les gros plans retenus et les deux captures actuelles.

```
Je fais un jeu en 3D low poly médiéval fantasy dans le navigateur. Son interface (ATH) est en HTML et CSS par-dessus le canvas. Je veux une maquette HTML de la nouvelle interface, que je pourrai retoucher moi-même, et qui servira de modèle pour le code du jeu.

Pièces jointes : les captures de l'interface actuelle (à ne pas reproduire, elle paraît datée) et les images de la direction choisie.

Fais une page avec, sur une image de fond de prairie low poly (un dégradé vert suffit) :
1. L'écran de jeu complet : mini-carte ronde en haut à gauche avec une encoche « N » bien visible sur le bord ; capsule de cap en haut au centre (flèche, nom de la cible, distance) ; heure en haut à droite ; grand panneau de quêtes à droite (quête suivie en grand avec barre de progression, autres quêtes repliées sur une ligne) ; barre de six outils, vie, mana, XP et trois sorts A/X/C en bas au centre ; fil des récoltes en bas à droite.
2. L'écran d'inventaire.
3. L'écran des compétences.
4. La carte agrandie avec des repères posés par le joueur.

Contraintes :
- Style : [nom de la direction choisie], panneaux transparents, coins en biseau, filet fin, accent bleu cristal. Pas de science-fiction, pas de néon, pas de clignotement.
- Mots-clés colorés : ressources en ambre, ennemis en rouge, lieux en bleu, personnages en vert.
- Toutes les couleurs, tailles, rayons et ombres en variables CSS en haut du fichier, pour que je puisse changer le thème d'un coup.
- Lisible sur fond clair (prairie au soleil) comme sur fond sombre (nuit, mine).
- Écran de référence 1920×1080 ; l'interface doit rester lisible en 1280×720.
- Icônes en SVG simples en aplats, pas d'images externes.
- Textes en français.
```

---

## 4. Prompt pour la session de développement

À coller dans la session Castalrock qui codera la refonte, une fois la maquette validée.

```
Refonte de l'interface (ATH). Lis d'abord docs/refonte-interface.md (surtout « Décisions du concepteur », tout en haut) puis la maquette validée (lien privé non reproduit ici). Lis ses 4 écrans (maquette non publiée) avec l'outil Artifact (action read, paths project/Main.dc.html, project/Inventaire.dc.html, project/Carte.dc.html, project/Competences.dc.html) : c'est la référence pour les couleurs, tailles, rayons, ombres et animations (style Ardoise et laiton, police Cinzel). La maquette ne fixe que la mise en page et le style : le fond de carte reste le vrai terrain du jeu, les icônes sont provisoires.

Découpe le travail en lots, dans cet ordre, sur une branche etape/<n°>-interface partie de main, un commit par lot. Annonce d'abord qui fait quoi.

1. Thème commun (mécanique, Sonnet) : variables partagées (couleurs, filet doré, coins arrondis 25-30 px, ombres, polices) dans un seul module de src/ui/. Polices Cinzel et Alegreya Sans copiées dans le projet (licence OFL, source notée), pas de chargement depuis Internet.
2. Bas de l'écran (standard, Sonnet) : barre d'outils centrée (pastille de matériau, usure en fine barre, nom de l'outil choisi au-dessus) ; vie et mana de part et d'autre de trois petites icônes de sorts (allumées / éteintes / se colorient en recharge puis brillent) ; barre d'XP avec gain animé et « +24 XP · 108 / 200 » temporaire. Lecture seule de l'état du jeu, aucune règle dans src/ui/.
3. Haut de l'écran (standard, Sonnet) : boussole en bandeau au centre ; panneau de quêtes en haut à droite (quête principale puis quêtes du village, progression, mots-clés colorés) ; heure ; mini-carte agrandie avec grosse encoche N qui tourne avec la carte tournante ; fil des récoltes « +2 Bois » (noms avec majuscule) : garder l'affichage près du centre comme aujourd'hui, restylé ; la liste permanente des ressources disparaît de l'écran.
4. Fin du guidage vers les quêtes (délicat : Opus pour la conception, puis Sonnet) : la boussole ne montre plus la mine ni l'objectif de l'histoire, seulement les repères du joueur et le village. En échange, chaque lieu de quête doit être indiqué par un indice de direction dans les dialogues et recopié dans le journal des quêtes. Propose-moi la liste des indices avant de les écrire.
5. Carte agrandie et repères personnels (délicat : Opus pour la conception, Sonnet pour le code) : règles pures et testées dans src/regles/ (poser, retirer, 8 au plus, 5 types, sauvegarde compatible avec les anciennes parties) ; carte ronde au centre sur le décor flouté, anneau de boussole, zoom molette et boutons, petit menu des types à droite, clic sur un repère pour voir sa distance ou le retirer. Les zones inexplorées assombries ne sont pas encore validées : ne les fais pas, demande-moi.
6. Inventaire (Sonnet, règle pure testée dans src/regles/inventaire.ts) : glisser-déposer manuel (déplacer, échanger, empiler, vers le sac magique et la barre d'outils), onglets, fiche de l'objet survolé, personnage qui tient l'objet en main droite avec un léger balancement (version simple : silhouette + icône ; demande-moi avant de faire la version 3D).
7. Compétences en étoile (Sonnet) : étoile au centre, 6 branches qui rayonnent et finissent toutes sur le même cercle, zoom molette et boutons, déplacement en glissant, bloc « points de compétence » en haut à droite, compétences disponibles qui respirent.
8. Relecture (Opus, agent relecteur) sur l'ensemble, puis corrections.

Contraintes : architecture du CLAUDE.md (pas de règle dans src/ui/, pas d'import de three dans src/regles/, pas de Math.random dans src/regles/) ; npm test et npm run build passent à chaque commit ; vérifie chaque lot dans le navigateur (npm run dev, port 5175) ; pas de fusion dans main sans mon accord. À la fin, entrée en haut de docs/journal.md avec ce que je dois tester, en manipulations concrètes, et les questions restantes.
```
