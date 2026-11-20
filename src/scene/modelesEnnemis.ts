// Modèles des ennemis, en code, d'après les images concept (docs/concepts) : slime vert gélatineux en
// forme de goutte, gobelin aux grandes oreilles avec son gourdin, loup gris qui bondit pour mordre,
// bandit encapuchonné armé d'une dague, et leur chef Morvan le Balafré avec sa grande hache. Animations procédurales : déplacement, anticipation, attaque,
// coup reçu (flash blanc), mort. Aucune règle de jeu ici : la pose vient de
// src/regles/combat.ts. Repère : pieds à l'origine, l'avant regarde +z (comme le personnage).

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { PhaseEnnemi } from '../regles/combat';
import { boite, creerMateriau, fuseau, galet, maille, type Anneau } from './outils';

/** Types qui ont un modèle. */
export type TypeModeleEnnemi = 'slime' | 'gobelin' | 'loup' | 'bandit';

export function aUnModele(type: string): type is TypeModeleEnnemi {
  return type === 'slime' || type === 'gobelin' || type === 'loup' || type === 'bandit';
}

export interface PoseEnnemi {
  x: number;
  y: number;
  z: number;
  orientation: number;
  phase: PhaseEnnemi;
  /** Secondes passées dans la phase */
  tempsPhase: number;
  /** Avancement du bond (0 à 1), -1 au sol */
  saut: number;
  /** Avancement de l'anticipation (0 à 1) */
  anticipation: number;
  /** Vrai s'il s'est déplacé depuis la dernière image */
  enMouvement: boolean;
}

export interface ModeleEnnemi {
  objet: THREE.Group;
  /** Hauteur où placer la barre de vie, au-dessus des pieds, en mètres */
  readonly hauteur: number;
  mettreAJour(dt: number, pose: PoseEnnemi): void;
  /** Flash blanc bref (coup reçu). */
  flash(): void;
  liberer(): void;
}

export const COULEURS_ENNEMIS = {
  slime: 0x7be05a,
  slimeLueur: 0x2f8a22,
  peauGobelin: 0x9ab84a,
  peauGobelinSombre: 0x86a53e,
  tunique: 0x7d5233,
  piece: 0xc98a3c,
  short: 0x67452e,
  ceinture: 0x8a5a33,
  bottes: 0x7a4a2a,
  gourdin: 0x94562c,
  oeil: 0xf2e6b0,
  sombre: 0x2c2118,
  // Loup
  poil: 0x8d8b8f,
  poilSombre: 0x65646b,
  poilClair: 0xdccfb9,
  truffe: 0x25201f,
  oeilLoup: 0xe59a25,
  croc: 0xf6f1e4,
  gueule: 0x6b2b2b,
  // Bandit
  capuche: 0x4b4245,
  foulard: 0x38333a,
  gilet: 0x7b4a2d,
  chemise: 0xc8a779,
  pantalon: 0x5b4a41,
  bottesBandit: 0x7a4b2c,
  cuirBandit: 0x57341f,
  peauBandit: 0xf2a36e,
  sourcilBandit: 0x3c2618,
  acier: 0xb9bcc2,
  boucle: 0x9c978b,
  plastronBandit: 0x69402a,
  cuirBanditClair: 0xa3703f,
  sacoche: 0x8f6a3e,
  // Morvan le Balafré
  cuirMorvan: 0x7a4630,
  cuirMorvanSombre: 0x5c3423,
  plastron: 0x5d5d63,
  capeMorvan: 0x7a2530,
  capeMorvanSombre: 0x5e1c26,
  pantalonMorvan: 0x3a302e,
  peauMorvan: 0xe09a68,
  barbe: 0x5a3a26,
  balafre: 0xb5543f,
  ferHache: 0x77797f,
  ferSombre: 0x55565d,
  ferNoir: 0x3b3c42,
  rivet: 0x94969c,
  cuirMorvanClair: 0x9a6038,
  ceintureMorvan: 0x47291c,
} as const;

const DUREE_FLASH = 0.16;
const DUREE_MORT = CONFIG.combat.dureeMortEnnemi;
const BLANC = new THREE.Color(0xffffff);

/** Gère le flash blanc et le fondu de mort d'un jeu de matériaux propres à un ennemi. */
export function creerTeinte(materiaux: THREE.MeshStandardMaterial[]) {
  const bases = materiaux.map((m) => ({
    emissive: m.emissive.clone(),
    intensite: m.emissiveIntensity,
    opacite: m.opacity,
    transparent: m.transparent,
  }));
  let flash = 0;
  let fondu = false;
  return {
    flash(): void {
      flash = 1;
    },
    /** `disparition` : 0 = visible, 1 = disparu */
    mettreAJour(dt: number, disparition: number): void {
      flash = Math.max(0, flash - dt / DUREE_FLASH);
      if (disparition > 0 && !fondu) {
        fondu = true;
        for (const m of materiaux) {
          m.transparent = true;
          m.needsUpdate = true;
        }
      }
      materiaux.forEach((m, i) => {
        const b = bases[i];
        m.emissive.copy(b.emissive).lerp(BLANC, flash);
        m.emissiveIntensity = b.intensite + (0.85 - b.intensite) * flash;
        m.opacity = b.opacite * (1 - disparition);
      });
    },
    liberer(): void {
      for (const m of materiaux) m.dispose();
    },
  };
}

export function libererGeometries(objet: THREE.Object3D): void {
  objet.traverse((o) => {
    if (o instanceof THREE.Mesh) o.geometry.dispose();
  });
}

export const adoucir = (t: number) => t * t * (3 - 2 * t);
export const borner = (v: number) => Math.max(0, Math.min(1, v));

// --- Slime ------------------------------------------------------------------------------------

/** Goutte facettée à 8 côtés, pointe recourbée vers l'arrière. Base à y = 0, hauteur ≈ 0,95 m. */
function geometrieSlime(): THREE.BufferGeometry {
  const profil: Array<[number, number]> = [
    [0, 0],
    [0.44, 0],
    [0.57, 0.13],
    [0.56, 0.36],
    [0.43, 0.57],
    [0.25, 0.72],
    [0.11, 0.84],
    [0, 0.95],
  ];
  const g = new THREE.LatheGeometry(
    profil.map(([r, y]) => new THREE.Vector2(r, y)),
    8,
  );
  // Une face plate (et non une arête) regarde vers l'avant
  g.rotateY(Math.PI / 8);
  // Pointe recourbée vers l'arrière et un peu sur le côté
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    if (y <= 0.55) continue;
    const t = (y - 0.55) / 0.4;
    p.setZ(i, p.getZ(i) - t * t * 0.2);
    p.setX(i, p.getX(i) + t * t * 0.08);
    p.setY(i, y - t * t * 0.05);
  }
  g.computeVertexNormals();
  return g;
}

function creerSlime(): ModeleEnnemi {
  const objet = new THREE.Group();
  const corps = new THREE.Group();
  objet.add(corps);

  const gelee = new THREE.MeshStandardMaterial({
    color: COULEURS_ENNEMIS.slime,
    flatShading: true,
    roughness: 0.35,
    metalness: 0,
    transparent: true,
    opacity: 0.84,
    emissive: COULEURS_ENNEMIS.slimeLueur,
    emissiveIntensity: 0.35,
  });
  const noir = creerMateriau(COULEURS_ENNEMIS.sombre);
  corps.add(maille(geometrieSlime(), gelee));

  // Visage : deux yeux ronds (octogones) et un petit sourire, sur la face avant
  const zFace = 0.57 * Math.cos(Math.PI / 8) + 0.006;
  for (const cote of [-1, 1]) {
    const oeil = new THREE.Mesh(new THREE.CircleGeometry(0.052, 8), noir);
    oeil.position.set(cote * 0.15, 0.3, zFace);
    corps.add(oeil);
  }
  const sourire = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 4, 8, Math.PI), noir);
  sourire.rotation.z = Math.PI;
  sourire.position.set(0, 0.225, zFace);
  corps.add(sourire);

  const teinte = creerTeinte([gelee, noir]);
  let temps = Math.random() * 10;
  let tempsSol = 1;
  let etirement = 1;

  return {
    objet,
    hauteur: 1.2,
    flash: () => teinte.flash(),
    mettreAJour(dt, pose) {
      temps += dt;
      let hauteurSaut = 0;
      let cible = 1;
      let allonge = 1;
      let disparition = 0;
      if (pose.phase === 'mort') {
        // Il s'affaisse en flaque et s'efface
        const k = borner(pose.tempsPhase / DUREE_MORT);
        cible = Math.max(0.07, 1 - adoucir(k) * 1.1);
        disparition = k * k;
      } else if (pose.saut >= 0) {
        // En l'air : étiré au départ et à la retombée
        tempsSol = 0;
        hauteurSaut = Math.sin(Math.PI * pose.saut) * 0.55;
        cible = 1 + 0.26 * Math.abs(Math.cos(Math.PI * pose.saut));
      } else {
        // Au sol : il s'écrase à l'atterrissage puis tremblote comme de la gelée
        tempsSol += dt;
        cible = 1 - 0.36 * Math.exp(-5 * tempsSol) * Math.cos(15 * tempsSol) + 0.025 * Math.sin(temps * 3);
        if (pose.phase === 'recul') cible *= 0.78;
        if (pose.phase === 'attaque') allonge = 1.22;
      }
      etirement += (cible - etirement) * Math.min(1, dt * 28);
      const largeur = pose.phase === 'mort' ? 1 + (1 - etirement) * 0.75 : 1 / Math.sqrt(etirement);
      corps.scale.set(largeur, etirement, largeur * allonge);
      objet.position.set(pose.x, pose.y + hauteurSaut, pose.z);
      objet.rotation.y = pose.orientation;
      teinte.mettreAJour(dt, disparition);
    },
    liberer() {
      libererGeometries(objet);
      teinte.liberer();
    },
  };
}

// --- Gobelin ----------------------------------------------------------------------------------

function creerGobelin(): ModeleEnnemi {
  const K = COULEURS_ENNEMIS;
  const mat = {
    peau: creerMateriau(K.peauGobelin),
    peauSombre: creerMateriau(K.peauGobelinSombre),
    tunique: creerMateriau(K.tunique),
    piece: creerMateriau(K.piece),
    short: creerMateriau(K.short),
    ceinture: creerMateriau(K.ceinture),
    bottes: creerMateriau(K.bottes),
    gourdin: creerMateriau(K.gourdin),
    oeil: creerMateriau(K.oeil),
    sombre: creerMateriau(K.sombre),
  };
  const objet = new THREE.Group();
  // `corps` bascule (anticipation, attaque, chute) autour des pieds
  const corps = new THREE.Group();
  objet.add(corps);

  // Jambes : pivot à la hanche
  const jambes = [-1, 1].map((cote) => {
    const hanche = new THREE.Group();
    hanche.position.set(cote * 0.105, 0.38, 0);
    hanche.add(boite(0.1, 0.28, 0.1, mat.peau, 0, -0.15, 0));
    hanche.add(boite(0.15, 0.07, 0.15, mat.bottes, 0, -0.27, 0));
    hanche.add(boite(0.15, 0.1, 0.25, mat.bottes, 0, -0.33, 0.04));
    corps.add(hanche);
    return hanche;
  });

  // Buste : short, tunique rapiécée, ceinture
  const buste = new THREE.Group();
  buste.position.y = 0.36;
  corps.add(buste);
  buste.add(boite(0.36, 0.17, 0.23, mat.short, 0, 0.06, 0));
  buste.add(boite(0.4, 0.36, 0.25, mat.tunique, 0, 0.3, 0));
  buste.add(boite(0.43, 0.05, 0.27, mat.ceinture, 0, 0.17, 0));
  // Pan de tunique qui dépasse sous la ceinture
  buste.add(boite(0.3, 0.1, 0.02, mat.tunique, -0.03, 0.1, 0.125));
  const pieceHaut = boite(0.2, 0.15, 0.025, mat.piece, -0.08, 0.38, 0.127);
  pieceHaut.rotation.z = -0.35;
  const pieceBas = boite(0.17, 0.12, 0.025, mat.piece, 0.05, 0.24, 0.127);
  pieceBas.rotation.z = 0.3;
  const pieceJupe = boite(0.13, 0.13, 0.025, mat.piece, 0.06, 0.09, 0.13);
  pieceJupe.rotation.z = 0.5;
  buste.add(pieceHaut, pieceBas, pieceJupe);
  buste.add(boite(0.12, 0.08, 0.12, mat.peau, 0, 0.5, 0));

  // Tête : grosse, oreilles pointues, long nez, sourcils froncés, sourire
  const tete = new THREE.Group();
  tete.position.y = 0.54;
  buste.add(tete);
  tete.add(maille(galet(0.25, 0.22, 0.225, 1), mat.peau, 0, 0.2, 0));
  for (const cote of [-1, 1]) {
    const oreille = maille(new THREE.ConeGeometry(0.1, 0.36, 4), mat.peauSombre, cote * 0.33, 0.27, -0.03);
    oreille.scale.z = 0.3;
    oreille.rotation.z = -cote * 1.15;
    oreille.rotation.y = cote * 0.25;
    tete.add(oreille);
    tete.add(boite(0.075, 0.075, 0.03, mat.oeil, cote * 0.095, 0.235, 0.2));
    tete.add(boite(0.03, 0.055, 0.03, mat.sombre, cote * 0.085, 0.232, 0.208));
    const sourcil = boite(0.115, 0.03, 0.035, mat.sombre, cote * 0.095, 0.297, 0.2);
    sourcil.rotation.z = cote * 0.38;
    tete.add(sourcil);
  }
  const nez = maille(new THREE.ConeGeometry(0.058, 0.22, 4), mat.peauSombre, 0, 0.165, 0.28);
  nez.rotation.x = Math.PI / 2 + 0.25;
  tete.add(nez);
  tete.add(boite(0.15, 0.022, 0.03, mat.sombre, 0, 0.085, 0.185));
  for (const cote of [-1, 1]) {
    const coin = boite(0.05, 0.022, 0.03, mat.sombre, cote * 0.09, 0.098, 0.18);
    coin.rotation.z = cote * 0.6;
    tete.add(coin);
  }

  // Bras : pivot à l'épaule. Le droit (côté -x quand on regarde vers +z) tient le gourdin.
  const bras = [-1, 1].map((cote) => {
    const epaule = new THREE.Group();
    epaule.position.set(cote * 0.255, 0.44, 0);
    epaule.rotation.z = cote * 0.16;
    epaule.add(boite(0.095, 0.4, 0.095, mat.peau, 0, -0.19, 0));
    epaule.add(boite(0.115, 0.11, 0.115, mat.peau, 0, -0.42, 0));
    buste.add(epaule);
    return epaule;
  });
  const [brasDroit, brasGauche] = bras;
  const gourdin = new THREE.Group();
  gourdin.position.set(0, -0.42, 0.02);
  gourdin.rotation.x = Math.PI / 2 + 0.6;
  gourdin.add(maille(new THREE.CylinderGeometry(0.1, 0.035, 0.5, 6), mat.gourdin, 0, 0.24, 0));
  gourdin.add(maille(galet(0.1, 0.07, 0.1), mat.gourdin, 0, 0.5, 0));
  brasDroit.add(gourdin);

  const teinte = creerTeinte(Object.values(mat));
  let temps = Math.random() * 10;
  let phaseMarche = 0;
  let intensiteMarche = 0;
  // Valeurs affichées, lissées d'une image à l'autre
  let angleBras = 0;
  let penche = 0;

  return {
    objet,
    hauteur: 1.5,
    flash: () => teinte.flash(),
    mettreAJour(dt, pose) {
      temps += dt;
      const vivant = pose.phase !== 'mort';
      intensiteMarche += ((vivant && pose.enMouvement ? 1 : 0) - intensiteMarche) * Math.min(1, dt * 10);
      phaseMarche += dt * 11 * intensiteMarche;
      const pas = Math.sin(phaseMarche) * intensiteMarche;

      // Bras du gourdin : levé derrière la tête pendant l'anticipation, abattu à l'attaque
      let brasCible = pas * 0.5;
      let pencheCible = 0.08 * intensiteMarche;
      let vitesseGeste = 12;
      if (pose.phase === 'anticipation') {
        const k = adoucir(pose.anticipation);
        brasCible = -2.95 * k;
        pencheCible = -0.3 * k;
        vitesseGeste = 30;
      } else if (pose.phase === 'attaque') {
        brasCible = -0.55;
        pencheCible = 0.4;
        vitesseGeste = 34;
      } else if (pose.phase === 'recul') {
        pencheCible = -0.38;
        brasCible = -0.9;
        vitesseGeste = 26;
      }
      const lissage = Math.min(1, dt * vitesseGeste);
      angleBras += (brasCible - angleBras) * lissage;
      penche += (pencheCible - penche) * lissage;

      let disparition = 0;
      let echelle = 1;
      if (!vivant) {
        // Il tombe à la renverse, puis rétrécit et s'efface (la fumée est ajoutée par les effets)
        const k = borner(pose.tempsPhase / DUREE_MORT);
        corps.rotation.x = -adoucir(borner(k / 0.45)) * 1.45;
        const fin = borner((k - 0.5) / 0.5);
        disparition = fin;
        echelle = 1 - 0.5 * fin;
      } else {
        corps.rotation.x = penche;
      }
      corps.scale.setScalar(echelle);
      brasDroit.rotation.x = angleBras;
      brasGauche.rotation.x = -pas * 0.5 + (pose.phase === 'anticipation' ? 0.5 * pose.anticipation : 0);
      jambes[0].rotation.x = pas * 0.7;
      jambes[1].rotation.x = -pas * 0.7;
      buste.position.y = 0.36 + Math.abs(Math.cos(phaseMarche)) * 0.03 * intensiteMarche + Math.sin(temps * 2.2) * 0.006;
      tete.rotation.z = Math.sin(temps * 1.3) * 0.04;
      tete.rotation.x = pose.phase === 'anticipation' ? 0.15 : 0;

      objet.position.set(pose.x, pose.y, pose.z);
      objet.rotation.y = pose.orientation;
      teinte.mettreAJour(dt, disparition);
    },
    liberer() {
      libererGeometries(objet);
      teinte.liberer();
    },
  };
}

// --- Loup -------------------------------------------------------------------------------------

/** Comme `fuseau`, mais couché : les tranches se suivent le long de z (avant-arrière), `dy` les monte ou les descend. */
export function fuseauCouche(tranches: Array<{ z: number; rx: number; ry: number; dy?: number }>): THREE.BufferGeometry {
  const g = fuseau(tranches.map((t) => ({ y: t.z, rx: t.rx, rz: t.ry, dz: -(t.dy ?? 0) })));
  g.rotateX(Math.PI / 2);
  return g;
}

/** Longueur d'une patte du loup (sert à plier les pattes quand le corps se baisse), en mètres */
const PATTE_LOUP = 0.55;
/** Hauteur du dos au repos (centre du tronc), en mètres */
const HAUTEUR_TRONC_LOUP = 0.6;
/** Port du cou au repos (0 = vertical, plus grand = tête plus basse et plus en avant) */
const COU_REPOS = 0.5;

function creerLoup(): ModeleEnnemi {
  const K = COULEURS_ENNEMIS;
  const mat = {
    poil: creerMateriau(K.poil),
    sombre: creerMateriau(K.poilSombre),
    clair: creerMateriau(K.poilClair),
    truffe: creerMateriau(K.truffe),
    oeil: creerMateriau(K.oeilLoup),
    croc: creerMateriau(K.croc),
    gueule: creerMateriau(K.gueule),
  };
  // Les yeux ambrés ressortent un peu dans la pénombre
  mat.oeil.emissive.setHex(K.oeilLoup);
  mat.oeil.emissiveIntensity = 0.35;

  const objet = new THREE.Group();
  // `corps` avance pendant le bond et bascule sur le flanc à la mort
  const corps = new THREE.Group();
  objet.add(corps);
  // `tronc` : tout ce qui est porté par le dos (monte, descend et tangue)
  const tronc = new THREE.Group();
  tronc.position.y = HAUTEUR_TRONC_LOUP;
  corps.add(tronc);

  // Tronc : poitrail profond à l'avant, ventre remonté à l'arrière
  tronc.add(
    maille(
      fuseauCouche([
        { z: -0.5, rx: 0.09, ry: 0.1, dy: 0.03 },
        { z: -0.36, rx: 0.15, ry: 0.17, dy: 0.03 },
        { z: -0.08, rx: 0.155, ry: 0.155, dy: 0.02 },
        { z: 0.2, rx: 0.185, ry: 0.225, dy: -0.005 },
        { z: 0.4, rx: 0.165, ry: 0.21, dy: 0.02 },
        { z: 0.5, rx: 0.09, ry: 0.12, dy: 0.05 },
      ]),
      mat.poil,
    ),
  );
  // Manteau sombre sur le dos et le haut des flancs
  tronc.add(
    maille(
      fuseauCouche([
        { z: -0.53, rx: 0.075, ry: 0.05, dy: 0.09 },
        { z: -0.36, rx: 0.162, ry: 0.11, dy: 0.115 },
        { z: -0.08, rx: 0.167, ry: 0.07, dy: 0.125 },
        { z: 0.2, rx: 0.197, ry: 0.085, dy: 0.155 },
        { z: 0.4, rx: 0.177, ry: 0.11, dy: 0.15 },
        { z: 0.53, rx: 0.08, ry: 0.07, dy: 0.15 },
      ]),
      mat.sombre,
    ),
  );
  // Ventre et dessous du poitrail, clairs
  tronc.add(
    maille(
      fuseauCouche([
        { z: -0.44, rx: 0.08, ry: 0.05, dy: -0.1 },
        { z: -0.1, rx: 0.125, ry: 0.06, dy: -0.09 },
        { z: 0.2, rx: 0.155, ry: 0.075, dy: -0.17 },
        { z: 0.46, rx: 0.13, ry: 0.13, dy: -0.09 },
        { z: 0.56, rx: 0.05, ry: 0.06, dy: -0.03 },
      ]),
      mat.clair,
    ),
  );
  // Poitrail : mèches claires en chevrons, bien visibles de face
  for (const [x, y, z, taille] of [
    [0, -0.1, 0.53, 1.2],
    [-0.09, -0.04, 0.49, 0.9],
    [0.09, -0.04, 0.49, 0.9],
    [0, -0.24, 0.47, 0.9],
  ] as const) {
    const meche = maille(new THREE.ConeGeometry(0.085 * taille, 0.2 * taille, 4), mat.clair, x, y, z);
    meche.rotation.x = Math.PI - 0.2;
    meche.rotation.y = Math.PI / 4;
    meche.scale.z = 0.6;
    tronc.add(meche);
  }

  // Cou : penché vers l'avant ; crinière sombre sur la nuque, gorge claire
  const cou = new THREE.Group();
  cou.position.set(0, 0.1, 0.4);
  cou.rotation.x = COU_REPOS;
  tronc.add(cou);
  cou.add(
    maille(
      fuseau([
        { y: -0.08, rx: 0.14, rz: 0.17 },
        { y: 0.15, rx: 0.13, rz: 0.14 },
        { y: 0.29, rx: 0.11, rz: 0.115 },
      ]),
      mat.poil,
    ),
  );
  cou.add(
    maille(
      fuseau([
        { y: -0.12, rx: 0.155, rz: 0.1, dz: -0.1 },
        { y: 0.12, rx: 0.145, rz: 0.09, dz: -0.08 },
        { y: 0.28, rx: 0.115, rz: 0.08, dz: -0.06 },
      ]),
      mat.sombre,
    ),
  );
  cou.add(
    maille(
      fuseau([
        { y: -0.1, rx: 0.12, rz: 0.09, dz: 0.11 },
        { y: 0.14, rx: 0.11, rz: 0.075, dz: 0.085 },
        { y: 0.27, rx: 0.085, rz: 0.055, dz: 0.075 },
      ]),
      mat.clair,
    ),
  );

  // Tête : crâne sombre, joues larges, museau allongé, truffe noire, yeux ambrés, oreilles pointues
  const tete = new THREE.Group();
  tete.position.set(0, 0.27, 0.01);
  tete.rotation.x = -COU_REPOS;
  tete.scale.setScalar(1.18);
  cou.add(tete);
  tete.add(
    maille(
      fuseauCouche([
        { z: -0.15, rx: 0.08, ry: 0.08 },
        { z: -0.04, rx: 0.125, ry: 0.115 },
        { z: 0.06, rx: 0.115, ry: 0.1, dy: -0.005 },
        { z: 0.13, rx: 0.09, ry: 0.078, dy: -0.012 },
      ]),
      mat.sombre,
    ),
  );
  tete.add(
    maille(
      fuseauCouche([
        { z: -0.13, rx: 0.1, ry: 0.06, dy: -0.05 },
        { z: -0.02, rx: 0.165, ry: 0.085, dy: -0.045 },
        { z: 0.07, rx: 0.125, ry: 0.07, dy: -0.05 },
        { z: 0.14, rx: 0.075, ry: 0.055, dy: -0.045 },
      ]),
      mat.poil,
    ),
  );
  for (const cote of [-1, 1]) {
    // Favoris en pointe sous les joues
    const favori = maille(new THREE.ConeGeometry(0.06, 0.16, 4), mat.poil, cote * 0.15, -0.085, -0.03);
    favori.rotation.z = -cote * (Math.PI / 2 + 0.75);
    favori.scale.z = 0.6;
    tete.add(favori);
    // Masque clair autour du museau, sous l'œil
    const masque = boite(0.05, 0.04, 0.03, mat.clair, cote * 0.066, -0.066, 0.128);
    masque.rotation.y = cote * 0.5;
    tete.add(masque);
  }
  tete.add(
    maille(
      fuseauCouche([
        { z: 0.08, rx: 0.066, ry: 0.05, dy: -0.05 },
        { z: 0.22, rx: 0.052, ry: 0.042, dy: -0.05 },
        { z: 0.335, rx: 0.04, ry: 0.032, dy: -0.052 },
      ]),
      mat.clair,
    ),
  );
  // Chanfrein gris sur le dessus du museau
  const chanfrein = boite(0.045, 0.02, 0.2, mat.poil, 0, -0.008, 0.2);
  chanfrein.rotation.x = 0.1;
  tete.add(chanfrein);
  tete.add(boite(0.042, 0.032, 0.035, mat.truffe, 0, -0.034, 0.345));

  const oreilles = [-1, 1].map((cote) => {
    const oreille = new THREE.Group();
    oreille.position.set(cote * 0.085, 0.085, -0.06);
    oreille.rotation.z = -cote * 0.2;
    const pavillon = maille(new THREE.ConeGeometry(0.06, 0.145, 4), mat.sombre, 0, 0.065, 0);
    pavillon.scale.z = 0.5;
    const creux = maille(new THREE.ConeGeometry(0.036, 0.1, 4), mat.clair, 0, 0.052, 0.014);
    creux.scale.z = 0.4;
    oreille.add(pavillon, creux);
    tete.add(oreille);
    return oreille;
  });
  for (const cote of [-1, 1]) {
    const oeil = new THREE.Group();
    oeil.position.set(cote * 0.06, 0.028, 0.128);
    oeil.rotation.y = cote * 0.3;
    oeil.add(boite(0.042, 0.032, 0.02, mat.oeil));
    oeil.add(boite(0.016, 0.026, 0.02, mat.truffe, 0, 0, 0.004));
    // Paupière sombre en biais : regard dur
    const paupiere = boite(0.058, 0.014, 0.03, mat.truffe, 0, 0.021, 0.002);
    paupiere.rotation.z = cote * 0.32;
    oeil.add(paupiere);
    tete.add(oeil);
  }
  // Crocs du haut, visibles même gueule fermée
  for (const cote of [-1, 1]) {
    const croc = maille(new THREE.ConeGeometry(0.011, 0.045, 4), mat.croc, cote * 0.036, -0.105, 0.29);
    croc.rotation.x = Math.PI;
    tete.add(croc);
  }
  // Mâchoire du bas : s'ouvre pour grogner et mordre
  const machoire = new THREE.Group();
  machoire.position.set(0, -0.098, 0.06);
  tete.add(machoire);
  machoire.add(
    maille(
      fuseauCouche([
        { z: 0, rx: 0.055, ry: 0.02 },
        { z: 0.15, rx: 0.042, ry: 0.018 },
        { z: 0.255, rx: 0.03, ry: 0.014 },
      ]),
      mat.clair,
    ),
  );
  machoire.add(boite(0.055, 0.008, 0.19, mat.gueule, 0, 0.018, 0.12));
  for (const cote of [-1, 1]) {
    machoire.add(maille(new THREE.ConeGeometry(0.009, 0.035, 4), mat.croc, cote * 0.024, 0.032, 0.215));
  }

  // Queue touffue : sombre, bout clair
  const queue = new THREE.Group();
  queue.position.set(0, 0.1, -0.48);
  tronc.add(queue);
  queue.add(
    maille(
      fuseau([
        { y: 0.04, rx: 0.035, rz: 0.035 },
        { y: -0.16, rx: 0.075, rz: 0.08 },
        { y: -0.32, rx: 0.095, rz: 0.1 },
        { y: -0.43, rx: 0.08, rz: 0.085 },
      ]),
      mat.sombre,
    ),
  );
  queue.add(
    maille(
      fuseau([
        { y: -0.4, rx: 0.078, rz: 0.083 },
        { y: -0.52, rx: 0.055, rz: 0.06 },
        { y: -0.62, rx: 0.012, rz: 0.012 },
      ]),
      mat.clair,
    ),
  );

  // Pattes : pivot en haut (épaule ou hanche) et un second au milieu (coude ou jarret)
  interface Patte {
    haut: THREE.Group;
    bas: THREE.Group;
    avant: boolean;
  }
  const pattes: Patte[] = [];
  for (const cote of [-1, 1]) {
    const epaule = new THREE.Group();
    epaule.position.set(cote * 0.115, -0.06, 0.3);
    epaule.add(
      maille(
        fuseau([
          { y: 0.12, rx: 0.065, rz: 0.1 },
          { y: -0.1, rx: 0.06, rz: 0.075 },
          { y: -0.27, rx: 0.048, rz: 0.052 },
        ]),
        mat.poil,
      ),
    );
    const coude = new THREE.Group();
    coude.position.y = -0.26;
    coude.add(
      maille(
        fuseau([
          { y: 0.02, rx: 0.047, rz: 0.05 },
          { y: -0.25, rx: 0.041, rz: 0.044 },
        ]),
        mat.clair,
      ),
    );
    coude.add(boite(0.105, 0.06, 0.15, mat.clair, 0, -0.25, 0.035));
    epaule.add(coude);
    tronc.add(epaule);
    pattes.push({ haut: epaule, bas: coude, avant: true });
  }
  for (const cote of [-1, 1]) {
    const hanche = new THREE.Group();
    hanche.position.set(cote * 0.12, -0.02, -0.34);
    hanche.add(
      maille(
        fuseau([
          { y: 0.12, rx: 0.065, rz: 0.12 },
          { y: -0.1, rx: 0.075, rz: 0.135, dz: 0.02 },
          { y: -0.29, rx: 0.052, rz: 0.065, dz: 0.05 },
        ]),
        mat.poil,
      ),
    );
    const jarret = new THREE.Group();
    jarret.position.set(0, -0.28, 0.05);
    jarret.add(
      maille(
        fuseau([
          { y: 0.02, rx: 0.048, rz: 0.058 },
          { y: -0.13, rx: 0.042, rz: 0.046, dz: -0.08 },
          { y: -0.27, rx: 0.04, rz: 0.043, dz: -0.065 },
        ]),
        mat.clair,
      ),
    );
    jarret.add(boite(0.105, 0.06, 0.15, mat.clair, 0, -0.27, -0.03));
    hanche.add(jarret);
    tronc.add(hanche);
    pattes.push({ haut: hanche, bas: jarret, avant: false });
  }
  // Décalage de chaque patte dans le cycle : au trot (diagonales ensemble) puis au galop (avant ensemble, arrière ensemble)
  const DECALAGE_TROT = [0, Math.PI, Math.PI, 0];
  const DECALAGE_GALOP = [0, 0.7, Math.PI, Math.PI + 0.7];

  const L = CONFIG.ennemis.loup;
  const teinte = creerTeinte(Object.values(mat));
  let temps = Math.random() * 10;
  let phaseMarche = 0;
  let intensiteMarche = 0;
  let vitesse = 0;
  let precedent: { x: number; z: number } | null = null;
  // Valeurs affichées, lissées d'une image à l'autre
  const pose = { tangage: 0, baisse: 0, cou: COU_REPOS, gueule: 0, oreilles: 0, queue: 0.7, avant: 0, arriere: 0 };

  return {
    objet,
    hauteur: 1.3,
    flash: () => teinte.flash(),
    mettreAJour(dt, p) {
      temps += dt;
      const vivant = p.phase !== 'mort';
      // Vitesse réelle, mesurée d'une image à l'autre : elle règle la cadence et fait passer du trot au galop
      if (precedent && dt > 0) {
        const mesure = Math.hypot(p.x - precedent.x, p.z - precedent.z) / dt;
        vitesse += (Math.min(mesure, 12) - vitesse) * Math.min(1, dt * 8);
      }
      precedent = { x: p.x, z: p.z };
      const court = vivant && p.enMouvement && p.phase !== 'recul' && p.phase !== 'attaque';
      intensiteMarche += ((court ? 1 : 0) - intensiteMarche) * Math.min(1, dt * 10);
      const galop = borner((vitesse - 3.5) / 2);
      phaseMarche += dt * (6 + vitesse * 1.6) * intensiteMarche;

      // Pose visée selon la phase
      let cible = { tangage: 0, baisse: 0, cou: COU_REPOS, gueule: 0, oreilles: 0, queue: 0.7, avant: 0, arriere: 0 };
      let vitesseGeste = 10;
      let bond = 0;
      if (p.phase === 'poursuite') {
        // Tête basse tendue vers la proie, babines entrouvertes, queue à l'horizontale
        cible = { ...cible, cou: 0.95, gueule: 0.14, oreilles: -0.35, queue: 1.35 };
      } else if (p.phase === 'anticipation') {
        // Il se ramasse sur ses pattes, oreilles couchées, crocs découverts : c'est le moment d'esquiver
        const k = adoucir(p.anticipation);
        cible = { tangage: 0.14 * k, baisse: 0.13 * k, cou: COU_REPOS + 0.55 * k, gueule: 0.3 * k, oreilles: -1.0 * k, queue: 1.7, avant: 0, arriere: 0 };
        vitesseGeste = 30;
      } else if (p.phase === 'attaque') {
        // Bond en avant, gueule grande ouverte qui claque à mi-course
        const s = borner(p.tempsPhase / L.dureeAttaque);
        bond = Math.sin(Math.PI * s);
        cible = {
          tangage: -0.32 + 0.45 * s,
          baisse: -0.1 * bond,
          cou: 0.95,
          gueule: s < 0.5 ? 0.7 : 0.04,
          oreilles: -1.0,
          queue: 1.5,
          avant: -1.0 * (1 - s),
          arriere: 0.75 * bond,
        };
        vitesseGeste = 40;
      } else if (p.phase === 'recul') {
        cible = { tangage: -0.2, baisse: 0.04, cou: 0.15, gueule: 0.35, oreilles: -1.0, queue: 0.25, avant: -0.3, arriere: 0 };
        vitesseGeste = 26;
      } else if (!vivant) {
        cible = { tangage: 0, baisse: 0, cou: 1.3, gueule: 0.3, oreilles: -0.6, queue: 0.4, avant: -0.35, arriere: 0.35 };
        vitesseGeste = 8;
      }
      const lissage = Math.min(1, dt * vitesseGeste);
      for (const cle of Object.keys(pose) as Array<keyof typeof pose>) pose[cle] += (cible[cle] - pose[cle]) * lissage;

      // Corps : rebond du trot, tangage du galop, bond de l'attaque
      const rebond = Math.abs(Math.sin(phaseMarche)) * (0.025 + 0.035 * galop) * intensiteMarche;
      tronc.position.y = HAUTEUR_TRONC_LOUP - pose.baisse + rebond + Math.sin(temps * 2.4) * 0.006;
      tronc.rotation.x = pose.tangage + Math.sin(phaseMarche) * 0.07 * galop * intensiteMarche;
      corps.position.z = bond * 0.5;
      cou.rotation.x = pose.cou + Math.sin(phaseMarche * 2) * 0.03 * intensiteMarche;
      // La tête reste à l'horizontale quel que soit le port du cou et le tangage
      tete.rotation.x = -cou.rotation.x - tronc.rotation.x * 0.8;
      tete.rotation.z = vivant ? Math.sin(temps * 1.1) * 0.04 : 0;
      machoire.rotation.x = pose.gueule + (p.phase === 'anticipation' ? Math.sin(temps * 38) * 0.03 : 0);
      for (const oreille of oreilles) oreille.rotation.x = pose.oreilles;
      queue.rotation.x = pose.queue + Math.sin(phaseMarche) * 0.12 * intensiteMarche;
      queue.rotation.z = vivant ? Math.sin(temps * 2.1) * 0.12 * (1 - intensiteMarche) + Math.sin(phaseMarche) * 0.1 * intensiteMarche : 0;

      // Pattes : foulée, puis pliure pour garder les pieds au sol quand le corps se baisse
      const pliure = Math.sqrt((2 * Math.max(0, pose.baisse)) / PATTE_LOUP);
      const amplitude = (0.42 + 0.33 * galop) * intensiteMarche;
      pattes.forEach((patte, i) => {
        const phi = phaseMarche + DECALAGE_TROT[i] + (DECALAGE_GALOP[i] - DECALAGE_TROT[i]) * galop;
        const geste = patte.avant ? pose.avant : pose.arriere;
        patte.haut.rotation.x = Math.sin(phi) * amplitude - pliure + geste - tronc.rotation.x;
        patte.bas.rotation.x = Math.max(0, -Math.cos(phi)) * (0.7 + 0.4 * galop) * intensiteMarche + 2 * pliure + Math.max(0, -geste) * 0.5;
      });

      let disparition = 0;
      let echelle = 1;
      if (!vivant) {
        // Il s'effondre sur le flanc, puis rétrécit et s'efface (la fumée est ajoutée par les effets)
        const k = borner(p.tempsPhase / DUREE_MORT);
        const chute = adoucir(borner(k / 0.45));
        corps.rotation.z = chute * 1.5;
        corps.position.y = chute * 0.16;
        const fin = borner((k - 0.5) / 0.5);
        disparition = fin;
        echelle = 1 - 0.5 * fin;
      } else {
        corps.rotation.z = 0;
        corps.position.y = 0;
      }
      corps.scale.setScalar(echelle);

      objet.position.set(p.x, p.y, p.z);
      objet.rotation.y = p.orientation;
      teinte.mettreAJour(dt, disparition);
    },
    liberer() {
      libererGeometries(objet);
      teinte.liberer();
    },
  };
}

// --- Pièces d'équipement des bandits ----------------------------------------------------------
// Même principe que les armures du héros (src/scene/armures.ts), pour le squelette des bandits : les pièces
// d'un même groupe et d'une même matière sont fusionnées en un seul maillage, la couleur est portée par les sommets.

/** Matière dont la couleur vient des sommets (pièces fusionnées). */
function creerMatiereFusionnee(): THREE.MeshStandardMaterial {
  const m = creerMateriau(0xffffff);
  m.vertexColors = true;
  return m;
}

/** Position et orientation d'une pièce : rotation autour de z, puis de x, puis de y, puis déplacement. */
function pose(x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0): THREE.Matrix4 {
  return new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1));
}

/** Comme `fuseau`, mais ouvert aux deux bouts (ou fermé en haut seulement) : pour les pièces enfilées sur un membre. */
function manchon(tranches: Anneau[], chapeau = false): THREE.BufferGeometry {
  const g = fuseau(tranches);
  const indices = Array.from(g.index!.array);
  const cotes = (tranches.length - 1) * 48;
  const gardes = indices.slice(0, cotes);
  // Après les côtés, `fuseau` range les bouts par paires de triangles : celui du bas, puis celui du haut
  if (chapeau) for (let i = cotes; i < indices.length; i += 6) gardes.push(indices[i + 3], indices[i + 4], indices[i + 5]);
  g.setIndex(gardes);
  return g;
}

/** Pan plat à pointe (lambeau de cuir) : il pend de y = 0 vers le bas, sa face extérieure vers +z. */
function pan(l: number, h: number, pointe: number, ep = 0.02): THREE.BufferGeometry {
  const forme = new THREE.Shape();
  forme.moveTo(-l / 2, 0);
  forme.lineTo(-l / 2, -(h - pointe));
  forme.lineTo(0, -h);
  forme.lineTo(l / 2, -(h - pointe));
  forme.lineTo(l / 2, 0);
  forme.closePath();
  return new THREE.ExtrudeGeometry(forme, { depth: ep, bevelEnabled: false });
}

/** Rassemble des pièces, puis en fait un maillage par groupe du squelette et par matière. */
function creerAtelier() {
  const lots = new Map<string, { parent: THREE.Object3D; matiere: THREE.Material; positions: number[]; couleurs: number[] }>();
  const p = new THREE.Vector3();
  const teinte = new THREE.Color();

  /** Ajoute au groupe `parent` une pièce de couleur `couleur`, placée par `matrice`. */
  function poser(parent: THREE.Object3D, matiere: THREE.Material, geometrie: THREE.BufferGeometry, couleur: number, matrice?: THREE.Matrix4): void {
    const cle = `${parent.id}:${matiere.id}`;
    let lot = lots.get(cle);
    if (!lot) {
      lot = { parent, matiere, positions: [], couleurs: [] };
      lots.set(cle, lot);
    }
    const g = geometrie.index ? geometrie.toNonIndexed() : geometrie;
    const pos = g.getAttribute('position');
    teinte.set(couleur);
    for (let i = 0; i < pos.count; i++) {
      p.fromBufferAttribute(pos, i);
      if (matrice) p.applyMatrix4(matrice);
      lot.positions.push(p.x, p.y, p.z);
      lot.couleurs.push(teinte.r, teinte.g, teinte.b);
    }
  }

  /** Lanière droite de `a` à `b`, large de `largeur`, dont l'épaisseur est tournée vers `normale`. */
  function laniere(
    parent: THREE.Object3D,
    matiere: THREE.Material,
    a: [number, number, number],
    b: [number, number, number],
    largeur: number,
    epaisseur: number,
    couleur: number,
    normale: THREE.Vector3,
  ): void {
    const va = new THREE.Vector3(...a);
    const vb = new THREE.Vector3(...b);
    const y = vb.clone().sub(va);
    const longueur = y.length();
    y.normalize();
    const x = y.clone().cross(normale).normalize();
    const z = x.clone().cross(y);
    const m = new THREE.Matrix4().makeBasis(x, y, z).setPosition(va.add(vb).multiplyScalar(0.5));
    poser(parent, matiere, new THREE.BoxGeometry(largeur, longueur, epaisseur), couleur, m);
  }

  /** Pans à pointe pendus autour de la taille : [direction en degrés (0 = devant), largeur, hauteur, couleur]. */
  function pans(
    parent: THREE.Object3D,
    matiere: THREE.Material,
    o: { y: number; rx: number; rz: number; incl: number; pointe: number },
    liste: Array<[number, number, number, number]>,
  ): void {
    for (const [degres, l, h, couleur] of liste) {
      const a = (degres * Math.PI) / 180;
      const lacet = Math.atan2(Math.sin(a) / o.rx, Math.cos(a) / o.rz);
      poser(parent, matiere, pan(l, h, o.pointe, 0.022), couleur, pose(o.rx * Math.sin(a), o.y, o.rz * Math.cos(a), -o.incl, lacet));
    }
  }

  /** Fabrique les maillages (un par groupe et par matière) et les accroche. */
  function finir(): void {
    for (const lot of lots.values()) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(lot.positions, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(lot.couleurs, 3));
      g.computeVertexNormals();
      const m = new THREE.Mesh(g, lot.matiere);
      m.castShadow = true;
      lot.parent.add(m);
    }
  }

  return { poser, laniere, pans, finir };
}

/**
 * Facettes d'une plaque à arête centrale : `demi` est le demi-contour droit, du haut de l'arête au bas de l'arête
 * (points [x, y]) ; l'arête est en relief de `relief`, les bords sont à z = 0. Face vers +z, sans épaisseur.
 */
function facettesArete(demi: Array<[number, number]>, relief: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const dernier = demi.length - 1;
  const sommet = (i: number, s: number) => [demi[i][0] * s, demi[i][1], i === 0 || i === dernier ? relief : 0];
  for (const s of [1, -1]) {
    for (let i = 1; i < dernier; i++) {
      // Sens des triangles inversé d'un côté à l'autre pour que les deux moitiés regardent vers l'avant
      const [b, c] = s === 1 ? [i + 1, i] : [i, i + 1];
      positions.push(...sommet(0, s), ...sommet(b, s), ...sommet(c, s));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return g;
}

/** Plaque plate épaisse de `ep`, de contour symétrique donné par son demi-contour droit (voir `facettesArete`). */
function plaque(demi: Array<[number, number]>, ep: number): THREE.BufferGeometry {
  const forme = new THREE.Shape();
  const contour = [...demi, ...demi.slice(1, -1).reverse().map(([x, y]) => [-x, y] as [number, number])];
  contour.forEach(([x, y], i) => (i === 0 ? forme.moveTo(x, y) : forme.lineTo(x, y)));
  forme.closePath();
  return new THREE.ExtrudeGeometry(forme, { depth: ep, bevelEnabled: false });
}

// --- Bandit -----------------------------------------------------------------------------------

/** Angle de la dague dans la main au repos : pointe vers l'avant, un peu vers le bas */
const DAGUE_REPOS = Math.PI / 2 + 0.2;

function creerBandit(): ModeleEnnemi {
  const K = COULEURS_ENNEMIS;
  const mat = {
    capuche: creerMateriau(K.capuche),
    foulard: creerMateriau(K.foulard),
    // Pièces de cuir fusionnées (gilet, plastron, lanières, brassards…) : couleur portée par les sommets
    equipement: creerMatiereFusionnee(),
    chemise: creerMateriau(K.chemise),
    pantalon: creerMateriau(K.pantalon),
    bottes: creerMateriau(K.bottesBandit),
    cuir: creerMateriau(K.cuirBandit),
    peau: creerMateriau(K.peauBandit),
    sourcil: creerMateriau(K.sourcilBandit),
    boucle: creerMateriau(K.boucle),
    acier: creerMateriau(K.acier),
  };
  mat.acier.roughness = 0.45;
  mat.acier.metalness = 0.35;

  const at = creerAtelier();
  const E = mat.equipement;
  const objet = new THREE.Group();
  // `corps` bascule (anticipation, attaque, chute) autour des pieds
  const corps = new THREE.Group();
  objet.add(corps);

  // Jambes : pivot à la hanche ; pantalon bouffant, botte à revers
  const jambes = [-1, 1].map((cote) => {
    const hanche = new THREE.Group();
    hanche.position.set(cote * 0.115, 0.74, 0);
    hanche.add(
      maille(
        fuseau([
          { y: 0.04, rx: 0.1, rz: 0.11 },
          { y: -0.25, rx: 0.102, rz: 0.118 },
          { y: -0.47, rx: 0.085, rz: 0.095 },
        ]),
        mat.pantalon,
      ),
    );
    hanche.add(boite(0.2, 0.09, 0.215, mat.bottes, 0, -0.5, 0));
    hanche.add(
      maille(
        fuseau([
          { y: -0.5, rx: 0.08, rz: 0.09 },
          { y: -0.7, rx: 0.075, rz: 0.085 },
        ]),
        mat.bottes,
      ),
    );
    hanche.add(boite(0.155, 0.1, 0.28, mat.bottes, 0, -0.69, 0.05));
    hanche.add(boite(0.16, 0.025, 0.29, mat.cuir, 0, -0.7275, 0.05));
    corps.add(hanche);
    return hanche;
  });

  // Buste : chemise claire, gilet brun sous un plastron de cuir rembourré et dépareillé, bandoulière,
  // ceinture à boucle et à sacoche, pans de cuir usés, dague au côté
  const buste = new THREE.Group();
  buste.position.y = 0.72;
  corps.add(buste);
  // La chemise ne se voit que sous la ceinture, entre les pans
  buste.add(
    maille(
      fuseau([
        { y: -0.13, rx: 0.2, rz: 0.13 },
        { y: 0.12, rx: 0.19, rz: 0.125 },
      ]),
      mat.chemise,
    ),
  );
  buste.add(boite(0.2, 0.2, 0.02, mat.chemise, 0, -0.06, 0.146));
  at.poser(
    buste,
    E,
    manchon(
      [
        { y: 0.1, rx: 0.214, rz: 0.137 },
        { y: 0.42, rx: 0.24, rz: 0.145 },
        { y: 0.56, rx: 0.2, rz: 0.12 },
      ],
      true,
    ),
    K.gilet,
  );
  // Plastron rembourré, devant et dos : le gilet dépasse sur les côtés ; deux coutures sur le devant
  at.poser(
    buste,
    E,
    manchon([
      { y: 0.15, rx: 0.19, rz: 0.15, c: 0.03 },
      { y: 0.42, rx: 0.205, rz: 0.158, c: 0.03 },
    ]),
    K.plastronBandit,
  );
  for (const cote of [-1, 1]) at.poser(buste, E, new THREE.BoxGeometry(0.016, 0.25, 0.012), K.cuirBandit, pose(cote * 0.095, 0.29, 0.156, -0.03));
  // Épaule droite : simple rabat du gilet (l'épaulière de cuir est sur l'autre bras)
  at.poser(buste, E, new THREE.BoxGeometry(0.15, 0.07, 0.25), K.gilet, pose(-0.265, 0.5, 0, 0, 0, 0.3));
  // Bandoulière : de l'épaule gauche à la hanche droite, devant et derrière, avec sa boucle
  for (const face of [-1, 1]) {
    at.laniere(buste, E, [0.16, 0.42, face * 0.168], [-0.175, 0.17, face * 0.168], 0.05, 0.02, K.cuirBanditClair, new THREE.Vector3(0, 0, face));
  }
  const angleBandouliere = Math.atan2(0.335, 0.25);
  at.poser(buste, E, new THREE.BoxGeometry(0.076, 0.076, 0.018), K.boucle, pose(-0.075, 0.245, 0.181, 0, 0, angleBandouliere));
  at.poser(buste, E, new THREE.BoxGeometry(0.04, 0.04, 0.018), K.cuirBandit, pose(-0.075, 0.245, 0.185, 0, 0, angleBandouliere));
  // Ceinture large à boucle carrée
  at.poser(
    buste,
    E,
    manchon(
      [
        { y: 0.095, rx: 0.232, rz: 0.16 },
        { y: 0.165, rx: 0.232, rz: 0.16 },
      ],
      true,
    ),
    K.cuirBandit,
  );
  at.poser(buste, E, new THREE.BoxGeometry(0.095, 0.09, 0.02), K.boucle, pose(0, 0.13, 0.166));
  at.poser(buste, E, new THREE.BoxGeometry(0.05, 0.046, 0.02), K.cuirBandit, pose(0, 0.13, 0.17));
  // Sacoche à rabat sur la hanche droite
  at.poser(buste, E, new THREE.BoxGeometry(0.105, 0.115, 0.06), K.sacoche, pose(-0.145, 0.045, 0.178, 0, 0, -0.08));
  at.poser(buste, E, new THREE.BoxGeometry(0.115, 0.055, 0.068), K.plastronBandit, pose(-0.142, 0.083, 0.18, 0, 0, -0.08));
  at.poser(buste, E, new THREE.BoxGeometry(0.026, 0.034, 0.012), K.boucle, pose(-0.147, 0.052, 0.214, 0, 0, -0.08));
  // Pans de cuir usés, de longueurs inégales, sous la ceinture (rien devant : la chemise y pend)
  at.pans(buste, E, { y: 0.105, rx: 0.222, rz: 0.15, incl: 0.2, pointe: 0.055 }, [
    [52, 0.15, 0.2, K.gilet],
    [112, 0.16, 0.26, K.plastronBandit],
    [180, 0.17, 0.22, K.gilet],
    [246, 0.16, 0.27, K.plastronBandit],
    [308, 0.15, 0.19, K.gilet],
  ]);
  // Seconde dague, au fourreau sur la hanche gauche
  const fourreau = pose(0.15, 0.11, 0.172, 0, 0, 0.3);
  at.poser(buste, E, new THREE.BoxGeometry(0.05, 0.2, 0.03), K.cuirBandit, fourreau.clone().multiply(pose(0, -0.11, 0)));
  at.poser(buste, E, new THREE.BoxGeometry(0.095, 0.024, 0.036), K.boucle, fourreau);
  at.poser(buste, E, new THREE.BoxGeometry(0.03, 0.08, 0.03), K.bottesBandit, fourreau.clone().multiply(pose(0, 0.05, 0)));
  at.poser(buste, E, new THREE.BoxGeometry(0.048, 0.036, 0.04), K.boucle, fourreau.clone().multiply(pose(0, 0.105, 0)));
  // Col de la capuche, drapé sur les épaules, en pointe sur la poitrine
  buste.add(
    maille(
      fuseau([
        { y: 0.4, rx: 0.255, rz: 0.165 },
        { y: 0.52, rx: 0.235, rz: 0.165 },
        { y: 0.62, rx: 0.16, rz: 0.14 },
      ]),
      mat.capuche,
    ),
  );
  const pointe = maille(new THREE.ConeGeometry(0.17, 0.26, 4), mat.capuche, 0, 0.36, 0.135);
  pointe.rotation.x = Math.PI;
  pointe.scale.z = 0.3;
  buste.add(pointe);

  // Tête : visage dans l'ombre de la capuche, foulard jusqu'au nez, regard dur
  const tete = new THREE.Group();
  tete.position.y = 0.56;
  buste.add(tete);
  tete.add(
    maille(
      fuseau([
        { y: 0.02, rx: 0.12, rz: 0.12 },
        { y: 0.12, rx: 0.14, rz: 0.135 },
        { y: 0.3, rx: 0.14, rz: 0.135 },
        { y: 0.36, rx: 0.1, rz: 0.1 },
      ]),
      mat.peau,
    ),
  );
  for (const cote of [-1, 1]) {
    tete.add(boite(0.05, 0.04, 0.02, mat.sourcil, cote * 0.06, 0.24, 0.132));
    const sourcil = boite(0.08, 0.026, 0.026, mat.sourcil, cote * 0.062, 0.283, 0.136);
    sourcil.rotation.z = cote * 0.22;
    tete.add(sourcil);
  }
  tete.add(
    maille(
      fuseau([
        { y: 0, rx: 0.1, rz: 0.12, dz: 0.02 },
        { y: 0.08, rx: 0.14, rz: 0.135, dz: 0.022 },
        { y: 0.195, rx: 0.147, rz: 0.14, dz: 0.016 },
        { y: 0.21, rx: 0.13, rz: 0.12, dz: 0.02 },
      ]),
      mat.foulard,
    ),
  );
  // Arête du nez sous le foulard
  const nez = boite(0.05, 0.08, 0.03, mat.foulard, 0, 0.155, 0.158);
  nez.rotation.x = -0.2;
  tete.add(nez);
  // Capuche : enveloppe la tête, pointe en haut ; un cadre épais déborde autour du visage
  tete.add(
    maille(
      fuseau([
        { y: -0.04, rx: 0.19, rz: 0.17, dz: -0.05 },
        { y: 0.2, rx: 0.215, rz: 0.18, dz: -0.06 },
        { y: 0.37, rx: 0.165, rz: 0.17, dz: -0.065 },
        { y: 0.5, rx: 0.03, rz: 0.05, dz: -0.1 },
      ]),
      mat.capuche,
    ),
  );
  for (const cote of [-1, 1]) {
    tete.add(boite(0.065, 0.36, 0.11, mat.capuche, cote * 0.185, 0.16, 0.115));
    const fronton = boite(0.22, 0.07, 0.11, mat.capuche, cote * 0.09, 0.365, 0.115);
    fronton.rotation.z = -cote * 0.42;
    tete.add(fronton);
  }

  // Bras : pivot à l'épaule ; manches amples, brassards de cuir dépareillés, mains nues. Le droit (côté -x) tient
  // la dague, le gauche porte la seule épaulière.
  const bras = [-1, 1].map((cote) => {
    const epaule = new THREE.Group();
    epaule.position.set(cote * 0.28, 0.47, 0);
    epaule.rotation.z = cote * 0.14;
    epaule.add(
      maille(
        fuseau([
          { y: 0.04, rx: 0.07, rz: 0.075 },
          { y: -0.2, rx: 0.075, rz: 0.08 },
          { y: -0.4, rx: 0.088, rz: 0.092 },
          { y: -0.47, rx: 0.068, rz: 0.072 },
        ]),
        mat.chemise,
      ),
    );
    epaule.add(
      maille(
        fuseau([
          { y: -0.46, rx: 0.052, rz: 0.058 },
          { y: -0.53, rx: 0.066, rz: 0.074 },
          { y: -0.62, rx: 0.05, rz: 0.058 },
        ]),
        mat.peau,
      ),
    );
    // Brassard cerclé : long et clair à droite, plus court et sombre à gauche
    const droit = cote === -1;
    const haut = droit ? -0.25 : -0.3;
    at.poser(
      epaule,
      E,
      manchon(
        [
          { y: -0.462, rx: 0.086, rz: 0.091 },
          { y: haut, rx: 0.094, rz: 0.099 },
        ],
        true,
      ),
      droit ? K.gilet : K.plastronBandit,
    );
    for (const y of droit ? [-0.458, -0.3] : [-0.4]) {
      at.poser(
        epaule,
        E,
        manchon(
          [
            { y, rx: 0.1, rz: 0.105 },
            { y: y + 0.034, rx: 0.1, rz: 0.105 },
          ],
          true,
        ),
        droit ? K.cuirBandit : K.cuirBanditClair,
      );
    }
    if (!droit) {
      // Épaulière de cuir sombre à bord clair, tenue par la bandoulière, avec un rivet
      at.poser(
        epaule,
        E,
        fuseau([
          { y: -0.075, rx: 0.1, rz: 0.108, dx: 0.014 },
          { y: 0.008, rx: 0.106, rz: 0.113, dx: 0.014 },
          { y: 0.064, rx: 0.066, rz: 0.076 },
        ]),
        K.cuirBandit,
      );
      at.poser(
        epaule,
        E,
        manchon(
          [
            { y: -0.105, rx: 0.107, rz: 0.115, dx: 0.014 },
            { y: -0.07, rx: 0.107, rz: 0.115, dx: 0.014 },
          ],
          true,
        ),
        K.cuirBanditClair,
      );
      at.poser(epaule, E, new THREE.BoxGeometry(0.02, 0.034, 0.034), K.boucle, pose(0.122, -0.03, 0));
    }
    buste.add(epaule);
    return epaule;
  });
  const [brasDroit, brasGauche] = bras;
  const dague = new THREE.Group();
  dague.position.set(0, -0.56, 0.04);
  dague.rotation.x = DAGUE_REPOS;
  dague.add(boite(0.032, 0.12, 0.036, mat.cuir, 0, 0, 0));
  dague.add(boite(0.048, 0.036, 0.048, mat.boucle, 0, -0.075, 0));
  dague.add(boite(0.14, 0.026, 0.042, mat.boucle, 0, 0.07, 0));
  dague.add(
    maille(
      fuseau([
        { y: 0.08, rx: 0.03, rz: 0.009, c: 0.005 },
        { y: 0.36, rx: 0.025, rz: 0.008, c: 0.004 },
        { y: 0.46, rx: 0.003, rz: 0.003, c: 0.001 },
      ]),
      mat.acier,
    ),
  );
  brasDroit.add(dague);
  at.finir();

  const teinte = creerTeinte(Object.values(mat));
  let temps = Math.random() * 10;
  let phaseMarche = 0;
  let intensiteMarche = 0;
  // Valeurs affichées, lissées d'une image à l'autre
  let angleBras = 0;
  let angleGarde = 0;
  let angleDague = DAGUE_REPOS;
  let penche = 0;

  return {
    objet,
    hauteur: 2.0,
    flash: () => teinte.flash(),
    mettreAJour(dt, pose) {
      temps += dt;
      const vivant = pose.phase !== 'mort';
      intensiteMarche += ((vivant && pose.enMouvement ? 1 : 0) - intensiteMarche) * Math.min(1, dt * 10);
      phaseMarche += dt * 9.5 * intensiteMarche;
      const pas = Math.sin(phaseMarche) * intensiteMarche;

      // Bras de la dague : pointée vers le joueur en poursuite, levée au-dessus de la tête pendant
      // l'anticipation, abattue à l'attaque. Le bras gauche se met en garde devant le buste.
      let brasCible = pas * 0.45;
      let gardeCible = -pas * 0.45;
      let dagueCible = DAGUE_REPOS;
      let pencheCible = 0.06 * intensiteMarche;
      let vitesseGeste = 12;
      if (pose.phase === 'poursuite') {
        brasCible = -0.75 + pas * 0.12;
        gardeCible = -0.35 - pas * 0.3;
        pencheCible = 0.14;
      } else if (pose.phase === 'anticipation') {
        const k = adoucir(pose.anticipation);
        brasCible = -0.75 - 1.95 * k;
        dagueCible = DAGUE_REPOS + (Math.PI + 0.15 - DAGUE_REPOS) * k;
        gardeCible = -0.35 - 0.75 * k;
        pencheCible = 0.14 - 0.4 * k;
        vitesseGeste = 30;
      } else if (pose.phase === 'attaque') {
        brasCible = -1.15;
        dagueCible = 2.75;
        gardeCible = 0.5;
        pencheCible = 0.42;
        vitesseGeste = 36;
      } else if (pose.phase === 'recul') {
        brasCible = -1.0;
        gardeCible = -0.9;
        pencheCible = -0.32;
        vitesseGeste = 26;
      }
      const lissage = Math.min(1, dt * vitesseGeste);
      angleBras += (brasCible - angleBras) * lissage;
      angleGarde += (gardeCible - angleGarde) * lissage;
      angleDague += (dagueCible - angleDague) * lissage;
      penche += (pencheCible - penche) * lissage;

      let disparition = 0;
      let echelle = 1;
      if (!vivant) {
        // Il tombe à la renverse, puis rétrécit et s'efface (la fumée est ajoutée par les effets)
        const k = borner(pose.tempsPhase / DUREE_MORT);
        corps.rotation.x = -adoucir(borner(k / 0.45)) * 1.48;
        const fin = borner((k - 0.5) / 0.5);
        disparition = fin;
        echelle = 1 - 0.5 * fin;
      } else {
        corps.rotation.x = penche;
      }
      corps.scale.setScalar(echelle);
      brasDroit.rotation.x = angleBras;
      brasGauche.rotation.x = angleGarde;
      dague.rotation.x = angleDague;
      // Les jambes restent d'aplomb quand le buste bascule ; à l'attaque il se fend, jambe droite en avant
      const fente = vivant && pose.phase === 'attaque' ? borner(penche / 0.42) : 0;
      jambes[0].rotation.x = vivant ? pas * 0.6 - penche - 0.5 * fente : 0;
      jambes[1].rotation.x = vivant ? -pas * 0.6 - penche + 0.25 * fente : 0;
      buste.position.y = 0.72 + Math.abs(Math.cos(phaseMarche)) * 0.025 * intensiteMarche + Math.sin(temps * 1.9) * 0.006;
      tete.rotation.y = vivant ? Math.sin(temps * 0.7) * 0.06 * (1 - intensiteMarche) : 0;
      // Il garde les yeux sur le joueur quand le buste bascule
      tete.rotation.x = vivant ? -penche * 0.7 : 0;

      objet.position.set(pose.x, pose.y, pose.z);
      objet.rotation.y = pose.orientation;
      teinte.mettreAJour(dt, disparition);
    },
    liberer() {
      libererGeometries(objet);
      teinte.liberer();
    },
  };
}

// --- Morvan le Balafré ------------------------------------------------------------------------

/**
 * Cape de Morvan : une nappe plissée (les plis se creusent vers le bas), plus large en bas, à l'ourlet irrégulier.
 * Elle pend de y = 0, le long de -y ; à dessiner avec un matériau double face.
 */
function geometrieCape(): THREE.BufferGeometry {
  const rangs = [
    { y: 0.02, demi: 0.33, z: -0.03, pli: 0.006 },
    { y: -0.3, demi: 0.4, z: -0.095, pli: 0.028 },
    { y: -0.72, demi: 0.47, z: -0.12, pli: 0.046 },
    { y: -1.12, demi: 0.53, z: -0.15, pli: 0.06 },
  ];
  const colonnes = 6;
  const positions: number[] = [];
  const indices: number[] = [];
  rangs.forEach((r, k) => {
    for (let i = 0; i <= colonnes; i++) {
      const signe = i % 2 === 0 ? -1 : 1;
      const ourlet = k === rangs.length - 1 ? signe * 0.035 : 0;
      positions.push((i / colonnes - 0.5) * 2 * r.demi, r.y + ourlet, r.z + signe * r.pli);
    }
  });
  const n = colonnes + 1;
  for (let k = 0; k < rangs.length - 1; k++) {
    for (let i = 0; i < colonnes; i++) {
      const a = k * n + i;
      indices.push(a, a + n, a + 1, a + 1, a + n, a + n + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}

/** Le chef des bandits : comme un ennemi, avec en plus l'annonce de sa charge. */
export interface ModeleMorvan extends ModeleEnnemi {
  /** Vrai pendant une charge : l'élan (phase « anticipation ») et la course (phase « attaque ») ont leur propre pose. */
  definirCharge(enCharge: boolean): void;
}

/** Taille de Morvan par rapport aux proportions d'un bandit */
const ECHELLE_MORVAN = 1.22;

/**
 * Morvan le Balafré, d'après docs/concepts/Chef des bandits low poly.png : carrure large, tunique de cuir renforcée
 * de plaques de fer sombre (plastron à arête, épaulières, brassards), grosse ceinture, barbe, balafre sur l'œil,
 * longue cape rouge sombre plissée et grande hache à deux mains.
 */
export function creerMorvan(): ModeleMorvan {
  const K = COULEURS_ENNEMIS;
  const mat = {
    cuir: creerMateriau(K.cuirMorvan),
    cuirSombre: creerMateriau(K.cuirMorvanSombre),
    // Pièces fusionnées, couleur portée par les sommets : cuir et tissu d'un côté, plaques de fer de l'autre
    equipement: creerMatiereFusionnee(),
    plaques: creerMatiereFusionnee(),
    cape: creerMateriau(K.capeMorvan, true),
    pantalon: creerMateriau(K.pantalonMorvan),
    bottes: creerMateriau(K.bottesBandit),
    peau: creerMateriau(K.peauMorvan),
    barbe: creerMateriau(K.barbe),
    balafre: creerMateriau(K.balafre),
    sombre: creerMateriau(K.sombre),
    manche: creerMateriau(K.gourdin),
    fer: creerMateriau(K.ferHache),
  };
  mat.fer.roughness = 0.5;
  mat.fer.metalness = 0.3;
  mat.plaques.roughness = 0.6;
  mat.plaques.metalness = 0.2;

  const at = creerAtelier();
  const E = mat.equipement;
  const F = mat.plaques;
  const objet = new THREE.Group();
  const corps = new THREE.Group();
  corps.scale.setScalar(ECHELLE_MORVAN);
  objet.add(corps);

  // Jambes : pantalon sombre, hautes bottes à revers
  const jambes = [-1, 1].map((cote) => {
    const hanche = new THREE.Group();
    hanche.position.set(cote * 0.14, 0.78, 0);
    hanche.add(
      maille(
        fuseau([
          { y: 0.05, rx: 0.125, rz: 0.13 },
          { y: -0.25, rx: 0.12, rz: 0.13 },
          { y: -0.46, rx: 0.1, rz: 0.11 },
        ]),
        mat.pantalon,
      ),
    );
    hanche.add(boite(0.25, 0.1, 0.26, mat.cuirSombre, 0, -0.44, 0));
    hanche.add(
      maille(
        fuseau([
          { y: -0.46, rx: 0.1, rz: 0.11 },
          { y: -0.74, rx: 0.095, rz: 0.105 },
        ]),
        mat.bottes,
      ),
    );
    hanche.add(boite(0.2, 0.11, 0.34, mat.bottes, 0, -0.725, 0.06));
    corps.add(hanche);
    return hanche;
  });

  // Buste large : tunique de cuir, plastron de fer sombre à arête et à pointe, grosse ceinture cloutée à boucle de
  // fer, pans de cuir sur les cuisses
  const buste = new THREE.Group();
  buste.position.y = 0.76;
  corps.add(buste);
  buste.add(
    maille(
      fuseau([
        { y: -0.16, rx: 0.27, rz: 0.17 },
        { y: 0.12, rx: 0.26, rz: 0.165 },
        { y: 0.44, rx: 0.31, rz: 0.19 },
        { y: 0.6, rx: 0.22, rz: 0.15 },
      ]),
      mat.cuir,
    ),
  );
  // Plastron : plaque sombre, et par-dessus des facettes plus claires qui se rejoignent sur une arête
  const contourPlastron: Array<[number, number]> = [
    [0, 0.55],
    [0.2, 0.55],
    [0.24, 0.43],
    [0.215, 0.29],
    [0, 0.17],
  ];
  at.poser(buste, F, plaque(contourPlastron, 0.024), K.ferNoir, pose(0, 0, 0.176));
  at.poser(
    buste,
    F,
    facettesArete(
      contourPlastron.map(([x, y]) => [x * 0.86, 0.37 + (y - 0.37) * 0.86]),
      0.04,
    ),
    K.ferSombre,
    pose(0, 0, 0.201),
  );
  // Bande de cuir sombre sous le plastron
  at.poser(
    buste,
    E,
    manchon([
      { y: 0.14, rx: 0.272, rz: 0.174 },
      { y: 0.3, rx: 0.3, rz: 0.186 },
    ]),
    K.cuirMorvanSombre,
  );
  // Grosse ceinture : boucle de fer, clous, bout de lanière qui pend
  at.poser(
    buste,
    E,
    manchon(
      [
        { y: 0.035, rx: 0.292, rz: 0.19 },
        { y: 0.165, rx: 0.292, rz: 0.19 },
      ],
      true,
    ),
    K.ceintureMorvan,
  );
  at.poser(buste, F, new THREE.BoxGeometry(0.18, 0.16, 0.03), K.ferHache, pose(0, 0.1, 0.2));
  at.poser(buste, E, new THREE.BoxGeometry(0.1, 0.085, 0.03), K.ceintureMorvan, pose(0, 0.1, 0.205));
  at.poser(buste, F, new THREE.BoxGeometry(0.075, 0.024, 0.03), K.rivet, pose(0.03, 0.1, 0.212));
  at.poser(buste, E, new THREE.BoxGeometry(0.07, 0.19, 0.022), K.ceintureMorvan, pose(0.125, -0.02, 0.203, 0, 0, 0.1));
  for (const cote of [-1, 1]) {
    at.poser(buste, F, new THREE.BoxGeometry(0.04, 0.04, 0.02), K.rivet, pose(cote * 0.19, 0.1, 0.193));
    // Sangles du plastron, par-dessus l'épaule, et leurs gros rivets
    at.poser(buste, E, new THREE.BoxGeometry(0.07, 0.24, 0.04), K.cuirMorvanSombre, pose(cote * 0.19, 0.5, 0.155));
    at.poser(buste, F, new THREE.CylinderGeometry(0.05, 0.05, 0.03, 6).rotateX(Math.PI / 2), K.rivet, pose(cote * 0.19, 0.515, 0.212));
  }
  // Pans de cuir sur les cuisses : un long devant, deux de chaque côté (le dos est sous la cape)
  at.pans(buste, E, { y: 0.05, rx: 0.275, rz: 0.178, incl: 0.14, pointe: 0.07 }, [
    [0, 0.2, 0.38, K.cuirMorvan],
    [40, 0.2, 0.3, K.cuirMorvanSombre],
    [-40, 0.2, 0.3, K.cuirMorvanSombre],
    [92, 0.22, 0.33, K.cuirMorvan],
    [-92, 0.22, 0.33, K.cuirMorvan],
  ]);
  // Foulard sombre autour du cou, en pointe sur le haut du plastron
  at.poser(
    buste,
    E,
    fuseau([
      { y: 0.52, rx: 0.2, rz: 0.17 },
      { y: 0.66, rx: 0.14, rz: 0.13 },
    ]),
    K.capeMorvanSombre,
  );
  at.poser(buste, E, new THREE.ConeGeometry(0.13, 0.17, 4).scale(1, 1, 0.3), K.capeMorvanSombre, pose(0, 0.5, 0.2, Math.PI));
  // Haut de la cape, froncé sur les épaules derrière le cou
  at.poser(
    buste,
    E,
    fuseau([
      { y: 0.47, rx: 0.3, rz: 0.055, dz: -0.15 },
      { y: 0.62, rx: 0.18, rz: 0.07, dz: -0.1 },
    ]),
    K.capeMorvan,
  );

  // Cape rouge sombre : des épaules aux mollets, plissée, plus large en bas ; elle se soulève en courant
  const cape = new THREE.Group();
  cape.position.set(0, 0.58, -0.15);
  cape.add(maille(geometrieCape(), mat.cape));
  buste.add(cape);

  // Tête : mâchoire carrée, barbe, cheveux courts, sourcils froncés, balafre en travers de l'œil gauche
  const tete = new THREE.Group();
  tete.position.y = 0.64;
  buste.add(tete);
  tete.add(
    maille(
      fuseau([
        { y: 0, rx: 0.12, rz: 0.125 },
        { y: 0.1, rx: 0.15, rz: 0.145 },
        { y: 0.28, rx: 0.15, rz: 0.145 },
        { y: 0.35, rx: 0.11, rz: 0.11 },
      ]),
      mat.peau,
    ),
  );
  tete.add(
    maille(
      fuseau([
        { y: -0.04, rx: 0.1, rz: 0.1, dz: 0.03 },
        { y: 0.06, rx: 0.158, rz: 0.15, dz: 0.012 },
        { y: 0.15, rx: 0.156, rz: 0.13, dz: 0.03 },
      ]),
      mat.barbe,
    ),
  );
  tete.add(boite(0.13, 0.03, 0.03, mat.barbe, 0, 0.165, 0.15));
  tete.add(
    maille(
      fuseau([
        { y: 0.27, rx: 0.16, rz: 0.155, dz: -0.01 },
        { y: 0.37, rx: 0.14, rz: 0.14, dz: -0.015 },
        { y: 0.41, rx: 0.07, rz: 0.08, dz: -0.01 },
      ]),
      mat.barbe,
    ),
  );
  tete.add(boite(0.05, 0.07, 0.04, mat.peau, 0, 0.2, 0.16));
  for (const cote of [-1, 1]) {
    tete.add(boite(0.04, 0.03, 0.02, mat.sombre, cote * 0.065, 0.235, 0.144));
    const sourcil = boite(0.085, 0.03, 0.03, mat.barbe, cote * 0.066, 0.272, 0.146);
    sourcil.rotation.z = cote * 0.3;
    tete.add(sourcil);
  }
  const balafre = boite(0.022, 0.19, 0.012, mat.balafre, 0.075, 0.23, 0.152);
  balafre.rotation.z = 0.32;
  tete.add(balafre);

  // Bras épais : manches courtes de cuir sous de larges épaulières de fer, avant-bras nus pris dans des brassards
  // de fer cerclés. Le droit (côté -x) tient la hache.
  const bras = [-1, 1].map((cote) => {
    const epaule = new THREE.Group();
    epaule.position.set(cote * 0.38, 0.5, 0);
    epaule.rotation.z = cote * 0.12;
    epaule.add(
      maille(
        fuseau([
          { y: 0.05, rx: 0.1, rz: 0.105 },
          { y: -0.22, rx: 0.1, rz: 0.105 },
        ]),
        mat.cuir,
      ),
    );
    epaule.add(
      maille(
        fuseau([
          { y: -0.2, rx: 0.085, rz: 0.09 },
          { y: -0.32, rx: 0.08, rz: 0.085 },
        ]),
        mat.peau,
      ),
    );
    // Épaulière : calotte de fer bordée d'un cercle plus sombre, rivet, et dessous une lame de cuir
    const dx = cote * 0.025;
    at.poser(
      epaule,
      E,
      manchon(
        [
          { y: -0.17, rx: 0.135, rz: 0.15, dx },
          { y: -0.05, rx: 0.14, rz: 0.155, dx },
        ],
        true,
      ),
      K.cuirMorvanClair,
    );
    at.poser(
      epaule,
      F,
      fuseau([
        { y: -0.07, rx: 0.152, rz: 0.168, dx },
        { y: 0.035, rx: 0.152, rz: 0.168, dx },
        { y: 0.1, rx: 0.095, rz: 0.115, dx: cote * 0.005 },
      ]),
      K.ferSombre,
    );
    at.poser(
      epaule,
      F,
      manchon(
        [
          { y: -0.1, rx: 0.161, rz: 0.177, dx },
          { y: -0.058, rx: 0.161, rz: 0.177, dx },
        ],
        true,
      ),
      K.ferNoir,
    );
    at.poser(epaule, F, new THREE.BoxGeometry(0.024, 0.045, 0.045), K.rivet, pose(dx + cote * 0.156, -0.01, 0));
    // Brassard cerclé aux deux bouts
    at.poser(
      epaule,
      F,
      fuseau([
        { y: -0.3, rx: 0.095, rz: 0.1 },
        { y: -0.5, rx: 0.085, rz: 0.09 },
      ]),
      K.ferSombre,
    );
    for (const [y, r] of [
      [-0.335, 0.103],
      [-0.51, 0.093],
    ]) {
      at.poser(
        epaule,
        F,
        manchon(
          [
            { y, rx: r, rz: r + 0.005 },
            { y: y + 0.042, rx: r, rz: r + 0.005 },
          ],
          true,
        ),
        K.ferNoir,
      );
    }
    epaule.add(boite(0.13, 0.12, 0.14, mat.peau, 0, -0.56, 0.01));
    buste.add(epaule);
    return epaule;
  });
  const [brasDroit, brasGauche] = bras;

  // Grande hache : long manche, fer large à un tranchant (vers l'avant), talon ferré. La main la tient à l'origine.
  const hache = new THREE.Group();
  hache.position.set(0, -0.56, 0.1);
  hache.add(maille(new THREE.CylinderGeometry(0.03, 0.034, 1.9, 6), mat.manche, 0, 0.45, 0));
  hache.add(boite(0.075, 0.1, 0.075, mat.fer, 0, -0.52, 0));
  hache.add(boite(0.1, 0.22, 0.13, mat.fer, 0, 1.22, 0));
  const fer = new THREE.Shape();
  fer.moveTo(0.04, -0.09);
  fer.lineTo(0.2, -0.3);
  fer.lineTo(0.34, -0.1);
  fer.lineTo(0.36, 0.14);
  fer.lineTo(0.22, 0.36);
  fer.lineTo(0.04, 0.09);
  fer.closePath();
  // Le fer est dessiné dans le plan x-y puis tourné : son tranchant regarde +z (l'avant)
  hache.add(maille(new THREE.ExtrudeGeometry(fer, { depth: 0.045, bevelEnabled: false }).translate(0, 0, -0.0225).rotateY(-Math.PI / 2), mat.fer, 0, 1.22, 0.02));
  brasDroit.add(hache);
  at.finir();

  const teinte = creerTeinte(Object.values(mat));
  let temps = 0;
  let phaseMarche = 0;
  let intensiteMarche = 0;
  let enCharge = false;
  // Valeurs affichées, lissées d'une image à l'autre
  let angleBras = 0;
  let angleGauche = 0;
  let angleHache = 0;
  let penche = 0;
  let accroupi = 0;

  return {
    objet,
    hauteur: 2.0 * ECHELLE_MORVAN,
    flash: () => teinte.flash(),
    definirCharge(v) {
      enCharge = v;
    },
    mettreAJour(dt, pose) {
      temps += dt;
      const vivant = pose.phase !== 'mort';
      const course = enCharge && pose.phase === 'attaque';
      intensiteMarche += ((vivant && pose.enMouvement ? 1 : 0) - intensiteMarche) * Math.min(1, dt * 10);
      phaseMarche += dt * (course ? 16 : 8) * intensiteMarche;
      const pas = Math.sin(phaseMarche) * intensiteMarche;

      // Au repos la hache est tenue droite, le fer au-dessus de l'épaule. Coup lourd : les deux bras la lèvent
      // au-dessus de la tête (longtemps : c'est l'annonce), puis l'abattent. Charge : il se ramasse, la hache
      // pointée devant lui comme un bélier, puis fonce penché en avant.
      let brasCible = -0.12 + pas * 0.2;
      let gaucheCible = -pas * 0.4;
      let hacheCible = -brasCible;
      let pencheCible = 0.05 * intensiteMarche;
      let accroupiCible = 0;
      let vitesseGeste = 10;
      if (enCharge && pose.phase === 'anticipation') {
        brasCible = -0.45;
        gaucheCible = -0.9;
        hacheCible = 1.45;
        pencheCible = 0.38;
        accroupiCible = 1;
        vitesseGeste = 9;
      } else if (course) {
        brasCible = -0.8;
        gaucheCible = -1.0;
        hacheCible = 1.5;
        pencheCible = 0.62;
        accroupiCible = 0.4;
        vitesseGeste = 22;
      } else if (pose.phase === 'poursuite') {
        brasCible = -0.8 + pas * 0.1;
        gaucheCible = -0.7 - pas * 0.2;
        hacheCible = 1.05;
        pencheCible = 0.12;
      } else if (pose.phase === 'anticipation') {
        const k = adoucir(pose.anticipation);
        brasCible = -0.8 - 1.95 * k;
        gaucheCible = -0.7 - 1.9 * k;
        hacheCible = 1.05 + (Math.PI + 0.25 - 1.05) * k;
        pencheCible = 0.12 - 0.42 * k;
        vitesseGeste = 16;
      } else if (pose.phase === 'attaque') {
        brasCible = -0.85;
        gaucheCible = -0.75;
        hacheCible = 2.3;
        pencheCible = 0.5;
        vitesseGeste = 34;
      } else if (pose.phase === 'recul') {
        brasCible = -0.6;
        gaucheCible = -0.8;
        hacheCible = 0.9;
        pencheCible = -0.2;
        vitesseGeste = 24;
      } else if (pose.phase === 'etourdi') {
        brasCible = -0.25;
        gaucheCible = 0.2;
        hacheCible = 0.5;
        pencheCible = -0.14;
      }
      const lissage = Math.min(1, dt * vitesseGeste);
      angleBras += (brasCible - angleBras) * lissage;
      angleGauche += (gaucheCible - angleGauche) * lissage;
      angleHache += (hacheCible - angleHache) * lissage;
      penche += (pencheCible - penche) * lissage;
      accroupi += (accroupiCible - accroupi) * lissage;

      let disparition = 0;
      let echelle = ECHELLE_MORVAN;
      if (!vivant) {
        // Il bascule en avant, lentement, avant de s'effacer
        const k = borner(pose.tempsPhase / DUREE_MORT);
        corps.rotation.x = adoucir(borner(k / 0.5)) * 1.45;
        const fin = borner((k - 0.55) / 0.45);
        disparition = fin;
        echelle = ECHELLE_MORVAN * (1 - 0.4 * fin);
      } else {
        corps.rotation.x = penche;
      }
      corps.scale.setScalar(echelle);
      corps.position.y = vivant ? -0.1 * accroupi : 0;
      brasDroit.rotation.x = angleBras;
      // À deux mains pour le coup lourd : le bras gauche rejoint le manche
      brasGauche.rotation.x = angleGauche;
      brasGauche.rotation.z = 0.12 - borner(-angleGauche - 0.6) * 0.45;
      hache.rotation.x = angleHache;
      const fente = vivant && pose.phase === 'attaque' && !course ? borner(penche / 0.5) : 0;
      const foulee = course ? 0.95 : 0.55;
      jambes[0].rotation.x = vivant ? pas * foulee - penche - 0.45 * fente : 0;
      jambes[1].rotation.x = vivant ? -pas * foulee - penche + 0.25 * fente : 0;
      buste.position.y = 0.76 + Math.abs(Math.cos(phaseMarche)) * 0.03 * intensiteMarche + Math.sin(temps * 1.5) * 0.008;
      // Étourdi : la tête dodeline
      tete.rotation.y = vivant ? (pose.phase === 'etourdi' ? Math.sin(temps * 9) * 0.25 : Math.sin(temps * 0.6) * 0.07 * (1 - intensiteMarche)) : 0;
      tete.rotation.x = vivant ? -penche * 0.7 : 0;
      cape.rotation.x = vivant ? 0.06 + penche * 0.5 + intensiteMarche * (course ? 0.9 : 0.22) + Math.sin(temps * 2.1) * 0.03 : 0;

      objet.position.set(pose.x, pose.y, pose.z);
      objet.rotation.y = pose.orientation;
      teinte.mettreAJour(dt, disparition);
    },
    liberer() {
      libererGeometries(objet);
      teinte.liberer();
    },
  };
}

export function creerModeleEnnemi(type: TypeModeleEnnemi): ModeleEnnemi {
  switch (type) {
    case 'slime':
      return creerSlime();
    case 'gobelin':
      return creerGobelin();
    case 'loup':
      return creerLoup();
    case 'bandit':
      return creerBandit();
  }
}
