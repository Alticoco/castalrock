import { describe, expect, it } from 'vitest';
import {
  ajouter,
  ajouterButin,
  compter,
  creerConteneur,
  definitionObjet,
  deplacerPile,
  glisserPile,
  peutAjouterButin,
  retirer,
} from './inventaire';

const MAX = definitionObjet('bois').pileMax;

describe('inventaire', () => {
  it('crée un conteneur vide', () => {
    const c = creerConteneur(4);
    expect(c.cases).toEqual([null, null, null, null]);
  });

  it('empile dans la même case puis remplit les cases vides', () => {
    let c = creerConteneur(3);
    c = ajouter(c, 'bois', 10).conteneur;
    c = ajouter(c, 'bois', 5).conteneur;
    expect(c.cases[0]).toEqual({ objet: 'bois', quantite: 15 });
    expect(c.cases[1]).toBeNull();
    c = ajouter(c, 'pierre', 2).conteneur;
    expect(c.cases[1]).toEqual({ objet: 'pierre', quantite: 2 });
  });

  it('déborde sur une nouvelle case quand la pile est pleine', () => {
    let c = creerConteneur(3);
    const r = ajouter(c, 'bois', MAX + 7);
    c = r.conteneur;
    expect(r.reste).toBe(0);
    expect(c.cases[0]).toEqual({ objet: 'bois', quantite: MAX });
    expect(c.cases[1]).toEqual({ objet: 'bois', quantite: 7 });
  });

  it('renvoie le reste qui ne rentre pas et ne modifie pas le conteneur d\'origine', () => {
    const c = creerConteneur(2);
    const r = ajouter(c, 'bois', 2 * MAX + 5);
    expect(r.reste).toBe(5);
    expect(compter(r.conteneur, 'bois')).toBe(2 * MAX);
    expect(c.cases).toEqual([null, null]);
  });

  it('ignore une quantité nulle ou négative', () => {
    const c = creerConteneur(2);
    expect(ajouter(c, 'bois', 0)).toEqual({ conteneur: c, reste: 0 });
    expect(ajouter(c, 'bois', -3)).toEqual({ conteneur: c, reste: 0 });
  });

  it('retire en vidant les dernières piles, et plafonne à ce qui existe', () => {
    let c = creerConteneur(3);
    c = ajouter(c, 'bois', MAX + 10).conteneur;
    const r = retirer(c, 'bois', 15);
    expect(r.retire).toBe(15);
    expect(r.conteneur.cases[0]).toEqual({ objet: 'bois', quantite: MAX - 5 });
    expect(r.conteneur.cases[1]).toBeNull();
    const trop = retirer(c, 'bois', 1000);
    expect(trop.retire).toBe(MAX + 10);
    expect(compter(trop.conteneur, 'bois')).toBe(0);
    expect(retirer(c, 'pierre', 3).retire).toBe(0);
  });

  it('compte un objet réparti sur plusieurs cases', () => {
    let c = creerConteneur(4);
    c = ajouter(c, 'bois', MAX + 3).conteneur;
    c = ajouter(c, 'baies', 2).conteneur;
    expect(compter(c, 'bois')).toBe(MAX + 3);
  });

  it('un butin plein ne rentre pas : pré-vérification et reste', () => {
    let c = creerConteneur(1);
    c = ajouter(c, 'bois', MAX - 1).conteneur;
    expect(peutAjouterButin(c, { bois: 1 })).toBe(true);
    expect(peutAjouterButin(c, { bois: 2 })).toBe(false);
    expect(peutAjouterButin(c, { pierre: 1 })).toBe(false);
    const r = ajouterButin(c, { bois: 3, pierre: 2 });
    expect(r.reste).toEqual({ bois: 2, pierre: 2 });
    expect(compter(r.conteneur, 'bois')).toBe(MAX);
  });

  it('déplace une pile entre deux conteneurs', () => {
    let inv = creerConteneur(2);
    inv = ajouter(inv, 'bois', 12).conteneur;
    const sac = creerConteneur(1);
    const r = deplacerPile(inv, 0, sac);
    expect(r.deplace).toBe(12);
    expect(r.source.cases[0]).toBeNull();
    expect(r.destination.cases[0]).toEqual({ objet: 'bois', quantite: 12 });
  });

  it('déplace une pile en la fusionnant avec celle de la destination', () => {
    let inv = creerConteneur(2);
    inv = ajouter(inv, 'bois', 10).conteneur;
    let sac = creerConteneur(1);
    sac = ajouter(sac, 'bois', MAX - 4).conteneur;
    const r = deplacerPile(inv, 0, sac);
    expect(r.deplace).toBe(4);
    expect(r.source.cases[0]).toEqual({ objet: 'bois', quantite: 6 });
    expect(r.destination.cases[0]).toEqual({ objet: 'bois', quantite: MAX });
  });

  it('ne déplace rien vers un conteneur plein ou depuis une case vide', () => {
    let inv = creerConteneur(2);
    inv = ajouter(inv, 'bois', 5).conteneur;
    const sac = ajouter(creerConteneur(1), 'pierre', 1).conteneur;
    const plein = deplacerPile(inv, 0, sac);
    expect(plein.deplace).toBe(0);
    expect(plein.source).toBe(inv);
    expect(deplacerPile(inv, 1, sac).deplace).toBe(0);
    expect(deplacerPile(inv, 9, sac).deplace).toBe(0);
  });
});

describe('butin des ennemis', () => {
  it('connaît la fourrure de loup, qui s\'empile comme une ressource', () => {
    const def = definitionObjet('fourrure');
    expect(def.nom).toBe('fourrure de loup');
    expect(def.categorie).toBe('ressource');
    expect(def.pileMax).toBe(MAX);
  });
});

describe('glisserPile', () => {
  const conteneur = (...cases: Array<[string, number] | null>) => ({
    cases: cases.map((c) => (c ? { objet: c[0], quantite: c[1] } : null)),
  });

  it('déplace la pile dans une case vide du même conteneur', () => {
    const c = conteneur(['bois', 5], null, null);
    const r = glisserPile(c, 0, c, 2, true);
    expect(r.change).toBe(true);
    expect(r.source.cases).toEqual([null, null, { objet: 'bois', quantite: 5 }]);
    expect(r.destination).toBe(r.source);
  });

  it('reconnaît le même conteneur même si l’appelant dit le contraire (rien ne se duplique)', () => {
    const c = conteneur(['bois', 5], ['pierre', 2]);
    const r = glisserPile(c, 0, c, 1, false);
    expect(r.source.cases).toEqual([{ objet: 'pierre', quantite: 2 }, { objet: 'bois', quantite: 5 }]);
    expect(r.destination).toBe(r.source);
  });

  it('empile le même objet et laisse le reste dans la case de départ', () => {
    const c = conteneur(['bois', MAX - 2], ['bois', 5]);
    const r = glisserPile(c, 1, c, 0, true);
    expect(r.source.cases[0]).toEqual({ objet: 'bois', quantite: MAX });
    expect(r.source.cases[1]).toEqual({ objet: 'bois', quantite: 3 });
  });

  it('vide la case de départ quand tout rentre', () => {
    const c = conteneur(['bois', 10], ['bois', 5]);
    const r = glisserPile(c, 1, c, 0, true);
    expect(r.source.cases).toEqual([{ objet: 'bois', quantite: 15 }, null]);
  });

  it('échange deux objets différents', () => {
    const c = conteneur(['bois', 4], ['pierre', 7]);
    const r = glisserPile(c, 0, c, 1, true);
    expect(r.source.cases).toEqual([{ objet: 'pierre', quantite: 7 }, { objet: 'bois', quantite: 4 }]);
  });

  it('ne change rien : même case, départ vide, hors limites, pile pleine', () => {
    const c = conteneur(['bois', MAX], ['bois', 3], null);
    expect(glisserPile(c, 0, c, 0, true).change).toBe(false);
    expect(glisserPile(c, 2, c, 0, true).change).toBe(false);
    expect(glisserPile(c, 0, c, 9, true).change).toBe(false);
    expect(glisserPile(c, 9, c, 0, true).change).toBe(false);
    expect(glisserPile(c, 1, c, 0, true).change).toBe(false);
    expect(glisserPile(c, 0, c, -1, true).source).toBe(c);
  });

  it('déplace vers un autre conteneur (case vide)', () => {
    const a = conteneur(['bois', 5], null);
    const b = conteneur(null, null);
    const r = glisserPile(a, 0, b, 1, false);
    expect(r.change).toBe(true);
    expect(r.source.cases).toEqual([null, null]);
    expect(r.destination.cases).toEqual([null, { objet: 'bois', quantite: 5 }]);
  });

  it('empile et échange entre deux conteneurs', () => {
    const a = conteneur(['bois', 10], ['pierre', 2]);
    const b = conteneur(['bois', MAX - 4], ['charbon', 1]);
    const empile = glisserPile(a, 0, b, 0, false);
    expect(empile.source.cases[0]).toEqual({ objet: 'bois', quantite: 6 });
    expect(empile.destination.cases[0]).toEqual({ objet: 'bois', quantite: MAX });
    const echange = glisserPile(a, 1, b, 1, false);
    expect(echange.source.cases[1]).toEqual({ objet: 'charbon', quantite: 1 });
    expect(echange.destination.cases[1]).toEqual({ objet: 'pierre', quantite: 2 });
  });

  it('ne modifie jamais les conteneurs donnés', () => {
    const a = conteneur(['bois', 10], null);
    const b = conteneur(['pierre', 1], null);
    const avantA = JSON.stringify(a);
    const avantB = JSON.stringify(b);
    glisserPile(a, 0, a, 1, true);
    glisserPile(a, 0, b, 0, false);
    glisserPile(a, 0, b, 1, false);
    expect(JSON.stringify(a)).toBe(avantA);
    expect(JSON.stringify(b)).toBe(avantB);
  });
});
