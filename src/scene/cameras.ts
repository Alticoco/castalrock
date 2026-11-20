// Les deux vues du personnage (1re personne, 3e personne) et la transparence
// des obstacles qui le cachent. Ne contient aucune règle de jeu.
// Convention : lacet ψ et tangage θ de la caméra (ordre YXZ) ; elle regarde vers
// (-sin ψ cos θ, sin θ, -cos ψ cos θ). Le personnage regarde comme elle quand son lacet vaut ψ + π.

import * as THREE from 'three';
import { CONFIG } from '../config';

export type NomVue = 'premiere' | 'troisieme';

const ORDRE: NomVue[] = ['premiere', 'troisieme'];
const TITRES: Record<NomVue, string> = {
  premiere: 'Vue : 1re personne',
  troisieme: 'Vue : 3e personne',
};

export interface CibleCamera {
  /** Position des pieds du personnage */
  x: number;
  y: number;
  z: number;
}

export interface CommandesCamera {
  /** Mouvement de la souris (pointeur verrouillé), en pixels */
  dx: number;
  dy: number;
  /** Balancement de la tête : phase du pas et intensité (0 à 1) */
  phaseMarche: number;
  intensiteMarche: number;
}

export interface Cameras {
  readonly vue: NomVue;
  /** Nom de la vue à afficher au joueur */
  readonly titre: string;
  /** Passe à l'autre vue (1re ↔ 3e personne), avec une transition douce. */
  suivante(): void;
  /** Tourne le regard (1re et 3e personne) dans la direction du personnage : après un passage (entrée ou sortie de la mine). */
  regarderVers(orientationPersonnage: number): void;
  /** Prend directement cette vue (chargement d'une partie), sans changer le regard. */
  definirVue(nom: NomVue): void;
  /** Repart en douceur de la position actuelle de la caméra (retour de la caméra de visite). */
  reprendre(): void;
  /** Convertit ZQSD (avant, côté) en direction dans le monde, selon la vue. */
  directionDeplacement(avant: number, cote: number): { x: number; z: number };
  mettreAJour(dt: number, cible: CibleCamera, commandes: CommandesCamera): void;
  /** Lacet que doit prendre le personnage pour viser (centre de l'écran) */
  readonly lacetVisee: number | undefined;
  /** Rayon de visée de la dernière image : origine et direction (longueur 1) */
  readonly rayonVisee: { origine: THREE.Vector3; direction: THREE.Vector3 };
  /** Distance entre la caméra et les yeux du personnage, en mètres */
  readonly distanceYeux: number;
}

const borne = (v: number, mini: number, maxi: number) => Math.max(mini, Math.min(maxi, v));

export function creerCameras(
  camera: THREE.PerspectiveCamera,
  /** Altitude sous laquelle la caméra ne doit pas passer (sol ou surface de l'eau) */
  sol: (x: number, z: number) => number,
  /**
   * Distance libre le long d'un rayon (origine, direction de longueur 1, distance maximale) avant un mur
   * ou un plafond : dans la mine, la caméra de la 3e personne se rapproche au lieu de traverser la roche.
   */
  obstacle?: (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, max: number) => number,
): Cameras {
  const C = CONFIG.cameras;
  const T = C.troisieme;

  let indice = 0;
  // Regard partagé par la 1re et la 3e personne ; au départ vers +z (sortie du village)
  let lacet = Math.PI;
  let tangage = -0.05;
  let distance3e = T.distance;
  let yLisse: number | undefined;
  // Transition : de la pose de départ vers la pose de la vue, avancement de 0 à 1
  let transition = 1;
  const positionDepart = new THREE.Vector3();
  const orientationDepart = new THREE.Quaternion();

  let lacetVisee: number | undefined;
  let distanceYeux = 0;
  const rayonVisee = { origine: new THREE.Vector3(), direction: new THREE.Vector3(0, 0, 1) };

  // Objets de travail réutilisés à chaque image
  const position = new THREE.Vector3();
  const orientation = new THREE.Quaternion();
  const euler = new THREE.Euler(0, 0, 0, 'YXZ');
  const avant = new THREE.Vector3();
  const pivot = new THREE.Vector3();
  const point = new THREE.Vector3();
  const yeux = new THREE.Vector3();

  camera.rotation.order = 'YXZ';

  const vue = () => ORDRE[indice];

  function demarrerTransition(): void {
    positionDepart.copy(camera.position);
    orientationDepart.copy(camera.quaternion);
    transition = 0;
  }

  function borneTangage(): void {
    if (vue() === 'premiere') tangage = borne(tangage, -C.premiere.tangageMax, C.premiere.tangageMax);
    else tangage = borne(tangage, T.tangageMin, T.tangageMax);
  }

  function regard(psi: number, theta: number): void {
    avant.set(-Math.sin(psi) * Math.cos(theta), Math.sin(theta), -Math.cos(psi) * Math.cos(theta));
    euler.set(theta, psi, 0);
    orientation.setFromEuler(euler);
  }

  /** Calcule la pose voulue par la vue courante dans `position` et `orientation`. */
  function calculerPose(dt: number, cible: CibleCamera, y: number, commandes: CommandesCamera): void {
    if (vue() === 'premiere') {
      regard(lacet, tangage);
      const B = C.premiere;
      const i = commandes.intensiteMarche;
      const lateral = Math.cos(commandes.phaseMarche) * B.balancementLateral * i;
      // Un peu en avant du visage, avec le balancement de la tête
      position.set(
        cible.x - Math.sin(lacet) * 0.1 + Math.cos(lacet) * lateral,
        y + CONFIG.personnage.hauteurYeux + Math.sin(commandes.phaseMarche * 2) * B.balancementVertical * i,
        cible.z - Math.cos(lacet) * 0.1 - Math.sin(lacet) * lateral,
      );
      return;
    }
    regard(lacet, tangage);
    pivot.set(
      cible.x + Math.cos(lacet) * T.decalageEpaule,
      y + T.hauteurPivot,
      cible.z - Math.sin(lacet) * T.decalageEpaule,
    );
    // Relief entre le personnage et la caméra : elle se rapproche aussitôt, et recule en douceur ensuite
    const pas = 14;
    let possible = T.distance;
    for (let k = 1; k <= pas; k++) {
      const d = (k / pas) * T.distance;
      point.copy(pivot).addScaledVector(avant, -d);
      if (point.y < sol(point.x, point.z) + C.margeSol) {
        possible = Math.max(T.distanceMin, ((k - 1) / pas) * T.distance);
        break;
      }
    }
    if (obstacle) {
      possible = Math.max(T.distanceMin, Math.min(possible, obstacle(pivot.x, pivot.y, pivot.z, -avant.x, -avant.y, -avant.z, T.distance)));
    }
    if (possible < distance3e) distance3e = possible;
    else distance3e += (possible - distance3e) * (1 - Math.exp(-T.vitesseRecul * dt));
    position.copy(pivot).addScaledVector(avant, -distance3e);
  }

  function mettreAJour(dt: number, cible: CibleCamera, commandes: CommandesCamera): void {
    lacet -= commandes.dx * C.sensibilite;
    tangage -= commandes.dy * C.sensibilite;
    borneTangage();

    // Hauteur suivie en douceur : gomme les petites marches du relief à faces plates
    if (yLisse === undefined) yLisse = cible.y;
    yLisse += (cible.y - yLisse) * (1 - Math.exp(-18 * dt));
    yLisse = borne(yLisse, cible.y - 1.5, cible.y + 1.5);

    calculerPose(dt, cible, yLisse, commandes);

    if (transition < 1) {
      transition = Math.min(1, transition + dt / C.dureeTransition);
      const e = transition * transition * (3 - 2 * transition);
      camera.position.lerpVectors(positionDepart, position, e);
      camera.quaternion.slerpQuaternions(orientationDepart, orientation, e);
    } else {
      camera.position.copy(position);
      camera.quaternion.copy(orientation);
    }
    // Jamais sous le terrain ni sous l'eau
    const plancher = sol(camera.position.x, camera.position.z) + C.margeSol;
    if (camera.position.y < plancher) camera.position.y = plancher;
    camera.updateMatrixWorld();

    yeux.set(cible.x, yLisse + CONFIG.personnage.hauteurYeux, cible.z);
    distanceYeux = camera.position.distanceTo(yeux);

    // Visée : centre de l'écran
    rayonVisee.origine.copy(camera.position);
    camera.getWorldDirection(rayonVisee.direction);
    lacetVisee = lacet + Math.PI;
  }

  return {
    get vue() {
      return vue();
    },
    get titre() {
      return TITRES[vue()];
    },
    suivante() {
      indice = (indice + 1) % ORDRE.length;
      borneTangage();
      distance3e = T.distance;
      demarrerTransition();
    },
    regarderVers(orientationPersonnage) {
      lacet = orientationPersonnage - Math.PI;
      tangage = vue() === 'premiere' ? -0.05 : T.tangageDepart;
      borneTangage();
      distance3e = T.distance;
    },
    definirVue(nom) {
      indice = ORDRE.indexOf(nom);
      borneTangage();
      demarrerTransition();
    },
    reprendre: demarrerTransition,
    directionDeplacement(versAvant, versCote) {
      return {
        x: -Math.sin(lacet) * versAvant + Math.cos(lacet) * versCote,
        z: -Math.cos(lacet) * versAvant - Math.sin(lacet) * versCote,
      };
    },
    mettreAJour,
    get lacetVisee() {
      return lacetVisee;
    },
    rayonVisee,
    get distanceYeux() {
      return distanceYeux;
    },
  };
}

// --- Transparence des obstacles -------------------------------------------------------------

export interface Masquage {
  /**
   * Rend transparents, en douceur, les objets marqués `userData.peutMasquer = true`
   * qui se trouvent entre la caméra et le personnage, et ouvre le trou du décor.
   * `actif` faux : tout redevient opaque.
   */
  mettreAJour(dt: number, actif: boolean, cible: CibleCamera): void;
}

interface Suivi {
  opacite: number;
  /** Matériaux d'origine de chaque maillage, remis en place quand l'objet redevient opaque */
  originaux: Map<THREE.Mesh, THREE.Material | THREE.Material[]>;
  copies: THREE.Material[];
}

/**
 * Décor affiché par InstancedMesh (arbres, rochers) : des milliers d'instances partagent un
 * matériau, on ne peut donc pas en copier un par objet. Son shader perce à la place un trou
 * le long de la ligne caméra–personnage ; le masquage lui donne le point visé et la force (0 à 1).
 */
export interface TrouDecor {
  definirTrou(x: number, y: number, z: number, force: number): void;
}

const INTERVALLE_RECENSEMENT = 0.5;
// Hauteur du point visé par le trou du décor, au-dessus des pieds (milieu du corps)
const HAUTEUR_TROU = 1.0;

export function creerMasquage(scene: THREE.Scene, camera: THREE.Camera, trouDecor?: TrouDecor): Masquage {
  const R = CONFIG.cameras.transparence;
  let forceTrou = 0;
  let candidats: THREE.Object3D[] = [];
  let attente = 0;
  const suivis = new Map<THREE.Object3D, Suivi>();
  const lanceur = new THREE.Raycaster();
  const versCible = new THREE.Vector3();
  const touches = new Set<THREE.Object3D>();

  function recenser(objet: THREE.Object3D): void {
    if (objet.userData.peutMasquer === true) {
      candidats.push(objet);
      return;
    }
    for (const enfant of objet.children) recenser(enfant);
  }

  function racineMasquable(objet: THREE.Object3D | null): THREE.Object3D | null {
    while (objet && objet.userData.peutMasquer !== true) objet = objet.parent;
    return objet;
  }

  // Chaque objet masqué reçoit ses propres copies de matériaux : les autres objets
  // qui partagent les mêmes matériaux restent opaques
  function commencer(objet: THREE.Object3D): Suivi {
    const suivi: Suivi = { opacite: 1, originaux: new Map(), copies: [] };
    objet.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      suivi.originaux.set(m, m.material);
      const copier = (materiau: THREE.Material) => {
        const copie = materiau.clone();
        copie.transparent = true;
        copie.userData.opaciteOrigine = materiau.opacity;
        suivi.copies.push(copie);
        return copie;
      };
      m.material = Array.isArray(m.material) ? m.material.map(copier) : copier(m.material);
    });
    suivis.set(objet, suivi);
    return suivi;
  }

  function terminer(objet: THREE.Object3D, suivi: Suivi): void {
    for (const [m, materiau] of suivi.originaux) m.material = materiau;
    for (const copie of suivi.copies) copie.dispose();
    suivis.delete(objet);
  }

  function mettreAJour(dt: number, actif: boolean, cible: CibleCamera): void {
    attente -= dt;
    if (attente <= 0) {
      attente = INTERVALLE_RECENSEMENT;
      candidats = [];
      recenser(scene);
      // Objet retiré de la scène entre-temps : on lui rend ses matériaux
      for (const [objet, suivi] of suivis) if (!candidats.includes(objet)) terminer(objet, suivi);
    }

    touches.clear();
    if (actif && candidats.length > 0) {
      // Deux rayons : vers le bas du corps et vers la tête
      for (const hauteur of [0.5, 1.5]) {
        versCible.set(cible.x, cible.y + hauteur, cible.z).sub(camera.position);
        const distance = versCible.length();
        if (distance < 0.5) continue;
        lanceur.set(camera.position, versCible.divideScalar(distance));
        lanceur.far = distance - 0.4;
        for (const impact of lanceur.intersectObjects(candidats, true)) {
          const racine = racineMasquable(impact.object);
          if (racine) touches.add(racine);
        }
      }
    }

    for (const objet of touches) if (!suivis.has(objet)) commencer(objet);
    const pas = 1 - Math.exp(-R.vitesse * dt);
    if (trouDecor) {
      forceTrou += ((actif ? 1 : 0) - forceTrou) * pas;
      trouDecor.definirTrou(cible.x, cible.y + HAUTEUR_TROU, cible.z, forceTrou < 0.01 ? 0 : forceTrou);
    }
    for (const [objet, suivi] of suivis) {
      const visee = touches.has(objet) ? R.opacite : 1;
      suivi.opacite += (visee - suivi.opacite) * pas;
      if (visee === 1 && suivi.opacite > 0.99) {
        terminer(objet, suivi);
        continue;
      }
      for (const copie of suivi.copies) copie.opacity = (copie.userData.opaciteOrigine as number) * suivi.opacite;
    }
  }

  return { mettreAJour };
}
