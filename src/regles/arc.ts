// Arc : tension, dégâts et vitesse de la flèche, vol de la flèche (avec une petite chute), butin du nœud Dépeceur.
// Pur : aucun import de three, aucun Math.random(). Valeurs dans CONFIG.arc et CONFIG.progression.arbre.
// La flèche réutilise le mécanisme des projectiles des sorts (direction, cibles en cylindres, impact).

import { CONFIG } from '../config';
import { dansCible, type CibleSort, type ImpactProjectile, type Point3, type Projectile } from './sorts';

const A = CONFIG.arc;

/** Part de tension (0 à 1) après `duree` secondes de clic maintenu. */
export function tensionArc(duree: number): number {
  if (!(duree > 0)) return 0;
  return Math.min(1, duree / A.dureeTension);
}

/** Vrai si l'arc est assez tendu pour que la flèche parte (un clic trop bref ne tire pas). */
export function peutTirer(tension: number): boolean {
  return tension >= A.tensionMin;
}

export interface Tir {
  degats: number;
  /** Vitesse de départ, en m/s */
  vitesse: number;
  /** Distance au bout de laquelle la flèche disparaît, en mètres */
  portee: number;
  /** Vrai si le nœud Tir chargé s'applique (pleine tension) */
  charge: boolean;
}

/** Ce que vaut une flèche lâchée à cette tension ; `tirCharge` : le nœud Tir chargé est acquis. */
export function tirDeFleche(tension: number, tirCharge = false): Tir {
  const t = Math.max(0, Math.min(1, tension));
  const charge = tirCharge && t >= 1;
  const C = CONFIG.progression.arbre.tirCharge;
  return {
    degats: Math.round((A.degatsMin + (A.degatsMax - A.degatsMin) * t) * (charge ? C.degats : 1)),
    vitesse: (A.vitesseMin + (A.vitesseMax - A.vitesseMin) * t) * (charge ? C.vitesse : 1),
    portee: A.portee * (charge ? C.portee : 1),
    charge,
  };
}

/** Flèche en vol : position, vitesse (m/s), distance parcourue, et ce qu'elle vaut. */
export interface Fleche extends Point3 {
  vx: number;
  vy: number;
  vz: number;
  distance: number;
  degats: number;
  portee: number;
}

/** Flèche qui part d'un projectile (point de départ et direction, voir `creerProjectile` des sorts). */
export function creerFleche(depart: Projectile, tir: Tir): Fleche {
  return {
    x: depart.x,
    y: depart.y,
    z: depart.z,
    vx: depart.dx * tir.vitesse,
    vy: depart.dy * tir.vitesse,
    vz: depart.dz * tir.vitesse,
    distance: 0,
    degats: tir.degats,
    portee: tir.portee,
  };
}

/**
 * Point à viser pour que la flèche arrive sur `but` malgré sa chute : on le relève de la hauteur perdue pendant le vol.
 * La correction s'arrête à `distanceCompensee` : plus loin, l'angle reste le même et la flèche passe sous le réticule.
 */
export function butCompense(depart: Point3, but: Point3, vitesse: number): Point3 {
  const distance = Math.hypot(but.x - depart.x, but.y - depart.y, but.z - depart.z);
  if (!(vitesse > 0) || distance < 1e-6) return but;
  const compensee = Math.min(distance, A.distanceCompensee);
  const temps = compensee / vitesse;
  return { x: but.x, y: but.y + 0.5 * A.gravite * temps * temps * (distance / compensee), z: but.z };
}

export interface ResultatFleche {
  /** Flèche après le pas, ou `null` si elle a touché quelque chose ou atteint sa portée */
  fleche: Fleche | null;
  /** Point d'impact (cible ou sol, `cible` valant alors `null`) ; `null` en vol ou en fin de portée */
  impact: ImpactProjectile | null;
}

/** Fait voler la flèche pendant `dt` secondes : elle tombe peu à peu, par petits pas pour ne rien traverser. */
export function avancerFleche(f: Fleche, dt: number, cibles: readonly CibleSort[], sol: (x: number, z: number) => number): ResultatFleche {
  if (!(dt > 0)) return { fleche: f, impact: null };
  const vitesse = Math.hypot(f.vx, f.vy, f.vz);
  const nombre = Math.max(1, Math.ceil((vitesse * dt) / 0.25));
  const h = dt / nombre;
  let { x, y, z, vy, distance } = f;
  for (let i = 0; i < nombre; i++) {
    vy -= A.gravite * h;
    x += f.vx * h;
    y += vy * h;
    z += f.vz * h;
    distance += Math.hypot(f.vx, vy, f.vz) * h;
    const touchee = cibles.find((c) => dansCible(c, x, y, z, A.rayonFleche));
    if (touchee) return { fleche: null, impact: { x, y, z, cible: touchee.id } };
    const hauteur = sol(x, z);
    if (y < hauteur) return { fleche: null, impact: { x, y: hauteur, z, cible: null } };
    if (distance >= f.portee) return { fleche: null, impact: null };
  }
  return { fleche: { ...f, x, y, z, vy, distance }, impact: null };
}

/** Dépeceur : un animal donne de la viande en plus (ou du cuir s'il ne donne pas de viande). */
export function butinDepeceur(butin: Readonly<Record<string, number>>): Record<string, number> {
  const plus = CONFIG.progression.arbre.depeceur;
  const objet = (butin['viande-crue'] ?? 0) > 0 ? 'viande-crue' : 'cuir';
  return { ...butin, [objet]: (butin[objet] ?? 0) + plus };
}
