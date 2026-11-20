// Habitants : leur routine à chaque image (src/regles/habitants.ts), leurs modèles, les cercles d'obstacle qu'ils
// forment pour le joueur, l'interaction E (le dialogue, voir src/jeu/dialogue.ts) et le repère « ! » / « ? » au-dessus de leur tête.
// Rien n'est sauvegardé : au lancement et à chaque changement de niveau du village, chacun est replacé selon l'heure.
import { CONFIG } from '../config';
import type { ObstacleCercle } from '../regles/deplacement';
import {
  HABITANTS,
  NOMS_HABITANTS,
  cabaneAldric,
  campementAldric,
  creerEtatsHabitants,
  obstaclesSansForgeron,
  pasHabitant,
  portesVillage,
  rayonObstacleHabitant,
  tournerVers,
  type EtatHabitant,
  type IdHabitant,
  type Point,
} from '../regles/habitants';
import { marqueurHabitant, type MarqueurHabitant } from '../regles/dialogues';
import { maisonsEndommagees } from '../regles/reconstruction';
import { ciblesParler, etapesTerminees } from '../regles/histoire';
import { heureDuJeu } from '../regles/temps';
import { decrireVillage, interactionVisee, type NiveauVillage, type ObstaclesVillage, type PointInteraction } from '../regles/village';
import { creerCabaneAldric } from '../scene/modelesFerme';
import { creerRepere } from '../scene/reperesHabitants';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

// Au-delà de cette distance de la caméra, un habitant n'est ni dessiné ni animé, en mètres
const DISTANCE_AFFICHAGE = 160;
// Bertil ouvre la forge tant qu'il est à moins de cette distance d'elle ; ailleurs, il salue comme les autres
const DISTANCE_FORGE = 6;
// Un cercle d'obstacle « absent » est rangé très loin (un rayon nul arrêterait encore le joueur)
const LOIN = 1e7;

export interface DependancesHabitants {
  /** E devant un habitant : ouvre le dialogue */
  parler: (id: IdHabitant) => void;
  /** Cercles d'obstacle d'autres personnages de la place (le marchand), ajoutés à ceux du village et des habitants */
  cerclesSupplementaires?: ObstacleCercle[];
  /** Une attaque de bandits est en cours : chacun rentre chez lui, comme la nuit */
  attaqueEnCours?: () => boolean;
}

export function creerHabitants(jeu: EtatJeu, ctx: Contexte, dep: DependancesHabitants) {
  const { scene, camera, terrain, mine, vues, habitants: rendu } = ctx;
  const R = CONFIG.habitants;
  const demiAngleRegard = (CONFIG.village.angleRegardDegres * Math.PI) / 180;

  // Le campement d'Aldric, dans la forêt : posé une fois pour toutes
  const camp = campementAldric();
  rendu.campement.feu.position.set(camp.feu.x, terrain.hauteur(camp.feu.x, camp.feu.z), camp.feu.z);
  rendu.campement.rocher.position.set(camp.rocher.x, terrain.hauteur(camp.rocher.x, camp.rocher.z), camp.rocher.z);
  scene.add(rendu.campement.feu, rendu.campement.rocher);
  // Sa cabane, porte tournée vers le feu (modèle : src/scene/modelesFerme.ts ; obstacle : cabaneAldric)
  const cabane = cabaneAldric();
  const modeleCabane = creerCabaneAldric();
  modeleCabane.position.set(cabane.x, terrain.hauteur(cabane.x, cabane.z), cabane.z);
  modeleCabane.rotation.y = cabane.orientation;
  scene.add(modeleCabane);
  for (const modele of Object.values(rendu.modeles)) {
    modele.objet.visible = false;
    scene.add(modele.objet);
  }
  // Repère au-dessus de la tête de chacun (« ! » quête à proposer, « ? » quête à rendre)
  const reperes = new Map<IdHabitant, { repere: ReturnType<typeof creerRepere>; etat: MarqueurHabitant }>();
  for (const id of HABITANTS) {
    const repere = creerRepere();
    rendu.modeles[id].objet.add(repere.objet);
    reperes.set(id, { repere, etat: 'aucun' });
  }
  let tempsRepere = 0;
  // Dernières données dont dépendent les repères : ils ne sont recalculés que quand l'une d'elles change
  let cleRepere: unknown[] = [];
  // Habitant en pleine conversation : il ne bouge plus et reste tourné vers le joueur
  let enDialogue: IdHabitant | null = null;

  let niveau: NiveauVillage | null = null;
  let etats: EtatHabitant[] = [];
  let portes: Point[] = [];
  let forge: Point | null = null;
  // Obstacles du village donnés au déplacement du joueur : ceux des bâtiments, plus un cercle par habitant
  let obstacles: ObstaclesVillage | null = null;
  let cercles: ObstacleCercle[] = [];
  // Points d'interaction du moment, et l'habitant de chacun
  const points: PointInteraction[] = [];
  const idsPoints: IdHabitant[] = [];

  const heure = () => heureDuJeu(jeu.tempsJeu, CONFIG.temps);
  // Maisons endommagées (histoire et quêtes) : leurs habitants dorment à l'auberge ; recalculé quand l'histoire ou les quêtes changent
  let vuHistoire = jeu.histoire;
  let vuQuetes = jeu.quetes;
  let ensembleEndommagees = maisonsEndommagees(jeu.histoire, jeu.quetes);
  function endommagees(): ReadonlySet<string> {
    if (jeu.histoire !== vuHistoire || jeu.quetes !== vuQuetes) {
      vuHistoire = jeu.histoire;
      vuQuetes = jeu.quetes;
      ensembleEndommagees = maisonsEndommagees(jeu.histoire, jeu.quetes);
    }
    return ensembleEndommagees;
  }

  /** Nouveau niveau du village (ou début de partie) : chacun est placé là où l'heure le veut. */
  function replacer(nouveau: NiveauVillage): void {
    niveau = nouveau;
    etats = creerEtatsHabitants(nouveau, heure(), R, endommagees());
    portes = portesVillage(nouveau);
    forge = decrireVillage(nouveau).elements.find((el) => el.type === 'forge') ?? null;
    for (const modele of Object.values(rendu.modeles)) modele.objet.visible = false;
  }

  /** L'habitant qui parle s'arrête (même en marche) et se tourne vers le joueur, tête comprise. */
  function faceAuJoueur(etat: EtatHabitant, joueur: Point, dt: number): EtatHabitant {
    const pas = R.vitesseRotation * dt;
    const cap = Math.atan2(joueur.x - etat.x, joueur.z - etat.z);
    return { ...etat, vitesse: 0, activite: false, versJoueur: true, orientation: tournerVers(etat.orientation, cap, pas), regard: tournerVers(etat.regard, 0, pas) };
  }

  /** Repères « ! » et « ? » (et « ! » doré de l'histoire) : recalculés seulement quand les quêtes, l'histoire, l'inventaire, le coffre ou le village changent. */
  function rafraichirReperes(dt: number): void {
    tempsRepere += dt;
    const cle = [jeu.quetes, jeu.histoire, jeu.inventaire, jeu.coffre, jeu.niveauVillageReel, jeu.progression.noeuds];
    if (cle.some((valeur, i) => valeur !== cleRepere[i])) {
      cleRepere = cle;
      const contexte = { niveauVillage: jeu.niveauVillageReel, noeuds: jeu.progression.noeuds, etapesTerminees: etapesTerminees(jeu.histoire) };
      const histoire = ciblesParler(jeu.histoire);
      for (const [id, r] of reperes) {
        r.etat = histoire.includes(id) ? 'histoire' : marqueurHabitant(id, jeu.quetes, contexte, { inventaire: jeu.inventaire, coffre: jeu.coffre });
        r.repere.definir(r.etat);
      }
    }
    for (const r of reperes.values()) if (r.etat !== 'aucun') r.repere.animer(tempsRepere);
  }

  /** À chaque image : routine, modèles, cercles d'obstacle. */
  function mettreAJour(dt: number): void {
    if (jeu.niveauVillage !== niveau) replacer(jeu.niveauVillage);
    // Le village a refait ses obstacles (changement de niveau) : on y remet les habitants, sans le forgeron fixe
    if (jeu.obstaclesDuVillage !== obstacles) {
      const base = obstaclesSansForgeron(jeu.niveauVillage);
      cercles = etats.map(() => ({ x: LOIN, z: LOIN, rayon: 0 }));
      obstacles = { cercles: [...base.cercles, ...cercles, ...(dep.cerclesSupplementaires ?? [])], rectangles: base.rectangles };
      jeu.obstaclesDuVillage = obstacles;
    }

    // Dans la mine ou dans sa maison, le joueur n'est pas là pour eux
    const joueur = mine.contient(jeu.etat.x, jeu.etat.z) ? null : jeu.etat;
    // Pendant une attaque, la routine de nuit est forcée : tous rentrent chez eux
    const env = { niveau: jeu.niveauVillage, heure: dep.attaqueEnCours?.() ? R.debutNuit : heure(), joueur, endommagees: endommagees() };
    etats = etats.map((etat) => (etat.id === enDialogue && joueur ? faceAuJoueur(etat, joueur, dt) : pasHabitant(etat, env, dt)));
    rafraichirReperes(dt);

    etats.forEach((etat, i) => {
      const modele = rendu.modeles[etat.id];
      const visible = etat.visible && Math.hypot(camera.position.x - etat.x, camera.position.z - etat.z) < DISTANCE_AFFICHAGE;
      modele.objet.visible = visible;
      if (visible) {
        const y = etat.id === 'aldric' ? terrain.hauteur(etat.x, etat.z) : terrain.altitudeVillage;
        modele.mettreAJour(dt, { x: etat.x, y, z: etat.z, orientation: etat.orientation, vitesse: etat.vitesse, regard: etat.regard, activite: etat.activite });
      }
      // Aldric vit hors du village : les obstacles du village ne servent pas là-bas
      const rayon = etat.id === 'aldric' ? 0 : rayonObstacleHabitant(etat, portes);
      const cercle = cercles[i];
      cercle.x = rayon > 0 ? etat.x : LOIN;
      cercle.z = rayon > 0 ? etat.z : LOIN;
      cercle.rayon = rayon;
    });
    rendu.campement.mettreAJour(dt);
  }

  /** Points d'interaction des habitants visibles. Bertil garde son rôle (la forge) quand il est à la forge. */
  function interactions(): PointInteraction[] {
    points.length = 0;
    idsPoints.length = 0;
    // Pendant une attaque, les habitants courent s'abriter : pas de dialogue (il figerait le combat)
    if (dep.attaqueEnCours?.()) return points;
    for (const etat of etats) {
      if (!etat.visible) continue;
      const aLaForge = etat.id === 'bertil' && forge !== null && Math.hypot(etat.x - forge.x, etat.z - forge.z) < DISTANCE_FORGE;
      points.push({
        type: aLaForge ? 'forgeron' : 'habitant',
        x: etat.x,
        z: etat.z,
        rayon: R.rayonInteraction,
        invite: aLaForge ? 'parler au forgeron' : `parler à ${NOMS_HABITANTS[etat.id]}`,
      });
      idsPoints.push(etat.id);
    }
    return points;
  }

  /** E devant un habitant : ouvre le dialogue. */
  function parlerA(idHabitant: IdHabitant): void {
    dep.parler(idHabitant);
  }

  /** Où est l'habitant en ce moment, ou `null` s'il n'est pas là (rentré chez lui). */
  function position(id: IdHabitant): Point | null {
    const etat = etats.find((e) => e.id === id);
    return etat?.visible ? { x: etat.x, z: etat.z } : null;
  }

  /** Un habitant en conversation (ou `null` : plus personne) : il s'arrête et fait face au joueur. */
  function definirEnDialogue(id: IdHabitant | null): void {
    enDialogue = id;
  }

  /** Parle à l'habitant que le joueur regarde (appelé par le village quand E vise un habitant). */
  function parlerAuVise(): void {
    const { etat } = jeu;
    const vise = interactionVisee(interactions(), etat.x, etat.z, vues.lacetVisee ?? etat.orientation, CONFIG.village.porteeInteraction, demiAngleRegard);
    if (vise) parlerA(idsPoints[points.indexOf(vise)]);
  }

  return { mettreAJour, interactions, parlerA, parlerAuVise, position, definirEnDialogue };
}

export type Habitants = ReturnType<typeof creerHabitants>;
