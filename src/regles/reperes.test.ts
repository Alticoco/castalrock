import { describe, expect, it } from 'vitest';
import {
  MAX_REPERES,
  etatReperesInitial,
  lireReperes,
  poserRepere,
  retirerRepere,
  suivre,
  type EtatReperes,
} from './reperes';

/** Pose `n` repères d'affilée (le type et la position importent peu). */
function avecReperes(n: number): EtatReperes {
  let etat = etatReperesInitial();
  for (let i = 0; i < n; i++) {
    const r = poserRepere(etat, 'filon', i, -i - 1);
    if (!r.ok) throw new Error('pose refusée');
    etat = r.etat;
  }
  return etat;
}

describe('repères : poser', () => {
  it('donne des identifiants croissants et garde le type et la position', () => {
    const a = poserRepere(etatReperesInitial(), 'tresor', 3, 4);
    if (!a.ok) throw new Error('refusée');
    const b = poserRepere(a.etat, 'danger', -1, 2);
    if (!b.ok) throw new Error('refusée');
    expect(a.repere).toEqual({ id: 1, type: 'tresor', x: 3, z: 4 });
    expect(b.repere).toEqual({ id: 2, type: 'danger', x: -1, z: 2 });
    expect(b.etat.liste).toEqual([a.repere, b.repere]);
    expect(b.etat.prochainId).toBe(3);
  });

  it("ne suit pas le nouveau repère d'office", () => {
    expect(avecReperes(2).suivi).toBeNull();
  });

  it('ne réutilise jamais un identifiant après un retrait', () => {
    const apres = retirerRepere(avecReperes(3), 3);
    const r = poserRepere(apres, 'lieu', 0, 0);
    if (!r.ok) throw new Error('refusée');
    expect(r.repere.id).toBe(4);
  });

  it(`refuse au-delà de ${MAX_REPERES} repères`, () => {
    const plein = avecReperes(MAX_REPERES);
    expect(plein.liste).toHaveLength(MAX_REPERES);
    expect(poserRepere(plein, 'filon', 0, 0)).toEqual({ ok: false, raison: 'plein' });
  });

  it('est de nouveau possible après un retrait', () => {
    expect(poserRepere(retirerRepere(avecReperes(MAX_REPERES), 1), 'filon', 0, 0).ok).toBe(true);
  });

  it("ne modifie pas l'état d'origine", () => {
    const avant = etatReperesInitial();
    poserRepere(avant, 'filon', 1, 1);
    expect(avant).toEqual({ liste: [], prochainId: 1, suivi: null });
  });
});

describe('repères : retirer', () => {
  it('enlève le repère demandé', () => {
    expect(retirerRepere(avecReperes(3), 2).liste.map((r) => r.id)).toEqual([1, 3]);
  });

  it('un id inconnu ne change rien (même objet)', () => {
    const etat = avecReperes(2);
    expect(retirerRepere(etat, 99)).toBe(etat);
  });

  it('le suivi retombe à null si le repère retiré était suivi', () => {
    expect(retirerRepere(suivre(avecReperes(3), 2), 2).suivi).toBeNull();
  });

  it('garde le suivi si un autre repère est retiré', () => {
    expect(retirerRepere(suivre(avecReperes(3), 2), 1).suivi).toBe(2);
  });

  it('garde le suivi du village', () => {
    expect(retirerRepere(suivre(avecReperes(2), 'village'), 1).suivi).toBe('village');
  });

  it("ne modifie pas l'état d'origine", () => {
    const etat = avecReperes(2);
    retirerRepere(etat, 1);
    expect(etat.liste).toHaveLength(2);
  });
});

describe('repères : suivre', () => {
  it('suit un repère existant', () => {
    expect(suivre(avecReperes(2), 2).suivi).toBe(2);
  });

  it('un id inconnu ne change rien (même objet)', () => {
    const etat = suivre(avecReperes(2), 1);
    expect(suivre(etat, 42)).toBe(etat);
  });

  it('suit le village, même sans repère', () => {
    expect(suivre(etatReperesInitial(), 'village').suivi).toBe('village');
  });

  it('ne plus rien suivre avec null', () => {
    expect(suivre(suivre(avecReperes(1), 1), null).suivi).toBeNull();
  });

  it("ne modifie pas l'état d'origine", () => {
    const etat = avecReperes(2);
    suivre(etat, 1);
    expect(etat.suivi).toBeNull();
  });
});

describe('repères : lireReperes', () => {
  it('refuse un prochainId trop grand pour rester exact (ids en double sinon)', () => {
    const e = lireReperes({ liste: [{ id: 2, type: 'filon', x: 1, z: 1 }], prochainId: 1e300, suivi: null });
    expect(e.prochainId).toBe(3);
  });

  const initial = etatReperesInitial();

  it("donne l'état initial pour une valeur absente ou qui n'est pas un objet", () => {
    expect(lireReperes(undefined)).toEqual(initial);
    expect(lireReperes(null)).toEqual(initial);
    expect(lireReperes(12)).toEqual(initial);
    expect(lireReperes('texte')).toEqual(initial);
  });

  it("donne l'état initial pour un objet vide", () => {
    expect(lireReperes({})).toEqual(initial);
  });

  it("relit un état valide à l'identique", () => {
    const etat = suivre(avecReperes(3), 2);
    expect(lireReperes(JSON.parse(JSON.stringify(etat)))).toEqual(etat);
  });

  it('ignore les repères abîmés (type inconnu, coordonnées non numériques, id invalide) et garde les autres', () => {
    const lu = lireReperes({
      liste: [
        { id: 1, type: 'filon', x: 1, z: 2 },
        { id: 2, type: 'dragon', x: 0, z: 0 },
        { id: 3, type: 'danger', x: '5', z: 0 },
        { id: 4, type: 'danger', x: 0, z: null },
        { id: 5, type: 'danger', x: Infinity, z: 0 },
        { id: 'six', type: 'lieu', x: 0, z: 0 },
        { id: 0, type: 'lieu', x: 0, z: 0 },
        { id: 1.5, type: 'lieu', x: 0, z: 0 },
        null,
        'x',
        { id: 7, type: 'lieu', x: -3, z: 4 },
      ],
      prochainId: 8,
      suivi: null,
    });
    expect(lu.liste).toEqual([
      { id: 1, type: 'filon', x: 1, z: 2 },
      { id: 7, type: 'lieu', x: -3, z: 4 },
    ]);
  });

  it("ignore une liste qui n'en est pas une", () => {
    expect(lireReperes({ liste: 'oups', prochainId: 4, suivi: null })).toEqual({ liste: [], prochainId: 4, suivi: null });
  });

  it('ignore les ids en double (le premier est gardé)', () => {
    const lu = lireReperes({
      liste: [
        { id: 1, type: 'filon', x: 1, z: 1 },
        { id: 1, type: 'danger', x: 2, z: 2 },
      ],
      prochainId: 2,
      suivi: null,
    });
    expect(lu.liste).toEqual([{ id: 1, type: 'filon', x: 1, z: 1 }]);
  });

  it(`garde au plus ${MAX_REPERES} repères`, () => {
    const liste = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, type: 'filon', x: i, z: i }));
    const lu = lireReperes({ liste, prochainId: 13, suivi: null });
    expect(lu.liste).toHaveLength(MAX_REPERES);
    expect(lu.liste[MAX_REPERES - 1].id).toBe(MAX_REPERES);
  });

  it('corrige un prochainId trop petit ou invalide : il dépasse toujours le plus grand id', () => {
    const liste = [{ id: 5, type: 'filon', x: 0, z: 0 }];
    expect(lireReperes({ liste, prochainId: 2, suivi: null }).prochainId).toBe(6);
    expect(lireReperes({ liste, prochainId: 5, suivi: null }).prochainId).toBe(6);
    expect(lireReperes({ liste, prochainId: 'x', suivi: null }).prochainId).toBe(6);
    expect(lireReperes({ liste, prochainId: 2.5, suivi: null }).prochainId).toBe(6);
  });

  it('garde un prochainId plus grand (les ids retirés ne reviennent pas)', () => {
    expect(lireReperes({ liste: [{ id: 2, type: 'filon', x: 0, z: 0 }], prochainId: 10, suivi: null }).prochainId).toBe(10);
  });

  it('un suivi qui pointe vers un repère absent retombe à null', () => {
    const liste = [{ id: 1, type: 'filon', x: 0, z: 0 }];
    expect(lireReperes({ liste, prochainId: 2, suivi: 9 }).suivi).toBeNull();
    expect(lireReperes({ liste, prochainId: 2, suivi: 'autre' }).suivi).toBeNull();
  });

  it('un suivi vers un repère ignoré (abîmé) retombe à null', () => {
    const liste = [{ id: 1, type: 'dragon', x: 0, z: 0 }];
    expect(lireReperes({ liste, prochainId: 2, suivi: 1 }).suivi).toBeNull();
  });

  it("garde le suivi du village et celui d'un repère présent", () => {
    const liste = [{ id: 1, type: 'filon', x: 0, z: 0 }];
    expect(lireReperes({ liste, prochainId: 2, suivi: 'village' }).suivi).toBe('village');
    expect(lireReperes({ liste, prochainId: 2, suivi: 1 }).suivi).toBe(1);
  });

  it('ne modifie pas la donnée lue', () => {
    const brut = { liste: [{ id: 1, type: 'filon', x: 0, z: 0 }, { id: 1, type: 'x', x: 0, z: 0 }], prochainId: 0, suivi: 7 };
    const copie = JSON.parse(JSON.stringify(brut));
    lireReperes(brut);
    expect(brut).toEqual(copie);
  });
});
