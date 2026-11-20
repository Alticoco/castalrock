// État de la partie en cours : toutes les valeurs qui changent pendant le jeu et que plusieurs systèmes
// lisent ou écrivent. Les modules de src/jeu/ reçoivent cet objet et font `jeu.inventaire = ...`.
import { CONFIG } from '../config';
import { OUTIL_PAR_DEFAUT, type TypeOutil } from '../scene/outils';
import type { CameraVisite } from '../moteur/cameraVisite';
import type { ModeleEnnemi } from '../scene/modelesEnnemis';
import { creerEtatPersonnage, type EtatPersonnage } from '../regles/deplacement';
import type { EmplacementBarre } from '../regles/barreOutils';
import { creerEtatCharge, creerEtatFrappe, type EtatCharge, type EtatFrappe } from '../regles/frappe';
import { creerGarde, type EtatGarde } from '../regles/bouclier';
import { creerEtatRecolte, type EtatRecolte } from '../regles/recolte';
import { creerConteneur, type Conteneur } from '../regles/inventaire';
import { creerEquipement, type Equipement } from '../regles/equipement';
import { POINT_REAPPARITION_DEFAUT, type Baluchon, type PointReapparition } from '../regles/mort';
import { creerProgression, pvMax, type Progression } from '../regles/progression';
import { SANS_BARRIERE, creerRecharges, type Barriere, type Recharges } from '../regles/sorts';
import { creerEtatQuetes, type EtatQuetes } from '../regles/quetes';
import { creerEtatHistoire, type EtatHistoire } from '../regles/histoire';
import { creerEtatMarchand, type EtatMarchand } from '../regles/marchand';
import { creerEtatAttaques, type EtatAttaques } from '../regles/attaques';
import { creerEtatLieux, type EtatLieux } from '../regles/lieux';
import { etatReperesInitial, type EtatReperes } from '../regles/reperes';
import type { DonneesPartie } from '../regles/sauvegarde';
import { APPARITION, interactionsVillage, obstaclesVillage, type NiveauVillage, type PointInteraction } from '../regles/village';
import type { FeuCamp } from '../regles/campement';
import type { Piege } from '../regles/pieges';
import type { EtatPilote } from '../regles/pilote';
import { creerVieJoueur, type ContexteEnnemi, type EtatEnnemi, type ResultatPasEnnemi, type VieJoueur } from '../regles/combat';
import type { ElementRetire, Plante } from '../regles/repousse';
import type { PointSur } from '../regles/pointSur';
import { creerEtatPotager, type EtatPotager } from '../regles/potager';
import type { CoffresEntames } from '../regles/tresors';
import type { Contexte } from './contexte';

/** Un ennemi présent dans le monde : son état de règles et son modèle 3D. */
export interface EnnemiPresent {
  etat: EtatEnnemi;
  modele: ModeleEnnemi;
  /** Secondes depuis le dernier coup reçu (sa barre de vie reste visible un moment) */
  depuisCoup: number;
  /** Vrai une fois la fumée de sa disparition émise */
  fumee: boolean;
  /** Comportement propre (chef) : remplace le pas des ennemis ordinaires */
  pas?: (etat: EtatEnnemi, ctx: ContexteEnnemi, dt: number) => ResultatPasEnnemi;
}

export interface EtatJeu {
  etat: EtatPersonnage;
  frappe: EtatFrappe;
  /** Caméra de visite libre (touche F), ou null */
  visite: CameraVisite | null;
  /** Pilote automatique (touche P), ou null */
  pilote: EtatPilote | null;
  // Récolte : état des éléments frappés, inventaire porté, sac magique, coffre du village et outil en main
  etatRecolte: EtatRecolte;
  inventaire: Conteneur;
  sac: Conteneur;
  coffre: Conteneur;
  /** Dernier outil montré en main (le modèle 3D) */
  outilActuel: TypeOutil;
  /** Case active de la barre d'outils (non sauvegardée) : un outil, ou les pousses d'arbre */
  emplacement: EmplacementBarre;
  // Équipement : palier des outils (de base à cristal), armure portée, sacoche
  equipement: Equipement;
  // Progression : XP, niveau, points et rangs de compétences, mana ; recharges des sorts (non sauvegardées)
  progression: Progression;
  recharges: Recharges;
  // Bouclier levé et riposte prête, charge du coup puissant, barrière magique (rien de tout cela n'est sauvegardé)
  garde: EtatGarde;
  charge: EtatCharge;
  /** Vrai pendant le geste d'un coup puissant (×2,5 à l'impact) */
  coupPuissant: boolean;
  barriere: Barriere;
  quetes: EtatQuetes;
  /** Chaîne principale de l'histoire (sauvegardée) */
  histoire: EtatHistoire;
  /** Marchand ambulant : visite en cours et lots achetés pendant cette visite (sauvegardé) */
  marchand: EtatMarchand;
  /** Attaques de bandits : dernier jour traité (sauvegardé) */
  attaques: EtatAttaques;
  /** Lieux de l'histoire : découverts, Morvan vaincu, Cœur reforgé (sauvegardé) */
  lieux: EtatLieux;
  /** Petits coffres des ruines et des grottes déjà ouverts : leurs identifiants (sauvegardé) */
  tresorsOuverts: string[];
  /** Potager de la maison du joueur (sauvegardé) */
  potager: EtatPotager;
  /** Petits coffres entamés : ce qui leur reste quand l'inventaire était trop plein (sauvegardé) */
  tresorsEntames: CoffresEntames;
  /** Le livre de fin a déjà été refermé : il ne se rouvre pas tout seul (sauvegardé) */
  finVue: boolean;
  vie: VieJoueur;
  // Mort douce : baluchon laissé sur place, point de réapparition
  baluchon: Baluchon | null;
  pointReapparition: PointReapparition;
  /** Derniers points sûrs du joueur (mémoire seulement, pas sauvegardée) et temps avant le prochain */
  pointsSurs: PointSur[];
  tempsPointSur: number;
  feuCamp: FeuCamp | null;
  /** Pièges posés (case 6), sauvegardés */
  pieges: readonly Piege[];
  /** Temps écoulé dans le jeu, en secondes (accéléré tant que T est maintenue) */
  tempsJeu: number;
  /** Niveau affiché du village (F6 le change pour les tests) */
  niveauVillage: NiveauVillage;
  /** Niveau réellement atteint (améliorations) : c'est lui qui est sauvegardé */
  niveauVillageReel: NiveauVillage;
  obstaclesDuVillage: ReturnType<typeof obstaclesVillage>;
  interactions: PointInteraction[];
  /** Vrai dès la première entrée dans la mine : elle apparaît alors pour de bon sur les cartes */
  mineVisitee: boolean;
  /** Repères posés par le joueur sur la carte agrandie, et ce que suit la boussole */
  reperes: EtatReperes;
  // Repousse et plantation : éléments retirés du décor, arbres plantés
  retires: ElementRetire[];
  plantes: Plante[];
  compteurPlantes: number;
  /** Ennemis vivants (non sauvegardés : ils réapparaissent à leurs points au chargement) */
  ennemis: Map<string, EnnemiPresent>;
}

/** État de départ : celui de la partie chargée, ou une nouvelle partie sur la place du village. */
export function creerEtatJeu(partie: DonneesPartie | null, ctx: Contexte): EtatJeu {
  const { terrain, mine, planMine } = ctx;
  const niveauVillage: NiveauVillage = partie?.niveauVillage ?? 1;
  // Le personnage apparaît sur la place du village, tourné vers +z (sortie sud),
  // ou là où il s'était arrêté si une partie est chargée
  let etat = partie
    ? creerEtatPersonnage(
        partie.personnage.x,
        Math.max(partie.personnage.y, terrain.hauteur(partie.personnage.x, partie.personnage.z)),
        partie.personnage.z,
        partie.personnage.orientation,
      )
    : creerEtatPersonnage(APPARITION.x, terrain.hauteur(APPARITION.x, APPARITION.z), APPARITION.z, APPARITION.orientation);
  // Partie sauvegardée dans la mine à un endroit qui n'est pas creusé : retour à la salle d'entrée
  if (partie?.mine.dedans && !mine.estLibre(etat.x, etat.z)) {
    const a = planMine.arrivee;
    etat = creerEtatPersonnage(a.x, terrain.hauteur(a.x, a.z), a.z, a.orientation);
  }
  const progression = partie?.progression ?? creerProgression();
  return {
    etat,
    frappe: creerEtatFrappe(),
    visite: null,
    pilote: null,
    etatRecolte: creerEtatRecolte(),
    inventaire: partie?.inventaire ?? creerConteneur(CONFIG.inventaire.casesPorte),
    sac: partie?.sac ?? creerConteneur(CONFIG.inventaire.casesSac),
    coffre: partie?.coffre ?? creerConteneur(CONFIG.inventaire.casesCoffre),
    outilActuel: OUTIL_PAR_DEFAUT,
    emplacement: OUTIL_PAR_DEFAUT,
    equipement: partie?.equipement ?? creerEquipement(),
    progression,
    recharges: creerRecharges(),
    garde: creerGarde(),
    charge: creerEtatCharge(),
    coupPuissant: false,
    barriere: SANS_BARRIERE,
    quetes: partie?.quetes ?? creerEtatQuetes(),
    histoire: partie?.histoire ?? creerEtatHistoire(),
    marchand: partie?.marchand ?? creerEtatMarchand(),
    attaques: partie?.attaques ?? creerEtatAttaques(),
    lieux: partie?.lieux ?? creerEtatLieux(),
    tresorsOuverts: partie?.tresorsOuverts ?? [],
    potager: partie?.potager ?? creerEtatPotager(),
    tresorsEntames: partie?.tresorsEntames ?? {},
    finVue: partie?.finVue === true,
    // Une partie sauvegardée à terre reprend avec toute sa vie
    vie: creerVieJoueur(partie && partie.vie > 0 ? partie.vie : pvMax(progression), pvMax(progression)),
    baluchon: partie?.baluchon ?? null,
    pointReapparition: partie?.pointReapparition ?? POINT_REAPPARITION_DEFAUT,
    pointsSurs: [],
    tempsPointSur: 0,
    feuCamp: partie?.feuCamp ?? null,
    pieges: partie?.pieges ?? [],
    tempsJeu: partie?.tempsJeu ?? 0,
    niveauVillage,
    niveauVillageReel: niveauVillage,
    obstaclesDuVillage: obstaclesVillage(niveauVillage),
    interactions: interactionsVillage(niveauVillage),
    mineVisitee: partie?.mine.visitee ?? false,
    // Déjà relus par la sauvegarde (une partie d'avant la version 21 arrive sans aucun repère)
    reperes: partie ? partie.reperes : etatReperesInitial(),
    retires: [],
    plantes: partie?.plantes ?? [],
    compteurPlantes: partie?.compteurPlantes ?? 0,
    ennemis: new Map(),
  };
}
