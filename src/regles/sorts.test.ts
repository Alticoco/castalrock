import { describe, expect, it } from 'vitest';
import * as S33 from './sorts';
import { CONFIG as CONFIG33 } from '../config';
import { CONFIG } from '../config';
import {
  INFOS_SORTS,
  avancerProjectile,
  ciblesDansExplosion,
  creerProjectile,
  creerRecharges,
  degatsBouleDeFeu,
  lancerSort,
  pasRecharges,
  pointVise,
  soinDuSort,
  sortDebloque,
  type CibleSort,
  type ContexteSort,
  type Projectile,
} from './sorts';

const plat = () => 0;

function contexte(surcharge: Partial<ContexteSort> = {}): ContexteSort {
  return { noeuds: ['boule-de-feu', 'soin'], mana: 50, recharges: creerRecharges(), pv: 50, pvMax: 100, ...surcharge };
}

const cible = (id: string, x: number, z: number, surcharge: Partial<CibleSort> = {}): CibleSort => ({
  id,
  x,
  y: 0,
  z,
  rayon: 0.45,
  hauteur: 1,
  ...surcharge,
});

describe('déblocage', () => {
  it('le nœud Boule de feu débloque la boule de feu, le nœud Soin le soin', () => {
    expect(sortDebloque([], 'boule-de-feu')).toBe(false);
    expect(sortDebloque(['boule-de-feu'], 'boule-de-feu')).toBe(true);
    expect(sortDebloque(['boule-de-feu'], 'soin')).toBe(false);
    expect(sortDebloque(['boule-de-feu', 'soin'], 'soin')).toBe(true);
  });

  it('refuse un sort pas appris, sans dépenser de mana', () => {
    expect(lancerSort('boule-de-feu', contexte({ noeuds: [] }))).toEqual({ ok: false, raison: 'pas-appris' });
    expect(lancerSort('soin', contexte({ noeuds: ['boule-de-feu'] }))).toEqual({ ok: false, raison: 'pas-appris' });
  });
});

describe('lancer', () => {
  it('coûte du mana et lance la recharge', () => {
    const r = lancerSort('boule-de-feu', contexte());
    expect(r).toMatchObject({ ok: true, mana: 35 });
    if (r.ok) expect(r.recharges['boule-de-feu']).toBe(1.5);
    const s = lancerSort('soin', contexte());
    expect(s).toMatchObject({ ok: true, mana: 30 });
    if (s.ok) expect(s.recharges.soin).toBe(6);
  });

  it('refuse faute de mana ou pendant la recharge', () => {
    expect(lancerSort('boule-de-feu', contexte({ mana: 14 }))).toEqual({ ok: false, raison: 'mana' });
    expect(lancerSort('soin', contexte({ mana: 19 }))).toEqual({ ok: false, raison: 'mana' });
    const recharges = { ...creerRecharges(), soin: 2 };
    expect(lancerSort('soin', contexte({ recharges }))).toEqual({ ok: false, raison: 'recharge' });
  });

  it('refuse un soin à vie pleine et tout sort à terre', () => {
    expect(lancerSort('soin', contexte({ pv: 100 }))).toEqual({ ok: false, raison: 'vie-pleine' });
    expect(lancerSort('boule-de-feu', contexte({ pv: 0 }))).toEqual({ ok: false, raison: 'tombe' });
  });

  it("la recharge diminue avec le temps, jusqu'à zéro", () => {
    const r = pasRecharges({ 'boule-de-feu': 1.5, soin: 6, barriere: 0 }, 2);
    expect(r['boule-de-feu']).toBe(0);
    expect(r.soin).toBe(4);
  });

  it('valeurs de la feuille de route', () => {
    expect(INFOS_SORTS['boule-de-feu']).toMatchObject({ cout: 15, recharge: 1.5, touche: 'A' });
    expect(INFOS_SORTS.soin).toMatchObject({ cout: 20, recharge: 6, touche: 'X' });
  });
});

describe('effets', () => {
  it('dégâts et soin de base, puis renforcés par la puissance', () => {
    expect(degatsBouleDeFeu()).toEqual({ direct: 25, explosion: 10 });
    expect(soinDuSort()).toBe(35);
    expect(degatsBouleDeFeu(1.3)).toEqual({ direct: 33, explosion: 13 });
    expect(soinDuSort(1.3)).toBe(46);
  });
});

describe('projectile', () => {
  it('avance à 22 m/s dans la direction visée', () => {
    const p = creerProjectile({ x: 0, y: 5, z: 0 }, { x: 0, y: 5, z: 10 });
    const r = avancerProjectile(p, 0.5, [], plat);
    expect(r.impact).toBeNull();
    expect(r.projectile?.z).toBeCloseTo(11);
    expect(r.projectile?.x).toBeCloseTo(0);
    expect(r.projectile?.distance).toBeCloseTo(11);
  });

  it('part vers le repli si départ et but sont confondus', () => {
    const p = creerProjectile({ x: 1, y: 1, z: 1 }, { x: 1, y: 1, z: 1 }, { x: 1, y: 0, z: 0 });
    expect(p.dx).toBe(1);
  });

  it('touche le premier ennemi rencontré, même avec un grand pas de temps', () => {
    const p = creerProjectile({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0.5, z: 10 });
    const cibles = [cible('loin', 0, 12), cible('proche', 0, 6)];
    const r = avancerProjectile(p, 1, cibles, plat);
    expect(r.projectile).toBeNull();
    expect(r.impact?.cible).toBe('proche');
    expect(r.impact?.z).toBeGreaterThan(5);
    expect(r.impact?.z).toBeLessThan(6);
  });

  it("passe à côté ou au-dessus d'un ennemi", () => {
    const p = creerProjectile({ x: 0, y: 0.5, z: 0 }, { x: 0, y: 0.5, z: 10 });
    expect(avancerProjectile(p, 0.5, [cible('a', 3, 6)], plat).impact).toBeNull();
    const haut = creerProjectile({ x: 0, y: 4, z: 0 }, { x: 0, y: 4, z: 10 });
    expect(avancerProjectile(haut, 0.5, [cible('a', 0, 6)], plat).impact).toBeNull();
  });

  it("explose sur le sol sans toucher d'ennemi", () => {
    const p = creerProjectile({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 5 });
    const r = avancerProjectile(p, 1, [], plat);
    expect(r.projectile).toBeNull();
    expect(r.impact?.cible).toBeNull();
    expect(r.impact?.y).toBe(0);
  });

  it("s'éteint sans exploser à 30 m de portée", () => {
    let p: Projectile | null = creerProjectile({ x: 0, y: 5, z: 0 }, { x: 0, y: 5, z: 1 });
    let pas = 0;
    let impact = null;
    while (p && pas < 100) {
      const r = avancerProjectile(p, 0.1, [], plat);
      p = r.projectile;
      impact = r.impact;
      pas += 1;
    }
    expect(p).toBeNull();
    expect(impact).toBeNull();
    // 30 m à 22 m/s : environ 1,4 s, soit 14 pas de 0,1 s
    expect(pas).toBeGreaterThanOrEqual(Math.floor(CONFIG.sorts.bouleDeFeu.portee / (22 * 0.1)));
    expect(pas).toBeLessThan(16);
  });

  it("pointVise : l'ennemi traversé, le sol, ou un point lointain", () => {
    const origine = { x: 0, y: 2, z: 0 };
    const devant = { x: 0, y: 0, z: 1 };
    const surEnnemi = pointVise(origine, devant, [cible('a', 0, 8, { hauteur: 3 })], plat);
    expect(surEnnemi.z).toBeGreaterThan(7);
    expect(surEnnemi.z).toBeLessThan(8.6);
    const surSol = pointVise({ x: 0, y: 3, z: 0 }, { x: 0, y: -0.6, z: 0.8 }, [], plat);
    expect(surSol.y).toBe(0);
    expect(surSol.z).toBeCloseTo(4, 0);
    const ciel = pointVise(origine, devant, [], plat);
    expect(ciel.z).toBeCloseTo(30);
  });
});

describe('explosion', () => {
  it('touche les ennemis à moins de 3 m, sauf celui touché de plein fouet', () => {
    const cibles = [cible('direct', 0, 0), cible('pres', 2, 0), cible('limite', 3.4, 0), cible('loin', 8, 0)];
    expect(ciblesDansExplosion(cibles, { x: 0, y: 0.5, z: 0 }, 3, 'direct')).toEqual(['pres', 'limite']);
    expect(ciblesDansExplosion(cibles, { x: 0, y: 0.5, z: 0 })).toEqual(['direct', 'pres', 'limite']);
  });

  it('tient compte de la hauteur', () => {
    expect(ciblesDansExplosion([cible('a', 0, 0)], { x: 0, y: 6, z: 0 })).toEqual([]);
  });
});

describe('barrière (sort C)', () => {
  const B = CONFIG33.progression.arbre.barriere;

  it('se lance avec le nœud Barrière, coûte du mana et se recharge', () => {
    const base = { mana: 50, recharges: S33.creerRecharges(), pv: 100, pvMax: 100 };
    expect(S33.lancerSort('barriere', { ...base, noeuds: ['boule-de-feu', 'soin'] })).toEqual({ ok: false, raison: 'pas-appris' });
    const r = S33.lancerSort('barriere', { ...base, noeuds: ['barriere'] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mana).toBe(50 - CONFIG33.sorts.barriere.cout);
    expect(r.recharges.barriere).toBe(CONFIG33.sorts.barriere.recharge);
    expect(S33.lancerSort('barriere', { ...base, noeuds: ['barriere'], recharges: r.recharges })).toEqual({ ok: false, raison: 'recharge' });
    expect(S33.pasRecharges(r.recharges, 5).barriere).toBe(CONFIG33.sorts.barriere.recharge - 5);
    expect(S33.INFOS_SORTS.barriere.touche).toBe('C');
  });

  it('absorbe 30 dégâts, puis laisse passer le surplus', () => {
    expect(B.absorbe).toBe(30);
    let b = S33.creerBarriere();
    expect(S33.barriereActive(b)).toBe(true);
    const un = S33.absorberDegats(b, 12);
    expect(un).toEqual({ barriere: { reste: 18, temps: B.duree }, absorbe: 12, passe: 0 });
    b = un.barriere;
    const deux = S33.absorberDegats(b, 25);
    expect(deux.absorbe).toBe(18);
    expect(deux.passe).toBe(7);
    expect(S33.barriereActive(deux.barriere)).toBe(false);
    expect(S33.absorberDegats(deux.barriere, 10)).toEqual({ barriere: deux.barriere, absorbe: 0, passe: 10 });
  });

  it("s'éteint au bout de 8 s, même intacte", () => {
    expect(B.duree).toBe(8);
    let b = S33.creerBarriere();
    b = S33.pasBarriere(b, 7.9);
    expect(S33.barriereActive(b)).toBe(true);
    expect(b.reste).toBe(30);
    b = S33.pasBarriere(b, 0.2);
    expect(S33.barriereActive(b)).toBe(false);
    expect(S33.absorberDegats(b, 10).passe).toBe(10);
    expect(S33.barriereActive(S33.SANS_BARRIERE)).toBe(false);
  });
});
