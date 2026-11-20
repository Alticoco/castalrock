// Frappe (geste d'outil) : minuterie pure, sans rendu.
// Un clic lance un geste ; tant que le clic est maintenu, les gestes s'enchaînent.
// L'impact a lieu à un instant précis du geste (CONFIG.personnage.frappe.instantImpact).

import { CONFIG } from '../config';

export interface EtatFrappe {
  /** Avancement du geste en cours, de 0 à 1 ; -1 = aucun geste */
  progression: number;
}

export function creerEtatFrappe(): EtatFrappe {
  return { progression: -1 };
}

/** Fait avancer la frappe de dt secondes. `impact` vaut vrai sur le pas où le coup porte. */
export function pasDeFrappe(
  etat: EtatFrappe,
  clicMaintenu: boolean,
  dt: number,
): { etat: EtatFrappe; impact: boolean } {
  const F = CONFIG.personnage.frappe;
  let p = etat.progression;
  if (p < 0) {
    if (!clicMaintenu) return { etat, impact: false };
    p = 0;
  }
  const avant = p;
  p += dt / F.duree;
  const impact = avant < F.instantImpact && p >= F.instantImpact;
  if (p >= 1) p = clicMaintenu ? p - 1 : -1;
  return { etat: { progression: p }, impact };
}

const lisse = (t: number) => t * t * (3 - 2 * t);

/**
 * Forme du geste pour l'animation, à partir de l'avancement (0 à 1) :
 * `poids` = part de la pose de frappe (0 = pose normale), `abattement` = 0 bras levé, 1 bras abattu.
 */
export function gesteFrappe(progression: number): { poids: number; abattement: number } {
  const F = CONFIG.personnage.frappe;
  if (progression < 0) return { poids: 0, abattement: 0 };
  if (progression < F.finArmement) return { poids: lisse(progression / F.finArmement), abattement: 0 };
  if (progression < F.instantImpact) {
    const u = (progression - F.finArmement) / (F.instantImpact - F.finArmement);
    return { poids: 1, abattement: u * u };
  }
  const u = Math.min(1, (progression - F.instantImpact) / (1 - F.instantImpact));
  return { poids: 1 - lisse(u), abattement: 1 };
}

// --- Coup puissant (épée) : clic maintenu, puis relâché ----------------------------------------

export interface EtatCharge {
  /** Secondes de clic maintenu ; -1 = aucun clic en cours */
  temps: number;
}

export function creerEtatCharge(): EtatCharge {
  return { temps: -1 };
}

/** Ce que déclenche le relâchement du clic : rien, un coup normal (clic court) ou un coup puissant (clic assez long). */
export type FinDeCharge = 'aucune' | 'normale' | 'puissante';

/**
 * Avec le nœud Coup puissant et l'épée en main, le coup part au relâchement du clic : normal si le clic
 * a duré moins de `duree` secondes, puissant sinon. Tant que le clic est maintenu, rien ne part.
 */
export function pasDeCharge(
  etat: EtatCharge,
  clicMaintenu: boolean,
  dt: number,
  duree: number = CONFIG.progression.arbre.coupPuissant.duree,
): { etat: EtatCharge; fin: FinDeCharge } {
  if (clicMaintenu) return { etat: { temps: Math.max(0, etat.temps) + Math.max(0, dt) }, fin: 'aucune' };
  if (etat.temps < 0) return { etat, fin: 'aucune' };
  return { etat: { temps: -1 }, fin: etat.temps >= duree ? 'puissante' : 'normale' };
}

/**
 * Avancement visible de la charge (0 à 1) : l'épée ne recule qu'après `debut` secondes de clic
 * (un clic court ne la fait pas bouger), et la charge est pleine à `duree`.
 */
export function progressionCharge(
  etat: EtatCharge,
  duree: number = CONFIG.progression.arbre.coupPuissant.duree,
  debut: number = CONFIG.bouclier.debutCharge,
): number {
  if (etat.temps <= debut) return 0;
  return Math.min(1, (etat.temps - debut) / Math.max(1e-6, duree - debut));
}

/** Facteur de dégâts d'un coup d'épée : ×2,5 pour un coup puissant, ×2 pour une riposte (les deux se multiplient). */
export function facteurCoupEpee(puissant: boolean, facteurRiposte = 1): number {
  return (puissant ? CONFIG.progression.arbre.coupPuissant.facteur : 1) * facteurRiposte;
}
