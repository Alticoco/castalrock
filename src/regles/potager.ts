// Potager de la maison du joueur : on l'arrose avec un seau d'eau, il donne le lendemain des baies et des plantes
// médicinales. Pas arrosé, il ne pousse pas, mais il ne meurt jamais : aucune contrainte.
// Pur : aucun import de three, aucun Math.random() (récolte tirée de la graine du monde et du jour).

import { CONFIG } from '../config';
import { creerAleatoire } from './aleatoire';
import type { Pile } from './inventaire';

export interface EtatPotager {
  /** Numéro du jour de jeu où le potager a été arrosé pour la dernière fois (`null` : pas arrosé, ou déjà récolté) */
  readonly dernierArrosage: number | null;
}

export function creerEtatPotager(): EtatPotager {
  return { dernierArrosage: null };
}

/** Arrosé aujourd'hui : la récolte pousse cette nuit. */
export function estArrose(etat: EtatPotager, jour: number): boolean {
  return etat.dernierArrosage === jour;
}

/** Une récolte attend : le potager a été arrosé un jour précédent et n'a pas été récolté depuis. */
export function recoltePrete(etat: EtatPotager, jour: number): boolean {
  return etat.dernierArrosage !== null && jour > etat.dernierArrosage;
}

/** Arrose le potager pour la journée (sans effet si une récolte attend : on récolte d'abord, ou s'il est déjà arrosé). */
export function arroser(etat: EtatPotager, jour: number): EtatPotager {
  if (recoltePrete(etat, jour) || estArrose(etat, jour)) return etat;
  return { dernierArrosage: jour };
}

/** Ce que donne la récolte : quelques baies et plantes médicinales, toujours les mêmes pour une graine et un jour donnés. */
export function contenuRecolte(graine: number, jourArrosage: number, reglages = CONFIG.potager): Pile[] {
  const alea = creerAleatoire(Math.imul((graine ^ 0x7f4a7c15) >>> 0, 0x01000193) ^ Math.imul(jourArrosage + 1, 0x9e3779b1));
  return [
    { objet: 'baies', quantite: alea.entier(reglages.baies.min, reglages.baies.max) },
    { objet: 'plante-medicinale', quantite: alea.entier(reglages.plantes.min, reglages.plantes.max) },
  ];
}

/** Récolte : renvoie ce qu'on obtient et le potager vidé (à arroser de nouveau). Sans récolte prête, rien ne change. */
export function recolter(etat: EtatPotager, jour: number, graine: number): { etat: EtatPotager; butin: Pile[] } {
  if (etat.dernierArrosage === null || !recoltePrete(etat, jour)) return { etat, butin: [] };
  return { etat: creerEtatPotager(), butin: contenuRecolte(graine, etat.dernierArrosage) };
}

/** Relit un potager sauvegardé ; ce qui est absent ou abîmé donne un potager non arrosé (jamais de refus de la partie). */
export function lireEtatPotager(brut: unknown): EtatPotager {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return creerEtatPotager();
  const j = (brut as { dernierArrosage?: unknown }).dernierArrosage;
  return typeof j === 'number' && Number.isInteger(j) && j >= 0 ? { dernierArrosage: j } : creerEtatPotager();
}
