// Stockage de la sauvegarde dans le navigateur (localStorage).
// Toutes les opérations sont entourées de try/catch : stockage désactivé, plein ou refusé = on continue sans.
// Trois emplacements de partie : celui qui est actif est retenu sous `castalrock.emplacement`.

import { CONFIG } from '../config';
import { cleEmplacement, lireNumeroEmplacement } from '../regles/emplacements';

const CLE_EMPLACEMENT = 'castalrock.emplacement';

// Lu une seule fois par page : si un autre onglet change d'emplacement, cette page continue d'écrire dans le sien
// (sinon sa sauvegarde automatique écraserait la partie de l'autre emplacement).
let emplacementDeLaPage: number | null = null;

/** Numéro de l'emplacement de cette page (1 par défaut, ou si le stockage est inaccessible), fixé au premier appel. */
export function emplacementActif(): number {
  if (emplacementDeLaPage === null) {
    try {
      emplacementDeLaPage = lireNumeroEmplacement(window.localStorage.getItem(CLE_EMPLACEMENT));
    } catch {
      emplacementDeLaPage = 1;
    }
  }
  return emplacementDeLaPage;
}

/** Change l'emplacement actif (pris en compte au prochain chargement de la page). Renvoie faux si le navigateur refuse. */
export function definirEmplacementActif(n: number): boolean {
  try {
    window.localStorage.setItem(CLE_EMPLACEMENT, String(lireNumeroEmplacement(String(n))));
    return true;
  } catch {
    return false;
  }
}

/** Texte de la sauvegarde d'un emplacement (l'emplacement actif par défaut), ou `null` s'il n'y en a pas (ou si le stockage est inaccessible). */
export function lireSauvegarde(emplacement: number = emplacementActif()): string | null {
  try {
    return window.localStorage.getItem(cleEmplacement(CONFIG.sauvegarde.cle, emplacement));
  } catch {
    return null;
  }
}

/** Écrit la sauvegarde de l'emplacement actif. Renvoie faux si le navigateur la refuse. */
export function ecrireSauvegarde(texte: string): boolean {
  try {
    window.localStorage.setItem(cleEmplacement(CONFIG.sauvegarde.cle, emplacementActif()), texte);
    return true;
  } catch {
    return false;
  }
}

/** Efface la sauvegarde d'un emplacement (l'emplacement actif par défaut). */
export function effacerSauvegarde(emplacement: number = emplacementActif()): void {
  try {
    window.localStorage.removeItem(cleEmplacement(CONFIG.sauvegarde.cle, emplacement));
  } catch {
    // Rien à faire
  }
}

/**
 * Met de côté une sauvegarde refusée au chargement (abîmée, ou d'une autre graine), sous une autre clé,
 * pour qu'elle ne soit pas perdue quand la nouvelle partie se sauvegarde. Renvoie vrai si la copie a réussi.
 * La copie suit l'emplacement actif.
 */
export function copierSauvegardeRefusee(texte: string): boolean {
  try {
    window.localStorage.setItem(`${cleEmplacement(CONFIG.sauvegarde.cle, emplacementActif())}.refusee`, texte);
    return true;
  } catch {
    return false;
  }
}
