// Toutes les valeurs réglables du jeu.

// Taille d'un morceau de terrain (chunk), en mètres
const tailleChunk = 64;
// Rayon de chargement autour du joueur, en nombre de chunks
const rayonChargement = 6;
// Distance minimale garantie de terrain chargé dans toutes les directions, en mètres
const porteeMonde = (rayonChargement - 0.5) * tailleChunk;
// Couleurs du jour, partagées entre l'éclairage de départ et la palette du cycle jour/nuit
const cielJour = 0x8cc6ee;
const hemiCielJour = 0xdcefff;
const hemiSolJour = 0x8f9470;
// Couleurs et force de la nuit : sombre au sol, mais bleutée et lisible (silhouettes des arbres à 15 m)
const cielNuit = 0x0e1a44;
const hemiCielNuit = 0x7f98f0;
const hemiSolNuit = 0x2c386e;
const intensiteHemiNuit = 0.42;
// Durée d'une journée complète du jeu, en secondes réelles (sert aussi aux délais de repousse)
const dureeJour = 20 * 60;
// Résolution de la carte d'ombres (réglage « ombres hautes » : celui d'origine)
const resolutionOmbresHautes = 2048;

export const CONFIG = {
  // Graine du monde : même graine = même monde
  graine: 12345,
  // Champ de vision vertical de la caméra, en degrés
  champDeVision: 60,
  // Distance maximale d'affichage, en mètres (cohérente avec le brouillard)
  distanceMax: Math.round(porteeMonde),
  // Plus grand pas de temps accepté par la boucle, en secondes
  pasMaxDt: 0.1,

  // Couleur du ciel (aussi celle du brouillard)
  couleurCiel: cielJour,
  // Brouillard : commence à `debut` mètres, opaque à `fin` mètres (masque le bord du monde chargé)
  brouillard: {
    // Parts de la portée du monde chargé (réglage « distance de vue », src/regles/affichage.ts)
    partDebut: 0.5,
    partFin: 0.96,
    debut: Math.round(porteeMonde * 0.5),
    fin: Math.round(porteeMonde * 0.96),
  },

  // Options graphiques du menu pause (réglages gardés dans le navigateur, src/moteur/reglages.ts)
  graphismes: {
    // Distance de vue : rayon de chargement des chunks pour chaque choix (la moyenne est le réglage d'origine)
    distanceVue: { defaut: 'moyenne', rayons: { courte: 4, moyenne: rayonChargement, longue: 8 } },
    // Ombres : résolution de la carte d'ombres (0 = pas d'ombres) pour chaque choix
    ombres: { defaut: 'hautes', resolutions: { aucune: 0, moyennes: 1024, hautes: resolutionOmbresHautes } },
    // Compteur d'images par seconde affiché au lancement
    imagesParSecondeDefaut: false,
  },

  monde: {
    tailleChunk,
    rayonChargement,
    // Chunks déchargés au-delà de ce rayon (un peu plus grand pour éviter les allers-retours)
    rayonDechargement: rayonChargement + 1.5,
    // Nombre maximal de chunks construits par image (évite les saccades)
    chunksParImage: 2,
    // Pas de la grille du terrain, en mètres (doit diviser tailleChunk)
    pasGrille: 2,
    // Altitude de la surface de l'eau, en mètres
    niveauEau: 0,

    village: {
      // Disque aplani autour de l'origine
      rayon: 40,
      // Largeur du raccord progressif avec le terrain autour
      raccord: 30,
      // Altitude du sol du village
      altitude: 6,
      // Au-delà du raccord : zone sans rivière, lac ni falaise
      zoneProtegee: 90,
      // Rayon de la zone forcée en prairie autour du village
      zonePrairie: 200,
    },

    relief: {
      // Collines douces (tous biomes)
      frequenceCollines: 0.005,
      frequenceDetail: 0.03,
      // Biomes : la carte des climats varie sur quelques centaines de mètres (régions de 300 à 600 m)
      frequenceClimat: 0.0016,
      // Largeur des transitions entre biomes (plus petit = frontières plus nettes)
      etalementBiomes: 0.06,
      // Même chose pour le mélange du relief : plus large, pour des pentes franchissables
      etalementRelief: 0.3,
      // Montagnes : crêtes (bruit « crête »)
      frequenceMontagnes: 0.0025,
      octavesMontagnes: 3,
      // Hauteur ajoutée au sommet des crêtes, en mètres
      hauteurMontagnes: 120,
      // Exposant appliqué à la crête : plus grand = pentes basses plus douces, sommets plus pointus
      formeMontagnes: 1.6,
      // Falaises : marches brusques le long de lignes sinueuses
      frequenceFalaises: 0.006,
      hauteurFalaise: 11,
      // Demi-largeur de la marche, en unités de bruit (plus petit = plus vertical)
      raideurFalaise: 0.012,
      // Rivières : vallées creusées par un bruit « crête » (largeurs en unités de bruit)
      frequenceRivieres: 0.0022,
      largeurLit: 0.05,
      largeurVallee: 0.28,
      profondeurRiviere: 2.5,
      // Lacs
      frequenceLacs: 0.002,
      seuilLacs: 0.33,
      profondeurLacs: 4,
    },
  },

  // Couleurs du sol hors biome (les couleurs des biomes sont dans src/monde/biomes.ts)
  couleurs: {
    sable: 0xd9c58f,
    sableMouille: 0x9c8c62,
    neige: 0xf0f4f8,
    eau: 0x33bde0,
    // Altitude à partir de laquelle la neige apparaît, en mètres
    altitudeNeige: 85,
    // Variation de luminosité d'une face à l'autre (0 = aucune)
    variationFaces: 0.08,
    // Grandes plages d'herbe plus claires ou plus sombres (0 = herbe uniforme)
    variationHerbe: 0.16,
    // Taille de ces plages : fréquence du bruit, en 1/mètre
    frequenceVariationHerbe: 0.018,
  },

  eau: {
    opacite: 0.84,
    // Taille d'une case du plan d'eau, en mètres
    pasGrille: 8,
    // Ondulation : hauteur en mètres et vitesse
    amplitudeVagues: 0.12,
    vitesseVagues: 1.2,
  },

  lumiere: {
    couleurCielHemi: hemiCielJour,
    // Lumière renvoyée par le sol : assez claire pour que la roche à l'ombre reste lisible
    couleurSolHemi: hemiSolJour,
    intensiteHemi: 1.3,
    couleurSoleil: 0xffe8c2,
    intensiteSoleil: 2.3,
    // Direction de départ du soleil (le cycle jour/nuit la remplace à chaque image)
    directionSoleil: { x: 0.5, y: 0.8, z: 0.35 },
    // Demi-côté de la zone qui reçoit les ombres, autour de la caméra, en mètres
    tailleOmbres: 70,
    resolutionOmbres: resolutionOmbresHautes,
  },

  // Temps du jeu : règles dans src/regles/temps.ts. Les heures vont de 0 à 24.
  // Nuit = de debutNuit à debutAube (6 h = un quart de la journée) ;
  // aube = lumière qui monte, crépuscule = lumière qui baisse.
  temps: {
    // Durée d'une journée complète du jeu (24 h), en secondes réelles
    dureeJourSecondes: dureeJour,
    // Heure au lancement du jeu
    heureDepart: 8,
    debutAube: 3,
    debutJour: 7,
    debutCrepuscule: 17,
    debutNuit: 21,
    // Touche T maintenue : le temps passe ce nombre de fois plus vite
    facteurAcceleration: 60,
  },

  // Rendu du cycle jour/nuit : src/scene/cycleJour.ts
  cycleJour: {
    // Le soleil franchit l'horizon à ces heures (jour plus long que la nuit) ; la lune fait l'inverse
    heureLever: 5,
    heureCoucher: 19,
    // Décalage du trajet vers le nord/sud (0 = plein est-ouest) : évite des ombres rasantes
    inclinaison: 0.35,
    // Soleil : couleur près de l'horizon et en hauteur, intensité, hauteur (0 à 1) à partir de laquelle il est « haut »
    couleurSoleilBas: 0xff9a4d,
    couleurSoleilHaut: 0xffe8c2,
    intensiteSoleil: 2.3,
    hauteurSoleilHaut: 0.45,
    // Lune : lumière bleutée qui garde le monde lisible
    couleurLune: 0x9db6ff,
    intensiteLune: 0.6,
    // Astres dessinés dans le ciel : distance, rayons (mètres) et couleurs
    distanceCiel: 330,
    rayonSoleil: 16,
    rayonLune: 14,
    couleurDisqueSoleil: 0xfff2c8,
    couleurDisqueLune: 0xf4f2e2,
    couleurHaloLune: 0xaec4ff,
    // Étoiles : nombre, taille en pixels, graine du tirage
    nombreEtoiles: 900,
    tailleEtoiles: 2,
    graineEtoiles: 777,
    // Part de la couleur du ciel ajoutée à l'eau comme lueur propre (reflet du ciel)
    reflet: 0.28,
    // Palette selon l'heure (interpolée entre deux repères). Le ciel donne aussi la couleur du brouillard.
    palette: [
      { heure: 0, ciel: cielNuit, hemiCiel: hemiCielNuit, hemiSol: hemiSolNuit, intensiteHemi: intensiteHemiNuit },
      { heure: 3, ciel: cielNuit, hemiCiel: hemiCielNuit, hemiSol: hemiSolNuit, intensiteHemi: intensiteHemiNuit },
      { heure: 5, ciel: 0xe9a58a, hemiCiel: 0xffd9bd, hemiSol: 0x7d7664, intensiteHemi: 1.15 },
      { heure: 7, ciel: cielJour, hemiCiel: hemiCielJour, hemiSol: hemiSolJour, intensiteHemi: 1.3 },
      { heure: 17, ciel: cielJour, hemiCiel: hemiCielJour, hemiSol: hemiSolJour, intensiteHemi: 1.3 },
      { heure: 19, ciel: 0xee8a5e, hemiCiel: 0xffc9a0, hemiSol: 0x7a6a58, intensiteHemi: 1.15 },
      { heure: 21, ciel: cielNuit, hemiCiel: hemiCielNuit, hemiSol: hemiSolNuit, intensiteHemi: intensiteHemiNuit },
      { heure: 24, ciel: cielNuit, hemiCiel: hemiCielNuit, hemiSol: hemiSolNuit, intensiteHemi: intensiteHemiNuit },
    ],
  },

  // Aide des touches (touche H) : affichée seule au premier lancement
  aide: {
    // Durée maximale de l'affichage automatique, en secondes (il s'arrête aussi au premier mouvement)
    dureeAutoSecondes: 12,
  },

  // Inventaire : règles dans src/regles/inventaire.ts, écran dans src/ui/ecranInventaire.ts
  inventaire: {
    // Cases de l'inventaire porté (c'est ce qu'on perdra à la mort)
    casesPorte: 16,
    // Cases du sac magique au départ (il grandira plus tard ; jamais perdu)
    casesSac: 6,
    // Taille maximale d'une pile par case, pour un objet qui n'a pas la sienne
    pileMax: 50,
    // Coffre du village : nombre de cases
    casesCoffre: 24,
  },

  // Fabrication : recettes dans src/regles/fabrication.ts, équipement dans src/regles/equipement.ts
  fabrication: {
    // Paliers des outils et armes (épée, hache, pioche) : facteur de dégâts par rapport à la base, durabilité max.
    // Le cristal se forge une fois qu'Aldric a expliqué les cristaux bleus (acte III, recettes dans src/regles/fabrication.ts).
    paliers: {
      base: { degats: 1, durabilite: 100 },
      cuivre: { degats: 1.3, durabilite: 150 },
      fer: { degats: 1.6, durabilite: 200 },
      acier: { degats: 2, durabilite: 300 },
      cristal: { degats: 2.5, durabilite: 400 },
    },
    // Village niveau minimum pour fabriquer à l'acier
    villageAcier: 2,
    // Cases ajoutées à l'inventaire porté par la sacoche en fibres (une seule fois)
    casesSacoche: 4,
  },

  // Durabilité de l'équipement (outils et armure) : règles dans src/regles/equipement.ts.
  // Rien ne casse : à zéro, l'objet marche avec `efficaciteUsee` de son efficacité.
  durabilite: {
    max: 100,
    // Efficacité (dégâts ou protection) d'un objet à zéro de durabilité
    efficaciteUsee: 0.5,
    // Message « s'émousse » quand la durabilité passe sous cette part du maximum
    seuilAlerte: 0.2,
    // Usure de tout l'équipement à chaque mort
    usureMort: 10,
    // Réparation à la forge : coût d'une réparation complète (proportionnel à l'usure, arrondi au supérieur, minimum 1)
    reparationOutil: {
      base: { objet: 'bois', quantite: 3 },
      cuivre: { objet: 'lingot-cuivre', quantite: 1 },
      fer: { objet: 'lingot-fer', quantite: 1 },
      acier: { objet: 'lingot-acier', quantite: 1 },
      cristal: { objet: 'cristal-bleu', quantite: 2 },
    },
    reparationArmure: {
      fibres: { objet: 'fibres', quantite: 4 },
      cuir: { objet: 'cuir', quantite: 3 },
      fourrure: { objet: 'fourrure', quantite: 2 },
      mailles: { objet: 'lingot-fer', quantite: 2 },
      plaques: { objet: 'lingot-acier', quantite: 2 },
    },
  },

  // Mort douce : règles dans src/regles/mort.ts, modèle dans src/scene/modeleBaluchon.ts.
  mort: {
    // Distance maximale (m) pour récupérer le baluchon avec E
    porteeBaluchon: 2.5,
    // Rayon de lumière vers le ciel : hauteur (m), rayon (m) et opacité
    hauteurRayon: 14,
    rayonRayon: 0.55,
    opaciteRayon: 0.28,
    // Message affiché à la mort
    message: 'Vos affaires sont restées là où vous êtes tombé',
  },

  // Butin d'ennemi qui ne rentre ni dans l'inventaire ni dans le sac : il reste au sol dans un petit sac
  // (src/jeu/butinSol.ts), qu'on ramasse avec E. Il n'est pas sauvegardé.
  butinSol: {
    // Distance maximale (m) pour le ramasser avec E
    portee: 2.5,
    // Durée de vie du sac au sol, en secondes de jeu (5 minutes)
    dureeVie: 300,
    // Taille du modèle par rapport au baluchon
    echelle: 0.6,
    // Nombre maximal de sacs au sol (le plus ancien disparaît)
    maximum: 12,
  },

  // Campement : auberge et feu de camp posable (touche G). Règles dans src/regles/campement.ts,
  // modèle du feu dans src/scene/feuCamp.ts.
  campement: {
    // Pose du feu : distance devant le personnage (m), et distance minimale entre le feu et un arbre ou obstacle (bords compris)
    distancePoseFeu: 1.6,
    distanceMiniVoisinFeu: 2,
    // Où le joueur réapparaît par rapport au centre du feu (m, vers le sud) ; devant la porte de l'auberge (m au-delà de la façade)
    decalageReapparitionFeu: 1.3,
    distanceReapparitionAuberge: 1.6,
    // Repos la nuit : de heureDebutNuit à heureFinNuit (heures du jeu, la nuit passe minuit), le temps saute jusqu'à heureReveil
    heureDebutNuit: 20,
    heureFinNuit: 6,
    heureReveil: 7,
    // Fondu au noir du repos : durée de chaque moitié (fermeture, puis ouverture), en millisecondes
    dureeFonduMs: 500,
    // Feu posé : taille du modèle (1 = feu du village), rayon d'obstacle (m) et part de la lumière du feu du village
    echelleFeu: 0.7,
    rayonObstacleFeu: 0.45,
    partLumiereFeu: 0.6,
  },

  // Cuisine (src/regles/cuisine.ts) : ce que rend chaque aliment quand on le mange (clic dans l'inventaire).
  // `soin` : points de vie rendus tout de suite ; puis `regenParSeconde` PV/s pendant `regenDuree` secondes (0 : pas de régénération).
  cuisine: {
    aliments: {
      'viande-crue': { soin: 5, regenParSeconde: 0, regenDuree: 0 },
      'viande-cuite': { soin: 20, regenParSeconde: 1, regenDuree: 20 },
      ragout: { soin: 40, regenParSeconde: 2, regenDuree: 30 },
    } as Readonly<Record<string, { soin: number; regenParSeconde: number; regenDuree: number }>>,
  },

  // Pièges (src/regles/pieges.ts) : posés avec la case 6 (touche 6 de nouveau pour passer des pousses au piège).
  // Un piège attrape une proie entre `delaiMin` et `delaiMax` secondes de jeu après sa pose (ou sa relève) :
  // un renard avec la chance `chanceRenard`, sinon un lapin. `distancePose` : distance devant le personnage (m),
  // `distanceMiniEntrePieges` : écart minimal entre deux pièges (m), `porteeReleve` : portée de la touche E (m, du centre).
  pieges: {
    max: 5,
    delaiMin: 120,
    delaiMax: 300,
    chanceRenard: 0.15,
    distancePose: 1.6,
    distanceMiniEntrePieges: 2.5,
    porteeReleve: 1.8,
    biomesAutorises: ['prairie', 'foret'] as readonly string[],
    echelleModele: 1,
  },

  // Pilote automatique (touche P) : règles dans src/regles/pilote.ts.
  pilote: {
    // Zone de travail : rayon du cercle autour de la position à l'activation (m)
    rayonZone: 25,
    // Tout va 10 % plus lentement qu'en jeu actif : vitesse de marche et cadence de frappe (1 = comme le joueur)
    facteurLenteur: 0.9,
    // Arrêt quand la vie passe sous cette part de la vie maximale
    seuilVie: 0.3,
    // Cible abandonnée si la distance ne diminue pas d'au moins `progresMini` m pendant `delaiBlocage` s
    delaiBlocage: 3,
    progresMini: 0.25,
    // Il frappe quand la cible est à moins de (portée - marge) m : évite de frapper juste à la limite
    margePortee: 0.3,
  },

  // Village : description dans src/regles/village.ts, modèles dans src/scene/modelesVillage.ts
  village: {
    // Interaction (touche E) : distance maximale au bord de l'objet, en mètres
    porteeInteraction: 2.5,
    // Demi-angle dans lequel il faut regarder l'objet, en degrés
    angleRegardDegres: 55,
    // Forgeron : nombre de coups de marteau par série, durée d'un coup et pause entre deux séries, en secondes
    coupsForgeron: 3,
    dureeCoupForgeron: 0.9,
    pauseForgeron: 3.5,
    // Lumière du feu de camp et du foyer de la forge : intensité de jour et de nuit
    lumiereFeuJour: 4,
    lumiereFeuNuit: 26,
    // XP gagnée à chaque amélioration du village
    xpAmelioration: 150,
  },

  // Quêtes des villageois (panneau d'annonces) : règles dans src/regles/quetes.ts
  quetes: {
    // Quêtes proposées en même temps au plus (en cours comprises) : la prochaine de chacune des 4 chaînes
    proposeesMax: 4,
  },

  // Potager de la maison du joueur (src/regles/potager.ts) : arrosé le jour J, il donne sa récolte à partir du jour J+1
  potager: {
    baies: { min: 2, max: 3 },
    plantes: { min: 1, max: 2 },
  },

  // Sauvegarde dans le navigateur : règles dans src/regles/sauvegarde.ts, stockage dans src/moteur/stockage.ts
  sauvegarde: {
    cle: 'castalrock.sauvegarde',
    // Sauvegarde automatique toutes les N secondes de jeu réelles
    intervalleSecondes: 30,
    // Durée d'affichage du message « Partie sauvegardée », en millisecondes
    dureeMessage: 1800,
  },

  // Décor du monde (arbres, rochers, ressources) : voir src/monde/decor.ts
  decor: {
    // Taille des cases de placement, en mètres : au plus un élément par case (doit diviser tailleChunk)
    tailleCase: 4,
    // Cases plus fines pour les herbes décoratives
    tailleCaseHerbe: 2,
    // Aucun décor à moins de (rayon du village + cette marge) de l'origine, en mètres
    margeVillage: 6,
    // Hauteur minimale au-dessus de l'eau pour porter du décor, en mètres
    margeEau: 0.35,
    // Pente maximale (0 = plat, 1 = vertical) ; les rochers et filons acceptent toutes les pentes
    penteMax: 0.36,
    // Plus d'arbres ni de plantes au-dessus de cette altitude, en mètres
    altitudeMaxVegetation: 72,
    // Bosquets et clairières : taille (fréquence du bruit, en 1/mètre)
    frequenceBosquets: 0.011,
    // Prairie : densité d'arbres hors bosquet (facteur) et dans un bosquet (facteur ajouté)
    bosquetBase: 0.12,
    bosquetBonus: 5,
    // Forêt : part des arbres retirée au cœur d'une clairière (0 à 1)
    clairieres: 0.92,
    // Nombre moyen d'éléments pour 1000 m², par biome
    densites: {
      prairie: {
        'arbre-feuillu': 1.3, sapin: 0.5, bouleau: 0.9, rocher: 0.8, 'filon-fer': 0.05,
        'buisson-baies': 0.8, 'plante-medicinale': 0.5, fibres: 1.6, herbe: 110,
        'filon-cuivre': 0.3, 'filon-charbon': 0,
      },
      foret: {
        'arbre-feuillu': 11, sapin: 13, bouleau: 4, rocher: 1.2, 'filon-fer': 0.1,
        'buisson-baies': 1.6, 'plante-medicinale': 0.9, fibres: 0.8, herbe: 60,
        'filon-cuivre': 0.4, 'filon-charbon': 0,
      },
      montagne: {
        'arbre-feuillu': 0, sapin: 1.8, bouleau: 0, rocher: 5.5, 'filon-fer': 0.9,
        'buisson-baies': 0.1, 'plante-medicinale': 0.2, fibres: 0.1, herbe: 15,
        'filon-cuivre': 0.9, 'filon-charbon': 0.8,
      },
      marais: {
        'arbre-feuillu': 0.9, sapin: 0, bouleau: 1.1, rocher: 0.3, 'filon-fer': 0,
        'buisson-baies': 0.3, 'plante-medicinale': 2.2, fibres: 3.5, herbe: 70,
        'filon-cuivre': 0, 'filon-charbon': 0,
      },
    },
    // Distance d'affichage, en chunks : herbes décoratives et petits éléments (buissons, plantes)
    rayonHerbe: 2,
    rayonPetits: 4,
    // Variation de teinte d'un élément à l'autre (0 = aucune)
    variationTeinte: 0.12,
    couleurs: {
      tronc: 0x9c6238,
      // Facettes plus claires de l'écorce
      troncClair: 0xb97a42,
      // Bois fraîchement coupé (dessus des souches, bouts des bûches)
      boisCoupe: 0xf0c48a,
      feuillage: 0x80c038,
      feuillageSombre: 0x6cae30,
      sapin: 0x2f7d3f,
      sapinClair: 0x3a8f48,
      // Dessous des étages du sapin, vu depuis le sol
      sapinDessous: 0x1f5a2d,
      ecorceBouleau: 0xeadcb6,
      marqueBouleau: 0x6b5138,
      feuillageBouleau: 0x9ad23c,
      rocher: 0xa29c9e,
      rocherSombre: 0x8b8589,
      // Coiffe de mousse de certains rochers
      mousse: 0x7fb23a,
      filon: 0x5b5760,
      minerai: 0xa3b9d4,
      // Filon de cuivre : roche rousse, veines et blocs orangés
      filonCuivre: 0x65574f,
      mineraiCuivre: 0xd9803f,
      // Filon de charbon : roche très sombre, blocs noirs mats
      filonCharbon: 0x3f3c43,
      mineraiCharbon: 0x16141a,
      buisson: 0x5fa838,
      buissonSombre: 0x4f9a35,
      baie: 0xd8343a,
      plante: 0x7cc23f,
      planteSombre: 0x5fa838,
      fleurPlante: 0xcba2ee,
      fibres: 0xdcc37e,
      lienFibres: 0xb07a4a,
      herbe: 0x8fca4a,
      fleurBlanche: 0xf6f3ea,
      fleurJaune: 0xf2cf4a,
    },
  },

  // Ruines et petites grottes semées dans tout le monde (session 3b). Placement et pièces : src/monde/ruines.ts
  // et src/monde/piecesRuines.ts ; coffres : src/regles/tresors.ts. Tout est tiré de la graine.
  ruines: {
    // Le monde est découpé en grandes cases : au plus un site de ruines par case (côté en mètres) ; part des cases tirées
    tailleCase: 150,
    probabilite: 0.9,
    // Rayon maximal d'un site, en mètres (les pièces tiennent dedans)
    rayonSite: 15,
    // Pas de ruine ni de grotte à moins de cette distance du centre du village, ni à moins de `margeLieux` du bord
    // des lieux déjà occupés (entrée de la mine, campement d'Aldric, camp des bandits, autel)
    distanceMinVillage: 110,
    margeLieux: 30,
    // Pas de ruine à moins de cette distance de l'origine de la mine ni de celle de la maison (zones intérieures, loin du monde)
    distanceZonesInterieures: 200,
    // Hauteur minimale du sol au-dessus de l'eau
    margeEau: 0.8,
    // Dénivelé toléré entre le centre du site et son pourtour, puis sous une pièce, en mètres
    deniveleMax: 2.2,
    deniveleMaxPiece: 1.0,
    // Nombre de pièces d'un site : poids de 1, 2, 3… pièces
    poidsNombrePieces: [2, 4, 4, 3, 2, 1],
    // Poids de chaque pièce au tirage
    poidsPieces: { muret: 30, colonnes: 22, arche: 15, tour: 10, maison: 14, avantPoste: 9 },
    // Part des sites de ruines (d'au moins deux pièces) qui cachent un petit coffre
    probabiliteCoffre: 0.45,
    grottes: {
      // Cases de recherche des petites grottes (au plus une par case), part des cases fouillées
      tailleCase: 128,
      probabilite: 0.55,
      // Paroi : montée minimale sur 4 m derrière le pied de la falaise, en mètres
      hauteurParoiMin: 4.5,
      // Profondeur, demi-largeur et hauteur de l'alcôve, en mètres
      profondeurMin: 4.6,
      profondeurMax: 6,
      demiLargeurMin: 1.6,
      demiLargeurMax: 2.1,
      hauteurMin: 2.5,
      hauteurMax: 3,
      // Cristaux bleus à récolter au fond
      cristauxMin: 2,
      cristauxMax: 3,
      probabiliteCoffre: 0.35,
      // Part des grottes dont l'entrée est étayée (poteaux, linteau, lanterne)
      probabiliteCharpente: 0.5,
    },
    coffre: {
      // Distance maximale (m) pour l'ouvrir avec E, rayon de collision, durée de l'ouverture du couvercle (s)
      portee: 2.3,
      rayon: 0.5,
      dureeOuverture: 0.7,
    },
    // Contenu d'un coffre : or toujours ; le reste selon sa chance (0 à 1), en quantité tirée entre min et max.
    // `chanceGrotte` : chance des cristaux dans un coffre de grotte.
    butin: {
      or: { min: 8, max: 30 },
      potion: { chance: 0.7, min: 1, max: 2 },
      cristaux: { chance: 0.25, chanceGrotte: 0.7, min: 1, max: 3 },
      lingotsCuivre: { chance: 0.3, min: 1, max: 3 },
      lingotsFer: { chance: 0.18, min: 1, max: 2 },
    },
    couleurs: {
      pierre: 0xa3a2a8, pierreClaire: 0xbdbcc0, pierreSombre: 0x86858e, dalle: 0x94919a,
      mousse: 0x86c232, lierre: 0x4f9a2c, bois: 0x7a4a2a, boisSombre: 0x4a3324,
      roche: 0xa8a199, rocheSombre: 0x4f4a55, rocheLueur: 0x3f5f86, terre: 0x6b5a4a,
      lanterne: 0xffc24a, cristal: 0x5fd0ff,
      coffre: 0xb8702f, coffreSombre: 0x7a4a22, fer: 0x5d5f66, ferClair: 0xd8b24a,
    },
  },

  // Repousse et plantation : règles dans src/regles/repousse.ts. Durées en secondes de temps de jeu.
  repousse: {
    // Rochers et filons : réapparaissent au même endroit après ce délai (1 journée de jeu)
    delaiRochers: dureeJour,
    // Buissons de baies (les baies reviennent), plantes médicinales et fibres : une demi-journée
    delaiBuissons: dureeJour / 2,
    delaiPlantes: dureeJour / 2,
    // Rochers, filons et cristaux de la mine (identifiants `m:<n>`) : un quart de journée
    delaiMine: dureeJour / 4,
    // Un élément ne réapparaît que si le personnage est plus loin que cette distance, en mètres
    distanceMiniJoueur: 25,
    // Vérification de la repousse et de la croissance : toutes les N secondes réelles
    intervalleVerification: 1,
    // Pousse d'arbre : durée de croissance totale (3 stades de même durée) et échelle de chaque stade
    dureeCroissance: dureeJour / 2,
    echellesStades: [0.18, 0.5, 1],
    // Plantation : portée depuis le personnage, et distance minimale entre deux arbres (bords compris), en mètres
    porteePlantation: 3,
    distanceMiniVoisin: 2.5,
  },

  personnage: {
    // Rayon du cercle de collision, en mètres
    rayon: 0.35,
    // Vitesses de marche et de course (Shift), en m/s
    vitesseMarche: 5,
    vitesseCourse: 8,
    // Accélération et freinage au sol, en m/s² (plus petit = plus doux, plus « glissant »)
    acceleration: 26,
    freinage: 22,
    // Part de contrôle conservée en l'air (0 = aucune, 1 = comme au sol)
    controleEnAir: 0.35,
    // Saut : vitesse verticale de départ (m/s) et gravité (m/s²) ; hauteur ≈ v² / (2 g) ≈ 1,1 m
    vitesseSaut: 6.6,
    gravite: 20,
    // Points sûrs (bouton « Je suis coincé ») : un point noté toutes les `intervalle` s au sol, `taille` points gardés ;
    // retour au plus récent point plus haut de `ecartHauteur` m, sinon à plus de `distanceMin` m, reculé de `recul` m
    pointSur: { intervalle: 1, taille: 30, ecartHauteur: 1.5, distanceMin: 8, recul: 1.5 },
    // Pente maximale gravissable, en degrés ; au-delà on ne monte pas et on glisse
    penteMaxDegres: 42,
    // Vitesse de glissade sur une pente trop raide, en m/s
    vitesseGlissade: 3.5,
    // Escalade (Espace maintenu face à une paroi plus raide que penteMaxDegres). Vitesses en m/s : montée et descente
    // à la verticale, déplacement de côté. `portee` : distance devant soi où la paroi est cherchée, en mètres.
    // `faceMin` : à quel point il faut lui faire face pour s'y accrocher (1 = pile en face, 0 = de profil) ;
    // `faceLacher` : une fois accroché, on ne lâche qu'en dessous (dos tourné).
    // `hauteurParPrise` : mètres parcourus pour un cycle des deux mains (cadence de l'animation) ;
    // `dureeRangement` : temps pour ranger l'outil et sortir les mains (et l'inverse), en secondes
    escalade: {
      vitesseMontee: 1.3,
      vitesseDescente: 1.6,
      vitesseCote: 0.9,
      portee: 0.8,
      faceMin: 0.45,
      faceLacher: -0.2,
      hauteurParPrise: 1.1,
      dureeRangement: 0.4,
    },
    // Distance sur laquelle la pente est mesurée, en mètres (lisse les petites facettes raides)
    baseMesurePente: 0.6,
    // Suivi du sol en descente : on reste collé tant que la chute sur un pas reste sous
    // (distance parcourue × penteAccroche + margeAccroche) ; au-delà on tombe (bord de falaise)
    penteAccroche: 1.5,
    margeAccroche: 0.15,
    // Eau : ralentissement maximal à pied (0.4 = 40 % plus lent juste avant de nager)
    freinEau: 0.4,
    // Profondeur à partir de laquelle on nage, en mètres
    profondeurNage: 1.2,
    vitesseNage: 2.2,
    // Hauteur des pieds sous la surface quand on nage, en mètres
    enfoncementNage: 1.1,
    // Rapidité de remontée à la surface (1/s)
    vitesseFlottaison: 6,
    // Rapidité avec laquelle le personnage se tourne (1/s ; plus grand = plus vif)
    vitesseRotation: 14,
    // Hauteur des yeux au-dessus des pieds, en mètres
    hauteurYeux: 1.62,
    frappe: {
      // Durée d'un geste complet, en secondes (se répète tant que le clic est maintenu)
      duree: 0.6,
      // Moment de l'impact dans le geste (0 à 1), et fin de l'armement (bras levé)
      instantImpact: 0.5,
      finArmement: 0.34,
    },
    // Micro-mouvements des bras en 1re personne (au repos, ils s'effacent pendant une frappe ou un sort) :
    // petits écarts lents et irréguliers pour que les mains ne paraissent pas figées
    microMouvements: {
      // Dérive de la main libre, en mètres, et de son poignet, en radians
      main: 0.012,
      poignet: 0.1,
      // Doigts de la main libre : jeu permanent, et repli plus marqué de temps en temps (radians)
      doigts: 0.12,
      repli: 0.35,
      // Outil tenu : dérive en mètres et petite rotation en radians
      outil: 0.004,
      rotationOutil: 0.018,
    },
    // Balancement des bras en 1re personne quand on marche ou court (au maximum à pleine vitesse de marche) :
    // la main libre va d'avant en arrière, l'outil à contretemps, comme des bras qui donnent de l'élan
    balancementBras: {
      // Course de la main libre d'avant en arrière, en mètres
      mainLibre: 0.07,
      // Course de l'outil, en mètres, et son inclinaison, en radians
      outil: 0.03,
      rotationOutil: 0.05,
    },
    couleurs: {
      peau: 0xe8b98f,
      cheveux: 0x6b4a2e,
      tunique: 0x5f8f6a,
      chemise: 0xdccfb0,
      pantalon: 0x77614c,
      ceinture: 0x4a3323,
      boucle: 0xd4b25a,
      bottes: 0x3f2d22,
      yeux: 0x2a2320,
      bois: 0x8a6238,
      fer: 0xaab3bb,
    },
  },

  // Commandes : barre d'outils (touches 1 à 5, molette) ; règles dans src/regles/barreOutils.ts, affichage dans src/ui/barreOutils.ts
  commandes: {
    // Vrai : l'outil se choisit tout seul devant un arbre, un rocher ou un ennemi (ancien comportement).
    // Faux : c'est le joueur qui choisit (le pilote automatique choisit toujours seul).
    outilAutomatique: false,
    // Barre d'outils : taille d'une case et écart entre cases, en pixels (le bas de l'écran est une colonne : voir colonneBas dans src/ui/theme.ts)
    barreOutils: {
      tailleCase: 62,
      ecart: 8,
    },
  },

  // Torche (case 5 de la barre d'outils) : aura chaude autour du joueur quand elle est en main.
  // La lumière existe dès le démarrage, éteinte (src/scene/torche.ts) : seule son intensité change.
  torche: {
    couleur: 0xffa64d,
    // Intensité en plein jour, en pleine nuit et dans la mine (où elle remplace la lampe du joueur)
    intensiteJour: 0.5,
    intensiteNuit: 2.6,
    intensiteMine: 2.2,
    // Rayon de l'aura, en mètres, et vitesse à laquelle la lumière faiblit avec la distance
    // (2 = lumière réelle, qui brûle les mains et n'éclaire pas loin ; moins = aura plus large et plus égale)
    rayon: 11.5,
    attenuation: 0.6,
    // Position de la lumière : hauteur au-dessus des pieds et avance devant le joueur, en mètres
    // (assez haut pour ne pas brûler les cheveux et les mains)
    hauteur: 2.7,
    avance: 0.3,
    // Scintillement : part de l'intensité qui varie (0 = lumière fixe) et vitesse
    scintillement: 0.12,
    vitesseScintillement: 9,
    // Durée d'allumage et d'extinction, en secondes
    dureeAllumage: 0.25,
  },

  // Récolte : règles dans src/regles/recolte.ts (points de vie et butins), effets dans src/scene/effetsRecolte.ts
  recolte: {
    // Portée de frappe, mesurée au sol entre le personnage et le bord de l'élément, en mètres
    portee: 2.5,
    // Part des dégâts faite par un outil non adapté (1/3 = trois fois plus de coups)
    facteurOutilInadapte: 1 / 3,
    // Nombre de choix automatiques de l'outil par seconde
    choixOutilParSeconde: 5,
    // Durée de la chute d'un arbre (chute puis disparition), en secondes
    dureeChuteArbre: 1.2,
    // Part de cette durée passée à tomber ; le reste sert à rétrécir
    partChute: 0.75,
    // Durée de vie des éclats et fragments, en secondes
    dureeEclats: 0.7,
    // Durée d'affichage du texte « +3 bois », en millisecondes
    dureeTexteButin: 1300,
    couleurReticule: 0xffffff,
    couleurReticuleCible: 0xffd04a,
  },

  // Progression : règles dans src/regles/progression.ts, écran dans src/ui/ecranCompetences.ts. Calibré le 20/11/2026 (niveau 8 vers 3 300 XP cumulés, 15 vers 14 600, 20 vers 28 400).
  progression: {
    // Niveau maximal (au-delà, l'expérience ne s'accumule plus)
    niveauMax: 30,
    // XP pour passer du niveau n au suivant = arrondi(coefficientXp × n ^ exposantXp)
    coefficientXp: 80,
    exposantXp: 1.25,
    // XP gagnée : élément détruit, ennemi tué, objet fabriqué, réparation
    xp: {
      arbre: 10,
      rocher: 10,
      filon: 15,
      cristal: 18,
      // Buisson, plante médicinale, fibres
      petitElement: 3,
      ennemis: { slime: 20, gobelin: 35, loup: 30, bandit: 50, morvan: 400 },
      fabrication: 8,
      reparation: 2,
    },
    // Arbre de compétences (src/regles/competences.ts) : valeurs des nœuds. Chaque nœud coûte 1 point.
    arbre: {
      // Combat
      lameAffutee: 0.15, // + part de dégâts à l'épée
      enchainement: 0.15, // + part de vitesse de frappe
      // Défense
      robustesse: 20, // + PV max
      peauDure: 0.1, // + réduction d'armure (en points de réduction, 0,10 = 10 %)
      // Récolte
      bucheron: 0.25, // + part de dégâts sur les arbres
      mineur: 0.25, // + part de dégâts sur les rochers et les filons
      cueilleur: 1, // + baies ou plantes par cueillette
      abondance: 0.2, // chance d'une unité de plus sur chaque ressource du butin
      // Artisanat
      forgeron: 0.5, // facteur sur le coût des réparations
      econome: 0.25, // chance de ne pas consommer un ingrédient de base
      maitreForgeron: 0.5, // + part de durabilité maximale des outils et de l'armure
      porteur: 4, // + cases d'inventaire porté
      grandSac: 4, // + cases du sac magique
      // Magie
      reserve: 30, // + mana max
      bouleDeFeuII: 1.5, // facteur sur le rayon de l'explosion de la boule de feu
      // Nœuds dont l'effet vient avec le bouclier (étape 33)
      coupPuissant: { duree: 1, facteur: 2.5 },
      riposte: { facteur: 2 },
      barriere: { absorbe: 30, duree: 8 },
      // Parts de réduction des dégâts de face avec le bouclier levé
      parade: 0.7,
      // Même part avec le nœud Bouclier solide
      bouclierSolide: 1,
      // Chasse (lot 2b). Tir chargé : à pleine tension, facteurs sur les dégâts, la vitesse et la portée de la flèche
      tirCharge: { degats: 1.5, vitesse: 1.3, portee: 1.4 },
      // Dépeceur : viande (ou cuir) en plus sur chaque animal
      depeceur: 1,
      // Pisteur : distance à laquelle les animaux se voient sur la mini-carte (m)
      pisteur: 60,
    },
    // Ingrédients de base, concernés par le nœud Économe
    ingredientsDeBase: ['bois', 'pierre', 'fibres'] as readonly string[],
    // Sac magique : une case de plus à ce niveau, puis tous les `niveauxParCaseSac` niveaux (niveaux 3, 5, 7...)
    niveauPremiereCaseSac: 3,
    niveauxParCaseSac: 2,
    // Mana : réserve de départ et régénération par seconde
    mana: { max: 50, regeneration: 4 },
    // Durée d'affichage de la notification de niveau, en millisecondes
    dureeNotificationMs: 3200,
  },

  // Sorts : règles dans src/regles/sorts.ts, effets dans src/scene/effetsSorts.ts.
  sorts: {
    bouleDeFeu: {
      // Touche A (KeyQ en AZERTY) ; débloquée par le nœud « Boule de feu » de l'arbre
      cout: 15,
      recharge: 1.5,
      // Projectile : vitesse (m/s), portée (m) et rayon de touche (m)
      vitesse: 22,
      portee: 30,
      rayonProjectile: 0.35,
      // Dégâts à l'ennemi touché ; explosion : rayon (m) et dégâts aux autres ennemis autour
      degats: 25,
      rayonExplosion: 3,
      degatsExplosion: 10,
      // Hauteur de départ du projectile au-dessus des pieds (m)
      hauteurDepart: 1.3,
    },
    soin: {
      // Touche X ; débloqué par le nœud « Soin » de l'arbre
      cout: 20,
      recharge: 6,
      pv: 35,
    },
    barriere: {
      // Touche C ; débloquée par le nœud « Barrière » (points absorbés et durée : progression.arbre.barriere)
      cout: 25,
      recharge: 20,
    },
    // Geste de la main gauche quand un sort part (src/scene/personnage.ts), en secondes
    geste: {
      // Boule de feu : la flamme se forme dans la paume pendant ce délai, puis la boule part de la main
      anticipationBoule: 0.2,
      // Durée totale du geste (lever, pousser, revenir)
      dureeBoule: 0.7,
      // Soin : la main vient devant la poitrine, y reste, puis revient
      dureeSoin: 1.1,
      // Barrière : la main se lève, paume en avant, y reste, puis revient
      dureeBarriere: 0.9,
    },
  },

  // Arc (case 4 de la barre d'outils, src/regles/arc.ts) : clic maintenu pour tendre, relâcher pour tirer.
  arc: {
    // Temps pour atteindre la pleine tension (s) ; sous `tensionMin` (part de 0 à 1), relâcher ne tire pas
    dureeTension: 0.8,
    tensionMin: 0.15,
    // Dégâts de la flèche, de la tension minimale à la pleine tension (un lapin a 8 PV : une flèche suffit)
    degatsMin: 8,
    degatsMax: 16,
    // Vitesse de la flèche (m/s), de la tension minimale à la pleine tension
    vitesseMin: 20,
    vitesseMax: 45,
    // Chute de la flèche (m/s²), portée (m) et rayon de touche (m)
    gravite: 7,
    portee: 70,
    rayonFleche: 0.2,
    // Jusqu'à cette distance (m), la flèche part un peu vers le haut pour arriver sur le réticule ; au-delà, elle tombe en dessous
    distanceCompensee: 25,
    // Facteur sur la vitesse de déplacement pendant qu'on tend l'arc (0,45 = 55 % moins vite)
    facteurVitesse: 0.45,
    // Départ de la flèche : distance devant l'œil en 1re personne, hauteur au-dessus des pieds en 3e personne (m)
    avanceDepart: 0.5,
    hauteurDepart: 1.45,
    // Flèches plantées au sol : durée (s), nombre maximal, distance de ramassage (m ; on les reprend en passant dessus)
    dureeAuSol: 180,
    maxAuSol: 30,
    porteeRamassage: 1.3,
    // Flèches données par une fabrication
    flechesParRecette: 10,
  },

  // Bouclier et parade (src/regles/bouclier.ts) : clic droit maintenu avec l'épée en main.
  // La part de dégâts retirée est dans progression.arbre (parade, bouclierSolide).
  bouclier: {
    // « De face » : attaquant dans ce demi-angle autour du regard (degrés)
    demiAngleFaceDegres: 70,
    // Part de réduction ajoutée par le bouclier renforcé
    bonusRenforce: 0.1,
    // Facteur sur la vitesse de déplacement, bouclier levé (0,6 = 40 % moins vite)
    facteurVitesse: 0.6,
    // Parade réussie : bouclier levé depuis ce temps au plus quand le coup arrive (secondes)
    fenetreParade: 0.3,
    // Durée de l'étourdissement de l'ennemi après une parade réussie (secondes)
    dureeEtourdissement: 1,
    // Riposte : temps laissé pour porter le coup doublé après une parade réussie (secondes)
    dureeRiposte: 2,
    // Ennemis dont le coup annoncé peut être paré au bon moment
    parables: ['gobelin', 'bandit', 'loup', 'sanglier', 'morvan'] as readonly string[],
    // Coup puissant : temps de clic à partir duquel l'épée commence à reculer (un clic court ne la fait pas bouger)
    debutCharge: 0.15,
  },

  // Combat : règles dans src/regles/combat.ts, modèles dans src/scene/modelesEnnemis.ts.
  combat: {
    // Vie du joueur
    vieMax: 100,
    // Régénération : commence après ce délai sans dégâts (secondes), puis ce nombre de points par seconde
    delaiRegeneration: 6,
    regenerationParSeconde: 3,
    // Part des dégâts retirée par chaque armure (un seul emplacement)
    reductionArmure: { fibres: 0.15, cuir: 0.25, fourrure: 0.3, mailles: 0.4, plaques: 0.55 },
    // Part des dégâts retirée par chaque casque (s'ajoute à l'armure et à Peau dure ; le casque ne s'use pas)
    reductionCasque: { cuir: 0.04, fourrure: 0.06, mailles: 0.08, plaques: 0.1 },
    // Réduction totale maximale (armure + casque + Peau dure)
    plafondReduction: 0.75,
    // Dégâts de l'épée de base (multipliés par le facteur de son palier : fabrication.paliers)
    degatsEpee: 10,
    // Part des dégâts faite par un outil qui n'est pas l'épée (hache, pioche) contre un ennemi (1/3 = trois fois plus de coups)
    facteurOutilInadapte: 1 / 3,
    // Portée de l'épée, du personnage au bord de l'ennemi, en mètres, et demi-angle devant le regard, en degrés
    porteeEpee: 2.8,
    angleFrappeDegres: 65,
    // Recul d'un ennemi touché : vitesse de départ (m/s), freinage (1/s) et durée du sursaut (s)
    vitesseRecul: 7,
    freinRecul: 9,
    dureeRecul: 0.28,
    // Potion de soin (touche R) : points rendus et temps de recharge, en secondes
    soinPotion: 50,
    rechargePotion: 2,
    // Vie à zéro : durée de l'écran « Vous êtes tombé… » avant la réapparition au village, en secondes
    dureeChute: 3,
    // Durée de l'animation de mort d'un ennemi, en secondes
    dureeMortEnnemi: 0.9,
    // Les ennemis n'entrent pas dans une eau plus profonde que cela (mètres) ni sur une pente plus raide (degrés)
    profondeurMaxEnnemi: 0.5,
    penteMaxEnnemiDegres: 48,
    // Les ennemis ne s'approchent pas du centre du village à moins de (rayon du village + cette marge), en mètres
    margeVillage: 5,
    // Après un abandon de poursuite : durée pendant laquelle l'ennemi ignore le joueur, en secondes
    dureeCalme: 5,
    // Ennemi qui n'avance plus vers son but : il longe l'obstacle pendant `dureeDetour` puis réessaie ;
    // bloqué plus longtemps que `dureeBlocage` (eau, falaise) : il renonce. En secondes.
    dureeDetour: 0.5,
    dureeBlocage: 2.5,
    // Errance autour du point d'apparition : rayon (m), durée maximale d'un trajet et attente entre deux (s)
    rayonErrance: 6,
    dureeErranceMax: 6,
    attenteMin: 2,
    attenteMax: 6,
    // Tremblement de la caméra quand le joueur est touché : amplitude (m) et durée (s)
    tremblement: { amplitude: 0.09, duree: 0.3 },
    // Barre de vie d'un ennemi : visible ce temps après un coup, en secondes
    dureeBarreEnnemi: 5,
    // Durée d'un chiffre de dégâts flottant, en millisecondes
    dureeChiffreMs: 800,
  },

  // Ennemis : pv, vitesses (m/s), distances (m), durées (s). `sauts` : avance par bonds (slime).
  // `porteeDeclenchement` : distance où l'attaque commence ; `porteeCoup` : distance où le coup touche encore
  // à la fin de l'anticipation (reculer au-delà = esquiver). `interruptible` : un coup reçu annule son attaque.
  ennemis: {
    slime: {
      nom: 'slime', pv: 30, vitesse: 3.4, vitesseErrance: 2.2, sauts: true, dureeSaut: 0.55, pauseSaut: 0.55,
      distanceDetection: 8, distanceAbandon: 18, degats: 6, porteeDeclenchement: 1.0, porteeCoup: 1.25,
      dureeAnticipation: 0, dureeAttaque: 0.3, recharge: 1.4, rayon: 0.45, interruptible: true,
      butin: [{ objet: 'gelee-slime', min: 1, max: 2, chance: 1 }],
    },
    gobelin: {
      nom: 'gobelin', pv: 50, vitesse: 4.2, vitesseErrance: 1.6, sauts: false, dureeSaut: 0, pauseSaut: 0,
      distanceDetection: 14, distanceAbandon: 25, degats: 10, porteeDeclenchement: 1.7, porteeCoup: 2.2,
      dureeAnticipation: 0.5, dureeAttaque: 0.4, recharge: 1.1, rayon: 0.35, interruptible: false,
      butin: [
        { objet: 'or', min: 1, max: 3, chance: 1 },
        { objet: 'minerai-fer', min: 1, max: 1, chance: 0.3 },
      ],
    },
    loup: {
      nom: 'loup', pv: 40, vitesse: 6.5, vitesseErrance: 2.2, sauts: false, dureeSaut: 0, pauseSaut: 0,
      distanceDetection: 16, distanceAbandon: 30, degats: 8, porteeDeclenchement: 1.6, porteeCoup: 2.0,
      dureeAnticipation: 0.35, dureeAttaque: 0.35, recharge: 1.0, rayon: 0.4, interruptible: true,
      butin: [{ objet: 'fourrure', min: 1, max: 2, chance: 1 }],
    },
    bandit: {
      nom: 'bandit', pv: 80, vitesse: 4.6, vitesseErrance: 1.6, sauts: false, dureeSaut: 0, pauseSaut: 0,
      distanceDetection: 16, distanceAbandon: 30, degats: 14, porteeDeclenchement: 1.8, porteeCoup: 2.3,
      dureeAnticipation: 0.55, dureeAttaque: 0.4, recharge: 1.2, rayon: 0.35, interruptible: false,
      butin: [
        { objet: 'or', min: 3, max: 8, chance: 1 },
        { objet: 'cuir', min: 1, max: 2, chance: 0.6 },
      ],
    },
  },

  // Animaux sauvages (src/regles/animaux.ts, modèles dans src/scene/modelesAnimaux.ts) : mêmes champs que les ennemis,
  // plus leur comportement. `fuyard` : fuit quand le joueur est à moins de `distanceFuite` (`distanceFuiteDiscret`
  // s'il avance à moins de `vitesseDiscrete`), jusqu'à `distanceCalme`. `zigzag` : écart d'angle maximal de la fuite (radians).
  // `neutre` (sanglier) : ignore le joueur ; frappé, il le charge (`porteeDeclenchement` : distance où il prend son élan,
  // `dureeAnticipation` : élan annoncé, `vitesseCharge` et `dureeAttaque` : la charge, `porteeCoup` : distance où elle touche)
  // et redevient neutre quand le joueur est à plus de `distanceAbandon`. `xp` : expérience gagnée.
  animaux: {
    cerf: {
      nom: 'cerf', pv: 40, vitesse: 10, vitesseErrance: 1.4, sauts: false, dureeSaut: 0, pauseSaut: 0,
      distanceDetection: 0, distanceAbandon: 0, degats: 0, porteeDeclenchement: 0, porteeCoup: 0,
      dureeAnticipation: 0, dureeAttaque: 0, recharge: 0, rayon: 0.5, interruptible: true,
      butin: [
        { objet: 'viande-crue', min: 2, max: 3, chance: 1 },
        { objet: 'cuir', min: 1, max: 2, chance: 1 },
      ],
      comportement: 'fuyard' as 'fuyard' | 'neutre', distanceFuite: 15, distanceFuiteDiscret: 9, distanceCalme: 34,
      zigzag: 0, vitesseCharge: 0, xp: 12,
    },
    lapin: {
      nom: 'lapin', pv: 8, vitesse: 11, vitesseErrance: 2.4, sauts: true, dureeSaut: 0.26, pauseSaut: 0.06,
      distanceDetection: 0, distanceAbandon: 0, degats: 0, porteeDeclenchement: 0, porteeCoup: 0,
      dureeAnticipation: 0, dureeAttaque: 0, recharge: 0, rayon: 0.22, interruptible: true,
      butin: [
        { objet: 'viande-crue', min: 1, max: 1, chance: 1 },
        { objet: 'cuir', min: 1, max: 1, chance: 0.3 },
      ],
      comportement: 'fuyard' as 'fuyard' | 'neutre', distanceFuite: 8, distanceFuiteDiscret: 5, distanceCalme: 22,
      zigzag: 0.9, vitesseCharge: 0, xp: 4,
    },
    renard: {
      nom: 'renard', pv: 20, vitesse: 9, vitesseErrance: 1.8, sauts: false, dureeSaut: 0, pauseSaut: 0,
      distanceDetection: 0, distanceAbandon: 0, degats: 0, porteeDeclenchement: 0, porteeCoup: 0,
      dureeAnticipation: 0, dureeAttaque: 0, recharge: 0, rayon: 0.35, interruptible: true,
      butin: [
        { objet: 'fourrure-renard', min: 1, max: 1, chance: 1 },
        { objet: 'viande-crue', min: 1, max: 1, chance: 1 },
      ],
      comportement: 'fuyard' as 'fuyard' | 'neutre', distanceFuite: 12, distanceFuiteDiscret: 7, distanceCalme: 30,
      zigzag: 0.25, vitesseCharge: 0, xp: 10,
    },
    sanglier: {
      nom: 'sanglier', pv: 60, vitesse: 6.5, vitesseErrance: 1.2, sauts: false, dureeSaut: 0, pauseSaut: 0,
      distanceDetection: 0, distanceAbandon: 25, degats: 22, porteeDeclenchement: 8, porteeCoup: 1.5,
      dureeAnticipation: 0.8, dureeAttaque: 1.1, recharge: 1.8, rayon: 0.7, interruptible: false,
      butin: [
        { objet: 'viande-crue', min: 2, max: 4, chance: 1 },
        { objet: 'cuir', min: 2, max: 2, chance: 1 },
      ],
      comportement: 'neutre' as 'fuyard' | 'neutre', distanceFuite: 0, distanceFuiteDiscret: 0, distanceCalme: 0,
      zigzag: 0, vitesseCharge: 12, xp: 30,
    },
  },
  // Animaux : le joueur est « discret » en dessous de cette vitesse (m/s) : à l'arrêt ou bouclier levé.
  // La charge du sanglier vise ce nombre de mètres derrière le joueur (il le dépasse en courant).
  comportementAnimaux: {
    vitesseDiscrete: 3.5,
    depassementCharge: 4,
  },

  // Apparition des ennemis : règles dans src/regles/apparitions.ts
  apparitions: {
    // Nombre de points d'apparition tirés par chunk (chacun est gardé ou non selon le biome)
    candidatsParChunk: 4,
    // Chance qu'un point tiré porte un ennemi de ce type, de jour, par biome
    chances: {
      // Le loup et le bandit ont pris une part des slimes et des gobelins : le total de jour par biome est inchangé
      prairie: { slime: 0.17, gobelin: 0, loup: 0, bandit: 0.05 },
      foret: { slime: 0.15, gobelin: 0.15, loup: 0.07, bandit: 0.06 },
      montagne: { slime: 0, gobelin: 0.24, loup: 0.06, bandit: 0 },
      marais: { slime: 0.35, gobelin: 0, loup: 0, bandit: 0 },
    },
    // La nuit, la chance est multipliée par ce facteur (les points en plus n'existent que la nuit)
    facteurNuit: { slime: 1, gobelin: 2, loup: 2, bandit: 2.5 },
    // Distance minimale au centre du village pour chaque type, en mètres (0 = seule la marge du village compte) :
    // les bandits rôdent à l'écart
    distanceMiniVillage: { slime: 0, gobelin: 0, loup: 0, bandit: 90 },
    // Aucun ennemi ordinaire à moins de (rayon sans décor du camp ou de l'autel + cette marge), en mètres
    margeLieux: 4,
    // Aucun point à moins de (rayon du village + cette marge) de l'origine, en mètres
    margeVillage: 25,
    // Hauteur minimale au-dessus de l'eau et pente maximale (0 = plat, 1 = vertical) d'un point
    margeEau: 0.4,
    penteMax: 0.4,
    // Un ennemi n'apparaît qu'entre ces deux distances du joueur, et disparaît au-delà de la troisième, en mètres
    distanceMiniJoueur: 40,
    distanceActivation: 120,
    distanceDisparition: 150,
    // Nombre maximal d'ennemis présents en même temps
    limiteActifs: 12,
    // Un ennemi tué réapparaît après ce délai (une demi-journée de jeu), en secondes de temps de jeu
    delaiReapparition: dureeJour / 2,
    // Vérification des apparitions : toutes les N secondes réelles
    intervalleVerification: 1,
    // Animaux sauvages : points tirés à part de ceux des ennemis (mêmes distances, même délai de réapparition)
    animaux: {
      candidatsParChunk: 3,
      // Chance qu'un point tiré porte un animal de ce type, de jour, par biome
      chances: {
        prairie: { cerf: 0.07, lapin: 0.14, renard: 0, sanglier: 0 },
        foret: { cerf: 0.08, lapin: 0, renard: 0.035, sanglier: 0.09 },
        montagne: { cerf: 0, lapin: 0, renard: 0, sanglier: 0 },
        marais: { cerf: 0, lapin: 0, renard: 0, sanglier: 0 },
      },
      // Le renard sort surtout la nuit
      facteurNuit: { cerf: 1, lapin: 1, renard: 3, sanglier: 1 },
      // Taille des groupes (les cerfs vont par 1 à 3) et rayon où se tiennent les membres d'un groupe, en mètres
      groupe: {
        cerf: { min: 1, max: 3 },
        lapin: { min: 1, max: 1 },
        renard: { min: 1, max: 1 },
        sanglier: { min: 1, max: 1 },
      },
      rayonGroupe: 5,
      // Nombre maximal d'animaux présents en même temps (compté à part des ennemis)
      limiteActifs: 10,
    },
  },

  // Embuscades de bandits : quand un objectif demande d'en tuer, règles dans src/regles/embuscades.ts
  embuscades: {
    // Le temps ne compte qu'à plus de cette distance du centre du village, en mètres (et hors mine et maison)
    distanceMiniVillage: 90,
    // Délai de temps de jeu passé hors du village avant un groupe, tiré au hasard entre ces deux valeurs, en secondes
    delaiMin: 120,
    delaiMax: 240,
    // La nuit, le délai est multiplié par ce facteur (embuscades plus fréquentes)
    facteurNuit: 0.6,
    // Nombre de bandits d'un groupe
    groupeMin: 2,
    groupeMax: 3,
    // Distance d'apparition du groupe par rapport au joueur, en mètres
    distanceMin: 30,
    distanceMax: 45,
    // Écart minimal avec la direction du regard, en degrés : le groupe surgit sur les côtés ou derrière (jusqu'à 180)
    angleMiniDegres: 70,
    // Écart entre les bandits d'un groupe, en mètres
    ecartGroupe: 3,
    // Essais de position avant d'abandonner (le compteur est alors réessayé à l'image suivante)
    essais: 8,
    // Les bandits d'embuscade disparaissent au-delà de cette distance du joueur, en mètres
    distanceDisparition: 150,
  },

  // Mine : entrée cherchée par src/monde/entreeMine.ts, plan dans src/mine/plan.ts, modèles dans src/mine/sceneMine.ts
  maison: {
    // Intérieur de la maison du joueur : zone à part, loin du monde et de la mine (centre de la pièce), sol à cette altitude
    origine: { x: 49000, z: 50000 },
    altitude: 20,
    // Pièce : largeur (x), profondeur (z) et hauteur sous plafond, en mètres
    largeur: 8,
    profondeur: 6,
    hauteur: 3,
    // Dehors : distance devant la porte où le joueur ressort et réapparaît, en mètres
    distanceSortie: 1.4,
    // Ambiance : fond, lumière générale chaude
    couleurFond: 0x1a0f0a,
    hemiCiel: 0xffe2c4,
    hemiSol: 0xa87a58,
    intensiteHemi: 1.7,
    // Lueur du feu de cheminée : couleur, intensité, portée (m), atténuation et part de scintillement
    feu: { couleur: 0xffa558, intensite: 6.5, portee: 14, attenuation: 1.4, scintillement: 0.12 },
    couleurs: {
      plancher: 0xc47a45,
      mur: 0xb86a34,
      murSombre: 0xa55c2c,
      poutre: 0x8f4e24,
      plafond: 0xa85a2a,
      pierre: 0xa89a94,
      pierreSombre: 0x8d807c,
      bois: 0xc27c40,
      boisSombre: 0x9a5a2e,
      drap: 0xd9423a,
      oreiller: 0xf2e2bd,
      tapis: 0xb5372f,
      tapisBord: 0xe8c56a,
      fer: 0x77747c,
      poterie: 0xd9703a,
      bougie: 0xfff0c8,
      flamme: 0xffc93c,
      // Vitres : ciel de fin de journée
      vitre: 0xffa860,
    },
  },

  mine: {
    // Zone intérieure : posée très loin du monde (on n'y va que par le portail), sol plat à cette altitude
    origine: { x: 50000, z: 50000 },
    altitude: 20,
    entree: {
      // Distance au centre du village : bornes de la recherche et distance préférée, en mètres
      distanceMin: 90,
      distanceMax: 220,
      distanceIdeale: 140,
      // Pente maximale du chemin à pied entre le village et l'entrée, en degrés
      penteMarcheDegres: 35,
      // Aucun décor généré (arbres, rochers, herbes) à moins de cette distance du portail, en mètres
      rayonSansDecor: 11,
      // Intensité de la lanterne du portail
      lumiereLanterne: 9,
    },
    // Un ennemi de la mine n'apparaît que si le joueur est plus loin que cela, en mètres
    distanceMiniApparition: 12,
    // Ambiance : fond et brouillard (début et fin, en mètres devant la caméra), lumière générale
    couleurFond: 0x0b0807,
    brouillardDebut: 14,
    brouillardFin: 60,
    hemiCiel: 0xffd9b3,
    hemiSol: 0x6a5850,
    intensiteHemi: 1.0,
    // Lumière écrite dans la roche : part reçue partout, force des lanternes et des cristaux
    ambiance: 0.5,
    intensiteLanterne: 2.4,
    intensiteCristal: 1.0,
    // Petite lampe qui suit le joueur : couleur, intensité, portée (m) et hauteur au-dessus des pieds (m)
    lampeJoueur: { couleur: 0xffcf9a, intensite: 1.6, portee: 12, hauteur: 2.8 },
    couleurs: {
      paroi: 0x8d7166,
      sol: 0x9c7558,
      plafond: 0x6f5a52,
      bois: 0xb5682f,
      boisSombre: 0x8a4c22,
      rail: 0x4a4a55,
      lanterne: 0xffc04a,
      cristal: 0x4fd8ff,
      cristalClair: 0xb0f2ff,
      // Lueur au sol sous un cristal à récolter
      lueurCristal: 0x1f7fff,
      socleCristal: 0x4a3d3a,
      jour: 0xcfe6ff,
      rocheDehors: 0x9c8f8a,
      terre: 0xb5814f,
    },
  },

  cameras: {
    // Sensibilité de la souris en 1re et 3e personne, en radians par pixel
    sensibilite: 0.0025,
    // Réglage de sensibilité du menu pause : multiplicateur min, max, pas, et valeur de départ
    reglageSensibilite: { min: 0.2, max: 3, pas: 0.1, defaut: 1 },
    // Saut de souris faux : Chrome sous Windows envoie parfois, souris capturée, un seul mouvement de
    // plusieurs centaines de pixels qui fait tourner le personnage d'un coup. Un mouvement est ignoré
    // s'il dépasse `sautSourisMax` pixels ET `facteurSautSouris` fois la moyenne des mouvements récents
    // (un vrai geste rapide monte progressivement, le saut faux arrive d'un coup).
    sautSourisMax: 250,
    facteurSautSouris: 6,
    // Durée de la transition entre deux vues, en secondes
    dureeTransition: 0.6,
    // Hauteur minimale de la caméra au-dessus du sol ou de l'eau, en mètres
    margeSol: 0.35,
    premiere: {
      // Limite du regard vers le haut et le bas, en radians
      tangageMax: 1.45,
      // Balancement de la tête à la marche, en mètres
      balancementVertical: 0.035,
      balancementLateral: 0.02,
    },
    troisieme: {
      // Distance derrière le personnage, hauteur du point visé, décalage vers l'épaule droite
      distance: 4.6,
      distanceMin: 0.5,
      hauteurPivot: 1.6,
      decalageEpaule: 0.55,
      // Limites du regard (radians) : vers le bas (négatif) et vers le haut
      tangageMin: -1.1,
      tangageMax: 0.5,
      tangageDepart: -0.22,
      // Rapidité du retour à la distance normale après un obstacle (1/s)
      vitesseRecul: 5,
    },
    transparence: {
      // Opacité d'un objet qui cache le personnage, et rapidité du fondu (1/s)
      opacite: 0.25,
      vitesse: 8,
      // Décor (arbres, rochers) : rayon du « trou » ouvert le long de la ligne caméra–personnage, en mètres
      rayonTrou: 1.5,
    },
  },

  // Mini-carte ronde en haut à gauche (src/ui/miniCarte.ts) ; touche M : carte agrandie
  miniCarte: {
    // Diamètre de la petite carte (réglage « Normale »), en pixels CSS
    diametre: 150,
    // Diamètres des choix Petite / Grande du menu, et bornes et pas du curseur fin
    diametrePetite: 110,
    diametreGrande: 230,
    diametreMin: 100,
    diametreMax: 320,
    diametrePas: 10,
    // Rayon du monde vu sur la petite carte, sur la grande, et dans la mine, en mètres.
    // `rayon` vaut pour le diamètre normal ; il grandit avec la taille (rayon × (diamètre / normal) ^ exposantRayon),
    // arrondi au multiple de `pasRayon` pour garder peu de variantes en mémoire.
    exposantRayon: 0.5,
    pasRayon: 8,
    rayon: 120,
    rayonGrande: 200,
    rayonMine: 30,
    // Diamètre de la carte agrandie : le plus petit de ces trois nombres (pixels, part de la hauteur, part de la largeur de la fenêtre)
    grandeDiametreMax: 780,
    partGrande: 0.86,
    grandePartLargeur: 0.6,
    // Zoom de la carte agrandie (bornes et pas de la molette) : le rayon de monde montré est divisé par le zoom
    zoomMin: 0.6,
    zoomMax: 2.4,
    zoomPas: 0.2,
    // Le terrain est dessiné par tuiles carrées (côté en mètres, pixels par côté), gardées en mémoire
    tailleTuile: 16,
    pixelsTuile: 8,
    // Temps maximal passé à calculer des tuiles par image, en millisecondes (au moins une tuile par image)
    budgetMs: 1.5,
    budgetMsGrande: 6,
    // Nombre de tuiles gardées au maximum (les plus lointaines sont oubliées au-delà)
    // (assez pour le zoom minimal de la carte agrandie : environ 1700 tuiles)
    tuilesMax: 2000,
    // Le fond est redessiné quand le joueur s'est déplacé de plus de cette distance, en mètres
    deplacementRedessin: 0.35,
    // Rayon de la place du village colorée en brun, en mètres
    rayonPlace: 14,
    // Distance de la bordure à laquelle une flèche de repère hors de vue est posée, en pixels
    margeFleche: 11,
    couleurs: {
      sentier: 0x9a7a4e,
      fond: 0x1a1612,
      bordure: 0x7a4a2a,
      mineSol: 0xb39a76,
      mineRoche: 0x2a241e,
    },
  },

  // Habitants du village : routines dans src/regles/habitants.ts, modèles dans src/scene/modelesHabitants.ts
  habitants: {
    // Heures de la routine : au poste le jour, près de l'auberge ou du feu de la place le soir, chez soi la nuit
    debutJour: 7,
    debutSoir: 18,
    debutNuit: 22,
    // Vitesse de marche (m/s) et vitesse à laquelle un habitant pivote (rad/s)
    vitesseMarche: 1.25,
    vitesseRotation: 4,
    // Rayon du cercle d'obstacle d'un habitant, et marge qu'il garde avec les murs et les objets en marchant, en mètres
    rayon: 0.35,
    margeObstacles: 0.15,
    // Temps passé à un poste avant d'aller au suivant, en secondes (tiré entre les deux)
    dureePosteMin: 25,
    dureePosteMax: 55,
    // Le joueur à moins de cette distance : l'habitant s'arrête et se tourne vers lui
    distanceTourner: 3,
    // La nuit, en rentrant chez lui, il ne s'arrête que si le joueur lui barre la route
    distanceTournerNuit: 1.2,
    // Le joueur à moins de cette distance : la tête le suit, jusqu'à cet angle (radians)
    distanceRegard: 7,
    angleRegardMax: 1.1,
    // À moins de cette distance d'une porte, un habitant n'est plus un obstacle (il ne bloque jamais une entrée)
    distancePorteLibre: 1.8,
    // Interaction (touche E) : rayon du point d'interaction d'un habitant
    rayonInteraction: 0.4,
    // Graine des durées passées aux postes
    graine: 4077,
    // Aldric l'ermite : son campement dans la forêt, hors du village (feu et rocher), et rayon sans décor autour.
    // Position choisie pour la graine du jeu : au nord-ouest du village (290 m), à plus de 200 m du camp des bandits
    // et des ruines, sur un sol presque plat. `cabane` : la place de sa petite cabane (décalage depuis le feu, lacet de
    // la façade tournée vers le feu, demi-dimensions de l'emprise qui sert d'obstacle)
    aldric: {
      x: -122, z: -262, rayonSansDecor: 7.5,
      cabane: { dx: 0.5, dz: 3.5, orientation: -3, demiLargeur: 1.6, demiProfondeur: 1.3 },
    },
  },

  // Dialogues avec les habitants (E) : la boîte se ferme au-delà de cette distance (mètres) ;
  // repère au-dessus de la tête : « ! » (quête à proposer), « ? » (quête à rendre) et « ! » orange (étape d'histoire)
  dialogue: {
    distanceMax: 4,
    repere: { hauteur: 2.45, taille: 0.55, rebond: 0.08, vitesseRebond: 3, jaune: '#ffe14a', dore: '#f2a900', histoire: '#ff8a1f' },
  },

  // Chaîne principale de l'histoire (src/regles/histoire.ts) : récompense de chaque étape terminée, selon l'acte
  // (XP et pièces d'or), et délai entre deux contrôles des étapes « état » (palier d'outils, niveau du village), en secondes
  histoire: {
    intervalleVerification: 1,
    // Secondes entre la fin de l'histoire et l'ouverture du livre de fin (le temps de lire les derniers messages)
    delaiLivreFin: 6,
    recompenses: {
      prologue: { xp: 45, or: 5 },
      I: { xp: 90, or: 10 },
      II: { xp: 150, or: 20 },
      III: { xp: 225, or: 30 },
      IV: { xp: 375, or: 50 },
      epilogue: { xp: 600, or: 100 },
    },
  },

  // Marchand ambulant (src/regles/marchand.ts) : il passe sur la place un jour sur `periodeJours`, du matin au soir
  // (jours comptés de minuit à minuit, le jour 0 est celui du début de partie). Il se tient à (x, z) en regardant la place ;
  // sa charrette est posée à côté de lui, décalée de `charrette` dans son repère. Prix en pièces d'or.
  marchand: {
    premierJour: 1,
    periodeJours: 3,
    heureArrivee: 7,
    heureDepart: 19,
    x: -7.5,
    z: 6.5,
    rayon: 0.4,
    charrette: { x: -1.7, z: -0.5, rayon: 1.0 },
    // Ce qu'il vend : `lot` objets pour `prix` pièces, `stock` lots par visite (remis à neuf à chaque visite)
    ventes: [
      { objet: 'potion-soin', lot: 1, prix: 12, stock: 3 },
      { objet: 'fleche', lot: 10, prix: 8, stock: 3 },
      { objet: 'kit-feu-camp', lot: 1, prix: 10, stock: 2 },
      { objet: 'piege', lot: 1, prix: 15, stock: 2 },
      { objet: 'viande-cuite', lot: 1, prix: 6, stock: 5 },
      { objet: 'lingot-cuivre', lot: 1, prix: 15, stock: 3 },
      { objet: 'lingot-fer', lot: 1, prix: 30, stock: 3 },
    ],
    // Ce qu'il rachète, à la pièce (toujours moins cher que ce qu'il vend)
    achats: [
      { objet: 'bois', prix: 1 },
      { objet: 'pierre', prix: 1 },
      { objet: 'fibres', prix: 1 },
      { objet: 'baies', prix: 1 },
      { objet: 'charbon', prix: 2 },
      { objet: 'minerai-cuivre', prix: 2 },
      { objet: 'minerai-fer', prix: 3 },
      { objet: 'lingot-cuivre', prix: 6 },
      { objet: 'lingot-fer', prix: 10 },
      { objet: 'lingot-acier', prix: 18 },
      { objet: 'cuir', prix: 4 },
      { objet: 'fourrure', prix: 8 },
      { objet: 'fourrure-renard', prix: 6 },
      { objet: 'gelee-slime', prix: 3 },
      { objet: 'viande-crue', prix: 2 },
      { objet: 'cristal-bleu', prix: 15 },
    ],
  },

  // Attaques de bandits sur le village (src/regles/attaques.ts), à partir de l'acte II de l'histoire.
  // Un soir sur trois (`probabilite`, tirée de la graine et du numéro de jour), jamais deux soirs de suite (`ecartMiniJours`)
  // ni le jour de l'arrivée à l'acte II. Départ à `heureDepart` (pas après `heureLimiteDepart`) ; fin à minuit.
  // Les bandits apparaissent ensemble à `distanceApparition` m du centre et marchent à `vitesseMarche` m/s vers la place :
  // les ennemis n'entrent pas dans le village, ils arrivent au bord (`distanceArrivee` m au-delà du rayon interdit) et y pillent
  // après `dureePillage` secondes. Victoire : `orParBandit` pièces et `xpParBandit` XP par bandit (en plus de leur XP normale).
  // Pillage : `nombreRessources` ressources prises, `part` du stock du coffre (au plus la part maximale, au moins 1 pièce).
  attaques: {
    probabilite: 1 / 3,
    ecartMiniJours: 2,
    heureDepart: 19.5,
    heureLimiteDepart: 22,
    nombreMin: 3,
    nombreMax: 5,
    distanceApparition: 70,
    ecartBandits: 2.5,
    vitesseMarche: 3.2,
    distanceArrivee: 3,
    // Pas d'attaque du village tant que le joueur est à moins de cette distance (m) du camp des bandits et que Morvan est en vie
    distanceCampMorvan: 80,
    dureePillage: 6,
    orParBandit: 10,
    xpParBandit: 40,
    pillage: {
      ressources: ['bois', 'pierre', 'minerai-cuivre', 'minerai-fer', 'charbon', 'fibres', 'baies', 'cuir', 'viande-crue', 'viande-cuite'],
      nombreRessourcesMin: 2,
      nombreRessourcesMax: 3,
      partMin: 0.1,
      partMax: 0.2,
    },
    // Graine du tirage des soirs d'attaque
    graine: 6203,
  },

  // Chefs (src/regles/chef.ts) : mêmes champs que les ennemis, plus leurs attaques propres. Morvan le Balafré, au camp
  // des bandits : environ 5 fois la vie d'un bandit. Coup lourd = l'attaque normale (`dureeAnticipation` : la hache levée,
  // bien visible ; `degats` : gros dégâts ; le bouclier levé de face en retire sa part, voir CONFIG.bouclier).
  // `charge` : de temps en temps, quand le joueur est entre `distanceMin` et `distanceMax`, il prend son élan (`elan` s)
  // puis fonce en ligne droite à `vitesse` m/s pendant `duree` s ; il touche à moins de `portee` m (`degats`), une fois par
  // charge, et ne recharge qu'après `recharge` s. `seuilAppel` : part de vie sous laquelle il appelle `renforts` bandits, une fois.
  chefs: {
    morvan: {
      nom: 'Morvan le Balafré', pv: 400, vitesse: 4.3, vitesseErrance: 1.2, sauts: false, dureeSaut: 0, pauseSaut: 0,
      distanceDetection: 18, distanceAbandon: 45, degats: 36, porteeDeclenchement: 2.4, porteeCoup: 3.0,
      dureeAnticipation: 0.8, dureeAttaque: 0.55, recharge: 1.7, rayon: 0.5, interruptible: false,
      butin: [
        { objet: 'eclat-coeur', min: 1, max: 1, chance: 1 },
        { objet: 'or', min: 60, max: 90, chance: 1 },
      ],
      charge: { distanceMin: 5.5, distanceMax: 15, elan: 0.6, vitesse: 11, duree: 0.9, portee: 1.5, degats: 24, recharge: 9 },
      seuilAppel: 0.5,
      renforts: 2,
    },
  },

  // Lieux de l'histoire (src/regles/lieux.ts) : le camp des bandits (en forêt) et les ruines de la forteresse de Castalrock
  // (en montagne, autour du Cœur de Castal ; identifiant interne `autel`, gardé pour la sauvegarde), placés
  // d'après la graine. Distances au centre du village en mètres ; `ecartMax` : dénivelé toléré à 16 m du centre avant
  // l'aplanissement ; `replat` et `raccord` : disque aplani et largeur du raccord avec le terrain (comme le village).
  lieux: {
    // Pente maximale du chemin à pied depuis le village, en degrés, et distance minimale à la mine et à Aldric
    penteMarcheDegres: 35,
    distanceMiniAutres: 200,
    // Distance minimale entre le camp et l'autel
    distanceMiniEntreLieux: 150,
    camp: {
      distanceMin: 250, distanceMax: 400, distanceIdeale: 310, ecartMax: 5, replat: 18, raccord: 14, rayonSansDecor: 17,
      // Palissade : rayon du cercle de pieux, écart entre deux pieux, rayon de collision d'un pieu, largeur de l'ouverture
      rayonPalissade: 12.5, ecartPieux: 0.62, rayonPieu: 0.36, largeurPorte: 4.2,
      // Nombre de bandits qui gardent le camp tant que Morvan est en vie, et délai avant qu'un garde tué soit remplacé (s de jeu)
      gardes: 4,
      delaiRetourGarde: 600,
      // Le camp est « découvert » à cette distance ; ses occupants apparaissent quand le joueur est à moins de `distancePresence`
      distanceDecouverte: 45,
      distancePresence: 110,
      // Barre de vie du chef en haut de l'écran : visible à moins de cette distance de Morvan
      distanceBarreChef: 32,
      // Butin du camp : 3 coffres (ouverts une fois). Or, nombre de ressources volées (parmi `ressources`) et leur quantité,
      // chances d'une potion de soin et de lingots de fer ; le coffre de Morvan (n° 0) a toujours des lingots de fer.
      butin: {
        or: { min: 25, max: 45 },
        ressources: ['bois', 'pierre', 'minerai-fer', 'charbon', 'cuir', 'viande-cuite'],
        nombreRessources: { min: 2, max: 3 },
        quantiteRessource: { min: 4, max: 10 },
        potion: { chance: 0.35, min: 1, max: 1 },
        lingotsFer: { chance: 0.35, min: 1, max: 2 },
        lingotsFerMorvan: { min: 2, max: 3 },
      },
    },
    autel: {
      // `ecartRaccordMax` : dénivelé toléré jusqu'au bout du raccord ; `bonusAltitude` : points par mètre d'altitude
      // (jusqu'à 60 m) ; `distanceMiniAutres` : distance minimale à la mine et à Aldric
      distanceMin: 280, distanceMax: 850, distanceIdeale: 480, ecartMax: 12, ecartRaccordMax: 30, bonusAltitude: 0.3,
      replat: 37, raccord: 27, rayonSansDecor: 38, distanceMiniAutres: 130,
      distanceDecouverte: 60,
      // Ce que demande la reforge du Cœur (pris dans l'inventaire, puis le coffre, puis le sac)
      cout: [
        { objet: 'eclat-coeur', quantite: 1 },
        { objet: 'cristal-bleu', quantite: 10 },
        { objet: 'lingot-acier', quantite: 5 },
      ],
      // Durée de l'effet de reforge (l'éclat reprend sa place, le cristal s'élève), en secondes, et rythme du battement
      // une fois reforgé (rad/s)
      dureeReforge: 3.5,
      vitesseBattement: 1.6,
      // Les ruines de la forteresse (src/monde/forteresse.ts), en mètres : rayon de l'enceinte à six côtés (la porte est
      // au milieu du côté tourné vers le village), tours, passage de la porte ; `graine` : tirage des pierres manquantes
      // `rayonBerceau` : collision du berceau de pierre du cristal ; `rayonInteraction` : la touche E répond jusqu'à la
      // portée habituelle au-delà de ce rayon (d'un peu loin, pour voir le cristal en entier)
      forteresse: { graine: 4507, rayonEnceinte: 30, rayonTour: 4, hauteurGrandeTour: 17, largeurPorte: 5, rayonBerceau: 4.7, rayonInteraction: 7 },
      // Le Cœur de Castal : hauteur et rayon du cristal, hauteur de son pied quand il repose dans le berceau, puis
      // quand il flotte (reforgé), amplitude et rythme (rad/s) de son flottement, nombre d'éclats qui tournent autour
      cristal: { hauteur: 7.2, rayon: 1.75, piedRepos: 1.95, piedFlotte: 3.1, flottement: 0.22, vitesseFlottement: 0.9, eclats: 6 },
    },
    // Les modèles des lieux ne sont dessinés qu'à moins de cette distance, en mètres
    distanceAffichage: 260,
    couleurs: {
      pieu: 0x8a5a33, pieuPointe: 0xc98a52, toile: 0x8b4f2e, toileSombre: 0x6f3d24, bois: 0x7a4a2a, boisClair: 0xb98a55,
      fer: 0x6b6b70, pierre: 0x8d8a92, pierreSombre: 0x6f6d78, dalle: 0x7e8290, neige: 0xf1f3f6, drapeau: 0x2b2326,
      braise: 0xff7a1e, feuVif: 0xffc93c, feuRouge: 0xff5a1e, cristal: 0x3fb8ff, cristalClair: 0x9be4ff, cristalEteint: 0x2b5078, cristalCassure: 0x8fb9dc, fissure: 0x08131f,
    },
  },

  // Caméra de visite libre (touche F)
  cameraVisite: {
    vitesse: 25,
    // Sensibilité de la souris, en radians par pixel
    sensibilite: 0.003,
    // Hauteur minimale au-dessus du sol
    hauteurMinSol: 1.8,
  },

  // Sons (src/son/) : fichiers dans public/sons/, réglages de volume dans le menu pause (Échap).
  // Chaque son est ramené au même niveau au chargement, puis joué au volume de son catalogue (src/son/catalogue.ts).
  sons: {
    // Volumes par défaut des curseurs (0 à 1)
    volumeGeneral: 0.8,
    volumeEffets: 0.7,
    volumeMusique: 0.5,
    // Pas plus de sons en même temps (au-delà, les nouveaux sont ignorés)
    voixMax: 24,
    // Sons placés dans le monde : volume plein jusqu'à `distanceRef` mètres, puis il baisse avec la distance ;
    // au-delà de `portee`, le son n'est pas joué du tout
    distanceRef: 4,
    portee: 40,
    // Pas du joueur : vitesse d'animation minimale pour qu'un pas s'entende (0 à 1), volume des pas en marchant
    // et en courant (en course, d'autres sons : `course-terre`, `course-pierre`), hauteur des pas de course,
    // chute à partir de laquelle l'atterrissage fait un bruit (vitesse verticale, m/s). Les pas se coupent dans le menu pause.
    intensitePasMin: 0.35,
    volumePasMarche: 0.8,
    volumePasCourse: 0.7,
    hauteurPasCourse: 1,
    // (au-dessus de la vitesse d'un saut sur place, `personnage.vitesseSaut` : un simple saut ne fait pas ce bruit)
    vitesseAtterrissage: 8.5,
    // Un même son n'est pas rejoué à moins de tant de secondes (une meute qui crie d'un coup, une boule de feu sur un groupe)
    ecartMemeSon: 0.12,
    // Cris des créatures au calme : une fois toutes les `min` à `max` secondes, seulement à moins de `distance` mètres
    appels: { min: 7, max: 16, distance: 28 },
    // Musique de l'auberge : jouée depuis l'auberge, pleine jusqu'à `distanceRef` m, muette au-delà de `distanceMax` m,
    // `hauteur` : hauteur de la source au-dessus du sol (m), `fondu` : montée et descente du volume (s)
    musiqueAuberge: { distanceRef: 7, distanceMax: 45, hauteur: 2.5, fondu: 1.5 },
  },

  // Ferme du village : poules et moutons qui se promènent (décor, ni attaquables ni récoltables).
  // Règles dans src/regles/ferme.ts, branchement dans src/jeu/ferme.ts. Les moutons n'arrivent qu'au niveau 2 du village.
  ferme: {
    // Graine des déplacements (chaque animal a la sienne, dérivée de celle-ci)
    graine: 7711,
    // Nombre, vitesse de marche (m/s), rayon autour du point d'attache (m) ; les moutons restent dans l'enclos
    poules: { nombre: 5, vitesse: 0.6, rayon: 2.6 },
    moutons: { nombre: 3, vitesse: 0.4 },
    // Arrêt entre deux déplacements (s), et chance qu'il serve à picorer ou brouter
    pause: { min: 2, max: 6 },
    chanceActivite: 0.85,
    // Distance minimale (m) entre un animal et un obstacle du village
    margeObstacle: 0.35,
    // Marge (m) gardée contre la clôture et les objets de l'enclos par les moutons
    margeEnclos: 0.8,
    // Au-delà de cette distance du joueur (m), les animaux ne bougent plus
    distanceMiseAJour: 60,
    // Vitesse de rotation vers la direction de marche (rad/s)
    vitesseRotation: 4,
  },
};
