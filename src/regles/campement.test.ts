import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  estNuitDeRepos,
  pointReapparitionAuberge,
  pointReapparitionFeu,
  poserFeuCamp,
  positionDevant,
  seReposer,
  verifierPoseFeu,
} from './campement';
import { heureDuJeu } from './temps';
import { obstaclesVillage } from './village';
import type { TerrainPlantation } from './repousse';

const JOUR = CONFIG.temps.dureeJourSecondes;
/** Temps de jeu pour lequel l'heure du jeu vaut `heure`. */
const tempsA = (heure: number) => ((((heure - CONFIG.temps.heureDepart) % 24) + 24) % 24) * (JOUR / 24);

const plat: TerrainPlantation = { hauteur: () => 10, pente: () => 0, niveauEau: 0 };

describe('pose du feu', () => {
  it('se place devant le personnage', () => {
    const p = positionDevant(10, 20, 0, 2);
    expect(p.x).toBeCloseTo(10);
    expect(p.z).toBeCloseTo(22);
    const q = positionDevant(0, 0, Math.PI / 2, 2);
    expect(q.x).toBeCloseTo(2);
    expect(q.z).toBeCloseTo(0, 5);
  });

  it('accepte un sol plat hors du village', () => {
    expect(verifierPoseFeu(100, 100, plat, [])).toEqual({ ok: true });
  });

  it("refuse l'eau, la pente raide, le village et un arbre trop proche", () => {
    expect(verifierPoseFeu(100, 100, { ...plat, hauteur: (): number => 0 }, [])).toEqual({ ok: false, raison: 'eau' });
    expect(verifierPoseFeu(100, 100, { ...plat, pente: () => 1 }, [])).toEqual({ ok: false, raison: 'pente' });
    expect(verifierPoseFeu(5, 5, plat, [])).toEqual({ ok: false, raison: 'village' });
    expect(verifierPoseFeu(100, 100, plat, [{ x: 101, z: 100, rayon: 0.5 }])).toEqual({ ok: false, raison: 'voisin' });
    // Assez loin du bord de l'arbre : accepté
    const loin = CONFIG.campement.distanceMiniVoisinFeu + 0.5 + 0.1;
    expect(verifierPoseFeu(100, 100, plat, [{ x: 100 + loin, z: 100, rayon: 0.5 }])).toEqual({ ok: true });
  });

  it("un nouveau feu éteint l'ancien", () => {
    const premier = poserFeuCamp(null, 1, 2);
    expect(premier).toEqual({ feu: { x: 1, z: 2 }, eteint: null });
    const second = poserFeuCamp(premier.feu, 30, 40);
    expect(second.feu).toEqual({ x: 30, z: 40 });
    expect(second.eteint).toEqual({ x: 1, z: 2 });
  });

  it('le lieu de réapparition est à côté du feu, nommé « Feu de camp »', () => {
    const p = pointReapparitionFeu({ x: 50, z: 60 });
    expect(p.nom).toBe('Feu de camp');
    expect(p.x).toBe(50);
    expect(p.z).toBeCloseTo(60 + CONFIG.campement.decalageReapparitionFeu);
  });
});

describe('auberge', () => {
  it("n'existe pas au niveau 1, et donne un point de réapparition dès le niveau 2", () => {
    expect(pointReapparitionAuberge(1)).toBeNull();
    for (const n of [2, 3] as const) {
      const p = pointReapparitionAuberge(n)!;
      expect(p.nom).toBe('Auberge');
      // Le point n'est dans aucun obstacle du village
      const o = obstaclesVillage(n);
      for (const c of o.cercles) expect(Math.hypot(c.x - p.x, c.z - p.z)).toBeGreaterThan(c.rayon + 0.35);
    }
  });
});

describe('repos', () => {
  it('reconnaît la nuit de repos (après 20 h ou avant 6 h)', () => {
    expect(estNuitDeRepos(20)).toBe(true);
    expect(estNuitDeRepos(23.5)).toBe(true);
    expect(estNuitDeRepos(0)).toBe(true);
    expect(estNuitDeRepos(5.9)).toBe(true);
    expect(estNuitDeRepos(6)).toBe(false);
    expect(estNuitDeRepos(12)).toBe(false);
    expect(estNuitDeRepos(19.9)).toBe(false);
  });

  it('de jour : la vie revient au maximum, le temps ne bouge pas', () => {
    const t = tempsA(12);
    expect(seReposer(100, t)).toEqual({ vie: 100, tempsJeu: t, nuitPassee: false });
  });

  it('de nuit : la vie revient au maximum et le temps saute jusqu\'à 7 h', () => {
    for (const h of [20, 22.5, 23.99, 0, 3, 5.5]) {
      const t = tempsA(h);
      const r = seReposer(120, t);
      expect(r.vie).toBe(120);
      expect(r.nuitPassee).toBe(true);
      expect(r.tempsJeu).toBeGreaterThan(t);
      expect(heureDuJeu(r.tempsJeu, CONFIG.temps)).toBeCloseTo(CONFIG.campement.heureReveil, 5);
    }
  });

  it('ne fait jamais reculer le temps', () => {
    for (let h = 0; h < 24; h += 0.5) {
      const t = tempsA(h) + JOUR * 3;
      expect(seReposer(100, t).tempsJeu).toBeGreaterThanOrEqual(t);
    }
  });
});
