import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { facteurLumiere, formaterHeure, heureDuJeu, phaseDeLHeure } from './temps';

const R = CONFIG.temps;

describe('heureDuJeu', () => {
  it("commence à l'heure de départ (8 h)", () => {
    expect(heureDuJeu(0, R)).toBe(8);
  });
  it('avance de 24 h en une durée de journée et reboucle', () => {
    expect(heureDuJeu(R.dureeJourSecondes, R)).toBeCloseTo(8, 9);
    expect(heureDuJeu(R.dureeJourSecondes / 2, R)).toBeCloseTo(20, 9);
    expect(heureDuJeu(R.dureeJourSecondes * 3.5, R)).toBeCloseTo(20, 9);
  });
  it('reste dans [0, 24[ même pour un temps négatif', () => {
    for (const t of [-5000, -1, 0, 777, 99999]) {
      const h = heureDuJeu(t, R);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
    }
  });
  it('respecte une durée de journée réglée', () => {
    expect(heureDuJeu(10, { ...R, dureeJourSecondes: 240 })).toBeCloseTo(9, 9);
  });
});

describe('phaseDeLHeure', () => {
  it('donne la bonne phase', () => {
    expect(phaseDeLHeure(8, R)).toBe('jour');
    expect(phaseDeLHeure(5, R)).toBe('aube');
    expect(phaseDeLHeure(18, R)).toBe('crepuscule');
    expect(phaseDeLHeure(23, R)).toBe('nuit');
    expect(phaseDeLHeure(1, R)).toBe('nuit');
  });
  it('la nuit dure environ un quart de la journée', () => {
    let pasNuit = 0;
    const pas = 0.01;
    for (let h = 0; h < 24; h += pas) if (phaseDeLHeure(h, R) === 'nuit') pasNuit++;
    expect((pasNuit * pas) / 24).toBeCloseTo(0.25, 2);
  });
});

describe('facteurLumiere', () => {
  it('vaut 1 de jour, 0 de nuit', () => {
    expect(facteurLumiere(12, R)).toBe(1);
    expect(facteurLumiere(0, R)).toBe(0);
    expect(facteurLumiere(22, R)).toBe(0);
  });
  it('est continu et reste entre 0 et 1', () => {
    let precedent = facteurLumiere(0, R);
    for (let h = 0.001; h <= 24; h += 0.001) {
      const f = facteurLumiere(h, R);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(1);
      expect(Math.abs(f - precedent)).toBeLessThan(0.01);
      precedent = f;
    }
  });
  it("monte à l'aube et descend au crépuscule", () => {
    expect(facteurLumiere(4, R)).toBeGreaterThan(0);
    expect(facteurLumiere(4, R)).toBeLessThan(facteurLumiere(6, R));
    expect(facteurLumiere(19, R)).toBeLessThan(facteurLumiere(18, R));
    expect(facteurLumiere(19, R)).toBeGreaterThan(0);
  });
});

describe('formaterHeure', () => {
  it('écrit hh:mm', () => {
    expect(formaterHeure(8)).toBe('08:00');
    expect(formaterHeure(13.5)).toBe('13:30');
  });
});
