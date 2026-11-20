// Sorts : déblocage, coût, recharge, effets (dégâts, soin) et déplacement du projectile de la boule de feu.
// Pur : aucun import de three, aucun Math.random(). Valeurs dans CONFIG.sorts.

import { CONFIG } from '../config';
import type { IdNoeud } from './competences';

export type NomSort = 'boule-de-feu' | 'soin' | 'barriere';
export const NOMS_SORTS: readonly NomSort[] = ['boule-de-feu', 'soin', 'barriere'];

export interface InfosSort {
  readonly nom: string;
  /** Touche du clavier (affichée sur l'icône) */
  readonly touche: string;
  /** Nœud de l'arbre de compétences qui le débloque */
  readonly noeud: IdNoeud;
  readonly cout: number;
  /** Temps de recharge, en secondes */
  readonly recharge: number;
}

const S = CONFIG.sorts;

export const INFOS_SORTS: Readonly<Record<NomSort, InfosSort>> = {
  'boule-de-feu': { nom: 'Boule de feu', touche: 'A', noeud: 'boule-de-feu', cout: S.bouleDeFeu.cout, recharge: S.bouleDeFeu.recharge },
  soin: { nom: 'Soin', touche: 'X', noeud: 'soin', cout: S.soin.cout, recharge: S.soin.recharge },
  barriere: { nom: 'Barrière', touche: 'C', noeud: 'barriere', cout: S.barriere.cout, recharge: S.barriere.recharge },
};

/** Vrai si le nœud du sort est acquis. */
export function sortDebloque(noeuds: readonly string[], sort: NomSort): boolean {
  return noeuds.includes(INFOS_SORTS[sort].noeud);
}

// --- Recharges et lancer ----------------------------------------------------------------------

/** Secondes restantes avant de pouvoir relancer chaque sort. */
export type Recharges = Readonly<Record<NomSort, number>>;

export function creerRecharges(): Recharges {
  return { 'boule-de-feu': 0, soin: 0, barriere: 0 };
}

export function pasRecharges(r: Recharges, dt: number): Recharges {
  if (!(dt > 0)) return r;
  return {
    'boule-de-feu': Math.max(0, r['boule-de-feu'] - dt),
    soin: Math.max(0, r.soin - dt),
    barriere: Math.max(0, r.barriere - dt),
  };
}

export type RaisonRefusSort = 'pas-appris' | 'mana' | 'recharge' | 'vie-pleine' | 'tombe';

export const MESSAGES_SORT: Readonly<Record<RaisonRefusSort, string>> = {
  'pas-appris': 'Sort pas encore appris',
  mana: 'Pas assez de mana',
  recharge: 'Sort en recharge',
  'vie-pleine': 'Vie déjà pleine',
  tombe: '',
};

export interface ContexteSort {
  /** Nœuds de l'arbre de compétences acquis */
  noeuds: readonly string[];
  mana: number;
  recharges: Recharges;
  pv: number;
  pvMax: number;
}

export type ResultatSort =
  | { ok: true; mana: number; recharges: Recharges }
  | { ok: false; raison: RaisonRefusSort };

/** Tente de lancer un sort : en cas de succès, renvoie le mana restant et les recharges mises à jour. */
export function lancerSort(sort: NomSort, c: ContexteSort): ResultatSort {
  const infos = INFOS_SORTS[sort];
  if (c.pv <= 0) return { ok: false, raison: 'tombe' };
  if (!sortDebloque(c.noeuds, sort)) return { ok: false, raison: 'pas-appris' };
  if (c.recharges[sort] > 0) return { ok: false, raison: 'recharge' };
  if (sort === 'soin' && c.pv >= c.pvMax) return { ok: false, raison: 'vie-pleine' };
  if (c.mana < infos.cout) return { ok: false, raison: 'mana' };
  return { ok: true, mana: c.mana - infos.cout, recharges: { ...c.recharges, [sort]: infos.recharge } };
}

// --- Effets -----------------------------------------------------------------------------------

/** Dégâts de la boule de feu (à l'ennemi touché, et aux autres dans l'explosion), selon la puissance des sorts. */
export function degatsBouleDeFeu(puissance = 1): { direct: number; explosion: number } {
  return {
    direct: Math.round(S.bouleDeFeu.degats * puissance),
    explosion: Math.round(S.bouleDeFeu.degatsExplosion * puissance),
  };
}

/** Points de vie rendus par le soin, selon la puissance des sorts. */
export function soinDuSort(puissance = 1): number {
  return Math.round(S.soin.pv * puissance);
}

// --- Barrière ---------------------------------------------------------------------------------

/** Bouclier magique : points de dégâts qu'il peut encore absorber, et secondes avant qu'il ne s'éteigne. */
export interface Barriere {
  readonly reste: number;
  readonly temps: number;
}

export const SANS_BARRIERE: Barriere = { reste: 0, temps: 0 };

/** Barrière toute neuve (valeurs du nœud : `progression.arbre.barriere`). */
export function creerBarriere(): Barriere {
  const B = CONFIG.progression.arbre.barriere;
  return { reste: B.absorbe, temps: B.duree };
}

export function barriereActive(b: Barriere): boolean {
  return b.reste > 0 && b.temps > 0;
}

/** Le temps passe : la barrière s'éteint au bout de sa durée, même intacte. */
export function pasBarriere(b: Barriere, dt: number): Barriere {
  if (!barriereActive(b)) return b === SANS_BARRIERE ? b : SANS_BARRIERE;
  if (!(dt > 0)) return b;
  const temps = b.temps - dt;
  return temps > 0 ? { ...b, temps } : SANS_BARRIERE;
}

/** La barrière prend les dégâts (après armure) tant qu'il lui reste des points ; le surplus passe. */
export function absorberDegats(b: Barriere, degats: number): { barriere: Barriere; absorbe: number; passe: number } {
  if (!(degats > 0)) return { barriere: b, absorbe: 0, passe: 0 };
  if (!barriereActive(b)) return { barriere: b, absorbe: 0, passe: degats };
  const absorbe = Math.min(b.reste, degats);
  const reste = b.reste - absorbe;
  return { barriere: reste > 0 ? { ...b, reste } : SANS_BARRIERE, absorbe, passe: degats - absorbe };
}

// --- Projectile de la boule de feu ------------------------------------------------------------

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

/** Ce que le projectile peut toucher : un cylindre vertical (position au sol, rayon, hauteur). */
export interface CibleSort extends Point3 {
  id: string;
  rayon: number;
  hauteur: number;
}

export interface Projectile extends Point3 {
  /** Direction unitaire */
  dx: number;
  dy: number;
  dz: number;
  /** Distance déjà parcourue, en mètres */
  distance: number;
}

export interface ImpactProjectile extends Point3 {
  /** Ennemi touché, ou `null` si le projectile a frappé le sol */
  cible: string | null;
}

/** Projectile parti de `depart` vers `but`. Si les deux points sont confondus, il part vers `repli`. */
export function creerProjectile(depart: Point3, but: Point3, repli: Point3 = { x: 0, y: 0, z: 1 }): Projectile {
  let dx = but.x - depart.x;
  let dy = but.y - depart.y;
  let dz = but.z - depart.z;
  let n = Math.hypot(dx, dy, dz);
  if (n < 1e-6) {
    dx = repli.x;
    dy = repli.y;
    dz = repli.z;
    n = Math.hypot(dx, dy, dz) || 1;
  }
  return { x: depart.x, y: depart.y, z: depart.z, dx: dx / n, dy: dy / n, dz: dz / n, distance: 0 };
}

export function dansCible(c: CibleSort, x: number, y: number, z: number, marge: number): boolean {
  return Math.hypot(x - c.x, z - c.z) <= c.rayon + marge && y >= c.y - marge && y <= c.y + c.hauteur + marge;
}

/**
 * Point visé par un rayon (la caméra) : le premier ennemi traversé ou le sol, sinon un point lointain sur le rayon.
 * Le projectile part ensuite de la main du joueur vers ce point, ce qui l'envoie là où se trouve le réticule.
 */
export function pointVise(
  origine: Point3,
  direction: Point3,
  cibles: readonly CibleSort[],
  sol: (x: number, z: number) => number,
  distanceMax = 60,
  pas = 0.4,
): Point3 {
  for (let d = pas; d <= distanceMax; d += pas) {
    const x = origine.x + direction.x * d;
    const y = origine.y + direction.y * d;
    const z = origine.z + direction.z * d;
    if (cibles.some((c) => dansCible(c, x, y, z, 0.15))) return { x, y, z };
    const h = sol(x, z);
    if (y < h) return { x, y: h, z };
  }
  const d = CONFIG.sorts.bouleDeFeu.portee;
  return { x: origine.x + direction.x * d, y: origine.y + direction.y * d, z: origine.z + direction.z * d };
}

export interface ResultatProjectile {
  /** Projectile après le pas, ou `null` s'il a touché quelque chose ou atteint sa portée */
  projectile: Projectile | null;
  /** Point d'impact (ennemi ou sol) ; `null` si le projectile est simplement en vol ou s'est éteint en fin de portée */
  impact: ImpactProjectile | null;
}

/** Fait avancer le projectile de `vitesse × dt` mètres, par petits pas pour ne rien traverser. */
export function avancerProjectile(
  p: Projectile,
  dt: number,
  cibles: readonly CibleSort[],
  sol: (x: number, z: number) => number,
): ResultatProjectile {
  const B = CONFIG.sorts.bouleDeFeu;
  if (!(dt > 0)) return { projectile: p, impact: null };
  const total = B.vitesse * dt;
  const nombre = Math.max(1, Math.ceil(total / 0.25));
  const pas = total / nombre;
  let { x, y, z, distance } = p;
  for (let i = 0; i < nombre; i++) {
    x += p.dx * pas;
    y += p.dy * pas;
    z += p.dz * pas;
    distance += pas;
    const touchee = cibles.find((c) => dansCible(c, x, y, z, B.rayonProjectile));
    if (touchee) return { projectile: null, impact: { x, y, z, cible: touchee.id } };
    const h = sol(x, z);
    if (y < h) return { projectile: null, impact: { x, y: h, z, cible: null } };
    if (distance >= B.portee) return { projectile: null, impact: null };
  }
  return { projectile: { ...p, x, y, z, distance }, impact: null };
}

/** Ennemis pris dans l'explosion (au plus à `rayon` mètres de son centre), sauf celui déjà touché de plein fouet. */
export function ciblesDansExplosion(
  cibles: readonly CibleSort[],
  centre: Point3,
  rayon: number = CONFIG.sorts.bouleDeFeu.rayonExplosion,
  exclure: string | null = null,
): string[] {
  return cibles
    .filter((c) => {
      if (c.id === exclure) return false;
      // Distance au cylindre : au sol, puis en hauteur
      const dh = Math.max(0, Math.hypot(centre.x - c.x, centre.z - c.z) - c.rayon);
      const dv = Math.max(0, c.y - centre.y, centre.y - (c.y + c.hauteur));
      return Math.hypot(dh, dv) <= rayon;
    })
    .map((c) => c.id);
}
