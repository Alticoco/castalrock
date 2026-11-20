// Mort douce : baluchon laissé sur place, réapparition, potion de soin, et boussole qui mène au baluchon.
import { CONFIG } from '../config';
import { compter, retirer as retirerObjets } from '../regles/inventaire';
import { franchitSeuilAlerte, messageUsure } from '../regles/equipement';
import {
  appliquerMort,
  definirPointReapparition,
  recupererBaluchon,
} from '../regles/mort';
import { creerEtatPersonnage } from '../regles/deplacement';
import { creerEtatFrappe } from '../regles/frappe';
import { pvMax } from '../regles/progression';
import { APPARITION } from '../regles/village';
import { MESSAGES_POTION, boirePotion, creerVieJoueur } from '../regles/combat';
import { creerModeleBaluchon, type ModeleBaluchon } from '../scene/modeleBaluchon';
import { NOMS_TYPES_REPERE } from '../regles/reperes';
import type { PointBoussole } from '../ui/boussole';
import { COULEURS_REPERES } from '../ui/couleursReperes';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesMort {
  rafraichirInventaire: () => void;
  /** Pendant une attaque du village : le bandit le plus proche, que la boussole montre après le baluchon ; sinon `null` */
  cibleAttaque: () => { x: number; z: number; nom: string } | null;
}

export function creerMort(jeu: EtatJeu, ctx: Contexte, dep: DependancesMort) {
  const { scene, terrain, mine, maison, planMine, compteur, invite, interfaceCombat, renderer, vues, boussole } = ctx;
  let modeleBaluchon: ModeleBaluchon | null = null;
  // Écran « Vous êtes tombé… » : secondes restantes avant la réapparition (0 = debout)
  let resteChute = 0;

  /** Montre, déplace ou retire le modèle du baluchon pour qu'il reflète `jeu.baluchon`. */
  function synchroniserModeleBaluchon(): void {
    const { baluchon } = jeu;
    if (!baluchon) {
      if (modeleBaluchon) {
        scene.remove(modeleBaluchon.objet);
        modeleBaluchon.liberer();
        modeleBaluchon = null;
      }
      return;
    }
    if (!modeleBaluchon) {
      modeleBaluchon = creerModeleBaluchon();
      scene.add(modeleBaluchon.objet);
    }
    modeleBaluchon.placer(baluchon.x, terrain.hauteur(baluchon.x, baluchon.z), baluchon.z);
  }
  synchroniserModeleBaluchon();

  /** Change le lieu de réapparition (pour l'auberge et le feu de camp, étape 21). */
  function changerPointReapparition(x: number, z: number, nom: string): void {
    jeu.pointReapparition = definirPointReapparition(x, z, nom);
  }

  /**
   * Mort douce : l'inventaire porté est déposé dans un baluchon à l'endroit de la chute (fusionné avec l'ancien),
   * l'équipement s'use. Le sac magique et le coffre ne sont pas touchés. Puis écran « Vous êtes tombé… ».
   */
  function surMort(): void {
    const avant = jeu.equipement;
    const r = appliquerMort(
      { inventaire: jeu.inventaire, equipement: jeu.equipement, baluchon: jeu.baluchon },
      jeu.etat.x,
      jeu.etat.z,
    );
    jeu.inventaire = r.inventaire;
    jeu.equipement = r.equipement;
    jeu.baluchon = r.baluchon;
    synchroniserModeleBaluchon();
    dep.rafraichirInventaire();
    for (const emplacement of ['hache', 'pioche', 'epee', 'armure'] as const) {
      if (franchitSeuilAlerte(avant, jeu.equipement, emplacement)) compteur.annoncerMessage(messageUsure(emplacement));
    }
    invite.annoncer(CONFIG.mort.message);
    resteChute = CONFIG.combat.dureeChute;
    interfaceCombat.montrerChute(true);
  }

  /** Touche E près du baluchon : le contenu revient dans l'inventaire porté, ce qui ne rentre pas reste dans le baluchon. */
  function recupererSesAffaires(): void {
    if (!jeu.baluchon) return;
    const r = recupererBaluchon(jeu.inventaire, jeu.baluchon);
    jeu.inventaire = r.inventaire;
    jeu.baluchon = r.baluchon;
    synchroniserModeleBaluchon();
    dep.rafraichirInventaire();
    if (r.reste > 0) {
      invite.annoncer(r.recupere > 0 ? 'Inventaire plein : une partie reste dans le baluchon' : 'Inventaire plein');
    } else {
      invite.annoncer('Vous avez récupéré vos affaires');
    }
  }

  /** Fin de la chute : retour au dernier point de réapparition (la place du village par défaut), avec toute sa vie. */
  function reapparaitre(): void {
    const { pointReapparition } = jeu;
    // Un point de réapparition dans la mine mais pas dans une galerie creusée : salle d'entrée
    const dansLaRoche = mine.contient(pointReapparition.x, pointReapparition.z) && !mine.estLibre(pointReapparition.x, pointReapparition.z);
    const r = dansLaRoche ? planMine.arrivee : pointReapparition;
    jeu.etat = creerEtatPersonnage(r.x, terrain.hauteur(r.x, r.z), r.z, APPARITION.orientation);
    jeu.frappe = creerEtatFrappe();
    jeu.vie = creerVieJoueur(pvMax(jeu.progression), pvMax(jeu.progression));
    interfaceCombat.montrerChute(false);
  }

  /** Compte à rebours de l'écran de chute (hors pause d'écran) : à zéro, le joueur réapparaît. */
  function mettreAJourChute(dt: number): void {
    if (resteChute > 0) {
      resteChute -= dt;
      if (resteChute <= 0) reapparaitre();
    }
  }

  /** Touche R : boit une potion de soin de l'inventaire porté. */
  function boire(): void {
    const r = boirePotion(jeu.vie, compter(jeu.inventaire, 'potion-soin'), pvMax(jeu.progression));
    if (!r.ok) {
      const message = r.raison ? MESSAGES_POTION[r.raison] : '';
      if (message) compteur.annoncerMessage(message);
      return;
    }
    jeu.vie = r.vie;
    jeu.inventaire = retirerObjets(jeu.inventaire, 'potion-soin', 1).conteneur;
    dep.rafraichirInventaire();
    interfaceCombat.chiffre(
      renderer.domElement.clientWidth / 2,
      renderer.domElement.clientHeight - 70,
      `+${Math.round(r.soin)}`,
      '#8fe07a',
    );
  }

  /**
   * Baluchon : rayon animé. Boussole en bandeau : le village toujours, plus la cible suivie : le baluchon
   * d'abord, sinon le bandit le plus proche pendant une attaque. Cible de l'autre côté
   * du portail : la boussole mène au passage. Cachée en mode visite ; sous terre (mine, maison), seulement s'il y a une cible.
   */
  function mettreAJourBaluchon(dt: number): void {
    const { etat, baluchon } = jeu;
    modeleBaluchon?.mettreAJour(dt);
    // Plus aucun guidage vers les quêtes (décision du 19/11/2026) : ni la mine, ni l'objectif de l'histoire.
    // Restent le baluchon (affaires perdues à la mort) et, pendant une attaque, le bandit le plus proche.
    const attaque = dep.cibleAttaque();
    const cible = baluchon
      ? { ...mine.versCible(baluchon.x, baluchon.z), nom: 'Baluchon', forme: 'baluchon' as const }
      : attaque
        ? { ...mine.versCible(attaque.x, attaque.z), nom: attaque.nom, forme: 'repere' as const }
        : null;
    const sousTerre = mine.dedans || maison.dedans;
    if (jeu.visite || (sousTerre && !cible)) {
      boussole.afficher(null);
      return;
    }
    const { reperes } = jeu;
    // Le joueur suit un repère ou le village : le baluchon et le bandit restent de simples pictogrammes
    const suiviParJoueur = !sousTerre && reperes.suivi !== null;
    const point = (x: number, z: number, nom: string, forme: PointBoussole['forme'], suivi: boolean, couleur?: string): PointBoussole => ({
      direction: Math.atan2(x - etat.x, z - etat.z),
      distance: Math.hypot(x - etat.x, z - etat.z),
      nom,
      forme,
      suivi,
      ...(couleur ? { couleur } : {}),
    });
    const points: PointBoussole[] = [];
    if (!sousTerre) {
      points.push(point(0, 0, 'Village', 'village', reperes.suivi === 'village'));
      for (const r of reperes.liste) {
        points.push(point(r.x, r.z, NOMS_TYPES_REPERE[r.type], 'repere', reperes.suivi === r.id, COULEURS_REPERES[r.type]));
      }
    }
    if (cible) points.push(point(cible.x, cible.z, cible.nom, cible.forme, !suiviParJoueur));
    boussole.afficher({ lacet: vues.lacetVisee ?? etat.orientation, points, cardinaux: !sousTerre });
  }

  return {
    surMort,
    recupererSesAffaires,
    mettreAJourChute,
    boire,
    mettreAJourBaluchon,
    changerPointReapparition,
  };
}

export type Mort = ReturnType<typeof creerMort>;
