import { describe, expect, it } from 'vitest';
import { retirerArmureVers } from './armureGlisse';
import { creerEquipement } from './equipement';
import { creerConteneur } from './inventaire';

describe('retirerArmureVers', () => {
  const porte = { ...creerEquipement(), armure: 'cuir' as const };

  it("pose l'armure dans la case visée si elle est vide", () => {
    const r = retirerArmureVers(porte, creerConteneur(4), 2);
    expect(r.ok).toBe(true);
    expect(r.equipement.armure).toBeNull();
    expect(r.inventaire.cases[2]).toEqual({ objet: 'armure-cuir', quantite: 1 });
  });

  it('va dans la première case libre si la case visée est occupée', () => {
    const inv = { cases: [{ objet: 'bois', quantite: 1 }, { objet: 'pierre', quantite: 1 }, null] };
    const r = retirerArmureVers(porte, inv, 1);
    expect(r.ok).toBe(true);
    expect(r.inventaire.cases[2]).toEqual({ objet: 'armure-cuir', quantite: 1 });
  });

  it('refuse sans armure portée ou sans place, et ne modifie rien', () => {
    expect(retirerArmureVers(creerEquipement(), creerConteneur(2), 0).ok).toBe(false);
    const plein = { cases: [{ objet: 'bois', quantite: 1 }] };
    const r = retirerArmureVers(porte, plein, 0);
    expect(r.ok).toBe(false);
    expect(r.equipement.armure).toBe('cuir');
    expect(plein.cases).toHaveLength(1);
  });
});
