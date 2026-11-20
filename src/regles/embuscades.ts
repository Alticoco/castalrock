// Embuscades de bandits : quand un objectif (quête acceptée ou étape d'histoire) demande d'en tuer, un groupe surgit
// après un délai passé hors du village, sur les côtés ou derrière le joueur. Ce fichier décide quand et où ;
// la création des ennemis est dans src/jeu/embuscades.ts. Réglages : CONFIG.embuscades.
// Pur : aucun import de three, aucun Math.random() (tirages par le générateur à graine). Rien n'est sauvegardé.

import { CONFIG } from '../config';
import type { IdBiome } from '../monde/biomes';
import { dansZoneSansEnnemi, type MondeApparition } from './apparitions';
import { attaqueRepoussee } from './attaques';
import type { Aleatoire } from './aleatoire';
import { etapeCourante, type EtatHistoire } from './histoire';
import { chercherQuete, type EtatQuetes } from './quetes';

/** Préfixe de l'identifiant d'un bandit d'embuscade (`embuscade:<n>:<i>`). */
export const PREFIXE_BANDIT_EMBUSCADE = 'embuscade:';

export const MESSAGE_EMBUSCADE = 'Des bandits surgissent des fourrés !';

/** Vrai si une quête acceptée (pas encore remplie) ou l'étape d'histoire en cours demande de tuer des bandits. */
export function objectifBanditsActif(quetes: EtatQuetes, histoire: EtatHistoire): boolean {
  const condition = etapeCourante(histoire)?.condition;
  if (condition?.type === 'tuer' && condition.ennemi === 'bandit') return true;
  return quetes.enCours.some((q) => {
    const objectif = chercherQuete(q.id)?.objectif;
    return objectif?.type === 'tuer' && objectif.ennemi === 'bandit' && q.compteur < objectif.quantite;
  });
}

export interface SituationEmbuscade {
  /** Un objectif « tuer des bandits » est en cours (voir `objectifBanditsActif`) */
  objectifActif: boolean;
  /** Distance du joueur au centre du village, en mètres */
  distanceVillage: number;
  /** Dans la mine ou la maison */
  dedans: boolean;
  biome: IdBiome;
  /** Une attaque du village est en cours */
  attaqueEnCours: boolean;
  /** Distance du joueur au camp des bandits, en mètres */
  distanceCamp: number;
  morvanVaincu: boolean;
  nuit: boolean;
  /** Un groupe d'embuscade est encore là (en vie) */
  groupePresent: boolean;
}

/** Le temps passé à l'extérieur compte-t-il pour une embuscade ? */
export function compteHorsVillage(s: SituationEmbuscade): boolean {
  if (s.dedans || s.attaqueEnCours || s.groupePresent) return false;
  if (s.biome !== 'prairie' && s.biome !== 'foret') return false;
  if (s.distanceVillage <= CONFIG.embuscades.distanceMiniVillage) return false;
  return !attaqueRepoussee(s.distanceCamp, s.morvanVaincu);
}

export interface CompteurEmbuscade {
  /** Secondes de jeu passées hors du village depuis la dernière embuscade */
  ecoule: number;
  /** Délai de base tiré au hasard (avant le facteur de nuit), en secondes */
  delai: number;
}

/** Tire un nouveau délai de base. */
export function delaiAleatoire(alea: Aleatoire): number {
  return alea.entre(CONFIG.embuscades.delaiMin, CONFIG.embuscades.delaiMax);
}

export function creerCompteur(alea: Aleatoire): CompteurEmbuscade {
  return { ecoule: 0, delai: delaiAleatoire(alea) };
}

/** Délai réel : plus court la nuit. */
export function delaiEffectif(compteur: CompteurEmbuscade, nuit: boolean): number {
  return compteur.delai * (nuit ? CONFIG.embuscades.facteurNuit : 1);
}

/**
 * Fait avancer le compteur de `dt` secondes. Sans objectif actif, il repart de zéro ; hors conditions
 * (village, mine, attaque, groupe déjà là, près du camp) il attend. `declenche` : le délai est écoulé.
 */
export function avancerCompteur(
  compteur: CompteurEmbuscade,
  dt: number,
  s: SituationEmbuscade,
  alea: Aleatoire,
): { compteur: CompteurEmbuscade; declenche: boolean } {
  if (!s.objectifActif) return { compteur: { ecoule: 0, delai: compteur.delai }, declenche: false };
  if (!compteHorsVillage(s)) return { compteur, declenche: false };
  const ecoule = compteur.ecoule + dt;
  if (ecoule < delaiEffectif(compteur, s.nuit)) return { compteur: { ecoule, delai: compteur.delai }, declenche: false };
  return { compteur: creerCompteur(alea), declenche: true };
}

// --- Où ? ---------------------------------------------------------------------------------------

export interface PositionEmbuscade {
  readonly x: number;
  readonly z: number;
}

/**
 * Position candidate : à une distance tirée entre `distanceMin` et `distanceMax` du joueur, dans une direction qui
 * s'écarte d'au moins `angleMiniDegres` de son regard (côtés ou derrière). Le regard `orientation` est un angle
 * dont la direction est (sin, cos), comme partout dans le jeu.
 */
export function positionCandidate(joueur: PositionEmbuscade, orientation: number, alea: Aleatoire): PositionEmbuscade {
  const E = CONFIG.embuscades;
  const ecart = alea.entre((E.angleMiniDegres * Math.PI) / 180, Math.PI);
  const angle = orientation + (alea.suivant() < 0.5 ? -ecart : ecart);
  const distance = alea.entre(E.distanceMin, E.distanceMax);
  return { x: joueur.x + Math.sin(angle) * distance, z: joueur.z + Math.cos(angle) * distance };
}

/** Sol valide : hors de l'eau, pente acceptable, hors des zones sans ennemi (camp, ruines, autel). */
export function solValide(monde: MondeApparition, x: number, z: number): boolean {
  const A = CONFIG.apparitions;
  // Jamais dans le village ni sur sa marge
  if (Math.hypot(x, z) < CONFIG.monde.village.rayon + A.margeVillage) return false;
  if (monde.hauteur(x, z) < monde.niveauEau + A.margeEau) return false;
  if (monde.pente && monde.pente(x, z) > A.penteMax) return false;
  return !dansZoneSansEnnemi(monde, x, z);
}

/** Positions des bandits autour d'un centre, en cercle serré ; seules celles sur un sol valide sont gardées. */
export function positionsGroupe(monde: MondeApparition, centre: PositionEmbuscade, nombre: number, alea: Aleatoire): PositionEmbuscade[] {
  const depart = alea.entre(0, Math.PI * 2);
  const positions: PositionEmbuscade[] = [];
  for (let i = 0; i < nombre; i++) {
    const angle = depart + (i * Math.PI * 2) / nombre;
    const rayon = nombre === 1 ? 0 : CONFIG.embuscades.ecartGroupe;
    const x = centre.x + Math.sin(angle) * rayon;
    const z = centre.z + Math.cos(angle) * rayon;
    if (solValide(monde, x, z)) positions.push({ x, z });
  }
  return positions;
}

/**
 * Cherche où faire surgir un groupe : taille tirée, puis jusqu'à `essais` positions candidates ; la première où
 * au moins `groupeMin` bandits tiennent sur un sol valide gagne. `null` si aucune (on réessaiera).
 */
export function choisirGroupe(
  monde: MondeApparition,
  joueur: PositionEmbuscade,
  orientation: number,
  alea: Aleatoire,
): PositionEmbuscade[] | null {
  const E = CONFIG.embuscades;
  const nombre = alea.entier(E.groupeMin, E.groupeMax);
  for (let essai = 0; essai < E.essais; essai++) {
    const centre = positionCandidate(joueur, orientation, alea);
    if (!solValide(monde, centre.x, centre.z)) continue;
    const positions = positionsGroupe(monde, centre, nombre, alea);
    if (positions.length >= E.groupeMin) return positions;
  }
  return null;
}
