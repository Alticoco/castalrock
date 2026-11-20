// Quêtes : panneau d'annonces (E), journal (J) et suivi à l'écran.
import { etapesTerminees } from '../regles/histoire';
import { ajouter, compter, definitionObjet } from '../regles/inventaire';
import { RECETTES, dejaPossede } from '../regles/fabrication';
import {
  accepter as accepterQuete,
  chercherQuete,
  evenement as evenementQuete,
  progressionQuete,
  quetesEnCours,
  rendre as rendreQuete,
  uniteObjectif,
  type ContexteQuetes,
  type DefinitionQuete,
  type EvenementQuete,
} from '../regles/quetes';
import { creerEcranQuetes, type DonneesEcranQuetes, type MessageQuetes } from '../ui/ecranQuetes';
import type { LigneQuete } from '../ui/suiviQuetes';
import type { Contexte } from './contexte';
import { remplisseurIndices } from './indices';
import type { EtatJeu } from './partie';

export interface DependancesQuetes {
  rafraichirInventaire: () => void;
  donnerXp: (quantite: number) => void;
  /** Récompense de quête : points de compétence (voir progression.ts) */
  donnerPointsCompetence: (quantite: number) => void;
  /** Clic sur « Améliorer le village » dans l'écran des quêtes */
  ameliorerLeVillage: () => void;
  /** Les mêmes événements du jeu font aussi avancer la chaîne principale de l'histoire */
  signalerHistoire: (ev: EvenementQuete) => void;
}

export function creerQuetes(jeu: EtatJeu, ctx: Contexte, dep: DependancesQuetes) {
  const { entrees } = ctx;
  const { suiviQuetes } = ctx;

  function donneesQuetes(): DonneesEcranQuetes {
    return {
      etat: jeu.quetes,
      possession: { inventaire: jeu.inventaire, coffre: jeu.coffre },
      niveauVillage: jeu.niveauVillageReel,
      noeuds: jeu.progression.noeuds,
      histoire: jeu.histoire,
      remplir: remplisseurIndices(ctx),
    };
  }

  function contexteQuetes(): ContexteQuetes {
    const etatFab = { inventaire: jeu.inventaire, coffre: jeu.coffre, equipement: jeu.equipement };
    const dejaPossedees = RECETTES.filter((r) => dejaPossede(etatFab, r)).map((r) => r.id);
    return { niveauVillage: jeu.niveauVillageReel, noeuds: jeu.progression.noeuds, dejaPossedees, etapesTerminees: etapesTerminees(jeu.histoire) };
  }

  /** Phrase courte de l'objectif d'une quête, pour le panneau de quêtes (« Rapporter : baies »). */
  function phraseObjectif(q: DefinitionQuete): string {
    const unite = uniteObjectif(q.objectif, (id) => definitionObjet(id).nom);
    switch (q.objectif.type) {
      case 'rapporter':
        return `Rapporter : ${unite}`;
      case 'tuer':
        return `Vaincre : ${unite}`;
      case 'fabriquer':
        return 'Fabriquer des objets';
      case 'planter':
        return "Planter des pousses d'arbre";
      case 'detruire':
        return 'Détruire des éléments du décor';
      case 'lancerSort':
        return 'Lancer des sorts';
      case 'apprendreNoeud':
        return `Apprendre : ${unite}`;
      case 'arroser':
        return 'Arroser le potager de ta maison';
    }
  }

  /** Redessine le panneau de quêtes à l'écran (toutes les quêtes en cours) et l'écran des quêtes s'il est ouvert. */
  function rafraichirQuetes(message?: MessageQuetes): void {
    const possession = { inventaire: jeu.inventaire, coffre: jeu.coffre };
    suiviQuetes.afficherQuetes(
      quetesEnCours(jeu.quetes).map((q): LigneQuete => {
        const p = progressionQuete(jeu.quetes, q, possession, contexteQuetes());
        return {
          titre: q.titre,
          donneur: q.auteur,
          objectif: phraseObjectif(q),
          actuel: p.actuel,
          requis: p.requis,
          unite: uniteObjectif(q.objectif, (id) => definitionObjet(id).nom),
          prete: p.prete,
        };
      }),
    );
    if (ecranQuetes.ouvert) ecranQuetes.afficher(donneesQuetes(), message);
  }

  /** Un événement du jeu (ennemi tué, fabrication, plantation, destruction, sort lancé, nœud acquis) : fait avancer les quêtes acceptées. */
  function signalerQuete(ev: EvenementQuete): void {
    dep.signalerHistoire(ev);
    const apres = evenementQuete(jeu.quetes, ev);
    if (apres === jeu.quetes) return;
    jeu.quetes = apres;
    rafraichirQuetes();
  }

  function accepterUneQuete(id: string): { ok: boolean; message: string } {
    const r = accepterQuete(jeu.quetes, id, contexteQuetes());
    if (r.ok) {
      // Objets remis à l'acceptation (le seau de Mathilde) : refus si ça ne rentre pas, sinon la quête serait impossible
      let { inventaire, sac } = jeu;
      for (const objet of chercherQuete(id)?.objetsOfferts ?? []) {
        const possede = [jeu.inventaire, jeu.sac, jeu.coffre].some((c) => compter(c, objet) > 0 || compter(c, `${objet}-eau`) > 0);
        if (possede) continue;
        const porte = ajouter(inventaire, objet, 1);
        const range = ajouter(sac, objet, porte.reste);
        if (range.reste > 0) {
          const message = `Inventaire plein : ${definitionObjet(objet).nom} ne rentre pas`;
          rafraichirQuetes({ texte: message, ok: false });
          return { ok: false, message };
        }
        inventaire = porte.conteneur;
        sac = range.conteneur;
      }
      jeu.inventaire = inventaire;
      jeu.sac = sac;
      dep.rafraichirInventaire();
    }
    jeu.quetes = r.etat;
    rafraichirQuetes({ texte: r.message, ok: r.ok });
    return { ok: r.ok, message: r.message };
  }

  function rendreUneQuete(id: string): { ok: boolean; message: string } {
    const r = rendreQuete(jeu.quetes, id, { inventaire: jeu.inventaire, coffre: jeu.coffre, sac: jeu.sac }, contexteQuetes());
    if (r.ok) {
      jeu.quetes = r.etat;
      jeu.inventaire = r.contenants.inventaire;
      jeu.coffre = r.contenants.coffre;
      jeu.sac = r.contenants.sac;
      dep.rafraichirInventaire();
      dep.donnerXp(r.xp);
      if (r.pointsCompetence > 0) dep.donnerPointsCompetence(r.pointsCompetence);
    }
    rafraichirQuetes({ texte: r.message, ok: r.ok });
    return { ok: r.ok, message: r.message };
  }

  const ecranQuetes = creerEcranQuetes(ctx.ui, accepterUneQuete, rendreUneQuete, dep.ameliorerLeVillage, () => basculerQuetes());
  rafraichirQuetes();

  /** Ouvre (avec le mode donné) ou ferme l'écran des quêtes : pointeur libéré et personnage figé tant qu'il est ouvert. */
  function basculerQuetes(mode?: 'panneau' | 'journal'): void {
    if (ecranQuetes.ouvert || !mode) {
      ecranQuetes.fermer();
      entrees.definirVerrouillage(!jeu.visite);
      entrees.verrouiller();
    } else {
      ecranQuetes.ouvrir(mode);
      entrees.definirVerrouillage(false);
      ecranQuetes.afficher(donneesQuetes());
    }
  }

  return { ecran: ecranQuetes, rafraichirQuetes, signalerQuete, basculerQuetes, contexteQuetes, accepterUneQuete, rendreUneQuete };
}

export type Quetes = ReturnType<typeof creerQuetes>;
