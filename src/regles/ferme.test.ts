import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerAleatoire } from './aleatoire';
import { avancerAnimal, creerEtatAnimal, decrireFerme, vitesseAnimal, type EtatAnimal } from './ferme';
import { pointLibre } from './habitants';
import { decrireVillage, obstaclesVillage, pointLocal, type NiveauVillage } from './village';

const R = CONFIG.ferme;

/** Dans le repère de l'enclos : vrai si (x, z) est à l'intérieur de la clôture, à `marge` près. */
function dansEnclos(niveau: NiveauVillage, x: number, z: number, marge: number): boolean {
  const e = decrireVillage(niveau).elements.find((el) => el.id === 'enclos')!;
  const c = Math.cos(e.orientation);
  const s = Math.sin(e.orientation);
  const lx = (x - e.x) * c - (z - e.z) * s;
  const lz = (x - e.x) * s + (z - e.z) * c;
  return Math.abs(lx) <= e.demiLargeur - marge && Math.abs(lz) <= e.demiProfondeur - marge;
}

/** Fait vivre un animal 10 minutes de jeu et renvoie tous ses états (toutes les 0,1 s). */
function simuler(niveau: NiveauVillage, index: number, minutes = 10): { etats: EtatAnimal[]; arrets: number[]; marche: number } {
  const def = decrireFerme(niveau)[index];
  const village = obstaclesVillage(niveau);
  const alea = creerAleatoire(def.graine);
  let etat = creerEtatAnimal(def, alea, village);
  const etats = [etat];
  const arrets: number[] = [];
  let enAttente = 0;
  let marche = 0;
  for (let t = 0; t < minutes * 600; t++) {
    const avant = etat.cible;
    etat = avancerAnimal(def, etat, 0.1, alea, village);
    etats.push(etat);
    if (etat.cible) marche++;
    if (avant && !etat.cible) enAttente = 0;
    if (!etat.cible) enAttente += 0.1;
    if (!avant && etat.cible) arrets.push(enAttente);
  }
  return { etats, arrets, marche };
}

describe('ferme : composition', () => {
  it('niveau 1 : 5 poules près de maison-2, pas de mouton ; niveau 2 et plus : 5 poules et 3 moutons', () => {
    const n1 = decrireFerme(1);
    expect(n1.filter((a) => a.espece === 'poule')).toHaveLength(5);
    expect(n1.filter((a) => a.espece === 'mouton')).toHaveLength(0);
    const maison = decrireVillage(1).elements.find((e) => e.id === 'maison-2')!;
    for (const a of n1) expect(Math.hypot(a.attache.x - maison.x, a.attache.z - maison.z)).toBeLessThan(8);
    for (const n of [2, 3] as const) {
      const liste = decrireFerme(n);
      expect(liste.filter((a) => a.espece === 'poule')).toHaveLength(5);
      expect(liste.filter((a) => a.espece === 'mouton')).toHaveLength(3);
      expect(liste.filter((a) => a.attache.z > 15 && a.espece === 'poule')).toHaveLength(2);
    }
  });

  it('place un enclos libre au niveau 2 et plus, sans enclos au niveau 1', () => {
    expect(decrireVillage(1).elements.some((e) => e.type === 'enclos')).toBe(false);
    for (const n of [2, 3] as const) {
      const e = decrireVillage(n).elements.filter((el) => el.type === 'enclos');
      expect(e).toHaveLength(1);
      // L'enclos bloque le joueur : son obstacle est dans la liste du village
      expect(obstaclesVillage(n).rectangles.some((o) => o.x === e[0].x && o.z === e[0].z)).toBe(true);
    }
  });

  it('les identifiants et les graines sont uniques', () => {
    const liste = decrireFerme(2);
    expect(new Set(liste.map((a) => a.id)).size).toBe(liste.length);
    expect(new Set(liste.map((a) => a.graine)).size).toBe(liste.length);
  });

  it('un point d\'attache de poule est libre, et un mouton commence dans l\'enclos', () => {
    for (const n of [1, 2, 3] as const) {
      const village = obstaclesVillage(n);
      for (const a of decrireFerme(n)) {
        if (a.espece === 'poule') expect(pointLibre(a.attache, village, R.margeObstacle), `${a.id} niveau ${n}`).toBe(true);
        else expect(dansEnclos(n, a.attache.x, a.attache.z, 1)).toBe(true);
      }
    }
  });
});

describe('ferme : déplacements', () => {
  it('vitesses : poule 0,6 m/s, mouton 0,4 m/s', () => {
    expect(vitesseAnimal('poule')).toBe(0.6);
    expect(vitesseAnimal('mouton')).toBe(0.4);
  });

  it('même graine = même parcours', () => {
    expect(simuler(2, 0, 1).etats.at(-1)).toEqual(simuler(2, 0, 1).etats.at(-1));
  });

  it('une poule reste dans son rayon, hors des obstacles, ne va jamais plus vite que 0,6 m/s et fait des pauses de 2 à 6 s', () => {
    for (const n of [1, 2] as const) {
      const village = obstaclesVillage(n);
      const liste = decrireFerme(n);
      liste.forEach((def, i) => {
        if (def.espece !== 'poule') return;
        const { etats, arrets, marche } = simuler(n, i);
        for (let k = 0; k < etats.length; k++) {
          const e = etats[k];
          expect(Math.hypot(e.x - def.attache.x, e.z - def.attache.z)).toBeLessThanOrEqual(def.rayon + 1e-9);
          expect(pointLibre(e, village, 0.2), `${def.id} niveau ${n} à ${k / 10} s`).toBe(true);
          if (k > 0) expect(Math.hypot(e.x - etats[k - 1].x, e.z - etats[k - 1].z)).toBeLessThanOrEqual(0.6 * 0.1 + 1e-9);
        }
        expect(marche).toBeGreaterThan(100);
        expect(arrets.length).toBeGreaterThan(20);
        // (la première attente du départ est entamée au hasard : on la saute)
        for (const a of arrets.slice(1)) {
          expect(a).toBeGreaterThanOrEqual(R.pause.min - 0.2);
          expect(a).toBeLessThanOrEqual(R.pause.max + 0.2);
        }
      });
    }
  });

  it('un mouton reste dans l\'enclos, loin de la clôture, et ne marche pas plus vite que 0,4 m/s', () => {
    const liste = decrireFerme(2);
    liste.forEach((def, i) => {
      if (def.espece !== 'mouton') return;
      const { etats } = simuler(2, i);
      etats.forEach((e, k) => {
        expect(dansEnclos(2, e.x, e.z, R.margeEnclos - 1e-6), `${def.id} à ${k / 10} s`).toBe(true);
        if (k > 0) expect(Math.hypot(e.x - etats[k - 1].x, e.z - etats[k - 1].z)).toBeLessThanOrEqual(0.4 * 0.1 + 1e-9);
      });
    });
  });

  it('l\'activité (picorer, brouter) est vraie la plupart du temps à l\'arrêt', () => {
    const { etats } = simuler(2, 0);
    const arretes = etats.filter((e) => !e.cible);
    expect(arretes.filter((e) => e.activite).length / arretes.length).toBeGreaterThan(0.6);
  });

  it('la nuit (immobile), un animal à l\'arrêt ne repart pas', () => {
    const def = decrireFerme(1)[0];
    const village = obstaclesVillage(1);
    const alea = creerAleatoire(def.graine);
    let etat = creerEtatAnimal(def, alea, village);
    const depart = { x: etat.x, z: etat.z };
    for (let t = 0; t < 600; t++) etat = avancerAnimal(def, { ...etat, cible: null }, 0.1, alea, village, true);
    expect({ x: etat.x, z: etat.z }).toEqual(depart);
  });

  it('pointLocal et l\'enclos : le devant de l\'enclos (barrière) regarde vers le centre du village', () => {
    const e = decrireVillage(2).elements.find((el) => el.type === 'enclos')!;
    const devant = pointLocal(e, 0, 5);
    expect(Math.hypot(devant.x, devant.z)).toBeLessThan(Math.hypot(e.x, e.z));
  });
});
