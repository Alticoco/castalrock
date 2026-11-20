// Camp des bandits : ses occupants (règles du chef : src/regles/chef.ts). Morvan le Balafré et ses gardes apparaissent
// quand le joueur approche du camp ; Morvan a sa barre de vie en haut de l'écran, appelle des renforts à mi-vie et,
// vaincu, ne revient plus (`jeu.lieux.morvanVaincu`, sauvegardé). Les gardes tués sont remplacés après un délai,
// tant que Morvan est en vie. Rien du combat en cours n'est sauvegardé : il repart de zéro.
import { CONFIG } from '../config';
import { APPEL_MORVAN, ID_MORVAN, creerEtatChef, pasChef, ratioVieChef } from '../regles/chef';
import type { ContexteEnnemi, EtatEnnemi, ResultatPasEnnemi, TypeChef } from '../regles/combat';
import { ID_ECLAT_COEUR, mettreAAbri } from '../regles/butin';
import { etapeAtteinte } from '../regles/histoire';
import { compter } from '../regles/inventaire';
import { creerMorvan, type ModeleEnnemi, type ModeleMorvan } from '../scene/modelesEnnemis';
import { creerBarreChef } from '../ui/barreChef';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

// Présence des occupants : vérifiée toutes les N secondes
const INTERVALLE_PRESENCE = 0.5;
// Contrôle de l'Éclat du Cœur : toutes les N secondes
const INTERVALLE_ECLAT = 5;

export interface DependancesChef {
  /** Fait apparaître un ennemi hors des points d'apparition (combat) ; `pas` remplace son comportement */
  ajouterEnnemiSpecial: (
    id: string,
    type: 'bandit' | TypeChef,
    x: number,
    z: number,
    options?: { modele?: ModeleEnnemi; pas?: (etat: EtatEnnemi, ctx: ContexteEnnemi, dt: number) => ResultatPasEnnemi },
  ) => void;
  retirerEnnemi: (id: string) => void;
  rafraichirInventaire: () => void;
  /** Fait passer tout de suite l'étape d'histoire « Bats Morvan » */
  verifierHistoire: () => void;
}

export function creerChef(jeu: EtatJeu, ctx: Contexte, dep: DependancesChef) {
  const { planCamp, lieux, mine, invite, effetsCombat } = ctx;
  const C = CONFIG.lieux.camp;
  const barre = creerBarreChef(ctx.ui);
  const idsGardes = planCamp.postesGardes.map((_, i) => `camp:garde:${i}`);
  // Instant de mort (temps de jeu) des gardes tués, pour le délai avant leur remplacement
  const mortsGardes = new Map<string, number>();
  // Étape d'histoire à partir de laquelle Morvan est au camp
  const ETAPE_ARRIVEE_MORVAN = 'plan-gaspard';
  let chef = creerEtatChef();
  let modele: ModeleMorvan | null = null;
  let renforts: string[] = [];
  let numeroAppel = 0;
  // Demandes venues du pas de Morvan, traitées après la boucle du combat
  let appelDemande = false;
  let renvoiDemande = false;
  let delai = 0;
  let delaiEclat = INTERVALLE_ECLAT;

  /** Filet de sécurité : Morvan vaincu, Cœur pas reforgé, Éclat introuvable (inventaire, sac, coffre, baluchon) : il est rendu. */
  function verifierEclat(): void {
    if (!jeu.lieux.morvanVaincu || jeu.lieux.coeurReforge) return;
    const possede =
      compter(jeu.inventaire, ID_ECLAT_COEUR) + compter(jeu.sac, ID_ECLAT_COEUR) + compter(jeu.coffre, ID_ECLAT_COEUR) +
      (jeu.baluchon?.contenu.filter((p) => p.objet === ID_ECLAT_COEUR).length ?? 0);
    if (possede > 0) return;
    const abri = mettreAAbri(jeu.inventaire, jeu.coffre, ID_ECLAT_COEUR);
    jeu.inventaire = abri.inventaire;
    jeu.coffre = abri.coffre;
    dep.rafraichirInventaire();
    invite.annoncer(
      abri.lieu === 'coffre' ? 'L’Éclat du Cœur a été mis à l’abri dans le coffre du village' : 'L’Éclat du Cœur est de nouveau dans tes affaires',
    );
  }
  verifierEclat();

  /** Le pas de Morvan : règles du chef, puis ce que le reste du jeu doit en savoir (pose de charge, appel, nouveau départ). */
  function pasMorvan(etat: EtatEnnemi, c: ContexteEnnemi, dt: number): ResultatPasEnnemi {
    const r = pasChef(etat, chef, c, dt);
    chef = r.chef;
    if (r.appel) appelDemande = true;
    if (r.recommence) renvoiDemande = true;
    modele?.definirCharge(chef.enCharge);
    return { etat: r.etat, degats: r.degats };
  }

  function ajouterMorvan(): void {
    chef = creerEtatChef();
    // D'anciens renforts restés près du camp (Morvan disparu quand le joueur s'est éloigné) s'en vont aussi
    renvoyerRenforts();
    modele = creerMorvan();
    dep.ajouterEnnemiSpecial(ID_MORVAN, 'morvan', planCamp.posteMorvan.x, planCamp.posteMorvan.z, { modele, pas: pasMorvan });
  }

  /**
   * Les occupants apparaissent quand le joueur est assez près du camp (ils disparaissent tout seuls, loin, comme les
   * autres ennemis). Morvan n'y est qu'à partir du plan de Gaspard (acte IV) : avant, le joueur qui tombe sur le camp
   * n'y trouve que ses gardes, et ne peut pas battre le chef avant que l'histoire l'y envoie.
   */
  function verifierPresence(): void {
    const { x, z } = jeu.etat;
    if (jeu.lieux.morvanVaincu || mine.contient(x, z)) return;
    if (Math.hypot(x - lieux.camp.x, z - lieux.camp.z) > C.distancePresence) return;
    if (!jeu.ennemis.has(ID_MORVAN) && etapeAtteinte(jeu.histoire, ETAPE_ARRIVEE_MORVAN)) ajouterMorvan();
    idsGardes.forEach((id, i) => {
      if (jeu.ennemis.has(id)) return;
      const mort = mortsGardes.get(id);
      if (mort !== undefined && jeu.tempsJeu - mort < C.delaiRetourGarde) return;
      mortsGardes.delete(id);
      const poste = planCamp.postesGardes[i];
      dep.ajouterEnnemiSpecial(id, 'bandit', poste.x, poste.z);
    });
  }

  /** « À moi, les gars ! » : des bandits arrivent par la porte. */
  function appeler(): void {
    numeroAppel += 1;
    invite.annoncer(APPEL_MORVAN);
    planCamp.postesRenforts.forEach((poste, i) => {
      const id = `camp:renfort:${numeroAppel}:${i}`;
      dep.ajouterEnnemiSpecial(id, 'bandit', poste.x, poste.z);
      effetsCombat.fumee(poste.x, planCamp.lieu.y, poste.z);
      renforts.push(id);
    });
  }

  /** Le combat repart de zéro : les renforts encore debout s'en vont dans un nuage de fumée. */
  function renvoyerRenforts(): void {
    for (const id of renforts) {
      const present = jeu.ennemis.get(id);
      if (!present) continue;
      effetsCombat.fumee(present.etat.x, present.etat.y, present.etat.z);
      dep.retirerEnnemi(id);
    }
    renforts = [];
  }

  /** À chaque image, après le combat. `fige` : un écran est ouvert, rien ne bouge. */
  function mettreAJour(dt: number, fige: boolean): void {
    if (!fige) {
      delai -= dt;
      if (delai <= 0) {
        delai = INTERVALLE_PRESENCE;
        verifierPresence();
      }
    }
    delaiEclat -= dt;
    if (delaiEclat <= 0) {
      delaiEclat = INTERVALLE_ECLAT;
      verifierEclat();
    }
    if (appelDemande) {
      appelDemande = false;
      appeler();
    }
    if (renvoiDemande) {
      renvoiDemande = false;
      renvoyerRenforts();
    }
    for (const id of idsGardes) {
      if (jeu.ennemis.get(id)?.etat.phase === 'mort' && !mortsGardes.has(id)) mortsGardes.set(id, jeu.tempsJeu);
    }

    const morvan = jeu.ennemis.get(ID_MORVAN)?.etat;
    if (!morvan) modele = null;
    if (morvan?.phase === 'mort' && !jeu.lieux.morvanVaincu) {
      jeu.lieux = { ...jeu.lieux, morvanVaincu: true, campDecouvert: true };
      invite.annoncer('Morvan le Balafré est vaincu !');
      dep.verifierHistoire();
    }
    const proche = morvan && morvan.phase !== 'mort' && jeu.vie.pv > 0 && Math.hypot(morvan.x - jeu.etat.x, morvan.z - jeu.etat.z) <= C.distanceBarreChef;
    barre.afficher(proche && morvan ? { nom: CONFIG.chefs.morvan.nom, ratio: ratioVieChef(morvan) } : null);
  }

  return { mettreAJour };
}
