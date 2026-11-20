import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { BIOMES } from './biomes';
import { creerTerrain } from './terrain';

const terrain = creerTerrain(CONFIG.graine);

describe('creerTerrain', () => {
  it('même graine = mêmes hauteurs ; graine différente = autre monde', () => {
    const a = creerTerrain(777);
    const b = creerTerrain(777);
    const c = creerTerrain(778);
    let differences = 0;
    for (let i = 0; i < 200; i++) {
      const x = (i * 37.3) % 900 - 450;
      const z = (i * 91.7) % 900 - 450;
      expect(a.hauteur(x, z)).toBe(b.hauteur(x, z));
      expect(a.poidsBiomes(x, z)).toEqual(b.poidsBiomes(x, z));
      if (Math.abs(a.hauteur(x, z) - c.hauteur(x, z)) > 0.01) differences++;
    }
    expect(differences).toBeGreaterThan(100);
  });

  it('le village est plat, au-dessus de l\'eau, sur un rayon de 35 m', () => {
    expect(terrain.altitudeVillage).toBeGreaterThan(terrain.niveauEau + 1);
    for (let r = 0; r < 35; r += 1.7) {
      for (let a = 0; a < Math.PI * 2; a += 0.2) {
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        expect(terrain.hauteur(x, z)).toBeCloseTo(terrain.altitudeVillage, 9);
        expect(terrain.pente(x, z)).toBeCloseTo(0, 9);
        expect(terrain.estSousEau(x, z)).toBe(false);
      }
    }
  });

  it('le biome autour du village est la prairie', () => {
    for (let r = 0; r < 80; r += 10) {
      for (let a = 0; a < Math.PI * 2; a += 0.5) {
        expect(terrain.biomeDominant(Math.cos(a) * r, Math.sin(a) * r).id).toBe('prairie');
      }
    }
  });

  it('hauteur() coïncide avec hauteurBrute() aux sommets de la grille', () => {
    const pas = CONFIG.monde.pasGrille;
    for (let i = -20; i < 20; i++) {
      const x = i * 7 * pas;
      const z = i * -3 * pas + 300;
      expect(terrain.hauteur(x, z)).toBeCloseTo(terrain.hauteurBrute(x, z), 9);
    }
  });

  it('normale unitaire vers le haut, pente entre 0 et 1', () => {
    for (let i = 0; i < 300; i++) {
      const x = (i * 53.1) % 1000 - 500;
      const z = (i * 29.9) % 1000 - 500;
      const n = terrain.normale(x, z);
      expect(Math.hypot(n.x, n.y, n.z)).toBeCloseTo(1, 9);
      expect(n.y).toBeGreaterThan(0);
      const p = terrain.pente(x, z);
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('poids des biomes de somme 1, chacun entre 0 et 1', () => {
    const sortie: number[] = [];
    for (let i = 0; i < 300; i++) {
      const x = (i * 71.3) % 3000 - 1500;
      const z = (i * 13.7) % 3000 - 1500;
      const w = terrain.poidsBiomes(x, z, sortie);
      expect(w).toBe(sortie);
      expect(w.length).toBe(BIOMES.length);
      expect(w.reduce((s, v) => s + v, 0)).toBeCloseTo(1, 9);
      for (const v of w) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('sur 1 km × 1 km : valeurs finies, eau, sommets > 50 m, falaises et au moins 3 biomes', () => {
    let eau = 0;
    let hauts = 0;
    let raides = 0;
    const biomes = new Set<string>();
    for (let x = -500; x <= 500; x += 5) {
      for (let z = -500; z <= 500; z += 5) {
        const h = terrain.hauteur(x, z);
        const p = terrain.pente(x, z);
        expect(Number.isFinite(h)).toBe(true);
        expect(Number.isFinite(p)).toBe(true);
        if (terrain.estSousEau(x, z)) eau++;
        if (h > 50) hauts++;
        if (p > 0.55) raides++; // plus de 50° : falaise ou flanc de montagne
        biomes.add(terrain.biomeDominant(x, z).id);
      }
    }
    expect(eau).toBeGreaterThan(0);
    expect(hauts).toBeGreaterThan(0);
    expect(raides).toBeGreaterThan(0);
    expect(biomes.size).toBeGreaterThanOrEqual(3);
  });

  it('on peut sortir du village à pied sans traverser l\'eau (plusieurs graines)', () => {
    // Parcours en largeur sur les sommets de la grille, depuis le centre du village,
    // en ne passant que par des points hors de l'eau, jusqu'à 350 m du centre.
    const pas = CONFIG.monde.pasGrille;
    const rayonVise = 350;
    const n = Math.ceil(rayonVise / pas) + 2;
    for (const graine of [CONFIG.graine, 1, 42, 777]) {
      const t = creerTerrain(graine);
      const cote = 2 * n + 1;
      const vu = new Uint8Array(cote * cote);
      const file: number[] = [n * cote + n];
      vu[n * cote + n] = 1;
      let atteint = false;
      while (file.length && !atteint) {
        const k = file.pop()!;
        const i = k % cote;
        const j = (k - i) / cote;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cote || nj >= cote) continue;
          const nk = nj * cote + ni;
          if (vu[nk]) continue;
          vu[nk] = 1;
          const x = (ni - n) * pas;
          const z = (nj - n) * pas;
          if (t.hauteurBrute(x, z) < t.niveauEau) continue;
          if (Math.hypot(x, z) >= rayonVise) {
            atteint = true;
            break;
          }
          file.push(nk);
        }
      }
      expect(atteint, `graine ${graine}`).toBe(true);
    }
  });
});
