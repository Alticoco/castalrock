// Emplacement de l'entrée de la mine : un pied de falaise ou de pente raide, pas trop loin du
// village, qu'on atteint à pied sans traverser l'eau. Pur : aucun import de three, aucun
// Math.random(). La recherche ne dépend que du terrain, donc de la graine.
//
// Méthode : on relève les altitudes sur une grille de 4 m autour du village, on marque les
// cases atteignables à pied depuis la place (pas d'eau, pas de marche trop haute), puis on
// garde la case atteignable dont le terrain monte le plus vite dans une direction, avec du
// plat devant. Le terrain est ensuite retouché : un replat devant le portail.

import { CONFIG } from '../config';
import { contientZoneMine, creerPlanMine, type PlanMine } from '../mine/plan';
import { contientZoneMaison } from '../maison/plan';
import { lisser, melanger } from './bruit';
import { creerTerrain, retoucheReplats, type Terrain } from './terrain';
import { casesAtteignables, chercherLieux, replatsLieux, type Lieux } from '../regles/lieux';

export interface EntreeMine {
  /** Seuil du portail : milieu de l'ouverture, au pied de la paroi */
  x: number;
  z: number;
  /** Altitude du replat devant le portail */
  y: number;
  /** Direction horizontale (longueur 1) qui entre dans la paroi */
  dx: number;
  dz: number;
  /** Hauteur dont le terrain monte derrière le portail, en mètres */
  denivele: number;
}

const PAS = 4;
const DEMI = 60;
const N = DEMI * 2 + 1;
const DIRECTIONS: ReadonlyArray<[number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];

/** Cherche l'entrée de la mine sur un terrain (non retouché). Toujours la même pour une même graine. */
export function chercherEntreeMine(terrain: Terrain): EntreeMine {
  const E = CONFIG.mine.entree;
  const h = new Float32Array(N * N);
  for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) h[b * N + a] = terrain.hauteurBrute((a - DEMI) * PAS, (b - DEMI) * PAS);

  // Cases atteignables à pied depuis la place du village
  const marcheMax = PAS * Math.tan((E.penteMarcheDegres * Math.PI) / 180);
  const sec = terrain.niveauEau + 0.3;
  const atteint = casesAtteignables(h, N, sec, marcheMax);

  // Meilleure case : le terrain monte vite devant, il est plat derrière et sur les côtés
  let meilleur: { a: number; b: number; k: number; score: number; montee: number } | null = null;
  for (let b = 3; b < N - 3; b++) {
    for (let a = 3; a < N - 3; a++) {
      const c = b * N + a;
      if (!atteint[c] || h[c] < terrain.niveauEau + 1) continue;
      const r = Math.hypot(a - DEMI, b - DEMI) * PAS;
      if (r < E.distanceMin || r > E.distanceMax) continue;
      for (let k = 0; k < DIRECTIONS.length; k++) {
        const [sa, sb] = DIRECTIONS[k];
        const montee1 = h[(b + sb) * N + a + sa] - h[c];
        const montee2 = h[(b + 2 * sb) * N + a + 2 * sa] - h[c];
        if (montee2 < 0.5 || montee1 < 0.25) continue;
        const arriere = (b - sb) * N + a - sa;
        if (!atteint[arriere]) continue;
        // Plat devant le portail : la case d'où l'on vient et les deux cases de côté
        const ecart = Math.max(
          Math.abs(h[arriere] - h[c]),
          Math.abs(h[(b + sa) * N + a - sb] - h[c]),
          Math.abs(h[(b - sa) * N + a + sb] - h[c]),
        );
        const score = Math.min(montee2, 11) + Math.min(montee1, 8) * 0.5 - 2 * ecart - Math.abs(r - E.distanceIdeale) / 50;
        if (!meilleur || score > meilleur.score) meilleur = { a, b, k, score, montee: montee2 };
      }
    }
  }

  // Aucune pente trouvée (terrain plat ou enclavé) : un point fixe, au sud du village
  if (!meilleur) {
    const z = E.distanceIdeale;
    return { x: 0, z, y: terrain.hauteurBrute(0, z - 2), dx: 0, dz: 1, denivele: 0 };
  }

  const [sa, sb] = DIRECTIONS[meilleur.k];
  const l = Math.hypot(sa, sb);
  const dx = sa / l;
  const dz = sb / l;
  const px = (meilleur.a - DEMI) * PAS;
  const pz = (meilleur.b - DEMI) * PAS;
  // On avance vers la paroi jusqu'à l'endroit où le sol commence à monter franchement
  const base = h[meilleur.b * N + meilleur.a];
  let t = 0;
  while (t < 2 * PAS * l && terrain.hauteurBrute(px + dx * (t + 0.5), pz + dz * (t + 0.5)) < base + 1.2) t += 0.5;
  const x = px + dx * t;
  const z = pz + dz * t;
  return { x, z, y: terrain.hauteurBrute(x - dx * 1.5, z - dz * 1.5), dx, dz, denivele: meilleur.montee };
}

/** Zone autour du portail où le décor généré (arbres, rochers, herbes) est retiré : centre et rayon. */
export function zoneLibreEntree(e: EntreeMine): { x: number; z: number; rayon: number } {
  return { x: e.x - e.dx * 2, z: e.z - e.dz * 2, rayon: CONFIG.mine.entree.rayonSansDecor };
}

/**
 * Retouche du terrain : replat devant et sous le portail (le reste du monde ne change pas),
 * et sol plat dans la zone lointaine où se trouve l'intérieur de la mine.
 */
export function retoucheMine(e: EntreeMine): (x: number, z: number, h: number) => number {
  const altitudeMine = CONFIG.mine.altitude;
  return (x, z, h) => {
    const rx = x - e.x;
    const rz = z - e.z;
    if (Math.abs(rx) > 16 || Math.abs(rz) > 16) {
      // Zones intérieures (mine, maison du joueur) : sol plat
      if (contientZoneMaison(x, z)) return CONFIG.maison.altitude;
      return contientZoneMine(x, z) ? altitudeMine : h;
    }
    // u : vers la paroi ; v : de côté
    const u = rx * e.dx + rz * e.dz;
    const v = rx * e.dz - rz * e.dx;
    const poids = (1 - lisser(3.5, 7.5, Math.abs(v))) * (1 - lisser(3.5, 6, u)) * (1 - lisser(5, 10, -u));
    return poids <= 0 ? h : melanger(h, e.y, poids);
  };
}

/**
 * Terrain du jeu : celui de la graine, avec l'entrée de la mine et sa zone intérieure, et les replats des lieux de
 * l'histoire (camp des bandits, autel du Cœur), cherchés loin de la mine et du campement d'Aldric.
 */
export function creerTerrainAvecMine(graine: number): { terrain: Terrain; entree: EntreeMine; plan: PlanMine; lieux: Lieux } {
  const brut = creerTerrain(graine);
  const entree = chercherEntreeMine(brut);
  const lieux = chercherLieux(brut, [entree, CONFIG.habitants.aldric]);
  const mine = retoucheMine(entree);
  const replats = retoucheReplats(replatsLieux(lieux));
  return { terrain: creerTerrain(graine, (x, z, h) => replats(x, z, mine(x, z, h))), entree, plan: creerPlanMine(graine), lieux };
}
