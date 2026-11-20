// Partie accélérée : joue toute la chaîne principale (du prologue à l'épilogue) avec les seules règles pures,
// en envoyant les événements et les états que le jeu enverrait. Prouve qu'aucune étape n'est impossible ou bloquante.
import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { ID_MORVAN, creerEtatChef, pasChef } from './chef';
import { creerEnnemi, frapperEnnemi, tirerButinEnnemi, type ContexteEnnemi, type EtatEnnemi } from './combat';
import { creerEquipement } from './equipement';
import type { IdHabitant } from './habitants';
import {
  ETAPES_HISTOIRE,
  creerEtatHistoire,
  etapeCourante,
  etapesTerminees,
  evenementHistoire,
  histoireFinie,
  objectifAffiche,
  verifierEtatHistoire,
  type ContenantsHistoire,
  type EtatHistoire,
  type EvenementHistoire,
  type SituationHistoire,
} from './histoire';
import { ajouter, compter, creerConteneur } from './inventaire';
import {
  creerEtatLieux,
  decouvrir,
  lieuxDecouverts,
  manqueReforge,
  reforgerCoeur,
  type EtatLieux,
  type Lieux,
} from './lieux';
import { creerEtatMarchand } from './marchand';
import { creerEtatAttaques } from './attaques';
import { POINT_REAPPARITION_DEFAUT } from './mort';
import { creerProgression } from './progression';
import { accepter, chercherQuete, creerEtatQuetes, objetsDemandes, rendre } from './quetes';
import { etatReperesInitial } from './reperes';
import { lirePartie, serialiser, type DonneesPartie } from './sauvegarde';

// --- Outils de test ---------------------------------------------------------------------------

const LIEUX: Lieux = {
  camp: { x: 0, z: 300, y: 5, acces: Math.PI },
  autel: { x: 400, z: 200, y: 40, acces: 0 },
};

const indexEtape = (id: string) => ETAPES_HISTOIRE.findIndex((e) => e.id === id);

/** Une partie : ce que le jeu garde (histoire, lieux, sacs, situation) et la façon de lui envoyer des événements. */
function creerPartie(depart: Partial<{ etat: EtatHistoire; situation: SituationHistoire; contenants: ContenantsHistoire; lieux: EtatLieux }> = {}) {
  const p = {
    etat: depart.etat ?? creerEtatHistoire(),
    situation: depart.situation ?? ({ palierOutils: 0, niveauVillage: 1 } as SituationHistoire),
    contenants: depart.contenants ?? { inventaire: creerConteneur(20), coffre: creerConteneur(24), sac: creerConteneur(2) },
    lieux: depart.lieux ?? creerEtatLieux(),
    /** Envoie un événement puis le contrôle « état » ; renvoie les identifiants des étapes terminées. */
    evenement(ev: EvenementHistoire): string[] {
      const r = evenementHistoire(p.etat, ev, p.contenants);
      p.etat = r.etat;
      if (r.contenants) p.contenants = r.contenants;
      return [...(r.terminee ? [r.terminee.id] : []), ...p.verifier()];
    },
    /** Contrôle des étapes « état » avec la situation courante. */
    verifier(): string[] {
      const v = verifierEtatHistoire(p.etat, {
        ...p.situation,
        lieuxDecouverts: lieuxDecouverts(p.lieux),
        chefsVaincus: p.lieux.morvanVaincu ? ['morvan'] : [],
        coeurReforge: p.lieux.coeurReforge,
      });
      p.etat = v.etat;
      return v.terminees.map((e) => e.id);
    },
    active: (): string | undefined => etapeCourante(p.etat)?.id,
    donner(objet: string, quantite: number) {
      p.contenants = { ...p.contenants, inventaire: ajouter(p.contenants.inventaire, objet, quantite).conteneur };
    },
    total: (objet: string) => compter(p.contenants.inventaire, objet) + compter(p.contenants.coffre, objet) + compter(p.contenants.sac, objet),
  };
  return p;
}
type Partie = ReturnType<typeof creerPartie>;

const parle = (habitant: IdHabitant): EvenementHistoire => ({ type: 'parle', habitant });
const repeter = (p: Partie, ev: EvenementHistoire, n: number) => Array.from({ length: n }, () => p.evenement(ev));

/** Le joueur (invulnérable, à 2 m) frappe Morvan toutes les 0,5 s jusqu'à sa mort ; renforts inclus. */
function combattreMorvan() {
  const DT = 1 / 60;
  const ctx: ContexteEnnemi = { joueur: { x: 500, z: 502, vivant: true }, monde: { hauteur: () => 0, niveauEau: -10, obstacles: [] }, rayonVillage: 0 };
  let morvan: EtatEnnemi = { ...creerEnnemi(ID_MORVAN, 'morvan', 500, 500), orientation: 0, phase: 'poursuite' };
  let chef = creerEtatChef();
  let appels = 0;
  let renforts: EtatEnnemi[] = [];
  let renfortsTues = 0;
  let temps = 0;
  let prochainCoup = 0.5;
  let mort = false;
  while (!mort && temps < 120) {
    const r = pasChef(morvan, chef, ctx, DT);
    morvan = r.etat;
    chef = r.chef;
    if (r.appel) {
      appels += 1;
      renforts = Array.from({ length: CONFIG.chefs.morvan.renforts }, (_, i) => creerEnnemi(`camp:renfort:${i}`, 'bandit', 500, 505));
    }
    temps += DT;
    if (temps >= prochainCoup) {
      prochainCoup += 0.5;
      const coup = frapperEnnemi(morvan, 25, 500, 502);
      morvan = coup.etat;
      mort = coup.mort;
    }
    // Les renforts, une fois appelés, sont abattus un par un en plus du chef (un coup chacun)
    if (renforts.length > 0 && !mort && Math.round(temps / DT) % 30 === 0) {
      const [premier, ...reste] = renforts;
      if (frapperEnnemi(premier, 9999, 500, 502).mort) renfortsTues += 1;
      renforts = reste;
    }
  }
  return { morvan, mort, appels, renfortsTues, temps, butin: tirerButinEnnemi('morvan', `${ID_MORVAN}:0`) };
}

/**
 * Le village est attaqué : retour au village (moins de 30 m), parole de Gaspard, puis les trois quêtes de reconstruction
 * (acceptées et rendues avec les règles des quêtes). Renvoie les étapes terminées, dans l'ordre.
 */
function traverserAttaque(p: Partie): string[] {
  const vues: string[] = [];
  expect(p.active()).toBe('rentrer-village');
  p.situation = { ...p.situation, distanceVillage: 200 };
  expect(p.verifier()).toEqual([]);
  p.situation = { ...p.situation, distanceVillage: 25 };
  vues.push(...p.verifier());
  expect(p.active()).toBe('parler-gaspard-attaque');
  // Les quêtes ne sont pas disponibles avant la parole de Gaspard
  const avant = { niveauVillage: p.situation.niveauVillage, noeuds: [], etapesTerminees: etapesTerminees(p.etat) };
  expect(accepter(creerEtatQuetes(), 'murs-hiver', avant).ok).toBe(false);
  vues.push(...p.evenement(parle('gaspard')));
  expect(p.active()).toBe('relever-village');
  let quetes = creerEtatQuetes();
  const ctx = { niveauVillage: p.situation.niveauVillage, noeuds: [], etapesTerminees: etapesTerminees(p.etat) };
  // Une à la fois : la deuxième et la troisième ne sont pas proposées avant la précédente
  expect(accepter(quetes, 'toit-chasseur', ctx).ok).toBe(false);
  for (const id of ['murs-hiver', 'ventre-batisseurs', 'toit-chasseur']) {
    const o = chercherQuete(id)!.objectif;
    if (o.type !== 'rapporter') throw new Error(id);
    for (const d of objetsDemandes(o)) p.donner(d.objet, d.quantite);
    const a = accepter(quetes, id, ctx);
    expect(a.ok, id).toBe(true);
    const r = rendre(a.etat, id, p.contenants, ctx);
    expect(r.ok, id).toBe(true);
    if (!r.ok) throw new Error(id);
    quetes = r.etat;
    p.contenants = r.contenants;
    // Tant que la dernière n'est pas rendue, l'histoire attend
    p.situation = { ...p.situation, quetesRendues: quetes.terminees };
    if (id !== 'toit-chasseur') expect(p.verifier()).toEqual([]);
  }
  vues.push(...p.verifier());
  return vues;
}

/** Amène une partie jusqu'à l'étape donnée en jouant les étapes une à une (sans les asserts : voir le test chronologique). */
function jouerJusqua(idCible: string): Partie {
  const p = creerPartie();
  p.etat = { ...creerEtatHistoire(), etape: indexEtape(idCible) };
  return p;
}

// --- La partie accélérée ----------------------------------------------------------------------

describe('partie accélérée : toute l’histoire, du prologue à l’épilogue', () => {
  it('chaque pas fait passer à l’étape attendue, jusqu’à ne plus avoir d’objectif', () => {
    const p = creerPartie();
    expect(p.active()).toBe('parler-gaspard');

    // 1 à 4 : le prologue
    expect(p.evenement(parle('gaspard'))).toEqual(['parler-gaspard']);
    expect(p.active()).toBe('couper-arbres');
    expect(repeter(p, { type: 'arbreAbattu' }, 3)).toEqual([[], [], ['couper-arbres']]);
    expect(p.active()).toBe('passer-la-nuit');
    expect(p.evenement({ type: 'repos' })).toEqual(['passer-la-nuit']);
    expect(p.evenement({ type: 'entreeMaison' })).toEqual(['entrer-maison']);

    // 5 : les trois habitants, dans un ordre quelconque
    expect(p.active()).toBe('connaitre-habitants');
    expect(p.evenement(parle('bertil'))).toEqual([]);
    expect(p.evenement(parle('marthe'))).toEqual([]);
    expect(p.evenement(parle('mathilde'))).toEqual(['connaitre-habitants']);

    // 6 : cuivre
    expect(p.active()).toBe('outil-cuivre');
    p.situation = { ...p.situation, palierOutils: 1 };
    expect(p.verifier()).toEqual(['outil-cuivre']);

    // 7 : 5 slimes
    expect(p.active()).toBe('slimes');
    repeter(p, { type: 'ennemiTue', ennemi: 'slime' }, 5);
    expect(p.active()).toBe('village-niveau-2');

    // 8 : village niveau 2
    p.situation = { ...p.situation, niveauVillage: 2 };
    expect(p.verifier()).toEqual(['village-niveau-2']);

    // 9 : Hugo
    expect(p.active()).toBe('saluer-hugo');
    expect(p.evenement(parle('hugo'))).toEqual(['saluer-hugo']);

    // 10 et 11 : bandits puis animaux
    expect(p.active()).toBe('bandits-routes');
    repeter(p, { type: 'ennemiTue', ennemi: 'bandit' }, 3);
    expect(p.active()).toBe('chasse-hugo');
    repeter(p, { type: 'animalTue' }, 2);

    // 12 : acier
    expect(p.active()).toBe('outil-acier');
    p.situation = { ...p.situation, palierOutils: 3 };
    expect(p.verifier()).toEqual(['outil-acier']);

    // 13 : Mathilde puis Aldric
    expect(p.active()).toBe('legende-mathilde');
    expect(p.evenement(parle('mathilde'))).toEqual(['legende-mathilde']);
    expect(p.evenement(parle('aldric'))).toEqual(['trouver-aldric']);

    // 13 bis : le village est attaqué pendant l'absence, puis relevé
    expect(traverserAttaque(p)).toEqual(['rentrer-village', 'parler-gaspard-attaque', 'relever-village']);

    // 14 : 5 cristaux à Aldric (rien ne se passe sans eux, ils sont pris ensuite)
    expect(p.active()).toBe('cristaux-aldric');
    expect(p.evenement(parle('aldric'))).toEqual([]);
    p.donner('cristal-bleu', 5);
    expect(p.evenement(parle('aldric'))).toEqual(['cristaux-aldric']);
    expect(p.total('cristal-bleu')).toBe(0);

    // 15 : le plan de Gaspard
    expect(p.active()).toBe('plan-gaspard');
    expect(p.evenement(parle('gaspard'))).toEqual(['plan-gaspard']);

    // 16 : découvrir le camp en s'en approchant
    expect(p.active()).toBe('trouver-camp');
    p.lieux = decouvrir(p.lieux, LIEUX, 0, 100).etat;
    expect(p.verifier()).toEqual([]);
    p.lieux = decouvrir(p.lieux, LIEUX, 0, 300 - CONFIG.lieux.camp.distanceDecouverte + 1).etat;
    expect(p.verifier()).toEqual(['trouver-camp']);

    // 17 : vaincre Morvan (règles de chef.ts), il lâche l'Éclat
    expect(p.active()).toBe('battre-morvan');
    const combat = combattreMorvan();
    expect(combat.mort).toBe(true);
    expect(combat.appels).toBe(1);
    p.lieux = { ...p.lieux, morvanVaincu: true };
    p.donner('eclat-coeur', combat.butin['eclat-coeur']);
    expect(p.verifier()).toEqual(['battre-morvan']);

    // 18 : reforger le Cœur (coût : Éclat, 10 cristaux bleus, 5 lingots d'acier)
    expect(p.active()).toBe('reforger-coeur');
    expect(reforgerCoeur(p.lieux, p.contenants).ok).toBe(false);
    p.donner('cristal-bleu', 10);
    p.donner('lingot-acier', 5);
    const forge = reforgerCoeur(p.lieux, p.contenants);
    expect(forge.ok).toBe(true);
    if (!forge.ok) return;
    p.lieux = forge.etat;
    p.contenants = forge.contenants;
    expect(p.total('eclat-coeur') + p.total('cristal-bleu') + p.total('lingot-acier')).toBe(0);
    expect(p.verifier()).toEqual(['reforger-coeur']);

    // 19 : épilogue, village niveau 3
    expect(p.active()).toBe('village-niveau-3');
    expect(objectifAffiche(p.etat)).toContain('niveau 3');
    p.situation = { ...p.situation, niveauVillage: 3 };
    expect(p.verifier()).toEqual(['village-niveau-3']);

    // Fin : plus d'objectif
    expect(histoireFinie(p.etat)).toBe(true);
    expect(etapeCourante(p.etat)).toBeUndefined();
    expect(objectifAffiche(p.etat)).toBeNull();
  });

  it('toutes les étapes ont été parcourues sans en sauter ni en refaire', () => {
    const p = creerPartie();
    const vues: string[] = [];
    const noter = (ids: string[]) => vues.push(...ids);
    noter(p.evenement(parle('gaspard')));
    for (let i = 0; i < 3; i++) noter(p.evenement({ type: 'arbreAbattu' }));
    noter(p.evenement({ type: 'repos' }));
    noter(p.evenement({ type: 'entreeMaison' }));
    for (const h of ['marthe', 'mathilde', 'bertil'] as const) noter(p.evenement(parle(h)));
    p.situation = { palierOutils: 3, niveauVillage: 2 };
    noter(p.verifier()); // cuivre passe, puis bloqué sur les 5 slimes
    for (let i = 0; i < 5; i++) noter(p.evenement({ type: 'ennemiTue', ennemi: 'slime' }));
    noter(p.verifier());
    noter(p.evenement(parle('hugo')));
    for (let i = 0; i < 3; i++) noter(p.evenement({ type: 'ennemiTue', ennemi: 'bandit' }));
    for (let i = 0; i < 2; i++) noter(p.evenement({ type: 'animalTue' }));
    noter(p.evenement(parle('mathilde')));
    noter(p.evenement(parle('aldric')));
    noter(traverserAttaque(p));
    p.donner('cristal-bleu', 5);
    noter(p.evenement(parle('aldric')));
    noter(p.evenement(parle('gaspard')));
    p.lieux = { campDecouvert: true, autelDecouvert: true, morvanVaincu: true, coeurReforge: true };
    p.situation = { palierOutils: 3, niveauVillage: 3 };
    noter(p.verifier());
    expect(vues).toEqual(ETAPES_HISTOIRE.map((e) => e.id));
    expect(histoireFinie(p.etat)).toBe(true);
  });
});

describe('partie accélérée : le combat contre Morvan', () => {
  it('se termine par la mort de Morvan, avec un seul appel de deux renforts, et le butin contient l’Éclat', () => {
    const combat = combattreMorvan();
    expect(combat.mort).toBe(true);
    expect(combat.morvan.phase).toBe('mort');
    expect(combat.appels).toBe(1);
    expect(combat.renfortsTues).toBe(CONFIG.chefs.morvan.renforts);
    expect(combat.temps).toBeLessThan(120);
    expect(combat.butin['eclat-coeur']).toBe(1);
  });
});

describe('partie accélérée : sauvegarde et chargement au milieu', () => {
  function donneesDe(p: Partie): DonneesPartie {
    return {
      graine: 42,
      personnage: { x: 0, y: 5, z: 300, orientation: 0 },
      vue: 'premiere',
      tempsJeu: 1000,
      inventaire: p.contenants.inventaire,
      sac: p.contenants.sac,
      retires: [],
      plantes: [],
      compteurPlantes: 0,
      coffre: p.contenants.coffre,
      niveauVillage: 2,
      equipement: creerEquipement(),
      vie: 100,
      baluchon: null,
      pointReapparition: POINT_REAPPARITION_DEFAUT,
      progression: creerProgression(),
      quetes: creerEtatQuetes(),
      histoire: p.etat,
      marchand: creerEtatMarchand(),
      attaques: creerEtatAttaques(),
      lieux: p.lieux,
      tresorsOuverts: [],
      potager: { dernierArrosage: null },
      feuCamp: null,
      pieges: [],
      reperes: etatReperesInitial(),
      mine: { dedans: false, visitee: true },
    };
  }

  /** Une partie à l'étape « Bats Morvan », juste avant le dernier coup. */
  function partieAvantMorvan(): Partie {
    const p = jouerJusqua('battre-morvan');
    p.situation = { palierOutils: 3, niveauVillage: 2 };
    p.lieux = { ...creerEtatLieux(), campDecouvert: true };
    return p;
  }

  it('après la victoire sur Morvan, la partie rechargée reprend à « Reforge le Cœur » avec l’Éclat', () => {
    const p = partieAvantMorvan();
    p.lieux = { ...p.lieux, morvanVaincu: true };
    p.donner('eclat-coeur', 1);
    expect(p.verifier()).toEqual(['battre-morvan']);

    const lue = lirePartie(serialiser(donneesDe(p)), 42);

    expect(lue).not.toBeNull();
    expect(ETAPES_HISTOIRE[lue!.histoire.etape].id).toBe('reforger-coeur');
    expect(lue!.lieux.morvanVaincu).toBe(true);
    expect(compter(lue!.inventaire, 'eclat-coeur')).toBe(1);
  });

  it('la partie rechargée peut aller jusqu’à la fin de l’histoire', () => {
    const p = partieAvantMorvan();
    p.lieux = { ...p.lieux, morvanVaincu: true };
    p.donner('eclat-coeur', 1);
    p.verifier();
    const lue = lirePartie(serialiser(donneesDe(p)), 42)!;
    const reprise = creerPartie({
      etat: lue.histoire,
      lieux: lue.lieux,
      situation: { palierOutils: 3, niveauVillage: 2 },
      contenants: { inventaire: lue.inventaire, coffre: lue.coffre, sac: lue.sac },
    });
    reprise.donner('cristal-bleu', 10);
    reprise.donner('lingot-acier', 5);

    const forge = reforgerCoeur(reprise.lieux, reprise.contenants);
    expect(forge.ok).toBe(true);
    if (!forge.ok) return;
    reprise.lieux = forge.etat;
    reprise.contenants = forge.contenants;
    expect(reprise.verifier()).toEqual(['reforger-coeur']);
    reprise.situation = { palierOutils: 3, niveauVillage: 3 };
    expect(reprise.verifier()).toEqual(['village-niveau-3']);
    expect(histoireFinie(reprise.etat)).toBe(true);
  });

  it('une sauvegarde en plein décompte (3 arbres sur 5) garde le compteur', () => {
    const p = creerPartie();
    p.evenement(parle('gaspard'));
    p.evenement({ type: 'arbreAbattu' });
    p.evenement({ type: 'arbreAbattu' });

    const lue = lirePartie(serialiser(donneesDe(p)), 42)!;

    expect(lue.histoire).toEqual({ etape: indexEtape('couper-arbres'), compteur: 2, vus: [] });
    expect(objectifAffiche(lue.histoire)).toContain('(2/3)');
  });

  it('le manque affiché à l’autel après rechargement liste ce qui reste à trouver', () => {
    const p = partieAvantMorvan();
    p.donner('eclat-coeur', 1);
    const lue = lirePartie(serialiser(donneesDe(p)), 42)!;
    const manque = manqueReforge({ inventaire: lue.inventaire, coffre: lue.coffre, sac: lue.sac });
    expect(manque).toHaveLength(2);
  });
});

describe('partie accélérée : dans le désordre', () => {
  /** Une partie à l'acte III (« Demande à Mathilde »), Morvan déjà vaincu et le camp déjà découvert. */
  function partieEnAvance(): Partie {
    const p = jouerJusqua('legende-mathilde');
    p.situation = { palierOutils: 3, niveauVillage: 2 };
    p.lieux = { campDecouvert: true, autelDecouvert: false, morvanVaincu: true, coeurReforge: false };
    p.donner('eclat-coeur', 1);
    return p;
  }

  it('ne saute aucune étape avant l’acte IV, même si Morvan est vaincu et le camp découvert', () => {
    const p = partieEnAvance();
    expect(p.verifier()).toEqual([]);
    expect(p.active()).toBe('legende-mathilde');
    expect(p.evenement(parle('mathilde'))).toEqual(['legende-mathilde']);
    expect(p.evenement(parle('aldric'))).toEqual(['trouver-aldric']);
    traverserAttaque(p);
    p.donner('cristal-bleu', 5);
    expect(p.evenement(parle('aldric'))).toEqual(['cristaux-aldric']);
    expect(p.active()).toBe('plan-gaspard');
  });

  it('en arrivant à l’acte IV, « camp » et « Morvan » passent d’eux-mêmes : on tombe sur « Reforge le Cœur »', () => {
    const p = partieEnAvance();
    p.evenement(parle('mathilde'));
    p.evenement(parle('aldric'));
    traverserAttaque(p);
    p.donner('cristal-bleu', 5);
    p.evenement(parle('aldric'));

    const terminees = p.evenement(parle('gaspard'));

    expect(terminees).toEqual(['plan-gaspard', 'trouver-camp', 'battre-morvan']);
    expect(p.active()).toBe('reforger-coeur');
  });

  it('l’Éclat gardé en poche permet de reforger tout de suite, puis l’histoire arrive à l’épilogue', () => {
    const p = partieEnAvance();
    p.etat = { ...creerEtatHistoire(), etape: indexEtape('reforger-coeur') };
    p.donner('cristal-bleu', 10);
    p.donner('lingot-acier', 5);

    const forge = reforgerCoeur(p.lieux, p.contenants);
    expect(forge.ok).toBe(true);
    if (!forge.ok) return;
    p.lieux = forge.etat;

    expect(p.verifier()).toEqual(['reforger-coeur']);
    expect(p.active()).toBe('village-niveau-3');
  });
});
