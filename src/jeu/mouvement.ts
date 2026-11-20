// Mouvement du personnage : frappe, déplacement, caméras, bras et impact des coups (y compris ceux du pilote).
import { cabaneAldric } from '../regles/habitants';
import * as THREE from 'three';
import { CONFIG } from '../config';
import { emettreFrappe, surFrappe } from '../moteur/signalFrappe';
import { pasDeDeplacement, vitesseHorizontale, type MondeDeplacement } from '../regles/deplacement';
import { creerEtatCharge, pasDeCharge, pasDeFrappe, progressionCharge } from '../regles/frappe';
import { pasDeGarde, peutLeverBouclier } from '../regles/bouclier';
import { aLeNoeud, facteurVitesseFrappe } from '../regles/progression';
import { ajouterPointSur } from '../regles/pointSur';
import { estOutil } from '../regles/barreOutils';
import type { OrdrePilote } from '../regles/pilote';
import type { ArcJeu } from './arc';
import { RAYON_OBSTACLES, type Contexte } from './contexte';
import type { EtatJeu } from './partie';
import type { Combat } from './combat';
import type { Campement } from './campement';
import type { Recolte } from './recolte';

// Distance caméra–yeux sous laquelle le corps est caché et les bras affichés (1re personne)
const DISTANCE_BRAS = 0.9;

export interface DependancesMouvement {
  arc: ArcJeu;
  combat: Combat;
  campement: Campement;
  recolte: Recolte;
}

export function creerMouvement(jeu: EtatJeu, ctx: Contexte, dep: DependancesMouvement) {
  const { decor, mine, entrees, vues, personnage, bras, masquage, aideTouches } = ctx;
  const origineFrappe = new THREE.Vector3();
  const directionFrappe = new THREE.Vector3();

  // Ce que les règles de déplacement voient du monde (obstacles : mis à jour à chaque image)
  const monde: MondeDeplacement = {
    hauteur: (x, z) => ctx.terrain.hauteur(x, z),
    niveauEau: ctx.terrain.niveauEau,
    obstacles: [],
  };
  // Escalade : avancement du geste des mains (radians, un tour = un cycle des deux mains), au rythme de la montée
  let phaseEscalade = 0;

  // À chaque impact : coup sur l'élément visé, puis destruction et butin s'il n'a plus de points
  surFrappe((origine, direction) => {
    // Un ennemi à portée passe avant la récolte : l'épée le touche
    if (dep.combat.frapperEnnemiVise()) return;
    const cible = dep.recolte.elementAPortee(origine as THREE.Vector3, direction as THREE.Vector3);
    if (!cible) {
      // Coup dans le vide : juste le souffle de l'outil
      ctx.sons.jouer('souffle');
      return;
    }
    dep.recolte.frapperElementVise(cible);
  });

  /** Toutes les secondes, au sol sur une pente franchissable, hors eau, mine et maison : note un point sûr. */
  function noterPointSur(dt: number): void {
    const P = CONFIG.personnage.pointSur;
    jeu.tempsPointSur -= dt;
    if (jeu.tempsPointSur > 0) return;
    const { x, y, z, auSol, nage, glisse } = jeu.etat;
    if (!auSol || nage || glisse || mine.contient(x, z)) return;
    if (y < ctx.terrain.niveauEau || ctx.terrain.pente(x, z) * 90 > CONFIG.personnage.penteMaxDegres) return;
    jeu.tempsPointSur = P.intervalle;
    jeu.pointsSurs = ajouterPointSur(jeu.pointsSurs, { x, y, z }, P.taille);
  }

  /**
   * Règles : frappe puis déplacement (le personnage ne reçoit aucune commande en caméra libre), puis caméra,
   * corps et bras. `ordrePilote` : ordre du pilote automatique pour cette image, ou null.
   */
  function mettreAJour(dt: number, commande: boolean, axes: { avant: number; cote: number }, ordrePilote: OrdrePilote | null): void {
    const direction = ordrePilote ? { x: ordrePilote.x, z: ordrePilote.z } : vues.directionDeplacement(axes.avant, axes.cote);
    aideTouches.mettreAJour(dt, axes.avant !== 0 || axes.cote !== 0);
    // Le pilote frappe 10 % moins vite (sauf Pilote expert) ; Enchaînement : les gestes du joueur vont plus vite
    const lenteurPilote = aLeNoeud(jeu.progression, 'pilote-expert') ? 1 : CONFIG.pilote.facteurLenteur;
    // Escalade en cours (image précédente) : les deux mains sont prises, ni frappe, ni charge, ni bouclier
    const enEscalade = jeu.etat.grimpe;
    // Bouclier : clic droit maintenu avec l'épée en main (et le nœud Parade). Tant qu'il est levé, on ne frappe pas.
    const peutParer = !ordrePilote && commande && !jeu.etat.nage && !enEscalade && peutLeverBouclier(jeu.emplacement, jeu.equipement.bouclier, jeu.progression.noeuds);
    jeu.garde = pasDeGarde(jeu.garde, peutParer && entrees.clicDroitMaintenu, dt);
    const bouclierLeve = jeu.garde.leve;
    // Pousses d'arbre en main : le clic gauche plante (voir commandes.ts) au lieu de balancer l'outil ; la torche ne frappe pas
    let clicFrappe = ordrePilote
      ? ordrePilote.frapper && !jeu.etat.nage
      : commande && entrees.clicGauche && estOutil(jeu.emplacement) && !jeu.etat.nage && !bouclierLeve && !enEscalade;
    // Coup puissant (épée seulement, avec le nœud) : le coup part au relâchement du clic, normal si le clic a été
    // court, puissant s'il a duré 1 s. La hache et la pioche gardent le clic maintenu qui répète.
    const avecCharge = !ordrePilote && commande && jeu.emplacement === 'epee' && !jeu.etat.nage && !bouclierLeve && !enEscalade && aLeNoeud(jeu.progression, 'coup-puissant');
    if (avecCharge) {
      const maintenu = jeu.frappe.progression < 0 && (entrees.clicGauche || entrees.clicGaucheDebut);
      const charge = pasDeCharge(jeu.charge, maintenu, dt);
      jeu.charge = charge.etat;
      clicFrappe = charge.fin !== 'aucune';
      if (charge.fin === 'puissante') jeu.coupPuissant = true;
    } else if (jeu.charge.temps >= 0) {
      // Bouclier levé, autre outil, écran ouvert : la charge en cours est abandonnée sans coup
      jeu.charge = creerEtatCharge();
    }
    const resultat = pasDeFrappe(jeu.frappe, clicFrappe, ordrePilote ? dt * lenteurPilote : dt * facteurVitesseFrappe(jeu.progression));
    jeu.frappe = resultat.etat;
    if (jeu.frappe.progression < 0) jeu.coupPuissant = false;
    personnage.definirGarde(bouclierLeve);
    bras.definirGarde(bouclierLeve);
    bras.definirCharge(progressionCharge(jeu.charge));
    const enFrappe = jeu.frappe.progression >= 0;
    // Obstacles : décor proche, et murs et objets du village quand on est dedans
    const dansLeVillage = Math.hypot(jeu.etat.x, jeu.etat.z) < CONFIG.monde.village.rayon + 5;
    const obstaclesDecor = decor.obstaclesAutour(jeu.etat.x, jeu.etat.z, RAYON_OBSTACLES);
    if (jeu.feuCamp) obstaclesDecor.push({ x: jeu.feuCamp.x, z: jeu.feuCamp.z, rayon: CONFIG.campement.rayonObstacleFeu });
    // Lieux de l'histoire : palissade et tentes du camp, menhirs de l'autel
    obstaclesDecor.push(...ctx.obstaclesLieux(jeu.etat.x, jeu.etat.z, RAYON_OBSTACLES));
    // Ruines et petites grottes : murs, colonnes, parois, coffres
    if (!mine.contient(jeu.etat.x, jeu.etat.z)) obstaclesDecor.push(...ctx.ruines.obstaclesAutour(jeu.etat.x, jeu.etat.z, RAYON_OBSTACLES));
    const obstaclesMine = mine.obstacles(jeu.etat.x, jeu.etat.z);
    monde.obstacles = dansLeVillage
      ? [...obstaclesDecor, ...jeu.obstaclesDuVillage.cercles]
      : [...obstaclesDecor, ...obstaclesMine.cercles];
    // Dehors, loin du village : la cabane d'Aldric est un mur
    const cabane = cabaneAldric().obstacle;
    const pres = Math.hypot(jeu.etat.x - cabane.x, jeu.etat.z - cabane.z) < 15;
    monde.rectangles = dansLeVillage ? jeu.obstaclesDuVillage.rectangles : pres ? [...(obstaclesMine.rectangles ?? []), cabane] : obstaclesMine.rectangles;
    const avantLePas = jeu.etat;
    jeu.etat = pasDeDeplacement(
      jeu.etat,
      {
        x: direction.x,
        z: direction.z,
        courir: commande && entrees.courir && !dep.arc.enTension(),
        sauter: commande && entrees.sauter,
        // Escalade : Espace maintenu face à une paroi ; ni le pilote, ni dans la mine ou la maison (l'eau : voir les règles)
        grimper: commande && !ordrePilote && entrees.sauter && !mine.contient(jeu.etat.x, jeu.etat.z),
        facteurVitesse: bouclierLeve ? CONFIG.bouclier.facteurVitesse : dep.arc.enTension() ? CONFIG.arc.facteurVitesse : 1,
        // En 1re personne le corps suit le regard ; sinon il ne vise que pendant une frappe
        orientationVisee: ordrePilote
          ? ordrePilote.orientation
          : commande && (vues.vue === 'premiere' || enFrappe)
            ? vues.lacetVisee
            : undefined,
      },
      dt,
      monde,
    );
    // Escalade : les mains avancent avec la distance parcourue sur la paroi (et reviennent en arrière à la descente)
    if (jeu.etat.grimpe && avantLePas.grimpe) {
      const dy = jeu.etat.y - avantLePas.y;
      const parcouru = Math.hypot(jeu.etat.x - avantLePas.x, dy, jeu.etat.z - avantLePas.z);
      phaseEscalade += ((dy < 0 ? -1 : 1) * parcouru * 2 * Math.PI) / CONFIG.personnage.escalade.hauteurParPrise;
    }
    bras.definirEscalade(jeu.etat.grimpe, phaseEscalade);
    noterPointSur(dt);

    // Le tremblement de l'image précédente est retiré avant que la caméra ne soit replacée
    dep.combat.retirerTremblement();

    const { etat, frappe, visite } = jeu;
    personnage.mettreAJour(dt, {
      x: etat.x,
      y: etat.y,
      z: etat.z,
      orientation: etat.orientation,
      vitesse: vitesseHorizontale(etat),
      auSol: etat.auSol,
      nage: etat.nage,
      progressionFrappe: frappe.progression,
      grimpe: etat.grimpe,
      phaseEscalade,
    });

    if (visite) {
      visite.mettreAJour(dt);
      personnage.definirOmbreSeule(false);
      bras.objet.visible = false;
      masquage.mettreAJour(dt, false, etat);
    } else {
      vues.mettreAJour(dt, etat, {
        dx: entrees.dx,
        dy: entrees.dy,
        phaseMarche: personnage.phaseMarche,
        intensiteMarche: personnage.intensiteMarche,
      });
      // 1re personne : le corps disparaît (son ombre reste) et les bras apparaissent,
      // seulement une fois la caméra arrivée près des yeux
      const dansLaTete = vues.vue === 'premiere' && vues.distanceYeux < DISTANCE_BRAS;
      personnage.definirOmbreSeule(dansLaTete);
      bras.objet.visible = dansLaTete;
      bras.mettreAJour(dt, personnage.phaseMarche, personnage.intensiteMarche, frappe.progression);
      masquage.mettreAJour(dt, vues.vue !== 'premiere', etat);

      dep.combat.appliquerTremblement(dt);

      if (resultat.impact) {
        if (ordrePilote && jeu.pilote?.cible) {
          dep.campement.frapperPourPilote(jeu.pilote.cible);
        } else {
          origineFrappe.copy(vues.rayonVisee.origine);
          directionFrappe.copy(vues.rayonVisee.direction);
          emettreFrappe(origineFrappe, directionFrappe);
        }
      }
    }
  }

  return { mettreAJour };
}

export type Mouvement = ReturnType<typeof creerMouvement>;
