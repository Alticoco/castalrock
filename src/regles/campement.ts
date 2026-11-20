// Campement : feu de camp posable (touche G), repos à l'auberge ou au feu, points de réapparition.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable.
// Le temps est le temps de jeu, en secondes ; l'heure du jeu va de 0 à 24 (voir temps.ts).

import { CONFIG } from '../config';
import { definirPointReapparition, type PointReapparition } from './mort';
import {
  MESSAGES_REFUS,
  verifierPlantation,
  type RefusPlantation,
  type ResultatPlantation,
  type TerrainPlantation,
  type Voisin,
} from './repousse';
import { heureDuJeu } from './temps';
import { decrireVillage, pointLocal, type NiveauVillage } from './village';

/** Objet de l'inventaire consommé pour poser un feu. */
export const OBJET_KIT_FEU = 'kit-feu-camp';

/** Le feu de camp posé par le joueur (un seul à la fois). */
export interface FeuCamp {
  readonly x: number;
  readonly z: number;
}

/** Point du sol à `distance` mètres devant un personnage de lacet `orientation` (l'avant est (sin, cos)). */
export function positionDevant(
  x: number,
  z: number,
  orientation: number,
  distance: number = CONFIG.campement.distancePoseFeu,
): { x: number; z: number } {
  return { x: x + Math.sin(orientation) * distance, z: z + Math.cos(orientation) * distance };
}

/** Message affiché au joueur pour chaque refus de pose. */
export const MESSAGES_REFUS_FEU: Readonly<Record<RefusPlantation, string>> = {
  ...MESSAGES_REFUS,
  loin: 'Trop loin pour poser un feu',
  eau: "Impossible de poser un feu dans l'eau",
  pente: 'Pente trop raide pour un feu de camp',
  village: 'Impossible de poser un feu dans le village',
  voisin: 'Trop près d’un arbre ou d’un obstacle',
};

/** Le point (x, z) accepte-t-il un feu ? Mêmes règles qu'une plantation (eau, pente, village, voisins), voisins un peu moins stricts. */
export function verifierPoseFeu(
  x: number,
  z: number,
  terrain: TerrainPlantation,
  voisins: readonly Voisin[],
): ResultatPlantation {
  const reglages = { ...CONFIG.repousse, distanceMiniVoisin: CONFIG.campement.distanceMiniVoisinFeu };
  return verifierPlantation(x, z, terrain, voisins, { x, z }, reglages);
}

export interface ResultatPose {
  /** Le nouveau feu */
  feu: FeuCamp;
  /** L'ancien feu, éteint par la pose (`null` s'il n'y en avait pas) */
  eteint: FeuCamp | null;
}

/** Pose un feu en (x, z) : l'ancien, s'il existe, est éteint (un seul feu actif). */
export function poserFeuCamp(ancien: FeuCamp | null, x: number, z: number): ResultatPose {
  return { feu: { x, z }, eteint: ancien };
}

/** Lieu de réapparition associé à un feu : à côté du feu (au sud), pas dans les flammes. */
export function pointReapparitionFeu(feu: FeuCamp): PointReapparition {
  return definirPointReapparition(feu.x, feu.z + CONFIG.campement.decalageReapparitionFeu, 'Feu de camp');
}

/** Lieu de réapparition devant la porte de l'auberge ; `null` si le village n'a pas d'auberge (niveau 1). */
export function pointReapparitionAuberge(niveau: NiveauVillage): PointReapparition | null {
  const auberge = decrireVillage(niveau).elements.find((e) => e.type === 'auberge');
  if (!auberge) return null;
  const p = pointLocal(auberge, 0, auberge.demiProfondeur + CONFIG.campement.distanceReapparitionAuberge);
  return definirPointReapparition(p.x, p.z, 'Auberge');
}

/** Vrai si le repos saute la nuit à cette heure (après l'heure de début, ou avant l'heure de fin ; passe minuit). */
export function estNuitDeRepos(heure: number): boolean {
  const C = CONFIG.campement;
  return heure >= C.heureDebutNuit || heure < C.heureFinNuit;
}

export interface ResultatRepos {
  /** Vie après le repos : toujours le maximum */
  vie: number;
  /** Temps de jeu après le repos : avancé jusqu'au réveil si c'était la nuit, sinon inchangé */
  tempsJeu: number;
  /** Vrai si la nuit a été sautée */
  nuitPassee: boolean;
}

/** Se reposer : la vie revient au maximum ; si c'est la nuit, le temps avance jusqu'à l'heure du réveil. */
export function seReposer(pvMax: number, tempsJeu: number): ResultatRepos {
  const heure = heureDuJeu(tempsJeu, CONFIG.temps);
  if (!estNuitDeRepos(heure)) return { vie: pvMax, tempsJeu, nuitPassee: false };
  // Heures à attendre jusqu'au réveil (toujours entre 0 et 24, la nuit étant avant lui)
  const heures = (((CONFIG.campement.heureReveil - heure) % 24) + 24) % 24;
  return { vie: pvMax, tempsJeu: tempsJeu + (heures / 24) * CONFIG.temps.dureeJourSecondes, nuitPassee: true };
}
