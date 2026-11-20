# Castalrock — conception du palier 2 (contenu)

> Rédigé le 19/11/2026 après un test du prototype : le tour du jeu se faisait en 5 minutes.
> Validé par le concepteur : orientation générale, travail **en lots** testés un par un, fil rouge **menace des bandits** (un vrai lore viendra plus tard), chasse des **quatre animaux** avec **arc** et **pièges**, **bouclier** en main gauche, **vrai arbre de compétences**.
> Ce document complète le cahier des charges. Un choix qui n'y est pas se discute avant d'être codé.

## Le problème et la réponse

Le jeu manque d'un objectif à long terme. Les quêtes se ressemblent toutes (« rapporte 10 X ») et il n'y a rien à découvrir à part la mine. Ajouter des quêtes du même genre ne réglerait rien.

Réponse, pour une boucle de 3 à 5 heures :

1. Des **paliers de matériaux** qui débloquent de meilleurs outils, armes et armures.
2. Des **chaînes de quêtes** portées par 4 villageois, de types variés, reliées par la menace des bandits.
3. Un **arbre de compétences** avec des choix.
4. La **chasse**, la **cuisine** et le **bouclier**.
5. Plus tard, des **lieux à découvrir** avec des chefs.

## Lots

| Lot | Contenu | Besoin d'images |
|---|---|---|
| **2a** | Paliers de matériaux (cuivre, charbon, acier), outils et armures par palier, arbre de compétences, chaînes de quêtes (parties sans chasse ni lieux), bouclier et parade, sort Barrière (C) | Non (bouclier : les images aideront mais ne bloquent pas) |
| **2b** | Animaux (cerf, lapin, renard, sanglier), arc et flèches, pièges, cuisine, maison du joueur avec intérieur, suite des quêtes de chasse | Oui : animaux, arc, intérieur de maison |
| **2c** | Lieux : camp de bandits et leur chef, tanière et loup alpha, ruines, autel de cristal, 2e niveau de mine ; fin du fil rouge | Oui : lieux, chefs |

## Lot 2a

### Matériaux et paliers

- **Nouveaux filons** (repoussent comme le fer) :
  - **cuivre** : rochers de prairie, de forêt et de montagne, assez fréquent ;
  - **charbon** : montagne et mine.
- **Lingots** (forge) :
  - lingot de cuivre = 2 minerais de cuivre ;
  - lingot de fer = 2 minerais de fer + 1 charbon ;
  - lingot d'acier = 2 lingots de fer + 2 charbons, il faut le village niveau 2.
- **Paliers d'outils et d'armes** (épée, hache, pioche) :

  | Palier | Dégâts | Durabilité max | Recette |
  |---|---|---|---|
  | base | 1 | 100 | — |
  | cuivre | 1,3 | 150 | établi + lingots de cuivre |
  | fer | 1,6 | 200 | forge |
  | acier | 2 | 300 | forge, village niveau 2 |
  | cristal | 2,5 | 400 | plus tard, à l'autel de cristal (lot 2c) |

- **Verrous de récolte** (c'est ce qui donne envie de monter de palier) :
  - minerai de fer et charbon : pioche en cuivre au minimum ;
  - cristal bleu : pioche en fer au minimum ;
  - avec une pioche trop faible : message « Il faut une pioche en cuivre », aucun dégât.
- **Armures** (un seul emplacement, comme aujourd'hui) :

  | Armure | Réduction des dégâts | Recette | Source des ingrédients |
  |---|---|---|---|
  | fibres | 15 % | — | (existe déjà) |
  | cuir | 25 % | 6 cuirs + 4 fibres, établi | cuir : butin des bandits (puis des animaux au lot 2b) |
  | fourrure | 30 % | 4 fourrures de loup + 2 cuirs, établi | — |
  | mailles | 40 % | 6 lingots de fer, forge | — |
  | plaques | 55 % | 6 lingots d'acier, forge, village niveau 2 | — |

  Les armures restent invisibles sur le personnage (décision du cahier des charges) ; on les voit dans l'inventaire.
- **Sauvegarde** : migration. Un outil « fer » reste « fer » ; l'armure de fibres reste.

### Arbre de compétences

Un vrai arbre : des nœuds reliés par des traits, chaque nœud demande son parent. Un point par niveau, comme aujourd'hui ; certaines quêtes donnent un point en plus. Cinq branches au lot 2a, plus la Chasse au lot 2b.

- **Combat**
  - Lame affûtée : +15 % de dégâts à l'épée.
    - Enchaînement : frappes 15 % plus rapides.
      - Riposte : après une parade réussie, le coup suivant fait ×2.
    - Coup puissant : clic maintenu 1 s, puis un coup à ×2,5.
- **Défense**
  - Robustesse : +20 PV.
    - Parade : débloque le bouclier (clic droit maintenu avec l'épée).
      - Bouclier solide : la parade bloque 100 % de face.
    - Peau dure : +10 % de réduction d'armure.
      - Second souffle : une fois par jour de jeu, survit à 1 PV.
- **Récolte**
  - Bûcheron : +25 % de dégâts sur les arbres.
  - Mineur : +25 % de dégâts sur les rochers et les filons.
    - Abondance : 20 % de chance d'une ressource en plus (demande Bûcheron ou Mineur).
      - Pilote expert : le pilote automatique récolte à pleine vitesse.
  - Cueilleur : +1 baie ou plante par cueillette.
- **Artisanat**
  - Forgeron : réparations à moitié prix.
    - Économe : 25 % de chance de ne pas consommer un ingrédient de base.
    - Maître forgeron : +50 % de durabilité aux objets fabriqués.
  - Porteur : +4 cases d'inventaire.
    - Grand sac : +4 cases dans le sac magique.
- **Magie**
  - Boule de feu (A).
    - Soin (X).
      - Barrière (C) : bouclier magique qui absorbe 30 dégâts pendant 8 s.
        - Réserve : +30 mana.
    - Boule de feu II : explosion plus large.
- **Chasse** (lot 2b)
  - Tir à l'arc.
    - Tir chargé.
    - Pisteur : animaux sur la mini-carte.
  - Pièges.
    - Dépeceur : plus de butin sur les animaux.

Les compétences actuelles (combat, récolte, craft, résistance, transport, magie) sont remplacées. À la migration, **tous les points dépensés sont rendus**, avec le message : « L'arbre de compétences a changé : vos points vous ont été rendus ».

### Bouclier et parade

- **Fabrication** : bouclier en bois (établi : bois et fibres), puis bouclier renforcé (forge : bois et lingots de fer, il réduit plus). Il faut le nœud **Parade**.
- **En main** : avec l'épée en main droite et un bouclier possédé, le bouclier est visible au bras gauche en 1re personne. Pendant un sort, la main gauche lâche le bouclier, puis le reprend.
- **Clic droit maintenu** : lever le bouclier.
  - Les dégâts reçus de face sont réduits de 70 % (100 % avec Bouclier solide).
  - On avance 40 % moins vite et on ne peut pas frapper.
  - Lever le bouclier juste avant le coup annoncé d'un gobelin ou d'un bandit (fenêtre de 0,3 s) donne une **parade réussie** : un petit étourdissement de l'ennemi, et la Riposte si on l'a prise.
- **Clic droit** : il plante encore les pousses quand la case 4 est choisie.

### Barre d'outils

| Case | Contenu |
|---|---|
| 1 | Épée (+ bouclier au bras gauche si possédé) |
| 2 | Hache |
| 3 | Pioche |
| 4 | **Objets posables** : pousse d'arbre, et plus tard piège. Rappuyer sur 4 passe de l'un à l'autre. |
| 5 | Torche |
| 6 | Arc (lot 2b) |

### Quêtes : quatre chaînes et le fil rouge

**Fonctionnement** :
- Chaque villageois a sa chaîne de quêtes, qui se fait dans l'ordre.
- Les quatre chaînes avancent en parallèle.
- Le panneau montre la quête disponible de chaque chaîne.
- Certaines quêtes demandent un niveau de village, ou une quête d'une autre chaîne.

**Nouveaux types d'objectif** :
- lancer un sort N fois ;
- atteindre un lieu (lot 2c) ;
- tuer un chef (lot 2c).

**Nouvelles récompenses** :
- un point de compétence ;
- le déblocage d'une amélioration du village.

**Gaspard, le chef du village — « La menace des bandits »** (fil rouge) :
1. Nuisibles : tuer 3 slimes (quête existante).
2. Des pierres pour le puits : rapporter 10 pierres (existante).
3. Des traces suspectes : tuer 3 gobelins (existante).
4. Voyageurs détroussés : tuer 2 bandits.
5. Renforcer le village : rapporter 30 bois et 20 pierres. Débloque l'amélioration au niveau 2.
6. Le guetteur : rapporter 4 lingots de fer. Débloque l'amélioration au niveau 3.
7. Les pillards s'organisent : tuer 5 bandits. Récompense : 1 point de compétence, et l'indice du camp (suite au lot 2c).

**Le forgeron — « De la pierre à l'acier »** :
1. Le premier lingot : fondre un lingot de cuivre (quête existante, adaptée).
2. Outils de cuivre : fabriquer la pioche en cuivre.
3. Du charbon pour la forge : rapporter 10 charbons.
4. Le vrai forgeron : fabriquer la pioche en fer (existante, adaptée).
5. Une armure digne de ce nom : fabriquer la cotte de mailles.
6. Le secret de l'acier : fabriquer 3 lingots d'acier. Il faut le village niveau 2.
7. Une lame d'exception : fabriquer l'épée en acier. Récompense : 1 point de compétence.

**Marthe, l'aubergiste — « Une auberge accueillante »** :
1. Du bois pour l'hiver : rapporter 15 bois (quête existante).
2. Des baies pour la tarte : rapporter 10 baies.
3. Fourrures pour l'hiver : rapporter 4 fourrures de loup.
4. Un kit pour les voyageurs : fabriquer 2 kits de feu de camp.
5. Du gibier : rapporter 5 viandes crues (lot 2b).
6. Le ragoût de Marthe : cuisiner 3 viandes (lot 2b).
7. Le cuir du tanneur : rapporter 6 cuirs (lot 2b).

**Mathilde, l'herboriste et ermite — « Les anciens savoirs »** :
1. Remèdes de grand-mère : rapporter 5 plantes médicinales (quête existante).
2. Replanter la forêt : planter 3 pousses (existante, passe à Mathilde).
3. Potions pour le village : fabriquer 3 potions de soin.
4. La pierre bleue : rapporter 5 cristaux bleus.
5. Apprenti mage : lancer 10 sorts.
6. Gelée alchimique : rapporter 10 gelées de slime.
7. La barrière : apprendre le sort Barrière. Récompense : 1 point de compétence (suite : l'autel de cristal au lot 2c).

**Les deux quêtes existantes qui ne collent plus** : « Gobelins » devient la n° 3 de Gaspard, « Le vrai forgeron » devient la n° 4 du forgeron. La sauvegarde garde les quêtes déjà terminées sous leur identifiant.

## Lot 2b (après les images)

- **Animaux** :
  - **cerf** : fuit dès qu'on approche à 15 m, il faut l'arc ou de la discrétion ;
  - **lapin** : petit, fuit vite ; arc ou piège ;
  - **renard** : rare, fuit, laisse de la fourrure ;
  - **sanglier** : neutre ; si on l'attaque, il charge fort, d'où l'intérêt du bouclier.
  - **Butin** : viande crue, cuir, fourrure (renard).
- **Arc** (case 6) :
  - clic maintenu pour tendre, relâcher pour tirer ;
  - les flèches sont fabriquées (bois, pierre, fibres) et consommées ;
  - il faut le nœud Tir à l'arc.
- **Pièges** :
  - fabriqués à l'établi, posés avec la case 4 ;
  - après quelques minutes de jeu, chance d'attraper un lapin ou un renard qui passe ;
  - on vient relever le piège avec E.
- **Cuisine** :
  - au feu de camp et à la cheminée de la maison, E puis « Cuisiner » ;
  - la viande cuite soigne plus que la crue et donne un petit bonus de régénération ;
  - le ragoût vient plus tard.
- **Maison du joueur** :
  - une maison du village devient la sienne ;
  - on entre par la porte : zone intérieure séparée, comme la mine ;
  - dedans : un lit (se reposer, point de réapparition), un coffre personnel, une cheminée (cuisine) ;
  - la décoration viendra plus tard.

## Lot 2c (après les images)

- **Lieux** :
  - camp de bandits, avec palissade et chef des bandits ;
  - tanière de loups, avec le loup alpha ;
  - ruines ;
  - autel de cristal : on y fabrique les outils en cristal ;
  - 2e niveau de mine.
- **Mini-carte** : chaque lieu apparaît sur la mini-carte une fois découvert.
- **Fin du fil rouge** : trouver le camp, puis battre le chef des bandits.
- **Plus tard** : un lore plus riche, voulu par le concepteur.

## Ce qui reste ouvert

- Les villageois sont-ils visibles en personne, chacun devant sa maison, au lieu d'un seul panneau ? Proposé pour le lot 2b, en même temps que leurs images.
- Le marchand ambulant : à quoi sert l'or ? À trancher avant le lot 2b.
- L'élevage (vache, mouton, cochon, poule) : après le lot 2c.
