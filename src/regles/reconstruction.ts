// Village attaqué pendant l'absence du joueur (étape 60) : quelles maisons sont endommagées. L'état se déduit de l'histoire
// et des quêtes de la chaîne « Relever le village » : rien n'est sauvegardé pour les maisons. Pur : aucun import de three.

import { etapeAtteinte, type EtatHistoire } from './histoire';
import type { EtatQuetes } from './quetes';

/** Étape d'histoire à partir de laquelle les maisons sont endommagées. */
export const ETAPE_ATTAQUE = 'rentrer-village';

/** Chaque maison de chaume endommagée, avec la quête qui la fait rebâtir. */
export const MAISONS_A_RELEVER: ReadonlyArray<{ readonly maison: string; readonly quete: string }> = [
  { maison: 'maison-2', quete: 'murs-hiver' },
  { maison: 'maison-3', quete: 'toit-chasseur' },
];

/** Maisons à moitié détruites : celles dont la quête de reconstruction n'est pas rendue, une fois l'étape « Rentre au village » atteinte. */
export function maisonsEndommagees(histoire: EtatHistoire, quetes: EtatQuetes): Set<string> {
  const ensemble = new Set<string>();
  if (!etapeAtteinte(histoire, ETAPE_ATTAQUE)) return ensemble;
  for (const m of MAISONS_A_RELEVER) if (!quetes.terminees.includes(m.quete)) ensemble.add(m.maison);
  return ensemble;
}
