// Données des biomes V1. Pur : aucun import de three.
// Ajouter un biome = ajouter une ligne ici (et son relief dans terrain.ts).

export type IdBiome = 'prairie' | 'foret' | 'montagne' | 'marais';

export interface Biome {
  /** Identifiant stable (sauvegarde, décor) */
  id: IdBiome;
  /** Nom affiché */
  nom: string;
  /** Couleur du sol (herbe, terre) */
  couleurSol: number;
  /** Couleur de la roche, sur les pentes fortes */
  couleurRoche: number;
  /**
   * Position du biome sur la carte des climats : rudesse (relief) et humidité,
   * environ dans [-1, 1]. Chaque point du monde prend le biome le plus proche.
   */
  climat: { rudesse: number; humidite: number };
  /** Relief de base : altitude moyenne et amplitude des collines, en mètres */
  relief: { base: number; collines: number; detail: number };
}

export const BIOMES: readonly Biome[] = [
  {
    id: 'prairie',
    nom: 'Prairie',
    couleurSol: 0x7fbd42,
    couleurRoche: 0xb8b0a6,
    climat: { rudesse: -0.25, humidite: -0.3 },
    relief: { base: 8, collines: 12, detail: 1.2 },
  },
  {
    id: 'foret',
    nom: 'Forêt',
    couleurSol: 0x55933a,
    couleurRoche: 0xaca59c,
    climat: { rudesse: -0.05, humidite: 0.3 },
    relief: { base: 11, collines: 18, detail: 1.8 },
  },
  {
    id: 'montagne',
    nom: 'Montagne rocheuse',
    couleurSol: 0x8f9d62,
    couleurRoche: 0xbab5b0,
    climat: { rudesse: 0.45, humidite: -0.05 },
    // L'altitude des montagnes vient surtout du bruit « crête » (voir terrain.ts)
    relief: { base: 30, collines: 12, detail: 2.5 },
  },
  {
    id: 'marais',
    nom: 'Marais',
    couleurSol: 0x6c7c3e,
    couleurRoche: 0x9a9484,
    climat: { rudesse: -0.35, humidite: 0.65 },
    // Bas et humide : juste au-dessus de l'eau, avec des flaques
    relief: { base: 0.5, collines: 1.2, detail: 1.1 },
  },
];

/** Indice de chaque biome dans BIOMES (pour lire un tableau de poids). */
export const INDICE_BIOME: Readonly<Record<IdBiome, number>> = {
  prairie: 0,
  foret: 1,
  montagne: 2,
  marais: 3,
};
