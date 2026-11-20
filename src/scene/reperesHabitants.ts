// Repère au-dessus de la tête d'un habitant : un « ! » jaune (il a une quête à proposer), un « ? » doré (une quête à
// lui rendre est prête) ou un « ! » orange doré (c'est à lui qu'il faut parler pour l'histoire). Un sprite sans éclairage, dessiné une fois sur un canevas : il se tourne tout seul vers la caméra.
// Aucune règle de jeu ici : l'état du repère vient de src/regles/dialogues.ts (marqueurHabitant).

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { MarqueurHabitant } from '../regles/dialogues';

export interface Repere {
  objet: THREE.Sprite;
  /** Montre le repère de cet état (ou le cache) */
  definir(etat: MarqueurHabitant): void;
  /** Petit rebond : `temps` en secondes */
  animer(temps: number): void;
}

/** Une lettre épaisse avec un contour sombre, sur fond transparent. */
function dessinerLettre(lettre: string, couleur: string): THREE.CanvasTexture {
  const canevas = document.createElement('canvas');
  canevas.width = 128;
  canevas.height = 128;
  const c = canevas.getContext('2d');
  if (c) {
    c.font = '900 108px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.lineJoin = 'round';
    c.lineWidth = 16;
    c.strokeStyle = '#3b2a1a';
    c.strokeText(lettre, 64, 70);
    c.fillStyle = couleur;
    c.fillText(lettre, 64, 70);
  }
  const texture = new THREE.CanvasTexture(canevas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

let textures: { proposee: THREE.CanvasTexture; aRendre: THREE.CanvasTexture; histoire: THREE.CanvasTexture } | null = null;

export function creerRepere(): Repere {
  const R = CONFIG.dialogue.repere;
  // Les trois dessins sont partagés entre tous les habitants
  textures ??= { proposee: dessinerLettre('!', R.jaune), aRendre: dessinerLettre('?', R.dore), histoire: dessinerLettre('!', R.histoire) };
  const materiau = new THREE.SpriteMaterial({ map: textures.proposee, transparent: true, fog: false, depthWrite: false });
  const objet = new THREE.Sprite(materiau);
  objet.scale.set(R.taille, R.taille, 1);
  objet.position.y = R.hauteur;
  objet.visible = false;
  objet.renderOrder = 5;
  const t = textures;
  return {
    objet,
    definir(etat) {
      objet.visible = etat !== 'aucun';
      if (etat !== 'aucun' && t) materiau.map = etat === 'proposee' ? t.proposee : etat === 'histoire' ? t.histoire : t.aRendre;
      materiau.needsUpdate = true;
    },
    animer(temps) {
      objet.position.y = R.hauteur + Math.sin(temps * R.vitesseRebond) * R.rebond;
    },
  };
}
