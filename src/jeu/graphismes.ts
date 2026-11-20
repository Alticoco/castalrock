// Options graphiques : applique les réglages gardés (src/moteur/reglages.ts) au rendu, tout de suite, sans recharger la page.
// - distance de vue : chunks chargés, brouillard et portée de la caméra ;
// - ombres : éteintes ou carte d'ombres plus ou moins fine ;
// - images par seconde : compteur affiché ou masqué.
import * as THREE from 'three';
import { parametresVue } from '../regles/affichage';
import { distanceVue, imagesParSeconde, qualiteOmbres } from '../moteur/reglages';
import type { GestionnaireChunks } from '../monde/chunks';
import type { Lumieres } from '../scene/lumiere';
import type { CompteurImages } from '../ui/compteurImages';

export interface ElementsGraphiques {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  lumieres: Lumieres;
  chunks: GestionnaireChunks;
  compteurImages: CompteurImages;
  /** Vrai quand le joueur est dans la mine (son brouillard court ne doit pas être remplacé) */
  dansLaMine: () => boolean;
}

/** Renvoie la fonction qui applique les réglages actuels ; elle est aussi appelée une fois au lancement. */
export function creerGraphismes(el: ElementsGraphiques): () => void {
  function appliquer(): void {
    const vue = parametresVue(distanceVue());
    el.chunks.definirRayon(vue.rayonChargement, vue.rayonDechargement);
    el.camera.far = vue.distanceMax;
    el.camera.updateProjectionMatrix();
    // Dans la mine, le brouillard court est remis à chaque image ; celui du monde est rétabli à la sortie
    if (!el.dansLaMine()) {
      const brouillard = el.scene.fog as THREE.Fog;
      brouillard.near = vue.brouillardDebut;
      brouillard.far = vue.brouillardFin;
    }
    el.lumieres.definirOmbres(qualiteOmbres());
    el.compteurImages.definir(imagesParSeconde());
  }
  appliquer();
  return appliquer;
}
