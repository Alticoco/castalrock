// Modèles des habitants, en code, d'après les images concept (docs/concepts) : Gaspard le chef (manteau bleu à
// col de fourrure, bâton, bourse), Marthe l'aubergiste (gilet, grand tablier, chope et torchon), Mathilde
// l'herboriste (robe verte, tablier, panier d'herbes), Hugo le chasseur (capuche verte, arc et carquois, lapin à la
// ceinture) et Aldric l'ermite (robe et chapeau violets, longue barbe, bâton au cristal). Bertil le forgeron garde
// son modèle de src/scene/modelesVillage.ts. Animations procédurales : marche, respiration, tête qui suit le
// joueur, activité au poste. Aucune règle de jeu ici : la pose vient de src/regles/habitants.ts.
// Repère : pieds à l'origine, l'avant regarde +z (comme le personnage) ; la main droite est donc du côté -x.
// Performance : chaque partie rigide du corps est fondue en une seule maille aux couleurs par sommet, et tous
// les habitants partagent le même matériau.

import * as THREE from 'three';
import type { IdHabitant } from '../regles/habitants';
import { creerForgeron } from './modelesVillage';
import { facettesFrange, facettesMasse, geometrieTon, tonSombre, type Coiffure } from './coiffures';
import { boite, creerMateriau, fuseau, galet, maille, type Anneau } from './outils';

export interface PoseHabitant {
  x: number;
  y: number;
  z: number;
  orientation: number;
  /** Vitesse de marche, en m/s (0 à l'arrêt) */
  vitesse: number;
  /** Lacet de la tête par rapport au corps, en radians */
  regard: number;
  /** Vrai quand il fait l'activité de son poste */
  activite: boolean;
}

export interface ModeleHabitant {
  objet: THREE.Object3D;
  mettreAJour(dt: number, pose: PoseHabitant): void;
}

export const COULEURS_HABITANTS = {
  peau: 0xf2b58a,
  nez: 0xe8957a,
  oeil: 0x2c2118,
  bouche: 0xb5654a,
  cuir: 0x7b4b2e,
  cuirSombre: 0x5f3b24,
  bottes: 0x7a4a2a,
  pantalon: 0x6b4a33,
  creme: 0xeedcb0,
  cremeClair: 0xf3e6c4,
  boucle: 0xa9a59a,
  bois: 0x8a5a33,
  // Gaspard
  manteau: 0x3d4673,
  tuniqueGaspard: 0x333b63,
  gris: 0x9a9a9e,
  grisClair: 0xabaaae,
  chaine: 0xb9bcc2,
  // Marthe
  gilet: 0x7b4b2e,
  jupeMarthe: 0x6b4a33,
  cheveuxBruns: 0x7a4a2e,
  chope: 0x9a6a3a,
  // Mathilde
  robeVerte: 0x7d9455,
  robeVerteSombre: 0x6c8349,
  cheveuxMathilde: 0x8b5535,
  osier: 0xb98d4f,
  osierSombre: 0x9a733c,
  herbe: 0x5f9a3c,
  fleur: 0xd978a8,
  // Hugo
  cape: 0x5e7a35,
  capeSombre: 0x536c2e,
  tuniqueHugo: 0x86a04f,
  laiton: 0xa98a52,
  lapin: 0x9a8672,
  lapinClair: 0xb7a48f,
  // Aldric
  robeViolette: 0x6a4878,
  chapeau: 0x70497f,
  violetSombre: 0x5a3c67,
  etoile: 0xe0a63a,
  barbeBlanche: 0xe6dccb,
  cheveuxBlancs: 0xd6ccbd,
  cristal: 0x58a8ff,
  // Campement d'Aldric
  roche: 0x8d8b8f,
  rocheSombre: 0x77757b,
  buche: 0x6b4a2f,
  flamme: 0xff9a2e,
} as const;

const K = COULEURS_HABITANTS;

// Matériaux « porteurs de couleur » : ils servent à construire, puis chaque partie rigide est fondue en une maille
// aux couleurs par sommet (voir `aplatir`). Un seul matériau est réellement dessiné pour tous les habitants.
const porteurs = new Map<number, THREE.MeshStandardMaterial>();
function mat(couleur: number): THREE.MeshStandardMaterial {
  let m = porteurs.get(couleur);
  if (!m) {
    m = creerMateriau(couleur);
    porteurs.set(couleur, m);
  }
  return m;
}

let materiauCommun: THREE.MeshStandardMaterial | null = null;
function materiauHabitants(): THREE.MeshStandardMaterial {
  if (!materiauCommun) {
    materiauCommun = creerMateriau(0xffffff, true);
    materiauCommun.vertexColors = true;
  }
  return materiauCommun;
}

/** Groupe placé ; `rigide` : ses mailles seront fondues dans la partie du corps qui le porte. */
function groupe(x = 0, y = 0, z = 0, rigide = false): THREE.Group {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.userData.rigide = rigide;
  return g;
}

function tourner<T extends THREE.Object3D>(o: T, rx = 0, ry = 0, rz = 0): T {
  o.rotation.set(rx, ry, rz);
  return o;
}

type P3 = readonly [number, number, number];
const AXE_Y = new THREE.Vector3(0, 1, 0);

/** Tige à 5 pans d'un point à un autre (bâton, arc, anse). */
function tige(a: P3, b: P3, rayon: number, couleur: number, rayonBout = rayon): THREE.Mesh {
  const va = new THREE.Vector3(...a);
  const vb = new THREE.Vector3(...b);
  const m = maille(new THREE.CylinderGeometry(rayonBout, rayon, va.distanceTo(vb), 5), mat(couleur));
  m.position.copy(va).add(vb).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(AXE_Y, vb.clone().sub(va).normalize());
  return m;
}

/**
 * Fond les mailles d'une partie rigide en une seule, aux couleurs par sommet ; chaque facette reçoit une teinte
 * très légèrement différente. Les groupes non rigides (membres animés) sont traités à leur tour.
 */
function aplatir(racine: THREE.Object3D): void {
  const positions: number[] = [];
  const couleurs: number[] = [];
  const teinte = new THREE.Color();
  let facette = 0;
  const recolter = (objet: THREE.Object3D, matrice: THREE.Matrix4 | null): void => {
    for (const enfant of [...objet.children]) {
      enfant.updateMatrix();
      const m = matrice ? matrice.clone().multiply(enfant.matrix) : enfant.matrix.clone();
      if (enfant instanceof THREE.Mesh) {
        if (enfant.userData.garder) continue;
        const source = enfant.geometry as THREE.BufferGeometry;
        const g = source.index ? source.toNonIndexed() : source.clone();
        g.applyMatrix4(m);
        const p = g.getAttribute('position');
        const base = (enfant.material as THREE.MeshStandardMaterial).color;
        for (let i = 0; i < p.count; i++) {
          if (i % 3 === 0) {
            // Variation de ±3,5 % par facette, toujours la même (pas de hasard)
            facette++;
            const v = 1 + ((((facette * 2654435761) >>> 0) % 1000) / 1000 - 0.5) * 0.07;
            teinte.copy(base).multiplyScalar(v);
          }
          positions.push(p.getX(i), p.getY(i), p.getZ(i));
          couleurs.push(teinte.r, teinte.g, teinte.b);
        }
        g.dispose();
        source.dispose();
        objet.remove(enfant);
      } else if (enfant.userData.rigide) {
        recolter(enfant, m);
        objet.remove(enfant);
      }
    }
  };
  recolter(racine, null);
  // Les membres animés sont aplatis chacun pour soi (avant d'ajouter la maille fondue, qui n'est pas à refondre)
  for (const enfant of racine.children) if (!(enfant instanceof THREE.Mesh)) aplatir(enfant);
  if (positions.length > 0) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
    g.computeVertexNormals();
    const fondue = new THREE.Mesh(g, materiauHabitants());
    fondue.castShadow = true;
    fondue.userData.garder = true;
    racine.add(fondue);
  }
}

// --- Squelette commun -------------------------------------------------------------------------

interface Bras {
  epaule: THREE.Group;
  coude: THREE.Group;
  /** Au poignet : la main et ce qu'elle tient */
  main: THREE.Group;
}

interface Squelette {
  objet: THREE.Group;
  /** Tout le corps : monte et descend à la marche */
  corps: THREE.Group;
  /** Hanches : [droite, gauche] */
  jambes: THREE.Group[];
  buste: THREE.Group;
  tete: THREE.Group;
  /** [droit (côté -x), gauche] */
  bras: Bras[];
}

interface Tenue {
  /** Demi-largeur des épaules et demi-profondeur du buste, en mètres */
  carrure: number;
  ventre: number;
  haut: number;
  manches: number;
  /** Couleur de l'avant-bras (la peau si les manches sont retroussées) et du revers au poignet */
  avantBras: number;
  revers?: number;
  /** Manches larges : demi-largeur au poignet */
  mancheLarge?: number;
  bas: number;
  bottes: number;
  /** Bottes hautes à revers (chasseur) */
  bottesHautes?: boolean;
  cheveux: number;
  /** Bouche visible (sans barbe) */
  bouche?: boolean;
  echelleTete?: number;
}

const HANCHE = 0.72;
const BRAS_HAUT = 0.26;
const AVANT_BRAS = 0.23;

function creerSquelette(t: Tenue): Squelette {
  const objet = new THREE.Group();
  const corps = groupe();
  // Silhouette trapue des planches : tout le corps est élargi
  corps.scale.set(1.14, 1, 1.1);
  objet.add(corps);

  // Jambes : pivot à la hanche ; pantalon, botte à revers
  const jambes = [-1, 1].map((cote) => {
    const hanche = groupe(cote * t.carrure * 0.52, HANCHE, 0);
    hanche.add(
      maille(
        fuseau([
          { y: 0.06, rx: 0.095, rz: 0.105 },
          { y: -0.25, rx: 0.098, rz: 0.11 },
          { y: -0.47, rx: 0.084, rz: 0.094 },
        ]),
        mat(t.bas),
      ),
    );
    const haut = t.bottesHautes ? -0.32 : -0.45;
    hanche.add(
      maille(
        fuseau([
          { y: haut, rx: 0.092, rz: 0.102 },
          { y: -0.67, rx: 0.084, rz: 0.094 },
        ]),
        mat(t.bottes),
      ),
    );
    hanche.add(boite(0.205, 0.075, 0.225, mat(t.bottes), 0, haut, 0));
    hanche.add(boite(0.17, 0.1, 0.29, mat(t.bottes), 0, -0.67, 0.045));
    hanche.add(boite(0.175, 0.022, 0.3, mat(K.cuirSombre), 0, -0.709, 0.045));
    corps.add(hanche);
    return hanche;
  });

  // Buste : pivot à la taille
  const buste = groupe(0, HANCHE, 0);
  corps.add(buste);
  buste.add(
    maille(
      fuseau([
        { y: -0.08, rx: t.carrure, rz: t.ventre },
        { y: 0.12, rx: t.carrure * 0.96, rz: t.ventre * 1.06 },
        { y: 0.4, rx: t.carrure, rz: t.ventre },
        { y: 0.52, rx: t.carrure * 0.7, rz: t.ventre * 0.78 },
      ]),
      mat(t.haut),
    ),
  );
  // Cou
  buste.add(boite(0.13, 0.08, 0.12, mat(K.peau), 0, 0.53, 0));

  // Bras : pivot à l'épaule, coude, main
  const bras = [-1, 1].map((cote): Bras => {
    const epaule = groupe(cote * (t.carrure + 0.055), 0.43, 0);
    epaule.add(
      maille(
        fuseau([
          { y: 0.07, rx: 0.07, rz: 0.085 },
          { y: -0.08, rx: 0.075, rz: 0.085 },
          { y: -BRAS_HAUT - 0.01, rx: 0.068, rz: 0.076 },
        ]),
        mat(t.manches),
      ),
    );
    const coude = groupe(0, -BRAS_HAUT, 0);
    epaule.add(coude);
    const large = t.mancheLarge ?? 0.062;
    coude.add(
      maille(
        fuseau([
          { y: 0.03, rx: 0.066, rz: 0.074 },
          { y: -AVANT_BRAS + 0.03, rx: large, rz: large * 1.1 },
        ]),
        mat(t.avantBras),
      ),
    );
    if (t.revers !== undefined) {
      coude.add(
        maille(
          fuseau([
            { y: -AVANT_BRAS + 0.09, rx: large + 0.018, rz: large * 1.1 + 0.018 },
            { y: -AVANT_BRAS + 0.01, rx: large + 0.022, rz: large * 1.1 + 0.022 },
          ]),
          mat(t.revers),
        ),
      );
    }
    const main = groupe(0, -AVANT_BRAS, 0);
    coude.add(main);
    main.add(
      maille(
        fuseau([
          { y: 0.03, rx: 0.045, rz: 0.055 },
          { y: -0.03, rx: 0.055, rz: 0.066 },
          { y: -0.1, rx: 0.046, rz: 0.056 },
        ]),
        mat(K.peau),
      ),
    );
    buste.add(epaule);
    return { epaule, coude, main };
  });

  // Tête : grosse et anguleuse, comme sur les planches
  const tete = groupe(0, 0.5, 0);
  tete.scale.setScalar(t.echelleTete ?? 1.12);
  buste.add(tete);
  tete.add(maille(fuseau(CRANE), mat(K.peau)));
  for (const cote of [-1, 1]) {
    tete.add(boite(0.036, 0.062, 0.02, mat(K.oeil), cote * 0.066, 0.235, 0.15));
    tete.add(boite(0.08, 0.026, 0.026, mat(t.cheveux), cote * 0.066, 0.305, 0.152));
    tete.add(boite(0.04, 0.085, 0.065, mat(K.peau), cote * 0.172, 0.2, 0));
  }
  tete.add(tourner(boite(0.055, 0.07, 0.06, mat(K.nez), 0, 0.185, 0.165), -0.25, 0, 0));
  if (t.bouche) tete.add(boite(0.07, 0.018, 0.02, mat(K.bouche), 0, 0.105, 0.148));

  return { objet, corps, jambes, buste, tete, bras };
}

// --- Coiffures --------------------------------------------------------------------------------

// Tranches du crâne des habitants (repère de la tête, pivot à la base du crâne). Les cheveux s'appuient dessus.
const CRANE: Anneau[] = [
  { y: 0.0, rx: 0.115, rz: 0.115 },
  { y: 0.1, rx: 0.162, rz: 0.152 },
  { y: 0.3, rx: 0.166, rz: 0.156 },
  { y: 0.4, rx: 0.12, rz: 0.115 },
];

// Coupe de base (voir coiffures.ts) : chaque habitant en change le volume et le bord bas.
// Repères du visage : sourcils vers y = 0,305, oreilles de y = 0,16 à 0,24 entre 80° et 100°.
const COUPE: Coiffure = {
  crane: CRANE,
  sommet: [0.02, 0.478, -0.015],
  centreY: 0.27,
  ry: 0.208,
  rx: 0.2,
  rzAvant: 0.186,
  rzArriere: 0.225,
  basY: 0.07,
  resserre: 0.22,
  epaisseur: 0.026,
  epaisseurBord: 0.012,
  bord: [
    [0, 0.34],
    [180, 0.07],
  ],
  pivotY: 0.375,
  etagesBas: [0, 0.33, 0.68, 1],
  etagesHaut: [0.435, 0.465],
  desordre: 0.013,
};

// Gaspard : chevelure grise épaisse, coiffée en arrière ; favoris qui descendent dans la barbe, oreilles dégagées
const COIFFURE_GASPARD: Coiffure = {
  ...COUPE,
  sommet: [0.01, 0.492, -0.03],
  ry: 0.222,
  rx: 0.206,
  rzArriere: 0.238,
  bord: [
    [0, 0.34],
    [20, 0.34],
    [38, 0.335],
    [50, 0.3],
    [60, 0.17],
    [70, 0.15],
    [80, 0.245],
    [92, 0.25],
    [104, 0.24],
    [118, 0.13],
    [140, 0.085],
    [160, 0.07],
    [180, 0.07],
  ],
  etagesHaut: [0.445, 0.478],
};

// Marthe : cheveux bruns tirés vers le chignon, mèches sur les tempes, nuque dégagée
const COIFFURE_MARTHE: Coiffure = {
  ...COUPE,
  sommet: [0, 0.474, -0.02],
  bord: [
    [0, 0.345],
    [20, 0.34],
    [38, 0.33],
    [50, 0.29],
    [60, 0.2],
    [72, 0.19],
    [82, 0.25],
    [94, 0.255],
    [106, 0.25],
    [120, 0.17],
    [140, 0.13],
    [160, 0.115],
    [180, 0.11],
  ],
};

// Mathilde : cheveux longs qui couvrent les oreilles et tombent sur la nuque, frange balayée depuis la raie
const COIFFURE_MATHILDE: Coiffure = {
  ...COUPE,
  rx: 0.212,
  basY: -0.035,
  resserre: 0.15,
  bord: [
    [0, 0.345],
    [20, 0.345],
    [36, 0.34],
    [48, 0.31],
    [58, 0.2],
    [68, 0.13],
    [80, 0.115],
    [92, 0.11],
    [106, 0.09],
    [122, 0.03],
    [140, -0.01],
    [160, -0.03],
    [180, -0.035],
  ],
  frange: {
    bord: [
      [-62, 0.3],
      [-50, 0.29],
      [-38, 0.335],
      [-29, 0.322],
      [-10, 0.345],
      [-3, 0.318],
      [16, 0.342],
      [28, 0.352],
      [44, 0.325],
      [54, 0.295],
      [62, 0.3],
    ],
    yMilieu: 0.36,
    yHaut: 0.41,
  },
};

// Hugo : la capuche couvre tout ; seule la frange dépasse sous la visière, plaquée sur le front
const COIFFURE_HUGO: Coiffure = {
  ...COUPE,
  rx: 0.17,
  rzAvant: 0.15,
  epaisseur: 0.008,
  frange: {
    bord: [
      [-52, 0.33],
      [-40, 0.312],
      [-26, 0.335],
      [-14, 0.318],
      [-2, 0.338],
      [10, 0.32],
      [24, 0.336],
      [38, 0.312],
      [52, 0.33],
    ],
    yMilieu: 0.36,
    yHaut: 0.41,
  },
};

// Aldric : longs cheveux blancs qui tombent sur les épaules et dans le dos ; le dessus, plat, reste sous le chapeau
const COIFFURE_ALDRIC: Coiffure = {
  ...COUPE,
  sommet: [0, 0.455, 0],
  centreY: 0.25,
  ry: 0.2,
  rzAvant: 0.18,
  rzArriere: 0.235,
  basY: -0.21,
  resserre: 0.42,
  bord: [
    [0, 0.35],
    [25, 0.35],
    [42, 0.34],
    [54, 0.28],
    [64, 0.1],
    [76, 0.03],
    [92, 0.01],
    [108, -0.01],
    [124, -0.05],
    [142, -0.11],
    [160, -0.175],
    [180, -0.21],
  ],
  etagesBas: [0, 0.25, 0.5, 0.75, 1],
  etagesHaut: [0.42, 0.445],
};

/** Pose sur la tête la masse de cheveux (et la frange s'il y en a une), en deux tons de `couleur`. */
function coiffer(tete: THREE.Group, coiffure: Coiffure, couleur: number, masse = true): void {
  const facettes = [...(masse ? facettesMasse(coiffure) : []), ...facettesFrange(coiffure)];
  tete.add(maille(geometrieTon(facettes, 0), mat(couleur)));
  tete.add(maille(geometrieTon(facettes, 1), mat(tonSombre(couleur))));
}

/** Jupe, robe ou manteau : fuseau accroché au corps, de la taille à l'ourlet. Profil : [y, demi-largeur, demi-profondeur]. */
function ajouterJupe(sq: Squelette, couleur: number, profil: ReadonlyArray<readonly [number, number, number]>): THREE.Group {
  const jupe = groupe(0, 0, 0, true);
  jupe.add(maille(fuseau(profil.map(([y, rx, rz]) => ({ y, rx, rz }))), mat(couleur)));
  sq.corps.add(jupe);
  return jupe;
}

/** Demi-profondeur d'un profil de jupe à la hauteur y (pour poser un décor sur le devant). */
function devantJupe(profil: ReadonlyArray<readonly [number, number, number]>, y: number): number {
  for (let i = 0; i < profil.length - 1; i++) {
    const [y1, , z1] = profil[i];
    const [y2, , z2] = profil[i + 1];
    if ((y - y1) * (y - y2) <= 0) return z1 + ((z2 - z1) * (y - y1)) / (y2 - y1 || 1);
  }
  return profil[profil.length - 1][2];
}

// --- Animation commune ------------------------------------------------------------------------

/** Pose de repos d'un bras : épaule (avant-arrière, écart), coude ; `libre` : il balance à la marche. */
interface ReposBras {
  ex: number;
  ez: number;
  cx: number;
  libre: boolean;
}

interface ReglagesAnimation {
  /** [droit, gauche] */
  repos: [ReposBras, ReposBras];
  amplitudeJambes: number;
  /** Décalage de temps, pour que deux habitants ne respirent pas ensemble */
  decalage: number;
  /** Activité du poste : `poids` va de 0 à 1 (fondu), `t` en secondes */
  activite(sq: Squelette, t: number, poids: number): void;
  /** Animation propre (cristal qui pulse…), à chaque image */
  toujours?(t: number, poids: number): void;
}

const lisse = (x: number, a: number, b: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function creerModele(sq: Squelette, r: ReglagesAnimation): ModeleHabitant {
  aplatir(sq.objet);
  let t = r.decalage;
  let phase = 0;
  let marche = 0;
  let poids = 0;
  return {
    objet: sq.objet,
    mettreAJour(dt, pose) {
      sq.objet.position.set(pose.x, pose.y, pose.z);
      sq.objet.rotation.y = pose.orientation;
      t += dt;
      marche += ((pose.vitesse > 0.05 ? 1 : 0) - marche) * Math.min(1, dt * 8);
      poids += ((pose.activite ? 1 : 0) - poids) * Math.min(1, dt * 3.5);
      // Un pas tous les 0,6 m
      phase += pose.vitesse * dt * 5.2;
      const pas = Math.sin(phase);
      const souffle = Math.sin(t * 1.7);

      sq.corps.position.y = Math.abs(pas) * 0.025 * marche;
      sq.corps.rotation.set(0, 0, pas * 0.022 * marche);
      sq.jambes[0].rotation.x = pas * r.amplitudeJambes * marche;
      sq.jambes[1].rotation.x = -pas * r.amplitudeJambes * marche;
      sq.buste.rotation.set(0.04 * marche, pas * 0.07 * marche, 0);
      sq.buste.scale.y = 1 + souffle * 0.012;
      sq.tete.rotation.set(souffle * 0.015, pose.regard, 0);
      sq.bras.forEach((b, i) => {
        const cote = i === 0 ? -1 : 1;
        const repos = r.repos[i];
        const balance = repos.libre ? cote * pas * 0.55 * marche : pas * 0.05 * marche;
        b.epaule.rotation.set(repos.ex + balance, 0, repos.ez + cote * souffle * 0.014);
        b.coude.rotation.set(repos.cx - (repos.libre ? 0.22 * marche : 0), 0, 0);
      });
      r.activite(sq, t, poids);
      r.toujours?.(t, poids);
    },
  };
}

const BRAS_LIBRE = (cote: number): ReposBras => ({ ex: 0, ez: cote * 0.09, cx: -0.12, libre: true });

// --- Gaspard ----------------------------------------------------------------------------------

/** Le chef du village : manteau bleu bordé de crème, col de fourrure, chaîne, barbe grise, bâton à pommeau, bourse. */
function creerGaspard(): ModeleHabitant {
  const sq = creerSquelette({
    carrure: 0.22,
    ventre: 0.15,
    haut: K.manteau,
    manches: K.manteau,
    avantBras: K.manteau,
    revers: K.creme,
    mancheLarge: 0.075,
    bas: K.pantalon,
    bottes: K.bottes,
    cheveux: K.gris,
    echelleTete: 1.15,
  });
  const { buste, tete, bras } = sq;

  // Manteau jusqu'aux mollets, ourlet de fourrure
  const profil = [
    [0.8, 0.225, 0.155],
    [0.5, 0.265, 0.2],
    [0.19, 0.305, 0.235],
  ] as const;
  const manteau = ajouterJupe(sq, K.manteau, profil);
  manteau.add(
    maille(
      fuseau([
        { y: 0.27, rx: 0.305, rz: 0.235 },
        { y: 0.17, rx: 0.32, rz: 0.25 },
      ]),
      mat(K.creme),
    ),
  );
  // Ouverture du manteau : tunique sombre au milieu, bordures crème de chaque côté, du col à l'ourlet
  const pente = Math.atan2(0.235 - 0.155, 0.8 - 0.19);
  for (const cote of [-1, 1]) {
    manteau.add(tourner(boite(0.05, 0.56, 0.02, mat(K.creme), cote * 0.085, 0.5, devantJupe(profil, 0.5) + 0.006), pente, 0, 0));
    buste.add(boite(0.05, 0.42, 0.02, mat(K.creme), cote * 0.085, 0.2, 0.156));
  }
  manteau.add(tourner(boite(0.12, 0.56, 0.016, mat(K.tuniqueGaspard), 0, 0.5, devantJupe(profil, 0.5) + 0.003), pente, 0, 0));
  buste.add(boite(0.12, 0.42, 0.016, mat(K.tuniqueGaspard), 0, 0.2, 0.154));
  // Ceinture de la tunique, bourse de cuir à la hanche gauche
  buste.add(boite(0.13, 0.055, 0.02, mat(K.cuir), 0, 0.03, 0.166));
  buste.add(boite(0.05, 0.065, 0.024, mat(K.boucle), 0, 0.03, 0.17));
  const bourse = groupe(0.17, -0.03, 0.17, true);
  bourse.add(maille(galet(0.062, 0.07, 0.05), mat(K.cuirSombre), 0, -0.05, 0));
  bourse.add(boite(0.05, 0.03, 0.04, mat(K.cuir), 0, 0.015, 0));
  bourse.add(boite(0.02, 0.07, 0.015, mat(K.cuir), 0, 0.06, -0.012));
  bourse.add(boite(0.022, 0.022, 0.02, mat(K.etoile), 0, -0.04, 0.045));
  buste.add(bourse);
  // Grand col de fourrure sur les épaules
  buste.add(
    maille(
      fuseau([
        { y: 0.33, rx: 0.3, rz: 0.2 },
        { y: 0.43, rx: 0.325, rz: 0.215 },
        { y: 0.52, rx: 0.26, rz: 0.19 },
        { y: 0.58, rx: 0.17, rz: 0.15, dz: -0.02 },
      ]),
      mat(K.creme),
    ),
  );
  // Chaîne d'argent sur la poitrine, en arc sous la barbe
  for (let i = -2; i <= 2; i++) {
    const maillon = boite(0.036, 0.026, 0.016, mat(K.chaine), i * 0.034, 0.3 - (4 - i * i) * 0.012, 0.168);
    maillon.rotation.z = i * 0.28;
    buste.add(maillon);
  }

  // Cheveux gris en arrière, barbe pleine, moustache
  coiffer(tete, COIFFURE_GASPARD, K.gris);
  tete.add(
    maille(
      fuseau([
        { y: -0.1, rx: 0.085, rz: 0.05, dz: 0.125 },
        { y: 0.01, rx: 0.16, rz: 0.075, dz: 0.11 },
        { y: 0.15, rx: 0.178, rz: 0.062, dz: 0.108 },
      ]),
      mat(K.grisClair),
    ),
  );
  tete.add(boite(0.17, 0.04, 0.035, mat(K.gris), 0, 0.143, 0.172));

  // Bâton tenu droit dans la main droite : avant-bras replié vers l'avant
  const repos: ReposBras = { ex: -0.35, ez: 0, cx: -0.95, libre: false };
  const baton = groupe(0, -0.03, 0.01, true);
  baton.rotation.x = -(repos.ex + repos.cx);
  baton.add(tige([0, -0.78, 0], [0, 0.34, 0], 0.024, K.bois, 0.02));
  baton.add(maille(galet(0.05, 0.06, 0.05), mat(K.bois), 0, 0.38, 0));
  bras[0].main.add(baton);

  return creerModele(sq, {
    repos: [repos, BRAS_LIBRE(1)],
    amplitudeJambes: 0.36,
    decalage: 0.4,
    // Il gesticule : le bras gauche se lève et s'agite, la tête accompagne
    activite(s, t, a) {
      const g = s.bras[1];
      g.epaule.rotation.x += a * (-1.15 + Math.sin(t * 2.3) * 0.32);
      g.epaule.rotation.z += a * (0.32 + Math.sin(t * 1.7) * 0.2);
      g.coude.rotation.x += a * (-0.75 + Math.sin(t * 4.1) * 0.38);
      s.tete.rotation.x += a * Math.sin(t * 2.3) * 0.07;
      s.buste.rotation.y += a * Math.sin(t * 0.9) * 0.13;
    },
  });
}

// --- Marthe -----------------------------------------------------------------------------------

/** L'aubergiste : forte carrure, chemise crème aux manches retroussées, gilet brun, grand tablier, chope et torchon. */
function creerMarthe(): ModeleHabitant {
  const sq = creerSquelette({
    carrure: 0.24,
    ventre: 0.175,
    haut: K.gilet,
    manches: K.creme,
    avantBras: K.peau,
    bas: K.jupeMarthe,
    bottes: K.bottes,
    cheveux: K.cheveuxBruns,
    bouche: true,
    echelleTete: 1.15,
  });
  const { buste, tete, bras } = sq;

  // Jupe brune et grand tablier crème par-dessus
  const profil = [
    [0.8, 0.245, 0.18],
    [0.5, 0.29, 0.23],
    [0.15, 0.31, 0.25],
  ] as const;
  const jupe = ajouterJupe(sq, K.jupeMarthe, profil);
  const pente = Math.atan2(0.25 - 0.18, 0.8 - 0.15);
  jupe.add(tourner(boite(0.44, 0.56, 0.024, mat(K.cremeClair), 0, 0.5, devantJupe(profil, 0.5) + 0.008), pente, 0, 0));
  // Chemise dans l'ouverture du gilet, col, cordon du tablier
  buste.add(boite(0.17, 0.44, 0.02, mat(K.creme), 0, 0.2, 0.172));
  for (const cote of [-1, 1]) {
    buste.add(tourner(boite(0.09, 0.05, 0.03, mat(K.creme), cote * 0.065, 0.475, 0.14), 0, 0, cote * 0.5));
    // Manches retroussées : un bourrelet au-dessus du coude
    bras[cote < 0 ? 0 : 1].epaule.add(
      maille(
        fuseau([
          { y: -BRAS_HAUT + 0.07, rx: 0.086, rz: 0.094 },
          { y: -BRAS_HAUT - 0.01, rx: 0.09, rz: 0.098 },
        ]),
        mat(K.creme),
      ),
    );
  }
  buste.add(boite(0.5, 0.05, 0.37, mat(K.cremeClair), 0, 0.045, 0));
  buste.add(boite(0.32, 0.12, 0.022, mat(K.cremeClair), 0, -0.02, 0.185));

  // Cheveux bruns relevés en chignon, mèches sur les tempes
  coiffer(tete, COIFFURE_MARTHE, K.cheveuxBruns);
  // Le chignon : une boule à facettes à moitié prise dans la masse, en haut de la nuque
  tete.add(tourner(maille(galet(0.085, 0.08, 0.08), mat(K.cheveuxBruns), 0, 0.375, -0.215), 0.4, 0.3, 0));
  // Joues rondes
  for (const cote of [-1, 1]) tete.add(boite(0.045, 0.03, 0.016, mat(K.nez), cote * 0.1, 0.15, 0.148));

  // Main gauche : la chope de bois cerclée, tenue devant elle
  const reposGauche: ReposBras = { ex: -0.2, ez: 0.05, cx: -1.25, libre: false };
  const chope = groupe(-0.02, -0.06, 0.02, true);
  chope.rotation.x = -(reposGauche.ex + reposGauche.cx);
  chope.add(maille(new THREE.CylinderGeometry(0.068, 0.062, 0.15, 8), mat(K.chope), 0, 0.03, 0.09));
  for (const y of [-0.025, 0.085]) chope.add(maille(new THREE.CylinderGeometry(0.072, 0.072, 0.022, 8), mat(K.cuirSombre), 0, y, 0.09));
  chope.add(maille(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 8), mat(K.cremeClair), 0, 0.106, 0.09));
  bras[1].main.add(chope);
  // Main droite : le torchon
  const torchon = groupe(0, -0.11, 0.02, true);
  torchon.add(boite(0.13, 0.03, 0.12, mat(K.cremeClair)));
  torchon.add(tourner(boite(0.06, 0.09, 0.02, mat(K.creme), 0.03, -0.05, 0.03), 0.2, 0, 0.2));
  bras[0].main.add(torchon);

  return creerModele(sq, {
    repos: [BRAS_LIBRE(-1), reposGauche],
    amplitudeJambes: 0.3,
    decalage: 1.7,
    // Elle essuie le comptoir : penchée, le bras droit tendu fait des ronds
    activite(s, t, a) {
      const d = s.bras[0];
      s.buste.rotation.x += a * 0.3;
      s.tete.rotation.x += a * 0.18;
      d.epaule.rotation.x += a * (-0.95 + Math.sin(t * 5) * 0.17);
      d.epaule.rotation.z += a * Math.cos(t * 5) * 0.24;
      d.coude.rotation.x += a * (-0.3 + Math.sin(t * 5) * 0.08);
    },
  });
}

// --- Mathilde ---------------------------------------------------------------------------------

/** L'herboriste : le villageois de référence au féminin, robe verte, tablier, tresse, panier d'herbes au bras. */
function creerMathilde(): ModeleHabitant {
  const sq = creerSquelette({
    carrure: 0.185,
    ventre: 0.125,
    haut: K.robeVerte,
    manches: K.robeVerte,
    avantBras: K.robeVerte,
    bas: K.pantalon,
    bottes: K.bottes,
    cheveux: K.cheveuxMathilde,
    bouche: true,
  });
  const { buste, tete, bras } = sq;

  // Robe jusqu'aux chevilles, ourlet plus sombre, tablier crème noué à la taille
  const profil = [
    [0.8, 0.19, 0.13],
    [0.5, 0.245, 0.19],
    [0.2, 0.29, 0.235],
  ] as const;
  const robe = ajouterJupe(sq, K.robeVerte, profil);
  robe.add(
    maille(
      fuseau([
        { y: 0.26, rx: 0.283, rz: 0.228 },
        { y: 0.19, rx: 0.297, rz: 0.242 },
      ]),
      mat(K.robeVerteSombre),
    ),
  );
  const pente = Math.atan2(0.235 - 0.13, 0.8 - 0.2);
  robe.add(tourner(boite(0.27, 0.4, 0.02, mat(K.creme), 0, 0.55, devantJupe(profil, 0.55) + 0.008), pente, 0, 0));
  buste.add(boite(0.2, 0.2, 0.018, mat(K.creme), 0, 0.17, 0.13));
  for (const cote of [-1, 1]) buste.add(tourner(boite(0.03, 0.26, 0.018, mat(K.creme), cote * 0.085, 0.39, 0.118), -0.12, 0, cote * 0.12));
  // Ceinture de cuir à boucle, comme le villageois de référence
  buste.add(boite(0.4, 0.055, 0.28, mat(K.cuir), 0, 0.05, 0));
  buste.add(boite(0.075, 0.07, 0.02, mat(K.boucle), 0, 0.05, 0.142));
  // Encolure en V
  buste.add(tourner(boite(0.07, 0.07, 0.016, mat(K.peau), 0, 0.455, 0.108), -0.2, 0, Math.PI / 4));

  // Cheveux du villageois de référence, plus longs : mèche sur le front, tresse dans le dos nouée d'un ruban
  coiffer(tete, COIFFURE_MATHILDE, K.cheveuxMathilde);
  // La tresse : un seul volume qui sort de la masse, renflé à chaque torsade, noué d'un ruban avant la pointe
  const tresse = groupe(0, 0.1, -0.175, true);
  tresse.rotation.x = 0.1;
  tresse.add(
    maille(
      fuseau([
        { y: 0.0, rx: 0.05, rz: 0.04 },
        { y: -0.07, rx: 0.058, rz: 0.046, dx: 0.008 },
        { y: -0.12, rx: 0.042, rz: 0.036 },
        { y: -0.175, rx: 0.055, rz: 0.044, dx: -0.008 },
        { y: -0.23, rx: 0.042, rz: 0.035 },
        { y: -0.29, rx: 0.032, rz: 0.028 },
        { y: -0.345, rx: 0.04, rz: 0.034 },
        { y: -0.385, rx: 0.012, rz: 0.012 },
      ]),
      mat(tonSombre(K.cheveuxMathilde)),
    ),
  );
  tresse.add(boite(0.075, 0.03, 0.066, mat(K.fleur), 0, -0.295, 0));
  tete.add(tresse);

  // Bras gauche replié : le panier d'osier pend à l'avant-bras, plein d'herbes et de fleurs
  const reposGauche: ReposBras = { ex: -0.12, ez: 0.1, cx: -1.35, libre: false };
  const panier = groupe(0.01, -AVANT_BRAS * 0.55, 0, true);
  panier.rotation.x = -(reposGauche.ex + reposGauche.cx);
  panier.add(
    maille(
      fuseau([
        { y: -0.3, rx: 0.1, rz: 0.085 },
        { y: -0.22, rx: 0.135, rz: 0.115 },
        { y: -0.13, rx: 0.15, rz: 0.125 },
      ]),
      mat(K.osier),
    ),
  );
  panier.add(
    maille(
      fuseau([
        { y: -0.15, rx: 0.156, rz: 0.131 },
        { y: -0.12, rx: 0.158, rz: 0.133 },
      ]),
      mat(K.osierSombre),
    ),
  );
  // Anse en arc par-dessus l'avant-bras
  panier.add(tige([0, -0.13, -0.125], [0, 0.04, -0.07], 0.014, K.osierSombre));
  panier.add(tige([0, 0.04, -0.07], [0, 0.04, 0.07], 0.014, K.osierSombre));
  panier.add(tige([0, 0.04, 0.07], [0, -0.13, 0.125], 0.014, K.osierSombre));
  panier.add(maille(galet(0.075, 0.05, 0.065), mat(K.herbe), -0.05, -0.1, 0.02));
  panier.add(maille(galet(0.07, 0.055, 0.06), mat(K.herbe), 0.06, -0.095, -0.03));
  panier.add(maille(galet(0.035, 0.035, 0.035), mat(K.fleur), 0.02, -0.06, 0.06));
  panier.add(maille(galet(0.03, 0.03, 0.03), mat(K.fleur), -0.08, -0.065, -0.04));
  panier.add(tourner(boite(0.02, 0.1, 0.02, mat(K.herbe), 0.09, -0.06, 0.04), 0.3, 0, -0.4));
  bras[1].coude.add(panier);

  return creerModele(sq, {
    repos: [BRAS_LIBRE(-1), reposGauche],
    amplitudeJambes: 0.3,
    decalage: 2.9,
    // Elle cueille : elle se penche, la main droite cherche et arrache, puis elle se relève et range dans le panier
    activite(s, t, a) {
      const cycle = (t % 5.2) / 5.2;
      const penche = lisse(cycle, 0.04, 0.2) * (1 - lisse(cycle, 0.58, 0.72));
      const range = lisse(cycle, 0.72, 0.82) * (1 - lisse(cycle, 0.92, 1));
      const d = s.bras[0];
      s.buste.rotation.x += a * penche * 0.82;
      s.tete.rotation.x += a * penche * 0.12;
      d.epaule.rotation.x += a * (penche * (-1.2 + Math.sin(t * 9) * 0.05) - range * 0.5);
      d.epaule.rotation.z += a * range * 0.6;
      d.coude.rotation.x += a * (penche * (-0.15 + Math.sin(t * 9) * 0.14) - range * 1.05);
    },
  });
}

// --- Hugo -------------------------------------------------------------------------------------

/** Le chasseur : capuche et pèlerine vertes, barbe brune, bottes hautes, arc et carquois dans le dos, lapin à la ceinture. */
function creerHugo(): ModeleHabitant {
  const sq = creerSquelette({
    carrure: 0.2,
    ventre: 0.13,
    haut: K.tuniqueHugo,
    manches: K.tuniqueHugo,
    avantBras: K.tuniqueHugo,
    bas: K.pantalon,
    bottes: K.bottes,
    bottesHautes: true,
    cheveux: K.cheveuxBruns,
  });
  const { buste, tete } = sq;

  // Bas de la tunique sur les hanches, plus long derrière
  const basque = ajouterJupe(sq, K.tuniqueHugo, [
    [0.8, 0.205, 0.135],
    [0.66, 0.235, 0.165],
    [0.53, 0.25, 0.18],
  ]);
  basque.add(boite(0.4, 0.2, 0.03, mat(K.cape), 0, 0.52, -0.16));
  // Ceinture à grosse boucle de laiton
  buste.add(boite(0.44, 0.07, 0.3, mat(K.cuir), 0, 0.03, 0));
  buste.add(boite(0.11, 0.1, 0.022, mat(K.laiton), 0, 0.03, 0.152));
  buste.add(boite(0.06, 0.05, 0.026, mat(K.cuir), 0, 0.03, 0.154));
  // Pèlerine sur les épaules, en pointe devant, fermée par une agrafe
  buste.add(
    maille(
      fuseau([
        { y: 0.2, rx: 0.3, rz: 0.2, dz: -0.01 },
        { y: 0.4, rx: 0.3, rz: 0.2 },
        { y: 0.52, rx: 0.22, rz: 0.17 },
        { y: 0.6, rx: 0.15, rz: 0.14, dz: -0.02 },
      ]),
      mat(K.cape),
    ),
  );
  const pointe = maille(new THREE.ConeGeometry(0.21, 0.22, 4), mat(K.cape), 0, 0.1, 0.13);
  pointe.rotation.set(Math.PI, Math.PI / 4, 0);
  pointe.scale.z = 0.35;
  buste.add(pointe);
  buste.add(boite(0.45, 0.3, 0.03, mat(K.capeSombre), 0, 0.08, -0.185));
  buste.add(boite(0.085, 0.085, 0.03, mat(K.tuniqueHugo), 0, 0.4, 0.2));

  // Capuche : elle entoure la tête, bord en visière, pointe qui retombe en arrière
  tete.add(
    maille(
      fuseau([
        { y: -0.03, rx: 0.15, rz: 0.13, dz: -0.035 },
        { y: 0.1, rx: 0.195, rz: 0.165, dz: -0.03 },
        { y: 0.32, rx: 0.2, rz: 0.17, dz: -0.03 },
        { y: 0.43, rx: 0.15, rz: 0.15, dz: -0.04 },
        { y: 0.5, rx: 0.07, rz: 0.08, dz: -0.1 },
      ]),
      mat(K.cape),
    ),
  );
  tete.add(tourner(boite(0.34, 0.07, 0.07, mat(K.cape), 0, 0.385, 0.125), 0.25, 0, 0));
  for (const cote of [-1, 1]) tete.add(boite(0.05, 0.3, 0.06, mat(K.cape), cote * 0.178, 0.2, 0.115));
  const bout = maille(new THREE.ConeGeometry(0.085, 0.26, 4), mat(K.capeSombre), 0, 0.45, -0.2);
  bout.rotation.x = -2.0;
  tete.add(bout);
  // Frange, barbe courte et moustache brunes
  coiffer(tete, COIFFURE_HUGO, K.cheveuxBruns, false);
  tete.add(
    maille(
      fuseau([
        { y: -0.045, rx: 0.08, rz: 0.04, dz: 0.125 },
        { y: 0.02, rx: 0.15, rz: 0.055, dz: 0.118 },
        { y: 0.13, rx: 0.172, rz: 0.05, dz: 0.112 },
      ]),
      mat(K.cheveuxBruns),
    ),
  );
  tete.add(boite(0.15, 0.035, 0.03, mat(K.cheveuxBruns), 0, 0.14, 0.17));

  // Dans le dos, sur l'épaule gauche : le carquois et ses flèches, l'arc en travers
  const dos = groupe(0.1, 0.36, -0.22, true);
  dos.rotation.z = -0.5;
  dos.add(
    maille(
      fuseau([
        { y: -0.2, rx: 0.05, rz: 0.045 },
        { y: 0.2, rx: 0.062, rz: 0.055 },
      ]),
      mat(K.cuir),
    ),
  );
  dos.add(boite(0.135, 0.035, 0.12, mat(K.cuirSombre), 0, 0.17, 0));
  for (const [dx, dz, h] of [
    [-0.025, 0.01, 0.36],
    [0.02, -0.015, 0.4],
    [0.03, 0.025, 0.33],
  ]) {
    dos.add(tige([dx, 0.15, dz], [dx, h, dz], 0.008, K.bois));
    dos.add(boite(0.012, 0.09, 0.05, mat(K.cremeClair), dx, h - 0.02, dz));
    dos.add(boite(0.05, 0.09, 0.012, mat(K.creme), dx, h - 0.02, dz));
  }
  buste.add(dos);
  const arc = groupe(0.1, 0.3, -0.28, true);
  arc.rotation.z = -0.42;
  // Arc recourbé : cinq tronçons, les branches reviennent vers l'avant aux deux bouts ; corde tendue
  const courbe: P3[] = [
    [0, -0.5, 0.05],
    [0, -0.36, -0.035],
    [0, -0.13, -0.075],
    [0, 0.13, -0.075],
    [0, 0.36, -0.035],
    [0, 0.5, 0.05],
  ];
  for (let i = 0; i < courbe.length - 1; i++) arc.add(tige(courbe[i], courbe[i + 1], 0.02, K.cuir));
  arc.add(boite(0.05, 0.14, 0.05, mat(K.cuirSombre), 0, 0, -0.075));
  arc.add(tige([0, -0.5, 0.05], [0, 0.5, 0.05], 0.004, K.cremeClair));
  buste.add(arc);
  // Sangle du carquois en travers de la poitrine
  buste.add(tourner(boite(0.05, 0.62, 0.02, mat(K.cuirSombre), 0.0, 0.2, 0.146), 0, 0, 0.62));

  // Lapin pendu à la ceinture, sur la hanche gauche
  const lapin = groupe(0.15, -0.03, 0.17, true);
  lapin.add(tige([0, 0.05, -0.02], [0, -0.03, 0], 0.006, K.cuirSombre));
  lapin.add(maille(galet(0.05, 0.09, 0.05), mat(K.lapin), 0, -0.13, 0));
  lapin.add(maille(galet(0.035, 0.05, 0.02), mat(K.lapinClair), 0, -0.14, 0.036));
  lapin.add(maille(galet(0.043, 0.045, 0.043), mat(K.lapin), 0, -0.03, 0.012));
  for (const cote of [-1, 1]) {
    lapin.add(tourner(boite(0.022, 0.085, 0.014, mat(K.lapin), cote * 0.022, 0.03, 0.0), 0, 0, -cote * 0.18));
    lapin.add(boite(0.022, 0.06, 0.024, mat(K.lapin), cote * 0.028, -0.22, 0.012));
  }
  buste.add(lapin);

  return creerModele(sq, {
    repos: [BRAS_LIBRE(-1), BRAS_LIBRE(1)],
    amplitudeJambes: 0.5,
    decalage: 4.1,
    // Il guette : la main gauche en visière, la tête balaie l'horizon
    activite(s, t, a) {
      const g = s.bras[1];
      g.epaule.rotation.x += a * -2.05;
      g.epaule.rotation.z += a * -0.5;
      g.coude.rotation.x += a * -1.45;
      s.tete.rotation.y += a * Math.sin(t * 0.55) * 0.6;
      s.buste.rotation.y += a * Math.sin(t * 0.55) * 0.18;
    },
  });
}

// --- Aldric -----------------------------------------------------------------------------------

/** Étoile dorée à quatre branches, posée à plat sur un tissu. */
function etoile(taille: number, x: number, y: number, z: number, inclinaison = 0): THREE.Group {
  const e = groupe(x, y, z, true);
  e.rotation.x = inclinaison;
  const or = mat(K.etoile);
  e.add(tourner(boite(taille * 0.3, taille * 0.3, 0.012, or), 0, 0, Math.PI / 4));
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    const branche = maille(new THREE.ConeGeometry(taille * 0.17, taille * 0.5, 4), or, Math.sin(a) * taille * 0.3, Math.cos(a) * taille * 0.3, 0);
    branche.rotation.z = -a;
    branche.scale.z = 0.12;
    e.add(branche);
  }
  return e;
}

/** L'ermite mage : robe et chapeau pointu violets, étoiles d'or, longue barbe blanche, bâton noueux au cristal bleu. */
function creerAldric(): ModeleHabitant {
  const sq = creerSquelette({
    carrure: 0.2,
    ventre: 0.14,
    haut: K.robeViolette,
    manches: K.robeViolette,
    avantBras: K.robeViolette,
    mancheLarge: 0.115,
    bas: K.violetSombre,
    bottes: K.bottes,
    cheveux: K.barbeBlanche,
  });
  const { buste, tete, bras } = sq;

  // Robe jusqu'au sol, qui s'évase
  const profil = [
    [0.8, 0.205, 0.145],
    [0.45, 0.28, 0.215],
    [0.05, 0.36, 0.27],
  ] as const;
  const robe = ajouterJupe(sq, K.robeViolette, profil);
  const pente = Math.atan2(0.27 - 0.145, 0.8 - 0.05);
  robe.add(etoile(0.15, -0.13, 0.42, devantJupe(profil, 0.42) + 0.012, pente));
  robe.add(etoile(0.13, 0.12, 0.2, devantJupe(profil, 0.2) + 0.012, pente));
  buste.add(etoile(0.15, 0.01, 0.14, 0.155));
  // Petit col rabattu sur les épaules
  buste.add(
    maille(
      fuseau([
        { y: 0.36, rx: 0.27, rz: 0.18 },
        { y: 0.46, rx: 0.26, rz: 0.18 },
        { y: 0.56, rx: 0.15, rz: 0.13 },
      ]),
      mat(K.violetSombre),
    ),
  );

  // Longs cheveux blancs dans le dos, barbe en pointe jusqu'à la poitrine, moustache, sourcils épais
  coiffer(tete, COIFFURE_ALDRIC, K.cheveuxBlancs);
  tete.add(
    maille(
      fuseau([
        { y: -0.34, rx: 0.03, rz: 0.025, dz: 0.15 },
        { y: -0.16, rx: 0.1, rz: 0.05, dz: 0.135 },
        { y: 0.02, rx: 0.165, rz: 0.07, dz: 0.115 },
        { y: 0.15, rx: 0.178, rz: 0.06, dz: 0.108 },
      ]),
      mat(K.barbeBlanche),
    ),
  );
  for (const cote of [-1, 1]) {
    tete.add(tourner(boite(0.1, 0.04, 0.035, mat(K.barbeBlanche), cote * 0.055, 0.14, 0.172), 0, 0, -cote * 0.3));
    tete.add(tourner(boite(0.09, 0.035, 0.035, mat(K.barbeBlanche), cote * 0.068, 0.31, 0.156), 0, 0, cote * 0.18));
  }
  // Chapeau : large bord, cône qui se casse vers la gauche
  const chapeau = groupe(0, 0.33, -0.01, true);
  chapeau.rotation.x = -0.1;
  chapeau.add(
    maille(
      fuseau([
        { y: 0, rx: 0.36, rz: 0.36, c: 0.13 },
        { y: 0.035, rx: 0.33, rz: 0.33, c: 0.12 },
        { y: 0.06, rx: 0.19, rz: 0.19, c: 0.07 },
      ]),
      mat(K.chapeau),
    ),
  );
  chapeau.add(
    maille(
      fuseau([
        { y: 0.04, rx: 0.185, rz: 0.185, c: 0.07 },
        { y: 0.26, rx: 0.125, rz: 0.125, c: 0.045, dz: -0.01 },
        { y: 0.44, rx: 0.075, rz: 0.075, c: 0.028, dx: 0.02, dz: -0.02 },
        { y: 0.54, rx: 0.045, rz: 0.045, c: 0.016, dx: 0.09, dz: -0.02 },
        { y: 0.57, rx: 0.014, rz: 0.014, c: 0.005, dx: 0.2, dz: -0.02 },
      ]),
      mat(K.chapeau),
    ),
  );
  chapeau.add(
    maille(
      fuseau([
        { y: 0.055, rx: 0.192, rz: 0.192, c: 0.072 },
        { y: 0.1, rx: 0.18, rz: 0.18, c: 0.066 },
      ]),
      mat(K.violetSombre),
    ),
  );
  tete.add(chapeau);

  // Bâton noueux tenu droit dans la main droite, fourche en haut qui serre le cristal
  const repos: ReposBras = { ex: -0.35, ez: 0, cx: -0.95, libre: false };
  const baton = groupe(0, -0.03, 0.01, true);
  baton.rotation.x = -(repos.ex + repos.cx);
  const noeuds: P3[] = [
    [0, -0.78, 0],
    [0.025, -0.45, 0.01],
    [-0.02, -0.12, -0.01],
    [0.02, 0.2, 0.015],
    [-0.025, 0.5, 0],
    [0.0, 0.76, 0.01],
  ];
  for (let i = 0; i < noeuds.length - 1; i++) baton.add(tige(noeuds[i], noeuds[i + 1], 0.028 - i * 0.001, K.bois, 0.027 - i * 0.001));
  for (const n of noeuds.slice(1, -1)) baton.add(maille(galet(0.033, 0.03, 0.033), mat(K.bois), n[0], n[1], n[2]));
  for (const cote of [-1, 1]) {
    baton.add(tige([0, 0.76, 0.01], [cote * 0.07, 0.86, 0.01], 0.022, K.bois, 0.018));
    baton.add(tige([cote * 0.07, 0.86, 0.01], [cote * 0.05, 0.96, 0.01], 0.018, K.bois, 0.012));
  }
  bras[0].main.add(baton);
  // Le cristal a son propre matériau (il luit, sans éclairer) : il n'est pas fondu avec le reste
  const matCristal = creerMateriau(K.cristal);
  matCristal.emissive.setHex(K.cristal);
  matCristal.emissiveIntensity = 0.9;
  matCristal.roughness = 0.35;
  const cristal = maille(new THREE.OctahedronGeometry(0.062), matCristal, 0, 0.93, 0.01);
  cristal.scale.y = 1.55;
  cristal.userData.garder = true;
  cristal.castShadow = false;
  const support = groupe(0, -0.03, 0.01);
  support.rotation.x = baton.rotation.x;
  support.add(cristal);
  bras[0].main.add(support);

  return creerModele(sq, {
    repos: [repos, BRAS_LIBRE(1)],
    amplitudeJambes: 0.26,
    decalage: 5.3,
    // Il médite près du feu : la main gauche tendue vers les flammes, le bâton se soulève, le cristal bat
    activite(s, t, a) {
      const g = s.bras[1];
      g.epaule.rotation.x += a * (-0.95 + Math.sin(t * 1.3) * 0.08);
      g.epaule.rotation.z += a * 0.12;
      g.coude.rotation.x += a * (-0.35 + Math.sin(t * 2.1) * 0.06);
      s.bras[0].epaule.rotation.x += a * Math.sin(t * 1.3) * 0.05;
      s.tete.rotation.x += a * 0.1;
    },
    toujours(t, poids) {
      matCristal.emissiveIntensity = 0.85 + Math.sin(t * 2.4) * 0.2 + poids * (0.5 + Math.sin(t * 5.2) * 0.25);
      cristal.rotation.y = t * 0.6;
    },
  });
}

// --- Bertil -----------------------------------------------------------------------------------

/** Le forgeron de modelesVillage.ts, branché sur le même système : il marche, et bat le fer quand il est à l'enclume. */
function creerBertil(): ModeleHabitant {
  const forgeron = creerForgeron();
  return {
    objet: forgeron.objet,
    mettreAJour(dt, pose) {
      forgeron.animer(dt, pose);
    },
  };
}

export function creerModeleHabitant(id: IdHabitant): ModeleHabitant {
  switch (id) {
    case 'gaspard':
      return creerGaspard();
    case 'marthe':
      return creerMarthe();
    case 'mathilde':
      return creerMathilde();
    case 'hugo':
      return creerHugo();
    case 'aldric':
      return creerAldric();
    case 'bertil':
      return creerBertil();
  }
}

// --- Campement d'Aldric -----------------------------------------------------------------------

export interface CampementAldric {
  /** Le feu (bûches, pierres, flammes) : origine au sol, au centre */
  feu: THREE.Group;
  /** Le rocher où s'asseoir : origine au sol */
  rocher: THREE.Group;
  mettreAJour(dt: number): void;
}

/** Petit feu entouré de pierres et rocher plat pour s'asseoir. Les flammes luisent mais n'éclairent pas (aucune lumière). */
export function creerCampementAldric(): CampementAldric {
  const feu = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = 0.36 + (i % 3) * 0.02;
    feu.add(tourner(maille(galet(0.1 + (i % 2) * 0.025, 0.07, 0.085), mat(i % 2 ? K.roche : K.rocheSombre), Math.sin(a) * r, 0.045, Math.cos(a) * r), 0, a * 1.7, 0));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    feu.add(tige([Math.sin(a) * 0.27, 0.04, Math.cos(a) * 0.27], [-Math.sin(a) * 0.06, 0.2, -Math.cos(a) * 0.06], 0.045, K.buche, 0.038));
  }
  const matFlamme = creerMateriau(K.flamme);
  matFlamme.emissive.setHex(K.flamme);
  matFlamme.emissiveIntensity = 1.6;
  const flammes = [
    [0, 0, 0.14, 0.46],
    [0.08, 0.05, 0.09, 0.3],
    [-0.07, -0.05, 0.085, 0.27],
  ].map(([x, z, rayon, hauteur]) => {
    const f = maille(new THREE.ConeGeometry(rayon, hauteur, 5), matFlamme, x, 0.13 + hauteur / 2, z);
    f.castShadow = false;
    f.userData.garder = true;
    f.userData.base = 0.13 + hauteur / 2;
    feu.add(f);
    return f;
  });
  aplatir(feu);

  const rocher = new THREE.Group();
  rocher.add(tourner(maille(galet(0.56, 0.3, 0.5), mat(K.roche), 0, 0.2, 0), 0, 0.5, 0.06));
  rocher.add(tourner(maille(galet(0.3, 0.2, 0.26), mat(K.rocheSombre), 0.42, 0.1, 0.25), 0, 1.2, 0));
  aplatir(rocher);

  let t = 0;
  return {
    feu,
    rocher,
    mettreAJour(dt) {
      t += dt;
      flammes.forEach((f, i) => {
        const v = 1 + Math.sin(t * (9 + i * 2.3) + i * 1.9) * 0.16 + Math.sin(t * 17.3 + i) * 0.07;
        f.scale.set(1 - (v - 1) * 0.5, v, 1 - (v - 1) * 0.5);
        f.position.y = (f.userData.base as number) * v;
        f.rotation.y = t * (1.4 + i * 0.6);
      });
      matFlamme.emissiveIntensity = 1.5 + Math.sin(t * 11) * 0.25;
    },
  };
}

// --- Rendu ------------------------------------------------------------------------------------

export interface RenduHabitants {
  modeles: Record<IdHabitant, ModeleHabitant>;
  campement: CampementAldric;
}

/** Tous les modèles, créés une fois au démarrage (6 habitants au plus) ; src/jeu/habitants.ts les place et les anime. */
export function creerRenduHabitants(): RenduHabitants {
  return {
    modeles: {
      gaspard: creerModeleHabitant('gaspard'),
      marthe: creerModeleHabitant('marthe'),
      mathilde: creerModeleHabitant('mathilde'),
      bertil: creerModeleHabitant('bertil'),
      hugo: creerModeleHabitant('hugo'),
      aldric: creerModeleHabitant('aldric'),
    },
    campement: creerCampementAldric(),
  };
}
