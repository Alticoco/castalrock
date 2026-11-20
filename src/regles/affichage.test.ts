import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { estDistanceVue, estQualiteOmbres, parametresVue, resolutionOmbres } from './affichage';

describe('parametresVue', () => {
  it("la distance moyenne redonne le brouillard et la portée d'origine", () => {
    const p = parametresVue('moyenne');
    expect(p.rayonChargement).toBe(CONFIG.monde.rayonChargement);
    expect(p.brouillardDebut).toBe(CONFIG.brouillard.debut);
    expect(p.brouillardFin).toBe(CONFIG.brouillard.fin);
    expect(p.distanceMax).toBe(CONFIG.distanceMax);
  });
  it('courte < moyenne < longue, et le brouillard reste dans la portée', () => {
    const c = parametresVue('courte');
    const m = parametresVue('moyenne');
    const l = parametresVue('longue');
    expect(c.distanceMax).toBeLessThan(m.distanceMax);
    expect(m.distanceMax).toBeLessThan(l.distanceMax);
    for (const p of [c, m, l]) {
      expect(p.brouillardDebut).toBeLessThan(p.brouillardFin);
      expect(p.brouillardFin).toBeLessThanOrEqual(p.distanceMax);
      expect(p.rayonDechargement).toBeGreaterThan(p.rayonChargement);
    }
  });
});

describe('choix valides', () => {
  it('reconnaît les choix connus et refuse le reste', () => {
    expect(estDistanceVue('longue')).toBe(true);
    expect(estDistanceVue('énorme')).toBe(false);
    expect(estDistanceVue(3)).toBe(false);
    expect(estQualiteOmbres('aucune')).toBe(true);
    expect(estQualiteOmbres(undefined)).toBe(false);
  });
  it("les ombres éteintes ont une résolution nulle, les autres augmentent", () => {
    expect(resolutionOmbres('aucune')).toBe(0);
    expect(resolutionOmbres('moyennes')).toBeLessThan(resolutionOmbres('hautes'));
  });
});
