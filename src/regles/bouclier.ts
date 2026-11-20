// Bouclier et parade : garde levée (clic droit maintenu avec l'épée), coups « de face », réduction des dégâts,
// parade réussie (bouclier levé juste avant le coup) et riposte.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable. Valeurs dans CONFIG.bouclier.
// Convention d'orientation : lacet en radians, l'avant est (sin(lacet), cos(lacet)), comme le personnage.

import { CONFIG } from '../config';
import type { TypeBouclier } from './equipement';

const B = CONFIG.bouclier;
const A = CONFIG.progression.arbre;

// --- Garde ------------------------------------------------------------------------------------

export interface EtatGarde {
  /** Vrai tant que le bouclier est levé */
  readonly leve: boolean;
  /** Secondes écoulées depuis que le bouclier a été levé (0 s'il est baissé) */
  readonly depuis: number;
  /** Secondes restantes pour porter la riposte (0 : aucune riposte prête) */
  readonly riposte: number;
}

export function creerGarde(): EtatGarde {
  return { leve: false, depuis: 0, riposte: 0 };
}

/** Ce qu'il faut pour lever le bouclier : l'épée en main (case 1), un bouclier possédé et le nœud Parade. */
export function peutLeverBouclier(emplacement: string, bouclier: TypeBouclier | null, noeuds: readonly string[]): boolean {
  return emplacement === 'epee' && bouclier !== null && noeuds.includes('parade');
}

/** Le temps passe : le bouclier se lève ou se baisse, la riposte prête s'éteint au bout de son délai. */
export function pasDeGarde(g: EtatGarde, leve: boolean, dt: number): EtatGarde {
  const pas = dt > 0 ? dt : 0;
  return {
    leve,
    depuis: leve && g.leve ? g.depuis + pas : 0,
    riposte: Math.max(0, g.riposte - pas),
  };
}

// --- Coup reçu --------------------------------------------------------------------------------

/** Vrai si l'attaquant est dans le cône devant le regard (±`demiAngleFaceDegres`). Tout contre le joueur : de face. */
export function estDeFace(
  joueur: { x: number; z: number },
  regard: number,
  attaquant: { x: number; z: number },
  demiAngle: number = (B.demiAngleFaceDegres * Math.PI) / 180,
): boolean {
  const dx = attaquant.x - joueur.x;
  const dz = attaquant.z - joueur.z;
  if (Math.hypot(dx, dz) < 1e-6) return true;
  let ecart = (Math.atan2(dx, dz) - regard) % (2 * Math.PI);
  if (ecart > Math.PI) ecart -= 2 * Math.PI;
  if (ecart < -Math.PI) ecart += 2 * Math.PI;
  return Math.abs(ecart) <= demiAngle + 1e-9;
}

/** Part des dégâts de face retirée par le bouclier levé : 70 %, 100 % avec Bouclier solide ; le bouclier renforcé ajoute 10 %. */
export function reductionParade(bouclier: TypeBouclier | null, solide: boolean): number {
  if (bouclier === null) return 0;
  const base = solide ? A.bouclierSolide : A.parade;
  return Math.min(1, base + (bouclier === 'renforce' ? B.bonusRenforce : 0));
}

export interface CoupRecu {
  /** Dégâts du coup, avant armure */
  brut: number;
  garde: EtatGarde;
  /** Vrai si l'attaquant est devant le regard (voir `estDeFace`) */
  deFace: boolean;
  bouclier: TypeBouclier | null;
  /** Nœud Bouclier solide acquis */
  solide: boolean;
  /** Type de l'ennemi qui frappe */
  attaquant: string;
}

export interface ResultatParade {
  /** Dégâts qui passent le bouclier (avant armure) ; 0 si tout est bloqué */
  brut: number;
  /** Vrai si le bouclier a pris une part du coup */
  pare: boolean;
  /** Vrai si le bouclier a été levé juste avant le coup annoncé d'un ennemi parable : l'ennemi est étourdi */
  reussie: boolean;
}

/** Un coup arrive : le bouclier levé en retire une part s'il vient de face ; levé au dernier moment, la parade est réussie. */
export function resoudreParade(c: CoupRecu): ResultatParade {
  if (!(c.brut > 0)) return { brut: 0, pare: false, reussie: false };
  if (!c.garde.leve || c.bouclier === null || !c.deFace) return { brut: c.brut, pare: false, reussie: false };
  const brut = c.brut * (1 - reductionParade(c.bouclier, c.solide));
  const reussie = c.garde.depuis <= B.fenetreParade && B.parables.includes(c.attaquant);
  return { brut: brut < 1e-9 ? 0 : brut, pare: true, reussie };
}

// --- Riposte ----------------------------------------------------------------------------------

/** Après une parade réussie : la riposte est prête pendant `dureeRiposte` (si le nœud Riposte est acquis). */
export function apresParadeReussie(g: EtatGarde, aRiposte: boolean): EtatGarde {
  return aRiposte ? { ...g, riposte: B.dureeRiposte } : g;
}

/** Facteur du prochain coup d'épée : ×2 tant qu'une riposte est prête, sinon 1. */
export function facteurRiposte(g: EtatGarde): number {
  return g.riposte > 0 ? A.riposte.facteur : 1;
}

/** Le coup de riposte est porté : elle n'est plus prête. */
export function consommerRiposte(g: EtatGarde): EtatGarde {
  return g.riposte > 0 ? { ...g, riposte: 0 } : g;
}
