import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { IdBiome } from './biomes';
import { creerGenerateurDecor, estArbre, INFOS_DECOR, type ElementDecor } from './decor';
import { creerTerrain } from './terrain';

const TAILLE = CONFIG.monde.tailleChunk;
const terrain = creerTerrain(CONFIG.graine);
const decor = creerGenerateurDecor(terrain);

// Zone d'essai : 21 × 21 chunks autour du village (environ 1,3 km de côté)
const RAYON = 10;
const chunks: { cx: number; cz: number; elements: ElementDecor[] }[] = [];
for (let cz = -RAYON; cz <= RAYON; cz++) {
  for (let cx = -RAYON; cx <= RAYON; cx++) chunks.push({ cx, cz, elements: decor.chunk(cx, cz) });
}
const tous = chunks.flatMap((c) => c.elements);

describe('creerGenerateurDecor', () => {
  it('même graine = même décor ; graine différente = autre décor', () => {
    const autre = creerGenerateurDecor(creerTerrain(CONFIG.graine));
    expect(autre.chunk(3, -2)).toEqual(decor.chunk(3, -2));
    expect(decor.chunk(3, -2)).toEqual(decor.chunk(3, -2));
    const ailleurs = creerGenerateurDecor(creerTerrain(CONFIG.graine + 1));
    expect(ailleurs.chunk(3, -2)).not.toEqual(decor.chunk(3, -2));
  });

  it('chaque élément est dans son chunk, avec un identifiant unique et des valeurs valides', () => {
    const ids = new Set<string>();
    for (const c of chunks) {
      for (const e of c.elements) {
        expect(Math.floor(e.x / TAILLE)).toBe(c.cx);
        expect(Math.floor(e.z / TAILLE)).toBe(c.cz);
        expect(ids.has(e.id)).toBe(false);
        ids.add(e.id);
        const infos = INFOS_DECOR[e.type];
        expect(e.variante).toBeGreaterThanOrEqual(0);
        expect(e.variante).toBeLessThan(infos.variantes);
        expect(e.echelle).toBeGreaterThanOrEqual(infos.echelleMin);
        expect(e.echelle).toBeLessThanOrEqual(infos.echelleMax);
        expect(Number.isFinite(e.y)).toBe(true);
      }
    }
    expect(tous.length).toBeGreaterThan(1000);
  }, 30_000);

  it('aucun élément dans l\'eau', () => {
    for (const e of tous) {
      expect(terrain.hauteur(e.x, e.z)).toBeGreaterThanOrEqual(terrain.niveauEau + CONFIG.decor.margeEau);
    }
  });

  it('aucun élément dans le village', () => {
    const interdit = CONFIG.monde.village.rayon + CONFIG.decor.margeVillage;
    for (const e of tous) expect(Math.hypot(e.x, e.z)).toBeGreaterThanOrEqual(interdit);
  });

  it('arbres et plantes seulement sur des pentes praticables ; les rochers partout', () => {
    for (const e of tous) {
      if (INFOS_DECOR[e.type].toutesPentes) continue;
      expect(terrain.pente(e.x, e.z)).toBeLessThanOrEqual(CONFIG.decor.penteMax);
    }
  });

  it('les éléments solides ne se chevauchent pas', () => {
    for (const c of chunks) {
      const solides = c.elements.filter((e) => e.rayonCollision > 0);
      for (let a = 0; a < solides.length; a++) {
        for (let b = a + 1; b < solides.length; b++) {
          const d = Math.hypot(solides[a].x - solides[b].x, solides[a].z - solides[b].z);
          expect(d).toBeGreaterThan((solides[a].rayonCollision + solides[b].rayonCollision) * 0.8);
        }
      }
    }
  });

  it('densités cohérentes : forêt dense, prairie en bosquets, montagne rocheuse', () => {
    // Moyennes par chunk, selon le biome au centre du chunk
    const sommes: Record<IdBiome, { chunks: number; arbres: number; rochers: number; plantes: number }> = {
      prairie: { chunks: 0, arbres: 0, rochers: 0, plantes: 0 },
      foret: { chunks: 0, arbres: 0, rochers: 0, plantes: 0 },
      montagne: { chunks: 0, arbres: 0, rochers: 0, plantes: 0 },
      marais: { chunks: 0, arbres: 0, rochers: 0, plantes: 0 },
    };
    for (const c of chunks) {
      // Hors de la zone du village, vide par construction
      if (Math.hypot(c.cx + 0.5, c.cz + 0.5) * TAILLE < 150) continue;
      const s = sommes[terrain.biomeDominant((c.cx + 0.5) * TAILLE, (c.cz + 0.5) * TAILLE).id];
      s.chunks++;
      for (const e of c.elements) {
        if (estArbre(e.type)) s.arbres++;
        else if (e.type === 'rocher' || e.type === 'filon-fer') s.rochers++;
        else if (e.type === 'plante-medicinale' || e.type === 'fibres') s.plantes++;
      }
    }
    const moyenne = (id: IdBiome, quoi: 'arbres' | 'rochers' | 'plantes') => sommes[id][quoi] / sommes[id].chunks;
    for (const id of ['prairie', 'foret', 'montagne'] as const) expect(sommes[id].chunks).toBeGreaterThan(3);

    expect(moyenne('foret', 'arbres')).toBeGreaterThan(30);
    expect(moyenne('foret', 'arbres')).toBeGreaterThan(moyenne('prairie', 'arbres') * 2);
    expect(moyenne('prairie', 'arbres')).toBeGreaterThan(moyenne('montagne', 'arbres'));
    expect(moyenne('montagne', 'rochers')).toBeGreaterThan(moyenne('prairie', 'rochers') * 2);
    expect(moyenne('montagne', 'rochers')).toBeGreaterThan(moyenne('montagne', 'arbres'));
    if (sommes.marais.chunks > 0) {
      expect(moyenne('marais', 'plantes')).toBeGreaterThan(moyenne('prairie', 'plantes'));
      expect(moyenne('marais', 'arbres')).toBeLessThan(moyenne('foret', 'arbres'));
    }
  });
});
