// Personnage : villageois low poly fait en code d'après l'image concept (tunique verte, ceinture,
// pantalon brun, bottes, cheveux bruns) et ses animations procédurales (repos, marche, course, saut,
// réception, nage, frappe), plus les bras vus en 1re personne.
// Repère du personnage : pieds à y = 0, il regarde vers +z ; son côté droit est donc en -x.
// Les dimensions et couleurs du modèle sont des constantes de ce fichier (et de outils.ts).

import * as THREE from 'three';
import { CONFIG } from '../config';
import { gesteFrappe } from '../regles/frappe';
import type { NomSort } from '../regles/sorts';
import type { TypeArmure, TypeCasque } from '../regles/equipement';
import { creerArmures, creerCasques, creerManchesArmure, quartFuseau, type CorpsArmure } from './armures';
import { ecartAvant, hasard } from './coiffures';
import { creerEffetMain } from './effetsSorts';
import {
  OUTIL_PAR_DEFAUT,
  PRISES,
  animerTorche,
  boite,
  creerMateriau,
  creerMateriauxParNiveau,
  creerOutil,
  fuseau,
  maille,
  type Anneau,
  type NiveauOutil,
  type TypeObjetEnMain,
} from './outils';
import { ENCOCHE_ARC_Y, creerCarquois, encocheArc, tendreArc } from './outils';
import { PRISE_BOUCLIER_Z, creerBouclier, type TypeBouclier } from './outils';

const COULEURS = {
  peau: 0xf0b47e,
  nez: 0xe39669,
  cheveux: 0x7b4b2e,
  tunique: 0x7d9455,
  pantalon: 0x7c5a3a,
  ceinture: 0x7a4a2c,
  boucle: 0xa89f90,
  bottes: 0x633f29,
  revers: 0x74492e,
  yeux: 0x47301f,
  bouche: 0x8a4f35,
  // Manches claires des bras en 1re personne (images « vue subjective »)
  chemise: 0xe8d9b0,
  poignet: 0xd3c093,
};

type Materiaux = Record<keyof typeof COULEURS, THREE.MeshStandardMaterial>;

function creerMateriaux(): Materiaux {
  const resultat = {} as Materiaux;
  for (const [nom, couleur] of Object.entries(COULEURS)) {
    resultat[nom as keyof Materiaux] = creerMateriau(couleur);
  }
  return resultat;
}

// Squelette (mètres). Hauteur totale ≈ 1,8 m ; grosse tête et mains épaisses comme sur l'image.
const HAUTEUR_TAILLE = 0.86;
const HAUTEUR_HANCHE = 0.74;
const ECART_HANCHES = 0.14;
const LONGUEUR_CUISSE = 0.36;
const LONGUEUR_TIBIA = 0.3;
// Épaule et cou, mesurés depuis la taille
const EPAULE_X = 0.305;
const EPAULE_Y = 0.33;
const COU_Y = 0.4;
// La tête est grosse, comme sur l'image ; le tout est remis à l'échelle pour mesurer 1,8 m
const ECHELLE_TETE = 1.2;
const ECHELLE_CORPS = 1.8 / (HAUTEUR_TAILLE + COU_Y + 0.545 * ECHELLE_TETE);
const LONGUEUR_BRAS = 0.26;
// Centre de la main, mesuré depuis le coude
const MAIN_Y = -0.285;

// Volets du bassin : ce qui pend de la ceinture (bas de tunique, pans d'armure) est en quatre morceaux, devant et
// derrière chaque jambe, qui s'ouvrent avec la cuisse au lieu d'être traversés. La charnière de chaque volet va du
// milieu du corps (à `zMilieu` devant ou derrière) au côté (à `xCote`), juste sous la ceinture.
// Carquois : recul derrière le dos (m) et bascule (rad, le bas s'écarte du dos) selon l'armure portée.
// Mesuré avec essai/carquois.html : le carquois touche presque le dos de chaque armure sans rentrer dedans.
const POSE_CARQUOIS: Record<TypeArmure | 'aucune', { recul: number; bascule: number }> = {
  aucune: { recul: 0.064, bascule: 0 },
  fibres: { recul: 0.068, bascule: 0.025 },
  cuir: { recul: 0.081, bascule: 0 },
  fourrure: { recul: 0.19, bascule: 0.165 },
  mailles: { recul: 0.085, bascule: 0.017 },
  plaques: { recul: 0.085, bascule: 0.022 },
};

const VOLETS = {
  y: -0.03,
  zMilieu: 0.17,
  xCote: 0.27,
  // La cuisse peut bouger de `marge` radians avant que le volet s'ouvre, puis il s'ouvre de `gain` fois son angle
  marge: 0.2,
  gain: 1.15,
  // Cotte de mailles : son bas descend à mi-cuisse ; ouvert autant que les autres, il se lève comme une plaque
  // et montre son dessous. Il s'ouvre donc moins (la cuisse peut l'effleurer, c'est moins visible).
  gainMailles: 0.55,
};
// Cape (armure de fourrure) : charnière en haut du dos. Elle se soulève quand une jambe part en arrière ou en
// l'air (vite), puis retombe (lentement) : un seul angle lissé par image.
const CAPE = {
  y: 0.37,
  z: -0.2,
  // Angle par radian de recul de la jambe (cuisse, plus une part du genou plié), et angle en l'air
  parRecul: 0.3,
  partGenou: 0.4,
  enAir: 0.3,
  maxi: 0.6,
  montee: 18,
  retombee: 5,
};

const melange = (a: number, b: number, t: number) => a + (b - a) * t;
const borne = (v: number, mini: number, maxi: number) => Math.max(mini, Math.min(maxi, v));
/** Rapproche `valeur` de `cible` en douceur (rapidite en 1/s). */
const lisser = (valeur: number, cible: number, rapidite: number, dt: number) =>
  valeur + (cible - valeur) * (1 - Math.exp(-rapidite * dt));

/**
 * Les trois temps de la frappe : `poids` et `abattement` viennent des règles (armer puis frapper,
 * l'impact tombe pile quand abattement atteint 1) ; `choc` est le contrecoup juste après l'impact.
 */
function tempsFrappe(progression: number): { poids: number; abattement: number; choc: number } {
  const geste = gesteFrappe(progression);
  const impact = CONFIG.personnage.frappe.instantImpact;
  let choc = 0;
  if (progression >= impact) {
    const u = Math.min(1, (progression - impact) / (1 - impact));
    choc = Math.sin(Math.PI * Math.min(1, u / 0.45)) * (1 - u);
  }
  return { poids: geste.poids, abattement: geste.abattement, choc };
}

/** Montée douce de 0 à 1 pendant que `t` va de `debut` à `fin`. */
function rampe(t: number, debut: number, fin: number): number {
  const u = borne((t - debut) / Math.max(1e-3, fin - debut), 0, 1);
  return u * u * (3 - 2 * u);
}

interface TempsSort {
  /** Part du geste de sort dans la pose du bras gauche (0 : aucune, 1 : entière) */
  poids: number;
  /** Boule de feu : 0 main levée paume ouverte, 1 bras tendu vers l'avant */
  poussee: number;
  /** Taille de la flamme dans la paume (0 à 1) ; elle disparaît quand la boule part */
  flamme: number;
  /** Intensité de la lueur verte du soin (0 à 1) */
  lueur: number;
}

const SANS_SORT: TempsSort = { poids: 0, poussee: 0, flamme: 0, lueur: 0 };

function dureeGesteSort(type: NomSort): number {
  const G = CONFIG.sorts.geste;
  return type === 'boule-de-feu' ? G.dureeBoule : type === 'soin' ? G.dureeSoin : G.dureeBarriere;
}

/**
 * Les temps du geste d'un sort, `t` secondes après son départ. Boule de feu : la main se lève et
 * la flamme grossit pendant l'anticipation, la paume pousse vers l'avant au moment où la boule
 * part, puis la main revient. Soin : la main vient devant la poitrine, y reste, puis revient.
 */
function tempsSort(type: NomSort, t: number): TempsSort {
  const G = CONFIG.sorts.geste;
  if (type === 'boule-de-feu') {
    const depart = G.anticipationBoule;
    const retour = depart + (G.dureeBoule - depart) * 0.45;
    return {
      poids: rampe(t, 0, 0.55 * depart) * (1 - rampe(t, retour, G.dureeBoule)),
      poussee: rampe(t, 0.6 * depart, depart + 0.05),
      flamme: t < depart ? 0.12 + 0.88 * rampe(t, 0.1 * depart, depart) : 0,
      lueur: 0,
    };
  }
  if (type === 'barriere') {
    // Barrière : la main se lève tout de suite, bras tendu et paume en avant, y reste, puis revient
    const poids = rampe(t, 0, 0.2 * G.dureeBarriere) * (1 - rampe(t, 0.65 * G.dureeBarriere, G.dureeBarriere));
    return { poids, poussee: 1, flamme: 0, lueur: 0 };
  }
  const poids = rampe(t, 0, 0.25 * G.dureeSoin) * (1 - rampe(t, 0.7 * G.dureeSoin, G.dureeSoin));
  return { poids, poussee: 0, flamme: 0, lueur: poids };
}

// Outil dans la main : manche vers l'avant du bras pendant, tranchant vers le bas
const BASE_OUTIL_EN_MAIN = new THREE.Matrix4().makeBasis(
  new THREE.Vector3(0, -1, 0),
  new THREE.Vector3(0, 0, 1),
  new THREE.Vector3(-1, 0, 0),
);

export interface PosePersonnage {
  x: number;
  y: number;
  z: number;
  orientation: number;
  /** Vitesse horizontale réelle, en m/s */
  vitesse: number;
  auSol: boolean;
  nage: boolean;
  /** Avancement de la frappe (0 à 1), -1 si aucune */
  progressionFrappe: number;
  /** Escalade en cours (absent : non) et avancement du geste, en radians (un tour = un cycle des deux mains) */
  grimpe?: boolean;
  phaseEscalade?: number;
}

export interface Personnage {
  objet: THREE.Group;
  /** Phase du cycle de marche (radians) et intensité (0 à l'arrêt, 1 en marche) : sert au balancement de la caméra */
  readonly phaseMarche: number;
  readonly intensiteMarche: number;
  mettreAJour(dt: number, pose: PosePersonnage): void;
  /** Vrai : le corps n'est plus dessiné mais son ombre reste (1re personne). */
  definirOmbreSeule(ombreSeule: boolean): void;
  /** Change ce que tient la main droite (hache par défaut, ou pousse d'arbre) ; `niveau` : outil de base ou en fer. */
  definirOutil(type: TypeObjetEnMain, niveau?: NiveauOutil): void;
  /** Lance le geste d'un sort : le bras gauche se lève (boule de feu, barrière) ou se ramène vers la poitrine (soin). */
  jouerSort(type: NomSort): void;
  /** Bouclier porté au bras gauche (avec l'épée), ou `null` pour l'enlever. */
  definirBouclier(type: TypeBouclier | null): void;
  /** Bouclier levé (parade) ou non : le bras gauche se lève devant le corps. */
  definirGarde(leve: boolean): void;
  /** Arc en main : tension de la corde (0 à 1), visée en cours (le bras gauche se tend, le droit tire la corde), flèche encochée. */
  definirArc(tension: number, vise: boolean, fleche: boolean): void;
  /** Carquois dans le dos (arc possédé). */
  definirCarquois(visible: boolean): void;
  /** Armure portée, visible sur le corps (ou `null` : le villageois en tunique). */
  definirArmure(type: TypeArmure | null): void;
  /** Casque porté, visible sur la tête (ou `null` : tête nue). */
  definirCasque(type: TypeCasque | null): void;
}

// Un bras et une jambe : leurs articulations, et les parties du corps qu'une armure peut remplacer
type Bras = CorpsArmure['bras'][number];
type Jambe = CorpsArmure['jambes'][number];

// Tranches du crâne (repère de la tête, pivot à la base du crâne). Les cheveux s'appuient dessus.
const TRANCHES_TETE: Anneau[] = [
  { y: 0.0, rx: 0.13, rz: 0.13, c: 0.05, dz: 0.03 },
  { y: 0.06, rx: 0.2, rz: 0.19, c: 0.07, dz: 0.01 },
  { y: 0.2, rx: 0.215, rz: 0.2, c: 0.07 },
  { y: 0.37, rx: 0.205, rz: 0.2, c: 0.08 },
  { y: 0.46, rx: 0.13, rz: 0.13, c: 0.05 },
];

/** Distance de l'axe de la tête à la surface du crâne, à la hauteur `y`, dans la direction `angle` (radians, 0 : devant, +90° : côté gauche). */
function rayonCrane(angle: number, y: number): number {
  const T = TRANCHES_TETE;
  let k = 0;
  while (k < T.length - 2 && y > T[k + 1].y) k++;
  const t = borne((y - T[k].y) / (T[k + 1].y - T[k].y), 0, 1);
  const rx = melange(T[k].rx, T[k + 1].rx, t);
  const rz = melange(T[k].rz, T[k + 1].rz, t);
  const c = melange(T[k].c ?? 0, T[k + 1].c ?? 0, t);
  const s = Math.abs(Math.sin(angle));
  const co = Math.abs(Math.cos(angle));
  return Math.min(rx / Math.max(s, 1e-6), rz / Math.max(co, 1e-6), (rx + rz - c) / (s + co));
}

// Cheveux : coupe courte en une seule masse à facettes, d'après l'image concept. Tout est dans le repère de la tête.
const CHEVEUX = {
  // Deux tons de brun, pour que les facettes se lisent
  tons: [0x7b4b2e, 0x6b3f26],
  sommetY: 0.548,
  // Volume arrondi de la coupe : centre, demi-hauteur, demi-largeur, demi-profondeur devant et derrière
  centreY: 0.31,
  ry: 0.238,
  rx: 0.262,
  rzAvant: 0.24,
  rzArriere: 0.29,
  // Épaisseur minimale au-dessus du crâne
  epaisseur: 0.03,
  // Bord bas de la masse, d'un côté (l'autre est son reflet) : [angle en degrés (0 devant, 90 oreille, 180 nuque), hauteur].
  // Front dégagé (la frange passe devant), favori pointu devant l'oreille, haut de l'oreille couvert, nuque courte.
  bord: [
    [0, 0.385],
    [18, 0.385],
    [36, 0.38],
    [48, 0.35],
    [58, 0.26],
    [68, 0.215],
    [78, 0.255],
    [92, 0.24],
    [106, 0.232],
    [120, 0.14],
    [140, 0.1],
    [160, 0.09],
    [180, 0.09],
  ] as [number, number][],
  // Étages de la masse : quatre du bord (0) jusqu'à la hauteur `pivotY` (1), puis deux à hauteur fixe sur le dessus
  pivotY: 0.43,
  etagesBas: [0, 0.33, 0.68, 1],
  etagesHaut: [0.5, 0.535],
  // Bord bas de la frange, du côté droit au côté gauche : mèches pointues balayées depuis la raie (à 28°, côté gauche)
  // Les deux bouts (±66°) rentrent dans la masse des tempes.
  frange: [
    [-66, 0.32],
    [-54, 0.3],
    [-38, 0.35],
    [-31, 0.305],
    [-10, 0.355],
    [-4, 0.315],
    [16, 0.352],
    [28, 0.366],
    [45, 0.325],
    [55, 0.305],
    [66, 0.32],
  ] as [number, number][],
};

/** Hauteur du bord bas de la masse de cheveux dans la direction `degres`. */
function bordCheveux(degres: number): number {
  const B = CHEVEUX.bord;
  const a = ecartAvant(degres);
  let k = 0;
  while (k < B.length - 2 && a > B[k + 1][0]) k++;
  return melange(B[k][1], B[k + 1][1], borne((a - B[k][0]) / (B[k + 1][0] - B[k][0]), 0, 1));
}

/** Rayon de la masse de cheveux à la hauteur `y` dans la direction `angle` (radians) : un volume arrondi, jamais plus près du crâne que l'épaisseur minimale. */
function rayonCheveux(angle: number, y: number): number {
  const C = CHEVEUX;
  const s = Math.sin(angle);
  const co = Math.cos(angle);
  const equateur = 1 / Math.hypot(s / C.rx, co / (co >= 0 ? C.rzAvant : C.rzArriere));
  let h: number;
  if (y >= C.centreY) {
    const v = (y - C.centreY) / C.ry;
    h = Math.sqrt(Math.max(0, 1 - v * v));
  } else {
    // Sous le milieu, la masse se resserre vers la nuque
    const u = (C.centreY - y) / (C.centreY - 0.09);
    h = 1 - 0.22 * u * u;
  }
  const crane = y > 0.46 ? 0 : rayonCrane(angle, y) + C.epaisseur;
  return Math.max(crane, equateur * h);
}

type Facette = [THREE.Vector3, THREE.Vector3, THREE.Vector3, number];

/** Maillage à facettes (une couleur par triangle) à partir d'une liste de triangles `[a, b, c, ton]`. */
function facettes(triangles: Facette[], materiau: THREE.Material): THREE.Mesh {
  const tons = CHEVEUX.tons.map((t) => new THREE.Color(t));
  const positions: number[] = [];
  const couleurs: number[] = [];
  for (const [a, b, c, ton] of triangles) {
    for (const p of [a, b, c]) {
      positions.push(p.x, p.y, p.z);
      couleurs.push(tons[ton].r, tons[ton].g, tons[ton].b);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(couleurs, 3));
  g.computeVertexNormals();
  return maille(g, materiau);
}

/**
 * Cheveux du héros : un groupe `cheveux` avec la masse (calotte, côtés, favoris, nuque) et, à part, la frange
 * (maillage `frange`), pour pouvoir cacher l'une ou l'autre sous un casque. `materiau` : blanc, couleurs par sommet.
 */
function creerCheveux(materiau: THREE.Material): { groupe: THREE.Group; masse: THREE.Mesh; frange: THREE.Mesh } {
  const C = CHEVEUX;
  const rad = Math.PI / 180;
  const point = (degres: number, y: number, r: number) =>
    new THREE.Vector3(Math.sin(degres * rad) * r, y, Math.cos(degres * rad) * r);

  // Masse : colonnes tout autour de la tête (angles du bord et leur reflet), étages décalés d'une demi-colonne un sur deux
  const angles: number[] = [];
  for (let k = C.bord.length - 2; k >= 1; k--) angles.push(-C.bord[k][0]);
  for (const [a] of C.bord) angles.push(a);
  const n = angles.length;
  const suivant = (i: number) => (i + 1 < n ? angles[i + 1] : angles[0] + 360);
  const nbBas = C.etagesBas.length;
  const lignes: THREE.Vector3[][] = [...C.etagesBas, ...C.etagesHaut].map((f, j) =>
    angles.map((angle, i) => {
      const a = j % 2 === 1 ? (angle + suivant(i)) / 2 : angle;
      const bord = bordCheveux(a);
      const y = j < nbBas ? melange(bord, C.pivotY, f) : f;
      // Désordre vers l'extérieur seulement (la masse ne rentre jamais dans le crâne), et aucun sur le front,
      // où les étages sont serrés sous la frange et où la frange rejoint la masse
      const place =
        j === 0 ? 0 : j < nbBas ? borne((0.385 - bord) / 0.15, 0, 1) : j === nbBas ? borne((ecartAvant(a) - 45) / 30, 0, 1) : 1;
      return point(a, y, rayonCheveux(a * rad, y) + 0.016 * hasard(i, j) * place);
    }),
  );
  const masse: Facette[] = [];
  const ton = (i: number, j: number) => (hasard(i + 31, j + 7) > 0.62 ? 1 : 0);
  // Retour du bord vers l'intérieur du crâne : la masse a une épaisseur, on ne voit jamais dessous
  const dessous = angles.map((a) => {
    const y = bordCheveux(a) + 0.015;
    return point(a, y, rayonCrane(a * rad, y) - 0.02);
  });
  const sommet = new THREE.Vector3(0.03, C.sommetY, -0.02);
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
    // Sommet, un peu du côté de la raie
    const dernier = lignes[lignes.length - 1];
    masse.push([dernier[i], dernier[i1], sommet, ton(i, 99)]);
  }

  // Frange : bande posée devant la masse, du haut du front (rentrée dans la masse) aux pointes des mèches
  const F = C.frange;
  const rangs = F.map(([a, yBas], i) => {
    // Les deux bouts rentrent dans la masse des tempes
    const retrait = i === 0 || i === F.length - 1 ? 0.03 : 0;
    const yDessous = yBas + 0.014;
    return [
      point(a, yDessous, rayonCrane(a * rad, yDessous) - 0.02),
      point(a, yBas, rayonCheveux(a * rad, yBas) + 0.014 - retrait),
      point(a, 0.415, rayonCheveux(a * rad, 0.415) + 0.022 - retrait),
      point(a, 0.47, rayonCheveux(a * rad, 0.47) - 0.016),
    ];
  });
  const frange: Facette[] = [];
  for (let i = 0; i < F.length - 1; i++) {
    for (let j = 0; j < 3; j++) {
      const a = rangs[i][j];
      const b = rangs[i + 1][j];
      const c = rangs[i + 1][j + 1];
      const d = rangs[i][j + 1];
      frange.push([a, b, c, j === 0 ? 1 : ton(i, 40 + j)], [a, c, d, j === 0 ? 1 : ton(i, 50 + j)]);
    }
  }

  const groupe = new THREE.Group();
  groupe.name = 'cheveux';
  const maillageMasse = facettes(masse, materiau);
  maillageMasse.name = 'masse';
  const maillageFrange = facettes(frange, materiau);
  maillageFrange.name = 'frange';
  groupe.add(maillageMasse, maillageFrange);
  return { groupe, masse: maillageMasse, frange: maillageFrange };
}

export function creerPersonnage(): Personnage {
  const mat = creerMateriaux();
  const matOutilsParNiveau = creerMateriauxParNiveau();
  const matOutils = matOutilsParNiveau.base;
  // Cheveux : matériau blanc, la couleur (deux tons de brun) est portée par les facettes
  const matCheveux = creerMateriau(0xffffff);
  matCheveux.vertexColors = true;
  const objet = new THREE.Group();
  // `tout` monte et descend avec le pas ; `bassin` porte les jambes et le bas de la tunique ;
  // `haut` (buste, tête, bras) pivote à la taille
  const tout = new THREE.Group();
  tout.scale.setScalar(ECHELLE_CORPS);
  objet.add(tout);
  const bassin = new THREE.Group();
  bassin.position.y = HAUTEUR_TAILLE;
  tout.add(bassin);
  const haut = new THREE.Group();
  haut.position.y = HAUTEUR_TAILLE;
  tout.add(haut);

  /**
   * Volet articulé : `volet` pivote (rotation.x) autour de la droite qui passe par (x, y, z) dans la direction
   * (dx, dz) ; ce qu'on accroche à `contenu` garde les coordonnées de `parent`.
   */
  function creerVolet(parent: THREE.Group, x: number, y: number, z: number, dx: number, dz: number) {
    const charniere = new THREE.Group();
    charniere.position.set(x, y, z);
    charniere.rotation.y = Math.atan2(-dz, dx);
    const volet = new THREE.Group();
    const contenu = new THREE.Group();
    contenu.quaternion.copy(charniere.quaternion).invert();
    contenu.position.copy(charniere.position).negate().applyQuaternion(contenu.quaternion);
    volet.add(contenu);
    charniere.add(volet);
    parent.add(charniere);
    return { volet, contenu };
  }
  /** Volet du bassin devant (`sens` 1) ou derrière (-1) la jambe du côté `cote` ; il s'ouvre vers l'extérieur (rotation.x positive). */
  const creerVoletBassin = (cote: number, sens: number) =>
    creerVolet(bassin, 0, VOLETS.y, sens * VOLETS.zMilieu, -sens * VOLETS.xCote, cote * VOLETS.zMilieu);

  // Bas de la tunique (évasé, en quatre quarts : un par volet), ceinture et boucle
  const TRANCHES_BAS_TUNIQUE: Anneau[] = [
    { y: -0.24, rx: 0.29, rz: 0.19, c: 0.07 },
    { y: -0.02, rx: 0.24, rz: 0.155, c: 0.06 },
  ];
  const basTunique: THREE.Object3D[] = [];
  const ceinture = [
    maille(
      fuseau([
        { y: -0.04, rx: 0.25, rz: 0.165, c: 0.06 },
        { y: 0.035, rx: 0.25, rz: 0.165, c: 0.06 },
      ]),
      mat.ceinture,
    ),
    boite(0.085, 0.07, 0.02, mat.boucle, 0, -0.002, 0.168),
    boite(0.048, 0.034, 0.02, mat.ceinture, 0, -0.002, 0.172),
  ];
  bassin.add(...ceinture);
  // Cape des armures : volet du dos, articulé en haut du buste (rotation.x positive : le bas s'écarte du corps)
  const cape = creerVolet(haut, 0, CAPE.y, CAPE.z, 1, 0);
  let angleCape = 0;

  // Buste : tunique plus large aux épaules, encolure en V, cou
  const torse = maille(
    fuseau([
      { y: 0.0, rx: 0.238, rz: 0.152, c: 0.06 },
      { y: 0.2, rx: 0.255, rz: 0.165, c: 0.065 },
      { y: 0.345, rx: 0.255, rz: 0.158, c: 0.07 },
      { y: 0.4, rx: 0.19, rz: 0.12, c: 0.05 },
    ]),
    mat.tunique,
  );
  haut.add(torse);
  const encolure = new THREE.ConeGeometry(0.05, 0.11, 3);
  encolure.rotateX(Math.PI);
  encolure.scale(1, 1, 0.3);
  haut.add(maille(encolure, mat.peau, 0, 0.335, 0.139));
  haut.add(
    maille(
      fuseau([
        { y: 0.36, rx: 0.075, rz: 0.075 },
        { y: 0.44, rx: 0.07, rz: 0.07 },
      ]),
      mat.peau,
    ),
  );

  // Tête (pivot à la base du crâne) : visage plat, yeux, sourcils, nez, sourire, oreilles
  const tete = new THREE.Group();
  tete.position.y = COU_Y;
  tete.scale.setScalar(ECHELLE_TETE);
  haut.add(tete);
  tete.add(maille(fuseau(TRANCHES_TETE), mat.peau));
  // Pour les casques : ce qu'ils peuvent cacher (les oreilles ; les yeux, sourcils, nez et bouche)
  const oreilles: THREE.Object3D[] = [];
  const visage: THREE.Object3D[] = [];
  for (const cote of [1, -1]) {
    visage.push(boite(0.032, 0.064, 0.02, mat.yeux, cote * 0.076, 0.215, 0.196));
    const sourcil = boite(0.08, 0.024, 0.022, mat.cheveux, cote * 0.08, 0.292, 0.196);
    sourcil.rotation.z = -cote * 0.14;
    visage.push(sourcil);
    const coin = boite(0.036, 0.015, 0.018, mat.bouche, cote * 0.05, 0.109, 0.194);
    coin.rotation.z = cote * 0.6;
    visage.push(coin);
    oreilles.push(
      maille(
        fuseau([
          { y: 0.15, rx: 0.022, rz: 0.035 },
          { y: 0.25, rx: 0.026, rz: 0.04 },
        ]),
        mat.peau,
        cote * 0.222,
        0,
        0.0,
      ),
    );
  }
  visage.push(boite(0.07, 0.015, 0.018, mat.bouche, 0, 0.099, 0.194));
  const nez = new THREE.ConeGeometry(0.03, 0.06, 4);
  nez.rotateX(Math.PI / 2);
  visage.push(maille(nez, mat.nez, 0, 0.158, 0.215));
  tete.add(...oreilles, ...visage);
  // Cheveux : une masse continue et la frange à part (voir creerCheveux)
  const cheveux = creerCheveux(matCheveux);
  tete.add(cheveux.groupe);
  // Casques : posés sur la tête, construits à la première demande (voir armures.ts)
  const casques = creerCasques({ tete, cheveux: cheveux.groupe, masse: cheveux.masse, oreilles, visage, rayonCrane, rayonCheveux });

  // Bras : épaule → manche, coude → manche évasée puis main épaisse
  function creerBras(cote: number): Bras {
    const epaule = new THREE.Group();
    epaule.position.set(cote * EPAULE_X, EPAULE_Y, 0);
    epaule.add(
      maille(
        fuseau([
          { y: -LONGUEUR_BRAS, rx: 0.074, rz: 0.08 },
          { y: -0.03, rx: 0.08, rz: 0.086 },
          { y: 0.025, rx: 0.064, rz: 0.072 },
        ]),
        mat.tunique,
      ),
    );
    const coude = new THREE.Group();
    coude.position.y = -LONGUEUR_BRAS;
    coude.add(
      maille(
        fuseau([
          { y: -0.215, rx: 0.09, rz: 0.096 },
          { y: 0.02, rx: 0.073, rz: 0.079 },
        ]),
        mat.tunique,
      ),
    );
    coude.add(
      maille(
        fuseau([
          { y: -0.385, rx: 0.042, rz: 0.056 },
          { y: -0.345, rx: 0.066, rz: 0.08 },
          { y: -0.25, rx: 0.07, rz: 0.082 },
          { y: -0.19, rx: 0.055, rz: 0.06 },
        ]),
        mat.peau,
      ),
    );
    // Pouce, vers l'avant
    coude.add(boite(0.036, 0.075, 0.036, mat.peau, cote * -0.012, -0.28, 0.088));
    epaule.add(coude);
    haut.add(epaule);
    // Dans l'ordre de création ci-dessus : la manche ; puis l'avant-bras, la main et le pouce
    const [avantBras, ...main] = coude.children;
    return { cote, epaule, coude, manche: epaule.children[0], avantBras, main };
  }
  const brasG = creerBras(1);
  const brasD = creerBras(-1);

  // Bouclier sur l'avant-bras gauche (avec l'épée) : face tournée vers l'extérieur, poignée contre le bras
  const supportBouclier = new THREE.Group();
  supportBouclier.position.set(0.165, -0.26, 0);
  supportBouclier.rotation.y = Math.PI / 2;
  brasG.coude.add(supportBouclier);
  // Arc dans la main gauche : il se tient en travers de la main, son dos (+x) dans le prolongement du bras.
  // Il est décalé vers le corps pour que la corde longe l'avant-bras sans le traverser.
  const supportArc = new THREE.Group();
  supportArc.position.set(-0.09, MAIN_Y, 0.01);
  supportArc.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(-1, 0, 0)),
  );
  brasG.coude.add(supportArc);
  let arcTenu = false;
  let tensionArc = 0;
  let viseeArc = false;
  let flecheArc = false;
  let poidsVisee = 0;
  // Carquois dans le dos, penché vers l'épaule droite (montré quand l'arc est possédé). Il est posé contre le dos de
  // l'armure portée : reculé (et, sur la cape de fourrure, basculé, le bas plus loin du dos) d'après les mesures de
  // essai/carquois.html, pour ne jamais rentrer dedans ni flotter (environ 5 mm d'écart).
  // Sur la cape, il suit la cape quand elle se soulève (il tourne avec elle autour de sa charnière).
  const carquois = creerCarquois(matOutils);
  carquois.rotation.z = 0.45;
  carquois.visible = false;
  haut.add(carquois);
  let armurePortee: TypeArmure | null = null;
  function poserCarquois(angleCape = 0): void {
    const { recul, bascule } = POSE_CARQUOIS[armurePortee ?? 'aucune'];
    const dy = 0.17 - CAPE.y;
    const dz = -0.15 - recul - CAPE.z;
    const c = Math.cos(angleCape);
    const s = Math.sin(angleCape);
    carquois.position.set(0.03, CAPE.y + dy * c - dz * s, CAPE.z + dy * s + dz * c);
    carquois.rotation.x = bascule + angleCape;
  }
  poserCarquois();
  const boucliers = new Map<TypeBouclier, THREE.Group>();
  // Bouclier levé (parade) : `poidsGarde` va de 0 à 1 en douceur
  let gardeLevee = false;
  let poidsGarde = 0;
  function definirBouclier(type: TypeBouclier | null): void {
    supportBouclier.clear();
    if (!type) return;
    let bouclier = boucliers.get(type);
    if (!bouclier) {
      bouclier = creerBouclier(type, matOutilsParNiveau.base);
      boucliers.set(type, bouclier);
    }
    supportBouclier.add(bouclier);
  }

  // Outil dans la main droite
  const supportOutil = new THREE.Group();
  supportOutil.position.set(0, MAIN_Y, 0.01);
  supportOutil.quaternion.setFromRotationMatrix(BASE_OUTIL_EN_MAIN);
  brasD.coude.add(supportOutil);
  const outils = new Map<string, THREE.Group>();
  let outilTenu: THREE.Group | null = null;
  // Corps caché en 1re personne : les flammes de la torche (couleurs pleines, hors de `materiaux`) se cachent avec lui
  let corpsCache = false;
  // Torche en main : le bras droit se lève (voir mettreAJour) ; `poidsTorche` va de 0 à 1 en douceur
  let torcheTenue = false;
  let poidsTorche = 0;
  function montrerFlammes(): void {
    const flammes = outilTenu?.userData.flammes as THREE.Object3D | undefined;
    if (flammes) flammes.visible = !corpsCache;
  }
  function definirOutil(type: TypeObjetEnMain, niveau: NiveauOutil = 'base'): void {
    const cle = `${type}:${niveau}`;
    let outil = outils.get(cle);
    if (!outil) {
      outil = creerOutil(type, matOutilsParNiveau[niveau]);
      // La pousse se porte tige relevée, et non pointée vers l'avant comme un manche
      if (type === 'pousse') outil.rotation.z = 1.0;
      outils.set(cle, outil);
    }
    supportOutil.clear();
    supportArc.clear();
    // L'arc se tient de la main gauche : la main droite reste libre pour la corde
    arcTenu = type === 'arc';
    (arcTenu ? supportArc : supportOutil).add(outil);
    outilTenu = outil;
    torcheTenue = type === 'torche';
    montrerFlammes();
  }
  definirOutil(OUTIL_PAR_DEFAUT);

  // Jambes : hanche → cuisse, genou → pantalon bouffant et tige de la botte, cheville → pied
  function creerJambe(cote: number): Jambe & { pivotAvant: THREE.Group; pivotArriere: THREE.Group } {
    const hanche = new THREE.Group();
    hanche.position.set(cote * ECART_HANCHES, HAUTEUR_HANCHE - HAUTEUR_TAILLE, 0);
    hanche.add(
      maille(
        fuseau([
          { y: -LONGUEUR_CUISSE - 0.01, rx: 0.1, rz: 0.104 },
          { y: 0.05, rx: 0.108, rz: 0.11 },
        ]),
        mat.pantalon,
      ),
    );
    // Volets du bassin devant et derrière cette jambe, chacun avec son quart du bas de la tunique
    const voletAvant = creerVoletBassin(cote, 1);
    const voletArriere = creerVoletBassin(cote, -1);
    for (const [v, sens] of [
      [voletAvant, 1],
      [voletArriere, -1],
    ] as const) {
      const quart = maille(quartFuseau(TRANCHES_BAS_TUNIQUE, cote, sens), mat.tunique);
      v.contenu.add(quart);
      basTunique.push(quart);
    }
    const genou = new THREE.Group();
    genou.position.y = -LONGUEUR_CUISSE;
    genou.add(
      maille(
        fuseau([
          { y: -0.15, rx: 0.09, rz: 0.094 },
          { y: -0.09, rx: 0.108, rz: 0.112 },
          { y: 0.02, rx: 0.099, rz: 0.103 },
        ]),
        mat.pantalon,
      ),
    );
    genou.add(
      maille(
        fuseau([
          { y: -0.19, rx: 0.11, rz: 0.115 },
          { y: -0.12, rx: 0.113, rz: 0.118 },
        ]),
        mat.revers,
      ),
    );
    genou.add(
      maille(
        fuseau([
          { y: -LONGUEUR_TIBIA - 0.02, rx: 0.094, rz: 0.1 },
          { y: -0.18, rx: 0.098, rz: 0.103 },
        ]),
        mat.bottes,
      ),
    );
    const cheville = new THREE.Group();
    cheville.position.y = -LONGUEUR_TIBIA;
    cheville.add(
      maille(
        fuseau([
          { y: -0.08, rx: 0.1, rz: 0.15, dz: 0.05 },
          { y: -0.03, rx: 0.102, rz: 0.153, dz: 0.05 },
          { y: 0.035, rx: 0.094, rz: 0.1, dz: 0.005 },
        ]),
        mat.bottes,
      ),
    );
    // Dans l'ordre de création ci-dessus : pantalon bouffant, revers et tige de la botte ; puis le pied
    const [pantalon, revers, tige] = genou.children;
    const pied = cheville.children[0];
    genou.add(cheville);
    hanche.add(genou);
    bassin.add(hanche);
    return {
      cote,
      hanche,
      genou,
      cheville,
      voletAvant: voletAvant.contenu,
      voletArriere: voletArriere.contenu,
      // Les groupes qui pivotent (animation)
      pivotAvant: voletAvant.volet,
      pivotArriere: voletArriere.volet,
      pantalon,
      revers,
      tige,
      pied,
    };
  }
  const jambeG = creerJambe(1);
  const jambeD = creerJambe(-1);

  // État des animations (valeurs lissées pour éviter tout à-coup)
  let temps = 0;
  let phase = 0;
  let phaseNage = 0;
  let intensite = 0;
  let course = 0;
  let poidsAir = 0;
  let poidsNage = 0;
  // Vitesse verticale et élan (accélération) mesurés d'une image à l'autre
  let yPrecedent: number | null = null;
  let vitessePrecedente = 0;
  let vitesseY = 0;
  let elan = 0;
  let etaitEnAir = false;
  // Amorti de la réception : la cible retombe doucement, la valeur la rejoint vite (pas d'à-coup)
  let amortiCible = 0;
  let amorti = 0;
  // Geste de sort en cours (bras gauche) et son avancement en secondes
  let sortEnCours: NomSort | null = null;
  let tempsDuSort = 0;
  // Escalade : `poidsGrimpe` va de 0 à 1 en douceur
  let poidsGrimpe = 0;

  function mettreAJour(dt: number, pose: PosePersonnage): void {
    const P = CONFIG.personnage;
    objet.position.set(pose.x, pose.y, pose.z);
    objet.rotation.y = pose.orientation;

    temps += dt;
    if (outilTenu) animerTorche(outilTenu, temps);
    intensite = lisser(intensite, borne(pose.vitesse / P.vitesseMarche, 0, 1), 10, dt);
    course = lisser(
      course,
      borne((pose.vitesse - P.vitesseMarche) / (P.vitesseCourse - P.vitesseMarche), 0, 1),
      8,
      dt,
    );
    const enAir = !pose.auSol && !pose.nage;
    poidsAir = lisser(poidsAir, enAir ? 1 : 0, 12, dt);
    poidsNage = lisser(poidsNage, pose.nage ? 1 : 0, 6, dt);
    // Le cycle avance avec la distance réellement parcourue : les pieds ne patinent pas
    const foulee = melange(2.1, 3.1, course);
    phase += (dt * pose.vitesse * Math.PI * 2) / foulee;
    phaseNage += dt * melange(2.4, 5, borne(pose.vitesse / P.vitesseNage, 0, 1));

    if (dt > 0) {
      if (yPrecedent !== null) {
        // Réception : plus la chute était rapide, plus le personnage plie les genoux
        if (etaitEnAir && !enAir && !pose.nage) amortiCible = borne(-vitesseY / 9, 0.25, 1);
        vitesseY = lisser(vitesseY, borne((pose.y - yPrecedent) / dt, -30, 30), 25, dt);
        elan = lisser(elan, borne((pose.vitesse - vitessePrecedente) / dt / 30, -1, 1), 6, dt);
      }
      yPrecedent = pose.y;
      vitessePrecedente = pose.vitesse;
      etaitEnAir = enAir;
    }
    amortiCible = lisser(amortiCible, 0, 5, dt);
    amorti = lisser(amorti, amortiCible, 22, dt);

    const i = intensite;
    const s = Math.sin(phase);
    const c = Math.cos(phase);
    const souffle = Math.sin(temps * 1.7);
    // Lever du pied pendant que la jambe passe vers l'avant (0 à 1, arrondi)
    const lever = (v: number) => {
      const t = 0.5 + 0.5 * v;
      return t * t;
    };

    // Marche et course : jambes et bras opposés, buste et bassin qui se contre-balancent
    const ampJambes = (0.5 + 0.4 * course) * i;
    const ampBras = (0.4 + 0.55 * course) * i;
    const pliGenou = (0.95 + 0.75 * course) * i;
    let cuisseG = -ampJambes * s - 0.12 * course * i;
    let cuisseD = ampJambes * s - 0.12 * course * i;
    let genouG = (0.12 + 0.1 * course) * i + pliGenou * lever(c);
    let genouD = (0.12 + 0.1 * course) * i + pliGenou * lever(-c);
    let epauleG = ampBras * s;
    // Le bras qui porte l'outil balance moins
    let epauleD = -ampBras * s * 0.7;
    let coudeG = -(0.15 + (0.2 + 0.75 * course) * i + 0.25 * i * Math.max(0, -s));
    let coudeD = -(0.2 + (0.2 + 0.6 * course) * i + 0.25 * i * Math.max(0, s));
    let ecartG = 0.1 + 0.012 * souffle * (1 - i);
    let ecartD = ecartG;
    let penche = (0.05 + 0.2 * course) * i + 0.14 * elan;
    let torsion = (0.1 + 0.08 * course) * s * i;
    let lacetBassin = -(0.07 + 0.05 * course) * s * i;
    let roulisBassin = 0.035 * c * i;
    let tangageBassin = 0;
    let lacetTete = 0;
    let tangageTete = 0;
    // Le corps descend quand les jambes sont écartées, et rebondit un peu en course
    let hauteurCorps =
      -HAUTEUR_HANCHE * (1 - Math.cos(ampJambes)) * 0.8 * (0.5 - 0.5 * Math.cos(2 * phase)) +
      0.03 * course * i * (0.5 + 0.5 * Math.cos(2 * phase));
    let pointePieds = 0;

    // Saut : genou levé et bras lancés à la montée, jambes qui s'allongent et bras écartés à la chute
    const a = poidsAir;
    const chute = 0.5 - 0.5 * borne(vitesseY / 5, -1, 1);
    cuisseG = melange(cuisseG, melange(-0.95, -0.35, chute), a);
    genouG = melange(genouG, melange(1.45, 0.55, chute), a);
    cuisseD = melange(cuisseD, melange(0.3, -0.12, chute), a);
    genouD = melange(genouD, melange(0.75, 0.35, chute), a);
    epauleG = melange(epauleG, melange(-1.1, -0.35, chute), a);
    epauleD = melange(epauleD, melange(-0.55, -0.25, chute), a);
    coudeG = melange(coudeG, -0.5, a);
    coudeD = melange(coudeD, -0.5, a);
    ecartG = melange(ecartG, melange(0.3, 0.85, chute), a);
    ecartD = melange(ecartD, melange(0.25, 0.7, chute), a);
    penche = melange(penche, penche * 0.5 + melange(0.1, -0.04, chute), a);
    lacetBassin *= 1 - a;
    roulisBassin *= 1 - a;
    hauteurCorps = melange(hauteurCorps, 0, a);
    pointePieds = melange(pointePieds, 0.4, a);

    // Nage : corps allongé, jambes qui battent, bras en crawl
    const n = poidsNage;
    const sn = Math.sin(phaseNage);
    const cn = Math.cos(phaseNage);
    cuisseG = melange(cuisseG, 0.32 * sn, n);
    cuisseD = melange(cuisseD, -0.32 * sn, n);
    genouG = melange(genouG, 0.25 + 0.2 * cn, n);
    genouD = melange(genouD, 0.25 - 0.2 * cn, n);
    epauleG = melange(epauleG, -1.7 + 1.3 * sn, n);
    epauleD = melange(epauleD, -1.7 - 1.3 * sn, n);
    coudeG = melange(coudeG, -0.2 - 0.55 * Math.max(0, cn), n);
    coudeD = melange(coudeD, -0.2 - 0.55 * Math.max(0, -cn), n);
    ecartG = melange(ecartG, 0.25, n);
    ecartD = melange(ecartD, 0.25, n);
    penche = melange(penche, 1.12, n);
    tangageBassin = melange(tangageBassin, 0.95, n);
    torsion = melange(torsion, 0.16 * sn, n);
    lacetBassin = melange(lacetBassin, -0.06 * sn, n);
    roulisBassin = melange(roulisBassin, 0, n);
    tangageTete = melange(tangageTete, -0.5, n);
    hauteurCorps = melange(hauteurCorps, 0.03 * Math.sin(temps * 2.5), n);
    pointePieds = melange(pointePieds, 0.6, n);

    // Frappe en trois temps : armer (le buste se vrille en arrière, l'outil passe derrière la tête),
    // frapper (tout le corps part avec le bras, les genoux plient), revenir (contrecoup puis repos)
    const frappe = tempsFrappe(pose.progressionFrappe);
    let flexion = 0.55 * amorti;
    if (frappe.poids > 0) {
      const w = frappe.poids;
      const ab = frappe.abattement;
      const choc = frappe.choc;
      epauleD = melange(epauleD, melange(-2.75, -0.85, ab) + 0.14 * choc, w);
      coudeD = melange(coudeD, melange(-1.5, -0.22, ab) - 0.22 * choc, w);
      ecartD = melange(ecartD, melange(0.28, -0.16, ab), w);
      // Le bras gauche fait contrepoids
      epauleG = melange(epauleG, melange(-0.55, 0.55, ab), w);
      coudeG = melange(coudeG, melange(-0.9, -0.4, ab), w);
      torsion += melange(-0.45, 0.4, ab) * w;
      lacetBassin += melange(-0.14, 0.12, ab) * w;
      penche += (melange(-0.15, 0.3, ab) - 0.07 * choc) * w;
      flexion += (0.1 + 0.2 * ab - 0.06 * choc) * w * (1 - a) * (1 - n);
    }

    // Sort : le bras gauche se lève devant (boule de feu) ou se plie vers la poitrine (soin) ;
    // le bras droit et son outil ne changent pas
    if (sortEnCours) {
      tempsDuSort += dt;
      if (tempsDuSort >= dureeGesteSort(sortEnCours)) sortEnCours = null;
    }
    if (sortEnCours) {
      const geste = tempsSort(sortEnCours, tempsDuSort);
      // Boule de feu et barrière : bras levé puis tendu ; soin : main vers la poitrine
      const feu = sortEnCours !== 'soin';
      epauleG = melange(epauleG, feu ? melange(-1.2, -1.5, geste.poussee) : -0.6, geste.poids);
      coudeG = melange(coudeG, feu ? melange(-0.9, -0.15, geste.poussee) : -1.9, geste.poids);
      ecartG = melange(ecartG, 0.05, geste.poids);
    }

    // Bouclier levé : le bras gauche se plie devant le corps
    poidsGarde += ((gardeLevee ? 1 : 0) - poidsGarde) * (1 - Math.exp(-14 * dt));
    if (poidsGarde > 0.002 && !sortEnCours) {
      epauleG = melange(epauleG, -0.95, poidsGarde);
      coudeG = melange(coudeG, -1.25, poidsGarde);
      ecartG = melange(ecartG, 0.3, poidsGarde);
    }

    // Repos : respiration, poids qui passe d'une jambe à l'autre, regard qui se promène
    const repos = (1 - i) * (1 - a) * (1 - n) * (1 - frappe.poids);
    roulisBassin += 0.018 * Math.sin(temps * 0.6) * repos;
    lacetTete += 0.1 * Math.sin(temps * 0.37) * repos;
    tangageTete += 0.03 * Math.sin(temps * 0.53) * repos;

    // Flexion des genoux (réception, frappe) : la cuisse avance, le tibia recule, le corps descend
    cuisseG -= flexion;
    cuisseD -= flexion;
    genouG += 2 * flexion;
    genouD += 2 * flexion;
    hauteurCorps -= (LONGUEUR_CUISSE + LONGUEUR_TIBIA) * (1 - Math.cos(flexion));
    penche += 0.3 * amorti;
    ecartG += 0.22 * amorti;
    ecartD += 0.22 * amorti;

    // Escalade : penché vers la paroi, une jambe pliée puis l'autre, pointes des pieds sur la roche
    poidsGrimpe = lisser(poidsGrimpe, pose.grimpe ? 1 : 0, 10, dt);
    const gr = poidsGrimpe;
    const sg = Math.sin(pose.phaseEscalade ?? 0);
    if (gr > 0.001) {
      cuisseG = melange(cuisseG, -0.75 - 0.5 * sg, gr);
      cuisseD = melange(cuisseD, -0.75 + 0.5 * sg, gr);
      genouG = melange(genouG, 1.15 + 0.6 * sg, gr);
      genouD = melange(genouD, 1.15 - 0.6 * sg, gr);
      penche = melange(penche, 0.16, gr);
      torsion = melange(torsion, 0.12 * sg, gr);
      lacetBassin = melange(lacetBassin, -0.08 * sg, gr);
      roulisBassin = melange(roulisBassin, 0.05 * sg, gr);
      hauteurCorps = melange(hauteurCorps, 0, gr);
      pointePieds = melange(pointePieds, 0.35, gr);
    }

    // Le pied reste à peu près à plat, pointe vers le bas quand la jambe se replie
    const pied = (cuisse: number, genou: number) =>
      melange(borne(-0.75 * (cuisse + genou), -0.6, 0.5), pointePieds, Math.max(a, n, gr));

    jambeG.hanche.rotation.x = cuisseG;
    jambeD.hanche.rotation.x = cuisseD;
    jambeG.genou.rotation.x = genouG;
    jambeD.genou.rotation.x = genouD;
    jambeG.cheville.rotation.x = pied(cuisseG, genouG);
    jambeD.cheville.rotation.x = pied(cuisseD, genouD);
    // Volets du bassin : celui de devant s'ouvre quand la cuisse avance, celui de derrière quand elle recule
    const ouverture = (angle: number) => Math.max(0, angle - VOLETS.marge) * gainVolets;
    jambeG.pivotAvant.rotation.x = ouverture(-cuisseG);
    jambeG.pivotArriere.rotation.x = ouverture(cuisseG);
    jambeD.pivotAvant.rotation.x = ouverture(-cuisseD);
    jambeD.pivotArriere.rotation.x = ouverture(cuisseD);
    // Cape : chassée par la jambe qui part en arrière (ou par l'air du saut), elle retombe ensuite doucement
    const recul = Math.max(0, cuisseG + CAPE.partGenou * genouG, cuisseD + CAPE.partGenou * genouD);
    const cibleCape = Math.min(CAPE.maxi, Math.max(CAPE.parRecul * recul, CAPE.enAir * a));
    angleCape = lisser(angleCape, cibleCape, cibleCape > angleCape ? CAPE.montee : CAPE.retombee, dt);
    cape.volet.rotation.x = angleCape;
    if (armurePortee === 'fourrure' && carquois.visible) poserCarquois(angleCape);
    // Torche : bras droit levé devant soi et un peu écarté, avant-bras presque à l'horizontale, pour que
    // la torche se dresse à hauteur d'épaule (sauf à la nage, où le bras fait sa brasse)
    poidsTorche = lisser(poidsTorche, torcheTenue ? 1 : 0, 8, dt);
    if (poidsTorche > 0.001) {
      const pt = poidsTorche * (1 - n);
      epauleD = melange(epauleD, -0.45, 0.85 * pt);
      coudeD = melange(coudeD, -0.9, 0.9 * pt);
      ecartD = melange(ecartD, 0.32, pt);
    }
    // Arc : en visée, le bras gauche se tend devant soi et le droit se plie pour tirer la corde vers la joue
    poidsVisee = lisser(poidsVisee, arcTenu && viseeArc ? 1 : 0, 12, dt);
    if (arcTenu && outilTenu) tendreArc(outilTenu, tensionArc, flecheArc && viseeArc);
    if (poidsVisee > 0.001) {
      const pv = poidsVisee * (1 - n);
      epauleG = melange(epauleG, -1.5, pv);
      coudeG = melange(coudeG, -0.08, pv);
      ecartG = melange(ecartG, 0.1, pv);
      epauleD = melange(epauleD, -1.45, pv);
      coudeD = melange(coudeD, melange(-1.3, -2.2, tensionArc), pv);
      ecartD = melange(ecartD, 0.22, pv);
    }
    // Escalade : les deux bras levés vers la paroi, l'un plus haut que l'autre à tour de rôle ; l'outil et le bouclier sont rangés
    if (gr > 0.001) {
      epauleG = melange(epauleG, -2.35 + 0.4 * sg, gr);
      epauleD = melange(epauleD, -2.35 - 0.4 * sg, gr);
      coudeG = melange(coudeG, -0.75 - 0.45 * sg, gr);
      coudeD = melange(coudeD, -0.75 + 0.45 * sg, gr);
      ecartG = melange(ecartG, 0.22, gr);
      ecartD = melange(ecartD, 0.22, gr);
    }
    supportOutil.visible = supportArc.visible = supportBouclier.visible = gr < 0.5;
    brasG.epaule.rotation.set(epauleG, 0, ecartG);
    brasD.epaule.rotation.set(epauleD, 0, -ecartD);
    brasG.coude.rotation.x = coudeG;
    brasD.coude.rotation.x = coudeD;
    bassin.rotation.set(tangageBassin, lacetBassin, roulisBassin);
    haut.rotation.set(penche, torsion, -roulisBassin * 0.7);
    tout.position.set(0.012 * c * i * (1 - a), hauteurCorps, 0);
    // Respiration : le torse gonfle, les épaules et la tête montent à peine
    const respiration = souffle * (1 - i * 0.6);
    torse.scale.set(1 + 0.01 * respiration, 1, 1 + 0.03 * respiration);
    brasG.epaule.position.y = EPAULE_Y + 0.006 * respiration;
    brasD.epaule.position.y = EPAULE_Y + 0.006 * respiration;
    tete.position.y = COU_Y + 0.005 * respiration;
    // La tête reste tournée vers l'avant et à peu près droite quand le buste se vrille ou se penche
    tete.rotation.set(tangageTete - penche * 0.6, lacetTete - torsion * 0.75, roulisBassin * 0.4);
  }

  // Armures : pièces accrochées au squelette, construites à la première demande (voir armures.ts)
  const armures = creerArmures({ haut, bassin, basTunique, cape: cape.contenu, ceinture, bras: [brasG, brasD], jambes: [jambeG, jambeD] });
  // Ouverture des volets du bassin selon l'armure portée (voir VOLETS)
  let gainVolets = VOLETS.gain;

  const materiaux: THREE.Material[] = [
    ...Object.values(mat),
    matCheveux,
    ...armures.materiaux,
    ...casques.materiaux,
    ...Object.values(matOutilsParNiveau).flatMap((m) => Object.values(m)),
  ];
  function definirOmbreSeule(ombreSeule: boolean): void {
    corpsCache = ombreSeule;
    montrerFlammes();
    for (const m of materiaux) {
      m.colorWrite = !ombreSeule;
      m.depthWrite = !ombreSeule;
    }
  }

  return {
    objet,
    get phaseMarche() {
      return phase;
    },
    get intensiteMarche() {
      return intensite * (1 - poidsAir) * (1 - poidsNage);
    },
    mettreAJour,
    definirOmbreSeule,
    definirOutil,
    jouerSort(type) {
      sortEnCours = type;
      tempsDuSort = 0;
    },
    definirBouclier,
    definirGarde(leve) {
      gardeLevee = leve;
    },
    definirArc(tension, vise, fleche) {
      tensionArc = borne(tension, 0, 1);
      viseeArc = vise;
      flecheArc = fleche;
    },
    definirCarquois(visible) {
      carquois.visible = visible;
      poserCarquois(armurePortee === 'fourrure' ? angleCape : 0);
    },
    definirArmure(type: TypeArmure | null): void {
      gainVolets = type === 'mailles' ? VOLETS.gainMailles : VOLETS.gain;
      armures.definir(type);
      armurePortee = type;
      poserCarquois(type === 'fourrure' ? angleCape : 0);
    },
    definirCasque: casques.definir,
  };
}

export interface BrasPremierePersonne {
  /** À attacher à la caméra */
  objet: THREE.Group;
  mettreAJour(dt: number, phaseMarche: number, intensiteMarche: number, progressionFrappe: number): void;
  /** Change l'outil tenu (hache par défaut) ou montre la pousse d'arbre ; `niveau` : outil de base ou en fer. */
  definirOutil(type: TypeObjetEnMain, niveau?: NiveauOutil): void;
  /**
   * Lance le geste d'un sort avec la main gauche : flamme dans la paume puis poussée (boule de feu),
   * ou main ramenée vers la poitrine dans une lueur verte (soin). La main droite continue son geste.
   */
  jouerSort(type: NomSort): void;
  /** Écrit dans `cible` la position du creux de la paume gauche dans le monde (départ de la boule de feu). */
  positionPaume(cible: THREE.Vector3): THREE.Vector3;
  /** Bouclier tenu par la main gauche (avec l'épée), ou `null` pour l'enlever. Pendant un sort, la main le lâche et il s'abaisse. */
  definirBouclier(type: TypeBouclier | null): void;
  /** Bouclier levé (parade) : il remonte devant, en bas à gauche de l'écran ; sinon il reste bas, sur le côté. */
  definirGarde(leve: boolean): void;
  /** Charge du coup puissant (0 à 1) : l'épée recule et tremble. */
  definirCharge(charge: number): void;
  /**
   * Arc en main : tension de la corde (0 à 1), visée en cours (l'arc monte de sa pose basse à la pose de tir)
   * et flèche encochée ou non.
   */
  definirArc(tension: number, vise: boolean, fleche: boolean): void;
  /**
   * Escalade : l'outil est rangé et les deux mains vides montent l'une après l'autre sur la paroi. `phase` : avancement
   * du geste en radians (un tour = un cycle des deux mains) ; il suit la distance grimpée, pas le temps.
   */
  definirEscalade(actif: boolean, phase: number): void;
  /** Armure portée : les avant-bras en prennent la manche, et les mains le gant ou le gantelet (ou `null` : chemise claire). */
  definirArmure(type: TypeArmure | null): void;
}

type Triplet = [number, number, number];

/**
 * Tenue d'un outil en 1re personne, dans le repère de la caméra (-z devant, +x à droite, +y en haut) :
 * position de la main droite, direction du manche, direction du tranchant, coudes (hors champ),
 * et, quand la main gauche est libre, sa position et la direction vers laquelle sa paume est tournée
 * (vers le centre de l'écran : les doigts se replient vers l'intérieur, pouce au-dessus).
 */
interface Tenue {
  main: Triplet;
  manche: Triplet;
  tranchant: Triplet;
  /** Rotation de l'outil autour de son manche (radians), appliquée après `tranchant` : un roulis positif
   * ou négatif selon l'outil tourne le tranchant vers l'avant, pour le voir de trois quarts arrière plutôt que de profil */
  roulis?: number;
  coudeD: Triplet;
  coudeG: Triplet;
  mainLibre: Triplet;
  paumeLibre: Triplet;
}

const TENUE_DEUX_MAINS: Tenue = {
  main: [0.18, -0.1, -0.64],
  manche: [0.66, 0.58, -0.3],
  tranchant: [0.55, -0.8, 0.1],
  coudeD: [0.6, -0.56, -0.2],
  coudeG: [-0.34, -0.62, -0.25],
  mainLibre: [0, 0, 0],
  paumeLibre: [1, 0, 0],
};

const TENUES: Record<TypeObjetEnMain, Tenue> = {
  // Hache : manche plus redressé, tranchant tourné vers le centre de l'écran (à gauche et un peu
  // vers l'avant), là où elle s'abat ; la joue du fer reste visible
  hache: {
    ...TENUE_DEUX_MAINS,
    main: [0.24, -0.11, -0.63],
    manche: [0.45, 0.8, -0.3],
    tranchant: [-0.9, 0.2, -0.45],
    roulis: 0.52,
  },
  // Pioche : tenue comme la hache, manche redressé ; une pointe part vers l'avant et vers le centre de l'écran
  // (là où elle frappe), l'autre revient vers soi. Avec le manche penché de la tenue à deux mains, la tête se
  // voyait de profil ou de bout, sans pointe devant.
  pioche: {
    ...TENUE_DEUX_MAINS,
    main: [0.24, -0.11, -0.63],
    manche: [0.45, 0.8, -0.3],
    tranchant: [-0.9, 0.2, -0.45],
    roulis: 0.52,
  },
  epee: {
    main: [0.4, -0.19, -0.66],
    manche: [0.37, 0.85, -0.52],
    tranchant: [1, 0, 0.3],
    // Lame tournée (poignet ouvert vers l'extérieur) : le fil gauche part vers l'avant, dans le sens du coup ; un peu du plat reste visible
    roulis: 1.0,
    coudeD: [0.7, -0.6, -0.14],
    coudeG: [-0.62, -0.5, -0.1],
    mainLibre: [-0.32, -0.16, -0.5],
    paumeLibre: [0.85, -0.25, 0.45],
  },
  // Pousse d'arbre : tenue devant soi, tige presque droite
  pousse: {
    main: [0.27, -0.1, -0.6],
    manche: [0.16, 0.95, 0.1],
    tranchant: [0.5, 0, 0.85],
    coudeD: [0.78, -0.58, -0.05],
    coudeG: [-0.62, -0.5, -0.1],
    mainLibre: [-0.34, -0.2, -0.5],
    paumeLibre: [0.85, -0.25, 0.45],
  },
  // Piège à poser : tenu comme la pousse d'arbre
  piege: {
    main: [0.27, -0.1, -0.6],
    manche: [0.16, 0.95, 0.1],
    tranchant: [0.5, 0, 0.85],
    coudeD: [0.78, -0.58, -0.05],
    coudeG: [-0.62, -0.5, -0.1],
    mainLibre: [-0.34, -0.2, -0.5],
    paumeLibre: [0.85, -0.25, 0.45],
  },
  // Arc : valeurs de la pose de visée ; l'arc a sa propre tenue (voir POSES_ARC), ces champs ne servent que de repli
  arc: {
    main: [-0.0505, -0.1734, -0.8075],
    manche: [-0.11, 1, 0],
    tranchant: [0.0542, 0.1807, -0.9821],
    coudeD: [0.42, -0.5, 0],
    coudeG: [-0.34, -0.62, -0.3],
    mainLibre: [0, 0, 0],
    paumeLibre: [1, 0, 0],
  },
  // Torche : levée à droite, un peu écartée et penchée vers l'avant, la flamme sous le milieu de l'écran
  torche: {
    main: [0.43, -0.38, -0.8],
    manche: [0.12, 0.97, -0.18],
    tranchant: [0.8, 0, 0.6],
    coudeD: [0.78, -0.7, -0.1],
    coudeG: [-0.62, -0.5, -0.1],
    mainLibre: [-0.34, -0.2, -0.5],
    paumeLibre: [0.85, -0.25, 0.45],
  },
};

/** Pose de la main gauche pendant un sort (repère de la caméra) : main, coude et direction de la paume. */
interface PoseSort {
  main: THREE.Vector3;
  coude: THREE.Vector3;
  paume: THREE.Vector3;
}
const pose = (main: Triplet, coude: Triplet, paume: Triplet): PoseSort => ({
  main: new THREE.Vector3(...main),
  coude: new THREE.Vector3(...coude),
  paume: new THREE.Vector3(...paume),
});
// Boule de feu : main levée devant, paume ouverte vers le haut (la flamme s'y forme)...
const POSE_FLAMME = pose([-0.2, -0.17, -0.52], [-0.45, -0.44, 0], [0.1, 1, 0.3]);
// ... puis bras tendu, doigts vers le haut, paume poussée vers l'avant
const POSE_POUSSEE = pose([-0.17, -0.12, -0.8], [-0.32, -0.62, -0.42], [0, 0.15, -1]);
// Soin : main ramenée devant la poitrine, doigts vers la droite, paume tournée vers soi
const POSE_SOIN = pose([-0.08, -0.16, -0.46], [-0.6, -0.5, -0.16], [0.1, -0.2, 1]);
// Bouclier en 1re personne (repère de la caméra) : centre, direction de la face avant, direction du haut, coude gauche.
// Au repos : bas et sur le côté gauche, pour ne pas gêner la vue. Levé : devant, il couvre le bas-gauche de
// l'écran sans boucher le centre (on voit son dos, la poignée et la main).
const POSES_BOUCLIER: Record<'repos' | 'leve', { centre: Triplet; normale: Triplet; haut: Triplet; coude: Triplet }> = {
  repos: { centre: [-0.5, -0.5, -0.6], normale: [-0.75, 0.05, -0.66], haut: [0.1, 1, 0], coude: [-0.7, -0.95, -0.12] },
  leve: { centre: [-0.27, -0.31, -0.52], normale: [-0.12, 0.12, -1], haut: [-0.12, 1, 0.1], coude: [-0.66, -0.82, -0.08] },
};
// Arc en 1re personne (repère de la caméra) : position de la poignée (main gauche), direction de l'arc (de bas en haut),
// direction de la flèche, coudes gauche et droit. Au repos : tenu bas, presque couché, flèche encochée.
// En visée, la flèche doit sembler partir « à midi », droit sur le viseur. Elle est donc placée dans un plan qui passe
// par l'œil et l'axe du regard : à l'écran, elle monte du bas de l'image (un peu à gauche du milieu) vers le viseur,
// et sa pointe s'arrête juste dessous. Corde tendue, l'encoche est en (-0,06 ; -0,2 ; -0,375) et la pointe en
// (-0,0255 ; -0,085 ; -1) : les deux ont le même rapport x/y, c'est ce qui aligne la flèche sur le centre. `main` s'en
// déduit (l'encoche tendue est à 0,43 m derrière la poignée, la flèche à 5 cm au-dessus et 2 cm à droite). L'arc est
// presque vertical (6° vers la gauche) : sa branche passe à gauche du viseur sans le cacher.
interface PoseArc {
  main: Triplet;
  arc: Triplet;
  cible: Triplet;
  coudeG: Triplet;
  coudeD: Triplet;
}
const POSES_ARC: Record<'repos' | 'vise', PoseArc> = {
  repos: { main: [-0.16, -0.33, -0.66], arc: [0.75, 0.45, -0.45], cible: [-0.35, 0.25, -0.9], coudeG: [-0.6, -0.95, -0.25], coudeD: [0.35, -0.95, -0.15] },
  vise: { main: [-0.0505, -0.1734, -0.8075], arc: [-0.11, 1, 0], cible: [0.0542, 0.1807, -0.9821], coudeG: [-0.34, -0.62, -0.3], coudeD: [0.42, -0.5, 0] },
};
// Creux de la paume dans le repère de la main ouverte (là où se forment la flamme et la lueur)
const CREUX_PAUME = new THREE.Vector3(0, 0.085, 0.07);

// Point autour duquel l'outil tourne pendant la frappe (à peu près l'épaule droite)
const PIVOT_FRAPPE = new THREE.Vector3(0.3, -0.45, -0.05);
// Distance entre le centre du poing et le poignet
const RECUL_POIGNET = 0.07;
// Flexion du poignet de la main ouverte, vers la paume (radians)
const FLEXION_POIGNET = 0.22;
// Escalade en 1re personne (repère de la caméra). Chaque main tient sa prise pendant `partPrise` du cycle : elle descend
// alors dans l'image, de `haut` à `bas`, parce que le corps monte ; puis elle lâche, se décolle de la roche (`decolle`,
// vers soi) et remonte chercher la prise suivante. Positions du poignet droit (x inversé pour la gauche).
// La main est à plat sur la roche, dos vers l'œil, quelle que soit la pente de l'avant-bras : celui-ci monte en
// diagonale depuis le coin bas de l'écran (`coudeHaut` : bras tendu vers la prise, il tire ; `coudeBas` : coude sorti
// sur le côté, il pousse). `doigts*` : direction des doigts (en haut, un peu vers le centre ; la main qui pousse
// tourne vers l'extérieur) ; `paume` : direction de la paume, vers la paroi.
const ESCALADE = {
  partPrise: 0.62,
  haut: [0.3, 0.1, -0.57] as Triplet,
  bas: [0.35, -0.21, -0.53] as Triplet,
  decolle: [0.02, 0.04, 0.09] as Triplet,
  coudeHaut: [0.6, -0.86, -0.06] as Triplet,
  coudeBas: [0.82, -0.7, 0.02] as Triplet,
  doigtsHaut: [-0.3, 1, -0.3] as Triplet,
  doigtsBas: [-0.05, 1, -0.22] as Triplet,
  paume: [0, -0.1, -1] as Triplet,
  // Écart des doigts (radians entre l'index et l'auriculaire, répartis en éventail), main posée puis main en l'air
  ecartPrise: 0.6,
  ecartLeve: 0.7,
  // Descente de tout l'ensemble (outil rangé, puis mains qui arrivent d'en bas), en mètres
  rangement: 0.9,
};
// Pouce de la main ouverte au repos (rotation x vers la paume, z vers le côté ; z change de signe avec la main)
const POUCE_REPOS = { x: 0.6, z: -0.7 };

/**
 * Valeur lente et irrégulière entre -1 et 1 environ : trois sinus de fréquences sans rapport simple, décalés par `graine`.
 * Le mouvement ne se répète pas de façon visible (pas de va-et-vient régulier comme une respiration).
 */
function fremir(t: number, graine: number): number {
  return (
    0.55 * Math.sin(t * 0.73 + graine) + 0.3 * Math.sin(t * 1.61 + graine * 2.3) + 0.15 * Math.sin(t * 3.07 + graine * 4.1)
  );
}

/** Bras et outil vus en 1re personne. Repère de la caméra : -z devant, +x à droite, +y en haut. */
export function creerBrasPremierePersonne(): BrasPremierePersonne {
  const mat = creerMateriaux();
  const matOutilsParNiveau = creerMateriauxParNiveau();
  const matOutils = matOutilsParNiveau.base;
  // Aucune lumière propre : les bras et l'outil ne sont éclairés que par la scène, pour s'assombrir
  // avec elle la nuit (y compris le métal des outils en fer, légèrement lumineux ailleurs)
  for (const m of [...Object.values(mat), ...Object.values(matOutilsParNiveau).flatMap((m) => Object.values(m))]) {
    m.emissive.setHex(0x000000);
  }
  const objet = new THREE.Group();
  // `porte` est le repère de l'outil : les poings y sont accrochés, le long du manche
  const porte = new THREE.Group();
  objet.add(porte);
  const supportOutil = new THREE.Group();
  porte.add(supportOutil);

  // Poing fermé autour du manche (le long de y) : dos de la main en -z, doigts enroulés en +z.
  // `cote` : +1 main droite, -1 main gauche (le pouce change de côté).
  function creerPoing(cote: number): THREE.Group {
    const poing = new THREE.Group();
    // Dos de la main et paume, derrière le manche
    poing.add(
      maille(
        fuseau([
          { y: -0.057, rx: 0.039, rz: 0.025, dz: -0.04 },
          { y: -0.032, rx: 0.047, rz: 0.031, dz: -0.043 },
          { y: 0.044, rx: 0.05, rz: 0.033, dz: -0.043 },
          { y: 0.059, rx: 0.043, rz: 0.027, dz: -0.04 },
        ]),
        mat.peau,
      ),
    );
    // Quatre doigts enroulés autour du manche, du petit doigt (en bas) à l'index : des anneaux
    // à pans coupés, séparés par un pli
    const tailles = [0.88, 0.97, 1, 0.95];
    for (let k = 0; k < 4; k++) {
      const t = tailles[k];
      poing.add(
        maille(
          fuseau([
            { y: -0.0115, rx: 0.043 * t, rz: 0.032 * t, c: 0.013, dz: 0.012 },
            { y: -0.006, rx: 0.049 * t, rz: 0.038 * t, c: 0.015, dz: 0.015 },
            { y: 0.006, rx: 0.049 * t, rz: 0.038 * t, c: 0.015, dz: 0.015 },
            { y: 0.0115, rx: 0.043 * t, rz: 0.032 * t, c: 0.013, dz: 0.012 },
          ]),
          mat.peau,
          0,
          -0.0375 + k * 0.025,
          0,
        ),
      );
    }
    // Pouce : part de la paume et se couche en biais par-dessus l'index
    const pouce = maille(
      fuseau([
        { y: -0.012, rx: 0.02, rz: 0.019 },
        { y: 0.03, rx: 0.019, rz: 0.018 },
        { y: 0.068, rx: 0.016, rz: 0.015 },
        { y: 0.082, rx: 0.01, rz: 0.01 },
      ]),
      mat.peau,
      -0.05 * cote,
      0.032,
      -0.012,
    );
    pouce.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0.66 * cote, 0.42, 0.62).normalize());
    poing.add(pouce);
    return poing;
  }
  const poingD = creerPoing(1);
  const poingG = creerPoing(-1);
  porte.add(poingD, poingG);

  // Avant-bras : l'origine est au poignet, la manche claire part vers le coude (-y) en s'évasant,
  // avec quelques plis et un revers au poignet
  function creerAvantBras(): THREE.Group {
    const avantBras = new THREE.Group();
    avantBras.add(
      maille(
        fuseau([
          { y: -0.04, rx: 0.035, rz: 0.04 },
          { y: 0.038, rx: 0.034, rz: 0.038 },
        ]),
        mat.peau,
      ),
    );
    avantBras.add(
      maille(
        fuseau([
          { y: -0.074, rx: 0.06, rz: 0.062 },
          { y: -0.066, rx: 0.066, rz: 0.068 },
          { y: -0.03, rx: 0.064, rz: 0.066 },
          { y: -0.022, rx: 0.056, rz: 0.058 },
        ]),
        mat.poignet,
      ),
    );
    avantBras.add(
      maille(
        fuseau([
          { y: -0.66, rx: 0.128, rz: 0.124 },
          { y: -0.44, rx: 0.106, rz: 0.1, dx: 0.006, dz: -0.01 },
          { y: -0.23, rx: 0.08, rz: 0.084, dx: -0.006, dz: 0.008 },
          { y: -0.068, rx: 0.058, rz: 0.06 },
        ]),
        mat.chemise,
      ),
    );
    objet.add(avantBras);
    return avantBras;
  }
  const avantBrasD = creerAvantBras();
  const avantBrasG = creerAvantBras();
  // Manches d'armure (voir armures.ts) : dans l'ordre de création ci-dessus, le poignet, le revers puis la manche
  const manches = creerManchesArmure(
    [avantBrasD, avantBrasG].map((avantBras) => ({ avantBras, revers: avantBras.children[1], manche: avantBras.children[2] })),
    mat.peau,
  );

  // Main ouverte, doigts à demi repliés. Repère : les doigts partent le long de +y, la paume regarde +z.
  // `cote` : -1 main gauche (l'index et le pouce sont du côté -x : paume vers soi et doigts en haut, le pouce
  // est à gauche), +1 main droite (la même, en miroir).
  type Doigt = { base: THREE.Group; bout: THREE.Group };
  function creerMainOuverte(cote: number): { main: THREE.Group; doigts: Doigt[]; pouce: THREE.Mesh } {
    const main = new THREE.Group();
    // Poignet un peu fléchi vers la paume
    main.rotation.x = FLEXION_POIGNET;
    main.add(
      maille(
        fuseau([
          { y: 0.025, rx: 0.04, rz: 0.022 },
          { y: 0.06, rx: 0.05, rz: 0.025, dz: 0.004 },
          { y: 0.12, rx: 0.052, rz: 0.022, dz: 0.006 },
        ]),
        mat.peau,
      ),
    );
    const doigts: Doigt[] = [];
    for (let k = 0; k < 4; k++) {
      // Deux phalanges par doigt : la seconde se replie davantage vers la paume
      const longueur = 0.05 - 0.007 * Math.abs(k - 1.4);
      const doigt = new THREE.Group();
      doigt.position.set((0.039 - k * 0.026) * cote, 0.118, 0.006);
      doigt.rotation.x = 0.5 + 0.09 * k;
      doigt.add(
        maille(
          fuseau([
            { y: -0.004, rx: 0.0125, rz: 0.013 },
            { y: longueur, rx: 0.0115, rz: 0.012 },
          ]),
          mat.peau,
        ),
      );
      const bout = new THREE.Group();
      bout.position.y = longueur;
      bout.rotation.x = 0.75;
      bout.add(
        maille(
          fuseau([
            { y: -0.004, rx: 0.0115, rz: 0.012 },
            { y: longueur * 0.85, rx: 0.009, rz: 0.009 },
          ]),
          mat.peau,
        ),
      );
      doigt.add(bout);
      main.add(doigt);
      doigts.push({ base: doigt, bout });
    }
    const pouce = maille(
      fuseau([
        { y: -0.01, rx: 0.019, rz: 0.018 },
        { y: 0.04, rx: 0.016, rz: 0.015 },
        { y: 0.075, rx: 0.01, rz: 0.01 },
      ]),
      mat.peau,
      0.048 * cote,
      0.05,
      0.012,
    );
    pouce.rotation.set(POUCE_REPOS.x, 0, POUCE_REPOS.z * cote);
    main.add(pouce);
    return { main, doigts, pouce };
  }
  // Main gauche : libre quand l'outil se tient à une main, et pour les sorts
  const { main: mainOuverte, doigts, pouce: pouceG } = creerMainOuverte(-1);
  avantBrasG.add(mainOuverte);
  // Main droite ouverte : seulement pour l'escalade (le reste du temps, elle tient l'outil, poing fermé)
  const { main: mainOuverteD, doigts: doigtsD, pouce: pouceD } = creerMainOuverte(1);
  mainOuverteD.visible = false;
  avantBrasD.add(mainOuverteD);

  // Flamme et lueur des sorts, au creux de la paume gauche (replacées à chaque image)
  const effetMain = creerEffetMain();
  objet.add(effetMain.objet);

  // Bouclier : tenu par un poing gauche fermé sur sa poignée. Deux poses (repère de la caméra) : au repos, bas
  // et sur le côté gauche, face tournée vers l'extérieur ; levé, devant, en bas à gauche de l'écran.
  const supportBouclier = new THREE.Group();
  supportBouclier.visible = false;
  objet.add(supportBouclier);
  const poingBouclier = creerPoing(-1);
  poingBouclier.position.set(0, 0, PRISE_BOUCLIER_Z);
  supportBouclier.add(poingBouclier);
  const boucliers = new Map<TypeBouclier, THREE.Group>();
  let bouclierTenu: THREE.Group | null = null;
  let gardeLevee = false;
  let poidsGarde = 0;
  // Charge du coup puissant : valeur voulue, et valeur montrée (elle retombe en douceur quand le coup part)
  let chargeVoulue = 0;
  let charge = 0;
  // Arc : tenu ou non, tension de la corde, visée en cours et son poids (0 = pose basse, 1 = pose de tir), flèche encochée
  let arcTenu = false;
  let tensionArc = 0;
  let viseeArc = false;
  let flecheArc = true;
  let poidsVisee = 0;
  const poseArc = (p: PoseArc) => {
    // La direction de la flèche est exacte ; celle de l'arc est redressée pour lui être perpendiculaire
    const x = new THREE.Vector3(...p.cible).normalize();
    const y = new THREE.Vector3(...p.arc);
    y.addScaledVector(x, -y.dot(x)).normalize();
    return {
      position: new THREE.Vector3(...p.main),
      orientation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, new THREE.Vector3().crossVectors(x, y))),
      coudeG: p.coudeG,
      coudeD: p.coudeD,
    };
  };
  const ARC_REPOS = poseArc(POSES_ARC.repos);
  const ARC_VISE = poseArc(POSES_ARC.vise);
  const coudeArcG: Triplet = [0, 0, 0];
  const coudeArcD: Triplet = [0, 0, 0];
  const poseBouclier = (centre: Triplet, normale: Triplet, haut: Triplet, coudePose: Triplet) => {
    const z = new THREE.Vector3(...normale).normalize();
    const y = new THREE.Vector3(...haut);
    y.addScaledVector(z, -y.dot(z)).normalize();
    const x = new THREE.Vector3().crossVectors(y, z);
    return {
      centre: new THREE.Vector3(...centre),
      orientation: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)),
      coude: new THREE.Vector3(...coudePose),
    };
  };
  const BOUCLIER_REPOS = poseBouclier(POSES_BOUCLIER.repos.centre, POSES_BOUCLIER.repos.normale, POSES_BOUCLIER.repos.haut, POSES_BOUCLIER.repos.coude);
  const BOUCLIER_LEVE = poseBouclier(POSES_BOUCLIER.leve.centre, POSES_BOUCLIER.leve.normale, POSES_BOUCLIER.leve.haut, POSES_BOUCLIER.leve.coude);

  function definirBouclier(type: TypeBouclier | null): void {
    if (bouclierTenu) supportBouclier.remove(bouclierTenu);
    bouclierTenu = null;
    if (!type) return;
    let bouclier = boucliers.get(type);
    if (!bouclier) {
      bouclier = creerBouclier(type, matOutils);
      // L'écu, plus haut que le bouclier rond, est un peu réduit pour ne pas boucher la vue
      if (type === 'renforce') bouclier.scale.setScalar(0.82);
      bouclier.traverse((o) => {
        o.castShadow = false;
      });
      boucliers.set(type, bouclier);
    }
    supportBouclier.add(bouclier);
    bouclierTenu = bouclier;
  }

  let tenue = TENUES[OUTIL_PAR_DEFAUT];
  let outilTenu: THREE.Group | null = null;
  let deuxMains = true;
  const reposPosition = new THREE.Vector3();
  const reposOrientation = new THREE.Quaternion();
  const outils = new Map<string, THREE.Group>();

  function definirOutil(type: TypeObjetEnMain, niveau: NiveauOutil = 'base'): void {
    const cle = `${type}:${niveau}`;
    let outil = outils.get(cle);
    if (!outil) {
      outil = creerOutil(type, matOutilsParNiveau[niveau]);
      // Les bras ne projettent pas d'ombre (c'est le corps, invisible, qui la projette)
      outil.traverse((o) => {
        o.castShadow = false;
      });
      outils.set(cle, outil);
    }
    supportOutil.clear();
    supportOutil.add(outil);
    outilTenu = outil;
    tenue = TENUES[type];
    deuxMains = PRISES[type].deuxMains;
    poingG.visible = deuxMains;
    poingG.position.set(0, -PRISES[type].ecartMains, 0);
    arcTenu = type === 'arc';
    mainOuverte.visible = !deuxMains;
    // Repère de l'outil au repos : y le long du manche, x vers le tranchant
    const y = new THREE.Vector3(...tenue.manche).normalize();
    const x = new THREE.Vector3(...tenue.tranchant);
    x.addScaledVector(y, -x.dot(y)).normalize();
    let z = new THREE.Vector3().crossVectors(x, y);
    if (tenue.roulis) {
      // Tourne le tranchant autour du manche (x vers z)
      x.multiplyScalar(Math.cos(tenue.roulis)).addScaledVector(z, Math.sin(tenue.roulis));
      z = new THREE.Vector3().crossVectors(x, y);
    }
    reposOrientation.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
    reposPosition.set(...tenue.main);
  }

  objet.traverse((o) => {
    o.castShadow = false;
  });
  definirOutil(OUTIL_PAR_DEFAUT);

  let temps = 0;
  // Geste de sort en cours (main gauche) et son avancement en secondes
  let sortEnCours: NomSort | null = null;
  let tempsDuSort = 0;
  // Escalade : demandée ou non, avancement du geste des mains (radians), et poids de la transition
  // (0 : outil en main ; 0,5 : tout est hors de l'image ; 1 : mains sur la paroi)
  let escalade = false;
  let phaseEscalade = 0;
  let poidsEscalade = 0;
  // Vrai tant que les mains ont leur pose d'escalade (doigts en éventail, pouce écarté) : à défaire en sortant
  let mainsEnPrise = false;
  // Objets de calcul réutilisés à chaque image
  const geste = new THREE.Quaternion();
  const demiGeste = new THREE.Quaternion();
  const sansGeste = new THREE.Quaternion();
  const inverse = new THREE.Quaternion();
  const angles = new THREE.Euler();
  const coude = new THREE.Vector3();
  const main = new THREE.Vector3();
  const versCoude = new THREE.Vector3();
  const local = new THREE.Vector3();
  const axeMain = new THREE.Vector3();
  const axePaume = new THREE.Vector3();
  const axeCote = new THREE.Vector3();
  const axeDoigts = new THREE.Vector3();
  const orientationMain = new THREE.Quaternion();
  const base = new THREE.Matrix4();
  const cibleSort = new THREE.Vector3();
  const VERS_LE_BAS = new THREE.Vector3(0, -1, 0);

  /** Place un avant-bras entre un poing (repère de `objet`, dans `main`) et son coude, et tourne le poing vers lui. */
  function placerBras(avantBras: THREE.Group, poing: THREE.Group, coudeRepos: Triplet): void {
    coude.set(...coudeRepos).sub(PIVOT_FRAPPE).applyQuaternion(demiGeste).add(PIVOT_FRAPPE);
    versCoude.copy(coude).sub(main).normalize();
    avantBras.position.copy(main).addScaledVector(versCoude, RECUL_POIGNET);
    avantBras.quaternion.setFromUnitVectors(VERS_LE_BAS, versCoude);
    // Le dos de la main (-z du poing) regarde vers le coude
    local.copy(versCoude).applyQuaternion(inverse);
    poing.rotation.y = Math.atan2(-local.x, -local.z);
  }

  /**
   * Escalade : place une main ouverte sur la paroi et son avant-bras. `cote` : +1 droite, -1 gauche ; les deux mains
   * sont décalées d'un demi-cycle, si bien qu'il y en a toujours une qui tient.
   */
  function placerMainEscalade(avantBras: THREE.Group, mainLibre: THREE.Group, doigtsMain: Doigt[], pouce: THREE.Mesh, cote: number): void {
    const E = ESCALADE;
    const tours = phaseEscalade / (2 * Math.PI) + (cote > 0 ? 0.5 : 0);
    const u = tours - Math.floor(tours);
    // `hauteur` : 1 en haut, 0 en bas ; `leve` : 0 main sur la roche, 1 au milieu du geste vers la prise suivante
    let hauteur: number;
    let leve = 0;
    if (u < E.partPrise) {
      hauteur = 1 - u / E.partPrise;
    } else {
      const t = (u - E.partPrise) / (1 - E.partPrise);
      hauteur = rampe(t, 0, 1);
      leve = Math.sin(Math.PI * t);
    }
    main.set(
      cote * (melange(E.bas[0], E.haut[0], hauteur) + E.decolle[0] * leve),
      melange(E.bas[1], E.haut[1], hauteur) + E.decolle[1] * leve,
      melange(E.bas[2], E.haut[2], hauteur) + E.decolle[2] * leve,
    );
    // En haut, le bras est tendu vers la prise (il tire) ; en bas, le coude sort sur le côté (il pousse)
    coude.set(
      cote * melange(E.coudeBas[0], E.coudeHaut[0], hauteur),
      melange(E.coudeBas[1], E.coudeHaut[1], hauteur),
      melange(E.coudeBas[2], E.coudeHaut[2], hauteur),
    );
    axeMain.copy(main).sub(coude).normalize();
    // La main à plat sur la roche, dos vers l'œil : son orientation ne dépend pas de l'avant-bras (le poignet casse).
    // En l'air, elle se redresse un peu vers l'avant-bras.
    axeDoigts
      .set(cote * melange(E.doigtsBas[0], E.doigtsHaut[0], hauteur), melange(E.doigtsBas[1], E.doigtsHaut[1], hauteur), melange(E.doigtsBas[2], E.doigtsHaut[2], hauteur))
      .normalize()
      .lerp(axeMain, 0.3 * leve)
      .normalize();
    axePaume.set(cote * E.paume[0], E.paume[1], E.paume[2]);
    axePaume.addScaledVector(axeDoigts, -axePaume.dot(axeDoigts)).normalize();
    axeCote.crossVectors(axeDoigts, axePaume);
    orientationMain.setFromRotationMatrix(base.makeBasis(axeCote, axeDoigts, axePaume));
    // L'avant-bras : du coude au poignet, tourné sur lui-même pour suivre la paume
    axePaume.addScaledVector(axeMain, -axePaume.dot(axeMain)).normalize();
    axeCote.crossVectors(axeMain, axePaume);
    avantBras.position.copy(main);
    avantBras.quaternion.setFromRotationMatrix(base.makeBasis(axeCote, axeMain, axePaume));
    mainLibre.quaternion.copy(avantBras.quaternion).invert().multiply(orientationMain);
    // Doigts écartés en éventail. Sur la prise, les premières phalanges restent à plat et les bouts se replient sur
    // le bord : très crochetés en haut (la main tire), plus à plat en bas (elle pousse). En l'air, la main s'ouvre.
    const ecart = melange(E.ecartPrise, E.ecartLeve, leve);
    const crochet = melange(0.8, 1.25, hauteur);
    for (let k = 0; k < doigtsMain.length; k++) {
      doigtsMain[k].base.rotation.x = melange(0.2 + 0.04 * k, 0.1, leve);
      doigtsMain[k].base.rotation.z = (-cote * ecart * (1.5 - k)) / 3;
      doigtsMain[k].bout.rotation.x = melange(crochet, 0.3, leve);
    }
    // Pouce écarté, presque à plat
    pouce.rotation.set(melange(0.3, 0.15, leve), 0, -cote * melange(0.85, 1.1, leve));
  }

  /** Rend aux deux mains ouvertes leur forme ordinaire après l'escalade (doigts serrés, pouce au repos, poignet droit). */
  function quitterPoseEscalade(): void {
    for (const [mainLibre, doigtsMain, pouce, cote] of [[mainOuverte, doigts, pouceG, -1], [mainOuverteD, doigtsD, pouceD, 1]] as const) {
      mainLibre.rotation.set(FLEXION_POIGNET, 0, 0);
      for (const d of doigtsMain) d.base.rotation.z = 0;
      pouce.rotation.set(POUCE_REPOS.x, 0, POUCE_REPOS.z * cote);
    }
  }

  /**
   * Place l'avant-bras gauche, main ouverte en `main`. Pendant un sort, la main, le coude et la
   * paume glissent de la tenue de l'outil vers la pose du sort, et les doigts s'ouvrent.
   */
  function placerMainLibre(sort: TempsSort): void {
    coude.set(...tenue.coudeG).sub(PIVOT_FRAPPE).applyQuaternion(demiGeste).add(PIVOT_FRAPPE);
    axePaume.set(...tenue.paumeLibre).applyQuaternion(demiGeste);
    if (sort.poids > 0) {
      // Boule de feu et barrière : main levée puis paume poussée vers l'avant ; soin : main vers la poitrine
      const feu = sortEnCours !== 'soin';
      main.lerp(feu ? cibleSort.lerpVectors(POSE_FLAMME.main, POSE_POUSSEE.main, sort.poussee) : POSE_SOIN.main, sort.poids);
      coude.lerp(feu ? cibleSort.lerpVectors(POSE_FLAMME.coude, POSE_POUSSEE.coude, sort.poussee) : POSE_SOIN.coude, sort.poids);
      axePaume.lerp(feu ? cibleSort.lerpVectors(POSE_FLAMME.paume, POSE_POUSSEE.paume, sort.poussee) : POSE_SOIN.paume, sort.poids);
    }
    versCoude.copy(coude).sub(main).normalize();
    avantBrasG.position.copy(main);
    // L'avant-bras est tourné sur lui-même pour que la paume (+z de la main) regarde la direction
    // voulue, au lieu de prendre la rotation la plus courte
    axeMain.copy(versCoude).negate();
    axePaume.addScaledVector(axeMain, -axePaume.dot(axeMain)).normalize();
    axeCote.crossVectors(axeMain, axePaume);
    avantBrasG.quaternion.setFromRotationMatrix(base.makeBasis(axeCote, axeMain, axePaume));
    // Doigts à demi repliés au repos, presque tendus pendant le sort (paume ouverte). Au repos, chaque doigt
    // bouge un peu de son côté, et de temps en temps la main se referme un peu plus avant de se rouvrir
    const calme = 1 - sort.poids;
    const M = CONFIG.personnage.microMouvements;
    const repli = M.repli * Math.max(0, (fremir(temps * 0.31, 9.1) - 0.4) / 0.6) * calme;
    for (let k = 0; k < doigts.length; k++) {
      const jeu = M.doigts * fremir(temps * 1.05, 1.7 * k + 0.4) * calme;
      doigts[k].base.rotation.x = melange(0.5 + 0.09 * k, 0.1 + 0.03 * k, sort.poids) + jeu + repli * (0.7 + 0.15 * k);
      doigts[k].bout.rotation.x = melange(0.75, 0.18, sort.poids) + 0.8 * jeu + repli * 0.8;
    }
    // Le poignet bouge à peine
    mainOuverte.rotation.x = FLEXION_POIGNET + M.poignet * fremir(temps * 0.83, 3.3) * calme;
    mainOuverte.rotation.z = 0.6 * M.poignet * fremir(temps * 0.67, 5.9) * calme;
    // La flamme et la lueur suivent le creux de la paume
    effetMain.objet.position
      .copy(CREUX_PAUME)
      .applyQuaternion(mainOuverte.quaternion)
      .applyQuaternion(avantBrasG.quaternion)
      .add(avantBrasG.position);
  }

  function mettreAJour(dt: number, phaseMarche: number, intensiteMarche: number, progressionFrappe: number): void {
    temps += dt;
    if (outilTenu) animerTorche(outilTenu, temps);
    mainOuverte.rotation.z = 0;
    // Balancement à la marche et respiration
    const souffle = Math.sin(temps * 1.7);
    objet.position.set(
      Math.cos(phaseMarche) * 0.014 * intensiteMarche,
      -Math.abs(Math.sin(phaseMarche)) * 0.018 * intensiteMarche + souffle * 0.004,
      0,
    );
    objet.rotation.z = Math.cos(phaseMarche) * 0.012 * intensiteMarche;

    // Escalade : l'outil descend hors de l'image (première moitié), puis les deux mains vides montent d'en bas
    // (seconde moitié) ; en haut de la paroi, l'inverse
    const pasRangement = dt / CONFIG.personnage.escalade.dureeRangement;
    poidsEscalade = borne(poidsEscalade + (escalade ? pasRangement : -pasRangement), 0, 1);
    const mainsSorties = poidsEscalade >= 0.5;
    const cache = mainsSorties ? 2 - 2 * poidsEscalade : 2 * poidsEscalade;
    objet.position.y -= ESCALADE.rangement * cache * cache;
    porte.visible = !mainsSorties;
    mainOuverteD.visible = mainsSorties;
    if (mainsSorties) {
      // Le corps se balance un peu d'une prise à l'autre
      objet.position.x += Math.sin(phaseEscalade) * 0.012;
      objet.rotation.z = Math.sin(phaseEscalade) * 0.02;
      supportBouclier.visible = false;
      mainOuverte.visible = true;
      mainsEnPrise = true;
      placerMainEscalade(avantBrasG, mainOuverte, doigts, pouceG, -1);
      placerMainEscalade(avantBrasD, mainOuverteD, doigtsD, pouceD, 1);
      // Un sort en cours s'arrête là (flamme et lueur s'éteignent)
      sortEnCours = null;
      effetMain.mettreAJour(dt, 0, 0);
      return;
    }
    if (mainsEnPrise) {
      mainsEnPrise = false;
      quitterPoseEscalade();
    }
    mainOuverte.rotation.x = FLEXION_POIGNET;

    // Frappe : l'outil et les mains tournent autour de l'épaule (lever, abattre vers le centre, contrecoup)
    const frappe = tempsFrappe(progressionFrappe);
    const w = frappe.poids;
    const ab = frappe.abattement;
    angles.set(
      (melange(0.38, -0.5, ab) + 0.09 * frappe.choc) * w,
      melange(0, 0.32, ab) * w,
      melange(-0.06, 0.2, ab) * w,
    );
    // Coup puissant : l'épée recule comme pour s'armer (lame relevée), et tremble de plus en plus
    charge = chargeVoulue >= charge ? chargeVoulue : Math.max(chargeVoulue, charge - dt * 9);
    const recul = charge * (1 - w);
    const tremble = recul * recul;
    if (recul > 0) {
      angles.x += 0.3 * recul + Math.sin(temps * 61) * 0.012 * tremble;
      angles.z += -0.06 * recul + Math.sin(temps * 47) * 0.016 * tremble;
    }
    // Micro-mouvements de l'outil au repos (ils s'effacent pendant la frappe et la charge)
    const M = CONFIG.personnage.microMouvements;
    const calme = (1 - w) * (1 - recul);
    // Balancement des bras à la marche : un aller-retour par foulée (deux pas), l'outil à contretemps de la main libre
    const B = CONFIG.personnage.balancementBras;
    const balance = Math.sin(phaseMarche) * intensiteMarche;
    angles.x += B.rotationOutil * balance * calme;
    angles.x += M.rotationOutil * fremir(temps * 0.57, 2.6) * calme;
    angles.y += 0.7 * M.rotationOutil * fremir(temps * 0.49, 7.3) * calme;
    angles.z += M.rotationOutil * fremir(temps * 0.62, 4.4) * calme;
    geste.setFromEuler(angles);
    demiGeste.copy(sansGeste).slerp(geste, 0.5);
    porte.position.copy(reposPosition).sub(PIVOT_FRAPPE).applyQuaternion(geste).add(PIVOT_FRAPPE);
    // L'outil s'éloigne un peu quand il est armé (il ne colle pas à l'œil), puis avance
    // et remonte en s'abattant, pour rester dans le champ
    porte.position.y += 0.13 * ab * w;
    porte.position.z -= (0.11 + 0.02 * ab) * w;
    porte.position.x += Math.sin(temps * 53) * 0.004 * tremble;
    porte.position.z -= 0.08 * recul;
    porte.position.x += M.outil * fremir(temps * 0.44, 6.2) * calme;
    porte.position.y += M.outil * fremir(temps * 0.52, 8.8) * calme;
    porte.position.z += B.outil * balance * calme;
    porte.position.y -= 0.35 * B.outil * balance * calme;
    porte.quaternion.copy(geste).multiply(reposOrientation);
    // Arc : il monte de sa pose basse à la pose de tir, et la corde recule avec la tension
    if (arcTenu) {
      poidsVisee += ((viseeArc ? 1 : 0) - poidsVisee) * (1 - Math.exp(-14 * dt));
      porte.position.lerpVectors(ARC_REPOS.position, ARC_VISE.position, poidsVisee);
      porte.position.y += souffle * 0.004;
      porte.quaternion.slerpQuaternions(ARC_REPOS.orientation, ARC_VISE.orientation, poidsVisee);
      if (outilTenu) tendreArc(outilTenu, tensionArc, flecheArc);
    }
    inverse.copy(porte.quaternion).invert();

    main.copy(porte.position);
    if (!arcTenu) placerBras(avantBrasD, poingD, tenue.coudeD);

    // Sort : la main gauche fait son geste, ouverte ; avec un outil tenu à deux mains, elle
    // lâche le manche le temps du sort puis y revient
    if (sortEnCours) {
      tempsDuSort += dt;
      if (tempsDuSort >= dureeGesteSort(sortEnCours)) sortEnCours = null;
    }
    const sort = sortEnCours ? tempsSort(sortEnCours, tempsDuSort) : SANS_SORT;
    if (arcTenu) {
      // Arc : la main gauche tient la poignée ; la droite tient la corde sous l'encoche et la tire vers la joue
      for (let k = 0; k < 3; k++) {
        coudeArcG[k] = melange(ARC_REPOS.coudeG[k], ARC_VISE.coudeG[k], poidsVisee);
        coudeArcD[k] = melange(ARC_REPOS.coudeD[k], ARC_VISE.coudeD[k], poidsVisee);
      }
      main.copy(porte.position);
      placerBras(avantBrasG, poingD, coudeArcG);
      poingG.position.set(encocheArc(tensionArc), ENCOCHE_ARC_Y - 0.03, 0);
      main.copy(poingG.position).applyQuaternion(porte.quaternion).add(porte.position);
      placerBras(avantBrasD, poingG, coudeArcD);
      poingG.visible = true;
      mainOuverte.visible = false;
      poingBouclier.visible = false;
      supportBouclier.visible = false;
      // Un sort lancé arc en main part de la main qui tient l'arc
      effetMain.objet.position.copy(porte.position);
      effetMain.mettreAJour(dt, sort.flamme, sort.lueur);
      return;
    }
    const mainSurManche = deuxMains && !sortEnCours;
    // Bouclier : il glisse de sa pose de repos à sa pose levée ; pendant un sort, la main le lâche et il s'abaisse
    const avecBouclier = bouclierTenu !== null && !deuxMains;
    poidsGarde += ((gardeLevee ? 1 : 0) - poidsGarde) * (1 - Math.exp(-16 * dt));
    supportBouclier.visible = avecBouclier;
    if (avecBouclier) {
      supportBouclier.position.lerpVectors(BOUCLIER_REPOS.centre, BOUCLIER_LEVE.centre, poidsGarde);
      supportBouclier.position.y += souffle * 0.004 - 0.8 * sort.poids;
      supportBouclier.quaternion.slerpQuaternions(BOUCLIER_REPOS.orientation, BOUCLIER_LEVE.orientation, poidsGarde);
    }
    const mainSurBouclier = avecBouclier && !sortEnCours;
    poingBouclier.visible = mainSurBouclier;
    poingG.visible = mainSurManche;
    mainOuverte.visible = !mainSurManche && !mainSurBouclier;
    if (deuxMains) main.set(0, poingG.position.y, 0).applyQuaternion(porte.quaternion).add(porte.position);
    if (mainSurManche) {
      placerBras(avantBrasG, poingG, tenue.coudeG);
    } else if (mainSurBouclier) {
      // L'avant-bras part de la poignée (au dos du bouclier) vers le coude
      main.set(0, 0, PRISE_BOUCLIER_Z).applyQuaternion(supportBouclier.quaternion).add(supportBouclier.position);
      coude.lerpVectors(BOUCLIER_REPOS.coude, BOUCLIER_LEVE.coude, poidsGarde);
      versCoude.copy(coude).sub(main).normalize();
      avantBrasG.position.copy(main).addScaledVector(versCoude, RECUL_POIGNET);
      avantBrasG.quaternion.setFromUnitVectors(VERS_LE_BAS, versCoude);
    } else {
      if (avecBouclier) {
        // La main part de la poignée du bouclier (et y revient à la fin du sort)
        main.lerpVectors(BOUCLIER_REPOS.centre, BOUCLIER_LEVE.centre, poidsGarde);
      } else if (!deuxMains) {
        // Main libre : elle accompagne à peine le geste et flotte avec la respiration
        main.set(...tenue.mainLibre);
        main.y += souffle * 0.004 + 0.03 * w;
        // La main libre dérive un peu, lentement, au lieu de rester figée
        main.x += M.main * fremir(temps * 0.47, 0.9) * (1 - w);
        main.y += M.main * fremir(temps * 0.39, 2.2) * (1 - w);
        main.z += 0.6 * M.main * fremir(temps * 0.35, 4.7) * (1 - w);
        // À la marche, elle part vers l'avant en remontant un peu, puis revient (le coude reste en place :
        // c'est l'avant-bras qui pivote)
        main.z -= B.mainLibre * balance * (1 - w);
        main.y += 0.35 * B.mainLibre * balance * (1 - w);
        main.x -= 0.15 * B.mainLibre * balance * (1 - w);
      }
      placerMainLibre(sort);
    }
    effetMain.mettreAJour(dt, sort.flamme, sort.lueur);
  }

  return {
    objet,
    mettreAJour,
    definirOutil,
    jouerSort(type) {
      sortEnCours = type;
      tempsDuSort = 0;
    },
    positionPaume: (cible) => effetMain.objet.getWorldPosition(cible),
    definirBouclier,
    definirGarde(leve) {
      gardeLevee = leve;
    },
    definirCharge(valeur) {
      chargeVoulue = Math.max(0, Math.min(1, valeur));
    },
    definirEscalade(actif, phase) {
      escalade = actif;
      phaseEscalade = phase;
    },
    definirArmure: manches.definir,
    definirArc(tension, vise, fleche) {
      tensionArc = borne(tension, 0, 1);
      viseeArc = vise;
      flecheArc = fleche;
    },
  };
}
