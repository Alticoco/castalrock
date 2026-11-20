// Armures visibles sur le personnage (3e personne) : fibres, cuir, fourrure, mailles, plaques ; manches
// d'armure des bras en 1re personne ; casques posés sur la tête.
// Chaque pièce est accrochée à un groupe du squelette (buste, bassin, épaules, coudes, hanches, genoux,
// chevilles) : elle suit donc toutes les animations sans rien animer de plus. Les pièces d'un type sont
// construites à la première demande, puis seulement montrées ou cachées. Pour la fluidité, toutes les pièces
// d'un même groupe et d'une même matière sont fusionnées en un seul maillage ; la couleur est portée par
// les facettes (couleurs par sommet), ce qui évite un matériau par teinte.
// Les dimensions sont dans le repère de chaque groupe, en mètres avant la mise à l'échelle du corps.

import * as THREE from 'three';
import type { TypeArmure, TypeCasque } from '../regles/equipement';
import { ecartAvant, hasard } from './coiffures';
import { creerMateriau, fuseau, type Anneau } from './outils';

/** Les groupes du squelette et les parties du corps qu'une armure peut remplacer (donc cacher). */
export interface CorpsArmure {
  haut: THREE.Group;
  bassin: THREE.Group;
  /** Bas de la tunique : quatre quartiers, un par volet du bassin */
  basTunique: THREE.Object3D[];
  /** Volet du dos, articulé en haut du buste : la cape s'y accroche et se soulève quand les jambes passent derrière */
  cape: THREE.Group;
  /** Ceinture du villageois, sa boucle et son ardillon */
  ceinture: THREE.Object3D[];
  bras: {
    /** 1 : gauche (+x), -1 : droit */
    cote: number;
    epaule: THREE.Group;
    coude: THREE.Group;
    manche: THREE.Object3D;
    avantBras: THREE.Object3D;
    /** Main et pouce */
    main: THREE.Object3D[];
  }[];
  jambes: {
    cote: number;
    hanche: THREE.Group;
    genou: THREE.Group;
    cheville: THREE.Group;
    /**
     * Volets du bassin, devant et derrière cette jambe : ce qui pend de la ceinture (pans, bas de tunique ou de cotte)
     * s'y accroche et s'écarte avec la cuisse au lieu d'être traversé. Mêmes coordonnées que le bassin.
     */
    voletAvant: THREE.Group;
    voletArriere: THREE.Group;
    pantalon: THREE.Object3D;
    revers: THREE.Object3D;
    tige: THREE.Object3D;
    pied: THREE.Object3D;
  }[];
}

/** Un jeu de pièces à porter (armures, manches, casques) dont on montre un type à la fois. */
export interface GardeRobe<T extends string> {
  /** Montre les pièces de ce type (ou aucune) ; les parties du corps qu'elles remplacent sont cachées, puis remontrées. */
  definir(type: T | null): void;
  /** Matériaux des pièces : le personnage leur applique le mode « ombre seule » de la 1re personne. */
  materiaux: THREE.Material[];
}
export type Armures = GardeRobe<TypeArmure>;

// Tranches du corps du villageois (mêmes valeurs que dans personnage.ts) : les pièces d'armure les épousent
const TORSE: Anneau[] = [
  { y: 0.0, rx: 0.238, rz: 0.152, c: 0.06 },
  { y: 0.2, rx: 0.255, rz: 0.165, c: 0.065 },
  { y: 0.345, rx: 0.255, rz: 0.158, c: 0.07 },
  { y: 0.4, rx: 0.19, rz: 0.12, c: 0.05 },
];
const CEINTURE: Anneau[] = [
  { y: -0.04, rx: 0.25, rz: 0.165, c: 0.06 },
  { y: 0.035, rx: 0.25, rz: 0.165, c: 0.06 },
];
const MANCHE: Anneau[] = [
  { y: -0.26, rx: 0.074, rz: 0.08 },
  { y: -0.03, rx: 0.08, rz: 0.086 },
  { y: 0.025, rx: 0.064, rz: 0.072 },
];
const AVANT_BRAS: Anneau[] = [
  { y: -0.215, rx: 0.09, rz: 0.096 },
  { y: 0.02, rx: 0.073, rz: 0.079 },
];
const MAIN: Anneau[] = [
  { y: -0.385, rx: 0.042, rz: 0.056 },
  { y: -0.345, rx: 0.066, rz: 0.08 },
  { y: -0.25, rx: 0.07, rz: 0.082 },
  { y: -0.19, rx: 0.055, rz: 0.06 },
];
const CUISSE: Anneau[] = [
  { y: -0.37, rx: 0.1, rz: 0.104 },
  { y: 0.05, rx: 0.108, rz: 0.11 },
];
const PIED: Anneau[] = [
  { y: -0.08, rx: 0.1, rz: 0.15, dz: 0.05 },
  { y: -0.03, rx: 0.102, rz: 0.153, dz: 0.05 },
  { y: 0.035, rx: 0.094, rz: 0.1, dz: 0.005 },
];

const COULEURS = {
  // Fibres : paille tressée et corde
  paille: 0xd2b97c,
  pailleSombre: 0xb89c5e,
  corde: 0xa98a52,
  cordeSombre: 0x8c7041,
  // Cuir
  cuir: 0x8f5735,
  cuirSombre: 0x6c4029,
  cuirClair: 0xa56c40,
  laiton: 0xb99a5c,
  // Fourrure : poils crème, peau taupe
  creme: 0xe8d6a8,
  cremeSombre: 0xd3bd8c,
  taupe: 0x9c8473,
  taupeSombre: 0x846d5e,
  // Mailles : anneaux gris-bleu (teinte multipliée par le dessin des anneaux), dessous gris foncé
  anneaux: 0xb4c4ee,
  dessous: 0x4b505d,
  gants: 0x5b606e,
  botte: 0x6b4a35,
  hautBotte: 0x5c4640,
  // Plaques : acier bleuté
  acier: 0xb2bedb,
  acierClair: 0xcfd8ec,
  acierSombre: 0x8a96b3,
};

/** Matière d'une pièce : mate (cuir, tissu, fourrure), acier (plus lisse) ou mailles (anneaux dessinés). */
type Matiere = 'mat' | 'acier' | 'mailles';

// Aspect de l'acier des plaques : plus lisse que le cuir ou le tissu
const ACIER = { roughness: 0.45, metalness: 0.1 };
// Aspect des mailles : un peu brillantes, avec un léger relief des anneaux
const MAILLES = { roughness: 0.5, metalness: 0.15, relief: 0.7 };

// Largeur d'un carreau du dessin des anneaux sur le corps, en mètres (un carreau = 8 anneaux de large) :
// des anneaux de 2 cm environ
const CARREAU_MAILLES = 0.16;
let dessinMailles: THREE.CanvasTexture | null = null;

/**
 * Dessin des anneaux de la cotte de mailles, fait une fois et partagé : petits anneaux ovales en quinconce,
 * chaque rang passant par-dessus le précédent, en gris peu contrastés (la teinte vient de la couleur des
 * facettes ; le fond reste un gris moyen, pas de trous noirs). Le dessin se répète sans raccord ; ses
 * réductions (mipmaps) le fondent en un gris uni de loin, sans scintillement.
 */
function creerDessinMailles(): THREE.CanvasTexture | null {
  if (dessinMailles) return dessinMailles;
  if (typeof document === 'undefined') return null;
  const taille = 512;
  const colonnes = 8;
  // Rangs serrés : on voit, dans chaque anneau, le bas des deux anneaux du rang du dessus (mailles entrelacées)
  const rangs = 14;
  const canevas = document.createElement('canvas');
  canevas.width = taille;
  canevas.height = taille;
  const c = canevas.getContext('2d');
  if (!c) return null;
  c.fillStyle = '#7a7a7a';
  c.fillRect(0, 0, taille, taille);
  c.lineCap = 'round';
  const pas = taille / colonnes;
  const pasRang = taille / rangs;
  const rx = pas * 0.45;
  const ry = pas * 0.37;
  // Du haut vers le bas : chaque rang passe par-dessus le précédent ; les bords débordent pour le raccord
  for (let rang = -1; rang <= rangs; rang++) {
    for (let col = -1; col <= colonnes; col++) {
      const x = (col + (rang % 2 === 0 ? 0.5 : 1)) * pas;
      const y = (rang + 0.5) * pasRang;
      // Chaque anneau est un peu plus clair ou plus sombre que ses voisins (même valeur d'un bord à l'autre du carreau)
      const ton = 0.95 + 0.1 * hasard((col + colonnes) % colonnes, (rang + rangs) % rangs);
      const gris = (v: number) => {
        const g = Math.min(255, Math.round(v * ton));
        return `rgb(${g},${g},${g})`;
      };
      const trait = (largeur: number, couleur: string, dy: number, debut: number, fin: number) => {
        c.beginPath();
        c.ellipse(x, y + dy, rx, ry, 0, debut, fin);
        c.lineWidth = largeur;
        c.strokeStyle = couleur;
        c.stroke();
      };
      // Ombre portée sur le rang du dessus, corps de l'anneau, moitié haute plus claire, reflet
      trait(pas * 0.18, '#6a6a6a', pas * 0.025, 0, Math.PI * 2);
      trait(pas * 0.125, gris(186), 0, 0, Math.PI * 2);
      trait(pas * 0.125, gris(216), 0, Math.PI * 1.02, Math.PI * 1.98);
      trait(pas * 0.04, gris(250), -pas * 0.02, Math.PI * 1.15, Math.PI * 1.7);
    }
  }
  dessinMailles = new THREE.CanvasTexture(canevas);
  dessinMailles.colorSpace = THREE.SRGBColorSpace;
  dessinMailles.wrapS = dessinMailles.wrapT = THREE.RepeatWrapping;
  dessinMailles.anisotropy = 8;
  return dessinMailles;
}

/**
 * Coordonnées du dessin des mailles pour les triangles de `P` à partir de `debut` : le dessin est enroulé autour
 * de l'axe vertical de la pièce (comme une étiquette autour d'une bouteille), il se prolonge donc d'une facette
 * à l'autre. Le tour fait un nombre entier de carreaux : pas de raccord visible dans le dos. Les facettes
 * presque horizontales (dessus, dessous) sont dessinées à plat.
 */
function enroulerMailles(P: number[], debut: number, carreau: number, uv: number[]): void {
  let somme = 0;
  let n = 0;
  for (let i = debut; i < P.length; i += 3) {
    const r = Math.hypot(P[i], P[i + 2]);
    if (r > 1e-3) {
      somme += r;
      n++;
    }
  }
  const carreauxParTour = Math.max(1, Math.round((2 * Math.PI * somme) / Math.max(1, n) / carreau));
  const parRadian = carreauxParTour / (2 * Math.PI);
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let i = debut; i < P.length; i += 9) {
    a.set(P[i], P[i + 1], P[i + 2]);
    b.set(P[i + 3], P[i + 4], P[i + 5]);
    c.set(P[i + 6], P[i + 7], P[i + 8]);
    const normale = b.sub(a).cross(c.sub(a)).normalize();
    if (Math.abs(normale.y) > 0.85) {
      for (let k = 0; k < 9; k += 3) uv.push(P[i + k] / carreau, P[i + k + 2] / carreau);
      continue;
    }
    const angles = [0, 3, 6].map((k) => Math.atan2(P[i + k], P[i + k + 2]));
    const maxi = Math.max(...angles);
    angles.forEach((angle, k) => {
      // Facette à cheval sur la couture du dos : ses sommets sont ramenés du même côté
      uv.push((maxi - angle > Math.PI ? angle + 2 * Math.PI : angle) * parRadian, P[i + k * 3 + 1] / carreau);
    });
  }
}

/** Tranche du volume `tranches` à la hauteur `y` (entre deux tranches : mélange). */
function trancheA(tranches: Anneau[], y: number): Anneau {
  const coin = (a: Anneau) => a.c ?? Math.min(a.rx, a.rz) * 0.34;
  let k = 0;
  while (k < tranches.length - 2 && y > tranches[k + 1].y) k++;
  const a = tranches[k];
  const b = tranches[k + 1];
  const t = Math.max(0, Math.min(1, (y - a.y) / (b.y - a.y)));
  const m = (u: number, v: number) => u + (v - u) * t;
  return { y, rx: m(a.rx, b.rx), rz: m(a.rz, b.rz), c: m(coin(a), coin(b)), dx: m(a.dx ?? 0, b.dx ?? 0), dz: m(a.dz ?? 0, b.dz ?? 0) };
}

/** Le morceau de `tranches` compris entre les hauteurs `y0` et `y1`. */
function portion(tranches: Anneau[], y0: number, y1: number): Anneau[] {
  return [trancheA(tranches, y0), ...tranches.filter((a) => a.y > y0 + 1e-4 && a.y < y1 - 1e-4), trancheA(tranches, y1)];
}

/** Les mêmes tranches, plus larges de `e` tout autour : une pièce portée par-dessus. */
function gonfler(tranches: Anneau[], e: number): Anneau[] {
  return tranches.map((a) => ({ ...a, rx: a.rx + e, rz: a.rz + e, c: a.c === undefined ? undefined : a.c + e * 0.4 }));
}

/** Position et orientation d'une pièce : rotation autour de z, puis de x, puis de y, puis déplacement. */
function pose(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
    new THREE.Vector3(1, 1, 1),
  );
}

/**
 * Pan plat à pointe (lambeau de cuir, touffe de poils, plaque) : largeur `l`, hauteur `h` dont `pointe` pour la
 * pointe, épaisseur `ep`. Il pend de y = 0 vers le bas, sa face extérieure vers +z. `moitie` : 1 ou -1 pour
 * n'en faire que la moitié de ce côté (un pan au milieu du corps est partagé entre les deux jambes).
 */
function pan(l: number, h: number, pointe: number, ep = 0.02, moitie: 0 | 1 | -1 = 0): THREE.BufferGeometry {
  const forme = new THREE.Shape();
  if (moitie !== 0) {
    // Une moitié seulement (côté +x ou -x), coupée au milieu de la pointe
    forme.moveTo(0, 0);
    forme.lineTo(0, -h);
    forme.lineTo((moitie * l) / 2, -(h - pointe));
    forme.lineTo((moitie * l) / 2, 0);
  } else {
    forme.moveTo(-l / 2, 0);
    forme.lineTo(-l / 2, -(h - pointe));
    forme.lineTo(0, -h);
    forme.lineTo(l / 2, -(h - pointe));
    forme.lineTo(l / 2, 0);
  }
  forme.closePath();
  return new THREE.ExtrudeGeometry(forme, { depth: ep, bevelEnabled: false });
}

/** Anneau de corde couché (axe vertical) : rayon `r`, grosseur `g`, étiré de `ez` d'avant en arrière. */
function tore(r: number, g: number, ez = 1): THREE.BufferGeometry {
  const t = new THREE.TorusGeometry(r, g, 5, 10);
  t.rotateX(Math.PI / 2);
  t.scale(1, 1, ez);
  return t;
}

/**
 * Volume fait de tranches à contour libre (liste de points [x, z], même sens de parcours que `fuseau`),
 * fermé aux deux bouts : sert à la cuirasse, qui a une arête au milieu du torse.
 */
function coque(tranches: { y: number; contour: [number, number][] }[]): THREE.BufferGeometry {
  const n = tranches[0].contour.length;
  const positions: number[] = [];
  const indices: number[] = [];
  for (const t of tranches) for (const [x, z] of t.contour) positions.push(x, t.y, z);
  for (let k = 0; k < tranches.length - 1; k++) {
    for (let i = 0; i < n; i++) {
      const a = k * n + i;
      const a1 = k * n + ((i + 1) % n);
      indices.push(a, a + n, a1, a1, a + n, a1 + n);
    }
  }
  const centreBas = positions.length / 3;
  positions.push(0, tranches[0].y, 0, 0, tranches[tranches.length - 1].y, 0);
  const dernier = (tranches.length - 1) * n;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(centreBas, i, j, centreBas + 1, dernier + j, dernier + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  return g;
}

/** Contour d'une tranche de cuirasse : le contour à 8 côtés du torse, plus une arête de `arete` au milieu du devant. */
function contourCuirasse(a: Anneau, arete: number): [number, number][] {
  const c = a.c ?? Math.min(a.rx, a.rz) * 0.34;
  return [
    [a.rx, -(a.rz - c)],
    [a.rx, a.rz - c],
    [a.rx - c, a.rz],
    [0, a.rz + arete],
    [-(a.rx - c), a.rz],
    [-a.rx, a.rz - c],
    [-a.rx, -(a.rz - c)],
    [-(a.rx - c), -a.rz],
    [a.rx - c, -a.rz],
  ];
}

/**
 * Un quart (devant ou derrière : `sz` ; côté gauche ou droit : `sx`) du volume que ferait `fuseau(tranches)`,
 * fermé de tous les côtés. Les quatre quarts côte à côte redonnent exactement le fuseau ; chacun peut pivoter
 * à part sans laisser voir à travers.
 */
export function quartFuseau(tranches: Anneau[], sx: number, sz: number): THREE.BufferGeometry {
  const anneaux = tranches[0].y <= tranches[tranches.length - 1].y ? tranches : [...tranches].reverse();
  const g = coque(
    anneaux.map((a) => {
      const c = Math.min(a.c ?? Math.min(a.rx, a.rz) * 0.34, a.rx, a.rz);
      const bord: [number, number][] = [
        [sx * a.rx, 0],
        [sx * a.rx, sz * (a.rz - c)],
        [sx * (a.rx - c), sz * a.rz],
        [0, sz * a.rz],
      ];
      // Même sens de parcours que `fuseau`, quel que soit le quart
      if (sx * sz < 0) bord.reverse();
      return { y: a.y, contour: [...bord, [0, 0] as [number, number]] };
    }),
  );
  g.computeVertexNormals();
  return g;
}

/** Le volet du bassin qui porte une pièce placée en (x, z) ; sur les côtés (z presque nul), le bassin lui-même. */
function voletBassin(corps: CorpsArmure, x: number, z: number): THREE.Group {
  if (Math.abs(z) < 0.03) return corps.bassin;
  const jambe = corps.jambes.find((j) => j.cote === (x >= 0 ? 1 : -1)) ?? corps.jambes[0];
  return z > 0 ? jambe.voletAvant : jambe.voletArriere;
}

/** Les quatre volets du bassin, avec le côté (sx) et le sens (sz : 1 devant, -1 derrière) de chacun. */
function quartiers(corps: CorpsArmure): { volet: THREE.Group; sx: number; sz: number }[] {
  return corps.jambes.flatMap((j) => [
    { volet: j.voletAvant, sx: j.cote, sz: 1 },
    { volet: j.voletArriere, sx: j.cote, sz: -1 },
  ]);
}

interface Lot {
  parent: THREE.Group;
  matiere: Matiere;
  positions: number[];
  couleurs: number[];
  /** Coordonnées du dessin des anneaux (matière « mailles » seulement) */
  uv: number[];
}

/** Rassemble les pièces d'une armure, puis en fait un maillage par groupe du squelette et par matière. */
function creerAtelier(materiaux: Record<Matiere, THREE.Material>, carreau: number) {
  const lots = new Map<string, Lot>();
  const p = new THREE.Vector3();
  const teinte = new THREE.Color();

  /** Ajoute une pièce de couleur `couleur` au groupe `parent`, placée par `matrice`. */
  function poser(parent: THREE.Group, geometrie: THREE.BufferGeometry, couleur: number, matrice?: THREE.Matrix4, matiere: Matiere = 'mat'): void {
    const cle = `${parent.id}:${matiere}`;
    let lot = lots.get(cle);
    if (!lot) {
      lot = { parent, matiere, positions: [], couleurs: [], uv: [] };
      lots.set(cle, lot);
    }
    const g = geometrie.index ? geometrie.toNonIndexed() : geometrie;
    const pos = g.getAttribute('position');
    teinte.set(couleur);
    const debut = lot.positions.length;
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      if (matrice) p.applyMatrix4(matrice);
      lot.positions.push(p.x, p.y, p.z);
      lot.couleurs.push(teinte.r, teinte.g, teinte.b);
    }
    if (matiere !== 'mailles') return;
    // Dessin des anneaux : coordonnées fournies par la pièce (en mètres), sinon enroulées autour de son axe
    const fournies = g.getAttribute('uvMetres');
    if (fournies) for (let i = 0; i < fournies.count; i++) lot.uv.push(fournies.getX(i) / carreau, fournies.getY(i) / carreau);
    else enroulerMailles(lot.positions, debut, carreau, lot.uv);
  }

  /** N pans à pointe répartis autour d'une ellipse (franges, touffes de poils, jupe à pans). */
  function couronne(
    parent: THREE.Group,
    o: {
      y: number;
      rx: number;
      rz: number;
      n: number;
      l: number;
      h: number;
      pointe: number;
      /** Angle dont les pans s'écartent de la verticale (radians), fixe ou selon la direction */
      incl: number | ((angle: number) => number);
      couleurs: number[];
      /** Décalage du premier pan, en fraction de pas */
      decalage?: number;
      ep?: number;
      /** Pans dressés (pointe vers +y) au lieu de pendre */
      dresses?: boolean;
      /** Couronne autour du bassin : chaque pan va sur le volet de sa jambe (`parent` est alors ignoré) */
      volets?: CorpsArmure;
    },
  ): void {
    for (let k = 0; k < o.n; k++) {
      const a = ((k + (o.decalage ?? 0)) / o.n) * Math.PI * 2;
      const s = Math.sin(a);
      const c = Math.cos(a);
      const lacet = Math.atan2(s / o.rx, c / o.rz);
      const incl = typeof o.incl === 'number' ? o.incl : o.incl(a);
      // Sur le contour à coins coupés du corps (comme `fuseau`), pas sur une ellipse : aucun pan n'est enfoui
      const coin = Math.min(o.rx, o.rz) * 0.4;
      const r = Math.min(o.rx / Math.max(Math.abs(s), 1e-6), o.rz / Math.max(Math.abs(c), 1e-6), (o.rx + o.rz - coin) / (Math.abs(s) + Math.abs(c)));
      const couleur = o.couleurs[k % o.couleurs.length];
      // Sinus arrondi : le pan du milieu est pile à x = 0
      const x = Math.abs(s) < 1e-6 ? 0 : r * s;
      if (o.volets) panBassin(o.volets, { l: o.l, h: o.h, pointe: o.pointe, ep: o.ep }, couleur, x, o.y, r * c, -incl, lacet);
      else poser(parent, pan(o.l, o.h, o.pointe, o.ep), couleur, pose(r * s, o.y, r * c, o.dresses ? incl : -incl, lacet, o.dresses ? Math.PI : 0));
    }
  }

  /**
   * Pan qui pend de la ceinture, posé sur le volet de la jambe qu'il recouvre. Un pan au milieu du corps
   * (x = 0, devant ou derrière) est coupé en deux moitiés, une par jambe : au repos, on ne voit pas la coupe.
   */
  function panBassin(
    corps: CorpsArmure,
    forme: { l: number; h: number; pointe: number; ep?: number },
    couleur: number,
    x: number,
    y: number,
    z: number,
    inclinaison: number,
    lacet: number,
    matiere: Matiere = 'mat',
  ): void {
    const m = pose(x, y, z, inclinaison, lacet);
    if (x !== 0) {
      poser(voletBassin(corps, x, z), pan(forme.l, forme.h, forme.pointe, forme.ep), couleur, m, matiere);
      return;
    }
    // Derrière, le pan est retourné : sa moitié +x est du côté droit du corps
    for (const moitie of [1, -1] as const) {
      poser(voletBassin(corps, moitie * Math.cos(lacet), z), pan(forme.l, forme.h, forme.pointe, forme.ep, moitie), couleur, m, matiere);
    }
  }

  /** Volume en tranches autour du bassin (bas de tunique, de cotte, jupe d'acier), découpé en quatre quarts posés sur les volets. */
  function jupe(corps: CorpsArmure, tranches: Anneau[], couleur: number, matiere: Matiere = 'mat'): void {
    for (const q of quartiers(corps)) poser(q.volet, quartFuseau(tranches, q.sx, q.sz), couleur, undefined, matiere);
  }

  /**
   * Lanière qui passe par `points` : un pavé par segment, large de `largeur`, épais de `epaisseur`.
   * `repere` donne la direction de l'épaisseur (mode 'normale') ou de la largeur (mode 'largeur').
   */
  function ruban(
    parent: THREE.Group,
    points: [number, number, number][],
    largeur: number,
    epaisseur: number,
    couleur: number,
    repere: THREE.Vector3,
    mode: 'normale' | 'largeur' = 'normale',
  ): void {
    for (let i = 0; i < points.length - 1; i++) {
      const a = new THREE.Vector3(...points[i]);
      const b = new THREE.Vector3(...points[i + 1]);
      const y = b.clone().sub(a);
      const longueur = y.length();
      y.normalize();
      let x: THREE.Vector3;
      let z: THREE.Vector3;
      if (mode === 'normale') {
        x = y.clone().cross(repere).normalize();
        z = x.clone().cross(y);
      } else {
        z = repere.clone().cross(y).normalize();
        x = y.clone().cross(z);
      }
      const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(a.add(b).multiplyScalar(0.5));
      // Un peu plus long que le segment : les pavés se recouvrent aux coudes
      poser(parent, new THREE.BoxGeometry(largeur, longueur + epaisseur, epaisseur), couleur, m);
    }
  }

  /** Fabrique les maillages (un par groupe et par matière), les accroche et les renvoie. */
  function finir(): THREE.Mesh[] {
    const maillages: THREE.Mesh[] = [];
    for (const lot of lots.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(lot.positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(lot.couleurs, 3));
      if (lot.matiere === 'mailles') g.setAttribute('uv', new THREE.Float32BufferAttribute(lot.uv, 2));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, materiaux[lot.matiere]);
      m.castShadow = true;
      lot.parent.add(m);
      maillages.push(m);
    }
    return maillages;
  }

  return { poser, couronne, ruban, panBassin, jupe, finir, carreau };
}

type Atelier = ReturnType<typeof creerAtelier>;

/** Ceinture de cuir par-dessus l'armure, avec une boucle carrée (cadre de `metal`). */
function ceintureCuir(at: Atelier, corps: CorpsArmure, e: number, metal: number, matiereBoucle: Matiere = 'mat'): void {
  const C = COULEURS;
  at.poser(corps.bassin, fuseau(gonfler(CEINTURE, e)), C.cuirSombre);
  const z = 0.165 + e;
  at.poser(corps.bassin, new THREE.BoxGeometry(0.105, 0.09, 0.022), metal, pose(0, -0.002, z + 0.004), matiereBoucle);
  at.poser(corps.bassin, new THREE.BoxGeometry(0.058, 0.046, 0.022), C.cuirSombre, pose(0, -0.002, z + 0.01));
}

/** Fibres : gilet de paille tressée à bretelles, épaulières et poignets de corde enroulée, ceinture de corde nouée. */
function construireFibres(at: Atelier, corps: CorpsArmure): THREE.Object3D[] {
  const C = COULEURS;
  // Gilet : rangs de tresse, un sur deux plus saillant et plus sombre
  for (let k = 0; k < 4; k++) {
    const y0 = 0.035 + k * 0.06;
    at.poser(corps.haut, fuseau(gonfler(portion(TORSE, y0, y0 + 0.06), k % 2 === 0 ? 0.024 : 0.016)), k % 2 === 0 ? C.paille : C.pailleSombre);
  }
  // Brins verticaux sur le devant et le dos
  for (const x of [-0.13, -0.045, 0.045, 0.13]) {
    for (const s of [1, -1]) at.poser(corps.haut, new THREE.BoxGeometry(0.022, 0.24, 0.02), C.corde, pose(x, 0.155, s * 0.186));
  }
  // Bretelles par-dessus les épaules
  const largeur = new THREE.Vector3(1, 0, 0);
  for (const s of [1, -1]) {
    at.ruban(
      corps.haut,
      [
        [s * 0.15, 0.26, 0.188],
        [s * 0.15, 0.355, 0.182],
        [s * 0.15, 0.412, 0.1],
        [s * 0.15, 0.412, -0.1],
        [s * 0.15, 0.355, -0.182],
        [s * 0.15, 0.26, -0.188],
      ],
      0.062,
      0.022,
      C.corde,
      largeur,
      'largeur',
    );
  }
  for (const bras of corps.bras) {
    // Épaulière : trois tours de corde
    [0.012, -0.03, -0.072].forEach((y, k) => {
      at.poser(bras.epaule, tore(k === 0 ? 0.082 : 0.092, 0.025, 1.06), k % 2 === 0 ? C.corde : C.cordeSombre, pose(0, y, 0));
    });
    // Cordelette au poignet
    [-0.205, -0.172].forEach((y, k) => at.poser(bras.coude, tore(0.098, 0.018, 1.06), k === 0 ? C.cordeSombre : C.corde, pose(0, y, 0)));
  }
  // Ceinture : deux tours de grosse corde, un nœud devant et deux bouts qui pendent
  at.poser(corps.bassin, tore(0.262, 0.03, 0.7), C.corde, pose(0, -0.024, 0));
  at.poser(corps.bassin, tore(0.262, 0.03, 0.7), C.cordeSombre, pose(0, 0.022, 0));
  at.poser(corps.bassin, new THREE.IcosahedronGeometry(0.047, 0), C.corde, pose(0.03, -0.002, 0.205));
  at.poser(voletBassin(corps, 1, 1), new THREE.BoxGeometry(0.03, 0.14, 0.03), C.cordeSombre, pose(0.012, -0.085, 0.208, 0, 0, -0.12));
  at.poser(voletBassin(corps, 1, 1), new THREE.BoxGeometry(0.03, 0.11, 0.03), C.corde, pose(0.062, -0.07, 0.206, 0, 0, 0.3));
  return [...corps.ceinture];
}

/** Cuir : plastron, bandoulière à boucle carrée, épaulières, brassards épais, jupe à pans, ceinture à boucle. */
function construireCuir(at: Atelier, corps: CorpsArmure): THREE.Object3D[] {
  const C = COULEURS;
  at.poser(corps.haut, fuseau(gonfler(portion(TORSE, 0, 0.4), 0.018)), C.cuir);
  at.poser(corps.haut, fuseau(gonfler(portion(TORSE, 0, 0.12), 0.026)), C.cuirSombre);
  // Bandoulière : de l'épaule droite à la hanche gauche, devant et derrière
  const devant: [number, number, number][] = [
    [-0.17, 0.372, 0.186],
    [0.21, 0.03, 0.196],
  ];
  at.ruban(corps.haut, devant, 0.055, 0.022, C.cuirClair, new THREE.Vector3(0, 0, 1));
  at.ruban(corps.haut, devant.map(([x, y, z]) => [x, y, -z]) as [number, number, number][], 0.055, 0.022, C.cuirClair, new THREE.Vector3(0, 0, -1));
  at.ruban(
    corps.haut,
    [
      [-0.17, 0.36, 0.19],
      [-0.17, 0.414, 0.1],
      [-0.17, 0.414, -0.1],
      [-0.17, 0.36, -0.19],
    ],
    0.055,
    0.022,
    C.cuirClair,
    new THREE.Vector3(1, 0, 0),
    'largeur',
  );
  // Boucle carrée sur la bandoulière
  const angle = Math.atan2(0.38, 0.342);
  at.poser(corps.haut, new THREE.BoxGeometry(0.085, 0.085, 0.02), C.laiton, pose(-0.06, 0.273, 0.202, 0, 0, -angle));
  at.poser(corps.haut, new THREE.BoxGeometry(0.046, 0.046, 0.02), C.cuirSombre, pose(-0.06, 0.273, 0.207, 0, 0, -angle));
  for (const bras of corps.bras) {
    const dx = bras.cote * 0.014;
    at.poser(
      bras.epaule,
      fuseau([
        { y: -0.08, rx: 0.102, rz: 0.11, dx },
        { y: 0.0, rx: 0.11, rz: 0.116, dx },
        { y: 0.058, rx: 0.07, rz: 0.08 },
      ]),
      C.cuirSombre,
    );
    at.poser(
      bras.epaule,
      fuseau([
        { y: -0.105, rx: 0.108, rz: 0.116, dx },
        { y: -0.075, rx: 0.108, rz: 0.116, dx },
      ]),
      C.cuirClair,
    );
    // Brassard épais, cerclé aux deux bouts
    at.poser(
      bras.coude,
      fuseau([
        { y: -0.212, rx: 0.102, rz: 0.108 },
        { y: -0.06, rx: 0.094, rz: 0.1 },
      ]),
      C.cuir,
    );
    for (const y of [-0.218, -0.145, -0.085]) {
      at.poser(
        bras.coude,
        fuseau([
          { y, rx: 0.109, rz: 0.115 },
          { y: y + 0.03, rx: 0.107, rz: 0.113 },
        ]),
        C.cuirSombre,
      );
    }
  }
  ceintureCuir(at, corps, 0.024, C.laiton);
  // Jupe à pans : huit pans à pointe, longs et courts
  const pans: [number, number, number, number][] = [
    [0, 0.16, 0.28, C.cuirSombre],
    [45, 0.15, 0.22, C.cuir],
    [90, 0.16, 0.26, C.cuirSombre],
    [135, 0.15, 0.22, C.cuir],
    [180, 0.16, 0.28, C.cuirSombre],
    [225, 0.15, 0.22, C.cuir],
    [270, 0.16, 0.26, C.cuirSombre],
    [315, 0.15, 0.22, C.cuir],
  ];
  for (const [degres, l, h, couleur] of pans) {
    const a = (degres * Math.PI) / 180;
    const rx = 0.262;
    const rz = 0.178;
    const lacet = Math.atan2(Math.sin(a) / rx, Math.cos(a) / rz);
    // Sinus et cosinus arrondis : les pans du milieu sont pile à x = 0, ceux des côtés pile à z = 0
    const x = Math.round(Math.sin(a) * 1e6) / 1e6;
    const z = Math.round(Math.cos(a) * 1e6) / 1e6;
    at.panBassin(corps, { l, h, pointe: 0.06, ep: 0.022 }, couleur, rx * x, -0.03, rz * z, -0.24, lacet);
  }
  return [...corps.ceinture];
}

/** Fourrure : pelisse de poils clairs, cape raide dans le dos, tunique de peau dentelée, revers aux bras et aux bottes. */
function construireFourrure(at: Atelier, corps: CorpsArmure): THREE.Object3D[] {
  const C = COULEURS;
  at.poser(corps.haut, fuseau(gonfler(portion(TORSE, 0, 0.4), 0.014)), C.taupe);
  // Rangs dentelés sur la poitrine, crème puis taupe
  at.couronne(corps.haut, { y: 0.25, rx: 0.268, rz: 0.176, n: 12, l: 0.14, h: 0.15, pointe: 0.075, incl: 0.04, couleurs: [C.creme, C.cremeSombre] });
  at.couronne(corps.haut, { y: 0.14, rx: 0.262, rz: 0.172, n: 12, l: 0.14, h: 0.13, pointe: 0.07, incl: 0.03, couleurs: [C.taupeSombre, C.taupe], decalage: 0.5 });
  // Pelisse : trois rangs de grosses touffes autour du cou, presque à plat sur les épaules, pendantes sur la poitrine
  const etale = (mini: number, maxi: number) => (a: number) => mini + (maxi - mini) * Math.abs(Math.sin(a)) ** 1.5;
  at.couronne(corps.haut, { y: 0.385, rx: 0.25, rz: 0.15, n: 14, l: 0.16, h: 0.24, pointe: 0.13, incl: etale(0.42, 1.2), couleurs: [C.creme, C.cremeSombre], ep: 0.034 });
  at.couronne(corps.haut, { y: 0.405, rx: 0.2, rz: 0.125, n: 12, l: 0.15, h: 0.19, pointe: 0.1, incl: etale(0.62, 1.32), couleurs: [C.cremeSombre, C.creme], decalage: 0.5, ep: 0.034 });
  at.couronne(corps.haut, { y: 0.418, rx: 0.15, rz: 0.1, n: 9, l: 0.13, h: 0.13, pointe: 0.07, incl: etale(0.9, 1.45), couleurs: [C.creme, C.cremeSombre], ep: 0.03 });
  // Cape : une planche raide dans le dos, couverte de quatre rangs de touffes
  const basCape = -0.34;
  const pente = Math.atan2(0.12, 0.37 - basCape);
  at.ruban(
    corps.cape,
    [
      [0, 0.37, -0.2],
      [0, basCape + 0.1, -0.2 - (0.37 - basCape - 0.1) * Math.tan(pente)],
    ],
    0.48,
    0.03,
    C.taupeSombre,
    new THREE.Vector3(0, 0, -1),
  );
  [0.39, 0.21, 0.03, -0.14].forEach((y, rang) => {
    const n = rang % 2 === 0 ? 4 : 5;
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * (rang % 2 === 0 ? 0.135 : 0.112);
      const z = -0.2 - (0.37 - y) * Math.tan(pente) - 0.016 - rang * 0.005;
      const couleur = rang === 0 ? (k % 2 === 0 ? C.creme : C.cremeSombre) : (k + rang) % 2 === 0 ? C.taupe : C.taupeSombre;
      at.poser(corps.cape, pan(0.16, 0.31, 0.11, 0.028), couleur, pose(x, y, z, -pente - 0.05, Math.PI + (x / 0.25) * -0.3));
    }
  });
  for (const bras of corps.bras) {
    // Revers de fourrure à l'avant-bras
    at.poser(
      bras.coude,
      fuseau([
        { y: -0.218, rx: 0.106, rz: 0.112 },
        { y: -0.165, rx: 0.113, rz: 0.119 },
        { y: -0.1, rx: 0.096, rz: 0.102 },
      ]),
      C.creme,
    );
    at.couronne(bras.coude, { y: -0.185, rx: 0.106, rz: 0.112, n: 7, l: 0.075, h: 0.085, pointe: 0.055, incl: 0.3, couleurs: [C.cremeSombre, C.creme], ep: 0.016 });
  }
  for (const jambe of corps.jambes) {
    // Revers de fourrure en haut des bottes
    at.poser(
      jambe.genou,
      fuseau([
        { y: -0.205, rx: 0.118, rz: 0.123 },
        { y: -0.14, rx: 0.128, rz: 0.133 },
        { y: -0.085, rx: 0.112, rz: 0.117 },
      ]),
      C.creme,
    );
    at.couronne(jambe.genou, { y: -0.17, rx: 0.12, rz: 0.125, n: 8, l: 0.08, h: 0.09, pointe: 0.06, incl: 0.28, couleurs: [C.cremeSombre, C.creme], ep: 0.016 });
  }
  at.poser(corps.bassin, fuseau(gonfler(CEINTURE, 0.03)), C.cuirSombre);
  at.poser(corps.bassin, new THREE.BoxGeometry(0.09, 0.085, 0.02), C.cuir, pose(0, -0.002, 0.2));
  // Bas de la tunique de peau : un fond taupe et deux rangs dentelés
  at.jupe(
    corps,
    [
      { y: -0.2, rx: 0.278, rz: 0.186, c: 0.07 },
      { y: -0.02, rx: 0.246, rz: 0.16, c: 0.06 },
    ],
    C.taupeSombre,
  );
  at.couronne(corps.bassin, { y: -0.03, rx: 0.262, rz: 0.176, n: 12, l: 0.15, h: 0.17, pointe: 0.085, incl: 0.2, couleurs: [C.creme, C.cremeSombre], volets: corps });
  at.couronne(corps.bassin, { y: -0.12, rx: 0.276, rz: 0.186, n: 12, l: 0.155, h: 0.2, pointe: 0.1, incl: 0.2, couleurs: [C.taupe, C.taupeSombre], decalage: 0.5, volets: corps });
  return [...corps.ceinture, ...corps.basTunique, ...corps.jambes.map((j) => j.revers)];
}

/**
 * Ceinture de la cotte de mailles : sangle de cuir à bords surpiqués, boucle d'acier avec son ardillon, passant,
 * et bout de sangle qui retombe sur la cotte, ferré d'acier.
 */
function ceintureMailles(at: Atelier, corps: CorpsArmure): void {
  const C = COULEURS;
  const e = 0.03;
  at.poser(corps.bassin, fuseau(gonfler(CEINTURE, e)), C.cuir);
  // Bords de la sangle, plus sombres et un peu saillants
  for (const y of [-0.045, 0.026]) {
    at.poser(
      corps.bassin,
      fuseau([
        { y, rx: 0.25 + e + 0.005, rz: 0.165 + e + 0.005, c: 0.074 },
        { y: y + 0.014, rx: 0.25 + e + 0.005, rz: 0.165 + e + 0.005, c: 0.074 },
      ]),
      C.cuirSombre,
    );
  }
  const z = 0.165 + e;
  // Boucle : cadre d'acier, cuir visible au travers, ardillon en travers
  at.poser(corps.bassin, new THREE.BoxGeometry(0.1, 0.104, 0.024), C.acier, pose(0, -0.002, z + 0.006), 'acier');
  at.poser(corps.bassin, new THREE.BoxGeometry(0.062, 0.062, 0.024), C.cuirSombre, pose(0, -0.002, z + 0.011));
  at.poser(corps.bassin, new THREE.BoxGeometry(0.072, 0.014, 0.012), C.acierClair, pose(-0.012, -0.002, z + 0.026), 'acier');
  // Passant, puis le bout de la sangle qui pend le long de la cotte
  at.poser(corps.bassin, new THREE.BoxGeometry(0.022, 0.09, 0.02), C.cuirSombre, pose(-0.088, -0.002, z + 0.008));
  at.poser(voletBassin(corps, -1, 1), new THREE.BoxGeometry(0.05, 0.15, 0.014), C.cuir, pose(-0.118, -0.095, z + 0.022, -0.15));
  at.poser(voletBassin(corps, -1, 1), new THREE.BoxGeometry(0.054, 0.03, 0.018), C.acier, pose(-0.118, -0.166, z + 0.0335, -0.15), 'acier');
}

/** Mailles : cotte d'anneaux fins jusqu'à mi-cuisse, bordée de cuir, manches et gants gris, ceinture de cuir, bottes hautes. */
function construireMailles(at: Atelier, corps: CorpsArmure): THREE.Object3D[] {
  const C = COULEURS;
  at.poser(corps.haut, fuseau(gonfler(portion(TORSE, 0, 0.4), 0.02)), C.anneaux, undefined, 'mailles');
  // Col gris foncé, cerclé de cuir à l'encolure
  at.poser(
    corps.haut,
    fuseau([
      { y: 0.37, rx: 0.105, rz: 0.1 },
      { y: 0.425, rx: 0.094, rz: 0.09 },
    ]),
    C.dessous,
  );
  at.poser(
    corps.haut,
    fuseau([
      { y: 0.396, rx: 0.128, rz: 0.118 },
      { y: 0.414, rx: 0.118, rz: 0.11 },
    ]),
    C.cuirSombre,
  );
  for (const bras of corps.bras) {
    at.poser(bras.epaule, fuseau(gonfler(MANCHE, 0.002)), C.dessous);
    // Manche courte de mailles, bordée de cuir
    at.poser(bras.epaule, fuseau(gonfler(portion(MANCHE, -0.15, 0.025), 0.022)), C.anneaux, undefined, 'mailles');
    at.poser(bras.epaule, fuseau(gonfler(portion(MANCHE, -0.168, -0.142), 0.027)), C.cuirSombre);
    at.poser(bras.coude, fuseau(gonfler(AVANT_BRAS, 0.002)), C.dessous);
    at.poser(
      bras.coude,
      fuseau([
        { y: -0.218, rx: 0.101, rz: 0.107 },
        { y: -0.11, rx: 0.094, rz: 0.1 },
      ]),
      C.gants,
    );
    at.poser(bras.coude, fuseau(gonfler(MAIN, 0.004)), C.gants);
    at.poser(bras.coude, new THREE.BoxGeometry(0.04, 0.078, 0.04), C.gants, pose(bras.cote * -0.012, -0.28, 0.09));
  }
  // Bas de la cotte, jusqu'à mi-cuisse
  at.jupe(
    corps,
    [
      { y: -0.33, rx: 0.305, rz: 0.218, c: 0.08 },
      { y: -0.02, rx: 0.26, rz: 0.174, c: 0.065 },
    ],
    C.anneaux,
    'mailles',
  );
  // Ourlet de cuir au bas de la cotte
  at.jupe(
    corps,
    [
      { y: -0.35, rx: 0.314, rz: 0.227, c: 0.083 },
      { y: -0.318, rx: 0.309, rz: 0.222, c: 0.082 },
    ],
    C.cuirSombre,
  );
  ceintureMailles(at, corps);
  for (const jambe of corps.jambes) {
    // Botte haute, à revers sombre sous le genou
    at.poser(
      jambe.genou,
      fuseau([
        { y: -0.32, rx: 0.1, rz: 0.106 },
        { y: -0.19, rx: 0.107, rz: 0.113 },
        { y: -0.06, rx: 0.115, rz: 0.121 },
      ]),
      C.botte,
    );
    at.poser(
      jambe.genou,
      fuseau([
        { y: -0.105, rx: 0.121, rz: 0.127 },
        { y: -0.035, rx: 0.124, rz: 0.13 },
      ]),
      C.hautBotte,
    );
  }
  return [
    ...corps.ceinture,
    ...corps.basTunique,
    ...corps.bras.flatMap((b) => [b.manche, b.avantBras, ...b.main]),
    ...corps.jambes.flatMap((j) => [j.revers, j.tige]),
  ];
}

/** Plaques : cuirasse à arête, épaulières superposées, brassards, cubitières, gantelets, tassettes, genouillères, jambières, solerets. */
function construirePlaques(at: Atelier, corps: CorpsArmure): THREE.Object3D[] {
  const C = COULEURS;
  const acier = (parent: THREE.Group, g: THREE.BufferGeometry, couleur: number, m?: THREE.Matrix4) => at.poser(parent, g, couleur, m, 'acier');
  // Cuirasse : arête au milieu du torse, plaque de ventre plus sombre
  const cuirasse: [number, number, number][] = [
    [0.0, 0.024, 0.012],
    [0.15, 0.036, 0.06],
    [0.3, 0.04, 0.075],
    [0.4, 0.022, 0.012],
  ];
  acier(corps.haut, coque(cuirasse.map(([y, e, arete]) => ({ y, contour: contourCuirasse(gonfler([trancheA(TORSE, y)], e)[0], arete) }))), C.acier);
  acier(
    corps.haut,
    coque(
      [
        [0.0, 0.034, 0.02],
        [0.1, 0.044, 0.05],
        [0.13, 0.04, 0.045],
      ].map(([y, e, arete]) => ({ y, contour: contourCuirasse(gonfler([trancheA(TORSE, y)], e)[0], arete) })),
    ),
    C.acierSombre,
  );
  // Gorgerin
  acier(
    corps.haut,
    fuseau([
      { y: 0.37, rx: 0.125, rz: 0.115 },
      { y: 0.43, rx: 0.1, rz: 0.095 },
    ]),
    C.acierSombre,
  );
  for (const bras of corps.bras) {
    const s = bras.cote;
    at.poser(bras.epaule, fuseau(gonfler(MANCHE, 0.002)), C.dessous);
    // Épaulière : trois lames superposées, la plus haute large et bombée
    acier(
      bras.epaule,
      fuseau([
        { y: -0.165, rx: 0.104, rz: 0.11, dx: s * 0.016 },
        { y: -0.1, rx: 0.12, rz: 0.126, dx: s * 0.026 },
      ]),
      C.acier,
    );
    acier(
      bras.epaule,
      fuseau([
        { y: -0.11, rx: 0.122, rz: 0.128, dx: s * 0.03 },
        { y: -0.04, rx: 0.14, rz: 0.142, dx: s * 0.04 },
      ]),
      C.acierSombre,
    );
    acier(
      bras.epaule,
      fuseau([
        { y: -0.05, rx: 0.15, rz: 0.15, dx: s * 0.045 },
        { y: 0.035, rx: 0.162, rz: 0.156, dx: s * 0.045 },
        { y: 0.1, rx: 0.095, rz: 0.1, dx: s * 0.008 },
      ]),
      C.acierClair,
    );
    acier(bras.epaule, fuseau(gonfler(portion(MANCHE, -0.25, -0.15), 0.013)), C.acier);
    at.poser(bras.coude, fuseau(gonfler(AVANT_BRAS, 0.002)), C.dessous);
    // Cubitière, avec sa pointe vers l'arrière
    acier(
      bras.coude,
      fuseau([
        { y: -0.048, rx: 0.092, rz: 0.1 },
        { y: 0.0, rx: 0.106, rz: 0.116 },
        { y: 0.046, rx: 0.09, rz: 0.098 },
      ]),
      C.acierClair,
    );
    acier(bras.coude, new THREE.ConeGeometry(0.05, 0.075, 4), C.acier, pose(0, 0, -0.125, -Math.PI / 2, 0, 0));
    // Brassard évasé vers le poignet, bordé
    acier(
      bras.coude,
      fuseau([
        { y: -0.215, rx: 0.105, rz: 0.111 },
        { y: -0.07, rx: 0.09, rz: 0.096 },
      ]),
      C.acier,
    );
    acier(
      bras.coude,
      fuseau([
        { y: -0.228, rx: 0.112, rz: 0.118 },
        { y: -0.198, rx: 0.11, rz: 0.116 },
      ]),
      C.acierSombre,
    );
    // Gantelet
    acier(bras.coude, fuseau(gonfler(MAIN, 0.008)), C.acier);
    acier(bras.coude, new THREE.BoxGeometry(0.044, 0.082, 0.044), C.acierSombre, pose(s * -0.012, -0.28, 0.092));
  }
  // Braconnière (jupe d'acier courte), plaque à pointe devant et derrière
  at.jupe(
    corps,
    [
      { y: -0.17, rx: 0.292, rz: 0.198, c: 0.075 },
      { y: -0.02, rx: 0.264, rz: 0.178, c: 0.065 },
    ],
    C.acierSombre,
    'acier',
  );
  at.panBassin(corps, { l: 0.16, h: 0.26, pointe: 0.1, ep: 0.024 }, C.acierClair, 0, -0.03, 0.192, -0.14, 0, 'acier');
  at.panBassin(corps, { l: 0.16, h: 0.2, pointe: 0.07, ep: 0.024 }, C.acier, 0, -0.03, -0.192, -0.14, Math.PI, 'acier');
  ceintureCuir(at, corps, 0.032, C.acierSombre, 'acier');
  for (const jambe of corps.jambes) {
    const s = jambe.cote;
    // Cuissot et tassette (plaque sur la hanche, qui suit la jambe)
    acier(jambe.hanche, fuseau(gonfler(portion(CUISSE, -0.37, -0.08), 0.013)), C.acierSombre);
    acier(jambe.hanche, pan(0.2, 0.26, 0.08, 0.024), C.acier, pose(s * 0.03, 0.02, 0.118, -0.06, s * 0.3));
    acier(jambe.hanche, pan(0.17, 0.22, 0.06, 0.024), C.acier, pose(s * 0.118, 0.02, 0.0, -0.1, s * Math.PI * 0.5));
    // Genouillère à pointe
    acier(
      jambe.genou,
      fuseau([
        { y: -0.075, rx: 0.108, rz: 0.113 },
        { y: 0.0, rx: 0.122, rz: 0.134, dz: 0.02 },
        { y: 0.07, rx: 0.108, rz: 0.113 },
      ]),
      C.acierClair,
    );
    // Jambière
    acier(
      jambe.genou,
      fuseau([
        { y: -0.32, rx: 0.1, rz: 0.106 },
        { y: -0.2, rx: 0.113, rz: 0.121 },
        { y: -0.065, rx: 0.106, rz: 0.112 },
      ]),
      C.acier,
    );
    acier(
      jambe.genou,
      fuseau([
        { y: -0.325, rx: 0.108, rz: 0.114 },
        { y: -0.29, rx: 0.108, rz: 0.114 },
      ]),
      C.acierSombre,
    );
    // Soleret, avec une lame sur le cou-de-pied
    acier(jambe.cheville, fuseau(gonfler(PIED, 0.01)), C.acier);
    acier(
      jambe.cheville,
      fuseau([
        { y: -0.02, rx: 0.112, rz: 0.075, dz: 0.085 },
        { y: 0.03, rx: 0.106, rz: 0.06, dz: 0.07 },
      ]),
      C.acierSombre,
    );
  }
  return [
    ...corps.ceinture,
    ...corps.basTunique,
    ...corps.bras.flatMap((b) => [b.manche, b.avantBras, ...b.main]),
    ...corps.jambes.flatMap((j) => [j.pantalon, j.revers, j.tige, j.pied]),
  ];
}

/**
 * Garde-robe commune au corps (3e personne), aux manches (1re personne) et aux casques : construit les pièces d'un type à la
 * première demande, puis ne fait que les montrer ou les cacher, avec les parties du corps qu'elles remplacent.
 */
function creerGardeRobe<T extends string>(
  constructeurs: Record<T, (at: Atelier) => THREE.Object3D[]>,
  options: { carreau: number; ombres: boolean; surChangement?: (type: T | null) => void },
): GardeRobe<T> {
  // Matériaux blancs : la couleur vient des facettes
  const mat = creerMateriau(0xffffff);
  mat.vertexColors = true;
  const acier = creerMateriau(0xffffff);
  acier.vertexColors = true;
  acier.roughness = ACIER.roughness;
  acier.metalness = ACIER.metalness;
  const mailles = creerMateriau(0xffffff);
  mailles.vertexColors = true;
  mailles.roughness = MAILLES.roughness;
  mailles.metalness = MAILLES.metalness;
  const materiaux: Record<Matiere, THREE.MeshStandardMaterial> = { mat, acier, mailles };

  // Par type déjà construit : ses maillages, et les parties du corps qu'il remplace
  const faites = new Map<T, { maillages: THREE.Mesh[]; remplace: THREE.Object3D[] }>();
  let portee: T | null = null;

  function definir(type: T | null): void {
    if (type === portee) return;
    const avant = portee ? faites.get(portee) : undefined;
    if (avant) {
      for (const m of avant.maillages) m.visible = false;
      for (const o of avant.remplace) o.visible = true;
    }
    portee = type;
    options.surChangement?.(type);
    if (!type) return;
    let armure = faites.get(type);
    if (!armure) {
      if (type === 'mailles' && !mailles.map) {
        // Le même dessin sert de couleur et de relief (reflets sur le bord des anneaux)
        mailles.map = creerDessinMailles();
        mailles.bumpMap = mailles.map;
        mailles.bumpScale = MAILLES.relief;
        mailles.needsUpdate = true;
      }
      const atelier = creerAtelier(materiaux, options.carreau);
      const remplace = constructeurs[type](atelier);
      const maillages = atelier.finir();
      for (const m of maillages) m.castShadow = options.ombres;
      armure = { maillages, remplace };
      faites.set(type, armure);
    }
    for (const m of armure.maillages) m.visible = true;
    for (const o of armure.remplace) o.visible = false;
  }

  return { definir, materiaux: Object.values(materiaux) };
}

/** Les armures du corps en 3e personne. */
export function creerArmures(corps: CorpsArmure): Armures {
  return creerGardeRobe(
    {
      fibres: (at) => construireFibres(at, corps),
      cuir: (at) => construireCuir(at, corps),
      fourrure: (at) => construireFourrure(at, corps),
      mailles: (at) => construireMailles(at, corps),
      plaques: (at) => construirePlaques(at, corps),
    },
    { carreau: CARREAU_MAILLES, ombres: true },
  );
}

/** Un avant-bras de la 1re personne : origine au poignet, manche vers le coude (-y). */
export interface AvantBrasArmure {
  avantBras: THREE.Group;
  /** Manche de chemise et son revers, que certaines armures remplacent */
  manche: THREE.Object3D;
  revers: THREE.Object3D;
}

// Manche de chemise des bras en 1re personne (mêmes valeurs que dans personnage.ts)
const MANCHE_VUE: Anneau[] = [
  { y: -0.66, rx: 0.128, rz: 0.124 },
  { y: -0.44, rx: 0.106, rz: 0.1, dx: 0.006, dz: -0.01 },
  { y: -0.23, rx: 0.08, rz: 0.084, dx: -0.006, dz: 0.008 },
  { y: -0.068, rx: 0.058, rz: 0.06 },
];
// En 1re personne la manche est tout près de l'œil : anneaux plus petits que sur le corps (8 mm environ)
const CARREAU_MAILLES_VUE = 0.064;

/**
 * Manches d'armure des bras en 1re personne, assorties aux armures du corps. `peau` est le matériau des mains :
 * il prend la couleur du gant (mailles) ou du gantelet (plaques), sans rien changer à la forme ni aux gestes.
 */
export function creerManchesArmure(bras: AvantBrasArmure[], peau: THREE.MeshStandardMaterial): Armures {
  const C = COULEURS;
  const peauNue = { couleur: peau.color.getHex(), roughness: peau.roughness, metalness: peau.metalness };
  const tous = (f: (b: AvantBrasArmure) => void) => bras.forEach(f);
  const anneau = (y0: number, y1: number, e: number) => fuseau(gonfler(portion(MANCHE_VUE, y0, y1), e));
  return creerGardeRobe(
    {
      // Fibres : la manche claire reste, avec trois tours de cordelette au poignet
      fibres: (at) => {
        tous((b) => {
          [-0.034, -0.054, -0.074].forEach((y, k) => at.poser(b.avantBras, tore(0.064 + k * 0.002, 0.012), k % 2 === 0 ? C.corde : C.cordeSombre, pose(0, y, 0)));
        });
        return [];
      },
      // Cuir : brassard épais cerclé, par-dessus la manche
      cuir: (at) => {
        tous((b) => {
          at.poser(b.avantBras, anneau(-0.4, -0.085, 0.01), C.cuir);
          for (const y of [-0.41, -0.26, -0.12]) at.poser(b.avantBras, anneau(y, y + 0.04, 0.017), C.cuirSombre);
        });
        return [];
      },
      // Fourrure : manche de peau taupe, revers de poils crème en pointes
      fourrure: (at) => {
        tous((b) => {
          at.poser(b.avantBras, fuseau(gonfler(MANCHE_VUE, 0.002)), C.taupe);
          at.poser(
            b.avantBras,
            fuseau([
              { y: -0.14, rx: 0.074, rz: 0.077 },
              { y: -0.085, rx: 0.081, rz: 0.084 },
              { y: -0.03, rx: 0.068, rz: 0.07 },
            ]),
            C.creme,
          );
          // Pointes de poils : un rang vers le coude, un rang court vers la main
          at.couronne(b.avantBras, { y: -0.11, rx: 0.074, rz: 0.077, n: 7, l: 0.055, h: 0.075, pointe: 0.05, incl: 0.28, couleurs: [C.cremeSombre, C.creme], ep: 0.012 });
          at.couronne(b.avantBras, { y: -0.05, rx: 0.068, rz: 0.07, n: 7, l: 0.05, h: 0.055, pointe: 0.04, incl: 0.12, couleurs: [C.creme, C.cremeSombre], ep: 0.012, decalage: 0.5, dresses: true });
        });
        return bras.flatMap((b) => [b.manche, b.revers]);
      },
      // Mailles : manche d'anneaux, poignet du gant ; la main devient un gant gris
      mailles: (at) => {
        tous((b) => {
          at.poser(b.avantBras, fuseau(gonfler(MANCHE_VUE, 0.004)), C.anneaux, undefined, 'mailles');
          // Lisière de cuir au bout de la manche, sous le poignet du gant
          at.poser(b.avantBras, anneau(-0.092, -0.068, 0.009), C.cuirSombre);
          at.poser(
            b.avantBras,
            fuseau([
              { y: -0.062, rx: 0.065, rz: 0.067 },
              { y: -0.02, rx: 0.058, rz: 0.06 },
            ]),
            C.gants,
          );
        });
        return bras.flatMap((b) => [b.manche, b.revers]);
      },
      // Plaques : canon d'avant-bras bordé, manchette évasée ; la main devient un gantelet d'acier
      plaques: (at) => {
        tous((b) => {
          at.poser(b.avantBras, fuseau(gonfler(MANCHE_VUE, 0.002)), C.dessous);
          at.poser(b.avantBras, anneau(-0.42, -0.1, 0.011), C.acier, undefined, 'acier');
          for (const y of [-0.435, -0.27]) at.poser(b.avantBras, anneau(y, y + 0.035, 0.018), C.acierSombre, undefined, 'acier');
          at.poser(
            b.avantBras,
            fuseau([
              { y: -0.135, rx: 0.086, rz: 0.088 },
              { y: -0.115, rx: 0.086, rz: 0.088 },
              { y: -0.022, rx: 0.058, rz: 0.06 },
            ]),
            C.acierClair,
            undefined,
            'acier',
          );
        });
        return bras.flatMap((b) => [b.manche, b.revers]);
      },
    },
    {
      carreau: CARREAU_MAILLES_VUE,
      // Les bras de la 1re personne ne projettent pas d'ombre (c'est le corps, invisible, qui la projette)
      ombres: false,
      surChangement: (type) => {
        const gantelet = type === 'plaques';
        peau.color.setHex(type === 'mailles' ? C.gants : gantelet ? C.acier : peauNue.couleur);
        peau.roughness = gantelet ? ACIER.roughness : peauNue.roughness;
        peau.metalness = gantelet ? ACIER.metalness : peauNue.metalness;
      },
    },
  );
}

/** La tête du personnage, pour y poser un casque. Les rayons sont ceux du repère de la tête (angle en radians, 0 devant). */
export interface TeteCasque {
  tete: THREE.Group;
  /** Tous les cheveux, et la masse seule (sans la frange) */
  cheveux: THREE.Object3D;
  masse: THREE.Object3D;
  oreilles: THREE.Object3D[];
  /** Yeux, sourcils, nez, bouche */
  visage: THREE.Object3D[];
  rayonCrane(angle: number, y: number): number;
  rayonCheveux(angle: number, y: number): number;
}

const COULEURS_CASQUES = {
  // Dessus de la chapka
  feutre: 0x8a7d8e,
  feutreSombre: 0x7a6d80,
  // Fente de visière du heaume
  fente: 0x1b1e25,
};

/** Valeur lue dans une table [écart à l'avant en degrés, valeur], avec mélange entre deux lignes. */
function selonEcart(table: [number, number][], degres: number): number {
  const a = ecartAvant(degres);
  let k = 0;
  while (k < table.length - 2 && a > table[k + 1][0]) k++;
  const t = Math.max(0, Math.min(1, (a - table[k][0]) / (table[k + 1][0] - table[k][0])));
  return table[k][1] + (table[k + 1][1] - table[k][1]) * t;
}

interface NiveauVoute {
  y: (a: number) => number;
  r: (a: number, y: number) => number;
}

/**
 * Coque à facettes autour de la tête : des colonnes (angles en degrés, 0 devant, 90 côté gauche) et des niveaux
 * de bas en haut. `ferme` : la coque fait le tour ; sinon c'est un pan, dont les deux bords peuvent être refermés
 * vers le crâne (`bords` donne le rayon intérieur). `sommet` ferme le dessus. Couleur et matière par facette.
 * `mailles` : la coque reçoit le dessin des anneaux, enroulé autour de la tête et déroulé le long de la coque ;
 * la fonction renvoie alors la position du dessin à chaque niveau, pour raccorder la coque voisine.
 */
function voute(
  at: Atelier,
  parent: THREE.Group,
  o: {
    angles: number[];
    ferme: boolean;
    niveaux: NiveauVoute[];
    sommet?: [number, number, number];
    /** `i` : colonne, `j` : niveau du bas de la facette, `a` : angle au milieu de la facette */
    couleur: (i: number, j: number, a: number) => number;
    matiere?: (i: number, j: number, a: number) => Matiere;
    bords?: (a: number, y: number) => number;
    /** Raccord du dessin des anneaux : au niveau `niveau`, le dessin est à la hauteur `v` (mètres) ; `rayon` fixe le tour de tête */
    /** `aplomb` : le dessin suit la hauteur de chaque point (petits pans en biais) au lieu de la longueur de la coque */
    mailles?: { niveau: number; v: number; rayon?: number; aplomb?: boolean };
  },
): { v: number[]; rayon: number } {
  const rad = Math.PI / 180;
  const point = (a: number, y: number, r: number) => new THREE.Vector3(Math.sin(a * rad) * r, y, Math.cos(a * rad) * r);
  const P = o.niveaux.map((n) =>
    o.angles.map((a) => {
      const y = n.y(a);
      return point(a, y, n.r(a, y));
    }),
  );
  const n = o.angles.length;
  const colonnes = o.ferme ? n : n - 1;
  const moyenne = (f: (i: number) => number) => o.angles.reduce((somme, _a, i) => somme + f(i), 0) / n;
  // Dessin des anneaux : `parDegre` mètres de dessin par degré autour de la tête (un nombre entier de carreaux
  // par tour), et `V[j]` la position du dessin au niveau j, mesurée le long de la coque (anneaux non étirés)
  const ancre = o.mailles;
  const rayon = ancre?.rayon ?? moyenne((i) => Math.hypot(P[ancre?.niveau ?? 0][i].x, P[ancre?.niveau ?? 0][i].z));
  const parDegre = (Math.max(1, Math.round((2 * Math.PI * rayon) / at.carreau)) * at.carreau) / 360;
  const V = [0];
  for (let j = 0; j < P.length - 1; j++) V.push(V[j] + moyenne((i) => P[j][i].distanceTo(P[j + 1][i])));
  if (ancre) {
    const decalage = ancre.v - V[ancre.niveau];
    V.forEach((v, j) => (V[j] = v + decalage));
  }
  type UV = [number, number];
  /** Coordonnées du dessin au point de la colonne `i` et du niveau `j`, la colonne étant à l'angle `a` */
  const uvDe = (a: number, i: number, j: number): UV => [a * parDegre, ancre?.aplomb ? ancre.v + P[j][i].y - P[ancre.niveau][i].y : V[j]];
  const lots = new Map<string, { couleur: number; matiere: Matiere; positions: number[]; uv: number[] }>();
  const facette = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, couleur: number, matiere: Matiere, uv: [UV, UV, UV]) => {
    const cle = `${matiere}:${couleur}`;
    let lot = lots.get(cle);
    if (!lot) {
      lot = { couleur, matiere, positions: [], uv: [] };
      lots.set(cle, lot);
    }
    lot.positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    lot.uv.push(...uv[0], ...uv[1], ...uv[2]);
  };
  for (let i = 0; i < colonnes; i++) {
    const i1 = (i + 1) % n;
    const milieu = o.angles[i] + (o.ferme && i1 === 0 ? o.angles[0] + 360 - o.angles[i] : o.angles[i1] - o.angles[i]) / 2;
    const a0 = o.angles[i];
    const a1 = 2 * milieu - a0;
    for (let j = 0; j < P.length - 1; j++) {
      const couleur = o.couleur(i, j, milieu);
      const matiere = o.matiere?.(i, j, milieu) ?? 'mat';
      facette(P[j][i], P[j][i1], P[j + 1][i1], couleur, matiere, [uvDe(a0, i, j), uvDe(a1, i1, j), uvDe(a1, i1, j + 1)]);
      facette(P[j][i], P[j + 1][i1], P[j + 1][i], couleur, matiere, [uvDe(a0, i, j), uvDe(a1, i1, j + 1), uvDe(a0, i, j + 1)]);
    }
    if (o.sommet) {
      const j = P.length - 1;
      const sommet = new THREE.Vector3(...o.sommet);
      const vSommet = V[j] + moyenne((k) => P[j][k].distanceTo(sommet));
      facette(P[j][i], P[j][i1], sommet, o.couleur(i, j, milieu), o.matiere?.(i, j, milieu) ?? 'mat', [uvDe(a0, i, j), uvDe(a1, i1, j), [milieu * parDegre, vSommet]]);
    }
  }
  if (o.bords && !o.ferme) {
    // Lèvres des deux bords du pan : elles rejoignent le crâne et regardent vers l'ouverture
    const normale = new THREE.Vector3();
    const v = new THREE.Vector3();
    for (const [i, sens] of [
      [0, -1],
      [n - 1, 1],
    ]) {
      const a = o.angles[i];
      const dehors = new THREE.Vector3(Math.cos(a * rad) * sens, 0, -Math.sin(a * rad) * sens);
      const dedans = o.niveaux.map((niv) => {
        const y = niv.y(a);
        return point(a, y, o.bords!(a, y));
      });
      const col = Math.min(i, colonnes - 1);
      for (let j = 0; j < P.length - 1; j++) {
        const couleur = o.couleur(col, j, a);
        const matiere = o.matiere?.(col, j, a) ?? 'mat';
        const quad = [P[j][i], P[j + 1][i], dedans[j + 1], dedans[j]];
        // Le dessin continue sur la lèvre, dans le prolongement du bord
        const u = a * parDegre;
        const uv: UV[] = [
          [u, V[j]],
          [u, V[j + 1]],
          [u + sens * quad[1].distanceTo(quad[2]), V[j + 1]],
          [u + sens * quad[0].distanceTo(quad[3]), V[j]],
        ];
        normale.copy(quad[1]).sub(quad[0]).cross(v.copy(quad[3]).sub(quad[0]));
        if (normale.dot(dehors) < 0) {
          quad.reverse();
          uv.reverse();
        }
        facette(quad[0], quad[1], quad[2], couleur, matiere, [uv[0], uv[1], uv[2]]);
        facette(quad[0], quad[2], quad[3], couleur, matiere, [uv[0], uv[2], uv[3]]);
      }
    }
  }
  for (const lot of lots.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(lot.positions, 3));
    if (ancre) g.setAttribute('uvMetres', new THREE.Float32BufferAttribute(lot.uv, 2));
    at.poser(parent, g, lot.couleur, undefined, lot.matiere);
  }
  return { v: V, rayon };
}

/** Colonnes régulières : tout le tour (16 colonnes), ou seulement les côtés et l'arrière (visage dégagé de ±45°). */
const TOUR = Array.from({ length: 16 }, (_, k) => -180 + k * 22.5);
const COTES_ET_NUQUE = Array.from({ length: 13 }, (_, k) => 45 + k * 22.5);

// Coins coupés du bas de l'ouverture du camail : largeur en degrés autour de la tête, hauteur en mètres
const COIN_CAMAIL = { largeur: 14, hauteur: 0.09 };

/** Les casques, posés sur la tête du personnage (3e personne). */
export function creerCasques(t: TeteCasque): GardeRobe<TypeCasque> {
  const C = COULEURS;
  const K = COULEURS_CASQUES;
  const rad = Math.PI / 180;
  const crane = (a: number, y: number) => t.rayonCrane(a * rad, Math.max(0, y));
  // Volume de la coiffure, prolongé au-dessus en dôme jusqu'à la hauteur `haut` : les casques épousent cette grosse tête
  const volume = (a: number, y: number, haut: number) => {
    const pivot = 0.45;
    const v = Math.max(0, y - pivot) / (haut - pivot);
    return t.rayonCheveux(a * rad, Math.max(0, Math.min(y, pivot))) * Math.sqrt(Math.max(0, 1 - v * v));
  };
  const fixe = (y: number) => () => y;

  /** Pan qui couvre les oreilles et la nuque, du bandeau (y = 0,365) jusqu'au bord `bas` (table selon la direction). */
  function couvreNuque(at: Atelier, bas: [number, number][], epaisseur: number, couleur: (i: number, j: number) => number, bosses = 0): void {
    const yBas = (a: number) => selonEcart(bas, a);
    const bosse = (a: number, j: number) => bosses * hasard(Math.round(a), j);
    voute(at, t.tete, {
      angles: COTES_ET_NUQUE,
      ferme: false,
      niveaux: [
        { y: (a) => yBas(a) + 0.014, r: (a, y) => crane(a, y) },
        { y: yBas, r: (a, y) => volume(a, y, 1) + epaisseur + bosse(a, 1) },
        { y: (a) => (yBas(a) + 0.365) / 2, r: (a, y) => volume(a, y, 1) + epaisseur + 0.008 + bosse(a, 2) },
        { y: fixe(0.365), r: (a, y) => volume(a, y, 1) + epaisseur - 0.006 },
      ],
      couleur: (i, j) => couleur(i, j),
      bords: (a, y) => crane(a, y),
    });
  }

  return creerGardeRobe<TypeCasque>(
    {
      // Bonnet de cuir : calotte à côtes, bandeau, oreillettes ; la frange dépasse sur le front
      cuir: (at) => {
        const haut = 0.6;
        const bord = (a: number) => selonEcart([[0, 0.392], [45, 0.392], [67.5, 0.362], [180, 0.362]], a);
        voute(at, t.tete, {
          angles: TOUR,
          ferme: true,
          niveaux: [
            { y: (a) => bord(a) + 0.014, r: (a, y) => volume(a, y, haut) },
            { y: bord, r: (a, y) => volume(a, y, haut) + 0.044 },
            { y: (a) => bord(a) + 0.05, r: (a, y) => volume(a, y, haut) + 0.044 },
            { y: (a) => bord(a) + 0.054, r: (a, y) => volume(a, y, haut) + 0.03 },
            { y: fixe(0.505), r: (a, y) => volume(a, y, haut) + 0.03 },
            { y: fixe(0.56), r: (a, y) => volume(a, y, haut) + 0.026 },
          ],
          sommet: [0, haut, -0.01],
          // Bandeau sombre, puis côtes : une teinte par paire de colonnes
          couleur: (i, j) => (j <= 2 ? C.cuirSombre : Math.floor(i / 2) % 2 === 0 ? C.cuir : C.cuirClair),
        });
        at.poser(t.tete, new THREE.IcosahedronGeometry(0.028, 0), C.cuirSombre, pose(0, haut + 0.004, -0.01));
        couvreNuque(at, [[45, 0.3], [67.5, 0.15], [90, 0.115], [112.5, 0.15], [135, 0.2], [180, 0.18]], 0.036, (_i, j) => (j === 0 ? C.cuirSombre : C.cuir));
        return [t.masse];
      },
      // Chapka : dessus de feutre gris-mauve, gros bourrelet de fourrure crème, oreillettes de fourrure
      fourrure: (at) => {
        const haut = 0.615;
        const bord = 0.352;
        const bosse = (a: number, j: number) => 0.016 * hasard(Math.round(a), j);
        voute(at, t.tete, {
          angles: TOUR,
          ferme: true,
          niveaux: [
            { y: fixe(bord + 0.014), r: (a, y) => crane(a, y) },
            { y: fixe(bord), r: (a, y) => volume(a, y, haut) + 0.05 + bosse(a, 1) },
            { y: fixe(bord + 0.05), r: (a, y) => volume(a, y, haut) + 0.088 + bosse(a, 2) },
            { y: fixe(bord + 0.1), r: (a, y) => volume(a, y, haut) + 0.074 + bosse(a, 3) },
            { y: fixe(bord + 0.125), r: (a, y) => volume(a, y, haut) + 0.03 },
            { y: fixe(0.53), r: (a, y) => volume(a, y, haut) + 0.03 },
            { y: fixe(0.585), r: (a, y) => volume(a, y, haut) + 0.024 },
          ],
          sommet: [0, haut, 0],
          couleur: (i, j) => (j <= 3 ? ((i + j) % 2 === 0 ? C.creme : C.cremeSombre) : Math.floor(i / 2) % 2 === 0 ? K.feutre : K.feutreSombre),
        });
        couvreNuque(at, [[45, 0.3], [67.5, 0.14], [90, 0.1], [112.5, 0.14], [135, 0.19], [180, 0.19]], 0.058, (i, j) => ((i + j) % 2 === 0 ? C.cremeSombre : C.creme), 0.014);
        return [t.cheveux];
      },
      // Camail : capuche de mailles, ouverture ovale sur le visage, pèlerine sur les épaules
      mailles: (at) => {
        const haut = 0.59;
        const mailles = () => 'mailles' as Matiere;
        const anneaux = () => C.anneaux;
        const menton = 0.07;
        // Dessus : le bord passe en visière au-dessus des sourcils
        const dessus = voute(at, t.tete, {
          angles: TOUR,
          ferme: true,
          niveaux: [
            { y: fixe(0.375), r: (a, y) => (ecartAvant(a) <= 46 ? crane(a, y) : volume(a, y, haut) + 0.04) },
            { y: fixe(0.362), r: (a, y) => volume(a, y, haut) + 0.04 },
            { y: fixe(0.45), r: (a, y) => volume(a, y, haut) + 0.04 },
            { y: fixe(0.52), r: (a, y) => volume(a, y, haut) + 0.036 },
            { y: fixe(0.565), r: (a, y) => volume(a, y, haut) + 0.03 },
          ],
          sommet: [0, haut, -0.005],
          couleur: anneaux,
          matiere: mailles,
          mailles: { niveau: 1, v: 0.362 },
        });
        // Côtés et nuque, des tempes au menton ; le dessin des anneaux se raccorde à celui du dessus
        const cotes = voute(at, t.tete, {
          angles: COTES_ET_NUQUE,
          ferme: false,
          niveaux: [
            { y: fixe(menton), r: (a, y) => volume(a, y, 1) + 0.04 },
            { y: fixe(0.2), r: (a, y) => volume(a, y, 1) + 0.042 },
            { y: fixe(0.362), r: (a, y) => volume(a, y, 1) + 0.04 },
          ],
          couleur: anneaux,
          matiere: mailles,
          bords: (a, y) => crane(a, y),
          mailles: { niveau: 2, v: dessus.v[1], rayon: dessus.rayon },
        });
        // Coins bas de l'ouverture du visage : deux petits pans en biais, qui l'arrondissent sous les joues
        for (const cote of [1, -1]) {
          const angles = cote === 1 ? [45 - COIN_CAMAIL.largeur, 45] : [315, 315 + COIN_CAMAIL.largeur];
          // 0 au bord du pan côté visage, 1 contre le côté de la capuche
          const versCote = (a: number) => (45 - ecartAvant(a) < COIN_CAMAIL.largeur / 2 ? 1 : 0);
          const biaisBas = (a: number) => menton + COIN_CAMAIL.hauteur * versCote(a);
          voute(at, t.tete, {
            angles,
            ferme: false,
            niveaux: [
              { y: fixe(menton), r: (a, y) => volume(a, y, 1) + 0.04 },
              { y: biaisBas, r: (a, y) => volume(a, y, 1) + 0.04 },
              { y: (a) => biaisBas(a) - 0.012, r: (a, y) => crane(a, y) },
            ],
            couleur: anneaux,
            matiere: mailles,
            mailles: { niveau: 0, v: cotes.v[0], rayon: dessus.rayon, aplomb: true },
          });
        }
        // Mentonnière, cou, puis pèlerine évasée sur les épaules
        const ovale = (rx: number, rz: number) => (a: number) => 1 / Math.hypot(Math.sin(a * rad) / rx, Math.cos(a * rad) / rz);
        voute(at, t.tete, {
          angles: TOUR,
          ferme: true,
          niveaux: [
            { y: fixe(-0.11), r: ovale(0.3, 0.2) },
            { y: fixe(-0.125), r: ovale(0.37, 0.265) },
            { y: fixe(-0.06), r: ovale(0.3, 0.215) },
            { y: fixe(0.005), r: ovale(0.2, 0.185) },
            { y: fixe(menton), r: (a, y) => volume(a, y, 1) + 0.04 },
            { y: fixe(menton + 0.012), r: (a, y) => (ecartAvant(a) <= 46 ? crane(a, y) : volume(a, y, 1) + 0.04) },
          ],
          couleur: anneaux,
          matiere: mailles,
          mailles: { niveau: 4, v: cotes.v[0], rayon: dessus.rayon },
        });
        return [t.cheveux, ...t.oreilles];
      },
      // Heaume : grand casque fermé, arête au milieu, visière en pointe, fente sombre, bord évasé sur la nuque
      plaques: (at) => {
        const haut = 0.63;
        const acier = () => 'acier' as Matiere;
        // Arête : seule la colonne du milieu du visage avance
        const arete = (a: number, saillie: number) => (ecartAvant(a) < 1 ? saillie : 0);
        const nuque = (a: number) => Math.max(0, Math.min(1, (ecartAvant(a) - 95) / 45));
        const coque = (e: number, saillie: number, evase = 0) => (a: number, y: number) => volume(a, y, haut) + e + arete(a, saillie) + evase * nuque(a);
        const devant = (a: number) => ecartAvant(a) < 60;
        voute(at, t.tete, {
          angles: TOUR,
          ferme: true,
          niveaux: [
            { y: fixe(-0.02), r: () => 0.12 },
            { y: fixe(-0.035), r: coque(0.05, 0.02, 0.07) },
            { y: fixe(0.02), r: coque(0.045, 0.07, 0.035) },
            { y: fixe(0.12), r: coque(0.046, 0.125) },
            { y: fixe(0.2), r: coque(0.046, 0.11) },
            { y: fixe(0.236), r: coque(0.046, 0.1) },
            { y: fixe(0.25), r: coque(0.062, 0.1) },
            { y: fixe(0.37), r: coque(0.052, 0.07) },
            { y: fixe(0.47), r: coque(0.05, 0.05) },
            { y: fixe(0.55), r: coque(0.044, 0.03) },
            { y: fixe(0.6), r: coque(0.03, 0.025) },
          ],
          sommet: [0, haut, 0.01],
          // Fente de visière sombre devant, visière plus claire dessous, bord de nuque et dessous plus sombres
          couleur: (_i, j, a) => (j === 4 && devant(a) ? K.fente : j <= 1 ? C.acierSombre : j <= 3 && devant(a) ? C.acierClair : j === 5 ? C.acierSombre : C.acier),
          matiere: (_i, j, a) => (j === 4 && devant(a) ? 'mat' : acier()),
        });
        // Rivets de visière sur les côtés
        for (const s of [1, -1]) {
          for (const [y, r] of [
            [0.225, 0.026],
            [0.1, 0.02],
          ]) {
            const a = s * 74;
            const d = volume(a, y, haut) + 0.05;
            at.poser(t.tete, new THREE.IcosahedronGeometry(r, 0), C.acierSombre, pose(Math.sin(a * rad) * d, y, Math.cos(a * rad) * d), 'acier');
          }
        }
        return [t.cheveux, ...t.oreilles, ...t.visage];
      },
    },
    // Anneaux un peu plus petits que sur le corps : les facettes de la capuche sont petites
    { carreau: 0.14, ombres: true },
  );
}
