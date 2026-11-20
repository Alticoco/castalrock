// Construction du maillage three d'un chunk de terrain : style low poly à faces plates.
// Grille régulière, 2 triangles par case, géométrie non indexée (chaque face a ses propres
// sommets, donc sa propre couleur), couleurs selon le biome, la pente et l'altitude.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { BIOMES, INDICE_BIOME } from './biomes';
import { creerBruit2D, fbm, hacher2D, lisser } from './bruit';
import type { Terrain } from './terrain';

const NB = BIOMES.length;
const I_MARAIS = INDICE_BIOME.marais;

// Couleurs converties une fois en espace linéaire (celui des couleurs de sommets)
function versLineaire(hex: number): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}
const COULEURS_SOL = BIOMES.map((b) => versLineaire(b.couleurSol));
const COULEURS_ROCHE = BIOMES.map((b) => versLineaire(b.couleurRoche));
const SABLE = versLineaire(CONFIG.couleurs.sable);
const SABLE_MOUILLE = versLineaire(CONFIG.couleurs.sableMouille);
const NEIGE = versLineaire(CONFIG.couleurs.neige);

/** Matériau partagé par tous les chunks : faces plates, couleurs par sommet. */
export function creerMateriauTerrain(): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
}

/** Construit la géométrie du chunk (cx, cz). Les positions sont relatives au coin du chunk. */
export function construireGeometrieChunk(terrain: Terrain, cx: number, cz: number): THREE.BufferGeometry {
  const taille = CONFIG.monde.tailleChunk;
  const pas = CONFIG.monde.pasGrille;
  const n = Math.round(taille / pas);
  const n1 = n + 1;
  const x0 = cx * taille;
  const z0 = cz * taille;
  const niveauEau = terrain.niveauEau;
  const C = CONFIG.couleurs;
  // Bruit des grandes plages d'herbe claire ou sombre (le même pour tous les chunks d'une graine)
  const bruitHerbe = creerBruit2D(terrain.graine + 81);

  // Hauteurs et poids des biomes aux sommets de la grille
  const h = new Float32Array(n1 * n1);
  const w = new Float32Array(n1 * n1 * NB);
  const poids: number[] = new Array(NB).fill(0);
  for (let j = 0; j < n1; j++) {
    for (let i = 0; i < n1; i++) {
      const x = x0 + i * pas;
      const z = z0 + j * pas;
      const k = j * n1 + i;
      h[k] = terrain.hauteurBrute(x, z);
      terrain.poidsBiomes(x, z, poids);
      for (let b = 0; b < NB; b++) w[k * NB + b] = poids[b];
    }
  }

  const nbSommets = n * n * 2 * 3;
  const positions = new Float32Array(nbSommets * 3);
  const normales = new Float32Array(nbSommets * 3);
  const couleurs = new Float32Array(nbSommets * 3);
  let o = 0; // indice d'écriture (en nombres)

  // Écrit un triangle (coins a, b, c donnés par indices de grille) et sa couleur
  const triangle = (ia: number, ja: number, ib: number, jb: number, ic: number, jc: number, graineFace: number) => {
    const ka = ja * n1 + ia;
    const kb = jb * n1 + ib;
    const kc = jc * n1 + ic;
    const ax = ia * pas, ay = h[ka], az = ja * pas;
    const bx = ib * pas, by = h[kb], bz = jb * pas;
    const cxp = ic * pas, cy = h[kc], czp = jc * pas;

    // Normale de la face
    const ux = bx - ax, uy = by - ay, uz = bz - az;
    const vx = cxp - ax, vy = cy - ay, vz = czp - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
    nx /= l;
    ny /= l;
    nz /= l;

    // Couleur : mélange des biomes, roche sur les pentes, neige en altitude, sable au bord de l'eau
    let r = 0, g = 0, bl = 0, rr = 0, rg = 0, rb = 0, marais = 0;
    for (let b = 0; b < NB; b++) {
      const p = (w[ka * NB + b] + w[kb * NB + b] + w[kc * NB + b]) / 3;
      if (p < 0.002) continue;
      const s = COULEURS_SOL[b];
      const q = COULEURS_ROCHE[b];
      r += s[0] * p; g += s[1] * p; bl += s[2] * p;
      rr += q[0] * p; rg += q[1] * p; rb += q[2] * p;
      if (b === I_MARAIS) marais = p;
    }
    const hm = (ay + by + cy) / 3;
    // Plages d'herbe : plus claire et jaune d'un côté, plus sombre et bleutée de l'autre
    const fh = C.frequenceVariationHerbe;
    const th =
      fbm(bruitHerbe, (x0 + (ax + bx + cxp) / 3) * fh, (z0 + (az + bz + czp) / 3) * fh, 2) * C.variationHerbe;
    r *= 1 + th * 1.5; g *= 1 + th * 0.7; bl *= 1 - th * 0.8;
    const roche = lisser(0.84, 0.66, ny); // de ~33° à ~49° : l'herbe laisse place à la roche
    r += (rr - r) * roche; g += (rg - g) * roche; bl += (rb - bl) * roche;
    const neige = lisser(C.altitudeNeige, C.altitudeNeige + 15, hm) * (1 - roche * 0.7);
    r += (NEIGE[0] - r) * neige; g += (NEIGE[1] - g) * neige; bl += (NEIGE[2] - bl) * neige;
    const sable = (1 - lisser(niveauEau + 0.4, niveauEau + 1.3, hm)) * (1 - marais * 0.85);
    const sc = hm < niveauEau - 0.3 ? SABLE_MOUILLE : SABLE;
    r += (sc[0] - r) * sable; g += (sc[1] - g) * sable; bl += (sc[2] - bl) * sable;
    // Petite variation de luminosité d'une face à l'autre (stable : dépend de la position)
    const v = 1 + (hacher2D(cx * n + ia, (cz * n + ja) * 2 + graineFace, terrain.graine) - 0.5) * 2 * C.variationFaces;
    r *= v; g *= v; bl *= v;

    ecrireSommet(ax, ay, az, nx, ny, nz, r, g, bl);
    ecrireSommet(bx, by, bz, nx, ny, nz, r, g, bl);
    ecrireSommet(cxp, cy, czp, nx, ny, nz, r, g, bl);
  };

  const ecrireSommet = (
    x: number, y: number, z: number,
    nx: number, ny: number, nz: number,
    r: number, g: number, b: number,
  ) => {
    positions[o] = x; positions[o + 1] = y; positions[o + 2] = z;
    normales[o] = nx; normales[o + 1] = ny; normales[o + 2] = nz;
    couleurs[o] = r; couleurs[o + 1] = g; couleurs[o + 2] = b;
    o += 3;
  };

  // Même découpage que terrain.hauteur() : A = (00, 11, 10), B = (00, 01, 11)
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      triangle(i, j, i + 1, j + 1, i + 1, j, 0);
      triangle(i, j, i, j + 1, i + 1, j + 1, 1);
    }
  }

  const geometrie = new THREE.BufferGeometry();
  geometrie.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometrie.setAttribute('normal', new THREE.BufferAttribute(normales, 3));
  geometrie.setAttribute('color', new THREE.BufferAttribute(couleurs, 3));
  geometrie.computeBoundingBox();
  geometrie.computeBoundingSphere();
  return geometrie;
}

/** Crée le mesh d'un chunk, placé dans le monde, qui reçoit et projette les ombres. */
export function creerMeshChunk(
  terrain: Terrain,
  cx: number,
  cz: number,
  materiau: THREE.Material,
): THREE.Mesh {
  const mesh = new THREE.Mesh(construireGeometrieChunk(terrain, cx, cz), materiau);
  mesh.position.set(cx * CONFIG.monde.tailleChunk, 0, cz * CONFIG.monde.tailleChunk);
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  mesh.matrixAutoUpdate = false; // le chunk ne bouge jamais
  mesh.updateMatrix();
  mesh.name = `chunk ${cx},${cz}`;
  return mesh;
}
