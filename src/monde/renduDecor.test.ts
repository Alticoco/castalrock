import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerEtatPersonnage, pasDeDeplacement } from '../regles/deplacement';
import { creerModelesDecor } from '../scene/modelesDecor';
import { estArbre } from './decor';
import { creerRenduDecor } from './renduDecor';
import { creerTerrain } from './terrain';

// Le registre du décor fonctionne sans carte graphique : rien n'est dessiné ici
const terrain = creerTerrain(CONFIG.graine);
const scene = new THREE.Scene();
const decor = creerRenduDecor(scene, terrain, creerModelesDecor());
for (let cz = -1; cz <= 1; cz++) for (let cx = -1; cx <= 1; cx++) decor.ajouterChunk(cx, cz);

// Un arbre sur terrain presque plat, pour marcher droit dessus
const arbre = decor
  .elementsAutour(0, 0, 90)
  .filter((e) => estArbre(e.type) && terrain.pente(e.x - 2, e.z) < 0.1)
  .sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];

describe('creerRenduDecor', () => {
  it('affiche le décor des chunks chargés', () => {
    expect(arbre).toBeDefined();
    expect(scene.children.length).toBeGreaterThan(9);
    expect(decor.nombreElements()).toBeGreaterThan(100);
  });

  it('un arbre arrête le personnage qui marche droit dessus', () => {
    const P = CONFIG.personnage;
    let etat = creerEtatPersonnage(arbre.x - 3, terrain.hauteur(arbre.x - 3, arbre.z), arbre.z);
    for (let i = 0; i < 180; i++) {
      etat = pasDeDeplacement(etat, { x: 1, z: 0, courir: false, sauter: false }, 1 / 60, {
        hauteur: (x, z) => terrain.hauteur(x, z),
        niveauEau: terrain.niveauEau,
        obstacles: decor.obstaclesAutour(etat.x, etat.z, 4),
      });
      expect(Math.hypot(etat.x - arbre.x, etat.z - arbre.z)).toBeGreaterThanOrEqual(arbre.rayonCollision + P.rayon - 1e-6);
    }
    // Trois secondes de marche (15 m) : sans l'arbre il serait loin derrière
    expect(etat.x).toBeLessThan(arbre.x);
    expect(etat.x).toBeGreaterThan(arbre.x - 1.5);
  });

  it('élément visé, retrait, et retrait conservé au rechargement du chunk', () => {
    const origine = { x: arbre.x - 2, y: arbre.y + 1.4, z: arbre.z };
    expect(decor.elementVise(origine, { x: 1, y: 0, z: 0 }, 3)?.id).toBe(arbre.id);
    expect(decor.elementVise(origine, { x: -1, y: 0, z: 0 }, 1)).toBeNull();

    expect(decor.retirer(arbre.id)).toBe(true);
    const present = () => decor.elementsAutour(arbre.x, arbre.z, 0.1).some((e) => e.id === arbre.id);
    expect(present()).toBe(false);
    expect(decor.obstaclesAutour(arbre.x, arbre.z, 0.1).some((o) => o.x === arbre.x && o.z === arbre.z)).toBe(false);
    expect(decor.elementVise(origine, { x: 1, y: 0, z: 0 }, 3)?.id).not.toBe(arbre.id);
    expect(decor.retires()).toContain(arbre.id);

    const cx = Math.floor(arbre.x / CONFIG.monde.tailleChunk);
    const cz = Math.floor(arbre.z / CONFIG.monde.tailleChunk);
    decor.retirerChunk(cx, cz);
    decor.ajouterChunk(cx, cz);
    expect(present()).toBe(false);
  });

  it('liberer() retire tout de la scène', () => {
    decor.liberer();
    expect(scene.children.length).toBe(0);
    expect(decor.nombreElements()).toBe(0);
  });
});
