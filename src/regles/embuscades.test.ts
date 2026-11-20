import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerAleatoire } from './aleatoire';
import type { MondeApparition } from './apparitions';
import { ETAPES_HISTOIRE, creerEtatHistoire } from './histoire';
import { creerEtatQuetes } from './quetes';
import {
  avancerCompteur,
  choisirGroupe,
  creerCompteur,
  delaiEffectif,
  objectifBanditsActif,
  positionCandidate,
  solValide,
  type CompteurEmbuscade,
  type SituationEmbuscade,
} from './embuscades';

const E = CONFIG.embuscades;

/** Joueur en pleine prairie, objectif actif, rien d'autre en cours. */
function situation(extra: Partial<SituationEmbuscade> = {}): SituationEmbuscade {
  return {
    objectifActif: true,
    distanceVillage: 200,
    dedans: false,
    biome: 'prairie',
    attaqueEnCours: false,
    distanceCamp: 500,
    morvanVaincu: false,
    nuit: false,
    groupePresent: false,
    ...extra,
  };
}

const monde: MondeApparition = { biome: () => 'prairie', hauteur: () => 10, niveauEau: 0 };
const compteurPret = (delai = 150): CompteurEmbuscade => ({ ecoule: 0, delai });

describe('objectif « tuer des bandits »', () => {
  const histoireNeutre = creerEtatHistoire();
  const etapeBandits = ETAPES_HISTOIRE.findIndex((e) => e.id === 'bandits-routes');

  it('aucun objectif : faux', () => {
    expect(objectifBanditsActif(creerEtatQuetes(), histoireNeutre)).toBe(false);
  });

  it('quête de bandits acceptée : vrai, jusqu\'à ce qu\'elle soit remplie', () => {
    const quetes = { ...creerEtatQuetes(), enCours: [{ id: 'voyageurs-detrousses', compteur: 1 }] };
    expect(objectifBanditsActif(quetes, histoireNeutre)).toBe(true);
    const remplie = { ...creerEtatQuetes(), enCours: [{ id: 'voyageurs-detrousses', compteur: 2 }] };
    expect(objectifBanditsActif(remplie, histoireNeutre)).toBe(false);
  });

  it('quête qui ne demande pas de bandits : faux', () => {
    const quetes = { ...creerEtatQuetes(), enCours: [{ id: 'nuisibles', compteur: 0 }] };
    expect(objectifBanditsActif(quetes, histoireNeutre)).toBe(false);
  });

  it('étape d\'histoire « bandits-routes » : vrai', () => {
    expect(etapeBandits).toBeGreaterThan(-1);
    expect(objectifBanditsActif(creerEtatQuetes(), { etape: etapeBandits, compteur: 1, vus: [] })).toBe(true);
  });
});

describe('compteur d\'embuscade', () => {
  const alea = () => creerAleatoire(42);

  it('délai tiré entre 120 et 240 s', () => {
    for (let graine = 1; graine <= 50; graine++) {
      const { delai } = creerCompteur(creerAleatoire(graine));
      expect(delai).toBeGreaterThanOrEqual(E.delaiMin);
      expect(delai).toBeLessThan(E.delaiMax);
    }
  });

  it('pas d\'embuscade sans objectif, et le compteur repart de zéro', () => {
    const r = avancerCompteur({ ecoule: 100, delai: 150 }, 1000, situation({ objectifActif: false }), alea());
    expect(r.declenche).toBe(false);
    expect(r.compteur.ecoule).toBe(0);
  });

  it.each([
    ['au village', { distanceVillage: 40 }],
    ['au bord du village', { distanceVillage: E.distanceMiniVillage }],
    ['dans la mine ou la maison', { dedans: true }],
    ['pendant une attaque du village', { attaqueEnCours: true }],
    ['près du camp avec Morvan en vie', { distanceCamp: 30 }],
    ['en montagne', { biome: 'montagne' as const }],
    ['quand un groupe est déjà là', { groupePresent: true }],
  ])('pas d\'embuscade %s', (_nom, extra) => {
    const r = avancerCompteur(compteurPret(), 10_000, situation(extra), alea());
    expect(r.declenche).toBe(false);
    expect(r.compteur).toEqual(compteurPret());
  });

  it('près du camp une fois Morvan vaincu : le compteur avance', () => {
    const r = avancerCompteur(compteurPret(), 10_000, situation({ distanceCamp: 30, morvanVaincu: true }), alea());
    expect(r.declenche).toBe(true);
  });

  it('embuscade une fois le délai écoulé, puis le compteur repart avec un nouveau délai', () => {
    let compteur = compteurPret(150);
    let r = avancerCompteur(compteur, 149, situation(), alea());
    expect(r.declenche).toBe(false);
    compteur = r.compteur;
    r = avancerCompteur(compteur, 2, situation(), alea());
    expect(r.declenche).toBe(true);
    expect(r.compteur.ecoule).toBe(0);
    expect(r.compteur.delai).toBeGreaterThanOrEqual(E.delaiMin);
    expect(r.compteur.delai).toBeLessThan(E.delaiMax);
  });

  it('délai plus court la nuit', () => {
    const c = compteurPret(200);
    expect(delaiEffectif(c, true)).toBeCloseTo(200 * E.facteurNuit);
    expect(delaiEffectif(c, true)).toBeLessThan(delaiEffectif(c, false));
    // 130 s : pas assez de jour, assez la nuit
    expect(avancerCompteur(c, 130, situation({ nuit: false }), alea()).declenche).toBe(false);
    expect(avancerCompteur(c, 130, situation({ nuit: true }), alea()).declenche).toBe(true);
  });

  it('un seul groupe à la fois : pas de nouveau déclenchement tant que le groupe est là', () => {
    const r = avancerCompteur({ ecoule: 0, delai: 130 }, 500, situation({ groupePresent: true }), alea());
    expect(r.declenche).toBe(false);
    expect(r.compteur.ecoule).toBe(0);
  });
});

describe('position de l\'embuscade', () => {
  const joueur = { x: 100, z: -50 };

  it('candidate dans l\'anneau 30-45 m, hors du champ de vision direct', () => {
    const alea = creerAleatoire(7);
    const orientation = 1.2;
    for (let i = 0; i < 300; i++) {
      const p = positionCandidate(joueur, orientation, alea);
      const distance = Math.hypot(p.x - joueur.x, p.z - joueur.z);
      expect(distance).toBeGreaterThanOrEqual(E.distanceMin - 1e-9);
      expect(distance).toBeLessThanOrEqual(E.distanceMax + 1e-9);
      // Écart avec le regard, ramené dans [0, π]
      const direction = Math.atan2(p.x - joueur.x, p.z - joueur.z);
      const ecart = Math.abs(Math.atan2(Math.sin(direction - orientation), Math.cos(direction - orientation)));
      expect(ecart).toBeGreaterThanOrEqual((E.angleMiniDegres * Math.PI) / 180 - 1e-9);
    }
  });

  it('sol invalide : village, eau, pente raide, zone sans ennemi', () => {
    expect(solValide(monde, 200, 0)).toBe(true);
    expect(solValide(monde, 0, 0)).toBe(false);
    expect(solValide({ ...monde, hauteur: (): number => -1 }, 200, 0)).toBe(false);
    expect(solValide({ ...monde, pente: () => 0.9 }, 200, 0)).toBe(false);
    expect(solValide({ ...monde, zonesSansEnnemi: [{ x: 200, z: 0, rayon: 10 }] }, 203, 3)).toBe(false);
  });

  it('groupe de 2 à 3 bandits sur sol valide, dans l\'anneau', () => {
    for (let graine = 1; graine <= 40; graine++) {
      const groupe = choisirGroupe(monde, joueur, 0, creerAleatoire(graine));
      expect(groupe).not.toBeNull();
      expect(groupe!.length).toBeGreaterThanOrEqual(E.groupeMin);
      expect(groupe!.length).toBeLessThanOrEqual(E.groupeMax);
      for (const p of groupe!) {
        const d = Math.hypot(p.x - joueur.x, p.z - joueur.z);
        expect(d).toBeGreaterThanOrEqual(E.distanceMin - E.ecartGroupe);
        expect(d).toBeLessThanOrEqual(E.distanceMax + E.ecartGroupe);
      }
    }
  });

  it('aucun groupe si tout autour est de l\'eau', () => {
    expect(choisirGroupe({ ...monde, hauteur: () => -5 }, joueur, 0, creerAleatoire(1))).toBeNull();
  });

  it('une zone sans ennemi couvrant tout le tour interdit l\'embuscade', () => {
    const zone = [{ x: joueur.x, z: joueur.z, rayon: 100 }];
    expect(choisirGroupe({ ...monde, zonesSansEnnemi: zone }, joueur, 0, creerAleatoire(1))).toBeNull();
  });
});
