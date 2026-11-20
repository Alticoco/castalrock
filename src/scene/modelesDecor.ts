// Modèles low poly du décor, faits en code d'après les images de docs/concepts/ :
// formes facettées, couleurs franches, une seule géométrie par modèle (couleurs par sommet).
// Ne contient aucune règle de jeu : tailles de collision et densités sont dans src/monde/decor.ts.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { INFOS_DECOR, type TypeDecor } from '../monde/decor';
import { creerAleatoire, type Aleatoire } from '../regles/aleatoire';

export interface ModeleDecor {
  geometrie: THREE.BufferGeometry;
  /** Vrai pour les arbres et les rochers : ombre portée, et « trou » quand ils cachent le personnage */
  grand: boolean;
  /** Vrai pour ce qui brille dans le noir (cristaux) : affiché sans éclairage, avec `materiauLumineux` */
  lumineux?: boolean;
}

export interface ModelesDecor {
  modele(type: TypeDecor, variante: number): ModeleDecor;
  /** Matériau des grands éléments, percé le long de la ligne caméra–personnage */
  materiauGrand: THREE.Material;
  /** Matériau des petits éléments (buissons, plantes, herbes) */
  materiauPetit: THREE.Material;
  /** Matériau des éléments lumineux (cristaux) : leur couleur ne dépend pas de la lumière */
  materiauLumineux: THREE.Material;
  /** Règle le trou : point visé (le personnage) et force de 0 (aucun trou) à 1. */
  definirTrou(x: number, y: number, z: number, force: number): void;
  liberer(): void;
}

// --- Outils de construction -------------------------------------------------------------------

/** Assemble plusieurs formes en une seule géométrie à faces plates, une couleur par face. */
class Assemblage {
  private positions: number[] = [];
  private couleurs: number[] = [];
  private alea: Aleatoire;

  constructor(graine: number) {
    this.alea = creerAleatoire(graine);
  }

  /**
   * Ajoute une forme. `couleur` : une couleur, ou une fonction du centre et de la normale du triangle.
   * `variation` : écart de luminosité d'une facette à l'autre (les triangles d'une même facette
   * plane reçoivent la même teinte, pour que les grandes faces restent lisibles).
   */
  ajouter(
    forme: THREE.BufferGeometry,
    couleur: number | ((centre: THREE.Vector3, normale: THREE.Vector3) => number),
    matrice?: THREE.Matrix4,
    variation = 0.06,
  ): this {
    const g = forme.index ? forme.toNonIndexed() : forme;
    if (matrice) g.applyMatrix4(matrice);
    const p = g.getAttribute('position');
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    const centre = new THREE.Vector3();
    const normale = new THREE.Vector3();
    const teinte = new THREE.Color();
    const parFacette = new Map<string, number>();
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i);
      b.fromBufferAttribute(p, i + 1);
      c.fromBufferAttribute(p, i + 2);
      normale.copy(c).sub(b).cross(centre.copy(a).sub(b)).normalize();
      centre.copy(a).add(b).add(c).divideScalar(3);
      teinte.set(typeof couleur === 'number' ? couleur : couleur(centre, normale));
      // Même plan (même normale, même distance) = même facette = même teinte
      const cle = `${Math.round(normale.x * 40)},${Math.round(normale.y * 40)},${Math.round(normale.z * 40)},${Math.round(normale.dot(a) * 25)}`;
      let v = parFacette.get(cle);
      if (v === undefined) {
        v = 1 + (this.alea.suivant() - 0.5) * 2 * variation;
        parFacette.set(cle, v);
      }
      for (const s of [a, b, c]) {
        this.positions.push(s.x, s.y, s.z);
        this.couleurs.push(teinte.r * v, teinte.g * v, teinte.b * v);
      }
    }
    if (g !== forme) g.dispose();
    forme.dispose();
    return this;
  }

  terminer(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.couleurs, 3));
    g.computeVertexNormals(); // géométrie non indexée : une normale par face
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

/** Matrice : position, puis rotation (radians, ordre XYZ), puis étirement. */
function placer(x: number, y: number, z: number, sx = 1, sy = sx, sz = sx, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
}

/** Un plan de coupe : le volume garde les points p tels que n · p <= d. */
type Plan = readonly [nx: number, ny: number, nz: number, d: number];

/**
 * Plans de coupe répartis tout autour d'une boule de rayon 1, un peu désordonnés :
 * ils taillent un bloc convexe à grandes facettes planes (rocher, houppier, buisson).
 */
function plansTailles(graine: number, nombre: number, irregularite: number): Plan[] {
  const alea = creerAleatoire(graine);
  const depart = alea.entre(0, Math.PI * 2);
  const plans: Plan[] = [];
  const n = new THREE.Vector3();
  for (let i = 0; i < nombre; i++) {
    const y = 1 - (2 * (i + 0.5)) / nombre;
    const r = Math.sqrt(1 - y * y);
    const angle = depart + i * 2.399963;
    n.set(
      Math.cos(angle) * r + alea.entre(-1, 1) * irregularite,
      y + alea.entre(-1, 1) * irregularite,
      Math.sin(angle) * r + alea.entre(-1, 1) * irregularite,
    ).normalize();
    plans.push([n.x, n.y, n.z, 1 - alea.entre(0, 0.6) * irregularite]);
  }
  return plans;
}

/** Les mêmes plans, écartés du centre de `marge` (le bloc obtenu enveloppe le premier). */
function ecarter(plans: readonly Plan[], marge: number): Plan[] {
  return plans.map(([x, y, z, d]) => [x, y, z, d + marge] as const);
}

/** Bloc convexe délimité par des plans : chaque plan donne une facette plane (polygone découpé en éventail). */
function blocTaille(plans: readonly Plan[]): THREE.BufferGeometry {
  const nb = plans.length;
  const TOLERANCE = 1e-6;
  // Sommets : points de rencontre de trois plans qui respectent tous les autres
  const sommets: THREE.Vector3[] = [];
  const parPlan: number[][] = plans.map(() => []);
  const m = new THREE.Matrix3();
  for (let i = 0; i < nb; i++) {
    for (let j = i + 1; j < nb; j++) {
      for (let k = j + 1; k < nb; k++) {
        const [a, b, c] = [plans[i], plans[j], plans[k]];
        m.set(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
        if (Math.abs(m.determinant()) < 1e-7) continue;
        const p = new THREE.Vector3(a[3], b[3], c[3]).applyMatrix3(m.invert());
        if (plans.some((q) => q[0] * p.x + q[1] * p.y + q[2] * p.z > q[3] + TOLERANCE)) continue;
        let indice = sommets.findIndex((s) => s.distanceToSquared(p) < 1e-10);
        if (indice < 0) {
          indice = sommets.length;
          sommets.push(p);
        }
        for (const l of [i, j, k]) if (!parPlan[l].includes(indice)) parPlan[l].push(indice);
      }
    }
  }
  const positions: number[] = [];
  const normale = new THREE.Vector3();
  const u = new THREE.Vector3();
  const v = new THREE.Vector3();
  const centre = new THREE.Vector3();
  const rel = new THREE.Vector3();
  for (let i = 0; i < nb; i++) {
    const liste = parPlan[i];
    if (liste.length < 3) continue;
    normale.set(plans[i][0], plans[i][1], plans[i][2]);
    // Repère (u, v) dans le plan, pour ranger les sommets en tournant autour du centre de la facette
    u.set(Math.abs(normale.y) < 0.9 ? 0 : 1, Math.abs(normale.y) < 0.9 ? 1 : 0, 0).cross(normale).normalize();
    v.crossVectors(normale, u);
    centre.set(0, 0, 0);
    for (const s of liste) centre.add(sommets[s]);
    centre.divideScalar(liste.length);
    const angle = (s: number) => {
      rel.copy(sommets[s]).sub(centre);
      return Math.atan2(rel.dot(v), rel.dot(u));
    };
    const tour = liste.map((s) => ({ s, angle: angle(s) })).sort((p, q) => p.angle - q.angle);
    for (let t = 1; t < tour.length - 1; t++) {
      for (const s of [tour[0].s, tour[t].s, tour[t + 1].s]) positions.push(sommets[s].x, sommets[s].y, sommets[s].z);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

/**
 * Tronc ou étage de sapin : anneaux [y, rayon, décalage x, décalage z] reliés entre eux.
 * `torsion` : part de pan dont chaque anneau tourne par rapport au précédent (0,5 donne des
 * facettes en triangles, comme une écorce taillée). Les fonds haut et bas sont au choix.
 */
function colonne(
  anneaux: ReadonlyArray<readonly number[]>,
  pans: number,
  torsion = 0,
  fondBas = false,
  fondHaut = true,
): THREE.BufferGeometry {
  const points = anneaux.map(([y, r, dx = 0, dz = 0], k) => {
    const anneau: THREE.Vector3[] = [];
    for (let i = 0; i < pans; i++) {
      const angle = ((i + k * torsion) / pans) * Math.PI * 2;
      anneau.push(new THREE.Vector3(dx + Math.cos(angle) * r, y, dz + Math.sin(angle) * r));
    }
    return anneau;
  });
  const positions: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
  for (let k = 0; k < points.length - 1; k++) {
    for (let i = 0; i < pans; i++) {
      const j = (i + 1) % pans;
      triangle(points[k][i], points[k + 1][i], points[k][j]);
      triangle(points[k][j], points[k + 1][i], points[k + 1][j]);
    }
  }
  const fond = (k: number, versLeHaut: boolean) => {
    const [y, , dx = 0, dz = 0] = anneaux[k];
    const milieu = new THREE.Vector3(dx, y, dz);
    for (let i = 0; i < pans; i++) {
      const j = (i + 1) % pans;
      if (versLeHaut) triangle(milieu, points[k][j], points[k][i]);
      else triangle(milieu, points[k][i], points[k][j]);
    }
  };
  if (fondBas) fond(0, false);
  if (fondHaut) fond(points.length - 1, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

/** Tronc ou branche simple : cylindre à pans posé sur sa base. */
function fut(rayonHaut: number, rayonBas: number, hauteur: number, pans = 6): THREE.BufferGeometry {
  return new THREE.CylinderGeometry(rayonHaut, rayonBas, hauteur, pans, 1).translate(0, hauteur / 2, 0);
}

/** Branche : part de (x, y, z), penche de `inclinaison` (0 = verticale) dans la direction `azimut`. */
function branche(x: number, y: number, z: number, azimut: number, inclinaison: number): THREE.Matrix4 {
  return placer(x, y, z, 1, 1, 1, 0, azimut, -inclinaison);
}

/** Feuille en fer de lance, pliée le long de sa nervure et retombant vers l'extérieur ; visible des deux côtés. */
function feuilleLance(longueur: number, largeur: number, retombee: number): THREE.BufferGeometry {
  const pied = [0, 0, 0];
  const milieu = [0, longueur * 0.45, longueur * retombee * 0.25];
  const pointe = [0, longueur * 0.95, longueur * retombee];
  const droite = [largeur / 2, longueur * 0.42, longueur * retombee * 0.25 - largeur * 0.22];
  const gauche = [-largeur / 2, longueur * 0.42, longueur * retombee * 0.25 - largeur * 0.22];
  const faces = [
    [pied, droite, milieu], [pied, milieu, gauche], [milieu, droite, pointe], [milieu, pointe, gauche],
  ];
  const positions: number[] = [];
  for (const [a, b, c] of faces) positions.push(...a, ...b, ...c, ...a, ...c, ...b);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

/** Pose d'une feuille ou d'une tige : au pied (0, y, 0), penchée de `inclinaison` vers l'extérieur, dans la direction `angle`. */
function rayonner(angle: number, inclinaison: number, y = 0, ecart = 0): THREE.Matrix4 {
  return placer(0, y, 0, 1, 1, 1, 0, angle, 0).multiply(placer(0, 0, ecart, 1, 1, 1, inclinaison, 0, 0));
}

// --- Modèles ----------------------------------------------------------------------------------

const K = CONFIG.decor.couleurs;

/** Racines apparentes : coins effilés qui partent du pied du tronc et plongent dans le sol. */
function racines(a: Assemblage, couleur: number, nombre: number, rayonTronc: number, longueur: number, depart: number): void {
  for (let i = 0; i < nombre; i++) {
    const angle = depart + (i / nombre) * Math.PI * 2 + (i % 2 ? 0.25 : -0.1);
    const l = longueur * (i % 2 ? 0.85 : 1);
    const coin = new THREE.ConeGeometry(rayonTronc * 0.62, l, 4, 1).translate(0, l * 0.3, 0);
    a.ajouter(coin, couleur, placer(0, rayonTronc * 0.75, 0, 1, 1, 1, 0, angle, 0).multiply(placer(rayonTronc * 0.45, 0, 0, 1, 1, 0.7, 0, 0, -1.92)), 0.12);
  }
}

/** Houppier : blocs taillés à grandes facettes, [x, y, z, rayon] chacun, en alternant deux verts. */
function houppier(a: Assemblage, blocs: number[][], graine: number, clair: number, sombre: number, aplati = 0.86): void {
  // Le dessous des blocs ne reçoit que la lumière du sol : on l'éclaircit pour qu'il reste vert vu d'en bas
  const dessous = (couleur: number) => new THREE.Color(couleur).multiplyScalar(1.3).getHex();
  const teintes = [[clair, dessous(clair)], [sombre, dessous(sombre)]];
  blocs.forEach(([x, y, z, r], i) => {
    a.ajouter(
      blocTaille(plansTailles(graine + i, 20, 0.07)),
      (_c, n) => teintes[i % 2][n.y < -0.2 ? 1 : 0],
      placer(x, y, z, r, r * aplati, r, 0, i * 1.7, 0),
      0.08,
    );
  });
}

/** Chêne : gros tronc brun aux racines apparentes, fourche de trois branches, houppier en gros blocs. Environ 7,5 m. */
function arbreFeuillu(variante: number): THREE.BufferGeometry {
  const a = new Assemblage(101 + variante);
  const penche = variante === 0 ? 1 : -1;
  a.ajouter(
    colonne(
      [
        [0, 0.82],
        [0.55, 0.57],
        [1.6, 0.48, 0.05 * penche, 0.02],
        [2.7, 0.45, 0.02 * penche, 0.06],
        [3.4, 0.54, 0, 0.04],
      ],
      7,
      0.5,
    ),
    // Une facette sur trois est plus claire, comme une écorce taillée à la serpe
    (c) => (Math.abs(Math.round(c.x * 7 + c.y * 5 + c.z * 3)) % 3 === 0 ? K.troncClair : K.tronc),
    undefined,
    0.1,
  );
  racines(a, K.tronc, 5, 0.7, 1.35, variante * 0.6);
  // Fourche : trois grosses branches qui montent dans le feuillage
  const fourche = variante === 0 ? [[0.3, 0.75], [2.5, 0.8], [4.5, 0.7]] : [[1.2, 0.8], [3.3, 0.7], [5.4, 0.8]];
  for (const [azimut, inclinaison] of fourche) {
    a.ajouter(fut(0.17, 0.32, 2.4, 5), K.tronc, branche(0, 3.0, 0.04, azimut, inclinaison), 0.12);
  }
  const blocs =
    variante === 0
      ? [[0, 5.7, 0, 2.5], [2.1, 4.75, 0.5, 1.95], [-2.05, 4.8, -0.5, 2.0], [0.3, 4.7, 1.9, 1.8], [-0.3, 4.8, -1.9, 1.8], [-1.3, 4.5, 1.4, 1.4]]
      : [[0.3, 5.85, -0.2, 2.35], [-1.8, 5.05, 0.8, 2.1], [1.9, 4.8, -0.6, 1.9], [1.0, 4.6, 1.7, 1.65], [-0.9, 4.7, -1.8, 1.7]];
  houppier(a, blocs, 200 + variante * 10, K.feuillage, K.feuillageSombre);
  return a.terminer();
}

/** Sapin : tronc court, étages en jupes larges qui se recouvrent, dessous plus sombre. Environ 8 m. */
function sapin(variante: number): THREE.BufferGeometry {
  const a = new Assemblage(111 + variante);
  a.ajouter(colonne([[0, 0.58], [0.45, 0.4], [1.7, 0.33]], 6, 0.5, false, false), K.tronc, undefined, 0.12);
  racines(a, K.tronc, 4, 0.5, 0.95, variante);
  const etages = variante === 0 ? 4 : 3;
  const sommet = variante === 0 ? 8.2 : 7.2;
  const base = 1.3;
  const pas = (sommet - base) / (etages + 0.35);
  for (let e = 0; e < etages; e++) {
    const dernier = e === etages - 1;
    const rayon = (variante === 0 ? 2.35 : 2.55) * (1 - (e / etages) * 0.62);
    const hauteur = dernier ? sommet - base - pas * e : pas * 1.3;
    // Une jupe : large en bas, resserrée en haut (le dernier étage finit en pointe), fermée par dessous
    const jupe = colonne([[0, rayon], [hauteur, dernier ? 0.001 : rayon * 0.42]], 8, 0, true, false);
    a.ajouter(
      jupe,
      (_c, n) => (n.y < -0.5 ? K.sapinDessous : e % 2 ? K.sapinClair : K.sapin),
      placer(0, base + pas * e, 0, 1, 1, 1, 0, e * 0.4, 0),
      0.07,
    );
  }
  return a.terminer();
}

/** Bouleau : tronc clair taché de brun, trois branches en fourche, trois blocs de feuillage vert tendre. Environ 7,5 m. */
function bouleau(): THREE.BufferGeometry {
  const a = new Assemblage(121);
  a.ajouter(
    colonne([[0, 0.4], [0.4, 0.26], [2.4, 0.22, 0.05, 0], [4.4, 0.17, -0.02, 0.04]], 6, 0.5),
    K.ecorceBouleau,
    undefined,
    0.07,
  );
  racines(a, K.ecorceBouleau, 4, 0.36, 0.85, 0.4);
  // Taches brunes de l'écorce : petites plaques à peine en relief, à des hauteurs et des côtés variés
  for (const [y, angle, largeur, hauteur] of [[0.95, 0.5, 0.3, 0.17], [1.5, 3.4, 0.26, 0.2], [1.95, 1.9, 0.28, 0.15], [2.6, 5.0, 0.24, 0.18], [3.1, 0.9, 0.22, 0.14], [3.7, 3.0, 0.2, 0.13]]) {
    const rayon = 0.26 - (y / 4.4) * 0.09;
    a.ajouter(
      new THREE.BoxGeometry(0.05, hauteur, largeur),
      K.marqueBouleau,
      placer(0, y, 0, 1, 1, 1, 0, angle, 0).multiply(placer(rayon - 0.012, 0, 0)),
      0.08,
    );
  }
  for (const [azimut, inclinaison, longueur] of [[0, 0.72, 1.75], [3.1, 0.72, 1.75], [1.5, 0.12, 1.6]]) {
    a.ajouter(fut(0.07, 0.13, longueur, 5), K.ecorceBouleau, branche(0, 4.2, 0.03, azimut, inclinaison), 0.07);
  }
  houppier(a, [[0.1, 6.3, 0, 1.85], [-1.65, 5.0, 0.15, 1.3], [1.6, 4.85, -0.15, 1.35]], 301, K.feuillageBouleau, K.feuillageBouleau, 0.92);
  return a.terminer();
}

/**
 * Rocher gris à grandes facettes, à moitié posé dans le sol. Rayon d'environ 1 m.
 * Variante 0 : gros bloc et ses épaulements ; 1 : pierre basse et son petit voisin ; 2 : dôme coiffé de mousse.
 */
function rocher(variante: number): THREE.BufferGeometry {
  const a = new Assemblage(131 + variante);
  const gris = (_c: THREE.Vector3, n: THREE.Vector3) => (n.y > 0.15 ? K.rocher : K.rocherSombre);
  if (variante % 3 === 0) {
    a.ajouter(blocTaille(plansTailles(400, 19, 0.13)), gris, placer(-0.08, 0.62, 0, 0.9, 1.0, 0.8, 0, 0.4, 0), 0.07);
    a.ajouter(blocTaille(plansTailles(401, 14, 0.15)), gris, placer(0.48, 0.3, 0.36, 0.62, 0.68, 0.56, 0, 1.3, 0), 0.07);
    a.ajouter(blocTaille(plansTailles(402, 13, 0.15)), gris, placer(-0.58, 0.18, -0.3, 0.46, 0.5, 0.48, 0, 2.2, 0), 0.07);
  } else if (variante % 3 === 1) {
    a.ajouter(blocTaille(plansTailles(410, 17, 0.13)), gris, placer(-0.1, 0.3, 0, 1.02, 0.6, 0.85, 0, 0.9, 0), 0.07);
    a.ajouter(blocTaille(plansTailles(411, 12, 0.15)), gris, placer(0.88, 0.14, 0.42, 0.38, 0.34, 0.36), 0.07);
  } else {
    const plans = plansTailles(420, 18, 0.12);
    const pose = placer(0, 0.42, 0, 0.98, 0.85, 0.9);
    a.ajouter(blocTaille(plans), gris, pose, 0.07);
    // Coiffe de mousse : le même bloc à peine plus gros, dont on ne garde que le haut ;
    // trois coupes de biais se chevauchent pour un bord en dents inégales
    const mousse = ecarter(plans, 0.05);
    for (const [x, z, d] of [[0.24, 0.05, -0.4], [-0.2, 0.2, -0.36], [-0.1, -0.24, -0.44]]) {
      a.ajouter(blocTaille([...mousse, [x, -0.95, z, d]]), K.mousse, pose, 0.07);
    }
  }
  return a.terminer();
}

/**
 * Filon : roche sombre barrée de veines de minerai, avec des blocs de minerai qui affleurent.
 * Fer : veines gris-bleu ; cuivre : veines orangées ; charbon : roche très sombre et blocs noirs mats.
 */
function filon(roche: number, minerai: number): THREE.BufferGeometry {
  const a = new Assemblage(141);
  const plans = plansTailles(430, 18, 0.13);
  const pose = placer(0, 0.5, 0, 0.98, 0.98, 0.88, 0, 0.3, 0);
  a.ajouter(blocTaille(plans), roche, pose, 0.08);
  // Veines : des tranches du même bloc, à peine plus grosses que lui, en biais
  const dessus = ecarter(plans, 0.03);
  for (const [x, y, z, milieu, demi] of [[0.55, 0.62, 0.35, 0.3, 0.085], [0.5, 0.45, -0.6, -0.32, 0.075]]) {
    const l = Math.hypot(x, y, z);
    const n = [x / l, y / l, z / l];
    a.ajouter(blocTaille([...dessus, [n[0], n[1], n[2], milieu + demi], [-n[0], -n[1], -n[2], -(milieu - demi)]]), minerai, pose, 0.06);
  }
  // Blocs de minerai sur le dessus et les flancs
  [[0.3, 1.38, 0.1, 0.27], [-0.25, 1.32, -0.2, 0.22], [-0.9, 0.7, 0.3, 0.2], [0.85, 0.55, 0.5, 0.21], [0.1, 0.6, -0.85, 0.18]].forEach(([x, y, z, r], i) => {
    a.ajouter(blocTaille(plansTailles(440 + i, 9, 0.25)), minerai, placer(x, y, z, r, r * 1.2, r, 0.3 * i, i, 0.2), 0.1);
  });
  return a.terminer();
}

const filonFer = () => filon(K.filon, K.minerai);
const filonCuivre = () => filon(K.filonCuivre, K.mineraiCuivre);
const filonCharbon = () => filon(K.filonCharbon, K.mineraiCharbon);

/** Écrit l'ombre des facettes dans les couleurs (pour un modèle affiché sans éclairage). */
function ombrerFacettes(g: THREE.BufferGeometry): THREE.BufferGeometry {
  const normales = g.getAttribute('normal');
  const couleurs = g.getAttribute('color');
  const lumiere = new THREE.Vector3(0.4, 0.8, 0.45).normalize();
  const n = new THREE.Vector3();
  for (let i = 0; i < couleurs.count; i++) {
    const f = 0.62 + 0.5 * Math.max(0, n.fromBufferAttribute(normales, i).dot(lumiere));
    couleurs.setXYZ(i, couleurs.getX(i) * f, couleurs.getY(i) * f, couleurs.getZ(i) * f);
  }
  return g;
}

/** Cristaux bleus de la mine : prismes pointus sur un socle de roche sombre. Ils brillent dans le noir. Environ 1,8 m. */
function cristalBleu(variante: number): THREE.BufferGeometry {
  const a = new Assemblage(191 + variante);
  const M = CONFIG.mine.couleurs;
  a.ajouter(blocTaille(plansTailles(450 + variante, 10, 0.28)), M.socleCristal, placer(0, 0.14, 0, 0.72, 0.34, 0.62), 0.08);
  // x, z, rayon, hauteur, inclinaisons
  const prismes =
    variante === 0
      ? [[0, 0, 0.2, 1.15, 0, 0], [0.3, 0.12, 0.14, 0.75, 0, -0.4], [-0.28, -0.05, 0.12, 0.6, 0.15, 0.45], [0.05, -0.28, 0.1, 0.45, -0.5, 0], [-0.08, 0.3, 0.09, 0.4, 0.55, 0.1]]
      : [[-0.1, 0.05, 0.17, 0.95, 0, 0.12], [0.22, -0.1, 0.16, 1.05, 0.1, -0.25], [-0.32, 0.2, 0.11, 0.5, 0.3, 0.5], [0.12, 0.28, 0.09, 0.42, 0.5, -0.15]];
  for (const [x, z, r, h, rx, rz] of prismes) {
    // Prisme à six pans, un peu plus large au milieu, terminé par une pointe
    a.ajouter(
      colonne([[0, r * 0.8], [h * 0.75, r], [h, r * 0.82], [h + r * 1.5, 0.001]], 6, 0, false, false),
      (c) => (c.y > 0.3 + h * 0.8 ? M.cristalClair : M.cristal),
      placer(x, 0.26, z, 1, 1, 1, rx, x * 7, rz),
      0.05,
    );
  }
  return ombrerFacettes(a.terminer());
}

/** Buisson en blocs serrés sur trois tiges, piqué de grappes de baies rouges (variante 0) ; variante 1 : le même, cueilli. */
function buissonBaies(variante: number): THREE.BufferGeometry {
  const a = new Assemblage(151);
  for (const [azimut, inclinaison] of [[0.4, 0.5], [2.6, 0.55], [4.6, 0.45]]) {
    a.ajouter(fut(0.04, 0.055, 0.6, 4), K.tronc, branche(0, 0, 0, azimut, inclinaison), 0.1);
  }
  const blocs = [
    [0, 0.8, 0, 0.5], [0.48, 0.66, 0.18, 0.42], [-0.48, 0.68, 0.12, 0.44],
    [0.08, 0.62, 0.48, 0.42], [-0.1, 0.66, -0.45, 0.44], [0.1, 1.08, -0.05, 0.36],
  ];
  houppier(a, blocs, 430, K.buisson, K.buissonSombre, 0.9);
  if (variante === 0) {
    // Quatre grappes de trois baies, posées sur le dessus et les flancs
    const vers = new THREE.Vector3();
    const u = new THREE.Vector3();
    const w = new THREE.Vector3();
    for (const [x, y, z] of [[0.2, 1.36, 0.12], [0.76, 0.9, 0.4], [-0.76, 0.95, 0.32], [0.08, 0.8, 0.86], [-0.25, 0.98, -0.76]]) {
      // Les trois baies se serrent en triangle, face à l'extérieur du buisson
      vers.set(x, y - 0.7, z).normalize();
      u.set(-vers.z, 0, vers.x);
      if (u.lengthSq() < 0.01) u.set(1, 0, 0);
      u.normalize();
      w.crossVectors(vers, u);
      for (let i = 0; i < 3; i++) {
        const angle = (i / 3) * Math.PI * 2 + x * 5;
        const c = Math.cos(angle) * 0.085;
        const s = Math.sin(angle) * 0.085;
        a.ajouter(
          new THREE.IcosahedronGeometry(0.085, 0),
          K.baie,
          placer(x + u.x * c + w.x * s, y + u.y * c + w.y * s, z + u.z * c + w.z * s, 1, 1, 1, i, angle, 0),
          0.06,
        );
      }
    }
  }
  return a.terminer();
}

/** Plante médicinale : bouquet de longues feuilles en fer de lance et une fleur lilas à cœur jaune. */
function planteMedicinale(): THREE.BufferGeometry {
  const a = new Assemblage(161);
  for (let i = 0; i < 7; i++) {
    const grande = i % 2 === 0;
    a.ajouter(
      feuilleLance(grande ? 0.62 : 0.48, grande ? 0.27 : 0.21, grande ? 0.3 : 0.2),
      // Le revers des feuilles, tourné vers le sol, est éclairci pour ne pas paraître noir
      (_c, n) => (n.y < 0 ? K.feuillageBouleau : i % 3 === 0 ? K.planteSombre : K.plante),
      rayonner((i / 7) * Math.PI * 2 + 0.3, grande ? 0.5 : 0.22, 0.02, 0.03),
      0.1,
    );
  }
  // Tige légèrement penchée, puis la fleur : cinq pétales à plat autour du cœur, tournée vers le haut et l'avant
  a.ajouter(fut(0.018, 0.026, 0.72, 4), K.plante, placer(0, 0, 0, 1, 1, 1, 0.1, 0, 0.06));
  const fleur = placer(-0.04, 0.74, 0.07, 1, 1, 1, 0.5, 0, 0);
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    a.ajouter(
      new THREE.OctahedronGeometry(1, 0),
      K.fleurPlante,
      fleur.clone().multiply(placer(Math.sin(angle) * 0.105, 0, Math.cos(angle) * 0.105, 0.075, 0.018, 0.095, 0, angle, 0)),
      0.06,
    );
  }
  a.ajouter(new THREE.OctahedronGeometry(0.05, 0), K.fleurJaune, fleur.clone().multiply(placer(0, 0.02, 0)), 0.04);
  return a.terminer();
}

/** Touffe de fibres : hautes tiges couleur paille serrées par un lien, quelques-unes finies par un épi. */
function fibres(): THREE.BufferGeometry {
  const a = new Assemblage(171);
  const alea = creerAleatoire(172);
  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2 + alea.entre(-0.3, 0.3);
    const ecart = i === 0 ? 0 : alea.entre(0.2, 0.45);
    const hauteur = alea.entre(0.9, 1.35);
    const pose = rayonner(angle, ecart);
    a.ajouter(colonne([[0, 0.04], [hauteur, 0.014]], 4, 0, false, true), K.fibres, pose, 0.1);
    if (i % 3 === 0) {
      a.ajouter(new THREE.OctahedronGeometry(1, 0), K.lienFibres, pose.clone().multiply(placer(0, hauteur + 0.07, 0, 0.04, 0.13, 0.04)), 0.08);
    }
  }
  a.ajouter(fut(0.085, 0.095, 0.08, 6), K.lienFibres, placer(0, 0.2, 0));
  return a.terminer();
}

/** Touffe d'herbe (variante 0), avec une fleur blanche (1) ou jaune (2). */
function herbe(variante: number): THREE.BufferGeometry {
  const a = new Assemblage(181 + variante);
  const alea = creerAleatoire(182 + variante);
  const brins = variante === 0 ? 5 : 3;
  for (let i = 0; i < brins; i++) {
    const angle = (i / brins) * Math.PI * 2 + alea.entre(-0.4, 0.4);
    const hauteur = alea.entre(0.3, 0.55);
    // Brin sans fond : le dessous est dans le sol, on ne le voit jamais
    const brin = new THREE.ConeGeometry(0.06, hauteur, 3, 1, true).translate(0, hauteur / 2, 0);
    a.ajouter(brin, K.herbe, rayonner(angle, alea.entre(0.2, 0.55)), 0.12);
  }
  if (variante > 0) {
    a.ajouter(colonne([[0, 0.02], [0.42, 0.014]], 3, 0, false, false), K.herbe);
    // Fleur : une corolle évasée de quatre pétales et un cœur
    const corolle = variante === 1 ? K.fleurBlanche : K.fleurJaune;
    a.ajouter(colonne([[0, 0.02], [0.05, 0.085]], 5, 0, false, true), corolle, placer(0, 0.41, 0), 0.05);
    a.ajouter(new THREE.OctahedronGeometry(0.03, 0), variante === 1 ? K.fleurJaune : K.lienFibres, placer(0, 0.47, 0), 0.04);
  }
  return a.terminer();
}

// --- Matériaux --------------------------------------------------------------------------------

/**
 * Matériau des grands éléments. Les InstancedMesh partagent un seul matériau : on ne peut pas
 * rendre un arbre transparent à lui seul. À la place, le shader perce un « trou » tramé
 * (un pixel sur quatre reste affiché) dans tout ce qui se trouve près de la ligne
 * caméra–personnage. Les ombres portées ne sont pas touchées.
 */
function creerMateriauGrand(uniformes: Record<string, THREE.IUniform>): THREE.Material {
  const materiau = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  materiau.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniformes);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vPosMondeDecor;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        vec4 posMondeDecor = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          posMondeDecor = instanceMatrix * posMondeDecor;
        #endif
        vPosMondeDecor = (modelMatrix * posMondeDecor).xyz;`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vPosMondeDecor;
        uniform vec3 uTrouCible;
        uniform float uTrouForce;
        uniform float uTrouRayon;
        uniform float uTrouOpacite;
        // Trame ordonnée 4 × 4 : seuils de 0 à 15/16 selon le pixel
        float trame2(vec2 a) { a = floor(a); return fract(a.x / 2.0 + a.y * a.y * 0.75); }
        float trame4(vec2 a) { return trame2(0.5 * a) * 0.25 + trame2(a); }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        if (uTrouForce > 0.001) {
          vec3 axeTrou = uTrouCible - cameraPosition;
          float longueurTrou = length(axeTrou);
          axeTrou /= max(longueurTrou, 0.0001);
          vec3 relTrou = vPosMondeDecor - cameraPosition;
          float tTrou = dot(relTrou, axeTrou);
          // Seulement entre la caméra et le personnage (pas ce qui est derrière lui)
          if (tTrou > 0.0 && tTrou < longueurTrou - 0.45) {
            float dTrou = length(relTrou - axeTrou * tTrou);
            float opaciteTrou = mix(uTrouOpacite, 1.0, smoothstep(uTrouRayon * 0.6, uTrouRayon, dTrou));
            opaciteTrou = mix(1.0, opaciteTrou, uTrouForce);
            if (opaciteTrou <= trame4(gl_FragCoord.xy)) discard;
          }
        }`,
      );
  };
  materiau.customProgramCacheKey = () => 'decor-trou';
  return materiau;
}

export function creerModelesDecor(): ModelesDecor {
  const T = CONFIG.cameras.transparence;
  const uniformes = {
    uTrouCible: { value: new THREE.Vector3() },
    uTrouForce: { value: 0 },
    uTrouRayon: { value: T.rayonTrou },
    uTrouOpacite: { value: T.opacite },
  };
  const materiauGrand = creerMateriauGrand(uniformes);
  const materiauPetit = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const materiauLumineux = new THREE.MeshBasicMaterial({ vertexColors: true });

  const fabriques: Record<TypeDecor, (variante: number) => THREE.BufferGeometry> = {
    'arbre-feuillu': arbreFeuillu,
    sapin,
    bouleau,
    rocher,
    'filon-fer': filonFer,
    'filon-cuivre': filonCuivre,
    'filon-charbon': filonCharbon,
    'cristal-bleu': cristalBleu,
    'buisson-baies': buissonBaies,
    'plante-medicinale': planteMedicinale,
    fibres,
    herbe,
  };
  // Les géométries sont construites à la première demande puis partagées par tous les chunks
  const cache = new Map<string, ModeleDecor>();

  return {
    modele(type, variante) {
      const cle = `${type}:${variante}`;
      let m = cache.get(cle);
      if (!m) {
        const infos = INFOS_DECOR[type];
        m = { geometrie: fabriques[type](variante), grand: infos.arbre || infos.rayonCollision > 0, lumineux: type === 'cristal-bleu' };
        cache.set(cle, m);
      }
      return m;
    },
    materiauGrand,
    materiauPetit,
    materiauLumineux,
    definirTrou(x, y, z, force) {
      uniformes.uTrouCible.value.set(x, y, z);
      uniformes.uTrouForce.value = force;
    },
    liberer() {
      for (const m of cache.values()) m.geometrie.dispose();
      cache.clear();
      materiauGrand.dispose();
      materiauPetit.dispose();
      materiauLumineux.dispose();
    },
  };
}
