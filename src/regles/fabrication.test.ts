import { describe, expect, it } from 'vitest';
import * as F33 from './fabrication';
import * as E33 from './equipement';
import * as I33 from './inventaire';
import { CONFIG } from '../config';
import { creerEquipement, equiperOutil, type Equipement } from './equipement';
import {
  RECETTES,
  fabriquer,
  quantitePossedee,
  raisonImpossible,
  recettesDuLieu,
  chercherRecette,
  type EtatFabrication,
} from './fabrication';
import { ajouter, compter, creerConteneur, type Conteneur } from './inventaire';
import { ETAPES_HISTOIRE, type EtatHistoire } from './histoire';

function remplir(c: Conteneur, objets: Record<string, number>): Conteneur {
  let suite = c;
  for (const [objet, n] of Object.entries(objets)) suite = ajouter(suite, objet, n).conteneur;
  return suite;
}

function etat(
  porte: Record<string, number> = {},
  coffre: Record<string, number> = {},
  cases = 16,
  equipement: Equipement = creerEquipement(),
  niveauVillage = 1,
): EtatFabrication {
  return {
    inventaire: remplir(creerConteneur(cases), porte),
    coffre: remplir(creerConteneur(24), coffre),
    equipement,
    niveauVillage,
  };
}

describe('recettes', () => {
  it('des identifiants uniques, et chaque lieu a ses recettes', () => {
    expect(new Set(RECETTES.map((r) => r.id)).size).toBe(RECETTES.length);
    expect(recettesDuLieu('etabli').length + recettesDuLieu('forge').length + recettesDuLieu('feu').length).toBe(RECETTES.length);
    for (const id of ['lingot-cuivre', 'lingot-fer', 'lingot-acier', 'armure-mailles', 'armure-plaques']) {
      expect(chercherRecette(id)?.lieu).toBe('forge');
    }
    for (const id of ['hache-cuivre', 'pioche-cuivre', 'epee-cuivre', 'armure-cuir', 'armure-fourrure']) {
      expect(chercherRecette(id)?.lieu).toBe('etabli');
    }
  });

  it('lingots : cuivre = 2 minerais ; fer = 2 minerais + 1 charbon ; acier = 2 fer + 2 charbons, village 2', () => {
    expect(chercherRecette('lingot-cuivre')?.ingredients).toEqual([{ objet: 'minerai-cuivre', quantite: 2 }]);
    expect(chercherRecette('lingot-fer')?.ingredients).toEqual([
      { objet: 'minerai-fer', quantite: 2 },
      { objet: 'charbon', quantite: 1 },
    ]);
    const acier = chercherRecette('lingot-acier')!;
    expect(acier.ingredients).toEqual([
      { objet: 'lingot-fer', quantite: 2 },
      { objet: 'charbon', quantite: 2 },
    ]);
    expect(acier.niveauVillageMin).toBe(2);
  });

  it('armures : recettes du document', () => {
    expect(chercherRecette('armure-cuir')?.ingredients).toEqual([{ objet: 'cuir', quantite: 6 }, { objet: 'fibres', quantite: 4 }]);
    expect(chercherRecette('armure-fourrure')?.ingredients).toEqual([{ objet: 'fourrure', quantite: 4 }, { objet: 'cuir', quantite: 2 }]);
    expect(chercherRecette('armure-mailles')?.ingredients).toEqual([{ objet: 'lingot-fer', quantite: 6 }]);
    expect(chercherRecette('armure-plaques')?.ingredients).toEqual([{ objet: 'lingot-acier', quantite: 6 }]);
    expect(chercherRecette('armure-plaques')?.niveauVillageMin).toBe(2);
    expect(chercherRecette('armure-mailles')?.niveauVillageMin).toBeUndefined();
  });
});

describe('fabriquer', () => {
  it('fabrique un objet : ingrédients consommés, résultat dans l\'inventaire porté', () => {
    const r = fabriquer(etat({ fibres: 12, bois: 5 }), 'armure-fibres');
    expect(r.ok).toBe(true);
    expect(compter(r.etat.inventaire, 'armure-fibres')).toBe(1);
    expect(compter(r.etat.inventaire, 'fibres')).toBe(2);
    expect(compter(r.etat.inventaire, 'bois')).toBe(1);
  });

  it('prend les ingrédients dans l\'inventaire d\'abord, puis dans le coffre', () => {
    const r = fabriquer(etat({ bois: 3, pierre: 1 }, { bois: 4, pierre: 5 }), 'kit-feu-camp');
    expect(r.ok).toBe(true);
    expect(compter(r.etat.inventaire, 'bois')).toBe(0);
    expect(compter(r.etat.coffre, 'bois')).toBe(2);
    expect(compter(r.etat.inventaire, 'pierre')).toBe(0);
    expect(compter(r.etat.coffre, 'pierre')).toBe(3);
    expect(compter(r.etat.inventaire, 'kit-feu-camp')).toBe(1);
    expect(quantitePossedee(r.etat, 'bois')).toBe(2);
  });

  it('refuse sans rien consommer quand il manque un ingrédient', () => {
    const avant = etat({ 'minerai-fer': 1, charbon: 9 });
    const r = fabriquer(avant, 'lingot-fer');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe('ingredients');
    expect(r.etat).toBe(avant);
  });

  it('refuse une recette inconnue', () => {
    const r = fabriquer(etat(), 'baguette-magique');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe('inconnue');
  });

  it('refuse si l\'inventaire est plein, sans rien consommer', () => {
    // 1 case : pleine d'une autre ressource, qui ne se libère pas
    const avant = etat({ pierre: 50 }, { 'minerai-fer': 2, charbon: 1 }, 1);
    const r = fabriquer(avant, 'lingot-fer');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.raison).toBe('inventaire-plein');
    expect(r.etat).toBe(avant);
  });

  it('accepte quand la consommation libère la case nécessaire', () => {
    const r = fabriquer(etat({ 'minerai-fer': 2, charbon: 1 }, {}, 2), 'lingot-fer');
    expect(r.ok).toBe(true);
    expect(compter(r.etat.inventaire, 'lingot-fer')).toBe(1);
  });

  it('la sacoche ajoute des cases, une seule fois', () => {
    const premiere = fabriquer(etat({ fibres: 20, bois: 6 }), 'sacoche');
    expect(premiere.ok).toBe(true);
    expect(premiere.etat.inventaire.cases).toHaveLength(16 + CONFIG.fabrication.casesSacoche);
    expect(premiere.etat.equipement.sacoche).toBe(true);
    expect(compter(premiere.etat.inventaire, 'fibres')).toBe(12);

    const seconde = fabriquer(premiere.etat, 'sacoche');
    expect(seconde.ok).toBe(false);
    if (!seconde.ok) expect(seconde.raison).toBe('deja-possede');
    expect(seconde.etat).toBe(premiere.etat);
  });

  it('un outil du palier suivant est équipé, sans occuper de case, et ne se fabrique pas deux fois', () => {
    const lingot = fabriquer(etat({ 'minerai-fer': 4, charbon: 2 }), 'lingot-fer');
    const lingot2 = fabriquer(lingot.etat, 'lingot-fer');
    expect(lingot2.ok).toBe(true);
    expect(compter(lingot2.etat.inventaire, 'lingot-fer')).toBe(2);

    // On part d'une hache en cuivre : la recette du fer est alors permise
    const avecCuivre = { ...lingot2.etat, inventaire: remplir(lingot2.etat.inventaire, { bois: 6 }), equipement: equiperOutil(creerEquipement(), 'hache', 'cuivre') };
    const hache = fabriquer(avecCuivre, 'hache-fer');
    expect(hache.ok).toBe(true);
    expect(hache.etat.equipement.outils.hache).toBe('fer');
    expect(hache.etat.equipement.outils.pioche).toBe('base');
    expect(hache.etat.equipement.durabilite.hache).toBe(CONFIG.fabrication.paliers.fer.durabilite);
    expect(compter(hache.etat.inventaire, 'lingot-fer')).toBe(0);
    expect(compter(hache.etat.inventaire, 'bois')).toBe(6 - 2);

    const encore = chercherRecette('hache-fer')!;
    expect(raisonImpossible(hache.etat, encore)).toBe('deja-possede');
    expect(fabriquer(hache.etat, 'hache-fer').ok).toBe(false);
    // Une fois en fer, la recette du cuivre est aussi « déjà possédée »
    expect(raisonImpossible(hache.etat, chercherRecette('hache-cuivre')!)).toBe('deja-possede');
  });

  it('on ne saute pas de palier : pas de fer depuis la base, message clair', () => {
    const e = etat({ 'lingot-fer': 3, bois: 5 });
    expect(raisonImpossible(e, chercherRecette('hache-fer')!)).toBe('palier-precedent');
    const r = fabriquer(e, 'hache-fer');
    expect(r.ok).toBe(false);
    expect(r.message).toBe("Il faut d'abord une hache en cuivre");
    expect(r.etat).toBe(e);
    // Depuis la base, le cuivre est permis ; la pioche est jugée séparément de la hache
    const base = etat({ 'lingot-cuivre': 2, bois: 2 });
    const cuivre = fabriquer(base, 'pioche-cuivre');
    expect(cuivre.ok).toBe(true);
    expect(cuivre.etat.equipement.outils.pioche).toBe('cuivre');
    expect(cuivre.etat.equipement.durabilite.pioche).toBe(150);
    const acierSansFer = etat({ 'lingot-acier': 3, bois: 5 }, {}, 16, equiperOutil(creerEquipement(), 'epee', 'cuivre'), 2);
    expect(fabriquer(acierSansFer, 'epee-acier').message).toBe("Il faut d'abord une épée en fer");
  });

  it("l'acier demande le village niveau 2, avec un message clair", () => {
    const outil = equiperOutil(creerEquipement(), 'pioche', 'fer');
    const village1 = etat({ 'lingot-acier': 2, bois: 2 }, {}, 16, outil, 1);
    const r1 = fabriquer(village1, 'pioche-acier');
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.raison).toBe('village-insuffisant');
    expect(r1.message).toBe('Il faut le village niveau 2');
    const r2 = fabriquer(etat({ 'lingot-acier': 2, bois: 2 }, {}, 16, outil, 2), 'pioche-acier');
    expect(r2.ok).toBe(true);
    expect(r2.etat.equipement.outils.pioche).toBe('acier');
    // Lingot d'acier et armure de plaques : même condition
    const f = etat({ 'lingot-fer': 2, charbon: 2 }, {}, 16, creerEquipement(), 1);
    expect(fabriquer(f, 'lingot-acier').message).toBe('Il faut le village niveau 2');
    expect(fabriquer({ ...f, niveauVillage: 2 }, 'lingot-acier').ok).toBe(true);
    expect(fabriquer(etat({ 'lingot-acier': 6 }, {}, 16, creerEquipement(), 1), 'armure-plaques').ok).toBe(false);
    expect(fabriquer(etat({ 'lingot-acier': 6 }, {}, 16, creerEquipement(), 2), 'armure-plaques').ok).toBe(true);
  });

  it('fabrique une armure de cuir et de mailles', () => {
    const cuir = fabriquer(etat({ cuir: 6, fibres: 4 }), 'armure-cuir');
    expect(cuir.ok).toBe(true);
    expect(compter(cuir.etat.inventaire, 'armure-cuir')).toBe(1);
    const mailles = fabriquer(etat({ 'lingot-fer': 6 }), 'armure-mailles');
    expect(mailles.ok).toBe(true);
    expect(compter(mailles.etat.inventaire, 'armure-mailles')).toBe(1);
  });

  it('une recette de la forge qui demande des lingots du coffre fonctionne', () => {
    const r = fabriquer(etat({ bois: 2 }, { 'lingot-fer': 3, bois: 1 }, 16, equiperOutil(creerEquipement(), 'epee', 'cuivre')), 'epee-fer');
    expect(r.ok).toBe(true);
    expect(r.etat.equipement.outils.epee).toBe('fer');
    expect(compter(r.etat.coffre, 'lingot-fer')).toBe(0);
  });
});

describe('Économe', () => {
  it("un tirage sous la chance épargne les ingrédients de base ; au-dessus, ils sont consommés", () => {
    const e = etat({ fibres: 8, bois: 2 });
    const epargne = fabriquer(e, 'sacoche', { chance: 0.25, tirage: () => 0.1 });
    expect(epargne.ok).toBe(true);
    expect(compter(epargne.etat.inventaire, 'fibres')).toBe(8);
    expect(compter(epargne.etat.inventaire, 'bois')).toBe(2);
    const normal = fabriquer(e, 'sacoche', { chance: 0.25, tirage: () => 0.9 });
    expect(compter(normal.etat.inventaire, 'fibres')).toBe(0);
    expect(compter(normal.etat.inventaire, 'bois')).toBe(0);
    // Sans le bonus, tout est consommé
    expect(compter(fabriquer(e, 'sacoche').etat.inventaire, 'fibres')).toBe(0);
  });

  it("ne touche pas aux ingrédients qui ne sont pas de base", () => {
    const e = etat({ 'minerai-cuivre': 2 });
    const r = fabriquer(e, 'lingot-cuivre', { chance: 1, tirage: () => 0 });
    expect(compter(r.etat.inventaire, 'minerai-cuivre')).toBe(0);
  });
});

describe('boucliers', () => {
  const plein = (noeuds: readonly string[], equipement = E33.creerEquipement()): F33.EtatFabrication => {
    let inventaire = I33.creerConteneur(12);
    for (const objet of ['bois', 'fibres', 'lingot-fer']) inventaire = I33.ajouter(inventaire, objet, 20).conteneur;
    return { inventaire, coffre: I33.creerConteneur(4), equipement, noeuds };
  };

  it('demandent le nœud Parade', () => {
    const bois = F33.chercherRecette('bouclier-bois')!;
    expect(bois.lieu).toBe('etabli');
    expect(F33.chercherRecette('bouclier-renforce')!.lieu).toBe('forge');
    expect(F33.raisonImpossible(plein([]), bois)).toBe('competence-manquante');
    const refus = F33.fabriquer(plein(['robustesse']), 'bouclier-bois');
    expect(refus.ok).toBe(false);
    expect(refus.message).toBe('Il faut la compétence Parade');
    expect(refus.etat.equipement.bouclier).toBeNull();
    expect(F33.raisonImpossible(plein(['parade']), bois)).toBeNull();
  });

  it("s'équipent à la fabrication, en consommant bois, fibres ou lingots de fer", () => {
    const r = F33.fabriquer(plein(['parade']), 'bouclier-bois');
    expect(r.ok).toBe(true);
    expect(r.etat.equipement.bouclier).toBe('bois');
    expect(I33.compter(r.etat.inventaire, 'bois')).toBe(12);
    expect(I33.compter(r.etat.inventaire, 'fibres')).toBe(16);
    const r2 = F33.fabriquer(r.etat, 'bouclier-renforce');
    expect(r2.ok).toBe(true);
    expect(r2.etat.equipement.bouclier).toBe('renforce');
    expect(I33.compter(r2.etat.inventaire, 'lingot-fer')).toBe(17);
  });

  it('ne se refont pas : déjà possédé (le renforcé vaut aussi pour celui en bois)', () => {
    const renforce = plein(['parade'], { ...E33.creerEquipement(), bouclier: 'renforce' });
    expect(F33.fabriquer(renforce, 'bouclier-renforce')).toMatchObject({ ok: false, raison: 'deja-possede' });
    expect(F33.fabriquer(renforce, 'bouclier-bois')).toMatchObject({ ok: false, raison: 'deja-possede' });
  });
});

describe('outils en cristal', () => {
  const rang = ETAPES_HISTOIRE.findIndex((e) => e.id === 'cristaux-aldric');
  const histoireAvant: EtatHistoire = { etape: rang, compteur: 0, vus: [] };
  const histoireApres: EtatHistoire = { etape: rang + 1, compteur: 0, vus: [] };
  const acier = (o: 'hache' | 'pioche' | 'epee') => equiperOutil(creerEquipement(), o, 'acier');
  const attendus = {
    epee: [{ objet: 'lingot-acier', quantite: 3 }, { objet: 'bois', quantite: 1 }, { objet: 'cristal-bleu', quantite: 4 }],
    hache: [{ objet: 'lingot-acier', quantite: 2 }, { objet: 'bois', quantite: 2 }, { objet: 'cristal-bleu', quantite: 4 }],
    pioche: [{ objet: 'lingot-acier', quantite: 2 }, { objet: 'bois', quantite: 2 }, { objet: 'cristal-bleu', quantite: 4 }],
  } as const;

  it('trois recettes à la forge, village 2, verrouillées par l\'étape cristaux-aldric', () => {
    expect(rang).toBeGreaterThan(0);
    for (const o of ['epee', 'hache', 'pioche'] as const) {
      const r = chercherRecette(`${o}-cristal`)!;
      expect(r.lieu).toBe('forge');
      expect(r.ingredients).toEqual(attendus[o]);
      expect(r.niveauVillageMin).toBe(2);
      expect(r.etapeHistoireRequise).toBe('cristaux-aldric');
      expect(r.icone).toBe(`${o}-cristal`);
    }
  });

  it('refusée tant que l\'étape n\'est pas terminée (active ou absente)', () => {
    const base = etat({ 'lingot-acier': 3, bois: 1, 'cristal-bleu': 4 }, {}, 16, acier('epee'), 2);
    for (const histoire of [undefined, histoireAvant]) {
      const r = fabriquer({ ...base, histoire }, 'epee-cristal');
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.raison).toBe('histoire-manquante');
      expect(r.message).toBe("Aldric doit d'abord t'apprendre ce que sont les cristaux bleus");
      expect(r.etat.equipement.outils.epee).toBe('acier');
    }
  });

  it('acceptée après l\'étape : outil en cristal équipé, ingrédients retirés', () => {
    const e = { ...etat({ 'lingot-acier': 3, bois: 1, 'cristal-bleu': 5 }, {}, 16, acier('epee'), 2), histoire: histoireApres };
    const r = fabriquer(e, 'epee-cristal');
    expect(r.ok).toBe(true);
    expect(r.etat.equipement.outils.epee).toBe('cristal');
    expect(r.etat.equipement.durabilite.epee).toBe(CONFIG.fabrication.paliers.cristal.durabilite);
    expect(compter(r.etat.inventaire, 'lingot-acier')).toBe(0);
    expect(compter(r.etat.inventaire, 'bois')).toBe(0);
    expect(compter(r.etat.inventaire, 'cristal-bleu')).toBe(1);
    expect(raisonImpossible(r.etat, chercherRecette('epee-acier')!)).toBe('deja-possede');
  });

  it('il manque des cristaux, ou on ne saute pas le palier acier, ou village 1', () => {
    const ok = { ...etat({ 'lingot-acier': 2, bois: 2, 'cristal-bleu': 3 }, {}, 16, acier('hache'), 2), histoire: histoireApres };
    expect(fabriquer(ok, 'hache-cristal').message).toBe('Il manque des ingrédients');
    const saut = { ...etat({ 'lingot-acier': 2, bois: 2, 'cristal-bleu': 4 }, {}, 16, equiperOutil(creerEquipement(), 'pioche', 'fer'), 2), histoire: histoireApres };
    expect(fabriquer(saut, 'pioche-cristal').message).toBe("Il faut d'abord une pioche en acier");
    const village1 = { ...etat({ 'lingot-acier': 2, bois: 2, 'cristal-bleu': 4 }, {}, 16, acier('pioche'), 1), histoire: histoireApres };
    expect(fabriquer(village1, 'pioche-cristal').message).toBe('Il faut le village niveau 2');
  });
});
