// Outil en main (épée, hache, pioche, pousses d'arbre ou torche), tenue portée (armure, casque) et usure de l'équipement.
import { CONFIG } from '../config';
import { outilConseille } from '../regles/recolte';
import { estOutil, type EmplacementBarre } from '../regles/barreOutils';
import {
  franchitSeuilAlerte,
  messageUsure,
  niveauOutil,
  user,
  type EmplacementUsure,
  type TypeArmure,
  type TypeCasque,
} from '../regles/equipement';
import type { ElementDecor } from '../monde/decor';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export function creerOutilEnMain(jeu: EtatJeu, ctx: Contexte) {
  /**
   * Ce que tient la main (personnage et bras de la 1re personne) : la pousse d'arbre ou la torche quand
   * leur case est choisie, sinon l'outil actuel, qui reflète son palier (de base à cristal).
   */
  function montrerOutilEnMain(): void {
    // Le bouclier possédé accompagne l'épée (case 1), au bras gauche
    const bouclier = jeu.emplacement === 'epee' ? jeu.equipement.bouclier : null;
    ctx.personnage.definirBouclier(bouclier);
    ctx.bras.definirBouclier(bouclier);
    if (!estOutil(jeu.emplacement)) {
      ctx.personnage.definirOutil(jeu.emplacement);
      ctx.bras.definirOutil(jeu.emplacement);
      return;
    }
    const niveau = niveauOutil(jeu.equipement, jeu.outilActuel);
    ctx.personnage.definirOutil(jeu.outilActuel, niveau);
    ctx.bras.definirOutil(jeu.outilActuel, niveau);
  }
  montrerOutilEnMain();

  // Tenue montrée sur le personnage (`undefined` : rien encore montré)
  let armureMontree: TypeArmure | null | undefined;
  let casqueMontre: TypeCasque | null | undefined;
  /**
   * Montre sur le personnage (et sur les bras de la 1re personne) l'armure et le casque portés. L'équipement change depuis l'inventaire, la
   * fabrication, l'usure ou un chargement : plutôt que de prévenir à chaque endroit, on compare à chaque image
   * et on ne touche au modèle que si la tenue a changé.
   */
  function suivreTenue(): void {
    const { armure, casque } = jeu.equipement;
    if (armure !== armureMontree) {
      armureMontree = armure;
      ctx.personnage.definirArmure(armure);
      ctx.bras.definirArmure(armure);
    }
    if (casque !== casqueMontre) {
      casqueMontre = casque;
      ctx.personnage.definirCasque(casque);
    }
  }
  suivreTenue();

  /**
   * Le joueur choisit ce qu'il tient (barre d'outils). La pousse d'arbre et la torche se montrent en main sans
   * changer l'outil des règles : `jeu.outilActuel` reste le dernier outil choisi.
   */
  function choisirEmplacement(emplacement: EmplacementBarre): void {
    if (emplacement === jeu.emplacement) return;
    jeu.emplacement = emplacement;
    if (estOutil(emplacement)) jeu.outilActuel = emplacement;
    montrerOutilEnMain();
  }

  /** Le choix automatique d'outil est-il actif ? Toujours pour le pilote, selon la config pour le joueur. */
  function choixAutomatique(): boolean {
    return jeu.pilote !== null || CONFIG.commandes.outilAutomatique;
  }

  /** Prend l'outil qui convient à l'élément (sinon garde l'outil actuel). Sans effet si le joueur choisit lui-même. */
  function choisirOutil(e: ElementDecor): void {
    if (!choixAutomatique()) return;
    const outil = outilConseille(e.type);
    if (outil) choisirEmplacement(outil);
  }

  function prendreEpee(): void {
    if (choixAutomatique()) choisirEmplacement('epee');
  }

  /** Use un outil ou l'armure ; un message prévient une seule fois quand l'objet passe sous le seuil d'alerte. */
  function userEquipement(emplacement: EmplacementUsure): void {
    const avant = jeu.equipement;
    jeu.equipement = user(avant, emplacement);
    if (franchitSeuilAlerte(avant, jeu.equipement, emplacement)) ctx.compteur.annoncerMessage(messageUsure(emplacement));
  }

  return { montrerOutilEnMain, suivreTenue, choisirEmplacement, choisirOutil, prendreEpee, userEquipement };
}

export type OutilEnMain = ReturnType<typeof creerOutilEnMain>;
