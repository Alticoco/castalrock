// Sauvegarde : lecture au démarrage, écriture automatique, et écriture quand la page se cache ou se ferme.
import { CONFIG } from '../config';
import { lirePartie, serialiser, type DonneesPartie } from '../regles/sauvegarde';
import { copierSauvegardeRefusee, ecrireSauvegarde, lireSauvegarde } from '../moteur/stockage';
import { creerEtatPersonnage } from '../regles/deplacement';
import { porteMaisonJoueur } from '../regles/village';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface PartieLue {
  /** Partie sauvegardée dans le navigateur (null = nouvelle partie : absente, abîmée ou d'une autre graine) */
  partie: DonneesPartie | null;
  /** Une sauvegarde existait mais a été refusée : on l'a mise de côté avant que la sauvegarde automatique ne l'écrase */
  sauvegardeMiseDeCote: boolean;
}

/** Lit la partie sauvegardée, avant la création du monde. */
export function lirePartieAuDemarrage(): PartieLue {
  const texteSauvegarde = lireSauvegarde();
  const partie = lirePartie(texteSauvegarde, CONFIG.graine);
  const sauvegardeMiseDeCote = texteSauvegarde !== null && partie === null && copierSauvegardeRefusee(texteSauvegarde);
  return { partie, sauvegardeMiseDeCote };
}

export function creerSauvegarde(jeu: EtatJeu, ctx: Contexte, sauvegardeMiseDeCote: boolean, arbreMigre = false) {
  const { vues, mine, maison, terrain, invite } = ctx;
  if (sauvegardeMiseDeCote) {
    invite.annoncer("L'ancienne sauvegarde n'a pas pu être relue : elle est gardée de côté, une nouvelle partie commence");
  }
  if (arbreMigre) invite.annoncer("L'arbre de compétences a changé : vos points vous ont été rendus");
  // Faux une fois « Nouvelle partie » demandée : la page qui se ferme ne doit pas réécrire la sauvegarde
  let sauvegardePermise = true;
  let delaiSauvegarde = 0;

  function donneesPartie(): DonneesPartie {
    let { etat } = jeu;
    // Dans la maison : la partie est gardée dehors, devant la porte (le format de sauvegarde ne connaît pas la maison)
    if (maison.contient(etat.x, etat.z)) {
      const p = porteMaisonJoueur(jeu.niveauVillageReel, CONFIG.maison.distanceSortie);
      if (p) etat = creerEtatPersonnage(p.x, terrain.hauteur(p.x, p.z), p.z, p.orientation);
    }
    return {
      graine: CONFIG.graine,
      personnage: { x: etat.x, y: etat.y, z: etat.z, orientation: etat.orientation },
      vue: vues.vue,
      tempsJeu: jeu.tempsJeu,
      inventaire: jeu.inventaire,
      sac: jeu.sac,
      retires: jeu.retires.map(({ id, instant }) => ({ id, instant })),
      plantes: jeu.plantes,
      compteurPlantes: jeu.compteurPlantes,
      coffre: jeu.coffre,
      niveauVillage: jeu.niveauVillageReel,
      equipement: jeu.equipement,
      vie: jeu.vie.pv,
      baluchon: jeu.baluchon,
      pointReapparition: jeu.pointReapparition,
      progression: jeu.progression,
      quetes: jeu.quetes,
      histoire: jeu.histoire,
      marchand: jeu.marchand,
      attaques: jeu.attaques,
      lieux: jeu.lieux,
      tresorsOuverts: jeu.tresorsOuverts,
      potager: jeu.potager,
      ...(Object.keys(jeu.tresorsEntames).length > 0 ? { tresorsEntames: jeu.tresorsEntames } : {}),
      ...(jeu.finVue ? { finVue: true } : {}),
      feuCamp: jeu.feuCamp,
      pieges: [...jeu.pieges],
      reperes: jeu.reperes,
      mine: { dedans: mine.contient(etat.x, etat.z) && !maison.contient(etat.x, etat.z), visitee: jeu.mineVisitee },
    };
  }

  /** Écrit la partie dans le navigateur. Faux si le navigateur refuse. */
  function sauvegarder(): boolean {
    if (!sauvegardePermise) return false;
    return ecrireSauvegarde(serialiser(donneesPartie()));
  }

  /** Après « Nouvelle partie » : la page qui se ferme ne doit pas réécrire la sauvegarde. */
  function interdire(): void {
    sauvegardePermise = false;
  }

  /** Sauvegarde automatique, à chaque image. */
  function mettreAJour(dt: number): void {
    delaiSauvegarde += dt;
    if (delaiSauvegarde >= CONFIG.sauvegarde.intervalleSecondes) {
      delaiSauvegarde = 0;
      sauvegarder();
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') sauvegarder();
  });
  window.addEventListener('pagehide', () => {
    sauvegarder();
  });

  return { sauvegarder, interdire, mettreAJour };
}

export type Sauvegarde = ReturnType<typeof creerSauvegarde>;
