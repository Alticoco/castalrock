// Animaux sauvages : cerf, lapin et renard fuient le joueur ; le sanglier l'ignore tant qu'on ne le frappe pas,
// puis le charge. Ils partagent l'état des ennemis (combat.ts) : mêmes coups reçus, même recul, même mort,
// même errance au repos. Seuls la fuite et la charge sont ici.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable. Valeurs dans CONFIG.animaux.

import { CONFIG } from '../config';
import {
  TYPES_ANIMAL,
  avancer,
  pasEnnemi,
  tirer,
  tourner,
  type Brouillon,
  type ContexteEnnemi,
  type EtatEnnemi,
  type InfosEnnemi,
  type PhaseEnnemi,
  type ResultatPasEnnemi,
  type TypeAnimal,
} from './combat';

export type ComportementAnimal = 'fuyard' | 'neutre';

export interface InfosAnimal extends InfosEnnemi {
  comportement: ComportementAnimal;
  /** Fuyard : il fuit quand le joueur est plus près que cela (mètres) */
  distanceFuite: number;
  /** Même distance quand le joueur est discret (lent ou à l'arrêt) */
  distanceFuiteDiscret: number;
  /** La fuite s'arrête quand le joueur est plus loin que cela */
  distanceCalme: number;
  /** Écart d'angle maximal du zigzag de la fuite, en radians (0 : il file droit) */
  zigzag: number;
  /** Neutre : vitesse de la charge, en m/s */
  vitesseCharge: number;
  /** Expérience gagnée par le joueur */
  xp: number;
}

/** Caractéristiques de chaque animal (valeurs dans CONFIG.animaux). */
export const INFOS_ANIMAUX: Readonly<Record<TypeAnimal, InfosAnimal>> = CONFIG.animaux;

export function estAnimal(type: string): type is TypeAnimal {
  return (TYPES_ANIMAL as readonly string[]).includes(type);
}

/** Phases pendant lesquelles un animal neutre en veut au joueur. */
const PHASES_EN_COLERE: readonly PhaseEnnemi[] = ['poursuite', 'anticipation', 'attaque', 'recul', 'etourdi'];

/**
 * Vrai si cet animal menace le joueur : un sanglier qu'on a frappé et qui n'a pas encore abandonné.
 * Les autres animaux ne sont jamais une menace (le pilote automatique les ignore).
 */
export function estMenacant(e: Pick<EtatEnnemi, 'type' | 'phase'>): boolean {
  return estAnimal(e.type) && INFOS_ANIMAUX[e.type].comportement === 'neutre' && PHASES_EN_COLERE.includes(e.phase);
}

/** Distance à laquelle un animal craintif prend la fuite, selon la vitesse du joueur (absente : il court). */
export function distanceDeFuite(type: TypeAnimal, vitesseJoueur?: number): number {
  const I = INFOS_ANIMAUX[type];
  const discret = vitesseJoueur !== undefined && vitesseJoueur < CONFIG.comportementAnimaux.vitesseDiscrete;
  return discret ? I.distanceFuiteDiscret : I.distanceFuite;
}

function changer(e: Brouillon, phase: PhaseEnnemi): void {
  e.phase = phase;
  e.tempsPhase = 0;
  e.bloque = 0;
  e.detour = 0;
  e.meilleur = Infinity;
}

/** Copie de travail : le temps de la phase avance, les délais diminuent. */
function brouillon(etat: EtatEnnemi, dt: number): Brouillon {
  return {
    ...etat,
    tempsPhase: etat.tempsPhase + dt,
    recharge: Math.max(0, etat.recharge - dt),
    calme: Math.max(0, etat.calme - dt),
  };
}

/** Fait vivre un animal pendant dt secondes. Ne modifie pas `etat`. `degats` : ceux d'une charge de sanglier qui touche. */
export function pasAnimal(etat: EtatEnnemi, ctx: ContexteEnnemi, dt: number): ResultatPasEnnemi {
  if (!(dt > 0) || !estAnimal(etat.type) || etat.phase === 'mort') return pasEnnemi(etat, ctx, dt);
  const I = INFOS_ANIMAUX[etat.type];
  return I.comportement === 'fuyard' ? pasFuyard(etat, etat.type, I, ctx, dt) : pasNeutre(etat, I, ctx, dt);
}

// --- Fuyards : cerf, lapin, renard ------------------------------------------------------------

function pasFuyard(etat: EtatEnnemi, type: TypeAnimal, I: InfosAnimal, ctx: ContexteEnnemi, dt: number): ResultatPasEnnemi {
  if (etat.phase === 'fuite') return pasFuite(etat, I, ctx, dt);
  // Sursaut d'un coup reçu, étourdissement : comme les ennemis ; au repos et en errance aussi, tant que le joueur est loin
  if (etat.phase === 'recul' || etat.phase === 'etourdi') return pasEnnemi(etat, ctx, dt);
  const distJ = Math.hypot(ctx.joueur.x - etat.x, ctx.joueur.z - etat.z);
  const paisible = etat.phase === 'repos' || etat.phase === 'errance';
  const alerte = ctx.joueur.vivant && distJ <= distanceDeFuite(type, ctx.joueur.vitesse);
  if (paisible && !alerte) return pasEnnemi(etat, ctx, dt);
  // Joueur trop près, ou coup reçu (le sursaut fini, un ennemi poursuivrait : lui s'enfuit)
  return pasFuite({ ...etat, phase: 'fuite', tempsPhase: 0, vx: 0, vz: 0, ecart: 0 }, I, ctx, dt);
}

function pasFuite(etat: EtatEnnemi, I: InfosAnimal, ctx: ContexteEnnemi, dt: number): ResultatPasEnnemi {
  const C = CONFIG.combat;
  const e = brouillon(etat, dt);
  const dx = e.x - ctx.joueur.x;
  const dz = e.z - ctx.joueur.z;
  const distJ = Math.hypot(dx, dz);
  if (!ctx.joueur.vivant || distJ >= I.distanceCalme) {
    // Assez loin : il s'installe là où il est et reprend sa vie
    e.origineX = e.x;
    e.origineZ = e.z;
    e.cibleX = e.x;
    e.cibleZ = e.z;
    e.ecart = 0;
    e.attente = tirer(e).entre(C.attenteMin, C.attenteMax);
    changer(e, 'repos');
    return { etat: e, degats: 0 };
  }

  let vitesse = I.vitesse;
  if (I.sauts) {
    // Par bonds : il n'avance qu'en l'air, et change de côté à chaque bond
    const total = I.dureeSaut + I.pauseSaut;
    let c = e.cycle + dt;
    if (c >= total) {
      c = c - total >= total ? 0 : c - total;
      e.ecart = (e.ecart > 0 ? -1 : 1) * tirer(e).entre(0.45, 1) * I.zigzag;
    }
    e.cycle = c;
    if (c >= I.dureeSaut) vitesse = 0;
  } else if (I.zigzag > 0) {
    e.ecart = Math.sin(e.tempsPhase * 3 + (e.graine % 7)) * I.zigzag;
  }

  if (vitesse > 0) {
    const oppose = distJ > 1e-3 ? Math.atan2(dx, dz) : e.orientation;
    const pas = vitesse * dt;
    const essayer = (cap: number) => {
      const fin = avancer(e.x, e.z, Math.sin(cap) * pas, Math.cos(cap) * pas, I.rayon, ctx);
      return { fin, cap, gain: Math.hypot(fin.x - e.x, fin.z - e.z) };
    };
    let choix = essayer(oppose + e.ecart);
    if (choix.gain < pas * 0.5) {
      // Arbre, rive, falaise, bord du village : il longe l'obstacle (toujours du même côté d'abord)
      const sens = e.graine % 2 === 0 ? 1 : -1;
      for (const ecart of [0.9, -0.9, 1.6, -1.6]) {
        const autre = essayer(oppose + sens * ecart);
        if (autre.gain > choix.gain) choix = autre;
      }
    }
    e.x = choix.fin.x;
    e.z = choix.fin.z;
    e.orientation = tourner(e.orientation, choix.cap, 1 - Math.exp(-12 * dt));
  }
  e.y = ctx.monde.hauteur(e.x, e.z);
  return { etat: e, degats: 0 };
}

// --- Neutre : sanglier ------------------------------------------------------------------------

function pasNeutre(etat: EtatEnnemi, I: InfosAnimal, ctx: ContexteEnnemi, dt: number): ResultatPasEnnemi {
  const dxJ = ctx.joueur.x - etat.x;
  const dzJ = ctx.joueur.z - etat.z;
  const distJ = Math.hypot(dxJ, dzJ);
  switch (etat.phase) {
    case 'poursuite':
      // En colère, il n'a plus de tanière : seule la distance au joueur le fait renoncer (`distanceAbandon`).
      // La poursuite elle-même est celle des ennemis ; à `porteeDeclenchement`, il s'arrête et prend son élan.
      return pasEnnemi({ ...etat, origineX: etat.x, origineZ: etat.z }, ctx, dt);
    case 'anticipation': {
      // Élan annoncé : il gratte le sol, tourné vers le joueur ; c'est le moment de lever le bouclier ou de s'écarter
      const e = brouillon(etat, dt);
      if (!ctx.joueur.vivant) {
        changer(e, 'poursuite');
        return { etat: e, degats: 0 };
      }
      const cap = distJ > 1e-3 ? Math.atan2(dxJ, dzJ) : e.orientation;
      e.orientation = tourner(e.orientation, cap, 1 - Math.exp(-12 * dt));
      if (e.tempsPhase >= I.dureeAnticipation) {
        // La charge part en ligne droite vers un point situé derrière le joueur : elle ne tourne plus
        const portee = distJ + CONFIG.comportementAnimaux.depassementCharge;
        e.cibleX = e.x + Math.sin(cap) * portee;
        e.cibleZ = e.z + Math.cos(cap) * portee;
        e.orientation = cap;
        changer(e, 'attaque');
      }
      return { etat: e, degats: 0 };
    }
    case 'attaque': {
      const e = brouillon(etat, dt);
      const dx = e.cibleX - e.x;
      const dz = e.cibleZ - e.z;
      const d = Math.hypot(dx, dz);
      const pas = Math.min(d, I.vitesseCharge * dt);
      let gain = 0;
      if (d > 1e-3) {
        const fin = avancer(e.x, e.z, (dx / d) * pas, (dz / d) * pas, I.rayon, ctx);
        gain = Math.hypot(fin.x - e.x, fin.z - e.z);
        e.x = fin.x;
        e.z = fin.z;
        e.orientation = tourner(e.orientation, Math.atan2(dx, dz), 1 - Math.exp(-14 * dt));
      }
      e.y = ctx.monde.hauteur(e.x, e.z);
      // Il touche au passage, une seule fois par charge (la recharge posée ici dure plus que la charge)
      let degats = 0;
      if (e.recharge <= 0 && ctx.joueur.vivant && Math.hypot(ctx.joueur.x - e.x, ctx.joueur.z - e.z) <= I.porteeCoup) {
        degats = I.degats;
        e.recharge = I.recharge + I.dureeAttaque;
      }
      // Fin de la charge : au bout de sa course, de sa durée, ou arrêté net par un obstacle
      if (d - pas < 0.2 || e.tempsPhase >= I.dureeAttaque || gain < pas * 0.3) {
        e.recharge = I.recharge;
        changer(e, 'poursuite');
      }
      return { etat: e, degats };
    }
    default:
      // Repos, errance (il fouille le sol et ignore le joueur : `distanceDetection` nulle), recul, étourdi, retour
      return pasEnnemi(etat, ctx, dt);
  }
}
