// Pilote automatique (touche P) : le personnage récolte et combat seul dans une zone circulaire
// autour de l'endroit où il a été activé. Il choisit sa cible, marche vers elle, puis frappe,
// à 90 % de la vitesse et de la cadence d'un joueur actif.
// Pur : aucun import de three, aucun Math.random(). Le moteur donne ce qu'il voit autour (ennemis,
// éléments récoltables) ; ce module rend l'« entrée » de déplacement et l'ordre de frapper,
// comme le ferait le joueur au clavier et à la souris.

import { CONFIG } from '../config';
import type { PhaseEnnemi } from './combat';

export type ModePilote = 'recolte' | 'combat';

/** Pourquoi le pilote s'est arrêté (le moteur affiche le message correspondant). */
export type RaisonArret = 'inventairePlein' | 'vieBasse' | 'rienDansLaZone' | 'touche';

export const MESSAGES_ARRET: Readonly<Record<RaisonArret, string>> = {
  inventairePlein: 'Pilote automatique arrêté : inventaire plein',
  vieBasse: 'Pilote automatique arrêté : vie trop basse',
  rienDansLaZone: 'Pilote automatique arrêté : plus rien dans la zone',
  touche: 'Pilote automatique arrêté',
};

/** Ce que le pilote a besoin de savoir d'un ennemi. `rayon` : son rayon, la portée se mesure jusqu'à son bord. */
export interface CandidatEnnemi {
  id: string;
  x: number;
  z: number;
  rayon: number;
  phase: PhaseEnnemi;
}

/** Ce que le pilote a besoin de savoir d'un élément récoltable. `rayon` : rayon visé, la portée se mesure jusqu'à son bord. */
export interface CandidatElement {
  id: string;
  x: number;
  z: number;
  rayon: number;
}

export interface CiblePilote {
  genre: 'ennemi' | 'element';
  id: string;
  x: number;
  z: number;
  rayon: number;
}

export interface EtatPilote {
  /** Centre de la zone : position du personnage à l'activation */
  readonly centre: { readonly x: number; readonly z: number };
  readonly cible: CiblePilote | null;
  readonly mode: ModePilote;
  /** Secondes passées sans se rapprocher de la cible */
  readonly blocage: number;
  /** Plus petite distance (au bord de la cible) atteinte depuis le choix de la cible */
  readonly meilleureDistance: number;
  /** Éléments abandonnés (inaccessibles) : ignorés jusqu'à l'arrêt du pilote */
  readonly abandonnes: readonly string[];
}

/** Ce que le moteur fournit à chaque image. */
export interface ContextePilote {
  joueur: { x: number; z: number };
  /** Vie actuelle divisée par la vie maximale */
  pvRatio: number;
  /** Une touche de déplacement est enfoncée : le joueur reprend la main */
  toucheDeplacement: boolean;
  /** Ennemis présents (liste peu coûteuse, lue à chaque image) */
  ennemis: readonly CandidatEnnemi[];
  /** Éléments récoltables du monde (coûteux : appelé seulement quand il faut une nouvelle cible) */
  elements: () => readonly CandidatElement[];
  /** L'élément existe-t-il encore (pas déjà récolté) ? */
  elementExiste: (id: string) => boolean;
  /** Le butin de l'élément tient-il dans l'inventaire ? */
  peutRecolter: (id: string) => boolean;
  /** Portées de frappe : épée (ennemis) et outil (éléments), du personnage au bord de la cible, en mètres */
  porteeEpee: number;
  porteeRecolte: number;
}

/** Ordre donné au moteur, comme une entrée du joueur. */
export interface OrdrePilote {
  /** Direction de marche dans le monde (longueur 0 à 1 ; 0 = il s'arrête) : déjà ralentie par le facteur de lenteur */
  x: number;
  z: number;
  /** Frapper (comme un clic maintenu) */
  frapper: boolean;
  /** Lacet à tenir quand il frappe (face à la cible) ; `undefined` : il se tourne vers sa marche */
  orientation?: number;
}

export interface ResultatPilote {
  etat: EtatPilote;
  ordre: OrdrePilote;
  /** Non nul : le pilote doit s'arrêter (l'ordre est alors vide) */
  arret: RaisonArret | null;
}

const ORDRE_VIDE: OrdrePilote = { x: 0, z: 0, frapper: false };
const ABANDONNES_MAX = 300;

/** Active le pilote : la zone est centrée sur (x, z). */
export function creerPilote(x: number, z: number): EtatPilote {
  return { centre: { x, z }, cible: null, mode: 'recolte', blocage: 0, meilleureDistance: Infinity, abandonnes: [] };
}

/** Un ennemi est menaçant s'il vit et s'il attaque (poursuite, attaque) ou s'il est à portée de l'épée. */
const PHASES_AGRESSIVES: readonly PhaseEnnemi[] = ['poursuite', 'anticipation', 'attaque'];

/** Ennemi le plus proche qui attaque le personnage ou qui est à portée de l'épée ; `null` s'il n'y en a pas. */
export function ennemiMenacant(
  ennemis: readonly CandidatEnnemi[],
  joueur: { x: number; z: number },
  porteeEpee: number,
): CandidatEnnemi | null {
  let meilleur: CandidatEnnemi | null = null;
  let distance = Infinity;
  for (const e of ennemis) {
    if (e.phase === 'mort') continue;
    const d = Math.hypot(e.x - joueur.x, e.z - joueur.z);
    const aPortee = d - e.rayon <= porteeEpee;
    if (!aPortee && !PHASES_AGRESSIVES.includes(e.phase)) continue;
    if (d < distance) {
      meilleur = e;
      distance = d;
    }
  }
  return meilleur;
}

/**
 * Élément récoltable le plus proche du personnage, dans la zone (cercle de `rayonZone` autour de `centre`),
 * hors éléments abandonnés. `'inventairePlein'` si des éléments restent mais qu'aucun butin ne tient ;
 * `null` s'il n'y a plus rien dans la zone.
 */
export function choisirElement(
  elements: readonly CandidatElement[],
  joueur: { x: number; z: number },
  centre: { x: number; z: number },
  rayonZone: number,
  abandonnes: readonly string[],
  peutRecolter: (id: string) => boolean,
): CandidatElement | 'inventairePlein' | null {
  const dansLaZone = elements
    .filter((e) => !abandonnes.includes(e.id) && Math.hypot(e.x - centre.x, e.z - centre.z) <= rayonZone)
    .map((e) => ({ e, d: Math.hypot(e.x - joueur.x, e.z - joueur.z) }))
    .sort((a, b) => a.d - b.d || (a.e.id < b.e.id ? -1 : 1));
  if (dansLaZone.length === 0) return null;
  for (const { e } of dansLaZone) {
    if (peutRecolter(e.id)) return e;
  }
  return 'inventairePlein';
}

function versCible(e: { x: number; z: number; rayon: number }, genre: CiblePilote['genre'], id: string): CiblePilote {
  return { genre, id, x: e.x, z: e.z, rayon: e.rayon };
}

/**
 * Un pas du pilote. Priorités : l'arrêt (touche, vie basse), puis un ennemi qui attaque ou à portée,
 * puis la cible de récolte en cours, puis le plus proche élément de la zone.
 */
export function pasPilote(etat: EtatPilote, ctx: ContextePilote, dt: number, reglages = CONFIG.pilote): ResultatPilote {
  const arreter = (raison: RaisonArret): ResultatPilote => ({ etat, ordre: ORDRE_VIDE, arret: raison });
  if (ctx.toucheDeplacement) return arreter('touche');
  if (ctx.pvRatio < reglages.seuilVie) return arreter('vieBasse');

  // 1. Choix de la cible
  let cible = etat.cible;
  let abandonnes = etat.abandonnes;
  let nouvelle = false;
  const menace = ennemiMenacant(ctx.ennemis, ctx.joueur, ctx.porteeEpee);
  if (menace) {
    if (cible?.genre !== 'ennemi' || cible.id !== menace.id) nouvelle = true;
    cible = versCible(menace, 'ennemi', menace.id);
  } else {
    if (cible?.genre === 'ennemi') cible = null;
    if (cible && (!ctx.elementExiste(cible.id) || abandonnes.includes(cible.id))) cible = null;
    if (cible && !ctx.peutRecolter(cible.id)) return arreter('inventairePlein');
    if (!cible) {
      const choix = choisirElement(
        ctx.elements(),
        ctx.joueur,
        etat.centre,
        reglages.rayonZone,
        abandonnes,
        ctx.peutRecolter,
      );
      if (choix === null) return arreter('rienDansLaZone');
      if (choix === 'inventairePlein') return arreter('inventairePlein');
      cible = versCible(choix, 'element', choix.id);
      nouvelle = true;
    }
  }
  const mode: ModePilote = cible.genre === 'ennemi' ? 'combat' : 'recolte';

  // 2. Marche ou frappe
  const dx = cible.x - ctx.joueur.x;
  const dz = cible.z - ctx.joueur.z;
  const distance = Math.hypot(dx, dz);
  const bord = distance - cible.rayon;
  const portee = (cible.genre === 'ennemi' ? ctx.porteeEpee : ctx.porteeRecolte) - reglages.margePortee;
  let meilleureDistance = nouvelle ? bord : etat.meilleureDistance;
  let blocage = nouvelle ? 0 : etat.blocage;

  if (bord <= portee) {
    // À portée : il s'arrête, fait face à la cible et frappe
    return {
      etat: { ...etat, cible, mode, blocage: 0, meilleureDistance: bord, abandonnes },
      ordre: { x: 0, z: 0, frapper: true, orientation: Math.atan2(dx, dz) },
      arret: null,
    };
  }

  // Il marche vers la cible ; s'il n'avance plus (obstacle, falaise), il finit par abandonner un élément
  if (bord < meilleureDistance - reglages.progresMini) {
    meilleureDistance = bord;
    blocage = 0;
  } else {
    blocage += dt;
  }
  if (cible.genre === 'element' && blocage > reglages.delaiBlocage) {
    abandonnes = [...abandonnes, cible.id].slice(-ABANDONNES_MAX);
    return {
      etat: { ...etat, cible: null, mode, blocage: 0, meilleureDistance: Infinity, abandonnes },
      ordre: ORDRE_VIDE,
      arret: null,
    };
  }
  const k = reglages.facteurLenteur / Math.max(distance, 1e-6);
  return {
    etat: { ...etat, cible, mode, blocage, meilleureDistance, abandonnes },
    ordre: { x: dx * k, z: dz * k, frapper: false },
    arret: null,
  };
}
