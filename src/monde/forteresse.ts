// Les ruines de la forteresse de Castalrock, autour du Cœur de Castal (l'ancien « autel du Cœur »).
// Une enceinte à six côtés d'une soixantaine de mètres : remparts cassés à créneaux, trois tours effondrées (une encore
// haute), une porte en arche, une cour dallée envahie d'herbe, une colonnade brisée, les restes de la grande salle et
// des escaliers qui ne mènent plus nulle part. Le centre de la cour est laissé libre pour le berceau du cristal
// (modèle : src/scene/modelesLieux.ts).
// Tout est décrit en blocs (les mêmes que les ruines du décor, src/monde/piecesRuines.ts, en plus gros) dans le repère
// du lieu : +z vers la porte, +x à droite quand on regarde la porte depuis la cour. Le sol est plat (replat du lieu).
// Pur : aucun import de three, aucun Math.random() ; toujours la même forteresse.

import { CONFIG } from '../config';
import { creerAleatoire } from '../regles/aleatoire';
import type { ObstacleCercle } from '../regles/deplacement';
import { Chantier, sousRepere, type Bloc, type Matiere, type Repere } from './piecesRuines';

export interface PlanForteresse {
  /** Blocs de pierre, de mousse et de lierre, dans le repère du lieu (y : au-dessus du replat) */
  readonly blocs: readonly Bloc[];
  /** Collisions en cercles, dans le repère du lieu */
  readonly obstacles: readonly ObstacleCercle[];
  /** Milieu de la porte, dans le repère du lieu, et largeur du passage */
  readonly porte: { readonly x: number; readonly z: number; readonly largeur: number };
}

// Grosses pierres de rempart : longueur d'un module, hauteur d'un rang, épaisseur du mur, fondations sous le sol
const MODULE = 2;
const RANG = 1;
const EPAISSEUR = 1.8;
const FONDATION = 1.5;
const RACINE: Repere = { x: 0, y: 0, z: 0, lacet: 0 };

type Profil = ReadonlyArray<readonly [number, number]>;

/** Hauteur le long d'un mur : ligne brisée passant par les points [abscisse, hauteur]. */
function ligneBrisee(points: Profil): (x: number) => number {
  return (x) => {
    if (x <= points[0][0]) return points[0][1];
    for (let i = 1; i < points.length; i++) {
      const [x1, h1] = points[i];
      if (x > x1) continue;
      const [x0, h0] = points[i - 1];
      return h0 + ((h1 - h0) * (x - x0)) / (x1 - x0);
    }
    return points[points.length - 1][1];
  };
}

function pierre(c: Chantier): Matiere {
  return c.chance(0.16) ? 'pierreSombre' : c.chance(0.2) ? 'pierreClaire' : 'pierre';
}

/** Coiffe de mousse sur une pierre (dessus à la hauteur `y`), avec parfois une coulure sur une face. */
function mousse(c: Chantier, r: Repere, x: number, y: number, z: number, lx: number, lz: number): void {
  c.bloc(r, 'boite', 'mousse', x, y + 0.06, z, lx * c.alea.entre(0.6, 1.02), 0.16, lz + 0.14);
  if (!c.chance(0.6)) return;
  const h = c.alea.entre(0.3, 0.9);
  c.bloc(r, 'boite', 'mousse', x + c.alea.entre(-0.3, 0.3) * lx, y + 0.08 - h / 2, z + (c.chance(0.5) ? 1 : -1) * (lz / 2 + 0.05), c.alea.entre(0.3, 0.6), h, 0.09);
}

/** Lierre : grandes feuilles qui descendent d'un point haut le long d'une face (z local = la face). */
function lierre(c: Chantier, r: Repere, x: number, yHaut: number, z: number, cote: number, hauteur: number): void {
  const n = Math.round(c.alea.entre(7, 10) * Math.min(1.6, Math.max(0.7, hauteur / 3)));
  for (let k = 0; k < n; k++) {
    const t = k / Math.max(1, n - 1);
    const taille = c.alea.entre(0.55, 0.95) * (1 - t * 0.35);
    c.bloc(
      r,
      'touffe',
      c.chance(0.25) ? 'mousse' : 'lierre',
      x + c.alea.entre(-0.8, 0.8) * (0.4 + t),
      yHaut - t * hauteur + c.alea.entre(-0.12, 0.12),
      z + cote * 0.06,
      taille,
      taille * 1.15,
      0.2,
      c.alea.entre(-0.3, 0.3),
      0,
      c.alea.entre(-0.6, 0.6),
    );
  }
  c.bloc(r, 'touffe', 'lierre', x, yHaut + 0.1, z - cote * 0.5, 1.7, 0.5, 1.5, c.alea.entre(0, 3));
}

/** Éboulis : `n` pierres tombées autour du point local (x, z), les plus grosses de `taille` mètres. */
function eboulis(c: Chantier, r: Repere, x: number, z: number, etalement: number, n: number, taille = 1.2): void {
  for (let k = 0; k < n; k++) {
    const a = c.alea.entre(0, Math.PI * 2);
    const d = c.alea.entre(0.2, etalement);
    const t = c.alea.entre(0.35, 1) * taille;
    const taillee = c.chance(0.6);
    c.bloc(
      r,
      taillee ? 'boite' : 'roc',
      pierre(c),
      x + Math.cos(a) * d,
      t * 0.24,
      z + Math.sin(a) * d,
      taillee ? t * 1.5 : t,
      t * 0.75,
      t,
      c.alea.entre(0, Math.PI),
      c.alea.entre(-0.3, 0.3),
      c.alea.entre(-0.3, 0.3),
    );
  }
}

/** Gros bloc tombé, de travers, qui arrête le joueur. */
function grosBloc(c: Chantier, x: number, z: number, lx: number, ly: number, lz: number): void {
  c.bloc(RACINE, 'boite', pierre(c), x, ly * 0.42, z, lx, ly, lz, c.alea.entre(0, Math.PI), c.alea.entre(-0.18, 0.18), c.alea.entre(-0.18, 0.18));
  if (c.chance(0.5)) mousse(c, RACINE, x, ly * 0.9, z, lx * 0.5, lz * 0.4);
  c.obstacle(RACINE, x, z, Math.min(lx, lz) * 0.55);
}

interface OptionsRempart {
  /** Bornes du mur le long de son axe x, en mètres */
  debut: number;
  fin: number;
  /** Hauteur du mur en mètres le long de l'axe : c'est elle qui dessine la ruine */
  profil: Profil;
  /** À partir de cette hauteur, le haut du mur est intact : arase nette et créneaux du côté +z (l'extérieur) */
  noble?: number;
  /** Vrai là où il n'y a pas de pierre (porte, fenêtre) : abscisse et hauteur du centre de la pierre */
  vide?: (x: number, y: number) => boolean;
  /** Passage au sol (pas de collision entre ces deux abscisses) */
  passage?: readonly [number, number];
  epaisseur?: number;
  /** Nombre de cascades de lierre */
  lierres?: number;
}

/**
 * Rempart de grosses pierres en rangs décalés, le long de l'axe x du repère, centré sur z = 0. Une pierre existe si
 * son rang tient sous la hauteur du mur à cet endroit. Pose aussi la mousse, le lierre, les créneaux, les éboulis au
 * pied des brèches et les collisions (là où le mur fait plus d'un mètre).
 */
function rempart(c: Chantier, r: Repere, o: OptionsRempart): void {
  const e = o.epaisseur ?? EPAISSEUR;
  const noble = o.noble ?? Infinity;
  const base = ligneBrisee(o.profil);
  const phase = c.alea.entre(0, 6);
  const hauteur = (x: number): number => {
    const h = base(x);
    if (h >= noble - 0.01) return h;
    if (h <= 0.2) return 0;
    return Math.max(0, h + 0.8 * Math.sin(x * 0.9 + phase) + 0.5 * Math.sin(x * 2.3 + phase * 2));
  };
  let rangMax = 0;
  for (let x = o.debut; x <= o.fin; x += 0.5) rangMax = Math.max(rangMax, Math.floor(hauteur(x) / RANG + 0.01));

  const sommets: Array<{ x: number; y: number; l: number; intact: boolean }> = [];
  for (let j = 0; j < rangMax; j++) {
    const decalage = j % 2 === 1 ? MODULE / 2 : 0;
    for (let k = 0; o.debut + k * MODULE - decalage < o.fin; k++) {
      const a = Math.max(o.debut, o.debut + k * MODULE - decalage);
      const b = Math.min(o.fin, o.debut + (k + 1) * MODULE - decalage);
      if (b - a < 0.5) continue;
      const xc = (a + b) / 2;
      const h = hauteur(xc);
      if ((j + 1) * RANG > h + 0.01 || o.vide?.(xc, (j + 0.5) * RANG)) continue;
      const dessus = (j + 2) * RANG > h + 0.01;
      const intact = dessus && h >= noble - 0.01;
      // Pierre du haut d'une partie ruinée : parfois tombée, souvent de travers
      if (dessus && !intact && j > 1 && c.chance(0.07)) continue;
      const bas = j === 0 ? FONDATION : 0;
      c.bloc(
        r,
        'boite',
        pierre(c),
        xc,
        j * RANG + RANG / 2 - bas / 2,
        c.alea.entre(-0.05, 0.05),
        b - a - 0.06,
        RANG - 0.04 + bas,
        e * c.alea.entre(0.95, 1.06),
        dessus && !intact ? c.alea.entre(-0.06, 0.06) : c.alea.entre(-0.012, 0.012),
        0,
        dessus && !intact && c.chance(0.2) ? c.alea.entre(-0.07, 0.07) : 0,
      );
      if (dessus) sommets.push({ x: xc, y: (j + 1) * RANG, l: b - a, intact });
    }
  }

  for (const s of sommets) {
    if (s.intact) {
      // Parapet et un merlon sur deux, du côté extérieur ; il en manque quelques-uns
      c.bloc(r, 'boite', pierre(c), s.x, s.y + 0.2, e / 2 - 0.3, s.l - 0.04, 0.4, 0.6);
      if (Math.round(s.x / MODULE) % 2 === 0 && !c.chance(0.15)) c.bloc(r, 'boite', pierre(c), s.x, s.y + 0.95, e / 2 - 0.3, 1.1, 1.1, 0.62, c.alea.entre(-0.03, 0.03));
      if (c.chance(0.12)) mousse(c, r, s.x, s.y, -0.3, s.l, e - 0.7);
    } else if (c.chance(0.34)) {
      mousse(c, r, s.x, s.y, 0, s.l, e);
    }
  }
  const hauts = sommets.filter((s) => s.y >= 3);
  for (let k = 0; k < (o.lierres ?? 2) && hauts.length > 0; k++) {
    const s = hauts[c.alea.entier(0, hauts.length - 1)];
    const cote = c.chance(0.6) ? -1 : 1;
    lierre(c, r, s.x, s.y, cote * (e / 2 + 0.08), cote, Math.min(s.y - 0.4, c.alea.entre(2.2, 4.6)));
  }

  // Collisions : là où le mur fait plus d'un mètre, hors du passage ; éboulis au pied des parties basses
  const [p0, p1] = o.passage ?? [Infinity, -Infinity];
  for (let x = o.debut; x <= o.fin + 1e-6; x += 1.1) {
    const h = hauteur(x);
    if (x > p0 - 1 && x < p1 + 1) continue;
    if (h >= 1.2) c.obstacle(r, x, 0, e / 2 + 0.12);
    else if (c.chance(0.75)) eboulis(c, r, x, c.alea.entre(-2.4, 2.4), 1.6, c.alea.entier(1, 3));
  }
}

interface OptionsTour {
  rayon: number;
  /** Hauteur du mur de la tour, en mètres, selon l'angle autour de la tour (0 = vers +z) */
  hauteur: (angle: number) => number;
  /** À partir de cette hauteur, le sommet est intact : encorbellement et créneaux */
  noble?: number;
  /** Faux pour une souche de tour où l'on peut entrer : collisions le long du mur seulement */
  pleine: boolean;
}

/** Tour ronde en anneaux de grosses pierres, creuse, au sommet cassé en biais. */
function tour(c: Chantier, x: number, z: number, o: OptionsTour): void {
  const r: Repere = { x, y: 0, z, lacet: 0 };
  const R = o.rayon;
  const n = Math.round((2 * Math.PI * R) / 2.5);
  const ep = 1.2;
  const large = 2 * R * Math.tan(Math.PI / n) + 0.04;
  const noble = o.noble ?? Infinity;
  let rangMax = 0;
  for (let i = 0; i < n * 2; i++) rangMax = Math.max(rangMax, Math.floor(o.hauteur((i * Math.PI) / n) + 0.01));
  for (let j = 0; j < rangMax; j++) {
    for (let i = 0; i < n; i++) {
      const angle = ((i + (j % 2) * 0.5) * 2 * Math.PI) / n;
      const h = o.hauteur(angle);
      if (j + 1 > h + 0.01) continue;
      const dessus = j + 2 > h + 0.01;
      const intact = dessus && h >= noble - 0.01;
      if (dessus && !intact && j > 1 && c.chance(0.1)) continue;
      const bas = j === 0 ? FONDATION : 0;
      const rr = sousRepere(r, Math.sin(angle) * (R - ep / 2), 0, Math.cos(angle) * (R - ep / 2), angle);
      const y = j * RANG + RANG / 2 - bas / 2;
      if (j % 5 === 3 && i % 3 === j % 2 && !dessus) {
        // Meurtrière : la pierre est fendue en deux
        for (const cote of [-1, 1]) c.bloc(rr, 'boite', pierre(c), cote * (large / 4 + 0.14), y, 0, large / 2 - 0.28, RANG - 0.04, ep);
      } else {
        c.bloc(rr, 'boite', pierre(c), 0, y, c.alea.entre(-0.04, 0.04), large, RANG - 0.04 + bas, ep, dessus && !intact ? c.alea.entre(-0.05, 0.05) : 0, 0, dessus && !intact && c.chance(0.2) ? c.alea.entre(-0.07, 0.07) : 0);
      }
      if (intact) {
        // Encorbellement, puis un merlon sur deux
        c.bloc(rr, 'boite', pierre(c), 0, j + 1.3, 0.3, large + 0.25, 0.6, ep + 0.5);
        if (i % 2 === 0) c.bloc(rr, 'boite', pierre(c), 0, j + 2.2, 0.55, large * 0.55, 1.2, 0.6);
      } else if (dessus && c.chance(0.4)) {
        mousse(c, rr, 0, j + 1, 0, large, ep);
      }
      if (dessus && j >= 3 && c.chance(0.16)) lierre(c, rr, 0, j + 1, ep / 2 + 0.08, 1, Math.min(j, c.alea.entre(2.5, 5)));
    }
  }
  // Pierres tombées à l'intérieur, et collisions
  eboulis(c, r, 0, 0, R - 1.6, 5);
  if (o.pleine) {
    c.obstacle(r, 0, 0, R + 0.15);
    return;
  }
  for (let i = 0; i < n * 2; i++) {
    const angle = (i * Math.PI) / n;
    if (o.hauteur(angle) >= 1.2) c.obstacle(r, Math.sin(angle) * (R - ep / 2), Math.cos(angle) * (R - ep / 2), ep / 2 + 0.15);
  }
}

/** Repère d'un mur qui va de (ax, az) à (bx, bz) : son axe x suit le mur, son +z est à gauche du sens de marche… l'extérieur de l'enceinte. */
function repereMur(ax: number, az: number, bx: number, bz: number): Repere {
  return { x: ax, y: 0, z: az, lacet: Math.atan2(-(bz - az), bx - ax) };
}

/** Colonne de la cour : socle, `tambours` tambours d'un mètre, chapiteau si elle est entière. */
function colonne(c: Chantier, x: number, z: number, tambours: number, entiere: boolean): void {
  const r: Repere = { x, y: 0, z, lacet: c.alea.entre(0, Math.PI) };
  c.bloc(r, 'boite', 'pierreSombre', 0, 0.25, 0, 1.9, 0.5, 1.9);
  c.bloc(r, 'boite', 'pierre', 0, 0.65, 0, 1.55, 0.3, 1.55);
  for (let k = 0; k < tambours; k++) {
    const dernier = k === tambours - 1 && !entiere;
    c.bloc(r, 'fut', k % 3 === 1 ? 'pierreClaire' : 'pierre', 0, 0.8 + k + 0.5, 0, 1.15 - k * 0.02, dernier ? 1.15 : 0.98, 1.15 - k * 0.02, c.alea.entre(0, 1), dernier ? c.alea.entre(0.12, 0.22) : 0, dernier ? c.alea.entre(-0.1, 0.1) : 0);
  }
  if (entiere) {
    c.bloc(r, 'boite', 'pierre', 0, 0.8 + tambours + 0.15, 0, 1.4, 0.3, 1.4);
    c.bloc(r, 'boite', 'pierreClaire', 0, 0.8 + tambours + 0.5, 0, 1.8, 0.4, 1.8);
  }
  if (c.chance(0.6)) mousse(c, r, 0, 0.5, 0.5, 1.2, 0.7);
  if (!entiere && c.chance(0.5)) c.bloc(r, 'touffe', 'mousse', 0.1, 0.8 + tambours + 0.05, 0, 0.9, 0.25, 0.8);
  c.obstacle(r, 0, 0, 0.95);
}

/** Décrit toute la forteresse (toujours la même). */
export function decrireForteresse(): PlanForteresse {
  const F = CONFIG.lieux.autel.forteresse;
  const c = new Chantier(creerAleatoire(F.graine), () => 0);
  const R = F.rayonEnceinte;
  // Les six angles de l'enceinte : la porte est au milieu du côté qui regarde +z
  const angles = Array.from({ length: 6 }, (_, k) => {
    const phi = Math.PI / 6 + (k * Math.PI) / 3;
    return { x: Math.sin(phi) * R, z: Math.cos(phi) * R };
  });
  const cote = (de: number, vers: number) => repereMur(angles[de].x, angles[de].z, angles[vers].x, angles[vers].z);
  const T = F.rayonTour - 0.7;

  // --- Remparts (longueur d'un côté : le rayon de l'enceinte) ---
  // Devant : la porte au milieu, sous un pan de mur plus haut à créneaux
  const milieu = R / 2;
  const demiPorte = F.largeurPorte / 2;
  const naissance = 4.5;
  const devant = cote(5, 0);
  rempart(c, devant, {
    debut: T,
    fin: R - T,
    profil: [[0, 2], [4, 4], [7, 7], [milieu - 6.5, 7], [milieu - 6, 10], [milieu + 6, 10], [milieu + 6.5, 7], [R, 7]],
    noble: 7,
    vide: (x, y) => (Math.abs(x - milieu) < demiPorte && y < naissance) || (y >= naissance && Math.hypot(x - milieu, y - naissance) < demiPorte + 0.9),
    passage: [milieu - demiPorte, milieu + demiPorte],
    lierres: 3,
  });
  // L'arche : piédroits, impostes, claveaux en demi-cercle, contreforts de part et d'autre
  for (const s of [-1, 1]) {
    const x = milieu + s * (demiPorte + 0.5);
    for (let k = 0; k < 4; k++) c.bloc(devant, 'boite', k % 2 === 0 ? 'pierreClaire' : 'pierre', x, k * 1.1 + 0.55 - (k === 0 ? 0.5 : 0), 0, 1.15, 1.06 + (k === 0 ? 1 : 0), 2.4);
    c.bloc(devant, 'boite', 'pierreSombre', x - s * 0.08, naissance - 0.05, 0, 1.4, 0.35, 2.7);
    c.bloc(devant, 'boite', 'pierre', milieu + s * (demiPorte + 2.4), 2.6, 1.3, 1.7, 6.2, 1.3);
    c.bloc(devant, 'boite', 'pierreSombre', milieu + s * (demiPorte + 2.4), 6.0, 1.15, 1.75, 0.9, 1.0, 0, -0.5);
    c.obstacle(devant, milieu + s * (demiPorte + 1.05), 0, 1.0);
    c.obstacle(devant, milieu + s * (demiPorte + 2.4), 1.2, 1.0);
  }
  const claveaux = 9;
  for (let i = 0; i < claveaux; i++) {
    const a = (Math.PI * (i + 0.5)) / claveaux;
    const cle = i === (claveaux - 1) / 2;
    const rm = demiPorte + 0.48 + (cle ? 0.1 : 0);
    c.bloc(devant, 'boite', cle ? 'pierreSombre' : i % 2 === 0 ? 'pierreClaire' : 'pierre', milieu + Math.cos(a) * rm, naissance + Math.sin(a) * rm, 0, 1.14, cle ? 1.2 : 0.98, cle ? 2.6 : 2.4, 0, 0, a - Math.PI / 2);
  }
  lierre(c, devant, milieu - demiPorte - 0.6, 7.6, 1.3, 1, 5);
  mousse(c, devant, milieu + 0.4, naissance + demiPorte + 1, 0, 1.6, 2.4);

  // À droite de la porte : un long pan intact, puis une brèche par où l'on passe
  rempart(c, cote(0, 1), { debut: T, fin: R, profil: [[0, 7], [14, 7], [17, 5], [20, 2], [21, 0], [26, 0], [27, 2], [R, 4]], noble: 7, lierres: 3 });
  rempart(c, cote(1, 2), { debut: 0, fin: R, profil: [[0, 4], [6, 5], [12, 3], [18, 5], [23, 6], [R, 6]], noble: 6 });
  // Le fond : effondré au milieu, il remonte vers la grande tour
  rempart(c, cote(2, 3), { debut: 0, fin: R - T, profil: [[0, 6], [5, 4], [9, 1], [11, 0], [17, 0], [19, 2], [24, 6], [R, 8]], noble: 8 });
  rempart(c, cote(3, 4), { debut: T, fin: R, profil: [[0, 8], [8, 7], [20, 7], [25, 5], [R, 5]], noble: 7, lierres: 3 });
  // À gauche de la porte : il n'en reste presque rien
  rempart(c, cote(4, 5), { debut: 0, fin: R - T, profil: [[0, 5], [6, 3], [12, 3.5], [18, 2], [22, 1], [26, 2], [R, 2]] });

  // --- Tours : une encore haute au fond à gauche, une moyenne à droite de la porte, une souche à gauche ---
  const cassure = (haut: number, perte: number, vers: number, puissance: number) => (angle: number) =>
    haut - perte * Math.pow(Math.max(0, Math.cos(angle - vers)), puissance) - (haut - perte > 2 ? 0 : 0.6 * Math.sin(angle * 5));
  tour(c, angles[3].x, angles[3].z, { rayon: F.rayonTour, hauteur: cassure(F.hauteurGrandeTour, 8, Math.PI / 2, 1.6), noble: F.hauteurGrandeTour, pleine: true });
  tour(c, angles[0].x, angles[0].z, { rayon: F.rayonTour, hauteur: cassure(10, 6.5, Math.PI / 2 + 0.6, 1.2), noble: 10, pleine: true });
  // La souche est ouverte du côté de la cour : on peut y entrer
  tour(c, angles[5].x, angles[5].z, { rayon: F.rayonTour, hauteur: cassure(4.6, 6.5, Math.atan2(-angles[5].x, -angles[5].z), 1), pleine: false });
  eboulis(c, RACINE, angles[5].x * 0.8, angles[5].z * 0.8, 3.5, 9, 1.5);
  // Aux trois autres angles : un gros pilier qui tient encore les murs
  for (const k of [1, 2, 4]) {
    const haut = k === 1 ? 5 : k === 2 ? 7 : 6;
    const r: Repere = { x: angles[k].x, y: 0, z: angles[k].z, lacet: Math.PI / 6 + (k * Math.PI) / 3 };
    for (let j = 0; j < haut; j++) c.bloc(r, 'boite', pierre(c), 0, j + 0.5 - (j === 0 ? 0.6 : 0), 0, 2.9 - j * 0.06, 0.97 + (j === 0 ? 1.2 : 0), 2.9 - j * 0.06, j % 2 === 0 ? 0 : 0.04);
    mousse(c, r, 0, haut, 0, 2.2, 2.2);
    c.obstacle(r, 0, 0, 1.75);
  }

  // --- Restes de la grande salle, derrière le cristal : un haut pignon percé d'une grande fenêtre ---
  const salle: Repere = { x: -10, y: 0, z: -15.5, lacet: 0 };
  rempart(c, salle, {
    debut: 0,
    fin: 20,
    profil: [[0, 3], [3, 6], [6, 11], [14, 11], [16, 8], [18, 4], [20, 2]],
    noble: 11,
    vide: (x, y) => (Math.abs(x - 10) < 2 && y > 2 && y < 6) || (Math.abs(x - 10) < 1.1 && y >= 6 && y < 8),
    epaisseur: 1.4,
    lierres: 3,
  });
  // Appui et encadrement de la fenêtre
  c.bloc(salle, 'boite', 'pierreClaire', 10, 1.9, 0, 5, 0.3, 1.8);
  rempart(c, repereMur(-10, -16, -10, -23), { debut: 0, fin: 7, profil: [[0, 3], [4, 2], [7, 1]], epaisseur: 1.4, lierres: 0 });
  rempart(c, repereMur(10, -16, 10, -23), { debut: 0, fin: 7, profil: [[0, 2], [3, 4], [7, 3]], epaisseur: 1.4, lierres: 1 });

  // --- Escaliers qui ne mènent plus nulle part ---
  // Le long du rempart, à droite de la porte : il montait au chemin de ronde
  const droite = cote(0, 1);
  for (let k = 0; k < 10; k++) {
    c.bloc(droite, 'boite', k % 3 === 0 ? 'pierreClaire' : 'pierre', 5 + (k + 0.5) * 0.8, (k + 1) * 0.25, -(EPAISSEUR / 2 + 1.05), 0.8, (k + 1) * 0.5, 2.1 - (k > 7 ? 0.5 : 0));
    if (k % 2 === 1) c.obstacle(droite, 5 + (k + 0.5) * 0.8, -(EPAISSEUR / 2 + 1.05), 1.05);
  }
  mousse(c, droite, 7, 1.5, -(EPAISSEUR / 2 + 1.05), 0.8, 1.6);
  eboulis(c, droite, 14.5, -3.2, 1.8, 6, 1.1);
  // Dans la cour : une volée de marches vers un palier, et plus rien derrière
  const volee: Repere = { x: 15.5, y: 0, z: -3, lacet: Math.PI };
  for (let k = 0; k < 8; k++) c.bloc(volee, 'boite', k % 2 === 0 ? 'pierre' : 'pierreSombre', 0, (k + 1) * 0.225, (k + 0.5) * 0.8, 3.2, (k + 1) * 0.45, 0.8, 0, 0, k === 5 ? 0.03 : 0);
  c.bloc(volee, 'boite', 'pierre', 0, 1.8, 7.4, 3.4, 3.6, 2);
  c.bloc(volee, 'boite', 'pierreSombre', -1.5, 4.1, 7.4, 0.5, 1, 2);
  mousse(c, volee, 0.6, 3.6, 7.6, 1.8, 1.2);
  lierre(c, volee, 0, 3.5, 8.45, 1, 3);
  for (let k = 0; k < 4; k++) c.obstacle(volee, 0, 1.2 + k * 2.2, 1.7);

  // --- Colonnade de l'allée, de la porte au cristal, et colonne couchée ---
  const allee: ReadonlyArray<readonly [number, number, number, boolean]> = [
    [-6.5, 20, 5, true],
    [6.5, 20, 3, false],
    [-6.5, 14.5, 2, false],
    [6.5, 14.5, 5, true],
    [-6.5, 9, 4, false],
    [6.5, 9, 1, false],
  ];
  for (const [x, z, tambours, entiere] of allee) colonne(c, x, z, tambours, entiere);
  for (let k = 0; k < 4; k++) {
    c.bloc(RACINE, 'fut', k % 2 === 0 ? 'pierre' : 'pierreClaire', 8.6 + k * 1.12, 0.5, 7.6 - k * 0.5, 1.1, 1, 1.1, 0.42 + k * 0.05, 0, Math.PI / 2);
    if (k % 2 === 0) c.obstacle(RACINE, 8.6 + k * 1.12, 7.6 - k * 0.5, 0.85);
  }
  c.bloc(RACINE, 'boite', 'pierreClaire', 13.6, 0.35, 5.3, 1.8, 0.4, 1.8, 0.5, 0.35, 0.1);

  // --- Gros blocs tombés ---
  const blocs: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-19, 12, 2.2, 1.3, 1.6],
    [-16.5, 15.5, 1.6, 1.1, 1.4],
    [-21, -6, 2.4, 1.5, 1.7],
    [3, -22.5, 2.6, 1.4, 1.8],
    [-3.5, -24, 1.8, 1.2, 1.5],
    [20.5, -8.5, 2, 1.2, 1.6],
    [17, 20, 1.8, 1.1, 1.4],
    [-9, 29.5, 2, 1.2, 1.5],
    [11.5, 31, 1.7, 1, 1.3],
  ];
  for (const [x, z, lx, ly, lz] of blocs) grosBloc(c, x, z, lx, ly, lz);
  eboulis(c, RACINE, 0, -25, 5, 14, 1.4);

  // --- Cour : dalles cassées, allée jusqu'à la porte, mousse et herbe entre les pierres ---
  const libre = (x: number, z: number, marge: number) => c.obstacles.every((o) => Math.hypot(o.x - x, o.z - z) > o.rayon + marge);
  const pas = 2.7;
  for (let i = -9; i <= 9; i++) {
    for (let j = -9; j <= 15; j++) {
      const x = i * pas + (j % 2 === 0 ? 0 : pas / 2) + c.alea.entre(-0.35, 0.35);
      const z = j * pas * 0.87 + c.alea.entre(-0.35, 0.35);
      const d = Math.hypot(x, z);
      const surAllee = Math.abs(x) < 3.2 && z > 0;
      const tirage = c.alea.suivant();
      // Hors de l'allée, la cour ne dépasse pas l'enceinte, et il manque de plus en plus de dalles vers les murs
      if (d < F.rayonBerceau + 2.6 || (!surAllee && (d > R * 0.74 || tirage < 0.22 + d / 60)) || (surAllee && (z > R + 5 || tirage < 0.12))) continue;
      if (!libre(x, z, 0.2)) continue;
      // Dalles à six côtés, plus ou moins allongées, et quelques pavés carrés
      const t = c.alea.entre(1.9, 2.75);
      const carree = c.chance(0.22);
      c.bloc(RACINE, carree ? 'boite' : 'dalle', c.chance(0.25) ? 'pierre' : c.chance(0.2) ? 'pierreSombre' : 'dalle', x, 0.01 + c.alea.entre(0, 0.03), z, carree ? t * 0.8 : t, 0.14, t * c.alea.entre(0.62, 1), c.alea.entre(0, Math.PI), c.alea.entre(-0.012, 0.012), c.alea.entre(-0.012, 0.012));
    }
  }
  // Parvis du berceau : une couronne de grandes dalles autour du cristal
  for (let k = 0; k < 14; k++) {
    const a = (k * 2 * Math.PI) / 14;
    c.bloc(RACINE, 'boite', k % 2 === 0 ? 'dalle' : 'pierre', Math.sin(a) * (F.rayonBerceau + 1.2), 0.04, Math.cos(a) * (F.rayonBerceau + 1.2), 2.55, 0.18, 2.3, a);
  }
  for (let k = 0; k < 110; k++) {
    const a = c.alea.entre(0, Math.PI * 2);
    const d = F.rayonBerceau + 2.5 + Math.sqrt(c.alea.suivant()) * (R * 0.82 - F.rayonBerceau - 2.5);
    const x = Math.sin(a) * d;
    const z = Math.cos(a) * d;
    if (c.chance(0.45)) {
      // Coussin de mousse à plat
      c.bloc(RACINE, 'touffe', c.chance(0.3) ? 'lierre' : 'mousse', x, 0.05, z, c.alea.entre(1.2, 3), 0.24, c.alea.entre(1, 2.4), a);
    } else {
      // Touffe d'herbe : trois brins pointus
      for (let b = 0; b < 3; b++) c.bloc(RACINE, 'eclat', b === 1 ? 'mousse' : 'lierre', x + c.alea.entre(-0.25, 0.25), 0.3, z + c.alea.entre(-0.25, 0.25), 0.3, c.alea.entre(0.5, 0.8), 0.3, a + b, c.alea.entre(-0.25, 0.25), c.alea.entre(-0.25, 0.25));
    }
  }

  return { blocs: c.blocs, obstacles: c.obstacles, porte: { x: 0, z: angles[0].z, largeur: F.largeurPorte } };
}
