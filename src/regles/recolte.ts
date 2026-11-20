// Récolte : points de vie des éléments du décor, dégâts des outils et butin.
// Pur : aucun import de three, aucun Math.random(). Le butin est tiré avec le générateur à
// graine (graine du monde + identifiant de l'élément) : même élément = même butin.

import { CONFIG } from '../config';
import type { TypeDecor } from '../monde/decor';
import { creerAleatoire, hacher, type Aleatoire } from './aleatoire';
import type { NiveauOutil } from './equipement';

/** Mêmes valeurs que `TypeOutil` de src/scene/outils.ts (qui importe three, donc non utilisable ici). */
export type OutilRecolte = 'hache' | 'pioche' | 'epee';

export type Ressource =
  | 'bois'
  | 'pousse-arbre'
  | 'pierre'
  | 'minerai-cuivre'
  | 'minerai-fer'
  | 'charbon'
  | 'cristal-bleu'
  | 'baies'
  | 'plante-medicinale'
  | 'fibres';

/** Ressources possédées : { bois: 12, pierre: 3 } (l'inventaire complet viendra à l'étape 10). */
export type Ressources = Partial<Record<Ressource, number>>;

/** Noms affichés, au pluriel ou à l'usage du compteur. */
export const NOMS_RESSOURCES: Readonly<Record<Ressource, string>> = {
  bois: 'bois',
  'pousse-arbre': "pousses d'arbre",
  pierre: 'pierre',
  'minerai-cuivre': 'minerai de cuivre',
  'minerai-fer': 'minerai de fer',
  charbon: 'charbon',
  'cristal-bleu': 'cristaux bleus',
  baies: 'baies',
  'plante-medicinale': 'plantes médicinales',
  fibres: 'fibres',
};

/** Ordre d'affichage dans le compteur. */
export const ORDRE_RESSOURCES: readonly Ressource[] = [
  'bois',
  'pierre',
  'minerai-cuivre',
  'minerai-fer',
  'charbon',
  'cristal-bleu',
  'baies',
  'plante-medicinale',
  'fibres',
  'pousse-arbre',
];

export type TypeRecoltable = Exclude<TypeDecor, 'herbe'>;

interface InfosRecolte {
  /** Nombre de coups avec l'outil adapté */
  pointsDeVie: number;
  /** Outil efficace ; `null` = tout outil convient */
  outil: OutilRecolte | null;
  /** Palier minimum de la pioche pour récolter (absent = n'importe laquelle) */
  piocheMin?: NiveauOutil;
  /** Tirage du butin : une entrée par ressource, quantité entre min et max inclus */
  butin: ReadonlyArray<{ ressource: Ressource; min: number; max: number }>;
}

const ARBRE: InfosRecolte = {
  pointsDeVie: 5,
  outil: 'hache',
  butin: [
    { ressource: 'bois', min: 3, max: 5 },
    { ressource: 'pousse-arbre', min: 0, max: 1 },
  ],
};

export const INFOS_RECOLTE: Readonly<Record<TypeRecoltable, InfosRecolte>> = {
  'arbre-feuillu': ARBRE,
  sapin: ARBRE,
  bouleau: ARBRE,
  rocher: { pointsDeVie: 6, outil: 'pioche', butin: [{ ressource: 'pierre', min: 2, max: 4 }] },
  'filon-cuivre': {
    pointsDeVie: 6,
    outil: 'pioche',
    butin: [
      { ressource: 'minerai-cuivre', min: 2, max: 3 },
      { ressource: 'pierre', min: 1, max: 1 },
    ],
  },
  'filon-charbon': {
    pointsDeVie: 8,
    outil: 'pioche',
    piocheMin: 'cuivre',
    butin: [
      { ressource: 'charbon', min: 2, max: 4 },
      { ressource: 'pierre', min: 0, max: 1 },
    ],
  },
  'filon-fer': {
    pointsDeVie: 8,
    outil: 'pioche',
    piocheMin: 'cuivre',
    butin: [
      { ressource: 'minerai-fer', min: 2, max: 3 },
      { ressource: 'pierre', min: 1, max: 1 },
    ],
  },
  // Cristal bleu de la mine : 10 coups de pioche
  'cristal-bleu': {
    pointsDeVie: 10,
    outil: 'pioche',
    piocheMin: 'fer',
    butin: [{ ressource: 'cristal-bleu', min: 1, max: 2 }],
  },
  'buisson-baies': { pointsDeVie: 1, outil: null, butin: [{ ressource: 'baies', min: 2, max: 3 }] },
  'plante-medicinale': {
    pointsDeVie: 1,
    outil: null,
    butin: [{ ressource: 'plante-medicinale', min: 1, max: 2 }],
  },
  fibres: { pointsDeVie: 1, outil: null, butin: [{ ressource: 'fibres', min: 2, max: 3 }] },
};

/** Vrai si le type se récolte (les herbes décoratives non). */
export function estRecoltable(type: TypeDecor): type is TypeRecoltable {
  return type !== 'herbe';
}

/** Outil à prendre automatiquement devant ce type d'élément, ou `null` (on garde l'outil actuel). */
export function outilConseille(type: TypeDecor): OutilRecolte | null {
  return estRecoltable(type) ? INFOS_RECOLTE[type].outil : null;
}

/**
 * Dégâts d'un coup : 1 avec l'outil adapté, un tiers sinon.
 * `facteurOutil` (outil en fer : voir equipement.ts) multiplie les dégâts de l'outil adapté seulement.
 */
export function degatsDuCoup(type: TypeRecoltable, outil: OutilRecolte, facteurOutil = 1): number {
  const attendu = INFOS_RECOLTE[type].outil;
  if (attendu === null) return 1;
  return attendu === outil ? facteurOutil : CONFIG.recolte.facteurOutilInadapte;
}

/** Rang d'un palier (0 = base), d'après l'ordre des paliers de la configuration (pas d'import d'equipement.ts : cycle). */
function rangNiveau(niveau: NiveauOutil): number {
  return Object.keys(CONFIG.fabrication.paliers).indexOf(niveau);
}

/** Palier de pioche minimum pour récolter ce type, ou `null` si n'importe quelle pioche convient. */
export function piocheMinimale(type: TypeDecor): NiveauOutil | null {
  return estRecoltable(type) ? (INFOS_RECOLTE[type].piocheMin ?? null) : null;
}

/** Vrai si une pioche de ce palier peut récolter ce type (le palier ne compte que pour les types à verrou). */
export function peutRecolter(type: TypeDecor, niveauPioche: NiveauOutil): boolean {
  const mini = piocheMinimale(type);
  return mini === null || rangNiveau(niveauPioche) >= rangNiveau(mini);
}

const NOMS_PALIER_PIOCHE: Readonly<Record<NiveauOutil, string>> = {
  base: 'en bois',
  cuivre: 'en cuivre',
  fer: 'en fer',
  acier: 'en acier',
  cristal: 'en cristal',
};

/** Message affiché quand la pioche est trop faible (« Il faut une pioche en cuivre »). */
export function messageVerrouPioche(type: TypeDecor): string {
  const mini = piocheMinimale(type);
  return `Il faut une pioche ${NOMS_PALIER_PIOCHE[mini ?? 'base']}`;
}

/** Points de vie restants par identifiant ; un élément absent est intact, 0 = détruit. */
export interface EtatRecolte {
  readonly pv: Readonly<Record<string, number>>;
}

export function creerEtatRecolte(): EtatRecolte {
  return { pv: {} };
}

/** Générateur à graine pour un identifiant (butin, bonus de compétences) : mêmes entrées, mêmes tirages. */
export function generateurButin(graine: number, id: string): Aleatoire {
  return creerAleatoire((Math.imul(graine | 0, 0x9e3779b1) ^ hacher(id)) >>> 0);
}

/** Butin d'un élément : toujours le même pour une graine et un identifiant donnés. */
export function tirerButin(type: TypeRecoltable, id: string, graine: number = CONFIG.graine): Ressources {
  const alea = generateurButin(graine, id);
  const butin: Ressources = {};
  for (const { ressource, min, max } of INFOS_RECOLTE[type].butin) {
    const n = alea.entier(min, max);
    if (n > 0) butin[ressource] = n;
  }
  return butin;
}

export interface ResultatFrappe {
  etat: EtatRecolte;
  /** Vrai seulement au coup qui détruit l'élément */
  detruit: boolean;
  /** Butin de ce coup (vide tant que l'élément tient) */
  butin: Ressources;
  /** Points de vie restants (0 si détruit) */
  restants: number;
}

/** Un coup d'outil sur un élément. Un élément déjà détruit ou non récoltable ne donne rien. */
export function frapper(
  etat: EtatRecolte,
  element: { id: string; type: TypeDecor },
  outil: OutilRecolte,
  graine: number = CONFIG.graine,
  facteurOutil = 1,
): ResultatFrappe {
  if (!estRecoltable(element.type)) return { etat, detruit: false, butin: {}, restants: 0 };
  const avant = etat.pv[element.id] ?? INFOS_RECOLTE[element.type].pointsDeVie;
  if (avant <= 0) return { etat, detruit: false, butin: {}, restants: 0 };

  let apres = avant - degatsDuCoup(element.type, outil, facteurOutil);
  // Marge pour les erreurs d'arrondi (3 coups à 1/3 doivent valoir 1 point)
  if (apres < 1e-6) apres = 0;
  const suite: EtatRecolte = { pv: { ...etat.pv, [element.id]: apres } };
  if (apres > 0) return { etat: suite, detruit: false, butin: {}, restants: apres };
  return { etat: suite, detruit: true, butin: tirerButin(element.type, element.id, graine), restants: 0 };
}
