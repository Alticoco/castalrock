// La mine dans le jeu : relie le plan (plan.ts), les modèles (sceneMine.ts) et le reste du monde.
// - dehors : le portail, ses obstacles et son point d'interaction ;
// - dedans : murs et poteaux comme obstacles, ambiance sombre (pas de ciel, pas de soleil, brouillard
//   court), petite lampe qui suit le joueur, rochers, filons et cristaux affichés par le décor.
// « Dedans » se déduit de la position du joueur : la mine est une zone lointaine du même monde,
// ce qui fait marcher sans rien changer la sauvegarde, la mort, le feu de camp et les ennemis.

import * as THREE from 'three';
import { CONFIG } from '../config';
import type { ElementDecor } from '../monde/decor';
import type { EntreeMine } from '../monde/entreeMine';
import type { RenduDecor } from '../monde/renduDecor';
import type { PointApparition } from '../regles/apparitions';
import type { ObstacleCercle, ObstacleRectangle } from '../regles/deplacement';
import type { PointInteraction } from '../regles/village';
import { parametresVue } from '../regles/affichage';
import { distanceVue } from '../moteur/reglages';
import type { Lumieres } from '../scene/lumiere';
import {
  contientZoneMine,
  distanceLibre,
  elementDeLaMine,
  ennemisAFaireApparaitre,
  estOuvert,
  rectanglesAutour,
  type PlanMine,
} from './plan';
import { creerInterieurMine, creerPortailMine } from './sceneMine';

export interface ObstaclesMine {
  cercles: readonly ObstacleCercle[];
  rectangles: readonly ObstacleRectangle[] | undefined;
}

export interface Mine {
  /** Vrai quand le joueur est dans la mine (mis à jour par `mettreAJour`). */
  readonly dedans: boolean;
  /** Vrai si (x, z) est dans la zone de la mine (valable tout de suite après un passage). */
  contient(x: number, z: number): boolean;
  /** Torche en main : la lampe du joueur s'éteint (la torche la remplace, deux lumières ne se superposent pas). À appeler avant `mettreAJour`. */
  definirTorche(allumee: boolean): void;
  /** À appeler à chaque image, après le cycle jour/nuit : applique l'ambiance de la mine si le joueur y est. */
  mettreAJour(dt: number, joueur: { x: number; y: number; z: number }, camera: THREE.Camera): void;
  /** Point d'interaction du moment : l'entrée (dehors) ou la sortie (dedans). */
  interaction(): PointInteraction;
  /** Où mène le passage depuis le côté où se trouve le joueur. */
  passage(): { x: number; z: number; orientation: number; message: string };
  /** Obstacles propres à la mine près de (x, z) : murs et poteaux dedans, portail dehors. */
  obstacles(x: number, z: number): ObstaclesMine;
  /** Vrai si le point est dans une case creusée de la mine (position de chargement valable). */
  estLibre(x: number, z: number): boolean;
  /** Élément `m:<n>` du plan (présent ou récolté), ou null. */
  element(id: string): ElementDecor | null;
  /** Fait repousser un élément récolté. */
  remettre(id: string): void;
  /** Ennemis de la mine à faire apparaître maintenant. */
  ennemisAFaireApparaitre(actifs: ReadonlySet<string>, morts: Readonly<Record<string, number>>, temps: number, joueur: { x: number; z: number }): PointApparition[];
  /** Distance à laquelle la caméra en 3e personne peut reculer sans traverser un mur ou le plafond. */
  distanceCamera(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number;
  /**
   * Point à viser pour rejoindre (x, z) : lui-même s'il est du même côté que le joueur, sinon le
   * portail (cible dans la mine, joueur dehors) ou la sortie (l'inverse).
   */
  versCible(x: number, z: number): { x: number; z: number };
  /** Position du portail, pour la boussole. */
  readonly portail: { x: number; z: number };
}

const AUCUN: ObstaclesMine = { cercles: [], rectangles: undefined };

export function creerMine(scene: THREE.Scene, decor: RenduDecor, lumieres: Lumieres, entree: EntreeMine, plan: PlanMine): Mine {
  const M = CONFIG.mine;
  const interieur = creerInterieurMine(plan);
  const portail = creerPortailMine(entree);
  interieur.groupe.visible = false;
  scene.add(interieur.groupe, portail.groupe);

  // Lampe du joueur : allumée seulement dans la mine
  // (atténuation douce : la lampe, juste au-dessus de la tête, ne doit pas brûler les cheveux et les mains)
  const lampe = new THREE.PointLight(M.lampeJoueur.couleur, M.lampeJoueur.intensite, M.lampeJoueur.portee, 1);
  lampe.visible = false;
  scene.add(lampe);

  // Rochers, filons et cristaux : affichés par le décor, comme les éléments du dehors
  for (const e of plan.elements) decor.ajouterDynamique({ ...e }, 1, true);

  const brouillard = scene.fog as THREE.Fog;
  let dedans = false;
  let delaiHalos = 0;

  function basculer(): void {
    interieur.groupe.visible = dedans;
    portail.groupe.visible = !dedans;
    lampe.visible = dedans;
    // Pas de rendu des ombres dans la mine (le soleil y est éteint). `castShadow` ne change pas :
    // le modifier recompilerait tous les shaders et ferait saccader le passage.
    lumieres.soleil.shadow.autoUpdate = !dedans;
    const ciel = scene.getObjectByName('ciel');
    if (ciel) ciel.visible = !dedans;
    if (!dedans) {
      // Le cycle jour/nuit remet les couleurs à chaque image ; les distances du brouillard, non
      const vue = parametresVue(distanceVue());
      brouillard.near = vue.brouillardDebut;
      brouillard.far = vue.brouillardFin;
    }
    delaiHalos = 0;
  }

  const point: PointInteraction = { type: 'mine', x: portail.seuil.x, z: portail.seuil.z, rayon: 1.4, invite: 'entrer dans la mine' };
  const pointSortie: PointInteraction = { type: 'mine', x: plan.sortie.x, z: plan.sortie.z, rayon: 1.4, invite: 'sortir de la mine' };

  return {
    get dedans() {
      return dedans;
    },
    portail: { x: entree.x, z: entree.z },
    contient: contientZoneMine,

    definirTorche(allumee) {
      // Seule l'intensité change : le nombre de lumières de la scène reste le même
      lampe.intensity = allumee ? 0 : M.lampeJoueur.intensite;
    },

    mettreAJour(dt, joueur, camera) {
      const maintenant = contientZoneMine(joueur.x, joueur.z);
      if (maintenant !== dedans) {
        dedans = maintenant;
        basculer();
      }
      if (!dedans) return;
      // Ambiance : fond sombre, brouillard court (repoussé quand la caméra s'éloigne, en 3e personne),
      // lumière du « ciel » faible et chaude, soleil éteint
      const recul = Math.hypot(camera.position.x - joueur.x, camera.position.y - joueur.y, camera.position.z - joueur.z);
      (scene.background as THREE.Color).setHex(M.couleurFond);
      brouillard.color.setHex(M.couleurFond);
      brouillard.near = M.brouillardDebut + recul;
      brouillard.far = M.brouillardFin + recul;
      lumieres.hemi.color.setHex(M.hemiCiel);
      lumieres.hemi.groundColor.setHex(M.hemiSol);
      lumieres.hemi.intensity = M.intensiteHemi;
      lumieres.soleil.intensity = 0;
      lampe.position.set(joueur.x, joueur.y + M.lampeJoueur.hauteur, joueur.z);

      // Deux fois par seconde : la lueur d'un cristal disparaît avec lui
      delaiHalos -= dt;
      if (delaiHalos <= 0) {
        delaiHalos = 0.5;
        const presents = new Set(decor.elementsAutour(plan.origine.x + plan.largeur / 2, plan.origine.z + plan.profondeur / 2, 80).map((e) => e.id));
        for (const [id, halo] of interieur.halos) halo.visible = presents.has(id);
      }
    },

    interaction: () => (dedans ? pointSortie : point),

    passage() {
      if (dedans) return { ...portail.retour, message: 'Vous sortez de la mine' };
      return { ...plan.arrivee, message: 'Vous entrez dans la mine' };
    },

    obstacles(x, z) {
      if (contientZoneMine(x, z)) {
        return {
          cercles: plan.poteaux.filter((p) => Math.abs(p.x - x) < 4 && Math.abs(p.z - z) < 4),
          rectangles: rectanglesAutour(plan, x, z),
        };
      }
      if (Math.hypot(x - entree.x, z - entree.z) > 20) return AUCUN;
      return { cercles: portail.cercles, rectangles: portail.rectangles };
    },

    estLibre: (x, z) => estOuvert(plan, x, z),
    element: (id) => elementDeLaMine(plan, id),

    remettre(id) {
      const e = elementDeLaMine(plan, id);
      if (e) decor.ajouterDynamique({ ...e }, 1, true);
    },

    ennemisAFaireApparaitre: (actifs, morts, temps, joueur) => ennemisAFaireApparaitre(plan, actifs, morts, temps, joueur),

    distanceCamera(ox, oy, oz, dx, dy, dz, max) {
      return dedans ? distanceLibre(plan, ox, oy, oz, dx, dy, dz, max) : max;
    },

    versCible(x, z) {
      const cibleDedans = contientZoneMine(x, z);
      if (cibleDedans === dedans) return { x, z };
      return dedans ? plan.sortie : { x: entree.x, z: entree.z };
    },
  };
}
