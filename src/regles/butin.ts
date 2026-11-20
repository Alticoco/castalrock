// Butin d'ennemi : ce qui rentre dans l'inventaire porté puis dans le sac magique est pris,
// le reste est laissé au sol dans un petit sac que le joueur ramasse (E), tant qu'il n'a pas disparu.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable.

import { agrandir, ajouter, type Conteneur, type Pile } from './inventaire';

/** L'Éclat du Cœur : objet unique de l'histoire, qui ne doit jamais être perdu. */
export const ID_ECLAT_COEUR = 'eclat-coeur';

/** Petit sac laissé au sol : position, contenu et âge (secondes de jeu). Jamais sauvegardé. */
export interface ButinAuSol {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly contenu: readonly Pile[];
  readonly age: number;
}

export interface Repartition {
  inventaire: Conteneur;
  sac: Conteneur;
  /** Ce qui a été pris, par objet */
  obtenu: Record<string, number>;
  /** Ce qui ne rentre nulle part (vide si tout est pris) */
  reste: Pile[];
}

/** Un butin sous forme { objet: quantité } en liste de piles (les quantités nulles sont ignorées). */
export function pilesDuButin(butin: Readonly<Record<string, number>>): Pile[] {
  return Object.entries(butin)
    .map(([objet, quantite]) => ({ objet, quantite: Math.floor(quantite) }))
    .filter((p) => p.quantite > 0);
}

/** Range le butin dans l'inventaire porté, puis dans le sac magique ; ce qui ne rentre pas est renvoyé dans `reste`. */
export function repartirButin(inventaire: Conteneur, sac: Conteneur, butin: readonly Pile[]): Repartition {
  let porte = inventaire;
  let range = sac;
  const obtenu: Record<string, number> = {};
  const reste: Pile[] = [];
  for (const { objet, quantite } of butin) {
    const dansPorte = ajouter(porte, objet, quantite);
    porte = dansPorte.conteneur;
    const dansSac = ajouter(range, objet, dansPorte.reste);
    range = dansSac.conteneur;
    const pris = quantite - dansSac.reste;
    if (pris > 0) obtenu[objet] = (obtenu[objet] ?? 0) + pris;
    if (dansSac.reste > 0) reste.push({ objet, quantite: dansSac.reste });
  }
  return { inventaire: porte, sac: range, obtenu, reste };
}

export interface MiseAAbri {
  inventaire: Conteneur;
  coffre: Conteneur;
  /** Où l'objet a fini : l'inventaire porté, ou le coffre du village */
  lieu: 'inventaire' | 'coffre';
}

/**
 * Met un objet unique à l'abri : dans l'inventaire porté s'il y a une case, sinon dans le coffre du village
 * (agrandi d'une case si même lui est plein). L'objet n'est donc jamais perdu.
 */
export function mettreAAbri(inventaire: Conteneur, coffre: Conteneur, objet: string): MiseAAbri {
  const porte = ajouter(inventaire, objet, 1);
  if (porte.reste === 0) return { inventaire: porte.conteneur, coffre, lieu: 'inventaire' };
  const dansCoffre = ajouter(coffre, objet, 1);
  if (dansCoffre.reste === 0) return { inventaire, coffre: dansCoffre.conteneur, lieu: 'coffre' };
  return { inventaire, coffre: ajouter(agrandir(coffre, coffre.cases.length + 1), objet, 1).conteneur, lieu: 'coffre' };
}

/** Fait vieillir les sacs de `dt` secondes et retire ceux qui ont atteint `duree`. */
export function vieillirButins(sacs: readonly ButinAuSol[], dt: number, duree: number): ButinAuSol[] {
  return sacs.map((s) => ({ ...s, age: s.age + dt })).filter((s) => s.age < duree);
}

/** Sac le plus proche de (x, z) dans la portée, ou null. */
export function butinAPortee(sacs: readonly ButinAuSol[], x: number, z: number, portee: number): ButinAuSol | null {
  let meilleur: ButinAuSol | null = null;
  let distance = portee;
  for (const s of sacs) {
    const d = Math.hypot(s.x - x, s.z - z);
    if (d <= distance) {
      meilleur = s;
      distance = d;
    }
  }
  return meilleur;
}
