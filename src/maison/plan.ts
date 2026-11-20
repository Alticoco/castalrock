// Plan de la maison du joueur (intérieur) : une seule pièce, ses meubles, ses obstacles et ses points
// d'interaction (touche E). Comme la mine, c'est une zone lointaine du même monde, où l'on arrive par la porte.
// Pur : aucun import de three, aucun Math.random().
// Repère de la pièce : centre à l'origine du plan ; x vers l'est, z vers le sud (la porte est au sud,
// la cheminée au nord, en face de la porte).

import { CONFIG } from '../config';
import type { ObstacleCercle, ObstacleRectangle } from '../regles/deplacement';
import type { PointInteraction } from '../regles/village';

export type TypeMeuble = 'lit' | 'coffre' | 'cheminee' | 'etabli' | 'table' | 'banc' | 'tapis' | 'etagere';

/** Meuble posé dans la pièce, en coordonnées du monde. */
export interface Meuble {
  id: string;
  type: TypeMeuble;
  x: number;
  z: number;
  /** Demi-tailles le long de x et de z, en mètres */
  demiLargeur: number;
  demiProfondeur: number;
  /** Faux : on marche dessus ou dessous (tapis, étagère au mur) */
  solide: boolean;
}

export interface PlanMaison {
  /** Centre de la pièce, dans le monde */
  readonly origine: { x: number; z: number };
  readonly largeur: number;
  readonly profondeur: number;
  readonly hauteur: number;
  /** Altitude du plancher */
  readonly altitude: number;
  /** Où le joueur arrive en entrant : juste devant la porte, tourné vers la cheminée */
  readonly arrivee: { x: number; z: number; orientation: number };
  /** Porte (mur sud), vue de l'intérieur */
  readonly porte: { x: number; z: number };
  readonly meubles: readonly Meuble[];
  /** Murs et meubles */
  readonly rectangles: readonly ObstacleRectangle[];
  readonly cercles: readonly ObstacleCercle[];
  /** Lit, coffre, cheminée et porte */
  readonly interactions: readonly PointInteraction[];
}

/** Marge autour de la pièce où le sol est encore plat (zone réservée à la maison). */
const MARGE_ZONE = 12;
/** Épaisseur des murs de collision : assez pour qu'on ne les traverse pas en courant */
const EPAISSEUR_MUR = 1;

/** Vrai si (x, z) est dans la zone réservée à l'intérieur de la maison (pièce et marge autour). */
export function contientZoneMaison(x: number, z: number): boolean {
  const { origine, largeur, profondeur } = CONFIG.maison;
  return Math.abs(x - origine.x) < largeur / 2 + MARGE_ZONE && Math.abs(z - origine.z) < profondeur / 2 + MARGE_ZONE;
}

/** Meubles dans le repère de la pièce : [id, type, x, z, demi-largeur, demi-profondeur, solide]. */
const MEUBLES: ReadonlyArray<readonly [string, TypeMeuble, number, number, number, number, boolean]> = [
  // Cheminée au milieu du mur nord, en face de la porte
  ['cheminee', 'cheminee', 0, -2.55, 1.05, 0.45, true],
  // Lit le long du mur ouest, tête au nord ; coffre au pied du lit
  ['lit', 'lit', -3.3, -1.8, 0.6, 1.1, true],
  ['coffre', 'coffre', -3.3, -0.2, 0.5, 0.35, true],
  // Établi à droite de la cheminée
  ['etabli', 'etabli', 2.6, -2.6, 0.85, 0.35, true],
  // Table le long du mur est, un banc de chaque côté
  ['table', 'table', 2.95, 0.9, 0.45, 1.0, true],
  ['banc-ouest', 'banc', 2.15, 0.9, 0.18, 0.8, true],
  ['banc-est', 'banc', 3.72, 0.9, 0.18, 0.8, true],
  ['tapis', 'tapis', -0.2, -0.3, 1.3, 0.9, false],
  ['etagere-ouest', 'etagere', -3.82, 1.3, 0.18, 0.8, false],
  ['etagere-est', 'etagere', 3.82, -1.2, 0.18, 0.7, false],
];

/** Plan de la maison : le même à chaque appel (rien d'aléatoire). */
export function creerPlanMaison(): PlanMaison {
  const { origine, largeur, profondeur, hauteur, altitude } = CONFIG.maison;
  const dl = largeur / 2;
  const dp = profondeur / 2;
  const e = EPAISSEUR_MUR / 2;
  const rect = (x: number, z: number, demiLargeur: number, demiProfondeur: number): ObstacleRectangle => ({
    x: origine.x + x,
    z: origine.z + z,
    demiLargeur,
    demiProfondeur,
    angle: 0,
  });

  const meubles: Meuble[] = MEUBLES.map(([id, type, x, z, demiLargeur, demiProfondeur, solide]) => ({
    id,
    type,
    x: origine.x + x,
    z: origine.z + z,
    demiLargeur,
    demiProfondeur,
    solide,
  }));

  const rectangles: ObstacleRectangle[] = [
    // Murs nord, sud, ouest, est : posés juste derrière la face visible
    rect(0, -dp - e, dl + EPAISSEUR_MUR, e),
    rect(0, dp + e, dl + EPAISSEUR_MUR, e),
    rect(-dl - e, 0, e, dp + EPAISSEUR_MUR),
    rect(dl + e, 0, e, dp + EPAISSEUR_MUR),
    ...meubles.filter((m) => m.solide).map((m) => ({ x: m.x, z: m.z, demiLargeur: m.demiLargeur, demiProfondeur: m.demiProfondeur, angle: 0 })),
  ];

  const meuble = (id: string): Meuble => {
    const m = meubles.find((x) => x.id === id);
    if (!m) throw new Error(`Meuble inconnu : ${id}`);
    return m;
  };
  const point = (type: PointInteraction['type'], id: string, invite: string): PointInteraction => {
    const m = meuble(id);
    return { type, x: m.x, z: m.z, rayon: Math.min(m.demiLargeur, m.demiProfondeur), invite };
  };
  const porte = { x: origine.x, z: origine.z + dp };

  return {
    origine: { x: origine.x, z: origine.z },
    largeur,
    profondeur,
    hauteur,
    altitude,
    arrivee: { x: porte.x, z: porte.z - 0.9, orientation: Math.PI },
    porte,
    meubles,
    rectangles,
    cercles: [],
    interactions: [
      point('lit', 'lit', 'se reposer dans votre lit'),
      point('coffre', 'coffre', 'ouvrir le coffre (celui du village)'),
      point('cheminee', 'cheminee', 'cuisiner'),
      { type: 'maison', x: porte.x, z: porte.z, rayon: 0.3, invite: 'sortir de chez vous' },
    ],
  };
}

/** Vrai si (x, z) est dans la pièce, à plus de `marge` mètres des murs. */
export function dansLaPiece(plan: PlanMaison, x: number, z: number, marge = 0): boolean {
  return Math.abs(x - plan.origine.x) <= plan.largeur / 2 - marge && Math.abs(z - plan.origine.z) <= plan.profondeur / 2 - marge;
}

/** Vrai si un personnage peut se tenir en (x, z) : dans la pièce et hors des meubles. */
export function estLibre(plan: PlanMaison, x: number, z: number): boolean {
  if (!dansLaPiece(plan, x, z)) return false;
  return !plan.meubles.some((m) => m.solide && Math.abs(x - m.x) < m.demiLargeur && Math.abs(z - m.z) < m.demiProfondeur);
}

/**
 * Distance à laquelle la caméra peut reculer depuis (ox, oy, oz) dans la direction (dx, dy, dz) sans
 * traverser un mur, le plancher ou le plafond (au plus `max`).
 */
export function distanceLibre(
  plan: PlanMaison,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  max: number,
  marge = 0.4,
): number {
  const pas = 0.1;
  let libre = 0;
  for (let d = pas; d <= max + 1e-6; d += pas) {
    const y = oy + dy * d - plan.altitude;
    if (y > plan.hauteur - marge || y < marge) return libre;
    if (!dansLaPiece(plan, ox + dx * d, oz + dz * d, marge)) return libre;
    libre = d;
  }
  return max;
}
