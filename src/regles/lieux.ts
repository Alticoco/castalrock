// Lieux de l'histoire (étape 45) : le camp des bandits, en forêt, et les ruines de la forteresse de Castalrock, en
// montagne, avec le Cœur de Castal (un cristal géant) au milieu de leur cour. Ces ruines ont remplacé l'ancien
// « autel du Cœur » : l'identifiant interne reste `autel` (la sauvegarde en dépend).
// Leur position est cherchée sur le terrain de la graine (toujours la même pour une même graine), puis le terrain
// est aplani autour (voir `retoucheReplats` de src/monde/terrain.ts). Ce fichier décrit aussi le plan de chaque lieu
// (pieux, tentes, remparts… en coordonnées du monde), ses collisions en cercles, ce que la partie en retient
// (découvert, Morvan vaincu, Cœur reforgé) et la reforge du Cœur.
// Pur : aucun import de three, aucun Math.random(). Réglages : CONFIG.lieux.

import { CONFIG } from '../config';
import { INDICE_BIOME } from '../monde/biomes';
import { decrireForteresse } from '../monde/forteresse';
import type { Bloc } from '../monde/piecesRuines';
import type { Replat } from '../monde/terrain';
import type { ObstacleCercle } from './deplacement';
import { prendreObjets, totalPossede, type ContenantsHistoire } from './histoire';
import { definitionObjet } from './inventaire';

const L = CONFIG.lieux;

// --- Positions --------------------------------------------------------------------------------

/** Ce que la recherche lit du terrain (non retouché). */
export interface TerrainLieux {
  readonly niveauEau: number;
  hauteurBrute(x: number, z: number): number;
  poidsBiomes(x: number, z: number, sortie?: number[]): number[];
}

export interface Lieu {
  /** Centre du lieu et altitude du replat */
  readonly x: number;
  readonly z: number;
  readonly y: number;
  /** Lacet de l'accès (porte du camp, porte de la forteresse) : l'avant est (sin, cos) et regarde vers le village */
  readonly acces: number;
}

export interface Lieux {
  readonly camp: Lieu;
  readonly autel: Lieu;
}

export type IdLieu = keyof Lieux;

export const NOMS_LIEUX: Readonly<Record<IdLieu, string>> = {
  camp: 'Camp du Balafré',
  autel: 'Ruines de Castalrock',
};

// Grille de recherche : pas en mètres et demi-largeur en cases (880 m autour du village)
const PAS = 8;
const DEMI = 110;
const N = DEMI * 2 + 1;

interface Critere {
  distanceMin: number;
  distanceMax: number;
  distanceIdeale: number;
  ecartMax: number;
  /** Biome voulu (indice dans BIOMES) */
  biome: number;
  /** Points en plus par mètre d'altitude (la forteresse préfère la hauteur) */
  bonusAltitude: number;
  /** Demi-côté, en cases de 8 m, du carré où le dénivelé est mesuré (le replat) ; son raccord est mesuré sur `casesRaccord` */
  casesReplat: number;
  casesRaccord: number;
  /** Dénivelé toléré sur le raccord */
  ecartRaccordMax: number;
}

/**
 * Cases d'une grille carrée d'altitudes (`cote` × `cote`, rangée par rangée) qu'on atteint à pied depuis la case du
 * centre (la place du village) : pas d'eau (altitude sous `sec`), pas de marche plus haute que `marcheMax` entre deux
 * cases voisines. Renvoie 1 pour une case atteinte, 0 sinon. Sert aussi à chercher l'entrée de la mine.
 */
export function casesAtteignables(h: Float32Array, cote: number, sec: number, marcheMax: number): Uint8Array {
  const demi = (cote - 1) / 2;
  const atteint = new Uint8Array(cote * cote);
  const file: number[] = [demi * cote + demi];
  atteint[file[0]] = 1;
  for (let k = 0; k < file.length; k++) {
    const c = file[k];
    const a = c % cote;
    const b = (c - a) / cote;
    for (const [sa, sb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const na = a + sa;
      const nb = b + sb;
      if (na < 0 || nb < 0 || na >= cote || nb >= cote) continue;
      const n = nb * cote + na;
      if (atteint[n] || h[n] < sec || Math.abs(h[n] - h[c]) > marcheMax) continue;
      atteint[n] = 1;
      file.push(n);
    }
  }
  return atteint;
}

/**
 * Cherche le camp et la forteresse (`autel`) sur un terrain non retouché. `eviter` : points dont les lieux restent éloignés
 * (entrée de la mine, campement d'Aldric). Toujours le même résultat pour un même terrain.
 *
 * Méthode (celle de l'entrée de la mine) : altitudes relevées sur une grille, cases atteignables à pied depuis la
 * place (pas d'eau, pas de marche trop haute), puis la meilleure case : dans le bon biome, sur un sol presque plat,
 * à la bonne distance. Si aucune case du bon biome n'est atteignable, les exigences tombent l'une après l'autre.
 */
export function chercherLieux(terrain: TerrainLieux, eviter: ReadonlyArray<{ x: number; z: number }> = []): Lieux {
  const h = new Float32Array(N * N);
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) h[b * N + a] = terrain.hauteurBrute((a - DEMI) * PAS, (b - DEMI) * PAS);

  const marcheMax = PAS * Math.tan((L.penteMarcheDegres * Math.PI) / 180);
  const sec = terrain.niveauEau + 0.3;
  const atteint = casesAtteignables(h, N, sec, marcheMax);

  const poids: number[] = [];
  /** Meilleure case pour un critère. `strict` : 2 = bon biome et atteignable, 1 = atteignable, 0 = hors de l'eau seulement. */
  function meilleure(cr: Critere, loinDe: ReadonlyArray<{ x: number; z: number; distance: number }>, strict: number): { x: number; z: number; y: number } | null {
    let choix: { x: number; z: number; y: number } | null = null;
    let record = -Infinity;
    const large = cr.casesRaccord;
    const proche = cr.casesReplat;
    for (let b = large; b < N - large; b++) {
      for (let a = large; a < N - large; a++) {
        const c = b * N + a;
        if (strict >= 1 && !atteint[c]) continue;
        if (h[c] < terrain.niveauEau + 1.5) continue;
        const x = (a - DEMI) * PAS;
        const z = (b - DEMI) * PAS;
        const r = Math.hypot(x, z);
        if (r < cr.distanceMin || r > cr.distanceMax) continue;
        if (loinDe.some((p) => Math.hypot(p.x - x, p.z - z) < p.distance)) continue;
        // Dénivelé avec les cases voisines : sur le replat, puis jusqu'au bout de son raccord (plus tolérant) ;
        // aucune eau sur le replat
        let ecart = 0;
        let ecartLoin = 0;
        let plusBas = h[c];
        for (let sb = -large; sb <= large; sb++) {
          for (let sa = -large; sa <= large; sa++) {
            const v = h[(b + sb) * N + a + sa];
            const e = Math.abs(v - h[c]);
            ecartLoin = Math.max(ecartLoin, e);
            if (Math.abs(sa) <= proche && Math.abs(sb) <= proche) {
              ecart = Math.max(ecart, e);
              plusBas = Math.min(plusBas, v);
            }
          }
        }
        if (ecart > cr.ecartMax || ecartLoin > cr.ecartRaccordMax || plusBas < terrain.niveauEau + 0.5) continue;
        const w = terrain.poidsBiomes(x, z, poids)[cr.biome];
        if (strict >= 2 && w < 0.5) continue;
        const score = w * 10 - ecartLoin * 0.6 - Math.abs(r - cr.distanceIdeale) / 40 + Math.min(h[c], 60) * cr.bonusAltitude;
        if (score > record) {
          record = score;
          choix = { x, z, y: h[c] };
        }
      }
    }
    return choix;
  }

  function choisir(cr: Critere, loinDe: ReadonlyArray<{ x: number; z: number; distance: number }>, repli: { x: number; z: number }): Lieu {
    const p = meilleure(cr, loinDe, 2) ?? meilleure(cr, loinDe, 1) ?? meilleure(cr, loinDe, 0) ?? { ...repli, y: Math.max(terrain.hauteurBrute(repli.x, repli.z), terrain.niveauEau + 1.5) };
    // L'accès regarde vers le village
    return { x: p.x, z: p.z, y: p.y, acces: Math.atan2(-p.x, -p.z) };
  }

  const autres = eviter.map((p) => ({ x: p.x, z: p.z, distance: L.distanceMiniAutres }));
  const camp = choisir(
    { ...L.camp, biome: INDICE_BIOME.foret, bonusAltitude: 0, casesReplat: 2, casesRaccord: 4, ecartRaccordMax: L.camp.ecartMax * 2 },
    autres,
    { x: -L.camp.distanceIdeale, z: 0 },
  );
  // La forteresse est bien plus large que le camp : son replat et son raccord sont mesurés plus loin, et elle reste
  // plus loin de la mine et d'Aldric
  const A = L.autel;
  const autel = choisir(
    { ...A, biome: INDICE_BIOME.montagne, casesReplat: Math.ceil(A.replat / PAS), casesRaccord: Math.ceil((A.replat + A.raccord) / PAS) },
    [...eviter.map((p) => ({ x: p.x, z: p.z, distance: A.distanceMiniAutres })), { x: camp.x, z: camp.z, distance: L.distanceMiniEntreLieux }],
    { x: L.autel.distanceIdeale, z: 0 },
  );
  return { camp, autel };
}

/** Les disques à aplanir autour des lieux (pour `retoucheReplats`). */
export function replatsLieux(lieux: Lieux): Replat[] {
  return [
    { x: lieux.camp.x, z: lieux.camp.z, altitude: lieux.camp.y, rayon: L.camp.replat, raccord: L.camp.raccord },
    { x: lieux.autel.x, z: lieux.autel.z, altitude: lieux.autel.y, rayon: L.autel.replat, raccord: L.autel.raccord },
  ];
}

/** Zones où le décor généré (arbres, rochers, herbes) est retiré. */
export function zonesLibresLieux(lieux: Lieux): Array<{ x: number; z: number; rayon: number }> {
  return [
    { x: lieux.camp.x, z: lieux.camp.z, rayon: L.camp.rayonSansDecor },
    { x: lieux.autel.x, z: lieux.autel.z, rayon: L.autel.rayonSansDecor },
  ];
}

// --- Plans ------------------------------------------------------------------------------------

export interface Pose {
  readonly x: number;
  readonly z: number;
  /** Lacet de l'objet (l'avant est (sin, cos)) */
  readonly orientation: number;
}

/** Du repère du lieu (+z vers l'accès, +x à sa droite vu de l'intérieur… comme un objet three tourné de `acces`) au monde. */
function versMonde(lieu: Lieu, lx: number, lz: number, orientation = 0): Pose {
  const c = Math.cos(lieu.acces);
  const s = Math.sin(lieu.acces);
  return { x: lieu.x + lx * c + lz * s, z: lieu.z - lx * s + lz * c, orientation: orientation + lieu.acces };
}

/** Point à `distance` du centre, à l'angle `phi` de l'accès (repère du lieu). */
function polaire(lieu: Lieu, phi: number, distance: number, orientation = 0): Pose {
  return versMonde(lieu, Math.sin(phi) * distance, Math.cos(phi) * distance, orientation);
}

export interface PlanCamp {
  readonly lieu: Lieu;
  /** Pieux de la palissade (l'ouverture est du côté de l'accès) */
  readonly pieux: readonly Pose[];
  /** Les deux poteaux de la porte */
  readonly poteaux: readonly Pose[];
  /** Tentes : leur ouverture regarde le feu */
  readonly tentes: readonly Pose[];
  readonly feu: Pose;
  readonly tour: Pose;
  readonly caisses: ReadonlyArray<Pose & { readonly type: 'caisse' | 'tonneau' }>;
  readonly ratelier: Pose;
  readonly drapeau: Pose;
  /** Coffres de butin (ouverts une fois, avec E) : `camp:coffre:0` est celui de Morvan ; ils font face au feu */
  readonly coffres: ReadonlyArray<Pose & { readonly id: string }>;
  /** Où se tiennent Morvan, ses gardes, et où arrivent les renforts */
  readonly posteMorvan: Pose;
  readonly postesGardes: readonly Pose[];
  readonly postesRenforts: readonly Pose[];
  /** Devant la porte, dehors, face au camp (téléportation de test) */
  readonly arrivee: Pose;
}

const CAISSES: ReadonlyArray<readonly [number, number, 'caisse' | 'tonneau']> = [
  [2.3, 9.2, 'caisse'],
  [3.8, 9.0, 'tonneau'],
  [3.95, 9.6, 'tonneau'],
  [1.25, 9.6, 'caisse'],
  [1.38, 10.5, 'tonneau'],
  [-1.2, 10.1, 'caisse'],
  [-1.32, 9.2, 'caisse'],
  [-1.05, 10.7, 'tonneau'],
];

/** Position des coffres de butin dans le repère du camp : devant la tente de Morvan, puis à côté des deux autres tentes. */
const COFFRES: ReadonlyArray<readonly [number, number]> = [
  [-1.6, -4.6],
  [5.6, -4.9],
  [-5.6, -4.9],
];

export function decrireCamp(lieu: Lieu): PlanCamp {
  const C = L.camp;
  const R = C.rayonPalissade;
  // Demi-angle de l'ouverture, et pieux répartis sur le reste du cercle
  const demiPorte = Math.asin(C.largeurPorte / 2 / R);
  const arc = 2 * Math.PI - 2 * demiPorte;
  const nombre = Math.max(8, Math.round((arc * R) / C.ecartPieux));
  const pieux: Pose[] = [];
  for (let i = 1; i < nombre; i++) {
    const phi = demiPorte + (arc * i) / nombre;
    pieux.push(polaire(lieu, phi, R, phi));
  }
  const postesGardes = [
    versMonde(lieu, 4, 4.5),
    versMonde(lieu, -4, 4.5),
    versMonde(lieu, 3.2, -5.5),
    versMonde(lieu, -3.2, -5.5),
  ].slice(0, C.gardes);
  return {
    lieu,
    pieux,
    poteaux: [polaire(lieu, demiPorte, R, demiPorte), polaire(lieu, -demiPorte, R, -demiPorte)],
    tentes: [Math.PI, 1.95, -1.95].map((phi) => polaire(lieu, phi, 7.7, phi + Math.PI)),
    feu: versMonde(lieu, 0, 0),
    tour: polaire(lieu, 0.62, 9.3, 0.62 + Math.PI),
    caisses: CAISSES.map(([phi, d, type], i) => ({ ...polaire(lieu, phi, d, phi * 3 + i), type })),
    ratelier: polaire(lieu, -0.95, 8.2, -0.95 + Math.PI),
    drapeau: polaire(lieu, Math.PI - 0.55, 9.9),
    coffres: COFFRES.map(([lx, lz], i) => ({ ...versMonde(lieu, lx, lz, Math.atan2(-lx, -lz)), id: `camp:coffre:${i}` })),
    posteMorvan: versMonde(lieu, 0, -3.6),
    postesGardes,
    postesRenforts: Array.from({ length: CONFIG.chefs.morvan.renforts }, (_, i) => versMonde(lieu, (i % 2 === 0 ? 1 : -1) * (1.2 + Math.floor(i / 2)), R - 2.5)),
    arrivee: versMonde(lieu, 0, R + 7, Math.PI),
  };
}

export interface PlanAutel {
  readonly lieu: Lieu;
  /** Rayon de l'enceinte de la forteresse (ses six angles, où sont les tours) */
  readonly rayonEnceinte: number;
  /** Rayon du berceau de pierre du Cœur, au centre de la cour (collision) */
  readonly rayonBerceau: number;
  /** Rayon du point d'interaction du Cœur : plus large que le berceau, pour reforger en voyant le cristal */
  readonly rayonInteraction: number;
  /** Petits cristaux qui poussent autour du berceau */
  readonly petitsCristaux: readonly Pose[];
  /** Pierres, mousse et lierre des ruines, dans le repère du lieu (un objet three placé au centre et tourné de `acces`) */
  readonly blocs: readonly Bloc[];
  /** Collisions des ruines (remparts, tours, colonnes, escaliers, gros blocs), en coordonnées du monde */
  readonly murs: readonly ObstacleCercle[];
  /** Milieu de la porte en arche */
  readonly porte: Pose;
  /** Devant la porte, dehors, face à la forteresse (téléportation de test) */
  readonly arrivee: Pose;
}

/** Plan des ruines de la forteresse de Castalrock (détail des pierres : src/monde/forteresse.ts). */
export function decrireAutel(lieu: Lieu): PlanAutel {
  const F = L.autel.forteresse;
  const forteresse = decrireForteresse();
  return {
    lieu,
    rayonEnceinte: F.rayonEnceinte,
    rayonBerceau: F.rayonBerceau,
    rayonInteraction: F.rayonInteraction,
    petitsCristaux: [0, 1, 2, 3].map((k) => polaire(lieu, Math.PI / 4 + 0.32 + (k * Math.PI) / 2, F.rayonBerceau + 1.7, k * 1.3)),
    blocs: forteresse.blocs,
    murs: forteresse.obstacles.map((o) => {
      const p = versMonde(lieu, o.x, o.z);
      return { x: p.x, z: p.z, rayon: o.rayon };
    }),
    porte: versMonde(lieu, forteresse.porte.x, forteresse.porte.z, Math.PI),
    arrivee: versMonde(lieu, forteresse.porte.x, forteresse.porte.z + 8, Math.PI),
  };
}

/** Collisions du camp, en cercles : pieux, poteaux, tentes (deux cercles chacune), feu, tour, caisses, râtelier, mât. */
export function obstaclesCamp(plan: PlanCamp): ObstacleCercle[] {
  const C = L.camp;
  const cercles: ObstacleCercle[] = [];
  for (const p of plan.pieux) cercles.push({ x: p.x, z: p.z, rayon: C.rayonPieu });
  for (const p of plan.poteaux) cercles.push({ x: p.x, z: p.z, rayon: 0.42 });
  for (const t of plan.tentes) {
    for (const d of [-1, 1]) cercles.push({ x: t.x + Math.sin(t.orientation) * d, z: t.z + Math.cos(t.orientation) * d, rayon: 1.55 });
  }
  cercles.push({ x: plan.feu.x, z: plan.feu.z, rayon: 0.95 });
  cercles.push({ x: plan.tour.x, z: plan.tour.z, rayon: 1.35 });
  for (const c of plan.caisses) cercles.push({ x: c.x, z: c.z, rayon: 0.5 });
  cercles.push({ x: plan.ratelier.x, z: plan.ratelier.z, rayon: 0.8 });
  cercles.push({ x: plan.drapeau.x, z: plan.drapeau.z, rayon: 0.2 });
  for (const c of plan.coffres) cercles.push({ x: c.x, z: c.z, rayon: CONFIG.ruines.coffre.rayon });
  return cercles;
}

/** Collisions de la forteresse : berceau du grand cristal, petits cristaux, puis les ruines. */
export function obstaclesAutel(plan: PlanAutel): ObstacleCercle[] {
  const cercles: ObstacleCercle[] = [{ x: plan.lieu.x, z: plan.lieu.z, rayon: plan.rayonBerceau }];
  for (const p of plan.petitsCristaux) cercles.push({ x: p.x, z: p.z, rayon: 0.6 });
  cercles.push(...plan.murs);
  return cercles;
}

/**
 * Prépare la recherche des obstacles des lieux autour d'un point : la fonction renvoyée donne ceux qui sont à moins de
 * `rayon` mètres (vide, sans rien parcourir, loin des deux lieux).
 */
export function creerObstaclesLieux(camp: PlanCamp, autel: PlanAutel): (x: number, z: number, rayon: number) => ObstacleCercle[] {
  const groupes = [
    { x: camp.lieu.x, z: camp.lieu.z, portee: L.camp.rayonPalissade + 2, cercles: obstaclesCamp(camp) },
    { x: autel.lieu.x, z: autel.lieu.z, portee: L.autel.replat, cercles: obstaclesAutel(autel) },
  ];
  return (x, z, rayon) => {
    const proches: ObstacleCercle[] = [];
    for (const g of groupes) {
      if (Math.hypot(x - g.x, z - g.z) > g.portee + rayon) continue;
      for (const c of g.cercles) if (Math.hypot(x - c.x, z - c.z) <= rayon + c.rayon) proches.push(c);
    }
    return proches;
  };
}

// --- État de la partie ------------------------------------------------------------------------

/** Ce que la partie retient des lieux (sauvegardé). */
export interface EtatLieux {
  readonly campDecouvert: boolean;
  readonly autelDecouvert: boolean;
  /** Morvan le Balafré a été vaincu : il ne réapparaît plus */
  readonly morvanVaincu: boolean;
  /** Le Cœur de Castal a été reforgé, dans les ruines de la forteresse */
  readonly coeurReforge: boolean;
}

export function creerEtatLieux(): EtatLieux {
  return { campDecouvert: false, autelDecouvert: false, morvanVaincu: false, coeurReforge: false };
}

/** Lit un état sauvegardé : `null` s'il est abîmé. */
export function lireEtatLieux(v: unknown): EtatLieux | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { campDecouvert, autelDecouvert, morvanVaincu, coeurReforge } = v as Record<string, unknown>;
  if (typeof campDecouvert !== 'boolean' || typeof autelDecouvert !== 'boolean') return null;
  if (typeof morvanVaincu !== 'boolean' || typeof coeurReforge !== 'boolean') return null;
  return { campDecouvert, autelDecouvert, morvanVaincu, coeurReforge };
}

/** Lieux découverts, pour les étapes d'histoire « découvrir ». */
export function lieuxDecouverts(etat: EtatLieux): IdLieu[] {
  const liste: IdLieu[] = [];
  if (etat.campDecouvert) liste.push('camp');
  if (etat.autelDecouvert) liste.push('autel');
  return liste;
}

/** Le joueur est en (x, z) : marque les lieux dont il est assez près. Renvoie le même objet si rien ne change. */
export function decouvrir(etat: EtatLieux, lieux: Lieux, x: number, z: number): { etat: EtatLieux; nouveaux: IdLieu[] } {
  const nouveaux: IdLieu[] = [];
  if (!etat.campDecouvert && Math.hypot(x - lieux.camp.x, z - lieux.camp.z) <= L.camp.distanceDecouverte) nouveaux.push('camp');
  if (!etat.autelDecouvert && Math.hypot(x - lieux.autel.x, z - lieux.autel.z) <= L.autel.distanceDecouverte) nouveaux.push('autel');
  if (nouveaux.length === 0) return { etat, nouveaux };
  return {
    etat: { ...etat, campDecouvert: etat.campDecouvert || nouveaux.includes('camp'), autelDecouvert: etat.autelDecouvert || nouveaux.includes('autel') },
    nouveaux,
  };
}

/** Prochain lieu de l'histoire (touche de test F8) : le camp tant que Morvan est en vie, puis les ruines de Castalrock. */
export function prochainLieu(etat: EtatLieux): IdLieu {
  return etat.morvanVaincu ? 'autel' : 'camp';
}

// --- Reforge du Cœur --------------------------------------------------------------------------

export type ResultatReforge =
  | { readonly ok: true; readonly etat: EtatLieux; readonly contenants: ContenantsHistoire }
  | { readonly ok: false; readonly message: string };

/** « Éclat du Cœur × 1 », « cristal bleu × 10 »… : ce qu'il manque encore, ou une liste vide. */
export function manqueReforge(contenants: ContenantsHistoire): string[] {
  return L.autel.cout
    .map((o) => ({ o, manque: o.quantite - totalPossede(contenants, o.objet) }))
    .filter(({ manque }) => manque > 0)
    .map(({ o, manque }) => `${definitionObjet(o.objet).nom} × ${manque}`);
}

/** Texte de l'invite devant le Cœur de Castal. */
export function inviteAutel(etat: EtatLieux): string {
  return etat.coeurReforge ? 'contempler le Cœur de Castal' : 'reforger le Cœur';
}

/**
 * Touche E devant le cristal : si tout y est (Éclat du Cœur, cristaux, acier ; inventaire, coffre et sac comptent), les
 * objets sont pris et le Cœur est reforgé, pour toujours. Sinon, un message dit ce qu'il manque.
 */
export function reforgerCoeur(etat: EtatLieux, contenants: ContenantsHistoire): ResultatReforge {
  if (etat.coeurReforge) return { ok: false, message: 'Le Cœur de Castal bat de nouveau' };
  const manque = manqueReforge(contenants);
  if (manque.length > 0) return { ok: false, message: `Il manque : ${manque.join(', ')}` };
  return { ok: true, etat: { ...etat, coeurReforge: true }, contenants: prendreObjets(contenants, L.autel.cout) };
}
