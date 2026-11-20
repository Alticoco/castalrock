// Options graphiques : valeurs des choix « distance de vue » et « ombres ». Pur : aucun import de three.

import { CONFIG } from '../config';

export type DistanceVue = keyof typeof CONFIG.graphismes.distanceVue.rayons;
export type QualiteOmbres = keyof typeof CONFIG.graphismes.ombres.resolutions;

export const DISTANCES_VUE = Object.keys(CONFIG.graphismes.distanceVue.rayons) as DistanceVue[];
export const QUALITES_OMBRES = Object.keys(CONFIG.graphismes.ombres.resolutions) as QualiteOmbres[];

export function estDistanceVue(valeur: unknown): valeur is DistanceVue {
  return typeof valeur === 'string' && (DISTANCES_VUE as string[]).includes(valeur);
}

export function estQualiteOmbres(valeur: unknown): valeur is QualiteOmbres {
  return typeof valeur === 'string' && (QUALITES_OMBRES as string[]).includes(valeur);
}

export interface ParametresVue {
  /** Rayon de chargement des chunks autour du joueur */
  rayonChargement: number;
  /** Au-delà de ce rayon, les chunks sont déchargés */
  rayonDechargement: number;
  /** Brouillard : début et fin, en mètres */
  brouillardDebut: number;
  brouillardFin: number;
  /** Distance maximale d'affichage de la caméra, en mètres */
  distanceMax: number;
}

/** Tout ce qui dépend de la distance de vue : chunks, brouillard (qui masque le bord du monde chargé) et caméra. */
export function parametresVue(distance: DistanceVue): ParametresVue {
  const rayon = CONFIG.graphismes.distanceVue.rayons[distance];
  const portee = (rayon - 0.5) * CONFIG.monde.tailleChunk;
  return {
    rayonChargement: rayon,
    rayonDechargement: rayon + 1.5,
    brouillardDebut: Math.round(portee * CONFIG.brouillard.partDebut),
    brouillardFin: Math.round(portee * CONFIG.brouillard.partFin),
    distanceMax: Math.round(portee),
  };
}

/** Résolution de la carte d'ombres pour un choix (0 = ombres éteintes). */
export function resolutionOmbres(qualite: QualiteOmbres): number {
  return CONFIG.graphismes.ombres.resolutions[qualite];
}
