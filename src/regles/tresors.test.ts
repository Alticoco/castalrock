import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { definitionObjet } from './inventaire';
import { butinCoffre, butinCoffreCamp, coffreAPortee, contenuDuCoffre, estOuvert, garderReste, lireCoffresEntames, lireCoffresOuverts, ouvrirCoffre } from './tresors';

const B = CONFIG.ruines.butin;

describe('butinCoffre', () => {
  it('même graine et même coffre = même contenu', () => {
    expect(butinCoffre(12345, 'co:ru:3:-2', false)).toEqual(butinCoffre(12345, 'co:ru:3:-2', false));
  });

  it('toujours un peu d’or, dans les bornes ; des objets connus en quantité valide', () => {
    for (let k = 0; k < 200; k++) {
      const piles = butinCoffre(12345, `co:ru:${k}:${-k}`, false);
      expect(piles[0].objet).toBe('or');
      expect(piles[0].quantite).toBeGreaterThanOrEqual(B.or.min);
      expect(piles[0].quantite).toBeLessThanOrEqual(B.or.max);
      for (const p of piles) {
        expect(['or', 'potion-soin', 'cristal-bleu', 'lingot-cuivre', 'lingot-fer']).toContain(p.objet);
        expect(Number.isInteger(p.quantite) && p.quantite >= 1).toBe(true);
        expect(definitionObjet(p.objet).id).toBe(p.objet);
      }
      expect(new Set(piles.map((p) => p.objet)).size).toBe(piles.length);
    }
  });

  it('le contenu varie d’un coffre à l’autre et d’une graine à l’autre', () => {
    const contenus = new Set<string>();
    for (let k = 0; k < 60; k++) contenus.add(JSON.stringify(butinCoffre(12345, `co:ru:${k}:0`, false)));
    expect(contenus.size).toBeGreaterThan(20);
    const autres = Array.from({ length: 20 }, (_, k) => JSON.stringify(butinCoffre(999, `co:ru:${k}:0`, false)));
    const memes = Array.from({ length: 20 }, (_, k) => JSON.stringify(butinCoffre(12345, `co:ru:${k}:0`, false)));
    expect(autres).not.toEqual(memes);
  });

  it('une potion souvent, des cristaux parfois (plus souvent en grotte), des lingots parfois', () => {
    const part = (objet: string, grotte: boolean) => {
      let n = 0;
      for (let k = 0; k < 600; k++) if (butinCoffre(7, `co:gr:${k}:1`, grotte).some((p) => p.objet === objet)) n++;
      return n / 600;
    };
    expect(part('potion-soin', false)).toBeGreaterThan(B.potion.chance - 0.08);
    expect(part('potion-soin', false)).toBeLessThan(B.potion.chance + 0.08);
    expect(part('cristal-bleu', false)).toBeLessThan(B.cristaux.chance + 0.08);
    expect(part('cristal-bleu', true)).toBeGreaterThan(B.cristaux.chanceGrotte - 0.08);
    expect(part('lingot-fer', false)).toBeGreaterThan(0.05);
    expect(part('lingot-cuivre', false)).toBeGreaterThan(0.1);
  });
});

describe('coffres ouverts', () => {
  it('un coffre s’ouvre une seule fois', () => {
    let ouverts: string[] = [];
    expect(estOuvert(ouverts, 'co:ru:1:1')).toBe(false);
    ouverts = ouvrirCoffre(ouverts, 'co:ru:1:1');
    ouverts = ouvrirCoffre(ouverts, 'co:ru:1:1');
    expect(ouverts).toEqual(['co:ru:1:1']);
    expect(estOuvert(ouverts, 'co:ru:1:1')).toBe(true);
    expect(estOuvert(ouverts, 'co:gr:1:1')).toBe(false);
  });

  it('coffreAPortee : le plus proche encore fermé, dans la portée', () => {
    const coffres = [
      { id: 'co:ru:0:0', x: 1, z: 0 },
      { id: 'co:ru:1:0', x: 1.5, z: 0 },
      { id: 'co:gr:5:5', x: 30, z: 0 },
    ];
    expect(coffreAPortee(coffres, [], 0, 0, 2)?.id).toBe('co:ru:0:0');
    expect(coffreAPortee(coffres, ['co:ru:0:0'], 0, 0, 2)?.id).toBe('co:ru:1:0');
    expect(coffreAPortee(coffres, ['co:ru:0:0', 'co:ru:1:0'], 0, 0, 2)).toBeNull();
    expect(coffreAPortee(coffres, [], 0, 0, 0.5)).toBeNull();
  });

  it('lireCoffresOuverts : liste valide, absente (ancienne sauvegarde) ou abîmée', () => {
    expect(lireCoffresOuverts(['co:ru:2:-3', 'co:gr:0:4'])).toEqual(['co:ru:2:-3', 'co:gr:0:4']);
    expect(lireCoffresOuverts(['co:ru:2:-3', 'co:ru:2:-3'])).toEqual(['co:ru:2:-3']);
    expect(lireCoffresOuverts(undefined)).toEqual([]);
    expect(lireCoffresOuverts([])).toEqual([]);
    expect(lireCoffresOuverts('co:ru:1:1')).toBeNull();
    expect(lireCoffresOuverts(null)).toBeNull();
    expect(lireCoffresOuverts(['n’importe quoi'])).toBeNull();
    expect(lireCoffresOuverts([12])).toBeNull();
  });
});

describe('coffres entamés', () => {
  const id = 'co:ru:2:-3';
  it('le contenu est tiré de la graine tant que le coffre n\'est pas entamé, puis c\'est le reste gardé', () => {
    expect(contenuDuCoffre({}, 42, id, false)).toEqual(butinCoffre(42, id, false));
    const reste = [{ objet: 'or', quantite: 7 }];
    expect(contenuDuCoffre({ [id]: reste }, 42, id, false)).toEqual(reste);
  });
  it('garderReste note le reste, et le retire quand il est vide', () => {
    const entames = garderReste({}, id, [{ objet: 'or', quantite: 7 }]);
    expect(entames[id]).toEqual([{ objet: 'or', quantite: 7 }]);
    expect(garderReste(entames, id, [])).toEqual({});
  });
  it('lit les coffres entamés sauvegardés, refuse ceux qui sont abîmés', () => {
    expect(lireCoffresEntames(undefined)).toEqual({});
    expect(lireCoffresEntames({ [id]: [{ objet: 'or', quantite: 7 }] })).toEqual({ [id]: [{ objet: 'or', quantite: 7 }] });
    expect(lireCoffresEntames({ truc: [{ objet: 'or', quantite: 7 }] })).toBeNull();
    expect(lireCoffresEntames({ [id]: [] })).toBeNull();
    expect(lireCoffresEntames({ [id]: [{ objet: 'or', quantite: 0 }] })).toBeNull();
    expect(lireCoffresEntames([])).toBeNull();
  });
});

describe('butinCoffreCamp', () => {
  const R = CONFIG.lieux.camp.butin;
  const ids = ['camp:coffre:0', 'camp:coffre:1', 'camp:coffre:2'];

  it('même graine et même coffre = même contenu', () => {
    for (const id of ids) expect(butinCoffreCamp(12345, id)).toEqual(butinCoffreCamp(12345, id));
  });

  it('or dans les bornes, 2 à 3 ressources volées de 4 à 10, sans doublon, objets connus', () => {
    for (let graine = 1; graine <= 200; graine++) {
      for (const id of ids) {
        const piles = butinCoffreCamp(graine, id);
        expect(piles[0].objet).toBe('or');
        expect(piles[0].quantite).toBeGreaterThanOrEqual(25);
        expect(piles[0].quantite).toBeLessThanOrEqual(45);
        const ressources = piles.filter((p) => R.ressources.includes(p.objet));
        expect(ressources.length).toBeGreaterThanOrEqual(2);
        expect(ressources.length).toBeLessThanOrEqual(3);
        for (const p of ressources) {
          expect(p.quantite).toBeGreaterThanOrEqual(4);
          expect(p.quantite).toBeLessThanOrEqual(10);
        }
        expect(new Set(piles.map((p) => p.objet)).size).toBe(piles.length);
        for (const p of piles) expect(definitionObjet(p.objet).id).toBe(p.objet);
      }
    }
  });

  it('le coffre de Morvan a toujours 2 à 3 lingots de fer ; les autres parfois 1 à 2', () => {
    let autres = 0;
    for (let graine = 1; graine <= 300; graine++) {
      const lingots = butinCoffreCamp(graine, 'camp:coffre:0').find((p) => p.objet === 'lingot-fer');
      expect(lingots).toBeDefined();
      expect(lingots!.quantite).toBeGreaterThanOrEqual(2);
      expect(lingots!.quantite).toBeLessThanOrEqual(3);
      const l = butinCoffreCamp(graine, 'camp:coffre:1').find((p) => p.objet === 'lingot-fer');
      if (l) {
        autres++;
        expect(l.quantite).toBeLessThanOrEqual(2);
      }
    }
    expect(autres).toBeGreaterThan(30);
    expect(autres).toBeLessThan(250);
  });

  it('une potion de soin parfois', () => {
    let n = 0;
    for (let graine = 1; graine <= 300; graine++) if (butinCoffreCamp(graine, 'camp:coffre:2').some((p) => p.objet === 'potion-soin')) n++;
    expect(n).toBeGreaterThan(30);
    expect(n).toBeLessThan(250);
  });

  it('contenuDuCoffre, la sauvegarde et la liste des ouverts reconnaissent les coffres du camp', () => {
    expect(contenuDuCoffre({}, 12345, 'camp:coffre:0', false)).toEqual(butinCoffreCamp(12345, 'camp:coffre:0'));
    expect(lireCoffresOuverts(['camp:coffre:1', 'co:ru:1:2'])).toEqual(['camp:coffre:1', 'co:ru:1:2']);
    expect(lireCoffresOuverts(['camp:coffre:x'])).toBeNull();
    const reste = [{ objet: 'or', quantite: 5 }];
    expect(lireCoffresEntames({ 'camp:coffre:2': reste })).toEqual({ 'camp:coffre:2': reste });
  });
});
