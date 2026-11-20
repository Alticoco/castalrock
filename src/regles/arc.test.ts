import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { avancerFleche, butCompense, butinDepeceur, creerFleche, peutTirer, tensionArc, tirDeFleche } from './arc';
import { creerProjectile, type ImpactProjectile } from './sorts';

const A = CONFIG.arc;
const plat = () => 0;

describe('arc', () => {
  it('la tension monte avec la durée du clic et plafonne à 1', () => {
    expect(tensionArc(0)).toBe(0);
    expect(tensionArc(-1)).toBe(0);
    expect(tensionArc(A.dureeTension / 2)).toBeCloseTo(0.5);
    expect(tensionArc(A.dureeTension)).toBe(1);
    expect(tensionArc(10)).toBe(1);
  });

  it('un clic trop bref ne tire pas', () => {
    expect(peutTirer(0)).toBe(false);
    expect(peutTirer(A.tensionMin)).toBe(true);
    expect(peutTirer(1)).toBe(true);
  });

  it('une flèche plus tendue frappe plus fort et part plus vite', () => {
    const faible = tirDeFleche(A.tensionMin);
    const pleine = tirDeFleche(1);
    expect(pleine.degats).toBe(A.degatsMax);
    expect(pleine.vitesse).toBe(A.vitesseMax);
    expect(faible.degats).toBeLessThan(pleine.degats);
    expect(faible.vitesse).toBeLessThan(pleine.vitesse);
  });

  it('un lapin meurt en une flèche, même peu tendue', () => {
    expect(tirDeFleche(A.tensionMin).degats).toBeGreaterThanOrEqual(CONFIG.animaux.lapin.pv);
  });

  it('Tir chargé : ×1,5 et plus loin, à pleine tension seulement', () => {
    const C = CONFIG.progression.arbre.tirCharge;
    const charge = tirDeFleche(1, true);
    expect(charge.charge).toBe(true);
    expect(charge.degats).toBe(Math.round(A.degatsMax * C.degats));
    expect(charge.portee).toBeGreaterThan(tirDeFleche(1).portee);
    expect(charge.vitesse).toBeGreaterThan(tirDeFleche(1).vitesse);
    expect(tirDeFleche(0.9, true).charge).toBe(false);
    expect(tirDeFleche(0.9, true).degats).toBe(tirDeFleche(0.9).degats);
  });

  it('la flèche avance et tombe un peu', () => {
    const f = creerFleche(creerProjectile({ x: 0, y: 50, z: 0 }, { x: 0, y: 50, z: 10 }), tirDeFleche(1));
    const r = avancerFleche(f, 0.5, [], plat);
    expect(r.impact).toBeNull();
    expect(r.fleche).not.toBeNull();
    expect(r.fleche!.z).toBeCloseTo(A.vitesseMax * 0.5);
    expect(r.fleche!.y).toBeLessThan(50);
    expect(r.fleche!.y).toBeGreaterThan(50 - A.gravite * 0.5 * 0.5);
  });

  it('la flèche touche la cible sur sa route', () => {
    const f = creerFleche(creerProjectile({ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 10 }), tirDeFleche(1));
    const cible = { id: 'lapin', x: 0, y: 0, z: 8, rayon: 0.22, hauteur: 1.5 };
    const r = avancerFleche(f, 0.5, [cible], plat);
    expect(r.fleche).toBeNull();
    expect(r.impact?.cible).toBe('lapin');
  });

  it('la flèche qui manque se plante dans le sol', () => {
    let f = creerFleche(creerProjectile({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 1.5, z: 10 }), tirDeFleche(A.tensionMin));
    let impact: ImpactProjectile | null = null;
    for (let i = 0; i < 400; i++) {
      const r = avancerFleche(f, 1 / 60, [], plat);
      impact = r.impact;
      if (!r.fleche) break;
      f = r.fleche;
    }
    expect(impact).not.toBeNull();
    expect(impact!.cible).toBeNull();
    expect(impact!.y).toBe(0);
    expect(impact!.z).toBeGreaterThan(3);
  });

  it('à courte distance, la flèche arrive sur le point visé malgré sa chute', () => {
    const depart = { x: 0, y: 1.5, z: 0 };
    const but = { x: 0, y: 1.5, z: 15 };
    for (const tension of [A.tensionMin, 1]) {
      const tir = tirDeFleche(tension);
      let f = creerFleche(creerProjectile(depart, butCompense(depart, but, tir.vitesse)), tir);
      while (f.z < 15) f = avancerFleche(f, 1 / 240, [], () => -100).fleche!;
      expect(Math.abs(f.y - 1.5)).toBeLessThan(0.25);
    }
    // Sans correction, la flèche peu tendue arrive nettement plus bas
    const tir = tirDeFleche(A.tensionMin);
    let f = creerFleche(creerProjectile(depart, but), tir);
    while (f.z < 15) f = avancerFleche(f, 1 / 240, [], () => -100).fleche!;
    expect(f.y).toBeLessThan(1);
  });

  it('la flèche disparaît au bout de sa portée', () => {
    const tir = { ...tirDeFleche(1), portee: 5 };
    const f = creerFleche(creerProjectile({ x: 0, y: 500, z: 0 }, { x: 0, y: 500, z: 10 }), tir);
    const r = avancerFleche(f, 1, [], plat);
    expect(r.fleche).toBeNull();
    expect(r.impact).toBeNull();
  });

  it('Dépeceur : de la viande en plus, ou du cuir à défaut', () => {
    const plus = CONFIG.progression.arbre.depeceur;
    expect(butinDepeceur({ 'viande-crue': 2, cuir: 1 })).toEqual({ 'viande-crue': 2 + plus, cuir: 1 });
    expect(butinDepeceur({ 'fourrure-renard': 1 })).toEqual({ 'fourrure-renard': 1, cuir: plus });
  });
});
