// Pièges : posés avec la case 6, ils attrapent un lapin ou un renard après quelques minutes de jeu, et se relèvent avec E.
// Pur : aucun import de three, aucun Math.random() (le tirage vient du générateur à graine). Tout est immuable.
// Le temps est le temps de jeu, en secondes.

import { CONFIG } from '../config';
import { creerAleatoire, hacher } from './aleatoire';
import { tirerButinEnnemi } from './combat';

export type Proie = 'lapin' | 'renard';
export const PROIES: readonly Proie[] = ['lapin', 'renard'];

/** Objet de l'inventaire consommé pour poser un piège. */
export const OBJET_PIEGE = 'piege';

export interface Piege {
  /** `t:<n>` */
  readonly id: string;
  readonly x: number;
  readonly z: number;
  /** Temps de jeu de la pose, puis de la dernière relève */
  readonly instant: number;
  readonly etat: 'attente' | 'plein';
  /** Présente quand le piège est plein */
  readonly prise?: Proie;
}

/** Tirage de la prochaine prise d'un piège : toujours le même pour un piège, un instant de pose et une graine donnés. */
export function tirerPrise(piege: Pick<Piege, 'id' | 'instant'>, graine: number = CONFIG.graine): { delai: number; proie: Proie } {
  const P = CONFIG.pieges;
  const alea = creerAleatoire((hacher(`piege:${piege.id}:${Math.floor(piege.instant)}`) ^ Math.imul(graine | 0, 0x27d4eb2f)) >>> 0);
  const delai = alea.entre(P.delaiMin, P.delaiMax);
  const proie: Proie = alea.suivant() < P.chanceRenard ? 'renard' : 'lapin';
  return { delai, proie };
}

export type RefusPiege = 'maximum' | 'biome' | 'proche';

export const MESSAGES_REFUS_PIEGE: Readonly<Record<RefusPiege, string>> = {
  maximum: `Déjà ${CONFIG.pieges.max} pièges posés`,
  biome: 'Un piège se pose en prairie ou en forêt',
  proche: 'Trop près d’un autre piège',
};

/** Le piège peut-il être posé en (x, z) ? `biome` : biome dominant du point. Le terrain (eau, pente, obstacles) se vérifie ailleurs. */
export function verifierPiege(
  pieges: readonly Piege[],
  x: number,
  z: number,
  biome: string,
): { ok: true } | { ok: false; raison: RefusPiege } {
  const P = CONFIG.pieges;
  if (pieges.length >= P.max) return { ok: false, raison: 'maximum' };
  if (!P.biomesAutorises.includes(biome)) return { ok: false, raison: 'biome' };
  if (pieges.some((p) => Math.hypot(p.x - x, p.z - z) < P.distanceMiniEntrePieges)) return { ok: false, raison: 'proche' };
  return { ok: true };
}

/** Ajoute un piège en attente. Son identifiant suit le plus grand déjà utilisé. */
export function poserPiege(pieges: readonly Piege[], x: number, z: number, tempsJeu: number): Piege[] {
  const suivant = pieges.reduce((m, p) => Math.max(m, Number(p.id.slice(2)) + 1), 0);
  return [...pieges, { id: `t:${suivant}`, x, z, instant: tempsJeu, etat: 'attente' }];
}

/** Les pièges dont le délai est passé se remplissent. Renvoie la même liste si rien ne change. */
export function mettreAJourPieges(pieges: readonly Piege[], tempsJeu: number, graine: number = CONFIG.graine): readonly Piege[] {
  let change = false;
  const suite = pieges.map((p) => {
    if (p.etat !== 'attente') return p;
    const { delai, proie } = tirerPrise(p, graine);
    if (tempsJeu - p.instant < delai) return p;
    change = true;
    return { ...p, etat: 'plein' as const, prise: proie };
  });
  return change ? suite : pieges;
}

/** Piège à portée de relève (le plus proche), ou null ; `etat` : ne chercher que les pièges pleins ou vides. */
export function piegeAPortee(pieges: readonly Piege[], x: number, z: number, etat?: Piege['etat']): Piege | null {
  let meilleur: Piege | null = null;
  let distance = CONFIG.pieges.porteeReleve;
  for (const p of pieges) {
    if (etat !== undefined && p.etat !== etat) continue;
    const d = Math.hypot(p.x - x, p.z - z);
    if (d <= distance) {
      meilleur = p;
      distance = d;
    }
  }
  return meilleur;
}

export interface ResultatReleve {
  /** Le piège remis en attente (il reste en place) */
  readonly piege: Piege;
  /** Le butin de la proie */
  readonly butin: Record<string, number>;
  readonly proie: Proie;
}

/** Relève un piège plein : le butin de la proie, et le piège repart en attente. `null` si le piège est vide. */
export function releverPiege(piege: Piege, tempsJeu: number, graine: number = CONFIG.graine): ResultatReleve | null {
  if (piege.etat !== 'plein' || !piege.prise) return null;
  const butin = tirerButinEnnemi(piege.prise, `piege:${piege.id}:${Math.floor(piege.instant)}`, graine);
  return { piege: { id: piege.id, x: piege.x, z: piege.z, instant: tempsJeu, etat: 'attente' }, butin, proie: piege.prise };
}

/** Reprend un piège (il disparaît du sol ; l'appelant rend l'objet « piège » à l'inventaire). */
export function reprendrePiege(pieges: readonly Piege[], id: string): Piege[] {
  return pieges.filter((p) => p.id !== id);
}
