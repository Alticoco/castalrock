import { describe, expect, it } from 'vitest';
import { creerAleatoire } from './aleatoire';

describe('creerAleatoire', () => {
  it('donne la même suite pour la même graine', () => {
    const a = creerAleatoire(42);
    const b = creerAleatoire(42);
    for (let i = 0; i < 100; i++) expect(a.suivant()).toBe(b.suivant());
  });

  it('donne des suites différentes pour deux graines', () => {
    const a = creerAleatoire(1);
    const b = creerAleatoire(2);
    const suiteA = Array.from({ length: 10 }, () => a.suivant());
    const suiteB = Array.from({ length: 10 }, () => b.suivant());
    expect(suiteA).not.toEqual(suiteB);
  });

  it('respecte les bornes', () => {
    const a = creerAleatoire(7);
    for (let i = 0; i < 1000; i++) {
      const s = a.suivant();
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(1);
      const e = a.entre(-5, 5);
      expect(e).toBeGreaterThanOrEqual(-5);
      expect(e).toBeLessThan(5);
      const n = a.entier(3, 6);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  it('atteint les deux bornes de entier', () => {
    const a = creerAleatoire(99);
    const vus = new Set<number>();
    for (let i = 0; i < 500; i++) vus.add(a.entier(1, 3));
    expect([...vus].sort()).toEqual([1, 2, 3]);
  });
});
