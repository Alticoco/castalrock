import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { HABITANTS, lieuxHabitant, pointLibre } from './habitants';
import { ajouter, compter, creerConteneur, definitionObjet, type Conteneur } from './inventaire';
import {
  ACHATS,
  VENTES,
  acheter,
  chercherVente,
  creerEtatMarchand,
  jourCalendaire,
  lireEtatMarchand,
  marchandPresent,
  numeroVisite,
  orPossede,
  placementMarchand,
  possede,
  salutation,
  stockRestant,
  vendre,
  type EtatMarchand,
  type PossessionMarchand,
} from './marchand';
import { decrireVillage, obstaclesVillage, type NiveauVillage } from './village';

const JOUR = CONFIG.temps.dureeJourSecondes;
/** Temps de jeu correspondant au jour `jour` (0 = début de partie) à l'heure `heure`. */
const temps = (jour: number, heure: number): number => ((jour * 24 + heure - CONFIG.temps.heureDepart) / 24) * JOUR;
const MIDI_JOUR_1 = temps(1, 12);

function avec(objets: Array<[string, number]>, casesInventaire = 20, casesSac = 20): { inventaire: Conteneur; sac: Conteneur } {
  let inventaire = creerConteneur(casesInventaire);
  for (const [objet, n] of objets) inventaire = ajouter(inventaire, objet, n).conteneur;
  return { inventaire, sac: creerConteneur(casesSac) };
}
const possession = (c: { inventaire: Conteneur; sac: Conteneur }, t = MIDI_JOUR_1, etat: EtatMarchand = creerEtatMarchand()): PossessionMarchand => ({
  ...c,
  etat,
  tempsJeu: t,
});

describe('marchand : quand il passe', () => {
  it("compte les jours de minuit à minuit : le jour 0 commence à l'heure de départ", () => {
    expect(jourCalendaire(0)).toBe(0);
    expect(jourCalendaire(temps(0, 23.9))).toBe(0);
    expect(jourCalendaire(temps(1, 0.1))).toBe(1);
    expect(jourCalendaire(temps(4, 12))).toBe(4);
  });

  it('est là un jour sur trois, à partir du premier jour de passage', () => {
    const present = [0, 1, 2, 3, 4, 5, 6, 7].map((j) => marchandPresent(temps(j, 12)));
    expect(present).toEqual([false, true, false, false, true, false, false, true]);
  });

  it("n'est là que de l'arrivée au départ", () => {
    const { heureArrivee, heureDepart } = CONFIG.marchand;
    expect(marchandPresent(temps(1, heureArrivee - 0.1))).toBe(false);
    expect(marchandPresent(temps(1, heureArrivee + 0.01))).toBe(true);
    expect(marchandPresent(temps(1, heureDepart - 0.01))).toBe(true);
    expect(marchandPresent(temps(1, heureDepart + 0.01))).toBe(false);
    expect(marchandPresent(temps(1, 23))).toBe(false);
  });

  it('numérote ses visites : 0 avant la première, puis une de plus tous les trois jours', () => {
    expect(numeroVisite(temps(0, 12))).toBe(0);
    expect(numeroVisite(temps(1, 12))).toBe(1);
    expect(numeroVisite(temps(3, 12))).toBe(1);
    expect(numeroVisite(temps(4, 8))).toBe(2);
    expect(numeroVisite(temps(7, 8))).toBe(3);
  });
});

describe('marchand : le catalogue', () => {
  it('ne vend que des objets connus, avec des prix et des stocks positifs', () => {
    expect(VENTES.map((v) => v.objet)).toEqual(['potion-soin', 'fleche', 'kit-feu-camp', 'piege', 'viande-cuite', 'lingot-cuivre', 'lingot-fer']);
    for (const v of VENTES) {
      expect(definitionObjet(v.objet).nom).not.toBe(v.objet);
      expect(v.prix).toBeGreaterThan(0);
      expect(v.stock).toBeGreaterThan(0);
      expect(v.lot).toBeGreaterThan(0);
    }
    expect(chercherVente('fleche')?.lot).toBe(10);
  });

  it("ne rachète ni l'or ni l'équipement, et rachète moins cher qu'il ne vend", () => {
    for (const a of ACHATS) {
      expect(definitionObjet(a.objet).categorie).toBe('ressource');
      expect(a.prix).toBeGreaterThan(0);
      expect(['or', 'arc', 'bouclier-bois', 'bouclier-renforce', 'armure-cuir']).not.toContain(a.objet);
      const vente = chercherVente(a.objet);
      if (vente) expect(a.prix).toBeLessThan(vente.prix / vente.lot);
    }
  });
});

describe('marchand : acheter', () => {
  it("prend les pièces et donne l'objet", () => {
    const r = acheter(possession(avec([['or', 30]])), 'potion-soin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(compter(r.inventaire, 'or')).toBe(30 - chercherVente('potion-soin')!.prix);
    expect(compter(r.inventaire, 'potion-soin')).toBe(1);
    expect(r.etat).toEqual({ visite: 1, achetes: { 'potion-soin': 1 } });
  });

  it('vend les flèches par lot de dix', () => {
    const r = acheter(possession(avec([['or', 20]])), 'fleche');
    expect(r.ok && compter(r.inventaire, 'fleche')).toBe(10);
  });

  it("prend l'or du sac quand l'inventaire n'en a pas, et range dans le sac quand l'inventaire est plein", () => {
    const c = { inventaire: ajouter(creerConteneur(1), 'bois', 50).conteneur, sac: ajouter(creerConteneur(3), 'or', 40).conteneur };
    const r = acheter(possession(c), 'potion-soin');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(compter(r.sac, 'or')).toBe(40 - 12);
    expect(compter(r.sac, 'potion-soin')).toBe(1);
    expect(compter(r.inventaire, 'bois')).toBe(50);
  });

  it('Maj + clic : plusieurs lots, dans la limite du stock', () => {
    const r = acheter(possession(avec([['or', 300]])), 'viande-cuite', 10);
    expect(r.ok && compter(r.inventaire, 'viande-cuite')).toBe(chercherVente('viande-cuite')!.stock);
  });

  it("s'arrête au nombre de lots que l'or permet", () => {
    const r = acheter(possession(avec([['or', 25]])), 'potion-soin', 10);
    expect(r.ok && r.quantite).toBe(2);
    expect(r.ok && r.or).toBe(24);
  });

  it('refuse quand le stock est épuisé, puis le retrouve neuf à la visite suivante', () => {
    const stock = chercherVente('piege')!.stock;
    let c = avec([['or', 200]]);
    let etat = creerEtatMarchand();
    for (let i = 0; i < stock; i++) {
      const r = acheter(possession(c, MIDI_JOUR_1, etat), 'piege');
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      c = { inventaire: r.inventaire, sac: r.sac };
      etat = r.etat;
    }
    expect(acheter(possession(c, MIDI_JOUR_1, etat), 'piege')).toMatchObject({ ok: false, raison: 'rupture' });
    expect(stockRestant(etat, MIDI_JOUR_1, chercherVente('piege')!)).toBe(0);
    // Quatre jours plus tard : nouvelle visite, stock neuf
    const plusTard = temps(4, 12);
    expect(stockRestant(etat, plusTard, chercherVente('piege')!)).toBe(stock);
    const r = acheter(possession(c, plusTard, etat), 'piege');
    expect(r.ok && r.etat).toEqual({ visite: 2, achetes: { piege: 1 } });
  });

  it("refuse sans assez d'or", () => {
    expect(acheter(possession(avec([['or', 5]])), 'potion-soin')).toMatchObject({ ok: false, raison: 'pas-assez-or' });
    expect(acheter(possession(avec([])), 'potion-soin')).toMatchObject({ ok: false, raison: 'pas-assez-or' });
  });

  it("refuse quand l'inventaire et le sac sont pleins", () => {
    // Une case par conteneur : de l'or d'un côté, du bois de l'autre ; il reste de l'or après le paiement
    const c = { inventaire: ajouter(creerConteneur(1), 'or', 50).conteneur, sac: ajouter(creerConteneur(1), 'bois', 5).conteneur };
    expect(acheter(possession(c), 'potion-soin')).toMatchObject({ ok: false, raison: 'inventaire-plein' });
  });

  it("libère la case d'or quand on la vide pour payer", () => {
    const c = { inventaire: ajouter(creerConteneur(1), 'or', 12).conteneur, sac: creerConteneur(1) };
    const r = acheter(possession(c), 'potion-soin');
    expect(r.ok && possede(r, 'potion-soin')).toBe(1);
  });

  it("refuse en son absence et pour un objet qu'il ne vend pas", () => {
    expect(acheter(possession(avec([['or', 99]]), temps(2, 12)), 'potion-soin')).toMatchObject({ ok: false, raison: 'absent' });
    expect(acheter(possession(avec([['or', 99]])), 'arc')).toMatchObject({ ok: false, raison: 'inconnu' });
  });

  it('ne modifie pas les conteneurs reçus', () => {
    const c = avec([['or', 30]]);
    acheter(possession(c), 'potion-soin');
    expect(compter(c.inventaire, 'or')).toBe(30);
  });
});

describe('marchand : vendre', () => {
  it("prend l'objet et donne des pièces", () => {
    const r = vendre(possession(avec([['bois', 10]])), 'bois', 4);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(compter(r.inventaire, 'bois')).toBe(6);
    expect(compter(r.inventaire, 'or')).toBe(4 * ACHATS.find((a) => a.objet === 'bois')!.prix);
  });

  it("prend d'abord l'inventaire porté, puis le sac", () => {
    const c = { inventaire: ajouter(creerConteneur(5), 'pierre', 3).conteneur, sac: ajouter(creerConteneur(5), 'pierre', 4).conteneur };
    const r = vendre(possession(c), 'pierre', 5);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(compter(r.inventaire, 'pierre')).toBe(0);
    expect(compter(r.sac, 'pierre')).toBe(2);
  });

  it("ne vend pas plus que ce que l'on a", () => {
    const r = vendre(possession(avec([['cristal-bleu', 2]])), 'cristal-bleu', 10);
    expect(r.ok && r.quantite).toBe(2);
    expect(r.ok && orPossede(r)).toBe(2 * ACHATS.find((a) => a.objet === 'cristal-bleu')!.prix);
  });

  it('refuse sans rien à vendre, ou pour un objet non racheté (or, équipement)', () => {
    expect(vendre(possession(avec([])), 'bois')).toMatchObject({ ok: false, raison: 'rien-a-vendre' });
    expect(vendre(possession(avec([['or', 50]])), 'or')).toMatchObject({ ok: false, raison: 'inconnu' });
    expect(vendre(possession(avec([['armure-cuir', 1]])), 'armure-cuir')).toMatchObject({ ok: false, raison: 'inconnu' });
  });

  it('refuse en son absence', () => {
    expect(vendre(possession(avec([['bois', 5]]), temps(0, 12)), 'bois')).toMatchObject({ ok: false, raison: 'absent' });
  });

  it("refuse quand l'or reçu ne rentre nulle part", () => {
    const c = { inventaire: ajouter(creerConteneur(1), 'bois', 5).conteneur, sac: creerConteneur(0) };
    expect(vendre(possession(c), 'bois', 1)).toMatchObject({ ok: false, raison: 'inventaire-plein' });
    // Tout vendre libère la case
    expect(vendre(possession(c), 'bois', 5).ok).toBe(true);
  });
});

describe('marchand : état sauvegardé et paroles', () => {
  it('lit un état valide et refuse un état abîmé', () => {
    expect(lireEtatMarchand({ visite: 2, achetes: { fleche: 1 } })).toEqual({ visite: 2, achetes: { fleche: 1 } });
    expect(lireEtatMarchand(creerEtatMarchand())).toEqual({ visite: 0, achetes: {} });
    for (const mauvais of [null, 3, [], { visite: -1, achetes: {} }, { visite: 0 }, { visite: 0, achetes: { a: 0.5 } }]) {
      expect(lireEtatMarchand(mauvais)).toBeNull();
    }
  });

  it('a plusieurs salutations qui changent', () => {
    expect(salutation(1, 1)).not.toBe(salutation(1, 2));
    expect(salutation(1, 1).length).toBeGreaterThan(10);
  });
});

describe('marchand : sa place sur la place du village', () => {
  const niveaux: NiveauVillage[] = [1, 2, 3];
  const { marchand, charrette } = placementMarchand();
  const cercles = [marchand, charrette];

  it('ne bloque aucun bâtiment, objet du village ni chemin, à aucun niveau du village', () => {
    for (const niveau of niveaux) {
      const obstacles = obstaclesVillage(niveau);
      for (const c of cercles) expect(pointLibre(c, obstacles, c.rayon)).toBe(true);
      for (const ch of decrireVillage(niveau).chemins) {
        // Distance du centre du cercle au segment du chemin
        const dx = ch.x2 - ch.x1;
        const dz = ch.z2 - ch.z1;
        for (const c of cercles) {
          const t = Math.max(0, Math.min(1, ((c.x - ch.x1) * dx + (c.z - ch.z1) * dz) / (dx * dx + dz * dz)));
          expect(Math.hypot(c.x - (ch.x1 + dx * t), c.z - (ch.z1 + dz * t))).toBeGreaterThan(ch.largeur / 2 + c.rayon);
        }
      }
    }
  });

  it("n'est sur le poste d'aucun habitant", () => {
    for (const niveau of niveaux) {
      for (const id of HABITANTS) {
        const lieux = lieuxHabitant(id, niveau);
        for (const p of [...lieux.jour, ...lieux.soir]) {
          for (const c of cercles) expect(Math.hypot(p.x - c.x, p.z - c.z)).toBeGreaterThan(c.rayon + 1);
        }
      }
    }
  });

  it('regarde la place, avec la charrette à côté de lui', () => {
    expect(Math.sin(marchand.orientation)).toBeGreaterThan(0);
    expect(Math.cos(marchand.orientation)).toBeLessThan(0);
    expect(Math.hypot(charrette.x - marchand.x, charrette.z - marchand.z)).toBeCloseTo(Math.hypot(CONFIG.marchand.charrette.x, CONFIG.marchand.charrette.z), 6);
  });
});
