import { describe, expect, it } from 'vitest';
import { ajouterPointSur, choisirPointDeRetour, type PointSur } from './pointSur';

const R = { taille: 3, ecartHauteur: 1.5, distanceMin: 8, recul: 1.5 };
const oui = () => true;
const repli = { x: 100, z: 100 };

describe('ajouterPointSur', () => {
  it('garde les derniers points seulement', () => {
    let h: PointSur[] = [];
    for (let i = 0; i < 5; i++) h = ajouterPointSur(h, { x: i, y: 0, z: 0 }, R.taille);
    expect(h.map((p) => p.x)).toEqual([2, 3, 4]);
  });
  it('ne modifie pas l\'ancien historique', () => {
    const h: PointSur[] = [];
    ajouterPointSur(h, { x: 1, y: 0, z: 0 }, 3);
    expect(h).toHaveLength(0);
  });
});

describe('choisirPointDeRetour', () => {
  it('prend le plus récent point plus haut d\'au moins 1,5 m, reculé', () => {
    const h: PointSur[] = [
      { x: 0, y: 10, z: 0 },
      { x: 5, y: 10, z: 0 },
      { x: 6, y: 8.5, z: 0 }, // trop proche en hauteur (écart 0,5 m)
    ];
    const r = choisirPointDeRetour(h, { x: 6, y: 8, z: 0 }, repli, R, oui);
    expect(r.x).toBeCloseTo(5 - 1.5); // le joueur est à x=6 : le recul va vers x décroissant
  });
  it('recule dans le sens opposé à la chute', () => {
    const h: PointSur[] = [{ x: 0, y: 10, z: 0 }];
    const r = choisirPointDeRetour(h, { x: 4, y: 5, z: 0 }, repli, R, oui);
    expect(r.x).toBeCloseTo(-1.5);
    expect(r.z).toBeCloseTo(0);
  });
  it('ne recule pas si la pente est trop raide', () => {
    const h: PointSur[] = [{ x: 0, y: 10, z: 0 }];
    const r = choisirPointDeRetour(h, { x: 4, y: 5, z: 0 }, repli, R, () => false);
    expect(r).toEqual({ x: 0, z: 0 });
  });
  it('sinon prend le plus récent point à plus de 8 m', () => {
    const h: PointSur[] = [
      { x: 20, y: 0, z: 0 },
      { x: 2, y: 0, z: 0 },
    ];
    const r = choisirPointDeRetour(h, { x: 0, y: 0, z: 0 }, repli, R, () => false);
    expect(r).toEqual({ x: 20, z: 0 });
  });
  it('sinon renvoie le repli', () => {
    expect(choisirPointDeRetour([{ x: 1, y: 0, z: 0 }], { x: 0, y: 0, z: 0 }, repli, R, oui)).toEqual(repli);
    expect(choisirPointDeRetour([], { x: 0, y: 0, z: 0 }, repli, R, oui)).toEqual(repli);
  });
});
