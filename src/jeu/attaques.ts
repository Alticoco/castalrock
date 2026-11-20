// Attaques de bandits sur le village (règles : src/regles/attaques.ts) : départ au crépuscule certains soirs à partir de
// l'acte II, bandits d'attaque (créés par le combat, marqués par leur identifiant `attaque:...`), habitants qui rentrent
// chez eux, ligne « Défends le village », victoire (or et XP) ou pillage du coffre. L'attaque en cours n'est pas
// sauvegardée : seul le dernier jour traité l'est (`jeu.attaques`).
import { CONFIG } from '../config';
import {
  MESSAGE_CLOCHE,
  MESSAGE_VICTOIRE,
  aArrive,
  attaqueRepoussee,
  attaquePrevue,
  histoireAtteintActeII,
  issueAttaque,
  messagePillage,
  objectifDefense,
  pillage,
  positionsBandits,
  recompenseDefense,
  tirerAttaque,
  PREFIXE_BANDIT_ATTAQUE,
} from '../regles/attaques';
import { ajouter } from '../regles/inventaire';
import { jourCalendaire } from '../regles/marchand';
import { heureDuJeu } from '../regles/temps';
import { creerObjectifHistoire } from '../ui/objectifHistoire';
import type { EtatEnnemi } from '../regles/combat';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

// Ligne « Défends le village » : sous celle de l'objectif d'histoire, en pixels depuis le haut de l'écran
const HAUT_LIGNE_DEFENSE = 94;
// Recherche d'un point d'apparition hors de l'eau : pas de rotation (radians) et nombre d'essais
const PAS_ROTATION = 0.4;
const ESSAIS_TERRE = 16;
// Un bandit apparaît seulement sur un sol au moins aussi haut que l'eau plus cette marge, en mètres
const MARGE_EAU = 0.3;

export interface DependancesAttaques {
  /** Fait apparaître un bandit d'attaque (combat) */
  ajouterBanditAttaque: (id: string, x: number, z: number) => void;
  /** Retire un ennemi du monde (combat) */
  retirerEnnemi: (id: string) => void;
  donnerXp: (quantite: number) => void;
  rafraichirInventaire: () => void;
}

interface AttaqueEnCours {
  jour: number;
  ids: string[];
  /** Secondes pendant lesquelles au moins un bandit est arrivé au bord du village */
  tempsArrives: number;
  /** Dernier nombre de bandits en vie annoncé */
  restants: number;
}

export function creerAttaques(jeu: EtatJeu, ctx: Contexte, dep: DependancesAttaques) {
  const { terrain, invite, compteur, effetsCombat } = ctx;
  const ligne = creerObjectifHistoire(ctx.ui, HAUT_LIGNE_DEFENSE);

  let attaque: AttaqueEnCours | null = null;
  // Numéro de l'attaque lancée depuis le démarrage : deux attaques le même jour n'ont jamais les mêmes identifiants
  let compteurAttaques = 0;
  // Jour de l'arrivée à l'acte II vue pendant cette session (jamais d'attaque ce jour-là). Inconnu si l'acte II était déjà
  // atteint au chargement : l'attaque est alors permise tout de suite.
  let jourActeII: number | null = null;
  let acteIIAtteint = histoireAtteintActeII(jeu.histoire);
  // Dernier jour dont le tirage a déjà été fait (pour ne pas le refaire à chaque image)
  let jourVerifie = Number.NEGATIVE_INFINITY;

  const heure = () => heureDuJeu(jeu.tempsJeu, CONFIG.temps);

  /** Bandits d'attaque encore debout, tels que le combat les tient. */
  function vivants(a: AttaqueEnCours): EtatEnnemi[] {
    const liste: EtatEnnemi[] = [];
    for (const id of a.ids) {
      const etat = jeu.ennemis.get(id)?.etat;
      if (etat && etat.phase !== 'mort') liste.push(etat);
    }
    return liste;
  }

  /** Direction d'arrivée tournée jusqu'à ce que le point d'apparition soit à sec (le tirage donne la première). */
  function angleSurTerre(angle: number): number {
    const D = CONFIG.attaques.distanceApparition;
    for (let i = 0; i < ESSAIS_TERRE; i++) {
      const a = angle + i * PAS_ROTATION;
      if (terrain.hauteur(Math.sin(a) * D, Math.cos(a) * D) >= terrain.niveauEau + MARGE_EAU) return a;
    }
    return angle;
  }

  function demarrer(jour: number): void {
    const tirage = tirerAttaque(jour, CONFIG.graine);
    compteurAttaques += 1;
    const ids = positionsBandits(angleSurTerre(tirage.angle), tirage.nombre).map((p, i) => {
      const id = `${PREFIXE_BANDIT_ATTAQUE}${jour}:${compteurAttaques}:${i}`;
      dep.ajouterBanditAttaque(id, p.x, p.z);
      return id;
    });
    attaque = { jour, ids, tempsArrives: 0, restants: ids.length };
    invite.annoncer(MESSAGE_CLOCHE);
    ligne.afficher(objectifDefense(ids.length));
  }

  /** Fin de l'attaque : la ligne disparaît, les bandits qui restent (en vie) repartent dans un nuage de fumée. */
  function terminer(retirerSurvivants: boolean): void {
    if (!attaque) return;
    if (retirerSurvivants) {
      for (const id of attaque.ids) {
        const present = jeu.ennemis.get(id);
        if (!present) continue;
        effetsCombat.fumee(present.etat.x, present.etat.y, present.etat.z);
        dep.retirerEnnemi(id);
      }
    }
    attaque = null;
    ligne.afficher(null);
  }

  function victoire(a: AttaqueEnCours): void {
    const r = recompenseDefense(a.ids.length);
    dep.donnerXp(r.xp);
    // Or : inventaire porté, puis sac magique
    const porte = ajouter(jeu.inventaire, 'or', r.or);
    const range = ajouter(jeu.sac, 'or', porte.reste);
    jeu.inventaire = porte.conteneur;
    jeu.sac = range.conteneur;
    dep.rafraichirInventaire();
    compteur.annoncerObjets({ or: r.or });
    invite.annoncer(MESSAGE_VICTOIRE);
    terminer(false);
  }

  function piller(a: AttaqueEnCours): void {
    const r = pillage(jeu.coffre, CONFIG.graine, a.jour);
    jeu.coffre = r.coffre;
    dep.rafraichirInventaire();
    invite.annoncer(messagePillage(r.pris));
    terminer(true);
  }

  /** Départ de la soirée : tirage du jour (une fois), puis attaque si le joueur n'est ni dans la mine ni dans sa maison. */
  function verifierDepart(): void {
    const jour = jourCalendaire(jeu.tempsJeu);
    if (jour === jourVerifie) return;
    const h = heure();
    if (h < CONFIG.attaques.heureDepart || h >= CONFIG.attaques.heureLimiteDepart) return;
    // Près du camp des bandits, Morvan en vie : l'attaque attend (le tirage sera refait à l'image suivante)
    const camp = ctx.lieux.camp;
    if (attaqueRepoussee(Math.hypot(jeu.etat.x - camp.x, jeu.etat.z - camp.z), jeu.lieux.morvanVaincu)) return;
    jourVerifie = jour;
    if (!acteIIAtteint || !attaquePrevue(jour, CONFIG.graine, jeu.attaques.dernierJour, jourActeII)) return;
    // Le jour est traité, que l'attaque ait lieu ou non : pas d'attaque le soir suivant
    jeu.attaques = { dernierJour: jour };
    // Dans la mine (la maison compte comme la mine) : l'attaque de ce soir n'a pas lieu
    if (ctx.mine.contient(jeu.etat.x, jeu.etat.z)) return;
    demarrer(jour);
  }

  /** À chaque image. `fige` : un écran est ouvert, le temps passé au bord du village ne compte plus. */
  function mettreAJour(dt: number, fige: boolean): void {
    if (!acteIIAtteint && histoireAtteintActeII(jeu.histoire)) {
      acteIIAtteint = true;
      jourActeII = jourCalendaire(jeu.tempsJeu);
    }
    if (!attaque) {
      verifierDepart();
      return;
    }
    const restants = vivants(attaque);
    if (restants.length !== attaque.restants) {
      attaque.restants = restants.length;
      if (restants.length > 0) {
        ligne.afficher(objectifDefense(restants.length));
        compteur.annoncerMessage(objectifDefense(restants.length));
      }
    }
    const arrives = restants.filter((e) => aArrive(e.x, e.z)).length;
    if (!fige) attaque.tempsArrives = arrives > 0 ? attaque.tempsArrives + dt : 0;
    const issue = issueAttaque({
      vivants: restants.length,
      arrives,
      tempsArrives: attaque.tempsArrives,
      jourAttaque: attaque.jour,
      jour: jourCalendaire(jeu.tempsJeu),
    });
    if (issue === 'victoire') victoire(attaque);
    else if (issue === 'pillage') piller(attaque);
  }

  /** Une attaque est-elle en cours ? (les habitants rentrent chez eux) */
  function enCours(): boolean {
    return attaque !== null;
  }

  /** Cible de la boussole pendant l'attaque : le bandit le plus proche, sinon `null`. */
  function cibleBoussole(): { x: number; z: number; nom: string } | null {
    if (!attaque) return null;
    let meilleur: { x: number; z: number; nom: string } | null = null;
    let distance = Infinity;
    for (const e of vivants(attaque)) {
      const d = Math.hypot(e.x - jeu.etat.x, e.z - jeu.etat.z);
      if (d < distance) {
        distance = d;
        meilleur = { x: e.x, z: e.z, nom: 'Bandit' };
      }
    }
    return meilleur;
  }

  /** F7 (outil de test) : lance une attaque tout de suite, sans toucher au jour traité ni exiger l'acte II. */
  function declencher(): void {
    if (attaque) {
      invite.annoncer('Une attaque est déjà en cours (test)');
      return;
    }
    demarrer(jourCalendaire(jeu.tempsJeu));
  }

  return { mettreAJour, enCours, cibleBoussole, declencher };
}

export type Attaques = ReturnType<typeof creerAttaques>;
