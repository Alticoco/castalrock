// Chargement et déchargement des chunks de terrain autour d'un point (le joueur),
// avec leur eau et leur décor.
// Les chunks proches sont construits d'abord ; au plus quelques-uns par image pour éviter
// les saccades. Les chunks lointains sont retirés de la scène et leur mémoire libérée.

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { Eau } from './eau';
import { creerMateriauTerrain, creerMeshChunk } from './maillage';
import type { RenduDecor } from './renduDecor';
import type { RenduRuines } from './renduRuines';
import type { Terrain } from './terrain';

export interface GestionnaireChunks {
  /** À appeler à chaque image avec la position du joueur (ou de la caméra). */
  mettreAJour(x: number, z: number): void;
  /** Change la distance de chargement (en chunks) ; les chunks en trop sont retirés dès la prochaine image. */
  definirRayon(rayonChargement: number, rayonDechargement: number): void;
  /** Nombre de chunks actuellement affichés. */
  nombreCharges(): number;
  /** Nombre de chunks encore à construire. */
  nombreEnAttente(): number;
  /** Retire tout de la scène et libère la mémoire. */
  liberer(): void;
}

const cle = (cx: number, cz: number) => `${cx},${cz}`;

export function creerGestionnaireChunks(
  scene: THREE.Scene,
  terrain: Terrain,
  /** Ce qui apparaît et disparaît avec chaque chunk de terrain */
  accompagnement: { eau?: Eau; decor?: RenduDecor; ruines?: RenduRuines } = {},
): GestionnaireChunks {
  const { eau, decor, ruines } = accompagnement;
  const M = CONFIG.monde;
  const materiau = creerMateriauTerrain();
  const charges = new Map<string, { cx: number; cz: number; mesh: THREE.Mesh }>();
  // File des chunks à construire, triée du plus loin au plus proche (on prend à la fin)
  let file: { cx: number; cz: number; d2: number }[] = [];
  let rayonChargement: number = M.rayonChargement;
  let rayonDechargement: number = M.rayonDechargement;
  let dernierCx = NaN;
  let dernierCz = NaN;

  function construire(cx: number, cz: number): void {
    const k = cle(cx, cz);
    if (charges.has(k)) return;
    const mesh = creerMeshChunk(terrain, cx, cz, materiau);
    scene.add(mesh);
    charges.set(k, { cx, cz, mesh });
    eau?.ajouterChunk(cx, cz, mesh.geometry.boundingBox?.min.y ?? -Infinity);
    decor?.ajouterChunk(cx, cz);
    ruines?.ajouterChunk(cx, cz);
  }

  function decharger(k: string): void {
    const c = charges.get(k);
    if (!c) return;
    scene.remove(c.mesh);
    c.mesh.geometry.dispose();
    charges.delete(k);
    eau?.retirerChunk(c.cx, c.cz);
    decor?.retirerChunk(c.cx, c.cz);
    ruines?.retirerChunk(c.cx, c.cz);
  }

  function mettreAJour(x: number, z: number): void {
    const pcx = Math.floor(x / M.tailleChunk);
    const pcz = Math.floor(z / M.tailleChunk);

    if (pcx !== dernierCx || pcz !== dernierCz) {
      dernierCx = pcx;
      dernierCz = pcz;
      decor?.definirCentre(pcx, pcz);
      // Décharger les chunks trop loin
      const rd2 = rayonDechargement * rayonDechargement;
      for (const [k, c] of charges) {
        const dx = c.cx - pcx;
        const dz = c.cz - pcz;
        if (dx * dx + dz * dz > rd2) decharger(k);
      }
      // Recalculer la file des chunks manquants dans le disque de chargement
      const r = rayonChargement;
      file = [];
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          const d2 = dx * dx + dz * dz;
          if (d2 > r * r) continue;
          if (!charges.has(cle(pcx + dx, pcz + dz))) file.push({ cx: pcx + dx, cz: pcz + dz, d2 });
        }
      }
      file.sort((a, b) => b.d2 - a.d2);
      // Le chunk du joueur et ses 8 voisins tout de suite : jamais de vide sous les pieds
      while (file.length && file[file.length - 1].d2 <= 2) {
        const q = file.pop()!;
        construire(q.cx, q.cz);
      }
    }

    // Le reste progressivement
    let construits = 0;
    while (file.length && construits < M.chunksParImage) {
      const q = file.pop()!;
      if (charges.has(cle(q.cx, q.cz))) continue;
      construire(q.cx, q.cz);
      construits++;
    }
  }

  function definirRayon(chargement: number, dechargement: number): void {
    rayonChargement = chargement;
    rayonDechargement = dechargement;
    // Force le recalcul de la file et le déchargement à la prochaine mise à jour
    dernierCx = NaN;
    dernierCz = NaN;
  }

  function liberer(): void {
    for (const k of [...charges.keys()]) decharger(k);
    file = [];
    materiau.dispose();
  }

  return {
    mettreAJour,
    definirRayon,
    nombreCharges: () => charges.size,
    nombreEnAttente: () => file.length,
    liberer,
  };
}
