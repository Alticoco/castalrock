// Armure ou casque portés glissés vers une case précise de l'inventaire (écran d'inventaire, glisser-déposer).
// Pur : aucun import de three. Immuable.

import {
  OBJETS_ARMURE,
  OBJETS_CASQUE,
  equiperArmure,
  equiperCasque,
  retirerArmure,
  retirerCasque,
  typeArmureDeObjet,
  typeCasqueDeObjet,
  type Equipement,
  type ResultatEquipement,
} from './equipement';
import type { Conteneur } from './inventaire';

/**
 * Retire l'armure portée : elle va dans la case `indice` si elle est vide, sinon dans la première case libre
 * (comme `retirerArmure`). Si la case contient une autre armure, les deux s'échangent. Refus (`ok` faux) : pas d'armure portée ou plus de place.
 */
export function retirerArmureVers(e: Equipement, inventaire: Conteneur, indice: number): ResultatEquipement {
  if (e.armure && Number.isInteger(indice) && indice >= 0 && indice < inventaire.cases.length && inventaire.cases[indice] === null) {
    const cases = [...inventaire.cases];
    cases[indice] = { objet: OBJETS_ARMURE[e.armure], quantite: 1 };
    return { ok: true, equipement: { ...e, armure: null }, inventaire: { cases } };
  }
  const autre = e.armure ? typeArmureDeObjet(inventaire.cases[indice]?.objet ?? '') : null;
  if (autre) return equiperArmure(e, inventaire, autre, indice);
  return retirerArmure(e, inventaire);
}

/** Comme `retirerArmureVers`, pour le casque porté (sur une case qui contient un autre casque, ils s'échangent). */
export function retirerCasqueVers(e: Equipement, inventaire: Conteneur, indice: number): ResultatEquipement {
  if (e.casque && Number.isInteger(indice) && indice >= 0 && indice < inventaire.cases.length && inventaire.cases[indice] === null) {
    const cases = [...inventaire.cases];
    cases[indice] = { objet: OBJETS_CASQUE[e.casque], quantite: 1 };
    return { ok: true, equipement: { ...e, casque: null }, inventaire: { cases } };
  }
  const autre = e.casque ? typeCasqueDeObjet(inventaire.cases[indice]?.objet ?? '') : null;
  if (autre) return equiperCasque(e, inventaire, autre, indice);
  return retirerCasque(e, inventaire);
}
