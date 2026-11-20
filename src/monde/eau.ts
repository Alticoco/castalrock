// Eau low poly : une dalle d'eau par chunk de terrain qui descend sous le niveau de l'eau.
// L'eau n'existe donc que là où le terrain est chargé (pas de « mer » au-delà du monde affiché).
// L'ondulation est calculée dans le shader (gratuit pour le processeur), en coordonnées du
// monde : les dalles voisines se raccordent sans couture. Les faces plates donnent l'aspect facetté.

import * as THREE from 'three';
import { CONFIG } from '../config';

export interface Eau {
  /** À appeler à chaque image : avance l'ondulation. */
  mettreAJour(dt: number): void;
  /** Lueur propre de l'eau (reflet du ciel) : couleur déjà multipliée par la part voulue. */
  definirReflet(couleur: THREE.Color): void;
  /** Pose une dalle d'eau sur le chunk (cx, cz) si son terrain descend jusqu'à `altitudeMin`. */
  ajouterChunk(cx: number, cz: number, altitudeMin: number): void;
  retirerChunk(cx: number, cz: number): void;
  liberer(): void;
}

const cle = (cx: number, cz: number) => `${cx},${cz}`;

export function creerEau(scene: THREE.Scene, niveauEau: number): Eau {
  const E = CONFIG.eau;
  const taille = CONFIG.monde.tailleChunk;
  const segments = Math.round(taille / E.pasGrille);
  // Une seule géométrie, partagée par toutes les dalles ; son coin est à l'origine du chunk
  const geometrie = new THREE.PlaneGeometry(taille, taille, segments, segments);
  geometrie.rotateX(-Math.PI / 2);
  geometrie.translate(taille / 2, 0, taille / 2);

  const materiau = new THREE.MeshLambertMaterial({
    color: CONFIG.couleurs.eau,
    transparent: true,
    opacity: E.opacite,
    flatShading: true,
  });
  const uniformes = {
    uTemps: { value: 0 },
    uAmplitude: { value: E.amplitudeVagues },
  };
  materiau.onBeforeCompile = (shader) => {
    shader.uniforms.uTemps = uniformes.uTemps;
    shader.uniforms.uAmplitude = uniformes.uAmplitude;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTemps;\nuniform float uAmplitude;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        // Ondulation calculée en coordonnées du monde : identique au bord de deux dalles voisines
        vec4 eauMonde = modelMatrix * vec4(transformed, 1.0);
        transformed.y += uAmplitude * (
          sin(eauMonde.x * 0.31 + uTemps * 1.3) +
          sin(eauMonde.z * 0.27 - uTemps * 1.1) +
          sin((eauMonde.x + eauMonde.z) * 0.19 + uTemps * 0.7)
        ) / 3.0;`,
      );
  };

  const dalles = new Map<string, THREE.Mesh>();

  function retirerChunk(cx: number, cz: number): void {
    const k = cle(cx, cz);
    const dalle = dalles.get(k);
    if (!dalle) return;
    scene.remove(dalle);
    dalles.delete(k);
  }

  return {
    mettreAJour(dt) {
      uniformes.uTemps.value += dt * E.vitesseVagues;
    },
    definirReflet(couleur) {
      materiau.emissive.copy(couleur);
    },
    ajouterChunk(cx, cz, altitudeMin) {
      const k = cle(cx, cz);
      // Pas d'eau visible si tout le terrain du chunk est au-dessus des vagues
      if (dalles.has(k) || altitudeMin > niveauEau + E.amplitudeVagues) return;
      const dalle = new THREE.Mesh(geometrie, materiau);
      dalle.position.set(cx * taille, niveauEau, cz * taille);
      dalle.matrixAutoUpdate = false;
      dalle.updateMatrix();
      dalle.receiveShadow = true;
      dalle.name = `eau ${k}`;
      scene.add(dalle);
      dalles.set(k, dalle);
    },
    retirerChunk,
    liberer() {
      for (const dalle of dalles.values()) scene.remove(dalle);
      dalles.clear();
      geometrie.dispose();
      materiau.dispose();
    },
  };
}
