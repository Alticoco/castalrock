import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { bornerSensibilite, bornerVolume, creerFiltreSouris } from './reglages';

describe('réglages', () => {
  it('borne la sensibilité et l’arrondit au pas', () => {
    const { min, max, defaut } = CONFIG.cameras.reglageSensibilite;
    expect(bornerSensibilite(0)).toBe(min);
    expect(bornerSensibilite(99)).toBe(max);
    expect(bornerSensibilite(1.04)).toBe(1);
    expect(bornerSensibilite(1.26)).toBe(1.3);
    expect(bornerSensibilite(Number.NaN)).toBe(defaut);
  });

  it('borne un volume entre 0 et 1', () => {
    expect(bornerVolume(-0.3, 0.5)).toBe(0);
    expect(bornerVolume(4, 0.5)).toBe(1);
    expect(bornerVolume(0.456, 0.5)).toBe(0.46);
    expect(bornerVolume(Number.NaN, 0.5)).toBe(0.5);
  });

  it('ignore un saut de souris faux arrivé d’un coup', () => {
    const filtre = creerFiltreSouris();
    for (let i = 0; i < 10; i++) expect(filtre.accepter(5, -3)).toBe(true);
    expect(filtre.accepter(900, 0)).toBe(false);
    // Le mouvement suivant, normal, passe
    expect(filtre.accepter(6, 2)).toBe(true);
  });

  it('laisse passer un vrai geste rapide qui monte progressivement', () => {
    const filtre = creerFiltreSouris();
    for (const v of [20, 60, 120, 200, 300, 420, 550, 600]) expect(filtre.accepter(v, 0)).toBe(true);
  });
});
