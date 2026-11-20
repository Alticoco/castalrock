import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { INFOS_RECOLTE, frapper, creerEtatRecolte, outilConseille, tirerButin } from '../regles/recolte';
import { aReapparaitre, delaiRepousse } from '../regles/repousse';
import { xpDestruction } from '../regles/progression';
import { definitionObjet } from '../regles/inventaire';
import {
  contientZoneMine,
  creerPlanMine,
  distanceLibre,
  elementDeLaMine,
  ennemisAFaireApparaitre,
  estOuvert,
  hauteurPlafond,
  rectanglesAutour,
  type PlanMine,
} from './plan';
import { repousserHorsRectangle } from '../regles/deplacement';

const GRAINES = [12345, 1, 2, 7, 99, 2026];

/** Nombre de cases creusées atteignables depuis l'arrivée, et nombre total de cases creusées. */
function atteignables(plan: PlanMine): { atteintes: number; total: number; vues: Uint8Array } {
  const L = plan.largeur;
  const vues = new Uint8Array(plan.ouvert.length);
  const depart = Math.floor(plan.arrivee.z - plan.origine.z) * L + Math.floor(plan.arrivee.x - plan.origine.x);
  const file = [depart];
  vues[depart] = 1;
  for (let k = 0; k < file.length; k++) {
    const c = file[k];
    for (const n of [c - 1, c + 1, c - L, c + L]) {
      if (n < 0 || n >= vues.length || vues[n] || plan.ouvert[n] !== 1) continue;
      vues[n] = 1;
      file.push(n);
    }
  }
  let total = 0;
  for (const v of plan.ouvert) total += v;
  return { atteintes: file.length, total, vues };
}

describe('plan de la mine', () => {
  it('est toujours le même pour une même graine, et change avec la graine', () => {
    const a = creerPlanMine(12345);
    const b = creerPlanMine(12345);
    expect(Array.from(a.ouvert)).toEqual(Array.from(b.ouvert));
    expect(a.elements).toEqual(b.elements);
    expect(a.ennemis).toEqual(b.ennemis);
    const differents = GRAINES.map((g) => creerPlanMine(g).elements.map((e) => `${e.type}${e.x.toFixed(1)}${e.z.toFixed(1)}`).join());
    expect(new Set(differents).size).toBeGreaterThan(1);
  });

  it('a une salle d\'entrée, 3 à 5 galeries, 2 grandes salles et une salle aux cristaux au fond', () => {
    for (const graine of GRAINES) {
      const plan = creerPlanMine(graine);
      const noms = plan.zones.map((z) => z.nom);
      expect(noms).toContain("salle d'entrée");
      expect(noms).toContain('salle aux cristaux');
      // Une galerie coudée compte pour une seule
      const galeries = new Set(plan.zones.filter((z) => z.type === 'galerie').map((z) => z.nom.replace(' (coude)', '')));
      expect(galeries.size).toBeGreaterThanOrEqual(3);
      expect(galeries.size).toBeLessThanOrEqual(5);
      const grandes = plan.zones.filter((z) => z.type === 'salle' && (z.x1 - z.x0) * (z.z1 - z.z0) >= 150);
      expect(grandes).toHaveLength(2);
      // La salle aux cristaux est la zone la plus éloignée de l'arrivée
      const cristaux = plan.zones.find((z) => z.type === 'cristaux')!;
      for (const z of plan.zones) expect(cristaux.z1).toBeGreaterThanOrEqual(z.z1);
    }
  });

  it('est d\'un seul tenant : toutes les cases creusées se rejoignent à pied depuis l\'arrivée', () => {
    for (const graine of GRAINES) {
      const plan = creerPlanMine(graine);
      const { atteintes, total } = atteignables(plan);
      expect(atteintes).toBe(total);
      expect(total).toBeGreaterThan(900);
      // Une marge de roche tout autour : on ne sort jamais de la grille
      for (let i = 0; i < plan.largeur; i++) {
        expect(plan.ouvert[i]).toBe(0);
        expect(plan.ouvert[(plan.profondeur - 1) * plan.largeur + i]).toBe(0);
      }
    }
  });

  it('place l\'arrivée, la sortie, les éléments et les ennemis dans des cases creusées', () => {
    for (const graine of GRAINES) {
      const plan = creerPlanMine(graine);
      expect(estOuvert(plan, plan.arrivee.x, plan.arrivee.z)).toBe(true);
      expect(estOuvert(plan, plan.sortie.x, plan.sortie.z)).toBe(true);
      expect(contientZoneMine(plan.arrivee.x, plan.arrivee.z)).toBe(true);
      expect(contientZoneMine(0, 0)).toBe(false);
      for (const e of plan.elements) expect(estOuvert(plan, e.x, e.z)).toBe(true);
      for (const p of plan.ennemis) {
        expect(estOuvert(plan, p.x, p.z)).toBe(true);
        expect(Math.hypot(p.x - plan.arrivee.x, p.z - plan.arrivee.z)).toBeGreaterThan(15);
      }
      expect(plan.ennemis.length).toBeGreaterThanOrEqual(3);
      expect(plan.ennemis.length).toBeLessThanOrEqual(5);
      expect(new Set(plan.ennemis.map((p) => p.type))).toEqual(new Set(['slime', 'gobelin']));
    }
  });

  it('donne des identifiants stables m:<n> et assez de pierre, de fer et de cristaux', () => {
    for (const graine of GRAINES) {
      const plan = creerPlanMine(graine);
      plan.elements.forEach((e, n) => expect(e.id).toBe(`m:${n}`));
      const compte = (type: string) => plan.elements.filter((e) => e.type === type).length;
      expect(compte('rocher')).toBeGreaterThanOrEqual(10);
      expect(compte('filon-fer')).toBeGreaterThanOrEqual(8);
      expect(compte('filon-charbon')).toBeGreaterThanOrEqual(4);
      expect(compte('cristal-bleu')).toBeGreaterThanOrEqual(8);
      expect(elementDeLaMine(plan, 'm:3')).toBe(plan.elements[3]);
      expect(elementDeLaMine(plan, 'd:1:2')).toBeNull();
      // La plupart des cristaux sont dans la salle du fond
      const fond = plan.zones.find((z) => z.type === 'cristaux')!;
      const auFond = plan.elements.filter((e) => e.type === 'cristal-bleu' && e.z >= fond.z0 && e.z < fond.z1).length;
      expect(auFond).toBeGreaterThanOrEqual(6);
    }
  });

  it('laisse le passage : deux éléments ne se touchent pas et l\'arrivée est dégagée', () => {
    for (const graine of GRAINES) {
      const plan = creerPlanMine(graine);
      for (const a of plan.elements) {
        expect(Math.hypot(a.x - plan.arrivee.x, a.z - plan.arrivee.z)).toBeGreaterThan(3);
        for (const b of plan.elements) {
          if (a === b) continue;
          // Au moins la largeur du personnage entre deux éléments
          const jeu = Math.hypot(a.x - b.x, a.z - b.z) - a.rayonCollision - b.rayonCollision;
          expect(jeu).toBeGreaterThan(CONFIG.personnage.rayon * 2);
        }
      }
    }
  });

  it('entoure les galeries de murs : un cercle dans la roche est repoussé, pas dans une galerie', () => {
    const plan = creerPlanMine(12345);
    const a = plan.arrivee;
    const libres = rectanglesAutour(plan, a.x, a.z);
    expect(libres.every((r) => repousserHorsRectangle(a.x, a.z, CONFIG.personnage.rayon, r) === null)).toBe(true);
    // Deux mètres derrière la porte de sortie : de la roche
    const murs = rectanglesAutour(plan, plan.sortie.x, plan.sortie.z - 2);
    expect(murs.some((r) => repousserHorsRectangle(plan.sortie.x, plan.sortie.z - 2, CONFIG.personnage.rayon, r) !== null)).toBe(true);
    expect(estOuvert(plan, plan.origine.x - 5, plan.origine.z - 5)).toBe(false);
  });

  it('borne la caméra : elle recule librement dans l\'axe d\'une galerie, pas à travers un mur ni le plafond', () => {
    const plan = creerPlanMine(12345);
    const a = plan.arrivee;
    const y = plan.altitude + 1.6;
    // Vers le fond de la mine (+z) : la galerie principale est dans l'axe
    expect(distanceLibre(plan, a.x, y, a.z, 0, 0, 1, 4.6)).toBe(4.6);
    // Vers la sortie (-z) : le mur du fond de l'alcôve est à 7,5 m
    expect(distanceLibre(plan, a.x, y, a.z, 0, 0, -1, 12)).toBeLessThan(7.5);
    // Vers le haut : le plafond
    const plafond = hauteurPlafond(plan, a.x, a.z);
    expect(plafond).toBeGreaterThan(2.8);
    expect(distanceLibre(plan, a.x, y, a.z, 0, 1, 0, 12)).toBeLessThan(plafond - 1.6);
  });

  it('fait apparaître les ennemis loin du joueur, et pas avant le délai après leur mort', () => {
    const plan = creerPlanMine(12345);
    const joueur = { x: plan.arrivee.x, z: plan.arrivee.z };
    const tous = ennemisAFaireApparaitre(plan, new Set(), {}, 0, joueur);
    expect(tous).toHaveLength(plan.ennemis.length);
    const premier = plan.ennemis[0];
    expect(ennemisAFaireApparaitre(plan, new Set([premier.id]), {}, 0, joueur)).not.toContain(premier);
    expect(ennemisAFaireApparaitre(plan, new Set(), { [premier.id]: 100 }, 101, joueur)).not.toContain(premier);
    expect(ennemisAFaireApparaitre(plan, new Set(), { [premier.id]: 100 }, 100 + CONFIG.apparitions.delaiReapparition, joueur)).toContain(premier);
    // Joueur à côté du point : l'ennemi attend
    expect(ennemisAFaireApparaitre(plan, new Set(), {}, 0, { x: premier.x + 2, z: premier.z })).not.toContain(premier);
  });
});

describe('cristal bleu', () => {
  it('se récolte à la pioche en 10 coups et donne 1 à 2 cristaux et 18 XP', () => {
    expect(outilConseille('cristal-bleu')).toBe('pioche');
    expect(INFOS_RECOLTE['cristal-bleu'].pointsDeVie).toBe(10);
    expect(xpDestruction('cristal-bleu')).toBe(18);
    expect(definitionObjet('cristal-bleu').nom).toBe('cristaux bleus');
    let etat = creerEtatRecolte();
    const element = { id: 'm:0', type: 'cristal-bleu' as const };
    for (let coup = 1; coup <= 9; coup++) {
      const r = frapper(etat, element, 'pioche');
      expect(r.detruit).toBe(false);
      etat = r.etat;
    }
    const dernier = frapper(etat, element, 'pioche');
    expect(dernier.detruit).toBe(true);
    for (let n = 0; n < 40; n++) {
      const butin = tirerButin('cristal-bleu', `m:${n}`);
      expect(butin['cristal-bleu']).toBeGreaterThanOrEqual(1);
      expect(butin['cristal-bleu']).toBeLessThanOrEqual(2);
    }
  });

  it('repousse en un quart de journée dans la mine (comme les rochers et filons de la mine), une journée dehors', () => {
    const R = CONFIG.repousse;
    const jour = CONFIG.temps.dureeJourSecondes;
    expect(R.delaiMine).toBe(jour / 4);
    expect(delaiRepousse('cristal-bleu')).toBe(R.delaiRochers);
    const loin = { x: 0, z: 0 };
    const retires = [
      { id: 'm:4', instant: 0, type: 'rocher' as const, x: 500, z: 500 },
      { id: 'm:9', instant: 0, type: 'cristal-bleu' as const, x: 500, z: 500 },
      { id: 'd:1:1', instant: 0, type: 'rocher' as const, x: 500, z: 500 },
    ];
    expect(aReapparaitre(retires, jour / 4 - 1, loin)).toHaveLength(0);
    expect(aReapparaitre(retires, jour / 4, loin).map((r) => r.id)).toEqual(['m:4', 'm:9']);
    expect(aReapparaitre(retires, jour, loin)).toHaveLength(3);
  });
});
