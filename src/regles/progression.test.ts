import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { chercherNoeud } from './competences';
import { coutReparation, creerEquipement, durabiliteMax, equiperOutil } from './equipement';
import { agrandir, ajouter, compter, creerConteneur } from './inventaire';
import {
  acheterNoeud,
  aLeNoeud,
  bonusReductionArmure,
  butinAvecBonus,
  casesSacMagique,
  casesSacTotal,
  casesTransport,
  chanceEconome,
  creerProgression,
  donnerPoints,
  facteurCoutReparation,
  facteurDegatsEpee,
  facteurDegatsRecolte,
  facteurDurabilite,
  facteurRayonExplosion,
  facteurVitesseFrappe,
  gagnerXp,
  manaMax,
  pasMana,
  pvMax,
  reinitialiserArbre,
  secondSouffleDisponible,
  utiliserSecondSouffle,
  xpDestruction,
  xpEnnemi,
  xpPourNiveauSuivant,
  type Progression,
} from './progression';
import { generateurButin } from './recolte';

/** Joueur avec des points à dépenser. */
function avecPoints(n: number): Progression {
  return { ...creerProgression(), points: n };
}

describe("courbe d'XP", () => {
  it('suit arrondi(coefficient x n^exposant) et grandit à chaque niveau', () => {
    const C = CONFIG.progression;
    expect(C.coefficientXp).toBe(80);
    expect(C.exposantXp).toBe(1.25);
    expect(xpPourNiveauSuivant(1)).toBe(C.coefficientXp);
    expect(xpPourNiveauSuivant(4)).toBe(Math.round(80 * Math.pow(4, 1.25)));
    for (let n = 1; n < 20; n++) expect(xpPourNiveauSuivant(n + 1)).toBeGreaterThan(xpPourNiveauSuivant(n));
  });

  it('XP cumulée pour atteindre un niveau : 8 vers 3 300, 15 vers 14 600, 20 vers 28 400', () => {
    const cumul = (niveau: number): number => {
      let total = 0;
      for (let n = 1; n < niveau; n++) total += xpPourNiveauSuivant(n);
      return total;
    };
    expect(cumul(8)).toBeGreaterThan(3200);
    expect(cumul(8)).toBeLessThan(3400);
    expect(cumul(15)).toBeGreaterThan(14500);
    expect(cumul(15)).toBeLessThan(14700);
    expect(cumul(20)).toBeGreaterThan(28300);
    expect(cumul(20)).toBeLessThan(28500);
  });
});

describe("gain d'XP", () => {
  it("ajoute de l'XP sans changer de niveau", () => {
    const r = gagnerXp(creerProgression(), 10);
    expect(r.niveauxGagnes).toBe(0);
    expect(r.progression).toMatchObject({ niveau: 1, xp: 10, points: 0 });
  });

  it("monte d'un niveau : un point, le surplus est gardé", () => {
    const besoin = xpPourNiveauSuivant(1);
    const r = gagnerXp(creerProgression(), besoin + 7);
    expect(r.niveauxGagnes).toBe(1);
    expect(r.progression).toMatchObject({ niveau: 2, xp: 7, points: 1 });
  });

  it("monte de plusieurs niveaux d'un coup", () => {
    const total = xpPourNiveauSuivant(1) + xpPourNiveauSuivant(2) + xpPourNiveauSuivant(3) + 5;
    const r = gagnerXp(creerProgression(), total);
    expect(r.niveauxGagnes).toBe(3);
    expect(r.progression).toMatchObject({ niveau: 4, xp: 5, points: 3 });
  });

  it('ignore une quantité nulle ou négative et ne dépasse pas le niveau maximal', () => {
    const p = creerProgression();
    expect(gagnerXp(p, 0).progression).toBe(p);
    expect(gagnerXp(p, -5).progression).toBe(p);
    const max = gagnerXp(p, 1e9).progression;
    expect(max.niveau).toBe(CONFIG.progression.niveauMax);
    expect(max.points).toBe(CONFIG.progression.niveauMax - 1);
    expect(gagnerXp(max, 100).progression).toBe(max);
  });

  it("ne modifie pas l'état reçu", () => {
    const p = creerProgression();
    gagnerXp(p, 500);
    expect(p).toEqual(creerProgression());
  });

  it("donne l'XP prévue pour chaque source", () => {
    expect(xpDestruction('sapin')).toBe(10);
    expect(xpDestruction('arbre-feuillu')).toBe(10);
    expect(xpDestruction('rocher')).toBe(10);
    expect(xpDestruction('filon-fer')).toBe(15);
    expect(xpDestruction('cristal-bleu')).toBe(18);
    expect(xpDestruction('buisson-baies')).toBe(3);
    expect(xpDestruction('plante-medicinale')).toBe(3);
    expect(xpDestruction('fibres')).toBe(3);
    expect(xpEnnemi('slime')).toBe(20);
    expect(xpEnnemi('gobelin')).toBe(35);
    expect(xpEnnemi('loup')).toBe(30);
    expect(CONFIG.progression.xp.fabrication).toBe(8);
    expect(CONFIG.progression.xp.reparation).toBe(2);
  });
});

/** Achète les nœuds dans l'ordre donné (les prérequis doivent y figurer). */
function prendre(p: Progression, ...ids: string[]): Progression {
  let suite = p;
  for (const id of ids) {
    const r = acheterNoeud(suite, id);
    if (!r.ok) throw new Error(`achat refusé : ${id} (${r.raison})`);
    suite = r.progression;
  }
  return suite;
}

describe("achat d'un nœud", () => {
  it('dépense un point et ajoute le nœud', () => {
    const r = acheterNoeud(avecPoints(2), 'lame-affutee');
    expect(r.ok).toBe(true);
    expect(r.progression.noeuds).toEqual(['lame-affutee']);
    expect(r.progression.points).toBe(1);
  });

  it('refuse sans point, sans rien changer', () => {
    const p = creerProgression();
    const r = acheterNoeud(p, 'lame-affutee');
    expect(r).toMatchObject({ ok: false, raison: 'aucun-point' });
    expect(r.progression).toBe(p);
  });

  it('refuse un nœud verrouillé, déjà acquis ou inconnu', () => {
    const p = avecPoints(5);
    expect(acheterNoeud(p, 'enchainement')).toMatchObject({ ok: false, raison: 'verrouille' });
    const avec = prendre(p, 'lame-affutee');
    expect(acheterNoeud(avec, 'lame-affutee')).toMatchObject({ ok: false, raison: 'deja-acquis' });
    expect(acheterNoeud(p, 'inexistant')).toMatchObject({ ok: false, raison: 'inconnu' });
  });

  it("un point de récompense de quête s'ajoute aux points", () => {
    expect(donnerPoints(creerProgression()).points).toBe(1);
    expect(donnerPoints(creerProgression(), 3).points).toBe(3);
    const p = creerProgression();
    expect(donnerPoints(p, 0)).toBe(p);
  });

  it('aLeNoeud dit si un nœud est acquis', () => {
    const p = prendre(avecPoints(1), 'robustesse');
    expect(aLeNoeud(p, 'robustesse')).toBe(true);
    expect(aLeNoeud(p, 'parade')).toBe(false);
  });

  it('les nœuds « bientôt » sont achetables', () => {
    const p = prendre(avecPoints(3), 'robustesse', 'parade', 'bouclier-solide');
    expect(aLeNoeud(p, 'bouclier-solide')).toBe(true);
  });
});

describe('bonus', () => {
  it("Lame affûtée : +15 % de dégâts à l'épée ; Enchaînement : frappes 15 % plus rapides", () => {
    expect(facteurDegatsEpee(creerProgression())).toBe(1);
    expect(facteurVitesseFrappe(creerProgression())).toBe(1);
    const p = prendre(avecPoints(2), 'lame-affutee', 'enchainement');
    expect(facteurDegatsEpee(p)).toBeCloseTo(1.15);
    expect(facteurVitesseFrappe(p)).toBeCloseTo(1.15);
  });

  it('Bûcheron et Mineur : +25 % chacun, sur leurs éléments seulement', () => {
    const p = prendre(avecPoints(2), 'bucheron', 'mineur');
    expect(facteurDegatsRecolte(p, 'sapin')).toBeCloseTo(1.25);
    expect(facteurDegatsRecolte(p, 'rocher')).toBeCloseTo(1.25);
    expect(facteurDegatsRecolte(p, 'filon-fer')).toBeCloseTo(1.25);
    expect(facteurDegatsRecolte(p, 'buisson-baies')).toBe(1);
    const seul = prendre(avecPoints(1), 'bucheron');
    expect(facteurDegatsRecolte(seul, 'sapin')).toBeCloseTo(1.25);
    expect(facteurDegatsRecolte(seul, 'rocher')).toBe(1);
  });

  it('Robustesse : +20 PV max', () => {
    expect(pvMax(creerProgression())).toBe(CONFIG.combat.vieMax);
    expect(pvMax(prendre(avecPoints(1), 'robustesse'))).toBe(CONFIG.combat.vieMax + 20);
  });

  it('Peau dure : +10 points de réduction', () => {
    expect(bonusReductionArmure(creerProgression())).toBe(0);
    expect(bonusReductionArmure(prendre(avecPoints(2), 'robustesse', 'peau-dure'))).toBeCloseTo(0.1);
  });

  it('Porteur : +4 cases ; Grand sac : +4 cases de sac magique', () => {
    expect(casesTransport(creerProgression())).toBe(0);
    const p = prendre(avecPoints(2), 'porteur', 'grand-sac');
    expect(casesTransport(p)).toBe(4);
    expect(casesSacTotal(creerProgression())).toBe(CONFIG.inventaire.casesSac);
    expect(casesSacTotal(p)).toBe(CONFIG.inventaire.casesSac + 4);
  });

  it('Forgeron : réparations à moitié prix, arrondies au supérieur, minimum 1', () => {
    const p = prendre(avecPoints(1), 'forgeron');
    expect(facteurCoutReparation(creerProgression())).toBe(1);
    expect(facteurCoutReparation(p)).toBe(0.5);
    // Hache de base entièrement usée : 3 bois au plein tarif, 2 à moitié prix (1,5 -> 2)
    const usee = { ...creerEquipement(), durabilite: { ...creerEquipement().durabilite, hache: 0 } };
    expect(coutReparation(usee, 'hache')?.quantite).toBe(3);
    expect(coutReparation(usee, 'hache', facteurCoutReparation(p))?.quantite).toBe(2);
    // Armure (4 fibres) : 2
    const armure = { ...usee, armure: 'fibres' as const, durabilite: { ...usee.durabilite, armure: 0 } };
    expect(coutReparation(armure, 'armure')?.quantite).toBe(4);
    expect(coutReparation(armure, 'armure', facteurCoutReparation(p))?.quantite).toBe(2);
  });

  it('Maître forgeron : +50 % de durabilité maximale ; Économe : 25 % de chance', () => {
    const p = prendre(avecPoints(3), 'forgeron', 'maitre-forgeron', 'econome');
    expect(facteurDurabilite(creerProgression())).toBe(1);
    expect(facteurDurabilite(p)).toBe(1.5);
    expect(chanceEconome(creerProgression())).toBe(0);
    expect(chanceEconome(p)).toBe(0.25);
    const e = { ...creerEquipement(), facteurDurabilite: facteurDurabilite(p) };
    expect(durabiliteMax(e, 'hache')).toBe(Math.round(durabiliteMax(creerEquipement(), 'hache') * 1.5));
    expect(durabiliteMax(e, 'armure')).toBe(Math.round(CONFIG.durabilite.max * 1.5));
    // Un outil neuf du palier fer a toute sa durabilité majorée
    expect(equiperOutil(e, 'hache', 'fer').durabilite.hache).toBe(durabiliteMax({ ...e, outils: { ...e.outils, hache: 'fer' } }, 'hache'));
  });

  it('Réserve : +30 mana max (la réserve se remplit ensuite, pas de mana gratuit) ; Boule de feu II : explosion 50 % plus large', () => {
    const base = creerProgression();
    expect(manaMax(base)).toBe(50);
    expect(facteurRayonExplosion(base)).toBe(1);
    const avantReserve = prendre(avecPoints(4), 'boule-de-feu', 'soin', 'barriere');
    expect(avantReserve.mana).toBe(50);
    const r = acheterNoeud(avantReserve, 'reserve').progression;
    expect(manaMax(r)).toBe(80);
    expect(r.mana).toBe(50);
    expect(facteurRayonExplosion(prendre(avecPoints(2), 'boule-de-feu', 'boule-de-feu-ii'))).toBeCloseTo(1.5);
  });

  it('sac magique : une case de plus aux niveaux 3, 5, 7...', () => {
    const base = CONFIG.inventaire.casesSac;
    expect(casesSacMagique(1)).toBe(base);
    expect(casesSacMagique(2)).toBe(base);
    expect(casesSacMagique(3)).toBe(base + 1);
    expect(casesSacMagique(4)).toBe(base + 1);
    expect(casesSacMagique(5)).toBe(base + 2);
    expect(casesSacMagique(7)).toBe(base + 3);
  });
});

describe('butin avec bonus', () => {
  const alea = (valeur: number) => ({ suivant: () => valeur, entre: () => valeur, entier: () => 0 });

  it('Cueilleur : +1 baie ou plante par cueillette, pas sur les fibres', () => {
    const p = prendre(avecPoints(1), 'cueilleur');
    expect(butinAvecBonus(p, 'buisson-baies', { baies: 2 }, alea(0.99))).toEqual({ baies: 3 });
    expect(butinAvecBonus(p, 'plante-medicinale', { 'plante-medicinale': 1 }, alea(0.99))).toEqual({ 'plante-medicinale': 2 });
    expect(butinAvecBonus(p, 'fibres', { fibres: 2 }, alea(0.99))).toEqual({ fibres: 2 });
  });

  it('Abondance : une unité de plus de la ressource principale si le tirage est sous 20 %', () => {
    const p = prendre(avecPoints(2), 'mineur', 'abondance');
    expect(butinAvecBonus(p, 'rocher', { pierre: 3 }, alea(0.1))).toEqual({ pierre: 4 });
    expect(butinAvecBonus(p, 'rocher', { pierre: 3 }, alea(0.5))).toEqual({ pierre: 3 });
    expect(butinAvecBonus(p, 'filon-fer', { 'minerai-fer': 2, pierre: 1 }, alea(0.1))).toEqual({ 'minerai-fer': 3, pierre: 1 });
    // Pas de bonus sur une cueillette
    expect(butinAvecBonus(p, 'fibres', { fibres: 2 }, alea(0.1))).toEqual({ fibres: 2 });
  });

  it('Abondance avec le générateur à graine : même tirage, même résultat ; environ 20 % des éléments', () => {
    const p = prendre(avecPoints(2), 'bucheron', 'abondance');
    let enPlus = 0;
    for (let i = 0; i < 1000; i++) {
      const butin = butinAvecBonus(p, 'sapin', { bois: 3 }, generateurButin(42, `arbre:${i}`));
      expect(butin).toEqual(butinAvecBonus(p, 'sapin', { bois: 3 }, generateurButin(42, `arbre:${i}`)));
      if ((butin.bois ?? 0) === 4) enPlus += 1;
    }
    expect(enPlus).toBeGreaterThan(150);
    expect(enPlus).toBeLessThan(250);
  });

  it('sans les nœuds, le butin ne change pas', () => {
    expect(butinAvecBonus(creerProgression(), 'sapin', { bois: 3 }, alea(0))).toEqual({ bois: 3 });
  });
});

describe('Second souffle', () => {
  it('disponible une fois par jour de jeu, seulement avec le nœud', () => {
    const jour = CONFIG.temps.dureeJourSecondes;
    expect(secondSouffleDisponible(creerProgression(), 10)).toBe(false);
    const p = prendre(avecPoints(3), 'robustesse', 'peau-dure', 'second-souffle');
    expect(secondSouffleDisponible(p, 10)).toBe(true);
    const utilise = utiliserSecondSouffle(p, 10);
    expect(secondSouffleDisponible(utilise, 20)).toBe(false);
    expect(secondSouffleDisponible(utilise, jour - 1)).toBe(false);
    expect(secondSouffleDisponible(utilise, jour + 1)).toBe(true);
  });
});

describe('mana', () => {
  it("démarre plein (50) et se régénère de 4 par seconde jusqu'au maximum", () => {
    const p = creerProgression();
    expect(p.mana).toBe(50);
    const vide = { ...p, mana: 10 };
    expect(pasMana(vide, 2).mana).toBeCloseTo(18);
    expect(pasMana(vide, 100).mana).toBe(50);
    expect(pasMana(p, 1)).toBe(p);
  });
});

describe('agrandir un conteneur', () => {
  it("ajoute des cases vides sans perdre d'objets", () => {
    const c = ajouter(creerConteneur(3), 'bois', 70).conteneur;
    const plus = agrandir(c, 5);
    expect(plus.cases).toHaveLength(5);
    expect(compter(plus, 'bois')).toBe(70);
    expect(plus.cases.slice(0, 3)).toEqual(c.cases);
    expect(plus.cases.slice(3)).toEqual([null, null]);
  });

  it('ne rétrécit jamais', () => {
    const c = ajouter(creerConteneur(4), 'bois', 3).conteneur;
    expect(agrandir(c, 2)).toBe(c);
    expect(agrandir(c, 4)).toBe(c);
  });
});

describe("réinitialisation de l'arbre", () => {
  it('rend la somme des coûts des nœuds acquis et vide les nœuds, sans rien changer d\'autre', () => {
    const noeuds = ['boule-de-feu', 'soin', 'robustesse'];
    const cout = noeuds.reduce((s, id) => s + (chercherNoeud(id)?.cout ?? 0), 0);
    const p: Progression = { ...creerProgression(), niveau: 6, xp: 12, points: 2, noeuds, mana: 10 };
    const r = reinitialiserArbre(p);
    expect(r.noeuds).toEqual([]);
    expect(r.points).toBe(2 + cout);
    expect(r).toEqual({ ...p, points: 2 + cout, noeuds: [] });
  });

  it('ramène le mana au nouveau maximum quand Réserve est oubliée', () => {
    let p = avecPoints(3);
    p = acheterNoeud(p, 'boule-de-feu').progression;
    p = acheterNoeud(p, 'reserve').progression;
    expect(p.mana).toBe(manaMax(p));
    const r = reinitialiserArbre(p);
    expect(manaMax(r)).toBe(CONFIG.progression.mana.max);
    expect(r.mana).toBe(CONFIG.progression.mana.max);
  });

  it('sans nœud acquis, ne change rien', () => {
    const p = avecPoints(4);
    expect(reinitialiserArbre(p)).toBe(p);
  });

  it('un sort oublié n\'est plus acquis et son point est rendu', () => {
    const p = acheterNoeud(avecPoints(2), 'boule-de-feu').progression;
    const r = reinitialiserArbre(p);
    expect(r.points).toBe(2);
    expect(aLeNoeud(r, 'boule-de-feu')).toBe(false);
  });
});
