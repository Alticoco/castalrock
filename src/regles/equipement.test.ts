import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  coutReparation,
  creerEquipement,
  NIVEAUX_OUTIL,
  TYPES_ARMURE,
  durabiliteMax,
  efficacite,
  niveauPrecedent,
  reductionArmure,
  typeArmureDeObjet,
  etatDurabilite,
  equiperArmure,
  equiperOutil,
  facteurDegats,
  franchitSeuilAlerte,
  messageUsure,
  niveauOutil,
  reparer,
  retirerArmure,
  user,
  userTout,
} from './equipement';
import { ajouter, compter, creerConteneur } from './inventaire';
import { creerEtatRecolte, degatsDuCoup, frapper } from './recolte';

describe('équipement', () => {
  it('commence avec les trois outils de base, sans armure ni sacoche', () => {
    const e = creerEquipement();
    expect(niveauOutil(e, 'hache')).toBe('base');
    expect(e.armure).toBeNull();
    expect(e.sacoche).toBe(false);
  });

  it('un outil en fer remplace seulement celui du même type', () => {
    const e = equiperOutil(creerEquipement(), 'pioche', 'fer');
    expect(niveauOutil(e, 'pioche')).toBe('fer');
    expect(niveauOutil(e, 'hache')).toBe('base');
    expect(facteurDegats(e, 'pioche')).toBe(CONFIG.fabrication.paliers.fer.degats);
    expect(facteurDegats(e, 'hache')).toBe(1);
  });

  it('équipe l\'armure depuis l\'inventaire et la remet', () => {
    const inv = ajouter(creerConteneur(4), 'armure-fibres', 1).conteneur;
    const porte = equiperArmure(creerEquipement(), inv);
    expect(porte.ok).toBe(true);
    expect(porte.equipement.armure).toBe('fibres');
    expect(compter(porte.inventaire, 'armure-fibres')).toBe(0);

    const encore = equiperArmure(porte.equipement, porte.inventaire);
    expect(encore.ok).toBe(false);
    expect(encore.raison).toBe('deja-portee');

    const retiree = retirerArmure(porte.equipement, porte.inventaire);
    expect(retiree.ok).toBe(true);
    expect(retiree.equipement.armure).toBeNull();
    expect(compter(retiree.inventaire, 'armure-fibres')).toBe(1);
  });

  it('refuse d\'équiper sans armure et de la retirer si l\'inventaire est plein', () => {
    expect(equiperArmure(creerEquipement(), creerConteneur(4)).raison).toBe('aucune-armure');
    const plein = ajouter(creerConteneur(1), 'pierre', 50).conteneur;
    const porte = { ...creerEquipement(), armure: 'fibres' as const };
    const r = retirerArmure(porte, plein);
    expect(r.ok).toBe(false);
    expect(r.raison).toBe('inventaire-plein');
    expect(r.equipement.armure).toBe('fibres');
  });
});

describe('dégâts avec un outil en fer', () => {
  it('multiplie les dégâts sur la cible adaptée seulement', () => {
    const f = CONFIG.fabrication.paliers.fer.degats;
    expect(degatsDuCoup('rocher', 'pioche', f)).toBe(f);
    expect(degatsDuCoup('rocher', 'hache', f)).toBe(CONFIG.recolte.facteurOutilInadapte);
    expect(degatsDuCoup('rocher', 'pioche')).toBe(1);
  });

  it('un arbre (5 points) tombe en 4 coups de hache en fer au lieu de 5', () => {
    let etat = creerEtatRecolte();
    let coups = 0;
    let detruit = false;
    while (!detruit && coups < 20) {
      const r = frapper(etat, { id: 'a', type: 'sapin' }, 'hache', 1, CONFIG.fabrication.paliers.fer.degats);
      etat = r.etat;
      detruit = r.detruit;
      coups += 1;
    }
    expect(coups).toBe(4); // 5 points, 1,6 de dégâts par coup
  });
});

describe('durabilité', () => {
  const M = CONFIG.durabilite.max;

  it('tout est neuf au départ ; un outil en fer neuf remplace un outil usé', () => {
    expect(creerEquipement().durabilite).toEqual({ hache: M, pioche: M, epee: M, armure: M });
    const usee = user(creerEquipement(), 'hache', 40);
    expect(equiperOutil(usee, 'hache', 'fer').durabilite.hache).toBe(200);
  });

  it("use de 1 par défaut, jamais sous zéro, sans modifier l'original", () => {
    const e = creerEquipement();
    expect(user(e, 'hache').durabilite.hache).toBe(M - 1);
    expect(e.durabilite.hache).toBe(M);
    expect(user(user(e, 'pioche', 500), 'pioche').durabilite.pioche).toBe(0);
  });

  it("l'armure ne s'use que si elle est portée", () => {
    expect(user(creerEquipement(), 'armure', 5).durabilite.armure).toBe(M);
    expect(user({ ...creerEquipement(), armure: 'fibres' as const }, 'armure', 5).durabilite.armure).toBe(M - 5);
  });

  it("à zéro rien ne casse : efficacité de 50 % (dégâts de l'outil)", () => {
    const usee = user(creerEquipement(), 'epee', M);
    expect(efficacite(usee, 'epee')).toBe(CONFIG.durabilite.efficaciteUsee);
    expect(facteurDegats(usee, 'epee')).toBe(0.5);
    expect(facteurDegats(equiperOutil(usee, 'epee', 'fer'), 'epee')).toBe(CONFIG.fabrication.paliers.fer.degats);
    expect(facteurDegats(user(creerEquipement(), 'epee', M - 1), 'epee')).toBe(1);
    const fer = user(equiperOutil(creerEquipement(), 'hache', 'fer'), 'hache', 200);
    expect(facteurDegats(fer, 'hache')).toBe(CONFIG.fabrication.paliers.fer.degats * 0.5);
  });

  it("userTout retire la même quantité à tout l'équipement", () => {
    const e = userTout({ ...creerEquipement(), armure: 'fibres' as const }, 10);
    expect(e.durabilite).toEqual({ hache: 90, pioche: 90, epee: 90, armure: 90 });
  });

  it('signale une seule fois le passage sous 20 %', () => {
    const a = user(creerEquipement(), 'hache', 80);
    expect(a.durabilite.hache).toBe(20);
    const b = user(a, 'hache');
    expect(franchitSeuilAlerte(a, b, 'hache')).toBe(true);
    expect(franchitSeuilAlerte(b, user(b, 'hache'), 'hache')).toBe(false);
    expect(franchitSeuilAlerte(creerEquipement(), user(creerEquipement(), 'hache'), 'hache')).toBe(false);
    expect(messageUsure('hache')).toBe("Votre hache s'émousse : faites-la réparer à la forge");
  });

  it('coût de réparation proportionnel, arrondi au supérieur, minimum 1', () => {
    const e = { ...creerEquipement(), armure: 'fibres' as const };
    expect(coutReparation(e, 'hache')).toBeNull();
    expect(coutReparation(user(e, 'hache'), 'hache')).toEqual({ objet: 'bois', quantite: 1 });
    expect(coutReparation(user(e, 'hache', 50), 'hache')).toEqual({ objet: 'bois', quantite: 2 });
    expect(coutReparation(user(e, 'hache', 100), 'hache')).toEqual({ objet: 'bois', quantite: 3 });
    expect(coutReparation(user(e, 'armure', 50), 'armure')).toEqual({ objet: 'fibres', quantite: 2 });
    expect(coutReparation(user(e, 'armure', 100), 'armure')).toEqual({ objet: 'fibres', quantite: 4 });
    const fer = equiperOutil(e, 'pioche', 'fer');
    expect(coutReparation(user(fer, 'pioche', 5), 'pioche')).toEqual({ objet: 'lingot-fer', quantite: 1 });
    expect(coutReparation(user(creerEquipement(), 'armure', 50), 'armure')).toBeNull();
  });

  it("répare : consomme le coût (inventaire puis coffre) et remet à 100 ; refuse s'il manque", () => {
    const usee = user(creerEquipement(), 'hache', 100);
    const inv = ajouter(creerConteneur(4), 'bois', 1).conteneur;
    const coffre = ajouter(creerConteneur(4), 'bois', 5).conteneur;
    const r = reparer({ inventaire: inv, coffre, equipement: usee }, 'hache');
    expect(r.ok).toBe(true);
    expect(r.etat.equipement.durabilite.hache).toBe(M);
    expect(compter(r.etat.inventaire, 'bois')).toBe(0);
    expect(compter(r.etat.coffre, 'bois')).toBe(3);

    const refus = reparer({ inventaire: inv, coffre: creerConteneur(4), equipement: usee }, 'hache');
    expect(refus.ok).toBe(false);
    expect(refus.etat.equipement.durabilite.hache).toBe(0);
    expect(compter(refus.etat.inventaire, 'bois')).toBe(1);

    expect(reparer({ inventaire: inv, coffre, equipement: creerEquipement() }, 'hache').ok).toBe(false);
  });
});

describe('etatDurabilite', () => {
  it('bon, alerte sous le seuil, usé à zéro', () => {
    const seuil = CONFIG.durabilite.max * CONFIG.durabilite.seuilAlerte;
    expect(etatDurabilite(CONFIG.durabilite.max)).toBe('bon');
    expect(etatDurabilite(seuil)).toBe('bon');
    expect(etatDurabilite(seuil - 1)).toBe('alerte');
    expect(etatDurabilite(1)).toBe('alerte');
    expect(etatDurabilite(0)).toBe('use');
  });
});

describe('paliers', () => {
  const P = CONFIG.fabrication.paliers;

  it('dégâts et durabilité par palier : base 1/100, cuivre 1,3/150, fer 1,6/200, acier 2/300, cristal 2,5/400', () => {
    expect(NIVEAUX_OUTIL).toEqual(['base', 'cuivre', 'fer', 'acier', 'cristal']);
    expect(NIVEAUX_OUTIL.map((n) => [P[n].degats, P[n].durabilite])).toEqual([[1, 100], [1.3, 150], [1.6, 200], [2, 300], [2.5, 400]]);
    for (const n of NIVEAUX_OUTIL) {
      const e = equiperOutil(creerEquipement(), 'epee', n);
      expect(facteurDegats(e, 'epee')).toBe(P[n].degats);
      expect(durabiliteMax(e, 'epee')).toBe(P[n].durabilite);
      expect(e.durabilite.epee).toBe(P[n].durabilite);
    }
    expect(niveauPrecedent('acier')).toBe('fer');
    expect(niveauPrecedent('base')).toBeNull();
  });

  it("l'usure, l'alerte et la réparation suivent le maximum du palier", () => {
    const acier = equiperOutil(creerEquipement(), 'pioche', 'acier');
    // Alerte à 20 % de 300 = 60
    expect(franchitSeuilAlerte(user(acier, 'pioche', 200), user(acier, 'pioche', 245), 'pioche')).toBe(true);
    expect(franchitSeuilAlerte(acier, user(acier, 'pioche', 100), 'pioche')).toBe(false);
    expect(etatDurabilite(100, 300)).toBe('bon');
    expect(etatDurabilite(59, 300)).toBe('alerte');
    // Réparation : proportionnelle à l'usure du palier, lingot d'acier
    expect(coutReparation(user(acier, 'pioche', 150), 'pioche')).toEqual({ objet: 'lingot-acier', quantite: 1 });
    expect(coutReparation(acier, 'pioche')).toBeNull();
    const cuivre = user(equiperOutil(creerEquipement(), 'hache', 'cuivre'), 'hache', 30);
    const inv = ajouter(creerConteneur(4), 'lingot-cuivre', 1).conteneur;
    const r = reparer({ inventaire: inv, coffre: creerConteneur(4), equipement: cuivre }, 'hache');
    expect(r.ok).toBe(true);
    expect(r.etat.equipement.durabilite.hache).toBe(150);
  });
});

describe('armures par palier', () => {
  it('équipe le type choisi, rend le bon objet, et un seul emplacement', () => {
    const inv = ajouter(ajouter(creerConteneur(4), 'armure-cuir', 1).conteneur, 'armure-mailles', 1).conteneur;
    const porte = equiperArmure(creerEquipement(), inv, 'cuir');
    expect(porte.equipement.armure).toBe('cuir');
    expect(compter(porte.inventaire, 'armure-cuir')).toBe(0);
    // Type choisi alors qu'une armure est portée : échange (le cuir revient à la place des mailles)
    const echange = equiperArmure(porte.equipement, porte.inventaire, 'mailles');
    expect(echange.ok).toBe(true);
    expect(echange.equipement.armure).toBe('mailles');
    expect(compter(echange.inventaire, 'armure-mailles')).toBe(0);
    expect(compter(echange.inventaire, 'armure-cuir')).toBe(1);
    expect(echange.inventaire.cases.findIndex((p) => p?.objet === 'armure-cuir')).toBe(
      porte.inventaire.cases.findIndex((p) => p?.objet === 'armure-mailles'),
    );
    const retiree = retirerArmure(porte.equipement, porte.inventaire);
    expect(compter(retiree.inventaire, 'armure-cuir')).toBe(1);
    // Sans précision : la meilleure
    expect(equiperArmure(creerEquipement(), inv).equipement.armure).toBe('mailles');
    expect(typeArmureDeObjet('armure-plaques')).toBe('plaques');
    expect(typeArmureDeObjet('bois')).toBeNull();
    expect([null, ...TYPES_ARMURE].map(reductionArmure)).toEqual([0, 0.15, 0.25, 0.3, 0.4, 0.55]);
  });
});
