import { describe, expect, it } from 'vitest';
import { CAP_NORD, decalagesTuiles, deprojeter, placerRepere, projeter } from './miniCarte';

describe('deprojeter', () => {
  it('refait le chemin inverse de projeter, pour tous les caps', () => {
    for (const cap of [0, 1.3, CAP_NORD, -2.4, 5.9]) {
      const p = projeter(37.5, -12.25, cap);
      const m = deprojeter(p.x, p.y, cap);
      expect(m.dx).toBeCloseTo(37.5);
      expect(m.dz).toBeCloseTo(-12.25);
    }
  });

  it('carte nord en haut : le haut de la carte est le nord (-z), la droite est l’est (+x)', () => {
    const haut = deprojeter(0, -10, CAP_NORD);
    expect(haut.dx).toBeCloseTo(0);
    expect(haut.dz).toBeCloseTo(-10);
    const droite = deprojeter(10, 0, CAP_NORD);
    expect(droite.dx).toBeCloseTo(10);
    expect(droite.dz).toBeCloseTo(0);
  });
});

describe('projeter', () => {
  it('carte nord en haut : le nord (-z) est en haut, l\'est (+x) à droite', () => {
    const nord = projeter(0, -10, CAP_NORD);
    expect(nord.x).toBeCloseTo(0);
    expect(nord.y).toBeCloseTo(-10);
    const est = projeter(10, 0, CAP_NORD);
    expect(est.x).toBeCloseTo(10);
    expect(est.y).toBeCloseTo(0);
  });

  it('carte tournée : ce qui est devant le joueur est en haut, à sa droite est à droite', () => {
    // Joueur tourné vers +z (sud) : l'avant est (sin 0, cos 0) = (0, 1)
    const devant = projeter(0, 10, 0);
    expect(devant.x).toBeCloseTo(0);
    expect(devant.y).toBeCloseTo(-10);
    // Tourné vers +z, sa droite est vers -x
    const droite = projeter(-10, 0, 0);
    expect(droite.x).toBeCloseTo(10);
    expect(droite.y).toBeCloseTo(0);
  });

  it('conserve les distances', () => {
    const p = projeter(3, -4, 1.3);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(5);
  });
});

describe('placerRepere', () => {
  it('un repère dans le disque reste où il est', () => {
    const r = placerRepere(20, -10, 75, 10);
    expect(r.dehors).toBe(false);
    expect(r.x).toBe(20);
    expect(r.y).toBe(-10);
  });

  it('un repère hors du disque est ramené sur le cercle, dans la même direction', () => {
    const r = placerRepere(0, -300, 75, 10);
    expect(r.dehors).toBe(true);
    expect(r.x).toBeCloseTo(0);
    expect(r.y).toBeCloseTo(-65);
    expect(r.angle).toBeCloseTo(-Math.PI / 2);
  });
});

describe('decalagesTuiles', () => {
  it('commence par la tuile du joueur et va du proche au lointain', () => {
    const l = decalagesTuiles(120, 16);
    expect(l[0]).toEqual({ di: 0, dj: 0 });
    for (let i = 1; i < l.length; i++) {
      expect(Math.hypot(l[i].di, l[i].dj)).toBeGreaterThanOrEqual(Math.hypot(l[i - 1].di, l[i - 1].dj) - 1e-9);
    }
  });

  it('couvre tout le disque et ignore les coins', () => {
    const l = decalagesTuiles(120, 16);
    expect(l.some((t) => t.di === 7 && t.dj === 0)).toBe(true);
    expect(l.some((t) => t.di === 9 && t.dj === 9)).toBe(false);
    expect(l.length).toBeLessThan(19 * 19);
  });
});
