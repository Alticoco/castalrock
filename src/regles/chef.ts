// Chefs : des ennemis à part, avec un vrai combat. Morvan le Balafré, chef des bandits, garde son camp (étape 45).
// Il vit comme les autres ennemis (même état, mêmes coups reçus : voir combat.ts), avec en plus :
// - le coup lourd : son attaque normale, longue à venir (la hache levée) et qui fait très mal ; reculer hors de portée
//   l'esquive, le bouclier levé de face en retire sa part (tout avec « Bouclier solide ») ;
// - la charge : de temps en temps, il prend son élan puis fonce en ligne droite ; un pas de côté l'évite ;
// - l'appel : une fois par combat, sous la moitié de sa vie, il appelle des bandits ;
// - si le joueur tombe, il récupère toute sa vie, et le combat repart de zéro.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable. Réglages : CONFIG.chefs.

import { CONFIG } from '../config';
import { INFOS_ENNEMIS, avancer, pasEnnemi, tourner, type ContexteEnnemi, type EtatEnnemi, type TypeChef } from './combat';

export type { TypeChef };
export const TYPES_CHEF = Object.keys(CONFIG.chefs) as TypeChef[];

export function estChef(type: string): type is TypeChef {
  return (TYPES_CHEF as string[]).includes(type);
}

/** Identifiant de Morvan dans le monde (il n'y en a qu'un). */
export const ID_MORVAN = 'camp:morvan';
export const APPEL_MORVAN = 'Morvan : « À moi, les gars ! »';

/** Ce qu'un chef retient en plus de son état d'ennemi (jamais sauvegardé : le combat repart de zéro). */
export interface EtatChef {
  /** Vrai pendant une charge (élan : phase « anticipation » ; course : phase « attaque ») */
  readonly enCharge: boolean;
  /** Direction de la course (longueur 1), fixée à la fin de l'élan */
  readonly chargeX: number;
  readonly chargeZ: number;
  /** Vrai si la charge en cours a déjà touché le joueur */
  readonly chargeTouche: boolean;
  /** Secondes avant la prochaine charge possible */
  readonly rechargeCharge: number;
  /** Vrai une fois les renforts appelés pendant ce combat */
  readonly appelFait: boolean;
}

export function creerEtatChef(type: TypeChef = 'morvan'): EtatChef {
  // La première charge ne vient pas tout de suite : le joueur voit d'abord le coup lourd
  return { enCharge: false, chargeX: 0, chargeZ: 0, chargeTouche: false, rechargeCharge: CONFIG.chefs[type].charge.recharge * 0.5, appelFait: false };
}

export interface ResultatPasChef {
  etat: EtatEnnemi;
  chef: EtatChef;
  /** Dégâts portés au joueur pendant ce pas (avant bouclier et armure) */
  degats: number;
  /** Vrai au pas où il appelle ses renforts (une seule fois par combat) */
  appel: boolean;
  /** Vrai au pas où le combat repart de zéro (le joueur est tombé) : les renforts encore là s'en vont */
  recommence: boolean;
}

/** Part de vie restante (0 à 1). */
export function ratioVieChef(etat: EtatEnnemi): number {
  return Math.max(0, Math.min(1, etat.pv / INFOS_ENNEMIS[etat.type].pv));
}

/** Fait vivre un chef pendant dt secondes. Ne modifie ni `etat` ni `chef`. */
export function pasChef(etat: EtatEnnemi, chef: EtatChef, ctx: ContexteEnnemi, dt: number): ResultatPasChef {
  const rien: ResultatPasChef = { etat, chef, degats: 0, appel: false, recommence: false };
  if (!(dt > 0) || !estChef(etat.type)) return rien;
  if (etat.phase === 'mort') return { ...rien, etat: pasEnnemi(etat, ctx, dt).etat };
  const I = INFOS_ENNEMIS[etat.type];
  const K = CONFIG.chefs[etat.type];
  const G = K.charge;

  // Le joueur est tombé : toute la vie revient, le combat repart de zéro (il rentre à son poste comme un autre ennemi)
  if (!ctx.joueur.vivant) {
    const entame = etat.pv < I.pv || chef.appelFait || chef.enCharge;
    const base = chef.enCharge ? { ...etat, phase: 'poursuite' as const, tempsPhase: 0 } : etat;
    const r = pasEnnemi({ ...base, pv: I.pv }, ctx, dt);
    return { etat: r.etat, chef: entame ? creerEtatChef(etat.type) : chef, degats: 0, appel: false, recommence: entame };
  }

  let suite: EtatChef = { ...chef, rechargeCharge: Math.max(0, chef.rechargeCharge - dt) };
  // Appel des renforts : une fois, quand la vie passe sous le seuil
  let appel = false;
  if (!suite.appelFait && etat.pv <= I.pv * K.seuilAppel) {
    suite = { ...suite, appelFait: true };
    appel = true;
  }

  const dx = ctx.joueur.x - etat.x;
  const dz = ctx.joueur.z - etat.z;
  const distance = Math.hypot(dx, dz);

  if (suite.enCharge) {
    // Étourdi (parade réussie) : la charge s'arrête là
    if (etat.phase !== 'anticipation' && etat.phase !== 'attaque') {
      const r = pasEnnemi(etat, ctx, dt);
      return { etat: r.etat, chef: { ...suite, enCharge: false, rechargeCharge: G.recharge }, degats: r.degats, appel, recommence: false };
    }
    const tempsPhase = etat.tempsPhase + dt;
    // Les coups reçus ne le font pas reculer pendant la charge
    const e = { ...etat, tempsPhase, vx: 0, vz: 0, recharge: Math.max(0, etat.recharge - dt), calme: 0 };
    if (etat.phase === 'anticipation') {
      // Élan : il se tourne vers le joueur ; à la fin, la direction est fixée
      const orientation = distance > 1e-3 ? tourner(etat.orientation, Math.atan2(dx, dz), 1 - Math.exp(-12 * dt)) : etat.orientation;
      if (tempsPhase < G.elan) return { etat: { ...e, orientation }, chef: suite, degats: 0, appel, recommence: false };
      const ux = distance > 1e-3 ? dx / distance : Math.sin(orientation);
      const uz = distance > 1e-3 ? dz / distance : Math.cos(orientation);
      return {
        etat: { ...e, phase: 'attaque', tempsPhase: 0, orientation: Math.atan2(ux, uz) },
        chef: { ...suite, chargeX: ux, chargeZ: uz, chargeTouche: false },
        degats: 0,
        appel,
        recommence: false,
      };
    }
    // Course en ligne droite : il glisse contre les obstacles, touche une fois s'il passe assez près
    const pas = G.vitesse * dt;
    const fin = avancer(etat.x, etat.z, suite.chargeX * pas, suite.chargeZ * pas, I.rayon, ctx);
    const touche = !suite.chargeTouche && Math.hypot(ctx.joueur.x - fin.x, ctx.joueur.z - fin.z) <= G.portee;
    const bloque = Math.hypot(fin.x - etat.x, fin.z - etat.z) < pas * 0.2;
    const finie = tempsPhase >= G.duree || bloque;
    return {
      etat: {
        ...e,
        x: fin.x,
        z: fin.z,
        y: ctx.monde.hauteur(fin.x, fin.z),
        ...(finie ? { phase: 'poursuite' as const, tempsPhase: 0, recharge: I.recharge, meilleur: Infinity, bloque: 0, detour: 0 } : {}),
      },
      chef: { ...suite, enCharge: !finie, chargeTouche: suite.chargeTouche || touche, rechargeCharge: finie ? G.recharge : suite.rechargeCharge },
      degats: touche ? G.degats : 0,
      appel,
      recommence: false,
    };
  }

  // Début d'une charge : en poursuite, le joueur à bonne distance, la recharge écoulée
  if (etat.phase === 'poursuite' && suite.rechargeCharge <= 0 && distance >= G.distanceMin && distance <= G.distanceMax) {
    return {
      etat: { ...etat, phase: 'anticipation', tempsPhase: 0, vx: 0, vz: 0 },
      chef: { ...suite, enCharge: true, chargeTouche: false },
      degats: 0,
      appel,
      recommence: false,
    };
  }

  // Le reste du temps : un ennemi comme les autres (errance, poursuite, coup lourd annoncé, recul, retour)
  const r = pasEnnemi(etat, ctx, dt);
  return { etat: r.etat, chef: suite, degats: r.degats, appel, recommence: false };
}
