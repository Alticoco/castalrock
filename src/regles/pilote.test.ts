import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  choisirElement,
  creerPilote,
  ennemiMenacant,
  pasPilote,
  type CandidatElement,
  type CandidatEnnemi,
  type ContextePilote,
} from './pilote';

const P = CONFIG.pilote;

const arbre = (id: string, x: number, z: number): CandidatElement => ({ id, x, z, rayon: 0.7 });
const ennemi = (id: string, x: number, z: number, phase: CandidatEnnemi['phase'] = 'poursuite'): CandidatEnnemi => ({
  id,
  x,
  z,
  rayon: 0.5,
  phase,
});

function contexte(extra: Partial<ContextePilote> = {}, elements: CandidatElement[] = []): ContextePilote {
  return {
    joueur: { x: 0, z: 0 },
    pvRatio: 1,
    toucheDeplacement: false,
    ennemis: [],
    elements: () => elements,
    elementExiste: (id) => elements.some((e) => e.id === id),
    peutRecolter: () => true,
    porteeEpee: CONFIG.combat.porteeEpee,
    porteeRecolte: CONFIG.recolte.portee,
    ...extra,
  };
}

describe('ennemi menaçant', () => {
  const joueur = { x: 0, z: 0 };

  it("retient un ennemi qui attaque, même loin, et ignore celui qui erre au loin", () => {
    expect(ennemiMenacant([ennemi('a', 10, 0, 'poursuite')], joueur, 2.8)?.id).toBe('a');
    expect(ennemiMenacant([ennemi('a', 10, 0, 'errance')], joueur, 2.8)).toBeNull();
    expect(ennemiMenacant([ennemi('a', 10, 0, 'repos')], joueur, 2.8)).toBeNull();
  });

  it("retient un ennemi à portée de l'épée même au repos, mais pas un ennemi mort", () => {
    expect(ennemiMenacant([ennemi('a', 2, 0, 'repos')], joueur, 2.8)?.id).toBe('a');
    expect(ennemiMenacant([ennemi('a', 1, 0, 'mort')], joueur, 2.8)).toBeNull();
  });

  it('prend le plus proche', () => {
    expect(ennemiMenacant([ennemi('loin', 8, 0), ennemi('pres', 4, 0)], joueur, 2.8)?.id).toBe('pres');
  });
});

describe('choix d\'un élément', () => {
  const centre = { x: 0, z: 0 };

  it('prend le plus proche du personnage, dans la zone', () => {
    const e = [arbre('loin', 20, 0), arbre('pres', 5, 0), arbre('dehors', 40, 0)];
    const r = choisirElement(e, { x: 0, z: 0 }, centre, P.rayonZone, [], () => true);
    expect((r as CandidatElement).id).toBe('pres');
  });

  it('ignore ce qui est hors de la zone ou abandonné', () => {
    expect(choisirElement([arbre('dehors', 30, 0)], { x: 0, z: 0 }, centre, P.rayonZone, [], () => true)).toBeNull();
    expect(choisirElement([arbre('a', 5, 0)], { x: 0, z: 0 }, centre, P.rayonZone, ['a'], () => true)).toBeNull();
  });

  it("signale l'inventaire plein quand aucun butin ne tient, sinon prend le premier qui tient", () => {
    const e = [arbre('a', 5, 0), arbre('b', 8, 0)];
    expect(choisirElement(e, { x: 0, z: 0 }, centre, P.rayonZone, [], () => false)).toBe('inventairePlein');
    const r = choisirElement(e, { x: 0, z: 0 }, centre, P.rayonZone, [], (id) => id === 'b');
    expect((r as CandidatElement).id).toBe('b');
  });
});

describe('pilote automatique', () => {
  it('marche vers la cible à 90 % de la vitesse, sans frapper', () => {
    const r = pasPilote(creerPilote(0, 0), contexte({}, [arbre('a', 10, 0)]), 0.1);
    expect(r.arret).toBeNull();
    expect(r.ordre.frapper).toBe(false);
    expect(r.ordre.x).toBeCloseTo(P.facteurLenteur);
    expect(r.ordre.z).toBeCloseTo(0);
    expect(r.etat.cible?.id).toBe('a');
    expect(r.etat.mode).toBe('recolte');
  });

  it("s'arrête à portée, fait face à la cible et frappe", () => {
    const r = pasPilote(creerPilote(0, 0), contexte({}, [arbre('a', 0, 2.5)]), 0.1);
    expect(r.ordre.frapper).toBe(true);
    expect(r.ordre.x).toBe(0);
    expect(r.ordre.z).toBe(0);
    expect(r.ordre.orientation).toBeCloseTo(0);
    const est = pasPilote(creerPilote(0, 0), contexte({}, [arbre('b', 2.5, 0)]), 0.1);
    expect(est.ordre.orientation).toBeCloseTo(Math.PI / 2);
  });

  it('un ennemi qui attaque passe avant la récolte, et le mode devient combat', () => {
    const e = ennemi('g', 0, 8);
    const r = pasPilote(creerPilote(0, 0), contexte({ ennemis: [e] }, [arbre('a', 3, 0)]), 0.1);
    expect(r.etat.cible).toMatchObject({ genre: 'ennemi', id: 'g' });
    expect(r.etat.mode).toBe('combat');
    expect(r.ordre.frapper).toBe(false);
    const pres = pasPilote(creerPilote(0, 0), contexte({ ennemis: [ennemi('g', 0, 2)] }, [arbre('a', 3, 0)]), 0.1);
    expect(pres.ordre.frapper).toBe(true);
  });

  it("reprend la récolte quand l'ennemi a disparu", () => {
    const e = ennemi('g', 0, 8);
    const combat = pasPilote(creerPilote(0, 0), contexte({ ennemis: [e] }, [arbre('a', 5, 0)]), 0.1);
    const suite = pasPilote(combat.etat, contexte({}, [arbre('a', 5, 0)]), 0.1);
    expect(suite.etat.cible).toMatchObject({ genre: 'element', id: 'a' });
    expect(suite.etat.mode).toBe('recolte');
  });

  it('change de cible quand l\'élément a été récolté', () => {
    const premier = pasPilote(creerPilote(0, 0), contexte({}, [arbre('a', 0, 2), arbre('b', 12, 0)]), 0.1);
    expect(premier.etat.cible?.id).toBe('a');
    const suite = pasPilote(premier.etat, contexte({}, [arbre('b', 12, 0)]), 0.1);
    expect(suite.etat.cible?.id).toBe('b');
  });

  it('abandonne une cible bloquée plus de 3 s, puis passe à une autre', () => {
    let etat = creerPilote(0, 0);
    const elements = [arbre('bloque', 10, 0), arbre('autre', -15, 0)];
    let abandonne = false;
    // Le personnage ne bouge pas (obstacle) : la distance ne diminue jamais
    for (let t = 0; t < 40 && !abandonne; t++) {
      const r = pasPilote(etat, contexte({}, elements), 0.1);
      etat = r.etat;
      abandonne = r.etat.abandonnes.includes('bloque');
    }
    expect(abandonne).toBe(true);
    const suite = pasPilote(etat, contexte({}, elements), 0.1);
    expect(suite.etat.cible?.id).toBe('autre');
  });

  it('ne se croit pas bloqué tant qu\'il se rapproche', () => {
    let etat = creerPilote(0, 0);
    const elements = [arbre('a', 30, 0)];
    let x = 0;
    for (let t = 0; t < 60; t++) {
      const r = pasPilote(etat, contexte({ joueur: { x, z: 0 } }, elements), 0.1);
      etat = r.etat;
      x += r.ordre.x * 5 * 0.1;
    }
    expect(etat.abandonnes).toEqual([]);
  });

  it('s\'arrête : touche de déplacement, vie sous 30 %, plus rien dans la zone, inventaire plein', () => {
    const el = [arbre('a', 10, 0)];
    expect(pasPilote(creerPilote(0, 0), contexte({ toucheDeplacement: true }, el), 0.1).arret).toBe('touche');
    expect(pasPilote(creerPilote(0, 0), contexte({ pvRatio: 0.29 }, el), 0.1).arret).toBe('vieBasse');
    expect(pasPilote(creerPilote(0, 0), contexte({ pvRatio: 0.3 }, el), 0.1).arret).toBeNull();
    expect(pasPilote(creerPilote(0, 0), contexte({}, []), 0.1).arret).toBe('rienDansLaZone');
    expect(pasPilote(creerPilote(0, 0), contexte({}, [arbre('loin', 40, 0)]), 0.1).arret).toBe('rienDansLaZone');
    expect(pasPilote(creerPilote(0, 0), contexte({ peutRecolter: () => false }, el), 0.1).arret).toBe('inventairePlein');
  });

  it("s'arrête si l'inventaire se remplit pendant la récolte de la cible en cours", () => {
    const el = [arbre('a', 10, 0)];
    const r = pasPilote(creerPilote(0, 0), contexte({}, el), 0.1);
    expect(pasPilote(r.etat, contexte({ peutRecolter: () => false }, el), 0.1).arret).toBe('inventairePlein');
  });

  it('la zone reste centrée sur le point d\'activation, pas sur le personnage', () => {
    // Le personnage a marché à 20 m du centre : un arbre à 30 m du centre est hors zone
    const r = pasPilote(creerPilote(0, 0), contexte({ joueur: { x: 20, z: 0 } }, [arbre('a', 30, 0)]), 0.1);
    expect(r.arret).toBe('rienDansLaZone');
  });
});
