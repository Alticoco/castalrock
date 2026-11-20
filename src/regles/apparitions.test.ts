import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { IdBiome } from '../monde/biomes';
import {
  choisirApparitions,
  chunksAutour,
  oublierMorts,
  peutReapparaitre,
  pointsDuChunk,
  type MondeApparition,
  type PointApparition,
} from './apparitions';

const A = CONFIG.apparitions;
const T = CONFIG.monde.tailleChunk;

function monde(biome: IdBiome, extra: Partial<MondeApparition> = {}): MondeApparition {
  return { biome: () => biome, hauteur: () => 10, niveauEau: 0, ...extra };
}

/** Tous les points d'un carré de chunks. */
function pointsDeLaZone(m: MondeApparition, rayon = 12, graine = 1): PointApparition[] {
  const tous: PointApparition[] = [];
  for (let cx = -rayon; cx < rayon; cx++) {
    for (let cz = -rayon; cz < rayon; cz++) tous.push(...pointsDuChunk(graine, cx, cz, m));
  }
  return tous;
}

describe('zones sans ennemi (camp, autel)', () => {
  it("aucun point d'apparition dans une zone interdite, mais ailleurs oui", () => {
    const zone = { x: 100, z: 100, rayon: 60 };
    const libre = pointsDeLaZone(monde('foret'));
    expect(libre.some((p) => Math.hypot(p.x - zone.x, p.z - zone.z) <= zone.rayon)).toBe(true);
    const ferme = pointsDeLaZone(monde('foret', { zonesSansEnnemi: [zone] }));
    expect(ferme.length).toBeGreaterThan(0);
    expect(ferme.some((p) => Math.hypot(p.x - zone.x, p.z - zone.z) <= zone.rayon)).toBe(false);
  });
});

function point(id: string, x: number, z: number, nuitSeulement = false): PointApparition {
  return { id, type: 'slime', x, z, nuitSeulement };
}

describe('points d\'apparition', () => {
  it('sont déterministes, dans leur chunk, et changent avec la graine', () => {
    const m = monde('foret');
    const a = pointsDuChunk(7, 3, -2, m);
    expect(pointsDuChunk(7, 3, -2, m)).toEqual(a);
    for (const p of pointsDeLaZone(m, 4)) {
      const [, cx, cz] = p.id.split(':').map(Number);
      expect(Math.floor(p.x / T)).toBe(cx);
      expect(Math.floor(p.z / T)).toBe(cz);
    }
    expect(pointsDeLaZone(m, 4, 1)).not.toEqual(pointsDeLaZone(m, 4, 2));
    const ids = pointsDeLaZone(m, 4).map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('respectent les types de chaque biome', () => {
    const types = (b: IdBiome) => new Set(pointsDeLaZone(monde(b)).map((p) => p.type));
    expect(types('prairie')).toEqual(new Set(['slime', 'bandit']));
    expect([...types('marais')]).toEqual(['slime']);
    expect(types('montagne')).toEqual(new Set(['gobelin', 'loup']));
    expect(types('foret')).toEqual(new Set(['slime', 'gobelin', 'loup', 'bandit']));
  });

  it('suivent à peu près la densité du biome', () => {
    const chunks = 24 * 24;
    const points = pointsDeLaZone(monde('marais'));
    const attendu = chunks * A.candidatsParChunk * A.chances.marais.slime;
    expect(points.length).toBeGreaterThan(attendu * 0.8);
    expect(points.length).toBeLessThan(attendu * 1.2);
  });

  it('gobelins plus nombreux la nuit, slimes inchangés', () => {
    const points = pointsDeLaZone(monde('foret'));
    const gobelinsJour = points.filter((p) => p.type === 'gobelin' && !p.nuitSeulement).length;
    const gobelinsNuit = points.filter((p) => p.type === 'gobelin').length;
    expect(gobelinsNuit).toBeGreaterThan(gobelinsJour * 1.5);
    expect(points.some((p) => p.type === 'slime' && p.nuitSeulement)).toBe(false);
  });

  it('loups plus nombreux la nuit, bandits rares de jour et plus nombreux la nuit', () => {
    const points = pointsDeLaZone(monde('foret'));
    const loupsJour = points.filter((p) => p.type === 'loup' && !p.nuitSeulement).length;
    const loupsNuit = points.filter((p) => p.type === 'loup').length;
    expect(loupsJour).toBeGreaterThan(0);
    expect(loupsNuit).toBeGreaterThan(loupsJour * 1.5);
    const bandits = points.filter((p) => p.type === 'bandit');
    const banditsJour = bandits.filter((p) => !p.nuitSeulement).length;
    expect(banditsJour).toBeGreaterThan(0);
    expect(banditsJour).toBeLessThan(loupsJour);
    expect(bandits.length).toBeGreaterThan(banditsJour * 1.5);
  });

  it('bandits jamais près du village, les autres types si', () => {
    const points = pointsDeLaZone(monde('foret'));
    const mini = A.distanceMiniVillage.bandit;
    expect(mini).toBeGreaterThan(CONFIG.monde.village.rayon + A.margeVillage);
    for (const p of points) {
      if (p.type === 'bandit') expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(mini);
    }
    expect(points.some((p) => p.type !== 'bandit' && Math.hypot(p.x, p.z) < mini)).toBe(true);
    expect(points.some((p) => p.type === 'bandit')).toBe(true);
  });

  it('jamais dans le village, dans l\'eau ni sur une pente raide', () => {
    const points = pointsDeLaZone(monde('foret'), 3);
    expect(points.length).toBeGreaterThan(0);
    for (const p of points) {
      expect(Math.hypot(p.x, p.z)).toBeGreaterThanOrEqual(CONFIG.monde.village.rayon + A.margeVillage);
    }
    expect(pointsDeLaZone(monde('foret', { hauteur: () => -1 }), 3)).toEqual([]);
    expect(pointsDeLaZone(monde('foret', { pente: () => 0.9 }), 3)).toEqual([]);
    const moitie = pointsDeLaZone(monde('foret', { hauteur: (x) => (x > 0 ? 10 : -2) }), 3);
    expect(moitie.length).toBeGreaterThan(0);
    expect(moitie.every((p) => p.x > 0)).toBe(true);
  });

  it('liste les chunks autour d\'un point', () => {
    const liste = chunksAutour(10, 10, 100);
    expect(liste).toContainEqual({ cx: 0, cz: 0 });
    expect(liste).toContainEqual({ cx: -2, cz: 1 });
    expect(liste).toHaveLength(16);
  });
});

describe('choix des apparitions', () => {
  const base = { actifs: new Set<string>(), morts: {}, joueur: { x: 0, z: 0 }, temps: 1000, nuit: false };

  it('jamais à moins de 40 m du joueur ni au-delà de la distance d\'activation', () => {
    const points = [point('pres', 0, 39), point('bon', 0, 41), point('loin', 0, A.distanceActivation + 1)];
    expect(choisirApparitions({ ...base, points }).map((p) => p.id)).toEqual(['bon']);
  });

  it('ignore les points déjà occupés et ceux de nuit en plein jour', () => {
    const points = [point('a', 0, 50), point('b', 0, 60), point('n', 0, 70, true)];
    const actifs = new Set(['a']);
    expect(choisirApparitions({ ...base, points, actifs }).map((p) => p.id)).toEqual(['b']);
    expect(choisirApparitions({ ...base, points, actifs, nuit: true }).map((p) => p.id)).toEqual(['b', 'n']);
  });

  it('attend une demi-journée de jeu après la mort', () => {
    const points = [point('a', 0, 50)];
    const morts = { a: 1000 };
    expect(peutReapparaitre(undefined, 0)).toBe(true);
    expect(A.delaiReapparition).toBe(CONFIG.temps.dureeJourSecondes / 2);
    expect(choisirApparitions({ ...base, points, morts, temps: 1000 + A.delaiReapparition - 1 })).toEqual([]);
    expect(choisirApparitions({ ...base, points, morts, temps: 1000 + A.delaiReapparition })).toHaveLength(1);
    expect(oublierMorts({ a: 1000, b: 1500 }, 1000 + A.delaiReapparition)).toEqual({ b: 1500 });
  });

  it('ne dépasse pas la limite d\'ennemis présents, les plus proches d\'abord', () => {
    const points = Array.from({ length: 30 }, (_, i) => point(`p${i}`, 0, 100 - i));
    const tout = choisirApparitions({ ...base, points });
    expect(tout).toHaveLength(A.limiteActifs);
    expect(tout[0].id).toBe('p29');
    const actifs = new Set(Array.from({ length: A.limiteActifs - 2 }, (_, i) => `x${i}`));
    expect(choisirApparitions({ ...base, points, actifs })).toHaveLength(2);
    const plein = new Set(Array.from({ length: A.limiteActifs }, (_, i) => `x${i}`));
    expect(choisirApparitions({ ...base, points, actifs: plein })).toEqual([]);
  });
});
