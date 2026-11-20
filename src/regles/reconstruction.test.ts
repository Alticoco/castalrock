import { describe, expect, it } from 'vitest';
import { ETAPES_HISTOIRE } from './histoire';
import { creerEtatQuetes } from './quetes';
import { maisonsEndommagees } from './reconstruction';

const histoireA = (id: string) => ({ etape: ETAPES_HISTOIRE.findIndex((e) => e.id === id), compteur: 0, vus: [] as string[] });
const quetes = (...terminees: string[]) => ({ ...creerEtatQuetes(), terminees });

describe('maisons endommagées', () => {
  it('aucune avant l’étape « Rentre au village »', () => {
    expect(maisonsEndommagees(histoireA('trouver-aldric'), quetes())).toEqual(new Set());
  });

  it('les deux maisons de chaume dès l’étape « Rentre au village »', () => {
    expect(maisonsEndommagees(histoireA('rentrer-village'), quetes())).toEqual(new Set(['maison-2', 'maison-3']));
  });

  it('chaque maison est rebâtie quand sa quête est rendue', () => {
    expect(maisonsEndommagees(histoireA('relever-village'), quetes('murs-hiver'))).toEqual(new Set(['maison-3']));
    expect(maisonsEndommagees(histoireA('relever-village'), quetes('murs-hiver', 'ventre-batisseurs', 'toit-chasseur'))).toEqual(new Set());
  });

  it('plus rien après la fin de l’histoire', () => {
    expect(maisonsEndommagees({ etape: ETAPES_HISTOIRE.length, compteur: 0, vus: [] }, quetes('murs-hiver', 'toit-chasseur'))).toEqual(new Set());
  });
});
