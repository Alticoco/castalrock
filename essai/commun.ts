// Outils communs des pages d'essai (pas dans le jeu) : rendu, lumière proche de celle du jeu, mesure du coût.
import * as THREE from 'three';

export const params = new URLSearchParams(location.search);

export function creerRendu(fond = 0x9aa3ab): { rendu: THREE.WebGLRenderer; scene: THREE.Scene } {
  const rendu = new THREE.WebGLRenderer({ antialias: true });
  rendu.setSize(innerWidth, innerHeight);
  rendu.setPixelRatio(devicePixelRatio);
  document.body.appendChild(rendu.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(fond);
  scene.add(new THREE.HemisphereLight(0xdfe9ff, 0x6b6450, 1.4));
  const soleil = new THREE.DirectionalLight(0xfff1dc, 2.4);
  soleil.position.set(3, 5, 4);
  scene.add(soleil);
  return { rendu, scene };
}

/** Compte les maillages et les triangles d'un groupe (ce que coûte un modèle). */
export function cout(objet: THREE.Object3D): { maillages: number; triangles: number } {
  let maillages = 0;
  let triangles = 0;
  objet.traverseVisible((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    maillages += 1;
    const g = m.geometry;
    triangles += (g.index ? g.index.count : g.attributes.position.count) / 3;
  });
  return { maillages, triangles: Math.round(triangles) };
}

export function afficherTexte(texte: string): void {
  const div = document.createElement('div');
  div.id = 'mesure';
  div.style.cssText = 'position:fixed;left:8px;top:8px;font:13px monospace;color:#111;background:#fff8;padding:4px 6px;white-space:pre';
  div.textContent = texte;
  document.body.appendChild(div);
}
