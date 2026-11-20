import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { couleurCarte, remplirTuile } from './carte';
import { creerTerrain } from './terrain';

const terrain = creerTerrain(CONFIG.graine);

/** Premier point sous l'eau, cherché sur une grille autour du village. */
function pointSousEau(): { x: number; z: number } {
  for (let x = -600; x <= 600; x += 8) {
    for (let z = -600; z <= 600; z += 8) {
      if (terrain.hauteur(x, z) < terrain.niveauEau - 1) return { x, z };
    }
  }
  throw new Error("Aucun point sous l'eau trouvé");
}

describe('couleurCarte', () => {
  it("l'eau est plus bleue que rouge", () => {
    const p = pointSousEau();
    const [r, , b] = couleurCarte(terrain, p.x, p.z);
    expect(b).toBeGreaterThan(r);
  });

  it('la place du village est brune (rouge > bleu)', () => {
    const [r, , b] = couleurCarte(terrain, 2, 2);
    expect(r).toBeGreaterThan(b);
  });

  it('les couleurs restent entre 0 et 255', () => {
    for (let i = 0; i < 300; i++) {
      const c = couleurCarte(terrain, (i * 37.3) % 800 - 400, (i * 91.7) % 800 - 400);
      for (const v of c) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(255);
      }
    }
  });
});

describe('remplirTuile', () => {
  it('remplit tous les pixels, opaques, et deux appels donnent le même résultat', () => {
    const n = CONFIG.miniCarte.pixelsTuile;
    const a = new Uint8ClampedArray(n * n * 4);
    const b = new Uint8ClampedArray(n * n * 4);
    remplirTuile(terrain, 3, -2, a);
    remplirTuile(terrain, 3, -2, b);
    expect(a).toEqual(b);
    for (let i = 3; i < a.length; i += 4) expect(a[i]).toBe(255);
  });
});
