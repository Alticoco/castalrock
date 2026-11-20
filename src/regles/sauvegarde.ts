// Sauvegarde de la partie : mise en JSON avec numéro de version, migration et validation.
// Pur : aucun import de three, aucun accès au navigateur (le stockage est dans src/moteur/stockage.ts).
// Une sauvegarde abîmée ou d'une version inconnue donne `null` : le jeu démarre alors une nouvelle partie.

import type { Conteneur, Pile } from './inventaire';
import { TYPES_ARBRE, type Plante, type Retire, type TypeArbre } from './repousse';
import { INFOS_DECOR } from '../monde/decor';
import { CONFIG } from '../config';
import {
  EMPLACEMENTS_USURE,
  NIVEAUX_OUTIL,
  OUTILS,
  TYPES_ARMURE,
  TYPES_CASQUE,
  creerEquipement,
  durabiliteMax,
  durabilitesNeuves,
  type Equipement,
  type TypeArmure,
  type TypeCasque,
} from './equipement';
import { TYPES_BOUCLIER, type TypeBouclier } from './equipement';
import type { FeuCamp } from './campement';
import { PROIES, type Piege, type Proie } from './pieges';
import { POINT_REAPPARITION_DEFAUT, type Baluchon, type PointReapparition } from './mort';
import { NIVEAU_VILLAGE_MAX, type NiveauVillage } from './village';
import { CHAINES, chercherQuete, creerEtatQuetes, queteDeblocageVillage, quetesDeChaine, type EtatQuetes } from './quetes';
import { chercherNoeud } from './competences';
import { ETAPE_TROUVER_ALDRIC_V23, creerEtatHistoire, lireEtatHistoire, migrerEtapeV19, migrerEtapeV23, type EtatHistoire } from './histoire';
import { creerEtatLieux, lireEtatLieux, type EtatLieux } from './lieux';
import { creerEtatMarchand, lireEtatMarchand, type EtatMarchand } from './marchand';
import { creerEtatAttaques, lireEtatAttaques, type EtatAttaques } from './attaques';
import { lireCoffresEntames, lireCoffresOuverts, type CoffresEntames } from './tresors';
import { creerEtatPotager, lireEtatPotager, type EtatPotager } from './potager';
import { lireReperes, type EtatReperes } from './reperes';
import { creerProgression, facteurDurabilite, manaMax, pvMax, xpPourNiveauSuivant, type Progression } from './progression';

export const VERSION_SAUVEGARDE = 25;

/** Mêmes valeurs que `NomVue` de src/scene/cameras.ts (qui importe three, donc non utilisable ici). */
export type VueSauvegardee = 'premiere' | 'troisieme';
/** 'diagonale' : vue abandonnée, une ancienne sauvegarde qui la contient se charge en 1re personne. */
const VUES: readonly string[] = ['premiere', 'troisieme', 'diagonale'];

/** Tout ce qu'on retrouve en rechargeant la partie. */
export interface DonneesPartie {
  /** Graine du monde : une sauvegarde d'une autre graine est refusée (les identifiants du décor ne correspondraient plus) */
  graine: number;
  personnage: { x: number; y: number; z: number; orientation: number };
  vue: VueSauvegardee;
  /** Temps de jeu écoulé, en secondes */
  tempsJeu: number;
  inventaire: Conteneur;
  sac: Conteneur;
  /** Éléments du décor retirés (arbres coupés, rochers cassés, buissons cueillis...) avec leur instant de retrait */
  retires: Retire[];
  /** Arbres plantés par le joueur */
  plantes: Plante[];
  /** Numéro de la prochaine pousse plantée (identifiants `p:<n>`) */
  compteurPlantes: number;
  /** Coffre du village (troisième conteneur) */
  coffre: Conteneur;
  /** Niveau du village (1 au départ) */
  niveauVillage: NiveauVillage;
  /** Niveau des outils, armure portée, sacoche (la taille de l'inventaire porté est celle de `inventaire`) */
  equipement: Equipement;
  /** Points de vie du joueur */
  vie: number;
  /** Baluchon laissé par la dernière mort (`null` s'il n'y en a pas) */
  baluchon: Baluchon | null;
  /** Dernier point de réapparition (la place du village par défaut) */
  pointReapparition: PointReapparition;
  /** XP, niveau, points de compétence, nœuds de l'arbre acquis, mana */
  progression: Progression;
  /** Quêtes acceptées (avec leur compteur) et terminées */
  quetes: EtatQuetes;
  /** Chaîne principale de l'histoire : étape active, compteur, habitants rencontrés */
  histoire: EtatHistoire;
  /** Marchand ambulant : numéro de la visite en cours et lots déjà achetés pendant cette visite */
  marchand: EtatMarchand;
  /** Attaques de bandits : dernier jour traité (l'attaque en cours n'est jamais sauvegardée) */
  attaques: EtatAttaques;
  /** Lieux de l'histoire : camp et autel découverts, Morvan vaincu, Cœur reforgé */
  lieux: EtatLieux;
  /** Petits coffres des ruines et des grottes déjà ouverts (identifiants) ; absent d'une ancienne sauvegarde = aucun */
  tresorsOuverts: string[];
  /** Petits coffres entamés (inventaire trop plein) : ce qu'il leur reste ; absent = aucun */
  tresorsEntames?: CoffresEntames;
  /** Le livre de fin a déjà été refermé ; écrit seulement quand il est vrai, absent = pas vu */
  finVue?: boolean;
  /** Potager de la maison : jour du dernier arrosage (`null` : pas arrosé) ; absent d'une ancienne sauvegarde = pas arrosé */
  potager: EtatPotager;
  /** Feu de camp posé par le joueur (`null` s'il n'y en a pas) */
  feuCamp: FeuCamp | null;
  /** Pièges posés (5 au plus) : position, instant de pose ou de relève, état et proie */
  pieges: Piege[];
  /** Mine : le joueur y est-il (sa position est celle du personnage), et l'a-t-il déjà visitée (boussole) */
  mine: { dedans: boolean; visitee: boolean };
  /** Repères personnels posés sur la carte (8 au plus) et celui que suit la boussole */
  reperes: EtatReperes;
  /** Posé à la lecture seulement : la sauvegarde venait d'avant l'arbre de compétences et ses points ont été rendus (jamais écrit) */
  arbreMigre?: boolean;
}

// Limites de validation (protègent d'un fichier absurde, pas des règles du jeu)
const CASES_MAX = 500;
const QUANTITE_MAX = 1_000_000;
const ELEMENTS_MAX = 100_000;

/** Écrit la partie en JSON, avec son numéro de version. */
export function serialiser(donnees: DonneesPartie): string {
  return JSON.stringify({ version: VERSION_SAUVEGARDE, ...donnees });
}

/**
 * Met une sauvegarde brute à la version courante, une version après l'autre.
 * Renvoie `null` si elle n'a pas de version ou vient d'une version plus récente que le jeu.
 */
export function migrer(brut: unknown): Record<string, unknown> | null {
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) return null;
  let donnees = brut as Record<string, unknown>;
  let version = donnees.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return null;
  if (version > VERSION_SAUVEGARDE) return null;
  while (version < VERSION_SAUVEGARDE) {
    // Une étape de migration par changement de format
    if (version === 1) {
      // v1 -> v2 : liste d'identifiants retirés -> identifiant + instant de retrait (celui de la sauvegarde,
      // faute de mieux) ; pas encore d'arbres plantés
      const anciens = donnees.retires;
      const instant = typeof donnees.tempsJeu === 'number' ? donnees.tempsJeu : 0;
      donnees = {
        ...donnees,
        retires: Array.isArray(anciens)
          ? anciens.map((id: unknown) => (typeof id === 'string' ? { id, instant } : id))
          : anciens,
        plantes: [],
        compteurPlantes: 0,
      };
    } else if (version === 2) {
      // v2 -> v3 : le village apparaît, au niveau 1, avec un coffre vide
      donnees = {
        ...donnees,
        coffre: { cases: Array.from({ length: CONFIG.inventaire.casesCoffre }, () => null) },
        niveauVillage: 1,
      };
    } else if (version === 3) {
      // v3 -> v4 : la fabrication apparaît ; outils de base, sans armure ni sacoche
      donnees = { ...donnees, equipement: creerEquipement() };
    } else if (version === 4) {
      // v4 -> v5 : le combat apparaît ; le joueur a toute sa vie
      donnees = { ...donnees, vie: CONFIG.combat.vieMax };
    } else if (version === 5) {
      // v5 -> v6 : la mort douce apparaît ; équipement neuf, pas de baluchon, réapparition sur la place du village
      const ancien = donnees.equipement;
      const equipement =
        typeof ancien === 'object' && ancien !== null && !Array.isArray(ancien)
          ? { durabilite: durabilitesNeuves(), ...(ancien as Record<string, unknown>) }
          : ancien;
      donnees = { ...donnees, equipement, baluchon: null, pointReapparition: POINT_REAPPARITION_DEFAUT };
    } else if (version === 6) {
      // v6 -> v7 : la progression apparaît ; niveau 1, sans XP ni point, compétences au rang 0, mana plein
      donnees = { ...donnees, progression: creerProgression() };
    } else if (version === 7) {
      // v7 -> v8 : les quêtes apparaissent ; aucune acceptée ni terminée
      donnees = { ...donnees, quetes: creerEtatQuetes() };
    } else if (version === 8) {
      // v8 -> v9 : le feu de camp apparaît ; aucun feu posé
      donnees = { ...donnees, feuCamp: null };
    } else if (version === 9) {
      // v9 -> v10 : la mine apparaît ; le joueur est dehors et ne l'a jamais visitée
      donnees = { ...donnees, mine: { dedans: false, visitee: false } };
    } else if (version === 10) {
      // v10 -> v11 : paliers d'outils et armures par palier. Un outil « fer » reste « fer », l'ancienne durabilité
      // est gardée (bornée au maximum du palier à la lecture) ; l'armure de fibres portée reste de fibres.
      const ancien = donnees.equipement;
      const equipement =
        typeof ancien === 'object' && ancien !== null && !Array.isArray(ancien)
          ? { ...(ancien as Record<string, unknown>), armure: (ancien as { armure?: unknown }).armure === true ? 'fibres' : null }
          : ancien;
      donnees = { ...donnees, equipement };
    } else if (version === 11) {
      // v11 -> v12 : l'arbre de compétences remplace les six compétences à rangs. Tous les points dépensés
      // sont rendus (points + somme des rangs), aucun nœud n'est acquis.
      donnees = migrerVersArbre(donnees);
    } else if (version === 12) {
      // v12 -> v13 : les quêtes passent en quatre chaînes (mêmes identifiants). Une quête faite compte comme faite
      // dans sa chaîne, avec ses précédentes ; un village déjà agrandi compte les quêtes de déblocage comme faites.
      donnees = migrerVersChaines(donnees);
    } else if (version === 13) {
      // v13 -> v14 : le bouclier apparaît dans l'équipement ; personne n'en a encore
      const ancien = donnees.equipement;
      const equipement =
        typeof ancien === 'object' && ancien !== null && !Array.isArray(ancien)
          ? { ...(ancien as Record<string, unknown>), bouclier: null }
          : ancien;
      donnees = { ...donnees, equipement };
    } else if (version === 14) {
      // v14 -> v15 : les pièges apparaissent ; aucun n'est posé
      donnees = { ...donnees, pieges: [] };
    } else if (version === 15) {
      // v15 -> v16 : l'arc apparaît dans l'équipement ; personne n'en a encore
      const ancien = donnees.equipement;
      const equipement =
        typeof ancien === 'object' && ancien !== null && !Array.isArray(ancien)
          ? { ...(ancien as Record<string, unknown>), arc: false }
          : ancien;
      donnees = { ...donnees, equipement };
    } else if (version === 16) {
      // v16 -> v17 : la chaîne principale de l'histoire apparaît. Une ancienne partie démarre à l'étape que sa progression
      // justifie (voir `etapeDepartV16`) ; les étapes « état » déjà remplies passent toutes seules au premier contrôle.
      const lue = lireEtatHistoire(donnees.histoire);
      donnees = { ...donnees, histoire: lue ?? { ...creerEtatHistoire(), etape: etapeDepartV16(donnees) } };
    } else if (version === 17) {
      // v17 -> v18 : le marchand ambulant apparaît ; aucune visite, rien d'acheté
      donnees = { ...donnees, marchand: lireEtatMarchand(donnees.marchand) ?? creerEtatMarchand() };
    } else if (version === 18) {
      // v18 -> v19 : les attaques de bandits apparaissent ; aucun jour traité
      donnees = { ...donnees, attaques: lireEtatAttaques(donnees.attaques) ?? creerEtatAttaques() };
    } else if (version === 19) {
      // v19 -> v20 : le camp des bandits, Morvan et l'autel du Cœur apparaissent, et l'acte IV change d'étapes
      donnees = migrerVersLieux(donnees);
    } else if (version === 20) {
      // v20 -> v21 : les repères personnels apparaissent ; aucun repère posé, rien de suivi
      donnees = { ...donnees, reperes: lireReperes(donnees.reperes) };
    } else if (version === 21) {
      // v21 -> v22 : les casques apparaissent dans l'équipement ; personne n'en porte encore
      const ancien = donnees.equipement;
      const equipement =
        typeof ancien === 'object' && ancien !== null && !Array.isArray(ancien)
          ? { ...(ancien as Record<string, unknown>), casque: null }
          : ancien;
      donnees = { ...donnees, equipement };
    } else if (version === 22) {
      // v22 -> v23 : la courbe d'XP est adoucie ; le niveau est recalculé avec la même XP totale (points en plus)
      donnees = migrerCourbeXp(donnees);
    } else if (version === 23) {
      // v23 -> v24 : le village est attaqué après la rencontre d'Aldric (3 étapes et 3 quêtes de reconstruction de plus)
      donnees = migrerVersReconstruction(donnees);
    } else if (version === 24) {
      // v24 -> v25 : le potager de la maison apparaît ; il n'est pas arrosé
      donnees = { ...donnees, potager: creerEtatPotager() };
    }
    donnees = { ...donnees, version: version + 1 };
    version += 1;
  }
  return donnees;
}

/**
 * v23 -> v24 : trois étapes sont insérées après « Trouve Aldric ». Une partie arrêtée après cette étape voit ses numéros
 * d'étape décalés de 3 et les trois quêtes de reconstruction marquées rendues (elle ne voit jamais de maison détruite) ;
 * une partie à « Trouve Aldric » ou avant ne change que de version.
 */
function migrerVersReconstruction(donnees: Record<string, unknown>): Record<string, unknown> {
  const histoire = donnees.histoire;
  if (typeof histoire !== 'object' || histoire === null || Array.isArray(histoire)) return donnees;
  const ancienne = (histoire as { etape?: unknown }).etape;
  if (typeof ancienne !== 'number' || !Number.isInteger(ancienne) || ancienne <= ETAPE_TROUVER_ALDRIC_V23) return donnees;
  let quetes = donnees.quetes;
  if (typeof quetes === 'object' && quetes !== null && !Array.isArray(quetes)) {
    const { terminees } = quetes as { terminees?: unknown };
    if (Array.isArray(terminees)) {
      const rendues = quetesDeChaine('relever').map((q) => q.id);
      quetes = { ...quetes, terminees: [...(terminees as unknown[]), ...rendues.filter((id) => !(terminees as unknown[]).includes(id))] };
    }
  }
  return { ...donnees, histoire: { ...histoire, etape: migrerEtapeV23(ancienne) }, quetes };
}

/** Ancienne courbe d'XP (avant v23), codée en dur : XP pour passer du niveau n au suivant = arrondi(150 × n ^ 1,4). */
const ancienXpPourNiveauSuivant = (niveau: number): number => Math.round(150 * Math.pow(Math.max(1, niveau), 1.4));

/**
 * v22 -> v23 : l'XP totale gagnée (niveaux passés avec l'ancienne courbe, plus l'XP du niveau en cours) est rejouée
 * avec la nouvelle courbe. Le joueur ne perd rien : les niveaux gagnés en plus donnent chacun un point de compétence ;
 * les nœuds acquis restent.
 */
function migrerCourbeXp(donnees: Record<string, unknown>): Record<string, unknown> {
  const ancienne = donnees.progression;
  if (typeof ancienne !== 'object' || ancienne === null || Array.isArray(ancienne)) return donnees;
  const { niveau, xp, points } = ancienne as Record<string, unknown>;
  if (typeof niveau !== 'number' || !Number.isInteger(niveau) || niveau < 1) return donnees;
  if (typeof xp !== 'number' || !Number.isFinite(xp) || xp < 0) return donnees;
  if (typeof points !== 'number' || !Number.isInteger(points)) return donnees;
  const niveauMax = CONFIG.progression.niveauMax;
  let total = xp;
  for (let n = 1; n < niveau; n++) total += ancienXpPourNiveauSuivant(n);
  let nouveau = 1;
  while (nouveau < niveauMax && total >= xpPourNiveauSuivant(nouveau)) {
    total -= xpPourNiveauSuivant(nouveau);
    nouveau += 1;
  }
  const dansLeNiveau = nouveau >= niveauMax ? 0 : total;
  // Sécurité : le niveau ne baisse jamais (la nouvelle courbe est plus douce, donc cela n'arrive pas)
  if (nouveau < niveau) return donnees;
  const gagnes = nouveau - niveau;
  return { ...donnees, progression: { ...ancienne, niveau: nouveau, xp: dansLeNiveau, points: points + gagnes } };
}

/**
 * v16 -> v17 : étape de départ de l'histoire d'après ce que la partie sait déjà (numéros de l'histoire à 19 étapes,
 * les mêmes jusqu'à 15) : village niveau 2 ou plus -> début de l'acte II (9) ; outils en cuivre ou mieux -> « Débarrasse
 * le village de 5 slimes » (6) ; mine déjà visitée ou quêtes commencées -> début de l'acte I (4) ; sinon le prologue (0).
 * (La sauvegarde ne retient pas si la maison a été visitée : la mine visitée et les quêtes en tiennent lieu.)
 */
export function etapeDepartV16(donnees: Record<string, unknown>): number {
  if (typeof donnees.niveauVillage === 'number' && donnees.niveauVillage >= 2) return 9;
  const equipement = donnees.equipement as { outils?: Record<string, unknown> } | null | undefined;
  const outils = typeof equipement === 'object' && equipement !== null ? equipement.outils : undefined;
  const rangs = outils && typeof outils === 'object' ? Object.values(outils).map((n) => NIVEAUX_OUTIL.indexOf(n as (typeof NIVEAUX_OUTIL)[number])) : [];
  if (Math.max(0, ...rangs) >= 1) return 6;
  const mine = donnees.mine as { visitee?: unknown } | null | undefined;
  const quetes = donnees.quetes as { enCours?: unknown; terminees?: unknown } | null | undefined;
  const quetesCommencees = [quetes?.enCours, quetes?.terminees].some((l) => Array.isArray(l) && l.length > 0);
  if (mine?.visitee === true || quetesCommencees) return 4;
  return 0;
}

/**
 * v19 -> v20 : rien n'est découvert ni vaincu. L'histoire avait 19 étapes, dont deux provisoires à l'acte IV
 * (« éclaireurs » et « porter à Aldric ») : une partie arrêtée sur l'une d'elles reprend à « Trouve le camp du Balafré »,
 * les étapes suivantes sont décalées d'un rang. Une partie qui avait déjà « reforgé le Cœur » chez Aldric (épilogue ou
 * histoire finie) garde cet acquis : Morvan est vaincu et le Cœur reforgé, pour que le monde raconte la même chose.
 */
function migrerVersLieux(donnees: Record<string, unknown>): Record<string, unknown> {
  let lieux = lireEtatLieux(donnees.lieux) ?? creerEtatLieux();
  let histoire = donnees.histoire;
  if (typeof histoire === 'object' && histoire !== null && !Array.isArray(histoire)) {
    const ancienne = (histoire as { etape?: unknown }).etape;
    if (typeof ancienne === 'number' && Number.isInteger(ancienne)) {
      const m = migrerEtapeV19(ancienne);
      histoire = { ...(histoire as Record<string, unknown>), etape: m.etape, ...(m.remiseAZero ? { compteur: 0, vus: [] } : {}) };
      if (ancienne >= 18) lieux = { campDecouvert: true, autelDecouvert: true, morvanVaincu: true, coeurReforge: true };
    }
  }
  return { ...donnees, histoire, lieux };
}

/**
 * v12 -> v13 : complète les quêtes terminées pour les quatre chaînes. Les quêtes en cours sont gardées ;
 * celles qui n'existent plus sont retirées (la lecture les ignore aussi, par sécurité).
 */
function migrerVersChaines(donnees: Record<string, unknown>): Record<string, unknown> {
  const q = donnees.quetes;
  if (typeof q !== 'object' || q === null) return donnees;
  const { enCours, terminees } = q as { enCours?: unknown; terminees?: unknown };
  if (!Array.isArray(enCours) || !Array.isArray(terminees)) return donnees;
  const gardees = (enCours as unknown[]).filter(
    (c) => typeof c === 'object' && c !== null && typeof (c as { id?: unknown }).id === 'string' && chercherQuete((c as { id: string }).id),
  );
  const idsEnCours = gardees.map((c) => (c as { id: string }).id);
  const finies = new Set((terminees as unknown[]).filter((id): id is string => typeof id === 'string' && chercherQuete(id) !== undefined));
  // Village déjà agrandi : les quêtes qui l'autorisent sont faites
  const niveau = typeof donnees.niveauVillage === 'number' ? donnees.niveauVillage : 1;
  for (const n of [2, 3]) if (niveau >= n) finies.add(queteDeblocageVillage(n)?.id ?? '');
  finies.delete('');
  // Chaque chaîne : tout ce qui précède la dernière quête faite ou en cours est fait (sauf ce qui est en cours),
  // sinon une quête sautée resterait « suivante » et l'habitant ne permettrait pas de rendre celle en cours
  for (const c of CHAINES) {
    const ids = quetesDeChaine(c.id).map((x) => x.id);
    const derniere = Math.max(...ids.map((id, i) => (finies.has(id) || idsEnCours.includes(id) ? i : -1)));
    for (const id of ids.slice(0, derniere + 1)) if (!idsEnCours.includes(id)) finies.add(id);
  }
  return {
    ...donnees,
    quetes: { enCours: gardees.filter((c) => !finies.has((c as { id: string }).id)), terminees: [...finies] },
  };
}

/** v11 -> v12 : les rangs disparaissent, leurs points reviennent ; `arbreMigre` déclenche le message d'information. */
function migrerVersArbre(donnees: Record<string, unknown>): Record<string, unknown> {
  const ancienne = donnees.progression;
  if (typeof ancienne !== 'object' || ancienne === null || Array.isArray(ancienne)) return donnees;
  const { rangs, points, ...reste } = ancienne as Record<string, unknown>;
  // Pas de rangs : déjà au format de l'arbre (progression créée par la migration v6 -> v7)
  if (typeof rangs !== 'object' || rangs === null) return donnees;
  let rendus = 0;
  for (const r of Object.values(rangs as Record<string, unknown>)) {
    if (typeof r === 'number' && Number.isInteger(r) && r > 0) rendus += r;
  }
  const progression = {
    ...reste,
    points: typeof points === 'number' && Number.isInteger(points) ? points + rendus : points,
    noeuds: [],
    secondSouffleJour: -1,
  };
  return { ...donnees, progression, arbreMigre: true };
}

const estNombre = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

function lireConteneur(v: unknown): Conteneur | null {
  if (typeof v !== 'object' || v === null) return null;
  const cases = (v as { cases?: unknown }).cases;
  if (!Array.isArray(cases) || cases.length < 1 || cases.length > CASES_MAX) return null;
  const resultat: Array<Pile | null> = [];
  for (const c of cases as unknown[]) {
    if (c === null) {
      resultat.push(null);
      continue;
    }
    if (typeof c !== 'object') return null;
    const { objet, quantite } = c as { objet?: unknown; quantite?: unknown };
    if (typeof objet !== 'string' || objet === '') return null;
    if (!Number.isInteger(quantite) || (quantite as number) < 1 || (quantite as number) > QUANTITE_MAX) return null;
    resultat.push({ objet, quantite: quantite as number });
  }
  return { cases: resultat };
}

function lireRetires(v: unknown): Retire[] | null {
  if (!Array.isArray(v) || v.length > ELEMENTS_MAX) return null;
  const resultat: Retire[] = [];
  for (const r of v as unknown[]) {
    if (typeof r !== 'object' || r === null) return null;
    const { id, instant } = r as { id?: unknown; instant?: unknown };
    if (typeof id !== 'string' || !estNombre(instant) || instant < 0) return null;
    resultat.push({ id, instant });
  }
  return resultat;
}

function lirePlantes(v: unknown): Plante[] | null {
  if (!Array.isArray(v) || v.length > ELEMENTS_MAX) return null;
  const resultat: Plante[] = [];
  for (const p of v as unknown[]) {
    if (typeof p !== 'object' || p === null) return null;
    const { id, type, x, z, rotation, echelle, variante, instant } = p as Record<string, unknown>;
    if (typeof id !== 'string' || !TYPES_ARBRE.includes(type as TypeArbre)) return null;
    if (!estNombre(x) || !estNombre(z) || !estNombre(rotation) || !estNombre(instant) || instant < 0) return null;
    if (!estNombre(echelle) || echelle <= 0 || echelle > 10) return null;
    if (!Number.isInteger(variante) || (variante as number) < 0 || (variante as number) >= INFOS_DECOR[type as TypeArbre].variantes) {
      return null;
    }
    resultat.push({ id, type: type as TypeArbre, x, z, rotation, echelle, variante: variante as number, instant });
  }
  return resultat;
}

/** `facteur` : facteur de durabilité de l'arbre de compétences (Maître forgeron), pour borner la durabilité lue. */
function lireEquipement(v: unknown, facteur = 1): Equipement | null {
  if (typeof v !== 'object' || v === null) return null;
  const { outils, armure, casque, sacoche, durabilite, bouclier, arc } = v as {
    bouclier?: unknown;
    arc?: unknown;
    outils?: unknown;
    armure?: unknown;
    casque?: unknown;
    sacoche?: unknown;
    durabilite?: unknown;
  };
  if (typeof outils !== 'object' || outils === null) return null;
  if (armure !== null && !TYPES_ARMURE.includes(armure as TypeArmure)) return null;
  // Champ absent : aucun casque ; valeur inconnue : refusée
  if (casque !== undefined && casque !== null && !TYPES_CASQUE.includes(casque as TypeCasque)) return null;
  if (typeof sacoche !== 'boolean') return null;
  if (bouclier !== null && !TYPES_BOUCLIER.includes(bouclier as TypeBouclier)) return null;
  if (typeof arc !== 'boolean') return null;
  const niveaux = outils as Record<string, unknown>;
  const lus = {} as Record<(typeof OUTILS)[number], (typeof NIVEAUX_OUTIL)[number]>;
  for (const o of OUTILS) {
    const n = niveaux[o];
    if (!NIVEAUX_OUTIL.includes(n as (typeof NIVEAUX_OUTIL)[number])) return null;
    lus[o] = n as (typeof NIVEAUX_OUTIL)[number];
  }
  if (typeof durabilite !== 'object' || durabilite === null) return null;
  const sansDurabilite: Equipement = {
    outils: lus,
    armure: armure as TypeArmure | null,
    casque: (casque ?? null) as TypeCasque | null,
    sacoche,
    bouclier: bouclier as TypeBouclier | null,
    arc,
    durabilite: durabilitesNeuves(),
    ...(facteur !== 1 ? { facteurDurabilite: facteur } : {}),
  };
  const lues = {} as Record<(typeof EMPLACEMENTS_USURE)[number], number>;
  for (const emplacement of EMPLACEMENTS_USURE) {
    const d = (durabilite as Record<string, unknown>)[emplacement];
    if (!estNombre(d) || d < 0) return null;
    // Bornée au maximum du palier de l'outil
    lues[emplacement] = Math.min(d, durabiliteMax(sansDurabilite, emplacement));
  }
  return { ...sansDurabilite, durabilite: lues };
}

/** Le baluchon est `null` ou une position avec une liste d'objets (au moins un). */
function lireBaluchon(v: unknown): Baluchon | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'object') return undefined;
  const { x, z, contenu } = v as { x?: unknown; z?: unknown; contenu?: unknown };
  if (!estNombre(x) || !estNombre(z) || !Array.isArray(contenu) || contenu.length < 1 || contenu.length > CASES_MAX) {
    return undefined;
  }
  const piles: Pile[] = [];
  for (const c of contenu as unknown[]) {
    if (typeof c !== 'object' || c === null) return undefined;
    const { objet, quantite } = c as { objet?: unknown; quantite?: unknown };
    if (typeof objet !== 'string' || objet === '') return undefined;
    if (!Number.isInteger(quantite) || (quantite as number) < 1 || (quantite as number) > QUANTITE_MAX) return undefined;
    piles.push({ objet, quantite: quantite as number });
  }
  return { x, z, contenu: piles };
}

function lirePointReapparition(v: unknown): PointReapparition | null {
  if (typeof v !== 'object' || v === null) return null;
  const { x, z, nom } = v as { x?: unknown; z?: unknown; nom?: unknown };
  if (!estNombre(x) || !estNombre(z) || typeof nom !== 'string') return null;
  return { x, z, nom };
}

/** Le feu de camp est `null` (aucun) ou une position. */
function lireFeuCamp(v: unknown): FeuCamp | null | undefined {
  if (v === null) return null;
  if (typeof v !== 'object') return undefined;
  const { x, z } = v as { x?: unknown; z?: unknown };
  if (!estNombre(x) || !estNombre(z)) return undefined;
  return { x, z };
}

/** Pièges : position, instant, état ; une proie connue si et seulement si le piège est plein ; au plus `CONFIG.pieges.max`. */
function lirePieges(v: unknown): Piege[] | null {
  if (!Array.isArray(v) || v.length > CONFIG.pieges.max) return null;
  const resultat: Piege[] = [];
  for (const p of v as unknown[]) {
    if (typeof p !== 'object' || p === null) return null;
    const { id, x, z, instant, etat, prise } = p as Record<string, unknown>;
    if (typeof id !== 'string' || !/^t:\d+$/.test(id) || resultat.some((r) => r.id === id)) return null;
    if (!estNombre(x) || !estNombre(z) || !estNombre(instant) || instant < 0) return null;
    if (etat === 'attente') {
      resultat.push({ id, x, z, instant, etat });
    } else if (etat === 'plein' && PROIES.includes(prise as Proie)) {
      resultat.push({ id, x, z, instant, etat, prise: prise as Proie });
    } else {
      return null;
    }
  }
  return resultat;
}

/** Progression : niveau, XP, points, nœuds acquis (connus, sans doublon, prérequis acquis), mana (ramené entre 0 et le maximum). */
function lireProgression(v: unknown): Progression | null {
  if (typeof v !== 'object' || v === null) return null;
  const { niveau, xp, points, noeuds, mana, secondSouffleJour } = v as Record<string, unknown>;
  const P = CONFIG.progression;
  if (!Number.isInteger(niveau) || (niveau as number) < 1 || (niveau as number) > P.niveauMax) return null;
  if (!estNombre(xp) || xp < 0 || !Number.isInteger(points) || (points as number) < 0) return null;
  if (!estNombre(mana) || mana < 0) return null;
  if (!Array.isArray(noeuds) || noeuds.length > 1000) return null;
  const lus: string[] = [];
  for (const id of noeuds as unknown[]) {
    if (typeof id !== 'string') return null;
    if (chercherNoeud(id) && !lus.includes(id)) lus.push(id);
  }
  // Un nœud dont aucun prérequis n'est acquis (sauvegarde bricolée) est ignoré
  const valides: string[] = [];
  for (const id of lus) {
    const n = chercherNoeud(id);
    if (n && (n.parents.length === 0 || n.parents.some((p) => lus.includes(p)))) valides.push(id);
  }
  if (!Number.isInteger(secondSouffleJour) || (secondSouffleJour as number) < -1) return null;
  const lue: Progression = {
    niveau: niveau as number,
    xp,
    points: points as number,
    noeuds: valides,
    mana,
    secondSouffleJour: secondSouffleJour as number,
  };
  return { ...lue, mana: Math.min(mana, manaMax(lue)) };
}

/** Quêtes : acceptées (identifiant connu, compteur entier) et terminées. Les identifiants inconnus (autre version) sont ignorés. */
function lireQuetes(v: unknown): EtatQuetes | null {
  if (typeof v !== 'object' || v === null) return null;
  const { enCours, terminees } = v as { enCours?: unknown; terminees?: unknown };
  if (!Array.isArray(enCours) || !Array.isArray(terminees) || enCours.length > 1000 || terminees.length > 1000) return null;
  const lues: Array<{ id: string; compteur: number }> = [];
  for (const c of enCours as unknown[]) {
    if (typeof c !== 'object' || c === null) return null;
    const { id, compteur } = c as { id?: unknown; compteur?: unknown };
    if (typeof id !== 'string' || !Number.isInteger(compteur) || (compteur as number) < 0) return null;
    if (chercherQuete(id)) lues.push({ id, compteur: compteur as number });
  }
  const finies: string[] = [];
  for (const id of terminees as unknown[]) {
    if (typeof id !== 'string') return null;
    if (chercherQuete(id) && !finies.includes(id)) finies.push(id);
  }
  // Une quête terminée n'est plus en cours
  return { enCours: lues.filter((c) => !finies.includes(c.id)), terminees: finies };
}

/**
 * Lit une sauvegarde : texte JSON -> migration -> validation.
 * Renvoie `null` (nouvelle partie) si le texte est absent, abîmé, d'une version inconnue ou d'une autre graine.
 */
export function lirePartie(texte: string | null, graineAttendue: number): DonneesPartie | null {
  if (!texte) return null;
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    return null;
  }
  const d = migrer(brut);
  if (!d) return null;

  if (d.graine !== graineAttendue) return null;
  const p = d.personnage as { x?: unknown; y?: unknown; z?: unknown; orientation?: unknown } | null;
  if (typeof p !== 'object' || p === null) return null;
  if (!estNombre(p.x) || !estNombre(p.y) || !estNombre(p.z) || !estNombre(p.orientation)) return null;
  if (typeof d.vue !== 'string' || !VUES.includes(d.vue)) return null;
  if (!estNombre(d.tempsJeu) || d.tempsJeu < 0) return null;
  const inventaire = lireConteneur(d.inventaire);
  const sac = lireConteneur(d.sac);
  if (!inventaire || !sac) return null;
  const retires = lireRetires(d.retires);
  const plantes = lirePlantes(d.plantes);
  if (!retires || !plantes) return null;
  if (!Number.isInteger(d.compteurPlantes) || (d.compteurPlantes as number) < 0) return null;
  const coffre = lireConteneur(d.coffre);
  if (!coffre) return null;
  const niveau = d.niveauVillage;
  if (!Number.isInteger(niveau) || (niveau as number) < 1 || (niveau as number) > NIVEAU_VILLAGE_MAX) return null;
  const progression = lireProgression(d.progression);
  if (!progression) return null;
  const equipement = lireEquipement(d.equipement, facteurDurabilite(progression));
  if (!equipement) return null;
  if (!estNombre(d.vie) || d.vie < 0) return null;
  const baluchon = lireBaluchon(d.baluchon);
  if (baluchon === undefined) return null;
  const pointReapparition = lirePointReapparition(d.pointReapparition);
  if (!pointReapparition) return null;
  const quetes = lireQuetes(d.quetes);
  if (!quetes) return null;
  const histoire = lireEtatHistoire(d.histoire);
  if (!histoire) return null;
  const marchand = lireEtatMarchand(d.marchand);
  if (!marchand) return null;
  const attaques = lireEtatAttaques(d.attaques);
  if (!attaques) return null;
  const lieux = lireEtatLieux(d.lieux);
  if (!lieux) return null;
  const tresorsOuverts = lireCoffresOuverts(d.tresorsOuverts);
  if (!tresorsOuverts) return null;
  const tresorsEntames = lireCoffresEntames(d.tresorsEntames);
  if (!tresorsEntames) return null;
  const feuCamp = lireFeuCamp(d.feuCamp);
  if (feuCamp === undefined) return null;
  const pieges = lirePieges(d.pieges);
  if (!pieges) return null;
  // Des repères abîmés ne font jamais refuser la partie : on garde ce qui se relit, le reste est ignoré
  const reperes = lireReperes(d.reperes);
  const mine = d.mine as { dedans?: unknown; visitee?: unknown } | null;
  if (typeof mine !== 'object' || mine === null) return null;
  if (typeof mine.dedans !== 'boolean' || typeof mine.visitee !== 'boolean') return null;

  return {
    graine: graineAttendue,
    personnage: { x: p.x, y: p.y, z: p.z, orientation: p.orientation },
    vue: d.vue === 'troisieme' ? 'troisieme' : 'premiere',
    tempsJeu: d.tempsJeu,
    inventaire,
    sac,
    retires,
    plantes,
    compteurPlantes: d.compteurPlantes as number,
    coffre,
    niveauVillage: niveau as NiveauVillage,
    equipement,
    vie: Math.min(d.vie, pvMax(progression)),
    baluchon,
    pointReapparition,
    progression,
    quetes,
    histoire,
    marchand,
    attaques,
    lieux,
    tresorsOuverts,
    potager: lireEtatPotager(d.potager),
    ...(Object.keys(tresorsEntames).length > 0 ? { tresorsEntames } : {}),
    feuCamp,
    pieges,
    reperes,
    mine: { dedans: mine.dedans, visitee: mine.visitee },
    ...(d.arbreMigre === true ? { arbreMigre: true } : {}),
    ...(d.finVue === true ? { finVue: true } : {}),
  };
}
