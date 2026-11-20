// Maison de chaume après l'attaque des bandits : murs en partie effondrés et noircis, toit brûlé (il reste
// quelques chevrons calcinés), gravats et cendres ; la reconstruction a commencé (échafaudage, charpente
// neuve en bois clair, échelle, pile de planches). Modèle statique : ni feu, ni fumée, ni fenêtre éclairée.
// Même emprise (6 x 5 m) et même repère que la maison intacte de modelesVillage.ts : posée sur le sol, façade vers +z.

import * as THREE from 'three';
import type { Formes } from './modelesVillage';

const C = {
  mur: 0xf0d9a8,
  murNoirci: 0x77695a,
  murInterieur: 0x9c8b76,
  suie: 0x2b2623,
  calcine: 0x33291f,
  boisBrule: 0x58402c,
  boisNeuf: 0xecc888,
  boisNeufSombre: 0xd9b06c,
  pierre: 0x9a9299,
  pierreNoircie: 0x5e5753,
  cheminee: 0xe2c9a0,
  cendre: 0x8b8782,
  cendreSombre: 0x57524f,
  chaumeBrule: 0x5e4a26,
  porte: 0x8a5230,
  porteClaire: 0x9a5c34,
  vitreMorte: 0x22262c,
} as const;

type P3 = readonly [number, number, number];

function mat(x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, ex = 1, ey = 1, ez = 1): THREE.Matrix4 {
  return new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(ex, ey, ez),
  );
}

/** Une face plate à quatre coins (deux triangles), dans le repère donné par `m`. */
function face(c: Formes, couleur: number, m: THREE.Matrix4 | undefined, a: P3, b: P3, cc: P3, d: P3, variation = 0.05): void {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...cc, ...a, ...cc, ...d], 3));
  c.ajouter(g, couleur, m?.clone(), variation);
}

/** Boîte posée sur le sol, sans sa face du dessous (jamais vue) : (x, z) = centre, y = base. */
function pilier(c: Formes, l: number, h: number, p: number, couleur: number, x: number, y: number, z: number, variation = 0.05): void {
  const pleine = new THREE.BoxGeometry(l, h, p).toNonIndexed();
  const pos = pleine.getAttribute('position').array;
  // Faces d'une boîte three, dans l'ordre : +x, -x, +y, -y, +z, -z (6 sommets chacune)
  const garde = [...pos.slice(0, 54), ...pos.slice(72)];
  pleine.dispose();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(garde, 3));
  c.ajouter(g, couleur, mat(x, y + h / 2, z), variation);
}

/**
 * Mur en ruine : `profil` donne la hauteur du mur le long de sa longueur (t, hauteur), ce qui dessine une
 * crête irrégulière. Repère du mur : t le long du mur, face extérieure en z = 0, épaisseur vers -z.
 * Le haut de la face extérieure est noirci, la tranche du dessus est couverte de suie.
 */
function murRuine(c: Formes, m: THREE.Matrix4, profil: ReadonlyArray<readonly [number, number]>, y0 = 0.3, e = 0.3, bande = 0.5): void {
  const bout = (t: number, h: number) => face(c, C.murInterieur, m, [t, y0, -e], [t, y0, 0], [t, h, 0], [t, h, -e]);
  bout(profil[0][0], profil[0][1]);
  for (let i = 0; i + 1 < profil.length; i++) {
    const [t0, h0] = profil[i];
    const [t1, h1] = profil[i + 1];
    if (t0 === t1) {
      // Cassure verticale
      face(c, C.suie, m, [t0, h0, 0], [t0, h1, 0], [t0, h1, -e], [t0, h0, -e], 0.12);
      continue;
    }
    const b0 = Math.max(y0, h0 - bande);
    const b1 = Math.max(y0, h1 - bande);
    face(c, C.mur, m, [t0, y0, 0], [t1, y0, 0], [t1, b1, 0], [t0, b0, 0]);
    face(c, C.murNoirci, m, [t0, b0, 0], [t1, b1, 0], [t1, h1, 0], [t0, h0, 0], 0.1);
    face(c, C.murInterieur, m, [t1, y0, -e], [t0, y0, -e], [t0, h0, -e], [t1, h1, -e], 0.08);
    face(c, C.suie, m, [t0, h0, 0], [t1, h1, 0], [t1, h1, -e], [t0, h0, -e], 0.12);
  }
  const fin = profil[profil.length - 1];
  bout(fin[0], fin[1]);
}

/** Fenêtre morte : cadre brûlé, vitre noire (dans le corps du modèle : elle ne s'allume pas la nuit), halo de suie. */
function fenetreMorte(c: Formes, x: number, y: number, z: number, ry: number, traverse: boolean): void {
  const base = mat(x, y, z, 0, ry, 0);
  const en = (dx: number, dy: number, dz: number, rz = 0) => base.clone().multiply(mat(dx, dy, dz, 0, 0, rz));
  // Suie qui monte au-dessus de l'ouverture (plus large en haut)
  face(c, C.suie, base, [-0.62, 0.3, -0.005], [0.62, 0.3, -0.005], [0.85, 0.98, -0.005], [-0.8, 0.98, -0.005], 0.1);
  c.ajouter(new THREE.BoxGeometry(1.16, 1.16, 0.1), C.boisBrule, en(0, 0, 0), 0.1);
  face(c, C.vitreMorte, base, [-0.45, -0.45, 0.056], [0.45, -0.45, 0.056], [0.45, 0.45, 0.056], [-0.45, 0.45, 0.056], 0);
  c.ajouter(new THREE.BoxGeometry(1.35, 0.1, 0.22), C.boisBrule, en(0, -0.61, 0.08));
  // Un croisillon pend encore, de travers
  if (traverse) c.ajouter(new THREE.BoxGeometry(0.07, 0.95, 0.04), C.calcine, en(0.08, -0.02, 0.09, 0.5), 0.1);
}

/** La maison de chaume endommagée (tout va dans une seule géométrie : `c` est le corps du modèle). */
export function maisonEndommagee(c: Formes): void {
  const L = 6;
  const P = 5;
  const H = 2.6;
  // Faces extérieures des murs (comme la maison intacte)
  const X = L / 2 - 0.1;
  const Z = P / 2 - 0.1;

  // Soubassement de pierre, sol couvert de cendre
  pilier(c, L + 0.1, 0.35, P + 0.1, C.pierre, 0, 0, 0);
  face(c, C.cendreSombre, undefined, [-X + 0.3, 0.36, -Z + 0.3], [X - 0.3, 0.36, -Z + 0.3], [X - 0.3, 0.36, Z - 0.3], [-X + 0.3, 0.36, Z - 0.3], 0.08);

  // --- Murs : le coin avant droit est tombé, le pignon arrière tient encore à moitié ---
  // Façade (t = x) : à gauche de la porte, puis à droite jusqu'au coin effondré
  const facade = mat(0, 0, Z);
  murRuine(c, facade, [[-X, 2.6], [-2.2, 2.38], [-0.9, 2.5], [-0.4, 1.85], [0.2, 2.15]]);
  murRuine(c, facade, [[1.3, 2.0], [1.65, 1.3], [2.25, 1.05], [X, 0.6]]);
  // Mur droit (t = -z, le coin effondré est à t = -Z) : la fenêtre a disparu avec le haut du mur
  murRuine(c, mat(X, 0, 0, 0, Math.PI / 2), [[-Z, 0.6], [-1.6, 0.9], [-0.9, 1.7], [0, 1.4], [0.9, 2.3], [Z, 2.6]]);
  // Mur arrière et reste du pignon (t = -x)
  murRuine(c, mat(0, 0, -Z, 0, Math.PI), [[-X, 2.6], [-2.2, 3.35], [-1.3, 4.15], [-0.5, 4.7], [0.1, 4.3], [0.5, 3.55], [1.2, 3.3], [1.9, 2.85], [X, 2.6]]);
  // Mur gauche (t = z) : presque entier
  murRuine(c, mat(-X, 0, 0, 0, -Math.PI / 2), [[-Z, 2.6], [-1.0, 2.6], [-0.2, 2.34], [0.9, 2.6], [Z, 2.6]]);

  // Poteaux d'angle brûlés (celui du coin avant droit est tombé), sablières noircies à l'arrière et à gauche
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1]]) pilier(c, 0.36, H, 0.36, C.boisBrule, sx * (L / 2 - 0.13), 0, sz * (P / 2 - 0.13), 0.12);
  c.boite(L, 0.3, 0.14, C.calcine, 0, H - 0.3, -(P / 2 - 0.05));
  c.boite(0.14, 0.3, P, C.calcine, -(L / 2 - 0.05), H - 0.3, 0);

  // Fenêtres mortes (façade et mur gauche), suie le long de la porte
  fenetreMorte(c, -1.55, 1.5, P / 2 - 0.08, 0, true);
  fenetreMorte(c, -(L / 2 - 0.08), 1.5, -0.2, -Math.PI / 2, false);
  face(c, C.suie, undefined, [-0.2, 0.3, Z + 0.02], [0.2, 0.3, Z + 0.02], [0.2, 2.12, Z + 0.02], [-0.38, 1.9, Z + 0.02], 0.1);

  // Porte : montants brûlés, linteau descendu d'un côté, battant arraché qui pend de travers
  const zPorte = P / 2 - 0.05;
  for (const x of [0.1, 1.4]) pilier(c, 0.2, 1.95, 0.2, C.boisBrule, x, 0.3, zPorte, 0.12);
  c.barre(1.85, 0.24, 0.26, C.calcine, 0.75, 2.24, zPorte, 0, 0, -0.14);
  for (const [dx, couleur] of [[-0.24, C.porte], [0.24, C.porteClaire]] as const) {
    c.ajouter(new THREE.BoxGeometry(0.47, 1.8, 0.1), couleur, mat(0.5, 1.12, zPorte + 0.5, -0.1, -1.0, 0.16).multiply(mat(dx, 0, 0)));
  }

  // Cheminée encore debout, sans chapeau, le haut noirci
  pilier(c, 0.7, 4.0, 0.7, C.cheminee, 1.6, 0.3, -0.9);
  c.boite(0.74, 1.0, 0.74, C.pierreNoircie, 1.6, 4.25, -0.9);

  // --- Charpente brûlée : une ferme au pignon arrière, deux chevrons, un reste de chaume, une poutre tombée ---
  const hp = L / 2 + 0.45;
  const Ht = 2.9;
  const yT = H - 0.12;
  const angle = Math.atan2(Ht, hp);
  const pente = Math.hypot(hp, Ht);
  /** Chevron du côté `sx`, de la fraction f0 à f1 de la pente (0 = au mur, 1 = au faîte). */
  const chevron = (sx: number, z: number, f0: number, f1: number) => {
    const fm = (f0 + f1) / 2;
    c.barre((f1 - f0) * pente, 0.2, 0.17, C.calcine, sx * hp * (1 - fm), yT + Ht * fm + 0.1, z, 0, 0, -sx * angle);
  };
  const zFerme = -(Z - 0.42);
  chevron(-1, zFerme, 0.05, 1);
  chevron(1, zFerme, 0.05, 1);
  c.boite(0.2, yT + Ht - H, 0.16, C.calcine, 0, H, zFerme);
  c.boite(L - 0.2, 0.2, 0.18, C.calcine, 0, H - 0.1, zFerme);
  chevron(-1, -0.75, 0.05, 0.82);
  chevron(-1, 0.95, 0.05, 0.42);
  // Reste de chaume noirci sur le bas du pan gauche, à l'arrière
  c.ajouter(new THREE.BoxGeometry(0.38 * pente, 0.3, 1.5), C.chaumeBrule, mat(-hp * 0.8, yT + Ht * 0.2 + 0.34, -1.55, 0, 0, angle), 0.16);
  // Poutre tombée en travers : un bout par terre, l'autre sur le mur droit
  c.barre(5.3, 0.24, 0.24, C.calcine, 0.85, 1.1, 0.6, 0, 0.278, 0.203);

  // --- Gravats et cendres ---
  const tas = (r: number, h: number, couleur: number, x: number, y: number, z: number) =>
    c.ajouter(new THREE.ConeGeometry(r, h, 6, 1, true), couleur, mat(x, y + h / 2, z, 0, x * 2 + z), 0.1);
  tas(1.35, 0.6, C.cendre, 0.5, 0.36, 0.1);
  tas(0.95, 0.42, C.cendreSombre, -1.2, 0.36, -0.9);
  // Tas de gravats au pied du coin effondré
  tas(1.15, 0.34, C.cendre, 2.95, 0, 2.5);
  const pierres: ReadonlyArray<readonly [number, number, number, number, number]> = [
    // x, y, z, taille, couleur
    [3.45, 0.12, 1.5, 0.3, C.pierre],
    [2.3, 0.14, 3.05, 0.34, C.pierre],
    [3.5, 0.1, 3.0, 0.24, C.mur],
    [2.9, 0.36, 2.45, 0.3, C.mur],
    [1.9, 0.5, 1.4, 0.34, C.pierreNoircie],
    [0.2, 0.8, 0.3, 0.3, C.mur],
    [-3.3, 0.1, -1.6, 0.22, C.pierre],
    [-0.6, 0.12, 2.75, 0.2, C.pierre],
  ];
  pierres.forEach(([x, y, z, t, couleur], i) => {
    c.ajouter(new THREE.OctahedronGeometry(t, 0), couleur, mat(x, y, z, i * 0.9, i * 1.7, i * 0.5, 1.25, 0.6, 0.95), 0.1);
  });

  // --- Reconstruction commencée (bois neuf, clair) ---
  // Charpente neuve au coin effondré : poteau d'angle, sablière du mur droit, sablière de la façade
  pilier(c, 0.3, H, 0.3, C.boisNeuf, L / 2 - 0.13, 0, P / 2 - 0.13);
  c.boite(0.24, 0.24, P - 0.3, C.boisNeuf, L / 2 - 0.13, H - 0.24, 0);
  c.boite(L - 0.3, 0.24, 0.24, C.boisNeufSombre, 0, H - 0.24, P / 2 - 0.13);

  // Échafaudage contre le mur gauche : quatre perches, plancher, longerons, lisse, écharpe
  const xe0 = -X - 0.3;
  const xe1 = -X - 1.05;
  const ze0 = -0.4;
  const ze1 = 2.1;
  const zm = (ze0 + ze1) / 2;
  for (const x of [xe0, xe1]) {
    for (const z of [ze0, ze1]) pilier(c, 0.1, 3.1, 0.1, C.boisNeufSombre, x, 0, z);
    c.boite(0.08, 0.1, ze1 - ze0 + 0.3, C.boisNeufSombre, x, 1.58, zm);
  }
  c.boite(xe0 - xe1 + 0.2, 0.07, ze1 - ze0 + 0.2, C.boisNeuf, (xe0 + xe1) / 2, 1.68, zm);
  c.boite(0.07, 0.09, ze1 - ze0 + 0.3, C.boisNeufSombre, xe1, 2.7, zm);
  c.barre(0.07, Math.hypot(1.45, ze1 - ze0), 0.07, C.boisNeufSombre, xe1 - 0.08, 0.82, zm, Math.atan2(ze1 - ze0, 1.45));

  // Échelle posée contre la sablière neuve du mur droit
  const pied: P3 = [X + 0.9, 0, -1.3];
  const tete: P3 = [X + 0.08, 2.8, -1.3];
  const longueur = Math.hypot(tete[0] - pied[0], tete[1]);
  const inclinaison = Math.atan2(pied[0] - tete[0], tete[1]);
  for (const dz of [-0.22, 0.22]) {
    c.barre(0.07, longueur, 0.07, C.boisNeuf, (pied[0] + tete[0]) / 2, tete[1] / 2, pied[2] + dz, 0, 0, inclinaison);
  }
  for (const f of [0.2, 0.45, 0.7]) {
    c.barre(0.05, 0.05, 0.44, C.boisNeufSombre, pied[0] + (tete[0] - pied[0]) * f, tete[1] * f, pied[2], 0, 0, inclinaison);
  }

  // Pile de planches neuves devant la façade, sous la fenêtre (hors du sentier de la porte)
  const planches: ReadonlyArray<readonly [number, number, number, number]> = [
    // décalage en x, hauteur, décalage en z, rotation
    [0, 0, 0, 0],
    [0.05, 0.09, 0.02, 0.05],
    [-0.04, 0.18, -0.02, -0.04],
    [0.1, 0.27, 0.05, 0.12],
  ];
  planches.forEach(([dx, y, dz, ry], i) => {
    c.boite(1.9, 0.08, i === 3 ? 0.3 : 0.55, i % 2 ? C.boisNeufSombre : C.boisNeuf, -2.1 + dx, y, 2.95 + dz, ry);
  });
}
