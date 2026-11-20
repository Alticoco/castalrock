// Visée : environ 5 fois par seconde, choix de l'outil, couleur du réticule et invite d'interaction (E).
import { CONFIG } from '../config';
import { baluchonAPortee } from '../regles/mort';
import { interactionVisee, type PointInteraction } from '../regles/village';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';
import type { OutilEnMain } from './outilEnMain';
import type { Recolte } from './recolte';
import type { Combat } from './combat';
import type { Village } from './village';
import type { ButinSol } from './butinSol';
import type { PiegesJeu } from './pieges';
import type { RuinesJeu } from './ruines';

export interface DependancesVisee {
  outil: OutilEnMain;
  recolte: Recolte;
  combat: Combat;
  village: Village;
  butinSol: ButinSol;
  pieges: PiegesJeu;
  ruines: RuinesJeu;
}

export function creerVisee(jeu: EtatJeu, ctx: Contexte, dep: DependancesVisee) {
  const { vues, compteur, invite } = ctx;
  const demiAngleRegard = (CONFIG.village.angleRegardDegres * Math.PI) / 180;
  let delaiChoixOutil = 0;
  let interactionProposee: PointInteraction | null = null;

  /** `commande` : le joueur peut agir (aucun écran ouvert, pas en caméra libre, debout). */
  function mettreAJour(dt: number, commande: boolean): void {
    const { etat, visite } = jeu;
    delaiChoixOutil -= dt;
    if (delaiChoixOutil <= 0) {
      delaiChoixOutil = 1 / CONFIG.recolte.choixOutilParSeconde;
      const regarde = visite ? null : dep.recolte.elementAPortee(vues.rayonVisee.origine, vues.rayonVisee.direction);
      // Un ennemi à portée : l'épée vient en main toute seule (comme la hache devant un arbre)
      const ennemiProche = visite || jeu.vie.pv <= 0 ? null : dep.combat.ennemiAPortee();
      // (le pilote choisit son outil lui-même, selon sa cible)
      if (!jeu.pilote) {
        if (ennemiProche) dep.outil.prendreEpee();
        else if (regarde) dep.outil.choisirOutil(regarde);
      }
      compteur.definirReticule(!visite, regarde !== null || ennemiProche !== null);
      // Invite d'interaction : objet du village à portée et regardé
      const regard = vues.lacetVisee ?? etat.orientation;
      interactionProposee = commande
        ? interactionVisee(dep.village.interactionsActives(), etat.x, etat.z, regard, CONFIG.village.porteeInteraction, demiAngleRegard)
        : null;
      const baluchonProche = commande && jeu.baluchon !== null && baluchonAPortee(jeu.baluchon, etat.x, etat.z);
      const butinRamassable = commande && dep.butinSol.ramassable();
      const piegePlein = commande && dep.pieges.pleinAPortee() !== null;
      const piegeVide = commande && !piegePlein && dep.pieges.videAPortee() !== null;
      const butinProche = commande && dep.butinSol.procheAPortee() !== null;
      // Petit coffre d'une ruine ou d'une grotte, encore fermé
      const coffreRuine = commande && dep.ruines.coffreFermeAPortee();
      invite.afficher(
        baluchonProche
          ? 'E : récupérer vos affaires'
          : butinRamassable
            ? 'E : ramasser le butin'
            : piegePlein
              ? 'E : relever le piège'
              : piegeVide
              ? 'E : reprendre le piège'
              : coffreRuine
              ? 'E : ouvrir le coffre'
              : interactionProposee
              ? `E : ${interactionProposee.invite}`
              : butinProche
                ? 'Butin au sol (inventaire plein)'
                : null,
      );
    }
  }

  /** Point d'interaction proposé au dernier calcul (null s'il n'y en a pas). */
  function interactionActuelle(): PointInteraction | null {
    return interactionProposee;
  }

  return { mettreAJour, interactionActuelle };
}

export type Visee = ReturnType<typeof creerVisee>;
