// Coiffures des habitants : une seule masse de cheveux à facettes, calculée à partir de la forme du crâne
// (même principe que les cheveux du héros dans personnage.ts). Le bord bas de la masse rentre dans le crâne :
// on ne voit jamais la peau entre deux facettes, ni le dessous de la masse. La frange est une bande à part,
// posée devant. Tout est dans le repère de la tête (pivot à la base du crâne, l'avant regarde +z).
// Aucune règle de jeu ici, et aucun hasard : le désordre des facettes est le même à chaque lancement.

import * as THREE from 'three';
import type { Anneau } from './outils';

/** Un triangle et son ton (0 : ton principal, 1 : ton sombre). */
export type Facette = [THREE.Vector3, THREE.Vector3, THREE.Vector3, number];

export interface Coiffure {
  /** Tranches du crâne (les mêmes que celles données à `fuseau`) */
  crane: Anneau[];
  /** Point le plus haut de la masse */
  sommet: [number, number, number];
  /** Volume arrondi de la coupe : centre, demi-hauteur, demi-largeur, demi-profondeur devant et derrière */
  centreY: number;
  ry: number;
  rx: number;
  rzAvant: number;
  rzArriere: number;
  /** Sous le centre, le volume se resserre : de `resserre` (part du rayon) à la hauteur `basY` */
  basY: number;
  resserre: number;
  /** Épaisseur minimale au-dessus du crâne */
  epaisseur: number;
  /** Au bord bas, la masse se resserre contre le crâne : épaisseur au bord (absent : le bord garde tout le volume) */
  epaisseurBord?: number;
  /**
   * Bord bas de la masse, d'un côté (l'autre est son reflet) : [angle en degrés (0 devant, 90 oreille,
   * 180 nuque), hauteur]. Le premier angle est 0, le dernier 180.
   */
  bord: [number, number][];
  /** Étages de la masse : du bord (0) jusqu'à la hauteur `pivotY` (1), puis à hauteur fixe sur le dessus */
  pivotY: number;
  etagesBas: number[];
  etagesHaut: number[];
  /** Désordre des facettes, vers l'extérieur seulement (mètres) */
  desordre: number;
  /** Frange : bord bas du côté droit au côté gauche ([angle, hauteur]), puis hauteurs du milieu et du haut de la bande */
  frange?: { bord: [number, number][]; yMilieu: number; yHaut: number };
}

const RAD = Math.PI / 180;
const melange = (a: number, b: number, t: number): number => a + (b - a) * t;
const borne = (v: number, mini: number, maxi: number): number => Math.max(mini, Math.min(maxi, v));

/** Nombre fixe entre 0 et 1 tiré de deux entiers : du désordre dans les facettes, identique à chaque lancement. */
export function hasard(i: number, j: number): number {
  const v = Math.sin(i * 12.9898 + j * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/** Écart à l'avant de la tête, de 0 (devant) à 180 (nuque), pour un angle en degrés quelconque. */
export function ecartAvant(degres: number): number {
  return Math.abs(((((degres + 180) % 360) + 360) % 360) - 180);
}

/**
 * Distance de l'axe de la tête à la surface du crâne, à la hauteur `y`, dans la direction `angle`
 * (radians, 0 : devant, +90° : côté gauche). Le crâne est un `fuseau` : des tranches à 8 côtés.
 */
export function rayonCrane(crane: Anneau[], angle: number, y: number): number {
  let k = 0;
  while (k < crane.length - 2 && y > crane[k + 1].y) k++;
  const a = crane[k];
  const b = crane[k + 1];
  const t = borne((y - a.y) / (b.y - a.y), 0, 1);
  // Coin coupé : même valeur par défaut que `fuseau`
  const coin = (n: Anneau): number => Math.min(n.c ?? Math.min(n.rx, n.rz) * 0.34, n.rx, n.rz);
  const rx = melange(a.rx, b.rx, t);
  const rz = melange(a.rz, b.rz, t);
  const c = melange(coin(a), coin(b), t);
  const dx = melange(a.dx ?? 0, b.dx ?? 0, t);
  const dz = melange(a.dz ?? 0, b.dz ?? 0, t);
  const s = Math.sin(angle);
  const co = Math.cos(angle);
  // La tranche est l'intersection de 8 demi-plans : on avance le long du rayon jusqu'au premier franchi
  let r = Infinity;
  for (const [nx, nz, limite] of [
    [1, 0, rx],
    [0, 1, rz],
    [1, 1, rx + rz - c],
    [1, -1, rx + rz - c],
  ]) {
    const pente = nx * s + nz * co;
    const decalage = nx * dx + nz * dz;
    if (pente > 1e-6) r = Math.min(r, (limite + decalage) / pente);
    else if (pente < -1e-6) r = Math.min(r, (limite - decalage) / -pente);
  }
  return r;
}

/** Hauteur du bord bas de la masse de cheveux dans la direction `degres`. */
function bordMasse(c: Coiffure, degres: number): number {
  const B = c.bord;
  const a = ecartAvant(degres);
  let k = 0;
  while (k < B.length - 2 && a > B[k + 1][0]) k++;
  return melange(B[k][1], B[k + 1][1], borne((a - B[k][0]) / (B[k + 1][0] - B[k][0]), 0, 1));
}

/**
 * Rayon de la masse de cheveux à la hauteur `y` dans la direction `angle` (radians) : un volume arrondi,
 * jamais plus près du crâne que l'épaisseur minimale.
 */
export function rayonCoiffure(c: Coiffure, angle: number, y: number): number {
  const s = Math.sin(angle);
  const co = Math.cos(angle);
  const equateur = 1 / Math.hypot(s / c.rx, co / (co >= 0 ? c.rzAvant : c.rzArriere));
  let h: number;
  if (y >= c.centreY) {
    const v = (y - c.centreY) / c.ry;
    h = Math.sqrt(Math.max(0, 1 - v * v));
  } else {
    const u = (c.centreY - y) / (c.centreY - c.basY);
    h = 1 - c.resserre * u * u;
  }
  const hautCrane = c.crane[c.crane.length - 1].y;
  const crane = y > hautCrane ? 0 : rayonCrane(c.crane, angle, y) + c.epaisseur;
  return Math.max(crane, equateur * h);
}

function point(degres: number, y: number, r: number): THREE.Vector3 {
  return new THREE.Vector3(Math.sin(degres * RAD) * r, y, Math.cos(degres * RAD) * r);
}

const ton = (i: number, j: number): number => (hasard(i + 31, j + 7) > 0.62 ? 1 : 0);

/** La masse : calotte, côtés, favoris et nuque d'un seul tenant, fermée en bas par un retour dans le crâne. */
export function facettesMasse(c: Coiffure): Facette[] {
  // Colonnes tout autour de la tête (angles du bord et leur reflet), étages décalés d'une demi-colonne un sur deux
  const angles: number[] = [];
  for (let k = c.bord.length - 2; k >= 1; k--) angles.push(-c.bord[k][0]);
  for (const [a] of c.bord) angles.push(a);
  const n = angles.length;
  const suivant = (i: number): number => (i + 1 < n ? angles[i + 1] : angles[0] + 360);
  const nbBas = c.etagesBas.length;
  const bordAvant = c.bord[0][1];
  const lignes: THREE.Vector3[][] = [...c.etagesBas, ...c.etagesHaut].map((f, j) =>
    angles.map((angle, i) => {
      const a = j % 2 === 1 ? (angle + suivant(i)) / 2 : angle;
      const bord = bordMasse(c, a);
      const y = j < nbBas ? melange(bord, c.pivotY, f) : f;
      // Désordre vers l'extérieur seulement (la masse ne rentre jamais dans le crâne), et aucun sur le front,
      // où les étages sont serrés et où la frange rejoint la masse
      const place =
        j === 0 ? 0 : j < nbBas ? borne((bordAvant - bord) / 0.13, 0, 1) : j === nbBas ? borne((ecartAvant(a) - 45) / 30, 0, 1) : 1;
      let r = rayonCoiffure(c, a * RAD, y) + c.desordre * hasard(i, j) * place;
      if (j === 0 && c.epaisseurBord !== undefined) r = Math.min(r, rayonCrane(c.crane, a * RAD, y) + c.epaisseurBord);
      return point(a, y, r);
    }),
  );
  // Retour du bord vers l'intérieur du crâne : la masse a une épaisseur, on ne voit jamais dessous
  const dessous = angles.map((a) => {
    const y = bordMasse(c, a) + 0.012;
    return point(a, y, Math.max(0.02, rayonCrane(c.crane, a * RAD, y) - 0.02));
  });
  const sommet = new THREE.Vector3(...c.sommet);
  const masse: Facette[] = [];
  for (let i = 0; i < n; i++) {
    const i1 = (i + 1) % n;
    masse.push([dessous[i], dessous[i1], lignes[0][i1], 1], [dessous[i], lignes[0][i1], lignes[0][i], 1]);
    for (let j = 0; j < lignes.length - 1; j++) {
      const bas = lignes[j];
      const haut = lignes[j + 1];
      if (j % 2 === 0) {
        masse.push([bas[i], bas[i1], haut[i], ton(i, 2 * j)], [bas[i1], haut[i1], haut[i], ton(i, 2 * j + 1)]);
      } else {
        masse.push([bas[i], bas[i1], haut[i1], ton(i, 2 * j)], [bas[i], haut[i1], haut[i], ton(i, 2 * j + 1)]);
      }
    }
    const dernier = lignes[lignes.length - 1];
    masse.push([dernier[i], dernier[i1], sommet, ton(i, 99)]);
  }
  return masse;
}

/** La frange : bande posée devant la masse, du haut du front (rentrée dans la masse) aux pointes des mèches. */
export function facettesFrange(c: Coiffure): Facette[] {
  if (!c.frange) return [];
  const F = c.frange.bord;
  const { yMilieu, yHaut } = c.frange;
  const rangs = F.map(([a, yBas], i) => {
    // Les deux bouts rentrent dans la masse des tempes
    const retrait = i === 0 || i === F.length - 1 ? 0.025 : 0;
    const yDessous = yBas + 0.012;
    return [
      point(a, yDessous, rayonCrane(c.crane, a * RAD, yDessous) - 0.02),
      point(a, yBas, rayonCoiffure(c, a * RAD, yBas) + 0.011 - retrait),
      point(a, yMilieu, rayonCoiffure(c, a * RAD, yMilieu) + 0.018 - retrait),
      point(a, yHaut, rayonCoiffure(c, a * RAD, yHaut) - 0.013),
    ];
  });
  const frange: Facette[] = [];
  for (let i = 0; i < F.length - 1; i++) {
    for (let j = 0; j < 3; j++) {
      const a = rangs[i][j];
      const b = rangs[i + 1][j];
      const d = rangs[i + 1][j + 1];
      const e = rangs[i][j + 1];
      frange.push([a, b, d, j === 0 ? 1 : ton(i, 40 + j)], [a, d, e, j === 0 ? 1 : ton(i, 50 + j)]);
    }
  }
  return frange;
}

/** Géométrie des facettes d'un seul ton (pour les modèles fondus par couleur de matériau). */
export function geometrieTon(facettes: Facette[], tonVoulu: number): THREE.BufferGeometry {
  const positions: number[] = [];
  for (const [a, b, c, t] of facettes) {
    if (t !== tonVoulu) continue;
    for (const p of [a, b, c]) positions.push(p.x, p.y, p.z);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/** Géométrie de toutes les facettes, la couleur de chaque ton portée par les sommets (matériau blanc, `vertexColors`). */
export function geometrieCouleurs(facettes: Facette[], tons: [number, number]): THREE.BufferGeometry {
  const couleursTons = tons.map((t) => new THREE.Color(t));
  const positions: number[] = [];
  const couleurs: number[] = [];
  for (const [a, b, c, t] of facettes) {
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      couleurs.push(couleursTons[t].r, couleursTons[t].g, couleursTons[t].b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  g.computeVertexNormals();
  return g;
}

/** Ton sombre d'une couleur de cheveux (pour que les facettes se lisent). */
export function tonSombre(couleur: number, facteur = 0.87): number {
  return new THREE.Color(couleur).multiplyScalar(facteur).getHex();
}
