// La maison du joueur dans le jeu : relie le plan (plan.ts), les modèles (sceneMaison.ts) et le reste du monde.
// Comme la mine, l'intérieur est une zone lointaine du même monde : « dedans » se déduit de la position
// du joueur. Dedans : murs et meubles comme obstacles, pas de ciel ni de soleil, lumière générale chaude
// et lueur du feu de cheminée.
// La lueur du feu est une lumière créée au démarrage, à intensité nulle dehors : le nombre de lumières
// de la scène ne change jamais (sinon tous les shaders se recompilent et le jeu saccade).

import * as THREE from 'three';
import { CONFIG } from '../config';
import { parametresVue } from '../regles/affichage';
import type { PointInteraction } from '../regles/village';
import { distanceVue } from '../moteur/reglages';
import type { Lumieres } from '../scene/lumiere';
import type { Mine, ObstaclesMine } from '../mine/mine';
import { contientZoneMaison, distanceLibre, estLibre, type PlanMaison } from './plan';
import { creerInterieurMaison } from './sceneMaison';

export interface Maison {
  readonly plan: PlanMaison;
  /** Vrai quand le joueur est dans la maison (mis à jour par `mettreAJour`). */
  readonly dedans: boolean;
  /** Vrai si (x, z) est dans la zone de la maison (valable tout de suite après un passage). */
  contient(x: number, z: number): boolean;
  /** À appeler à chaque image, après le cycle jour/nuit et la mine : applique l'ambiance de la maison si le joueur y est. */
  mettreAJour(dt: number, joueur: { x: number; y: number; z: number }): void;
  /** Points d'interaction de l'intérieur (lit, coffre, cheminée, porte) ; aucun quand le joueur est dehors. */
  interactions(): readonly PointInteraction[];
  /** Murs et meubles. */
  obstacles(): ObstaclesMine;
  /** Vrai si le point est dans la pièce, hors des meubles. */
  estLibre(x: number, z: number): boolean;
  /** Distance à laquelle la caméra en 3e personne peut reculer sans traverser un mur ou le plafond. */
  distanceCamera(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number): number;
}

const AUCUNE: readonly PointInteraction[] = [];

export function creerMaison(scene: THREE.Scene, lumieres: Lumieres, plan: PlanMaison): Maison {
  const M = CONFIG.maison;
  const interieur = creerInterieurMaison(plan);
  interieur.groupe.visible = false;
  scene.add(interieur.groupe);

  // Lueur du feu : toujours dans la scène, éteinte (intensité 0) tant que le joueur est dehors
  const lueur = new THREE.PointLight(M.feu.couleur, 0, M.feu.portee, M.feu.attenuation);
  lueur.name = 'lumiere-cheminee';
  lueur.position.set(interieur.feu.x, interieur.feu.y, interieur.feu.z);
  scene.add(lueur);

  const brouillard = scene.fog as THREE.Fog;
  const obstacles: ObstaclesMine = { cercles: plan.cercles, rectangles: plan.rectangles };
  let dedans = false;
  let temps = 0;

  function basculer(): void {
    interieur.groupe.visible = dedans;
    // Pas de rendu des ombres dans la maison (le soleil y est éteint). `castShadow` ne change pas :
    // le modifier recompilerait tous les shaders.
    lumieres.soleil.shadow.autoUpdate = !dedans;
    const ciel = scene.getObjectByName('ciel');
    if (ciel) ciel.visible = !dedans;
    if (!dedans) {
      lueur.intensity = 0;
      // Le cycle jour/nuit remet les couleurs à chaque image ; les distances du brouillard, non
      const vue = parametresVue(distanceVue());
      brouillard.near = vue.brouillardDebut;
      brouillard.far = vue.brouillardFin;
    }
  }

  return {
    plan,
    get dedans() {
      return dedans;
    },
    contient: contientZoneMaison,

    mettreAJour(dt, joueur) {
      const maintenant = contientZoneMaison(joueur.x, joueur.z);
      if (maintenant !== dedans) {
        dedans = maintenant;
        basculer();
      }
      if (!dedans) return;
      temps += dt;
      // Ambiance : fond sombre et chaud, pas de brouillard dans la pièce, lumière générale chaude, soleil éteint
      (scene.background as THREE.Color).setHex(M.couleurFond);
      brouillard.color.setHex(M.couleurFond);
      brouillard.near = 40;
      brouillard.far = 90;
      lumieres.hemi.color.setHex(M.hemiCiel);
      lumieres.hemi.groundColor.setHex(M.hemiSol);
      lumieres.hemi.intensity = M.intensiteHemi;
      lumieres.soleil.intensity = 0;
      // Le feu danse : deux ondes de vitesses différentes
      lueur.intensity = M.feu.intensite * (1 + M.feu.scintillement * (0.6 * Math.sin(temps * 9) + 0.4 * Math.sin(temps * 23 + 1.3)));
      interieur.mettreAJour(dt);
    },

    interactions: () => (dedans ? plan.interactions : AUCUNE),
    obstacles: () => obstacles,
    estLibre: (x, z) => estLibre(plan, x, z),

    distanceCamera(ox, oy, oz, dx, dy, dz, max) {
      return dedans ? distanceLibre(plan, ox, oy, oz, dx, dy, dz, max) : max;
    },
  };
}

/**
 * La mine telle que le reste du jeu la connaît, complétée par la maison : partout où le jeu demande
 * « est-ce une zone intérieure ? » (obstacles, caméra, chunks, ennemis, feu de camp, plantation), la
 * maison répond comme la mine. `dedans`, le passage et l'ambiance restent ceux de la mine seule.
 */
export function mineAvecMaison(mine: Mine, maison: Maison): Mine {
  return {
    get dedans() {
      return mine.dedans;
    },
    portail: mine.portail,
    contient: (x, z) => mine.contient(x, z) || maison.contient(x, z),
    definirTorche: (allumee) => mine.definirTorche(allumee),
    mettreAJour: (dt, joueur, camera) => mine.mettreAJour(dt, joueur, camera),
    interaction: () => mine.interaction(),
    passage: () => mine.passage(),
    obstacles: (x, z) => (maison.contient(x, z) ? maison.obstacles() : mine.obstacles(x, z)),
    estLibre: (x, z) => (maison.contient(x, z) ? maison.estLibre(x, z) : mine.estLibre(x, z)),
    element: (id) => mine.element(id),
    remettre: (id) => mine.remettre(id),
    // Aucun ennemi n'apparaît tant que le joueur est chez lui
    ennemisAFaireApparaitre: (actifs, morts, temps, joueur) =>
      maison.contient(joueur.x, joueur.z) ? [] : mine.ennemisAFaireApparaitre(actifs, morts, temps, joueur),
    distanceCamera: (ox, oy, oz, dx, dy, dz, max) =>
      maison.dedans ? maison.distanceCamera(ox, oy, oz, dx, dy, dz, max) : mine.distanceCamera(ox, oy, oz, dx, dy, dz, max),
    versCible(x, z) {
      // Depuis la maison, tout ce qui est ailleurs se rejoint par la porte
      if (maison.dedans) return maison.contient(x, z) ? { x, z } : maison.plan.porte;
      return mine.versCible(x, z);
    },
  };
}
