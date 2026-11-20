// Repousse des ressources et plantation des arbres.
// Pur : aucun import de three, aucun Math.random(). Le temps est le temps de jeu, en secondes ;
// tous les délais sont dans CONFIG.repousse.
//
// - Rochers et filons réapparaissent après un délai ; plantes et fibres aussi.
// - Un buisson de baies ne disparaît pas : cueilli, il reste sans baies, puis les baies reviennent.
//   Il figure donc dans la même liste des « retirés » (le rendu choisit le modèle selon le type).
// - Les arbres ne repoussent pas seuls : on plante une pousse qui grandit en 3 stades.

import { CONFIG } from '../config';
import { INFOS_DECOR, type TypeDecor } from '../monde/decor';
import type { IdBiome } from '../monde/biomes';
import { creerAleatoire } from './aleatoire';

export type TypeArbre = 'arbre-feuillu' | 'sapin' | 'bouleau';
export const TYPES_ARBRE: readonly TypeArbre[] = ['arbre-feuillu', 'sapin', 'bouleau'];

/** Un élément retiré du décor (cassé, cueilli) : identifiant et instant du retrait. */
export interface Retire {
  id: string;
  /** Temps de jeu au moment du retrait, en secondes */
  instant: number;
}

/** Un retiré dont on connaît le type et la position (retrouvés par le rendu à partir de l'identifiant). */
export interface ElementRetire extends Retire {
  type: TypeDecor;
  x: number;
  z: number;
}

/** Vrai pour les buissons de baies, qui restent en place une fois cueillis. */
export function estBuisson(type: TypeDecor): boolean {
  return type === 'buisson-baies';
}

/** Délai de repousse d'un type en secondes de jeu, ou `null` s'il ne repousse pas (arbres, herbe). */
export function delaiRepousse(type: TypeDecor, reglages = CONFIG.repousse): number | null {
  switch (type) {
    case 'rocher':
    case 'filon-fer':
    case 'filon-cuivre':
    case 'filon-charbon':
    case 'cristal-bleu':
      return reglages.delaiRochers;
    case 'buisson-baies':
      return reglages.delaiBuissons;
    case 'plante-medicinale':
    case 'fibres':
      return reglages.delaiPlantes;
    default:
      return null;
  }
}

/**
 * Éléments qui doivent réapparaître maintenant : délai écoulé ET personnage assez loin
 * (une réapparition ne doit pas surgir sous ses yeux ; sinon l'élément attend).
 */
export function aReapparaitre(
  retires: readonly ElementRetire[],
  tempsJeu: number,
  joueur: { x: number; z: number },
  reglages = CONFIG.repousse,
): ElementRetire[] {
  return retires.filter((r) => {
    // Dans la mine (identifiants `m:<n>`), tout repousse plus vite
    const delai = r.id.startsWith('m:') ? reglages.delaiMine : delaiRepousse(r.type, reglages);
    if (delai === null || tempsJeu - r.instant < delai) return false;
    return Math.hypot(r.x - joueur.x, r.z - joueur.z) > reglages.distanceMiniJoueur;
  });
}

// --- Arbres plantés -------------------------------------------------------------------------------

/** Un arbre planté : sa forme est fixée à la plantation et sauvegardée. */
export interface Plante {
  /** Identifiant stable `p:<n>` */
  id: string;
  type: TypeArbre;
  x: number;
  z: number;
  rotation: number;
  /** Échelle de l'arbre adulte */
  echelle: number;
  variante: number;
  /** Temps de jeu à la plantation, en secondes */
  instant: number;
}

/** Stade de croissance : 0 = pousse, 1 = jeune arbre, 2 = arbre adulte. */
export type Stade = 0 | 1 | 2;

/** Essence plantée selon le biome : feuillu en prairie, mélange en forêt, sapin en montagne (bouleau en marais). */
export function essenceDuBiome(biome: IdBiome, tirage: number): TypeArbre {
  switch (biome) {
    case 'prairie':
      return 'arbre-feuillu';
    case 'foret':
      return tirage < 0.4 ? 'arbre-feuillu' : tirage < 0.8 ? 'sapin' : 'bouleau';
    case 'montagne':
      return 'sapin';
    default:
      return 'bouleau';
  }
}

/** Crée l'arbre planté numéro n : essence, forme et taille tirées de la graine et du numéro. */
export function creerPlante(
  n: number,
  x: number,
  z: number,
  biome: IdBiome,
  instant: number,
  graine: number = CONFIG.graine,
): Plante {
  const alea = creerAleatoire((Math.imul(graine | 0, 0x9e3779b1) ^ Math.imul(n + 1, 0x85ebca6b)) >>> 0);
  const type = essenceDuBiome(biome, alea.suivant());
  const infos = INFOS_DECOR[type];
  return {
    id: `p:${n}`,
    type,
    x,
    z,
    rotation: alea.suivant() * Math.PI * 2,
    echelle: infos.echelleMin + (infos.echelleMax - infos.echelleMin) * alea.suivant(),
    variante: Math.min(infos.variantes - 1, Math.floor(alea.suivant() * infos.variantes)),
    instant,
  };
}

/** Stade d'une pousse au temps donné : trois stades de même durée sur `dureeCroissance`. */
export function stadeDeCroissance(plante: Pick<Plante, 'instant'>, tempsJeu: number, reglages = CONFIG.repousse): Stade {
  const part = (tempsJeu - plante.instant) / reglages.dureeCroissance;
  if (part < 1 / 3) return 0;
  if (part < 2 / 3) return 1;
  return 2;
}

/** Part de l'échelle adulte affichée à ce stade (0 à 1). */
export function echelleDuStade(stade: Stade, reglages = CONFIG.repousse): number {
  return reglages.echellesStades[stade];
}

/** Seul l'arbre adulte se récolte et bloque le passage. */
export function estAdulte(stade: Stade): boolean {
  return stade === 2;
}

// --- Plantation -----------------------------------------------------------------------------------

/** Ce que les règles voient du terrain : fonctions passées par l'appelant (rien de three ici). */
export interface TerrainPlantation {
  hauteur(x: number, z: number): number;
  /** Pente de 0 (plat) à 1 (vertical) */
  pente(x: number, z: number): number;
  niveauEau: number;
}

/** Un arbre, un rocher ou un obstacle proche : centre et rayon occupé, en mètres. */
export interface Voisin {
  x: number;
  z: number;
  rayon: number;
}

export type RefusPlantation = 'loin' | 'eau' | 'pente' | 'village' | 'voisin';

export type ResultatPlantation = { ok: true } | { ok: false; raison: RefusPlantation };

/** Message affiché au joueur pour chaque refus. */
export const MESSAGES_REFUS: Readonly<Record<RefusPlantation, string>> = {
  loin: 'Trop loin pour planter',
  eau: "Impossible de planter dans l'eau",
  pente: 'Pente trop raide pour planter',
  village: 'Impossible de planter dans le village',
  voisin: 'Trop près d’un arbre ou d’un obstacle',
};

/** Le point (x, z) accepte-t-il une pousse ? Le premier refus rencontré est renvoyé. */
export function verifierPlantation(
  x: number,
  z: number,
  terrain: TerrainPlantation,
  voisins: readonly Voisin[],
  joueur: { x: number; z: number },
  reglages = CONFIG.repousse,
): ResultatPlantation {
  if (Math.hypot(x - joueur.x, z - joueur.z) > reglages.porteePlantation) return { ok: false, raison: 'loin' };
  const village = CONFIG.monde.village.rayon + CONFIG.decor.margeVillage;
  if (x * x + z * z < village * village) return { ok: false, raison: 'village' };
  if (terrain.hauteur(x, z) < terrain.niveauEau + CONFIG.decor.margeEau) return { ok: false, raison: 'eau' };
  if (terrain.pente(x, z) > CONFIG.decor.penteMax) return { ok: false, raison: 'pente' };
  for (const v of voisins) {
    const mini = reglages.distanceMiniVoisin + v.rayon;
    if ((v.x - x) ** 2 + (v.z - z) ** 2 < mini * mini) return { ok: false, raison: 'voisin' };
  }
  return { ok: true };
}
