import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerAleatoire } from '../regles/aleatoire';
import { creerGenerateurDecor } from './decor';
import { Chantier, tirerPiece, TYPES_PIECES, type Bloc } from './piecesRuines';
import { creerGenerateurRuines, type Site } from './ruines';
import { creerTerrain } from './terrain';

const R = CONFIG.ruines;
const TAILLE = CONFIG.monde.tailleChunk;
const terrain = creerTerrain(CONFIG.graine);
// Un lieu « déjà occupé » fictif, pour vérifier que rien n'est posé autour
const ZONE = { x: 420, z: -360, rayon: 15 };
const ruines = creerGenerateurRuines(terrain, [ZONE]);

// Zone d'essai : 28 × 28 chunks autour du village (environ 1,8 km de côté)
const RAYON = 14;
const NOMBRE_CHUNKS = (2 * RAYON) ** 2;
const parChunk: { cx: number; cz: number; sites: Site[] }[] = [];
for (let cz = -RAYON; cz < RAYON; cz++) {
  for (let cx = -RAYON; cx < RAYON; cx++) parChunk.push({ cx, cz, sites: ruines.sitesDuChunk(cx, cz) });
}
const tous = parChunk.flatMap((c) => c.sites);
const sitesRuines = tous.filter((s) => s.genre === 'ruine');
const grottes = tous.filter((s) => s.genre === 'grotte');

/** Blocs d'une pièce construite seule, sur un sol plat. */
function blocsDe(type: (typeof TYPES_PIECES)[number], graine: number): Bloc[] {
  const alea = creerAleatoire(graine);
  const chantier = new Chantier(alea, () => 0);
  tirerPiece(type, alea).construire(chantier, { x: 0, y: 0, z: 0, lacet: 0 });
  return chantier.blocs;
}

describe('creerGenerateurRuines', () => {
  it('même graine = mêmes ruines ; graine différente = autres ruines', () => {
    const autre = creerGenerateurRuines(creerTerrain(CONFIG.graine), [ZONE]);
    const avecSite = parChunk.find((c) => c.sites.length > 0)!;
    expect(autre.sitesDuChunk(avecSite.cx, avecSite.cz)).toEqual(avecSite.sites);
    expect(ruines.sitesDuChunk(avecSite.cx, avecSite.cz)).toEqual(avecSite.sites);
    const ailleurs = creerGenerateurRuines(creerTerrain(CONFIG.graine + 1), [ZONE]);
    const idsAilleurs: string[] = [];
    for (let cz = -6; cz < 6; cz++) for (let cx = -6; cx < 6; cx++) idsAilleurs.push(...ailleurs.sitesDuChunk(cx, cz).map((s) => `${s.id}@${s.x.toFixed(2)}`));
    const idsIci = parChunk.filter((c) => Math.abs(c.cx + 0.5) < 6 && Math.abs(c.cz + 0.5) < 6).flatMap((c) => c.sites.map((s) => `${s.id}@${s.x.toFixed(2)}`));
    expect(idsAilleurs).not.toEqual(idsIci);
  });

  it('des ruines de temps en temps, pas à chaque chunk, et quelques grottes', () => {
    // Entre une ruine pour 25 chunks et une pour 6 ; des grottes, mais moins que de ruines
    expect(sitesRuines.length).toBeGreaterThan(NOMBRE_CHUNKS / 25);
    expect(sitesRuines.length).toBeLessThan(NOMBRE_CHUNKS / 6);
    expect(grottes.length).toBeGreaterThan(5);
    expect(grottes.length).toBeLessThan(sitesRuines.length);
    expect(Math.max(...parChunk.map((c) => c.sites.length))).toBeLessThanOrEqual(2);
  });

  it('chaque site est dans son chunk, avec un identifiant unique, et tient dans son rayon', () => {
    const ids = new Set<string>();
    for (const c of parChunk) {
      for (const s of c.sites) {
        expect(ids.has(s.id)).toBe(false);
        ids.add(s.id);
        expect(Math.floor(s.x / TAILLE)).toBe(c.cx);
        expect(Math.floor(s.z / TAILLE)).toBe(c.cz);
        expect(s.blocs.length).toBeGreaterThan(0);
        expect(s.rayon).toBeLessThan(R.rayonSite + 1.5);
        for (const o of [...s.obstacles, ...s.emprises]) expect(Math.hypot(o.x - s.x, o.z - s.z) + o.rayon).toBeLessThanOrEqual(s.rayon + 1e-6);
        for (const b of s.blocs) {
          for (const v of [b.x, b.y, b.z, b.lx, b.ly, b.lz, b.rx, b.ry, b.rz, b.teinte]) expect(Number.isFinite(v)).toBe(true);
          expect(Math.min(b.lx, b.ly, b.lz)).toBeGreaterThan(0);
        }
      }
    }
  });

  it("aucun site dans le village, près d'un lieu occupé ou dans l'eau", () => {
    for (const s of tous) {
      expect(Math.hypot(s.x, s.z)).toBeGreaterThanOrEqual(R.distanceMinVillage);
      expect(Math.hypot(s.x - ZONE.x, s.z - ZONE.z)).toBeGreaterThanOrEqual(ZONE.rayon + R.margeLieux);
      expect(s.y).toBeGreaterThanOrEqual(terrain.niveauEau + R.margeEau);
      // (l'altitude d'une grotte est celle de son entrée, pas de son centre)
      if (s.genre === 'ruine') expect(s.y).toBeCloseTo(terrain.hauteur(s.x, s.z), 6);
    }
    // Sans la zone interdite, il y aurait bien eu quelque chose à cet endroit (le test ci-dessus n'est pas vide de sens)
    const libre = creerGenerateurRuines(terrain);
    expect(libre.sitesAutour(ZONE.x, ZONE.z, ZONE.rayon + R.margeLieux - 1).length).toBeGreaterThan(0);
  });

  it("aucun site autour de l'origine de la mine ni de la maison (zones intérieures)", () => {
    const libre = creerGenerateurRuines(terrain);
    for (const o of [CONFIG.mine.origine, CONFIG.maison.origine]) {
      expect(libre.sitesAutour(o.x, o.z, 150)).toEqual([]);
    }
  });

  it('jamais deux sites pareils : pièces, nombre de pièces et blocs varient', () => {
    const empreintes = new Set(sitesRuines.map((s) => JSON.stringify(s.blocs)));
    expect(empreintes.size).toBe(sitesRuines.length);
    // Même les sites faits des mêmes pièces diffèrent (morceaux manquants, tailles, rotations)
    const composition = new Map<string, Site[]>();
    for (const s of sitesRuines) composition.set(s.pieces.join('+'), [...(composition.get(s.pieces.join('+')) ?? []), s]);
    const jumeaux = [...composition.values()].find((l) => l.length >= 2)!;
    expect(jumeaux).toBeDefined();
    expect(jumeaux[0].blocs.length === jumeaux[1].blocs.length && JSON.stringify(jumeaux[0].blocs.map((b) => [b.lx, b.ry])) === JSON.stringify(jumeaux[1].blocs.map((b) => [b.lx, b.ry]))).toBe(false);
    // Toutes les pièces existent, et le nombre de pièces par site varie
    const vues = new Set(sitesRuines.flatMap((s) => s.pieces));
    for (const t of TYPES_PIECES) expect(vues.has(t)).toBe(true);
    expect(new Set(sitesRuines.map((s) => s.pieces.length)).size).toBeGreaterThanOrEqual(4);
    expect(Math.max(...sitesRuines.map((s) => s.pieces.length))).toBeLessThanOrEqual(R.poidsNombrePieces.length);
  });

  it('quelques sites ont un coffre, posé hors des murs', () => {
    const avec = tous.filter((s) => s.coffre);
    expect(avec.length).toBeGreaterThan(tous.length * 0.1);
    expect(avec.length).toBeLessThan(tous.length * 0.6);
    for (const s of avec) {
      const c = s.coffre!;
      expect(c.id).toBe(`co:${s.id}`);
      expect(c.y).toBeCloseTo(terrain.hauteur(c.x, c.z), 6);
      // Seule sa propre collision le touche
      const proches = s.obstacles.filter((o) => Math.hypot(o.x - c.x, o.z - c.z) < o.rayon + R.coffre.rayon);
      expect(proches).toHaveLength(1);
      expect(proches[0].rayon).toBe(R.coffre.rayon);
    }
  });

  it('les grottes sont adossées à une paroi et gardent des cristaux à récolter', () => {
    const G = R.grottes;
    for (const s of grottes) {
      expect(s.cristaux.length).toBeGreaterThanOrEqual(G.cristauxMin);
      expect(s.cristaux.length).toBeLessThanOrEqual(G.cristauxMax);
      s.cristaux.forEach((c, k) => {
        expect(c.type).toBe('cristal-bleu');
        expect(c.id).toBe(`gc:${s.id.slice(3)}:${k}`);
        expect(ruines.cristal(c.id)).toEqual(c);
        expect(Math.hypot(c.x - s.x, c.z - s.z)).toBeLessThan(s.rayon);
      });
      // Autour du site, le terrain monte d'au moins quelques mètres quelque part : la paroi
      let plusHaut = -Infinity;
      for (let k = 0; k < 16; k++) plusHaut = Math.max(plusHaut, terrain.hauteur(s.x + Math.cos((k * Math.PI) / 8) * 9, s.z + Math.sin((k * Math.PI) / 8) * 9));
      expect(plusHaut - s.y).toBeGreaterThan(G.hauteurParoiMin - 1.5);
    }
    expect(ruines.cristal('gc:999:999:0')).toBeNull();
    expect(ruines.cristal('d:1:2')).toBeNull();
  });

  it('collisions et emprises : là où il y a un site, nulle part ailleurs ; le décor ne pousse pas dessous', () => {
    const s = sitesRuines.find((x) => x.obstacles.length > 3)!;
    const o = s.obstacles[0];
    expect(ruines.obstaclesAutour(o.x, o.z, 0.1)).toContainEqual(o);
    expect(ruines.obstaclesAutour(s.x, s.z, s.rayon).length).toBe(s.obstacles.length);
    expect(ruines.dansEmprise(s.emprises[0].x, s.emprises[0].z)).toBe(true);
    // Sur la place du village : rien
    expect(ruines.obstaclesAutour(0, 0, 30)).toEqual([]);
    expect(ruines.dansEmprise(0, 0)).toBe(false);

    const decor = creerGenerateurDecor(terrain, [], ruines.dansEmprise);
    const sansRuines = creerGenerateurDecor(terrain);
    let retires = 0;
    for (const site of tous.slice(0, 12)) {
      const cx = Math.floor(site.x / TAILLE);
      const cz = Math.floor(site.z / TAILLE);
      const elements = decor.chunk(cx, cz);
      for (const e of elements) expect(ruines.dansEmprise(e.x, e.z)).toBe(false);
      retires += sansRuines.chunk(cx, cz).length - elements.length;
    }
    expect(retires).toBeGreaterThan(0);
  });
});

describe('pièces des ruines', () => {
  it('même tirage = même pièce ; autre tirage = autre pièce, pour chaque type', () => {
    for (const type of TYPES_PIECES) {
      expect(blocsDe(type, 7)).toEqual(blocsDe(type, 7));
      expect(blocsDe(type, 7)).not.toEqual(blocsDe(type, 8));
      expect(blocsDe(type, 7).length).toBeGreaterThan(3);
    }
  });

  it('les morceaux manquants changent le nombre de pierres d’un tirage à l’autre', () => {
    for (const type of TYPES_PIECES) {
      const tailles = new Set<number>();
      for (let g = 1; g <= 12; g++) tailles.add(blocsDe(type, g).filter((b) => b.forme === 'boite' || b.forme === 'fut').length);
      expect(tailles.size).toBeGreaterThanOrEqual(5);
    }
  });
});
