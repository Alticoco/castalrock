import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  MESSAGES_REFUS_PIEGE,
  mettreAJourPieges,
  piegeAPortee,
  reprendrePiege,
  poserPiege,
  releverPiege,
  tirerPrise,
  verifierPiege,
  type Piege,
} from './pieges';

const P = CONFIG.pieges;

describe('pieges : pose', () => {
  it('refuse hors prairie et forêt, trop près d’un autre piège, et au-delà du maximum', () => {
    expect(verifierPiege([], 0, 0, 'prairie')).toEqual({ ok: true });
    expect(verifierPiege([], 0, 0, 'foret')).toEqual({ ok: true });
    expect(verifierPiege([], 0, 0, 'montagne')).toEqual({ ok: false, raison: 'biome' });
    expect(verifierPiege([], 0, 0, 'marais')).toEqual({ ok: false, raison: 'biome' });
    const un = poserPiege([], 0, 0, 10);
    expect(verifierPiege(un, 1, 0, 'prairie')).toEqual({ ok: false, raison: 'proche' });
    expect(verifierPiege(un, P.distanceMiniEntrePieges + 1, 0, 'prairie')).toEqual({ ok: true });
    let cinq: Piege[] = [];
    for (let i = 0; i < P.max; i += 1) cinq = poserPiege(cinq, i * 10, 0, 0);
    expect(verifierPiege(cinq, 100, 100, 'prairie')).toEqual({ ok: false, raison: 'maximum' });
    expect(MESSAGES_REFUS_PIEGE.maximum).toContain(String(P.max));
  });

  it('un piège posé est en attente, avec un identifiant neuf à chaque fois', () => {
    const a = poserPiege([], 3, 4, 50);
    expect(a).toEqual([{ id: 't:0', x: 3, z: 4, instant: 50, etat: 'attente' }]);
    const b = poserPiege(a, 30, 4, 60);
    expect(b.map((p) => p.id)).toEqual(['t:0', 't:1']);
  });
});

describe('pieges : prise', () => {
  it('le délai est entre 2 et 5 minutes et le tirage est reproductible', () => {
    for (let i = 0; i < 50; i += 1) {
      const t = tirerPrise({ id: `t:${i}`, instant: i * 37 }, 42);
      expect(t.delai).toBeGreaterThanOrEqual(P.delaiMin);
      expect(t.delai).toBeLessThan(P.delaiMax);
      expect(t).toEqual(tirerPrise({ id: `t:${i}`, instant: i * 37 }, 42));
    }
  });

  it('le lapin est fréquent, le renard rare', () => {
    let renards = 0;
    const n = 600;
    for (let i = 0; i < n; i += 1) if (tirerPrise({ id: `t:${i}`, instant: 0 }, 7).proie === 'renard') renards += 1;
    expect(renards).toBeGreaterThan(0);
    expect(renards / n).toBeGreaterThan(P.chanceRenard - 0.07);
    expect(renards / n).toBeLessThan(P.chanceRenard + 0.07);
  });

  it('le piège se remplit une fois le délai passé, pas avant', () => {
    const [p] = poserPiege([], 0, 0, 100);
    const { delai, proie } = tirerPrise(p, CONFIG.graine);
    const avant = mettreAJourPieges([p], 100 + delai - 1);
    expect(avant[0].etat).toBe('attente');
    const apres = mettreAJourPieges([p], 100 + delai + 1);
    expect(apres[0]).toMatchObject({ etat: 'plein', prise: proie });
    // Rien ne change : la même liste revient (pas de redessin inutile)
    expect(mettreAJourPieges(apres, 100 + delai + 50)).toBe(apres);
  });
});

describe('pieges : relève', () => {
  it('relever un piège plein donne le butin de la proie et remet le piège en attente, en place', () => {
    const plein: Piege = { id: 't:2', x: 5, z: 6, instant: 0, etat: 'plein', prise: 'renard' };
    const r = releverPiege(plein, 900)!;
    expect(r.proie).toBe('renard');
    expect(r.butin['fourrure-renard']).toBe(1);
    expect(r.butin['viande-crue']).toBe(1);
    expect(r.piege).toEqual({ id: 't:2', x: 5, z: 6, instant: 900, etat: 'attente' });
    const lapin = releverPiege({ ...plein, prise: 'lapin' }, 900)!;
    expect(lapin.butin['viande-crue']).toBe(1);
    expect(lapin.butin['fourrure-renard']).toBeUndefined();
  });

  it('un piège vide ne se relève pas', () => {
    expect(releverPiege({ id: 't:0', x: 0, z: 0, instant: 0, etat: 'attente' }, 10)).toBeNull();
  });

  it('le piège à portée est le plus proche', () => {
    const pieges = poserPiege(poserPiege([], 0, 0, 0), 10, 0, 0);
    expect(piegeAPortee(pieges, 0.5, 0)?.id).toBe('t:0');
    expect(piegeAPortee(pieges, 9.5, 0)?.id).toBe('t:1');
    expect(piegeAPortee(pieges, 5, 0)).toBeNull();
  });

  it('le filtre ne garde que les pièges pleins (ou vides) à portée', () => {
    const pieges = [
      { id: 't:0', x: 0, z: 0, instant: 0, etat: 'attente' as const },
      { id: 't:1', x: 1, z: 0, instant: 0, etat: 'plein' as const, prise: 'lapin' as const },
    ];
    expect(piegeAPortee(pieges, 0.2, 0)?.id).toBe('t:0');
    expect(piegeAPortee(pieges, 0.2, 0, 'plein')?.id).toBe('t:1');
    expect(piegeAPortee(pieges, 0.9, 0, 'attente')?.id).toBe('t:0');
  });

  it('un piège repris disparaît de la liste', () => {
    const pieges = poserPiege(poserPiege([], 0, 0, 0), 10, 0, 0);
    expect(reprendrePiege(pieges, 't:0').map((p) => p.id)).toEqual(['t:1']);
  });
});
