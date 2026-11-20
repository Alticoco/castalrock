import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  MESSAGE_CLOCHE,
  MESSAGE_VICTOIRE,
  aArrive,
  attaquePrevue,
  attaqueRepoussee,
  creerEtatAttaques,
  distanceArrivee,
  estBanditAttaque,
  histoireAtteintActeII,
  issueAttaque,
  lireEtatAttaques,
  messagePillage,
  objectifDefense,
  pasBanditAttaque,
  pillage,
  positionsBandits,
  recompenseDefense,
  tirerAttaque,
} from './attaques';
import { RAYON_VILLAGE_ENNEMIS, creerEnnemi, type ContexteEnnemi, type EtatEnnemi } from './combat';
import { ETAPES_HISTOIRE, creerEtatHistoire } from './histoire';
import { ajouter, compter, creerConteneur, type Conteneur } from './inventaire';

const A = CONFIG.attaques;
const GRAINE = 42;

describe('attaques : histoire', () => {
  const premierActeII = ETAPES_HISTOIRE.findIndex((e) => e.acte === 'II');
  it("n'est pas atteinte avant l'acte II", () => {
    expect(histoireAtteintActeII(creerEtatHistoire())).toBe(false);
    expect(histoireAtteintActeII({ etape: premierActeII - 1, compteur: 0, vus: [] })).toBe(false);
  });
  it("est atteinte à l'acte II, aux actes suivants et quand l'histoire est finie", () => {
    expect(histoireAtteintActeII({ etape: premierActeII, compteur: 0, vus: [] })).toBe(true);
    expect(histoireAtteintActeII({ etape: ETAPES_HISTOIRE.length - 1, compteur: 0, vus: [] })).toBe(true);
    expect(histoireAtteintActeII({ etape: ETAPES_HISTOIRE.length, compteur: 0, vus: [] })).toBe(true);
  });
});

describe('attaques : quels soirs', () => {
  it('est déterministe : même jour, même graine, même réponse', () => {
    for (let jour = 0; jour < 50; jour++) expect(attaquePrevue(jour, GRAINE)).toBe(attaquePrevue(jour, GRAINE));
  });

  it('tombe environ un soir sur trois', () => {
    let n = 0;
    for (let jour = 0; jour < 3000; jour++) if (attaquePrevue(jour, GRAINE)) n++;
    expect(n / 3000).toBeGreaterThan(0.28);
    expect(n / 3000).toBeLessThan(0.39);
  });

  it('change avec la graine', () => {
    const a = Array.from({ length: 60 }, (_, j) => attaquePrevue(j, 1));
    const b = Array.from({ length: 60 }, (_, j) => attaquePrevue(j, 2));
    expect(a).not.toEqual(b);
  });

  it("jamais deux soirs de suite : le lendemain d'un jour traité, pas d'attaque", () => {
    for (let jour = 1; jour < 500; jour++) expect(attaquePrevue(jour, GRAINE, jour - 1)).toBe(false);
  });

  it("jamais le jour de l'arrivée à l'acte II (un jour de répit), mais ensuite oui", () => {
    for (let jour = 0; jour < 500; jour++) expect(attaquePrevue(jour, GRAINE, -1, jour)).toBe(false);
    const apres = Array.from({ length: 200 }, (_, j) => j + 10).some((jour) => attaquePrevue(jour, GRAINE, -1, 9));
    expect(apres).toBe(true);
  });
});

describe('attaques : combat contre Morvan', () => {
  const D = CONFIG.attaques.distanceCampMorvan;
  it('repoussée près du camp tant que Morvan est en vie', () => {
    expect(attaqueRepoussee(D - 1, false)).toBe(true);
    expect(attaqueRepoussee(0, false)).toBe(true);
  });
  it('permise loin du camp, ou une fois Morvan vaincu', () => {
    expect(attaqueRepoussee(D, false)).toBe(false);
    expect(attaqueRepoussee(D + 100, false)).toBe(false);
    expect(attaqueRepoussee(0, true)).toBe(false);
  });
});

describe('attaques : tirage', () => {
  it('donne 3 à 5 bandits et une direction, toujours les mêmes pour un jour donné', () => {
    const vus = new Set<number>();
    for (let jour = 0; jour < 300; jour++) {
      const t = tirerAttaque(jour, GRAINE);
      expect(t).toEqual(tirerAttaque(jour, GRAINE));
      expect(t.nombre).toBeGreaterThanOrEqual(A.nombreMin);
      expect(t.nombre).toBeLessThanOrEqual(A.nombreMax);
      expect(t.angle).toBeGreaterThanOrEqual(0);
      expect(t.angle).toBeLessThan(Math.PI * 2);
      vus.add(t.nombre);
    }
    expect([...vus].sort()).toEqual([3, 4, 5]);
  });

  it('place les bandits côte à côte, à environ 70 m du centre', () => {
    const points = positionsBandits(1.2, 5);
    expect(points).toHaveLength(5);
    for (const p of points) {
      expect(Math.hypot(p.x, p.z)).toBeGreaterThan(A.distanceApparition - 1);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(A.distanceApparition + 2);
    }
    expect(Math.hypot(points[0].x - points[1].x, points[0].z - points[1].z)).toBeCloseTo(A.ecartBandits, 5);
    // Centrés sur la direction demandée
    expect(Math.atan2(points[2].x, points[2].z)).toBeCloseTo(1.2, 5);
  });
});

describe('attaques : marche des bandits', () => {
  const monde = { hauteur: () => 0, niveauEau: -10, obstacles: [] };
  const contexte = (joueur: { x: number; z: number }): ContexteEnnemi => ({
    joueur: { ...joueur, vivant: true },
    monde,
    rayonVillage: RAYON_VILLAGE_ENNEMIS,
  });
  const LOIN = { x: 0, z: 400 };

  it("reconnaît l'identifiant d'un bandit d'attaque", () => {
    expect(estBanditAttaque('attaque:3:1:0')).toBe(true);
    expect(estBanditAttaque('e:1:2:3')).toBe(false);
    expect(estBanditAttaque('a:1:2:3')).toBe(false);
  });

  it('marche vers la place, sans voir le joueur, à la vitesse réglée', () => {
    let e = creerEnnemi('attaque:1:1:0', 'bandit', 70, 0);
    const avant = Math.hypot(e.x, e.z);
    for (let i = 0; i < 10; i++) e = pasBanditAttaque(e, contexte(LOIN), 0.1).etat;
    expect(avant - Math.hypot(e.x, e.z)).toBeCloseTo(A.vitesseMarche * 1, 1);
  });

  it("arrive au bord du village sans y entrer, et s'y arrête", () => {
    let e = creerEnnemi('attaque:1:1:0', 'bandit', 0, 70);
    for (let i = 0; i < 1200 && !aArrive(e.x, e.z); i++) e = pasBanditAttaque(e, contexte(LOIN), 0.1).etat;
    expect(aArrive(e.x, e.z)).toBe(true);
    expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(RAYON_VILLAGE_ENNEMIS - 0.01);
    const arrete = pasBanditAttaque(e, contexte(LOIN), 0.5).etat;
    expect(Math.hypot(arrete.x - e.x, arrete.z - e.z)).toBeLessThan(0.01);
    expect(distanceArrivee()).toBeGreaterThan(RAYON_VILLAGE_ENNEMIS);
  });

  it('passe au combat normal quand il voit le joueur (hors du village)', () => {
    const e = creerEnnemi('attaque:1:1:0', 'bandit', 70, 0);
    const r = pasBanditAttaque(e, contexte({ x: 75, z: 0 }), 0.1);
    expect(r.etat.phase).toBe('poursuite');
  });

  it('ignore le joueur qui reste dans le village : il continue sa marche', () => {
    const e = creerEnnemi('attaque:1:1:0', 'bandit', 50, 0);
    const r = pasBanditAttaque(e, contexte({ x: 0, z: 0 }), 0.1);
    expect(r.etat.phase).toBe('errance');
    expect(r.etat.x).toBeLessThan(50);
  });

  it('reprend sa marche quand il a perdu le joueur', () => {
    let e: EtatEnnemi = { ...creerEnnemi('attaque:1:1:0', 'bandit', 70, 0), phase: 'retour' };
    e = pasBanditAttaque(e, contexte(LOIN), 0.1).etat;
    expect(e.phase).toBe('errance');
    expect(e.x).toBeLessThan(70);
  });
});

describe('attaques : issue', () => {
  const base = { vivants: 3, arrives: 0, tempsArrives: 0, jourAttaque: 5, jour: 5 };
  it('continue tant que des bandits tiennent la place trop peu de temps', () => {
    expect(issueAttaque(base)).toBe('enCours');
    expect(issueAttaque({ ...base, arrives: 1, tempsArrives: A.dureePillage - 0.1 })).toBe('enCours');
  });
  it('victoire quand tous les bandits sont tués', () => {
    expect(issueAttaque({ ...base, vivants: 0 })).toBe('victoire');
    // même à minuit passé, ou avec un bandit arrivé : la victoire passe avant
    expect(issueAttaque({ ...base, vivants: 0, jour: 6, arrives: 1, tempsArrives: 99 })).toBe('victoire');
  });
  it('pillage à minuit, ou quand un bandit reste assez longtemps sur la place', () => {
    expect(issueAttaque({ ...base, jour: 6 })).toBe('pillage');
    expect(issueAttaque({ ...base, arrives: 1, tempsArrives: A.dureePillage })).toBe('pillage');
  });
});

describe('attaques : récompense et pillage', () => {
  it('donne 10 or et 40 XP par bandit', () => {
    expect(recompenseDefense(4)).toEqual({ or: 4 * A.orParBandit, xp: 4 * A.xpParBandit });
    expect(recompenseDefense(0)).toEqual({ or: 0, xp: 0 });
  });

  const plein = (): Conteneur => {
    let c = creerConteneur(20);
    for (const [objet, n] of [
      ['bois', 100],
      ['pierre', 60],
      ['minerai-fer', 30],
      ['viande-crue', 10],
      ['or', 50],
      ['potion-soin', 3],
      ['armure-cuir', 1],
    ] as const) c = ajouter(c, objet, n).conteneur;
    return c;
  };

  it("prend 2 ou 3 ressources de base, au plus 20 % de chacune, jamais l'or ni les objets fabriqués", () => {
    const coffre = plein();
    for (let jour = 0; jour < 100; jour++) {
      const r = pillage(coffre, GRAINE, jour);
      expect(r.pris.length).toBeGreaterThanOrEqual(2);
      expect(r.pris.length).toBeLessThanOrEqual(3);
      for (const p of r.pris) {
        expect(['bois', 'pierre', 'minerai-fer', 'viande-crue']).toContain(p.objet);
        expect(p.quantite).toBeGreaterThanOrEqual(1);
        expect(p.quantite).toBeLessThanOrEqual(Math.max(1, Math.floor(compter(coffre, p.objet) * A.pillage.partMax)));
        expect(compter(r.coffre, p.objet)).toBe(compter(coffre, p.objet) - p.quantite);
      }
      expect(compter(r.coffre, 'or')).toBe(50);
      expect(compter(r.coffre, 'potion-soin')).toBe(3);
      expect(compter(r.coffre, 'armure-cuir')).toBe(1);
    }
  });

  it('est déterministe, et ne modifie pas le coffre donné', () => {
    const coffre = plein();
    const copie = JSON.stringify(coffre);
    expect(pillage(coffre, GRAINE, 7)).toEqual(pillage(coffre, GRAINE, 7));
    expect(JSON.stringify(coffre)).toBe(copie);
  });

  it('ne prend rien dans un coffre sans ressource de base, ou vide, et le dit', () => {
    const vide = pillage(creerConteneur(20), GRAINE, 3);
    expect(vide.pris).toEqual([]);
    const seulOr = pillage(ajouter(creerConteneur(20), 'or', 40).conteneur, GRAINE, 3);
    expect(seulOr.pris).toEqual([]);
    expect(compter(seulOr.coffre, 'or')).toBe(40);
    expect(messagePillage([])).toContain('mains vides');
  });

  it('prend au moins 1 pièce même sur un petit stock', () => {
    const r = pillage(ajouter(ajouter(creerConteneur(20), 'bois', 2).conteneur, 'pierre', 1).conteneur, GRAINE, 1);
    expect(r.pris.length).toBe(2);
    for (const p of r.pris) expect(p.quantite).toBe(1);
  });

  it('annonce ce qui est pris, avec les noms du jeu', () => {
    expect(messagePillage([{ objet: 'bois', quantite: 12 }, { objet: 'minerai-fer', quantite: 3 }])).toBe(
      'Les bandits ont pillé le coffre : 12 bois, 3 minerai de fer',
    );
  });
});

describe('attaques : textes et sauvegarde', () => {
  it('garde les messages demandés', () => {
    expect(MESSAGE_CLOCHE).toBe('La cloche sonne : des bandits attaquent le village !');
    expect(MESSAGE_VICTOIRE).toBe('Le village est sauvé !');
    expect(objectifDefense(1)).toBe('Défends le village : 1 bandit');
    expect(objectifDefense(4)).toBe('Défends le village : 4 bandits');
  });

  it('lit et refuse les états', () => {
    expect(creerEtatAttaques()).toEqual({ dernierJour: -1 });
    expect(lireEtatAttaques({ dernierJour: 12 })).toEqual({ dernierJour: 12 });
    expect(lireEtatAttaques({ dernierJour: -1 })).toEqual({ dernierJour: -1 });
    expect(lireEtatAttaques({ dernierJour: -2 })).toBeNull();
    expect(lireEtatAttaques({ dernierJour: 1.5 })).toBeNull();
    expect(lireEtatAttaques(null)).toBeNull();
    expect(lireEtatAttaques([])).toBeNull();
  });
});
