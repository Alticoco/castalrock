import { describe, expect, it } from 'vitest';
import { BRANCHES, NOEUDS, noeudsDeLaBranche } from './competences';
import { PARAMETRES_ETOILE, positionNoeud, rangeeMax, rayonNoeud } from './etoileCompetences';

describe('étoile des compétences', () => {
  it('la dernière rangée de chaque branche finit sur le cercle extérieur', () => {
    for (const b of BRANCHES) {
      const derniers = noeudsDeLaBranche(b).filter((n) => n.ligne === rangeeMax(b));
      expect(derniers.length).toBeGreaterThan(0);
      for (const n of derniers) expect(rayonNoeud(n)).toBeCloseTo(PARAMETRES_ETOILE.rayonExterieur, 6);
    }
  });

  it('la rangée 0 est sur le cercle intérieur et la distance au centre est celle du rayon', () => {
    for (const n of NOEUDS) {
      if (n.ligne === 0) expect(rayonNoeud(n)).toBeCloseTo(PARAMETRES_ETOILE.rayonInterieur, 6);
      const { x, y } = positionNoeud(n);
      expect(Math.hypot(x, y)).toBeCloseTo(rayonNoeud(n), 6);
    }
  });

  it('la branche du combat part vers le haut (y négatif) et celle de l\'artisanat vers le bas', () => {
    const lame = NOEUDS.find((n) => n.id === 'lame-affutee')!;
    const forgeron = NOEUDS.find((n) => n.id === 'forgeron')!;
    expect(positionNoeud(lame).y).toBeLessThan(0);
    expect(positionNoeud(forgeron).y).toBeGreaterThan(0);
  });
});
