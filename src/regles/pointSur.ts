// Points sûrs : dernières places stables où le joueur a posé le pied. Le bouton « Je suis coincé » (menu Échap)
// le ramène au bord du trou d'où il est tombé. Règles pures : pas de three.

export interface PointSur {
  x: number;
  y: number;
  z: number;
}

export interface ReglagesPointSur {
  /** Nombre de points gardés */
  taille: number;
  /** Écart de hauteur minimal pour compter comme « le bord d'où l'on est tombé », en mètres */
  ecartHauteur: number;
  /** Distance minimale du second choix, en mètres */
  distanceMin: number;
  /** Recul par rapport au point choisi, dans le sens opposé à la chute, en mètres */
  recul: number;
}

export interface Position2D {
  x: number;
  y: number;
  z: number;
}

/** Ajoute un point à l'historique (le plus récent en dernier) ; les plus anciens sont oubliés. */
export function ajouterPointSur(historique: readonly PointSur[], point: PointSur, taille: number): PointSur[] {
  const suite = [...historique, point];
  return suite.length > taille ? suite.slice(suite.length - taille) : suite;
}

/**
 * Choisit où ramener le joueur : le plus récent point sûr au moins `ecartHauteur` plus haut que lui ; sinon le plus récent
 * à plus de `distanceMin` ; sinon `repli`. Le point est reculé de `recul` mètres (du point vers la position actuelle
 * en sens inverse) si `reculPossible` accepte l'endroit (pente franchissable) ; sinon il n'est pas reculé.
 */
export function choisirPointDeRetour(
  historique: readonly PointSur[],
  position: Position2D,
  repli: { x: number; z: number },
  reglages: ReglagesPointSur,
  reculPossible: (x: number, z: number) => boolean,
): { x: number; z: number } {
  let choix: { x: number; z: number } | null = null;
  for (let i = historique.length - 1; i >= 0 && !choix; i--) {
    if (historique[i].y - position.y >= reglages.ecartHauteur) choix = historique[i];
  }
  for (let i = historique.length - 1; i >= 0 && !choix; i--) {
    if (Math.hypot(historique[i].x - position.x, historique[i].z - position.z) > reglages.distanceMin) choix = historique[i];
  }
  if (!choix) return { x: repli.x, z: repli.z };
  const dx = choix.x - position.x;
  const dz = choix.z - position.z;
  const longueur = Math.hypot(dx, dz);
  if (longueur < 0.01) return { x: choix.x, z: choix.z };
  // Le recul s'éloigne du trou : du joueur vers le point (le point est du côté d'où l'on est tombé)
  const recule = { x: choix.x + (dx / longueur) * reglages.recul, z: choix.z + (dz / longueur) * reglages.recul };
  return reculPossible(recule.x, recule.z) ? recule : { x: choix.x, z: choix.z };
}
