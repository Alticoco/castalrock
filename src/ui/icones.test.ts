// Chaque objet, chaque recette et chaque outil par palier doit avoir une icône dans icones.ts.

import { describe, expect, it } from 'vitest';
import { NIVEAUX_OUTIL, OUTILS } from '../regles/equipement';
import { RECETTES } from '../regles/fabrication';
import { idsCatalogue } from '../regles/inventaire';
import { clesIcones, icone } from './icones';

const cles = new Set(clesIcones());

describe('icônes', () => {
  it('chaque objet du catalogue a une icône', () => {
    const manquants = idsCatalogue().filter((id) => !cles.has(id));
    expect(manquants).toEqual([]);
  });

  it('chaque recette a une icône', () => {
    const manquants = RECETTES.map((r) => r.icone).filter((id) => !cles.has(id));
    expect(manquants).toEqual([]);
  });

  it('chaque outil a une icône pour chaque palier', () => {
    const manquants: string[] = [];
    for (const outil of OUTILS) {
      for (const niveau of NIVEAUX_OUTIL) {
        const cle = niveau === 'base' ? outil : `${outil}-${niveau}`;
        if (!cles.has(cle)) manquants.push(cle);
      }
    }
    expect(manquants).toEqual([]);
  });

  it('les nouvelles icônes sont sans identifiant ni référence url(#)', () => {
    for (const id of ['gelee-slime', 'eclat-coeur']) {
      const svg = icone(id);
      expect(svg).not.toContain('url(#');
      expect(svg).not.toMatch(/\sid=/);
    }
  });
});
