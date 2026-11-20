import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { creerEquipement } from './equipement';
import { xpPourNiveauSuivant } from './progression';
import { creerEtatHistoire, lireEtatHistoire } from './histoire';
import { maisonsEndommagees } from './reconstruction';
import { ajouter, creerConteneur } from './inventaire';
import { creerEtatMarchand } from './marchand';
import { creerEtatAttaques } from './attaques';
import { creerEtatLieux } from './lieux';
import { etatReperesInitial } from './reperes';
import { POINT_REAPPARITION_DEFAUT } from './mort';
import { VERSION_SAUVEGARDE, lirePartie, migrer, serialiser, type DonneesPartie } from './sauvegarde';

function exemple(): DonneesPartie {
  return {
    graine: 42,
    personnage: { x: 10.5, y: 6, z: -3, orientation: 1.2 },
    vue: 'troisieme',
    tempsJeu: 123.5,
    inventaire: ajouter(creerConteneur(4), 'bois', 12).conteneur,
    sac: ajouter(creerConteneur(2), 'pierre', 3).conteneur,
    retires: [
      { id: 'd:1:2', instant: 50 },
      { id: 'd:-3:4', instant: 100.5 },
    ],
    plantes: [{ id: 'p:0', type: 'sapin', x: 12, z: -7, rotation: 1, echelle: 1.1, variante: 1, instant: 80 }],
    compteurPlantes: 1,
    coffre: ajouter(creerConteneur(24), 'fibres', 7).conteneur,
    niveauVillage: 2,
    equipement: {
      outils: { hache: 'fer', pioche: 'base', epee: 'base' },
      armure: 'fibres' as const,
      casque: null,
      sacoche: true,
      bouclier: null,
      arc: false,
      durabilite: { hache: 80, pioche: 100, epee: 55, armure: 0 },
    },
    vie: 64,
    baluchon: { x: -12.5, z: 40, contenu: [{ objet: 'bois', quantite: 20 }, { objet: 'pierre', quantite: 4 }] },
    pointReapparition: { x: 1, z: 2, nom: 'Auberge' },
    progression: {
      niveau: 1,
      xp: 20,
      points: 2,
      noeuds: ['boule-de-feu', 'soin', 'robustesse'],
      mana: 40,
      secondSouffleJour: -1,
    },
    quetes: { enCours: [{ id: 'nuisibles', compteur: 2 }], terminees: ['bois-hiver'] },
    histoire: { etape: 5, compteur: 0, vus: [] },
    marchand: { visite: 2, achetes: { 'potion-soin': 1, fleche: 2 } },
    attaques: { dernierJour: 4 },
    lieux: { campDecouvert: true, autelDecouvert: false, morvanVaincu: false, coeurReforge: false },
    tresorsOuverts: ['co:ru:2:-3', 'co:gr:0:4'],
    potager: { dernierArrosage: null },
    feuCamp: { x: 40.5, z: -22 },
    pieges: [
      { id: 't:0', x: 10, z: -4, instant: 120, etat: 'attente' },
      { id: 't:1', x: 14, z: 2, instant: 300, etat: 'plein', prise: 'renard' },
    ],
    reperes: {
      liste: [
        { id: 1, type: 'filon', x: 10, z: -20 },
        { id: 3, type: 'tresor', x: -5.5, z: 7 },
        { id: 4, type: 'danger', x: 100, z: 0 },
      ],
      prochainId: 5,
      suivi: 3,
    },
    mine: { dedans: true, visitee: true },
  };
}

describe('sauvegarde : bouclier (v13 -> v14)', () => {
  it('une partie v13 est relue sans bouclier, le reste intact', () => {
    const v13 = JSON.parse(serialiser(exemple()));
    delete v13.equipement.bouclier;
    v13.version = 13;
    expect(migrer(v13)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v13), 42)!;
    expect(lue.equipement.bouclier).toBeNull();
    expect(lue).toEqual({ ...exemple(), pieges: [], equipement: { ...exemple().equipement, bouclier: null } });
  });

  it('garde le bouclier possédé (bois ou renforcé) et refuse un bouclier inconnu', () => {
    for (const bouclier of ['bois', 'renforce', null] as const) {
      const d = { ...exemple(), equipement: { ...exemple().equipement, bouclier } };
      expect(lirePartie(serialiser(d), 42)!.equipement.bouclier).toBe(bouclier);
    }
    const abime = JSON.parse(serialiser(exemple()));
    abime.equipement.bouclier = 'en-or';
    expect(lirePartie(JSON.stringify(abime), 42)).toBeNull();
  });
});

describe('sauvegarde : casque (v21 -> v22)', () => {
  it('une partie v21 est relue sans casque, le reste intact', () => {
    const v21 = JSON.parse(serialiser(exemple()));
    delete v21.equipement.casque;
    v21.version = 21;
    expect(migrer(v21)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v21), 42)!;
    expect(lue.equipement.casque).toBeNull();
    expect(lue).toEqual(exemple());
  });

  it('une partie v22 avec un casque revient identique', () => {
    for (const casque of ['cuir', 'fourrure', 'mailles', 'plaques'] as const) {
      const d = { ...exemple(), equipement: { ...exemple().equipement, casque } };
      expect(lirePartie(serialiser(d), 42)).toEqual(d);
    }
  });

  it("une vieille partie (v13) migrée jusqu'à la version courante finit sans casque", () => {
    const v13 = JSON.parse(serialiser(exemple()));
    delete v13.equipement.bouclier;
    delete v13.equipement.casque;
    v13.version = 13;
    const migree = migrer(v13)!;
    expect(migree.version).toBe(VERSION_SAUVEGARDE);
    expect((migree.equipement as { casque: unknown }).casque).toBeNull();
    expect(lirePartie(JSON.stringify(v13), 42)!.equipement.casque).toBeNull();
  });

  it('un champ casque absent dans une v22 se lit comme aucun casque', () => {
    const v22 = JSON.parse(serialiser(exemple()));
    delete v22.equipement.casque;
    expect(lirePartie(JSON.stringify(v22), 42)!.equipement.casque).toBeNull();
  });

  it('refuse un casque inconnu', () => {
    const abime = JSON.parse(serialiser(exemple()));
    abime.equipement.casque = 'couronne';
    expect(lirePartie(JSON.stringify(abime), 42)).toBeNull();
  });
});

describe('sauvegarde', () => {
  it('relit exactement ce qu\'elle a écrit', () => {
    const d = exemple();
    expect(lirePartie(serialiser(d), 42)).toEqual(d);
  });

  it('écrit le numéro de version', () => {
    expect(JSON.parse(serialiser(exemple())).version).toBe(VERSION_SAUVEGARDE);
  });

  it('renvoie null pour une absence, du texte abîmé ou un JSON sans rapport', () => {
    expect(lirePartie(null, 42)).toBeNull();
    expect(lirePartie('', 42)).toBeNull();
    expect(lirePartie('{pas du json', 42)).toBeNull();
    expect(lirePartie('42', 42)).toBeNull();
    expect(lirePartie('[]', 42)).toBeNull();
    expect(lirePartie('{}', 42)).toBeNull();
  });

  it('garde la fourrure de loup, et un objet inconnu du catalogue reste chargeable', () => {
    const avecFourrure = { ...exemple(), inventaire: ajouter(ajouter(creerConteneur(4), 'bois', 12).conteneur, 'fourrure', 3).conteneur };
    expect(lirePartie(serialiser(avecFourrure), 42)?.inventaire).toEqual(avecFourrure.inventaire);
    // Une sauvegarde d'avant la fourrure (sans cet objet) se relit telle quelle
    expect(lirePartie(serialiser(exemple()), 42)?.inventaire).toEqual(exemple().inventaire);
    const base = JSON.parse(serialiser(exemple()));
    const inconnu = { cases: [{ objet: 'objet-d-une-autre-version', quantite: 2 }, null, null, null] };
    expect(lirePartie(JSON.stringify({ ...base, inventaire: inconnu }), 42)?.inventaire).toEqual(inconnu);
  });

  it('refuse une autre graine, une version inconnue ou plus récente', () => {
    const texte = serialiser(exemple());
    expect(lirePartie(texte, 43)).toBeNull();
    const futur = JSON.stringify({ ...JSON.parse(texte), version: VERSION_SAUVEGARDE + 1 });
    expect(lirePartie(futur, 42)).toBeNull();
    const sansVersion = JSON.stringify({ ...JSON.parse(texte), version: undefined });
    expect(lirePartie(sansVersion, 42)).toBeNull();
    expect(migrer({ version: 0 })).toBeNull();
  });

  it('refuse des données abîmées', () => {
    const base = JSON.parse(serialiser(exemple()));
    const abimer = (changement: Record<string, unknown>) => lirePartie(JSON.stringify({ ...base, ...changement }), 42);
    expect(abimer({ personnage: { x: 'a', y: 0, z: 0, orientation: 0 } })).toBeNull();
    expect(abimer({ personnage: null })).toBeNull();
    expect(abimer({ vue: 'cinquieme' })).toBeNull();
    expect(abimer({ tempsJeu: -5 })).toBeNull();
    expect(abimer({ inventaire: { cases: [{ objet: 'bois', quantite: -2 }] } })).toBeNull();
    expect(abimer({ inventaire: { cases: [{ objet: 'bois', quantite: 1.5 }] } })).toBeNull();
    expect(abimer({ sac: { cases: 'oups' } })).toBeNull();
    expect(abimer({ sac: { cases: [] } })).toBeNull();
    expect(abimer({ retires: [1, 2] })).toBeNull();
    expect(abimer({ retires: undefined })).toBeNull();
    expect(abimer({ retires: [{ id: 'd:1:2' }] })).toBeNull();
    expect(abimer({ plantes: [{ ...base.plantes[0], type: 'rocher' }] })).toBeNull();
    expect(abimer({ plantes: [{ ...base.plantes[0], variante: 5 }] })).toBeNull();
    expect(abimer({ plantes: undefined })).toBeNull();
    expect(abimer({ compteurPlantes: -1 })).toBeNull();
    expect(abimer({ coffre: undefined })).toBeNull();
    expect(abimer({ coffre: { cases: [{ objet: '', quantite: 1 }] } })).toBeNull();
    expect(abimer({ niveauVillage: 0 })).toBeNull();
    expect(abimer({ niveauVillage: 4 })).toBeNull();
    expect(abimer({ niveauVillage: 1.5 })).toBeNull();
    expect(abimer({ equipement: undefined })).toBeNull();
    expect(abimer({ equipement: { ...base.equipement, armure: 'oui' } })).toBeNull();
    expect(abimer({ equipement: { ...base.equipement, outils: { hache: 'or', pioche: 'base', epee: 'base' } } })).toBeNull();
    expect(abimer({ equipement: { ...base.equipement, outils: { hache: 'fer' } } })).toBeNull();
    expect(abimer({ equipement: { ...base.equipement, durabilite: undefined } })).toBeNull();
    expect(abimer({ equipement: { ...base.equipement, durabilite: { ...base.equipement.durabilite, hache: -1 } } })).toBeNull();
    expect(abimer({ equipement: { ...base.equipement, durabilite: { hache: 5 } } })).toBeNull();
    expect(abimer({ baluchon: undefined })).toBeNull();
    expect(abimer({ baluchon: { x: 1, z: 1, contenu: [] } })).toBeNull();
    expect(abimer({ baluchon: { x: 'a', z: 1, contenu: [{ objet: 'bois', quantite: 1 }] } })).toBeNull();
    expect(abimer({ baluchon: { x: 1, z: 1, contenu: [{ objet: 'bois', quantite: 0 }] } })).toBeNull();
    expect(abimer({ pointReapparition: undefined })).toBeNull();
    expect(abimer({ pointReapparition: { x: 1, z: 'b', nom: 'x' } })).toBeNull();
  });

  it('charge en 1re personne une ancienne sauvegarde en vue diagonale', () => {
    const base = JSON.parse(serialiser(exemple()));
    const ancienne = lirePartie(JSON.stringify({ ...base, vue: 'diagonale' }), 42);
    expect(ancienne?.vue).toBe('premiere');
    expect(lirePartie(JSON.stringify({ ...base, vue: 'troisieme' }), 42)?.vue).toBe('troisieme');
  });

  it('migre la version 1 : identifiants retirés -> identifiant + instant de la sauvegarde', () => {
    const v1 = {
      ...JSON.parse(serialiser(exemple())),
      version: 1,
      retires: ['d:1:2', 'd:-3:4'],
      plantes: undefined,
      compteurPlantes: undefined,
    };
    const partie = lirePartie(JSON.stringify(v1), 42);
    expect(partie).not.toBeNull();
    expect(partie!.retires).toEqual([
      { id: 'd:1:2', instant: 123.5 },
      { id: 'd:-3:4', instant: 123.5 },
    ]);
    expect(partie!.plantes).toEqual([]);
    expect(partie!.compteurPlantes).toBe(0);
    expect(partie!.inventaire).toEqual(exemple().inventaire);
    expect(migrer(v1)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('migre la version 2 : village au niveau 1 et coffre vide', () => {
    const v2 = { ...JSON.parse(serialiser(exemple())), version: 2, coffre: undefined, niveauVillage: undefined };
    const partie = lirePartie(JSON.stringify(v2), 42);
    expect(partie).not.toBeNull();
    expect(partie!.niveauVillage).toBe(1);
    expect(partie!.coffre.cases).toHaveLength(CONFIG.inventaire.casesCoffre);
    expect(partie!.coffre.cases.every((c) => c === null)).toBe(true);
    expect(partie!.inventaire).toEqual(exemple().inventaire);
    expect(partie!.plantes).toEqual(exemple().plantes);
  });

  it('migre la version 3 : outils de base, sans armure ni sacoche, inventaire inchangé', () => {
    const v3 = { ...JSON.parse(serialiser(exemple())), version: 3, equipement: undefined };
    const partie = lirePartie(JSON.stringify(v3), 42);
    expect(partie).not.toBeNull();
    expect(partie!.equipement).toEqual(creerEquipement());
    expect(partie!.inventaire).toEqual(exemple().inventaire);
    expect(partie!.niveauVillage).toBe(2);
    expect(migrer(v3)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('migre la version 4 : le joueur a toute sa vie', () => {
    // Avant la v11, l'armure était un booléen
    const v4 = { ...JSON.parse(serialiser(exemple())), version: 4, vie: undefined, equipement: { ...exemple().equipement, armure: true } };
    const partie = lirePartie(JSON.stringify(v4), 42);
    expect(partie).not.toBeNull();
    expect(partie!.vie).toBe(CONFIG.combat.vieMax);
    expect(partie!.equipement).toEqual(exemple().equipement);
    expect(migrer(v4)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it("migre la version 10 : un outil fer reste fer, la durabilité est gardée, l'armure de fibres reste", () => {
    const base = JSON.parse(serialiser(exemple()));
    const v10 = {
      ...base,
      version: 10,
      equipement: {
        outils: { hache: 'fer', pioche: 'base', epee: 'fer' },
        armure: true,
        sacoche: true,
        durabilite: { hache: 80, pioche: 100, epee: 100, armure: 30 },
      },
    };
    const partie = lirePartie(JSON.stringify(v10), 42)!;
    expect(partie).not.toBeNull();
    expect(partie.equipement.outils).toEqual({ hache: 'fer', pioche: 'base', epee: 'fer' });
    expect(partie.equipement.armure).toBe('fibres');
    expect(partie.equipement.sacoche).toBe(true);
    // L'ancienne durabilité est gardée (le maximum du fer est 200, celui de la base 100)
    expect(partie.equipement.durabilite).toEqual({ hache: 80, pioche: 100, epee: 100, armure: 30 });
    expect(migrer(v10)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('migre la version 10 sans armure : aucune armure portée', () => {
    const base = JSON.parse(serialiser(exemple()));
    const v10 = { ...base, version: 10, equipement: { ...base.equipement, armure: false } };
    expect(lirePartie(JSON.stringify(v10), 42)!.equipement.armure).toBeNull();
  });

  it('borne la durabilité au maximum du palier et refuse un palier ou une armure inconnus', () => {
    const base = JSON.parse(serialiser(exemple()));
    const trop = { ...base, equipement: { ...base.equipement, durabilite: { hache: 500, pioche: 500, epee: 500, armure: 500 } } };
    // exemple() : outils de base (max 100), armure de fibres (max 100)
    const lue = lirePartie(JSON.stringify(trop), 42)!.equipement;
    expect(lue.durabilite.hache).toBe(CONFIG.fabrication.paliers[lue.outils.hache].durabilite);
    expect(lue.durabilite.armure).toBe(CONFIG.durabilite.max);
    const acier = { ...base, equipement: { ...base.equipement, outils: { hache: 'acier', pioche: 'cuivre', epee: 'cristal' }, durabilite: { hache: 250, pioche: 500, epee: 399, armure: 10 } } };
    const e = lirePartie(JSON.stringify(acier), 42)!.equipement;
    expect(e.outils.hache).toBe('acier');
    expect(e.durabilite).toEqual({ hache: 250, pioche: 150, epee: 399, armure: 10 });
    expect(lirePartie(JSON.stringify({ ...base, equipement: { ...base.equipement, outils: { ...base.equipement.outils, hache: 'mithril' } } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, equipement: { ...base.equipement, armure: 'diamant' } }), 42)).toBeNull();
  });

  it('migre la version 5 : durabilités neuves, pas de baluchon, réapparition sur la place', () => {
    const { durabilite: _d, ...equipementV5 } = exemple().equipement;
    const v5 = {
      ...JSON.parse(serialiser(exemple())),
      version: 5,
      equipement: { ...equipementV5, armure: true },
      baluchon: undefined,
      pointReapparition: undefined,
    };
    const partie = lirePartie(JSON.stringify(v5), 42);
    expect(partie).not.toBeNull();
    expect(partie!.equipement).toEqual({ ...equipementV5, durabilite: creerEquipement().durabilite });
    expect(partie!.baluchon).toBeNull();
    expect(partie!.pointReapparition).toEqual(POINT_REAPPARITION_DEFAUT);
    expect(partie!.inventaire).toEqual(exemple().inventaire);
    expect(migrer(v5)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it("migre la version 4 jusqu'à la version courante : durabilités et baluchon compris", () => {
    const v4 = { ...JSON.parse(serialiser(exemple())), version: 4, vie: undefined, equipement: { outils: exemple().equipement.outils, armure: false, sacoche: false }, baluchon: undefined };
    const partie = lirePartie(JSON.stringify(v4), 42);
    expect(partie!.equipement.durabilite).toEqual(creerEquipement().durabilite);
    expect(partie!.baluchon).toBeNull();
  });

  it('refuse une vie abîmée et ramène une vie trop grande au maximum', () => {
    const brut = JSON.parse(serialiser(exemple()));
    expect(lirePartie(JSON.stringify({ ...brut, vie: -5 }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...brut, vie: 'beaucoup' }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...brut, vie: 5000 }), 42)!.vie).toBe(CONFIG.combat.vieMax + 20);
  });

  it('migre la version 1 jusqu\'à la version courante, équipement compris', () => {
    const v1 = { ...JSON.parse(serialiser(exemple())), version: 1, retires: [], equipement: undefined };
    expect(lirePartie(JSON.stringify(v1), 42)!.equipement).toEqual(creerEquipement());
  });

  it('refuse une version 1 dont la liste des retirés est abîmée', () => {
    const v1 = { ...JSON.parse(serialiser(exemple())), version: 1, retires: [1, 2] };
    expect(lirePartie(JSON.stringify(v1), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...v1, retires: undefined }), 42)).toBeNull();
  });

  it('migre la version 6 : niveau 1, aucun point, aucun nœud, mana plein', () => {
    const v6 = { ...JSON.parse(serialiser(exemple())), version: 6, progression: undefined };
    const partie = lirePartie(JSON.stringify(v6), 42);
    expect(partie?.progression).toEqual({
      niveau: 1,
      xp: 0,
      points: 0,
      noeuds: [],
      mana: CONFIG.progression.mana.max,
      secondSouffleJour: -1,
    });
    // Le reste de la partie est inchangé
    expect(partie?.inventaire).toEqual(exemple().inventaire);
    expect(migrer(v6)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('refuse une progression abîmée', () => {
    const base = JSON.parse(serialiser(exemple()));
    const p = base.progression;
    expect(lirePartie(JSON.stringify({ ...base, progression: undefined }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, progression: { ...p, niveau: 0 } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, progression: { ...p, points: -1 } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, progression: { ...p, noeuds: 'robustesse' } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, progression: { ...p, noeuds: [3] } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, progression: { ...p, secondSouffleJour: -5 } }), 42)).toBeNull();
  });

  it("ignore les nœuds inconnus, en double ou dont le prérequis manque", () => {
    const base = JSON.parse(serialiser(exemple()));
    const noeuds = ['boule-de-feu', 'boule-de-feu', 'nœud-imaginaire', 'riposte', 'soin'];
    const partie = lirePartie(JSON.stringify({ ...base, progression: { ...base.progression, noeuds } }), 42);
    expect(partie?.progression.noeuds).toEqual(['boule-de-feu', 'soin']);
  });

  it('ramène le mana au maximum et la vie au maximum permis par la Robustesse', () => {
    const base = JSON.parse(serialiser(exemple()));
    const p = { ...base.progression, mana: 999, noeuds: [] };
    const partie = lirePartie(JSON.stringify({ ...base, progression: p, vie: 150 }), 42);
    expect(partie?.progression.mana).toBe(CONFIG.progression.mana.max);
    expect(partie?.vie).toBe(CONFIG.combat.vieMax);
    const forte = { ...p, noeuds: ['robustesse'] };
    expect(lirePartie(JSON.stringify({ ...base, progression: forte, vie: 150 }), 42)?.vie).toBe(CONFIG.combat.vieMax + 20);
  });

  it("migre la version 11 : les rangs disparaissent et tous les points dépensés sont rendus", () => {
    const v11 = {
      ...JSON.parse(serialiser(exemple())),
      version: 11,
      progression: {
        niveau: 4,
        xp: 120,
        points: 2,
        rangs: { combat: 1, recolte: 2, artisanat: 0, resistance: 0, transport: 1, magie: 3 },
        mana: 40,
      },
    };
    const partie = lirePartie(JSON.stringify(v11), 42);
    // 2 points disponibles + (1 + 2 + 0 + 0 + 1 + 3) points dépensés, + 1 point : la courbe d'XP adoucie (v22 -> v23)
    // fait passer cette partie du niveau 4 (120 XP) au niveau 5 (325 XP)
    expect(partie?.progression).toEqual({ niveau: 5, xp: 325, points: 10, noeuds: [], mana: 40, secondSouffleJour: -1 });
    expect(partie?.arbreMigre).toBe(true);
    expect(migrer(v11)!.version).toBe(VERSION_SAUVEGARDE);
    // Le reste de la partie est inchangé
    expect(partie?.inventaire).toEqual(exemple().inventaire);
  });

  it("migre la version 11 sans rang dépensé : points inchangés, message quand même", () => {
    const v11 = {
      ...JSON.parse(serialiser(exemple())),
      version: 11,
      progression: { niveau: 1, xp: 0, points: 0, rangs: { combat: 0, recolte: 0, artisanat: 0, resistance: 0, transport: 0, magie: 0 }, mana: 50 },
    };
    const partie = lirePartie(JSON.stringify(v11), 42);
    expect(partie?.progression.points).toBe(0);
    expect(partie?.arbreMigre).toBe(true);
  });

  it("n'annonce pas de migration pour une sauvegarde déjà à la version de l'arbre", () => {
    expect(lirePartie(serialiser(exemple()), 42)?.arbreMigre).toBeUndefined();
  });

  it("n'annonce pas de migration pour une partie très ancienne (v6), qui n'avait aucun rang", () => {
    const v6 = { ...JSON.parse(serialiser(exemple())), version: 6, progression: undefined };
    expect(lirePartie(JSON.stringify(v6), 42)?.arbreMigre).toBeUndefined();
  });

  it('Maître forgeron : la durabilité lue peut dépasser le maximum de base', () => {
    const base = JSON.parse(serialiser(exemple()));
    const progression = { ...base.progression, noeuds: ['forgeron', 'maitre-forgeron'] };
    const equipement = { ...base.equipement, durabilite: { hache: 250, pioche: 100, epee: 55, armure: 0 } };
    const partie = lirePartie(JSON.stringify({ ...base, progression, equipement }), 42);
    expect(partie?.equipement.durabilite.hache).toBeGreaterThan(CONFIG.fabrication.paliers.fer.durabilite);
    expect(partie?.equipement.facteurDurabilite).toBe(1.5);
  });

  it('migre la version 7 : aucune quête acceptée ni terminée, le reste est inchangé', () => {
    const v7 = { ...JSON.parse(serialiser(exemple())), version: 7, quetes: undefined, niveauVillage: 1 };
    const partie = lirePartie(JSON.stringify(v7), 42);
    expect(partie?.quetes).toEqual({ enCours: [], terminees: [] });
    expect(partie?.progression).toEqual(exemple().progression);
    expect(migrer(v7)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('migre la version 8 : aucun feu de camp posé, le reste est inchangé', () => {
    const v8 = { ...JSON.parse(serialiser(exemple())), version: 8, feuCamp: undefined, niveauVillage: 1 };
    const partie = lirePartie(JSON.stringify(v8), 42);
    expect(partie?.feuCamp).toBeNull();
    expect(partie?.quetes).toEqual(exemple().quetes);
    expect(partie?.pointReapparition).toEqual(exemple().pointReapparition);
    expect(migrer(v8)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('migre la version 12 : une quête faite compte, avec ses précédentes de la même chaîne', () => {
    const quetes = {
      enCours: [{ id: 'quete-disparue', compteur: 1 }, { id: 'nuisibles', compteur: 2 }],
      terminees: ['vrai-forgeron', 'replanter', 'bois-hiver'],
    };
    const v12 = { ...JSON.parse(serialiser(exemple())), version: 12, niveauVillage: 1, quetes };
    const partie = lirePartie(JSON.stringify(v12), 42);
    expect(partie?.quetes.enCours).toEqual([{ id: 'nuisibles', compteur: 2 }]);
    const finies = new Set(partie?.quetes.terminees);
    // forgeron : 1 à 4 ; Mathilde : 1 et 2 (remedes avant replanter) ; Marthe : bois-hiver
    for (const id of ['premier-lingot', 'outils-cuivre', 'charbon-forge', 'vrai-forgeron', 'remedes', 'replanter', 'bois-hiver']) {
      expect(finies.has(id)).toBe(true);
    }
    expect(finies.has('armure-digne')).toBe(false);
    expect(finies.has('renforcer-village')).toBe(false);
    expect(migrer(v12)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('migre la version 12 : les quêtes avant une quête en cours sont faites, même jamais terminées', () => {
    const quetes = { enCours: [{ id: 'gobelins', compteur: 1 }], terminees: ['nuisibles'] };
    const v12 = { ...JSON.parse(serialiser(exemple())), version: 12, niveauVillage: 1, quetes };
    const partie = lirePartie(JSON.stringify(v12), 42);
    expect(partie?.quetes.enCours).toEqual([{ id: 'gobelins', compteur: 1 }]);
    expect(partie?.quetes.terminees).toEqual(expect.arrayContaining(['nuisibles', 'pierres-puits']));
    expect(partie?.quetes.terminees).not.toContain('gobelins');
  });

  it("migre la version 12 : un village déjà agrandi compte les quêtes de Gaspard qui l'autorisent", () => {
    const quetes = { enCours: [{ id: 'renforcer-village', compteur: 0 }], terminees: [] };
    const v12 = { ...JSON.parse(serialiser(exemple())), version: 12, niveauVillage: 3, quetes };
    const partie = lirePartie(JSON.stringify(v12), 42);
    expect(partie?.quetes.enCours).toEqual([]);
    expect(partie?.quetes.terminees).toEqual(expect.arrayContaining(['nuisibles', 'pierres-puits', 'gobelins', 'voyageurs-detrousses', 'renforcer-village', 'le-guetteur']));
    expect(partie?.quetes.terminees).not.toContain('pillards-organises');
  });

  it('migre la version 12 : un état de quêtes abîmé reste abîmé (refusé à la lecture)', () => {
    const v12 = { ...JSON.parse(serialiser(exemple())), version: 12, quetes: { enCours: 'x', terminees: [] } };
    expect(lirePartie(JSON.stringify(v12), 42)).toBeNull();
  });

  it('relit un feu absent (null) et refuse un feu abîmé', () => {
    const base = JSON.parse(serialiser(exemple()));
    expect(lirePartie(JSON.stringify({ ...base, feuCamp: null }), 42)?.feuCamp).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, feuCamp: { x: 'a', z: 1 } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, feuCamp: 3 }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, feuCamp: undefined }), 42)).toBeNull();
  });

  it('refuse des quêtes abîmées, ignore les identifiants inconnus', () => {
    const base = JSON.parse(serialiser(exemple()));
    expect(lirePartie(JSON.stringify({ ...base, quetes: undefined }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, quetes: { enCours: [{ id: 'nuisibles', compteur: -1 }], terminees: [] } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...base, quetes: { enCours: [], terminees: [3] } }), 42)).toBeNull();
    const inconnues = {
      enCours: [{ id: 'quete-future', compteur: 1 }, { id: 'nuisibles', compteur: 1 }],
      terminees: ['autre', 'bois-hiver', 'nuisibles'],
    };
    // 'nuisibles' est terminée : elle n'est plus en cours
    expect(lirePartie(JSON.stringify({ ...base, quetes: inconnues }), 42)?.quetes).toEqual({
      enCours: [],
      terminees: ['bois-hiver', 'nuisibles'],
    });
  });

  it('migre une sauvegarde de la version courante sans la changer', () => {
    const brut = JSON.parse(serialiser(exemple()));
    expect(migrer(brut)).toEqual(brut);
  });
});

describe('sauvegarde de la mine', () => {
  it("migre la version 9 : le joueur est dehors et n'a jamais visité la mine", () => {
    const v9 = { ...JSON.parse(serialiser(exemple())), version: 9, mine: undefined };
    const partie = lirePartie(JSON.stringify(v9), 42);
    expect(partie).not.toBeNull();
    expect(partie!.mine).toEqual({ dedans: false, visitee: false });
    expect(partie!.feuCamp).toEqual({ x: 40.5, z: -22 });
    expect(migrer(v9)!.version).toBe(VERSION_SAUVEGARDE);
  });

  it('retient si le joueur est dans la mine, sa position et les éléments m:<n> retirés', () => {
    const d = exemple();
    d.personnage = { x: 50036, y: 20, z: 50007, orientation: 0 };
    d.retires = [...d.retires, { id: 'm:12', instant: 110 }];
    const relue = lirePartie(serialiser(d), 42)!;
    expect(relue.mine).toEqual({ dedans: true, visitee: true });
    expect(relue.personnage).toEqual(d.personnage);
    expect(relue.retires).toContainEqual({ id: 'm:12', instant: 110 });
  });

  it('refuse une mine abîmée', () => {
    const brut = JSON.parse(serialiser(exemple()));
    expect(lirePartie(JSON.stringify({ ...brut, mine: null }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...brut, mine: { dedans: 'oui', visitee: true } }), 42)).toBeNull();
    expect(lirePartie(JSON.stringify({ ...brut, mine: { dedans: true } }), 42)).toBeNull();
  });
});

describe('sauvegarde : pièges (v14 -> v15)', () => {
  it('une partie v14 est relue sans piège, le reste intact', () => {
    const v14 = JSON.parse(serialiser(exemple()));
    delete v14.pieges;
    v14.version = 14;
    expect(migrer(v14)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v14), 42)!;
    expect(lue.pieges).toEqual([]);
    expect(lue.feuCamp).toEqual({ x: 40.5, z: -22 });
  });

  it('retient les pièges (position, instant, état, proie)', () => {
    const lue = lirePartie(serialiser(exemple()), 42)!;
    expect(lue.pieges).toEqual(exemple().pieges);
  });

  it('refuse des pièges abîmés : proie inconnue, plein sans proie, trop nombreux, doublon, position absurde', () => {
    const base = JSON.parse(serialiser(exemple()));
    const avec = (pieges: unknown) => lirePartie(JSON.stringify({ ...base, pieges }), 42);
    expect(avec([{ id: 't:0', x: 1, z: 1, instant: 0, etat: 'plein', prise: 'dragon' }])).toBeNull();
    expect(avec([{ id: 't:0', x: 1, z: 1, instant: 0, etat: 'plein' }])).toBeNull();
    expect(avec([{ id: 't:0', x: 1, z: 1, instant: 0, etat: 'vide' }])).toBeNull();
    expect(avec(Array.from({ length: 6 }, (_, i) => ({ id: `t:${i}`, x: i * 5, z: 0, instant: 0, etat: 'attente' })))).toBeNull();
    expect(avec([{ id: 't:0', x: 1, z: 1, instant: 0, etat: 'attente' }, { id: 't:0', x: 9, z: 1, instant: 0, etat: 'attente' }])).toBeNull();
    expect(avec([{ id: 't:0', x: 'a', z: 1, instant: 0, etat: 'attente' }])).toBeNull();
    expect(avec(undefined)).toBeNull();
  });
});

describe('sauvegarde : arc (v15 -> v16)', () => {
  it('une partie v15 est relue sans arc, le reste intact', () => {
    const v15 = JSON.parse(serialiser(exemple()));
    delete v15.equipement.arc;
    v15.version = 15;
    expect(migrer(v15)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v15), 42)!;
    expect(lue.equipement.arc).toBe(false);
    expect(lue).toEqual(exemple());
  });

  it("garde l'arc possédé et refuse une valeur abîmée", () => {
    const d = { ...exemple(), equipement: { ...exemple().equipement, arc: true } };
    expect(lirePartie(serialiser(d), 42)!.equipement.arc).toBe(true);
    const abime = JSON.parse(serialiser(exemple()));
    abime.equipement.arc = 'oui';
    expect(lirePartie(JSON.stringify(abime), 42)).toBeNull();
  });
});

describe('sauvegarde : histoire (v16 -> v17)', () => {
  /** Une sauvegarde v16 (sans histoire) tirée de l'exemple, modifiée par `changer`. */
  function v16(changer: (d: Record<string, any>) => void = () => {}) {
    const d = JSON.parse(serialiser(exemple()));
    delete d.histoire;
    d.version = 16;
    changer(d);
    return d;
  }
  const etapeLue = (d: unknown) => lirePartie(JSON.stringify(d), 42)!.histoire.etape;

  it('une partie v16 est migrée, le reste intact', () => {
    expect(migrer(v16())!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v16()), 42)!;
    // L'exemple a un village de niveau 2 : l'histoire reprend au début de l'acte II
    expect(lue.histoire).toEqual({ ...creerEtatHistoire(), etape: 9 });
    expect(lue).toEqual({ ...exemple(), histoire: { ...creerEtatHistoire(), etape: 9 } });
  });

  it('une partie v16 : village niveau 2 -> acte II ; outils en cuivre -> slimes ; mine ou quêtes -> acte I ; sinon prologue', () => {
    const neuve = (d: Record<string, any>) => {
      d.niveauVillage = 1;
      d.equipement.outils = { hache: 'base', pioche: 'base', epee: 'base' };
      d.mine = { dedans: false, visitee: false };
      d.quetes = { enCours: [], terminees: [] };
    };
    expect(etapeLue(v16((d) => { neuve(d); d.niveauVillage = 3; }))).toBe(9);
    expect(etapeLue(v16((d) => { neuve(d); d.equipement.outils.pioche = 'cuivre'; }))).toBe(6);
    expect(etapeLue(v16((d) => { neuve(d); d.equipement.outils.epee = 'fer'; }))).toBe(6);
    expect(etapeLue(v16((d) => { neuve(d); d.mine.visitee = true; }))).toBe(4);
    expect(etapeLue(v16((d) => { neuve(d); d.quetes.terminees = ['bois-hiver']; }))).toBe(4);
    expect(etapeLue(v16(neuve))).toBe(0);
  });

  it("une partie v16 dont l'histoire est abîmée repart de l'étape que sa progression justifie", () => {
    const v16 = JSON.parse(serialiser(exemple()));
    v16.histoire = { etape: 'trois' };
    v16.version = 16;
    expect(lirePartie(JSON.stringify(v16), 42)!.histoire).toEqual({ ...creerEtatHistoire(), etape: 9 });
  });

  it("retient l'étape, le compteur et les habitants rencontrés", () => {
    const d = { ...exemple(), histoire: { etape: 4, compteur: 0, vus: ['marthe', 'bertil'] } };
    expect(lirePartie(serialiser(d), 42)!.histoire).toEqual(d.histoire);
  });

  it('refuse une histoire abîmée : étape hors limites, compteur négatif, habitants mal formés, absente', () => {
    const base = JSON.parse(serialiser(exemple()));
    const avec = (histoire: unknown) => lirePartie(JSON.stringify({ ...base, histoire }), 42);
    expect(avec({ etape: 99, compteur: 0, vus: [] })).toBeNull();
    expect(avec({ etape: -1, compteur: 0, vus: [] })).toBeNull();
    expect(avec({ etape: 1, compteur: -2, vus: [] })).toBeNull();
    expect(avec({ etape: 1, compteur: 0, vus: [3] })).toBeNull();
    expect(avec({ etape: 1.5, compteur: 0, vus: [] })).toBeNull();
    expect(avec(undefined)).toBeNull();
  });
});

describe('sauvegarde : marchand (v17 -> v18)', () => {
  it("une partie v17 est relue sans visite ni achat, le reste intact", () => {
    const v17 = JSON.parse(serialiser(exemple()));
    delete v17.marchand;
    v17.version = 17;
    expect(migrer(v17)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v17), 42)!;
    expect(lue.marchand).toEqual(creerEtatMarchand());
    expect(lue).toEqual({ ...exemple(), marchand: creerEtatMarchand() });
  });

  it("une partie v17 dont le marchand est abîmé repart d'un état neuf", () => {
    const v17 = JSON.parse(serialiser(exemple()));
    v17.marchand = { visite: 'deux' };
    v17.version = 17;
    expect(lirePartie(JSON.stringify(v17), 42)!.marchand).toEqual(creerEtatMarchand());
  });

  it('retient la visite et les lots achetés', () => {
    expect(lirePartie(serialiser(exemple()), 42)!.marchand).toEqual(exemple().marchand);
  });

  it('refuse un marchand abîmé : visite négative ou décimale, achats mal formés, absent', () => {
    const base = JSON.parse(serialiser(exemple()));
    const avec = (marchand: unknown) => lirePartie(JSON.stringify({ ...base, marchand }), 42);
    expect(avec({ visite: -1, achetes: {} })).toBeNull();
    expect(avec({ visite: 1.5, achetes: {} })).toBeNull();
    expect(avec({ visite: 1, achetes: { fleche: -2 } })).toBeNull();
    expect(avec({ visite: 1, achetes: { fleche: 'trois' } })).toBeNull();
    expect(avec({ visite: 1, achetes: [] })).toBeNull();
    expect(avec(undefined)).toBeNull();
  });
});


describe('sauvegarde : attaques de bandits (v18 -> v19)', () => {
  it("une partie v18 est relue sans jour d'attaque traité (-1), le reste intact", () => {
    const v18 = JSON.parse(serialiser(exemple()));
    delete v18.attaques;
    v18.version = 18;
    expect(migrer(v18)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v18), 42)!;
    expect(lue.attaques).toEqual(creerEtatAttaques());
    expect(lue.attaques.dernierJour).toBe(-1);
    expect(lue).toEqual({ ...exemple(), attaques: creerEtatAttaques() });
  });

  it("une partie v18 dont l'état des attaques est abîmé repart d'un état neuf", () => {
    const v18 = JSON.parse(serialiser(exemple()));
    v18.attaques = { dernierJour: 'hier' };
    v18.version = 18;
    expect(lirePartie(JSON.stringify(v18), 42)!.attaques).toEqual(creerEtatAttaques());
  });

  it('retient le dernier jour traité', () => {
    expect(lirePartie(serialiser(exemple()), 42)!.attaques).toEqual({ dernierJour: 4 });
  });

  it('refuse un état abîmé : jour décimal, trop petit, absent', () => {
    const base = JSON.parse(serialiser(exemple()));
    const avec = (attaques: unknown) => lirePartie(JSON.stringify({ ...base, attaques }), 42);
    expect(avec({ dernierJour: 1.5 })).toBeNull();
    expect(avec({ dernierJour: -2 })).toBeNull();
    expect(avec({})).toBeNull();
    expect(avec(undefined)).toBeNull();
  });
});

describe('sauvegarde : lieux de l\'histoire, Morvan et Cœur (v19 -> v20)', () => {
  const v19 = (etape: number, compteur = 0): Record<string, unknown> => {
    const brut = JSON.parse(serialiser(exemple()));
    delete brut.lieux;
    brut.version = 19;
    brut.histoire = { etape, compteur, vus: [] };
    return brut;
  };

  it('une partie v19 est relue sans rien de découvert ni de vaincu, le reste intact', () => {
    const brut = v19(5);
    expect(migrer(brut)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(brut), 42)!;
    expect(lue.lieux).toEqual(creerEtatLieux());
    expect(lue).toEqual({ ...exemple(), lieux: creerEtatLieux() });
  });

  it('une partie arrêtée sur « éclaireurs » (16) ou « porter à Aldric » (17) reprend à « Trouve le camp », compteur à zéro', () => {
    for (const [etape, compteur] of [[16, 4], [17, 0]] as const) {
      const lue = lirePartie(JSON.stringify(v19(etape, compteur)), 42)!;
      expect(lue.histoire).toEqual({ etape: 19, compteur: 0, vus: [] });
      expect(lue.lieux).toEqual(creerEtatLieux());
    }
  });

  it('avant l\'acte IV provisoire, l\'étape ne change pas', () => {
    expect(lirePartie(JSON.stringify(v19(15)), 42)!.histoire.etape).toBe(18);
    expect(lirePartie(JSON.stringify(v19(9, 2)), 42)!.histoire).toEqual({ etape: 9, compteur: 2, vus: [] });
  });

  it('l\'épilogue (18) et l\'histoire finie (19) sont décalés d\'un rang, Morvan vaincu et Cœur reforgé', () => {
    const acquis = { campDecouvert: true, autelDecouvert: true, morvanVaincu: true, coeurReforge: true };
    const epilogue = lirePartie(JSON.stringify(v19(18)), 42)!;
    expect(epilogue.histoire.etape).toBe(22);
    expect(epilogue.lieux).toEqual(acquis);
    const finie = lirePartie(JSON.stringify(v19(19)), 42)!;
    expect(finie.histoire.etape).toBe(23);
    expect(finie.lieux).toEqual(acquis);
  });

  it('retient les lieux découverts, Morvan vaincu et le Cœur reforgé', () => {
    const d = { ...exemple(), lieux: { campDecouvert: true, autelDecouvert: true, morvanVaincu: true, coeurReforge: true } };
    expect(lirePartie(serialiser(d), 42)!.lieux).toEqual(d.lieux);
    expect(lirePartie(serialiser(exemple()), 42)!.lieux).toEqual(exemple().lieux);
  });

  it('refuse un état des lieux abîmé : champ manquant, mauvais type, absent', () => {
    const base = JSON.parse(serialiser(exemple()));
    const avec = (lieux: unknown) => lirePartie(JSON.stringify({ ...base, lieux }), 42);
    expect(avec({ campDecouvert: true, autelDecouvert: false, morvanVaincu: false })).toBeNull();
    expect(avec({ campDecouvert: 1, autelDecouvert: false, morvanVaincu: false, coeurReforge: false })).toBeNull();
    expect(avec([])).toBeNull();
    expect(avec(undefined)).toBeNull();
  });
});

describe('sauvegarde : coffres des ruines et des grottes (session 3b)', () => {
  it('retient les coffres ouverts', () => {
    expect(lirePartie(serialiser(exemple()), 42)!.tresorsOuverts).toEqual(['co:ru:2:-3', 'co:gr:0:4']);
    expect(lirePartie(serialiser({ ...exemple(), tresorsOuverts: [] }), 42)!.tresorsOuverts).toEqual([]);
  });

  it("une sauvegarde d'avant les ruines (sans la liste) se charge, sans coffre ouvert", () => {
    const base = JSON.parse(serialiser(exemple()));
    delete base.tresorsOuverts;
    expect(lirePartie(JSON.stringify(base), 42)).toEqual({ ...exemple(), tresorsOuverts: [] });
  });

  it('refuse une liste abîmée', () => {
    const base = JSON.parse(serialiser(exemple()));
    const avec = (tresorsOuverts: unknown) => lirePartie(JSON.stringify({ ...base, tresorsOuverts }), 42);
    expect(avec('tous')).toBeNull();
    expect(avec([3])).toBeNull();
    expect(avec(['d:1:2'])).toBeNull();
    expect(avec(null)).toBeNull();
  });
});

describe('sauvegarde : coffres de ruine entamés', () => {
  it('retient ce qui reste dans un coffre entamé, et refuse un état abîmé', () => {
    const d = { ...exemple(), tresorsEntames: { 'co:ru:2:-3': [{ objet: 'or', quantite: 12 }] } };
    expect(lirePartie(serialiser(d), 42)!.tresorsEntames).toEqual(d.tresorsEntames);
    expect(lirePartie(serialiser(exemple()), 42)!.tresorsEntames).toBeUndefined();
    const abime = JSON.parse(serialiser(exemple()));
    abime.tresorsEntames = { nimporte: [] };
    expect(lirePartie(JSON.stringify(abime), 42)).toBeNull();
  });
});

describe('sauvegarde : livre de fin déjà vu', () => {
  it('absent ou d\'un autre type = non vu, sans refuser la sauvegarde', () => {
    expect(lirePartie(serialiser(exemple()), 42)!.finVue).toBeUndefined();
    const autre = JSON.parse(serialiser(exemple()));
    autre.finVue = 'oui';
    expect(lirePartie(JSON.stringify(autre), 42)!.finVue).toBeUndefined();
  });

  it('relit finVue quand il vaut true', () => {
    const d = { ...exemple(), finVue: true };
    expect(lirePartie(serialiser(d), 42)!.finVue).toBe(true);
  });
});

describe('sauvegarde : repères personnels (v20 -> v21)', () => {
  it('une partie v20 est relue sans aucun repère, le reste intact', () => {
    const v20 = JSON.parse(serialiser(exemple()));
    delete v20.reperes;
    v20.version = 20;
    expect(migrer(v20)!.version).toBe(VERSION_SAUVEGARDE);
    const lue = lirePartie(JSON.stringify(v20), 42)!;
    expect(lue.reperes).toEqual(etatReperesInitial());
    expect(lue).toEqual({ ...exemple(), reperes: etatReperesInitial() });
  });

  it('aller-retour : 3 repères, le prochain identifiant et le suivi sont retrouvés', () => {
    const lue = lirePartie(serialiser(exemple()), 42)!;
    expect(lue.reperes).toEqual(exemple().reperes);
    expect(lue.reperes.liste).toHaveLength(3);
    expect(lue.reperes.suivi).toBe(3);
  });

  it('des repères abîmés sont ignorés sans perdre le reste de la partie', () => {
    const base = JSON.parse(serialiser(exemple()));
    base.reperes = {
      liste: [{ id: 1, type: 'filon', x: 1, z: 2 }, { id: 2, type: 'inconnu', x: 0, z: 0 }, { id: 3, type: 'danger', x: 'a', z: 0 }],
      prochainId: 'x',
      suivi: 2,
    };
    const lue = lirePartie(JSON.stringify(base), 42)!;
    expect(lue.reperes).toEqual({ liste: [{ id: 1, type: 'filon', x: 1, z: 2 }], prochainId: 2, suivi: null });
    expect(lue).toEqual({ ...exemple(), reperes: lue.reperes });
  });

  it("un champ repères qui n'est pas un objet donne l'état initial, sans refuser la partie", () => {
    const base = JSON.parse(serialiser(exemple()));
    for (const abime of [42, 'texte', null, [1, 2]]) {
      const lue = lirePartie(JSON.stringify({ ...base, reperes: abime }), 42);
      expect(lue).not.toBeNull();
      expect(lue!.reperes).toEqual(etatReperesInitial());
    }
  });
});

describe('sauvegarde : courbe d\'XP adoucie (v22 -> v23)', () => {
  /** Partie v22 avec cette progression (ancienne courbe : 150 x n^1,4). */
  function v22(niveau: number, xp: number, points: number, noeuds: string[] = []): Record<string, unknown> {
    const d = JSON.parse(serialiser(exemple()));
    d.version = 22;
    d.progression = { ...d.progression, niveau, xp, points, noeuds };
    return d;
  }

  it('une partie v22 niveau 8 avec 0 XP passe niveau 11 et gagne 3 points', () => {
    const migree = migrer(v22(8, 0, 2))!;
    expect(migree.version).toBe(VERSION_SAUVEGARDE);
    expect((migree.progression as { niveau: number; xp: number; points: number }).niveau).toBe(11);
    expect(migree.progression).toMatchObject({ niveau: 11, points: 5 });
    const xp = (migree.progression as { xp: number }).xp;
    expect(xp).toBeGreaterThanOrEqual(0);
    expect(xp).toBeLessThan(xpPourNiveauSuivant(11));
  });

  it("l'XP totale est conservée et les nœuds acquis restent", () => {
    const noeuds = ['boule-de-feu', 'soin'];
    const migree = migrer(v22(5, 300, 0, noeuds))!;
    const p = migree.progression as { niveau: number; xp: number; points: number; noeuds: string[] };
    let total = p.xp;
    for (let n = 1; n < p.niveau; n++) total += xpPourNiveauSuivant(n);
    let ancien = 300;
    for (let n = 1; n < 5; n++) ancien += Math.round(150 * Math.pow(n, 1.4));
    expect(total).toBe(ancien);
    expect(p.noeuds).toEqual(noeuds);
    expect(p.points).toBe(p.niveau - 5);
  });

  it('un niveau 1 sans XP reste inchangé', () => {
    const migree = migrer(v22(1, 0, 0))!;
    expect(migree.progression).toMatchObject({ niveau: 1, xp: 0, points: 0 });
  });

  it('le niveau est plafonné au niveau maximal, XP à 0', () => {
    const migree = migrer(v22(CONFIG.progression.niveauMax, 0, 0))!;
    expect(migree.progression).toMatchObject({ niveau: CONFIG.progression.niveauMax, xp: 0, points: 0 });
  });
});

const lireQuetesPourTest = (q: unknown) => q as { enCours: []; terminees: string[] };

describe('sauvegarde : village attaqué (v23 -> v24)', () => {
  const v23 = (etape: number, terminees: string[] = ['nuisibles']) => ({
    ...JSON.parse(serialiser(exemple())),
    version: 23,
    histoire: { etape, compteur: 0, vus: [] },
    quetes: { enCours: [], terminees },
  });

  it('une partie arrêtée après « Trouve Aldric » est décalée de 3 et a ses trois quêtes de reconstruction rendues', () => {
    const migree = migrer(v23(14))!;
    expect(migree.version).toBe(VERSION_SAUVEGARDE);
    expect((migree.histoire as { etape: number }).etape).toBe(17);
    const terminees = (migree.quetes as { terminees: string[] }).terminees;
    expect(terminees).toEqual(expect.arrayContaining(['nuisibles', 'murs-hiver', 'ventre-batisseurs', 'toit-chasseur']));
    expect(maisonsEndommagees(lireEtatHistoire(migree.histoire)!, lireQuetesPourTest(migree.quetes))).toEqual(new Set());
  });

  it('une partie à « Trouve Aldric » ou avant ne change que de version', () => {
    for (const etape of [0, 8, 12, 13]) {
      const migree = migrer(v23(etape))!;
      expect((migree.histoire as { etape: number }).etape).toBe(etape);
      expect((migree.quetes as { terminees: string[] }).terminees).toEqual(['nuisibles']);
    }
  });

  it('l’histoire finie reste finie', () => {
    expect((migrer(v23(20))!.histoire as { etape: number }).etape).toBe(23);
  });
});

describe('sauvegarde : potager (v24 -> v25)', () => {
  it('le potager arrosé est sauvegardé et relu', () => {
    expect(lirePartie(serialiser({ ...exemple(), potager: { dernierArrosage: 5 } }), 42)!.potager).toEqual({ dernierArrosage: 5 });
  });

  it('une partie v24 démarre avec un potager non arrosé', () => {
    const v24 = { ...JSON.parse(serialiser(exemple())), version: 24 };
    delete v24.potager;
    const migree = migrer(v24)!;
    expect(migree.version).toBe(VERSION_SAUVEGARDE);
    expect(migree.potager).toEqual({ dernierArrosage: null });
    expect(lirePartie(JSON.stringify(v24), 42)!.potager).toEqual({ dernierArrosage: null });
  });

  it('un potager abîmé donne un potager non arrosé sans refuser la partie', () => {
    const base = JSON.parse(serialiser(exemple()));
    expect(lirePartie(JSON.stringify({ ...base, potager: 'x' }), 42)!.potager).toEqual({ dernierArrosage: null });
    expect(lirePartie(JSON.stringify({ ...base, potager: { dernierArrosage: -3 } }), 42)!.potager).toEqual({ dernierArrosage: null });
  });
});
