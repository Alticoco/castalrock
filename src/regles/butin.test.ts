import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ajouter, compter, creerConteneur } from './inventaire';
import { ID_ECLAT_COEUR, butinAPortee, mettreAAbri, pilesDuButin, repartirButin, vieillirButins, type ButinAuSol } from './butin';

const pileMax = CONFIG.inventaire.pileMax;

/** Conteneur d'une case par objet différent, toutes pleines : plus aucune place. */
function rempli(nombreCases: number) {
  let c = creerConteneur(nombreCases);
  for (let i = 0; i < nombreCases; i++) c = ajouter(c, `rempli-${i}`, pileMax).conteneur;
  return c;
}

describe('repartirButin', () => {
  it("met tout dans l'inventaire porté quand il y a de la place", () => {
    const r = repartirButin(creerConteneur(4), creerConteneur(2), [{ objet: 'bois', quantite: 3 }]);
    expect(compter(r.inventaire, 'bois')).toBe(3);
    expect(compter(r.sac, 'bois')).toBe(0);
    expect(r.obtenu).toEqual({ bois: 3 });
    expect(r.reste).toEqual([]);
  });
  it('déborde dans le sac quand le porté est plein', () => {
    const r = repartirButin(rempli(2), creerConteneur(2), [{ objet: 'bois', quantite: 3 }]);
    expect(compter(r.sac, 'bois')).toBe(3);
    expect(r.reste).toEqual([]);
  });
  it('laisse le reste quand tout est plein', () => {
    const r = repartirButin(rempli(2), rempli(2), [{ objet: 'bois', quantite: 3 }]);
    expect(r.obtenu).toEqual({});
    expect(r.reste).toEqual([{ objet: 'bois', quantite: 3 }]);
  });
  it('prend ce qui rentre et laisse le reste d’une pile', () => {
    // Une seule case libre dans l'inventaire, sac plein : une pile entière rentre, pas la suivante
    let porte = rempli(1);
    porte = { cases: [...porte.cases, null] };
    const r = repartirButin(porte, rempli(1), [
      { objet: 'bois', quantite: pileMax + 4 },
      { objet: 'pierre', quantite: 2 },
    ]);
    expect(r.obtenu).toEqual({ bois: pileMax });
    expect(r.reste).toEqual([
      { objet: 'bois', quantite: 4 },
      { objet: 'pierre', quantite: 2 },
    ]);
  });
  it('ne modifie pas les conteneurs reçus', () => {
    const porte = creerConteneur(2);
    repartirButin(porte, creerConteneur(2), [{ objet: 'bois', quantite: 3 }]);
    expect(porte.cases.every((c) => c === null)).toBe(true);
  });
});

describe('pilesDuButin', () => {
  it('ignore les quantités nulles', () => {
    expect(pilesDuButin({ bois: 2, pierre: 0 })).toEqual([{ objet: 'bois', quantite: 2 }]);
  });
});

describe('sacs au sol', () => {
  const sac = (id: string, x: number, z: number, age = 0): ButinAuSol => ({ id, x, y: 0, z, contenu: [{ objet: 'bois', quantite: 1 }], age });

  it('vieillissent puis disparaissent à la fin de leur durée', () => {
    const apres = vieillirButins([sac('a', 0, 0, 0), sac('b', 0, 0, 290)], 5, 300);
    expect(apres.map((s) => [s.id, s.age])).toEqual([['a', 5], ['b', 295]]);
    expect(vieillirButins(apres, 5, 300).map((s) => s.id)).toEqual(['a']);
  });
  it('le plus proche à portée est choisi', () => {
    const sacs = [sac('loin', 10, 0), sac('pres', 1, 0), sac('moyen', 2, 0)];
    expect(butinAPortee(sacs, 0, 0, 2.5)?.id).toBe('pres');
    expect(butinAPortee(sacs, 50, 50, 2.5)).toBeNull();
  });
});

describe('mettreAAbri', () => {
  it("met l'objet dans l'inventaire quand il y a une case", () => {
    const r = mettreAAbri(creerConteneur(2), creerConteneur(2), ID_ECLAT_COEUR);
    expect(r.lieu).toBe('inventaire');
    expect(compter(r.inventaire, ID_ECLAT_COEUR)).toBe(1);
  });
  it("va dans le coffre quand l'inventaire est plein", () => {
    const r = mettreAAbri(rempli(2), creerConteneur(2), ID_ECLAT_COEUR);
    expect(r.lieu).toBe('coffre');
    expect(compter(r.coffre, ID_ECLAT_COEUR)).toBe(1);
  });
  it("agrandit le coffre plein plutôt que de perdre l'objet", () => {
    const r = mettreAAbri(rempli(2), rempli(2), ID_ECLAT_COEUR);
    expect(r.lieu).toBe('coffre');
    expect(compter(r.coffre, ID_ECLAT_COEUR)).toBe(1);
    expect(r.coffre.cases.length).toBe(3);
  });
});
