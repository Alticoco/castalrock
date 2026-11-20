import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { COUTS_AMELIORATION, ameliorer, coutAmelioration, messageBlocage, peutAmeliorer, type EtatAmelioration } from './ameliorationVillage';
import { ajouter, compter, creerConteneur } from './inventaire';
import type { NiveauVillage } from './village';

function etat(niveau: NiveauVillage, porte: Record<string, number>, coffre: Record<string, number> = {}, niveauDebloque = 3): EtatAmelioration {
  let inventaire = creerConteneur(20);
  for (const [o, n] of Object.entries(porte)) inventaire = ajouter(inventaire, o, n).conteneur;
  let c = creerConteneur(20);
  for (const [o, n] of Object.entries(coffre)) c = ajouter(c, o, n).conteneur;
  return { niveau, inventaire, coffre: c, niveauDebloque };
}

describe('amélioration du village', () => {
  it('connaît les coûts de chaque niveau', () => {
    expect(coutAmelioration(1)).toEqual(COUTS_AMELIORATION[2]);
    expect(coutAmelioration(2)).toEqual(COUTS_AMELIORATION[3]);
    expect(coutAmelioration(3)).toBeNull();
    expect(COUTS_AMELIORATION[2]).toEqual([
      { objet: 'bois', quantite: 40 },
      { objet: 'pierre', quantite: 30 },
      { objet: 'or', quantite: 10 },
    ]);
  });

  it("passe au niveau 2 en prenant dans l'inventaire puis le coffre", () => {
    const e = etat(1, { bois: 30, pierre: 30, or: 10 }, { bois: 15 });
    expect(peutAmeliorer(e)).toBe(true);
    const r = ameliorer(e);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.etat.niveau).toBe(2);
    expect(compter(r.etat.inventaire, 'bois')).toBe(0);
    expect(compter(r.etat.coffre, 'bois')).toBe(5);
    expect(compter(r.etat.inventaire, 'or')).toBe(0);
    expect(r.xp).toBe(CONFIG.village.xpAmelioration);
    expect(r.message).toBe('Le village grandit !');
  });

  it('passe au niveau 3 avec les lingots de fer', () => {
    const r = ameliorer(etat(2, { bois: 80, pierre: 60, 'lingot-fer': 6, or: 40 }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.etat.niveau).toBe(3);
  });

  it("refuse sans rien consommer s'il manque une ressource", () => {
    const e = etat(2, { bois: 80, pierre: 60, 'lingot-fer': 5, or: 40 });
    const r = ameliorer(e);
    expect(r).toMatchObject({ ok: false, xp: 0 });
    expect(r.etat).toBe(e);
  });

  it('refuse au niveau maximal', () => {
    const e = etat(3, { bois: 999 });
    expect(peutAmeliorer(e)).toBe(false);
    expect(ameliorer(e)).toMatchObject({ ok: false, message: 'Le village est au niveau maximal' });
  });

  it("refuse tant que la quête de Gaspard n'est pas faite, même avec toutes les ressources", () => {
    const riche = { bois: 40, pierre: 30, or: 10 };
    const e = etat(1, riche, {}, 1);
    expect(peutAmeliorer(e)).toBe(false);
    const r = ameliorer(e);
    expect(r).toMatchObject({ ok: false, xp: 0 });
    expect(r.message).toBe(messageBlocage(2));
    expect(r.message).toContain('Renforcer le village');
    expect(r.etat).toBe(e);
    expect(ameliorer(etat(1, riche, {}, 2)).ok).toBe(true);
  });

  it('le niveau 3 attend la quête du guetteur', () => {
    const riche = { bois: 80, pierre: 60, 'lingot-fer': 6, or: 40 };
    expect(ameliorer(etat(2, riche, {}, 2))).toMatchObject({ ok: false });
    expect(messageBlocage(3)).toContain('Le guetteur');
    expect(ameliorer(etat(2, riche, {}, 3)).ok).toBe(true);
  });
});
