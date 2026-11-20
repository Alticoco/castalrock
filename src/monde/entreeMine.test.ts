import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerGenerateurDecor } from './decor';
import { chercherEntreeMine, creerTerrainAvecMine, retoucheMine, zoneLibreEntree } from './entreeMine';
import { creerTerrain } from './terrain';

const E = CONFIG.mine.entree;
const GRAINES = [12345, 1, 7, 2026];

describe('entrée de la mine', () => {
  it('est toujours au même endroit pour une même graine', () => {
    const a = chercherEntreeMine(creerTerrain(12345));
    const b = chercherEntreeMine(creerTerrain(12345));
    expect(a).toEqual(b);
  });

  it('est entre 90 et 220 m du village, hors de l\'eau, au pied d\'un terrain qui monte', () => {
    for (const graine of GRAINES) {
      const terrain = creerTerrain(graine);
      const e = chercherEntreeMine(terrain);
      const distance = Math.hypot(e.x, e.z);
      // La recherche se fait sur une grille de 4 m, puis le seuil avance jusqu'à la paroi
      expect(distance).toBeGreaterThan(E.distanceMin - 12);
      expect(distance).toBeLessThan(E.distanceMax + 12);
      expect(e.y).toBeGreaterThan(terrain.niveauEau + 0.5);
      expect(Math.hypot(e.dx, e.dz)).toBeCloseTo(1, 6);
      expect(e.denivele).toBeGreaterThan(0);
      // Derrière le portail, le terrain d'origine est plus haut que devant
      const derriere = terrain.hauteurBrute(e.x + e.dx * 8, e.z + e.dz * 8);
      const devant = terrain.hauteurBrute(e.x - e.dx * 4, e.z - e.dz * 4);
      expect(derriere).toBeGreaterThan(devant);
    }
  });

  it('trouve une vraie paroi pour la graine du jeu', () => {
    const e = chercherEntreeMine(creerTerrain(CONFIG.graine));
    expect(e.denivele).toBeGreaterThanOrEqual(4);
  });

  it('s\'atteint à pied depuis le village sans traverser l\'eau', () => {
    for (const graine of GRAINES) {
      const { terrain, entree } = creerTerrainAvecMine(graine);
      // Parcours en largeur sur une grille de 2 m, avec les règles du personnage (pente et eau)
      const pas = 2;
      const demi = 130;
      const n = demi * 2 + 1;
      const marche = pas * Math.tan((CONFIG.personnage.penteMaxDegres * Math.PI) / 180);
      const vus = new Uint8Array(n * n);
      const hauteur = (c: number) => terrain.hauteurBrute(((c % n) - demi) * pas, (Math.floor(c / n) - demi) * pas);
      const depart = demi * n + demi;
      const but = { a: Math.round((entree.x - entree.dx * 3) / pas) + demi, b: Math.round((entree.z - entree.dz * 3) / pas) + demi };
      const file = [depart];
      vus[depart] = 1;
      let atteint = false;
      for (let k = 0; k < file.length && !atteint; k++) {
        const c = file[k];
        const h = hauteur(c);
        for (const v of [c - 1, c + 1, c - n, c + n]) {
          if (v < 0 || v >= vus.length || vus[v]) continue;
          const hv = hauteur(v);
          if (hv < terrain.niveauEau || Math.abs(hv - h) > marche) continue;
          vus[v] = 1;
          file.push(v);
          if (Math.abs((v % n) - but.a) <= 1 && Math.abs(Math.floor(v / n) - but.b) <= 1) atteint = true;
        }
      }
      expect(atteint).toBe(true);
    }
  });

  it('aplanit le sol devant le portail sans toucher au reste du monde', () => {
    const nu = creerTerrain(12345);
    const { terrain, entree: e } = creerTerrainAvecMine(12345);
    // Replat : devant le seuil, sur la largeur du portail
    for (const [u, v] of [[0, 0], [-2, 0], [-4, 2], [-3, -2.5], [2, 1]]) {
      const x = e.x + e.dx * u + e.dz * v;
      const z = e.z + e.dz * u - e.dx * v;
      expect(terrain.hauteurBrute(x, z)).toBeCloseTo(e.y, 5);
    }
    // Le village et le monde au loin sont inchangés
    for (const [x, z] of [[0, 0], [30, -20], [300, 300], [-250, 120], [e.x + 40, e.z + 40]]) {
      expect(terrain.hauteurBrute(x, z)).toBe(nu.hauteurBrute(x, z));
      expect(terrain.hauteur(x, z)).toBe(nu.hauteur(x, z));
    }
    // La retouche raccorde en douceur : à 16 m du portail elle ne change plus rien
    const retouche = retoucheMine(e);
    expect(retouche(e.x + 17, e.z, 42)).toBe(42);
  });

  it('donne un sol plat à l\'intérieur de la mine, loin du monde', () => {
    const { terrain, plan } = creerTerrainAvecMine(12345);
    expect(Math.hypot(plan.origine.x, plan.origine.z)).toBeGreaterThan(10000);
    expect(terrain.hauteur(plan.arrivee.x, plan.arrivee.z)).toBe(CONFIG.mine.altitude);
    expect(terrain.hauteur(plan.arrivee.x + 13.3, plan.arrivee.z + 41.7)).toBe(CONFIG.mine.altitude);
    expect(terrain.estSousEau(plan.arrivee.x, plan.arrivee.z)).toBe(false);
  });

  it('garde le décor généré à l\'écart du portail', () => {
    const { terrain, entree } = creerTerrainAvecMine(12345);
    const zone = zoneLibreEntree(entree);
    const taille = CONFIG.monde.tailleChunk;
    const avec = creerGenerateurDecor(terrain, [zone]);
    const sans = creerGenerateurDecor(terrain);
    const cx = Math.floor(zone.x / taille);
    const cz = Math.floor(zone.z / taille);
    let retires = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        const elements = avec.chunk(cx + dx, cz + dz);
        for (const el of elements) expect(Math.hypot(el.x - zone.x, el.z - zone.z)).toBeGreaterThanOrEqual(zone.rayon);
        retires += sans.chunk(cx + dx, cz + dz).length - elements.length;
      }
    }
    expect(retires).toBeGreaterThan(0);
  });
});
