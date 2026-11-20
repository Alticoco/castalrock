// Géométrie de l'écran des compétences en étoile : où se place chaque nœud autour du centre.
// Pur : aucun import de three, aucun Math.random(). Les coordonnées sont relatives au centre de l'étoile
// (x vers la droite, y vers le bas, en pixels de l'écran avant zoom).
// Toutes les branches partent du même cercle intérieur et finissent sur le même cercle extérieur :
// les rangées d'une branche se répartissent sur cette longueur, qu'elle ait 2 ou 4 rangées.

import { noeudsDeLaBranche, type Branche, type Noeud } from './competences';

/** Direction de chaque branche depuis le centre, en degrés (0 = droite, -90 = haut). */
export const ANGLES_BRANCHE: Readonly<Record<Branche, number>> = {
  combat: -90,
  defense: -30,
  recolte: 30,
  artisanat: 90,
  chasse: 150,
  magie: 210,
};

export interface ParametresEtoile {
  /** Rayon du cercle où commencent les branches (rangée 0) */
  readonly rayonInterieur: number;
  /** Rayon du cercle où finissent toutes les branches (dernière rangée) */
  readonly rayonExterieur: number;
  /** Écart en degrés entre deux colonnes voisines d'une même branche */
  readonly ecartDegres: number;
}

export const PARAMETRES_ETOILE: ParametresEtoile = { rayonInterieur: 160, rayonExterieur: 345, ecartDegres: 20 };

/** Dernière rangée d'une branche (au moins 1, pour ne jamais diviser par zéro). */
export function rangeeMax(branche: Branche): number {
  return Math.max(1, ...noeudsDeLaBranche(branche).map((n) => n.ligne));
}

/** Distance du nœud au centre. */
export function rayonNoeud(n: Noeud, p: ParametresEtoile = PARAMETRES_ETOILE): number {
  return p.rayonInterieur + (n.ligne / rangeeMax(n.branche)) * (p.rayonExterieur - p.rayonInterieur);
}

/** Position du nœud par rapport au centre de l'étoile. */
export function positionNoeud(n: Noeud, p: ParametresEtoile = PARAMETRES_ETOILE): { x: number; y: number } {
  const angle = ((ANGLES_BRANCHE[n.branche] + (n.colonne - 1) * p.ecartDegres) * Math.PI) / 180;
  const r = rayonNoeud(n, p);
  return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
}
