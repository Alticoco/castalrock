// Sons qui suivent l'état du jeu à chaque image : pas du joueur (selon le sol), atterrissage, plongeon,
// cris des créatures (au calme de temps en temps, quand elles repèrent le joueur, quand elles attaquent ou détalent)
// et musique de l'auberge. Les sons d'événements (coups d'outil, coups d'épée, blessures) sont joués là où ils arrivent
// (recolte.ts, combat.ts, mouvement.ts).
import { CONFIG } from '../config';
import { decrireVillage, pointLocal } from '../regles/village';
import { vitesseHorizontale } from '../regles/deplacement';
import { bruitsDePas } from '../moteur/reglages';
import type { PhaseEnnemi } from '../regles/combat';
import { SON_DE_COURSE, SON_DU_SOL, delaiAppel, estAuCalme, momentDuChangement, pasFranchi, solSousLesPieds, sonCreature, type MomentCreature } from '../son/choix';
import type { MoteurSon } from '../son/moteurSon';
import type { Contexte } from './contexte';
import type { EnnemiPresent, EtatJeu } from './partie';

/** Cri d'une créature à ce moment (s'il y en a un), venu de sa tête. Sert aussi au combat (douleur, mort). */
export function crierCreature(sons: MoteurSon, present: EnnemiPresent, moment: MomentCreature): void {
  const son = sonCreature(present.etat.type, moment);
  if (!son) return;
  const e = present.etat;
  sons.jouer(son.nom, { position: { x: e.x, y: e.y + present.modele.hauteur * 0.7, z: e.z }, hauteur: son.hauteur, volume: son.volume });
}

interface SuiviCreature {
  phase: PhaseEnnemi;
  /** Secondes avant son prochain cri au calme */
  appel: number;
}

export function creerSons(jeu: EtatJeu, ctx: Contexte) {
  const { sons, personnage, terrain, mine, maison } = ctx;
  const C = CONFIG.sons;

  // --- Pas du joueur ---
  let phaseAvant = personnage.phaseMarche;
  let auSolAvant = jeu.etat.auSol;
  let nageAvant = jeu.etat.nage;
  let vitesseVerticaleAvant = 0;

  function jouerPas(volume: number, hauteur = 1, course = false): void {
    const { x, y, z } = jeu.etat;
    const sol = solSousLesPieds({
      dansMaison: maison.dedans,
      dansMine: mine.dedans,
      piedsDansEau: y < terrain.niveauEau,
      dansVillage: Math.hypot(x, z) < CONFIG.monde.village.rayon,
      biome: terrain.biomeDominant(x, z).id,
    });
    sons.jouer((course ? SON_DE_COURSE : SON_DU_SOL)[sol], { volume, hauteur });
  }

  function mettreAJourPas(): void {
    const { etat } = jeu;
    const phase = personnage.phaseMarche;
    const intensite = personnage.intensiteMarche;
    // Pas coupés dans le menu pause : ni pas, ni atterrissage
    const pasActifs = bruitsDePas();
    // Un pied touche le sol : seulement en marchant pour de vrai (ni en l'air, ni à la nage, ni en escalade).
    // En courant : d'autres pas, plus légers et un peu moins forts (ils sont plus rapprochés)
    if (pasActifs && !jeu.visite && etat.auSol && !etat.nage && !etat.grimpe && intensite >= C.intensitePasMin && pasFranchi(phaseAvant, phase)) {
      const P = CONFIG.personnage;
      const course = vitesseHorizontale(etat) > (P.vitesseMarche + P.vitesseCourse) / 2;
      if (course) jouerPas(C.volumePasCourse, C.hauteurPasCourse, true);
      else jouerPas(C.volumePasMarche);
    }
    // Retour au sol après une vraie chute : un pas plus lourd et plus grave
    if (pasActifs && etat.auSol && !auSolAvant && !etat.nage && vitesseVerticaleAvant < -C.vitesseAtterrissage) jouerPas(1.6, 0.85);
    // Entrée dans l'eau profonde : un plouf
    if (etat.nage && !nageAvant) sons.jouer('pas-mouille', { volume: 2, hauteur: 0.7 });
    phaseAvant = phase;
    auSolAvant = etat.auSol;
    nageAvant = etat.nage;
    vitesseVerticaleAvant = etat.vy;
  }

  // --- Créatures ---
  const suivis = new Map<string, SuiviCreature>();

  const crier = (present: EnnemiPresent, moment: MomentCreature) => crierCreature(sons, present, moment);

  function mettreAJourCreatures(dt: number): void {
    for (const [id, present] of jeu.ennemis) {
      const e = present.etat;
      let suivi = suivis.get(id);
      if (!suivi) {
        // Première fois vue : pas de cri tout de suite, chacune son rythme
        suivi = { phase: e.phase, appel: delaiAppel(Math.random) };
        suivis.set(id, suivi);
      }
      const moment = momentDuChangement(suivi.phase, e.phase);
      if (moment) crier(present, moment);
      suivi.phase = e.phase;
      // Au calme : un cri de temps en temps, seulement si le joueur est assez près pour l'entendre
      if (estAuCalme(e.phase)) {
        suivi.appel -= dt;
        if (suivi.appel <= 0) {
          suivi.appel = delaiAppel(Math.random);
          if (Math.hypot(e.x - jeu.etat.x, e.z - jeu.etat.z) < C.appels.distance) crier(present, 'appel');
        }
      }
    }
    // Créatures disparues (tuées, trop loin) : on les oublie
    for (const id of suivis.keys()) if (!jeu.ennemis.has(id)) suivis.delete(id);
  }

  // --- Musique de l'auberge ---
  let niveauMusique = -1;
  let auberge: { x: number; y: number; z: number } | null = null;

  function mettreAJourMusique(): void {
    if (jeu.niveauVillage !== niveauMusique) {
      // Le village a changé (amélioration, F6) : l'auberge est peut-être apparue
      niveauMusique = jeu.niveauVillage;
      const el = decrireVillage(jeu.niveauVillage).elements.find((e) => e.type === 'auberge');
      const centre = el ? pointLocal(el, 0, 0) : null;
      auberge = centre ? { x: centre.x, y: terrain.altitudeVillage + C.musiqueAuberge.hauteur, z: centre.z } : null;
      if (auberge) sons.musiqueAuberge.placer(auberge);
    }
    const proche =
      auberge !== null &&
      !mine.dedans &&
      Math.hypot(auberge.x - jeu.etat.x, auberge.z - jeu.etat.z) < C.musiqueAuberge.distanceMax + 5;
    sons.musiqueAuberge.definirActive(proche);
  }

  /** `fige` : un écran est ouvert (inventaire, dialogue…) : les créatures sont figées, elles se taisent. */
  function mettreAJour(dt: number, fige: boolean): void {
    mettreAJourPas();
    if (!fige) mettreAJourCreatures(dt);
    mettreAJourMusique();
  }

  return { mettreAJour };
}
