// Générateur pseudo-aléatoire à graine (mulberry32).
// Même graine = même suite de nombres.

export interface Aleatoire {
  /** Nombre dans [0, 1[ */
  suivant(): number;
  /** Nombre décimal dans [min, max[ */
  entre(min: number, max: number): number;
  /** Entier dans [min, max], bornes incluses */
  entier(min: number, max: number): number;
}

export function creerAleatoire(graine: number): Aleatoire {
  let etat = graine >>> 0;

  const suivant = (): number => {
    etat = (etat + 0x6d2b79f5) >>> 0;
    let t = etat;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    suivant,
    entre: (min, max) => min + suivant() * (max - min),
    entier: (min, max) => Math.floor(min + suivant() * (max - min + 1)),
  };
}

/** Nombre entier tiré d'un texte (FNV-1a), pour dériver une graine d'un identifiant. */
export function hacher(texte: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < texte.length; i++) {
    h ^= texte.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
