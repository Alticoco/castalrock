import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ID_MORVAN, creerEtatChef, estChef, pasChef, ratioVieChef, type EtatChef } from './chef';
import { INFOS_ENNEMIS, creerEnnemi, etourdirEnnemi, frapperEnnemi, tirerButinEnnemi, type ContexteEnnemi, type EtatEnnemi } from './combat';
import { resoudreParade } from './bouclier';
import { xpEnnemi } from './progression';

const K = CONFIG.chefs.morvan;
const G = K.charge;
const DT = 1 / 60;

function contexte(x: number, z: number, vivant = true): ContexteEnnemi {
  return { joueur: { x, z, vivant }, monde: { hauteur: () => 0, niveauEau: -10, obstacles: [] }, rayonVillage: 0 };
}

/** Morvan loin de l'origine (hors de tout village), tourné vers +z. */
function morvan(surcharge: Partial<EtatEnnemi> = {}): EtatEnnemi {
  return { ...creerEnnemi(ID_MORVAN, 'morvan', 500, 500), orientation: 0, ...surcharge };
}

/** Fait vivre Morvan `duree` secondes ; renvoie l'état final et ce qui s'est passé en route. */
function vivre(etat: EtatEnnemi, chef: EtatChef, ctx: ContexteEnnemi, duree: number) {
  let e = etat;
  let c = chef;
  let degats = 0;
  let appels = 0;
  let recommence = 0;
  const coups: number[] = [];
  for (let t = 0; t < duree; t += DT) {
    const r = pasChef(e, c, ctx, DT);
    e = r.etat;
    c = r.chef;
    degats += r.degats;
    if (r.degats > 0) coups.push(r.degats);
    if (r.appel) appels += 1;
    if (r.recommence) recommence += 1;
  }
  return { etat: e, chef: c, degats, coups, appels, recommence };
}

const pret: EtatChef = { ...creerEtatChef(), rechargeCharge: 0 };
const sansCharge: EtatChef = { ...creerEtatChef(), rechargeCharge: 999 };

describe('chef : Morvan le Balafré', () => {
  it('est un chef, environ 5 fois plus résistant qu’un bandit et plus lent à frapper', () => {
    expect(estChef('morvan')).toBe(true);
    expect(estChef('bandit')).toBe(false);
    expect(INFOS_ENNEMIS.morvan.pv).toBe(CONFIG.ennemis.bandit.pv * 5);
    expect(INFOS_ENNEMIS.morvan.dureeAnticipation).toBeCloseTo(0.8, 5);
    expect(INFOS_ENNEMIS.morvan.degats).toBeGreaterThan(CONFIG.ennemis.bandit.degats * 2);
    expect(xpEnnemi('morvan')).toBeGreaterThan(xpEnnemi('bandit'));
  });

  it('lâche toujours l’Éclat du Cœur et de l’or', () => {
    for (const cle of ['a', 'b', 'c:12']) {
      const butin = tirerButinEnnemi('morvan', cle);
      expect(butin['eclat-coeur']).toBe(1);
      expect(butin.or).toBeGreaterThanOrEqual(60);
    }
  });

  it('ne fait rien de spécial pour un ennemi qui n’est pas un chef', () => {
    const bandit = creerEnnemi('b', 'bandit', 500, 500);
    const r = pasChef(bandit, pret, contexte(500, 510), DT);
    expect(r.etat).toBe(bandit);
    expect(r.degats).toBe(0);
  });
});

describe('chef : coup lourd', () => {
  it('s’annonce pendant 0,8 s avant de frapper fort', () => {
    const depart = morvan({ phase: 'poursuite' });
    const ctx = contexte(500, 502);
    // Juste avant la fin de l'annonce : la hache est levée, aucun dégât
    const avant = vivre(depart, sansCharge, ctx, 0.75);
    expect(avant.etat.phase).toBe('anticipation');
    expect(avant.degats).toBe(0);
    const apres = vivre(avant.etat, avant.chef, ctx, 0.2);
    expect(apres.coups).toEqual([INFOS_ENNEMIS.morvan.degats]);
    expect(apres.etat.phase).toBe('attaque');
  });

  it('est esquivé en reculant hors de portée pendant l’annonce', () => {
    const avant = vivre(morvan({ phase: 'poursuite' }), sansCharge, contexte(500, 502), 0.5);
    expect(avant.etat.phase).toBe('anticipation');
    const apres = vivre(avant.etat, avant.chef, contexte(500, 500 + INFOS_ENNEMIS.morvan.porteeCoup + 1.5), 0.4);
    expect(apres.degats).toBe(0);
  });

  it('le bouclier levé de face en retire sa part : tout avec « Bouclier solide », et la parade au bon moment est réussie', () => {
    const coup = { brut: INFOS_ENNEMIS.morvan.degats, deFace: true, bouclier: 'bois' as const, attaquant: 'morvan' };
    const leve = { leve: true, depuis: 2, riposte: 0 };
    expect(resoudreParade({ ...coup, garde: leve, solide: true }).brut).toBe(0);
    const simple = resoudreParade({ ...coup, garde: leve, solide: false });
    expect(simple.pare).toBe(true);
    expect(simple.brut).toBeLessThan(INFOS_ENNEMIS.morvan.degats * 0.4);
    expect(resoudreParade({ ...coup, garde: { leve: true, depuis: 0.1, riposte: 0 }, solide: false }).reussie).toBe(true);
    // Sans bouclier levé, tout passe
    expect(resoudreParade({ ...coup, garde: { leve: false, depuis: 0, riposte: 0 }, solide: true }).brut).toBe(INFOS_ENNEMIS.morvan.degats);
  });

  it('un coup reçu n’interrompt pas son annonce', () => {
    const avant = vivre(morvan({ phase: 'poursuite' }), sansCharge, contexte(500, 502), 0.4);
    expect(frapperEnnemi(avant.etat, 20, 500, 502).etat.phase).toBe('anticipation');
  });
});

describe('chef : charge', () => {
  const loin = contexte(500, 510);

  it('ne part que si le joueur est à bonne distance et la recharge écoulée', () => {
    const depart = morvan({ phase: 'poursuite' });
    expect(pasChef(depart, pret, loin, DT).chef.enCharge).toBe(true);
    expect(pasChef(depart, { ...pret, rechargeCharge: 3 }, loin, DT).chef.enCharge).toBe(false);
    expect(pasChef(depart, pret, contexte(500, 500 + G.distanceMin - 1), DT).chef.enCharge).toBe(false);
    expect(pasChef(depart, pret, contexte(500, 500 + G.distanceMax + 2), DT).chef.enCharge).toBe(false);
    // Au repos (joueur pas encore vu), pas de charge
    expect(pasChef(morvan({ phase: 'repos', attente: 99 }), pret, contexte(500, 560), DT).chef.enCharge).toBe(false);
  });

  it('la première charge d’un combat attend un peu', () => {
    expect(creerEtatChef().rechargeCharge).toBeGreaterThan(2);
  });

  it('prend son élan sur place, puis fonce en ligne droite et touche une seule fois', () => {
    const debut = pasChef(morvan({ phase: 'poursuite' }), pret, loin, DT);
    expect(debut.etat.phase).toBe('anticipation');
    const elan = vivre(debut.etat, debut.chef, loin, G.elan * 0.8);
    expect(elan.etat.phase).toBe('anticipation');
    expect(elan.etat.z).toBeCloseTo(500, 5);
    const course = vivre(elan.etat, elan.chef, loin, G.elan * 0.2 + G.duree + 0.2);
    expect(course.coups).toEqual([G.degats]);
    // Il a traversé la position du joueur, tout droit
    expect(course.etat.z).toBeGreaterThan(508);
    expect(course.etat.x).toBeCloseTo(500, 3);
    expect(course.chef.enCharge).toBe(false);
    expect(course.chef.rechargeCharge).toBeGreaterThan(G.recharge - 1);
    expect(course.etat.phase).not.toBe('attaque');
  });

  it('un pas de côté pendant la course l’évite : la direction est fixée à la fin de l’élan', () => {
    const debut = pasChef(morvan({ phase: 'poursuite' }), pret, loin, DT);
    const elan = vivre(debut.etat, debut.chef, loin, G.elan + DT * 2);
    expect(elan.etat.phase).toBe('attaque');
    const course = vivre(elan.etat, elan.chef, contexte(504, 510), G.duree - 0.1);
    expect(course.degats).toBe(0);
    expect(course.etat.x).toBeCloseTo(500, 3);
  });

  it('une parade réussie (étourdi) arrête la charge', () => {
    const debut = pasChef(morvan({ phase: 'poursuite' }), pret, loin, DT);
    const elan = vivre(debut.etat, debut.chef, loin, G.elan + DT * 2);
    const r = pasChef(etourdirEnnemi(elan.etat), elan.chef, loin, DT);
    expect(r.chef.enCharge).toBe(false);
    expect(r.etat.phase).toBe('etourdi');
    expect(r.chef.rechargeCharge).toBe(G.recharge);
  });
});

describe('chef : appel des renforts', () => {
  const ctx = contexte(500, 503);

  it('appelle une fois, quand sa vie passe sous la moitié', () => {
    const plein = morvan({ phase: 'poursuite' });
    expect(pasChef(plein, sansCharge, ctx, DT).appel).toBe(false);
    const blesse = frapperEnnemi(plein, K.pv * 0.4, 500, 503).etat;
    expect(pasChef(blesse, sansCharge, ctx, DT).appel).toBe(false);
    const mi = frapperEnnemi(blesse, K.pv * 0.15, 500, 503).etat;
    expect(ratioVieChef(mi)).toBeLessThan(0.5);
    const r = vivre(mi, sansCharge, ctx, 3);
    expect(r.appels).toBe(1);
    expect(r.chef.appelFait).toBe(true);
    expect(K.renforts).toBe(2);
  });
});

describe('chef : le joueur tombe', () => {
  it('Morvan récupère toute sa vie et le combat repart de zéro', () => {
    const blesse = frapperEnnemi(morvan({ phase: 'poursuite' }), K.pv * 0.7, 500, 503).etat;
    const entame = vivre(blesse, sansCharge, contexte(500, 503), 0.5);
    expect(entame.chef.appelFait).toBe(true);
    const r = pasChef(entame.etat, entame.chef, contexte(500, 503, false), DT);
    expect(r.etat.pv).toBe(K.pv);
    expect(r.recommence).toBe(true);
    expect(r.chef.appelFait).toBe(false);
    expect(r.degats).toBe(0);
    // Signalé une seule fois, et il ne frappe plus
    const suite = vivre(r.etat, r.chef, contexte(500, 503, false), 2);
    expect(suite.recommence).toBe(0);
    expect(suite.degats).toBe(0);
    expect(suite.etat.pv).toBe(K.pv);
  });

  it('une charge en cours s’arrête', () => {
    const debut = pasChef(morvan({ phase: 'poursuite' }), pret, contexte(500, 510), DT);
    const r = pasChef(debut.etat, debut.chef, contexte(500, 510, false), DT);
    expect(r.chef.enCharge).toBe(false);
    expect(r.etat.phase).not.toBe('attaque');
  });
});

describe('chef : mort', () => {
  it('une fois mort, il ne fait plus rien', () => {
    const mort = frapperEnnemi(morvan({ phase: 'poursuite' }), K.pv + 10, 500, 503);
    expect(mort.mort).toBe(true);
    const r = vivre(mort.etat, pret, contexte(500, 508), 1);
    expect(r.etat.phase).toBe('mort');
    expect(r.degats).toBe(0);
    expect(r.appels).toBe(0);
    expect(r.chef.enCharge).toBe(false);
  });
});
