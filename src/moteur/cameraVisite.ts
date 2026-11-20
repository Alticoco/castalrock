// Caméra de visite libre (touche F) : survole le monde sans le personnage.
// ZQSD (ou flèches) : avancer, reculer, aller sur le côté. Espace / Shift : monter / descendre.
// Clic gauche maintenu + souris : tourner la vue.
// Les touches sont lues par position physique (event.code) : ZQSD en AZERTY = WASD en QWERTY.

import type * as THREE from 'three';
import { CONFIG } from '../config';

export interface CameraVisite {
  mettreAJour(dt: number): void;
  liberer(): void;
}

export function creerCameraVisite(
  camera: THREE.PerspectiveCamera,
  element: HTMLElement,
  /** Altitude du sol, pour ne pas passer dessous */
  hauteurSol?: (x: number, z: number) => number,
): CameraVisite {
  const C = CONFIG.cameraVisite;
  const touches = new Set<string>();
  let glisse = false;
  // Angles de la vue : lacet (gauche-droite) et tangage (haut-bas), à partir de la caméra
  camera.rotation.order = 'YXZ';
  let lacet = camera.rotation.y;
  let tangage = camera.rotation.x;

  const auClavierBas = (e: KeyboardEvent) => {
    touches.add(e.code);
    if (e.code === 'Space') e.preventDefault(); // pas de défilement de la page
  };
  const auClavierHaut = (e: KeyboardEvent) => touches.delete(e.code);
  const auPerteFocus = () => touches.clear();
  const auClicBas = (e: MouseEvent) => {
    if (e.button === 0) glisse = true;
  };
  const auClicHaut = (e: MouseEvent) => {
    if (e.button === 0) glisse = false;
  };
  const auMouvement = (e: MouseEvent) => {
    if (!glisse) return;
    lacet -= e.movementX * C.sensibilite;
    tangage -= e.movementY * C.sensibilite;
    tangage = Math.max(-1.5, Math.min(1.5, tangage));
  };

  window.addEventListener('keydown', auClavierBas);
  window.addEventListener('keyup', auClavierHaut);
  window.addEventListener('blur', auPerteFocus);
  element.addEventListener('mousedown', auClicBas);
  window.addEventListener('mouseup', auClicHaut);
  window.addEventListener('mousemove', auMouvement);

  const appuye = (...codes: string[]) => codes.some((c) => touches.has(c));

  function mettreAJour(dt: number): void {
    camera.rotation.set(tangage, lacet, 0);
    let avant = 0;
    let cote = 0;
    let haut = 0;
    if (appuye('KeyW', 'ArrowUp')) avant += 1;
    if (appuye('KeyS', 'ArrowDown')) avant -= 1;
    if (appuye('KeyD', 'ArrowRight')) cote += 1;
    if (appuye('KeyA', 'ArrowLeft')) cote -= 1;
    if (appuye('Space')) haut += 1;
    if (appuye('ShiftLeft', 'ShiftRight')) haut -= 1;

    // Déplacement horizontal selon le lacet (on ne plonge pas en regardant vers le bas)
    const d = C.vitesse * dt;
    const sin = Math.sin(lacet);
    const cos = Math.cos(lacet);
    camera.position.x += (-sin * avant + cos * cote) * d;
    camera.position.z += (-cos * avant - sin * cote) * d;
    camera.position.y += haut * d;

    if (hauteurSol) {
      const sol = hauteurSol(camera.position.x, camera.position.z) + C.hauteurMinSol;
      if (camera.position.y < sol) camera.position.y = sol;
    }
  }

  function liberer(): void {
    window.removeEventListener('keydown', auClavierBas);
    window.removeEventListener('keyup', auClavierHaut);
    window.removeEventListener('blur', auPerteFocus);
    element.removeEventListener('mousedown', auClicBas);
    window.removeEventListener('mouseup', auClicHaut);
    window.removeEventListener('mousemove', auMouvement);
  }

  return { mettreAJour, liberer };
}
