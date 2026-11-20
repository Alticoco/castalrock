import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { NOMBRE_EMPLACEMENTS, cleEmplacement, lireNumeroEmplacement, resumeEmplacement } from './emplacements';
import { ETAPES_HISTOIRE } from './histoire';

/** Sauvegarde valide obtenue en repartant d'une partie neuve construite à la main puis modifiée. */
function partie(modifs: (d: Record<string, unknown>) => void): string {
  const d = JSON.parse(neuve()) as Record<string, unknown>;
  modifs(d);
  return JSON.stringify(d);
}

import { creerEtatHistoire } from './histoire';
import { creerProgression } from './progression';
import { creerEtatQuetes } from './quetes';
import { creerEtatMarchand } from './marchand';
import { creerEtatAttaques } from './attaques';
import { creerEtatLieux } from './lieux';
import { creerEtatPotager } from './potager';
import { creerEquipement } from './equipement';
import { POINT_REAPPARITION_DEFAUT } from './mort';
import { VERSION_SAUVEGARDE } from './sauvegarde';

function neuve(): string {
  const cases = (n: number) => ({ cases: Array.from({ length: n }, () => null) });
  return JSON.stringify({
    version: VERSION_SAUVEGARDE,
    graine: CONFIG.graine,
    personnage: { x: 0, y: 0, z: 0, orientation: 0 },
    vue: 'premiere',
    tempsJeu: 0,
    inventaire: cases(10),
    sac: cases(10),
    retires: [],
    plantes: [],
    compteurPlantes: 0,
    coffre: cases(10),
    niveauVillage: 1,
    equipement: creerEquipement(),
    vie: 100,
    baluchon: null,
    pointReapparition: POINT_REAPPARITION_DEFAUT,
    progression: creerProgression(),
    quetes: creerEtatQuetes(),
    histoire: creerEtatHistoire(),
    marchand: creerEtatMarchand(),
    attaques: creerEtatAttaques(),
    lieux: creerEtatLieux(),
    tresorsOuverts: [],
    potager: creerEtatPotager(),
    feuCamp: null,
    pieges: [],
    reperes: { reperes: [], suivi: null },
    mine: { dedans: false, visitee: false },
  });
}

describe('emplacements', () => {
  it('trois emplacements', () => {
    expect(NOMBRE_EMPLACEMENTS).toBe(3);
  });

  it("l'emplacement 1 garde la clé de base, les autres ajoutent le numéro", () => {
    expect(cleEmplacement('castalrock.sauvegarde', 1)).toBe('castalrock.sauvegarde');
    expect(cleEmplacement('castalrock.sauvegarde', 2)).toBe('castalrock.sauvegarde.2');
    expect(cleEmplacement('castalrock.sauvegarde', 3)).toBe('castalrock.sauvegarde.3');
  });

  it('numéro absent ou invalide : 1', () => {
    expect(lireNumeroEmplacement(null)).toBe(1);
    expect(lireNumeroEmplacement('')).toBe(1);
    expect(lireNumeroEmplacement('abc')).toBe(1);
    expect(lireNumeroEmplacement('0')).toBe(1);
    expect(lireNumeroEmplacement('4')).toBe(1);
    expect(lireNumeroEmplacement('2.5')).toBe(1);
    expect(lireNumeroEmplacement('-2')).toBe(1);
  });

  it('numéro valide conservé', () => {
    expect(lireNumeroEmplacement('1')).toBe(1);
    expect(lireNumeroEmplacement('2')).toBe(2);
    expect(lireNumeroEmplacement('3')).toBe(3);
  });

  it('résumé : emplacement vide ou texte abîmé = null', () => {
    expect(resumeEmplacement(null, CONFIG.graine)).toBeNull();
    expect(resumeEmplacement('', CONFIG.graine)).toBeNull();
    expect(resumeEmplacement('{pas du json', CONFIG.graine)).toBeNull();
    expect(resumeEmplacement('{"version":1}', CONFIG.graine)).toBeNull();
  });

  it("résumé : autre graine = null", () => {
    expect(resumeEmplacement(neuve(), CONFIG.graine + 1)).toBeNull();
  });

  it('résumé : partie neuve', () => {
    expect(resumeEmplacement(neuve(), CONFIG.graine)).toBe('Niveau 1 · Prologue · Jour 1');
  });

  it('résumé : le jour avance avec le temps de jeu', () => {
    const texte = partie((d) => {
      d.tempsJeu = CONFIG.temps.dureeJourSecondes * 13 + 5;
    });
    expect(resumeEmplacement(texte, CONFIG.graine)).toBe('Niveau 1 · Prologue · Jour 14');
  });

  it('résumé : partie finie', () => {
    const texte = partie((d) => {
      d.histoire = { etape: ETAPES_HISTOIRE.length, compteur: 0, vus: [] };
    });
    expect(resumeEmplacement(texte, CONFIG.graine)).toBe('Niveau 1 · Histoire terminée · Jour 1');
  });
});
