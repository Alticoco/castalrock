// Modèles de la mine, faits en code d'après docs/concepts/ (« Entrée de mine chaleureuse » et
// « Galerie minière low poly aux cristaux bleus ») : le portail extérieur collé à la paroi, et
// l'intérieur (sol, murs et plafond facettés, portiques, rails, lanternes, cristaux).
// Ne contient aucune règle de jeu : le plan vient de plan.ts, l'emplacement de monde/entreeMine.ts.
//
// Éclairage de l'intérieur : la lumière des lanternes (chaude) et des cristaux (bleue) est
// calculée une fois pour toutes et écrite dans la couleur de chaque facette. Aucune lampe réelle
// n'est donc nécessaire, à part celle qui suit le joueur (voir mine.ts).
// Murs et plafond n'ont qu'une face, tournée vers l'intérieur : vue de dehors (caméra
// au-dessus du plafond), la roche est invisible et on voit dans la galerie.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { hacher2D } from '../monde/bruit';
import type { EntreeMine } from '../monde/entreeMine';
import type { ObstacleCercle, ObstacleRectangle } from '../regles/deplacement';
import { plafondSommet, type PlanMine } from './plan';

type Teinte = (hex: number, centre: THREE.Vector3, normale: THREE.Vector3) => THREE.Color;

/** Accumule des triangles à faces plates, une couleur par face (donnée par `teinte`). */
class Tas {
  private positions: number[] = [];
  private couleurs: number[] = [];
  private teinte: Teinte;
  private ab = new THREE.Vector3();
  private ac = new THREE.Vector3();
  private n = new THREE.Vector3();
  private centre = new THREE.Vector3();

  constructor(teinte: Teinte) {
    this.teinte = teinte;
  }

  /** Ajoute un triangle ; `vers` : côté vers lequel sa face doit regarder (l'ordre des sommets est corrigé). */
  triangle(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, hex: number, vers?: THREE.Vector3): void {
    this.n.crossVectors(this.ab.subVectors(b, a), this.ac.subVectors(c, a));
    let q = b;
    let r = c;
    if (vers && this.n.dot(vers) < 0) {
      q = c;
      r = b;
      this.n.negate();
    }
    this.n.normalize();
    this.centre.copy(a).add(b).add(c).divideScalar(3);
    const couleur = this.teinte(hex, this.centre, this.n);
    for (const s of [a, q, r]) {
      this.positions.push(s.x, s.y, s.z);
      this.couleurs.push(couleur.r, couleur.g, couleur.b);
    }
  }

  /** Ajoute une forme de three (libérée ensuite), placée par la matrice `m`. */
  forme(forme: THREE.BufferGeometry, m: THREE.Matrix4, hex: number): void {
    const g = forme.index ? forme.toNonIndexed() : forme;
    g.applyMatrix4(m);
    const p = g.getAttribute('position');
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < p.count; i += 3) {
      this.triangle(a.fromBufferAttribute(p, i), b.fromBufferAttribute(p, i + 1), c.fromBufferAttribute(p, i + 2), hex);
    }
    if (g !== forme) g.dispose();
    forme.dispose();
  }

  geometrie(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.couleurs, 3));
    g.computeVertexNormals();
    g.computeBoundingBox();
    g.computeBoundingSphere();
    return g;
  }
}

const K = CONFIG.mine.couleurs;
const FER = 0x3a3436;
const DIRECTION_FACETTES = new THREE.Vector3(0.4, 0.8, 0.45).normalize();

/** Couleur d'une facette lumineuse (verre de lanterne, cristal) : la teinte, nuancée selon l'orientation de la face. */
function teinteLumineuse(): Teinte {
  const couleur = new THREE.Color();
  return (hex, _centre, normale) => couleur.setHex(hex).multiplyScalar(0.7 + 0.42 * Math.max(0, normale.dot(DIRECTION_FACETTES)));
}

/** Couleur d'une facette éclairée par les vraies lampes : la teinte, un peu plus claire ou sombre d'une face à l'autre. */
function teinteVariee(graine: number, variation: number): Teinte {
  const couleur = new THREE.Color();
  return (hex, c) => {
    const v = 1 + (hacher2D(Math.round(c.x * 31 + c.y * 17), Math.round(c.z * 29 + c.y * 7), graine) - 0.5) * 2 * variation;
    return couleur.setHex(hex).multiplyScalar(v);
  };
}

/** Matrice : `base`, puis position, puis rotation (radians, ordre XYZ), puis étirement. */
function pose(base: THREE.Matrix4, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx): THREE.Matrix4 {
  const locale = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)),
    new THREE.Vector3(sx, sy, sz),
  );
  return base.clone().multiply(locale);
}

const boite = (sx: number, sy: number, sz: number) => new THREE.BoxGeometry(sx, sy, sz);

/** Bloc de roche facetté irrégulier, de rayon 1 (à étirer). */
function bloc(graine: number, detail = 1, amplitude = 0.16): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const p = g.getAttribute('position');
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const k = hacher2D(Math.round(v.x * 1000) + Math.round(v.y * 1000) * 7919, Math.round(v.z * 1000), graine);
    v.multiplyScalar(1 + (k - 0.5) * 2 * amplitude);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  return g;
}

/** Lanterne suspendue : chaîne à maillons, toit pointu, verre lumineux entre quatre montants, socle. `yHaut` : point d'accroche. */
function lanterne(tas: Tas, lumineux: Tas, base: THREE.Matrix4, x: number, yHaut: number, z: number): void {
  for (let k = 0; k < 3; k++) {
    tas.forme(boite(k % 2 ? 0.03 : 0.08, 0.09, k % 2 ? 0.08 : 0.03), pose(base, x, yHaut - 0.045 - k * 0.08, z), FER);
  }
  tas.forme(new THREE.ConeGeometry(0.27, 0.17, 4), pose(base, x, yHaut - 0.32, z, 0, Math.PI / 4), FER);
  tas.forme(boite(0.4, 0.04, 0.4), pose(base, x, yHaut - 0.42, z), FER);
  lumineux.forme(boite(0.25, 0.3, 0.25), pose(base, x, yHaut - 0.59, z), K.lanterne);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) tas.forme(boite(0.04, 0.3, 0.04), pose(base, x + sx * 0.135, yHaut - 0.59, z + sz * 0.135), FER);
  tas.forme(boite(0.34, 0.05, 0.34), pose(base, x, yHaut - 0.765, z), FER);
  tas.forme(boite(0.18, 0.05, 0.18), pose(base, x, yHaut - 0.81, z), FER);
}

/** Voie ferrée le long de l'axe z de `base`, sur `longueur` mètres : deux rails et des traverses. */
function rails(tas: Tas, base: THREE.Matrix4, longueur: number): void {
  for (const s of [-1, 1]) tas.forme(boite(0.08, 0.1, longueur), pose(base, s * 0.42, 0.13, longueur / 2), K.rail);
  for (let z = 0.3; z < longueur; z += 0.9) tas.forme(boite(1.25, 0.08, 0.24), pose(base, 0, 0.04, z), K.boisSombre);
}

/** Wagonnet chargé de minerai, posé à l'origine de `base`, le long de son axe z. */
function wagonnet(tas: Tas, base: THREE.Matrix4): void {
  tas.forme(boite(0.8, 0.12, 1.3), pose(base, 0, 0.32, 0), K.rail);
  tas.forme(boite(1.0, 0.55, 1.5), pose(base, 0, 0.66, 0), K.boisSombre);
  tas.forme(boite(1.08, 0.08, 1.58), pose(base, 0, 0.96, 0), K.rail);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      tas.forme(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 8), pose(base, sx * 0.48, 0.2, sz * 0.45, 0, 0, Math.PI / 2), FER);
    }
  }
  tas.forme(bloc(11, 0, 0.2), pose(base, -0.15, 1.02, 0.3, 0, 0, 0, 0.36), K.paroi);
  tas.forme(bloc(12, 0, 0.2), pose(base, 0.2, 1.0, -0.2, 0, 0, 0, 0.32), 0x6a6670);
  tas.forme(bloc(13, 0, 0.2), pose(base, -0.1, 1.02, -0.45, 0, 0, 0, 0.26), K.paroi);
}

/**
 * Cadre de bois en travers d'un passage, poutre le long de l'axe x de `base` : poteaux sur leur
 * semelle, poutre qui déborde, têtes de poteau massives et grosses jambes de force.
 */
function cadre(tas: Tas, base: THREE.Matrix4, demi: number, hauteur: number, section: number): void {
  for (const s of [-1, 1]) {
    const x = s * (demi - 0.28);
    tas.forme(boite(section, hauteur, section), pose(base, x, hauteur / 2, 0), K.bois);
    tas.forme(boite(section * 1.35, 0.5, section * 1.35), pose(base, x, 0.25, 0), K.boisSombre);
    tas.forme(boite(section * 1.3, section * 1.35, section * 1.35), pose(base, x, hauteur, 0), K.bois);
    tas.forme(boite(section * 0.62, 1.3, section * 0.62), pose(base, s * (demi - 0.78), hauteur - 0.56, 0, 0, 0, s * -0.78), K.boisSombre);
  }
  tas.forme(boite(demi * 2 + 0.45, section * 1.05, section * 1.1), pose(base, 0, hauteur, 0), K.bois);
}

/** Bouquet de cristaux à six pans, pointus, sur un petit socle de roche ; dressés le long de l'axe y de `base`. */
function cristaux(tas: Tas, lumineux: Tas, base: THREE.Matrix4, echelle: number): void {
  tas.forme(bloc(51, 0, 0.2), pose(base, 0, 0, 0, 0, 0, 0, 0.24 * echelle, 0.12 * echelle, 0.2 * echelle), K.socleCristal);
  const prismes = [
    [0, 0, 0.09, 0.5, 0, 0],
    [0.12, 0.02, 0.07, 0.36, 0.5, 0.4],
    [-0.11, -0.03, 0.06, 0.3, -0.45, -0.5],
    [0.03, 0.1, 0.05, 0.24, 0.6, -0.2],
    [-0.04, -0.1, 0.045, 0.2, -0.6, 0.25],
  ];
  for (const [x, z, r, h, rx, rz] of prismes) {
    const m = pose(base, x * echelle, 0.04 * echelle, z * echelle, rx, x * 9, rz, echelle);
    lumineux.forme(new THREE.CylinderGeometry(r, r * 0.8, h, 6).translate(0, h / 2, 0), m, K.cristal);
    lumineux.forme(new THREE.ConeGeometry(r, r * 1.8, 6).translate(0, h + r * 0.9, 0), m, K.cristalClair);
  }
}

// --- Intérieur --------------------------------------------------------------------------------

interface Source {
  x: number;
  y: number;
  z: number;
  r: number;
  g: number;
  b: number;
  intensite: number;
  /** Distance à laquelle la lumière a perdu la moitié de sa force, et distance où elle s'éteint */
  rayon: number;
  portee: number;
}

export interface InterieurMine {
  groupe: THREE.Group;
  /** Lueur au sol de chaque cristal à récolter (identifiant de l'élément) : à cacher quand il est récolté */
  halos: Map<string, THREE.Mesh>;
}

/** Construit l'intérieur de la mine. Le groupe est déjà placé dans le monde. */
export function creerInterieurMine(plan: PlanMine): InterieurMine {
  const M = CONFIG.mine;
  const L = plan.largeur;
  const H = plan.profondeur;
  const ox = plan.origine.x;
  const oz = plan.origine.z;
  const creuse = (i: number, j: number) => i >= 0 && j >= 0 && i < L && j < H && plan.ouvert[j * L + i] === 1;
  const sources: Source[] = [];
  const chaude = (x: number, y: number, z: number) =>
    sources.push({ x, y, z, r: 1, g: 0.58, b: 0.22, intensite: M.intensiteLanterne, rayon: 2.2, portee: 10 });

  /** La lumière passe-t-elle de la source au point (pas de roche entre les deux) ? */
  function visible(sx: number, sz: number, x: number, z: number): boolean {
    const d = Math.hypot(x - sx, z - sz);
    const n = Math.ceil(d / 0.5);
    for (let k = 1; k < n; k++) {
      const t = k / n;
      if (d * (1 - t) < 0.9) break;
      if (!creuse(Math.floor(sx + (x - sx) * t), Math.floor(sz + (z - sz) * t))) return false;
    }
    return true;
  }

  const couleur = new THREE.Color();
  const lumiere = new THREE.Color();
  /** Teinte d'une facette : sa couleur, multipliée par la lumière reçue des lanternes et des cristaux. */
  const eclairee: Teinte = (hex, c, n) => {
    const x = c.x + n.x * 0.25;
    const y = c.y + n.y * 0.25;
    const z = c.z + n.z * 0.25;
    lumiere.setRGB(M.ambiance, M.ambiance * 0.93, M.ambiance * 0.9);
    for (const s of sources) {
      const d = Math.hypot(s.x - x, s.y - y, s.z - z);
      if (d >= s.portee || !visible(s.x, s.z, x, z)) continue;
      const f = (s.intensite / (1 + (d / s.rayon) ** 2)) * (1 - d / s.portee);
      lumiere.r += s.r * f;
      lumiere.g += s.g * f;
      lumiere.b += s.b * f;
    }
    const v = 1 + (hacher2D(Math.round(c.x * 31 + c.y * 17), Math.round(c.z * 29 + c.y * 7), plan.graine) - 0.5) * 0.16;
    return couleur.setHex(hex).multiply(lumiere).multiplyScalar(v);
  };

  const roche = new Tas(eclairee);
  const lumineux = new Tas(teinteLumineuse());
  const identite = new THREE.Matrix4();
  const point = new THREE.Vector3();

  // 1. Sources de lumière (repère de la grille), relevées avant de colorer la roche
  const basesPortiques = plan.portiques.map((p) => {
    const base = pose(identite, p.x - ox, 0, p.z - oz, 0, p.poutreX ? 0 : Math.PI / 2);
    point.set(p.lanterne * p.demiLargeur * 0.45, 2.2, 0).applyMatrix4(base);
    chaude(point.x, point.y, point.z);
    return base;
  });
  const basesPotences = plan.potences.map((p) => {
    const base = pose(identite, p.x - ox, 0, p.z - oz, 0, p.lacet);
    point.set(0, 2.05, 0.8).applyMatrix4(base);
    chaude(point.x, point.y, point.z);
    return base;
  });
  for (const c of plan.cristauxDecor) {
    sources.push({ x: c.x - ox, y: c.y, z: c.z - oz, r: 0.25, g: 0.72, b: 1, intensite: M.intensiteCristal * c.echelle, rayon: 1.5, portee: 6.5 });
  }
  const sx = plan.sortie.x - ox;
  sources.push({ x: sx, y: 1.7, z: 3.2, r: 0.8, g: 0.9, b: 1, intensite: 2, rayon: 2.6, portee: 11 });

  // 2. Sol, plafond et murs : un carré de sol et de plafond par case creusée, un pan de mur par côté de roche
  const sommet = (i: number, j: number, niveau: number): THREE.Vector3 => {
    const y = niveau === 0 ? 0 : niveau === 1 ? 1.25 : niveau === 2 ? 2.45 : plafondSommet(plan, i, j);
    // Les sommets du bas et du haut restent sur la grille (ils rejoignent le sol et le plafond)
    const a = niveau === 1 || niveau === 2 ? 0.44 : 0;
    return new THREE.Vector3(
      i + (hacher2D(i * 3 + niveau * 101, j * 5 + niveau * 57, plan.graine) - 0.5) * a,
      y,
      j + (hacher2D(i * 7 + niveau * 31 + 900, j * 3 + niveau * 11, plan.graine + 1) - 0.5) * a,
    );
  };
  const haut = new THREE.Vector3(0, 1, 0);
  const bas = new THREE.Vector3(0, -1, 0);
  const vers = new THREE.Vector3();
  const cotes: Array<[number, number, number, number, number, number]> = [
    // direction du mur (di, dj), puis les deux coins du côté : (ai, aj) et (bi, bj), relatifs à la case
    [1, 0, 1, 0, 1, 1],
    [-1, 0, 0, 0, 0, 1],
    [0, 1, 0, 1, 1, 1],
    [0, -1, 0, 0, 1, 0],
  ];
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < L; i++) {
      if (!creuse(i, j)) continue;
      const pair = (i + j) % 2 === 0;
      // Sol
      const s00 = new THREE.Vector3(i, 0, j);
      const s10 = new THREE.Vector3(i + 1, 0, j);
      const s01 = new THREE.Vector3(i, 0, j + 1);
      const s11 = new THREE.Vector3(i + 1, 0, j + 1);
      if (pair) {
        roche.triangle(s00, s10, s11, K.sol, haut);
        roche.triangle(s00, s11, s01, K.sol, haut);
      } else {
        roche.triangle(s00, s10, s01, K.sol, haut);
        roche.triangle(s10, s11, s01, K.sol, haut);
      }
      // Plafond
      const p00 = sommet(i, j, 3);
      const p10 = sommet(i + 1, j, 3);
      const p01 = sommet(i, j + 1, 3);
      const p11 = sommet(i + 1, j + 1, 3);
      if (pair) {
        roche.triangle(p00, p10, p01, K.plafond, bas);
        roche.triangle(p10, p11, p01, K.plafond, bas);
      } else {
        roche.triangle(p00, p10, p11, K.plafond, bas);
        roche.triangle(p00, p11, p01, K.plafond, bas);
      }
      // Murs : trois bandes de bas en haut, de plus en plus sombres
      for (const [di, dj, ai, aj, bi, bj] of cotes) {
        if (creuse(i + di, j + dj)) continue;
        vers.set(-di, 0, -dj);
        for (let niveau = 0; niveau < 3; niveau++) {
          const a0 = sommet(i + ai, j + aj, niveau);
          const b0 = sommet(i + bi, j + bj, niveau);
          const a1 = sommet(i + ai, j + aj, niveau + 1);
          const b1 = sommet(i + bi, j + bj, niveau + 1);
          const hex = niveau === 2 ? K.plafond : K.paroi;
          if ((i + j + niveau) % 2 === 0) {
            roche.triangle(a0, b0, b1, hex, vers);
            roche.triangle(a0, b1, a1, hex, vers);
          } else {
            roche.triangle(a0, b0, a1, hex, vers);
            roche.triangle(b0, b1, a1, hex, vers);
          }
        }
      }
    }
  }

  // Éboulis au pied des parois, là où le passage est assez large : petits blocs serrés contre le mur
  for (let j = 0; j < H; j++) {
    for (let i = 0; i < L; i++) {
      if (!creuse(i, j)) continue;
      for (const [di, dj] of cotes) {
        if (creuse(i + di, j + dj) || !creuse(i - di, j - dj)) continue;
        const tirage = hacher2D(i * 13 + di * 5, j * 17 + dj * 3, plan.graine + 7);
        if (tirage > 0.16) continue;
        const r = 0.16 + tirage * 1.2;
        const leLong = (hacher2D(i * 5, j * 9, plan.graine + 8) - 0.5) * 0.6;
        roche.forme(
          bloc(60 + ((i * 7 + j * 3) % 9), 0, 0.22),
          pose(identite, i + 0.5 + di * (0.5 - r * 0.7) + dj * leLong, r * 0.45, j + 0.5 + dj * (0.5 - r * 0.7) + di * leLong, 0, tirage * 40, 0, r, r * 0.75, r),
          tirage < 0.05 ? K.plafond : K.paroi,
        );
      }
    }
  }

  // 3. Portiques des galeries et potences des salles, avec leur lanterne
  plan.portiques.forEach((p, k) => {
    const base = basesPortiques[k];
    cadre(roche, base, p.demiLargeur, 2.85, 0.3);
    lanterne(roche, lumineux, base, p.lanterne * p.demiLargeur * 0.45, 2.7, 0);
  });
  basesPotences.forEach((base) => {
    roche.forme(boite(0.24, 2.75, 0.24), pose(base, 0, 1.375, 0), K.bois);
    roche.forme(boite(0.16, 0.16, 1.05), pose(base, 0, 2.62, 0.42), K.bois);
    roche.forme(boite(0.12, 0.75, 0.12), pose(base, 0, 2.3, 0.3, 0.78), K.boisSombre);
    lanterne(roche, lumineux, base, 0, 2.55, 0.8);
  });

  // 4. Rails et wagonnet
  const R = plan.rails;
  const longueurRails = Math.hypot(R.x1 - R.x0, R.z1 - R.z0);
  rails(roche, pose(identite, R.x0 - ox, 0, R.z0 - oz, 0, Math.atan2(R.x1 - R.x0, R.z1 - R.z0)), longueurRails);
  wagonnet(roche, pose(identite, plan.wagonnet.x - ox, 0, plan.wagonnet.z - oz));

  // 5. Cristaux de décor incrustés dans les parois, penchés vers la galerie
  for (const c of plan.cristauxDecor) {
    cristaux(roche, lumineux, pose(identite, c.x - ox, c.y, c.z - oz, 0, c.lacet).multiply(new THREE.Matrix4().makeRotationX(1.0)), c.echelle);
  }

  // 6. Sortie : un cadre de bois et la lumière du jour au fond de l'alcôve
  cadre(roche, pose(identite, sx, 0, 4.05), 2, 2.85, 0.34);
  lumineux.forme(new THREE.PlaneGeometry(4, 3.5), pose(identite, sx, 1.75, 2.06), K.jour);

  const groupe = new THREE.Group();
  groupe.name = 'mine';
  groupe.position.set(ox, plan.altitude, oz);
  const meshRoche = new THREE.Mesh(roche.geometrie(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  meshRoche.name = 'mine roche';
  const meshLumineux = new THREE.Mesh(lumineux.geometrie(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  meshLumineux.name = 'mine lumières';
  groupe.add(meshRoche, meshLumineux);

  // 7. Lueur au sol sous chaque cristal à récolter
  const halos = new Map<string, THREE.Mesh>();
  const materiauHalo = new THREE.MeshBasicMaterial({
    color: K.lueurCristal,
    transparent: true,
    opacity: 0.1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  for (const e of plan.elements) {
    if (e.type !== 'cristal-bleu') continue;
    // Deux disques l'un sur l'autre : la lueur est plus forte près du cristal
    const halo = new THREE.Mesh(new THREE.CircleGeometry(1.6 * e.echelle, 16).rotateX(-Math.PI / 2), materiauHalo);
    const coeur = new THREE.Mesh(new THREE.CircleGeometry(0.95 * e.echelle, 12).rotateX(-Math.PI / 2), materiauHalo);
    coeur.position.y = 0.01;
    halo.add(coeur);
    halo.position.set(e.x - ox, 0.04, e.z - oz);
    halos.set(e.id, halo);
    groupe.add(halo);
  }
  return { groupe, halos };
}

// --- Portail extérieur ------------------------------------------------------------------------

export interface PortailMine {
  groupe: THREE.Group;
  /** Blocs de roche, poteaux, wagonnet, panneau : obstacles dans le repère du monde */
  cercles: ObstacleCercle[];
  /** Le fond du portail : on ne traverse pas la paroi */
  rectangles: ObstacleRectangle[];
  /** Point d'interaction (devant l'ouverture) et point où l'on ressort, dos à la paroi */
  seuil: { x: number; z: number };
  retour: { x: number; z: number; orientation: number };
}

/** Planche « MINE » peinte, pour le panneau. */
function textePanneau(): THREE.Texture {
  const toile = document.createElement('canvas');
  toile.width = 256;
  toile.height = 96;
  const c = toile.getContext('2d');
  if (c) {
    c.fillStyle = '#c98a4a';
    c.fillRect(0, 0, 256, 96);
    c.fillStyle = '#3a2416';
    c.font = 'bold 60px Georgia, serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('MINE', 128, 52);
  }
  const texture = new THREE.CanvasTexture(toile);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** Construit le portail : cadre de bois, lanterne, rails, wagonnet et panneau, dans un massif de roche collé à la paroi. */
export function creerPortailMine(e: EntreeMine): PortailMine {
  const angle = Math.atan2(e.dx, e.dz);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  /** Repère du portail (x : de côté, z : vers la paroi) -> monde */
  const versMonde = (lx: number, lz: number) => ({ x: e.x + lx * cos + lz * sin, z: e.z - lx * sin + lz * cos });

  const roche = new Tas(teinteVariee(77, 0.08));
  const lumineux = new Tas(teinteLumineuse());
  const sombre = new Tas((hex) => new THREE.Color().setHex(hex));
  const identite = new THREE.Matrix4();
  // Hauteur du massif : celle de la paroi, dans des limites raisonnables
  const hm = Math.max(5, Math.min(10, e.denivele));

  // Massif : un bloc de chaque côté, un linteau, un bloc au-dessus et un derrière
  roche.forme(bloc(21), pose(identite, -4.5, hm * 0.28, 1.2, 0, 0.3, 0, 3.0, hm * 0.62, 3.0), K.rocheDehors);
  roche.forme(bloc(22), pose(identite, 4.6, hm * 0.26, 1.3, 0, 1.1, 0, 3.1, hm * 0.58, 3.0), K.rocheDehors);
  roche.forme(boite(5.6, 1.3, 1.5), pose(identite, 0, 4.25, 0.95, 0.08, 0, 0.03), K.rocheDehors);
  roche.forme(bloc(23), pose(identite, 0.3, 3.6 + hm * 0.33, 2.7, 0, 0.7, 0, 5.2, hm * 0.33, 2.7), K.rocheDehors);
  roche.forme(bloc(24), pose(identite, 0, hm * 0.4, 5.4, 0, 0, 0, 6.2, hm * 0.72, 3.0), K.rocheDehors);
  // Petits blocs au pied
  for (const [x, z, r, g] of [[-2.6, -1.9, 0.5, 31], [2.7, -1.6, 0.42, 32], [-3.6, -3.9, 0.36, 33], [1.5, 0.4, 0.26, 34], [-1.45, 0.5, 0.3, 35]]) {
    roche.forme(bloc(g, 0, 0.22), pose(identite, x, r * 0.35, z, 0, g, 0, r, r * 0.8, r), K.rocheDehors);
  }

  // Galerie sombre derrière le cadre
  const coin = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const pan = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, hex: number, vers: THREE.Vector3) => {
    sombre.triangle(a, b, c, hex, vers);
    sombre.triangle(a, c, d, hex, vers);
  };
  const lg = 1.66;
  const ht = 3.4;
  const fd = 1.7;
  pan(coin(-lg, 0, 0), coin(-lg, 0, fd), coin(-lg, ht, fd), coin(-lg, ht, 0), 0x2a201c, new THREE.Vector3(1, 0, 0));
  pan(coin(lg, 0, 0), coin(lg, 0, fd), coin(lg, ht, fd), coin(lg, ht, 0), 0x2a201c, new THREE.Vector3(-1, 0, 0));
  pan(coin(-lg, ht, 0), coin(lg, ht, 0), coin(lg, ht, fd), coin(-lg, ht, fd), 0x1c1512, new THREE.Vector3(0, -1, 0));
  pan(coin(-lg, 0, fd), coin(lg, 0, fd), coin(lg, ht, fd), coin(-lg, ht, fd), 0x070505, new THREE.Vector3(0, 0, -1));

  // Bouche de la galerie : des blocs de roche resserrent l'ouverture derrière le cadre, comme une voûte
  for (const s of [-1, 1]) {
    roche.forme(bloc(41 + s, 0, 0.2), pose(identite, s * 1.75, 0.9, 0.55, 0, s, 0, 0.55, 1.2, 0.5), K.rocheDehors);
    roche.forme(bloc(44 + s, 0, 0.2), pose(identite, s * 1.45, 2.95, 0.6, 0, s * 2, s * 0.5, 0.75, 0.6, 0.5), K.rocheDehors);
  }
  roche.forme(bloc(47, 0, 0.2), pose(identite, 0, 3.35, 0.65, 0, 0.4, 0, 1.1, 0.4, 0.5), K.rocheDehors);

  // Cadre de bois, potence et lanterne (à droite, comme sur l'image ; le bras avance vers le chemin pour sortir du massif)
  cadre(roche, pose(identite, 0, 0, -0.1), 2.18, 3.5, 0.44);
  roche.forme(boite(0.16, 0.16, 1.1), pose(identite, -1.9, 2.85, -0.75), K.bois);
  roche.forme(boite(0.12, 0.7, 0.12), pose(identite, -1.9, 2.55, -0.6, -0.78), K.boisSombre);
  lanterne(roche, lumineux, identite, -1.9, 2.77, -1.15);

  // Chemin de terre, rails, wagonnet garé à côté, panneau
  roche.forme(new THREE.PlaneGeometry(3.2, 5.4).rotateX(-Math.PI / 2), pose(identite, 0, 0.04, -2.5), K.terre);
  rails(roche, pose(identite, 0, 0.02, -5), 6.6);
  wagonnet(roche, pose(identite, -3.1, 0, -3.5, 0, 0.45));
  roche.forme(boite(0.14, 1.9, 0.14), pose(identite, 3.3, 0.95, -3.2), K.boisSombre);
  roche.forme(boite(1.3, 0.5, 0.08), pose(identite, 3.3, 1.75, -3.26), K.bois);

  const groupe = new THREE.Group();
  groupe.name = 'portail de la mine';
  groupe.position.set(e.x, e.y, e.z);
  groupe.rotation.y = angle;
  const meshRoche = new THREE.Mesh(roche.geometrie(), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  meshRoche.castShadow = true;
  meshRoche.receiveShadow = true;
  const meshLumineux = new THREE.Mesh(lumineux.geometrie(), new THREE.MeshBasicMaterial({ vertexColors: true }));
  const meshSombre = new THREE.Mesh(sombre.geometrie(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  const texte = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.42), new THREE.MeshLambertMaterial({ map: textePanneau() }));
  texte.position.set(3.3, 1.75, -3.305);
  texte.rotation.y = Math.PI;
  const lampe = new THREE.PointLight(K.lanterne, CONFIG.mine.entree.lumiereLanterne, 14, 2);
  lampe.position.set(-1.9, 2.2, -1.5);
  groupe.add(meshRoche, meshLumineux, meshSombre, texte, lampe);

  const cercle = (lx: number, lz: number, rayon: number): ObstacleCercle => ({ ...versMonde(lx, lz), rayon });
  const fond = versMonde(0, 4.4);
  const retour = versMonde(0, -2.6);
  return {
    groupe,
    cercles: [cercle(-4.5, 1.2, 2.6), cercle(4.6, 1.3, 2.6), cercle(-1.9, -0.1, 0.3), cercle(1.9, -0.1, 0.3), cercle(-3.1, -3.5, 0.85), cercle(3.3, -3.2, 0.2)],
    rectangles: [{ x: fond.x, z: fond.z, demiLargeur: 4.5, demiProfondeur: 3, angle }],
    seuil: versMonde(0, 0.5),
    retour: { ...retour, orientation: angle + Math.PI },
  };
}
