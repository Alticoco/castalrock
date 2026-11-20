# Castalrock — finir l'histoire (étape 60)

> Décidé avec le concepteur le 20/11/2026 au soir. But : pouvoir **finir l'histoire une fois**, puis faire tester le jeu à des gens (bêta). On n'agrandit pas plus : pas de pêche, pas de feu animé, pas de nouveaux lieux.

## 1. Bandits qu'on trouve sans chercher des heures (60a)

- Bandits errants un peu plus nombreux : peu de jour, nettement plus la nuit (prairie 3 → 5 %, forêt 3 → 6 % des points, ×2,5 la nuit), dès 90 m du village au lieu de 120.
- **Embuscades** : seulement quand une quête acceptée ou l'étape d'histoire demande de tuer des bandits. Après 2 à 4 minutes de jeu passées hors du village en prairie ou en forêt (plus vite la nuit), 2 ou 3 bandits surgissent à 30-45 m, sur les côtés ou derrière. Un groupe à la fois.
- Gaspard dit où ils rôdent.

## 2. XP plus généreuse et remise à zéro des compétences (60b)

- Constat : acte II fini, toutes les quêtes des villageois faites, niveau 8 seulement, pour un arbre de 28 nœuds.
- Courbe 80 × n^1,25 (au lieu de 150 × n^1,4) ; récolte, fabrication et ennemis rapportent plus ; étapes d'histoire × 1,5. Visé : niveau 11 environ à la fin de l'acte II, 15-16 à la fin de l'histoire (un peu plus de la moitié de l'arbre ; le reste en jeu libre).
- Les parties existantes sont converties (même XP totale, nouveau niveau, points en plus).
- Bouton « Réinitialiser » dans l'écran des compétences (K), gratuit, avec confirmation.

## 3. Le village attaqué pendant ton absence (60c, 60d)

**Moment** : juste après la première rencontre avec Aldric (acte III, « Trouve Aldric l'ermite »), le voyage le plus lointain jusque-là. Pendant que tu es chez lui, les bandits frappent le village.

**Ce que tu trouves en rentrant** (pas de feu, pas de combat imposé) :
- les deux **maisons au toit de chaume** (`maison-2`, `maison-3`) sont à moitié détruites ; les villageois ont **déjà commencé à reconstruire** (échafaudage, planches) ;
- les maisons au toit de tuiles (niveau 3), en pierre, ont tenu ; **l'auberge** a servi de refuge et reste intacte (on peut toujours s'y reposer et y réapparaître) ;
- **ta maison, le coffre, la forge et l'établi sont intacts** : tu ne perds rien et tu peux toujours fabriquer ;
- les villageois sont désemparés : chacun a une réplique propre à ce moment ; ceux dont la maison est détruite dorment à l'auberge.

**Nouvelles étapes d'histoire**, insérées après « Trouve Aldric » :

| Acte | Objectif affiché | Condition |
|---|---|---|
| III | Rentre au village : de la fumée monte au-dessus des toits | s'approcher à moins de 30 m du centre du village |
| III | Parle à Gaspard | parler à Gaspard (il raconte l'attaque) |
| III | Aide le village à se relever | la dernière quête de reconstruction est rendue |

Puis l'histoire reprend : « Rapporte 5 cristaux bleus de la mine à Aldric », puis l'acte IV (plan de Gaspard, camp, Morvan, ruines).

**Quêtes de reconstruction** (nouvelle chaîne « Relever le village », données et rendues en personne, une à la fois, disponibles à partir de l'étape « Parle à Gaspard » ci-dessus) :
1. **Gaspard — « Des murs avant l'hiver »** : 25 bois, 15 pierres. La maison de Mathilde (`maison-2`) est rebâtie.
2. **Marthe — « Le ventre des bâtisseurs »** : 5 viandes cuites (ceux qui reconstruisent doivent manger).
3. **Hugo — « Un toit pour le chasseur »** : 20 bois, 12 fibres, 10 pierres. Sa maison (`maison-3`) est rebâtie.

Chaque quête rapporte de l'XP et un peu d'or. L'état « maison détruite » se déduit de l'histoire et des quêtes (une maison est endommagée si l'étape « Rentre au village » est atteinte et que sa quête n'est pas rendue) : rien de plus à sauvegarder pour les maisons.

Les attaques du soir restent comme aujourd'hui.

## 4. Indices pour trouver les lieux (60d)

La boussole ne guide plus vers les quêtes : ce sont les habitants qui disent où aller, avec la direction et la distance réelles (calculées d'après la graine : `src/regles/indices.ts`). Unité choisie par défaut : **les pas** (à confirmer par le concepteur). Objectif et réplique concernés : Aldric (Mathilde), la mine (Bertil, ou Aldric quand il demande les cristaux), le camp (Gaspard), les ruines de Castalrock (Gaspard puis Aldric).

## 5. Le potager (60e)

- Une seule quête, de Mathilde : « Ton potager est à l'abandon : prends ce seau, remplis-le au puits et arrose-le. » Elle donne un **seau**.
- Ensuite, libre à toi : un potager arrosé donne, le lendemain (jour de jeu suivant), quelques baies et plantes médicinales à cueillir. Pas arrosé, il ne pousse pas, **sans jamais mourir** : aucune contrainte.
- Seau : E au puits le remplit (« Seau d'eau »), E au potager de ta maison l'arrose et le vide.

## 6. Le butin du camp des bandits (60g, demande du concepteur du 20/11)

- Le camp contient le fruit de leurs pillages : **3 coffres de butin** près des tentes et des caisses (plan du camp : `src/regles/lieux.ts`).
- Chacun s'ouvre une seule fois (même système que les petits coffres des ruines : `src/regles/tresors.ts`, liste `tresorsOuverts` déjà sauvegardée, aucun changement de format).
- Contenu tiré de la graine, plus riche qu'un coffre de ruine : 25 à 45 pièces d'or, des ressources volées au village (bois, pierre, fer, charbon, cuir, viande cuite) et parfois des lingots ou une potion. Le plus gros, sous la tente de Morvan, a toujours des lingots de fer.
- On peut les ouvrir dès qu'on atteint le camp, même avant l'acte IV : les gardes sont là pour les défendre.

## 7. Un village plus vivant (60h)

- Quelques **poules** qui picorent autour des maisons et du potager ; **3 moutons** dans un **enclos** à partir du niveau 2 du village. Pur décor : on ne les attaque pas, ils ne donnent rien.
- **Cabane d'Aldric** près de son feu, dans la forêt, loin du camp.

## Pour plus tard (pas dans cette version)

Pêche (écartée par le concepteur), feu et fumée sur les maisons, combat imposé au retour.
