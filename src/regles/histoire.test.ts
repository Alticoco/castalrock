import { describe, expect, it } from 'vitest';
import { HABITANTS } from './habitants';
import {
  ETAPES_HISTOIRE,
  TITRES_ACTES,
  ciblesParler,
  creerEtatHistoire,
  etapeAtteinte,
  evenementHistoire,
  histoireFinie,
  lireEtatHistoire,
  ETAPE_TROUVER_ALDRIC_V23,
  migrerEtapeV19,
  migrerEtapeV23,
  objectifAffiche,
  recitsTermines,
  verifierEtatHistoire,
  type ContenantsHistoire,
  type EtatHistoire,
  type EvenementHistoire,
} from './histoire';
import { ajouter, compter, creerConteneur } from './inventaire';

const index = (id: string) => ETAPES_HISTOIRE.findIndex((e) => e.id === id);
const a = (id: string, compteur = 0, vus: string[] = []): EtatHistoire => ({ etape: index(id), compteur, vus });
const niveaux = { palierOutils: 0, niveauVillage: 1 };
const vide: ContenantsHistoire = { inventaire: creerConteneur(10), coffre: creerConteneur(10), sac: creerConteneur(10) };
const avec = (objet: string, quantite: number, ou: keyof ContenantsHistoire = 'inventaire'): ContenantsHistoire => ({
  ...vide,
  [ou]: ajouter(vide[ou], objet, quantite).conteneur,
});

describe('histoire : les étapes', () => {
  it('compte 23 étapes aux identifiants uniques, dans les actes dans l’ordre', () => {
    expect(ETAPES_HISTOIRE).toHaveLength(23);
    expect(new Set(ETAPES_HISTOIRE.map((e) => e.id)).size).toBe(23);
    const ordre = Object.keys(TITRES_ACTES);
    const rangs = ETAPES_HISTOIRE.map((e) => ordre.indexOf(e.acte));
    expect(rangs).toEqual([...rangs].sort((x, y) => x - y));
  });

  it('chaque étape a un récit, une récompense et, si on parle, une réplique par personne visée', () => {
    for (const e of ETAPES_HISTOIRE) {
      expect(e.recit.length).toBeGreaterThan(20);
      expect(e.recompense.xp).toBeGreaterThan(0);
      const c = e.condition;
      if (c.type === 'parler' || c.type === 'remettre') expect(e.repliques?.map((r) => r.habitant)).toEqual([c.habitant]);
      if (c.type === 'parlerTous') expect(e.repliques?.map((r) => r.habitant).sort()).toEqual([...c.habitants].sort());
      for (const r of e.repliques ?? []) expect(HABITANTS).toContain(r.habitant);
    }
  });

  it('Hugo n’est salué qu’après le passage du village au niveau 2', () => {
    expect(index('saluer-hugo')).toBeGreaterThan(index('village-niveau-2'));
  });
});

describe('histoire : étape atteinte', () => {
  it('dit si une étape est active ou passée', () => {
    const plan = ETAPES_HISTOIRE.findIndex((e) => e.id === 'plan-gaspard');
    expect(etapeAtteinte({ ...creerEtatHistoire(), etape: plan - 1 }, 'plan-gaspard')).toBe(false);
    expect(etapeAtteinte({ ...creerEtatHistoire(), etape: plan }, 'plan-gaspard')).toBe(true);
    expect(etapeAtteinte({ ...creerEtatHistoire(), etape: ETAPES_HISTOIRE.length }, 'plan-gaspard')).toBe(true);
    expect(etapeAtteinte({ ...creerEtatHistoire(), etape: ETAPES_HISTOIRE.length }, 'inconnue')).toBe(false);
  });
});

describe('histoire : événements', () => {
  const faire = (etat: EtatHistoire, ...evs: EvenementHistoire[]) => evs.reduce((e, ev) => evenementHistoire(e, ev).etat, etat);

  it('parler à Gaspard termine le prologue d’entrée et dit sa réplique d’histoire', () => {
    const r = evenementHistoire(creerEtatHistoire(), { type: 'parle', habitant: 'gaspard' });
    expect(r.terminee?.id).toBe('parler-gaspard');
    expect(r.replique).toContain('Gaspard');
    expect(r.etat).toEqual({ etape: 1, compteur: 0, vus: [] });
  });

  it('parler à quelqu’un d’autre, ou un événement sans rapport, ne change rien', () => {
    const e = creerEtatHistoire();
    expect(evenementHistoire(e, { type: 'parle', habitant: 'marthe' })).toEqual({ etat: e, terminee: null, replique: null });
    expect(evenementHistoire(e, { type: 'repos' }).etat).toBe(e);
    expect(evenementHistoire(e, { type: 'arbreAbattu' }).etat).toBe(e);
  });

  it('compte les arbres abattus puis passe à l’étape suivante', () => {
    let e = a('couper-arbres');
    e = faire(e, { type: 'arbreAbattu' });
    expect(objectifAffiche(e)).toBe('Prologue — Coupe 3 arbres (1/3)');
    e = faire(e, { type: 'arbreAbattu' });
    const r = evenementHistoire(e, { type: 'arbreAbattu' });
    expect(r.terminee?.id).toBe('couper-arbres');
    expect(r.etat).toEqual({ etape: index('passer-la-nuit'), compteur: 0, vus: [] });
  });

  it('se reposer puis entrer dans la maison font avancer le prologue', () => {
    let r = evenementHistoire(a('passer-la-nuit'), { type: 'repos' });
    expect(r.terminee?.id).toBe('passer-la-nuit');
    r = evenementHistoire(r.etat, { type: 'entreeMaison' });
    expect(r.terminee?.id).toBe('entrer-maison');
    expect(r.etat.etape).toBe(index('connaitre-habitants'));
  });

  it('ne compte que le bon ennemi', () => {
    let e = a('slimes');
    e = faire(e, { type: 'ennemiTue', ennemi: 'bandit' }, { type: 'ennemiTue', ennemi: 'gobelin' });
    expect(e.compteur).toBe(0);
    e = faire(e, { type: 'ennemiTue', ennemi: 'slime' }, { type: 'ennemiTue', ennemi: 'slime' });
    expect(objectifAffiche(e)).toBe('Acte I — Débarrasse le village de 5 slimes (2/5)');
    e = faire(e, ...Array.from({ length: 3 }, () => ({ type: 'ennemiTue', ennemi: 'slime' }) as const));
    expect(e.etape).toBe(index('village-niveau-2'));
  });

  it('les animaux comptent à part des ennemis', () => {
    const e = a('chasse-hugo');
    expect(faire(e, { type: 'ennemiTue', ennemi: 'loup' }).compteur).toBe(0);
    const r = evenementHistoire(faire(e, { type: 'animalTue' }), { type: 'animalTue' });
    expect(r.terminee?.id).toBe('chasse-hugo');
  });

  it('le compteur repart de zéro à chaque étape (3 bandits, puis 6 plus tard)', () => {
    const r = faire(a('bandits-routes', 2), { type: 'ennemiTue', ennemi: 'bandit' });
    expect(r).toEqual({ etape: index('chasse-hugo'), compteur: 0, vus: [] });
  });

  it('« parler à tous » : dans le désordre, chaque habitant une seule fois, réplique à chaque première rencontre', () => {
    let e = a('connaitre-habitants');
    expect(ciblesParler(e)).toEqual(['marthe', 'mathilde', 'bertil']);
    let r = evenementHistoire(e, { type: 'parle', habitant: 'bertil' });
    expect(r.terminee).toBeNull();
    expect(r.replique).toContain('Bertil');
    e = r.etat;
    expect(objectifAffiche(e)).toBe('Acte I — Fais connaissance avec Marthe, Mathilde et Bertil (1/3)');
    // Bertil une seconde fois : rien
    r = evenementHistoire(e, { type: 'parle', habitant: 'bertil' });
    expect(r.etat).toBe(e);
    expect(r.replique).toBeNull();
    // Hugo n'est pas dans la liste
    expect(evenementHistoire(e, { type: 'parle', habitant: 'hugo' }).etat).toBe(e);
    e = evenementHistoire(e, { type: 'parle', habitant: 'marthe' }).etat;
    expect(ciblesParler(e)).toEqual(['mathilde']);
    r = evenementHistoire(e, { type: 'parle', habitant: 'mathilde' });
    expect(r.terminee?.id).toBe('connaitre-habitants');
    expect(r.replique).toContain('Mathilde');
    expect(r.etat).toEqual({ etape: index('outil-cuivre'), compteur: 0, vus: [] });
  });

  it('« remettre » : sans les objets, rien ; avec, ils sont pris et l’étape passe', () => {
    const e = a('cristaux-aldric');
    const parle = { type: 'parle', habitant: 'aldric' } as const;
    // Sans possession, ou sans assez
    expect(evenementHistoire(e, parle).etat).toBe(e);
    expect(evenementHistoire(e, parle, vide).terminee).toBeNull();
    expect(evenementHistoire(e, parle, avec('cristal-bleu', 4)).terminee).toBeNull();
    // Bonne personne seulement
    expect(evenementHistoire(e, { type: 'parle', habitant: 'gaspard' }, avec('cristal-bleu', 5)).terminee).toBeNull();
    // Avec les objets
    const r = evenementHistoire(e, parle, avec('cristal-bleu', 7));
    expect(r.terminee?.id).toBe('cristaux-aldric');
    expect(r.replique).toContain('Cinq éclats');
    expect(compter(r.contenants!.inventaire, 'cristal-bleu')).toBe(2);
    expect(r.etat.etape).toBe(index('plan-gaspard'));
  });

  it('« remettre » prend aussi dans le coffre et le sac', () => {
    const e = a('cristaux-aldric');
    const parle = { type: 'parle', habitant: 'aldric' } as const;
    const c: ContenantsHistoire = {
      inventaire: ajouter(creerConteneur(10), 'cristal-bleu', 2).conteneur,
      coffre: ajouter(creerConteneur(10), 'cristal-bleu', 2).conteneur,
      sac: ajouter(creerConteneur(10), 'cristal-bleu', 3).conteneur,
    };
    expect(evenementHistoire(e, parle, { ...c, sac: creerConteneur(10) }).terminee).toBeNull();
    const r = evenementHistoire(e, parle, c);
    expect(r.terminee?.id).toBe('cristaux-aldric');
    expect(compter(r.contenants!.inventaire, 'cristal-bleu') + compter(r.contenants!.coffre, 'cristal-bleu')).toBe(0);
    expect(compter(r.contenants!.sac, 'cristal-bleu')).toBe(2);
  });

  it('les étapes « état » n’avancent pas par événement', () => {
    const e = a('outil-cuivre');
    expect(faire(e, { type: 'parle', habitant: 'bertil' }, { type: 'repos' })).toBe(e);
  });
});

describe('histoire : étapes « état »', () => {
  it('ne passe pas tant que l’état ne suffit pas', () => {
    const e = a('outil-cuivre');
    const r = verifierEtatHistoire(e, niveaux);
    expect(r.etat).toBe(e);
    expect(r.terminees).toEqual([]);
  });

  it('passe l’étape remplie, puis s’arrête sur la suivante', () => {
    const r = verifierEtatHistoire(a('outil-cuivre'), { palierOutils: 1, niveauVillage: 1 });
    expect(r.terminees.map((x) => x.id)).toEqual(['outil-cuivre']);
    expect(r.etat.etape).toBe(index('slimes'));
  });

  it('enchaîne un événement et une étape « état » déjà remplie : le 5e slime fait passer le village niveau 2', () => {
    const situation = { palierOutils: 3, niveauVillage: 3 };
    const tue = evenementHistoire(a('slimes', 4), { type: 'ennemiTue', ennemi: 'slime' });
    expect(tue.etat.etape).toBe(index('village-niveau-2'));
    const r = verifierEtatHistoire(tue.etat, situation);
    expect(r.terminees.map((x) => x.id)).toEqual(['village-niveau-2']);
    expect(r.etat.etape).toBe(index('saluer-hugo'));
    // Vers l'acte III : outil d'acier déjà forgé, puis on attend les événements
    const acier = verifierEtatHistoire(a('outil-acier'), situation);
    expect(acier.terminees.map((x) => x.id)).toEqual(['outil-acier']);
    expect(acier.etat.etape).toBe(index('legende-mathilde'));
  });

  it('une étape d’événement entre deux étapes « état » arrête la cascade', () => {
    const r = verifierEtatHistoire({ etape: index('outil-cuivre'), compteur: 0, vus: [] }, { palierOutils: 4, niveauVillage: 3 });
    expect(r.etat.etape).toBe(index('slimes'));
  });

  it('remet à zéro le compteur et les habitants vus en changeant d’étape', () => {
    const r = verifierEtatHistoire({ etape: index('outil-cuivre'), compteur: 4, vus: ['marthe'] }, { palierOutils: 1, niveauVillage: 1 });
    expect(r.etat).toEqual({ etape: index('slimes'), compteur: 0, vus: [] });
  });
});

describe('histoire : acte IV, le camp, Morvan et les ruines de Castalrock (étape 45)', () => {
  it('après le plan de Gaspard viennent le camp, Morvan, puis la reforge du Cœur, puis l’épilogue', () => {
    const debut = index('plan-gaspard');
    expect(ETAPES_HISTOIRE.slice(debut, debut + 5).map((e) => e.id)).toEqual(['plan-gaspard', 'trouver-camp', 'battre-morvan', 'reforger-coeur', 'village-niveau-3']);
    expect(ETAPES_HISTOIRE.slice(debut, debut + 4).every((e) => e.acte === 'IV')).toBe(true);
    expect(ETAPES_HISTOIRE.some((e) => e.id === 'eclaireurs')).toBe(false);
    // Le plan de Gaspard situe le camp et la vieille forteresse
    const plan = ETAPES_HISTOIRE[debut].repliques![0].texte;
    expect(plan).toContain('forêt');
    expect(plan).toContain('forteresse de Castalrock');
    expect(plan).not.toContain('autel');
    expect(plan).toContain('montagne');
  });

  it('écouter Gaspard mène à « Trouve le camp », qui ne passe qu’une fois le camp découvert', () => {
    const r = evenementHistoire(a('plan-gaspard'), { type: 'parle', habitant: 'gaspard' });
    expect(r.etat.etape).toBe(index('trouver-camp'));
    expect(objectifAffiche(r.etat)).toContain('Acte IV — Trouve le camp du Balafré, dans la forêt');
    expect(verifierEtatHistoire(r.etat, niveaux).terminees).toEqual([]);
    expect(verifierEtatHistoire(r.etat, { ...niveaux, lieuxDecouverts: ['autel'] }).terminees).toEqual([]);
    const trouve = verifierEtatHistoire(r.etat, { ...niveaux, lieuxDecouverts: ['camp'] });
    expect(trouve.terminees.map((x) => x.id)).toEqual(['trouver-camp']);
    expect(trouve.etat.etape).toBe(index('battre-morvan'));
  });

  it('« Bats Morvan » ne passe que Morvan vaincu ; tuer des bandits ne compte pas', () => {
    const e = a('battre-morvan');
    expect(objectifAffiche(e)).toBe('Acte IV — Bats Morvan le Balafré');
    expect(evenementHistoire(e, { type: 'ennemiTue', ennemi: 'bandit' }).etat).toBe(e);
    expect(verifierEtatHistoire(e, { ...niveaux, lieuxDecouverts: ['camp'] }).terminees).toEqual([]);
    const r = verifierEtatHistoire(e, { ...niveaux, lieuxDecouverts: ['camp'], chefsVaincus: ['morvan'] });
    expect(r.terminees.map((x) => x.id)).toEqual(['battre-morvan']);
    expect(r.etat.etape).toBe(index('reforger-coeur'));
  });

  it('« Reforge le Cœur » ne passe qu’une fois le Cœur reforgé dans les ruines ; parler à Aldric ne suffit plus', () => {
    const e = a('reforger-coeur');
    expect(objectifAffiche(e)).toContain('Reforge le Cœur dans les ruines de Castalrock');
    const riche: ContenantsHistoire = { ...avec('cristal-bleu', 10), sac: ajouter(creerConteneur(10), 'lingot-acier', 5).conteneur };
    expect(evenementHistoire(e, { type: 'parle', habitant: 'aldric' }, riche).etat).toBe(e);
    expect(verifierEtatHistoire(e, { ...niveaux, chefsVaincus: ['morvan'] }).terminees).toEqual([]);
    const r = verifierEtatHistoire(e, { ...niveaux, coeurReforge: true });
    expect(r.terminees.map((x) => x.id)).toEqual(['reforger-coeur']);
    expect(r.etat.etape).toBe(index('village-niveau-3'));
  });

  it('une partie qui a déjà tout fait traverse l’acte IV d’un coup, jusqu’à l’épilogue', () => {
    const r = verifierEtatHistoire(a('trouver-camp'), { ...niveaux, lieuxDecouverts: ['camp', 'autel'], chefsVaincus: ['morvan'], coeurReforge: true });
    expect(r.terminees.map((x) => x.id)).toEqual(['trouver-camp', 'battre-morvan', 'reforger-coeur']);
    expect(r.etat.etape).toBe(index('village-niveau-3'));
  });

  it('migration v19 : les deux étapes provisoires (16 et 17) deviennent « Trouve le camp », la suite est décalée', () => {
    // Numéros de l'histoire à 20 étapes (avant l'attaque du village)
    expect(migrerEtapeV19(15)).toEqual({ etape: 15, remiseAZero: false });
    expect(migrerEtapeV19(16)).toEqual({ etape: 16, remiseAZero: true });
    expect(migrerEtapeV19(17)).toEqual({ etape: 16, remiseAZero: true });
    expect(migrerEtapeV19(18)).toEqual({ etape: 19, remiseAZero: false });
    expect(migrerEtapeV19(19)).toEqual({ etape: 20, remiseAZero: false });
    expect(migrerEtapeV19(3)).toEqual({ etape: 3, remiseAZero: false });
  });
});

describe('histoire : fin', () => {
  it('le village niveau 3 termine l’histoire, il n’y a plus d’objectif', () => {
    const e = a('village-niveau-3');
    expect(histoireFinie(e)).toBe(false);
    const r = verifierEtatHistoire(e, { palierOutils: 4, niveauVillage: 3 });
    expect(r.terminees.map((x) => x.id)).toEqual(['village-niveau-3']);
    expect(histoireFinie(r.etat)).toBe(true);
    expect(objectifAffiche(r.etat)).toBeNull();
    expect(recitsTermines(r.etat)).toHaveLength(23);
    // Plus rien ne bouge
    expect(evenementHistoire(r.etat, { type: 'repos' }).etat).toBe(r.etat);
    expect(verifierEtatHistoire(r.etat, { palierOutils: 4, niveauVillage: 3 }).etat).toBe(r.etat);
  });
});

describe('histoire : affichage', () => {
  it('l’objectif commence par l’acte', () => {
    expect(objectifAffiche(creerEtatHistoire())).toBe('Prologue — Parle à Gaspard, sur la place');
    expect(objectifAffiche(a('outil-cuivre'))).toBe('Acte I — Forge un outil en cuivre');
    expect(objectifAffiche(a('bandits-routes', 1))).toBe('Acte II — Repousse 3 bandits sur les routes (1/3)');
    expect(objectifAffiche(a('village-niveau-3'))).toBe('Épilogue — Fais prospérer le village (niveau 3)');
  });

  it('personne à qui parler pendant une étape sans dialogue', () => {
    expect(ciblesParler(a('outil-acier'))).toEqual([]);
  });

  it('les récits terminés suivent les étapes passées, acte par acte', () => {
    expect(recitsTermines(creerEtatHistoire())).toEqual([]);
    const recits = recitsTermines(a('slimes'));
    expect(recits).toHaveLength(index('slimes'));
    expect(recits.map((r) => r.acte)).toEqual(['prologue', 'prologue', 'prologue', 'prologue', 'I', 'I']);
  });
});

describe('histoire : lecture d’un état sauvegardé', () => {
  it('accepte un état valide, retire les doublons', () => {
    expect(lireEtatHistoire({ etape: 3, compteur: 2, vus: ['marthe', 'marthe'] })).toEqual({ etape: 3, compteur: 2, vus: ['marthe'] });
    expect(lireEtatHistoire({ etape: 23, compteur: 0, vus: [] })).not.toBeNull();
  });

  it('refuse un état abîmé', () => {
    for (const mauvais of [null, 4, [], { etape: 24, compteur: 0, vus: [] }, { etape: 0, compteur: -1, vus: [] }, { etape: 0, compteur: 0 }, { etape: 0, compteur: 0, vus: [1] }]) {
      expect(lireEtatHistoire(mauvais)).toBeNull();
    }
  });
});

describe('histoire : le village attaqué (migration v23 -> v24)', () => {
  it('les trois étapes viennent juste après « Trouve Aldric »', () => {
    expect(index('trouver-aldric')).toBe(ETAPE_TROUVER_ALDRIC_V23);
    expect(index('rentrer-village')).toBe(index('trouver-aldric') + 1);
    expect(index('parler-gaspard-attaque')).toBe(index('trouver-aldric') + 2);
    expect(index('relever-village')).toBe(index('trouver-aldric') + 3);
    expect(index('cristaux-aldric')).toBe(index('trouver-aldric') + 4);
  });

  it('les étapes après Aldric sont décalées de 3, les autres ne bougent pas', () => {
    expect(migrerEtapeV23(0)).toBe(0);
    expect(migrerEtapeV23(13)).toBe(13);
    expect(migrerEtapeV23(14)).toBe(index('cristaux-aldric') - 0);
    expect(migrerEtapeV23(20)).toBe(23);
  });

  it('« Rentre au village » passe à moins de 30 m du centre, « Aide le village » quand la dernière quête est rendue', () => {
    const a = { etape: index('rentrer-village'), compteur: 0, vus: [] as string[] };
    const base = { palierOutils: 3, niveauVillage: 2 };
    expect(verifierEtatHistoire(a, { ...base, distanceVillage: 80 }).terminees).toHaveLength(0);
    expect(verifierEtatHistoire(a, base).terminees).toHaveLength(0);
    expect(verifierEtatHistoire(a, { ...base, distanceVillage: 25 }).etat.etape).toBe(index('parler-gaspard-attaque'));
    const b = { etape: index('relever-village'), compteur: 0, vus: [] as string[] };
    expect(verifierEtatHistoire(b, { ...base, quetesRendues: ['murs-hiver'] }).terminees).toHaveLength(0);
    expect(verifierEtatHistoire(b, { ...base, quetesRendues: ['toit-chasseur'] }).etat.etape).toBe(index('cristaux-aldric'));
  });

  it('Gaspard raconte l’attaque en parlant', () => {
    const a = { etape: index('parler-gaspard-attaque'), compteur: 0, vus: [] as string[] };
    const r = evenementHistoire(a, { type: 'parle', habitant: 'gaspard' });
    expect(r.replique).toContain('auberge');
    expect(r.etat.etape).toBe(index('relever-village'));
  });
});
