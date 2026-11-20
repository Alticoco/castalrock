import { describe, expect, it } from 'vitest';
import { arroser, contenuRecolte, creerEtatPotager, estArrose, lireEtatPotager, recoltePrete, recolter } from './potager';

describe('potager', () => {
  it("au départ, rien n'est arrosé ni à récolter", () => {
    const p = creerEtatPotager();
    expect(estArrose(p, 3)).toBe(false);
    expect(recoltePrete(p, 3)).toBe(false);
  });

  it('arrosé le jour J : pas de récolte le jour J, une récolte à partir de J+1', () => {
    const p = arroser(creerEtatPotager(), 4);
    expect(estArrose(p, 4)).toBe(true);
    expect(recoltePrete(p, 4)).toBe(false);
    expect(recoltePrete(p, 5)).toBe(true);
    expect(recoltePrete(p, 9)).toBe(true);
  });

  it('pas arrosé : rien ne pousse, rien ne se perd', () => {
    const p = creerEtatPotager();
    expect(recolter(p, 10, 1)).toEqual({ etat: p, butin: [] });
  });

  it('arroser un potager déjà arrosé ou avec une récolte qui attend ne change rien', () => {
    const p = arroser(creerEtatPotager(), 4);
    expect(arroser(p, 4)).toBe(p);
    expect(arroser(p, 6)).toBe(p);
  });

  it("récolter donne baies et plantes puis vide le potager, qu'on peut arroser de nouveau", () => {
    const p = arroser(creerEtatPotager(), 2);
    const r = recolter(p, 3, 12345);
    const baies = r.butin.find((b) => b.objet === 'baies')!;
    const plantes = r.butin.find((b) => b.objet === 'plante-medicinale')!;
    expect(baies.quantite).toBeGreaterThanOrEqual(2);
    expect(baies.quantite).toBeLessThanOrEqual(3);
    expect(plantes.quantite).toBeGreaterThanOrEqual(1);
    expect(plantes.quantite).toBeLessThanOrEqual(2);
    expect(r.etat.dernierArrosage).toBeNull();
    expect(arroser(r.etat, 3).dernierArrosage).toBe(3);
  });

  it('la récolte ne dépend que de la graine et du jour', () => {
    expect(contenuRecolte(12345, 7)).toEqual(contenuRecolte(12345, 7));
    const quantites = new Set<string>();
    for (let j = 0; j < 40; j++) quantites.add(JSON.stringify(contenuRecolte(12345, j)));
    expect(quantites.size).toBeGreaterThan(1);
  });

  it('relecture : valeur valide gardée, tout le reste donne un potager non arrosé', () => {
    expect(lireEtatPotager({ dernierArrosage: 5 }).dernierArrosage).toBe(5);
    for (const brut of [undefined, null, 3, 'x', [], {}, { dernierArrosage: -1 }, { dernierArrosage: 1.5 }, { dernierArrosage: 'a' }]) {
      expect(lireEtatPotager(brut).dernierArrosage).toBeNull();
    }
  });
});
