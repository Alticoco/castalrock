// Progression du joueur : XP, niveaux, points de compétence, arbre de compétences (competences.ts), bonus et mana.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable : chaque fonction renvoie un nouvel état.
// Valeurs dans CONFIG.progression.

import { CONFIG } from '../config';
import { estArbre, type TypeDecor } from '../monde/decor';
import type { Aleatoire } from './aleatoire';
import { aLeNoeud, chercherNoeud, effetsArbre, etatNoeud, type EffetsArbre } from './competences';
import { INFOS_RECOLTE, estRecoltable, type Ressources } from './recolte';

export { aLeNoeud };

const P = CONFIG.progression;

export interface Progression {
  readonly niveau: number;
  /** XP gagnée dans le niveau en cours (repart de 0 à chaque niveau) */
  readonly xp: number;
  /** Points de compétence à dépenser */
  readonly points: number;
  /** Nœuds de l'arbre de compétences déjà acquis (voir competences.ts) */
  readonly noeuds: readonly string[];
  /** Mana actuel */
  readonly mana: number;
  /** Dernier jour de jeu où le Second souffle a servi (-1 : jamais) */
  readonly secondSouffleJour: number;
}

/** Joueur de niveau 1, sans point ni nœud, avec toute sa réserve de mana. */
export function creerProgression(): Progression {
  return { niveau: 1, xp: 0, points: 0, noeuds: [], mana: P.mana.max, secondSouffleJour: -1 };
}

// --- XP et niveaux ----------------------------------------------------------------------------

/** XP à gagner pour passer du niveau `niveau` au suivant : arrondi(coefficient × niveau ^ exposant). */
export function xpPourNiveauSuivant(niveau: number): number {
  return Math.round(P.coefficientXp * Math.pow(Math.max(1, niveau), P.exposantXp));
}

/** XP gagnée en détruisant un élément du décor (arbre, rocher, filon, petits éléments). */
export function xpDestruction(type: TypeDecor): number {
  if (estArbre(type)) return P.xp.arbre;
  if (type === 'rocher') return P.xp.rocher;
  if (type === 'filon-fer' || type === 'filon-cuivre' || type === 'filon-charbon') return P.xp.filon;
  if (type === 'cristal-bleu') return P.xp.cristal;
  return P.xp.petitElement;
}

/** XP gagnée en tuant un ennemi. */
export function xpEnnemi(type: keyof typeof P.xp.ennemis): number {
  return P.xp.ennemis[type];
}

export interface ResultatXp {
  progression: Progression;
  /** Niveaux franchis par ce gain (plusieurs d'un coup possibles) */
  niveauxGagnes: number;
}

/** Ajoute de l'XP : chaque niveau franchi donne un point de compétence, le surplus passe au niveau suivant. */
export function gagnerXp(p: Progression, quantite: number): ResultatXp {
  if (!(quantite > 0) || p.niveau >= P.niveauMax) return { progression: p, niveauxGagnes: 0 };
  let niveau = p.niveau;
  let xp = p.xp + quantite;
  let points = p.points;
  let gagnes = 0;
  while (niveau < P.niveauMax && xp >= xpPourNiveauSuivant(niveau)) {
    xp -= xpPourNiveauSuivant(niveau);
    niveau += 1;
    points += 1;
    gagnes += 1;
  }
  if (niveau >= P.niveauMax) xp = 0;
  return { progression: { ...p, niveau, xp, points }, niveauxGagnes: gagnes };
}

// --- Arbre de compétences ---------------------------------------------------------------------

export type RaisonRefusNoeud = 'inconnu' | 'deja-acquis' | 'verrouille' | 'aucun-point';

export const MESSAGES_NOEUD: Readonly<Record<RaisonRefusNoeud, string>> = {
  inconnu: 'Compétence inconnue',
  'deja-acquis': 'Déjà acquise',
  verrouille: "Il faut d'abord acquérir la compétence qui précède",
  'aucun-point': 'Pas de point de compétence',
};

export interface ResultatAchat {
  ok: boolean;
  raison?: RaisonRefusNoeud;
  progression: Progression;
}

function effets(p: Progression): EffetsArbre {
  return effetsArbre(p.noeuds);
}

/**
 * Dépense les points d'un nœud disponible. Un gain de mana max ne remplit pas la réserve : sinon, réinitialiser l'arbre
 * puis racheter le nœud redonnerait du mana à volonté.
 */
export function acheterNoeud(p: Progression, id: string): ResultatAchat {
  const n = chercherNoeud(id);
  if (!n) return { ok: false, raison: 'inconnu', progression: p };
  const etat = etatNoeud(p.noeuds, n.id);
  if (etat === 'acquis') return { ok: false, raison: 'deja-acquis', progression: p };
  if (etat === 'verrouille') return { ok: false, raison: 'verrouille', progression: p };
  if (p.points < n.cout) return { ok: false, raison: 'aucun-point', progression: p };
  const apres: Progression = { ...p, points: p.points - n.cout, noeuds: [...p.noeuds, n.id] };
  return { ok: true, progression: apres };
}

/**
 * Oublie tous les nœuds de l'arbre et rend tous les points dépensés (somme des coûts des nœuds acquis). Gratuit.
 * Sans nœud acquis, rien ne change. Le mana est ramené au nouveau maximum s'il le dépasse (Réserve perdue).
 */
export function reinitialiserArbre(p: Progression): Progression {
  if (p.noeuds.length === 0) return p;
  const rendus = p.noeuds.reduce((somme, id) => somme + (chercherNoeud(id)?.cout ?? 0), 0);
  const apres: Progression = { ...p, points: p.points + rendus, noeuds: [] };
  return { ...apres, mana: Math.min(apres.mana, manaMax(apres)) };
}

/** Donne des points de compétence en plus de ceux des niveaux (récompense de quête). */
export function donnerPoints(p: Progression, quantite = 1): Progression {
  if (!(quantite > 0)) return p;
  return { ...p, points: p.points + Math.floor(quantite) };
}

// --- Bonus calculés ---------------------------------------------------------------------------

/** Facteur sur les dégâts de l'épée (Lame affûtée). */
export function facteurDegatsEpee(p: Progression): number {
  return 1 + effets(p).degatsEpee;
}

/** Facteur sur la vitesse de frappe (Enchaînement). */
export function facteurVitesseFrappe(p: Progression): number {
  return 1 + effets(p).vitesseFrappe;
}

/** Facteur sur les dégâts des outils contre un élément du décor (Bûcheron : arbres ; Mineur : rochers et filons). */
export function facteurDegatsRecolte(p: Progression, type: TypeDecor): number {
  const e = effets(p);
  if (estArbre(type)) return 1 + e.degatsArbres;
  if (type === 'rocher' || type === 'filon-fer' || type === 'filon-cuivre' || type === 'filon-charbon' || type === 'cristal-bleu') {
    return 1 + e.degatsRochers;
  }
  return 1;
}

/**
 * Butin final d'un élément détruit : Cueilleur ajoute des baies ou des plantes ; Abondance donne, avec une
 * certaine chance (tirage du générateur à graine), une unité de plus de la ressource principale.
 */
export function butinAvecBonus(p: Progression, type: TypeDecor, butin: Ressources, alea: Aleatoire): Ressources {
  if (!estRecoltable(type)) return butin;
  const e = effets(p);
  const resultat: Ressources = { ...butin };
  if (type === 'buisson-baies') resultat.baies = (resultat.baies ?? 0) + e.cueillette;
  if (type === 'plante-medicinale') resultat['plante-medicinale'] = (resultat['plante-medicinale'] ?? 0) + e.cueillette;
  const info = INFOS_RECOLTE[type];
  if (e.abondance > 0 && info.outil !== null && alea.suivant() < e.abondance) {
    const principale = info.butin[0].ressource;
    resultat[principale] = (resultat[principale] ?? 0) + 1;
  }
  return resultat;
}

/** Facteur sur le coût des réparations (Forgeron) ; l'arrondi au supérieur, minimum 1, est fait par `coutReparation`. */
export function facteurCoutReparation(p: Progression): number {
  return effets(p).coutReparation;
}

/** Chance de ne pas consommer un ingrédient de base (Économe). */
export function chanceEconome(p: Progression): number {
  return effets(p).econome;
}

/** Facteur sur la durabilité maximale des outils et de l'armure (Maître forgeron). */
export function facteurDurabilite(p: Progression): number {
  return effets(p).durabilite;
}

/** Points de vie maximum (Robustesse). */
export function pvMax(p: Progression): number {
  return CONFIG.combat.vieMax + effets(p).pvMax;
}

/** Réduction de dégâts ajoutée à celle de l'armure (Peau dure). */
export function bonusReductionArmure(p: Progression): number {
  return effets(p).reductionArmure;
}

/** Cases ajoutées à l'inventaire porté (Porteur). */
export function casesTransport(p: Progression): number {
  return effets(p).casesInventaire;
}

/** Facteur sur le rayon de l'explosion de la boule de feu (Boule de feu II). */
export function facteurRayonExplosion(p: Progression): number {
  return effets(p).rayonExplosion;
}

/** Mana maximum (Réserve). */
export function manaMax(p: Progression): number {
  return P.mana.max + effets(p).manaMax;
}

/** Cases du sac magique pour un niveau : une case de plus aux niveaux 3, 5, 7... (sans le bonus de Grand sac). */
export function casesSacMagique(niveau: number): number {
  const base = CONFIG.inventaire.casesSac;
  if (niveau < P.niveauPremiereCaseSac) return base;
  return base + 1 + Math.floor((niveau - P.niveauPremiereCaseSac) / P.niveauxParCaseSac);
}

/** Cases du sac magique : celles du niveau, plus Grand sac. */
export function casesSacTotal(p: Progression): number {
  return casesSacMagique(p.niveau) + effets(p).casesSac;
}

// --- Second souffle ---------------------------------------------------------------------------

/** Numéro du jour de jeu (le jour 0 commence avec la partie). */
export function jourDeJeu(tempsJeu: number): number {
  return Math.floor(Math.max(0, tempsJeu) / CONFIG.temps.dureeJourSecondes);
}

/** Vrai si le nœud est acquis et pas encore utilisé ce jour de jeu. */
export function secondSouffleDisponible(p: Progression, tempsJeu: number): boolean {
  return aLeNoeud(p, 'second-souffle') && p.secondSouffleJour < jourDeJeu(tempsJeu);
}

/** Marque le Second souffle comme utilisé aujourd'hui. */
export function utiliserSecondSouffle(p: Progression, tempsJeu: number): Progression {
  return { ...p, secondSouffleJour: jourDeJeu(tempsJeu) };
}

// --- Mana -------------------------------------------------------------------------------------

/** Le temps passe : le mana se régénère, jusqu'au maximum. */
export function pasMana(p: Progression, dt: number): Progression {
  const max = manaMax(p);
  if (!(dt > 0) || p.mana >= max) return p;
  return { ...p, mana: Math.min(max, p.mana + P.mana.regeneration * dt) };
}
