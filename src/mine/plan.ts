// Plan de la mine : zone intérieure séparée du monde, faite de salles et de galeries creusées
// dans une grille de cases de 1 m. Pur : aucun import de three, aucun Math.random().
// Le plan ne dépend que de la graine : même graine = même mine, mêmes rochers, mêmes ennemis.
//
// La mine est posée très loin du monde (CONFIG.mine.origine) : on ne l'atteint que par le
// portail. Toutes les positions données ici sont dans le repère du monde ; le sol est plat,
// à l'altitude CONFIG.mine.altitude.

import { CONFIG } from '../config';
import { hacher2D } from '../monde/bruit';
import { INFOS_DECOR, type ElementDecor, type TypeDecor } from '../monde/decor';
import { creerAleatoire } from '../regles/aleatoire';
import { peutReapparaitre, type PointApparition } from '../regles/apparitions';
import type { ObstacleCercle, ObstacleRectangle } from '../regles/deplacement';

/** Taille de la grille, en cases de 1 m */
const LARGEUR = 68;
const PROFONDEUR = 82;
/** Colonne suivie par les rails (avant miroir) */
const X_RAILS = 36;

export type TypeZone = 'entree' | 'galerie' | 'salle' | 'cristaux';

/** Une salle ou un tronçon de galerie : rectangle [x0, x1[ × [z0, z1[, dans le repère du monde. */
export interface ZoneMine {
  nom: string;
  type: TypeZone;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/** Cadre de soutènement en travers d'une galerie : deux poteaux, une poutre, une lanterne. */
export interface Portique {
  x: number;
  z: number;
  /** Vrai : la poutre est le long de l'axe x (la galerie court le long de z) */
  poutreX: boolean;
  demiLargeur: number;
  /** Côté de la lanterne le long de la poutre : -1 ou 1 */
  lanterne: number;
}

/** Lanterne sur potence, contre le mur d'une salle ; `lacet` : direction du bras, vers l'intérieur. */
export interface Potence {
  x: number;
  z: number;
  lacet: number;
}

/** Petits cristaux lumineux incrustés dans les parois (décor, non récoltables) ; y au-dessus du sol. */
export interface CristalDecor {
  x: number;
  y: number;
  z: number;
  lacet: number;
  echelle: number;
}

export interface PlanMine {
  readonly graine: number;
  /** Coin de la grille dans le monde, et altitude du sol */
  readonly origine: { x: number; z: number };
  readonly altitude: number;
  readonly largeur: number;
  readonly profondeur: number;
  /** 1 = case creusée (on peut y marcher), rangée par rangée */
  readonly ouvert: Uint8Array;
  /** Distance au mur le plus proche, en cases (0 = roche, 1 = contre un mur) */
  readonly distance: Uint8Array;
  readonly zones: readonly ZoneMine[];
  /** Où le joueur apparaît en entrant (orientation : lacet du personnage) */
  readonly arrivee: { x: number; z: number; orientation: number };
  /** Porte de sortie, au fond de la salle d'entrée */
  readonly sortie: { x: number; z: number };
  /** Rochers, filons et cristaux à récolter : identifiants stables `m:<n>` */
  readonly elements: readonly ElementDecor[];
  /** Points d'apparition fixes des ennemis : identifiants `e:mine:<n>` */
  readonly ennemis: readonly PointApparition[];
  readonly portiques: readonly Portique[];
  readonly potences: readonly Potence[];
  readonly cristauxDecor: readonly CristalDecor[];
  /** Voie ferrée : un segment droit */
  readonly rails: { x0: number; z0: number; x1: number; z1: number };
  /** Wagonnet posé sur les rails */
  readonly wagonnet: { x: number; z: number };
  /** Poteaux, potences et wagonnet : cercles de collision */
  readonly poteaux: readonly ObstacleCercle[];
}

/** Vrai si (x, z) est dans la zone réservée à la mine (grille et marge autour). */
export function contientZoneMine(x: number, z: number): boolean {
  const o = CONFIG.mine.origine;
  return x > o.x - 20 && x < o.x + LARGEUR + 20 && z > o.z - 20 && z < o.z + PROFONDEUR + 20;
}

function ouvertLocal(plan: Pick<PlanMine, 'ouvert' | 'largeur' | 'profondeur'>, i: number, j: number): boolean {
  return i >= 0 && j >= 0 && i < plan.largeur && j < plan.profondeur && plan.ouvert[j * plan.largeur + i] === 1;
}

/** Vrai si le point du monde (x, z) est dans une case creusée. */
export function estOuvert(plan: PlanMine, x: number, z: number): boolean {
  return ouvertLocal(plan, Math.floor(x - plan.origine.x), Math.floor(z - plan.origine.z));
}

/** Distance au mur de la case (i, j) de la grille (0 hors de la grille ou dans la roche). */
export function distanceMur(plan: PlanMine, i: number, j: number): number {
  if (i < 0 || j < 0 || i >= plan.largeur || j >= plan.profondeur) return 0;
  return plan.distance[j * plan.largeur + i];
}

/**
 * Hauteur du plafond au sommet (i, j) de la grille, au-dessus du sol : basse le long des murs,
 * plus haute au milieu des salles, avec une irrégularité stable (voûte facettée).
 */
export function plafondSommet(plan: PlanMine, i: number, j: number): number {
  const d = Math.min(distanceMur(plan, i - 1, j - 1), distanceMur(plan, i, j - 1), distanceMur(plan, i - 1, j), distanceMur(plan, i, j));
  const bruit = hacher2D(i, j, plan.graine + 4242);
  return 2.9 + 0.7 * Math.min(d, 5) + bruit * (d === 0 ? 0.35 : 0.55);
}

/** Hauteur libre sous le plafond en (x, z) du monde, au-dessus du sol (la plus basse des quatre coins de la case). */
export function hauteurPlafond(plan: PlanMine, x: number, z: number): number {
  const i = Math.floor(x - plan.origine.x);
  const j = Math.floor(z - plan.origine.z);
  return Math.min(plafondSommet(plan, i, j), plafondSommet(plan, i + 1, j), plafondSommet(plan, i, j + 1), plafondSommet(plan, i + 1, j + 1));
}

/** Murs proches de (x, z) : un rectangle par suite de cases de roche d'une même rangée. */
export function rectanglesAutour(plan: PlanMine, x: number, z: number, rayon = 3): ObstacleRectangle[] {
  const o = plan.origine;
  const i0 = Math.floor(x - o.x - rayon);
  const i1 = Math.floor(x - o.x + rayon);
  const j0 = Math.floor(z - o.z - rayon);
  const j1 = Math.floor(z - o.z + rayon);
  const liste: ObstacleRectangle[] = [];
  for (let j = j0; j <= j1; j++) {
    let debut = -1;
    for (let i = i0; i <= i1 + 1; i++) {
      const plein = i <= i1 && !ouvertLocal(plan, i, j);
      if (plein && debut < 0) debut = i;
      if (!plein && debut >= 0) {
        liste.push({ x: o.x + (debut + i) / 2, z: o.z + j + 0.5, demiLargeur: (i - debut) / 2, demiProfondeur: 0.5, angle: 0 });
        debut = -1;
      }
    }
  }
  return liste;
}

/**
 * Distance libre le long d'un rayon (direction de longueur 1) avant un mur ou le plafond, au plus `max`.
 * Sert à rapprocher la caméra en 3e personne. `oy` est une altitude du monde.
 */
export function distanceLibre(
  plan: PlanMine,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  max: number,
  marge = 0.3,
): number {
  const pas = 0.2;
  let libre = 0;
  for (let d = pas; d <= max + 1e-6; d += pas) {
    const x = ox + dx * d;
    const y = oy + dy * d - plan.altitude;
    const z = oz + dz * d;
    if (y > hauteurPlafond(plan, x, z) - marge) return libre;
    if (!estOuvert(plan, x + marge, z) || !estOuvert(plan, x - marge, z)) return libre;
    if (!estOuvert(plan, x, z + marge) || !estOuvert(plan, x, z - marge)) return libre;
    libre = d;
  }
  return max;
}

/**
 * Ennemis de la mine à faire apparaître maintenant : point libre, délai de réapparition écoulé
 * (le même que dehors), et joueur assez loin pour ne pas les voir surgir.
 */
export function ennemisAFaireApparaitre(
  plan: PlanMine,
  actifs: ReadonlySet<string>,
  morts: Readonly<Record<string, number>>,
  temps: number,
  joueur: { x: number; z: number },
): PointApparition[] {
  const mini = CONFIG.mine.distanceMiniApparition;
  return plan.ennemis.filter(
    (p) => !actifs.has(p.id) && peutReapparaitre(morts[p.id], temps) && Math.hypot(p.x - joueur.x, p.z - joueur.z) >= mini,
  );
}

/** Élément de la mine d'identifiant `m:<n>`, ou null. */
export function elementDeLaMine(plan: PlanMine, id: string): ElementDecor | null {
  if (!id.startsWith('m:')) return null;
  return plan.elements.find((e) => e.id === id) ?? null;
}

type TypeMinier = Extract<TypeDecor, 'rocher' | 'filon-fer' | 'filon-charbon' | 'cristal-bleu'>;
/** Place réservée autour d'un élément : son plus grand rayon, et de quoi laisser passer le personnage entre deux. */
const rayonMax = (type: TypeMinier) => INFOS_DECOR[type].rayonCollision * ECHELLES[type][1] + 0.45;
const ECHELLES: Record<TypeMinier, [number, number]> = {
  rocher: [0.7, 1.2],
  'filon-fer': [0.9, 1.2],
  'filon-charbon': [0.9, 1.2],
  'cristal-bleu': [0.85, 1.3],
};

interface ZoneLocale extends ZoneMine {
  /** Rochers, filons, cristaux à récolter, et cristaux de décor dans les parois */
  contenu: [number, number, number, number];
}

/** Crée le plan de la mine d'une graine. */
export function creerPlanMine(graine: number): PlanMine {
  const M = CONFIG.mine;
  const L = LARGEUR;
  const H = PROFONDEUR;
  const o = M.origine;
  const alea = creerAleatoire((Math.imul(graine | 0, 0x9e3779b1) ^ 0x6d696e65) >>> 0);
  const miroir = alea.suivant() < 0.5;
  const mx = (x: number) => (miroir ? L - x : x);
  const ouvert = new Uint8Array(L * H);
  const zones: ZoneLocale[] = [];

  /** Creuse un rectangle (coordonnées avant miroir) ; `chanfrein` : coins coupés, en cases. */
  function creuser(
    nom: string,
    type: TypeZone,
    x0: number,
    z0: number,
    x1: number,
    z1: number,
    contenu: [number, number, number, number],
    chanfrein = 0,
  ): ZoneLocale {
    const a = miroir ? L - x1 : x0;
    const b = miroir ? L - x0 : x1;
    for (let j = z0; j < z1; j++) {
      for (let i = a; i < b; i++) {
        const di = Math.min(i - a, b - 1 - i);
        const dj = Math.min(j - z0, z1 - 1 - j);
        if (di + dj < chanfrein) continue;
        ouvert[j * L + i] = 1;
      }
    }
    const zone: ZoneLocale = { nom, type, x0: a, z0, x1: b, z1, contenu };
    zones.push(zone);
    return zone;
  }

  // Longueurs et décalages tirés de la graine
  const l1 = alea.entier(12, 16);
  const oa = alea.entier(-2, 2);
  const l3 = alea.entier(12, 16);
  const ob = alea.entier(0, 4);
  const o4 = alea.entier(0, 4);
  const l5 = alea.entier(8, 12);
  const zA = 14 + l1;
  const zC = zA + 14 + l3;
  const zB = zA + 10 + ob;
  const z4 = Math.max(zB + 3, Math.min(zB + 7, zA + 16 + o4));

  creuser('sortie', 'entree', 34, 2, 38, 4, [0, 0, 0, 0]);
  creuser("salle d'entrée", 'entree', 30, 4, 42, 14, [2, 0, 0, 0], 2);
  creuser('grande salle', 'salle', 26 + oa, zA, 46 + oa, zA + 14, [4, 3, 1, 2], 3);
  creuser("salle de l'ouest", 'salle', 6, zB, 22, zB + 13, [3, 4, 2, 2], 3);
  const salleC = creuser('salle aux cristaux', 'cristaux', 27, zC, 47, zC + 15, [2, 2, 7, 10], 4);
  creuser('galerie principale', 'galerie', 34, 14, 38, zA, [2, 1, 0, 1]);
  creuser("galerie de l'ouest", 'galerie', 12, zA + 4, 26 + oa, zA + 8, [1, 1, 0, 1]);
  creuser("galerie de l'ouest (coude)", 'galerie', 12, zA + 8, 16, zB, [1, 0, 0, 0]);
  creuser('galerie du fond', 'galerie', 34, zA + 14, 38, zC, [1, 1, 1, 3]);
  creuser('galerie de traverse', 'galerie', 22, z4, 34, z4 + 3, [1, 0, 1, 1]);
  creuser("galerie de l'est", 'galerie', 42, 7, 58, 10, [1, 1, 0, 0]);
  creuser("galerie de l'est (coude)", 'galerie', 55, 10, 58, 10 + l5, [1, 1, 0, 0]);
  creuser('poche de fer', 'salle', 52, 10 + l5, 61, 16 + l5, [1, 3, 0, 0], 1);

  // Distance au mur : 0 dans la roche, 1 contre un mur, puis de proche en proche (8 voisins)
  const distance = new Uint8Array(L * H);
  const estCreuse = (i: number, j: number) => i >= 0 && j >= 0 && i < L && j < H && ouvert[j * L + i] === 1;
  for (let d = 1; d < 20; d++) {
    let trouve = false;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < L; i++) {
        if (!estCreuse(i, j) || distance[j * L + i] !== 0) continue;
        let touche = false;
        for (let b = -1; b <= 1 && !touche; b++) {
          for (let a = -1; a <= 1; a++) {
            if (a === 0 && b === 0) continue;
            const voisin = estCreuse(i + a, j + b) ? distance[(j + b) * L + i + a] : 0;
            // Un voisin déjà numéroté à cette passe ne compte pas (sinon la distance dépendrait de l'ordre)
            if ((d === 1 && !estCreuse(i + a, j + b)) || (d > 1 && voisin === d - 1)) {
              touche = true;
              break;
            }
          }
        }
        if (touche) {
          distance[j * L + i] = d + 100;
          trouve = true;
        }
      }
    }
    for (let k = 0; k < distance.length; k++) if (distance[k] > 100) distance[k] -= 100;
    if (!trouve) break;
  }

  const xr = mx(X_RAILS);
  // Au milieu de la salle d'entrée : la caméra de la 3e personne a la place de reculer sans entrer dans l'alcôve
  const arrivee = { x: o.x + xr, z: o.z + 9.5, orientation: 0 };
  const sortie = { x: o.x + xr, z: o.z + 3 };
  const zFinRails = zC + 5;

  // Place déjà prise (repère de la grille) : rien ne se pose à moins de `r` + son propre rayon
  const occupes: Array<{ x: number; z: number; r: number }> = [
    { x: xr, z: 9.5, r: 3 },
    { x: xr, z: 3, r: 2.5 },
  ];
  const libre = (x: number, z: number, r: number) => occupes.every((p) => Math.hypot(p.x - x, p.z - z) >= p.r + r);
  const poteaux: ObstacleCercle[] = [];
  const poserPoteau = (x: number, z: number, rayon: number) => {
    poteaux.push({ x: o.x + x, z: o.z + z, rayon });
    occupes.push({ x, z, r: rayon + 0.4 });
  };

  /** Direction du mur le plus proche d'une case (somme des 4 voisins de roche), de longueur 1 ou nulle. */
  function versMur(i: number, j: number): { x: number; z: number } {
    let x = 0;
    let z = 0;
    if (!estCreuse(i + 1, j)) x += 1;
    if (!estCreuse(i - 1, j)) x -= 1;
    if (!estCreuse(i, j + 1)) z += 1;
    if (!estCreuse(i, j - 1)) z -= 1;
    const l = Math.hypot(x, z);
    return l > 0 ? { x: x / l, z: z / l } : { x: 0, z: 0 };
  }

  function voisinsPleins(i: number, j: number): number {
    let n = 0;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) if ((a !== 0 || b !== 0) && !estCreuse(i + a, j + b)) n++;
    return n;
  }

  const presDesRails = (i: number, j: number) => Math.abs(i + 0.5 - xr) < 1.7 && j < zFinRails + 1;

  /** Cases d'une zone collées à un mur franc (ni coin saillant, ni voie ferrée), mélangées. */
  function casesContreMur(zone: ZoneMine): Array<[number, number]> {
    const cases: Array<[number, number]> = [];
    for (let j = zone.z0; j < zone.z1; j++) {
      for (let i = zone.x0; i < zone.x1; i++) {
        if (estCreuse(i, j) && distance[j * L + i] === 1 && voisinsPleins(i, j) >= 3 && !presDesRails(i, j)) cases.push([i, j]);
      }
    }
    for (let k = cases.length - 1; k > 0; k--) {
      const r = alea.entier(0, k);
      [cases[k], cases[r]] = [cases[r], cases[k]];
    }
    return cases;
  }

  // 1. Portiques des galeries (tous les 6 m environ) et lanternes sur potence des salles
  const portiques: Portique[] = [];
  const potences: Potence[] = [];
  let cote = 1;
  for (const zone of zones) {
    const dx = zone.x1 - zone.x0;
    const dz = zone.z1 - zone.z0;
    if (zone.nom === 'sortie') continue;
    if (zone.type === 'galerie') {
      const lelongDeZ = dz >= dx;
      const longueur = lelongDeZ ? dz : dx;
      const n = Math.max(1, Math.round(longueur / 6));
      for (let k = 0; k < n; k++) {
        const t = ((k + 0.5) * longueur) / n;
        const x = lelongDeZ ? (zone.x0 + zone.x1) / 2 : zone.x0 + t;
        const z = lelongDeZ ? zone.z0 + t : (zone.z0 + zone.z1) / 2;
        const demi = (lelongDeZ ? dx : dz) / 2;
        cote = -cote;
        portiques.push({ x: o.x + x, z: o.z + z, poutreX: lelongDeZ, demiLargeur: demi, lanterne: cote });
        for (const s of [-1, 1]) poserPoteau(lelongDeZ ? x + s * (demi - 0.28) : x, lelongDeZ ? z : z + s * (demi - 0.28), 0.22);
      }
      continue;
    }
    // Salles : jusqu'à quatre lanternes, une par mur (deux seulement dans la salle aux cristaux, qui reste bleue)
    const points: Array<[number, number]> = [
      [zone.x0, Math.floor(zone.z0 + dz * 0.3)],
      [zone.x1 - 1, Math.floor(zone.z0 + dz * 0.7)],
      [Math.floor(zone.x0 + dx * 0.7), zone.z0],
      [Math.floor(zone.x0 + dx * 0.3), zone.z1 - 1],
    ];
    for (const [i, j] of zone.type === 'cristaux' ? points.slice(0, 2) : points) {
      if (!estCreuse(i, j) || voisinsPleins(i, j) < 3 || presDesRails(i, j)) continue;
      const m = versMur(i, j);
      if (m.x === 0 && m.z === 0) continue;
      potences.push({ x: o.x + i + 0.5 + m.x * 0.2, z: o.z + j + 0.5 + m.z * 0.2, lacet: Math.atan2(-m.x, -m.z) });
      poserPoteau(i + 0.5 + m.x * 0.2, j + 0.5 + m.z * 0.2, 0.2);
    }
  }

  // 2. Wagonnet sur les rails, dans la grande salle
  const wagonnet = { x: o.x + xr, z: o.z + zA + 9 };
  poserPoteau(xr, zA + 9, 0.8);

  // 3. Ennemis à des points fixes (positions avant miroir)
  const ennemis: PointApparition[] = [];
  const poserEnnemi = (type: PointApparition['type'], x: number, z: number) => {
    ennemis.push({ id: `e:mine:${ennemis.length}`, type, x: o.x + mx(x), z: o.z + z, nuitSeulement: false });
    occupes.push({ x: mx(x), z, r: 1 });
  };
  poserEnnemi('slime', 41 + oa, zA + 5);
  poserEnnemi('gobelin', 14, zB + 6.5);
  poserEnnemi('slime', 10, zB + 9);
  poserEnnemi('slime', 56.5, 13 + l5);
  poserEnnemi('gobelin', 31, zC + 8);

  // 4. Rochers, filons et cristaux à récolter, contre les murs (ordre fixe : identifiants stables)
  const elements: ElementDecor[] = [];
  function creerElement(type: TypeMinier, x: number, z: number): void {
    const infos = INFOS_DECOR[type];
    const [mini, maxi] = ECHELLES[type];
    const echelle = alea.entre(mini, maxi);
    elements.push({
      id: `m:${elements.length}`,
      type,
      x: o.x + x,
      y: M.altitude - infos.enfoncement * echelle,
      z: o.z + z,
      rotation: alea.entre(0, Math.PI * 2),
      echelle,
      variante: Math.min(infos.variantes - 1, Math.floor(alea.suivant() * infos.variantes)),
      teinte: alea.suivant(),
      rayonCollision: infos.rayonCollision * echelle,
    });
    occupes.push({ x, z, r: rayonMax(type) });
  }
  function poser(type: TypeMinier, zone: ZoneMine, nombre: number): void {
    let poses = 0;
    for (const [i, j] of casesContreMur(zone)) {
      if (poses >= nombre) break;
      const m = versMur(i, j);
      const x = i + 0.5 + m.x * 0.15;
      const z = j + 0.5 + m.z * 0.15;
      if (!libre(x, z, rayonMax(type))) continue;
      creerElement(type, x, z);
      poses++;
    }
  }
  // Au cœur de la salle du fond : trois gros cristaux, hors des rails
  const cx = (salleC.x0 + salleC.x1) / 2;
  const cz = (salleC.z0 + salleC.z1) / 2;
  for (const [dx, dz] of [[-3, 1], [3, 2], [-0.5, 4.5]]) creerElement('cristal-bleu', cx + dx, cz + dz);
  for (const zone of zones) {
    poser('cristal-bleu', zone, zone.contenu[2]);
    poser('filon-fer', zone, zone.contenu[1]);
    poser('rocher', zone, zone.contenu[0]);
  }
  // Filons de charbon : posés en dernier, dans la place qui reste (les identifiants des autres éléments ne bougent pas)
  for (const zone of zones) poser('filon-charbon', zone, Math.max(1, Math.ceil(zone.contenu[1] / 2)));

  // 5. Petits cristaux de décor dans les parois, en hauteur
  const cristauxDecor: CristalDecor[] = [];
  for (const zone of zones) {
    let poses = 0;
    for (const [i, j] of casesContreMur(zone)) {
      if (poses >= zone.contenu[3]) break;
      const m = versMur(i, j);
      const x = o.x + i + 0.5 + m.x * 0.42;
      const z = o.z + j + 0.5 + m.z * 0.42;
      if (cristauxDecor.some((c) => Math.hypot(c.x - x, c.z - z) < 2.5)) continue;
      cristauxDecor.push({ x, y: alea.entre(1.4, 2.5), z, lacet: Math.atan2(-m.x, -m.z), echelle: alea.entre(0.7, 1.2) });
      poses++;
    }
  }

  // Les zones passent dans le repère du monde
  const zonesMonde: ZoneMine[] = zones.map((z) => ({
    nom: z.nom,
    type: z.type,
    x0: o.x + z.x0,
    z0: o.z + z.z0,
    x1: o.x + z.x1,
    z1: o.z + z.z1,
  }));
  return {
    graine,
    origine: { x: o.x, z: o.z },
    altitude: M.altitude,
    largeur: L,
    profondeur: H,
    ouvert,
    distance,
    zones: zonesMonde,
    arrivee,
    sortie,
    elements,
    ennemis,
    portiques,
    potences,
    cristauxDecor,
    rails: { x0: o.x + xr, z0: o.z + 2.4, x1: o.x + xr, z1: o.z + zFinRails },
    wagonnet,
    poteaux,
  };
}
