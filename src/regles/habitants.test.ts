import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { repousserHorsRectangle } from './deplacement';
import {
  HABITANTS,
  campementAldric,
  creerEtatHabitant,
  creerEtatsHabitants,
  dureePoste,
  habitantsPresents,
  lieuxHabitant,
  obstaclesSansForgeron,
  pasHabitant,
  periodeDeLHeure,
  pointLibre,
  portesVillage,
  rayonObstacleHabitant,
  reseauHabitant,
  segmentLibre,
  tournerVers,
  tracerChemin,
  type EtatHabitant,
  type Point,
  cabaneAldric,
} from './habitants';
import { APPARITION, RAYON_VILLAGE, decrireVillage, obstaclesVillage, porteMaisonJoueur, type NiveauVillage, type ObstaclesVillage } from './village';

const R = CONFIG.habitants;
const NIVEAUX: NiveauVillage[] = [1, 2, 3];
const VILLAGEOIS = (niveau: NiveauVillage) => habitantsPresents(niveau).filter((id) => id !== 'aldric');
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);

/** Vérification indépendante du tracé : aucun point du trajet (hors des deux bouts) ne touche un obstacle. */
function trajetDegage(depart: Point, chemin: Point[], obstacles: ObstaclesVillage): boolean {
  const rayon = R.rayon;
  const arrivee = chemin[chemin.length - 1];
  let a = depart;
  for (const b of chemin) {
    const pas = Math.ceil(distance(a, b) / 0.1);
    for (let i = 0; i <= pas; i++) {
      const p = { x: a.x + ((b.x - a.x) * i) / Math.max(1, pas), z: a.z + ((b.z - a.z) * i) / Math.max(1, pas) };
      if (distance(p, depart) < 0.7 || distance(p, arrivee) < 0.7) continue;
      if (obstacles.cercles.some((o) => distance(p, o) < o.rayon + rayon)) return false;
      if (obstacles.rectangles.some((o) => repousserHorsRectangle(p.x, p.z, rayon, o) !== null)) return false;
    }
    a = b;
  }
  return true;
}

/** Fait vivre un habitant `secondes` secondes à heure fixe. */
function simuler(etat: EtatHabitant, niveau: NiveauVillage, heure: number, secondes: number, joueur: Point | null = null): EtatHabitant {
  let e = etat;
  for (let t = 0; t < secondes; t += 0.1) e = pasHabitant(e, { niveau, heure, joueur }, 0.1);
  return e;
}

describe('périodes de la routine', () => {
  it('jour de 7 h à 18 h, soir de 18 h à 22 h, nuit ensuite', () => {
    expect(periodeDeLHeure(7)).toBe('jour');
    expect(periodeDeLHeure(12)).toBe('jour');
    expect(periodeDeLHeure(17.99)).toBe('jour');
    expect(periodeDeLHeure(18)).toBe('soir');
    expect(periodeDeLHeure(21.99)).toBe('soir');
    expect(periodeDeLHeure(22)).toBe('nuit');
    expect(periodeDeLHeure(3)).toBe('nuit');
    expect(periodeDeLHeure(6.99)).toBe('nuit');
    expect(periodeDeLHeure(24 + 12)).toBe('jour');
  });
});

describe('qui habite le village', () => {
  it('Hugo arrive au niveau 2 ; 6 habitants au plus', () => {
    expect(habitantsPresents(1)).toEqual(['gaspard', 'marthe', 'mathilde', 'bertil', 'aldric']);
    expect(habitantsPresents(2)).toContain('hugo');
    expect(habitantsPresents(3)).toHaveLength(6);
    expect(HABITANTS.length).toBeLessThanOrEqual(6);
  });

  it('la maison de Hugo est maison-3, celle de Marthe est l’auberge dès le niveau 2', () => {
    const el = (id: string) => decrireVillage(2).elements.find((e) => e.id === id)!;
    expect(distance(lieuxHabitant('hugo', 2).porte!, el('maison-3'))).toBeLessThan(4);
    expect(distance(lieuxHabitant('marthe', 2).porte!, el('auberge'))).toBeLessThan(5.5);
    expect(distance(lieuxHabitant('marthe', 1).porte!, decrireVillage(1).elements.find((e) => e.id === 'maison-2')!)).toBeLessThan(4);
  });
});

describe('lieux', () => {
  it('chaque villageois a 2 ou 3 postes le jour et un point pour le soir', () => {
    for (const niveau of NIVEAUX) {
      for (const id of VILLAGEOIS(niveau)) {
        const lieux = lieuxHabitant(id, niveau);
        expect(lieux.jour.length, `${id} niveau ${niveau}`).toBeGreaterThanOrEqual(2);
        expect(lieux.jour.length).toBeLessThanOrEqual(3);
        expect(lieux.soir.length).toBeGreaterThanOrEqual(1);
        expect(lieux.porte).not.toBeNull();
      }
    }
  });

  it('les postes sont dégagés, dans le village, loin des portes et du point d’apparition', () => {
    for (const niveau of NIVEAUX) {
      const obstacles = obstaclesSansForgeron(niveau);
      const portes = portesVillage(niveau);
      const porteJoueur = porteMaisonJoueur(niveau)!;
      for (const id of VILLAGEOIS(niveau)) {
        const lieux = lieuxHabitant(id, niveau);
        for (const p of [...lieux.jour, ...lieux.soir]) {
          const nom = `${id} niveau ${niveau} (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`;
          expect(pointLibre(p, obstacles, R.rayon), nom).toBe(true);
          expect(Math.hypot(p.x, p.z), nom).toBeLessThan(RAYON_VILLAGE - 5);
          for (const porte of portes) expect(distance(p, porte), nom).toBeGreaterThan(2);
          expect(distance(p, porteJoueur), nom).toBeGreaterThan(3);
          expect(distance(p, APPARITION), nom).toBeGreaterThan(1.5);
        }
        // Le point où il disparaît est devant une porte, hors des murs
        expect(pointLibre(lieux.porte!, obstacles, R.rayon)).toBe(true);
        expect(distance(lieux.porte!, porteJoueur)).toBeGreaterThan(3);
      }
    }
  });

  it('deux habitants ne se tiennent pas au même endroit le soir', () => {
    for (const niveau of NIVEAUX) {
      const points = VILLAGEOIS(niveau).map((id) => lieuxHabitant(id, niveau).soir[0]);
      for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) expect(distance(points[i], points[j])).toBeGreaterThan(1.2);
      }
    }
  });

  it('le soir : près de l’auberge au niveau 2, autour du feu de la place au niveau 1', () => {
    const feu = decrireVillage(1).elements.find((e) => e.type === 'feu-camp')!;
    for (const id of VILLAGEOIS(1)) expect(distance(lieuxHabitant(id, 1).soir[0], feu)).toBeLessThan(3);
    const auberge = decrireVillage(2).elements.find((e) => e.type === 'auberge')!;
    for (const id of VILLAGEOIS(2)) expect(distance(lieuxHabitant(id, 2).soir[0], auberge)).toBeLessThan(11);
  });

  it('Aldric vit à 200–300 m du village, à côté de son feu', () => {
    const { feu, rocher } = campementAldric();
    expect(Math.hypot(feu.x, feu.z)).toBeGreaterThanOrEqual(200);
    expect(Math.hypot(feu.x, feu.z)).toBeLessThanOrEqual(300);
    const lieux = lieuxHabitant('aldric', 1);
    expect(lieux.porte).toBeNull();
    for (const p of lieux.jour) {
      expect(distance(p, feu)).toBeLessThan(3);
      expect(pointLibre(p, { cercles: [feu, rocher], rectangles: [] }, R.rayon)).toBe(true);
    }
  });
});

describe('chemins', () => {
  it('segmentLibre voit un mur et un cercle', () => {
    const obstacles: ObstaclesVillage = {
      cercles: [{ x: 10, z: 0, rayon: 1 }],
      rectangles: [{ x: 0, z: 0, demiLargeur: 2, demiProfondeur: 1, angle: 0.4 }],
    };
    expect(segmentLibre({ x: -5, z: 0 }, { x: 5, z: 0 }, obstacles, 0.5)).toBe(false);
    expect(segmentLibre({ x: -5, z: 4 }, { x: 5, z: 4 }, obstacles, 0.5)).toBe(true);
    expect(segmentLibre({ x: 10, z: -5 }, { x: 10, z: 5 }, obstacles, 0.5)).toBe(false);
    expect(segmentLibre({ x: 11.4, z: -5 }, { x: 11.4, z: 5 }, obstacles, 0.5)).toBe(false);
    expect(segmentLibre({ x: 11.6, z: -5 }, { x: 11.6, z: 5 }, obstacles, 0.5)).toBe(true);
  });

  it('tous les trajets de la routine contournent les bâtiments, à chaque niveau', () => {
    for (const niveau of NIVEAUX) {
      const obstacles = obstaclesSansForgeron(niveau);
      for (const id of VILLAGEOIS(niveau)) {
        const reseau = reseauHabitant(id, niveau);
        const { jour, soir, porte } = lieuxHabitant(id, niveau);
        const trajets: Array<[Point, Point]> = [
          ...jour.map((p, i): [Point, Point] => [p, jour[(i + 1) % jour.length]]),
          ...jour.map((p): [Point, Point] => [p, soir[0]]),
          ...jour.map((p): [Point, Point] => [p, porte!]),
          [soir[0], porte!],
          [porte!, jour[0]],
          [porte!, soir[0]],
        ];
        for (const [a, b] of trajets) {
          const chemin = tracerChemin(reseau, a, b);
          const nom = `${id} niveau ${niveau} : (${a.x.toFixed(1)}, ${a.z.toFixed(1)}) -> (${b.x.toFixed(1)}, ${b.z.toFixed(1)})`;
          expect(chemin[chemin.length - 1], nom).toEqual(b);
          expect(trajetDegage(a, chemin, obstacles), nom).toBe(true);
          // Un détour raisonnable : pas plus de deux fois et demie la ligne droite
          let longueur = 0;
          let p = a;
          for (const q of chemin) {
            longueur += distance(p, q);
            p = q;
          }
          expect(longueur, nom).toBeLessThan(distance(a, b) * 2.5 + 6);
        }
      }
    }
  });

  it('un trajet à travers une maison passe par des points de passage', () => {
    const maison = decrireVillage(1).elements.find((e) => e.id === 'maison-2')!;
    const a = { x: maison.x - 6, z: maison.z };
    const b = { x: maison.x + 6, z: maison.z };
    const chemin = tracerChemin(reseauHabitant('gaspard', 1), a, b);
    expect(chemin.length).toBeGreaterThan(1);
    expect(trajetDegage(a, chemin, obstaclesSansForgeron(1))).toBe(true);
  });

  it('Aldric contourne son feu', () => {
    const { feu, rocher } = campementAldric();
    const [a, b] = lieuxHabitant('aldric', 1).jour;
    const chemin = tracerChemin(reseauHabitant('aldric', 1), a, b);
    expect(trajetDegage(a, chemin, { cercles: [feu, rocher], rectangles: [] })).toBe(true);
  });
});

describe('routine', () => {
  it('à midi, chacun est visible à son premier poste', () => {
    for (const niveau of NIVEAUX) {
      const etats = creerEtatsHabitants(niveau, 12);
      expect(etats.map((e) => e.id)).toEqual(habitantsPresents(niveau));
      for (const e of etats) {
        const p = lieuxHabitant(e.id, niveau).jour[0];
        expect(e.visible).toBe(true);
        expect(e.mode).toBe('poste');
        expect(distance(e, p)).toBeLessThan(1e-9);
      }
    }
  });

  it('le jour, un habitant passe d’un poste à l’autre', () => {
    const lieux = lieuxHabitant('gaspard', 1);
    let e = creerEtatHabitant('gaspard', 1, 10);
    const vus = new Set<number>();
    for (let t = 0; t < 400; t += 0.1) {
      e = pasHabitant(e, { niveau: 1, heure: 10, joueur: null }, 0.1);
      if (e.mode === 'poste') vus.add(e.poste);
    }
    expect(vus.size).toBe(lieux.jour.length);
  });

  it('il fait son activité au poste qui en a une, pas en marchant', () => {
    let e = creerEtatHabitant('marthe', 2, 10);
    e = simuler(e, 2, 10, 2);
    expect(e.activite).toBe(true);
    let enMarche = 0;
    for (let t = 0; t < 120; t += 0.1) {
      e = pasHabitant(e, { niveau: 2, heure: 10, joueur: null }, 0.1);
      if (e.mode === 'marche') {
        enMarche++;
        expect(e.activite).toBe(false);
      }
    }
    expect(enMarche).toBeGreaterThan(0);
  });

  it('le soir, tous rejoignent leur point de veillée', () => {
    for (const niveau of NIVEAUX) {
      for (const id of VILLAGEOIS(niveau)) {
        const e = simuler(creerEtatHabitant(id, niveau, 12), niveau, 19, 120);
        expect(e.mode, `${id} niveau ${niveau}`).toBe('poste');
        expect(distance(e, lieuxHabitant(id, niveau).soir[0])).toBeLessThan(1e-6);
      }
    }
  });

  it('la nuit, chacun marche jusqu’à sa porte puis disparaît ; au matin il en ressort', () => {
    for (const niveau of NIVEAUX) {
      for (const id of VILLAGEOIS(niveau)) {
        const lieux = lieuxHabitant(id, niveau);
        const soir = simuler(creerEtatHabitant(id, niveau, 19), niveau, 19, 5);
        const depart = pasHabitant(soir, { niveau, heure: 22.1, joueur: null }, 0.1);
        expect(depart.mode).toBe('marche');
        expect(depart.visible).toBe(true);
        const nuit = simuler(depart, niveau, 23, 120);
        expect(nuit.visible, `${id} niveau ${niveau}`).toBe(false);
        expect(nuit.mode).toBe('chez-soi');
        expect(distance(nuit, lieux.porte!)).toBeLessThan(1e-6);
        const matin = pasHabitant(nuit, { niveau, heure: 7.05, joueur: null }, 0.1);
        expect(matin.visible).toBe(true);
        expect(distance(matin, lieux.porte!)).toBeLessThan(0.5);
        // Jusqu'à son arrivée au premier poste
        let jour = matin;
        for (let t = 0; t < 120 && jour.mode === 'marche'; t += 0.1) jour = pasHabitant(jour, { niveau, heure: 8, joueur: null }, 0.1);
        expect(jour.mode).toBe('poste');
        expect(distance(jour, lieux.jour[0])).toBeLessThan(1e-6);
      }
    }
  });

  it('une partie chargée la nuit : les villageois sont déjà chez eux', () => {
    const etats = creerEtatsHabitants(2, 2);
    for (const e of etats) expect(e.visible).toBe(e.id === 'aldric');
  });

  it('Aldric reste près de son feu à toute heure', () => {
    const { feu } = campementAldric();
    let e = creerEtatHabitant('aldric', 1, 12);
    for (const heure of [12, 19, 23, 3, 8]) {
      e = simuler(e, 1, heure, 90);
      expect(e.visible).toBe(true);
      expect(distance(e, feu)).toBeLessThan(3);
    }
  });

  it('la même heure et les mêmes gestes donnent le même résultat', () => {
    const a = simuler(creerEtatHabitant('mathilde', 2, 9), 2, 9, 200);
    const b = simuler(creerEtatHabitant('mathilde', 2, 9), 2, 9, 200);
    expect(a).toEqual(b);
    expect(dureePoste('hugo', 3)).toBe(dureePoste('hugo', 3));
    expect(dureePoste('hugo', 3)).toBeGreaterThanOrEqual(R.dureePosteMin);
    expect(dureePoste('hugo', 3)).toBeLessThan(R.dureePosteMax);
  });
});

describe('le joueur approche', () => {
  const face = (e: EtatHabitant, j: Point) => Math.atan2(j.x - e.x, j.z - e.z);

  it('à moins de 3 m, l’habitant se tourne vers lui et arrête son activité', () => {
    const e0 = simuler(creerEtatHabitant('gaspard', 1, 10), 1, 10, 2);
    expect(e0.activite).toBe(true);
    const joueur = { x: e0.x - 2, z: e0.z - 1 };
    const e = simuler(e0, 1, 10, 2, joueur);
    expect(e.versJoueur).toBe(true);
    expect(e.activite).toBe(false);
    expect(Math.abs(tournerVers(e.orientation, face(e, joueur), 10) - e.orientation)).toBeLessThan(1e-6);
    expect(Math.cos(e.orientation - face(e, joueur))).toBeGreaterThan(0.999);
    // Il ne quitte pas son poste tant que le joueur est là
    const plusTard = simuler(e, 1, 10, 120, joueur);
    expect(plusTard.mode).toBe('poste');
    expect(distance(plusTard, e0)).toBeLessThan(1e-9);
  });

  it('entre 3 m et 7 m, seule la tête le suit', () => {
    const e0 = simuler(creerEtatHabitant('gaspard', 1, 10), 1, 10, 2);
    const joueur = { x: e0.x + 4, z: e0.z + 3 };
    const e = simuler(e0, 1, 10, 2, joueur);
    expect(e.versJoueur).toBe(false);
    expect(e.orientation).toBeCloseTo(e0.orientation, 6);
    expect(e.regard).toBeGreaterThan(0.3);
    expect(Math.abs(e.regard)).toBeLessThanOrEqual(R.angleRegardMax);
    // Le joueur parti, la tête revient
    expect(simuler(e, 1, 10, 2, null).regard).toBe(0);
  });

  it('en marche, il s’arrête devant le joueur et repart ensuite', () => {
    let e = creerEtatHabitant('gaspard', 1, 12);
    e = pasHabitant(e, { niveau: 1, heure: 19, joueur: null }, 0.1);
    expect(e.mode).toBe('marche');
    const arret = simuler(e, 1, 19, 3, { x: e.x + 1, z: e.z });
    expect(arret.vitesse).toBe(0);
    expect(distance(arret, e)).toBeLessThan(1e-9);
    expect(simuler(arret, 1, 19, 120).mode).toBe('poste');
  });

  it('un habitant est un obstacle, sauf près d’une porte ou une fois rentré', () => {
    const portes = portesVillage(2);
    const e = creerEtatHabitant('gaspard', 2, 12);
    expect(rayonObstacleHabitant(e, portes)).toBe(R.rayon);
    expect(rayonObstacleHabitant({ ...e, visible: false }, portes)).toBe(0);
    const porteJoueur = porteMaisonJoueur(2)!;
    expect(rayonObstacleHabitant({ ...e, x: porteJoueur.x + 1, z: porteJoueur.z }, portes)).toBe(0);
    for (const id of VILLAGEOIS(2)) {
      const devant = lieuxHabitant(id, 2).porte!;
      expect(rayonObstacleHabitant({ ...e, x: devant.x, z: devant.z }, portes)).toBe(0);
    }
  });

  it('le forgeron fixe ne fait plus partie des obstacles (Bertil se déplace)', () => {
    expect(obstaclesVillage(1).cercles.length - obstaclesSansForgeron(1).cercles.length).toBe(1);
    expect(obstaclesVillage(1).rectangles.length).toBe(obstaclesSansForgeron(1).rectangles.length);
  });
});

describe('cabane d’Aldric', () => {
  it('est à 3-4 m du feu, porte tournée vers lui, dans la zone sans décor, loin des postes d’Aldric', () => {
    const A = CONFIG.habitants.aldric;
    const c = cabaneAldric();
    expect(Math.hypot(c.x - A.x, c.z - A.z)).toBeGreaterThanOrEqual(3);
    expect(Math.hypot(c.x - A.x, c.z - A.z)).toBeLessThanOrEqual(4);
    const verslefeu = Math.atan2(A.x - c.x, A.z - c.z);
    expect(Math.abs(Math.sin(c.orientation - verslefeu))).toBeLessThan(0.05);
    expect(Math.cos(c.orientation - verslefeu)).toBeGreaterThan(0.99);
    const loin = Math.hypot(c.obstacle.demiLargeur, c.obstacle.demiProfondeur);
    expect(Math.hypot(c.x - A.x, c.z - A.z) + loin).toBeLessThanOrEqual(A.rayonSansDecor);
    for (const p of lieuxHabitant('aldric', 1).jour) expect(repousserHorsRectangle(p.x, p.z, 0.3, c.obstacle)).toBeNull();
  });
});
