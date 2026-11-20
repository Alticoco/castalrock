// Inventaire : conteneurs à cases (inventaire porté, sac magique), piles d'objets.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable : chaque fonction
// renvoie un nouveau conteneur et ne modifie jamais celui qu'on lui donne.

import { CONFIG } from '../config';
import { NOMS_RESSOURCES, ORDRE_RESSOURCES, type Ressource, type Ressources } from './recolte';

export type CategorieObjet = 'ressource' | 'outil' | 'objet';

/** Un type d'objet : identifiant, nom affiché, catégorie, taille maximale d'une pile. */
export interface DefinitionObjet {
  readonly id: string;
  readonly nom: string;
  readonly categorie: CategorieObjet;
  readonly pileMax: number;
}

/** Catalogue des objets connus : les ressources de la récolte. */
const CATALOGUE: Record<string, DefinitionObjet> = {};
for (const id of ORDRE_RESSOURCES) {
  CATALOGUE[id] = { id, nom: NOMS_RESSOURCES[id], categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax };
}

// Objets fabriqués (étape 15) : les outils en fer et la sacoche ne sont pas des objets, ils s'équipent
const OBJETS_FABRIQUES: ReadonlyArray<DefinitionObjet> = [
  { id: 'lingot-cuivre', nom: 'lingot de cuivre', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  { id: 'lingot-fer', nom: 'lingot de fer', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  { id: 'lingot-acier', nom: "lingot d'acier", categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  { id: 'armure-fibres', nom: 'armure de fibres', categorie: 'objet', pileMax: 1 },
  { id: 'armure-cuir', nom: 'armure de cuir', categorie: 'objet', pileMax: 1 },
  { id: 'armure-fourrure', nom: 'armure de fourrure', categorie: 'objet', pileMax: 1 },
  { id: 'armure-mailles', nom: 'armure de mailles', categorie: 'objet', pileMax: 1 },
  { id: 'armure-plaques', nom: 'armure de plaques', categorie: 'objet', pileMax: 1 },
  { id: 'casque-cuir', nom: 'bonnet de cuir', categorie: 'objet', pileMax: 1 },
  { id: 'casque-fourrure', nom: 'chapka de fourrure', categorie: 'objet', pileMax: 1 },
  { id: 'casque-mailles', nom: 'camail de mailles', categorie: 'objet', pileMax: 1 },
  { id: 'casque-plaques', nom: "heaume d'acier", categorie: 'objet', pileMax: 1 },
  { id: 'potion-soin', nom: 'potion de soin', categorie: 'objet', pileMax: 10 },
  { id: 'kit-feu-camp', nom: 'kit de feu de camp', categorie: 'objet', pileMax: 5 },
  // Seau de Mathilde : à remplir au puits, puis à vider sur le potager de la maison (sans durabilité, ne s'équipe pas)
  { id: 'seau', nom: 'seau', categorie: 'objet', pileMax: 1 },
  { id: 'seau-eau', nom: "seau d'eau", categorie: 'objet', pileMax: 1 },
  { id: 'piege', nom: 'piège', categorie: 'objet', pileMax: 5 },
  // Cuisine (lot 2b) : on les mange d'un clic dans l'inventaire
  { id: 'viande-cuite', nom: 'viande cuite', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  { id: 'ragout', nom: 'ragoût', categorie: 'objet', pileMax: 10 },
  // Boucliers (étape 33) : ils s'équipent dès la fabrication (bras gauche), ils ne prennent pas de case
  { id: 'bouclier-bois', nom: 'bouclier en bois', categorie: 'objet', pileMax: 1 },
  { id: 'bouclier-renforce', nom: 'bouclier renforcé', categorie: 'objet', pileMax: 1 },
  // Arc (lot 2b) : il s'équipe dès la fabrication (case 4 de la barre d'outils) ; les flèches se portent dans l'inventaire
  { id: 'arc', nom: 'arc', categorie: 'objet', pileMax: 1 },
  { id: 'fleche', nom: 'flèche', categorie: 'objet', pileMax: CONFIG.inventaire.pileMax },
];
for (const def of OBJETS_FABRIQUES) CATALOGUE[def.id] = def;

// Butin des ennemis (étape 16)
const OBJETS_BUTIN: ReadonlyArray<DefinitionObjet> = [
  { id: 'gelee-slime', nom: 'gelée de slime', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  { id: 'or', nom: "pièces d'or", categorie: 'ressource', pileMax: 999 },
  // Laissée par le loup ; sert à l'armure de fourrure
  { id: 'fourrure', nom: 'fourrure de loup', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  // Laissé par les bandits (puis les animaux au lot 2b)
  { id: 'cuir', nom: 'cuir', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  // Animaux (lot 2b) : la viande se cuisine au feu, la fourrure de renard se vend au marchand
  { id: 'viande-crue', nom: 'viande crue', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  { id: 'fourrure-renard', nom: 'fourrure de renard', categorie: 'ressource', pileMax: CONFIG.inventaire.pileMax },
  // Laissé par Morvan le Balafré (étape 45) : il sert à reforger le Cœur de Castal, à l'autel de la montagne
  { id: 'eclat-coeur', nom: 'Éclat du Cœur', categorie: 'objet', pileMax: 1 },
];
for (const def of OBJETS_BUTIN) CATALOGUE[def.id] = def;

/** Identifiants de tous les objets du catalogue (ressources, butin, objets fabriqués). */
export function idsCatalogue(): string[] {
  return Object.keys(CATALOGUE);
}

/** Définition d'un objet ; un identifiant inconnu (sauvegarde d'une autre version) reste utilisable. */
export function definitionObjet(id: string): DefinitionObjet {
  return CATALOGUE[id] ?? { id, nom: id, categorie: 'objet', pileMax: CONFIG.inventaire.pileMax };
}

/** Une pile : `quantite` objets du même type dans une case (toujours au moins 1). */
export interface Pile {
  readonly objet: string;
  readonly quantite: number;
}

/** Une case vaut `null` quand elle est vide. */
export interface Conteneur {
  readonly cases: ReadonlyArray<Pile | null>;
}

export function creerConteneur(nombreCases: number): Conteneur {
  return { cases: Array.from({ length: Math.max(0, Math.floor(nombreCases)) }, () => null) };
}

/** Conteneur agrandi à `nombreCases` cases (des cases vides en plus). Jamais plus petit : aucun objet n'est perdu. */
export function agrandir(c: Conteneur, nombreCases: number): Conteneur {
  const manque = Math.floor(nombreCases) - c.cases.length;
  if (manque <= 0) return c;
  return { cases: [...c.cases, ...Array.from({ length: manque }, () => null)] };
}

export interface ResultatAjout {
  conteneur: Conteneur;
  /** Quantité qui ne rentre pas (0 si tout est entré) */
  reste: number;
}

/** Ajoute des objets : complète d'abord les piles existantes, puis remplit les cases vides. */
export function ajouter(c: Conteneur, objet: string, quantite: number): ResultatAjout {
  let reste = Math.floor(quantite);
  if (!(reste > 0)) return { conteneur: c, reste: 0 };
  const max = definitionObjet(objet).pileMax;
  const cases = [...c.cases];
  for (let i = 0; i < cases.length && reste > 0; i++) {
    const pile = cases[i];
    if (pile === null || pile.objet !== objet || pile.quantite >= max) continue;
    const ajout = Math.min(reste, max - pile.quantite);
    cases[i] = { objet, quantite: pile.quantite + ajout };
    reste -= ajout;
  }
  for (let i = 0; i < cases.length && reste > 0; i++) {
    if (cases[i] !== null) continue;
    const ajout = Math.min(reste, max);
    cases[i] = { objet, quantite: ajout };
    reste -= ajout;
  }
  return { conteneur: { cases }, reste };
}

export interface ResultatAjoutButin {
  conteneur: Conteneur;
  /** Ce qui ne rentre pas, par ressource (vide si tout est entré) */
  reste: Ressources;
}

/** Ajoute un butin de ressources ; ce qui ne rentre pas est renvoyé dans `reste`. */
export function ajouterButin(c: Conteneur, butin: Ressources): ResultatAjoutButin {
  let suite = c;
  const reste: Ressources = {};
  for (const [nom, n] of Object.entries(butin) as Array<[Ressource, number]>) {
    const r = ajouter(suite, nom, n);
    suite = r.conteneur;
    if (r.reste > 0) reste[nom] = r.reste;
  }
  return { conteneur: suite, reste };
}

/** Pré-vérification : tout le butin rentre-t-il dans le conteneur ? */
export function peutAjouterButin(c: Conteneur, butin: Ressources): boolean {
  return Object.keys(ajouterButin(c, butin).reste).length === 0;
}

export interface ResultatRetrait {
  conteneur: Conteneur;
  /** Quantité réellement retirée (moins que demandé s'il n'y en avait pas assez) */
  retire: number;
}

/** Retire des objets, en vidant d'abord les dernières piles. */
export function retirer(c: Conteneur, objet: string, quantite: number): ResultatRetrait {
  let reste = Math.floor(quantite);
  if (!(reste > 0)) return { conteneur: c, retire: 0 };
  const demande = reste;
  const cases = [...c.cases];
  for (let i = cases.length - 1; i >= 0 && reste > 0; i--) {
    const pile = cases[i];
    if (pile === null || pile.objet !== objet) continue;
    const prise = Math.min(reste, pile.quantite);
    cases[i] = prise === pile.quantite ? null : { objet, quantite: pile.quantite - prise };
    reste -= prise;
  }
  return { conteneur: { cases }, retire: demande - reste };
}

/** Nombre total d'un objet dans le conteneur. */
export function compter(c: Conteneur, objet: string): number {
  let n = 0;
  for (const pile of c.cases) if (pile !== null && pile.objet === objet) n += pile.quantite;
  return n;
}

export interface ResultatDeplacement {
  source: Conteneur;
  destination: Conteneur;
  /** Quantité réellement déplacée (0 si la case est vide ou si la destination est pleine) */
  deplace: number;
}

/**
 * Déplace la pile d'une case vers un autre conteneur (inventaire <-> sac).
 * Si la destination ne peut pas tout prendre, ce qui ne rentre pas reste dans la case d'origine.
 */
export function deplacerPile(source: Conteneur, indice: number, destination: Conteneur): ResultatDeplacement {
  const pile = source.cases[indice];
  if (!pile) return { source, destination, deplace: 0 };
  const r = ajouter(destination, pile.objet, pile.quantite);
  const deplace = pile.quantite - r.reste;
  if (deplace === 0) return { source, destination, deplace: 0 };
  const cases = [...source.cases];
  cases[indice] = r.reste > 0 ? { objet: pile.objet, quantite: r.reste } : null;
  return { source: { cases }, destination: r.conteneur, deplace };
}

export interface ResultatGlisse {
  source: Conteneur;
  destination: Conteneur;
  /** Faux si rien n'a bougé (même case, case de départ vide, indice hors limites, pile pleine) */
  change: boolean;
}

/**
 * Glisse la pile de `source[iSource]` sur `destination[iDest]` (même conteneur ou un autre) :
 * - case d'arrivée vide : la pile s'y déplace ;
 * - même objet : on empile jusqu'à `pileMax`, ce qui ne rentre pas reste dans la case de départ ;
 * - objet différent : les deux piles s'échangent.
 * Quand `memeConteneur` est vrai, `source` et `destination` sont le même conteneur : le résultat renvoie
 * alors un seul conteneur modifié (les deux champs sont identiques).
 */
export function glisserPile(
  source: Conteneur,
  iSource: number,
  destination: Conteneur,
  iDest: number,
  memeConteneur: boolean,
): ResultatGlisse {
  // Même objet donné deux fois : c'est forcément le même conteneur, quoi qu'en dise l'appelant
  memeConteneur = memeConteneur || source === destination;
  const rien: ResultatGlisse = { source, destination, change: false };
  const depart = Number.isInteger(iSource) ? source.cases[iSource] : null;
  if (!depart) return rien;
  if (!Number.isInteger(iDest) || iDest < 0 || iDest >= destination.cases.length) return rien;
  if (memeConteneur && iSource === iDest) return rien;

  const arrivee = destination.cases[iDest];
  let nouvelleArrivee: Pile;
  let nouveauDepart: Pile | null;
  if (!arrivee) {
    nouvelleArrivee = depart;
    nouveauDepart = null;
  } else if (arrivee.objet === depart.objet) {
    const ajout = Math.min(depart.quantite, Math.max(0, definitionObjet(depart.objet).pileMax - arrivee.quantite));
    if (ajout === 0) return rien;
    nouvelleArrivee = { objet: arrivee.objet, quantite: arrivee.quantite + ajout };
    nouveauDepart = ajout < depart.quantite ? { objet: depart.objet, quantite: depart.quantite - ajout } : null;
  } else {
    nouvelleArrivee = depart;
    nouveauDepart = arrivee;
  }

  if (memeConteneur) {
    const cases = [...source.cases];
    cases[iDest] = nouvelleArrivee;
    cases[iSource] = nouveauDepart;
    const c = { cases };
    return { source: c, destination: c, change: true };
  }
  const casesSource = [...source.cases];
  const casesDest = [...destination.cases];
  casesSource[iSource] = nouveauDepart;
  casesDest[iDest] = nouvelleArrivee;
  return { source: { cases: casesSource }, destination: { cases: casesDest }, change: true };
}
