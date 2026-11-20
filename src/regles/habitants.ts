// Habitants du village : qui est là, où chacun se tient selon l'heure (poste le jour, veillée le soir,
// chez soi la nuit), et comment il s'y rend (points de passage qui contournent les bâtiments).
// Pur : aucun import de three, aucun Math.random(). Rien n'est sauvegardé : tout se recalcule à partir
// de l'heure du jeu. Les modèles sont dans src/scene/modelesHabitants.ts, le branchement dans src/jeu/habitants.ts.
// Repère et orientation : ceux du village (lacet en radians, l'avant regarde vers (sin(o), cos(o))).

import { CONFIG } from '../config';
import { creerAleatoire } from './aleatoire';
import { ramener24 } from './temps';
import type { ObstacleCercle, ObstacleRectangle } from './deplacement';
import {
  MAISON_JOUEUR,
  decrireVillage,
  obstaclesElement,
  pointLocal,
  type ElementVillage,
  type NiveauVillage,
  type ObstaclesVillage,
} from './village';

export type IdHabitant = 'gaspard' | 'marthe' | 'mathilde' | 'bertil' | 'hugo' | 'aldric';

/** Tous les habitants, dans un ordre fixe (6 au plus). */
export const HABITANTS: readonly IdHabitant[] = ['gaspard', 'marthe', 'mathilde', 'bertil', 'hugo', 'aldric'];

export const NOMS_HABITANTS: Record<IdHabitant, string> = {
  gaspard: 'Gaspard',
  marthe: 'Marthe',
  mathilde: 'Mathilde',
  bertil: 'Bertil',
  hugo: 'Hugo',
  aldric: 'Aldric',
};

export type ReglagesHabitants = typeof CONFIG.habitants;

export type PeriodeHabitant = 'jour' | 'soir' | 'nuit';

export interface Point {
  x: number;
  z: number;
}

/** Un endroit où un habitant s'arrête : il y regarde vers `orientation` et y fait (ou non) son activité. */
export interface Poste extends Point {
  orientation: number;
  activite: boolean;
}

export interface LieuxHabitant {
  jour: Poste[];
  soir: Poste[];
  /** Devant la porte de sa maison : il y disparaît la nuit. `null` : il ne rentre jamais (Aldric). */
  porte: Point | null;
  /** Identifiant du bâtiment où il dort (`null` : aucun) */
  maison: string | null;
  /** Devant l'auberge : il y passe la nuit quand sa maison est endommagée (`null` : pas d'auberge) */
  refuge: Point | null;
}

/** Période de la routine à une heure donnée (la nuit passe minuit). */
export function periodeDeLHeure(heure: number, r: ReglagesHabitants = CONFIG.habitants): PeriodeHabitant {
  const h = ramener24(heure);
  if (h >= r.debutNuit || h < r.debutJour) return 'nuit';
  return h < r.debutSoir ? 'jour' : 'soir';
}

/** Habitants qui existent à ce niveau du village : Hugo n'arrive qu'au niveau 2 ; Aldric vit dans la forêt. */
export function habitantsPresents(niveau: NiveauVillage): IdHabitant[] {
  return HABITANTS.filter((id) => id !== 'hugo' || niveau >= 2);
}

// --- Lieux ------------------------------------------------------------------------------------

/** Distance entre la façade et le point où un habitant disparaît, devant sa porte, en mètres */
const RECUL_PORTE = 0.8;

const vers = (de: Point, cible: Point): number => Math.atan2(cible.x - de.x, cible.z - de.z);
const poste = (p: Point, orientation: number, activite = false): Poste => ({ x: p.x, z: p.z, orientation, activite });
/** Poste qui regarde un point (un objet, le centre de la place…). */
const posteVers = (p: Point, cible: Point, activite = false): Poste => poste(p, vers(p, cible), activite);

/** Décalage de la porte le long de la façade, selon le bâtiment. */
function decalagePorte(b: ElementVillage): number {
  if (b.type === 'maison-joueur') return MAISON_JOUEUR.porteX;
  return b.type === 'auberge' ? -0.5 : 0;
}

/** Pied de la porte de chaque bâtiment où l'on entre (maisons, auberge), maison du joueur comprise. */
export function portesVillage(niveau: NiveauVillage): Point[] {
  return decrireVillage(niveau)
    .elements.filter((el) => el.type.startsWith('maison') || el.type === 'auberge')
    .map((b) => pointLocal(b, decalagePorte(b), b.demiProfondeur));
}

/** Campement d'Aldric : le feu au centre, le rocher où s'asseoir à côté. */
export function campementAldric(r: ReglagesHabitants = CONFIG.habitants): { feu: ObstacleCercle; rocher: ObstacleCercle } {
  const { x, z } = r.aldric;
  return { feu: { x, z, rayon: 0.5 }, rocher: { x: x + 1.55, z: z + 0.55, rayon: 0.55 } };
}

/** Place de la cabane d'Aldric (le modèle est à part) : son centre, sa façade tournée vers le feu et son obstacle rectangulaire. */
export function cabaneAldric(r: ReglagesHabitants = CONFIG.habitants): { x: number; z: number; orientation: number; obstacle: ObstacleRectangle } {
  const { x, z, cabane } = r.aldric;
  const cx = x + cabane.dx;
  const cz = z + cabane.dz;
  return {
    x: cx,
    z: cz,
    orientation: cabane.orientation,
    obstacle: { x: cx, z: cz, demiLargeur: cabane.demiLargeur, demiProfondeur: cabane.demiProfondeur, angle: cabane.orientation },
  };
}

const CENTRE: Point = { x: 0, z: 0 };

function calculerLieux(id: IdHabitant, niveau: NiveauVillage, r: ReglagesHabitants): LieuxHabitant {
  if (id === 'aldric') {
    const { feu } = campementAldric(r);
    const postes = [
      posteVers({ x: feu.x - 1.35, z: feu.z + 0.65 }, feu, true),
      posteVers({ x: feu.x + 0.35, z: feu.z - 1.75 }, feu),
    ];
    return { jour: postes, soir: postes, porte: null, maison: null, refuge: null };
  }

  const elements = decrireVillage(niveau).elements;
  const el = (idElement: string): ElementVillage | undefined => elements.find((e) => e.id === idElement);
  const devantPorte = (b: ElementVillage): Point => pointLocal(b, decalagePorte(b), b.demiProfondeur + RECUL_PORTE);
  const maison2 = el('maison-2') as ElementVillage;
  const auberge = el('auberge');
  const feu = el('feu-camp') as ElementVillage;
  const puits = el('puits') as ElementVillage;

  // Le soir : en cercle devant l'auberge, ou autour du feu de camp de la place tant qu'il n'y a pas d'auberge
  const rang = HABITANTS.indexOf(id);
  let soir: Poste;
  if (auberge) {
    const centre = pointLocal(auberge, 2.4, 7.4);
    const a = auberge.orientation + ((36 + rang * 72) * Math.PI) / 180;
    soir = posteVers({ x: centre.x + Math.sin(a) * 1.7, z: centre.z + Math.cos(a) * 1.7 }, centre, id === 'gaspard');
  } else {
    // Angles choisis entre les souches
    const a = ([2, 105, 155, 256][rang % 4] * Math.PI) / 180;
    soir = posteVers({ x: feu.x + Math.sin(a) * 2.1, z: feu.z + Math.cos(a) * 2.1 }, feu, id === 'gaspard');
  }

  const refuge = auberge ? devantPorte(auberge) : null;
  const avecMaison = (l: { jour: Poste[]; soir: Poste[]; porte: Point }, b: ElementVillage): LieuxHabitant => ({ ...l, maison: b.id, refuge });
  switch (id) {
    case 'gaspard': {
      // La place et le puits ; au niveau 3, il loge dans la première maison de tuiles
      const panneau = el('panneau') as ElementVillage;
      const logis = el('maison-4') ?? maison2;
      return avecMaison(
        {
          jour: [
            poste({ x: -1.8, z: 0.2 }, 0, true),
            posteVers({ x: -2.7, z: 2.9 }, puits),
            posteVers({ x: -0.6, z: -5.6 }, panneau),
          ],
          soir: [soir],
          porte: devantPorte(logis),
        },
        logis,
      );
    }
    case 'marthe': {
      if (!auberge) {
        // Pas encore d'auberge : elle s'occupe du feu de la place
        return avecMaison({ jour: [posteVers({ x: 4.7, z: -2.6 }, feu, true), posteVers({ x: 5.2, z: 2.6 }, CENTRE)], soir: [soir], porte: devantPorte(maison2) }, maison2);
      }
      // Devant l'auberge : la table des tonneaux qu'elle essuie, le banc, le pas de la porte
      const p1 = pointLocal(auberge, -1.9, 5.9);
      const p2 = pointLocal(auberge, 3.0, 5.9);
      const p3 = pointLocal(auberge, 0.9, 7.6);
      return avecMaison(
        {
          jour: [
            posteVers(p1, pointLocal(auberge, -2.8, 4.65), true),
            posteVers(p2, pointLocal(auberge, 3, 4.5)),
            poste(p3, auberge.orientation),
          ],
          soir: [soir],
          porte: devantPorte(auberge),
        },
        auberge,
      );
    }
    case 'mathilde': {
      // Les herbes au pied de sa maison ; dès le niveau 2, le potager
      const m1 = pointLocal(maison2, 2.0, 4.3);
      const m2 = pointLocal(maison2, -1.9, 4.6);
      const potager = el('potager');
      const jour = potager
        ? [
            poste({ x: potager.x, z: potager.z - potager.demiProfondeur - 0.75 }, 0, true),
            poste({ x: potager.x + potager.demiLargeur + 0.8, z: potager.z + 0.2 }, -Math.PI / 2, true),
            posteVers(m1, CENTRE),
          ]
        : [
            posteVers(m1, pointLocal(maison2, 2.4, 3.0), true),
            posteVers(m2, pointLocal(maison2, -2.4, 3.2), true),
            posteVers({ x: -6.6, z: 3.4 }, puits),
          ];
      return avecMaison({ jour, soir: [soir], porte: devantPorte(maison2) }, maison2);
    }
    case 'bertil': {
      // L'enclume (de profil vu de la place), puis une pause devant la forge
      const forge = el('forge') as ElementVillage;
      const logis = el('maison-5') ?? maison2;
      return avecMaison(
        {
          jour: [poste(pointLocal(forge, 0, 1.6), forge.orientation + Math.PI / 2, true), poste(pointLocal(forge, -1.3, 4.0), forge.orientation)],
          soir: [soir],
          porte: devantPorte(logis),
        },
        logis,
      );
    }
    case 'hugo': {
      // Devant chez lui (maison-3), au guet près de la sortie sud, puis sur le chemin de la place
      const maison3 = el('maison-3') ?? maison2;
      return avecMaison(
        {
          jour: [posteVers(pointLocal(maison3, 1.9, 4.3), CENTRE), poste({ x: 2.6, z: 23 }, 0, true), posteVers({ x: 4.6, z: 13.6 }, CENTRE)],
          soir: [soir],
          porte: devantPorte(maison3),
        },
        maison3,
      );
    }
  }
}

const cacheLieux = new Map<string, LieuxHabitant>();

/** Lieux d'un habitant à ce niveau du village. Le résultat est gardé en mémoire : ne pas le modifier. */
export function lieuxHabitant(id: IdHabitant, niveau: NiveauVillage, r: ReglagesHabitants = CONFIG.habitants): LieuxHabitant {
  if (r !== CONFIG.habitants) return calculerLieux(id, niveau, r);
  const cle = `${id}/${niveau}`;
  let lieux = cacheLieux.get(cle);
  if (!lieux) {
    lieux = calculerLieux(id, niveau, r);
    cacheLieux.set(cle, lieux);
  }
  return lieux;
}

// --- Obstacles et chemins ---------------------------------------------------------------------

/** Obstacles du village sans le forgeron fixe : Bertil est un habitant qui se déplace. */
export function obstaclesSansForgeron(niveau: NiveauVillage): ObstaclesVillage {
  const tout: ObstaclesVillage = { cercles: [], rectangles: [] };
  for (const el of decrireVillage(niveau).elements) {
    if (el.type === 'forgeron') continue;
    const o = obstaclesElement(el);
    tout.cercles.push(...o.cercles);
    tout.rectangles.push(...o.rectangles);
  }
  return tout;
}

function dansRectangle(p: Point, o: ObstacleRectangle, marge: number): boolean {
  const c = Math.cos(o.angle);
  const s = Math.sin(o.angle);
  const dx = p.x - o.x;
  const dz = p.z - o.z;
  return Math.abs(dx * c - dz * s) < o.demiLargeur + marge && Math.abs(dx * s + dz * c) < o.demiProfondeur + marge;
}

const dansCercle = (p: Point, o: ObstacleCercle, marge: number): boolean => Math.hypot(p.x - o.x, p.z - o.z) < o.rayon + marge;

/** Vrai si un habitant peut se tenir en `p` : à plus de `marge` mètres de tout obstacle. */
export function pointLibre(p: Point, obstacles: ObstaclesVillage, marge: number): boolean {
  return !obstacles.cercles.some((o) => dansCercle(p, o, marge)) && !obstacles.rectangles.some((o) => dansRectangle(p, o, marge));
}

function segmentCoupeCercle(a: Point, b: Point, o: ObstacleCercle, marge: number): boolean {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const l2 = dx * dx + dz * dz;
  const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / l2)) : 0;
  return Math.hypot(a.x + dx * t - o.x, a.z + dz * t - o.z) < o.rayon + marge;
}

function segmentCoupeRectangle(a: Point, b: Point, o: ObstacleRectangle, marge: number): boolean {
  const c = Math.cos(o.angle);
  const s = Math.sin(o.angle);
  // Les deux bouts dans le repère du rectangle, puis découpage du segment par ses quatre côtés
  const ax = (a.x - o.x) * c - (a.z - o.z) * s;
  const az = (a.x - o.x) * s + (a.z - o.z) * c;
  const dx = (b.x - o.x) * c - (b.z - o.z) * s - ax;
  const dz = (b.x - o.x) * s + (b.z - o.z) * c - az;
  const hx = o.demiLargeur + marge;
  const hz = o.demiProfondeur + marge;
  let t0 = 0;
  let t1 = 1;
  const cotes: Array<[number, number]> = [
    [-dx, ax + hx],
    [dx, hx - ax],
    [-dz, az + hz],
    [dz, hz - az],
  ];
  for (const [p, q] of cotes) {
    if (Math.abs(p) < 1e-12) {
      if (q <= 0) return false;
      continue;
    }
    const t = q / p;
    if (p < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 >= t1) return false;
  }
  return true;
}

/** Marge réduite pour un obstacle que l'un des bouts du segment touche déjà (poste collé à l'enclume, à un mur). */
const MARGE_CONTACT = 0.02;

/**
 * Vrai si l'on peut marcher tout droit de `a` à `b` en restant à `marge` mètres des obstacles.
 * Un obstacle dont la marge contient déjà un des deux bouts n'est compté que pour sa forme réelle.
 */
export function segmentLibre(a: Point, b: Point, obstacles: ObstaclesVillage, marge: number): boolean {
  for (const o of obstacles.cercles) {
    const m = dansCercle(a, o, marge) || dansCercle(b, o, marge) ? MARGE_CONTACT : marge;
    if (segmentCoupeCercle(a, b, o, m)) return false;
  }
  for (const o of obstacles.rectangles) {
    const m = dansRectangle(a, o, marge) || dansRectangle(b, o, marge) ? MARGE_CONTACT : marge;
    if (segmentCoupeRectangle(a, b, o, m)) return false;
  }
  return true;
}

/** Réseau de points de passage : les coins dégagés autour de chaque obstacle. Les liens se calculent à la demande. */
export interface Reseau {
  obstacles: ObstaclesVillage;
  marge: number;
  noeuds: Point[];
  /** Lien entre deux nœuds : 0 inconnu, 1 libre, 2 coupé */
  liens: Int8Array;
}

/**
 * Construit le réseau : quatre points autour de chaque obstacle de `contournes` (par défaut tous),
 * à distance de marche. `obstacles` sert à vérifier que l'on ne traverse rien.
 */
export function creerReseau(obstacles: ObstaclesVillage, r: ReglagesHabitants = CONFIG.habitants, contournes: ObstaclesVillage = obstacles): Reseau {
  const marge = r.rayon + r.margeObstacles;
  const ecart = marge + 0.35;
  const noeuds: Point[] = [];
  const ajouter = (p: Point) => {
    if (pointLibre(p, obstacles, marge)) noeuds.push(p);
  };
  for (const o of contournes.rectangles) {
    const repere = { x: o.x, z: o.z, orientation: o.angle };
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ajouter(pointLocal(repere, sx * (o.demiLargeur + ecart), sz * (o.demiProfondeur + ecart)));
  }
  for (const o of contournes.cercles) {
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) ajouter({ x: o.x + sx * (o.rayon + ecart), z: o.z + sz * (o.rayon + ecart) });
  }
  return { obstacles, marge, noeuds, liens: new Int8Array(noeuds.length * noeuds.length) };
}

const cacheReseaux = new Map<string, Reseau>();

/** Réseau où marche un habitant : celui du village à ce niveau, ou celui du campement pour Aldric. */
export function reseauHabitant(id: IdHabitant, niveau: NiveauVillage): Reseau {
  const cle = id === 'aldric' ? 'aldric' : `village/${niveau}`;
  let reseau = cacheReseaux.get(cle);
  if (reseau) return reseau;
  if (id === 'aldric') {
    const { feu, rocher } = campementAldric();
    reseau = creerReseau({ cercles: [feu, rocher], rectangles: [cabaneAldric().obstacle] });
  } else {
    // L'enceinte (clôture, muret) bloque le passage mais on ne la contourne pas : les sorties suffisent
    const contournes: ObstaclesVillage = { cercles: [], rectangles: [] };
    for (const el of decrireVillage(niveau).elements) {
      if (el.type === 'forgeron' || el.type === 'cloture' || el.type === 'muret') continue;
      const o = obstaclesElement(el);
      contournes.cercles.push(...o.cercles);
      contournes.rectangles.push(...o.rectangles);
    }
    reseau = creerReseau(obstaclesSansForgeron(niveau), CONFIG.habitants, contournes);
  }
  cacheReseaux.set(cle, reseau);
  return reseau;
}

/**
 * Chemin de `depart` à `arrivee` : la suite des points à rejoindre (le départ n'y est pas, l'arrivée est le dernier).
 * Tout droit si rien ne gêne, sinon le plus court par les points de passage. Sans solution : tout droit.
 */
export function tracerChemin(reseau: Reseau, depart: Point, arrivee: Point): Point[] {
  const { obstacles, marge, noeuds, liens } = reseau;
  if (segmentLibre(depart, arrivee, obstacles, marge)) return [arrivee];
  const n = noeuds.length;
  const DEPART = n;
  const ARRIVEE = n + 1;
  const point = (i: number): Point => (i === DEPART ? depart : i === ARRIVEE ? arrivee : noeuds[i]);
  const libre = (i: number, j: number): boolean => {
    if (i >= n || j >= n) return segmentLibre(point(i), point(j), obstacles, marge);
    const cle = i < j ? i * n + j : j * n + i;
    if (liens[cle] === 0) liens[cle] = segmentLibre(noeuds[i], noeuds[j], obstacles, marge) ? 1 : 2;
    return liens[cle] === 1;
  };
  // Plus court chemin (Dijkstra) sur les nœuds, le départ et l'arrivée
  const distance = new Float64Array(n + 2).fill(Infinity);
  const precedent = new Int32Array(n + 2).fill(-1);
  const fait = new Uint8Array(n + 2);
  distance[DEPART] = 0;
  for (;;) {
    let i = -1;
    for (let k = 0; k < n + 2; k++) if (!fait[k] && distance[k] < Infinity && (i < 0 || distance[k] < distance[i])) i = k;
    if (i < 0 || i === ARRIVEE) break;
    fait[i] = 1;
    const pi = point(i);
    for (let j = 0; j < n + 2; j++) {
      if (fait[j] || j === DEPART) continue;
      const pj = point(j);
      const d = distance[i] + Math.hypot(pj.x - pi.x, pj.z - pi.z);
      if (d >= distance[j] || !libre(i, j)) continue;
      distance[j] = d;
      precedent[j] = i;
    }
  }
  if (precedent[ARRIVEE] < 0) return [arrivee];
  const chemin: Point[] = [];
  for (let i = ARRIVEE; i !== DEPART; i = precedent[i]) chemin.unshift(point(i));
  return chemin;
}

// --- Routine ----------------------------------------------------------------------------------

/** `poste` : arrêté à un poste ; `marche` : en route ; `chez-soi` : rentré, invisible. */
export type ModeHabitant = 'poste' | 'marche' | 'chez-soi';

export interface EtatHabitant {
  id: IdHabitant;
  x: number;
  z: number;
  orientation: number;
  /** Faux la nuit, une fois rentré chez lui */
  visible: boolean;
  mode: ModeHabitant;
  /** Période de sa destination actuelle */
  periode: PeriodeHabitant;
  /** Rang du poste où il est, ou vers lequel il marche, dans la liste de la période */
  poste: number;
  /** Points qu'il lui reste à rejoindre */
  chemin: Point[];
  /** Secondes qu'il lui reste à passer à son poste */
  attente: number;
  /** Nombre de postes déjà tenus : sert à tirer la durée du suivant */
  compteur: number;
  /** Vitesse du moment, en m/s (0 à l'arrêt) : pour l'animation */
  vitesse: number;
  /** Vrai quand il fait l'activité de son poste (personne à qui parler) */
  activite: boolean;
  /** Vrai quand il s'est tourné vers le joueur */
  versJoueur: boolean;
  /** Lacet de la tête par rapport au corps, en radians : elle suit le joueur quand il est proche */
  regard: number;
}

export interface EnvironnementHabitants {
  niveau: NiveauVillage;
  /** Heure du jeu, de 0 à 24 */
  heure: number;
  /** Position du joueur, ou `null` s'il n'est pas là (dans la mine, dans sa maison) */
  joueur: Point | null;
  /** Bâtiments endommagés (identifiants) : leurs habitants passent la nuit à l'auberge */
  endommagees?: ReadonlySet<string>;
}

/** Où un habitant passe la nuit : devant la porte de l'auberge si sa maison est endommagée, sinon devant la sienne. */
export function porteDeNuit(lieux: LieuxHabitant, endommagees?: ReadonlySet<string>): Point | null {
  return lieux.maison !== null && lieux.refuge !== null && endommagees?.has(lieux.maison) ? lieux.refuge : lieux.porte;
}

const ecartAngle = (de: number, a: number): number => {
  const d = (a - de) % (2 * Math.PI);
  return d > Math.PI ? d - 2 * Math.PI : d < -Math.PI ? d + 2 * Math.PI : d;
};

/** Fait pivoter `actuel` vers `cible` d'au plus `pas` radians, par le plus court. */
export function tournerVers(actuel: number, cible: number, pas: number): number {
  const d = ecartAngle(actuel, cible);
  return Math.abs(d) <= pas ? cible : actuel + Math.sign(d) * pas;
}

/** Durée passée au `compteur`-ième poste d'un habitant : tirée de la graine, toujours la même. */
export function dureePoste(id: IdHabitant, compteur: number, r: ReglagesHabitants = CONFIG.habitants): number {
  return creerAleatoire(r.graine + HABITANTS.indexOf(id) * 7919 + compteur * 104729).entre(r.dureePosteMin, r.dureePosteMax);
}

/** Période suivie par un habitant : Aldric ne quitte jamais son campement. */
const periodeHabitant = (id: IdHabitant, heure: number, r: ReglagesHabitants): PeriodeHabitant =>
  id === 'aldric' ? 'jour' : periodeDeLHeure(heure, r);

/** État d'un habitant placé directement là où l'heure le veut (début de partie, chargement, changement de niveau). */
export function creerEtatHabitant(
  id: IdHabitant,
  niveau: NiveauVillage,
  heure: number,
  r: ReglagesHabitants = CONFIG.habitants,
  endommagees?: ReadonlySet<string>,
): EtatHabitant {
  const periode = periodeHabitant(id, heure, r);
  const lieux = lieuxHabitant(id, niveau, r);
  const base = { id, periode, poste: 0, chemin: [], compteur: 0, vitesse: 0, activite: false, versJoueur: false, regard: 0 };
  const porte = porteDeNuit(lieux, endommagees);
  if (periode === 'nuit' && porte) {
    return { ...base, x: porte.x, z: porte.z, orientation: 0, visible: false, mode: 'chez-soi', attente: 0 };
  }
  const p = lieux[periode === 'nuit' ? 'jour' : periode][0];
  return { ...base, x: p.x, z: p.z, orientation: p.orientation, visible: true, mode: 'poste', attente: dureePoste(id, 0, r), activite: p.activite };
}

/** Tous les habitants de ce niveau, placés selon l'heure. */
export function creerEtatsHabitants(niveau: NiveauVillage, heure: number, r: ReglagesHabitants = CONFIG.habitants, endommagees?: ReadonlySet<string>): EtatHabitant[] {
  return habitantsPresents(niveau).map((id) => creerEtatHabitant(id, niveau, heure, r, endommagees));
}

/**
 * Avance un habitant de `dt` secondes : il change de destination quand la période change, marche de point en point,
 * tient son poste, se tourne vers le joueur quand celui-ci est proche. Renvoie le nouvel état.
 */
export function pasHabitant(etat: EtatHabitant, env: EnvironnementHabitants, dt: number, r: ReglagesHabitants = CONFIG.habitants): EtatHabitant {
  const periode = periodeHabitant(etat.id, env.heure, r);
  const lieux = lieuxHabitant(etat.id, env.niveau, r);
  const porte = porteDeNuit(lieux, env.endommagees);
  const s: EtatHabitant = { ...etat };

  // Nouvelle période : nouvelle destination (la porte la nuit, sinon le premier poste)
  if (s.periode !== periode) {
    s.periode = periode;
    s.poste = 0;
    s.activite = false;
    const reseau = reseauHabitant(s.id, env.niveau);
    if (periode === 'nuit') {
      if (porte && s.visible) {
        s.chemin = tracerChemin(reseau, s, porte);
        s.mode = 'marche';
      }
    } else {
      const cible = lieux[periode][0];
      if (!s.visible && porte) {
        // Il sort de chez lui, dos à la porte
        s.x = porte.x;
        s.z = porte.z;
        s.visible = true;
      }
      s.chemin = tracerChemin(reseau, s, cible);
      if (etat.visible === false) s.orientation = vers(s, s.chemin[0]);
      s.mode = 'marche';
    }
  }

  if (!s.visible) {
    s.vitesse = 0;
    s.regard = 0;
    s.versJoueur = false;
    return s;
  }

  const j = env.joueur;
  const distanceJoueur = j ? Math.hypot(j.x - s.x, j.z - s.z) : Infinity;
  const pasRotation = r.vitesseRotation * dt;
  s.versJoueur = false;

  if (s.mode === 'marche') {
    const seuil = periode === 'nuit' ? r.distanceTournerNuit : r.distanceTourner;
    if (j && distanceJoueur < seuil) {
      // Le joueur est là : il s'arrête et lui fait face
      s.vitesse = 0;
      s.versJoueur = true;
      s.orientation = tournerVers(s.orientation, vers(s, j), pasRotation);
    } else {
      let reste = r.vitesseMarche * dt;
      const chemin = [...s.chemin];
      while (reste > 0 && chemin.length > 0) {
        const cible = chemin[0];
        const d = Math.hypot(cible.x - s.x, cible.z - s.z);
        if (d > 1e-6) s.orientation = tournerVers(s.orientation, vers(s, cible), pasRotation);
        if (d <= reste) {
          s.x = cible.x;
          s.z = cible.z;
          reste -= d;
          chemin.shift();
        } else {
          s.x += ((cible.x - s.x) / d) * reste;
          s.z += ((cible.z - s.z) / d) * reste;
          reste = 0;
        }
      }
      s.chemin = chemin;
      s.vitesse = r.vitesseMarche;
      if (chemin.length === 0) {
        s.vitesse = 0;
        if (periode === 'nuit') {
          s.visible = false;
          s.mode = 'chez-soi';
        } else {
          s.mode = 'poste';
          s.compteur += 1;
          s.attente = dureePoste(s.id, s.compteur, r);
        }
      }
    }
  } else if (s.mode === 'poste' && periode !== 'nuit') {
    const postes = lieux[periode];
    const ici = postes[s.poste % postes.length];
    s.vitesse = 0;
    if (j && distanceJoueur < r.distanceTourner) {
      // Il reste là tant que le joueur est près de lui : on peut lui parler
      s.versJoueur = true;
      s.activite = false;
      s.orientation = tournerVers(s.orientation, vers(s, j), pasRotation);
    } else {
      s.orientation = tournerVers(s.orientation, ici.orientation, pasRotation);
      s.activite = ici.activite && Math.abs(ecartAngle(s.orientation, ici.orientation)) < 0.05;
      s.attente -= dt;
      if (s.attente <= 0 && postes.length > 1) {
        s.poste = (s.poste + 1) % postes.length;
        s.chemin = tracerChemin(reseauHabitant(s.id, env.niveau), s, postes[s.poste]);
        s.mode = 'marche';
        s.activite = false;
      }
    }
  }

  // La tête suit le joueur quand il est proche
  const cibleRegard =
    j && distanceJoueur < r.distanceRegard
      ? Math.max(-r.angleRegardMax, Math.min(r.angleRegardMax, ecartAngle(s.orientation, vers(s, j))))
      : 0;
  s.regard = tournerVers(s.regard, cibleRegard, pasRotation);
  return s;
}

/**
 * Rayon du cercle d'obstacle d'un habitant pour le joueur : 0 s'il est rentré chez lui ou s'il passe
 * près d'une porte (il ne doit jamais bloquer une entrée, surtout pas celle de la maison du joueur).
 */
export function rayonObstacleHabitant(etat: EtatHabitant, portes: readonly Point[], r: ReglagesHabitants = CONFIG.habitants): number {
  if (!etat.visible) return 0;
  for (const p of portes) if (Math.hypot(p.x - etat.x, p.z - etat.z) < r.distancePorteLibre) return 0;
  return r.rayon;
}
