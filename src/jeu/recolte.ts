// Récolte : viser un élément du décor et le frapper avec l'outil en main.
import * as THREE from 'three';
import { CONFIG } from '../config';
import { INFOS_DECOR, type ElementDecor } from '../monde/decor';
import { estRecoltable, frapper as frapperElement, generateurButin, messageVerrouPioche, peutRecolter, tirerButin } from '../regles/recolte';
import { ajouterButin, peutAjouterButin } from '../regles/inventaire';
import { facteurDegats, niveauOutil } from '../regles/equipement';
import { butinAvecBonus, facteurDegatsRecolte, xpDestruction } from '../regles/progression';
import type { EvenementQuete } from '../regles/quetes';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';
import type { OutilEnMain } from './outilEnMain';
import type { Repousse } from './repousse';

export interface DependancesRecolte {
  outil: OutilEnMain;
  repousse: Repousse;
  rafraichirInventaire: () => void;
  donnerXp: (quantite: number) => void;
  signalerQuete: (ev: EvenementQuete) => void;
}

export function creerRecolte(jeu: EtatJeu, ctx: Contexte, dep: DependancesRecolte) {
  const { decor, compteur, effets } = ctx;
  const centrePerso = new THREE.Vector3();

  /** Vrai si l'élément est à portée du personnage (mesuré au sol, bord de l'élément compris). */
  function aPortee(e: ElementDecor): boolean {
    const reach = CONFIG.recolte.portee + INFOS_DECOR[e.type].rayonVisee * e.echelle;
    return Math.hypot(e.x - jeu.etat.x, e.z - jeu.etat.z) <= reach;
  }

  /** Élément visé par un rayon, seulement s'il est à portée du personnage. */
  function elementAPortee(origine: THREE.Vector3, direction: THREE.Vector3): ElementDecor | null {
    const { etat } = jeu;
    centrePerso.set(etat.x, etat.y, etat.z);
    // Le rayon part de la caméra : on l'allonge de sa distance au personnage
    const longueur = origine.distanceTo(centrePerso) + CONFIG.recolte.portee + 3;
    const e = decor.elementVise(origine, direction, longueur);
    return e && aPortee(e) ? e : null;
  }

  /**
   * Bruit d'un coup sur un élément du décor, placé à mi-hauteur de l'élément : bois sous la hache, pierre sous la pioche,
   * feuillage pour les buissons et les plantes ; au coup qui l'abat, le craquement de l'arbre ou la roche qui éclate en plus.
   */
  function bruitCoup(cible: ElementDecor, detruit: boolean, volume = 1): void {
    const infos = INFOS_DECOR[cible.type];
    const position = { x: cible.x, y: cible.y + 1, z: cible.z };
    const coup = infos.arbre ? 'hache' : infos.vegetal ? 'feuilles' : 'pioche';
    ctx.sons.jouer(coup, { position, volume });
    if (!detruit || (infos.vegetal && !infos.arbre)) return;
    ctx.sons.jouer(infos.arbre ? 'arbre-abattu' : 'roche-cassee', { position, volume });
  }

  /** Un coup d'outil sur un élément à portée : points de vie, usure, et à la destruction butin, XP et quêtes. */
  function frapperElementVise(cible: ElementDecor): void {
    // Butin qui ne rentre pas : la frappe n'abîme pas l'élément, rien n'est perdu
    if (estRecoltable(cible.type) && !peutAjouterButin(jeu.inventaire, tirerButin(cible.type, cible.id))) {
      compteur.annoncerMessage('Inventaire plein');
      return;
    }
    // Verrou : une pioche trop faible ne fait aucun dégât et ne s'use pas
    if (!peutRecolter(cible.type, niveauOutil(jeu.equipement, 'pioche'))) {
      // La pioche rebondit sur la roche trop dure : un petit tintement, sans éclat
      bruitCoup(cible, false, 0.6);
      compteur.annoncerMessage(messageVerrouPioche(cible.type));
      return;
    }
    dep.outil.choisirOutil(cible);
    const coup = frapperElement(
      jeu.etatRecolte,
      cible,
      jeu.outilActuel,
      undefined,
      facteurDegats(jeu.equipement, jeu.outilActuel) * facteurDegatsRecolte(jeu.progression, cible.type),
    );
    jeu.etatRecolte = coup.etat;
    if (estRecoltable(cible.type)) dep.outil.userEquipement(jeu.outilActuel);
    bruitCoup(cible, coup.detruit);
    if (!coup.detruit) {
      effets.coup(cible, jeu.etat.x, jeu.etat.z);
      return;
    }
    effets.detruire(cible, jeu.etat.x, jeu.etat.z);
    dep.repousse.marquerRecolte(cible);
    // Cueilleur et Abondance : du butin en plus (tirage à graine : élément + instant de jeu)
    const butin = butinAvecBonus(
      jeu.progression,
      cible.type,
      coup.butin,
      generateurButin(CONFIG.graine, `bonus:${cible.id}:${Math.floor(jeu.tempsJeu)}`),
    );
    jeu.inventaire = ajouterButin(jeu.inventaire, butin).conteneur;
    dep.rafraichirInventaire();
    compteur.annoncerButin(butin);
    dep.donnerXp(xpDestruction(cible.type));
    dep.signalerQuete({ type: 'elementDetruit', element: cible.type });
  }

  return { aPortee, elementAPortee, frapperElementVise };
}

export type Recolte = ReturnType<typeof creerRecolte>;
