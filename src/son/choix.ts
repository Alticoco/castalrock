// Choix des sons, sans rien jouer : variante tirée (jamais deux fois la même de suite), moment d'un pas, sol sous les
// pieds, son de chaque créature selon ce qui lui arrive. Pur et testé (choix.test.ts) ; le hasard est passé en paramètre.
import { CONFIG } from '../config';
import type { IdBiome } from '../monde/biomes';
import type { PhaseEnnemi, TypeCreature } from '../regles/combat';
import type { NomSon } from './catalogue';

/** Tirage entre 0 (compris) et 1 (exclu). */
export type Alea = () => number;

/** Indice d'une variante parmi `nombre`, différent de `derniere` dès qu'il y a le choix (-1 : aucune avant). */
export function choisirVariante(nombre: number, derniere: number, alea: Alea): number {
  if (nombre <= 1) return 0;
  if (derniere < 0 || derniere >= nombre) return Math.min(nombre - 1, Math.floor(alea() * nombre));
  const i = Math.min(nombre - 2, Math.floor(alea() * (nombre - 1)));
  return i >= derniere ? i + 1 : i;
}

/** Valeur tirée entre `min` et `max`. */
export function tirerEntre(min: number, max: number, alea: Alea): number {
  return min + (max - min) * alea();
}

/**
 * Vrai si un pied vient de toucher le sol. La phase de marche (radians, un tour = deux pas) vaut π/2 + kπ quand
 * les jambes sont le plus écartées : c'est là que le talon se pose (src/scene/personnage.ts).
 */
export function pasFranchi(phaseAvant: number, phaseApres: number): boolean {
  const pose = (phase: number) => Math.floor((phase - Math.PI / 2) / Math.PI);
  return pose(phaseApres) !== pose(phaseAvant);
}

export type Sol = 'terre' | 'foret' | 'pierre' | 'mouille' | 'bois';

export interface LieuDesPas {
  dansMaison: boolean;
  dansMine: boolean;
  /** Pieds sous la surface de l'eau (gué, bord de lac), sans nager */
  piedsDansEau: boolean;
  dansVillage: boolean;
  biome: IdBiome;
}

/** Sol sous les pieds : plancher de la maison, roche de la mine, eau, terre battue du village, puis selon le biome. */
export function solSousLesPieds(lieu: LieuDesPas): Sol {
  if (lieu.dansMaison) return 'bois';
  if (lieu.dansMine) return 'pierre';
  if (lieu.piedsDansEau) return 'mouille';
  if (lieu.dansVillage) return 'terre';
  switch (lieu.biome) {
    case 'foret':
      return 'foret';
    case 'montagne':
      return 'pierre';
    case 'marais':
      return 'mouille';
    default:
      return 'terre';
  }
}

export const SON_DU_SOL: Readonly<Record<Sol, NomSon>> = {
  terre: 'pas-terre',
  foret: 'pas-foret',
  pierre: 'pas-pierre',
  mouille: 'pas-mouille',
  bois: 'pas-bois',
};

/** En course : des pas plus légers dehors ; dans l'eau et sur le plancher, les mêmes qu'en marchant. */
export const SON_DE_COURSE: Readonly<Record<Sol, NomSon>> = {
  terre: 'course-terre',
  foret: 'course-terre',
  pierre: 'course-pierre',
  mouille: 'pas-mouille',
  bois: 'pas-bois',
};

/**
 * Ce qui arrive à une créature : `appel` (cri au calme, de temps en temps), `alerte` (elle repère le joueur),
 * `attaque` (elle prend son élan), `douleur` (coup reçu), `mort`, `fuite` (un animal détale).
 */
export type MomentCreature = 'appel' | 'alerte' | 'attaque' | 'douleur' | 'mort' | 'fuite';

export interface SonCreature {
  nom: NomSon;
  /** Multiplie la hauteur tirée dans le catalogue */
  hauteur: number;
  /** Multiplie le volume du catalogue */
  volume: number;
}

type TableCreature = Partial<Record<MomentCreature, SonCreature>>;
const s = (nom: NomSon, hauteur = 1, volume = 1): SonCreature => ({ nom, hauteur, volume });

const BANDIT: TableCreature = { douleur: s('bandit'), mort: s('bandit', 0.9, 1.2) };

const SONS_CREATURES: Readonly<Record<string, TableCreature>> = {
  slime: { appel: s('slime'), alerte: s('slime', 0.9), attaque: s('slime', 1.1), douleur: s('slime'), mort: s('slime', 0.75, 1.3) },
  gobelin: { appel: s('gobelin'), alerte: s('gobelin-cri'), attaque: s('gobelin', 1.05), douleur: s('gobelin', 1.15), mort: s('gobelin-cri', 0.85) },
  loup: { appel: s('loup', 1, 0.8), alerte: s('loup'), attaque: s('loup', 1.1), douleur: s('loup', 1.25), mort: s('loup', 0.8) },
  bandit: BANDIT,
  sanglier: { appel: s('sanglier', 1, 0.8), alerte: s('sanglier', 0.9), attaque: s('sanglier', 0.85, 1.2), douleur: s('sanglier', 1.2), mort: s('sanglier', 0.75) },
  // Touchés, ils détalent : la fuite fait le froissement (pas de second bruit pour le coup)
  cerf: { fuite: s('froissement', 0.85) },
  renard: { fuite: s('froissement') },
  lapin: { fuite: s('froissement', 1.4, 0.6) },
};

/** Son d'une créature à ce moment, ou null si elle reste muette. Les chefs (Morvan) parlent comme les bandits, en plus grave. */
export function sonCreature(type: TypeCreature, moment: MomentCreature): SonCreature | null {
  const table = SONS_CREATURES[type];
  if (table) return table[moment] ?? null;
  if (type in CONFIG.chefs) {
    const son = BANDIT[moment];
    return son ? { ...son, hauteur: son.hauteur * 0.88 } : null;
  }
  return null;
}

/** Moment à jouer quand une créature change de phase, ou null (la mort est jouée par le combat, au coup fatal). */
export function momentDuChangement(avant: PhaseEnnemi, apres: PhaseEnnemi): MomentCreature | null {
  if (avant === apres) return null;
  if (apres === 'poursuite' && (avant === 'repos' || avant === 'errance' || avant === 'retour')) return 'alerte';
  if (apres === 'anticipation' || (apres === 'attaque' && avant !== 'anticipation')) return 'attaque';
  if (apres === 'fuite') return 'fuite';
  return null;
}

/** Vrai si la créature est au calme (elle peut pousser son cri de temps en temps). */
export function estAuCalme(phase: PhaseEnnemi): boolean {
  return phase === 'repos' || phase === 'errance';
}

/** Secondes avant le prochain cri au calme. */
export function delaiAppel(alea: Alea): number {
  const { min, max } = CONFIG.sons.appels;
  return tirerEntre(min, max, alea);
}
