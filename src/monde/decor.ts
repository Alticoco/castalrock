// Décor du monde : arbres, rochers, filons, buissons, plantes, fibres et herbes décoratives.
// Pur : aucun import de three, aucun Math.random(). Pour un chunk donné, la liste des éléments
// ne dépend que de la graine et des coordonnées : même graine = même décor, partout.
//
// Méthode : le monde est découpé en cases (4 m pour le décor, 2 m pour les herbes). Chaque case
// porte au plus un élément, tiré au sort selon les densités du biome (src/config.ts), à une
// position décalée dans la case. Deux éléments voisins ne peuvent donc pas se superposer, et
// l'identifiant d'un élément est celui de sa case : il ne change jamais.

import { CONFIG } from '../config';
import { BIOMES, INDICE_BIOME } from './biomes';
import { creerBruit2D, fbm, hacher2D, lisser } from './bruit';
import type { Terrain } from './terrain';

export type TypeDecor =
  | 'arbre-feuillu'
  | 'sapin'
  | 'bouleau'
  | 'rocher'
  | 'filon-fer'
  | 'filon-cuivre'
  | 'filon-charbon'
  | 'cristal-bleu'
  | 'buisson-baies'
  | 'plante-medicinale'
  | 'fibres'
  | 'herbe';

/** Caractéristiques d'un type de décor. Les longueurs sont données à l'échelle 1, en mètres. */
export interface InfosDecor {
  /** Vrai pour les arbres (soumis aux bosquets et aux clairières) */
  arbre: boolean;
  /** Vrai pour ce qui pousse (absent en haute altitude) */
  vegetal: boolean;
  /** Nombre de formes différentes du modèle */
  variantes: number;
  echelleMin: number;
  echelleMax: number;
  /** Rayon du cercle de collision (0 = on passe à travers) */
  rayonCollision: number;
  /** Place occupée au sol : deux éléments ne se chevauchent pas au-delà de 20 % */
  encombrement: number;
  /** Vrai si l'élément accepte les pentes raides */
  toutesPentes: boolean;
  /** Enfoncement dans le sol (cache le pied du modèle sur les pentes) */
  enfoncement: number;
  /** Zone visée par une frappe : rayon et hauteur au-dessus du pied */
  rayonVisee: number;
  hauteurVisee: number;
}

export const INFOS_DECOR: Readonly<Record<TypeDecor, InfosDecor>> = {
  'arbre-feuillu': {
    arbre: true, vegetal: true, variantes: 2, echelleMin: 0.8, echelleMax: 1.45,
    rayonCollision: 0.5, encombrement: 1.0, toutesPentes: false, enfoncement: 0.15,
    rayonVisee: 0.75, hauteurVisee: 4,
  },
  sapin: {
    arbre: true, vegetal: true, variantes: 2, echelleMin: 0.7, echelleMax: 1.4,
    rayonCollision: 0.38, encombrement: 0.9, toutesPentes: false, enfoncement: 0.15,
    rayonVisee: 0.7, hauteurVisee: 4,
  },
  bouleau: {
    arbre: true, vegetal: true, variantes: 1, echelleMin: 0.8, echelleMax: 1.3,
    rayonCollision: 0.28, encombrement: 0.6, toutesPentes: false, enfoncement: 0.12,
    rayonVisee: 0.6, hauteurVisee: 4,
  },
  rocher: {
    arbre: false, vegetal: false, variantes: 3, echelleMin: 0.55, echelleMax: 3.0,
    rayonCollision: 0.85, encombrement: 1.0, toutesPentes: true, enfoncement: 0.3,
    rayonVisee: 1.0, hauteurVisee: 1.0,
  },
  'filon-fer': {
    arbre: false, vegetal: false, variantes: 1, echelleMin: 0.9, echelleMax: 1.5,
    rayonCollision: 0.85, encombrement: 1.0, toutesPentes: true, enfoncement: 0.3,
    rayonVisee: 1.0, hauteurVisee: 1.0,
  },
  'filon-cuivre': {
    arbre: false, vegetal: false, variantes: 1, echelleMin: 0.9, echelleMax: 1.5,
    rayonCollision: 0.85, encombrement: 1.0, toutesPentes: true, enfoncement: 0.3,
    rayonVisee: 1.0, hauteurVisee: 1.0,
  },
  'filon-charbon': {
    arbre: false, vegetal: false, variantes: 1, echelleMin: 0.9, echelleMax: 1.5,
    rayonCollision: 0.85, encombrement: 1.0, toutesPentes: true, enfoncement: 0.3,
    rayonVisee: 1.0, hauteurVisee: 1.0,
  },
  // Cristal bleu : seulement dans la mine (placé par src/mine/plan.ts, jamais tiré dans le monde)
  'cristal-bleu': {
    arbre: false, vegetal: false, variantes: 2, echelleMin: 0.85, echelleMax: 1.3,
    rayonCollision: 0.6, encombrement: 0.8, toutesPentes: true, enfoncement: 0.05,
    rayonVisee: 0.8, hauteurVisee: 1.7,
  },
  'buisson-baies': {
    arbre: false, vegetal: true, variantes: 1, echelleMin: 0.8, echelleMax: 1.3,
    rayonCollision: 0, encombrement: 0.7, toutesPentes: false, enfoncement: 0.05,
    rayonVisee: 0.8, hauteurVisee: 1.0,
  },
  'plante-medicinale': {
    arbre: false, vegetal: true, variantes: 1, echelleMin: 0.8, echelleMax: 1.3,
    rayonCollision: 0, encombrement: 0.3, toutesPentes: false, enfoncement: 0.02,
    rayonVisee: 0.55, hauteurVisee: 0.8,
  },
  fibres: {
    arbre: false, vegetal: true, variantes: 1, echelleMin: 0.8, echelleMax: 1.3,
    rayonCollision: 0, encombrement: 0.3, toutesPentes: false, enfoncement: 0.02,
    rayonVisee: 0.55, hauteurVisee: 1.2,
  },
  herbe: {
    arbre: false, vegetal: true, variantes: 3, echelleMin: 0.7, echelleMax: 1.4,
    rayonCollision: 0, encombrement: 0, toutesPentes: false, enfoncement: 0.02,
    rayonVisee: 0, hauteurVisee: 0,
  },
};

/** Types placés sur les cases de décor, dans l'ordre du tirage (l'herbe a ses propres cases). */
const TYPES_PLACES: readonly Exclude<TypeDecor, 'cristal-bleu'>[] = [
  'arbre-feuillu',
  'sapin',
  'bouleau',
  'rocher',
  'filon-fer',
  'buisson-baies',
  'plante-medicinale',
  'fibres',
  // Ajoutés en fin de liste : le tirage des types existants ne change pas
  'filon-cuivre',
  'filon-charbon',
];

export interface ElementDecor {
  /** Identifiant stable (celui de la case) : sert à la récolte et à la sauvegarde */
  id: string;
  type: TypeDecor;
  /** Position dans le monde ; y est l'altitude du pied du modèle */
  x: number;
  y: number;
  z: number;
  /** Rotation autour de l'axe vertical, en radians */
  rotation: number;
  echelle: number;
  /** Numéro de la forme du modèle (0 à variantes - 1) */
  variante: number;
  /** Nombre de 0 à 1 dont le rendu tire une variation de couleur */
  teinte: number;
  /** Rayon du cercle de collision, en mètres (0 = aucun) */
  rayonCollision: number;
}

export interface GenerateurDecor {
  /** Éléments du chunk (cx, cz), herbes décoratives comprises, toujours dans le même ordre. */
  chunk(cx: number, cz: number): ElementDecor[];
}

const NB = BIOMES.length;
const I_PRAIRIE = INDICE_BIOME.prairie;
const I_FORET = INDICE_BIOME.foret;
// Part de la case dans laquelle la position est décalée : le reste garde les voisins à distance
const DECALAGE = 0.7;

export function estArbre(type: TypeDecor): boolean {
  return INFOS_DECOR[type].arbre;
}

/** Crée le générateur de décor d'un terrain. */
export function creerGenerateurDecor(
  terrain: Terrain,
  /** Disques où rien n'est généré (devant le portail de la mine) */
  zonesLibres: ReadonlyArray<{ x: number; z: number; rayon: number }> = [],
  /** Vrai là où rien n'est généré non plus (sous les ruines et dans les grottes) */
  exclu?: (x: number, z: number) => boolean,
): GenerateurDecor {
  const D = CONFIG.decor;
  const V = CONFIG.monde.village;
  const taille = CONFIG.monde.tailleChunk;
  const graine = terrain.graine;
  const bBosquets = creerBruit2D(graine + 71);
  const poids: number[] = new Array(NB).fill(0);
  const rayonInterdit = V.rayon + D.margeVillage;

  // Tirage numéro k attaché à une case : indépendant des autres tirages et des autres cases
  const tirage = (gx: number, gz: number, k: number) => hacher2D(gx, gz, graine + 1009 + k * 7919);

  /** Position décalée dans la case, ou null si elle tombe dans le village ou dans une zone libre. */
  function positionCase(gx: number, gz: number, tc: number, k: number): { x: number; z: number } | null {
    const x = (gx + 0.5 + (tirage(gx, gz, k) - 0.5) * DECALAGE) * tc;
    const z = (gz + 0.5 + (tirage(gx, gz, k + 1) - 0.5) * DECALAGE) * tc;
    if (x * x + z * z < rayonInterdit * rayonInterdit) return null;
    for (const zone of zonesLibres) if ((x - zone.x) ** 2 + (z - zone.z) ** 2 < zone.rayon * zone.rayon) return null;
    if (exclu?.(x, z)) return null;
    return { x, z };
  }

  /** Altitude du sol si l'endroit peut porter ce type de décor, sinon null. */
  function solAcceptable(type: TypeDecor, x: number, z: number): number | null {
    const infos = INFOS_DECOR[type];
    const y = terrain.hauteur(x, z);
    if (y < terrain.niveauEau + D.margeEau) return null;
    if (infos.vegetal && y > D.altitudeMaxVegetation) return null;
    if (!infos.toutesPentes && terrain.pente(x, z) > D.penteMax) return null;
    return y;
  }

  function creerElement(id: string, type: TypeDecor, x: number, y: number, z: number, gx: number, gz: number, k: number): ElementDecor {
    const infos = INFOS_DECOR[type];
    // Les rochers sont plus souvent petits que gros
    const t = tirage(gx, gz, k);
    const part = type === 'rocher' ? t * Math.sqrt(t) : t;
    const echelle = infos.echelleMin + (infos.echelleMax - infos.echelleMin) * part;
    return {
      id,
      type,
      x,
      y: y - infos.enfoncement * echelle,
      z,
      rotation: tirage(gx, gz, k + 1) * Math.PI * 2,
      echelle,
      variante: Math.min(infos.variantes - 1, Math.floor(tirage(gx, gz, k + 2) * infos.variantes)),
      teinte: tirage(gx, gz, k + 3),
      rayonCollision: infos.rayonCollision * echelle,
    };
  }

  function chunk(cx: number, cz: number): ElementDecor[] {
    const elements: ElementDecor[] = [];

    // 1. Décor : une case de 4 m porte au plus un élément
    const tc = D.tailleCase;
    const n = Math.round(taille / tc);
    const partCase = (tc * tc) / 1000; // les densités sont données pour 1000 m²
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const gx = cx * n + i;
        const gz = cz * n + j;
        const p = positionCase(gx, gz, tc, 1);
        if (!p) continue;
        terrain.poidsBiomes(p.x, p.z, poids);
        // Bosquets en prairie, clairières en forêt : un bruit lent module la densité des arbres
        const b = fbm(bBosquets, p.x * D.frequenceBosquets, p.z * D.frequenceBosquets, 2);
        const facteurPrairie = D.bosquetBase + D.bosquetBonus * lisser(0.15, 0.5, b);
        const facteurForet = 1 - D.clairieres * lisser(0.3, 0.5, -b);

        // Tirage du type : chaque type occupe une part de [0, 1[ égale à sa probabilité
        const u = tirage(gx, gz, 0);
        let cumul = 0;
        let type: TypeDecor | null = null;
        for (const candidat of TYPES_PLACES) {
          let densite = 0;
          for (let k = 0; k < NB; k++) {
            if (poids[k] < 0.002) continue;
            let d = D.densites[BIOMES[k].id][candidat] * poids[k];
            if (INFOS_DECOR[candidat].arbre) {
              if (k === I_PRAIRIE) d *= facteurPrairie;
              else if (k === I_FORET) d *= facteurForet;
            }
            densite += d;
          }
          cumul += densite * partCase;
          if (u < cumul) {
            type = candidat;
            break;
          }
        }
        if (!type) continue;
        const y = solAcceptable(type, p.x, p.z);
        if (y === null) continue;
        const element = creerElement(`d:${gx}:${gz}`, type, p.x, y, p.z, gx, gz, 3);

        // Pas de chevauchement marqué avec un élément déjà posé (gros rocher contre un tronc…)
        const place = INFOS_DECOR[type].encombrement * element.echelle;
        let libre = true;
        for (const autre of elements) {
          const mini = (place + INFOS_DECOR[autre.type].encombrement * autre.echelle) * 0.8;
          const dx = autre.x - element.x;
          const dz = autre.z - element.z;
          if (dx * dx + dz * dz < mini * mini) {
            libre = false;
            break;
          }
        }
        if (libre) elements.push(element);
      }
    }

    // 2. Herbes décoratives : cases de 2 m, jamais dans un rocher
    const rochers = elements.filter((e) => e.rayonCollision > 0 && !INFOS_DECOR[e.type].arbre);
    const th = D.tailleCaseHerbe;
    const nh = Math.round(taille / th);
    const partHerbe = (th * th) / 1000;
    for (let j = 0; j < nh; j++) {
      for (let i = 0; i < nh; i++) {
        const gx = cx * nh + i;
        const gz = cz * nh + j;
        const p = positionCase(gx, gz, th, 11);
        if (!p) continue;
        terrain.poidsBiomes(p.x, p.z, poids);
        let densite = 0;
        for (let k = 0; k < NB; k++) densite += D.densites[BIOMES[k].id].herbe * poids[k];
        if (tirage(gx, gz, 10) >= densite * partHerbe) continue;
        const y = solAcceptable('herbe', p.x, p.z);
        if (y === null) continue;
        if (rochers.some((r) => (r.x - p.x) ** 2 + (r.z - p.z) ** 2 < r.rayonCollision * r.rayonCollision)) continue;
        const element = creerElement(`h:${gx}:${gz}`, 'herbe', p.x, y, p.z, gx, gz, 13);
        // Surtout des touffes ; une fleur blanche ou jaune de temps en temps
        const f = tirage(gx, gz, 17);
        element.variante = f < 0.72 ? 0 : f < 0.87 ? 1 : 2;
        elements.push(element);
      }
    }
    return elements;
  }

  return { chunk };
}
