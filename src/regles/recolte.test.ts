import { describe, expect, it } from 'vitest';
import {
  creerEtatRecolte,
  frapper,
  messageVerrouPioche,
  peutRecolter,
  ORDRE_RESSOURCES,
  outilConseille,
  tirerButin,
  type EtatRecolte,
  type OutilRecolte,
  type TypeRecoltable,
} from './recolte';

/** Frappe jusqu'à destruction ; renvoie le nombre de coups. */
function coupsPourDetruire(type: TypeRecoltable, outil: OutilRecolte, id = 'a'): number {
  let etat: EtatRecolte = creerEtatRecolte();
  for (let n = 1; n <= 100; n++) {
    const r = frapper(etat, { id, type }, outil, 1);
    etat = r.etat;
    if (r.detruit) return n;
  }
  throw new Error('jamais détruit');
}

describe('nombre de coups', () => {
  it('avec l\'outil adapté', () => {
    expect(coupsPourDetruire('arbre-feuillu', 'hache')).toBe(5);
    expect(coupsPourDetruire('sapin', 'hache')).toBe(5);
    expect(coupsPourDetruire('rocher', 'pioche')).toBe(6);
    expect(coupsPourDetruire('filon-fer', 'pioche')).toBe(8);
  });
  it('un coup suffit pour les petites plantes, avec n\'importe quel outil', () => {
    for (const type of ['buisson-baies', 'plante-medicinale', 'fibres'] as const) {
      for (const outil of ['hache', 'pioche', 'epee'] as const) {
        expect(coupsPourDetruire(type, outil)).toBe(1);
      }
    }
  });
  it('un outil non adapté est trois fois plus lent', () => {
    expect(coupsPourDetruire('arbre-feuillu', 'pioche')).toBe(15);
    expect(coupsPourDetruire('sapin', 'epee')).toBe(15);
    expect(coupsPourDetruire('rocher', 'hache')).toBe(18);
    expect(coupsPourDetruire('filon-fer', 'epee')).toBe(24);
  });
});

describe('butin', () => {
  it('est reproductible pour une graine et un identifiant', () => {
    expect(tirerButin('arbre-feuillu', 'x', 7)).toEqual(tirerButin('arbre-feuillu', 'x', 7));
  });
  it('reste dans les bornes', () => {
    for (let i = 0; i < 200; i++) {
      const id = `e${i}`;
      const arbre = tirerButin('bouleau', id, 42);
      expect(arbre.bois).toBeGreaterThanOrEqual(3);
      expect(arbre.bois).toBeLessThanOrEqual(5);
      expect(arbre['pousse-arbre'] ?? 0).toBeLessThanOrEqual(1);
      const roche = tirerButin('rocher', id, 42).pierre!;
      expect(roche).toBeGreaterThanOrEqual(2);
      expect(roche).toBeLessThanOrEqual(4);
      const filon = tirerButin('filon-fer', id, 42);
      expect(filon['minerai-fer']).toBeGreaterThanOrEqual(2);
      expect(filon['minerai-fer']).toBeLessThanOrEqual(3);
      expect(filon.pierre).toBe(1);
      const baies = tirerButin('buisson-baies', id, 42).baies!;
      expect(baies >= 2 && baies <= 3).toBe(true);
      const plante = tirerButin('plante-medicinale', id, 42)['plante-medicinale']!;
      expect(plante >= 1 && plante <= 2).toBe(true);
      const fibres = tirerButin('fibres', id, 42).fibres!;
      expect(fibres >= 2 && fibres <= 3).toBe(true);
    }
  });
  it('varie d\'un élément à l\'autre', () => {
    const valeurs = new Set<number>();
    for (let i = 0; i < 50; i++) valeurs.add(tirerButin('arbre-feuillu', `e${i}`, 42).bois!);
    expect(valeurs.size).toBeGreaterThan(1);
  });
});

describe('destruction', () => {
  it('n\'arrive qu\'une seule fois et ne donne le butin qu\'une fois', () => {
    let etat: EtatRecolte = creerEtatRecolte();
    let destructions = 0;
    let bois = 0;
    for (let i = 0; i < 20; i++) {
      const r = frapper(etat, { id: 'arbre1', type: 'sapin' }, 'hache', 1);
      etat = r.etat;
      if (r.detruit) destructions++;
      bois += r.butin.bois ?? 0;
    }
    expect(destructions).toBe(1);
    expect(bois).toBe(tirerButin('sapin', 'arbre1', 1).bois);
  });
  it('les éléments sont indépendants', () => {
    let etat: EtatRecolte = creerEtatRecolte();
    etat = frapper(etat, { id: 'a', type: 'rocher' }, 'pioche', 1).etat;
    const r = frapper(etat, { id: 'b', type: 'rocher' }, 'pioche', 1);
    expect(r.restants).toBe(5);
  });
  it('l\'herbe ne se récolte pas', () => {
    const r = frapper(creerEtatRecolte(), { id: 'h', type: 'herbe' }, 'hache', 1);
    expect(r.detruit).toBe(false);
    expect(r.butin).toEqual({});
  });
});

describe('outils et ressources', () => {
  it('choix de l\'outil', () => {
    expect(outilConseille('sapin')).toBe('hache');
    expect(outilConseille('rocher')).toBe('pioche');
    expect(outilConseille('filon-fer')).toBe('pioche');
    expect(outilConseille('fibres')).toBeNull();
    expect(outilConseille('herbe')).toBeNull();
  });
});

describe('verrous de pioche et nouveaux filons', () => {
  it('le cuivre se récolte avec toute pioche ; le fer et le charbon demandent le cuivre ; le cristal le fer', () => {
    expect(peutRecolter('filon-cuivre', 'base')).toBe(true);
    expect(peutRecolter('filon-fer', 'base')).toBe(false);
    expect(peutRecolter('filon-charbon', 'base')).toBe(false);
    expect(peutRecolter('filon-fer', 'cuivre')).toBe(true);
    expect(peutRecolter('filon-charbon', 'cuivre')).toBe(true);
    expect(peutRecolter('cristal-bleu', 'cuivre')).toBe(false);
    expect(peutRecolter('cristal-bleu', 'fer')).toBe(true);
    expect(peutRecolter('cristal-bleu', 'cristal')).toBe(true);
    expect(peutRecolter('rocher', 'base')).toBe(true);
    expect(peutRecolter('sapin', 'base')).toBe(true);
  });

  it('messages clairs', () => {
    expect(messageVerrouPioche('filon-fer')).toBe('Il faut une pioche en cuivre');
    expect(messageVerrouPioche('filon-charbon')).toBe('Il faut une pioche en cuivre');
    expect(messageVerrouPioche('cristal-bleu')).toBe('Il faut une pioche en fer');
  });

  it('butin du cuivre et du charbon', () => {
    const cuivre = tirerButin('filon-cuivre', 'd:1:1');
    expect(cuivre['minerai-cuivre']).toBeGreaterThanOrEqual(2);
    expect(cuivre['minerai-cuivre']).toBeLessThanOrEqual(3);
    const charbon = tirerButin('filon-charbon', 'd:2:2');
    expect(charbon.charbon).toBeGreaterThanOrEqual(2);
    expect(charbon.charbon).toBeLessThanOrEqual(4);
    expect(ORDRE_RESSOURCES).toContain('minerai-cuivre');
    expect(ORDRE_RESSOURCES).toContain('charbon');
  });
});
