// Rendu du cycle jour/nuit : position et couleur du soleil et de la lune, lumière du ciel,
// couleur du ciel et du brouillard, étoiles, reflet de l'eau.
// Ne contient aucune règle de jeu : l'heure et le facteur de lumière viennent de regles/temps.ts.
// Un seul éclairage directionnel (avec ombres) sert pour le soleil le jour et pour la lune la nuit.

import * as THREE from 'three';
import { CONFIG } from '../config';
import { creerAleatoire } from '../regles/aleatoire';
import { facteurLumiere } from '../regles/temps';
import type { Eau } from '../monde/eau';
import type { Lumieres } from './lumiere';

export interface CycleJour {
  /** Applique l'heure (0 à 24) à toute la scène ; `camera` sert à garder le ciel autour d'elle. */
  mettreAJour(heure: number, camera: THREE.Camera): void;
  /** Vrai quand le soleil est au-dessus de l'horizon (choix de l'icône de l'horloge). */
  readonly soleilLeve: boolean;
}

type Repere = (typeof CONFIG.cycleJour.palette)[number];

const adoucir = (t: number): number => {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
};

/** Direction du soleil : de la forme (x, y, z) normalisée ; y > 0 = au-dessus de l'horizon. */
function directionSoleil(heure: number, sortie: THREE.Vector3): THREE.Vector3 {
  const C = CONFIG.cycleJour;
  const milieu = (C.heureLever + C.heureCoucher) / 2;
  const angle = (2 * Math.PI * (heure - milieu)) / 24;
  // Décalage vertical choisi pour que y passe par zéro exactement au lever et au coucher
  const decalage = -Math.cos((Math.PI * (C.heureCoucher - C.heureLever)) / 24);
  return sortie.set(Math.sin(angle), Math.cos(angle) + decalage, C.inclinaison).normalize();
}

export function creerCycleJour(scene: THREE.Scene, lumieres: Lumieres, eau: Eau): CycleJour {
  const C = CONFIG.cycleJour;

  const fond = new THREE.Color();
  const brouillard = scene.fog as THREE.Fog;
  scene.background = fond;

  // Tout ce qui est dessiné dans le ciel suit la caméra (donc ne se rapproche jamais)
  const ciel = new THREE.Group();
  ciel.name = 'ciel';
  scene.add(ciel);

  const materielAstre = (couleur: number, opacite = 1) =>
    new THREE.MeshBasicMaterial({
      color: couleur,
      transparent: true,
      opacity: opacite,
      fog: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  const disque = (rayon: number, materiel: THREE.Material) => {
    const m = new THREE.Mesh(new THREE.CircleGeometry(rayon, 32), materiel);
    m.frustumCulled = false;
    ciel.add(m);
    return m;
  };
  const disqueSoleil = disque(C.rayonSoleil, materielAstre(C.couleurDisqueSoleil));
  const disqueLune = disque(C.rayonLune, materielAstre(C.couleurDisqueLune));
  const haloLune = disque(C.rayonLune * 2.4, materielAstre(C.couleurHaloLune, 0.16));

  // Étoiles : points fixes tirés avec le générateur à graine, répartis sur la moitié haute de la sphère
  const alea = creerAleatoire(C.graineEtoiles);
  const positions = new Float32Array(C.nombreEtoiles * 3);
  for (let i = 0; i < C.nombreEtoiles; i++) {
    const y = alea.entre(-0.05, 1);
    const angle = alea.entre(0, Math.PI * 2);
    const r = Math.sqrt(1 - y * y);
    positions[i * 3] = Math.cos(angle) * r * C.distanceCiel;
    positions[i * 3 + 1] = y * C.distanceCiel;
    positions[i * 3 + 2] = Math.sin(angle) * r * C.distanceCiel;
  }
  const geometrieEtoiles = new THREE.BufferGeometry();
  geometrieEtoiles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const materielEtoiles = new THREE.PointsMaterial({
    color: 0xffffff,
    size: C.tailleEtoiles,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0,
    fog: false,
    depthWrite: false,
  });
  const etoiles = new THREE.Points(geometrieEtoiles, materielEtoiles);
  etoiles.frustumCulled = false;
  ciel.add(etoiles);

  // Couleurs de travail (réutilisées à chaque image)
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const cielCouleur = new THREE.Color();
  const hemiCiel = new THREE.Color();
  const hemiSol = new THREE.Color();
  const couleurAstre = new THREE.Color();
  const couleurBas = new THREE.Color(C.couleurSoleilBas);
  const couleurHaut = new THREE.Color(C.couleurSoleilHaut);
  const couleurLune = new THREE.Color(C.couleurLune);
  const dirSoleil = new THREE.Vector3();
  const dirAstre = new THREE.Vector3();
  const reflet = new THREE.Color();

  /** Mélange la couleur `cle` des deux repères entourant `heure`. */
  function palette(heure: number, cle: 'ciel' | 'hemiCiel' | 'hemiSol', sortie: THREE.Color): void {
    const reperes: readonly Repere[] = C.palette;
    let i = 0;
    while (i < reperes.length - 2 && heure >= reperes[i + 1].heure) i++;
    const a = reperes[i];
    const b = reperes[i + 1];
    const t = Math.min(1, Math.max(0, (heure - a.heure) / (b.heure - a.heure)));
    sortie.set(a[cle]).lerp(cA.set(b[cle]), t);
  }
  function intensitePalette(heure: number): number {
    const reperes: readonly Repere[] = C.palette;
    let i = 0;
    while (i < reperes.length - 2 && heure >= reperes[i + 1].heure) i++;
    const a = reperes[i];
    const b = reperes[i + 1];
    const t = Math.min(1, Math.max(0, (heure - a.heure) / (b.heure - a.heure)));
    return a.intensiteHemi + (b.intensiteHemi - a.intensiteHemi) * t;
  }

  let soleilLeve = true;

  return {
    get soleilLeve() {
      return soleilLeve;
    },

    mettreAJour(heure, camera) {
      ciel.position.copy(camera.position);

      // Ciel et brouillard
      palette(heure, 'ciel', cielCouleur);
      fond.copy(cielCouleur);
      brouillard.color.copy(cielCouleur);

      // Lumière du ciel
      palette(heure, 'hemiCiel', hemiCiel);
      palette(heure, 'hemiSol', hemiSol);
      lumieres.hemi.color.copy(hemiCiel);
      lumieres.hemi.groundColor.copy(hemiSol);
      lumieres.hemi.intensity = intensitePalette(heure);

      // Soleil le jour, lune la nuit : la lumière change d'astre quand le soleil passe l'horizon
      directionSoleil(heure, dirSoleil);
      const hauteur = dirSoleil.y;
      soleilLeve = hauteur > 0;
      if (soleilLeve) {
        dirAstre.copy(dirSoleil);
        couleurAstre.copy(couleurBas).lerp(cB.copy(couleurHaut), adoucir(hauteur / C.hauteurSoleilHaut));
        lumieres.definirAstre(dirAstre, couleurAstre, C.intensiteSoleil * adoucir(hauteur / 0.25));
      } else {
        dirAstre.copy(dirSoleil).negate();
        lumieres.definirAstre(dirAstre, couleurLune, C.intensiteLune * adoucir(-hauteur / 0.25));
      }

      // Disques dans le ciel : le soleil à sa place, la lune à l'opposé, tournés vers la caméra
      disqueSoleil.position.copy(dirSoleil).multiplyScalar(C.distanceCiel);
      disqueSoleil.lookAt(camera.position);
      disqueSoleil.visible = hauteur > -0.15;
      disqueLune.position.copy(dirSoleil).multiplyScalar(-C.distanceCiel);
      disqueLune.lookAt(camera.position);
      disqueLune.visible = hauteur < 0.15;
      haloLune.position.copy(disqueLune.position).multiplyScalar(1.001);
      haloLune.lookAt(camera.position);
      haloLune.visible = disqueLune.visible;
      // Le disque de lune s'efface quand le jour est là
      const lumiereJour = facteurLumiere(heure, CONFIG.temps);
      const visibiliteLune = 1 - lumiereJour;
      (disqueLune.material as THREE.MeshBasicMaterial).opacity = visibiliteLune;
      (haloLune.material as THREE.MeshBasicMaterial).opacity = 0.16 * visibiliteLune;
      materielEtoiles.opacity = Math.max(0, 1 - lumiereJour * 2);
      etoiles.visible = materielEtoiles.opacity > 0.01;

      // Eau : lueur du ciel, plus marquée la nuit où l'éclairage est faible
      reflet.copy(cielCouleur).multiplyScalar(C.reflet * (1 - 0.8 * lumiereJour));
      eau.definirReflet(reflet);
    },
  };
}
