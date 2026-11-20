// Catalogue des sons : pour chaque nom, ses fichiers (variantes tirées au hasard, dans public/sons/), son volume
// (0 à 1, après mise au même niveau de tous les fichiers) et l'écart de hauteur tiré à chaque fois (1 = hauteur
// d'origine). Aucun import de three : ce fichier est de la donnée pure. Sources et licences : public/sons/SOURCES.md.

export interface DefinitionSon {
  readonly fichiers: readonly string[];
  readonly volume: number;
  /** Vitesse de lecture tirée entre ces deux valeurs (plus haut = plus aigu et plus court) */
  readonly hauteur: readonly [number, number];
}

const serie = (prefixe: string, n: number, extension: string): string[] =>
  Array.from({ length: n }, (_, i) => `${prefixe}-${i + 1}.${extension}`);

export const SONS = {
  // --- Outils sur le décor ---
  hache: { fichiers: serie('hache', 5, 'ogg'), volume: 0.32, hauteur: [0.82, 1.08] },
  'arbre-abattu': { fichiers: serie('arbre-abattu', 3, 'flac'), volume: 0.34, hauteur: [0.85, 1.05] },
  pioche: { fichiers: serie('pioche', 5, 'ogg'), volume: 0.26, hauteur: [0.85, 1.12] },
  'roche-cassee': { fichiers: serie('roche-cassee', 3, 'ogg'), volume: 0.32, hauteur: [0.85, 1.05] },
  feuilles: { fichiers: serie('feuilles', 2, 'ogg'), volume: 0.3, hauteur: [0.9, 1.15] },
  // Coup dans le vide
  souffle: { fichiers: serie('souffle', 3, 'ogg'), volume: 0.12, hauteur: [0.9, 1.2] },

  // --- Combat ---
  'epee-touche': { fichiers: serie('epee-touche', 3, 'ogg'), volume: 0.28, hauteur: [0.9, 1.1] },
  parade: { fichiers: serie('parade', 3, 'ogg'), volume: 0.3, hauteur: [0.92, 1.08] },
  'joueur-blesse': { fichiers: serie('joueur-blesse', 3, 'mp3'), volume: 0.26, hauteur: [0.95, 1.05] },

  // --- Pas du joueur, selon le sol ---
  'pas-terre': { fichiers: serie('pas-terre', 10, 'ogg'), volume: 0.13, hauteur: [0.9, 1.1] },
  'pas-foret': {
    fichiers: ['feuilles-1.ogg', 'feuilles-2.ogg', 'pas-terre-3.ogg', 'pas-terre-5.ogg', 'pas-terre-9.ogg'],
    volume: 0.12,
    hauteur: [0.9, 1.1],
  },
  'pas-pierre': { fichiers: serie('pas-pierre', 4, 'ogg'), volume: 0.11, hauteur: [0.9, 1.1] },
  'pas-mouille': { fichiers: serie('pas-mouille', 4, 'ogg'), volume: 0.13, hauteur: [0.9, 1.1] },
  'pas-bois': { fichiers: serie('pas-bois', 6, 'ogg'), volume: 0.13, hauteur: [0.9, 1.1] },
  // En course, dehors : pas plus légers, enregistrés sur sable et herbe, ou sur pierre
  'course-terre': { fichiers: serie('course-terre', 6, 'ogg'), volume: 0.13, hauteur: [0.95, 1.1] },
  'course-pierre': { fichiers: serie('course-pierre', 6, 'ogg'), volume: 0.11, hauteur: [0.95, 1.1] },

  // --- Créatures (placées dans le monde) ---
  sanglier: { fichiers: ['sanglier-1.ogg'], volume: 0.4, hauteur: [0.8, 1.15] },
  loup: { fichiers: serie('loup', 3, 'flac'), volume: 0.36, hauteur: [0.78, 0.95] },
  gobelin: { fichiers: serie('gobelin', 10, 'wav'), volume: 0.3, hauteur: [0.92, 1.12] },
  'gobelin-cri': { fichiers: serie('gobelin-cri', 3, 'wav'), volume: 0.34, hauteur: [0.9, 1.08] },
  slime: { fichiers: serie('slime', 3, 'flac'), volume: 0.24, hauteur: [1.25, 1.7] },
  // Bandits et Morvan : la même voix que le joueur blessé, plus grave
  bandit: { fichiers: serie('joueur-blesse', 3, 'mp3'), volume: 0.3, hauteur: [0.72, 0.85] },
  // Cerf, lapin, renard : un froissement de feuillage quand ils détalent
  froissement: { fichiers: serie('feuilles', 2, 'ogg'), volume: 0.26, hauteur: [0.8, 1.2] },
} as const satisfies Record<string, DefinitionSon>;

export type NomSon = keyof typeof SONS;

/** Musique jouée depuis l'auberge (en boucle, lue au fil de l'eau plutôt que chargée d'un bloc). */
export const MUSIQUE_AUBERGE = 'musique-auberge.mp3';

/** Tous les fichiers à charger au démarrage (sans doublon). */
export function fichiersDuCatalogue(): string[] {
  return [...new Set(Object.values(SONS).flatMap((d: DefinitionSon) => d.fichiers))];
}
