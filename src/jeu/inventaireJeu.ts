// Écran d'inventaire (touche Tab ou I) : rangement des piles entre l'inventaire porté, le sac magique et le coffre.
// L'écran signale ce que fait le joueur (glisser, Maj + clic, clic droit...) ; les règles sont dans src/regles/.
import { deplacerPile, glisserPile, retirer, type Conteneur } from '../regles/inventaire';
import { retirerArmureVers, retirerCasqueVers } from '../regles/armureGlisse';
import { emplacementApresTouche, EMPLACEMENTS_BARRE, type EmplacementBarre } from '../regles/barreOutils';
import {
  MESSAGES_EQUIPEMENT,
  equiperArmure,
  equiperCasque,
  retirerArmure,
  retirerCasque,
  typeArmureDeObjet,
  typeCasqueDeObjet,
} from '../regles/equipement';
import { estAliment, manger, MESSAGES_REPAS } from '../regles/cuisine';
import { pvMax } from '../regles/progression';
import { creerEcranInventaire, type CaseConteneur, type NomConteneur } from '../ui/ecranInventaire';
import type { Contexte } from './contexte';
import type { OutilEnMain } from './outilEnMain';
import type { EtatJeu } from './partie';

export interface DependancesInventaire {
  rafraichirQuetes: () => void;
  /** Outil en main (créé par main.ts) : choisir une case de la barre passe par le même code que les touches 1 à 6 */
  outil: OutilEnMain;
}

export function creerInventaireJeu(jeu: EtatJeu, ctx: Contexte, dep: DependancesInventaire) {
  const { entrees, invite } = ctx;
  const { outil } = dep;

  /** Met à jour l'écran d'inventaire et les quêtes (qui lisent l'inventaire porté). */
  function rafraichirInventaire(): void {
    ecranInventaire.afficher(jeu.inventaire, jeu.sac, jeu.coffre, jeu.equipement, jeu.emplacement);
    dep.rafraichirQuetes();
  }

  function lire(nom: NomConteneur): Conteneur {
    return nom === 'inventaire' ? jeu.inventaire : nom === 'sac' ? jeu.sac : jeu.coffre;
  }

  function ecrire(nom: NomConteneur, conteneur: Conteneur): void {
    if (nom === 'inventaire') jeu.inventaire = conteneur;
    else if (nom === 'sac') jeu.sac = conteneur;
    else jeu.coffre = conteneur;
  }

  /** Glisser-déposer : la pile d'une case va sur une autre case (vide, même objet ou objet à échanger). */
  function deposer(de: CaseConteneur, vers: CaseConteneur): void {
    const meme = de.conteneur === vers.conteneur;
    const r = glisserPile(lire(de.conteneur), de.indice, lire(vers.conteneur), vers.indice, meme);
    if (!r.change) return;
    ecrire(de.conteneur, r.source);
    if (!meme) ecrire(vers.conteneur, r.destination);
    rafraichirInventaire();
  }

  /** Une armure de l'inventaire s'équipe ; celle déjà portée est échangée (elle revient dans la case libérée). */
  function equiperDepuis(de: CaseConteneur): void {
    const objet = de.conteneur === 'inventaire' ? jeu.inventaire.cases[de.indice]?.objet : undefined;
    const type = objet ? typeArmureDeObjet(objet) : null;
    if (!type) return;
    const r = equiperArmure(jeu.equipement, jeu.inventaire, type, de.indice);
    if (!r.ok && r.raison) invite.annoncer(MESSAGES_EQUIPEMENT[r.raison]);
    jeu.equipement = r.equipement;
    jeu.inventaire = r.inventaire;
    rafraichirInventaire();
  }

  /** L'armure portée retourne dans l'inventaire (dans la case visée si elle est vide). */
  function retirerPortee(vers?: CaseConteneur): void {
    const r = vers ? retirerArmureVers(jeu.equipement, jeu.inventaire, vers.indice) : retirerArmure(jeu.equipement, jeu.inventaire);
    if (!r.ok && r.raison) invite.annoncer(MESSAGES_EQUIPEMENT[r.raison]);
    jeu.equipement = r.equipement;
    jeu.inventaire = r.inventaire;
    rafraichirInventaire();
  }

  /** Un casque de l'inventaire s'équipe ; s'il y en a déjà un de porté, les deux s'échangent. */
  function equiperCasqueDepuis(de: CaseConteneur): void {
    const objet = de.conteneur === 'inventaire' ? jeu.inventaire.cases[de.indice]?.objet : undefined;
    const type = objet ? typeCasqueDeObjet(objet) : null;
    if (!type) return;
    const r = equiperCasque(jeu.equipement, jeu.inventaire, type, de.indice);
    if (!r.ok && r.raison) invite.annoncer(MESSAGES_EQUIPEMENT[r.raison]);
    jeu.equipement = r.equipement;
    jeu.inventaire = r.inventaire;
    rafraichirInventaire();
  }

  /** Le casque porté retourne dans l'inventaire (dans la case visée si elle est vide). */
  function retirerCasquePorte(vers?: CaseConteneur): void {
    const r = vers ? retirerCasqueVers(jeu.equipement, jeu.inventaire, vers.indice) : retirerCasque(jeu.equipement, jeu.inventaire);
    if (!r.ok && r.raison) invite.annoncer(MESSAGES_EQUIPEMENT[r.raison]);
    jeu.equipement = r.equipement;
    jeu.inventaire = r.inventaire;
    rafraichirInventaire();
  }

  /**
   * Maj + clic sur une pile : elle passe dans l'autre conteneur (le sac est magique : possible n'importe où).
   * Coffre ouvert : l'inventaire porté et le coffre s'échangent leurs piles.
   */
  function envoyerVersAutre(de: CaseConteneur): void {
    const { conteneur: depuis, indice } = de;
    if (depuis === 'coffre') {
      const r = deplacerPile(jeu.coffre, indice, jeu.inventaire);
      jeu.coffre = r.source;
      jeu.inventaire = r.destination;
    } else if (depuis === 'inventaire' && ecranInventaire.avecCoffre) {
      const r = deplacerPile(jeu.inventaire, indice, jeu.coffre);
      jeu.inventaire = r.source;
      jeu.coffre = r.destination;
    } else if (depuis === 'inventaire') {
      const r = deplacerPile(jeu.inventaire, indice, jeu.sac);
      jeu.inventaire = r.source;
      jeu.sac = r.destination;
    } else {
      const r = deplacerPile(jeu.sac, indice, jeu.inventaire);
      jeu.sac = r.source;
      jeu.inventaire = r.destination;
    }
    rafraichirInventaire();
  }

  /** Clic droit sur une pile de l'inventaire porté : un aliment se mange, une armure ou un casque s'équipe. */
  function utiliser(de: CaseConteneur): void {
    const objet = de.conteneur === 'inventaire' ? jeu.inventaire.cases[de.indice]?.objet : undefined;
    if (!objet) return;
    if (estAliment(objet)) {
      // Vie rendue tout de suite, puis régénération
      const r = manger(jeu.vie, objet, pvMax(jeu.progression));
      if (r.ok) {
        jeu.vie = r.vie;
        jeu.inventaire = retirer(jeu.inventaire, objet, 1).conteneur;
        invite.annoncer(`+${Math.round(r.soin)} PV`);
      } else if (MESSAGES_REPAS[r.raison ?? 'pas-aliment']) {
        invite.annoncer(MESSAGES_REPAS[r.raison ?? 'pas-aliment']);
      }
      rafraichirInventaire();
    } else if (typeArmureDeObjet(objet)) {
      equiperDepuis(de);
    } else if (typeCasqueDeObjet(objet)) {
      equiperCasqueDepuis(de);
    }
  }

  /** Clic sur une case de la barre d'outils : comme la touche du chiffre (la case 6 passe des pousses au piège). */
  function choisirBarre(emplacement: EmplacementBarre): void {
    if (emplacement === 'arc' && !jeu.equipement.arc) {
      invite.annoncer("Pas d'arc (compétence Tir à l'arc, puis établi)");
      return;
    }
    const choisi = emplacementApresTouche(jeu.emplacement, `Digit${EMPLACEMENTS_BARRE.indexOf(emplacement) + 1}`);
    if (choisi) outil.choisirEmplacement(choisi);
    rafraichirInventaire();
  }

  const ecranInventaire = creerEcranInventaire(ctx.ui, {
    deposer,
    equiperArmure: equiperDepuis,
    retirerArmure: retirerPortee,
    equiperCasque: equiperCasqueDepuis,
    retirerCasque: retirerCasquePorte,
    envoyer: envoyerVersAutre,
    utiliser,
    choisirBarre,
    fermer: () => basculerInventaire(),
  });

  /** Ouvre ou ferme l'écran d'inventaire (avec le coffre du village si demandé) : le pointeur est libéré tant qu'il est ouvert. */
  function basculerInventaire(avecCoffre = false): void {
    if (ecranInventaire.ouvert) {
      ecranInventaire.fermer();
      entrees.definirVerrouillage(!jeu.visite);
      entrees.verrouiller();
    } else {
      ecranInventaire.ouvrir(avecCoffre);
      entrees.definirVerrouillage(false);
      rafraichirInventaire();
    }
  }

  return { ecran: ecranInventaire, rafraichirInventaire, basculerInventaire };
}

export type InventaireJeu = ReturnType<typeof creerInventaireJeu>;
