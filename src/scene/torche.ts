// Lumière de la torche tenue par le joueur (case 5 de la barre d'outils) : une aura chaude qui le suit.
// Le modèle de la torche est dans outils.ts. Aucune règle de jeu ici.
// La lumière est créée une fois pour toutes, à intensité nulle tant que la torche n'est pas en main :
// changer le nombre de lumières de la scène recompilerait tous les shaders (saccade au changement d'outil).

import * as THREE from 'three';
import { CONFIG } from '../config';

export interface LumiereTorche {
  /** Lumière à ajouter à la scène par l'appelant, une seule fois. */
  readonly lumiere: THREE.PointLight;
  /**
   * À chaque image : place la lumière près du joueur et règle son intensité.
   * `obscurite` va de 0 (plein jour) à 1 (nuit) ; `dansLaMine` : intensité propre à la mine.
   */
  mettreAJour(dt: number, allumee: boolean, joueur: { x: number; y: number; z: number; orientation: number }, obscurite: number, dansLaMine: boolean): void;
}

export function creerLumiereTorche(): LumiereTorche {
  const T = CONFIG.torche;
  const lumiere = new THREE.PointLight(T.couleur, 0, T.rayon, T.attenuation);
  lumiere.name = 'lumiere-torche';
  let temps = 0;
  // Part allumée, de 0 à 1 : la lumière monte et retombe en douceur
  let allumage = 0;

  return {
    lumiere,
    mettreAJour(dt, allumee, joueur, obscurite, dansLaMine) {
      temps += dt;
      const pas = T.dureeAllumage > 0 ? dt / T.dureeAllumage : 1;
      allumage = Math.min(1, Math.max(0, allumage + (allumee ? pas : -pas)));
      if (allumage <= 0) {
        lumiere.intensity = 0;
        return;
      }
      // Un peu devant le joueur et au-dessus de sa tête : la lumière ne brûle ni les mains ni le sol à ses pieds
      lumiere.position.set(
        joueur.x + Math.sin(joueur.orientation) * T.avance,
        joueur.y + T.hauteur,
        joueur.z + Math.cos(joueur.orientation) * T.avance,
      );
      const n = Math.min(1, Math.max(0, obscurite));
      const base = dansLaMine ? T.intensiteMine : T.intensiteJour + (T.intensiteNuit - T.intensiteJour) * n;
      // Scintillement : deux ondes de vitesses différentes, pour que la lumière ne batte pas en rythme
      const v = T.vitesseScintillement;
      const scintillement = 1 + T.scintillement * (0.6 * Math.sin(temps * v) + 0.4 * Math.sin(temps * v * 2.6 + 1.3));
      lumiere.intensity = base * allumage * scintillement;
    },
  };
}
