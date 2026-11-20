// Point d'accroche pour la récolte et le combat (étape 4) :
// à l'instant de l'impact de chaque frappe, les rappels abonnés reçoivent le rayon de visée
// (centre de l'écran).

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export type RappelFrappe = (origine: Point3, direction: Point3) => void;

const rappels = new Set<RappelFrappe>();

/** S'abonne aux impacts de frappe. Renvoie la fonction qui désabonne. */
export function surFrappe(rappel: RappelFrappe): () => void {
  rappels.add(rappel);
  return () => rappels.delete(rappel);
}

/** Appelé par la boucle de jeu quand un coup porte. `direction` est de longueur 1. */
export function emettreFrappe(origine: Point3, direction: Point3): void {
  for (const rappel of rappels) rappel(origine, direction);
}
