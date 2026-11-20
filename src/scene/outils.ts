// Outils tenus par le personnage (hache, pioche, épée, pousse d'arbre à planter, torche), modelés en code d'après les images concept,
// et les formes low poly partagées avec le modèle du personnage.
// Repère d'un outil : l'origine est l'endroit où la main principale le tient, le manche est le long
// de +y (tête ou lame vers le haut) et le tranchant de la hache regarde vers +x.

import * as THREE from 'three';

// --- Formes low poly partagées --------------------------------------------------------------

export function creerMateriau(couleur: number, doubleFace = false): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: couleur,
    flatShading: true,
    roughness: 0.9,
    metalness: 0,
    side: doubleFace ? THREE.DoubleSide : THREE.FrontSide,
  });
}

export function maille(geometrie: THREE.BufferGeometry, materiau: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geometrie, materiau);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

export function boite(l: number, h: number, p: number, materiau: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  return maille(new THREE.BoxGeometry(l, h, p), materiau, x, y, z);
}

/** Bloc facetté (icosaèdre étiré) : cheveux, pommeau… */
export function galet(rx: number, ry: number, rz: number, detail = 0): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  g.scale(rx, ry, rz);
  return g;
}

/** Une tranche d'un fuseau : demi-largeurs rx (côtés) et rz (avant-arrière), coins coupés de `c`. */
export interface Anneau {
  y: number;
  rx: number;
  rz: number;
  /** Taille du coin coupé (par défaut un tiers de la plus petite demi-largeur) */
  c?: number;
  dx?: number;
  dz?: number;
}

/**
 * Volume fait de tranches à 8 côtés (rectangle aux coins coupés) reliées entre elles et fermé
 * aux deux bouts. Donne des membres, un buste ou une tête aux faces plates mais aux formes travaillées.
 */
export function fuseau(tranches: Anneau[]): THREE.BufferGeometry {
  const anneaux = tranches[0].y <= tranches[tranches.length - 1].y ? tranches : [...tranches].reverse();
  const positions: number[] = [];
  const indices: number[] = [];
  for (const a of anneaux) {
    const c = Math.min(a.c ?? Math.min(a.rx, a.rz) * 0.34, a.rx, a.rz);
    const dx = a.dx ?? 0;
    const dz = a.dz ?? 0;
    const contour = [
      [a.rx, -(a.rz - c)],
      [a.rx, a.rz - c],
      [a.rx - c, a.rz],
      [-(a.rx - c), a.rz],
      [-a.rx, a.rz - c],
      [-a.rx, -(a.rz - c)],
      [-(a.rx - c), -a.rz],
      [a.rx - c, -a.rz],
    ];
    for (const [x, z] of contour) positions.push(x + dx, a.y, z + dz);
  }
  const n = anneaux.length;
  for (let k = 0; k < n - 1; k++) {
    for (let i = 0; i < 8; i++) {
      const a = k * 8 + i;
      const a1 = k * 8 + ((i + 1) % 8);
      indices.push(a, a + 8, a1, a1, a + 8, a1 + 8);
    }
  }
  // Fermeture des deux bouts, en éventail autour d'un point central
  const bas = anneaux[0];
  const haut = anneaux[n - 1];
  const centreBas = positions.length / 3;
  positions.push(bas.dx ?? 0, bas.y, bas.dz ?? 0);
  const centreHaut = centreBas + 1;
  positions.push(haut.dx ?? 0, haut.y, haut.dz ?? 0);
  const dernier = (n - 1) * 8;
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8;
    indices.push(centreBas, i, j, centreHaut, dernier + j, dernier + i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/**
 * Lame plate dont l'épaisseur varie : contour de points [x, y, épaisseur] dans le plan xy.
 * À dessiner avec un matériau double face.
 */
export function lame(points: Array<[number, number, number]>): THREE.BufferGeometry {
  const n = points.length;
  const positions: number[] = [];
  for (const signe of [1, -1]) {
    for (const [x, y, e] of points) positions.push(x, y, (signe * e) / 2);
  }
  const indices: number[] = [];
  const triangles = THREE.ShapeUtils.triangulateShape(
    points.map(([x, y]) => new THREE.Vector2(x, y)),
    [],
  );
  for (const [a, b, c] of triangles) indices.push(a, b, c, n + c, n + b, n + a);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    indices.push(i, n + i, j, j, n + i, n + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

// --- Outils ---------------------------------------------------------------------------------

export type TypeOutil = 'hache' | 'pioche' | 'epee';
/** Ce que la main peut tenir : un outil, une pousse d'arbre à planter, un piège à poser, une torche ou l'arc (qui ne sont pas des outils pour les règles). */
export type TypeObjetEnMain = TypeOutil | 'pousse' | 'piege' | 'torche' | 'arc';

export const OUTIL_PAR_DEFAUT: TypeOutil = 'hache';

/** Façon de tenir chaque outil : à deux mains ou non, et distance entre les deux mains sur le manche. */
export const PRISES: Record<TypeObjetEnMain, { deuxMains: boolean; ecartMains: number }> = {
  hache: { deuxMains: true, ecartMains: 0.21 },
  pioche: { deuxMains: true, ecartMains: 0.21 },
  epee: { deuxMains: false, ecartMains: 0 },
  pousse: { deuxMains: false, ecartMains: 0 },
  piege: { deuxMains: false, ecartMains: 0 },
  torche: { deuxMains: false, ecartMains: 0 },
  // L'arc a sa propre tenue (main gauche sur la poignée, main droite sur la corde) : voir personnage.ts
  arc: { deuxMains: false, ecartMains: 0 },
};

const COULEURS_OUTILS = {
  bois: 0x9a5e30,
  // Bois patiné par la main
  boisSombre: 0x74452a,
  // Bois fraîchement taillé, plus clair : lame, tête et garde des outils en bois (palier de base)
  boisTaille: 0xc39b68,
  // Bois de bout et chanfreins tout juste coupés : encore plus clair
  boisClair: 0xdcb98a,
  fer: 0x9aa3b2,
  ferSombre: 0x7b8493,
  // Fer patiné, un peu chaud : renforts, bagues, viroles
  ferPatine: 0x8b857c,
  acier: 0xb4bcc8,
  // Fil affûté des lames, pointes des pioches, têtes de rivets : le métal le plus clair du palier
  tranchant: 0xd3dae4,
  // Vert-de-gris du cuivre (collets et frettes des outils en cuivre)
  patine: 0x5f9c86,
  cuir: 0x8a4a2c,
  cuirSombre: 0x633420,
  cuirClair: 0xb0733f,
  // Pousse d'arbre : motte de terre, racines, tige et feuilles
  terre: 0x6e4a2e,
  terreClaire: 0x8a6038,
  tige: 0x6f9a3a,
  feuille: 0xa4dc4e,
  feuilleSombre: 0x7fc63e,
  // Torche : toile huilée enroulée sur la tête, noircie là où elle brûle
  tissu: 0xb39662,
  tissuSombre: 0x8a6f45,
  tissuBrule: 0x3a2a22,
  // Losange clair au centre du bouclier renforcé
  ecusson: 0xefe6c8,
  // Cristal bleu translucide (lames et têtes du dernier palier) et ses facettes claires
  cristal: 0x4fb4ff,
  cristalClair: 0xa6e2ff,
};

export type MateriauxOutils = Record<keyof typeof COULEURS_OUTILS, THREE.MeshStandardMaterial>;

/** Palier d'un outil : la matière change (bois, puis métaux, puis cristal), et la forme aussi (voir creerOutil). Mêmes valeurs que `NiveauOutil` de src/regles/equipement.ts. */
export type NiveauOutil = 'base' | 'cuivre' | 'fer' | 'acier' | 'cristal';

type ReglageMetal = {
  couleurs: Partial<Record<keyof typeof COULEURS_OUTILS, number>>;
  roughness: number;
  emissive: number;
};

// Métal des outils d'un palier : les pièces de métal (tête, lame, bagues) prennent ces couleurs.
const METAL_PAR_NIVEAU: Readonly<Record<Exclude<NiveauOutil, 'base'>, ReglageMetal>> = {
  // Cuivre : orangé vif, un peu lisse (il doit se distinguer du bois d'un coup d'œil)
  cuivre: {
    couleurs: { fer: 0xdf7c42, ferSombre: 0xb65a2a, ferPatine: 0xc96a35, acier: 0xf0965a, tranchant: 0xffbb85 },
    roughness: 0.4,
    emissive: 0x3a1c0c,
  },
  // Fer : gris ardoise sombre, mat
  fer: {
    couleurs: { fer: 0x6b7888, ferSombre: 0x56616f, ferPatine: 0x606c7a, acier: 0x808d9c, tranchant: 0xa3afbd },
    roughness: 0.6,
    emissive: 0x0c0e12,
  },
  // Acier : argent très clair, lisse et légèrement lumineux pour qu'il brille
  acier: {
    couleurs: { fer: 0xc3ccd9, ferSombre: 0x9da8b8, ferPatine: 0xb0bac8, acier: 0xe6ecf4, tranchant: 0xfafcff },
    roughness: 0.2,
    emissive: 0x2a3038,
  },
  // Cristal : la monture est en argent bleuté ; la lame ou la tête est en cristal (matériaux `cristal`)
  cristal: {
    couleurs: { fer: 0xcfe0f2, ferSombre: 0x9db6d4, ferPatine: 0xb4c8e0, acier: 0xeef6ff, tranchant: 0xf6fbff },
    roughness: 0.15,
    emissive: 0x2a3f5c,
  },
};

// Cristal : translucide, lisse et légèrement lumineux
const CRISTAL = { opacite: 0.74, roughness: 0.12, emissive: 0x1f6fb8 };

// Palier pour lequel un jeu de matériaux a été créé : creerOutil y lit la forme à construire
const NIVEAU_DES_MATERIAUX = new WeakMap<MateriauxOutils, NiveauOutil>();

// Volumes pleins, dessinés sur une seule face
const SIMPLE_FACE: readonly string[] = ['bois', 'boisSombre', 'boisTaille', 'boisClair', 'cuir', 'cuirSombre', 'cuirClair', 'terre', 'terreClaire', 'tige', 'tissu', 'tissuSombre', 'tissuBrule'];

export function creerMateriauxOutils(niveau: NiveauOutil = 'base'): MateriauxOutils {
  const resultat = {} as MateriauxOutils;
  const metal = niveau === 'base' ? null : METAL_PAR_NIVEAU[niveau];
  for (const [nom, couleur] of Object.entries(COULEURS_OUTILS)) {
    const cle = nom as keyof MateriauxOutils;
    const teinte = metal?.couleurs[cle];
    // Le métal et les feuilles sont en double face : ce sont des volumes très fins
    const m = creerMateriau(teinte ?? couleur, !SIMPLE_FACE.includes(nom));
    if (metal && teinte !== undefined) {
      m.roughness = metal.roughness;
      m.emissive.setHex(metal.emissive);
    }
    resultat[cle] = m;
  }
  for (const m of [resultat.cristal, resultat.cristalClair]) {
    m.roughness = CRISTAL.roughness;
    m.emissive.setHex(CRISTAL.emissive);
    m.transparent = true;
    m.opacity = CRISTAL.opacite;
  }
  NIVEAU_DES_MATERIAUX.set(resultat, niveau);
  return resultat;
}

/** Les matériaux de tous les paliers (créés une fois par personnage). */
export function creerMateriauxParNiveau(): Record<NiveauOutil, MateriauxOutils> {
  return {
    base: creerMateriauxOutils('base'),
    cuivre: creerMateriauxOutils('cuivre'),
    fer: creerMateriauxOutils('fer'),
    acier: creerMateriauxOutils('acier'),
    cristal: creerMateriauxOutils('cristal'),
  };
}

// Fuseau couché le long de x : tranches [x, demi-hauteur, demi-épaisseur, montée en y]. Sert à la barre
// de la pioche et à la garde de l'épée ; `coin` règle la largeur des pans coupés.
type TrancheCouchee = readonly [number, number, number, number];

function fuseauCouche(profil: readonly TrancheCouchee[], coin = 0.6): THREE.BufferGeometry {
  const g = fuseau(
    profil.map(([x, demiHauteur, demiEpaisseur, montee]) => ({
      y: x,
      rx: demiHauteur,
      rz: demiEpaisseur,
      c: Math.min(demiHauteur, demiEpaisseur) * coin,
      dx: -montee,
    })),
  );
  g.rotateZ(-Math.PI / 2);
  g.computeVertexNormals();
  return g;
}

// Tête de rivet à facettes, posée sur une face avant ou arrière (elle dépasse le long de z)
const GEOMETRIE_RIVET = galet(0.0075, 0.0075, 0.005);

function rivet(materiau: THREE.Material, x: number, y: number, z: number, taille = 1): THREE.Mesh {
  const r = maille(GEOMETRIE_RIVET, materiau, x, y, z);
  r.scale.setScalar(taille);
  return r;
}

// --- Épée, hache et pioche, par palier ------------------------------------------------------------
// D'après docs/concepts/Cinq épées, du bois au cristal.png, Haches et pioches fantasy low poly.png et
// Planche d’outils médiévaux low poly.png. Chaque palier se reconnaît à sa matière et à sa silhouette :
//   base    : tout en bois taillé, court et épais, entaillé, ligaturé de cuir clair ;
//   cuivre  : métal orangé martelé, formes trapues, un peu de vert-de-gris ;
//   fer     : gris ardoise sombre, formes droites et massives, rivets et attelles ;
//   acier   : argent clair, formes longues et affûtées, garde de l'épée ouvragée ;
//   cristal : lame ou tête en cristal bleu à facettes, qui luit, dans une monture d'argent.
// Même repère, même taille d'ensemble et même prise pour tous les paliers : la tenue en main ne change pas.
// Coût : tous les morceaux d'un même matériau sont fondus en un seul maillage (voir `Pieces`).

type Point3 = readonly [number, number, number];
type CleMat = keyof typeof COULEURS_OUTILS;
/** Matériau d'une facette d'un tube : le même partout, ou choisi d'après le rang (entre deux anneaux) et la colonne. */
type CleFacette = CleMat | ((rang: number, colonne: number) => CleMat);

// Lueur du cristal : la même forme redessinée par-dessus en couleur pleine ajoutée à l'image (elle ne dépend
// pas de l'éclairage : le cristal luit aussi la nuit et en 1re personne), et un halo plus large, très léger.
// Ce ne sont pas des lumières : rien d'autre n'est éclairé.
function creerMateriauLueur(opacite: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: 0x2b86e0,
    transparent: true,
    opacity: opacite,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}
const MAT_LUEUR_CRISTAL = creerMateriauLueur(0.4);
const MAT_HALO_CRISTAL = creerMateriauLueur(0.11);

/** Matrice de pose d'un morceau : position, puis rotations autour de z, x et y (radians). */
function pose(x = 0, y = 0, z = 0, rz = 0, rx = 0, ry = 0): THREE.Matrix4 {
  return new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)).setPosition(x, y, z);
}

function geometrieDe(positions: number[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return g;
}

/**
 * Rassemble les triangles d'un outil, triés par matériau : à la fin, un seul maillage par matériau
 * (un outil coûte ainsi quelques appels de dessin, quel que soit son nombre de morceaux).
 */
class Pieces {
  private readonly tas = new Map<CleMat, number[]>();
  private readonly lueurs: number[] = [];
  private readonly halos: number[] = [];
  // Triangles de la pièce de cristal en cours (voir `cristal`)
  private suivi: number[] | null = null;

  /** Un triangle (sommets dans le sens inverse des aiguilles d'une montre, vu de l'extérieur). */
  tri(cle: CleMat, a: Point3, b: Point3, c: Point3): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    // Triangle plat (anneaux resserrés en une pointe) : rien à dessiner
    if (nx * nx + ny * ny + nz * nz < 1e-18) return;
    let positions = this.tas.get(cle);
    if (!positions) {
      positions = [];
      this.tas.set(cle, positions);
    }
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.suivi?.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  }

  /** Ajoute une géométrie toute faite, posée par `matrice`. */
  geometrie(cle: CleMat, g: THREE.BufferGeometry, matrice?: THREE.Matrix4): void {
    const position = g.attributes.position;
    const index = g.index;
    const n = index ? index.count : position.count;
    const v = new THREE.Vector3();
    const sommets: Point3[] = [];
    for (let i = 0; i < n; i++) {
      v.fromBufferAttribute(position, index ? index.getX(i) : i);
      if (matrice) v.applyMatrix4(matrice);
      sommets.push([v.x, v.y, v.z]);
    }
    for (let i = 0; i + 2 < n; i += 3) this.tri(cle, sommets[i], sommets[i + 1], sommets[i + 2]);
  }

  boite(cle: CleMat, l: number, h: number, p: number, matrice: THREE.Matrix4): void {
    this.geometrie(cle, new THREE.BoxGeometry(l, h, p), matrice);
  }

  /**
   * Tube : anneaux de points (autant dans chacun) reliés entre eux, fermé aux deux bouts si `bouts`.
   * Sens : (direction d'un anneau au suivant) × (direction d'un point au suivant) regarde vers l'extérieur ;
   * par exemple des anneaux qui montent le long de +y et tournent de +x vers +z.
   */
  tube(anneaux: ReadonlyArray<ReadonlyArray<Point3>>, cle: CleFacette, bouts = true): void {
    const n = anneaux[0].length;
    const choix = (rang: number, colonne: number) => (typeof cle === 'function' ? cle(rang, colonne) : cle);
    for (let k = 0; k + 1 < anneaux.length; k++) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const c = choix(k, i);
        this.tri(c, anneaux[k][i], anneaux[k + 1][i], anneaux[k][j]);
        this.tri(c, anneaux[k][j], anneaux[k + 1][i], anneaux[k + 1][j]);
      }
    }
    if (!bouts) return;
    const premier = anneaux[0];
    const dernier = anneaux[anneaux.length - 1];
    const rangFin = anneaux.length - 2;
    for (let i = 1; i < n - 1; i++) {
      this.tri(choix(0, 0), premier[0], premier[i], premier[i + 1]);
      this.tri(choix(rangFin, 0), dernier[0], dernier[i + 1], dernier[i]);
    }
  }

  /** Bande ouverte entre deux rangées de points : (de `bas` vers `haut`) × (d'un point au suivant) regarde vers l'extérieur. */
  ruban(cle: CleMat, bas: ReadonlyArray<Point3>, haut: ReadonlyArray<Point3>): void {
    for (let i = 0; i + 1 < bas.length; i++) {
      this.tri(cle, bas[i], haut[i], bas[i + 1]);
      this.tri(cle, bas[i + 1], haut[i], haut[i + 1]);
    }
  }

  /**
   * Pièce de cristal : tout ce que `tracer` ajoute reçoit une lueur et un halo (`halo` : grossissement en
   * x, y, z autour du centre de la pièce).
   */
  cristal(halo: Point3, tracer: () => void): void {
    const suivi: number[] = [];
    this.suivi = suivi;
    tracer();
    this.suivi = null;
    const centre = new THREE.Box3().setFromArray(suivi).getCenter(new THREE.Vector3());
    for (const [cible, echelle] of [
      [this.lueurs, [1.04, 1.04, 1.04]],
      [this.halos, halo],
    ] as const) {
      for (let i = 0; i < suivi.length; i += 3) {
        cible.push(
          centre.x + (suivi[i] - centre.x) * echelle[0],
          centre.y + (suivi[i + 1] - centre.y) * echelle[1],
          centre.z + (suivi[i + 2] - centre.z) * echelle[2],
        );
      }
    }
  }

  /** Construit l'outil : un maillage par matériau, plus la lueur du cristal s'il y en a. */
  assembler(mat: MateriauxOutils): THREE.Group {
    const outil = new THREE.Group();
    for (const [cle, positions] of this.tas) outil.add(maille(geometrieDe(positions), mat[cle]));
    if (this.lueurs.length > 0) {
      // Rangé dans `userData.flammes` : le personnage le cache avec le corps en 1re personne, comme les flammes de la torche
      const lueur = new THREE.Group();
      lueur.name = 'lueur-cristal';
      for (const [positions, materiau] of [
        [this.lueurs, MAT_LUEUR_CRISTAL],
        [this.halos, MAT_HALO_CRISTAL],
      ] as const) {
        const m = new THREE.Mesh(geometrieDe(positions), materiau);
        m.renderOrder = 1;
        lueur.add(m);
      }
      outil.add(lueur);
      outil.userData.flammes = lueur;
    }
    return outil;
  }
}

/** Nombre entre 0 et 1, toujours le même pour un même `n` : irrégularités du bois, du métal martelé et du cristal. */
function alea(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function melanger(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Petit bloc à huit facettes (losange vu de face). */
function eclat(rx: number, ry: number, rz: number): THREE.BufferGeometry {
  const g = new THREE.OctahedronGeometry(1, 0);
  g.scale(rx, ry, rz);
  return g;
}

/** Bague à pans autour d'un manche (demi-largeurs rx, rz), centrée à l'origine. */
function bague(rx: number, rz: number, demiHauteur: number): THREE.BufferGeometry {
  return fuseau([
    { y: -demiHauteur, rx: rx * 0.9, rz: rz * 0.9 },
    { y: -demiHauteur * 0.45, rx, rz },
    { y: demiHauteur * 0.45, rx, rz },
    { y: demiHauteur, rx: rx * 0.9, rz: rz * 0.9 },
  ]);
}

/** Pose une tête de rivet à six pans, bombée, sur les deux faces (avant et arrière) d'une pièce d'épaisseur 2 × `z`. */
function riveter(p: Pieces, cle: CleMat, x: number, y: number, z: number, taille = 1): void {
  const r = 0.0075 * taille;
  const h = 0.0042 * taille;
  for (const face of [1, -1]) {
    const tete = new THREE.CylinderGeometry(r * 0.45, r, h, 6);
    tete.rotateX((face * Math.PI) / 2);
    p.geometrie(cle, tete, pose(x, y, face * (z + h / 2 - 0.0005)));
  }
}

/** Deux lanières croisées sur les faces avant et arrière d'un bloc (outils en bois ligaturés). */
function croiserLanieres(p: Pieces, cle: CleMat, y: number, z: number, longueur: number, penche: number): void {
  for (const face of [1, -1]) {
    p.boite(cle, 0.013, longueur, 0.006, pose(0, y, face * z, penche));
    p.boite(cle, 0.013, longueur, 0.006, pose(0, y, face * (z + 0.003), -penche));
  }
}

// --- Épée ---

// Hauteur de la garde et du centre du pommeau (la main tient la poignée à y = 0)
const GARDE_Y = 0.09;
const POMMEAU_Y = -0.112;

// Tranche d'une lame d'épée, vue en coupe : un tranchant de chaque côté, un biseau jusqu'à l'épaule, un plat,
// puis le milieu, creusé en gorge ou relevé en arête.
interface TrancheLame {
  y: number;
  /** Demi-largeur, du milieu au tranchant */
  w: number;
  /** Demi-épaisseur des plats */
  e: number;
  /** Largeur du biseau (0 : bord droit et épais, comme le talon de la lame contre la garde) */
  b?: number;
  /** Demi-largeur de la gorge ou de l'arête centrale */
  g?: number;
  /** Profondeur de la gorge (positif) ou hauteur de l'arête (négatif) */
  p?: number;
  /** Un tranchant monte, l'autre descend : facettes en travers (métal martelé, cristal) */
  biais?: number;
  /** Entaille dans le tranchant de droite ou de gauche (profondeur) */
  entailleD?: number;
  entailleG?: number;
}

interface FormeLame {
  /** Valeurs par défaut de `b`, `g` et `p` pour toutes les tranches */
  b: number;
  g: number;
  p: number;
  tranches: readonly TrancheLame[];
}

// Lame de chaque palier. Toutes partent de sous la garde ; la dernière tranche est la pointe.
const LAMES_EPEE: Readonly<Record<NiveauOutil, FormeLame>> = {
  // Bois : large, épaisse, à grands chanfreins, entaillée, pointe courte et émoussée
  base: {
    b: 0.014,
    g: 0.007,
    p: -0.0015,
    tranches: [
      { y: 0.1, w: 0.045, e: 0.015 },
      { y: 0.214, w: 0.0455, e: 0.015 },
      { y: 0.222, w: 0.0455, e: 0.015, entailleD: 0.009 },
      { y: 0.236, w: 0.0455, e: 0.015 },
      { y: 0.352, w: 0.045, e: 0.015 },
      { y: 0.366, w: 0.045, e: 0.015, entailleG: 0.008 },
      { y: 0.373, w: 0.045, e: 0.015 },
      { y: 0.452, w: 0.045, e: 0.015 },
      { y: 0.458, w: 0.045, e: 0.015, entailleD: 0.006 },
      { y: 0.468, w: 0.045, e: 0.015 },
      { y: 0.535, w: 0.045, e: 0.015 },
      { y: 0.6, w: 0.019, e: 0.012 },
      { y: 0.625, w: 0.008, e: 0.005, g: 0.003 },
    ],
  },
  // Cuivre : large, un peu en feuille, martelée (facettes en travers), gorge large et peu profonde
  cuivre: {
    b: 0.012,
    g: 0.011,
    p: 0.0035,
    tranches: [
      { y: 0.1, w: 0.044, e: 0.013, b: 0 },
      { y: 0.128, w: 0.044, e: 0.013, b: 0 },
      { y: 0.142, w: 0.044, e: 0.013 },
      { y: 0.25, w: 0.046, e: 0.0135, biais: 0.02 },
      { y: 0.37, w: 0.049, e: 0.0135, biais: -0.022 },
      { y: 0.44, w: 0.05, e: 0.013, biais: 0.012, g: 0.0025, p: -0.001 },
      { y: 0.545, w: 0.047, e: 0.012, biais: 0.008, g: 0.0025, p: -0.001 },
      { y: 0.61, w: 0.025, e: 0.008, g: 0.0025, p: -0.001 },
      { y: 0.645, w: 0, e: 0 },
    ],
  },
  // Fer : droite, massive, talon carré, gorge profonde sur les deux tiers
  fer: {
    b: 0.011,
    g: 0.011,
    p: 0.005,
    tranches: [
      { y: 0.1, w: 0.044, e: 0.012, b: 0 },
      { y: 0.136, w: 0.044, e: 0.012, b: 0 },
      { y: 0.152, w: 0.044, e: 0.012 },
      { y: 0.44, w: 0.043, e: 0.012 },
      { y: 0.49, w: 0.043, e: 0.012, g: 0.0025, p: 0 },
      { y: 0.575, w: 0.042, e: 0.0115, g: 0.0025, p: 0 },
      { y: 0.645, w: 0.022, e: 0.007, g: 0.0025, p: 0 },
      { y: 0.685, w: 0, e: 0 },
    ],
  },
  // Acier : évasée contre la garde, fine, gorge étroite puis arête, longue pointe
  acier: {
    b: 0.012,
    g: 0.006,
    p: 0.004,
    tranches: [
      { y: 0.1, w: 0.05, e: 0.012, b: 0 },
      { y: 0.14, w: 0.039, e: 0.011, b: 0.004 },
      { y: 0.168, w: 0.0385, e: 0.011 },
      { y: 0.4, w: 0.037, e: 0.0105 },
      { y: 0.44, w: 0.0367, e: 0.0105, g: 0.0025, p: -0.0015 },
      { y: 0.615, w: 0.035, e: 0.01, g: 0.0025, p: -0.0015 },
      { y: 0.7, w: 0.017, e: 0.006, g: 0.002, p: -0.001 },
      { y: 0.745, w: 0, e: 0 },
    ],
  },
  // Cristal : épaisse, évasée contre la garde, arête haute, grandes facettes en travers
  cristal: {
    b: 0.02,
    g: 0.004,
    p: -0.004,
    tranches: [
      { y: 0.1, w: 0.05, e: 0.016, b: 0.008 },
      { y: 0.14, w: 0.041, e: 0.016 },
      { y: 0.26, w: 0.043, e: 0.018, biais: 0.032 },
      { y: 0.385, w: 0.04, e: 0.016, biais: -0.032 },
      { y: 0.51, w: 0.043, e: 0.018, biais: 0.032 },
      { y: 0.615, w: 0.039, e: 0.016, biais: -0.014 },
      { y: 0.745, w: 0, e: 0 },
    ],
  },
};

// Colonnes d'un anneau de lame (voir `tracerLame`) : biseaux des tranchants, et milieu (gorge ou arête)
const COLONNES_BISEAU: readonly number[] = [0, 5, 6, 11];
const COLONNES_MILIEU: readonly number[] = [2, 3, 8, 9];

/** Trace une lame d'épée ; `cle` reçoit le rang et la partie de la lame (biseau, milieu ou plat). */
function tracerLame(p: Pieces, forme: FormeLame, cle: (rang: number, partie: 'biseau' | 'milieu' | 'plat', colonne: number) => CleMat): void {
  const anneaux = forme.tranches.map((t): Point3[] => {
    const g = Math.min(t.g ?? forme.g, t.w * 0.5);
    const epaule = Math.max(t.w - (t.b ?? forme.b), g);
    const xd = t.w - (t.entailleD ?? 0);
    const xg = t.w - (t.entailleG ?? 0);
    const milieu = t.e > 0 ? t.e - (t.p ?? forme.p) : 0;
    const dy = (x: number) => t.y + (t.w > 0 ? ((t.biais ?? 0) * x) / t.w : 0);
    return [
      [xd, dy(t.w), 0],
      [epaule, dy(epaule), t.e],
      [g, dy(g), t.e],
      [0, t.y, milieu],
      [-g, dy(-g), t.e],
      [-epaule, dy(-epaule), t.e],
      [-xg, dy(-t.w), 0],
      [-epaule, dy(-epaule), -t.e],
      [-g, dy(-g), -t.e],
      [0, t.y, -milieu],
      [g, dy(g), -t.e],
      [epaule, dy(epaule), -t.e],
    ];
  });
  p.tube(anneaux, (rang, colonne) => cle(rang, COLONNES_BISEAU.includes(colonne) ? 'biseau' : COLONNES_MILIEU.includes(colonne) ? 'milieu' : 'plat', colonne));
}

/** Poignée de l'épée : cuir qui s'élargit vers la garde, lanière plus sombre enroulée en spirale. */
function tracerPoignee(p: Pieces): void {
  const BAS = -0.08;
  const HAUT = 0.072;
  const point = (y: number, tour: number, saillie: number): Point3 => {
    const t = (y - BAS) / (HAUT - BAS);
    const angle = (tour * Math.PI) / 4;
    return [Math.cos(angle) * melanger(0.02, 0.0252, t) * saillie, y, Math.sin(angle) * melanger(0.018, 0.0228, t) * saillie];
  };
  const anneau = (y: number): Point3[] => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => point(y, k, 1));
  p.tube([anneau(BAS), anneau(-0.004), anneau(HAUT)], 'cuir');
  // Lanière : une bande à arête qui monte en tournant, quatre tours et demi
  const PAS = 36;
  const LARGEUR = 0.017;
  const bas: Point3[] = [];
  const crete: Point3[] = [];
  const haut: Point3[] = [];
  for (let s = 0; s <= PAS; s++) {
    const y = melanger(BAS + 0.005, HAUT - 0.006 - LARGEUR, s / PAS);
    bas.push(point(y, s, 1));
    crete.push(point(y + LARGEUR / 2, s, 1.11));
    haut.push(point(y + LARGEUR, s, 1));
  }
  p.ruban('cuirSombre', bas, crete);
  p.ruban('cuirSombre', crete, haut);
}

/** Pommeau en boule à pans : un octogone vu de face, comme sur l'image. */
function pommeauBoule(): THREE.BufferGeometry {
  const R = 0.035;
  const petit = R * 0.42;
  return fuseau([
    { y: POMMEAU_Y - R, rx: petit, rz: petit * 0.85 },
    { y: POMMEAU_Y - petit, rx: R, rz: R * 0.85, c: R * 0.45 },
    { y: POMMEAU_Y + petit, rx: R, rz: R * 0.85, c: R * 0.45 },
    { y: POMMEAU_Y + R, rx: petit, rz: petit * 0.85 },
  ]);
}

function tracerPommeau(p: Pieces, niveau: NiveauOutil): void {
  const P = POMMEAU_Y;
  if (niveau === 'base') {
    // Bois : gland taillé au couteau, cerclé d'une lanière
    p.geometrie(
      'boisTaille',
      fuseau([
        { y: P - 0.035, rx: 0.013, rz: 0.012 },
        { y: P - 0.022, rx: 0.029, rz: 0.025, c: 0.012 },
        { y: P + 0.004, rx: 0.035, rz: 0.03, c: 0.015 },
        { y: P + 0.021, rx: 0.029, rz: 0.025, c: 0.011 },
        { y: P + 0.035, rx: 0.018, rz: 0.016 },
      ]),
    );
    p.geometrie('cuirClair', bague(0.0215, 0.019, 0.005), pose(0, P + 0.032, 0, 0.12));
    return;
  }
  if (niveau === 'cuivre') {
    // Cuivre : pommeau en roue, épaulé, avec un bouton clair au centre de chaque face
    const roue = new THREE.CylinderGeometry(0.034, 0.034, 0.03, 8);
    roue.rotateY(Math.PI / 8).rotateX(Math.PI / 2);
    p.geometrie('ferSombre', roue, pose(0, P, 0));
    for (const face of [1, -1]) {
      const epaule = new THREE.CylinderGeometry(face > 0 ? 0.022 : 0.034, face > 0 ? 0.034 : 0.022, 0.007, 8);
      epaule.rotateY(Math.PI / 8).rotateX(Math.PI / 2);
      p.geometrie('fer', epaule, pose(0, P, face * 0.0185));
      p.geometrie('tranchant', galet(0.011, 0.011, 0.006), pose(0, P, face * 0.022));
    }
    p.geometrie('patine', bague(0.0225, 0.0195, 0.005), pose(0, P + 0.034, 0));
    return;
  }
  if (niveau === 'fer') {
    // Fer : boule à pans, virole au-dessus, bouton rivé en dessous
    p.geometrie('ferSombre', pommeauBoule());
    p.geometrie('ferPatine', bague(0.0225, 0.0195, 0.0055), pose(0, P + 0.032, 0));
    p.geometrie('tranchant', galet(0.01, 0.006, 0.009), pose(0, P - 0.036, 0));
    return;
  }
  if (niveau === 'acier') {
    // Acier : poire à pans, losange incrusté sur chaque face, pointe taillée
    p.geometrie(
      'acier',
      fuseau([
        { y: P - 0.037, rx: 0.011, rz: 0.01 },
        { y: P - 0.027, rx: 0.025, rz: 0.022, c: 0.011 },
        { y: P - 0.005, rx: 0.034, rz: 0.03, c: 0.015 },
        { y: P + 0.014, rx: 0.026, rz: 0.023, c: 0.011 },
        { y: P + 0.03, rx: 0.017, rz: 0.015 },
      ]),
    );
    p.geometrie('fer', bague(0.0225, 0.0195, 0.0055), pose(0, P + 0.032, 0));
    p.geometrie('ferSombre', eclat(0.012, 0.016, 0.03), pose(0, P - 0.006, 0));
    p.geometrie('tranchant', eclat(0.009, 0.011, 0.009), pose(0, P - 0.04, 0));
    return;
  }
  // Cristal : gemme taillée, sertie dans une coupelle d'argent sous une virole
  p.cristal([1.5, 1.5, 1.5], () => p.geometrie('cristal', pommeauBoule()));
  p.geometrie('fer', bague(0.022, 0.019, 0.006), pose(0, P + 0.031, 0));
  p.geometrie(
    'fer',
    fuseau([
      { y: P - 0.042, rx: 0.008, rz: 0.007 },
      { y: P - 0.036, rx: 0.02, rz: 0.017 },
      { y: P - 0.026, rx: 0.027, rz: 0.023 },
    ]),
  );
  p.geometrie('tranchant', eclat(0.007, 0.009, 0.007), pose(0, P - 0.045, 0));
}

/**
 * Garde : barre couchée dont le profil est donné pour un seul côté, du milieu vers le bout
 * ([distance, demi-hauteur, demi-épaisseur, montée]).
 */
function barreGarde(demiProfil: readonly TrancheCouchee[], coin: number): THREE.BufferGeometry {
  const gauche = [...demiProfil].reverse().map(([x, h, e, m]): TrancheCouchee => [-x, h, e, m]);
  return fuseauCouche([...gauche, ...demiProfil], coin);
}

function tracerGarde(p: Pieces, niveau: NiveauOutil): void {
  const ici = pose(0, GARDE_Y, 0);
  if (niveau === 'base') {
    // Bois : traverse plus sombre aux bouts taillés, chevillée et ligaturée à la lame
    p.geometrie(
      'bois',
      barreGarde(
        [
          [0, 0.021, 0.022, 0],
          [0.084, 0.021, 0.021, 0],
          [0.094, 0.017, 0.017, 0],
          [0.1, 0.01, 0.011, 0],
        ],
        0.4,
      ),
      ici,
    );
    for (const cote of [1, -1]) riveter(p, 'boisClair', cote * 0.066, GARDE_Y, 0.021, 1.25);
    croiserLanieres(p, 'cuirClair', GARDE_Y, 0.0225, 0.05, 0.75);
    return;
  }
  if (niveau === 'cuivre') {
    // Cuivre : barre trapue aux bouts relevés, écusson au milieu, collet vert-de-grisé
    p.geometrie(
      'fer',
      barreGarde(
        [
          [0, 0.0245, 0.026, 0],
          [0.022, 0.0245, 0.026, 0],
          [0.03, 0.019, 0.019, 0],
          [0.07, 0.019, 0.019, 0.002],
          [0.086, 0.023, 0.022, 0.007],
          [0.098, 0.013, 0.013, 0.012],
        ],
        0.45,
      ),
      ici,
    );
    riveter(p, 'tranchant', 0, GARDE_Y, 0.026, 1.5);
    p.boite('patine', 0.096, 0.012, 0.034, pose(0, GARDE_Y + 0.026, 0));
    return;
  }
  if (niveau === 'fer') {
    // Fer : longue barre aux bouts carrés et renflés, écusson riveté, losange sur le talon de la lame
    p.geometrie(
      'ferSombre',
      barreGarde(
        [
          [0, 0.025, 0.027, 0],
          [0.024, 0.025, 0.027, 0],
          [0.031, 0.019, 0.019, 0],
          [0.078, 0.019, 0.019, 0],
          [0.084, 0.0245, 0.024, 0],
          [0.104, 0.0245, 0.024, 0],
          [0.108, 0.019, 0.019, 0],
        ],
        0.25,
      ),
      ici,
    );
    for (const cote of [1, -1]) riveter(p, 'tranchant', cote * 0.012, GARDE_Y, 0.027, 1.1);
    p.boite('ferPatine', 0.094, 0.012, 0.031, pose(0, GARDE_Y + 0.027, 0));
    p.geometrie('ferSombre', eclat(0.017, 0.026, 0.0165), pose(0, GARDE_Y + 0.05, 0));
    return;
  }
  // Acier et cristal : garde ouvragée, une barre qui porte cinq losanges à facettes (les plus gros au milieu
  // et aux bouts), et un collet à la base de la lame
  const joyau: CleMat = niveau === 'cristal' ? 'cristalClair' : 'tranchant';
  p.geometrie(
    'fer',
    barreGarde(
      [
        [0, 0.017, 0.017, 0],
        [0.091, 0.017, 0.017, 0],
        [0.104, 0.0085, 0.0095, 0],
      ],
      0.4,
    ),
    ici,
  );
  p.geometrie(joyau, eclat(0.042, 0.04, 0.034), ici);
  for (const cote of [1, -1]) {
    p.geometrie(joyau, eclat(0.026, 0.029, 0.025), pose(cote * 0.062, GARDE_Y, 0));
    p.geometrie(joyau, eclat(0.032, 0.038, 0.027), pose(cote * 0.116, GARDE_Y, 0));
    riveter(p, 'ferSombre', cote * 0.089, GARDE_Y, 0.017, 0.9);
  }
  p.boite('ferSombre', 0.1, 0.01, 0.03, pose(0, GARDE_Y + 0.024, 0));
}

function creerEpee(mat: MateriauxOutils, niveau: NiveauOutil): THREE.Group {
  const p = new Pieces();
  tracerPoignee(p);
  tracerPommeau(p, niveau);
  tracerGarde(p, niveau);
  const forme = LAMES_EPEE[niveau];
  if (niveau === 'cristal') {
    // Facettes de deux bleus, en damier le long des biseaux
    p.cristal([1.8, 1.03, 2.8], () =>
      tracerLame(p, forme, (rang, partie, colonne) => (partie === 'biseau' && (rang + (colonne > 5 ? 1 : 0)) % 2 === 0 ? 'cristalClair' : 'cristal')),
    );
  } else if (niveau === 'base') {
    tracerLame(p, forme, (_rang, partie) => (partie === 'biseau' ? 'boisClair' : 'boisTaille'));
    // Nœuds du bois, à plat sur la lame
    p.geometrie('boisSombre', galet(0.007, 0.011, 0.003), pose(0.017, 0.3, 0.0148));
    p.geometrie('boisSombre', galet(0.006, 0.009, 0.003), pose(-0.019, 0.49, 0.0148));
    p.geometrie('boisSombre', galet(0.007, 0.01, 0.003), pose(-0.016, 0.24, -0.0148));
  } else {
    // Métal : plats de la couleur du palier, biseaux clairs (le fil affûté), gorge plus sombre
    const plat: CleMat = niveau === 'fer' ? 'fer' : 'acier';
    const gorge: CleMat = niveau === 'fer' ? 'ferSombre' : 'fer';
    // Rang où la gorge s'arrête : au-delà, le milieu de la lame est de la couleur des plats
    const finGorge = forme.tranches.findIndex((t) => (t.p ?? forme.p) <= 0 && t.w > 0) - 1;
    tracerLame(p, forme, (rang, partie) => (partie === 'biseau' ? 'tranchant' : partie === 'milieu' && rang <= finGorge ? gorge : plat));
  }
  return p.assembler(mat);
}

// --- Manche et tête de la hache et de la pioche ---

// Manche commun à la hache et à la pioche, comme sur les images : bois nu à huit pans un peu irréguliers,
// plus fin au milieu, talon évasé aux arêtes cassées, bout qui dépasse de la tête. La main droite le tient
// à y = 0, la gauche plus bas.
const MANCHE_BAS = -0.345;
const MANCHE_HAUT = 0.445;

function tracerManche(p: Pieces, niveau: NiveauOutil): void {
  p.geometrie(
    'bois',
    fuseau([
      { y: MANCHE_BAS, rx: 0.02, rz: 0.016 },
      { y: MANCHE_BAS + 0.022, rx: 0.032, rz: 0.026 },
      { y: MANCHE_BAS + 0.075, rx: 0.03, rz: 0.0245, c: 0.0075 },
      { y: -0.22, rx: 0.0262, rz: 0.0214, c: 0.0085, dz: 0.0008 },
      { y: -0.17, rx: 0.0245, rz: 0.02 },
      { y: -0.1, rx: 0.0238, rz: 0.0193, c: 0.0056, dx: -0.0008 },
      { y: -0.02, rx: 0.0232, rz: 0.0188, c: 0.0072, dz: -0.0006 },
      { y: 0.06, rx: 0.023, rz: 0.0185, dx: 0.0015 },
      { y: 0.14, rx: 0.0237, rz: 0.019, c: 0.0054, dx: 0.0006, dz: 0.0008 },
      { y: 0.21, rx: 0.0244, rz: 0.0196, c: 0.0076, dx: -0.0008 },
      { y: 0.28, rx: 0.025, rz: 0.02 },
      { y: MANCHE_HAUT - 0.012, rx: 0.027, rz: 0.022 },
      { y: MANCHE_HAUT - 0.003, rx: 0.0245, rz: 0.02 },
    ]),
  );
  // Bois de bout, plus clair, au sommet du manche
  p.geometrie(
    'boisClair',
    fuseau([
      { y: MANCHE_HAUT - 0.004, rx: 0.0238, rz: 0.0194 },
      { y: MANCHE_HAUT + 0.001, rx: 0.02, rz: 0.016 },
    ]),
  );
  // Nœuds du bois, à plat sur le manche (hors des mains)
  p.geometrie('boisSombre', galet(0.007, 0.011, 0.003), pose(0.005, 0.165, 0.0188));
  p.geometrie('boisSombre', galet(0.006, 0.009, 0.003), pose(-0.006, -0.112, -0.0188));
  p.geometrie('boisSombre', galet(0.003, 0.01, 0.007), pose(0.0235, 0.098, 0.002));
  if (niveau === 'base') {
    // Cheville de bois qui bloque la tête
    p.boite('boisSombre', 0.011, 0.005, 0.011, pose(0, MANCHE_HAUT + 0.002, 0, 0, 0, 0.5));
    return;
  }
  // Coin de métal enfoncé dans le bois de bout : il serre le manche dans l'œil de la tête
  p.boite('ferPatine', 0.03, 0.005, 0.006, pose(0, MANCHE_HAUT + 0.001, 0, 0, 0, 0.45));
  if (niveau === 'cuivre') return;
  // Frette au talon du manche (sous la main gauche), puis embout pour les deux derniers paliers
  p.geometrie('ferPatine', bague(0.0325, 0.0268, 0.007), pose(0, MANCHE_BAS + 0.05, 0));
  if (niveau === 'fer') return;
  p.geometrie(
    'fer',
    fuseau([
      { y: MANCHE_BAS - 0.003, rx: 0.014, rz: 0.012 },
      { y: MANCHE_BAS + 0.004, rx: 0.026, rz: 0.021 },
      { y: MANCHE_BAS + 0.016, rx: 0.031, rz: 0.0255 },
      { y: MANCHE_BAS + 0.024, rx: 0.0335, rz: 0.0275 },
    ]),
  );
  if (niveau === 'cristal') p.cristal([1.6, 1.6, 1.6], () => p.geometrie('cristalClair', eclat(0.01, 0.012, 0.01), pose(0, MANCHE_BAS - 0.004, 0)));
}

/** Bloc de la tête, serré sur le manche : une boîte aux arêtes cassées. */
function blocTete(y: number, demiHauteur: number, rx: number, rz: number): THREE.BufferGeometry {
  const c = 0.011;
  return fuseau([
    { y: y - demiHauteur, rx: rx - 0.008, rz: rz - 0.008, c },
    { y: y - demiHauteur + 0.011, rx, rz, c },
    { y: y + demiHauteur - 0.011, rx, rz, c },
    { y: y + demiHauteur, rx: rx - 0.008, rz: rz - 0.008, c },
  ]);
}

interface TailleBloc {
  demiHauteur: number;
  rx: number;
  rz: number;
}

/**
 * Bloc de la tête (l'œil, où passe le manche) et tout ce qui le tient : ligature de cuir pour le bois ;
 * lèvres, rivets, frette ou attelles rivetées le long du manche pour le métal ; viroles d'argent pour le cristal.
 */
function tracerBloc(p: Pieces, niveau: NiveauOutil, y: number, taille: TailleBloc): void {
  const { demiHauteur: dh, rx, rz } = taille;
  const dessous = y - dh;
  if (niveau === 'base') {
    p.geometrie('boisSombre', blocTete(y, dh, rx, rz));
    // Lanières croisées sur le bloc, deux tours sous la tête et leur nœud
    croiserLanieres(p, 'cuirClair', y, rz + 0.001, dh * 2.05, Math.atan2(rx * 0.8, dh));
    p.geometrie('cuirClair', bague(0.03, 0.025, 0.009), pose(0, dessous - 0.012, 0, 0.16));
    p.geometrie('cuirClair', bague(0.03, 0.025, 0.009), pose(0, dessous - 0.038, 0, -0.14));
    p.geometrie('cuirClair', galet(0.012, 0.014, 0.01), pose(-0.012, dessous - 0.025, 0.026));
    p.boite('cuirClair', 0.008, 0.03, 0.004, pose(-0.02, dessous - 0.058, 0.024, 0.3));
    return;
  }
  if (niveau === 'cristal') {
    p.cristal([1.25, 1.2, 1.5], () => p.geometrie('cristal', blocTete(y, dh, rx, rz)));
  } else {
    p.geometrie('ferSombre', blocTete(y, dh, rx, rz));
  }
  // Lèvres en haut et en bas de l'œil
  const levre: CleMat = niveau === 'cristal' ? 'fer' : 'ferPatine';
  for (const cote of [1, -1]) p.geometrie(levre, bague(rx - 0.003, rz - 0.003, 0.0065), pose(0, y + cote * (dh - 0.001), 0));
  if (niveau === 'cuivre') {
    // Cuivre : un gros rivet par face, frette sous la tête, cordon vert-de-grisé
    riveter(p, 'tranchant', -0.004, y, rz, 2.1);
    p.geometrie('fer', bague(0.031, 0.026, 0.011), pose(0, dessous - 0.02, 0));
    p.geometrie('patine', bague(0.0285, 0.0235, 0.004), pose(0, dessous - 0.035, 0));
    return;
  }
  // Rivets du bloc
  for (const cote of [1, -1]) riveter(p, niveau === 'cristal' ? 'fer' : 'tranchant', -0.006, y + cote * dh * 0.45, rz, 1.5);
  // Attelles : deux languettes de métal le long du manche, rivetées
  const attelle: CleMat = niveau === 'fer' ? 'ferPatine' : 'fer';
  const longueur = niveau === 'fer' ? 0.07 : 0.095;
  for (const face of [1, -1]) {
    p.boite(attelle, 0.021, longueur, 0.005, pose(0, dessous - longueur / 2 + 0.006, face * 0.0212));
    p.geometrie(attelle, eclat(0.0105, 0.016, 0.0025), pose(0, dessous - longueur + 0.006, face * 0.0212));
  }
  riveter(p, 'tranchant', 0, dessous - longueur * 0.3, 0.0237, 1);
  riveter(p, 'tranchant', 0, dessous - longueur * 0.78, 0.0237, 1);
}

// --- Hache ---

// Fer de la hache, vu de face, en rangs qui vont de l'œil au tranchant : chaque rang relie un point du dos
// (`haut`) à un point du dessous (`bas`), [distance au manche, hauteur par rapport au milieu de la tête] ;
// `e` est sa demi-épaisseur et `bombe` l'avancée de son milieu (tranchant arrondi). Le dernier rang est le fil.
interface RangHache {
  haut: readonly [number, number];
  bas: readonly [number, number];
  e: number;
  bombe?: number;
}

interface FormeHache {
  rangs: readonly RangHache[];
  /** Nombre de points par rang, du dos au dessous */
  colonnes: number;
  /** Irrégularité des facettes (métal martelé, cristal taillé) */
  martele: number;
  /** Profondeur des éclats le long du fil (bois) */
  dents?: number;
  bloc: TailleBloc;
}

const FORMES_HACHE: Readonly<Record<NiveauOutil, FormeHache>> = {
  // Bois : coin court et épais, au fil ébréché
  base: {
    rangs: [
      { haut: [0.03, 0.05], bas: [0.03, -0.05], e: 0.025 },
      { haut: [0.1, 0.06], bas: [0.1, -0.07], e: 0.021 },
      { haut: [0.155, 0.07], bas: [0.16, -0.094], e: 0.016, bombe: 0.004 },
      { haut: [0.186, 0.058], bas: [0.19, -0.08], e: 0.009, bombe: 0.012 },
      { haut: [0.2, 0.046], bas: [0.202, -0.066], e: 0, bombe: 0.017 },
    ],
    colonnes: 7,
    martele: 0.004,
    dents: 0.011,
    bloc: { demiHauteur: 0.058, rx: 0.046, rz: 0.037 },
  },
  // Cuivre : fer trapu, qui s'évase tout droit depuis le bloc, martelé
  cuivre: {
    rangs: [
      { haut: [0.035, 0.055], bas: [0.035, -0.055], e: 0.025 },
      { haut: [0.09, 0.058], bas: [0.09, -0.068], e: 0.017 },
      { haut: [0.15, 0.074], bas: [0.15, -0.102], e: 0.0115 },
      { haut: [0.196, 0.09], bas: [0.196, -0.138], e: 0.007, bombe: 0.014 },
      { haut: [0.213, 0.084], bas: [0.21, -0.132], e: 0, bombe: 0.036 },
    ],
    colonnes: 7,
    martele: 0.006,
    bloc: { demiHauteur: 0.062, rx: 0.049, rz: 0.04 },
  },
  // Fer : grand fer lourd, à longue barbe
  fer: {
    rangs: [
      { haut: [0.035, 0.06], bas: [0.035, -0.06], e: 0.027 },
      { haut: [0.1, 0.064], bas: [0.1, -0.085], e: 0.019 },
      { haut: [0.16, 0.082], bas: [0.152, -0.137], e: 0.012 },
      { haut: [0.208, 0.1], bas: [0.198, -0.184], e: 0.0075, bombe: 0.015 },
      { haut: [0.226, 0.093], bas: [0.211, -0.192], e: 0, bombe: 0.04 },
    ],
    colonnes: 8,
    martele: 0.005,
    bloc: { demiHauteur: 0.068, rx: 0.052, rz: 0.043 },
  },
  // Acier : corne pointue en haut, barbe longue et effilée, dos et dessous creusés, facettes nettes
  acier: {
    rangs: [
      { haut: [0.035, 0.05], bas: [0.035, -0.05], e: 0.025 },
      { haut: [0.105, 0.05], bas: [0.1, -0.06], e: 0.016 },
      { haut: [0.17, 0.08], bas: [0.152, -0.108], e: 0.0095, bombe: 0.004 },
      { haut: [0.196, 0.108], bas: [0.175, -0.15], e: 0.007, bombe: 0.016 },
      { haut: [0.214, 0.13], bas: [0.192, -0.18], e: 0.0045, bombe: 0.026 },
      { haut: [0.228, 0.15], bas: [0.205, -0.205], e: 0, bombe: 0.05 },
    ],
    colonnes: 8,
    martele: 0,
    bloc: { demiHauteur: 0.062, rx: 0.049, rz: 0.04 },
  },
  // Cristal : bloc de cristal épais, taillé à grandes facettes
  cristal: {
    rangs: [
      { haut: [0.035, 0.056], bas: [0.035, -0.056], e: 0.034 },
      { haut: [0.1, 0.07], bas: [0.1, -0.08], e: 0.03 },
      { haut: [0.18, 0.1], bas: [0.185, -0.165], e: 0.017, bombe: 0.01 },
      { haut: [0.2, 0.098], bas: [0.2, -0.168], e: 0, bombe: 0.05 },
    ],
    colonnes: 6,
    martele: 0.012,
    bloc: { demiHauteur: 0.064, rx: 0.05, rz: 0.041 },
  },
};

/** Trace le fer de la hache à la hauteur `Y` ; `cle` reçoit le rang (le dernier est le biseau du tranchant) et la colonne. */
function tracerFerHache(p: Pieces, forme: FormeHache, Y: number, cle: (rang: number, colonne: number) => CleMat): void {
  const M = forme.colonnes;
  const dernier = forme.rangs.length - 1;
  const anneaux = forme.rangs.map((r, v): Point3[] => {
    const avant: Point3[] = [];
    const arriere: Point3[] = [];
    for (let u = 0; u < M; u++) {
      const t = u / (M - 1);
      const bord = u === 0 || u === M - 1;
      const libre = v > 0 && !bord;
      const graine = v * 17 + u * 5;
      let x = melanger(r.haut[0], r.bas[0], t) + (r.bombe ?? 0) * Math.sin(Math.PI * t);
      let y = Y + melanger(r.haut[1], r.bas[1], t);
      if (libre && v < dernier) {
        x += forme.martele * (alea(graine) - 0.5);
        y += forme.martele * (alea(graine + 1) - 0.5);
      }
      if (libre && v === dernier && forme.dents) x -= forme.dents * alea(graine + 2) ** 2;
      // Dos et dessous un peu plus minces que les joues
      const e = r.e * (bord ? 0.6 : 1);
      const relief = libre && v < dernier ? forme.martele * 0.5 : 0;
      avant.push([x, y, Math.max(0, e + relief * (alea(graine + 3) - 0.5))]);
      arriere.push([x, y, -Math.max(0, e + relief * (alea(graine + 4) - 0.5))]);
    }
    // Sens du tube : face avant de bas en haut, puis face arrière de haut en bas
    return [...avant.reverse(), ...arriere];
  });
  p.tube(anneaux, cle, false);
}

function creerHache(mat: MateriauxOutils, niveau: NiveauOutil): THREE.Group {
  const p = new Pieces();
  // Hauteur du milieu de la tête
  const Y = 0.352;
  const forme = FORMES_HACHE[niveau];
  const biseau = forme.rangs.length - 2;
  tracerManche(p, niveau);
  tracerBloc(p, niveau, Y, forme.bloc);
  if (niveau === 'cristal') {
    // Cristal : le bloc et le fer sont taillés dans le même cristal, facettes de deux bleus
    p.cristal([1.22, 1.22, 2.4], () => tracerFerHache(p, forme, Y, (rang, colonne) => (alea(rang * 7 + colonne * 13) < 0.38 ? 'cristalClair' : 'cristal')));
  } else if (niveau === 'base') {
    tracerFerHache(p, forme, Y, (rang) => (rang >= biseau ? 'boisClair' : 'boisTaille'));
  } else {
    const joue: CleMat = niveau === 'acier' ? 'acier' : 'fer';
    // Acier : un filet plus sombre souligne le biseau
    tracerFerHache(p, forme, Y, (rang) => (rang >= biseau ? 'tranchant' : niveau === 'acier' && rang === biseau - 1 ? 'fer' : joue));
    if (niveau === 'fer') {
      // Talon : une masse carrée au dos de l'œil
      const { demiHauteur, rx, rz } = forme.bloc;
      p.geometrie(
        'fer',
        fuseauCouche(
          [
            [-rx - 0.02, demiHauteur * 0.62, rz * 0.74, 0],
            [-rx - 0.014, demiHauteur * 0.72, rz * 0.86, 0],
            [-rx + 0.01, demiHauteur * 0.72, rz * 0.86, 0],
          ],
          0.3,
        ),
        pose(0, Y, 0),
      );
    }
    if (niveau === 'acier') {
      // Losange ciselé sur chaque joue du bloc
      for (const face of [1, -1]) p.geometrie('tranchant', eclat(0.013, 0.022, 0.004), pose(0.022, Y, face * forme.bloc.rz));
    }
  }
  return p.assembler(mat);
}

// --- Pioche ---

// Profil d'un bras de la pioche, du bloc à la pointe : distance au manche, demi-hauteur, demi-épaisseur,
// chute. `coin` : largeur des pans coupés (petit : section presque carrée).
interface FormePioche {
  profil: readonly TrancheCouchee[];
  coin: number;
  bloc: TailleBloc;
}

const FORMES_PIOCHE: Readonly<Record<NiveauOutil, FormePioche>> = {
  // Bois : bras courts et épais, à peine courbés, pointes durcies au feu
  base: {
    profil: [
      [0.04, 0.032, 0.026, 0],
      [0.09, 0.031, 0.025, 0.003],
      [0.13, 0.028, 0.022, 0.01],
      [0.17, 0.024, 0.018, 0.022],
      [0.2, 0.018, 0.014, 0.038],
      [0.225, 0.012, 0.0095, 0.054],
      [0.245, 0.004, 0.004, 0.07],
    ],
    coin: 0.5,
    bloc: { demiHauteur: 0.048, rx: 0.046, rz: 0.039 },
  },
  // Cuivre : bras trapus, peu courbés
  cuivre: {
    profil: [
      [0.04, 0.034, 0.026, 0],
      [0.09, 0.033, 0.025, 0.004],
      [0.13, 0.03, 0.022, 0.012],
      [0.18, 0.025, 0.0185, 0.03],
      [0.22, 0.02, 0.015, 0.05],
      [0.255, 0.012, 0.009, 0.076],
      [0.285, 0.003, 0.003, 0.105],
    ],
    coin: 0.5,
    bloc: { demiHauteur: 0.052, rx: 0.05, rz: 0.042 },
  },
  // Fer : barre épaisse, à section presque carrée
  fer: {
    profil: [
      [0.04, 0.038, 0.03, 0],
      [0.09, 0.036, 0.028, 0.004],
      [0.14, 0.033, 0.025, 0.012],
      [0.19, 0.028, 0.021, 0.032],
      [0.235, 0.022, 0.017, 0.055],
      [0.275, 0.013, 0.01, 0.086],
      [0.305, 0.003, 0.003, 0.118],
    ],
    coin: 0.28,
    bloc: { demiHauteur: 0.056, rx: 0.053, rz: 0.045 },
  },
  // Acier : bras longs, fins et très courbés, pointes en aiguille
  acier: {
    profil: [
      [0.04, 0.032, 0.024, 0],
      [0.09, 0.031, 0.022, 0.004],
      [0.14, 0.028, 0.019, 0.012],
      [0.2, 0.023, 0.015, 0.034],
      [0.25, 0.017, 0.012, 0.062],
      [0.3, 0.0095, 0.007, 0.104],
      [0.34, 0.002, 0.002, 0.155],
    ],
    coin: 0.6,
    bloc: { demiHauteur: 0.052, rx: 0.05, rz: 0.042 },
  },
  // Cristal : deux crocs de cristal renflés, très courbés
  cristal: {
    profil: [
      [0.04, 0.036, 0.03, 0],
      [0.085, 0.038, 0.029, 0.002],
      [0.13, 0.037, 0.027, 0.008],
      [0.185, 0.031, 0.022, 0.03],
      [0.23, 0.025, 0.018, 0.058],
      [0.28, 0.014, 0.01, 0.106],
      [0.315, 0.002, 0.002, 0.16],
    ],
    coin: 0.85,
    bloc: { demiHauteur: 0.052, rx: 0.05, rz: 0.043 },
  },
};

/** Tranche d'un bras de pioche à la distance `t` du manche (entre deux tranches du profil). */
function tranchePioche(profil: readonly TrancheCouchee[], t: number): TrancheCouchee {
  let k = 0;
  while (k + 2 < profil.length && profil[k + 1][0] < t) k++;
  const a = profil[k];
  const b = profil[k + 1];
  const f = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
  return [t, melanger(a[1], b[1], f), melanger(a[2], b[2], f), melanger(a[3], b[3], f)];
}

/** Anneau à huit pans d'une barre couchée le long de x (pour `Pieces.tube`, anneaux rangés de gauche à droite). */
function anneauCouche(x: number, y: number, h: number, e: number, coin: number): Point3[] {
  const c = Math.min(h, e) * coin;
  return [
    [x, y - (h - c), e],
    [x, y + (h - c), e],
    [x, y + h, e - c],
    [x, y + h, -(e - c)],
    [x, y + (h - c), -e],
    [x, y - (h - c), -e],
    [x, y - h, -(e - c)],
    [x, y - h, e - c],
  ];
}

/**
 * Trace la barre de la pioche (les deux bras d'un seul tenant, qui traversent le bloc et se courbent vers le
 * bas) à la hauteur `Y`. `cle` reçoit le numéro du tronçon compté depuis la pointe (0 : la pointe) et la colonne.
 */
function tracerBarrePioche(p: Pieces, forme: FormePioche, Y: number, cle: (depuisPointe: number, colonne: number) => CleMat): void {
  const { profil, coin } = forme;
  const droite = profil.map(([t, h, e, chute]) => anneauCouche(t, Y - chute, h, e, coin));
  const gauche = [...profil].reverse().map(([t, h, e, chute]) => anneauCouche(-t, Y - chute, h, e, coin));
  const anneaux = [...gauche, ...droite];
  const dernier = anneaux.length - 2;
  p.tube(anneaux, (rang, colonne) => cle(Math.min(rang, dernier - rang), colonne));
}

/** Frette autour de chaque bras, contre le bloc. */
function tracerFrettesPioche(p: Pieces, forme: FormePioche, Y: number, cle: CleMat): void {
  const debut = forme.bloc.rx + 0.004;
  for (const cote of [1, -1]) {
    const anneaux = [
      [0, 0.002],
      [0.004, 0.006],
      [0.016, 0.006],
      [0.02, 0.002],
    ].map(([avance, surepaisseur]) => {
      const [t, h, e, chute] = tranchePioche(forme.profil, debut + avance);
      return anneauCouche(cote * t, Y - chute, h + surepaisseur, e + surepaisseur, forme.coin);
    });
    p.tube(cote > 0 ? anneaux : anneaux.reverse(), cle);
  }
}

function creerPioche(mat: MateriauxOutils, niveau: NiveauOutil): THREE.Group {
  const p = new Pieces();
  // Hauteur du milieu du bloc ; les bras en sortent un peu au-dessus
  const Y = 0.371;
  const forme = FORMES_PIOCHE[niveau];
  tracerManche(p, niveau);
  tracerBloc(p, niveau, Y, forme.bloc);
  if (niveau === 'cristal') {
    p.cristal([1.06, 1.35, 2.4], () => tracerBarrePioche(p, forme, Y + 0.008, (rang, colonne) => (alea(rang * 7 + colonne * 13) < 0.38 ? 'cristalClair' : 'cristal')));
    tracerFrettesPioche(p, forme, Y + 0.008, 'fer');
  } else if (niveau === 'base') {
    // Pointes noircies, durcies au feu
    tracerBarrePioche(p, forme, Y + 0.008, (rang) => (rang < 2 ? 'tissuBrule' : 'boisTaille'));
  } else {
    const bras: CleMat = niveau === 'acier' ? 'acier' : 'fer';
    // Pointes affûtées, plus claires
    tracerBarrePioche(p, forme, Y + 0.008, (rang) => (rang < 2 ? 'tranchant' : bras));
    tracerFrettesPioche(p, forme, Y + 0.008, niveau === 'cuivre' ? 'patine' : 'ferPatine');
  }
  return p.assembler(mat);
}

/** Feuille pointue, pliée le long de sa nervure : l'origine est à sa base, elle s'allonge vers +x. */
function creerFeuille(longueur: number, largeur: number, materiau: THREE.Material): THREE.Mesh {
  const l = longueur;
  const d = largeur / 2;
  // Deux moitiés relevées de part et d'autre de la nervure (en creux), bout qui retombe un peu
  const pli = d * 0.45;
  const positions = [
    0, 0, 0, l * 0.42, pli, d, l * 0.5, -0.004, 0,
    l * 0.42, pli, d, l, -l * 0.12, 0, l * 0.5, -0.004, 0,
    0, 0, 0, l * 0.5, -0.004, 0, l * 0.42, pli, -d,
    l * 0.42, pli, -d, l * 0.5, -0.004, 0, l, -l * 0.12, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.computeVertexNormals();
  return maille(g, materiau);
}

/**
 * Pousse d'arbre à planter : le poing serre le collet (à l'origine), la motte de terre et ses
 * racines pendent sous la main, la jeune tige monte le long de +y avec trois feuilles et un bourgeon.
 */
function creerPousse(mat: MateriauxOutils): THREE.Group {
  const pousse = new THREE.Group();
  // Motte : terre tassée à pans, plus large au milieu, avec des mottes claires et deux racines
  pousse.add(
    maille(
      fuseau([
        { y: -0.215, rx: 0.03, rz: 0.028, dx: 0.006 },
        { y: -0.18, rx: 0.062, rz: 0.058, c: 0.024, dx: 0.004 },
        { y: -0.115, rx: 0.074, rz: 0.07, c: 0.028 },
        { y: -0.078, rx: 0.062, rz: 0.06, c: 0.024 },
        { y: -0.058, rx: 0.036, rz: 0.034 },
      ]),
      mat.terre,
    ),
  );
  pousse.add(maille(galet(0.03, 0.024, 0.028), mat.terreClaire, 0.05, -0.1, 0.044));
  pousse.add(maille(galet(0.026, 0.02, 0.026), mat.terreClaire, -0.052, -0.15, 0.03));
  pousse.add(maille(galet(0.024, 0.02, 0.024), mat.terreClaire, -0.02, -0.105, -0.062));
  for (const [x, z, angle] of [[0.03, 0.02, -0.5], [-0.035, -0.01, 0.6]] as const) {
    const racine = maille(
      fuseau([
        { y: -0.075, rx: 0.003, rz: 0.003 },
        { y: 0, rx: 0.008, rz: 0.008 },
      ]),
      mat.terreClaire,
      x,
      -0.205,
      z,
    );
    racine.rotation.z = angle;
    pousse.add(racine);
  }
  // Tige : part de la motte, traverse le poing, puis monte en se courbant un peu
  pousse.add(
    maille(
      fuseau([
        { y: -0.07, rx: 0.016, rz: 0.016 },
        { y: 0.06, rx: 0.0125, rz: 0.0125 },
        { y: 0.15, rx: 0.011, rz: 0.011, dx: 0.008 },
        { y: 0.235, rx: 0.009, rz: 0.009, dx: 0.004, dz: 0.006 },
        { y: 0.3, rx: 0.0065, rz: 0.0065, dx: -0.008, dz: 0.004 },
      ]),
      mat.tige,
    ),
  );
  // Trois feuilles en spirale autour de la tige : hauteur, direction, relevé, longueur, largeur, teinte
  const feuilles: ReadonlyArray<readonly [number, number, number, number, number, boolean]> = [
    [0.13, 0.4, 0.5, 0.17, 0.095, true],
    [0.2, 2.7, 0.62, 0.19, 0.105, false],
    [0.262, -1.5, 0.8, 0.15, 0.085, true],
  ];
  for (const [y, tour, releve, longueur, largeur, sombre] of feuilles) {
    const feuille = creerFeuille(longueur, largeur, sombre ? mat.feuilleSombre : mat.feuille);
    feuille.position.set(0.004, y, 0.004);
    feuille.rotation.set(0, tour, releve, 'YZX');
    pousse.add(feuille);
  }
  // Bourgeon au sommet : deux petites feuilles presque dressées
  for (const [tour, sombre] of [[0.9, false], [-2.2, true]] as const) {
    const bourgeon = creerFeuille(0.075, 0.042, sombre ? mat.feuilleSombre : mat.feuille);
    bourgeon.position.set(-0.008, 0.296, 0.004);
    bourgeon.rotation.set(0, tour, 1.15, 'YZX');
    pousse.add(bourgeon);
  }
  return pousse;
}

/** Piège à poser, tenu à la main : un petit collet (deux piquets, une branche cintrée, un nœud de corde) sur une motte de terre. */
function creerPiegeEnMain(mat: MateriauxOutils): THREE.Group {
  const piege = new THREE.Group();
  piege.add(maille(galet(0.075, 0.018, 0.065, 1), mat.terre, 0, -0.1, 0));
  for (const x of [-0.055, 0.055]) {
    const piquet = maille(new THREE.CylinderGeometry(0.006, 0.009, 0.1, 5), mat.bois, x, -0.055, 0);
    piquet.rotation.z = x < 0 ? 0.12 : -0.12;
    piege.add(piquet);
  }
  const arc = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.058, -0.01, 0),
    new THREE.Vector3(-0.03, 0.03, 0),
    new THREE.Vector3(0.01, 0.034, 0),
    new THREE.Vector3(0.05, -0.005, 0),
  ]);
  piege.add(maille(new THREE.TubeGeometry(arc, 6, 0.005, 4), mat.boisSombre));
  const noeud = maille(new THREE.TorusGeometry(0.035, 0.004, 4, 8), mat.terreClaire, 0, -0.085, 0.004);
  noeud.rotation.x = Math.PI / 2;
  piege.add(noeud);
  return piege;
}

// Flammes de la torche : couleurs pleines, qui ne dépendent pas de la lumière de la scène (elles brillent la nuit)
const MAT_FLAMMES_TORCHE = [0xff5a1e, 0xff8a1e, 0xffc93c, 0xfff0a8].map((c) => new THREE.MeshBasicMaterial({ color: c }));
const GEOMETRIE_FLAMME_TORCHE = new THREE.ConeGeometry(0.055, 0.17, 5, 1).translate(0, 0.085, 0);

/**
 * Torche : le poing serre le manche à l'origine, la tête enroulée de toile est en haut (+y) et les
 * flammes montent au-dessus. Les flammes sont dans `userData.flammes` (groupe animé par animerTorche).
 */
function creerTorche(mat: MateriauxOutils): THREE.Group {
  const torche = new THREE.Group();
  // Manche : branche écorcée, un peu tordue, plus épaisse sous la tête
  torche.add(
    maille(
      fuseau([
        { y: -0.2, rx: 0.017, rz: 0.016 },
        { y: -0.1, rx: 0.02, rz: 0.018, dx: 0.002 },
        { y: 0.04, rx: 0.019, rz: 0.018, dx: -0.002 },
        { y: 0.13, rx: 0.021, rz: 0.019, dx: 0.001 },
        { y: 0.2, rx: 0.025, rz: 0.023 },
      ]),
      mat.bois,
    ),
  );
  // Talon en bois sombre, taillé en pointe émoussée
  torche.add(
    maille(
      fuseau([
        { y: -0.235, rx: 0.011, rz: 0.01 },
        { y: -0.218, rx: 0.021, rz: 0.019 },
        { y: -0.196, rx: 0.019, rz: 0.017 },
      ]),
      mat.boisSombre,
    ),
  );
  // Poignée : lanière de cuir enroulée là où la main serre, arrêtée par deux liens sombres
  const spires: Anneau[] = [];
  for (let k = 0; k <= 8; k++) {
    const r = k % 2 ? 0.0245 : 0.0215;
    spires.push({ y: -0.075 + k * 0.019, rx: r, rz: r * 0.92 });
  }
  torche.add(maille(fuseau(spires), mat.cuir));
  for (const y of [-0.08, 0.082]) {
    torche.add(
      maille(
        fuseau([
          { y: y - 0.007, rx: 0.0235, rz: 0.0215 },
          { y: y - 0.003, rx: 0.0265, rz: 0.0245 },
          { y: y + 0.003, rx: 0.0265, rz: 0.0245 },
          { y: y + 0.007, rx: 0.0235, rz: 0.0215 },
        ]),
        mat.cuirSombre,
      ),
    );
  }
  // Coupelle de fer patiné sous la tête : elle retient la toile et les gouttes de poix
  torche.add(
    maille(
      fuseau([
        { y: 0.188, rx: 0.026, rz: 0.025 },
        { y: 0.2, rx: 0.036, rz: 0.035 },
        { y: 0.222, rx: 0.047, rz: 0.046, c: 0.016 },
        { y: 0.23, rx: 0.044, rz: 0.043, c: 0.015 },
      ]),
      mat.ferPatine,
    ),
  );
  for (const face of [1, -1]) torche.add(rivet(mat.acier, 0, 0.208, face * 0.039, 0.9));
  // Tête : bandes de toile huilée enroulées en spires
  const bandes: Anneau[] = [];
  for (let k = 0; k <= 6; k++) {
    const r = (k % 2 ? 0.047 : 0.041) * (1 - k * 0.012);
    bandes.push({ y: 0.226 + k * 0.016, rx: r, rz: r * 0.96, c: r * 0.4, dx: k % 2 ? 0.0015 : -0.0015 });
  }
  torche.add(maille(fuseau(bandes), mat.tissu));
  // Deux tours de bande posés de travers, plus sombres, et le bout de toile qui dépasse
  for (const [y, penche] of [[0.262, 0.2], [0.296, -0.17]] as const) {
    const tour = maille(
      fuseau([
        { y: -0.008, rx: 0.045, rz: 0.043, c: 0.017 },
        { y: -0.003, rx: 0.049, rz: 0.047, c: 0.019 },
        { y: 0.003, rx: 0.049, rz: 0.047, c: 0.019 },
        { y: 0.008, rx: 0.045, rz: 0.043, c: 0.017 },
      ]),
      mat.tissuSombre,
      0,
      y,
      0,
    );
    tour.rotation.z = penche;
    torche.add(tour);
  }
  const bout = boite(0.02, 0.05, 0.006, mat.tissuSombre, 0.047, 0.232, 0.022);
  bout.rotation.z = -0.3;
  torche.add(bout);
  // Cordage clair qui serre la toile sur la coupelle, et son nœud
  torche.add(
    maille(
      fuseau([
        { y: 0.231, rx: 0.045, rz: 0.043, c: 0.017 },
        { y: 0.236, rx: 0.05, rz: 0.048, c: 0.019 },
        { y: 0.241, rx: 0.045, rz: 0.043, c: 0.017 },
      ]),
      mat.cuirClair,
    ),
  );
  torche.add(maille(galet(0.011, 0.012, 0.009), mat.cuirClair, -0.018, 0.236, 0.047));
  // Sommet calciné, bombé
  torche.add(
    maille(
      fuseau([
        { y: 0.32, rx: 0.042, rz: 0.04, c: 0.016 },
        { y: 0.338, rx: 0.037, rz: 0.035, c: 0.014 },
        { y: 0.352, rx: 0.024, rz: 0.023 },
      ]),
      mat.tissuBrule,
    ),
  );
  // Braise et langues de feu : rouge large, orange, cœur jaune, et une petite langue claire sur le côté
  const flammes = new THREE.Group();
  flammes.name = 'flammes-torche';
  flammes.position.y = 0.34;
  const braise = new THREE.Mesh(galet(0.03, 0.016, 0.029), MAT_FLAMMES_TORCHE[1]);
  braise.position.y = 0.012;
  flammes.add(braise);
  // [décalage x, décalage z, largeur, hauteur, penché]
  const langues: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [-0.008, 0, 1.0, 0.9, -0.05],
    [0.014, 0.008, 0.74, 1.3, 0.08],
    [-0.004, -0.006, 0.46, 0.95, -0.03],
    [-0.028, 0.012, 0.36, 0.62, 0.3],
  ];
  langues.forEach(([dx, dz, largeur, hauteur, penche], i) => {
    const langue = new THREE.Mesh(GEOMETRIE_FLAMME_TORCHE, MAT_FLAMMES_TORCHE[i]);
    langue.position.set(dx, 0.008, dz);
    langue.scale.set(largeur, hauteur, largeur);
    langue.rotation.z = penche;
    langue.userData.hauteur = hauteur;
    langue.userData.penche = penche;
    flammes.add(langue);
  });
  torche.add(flammes);
  torche.userData.flammes = flammes;
  return torche;
}

/** Fait danser les flammes d'une torche créée par creerOutil('torche') ; sans effet sur un autre outil. */
export function animerTorche(outil: THREE.Object3D, temps: number): void {
  const flammes = outil.userData.flammes as THREE.Group | undefined;
  if (!flammes) return;
  flammes.children.forEach((langue, i) => {
    const hauteur = langue.userData.hauteur as number | undefined;
    if (hauteur === undefined) return;
    const t = temps * (8 + i * 2.6) + i * 1.7;
    langue.scale.y = hauteur * (1 + 0.2 * Math.sin(t) + 0.1 * Math.sin(t * 2.7));
    langue.rotation.y = temps * (1.6 + i);
    langue.rotation.z = (langue.userData.penche as number) + 0.07 * Math.sin(t * 0.6);
  });
}

/**
 * Construit le modèle d'un outil (ou de la pousse d'arbre, ou de la torche). Les matériaux sont fournis pour
 * pouvoir être partagés et réglés ; le palier pour lequel ils ont été créés (creerMateriauxOutils) décide de
 * la forme de l'épée, de la hache et de la pioche.
 */
export function creerOutil(type: TypeObjetEnMain, mat: MateriauxOutils): THREE.Group {
  if (type === 'pousse') return creerPousse(mat);
  if (type === 'piege') return creerPiegeEnMain(mat);
  if (type === 'torche') return creerTorche(mat);
  if (type === 'arc') return creerArc(mat);
  const niveau = NIVEAU_DES_MATERIAUX.get(mat) ?? 'base';
  if (type === 'pioche') return creerPioche(mat, niveau);
  if (type === 'epee') return creerEpee(mat, niveau);
  return creerHache(mat, niveau);
}

// --- Arc, flèche et carquois (case 4) -------------------------------------------------------------
// Repère de l'arc : y le long de l'arc, poignée à l'origine, +x vers la cible (le dos de l'arc), corde du côté -x.
// Référence : docs/concepts/Arc, carquois, lance et masse low poly.png

// Position de la corde au repos (x) et des deux pointes de l'arc (±y)
const CORDE_ARC_X = -0.13;
const POINTE_ARC_Y = 0.48;
// Recul de l'encoche à pleine tension, en mètres
const TIRAGE_ARC = 0.3;
/** Hauteur de la flèche sur l'arc : elle passe juste au-dessus de la main qui tient la poignée. */
export const ENCOCHE_ARC_Y = 0.05;
/** Longueur de la flèche, de l'encoche à la pointe. */
export const LONGUEUR_FLECHE = 0.64;
// Demi-profil d'une branche, de la poignée à la pointe : x, y et rayon. Les branches s'écartent de la corde puis y reviennent.
const PROFIL_ARC: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 0.019],
  [0.004, 0.075, 0.019],
  [0.034, 0.175, 0.018],
  [0.03, 0.285, 0.016],
  [-0.025, 0.385, 0.0135],
  [-0.095, 0.455, 0.011],
  [CORDE_ARC_X, POINTE_ARC_Y, 0.009],
];
const GEOMETRIE_CORDE = new THREE.CylinderGeometry(0.0026, 0.0026, 1, 4).translate(0, 0.5, 0);

/** Position (x, dans le repère de l'arc) de l'encoche pour une tension de 0 à 1 : là où la main tire la corde. */
export function encocheArc(tension: number): number {
  return CORDE_ARC_X - TIRAGE_ARC * Math.max(0, Math.min(1, tension));
}

/** Tronçon à six pans, un peu aplati, entre deux points du plan xy (rayons `ra` et `rb`). */
function troncon(materiau: THREE.Material, ax: number, ay: number, ra: number, bx: number, by: number, rb: number): THREE.Mesh {
  const dx = bx - ax;
  const dy = by - ay;
  const m = maille(new THREE.CylinderGeometry(rb, ra, Math.hypot(dx, dy) + 0.006, 6), materiau, (ax + bx) / 2, (ay + by) / 2, 0);
  m.rotation.z = Math.atan2(-dx, dy);
  m.scale.z = 0.85;
  return m;
}

/** Flèche : encoche à l'origine, pointe en +x. Fût de bois, pointe de fer, trois plumes claires. */
export function creerModeleFleche(mat: MateriauxOutils): THREE.Group {
  const fleche = new THREE.Group();
  // Pièces construites le long de y, puis couchées vers +x
  const corps = new THREE.Group();
  corps.rotation.z = -Math.PI / 2;
  corps.add(maille(new THREE.CylinderGeometry(0.0062, 0.0062, 0.55, 5), mat.bois, 0, 0.285, 0));
  corps.add(maille(new THREE.CylinderGeometry(0.0085, 0.0085, 0.022, 5), mat.boisSombre, 0, 0.011, 0));
  corps.add(maille(new THREE.CylinderGeometry(0.008, 0.0095, 0.03, 5), mat.ferSombre, 0, 0.565, 0));
  const pointe = maille(new THREE.ConeGeometry(0.017, 0.062, 4), mat.fer, 0, 0.609, 0);
  pointe.scale.z = 0.55;
  corps.add(pointe);
  // Empennage : trois plumes en deux pans (la plus étroite vers la pointe), liées au fût
  for (let k = 0; k < 3; k++) {
    const plume = new THREE.Group();
    plume.rotation.y = (k * 2 * Math.PI) / 3 + 0.5;
    plume.add(boite(0.026, 0.06, 0.003, mat.ecusson, 0.019, 0.075, 0));
    plume.add(boite(0.017, 0.035, 0.003, mat.ecusson, 0.0145, 0.118, 0));
    corps.add(plume);
  }
  corps.add(maille(new THREE.CylinderGeometry(0.0078, 0.0078, 0.012, 5), mat.tissuSombre, 0, 0.142, 0));
  fleche.add(corps);
  return fleche;
}

function creerArc(mat: MateriauxOutils): THREE.Group {
  const arc = new THREE.Group();
  const cordes: THREE.Mesh[] = [];
  for (const s of [1, -1]) {
    // Branche en tronçons à pans, de plus en plus fins
    for (let i = 0; i + 1 < PROFIL_ARC.length; i++) {
      const [ax, ay, ra] = PROFIL_ARC[i];
      const [bx, by, rb] = PROFIL_ARC[i + 1];
      arc.add(troncon(mat.bois, ax, s * ay, ra, bx, s * by, rb));
    }
    // Pointe renflée où s'accroche la corde, et la ligature juste avant
    arc.add(maille(galet(0.017, 0.021, 0.017), mat.boisSombre, CORDE_ARC_X - 0.004, s * (POINTE_ARC_Y + 0.008), 0));
    arc.add(troncon(mat.tissu, -0.1, s * 0.459, 0.0128, -0.11, s * 0.467, 0.0122));
    const corde = maille(GEOMETRIE_CORDE, mat.tissu, CORDE_ARC_X, s * POINTE_ARC_Y, 0);
    cordes.push(corde);
    arc.add(corde);
  }
  // Poignée : cuir enroulé, serré par des bagues sombres ; petit repose-flèche au-dessus de la main
  arc.add(maille(new THREE.CylinderGeometry(0.0225, 0.0225, 0.125, 6), mat.cuir, 0.002, 0, 0));
  for (const y of [-0.066, 0, 0.066]) {
    arc.add(maille(new THREE.CylinderGeometry(0.0245, 0.0245, y === 0 ? 0.009 : 0.014, 6), mat.cuirSombre, 0.002, y, 0));
  }
  arc.add(boite(0.026, 0.008, 0.02, mat.boisSombre, 0.004, ENCOCHE_ARC_Y - 0.012, 0.016));
  const fleche = creerModeleFleche(mat);
  arc.add(fleche);
  arc.userData.arc = { cordes, fleche };
  tendreArc(arc, 0, true);
  return arc;
}

const HAUT_CORDE = new THREE.Vector3(0, 1, 0);
const VERS_ENCOCHE = new THREE.Vector3();

/** Tend la corde d'un arc créé par `creerOutil` (tension de 0 à 1) et montre ou cache la flèche encochée. */
export function tendreArc(arc: THREE.Object3D, tension: number, avecFleche: boolean): void {
  const pieces = arc.userData.arc as { cordes: THREE.Mesh[]; fleche: THREE.Group } | undefined;
  if (!pieces) return;
  const x = encocheArc(tension);
  // Chaque moitié de corde va de sa pointe à l'encoche
  pieces.cordes.forEach((corde, k) => {
    VERS_ENCOCHE.set(x - CORDE_ARC_X, ENCOCHE_ARC_Y - (k === 0 ? POINTE_ARC_Y : -POINTE_ARC_Y), 0);
    const longueur = VERS_ENCOCHE.length();
    corde.scale.y = longueur;
    corde.quaternion.setFromUnitVectors(HAUT_CORDE, VERS_ENCOCHE.divideScalar(longueur));
  });
  pieces.fleche.visible = avecFleche;
  pieces.fleche.position.set(x, ENCOCHE_ARC_Y, 0.02);
}

/** Carquois de cuir porté dans le dos (3e personne) : origine au centre, ouverture vers +y, trois flèches qui dépassent. */
export function creerCarquois(mat: MateriauxOutils): THREE.Group {
  const carquois = new THREE.Group();
  carquois.add(maille(new THREE.CylinderGeometry(0.052, 0.036, 0.4, 6), mat.cuir));
  carquois.add(maille(new THREE.CylinderGeometry(0.056, 0.056, 0.03, 6), mat.cuirSombre, 0, 0.19, 0));
  carquois.add(maille(new THREE.CylinderGeometry(0.036, 0.03, 0.03, 6), mat.cuirSombre, 0, -0.21, 0));
  // Sangle en travers, avec sa boucle
  const sangle = boite(0.118, 0.026, 0.108, mat.cuirClair, 0, 0.03, 0);
  sangle.rotation.z = 0.35;
  carquois.add(sangle);
  carquois.add(boite(0.032, 0.036, 0.012, mat.ferPatine, 0, 0.03, 0.056));
  const places: ReadonlyArray<readonly [number, number, number]> = [
    [-0.02, 0.012, -0.1],
    [0.02, 0.01, 0.09],
    [0, -0.02, 0],
  ];
  for (const [x, z, penche] of places) {
    const fleche = creerModeleFleche(mat);
    fleche.scale.setScalar(0.85);
    // Pointe vers le bas, empennage qui dépasse de l'ouverture
    fleche.rotation.z = -Math.PI / 2 + penche;
    fleche.position.set(x, 0.34, z);
    carquois.add(fleche);
  }
  return carquois;
}

// --- Boucliers (bras gauche, avec l'épée) --------------------------------------------------------
// Repère : la face avant regarde +z, le haut est +y, l'origine est au centre. La poignée est au dos,
// verticale, à z = PRISE_BOUCLIER_Z : c'est là que la main gauche le tient.
// Référence : docs/concepts/Boucliers médiévaux low poly, quatre vues.png

/** Mêmes valeurs que `TypeBouclier` de src/regles/equipement.ts. */
export type TypeBouclier = 'bois' | 'renforce';

export const PRISE_BOUCLIER_Z = -0.07;

/** Poignée de cuir au dos : une barre verticale tenue par deux attaches. */
function creerPoigneeBouclier(mat: MateriauxOutils): THREE.Group {
  const poignee = new THREE.Group();
  poignee.add(boite(0.032, 0.17, 0.03, mat.cuir, 0, 0, PRISE_BOUCLIER_Z));
  for (const y of [-0.088, 0.088]) poignee.add(boite(0.038, 0.034, 0.075, mat.cuirSombre, 0, y, PRISE_BOUCLIER_Z / 2 - 0.004));
  return poignee;
}

/** Bouclier en bois : rond, cinq planches, cerclage de fer à douze pans, umbo à facettes et quatre gros rivets. */
function creerBouclierBois(mat: MateriauxOutils): THREE.Group {
  const bouclier = new THREE.Group();
  const R = 0.27;
  const EPAISSEUR = 0.028;
  // Fond sombre, visible dans les joints entre les planches
  const fond = new THREE.CylinderGeometry(R - 0.004, R - 0.004, EPAISSEUR * 0.6, 12);
  fond.rotateX(Math.PI / 2);
  bouclier.add(maille(fond, mat.boisSombre));
  // Planches verticales, coupées en rond, de deux teintes alternées et légèrement décalées en épaisseur
  const PLANCHES = 5;
  const largeur = (2 * R) / PLANCHES;
  const joint = 0.005;
  const demiHauteur = (x: number) => Math.sqrt(Math.max(0, R * R - x * x));
  for (let k = 0; k < PLANCHES; k++) {
    const x0 = -R + k * largeur + joint / 2;
    const x1 = x0 + largeur - joint;
    const xm = (x0 + x1) / 2;
    const forme = new THREE.Shape();
    forme.moveTo(x0, -demiHauteur(x0));
    forme.lineTo(xm, -demiHauteur(xm));
    forme.lineTo(x1, -demiHauteur(x1));
    forme.lineTo(x1, demiHauteur(x1));
    forme.lineTo(xm, demiHauteur(xm));
    forme.lineTo(x0, demiHauteur(x0));
    forme.closePath();
    const planche = new THREE.ExtrudeGeometry(forme, { depth: EPAISSEUR, bevelEnabled: false });
    planche.translate(0, 0, -EPAISSEUR / 2 + (k % 2 ? 0.003 : 0));
    bouclier.add(maille(planche, k % 2 ? mat.cuirClair : mat.bois));
  }
  // Cerclage de fer épais, à douze pans
  const cerclage = new THREE.TorusGeometry(R + 0.012, 0.028, 5, 12);
  cerclage.scale(1, 1, 0.85);
  bouclier.add(maille(cerclage, mat.fer));
  // Umbo : calotte à facettes sur une collerette
  const collerette = new THREE.CylinderGeometry(0.1, 0.108, 0.012, 10);
  collerette.rotateX(Math.PI / 2);
  bouclier.add(maille(collerette, mat.ferSombre, 0, 0, EPAISSEUR / 2 + 0.008));
  const calotte = new THREE.SphereGeometry(0.088, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2);
  calotte.rotateX(Math.PI / 2);
  calotte.scale(1, 1, 0.72);
  bouclier.add(maille(calotte, mat.fer, 0, 0, EPAISSEUR / 2 + 0.012));
  // Quatre gros rivets sur le cerclage (haut, bas, gauche, droite), des deux côtés
  for (let k = 0; k < 4; k++) {
    const angle = (k * Math.PI) / 2;
    const x = Math.cos(angle) * (R + 0.012);
    const y = Math.sin(angle) * (R + 0.012);
    bouclier.add(rivet(mat.acier, x, y, 0.025, 2.8), rivet(mat.acier, x, y, -0.025, 2.2));
  }
  bouclier.add(creerPoigneeBouclier(mat));
  return bouclier;
}

/** Bouclier renforcé : écu en pointe, plaques de fer à facettes autour d'une arête centrale, bordure claire rivetée, losange au centre. */
function creerBouclierRenforce(mat: MateriauxOutils): THREE.Group {
  const bouclier = new THREE.Group();
  // Contour de l'écu, dans le sens inverse des aiguilles d'une montre vu de face
  const contour: ReadonlyArray<readonly [number, number]> = [
    [0, 0.33],
    [-0.25, 0.29],
    [-0.25, 0.03],
    [-0.19, -0.17],
    [0, -0.37],
    [0.19, -0.17],
    [0.25, 0.03],
    [0.25, 0.29],
  ];
  const EPAISSEUR = 0.024;
  // Âme en bois (visible au dos)
  const forme = new THREE.Shape();
  forme.moveTo(contour[0][0], contour[0][1]);
  for (let k = 1; k < contour.length; k++) forme.lineTo(contour[k][0], contour[k][1]);
  forme.closePath();
  const ame = new THREE.ExtrudeGeometry(forme, { depth: EPAISSEUR, bevelEnabled: false });
  ame.translate(0, 0, -EPAISSEUR);
  bouclier.add(maille(ame, mat.bois));
  // Dos : joints des planches, et deux traverses de fer rivetées
  for (const x of [-0.085, 0.085]) bouclier.add(boite(0.007, 0.55, 0.004, mat.boisSombre, x, 0.02, -EPAISSEUR - 0.001));
  for (const [y, longueur] of [
    [0.2, 0.46],
    [-0.11, 0.38],
  ]) {
    bouclier.add(boite(longueur, 0.042, 0.008, mat.ferSombre, 0, y, -EPAISSEUR - 0.004));
    for (const cote of [-1, 1]) bouclier.add(rivet(mat.acier, cote * (longueur / 2 - 0.035), y, -EPAISSEUR - 0.008, 1.8));
  }
  // Plaques : une facette par côté, du bord vers le sommet de l'arête centrale
  const sommet: [number, number, number] = [0, 0.02, 0.06];
  const positions: number[] = [];
  const zBord = (k: number) => (contour[k][0] === 0 ? 0.016 : 0.003);
  for (let k = 0; k < contour.length; k++) {
    const s = (k + 1) % contour.length;
    positions.push(contour[k][0], contour[k][1], zBord(k), contour[s][0], contour[s][1], zBord(s), ...sommet);
  }
  const plaques = new THREE.BufferGeometry();
  plaques.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  plaques.computeVertexNormals();
  bouclier.add(maille(plaques, mat.ferSombre));
  // Bordure d'acier clair le long de chaque côté, et un rivet à chaque angle
  for (let k = 0; k < contour.length; k++) {
    const [ax, ay] = contour[k];
    const [bx, by] = contour[(k + 1) % contour.length];
    const bord = boite(0.042, Math.hypot(bx - ax, by - ay) + 0.036, 0.042, mat.acier, (ax + bx) / 2, (ay + by) / 2, -0.007);
    bord.rotation.z = Math.atan2(by - ay, bx - ax) - Math.PI / 2;
    bouclier.add(bord, rivet(mat.fer, ax, ay, 0.017, 2.4));
  }
  // Losange clair au centre, à cheval sur l'arête
  const losange = maille(new THREE.OctahedronGeometry(0.05, 0), mat.ecusson, sommet[0], sommet[1], sommet[2] - 0.004);
  losange.scale.set(0.72, 1.15, 0.3);
  bouclier.add(losange);
  bouclier.add(creerPoigneeBouclier(mat));
  return bouclier;
}

/** Construit le modèle d'un bouclier. */
export function creerBouclier(type: TypeBouclier, mat: MateriauxOutils): THREE.Group {
  return type === 'renforce' ? creerBouclierRenforce(mat) : creerBouclierBois(mat);
}
