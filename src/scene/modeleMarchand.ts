// Marchand ambulant et sa charrette, modelés en code d'après docs/concepts/Marchand ambulant, vue face et profil.png :
// un bonhomme trapu et rieur, chapeau brun à large bord, barbe, foulard rayé, tunique orange, bâton de marche,
// et un énorme sac à dos chargé de rouleaux d'étoffe, d'outils, de marmites et d'une lanterne.
// Repère : pieds à l'origine, l'avant regarde +z (son côté droit est donc en -x) ; la charrette est décalée de
// CONFIG.marchand.charrette dans ce repère.
// Aucune règle de jeu ici : la présence et la position viennent de src/regles/marchand.ts.
// Aucune lumière non plus : la lanterne ne brille que par son émissif.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { facettesMasse, geometrieCouleurs, tonSombre, type Coiffure } from './coiffures';
import { boite, creerMateriau, fuseau, galet, maille, type Anneau } from './outils';

export interface PoseMarchand {
  x: number;
  y: number;
  z: number;
  orientation: number;
  /** Lacet de la tête par rapport au corps, en radians (la tête suit le joueur) */
  regard: number;
}

export interface ModeleMarchand {
  readonly objet: THREE.Group;
  mettreAJour(dt: number, pose: PoseMarchand): void;
}

const COULEURS = {
  peau: 0xf2b58a,
  nez: 0xe88a78,
  oeil: 0x3a2618,
  barbe: 0x7a4a2e,
  bouche: 0x5a2a22,
  dents: 0xf6efe2,
  pantalon: 0x6b4433,
  bottes: 0x7a4a2c,
  revers: 0x93603a,
  tunique: 0xe8762c,
  creme: 0xf0d9ae,
  ceinture: 0x6e4226,
  boucle: 0xa8a8a8,
  foulardRouge: 0xc8475a,
  foulardJaune: 0xe9a23b,
  foulardBleu: 0x2f8f8c,
  chapeau: 0x8a5233,
  bandeau: 0xb5743a,
  sac: 0x8a5530,
  sacSombre: 0x6e4226,
  sangle: 0xa8703c,
  marmite: 0x5d6068,
  rouleauCreme: 0xead7ae,
  rouleauRose: 0xb85c7c,
  rouleauBleu: 0x5b86ad,
  baton: 0x8a4f2c,
  fer: 0x7c8088,
  lanterne: 0x4a3a36,
  // Charrette
  bois: 0x8a5a33,
  boisSombre: 0x5e3d1e,
  toile: 0xe8d9a8,
  toileVerte: 0x6c9a42,
  sacToile: 0xd8c690,
} as const;

// Verre de la lanterne : jaune chaud, lumineux par l'émissif seulement (aucune lumière ajoutée à la scène)
const VERRE_LANTERNE = { couleur: 0xffd27a, emissif: 0xffb23c, intensite: 0.9 };

type Materiaux = Record<keyof typeof COULEURS, THREE.MeshStandardMaterial>;

function creerMateriaux(): Materiaux {
  const resultat = {} as Materiaux;
  for (const [nom, couleur] of Object.entries(COULEURS)) resultat[nom as keyof Materiaux] = creerMateriau(couleur);
  return resultat;
}

// Tranches du crâne (repère de la tête, pivot au cou). Les cheveux s'appuient dessus.
const CRANE: Anneau[] = [
  { y: 0, rx: 0.15, rz: 0.14, c: 0.05, dz: 0.02 },
  { y: 0.07, rx: 0.225, rz: 0.2, c: 0.075 },
  { y: 0.21, rx: 0.24, rz: 0.21, c: 0.08 },
  { y: 0.35, rx: 0.225, rz: 0.2, c: 0.08 },
  { y: 0.43, rx: 0.15, rz: 0.14, c: 0.05 },
];

// Cheveux bruns courts, en une seule masse à facettes (voir coiffures.ts) : le dessus reste sous le chapeau,
// les favoris descendent dans la barbe devant les oreilles, la nuque est couverte jusqu'au col.
const COIFFURE: Coiffure = {
  crane: CRANE,
  sommet: [0, 0.475, 0],
  centreY: 0.27,
  ry: 0.2,
  rx: 0.275,
  rzAvant: 0.235,
  rzArriere: 0.27,
  basY: 0.07,
  resserre: 0.22,
  epaisseur: 0.028,
  epaisseurBord: 0.014,
  bord: [
    [0, 0.375],
    [25, 0.375],
    [45, 0.365],
    [56, 0.3],
    [64, 0.2],
    [72, 0.2],
    [80, 0.295],
    [92, 0.3],
    [104, 0.29],
    [116, 0.16],
    [138, 0.09],
    [160, 0.075],
    [180, 0.075],
  ],
  pivotY: 0.4,
  etagesBas: [0, 0.33, 0.68, 1],
  etagesHaut: [0.44, 0.462],
  desordre: 0.014,
};

/** Plaque plate dans le plan xy (face vers +z), de contour donné : sert aux bandes du foulard. */
function plaque(points: ReadonlyArray<readonly [number, number]>, materiau: THREE.Material, z: number): THREE.Mesh {
  const forme = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  return maille(new THREE.ShapeGeometry(forme), materiau, 0, 0, z);
}

/** Cylindre à pans, couché ou penché : `inclinaison` autour de z, puis `bascule` autour de x. */
function cylindre(rayonHaut: number, rayonBas: number, hauteur: number, pans: number, materiau: THREE.Material, x: number, y: number, z: number, inclinaison = 0, bascule = 0): THREE.Mesh {
  const c = maille(new THREE.CylinderGeometry(rayonHaut, rayonBas, hauteur, pans), materiau, x, y, z);
  c.rotation.set(bascule, 0, inclinaison);
  return c;
}

/** Marmite ventrue pendue par son anse : l'origine est en haut de l'anse (là où elle s'accroche). */
function creerMarmite(mat: Materiaux, taille: number): THREE.Group {
  const marmite = new THREE.Group();
  marmite.add(
    maille(
      fuseau([
        { y: -0.36, rx: 0.07, rz: 0.07 },
        { y: -0.31, rx: 0.14, rz: 0.14 },
        { y: -0.2, rx: 0.155, rz: 0.155 },
        { y: -0.14, rx: 0.115, rz: 0.115 },
        { y: -0.12, rx: 0.13, rz: 0.13 },
      ]),
      mat.marmite,
    ),
  );
  // Anse : un demi-anneau à pans, vu de face
  marmite.add(maille(new THREE.TorusGeometry(0.1, 0.016, 4, 6, Math.PI), mat.marmite, 0, -0.11, 0));
  marmite.scale.setScalar(taille);
  return marmite;
}

/** Lanterne pendue par son anneau : l'origine est en haut de l'anneau. */
function creerLanterne(mat: Materiaux): THREE.Group {
  const lanterne = new THREE.Group();
  const verre = creerMateriau(VERRE_LANTERNE.couleur);
  verre.emissive.setHex(VERRE_LANTERNE.emissif);
  verre.emissiveIntensity = VERRE_LANTERNE.intensite;
  const anneau = maille(new THREE.TorusGeometry(0.035, 0.01, 4, 6), mat.lanterne, 0, -0.035, 0);
  lanterne.add(anneau);
  // Chapeau en pyramide, verre, socle et quatre montants
  const toit = maille(new THREE.ConeGeometry(0.095, 0.07, 4), mat.lanterne, 0, -0.1, 0);
  toit.rotation.y = Math.PI / 4;
  lanterne.add(toit);
  lanterne.add(boite(0.1, 0.15, 0.1, verre, 0, -0.21, 0));
  lanterne.add(boite(0.14, 0.025, 0.14, mat.lanterne, 0, -0.14, 0));
  lanterne.add(boite(0.14, 0.03, 0.14, mat.lanterne, 0, -0.295, 0));
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
    lanterne.add(boite(0.022, 0.15, 0.022, mat.lanterne, x * 0.055, -0.215, z * 0.055));
  }
  return lanterne;
}

export function creerModeleMarchand(): ModeleMarchand {
  const mat = creerMateriaux();
  const objet = new THREE.Group();
  objet.name = 'marchand';

  // --- Le marchand ---
  const corps = new THREE.Group();
  objet.add(corps);

  // Jambes courtes : pantalon bouffant, bottes à revers
  for (const cote of [-1, 1]) {
    const jambe = new THREE.Group();
    jambe.position.x = cote * 0.15;
    jambe.add(
      maille(
        fuseau([
          { y: 0.32, rx: 0.1, rz: 0.105 },
          { y: 0.46, rx: 0.135, rz: 0.135 },
          { y: 0.7, rx: 0.13, rz: 0.135 },
        ]),
        mat.pantalon,
      ),
    );
    jambe.add(
      maille(
        fuseau([
          { y: 0, rx: 0.105, rz: 0.16, dz: 0.045 },
          { y: 0.085, rx: 0.105, rz: 0.16, dz: 0.045 },
          { y: 0.15, rx: 0.095, rz: 0.105 },
          { y: 0.3, rx: 0.1, rz: 0.108 },
        ]),
        mat.bottes,
      ),
    );
    jambe.add(
      maille(
        fuseau([
          { y: 0.27, rx: 0.115, rz: 0.122 },
          { y: 0.36, rx: 0.12, rz: 0.127 },
        ]),
        mat.revers,
      ),
    );
    corps.add(jambe);
  }

  // Buste (pivot à la taille : il respire) : tunique orange ventrue, ouverte sur une chemise crème
  const TAILLE = 0.68;
  const torse = new THREE.Group();
  torse.position.y = TAILLE;
  corps.add(torse);
  torse.add(
    maille(
      fuseau([
        { y: -0.12, rx: 0.37, rz: 0.275, c: 0.09 },
        { y: 0.1, rx: 0.335, rz: 0.255, c: 0.085 },
        { y: 0.3, rx: 0.345, rz: 0.265, c: 0.09 },
        { y: 0.5, rx: 0.31, rz: 0.225, c: 0.08 },
        { y: 0.6, rx: 0.19, rz: 0.15, c: 0.05 },
      ]),
      mat.tunique,
    ),
  );
  torse.add(boite(0.12, 0.3, 0.02, mat.creme, 0, 0.3, 0.258));
  // Ceinture et boucle
  torse.add(
    maille(
      fuseau([
        { y: 0.06, rx: 0.345, rz: 0.265, c: 0.085 },
        { y: 0.14, rx: 0.345, rz: 0.265, c: 0.085 },
      ]),
      mat.ceinture,
    ),
  );
  torse.add(boite(0.13, 0.1, 0.03, mat.boucle, 0, 0.1, 0.268));
  torse.add(boite(0.07, 0.05, 0.03, mat.ceinture, 0, 0.1, 0.274));
  // Bretelles du sac, des épaules à la ceinture
  for (const cote of [-1, 1]) {
    const bretelle = boite(0.06, 0.42, 0.03, mat.sacSombre, cote * 0.215, 0.33, 0.252);
    bretelle.rotation.z = cote * 0.08;
    torse.add(bretelle);
  }
  // Foulard : un col rouge autour du cou, et une pointe sur la poitrine rayée de jaune et de bleu-vert
  torse.add(
    maille(
      fuseau([
        { y: 0.47, rx: 0.3, rz: 0.235, c: 0.08 },
        { y: 0.56, rx: 0.25, rz: 0.2, c: 0.07 },
        { y: 0.63, rx: 0.17, rz: 0.15, c: 0.05 },
      ]),
      mat.foulardRouge,
    ),
  );
  const pointe = new THREE.Group();
  pointe.position.set(0, 0, 0.268);
  pointe.rotation.x = 0.06;
  pointe.add(plaque([[-0.25, 0.53], [0.06, 0.2], [0.25, 0.53]], mat.foulardRouge, 0));
  pointe.add(plaque([[0.03, 0.53], [-0.09, 0.36], [-0.015, 0.28], [0.14, 0.53]], mat.foulardJaune, 0.004));
  pointe.add(plaque([[0.14, 0.53], [-0.015, 0.28], [0.06, 0.2], [0.25, 0.53]], mat.foulardBleu, 0.004));
  torse.add(pointe);

  // Bras : manche orange, revers crème, poing. `epauleX` et `coudeX` plient le bras vers l'avant, `rentre` ramène
  // l'avant-bras vers la poitrine.
  function creerBras(cote: number, epauleX: number, coudeX: number, rentre: number): THREE.Group {
    const epaule = new THREE.Group();
    epaule.position.set(cote * 0.37, 0.47, 0);
    epaule.rotation.set(epauleX, 0, cote * 0.16);
    epaule.add(
      maille(
        fuseau([
          { y: -0.27, rx: 0.088, rz: 0.095 },
          { y: -0.03, rx: 0.1, rz: 0.105 },
          { y: 0.04, rx: 0.075, rz: 0.08 },
        ]),
        mat.tunique,
      ),
    );
    const coude = new THREE.Group();
    coude.position.y = -0.26;
    coude.rotation.set(coudeX, 0, -cote * rentre);
    coude.add(
      maille(
        fuseau([
          { y: -0.2, rx: 0.1, rz: 0.105 },
          { y: 0.03, rx: 0.086, rz: 0.092 },
        ]),
        mat.tunique,
      ),
    );
    coude.add(
      maille(
        fuseau([
          { y: -0.255, rx: 0.098, rz: 0.103 },
          { y: -0.19, rx: 0.106, rz: 0.111 },
        ]),
        mat.creme,
      ),
    );
    coude.add(
      maille(
        fuseau([
          { y: -0.39, rx: 0.06, rz: 0.07 },
          { y: -0.355, rx: 0.082, rz: 0.092 },
          { y: -0.28, rx: 0.084, rz: 0.094 },
          { y: -0.245, rx: 0.065, rz: 0.07 },
        ]),
        mat.peau,
      ),
    );
    epaule.add(coude);
    torse.add(epaule);
    return epaule;
  }
  // Bras droit : avant-bras tendu vers l'avant, le poing sur le bâton. Bras gauche : main remontée sur la bretelle.
  creerBras(-1, 0.12, -1.25, 0);
  creerBras(1, -0.45, -1.55, 0.75);

  // Bâton de marche, planté devant son pied droit : une branche noueuse, plus épaisse et recourbée en haut
  corps.add(
    maille(
      fuseau([
        { y: 0, rx: 0.022, rz: 0.022 },
        { y: 0.45, rx: 0.028, rz: 0.027, dx: 0.012 },
        { y: 0.9, rx: 0.03, rz: 0.029, dx: -0.008 },
        { y: 1.25, rx: 0.036, rz: 0.034, dx: 0.006 },
        { y: 1.42, rx: 0.046, rz: 0.042, dx: 0.02 },
        { y: 1.5, rx: 0.036, rz: 0.034, dx: 0.05 },
      ]),
      mat.baton,
      -0.5,
      0,
      0.31,
    ),
  );

  // Tête (pivot au cou : elle suit le joueur du regard)
  const tete = new THREE.Group();
  tete.position.y = TAILLE + 0.58;
  corps.add(tete);
  tete.add(maille(fuseau(CRANE), mat.peau));
  // Barbe : elle enveloppe la mâchoire et le menton, des oreilles au cou
  tete.add(
    maille(
      fuseau([
        { y: -0.07, rx: 0.11, rz: 0.09, dz: 0.1 },
        { y: 0.0, rx: 0.22, rz: 0.17, c: 0.07, dz: 0.06 },
        { y: 0.1, rx: 0.252, rz: 0.2, c: 0.08, dz: 0.03 },
        { y: 0.2, rx: 0.248, rz: 0.195, c: 0.08, dz: 0.026 },
      ]),
      mat.barbe,
    ),
  );
  // Cheveux : une masse continue sous le chapeau (matériau blanc, deux tons de brun portés par les facettes)
  const matCheveux = creerMateriau(0xffffff);
  matCheveux.vertexColors = true;
  tete.add(maille(geometrieCouleurs(facettesMasse(COIFFURE), [COULEURS.barbe, tonSombre(COULEURS.barbe)]), matCheveux));
  // Grand sourire : bouche ouverte, dents du haut
  tete.add(boite(0.16, 0.07, 0.03, mat.bouche, 0, 0.1, 0.222));
  tete.add(boite(0.13, 0.03, 0.03, mat.dents, 0, 0.118, 0.226));
  for (const cote of [-1, 1]) {
    // Moustache, joue, œil rieur (fermé, en accent circonflexe), sourcil, oreille
    const moustache = maille(galet(0.075, 0.03, 0.03), mat.barbe, cote * 0.065, 0.158, 0.232);
    moustache.rotation.z = -cote * 0.3;
    tete.add(moustache);
    for (const pente of [-1, 1]) {
      const trait = boite(0.045, 0.016, 0.02, mat.oeil, cote * 0.105 + pente * 0.017, 0.262, 0.205);
      trait.rotation.z = -pente * 0.55;
      tete.add(trait);
    }
    const sourcil = boite(0.08, 0.026, 0.024, mat.barbe, cote * 0.105, 0.318, 0.202);
    sourcil.rotation.z = cote * 0.18;
    tete.add(sourcil);
    tete.add(boite(0.04, 0.09, 0.07, mat.peau, cote * 0.245, 0.24, 0));
  }
  tete.add(maille(galet(0.046, 0.04, 0.05), mat.nez, 0, 0.21, 0.235));
  // Chapeau : large bord en pente, bandeau clair, calotte pointue qui retombe vers l'arrière
  const chapeau = new THREE.Group();
  chapeau.position.set(0, 0.37, -0.01);
  chapeau.rotation.x = -0.1;
  chapeau.add(maille(new THREE.CylinderGeometry(0.22, 0.4, 0.1, 8), mat.chapeau, 0, 0.03, 0));
  chapeau.add(maille(new THREE.CylinderGeometry(0.205, 0.225, 0.07, 8), mat.bandeau, 0, 0.105, 0));
  chapeau.add(maille(new THREE.CylinderGeometry(0.14, 0.2, 0.11, 8), mat.chapeau, 0, 0.19, 0));
  const bout = maille(new THREE.ConeGeometry(0.14, 0.16, 8), mat.chapeau, 0, 0.29, -0.05);
  bout.rotation.x = -0.7;
  chapeau.add(bout);
  tete.add(chapeau);

  // Sac à dos : une grosse hotte ventrue, sanglée, d'où dépassent rouleaux d'étoffe et outils
  const sac = new THREE.Group();
  sac.position.set(0, 0, -0.52);
  corps.add(sac);
  sac.add(
    maille(
      fuseau([
        { y: 0.5, rx: 0.3, rz: 0.2, c: 0.1 },
        { y: 0.68, rx: 0.42, rz: 0.29, c: 0.13 },
        { y: 1.15, rx: 0.45, rz: 0.3, c: 0.13 },
        { y: 1.42, rx: 0.4, rz: 0.27, c: 0.12 },
      ]),
      mat.sac,
    ),
  );
  // Bord renforcé de l'ouverture, sangle en travers et sangle du dos
  sac.add(
    maille(
      fuseau([
        { y: 1.38, rx: 0.415, rz: 0.285, c: 0.125 },
        { y: 1.46, rx: 0.415, rz: 0.285, c: 0.125 },
      ]),
      mat.sacSombre,
    ),
  );
  sac.add(
    maille(
      fuseau([
        { y: 1.02, rx: 0.462, rz: 0.312, c: 0.135 },
        { y: 1.09, rx: 0.462, rz: 0.312, c: 0.135 },
      ]),
      mat.sangle,
    ),
  );
  sac.add(boite(0.08, 0.42, 0.03, mat.sangle, 0, 1.25, -0.3));
  // Rouleaux d'étoffe debout dans l'ouverture : crème, rose, bleu (le bout en spirale est plus sombre)
  const rouleaux: ReadonlyArray<readonly [THREE.Material, number, number, number, number, number, number, number]> = [
    [mat.rouleauCreme, 0.125, 0.52, -0.12, 1.66, -0.05, 0.1, -0.06],
    [mat.rouleauRose, 0.105, 0.5, 0.13, 1.64, -0.09, -0.22, -0.1],
    [mat.rouleauBleu, 0.09, 0.36, 0.27, 1.55, 0.1, -0.12, 0.06],
  ];
  for (const [materiau, rayon, hauteur, x, y, z, inclinaison, bascule] of rouleaux) {
    const rouleau = new THREE.Group();
    rouleau.position.set(x, y, z);
    rouleau.rotation.set(bascule, 0, inclinaison);
    rouleau.add(maille(new THREE.CylinderGeometry(rayon, rayon, hauteur, 7), materiau));
    rouleau.add(maille(new THREE.CylinderGeometry(rayon * 0.45, rayon * 0.45, 0.02, 7), mat.sacSombre, 0, hauteur / 2 + 0.004, 0));
    sac.add(rouleau);
  }
  // Pioche (à sa droite) et maillet de bois (à sa gauche) qui dépassent du sac
  const pioche = new THREE.Group();
  pioche.position.set(-0.36, 1.4, 0.02);
  pioche.rotation.z = 0.38;
  pioche.add(cylindre(0.024, 0.024, 0.6, 6, mat.baton, 0, 0.1, 0));
  pioche.add(boite(0.075, 0.08, 0.07, mat.fer, 0, 0.4, 0));
  for (const cote of [-1, 1]) {
    const bec = maille(new THREE.ConeGeometry(0.036, 0.19, 4), mat.fer, cote * 0.12, 0.385, 0);
    bec.rotation.z = -cote * (Math.PI / 2 + 0.25);
    pioche.add(bec);
  }
  sac.add(pioche);
  const maillet = new THREE.Group();
  maillet.position.set(0.4, 1.38, 0.0);
  maillet.rotation.z = -0.42;
  maillet.add(cylindre(0.024, 0.024, 0.5, 6, mat.baton, 0, 0.08, 0));
  maillet.add(boite(0.21, 0.11, 0.11, mat.sangle, 0, 0.37, 0));
  sac.add(maillet);
  // Marmites pendues de chaque côté, et lanterne allumée accrochée en haut à sa gauche
  const marmiteDroite = creerMarmite(mat, 1.15);
  marmiteDroite.position.set(-0.5, 1.08, 0.06);
  marmiteDroite.rotation.y = 0.35;
  sac.add(marmiteDroite);
  const marmiteGauche = creerMarmite(mat, 1);
  marmiteGauche.position.set(0.52, 0.98, -0.02);
  marmiteGauche.rotation.y = -0.5;
  sac.add(marmiteGauche);
  const marmiteDos = creerMarmite(mat, 0.9);
  marmiteDos.position.set(0.2, 1.0, -0.34);
  sac.add(marmiteDos);
  sac.add(boite(0.26, 0.03, 0.03, mat.sacSombre, 0.47, 1.425, 0.12));
  const lanterne = creerLanterne(mat);
  lanterne.position.set(0.56, 1.42, 0.12);
  lanterne.rotation.y = 0.3;
  sac.add(lanterne);

  // --- La charrette, à côté de lui ---
  const { x: cx, z: cz } = CONFIG.marchand.charrette;
  const charrette = new THREE.Group();
  charrette.position.set(cx, 0, cz);
  objet.add(charrette);
  const bois = mat.bois;
  const boisSombre = mat.boisSombre;
  // Plateau et ridelles
  charrette.add(boite(1.7, 0.1, 0.9, bois, 0, 0.6, 0));
  charrette.add(boite(1.7, 0.2, 0.06, boisSombre, 0, 0.75, 0.43));
  charrette.add(boite(1.7, 0.2, 0.06, boisSombre, 0, 0.75, -0.43));
  charrette.add(boite(0.06, 0.2, 0.9, boisSombre, 0.82, 0.75, 0));
  charrette.add(boite(0.06, 0.2, 0.9, boisSombre, -0.82, 0.75, 0));
  // Deux roues (axe le long de z) et le timon
  for (const cote of [-1, 1]) {
    const roue = maille(new THREE.CylinderGeometry(0.36, 0.36, 0.07, 10), boisSombre, 0.1, 0.36, cote * 0.52);
    roue.rotation.x = Math.PI / 2;
    charrette.add(roue);
    const moyeu = maille(new THREE.CylinderGeometry(0.07, 0.07, 0.1, 6), bois, 0.1, 0.36, cote * 0.52);
    moyeu.rotation.x = Math.PI / 2;
    charrette.add(moyeu);
  }
  charrette.add(boite(0.5, 0.06, 0.08, bois, 1.1, 0.55, 0));
  // Chargement : caisses, sacs de toile, une pile de caisses derrière
  charrette.add(boite(0.5, 0.35, 0.4, bois, -0.4, 0.88, 0.1));
  charrette.add(boite(0.4, 0.3, 0.4, boisSombre, 0.15, 0.85, -0.12));
  charrette.add(maille(galet(0.25, 0.2, 0.22, 1), mat.sacToile, 0.55, 0.85, 0.12));
  charrette.add(maille(galet(0.2, 0.17, 0.2, 1), mat.sacToile, 0.35, 0.8, -0.28));
  // Bâche : quatre montants et un toit de toile légèrement penché, bandes vertes
  for (const [px, pz] of [[-0.78, -0.4], [-0.78, 0.4], [0.78, -0.4], [0.78, 0.4]] as const) {
    charrette.add(boite(0.05, 1.0, 0.05, boisSombre, px, 1.2, pz));
  }
  const toit = new THREE.Group();
  toit.position.set(0, 1.78, 0);
  toit.rotation.x = 0.1;
  toit.add(boite(1.9, 0.05, 1.15, mat.toile));
  for (const bx of [-0.6, 0, 0.6]) toit.add(boite(0.28, 0.06, 1.16, mat.toileVerte, bx, 0.005, 0));
  charrette.add(toit);

  let temps = 0;
  return {
    objet,
    mettreAJour(dt, pose) {
      temps += dt;
      objet.position.set(pose.x, pose.y, pose.z);
      objet.rotation.y = pose.orientation;
      // Il respire doucement et suit le joueur du regard
      torse.scale.y = 1 + Math.sin(temps * 1.6) * 0.012;
      tete.rotation.y = pose.regard;
    },
  };
}
