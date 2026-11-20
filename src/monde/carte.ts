// Couleurs du terrain vu de dessus pour la mini-carte. Pur : aucun import de three.
// Un pixel de la carte = un point du monde : eau, sable, herbe du biome, roche sur les pentes, neige en altitude,
// place du village en brun. Un léger ombrage (lumière venue du nord-ouest) fait ressortir le relief.

import { CONFIG } from '../config';
import { BIOMES } from './biomes';
import { lisser } from './bruit';
import type { Terrain } from './terrain';

const NB = BIOMES.length;
const poids: number[] = new Array(NB).fill(0);

// Lumière venue du nord-ouest et d'en haut (normalisée)
const LUMIERE = { x: -0.45, y: 0.78, z: -0.45 };

function composantes(c: number): [number, number, number] {
  return [(c >> 16) & 255, (c >> 8) & 255, c & 255];
}

const SOLS = BIOMES.map((b) => composantes(b.couleurSol));
const ROCHES = BIOMES.map((b) => composantes(b.couleurRoche));
const SABLE = composantes(CONFIG.couleurs.sable);
const NEIGE = composantes(CONFIG.couleurs.neige);
const EAU = composantes(CONFIG.couleurs.eau);
const SENTIER = composantes(CONFIG.miniCarte.couleurs.sentier);

function melangerCouleur(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Couleur (r, g, b entre 0 et 255) du terrain en (x, z), vu de dessus. */
export function couleurCarte(terrain: Terrain, x: number, z: number): [number, number, number] {
  const h = terrain.hauteur(x, z);
  const eau = terrain.niveauEau;
  if (h < eau) {
    // Plus c'est profond, plus c'est sombre
    const k = 1 - Math.min(0.45, (eau - h) / 9);
    return [EAU[0] * k, EAU[1] * k, EAU[2] * k];
  }
  terrain.poidsBiomes(x, z, poids);
  let b = 0;
  for (let i = 1; i < NB; i++) if (poids[i] > poids[b]) b = i;
  let c = SOLS[b];
  const n = terrain.normale(x, z);
  const pente = Math.acos(Math.min(1, n.y)) / (Math.PI / 2);
  c = melangerCouleur(c, ROCHES[b], lisser(0.2, 0.4, pente));
  if (h > CONFIG.couleurs.altitudeNeige) c = melangerCouleur(c, NEIGE, lisser(0, 12, h - CONFIG.couleurs.altitudeNeige));
  // Rivage de sable
  if (h < eau + 0.7) c = melangerCouleur(c, SABLE, 1 - lisser(0.1, 0.7, h - eau));
  // Place du village
  if (Math.hypot(x, z) < CONFIG.miniCarte.rayonPlace) c = SENTIER;
  const ombre = 0.62 + 0.5 * Math.max(0, n.x * LUMIERE.x + n.y * LUMIERE.y + n.z * LUMIERE.z);
  return [c[0] * ombre, c[1] * ombre, c[2] * ombre];
}

/**
 * Remplit `donnees` (RGBA, `pixels` × `pixels`) avec la tuile (ti, tj) : le carré du monde
 * [ti * taille, (ti + 1) * taille[ × [tj * taille, (tj + 1) * taille[, échantillonné au centre de chaque pixel.
 */
export function remplirTuile(
  terrain: Terrain,
  ti: number,
  tj: number,
  donnees: Uint8ClampedArray,
  taille = CONFIG.miniCarte.tailleTuile,
  pixels = CONFIG.miniCarte.pixelsTuile,
): void {
  const pas = taille / pixels;
  for (let py = 0; py < pixels; py++) {
    for (let px = 0; px < pixels; px++) {
      const [r, g, b] = couleurCarte(terrain, ti * taille + (px + 0.5) * pas, tj * taille + (py + 0.5) * pas);
      const o = (py * pixels + px) * 4;
      donnees[o] = r;
      donnees[o + 1] = g;
      donnees[o + 2] = b;
      donnees[o + 3] = 255;
    }
  }
}
