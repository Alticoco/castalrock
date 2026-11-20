import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import {
  INFOS_ENNEMIS,
  blesserJoueur,
  boirePotion,
  creerEnnemi,
  creerVieJoueur,
  degatsAvecOutil,
  degatsEpee,
  degatsRecus,
  ennemiVise,
  frapperEnnemi,
  pasEnnemi,
  pasVieJoueur,
  progressionSaut,
  tirerButinEnnemi,
  type ContexteEnnemi,
  type EtatEnnemi,
  type PhaseEnnemi,
} from './combat';
import type { MondeDeplacement } from './deplacement';

const C = CONFIG.combat;
const DT = 0.05;

function mondePlat(extra: Partial<MondeDeplacement> = {}): MondeDeplacement {
  return { hauteur: () => 5, niveauEau: 0, obstacles: [], ...extra };
}

function contexte(x: number, z: number, extra: Partial<ContexteEnnemi> = {}): ContexteEnnemi {
  return { joueur: { x, z, vivant: true }, monde: mondePlat(), rayonVillage: 45, ...extra };
}

/** Fait vivre un ennemi `duree` secondes ; renvoie l'état final, les dégâts portés et les phases traversées. */
function vivre(
  depart: EtatEnnemi,
  ctx: ContexteEnnemi | ((e: EtatEnnemi, t: number) => ContexteEnnemi),
  duree: number,
  observer?: (e: EtatEnnemi) => void,
): { etat: EtatEnnemi; degats: number; phases: PhaseEnnemi[] } {
  let etat = depart;
  let degats = 0;
  const phases: PhaseEnnemi[] = [etat.phase];
  for (let t = 0; t < duree; t += DT) {
    const r = pasEnnemi(etat, typeof ctx === 'function' ? ctx(etat, t) : ctx, DT);
    etat = r.etat;
    degats += r.degats;
    if (phases[phases.length - 1] !== etat.phase) phases.push(etat.phase);
    observer?.(etat);
  }
  return { etat, degats, phases };
}

describe('vie du joueur', () => {
  it("réduit les dégâts selon l'armure (fibres : 15 %)", () => {
    const f = CONFIG.combat.reductionArmure.fibres;
    expect(f).toBe(0.15);
    expect(degatsRecus(10, 0)).toBe(10);
    expect(degatsRecus(20, f)).toBe(17);
    expect(degatsRecus(6, f)).toBe(5);
    expect(degatsRecus(0, f)).toBe(0);
    const r = blesserJoueur(creerVieJoueur(), 20, f);
    expect(r.degats).toBe(17);
    expect(r.vie.pv).toBe(C.vieMax - 17);
    expect(r.mort).toBe(false);
  });

  it('chaque armure retire sa part : cuir 25 %, fourrure 30 %, mailles 40 %, plaques 55 %', () => {
    const R = CONFIG.combat.reductionArmure;
    expect([R.cuir, R.fourrure, R.mailles, R.plaques]).toEqual([0.25, 0.3, 0.4, 0.55]);
    expect(degatsRecus(100, R.cuir)).toBe(75);
    expect(degatsRecus(100, R.plaques)).toBe(45);
    // Armure usée : moitié moins efficace
    expect(degatsRecus(100, R.mailles, 0.5)).toBe(80);
  });

  it('meurt à zéro, sans descendre en dessous, et ne reçoit plus de coups ensuite', () => {
    const r = blesserJoueur(creerVieJoueur(8), 10, 0);
    expect(r.vie.pv).toBe(0);
    expect(r.degats).toBe(8);
    expect(r.mort).toBe(true);
    expect(blesserJoueur(r.vie, 10, 0)).toEqual({ vie: r.vie, degats: 0, mort: false });
  });

  it("multiplie les dégâts de l'épée par le facteur de l'arme", () => {
    expect(degatsEpee()).toBe(C.degatsEpee);
    expect(degatsEpee(CONFIG.fabrication.paliers.fer.degats)).toBe(C.degatsEpee * 1.6);
  });

  it("le mauvais outil (hache, pioche) fait moins de dégâts à un ennemi, mais en fait", () => {
    const fer = CONFIG.fabrication.paliers.fer.degats;
    expect(degatsAvecOutil('epee')).toBe(C.degatsEpee);
    expect(degatsAvecOutil('epee', fer)).toBe(C.degatsEpee * fer);
    expect(degatsAvecOutil('hache')).toBe(C.degatsEpee * C.facteurOutilInadapte);
    expect(degatsAvecOutil('pioche', fer)).toBe(C.degatsEpee * C.facteurOutilInadapte);
    expect(degatsAvecOutil('hache')).toBeGreaterThan(0);
    expect(degatsAvecOutil('hache')).toBeLessThan(degatsAvecOutil('epee'));
  });

  it('ne se régénère qu\'après le délai sans dégâts, sans dépasser le maximum', () => {
    let vie = blesserJoueur(creerVieJoueur(), 40, 0).vie;
    vie = pasVieJoueur(vie, C.delaiRegeneration - 0.5);
    expect(vie.pv).toBe(60);
    vie = pasVieJoueur(vie, 0.5);
    vie = pasVieJoueur(vie, 2);
    expect(vie.pv).toBeCloseTo(60 + 2 * C.regenerationParSeconde);
    // Un nouveau coup relance le délai
    vie = blesserJoueur(vie, 5, 0).vie;
    const apres = pasVieJoueur(vie, 1);
    expect(apres.pv).toBe(vie.pv);
    expect(pasVieJoueur(creerVieJoueur(99.9), 100).pv).toBe(C.vieMax);
    // À zéro : pas de régénération
    expect(pasVieJoueur(creerVieJoueur(0), 100).pv).toBe(0);
  });

  it('boit une potion : +50, puis temps de recharge ; refus sans potion ou vie pleine', () => {
    const vie = creerVieJoueur(30);
    const r = boirePotion(vie, 1);
    expect(r.ok).toBe(true);
    expect(r.vie.pv).toBe(30 + C.soinPotion);
    expect(r.soin).toBe(C.soinPotion);
    expect(boirePotion(r.vie, 3).raison).toBe('recharge');
    const pret = pasVieJoueur({ ...r.vie, depuisDegats: 0 }, C.rechargePotion);
    expect(boirePotion(pret, 3).ok).toBe(true);
    expect(boirePotion(pret, 3).vie.pv).toBe(C.vieMax);
    expect(boirePotion(vie, 0).raison).toBe('aucune-potion');
    expect(boirePotion(creerVieJoueur(), 2).raison).toBe('vie-pleine');
    expect(boirePotion(creerVieJoueur(0), 2).ok).toBe(false);
  });
});

describe('ennemis', () => {
  it('slime : passif au-delà de 8 m, poursuit en dessous', () => {
    const slime = creerEnnemi('s1', 'slime', 300, 300, 5);
    const loin = vivre(slime, contexte(300, 300 + INFOS_ENNEMIS.slime.distanceDetection + 8), 20);
    expect(loin.phases).not.toContain('poursuite');
    expect(loin.degats).toBe(0);
    const pres = vivre(slime, contexte(300, 307), 1);
    expect(pres.phases).toContain('poursuite');
  });

  it('slime : avance par bonds et blesse au contact, avec un temps de recharge', () => {
    const slime = creerEnnemi('s2', 'slime', 300, 300, 5);
    let enLAir = 0;
    let auSol = 0;
    const r = vivre(slime, contexte(300, 304), 6, (e) => {
      if (progressionSaut(e) >= 0) enLAir++;
      else auSol++;
    });
    expect(enLAir).toBeGreaterThan(0);
    expect(auSol).toBeGreaterThan(0);
    expect(r.degats).toBeGreaterThanOrEqual(INFOS_ENNEMIS.slime.degats);
    // Au plus un coup par temps de recharge
    expect(r.degats).toBeLessThanOrEqual(INFOS_ENNEMIS.slime.degats * Math.ceil(6 / INFOS_ENNEMIS.slime.recharge));
  });

  it('gobelin : lève le bras (anticipation) avant de frapper', () => {
    const gobelin = creerEnnemi('g1', 'gobelin', 300, 300, 5);
    let etat = gobelin;
    let tempsAnticipation = 0;
    let degats = 0;
    for (let t = 0; t < 3 && degats === 0; t += DT) {
      const r = pasEnnemi(etat, contexte(300, 301.5), DT);
      if (etat.phase === 'anticipation') tempsAnticipation += DT;
      etat = r.etat;
      degats = r.degats;
    }
    expect(degats).toBe(INFOS_ENNEMIS.gobelin.degats);
    expect(tempsAnticipation).toBeGreaterThanOrEqual(INFOS_ENNEMIS.gobelin.dureeAnticipation - 1e-6);
    expect(etat.phase).toBe('attaque');
  });

  it("gobelin : reculer pendant l'anticipation esquive le coup", () => {
    const gobelin = creerEnnemi('g2', 'gobelin', 300, 300, 5);
    const r = vivre(
      gobelin,
      // Dès que le bras se lève, le joueur est hors de portée du coup
      (e) => contexte(300, e.phase === 'anticipation' || e.phase === 'attaque' ? 304 : 301.5),
      1.2,
    );
    expect(r.phases).toContain('anticipation');
    expect(r.phases).toContain('attaque');
    expect(r.degats).toBe(0);
  });

  it('gobelin : abandonne la poursuite loin de son point de départ et y retourne', () => {
    const gobelin = creerEnnemi('g3', 'gobelin', 300, 300, 5);
    // Le joueur fuit devant lui, à la même vitesse, toujours à 8 m
    const fuite = vivre(gobelin, (e) => contexte(300, e.z + 8), 12);
    expect(fuite.phases).toContain('poursuite');
    expect(fuite.phases).toContain('retour');
    const max = INFOS_ENNEMIS.gobelin.distanceAbandon + 1;
    expect(Math.hypot(fuite.etat.x - 300, fuite.etat.z - 300)).toBeLessThanOrEqual(max);
    // Joueur parti : il rentre et se repose, vie pleine
    const blesse = { ...fuite.etat, pv: 10 };
    const retour = vivre(blesse, contexte(300, 500), 15);
    expect(Math.hypot(retour.etat.x - 300, retour.etat.z - 300)).toBeLessThan(C.rayonErrance + 1);
    expect(retour.phases).toContain('repos');
    expect(retour.etat.pv).toBe(INFOS_ENNEMIS.gobelin.pv);
  });

  it("n'entre jamais dans le village et repart quand le joueur s'y réfugie", () => {
    const gobelin = creerEnnemi('g4', 'gobelin', 0, 56, 5);
    let mini = Infinity;
    // Le joueur est d'abord dehors (z = 47), puis dans le village (z = 30)
    const r = vivre(
      gobelin,
      (_e, t) => contexte(0, t < 1.5 ? 47 : 30),
      8,
      (e) => {
        mini = Math.min(mini, Math.hypot(e.x, e.z));
      },
    );
    expect(mini).toBeGreaterThanOrEqual(45 - 1e-6);
    expect(r.phases).toContain('poursuite');
    expect(r.phases).toContain('retour');
    // Poussé vers le village (recul), il reste au bord
    const pousse = { ...creerEnnemi('g5', 'gobelin', 0, 45.5, 5), vx: 0, vz: -20 };
    const apres = vivre(pousse, contexte(0, 200), 0.5);
    expect(Math.hypot(apres.etat.x, apres.etat.z)).toBeGreaterThanOrEqual(45 - 1e-6);
  });

  it('contourne un obstacle rond sans jamais le traverser', () => {
    const obstacle = { x: 300, z: 305, rayon: 1 };
    const gobelin = creerEnnemi('g6', 'gobelin', 300, 300, 5);
    let mini = Infinity;
    const r = vivre(gobelin, contexte(300, 310, { monde: mondePlat({ obstacles: [obstacle] }) }), 6, (e) => {
      mini = Math.min(mini, Math.hypot(e.x - obstacle.x, e.z - obstacle.z));
    });
    expect(mini).toBeGreaterThanOrEqual(obstacle.rayon + INFOS_ENNEMIS.gobelin.rayon - 1e-6);
    expect(r.degats).toBeGreaterThan(0);
  });

  it('glisse contre un mur (rectangle) sans le traverser', () => {
    const mur = { x: 300, z: 305, demiLargeur: 2, demiProfondeur: 0.3, angle: 0 };
    const gobelin = creerEnnemi('g7', 'gobelin', 300.5, 300, 5);
    const r = vivre(gobelin, contexte(300.5, 310, { monde: mondePlat({ rectangles: [mur] }) }), 8, (e) => {
      const dedans = Math.abs(e.x - mur.x) < mur.demiLargeur && Math.abs(e.z - mur.z) < mur.demiProfondeur;
      expect(dedans).toBe(false);
    });
    expect(r.etat.z).toBeGreaterThan(306);
  });

  it("ne va pas dans l'eau profonde et suit le relief", () => {
    // Sol en pente douce, puis un lac profond à partir de z = 306
    const hauteur = (_x: number, z: number) => (z > 306 ? -3 : 5 + (z - 300) * 0.1);
    const gobelin = creerEnnemi('g8', 'gobelin', 300, 300, 5);
    const r = vivre(gobelin, contexte(300, 312, { monde: mondePlat({ hauteur }) }), 6, (e) => {
      expect(e.z).toBeLessThanOrEqual(306);
      expect(e.y).toBeCloseTo(hauteur(e.x, e.z));
    });
    expect(r.degats).toBe(0);
    // Bloqué au bord : il finit par renoncer
    expect(r.phases).toContain('retour');
  });

  it('prend des dégâts, recule, devient hostile et meurt à zéro', () => {
    const slime = creerEnnemi('s3', 'slime', 300, 300, 5);
    const coup = frapperEnnemi(slime, degatsEpee(), 300, 298);
    expect(coup.mort).toBe(false);
    expect(coup.etat.pv).toBe(INFOS_ENNEMIS.slime.pv - C.degatsEpee);
    expect(coup.etat.phase).toBe('recul');
    // Le joueur est trop loin pour être détecté : le slime recule puis le poursuit quand même
    const suite = vivre(coup.etat, contexte(300, 290), 0.6);
    expect(suite.phases).toEqual(['recul', 'poursuite']);
    expect(coup.etat.vz).toBeGreaterThan(0);

    let etat = slime;
    let morts = 0;
    for (let i = 0; i < 3; i++) {
      const r = frapperEnnemi(etat, degatsEpee(), 300, 298);
      etat = r.etat;
      if (r.mort) morts++;
    }
    expect(etat.pv).toBe(0);
    expect(etat.phase).toBe('mort');
    expect(morts).toBe(1);
    // Un mort ne bouge plus, n'attaque plus et ne reprend pas de coups
    const apres = vivre(etat, contexte(300, 300.5), 2);
    expect(apres.degats).toBe(0);
    expect(apres.etat.phase).toBe('mort');
    expect(apres.etat.x).toBe(etat.x);
    expect(frapperEnnemi(etat, 10, 0, 0).mort).toBe(false);
  });

  it("l'épée en fer tue deux fois plus vite", () => {
    const fer = degatsEpee(CONFIG.fabrication.paliers.fer.degats);
    let etat = creerEnnemi('g9', 'gobelin', 300, 300, 5);
    let coups = 0;
    while (etat.phase !== 'mort') {
      etat = frapperEnnemi(etat, fer, 300, 298).etat;
      coups++;
    }
    expect(coups).toBe(Math.ceil(INFOS_ENNEMIS.gobelin.pv / fer));
  });

  it("gobelin : un coup reçu n'annule pas son attaque en cours ; slime : si", () => {
    const gobelin = { ...creerEnnemi('g10', 'gobelin', 300, 300, 5), phase: 'anticipation' as const };
    expect(frapperEnnemi(gobelin, 10, 300, 299).etat.phase).toBe('anticipation');
    const slime = { ...creerEnnemi('s4', 'slime', 300, 300, 5), phase: 'anticipation' as const };
    expect(frapperEnnemi(slime, 10, 300, 299).etat.phase).toBe('recul');
  });

  it('ne poursuit pas un joueur tombé', () => {
    const gobelin = creerEnnemi('g11', 'gobelin', 300, 300, 5);
    const ctx = contexte(300, 303);
    ctx.joueur.vivant = false;
    const r = vivre(gobelin, ctx, 5);
    expect(r.phases).not.toContain('poursuite');
    expect(r.degats).toBe(0);
  });

  it('est déterministe', () => {
    const a = vivre(creerEnnemi('s5', 'slime', 300, 300, 5), contexte(300, 400), 30);
    const b = vivre(creerEnnemi('s5', 'slime', 300, 300, 5), contexte(300, 400), 30);
    expect(a.etat).toEqual(b.etat);
    // Il erre autour de son point de départ
    expect(a.phases).toContain('errance');
    expect(Math.hypot(a.etat.x - 300, a.etat.z - 300)).toBeLessThanOrEqual(C.rayonErrance + 0.5);
  });
});

describe('visée et butin', () => {
  it("vise l'ennemi le plus proche devant le joueur, à portée", () => {
    const devant = creerEnnemi('a', 'slime', 0, 102, 0);
    const plusLoin = creerEnnemi('b', 'gobelin', 0.5, 102.6, 0);
    const derriere = creerEnnemi('c', 'slime', 0, 98.5, 0);
    const horsPortee = creerEnnemi('d', 'slime', 0, 105, 0);
    const tous = [plusLoin, derriere, horsPortee, devant];
    // Regard vers +z (lacet 0)
    expect(ennemiVise(tous, 0, 100, 0)?.id).toBe('a');
    expect(ennemiVise([derriere, horsPortee], 0, 100, 0)).toBeNull();
    // Regard vers -z : celui de derrière
    expect(ennemiVise(tous, 0, 100, Math.PI)?.id).toBe('c');
    // Un mort n'est pas visé
    expect(ennemiVise([{ ...devant, phase: 'mort' }], 0, 100, 0)).toBeNull();
    // Tout contre le joueur : touché même de dos
    expect(ennemiVise([creerEnnemi('e', 'slime', 0, 99.2, 0)], 0, 100, 0)?.id).toBe('e');
  });

  it('tire un butin à graine dans les bornes', () => {
    expect(tirerButinEnnemi('slime', 'e:1:2:0:10')).toEqual(tirerButinEnnemi('slime', 'e:1:2:0:10'));
    let fer = 0;
    const quantites = new Set<number>();
    for (let i = 0; i < 300; i++) {
      const s = tirerButinEnnemi('slime', `s:${i}`);
      expect(Object.keys(s)).toEqual(['gelee-slime']);
      expect(s['gelee-slime']).toBeGreaterThanOrEqual(1);
      expect(s['gelee-slime']).toBeLessThanOrEqual(2);
      const g = tirerButinEnnemi('gobelin', `g:${i}`);
      expect(g.or).toBeGreaterThanOrEqual(1);
      expect(g.or).toBeLessThanOrEqual(3);
      quantites.add(g.or);
      if (g['minerai-fer']) {
        expect(g['minerai-fer']).toBe(1);
        fer++;
      }
    }
    expect(quantites.size).toBe(3);
    expect(fer).toBeGreaterThan(40);
    expect(fer).toBeLessThan(150);
  });

  it('le loup laisse toujours 1 ou 2 fourrures', () => {
    const quantites = new Set<number>();
    for (let i = 0; i < 200; i++) {
      const butin = tirerButinEnnemi('loup', `l:${i}`);
      expect(Object.keys(butin)).toEqual(['fourrure']);
      quantites.add(butin.fourrure);
    }
    expect([...quantites].sort()).toEqual([1, 2]);
  });
});
