// Géométrie de la mini-carte : du monde vers la carte, flèches de bordure, tuiles à afficher.
// Pur : aucun import de three, aucun Math.random().
//
// Repères du monde : +x à l'est, +z au sud (le personnage apparaît tourné vers +z, la sortie sud).
// Sur la carte, x va vers la droite et y vers le bas. Un « cap » est le lacet qui pointe vers le haut de la carte :
// PI = nord en haut (carte fixe) ; le lacet du joueur = la carte tourne avec lui (l'avant est en haut).

/** Cap d'une carte orientée nord en haut. */
export const CAP_NORD = Math.PI;

/** Vecteur monde (dx, dz) vers la carte (x à droite, y vers le bas), en mètres, pour un cap donné. */
export function projeter(dx: number, dz: number, cap: number): { x: number; y: number } {
  const fx = Math.sin(cap);
  const fz = Math.cos(cap);
  return { x: -dx * fz + dz * fx, y: -(dx * fx + dz * fz) };
}

/** Inverse de `projeter` : d'un point de la carte (x à droite, y vers le bas, en mètres depuis le joueur) au vecteur monde (dx, dz). */
export function deprojeter(x: number, y: number, cap: number): { dx: number; dz: number } {
  const fx = Math.sin(cap);
  const fz = Math.cos(cap);
  // La projection est une rotation : son inverse est sa transposée
  return { dx: -fz * x - fx * y, dz: fx * x - fz * y };
}

export interface RepereBord {
  x: number;
  y: number;
  /** Vrai si le repère est hors du disque : il est alors ramené sur le bord */
  dehors: boolean;
  /** Direction du repère depuis le centre (atan2(y, x), y vers le bas) : sert à orienter la flèche de bordure */
  angle: number;
}

/**
 * Place un repère de la carte (x, y en pixels depuis le centre) dans un disque de rayon `rayon` :
 * s'il dépasse `rayon - marge`, il est ramené sur ce cercle (`dehors` vrai).
 */
export function placerRepere(x: number, y: number, rayon: number, marge: number): RepereBord {
  const limite = Math.max(0, rayon - marge);
  const d = Math.hypot(x, y);
  const angle = Math.atan2(y, x);
  if (d <= limite) return { x, y, dehors: false, angle };
  return { x: Math.cos(angle) * limite, y: Math.sin(angle) * limite, dehors: true, angle };
}

/** Décalage d'une tuile par rapport à celle du joueur, en nombre de tuiles. */
export interface DecalageTuile {
  di: number;
  dj: number;
}

/**
 * Décalages des tuiles qui touchent le disque de rayon `rayon` (mètres) autour d'un point quelconque de la tuile
 * du joueur, du plus proche au plus lointain : l'ordre de calcul des tuiles manquantes.
 */
export function decalagesTuiles(rayon: number, tailleTuile: number): DecalageTuile[] {
  const n = Math.ceil(rayon / tailleTuile) + 1;
  const liste: Array<DecalageTuile & { d: number }> = [];
  for (let dj = -n; dj <= n; dj++) {
    for (let di = -n; di <= n; di++) {
      // Distance du centre de la tuile à un point au centre de la tuile du joueur, moins la demi-diagonale
      const d = Math.hypot(di, dj) * tailleTuile;
      if (d - tailleTuile * 1.5 <= rayon) liste.push({ di, dj, d });
    }
  }
  liste.sort((a, b) => a.d - b.d);
  return liste.map(({ di, dj }) => ({ di, dj }));
}
