// Fabrication et réparation (écran ouvert avec E sur l'établi ou le forgeron).
import { CONFIG } from '../config';
import { chanceEconome, facteurCoutReparation } from '../regles/progression';
import { generateurButin } from '../regles/recolte';
import { reparer, type EmplacementUsure } from '../regles/equipement';
import { fabriquer, type EtatFabrication, type LieuFabrication } from '../regles/fabrication';
import type { EvenementQuete } from '../regles/quetes';
import { creerEcranFabrication } from '../ui/ecranFabrication';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesFabrication {
  montrerOutilEnMain: () => void;
  rafraichirInventaire: () => void;
  donnerXp: (quantite: number) => void;
  signalerQuete: (ev: EvenementQuete) => void;
}

export function creerFabrication(jeu: EtatJeu, ctx: Contexte, dep: DependancesFabrication) {
  const { entrees } = ctx;

  function etatFabrication(): EtatFabrication {
    return {
      inventaire: jeu.inventaire,
      coffre: jeu.coffre,
      equipement: jeu.equipement,
      facteurCoutReparation: facteurCoutReparation(jeu.progression),
      niveauVillage: jeu.niveauVillage,
      noeuds: jeu.progression.noeuds,
      histoire: jeu.histoire,
    };
  }

  /** Fabrique une recette : l'état et l'outil en main sont mis à jour, le résultat s'affiche dans l'écran. */
  function fabriquerRecette(idRecette: string): void {
    // Économe : tirage à graine (recette + instant de jeu)
    const alea = generateurButin(CONFIG.graine, `econome:${idRecette}:${Math.floor(jeu.tempsJeu)}`);
    const r = fabriquer(etatFabrication(), idRecette, { chance: chanceEconome(jeu.progression), tirage: () => alea.suivant() });
    if (r.ok) {
      jeu.inventaire = r.etat.inventaire;
      jeu.coffre = r.etat.coffre;
      jeu.equipement = r.etat.equipement;
      dep.montrerOutilEnMain();
      dep.rafraichirInventaire();
      dep.donnerXp(CONFIG.progression.xp.fabrication);
      dep.signalerQuete({ type: 'objetFabrique', recette: idRecette });
    }
    ecranFabrication.afficher(etatFabrication(), { texte: r.message, ok: r.ok });
  }

  /** Réparation à la forge : le coût est pris dans l'inventaire puis le coffre, la durabilité revient à 100. */
  function reparerEmplacement(emplacement: EmplacementUsure): void {
    const r = reparer({ ...etatFabrication(), facteurCout: facteurCoutReparation(jeu.progression) }, emplacement);
    if (r.ok) {
      jeu.inventaire = r.etat.inventaire;
      jeu.coffre = r.etat.coffre;
      jeu.equipement = r.etat.equipement;
      dep.rafraichirInventaire();
      dep.donnerXp(CONFIG.progression.xp.reparation);
    }
    ecranFabrication.afficher(etatFabrication(), { texte: r.message, ok: r.ok });
  }

  const ecranFabrication = creerEcranFabrication(ctx.ui, fabriquerRecette, () => basculerFabrication(), reparerEmplacement);

  /** Ouvre (avec le lieu donné) ou ferme l'écran de fabrication : pointeur libéré et personnage figé tant qu'il est ouvert. */
  function basculerFabrication(lieu?: LieuFabrication, surRepos?: () => void): void {
    if (ecranFabrication.ouvert || !lieu) {
      ecranFabrication.fermer();
      entrees.definirVerrouillage(!jeu.visite);
      entrees.verrouiller();
    } else {
      ecranFabrication.ouvrir(lieu, surRepos);
      entrees.definirVerrouillage(false);
      ecranFabrication.afficher(etatFabrication());
    }
  }

  return { ecran: ecranFabrication, basculerFabrication };
}

export type Fabrication = ReturnType<typeof creerFabrication>;
