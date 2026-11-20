// Cuisine : manger un aliment rend de la vie tout de suite, puis régénère pendant un moment (voir CONFIG.cuisine).
// Pur : aucun import de three. Les recettes (viande cuite, ragoût) sont dans fabrication.ts, lieu « feu ».

import { CONFIG } from '../config';
import type { VieJoueur } from './combat';

export function estAliment(objet: string): boolean {
  return objet in CONFIG.cuisine.aliments;
}

export type RaisonRepas = 'pas-aliment' | 'vie-pleine' | 'tombe';

export const MESSAGES_REPAS: Readonly<Record<RaisonRepas, string>> = {
  'pas-aliment': '',
  'vie-pleine': 'Vie déjà pleine',
  tombe: '',
};

export interface ResultatRepas {
  ok: boolean;
  raison?: RaisonRepas;
  vie: VieJoueur;
  /** Points rendus tout de suite */
  soin: number;
}

/** Mange un aliment (le retrait de l'objet se fait ailleurs). Refusé si la vie est pleine : rien n'est gâché. */
export function manger(vie: VieJoueur, objet: string, vieMax: number = CONFIG.combat.vieMax): ResultatRepas {
  const refus = (raison: RaisonRepas): ResultatRepas => ({ ok: false, raison, vie, soin: 0 });
  if (!estAliment(objet)) return refus('pas-aliment');
  if (vie.pv <= 0) return refus('tombe');
  if (vie.pv >= vieMax) return refus('vie-pleine');
  const a = CONFIG.cuisine.aliments[objet];
  const pv = Math.min(vieMax, vie.pv + a.soin);
  const regeneration = a.regenDuree > 0 && a.regenParSeconde > 0 ? { parSeconde: a.regenParSeconde, reste: a.regenDuree } : undefined;
  const { regeneration: _ancienne, ...sans } = vie;
  return { ok: true, vie: { ...sans, pv, ...(regeneration ? { regeneration } : {}) }, soin: pv - vie.pv };
}
