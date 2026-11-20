import { describe, expect, it } from 'vitest';
import { EMPLACEMENTS_BARRE, TOUCHES_BARRE, emplacementApresTouche, emplacementDeTouche, emplacementVoisin, estOutil } from './barreOutils';

describe('barre d\'outils', () => {
  it('relie les touches 1 à 6 (rangée de chiffres et pavé numérique) aux emplacements', () => {
    expect(emplacementDeTouche('Digit1')).toBe('epee');
    expect(emplacementDeTouche('Digit2')).toBe('hache');
    expect(emplacementDeTouche('Numpad3')).toBe('pioche');
    expect(emplacementDeTouche('Numpad4')).toBe('arc');
    expect(emplacementDeTouche('Digit5')).toBe('torche');
    expect(emplacementDeTouche('Numpad5')).toBe('torche');
    expect(emplacementDeTouche('Digit6')).toBe('pousse');
  });

  it('donne une touche de chaque rangée à chaque emplacement', () => {
    expect(TOUCHES_BARRE).toHaveLength(EMPLACEMENTS_BARRE.length * 2);
    expect(TOUCHES_BARRE).toContain('Digit5');
    expect(TOUCHES_BARRE).toContain('Numpad5');
    for (const code of TOUCHES_BARRE) expect(emplacementDeTouche(code)).not.toBeNull();
  });

  it('ignore les autres touches', () => {
    expect(emplacementDeTouche('Digit7')).toBeNull();
    expect(emplacementDeTouche('Numpad7')).toBeNull();
    expect(emplacementDeTouche('Digit0')).toBeNull();
    expect(emplacementDeTouche('KeyQ')).toBeNull();
  });

  it('la molette passe à l\'emplacement suivant ou précédent, en bouclant', () => {
    expect(emplacementVoisin('epee', 1)).toBe('hache');
    expect(emplacementVoisin('pioche', 1)).toBe('arc');
    expect(emplacementVoisin('torche', 1)).toBe('pousse');
    expect(emplacementVoisin('pousse', 1)).toBe('epee');
    expect(emplacementVoisin('epee', -1)).toBe('pousse');
    expect(emplacementVoisin('pousse', -1)).toBe('torche');
    expect(emplacementVoisin('pioche', -1)).toBe('hache');
    expect(EMPLACEMENTS_BARRE).toHaveLength(6);
  });

  it('la torche et les pousses ne sont pas des outils qui frappent', () => {
    expect(estOutil('torche')).toBe(false);
    expect(estOutil('pousse')).toBe(false);
    expect(EMPLACEMENTS_BARRE.filter(estOutil)).toEqual(['epee', 'hache', 'pioche']);
  });
});

describe('barre d outils : objets posables de la case 6', () => {
  it('rappuyer sur 6 passe de la pousse au piège et inversement', () => {
    expect(emplacementApresTouche('epee', 'Digit6')).toBe('pousse');
    expect(emplacementApresTouche('pousse', 'Digit6')).toBe('piege');
    expect(emplacementApresTouche('piege', 'Digit6')).toBe('pousse');
    expect(emplacementApresTouche('piege', 'Numpad2')).toBe('hache');
    expect(emplacementApresTouche('pousse', 'KeyQ')).toBeNull();
  });

  it("le piège n'est pas un outil, et la molette le traite comme la case 6", () => {
    expect(estOutil('piege')).toBe(false);
    expect(emplacementVoisin('piege', 1)).toBe('epee');
    expect(emplacementVoisin('piege', -1)).toBe('torche');
  });

  it("la case 4 est l'arc : touche 4, molette, et la molette la saute tant que l'arc n'est pas possédé", () => {
    expect(emplacementDeTouche('Digit4')).toBe('arc');
    expect(emplacementDeTouche('Numpad4')).toBe('arc');
    expect(TOUCHES_BARRE).toContain('Digit4');
    expect(TOUCHES_BARRE).toContain('Numpad4');
    expect(estOutil('arc')).toBe(false);
    expect(emplacementVoisin('arc', 1)).toBe('torche');
    expect(emplacementVoisin('arc', -1)).toBe('pioche');
    expect(emplacementVoisin('pioche', 1, true)).toBe('torche');
    expect(emplacementVoisin('torche', -1, true)).toBe('pioche');
    expect(emplacementVoisin('hache', 1, true)).toBe('pioche');
    expect(emplacementVoisin('epee', -1, true)).toBe('pousse');
  });
});
