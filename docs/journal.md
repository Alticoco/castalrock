# Castalrock — journal des sessions

(Entrée la plus récente en haut.)

## 2026-11-20 (nuit, fin) — Étape 62 : publication sur GitHub

Le jeu est publié dans un dépôt GitHub **public**, `Alticoco/castalrock`, et se joue en ligne sur https://alticoco.github.io/castalrock/ . Décisions du concepteur : publier, anonymiser, nouvel historique, licence qui protège contre la reprise commerciale.

Fait :
- **Anonymat** : aucun nom, e-mail, chemin personnel ni détail de vie dans les fichiers publiés ; « le concepteur » partout. Règle ajoutée dans `CLAUDE.md` pour les sessions suivantes.
- **Documents nettoyés** (agents redacteur-doc) : remarques d'humeur, langage familier, quotas d'utilisation, liens privés, matériel personnel et noms d'autres projets retirés ; vocabulaire homogénéisé. Décisions, chiffres et cases de la feuille de route inchangés.
- **Nouvel historique** : le dépôt public part d'un seul commit. L'ancien historique (190 commits, avec des données personnelles) reste en local dans la branche `archive/historique-prive`, jamais envoyée.
- **Non publiés** : `docs/concepts/` (images de référence générées par IA) et `docs/prompts-images.md`, gardés sur le disque et ignorés par git. Le code et les documents qui les citent restent tels quels.
- **Licence** : CC BY-NC-SA 4.0 au nom du pseudo Alticoco (`LICENSE`). Choisie plutôt que MIT parce que le concepteur veut être cité, interdire l'usage commercial et que les versions modifiées gardent la même licence. Creative Commons déconseille ses licences pour du code, mais elles restent valables. Sons CC0, polices OFL et Three.js MIT gardent leur licence (texte de Three.js dans `public/licences/`).
- **Publication automatique** : `.github/workflows/publier.yml` teste, construit et publie `dist/` sur GitHub Pages à chaque envoi de `main`.
- La sauvegarde reste dans le navigateur de chaque joueur (stockage du site) : un joueur arrivant par le lien commence une partie neuve, et la partie locale (port 5175) est séparée de la version en ligne.

### À tester
1. Ouvrir https://alticoco.github.io/castalrock/ : partie neuve, sons et polices présents, pas de touches de test (F6, F7, F8, T) dans l'aide.
2. Jouer quelques minutes, recharger la page : la partie reprend.

### Questions en attente
- Une **capture d'écran** du jeu pour le README (emplacement prévu en haut).

## 2026-11-20 (nuit) — Étape 61 : clôture (ménage, souris, parties, cristal, livre de fin)

Branche `etape/61-cloture`, **fusionnée dans `main` le 20/11** (accord du concepteur), puis supprimée. 966 tests, build OK. Décision du concepteur après le second audit : finir proprement, pas de Steam, une page GitHub plus tard. Fait par six agents Sonnet en parallèle (nettoyage, emplacements, souris, cristal, livre, README), branchements par la session principale, relecture Opus.

Fait :
- **Ménage git** : les 23 branches déjà fusionnées et les copies de travail des agents sont supprimées. Restent `main` et cette branche. Deux dossiers vides de copies de travail (sous `.claude/worktrees/`) sont tenus par un autre programme : à supprimer à la main après un redémarrage.
- **Nettoyage du code** : 4 fonctions et 3 types jamais utilisés retirés, le drapeau « bientôt » des compétences aussi ; le détour des ennemis et la liste des cibles (arc, sorts) n'existent plus qu'une fois ; commentaires périmés corrigés. Aucun changement dans le jeu.
- **Aide du coin retirée** : la ligne de touches en bas à gauche a disparu (l'aide complète reste sur H et dans le menu Échap).
- **Souris** : un clic à côté d'un écran (inventaire, compétences, quêtes, marchand, forge, établi), à côté du menu pause, ou sur le jeu pendant un dialogue, le ferme et reprend la vue en un seul geste. Échap puis Échap : le navigateur refuse de reprendre la souris sans clic (règle du navigateur, pas contournable) ; le jeu l'écrit maintenant (« Clique dans le jeu pour reprendre la vue »).
- **Parties** : le menu Échap a un bouton « Parties » avec 3 emplacements (résumé : niveau, acte, jour) : charger, nouvelle partie, recommencer, effacer (deux clics pour confirmer). La partie existante est l'emplacement 1, sans conversion.
- **Outils en cristal** : épée, hache, pioche en cristal à la forge (lingots d'acier et bois de la recette en acier, plus 4 cristaux bleus), une fois les 5 cristaux rapportés à Aldric (acte III) : ils servent donc pour le camp et Morvan. Message « Bertil sait maintenant forger le cristal ». Les modèles existaient déjà (lame lumineuse, plus détaillés que l'acier).
- **Livre de fin** : quelques secondes après la fin de l'histoire, un vieux livre s'ouvre (3 doubles pages : la chronique, les années qui suivirent, la forteresse relevée, Castalrock capitale, « Fin » avec le nombre de jours et le niveau). Le jeu est figé pendant la lecture. Refermé, on peut encore se promener ; « Relire la fin » apparaît dans le menu Échap. La reconstruction du château est racontée, pas jouée.
- **Pour une page GitHub** : `README.md` ; touches de test (F6, F7, F8, T) et « Retour au village » seulement avec `npm run dev` ; chemins relatifs dans la version construite. Le texte du kit de feu de camp est corrigé.
- Sauvegarde toujours en **v25** (un champ facultatif en plus : livre déjà lu).

Vérifié dans le navigateur (port 5177, sauvegarde à part) : menu Échap, panneau « Parties », chargement d'un autre emplacement, ouverture du livre sur une histoire terminée, pages, fermeture, « Relire la fin », outils en cristal sur la page d'essai. **Pas vérifié** : la reprise de la souris après un clic (l'outil de test ne capture pas la souris), le glisser-déposer de l'inventaire relâché à côté du panneau.

### À tester
1. **Partie dont l'histoire est finie** : la charger, attendre quelques secondes sans ouvrir d'écran : le livre s'ouvre. Flèches ou clics pour tourner, « Refermer le livre ». Puis Échap : « Relire la fin ».
2. **Souris** : parler à un habitant puis cliquer sur le décor : la conversation se ferme et la vue est libre tout de suite. Pareil à côté de l'inventaire, de la forge, du marchand, du menu Échap. Dans l'inventaire, glisser un objet et le relâcher à côté du panneau : rien ne doit se fermer.
3. **Parties** : Échap, « Parties », « Nouvelle partie » sur l'emplacement 2 ; puis revenir sur la partie 1 avec « Charger » : elle est intacte.
4. **Cristal** : sur une partie qui a passé « Rapporte 5 cristaux bleus à Aldric », la forge propose les trois outils en cristal (il faut l'outil en acier d'abord).
5. Le bas gauche de l'écran est vide (plus de liste de touches).

### Questions en attente
- ~~Licence du code~~ : réglé à l'étape 62 (CC BY-NC-SA 4.0).
- Une **capture d'écran** du jeu pour le README (emplacement prévu en haut).
- Anciennes versions de sauvegarde (v1 à v24) : toujours dans le code, à retirer seulement s'il est confirmé qu'aucune vieille partie n'est conservée.
- ~~Création du dépôt GitHub et de la page~~ : réglé à l'étape 62.

## 2026-11-20 (soir, suite) — Étape 60 : finir l'histoire

Branche `etape/60-finir-histoire`, **fusionnée dans `main` le 20/11** (accord du concepteur). Le jeu du port 5175 sert `main`, et la partie du concepteur passe en **sauvegarde v25** au premier chargement. 950 tests, build OK. Relu par l'agent relecteur (Opus) : rien de critique ; ses points « à corriger » sont corrigés, sauf les cases de sac gardées après réinitialisation (question ci-dessous). Conception : `docs/conception-fin-histoire.md`.

Fait (Sonnet pour les règles, Fable pour les modèles, Opus pour la conception, les branchements et la relecture) :
- **60a — Bandits** : errants plus nombreux, surtout la nuit (prairie 5 %, forêt 6 %, ×2,5 la nuit, dès 90 m du village) ; **embuscades** de 2-3 bandits quand une quête ou l'histoire en demande (après 2 à 4 min hors du village en prairie ou forêt, ×0,6 la nuit, jamais dans le village) ; Gaspard dit où ils rôdent.
- **60b — XP** : courbe 80 × n^1,25, récolte, fabrication et ennemis plus généreux, étapes d'histoire × 1,5 ; parties converties (niveau 8 → 11, +3 points) ; bouton **« Réinitialiser »** dans l'écran K (deux clics). Racheter un nœud ne soigne plus et ne remplit plus le mana (sinon, soin infini par réinitialisation).
- **Morvan** n'est au camp qu'à partir du plan de Gaspard (acte IV) ; avant, seulement ses gardes.
- **60c/60d — Village attaqué** pendant la première visite à Aldric : étapes « Rentre au village », « Parle à Gaspard », « Aide le village à se relever » ; chaîne en personne « Relever le village » (Gaspard 25 bois 15 pierres, Marthe 5 viandes cuites, Hugo 20 bois 12 fibres 10 pierres) ; les deux maisons de chaume s'affichent **endommagées** (reconstruction commencée, sans feu) jusqu'à leur quête ; ceux qui n'ont plus de toit dorment à l'auberge ; répliques propres à ce moment. Coffre, maison du joueur, forge, établi et auberge intacts. Sauvegarde v24.
- **Aldric déplacé** au nord-ouest (environ 290 m du village), loin du camp (550 m) ; **cabane** près de son feu. Le **camp a bougé** du même coup : au sud, 282 m (avant : environ 370 m). Les ruines n'ont pas bougé.
- **Indices de direction** en pas, dans les répliques, les objectifs et le journal : Aldric (nord-ouest, ~300 pas), la mine (nord, ~150 pas), le camp (sud, ~300 pas), les ruines (sud-est, ~450 pas).
- **60g — Coffres de butin du camp** : 3 coffres (or, ressources volées, parfois lingots ou potion ; celui de Morvan a toujours des lingots de fer), ouverts une seule fois, à tout moment.
- **60h — Ferme** : 5 poules au village, 3 moutons dans un enclos à partir du niveau 2 (décor).
- **60e — Potager** : quête de Mathilde (2e de sa chaîne) qui donne un seau ; E au puits remplit, E au potager de la maison du joueur arrose ; le lendemain, récolte de baies et de plantes médicinales. Sans contrainte. Sauvegarde v25.
- **Horloge** au-dessus du coin droit de la mini-carte, bloc des quêtes remonté.
- **Carquois** posé sur l'armure (entrée précédente).

### À tester
1. **Chargement** : une partie existante se charge, niveau 11 environ, points en plus (K). Essayer « Réinitialiser » puis « Confirmer ? », puis racheter les compétences.
2. **Horloge** près de la mini-carte, bloc des quêtes plus haut.
3. **Bandits** : avec la quête de bandits en cours, s'éloigner à plus de 90 m en forêt et attendre 2 à 4 minutes (plus vite la nuit) : « Des bandits surgissent des fourrés ! ». Gaspard en parle.
4. **Camp** (au sud, ~280 m) : gardes, pas de Morvan ; ouvrir les 3 coffres (E).
5. **Village** : poules près des maisons ; moutons dans l'enclos (niveau 2).
6. **Potager** : quête de Mathilde, seau, puits, arrosage, récolte le lendemain (T accélère le temps).
7. **Histoire** : Mathilde envoie chez Aldric (nord-ouest) : sa cabane ; au retour, les deux maisons de chaume abîmées, Gaspard, les trois quêtes, les maisons qui redeviennent intactes.
8. **Carquois** sur chaque armure, à l'arrêt et en courant.

### Questions en attente
- **Cases de sac** (Porteur, Grand sac) : gardées après une réinitialisation (jamais d'objet perdu), donc un petit bonus gratuit. À laisser ?
- Les indices sont en **pas** : à conserver, ou passer en mètres ?
- Repères personnels posés près de l'ancien emplacement du camp : ils ne correspondent plus (le camp a bougé de ~90 m vers le village).
- Le potager ne change pas d'aspect quand il est arrosé (seulement messages et invites) : ajouter un signe visuel ?

## 2026-11-20 (soir) — Carquois posé sur l'armure ; idées du concepteur en attente de décision

Sur `main`, **pas encore commité**. 871 tests, build OK.

Fait :
- **Carquois** : il rentrait à moitié dans le dos (5 cm sans armure, 6 à 8 cm avec les armures, 20 cm dans la cape de fourrure). Il est maintenant reculé selon l'armure portée, à environ 5 mm du dos, sans flotter ; sur la cape de fourrure il est un peu basculé et **suit la cape** quand elle se soulève en courant. Mesuré au repos et en course avec la page d'essai `essai/carquois.html` (nouvelle) : écart de 5 à 8 mm pour les 6 cas.

### À tester
1. Arc possédé, vue 3e personne (V) : regarder le carquois de dos et de profil avec chaque armure, à l'arrêt puis en courant (Maj). Il doit être posé sur l'armure, ni dedans ni en l'air.
2. Armure de fourrure : courir : le carquois se soulève avec la cape au lieu de passer au travers.

### Idées du concepteur (20/11 au soir), à trancher avant de coder
- **Bandits introuvables** : diagnostic : les bandits errants sont très rares (3 % des points d'apparition, prairie et forêt seulement, jamais à moins de 120 m du village : environ un pour 3 hectares) ; les attaques du soir ne commencent qu'à l'acte II. La quête de Gaspard « Voyageurs détroussés » peut arriver avant. Proposé : des **embuscades** (2-3 bandits qui surgissent loin du village, garanties au bout de quelques minutes quand une quête en demande) et une réplique de Gaspard qui dit où ils rôdent.
- **Grand raid sur le village** au retour de la visite à Aldric (acte III), puis **reconstruction maison par maison**, puis l'assaut du camp. Coffre et maison du joueur épargnés. Repousse la ligne d'arrivée du « Plan de fin » : accord du concepteur nécessaire.
- **Pêche** (pas dans le jeu) et **potager arrosé** avec le seau du puits (le potager n'est qu'un décor aujourd'hui ; aucune graine dans le jeu).

## 2026-11-20 — Allègement du code (rien ne change dans le jeu)

Fait en deux passes, **fusionné dans `main`** (accord du concepteur) juste après la branche des graphismes. 871 tests (880 moins les 9 qui testaient du code retiré), build OK. **Pas vu tourner dans le navigateur** (l'outil de lancement n'a pas pu démarrer le jeu depuis le dossier de travail). Vérifié autrement : positions de la mine, du camp et des ruines identiques avant et après sur 8 graines.

Fait (environ 280 lignes de code et 90 lignes de tests en moins) :
- **Code mort retiré** : restes de l'ancienne interface (`salutHabitant` et ses phrases, `totauxRessources`, `ajouterRessources`, `texteSuivi`, `lacetVersBaluchon`), fonctions jamais branchées (`placePour`, `placeDisponible`, `chercherChaine`, `couleurMotCle`, `progressionElan`, `cibleParler`, `sortsAppris`, `depenserMana`, `repereSuivi`, `feuAPortee`, `estPosable`), réglages sans effet dans `config.ts` (`porteeFeu`, `colonnesPorte`, `colonnesSac`, `colonnesCoffre`), six variables jamais lues.
- **Doublons fusionnés** : la recherche des cases atteignables à pied (`casesAtteignables` dans `src/regles/lieux.ts`, pour la mine et pour les lieux), le hachage d'un texte (4 copies → `hacher` dans `src/regles/aleatoire.ts`), `ramener24`, le tirage aléatoire des ennemis, `dansCible`, `texteDistance`, `texteRecompense`, `hasard` et `ecartAvant` (3 copies dans les modèles → `src/scene/coiffures.ts`).
- **Garde-fou** : `noUnusedLocals` dans `tsconfig.json` : `npm run build` refuse maintenant une variable ou un import jamais lu.
- Commentaires périmés corrigés (« trois caméras », « base ou fer », caméra de visite « provisoire ») ; `src/maison/` décrit dans `CLAUDE.md`.
- Format de sauvegarde inchangé par ce nettoyage.

### À tester
Rien ne doit avoir changé. Un tour rapide suffit :
1. Lancer le jeu : la mine est au même endroit ; F8 mène au camp puis aux ruines, aux mêmes endroits.
2. Poser un feu de camp (G), se reposer (E) ; poser un piège et le relever.
3. Parler à un habitant, rendre une quête (la ligne de récompense s'affiche), ouvrir la carte (M) et cliquer un repère : la distance s'affiche ; tirer une flèche et une boule de feu sur un ennemi.
4. Regarder les cheveux du héros (3e personne) et un casque de fourrure : même aspect qu'avant.

### Questions en attente
- **Audit complet à refaire** (prévu avec le concepteur) sur le code fusionné. Déjà repérés et laissés : les cheveux du héros (`personnage.ts`) refont à la main ce que fait `coiffures.ts` ; la fin de vie d'une créature écrite 3 fois (`modelesAnimaux.ts`, `modelesEnnemis.ts`) ; le bloc de fin de mise à jour d'un ennemi écrit 4 fois ; le détour des ennemis bloqués et la liste des cibles (arc, sorts) en double ; la maison greffée sur la mine ; la boussole calculée dans `src/jeu/mort.ts` ; les migrations de sauvegarde.
- `src/regles/indices.ts` attend toujours les textes d'indices.
- Branches déjà fusionnées et une copie de travail d'agent sous `.claude/worktrees/` : à supprimer si le concepteur est d'accord.
- Le message « Impossible de poser un feu dans la mine » s'affiche sans doute aussi dans la maison (lu dans le code, pas vu en jeu).

## 2026-11-20 (suite) — Mailles retravaillées, icônes, écrans au thème, ennemis, ruines

Même branche `autonome/2026-11-20-graphismes`, **fusionnée dans `main` le 20/11** (accord du concepteur). Après les premiers essais du concepteur : armure de cuir retenue ; cotte de mailles, icônes de la barre et épée en bois à reprendre (l'épée en bois avait l'air en fer). 880 tests, build OK. Relu par l'agent relecteur (Opus) : rien de critique, ses points corrigés.

Fait :
- **57l — Cotte de mailles** : anneaux 3 à 4 fois plus petits, entrelacés, peu contrastés, léger reflet, motif enroulé sans couture ; ceinture de cuir soignée, ourlets de cuir ; manche en 1re personne et camail assortis.
- **58 — Icônes** : les 55 icônes redessinées dans un même style (facettes, contour sombre, lumière en haut à gauche) ; **épée, hache, pioche ont un dessin par palier** (bois blond, cuivre martelé, fer sombre, acier clair, cristal) : l'épée en bois a l'air en bois. Icônes ajoutées pour la gelée de slime et l'Éclat du Cœur (avant : « ? »). Un test vérifie que chaque objet a son icône.
- **59 — Écrans au style Ardoise et laiton** : menu pause, journal des quêtes, fabrication et réparation, marchand, dialogues, aide (mieux alignée), écran de chute, invite « E : … », compteur d'images, barre de vie de Morvan, titre de la mini-carte. Aucun comportement changé.
- **Mains d'escalade** refaites d'après « Deux mains, un sommet » (à plat sur la roche, doigts écartés, celle du haut tire, celle du bas pousse).
- **Bandits** en cuir dépareillé (plastron, une épaulière, sacoche, pans) et **Morvan** en cuir renforcé de fer sombre avec grande cape rouge ; moins de morceaux à dessiner qu'avant.
- **Ruines et petites grottes** habillées d'après les images : pierres ébréchées, mousse, herbes, pierres tombées, arche de rochers et cristaux au fond des grottes ; positions et collisions strictement inchangées.
- **L'Éclat du Cœur** a un vrai modèle (cristal à facettes, lueur qui pulse) : à la mort de Morvan, il **jaillit de son corps et vole vers le joueur** (effet seulement : il arrive toujours directement dans l'inventaire).
- **Forteresse de Castalrock** habillée comme les ruines (mousse, herbes, pierres ébréchées).
- **Pans d'armure, bas de tunique et cape** qui suivent les jambes : en course et en saut, les cuisses ne passent plus au travers ; la cape de fourrure se soulève puis retombe.

### À tester
1. **Barre** : outils en bois au départ : les cases 1 à 3 montrent du bois, pas du métal. Fabriquer la hache en cuivre : son icône change.
2. **Inventaire, fabrication, marchand** : toutes les icônes, à la bonne taille ; une gelée de slime a son icône.
3. **Cotte de mailles et camail** en 3e personne (de près, de loin, de nuit) et la manche en 1re personne : rendu satisfaisant ? Les bordures de cuir conviennent-elles (elles ne sont pas sur l'image) ?
4. **Échap, J, H, établi, forge, marchand, dialogue, chute** : tout est au nouveau style, tout marche comme avant (curseurs de son, « Entendre mes pas », sauvegarde, fermeture).
5. **Escalade** (Espace face à une paroi) : les mains.
6. **F8** jusqu'au camp de Morvan : bandits et Morvan habillés ; coups reçus qui font blanchir toutes les pièces.
7. Une **ruine** et une **petite grotte** au pied d'une falaise : mousse, herbes, cristaux ; on ne se cogne pas à des choses invisibles. F8 jusqu'à la forteresse : mousse et herbes aussi.
8. **Morvan** : le battre : l'Éclat jaillit et vole vers le joueur pendant le message de butin.
9. **Course et saut en 3e personne** avec chaque armure (V, puis Maj) : les pans et la cape ne traversent plus les jambes ; le bas de la cotte de mailles s'ouvre moins (le genou peut l'effleurer).

### Questions en attente
- Les grands cristaux décoratifs du fond des grottes peuvent faire croire qu'on peut les récolter : les garder ?
- La pierre des ruines reste gris froid, l'image est plus taupe : la réchauffer ?

## 2026-11-20 — Graphismes et équipement (étape 57) : armures et casques visibles, outils détaillés, arc aligné

Branche `autonome/2026-11-20-graphismes`, **fusionnée dans `main` le 20/11** (accord du concepteur). 876 tests, build OK. Commencée la nuit, interrompue, finie le 20/11. Vérifié sur les pages d'essai (`essai/`) et en partie dans le jeu (port 5177) : armure de plaques et de mailles en 3e personne, camail sur la tête, manches de mailles et gants en 1re personne, emplacement Casque, barre dans le nouvel ordre. Relu par l'agent relecteur (Opus) : aucun point critique ; ses 4 points « à corriger » sont corrigés.

Fait (un commit par étape) :
- **57a** : pages d'essai `essai/` (personnage, bras en 1re personne, outils) et `essai/capture.py` (capture d'écran sans navigateur, pour vérifier un modèle ; demande Playwright pour Python, installé sur la machine de développement, pas une dépendance du jeu).
- **57b** : **casques** : bonnet de cuir et chapka (établi), camail de mailles et heaume d'acier (forge, heaume au village niveau 2) ; −4 / −6 / −8 / −10 % de dégâts en plus de l'armure, protection totale plafonnée à 75 % ; pas d'usure ; emplacement « Casque » (glisser-déposer, clic droit, Maj + clic) ; sauvegarde **v22**.
- **57j** : **arc en case 4**, **pousses et piège en case 6**.
- **57c** : **cheveux** refaits en une seule masse à facettes, sans trou (le forgeron garde ses cheveux sombres).
- **57g** : **épées, haches, pioches** des 5 paliers bien plus détaillées, même prise en main, un maillage par matériau.
- **57d** : **armures visibles** sur le corps (fibres inventée ; cuir, fourrure, mailles avec anneaux dessinés, plaques d'après l'image), bottes assorties.
- **57e** : **manches d'armure en 1re personne** : cordelette, brassard de cuir, manche et revers de fourrure, manche de mailles et gant gris, canon et gantelet d'acier.
- **57f** : **casques sur la tête** : bonnet (la frange dépasse), chapka, camail, heaume (le visage disparaît).
- **57k** : **arc aligné** : en visée, la flèche encochée monte droit vers le viseur (« midi »).
- Glisser une armure (ou un casque) sur celle qu'on porte les **échange** ; glisser l'équipement porté sur une case qui contient une autre armure (ou un autre casque) les échange aussi.
- **Bonus** : coiffures des **villageois et du marchand** refaites de la même façon (Gaspard, Marthe, Mathilde, Hugo, Aldric, marchand ; module `src/scene/coiffures.ts`), sans maillage en plus.
- Fluidité : personnage armé 30 à 46 maillages et 2 000 à 4 500 triangles (2 354 avant, sans armure) ; les parties du corps cachées sous l'armure ne sont plus dessinées. Le personnage 3D dans l'inventaire est abandonné pour l'instant (décision du concepteur).

### À tester (sur `main`, port 5175 habituel : une partie existante passe toute seule en sauvegarde v22, sans rien perdre)
1. **Barre** : 4 = arc (s'il est possédé), 6 = pousses, rappuyer sur 6 = piège. Molette.
2. **Casques** : fabriquer un bonnet de cuir à l'établi (3 cuir, 2 fibres), le glisser sur « Casque » (à droite, sous Bouclier). V : il est sur la tête, la frange dépasse. Fabriquer une chapka (2 fourrure, 1 cuir) et la glisser sur le bonnet : ils s'échangent. Glisser le casque porté vers une case vide : il revient dans le sac.
3. **Armures** : équiper chaque armure fabricable, la regarder en 3e personne (V) en marchant, en courant, en sautant, en frappant (les jupes et la cape peuvent un peu traverser les cuisses en course : à signaler si cela gêne). Glisser une armure sur celle qui est portée : échange.
4. **1re personne** avec chaque armure : la manche et le gant suivent la frappe, le bouclier levé, les sorts (A), l'escalade (Espace face à une paroi), l'arc.
5. **Arc** (case 4) : maintenir le clic pour viser : la flèche doit monter droit vers le centre. Tirer : la flèche part-elle bien de là ?
6. **Outils** : touches 1, 2, 3 à chaque palier possédé : la nouvelle épée, hache, pioche. Le vert-de-gris du cuivre convient-il ?
7. **Cheveux** : de face, de dos, de profil en 3e personne ; le forgeron au village a toujours ses cheveux sombres ; voir Gaspard, Marthe, Mathilde, Hugo, Aldric et le marchand : coiffures sans trou, chacun reconnaissable.
8. **Fluidité** : compteur d'images (F3) en 3e personne avec l'armure de plaques et le heaume, au village : pas de baisse ressentie.

### Questions en attente
- L'armure de fibres a été inventée (pas d'image) : convient-elle ? Un prompt d'image est prêt (document de conception « apparence du personnage (étape 57) », non versionné) pour obtenir une référence.
- Les oreillettes du bonnet de cuir ressemblent un peu à des cheveux ; le camail a une ouverture carrée plutôt qu'ovale. À reprendre ?

### Reste possible (bonus graphiques, pas faits)
Bandits et Morvan habillés avec de vraies pièces d'armure ; ruines, petite grotte, mains d'escalade, Éclat du Cœur d'après les images.

### Observation
Le test `src/monde/decor.test.ts` (« chaque élément est dans son chunk… ») dure environ 9 s pour un délai de 5 s : il échoue parfois quand la machine est chargée (plusieurs agents en même temps), et passe seul. Rien à voir avec cette branche ; lui donner un délai plus long serait plus sûr.

## 2026-11-19 (nuit) — Refonte de l'interface (ATH), lots 1 à 8

Branche `etape/56-interface` (**pas fusionnée** dans `main`), travaillée dans une copie de travail à part (sous `.claude/worktrees/`). 830 tests, build OK. Vérifié dans le navigateur en 1280 × 720 : écran de jeu, inventaire (glisser-déposer simulé dans la page), compétences, carte agrandie (pose, suivi d'un repère, boussole). Les animations (gain d'XP, sort en recharge) n'ont pas été vues en vrai.

Fait (d'après la maquette « Ardoise et laiton » et les décisions du concepteur) :
- **Thème commun** (`src/ui/theme.ts`) : panneaux sombres transparents, filet doré, accent bleu cristal, coins arrondis 25-30 px ; polices **Cinzel** (titres) et **Alegreya Sans** (texte) copiées dans `public/polices/` (licence OFL, source dans `SOURCES.md`).
- **Bas de l'écran** : barre d'outils centrée (pastille de matériau, usure en fine barre, nom de l'outil au-dessus) ; vie et mana de part et d'autre des 3 sorts en petites icônes (allumée / éteinte / se colorie de bas en haut en recharge puis brille) ; barre d'XP où le gain s'ajoute en clair, avec « +24 XP · 108 / 200 » quelques secondes.
- **Haut de l'écran** : boussole en bandeau (N, NE, E…) ; panneau de quêtes en haut à droite (quête principale puis quêtes du village, mots-clés colorés) ; heure ; mini-carte avec grosse encoche N (qui tourne avec la carte tournante) ; « +2 Bois » restylé au centre ; **plus de liste des ressources à l'écran**.
- **Fin du guidage** (lot 4, partie 1) : la boussole ne montre plus la mine ni l'objectif de l'histoire ; la mine n'apparaît sur les cartes qu'une fois visitée ou vue à moins de 60 m. Directions calculées d'après la vraie position des lieux (`src/regles/indices.ts`), **textes d'indices pas encore écrits** (voir questions).
- **Repères personnels** : carte ronde (M) au centre sur le jeu flouté, anneau de boussole, zoom à la molette et aux boutons, 5 types (Filon, Cueillette, Danger, Trésor, Lieu à revoir), 8 au plus ; clic sur un repère : distance, Suivre, Retirer ; bouton maison pour suivre le village. Le repère suivi s'écrit sous la boussole. Gardés dans la sauvegarde (**version 21**, les anciennes parties se chargent sans repère).
- **Inventaire** : rangement à la main par **glisser-déposer** (déplacer, échanger, empiler, vers le sac magique et le coffre ; une armure glissée sur l'emplacement Armure s'équipe), onglets, fiche de l'objet survolé avec une courte description, personnage (version simple) qui tient l'objet de la barre en main droite et se balance doucement. Maj + clic : vers l'autre sac ; clic droit : manger.
- **Compétences en étoile** : 6 branches qui finissent sur le même cercle, zoom, déplacement en glissant, points de compétence en haut à droite, compétences disponibles qui « respirent ».
- Relecture Opus : aucun point critique ; corrigé : sort sans mana qui brillait, message « Clic pour reprendre la main » après Échap sur la carte, petites sécurités (glisser-déposer, repères).

### À tester
**Important : tester sur la branche avec une sauvegarde à part.** La branche enregistre la partie en version 21 ; `main` (version 20) ne saurait pas la relire et repartirait d'une nouvelle partie. Demander à Claude de lancer la branche (elle tourne sur le port 5176, sauvegarde séparée de celle du 5175), ou de la fusionner d'abord.
1. **Écran de jeu**, de jour puis de nuit (T), et dans la mine : tout est lisible ? Rien ne se chevauche en plein écran ?
2. **Barre d'outils** : touches 1 à 6 et molette ; le nom au-dessus change, la case choisie monte. Couper un arbre : la fine barre d'usure baisse.
3. **XP** : tuer un slime ou couper un arbre : un bout clair s'ajoute au bout de la barre et « +N XP · x / y » apparaît 3 s.
4. **Sorts** (débloquer la boule de feu avec K) : A lance ; l'icône se recolorie de bas en haut puis brille ; vider la mana : elle reste grise.
5. **Boussole** : tourner sur soi : N, E, S, O défilent ; la maison du village reste à sa place. Elle ne montre plus la mine.
6. **Carte (M)** : choisir un type à droite, cliquer pour poser 2-3 repères ; cliquer sur un repère → Suivre : son nom et sa distance s'écrivent sous la boussole, il est sur la mini-carte. Molette et + / − pour zoomer. Poser un 9e : refusé. En retirer un. Recharger la page : ils sont toujours là. Fermer avec M, puis avec Échap (un clic doit suffire à reprendre la main).
7. **Inventaire (Tab)** : glisser des objets d'une case à l'autre, sur une pile du même objet, dans le sac magique ; glisser une armure sur « Armure » ; Maj + clic ; clic droit sur des baies. Cliquer une case de la barre en bas : le personnage change d'objet en main. Ouvrir le coffre du village (E) et y ranger des objets.
8. **Compétences (K)** : molette, glisser pour déplacer, bouton recentrer ; avec un point, les compétences disponibles respirent ; cliquer pour apprendre.
9. **Quêtes** : accepter une quête au village : elle apparaît en haut à droite, avec sa progression et ses mots en couleur.

### Questions en attente
- **Indices de direction** (lot 4) : liste proposée dans les notes partagées de l'interface (non versionnées) ; « pas » ou « mètres » ? **Tant qu'ils ne sont pas écrits, le joueur n'a aucune indication pour trouver Aldric, la mine, le camp ou les ruines : ne pas fusionner avant.**
- Boussole : garder le **baluchon** (affaires perdues) ? Retirer le **bandit d'attaque** (aujourd'hui encore montré) ?
- **Zones inexplorées** assombries sur la carte : oui / non (pas faites).
- **Personnage de l'inventaire** : garder la version simple, ou faire la version 3D (une session Fable) ?
- Les cases (barre, inventaire) ont des coins de 12 px, les panneaux 25-30 px : cet écart convient-il ?

### Reste (hors de ces lots)
- Pas encore restylés : menu pause (Échap), journal des quêtes (J), fabrication, marchand, dialogues, écran d'aide (H), écran de chute.
- Icônes provisoires (repères, objets, sorts) à choisir.
- Petits points de la relecture laissés : un clic hors du disque ne ferme pas la bulle d'un repère ; clic droit sur un aliment du sac magique ou du coffre sans effet ; « +N XP » compte mal un passage de plusieurs niveaux d'un coup.

## 2026-11-19 (nuit) — Sons : bruitages, cris des créatures, musique de l'auberge

- Demande du concepteur : des bruitages discrets, des cris pour les animaux et les monstres **spatialisés** (on entend d'où ils viennent), une musique de taverne **seulement à l'auberge** pour commencer. Voix des villageois écartée.
- **76 sons libres (CC0)** trouvés sur OpenGameArt, dans `public/sons/`, avec la source de chacun dans `public/sons/SOURCES.md` (≈ 4,9 Mo, musique comprise). Le téléchargement direct des packs Kenney est bloqué par leur site ; le pack « RPG Audio » a été pris sur OpenGameArt, où il est aussi publié.
- **Ce qui fait du bruit** : hache sur les arbres (avec le craquement à l'abattage), pioche sur la roche et les filons (la roche qui éclate à la fin, un petit tintement si la pioche est trop faible), feuillage pour les buissons et plantes, souffle d'un coup dans le vide, épée qui touche, parade, joueur blessé ; **pas** selon le sol (terre, forêt, pierre en montagne et dans la mine, bois dans la maison, eau et marais), atterrissage après une vraie chute, plouf en entrant dans l'eau profonde. Chaque son a plusieurs variantes et une hauteur qui varie un peu : jamais deux fois le même de suite.
- **Créatures**, placées dans le monde : gobelins, loups, sangliers, slimes crient de temps en temps au calme (à moins de 28 m), quand ils repèrent le joueur, quand ils attaquent, quand ils sont touchés ou meurent ; bandits et Morvan grognent quand ils sont touchés. Cerf, renard et lapin : un froissement de feuillage quand ils détalent (aucun cri libre de droits trouvé pour eux).
- **Musique** « The Old Tower Inn » (RandomMind) jouée **depuis l'auberge** : pleine près d'elle, muette au-delà de 45 m, avec montée et descente douces. Pas d'auberge au niveau 1 du village : pas de musique.
- **Menu Échap → Sons** : volume général, bruitages, musique (un petit coup de hache au relâchement du curseur pour entendre), et la case **« Entendre mes pas »**. Après les premiers essais du concepteur : pas calés sur la pose du talon, et **d'autres sons pour la course** (le son de botte lourd ne convenait pas) : des pas plus légers enregistrés dehors sur sable, herbe et pierre (pack Fantozzi, CC0). La marche garde ses sons.
- Code : `src/son/` (catalogue, choix purs et testés, moteur Web Audio), `src/jeu/sons.ts` (pas, cris, musique), réglages dans `CONFIG.sons`. Relu par un agent relecteur, ses points corrigés. Branche `etape/sons`, 783 tests.

### À tester
1. **Hache** sur un arbre jusqu'à l'abattre, **pioche** sur un rocher et un filon : un bruit discret à chaque coup, le craquement ou l'éclat à la fin. Trop fort, pas assez ?
2. Coup dans le vide : un petit souffle.
3. **Marcher puis courir** sur l'herbe, en forêt, en montagne, dans l'eau, dans la mine, dans la maison du joueur : le bruit change-t-il avec le sol ? Les **nouveaux pas de course** conviennent-ils ?
4. Sauter sur place : pas de bruit lourd. Sauter d'une hauteur : un pas lourd à l'arrivée.
5. Approcher des **gobelins, loups, sangliers, slimes** sans les attaquer : un cri de temps en temps, et en tournant la tête, le son change de côté. Se laisser repérer, puis combattre.
6. **F6** jusqu'au village niveau 2 et approcher de l'auberge : la musique monte ; s'éloigner : elle s'efface. (Repasser au bon niveau avec F6 ensuite.)
7. Menu Échap → **Sons** : bouger les curseurs, décocher « Entendre mes pas ».

### Questions en attente
- Les volumes conviennent-ils, son par son ? Chaque son a son propre volume dans `src/son/catalogue.ts`.
- Pour plus tard, éventuellement : sons de l'arc et des sorts, des coffres, de l'interface, ambiance (vent, oiseaux, rivière), d'autres morceaux de musique.

## 2026-11-19 (nuit) — Bras qui balancent à la marche en 1re personne

- Micro-mouvements des doigts validés par le concepteur et fusionnés dans `main`. Mais les bras restaient raides en courant : à la marche, la **main libre** part maintenant d'avant en arrière (environ 7 cm à pleine vitesse, en remontant un peu vers l'avant ; le coude reste en place, c'est l'avant-bras qui pivote) et l'**outil** balance à contretemps (3 cm, légère inclinaison). Un aller-retour par foulée, proportionnel à la vitesse, effacé pendant une frappe. Au repos, la dérive de l'avant-bras est un peu plus ample (12 mm au lieu de 7). Réglages : `CONFIG.personnage.balancementBras` et `microMouvements`. Branche `etape/balancement-bras`, 762 tests.

### À tester
1. Épée en main, marcher puis courir : la main gauche et l'épée doivent balancer, sans sortir de l'écran.
2. Hache ou pioche à deux mains : l'outil balance un peu en marchant.
3. S'arrêter : le balancement s'éteint en douceur.

## 2026-11-19 (nuit) — Micro-mouvements des mains en 1re personne

- Demande du concepteur : des mains plus vivantes. Au repos, la **main libre** (épée en main) dérive un peu et son poignet bouge à peine. **Chaque doigt** joue de son côté, et de temps en temps la main se referme un peu plus avant de se rouvrir. L'**outil** tenu flotte très légèrement (quelques millimètres, environ 1°). Rien de régulier comme une respiration : trois vagues lentes de fréquences différentes (`fremir` dans `src/scene/personnage.ts`). Tout s'efface pendant une frappe, une charge ou un sort. Réglages dans `CONFIG.personnage.microMouvements`. Branche `etape/micro-mouvements`, 762 tests.

### À tester
1. Épée en main, rester immobile une dizaine de secondes : la main gauche et ses doigts doivent bouger un peu, sans gigoter.
2. Hache, pioche : l'outil ne doit pas trembler, juste vivre un peu.
3. Frapper et lancer un sort : le geste doit rester net.
4. Trop ou pas assez ? Dire « plus » ou « moins » pour la main, les doigts ou l'outil.

## 2026-11-19 (nuit) — Outils tournés pour voir le tranchant de face

- Demande du concepteur : en 1re personne, l'épée, la hache et la pioche se voyaient de profil, tranchant vers le côté. Elles sont maintenant **tournées autour du manche** (réglage `roulis` des tenues dans `src/scene/personnage.ts`) pour être vues de trois quarts arrière : le tranchant part vers l'avant, dans le sens du coup, et une partie du fer ou du plat de la lame reste visible. Hache : 30°. Épée : 57° après le premier essai du concepteur (poignet plus ouvert, on frappe avec le fil et non le plat). Pioche : tourner seulement ne suffisait pas (tête vue de profil ou de bout), elle prend donc la tenue de la hache, manche redressé, une pointe vers l'avant et le centre de l'écran. Arc, torche, pousse, piège et vue 3e personne inchangés. Branche `etape/outils-tranchant`, 762 tests.

### À tester
1. Touches 1, 2 et 3 : au repos, le tranchant doit regarder vers l'avant sans que l'outil devienne une simple tige.
2. Frapper un arbre à la hache, un rocher à la pioche, un monstre à l'épée : le tranchant doit arriver de face sur la cible, pas à plat (l'instant de l'impact n'a pas pu être capturé en image).
3. Si c'est trop ou pas assez tourné, dire « plus » ou « moins » pour chaque outil : c'est un seul chiffre à changer.

## 2026-11-19 (nuit) — Fusion dans main, ruines de la forteresse de Castalrock

- La branche `autonome/2026-11-19-histoire` est **fusionnée dans `main`** (accord du concepteur). Les nouvelles images de la série 3 sont rangées dans `docs/concepts/`.
- **Ruines de Castalrock** (demande du concepteur) : le petit socle en montagne est remplacé par une **grande forteresse en ruine** (remparts à six côtés, trois tours effondrées, porte en arche, cour dallée, escaliers, colonnes). Au centre, le **Cœur de Castal** est un **cristal géant** à facettes, et non un cœur : terne, penché et fendu avant la reforge, puis vif, flottant, avec des éclats autour. Textes de Gaspard, d'Aldric et du journal mis à jour. Environ 435 m au sud-est du village ; F8 mène devant la porte. 762 tests.

### À tester
1. F8 (avec Morvan vaincu) : entrer par la porte, faire le tour (brèche, tour, escaliers), vérifier qu'on ne traverse pas les murs et qu'on ne reste pas coincé.
2. Face au cristal, E avec l'Éclat, 10 cristaux bleus et 5 lingots d'acier : lever les yeux. Recharger la page : il reste reforgé.
3. Aller à pied depuis le village pour juger la montée.

### Questions en attente
- La forteresse est sur un plateau vers 32 m d'altitude, pas au sommet (120 m) : rien de plus haut n'était atteignable à pied. Conserver ainsi, ou adapter les textes (« sur les hauteurs ») ?
- L'encoche du cristal brisé se voit peu de loin : à accentuer ?

### Reste (prochaine session, Fable)
- Aligner sur les nouvelles images : pièces de ruines (« Six ruines médiévales »), petite grotte, outils en bois (« Planche d'outils »), mains d'escalade (« Deux mains, un sommet »).
- Icône et modèle au sol de l'Éclat du Cœur (aujourd'hui un « ? »).

## 2026-11-19 (soirée) — Fin du plan de fin, côté Claude : boutons de retour, armes et marchand refaits, camp de Morvan et autel, escalade, ruines et petites grottes, cerf, relectures

Branche `autonome/2026-11-19-histoire` (**pas encore fusionnée** dans `main`). 756 tests, build OK. Le jeu se lance dans le navigateur (prologue affiché, pas d'erreur). **Rien n'a été joué en vrai** : les agents ont vérifié par tests et par captures sur des pages d'essai.

Fait :
- **Menu Échap** : bouton **« Retour au village »** (aide aux tests, refusé si mort ou pilote actif), en plus de « Je suis coincé ».
- **Session 2** : épées, haches et pioches refaites pour les 5 paliers d'après les images (le cuivre n'est plus un gourdin, le fer est sombre, l'acier clair) ; hache et pioche en bois inventées pour le palier de départ (l'image n'en montrait pas) ; **vrai modèle du marchand** (chapeau, barbe, hotte).
- **Session 3 (étape 45)** : **camp des bandits** en forêt (~370 m au sud), palissade, tentes, feu, tour, 4 gardes ; **Morvan le Balafré** (400 PV, barre de vie en haut, coup lourd annoncé, charge, 2 renforts à mi-vie, vie pleine si le joueur meurt) qui lâche l'**Éclat du Cœur** ; **autel du Cœur** en montagne (~455 m au sud-est) : E avec l'Éclat, 10 cristaux bleus et 5 lingots d'acier reforge le Cœur → épilogue. Boussole et mini-carte montrent les lieux. **F8** : téléporte au prochain lieu de l'histoire. Sauvegarde v20.
- **Session 1b** : **escalade lente** : Espace maintenu face à une paroi trop raide ; en 1re personne l'outil se range et les deux mains grimpent ; S descend, Q/D de côté ; pas dans l'eau, la mine, la maison, ni avec le pilote.
- **Session 3b** : **ruines** semées dans le monde (~une tous les 200 m), assemblées de pièces cassées, jamais pareilles ; **petites grottes** au pied des falaises avec cristaux (pioche en fer) ; **coffres** à ouvrir avec E (une fois, sauvegardé).
- **Session 1 (partie Claude)** : palier de départ affiché « en bois » ; Gaspard prête hache, pioche et épée en bois au prologue.
- **Cerf** refait d'après son image.
- **Relectures Opus** (deux passes) puis corrections : l'Éclat ne peut plus être perdu (inventaire, sinon coffre du village) ; pas de ruine dans la mine ou la maison ; une très vieille sauvegarde (v16) reprend l'histoire là où le jeu en est ; coffre de ruine sans perte si l'inventaire est plein ; pas de repos pendant une attaque ; pas d'attaque du village pendant le combat contre Morvan ; pas de dialogue pendant une attaque ; le marchand signale les objets qui servent à la reforge.
- **Partie accélérée** (test) : toute l'histoire jouée par les règles, du prologue à l'épilogue, avec sauvegarde au milieu : aucune étape bloquante.
- Prompts d'images, série 3 (`docs/prompts-images.md`, section 20).

### À tester
1. **Retour au village** : Échap → « Retour au village », depuis la forêt, la mine et la maison.
2. **Armes et outils** : regarder chaque palier en main (1re et 3e personne), de jour et de nuit. Hache et pioche en bois : à valider.
3. **Marchand** : son nouveau modèle sur la place (T pour avancer au jour 1). Dans « Vendre », les cristaux et l'acier disent « sert à reforger le Cœur ».
4. **Camp** : F8 → devant la porte du camp. Palissade et tentes bloquent le passage ; « Lieu découvert », icône sur la mini-carte.
5. **Morvan** (avec armure et potions) : barre de vie, hache levée avant le coup lourd (reculer ou bouclier), charge (pas de côté), « À moi, les gars ! » à mi-vie. Mourir une fois : sa vie revient pleine. Le battre : Éclat et or ; recharger la page, il ne revient pas.
6. **Autel** : F8 de nouveau. Sans les objets, E dit ce qui manque ; avec, le Cœur se reforge et bat ; recharger : il reste.
7. **Escalade** : au pied d'une pente trop raide, maintenir Espace : les mains grimpent, en haut l'outil revient. Essayer S, Q/D, lâcher. Tomber dans un trou et en ressortir.
8. **Ruines** : la plus proche est une maison seule à ~126 m à l'est du village ; un gros site avec coffre à ~270 m à l'est ; une grotte avec coffre à ~350 m à l'ouest. Ouvrir un coffre (E), recharger la page : il reste ouvert.
9. **Cerf** : son nouveau modèle, debout, en fuite, en broutant.

### Défauts et points connus
- **Difficulté de Morvan** à doser : avec ses 4 gardes, un personnage sans armure tombe vite.
- Les 4 gardes reviennent tous après un rechargement de la page (leur mort n'est pas sauvegardée).
- L'escalier de l'avant-poste des ruines est décoratif ; de gros rochers peuvent toucher un mur de ruine.
- L'Éclat du Cœur n'a pas d'icône propre dans l'inventaire.
- Pendant la marche, les sabots des quadrupèdes décollent du sol (animation commune).

### Questions en attente
- Hache et pioche **en bois** inventées (l'image n'en avait pas) : à conserver ?
- Il reste la **session 5** : une partie de test, puis les retouches. La branche se fusionne dans `main` sur accord du concepteur.

## 2026-11-19 (fin d'après-midi) — Relecture du palier 2, chaîne principale, marchand, attaques de bandits

Branche `autonome/2026-11-19-histoire` (**pas encore fusionnée** dans `main`, 4 commits). 651 tests, build OK. Vu dans le navigateur : l'objectif d'histoire sous la boussole, et une attaque lancée avec F7 (cloche, « Défends le village : 4 bandits », boussole vers un bandit), sans erreur dans la console. Le reste n'a pas été joué.

Fait :
- **Relecture Opus du palier 2** (partielle : sauvegarde, quêtes, dialogues, compétences, pièges et arc relus ; habitants, animaux, parade, cuisine, interface et modèles pas relus). Aucun point critique. Corrigé : les anciennes parties ne gagnent plus deux fois les cases de Transport ; une quête sautée avant une quête en cours compte comme faite (sinon l'habitant ne permettait pas de rendre la quête) ; E relève le piège plein même si un piège vide est plus près ; **E sur un piège vide le reprend** (avant, 5 pièges posés bloquaient tout).
- **Étape 42, chaîne principale** (`docs/conception-chaine-principale.md`) : 19 étapes du prologue à l'épilogue, objectif toujours affiché sous la boussole, onglet « Histoire » dans le journal (J), « ! » orange au-dessus de la personne à qui parler, boussole vers Aldric quand l'histoire y envoie le joueur. Chaque étape donne XP et or. Une partie avancée traverse toute seule les étapes déjà remplies (outils, niveau du village). L'**acte IV est provisoire** (6 bandits, puis cristaux et acier à Aldric) : l'étape 45 mettra le camp, Morvan et l'autel.
- **Étape 43, marchand ambulant** : sur la place un jour sur trois (jours 1, 4, 7…, de 7 h à 19 h), à côté de sa charrette. E pour lui parler : il vend potions, flèches, kits de feu, pièges, viande cuite, lingots de cuivre et de fer (stock par visite) et rachète les ressources (1 or le bois ou la pierre, 15 le cristal bleu). Maj+clic : par 10. Modèle provisoire.
- **Étape 44, attaques de bandits** : à partir de l'acte II, environ un soir sur trois à 19 h 30, 3 à 5 bandits marchent sur le village. Les habitants rentrent chez eux. Les battre tous rapporte 10 or et 40 XP par bandit. Sinon, ils pillent 10 à 20 % de 2 ou 3 ressources du coffre (jamais l'or ni l'équipement). **F7** lance une attaque tout de suite pour tester.

Ajouts après l'arrêt de la session, à la demande du concepteur :
- **Plan de fin** en 6 sessions dans la feuille de route : finir le jeu sans l'agrandir (étapes 23 et 46 mises de côté, 45 réduite ; ruines variées et petites grottes en 3b ; escalade en 1b).
- **Bouton « Je suis coincé »** (menu Échap) : ramène au bord d'où l'on est tombé (points sûrs gardés en mémoire, pas sauvegardés), sinon au point de réapparition. 658 tests.

### À tester
0. Tomber dans un trou, Échap, « Je suis coincé » : retour au bord, sans rien perdre. (Une partie déjà coincée avant la mise à jour n'a pas de point sûr : retour au point de réapparition.)
1. Nouvelle partie : suivre le prologue (parler à Gaspard, couper 3 arbres, se reposer, entrer dans la maison du joueur). Regarder la ligne sous la boussole et l'onglet « Histoire » du journal (J).
2. Ancienne partie : l'histoire doit sauter les étapes déjà faites (outils, village) et s'arrêter sur la première étape à faire.
3. Avancer le temps (T) jusqu'au matin du jour 1 : annonce du marchand, puis acheter et vendre (clic, Maj+clic), fermer avec E ou Échap, recharger la page et vérifier le stock.
4. F7 : sortir du village à la rencontre des bandits et les battre tous (récompense) ; recommencer en les laissant faire (pillage du coffre à minuit ou quand ils arrivent au bord du village).
5. Poser un piège, puis E dessus quand il est vide : il revient dans l'inventaire.

### Défauts et points connus
- Les bandits ne peuvent pas entrer dans le village (règle des ennemis, rayon de 45 m) : ils s'arrêtent au bord. Il faut sortir à leur rencontre, car ils ne voient pas le joueur resté sur la place.
- Le jour de répit après l'arrivée à l'acte II est oublié si on recharge la partie.
- Les textes de l'histoire ont été écrits par l'agent : à relire.
- Le marchand n'a pas de repère sur la mini-carte ; son modèle est provisoire.
- Restes de la relecture, non faits : les flèches plantées ne sont pas sauvegardées ; un point d'arbre retiré par une future version serait perdu sans être rendu ; une sauvegarde faite pendant la mort recharge avec toute la vie.

### Questions en attente
- Pièges : E sur un piège vide le reprend. À conserver ?
- Les bandits doivent-ils pouvoir entrer dans le village pendant une attaque (plus vivant, mais plus de travail) ?
- Prix du marchand : à essayer, puis à régler.

### Reprise (dans l'ordre)
1. Test par le concepteur, puis fusion dans `main` avec son accord.
2. Modèle du marchand d'après l'image (Fable).
3. Étape 45 : lieux et chefs (camp, Morvan, tanière et loup alpha, ruines, cabane d'Aldric, autel, mine de lave), qui remplace l'acte IV provisoire.
4. Fin de la relecture : habitants, animaux, parade, cuisine, interface.

## 2026-11-19 (après-midi) — Lot 2b et début de la vie du village

Branche `autonome/2026-11-19-soir`, **fusionnée dans `main`** avec l'accord du concepteur. 557 tests, build OK. Histoire validée (`docs/conception-histoire.md`). **Aucune relecture Opus pour cette série** : à faire en premier à la reprise.

Fait :
- **Formes d'armes par palier** : épée, hache et pioche ont chacune une silhouette propre, du cuivre au cristal lumineux.
- **Animaux** : cerf et lapin (fuient), renard (rare, la nuit), sanglier (charge si on le frappe, se pare au bouclier). Ils donnent viande, cuir et fourrure de renard.
- **Habitants visibles** : Gaspard, Marthe, Mathilde, Bertil, Hugo (village niveau 2), et Aldric l'ermite, à son feu à environ 230 m au sud. Routine selon l'heure : au travail le jour, à l'auberge le soir, chez eux la nuit. Ils se tournent vers le joueur.
- **Dialogues** : E pour parler. Les quêtes sont données et rendues en personne. Un « ! » au-dessus de la tête signale une quête à prendre, un « ? » une quête à rendre. Chaque habitant a sa voix.
- **Cuisine** au feu (posé ou de la place) : viande cuite, ragoût. Un clic sur l'aliment dans l'inventaire pour manger. **Pièges** sur la case 4 (rappuyer sur 4 alterne pousse et piège). Quêtes 5 à 7 de Marthe.
- **Arc** sur la case 6 : clic maintenu pour tendre, relâcher pour tirer, flèches à fabriquer. Nouvelle branche **Chasse** dans l'arbre.
- Conception de l'**histoire** : `docs/conception-histoire.md` (légende du Cœur de Castal, 4 actes, village vivant, événements). **À valider par le concepteur.**

### À tester
1. Aller sur la place le jour : parler à Gaspard (E), accepter une quête, puis revenir la rendre.
2. Aller voir Aldric au sud (environ 230 m), le soir comme le jour.
3. Chasse : un lapin à l'arc (fabriquer l'arc à l'établi après le nœud Tir à l'arc), puis un sanglier à l'épée et au bouclier.
4. Poser un piège en prairie et revenir quelques minutes plus tard.
5. Cuisiner la viande au feu de la place, puis la manger depuis l'inventaire.

### Reprise (dans l'ordre)
1. Relecture Opus de tout le palier 2, puis corrections.
2. Selon les réponses du concepteur sur l'histoire : chaîne principale (prologue, actes, objectif affiché), marchand ambulant, attaques de bandits.
3. Lot 2c : lieux et chefs (images prêtes : camp, tanière, ruines, autel, mine de lave, chef des bandits, loup alpha).

### Défauts et points connus
- Pas encore de relecture.
- Le cerf mériterait une seconde passe de modelage.
- Marthe est une femme alors que l'image montre un homme moustachu : à trancher.
- Aldric n'a pas de collision.
- Avec l'arc en main, le sort part de la main qui tient l'arc.

## 2026-11-19 (soir) — Palier 2 : lot 2a fait, lot 2b commencé ; session interrompue

Branche `autonome/2026-11-19-soir` (**pas encore fusionnée** dans `main`). 451 tests, build OK. Conception du contenu : `docs/conception-palier2.md`.

Fait :
- Torche sur la case 5 (aura de lumière), fourrure du loup, mini-carte (à gauche, taille au choix, M pour l'agrandir, « Maison » dans la maison).
- 30 nouveaux prompts d'images (série 2) ; une vingtaine d'images ont été réalisées par le concepteur.
- **Lot 2a** : cuivre, charbon, acier ; outils et armures par palier ; verrous de pioche ; **vrai arbre de compétences** (5 branches, 24 nœuds, points rendus) ; **25 quêtes en 4 chaînes** (Gaspard, le forgeron, Marthe, Mathilde ; fil rouge des bandits) ; **bouclier** (clic droit avec l'épée), parade réussie, Riposte, Coup puissant, sort **Barrière** (C).
- **Lot 2b** : **maison du joueur** (on entre par la porte ; lit, coffre partagé avec le village, cheminée).

### Reprise après l'interruption (dans l'ordre)
1. Animaux : cerf, lapin, renard, sanglier (Fable, d'après les images ; comportements fuite et charge ; viande, cuir, fourrure de renard).
2. Formes des épées, haches et pioches par palier (Fable, images « Cinq épées » et « Haches et pioches »).
3. Arc et flèches (case 6), puis pièges et cuisine, quêtes 5 à 7 de Marthe (Sonnet).
4. Relecture Opus de tout le palier 2, puis test par le concepteur et fusion.
5. Lot 2c : lieux (camp de bandits, tanière, ruines, autel, mine de lave) et chefs.

Les deux agents du lot 2b ont été arrêtés avant d'écrire quoi que ce soit : rien n'est perdu, la branche est propre.

### À tester
1. Échap : taille de la mini-carte ; M : grande carte.
2. 5 : torche, la nuit.
3. K : l'arbre de compétences (points rendus si des points étaient déjà dépensés).
4. Panneau d'annonces : les 4 chaînes de quêtes ; forge : cuivre, puis fer (il faut du charbon), puis acier (village niveau 2).
5. Avec la compétence Parade, fabriquer un bouclier en bois (établi), prendre l'épée, clic droit maintenu face à un gobelin juste avant son coup.
6. Entrer dans la maison du joueur (la maison au potager, près de la place) et dormir dans le lit.

### Questions en attente
- La compétence Riposte est dans la branche Combat mais ne sert qu'après une parade (branche Défense) : la déplacer sous Parade ?
- Amélioration du village : la quête de Gaspard demande 30 bois et 20 pierres, puis l'amélioration coûte encore 40 bois, 30 pierres et 10 or. Trop lourd ?
- Avec Coup puissant, maintenir le clic avec l'épée charge le coup au lieu de répéter les frappes : à conserver ?

## 2026-11-19 (journée) — Retours du concepteur, commandes, loup et bandit, grand passage de modélisation

Le concepteur a testé le matin : **1re personne retenue** pour l'instant (la 3e personne sera embellie plus tard). Branche de nuit fusionnée dans `main` avec son accord. Travail du jour sur `autonome/2026-11-19-jour` (18 commits, **pas encore fusionnée**). 329 tests, build OK, relecture Opus puis 4 corrections.

Fait :
- Sensibilité de la souris (menu Échap) ; les sauts de souris faux de Chrome sont ignorés (cause probable du « personnage qui tourne d'un coup tout seul »).
- `main.ts` découpé en 19 modules dans `src/jeu/` (comportement identique).
- Commandes : **Tab** inventaire ; **barre d'outils** 1 épée, 2 hache, 3 pioche, 4 pousses (molette pour passer de l'une à l'autre) ; **sorts sur A (boule de feu) et X (soin)**, C réservé au 3e sort.
- **Loup** (forêt et montagne, plus fréquent la nuit) et **bandit** (rare, à plus de 120 m du village), modèles d'après les images.
- **Grand passage de modélisation** (Fable) d'après toutes les images : bras et outils en 1re personne, arbres, rochers, filons, buissons, plantes, tout le village, souche et bûches, mine, pousse tenue en main.
- Second retour du concepteur : **vue diagonale supprimée** (V alterne 1re et 3e personne, départ en 1re) ; main gauche de l'épée repliée vers l'intérieur ; tranchant de la hache vers le centre de l'écran ; épée, hache et pioche plus détaillées (cuir, rivets, biseaux).
- **Sorts animés avec la main gauche** : flamme qui grossit dans la paume puis poussée (boule de feu, départ 0,2 s après la touche) ; main ramenée vers la poitrine avec lueur verte (soin).
- **Durabilité** de l'épée, de la hache et de la pioche sous leurs cases de la barre (vert, orange, rouge clignotant à 0).
- Nuit plus sombre ; plus de saccade en posant un feu ; butin en trop laissé au sol dans un petit sac (E) ; aide en deux colonnes ; options graphiques (distance de vue, ombres, images/s) dans le menu Échap.

### À tester
1. 1re personne : 1, 2, 3, 4 et la molette changent l'objet tenu ; la barre en bas suit. Regarder la main gauche avec l'épée et la hache (tranchant vers le centre).
2. Couper un arbre à l'épée (lent) puis à la hache ; taper un slime à la hache (3 fois moins fort).
3. A et X : sorts (après avoir pris Magie avec K), l'épée en main : regarder la main gauche. Frapper un arbre à la hache : sa jauge de durabilité baisse.
4. Tab : inventaire.
5. Échap : sensibilité, distance de vue, ombres. Signaler si le personnage tourne encore tout seul, et à quel moment.
6. Se promener en forêt la nuit (T maintenue) : loup ; plus loin du village : bandit.
7. Regarder le village, la forge, l'auberge, le puits et la mine de près.
8. P (pilote) avec la pioche en main, puis P de nouveau : la pioche doit revenir en main.

### Décisions provisoires (à valider)
- Changement d'outil **manuel** (le choix automatique existe encore : `CONFIG.commandes.outilAutomatique`) ; mauvais outil = 1/3 des dégâts.
- Sorts : A = boule de feu, X = soin, C = futur 3e sort.
- Loup et bandit pris sur la part des slimes et gobelins (densité totale inchangée).
- Butin en trop : petit sac au sol 5 minutes, non sauvegardé.

### Questions en attente
- **Le loup ne laisse rien** en mourant : faut-il une ressource (fourrure, cuir) pour une armure plus tard ?
- La motte de la pousse en main paraît un peu grosse : à juger.

### Défauts et points connus
- Première entrée dans la mine : petit à-coup possible (compilation de ses matériaux).
- Les racines des chênes dépassent un peu de leur cercle de collision.
- Personnage en 3e personne pas retouché (volontaire).
- Premier sort d'une partie : petit à-coup possible (préparation de l'effet).
- Hache levée : sa tête sort presque du haut de l'écran un court instant pendant la frappe.
- Chaque outil a maintenant une vingtaine de petites pièces : à surveiller si les images par seconde baissent.

## 2026-11-19 (fin de nuit, 4 h 45) — Bilan de la session de nuit

**Tout le plan de la nuit est fait**, sur la branche `autonome/2026-11-19` (20 commits, pas encore fusionnée dans `main`). 306 tests, build OK. Relecture complète (Opus) puis 7 corrections.

Fait : récolte (4), jour/nuit et aide (5, 6), inventaire et sac magique (10), sauvegarde et menu (11), repousse et replantation (12), village en 3 niveaux (14, Fable), fabrication (15), combat slime et gobelin (16, Fable), mort douce (17), XP, compétences et sorts (18), quêtes et amélioration du village (19), mine (20, Fable), auberge, feu de camp, pilote automatique (21).

### À tester (dans l'ordre, environ 30 min)
Lancer : `npm run dev` dans le dossier du projet, puis http://localhost:5175. H affiche toutes les touches.

1. **Les trois vues** (V) : laquelle est préférée ? C'est la décision principale du prototype.
2. Couper un arbre (clic maintenu en le visant), casser un rocher : la hache et la pioche viennent seules en main.
3. I : inventaire ; clic sur une pile pour la passer dans le sac magique.
4. Au village : E devant le panneau d'annonces (quêtes), l'établi, le forgeron (forge), le coffre.
5. Clic droit avec une pousse d'arbre : planter. T maintenue : le temps file, la pousse grandit, la nuit tombe.
6. Sortir du village : slimes et gobelins. Le gobelin lève son gourdin avant de frapper : reculer pour esquiver. R : potion.
7. Mourir une fois : le baluchon reste sur place, la boussole en haut le montre, E pour le récupérer.
8. K : compétences (Magie → touches 1 et 2 pour les sorts).
9. La boussole mène à la **mine** (environ 170 m) : E à l'entrée, cristaux bleus au fond.
10. G avec un kit de feu de camp, E pour se reposer ; P : pilote automatique.
11. F6 (outil de test) : voir les 3 niveaux du village sans les sauvegarder.

### Décisions provisoires prises pendant la nuit (à valider ou changer)
- Sac magique utilisable partout (il est magique). Inventaire porté 16 cases, sac 6, coffre 24.
- Recettes : établi (armure de fibres, potion, kit de feu, sacoche), forge (lingot, hache, pioche, épée en fer).
- Courbe d'XP réglée pour environ 1 h jusqu'au niveau 5 (niveau 2 en 4 à 6 min).
- Ennemis : densité peut-être trop forte (10 autour du joueur en forêt) ; à juger en jouant.
- Auberges hors du village : reportées. Loup et bandit : en attente des images.

### Défauts et points connus
- La nuit reste un peu claire au sol.
- `main.ts` est devenu très gros (environ 1 900 lignes) : un découpage est à prévoir (refactoreur, Sonnet).
- Petites saccades possibles quand une lumière apparaît (feu posé, passage de la mine).
- La souche reste dans un arbre qui a repoussé ; butin d'ennemi perdu si inventaire ET sac sont pleins.
- Images arrivées après l'étape 3 (« Quatre rochers fantasy », « Bois et pierres ») pas encore utilisées pour retoucher les rochers.
- Incident : vers 3 h 50, un agent a fermé tous les navigateurs Chrome ouverts pour arrêter son navigateur de test (interdit ensuite).

## 2026-11-19 (nuit) — Session autonome validée par le concepteur

Le concepteur a validé le 19/11 le lancement d'une session de nuit, à pousser aussi loin que possible ; vérification prévue vers 8 h. Il a autorisé à continuer la V1 sans attendre son test du prototype (les trois vues restent actives). Contrôles : ZQSD (codes physiques, AZERTY OK).

Plan, dans l'ordre, une étape après l'autre (toutes touchent `main.ts`), un commit par étape sur `autonome/2026-11-19`, vérification par la session principale (tests, build, capture) après chaque étape :

1. 3a décor + 3b personnage (Fable) — fait
2. 4 récolte (Sonnet)
3. 5 + 6 jour/nuit, aide des touches (Sonnet)
4. 10 inventaire + sac magique, 11 sauvegarde, 12 repousse et replantation (Sonnet)
5. 14 village d'après les images (Fable)
6. 15 craft + écran d'inventaire d'après l'image (Sonnet)
7. 16 combat au clic avec slime et gobelin, le loup attend son image (Fable)
8. 17 mort douce, 18 XP et sorts, 19 quêtes, 21 auberge, feu de camp, pilote auto (Sonnet)
9. 20 grotte ou mine (Fable)
10. relecture complète (Opus) puis corrections

Règles : si Fable n'est pas disponible, l'étape passe sur Opus. Pas de téléchargement de pack (accord du concepteur requis). Images manquantes : loup, bandit (à produire par le concepteur le lendemain).

## 2026-11-19 — Lancement du projet

- Questionnaire rempli par le concepteur, cahier des charges 3D écrit, feuille de route découpée avec un modèle par étape.
- Nom provisoire Castalrock adopté ; ancien document 2D archivé dans `docs/archives/`.
