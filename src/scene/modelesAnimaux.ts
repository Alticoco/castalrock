// Modèles des animaux sauvages, en code, d'après les images concept (docs/concepts) : cerf roux aux grands bois,
// lapin brun assis aux longues oreilles, renard roux à la queue touffue, sanglier massif à la crinière sombre.
// Animations procédurales : pas, trot et galop, tête au sol (brouter, fouiller), fuite, coup reçu (flash blanc),
// mort ; pour le sanglier, l'élan (il gratte le sol) et la charge. Aucune règle de jeu ici : la pose vient de
// src/regles/animaux.ts. Repère : pieds à l'origine, l'avant regarde +z (comme le personnage).

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { TypeAnimal } from '../regles/combat';
import { adoucir, borner, creerTeinte, fuseauCouche, libererGeometries, type ModeleEnnemi, type PoseEnnemi } from './modelesEnnemis';
import { boite, creerMateriau, fuseau, galet, maille, type Anneau } from './outils';

export const COULEURS_ANIMAUX = {
  // Cerf
  cerf: 0xc4723a,
  cerfSombre: 0xa95f2f,
  cerfClair: 0xe9c898,
  bois: 0xb98a5c,
  sabot: 0x5a3328,
  oeilSombre: 0x33201a,
  // Lapin
  lapin: 0x9c7c63,
  lapinSombre: 0x876a52,
  lapinClair: 0xefe4d0,
  oreilleRose: 0xdd9c82,
  nezLapin: 0x7b4232,
  patteLapin: 0xb99a7c,
  // Renard
  renard: 0xe8752d,
  renardSombre: 0xc95f21,
  renardClair: 0xf3e1c8,
  chaussette: 0x5f3930,
  truffe: 0x2a1e1c,
  oeilRenard: 0xd9901e,
  // Sanglier
  sanglier: 0x8a4a34,
  sanglierSombre: 0x70392a,
  criniere: 0x58382f,
  groin: 0x9c5c42,
  defense: 0xf0e3c6,
} as const;

const DUREE_MORT = CONFIG.combat.dureeMortEnnemi;

/** Tige à 5 pans entre deux points (bois du cerf) ; `pointe` : part du rayon gardée au bout (plus petit = plus pointu). */
function branche(a: readonly [number, number, number], b: readonly [number, number, number], rayon: number, materiau: THREE.Material, pointe = 0.55): THREE.Mesh {
  const depart = new THREE.Vector3(...a);
  const direction = new THREE.Vector3(...b).sub(depart);
  const longueur = direction.length();
  const m = maille(new THREE.CylinderGeometry(rayon * pointe, rayon, longueur, 5), materiau);
  m.position.copy(depart).addScaledVector(direction, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return m;
}

/** Oreille pointue : pavillon plat à 4 pans et son creux clair, pivot à la base. */
function oreillePointue(rayon: number, hauteur: number, dos: THREE.Material, creux: THREE.Material): THREE.Group {
  const oreille = new THREE.Group();
  const pavillon = maille(new THREE.ConeGeometry(rayon, hauteur, 4), dos, 0, hauteur * 0.45, 0);
  pavillon.scale.z = 0.5;
  const interieur = maille(new THREE.ConeGeometry(rayon * 0.62, hauteur * 0.72, 4), creux, 0, hauteur * 0.38, rayon * 0.24);
  interieur.scale.z = 0.4;
  oreille.add(pavillon, interieur);
  return oreille;
}

// --- Quadrupèdes : cerf, renard, sanglier ----------------------------------------------------

interface Patte {
  haut: THREE.Group;
  bas: THREE.Group;
  avant: boolean;
}

interface PlanPatte {
  /** Pivot du haut (épaule ou hanche), dans le repère du tronc */
  x: number;
  y: number;
  z: number;
  haut: Anneau[];
  /** Pivot du bas (coude ou jarret), dans le repère du haut */
  basY: number;
  basZ: number;
  bas: Anneau[];
  /** Pied : largeur, hauteur, profondeur, puis position dans le repère du bas */
  pied: [number, number, number, number, number];
  matHaut: THREE.Material;
  matBas: THREE.Material;
  matPied: THREE.Material;
  avant: boolean;
}

function creerPattes(tronc: THREE.Group, plans: PlanPatte[]): Patte[] {
  const pattes: Patte[] = [];
  for (const plan of plans) {
    for (const cote of [-1, 1]) {
      const haut = new THREE.Group();
      haut.position.set(cote * plan.x, plan.y, plan.z);
      haut.add(maille(fuseau(plan.haut), plan.matHaut));
      const bas = new THREE.Group();
      bas.position.set(0, plan.basY, plan.basZ);
      bas.add(maille(fuseau(plan.bas), plan.matBas));
      const [l, h, p, y, z] = plan.pied;
      bas.add(boite(l, h, p, plan.matPied, 0, y, z));
      haut.add(bas);
      tronc.add(haut);
      pattes.push({ haut, bas, avant: plan.avant });
    }
  }
  return pattes;
}

interface PlanQuadrupede {
  objet: THREE.Group;
  corps: THREE.Group;
  tronc: THREE.Group;
  cou: THREE.Group;
  tete: THREE.Group;
  queue: THREE.Group;
  oreilles: THREE.Object3D[];
  pattes: Patte[];
  materiaux: THREE.MeshStandardMaterial[];
  /** Hauteur de la barre de vie */
  hauteur: number;
  hauteurTronc: number;
  longueurPatte: number;
  /** Port du cou tête haute et tête au sol (0 = vertical, plus grand = plus bas et plus en avant) */
  couRepos: number;
  couBas: number;
  /** Inclinaison de la tête (museau vers le sol) quand elle est en bas */
  teteBas: number;
  queueRepos: number;
  queueFuite: number;
  /** Cadence des foulées (les petites pattes vont plus vite) et vitesse où le trot devient galop (m/s) */
  cadence: number;
  seuilGalop: number;
  /** Part du repos passée la tête au sol (brouter, fouiller, flairer), de 0 à 1 */
  partTeteBasse: number;
  /** Demi-largeur du corps : hauteur du flanc quand il est couché, mort */
  demiLargeur: number;
  /** Taille d'ensemble (1 = les cotes du modèle telles quelles) */
  echelle: number;
}

function creerQuadrupede(q: PlanQuadrupede): ModeleEnnemi {
  const { objet, corps, tronc, cou, tete, queue, oreilles, pattes } = q;
  // Décalage de chaque patte (avant gauche, avant droite, arrière gauche, arrière droite) : trot puis galop
  const DECALAGE_TROT = [0, Math.PI, Math.PI, 0];
  const DECALAGE_GALOP = [0, 0.7, Math.PI, Math.PI + 0.7];
  const teinte = creerTeinte(q.materiaux);
  let temps = Math.random() * 10;
  let phaseMarche = 0;
  let intensiteMarche = 0;
  let vitesse = 0;
  let precedent: { x: number; z: number } | null = null;
  const repos = { tangage: 0, baisse: 0, cou: q.couRepos, tete: 0, oreilles: 0, queue: q.queueRepos, avant: 0, arriere: 0 };
  // Valeurs affichées, lissées d'une image à l'autre
  const pose = { ...repos };

  return {
    objet,
    hauteur: q.hauteur * q.echelle,
    flash: () => teinte.flash(),
    mettreAJour(dt: number, p: PoseEnnemi) {
      temps += dt;
      const vivant = p.phase !== 'mort';
      // Vitesse réelle, mesurée d'une image à l'autre : elle règle la cadence et fait passer du trot au galop
      if (precedent && dt > 0) {
        const mesure = Math.hypot(p.x - precedent.x, p.z - precedent.z) / dt;
        vitesse += (Math.min(mesure, 14) - vitesse) * Math.min(1, dt * 8);
      }
      precedent = { x: p.x, z: p.z };
      const court = vivant && p.enMouvement && p.phase !== 'recul';
      intensiteMarche += ((court ? 1 : 0) - intensiteMarche) * Math.min(1, dt * 10);
      const galop = borner((vitesse - q.seuilGalop) / 2);
      phaseMarche += dt * q.cadence * (5 + vitesse * 1.3) * intensiteMarche;

      // Pose visée selon la phase
      let cible = { ...repos };
      let vitesseGeste = 10;
      let gratte = 0;
      if (p.phase === 'repos') {
        // De temps en temps la tête descend au sol (brouter, fouiller, flairer), puis se relève pour guetter
        const basse = Math.sin(temps * 0.45) > 1 - 2 * q.partTeteBasse;
        if (basse) cible = { ...cible, cou: q.couBas + Math.sin(temps * 5) * 0.04, tete: q.teteBas };
        vitesseGeste = 3.5;
      } else if (p.phase === 'errance' || p.phase === 'retour') {
        cible = { ...cible, cou: q.couRepos + (q.couBas - q.couRepos) * 0.06 };
      } else if (p.phase === 'fuite') {
        // Tête haute, oreilles couchées, queue dressée
        cible = { ...cible, cou: q.couRepos + 0.12, oreilles: -0.7, queue: q.queueFuite };
      } else if (p.phase === 'poursuite') {
        cible = { ...cible, cou: q.couRepos + (q.couBas - q.couRepos) * 0.45, tete: q.teteBas * 0.3, oreilles: -0.6 };
      } else if (p.phase === 'anticipation') {
        // Élan : tête basse, corps ramassé, une patte avant gratte le sol ; c'est le moment de lever le bouclier
        const k = adoucir(borner(p.anticipation * 2.5));
        cible = { ...cible, tangage: 0.09 * k, baisse: 0.07 * k, cou: q.couRepos + (q.couBas - q.couRepos) * 0.75 * k, tete: q.teteBas * 0.5 * k, oreilles: -1.0 * k, queue: q.queueFuite };
        gratte = Math.max(0, Math.sin(temps * 15)) * k;
        vitesseGeste = 25;
      } else if (p.phase === 'attaque') {
        // Charge : tête baissée, défenses en avant
        cible = { ...cible, tangage: 0.07, cou: q.couRepos + (q.couBas - q.couRepos) * 0.6, tete: q.teteBas * 0.25, oreilles: -1.0, queue: q.queueFuite };
        vitesseGeste = 30;
      } else if (p.phase === 'recul') {
        cible = { ...cible, tangage: -0.16, baisse: 0.03, cou: q.couRepos - 0.2, oreilles: -1.0, avant: -0.3 };
        vitesseGeste = 26;
      } else if (p.phase === 'etourdi') {
        // Sonné : tête basse qui dodeline
        cible = { ...cible, cou: q.couRepos + (q.couBas - q.couRepos) * 0.5 + Math.sin(temps * 9) * 0.08, tete: q.teteBas * 0.4, oreilles: -0.4 };
      } else if (!vivant) {
        cible = { ...cible, cou: q.couRepos + 0.5, oreilles: -0.6, avant: -0.35, arriere: 0.35 };
        vitesseGeste = 8;
      }
      const lissage = Math.min(1, dt * vitesseGeste);
      for (const cle of Object.keys(pose) as Array<keyof typeof pose>) pose[cle] += (cible[cle] - pose[cle]) * lissage;

      // Corps : rebond du trot, tangage du galop, tremblement pendant l'élan
      const rebond = Math.abs(Math.sin(phaseMarche)) * (0.02 + 0.035 * galop) * intensiteMarche * (q.hauteurTronc / 0.6);
      const souffle = Math.sin(temps * 2.2) * 0.005;
      tronc.position.y = q.hauteurTronc - pose.baisse + rebond + souffle;
      tronc.position.x = p.phase === 'anticipation' ? Math.sin(temps * 40) * 0.006 : 0;
      tronc.rotation.x = pose.tangage + Math.sin(phaseMarche) * 0.06 * galop * intensiteMarche;
      cou.rotation.x = pose.cou + Math.sin(phaseMarche * 2) * 0.03 * intensiteMarche;
      // La tête reste à l'horizontale quel que soit le port du cou, sauf quand elle plonge vers le sol
      tete.rotation.x = -cou.rotation.x - tronc.rotation.x * 0.8 + pose.tete;
      tete.rotation.z = vivant ? Math.sin(temps * 0.9) * 0.03 : 0;
      oreilles.forEach((oreille, i) => {
        // Une oreille tressaille de temps en temps
        const tressaille = vivant && Math.sin(temps * 1.3 + i * 2.1) > 0.96 ? 0.25 : 0;
        oreille.rotation.x = pose.oreilles - tressaille;
      });
      queue.rotation.x = pose.queue + Math.sin(phaseMarche) * 0.1 * intensiteMarche;
      queue.rotation.z = vivant ? Math.sin(temps * 2.3) * 0.1 * (1 - intensiteMarche) + Math.sin(phaseMarche) * 0.08 * intensiteMarche : 0;

      // Pattes : foulée, puis pliure pour garder les pieds au sol quand le corps se baisse
      const pliure = Math.sqrt((2 * Math.max(0, pose.baisse)) / q.longueurPatte);
      const amplitude = (0.38 + 0.34 * galop) * intensiteMarche;
      pattes.forEach((patte, i) => {
        const phi = phaseMarche + DECALAGE_TROT[i] + (DECALAGE_GALOP[i] - DECALAGE_TROT[i]) * galop;
        const geste = (patte.avant ? pose.avant : pose.arriere) - (i === 0 ? gratte * 0.55 : 0);
        patte.haut.rotation.x = Math.sin(phi) * amplitude - pliure + geste - tronc.rotation.x;
        patte.bas.rotation.x =
          Math.max(0, -Math.cos(phi)) * (0.7 + 0.4 * galop) * intensiteMarche + 2 * pliure + Math.max(0, -geste) * 0.5 + (i === 0 ? gratte * 0.6 : 0);
      });

      let disparition = 0;
      let echelle = q.echelle;
      if (!vivant) {
        // Il s'effondre sur le flanc, puis rétrécit et s'efface (la fumée est ajoutée par les effets)
        const k = borner(p.tempsPhase / DUREE_MORT);
        const chute = adoucir(borner(k / 0.45));
        corps.rotation.z = chute * 1.5;
        corps.position.y = chute * q.demiLargeur * q.echelle;
        const fin = borner((k - 0.5) / 0.5);
        disparition = fin;
        echelle *= 1 - 0.5 * fin;
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

/** Squelette commun : objet > corps (bascule à la mort) > tronc (porté par le dos) > cou > tête. */
function squelette(hauteurTronc: number) {
  const objet = new THREE.Group();
  const corps = new THREE.Group();
  objet.add(corps);
  const tronc = new THREE.Group();
  tronc.position.y = hauteurTronc;
  corps.add(tronc);
  const cou = new THREE.Group();
  tronc.add(cou);
  const tete = new THREE.Group();
  cou.add(tete);
  const queue = new THREE.Group();
  tronc.add(queue);
  return { objet, corps, tronc, cou, tete, queue };
}

// --- Cerf -------------------------------------------------------------------------------------

function creerCerf(): ModeleEnnemi {
  const K = COULEURS_ANIMAUX;
  const mat = {
    poil: creerMateriau(K.cerf),
    clair: creerMateriau(K.cerfClair),
    bois: creerMateriau(K.bois),
    sabot: creerMateriau(K.sabot),
    oeil: creerMateriau(K.oeilSombre),
  };
  const HAUTEUR = 1.0;
  const COU = 0.28;
  const LONGUEUR_COU = 0.52;
  const s = squelette(HAUTEUR);
  const { tronc, cou, tete, queue } = s;
  /** Volume couché le long de z, aux coins plus coupés que `fuseauCouche` : des flancs ronds plutôt que carrés. */
  const couche = (tranches: Array<{ z: number; rx: number; ry: number; dy?: number }>, coin = 0.5): THREE.BufferGeometry => {
    const g = fuseau(tranches.map((t) => ({ y: t.z, rx: t.rx, rz: t.ry, dz: -(t.dy ?? 0), c: Math.min(t.rx, t.ry) * coin })));
    g.rotateX(Math.PI / 2);
    return g;
  };

  // Tronc élancé : poitrail profond, garrot marqué, ventre qui remonte vers l'arrière, croupe ronde
  tronc.add(
    maille(
      couche([
        { z: -0.65, rx: 0.09, ry: 0.1, dy: 0.07 },
        { z: -0.56, rx: 0.175, ry: 0.18, dy: 0.055 },
        { z: -0.3, rx: 0.205, ry: 0.21, dy: 0.045 },
        { z: 0.0, rx: 0.215, ry: 0.255, dy: -0.005 },
        { z: 0.3, rx: 0.225, ry: 0.285, dy: 0.015 },
        { z: 0.5, rx: 0.185, ry: 0.24, dy: 0.03 },
        { z: 0.6, rx: 0.11, ry: 0.1, dy: 0.13 },
      ]),
      mat.poil,
    ),
  );
  // Ventre clair : une bande visible au bas des flancs, du poitrail à l'aine
  tronc.add(
    maille(
      couche(
        [
          { z: -0.36, rx: 0.12, ry: 0.045, dy: -0.125 },
          { z: -0.02, rx: 0.18, ry: 0.06, dy: -0.215 },
          { z: 0.3, rx: 0.187, ry: 0.062, dy: -0.225 },
          { z: 0.5, rx: 0.14, ry: 0.06, dy: -0.17 },
        ],
        0.3,
      ),
      mat.clair,
    ),
  );
  // Poitrail clair : il ferme l'avant du tronc, de la gorge jusqu'entre les pattes
  tronc.add(
    maille(
      couche(
        [
          { z: 0.44, rx: 0.15, ry: 0.17, dy: -0.06 },
          { z: 0.56, rx: 0.142, ry: 0.17, dy: -0.05 },
          { z: 0.63, rx: 0.09, ry: 0.12, dy: -0.03 },
        ],
        0.5,
      ),
      mat.clair,
    ),
  );
  // Miroir : la tache claire de la croupe, sous la queue
  tronc.add(
    maille(
      couche(
        [
          { z: -0.675, rx: 0.06, ry: 0.08, dy: 0.03 },
          { z: -0.635, rx: 0.118, ry: 0.135, dy: 0.02 },
          { z: -0.56, rx: 0.15, ry: 0.16, dy: 0.02 },
        ],
        0.45,
      ),
      mat.clair,
    ),
  );

  // Cou long et relevé, épais à l'épaule et fin sous la tête, gorge claire
  cou.position.set(0, 0.16, 0.46);
  cou.rotation.x = COU;
  cou.add(
    maille(
      fuseau([
        { y: -0.05, rx: 0.145, rz: 0.185, dz: -0.015 },
        { y: 0.1, rx: 0.12, rz: 0.15, dz: -0.005 },
        { y: 0.32, rx: 0.1, rz: 0.115 },
        { y: LONGUEUR_COU + 0.02, rx: 0.085, rz: 0.095, dz: 0.005 },
      ]),
      mat.poil,
    ),
  );
  cou.add(
    maille(
      fuseau([
        { y: -0.05, rx: 0.11, rz: 0.055, dz: 0.125 },
        { y: 0.1, rx: 0.094, rz: 0.05, dz: 0.108 },
        { y: 0.32, rx: 0.076, rz: 0.04, dz: 0.083 },
        { y: LONGUEUR_COU, rx: 0.062, rz: 0.035, dz: 0.068 },
      ]),
      mat.clair,
    ),
  );

  // Tête longue et fine : front large, chanfrein qui descend vers la truffe, dessous du museau clair
  tete.position.set(0, LONGUEUR_COU + 0.02, 0.03);
  tete.rotation.x = -COU;
  tete.add(
    maille(
      couche(
        [
          { z: -0.13, rx: 0.06, ry: 0.075, dy: 0.015 },
          { z: -0.03, rx: 0.1, ry: 0.122, dy: 0.016 },
          { z: 0.08, rx: 0.094, ry: 0.108, dy: -0.005 },
          { z: 0.2, rx: 0.066, ry: 0.08, dy: -0.03 },
          { z: 0.31, rx: 0.05, ry: 0.058, dy: -0.05 },
          { z: 0.36, rx: 0.038, ry: 0.044, dy: -0.056 },
        ],
        0.4,
      ),
      mat.poil,
    ),
  );
  tete.add(
    maille(
      couche(
        [
          { z: -0.02, rx: 0.078, ry: 0.032, dy: -0.092 },
          { z: 0.2, rx: 0.06, ry: 0.03, dy: -0.092 },
          { z: 0.32, rx: 0.045, ry: 0.026, dy: -0.1 },
          { z: 0.365, rx: 0.036, ry: 0.022, dy: -0.1 },
        ],
        0.3,
      ),
      mat.clair,
    ),
  );
  tete.add(boite(0.058, 0.046, 0.03, mat.sabot, 0, -0.04, 0.365));
  for (const cote of [-1, 1]) {
    // Œil sombre sur le côté, surmonté d'une paupière claire
    const oeil = new THREE.Group();
    oeil.position.set(cote * 0.08, 0.035, 0.1);
    oeil.rotation.y = cote * 0.4;
    oeil.add(boite(0.03, 0.044, 0.055, mat.oeil));
    oeil.add(boite(0.034, 0.014, 0.07, mat.clair, 0, 0.029, 0));
    tete.add(oeil);
  }
  const oreilles = [-1, 1].map((cote) => {
    // Grandes oreilles en feuille, portées sur le côté et un peu vers l'arrière
    const pivot = new THREE.Group();
    pivot.position.set(cote * 0.078, 0.085, -0.075);
    const oreille = oreillePointue(0.085, 0.26, mat.poil, mat.clair);
    oreille.rotation.z = -cote * 1.15;
    oreille.rotation.y = cote * 0.3;
    pivot.add(oreille);
    tete.add(pivot);
    return pivot;
  });
  // Bois : un merrain qui part vers l'extérieur et l'arrière puis se redresse, et quatre andouillers dressés
  // (l'andouiller d'œil pointe vers l'avant). Cinq pointes par côté, comme sur l'image.
  for (const cote of [-1, 1]) {
    const pt = (x: number, y: number, z: number): [number, number, number] => [cote * x, y, z];
    const base = pt(0.045, 0.1, -0.05);
    const a = pt(0.16, 0.19, -0.1);
    const b = pt(0.3, 0.3, -0.17);
    const c = pt(0.37, 0.46, -0.24);
    const d = pt(0.35, 0.64, -0.26);
    tete.add(branche(base, a, 0.034, mat.bois), branche(a, b, 0.032, mat.bois), branche(b, c, 0.029, mat.bois), branche(c, d, 0.026, mat.bois, 0.3));
    tete.add(branche(pt(0.06, 0.125, -0.06), pt(0.08, 0.33, 0.11), 0.024, mat.bois, 0.3));
    tete.add(branche(a, pt(0.17, 0.42, -0.05), 0.024, mat.bois, 0.3));
    tete.add(branche(b, pt(0.3, 0.56, -0.13), 0.024, mat.bois, 0.3));
    tete.add(branche(c, pt(0.47, 0.6, -0.2), 0.023, mat.bois, 0.3));
  }

  // Queue courte : dessus roux, dessous et pointe clairs (elle se dresse et montre le clair pendant la fuite)
  queue.position.set(0, 0.15, -0.65);
  queue.add(
    maille(
      fuseau([
        { y: 0.03, rx: 0.04, rz: 0.03 },
        { y: -0.11, rx: 0.065, rz: 0.045 },
        { y: -0.25, rx: 0.028, rz: 0.024 },
      ]),
      mat.clair,
    ),
  );
  queue.add(
    maille(
      fuseau([
        { y: 0.035, rx: 0.036, rz: 0.02, dz: -0.014 },
        { y: -0.08, rx: 0.04, rz: 0.02, dz: -0.03 },
        { y: -0.15, rx: 0.026, rz: 0.014, dz: -0.028 },
      ]),
      mat.poil,
    ),
  );

  // Pattes fines : avant-bras et cuisse qui s'affinent, genou et jarret renflés, canon mince, boulet au-dessus du sabot
  const SABOT = 0.055;
  const pattes = creerPattes(tronc, [
    {
      x: 0.15, y: -0.1, z: 0.4, avant: true,
      haut: [
        { y: 0.2, rx: 0.06, rz: 0.11, dz: -0.02 },
        { y: -0.08, rx: 0.062, rz: 0.09 },
        { y: -0.4, rx: 0.037, rz: 0.044 },
        { y: -0.47, rx: 0.044, rz: 0.054, dz: 0.004 },
      ],
      basY: -0.47, basZ: 0,
      bas: [
        { y: 0.02, rx: 0.044, rz: 0.054, dz: 0.004 },
        { y: -0.07, rx: 0.031, rz: 0.036 },
        { y: -0.32, rx: 0.028, rz: 0.032 },
        { y: -0.375, rx: 0.036, rz: 0.043 },
      ],
      pied: [0.07, SABOT, 0.1, -0.43 + SABOT / 2, 0.014],
      matHaut: mat.poil, matBas: mat.poil, matPied: mat.sabot,
    },
    {
      x: 0.155, y: -0.02, z: -0.42, avant: false,
      haut: [
        { y: 0.17, rx: 0.05, rz: 0.11, dz: 0.03 },
        { y: -0.05, rx: 0.078, rz: 0.16, dz: 0.02 },
        { y: -0.25, rx: 0.058, rz: 0.095, dz: -0.03 },
        { y: -0.45, rx: 0.04, rz: 0.052, dz: -0.12 },
      ],
      basY: -0.45, basZ: -0.12,
      bas: [
        { y: 0.03, rx: 0.042, rz: 0.055, dz: -0.008 },
        { y: -0.09, rx: 0.031, rz: 0.037, dz: 0.004 },
        { y: -0.42, rx: 0.028, rz: 0.032, dz: 0.01 },
        { y: -0.475, rx: 0.036, rz: 0.043, dz: 0.012 },
      ],
      pied: [0.07, SABOT, 0.1, -0.53 + SABOT / 2, 0.028],
      matHaut: mat.poil, matBas: mat.poil, matPied: mat.sabot,
    },
  ]);
  // Ergots : une petite pointe sombre derrière chaque boulet
  for (const patte of pattes) {
    const y = patte.avant ? -0.375 : -0.475;
    const z = patte.avant ? -0.046 : -0.034;
    patte.bas.add(boite(0.048, 0.032, 0.034, mat.sabot, 0, y, z));
  }

  return creerQuadrupede({
    ...s,
    oreilles,
    pattes,
    materiaux: Object.values(mat),
    hauteur: 2.35,
    hauteurTronc: HAUTEUR,
    longueurPatte: 0.92,
    couRepos: COU,
    couBas: 2.75,
    teteBas: 1.2,
    queueRepos: 0.45,
    queueFuite: 2.2,
    cadence: 0.75,
    seuilGalop: 4,
    partTeteBasse: 0.6,
    demiLargeur: 0.22,
    echelle: 1,
  });
}

// --- Renard -----------------------------------------------------------------------------------

function creerRenard(): ModeleEnnemi {
  const K = COULEURS_ANIMAUX;
  const mat = {
    poil: creerMateriau(K.renard),
    sombre: creerMateriau(K.renardSombre),
    clair: creerMateriau(K.renardClair),
    chaussette: creerMateriau(K.chaussette),
    truffe: creerMateriau(K.truffe),
    oeil: creerMateriau(K.oeilRenard),
  };
  const HAUTEUR = 0.42;
  const COU = 0.6;
  const s = squelette(HAUTEUR);
  const { tronc, cou, tete, queue } = s;

  // Tronc fin : poitrail un peu plus fort, taille pincée
  tronc.add(
    maille(
      fuseauCouche([
        { z: -0.35, rx: 0.06, ry: 0.07, dy: 0.02 },
        { z: -0.25, rx: 0.105, ry: 0.115 },
        { z: 0, rx: 0.098, ry: 0.1, dy: 0.005 },
        { z: 0.2, rx: 0.115, ry: 0.13, dy: -0.005 },
        { z: 0.34, rx: 0.07, ry: 0.09, dy: 0.03 },
      ]),
      mat.poil,
    ),
  );
  // Ventre et poitrail clairs
  tronc.add(
    maille(
      fuseauCouche([
        { z: -0.22, rx: 0.085, ry: 0.035, dy: -0.088 },
        { z: 0, rx: 0.092, ry: 0.035, dy: -0.076 },
        { z: 0.2, rx: 0.095, ry: 0.06, dy: -0.09 },
        { z: 0.3, rx: 0.07, ry: 0.09, dy: -0.03 },
        { z: 0.352, rx: 0.05, ry: 0.07, dy: 0.02 },
      ]),
      mat.clair,
    ),
  );

  cou.position.set(0, 0.06, 0.27);
  cou.rotation.x = COU;
  cou.add(
    maille(
      fuseau([
        { y: -0.06, rx: 0.085, rz: 0.1 },
        { y: 0.1, rx: 0.076, rz: 0.086 },
        { y: 0.21, rx: 0.07, rz: 0.075 },
      ]),
      mat.poil,
    ),
  );
  cou.add(
    maille(
      fuseau([
        { y: -0.09, rx: 0.062, rz: 0.04, dz: 0.075 },
        { y: 0.1, rx: 0.062, rz: 0.04, dz: 0.058 },
        { y: 0.2, rx: 0.055, rz: 0.035, dz: 0.05 },
      ]),
      mat.clair,
    ),
  );

  // Tête en triangle : crâne large, museau pointu, joues claires, grandes oreilles
  tete.position.set(0, 0.22, 0.01);
  tete.rotation.x = -COU;
  tete.scale.setScalar(1.25);
  tete.add(
    maille(
      fuseauCouche([
        { z: -0.1, rx: 0.06, ry: 0.06 },
        { z: -0.02, rx: 0.098, ry: 0.085 },
        { z: 0.05, rx: 0.085, ry: 0.07, dy: -0.008 },
        { z: 0.12, rx: 0.048, ry: 0.044, dy: -0.026 },
        { z: 0.235, rx: 0.022, ry: 0.022, dy: -0.046 },
      ]),
      mat.poil,
    ),
  );
  tete.add(
    maille(
      fuseauCouche([
        { z: -0.08, rx: 0.065, ry: 0.035, dy: -0.05 },
        { z: -0.01, rx: 0.104, ry: 0.05, dy: -0.045 },
        { z: 0.07, rx: 0.07, ry: 0.035, dy: -0.052 },
        { z: 0.13, rx: 0.042, ry: 0.024, dy: -0.058 },
        { z: 0.23, rx: 0.02, ry: 0.016, dy: -0.062 },
      ]),
      mat.clair,
    ),
  );
  tete.add(boite(0.03, 0.026, 0.026, mat.truffe, 0, -0.04, 0.245));
  for (const cote of [-1, 1]) {
    const oeil = new THREE.Group();
    oeil.position.set(cote * 0.062, 0.016, 0.078);
    oeil.rotation.y = cote * 0.45;
    oeil.add(boite(0.034, 0.024, 0.016, mat.oeil));
    oeil.add(boite(0.012, 0.022, 0.016, mat.truffe, 0, 0, 0.003));
    tete.add(oeil);
  }
  const oreilles = [-1, 1].map((cote) => {
    const pivot = new THREE.Group();
    pivot.position.set(cote * 0.062, 0.062, -0.04);
    const oreille = oreillePointue(0.056, 0.17, mat.chaussette, mat.clair);
    oreille.rotation.z = -cote * 0.22;
    pivot.add(oreille);
    tete.add(pivot);
    return pivot;
  });

  // Queue touffue, presque aussi longue que le corps : rousse, bout clair
  queue.position.set(0, 0.03, -0.32);
  queue.add(
    maille(
      fuseau([
        { y: 0.04, rx: 0.04, rz: 0.04 },
        { y: -0.16, rx: 0.088, rz: 0.095 },
        { y: -0.34, rx: 0.105, rz: 0.112 },
        { y: -0.45, rx: 0.09, rz: 0.097 },
      ]),
      mat.sombre,
    ),
  );
  queue.add(
    maille(
      fuseau([
        { y: -0.43, rx: 0.093, rz: 0.1 },
        { y: -0.54, rx: 0.065, rz: 0.07 },
        { y: -0.64, rx: 0.012, rz: 0.012 },
      ]),
      mat.clair,
    ),
  );

  const pattes = creerPattes(tronc, [
    {
      x: 0.07, y: -0.04, z: 0.2, avant: true,
      haut: [
        { y: 0.07, rx: 0.04, rz: 0.06 },
        { y: -0.08, rx: 0.035, rz: 0.045 },
        { y: -0.19, rx: 0.028, rz: 0.03 },
      ],
      basY: -0.18, basZ: 0,
      bas: [
        { y: 0.02, rx: 0.03, rz: 0.032 },
        { y: -0.17, rx: 0.026, rz: 0.028 },
      ],
      pied: [0.06, 0.04, 0.09, -0.18, 0.02],
      matHaut: mat.poil, matBas: mat.chaussette, matPied: mat.chaussette,
    },
    {
      x: 0.075, y: -0.02, z: -0.22, avant: false,
      haut: [
        { y: 0.08, rx: 0.045, rz: 0.085 },
        { y: -0.07, rx: 0.045, rz: 0.085, dz: 0.015 },
        { y: -0.2, rx: 0.03, rz: 0.04, dz: 0.035 },
      ],
      basY: -0.19, basZ: 0.035,
      bas: [
        { y: 0.02, rx: 0.03, rz: 0.035 },
        { y: -0.1, rx: 0.027, rz: 0.03, dz: -0.045 },
        { y: -0.19, rx: 0.026, rz: 0.028, dz: -0.035 },
      ],
      pied: [0.06, 0.04, 0.09, -0.19, -0.015],
      matHaut: mat.poil, matBas: mat.chaussette, matPied: mat.chaussette,
    },
  ]);

  return creerQuadrupede({
    ...s,
    oreilles,
    pattes,
    materiaux: Object.values(mat),
    hauteur: 0.9,
    hauteurTronc: HAUTEUR,
    longueurPatte: 0.38,
    couRepos: COU,
    couBas: 1.6,
    teteBas: 0.6,
    queueRepos: 0.95,
    queueFuite: 1.5,
    cadence: 1.35,
    seuilGalop: 3,
    partTeteBasse: 0.3,
    demiLargeur: 0.1,
    echelle: 1.15,
  });
}

// --- Sanglier ---------------------------------------------------------------------------------

function creerSanglier(): ModeleEnnemi {
  const K = COULEURS_ANIMAUX;
  const mat = {
    poil: creerMateriau(K.sanglier),
    sombre: creerMateriau(K.sanglierSombre),
    criniere: creerMateriau(K.criniere),
    groin: creerMateriau(K.groin),
    defense: creerMateriau(K.defense),
    sabot: creerMateriau(K.sabot),
    oeil: creerMateriau(K.oeilSombre),
  };
  const HAUTEUR = 0.64;
  const COU = 1.15;
  const s = squelette(HAUTEUR);
  const { tronc, cou, tete, queue } = s;

  // Tronc massif : garrot haut et large, arrière-train qui descend
  tronc.add(
    maille(
      fuseauCouche([
        { z: -0.68, rx: 0.14, ry: 0.16, dy: 0.0 },
        { z: -0.52, rx: 0.27, ry: 0.28, dy: -0.01 },
        { z: -0.12, rx: 0.3, ry: 0.31, dy: 0.02 },
        { z: 0.28, rx: 0.315, ry: 0.365, dy: 0.055 },
        { z: 0.54, rx: 0.25, ry: 0.31, dy: 0.045 },
        { z: 0.68, rx: 0.15, ry: 0.19, dy: 0.0 },
      ]),
      mat.poil,
    ),
  );
  // Dessous plus sombre
  tronc.add(
    maille(
      fuseauCouche([
        { z: -0.5, rx: 0.22, ry: 0.07, dy: -0.235 },
        { z: -0.1, rx: 0.27, ry: 0.08, dy: -0.225 },
        { z: 0.3, rx: 0.27, ry: 0.08, dy: -0.245 },
        { z: 0.55, rx: 0.18, ry: 0.07, dy: -0.21 },
      ]),
      mat.sombre,
    ),
  );
  // Crinière : une rangée de pointes sombres du garrot à la croupe, de plus en plus petites
  for (const [z, y, taille] of [
    [0.52, 0.33, 1.0],
    [0.3, 0.4, 1.15],
    [0.06, 0.34, 1.0],
    [-0.17, 0.31, 0.85],
    [-0.38, 0.27, 0.7],
    [-0.55, 0.2, 0.5],
  ] as const) {
    const pointe = maille(new THREE.ConeGeometry(0.2 * taille, 0.24 * taille, 4), mat.criniere, 0, y + 0.045 * taille, z);
    pointe.rotation.y = Math.PI / 4;
    pointe.rotation.x = -0.3;
    pointe.scale.set(0.75, 1, 1.15);
    tronc.add(pointe);
  }

  // Encolure courte et épaisse : la tête prolonge le corps
  cou.position.set(0, 0.02, 0.56);
  cou.rotation.x = COU;
  cou.add(
    maille(
      fuseau([
        { y: -0.08, rx: 0.23, rz: 0.27 },
        { y: 0.16, rx: 0.2, rz: 0.23 },
      ]),
      mat.poil,
    ),
  );

  // Grosse tête en coin : front large, long groin, défenses claires, petits yeux mauvais
  tete.position.set(0, 0.15, 0);
  tete.rotation.x = -COU;
  tete.add(
    maille(
      fuseauCouche([
        { z: -0.12, rx: 0.21, ry: 0.23 },
        { z: 0.08, rx: 0.19, ry: 0.205, dy: -0.025 },
        { z: 0.28, rx: 0.13, ry: 0.145, dy: -0.085 },
        { z: 0.46, rx: 0.095, ry: 0.1, dy: -0.125 },
      ]),
      mat.poil,
    ),
  );
  tete.add(boite(0.19, 0.18, 0.05, mat.groin, 0, -0.125, 0.475));
  for (const cote of [-1, 1]) {
    tete.add(boite(0.034, 0.046, 0.02, mat.oeil, cote * 0.042, -0.12, 0.495));
    // Défense recourbée vers le haut
    const defense = maille(new THREE.ConeGeometry(0.034, 0.16, 4), mat.defense, cote * 0.135, -0.12, 0.36);
    defense.rotation.z = -cote * 0.4;
    defense.rotation.x = -0.15;
    tete.add(defense);
    const oeil = new THREE.Group();
    oeil.position.set(cote * 0.15, 0.06, 0.15);
    oeil.rotation.y = cote * 0.75;
    oeil.add(boite(0.055, 0.045, 0.025, mat.oeil));
    // Arcade en biais : regard mauvais
    const arcade = boite(0.09, 0.026, 0.04, mat.sombre, 0, 0.034, 0.004);
    arcade.rotation.z = cote * 0.35;
    oeil.add(arcade);
    tete.add(oeil);
  }
  const oreilles = [-1, 1].map((cote) => {
    const pivot = new THREE.Group();
    pivot.position.set(cote * 0.15, 0.15, -0.06);
    const oreille = oreillePointue(0.075, 0.17, mat.poil, mat.sombre);
    oreille.rotation.z = -cote * 0.55;
    pivot.add(oreille);
    tete.add(pivot);
    return pivot;
  });

  // Petite queue fine terminée par un toupet
  queue.position.set(0, 0.1, -0.68);
  queue.add(
    maille(
      fuseau([
        { y: 0.02, rx: 0.028, rz: 0.028 },
        { y: -0.24, rx: 0.018, rz: 0.018 },
        { y: -0.3, rx: 0.034, rz: 0.034 },
        { y: -0.38, rx: 0.01, rz: 0.01 },
      ]),
      mat.sombre,
    ),
  );

  const pattes = creerPattes(tronc, [
    {
      x: 0.18, y: -0.12, z: 0.36, avant: true,
      haut: [
        { y: 0.13, rx: 0.1, rz: 0.15 },
        { y: -0.1, rx: 0.09, rz: 0.12 },
        { y: -0.27, rx: 0.068, rz: 0.08 },
      ],
      basY: -0.26, basZ: 0,
      bas: [
        { y: 0.02, rx: 0.068, rz: 0.078 },
        { y: -0.2, rx: 0.06, rz: 0.068 },
      ],
      pied: [0.14, 0.075, 0.16, -0.2225, 0.018],
      matHaut: mat.poil, matBas: mat.sombre, matPied: mat.sabot,
    },
    {
      x: 0.19, y: -0.1, z: -0.42, avant: false,
      haut: [
        { y: 0.15, rx: 0.1, rz: 0.17 },
        { y: -0.1, rx: 0.09, rz: 0.15, dz: 0.01 },
        { y: -0.28, rx: 0.07, rz: 0.085, dz: -0.03 },
      ],
      basY: -0.27, basZ: -0.03,
      bas: [
        { y: 0.02, rx: 0.068, rz: 0.08 },
        { y: -0.21, rx: 0.06, rz: 0.068, dz: 0.02 },
      ],
      pied: [0.14, 0.075, 0.16, -0.2325, 0.035],
      matHaut: mat.poil, matBas: mat.sombre, matPied: mat.sabot,
    },
  ]);

  return creerQuadrupede({
    ...s,
    oreilles,
    pattes,
    materiaux: Object.values(mat),
    hauteur: 1.25,
    hauteurTronc: HAUTEUR,
    longueurPatte: 0.52,
    couRepos: COU,
    couBas: 1.75,
    teteBas: 0.45,
    queueRepos: 0.3,
    queueFuite: 1.7,
    cadence: 1.05,
    seuilGalop: 4.5,
    partTeteBasse: 0.75,
    demiLargeur: 0.3,
    echelle: 1.2,
  });
}

// --- Lapin ------------------------------------------------------------------------------------

/** Redressement du buste quand le lapin est assis (radians) */
const LAPIN_ASSIS = 0.62;
/** Longueur d'une patte avant du lapin, de l'épaule au dessous du pied, en mètres */
const LAPIN_PATTE_AVANT = 0.2;

function creerLapin(): ModeleEnnemi {
  const K = COULEURS_ANIMAUX;
  const mat = {
    poil: creerMateriau(K.lapin),
    sombre: creerMateriau(K.lapinSombre),
    clair: creerMateriau(K.lapinClair),
    rose: creerMateriau(K.oreilleRose),
    nez: creerMateriau(K.nezLapin),
    patte: creerMateriau(K.patteLapin),
    oeil: creerMateriau(K.oeilSombre),
  };
  const objet = new THREE.Group();
  // `corps` saute et bascule sur le flanc à la mort
  const corps = new THREE.Group();
  corps.scale.setScalar(1.15);
  objet.add(corps);
  // `bassin` : pivot aux hanches ; le buste se redresse autour de lui quand le lapin s'assoit
  const bassin = new THREE.Group();
  bassin.position.set(0, 0.135, -0.08);
  corps.add(bassin);
  const D = 0.08;

  bassin.add(
    maille(
      fuseauCouche([
        { z: -0.18 + D, rx: 0.065, ry: 0.075, dy: -0.01 },
        { z: -0.09 + D, rx: 0.105, ry: 0.115 },
        { z: 0.04 + D, rx: 0.088, ry: 0.098, dy: 0.005 },
        { z: 0.15 + D, rx: 0.062, ry: 0.072, dy: 0.015 },
      ]),
      mat.poil,
    ),
  );
  // Ventre et poitrail clairs
  bassin.add(
    maille(
      fuseauCouche([
        { z: -0.08 + D, rx: 0.07, ry: 0.03, dy: -0.092 },
        { z: 0.06 + D, rx: 0.072, ry: 0.045, dy: -0.065 },
        { z: 0.15 + D, rx: 0.052, ry: 0.058, dy: -0.012 },
        { z: 0.19 + D, rx: 0.03, ry: 0.035, dy: 0.0 },
      ]),
      mat.clair,
    ),
  );
  // Queue ronde et claire
  bassin.add(maille(galet(0.048, 0.048, 0.048), mat.clair, 0, -0.03, -0.185 + D));

  // Tête ronde, museau clair, grands yeux sombres sur les côtés
  const tete = new THREE.Group();
  tete.position.set(0, 0.085, 0.17 + D);
  bassin.add(tete);
  tete.add(
    maille(
      fuseauCouche([
        { z: -0.08, rx: 0.048, ry: 0.055 },
        { z: -0.02, rx: 0.074, ry: 0.08 },
        { z: 0.045, rx: 0.064, ry: 0.068, dy: -0.008 },
        { z: 0.1, rx: 0.034, ry: 0.036, dy: -0.024 },
      ]),
      mat.poil,
    ),
  );
  tete.add(
    maille(
      fuseauCouche([
        { z: 0.01, rx: 0.05, ry: 0.03, dy: -0.052 },
        { z: 0.075, rx: 0.04, ry: 0.028, dy: -0.05 },
        { z: 0.108, rx: 0.026, ry: 0.02, dy: -0.046 },
      ]),
      mat.clair,
    ),
  );
  tete.add(boite(0.02, 0.016, 0.014, mat.nez, 0, -0.022, 0.106));
  for (const cote of [-1, 1]) tete.add(boite(0.014, 0.032, 0.032, mat.oeil, cote * 0.066, 0.012, 0.018));
  const oreilles = [-1, 1].map((cote) => {
    const oreille = new THREE.Group();
    oreille.position.set(cote * 0.032, 0.055, -0.035);
    oreille.rotation.z = -cote * 0.16;
    oreille.add(
      maille(
        fuseau([
          { y: -0.01, rx: 0.02, rz: 0.012 },
          { y: 0.11, rx: 0.036, rz: 0.015 },
          { y: 0.22, rx: 0.012, rz: 0.008 },
        ]),
        mat.sombre,
      ),
    );
    oreille.add(
      maille(
        fuseau([
          { y: 0.02, rx: 0.012, rz: 0.006, dz: 0.011 },
          { y: 0.11, rx: 0.024, rz: 0.006, dz: 0.013 },
          { y: 0.19, rx: 0.008, rz: 0.004, dz: 0.008 },
        ]),
        mat.rose,
      ),
    );
    tete.add(oreille);
    return oreille;
  });

  // Pattes avant fines : portées par le buste, elles pendent vers le sol
  const avant = [-1, 1].map((cote) => {
    const patte = new THREE.Group();
    patte.position.set(cote * 0.045, -0.04, 0.11 + D);
    patte.add(
      maille(
        fuseau([
          { y: 0.03, rx: 0.024, rz: 0.03 },
          { y: -0.18, rx: 0.018, rz: 0.02 },
        ]),
        mat.poil,
      ),
    );
    patte.add(boite(0.036, 0.022, 0.052, mat.patte, 0, -0.189, 0.012));
    bassin.add(patte);
    return patte;
  });
  // Pattes arrière : grosses cuisses rondes sur les flancs, longs pieds posés à plat
  const arriere = [-1, 1].map((cote) => {
    const cuisse = new THREE.Group();
    cuisse.position.set(cote * 0.088, 0.105, -0.07);
    cuisse.add(
      maille(
        fuseau([
          { y: 0.08, rx: 0.026, rz: 0.055 },
          { y: 0.035, rx: 0.044, rz: 0.092 },
          { y: -0.03, rx: 0.048, rz: 0.1 },
          { y: -0.09, rx: 0.03, rz: 0.06 },
        ]),
        mat.sombre,
      ),
    );
    cuisse.add(boite(0.046, 0.03, 0.14, mat.patte, 0, -0.09, 0.05));
    corps.add(cuisse);
    return cuisse;
  });

  const teinte = creerTeinte(Object.values(mat));
  let temps = Math.random() * 10;
  // Valeurs affichées, lissées d'une image à l'autre
  const pose = { redresse: LAPIN_ASSIS, oreilles: 0, avant: 0, arriere: 0, hauteur: 0 };

  return {
    objet,
    hauteur: 0.75,
    flash: () => teinte.flash(),
    mettreAJour(dt: number, p: PoseEnnemi) {
      temps += dt;
      const vivant = p.phase !== 'mort';
      const enBond = vivant && p.saut >= 0;
      const fuit = p.phase === 'fuite';
      // Assis et dressé au repos ; allongé, oreilles couchées, quand il file
      let cible = { redresse: LAPIN_ASSIS, oreilles: 0, avant: 0, arriere: 0, hauteur: 0 };
      let vitesseGeste = 8;
      if (enBond) {
        // Détente : pattes arrière jetées en arrière, pattes avant tendues, puis réception
        const s = p.saut;
        const arc = Math.sin(Math.PI * s);
        cible = { redresse: 0.3 - 0.45 * s, oreilles: fuit ? -1.1 : -0.5, avant: -1.1 + 0.9 * s, arriere: 1.0 * arc, hauteur: arc * (fuit ? 0.2 : 0.11) };
        vitesseGeste = 40;
      } else if (fuit || p.enMouvement) {
        cible = { ...cible, redresse: 0.15, oreilles: fuit ? -1.1 : -0.3, avant: -0.9 };
        vitesseGeste = 30;
      } else if (p.phase === 'recul') {
        cible = { ...cible, redresse: 0.9, oreilles: -1.2 };
        vitesseGeste = 26;
      } else if (!vivant) {
        cible = { ...cible, redresse: 0.1, oreilles: -1.0, avant: -0.6, arriere: 0.6 };
      } else if (Math.sin(temps * 0.5) > 0.35) {
        // Il se baisse pour grignoter, puis se redresse pour guetter
        cible = { ...cible, redresse: 0.42, oreilles: -0.25 };
        vitesseGeste = 4;
      } else {
        vitesseGeste = 4;
      }
      const lissage = Math.min(1, dt * vitesseGeste);
      for (const cle of Object.keys(pose) as Array<keyof typeof pose>) pose[cle] += (cible[cle] - pose[cle]) * lissage;

      bassin.rotation.x = -pose.redresse;
      // La tête reste à peu près à l'horizontale ; le nez frémit
      tete.rotation.x = pose.redresse * 0.85 + (vivant ? Math.sin(temps * 17) * 0.015 : 0);
      tete.rotation.y = vivant && !enBond && !fuit ? Math.sin(temps * 0.7) * 0.25 : 0;
      oreilles.forEach((oreille, i) => {
        const tressaille = vivant && Math.sin(temps * 1.7 + i * 2.4) > 0.95 ? 0.3 : 0;
        oreille.rotation.x = pose.oreilles - tressaille;
      });
      // Les pattes avant pendent à la verticale quel que soit le redressement ; buste bas, elles s'allongent vers
      // l'avant pour rester posées au sol ; en courant, elles se tendent
      const epaule = bassin.position.y + Math.sin(pose.redresse) * (0.11 + D) - Math.cos(pose.redresse) * 0.04;
      const allonge = epaule < LAPIN_PATTE_AVANT ? Math.acos(Math.max(0, epaule) / LAPIN_PATTE_AVANT) : 0;
      for (const patte of avant) patte.rotation.x = pose.redresse + Math.min(pose.avant, -allonge);
      for (const cuisse of arriere) cuisse.rotation.x = pose.arriere;

      let disparition = 0;
      let echelle = 1.15;
      if (!vivant) {
        const k = borner(p.tempsPhase / DUREE_MORT);
        const chute = adoucir(borner(k / 0.45));
        corps.rotation.z = chute * 1.5;
        corps.position.y = chute * 0.08;
        const fin = borner((k - 0.5) / 0.5);
        disparition = fin;
        echelle *= 1 - 0.5 * fin;
      } else {
        corps.rotation.z = 0;
        corps.position.y = pose.hauteur;
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

export function creerModeleAnimal(type: TypeAnimal): ModeleEnnemi {
  switch (type) {
    case 'cerf':
      return creerCerf();
    case 'lapin':
      return creerLapin();
    case 'renard':
      return creerRenard();
    case 'sanglier':
      return creerSanglier();
  }
}
