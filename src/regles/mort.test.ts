import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerEquipement } from './equipement';
import { ajouter, compter, creerConteneur } from './inventaire';
import {
  POINT_REAPPARITION_DEFAUT,
  appliquerMort,
  baluchonAPortee,
  definirPointReapparition,
  deposerBaluchon,
  distanceBaluchon,
  recupererBaluchon,
  type Baluchon,
} from './mort';
import { APPARITION } from './village';

function porte() {
  let c = creerConteneur(4);
  c = ajouter(c, 'bois', 12).conteneur;
  c = ajouter(c, 'pierre', 3).conteneur;
  return c;
}

describe('mort douce : baluchon', () => {
  it("dépose tout l'inventaire porté à l'endroit de la mort et le vide", () => {
    const r = deposerBaluchon(porte(), 5, -2, null);
    expect(r.baluchon).toEqual({ x: 5, z: -2, contenu: [{ objet: 'bois', quantite: 12 }, { objet: 'pierre', quantite: 3 }] });
    expect(r.inventaire.cases).toHaveLength(4);
    expect(r.inventaire.cases.every((c) => c === null)).toBe(true);
  });

  it("n'en crée pas si l'inventaire est vide, et ne touche pas à l'inventaire reçu", () => {
    const inv = porte();
    deposerBaluchon(inv, 0, 0, null);
    expect(compter(inv, 'bois')).toBe(12);
    expect(deposerBaluchon(creerConteneur(4), 1, 1, null).baluchon).toBeNull();
  });

  it("fusionne l'ancien baluchon dans le nouveau, qui est à la nouvelle position", () => {
    const ancien: Baluchon = { x: 100, z: 100, contenu: [{ objet: 'bois', quantite: 30 }, { objet: 'fibres', quantite: 2 }] };
    const r = deposerBaluchon(porte(), 5, -2, ancien);
    expect(r.baluchon!.x).toBe(5);
    expect(r.baluchon!.contenu).toEqual([
      { objet: 'bois', quantite: 42 },
      { objet: 'fibres', quantite: 2 },
      { objet: 'pierre', quantite: 3 },
    ]);
  });

  it("garde l'ancien baluchon en place si rien n'est porté", () => {
    const ancien: Baluchon = { x: 100, z: 100, contenu: [{ objet: 'bois', quantite: 30 }] };
    expect(deposerBaluchon(creerConteneur(4), 5, 5, ancien).baluchon).toEqual(ancien);
  });

  it("récupère tout dans l'inventaire et le baluchon disparaît", () => {
    const b = deposerBaluchon(porte(), 0, 0, null).baluchon!;
    const r = recupererBaluchon(creerConteneur(4), b);
    expect(r.baluchon).toBeNull();
    expect(r.recupere).toBe(15);
    expect(r.reste).toBe(0);
    expect(compter(r.inventaire, 'bois')).toBe(12);
  });

  it('récupération partielle : ce qui ne rentre pas reste dans le baluchon', () => {
    const b: Baluchon = { x: 0, z: 0, contenu: [{ objet: 'bois', quantite: 70 }, { objet: 'pierre', quantite: 5 }] };
    // Une seule case : une pile de bois, plus de place pour la pierre
    const pile = CONFIG.inventaire.pileMax;
    const r = recupererBaluchon(creerConteneur(1), b);
    expect(compter(r.inventaire, 'bois')).toBe(pile);
    expect(r.baluchon!.contenu).toEqual([{ objet: 'bois', quantite: 70 - pile }, { objet: 'pierre', quantite: 5 }]);
    expect(r.recupere).toBe(pile);
    expect(r.reste).toBe(75 - pile);
  });

  it('distance et portée', () => {
    const b: Baluchon = { x: 3, z: 4, contenu: [{ objet: 'bois', quantite: 1 }] };
    expect(distanceBaluchon(b, 0, 0)).toBe(5);
    expect(baluchonAPortee(b, 0, 0)).toBe(false);
    expect(baluchonAPortee(b, 2, 3)).toBe(true);
  });
});

describe('mort douce : appliquerMort', () => {
  it("dépose le baluchon, use tout l'équipement de 10 et laisse le reste intact", () => {
    const equipement = { ...creerEquipement(), armure: 'fibres' as const };
    const r = appliquerMort({ inventaire: porte(), equipement, baluchon: null }, 1, 2);
    expect(r.baluchon).not.toBeNull();
    expect(compter(r.inventaire, 'bois')).toBe(0);
    const u = CONFIG.durabilite.max - CONFIG.durabilite.usureMort;
    expect(r.equipement.durabilite).toEqual({ hache: u, pioche: u, epee: u, armure: u });
    expect(r.equipement.armure).toBe('fibres');
    expect(r.equipement.outils).toEqual(equipement.outils);
  });
});

describe('point de réapparition', () => {
  it('est la place du village par défaut et peut être redéfini', () => {
    expect(POINT_REAPPARITION_DEFAUT).toMatchObject({ x: APPARITION.x, z: APPARITION.z });
    expect(definirPointReapparition(4, 5, 'Auberge')).toEqual({ x: 4, z: 5, nom: 'Auberge' });
  });
});
