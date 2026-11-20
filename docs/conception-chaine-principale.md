# Castalrock — chaîne principale (étape 42)

> Conception du 19/11/2026, à partir de `docs/conception-histoire.md` (validée par le concepteur).
> Mise à jour de l'étape 45 (réduite) : le camp des bandits, Morvan le Balafré et le lieu de la reforge existent (d'abord un petit « autel du Cœur », remplacé le 19/11 par les **ruines de la forteresse de Castalrock**) ; ils ont remplacé les deux étapes **(provisoire)** de l'acte IV. Restent à venir : le loup alpha et sa tanière, les ruines, la mine de lave.

## Principe

- Une suite d'**étapes d'histoire**, une seule active à la fois.
- L'objectif de l'étape est **toujours affiché sous la boussole** : « Acte I — Forge un outil en cuivre (0/1) ».
- Une étape finie donne un peu d'XP et d'or, puis ajoute un paragraphe au **journal de l'histoire** (J, onglet « Histoire »).
- Quand l'objectif est « parler à quelqu'un », cette personne dit une réplique d'histoire au lieu de sa salutation, et porte un repère doré au-dessus de la tête.
- Les chaînes de Gaspard, du forgeron, de Marthe et de Mathilde restent des quêtes **secondaires**.

## Les étapes

| Acte | Objectif affiché | Condition |
|---|---|---|
| Prologue | Parle à Gaspard, sur la place | parler à Gaspard |
| Prologue | Coupe 3 arbres | 3 arbres abattus |
| Prologue | Passe la nuit au feu de camp ou à l'auberge | se reposer |
| Prologue | Entre dans ta nouvelle maison, près du potager | entrer dans la maison |
| I | Fais connaissance avec Marthe, Mathilde et Bertil | parler aux trois (dans n'importe quel ordre) |
| I | Forge un outil en cuivre | meilleur palier d'outil ≥ cuivre |
| I | Débarrasse le village de 5 slimes | 5 slimes tués |
| I | Fais passer le village au niveau 2 | niveau du village ≥ 2 |
| I | Va saluer Hugo, le chasseur qui s'installe | parler à Hugo |
| II | Repousse 3 bandits sur les routes | 3 bandits tués |
| II | Chasse 2 bêtes sauvages avec les conseils de Hugo | 2 animaux tués |
| II | Forge un outil en acier | meilleur palier d'outil ≥ acier |
| III | Demande à Mathilde ce qu'elle sait de Castalrock | parler à Mathilde |
| III | Trouve Aldric l'ermite, {direction} du village, à environ {distance} pas | parler à Aldric (indice des habitants : direction et distance réelles) |
| III | Rentre au village : de la fumée monte au-dessus des toits | s'approcher à moins de 30 m du centre du village (état) |
| III | Parle à Gaspard | parler à Gaspard (il raconte l'attaque ; la chaîne de quêtes « Relever le village » devient disponible) |
| III | Aide le village à se relever | la quête « Un toit pour le chasseur » est rendue (état) |
| III | Rapporte 5 cristaux bleus de la mine à Aldric | avoir 5 cristaux bleus, puis parler à Aldric (ils sont pris) |
| IV | Écoute le plan de Gaspard | parler à Gaspard |
| IV | Trouve le camp du Balafré, dans la forêt | s'approcher du camp à moins de 45 m (la boussole le montre) |
| IV | Bats Morvan le Balafré | Morvan vaincu (la boussole montre le camp) |
| IV | Reforge le Cœur dans les ruines de Castalrock | touche E face au cristal, au centre de la cour, avec l'Éclat du Cœur, 10 cristaux bleus et 5 lingots d'acier (ils sont pris ; la boussole montre les ruines) |
| Épilogue | Fais prospérer le village (niveau 3) | niveau du village ≥ 3 |

Après l'épilogue : « Le Cœur de Castal bat de nouveau. La vallée est à toi. » et plus d'objectif d'histoire.

## Le village attaqué (étape 60) et les indices de direction

- Après la rencontre d'Aldric, les bandits ont attaqué le village. `maison-2` et `maison-3` (toits de chaume) sont endommagées tant que leur quête n'est pas rendue (`src/regles/reconstruction.ts`, rien de sauvegardé). Leurs habitants dorment à l'auberge.
- Chaîne de quêtes « Relever le village », en personne : Gaspard « Des murs avant l'hiver » (25 bois, 15 pierres), Marthe « Le ventre des bâtisseurs » (5 viandes cuites), Hugo « Un toit pour le chasseur » (20 bois, 12 fibres, 10 pierres). XP 150 / 120 / 180, or 15 / 10 / 20.
- Sauvegarde v24 : les numéros d'étape après « Trouve Aldric » sont décalés de 3, les trois quêtes sont marquées rendues pour une partie déjà plus loin.
- **Aldric** (graine du jeu) : feu en (-122, -262), au nord-ouest du village (290 m), à plus de 500 m du camp, loin des ruines. Une place de cabane est réservée à 3,5 m de son feu (`CONFIG.habitants.aldric.cabane`).
- Indices : les textes contiennent `{direction:aldric|mine|camp|ruines}` et `{distance:...}`, remplis dans `src/jeu/indices.ts` (en pas, depuis le centre du village).

## Acte IV : le camp, Morvan, les ruines de Castalrock (étape 45)

- **Positions** : tirées de la graine par `src/regles/lieux.ts`. Le camp est en forêt, à 250-400 m du village ; la forteresse en montagne, sur un grand replat atteignable à pied (disque aplani de 37 m de rayon, raccord de 27 m). Le terrain est aplani autour, comme pour le village. Graine du jeu : camp à environ 370 m au sud (après le campement d'Aldric), forteresse à environ 435 m au sud-est, vers 32 m d'altitude (un plateau à mi-pente, pas un sommet : les sommets ne sont pas atteignables à pied).
- **Camp des bandits** : palissade de pieux ouverte vers le village, 3 tentes, feu central, caisses, tour de guet. 4 bandits le gardent tant que Morvan est en vie (un garde tué est remplacé après 10 minutes de jeu).
- **Morvan le Balafré** (`src/regles/chef.ts`) : 400 points de vie (5 bandits), barre de vie en haut de l'écran à moins de 32 m.
  - *Coup lourd* : la hache levée pendant 0,8 s, puis 36 de dégâts. Reculer l'esquive ; le bouclier levé de face en retire 70 % (tout avec « Bouclier solide ») ; levé au dernier moment, Morvan est étourdi.
  - *Charge* : toutes les 9 s environ, quand le joueur est à 5,5-15 m. Élan de 0,6 s, puis course en ligne droite (24 de dégâts, une fois) : un pas de côté l'évite.
  - *Appel* : une fois, sous la moitié de sa vie, 2 bandits arrivent par la porte.
  - Si le joueur tombe, Morvan récupère toute sa vie et les renforts s'en vont.
  - Vaincu, il lâche l'**Éclat du Cœur** et 60 à 90 pièces d'or, et ne réapparaît plus (sauvegardé).
- **Ruines de Castalrock** (identifiant interne `autel`, gardé pour la sauvegarde ; plan : `src/monde/forteresse.ts`, modèle : `src/scene/modelesLieux.ts`) : les restes de la forteresse, une enceinte à six côtés de 60 m (près de 70 m avec les tours).
  - Remparts de grosses pierres, cassés, avec des créneaux là où ils sont intacts ; mousse et lierre.
  - Trois tours : une encore haute (17 m) au fond à gauche, une moyenne à droite de la porte, une souche ouverte à gauche. Un gros pilier aux trois autres angles.
  - Une porte en arche, du côté du village : c'est l'entrée (F8 y mène). Une brèche à droite et le fond effondré laissent aussi passer.
  - Cour dallée cassée, herbe et mousse ; allée de six colonnes brisées (une couchée) ; pignon de la grande salle percé d'une fenêtre ; deux escaliers qui ne mènent plus nulle part ; gros blocs tombés.
  - Collisions en cercles (murs, tours, colonnes, escaliers, gros blocs). Ni décor, ni ennemi ordinaire, ni petite ruine, ni grotte dans l'emprise.
  - Toutes les pierres sont fondues en une seule géométrie (environ 1 600 blocs, une commande de dessin).
- **Le Cœur de Castal**, au centre de la cour : un cristal géant à facettes de 7 m (pas un cœur : c'était le cœur de la forteresse), dans un berceau de pierre à huit pans gravé de losanges, tenu par quatre bras de pierre dont deux sont cassés.
  - Avant la reforge : bleu sombre, terne, fendu, posé de travers, avec une encoche à l'épaule (le morceau manquant est l'Éclat du Cœur).
  - Touche E face au cristal (jusqu'à quelques mètres du berceau) : l'éclat reprend sa place, le cristal s'élève dans un rayon de lumière.
  - Après : entier, lumineux, il pulse doucement, flotte au-dessus du berceau, et six petits éclats tournent autour. Cet état est gardé.
  - Uniquement de l'émissif et de la couleur additive : aucune lumière ajoutée à la scène.
- **Carte et boussole** : la boussole montre le camp, puis les « Ruines de Castalrock », pendant leurs étapes ; la mini-carte garde les lieux découverts.
- **F8** (outil de test) : téléporte devant le prochain lieu de l'histoire, le camp tant que Morvan est en vie, la porte des ruines de Castalrock ensuite.
- Les trois étapes sont des étapes « état » : un joueur qui a trouvé le camp ou battu Morvan avant d'y être envoyé ne refait rien.

## Règles techniques

- `src/regles/histoire.ts` : pur, testé. État sauvegardé `{ etape, compteur, vus }` (sauvegarde v17 ; une ancienne partie commence au prologue, les étapes déjà remplies par l'état du jeu passent toutes seules).
- Sauvegarde v20 : `lieux = { campDecouvert, autelDecouvert, morvanVaincu, coeurReforge }`. Migration depuis la v19 : une partie arrêtée sur l'une des deux étapes provisoires reprend à « Trouve le camp du Balafré » ; une partie déjà à l'épilogue garde son acquis (Morvan vaincu, Cœur reforgé).
- Les conditions « état » (palier, niveau du village, lieu découvert, chef vaincu, Cœur reforgé) se vérifient à chaque contrôle ; les conditions « événement » (parler, tuer, abattre, se reposer, entrer) avancent sur événement.
- Une étape remplie par l'état passe sans attendre : une partie avancée traverse l'histoire jusqu'à la première étape à faire.
