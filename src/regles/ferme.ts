// Poules et moutons du village : chacun a un point d'attache et un rayon, choisit une cible au hasard dans ce rayon,
// y marche lentement, s'arrête quelques secondes (picorer, brouter), puis recommence. Pur : aucun import de three,
// aucun Math.random() (le hasard vient d'un générateur à graine, un par animal). Réglages : CONFIG.ferme.
// Les poules évitent les obstacles du village ; les moutons restent dans l'enclos (EMPRISE_ENCLOS, src/scene/modelesFerme.ts).
// Branchement dans le jeu : src/jeu/ferme.ts.

import { CONFIG } from '../config';
import type { Aleatoire } from './aleatoire';
import { pointLibre, segmentLibre, type Point } from './habitants';
import { decrireVillage, pointLocal, type ElementVillage, type NiveauVillage, type ObstaclesVillage } from './village';

export type EspeceAnimal = 'poule' | 'mouton';

/** Demi-dimensions de l'enclos (axe des poteaux, mètres) : mêmes valeurs que EMPRISE_ENCLOS (src/scene/modelesFerme.ts). */
const ENCLOS = { demiLargeur: 3.5, demiProfondeur: 2.5 } as const;
/** Auge et botte de foin de l'enclos, dans son repère (centre x, z et rayon) : les moutons les évitent. */
const OBJETS_ENCLOS: ReadonlyArray<readonly [number, number, number]> = [
  [-2.2, -1.75, 1.0],
  [1.8, -1.65, 1.5],
];

export interface DefinitionAnimal {
  id: string;
  espece: EspeceAnimal;
  /** Variante du modèle (couleur) */
  variante: number;
  /** Point d'attache et rayon de promenade (poules) */
  attache: Point;
  rayon: number;
  /** Mouton : l'enclos dans lequel il reste (null pour une poule) */
  enclos: ElementVillage | null;
  /** Graine du générateur de l'animal */
  graine: number;
}

export interface EtatAnimal {
  x: number;
  z: number;
  /** Lacet du regard : la direction de la dernière marche */
  orientation: number;
  /** Cible en cours de marche, ou null à l'arrêt */
  cible: Point | null;
  /** Temps d'arrêt restant (s) */
  attente: number;
  /** Arrêté : picore ou broute (sinon il reste simplement debout) */
  activite: boolean;
}

/** Un élément du village à ce niveau, par identifiant. */
function trouver(niveau: NiveauVillage, id: string): ElementVillage | undefined {
  return decrireVillage(niveau).elements.find((e) => e.id === id);
}

/**
 * Animaux du village à ce niveau : 5 poules (niveau 1 : près de la maison `maison-2` ; niveau 2 et plus : 3 près de la
 * maison et 2 près du potager), et au niveau 2 et plus 3 moutons dans l'enclos.
 */
export function decrireFerme(niveau: NiveauVillage, r = CONFIG.ferme): DefinitionAnimal[] {
  const animaux: DefinitionAnimal[] = [];
  const maison = trouver(niveau, 'maison-2');
  const potager = trouver(niveau, 'potager');
  const enclos = trouver(niveau, 'enclos');
  const pointMaison = maison ? pointLocal(maison, 2.2, maison.demiProfondeur + 1.8) : { x: -12, z: 8 };
  const pointPotager = potager ? pointLocal(potager, 0, potager.demiProfondeur + 2) : pointMaison;
  for (let i = 0; i < r.poules.nombre; i++) {
    const auPotager = potager !== undefined && i >= r.poules.nombre - 2;
    animaux.push({
      id: `poule-${i}`,
      espece: 'poule',
      variante: i % 3,
      attache: auPotager ? pointPotager : pointMaison,
      rayon: r.poules.rayon,
      enclos: null,
      graine: r.graine + i * 101,
    });
  }
  if (enclos) {
    for (let i = 0; i < r.moutons.nombre; i++) {
      animaux.push({ id: `mouton-${i}`, espece: 'mouton', variante: i % 2, attache: { x: enclos.x, z: enclos.z }, rayon: 0, enclos, graine: r.graine + 500 + i * 101 });
    }
  }
  return animaux;
}

/** L'auge et le foin de l'enclos, en cercles du monde : les moutons les évitent. */
function objetsEnclos(enclos: ElementVillage): ObstaclesVillage {
  return {
    cercles: OBJETS_ENCLOS.map(([lx, lz, rayon]) => ({ ...pointLocal(enclos, lx, lz), rayon })),
    rectangles: [],
  };
}

/** Point tiré dans le rayon de l'animal (poule : disque autour de l'attache ; mouton : intérieur de l'enclos), sans tenir compte des obstacles. */
function tirerPoint(def: DefinitionAnimal, alea: Aleatoire, r: typeof CONFIG.ferme): Point {
  if (def.enclos) {
    const lx = alea.entre(-(ENCLOS.demiLargeur - r.margeEnclos), ENCLOS.demiLargeur - r.margeEnclos);
    const lz = alea.entre(-(ENCLOS.demiProfondeur - r.margeEnclos), ENCLOS.demiProfondeur - r.margeEnclos);
    return pointLocal(def.enclos, lx, lz);
  }
  const angle = alea.entre(0, 2 * Math.PI);
  const d = def.rayon * Math.sqrt(alea.suivant());
  return { x: def.attache.x + Math.sin(angle) * d, z: def.attache.z + Math.cos(angle) * d };
}

/** Obstacles à éviter pour cet animal : ceux du village (poule) ou l'auge et le foin (mouton). */
function obstaclesDe(def: DefinitionAnimal, village: ObstaclesVillage): ObstaclesVillage {
  return def.enclos ? objetsEnclos(def.enclos) : village;
}

/** Une cible libre, atteignable en ligne droite depuis `depuis` ; null si rien n'a été trouvé après quelques essais. */
export function choisirCible(def: DefinitionAnimal, depuis: Point, alea: Aleatoire, village: ObstaclesVillage, r = CONFIG.ferme): Point | null {
  const obstacles = obstaclesDe(def, village);
  for (let essai = 0; essai < 12; essai++) {
    const p = tirerPoint(def, alea, r);
    if (pointLibre(p, obstacles, r.margeObstacle) && segmentLibre(depuis, p, obstacles, r.margeObstacle)) return p;
  }
  return null;
}

/** Vitesse de marche (m/s) de l'espèce. */
export function vitesseAnimal(espece: EspeceAnimal, r = CONFIG.ferme): number {
  return espece === 'poule' ? r.poules.vitesse : r.moutons.vitesse;
}

/** État de départ : l'animal est posé au hasard dans son rayon, à l'arrêt, avec un temps d'attente déjà entamé. */
export function creerEtatAnimal(def: DefinitionAnimal, alea: Aleatoire, village: ObstaclesVillage, r = CONFIG.ferme): EtatAnimal {
  const obstacles = obstaclesDe(def, village);
  let p: Point = def.attache;
  for (let essai = 0; essai < 20; essai++) {
    const q = tirerPoint(def, alea, r);
    if (pointLibre(q, obstacles, r.margeObstacle)) {
      p = q;
      break;
    }
  }
  return { x: p.x, z: p.z, orientation: alea.entre(-Math.PI, Math.PI), cible: null, attente: alea.entre(0, r.pause.max), activite: true };
}

/**
 * Fait avancer un animal de `dt` secondes. À l'arrêt il attend, puis choisit une cible et y marche à la vitesse de son espèce ;
 * arrivé, il s'arrête 2 à 6 s (la plupart du temps pour picorer ou brouter). `immobile` (nuit) : il finit son pas et ne repart pas.
 */
export function avancerAnimal(def: DefinitionAnimal, etat: EtatAnimal, dt: number, alea: Aleatoire, village: ObstaclesVillage, immobile = false, r = CONFIG.ferme): EtatAnimal {
  if (etat.cible) {
    const dx = etat.cible.x - etat.x;
    const dz = etat.cible.z - etat.z;
    const reste = Math.hypot(dx, dz);
    const pas = vitesseAnimal(def.espece, r) * dt;
    if (reste > pas) return { ...etat, x: etat.x + (dx / reste) * pas, z: etat.z + (dz / reste) * pas, orientation: Math.atan2(dx, dz) };
    // Arrivé : pause
    return { x: etat.cible.x, z: etat.cible.z, orientation: etat.orientation, cible: null, attente: alea.entre(r.pause.min, r.pause.max), activite: alea.suivant() < r.chanceActivite };
  }
  if (immobile) return { ...etat, activite: false };
  const attente = etat.attente - dt;
  if (attente > 0) return { ...etat, attente };
  const cible = choisirCible(def, etat, alea, village, r);
  if (!cible) return { ...etat, attente: alea.entre(r.pause.min, r.pause.max) };
  return { ...etat, cible, attente: 0, orientation: Math.atan2(cible.x - etat.x, cible.z - etat.z), activite: false };
}
