// Cabane d'Aldric l'ermite, animaux de ferme (poule, mouton) et enclos des moutons : modèles low poly faits en code,
// d'après les images de docs/concepts/ (« Références low poly _ cochon et poule », « Vache et mouton en quatre vues »,
// « Petite ferme médiévale low poly », « chasseur et mage ermite »). Aucune règle de jeu ici.
// Repères : cabane et enclos posés sur le sol, origine au centre, porte ou barrière vers +z ;
// animaux : pieds à l'origine, regard vers +z (comme le personnage).
// Fluidité : chaque partie est une seule géométrie aux couleurs par sommet (cabane : 2 maillages, enclos : 1,
// poule et mouton : 6 chacun, pour les pattes, la tête et les ailes qui bougent).

import * as THREE from 'three';
import { creerAleatoire } from '../regles/aleatoire';
import { fuseauCouche } from './modelesEnnemis';
import { Formes, matrice } from './modelesVillage';
import { fuseau, galet } from './outils';

const K = {
  // Cabane
  rondin: 0x7d5636,
  rondinSombre: 0x6a472c,
  planche: 0x8a6240,
  boisSombre: 0x5a3c26,
  porte: 0x7a4f2e,
  porteClaire: 0x8b5c36,
  bardeau: 0x6b4a32,
  bardeauMousse: 0x66703a,
  mousse: 0x5f9440,
  mousseSombre: 0x47752f,
  pierre: 0x9a9299,
  pierreSombre: 0x6f6a70,
  fer: 0x4a474c,
  vitre: 0x2c3b52,
  os: 0xe8dfc8,
  or: 0xe8b93c,
  buche: 0x9a6a40,
  bucheSombre: 0x835834,
  bocalVert: 0x7fb08a,
  bocalViolet: 0x8a5fb0,
  bocalAmbre: 0xd09a3a,
  liege: 0xb08a5a,
  herbeSeche: 0xb5a04a,
  herbeVerte: 0x6f9a4a,
  lavande: 0x8a6bb5,
  lueur: 0x9fdcff,
  lueurEmise: 0x3f9dff,
  // Enclos
  cloture: 0xa86838,
  clotureSombre: 0x8a5230,
  clotureClaire: 0xc27c40,
  eau: 0x4a9ac8,
  foin: 0xe8c04a,
  foinSombre: 0xcda238,
  lien: 0x8a5a33,
  // Poule
  plume: 0xf3ead8,
  plumeBrune: 0x9a5c3a,
  plumeRousse: 0xc47a3e,
  plumeGrise: 0x5a5560,
  crete: 0xd9402a,
  bec: 0xe8a82c,
  oeil: 0x2a1c18,
  // Mouton
  laine: 0xf2e8d2,
  laineGrise: 0xb9ad9c,
  museau: 0x5c4a42,
  museauNoir: 0x3a302c,
} as const;

// Matériaux partagés par tous les modèles de ce fichier (jamais libérés : ils servent toute la partie)
let matDecor: THREE.MeshLambertMaterial | null = null;
let matAnimal: THREE.MeshLambertMaterial | null = null;
let matLueur: THREE.MeshLambertMaterial | null = null;

function materiauDecor(): THREE.MeshLambertMaterial {
  matDecor ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, side: THREE.DoubleSide });
  return matDecor;
}

function materiauAnimal(): THREE.MeshLambertMaterial {
  matAnimal ??= new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return matAnimal;
}

function materiauLueur(): THREE.MeshLambertMaterial {
  matLueur ??= new THREE.MeshLambertMaterial({ color: K.lueur, emissive: K.lueurEmise, emissiveIntensity: 1 });
  return matLueur;
}

function enMaille(f: Formes, materiau: THREE.Material, nom: string): THREE.Mesh {
  const m = new THREE.Mesh(f.terminer(), materiau);
  m.name = nom;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// --- Cabane d'Aldric --------------------------------------------------------------------------

/** Demi-emprise de la cabane d'Aldric (murs), en mètres : ce qui dépasse (toit, tas de bois, marche) reste à moins de 0,5 m. */
export const EMPRISE_CABANE_ALDRIC = { demiLargeur: 1.6, demiProfondeur: 1.3 } as const;

/**
 * Cabane de rondins de l'ermite : toit de bardeaux couvert de mousse, porte et petite fenêtre en façade (+z),
 * cheminée de pierre, tas de bois contre le mur droit, et quelques touches de mage : lanterne à lueur bleue,
 * bocaux sur la tablette, herbes qui sèchent, crâne de cerf au pignon, étoile peinte sur la porte.
 * Deux maillages : `corps` et `lueur` (verre de la lanterne et bocal bleu, lumineux sans éclairer).
 */
export function creerCabaneAldric(): THREE.Group {
  const alea = creerAleatoire(7301);
  const c = new Formes(alea);
  const lueur = new Formes(alea);
  const W = EMPRISE_CABANE_ALDRIC.demiLargeur;
  const D = EMPRISE_CABANE_ALDRIC.demiProfondeur;

  // Assise de pierre et pierres d'angle
  c.boite(2 * W - 0.1, 0.12, 2 * D - 0.1, K.pierreSombre, 0, 0, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) c.boite(0.46, 0.16, 0.46, K.pierre, sx * (W - 0.12), 0, sz * (D - 0.12), sx * sz * 0.2);

  // Murs de rondins empilés : un rang sur deux, les rondins de façade dépassent aux angles, puis ceux des côtés
  const e = 0.28;
  const hr = 0.32;
  const RANGS = 6;
  const yMur = 0.08;
  for (let r = 0; r < RANGS; r++) {
    const y = yMur + r * hr;
    const pair = r % 2 === 0;
    for (const s of [-1, 1]) {
      const teinte = (r + (s > 0 ? 1 : 0)) % 2 ? K.rondin : K.rondinSombre;
      c.boite(pair ? 2 * W + 0.3 : 2 * W - 2 * e + 0.04, hr, pair ? e : e - 0.05, teinte, 0, y, s * (D - e / 2));
      c.boite(pair ? e - 0.05 : e, hr, pair ? 2 * D - 2 * e + 0.04 : 2 * D + 0.3, teinte === K.rondin ? K.rondinSombre : K.rondin, s * (W - e / 2), y, 0);
    }
  }
  const H = yMur + RANGS * hr;

  // Toit : faîte le long de z, pignons de planches, trois rangs de bardeaux mangés par la mousse
  const hp = W + 0.35;
  const Ht = 1.3;
  const yT = H - 0.06;
  const angle = Math.atan2(Ht, hp);
  c.prisme(2 * D - 0.1, hp * 2, Ht, 2 * D - 0.1, K.planche, 0, yT, 0, Math.PI / 2);
  c.toit(2 * D + 0.8, hp, Ht, [K.bardeauMousse, K.bardeau, K.bardeauMousse], yT + 0.05, 0.13, 3, Math.PI / 2);
  c.boite(0.5, 0.16, 2 * D + 0.9, K.mousseSombre, 0, yT + Ht + 0.02, 0);
  // Coussins de mousse posés sur les pans : `cote` = pan (-1 ou 1), t = 0 au faîte, 1 à l'égout, lz = position le long du faîte
  const surToit = matrice(0, yT + 0.05, 0, 0, Math.PI / 2, 0);
  const mousses: ReadonlyArray<readonly [number, number, number, number, number]> = [
    [1, 0.3, -0.9, 0.9, 0.7],
    [1, 0.75, 0.5, 1.1, 0.6],
    [1, 0.5, 1.15, 0.6, 0.5],
    [-1, 0.4, 0.8, 1.0, 0.75],
    [-1, 0.8, -0.7, 1.2, 0.55],
    [-1, 0.25, -0.2, 0.6, 0.45],
  ];
  mousses.forEach(([cote, t, lz, longueur, largeur], i) => {
    c.ajouter(
      new THREE.BoxGeometry(longueur, 0.08, largeur),
      i % 2 ? K.mousse : K.mousseSombre,
      surToit.clone().multiply(matrice(-lz, Ht * (1 - t) + 0.12 + t * 0.07, cote * hp * t, cote * angle, 0, 0)),
      0.1,
    );
  });

  // Cheminée de pierre à l'arrière gauche
  c.boite(0.46, 1.75, 0.46, K.pierre, -0.85, H - 0.1, -0.55);
  c.boite(0.6, 0.12, 0.6, K.pierreSombre, -0.85, H + 1.65, -0.55);

  // --- Façade ---
  const zf = D;
  // Porte de planches, encadrement, poignée de fer, marche de pierre, étoile d'or peinte
  const xp = 0.42;
  for (let i = 0; i < 3; i++) c.boite(0.265, 1.68, 0.08, i % 2 ? K.porteClaire : K.porte, xp + (i - 1) * 0.27, 0.1, zf + 0.03);
  for (const s of [-1, 1]) c.boite(0.1, 1.74, 0.14, K.boisSombre, xp + s * 0.46, 0.1, zf + 0.03);
  c.boite(1.14, 0.12, 0.18, K.boisSombre, xp, 1.8, zf + 0.03);
  c.boite(0.05, 0.14, 0.05, K.fer, xp + 0.28, 0.92, zf + 0.09);
  c.boite(1.0, 0.1, 0.42, K.pierre, xp, 0, zf + 0.26, 0.05);
  const etoile = new THREE.OctahedronGeometry(0.1, 0);
  etoile.scale(0.75, 1.15, 0.15);
  c.ajouter(etoile, K.or, matrice(xp, 1.36, zf + 0.075), 0.04);

  // Petite fenêtre à croisillons, tablette et bocaux (celui du milieu luit)
  const xf = -0.85;
  c.boite(0.66, 0.66, 0.1, K.boisSombre, xf, 0.98, zf + 0.02);
  c.boite(0.5, 0.5, 0.04, K.vitre, xf, 1.06, zf + 0.065);
  c.boite(0.04, 0.5, 0.03, K.boisSombre, xf, 1.06, zf + 0.09);
  c.boite(0.5, 0.04, 0.03, K.boisSombre, xf, 1.29, zf + 0.09);
  c.boite(0.95, 0.05, 0.22, K.planche, xf, 0.86, zf + 0.11);
  const bocaux: ReadonlyArray<readonly [number, number, number, number]> = [
    [-0.32, 0.055, 0.15, K.bocalVert],
    [-0.02, 0.05, 0.12, K.lueur],
    [0.14, 0.04, 0.17, K.bocalViolet],
    [0.34, 0.06, 0.11, K.bocalAmbre],
  ];
  for (const [dx, rayon, hauteur, couleur] of bocaux) {
    (couleur === K.lueur ? lueur : c).cyl(rayon, rayon, hauteur, 6, couleur, xf + dx, 0.91 + hauteur / 2, zf + 0.13);
    c.boite(rayon * 1.3, 0.03, rayon * 1.3, K.liege, xf + dx, 0.91 + hauteur, zf + 0.13);
  }

  // Herbes qui sèchent, pendues à une ficelle sous l'avant-toit
  c.boite(1.25, 0.02, 0.02, K.liege, xf, 1.82, zf + 0.12);
  [K.herbeVerte, K.herbeSeche, K.lavande, K.herbeSeche].forEach((couleur, i) => {
    c.ajouter(new THREE.ConeGeometry(0.07, 0.24, 4), couleur, matrice(xf - 0.45 + i * 0.3, 1.7, zf + 0.12, 0, i * 0.8, 0), 0.1);
  });

  // Lanterne à lueur bleue pendue à une potence, à droite de la porte
  const xl = 1.3;
  const zl = zf + 0.26;
  c.boite(0.06, 0.06, 0.34, K.boisSombre, xl, 1.72, zf + 0.15);
  c.boite(0.02, 0.1, 0.02, K.fer, xl, 1.62, zl);
  c.boite(0.17, 0.04, 0.17, K.fer, xl, 1.58, zl);
  lueur.boite(0.12, 0.17, 0.12, K.lueur, xl, 1.41, zl);
  c.boite(0.17, 0.04, 0.17, K.fer, xl, 1.37, zl);

  // Crâne de cerf au pignon, au-dessus de la porte
  const zc = D + 0.0;
  c.boite(0.15, 0.17, 0.1, K.os, xp, 2.22, zc);
  c.boite(0.09, 0.15, 0.08, K.os, xp, 2.08, zc + 0.01);
  for (const s of [-1, 1]) {
    c.barre(0.035, 0.36, 0.035, K.os, xp + s * 0.17, 2.5, zc, 0, 0, -s * 0.55);
    c.barre(0.03, 0.16, 0.03, K.os, xp + s * 0.3, 2.56, zc, 0, 0, -s * 1.25);
  }

  // Tas de bois contre le mur droit, tenu par deux piquets
  const xb = W + 0.12;
  for (let rang = 0; rang < 3; rang++) {
    for (let k = 0; k < 2; k++) {
      const x = xb + k * 0.2 + (rang % 2) * 0.03;
      c.cyl(0.1, 0.1, 0.85 + ((rang + k) % 2) * 0.08, 6, (rang + k) % 2 ? K.buche : K.bucheSombre, x, 0.1 + rang * 0.18, -0.25, Math.PI / 2);
    }
  }
  for (const z of [-0.6, 0.1]) c.boite(0.05, 0.62, 0.05, K.boisSombre, xb + 0.36, 0, z);

  const groupe = new THREE.Group();
  groupe.name = 'cabane-aldric';
  groupe.add(enMaille(c, materiauDecor(), 'corps'));
  const verre = enMaille(lueur, materiauLueur(), 'lueur');
  verre.castShadow = false;
  groupe.add(verre);
  return groupe;
}

// --- Enclos des moutons -----------------------------------------------------------------------

/** Dimensions de l'enclos (axe des poteaux), en mètres ; la barrière est au milieu du côté +z. */
export const EMPRISE_ENCLOS = { demiLargeur: 3.5, demiProfondeur: 2.5, largeurBarriere: 1.4 } as const;

/** Enclos de 7 x 5 m : poteaux et deux lisses, barrière fermée au milieu du côté +z, auge pleine d'eau, botte et tas de foin. Un seul maillage. */
export function creerEnclos(): THREE.Group {
  const alea = creerAleatoire(7302);
  const c = new Formes(alea);
  const W = EMPRISE_ENCLOS.demiLargeur;
  const D = EMPRISE_ENCLOS.demiProfondeur;
  const B = EMPRISE_ENCLOS.largeurBarriere / 2;

  const poteau = (x: number, z: number, gros = false) => {
    const l = gros ? 0.18 : 0.14;
    c.boite(l, gros ? 1.2 : 1.08 + alea.entre(-0.04, 0.04), l, K.clotureSombre, x, 0, z, alea.entre(-0.15, 0.15));
  };
  // Lisses d'un tronçon : deux planches à peine de travers
  const lisses = (x1: number, z1: number, x2: number, z2: number) => {
    const longueur = Math.hypot(x2 - x1, z2 - z1) + 0.1;
    const ry = Math.atan2(-(z2 - z1), x2 - x1);
    for (const y of [0.42, 0.82]) {
      c.barre(longueur, 0.11, 0.05, y > 0.5 ? K.cloture : K.clotureClaire, (x1 + x2) / 2, y + alea.entre(-0.02, 0.02), (z1 + z2) / 2, 0, ry, alea.entre(-0.012, 0.012));
    }
  };
  // Tour de l'enclos : arrière, côtés, puis l'avant de part et d'autre de la barrière
  for (const x of [-W, -W / 2, 0, W / 2, W]) poteau(x, -D, Math.abs(x) === W);
  for (const x of [-W, -W / 2, W / 2, W]) poteau(x, D, Math.abs(x) === W);
  for (const s of [-1, 1]) {
    for (const z of [-D / 3, D / 3]) poteau(s * W, z);
    poteau(s * B, D, true);
    lisses(s * W, -D, s * W, D);
    lisses(s * W, D, s * B, D);
  }
  lisses(-W, -D, W, -D);

  // Barrière fermée : deux montants, deux traverses, une écharpe, loquet de fer
  const lb = 2 * B - 0.24;
  for (const s of [-1, 1]) c.boite(0.08, 0.8, 0.06, K.clotureClaire, s * (lb / 2 - 0.04), 0.16, D);
  for (const y of [0.24, 0.8]) c.boite(lb, 0.1, 0.05, K.clotureClaire, 0, y, D + 0.01);
  c.barre(Math.hypot(lb - 0.16, 0.5), 0.09, 0.04, K.cloture, 0, 0.57, D + 0.02, 0, 0, Math.atan2(0.5, lb - 0.16));
  c.boite(0.16, 0.05, 0.05, K.fer, B - 0.1, 0.62, D + 0.05);

  // Auge de planches pleine d'eau, dans le coin arrière gauche
  const xa = -W + 1.3;
  const za = -D + 0.75;
  for (const s of [-1, 1]) {
    c.boite(1.5, 0.36, 0.07, K.clotureSombre, xa, 0.06, za + s * 0.26);
    c.boite(0.07, 0.36, 0.52, K.cloture, xa + s * 0.72, 0.06, za);
    c.boite(0.1, 0.14, 0.62, K.clotureSombre, xa + s * 0.5, 0, za);
  }
  c.boite(1.4, 0.26, 0.46, K.eau, xa, 0.08, za);

  // Botte de foin liée et tas de foin en vrac, dans le coin arrière droit
  const xh = W - 1.1;
  const zh = -D + 0.8;
  c.boite(1.0, 0.5, 0.6, K.foin, xh, 0, zh, 0.25);
  for (const d of [-0.27, 0.27]) c.boite(0.07, 0.52, 0.62, K.lien, xh + d * Math.cos(0.25), 0, zh - d * Math.sin(0.25), 0.25);
  c.ajouter(new THREE.ConeGeometry(0.7, 0.42, 7, 1, true), K.foinSombre, matrice(xh - 1.25, 0.21, zh + 0.25), 0.1);
  c.ajouter(new THREE.ConeGeometry(0.4, 0.3, 6, 1, true), K.foin, matrice(xh - 0.75, 0.15, zh + 0.85, 0, 0.5, 0), 0.1);

  const groupe = new THREE.Group();
  groupe.name = 'enclos';
  groupe.add(enMaille(c, materiauDecor(), 'corps'));
  return groupe;
}

// --- Animaux de ferme -------------------------------------------------------------------------

export interface PoseAnimalFerme {
  /** Vitesse de déplacement en m/s : au-dessus de zéro, l'animal marche */
  vitesse: number;
  /** À l'arrêt : la poule picore, le mouton broute */
  activite: boolean;
}

export interface AnimalFerme {
  /** À placer et à orienter par l'appelant : pieds à l'origine, regard vers +z */
  objet: THREE.Group;
  animer(dt: number, pose: PoseAnimalFerme): void;
  liberer(): void;
}

function liberer(objet: THREE.Object3D): void {
  objet.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).geometry.dispose();
  });
}

/** Rapproche `valeur` de `cible` (lissage indépendant du nombre d'images par seconde). */
function vers(valeur: number, cible: number, dt: number, rapidite: number): number {
  return valeur + (cible - valeur) * (1 - Math.exp(-dt * rapidite));
}

let rangAnimal = 0;

// Poule : [corps, ailes et queue, bout de la queue]
const ROBES_POULE: ReadonlyArray<readonly [number, number, number]> = [
  [K.plume, K.plumeBrune, K.plume],
  [K.plumeRousse, K.plumeBrune, K.plumeBrune],
  [K.plumeGrise, K.plumeGrise, K.plume],
];

/**
 * Poule (environ 45 cm) : marche en hochant la tête, picore quand `activite` est vrai, bat des ailes de temps en temps.
 * `variante` : 0 blanche aux ailes brunes, 1 rousse, 2 grise.
 */
export function creerPoule(variante = 0): AnimalFerme {
  const [robe, aile, boutQueue] = ROBES_POULE[((variante % ROBES_POULE.length) + ROBES_POULE.length) % ROBES_POULE.length];
  const rang = rangAnimal++;
  const alea = creerAleatoire(7400 + variante);
  const mat = materiauAnimal();
  const objet = new THREE.Group();
  objet.name = 'poule';
  const tout = new THREE.Group();
  tout.scale.setScalar(0.92);
  objet.add(tout);

  // Tronc : pivot aux hanches (il bascule vers l'avant pour picorer)
  const HANCHE = 0.2;
  const fTronc = new Formes(alea);
  fTronc.ajouter(
    fuseauCouche([
      { z: -0.14, rx: 0.045, ry: 0.055, dy: 0.035 },
      { z: -0.07, rx: 0.1, ry: 0.105 },
      { z: 0.03, rx: 0.108, ry: 0.118 },
      { z: 0.1, rx: 0.085, ry: 0.1, dy: 0.025 },
      { z: 0.155, rx: 0.045, ry: 0.06, dy: 0.065 },
    ]),
    robe,
  );
  fTronc.barre(0.075, 0.1, 0.11, aile, 0, 0.07, -0.135, -0.7);
  fTronc.barre(0.055, 0.06, 0.08, boutQueue, 0, 0.125, -0.19, -0.7);
  const tronc = enMaille(fTronc, mat, 'tronc');
  tronc.position.y = HANCHE;
  tout.add(tronc);

  const ailes = [-1, 1].map((s) => {
    const f = new Formes(alea);
    f.ajouter(galet(0.03, 0.075, 0.105), aile, matrice(s * 0.012, -0.04, -0.015, 0.25));
    const m = enMaille(f, mat, s < 0 ? 'aile-d' : 'aile-g');
    m.position.set(s * 0.1, 0.06, 0.01);
    tronc.add(m);
    return m;
  });

  // Cou et tête : pivot à la base du cou
  const fTete = new Formes(alea);
  fTete.ajouter(
    fuseau([
      { y: -0.02, rx: 0.05, rz: 0.05 },
      { y: 0.08, rx: 0.052, rz: 0.058, dz: 0.012 },
      { y: 0.15, rx: 0.05, rz: 0.055, dz: 0.018 },
      { y: 0.195, rx: 0.028, rz: 0.034, dz: 0.016 },
    ]),
    robe,
  );
  fTete.ajouter(new THREE.ConeGeometry(0.024, 0.06, 4), K.bec, matrice(0, 0.135, 0.09, Math.PI / 2), 0.03);
  fTete.boite(0.022, 0.05, 0.075, K.crete, 0, 0.185, 0.015);
  fTete.boite(0.02, 0.035, 0.035, K.crete, 0, 0.225, 0.02);
  fTete.boite(0.026, 0.045, 0.022, K.crete, 0, 0.065, 0.068);
  for (const s of [-1, 1]) fTete.ajouter(new THREE.TetrahedronGeometry(0.014, 0), K.oeil, matrice(s * 0.05, 0.145, 0.045), 0);
  const tete = enMaille(fTete, mat, 'tete');
  tete.position.set(0, 0.07, 0.1);
  tronc.add(tete);

  const pattes = [-1, 1].map((s) => {
    const f = new Formes(alea);
    f.cyl(0.012, 0.012, 0.11, 4, K.bec, 0, -0.055, 0);
    f.boite(0.055, 0.014, 0.075, K.bec, 0, -0.118, 0.015);
    const m = enMaille(f, mat, 'patte');
    m.position.set(s * 0.05, 0.118, 0);
    tout.add(m);
    return m;
  });

  let phase = rang * 1.3;
  let temps = rang * 0.7;
  let kMarche = 0;
  let picore = 0;
  let battement = 0;
  let avantBattement = 3 + ((rang * 7) % 5);
  return {
    objet,
    animer(dt, pose) {
      temps += dt;
      const marche = pose.vitesse > 0.02;
      kMarche = vers(kMarche, marche ? 1 : 0, dt, 10);
      if (marche) phase += dt * (5 + pose.vitesse * 14);

      // Picorer : deux coups de bec rapides, puis la tête se relève un instant
      const u = temps % 2.1;
      const cible = !marche && pose.activite && u < 0.9 ? Math.max(0, Math.sin((u / 0.45) * Math.PI * 2 - 0.4)) ** 0.5 : 0;
      picore = vers(picore, cible, dt, 16);

      // Battement d'ailes, de temps en temps (jamais en picorant)
      avantBattement -= dt;
      if (avantBattement <= 0 && picore < 0.1) {
        battement = 0.7;
        avantBattement = 6 + ((rang * 5 + Math.floor(temps)) % 7);
      }
      battement = Math.max(0, battement - dt);
      const kBat = Math.sin(Math.min(1, battement / 0.7) * Math.PI);
      const ouverture = kBat * (0.85 + 0.5 * Math.sin(temps * 38));

      const pas = Math.sin(phase);
      pattes[0].rotation.x = pas * 0.7 * kMarche;
      pattes[1].rotation.x = -pas * 0.7 * kMarche;
      tronc.position.y = HANCHE + Math.abs(pas) * 0.012 * kMarche - picore * 0.035 + kBat * 0.02;
      tronc.rotation.x = picore * 0.95 - kBat * 0.18;
      tronc.rotation.z = pas * 0.05 * kMarche;
      // La tête avance et recule à chaque pas ; au repos elle regarde à droite et à gauche
      tete.position.z = 0.1 + Math.sin(phase * 2) * 0.018 * kMarche;
      tete.rotation.x = picore * 0.75;
      tete.rotation.y = (1 - kMarche) * (1 - picore) * Math.sin(temps * 0.9 + rang) * 0.45;
      ailes[0].rotation.z = -ouverture * 1.1;
      ailes[1].rotation.z = ouverture * 1.1;
    },
    liberer() {
      liberer(objet);
    },
  };
}

// Mouton : [laine, museau et pattes]
const ROBES_MOUTON: ReadonlyArray<readonly [number, number]> = [
  [K.laine, K.museau],
  [K.laineGrise, K.museauNoir],
];

/**
 * Mouton (environ 80 cm à la tête, 1 m de long) : marche d'un pas tranquille, broute tête baissée quand `activite` est vrai.
 * `variante` : 0 laine crème, 1 laine grise.
 */
export function creerMouton(variante = 0): AnimalFerme {
  const [laine, museau] = ROBES_MOUTON[((variante % ROBES_MOUTON.length) + ROBES_MOUTON.length) % ROBES_MOUTON.length];
  const rang = rangAnimal++;
  const alea = creerAleatoire(7500 + variante);
  const mat = materiauAnimal();
  const objet = new THREE.Group();
  objet.name = 'mouton';

  const HAUTEUR = 0.5;
  const fTronc = new Formes(alea);
  fTronc.ajouter(
    fuseauCouche([
      { z: -0.4, rx: 0.14, ry: 0.15 },
      { z: -0.27, rx: 0.25, ry: 0.245 },
      { z: -0.02, rx: 0.28, ry: 0.265, dy: 0.01 },
      { z: 0.22, rx: 0.25, ry: 0.25, dy: 0.015 },
      { z: 0.36, rx: 0.15, ry: 0.17, dy: 0.04 },
    ]),
    laine,
  );
  // Boucles de laine sur le dos, petite queue
  fTronc.ajouter(galet(0.2, 0.1, 0.2), laine, matrice(0.04, 0.2, -0.16, 0, 0.4, 0));
  fTronc.ajouter(galet(0.18, 0.1, 0.17), laine, matrice(-0.04, 0.21, 0.13, 0, 1.1, 0));
  fTronc.ajouter(galet(0.06, 0.08, 0.05), laine, matrice(0, 0.04, -0.42));
  const tronc = enMaille(fTronc, mat, 'tronc');
  tronc.position.y = HAUTEUR;
  objet.add(tronc);

  // Cou laineux et tête sombre : pivot à la base du cou
  const fTete = new Formes(alea);
  fTete.ajouter(galet(0.14, 0.15, 0.15), laine, matrice(0, 0.07, 0.07, 0, 0.6, 0));
  fTete.ajouter(
    fuseauCouche([
      { z: 0.1, rx: 0.09, ry: 0.1, dy: 0.12 },
      { z: 0.2, rx: 0.098, ry: 0.105, dy: 0.1 },
      { z: 0.3, rx: 0.07, ry: 0.075, dy: 0.06 },
      { z: 0.365, rx: 0.045, ry: 0.045, dy: 0.04 },
    ]),
    museau,
  );
  fTete.ajouter(galet(0.105, 0.07, 0.1), laine, matrice(0, 0.22, 0.14, 0, 0.3, 0));
  for (const s of [-1, 1]) {
    fTete.barre(0.11, 0.028, 0.065, museau, s * 0.145, 0.13, 0.13, 0, 0, -s * 0.45);
    fTete.ajouter(new THREE.TetrahedronGeometry(0.016, 0), 0x1c1614, matrice(s * 0.088, 0.135, 0.25), 0);
  }
  const tete = enMaille(fTete, mat, 'tete');
  tete.position.set(0, 0.1, 0.3);
  tronc.add(tete);

  // Pattes : [x, z], dans l'ordre avant gauche, avant droite, arrière gauche, arrière droite
  const LONGUEUR_PATTE = 0.32;
  const pattes = [
    [0.14, 0.22],
    [-0.14, 0.22],
    [0.14, -0.24],
    [-0.14, -0.24],
  ].map(([x, z]) => {
    const f = new Formes(alea);
    f.boite(0.085, LONGUEUR_PATTE, 0.085, museau, 0, -LONGUEUR_PATTE, 0);
    const m = enMaille(f, mat, 'patte');
    m.position.set(x, LONGUEUR_PATTE, z);
    objet.add(m);
    return m;
  });

  let phase = rang * 1.1;
  let temps = rang * 0.9;
  let kMarche = 0;
  let broute = 0;
  return {
    objet,
    animer(dt, pose) {
      temps += dt;
      const marche = pose.vitesse > 0.02;
      kMarche = vers(kMarche, marche ? 1 : 0, dt, 8);
      if (marche) phase += dt * (3 + pose.vitesse * 6);
      broute = vers(broute, !marche && pose.activite ? 1 : 0, dt, 3.5);

      const pas = Math.sin(phase);
      // Pattes en diagonale : avant gauche avec arrière droite
      pattes[0].rotation.x = pas * 0.42 * kMarche;
      pattes[3].rotation.x = pas * 0.42 * kMarche;
      pattes[1].rotation.x = -pas * 0.42 * kMarche;
      pattes[2].rotation.x = -pas * 0.42 * kMarche;
      tronc.position.y = HAUTEUR + Math.abs(Math.cos(phase)) * 0.014 * kMarche;
      tronc.rotation.x = broute * 0.1;
      tronc.rotation.z = pas * 0.025 * kMarche;
      // Tête baissée pour brouter, avec un petit mouvement de mâchoire ; sinon elle regarde autour d'elle
      tete.rotation.x = broute * (1.35 + Math.sin(temps * 7) * 0.05) + Math.sin(phase * 2) * 0.04 * kMarche;
      tete.position.y = 0.1 - broute * 0.16;
      tete.rotation.y = (1 - kMarche) * (1 - broute) * Math.sin(temps * 0.6 + rang * 2) * 0.4 + broute * Math.sin(temps * 0.8 + rang) * 0.12;
    },
    liberer() {
      liberer(objet);
    },
  };
}
