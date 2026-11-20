import { describe, expect, it } from 'vitest';
import { BRANCHES, NOEUDS, NOEUDS_PAR_ID, effetsArbre, etatNoeud, noeudsDeLaBranche } from './competences';

describe("arbre de compétences", () => {
  it('identifiants uniques, parents existants, un point par nœud', () => {
    expect(NOEUDS_PAR_ID.size).toBe(NOEUDS.length);
    for (const n of NOEUDS) {
      expect(n.cout).toBe(1);
      for (const p of n.parents) expect(NOEUDS_PAR_ID.get(p)?.branche).toBe(n.branche);
    }
  });

  it('cinq branches (sans la Chasse), chacune avec au moins un nœud de départ', () => {
    expect(BRANCHES).toHaveLength(6);
    for (const b of BRANCHES) expect(noeudsDeLaBranche(b).some((n) => n.parents.length === 0)).toBe(true);
    expect(NOEUDS).toHaveLength(28);
  });

  it('Abondance demande Bûcheron OU Mineur', () => {
    expect(etatNoeud([], 'abondance')).toBe('verrouille');
    expect(etatNoeud(['bucheron'], 'abondance')).toBe('disponible');
    expect(etatNoeud(['mineur'], 'abondance')).toBe('disponible');
    expect(etatNoeud(['mineur', 'abondance'], 'abondance')).toBe('acquis');
  });

  it("les nœuds de départ sont disponibles, les autres verrouillés", () => {
    expect(etatNoeud([], 'lame-affutee')).toBe('disponible');
    expect(etatNoeud([], 'enchainement')).toBe('verrouille');
    expect(etatNoeud(['lame-affutee'], 'enchainement')).toBe('disponible');
  });

  it("plus aucun nœud n'est signalé « bientôt » (étape 33 faite)", () => {
    for (const n of NOEUDS) expect(n.description).not.toContain('(bientôt)');
  });

  it('effets neutres sans nœud', () => {
    expect(effetsArbre([])).toMatchObject({ degatsEpee: 0, coutReparation: 1, durabilite: 1, rayonExplosion: 1, secondSouffle: false });
  });
});
