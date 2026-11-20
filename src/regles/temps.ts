// Heure du jeu : une journée du jeu dure `dureeJourSecondes` secondes réelles.
// Règles pures (aucune dépendance au rendu). Les heures vont de 0 à 24.
//
// Découpage de la journée (valeurs par défaut dans CONFIG.temps) :
//   nuit [debutNuit, debutAube[ : lumière du jour nulle
//   aube [debutAube, debutJour[ : la lumière monte
//   jour [debutJour, debutCrepuscule[ : lumière pleine
//   crépuscule [debutCrepuscule, debutNuit[ : la lumière baisse

export type Phase = 'aube' | 'jour' | 'crepuscule' | 'nuit';

export interface ReglagesTemps {
  /** Durée d'une journée complète (24 h du jeu), en secondes réelles */
  dureeJourSecondes: number;
  /** Heure du jeu à l'instant 0 */
  heureDepart: number;
  debutAube: number;
  debutJour: number;
  debutCrepuscule: number;
  debutNuit: number;
}

export const ramener24 = (h: number): number => ((h % 24) + 24) % 24;

/** Heure du jeu (de 0 inclus à 24 exclu) après `tempsEcoule` secondes de jeu. */
export function heureDuJeu(tempsEcoule: number, r: ReglagesTemps): number {
  return ramener24(r.heureDepart + (tempsEcoule / r.dureeJourSecondes) * 24);
}

/** Phase de la journée à une heure donnée (la nuit passe minuit). */
export function phaseDeLHeure(heure: number, r: ReglagesTemps): Phase {
  const h = ramener24(heure);
  if (h >= r.debutNuit || h < r.debutAube) return 'nuit';
  if (h < r.debutJour) return 'aube';
  if (h < r.debutCrepuscule) return 'jour';
  return 'crepuscule';
}

/** Progression douce de 0 à 1 (pente nulle aux deux bouts, donc pas de cassure). */
function adoucir(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

/** Lumière du jour de 0 (nuit pleine) à 1 (plein jour), transitions douces à l'aube et au crépuscule. */
export function facteurLumiere(heure: number, r: ReglagesTemps): number {
  const h = ramener24(heure);
  switch (phaseDeLHeure(h, r)) {
    case 'nuit':
      return 0;
    case 'aube':
      return adoucir((h - r.debutAube) / (r.debutJour - r.debutAube));
    case 'jour':
      return 1;
    case 'crepuscule':
      return 1 - adoucir((h - r.debutCrepuscule) / (r.debutNuit - r.debutCrepuscule));
  }
}

/** Heure affichée « 08:30 ». */
export function formaterHeure(heure: number): string {
  const totalMinutes = Math.floor(ramener24(heure) * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
