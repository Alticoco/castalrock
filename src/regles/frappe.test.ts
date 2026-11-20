import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerEtatCharge, creerEtatFrappe, facteurCoupEpee, pasDeCharge, pasDeFrappe, progressionCharge, type EtatCharge, type FinDeCharge } from './frappe';

/** Maintient le clic `secondes`, puis le relâche : renvoie ce que le relâchement déclenche. */
function maintenirPuisRelacher(secondes: number): FinDeCharge {
  let etat: EtatCharge = creerEtatCharge();
  const dt = 1 / 60;
  for (let t = 0; t < secondes; t += dt) {
    const r = pasDeCharge(etat, true, dt);
    expect(r.fin).toBe('aucune');
    etat = r.etat;
  }
  const fin = pasDeCharge(etat, false, dt);
  expect(fin.etat.temps).toBe(-1);
  return fin.fin;
}

describe('coup puissant', () => {
  it('un clic court donne un coup normal au relâchement', () => {
    expect(maintenirPuisRelacher(0.05)).toBe('normale');
    expect(maintenirPuisRelacher(0.6)).toBe('normale');
  });

  it('un clic maintenu 1 s donne un coup puissant au relâchement', () => {
    expect(CONFIG.progression.arbre.coupPuissant.duree).toBe(1);
    expect(maintenirPuisRelacher(1.05)).toBe('puissante');
    expect(maintenirPuisRelacher(3)).toBe('puissante');
  });

  it('sans clic, rien ne part', () => {
    const etat = creerEtatCharge();
    expect(pasDeCharge(etat, false, 0.1)).toEqual({ etat, fin: 'aucune' });
  });

  it("l'épée ne recule qu'après un court délai, et la charge est pleine à 1 s", () => {
    expect(progressionCharge(creerEtatCharge())).toBe(0);
    expect(progressionCharge({ temps: 0.1 })).toBe(0);
    expect(progressionCharge({ temps: 0.6 })).toBeGreaterThan(0.3);
    expect(progressionCharge({ temps: 0.6 })).toBeLessThan(1);
    expect(progressionCharge({ temps: 1 })).toBe(1);
    expect(progressionCharge({ temps: 4 })).toBe(1);
  });

  it('fait ×2,5, et se multiplie avec la riposte', () => {
    expect(facteurCoupEpee(false)).toBe(1);
    expect(facteurCoupEpee(true)).toBe(2.5);
    expect(facteurCoupEpee(false, 2)).toBe(2);
    expect(facteurCoupEpee(true, 2)).toBe(5);
  });
});

describe('frappe (récolte) : inchangée', () => {
  it('le clic maintenu enchaîne les gestes, un impact par geste', () => {
    let etat = creerEtatFrappe();
    let impacts = 0;
    const dt = 1 / 60;
    const duree = CONFIG.personnage.frappe.duree;
    for (let t = 0; t < duree * 3 - dt; t += dt) {
      const r = pasDeFrappe(etat, true, dt);
      etat = r.etat;
      if (r.impact) impacts += 1;
    }
    expect(impacts).toBe(3);
    expect(etat.progression).toBeGreaterThanOrEqual(0);
  });
});
