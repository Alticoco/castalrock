import { describe, expect, it } from 'vitest';
import { HABITANTS, type IdHabitant } from './habitants';
import { ajouter, creerConteneur } from './inventaire';
import { accepter, creerEtatQuetes, type ContexteQuetes, type EtatQuetes } from './quetes';
import {
  CHAINE_DE_HABITANT,
  marqueurHabitant,
  repliqueDialogue,
  salutationDialogue,
  sujetsDe,
  type EcranDialogue,
  type Replique,
  type SituationDialogue,
} from './dialogues';

const CONTEXTE: ContexteQuetes = { niveauVillage: 1, noeuds: [] };

function situation(partie: Partial<SituationDialogue> = {}): SituationDialogue {
  return {
    heure: 10,
    niveauVillage: 1,
    quetes: creerEtatQuetes(),
    contexteQuetes: CONTEXTE,
    possession: { inventaire: creerConteneur(20), coffre: creerConteneur(20) },
    palierOutils: 0,
    mineVisitee: false,
    graine: 1,
    ...partie,
  };
}

const terminees = (...ids: string[]): EtatQuetes => ({ enCours: [], terminees: ids });

describe('salutations', () => {
  it('chaque habitant a une salutation non vide à chaque heure', () => {
    for (const id of HABITANTS) for (const heure of [8, 12, 19, 23]) expect(salutationDialogue(id, situation({ heure })).length).toBeGreaterThan(10);
  });

  it('est stable pour une même graine et varie avec la graine', () => {
    const s = situation({ graine: 5 });
    expect(salutationDialogue('gaspard', s)).toBe(salutationDialogue('gaspard', s));
    const toutes = new Set(Array.from({ length: 30 }, (_, g) => salutationDialogue('marthe', situation({ graine: g }))));
    expect(toutes.size).toBeGreaterThan(1);
  });

  it('Gaspard indique où rôdent les bandits quand un objectif en demande', () => {
    expect(salutationDialogue('gaspard', situation({ chasseBandits: true }))).toContain('Ils rôdent loin du village');
    expect(salutationDialogue('gaspard', situation())).not.toContain('Ils rôdent loin du village');
  });

  it('change entre le jour et le soir', () => {
    const jour = new Set(Array.from({ length: 20 }, (_, g) => salutationDialogue('gaspard', situation({ heure: 10, graine: g }))));
    const soir = new Set(Array.from({ length: 20 }, (_, g) => salutationDialogue('gaspard', situation({ heure: 19, graine: g }))));
    for (const t of soir) expect(jour.has(t)).toBe(false);
  });

  it('réagit à ce que le joueur a fait', () => {
    const neuf = salutationDialogue('bertil', situation());
    const acier = salutationDialogue('bertil', situation({ palierOutils: 3 }));
    expect(acier).not.toBe(neuf);
    expect(acier).toContain('acier');
    expect(salutationDialogue('gaspard', situation({ quetes: terminees('pillards-organises') }))).toContain('pillards');
    expect(salutationDialogue('aldric', situation({ mineVisitee: true }))).toContain('cristal');
  });
});

describe('quête donnée en personne', () => {
  it('Gaspard propose la première quête de sa chaîne, avec Accepter et Plus tard', () => {
    const r = repliqueDialogue('gaspard', { type: 'travail' }, situation());
    expect(r.texte).toContain('slimes');
    expect(r.options.map((o) => o.action.type)).toEqual(['accepter', 'aller']);
    expect(r.options[0].action).toEqual({ type: 'accepter', idQuete: 'nuisibles' });
  });

  it('chaque habitant à chaîne propose la quête de sa propre chaîne', () => {
    const attendu: Record<string, string> = { gaspard: 'nuisibles', bertil: 'premier-lingot', marthe: 'bois-hiver', mathilde: 'remedes' };
    for (const [id, quete] of Object.entries(attendu)) {
      const r = repliqueDialogue(id as IdHabitant, { type: 'travail' }, situation());
      expect(r.options[0].action).toEqual({ type: 'accepter', idQuete: quete });
    }
  });

  it('une quête verrouillée n’est pas proposée et dit pourquoi', () => {
    const r = repliqueDialogue('gaspard', { type: 'travail' }, situation({ quetes: terminees('nuisibles', 'pierres-puits', 'gobelins', 'voyageurs-detrousses', 'renforcer-village') }));
    expect(r.options).toHaveLength(0);
    expect(r.suite).toEqual({ type: 'menu' });
    expect(r.note).toContain('niveau 2');
  });

  it('quête en cours : le menu propose de la rendre seulement si elle est prête', () => {
    const etat = accepter(creerEtatQuetes(), 'bois-hiver').etat;
    const pasPret = repliqueDialogue('marthe', { type: 'menu' }, situation({ quetes: etat }));
    expect(pasPret.options[0].libelle).toContain('J’ai ce que');
    expect(pasPret.options[0].action).toEqual({ type: 'aller', ecran: { type: 'pas-pret' } });
    expect(pasPret.options.some((o) => o.libelle.includes('travail'))).toBe(false);

    const inventaire = ajouter(creerConteneur(20), 'bois', 15).conteneur;
    const pret = repliqueDialogue('marthe', { type: 'menu' }, situation({ quetes: etat, possession: { inventaire, coffre: creerConteneur(20) } }));
    expect(pret.options[0].action).toEqual({ type: 'rendre', idQuete: 'bois-hiver' });
    expect(repliqueDialogue('marthe', { type: 'pas-pret' }, situation({ quetes: etat })).note).toBe("Du bois pour l'hiver : 0/15");
  });

  it('chaîne terminée : plus rien à proposer', () => {
    const toutes = terminees('bois-hiver', 'baies-tarte', 'fourrures-hiver', 'kits-voyageurs', 'gibier', 'ragout-marthe', 'cuir-tanneur');
    const r = repliqueDialogue('marthe', { type: 'travail' }, situation({ quetes: toutes }));
    expect(r.options).toHaveLength(0);
    expect(r.suite).toEqual({ type: 'menu' });
  });

  it('Hugo et Aldric n’ont pas de chaîne ni d’option de travail', () => {
    expect(CHAINE_DE_HABITANT.hugo).toBeNull();
    for (const id of ['hugo', 'aldric'] as const) {
      expect(repliqueDialogue(id, { type: 'menu' }, situation()).options.some((o) => o.libelle.includes('travail'))).toBe(false);
    }
  });
});

describe('options du menu', () => {
  it('Bertil garde l’accès à la forge, les autres non', () => {
    const forge = (id: IdHabitant) => repliqueDialogue(id, { type: 'accueil' }, situation()).options.some((o) => o.action.type === 'forge');
    expect(forge('bertil')).toBe(true);
    for (const id of HABITANTS.filter((h) => h !== 'bertil')) expect(forge(id)).toBe(false);
  });

  it('toujours « Parle-moi de… » et « Au revoir »', () => {
    for (const id of HABITANTS) {
      const options = repliqueDialogue(id, { type: 'accueil' }, situation()).options;
      expect(options.some((o) => o.libelle.startsWith('Parle-moi'))).toBe(true);
      expect(options[options.length - 1].action).toEqual({ type: 'fermer' });
    }
  });
});

describe('sujets de conversation', () => {
  it('Aldric parle de la légende du Cœur de Castal et annonce les ruines', () => {
    const s = situation();
    const legende = [0, 1].map((rang) => repliqueDialogue('aldric', { type: 'sujet', sujet: 'legende', rang }, s).texte).join(' ');
    expect(legende).toContain('Cœur de Castal');
    const ruines = [0, 1].map((rang) => repliqueDialogue('aldric', { type: 'sujet', sujet: 'ruines', rang }, s).texte).join(' ');
    expect(ruines).toContain('Reviens quand tu auras vu les ruines');
  });

  it('Hugo parle de chasse, de pièges et de l’arc', () => {
    expect(sujetsDe('hugo')).toEqual(['chasse', 'pieges', 'bandits']);
    const pieges = [0, 1].map((rang) => repliqueDialogue('hugo', { type: 'sujet', sujet: 'pieges', rang }, situation()).texte).join(' ');
    expect(pieges).toContain('arc');
  });

  it('Mathilde en dit plus quand le village a avancé', () => {
    const debut = repliqueDialogue('mathilde', { type: 'sujet', sujet: 'legende', rang: 0 }, situation()).texte;
    const avance = repliqueDialogue('mathilde', { type: 'sujet', sujet: 'legende', rang: 0 }, situation({ niveauVillage: 2 })).texte;
    expect(avance).not.toBe(debut);
  });
});

describe('graphe du dialogue', () => {
  it('chaque écran atteignable a un texte, et la suite ou les options mènent quelque part', () => {
    for (const id of HABITANTS) {
      for (const s of [situation(), situation({ niveauVillage: 3, mineVisitee: true, palierOutils: 3, quetes: terminees('nuisibles', 'remedes', 'bois-hiver') })]) {
        const vus = new Set<string>();
        const aVoir: EcranDialogue[] = [{ type: 'accueil' }];
        while (aVoir.length > 0) {
          const ecran = aVoir.pop() as EcranDialogue;
          const cle = JSON.stringify(ecran);
          if (vus.has(cle)) continue;
          vus.add(cle);
          const r: Replique = repliqueDialogue(id, ecran, s);
          expect(r.texte.length).toBeGreaterThan(3);
          expect(r.suite !== undefined || r.options.length > 0).toBe(true);
          if (r.suite) aVoir.push(r.suite);
          for (const o of r.options) if (o.action.type === 'aller') aVoir.push(o.action.ecran);
        }
        expect(vus.size).toBeGreaterThan(3);
      }
    }
  });

  it('un sujet à deux répliques se suit puis revient à la liste', () => {
    const premiere = repliqueDialogue('mathilde', { type: 'sujet', sujet: 'legende', rang: 0 }, situation());
    expect(premiere.suite).toEqual({ type: 'sujet', sujet: 'legende', rang: 1 });
    const seconde = repliqueDialogue('mathilde', { type: 'sujet', sujet: 'legende', rang: 1 }, situation());
    expect(seconde.suite).toEqual({ type: 'parler' });
  });
});

describe('marqueurs au-dessus des habitants', () => {
  const possession = { inventaire: creerConteneur(20), coffre: creerConteneur(20) };

  it('« ! » quand une quête est à proposer', () => {
    expect(marqueurHabitant('gaspard', creerEtatQuetes(), CONTEXTE, possession)).toBe('proposee');
    expect(marqueurHabitant('hugo', creerEtatQuetes(), CONTEXTE, possession)).toBe('aucun');
  });

  it('rien quand la quête est en cours mais pas prête, « ? » quand elle est prête', () => {
    const etat = accepter(creerEtatQuetes(), 'bois-hiver').etat;
    expect(marqueurHabitant('marthe', etat, CONTEXTE, possession)).toBe('aucun');
    const pleine = { inventaire: ajouter(creerConteneur(20), 'bois', 15).conteneur, coffre: creerConteneur(20) };
    expect(marqueurHabitant('marthe', etat, CONTEXTE, pleine)).toBe('a-rendre');
  });

  it('rien quand la quête est verrouillée', () => {
    const etat = terminees('nuisibles', 'pierres-puits', 'gobelins', 'voyageurs-detrousses', 'renforcer-village');
    expect(marqueurHabitant('gaspard', etat, CONTEXTE, possession)).toBe('aucun');
  });
});
