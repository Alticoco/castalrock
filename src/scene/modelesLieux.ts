// Modèles des lieux de l'histoire, en code, d'après les images concept (docs/concepts) : le camp des bandits
// (palissade de pieux, tentes, feu, caisses, tour de guet) et les ruines de la forteresse de Castalrock, avec au
// centre de leur cour le Cœur de Castal : un cristal géant dans son berceau de pierre (« Éclat brisé, cœur de cristal »).
// Le plan vient de src/regles/lieux.ts (positions dans le monde) : aucune règle de jeu ici.
// Aucune lumière : le feu et les cristaux brillent par leur matériau (émissif) et par des voiles en couleur additive,
// le nombre de lumières de la scène ne change donc jamais.

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { PlanAutel, PlanCamp, Pose } from '../regles/lieux';
import { creerModelesRuines, type ModeleCoffre } from './modelesRuines';
import { boite, creerMateriau, maille } from './outils';

const K = CONFIG.lieux.couleurs;

/** Nombre pseudo-aléatoire stable (0 à 1) tiré d'un rang : petites variations de taille et d'angle, sans Math.random(). */
function variation(i: number, sel = 0): number {
  const v = Math.sin(i * 12.9898 + sel * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

function groupeEn(p: Pose, y: number): THREE.Group {
  const g = new THREE.Group();
  g.position.set(p.x, y, p.z);
  g.rotation.y = p.orientation;
  return g;
}

function liberer(objet: THREE.Object3D, materiaux: THREE.Material[]): void {
  objet.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
  for (const m of materiaux) m.dispose();
}

// --- Camp des bandits -------------------------------------------------------------------------

export interface ModeleCamp {
  readonly objet: THREE.Group;
  /** Coffres de butin, par identifiant (`definirOuverture` : couvercle de 0 fermé à 1 ouvert) */
  readonly coffres: ReadonlyMap<string, ModeleCoffre>;
  /** Anime les flammes du feu central. */
  mettreAJour(dt: number): void;
  liberer(): void;
}

export function creerModeleCamp(plan: PlanCamp): ModeleCamp {
  const C = CONFIG.lieux.camp;
  const y = plan.lieu.y;
  const objet = new THREE.Group();
  objet.name = 'camp-bandits';
  const mat = {
    pieu: creerMateriau(K.pieu),
    pointe: creerMateriau(K.pieuPointe),
    toile: creerMateriau(K.toile, true),
    toileSombre: creerMateriau(K.toileSombre, true),
    ombre: creerMateriau(0x241812),
    bois: creerMateriau(K.bois),
    boisClair: creerMateriau(K.boisClair),
    fer: creerMateriau(K.fer),
    pierre: creerMateriau(K.pierre),
    drapeau: creerMateriau(K.drapeau, true),
    terre: creerMateriau(0xa9713f),
  };
  const matBraise = new THREE.MeshBasicMaterial({ color: K.braise });
  const matFlammes = [K.feuRouge, K.braise, K.feuVif].map((c) => new THREE.MeshBasicMaterial({ color: c }));

  // Sol de terre battue, juste au-dessus du terrain aplani
  mat.terre.polygonOffset = true;
  mat.terre.polygonOffsetFactor = -2;
  mat.terre.polygonOffsetUnits = -2;
  const sol = new THREE.Mesh(new THREE.CircleGeometry(C.rayonPalissade - 0.4, 20).rotateX(-Math.PI / 2), mat.terre);
  sol.position.set(plan.lieu.x, y + 0.03, plan.lieu.z);
  sol.receiveShadow = true;
  objet.add(sol);

  // Palissade : un fût et une pointe par pieu, en deux maillages instanciés (deux appels de dessin pour tout le cercle)
  const futs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.27, 0.31, 2.3, 6).translate(0, 1.15, 0), mat.pieu, plan.pieux.length);
  const pointes = new THREE.InstancedMesh(new THREE.ConeGeometry(0.28, 0.55, 6).translate(0, 2.3 + 0.275, 0), mat.pointe, plan.pieux.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  plan.pieux.forEach((p, i) => {
    const haut = 0.9 + variation(i) * 0.22;
    e.set((variation(i, 1) - 0.5) * 0.08, p.orientation + variation(i, 2), (variation(i, 3) - 0.5) * 0.08);
    m.compose(v.set(p.x, y - 0.1, p.z), q.setFromEuler(e), s.set(1, haut, 1));
    futs.setMatrixAt(i, m);
    pointes.setMatrixAt(i, m);
  });
  for (const im of [futs, pointes]) {
    im.castShadow = true;
    im.instanceMatrix.needsUpdate = true;
    // Les pieux font le tour du camp : la boîte englobante d'un seul pieu ne suffit pas pour décider de les dessiner
    im.frustumCulled = false;
    objet.add(im);
  }

  // Porte : deux gros poteaux, une traverse, et les deux vantaux ouverts vers l'extérieur
  const [gauche, droite] = plan.poteaux;
  for (const p of plan.poteaux) {
    const poteau = groupeEn(p, y);
    poteau.add(boite(0.55, 3.3, 0.55, mat.bois, 0, 1.65, 0));
    poteau.add(maille(new THREE.ConeGeometry(0.42, 0.5, 4).rotateY(Math.PI / 4), mat.pointe, 0, 3.55, 0));
    objet.add(poteau);
  }
  const largeur = Math.hypot(gauche.x - droite.x, gauche.z - droite.z);
  const traverse = boite(largeur + 0.7, 0.3, 0.3, mat.bois, (gauche.x + droite.x) / 2, y + 2.95, (gauche.z + droite.z) / 2);
  traverse.rotation.y = plan.lieu.acces;
  objet.add(traverse);
  [gauche, droite].forEach((p, i) => {
    const cote = i === 0 ? 1 : -1;
    const vantail = new THREE.Group();
    vantail.position.set(p.x, y, p.z);
    // Ouvert aux trois quarts vers l'extérieur
    vantail.rotation.y = plan.lieu.acces + cote * 1.15;
    const demi = largeur / 2 - 0.35;
    vantail.add(boite(demi, 2.1, 0.12, mat.boisClair, (-cote * demi) / 2, 1.15, 0.3));
    vantail.add(boite(demi, 0.14, 0.16, mat.bois, (-cote * demi) / 2, 0.55, 0.3));
    vantail.add(boite(demi, 0.14, 0.16, mat.bois, (-cote * demi) / 2, 1.75, 0.3));
    objet.add(vantail);
  });

  // Tentes : prisme de toile ouvert devant, deux perches croisées au faîte, une pièce cousue sur le flanc
  const profil = new THREE.Shape();
  profil.moveTo(-1.75, 0);
  profil.lineTo(0, 2.35);
  profil.lineTo(1.75, 0);
  profil.closePath();
  const geoToile = new THREE.ExtrudeGeometry(profil, { depth: 4.1, bevelEnabled: false }).translate(0, 0, -2.05);
  const entree = new THREE.Shape();
  entree.moveTo(-0.95, 0);
  entree.lineTo(0, 1.6);
  entree.lineTo(0.95, 0);
  entree.closePath();
  const geoEntree = new THREE.ShapeGeometry(entree);
  plan.tentes.forEach((t, i) => {
    const tente = groupeEn(t, y);
    tente.add(maille(geoToile, i % 2 === 0 ? mat.toile : mat.toileSombre));
    tente.add(maille(geoEntree, mat.ombre, 0, 0, 2.06));
    for (const z of [2.0, -2.0]) {
      for (const cote of [-1, 1]) {
        const perche = boite(0.1, 1.1, 0.1, mat.bois, cote * 0.12, 2.5, z);
        perche.rotation.z = cote * 0.62;
        tente.add(perche);
      }
    }
    const piece = boite(0.7, 0.55, 0.04, i % 2 === 0 ? mat.toileSombre : mat.toile, 1.03, 1.0, 0.6);
    piece.rotation.set(0, Math.PI / 2, 0);
    piece.rotation.z = 0.64;
    tente.add(piece);
    objet.add(tente);
  });

  // Feu central : cercle de pierres, bûches, braises, trois langues de flammes (matériaux non éclairés, sans lumière)
  const feu = groupeEn(plan.feu, y);
  feu.scale.setScalar(1.5);
  const geoPierre = new THREE.IcosahedronGeometry(0.2, 0);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const pierre = maille(geoPierre, mat.pierre, Math.sin(a) * 0.6, 0.1, Math.cos(a) * 0.6);
    pierre.rotation.y = a * 1.7;
    feu.add(pierre);
  }
  for (const a of [0.3, 1.4, 2.5]) {
    const buche = boite(0.95, 0.14, 0.14, mat.bois, 0, 0.12, 0);
    buche.rotation.set(0, a, 0.12);
    feu.add(buche);
  }
  const braises = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.08, 7), matBraise);
  braises.position.y = 0.06;
  feu.add(braises);
  const geoFlamme = new THREE.ConeGeometry(0.22, 0.75, 5, 1).translate(0, 0.375, 0);
  const langues: ReadonlyArray<readonly [number, number, number, number]> = [
    [0, 0, 1.3, 1.1],
    [0.1, 0.06, 0.95, 1.4],
    [-0.05, -0.04, 0.6, 1.0],
  ];
  const flammes = langues.map(([dx, dz, large, haut], i) => {
    const langue = new THREE.Mesh(geoFlamme, matFlammes[i]);
    langue.position.set(dx, 0.1, dz);
    langue.scale.set(large, haut, large);
    feu.add(langue);
    return { langue, haut };
  });
  objet.add(feu);

  // Tour de guet : quatre pieds, une plate-forme à garde-corps, un toit à quatre pans, une échelle
  const tour = groupeEn(plan.tour, y);
  for (const cx of [-1, 1]) {
    for (const cz of [-1, 1]) {
      tour.add(boite(0.2, 3.2, 0.2, mat.bois, cx * 0.95, 1.6, cz * 0.95));
      tour.add(boite(0.14, 1.5, 0.14, mat.bois, cx * 1.0, 4.05, cz * 1.0));
    }
    const croix = boite(0.1, 2.9, 0.1, mat.boisClair, cx * 0.95, 1.55, 0);
    croix.rotation.x = cx * 0.62;
    tour.add(croix);
  }
  tour.add(boite(2.4, 0.16, 2.4, mat.boisClair, 0, 3.25, 0));
  for (const [lx, lz, lr] of [[0, 1.1, 0], [0, -1.1, 0], [1.1, 0, Math.PI / 2], [-1.1, 0, Math.PI / 2]] as const) {
    const garde = boite(2.3, 0.55, 0.1, mat.bois, lx, 3.65, lz);
    garde.rotation.y = lr;
    tour.add(garde);
  }
  tour.add(maille(new THREE.ConeGeometry(2.0, 1.1, 4).rotateY(Math.PI / 4), mat.toileSombre, 0, 5.35, 0));
  const echelle = new THREE.Group();
  echelle.position.set(0, 0, 1.75);
  echelle.rotation.x = -0.2;
  for (const cx of [-1, 1]) echelle.add(boite(0.09, 3.5, 0.09, mat.boisClair, cx * 0.32, 1.7, 0));
  for (let i = 0; i < 6; i++) echelle.add(boite(0.64, 0.07, 0.07, mat.boisClair, 0, 0.45 + i * 0.55, 0));
  tour.add(echelle);
  objet.add(tour);

  // Caisses et tonneaux
  const geoTonneau = new THREE.CylinderGeometry(0.4, 0.4, 0.95, 8);
  const geoVentre = new THREE.CylinderGeometry(0.46, 0.46, 0.5, 8);
  const geoCercle = new THREE.CylinderGeometry(0.47, 0.47, 0.07, 8);
  for (const c of plan.caisses) {
    const g = groupeEn(c, y);
    if (c.type === 'caisse') {
      g.add(boite(0.85, 0.85, 0.85, mat.boisClair, 0, 0.425, 0));
      g.add(boite(0.9, 0.12, 0.9, mat.bois, 0, 0.8, 0));
      g.add(boite(0.9, 0.12, 0.9, mat.bois, 0, 0.08, 0));
    } else {
      g.add(maille(geoTonneau, mat.bois, 0, 0.475, 0));
      g.add(maille(geoVentre, mat.bois, 0, 0.475, 0));
      g.add(maille(geoCercle, mat.fer, 0, 0.26, 0));
      g.add(maille(geoCercle, mat.fer, 0, 0.7, 0));
    }
    objet.add(g);
  }

  // Râtelier d'armes : deux chevalets, une barre, deux lances et deux épées
  const ratelier = groupeEn(plan.ratelier, y);
  for (const cx of [-1, 1]) {
    for (const cz of [-1, 1]) {
      const pied = boite(0.09, 1.5, 0.09, mat.bois, cx * 0.75, 0.7, cz * 0.22);
      pied.rotation.x = -cz * 0.3;
      ratelier.add(pied);
    }
  }
  ratelier.add(boite(1.7, 0.09, 0.09, mat.bois, 0, 1.32, 0));
  for (const lx of [-0.5, -0.25]) {
    ratelier.add(boite(0.05, 2.1, 0.05, mat.boisClair, lx, 1.05, 0.12));
    ratelier.add(maille(new THREE.ConeGeometry(0.07, 0.3, 4), mat.fer, lx, 2.25, 0.12));
  }
  for (const lx of [0.2, 0.48]) {
    ratelier.add(boite(0.07, 1.0, 0.03, mat.fer, lx, 0.75, 0.12));
    ratelier.add(boite(0.24, 0.05, 0.05, mat.bois, lx, 1.27, 0.12));
  }
  objet.add(ratelier);

  // Mât et drapeau sombre
  const drapeau = groupeEn(plan.drapeau, y);
  drapeau.add(maille(new THREE.CylinderGeometry(0.06, 0.08, 6.2, 6), mat.bois, 0, 3.1, 0));
  drapeau.add(boite(1.9, 1.15, 0.04, mat.drapeau, 0.98, 5.45, 0));
  objet.add(drapeau);

  // Coffres de butin (même modèle que les coffres de ruine), tournés vers le feu
  const modelesCoffre = creerModelesRuines();
  const coffres = new Map<string, ModeleCoffre>();
  for (const c of plan.coffres) {
    const coffre = modelesCoffre.creerCoffre();
    coffre.objet.position.set(c.x, y, c.z);
    coffre.objet.rotation.y = c.orientation;
    objet.add(coffre.objet);
    coffres.set(c.id, coffre);
  }

  let temps = 0;
  return {
    objet,
    coffres,
    mettreAJour(dt) {
      temps += dt;
      flammes.forEach(({ langue, haut }, i) => {
        const t = temps * (7 + i * 2.3) + i;
        langue.scale.y = haut * (1 + 0.22 * Math.sin(t) + 0.1 * Math.sin(t * 2.7));
        langue.rotation.y = temps * (1.5 + i);
      });
    },
    liberer() {
      modelesCoffre.liberer();
      liberer(objet, [...Object.values(mat), matBraise, ...matFlammes]);
    },
  };
}

// --- Ruines de Castalrock et Cœur de Castal ------------------------------------------------------

export interface ModeleAutel {
  readonly objet: THREE.Group;
  /**
   * Montre le Cœur brisé (terne, fendu, une encoche à l'épaule, posé dans son berceau) ou reforgé (entier, lumineux,
   * flottant, des éclats qui tournent autour). `anime` : joue l'effet de la reforge (l'éclat reprend sa place, le
   * cristal s'élève dans un halo), sinon l'état est posé tout de suite.
   */
  definirReforge(reforge: boolean, anime: boolean): void;
  mettreAJour(dt: number): void;
  liberer(): void;
}

/** Cristal à six pans, pointu aux deux bouts (pied à l'origine). */
function geometrieCristal(rayon: number, hauteur: number): THREE.BufferGeometry {
  const points = [
    new THREE.Vector2(0.001, 0),
    new THREE.Vector2(rayon * 0.72, hauteur * 0.14),
    new THREE.Vector2(rayon, hauteur * 0.62),
    new THREE.Vector2(0.001, hauteur),
  ];
  return new THREE.LatheGeometry(points, 6);
}

function materiauCristal(couleur: number, intensite: number): THREE.MeshStandardMaterial {
  const m = creerMateriau(couleur);
  m.roughness = 0.35;
  m.emissive = new THREE.Color(couleur);
  m.emissiveIntensity = intensite;
  return m;
}

/**
 * Fond tous les maillages d'un objet en un maillage par matériau (les pièces d'origine sont libérées) : le berceau de
 * pierre ne coûte ainsi que deux commandes de dessin.
 */
function fondreParMateriau(source: THREE.Object3D): THREE.Group {
  source.updateMatrixWorld(true);
  const parMateriau = new Map<THREE.Material, number[]>();
  source.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    const g: THREE.BufferGeometry = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(o.matrixWorld);
    const positions = parMateriau.get(o.material as THREE.Material) ?? [];
    parMateriau.set(o.material as THREE.Material, positions);
    const p = g.getAttribute('position').array;
    for (let i = 0; i < p.length; i++) positions.push(p[i]);
    g.dispose();
    o.geometry.dispose();
  });
  const groupe = new THREE.Group();
  for (const [materiau, positions] of parMateriau) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.computeVertexNormals();
    const m = new THREE.Mesh(g, materiau);
    m.castShadow = true;
    m.receiveShadow = true;
    groupe.add(m);
  }
  return groupe;
}

interface GeometriesCoeur {
  /** Le cristal, sans les faces de l'encoche */
  corps: THREE.BufferGeometry;
  /** Les faces de l'encoche : la cassure, plus claire */
  cassure: THREE.BufferGeometry;
  /** Le morceau qui comble l'encoche (centré sur lui-même : à poser en `placeMorceau`) */
  morceau: THREE.BufferGeometry;
  placeMorceau: THREE.Vector3;
  /** Fêlures : fines bandes posées sur les facettes */
  fissures: THREE.BufferGeometry;
}

/**
 * Le Cœur de Castal : un grand cristal à facettes irrégulières (pied à l'origine), pas un cœur. Une de ses épaules est
 * entaillée jusqu'au milieu du cristal : c'est l'encoche laissée par l'Éclat du Cœur. Le morceau manquant est le volume entre la forme entière et
 * la forme ébréchée : remis en place, le cristal est de nouveau entier.
 */
function geometriesCoeur(R: number, H: number): GeometriesCoeur {
  const P: THREE.Vector3[] = [new THREE.Vector3(0, 0, 0)];
  const anneau = (y: number, r: number, decalage: number, sel: number): number => {
    const debut = P.length;
    for (let k = 0; k < 6; k++) {
      const a = ((k + decalage) * Math.PI) / 3;
      const rr = r * (0.88 + 0.24 * variation(k, sel));
      P.push(new THREE.Vector3(Math.sin(a) * rr, y * (0.96 + 0.08 * variation(k, sel + 1)), Math.cos(a) * rr));
    }
    return debut;
  };
  const A = anneau(H * 0.15, R * 0.6, 0.15, 11);
  const B = anneau(H * 0.56, R, 0.15, 13);
  const C = anneau(H * 0.83, R * 0.56, 0.65, 15);
  const pointe = P.length;
  P.push(new THREE.Vector3(R * 0.1, H, -R * 0.06));

  const triangles: Array<[number, number, number]> = [];
  for (let k = 0; k < 6; k++) {
    const k1 = (k + 1) % 6;
    triangles.push([0, A + k, A + k1], [A + k, A + k1, B + k1], [A + k, B + k1, B + k], [B + k, B + k1, C + k], [C + k, B + k1, C + k1], [C + k, C + k1, pointe]);
  }
  // Toutes les faces regardent vers l'extérieur
  const centre = new THREE.Vector3(0, H * 0.5, 0);
  const n = new THREE.Vector3();
  const ab = new THREE.Vector3();
  const ac = new THREE.Vector3();
  const normale = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a)).normalize();
  for (const t of triangles) {
    const g = new THREE.Vector3().add(P[t[0]]).add(P[t[1]]).add(P[t[2]]).divideScalar(3);
    if (normale(P[t[0]], P[t[1]], P[t[2]]).dot(g.sub(centre)) < 0) [t[1], t[2]] = [t[2], t[1]];
  }

  // L'encoche : un sommet de l'épaule, du côté de la porte, est enfoncé jusqu'au cœur du cristal
  const creux = C;
  const enfonce = new THREE.Vector3(P[creux].x * 0.12, H * 0.5, P[creux].z * 0.12);
  const point = (i: number) => (i === creux ? enfonce : P[i]);
  const corps: number[] = [];
  const cassure: number[] = [];
  const morceau: number[] = [];
  for (const t of triangles) {
    for (const i of t) (t.includes(creux) ? cassure : corps).push(...point(i).toArray());
    if (!t.includes(creux)) continue;
    // Peau du dehors (forme entière), puis peau du dedans retournée (forme ébréchée) : le morceau est un volume fermé
    for (const i of t) morceau.push(...P[i].toArray());
    for (const i of [t[0], t[2], t[1]]) morceau.push(...point(i).toArray());
  }
  const geoCorps = new THREE.BufferGeometry();
  geoCorps.setAttribute('position', new THREE.Float32BufferAttribute(corps, 3));
  geoCorps.computeVertexNormals();
  const geoCassure = new THREE.BufferGeometry();
  geoCassure.setAttribute('position', new THREE.Float32BufferAttribute(cassure, 3));
  geoCassure.computeVertexNormals();
  const geoMorceau = new THREE.BufferGeometry();
  geoMorceau.setAttribute('position', new THREE.Float32BufferAttribute(morceau, 3));
  geoMorceau.computeBoundingBox();
  const placeMorceau = geoMorceau.boundingBox!.getCenter(new THREE.Vector3());
  geoMorceau.translate(-placeMorceau.x, -placeMorceau.y, -placeMorceau.z);
  geoMorceau.computeVertexNormals();

  // Fêlures : lignes brisées qui descendent de l'encoche et d'une autre arête, chaque segment à plat sur une facette
  const bandes: number[] = [];
  const cote = new THREE.Vector3();
  const segment = (u: THREE.Vector3, v: THREE.Vector3, face: readonly [number, number, number], largeur: number) => {
    normale(point(face[0]), point(face[1]), point(face[2]));
    const g = new THREE.Vector3().add(point(face[0])).add(point(face[1])).add(point(face[2])).divideScalar(3);
    if (n.dot(g.sub(centre)) < 0) n.negate();
    cote.crossVectors(n, ab.subVectors(v, u)).normalize().multiplyScalar(largeur / 2);
    const leve = n.clone().multiplyScalar(0.02);
    const [u0, u1, v0, v1] = [u.clone().sub(cote).add(leve), u.clone().add(cote).add(leve), v.clone().sub(cote).add(leve), v.clone().add(cote).add(leve)];
    for (const p of [u0, u1, v1, u0, v1, v0]) bandes.push(p.x, p.y, p.z);
  };
  const entre = (i: number, j: number, t: number) => P[i].clone().lerp(P[j], t);
  const feler = (k: number, depart: THREE.Vector3, t1: number, t2: number, t3: number) => {
    const k1 = (k + 1) % 6;
    const p = entre(A + k, B + k1, t1);
    const q = entre(A + k, A + k1, t2);
    segment(depart, p, [A + k, B + k1, B + k], 0.13);
    segment(p, q, [A + k, A + k1, B + k1], 0.1);
    segment(q, q.clone().lerp(P[0], t3), [0, A + k, A + k1], 0.07);
    segment(p, entre(A + k1, B + k1, 0.4), [A + k, A + k1, B + k1], 0.07);
  };
  feler(0, entre(B, B + 1, 0.5), 0.55, 0.6, 0.6);
  feler(3, P[B + 3].clone(), 0.42, 0.35, 0.45);
  segment(entre(B, B + 1, 0.5), entre(B, B + 1, 0.5).lerp(enfonce, 0.75), [B, B + 1, C], 0.1);
  const geoFissures = new THREE.BufferGeometry();
  geoFissures.setAttribute('position', new THREE.Float32BufferAttribute(bandes, 3));

  return { corps: geoCorps, cassure: geoCassure, morceau: geoMorceau, placeMorceau, fissures: geoFissures };
}

/** Départ vif, arrivée douce, de 0 à 1. */
function adoucir(t: number): number {
  const k = Math.min(1, Math.max(0, t));
  return 1 - Math.pow(1 - k, 3);
}

export function creerModeleAutel(plan: PlanAutel, hauteurTerrain?: (x: number, z: number) => number): ModeleAutel {
  const A = CONFIG.lieux.autel;
  const X = A.cristal;
  const y = plan.lieu.y;
  const objet = new THREE.Group();
  objet.name = 'ruines-castalrock';
  const centre = new THREE.Group();
  centre.position.set(plan.lieu.x, y, plan.lieu.z);
  centre.rotation.y = plan.lieu.acces;
  objet.add(centre);

  // --- Les ruines : toutes les pierres fondues en une seule géométrie (comme un site de ruines du décor) ---
  const ruines = creerModelesRuines();
  // Habillage (mousse, herbes) : la hauteur du terrain au pied de chaque pierre, dans le repère du lieu (tourné de `acces`)
  const cosA = Math.cos(plan.lieu.acces);
  const sinA = Math.sin(plan.lieu.acces);
  const sol = hauteurTerrain
    ? (x: number, z: number) => hauteurTerrain(plan.lieu.x + x * cosA + z * sinA, plan.lieu.z - x * sinA + z * cosA) - y
    : undefined;
  const geoRuines = ruines.geometries(plan.blocs, sol);
  const murs = new THREE.Mesh(geoRuines.solide, ruines.materiau);
  murs.castShadow = true;
  murs.receiveShadow = true;
  centre.add(murs);

  const mat = {
    pierre: creerMateriau(K.pierre),
    pierreSombre: creerMateriau(K.pierreSombre),
  };
  const couleurEteinte = new THREE.Color(K.cristalEteint);
  const couleurVive = new THREE.Color(K.cristal);
  const couleurFissure = new THREE.Color(K.fissure);
  const couleurClaire = new THREE.Color(K.cristalClair);
  const matCoeur = materiauCristal(K.cristalEteint, 0.1);
  const matCassure = materiauCristal(K.cristalCassure, 0.18);
  const matPetits = materiauCristal(K.cristal, 0.15);
  const matFissures = new THREE.MeshBasicMaterial({ color: K.fissure, side: THREE.DoubleSide });
  const additif = (cote: THREE.Side = THREE.DoubleSide) =>
    new THREE.MeshBasicMaterial({ color: K.cristalClair, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: cote });
  const matHalo = additif();
  const matSol = additif();
  const matOnde = additif();
  const matRayon = additif();
  const matAura = additif(THREE.BackSide);

  // --- Le berceau : grand socle à huit pans, un losange gravé sur quatre faces, quatre bras de pierre (deux cassés) ---
  const R = plan.rayonBerceau;
  const HAUT_BERCEAU = 2.34;
  const brut = new THREE.Group();
  const pan = (haut: number, bas: number, h: number, materiau: THREE.Material, yc: number) =>
    brut.add(maille(new THREE.CylinderGeometry(haut, bas, h, 8).rotateY(Math.PI / 8), materiau, 0, yc, 0));
  pan(R * 0.92, R * 0.98, 0.5, mat.pierreSombre, 0.25);
  pan(R * 0.75, R * 0.83, 1.2, mat.pierre, 1.1);
  pan(R * 0.83, R * 0.8, 0.5, mat.pierreSombre, 1.95);
  pan(R * 0.75, R * 0.83, 0.14, mat.pierre, 2.27);
  const apotheme = R * 0.79 * Math.cos(Math.PI / 8);
  const fruit = Math.atan((R * 0.08 * Math.cos(Math.PI / 8)) / 1.2);
  // Chaque bras : des tronçons de pierre qui montent en se refermant sur le cristal (angle vers l'intérieur, longueur, section)
  const TRONCONS: ReadonlyArray<readonly [number, number, number, number]> = [
    [-0.12, 2.7, 0.95, 1.05],
    [0.4, 2.3, 0.8, 0.9],
    [0.95, 1.6, 0.6, 0.7],
  ];
  const ENTIERS = [3, 2, 3, 1];
  for (let f = 0; f < 8; f++) {
    const face = new THREE.Group();
    face.rotation.y = (f * Math.PI) / 4;
    brut.add(face);
    if (f % 2 === 0) {
      // Losange gravé : cadre en relief, cœur sombre en creux
      const cadre = boite(0.95, 0.95, 0.16, mat.pierreSombre, 0, 1.1, apotheme);
      cadre.rotation.set(-fruit, 0, Math.PI / 4);
      const creux = boite(0.5, 0.5, 0.2, mat.pierre, 0, 1.1, apotheme);
      creux.rotation.copy(cadre.rotation);
      face.add(cadre, creux);
      continue;
    }
    // Faces en biais : un contrefort, d'où part un bras
    const contrefort = boite(1.2, 1.3, 0.5, mat.pierreSombre, 0, 1.1, apotheme);
    contrefort.rotation.x = -fruit;
    face.add(contrefort);
    let py = 0.3;
    let pz = R * 0.87;
    const bras = (f - 1) / 2;
    TRONCONS.slice(0, ENTIERS[bras]).forEach(([angle, longueur, large, profond], i, liste) => {
      const dernierCasse = i === liste.length - 1 && liste.length < 3;
      const l = dernierCasse ? longueur * 0.6 : longueur;
      const troncon = boite(large, l, profond, i === 1 ? mat.pierreSombre : mat.pierre, 0, py + (Math.cos(angle) * l) / 2, pz - (Math.sin(angle) * l) / 2);
      troncon.rotation.set(-angle, 0, dernierCasse ? 0.08 : 0);
      face.add(troncon);
      py += Math.cos(angle) * l;
      pz -= Math.sin(angle) * l;
    });
    // Le bout d'un bras cassé gît au pied du berceau
    if (ENTIERS[bras] < 3) {
      const morceauTombe = boite(0.7, 1.5, 0.8, mat.pierre, 0.9, 0.4, R + 1.5);
      morceauTombe.rotation.set(1.35, 0.5 + bras, 0.2);
      face.add(morceauTombe);
    }
  }
  centre.add(fondreParMateriau(brut));

  // --- Le Cœur de Castal ---
  const geo = geometriesCoeur(X.rayon, X.hauteur);
  const coeur = new THREE.Group();
  const corps = maille(geo.corps, matCoeur);
  // La cassure reste en place : une fois le morceau revenu, il la recouvre
  const cassure = maille(geo.cassure, matCassure);
  const morceau = maille(geo.morceau, matCoeur);
  const fissures = new THREE.Mesh(geo.fissures, matFissures);
  // Aura : une coque un peu plus large, vue de l'intérieur, en couleur additive (aucune lumière)
  const aura = new THREE.Mesh(geometrieCristal(X.rayon * 1.25, X.hauteur * 1.06).translate(0, -X.hauteur * 0.03, 0), matAura);
  coeur.add(corps, cassure, morceau, fissures, aura);
  centre.add(coeur);
  // D'où l'éclat revient pendant la reforge : du côté de l'encoche, en hauteur
  const departMorceau = new THREE.Vector3(geo.placeMorceau.x * 4.5, geo.placeMorceau.y + 2.5, geo.placeMorceau.z * 4.5);

  // Éclats qui tournent autour du Cœur reforgé
  const geoEclat = geometrieCristal(0.2, 0.85).translate(0, -0.42, 0);
  const eclats = Array.from({ length: X.eclats }, (_, i) => {
    const e = new THREE.Mesh(geoEclat, matPetits);
    e.rotation.set(variation(i, 3) * 0.8, 0, variation(i, 4) * 0.8 - 0.4);
    centre.add(e);
    return e;
  });

  // Lueur sur le dessus du berceau et au sol, onde et rayon de la reforge (non éclairés, additifs)
  const halo = new THREE.Mesh(new THREE.CircleGeometry(R * 0.66, 8).rotateX(-Math.PI / 2), matHalo);
  halo.position.y = HAUT_BERCEAU + 0.02;
  const lueurSol = new THREE.Mesh(new THREE.RingGeometry(R + 0.1, R + 5.5, 32).rotateX(-Math.PI / 2), matSol);
  lueurSol.position.y = 0.24;
  const onde = new THREE.Mesh(new THREE.RingGeometry(0.86, 1, 40).rotateX(-Math.PI / 2), matOnde);
  onde.position.y = 0.3;
  const rayon = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.6, 60, 8, 1, true).translate(0, 30, 0), matRayon);
  centre.add(halo, lueurSol, onde, rayon);

  // Petits cristaux qui poussent autour du berceau (un seul maillage)
  const formesPetits: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [0, 0, 0.34, 1.5, 0],
    [0.42, 0.1, 0.24, 1.0, 0.35],
    [-0.3, 0.3, 0.2, 0.8, -0.4],
  ];
  const touffes = new THREE.Group();
  for (const p of plan.petitsCristaux) {
    const g = groupeEn(p, y - 0.1);
    for (const [dx, dz, r, h, penche] of formesPetits) {
      const cristal = maille(geometrieCristal(r, h), matPetits, dx, 0, dz);
      cristal.rotation.z = penche;
      g.add(cristal);
    }
    touffes.add(g);
  }
  objet.add(fondreParMateriau(touffes));

  let reforge = false;
  // Secondes écoulées depuis le début de l'effet de reforge (Infinity : aucun effet en cours)
  let depuisReforge = Infinity;
  let temps = 0;
  let tour = 0;

  function appliquer(): void {
    const k = reforge ? Math.min(1, depuisReforge / A.dureeReforge) : 0;
    // L'éclat revient dans l'encoche, puis le cristal se redresse, s'élève et s'allume
    const pose = adoucir(k / 0.4);
    const leve = adoucir((k - 0.35) / 0.65);
    const battement = 0.5 + 0.5 * Math.sin(temps * A.vitesseBattement);
    const eclair = reforge && k < 1 ? Math.sin(k * Math.PI) : 0;

    morceau.visible = reforge;
    morceau.position.lerpVectors(departMorceau, geo.placeMorceau, pose);
    morceau.scale.setScalar(0.3 + 0.7 * pose);
    morceau.rotation.set((1 - pose) * 2, (1 - pose) * 4, 0);

    const flotte = X.piedFlotte + X.flottement * Math.sin(temps * X.vitesseFlottement);
    coeur.position.y = X.piedRepos + (flotte - X.piedRepos) * leve;
    coeur.rotation.set(0, tour, 0.07 * (1 - leve));
    matCoeur.color.lerpColors(couleurEteinte, couleurVive, leve);
    matCoeur.emissive.copy(matCoeur.color);
    matCoeur.emissiveIntensity = 0.1 + (0.58 + 0.4 * battement) * leve + 1.4 * eclair;
    matCoeur.roughness = 0.6 - 0.3 * leve;
    // Les fêlures, sombres sur le cristal brisé, deviennent des veines de lumière
    matFissures.color.lerpColors(couleurFissure, couleurClaire, leve);
    aura.visible = leve > 0;
    matAura.opacity = leve * (0.1 + 0.1 * battement) + 0.25 * eclair;

    const grandit = adoucir((leve - 0.5) * 2);
    eclats.forEach((e, i) => {
      e.visible = grandit > 0;
      if (!e.visible) return;
      const a = temps * 0.3 + (i * Math.PI * 2) / eclats.length;
      const d = X.rayon + 1.0 + 0.35 * Math.sin(i * 1.7);
      e.position.set(Math.sin(a) * d, coeur.position.y + X.hauteur * (0.46 + 0.4 * variation(i, 9)) + 0.3 * Math.sin(temps * 0.7 + i * 2.1), Math.cos(a) * d);
      e.rotation.y = temps * (0.4 + 0.2 * variation(i, 5));
      e.scale.setScalar(grandit * (0.8 + 0.6 * variation(i, 6)));
    });

    matPetits.emissiveIntensity = 0.15 + (0.5 + 0.35 * battement) * leve + eclair;
    matHalo.opacity = 0.04 + (0.3 + 0.2 * battement) * leve + 0.4 * eclair;
    matSol.opacity = (0.05 + 0.04 * battement) * leve + 0.2 * eclair;
    // Onde qui s'élargit dans la cour et rayon vers le ciel, seulement pendant l'effet
    const enCours = reforge && k < 1;
    onde.visible = enCours;
    rayon.visible = enCours;
    if (enCours) {
      const r = 2 + k * plan.rayonEnceinte;
      onde.scale.set(r, 1, r);
      matOnde.opacity = 0.8 * (1 - k);
      matRayon.opacity = 0.4 * Math.sin(k * Math.PI);
      rayon.scale.set(1 + k, 1, 1 + k);
    }
  }
  appliquer();

  return {
    objet,
    definirReforge(v, anime) {
      reforge = v;
      depuisReforge = v && anime ? 0 : Infinity;
      appliquer();
    },
    mettreAJour(dt) {
      temps += dt;
      if (depuisReforge < A.dureeReforge) depuisReforge = Math.min(A.dureeReforge, depuisReforge + dt);
      // Reforgé, le cristal tourne très lentement sur lui-même
      if (reforge && depuisReforge >= A.dureeReforge) tour += dt * 0.12;
      appliquer();
    },
    liberer() {
      liberer(objet, [...Object.values(mat), matCoeur, matCassure, matPetits, matFissures, matHalo, matSol, matOnde, matRayon, matAura]);
      geoRuines.lumineux?.dispose();
      ruines.liberer();
    },
  };
}
