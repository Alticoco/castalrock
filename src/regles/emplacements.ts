// Emplacements de partie : numéros, clés de stockage et résumé affiché dans le menu pause.
// Pur : aucun accès au navigateur (le stockage est dans src/moteur/stockage.ts).

import { CONFIG } from '../config';
import { TITRES_ACTES, etapeCourante, histoireFinie } from './histoire';
import { lirePartie } from './sauvegarde';

export const NOMBRE_EMPLACEMENTS = 3;

/** Clé de stockage d'un emplacement : l'emplacement 1 garde la clé de base (les anciennes parties y restent), les autres ajoutent `.<n>`. */
export function cleEmplacement(cleBase: string, n: number): string {
  return n === 1 ? cleBase : `${cleBase}.${n}`;
}

/** Numéro d'emplacement lu dans le stockage : 1 si le texte est absent, illisible ou hors de 1..NOMBRE_EMPLACEMENTS. */
export function lireNumeroEmplacement(texte: string | null): number {
  if (texte === null || !/^\d+$/.test(texte.trim())) return 1;
  const n = Number(texte);
  return Number.isInteger(n) && n >= 1 && n <= NOMBRE_EMPLACEMENTS ? n : 1;
}

/**
 * Ligne courte décrivant une partie : « Niveau 11 · Acte III · Jour 14 » (« Histoire terminée » à la place de l'acte
 * quand l'histoire est finie). `null` si l'emplacement est vide ou si la sauvegarde est illisible.
 */
export function resumeEmplacement(texte: string | null, graine: number): string | null {
  const partie = lirePartie(texte, graine);
  if (!partie) return null;
  const etape = etapeCourante(partie.histoire);
  const acte = histoireFinie(partie.histoire) || !etape ? 'Histoire terminée' : TITRES_ACTES[etape.acte].split(' — ')[0];
  const jour = Math.floor(partie.tempsJeu / CONFIG.temps.dureeJourSecondes) + 1;
  return `Niveau ${partie.progression.niveau} · ${acte} · Jour ${jour}`;
}
