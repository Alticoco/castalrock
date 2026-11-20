// Mini-carte : branche l'écran src/ui/miniCarte.ts sur la partie (position et regard du joueur, repères,
// terrain ou plan de la mine) et gère la touche M (carte agrandie). En AZERTY, la touche marquée M
// a le code physique « Semicolon ». Les actions sur les repères du joueur (poser, retirer, suivre) passent par
// src/regles/reperes.ts, appelé d'ici. Échap ferme aussi la carte (voir commandes.ts).
import { CONFIG } from '../config';
import { CAP_NORD } from '../regles/miniCarte';
import { estAnimal } from '../regles/animaux';
import { aLeNoeud } from '../regles/competences';
import { MESSAGE_REPERES_PLEIN, poserRepere, retirerRepere, suivre } from '../regles/reperes';
import { contientZoneMine } from '../mine/plan';
import { miniCarteTourne, miniCarteVisible, tailleMiniCarte } from '../moteur/reglages';
import type { Repere } from '../ui/miniCarte';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

/** Distance (m) à laquelle l'entrée de la mine, pas encore visitée, apparaît sur la carte : on voit sa lanterne */
const DISTANCE_VUE_MINE = 60;

interface Dependances {
  /** Lieux de l'histoire déjà découverts (camp des bandits, autel du Cœur) */
  reperesLieux(): Repere[];
  /** Vrai si un écran (inventaire, fabrication, quêtes...) est ouvert : la carte agrandie se ferme et M ne fait rien */
  ecranOuvert(): boolean;
}

export function creerMiniCarteJeu(jeu: EtatJeu, ctx: Contexte, dep: Dependances) {
  const { miniCarte, mine, maison, planMine, entrees, vues, invite } = ctx;

  // Poser, retirer et suivre : seule la carte agrandie les demande, et jamais dans la mine ni dans la maison pour la pose
  miniCarte.brancher({
    poser(type, x, z) {
      if (mine.dedans || maison.dedans) return;
      const r = poserRepere(jeu.reperes, type, x, z);
      if (r.ok) jeu.reperes = r.etat;
      else invite.annoncer(MESSAGE_REPERES_PLEIN);
    },
    retirer(id) {
      jeu.reperes = retirerRepere(jeu.reperes, id);
    },
    suivre(cible) {
      jeu.reperes = suivre(jeu.reperes, cible);
    },
  });

  let grandePrecedente = false;

  /** À appeler à chaque image : touche M, puis dessin de la carte. */
  function mettreAJour(): void {
    const ecran = dep.ecranOuvert();
    if (ecran) miniCarte.definirGrande(false);
    else if (entrees.vientDAppuyer('Semicolon')) miniCarte.definirGrande(!miniCarte.grande);
    // Carte ouverte : le pointeur est libéré pour cliquer dessus, et rendu à la fermeture (sauf si un écran prend le relais)
    if (miniCarte.grande !== grandePrecedente) {
      grandePrecedente = miniCarte.grande;
      if (grandePrecedente) entrees.definirVerrouillage(false);
      else if (!ecran) {
        entrees.definirVerrouillage(!jeu.visite);
        entrees.verrouiller();
        // Fermée avec Échap, le navigateur refuse de reverrouiller la souris (Échap n'est pas un « geste » du joueur) :
        // on le dit, un clic suffit à reprendre la main
        window.setTimeout(() => {
          if (!document.pointerLockElement && !miniCarte.grande && !dep.ecranOuvert() && !jeu.visite) invite.annoncer('Clic pour reprendre la main');
        }, 250);
      }
    }
    miniCarte.definirVisible(miniCarteVisible());
    miniCarte.definirTaille(tailleMiniCarte());

    const { etat } = jeu;
    const lacet = vues.lacetVisee ?? etat.orientation;
    const reperes: Repere[] = [];
    const baluchon = jeu.baluchon;
    if (maison.dedans) {
      // Dans la maison : fond uni (aucun terrain à montrer) et la porte comme sortie
      reperes.push({ type: 'sortie', x: maison.plan.porte.x, z: maison.plan.porte.z });
    } else if (mine.dedans) {
      reperes.push({ type: 'sortie', x: planMine.sortie.x, z: planMine.sortie.z });
      if (baluchon && contientZoneMine(baluchon.x, baluchon.z)) reperes.push({ type: 'baluchon', x: baluchon.x, z: baluchon.z });
    } else {
      reperes.push({ type: 'village', x: 0, z: 0 });
      // La mine n'apparaît qu'une fois trouvée (déjà visitée, ou entrée en vue) : plus de guidage vers les quêtes
      if (jeu.mineVisitee || Math.hypot(mine.portail.x - etat.x, mine.portail.z - etat.z) <= DISTANCE_VUE_MINE) {
        reperes.push({ type: 'mine', x: mine.portail.x, z: mine.portail.z });
      }
      reperes.push(...dep.reperesLieux());
      if (jeu.feuCamp) reperes.push({ type: 'feu', x: jeu.feuCamp.x, z: jeu.feuCamp.z });
      if (baluchon && !contientZoneMine(baluchon.x, baluchon.z)) reperes.push({ type: 'baluchon', x: baluchon.x, z: baluchon.z });
      // Pisteur : les animaux proches, en petits points
      if (aLeNoeud(jeu.progression, 'pisteur')) {
        const portee = CONFIG.progression.arbre.pisteur;
        for (const { etat: e } of jeu.ennemis.values()) {
          if (estAnimal(e.type) && e.phase !== 'mort' && Math.hypot(e.x - etat.x, e.z - etat.z) <= portee) reperes.push({ type: 'animal', x: e.x, z: e.z });
        }
      }
    }
    miniCarte.dessiner({
      fond: mine.dedans || maison.dedans ? 'mine' : 'monde',
      x: etat.x,
      z: etat.z,
      lacet,
      cap: miniCarteTourne() ? lacet : CAP_NORD,
      reperes,
      reperesJoueur: jeu.reperes.liste,
      suivi: jeu.reperes.suivi,
      posable: !mine.dedans && !maison.dedans,
      titre: maison.dedans ? 'Maison' : undefined,
    });
  }

  return { mettreAJour };
}
