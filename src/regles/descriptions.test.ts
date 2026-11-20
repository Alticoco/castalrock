import { describe, expect, it } from 'vitest';
import { DESCRIPTION_PAR_DEFAUT, classementObjet, dansOnglet, descriptionObjet } from './descriptions';
import { ORDRE_RESSOURCES } from './recolte';

describe('descriptions', () => {
  it('décrit chaque ressource et donne une phrase par défaut aux objets inconnus', () => {
    for (const r of ORDRE_RESSOURCES) expect(descriptionObjet(r)).not.toBe(DESCRIPTION_PAR_DEFAUT);
    expect(descriptionObjet('objet-inconnu')).toBe(DESCRIPTION_PAR_DEFAUT);
  });

  it('classe les objets par onglet', () => {
    expect(classementObjet('baies')).toBe('nourriture');
    expect(classementObjet('potion-soin')).toBe('nourriture');
    expect(classementObjet('bois')).toBe('ressources');
    expect(classementObjet('armure-cuir')).toBe('objets');
    expect(classementObjet('inconnu')).toBe('objets');
  });

  it("l'onglet Tout contient tout, les autres seulement leur classement", () => {
    expect(dansOnglet('bois', 'tout')).toBe(true);
    expect(dansOnglet('bois', 'ressources')).toBe(true);
    expect(dansOnglet('bois', 'nourriture')).toBe(false);
  });
});
