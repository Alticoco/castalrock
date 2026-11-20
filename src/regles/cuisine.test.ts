import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerVieJoueur, pasVieJoueur } from './combat';
import { chercherRecette, fabriquer, recettesDuLieu, type EtatFabrication } from './fabrication';
import { estAliment, manger } from './cuisine';
import { ajouter, compter, creerConteneur } from './inventaire';
import { creerEquipement } from './equipement';

function etatAvec(objets: Record<string, number>): EtatFabrication {
  let inventaire = creerConteneur(20);
  for (const [o, q] of Object.entries(objets)) inventaire = ajouter(inventaire, o, q).conteneur;
  return { inventaire, coffre: creerConteneur(20), equipement: creerEquipement() };
}

describe('cuisine : recettes du feu', () => {
  it('le feu propose la viande cuite et le ragoût, avec les ingrédients voulus', () => {
    expect(recettesDuLieu('feu').map((r) => r.id)).toEqual(['viande-cuite', 'ragout']);
    expect(chercherRecette('ragout')!.ingredients).toEqual([
      { objet: 'viande-cuite', quantite: 2 },
      { objet: 'plante-medicinale', quantite: 1 },
      { objet: 'baies', quantite: 2 },
    ]);
  });

  it('cuit une viande crue, puis prépare un ragoût', () => {
    const r = fabriquer(etatAvec({ 'viande-crue': 3 }), 'viande-cuite');
    expect(r.ok).toBe(true);
    expect(compter(r.etat.inventaire, 'viande-crue')).toBe(2);
    expect(compter(r.etat.inventaire, 'viande-cuite')).toBe(1);
    const ragout = fabriquer(etatAvec({ 'viande-cuite': 2, 'plante-medicinale': 1, baies: 2 }), 'ragout');
    expect(ragout.ok).toBe(true);
    expect(compter(ragout.etat.inventaire, 'ragout')).toBe(1);
    expect(compter(ragout.etat.inventaire, 'viande-cuite')).toBe(0);
  });

  it('refuse sans ingrédients : rien n’est consommé', () => {
    const etat = etatAvec({ 'viande-cuite': 1, 'plante-medicinale': 1, baies: 2 });
    const r = fabriquer(etat, 'ragout');
    expect(r.ok).toBe(false);
    expect(r.etat).toBe(etat);
  });

  it('le piège se fabrique à l’établi avec du bois et des fibres', () => {
    const r = chercherRecette('piege')!;
    expect(r.lieu).toBe('etabli');
    expect(r.ingredients.map((i) => i.objet).sort()).toEqual(['bois', 'fibres']);
    expect(fabriquer(etatAvec({ bois: 3, fibres: 6 }), 'piege').ok).toBe(true);
  });
});

describe('cuisine : manger', () => {
  it('connaît les trois aliments seulement', () => {
    expect(['viande-crue', 'viande-cuite', 'ragout'].every(estAliment)).toBe(true);
    expect(estAliment('baies')).toBe(false);
  });

  it('viande crue : +5 PV, sans régénération', () => {
    const r = manger(creerVieJoueur(50, 100), 'viande-crue', 100);
    expect(r.ok).toBe(true);
    expect(r.vie.pv).toBe(55);
    expect(r.vie.regeneration).toBeUndefined();
  });

  it('viande cuite : +20 PV, puis 1 PV/s pendant 20 s', () => {
    const r = manger(creerVieJoueur(30, 100), 'viande-cuite', 100);
    expect(r.vie.pv).toBe(50);
    expect(r.vie.regeneration).toEqual({ parSeconde: 1, reste: 20 });
    // 10 s plus tard : +10 PV, la moitié de la durée reste (même après un coup récent)
    let vie = { ...r.vie, depuisDegats: 0 };
    for (let i = 0; i < 10; i += 1) vie = pasVieJoueur(vie, 1, 100);
    expect(vie.pv).toBeGreaterThanOrEqual(60);
    expect(vie.regeneration!.reste).toBeCloseTo(10, 5);
    for (let i = 0; i < 15; i += 1) vie = pasVieJoueur(vie, 1, 100);
    expect(vie.regeneration).toBeUndefined();
    expect(vie.pv).toBeLessThanOrEqual(100);
  });

  it('ragoût : +40 PV, puis 2 PV/s pendant 30 s', () => {
    const r = manger(creerVieJoueur(10, 100), 'ragout', 100);
    expect(r.vie.pv).toBe(50);
    expect(r.vie.regeneration).toEqual({ parSeconde: 2, reste: 30 });
    expect(CONFIG.cuisine.aliments.ragout.soin).toBe(40);
  });

  it('refuse à vie pleine ou à terre, et ne dépasse jamais le maximum', () => {
    expect(manger(creerVieJoueur(100, 100), 'ragout', 100).raison).toBe('vie-pleine');
    expect(manger(creerVieJoueur(0, 100), 'ragout', 100).raison).toBe('tombe');
    expect(manger(creerVieJoueur(95, 100), 'ragout', 100).vie.pv).toBe(100);
    expect(manger(creerVieJoueur(50, 100), 'baies', 100).raison).toBe('pas-aliment');
  });
});
