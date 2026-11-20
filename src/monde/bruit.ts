// Bruit 2D à graine (simplex), fbm et bruit « crête ».
// Pur : aucun import de three, aucun Math.random().
// Méthode reprise de makeNoise / fbm d'un projet précédent.

import { creerAleatoire } from '../regles/aleatoire';

/** Fonction de bruit : renvoie une valeur environ dans [-1, 1], continue et lisse. */
export type Bruit2D = (x: number, y: number) => number;

const F2 = 0.5 * (Math.sqrt(3) - 1);
const G2 = (3 - Math.sqrt(3)) / 6;
// 8 directions de gradient
const GX = [1, -1, 1, -1, 1, -1, 0, 0];
const GY = [1, 1, -1, -1, 0, 0, 1, -1];

/** Crée un bruit simplex 2D dont la forme dépend uniquement de la graine. */
export function creerBruit2D(graine: number): Bruit2D {
  const alea = creerAleatoire(graine);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  // Mélange de Fisher-Yates
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(alea.suivant() * (i + 1));
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];

  return (x: number, y: number): number => {
    const s = (x + y) * F2;
    const i = Math.floor(x + s);
    const j = Math.floor(y + s);
    const t = (i + j) * G2;
    const x0 = x - (i - t);
    const y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    let n = 0;
    let tt = 0.5 - x0 * x0 - y0 * y0;
    if (tt > 0) {
      const g = perm[ii + perm[jj]] & 7;
      tt *= tt;
      n += tt * tt * (GX[g] * x0 + GY[g] * y0);
    }
    tt = 0.5 - x1 * x1 - y1 * y1;
    if (tt > 0) {
      const g = perm[ii + i1 + perm[jj + j1]] & 7;
      tt *= tt;
      n += tt * tt * (GX[g] * x1 + GY[g] * y1);
    }
    tt = 0.5 - x2 * x2 - y2 * y2;
    if (tt > 0) {
      const g = perm[ii + 1 + perm[jj + 1]] & 7;
      tt *= tt;
      n += tt * tt * (GX[g] * x2 + GY[g] * y2);
    }
    return 70 * n;
  };
}

/**
 * Bruit fractal (fbm) : somme de plusieurs octaves de plus en plus fines.
 * Résultat environ dans [-1, 1] (en pratique rarement au-delà de ±0,7).
 */
export function fbm(bruit: Bruit2D, x: number, y: number, octaves: number): number {
  let amplitude = 1;
  let frequence = 1;
  let somme = 0;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    somme += amplitude * bruit(x * frequence, y * frequence);
    total += amplitude;
    amplitude *= 0.5;
    frequence *= 2.03; // pas exactement 2 : évite que les octaves s'alignent
  }
  return somme / total;
}

/**
 * Bruit « crête » (ridged) : lignes fines et nettes là où le bruit passe par zéro.
 * Résultat dans [0, 1] ; 1 = sommet de la crête. Sert aux chaînes de montagnes.
 */
export function fbmCrete(bruit: Bruit2D, x: number, y: number, octaves: number): number {
  let amplitude = 0.5;
  let frequence = 1;
  let poids = 1;
  let somme = 0;
  let total = 0;
  for (let o = 0; o < octaves; o++) {
    let s = 1 - Math.abs(bruit(x * frequence, y * frequence));
    s *= s;
    s *= poids; // les détails n'apparaissent que sur les crêtes déjà hautes
    poids = Math.min(1, Math.max(0, s * 2));
    somme += s * amplitude;
    total += amplitude;
    amplitude *= 0.5;
    frequence *= 2.03;
  }
  return somme / total;
}

/** Nombre pseudo-aléatoire dans [0, 1[ attaché à une case entière (x, y) et une graine. */
export function hacher2D(x: number, y: number, graine: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(y | 0, 0x165667b1) ^ Math.imul(graine | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Transition douce de 0 (x <= a) à 1 (x >= b). */
export function lisser(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Interpolation linéaire entre a et b. */
export function melanger(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
