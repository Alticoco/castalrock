// Combat : vie du joueur, dégâts, potion, et comportement des ennemis (machines à états).
// Pur : aucun import de three, aucun Math.random(). Tout est immuable : chaque fonction renvoie un nouvel état.
// Convention d'orientation : lacet en radians, l'avant est (sin(lacet), cos(lacet)), comme le personnage.

import { CONFIG } from '../config';
import { creerAleatoire, hacher, type Aleatoire } from './aleatoire';
import { repousserHorsRectangle, type MondeDeplacement } from './deplacement';
import type { OutilRecolte } from './recolte';
export { hacher } from './aleatoire';

// --- Types d'ennemis --------------------------------------------------------------------------

export type TypeEnnemi = 'slime' | 'gobelin' | 'loup' | 'bandit';
export const TYPES_ENNEMI: readonly TypeEnnemi[] = ['slime', 'gobelin', 'loup', 'bandit'];
/** Animaux sauvages : ils vivent comme les ennemis (même état, mêmes coups reçus), leur comportement est dans animaux.ts. */
export type TypeAnimal = 'cerf' | 'lapin' | 'renard' | 'sanglier';
export const TYPES_ANIMAL: readonly TypeAnimal[] = ['cerf', 'lapin', 'renard', 'sanglier'];
/** Chefs : un seul exemplaire, à un lieu de l'histoire ; leur comportement est dans chef.ts. */
export type TypeChef = keyof typeof CONFIG.chefs;
export type TypeCreature = TypeEnnemi | TypeAnimal | TypeChef;

export interface LigneButin {
  objet: string;
  min: number;
  max: number;
  /** Chance d'obtenir cette ligne (0 à 1) */
  chance: number;
}

export interface InfosEnnemi {
  nom: string;
  pv: number;
  vitesse: number;
  vitesseErrance: number;
  /** Vrai : avance par bonds (slime) */
  sauts: boolean;
  dureeSaut: number;
  pauseSaut: number;
  distanceDetection: number;
  distanceAbandon: number;
  degats: number;
  porteeDeclenchement: number;
  porteeCoup: number;
  dureeAnticipation: number;
  dureeAttaque: number;
  recharge: number;
  rayon: number;
  interruptible: boolean;
  butin: readonly LigneButin[];
}

/** Caractéristiques de chaque type (valeurs dans CONFIG.ennemis, CONFIG.animaux et CONFIG.chefs). */
export const INFOS_ENNEMIS: Readonly<Record<TypeCreature, InfosEnnemi>> = { ...CONFIG.ennemis, ...CONFIG.animaux, ...CONFIG.chefs };

// --- Vie du joueur ----------------------------------------------------------------------------

export interface VieJoueur {
  readonly pv: number;
  /** Secondes écoulées depuis les derniers dégâts */
  readonly depuisDegats: number;
  /** Secondes avant de pouvoir reboire une potion */
  readonly rechargePotion: number;
  /** Régénération d'un repas en cours (PV par seconde, secondes restantes), absente sinon */
  readonly regeneration?: { readonly parSeconde: number; readonly reste: number };
}

/** `vieMax` : points de vie maximum (100 de base, plus la compétence Résistance). */
export function creerVieJoueur(pv: number = CONFIG.combat.vieMax, vieMax: number = CONFIG.combat.vieMax): VieJoueur {
  const borne = Math.max(0, Math.min(vieMax, pv));
  return { pv: borne, depuisDegats: CONFIG.combat.delaiRegeneration, rechargePotion: 0 };
}

/**
 * Dégâts réellement subis : l'armure en retire une part (au moins 1 point reste).
 * `reduction` : part retirée par l'armure portée (0 sans armure : voir `reductionArmure` de equipement.ts).
 * `efficaciteArmure` : 1 pour une armure en bon état, moins pour une armure usée.
 */
export function degatsRecus(brut: number, reduction: number, efficaciteArmure = 1): number {
  if (!(brut > 0)) return 0;
  return Math.max(1, Math.round(brut * (1 - reduction * efficaciteArmure)));
}

/** Dégâts d'un coup d'épée ; `facteurArme` : 1 pour l'épée de base, plus pour l'épée en fer. */
export function degatsEpee(facteurArme = 1): number {
  return CONFIG.combat.degatsEpee * facteurArme;
}

/**
 * Dégâts d'un coup contre un ennemi avec l'outil en main : l'épée fait ses dégâts pleins,
 * la hache et la pioche seulement une part (`combat.facteurOutilInadapte`), sans bonus de fer.
 */
export function degatsAvecOutil(outil: OutilRecolte, facteurArme = 1): number {
  return outil === 'epee' ? degatsEpee(facteurArme) : degatsEpee() * CONFIG.combat.facteurOutilInadapte;
}

export interface ResultatBlessure {
  vie: VieJoueur;
  /** Points réellement perdus */
  degats: number;
  /** Vrai si ce coup amène la vie à zéro */
  mort: boolean;
}

/** Le joueur reçoit un coup de `brut` points (avant armure). Sans effet s'il est déjà à zéro. */
export function blesserJoueur(vie: VieJoueur, brut: number, reduction: number, efficaciteArmure = 1): ResultatBlessure {
  if (vie.pv <= 0) return { vie, degats: 0, mort: false };
  const degats = Math.min(vie.pv, degatsRecus(brut, reduction, efficaciteArmure));
  if (degats <= 0) return { vie, degats: 0, mort: false };
  const pv = vie.pv - degats;
  return { vie: { ...vie, pv, depuisDegats: 0 }, degats, mort: pv <= 0 };
}

/** Le temps passe : recharge de la potion, puis régénération lente une fois le délai sans dégâts écoulé. */
export function pasVieJoueur(vie: VieJoueur, dt: number, vieMax: number = CONFIG.combat.vieMax): VieJoueur {
  if (!(dt > 0)) return vie;
  const C = CONFIG.combat;
  const depuisDegats = vie.depuisDegats + dt;
  let pv = vie.pv;
  if (pv > 0 && pv < vieMax && depuisDegats > C.delaiRegeneration) {
    // Seule la part du pas située après le délai régénère
    const duree = Math.min(dt, depuisDegats - C.delaiRegeneration);
    pv = Math.min(vieMax, pv + C.regenerationParSeconde * duree);
  }
  // Régénération d'un repas : indépendante du délai sans dégâts
  let regeneration = vie.regeneration;
  if (regeneration && pv > 0) {
    const duree = Math.min(dt, regeneration.reste);
    pv = Math.min(vieMax, pv + regeneration.parSeconde * duree);
    const reste = regeneration.reste - duree;
    regeneration = reste > 0 ? { parSeconde: regeneration.parSeconde, reste } : undefined;
  }
  return { pv, depuisDegats, rechargePotion: Math.max(0, vie.rechargePotion - dt), ...(regeneration ? { regeneration } : {}) };
}

export type RaisonPotion = 'aucune-potion' | 'vie-pleine' | 'recharge' | 'tombe';

export const MESSAGES_POTION: Readonly<Record<RaisonPotion, string>> = {
  'aucune-potion': 'Pas de potion de soin',
  'vie-pleine': 'Vie déjà pleine',
  recharge: 'Pas si vite…',
  tombe: '',
};

export interface ResultatPotion {
  ok: boolean;
  raison?: RaisonPotion;
  vie: VieJoueur;
  /** Points réellement rendus */
  soin: number;
}

/** Boit une potion de soin (c'est à l'appelant de la retirer de l'inventaire si `ok`). */
export function boirePotion(vie: VieJoueur, potions: number, vieMax: number = CONFIG.combat.vieMax): ResultatPotion {
  const C = CONFIG.combat;
  const refus = (raison: RaisonPotion): ResultatPotion => ({ ok: false, raison, vie, soin: 0 });
  if (vie.pv <= 0) return refus('tombe');
  if (potions < 1) return refus('aucune-potion');
  if (vie.pv >= vieMax) return refus('vie-pleine');
  if (vie.rechargePotion > 0) return refus('recharge');
  const pv = Math.min(vieMax, vie.pv + C.soinPotion);
  return { ok: true, vie: { ...vie, pv, rechargePotion: C.rechargePotion }, soin: pv - vie.pv };
}

// --- Ennemis ----------------------------------------------------------------------------------

/** `fuite` : seulement pour les animaux (voir animaux.ts). */
export type PhaseEnnemi = 'repos' | 'errance' | 'poursuite' | 'anticipation' | 'attaque' | 'recul' | 'etourdi' | 'retour' | 'fuite' | 'mort';

export interface EtatEnnemi {
  readonly id: string;
  readonly type: TypeCreature;
  /** Position au sol */
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly orientation: number;
  readonly pv: number;
  readonly phase: PhaseEnnemi;
  /** Secondes passées dans la phase en cours */
  readonly tempsPhase: number;
  /** Secondes avant la prochaine attaque possible */
  readonly recharge: number;
  /** Secondes pendant lesquelles il ignore le joueur (après un abandon) */
  readonly calme: number;
  /** Secondes passées sans avancer vers son but (obstacle, eau, falaise) */
  readonly bloque: number;
  /** Secondes de contournement restantes : il longe l'obstacle au lieu d'aller droit au but */
  readonly detour: number;
  /** Plus petite distance au but atteinte dans la phase en cours (sert à savoir s'il progresse) */
  readonly meilleur: number;
  /** Point d'apparition : centre de l'errance, lieu du retour */
  readonly origineX: number;
  readonly origineZ: number;
  /** But de l'errance en cours, et durée du repos en cours */
  readonly cibleX: number;
  readonly cibleZ: number;
  readonly attente: number;
  /** Vitesse de recul (coup reçu), en m/s */
  readonly vx: number;
  readonly vz: number;
  /** Avancement du cycle de bond (slime), en secondes ; voir `progressionSaut` */
  readonly cycle: number;
  /** Aléatoire propre à l'ennemi : graine et nombre de tirages déjà faits */
  readonly graine: number;
  readonly tirages: number;
  /** Écart d'angle du zigzag de la fuite en cours (animaux), en radians */
  readonly ecart: number;
}

/** Ce qu'un ennemi voit du monde à chaque pas. */
export interface ContexteEnnemi {
  /** `vitesse` : vitesse du joueur en m/s (absente = il court) ; lent, les animaux craintifs le laissent approcher de plus près */
  joueur: { x: number; z: number; vivant: boolean; vitesse?: number };
  /** Sol, eau et obstacles proches (mêmes cercles et rectangles que pour le personnage) */
  monde: MondeDeplacement;
  /** Les ennemis ne s'approchent pas de l'origine (centre du village) à moins de ce rayon */
  rayonVillage: number;
}

/** Rayon interdit aux ennemis autour du centre du village. */
export const RAYON_VILLAGE_ENNEMIS = CONFIG.monde.village.rayon + CONFIG.combat.margeVillage;

export function creerEnnemi(
  id: string,
  type: TypeCreature,
  x: number,
  z: number,
  y = 0,
  graine: number = CONFIG.graine,
): EtatEnnemi {
  const I = INFOS_ENNEMIS[type];
  const propre = (hacher(id) ^ Math.imul(graine | 0, 0x9e3779b1)) >>> 0;
  const alea = creerAleatoire(propre);
  return {
    id,
    type,
    x,
    y,
    z,
    orientation: alea.entre(0, Math.PI * 2),
    pv: I.pv,
    phase: 'repos',
    tempsPhase: 0,
    recharge: 0,
    calme: 0,
    bloque: 0,
    detour: 0,
    meilleur: Infinity,
    origineX: x,
    origineZ: z,
    cibleX: x,
    cibleZ: z,
    attente: alea.entre(0, CONFIG.combat.attenteMax),
    vx: 0,
    vz: 0,
    // Prêt à bondir
    cycle: I.dureeSaut + I.pauseSaut,
    graine: propre,
    tirages: 1,
    ecart: 0,
  };
}

/** Avancement du bond en cours (0 à 1), ou -1 si l'ennemi est au sol. */
export function progressionSaut(e: EtatEnnemi): number {
  const I = INFOS_ENNEMIS[e.type];
  return I.sauts && e.cycle < I.dureeSaut ? e.cycle / I.dureeSaut : -1;
}

/** Avancement de l'anticipation (0 à 1 : bras levé), 0 hors de cette phase. */
export function progressionAnticipation(e: EtatEnnemi): number {
  if (e.phase !== 'anticipation') return 0;
  const d = INFOS_ENNEMIS[e.type].dureeAnticipation;
  return d > 0 ? Math.min(1, e.tempsPhase / d) : 1;
}

export type Brouillon = { -readonly [K in keyof EtatEnnemi]: EtatEnnemi[K] };

export function tirer(e: Brouillon): Aleatoire {
  const alea = creerAleatoire((e.graine + Math.imul(e.tirages, 0x9e3779b1)) >>> 0);
  e.tirages += 1;
  return alea;
}

/** Sort un point des obstacles, puis de la zone du village. */
function resoudre(
  x: number,
  z: number,
  rayon: number,
  ctx: ContexteEnnemi,
): { x: number; z: number; village: boolean } {
  let cx = x;
  let cz = z;
  for (let passe = 0; passe < 2; passe++) {
    for (const o of ctx.monde.obstacles) {
      const ox = cx - o.x;
      const oz = cz - o.z;
      const mini = o.rayon + rayon;
      const d2 = ox * ox + oz * oz;
      if (d2 >= mini * mini) continue;
      const d = Math.sqrt(d2);
      const nx = d > 1e-6 ? ox / d : 1;
      const nz = d > 1e-6 ? oz / d : 0;
      cx = o.x + nx * mini;
      cz = o.z + nz * mini;
    }
    for (const o of ctx.monde.rectangles ?? []) {
      const sortie = repousserHorsRectangle(cx, cz, rayon, o);
      if (!sortie) continue;
      cx = sortie.x;
      cz = sortie.z;
    }
  }
  let village = false;
  const dv = Math.hypot(cx, cz);
  if (dv < ctx.rayonVillage) {
    village = true;
    if (dv > 1e-6) {
      cx = (cx / dv) * ctx.rayonVillage;
      cz = (cz / dv) * ctx.rayonVillage;
    } else {
      cx = ctx.rayonVillage;
      cz = 0;
    }
  }
  return { x: cx, z: cz, village };
}

/** Vrai si l'on peut aller de a à b : pas d'eau profonde, pas de pente trop raide à monter. */
function franchissable(ax: number, az: number, bx: number, bz: number, monde: MondeDeplacement): boolean {
  const C = CONFIG.combat;
  const hb = monde.hauteur(bx, bz);
  const ha = monde.hauteur(ax, az);
  // On peut toujours sortir d'une eau trop profonde (vers moins profond)
  if (monde.niveauEau - hb > C.profondeurMaxEnnemi && hb <= ha) return false;
  const d = Math.hypot(bx - ax, bz - az);
  return hb - ha <= d * Math.tan((C.penteMaxEnnemiDegres * Math.PI) / 180) + 0.05;
}

/**
 * Détour d'un ennemi bloqué : essaie de contourner sur le côté (toujours le même pour une graine donnée)
 * et garde ce pas latéral s'il avance plus que le pas direct `fin`. Renvoie la position et le cap retenus.
 */
export function essayerDetour(
  e: { x: number; z: number; graine: number },
  ux: number,
  uz: number,
  pas: number,
  rayon: number,
  fin: { x: number; z: number; village: boolean },
  cap: number,
  ctx: ContexteEnnemi,
): { fin: { x: number; z: number; village: boolean }; cap: number } {
  const angle = (e.graine % 2 === 0 ? 1 : -1) * 1.3;
  const rx = ux * Math.cos(angle) + uz * Math.sin(angle);
  const rz = -ux * Math.sin(angle) + uz * Math.cos(angle);
  const cote = avancer(e.x, e.z, rx * pas, rz * pas, rayon, ctx);
  if (Math.hypot(cote.x - e.x, cote.z - e.z) > Math.hypot(fin.x - e.x, fin.z - e.z)) {
    return { fin: cote, cap: Math.atan2(rx, rz) };
  }
  return { fin, cap };
}

/**
 * Déplace un ennemi de (mx, mz) : glisse contre les obstacles, s'arrête au bord du village, de l'eau
 * profonde et des falaises (en gardant la part du mouvement qui reste possible).
 */
export function avancer(
  x: number,
  z: number,
  mx: number,
  mz: number,
  rayon: number,
  ctx: ContexteEnnemi,
): { x: number; z: number; village: boolean } {
  const essayer = (px: number, pz: number): { x: number; z: number; village: boolean } | null => {
    const r = resoudre(px, pz, rayon, ctx);
    return franchissable(x, z, r.x, r.z, ctx.monde) ? r : null;
  };
  const direct = resoudre(x + mx, z + mz, rayon, ctx);
  if (franchissable(x, z, direct.x, direct.z, ctx.monde)) return direct;
  const partiel = essayer(x + mx, z) ?? essayer(x, z + mz);
  return { x: partiel?.x ?? x, z: partiel?.z ?? z, village: direct.village };
}

/** Tourne `orientation` vers `cible` (plus court chemin), d'autant plus que `taux` est grand. */
export function tourner(orientation: number, cible: number, taux: number): number {
  let diff = (cible - orientation) % (2 * Math.PI);
  if (diff > Math.PI) diff -= 2 * Math.PI;
  if (diff < -Math.PI) diff += 2 * Math.PI;
  return orientation + diff * taux;
}

export interface ResultatPasEnnemi {
  etat: EtatEnnemi;
  /** Dégâts portés au joueur pendant ce pas (avant armure) ; 0 la plupart du temps */
  degats: number;
}

/** Fait vivre un ennemi pendant dt secondes. Ne modifie pas `etat`. */
export function pasEnnemi(etat: EtatEnnemi, ctx: ContexteEnnemi, dt: number): ResultatPasEnnemi {
  if (!(dt > 0)) return { etat, degats: 0 };
  const I = INFOS_ENNEMIS[etat.type];
  const C = CONFIG.combat;
  const e: Brouillon = {
    ...etat,
    tempsPhase: etat.tempsPhase + dt,
    recharge: Math.max(0, etat.recharge - dt),
    calme: Math.max(0, etat.calme - dt),
  };
  if (e.phase === 'mort') return { etat: e, degats: 0 };

  const changer = (phase: PhaseEnnemi): void => {
    e.phase = phase;
    e.tempsPhase = 0;
    e.bloque = 0;
    e.detour = 0;
    e.meilleur = Infinity;
  };
  const abandonner = (): void => {
    e.calme = C.dureeCalme;
    changer('retour');
  };

  const dxJ = ctx.joueur.x - e.x;
  const dzJ = ctx.joueur.z - e.z;
  const distJ = Math.hypot(dxJ, dzJ);
  const distOrigine = Math.hypot(e.x - e.origineX, e.z - e.origineZ);
  const joueurAuVillage = Math.hypot(ctx.joueur.x, ctx.joueur.z) < ctx.rayonVillage;
  const joueurVisible = ctx.joueur.vivant && !joueurAuVillage;
  const detecte = joueurVisible && e.calme <= 0 && distJ <= I.distanceDetection;

  let degats = 0;
  // But du déplacement de ce pas, et vitesse
  let vise: { x: number; z: number } | null = null;
  let vitesse = 0;
  let regarderJoueur = false;

  switch (e.phase) {
    case 'repos':
      if (detecte) {
        changer('poursuite');
      } else if (e.tempsPhase >= e.attente) {
        const alea = tirer(e);
        const angle = alea.entre(0, Math.PI * 2);
        const rayon = alea.entre(1.5, C.rayonErrance);
        e.cibleX = e.origineX + Math.sin(angle) * rayon;
        e.cibleZ = e.origineZ + Math.cos(angle) * rayon;
        changer('errance');
      }
      break;
    case 'errance':
      if (detecte) {
        changer('poursuite');
      } else if (Math.hypot(e.cibleX - e.x, e.cibleZ - e.z) < 0.4 || e.tempsPhase > C.dureeErranceMax) {
        e.attente = tirer(e).entre(C.attenteMin, C.attenteMax);
        changer('repos');
      } else {
        vise = { x: e.cibleX, z: e.cibleZ };
        vitesse = I.vitesseErrance;
      }
      break;
    case 'poursuite':
      if (!joueurVisible || distJ > I.distanceAbandon || distOrigine > I.distanceAbandon) {
        abandonner();
      } else if (distJ <= I.porteeDeclenchement) {
        regarderJoueur = true;
        if (e.recharge <= 0) changer('anticipation');
      } else {
        vise = { x: ctx.joueur.x, z: ctx.joueur.z };
        vitesse = I.vitesse;
      }
      break;
    case 'anticipation':
      regarderJoueur = true;
      if (e.tempsPhase >= I.dureeAnticipation) {
        // Le coup part : il ne touche que si le joueur est encore assez près (sinon : esquivé)
        if (ctx.joueur.vivant && distJ <= I.porteeCoup) degats = I.degats;
        e.recharge = I.recharge;
        changer('attaque');
      }
      break;
    case 'attaque':
      if (e.tempsPhase >= I.dureeAttaque) changer('poursuite');
      break;
    case 'recul':
      if (e.tempsPhase >= C.dureeRecul) changer('poursuite');
      break;
    case 'etourdi':
      // Parade réussie : il reste sur place, sans attaquer, puis reprend la poursuite
      if (e.tempsPhase >= CONFIG.bouclier.dureeEtourdissement) changer('poursuite');
      break;
    case 'retour':
      if (distOrigine < 1) {
        e.pv = I.pv;
        e.attente = tirer(e).entre(C.attenteMin, C.attenteMax);
        changer('repos');
      } else if (detecte && distOrigine < I.distanceAbandon * 0.5) {
        changer('poursuite');
      } else {
        vise = { x: e.origineX, z: e.origineZ };
        vitesse = I.vitesse * 0.8;
      }
      break;
  }

  // Bonds du slime : il n'avance qu'en l'air, et ne repart que s'il a un but
  if (I.sauts) {
    const total = I.dureeSaut + I.pauseSaut;
    let c = e.cycle + dt;
    if (c >= total) c = vise ? c - total : total;
    e.cycle = c;
    if (c >= I.dureeSaut) vitesse = 0;
  }

  // Recul (coup reçu) : glisse et freine
  if (e.vx !== 0 || e.vz !== 0) {
    const r = avancer(e.x, e.z, e.vx * dt, e.vz * dt, I.rayon, ctx);
    e.x = r.x;
    e.z = r.z;
    const frein = Math.exp(-C.freinRecul * dt);
    e.vx *= frein;
    e.vz *= frein;
    if (Math.hypot(e.vx, e.vz) < 0.05) {
      e.vx = 0;
      e.vz = 0;
    }
  }

  // Marche vers le but. S'il n'avance plus vers lui (obstacle, rive, falaise), il longe l'obstacle
  // d'un côté pendant un court moment (toujours le même côté pour un ennemi donné), puis réessaie.
  if (vise && vitesse > 0) {
    const dx = vise.x - e.x;
    const dz = vise.z - e.z;
    const d = Math.hypot(dx, dz);
    if (d > 1e-3) {
      const ux = dx / d;
      const uz = dz / d;
      const pas = Math.min(d, vitesse * dt);
      let fin = avancer(e.x, e.z, ux * pas, uz * pas, I.rayon, ctx);
      const auBordDuVillage = fin.village;
      const gain = d - Math.hypot(vise.x - fin.x, vise.z - fin.z);
      if (gain < pas * 0.35) e.detour = C.dureeDetour;
      // Gêné (trajet dévié ou contournement) sans s'être rapproché du but : le temps de blocage court
      const gene = Math.hypot(fin.x - (e.x + ux * pas), fin.z - (e.z + uz * pas)) > pas * 0.1;
      if (d < e.meilleur - 0.05) {
        e.meilleur = d;
        e.bloque = 0;
      } else if (gene || e.detour > 0) {
        e.bloque += dt;
      }
      let cap = Math.atan2(ux, uz);
      if (e.detour > 0) {
        e.detour = Math.max(0, e.detour - dt);
        const d2 = essayerDetour(e, ux, uz, pas, I.rayon, fin, cap, ctx);
        fin = d2.fin;
        cap = d2.cap;
      }
      e.x = fin.x;
      e.z = fin.z;
      e.orientation = tourner(e.orientation, cap, 1 - Math.exp(-10 * dt));
      // Bord du village : l'ennemi s'arrête et repart
      if (auBordDuVillage && e.phase === 'poursuite') {
        abandonner();
      } else if (e.bloque > C.dureeBlocage) {
        if (e.phase === 'poursuite') {
          abandonner();
        } else if (e.phase === 'errance') {
          e.attente = tirer(e).entre(C.attenteMin, C.attenteMax);
          changer('repos');
        } else if (e.phase === 'retour') {
          // Chemin du retour coupé : il s'installe là où il est
          e.origineX = e.x;
          e.origineZ = e.z;
          e.bloque = 0;
          e.meilleur = Infinity;
        }
      }
    }
  }
  if (regarderJoueur && distJ > 1e-3) {
    e.orientation = tourner(e.orientation, Math.atan2(dxJ, dzJ), 1 - Math.exp(-12 * dt));
  }
  e.y = ctx.monde.hauteur(e.x, e.z);
  return { etat: e, degats };
}

/** Parade réussie : l'ennemi est étourdi (`bouclier.dureeEtourdissement`), son attaque en cours s'arrête. Sans effet sur un mort. */
export function etourdirEnnemi(etat: EtatEnnemi): EtatEnnemi {
  if (etat.phase === 'mort') return etat;
  return { ...etat, phase: 'etourdi', tempsPhase: 0, bloque: 0, detour: 0, meilleur: Infinity };
}

export interface ResultatCoupEnnemi {
  etat: EtatEnnemi;
  /** Vrai seulement au coup qui le tue */
  mort: boolean;
}

/** L'ennemi reçoit un coup venu de (depuisX, depuisZ) : dégâts, recul, et il devient hostile. */
export function frapperEnnemi(etat: EtatEnnemi, degats: number, depuisX: number, depuisZ: number): ResultatCoupEnnemi {
  if (etat.phase === 'mort') return { etat, mort: false };
  const I = INFOS_ENNEMIS[etat.type];
  const C = CONFIG.combat;
  const dx = etat.x - depuisX;
  const dz = etat.z - depuisZ;
  const d = Math.hypot(dx, dz);
  const nx = d > 1e-6 ? dx / d : Math.sin(etat.orientation + Math.PI);
  const nz = d > 1e-6 ? dz / d : Math.cos(etat.orientation + Math.PI);
  const pv = Math.max(0, etat.pv - Math.max(0, degats));
  const base = { ...etat, pv, vx: nx * C.vitesseRecul, vz: nz * C.vitesseRecul, calme: 0 };
  if (pv <= 0) return { etat: { ...base, phase: 'mort', tempsPhase: 0, vx: 0, vz: 0 }, mort: true };
  // Un ennemi « non interruptible » garde son attaque en cours (mais recule quand même)
  const garde = !I.interruptible && (etat.phase === 'anticipation' || etat.phase === 'attaque');
  // Étourdi : un coup reçu ne raccourcit pas l'étourdissement
  if (garde || etat.phase === 'etourdi') return { etat: base, mort: false };
  return { etat: { ...base, phase: 'recul', tempsPhase: 0 }, mort: false };
}

/**
 * Ennemi que l'épée touche : le plus proche à portée (mesurée jusqu'à son bord) et devant le regard
 * (ou tout contre le personnage). `null` s'il n'y en a pas.
 */
export function ennemiVise(
  ennemis: readonly EtatEnnemi[],
  x: number,
  z: number,
  regard: number,
  portee: number = CONFIG.combat.porteeEpee,
  demiAngle: number = (CONFIG.combat.angleFrappeDegres * Math.PI) / 180,
): EtatEnnemi | null {
  let meilleur: EtatEnnemi | null = null;
  let distance = Infinity;
  for (const e of ennemis) {
    if (e.phase === 'mort') continue;
    const dx = e.x - x;
    const dz = e.z - z;
    const d = Math.hypot(dx, dz);
    const rayon = INFOS_ENNEMIS[e.type].rayon;
    if (d - rayon > portee || d >= distance) continue;
    if (d - rayon > 0.7) {
      const ecart = Math.abs(tourner(0, Math.atan2(dx, dz) - regard, 1));
      if (ecart > demiAngle) continue;
    }
    meilleur = e;
    distance = d;
  }
  return meilleur;
}

/** Butin d'un ennemi tué : toujours le même pour une même clé (identifiant + instant) et une même graine. */
export function tirerButinEnnemi(type: TypeCreature, cle: string, graine: number = CONFIG.graine): Record<string, number> {
  const alea = creerAleatoire((hacher(cle) ^ Math.imul(graine | 0, 0x85ebca6b)) >>> 0);
  const butin: Record<string, number> = {};
  for (const ligne of INFOS_ENNEMIS[type].butin) {
    const chance = alea.suivant();
    const n = alea.entier(ligne.min, ligne.max);
    if (chance < ligne.chance && n > 0) butin[ligne.objet] = (butin[ligne.objet] ?? 0) + n;
  }
  return butin;
}
