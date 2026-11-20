// Équipement du joueur : palier de chaque outil (base, cuivre, fer, acier, cristal), armure portée, sacoche.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable.
// Le joueur a toujours ses trois outils de base ; un outil d'un palier supérieur remplace celui du palier d'avant.

import { CONFIG } from '../config';
import { ajouter, compter, retirer, type Conteneur } from './inventaire';
import type { OutilRecolte } from './recolte';

/** Mêmes valeurs que `NiveauOutil` de src/scene/outils.ts (qui importe three, donc non utilisable ici). */
export type NiveauOutil = 'base' | 'cuivre' | 'fer' | 'acier' | 'cristal';

/** Du plus faible au plus fort. */
export const NIVEAUX_OUTIL: readonly NiveauOutil[] = ['base', 'cuivre', 'fer', 'acier', 'cristal'];
export const OUTILS: readonly OutilRecolte[] = ['hache', 'pioche', 'epee'];

/** Rang d'un palier (0 = base) : sert à comparer deux paliers. */
export function rangNiveau(niveau: NiveauOutil): number {
  return NIVEAUX_OUTIL.indexOf(niveau);
}

/** Palier juste avant celui-ci, ou `null` pour la base. */
export function niveauPrecedent(niveau: NiveauOutil): NiveauOutil | null {
  return NIVEAUX_OUTIL[rangNiveau(niveau) - 1] ?? null;
}

export type TypeArmure = 'fibres' | 'cuir' | 'fourrure' | 'mailles' | 'plaques';
export const TYPES_ARMURE: readonly TypeArmure[] = ['fibres', 'cuir', 'fourrure', 'mailles', 'plaques'];

/** Identifiant de l'objet « armure » de chaque type dans l'inventaire. */
export const OBJETS_ARMURE: Readonly<Record<TypeArmure, string>> = {
  fibres: 'armure-fibres',
  cuir: 'armure-cuir',
  fourrure: 'armure-fourrure',
  mailles: 'armure-mailles',
  plaques: 'armure-plaques',
};

export const NOMS_ARMURE: Readonly<Record<TypeArmure, string>> = {
  fibres: 'Armure de fibres',
  cuir: 'Armure de cuir',
  fourrure: 'Armure de fourrure',
  mailles: 'Armure de mailles',
  plaques: 'Armure de plaques',
};

/** Type d'armure d'un objet de l'inventaire, ou `null` si ce n'est pas une armure. */
export function typeArmureDeObjet(objet: string): TypeArmure | null {
  return TYPES_ARMURE.find((t) => OBJETS_ARMURE[t] === objet) ?? null;
}

/** Part des dégâts retirée par une armure en bon état (0 sans armure). */
export function reductionArmure(armure: TypeArmure | null): number {
  return armure === null ? 0 : CONFIG.combat.reductionArmure[armure];
}

/** Casque porté (un seul emplacement). Il ne s'use pas, comme le bouclier. */
export type TypeCasque = 'cuir' | 'fourrure' | 'mailles' | 'plaques';
export const TYPES_CASQUE: readonly TypeCasque[] = ['cuir', 'fourrure', 'mailles', 'plaques'];

/** Identifiant de l'objet « casque » de chaque type dans l'inventaire. */
export const OBJETS_CASQUE: Readonly<Record<TypeCasque, string>> = {
  cuir: 'casque-cuir',
  fourrure: 'casque-fourrure',
  mailles: 'casque-mailles',
  plaques: 'casque-plaques',
};

export const NOMS_CASQUE: Readonly<Record<TypeCasque, string>> = {
  cuir: 'Bonnet de cuir',
  fourrure: 'Chapka de fourrure',
  mailles: 'Camail de mailles',
  plaques: "Heaume d'acier",
};

/** Type de casque d'un objet de l'inventaire, ou `null` si ce n'est pas un casque. */
export function typeCasqueDeObjet(objet: string): TypeCasque | null {
  return TYPES_CASQUE.find((t) => OBJETS_CASQUE[t] === objet) ?? null;
}

/** Part des dégâts retirée par un casque (0 sans casque). */
export function reductionCasque(casque: TypeCasque | null): number {
  return casque === null ? 0 : CONFIG.combat.reductionCasque[casque];
}

/** Bouclier porté au bras gauche avec l'épée (du plus faible au plus fort). Il ne s'use pas. */
export type TypeBouclier = 'bois' | 'renforce';
export const TYPES_BOUCLIER: readonly TypeBouclier[] = ['bois', 'renforce'];

export const NOMS_BOUCLIER: Readonly<Record<TypeBouclier, string>> = {
  bois: 'Bouclier en bois',
  renforce: 'Bouclier renforcé',
};

/** Ce qui s'use : les trois outils et l'armure. */
export type EmplacementUsure = OutilRecolte | 'armure';
export const EMPLACEMENTS_USURE: readonly EmplacementUsure[] = [...OUTILS, 'armure'];

export interface Equipement {
  /** Niveau de chaque outil */
  readonly outils: Readonly<Record<OutilRecolte, NiveauOutil>>;
  /** Armure portée (un seul emplacement ; elle ne prend alors plus de case), `null` si aucune */
  readonly armure: TypeArmure | null;
  /** Casque porté (un seul emplacement, il ne s'use pas), `null` si aucun */
  readonly casque: TypeCasque | null;
  /** Sacoche déjà fabriquée (elle ne se fabrique qu'une fois) */
  readonly sacoche: boolean;
  /** Bouclier possédé (bras gauche, avec l'épée), `null` si aucun */
  readonly bouclier: TypeBouclier | null;
  /** Arc possédé (case 4 de la barre d'outils) ; il ne s'use pas */
  readonly arc: boolean;
  /** Durabilité de chaque outil et de l'armure (de 0 au maximum de son palier : voir `durabiliteMax`) */
  readonly durabilite: Readonly<Record<EmplacementUsure, number>>;
  /** Facteur sur la durabilité maximale (compétence Maître forgeron : 1,5) ; 1 si absent. Non sauvegardé : recalculé depuis l'arbre. */
  readonly facteurDurabilite?: number;
}

/** Durabilités toutes au maximum. */
export function durabilitesNeuves(): Record<EmplacementUsure, number> {
  const m = CONFIG.fabrication.paliers.base.durabilite;
  return { hache: m, pioche: m, epee: m, armure: CONFIG.durabilite.max };
}

/** Durabilité maximale d'un emplacement : celle du palier de l'outil, ou celle de l'armure, fois le facteur de l'équipement. */
export function durabiliteMax(e: Equipement, emplacement: EmplacementUsure): number {
  const base = emplacement === 'armure' ? CONFIG.durabilite.max : CONFIG.fabrication.paliers[e.outils[emplacement]].durabilite;
  return Math.round(base * (e.facteurDurabilite ?? 1));
}

export function creerEquipement(): Equipement {
  return {
    outils: { hache: 'base', pioche: 'base', epee: 'base' },
    armure: null,
    casque: null,
    sacoche: false,
    bouclier: null,
    arc: false,
    durabilite: durabilitesNeuves(),
  };
}

/** Prend ce bouclier (il remplace le précédent). */
export function equiperBouclier(e: Equipement, bouclier: TypeBouclier): Equipement {
  return { ...e, bouclier };
}

/** Niveau de l'outil tenu. */
export function niveauOutil(e: Equipement, outil: OutilRecolte): NiveauOutil {
  return e.outils[outil];
}

/** Remplace l'outil par son équivalent du palier donné (tout neuf : durabilité au maximum de ce palier). */
export function equiperOutil(e: Equipement, outil: OutilRecolte, niveau: NiveauOutil): Equipement {
  const apres = { ...e, outils: { ...e.outils, [outil]: niveau } };
  return { ...apres, durabilite: { ...e.durabilite, [outil]: durabiliteMax(apres, outil) } };
}

/** Efficacité d'un outil ou de l'armure : 1, ou `efficaciteUsee` une fois la durabilité à zéro. */
export function efficacite(e: Equipement, emplacement: EmplacementUsure): number {
  return e.durabilite[emplacement] <= 0 ? CONFIG.durabilite.efficaciteUsee : 1;
}

/** Multiplicateur de dégâts de l'outil (selon son palier : `fabrication.paliers`), réduit si l'outil est usé. */
export function facteurDegats(e: Equipement, outil: OutilRecolte): number {
  return CONFIG.fabrication.paliers[e.outils[outil]].degats * efficacite(e, outil);
}

// --- Durabilité ---------------------------------------------------------------------------------

/** Use un emplacement de `quantite` points (jamais sous zéro). L'armure ne s'use que si elle est portée. */
export function user(e: Equipement, emplacement: EmplacementUsure, quantite = 1): Equipement {
  if (emplacement === 'armure' && !e.armure) return e;
  const apres = Math.max(0, e.durabilite[emplacement] - quantite);
  if (apres === e.durabilite[emplacement]) return e;
  return { ...e, durabilite: { ...e.durabilite, [emplacement]: apres } };
}

/** Use tout l'équipement porté (outils et armure portée) de `quantite` points. */
export function userTout(e: Equipement, quantite: number): Equipement {
  return EMPLACEMENTS_USURE.reduce((suite, emplacement) => user(suite, emplacement, quantite), e);
}

/** Vrai si l'usure de l'emplacement a fait passer sa durabilité sous le seuil d'alerte (pour un seul message). */
export function franchitSeuilAlerte(avant: Equipement, apres: Equipement, emplacement: EmplacementUsure): boolean {
  const seuil = durabiliteMax(apres, emplacement) * CONFIG.durabilite.seuilAlerte;
  return avant.durabilite[emplacement] >= seuil && apres.durabilite[emplacement] < seuil;
}

export type EtatDurabilite = 'bon' | 'alerte' | 'use';

/** État d'une durabilité (`max` : maximum de l'objet) : « use » à zéro, « alerte » sous le seuil d'alerte, sinon « bon ». */
export function etatDurabilite(valeur: number, max: number = CONFIG.durabilite.max): EtatDurabilite {
  if (valeur <= 0) return 'use';
  return valeur < max * CONFIG.durabilite.seuilAlerte ? 'alerte' : 'bon';
}

const NOMS_USURE: Readonly<Record<EmplacementUsure, string>> = {
  hache: 'hache',
  pioche: 'pioche',
  epee: 'épée',
  armure: 'armure',
};

/** Message d'alerte quand un objet passe sous le seuil. */
export function messageUsure(emplacement: EmplacementUsure): string {
  const verbe = emplacement === 'armure' ? "s'use" : "s'émousse";
  return `Votre ${NOMS_USURE[emplacement]} ${verbe} : faites-la réparer à la forge`;
}

export interface CoutReparation {
  readonly objet: string;
  readonly quantite: number;
}

/**
 * Coût pour remettre un emplacement à son maximum, proportionnel à l'usure (arrondi au supérieur, minimum 1).
 * `facteur` : réduction de la compétence Artisanat (1 = plein tarif, 0,85 = −15 %).
 * `null` si rien à réparer (ou armure non portée).
 */
export function coutReparation(e: Equipement, emplacement: EmplacementUsure, facteur = 1): CoutReparation | null {
  if (emplacement === 'armure' && !e.armure) return null;
  const max = durabiliteMax(e, emplacement);
  const usure = max - e.durabilite[emplacement];
  if (usure <= 0) return null;
  const D = CONFIG.durabilite;
  const complet = emplacement === 'armure' ? D.reparationArmure[e.armure as TypeArmure] : D.reparationOutil[e.outils[emplacement]];
  const quantite = Math.max(1, Math.ceil((usure / max) * complet.quantite * facteur - 1e-9));
  return { objet: complet.objet, quantite };
}

/** Ce que la réparation lit et modifie (ingrédients : inventaire porté, puis coffre, comme la fabrication). */
export interface EtatReparation {
  readonly inventaire: Conteneur;
  readonly coffre: Conteneur;
  readonly equipement: Equipement;
  /** Facteur sur le coût (compétence Artisanat) ; 1 si absent */
  readonly facteurCout?: number;
}

export type ResultatReparation =
  | { ok: true; etat: EtatReparation; message: string }
  | { ok: false; etat: EtatReparation; message: string };

/** Répare un emplacement : consomme le coût, remet la durabilité au maximum. Refus : l'état reçu est renvoyé. */
export function reparer(etat: EtatReparation, emplacement: EmplacementUsure): ResultatReparation {
  const cout = coutReparation(etat.equipement, emplacement, etat.facteurCout);
  if (!cout) return { ok: false, etat, message: 'Rien à réparer' };
  if (compter(etat.inventaire, cout.objet) + compter(etat.coffre, cout.objet) < cout.quantite) {
    return { ok: false, etat, message: 'Il manque des ingrédients' };
  }
  const dansInventaire = retirer(etat.inventaire, cout.objet, cout.quantite);
  const dansCoffre = retirer(etat.coffre, cout.objet, cout.quantite - dansInventaire.retire);
  return {
    ok: true,
    etat: {
      inventaire: dansInventaire.conteneur,
      coffre: dansCoffre.conteneur,
      equipement: {
        ...etat.equipement,
        durabilite: { ...etat.equipement.durabilite, [emplacement]: durabiliteMax(etat.equipement, emplacement) },
      },
    },
    message: `Réparé : ${NOMS_USURE[emplacement]}`,
  };
}

export type RaisonEquipement = 'aucune-armure' | 'aucun-casque' | 'deja-portee' | 'non-portee' | 'inventaire-plein';

export interface ResultatEquipement {
  ok: boolean;
  raison?: RaisonEquipement;
  equipement: Equipement;
  inventaire: Conteneur;
}

/**
 * Vide la case de l'objet à équiper : la case `indice` si elle contient bien cet objet, sinon la première qui le contient.
 * Renvoie les cases après retrait et l'indice libéré (`-1` si l'objet est introuvable).
 */
function viderCaseDe(inventaire: Conteneur, objet: string, indice?: number): { cases: Conteneur['cases']; indice: number } {
  const i = indice !== undefined && inventaire.cases[indice]?.objet === objet ? indice : inventaire.cases.findIndex((p) => p?.objet === objet);
  if (i < 0) return { cases: inventaire.cases, indice: -1 };
  const cases = [...inventaire.cases];
  const pile = cases[i];
  cases[i] = pile && pile.quantite > 1 ? { ...pile, quantite: pile.quantite - 1 } : null;
  return { cases, indice: i };
}

/** Le nouvel objet a quitté la case `indice` ; l'ancien objet porté la reprend (ou va dans la première case libre). */
function rendreAncien(cases: Conteneur['cases'], indice: number, ancien: string): Conteneur | null {
  if (cases[indice] === null) {
    const suite = [...cases];
    suite[indice] = { objet: ancien, quantite: 1 };
    return { cases: suite };
  }
  const r = ajouter({ cases }, ancien, 1);
  return r.reste > 0 ? null : r.conteneur;
}

/**
 * Équipe une armure de l'inventaire (elle quitte l'inventaire). Sans `type`, la meilleure armure possédée.
 * Un seul emplacement. Avec un `type` choisi, une armure déjà portée est échangée : elle prend la place de celle
 * qu'on équipe (la case `indice` si donnée, sinon la première case de cet objet ; l'usure reste celle de l'emplacement).
 * Sans `type`, il faut d'abord retirer l'armure portée.
 */
export function equiperArmure(e: Equipement, inventaire: Conteneur, type?: TypeArmure, indice?: number): ResultatEquipement {
  if (e.armure && !type) return { ok: false, raison: 'deja-portee', equipement: e, inventaire };
  const choisi = type ?? [...TYPES_ARMURE].reverse().find((t) => compter(inventaire, OBJETS_ARMURE[t]) >= 1);
  if (!choisi || compter(inventaire, OBJETS_ARMURE[choisi]) < 1) {
    return { ok: false, raison: 'aucune-armure', equipement: e, inventaire };
  }
  const vide = viderCaseDe(inventaire, OBJETS_ARMURE[choisi], indice);
  if (!e.armure) return { ok: true, equipement: { ...e, armure: choisi }, inventaire: { cases: vide.cases } };
  const rendu = rendreAncien(vide.cases, vide.indice, OBJETS_ARMURE[e.armure]);
  if (!rendu) return { ok: false, raison: 'inventaire-plein', equipement: e, inventaire };
  return { ok: true, equipement: { ...e, armure: choisi }, inventaire: rendu };
}

/** Retire l'armure portée et la remet dans l'inventaire (refus s'il n'y a plus de place). */
export function retirerArmure(e: Equipement, inventaire: Conteneur): ResultatEquipement {
  if (!e.armure) return { ok: false, raison: 'non-portee', equipement: e, inventaire };
  const r = ajouter(inventaire, OBJETS_ARMURE[e.armure], 1);
  if (r.reste > 0) return { ok: false, raison: 'inventaire-plein', equipement: e, inventaire };
  return { ok: true, equipement: { ...e, armure: null }, inventaire: r.conteneur };
}

/**
 * Équipe un casque de l'inventaire (il quitte l'inventaire). Si un casque est déjà porté, les deux s'échangent :
 * l'ancien prend la place du nouveau dans l'inventaire (la case `indice` si donnée, sinon la première case de cet objet).
 */
export function equiperCasque(e: Equipement, inventaire: Conteneur, type: TypeCasque, indice?: number): ResultatEquipement {
  const objet = OBJETS_CASQUE[type];
  if (compter(inventaire, objet) < 1) return { ok: false, raison: 'aucun-casque', equipement: e, inventaire };
  const vide = viderCaseDe(inventaire, objet, indice);
  if (!e.casque) return { ok: true, equipement: { ...e, casque: type }, inventaire: { cases: vide.cases } };
  const rendu = rendreAncien(vide.cases, vide.indice, OBJETS_CASQUE[e.casque]);
  if (!rendu) return { ok: false, raison: 'inventaire-plein', equipement: e, inventaire };
  return { ok: true, equipement: { ...e, casque: type }, inventaire: rendu };
}

/** Retire le casque porté et le remet dans l'inventaire (refus s'il n'y a plus de place). */
export function retirerCasque(e: Equipement, inventaire: Conteneur): ResultatEquipement {
  if (!e.casque) return { ok: false, raison: 'non-portee', equipement: e, inventaire };
  const r = ajouter(inventaire, OBJETS_CASQUE[e.casque], 1);
  if (r.reste > 0) return { ok: false, raison: 'inventaire-plein', equipement: e, inventaire };
  return { ok: true, equipement: { ...e, casque: null }, inventaire: r.conteneur };
}

/**
 * Part des dégâts retirée au total : (armure + bonus Peau dure) × efficacité de l'armure (usée, elle protège moins),
 * plus le casque (toujours plein), plafonnée à `combat.plafondReduction`.
 */
export function reductionTotale(e: Equipement, bonus = 0): number {
  const armure = (reductionArmure(e.armure) + bonus) * efficacite(e, 'armure');
  return Math.min(CONFIG.combat.plafondReduction, armure + reductionCasque(e.casque));
}

/** Messages affichés à l'écran pour chaque refus. */
export const MESSAGES_EQUIPEMENT: Readonly<Record<RaisonEquipement, string>> = {
  'aucune-armure': "Pas d'armure à équiper",
  'aucun-casque': 'Pas de casque à équiper',
  'deja-portee': 'Une armure est déjà portée',
  'non-portee': "Aucune armure n'est portée",
  'inventaire-plein': 'Inventaire plein',
};
