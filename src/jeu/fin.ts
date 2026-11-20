// Fin du jeu : quand l'histoire est terminée, le livre de fin s'ouvre une fois (src/ui/livreFin.ts, textes dans
// src/regles/fin.ts). Tant qu'il est ouvert, le jeu est figé comme en pause. Une fois refermé, on peut encore se
// promener ; le menu pause permet de le relire.
import { CONFIG } from '../config';
import { pagesLivreFin } from '../regles/fin';
import { histoireFinie } from '../regles/histoire';
import { creerLivreFin } from '../ui/livreFin';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export function creerFin(jeu: EtatJeu, ctx: Contexte, sauvegarder: () => boolean) {
  const { entrees, invite } = ctx;
  let attente = 0;

  const livre = creerLivreFin(ctx.ui, () => {
    const premiereFois = !jeu.finVue;
    jeu.finVue = true;
    sauvegarder();
    entrees.definirVerrouillage(!jeu.visite);
    entrees.verrouiller();
    // Livre refermé avec Échap : le navigateur ne recapture pas la souris sans clic, on le dit
    window.setTimeout(() => {
      const clic = !entrees.pointeurVerrouille && !jeu.visite ? ' Clique dans le jeu pour reprendre la vue.' : '';
      if (premiereFois) {
        invite.annoncer(`L’histoire est finie. La vallée reste ouverte : promène-toi, ou commence une nouvelle partie (Échap, puis Parties).${clic}`);
      } else if (clic) {
        invite.annoncer(clic.trim());
      }
    }, 250);
  });

  /** Ouvre le livre (fin de l'histoire, ou « Relire la fin » du menu pause) : la souris est rendue au joueur. */
  function ouvrir(): void {
    if (livre.ouvert) return;
    const jours = Math.floor(jeu.tempsJeu / CONFIG.temps.dureeJourSecondes) + 1;
    // Le livre d'abord : la libération de la souris ne doit pas être prise pour un Échap (qui ouvrirait le menu pause)
    livre.ouvrir(pagesLivreFin({ jours, niveau: jeu.progression.niveau }));
    entrees.definirVerrouillage(false);
  }

  /**
   * À chaque image : histoire terminée et livre jamais refermé, il s'ouvre après un court délai (le temps de lire les
   * derniers messages), dès que le joueur est libre (`occupe` : un écran, un dialogue ou la carte est ouvert).
   */
  function mettreAJour(dt: number, occupe: boolean): void {
    if (jeu.finVue || livre.ouvert || !histoireFinie(jeu.histoire)) {
      attente = 0;
      return;
    }
    if (occupe || jeu.visite || jeu.vie.pv <= 0) return;
    attente += dt;
    if (attente >= CONFIG.histoire.delaiLivreFin) ouvrir();
  }

  return {
    get ouvert() {
      return livre.ouvert;
    },
    ouvrir,
    mettreAJour,
  };
}

export type Fin = ReturnType<typeof creerFin>;
