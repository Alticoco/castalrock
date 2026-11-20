// Mort douce : à la mort, l'inventaire porté est déposé dans un baluchon à l'endroit de la chute,
// récupérable plus tard. Le sac magique, le coffre et l'équipement ne sont jamais perdus ; l'équipement s'use.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable.

import { CONFIG } from '../config';
import { userTout, type Equipement } from './equipement';
import { ajouter, creerConteneur, type Conteneur, type Pile } from './inventaire';
import { APPARITION } from './village';

/** Sac laissé à l'endroit de la mort : position au sol et contenu (une entrée par type d'objet). */
export interface Baluchon {
  readonly x: number;
  readonly z: number;
  readonly contenu: readonly Pile[];
}

/** Lieu où le joueur reprend vie (la place du village par défaut ; l'auberge et le feu de camp existent aussi). */
export interface PointReapparition {
  readonly x: number;
  readonly z: number;
  readonly nom: string;
}

export const POINT_REAPPARITION_DEFAUT: PointReapparition = { x: APPARITION.x, z: APPARITION.z, nom: 'Place du village' };

/** Nouveau point de réapparition (appelé par l'auberge ou le feu de camp). */
export function definirPointReapparition(x: number, z: number, nom: string): PointReapparition {
  return { x, z, nom };
}

/** Piles non vides d'un conteneur. */
function pilesDe(c: Conteneur): Pile[] {
  return c.cases.filter((p): p is Pile => p !== null);
}

/** Additionne des piles par type d'objet (ordre de première apparition). */
function regrouper(piles: readonly Pile[]): Pile[] {
  const totaux = new Map<string, number>();
  for (const p of piles) totaux.set(p.objet, (totaux.get(p.objet) ?? 0) + p.quantite);
  return [...totaux].map(([objet, quantite]) => ({ objet, quantite }));
}

export interface ResultatDepot {
  /** Baluchon après la mort (`null` s'il n'y en a pas) */
  baluchon: Baluchon | null;
  /** Inventaire porté après la mort : vide, mêmes cases */
  inventaire: Conteneur;
}

/**
 * Dépose tout l'inventaire porté dans un baluchon à (x, z). Un ancien baluchon est fusionné dans le nouveau
 * (rien ne disparaît). Si l'inventaire est vide, l'ancien baluchon reste où il est ; sans rien, pas de baluchon.
 */
export function deposerBaluchon(inventaire: Conteneur, x: number, z: number, ancien: Baluchon | null): ResultatDepot {
  const portees = pilesDe(inventaire);
  const vide = creerConteneur(inventaire.cases.length);
  if (portees.length === 0) return { baluchon: ancien, inventaire: vide };
  const contenu = regrouper([...(ancien?.contenu ?? []), ...portees]);
  return { baluchon: { x, z, contenu }, inventaire: vide };
}

export interface ResultatRecuperation {
  inventaire: Conteneur;
  /** Ce qui reste dans le baluchon (`null` s'il est vidé) */
  baluchon: Baluchon | null;
  /** Nombre d'objets repris */
  recupere: number;
  /** Nombre d'objets restés dans le baluchon faute de place */
  reste: number;
}

/** Reprend le contenu du baluchon dans l'inventaire porté ; ce qui ne rentre pas reste dans le baluchon. */
export function recupererBaluchon(inventaire: Conteneur, baluchon: Baluchon): ResultatRecuperation {
  let suite = inventaire;
  let recupere = 0;
  const restes: Pile[] = [];
  for (const pile of baluchon.contenu) {
    const r = ajouter(suite, pile.objet, pile.quantite);
    suite = r.conteneur;
    recupere += pile.quantite - r.reste;
    if (r.reste > 0) restes.push({ objet: pile.objet, quantite: r.reste });
  }
  const reste = restes.reduce((n, p) => n + p.quantite, 0);
  return { inventaire: suite, baluchon: reste > 0 ? { ...baluchon, contenu: restes } : null, recupere, reste };
}

/** Distance au sol entre le joueur et le baluchon. */
export function distanceBaluchon(b: Baluchon, x: number, z: number): number {
  return Math.hypot(b.x - x, b.z - z);
}

/** Vrai si le joueur est assez près pour le récupérer. */
export function baluchonAPortee(b: Baluchon, x: number, z: number): boolean {
  return distanceBaluchon(b, x, z) <= CONFIG.mort.porteeBaluchon;
}

export interface EtatMort {
  readonly inventaire: Conteneur;
  readonly equipement: Equipement;
  readonly baluchon: Baluchon | null;
}

/** Tout ce qui change à la mort : baluchon (avec fusion) et usure de l'équipement. Le sac et le coffre ne sont pas touchés. */
export function appliquerMort(etat: EtatMort, x: number, z: number): EtatMort {
  const depot = deposerBaluchon(etat.inventaire, x, z, etat.baluchon);
  return {
    inventaire: depot.inventaire,
    baluchon: depot.baluchon,
    equipement: userTout(etat.equipement, CONFIG.durabilite.usureMort),
  };
}
