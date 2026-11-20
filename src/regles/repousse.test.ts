import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  aReapparaitre,
  creerPlante,
  delaiRepousse,
  echelleDuStade,
  essenceDuBiome,
  estAdulte,
  stadeDeCroissance,
  verifierPlantation,
  type ElementRetire,
  type TerrainPlantation,
} from './repousse';

const R = CONFIG.repousse;
const JOUR = CONFIG.temps.dureeJourSecondes;
const LOIN = { x: 500, z: 500 };

const retire = (type: ElementRetire['type'], instant = 0, x = 100, z = 100): ElementRetire => ({
  id: `d:${type}`,
  type,
  x,
  z,
  instant,
});

describe('délais de repousse', () => {
  it('rochers et filons : une journée de jeu ; buissons, plantes, fibres : une demi-journée', () => {
    expect(delaiRepousse('rocher')).toBe(JOUR);
    expect(delaiRepousse('filon-fer')).toBe(JOUR);
    expect(delaiRepousse('filon-cuivre')).toBe(JOUR);
    expect(delaiRepousse('filon-charbon')).toBe(JOUR);
    expect(delaiRepousse('buisson-baies')).toBe(JOUR / 2);
    expect(delaiRepousse('plante-medicinale')).toBe(JOUR / 2);
    expect(delaiRepousse('fibres')).toBe(JOUR / 2);
  });

  it('les arbres ne repoussent pas seuls', () => {
    expect(delaiRepousse('arbre-feuillu')).toBeNull();
    expect(delaiRepousse('sapin')).toBeNull();
    expect(delaiRepousse('bouleau')).toBeNull();
    expect(aReapparaitre([retire('sapin')], JOUR * 100, LOIN)).toEqual([]);
  });
});

describe('réapparition', () => {
  it('un rocher revient après une journée, pas avant', () => {
    const r = retire('rocher', 100);
    expect(aReapparaitre([r], 100 + JOUR - 1, LOIN)).toEqual([]);
    expect(aReapparaitre([r], 100 + JOUR, LOIN)).toEqual([r]);
  });

  it('un buisson cueilli retrouve ses baies après une demi-journée', () => {
    const b = retire('buisson-baies', 50);
    expect(aReapparaitre([b], 50 + JOUR / 2 - 1, LOIN)).toEqual([]);
    expect(aReapparaitre([b], 50 + JOUR / 2, LOIN)).toEqual([b]);
  });

  it('plantes et fibres : une demi-journée', () => {
    const liste = [retire('plante-medicinale'), retire('fibres')];
    expect(aReapparaitre(liste, JOUR / 2 - 1, LOIN)).toEqual([]);
    expect(aReapparaitre(liste, JOUR / 2, LOIN)).toHaveLength(2);
  });

  it('attend tant que le personnage est à moins de 25 m, puis réapparaît', () => {
    const r = retire('rocher', 0, 100, 0);
    expect(R.distanceMiniJoueur).toBe(25);
    expect(aReapparaitre([r], JOUR, { x: 100 - 24, z: 0 })).toEqual([]);
    expect(aReapparaitre([r], JOUR, { x: 100 - 25, z: 0 })).toEqual([]);
    expect(aReapparaitre([r], JOUR, { x: 100 - 26, z: 0 })).toEqual([r]);
  });

  it('ne renvoie que ce qui est prêt', () => {
    const pret = retire('fibres', 0);
    const pasPret = retire('rocher', 0);
    expect(aReapparaitre([pret, pasPret], JOUR / 2, LOIN)).toEqual([pret]);
  });
});

describe('croissance des pousses', () => {
  const plante = { instant: 1000 };

  it('trois stades de même durée sur une demi-journée', () => {
    expect(R.dureeCroissance).toBe(JOUR / 2);
    const tiers = R.dureeCroissance / 3;
    expect(stadeDeCroissance(plante, 1000)).toBe(0);
    expect(stadeDeCroissance(plante, 1000 + tiers - 1)).toBe(0);
    expect(stadeDeCroissance(plante, 1000 + tiers)).toBe(1);
    expect(stadeDeCroissance(plante, 1000 + 2 * tiers - 1)).toBe(1);
    expect(stadeDeCroissance(plante, 1000 + 2 * tiers)).toBe(2);
    expect(stadeDeCroissance(plante, 1000 + JOUR * 10)).toBe(2);
  });

  it('les échelles grandissent et seul le stade adulte est récoltable', () => {
    expect(echelleDuStade(0)).toBeLessThan(echelleDuStade(1));
    expect(echelleDuStade(1)).toBeLessThan(echelleDuStade(2));
    expect(echelleDuStade(2)).toBe(1);
    expect(estAdulte(0)).toBe(false);
    expect(estAdulte(1)).toBe(false);
    expect(estAdulte(2)).toBe(true);
  });
});

describe('essence plantée', () => {
  it('feuillu en prairie, sapin en montagne, mélange en forêt', () => {
    expect(essenceDuBiome('prairie', 0.9)).toBe('arbre-feuillu');
    expect(essenceDuBiome('montagne', 0.1)).toBe('sapin');
    const foret = new Set([0.1, 0.5, 0.95].map((t) => essenceDuBiome('foret', t)));
    expect(foret).toEqual(new Set(['arbre-feuillu', 'sapin', 'bouleau']));
  });

  it('creerPlante est reproductible et cohérente avec le biome', () => {
    const a = creerPlante(3, 10, 20, 'montagne', 77, 123);
    expect(creerPlante(3, 10, 20, 'montagne', 77, 123)).toEqual(a);
    expect(a.id).toBe('p:3');
    expect(a.type).toBe('sapin');
    expect(a.instant).toBe(77);
    expect(creerPlante(4, 10, 20, 'prairie', 0, 123).type).toBe('arbre-feuillu');
  });
});

describe('plantation', () => {
  const sol = (hauteur = 10, pente = 0.1): TerrainPlantation => ({
    hauteur: () => hauteur,
    pente: () => pente,
    niveauEau: 0,
  });
  const joueur = { x: 100, z: 100 };
  const essayer = (terrain = sol(), voisins: Array<{ x: number; z: number; rayon: number }> = [], x = 101, z = 100) =>
    verifierPlantation(x, z, terrain, voisins, joueur);

  it('accepte un sol libre à portée', () => {
    expect(essayer()).toEqual({ ok: true });
  });

  it('refuse hors de portée', () => {
    expect(essayer(sol(), [], 100 + R.porteePlantation + 0.5, 100)).toEqual({ ok: false, raison: 'loin' });
  });

  it('refuse dans l\'eau, y compris sur la berge', () => {
    expect(essayer(sol(-2))).toEqual({ ok: false, raison: 'eau' });
    expect(essayer(sol(0.1))).toEqual({ ok: false, raison: 'eau' });
  });

  it('refuse une pente trop raide', () => {
    expect(essayer(sol(10, CONFIG.decor.penteMax + 0.1))).toEqual({ ok: false, raison: 'pente' });
  });

  it('refuse trop près d\'un arbre, d\'un rocher ou d\'un obstacle', () => {
    expect(essayer(sol(), [{ x: 102, z: 100, rayon: 0.5 }])).toEqual({ ok: false, raison: 'voisin' });
    // Un gros rocher bloque de plus loin qu'un petit
    expect(essayer(sol(), [{ x: 104, z: 100, rayon: 0.5 }])).toEqual({ ok: true });
    expect(essayer(sol(), [{ x: 104, z: 100, rayon: 2.5 }])).toEqual({ ok: false, raison: 'voisin' });
  });

  it('refuse dans le cercle du village', () => {
    const j = { x: 10, z: 0 };
    expect(verifierPlantation(12, 0, sol(), [], j)).toEqual({ ok: false, raison: 'village' });
    const limite = CONFIG.monde.village.rayon + CONFIG.decor.margeVillage;
    const j2 = { x: limite + 1, z: 0 };
    expect(verifierPlantation(limite + 1, 0, sol(), [], j2)).toEqual({ ok: true });
  });
});
