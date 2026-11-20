// Pièces des ruines et des petites grottes : chaque pièce (muret cassé, colonnes brisées, arche, tour effondrée,
// maison sans toit, ancien avant-poste, alcôve de grotte) est décrite comme une liste de blocs simples (pierres
// taillées, tambours de colonne, touffes de mousse et de lierre, rochers), avec ses cercles de collision.
// Les morceaux manquants, les tailles et les inclinaisons sont tirés du générateur à graine reçu : deux pièces du
// même type ne sont jamais pareilles. Pur : aucun import de three, aucun Math.random().
// L'affichage (src/scene/modelesRuines.ts) transforme ces blocs en une seule géométrie par site.

import { creerAleatoire, type Aleatoire } from '../regles/aleatoire';
import type { ObstacleCercle } from '../regles/deplacement';

/** Matière d'un bloc : sa couleur est dans CONFIG.ruines.couleurs. `lanterne` et `cristal` brillent (sans éclairage). */
export type Matiere =
  | 'pierre'
  | 'pierreClaire'
  | 'pierreSombre'
  | 'dalle'
  | 'mousse'
  | 'lierre'
  | 'bois'
  | 'boisSombre'
  | 'roche'
  | 'rocheSombre'
  | 'rocheLueur'
  | 'terre'
  | 'lanterne'
  | 'cristal'
  // Petit coffre (modèle de src/scene/modelesRuines.ts)
  | 'coffre'
  | 'coffreSombre'
  | 'fer'
  | 'ferClair';

export const MATIERES_LUMINEUSES: readonly Matiere[] = ['lanterne', 'cristal'];

/**
 * Forme de base d'un bloc, de taille 1 avant étirement : `boite` (pierre taillée), `fut` (tambour de colonne à 7 pans),
 * `touffe` (mousse, feuille de lierre), `roc` (rocher facetté, gravats), `dalle` (pavé à 6 côtés), `eclat` (pointe de cristal),
 * `herbe` (touffe de quatre brins).
 */
export type Forme = 'boite' | 'fut' | 'touffe' | 'roc' | 'dalle' | 'eclat' | 'herbe';

export interface Bloc {
  forme: Forme;
  matiere: Matiere;
  /** Centre du bloc, par rapport au centre du site (y : par rapport à l'altitude du site) */
  x: number;
  y: number;
  z: number;
  /** Taille le long de ses axes propres, en mètres */
  lx: number;
  ly: number;
  lz: number;
  /** Rotation en radians : lacet `ry` (autour de la verticale), puis inclinaisons `rx` et `rz` (ordre YXZ de three) */
  rx: number;
  ry: number;
  rz: number;
  /** Nombre de 0 à 1 dont l'affichage tire une variation de couleur */
  teinte: number;
}

/** Repère d'une pièce : origine (par rapport au centre du site) et lacet ; l'avant local +z est (sin, cos). */
export interface Repere {
  x: number;
  y: number;
  z: number;
  lacet: number;
}

/** Endroit où un coffre peut être posé, par rapport au centre du site. `abrite` : à l'intérieur d'une pièce. */
export interface PlaceCoffre {
  x: number;
  z: number;
  lacet: number;
  abrite: boolean;
}

export type TypePiece = 'muret' | 'colonnes' | 'arche' | 'tour' | 'maison' | 'avantPoste';
export const TYPES_PIECES: readonly TypePiece[] = ['muret', 'colonnes', 'arche', 'tour', 'maison', 'avantPoste'];

// Pierres taillées : longueur d'un module, hauteur d'un rang, profondeur des fondations sous le sol
const MODULE = 1.0;
const RANG = 0.5;
const FONDATION = 1.3;

/** Place le point local (x, z) d'un repère dans le repère du site. */
function versSite(r: Repere, x: number, z: number): { x: number; z: number } {
  const c = Math.cos(r.lacet);
  const s = Math.sin(r.lacet);
  return { x: r.x + x * c + z * s, z: r.z - x * s + z * c };
}

/** Repère posé dans un autre : origine locale (x, y, z) et lacet ajouté. */
export function sousRepere(r: Repere, x: number, y: number, z: number, lacet: number): Repere {
  const p = versSite(r, x, z);
  return { x: p.x, y: r.y + y, z: p.z, lacet: r.lacet + lacet };
}

/** Ce qui se construit sur un site : blocs, collisions, emprises au sol (où le décor ne pousse pas), places de coffre. */
export class Chantier {
  readonly blocs: Bloc[] = [];
  readonly obstacles: ObstacleCercle[] = [];
  readonly emprises: ObstacleCercle[] = [];
  readonly coffres: PlaceCoffre[] = [];

  constructor(
    readonly alea: Aleatoire,
    /** Altitude du sol en un point du site (coordonnées et altitude par rapport au centre du site) */
    private readonly sol: (x: number, z: number) => number,
  ) {}

  /**
   * Ajoute un bloc : centre local (x, y, z) dans le repère, taille, lacet local puis inclinaisons. `teinte` : à donner
   * pour un bloc d'habillage, qui ne doit pas avancer le générateur du site.
   */
  bloc(r: Repere, forme: Forme, matiere: Matiere, x: number, y: number, z: number, lx: number, ly: number, lz: number, ry = 0, rx = 0, rz = 0, teinte?: number): void {
    const p = versSite(r, x, z);
    this.blocs.push({ forme, matiere, x: p.x, y: r.y + y, z: p.z, lx, ly, lz, rx, ry: r.lacet + ry, rz, teinte: teinte ?? this.alea.suivant() });
  }

  /** Comme `bloc`, mais posé sur le sol réel à cet endroit : `dy` est la hauteur du centre au-dessus du sol. */
  blocAuSol(r: Repere, forme: Forme, matiere: Matiere, x: number, dy: number, z: number, lx: number, ly: number, lz: number, ry = 0, rx = 0, rz = 0, teinte?: number): void {
    const p = versSite(r, x, z);
    this.blocs.push({ forme, matiere, x: p.x, y: this.sol(p.x, p.z) + dy, z: p.z, lx, ly, lz, rx, ry: r.lacet + ry, rz, teinte: teinte ?? this.alea.suivant() });
  }

  obstacle(r: Repere, x: number, z: number, rayon: number): void {
    this.obstacles.push({ ...versSite(r, x, z), rayon });
  }

  emprise(r: Repere, x: number, z: number, rayon: number): void {
    this.emprises.push({ ...versSite(r, x, z), rayon });
  }

  coffre(r: Repere, x: number, z: number, lacet: number, abrite: boolean): void {
    this.coffres.push({ ...versSite(r, x, z), lacet: r.lacet + lacet, abrite });
  }

  /** Vrai avec la probabilité `p`. */
  chance(p: number): boolean {
    return this.alea.suivant() < p;
  }
}

// --- Éléments communs -------------------------------------------------------------------------

/** Gravats : `n` pierres tombées autour du point local (x, z), posées sur le sol. */
function gravats(c: Chantier, r: Repere, x: number, z: number, etalement: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const a = c.alea.entre(0, Math.PI * 2);
    const d = c.alea.entre(0.2, etalement);
    const t = c.alea.entre(0.3, 0.75);
    const taille = c.chance(0.5);
    c.blocAuSol(
      r,
      taille ? 'boite' : 'roc',
      c.chance(0.3) ? 'pierreSombre' : 'pierre',
      x + Math.cos(a) * d,
      t * 0.22,
      z + Math.sin(a) * d,
      taille ? t * 1.4 : t,
      t * 0.75,
      t,
      c.alea.entre(0, Math.PI),
      c.alea.entre(-0.35, 0.35),
      c.alea.entre(-0.35, 0.35),
    );
  }
}

/** Coiffe de mousse sur une pierre (dessus à la hauteur `y`), avec une ou deux coulures sur la face. */
function mousse(c: Chantier, r: Repere, x: number, y: number, z: number, lx: number, lz: number, ry = 0): void {
  const rr = sousRepere(r, x, y, z, ry);
  c.bloc(rr, 'boite', 'mousse', 0, 0.05, 0, lx * c.alea.entre(0.7, 1.04), 0.12, lz + 0.1);
  const coulures = c.alea.entier(0, 2);
  for (let k = 0; k < coulures; k++) {
    const cote = c.chance(0.5) ? 1 : -1;
    const h = c.alea.entre(0.18, 0.42);
    c.bloc(rr, 'boite', 'mousse', c.alea.entre(-0.3, 0.3) * lx, 0.06 - h / 2, cote * (lz / 2 + 0.04), c.alea.entre(0.16, 0.3), h, 0.07);
  }
}

/** Lierre : feuilles qui descendent d'un point haut le long d'une face (z local = côté de la face). */
function lierre(c: Chantier, r: Repere, x: number, yHaut: number, z: number, hauteur: number): void {
  const n = Math.round(c.alea.entre(5, 9) * Math.min(1.4, Math.max(0.6, hauteur / 1.6)));
  const cote = Math.sign(z) || 1;
  for (let k = 0; k < n; k++) {
    const t = k / Math.max(1, n - 1);
    const taille = c.alea.entre(0.32, 0.55) * (1 - t * 0.3);
    c.bloc(
      r,
      'touffe',
      c.chance(0.25) ? 'mousse' : 'lierre',
      x + c.alea.entre(-0.45, 0.45) * (0.5 + t),
      yHaut - t * hauteur + c.alea.entre(-0.08, 0.08),
      z + cote * 0.04,
      taille,
      taille * 1.15,
      0.14,
      c.alea.entre(-0.3, 0.3),
      0,
      c.alea.entre(-0.6, 0.6),
    );
  }
  // Touffe au sommet, qui déborde
  c.bloc(r, 'touffe', 'lierre', x, yHaut + 0.06, z - cote * 0.2, 0.9, 0.3, 0.75, c.alea.entre(0, 3));
}

interface Ouverture {
  /** Bornes le long du mur, en mètres */
  x0: number;
  x1: number;
  /** Rangs retirés : de `bas` (compris) à `haut` (exclu) */
  bas: number;
  haut: number;
}

interface OptionsMur {
  longueur: number;
  /** Hauteur du mur, en rangs, à l'abscisse x (0 à longueur) : c'est elle qui dessine la ruine */
  hauteur: (x: number) => number;
  epaisseur?: number;
  ouvertures?: readonly Ouverture[];
  /** Faux pour un mur posé sur une autre pièce (parapet) : ni fondations ni gravats */
  auSol?: boolean;
  /** Chance d'une cascade de lierre */
  lierre?: number;
}

/**
 * Mur de pierres taillées en rangs décalés, le long de l'axe x local (de 0 à `longueur`), centré sur z = 0.
 * Une pierre existe si son rang est sous la hauteur du mur à cet endroit : la fonction `hauteur` fait les brèches.
 */
function mur(c: Chantier, r: Repere, o: OptionsMur): void {
  const e = o.epaisseur ?? 0.7;
  const auSol = o.auSol ?? true;
  const L = o.longueur;
  const rangsA = (x: number) => Math.floor(o.hauteur(Math.min(L, Math.max(0, x))) + 1e-6);
  const ouverte = (x: number, j: number) => (o.ouvertures ?? []).some((v) => x > v.x0 && x < v.x1 && j >= v.bas && j < v.haut);
  let rangMax = 0;
  for (let x = 0; x <= L; x += MODULE / 4) rangMax = Math.max(rangMax, rangsA(x));

  const sommets: Array<{ x: number; y: number; l: number }> = [];
  for (let j = 0; j < rangMax; j++) {
    const decalage = j % 2 === 1 ? MODULE / 2 : 0;
    for (let k = 0; k * MODULE - decalage < L; k++) {
      const a = Math.max(0, k * MODULE - decalage);
      const b = Math.min(L, (k + 1) * MODULE - decalage);
      if (b - a < 0.28) continue;
      const xc = (a + b) / 2;
      if (j >= rangsA(xc) || ouverte(xc, j)) continue;
      const dessus = j === rangsA(xc) - 1;
      // Pierre du haut : parfois tombée, parfois de travers
      if (dessus && j > 0 && c.chance(0.07)) continue;
      const bas = j === 0 && auSol ? FONDATION : 0;
      const ee = e * c.alea.entre(0.93, 1.07);
      c.bloc(
        r,
        'boite',
        c.chance(0.16) ? 'pierreSombre' : c.chance(0.2) ? 'pierreClaire' : 'pierre',
        xc,
        j * RANG + RANG / 2 - bas / 2,
        c.alea.entre(-0.03, 0.03),
        b - a - 0.03,
        RANG - 0.02 + bas,
        ee,
        dessus ? c.alea.entre(-0.06, 0.06) : c.alea.entre(-0.015, 0.015),
        0,
        dessus && c.chance(0.15) ? c.alea.entre(-0.09, 0.09) : 0,
      );
      if (dessus) sommets.push({ x: xc, y: (j + 1) * RANG, l: b - a });
    }
  }

  for (const s of sommets) if (c.chance(0.3)) mousse(c, r, s.x, s.y, 0, s.l, e);
  const hauts = sommets.filter((s) => s.y >= 3 * RANG);
  if (hauts.length > 0 && c.chance(o.lierre ?? 0.55)) {
    const s = hauts[c.alea.entier(0, hauts.length - 1)];
    lierre(c, r, s.x, s.y, (c.chance(0.5) ? 1 : -1) * (e / 2 + 0.05), Math.min(s.y - 0.2, c.alea.entre(1.1, 2.1)));
  }

  // Collisions : là où le mur fait au moins deux rangs et n'est pas percé au sol ; emprise sur toute la longueur
  for (let x = 0; x <= L + 1e-6; x += 0.6) {
    if (rangsA(x) >= 2 && !ouverte(x, 0) && !ouverte(x, 1)) c.obstacle(r, x, 0, 0.48);
  }
  for (let x = 0; x <= L + 0.5; x += 1) c.emprise(r, Math.min(x, L), 0, 1.1);
  if (auSol) {
    for (let x = 0.5; x < L; x += 1) {
      if (rangsA(x) < 2 && c.chance(0.55)) gravats(c, r, x, (c.chance(0.5) ? 1 : -1) * c.alea.entre(0.5, 1.1), 0.7, c.alea.entier(1, 2));
    }
  }
}

/**
 * Profil d'usure d'un mur : part de la hauteur restante (0 à 1) le long du mur, en ligne brisée tirée au sort.
 * `breche` : chance qu'un point tombe à zéro (le mur est coupé en deux).
 */
function profilUsure(c: Chantier, longueur: number, mini: number, breche: number): (x: number) => number {
  const n = Math.max(2, Math.ceil(longueur / 1.2) + 1);
  const points: number[] = [];
  let v = c.alea.entre(mini, 1);
  for (let k = 0; k < n; k++) {
    v = Math.min(1, Math.max(mini, v + c.alea.entre(-0.42, 0.42)));
    points.push(v);
  }
  // Toujours un endroit resté haut, et parfois une brèche au milieu
  points[c.alea.entier(0, n - 1)] = 1;
  if (n >= 4 && c.chance(breche)) points[c.alea.entier(1, n - 2)] = 0;
  return (x) => {
    const t = Math.min(n - 1 - 1e-6, Math.max(0, (x / longueur) * (n - 1)));
    const k = Math.floor(t);
    return points[k] + (points[k + 1] - points[k]) * (t - k);
  };
}

// --- Pièces -----------------------------------------------------------------------------------

/** Une pièce prête à être posée : sa place au sol (rayon) et sa construction dans un repère (origine au centre). */
export interface Piece {
  type: TypePiece;
  rayon: number;
  construire(c: Chantier, r: Repere): void;
}

function muret(alea: Aleatoire): Piece {
  const longueur = alea.entre(3, 7.5);
  const rangs = alea.entier(3, 6);
  return {
    type: 'muret',
    rayon: longueur / 2 + 0.7,
    construire(c, r) {
      const usure = profilUsure(c, longueur, 0.2, 0.4);
      mur(c, sousRepere(r, -longueur / 2, 0, 0, 0), { longueur, hauteur: (x) => rangs * usure(x) + 0.5 });
      if (c.chance(0.6)) gravats(c, r, c.alea.entre(-longueur / 2, longueur / 2), c.alea.entre(-1.4, 1.4), 1, c.alea.entier(1, 3));
      c.coffre(r, c.alea.entre(-longueur / 4, longueur / 4), 1.25, 0, false);
    },
  };
}

/** Une colonne : socle, tambours empilés, sommet brisé (ou chapiteau, rarement), tambours tombés au pied. */
function colonne(c: Chantier, r: Repere): void {
  const tambours = c.alea.entier(1, 6);
  const d = c.alea.entre(0.66, 0.8);
  c.bloc(r, 'boite', 'pierre', 0, 0.16 - FONDATION / 2, 0, 1.2, 0.32 + FONDATION, 1.2, c.alea.entre(-0.05, 0.05));
  c.bloc(r, 'boite', 'pierreClaire', 0, 0.42, 0, 0.98, 0.2, 0.98, c.alea.entre(-0.05, 0.05));
  if (c.chance(0.5)) mousse(c, r, c.alea.entre(-0.2, 0.2), 0.32, 0.36, 0.5, 0.4);
  let y = 0.52;
  const h = 0.62;
  for (let k = 0; k < tambours; k++) {
    c.bloc(r, 'fut', k % 3 === 2 ? 'pierre' : 'pierreClaire', c.alea.entre(-0.02, 0.02), y + h / 2, c.alea.entre(-0.02, 0.02), d, h - 0.02, d, c.alea.entre(0, 3));
    y += h;
  }
  if (tambours === 6 && c.chance(0.45)) {
    // Colonne entière : elle a gardé son chapiteau
    c.bloc(r, 'boite', 'pierreClaire', 0, y + 0.07, 0, 0.86, 0.14, 0.86);
    c.bloc(r, 'boite', 'pierre', 0, y + 0.26, 0, 1.1, 0.24, 1.1);
    if (c.chance(0.6)) mousse(c, r, 0, y + 0.38, 0, 1, 1);
  } else {
    // Sommet brisé : un dernier morceau taillé en biseau
    c.bloc(r, 'fut', 'pierreClaire', 0.05, y + 0.12, 0, d * 0.96, 0.36, d * 0.96, c.alea.entre(0, 3), c.alea.entre(-0.3, 0.3), c.alea.entre(0.2, 0.38));
    if (c.chance(0.35)) mousse(c, r, -0.05, y + 0.2, 0, 0.4, 0.3, c.alea.entre(0, 3));
  }
  if (tambours >= 3 && c.chance(0.4)) lierre(c, sousRepere(r, 0, 0, 0, c.alea.entre(0, 6)), 0, y - 0.1, d / 2 + 0.03, c.alea.entre(1, 1.8));
  // Tambours tombés
  const tombes = tambours <= 4 ? c.alea.entier(0, 2) : 0;
  for (let k = 0; k < tombes; k++) {
    const a = c.alea.entre(0, Math.PI * 2);
    const dist = c.alea.entre(1.0, 1.9);
    c.blocAuSol(r, 'fut', 'pierreClaire', Math.cos(a) * dist, d * 0.4, Math.sin(a) * dist, d, h, d, c.alea.entre(0, 3), 0, Math.PI / 2 + c.alea.entre(-0.12, 0.12));
  }
  c.obstacle(r, 0, 0, 0.62);
  c.emprise(r, 0, 0, 1.5);
}

function colonnes(alea: Aleatoire): Piece {
  const nombre = alea.entier(1, 4);
  const ecart = alea.entre(2.2, 2.8);
  return {
    type: 'colonnes',
    rayon: ((nombre - 1) * ecart) / 2 + 1.5,
    construire(c, r) {
      for (let k = 0; k < nombre; k++) {
        // Dans une rangée, une colonne peut avoir entièrement disparu : il n'en reste que le socle
        const x = (k - (nombre - 1) / 2) * ecart;
        if (nombre >= 3 && c.chance(0.18)) {
          c.bloc(r, 'boite', 'pierre', x, 0.16 - FONDATION / 2, 0, 1.2, 0.32 + FONDATION, 1.2, c.alea.entre(-0.1, 0.1));
          gravats(c, r, x, 0, 1.2, 2);
          c.obstacle(r, x, 0, 0.55);
          c.emprise(r, x, 0, 1.3);
        } else {
          colonne(c, sousRepere(r, x, 0, 0, 0));
        }
      }
      c.coffre(r, 0, 1.5, 0, false);
    },
  };
}

function arche(alea: Aleatoire): Piece {
  const ouverture = alea.entre(2.2, 2.9);
  const rangs = alea.entier(4, 6);
  const ailes = [alea.suivant() < 0.6 ? alea.entre(1.5, 3.2) : 0, alea.suivant() < 0.6 ? alea.entre(1.5, 3.2) : 0];
  const pile = 0.9;
  return {
    type: 'arche',
    rayon: ouverture / 2 + pile + Math.max(ailes[0], ailes[1]) + 0.6,
    construire(c, r) {
      const xp = ouverture / 2 + pile / 2;
      const hautPile = rangs * RANG;
      // Les deux piles, avec leur imposte
      for (const s of [-1, 1]) {
        for (let j = 0; j < rangs; j++) {
          const bas = j === 0 ? FONDATION : 0;
          c.bloc(r, 'boite', j % 2 ? 'pierreClaire' : 'pierre', s * xp + c.alea.entre(-0.02, 0.02), j * RANG + RANG / 2 - bas / 2, 0, pile * c.alea.entre(0.95, 1.04), RANG - 0.02 + bas, 0.86 * c.alea.entre(0.95, 1.05));
        }
        c.bloc(r, 'boite', 'pierreClaire', s * xp, hautPile + 0.1, 0, pile + 0.16, 0.2, 0.98);
        c.obstacle(r, s * xp, 0, 0.6);
        c.emprise(r, s * xp, 0, 1.3);
      }
      c.emprise(r, 0, 0, 1.2);
      // L'arc : claveaux en demi-cercle ; arche brisée = seuls les départs restent, le milieu est tombé
      const n = 9;
      const yc = hautPile + 0.2;
      const rm = xp;
      const brisee = c.chance(0.5);
      const gardesGauche = brisee ? c.alea.entier(1, 3) : n;
      const gardesDroite = brisee ? c.alea.entier(1, 3) : n;
      const lt = ((Math.PI * rm) / n) * 1.05;
      for (let k = 0; k < n; k++) {
        if (k >= gardesDroite && k < n - gardesGauche) continue;
        const t = (Math.PI * (k + 0.5)) / n;
        const clef = k === (n - 1) / 2;
        c.bloc(r, 'boite', clef ? 'pierreClaire' : k % 2 ? 'pierre' : 'pierreSombre', Math.cos(t) * rm, yc + Math.sin(t) * rm, 0, lt, clef ? 0.86 : 0.74, clef ? 0.94 : 0.84, 0, 0, t + Math.PI / 2);
      }
      if (brisee) {
        gravats(c, r, 0, 0, 1.3, c.alea.entier(3, 5));
      } else {
        // Arche entière : mousse sur la clef, lierre qui retombe d'une épaule
        const sommet = yc + rm + 0.4;
        c.bloc(r, 'touffe', 'mousse', c.alea.entre(-0.4, 0.4), sommet, 0, 1.5, 0.3, 0.95);
        if (c.chance(0.8)) {
          const s = c.chance(0.5) ? 1 : -1;
          c.bloc(r, 'touffe', 'lierre', s * rm * 0.72, yc + rm * 0.86, 0, 1.2, 0.5, 1.0);
          lierre(c, r, s * (xp + c.alea.entre(-0.2, 0.2)), yc + rm * 0.7, (c.chance(0.5) ? 1 : -1) * 0.47, c.alea.entre(1.6, 2.6));
        }
      }
      // Restes de mur de chaque côté, de plus en plus bas en s'éloignant
      ailes.forEach((longueur, i) => {
        if (longueur <= 0) return;
        const s = i === 0 ? -1 : 1;
        const usure = profilUsure(c, longueur, 0.25, 0);
        mur(c, sousRepere(r, s * (ouverture / 2 + pile), 0, 0, s > 0 ? 0 : Math.PI), {
          longueur,
          hauteur: (x) => (rangs - 0.5) * usure(x) * (1 - (0.55 * x) / longueur) + 0.5,
        });
      });
      c.coffre(r, xp + 0.3, 1.3, 0, false);
    },
  };
}

function tour(alea: Aleatoire): Piece {
  const rayon = alea.entre(2.3, 2.9);
  const rangs = alea.entier(9, 14);
  return {
    type: 'tour',
    rayon: rayon + 1.6,
    construire(c, r) {
      const n = 12;
      const hr = 0.55;
      const ep = 0.66;
      const pas = (Math.PI * 2) / n;
      const corde = 2 * rayon * Math.sin(Math.PI / n) + 0.05;
      // Côté effondré (porte comprise) : la hauteur descend vers lui tout autour
      const chute = c.alea.entre(0, Math.PI * 2);
      const iPorte = Math.round(chute / pas) % n;
      const hauteurs: number[] = [];
      for (let i = 0; i < n; i++) {
        const s = (1 - Math.cos(i * pas - chute)) / 2;
        const v = 0.14 + 0.86 * Math.pow(s, 1.4) + c.alea.entre(-0.14, 0.14);
        hauteurs.push(i === iPorte ? 0 : Math.max(1, Math.round(rangs * Math.min(1, v))));
      }
      // Meurtrières : une pierre en moins, à mi-hauteur, là où le mur est encore haut
      const meurtrieres = new Set<string>();
      for (let k = 0; k < 3; k++) meurtrieres.add(`${c.alea.entier(0, n - 1)}:${c.alea.entier(3, 5)}`);
      const sommets: Array<{ a: number; y: number }> = [];
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < hauteurs[i]; j++) {
          if (meurtrieres.has(`${i}:${j}`) && hauteurs[i] > j + 2) continue;
          const dessus = j === hauteurs[i] - 1;
          if (dessus && j > 1 && c.chance(0.08)) continue;
          const a = (i + (j % 2) * 0.5) * pas;
          const bas = j === 0 ? FONDATION : 0;
          c.bloc(
            r,
            'boite',
            c.chance(0.18) ? 'pierreSombre' : c.chance(0.2) ? 'pierreClaire' : 'pierre',
            Math.sin(a) * rayon,
            j * hr + hr / 2 - bas / 2,
            Math.cos(a) * rayon,
            corde,
            hr - 0.02 + bas,
            ep * c.alea.entre(0.94, 1.07),
            a + (dessus ? c.alea.entre(-0.05, 0.05) : 0),
            0,
            dessus && c.chance(0.15) ? c.alea.entre(-0.08, 0.08) : 0,
          );
          if (dessus) sommets.push({ a, y: (j + 1) * hr });
        }
        if (hauteurs[i] >= 2) c.obstacle(r, Math.sin(i * pas) * rayon, Math.cos(i * pas) * rayon, corde / 2 + 0.14);
      }
      for (const s of sommets) {
        if (c.chance(0.3)) mousse(c, r, Math.sin(s.a) * rayon, s.y, Math.cos(s.a) * rayon, corde, ep, s.a);
      }
      const hauts = sommets.filter((s) => s.y > 2.2);
      for (let k = 0; k < 2 && hauts.length > 0; k++) {
        if (!c.chance(0.6)) continue;
        const s = hauts[c.alea.entier(0, hauts.length - 1)];
        lierre(c, sousRepere(r, 0, 0, 0, s.a), 0, s.y, rayon + ep / 2 + 0.05, c.alea.entre(1.4, 2.6));
      }
      // Éboulis du côté effondré, dehors et dedans ; quelques dalles au sol à l'intérieur
      gravats(c, r, Math.sin(chute) * (rayon + 1.2), Math.cos(chute) * (rayon + 1.2), 2.2, c.alea.entier(4, 7));
      gravats(c, r, Math.sin(chute) * (rayon - 1.1), Math.cos(chute) * (rayon - 1.1), 0.9, c.alea.entier(1, 3));
      for (let k = 0; k < 4; k++) {
        const a = c.alea.entre(0, Math.PI * 2);
        const d = c.alea.entre(0, rayon - 1.2);
        const t = c.alea.entre(0.8, 1.2);
        c.blocAuSol(r, 'dalle', 'dalle', Math.sin(a) * d, 0, Math.cos(a) * d, t, 0.14, t, c.alea.entre(0, 3));
      }
      c.emprise(r, 0, 0, rayon + 1.3);
      // Le coffre est au fond, face à la porte
      c.coffre(r, -Math.sin(chute) * (rayon - 1.25), -Math.cos(chute) * (rayon - 1.25), chute, true);
    },
  };
}

function maison(alea: Aleatoire): Piece {
  const largeur = alea.entre(5, 7);
  const profondeur = alea.entre(4, 5.4);
  const rangs = alea.entier(5, 7);
  return {
    type: 'maison',
    rayon: Math.hypot(largeur, profondeur) / 2 + 0.7,
    construire(c, r) {
      const e = 0.62;
      const lx = largeur / 2;
      const lz = profondeur / 2;
      // Façade (z = +lz) : la porte ; mur du fond : une fenêtre
      const xPorte = c.alea.entre(1.2, largeur - 1.2);
      const xFenetre = c.alea.entre(1.4, largeur - 1.4);
      const usures = [0, 1, 2, 3].map((k) => profilUsure(c, k < 2 ? largeur : profondeur, 0.45, 0.12));
      mur(c, sousRepere(r, -lx, 0, lz, 0), {
        longueur: largeur,
        epaisseur: e,
        hauteur: (x) => rangs * usures[0](x) + 0.5,
        ouvertures: [{ x0: xPorte - 0.62, x1: xPorte + 0.62, bas: 0, haut: 4 }],
      });
      mur(c, sousRepere(r, lx, 0, -lz, Math.PI), {
        longueur: largeur,
        epaisseur: e,
        hauteur: (x) => rangs * usures[1](x) + 0.5,
        ouvertures: [{ x0: xFenetre - 0.5, x1: xFenetre + 0.5, bas: 2, haut: 4 }],
      });
      // Pignons : ils montent en pointe au milieu (l'un des deux est souvent très abîmé)
      const pointe = profondeur - e;
      const abime = c.chance(0.5) ? 0 : 1;
      [-1, 1].forEach((s, k) => {
        const reste = k === abime ? c.alea.entre(0.35, 0.7) : 1;
        mur(c, sousRepere(r, s * (lx - e / 2 - 0.02), 0, s * (lz - e / 2), s > 0 ? Math.PI / 2 : -Math.PI / 2), {
          longueur: pointe,
          epaisseur: e,
          hauteur: (x) => (rangs + (1 - Math.abs((2 * x) / pointe - 1)) * (pointe / 2 / RANG) * 0.85) * usures[2 + k](x) * reste + 0.5,
        });
      });
      // Intérieur : dalles, poutres du toit tombées, parfois le conduit de la cheminée contre un pignon
      for (let k = 0; k < 6; k++) {
        const t = c.alea.entre(0.8, 1.3);
        c.blocAuSol(r, 'dalle', 'dalle', c.alea.entre(-lx + 1.1, lx - 1.1), 0, c.alea.entre(-lz + 1, lz - 1), t, 0.14, t, c.alea.entre(0, 3));
      }
      const poutres = c.alea.entier(0, 2);
      for (let k = 0; k < poutres; k++) {
        const longueur = c.alea.entre(2.6, 3.8);
        const pente = c.alea.entre(0.25, 0.6);
        c.bloc(r, 'boite', 'boisSombre', c.alea.entre(-lx + 1.3, lx - 1.3), Math.sin(pente) * longueur * 0.5 + 0.05, c.alea.entre(-0.5, 0.5), 0.2, 0.2, longueur, c.alea.entre(-0.5, 0.5), -pente, c.alea.entre(-0.3, 0.3));
      }
      const cote = abime === 0 ? 1 : -1;
      if (c.chance(0.55)) {
        const hauteur = rangs + c.alea.entier(2, 5);
        for (let j = 0; j < hauteur; j++) {
          c.bloc(r, 'boite', j % 2 ? 'pierreSombre' : 'pierre', cote * (lx - e - 0.42), j * RANG + RANG / 2, 0, 0.86 * c.alea.entre(0.94, 1.05), RANG - 0.02, 1.1 * c.alea.entre(0.94, 1.05));
        }
        c.bloc(r, 'boite', 'boisSombre', cote * (lx - e - 0.5), 0.12, 0, 0.5, 0.1, 0.7);
        c.obstacle(r, cote * (lx - e - 0.42), 0, 0.6);
      }
      for (let x = -lx + 1; x <= lx - 1 + 1e-6; x += 1.5) for (const z of [-lz + 1, 0, lz - 1]) c.emprise(r, x, z, 1.6);
      // Le coffre : dans le coin du fond, du côté du pignon intact
      c.coffre(r, -cote * (lx - e - 0.75), -lz + e + 0.6, 0, true);
    },
  };
}

function avantPoste(alea: Aleatoire): Piece {
  const cote = 3.6;
  return {
    type: 'avantPoste',
    rayon: 4.6,
    construire(c, r) {
      // Plateforme de grosses pierres : 3 × 3 par rang, 3 rangs (1,5 m) ; un coin du dernier rang s'est écroulé
      const m = cote / 3;
      const coin = { i: c.chance(0.5) ? 0 : 2, k: 2 };
      for (let j = 0; j < 3; j++) {
        for (let i = 0; i < 3; i++) {
          for (let k = 0; k < 3; k++) {
            if (j === 2 && i === coin.i && k === coin.k) continue;
            const bas = j === 0 ? FONDATION : 0;
            c.bloc(r, 'boite', (i + k + j) % 3 === 0 ? 'pierreSombre' : 'pierre', (i - 1) * m, j * RANG + RANG / 2 - bas / 2, (k - 1) * m, m - 0.03, RANG - 0.02 + bas, (m - 0.03) * c.alea.entre(0.97, 1.03), c.alea.entre(-0.015, 0.015));
            if (j === 0) c.obstacle(r, (i - 1) * m, (k - 1) * m, 0.8);
          }
        }
      }
      gravats(c, r, (coin.i - 1) * (m + 0.9), m + 1.1, 0.9, 3);
      const haut = 3 * RANG;
      for (let k = 0; k < 3; k++) if (c.chance(0.4)) mousse(c, r, c.alea.entre(-1.2, 1.2), haut, c.alea.entre(-1.2, 1.2), 0.9, 0.7, c.alea.entre(0, 3));
      // Parapets crénelés sur deux côtés
      const creneaux = (x: number) => (Math.floor(x / 0.6) % 2 === 0 ? 2.5 : 1.5);
      const usureA = profilUsure(c, cote, 0.4, 0.2);
      const usureB = profilUsure(c, cote, 0.4, 0.2);
      mur(c, sousRepere(r, -cote / 2, haut, -cote / 2 + 0.28, 0), { longueur: cote, epaisseur: 0.5, auSol: false, lierre: 0.2, hauteur: (x) => creneaux(x) * usureA(x) });
      mur(c, sousRepere(r, -cote / 2 + 0.28, haut, cote / 2, Math.PI / 2), { longueur: cote, epaisseur: 0.5, auSol: false, lierre: 0.2, hauteur: (x) => creneaux(x) * usureB(x) });
      // Pilier d'angle et hampe brisée
      c.bloc(r, 'boite', 'pierreClaire', -cote / 2 + 0.33, haut + 0.9, -cote / 2 + 0.33, 0.62, 1.8, 0.62);
      c.bloc(r, 'fut', 'boisSombre', -cote / 2 + 0.33, haut + 2.5, -cote / 2 + 0.33, 0.1, 1.5, 0.1, 0, c.alea.entre(-0.2, 0.2), c.alea.entre(0.1, 0.3));
      // Escalier qui longe le côté +x et monte plus haut que la plateforme : il ne mène nulle part
      const marches = c.alea.entier(8, 11);
      const giron = 0.46;
      const hm = 0.3;
      const xe = cote / 2 + 0.68;
      const z0 = -cote / 2 - 0.9;
      for (let i = 0; i < marches; i++) {
        const fin = i >= marches - 2;
        const hauteur = (i + 1) * hm;
        // Les dernières marches sont ébréchées : plus étroites, de travers
        const largeur = fin ? c.alea.entre(0.7, 1.05) : 1.3;
        c.bloc(r, 'boite', i % 2 ? 'pierre' : 'pierreClaire', xe + (fin ? c.alea.entre(-0.15, 0.15) : 0), hauteur / 2 - FONDATION / 2, z0 + i * giron, largeur, hauteur + FONDATION, giron + 0.02, fin ? c.alea.entre(-0.08, 0.08) : 0);
        if (i % 2 === 1) c.obstacle(r, xe, z0 + i * giron, 0.66);
      }
      if (c.chance(0.6)) mousse(c, r, xe, marches * hm, z0 + (marches - 1) * giron, 0.9, giron);
      gravats(c, r, xe, z0 + marches * giron + 0.7, 0.8, c.alea.entier(2, 4));
      lierre(c, sousRepere(r, 0, 0, 0, Math.PI), c.alea.entre(-1, 1), haut, cote / 2 + 0.04, 1.3);
      c.emprise(r, 0, 0, cote * 0.85);
      for (let i = 0; i <= marches; i += 2) c.emprise(r, xe, z0 + i * giron, 1.2);
      c.coffre(r, -0.4, cote / 2 + 0.85, 0, false);
    },
  };
}

const FABRIQUES: Readonly<Record<TypePiece, (alea: Aleatoire) => Piece>> = { muret, colonnes, arche, tour, maison, avantPoste };

/** Tire les dimensions d'une pièce du type demandé (sa construction se fait ensuite, une fois sa place trouvée). */
export function tirerPiece(type: TypePiece, alea: Aleatoire): Piece {
  return FABRIQUES[type](alea);
}

/** Dalles éparses et pierres isolées entre les pièces d'un site (repère au centre du site). */
export function dallage(c: Chantier, r: Repere, rayon: number, dalles: number): void {
  for (let k = 0; k < dalles; k++) {
    const a = c.alea.entre(0, Math.PI * 2);
    const d = Math.sqrt(c.alea.suivant()) * rayon;
    const t = c.alea.entre(0.8, 1.5);
    const x = Math.cos(a) * d;
    const z = Math.sin(a) * d;
    c.blocAuSol(r, 'dalle', c.chance(0.25) ? 'pierreSombre' : 'dalle', x, 0, z, t, 0.14, t * c.alea.entre(0.8, 1), c.alea.entre(0, 3));
    c.emprise(r, x, z, t * 0.6);
  }
}

// --- Petite grotte ----------------------------------------------------------------------------

export interface PlanGrotte {
  /** Distance de l'entrée au pied de la paroi, demi-largeur et hauteur du passage, en mètres */
  profondeur: number;
  demiLargeur: number;
  hauteur: number;
  /** Entrée étayée : poteaux, linteau et lanterne */
  charpente: boolean;
}

/**
 * Alcôve de roche adossée à une paroi. Repère : origine au milieu de l'entrée, +z vers la paroi (le pied de la
 * falaise est à z = profondeur). Rochers clairs dehors, sombres dedans, bleutés au fond près des cristaux.
 * Renvoie les places des cristaux à récolter (repère du site), au fond.
 */
export function construireGrotte(c: Chantier, r: Repere, plan: PlanGrotte, nombreCristaux: number): Array<{ x: number; z: number }> {
  const { profondeur: P, demiLargeur: w, hauteur: H } = plan;
  const a = c.alea;
  const tourner = () => [a.entre(0, 3), a.entre(-0.25, 0.25), a.entre(-0.25, 0.25)] as const;

  // (rochers clairs du dehors gardés pour leur poser une coiffe de mousse : angles de l'entrée, haut de l'amas)
  const coiffes: Bloc[] = [];
  // Parois : une rangée sombre côté passage, doublée dehors par de gros rochers clairs
  for (const s of [-1, 1]) {
    for (let z = -0.3; z <= P + 0.6; z += 1.25) {
      const fond = z > P * 0.45;
      const [ry, rx, rz] = tourner();
      c.bloc(r, 'roc', fond && c.chance(0.5) ? 'rocheLueur' : 'rocheSombre', s * (w + 0.95 + a.entre(-0.1, 0.15)), H * 0.42, z, a.entre(2.1, 2.5), H * 1.35, a.entre(1.9, 2.3), ry, rx, rz);
      const [ry2, rx2, rz2] = tourner();
      c.bloc(r, 'roc', 'roche', s * (w + 1.9 + a.entre(-0.2, 0.3)), H * 0.5 + z * 0.12, z + a.entre(-0.3, 0.3), a.entre(2.6, 3.4), H * 1.5 + z * 0.25, a.entre(2.4, 3), ry2, rx2, rz2);
    }
    for (let z = -0.4; z <= P + 0.2; z += 0.95) c.obstacle(r, s * (w + 0.9), z, 0.9);
    // Rocher d'angle de chaque côté de l'entrée, et quelques blocs éboulés devant
    const [ry, rx, rz] = tourner();
    c.bloc(r, 'roc', 'roche', s * (w + 1.6), 0.8, -1.1, a.entre(2, 2.6), a.entre(2.2, 2.9), a.entre(2, 2.5), ry, rx, rz);
    coiffes.push(c.blocs[c.blocs.length - 1]);
    c.obstacle(r, s * (w + 1.7), -1.1, 1.0);
    for (let k = 0; k < 2; k++) {
      const t = a.entre(0.45, 1.0);
      const [ry3, rx3, rz3] = tourner();
      c.blocAuSol(r, 'roc', 'roche', s * (w + a.entre(1.2, 3.6)), t * 0.2, -a.entre(2, 4.4), t * 1.2, t, t, ry3, rx3, rz3);
    }
  }
  // Voûte : dalles sombres au-dessus du passage, puis un amas clair qui monte vers la falaise
  for (let z = 0.2; z <= P + 0.4; z += 1.2) {
    const [ry, rx, rz] = tourner();
    c.bloc(r, 'roc', z > P * 0.45 ? 'rocheLueur' : 'rocheSombre', a.entre(-0.3, 0.3), H + 0.72, z, 2 * w + 2.6, 1.6, 2.3, ry * 0.05, rx, rz * 0.4);
  }
  for (let z = 0; z <= P + 1.2; z += 1.4) {
    const [ry, rx, rz] = tourner();
    c.bloc(r, 'roc', 'roche', a.entre(-0.5, 0.5), H + 1.5 + z * 0.3, z, 2 * w + a.entre(3.6, 4.6), 2.6 + z * 0.2, 3, ry * 0.08, rx, rz * 0.5);
    if (z === 0 || z > P - 0.5) coiffes.push(c.blocs[c.blocs.length - 1]);
  }
  // Linteau naturel au-dessus de l'entrée
  c.bloc(r, 'roc', 'roche', 0, H + 0.95, -0.35, 2 * w + 3.4, 1.7, 2, 0, a.entre(-0.1, 0.1), a.entre(-0.08, 0.08));
  // Fond : rochers bleutés, juste devant le pied de la falaise
  for (const x of [-w * 0.75, 0, w * 0.75]) {
    const [ry, rx, rz] = tourner();
    c.bloc(r, 'roc', 'rocheLueur', x + a.entre(-0.2, 0.2), H * 0.5, P - 0.35, 2.2, H * 1.3, 1.7, ry, rx, rz);
    c.obstacle(r, x, P - 0.2, 0.9);
  }
  // Sol de terre battue, de devant l'entrée jusqu'au fond
  for (let z = -2.8; z <= P - 0.9; z += 0.85) {
    const t = z < -0.9 ? a.entre(1.8, 2.6) : 2 * w + 1.8;
    c.blocAuSol(r, 'dalle', 'terre', a.entre(-0.2, 0.2), 0, z, t, 0.2, 2.2, a.entre(-0.15, 0.15));
  }
  // Petits éclats de cristal lumineux dans les parois et la voûte du fond (décor)
  const eclats = a.entier(4, 7);
  for (let k = 0; k < eclats; k++) {
    const z = a.entre(P * 0.35, P - 1.3);
    const t = a.entre(0.35, 0.7);
    if (c.chance(0.3)) {
      c.bloc(r, 'eclat', 'cristal', a.entre(-w * 0.6, w * 0.6), H - 0.05 - t * 0.3, z, t * 0.4, t, t * 0.4, a.entre(0, 3), Math.PI + a.entre(-0.3, 0.3), a.entre(-0.3, 0.3));
    } else {
      const s = c.chance(0.5) ? 1 : -1;
      c.bloc(r, 'eclat', 'cristal', s * (w - 0.05), a.entre(0.4, H - 0.7), z, t * 0.4, t, t * 0.4, a.entre(0, 3), a.entre(-0.3, 0.3), s * a.entre(0.7, 1.2));
    }
  }
  if (plan.charpente) {
    // Étais de l'entrée : deux poteaux, un linteau, deux jambes de force, et la lanterne au bout de sa potence
    const yL = H - 0.12;
    for (const s of [-1, 1]) {
      c.bloc(r, 'boite', 'bois', s * (w - 0.12), yL / 2 - 0.3, -0.25, 0.3, yL + 0.6, 0.3, a.entre(-0.04, 0.04));
      c.bloc(r, 'boite', 'boisSombre', s * (w - 0.52), yL - 0.42, -0.25, 0.16, 1.0, 0.18, 0, 0, s * (Math.PI / 4));
    }
    c.bloc(r, 'boite', 'bois', 0, yL + 0.16, -0.25, 2 * w + 0.7, 0.32, 0.36, 0, 0, a.entre(-0.02, 0.02));
    const s = c.chance(0.5) ? 1 : -1;
    // (la potence part du poteau vers l'avant : la lanterne pend devant l'entrée, sur le côté)
    const xl = s * (w - 0.12);
    c.bloc(r, 'boite', 'boisSombre', xl, yL - 0.2, -0.75, 0.1, 0.1, 0.8);
    c.bloc(r, 'boite', 'boisSombre', xl, yL - 0.36, -1.05, 0.04, 0.24, 0.04);
    c.bloc(r, 'boite', 'pierreSombre', xl, yL - 0.49, -1.05, 0.3, 0.05, 0.3);
    c.bloc(r, 'boite', 'lanterne', xl, yL - 0.67, -1.05, 0.22, 0.3, 0.22);
    c.bloc(r, 'boite', 'pierreSombre', xl, yL - 0.84, -1.05, 0.28, 0.05, 0.28);
  }
  // Habillage, d'après « Petite grotte aux cristaux bleus ». Il a son propre générateur (tiré des dimensions de la
  // grotte) et donne lui-même la teinte de ses blocs : la suite des tirages du site (coffre, cristaux) ne change pas.
  const d = creerAleatoire(Math.floor(((P * 7.31 + w * 13.7 + H * 3.1) % 1) * 4294967296));
  for (const s of [-1, 1]) {
    // Épaules de l'arche : un rocher penché dans chaque coin haut de l'entrée, qui arrondit l'ouverture
    c.bloc(r, 'roc', 'roche', s * (w + 0.5), H + 0.05, -0.5, 1.7, 1.5, 1.6, d.entre(0, 3), d.entre(-0.2, 0.2), -s * 0.5 + d.entre(-0.15, 0.15), d.suivant());
    // Éboulis au pied de l'entrée, et touffes d'herbe entre les blocs
    const t = d.entre(0.5, 0.8);
    c.blocAuSol(r, 'roc', d.suivant() < 0.4 ? 'rocheSombre' : 'roche', s * (w + d.entre(0.3, 0.9)), t * 0.25, -d.entre(1.9, 2.7), t * 1.25, t, t, d.entre(0, 3), d.entre(-0.25, 0.25), d.entre(-0.25, 0.25), d.suivant());
    for (let k = 0; k < 3; k++) {
      const h = d.entre(0.45, 0.8);
      c.blocAuSol(r, 'herbe', d.suivant() < 0.75 ? 'mousse' : 'lierre', s * (w + d.entre(-0.2, 1.6)), h / 2 - 0.04, -d.entre(1.7, 3.8), h * 1.1, h, h * 1.1, d.entre(0, 6), 0, 0, d.suivant());
    }
  }
  // Coiffes de mousse : le même rocher, un peu plus étroit et remonté, dont seules les facettes du haut dépassent
  for (const b of coiffes) {
    c.blocs.push({ ...b, matiere: 'mousse', y: b.y + d.entre(0.1, 0.16), lx: b.lx * d.entre(0.72, 0.84), lz: b.lz * d.entre(0.72, 0.84), teinte: d.suivant() });
  }
  // Dalles de pierre sur la terre du passage
  for (let k = 0; k < 3; k++) {
    const t = d.entre(0.6, 1.05);
    c.blocAuSol(r, 'dalle', 'dalle', d.entre(-w * 0.6, w * 0.6), 0.07, -2.4 + k * ((P * 0.45 + 2.4) / 2) + d.entre(-0.3, 0.3), t, 0.12, t * d.entre(0.75, 1), d.entre(0, 3), 0, 0, d.suivant());
  }
  // Grands cristaux plantés dans la paroi du fond, penchés vers l'entrée, chacun avec un petit à son pied
  for (const s of [-1, 1]) {
    const x = s * w * d.entre(0.3, 0.55);
    const y = d.entre(1.25, H - 0.9);
    const t = d.entre(1.0, 1.4);
    c.bloc(r, 'eclat', 'cristal', x, y, P - 1.4, t * 0.42, t, t * 0.42, d.entre(0, 3), -d.entre(0.3, 0.55), d.entre(-0.4, 0.4), d.suivant());
    c.bloc(r, 'eclat', 'cristal', x + s * d.entre(0.3, 0.45), y - d.entre(0.2, 0.35), P - 1.4, t * 0.24, t * 0.55, t * 0.24, d.entre(0, 3), -d.entre(0.4, 0.7), s * d.entre(0.2, 0.6), d.suivant());
  }
  // Emprise : l'alcôve et un dégagement devant l'entrée (pas d'arbre dans le passage)
  for (let z = -6.5; z <= P + 1; z += 1.5) c.emprise(r, 0, z, w + (z < -2.5 ? 1.6 : 3.2));
  // Coffre : à mi-profondeur, contre une paroi, tourné vers le passage
  const sc = c.chance(0.5) ? 1 : -1;
  c.coffre(r, sc * (w - 0.6), P * 0.42, (-sc * Math.PI) / 2, true);

  // Cristaux à récolter : en ligne au fond, devant la paroi
  const places: Array<{ x: number; z: number }> = [];
  for (let k = 0; k < nombreCristaux; k++) {
    const t = nombreCristaux === 1 ? 0.5 : k / (nombreCristaux - 1);
    const x = (t * 2 - 1) * (w - 0.55) + a.entre(-0.15, 0.15);
    const z = P - 1.75 + a.entre(-0.25, 0.1);
    const p = sousRepere(r, x, 0, z, 0);
    places.push({ x: p.x, z: p.z });
  }
  return places;
}
