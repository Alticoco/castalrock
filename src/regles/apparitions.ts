// Apparition des ennemis : points d'apparition fixes par chunk (graine + chunk), choix de ceux à faire
// apparaître (distance au joueur, nuit, délai après la mort, limite d'ennemis présents).
// Pur : aucun import de three, aucun Math.random().

import { CONFIG } from '../config';
import type { IdBiome } from '../monde/biomes';
import { creerAleatoire } from './aleatoire';
import { TYPES_ANIMAL, TYPES_ENNEMI, type TypeCreature } from './combat';

export interface PointApparition {
  /** Identifiant stable : `e:<cx>:<cz>:<n>` pour un ennemi, `a:<cx>:<cz>:<n>` (puis `:<k>` dans un groupe) pour un animal */
  readonly id: string;
  readonly type: TypeCreature;
  readonly x: number;
  readonly z: number;
  /** Vrai : ce point n'est occupé que la nuit (ennemis plus nombreux la nuit) */
  readonly nuitSeulement: boolean;
}

/** Ce que le placement a besoin de savoir du monde. */
export interface MondeApparition {
  biome(x: number, z: number): IdBiome;
  hauteur(x: number, z: number): number;
  niveauEau: number;
  /** Pente du sol (0 = plat, 1 = vertical) ; absente = sol accepté partout */
  pente?(x: number, z: number): number;
  /** Disques où aucun ennemi ordinaire n'apparaît (camp des bandits, autel du Cœur) */
  zonesSansEnnemi?: ReadonlyArray<{ x: number; z: number; rayon: number }>;
}

/** Vrai si le point est dans l'un des disques interdits du monde. */
export function dansZoneSansEnnemi(monde: MondeApparition, x: number, z: number): boolean {
  return monde.zonesSansEnnemi?.some((zone) => Math.hypot(x - zone.x, z - zone.z) <= zone.rayon) ?? false;
}

/** Graine propre à un chunk. */
function graineDuChunk(graine: number, cx: number, cz: number): number {
  return ((graine | 0) ^ Math.imul(cx | 0, 73856093) ^ Math.imul(cz | 0, 19349663) ^ 0x5bd1e995) >>> 0;
}

/** Points d'apparition d'un chunk : toujours les mêmes pour une même graine. Aucun dans le village ni dans l'eau. */
export function pointsDuChunk(graine: number, cx: number, cz: number, monde: MondeApparition): PointApparition[] {
  const A = CONFIG.apparitions;
  const taille = CONFIG.monde.tailleChunk;
  const alea = creerAleatoire(graineDuChunk(graine, cx, cz));
  const rayonInterdit = CONFIG.monde.village.rayon + A.margeVillage;
  const points: PointApparition[] = [];
  for (let i = 0; i < A.candidatsParChunk; i++) {
    // Les trois tirages sont toujours faits, pour que chaque point reste indépendant des autres
    const x = (cx + alea.suivant()) * taille;
    const z = (cz + alea.suivant()) * taille;
    const u = alea.suivant();
    if (Math.hypot(x, z) < rayonInterdit) continue;
    if (monde.hauteur(x, z) < monde.niveauEau + A.margeEau) continue;
    if (monde.pente && monde.pente(x, z) > A.penteMax) continue;
    if (dansZoneSansEnnemi(monde, x, z)) continue;
    const chances = A.chances[monde.biome(x, z)];
    const distanceVillage = Math.hypot(x, z);
    let cumul = 0;
    for (const type of TYPES_ENNEMI) {
      const jour = chances[type];
      const nuit = jour * A.facteurNuit[type];
      if (u < cumul + nuit || u < cumul + jour) {
        // Trop près du village pour ce type : le point reste vide (il n'est pas donné à un autre type)
        if (distanceVillage >= A.distanceMiniVillage[type]) {
          points.push({ id: `e:${cx}:${cz}:${i}`, type, x, z, nuitSeulement: u >= cumul + jour });
        }
        break;
      }
      cumul += Math.max(jour, nuit);
    }
  }
  return points;
}

/** Vrai si l'identifiant est celui d'un point d'animal. */
export function estPointAnimal(id: string): boolean {
  return id.startsWith('a:');
}

/**
 * Points d'apparition des animaux d'un chunk : toujours les mêmes pour une même graine, tirés à part de ceux des
 * ennemis (qui ne bougent donc pas). Un point de cerf porte un groupe de 1 à 3 bêtes proches les unes des autres.
 */
export function pointsAnimauxDuChunk(graine: number, cx: number, cz: number, monde: MondeApparition): PointApparition[] {
  const A = CONFIG.apparitions;
  const N = A.animaux;
  const taille = CONFIG.monde.tailleChunk;
  const graineChunk = (graineDuChunk(graine, cx, cz) ^ 0x2545f491) >>> 0;
  const alea = creerAleatoire(graineChunk);
  const rayonInterdit = CONFIG.monde.village.rayon + A.margeVillage;
  const acceptable = (x: number, z: number): boolean =>
    Math.hypot(x, z) >= rayonInterdit &&
    monde.hauteur(x, z) >= monde.niveauEau + A.margeEau &&
    !(monde.pente && monde.pente(x, z) > A.penteMax);
  const points: PointApparition[] = [];
  for (let i = 0; i < N.candidatsParChunk; i++) {
    // Les trois tirages sont toujours faits, pour que chaque point reste indépendant des autres
    const x = (cx + alea.suivant()) * taille;
    const z = (cz + alea.suivant()) * taille;
    const u = alea.suivant();
    if (!acceptable(x, z)) continue;
    const chances = N.chances[monde.biome(x, z)];
    let cumul = 0;
    for (const type of TYPES_ANIMAL) {
      const jour = chances[type];
      const nuit = jour * N.facteurNuit[type];
      if (u < cumul + Math.max(jour, nuit)) {
        const nuitSeulement = u >= cumul + jour;
        const id = `a:${cx}:${cz}:${i}`;
        points.push({ id, type, x, z, nuitSeulement });
        // Compagnons du groupe : tirés d'une graine propre au point, autour de lui
        const groupe = creerAleatoire((graineChunk ^ Math.imul(i + 1, 0x9e3779b1)) >>> 0);
        const nombre = groupe.entier(N.groupe[type].min, N.groupe[type].max);
        for (let k = 1; k < nombre; k++) {
          const angle = groupe.entre(0, Math.PI * 2);
          const distance = groupe.entre(2, N.rayonGroupe);
          const gx = x + Math.sin(angle) * distance;
          const gz = z + Math.cos(angle) * distance;
          if (acceptable(gx, gz)) points.push({ id: `${id}:${k}`, type, x: gx, z: gz, nuitSeulement });
        }
        break;
      }
      cumul += Math.max(jour, nuit);
    }
  }
  return points;
}

/** Chunks dont une partie est à moins de `rayon` mètres de (x, z). */
export function chunksAutour(x: number, z: number, rayon: number): Array<{ cx: number; cz: number }> {
  const taille = CONFIG.monde.tailleChunk;
  const liste: Array<{ cx: number; cz: number }> = [];
  for (let cx = Math.floor((x - rayon) / taille); cx <= Math.floor((x + rayon) / taille); cx++) {
    for (let cz = Math.floor((z - rayon) / taille); cz <= Math.floor((z + rayon) / taille); cz++) {
      liste.push({ cx, cz });
    }
  }
  return liste;
}

/** Vrai si un ennemi tué à `instantMort` (temps de jeu) peut réapparaître ; jamais tué = oui. */
export function peutReapparaitre(instantMort: number | undefined, temps: number): boolean {
  return instantMort === undefined || temps - instantMort >= CONFIG.apparitions.delaiReapparition;
}

export interface DemandeApparition {
  points: readonly PointApparition[];
  /** Identifiants des ennemis présents */
  actifs: ReadonlySet<string>;
  /** Instant de mort (temps de jeu) de chaque ennemi tué */
  morts: Readonly<Record<string, number>>;
  joueur: { x: number; z: number };
  /** Temps de jeu, en secondes */
  temps: number;
  nuit: boolean;
}

/**
 * Points où faire apparaître un ennemi maintenant : libres, ni trop près ni trop loin du joueur,
 * délai de réapparition écoulé ; les plus proches d'abord, sans dépasser la limite d'ennemis présents.
 * Sert aussi aux animaux, avec leurs points, leurs présents et leur `limite` (`apparitions.animaux.limiteActifs`).
 */
export function choisirApparitions(d: DemandeApparition, limite: number = CONFIG.apparitions.limiteActifs): PointApparition[] {
  const A = CONFIG.apparitions;
  const places = Math.max(0, limite - d.actifs.size);
  if (places === 0) return [];
  const distance = (p: PointApparition) => Math.hypot(p.x - d.joueur.x, p.z - d.joueur.z);
  return d.points
    .filter((p) => {
      if (d.actifs.has(p.id)) return false;
      if (p.nuitSeulement && !d.nuit) return false;
      if (!peutReapparaitre(d.morts[p.id], d.temps)) return false;
      const dist = distance(p);
      return dist >= A.distanceMiniJoueur && dist <= A.distanceActivation;
    })
    .sort((a, b) => distance(a) - distance(b) || (a.id < b.id ? -1 : 1))
    .slice(0, places);
}

/** Retire de la liste des morts ceux dont le délai est écoulé (ils peuvent réapparaître). */
export function oublierMorts(morts: Readonly<Record<string, number>>, temps: number): Record<string, number> {
  const suite: Record<string, number> = {};
  for (const [id, instant] of Object.entries(morts)) {
    if (!peutReapparaitre(instant, temps)) suite[id] = instant;
  }
  return suite;
}
