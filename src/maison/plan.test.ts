import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { contientZoneMine } from '../mine/plan';
import { repousserHorsRectangle } from '../regles/deplacement';
import { interactionVisee } from '../regles/village';
import { contientZoneMaison, creerPlanMaison, dansLaPiece, distanceLibre, estLibre } from './plan';

const plan = creerPlanMaison();
const RAYON = CONFIG.personnage.rayon;

/** Vrai si un personnage posé en (x, z) touche un mur ou un meuble. */
function touche(x: number, z: number): boolean {
  return plan.rectangles.some((r) => repousserHorsRectangle(x, z, RAYON, r) !== null);
}

describe('plan de la maison', () => {
  it('est une pièce d’environ 8 × 6 m, loin du monde et de la mine', () => {
    expect(plan.largeur).toBeGreaterThanOrEqual(7);
    expect(plan.largeur).toBeLessThanOrEqual(9);
    expect(plan.profondeur).toBeGreaterThanOrEqual(5);
    expect(plan.profondeur).toBeLessThanOrEqual(7);
    expect(Math.hypot(plan.origine.x, plan.origine.z)).toBeGreaterThan(10000);
    expect(contientZoneMaison(plan.origine.x, plan.origine.z)).toBe(true);
    expect(contientZoneMaison(0, 0)).toBe(false);
    // Les deux zones intérieures ne se recouvrent pas
    for (const dx of [-30, 0, 30]) {
      for (const dz of [-30, 0, 30]) expect(contientZoneMine(plan.origine.x + dx, plan.origine.z + dz)).toBe(false);
    }
    expect(contientZoneMaison(CONFIG.mine.origine.x, CONFIG.mine.origine.z)).toBe(false);
  });

  it('est toujours le même', () => {
    expect(creerPlanMaison()).toEqual(plan);
  });

  it('contient un lit, un coffre, une cheminée, une table, des bancs, des étagères et un tapis', () => {
    const types = plan.meubles.map((m) => m.type);
    for (const t of ['lit', 'coffre', 'cheminee', 'table', 'banc', 'etagere', 'tapis'] as const) expect(types).toContain(t);
  });

  it('garde tous les meubles dans la pièce, sans qu’ils se chevauchent', () => {
    const solides = plan.meubles.filter((m) => m.solide);
    for (const m of plan.meubles) {
      expect(dansLaPiece(plan, m.x - m.demiLargeur, m.z - m.demiProfondeur)).toBe(true);
      expect(dansLaPiece(plan, m.x + m.demiLargeur, m.z + m.demiProfondeur)).toBe(true);
    }
    for (const a of solides) {
      for (const b of solides) {
        if (a === b) continue;
        const separes = Math.abs(a.x - b.x) >= a.demiLargeur + b.demiLargeur || Math.abs(a.z - b.z) >= a.demiProfondeur + b.demiProfondeur;
        expect(separes, `${a.id} / ${b.id}`).toBe(true);
      }
    }
  });

  it('fait arriver le joueur devant la porte, à un endroit libre, tourné vers la cheminée', () => {
    const a = plan.arrivee;
    expect(estLibre(plan, a.x, a.z)).toBe(true);
    expect(touche(a.x, a.z)).toBe(false);
    expect(Math.hypot(a.x - plan.porte.x, a.z - plan.porte.z)).toBeLessThan(1.5);
    // Orientation π : le regard va vers -z, où se trouve la cheminée
    const cheminee = plan.meubles.find((m) => m.type === 'cheminee')!;
    expect(Math.cos(a.orientation)).toBeCloseTo(-1);
    expect(cheminee.z).toBeLessThan(a.z);
  });

  it('enferme le joueur : les murs arrêtent un personnage sur tout le pourtour', () => {
    const dl = plan.largeur / 2;
    const dp = plan.profondeur / 2;
    for (let t = -1; t <= 1; t += 0.05) {
      expect(touche(plan.origine.x + t * dl, plan.origine.z - dp - 0.1)).toBe(true);
      expect(touche(plan.origine.x + t * dl, plan.origine.z + dp + 0.1)).toBe(true);
      expect(touche(plan.origine.x - dl - 0.1, plan.origine.z + t * dp)).toBe(true);
      expect(touche(plan.origine.x + dl + 0.1, plan.origine.z + t * dp)).toBe(true);
    }
    expect(touche(plan.origine.x, plan.origine.z)).toBe(false);
  });

  it('arrête le joueur sur les meubles, pas sur le tapis', () => {
    const lit = plan.meubles.find((m) => m.type === 'lit')!;
    const tapis = plan.meubles.find((m) => m.type === 'tapis')!;
    expect(touche(lit.x, lit.z)).toBe(true);
    expect(estLibre(plan, lit.x, lit.z)).toBe(false);
    expect(touche(tapis.x, tapis.z)).toBe(false);
    expect(estLibre(plan, tapis.x, tapis.z)).toBe(true);
  });

  it('propose le lit, le coffre, la cheminée et la porte, chacun atteignable depuis un endroit libre', () => {
    expect(plan.interactions.map((p) => p.type).sort()).toEqual(['cheminee', 'coffre', 'lit', 'maison']);
    const portee = CONFIG.village.porteeInteraction;
    const demiAngle = (CONFIG.village.angleRegardDegres * Math.PI) / 180;
    for (const p of plan.interactions) {
      let trouve = false;
      for (let x = -3.6; x <= 3.6 && !trouve; x += 0.2) {
        for (let z = -2.6; z <= 2.6 && !trouve; z += 0.2) {
          const px = plan.origine.x + x;
          const pz = plan.origine.z + z;
          if (touche(px, pz)) continue;
          const regard = Math.atan2(p.x - px, p.z - pz);
          trouve = interactionVisee(plan.interactions, px, pz, regard, portee, demiAngle) === p;
        }
      }
      expect(trouve, p.invite).toBe(true);
    }
  });

  it('retient la caméra de 3e personne avant les murs et le plafond', () => {
    const { x, z } = plan.origine;
    const y = plan.altitude + 1.6;
    // Vers le mur est : 4 m jusqu'au mur, moins la marge
    const versEst = distanceLibre(plan, x, y, z, 1, 0, 0, 10);
    expect(versEst).toBeGreaterThan(3);
    expect(versEst).toBeLessThan(plan.largeur / 2);
    // Vers le haut : le plafond
    const versHaut = distanceLibre(plan, x, y, z, 0, 1, 0, 10);
    expect(versHaut).toBeLessThan(plan.hauteur - 1.6);
    // Courte distance : rien ne gêne
    expect(distanceLibre(plan, x, y, z, 0, 0, 1, 1)).toBe(1);
  });
});
