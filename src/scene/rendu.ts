import * as THREE from 'three';
import { CONFIG } from '../config';

/** Crée le moteur de rendu, la scène et la caméra, et gère le redimensionnement. */
export function creerRendu(conteneur: HTMLElement) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // PCFShadowMap : ombres adoucies (PCFSoftShadowMap a été retiré de three)
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  conteneur.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(CONFIG.couleurCiel);
  // Brouillard de la couleur du ciel : masque le bord du monde chargé
  scene.fog = new THREE.Fog(CONFIG.couleurCiel, CONFIG.brouillard.debut, CONFIG.brouillard.fin);

  const camera = new THREE.PerspectiveCamera(CONFIG.champDeVision, 1, 0.1, CONFIG.distanceMax);

  const redimensionner = () => {
    const largeur = conteneur.clientWidth || window.innerWidth;
    const hauteur = conteneur.clientHeight || window.innerHeight;
    renderer.setSize(largeur, hauteur);
    camera.aspect = largeur / hauteur;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', redimensionner);
  redimensionner();

  return { renderer, scene, camera };
}
