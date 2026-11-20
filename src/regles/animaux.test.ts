import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import type { IdBiome } from '../monde/biomes';
import { INFOS_ANIMAUX, distanceDeFuite, estAnimal, estMenacant, pasAnimal } from './animaux';
import { choisirApparitions, estPointAnimal, pointsAnimauxDuChunk, pointsDuChunk, type MondeApparition, type PointApparition } from './apparitions';
import { resoudreParade } from './bouclier';
import { TYPES_ANIMAL, creerEnnemi, etourdirEnnemi, frapperEnnemi, tirerButinEnnemi, type ContexteEnnemi, type EtatEnnemi, type TypeAnimal } from './combat';
import { definitionObjet } from './inventaire';
import { accepter, chercherQuete, creerEtatQuetes, evenement } from './quetes';

const DT = 1 / 60;

function contexte(x: number, z: number, extra: Partial<ContexteEnnemi['joueur']> = {}): ContexteEnnemi {
  return {
    joueur: { x, z, vivant: true, ...extra },
    monde: { hauteur: () => 0, niveauEau: -10, obstacles: [] },
    rayonVillage: 0,
  };
}

/** Animal placé loin de l'origine (hors village), au repos. */
function animal(type: TypeAnimal, id = 'a:test'): EtatEnnemi {
  return creerEnnemi(id, type, 500, 500);
}

function vivre(etat: EtatEnnemi, ctx: ContexteEnnemi, secondes: number): { etat: EtatEnnemi; degats: number[] } {
  let e = etat;
  const degats: number[] = [];
  for (let t = 0; t < secondes; t += DT) {
    const r = pasAnimal(e, ctx, DT);
    e = r.etat;
    if (r.degats > 0) degats.push(r.degats);
  }
  return { etat: e, degats };
}

const distance = (e: EtatEnnemi, ctx: ContexteEnnemi) => Math.hypot(e.x - ctx.joueur.x, e.z - ctx.joueur.z);

describe('animaux : valeurs', () => {
  it('les quatre animaux ont les points de vie demandés', () => {
    expect(TYPES_ANIMAL.map((t) => INFOS_ANIMAUX[t].pv)).toEqual([40, 8, 20, 60]);
    expect(estAnimal('cerf')).toBe(true);
    expect(estAnimal('loup')).toBe(false);
  });

  it('le butin reste dans les bornes demandées', () => {
    const vu = { cuirLapin: 0, total: 300 };
    for (let i = 0; i < vu.total; i++) {
      const cerf = tirerButinEnnemi('cerf', `c${i}`);
      expect(cerf['viande-crue']).toBeGreaterThanOrEqual(2);
      expect(cerf['viande-crue']).toBeLessThanOrEqual(3);
      expect(cerf.cuir).toBeGreaterThanOrEqual(1);
      expect(cerf.cuir).toBeLessThanOrEqual(2);
      const lapin = tirerButinEnnemi('lapin', `l${i}`);
      expect(lapin['viande-crue']).toBe(1);
      if (lapin.cuir) vu.cuirLapin++;
      expect(tirerButinEnnemi('renard', `r${i}`)).toEqual({ 'fourrure-renard': 1, 'viande-crue': 1 });
      const sanglier = tirerButinEnnemi('sanglier', `s${i}`);
      expect(sanglier['viande-crue']).toBeGreaterThanOrEqual(2);
      expect(sanglier['viande-crue']).toBeLessThanOrEqual(4);
      expect(sanglier.cuir).toBe(2);
    }
    // Chance de 0,3 pour le cuir du lapin
    expect(vu.cuirLapin / vu.total).toBeGreaterThan(0.2);
    expect(vu.cuirLapin / vu.total).toBeLessThan(0.4);
  });

  it('les nouveaux objets existent', () => {
    expect(definitionObjet('viande-crue').nom).toBe('viande crue');
    expect(definitionObjet('fourrure-renard').nom).toBe('fourrure de renard');
  });
});

describe('animaux : fuite', () => {
  it('distances de fuite : 15 m pour le cerf, 8 m pour le lapin, 12 m pour le renard', () => {
    expect(distanceDeFuite('cerf')).toBe(15);
    expect(distanceDeFuite('lapin')).toBe(8);
    expect(distanceDeFuite('renard')).toBe(12);
  });

  it('le cerf ne bouge pas tant que le joueur est à plus de 15 m', () => {
    const ctx = contexte(500, 517);
    const r = vivre(animal('cerf'), ctx, 0.5);
    expect(r.etat.phase).not.toBe('fuite');
  });

  it("le cerf s'enfuit quand le joueur est à moins de 15 m, plus vite que le joueur ne court", () => {
    const ctx = contexte(500, 514);
    const depart = animal('cerf');
    const r = vivre(depart, ctx, 1);
    expect(r.etat.phase).toBe('fuite');
    const parcouru = distance(r.etat, ctx) - distance(depart, ctx);
    expect(parcouru).toBeGreaterThan(CONFIG.personnage.vitesseCourse);
    expect(r.degats).toEqual([]);
  });

  it('un joueur lent approche de plus près', () => {
    expect(distanceDeFuite('cerf', 0)).toBeLessThan(distanceDeFuite('cerf', CONFIG.personnage.vitesseCourse));
    const lent = contexte(500, 512, { vitesse: 0 });
    expect(vivre(animal('cerf'), lent, 0.5).etat.phase).not.toBe('fuite');
    const tresPres = contexte(500, 508, { vitesse: 0 });
    expect(vivre(animal('cerf'), tresPres, 0.5).etat.phase).toBe('fuite');
  });

  it("la fuite s'arrête quand le joueur est assez loin, et l'animal s'installe sur place", () => {
    const ctx = contexte(500, 510);
    const r = vivre(animal('cerf'), ctx, 6);
    expect(r.etat.phase === 'repos' || r.etat.phase === 'errance').toBe(true);
    expect(distance(r.etat, ctx)).toBeGreaterThanOrEqual(INFOS_ANIMAUX.cerf.distanceCalme - 0.5);
    expect(Math.hypot(r.etat.origineX - 500, r.etat.origineZ - 500)).toBeGreaterThan(15);
  });

  it('frappé de loin (boule de feu), un animal craintif fuit', () => {
    const ctx = contexte(500, 525);
    const coup = frapperEnnemi(animal('renard'), 5, 500, 525);
    expect(coup.mort).toBe(false);
    const r = vivre(coup.etat, ctx, 0.5);
    expect(r.etat.phase).toBe('fuite');
  });

  it('le lapin fuit par bonds en zigzag, des deux côtés', () => {
    const ctx = contexte(500, 506);
    let e = animal('lapin');
    const ecarts = new Set<number>();
    let immobile = 0;
    for (let i = 0; i < 90; i++) {
      const avant = e;
      e = pasAnimal(e, ctx, DT).etat;
      if (e.phase === 'fuite') ecarts.add(Math.sign(e.ecart));
      if (e.x === avant.x && e.z === avant.z) immobile++;
    }
    expect(e.phase).toBe('fuite');
    expect(ecarts.has(1) && ecarts.has(-1)).toBe(true);
    // Entre deux bonds, il touche le sol un instant
    expect(immobile).toBeGreaterThan(0);
    expect(distance(e, ctx)).toBeGreaterThan(12);
  });

  it('un animal craintif mort ne bouge plus', () => {
    const coup = frapperEnnemi(animal('lapin'), 50, 500, 501);
    expect(coup.mort).toBe(true);
    const r = vivre(coup.etat, contexte(500, 501), 0.5);
    expect(r.etat.phase).toBe('mort');
    expect(r.etat.x).toBe(coup.etat.x);
  });
});

describe('animaux : sanglier', () => {
  it('ignore le joueur tant qu’on ne le frappe pas', () => {
    const ctx = contexte(500, 501.5);
    const r = vivre(animal('sanglier'), ctx, 12);
    expect(['repos', 'errance']).toContain(r.etat.phase);
    expect(r.degats).toEqual([]);
    expect(estMenacant(r.etat)).toBe(false);
  });

  it('frappé, il prend son élan puis charge et blesse une seule fois par charge', () => {
    const ctx = contexte(500, 504);
    let e = frapperEnnemi(animal('sanglier'), 10, 500, 504).etat;
    expect(estMenacant(e)).toBe(true);
    const phases = new Set<string>();
    const degats: number[] = [];
    // Jusqu'à la fin de la première charge
    let charge = false;
    for (let i = 0; i < 600; i++) {
      const r = pasAnimal(e, ctx, DT);
      if (r.degats > 0) degats.push(r.degats);
      phases.add(r.etat.phase);
      if (r.etat.phase === 'attaque') charge = true;
      if (charge && r.etat.phase !== 'attaque') {
        e = r.etat;
        break;
      }
      e = r.etat;
    }
    expect(phases.has('anticipation')).toBe(true);
    expect(charge).toBe(true);
    expect(degats).toEqual([INFOS_ANIMAUX.sanglier.degats]);
    expect(INFOS_ANIMAUX.sanglier.degats).toBeGreaterThan(CONFIG.ennemis.bandit.degats);
    // Il a dépassé le joueur en courant
    expect(e.z).toBeGreaterThan(504);
  });

  it("la charge va tout droit : un joueur qui s'écarte dès qu'elle part n'est pas touché", () => {
    const ctx = contexte(500, 505);
    let e = frapperEnnemi(animal('sanglier'), 10, 500, 505).etat;
    const degats: number[] = [];
    let vuCharge = false;
    for (let i = 0; i < 600; i++) {
      const r = pasAnimal(e, ctx, DT);
      e = r.etat;
      if (r.degats > 0) degats.push(r.degats);
      if (e.phase === 'attaque') {
        // La direction est prise à la fin de l'élan : un pas de côté de 4 m suffit
        vuCharge = true;
        ctx.joueur.x = 504;
      }
      else if (vuCharge) break;
    }
    expect(vuCharge).toBe(true);
    expect(degats).toEqual([]);
  });

  it('sa charge se pare : il fait partie des attaquants parables, et la parade réussie l’étourdit', () => {
    const parade = resoudreParade({
      brut: INFOS_ANIMAUX.sanglier.degats,
      garde: { leve: true, depuis: 0.1, riposte: 0 },
      deFace: true,
      bouclier: 'bois',
      solide: false,
      attaquant: 'sanglier',
    });
    expect(parade.reussie).toBe(true);
    expect(parade.brut).toBeLessThan(INFOS_ANIMAUX.sanglier.degats);
    const ctx = contexte(500, 503);
    const etourdi = etourdirEnnemi(frapperEnnemi(animal('sanglier'), 10, 500, 503).etat);
    expect(estMenacant(etourdi)).toBe(true);
    const r = vivre(etourdi, ctx, CONFIG.bouclier.dureeEtourdissement * 0.8);
    expect(r.etat.phase).toBe('etourdi');
    expect(r.degats).toEqual([]);
  });

  it('redevient neutre quand le joueur est à plus de 25 m', () => {
    const ctx = contexte(500, 504);
    let e = frapperEnnemi(animal('sanglier'), 10, 500, 504).etat;
    e = vivre(e, ctx, 0.6).etat;
    expect(estMenacant(e)).toBe(true);
    ctx.joueur.z = 540;
    e = vivre(e, ctx, 3).etat;
    expect(estMenacant(e)).toBe(false);
    // Le joueur revient tout près : il l'ignore de nouveau
    ctx.joueur.x = e.x;
    ctx.joueur.z = e.z + 2;
    const r = vivre(e, ctx, 10);
    expect(estMenacant(r.etat)).toBe(false);
    expect(r.degats).toEqual([]);
  });

  it('les animaux craintifs ne sont jamais une menace', () => {
    const ctx = contexte(500, 503);
    for (const type of ['cerf', 'lapin', 'renard'] as const) {
      const r = vivre(frapperEnnemi(animal(type), 1, 500, 503).etat, ctx, 1);
      expect(estMenacant(r.etat)).toBe(false);
      expect(r.degats).toEqual([]);
    }
  });
});

describe('animaux : apparitions', () => {
  const monde = (biome: IdBiome, extra: Partial<MondeApparition> = {}): MondeApparition => ({
    biome: () => biome,
    hauteur: () => 10,
    niveauEau: 0,
    ...extra,
  });
  const zone = (m: MondeApparition, rayon = 12): PointApparition[] => {
    const tous: PointApparition[] = [];
    for (let cx = -rayon; cx < rayon; cx++) for (let cz = -rayon; cz < rayon; cz++) tous.push(...pointsAnimauxDuChunk(1, cx, cz, m));
    return tous;
  };
  const types = (points: PointApparition[]) => new Set(points.map((p) => p.type));

  it('toujours les mêmes points pour une même graine, sans toucher à ceux des ennemis', () => {
    const m = monde('foret');
    expect(pointsAnimauxDuChunk(7, 3, -2, m)).toEqual(pointsAnimauxDuChunk(7, 3, -2, m));
    const points = zone(m);
    expect(points.every((p) => estPointAnimal(p.id))).toBe(true);
    expect(pointsDuChunk(7, 3, -2, m).some((p) => estPointAnimal(p.id))).toBe(false);
    expect(new Set(points.map((p) => p.id)).size).toBe(points.length);
  });

  it('par biome : cerfs et lapins en prairie ; cerfs, renards et sangliers en forêt ; rien ailleurs', () => {
    expect(types(zone(monde('prairie')))).toEqual(new Set(['cerf', 'lapin']));
    expect(types(zone(monde('foret')))).toEqual(new Set(['cerf', 'renard', 'sanglier']));
    expect(zone(monde('montagne'))).toEqual([]);
    expect(zone(monde('marais'))).toEqual([]);
  });

  it('les cerfs vont par groupes de 1 à 3, serrés', () => {
    const cerfs = zone(monde('prairie')).filter((p) => p.type === 'cerf');
    const groupes = new Map<string, PointApparition[]>();
    for (const p of cerfs) {
      const chef = p.id.split(':').slice(0, 4).join(':');
      groupes.set(chef, [...(groupes.get(chef) ?? []), p]);
    }
    const tailles = new Set([...groupes.values()].map((g) => g.length));
    expect(tailles).toEqual(new Set([1, 2, 3]));
    for (const g of groupes.values()) {
      for (const p of g) expect(Math.hypot(p.x - g[0].x, p.z - g[0].z)).toBeLessThanOrEqual(CONFIG.apparitions.animaux.rayonGroupe);
    }
  });

  it('le renard est rare, et plus présent la nuit', () => {
    const points = zone(monde('foret'));
    const renards = points.filter((p) => p.type === 'renard');
    const deJour = renards.filter((p) => !p.nuitSeulement).length;
    expect(renards.length).toBeGreaterThan(deJour * 2);
    expect(deJour).toBeLessThan(points.filter((p) => p.type === 'cerf').length);
  });

  it("aucun animal dans l'eau ni près du village", () => {
    expect(zone(monde('prairie', { hauteur: () => -1 }))).toEqual([]);
    const interdit = CONFIG.monde.village.rayon + CONFIG.apparitions.margeVillage;
    expect(zone(monde('prairie'), 3).every((p) => Math.hypot(p.x, p.z) >= interdit)).toBe(true);
  });

  it('la limite des animaux présents est comptée à part', () => {
    const points = zone(monde('prairie'), 2).map((p) => ({ ...p, nuitSeulement: false }));
    const demande = { points, actifs: new Set<string>(), morts: {}, joueur: { x: 0, z: 0 }, temps: 0, nuit: false };
    const limite = CONFIG.apparitions.animaux.limiteActifs;
    expect(choisirApparitions(demande, limite).length).toBeLessThanOrEqual(limite);
    expect(choisirApparitions(demande, 2).length).toBe(2);
    expect(choisirApparitions({ ...demande, actifs: new Set(['a:x', 'a:y']) }, 2)).toEqual([]);
  });
});

describe('animaux : quêtes', () => {
  it("un animal tué ne compte pas pour une quête d'ennemis", () => {
    const acceptee = accepter(creerEtatQuetes(), 'nuisibles');
    const quete = chercherQuete('nuisibles');
    if (!acceptee.ok || !quete) return;
    const apres = evenement(acceptee.etat, { type: 'animalTue', animal: 'sanglier' });
    expect(apres.enCours).toEqual(acceptee.etat.enCours);
  });
});
