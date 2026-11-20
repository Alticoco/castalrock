// Lumières de la scène : ciel (hémisphérique) et soleil directionnel avec ombres.
// Les ombres ne couvrent qu'une zone autour de la caméra, qui la suit.
// Le cycle jour/nuit (cycleJour.ts) fait tourner l'astre et change les couleurs.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { resolutionOmbres, type QualiteOmbres } from '../regles/affichage';

export interface Lumieres {
  hemi: THREE.HemisphereLight;
  soleil: THREE.DirectionalLight;
  /** Centre la zone d'ombres sur (x, y, z), en général la caméra ou le joueur. */
  suivre(x: number, y: number, z: number): void;
  /** Règle la direction d'où vient la lumière (soleil ou lune), sa couleur et son intensité. */
  definirAstre(direction: THREE.Vector3, couleur: THREE.Color, intensite: number): void;
  /** Règle les ombres : éteintes, ou allumées avec une carte d'ombres plus ou moins fine (appliqué tout de suite). */
  definirOmbres(qualite: QualiteOmbres): void;
}

const DISTANCE_SOLEIL = 250;

export function creerLumieres(scene: THREE.Scene): Lumieres {
  const L = CONFIG.lumiere;

  const hemi = new THREE.HemisphereLight(L.couleurCielHemi, L.couleurSolHemi, L.intensiteHemi);
  scene.add(hemi);

  const soleil = new THREE.DirectionalLight(L.couleurSoleil, L.intensiteSoleil);
  const direction = new THREE.Vector3(L.directionSoleil.x, L.directionSoleil.y, L.directionSoleil.z).normalize();
  soleil.castShadow = true;
  const ombre = soleil.shadow;
  ombre.mapSize.set(L.resolutionOmbres, L.resolutionOmbres);
  ombre.camera.left = -L.tailleOmbres;
  ombre.camera.right = L.tailleOmbres;
  ombre.camera.top = L.tailleOmbres;
  ombre.camera.bottom = -L.tailleOmbres;
  ombre.camera.near = 1;
  ombre.camera.far = DISTANCE_SOLEIL * 2;
  ombre.camera.updateProjectionMatrix();
  // Corrige les rayures d'ombre sur le terrain à faces plates
  ombre.bias = -0.0004;
  ombre.normalBias = 0.4;
  scene.add(soleil);
  scene.add(soleil.target);

  // Taille d'un texel de la carte d'ombres : on déplace la zone par pas entiers
  // pour limiter le scintillement des bords d'ombre quand la caméra bouge
  let texel = (2 * L.tailleOmbres) / L.resolutionOmbres;

  function suivre(x: number, y: number, z: number): void {
    const cx = Math.round(x / texel) * texel;
    const cy = Math.round(y / texel) * texel;
    const cz = Math.round(z / texel) * texel;
    soleil.target.position.set(cx, cy, cz);
    soleil.position.set(
      cx + direction.x * DISTANCE_SOLEIL,
      cy + direction.y * DISTANCE_SOLEIL,
      cz + direction.z * DISTANCE_SOLEIL,
    );
  }
  // Dernière position demandée : le changement de direction replace le soleil au même endroit
  let centre = { x: 0, y: 0, z: 0 };
  const suivreEtMemoriser = (x: number, y: number, z: number): void => {
    centre = { x, y, z };
    suivre(x, y, z);
  };

  function definirAstre(nouvelleDirection: THREE.Vector3, couleur: THREE.Color, intensite: number): void {
    direction.copy(nouvelleDirection).normalize();
    soleil.color.copy(couleur);
    soleil.intensity = intensite;
    suivre(centre.x, centre.y, centre.z);
  }
  suivre(0, 0, 0);

  function definirOmbres(qualite: QualiteOmbres): void {
    const resolution = resolutionOmbres(qualite);
    soleil.castShadow = resolution > 0;
    if (resolution > 0 && resolution !== ombre.mapSize.x) {
      // La carte déjà créée garde son ancienne taille : on la libère pour qu'elle soit refaite à la nouvelle
      ombre.map?.dispose();
      ombre.map = null;
      ombre.mapSize.set(resolution, resolution);
      texel = (2 * L.tailleOmbres) / resolution;
    }
  }

  return { hemi, soleil, suivre: suivreEtMemoriser, definirAstre, definirOmbres };
}
