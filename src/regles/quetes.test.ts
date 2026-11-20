import { describe, expect, it } from 'vitest';
import { CONFIG } from '../config';
import { chercherNoeud } from './competences';
import { TYPES_ENNEMI } from './combat';
import { chercherRecette } from './fabrication';
import { ORDRE_RESSOURCES } from './recolte';
import { ajouter, compter, creerConteneur, definitionObjet } from './inventaire';
import {
  CHAINES,
  QUETES,
  accepter,
  chercherQuete,
  conditionsManquantes,
  creerEtatQuetes,
  evenement,
  niveauVillageDebloque,
  progressionQuete,
  queteSuivante,
  quetesDeChaine,
  quetesEnCours,
  quetesVisibles,
  rendre,
  statutQuete,
  type ContenantsQuetes,
  type ContexteQuetes,
  type EtatQuetes,
} from './quetes';

function contenants(porte: Record<string, number> = {}, coffre: Record<string, number> = {}, casesSac = 4): ContenantsQuetes {
  let inventaire = creerConteneur(10);
  for (const [o, n] of Object.entries(porte)) inventaire = ajouter(inventaire, o, n).conteneur;
  let c = creerConteneur(10);
  for (const [o, n] of Object.entries(coffre)) c = ajouter(c, o, n).conteneur;
  return { inventaire, coffre: c, sac: creerConteneur(casesSac) };
}

function acceptee(id: string, etat: EtatQuetes = creerEtatQuetes(), ctx?: ContexteQuetes): EtatQuetes {
  const r = accepter(etat, id, ctx);
  if (!r.ok) throw new Error(r.message);
  return r.etat;
}

/** Toutes les quêtes de la liste sont faites, sauf celles données. */
function toutFaitSauf(...ids: string[]): EtatQuetes {
  return { enCours: [], terminees: QUETES.map((q) => q.id).filter((id) => !ids.includes(id)) };
}

const VILLAGE_2: ContexteQuetes = { niveauVillage: 2, noeuds: [] };
const VILLAGE_3: ContexteQuetes = { niveauVillage: 3, noeuds: [] };

describe('quêtes : définitions et chaînes', () => {
  it('a 32 quêtes aux identifiants uniques : 7 + 7 + 7 + 8 + 3 (relever le village)', () => {
    expect(QUETES).toHaveLength(32);
    expect(new Set(QUETES.map((q) => q.id)).size).toBe(32);
    expect(quetesDeChaine('gaspard')).toHaveLength(7);
    expect(quetesDeChaine('forgeron')).toHaveLength(7);
    expect(quetesDeChaine('marthe')).toHaveLength(7);
    expect(quetesDeChaine('mathilde')).toHaveLength(8);
    expect(quetesDeChaine('relever').map((q) => q.id)).toEqual(['murs-hiver', 'ventre-batisseurs', 'toit-chasseur']);
  });

  it('garde les identifiants des anciennes quêtes, rangés dans leur chaîne', () => {
    const anciennes: Record<string, string> = {
      'bois-hiver': 'marthe',
      'pierres-puits': 'gaspard',
      remedes: 'mathilde',
      nuisibles: 'gaspard',
      'premier-lingot': 'forgeron',
      replanter: 'mathilde',
      gobelins: 'gaspard',
      'vrai-forgeron': 'forgeron',
    };
    for (const [id, chaine] of Object.entries(anciennes)) expect(chercherQuete(id)?.chaine).toBe(chaine);
  });

  it("les conditions pointent vers des quêtes d'une autre chaîne qui existent", () => {
    for (const q of QUETES) {
      if (!q.conditions?.quete) continue;
      const autre = chercherQuete(q.conditions.quete);
      expect(autre, q.id).toBeDefined();
      expect(autre!.chaine, q.id).not.toBe(q.chaine);
    }
  });

  it("les récompenses de déblocage du village sont celles de Gaspard 5 (niveau 2) et 6 (niveau 3)", () => {
    expect(quetesDeChaine('gaspard')[4].recompense.debloqueVillage).toBe(2);
    expect(quetesDeChaine('gaspard')[5].recompense.debloqueVillage).toBe(3);
    expect(QUETES.filter((q) => q.recompense.debloqueVillage)).toHaveLength(2);
  });

  it("l'XP monte de 40 (premières quêtes) à 300 (dernières)", () => {
    // « Un potager qui a soif » (60 XP) est une quête d'apprentissage placée en 2e position dans la chaîne de Mathilde : hors de la courbe
    const courbe = QUETES.filter((q) => q.id !== 'potager-soif');
    const xp = courbe.map((q) => q.recompense.xp);
    expect(Math.min(...xp)).toBe(40);
    expect(Math.max(...xp)).toBe(300);
    for (const c of CHAINES.filter((c) => !c.enPersonne)) {
      const x = quetesDeChaine(c.id).filter((q) => q.id !== 'potager-soif').map((q) => q.recompense.xp);
      expect([...x].sort((a, b) => a - b)).toEqual(x);
    }
  });
});

/** Vrai si l'objet est une ressource de récolte ou un objet connu du catalogue. */
function objetExiste(id: string): boolean {
  return (ORDRE_RESSOURCES as readonly string[]).includes(id) || definitionObjet(id).nom !== id || definitionObjet(id).categorie === 'ressource';
}

describe('quêtes : objectifs et références existantes', () => {
  it('chaque objectif fait référence à une recette, un objet, un ennemi ou un nœud qui existe', () => {
    for (const q of QUETES) {
      const o = q.objectif;
      if (o.type === 'rapporter') {
        for (const d of [{ objet: o.objet }, ...(o.aussi ?? [])]) expect(objetExiste(d.objet), `${q.id} : ${d.objet}`).toBe(true);
      } else if (o.type === 'tuer') {
        expect(TYPES_ENNEMI as readonly string[], q.id).toContain(o.ennemi);
      } else if (o.type === 'fabriquer') {
        for (const r of o.recettes) expect(chercherRecette(r), `${q.id} : ${r}`).toBeDefined();
      } else if (o.type === 'apprendreNoeud') {
        expect(chercherNoeud(o.noeud), q.id).toBeDefined();
      }
      for (const r of q.recompense.objets) expect(objetExiste(r.objet), `${q.id} : ${r.objet}`).toBe(true);
    }
  });

  it("une quête qui fabrique une recette réservée à un village plus grand le demande, elle ou une quête avant elle", () => {
    for (const q of QUETES) {
      if (q.objectif.type !== 'fabriquer') continue;
      for (const id of q.objectif.recettes) {
        const min = chercherRecette(id)?.niveauVillageMin ?? 1;
        if (min <= 1) continue;
        const chaine = quetesDeChaine(q.chaine);
        const niveauDemande = Math.max(0, ...chaine.slice(0, chaine.indexOf(q) + 1).map((x) => x.conditions?.niveauVillage ?? 0));
        expect(niveauDemande, `${q.id} : ${id}`).toBeGreaterThanOrEqual(min);
      }
    }
  });

  it("les objets fabriqués par une quête sont faisables dans l'ordre de la chaîne du forgeron", () => {
    const f = quetesDeChaine('forgeron');
    // lingot de fer : charbon rapporté (3) avant la pioche en fer (4), pioche de cuivre (2) avant celle de fer
    expect(f[1].objectif).toMatchObject({ recettes: ['pioche-cuivre'] });
    expect(f[2].objectif).toMatchObject({ type: 'rapporter', objet: 'charbon' });
    expect(f[3].objectif).toMatchObject({ recettes: ['pioche-fer'] });
    expect(chercherRecette('lingot-fer')!.ingredients.map((i) => i.objet)).toContain('charbon');
    // acier : village 2
    expect(f[5].conditions?.niveauVillage).toBe(2);
    expect(chercherRecette('lingot-acier')!.niveauVillageMin).toBe(2);
  });

  it("le guetteur demande des lingots de fer, qu'une recette produit", () => {
    expect(quetesDeChaine('gaspard')[5].objectif).toMatchObject({ type: 'rapporter', objet: 'lingot-fer', quantite: 4 });
    expect(chercherRecette('lingot-fer')?.resultat).toMatchObject({ objet: 'lingot-fer' });
  });
});

describe('quêtes : chaînes en parallèle et conditions', () => {
  it('au départ, le panneau montre la première quête de chaque chaîne (4 au plus)', () => {
    const etat = creerEtatQuetes();
    expect(quetesVisibles(etat).map((q) => q.id)).toEqual(['nuisibles', 'premier-lingot', 'bois-hiver', 'remedes']);
    expect(CONFIG.quetes.proposeesMax).toBe(4);
    for (const q of quetesVisibles(etat)) expect(statutQuete(etat, q.id)).toBe('proposee');
  });

  it("une chaîne avance dans l'ordre : la suivante reste verrouillée", () => {
    const etat = creerEtatQuetes();
    expect(statutQuete(etat, 'pierres-puits')).toBe('verrouillee');
    expect(accepter(etat, 'pierres-puits')).toMatchObject({ ok: false, raison: 'indisponible' });
    const apres: EtatQuetes = { enCours: [], terminees: ['nuisibles'] };
    expect(queteSuivante(apres, 'gaspard')?.id).toBe('pierres-puits');
    expect(quetesVisibles(apres).map((q) => q.id)).toEqual(['pierres-puits', 'premier-lingot', 'bois-hiver', 'remedes']);
  });

  it('les quatre chaînes avancent indépendamment', () => {
    let etat = acceptee('nuisibles');
    etat = acceptee('bois-hiver', etat);
    etat = acceptee('remedes', etat);
    expect(quetesEnCours(etat).map((q) => q.id).sort()).toEqual(['bois-hiver', 'nuisibles', 'remedes']);
    expect(statutQuete(etat, 'premier-lingot')).toBe('proposee');
  });

  it('une quête terminée disparaît du panneau ; une chaîne finie ne propose plus rien', () => {
    const fini = toutFaitSauf();
    expect(quetesVisibles(fini)).toEqual([]);
    expect(queteSuivante(fini, 'marthe')).toBeUndefined();
  });

  it('une condition de village : visible mais verrouillée, avec son texte', () => {
    const etat = toutFaitSauf('secret-acier', 'lame-exception');
    const q = chercherQuete('secret-acier')!;
    expect(quetesVisibles(etat).map((x) => x.id)).toEqual(['secret-acier']);
    expect(statutQuete(etat, 'secret-acier')).toBe('verrouillee');
    expect(conditionsManquantes(etat, q)).toEqual(['Disponible quand le village sera niveau 2']);
    expect(accepter(etat, 'secret-acier')).toMatchObject({ ok: false, raison: 'indisponible', message: 'Disponible quand le village sera niveau 2' });
    expect(statutQuete(etat, 'secret-acier', VILLAGE_2)).toBe('proposee');
    expect(conditionsManquantes(etat, q, VILLAGE_2)).toEqual([]);
    expect(accepter(etat, 'secret-acier', VILLAGE_2).ok).toBe(true);
  });

  it("une condition de quête d'une autre chaîne : verrouillée jusqu'à ce qu'elle soit terminée", () => {
    const sans = toutFaitSauf('fourrures-hiver', 'kits-voyageurs', 'gobelins', 'voyageurs-detrousses', 'renforcer-village', 'le-guetteur', 'pillards-organises');
    const etat: EtatQuetes = { ...sans, terminees: sans.terminees.filter((id) => id !== 'gobelins') };
    expect(statutQuete(etat, 'fourrures-hiver')).toBe('verrouillee');
    const [texte] = conditionsManquantes(etat, chercherQuete('fourrures-hiver')!);
    expect(texte).toContain('Des traces suspectes');
    expect(texte).toContain('Gaspard');
    const apres: EtatQuetes = { ...etat, terminees: [...etat.terminees, 'gobelins'] };
    expect(statutQuete(apres, 'fourrures-hiver')).toBe('proposee');
  });

  it("une quête déjà acceptée reste en cours même si le village a changé", () => {
    const etat = acceptee('secret-acier', toutFaitSauf('secret-acier', 'lame-exception'), VILLAGE_2);
    expect(statutQuete(etat, 'secret-acier')).toBe('en-cours');
  });

  it("Gaspard 7 attend l'armure du forgeron", () => {
    const etat = toutFaitSauf('pillards-organises', 'armure-digne', 'secret-acier', 'lame-exception');
    expect(statutQuete(etat, 'pillards-organises')).toBe('verrouillee');
    expect(statutQuete({ ...etat, terminees: [...etat.terminees, 'armure-digne'] }, 'pillards-organises')).toBe('proposee');
  });
});

describe('quêtes : acceptation', () => {
  it('refuse une quête inconnue ou déjà acceptée', () => {
    const etat = creerEtatQuetes();
    expect(accepter(etat, 'zzz')).toMatchObject({ ok: false, raison: 'inconnue' });
    expect(accepter(acceptee('bois-hiver'), 'bois-hiver')).toMatchObject({ ok: false, raison: 'deja-acceptee' });
  });
});

describe('quêtes : événements', () => {
  it("ne compte rien avant l'acceptation", () => {
    const etat = creerEtatQuetes();
    expect(evenement(etat, { type: 'ennemiTue', ennemi: 'slime' })).toBe(etat);
  });

  it("compte les ennemis tués du bon type, sans dépasser l'objectif", () => {
    let etat = acceptee('nuisibles');
    const q = chercherQuete('nuisibles')!;
    etat = evenement(etat, { type: 'ennemiTue', ennemi: 'gobelin' });
    expect(progressionQuete(etat, q, contenants()).actuel).toBe(0);
    for (let i = 0; i < 5; i++) etat = evenement(etat, { type: 'ennemiTue', ennemi: 'slime' });
    expect(progressionQuete(etat, q, contenants())).toEqual({ actuel: 3, requis: 3, prete: true });
  });

  it('compte les fabrications des recettes listées', () => {
    let etat = acceptee('vrai-forgeron', { enCours: [], terminees: ['premier-lingot', 'outils-cuivre', 'charbon-forge'] });
    etat = evenement(etat, { type: 'objetFabrique', recette: 'lingot-fer' });
    expect(etat.enCours[0].compteur).toBe(0);
    etat = evenement(etat, { type: 'objetFabrique', recette: 'pioche-fer' });
    expect(etat.enCours[0].compteur).toBe(1);
  });

  it('compte les pousses plantées', () => {
    let etat = acceptee('replanter', { enCours: [], terminees: ['remedes', 'potager-soif'] });
    etat = evenement(etat, { type: 'pousseePlantee' });
    etat = evenement(etat, { type: 'pousseePlantee' });
    expect(etat.enCours[0].compteur).toBe(2);
  });

  it('compte les sorts lancés, de tous les sorts, sans dépasser 10', () => {
    const avant = toutFaitSauf('apprenti-mage', 'gelee-alchimique', 'la-barriere');
    let etat = acceptee('apprenti-mage', avant);
    const q = chercherQuete('apprenti-mage')!;
    expect(progressionQuete(etat, q, contenants()).requis).toBe(10);
    for (let i = 0; i < 12; i++) etat = evenement(etat, { type: 'sortLance' });
    expect(progressionQuete(etat, q, contenants())).toEqual({ actuel: 10, requis: 10, prete: true });
  });

  it('un sort lancé avant l\'acceptation ne compte pas', () => {
    const avant = toutFaitSauf('apprenti-mage', 'gelee-alchimique', 'la-barriere');
    const etat = evenement(avant, { type: 'sortLance' });
    expect(etat).toBe(avant);
  });

  it("« Un potager qui a soif » : disponible avec la maison, offre un seau, compte l'arrosage", () => {
    const q = chercherQuete('potager-soif')!;
    expect(q.objetsOfferts).toEqual(['seau']);
    const avant = toutFaitSauf('potager-soif');
    expect(accepter(avant, 'potager-soif', { niveauVillage: 1, noeuds: [], etapesTerminees: [] }).ok).toBe(false);
    const etat = acceptee('potager-soif', avant, { niveauVillage: 1, noeuds: [], etapesTerminees: ['entrer-maison'] });
    expect(progressionQuete(etat, q, contenants()).prete).toBe(false);
    const apres = evenement(etat, { type: 'potagerArrose' });
    expect(progressionQuete(apres, q, contenants()).prete).toBe(true);
    expect(rendre(apres, 'potager-soif', contenants())).toMatchObject({ ok: true, xp: 60 });
  });

  it("« apprendre un nœud » : compte l'événement, et un nœud déjà acquis suffit", () => {
    const avant = toutFaitSauf('la-barriere');
    const q = chercherQuete('la-barriere')!;
    let etat = acceptee('la-barriere', avant);
    expect(progressionQuete(etat, q, contenants())).toEqual({ actuel: 0, requis: 1, prete: false });
    // Un autre nœud ne compte pas
    expect(evenement(etat, { type: 'noeudAcquis', noeud: 'soin' })).toBe(etat);
    // Le nœud acquis pendant la quête
    const apres = evenement(etat, { type: 'noeudAcquis', noeud: 'barriere' });
    expect(progressionQuete(apres, q, contenants()).prete).toBe(true);
    // Le nœud déjà possédé au moment d'accepter
    expect(progressionQuete(etat, q, contenants(), { niveauVillage: 3, noeuds: ['boule-de-feu', 'soin', 'barriere'] }).prete).toBe(true);
    etat = apres;
    const r = rendre(etat, 'la-barriere', contenants());
    expect(r).toMatchObject({ ok: true, xp: 300, pointsCompetence: 1 });
  });

  it('un événement ne touche pas une quête « rapporter »', () => {
    const etat = acceptee('bois-hiver');
    expect(evenement(etat, { type: 'elementDetruit', element: 'arbre' })).toBe(etat);
    expect(evenement(etat, { type: 'sortLance' })).toBe(etat);
  });
});

describe('quêtes : rendu des quêtes de livraison', () => {
  it("prend les objets dans l'inventaire puis le coffre, donne XP et or", () => {
    const etat = acceptee('bois-hiver');
    const r = rendre(etat, 'bois-hiver', contenants({ bois: 9 }, { bois: 8 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(compter(r.contenants.inventaire, 'bois')).toBe(0);
    expect(compter(r.contenants.coffre, 'bois')).toBe(2);
    expect(compter(r.contenants.inventaire, 'or')).toBe(5);
    expect(r.xp).toBe(40);
    expect(r.pointsCompetence).toBe(0);
    expect(r.etat.terminees).toEqual(['bois-hiver']);
    expect(r.etat.enCours).toEqual([]);
  });

  it("refuse sans rien consommer s'il manque des objets", () => {
    const etat = acceptee('bois-hiver');
    const c = contenants({ bois: 14 });
    const r = rendre(etat, 'bois-hiver', c);
    expect(r).toMatchObject({ ok: false, raison: 'incomplete', xp: 0, pointsCompetence: 0 });
    expect(r.contenants).toBe(c);
    expect(r.etat).toBe(etat);
  });

  it('refuse une quête non acceptée', () => {
    expect(rendre(creerEtatQuetes(), 'bois-hiver', contenants({ bois: 20 }))).toMatchObject({ ok: false, raison: 'pas-acceptee' });
  });

  it("la progression d'une livraison compte porté + coffre, plafonnée", () => {
    const q = chercherQuete('bois-hiver')!;
    expect(progressionQuete(acceptee('bois-hiver'), q, contenants({ bois: 9 }, { bois: 30 }))).toEqual({ actuel: 15, requis: 15, prete: true });
    expect(progressionQuete(acceptee('bois-hiver'), q, contenants({ bois: 9 }))).toEqual({ actuel: 9, requis: 15, prete: false });
  });

  it("une livraison de deux objets (Gaspard 5) demande les deux, plafonnés chacun", () => {
    const avant: EtatQuetes = { enCours: [], terminees: ['nuisibles', 'pierres-puits', 'gobelins', 'voyageurs-detrousses'] };
    const etat = acceptee('renforcer-village', avant);
    const q = chercherQuete('renforcer-village')!;
    expect(progressionQuete(etat, q, contenants({ bois: 30 }))).toEqual({ actuel: 30, requis: 50, prete: false });
    // Trop de bois ne remplace pas les pierres
    expect(progressionQuete(etat, q, contenants({ bois: 99 }))).toMatchObject({ actuel: 30, prete: false });
    expect(rendre(etat, 'renforcer-village', contenants({ bois: 40 }, {}))).toMatchObject({ ok: false, raison: 'incomplete' });
    const r = rendre(etat, 'renforcer-village', contenants({ bois: 35 }, { pierre: 25 }));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(compter(r.contenants.inventaire, 'bois')).toBe(5);
    expect(compter(r.contenants.coffre, 'pierre')).toBe(5);
    expect(r.xp).toBe(150);
    expect(r.message).toContain('niveau 2');
  });

  it("la récompense passe dans le sac si l'inventaire porté est plein", () => {
    const etat = acceptee('remedes');
    const inventaire = ajouter(creerConteneur(1), 'armure-fibres', 1).conteneur;
    const c: ContenantsQuetes = { inventaire, coffre: contenants({}, { 'plante-medicinale': 5 }).coffre, sac: creerConteneur(2) };
    const r = rendre(etat, 'remedes', c);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(compter(r.contenants.sac, 'potion-soin')).toBe(1);
    expect(compter(r.contenants.inventaire, 'armure-fibres')).toBe(1);
    expect(compter(r.contenants.coffre, 'plante-medicinale')).toBe(0);
  });

  it('refuse sans rien consommer si la récompense ne rentre nulle part', () => {
    const etat = acceptee('remedes');
    const inventaire = ajouter(creerConteneur(1), 'armure-fibres', 1).conteneur;
    const c: ContenantsQuetes = { inventaire, coffre: contenants({}, { 'plante-medicinale': 5 }).coffre, sac: creerConteneur(0) };
    const r = rendre(etat, 'remedes', c);
    expect(r).toMatchObject({ ok: false, raison: 'inventaire-plein' });
    expect(r.contenants).toBe(c);
    expect(r.etat).toBe(etat);
  });

  it("rend une quête de compteur prête, sans prendre d'objet", () => {
    let etat = acceptee('nuisibles');
    expect(rendre(etat, 'nuisibles', contenants())).toMatchObject({ ok: false, raison: 'incomplete' });
    for (let i = 0; i < 3; i++) etat = evenement(etat, { type: 'ennemiTue', ennemi: 'slime' });
    const r = rendre(etat, 'nuisibles', contenants());
    expect(r).toMatchObject({ ok: true, xp: 40 });
    expect(quetesEnCours(r.etat)).toEqual([]);
  });

  it('la dernière quête de Gaspard, du forgeron, de Marthe et de Mathilde donne un point de compétence', () => {
    const avec = QUETES.filter((q) => (q.recompense.pointsCompetence ?? 0) > 0).map((q) => q.id);
    expect(avec).toEqual(['pillards-organises', 'lame-exception', 'cuir-tanneur', 'la-barriere']);
  });
});

describe("quêtes : amélioration du village débloquée", () => {
  it("le niveau autorisé suit les quêtes de Gaspard terminées, et ne descend pas sous le village actuel", () => {
    expect(niveauVillageDebloque(creerEtatQuetes())).toBe(1);
    expect(niveauVillageDebloque({ enCours: [], terminees: ['renforcer-village'] })).toBe(2);
    expect(niveauVillageDebloque({ enCours: [], terminees: ['renforcer-village', 'le-guetteur'] })).toBe(3);
    expect(niveauVillageDebloque(creerEtatQuetes(), 2)).toBe(2);
  });

  it('Gaspard 6 attend le village niveau 2', () => {
    const etat = toutFaitSauf('le-guetteur', 'pillards-organises', 'armure-digne', 'secret-acier', 'lame-exception');
    expect(statutQuete(etat, 'le-guetteur')).toBe('verrouillee');
    expect(statutQuete(etat, 'le-guetteur', VILLAGE_3)).toBe('proposee');
  });
});

describe('quêtes : équipement déjà possédé', () => {
  it('une quête « fabriquer » d’un outil déjà possédé est remplie dès qu’on l’accepte', () => {
    // Les quêtes précédentes de la chaîne du forgeron sont faites
    const etat: EtatQuetes = { enCours: [], terminees: ['premier-lingot'] };
    const ctx: ContexteQuetes = { niveauVillage: 1, noeuds: [], dejaPossedees: ['pioche-cuivre'] };
    const r = accepter(etat, 'outils-cuivre', ctx);
    expect(r.ok).toBe(true);
    expect(r.etat.enCours.find((q) => q.id === 'outils-cuivre')?.compteur).toBe(1);
  });

  it('sans l’outil, la quête démarre à zéro', () => {
    const etat: EtatQuetes = { enCours: [], terminees: ['premier-lingot'] };
    const r = accepter(etat, 'outils-cuivre', { niveauVillage: 1, noeuds: [] });
    expect(r.etat.enCours.find((q) => q.id === 'outils-cuivre')?.compteur).toBe(0);
  });
});

describe('quêtes : relever le village (en personne)', () => {
  const ctx = (etapes: string[]) => ({ niveauVillage: 1, noeuds: [], etapesTerminees: etapes });

  it('XP 150 / 120 / 180 et or 15 / 10 / 20', () => {
    const q = quetesDeChaine('relever');
    expect(q.map((x) => x.recompense.xp)).toEqual([150, 120, 180]);
    expect(q.map((x) => x.recompense.objets)).toEqual([[{ objet: 'or', quantite: 15 }], [{ objet: 'or', quantite: 10 }], [{ objet: 'or', quantite: 20 }]]);
    expect(q.map((x) => x.auteur)).toEqual(['Gaspard', 'Marthe', 'Hugo']);
  });

  it('indisponible avant l’étape « Parle à Gaspard », proposée après ; hors des quêtes du panneau', () => {
    const etat = creerEtatQuetes();
    expect(statutQuete(etat, 'murs-hiver', ctx([]))).toBe('verrouillee');
    expect(statutQuete(etat, 'murs-hiver', ctx(['parler-gaspard-attaque']))).toBe('proposee');
    expect(quetesVisibles(etat).some((x) => x.chaine === 'relever')).toBe(false);
    // une à la fois
    expect(statutQuete(etat, 'ventre-batisseurs', ctx(['parler-gaspard-attaque']))).toBe('verrouillee');
  });
});
