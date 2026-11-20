// Petits coffres des ruines et des grottes (session 3b) : contenu tiré de la graine, ouverture une seule fois,
// liste des coffres ouverts gardée dans la sauvegarde.
// Pur : aucun import de three, aucun Math.random(). Réglages : CONFIG.ruines.butin.

import { CONFIG } from '../config';
import { creerAleatoire } from './aleatoire';
import type { Pile } from './inventaire';

// Limite de validation (protège d'un fichier absurde)
const COFFRES_MAX = 100_000;

/** Nombre entier tiré de l'identifiant d'un coffre et de la graine du monde (toujours le même). */
function graineDuCoffre(graine: number, id: string): number {
  let h = (graine ^ 0x9e3779b1) >>> 0;
  for (let k = 0; k < id.length; k++) h = Math.imul(h ^ id.charCodeAt(k), 0x01000193) >>> 0;
  return h;
}

/**
 * Contenu d'un coffre : un peu d'or toujours, souvent une potion, parfois des cristaux ou des lingots.
 * Ne dépend que de la graine du monde et de l'identifiant du coffre. `grotte` : les cristaux y sont plus fréquents.
 */
export function butinCoffre(graine: number, id: string, grotte: boolean, reglages = CONFIG.ruines.butin): Pile[] {
  const alea = creerAleatoire(graineDuCoffre(graine, id));
  const piles: Pile[] = [{ objet: 'or', quantite: alea.entier(reglages.or.min, reglages.or.max) }];
  const lots: ReadonlyArray<readonly [string, { chance: number; min: number; max: number }]> = [
    ['potion-soin', reglages.potion],
    ['cristal-bleu', { ...reglages.cristaux, chance: grotte ? reglages.cristaux.chanceGrotte : reglages.cristaux.chance }],
    ['lingot-cuivre', reglages.lingotsCuivre],
    ['lingot-fer', reglages.lingotsFer],
  ];
  for (const [objet, lot] of lots) {
    // Les deux tirages sont toujours faits : le contenu d'un lot ne dépend pas des lots précédents
    const u = alea.suivant();
    const quantite = alea.entier(lot.min, lot.max);
    if (u < lot.chance) piles.push({ objet, quantite });
  }
  return piles;
}

/** Identifiant d'un coffre de butin du camp des bandits (`camp:coffre:0` est celui de Morvan, le plus gros). */
export const COFFRE_CAMP = /^camp:coffre:\d+$/;

/**
 * Contenu d'un coffre du camp des bandits : de l'or, 2 ou 3 ressources volées, parfois une potion ou des lingots de fer.
 * Le coffre n° 0 (Morvan) a toujours des lingots de fer. Ne dépend que de la graine du monde et de l'identifiant.
 */
export function butinCoffreCamp(graine: number, id: string, reglages = CONFIG.lieux.camp.butin): Pile[] {
  const alea = creerAleatoire(graineDuCoffre(graine, id));
  const piles: Pile[] = [{ objet: 'or', quantite: alea.entier(reglages.or.min, reglages.or.max) }];
  // Ressources : tirage sans remise parmi la liste
  const choix = [...reglages.ressources];
  const nombre = alea.entier(reglages.nombreRessources.min, reglages.nombreRessources.max);
  for (let i = 0; i < nombre && choix.length > 0; i++) {
    const objet = choix.splice(alea.entier(0, choix.length - 1), 1)[0];
    piles.push({ objet, quantite: alea.entier(reglages.quantiteRessource.min, reglages.quantiteRessource.max) });
  }
  const potion = alea.suivant();
  const quantitePotion = alea.entier(reglages.potion.min, reglages.potion.max);
  if (potion < reglages.potion.chance) piles.push({ objet: 'potion-soin', quantite: quantitePotion });
  const lingots = alea.suivant();
  const quantiteLingots = alea.entier(reglages.lingotsFer.min, reglages.lingotsFer.max);
  if (id === 'camp:coffre:0') piles.push({ objet: 'lingot-fer', quantite: alea.entier(reglages.lingotsFerMorvan.min, reglages.lingotsFerMorvan.max) });
  else if (lingots < reglages.lingotsFer.chance) piles.push({ objet: 'lingot-fer', quantite: quantiteLingots });
  return piles;
}

/** Coffres entamés (inventaire trop plein pour tout prendre) : identifiant -> ce qui y reste. */
export type CoffresEntames = Readonly<Record<string, readonly Pile[]>>;

/** Ce qu'il y a encore dans un coffre : le reste gardé s'il a été entamé, sinon son contenu tiré de la graine. */
export function contenuDuCoffre(entames: CoffresEntames, graine: number, id: string, grotte: boolean): readonly Pile[] {
  return entames[id] ?? (COFFRE_CAMP.test(id) ? butinCoffreCamp(graine, id) : butinCoffre(graine, id, grotte));
}

/** Note ce qui reste dans un coffre ; une liste vide retire le coffre des coffres entamés. */
export function garderReste(entames: CoffresEntames, id: string, reste: readonly Pile[]): CoffresEntames {
  const { [id]: _ancien, ...autres } = entames;
  return reste.length > 0 ? { ...autres, [id]: reste } : autres;
}

/** Lit les coffres entamés sauvegardés. Absents : aucun. `null` s'ils sont abîmés. */
export function lireCoffresEntames(v: unknown): CoffresEntames | null {
  if (v === undefined) return {};
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const lus: Record<string, Pile[]> = {};
  const entrees = Object.entries(v as Record<string, unknown>);
  if (entrees.length > COFFRES_MAX) return null;
  for (const [id, piles] of entrees) {
    if (!(/^co:(ru|gr):-?\d+:-?\d+$/.test(id) || COFFRE_CAMP.test(id)) || !Array.isArray(piles) || piles.length < 1 || piles.length > 50) return null;
    const lues: Pile[] = [];
    for (const p of piles as unknown[]) {
      if (typeof p !== 'object' || p === null) return null;
      const { objet, quantite } = p as { objet?: unknown; quantite?: unknown };
      if (typeof objet !== 'string' || objet === '' || !Number.isInteger(quantite) || (quantite as number) < 1 || (quantite as number) > 1_000_000) return null;
      lues.push({ objet, quantite: quantite as number });
    }
    lus[id] = lues;
  }
  return lus;
}

/** Vrai si le coffre a déjà été ouvert. */
export function estOuvert(ouverts: readonly string[], id: string): boolean {
  return ouverts.includes(id);
}

/** Note un coffre comme ouvert (sans doublon) ; renvoie la nouvelle liste. */
export function ouvrirCoffre(ouverts: readonly string[], id: string): string[] {
  return ouverts.includes(id) ? [...ouverts] : [...ouverts, id];
}

/**
 * Lit la liste sauvegardée des coffres ouverts. Absente (sauvegarde d'avant les ruines) : aucun coffre ouvert.
 * `null` si elle est abîmée.
 */
export function lireCoffresOuverts(v: unknown): string[] | null {
  if (v === undefined) return [];
  if (!Array.isArray(v) || v.length > COFFRES_MAX) return null;
  const lus: string[] = [];
  for (const id of v as unknown[]) {
    if (typeof id !== 'string' || !(/^co:(ru|gr):-?\d+:-?\d+$/.test(id) || COFFRE_CAMP.test(id))) return null;
    if (!lus.includes(id)) lus.push(id);
  }
  return lus;
}

/** Coffre fermé le plus proche de (x, z) dans la portée, ou null. */
export function coffreAPortee<C extends { id: string; x: number; z: number }>(coffres: Iterable<C>, ouverts: readonly string[], x: number, z: number, portee: number): C | null {
  let meilleur: C | null = null;
  let distance = portee;
  for (const c of coffres) {
    if (ouverts.includes(c.id)) continue;
    const d = Math.hypot(c.x - x, c.z - z);
    if (d <= distance) {
      distance = d;
      meilleur = c;
    }
  }
  return meilleur;
}
