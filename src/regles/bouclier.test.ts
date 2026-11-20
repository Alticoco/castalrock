import { describe, expect, it } from 'vitest';
import { creerEnnemi, etourdirEnnemi, frapperEnnemi, pasEnnemi } from './combat';
import { creerEtatPersonnage, pasDeDeplacement, vitesseHorizontale } from './deplacement';
import { CONFIG } from '../config';
import {
  apresParadeReussie,
  consommerRiposte,
  creerGarde,
  estDeFace,
  facteurRiposte,
  pasDeGarde,
  peutLeverBouclier,
  reductionParade,
  resoudreParade,
  type CoupRecu,
  type EtatGarde,
} from './bouclier';

const B = CONFIG.bouclier;
const rad = (deg: number) => (deg * Math.PI) / 180;
/** Point à 2 m du joueur (à l'origine), à `deg` degrés de l'avant (+z). */
const a = (deg: number) => ({ x: Math.sin(rad(deg)) * 2, z: Math.cos(rad(deg)) * 2 });
const levee = (depuis: number): EtatGarde => ({ leve: true, depuis, riposte: 0 });

function coup(partiel: Partial<CoupRecu> = {}): CoupRecu {
  return { brut: 20, garde: levee(1), deFace: true, bouclier: 'bois', solide: false, attaquant: 'gobelin', ...partiel };
}

describe('garde', () => {
  it("demande l'épée, un bouclier et le nœud Parade", () => {
    expect(peutLeverBouclier('epee', 'bois', ['parade'])).toBe(true);
    expect(peutLeverBouclier('hache', 'bois', ['parade'])).toBe(false);
    expect(peutLeverBouclier('pousse', 'bois', ['parade'])).toBe(false);
    expect(peutLeverBouclier('epee', null, ['parade'])).toBe(false);
    expect(peutLeverBouclier('epee', 'renforce', ['robustesse'])).toBe(false);
  });

  it('compte le temps depuis que le bouclier est levé, et repart de zéro quand il se baisse', () => {
    let g = pasDeGarde(creerGarde(), true, 0.1);
    expect(g).toEqual({ leve: true, depuis: 0, riposte: 0 });
    g = pasDeGarde(g, true, 0.1);
    g = pasDeGarde(g, true, 0.1);
    expect(g.depuis).toBeCloseTo(0.2);
    g = pasDeGarde(g, false, 0.1);
    expect(g).toEqual({ leve: false, depuis: 0, riposte: 0 });
    expect(pasDeGarde(g, true, 0.1).depuis).toBe(0);
  });
});

describe('coup de face', () => {
  it('prend les attaquants dans le cône de ±70° devant le regard', () => {
    const j = { x: 0, z: 0 };
    expect(B.demiAngleFaceDegres).toBe(70);
    expect(estDeFace(j, 0, a(0))).toBe(true);
    expect(estDeFace(j, 0, a(69))).toBe(true);
    expect(estDeFace(j, 0, a(-69))).toBe(true);
    expect(estDeFace(j, 0, a(71))).toBe(false);
    expect(estDeFace(j, 0, a(-71))).toBe(false);
    expect(estDeFace(j, 0, a(180))).toBe(false);
  });

  it('suit le regard, y compris de part et d\'autre de ±180°', () => {
    const j = { x: 5, z: -3 };
    const derriere = { x: 5, z: -6 };
    expect(estDeFace(j, 0, derriere)).toBe(false);
    expect(estDeFace(j, Math.PI, derriere)).toBe(true);
    expect(estDeFace(j, -Math.PI + 0.2, derriere)).toBe(true);
    expect(estDeFace(j, Math.PI * 3, derriere)).toBe(true);
    expect(estDeFace(j, 0, j)).toBe(true);
  });
});

describe('réduction du bouclier', () => {
  it('vaut 70 %, 100 % avec Bouclier solide, et le bouclier renforcé ajoute 10 %', () => {
    expect(reductionParade(null, true)).toBe(0);
    expect(reductionParade('bois', false)).toBeCloseTo(0.7);
    expect(reductionParade('renforce', false)).toBeCloseTo(0.8);
    expect(reductionParade('bois', true)).toBe(1);
    expect(reductionParade('renforce', true)).toBe(1);
  });

  it('ne retire rien bouclier baissé, sans bouclier ou pour un coup dans le dos', () => {
    expect(resoudreParade(coup({ garde: creerGarde() }))).toEqual({ brut: 20, pare: false, reussie: false });
    expect(resoudreParade(coup({ bouclier: null }))).toEqual({ brut: 20, pare: false, reussie: false });
    expect(resoudreParade(coup({ deFace: false, garde: levee(0.1) }))).toEqual({ brut: 20, pare: false, reussie: false });
    expect(resoudreParade(coup({ brut: 0 }))).toEqual({ brut: 0, pare: false, reussie: false });
  });

  it('retire sa part aux coups de face', () => {
    expect(resoudreParade(coup()).brut).toBeCloseTo(6);
    expect(resoudreParade(coup({ bouclier: 'renforce' })).brut).toBeCloseTo(4);
    expect(resoudreParade(coup({ solide: true }))).toEqual({ brut: 0, pare: true, reussie: false });
  });
});

describe('parade réussie', () => {
  it('demande un bouclier levé depuis 0,3 s au plus quand le coup arrive', () => {
    expect(B.fenetreParade).toBe(0.3);
    expect(resoudreParade(coup({ garde: levee(0) })).reussie).toBe(true);
    expect(resoudreParade(coup({ garde: levee(0.3) })).reussie).toBe(true);
    expect(resoudreParade(coup({ garde: levee(0.31) })).reussie).toBe(false);
    expect(resoudreParade(coup({ garde: levee(2) })).reussie).toBe(false);
  });

  it('ne vaut que pour le gobelin, le bandit et le loup, et de face', () => {
    for (const attaquant of ['gobelin', 'bandit', 'loup']) {
      expect(resoudreParade(coup({ garde: levee(0.1), attaquant })).reussie).toBe(true);
    }
    expect(resoudreParade(coup({ garde: levee(0.1), attaquant: 'slime' }))).toEqual({ brut: expect.closeTo(6), pare: true, reussie: false });
    expect(resoudreParade(coup({ garde: levee(0.1), deFace: false })).reussie).toBe(false);
  });
});

describe('riposte', () => {
  it('double le coup suivant pendant 2 s après une parade réussie, si le nœud est acquis', () => {
    expect(facteurRiposte(creerGarde())).toBe(1);
    expect(facteurRiposte(apresParadeReussie(levee(0.1), false))).toBe(1);
    const prete = apresParadeReussie(levee(0.1), true);
    expect(prete.riposte).toBe(B.dureeRiposte);
    expect(facteurRiposte(prete)).toBe(CONFIG.progression.arbre.riposte.facteur);
    expect(facteurRiposte(pasDeGarde(prete, false, 1.9))).toBe(2);
    expect(facteurRiposte(pasDeGarde(prete, false, 2.1))).toBe(1);
  });

  it('ne sert qu\'une fois', () => {
    const prete = apresParadeReussie(creerGarde(), true);
    const apres = consommerRiposte(prete);
    expect(facteurRiposte(apres)).toBe(1);
    expect(consommerRiposte(apres)).toBe(apres);
  });
});

describe('bouclier levé : déplacement', () => {
  it('on avance 40 % moins vite', () => {
    expect(B.facteurVitesse).toBe(0.6);
    const monde = { hauteur: () => 0, niveauEau: -10, obstacles: [] };
    const marcher = (facteurVitesse?: number) => {
      let etat = creerEtatPersonnage(0, 0, 0, 0);
      for (let k = 0; k < 180; k++) etat = pasDeDeplacement(etat, { x: 0, z: 1, courir: false, sauter: false, facteurVitesse }, 1 / 60, monde);
      return vitesseHorizontale(etat);
    };
    expect(marcher(B.facteurVitesse) / marcher()).toBeCloseTo(0.6, 2);
    expect(marcher(1)).toBeCloseTo(marcher(), 6);
  });
});

describe('étourdissement (parade réussie)', () => {
  const monde = { hauteur: () => 0, niveauEau: -10, obstacles: [] };
  const ctx = (x: number, z: number) => ({ joueur: { x, z, vivant: true }, monde, rayonVillage: 0 });

  it("arrête l'attaque de l'ennemi pendant 1 s, puis il reprend la poursuite", () => {
    expect(B.dureeEtourdissement).toBe(1);
    const gobelin = { ...creerEnnemi('g', 'gobelin', 100, 100), phase: 'attaque' as const };
    let e = etourdirEnnemi(gobelin);
    expect(e.phase).toBe('etourdi');
    expect(e.tempsPhase).toBe(0);
    let degats = 0;
    for (let k = 0; k < 19; k++) {
      const r = pasEnnemi(e, ctx(100, 101), 0.05);
      e = r.etat;
      degats += r.degats;
      expect(e.phase).toBe('etourdi');
      expect(e.x).toBe(100);
      expect(e.z).toBe(100);
    }
    expect(degats).toBe(0);
    e = pasEnnemi(e, ctx(100, 101), 0.1).etat;
    expect(e.phase).toBe('poursuite');
  });

  it("un coup reçu ne raccourcit pas l'étourdissement, mais blesse et peut tuer", () => {
    const e = { ...etourdirEnnemi(creerEnnemi('b', 'bandit', 100, 100)), tempsPhase: 0.4 };
    const coup1 = frapperEnnemi(e, 5, 100, 99);
    expect(coup1.etat.phase).toBe('etourdi');
    expect(coup1.etat.tempsPhase).toBe(0.4);
    expect(coup1.etat.pv).toBe(e.pv - 5);
    expect(frapperEnnemi(e, 9999, 100, 99).mort).toBe(true);
  });

  it('est sans effet sur un ennemi mort', () => {
    const mort = { ...creerEnnemi('m', 'loup', 0, 50), phase: 'mort' as const };
    expect(etourdirEnnemi(mort)).toBe(mort);
  });
});
