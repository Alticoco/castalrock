// Attaques de bandits sur le village : quels soirs, combien de bandits et d'où ils viennent, leur marche vers la place,
// comment l'attaque se termine (victoire ou pillage du coffre) et ce qu'elle rapporte ou coûte.
// Pur : aucun import de three, aucun Math.random() (tirages par le générateur à graine). Réglages : CONFIG.attaques.
// Seul le dernier jour traité est sauvegardé : une attaque en cours n'est jamais reprise.

import { CONFIG } from '../config';
import { creerAleatoire } from './aleatoire';
import { INFOS_ENNEMIS, RAYON_VILLAGE_ENNEMIS, avancer, essayerDetour, pasEnnemi, tourner, type ContexteEnnemi, type EtatEnnemi, type ResultatPasEnnemi } from './combat';
import { etapeCourante, histoireFinie, type EtatHistoire, type IdActe } from './histoire';
import { compter, definitionObjet, retirer, type Conteneur, type Pile } from './inventaire';

/** Préfixe de l'identifiant d'un bandit d'attaque (`attaque:<jour>:<n>`) : c'est ce qui le distingue des bandits des chunks. */
export const PREFIXE_BANDIT_ATTAQUE = 'attaque:';

export const MESSAGE_CLOCHE = 'La cloche sonne : des bandits attaquent le village !';
export const MESSAGE_VICTOIRE = 'Le village est sauvé !';

/** Vrai si l'identifiant est celui d'un bandit d'attaque. */
export function estBanditAttaque(id: string): boolean {
  return id.startsWith(PREFIXE_BANDIT_ATTAQUE);
}

// --- État sauvegardé -----------------------------------------------------------------------------

export interface EtatAttaques {
  /** Dernier jour (numéro de jour calendaire) dont l'attaque a été traitée, lancée ou sautée ; -1 : aucun */
  readonly dernierJour: number;
}

export function creerEtatAttaques(): EtatAttaques {
  return { dernierJour: -1 };
}

/** Lit un état brut (sauvegarde) ; `null` s'il est abîmé. */
export function lireEtatAttaques(v: unknown): EtatAttaques | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { dernierJour } = v as { dernierJour?: unknown };
  if (!Number.isInteger(dernierJour) || (dernierJour as number) < -1 || (dernierJour as number) > 1_000_000) return null;
  return { dernierJour: dernierJour as number };
}

// --- Quand ? -------------------------------------------------------------------------------------

const ACTES: readonly IdActe[] = ['prologue', 'I', 'II', 'III', 'IV', 'epilogue'];

/** Vrai si l'histoire a atteint l'acte II (ou plus loin, épilogue et histoire finie compris). */
export function histoireAtteintActeII(etat: EtatHistoire): boolean {
  if (histoireFinie(etat)) return true;
  const etape = etapeCourante(etat);
  return etape !== undefined && ACTES.indexOf(etape.acte) >= ACTES.indexOf('II');
}

/** Mélange de la graine et du jour : une graine propre à chaque tirage. */
function graineDuJour(jour: number, graine: number, sel: number): number {
  return ((graine | 0) ^ Math.imul(jour | 0, 0x9e3779b1) ^ Math.imul(CONFIG.attaques.graine | 0, 0x85ebca6b) ^ sel) >>> 0;
}

/**
 * Une attaque est repoussée tant que le joueur est près du camp des bandits (à moins de `distanceCampMorvan` m) et que
 * Morvan est en vie : il ne faut pas combattre sur deux fronts.
 */
export function attaqueRepoussee(distanceAuCamp: number, morvanVaincu: boolean): boolean {
  return !morvanVaincu && distanceAuCamp < CONFIG.attaques.distanceCampMorvan;
}

/**
 * Le tirage du soir désigne-t-il une attaque, et les règles de répit la permettent-elles ?
 * `dernierJour` : dernier jour traité (au moins `ecartMiniJours` jours avant : jamais deux soirs de suite) ;
 * `jourActeII` : jour où l'acte II a été atteint (pas d'attaque ce jour-là), ou `null` si on ne le sait pas.
 * Ne dit rien de l'acte atteint, ni de la présence du joueur (voir `histoireAtteintActeII`).
 */
export function attaquePrevue(jour: number, graine: number, dernierJour: number = -1, jourActeII: number | null = null): boolean {
  const A = CONFIG.attaques;
  if (jour - dernierJour < A.ecartMiniJours) return false;
  if (jourActeII !== null && jour <= jourActeII) return false;
  return creerAleatoire(graineDuJour(jour, graine, 0x1a2b3c4d)).suivant() < A.probabilite;
}

export interface TirageAttaque {
  /** Nombre de bandits */
  nombre: number;
  /** Direction d'où ils viennent, en radians (x = sin, z = cos, comme les orientations du jeu) */
  angle: number;
}

/** Nombre de bandits et direction d'arrivée de l'attaque du jour : toujours les mêmes pour un même jour et une même graine. */
export function tirerAttaque(jour: number, graine: number): TirageAttaque {
  const A = CONFIG.attaques;
  const alea = creerAleatoire(graineDuJour(jour, graine, 0x7e57ab1e));
  const nombre = alea.entier(A.nombreMin, A.nombreMax);
  const angle = alea.entre(0, Math.PI * 2);
  return { nombre, angle };
}

/** Points d'apparition des bandits : en ligne, sur le cercle de `distanceApparition` m du centre, centrés sur la direction `angle`. */
export function positionsBandits(angle: number, nombre: number): Array<{ x: number; z: number }> {
  const A = CONFIG.attaques;
  const cx = Math.sin(angle) * A.distanceApparition;
  const cz = Math.cos(angle) * A.distanceApparition;
  // Tangente au cercle : les bandits arrivent côte à côte
  const tx = Math.cos(angle);
  const tz = -Math.sin(angle);
  return Array.from({ length: nombre }, (_, i) => {
    const decalage = (i - (nombre - 1) / 2) * A.ecartBandits;
    return { x: cx + tx * decalage, z: cz + tz * decalage };
  });
}

// --- Marche et arrivée ---------------------------------------------------------------------------

/** Distance au centre du village à partir de laquelle un bandit est « arrivé » sur la place (il ne peut pas entrer dans le village). */
export function distanceArrivee(): number {
  return RAYON_VILLAGE_ENNEMIS + CONFIG.attaques.distanceArrivee;
}

export function aArrive(x: number, z: number): boolean {
  return Math.hypot(x, z) <= distanceArrivee();
}

/**
 * Un pas d'un bandit d'attaque. Tant qu'il ne voit pas le joueur (et n'est pas en plein combat), il marche tout droit vers la
 * place, plus vite qu'un bandit qui erre ; il longe les obstacles comme les autres ennemis. Dès qu'il voit le joueur,
 * c'est le combat normal (`pasEnnemi`) ; s'il perd le joueur, il reprend sa marche.
 * Son point d'origine suit sa marche : il n'abandonne donc pas la poursuite parce qu'il est loin de son point de départ.
 */
export function pasBanditAttaque(etat: EtatEnnemi, ctx: ContexteEnnemi, dt: number): ResultatPasEnnemi {
  if (!(dt > 0) || etat.phase === 'mort') return pasEnnemi(etat, ctx, dt);
  const I = INFOS_ENNEMIS[etat.type];
  const enMarche = etat.phase === 'repos' || etat.phase === 'errance' || etat.phase === 'retour';
  const joueurVisible = ctx.joueur.vivant && Math.hypot(ctx.joueur.x, ctx.joueur.z) >= ctx.rayonVillage;
  const detecte = joueurVisible && etat.calme - dt <= 0 && Math.hypot(ctx.joueur.x - etat.x, ctx.joueur.z - etat.z) <= I.distanceDetection;
  if (!enMarche || detecte) return pasEnnemi(etat, ctx, dt);

  const e = {
    ...etat,
    phase: 'errance' as const,
    tempsPhase: etat.tempsPhase + dt,
    recharge: Math.max(0, etat.recharge - dt),
    calme: Math.max(0, etat.calme - dt),
  };
  const d = Math.hypot(e.x, e.z);
  if (aArrive(e.x, e.z) || d < 1e-3) {
    // Au bord du village : il y reste, face à la place
    return { etat: { ...e, orientation: tourner(e.orientation, Math.atan2(-e.x, -e.z), 1 - Math.exp(-6 * dt)), origineX: e.x, origineZ: e.z }, degats: 0 };
  }
  const ux = -e.x / d;
  const uz = -e.z / d;
  const pas = Math.min(d, CONFIG.attaques.vitesseMarche * dt);
  let fin = avancer(e.x, e.z, ux * pas, uz * pas, I.rayon, ctx);
  let detour = e.detour;
  if (d - Math.hypot(fin.x, fin.z) < pas * 0.35) detour = CONFIG.combat.dureeDetour;
  let cap = Math.atan2(ux, uz);
  if (detour > 0) {
    detour = Math.max(0, detour - dt);
    // Toujours le même côté pour un bandit donné
    const d2 = essayerDetour(e, ux, uz, pas, I.rayon, fin, cap, ctx);
    fin = d2.fin;
    cap = d2.cap;
  }
  return {
    etat: {
      ...e,
      x: fin.x,
      z: fin.z,
      y: ctx.monde.hauteur(fin.x, fin.z),
      detour,
      orientation: tourner(e.orientation, cap, 1 - Math.exp(-10 * dt)),
      origineX: fin.x,
      origineZ: fin.z,
    },
    degats: 0,
  };
}

// --- Fin de l'attaque ----------------------------------------------------------------------------

export type IssueAttaque = 'enCours' | 'victoire' | 'pillage';

export interface SituationAttaque {
  /** Bandits encore en vie */
  vivants: number;
  /** Bandits arrivés au bord du village, et depuis combien de secondes il y en a au moins un */
  arrives: number;
  tempsArrives: number;
  /** Jour de l'attaque et jour actuel : à minuit (le jour change), les survivants pillent */
  jourAttaque: number;
  jour: number;
}

/** Victoire si plus aucun bandit ; pillage si minuit est passé ou si des bandits restent sur la place assez longtemps. */
export function issueAttaque(s: SituationAttaque): IssueAttaque {
  if (s.vivants <= 0) return 'victoire';
  if (s.jour > s.jourAttaque) return 'pillage';
  if (s.arrives > 0 && s.tempsArrives >= CONFIG.attaques.dureePillage) return 'pillage';
  return 'enCours';
}

/** Or et XP gagnés pour avoir défendu le village (l'XP de chaque bandit tué est donnée à part, normalement). */
export function recompenseDefense(nombre: number): { or: number; xp: number } {
  const n = Math.max(0, Math.floor(nombre));
  return { or: n * CONFIG.attaques.orParBandit, xp: n * CONFIG.attaques.xpParBandit };
}

export interface ResultatPillage {
  coffre: Conteneur;
  /** Ce qui a été pris (vide si le coffre ne contenait rien de volable) */
  pris: Pile[];
}

/**
 * Les bandits pillent le coffre du village : 2 ou 3 ressources de base (celles qui y sont), chacune pour 10 à 20 % du stock
 * (au moins 1 pièce). Jamais d'équipement, d'objet fabriqué ni d'or.
 */
export function pillage(coffre: Conteneur, graine: number, jour: number): ResultatPillage {
  const P = CONFIG.attaques.pillage;
  const alea = creerAleatoire(graineDuJour(jour, graine, 0x0b1e55ed));
  const candidats = P.ressources.filter((r) => compter(coffre, r) > 0);
  // Mélange de Fisher-Yates avec le générateur à graine
  for (let i = candidats.length - 1; i > 0; i--) {
    const j = alea.entier(0, i);
    [candidats[i], candidats[j]] = [candidats[j], candidats[i]];
  }
  const nombre = Math.min(candidats.length, alea.entier(P.nombreRessourcesMin, P.nombreRessourcesMax));
  let suite = coffre;
  const pris: Pile[] = [];
  for (const objet of candidats.slice(0, nombre)) {
    const stock = compter(suite, objet);
    const quantite = Math.min(stock, Math.max(1, Math.floor(stock * alea.entre(P.partMin, P.partMax))));
    const r = retirer(suite, objet, quantite);
    suite = r.conteneur;
    if (r.retire > 0) pris.push({ objet, quantite: r.retire });
  }
  return { coffre: suite, pris };
}

/** « Les bandits ont pillé le coffre : 3 bois, 2 pierre » (ou le constat qu'il n'y avait rien à prendre). */
export function messagePillage(pris: readonly Pile[]): string {
  if (pris.length === 0) return 'Les bandits ont fouillé le coffre, mais ils sont repartis les mains vides';
  return `Les bandits ont pillé le coffre : ${pris.map((p) => `${p.quantite} ${definitionObjet(p.objet).nom}`).join(', ')}`;
}

/** « Défends le village : 3 bandits » */
export function objectifDefense(restants: number): string {
  return `Défends le village : ${restants} bandit${restants > 1 ? 's' : ''}`;
}
