import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerTerrainAvecMine } from '../monde/entreeMine';
import { ETAPES_HISTOIRE, objectifAffiche } from './histoire';
import { indiceVers, remplirIndices } from './indices';
import { QUETES } from './quetes';

describe('indices de direction : remplissage des textes', () => {
  it('remplit direction et distance pour chaque lieu, et laisse un lieu inconnu tel quel', () => {
    const indices = { camp: indiceVers(0, 300), ruines: indiceVers(-400, 0) };
    expect(remplirIndices('{direction:camp}, à environ {distance:camp} pas ; {direction:ruines}', indices)).toBe('au sud, à environ 300 pas ; à l’ouest');
    expect(remplirIndices('{direction:mine}', indices)).toBe('{direction:mine}');
  });

  it('avec la vraie position des lieux (graine du jeu), plus aucun trou ni « au sud » écrit en dur', () => {
    const m = creerTerrainAvecMine(CONFIG.graine);
    const A = CONFIG.habitants.aldric;
    const indices = {
      aldric: indiceVers(A.x, A.z),
      mine: indiceVers(m.entree.x, m.entree.z),
      camp: indiceVers(m.lieux.camp.x, m.lieux.camp.z),
      ruines: indiceVers(m.lieux.autel.x, m.lieux.autel.z),
    };
    const textes = [
      ...ETAPES_HISTOIRE.flatMap((e) => [e.objectif, ...(e.repliques ?? []).map((r) => r.texte)]),
      ...QUETES.map((q) => q.description),
    ].map((t) => remplirIndices(t, indices));
    for (const t of textes) expect(t).not.toMatch(/\{(direction|distance)/);
    expect(ETAPES_HISTOIRE.find((e) => e.id === 'trouver-aldric')!.objectif).not.toContain('au sud');
    expect(Object.values(indices).map((i) => i.distance).every((d) => d > 0)).toBe(true);
    expect(objectifAffiche({ etape: 13, compteur: 0, vus: [] }, (t) => remplirIndices(t, indices))).toContain('pas');
  });
});
