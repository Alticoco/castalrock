import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { retirerArmureVers, retirerCasqueVers } from './armureGlisse';
import {
  OBJETS_CASQUE,
  TYPES_CASQUE,
  creerEquipement,
  equiperArmure,
  equiperCasque,
  reductionCasque,
  reductionTotale,
  retirerCasque,
  typeCasqueDeObjet,
  user,
} from './equipement';
import { ajouter, compter, creerConteneur, definitionObjet } from './inventaire';
import { descriptionObjet } from './descriptions';
import { RECETTES, chercherRecette, fabriquer } from './fabrication';
import { appliquerMort } from './mort';

const avec = (...objets: string[]) => objets.reduce((c, o) => ajouter(c, o, 1).conteneur, creerConteneur(6));

describe('casques : objets et réductions', () => {
  it('quatre objets de pile 1, avec description et réduction croissante', () => {
    expect(TYPES_CASQUE).toHaveLength(4);
    let precedent = 0;
    for (const t of TYPES_CASQUE) {
      expect(definitionObjet(OBJETS_CASQUE[t]).pileMax).toBe(1);
      expect(typeCasqueDeObjet(OBJETS_CASQUE[t])).toBe(t);
      expect(descriptionObjet(OBJETS_CASQUE[t]).length).toBeGreaterThan(10);
      expect(reductionCasque(t)).toBeGreaterThan(precedent);
      precedent = reductionCasque(t);
    }
    expect(typeCasqueDeObjet('armure-cuir')).toBeNull();
    expect(reductionCasque(null)).toBe(0);
  });
});

describe('casques : équiper, échanger, retirer', () => {
  it("équipe un casque de l'inventaire", () => {
    const r = equiperCasque(creerEquipement(), avec('casque-cuir'), 'cuir');
    expect(r.ok).toBe(true);
    expect(r.equipement.casque).toBe('cuir');
    expect(compter(r.inventaire, 'casque-cuir')).toBe(0);
  });

  it('refuse un casque absent de l\'inventaire', () => {
    const r = equiperCasque(creerEquipement(), creerConteneur(6), 'cuir');
    expect(r.ok).toBe(false);
    expect(r.raison).toBe('aucun-casque');
  });

  it("échange avec le casque porté : l'ancien prend la place du nouveau", () => {
    const inv = { cases: [{ objet: 'bois', quantite: 2 }, { objet: 'casque-mailles', quantite: 1 }, null] };
    const r = equiperCasque({ ...creerEquipement(), casque: 'cuir' }, inv, 'mailles');
    expect(r.ok).toBe(true);
    expect(r.equipement.casque).toBe('mailles');
    expect(r.inventaire.cases[1]).toEqual({ objet: 'casque-cuir', quantite: 1 });
  });

  it('retire le casque dans l\'inventaire, ou dans la case visée', () => {
    const porte = { ...creerEquipement(), casque: 'plaques' as const };
    const r = retirerCasque(porte, creerConteneur(4));
    expect(r.ok).toBe(true);
    expect(r.equipement.casque).toBeNull();
    expect(compter(r.inventaire, 'casque-plaques')).toBe(1);
    const v = retirerCasqueVers(porte, creerConteneur(4), 2);
    expect(v.inventaire.cases[2]).toEqual({ objet: 'casque-plaques', quantite: 1 });
    expect(retirerCasque(creerEquipement(), creerConteneur(4)).ok).toBe(false);
  });

  it('refuse de retirer si l\'inventaire est plein', () => {
    const plein = { cases: [{ objet: 'bois', quantite: 1 }] };
    const r = retirerCasque({ ...creerEquipement(), casque: 'cuir' }, plein);
    expect(r.ok).toBe(false);
    expect(r.raison).toBe('inventaire-plein');
  });

  it("ne s'use pas et reste porté à la mort", () => {
    const e = { ...creerEquipement(), casque: 'mailles' as const };
    expect(user(e, 'armure', 50)).toBe(e);
    const m = appliquerMort({ inventaire: creerConteneur(4), equipement: e, baluchon: null }, 0, 0);
    expect(m.equipement.casque).toBe('mailles');
  });
});

describe('réduction totale', () => {
  const plafond = CONFIG.combat.plafondReduction;

  it('additionne armure, casque et bonus', () => {
    const e = { ...creerEquipement(), armure: 'cuir' as const, casque: 'fourrure' as const };
    expect(reductionTotale(e, 0.1)).toBeCloseTo(0.25 + 0.06 + 0.1);
    expect(reductionTotale(creerEquipement())).toBe(0);
    expect(reductionTotale({ ...creerEquipement(), casque: 'cuir' })).toBeCloseTo(0.04);
  });

  it('est plafonnée', () => {
    const e = { ...creerEquipement(), armure: 'plaques' as const, casque: 'plaques' as const };
    expect(reductionTotale(e, 0.3)).toBe(plafond);
  });

  it("l'usure de l'armure ne touche pas le casque", () => {
    const base = { ...creerEquipement(), armure: 'plaques' as const, casque: 'plaques' as const };
    const usee = { ...base, durabilite: { ...base.durabilite, armure: 0 } };
    expect(reductionTotale(usee)).toBeCloseTo(0.55 * CONFIG.durabilite.efficaciteUsee + 0.1);
  });
});

describe('casques : recettes', () => {
  it('quatre recettes avec les bons ingrédients et lieux', () => {
    expect(RECETTES.filter((r) => r.id.startsWith('casque-'))).toHaveLength(4);
    expect(chercherRecette('casque-cuir')).toMatchObject({ lieu: 'etabli', ingredients: [{ objet: 'cuir', quantite: 3 }, { objet: 'fibres', quantite: 2 }] });
    expect(chercherRecette('casque-fourrure')).toMatchObject({ lieu: 'etabli', ingredients: [{ objet: 'fourrure', quantite: 2 }, { objet: 'cuir', quantite: 1 }] });
    expect(chercherRecette('casque-mailles')).toMatchObject({ lieu: 'forge', ingredients: [{ objet: 'lingot-fer', quantite: 3 }] });
    const plaques = chercherRecette('casque-plaques');
    expect(plaques).toMatchObject({ lieu: 'forge', ingredients: [{ objet: 'lingot-acier', quantite: 3 }] });
    expect(plaques?.niveauVillageMin).toBe(CONFIG.fabrication.villageAcier);
  });

  it('fabrique un casque dans l\'inventaire', () => {
    const etat = {
      inventaire: ajouter(ajouter(creerConteneur(8), 'cuir', 3).conteneur, 'fibres', 2).conteneur,
      coffre: creerConteneur(8),
      equipement: creerEquipement(),
      niveauVillage: 1,
    };
    const r = fabriquer(etat, 'casque-cuir');
    expect(r.ok).toBe(true);
    expect(compter(r.etat.inventaire, 'casque-cuir')).toBe(1);
    expect(compter(r.etat.inventaire, 'cuir')).toBe(0);
  });
});

describe('échange sur la case cliquée (deux objets identiques)', () => {
  it('casque : le casque de la case 1 est pris, la chapka revient en case 1', () => {
    const inv = { cases: [null, { objet: 'casque-cuir', quantite: 1 }, null, null, { objet: 'casque-cuir', quantite: 1 }] };
    const r = equiperCasque({ ...creerEquipement(), casque: 'fourrure' }, inv, 'cuir', 1);
    expect(r.ok).toBe(true);
    expect(r.equipement.casque).toBe('cuir');
    expect(r.inventaire.cases[1]).toEqual({ objet: 'casque-fourrure', quantite: 1 });
    expect(r.inventaire.cases[4]).toEqual({ objet: 'casque-cuir', quantite: 1 });
  });

  it('armure : même chose', () => {
    const inv = { cases: [null, { objet: 'armure-cuir', quantite: 1 }, null, null, { objet: 'armure-cuir', quantite: 1 }] };
    const r = equiperArmure({ ...creerEquipement(), armure: 'mailles' }, inv, 'cuir', 1);
    expect(r.ok).toBe(true);
    expect(r.equipement.armure).toBe('cuir');
    expect(r.inventaire.cases[1]).toEqual({ objet: 'armure-mailles', quantite: 1 });
    expect(r.inventaire.cases[4]).toEqual({ objet: 'armure-cuir', quantite: 1 });
  });

  it("sans indice : la première case de l'objet est utilisée", () => {
    const inv = { cases: [{ objet: 'casque-cuir', quantite: 1 }, { objet: 'casque-cuir', quantite: 1 }] };
    const r = equiperCasque({ ...creerEquipement(), casque: 'mailles' }, inv, 'cuir');
    expect(r.inventaire.cases[0]).toEqual({ objet: 'casque-mailles', quantite: 1 });
    expect(r.inventaire.cases[1]).toEqual({ objet: 'casque-cuir', quantite: 1 });
  });
});

describe('glisser un équipement porté sur une case occupée', () => {
  it('casque : sur une case sans casque, va dans la première case libre', () => {
    const inv = { cases: [{ objet: 'bois', quantite: 1 }, null] };
    const r = retirerCasqueVers({ ...creerEquipement(), casque: 'cuir' }, inv, 0);
    expect(r.ok).toBe(true);
    expect(r.inventaire.cases[1]).toEqual({ objet: 'casque-cuir', quantite: 1 });
    expect(r.inventaire.cases[0]).toEqual({ objet: 'bois', quantite: 1 });
  });

  it("casque : sur une case qui contient un autre casque, les deux s'échangent", () => {
    const inv = { cases: [null, { objet: 'casque-plaques', quantite: 1 }] };
    const r = retirerCasqueVers({ ...creerEquipement(), casque: 'cuir' }, inv, 1);
    expect(r.ok).toBe(true);
    expect(r.equipement.casque).toBe('plaques');
    expect(r.inventaire.cases[1]).toEqual({ objet: 'casque-cuir', quantite: 1 });
  });

  it("armure : sur une case qui contient une autre armure, les deux s'échangent", () => {
    const inv = { cases: [null, { objet: 'armure-plaques', quantite: 1 }] };
    const r = retirerArmureVers({ ...creerEquipement(), armure: 'cuir' }, inv, 1);
    expect(r.ok).toBe(true);
    expect(r.equipement.armure).toBe('plaques');
    expect(r.inventaire.cases[1]).toEqual({ objet: 'armure-cuir', quantite: 1 });
  });
});

describe("heaume d'acier : village niveau 2", () => {
  const etat = (niveauVillage: number) => ({
    inventaire: ajouter(creerConteneur(8), 'lingot-acier', 3).conteneur,
    coffre: creerConteneur(8),
    equipement: creerEquipement(),
    niveauVillage,
  });

  it('refusé au niveau 1, accepté au niveau 2', () => {
    expect(fabriquer(etat(1), 'casque-plaques').ok).toBe(false);
    const r = fabriquer(etat(2), 'casque-plaques');
    expect(r.ok).toBe(true);
    expect(compter(r.etat.inventaire, 'casque-plaques')).toBe(1);
  });
});
