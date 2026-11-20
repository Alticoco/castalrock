// Indices de direction : « au sud-est du village, à environ 350 pas ». La boussole ne guide plus vers les quêtes
// (décision du 19/11/2026) : les habitants disent où aller, et le journal des quêtes recopie l'indice.
// Les lieux sont placés par la graine du monde : la direction et la distance sont donc calculées d'après leur vraie
// position. Pur : aucun import de three, aucun Math.random().
//
// Repères du monde (voir src/regles/miniCarte.ts) : +x à l'est, +z au sud.

/** Les huit directions, dans l'ordre des aiguilles d'une montre en partant du nord. */
export const DIRECTIONS = ['nord', 'nord-est', 'est', 'sud-est', 'sud', 'sud-ouest', 'ouest', 'nord-ouest'] as const;
export type Direction = (typeof DIRECTIONS)[number];

/** Direction (parmi huit) du vecteur (dx, dz) ; un vecteur nul donne « nord ». */
export function direction8(dx: number, dz: number): Direction {
  if (dx === 0 && dz === 0) return 'nord';
  // Angle depuis le nord (−z), dans le sens des aiguilles d'une montre (vers +x, l'est)
  const angle = Math.atan2(dx, -dz);
  const secteur = Math.round(angle / (Math.PI / 4));
  return DIRECTIONS[((secteur % 8) + 8) % 8];
}

/** « au nord », « à l'est », « au sud-ouest »… */
export function versDirection(direction: Direction): string {
  return direction === 'est' || direction === 'ouest' ? `à l’${direction}` : `au ${direction}`;
}

/** Distance arrondie pour un habitant qui parle : à 50 près au-delà de 100, à 10 près en dessous (jamais 0). */
export function distanceParlee(metres: number): number {
  const m = Math.abs(metres);
  if (m < 100) return Math.max(10, Math.round(m / 10) * 10);
  return Math.round(m / 50) * 50;
}

/** Ce qu'un indice dit d'un lieu vu depuis un point de départ (le village par défaut). */
export interface Indice {
  direction: Direction;
  /** « au sud-est », « à l'ouest » */
  vers: string;
  /** Distance arrondie, en mètres (un pas = un mètre) */
  distance: number;
}

/** Indice pour aller du point de départ (le centre du village par défaut) au lieu (x, z). */
export function indiceVers(x: number, z: number, depart: { x: number; z: number } = { x: 0, z: 0 }): Indice {
  const direction = direction8(x - depart.x, z - depart.z);
  return { direction, vers: versDirection(direction), distance: distanceParlee(Math.hypot(x - depart.x, z - depart.z)) };
}

/** Les lieux dont les habitants indiquent le chemin (voir `remplirIndices`). */
export type NomIndice = 'aldric' | 'mine' | 'camp' | 'ruines';

/**
 * Remplit les textes à trous qui nomment le lieu : `{direction:camp}` (« au sud »), `{distance:camp}` (« 350 »).
 * Un lieu sans indice laisse son texte tel quel. Exemple : « Son camp est {direction:camp} du village, à environ {distance:camp} pas. »
 */
export function remplirIndices(modele: string, indices: Partial<Record<NomIndice, Indice>>): string {
  return modele.replace(/\{(direction|distance):(\w+)\}/g, (tout, quoi: string, nom: string) => {
    const indice = indices[nom as NomIndice];
    if (!indice) return tout;
    return quoi === 'direction' ? indice.vers : String(indice.distance);
  });
}
