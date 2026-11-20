// Ruines et petites grottes semées dans tout le monde (session 3b).
// Pur : aucun import de three, aucun Math.random(). Tout ne dépend que de la graine et de l'endroit : même graine =
// mêmes ruines, partout.
//
// Méthode : le monde est découpé en grandes cases (CONFIG.ruines.tailleCase). Chaque case porte au plus un site de
// ruines : une position est tirée dans la case, et le site n'existe que si le sol s'y prête (assez plat, hors de
// l'eau, loin du village et des lieux déjà occupés). Le site est un assemblage de 1 à 6 pièces (piecesRuines.ts),
// chacune avec ses morceaux manquants. Les grottes ont leurs propres cases : on y cherche un pied de falaise (sol
// plat devant, paroi qui monte d'un coup derrière) et on y adosse une alcôve de roche.
// Un site tient tout entier dans sa case : pour savoir ce qu'il y a en un point, une seule case suffit.

import { CONFIG } from '../config';
import { creerAleatoire, type Aleatoire } from '../regles/aleatoire';
import type { ObstacleCercle } from '../regles/deplacement';
import { hacher2D } from './bruit';
import { INFOS_DECOR, type ElementDecor } from './decor';
import { Chantier, construireGrotte, dallage, tirerPiece, TYPES_PIECES, type Bloc, type Repere, type TypePiece } from './piecesRuines';
import type { Terrain } from './terrain';

export interface CoffreSite {
  /** Identifiant stable (`co:` + celui du site) : c'est lui qui est sauvegardé une fois le coffre ouvert */
  id: string;
  x: number;
  y: number;
  z: number;
  /** Lacet : le devant du coffre regarde vers (sin, cos) */
  lacet: number;
}

export interface Site {
  /** Identifiant stable : `ru:i:j` (ruines) ou `gr:i:j` (grotte), d'après la case */
  id: string;
  genre: 'ruine' | 'grotte';
  /** Centre du site dans le monde ; y est l'altitude du sol au centre */
  x: number;
  y: number;
  z: number;
  /** Tout le site (blocs, collisions, emprises) tient dans ce rayon */
  rayon: number;
  /** Pièces assemblées (vide pour une grotte) */
  pieces: TypePiece[];
  /** Blocs à afficher, par rapport au centre du site */
  blocs: Bloc[];
  /** Cercles de collision, en coordonnées du monde */
  obstacles: ObstacleCercle[];
  /** Disques où le décor (arbres, rochers, herbes) ne pousse pas, en coordonnées du monde */
  emprises: ObstacleCercle[];
  coffre: CoffreSite | null;
  /** Cristaux bleus à récolter (grottes), identifiants `gc:i:j:k` */
  cristaux: ElementDecor[];
}

export interface GenerateurRuines {
  /** Sites dont le centre est dans le chunk (cx, cz). */
  sitesDuChunk(cx: number, cz: number): Site[];
  /** Sites qui touchent le disque de centre (x, z) et de rayon `rayon`. */
  sitesAutour(x: number, z: number, rayon: number): Site[];
  /** Cercles de collision à moins de `rayon` mètres de (x, z). */
  obstaclesAutour(x: number, z: number, rayon: number): ObstacleCercle[];
  /** Vrai si (x, z) est sous une pièce de ruine ou dans une grotte : le décor n'y pousse pas. */
  dansEmprise(x: number, z: number): boolean;
  /** Cristal de grotte d'après son identifiant `gc:i:j:k` (null s'il n'existe pas). */
  cristal(id: string): ElementDecor | null;
}

// Les 8 directions d'une grille, pour chercher les parois
const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
// Pas de la grille de recherche des parois, en mètres, et marge gardée au bord de la case (en pas)
const PAS_PAROI = 4;
const MARGE_PAROI = 5;
// Au-delà de ce nombre de cases en mémoire, on repart de zéro (le monde est sans fin)
const CASES_MAX = 600;

/** Tire un indice selon des poids. */
function tirerPoids(alea: Aleatoire, poids: readonly number[]): number {
  let total = 0;
  for (const p of poids) total += p;
  let u = alea.suivant() * total;
  for (let k = 0; k < poids.length; k++) {
    u -= poids[k];
    if (u < 0) return k;
  }
  return poids.length - 1;
}

/**
 * Crée le générateur de ruines et de grottes d'un terrain.
 * `zones` : disques déjà occupés (entrée de la mine, campement d'Aldric, camp des bandits, autel) ; aucun site à
 * moins de `CONFIG.ruines.margeLieux` de leur bord.
 */
export function creerGenerateurRuines(terrain: Terrain, zones: ReadonlyArray<{ x: number; z: number; rayon: number }> = []): GenerateurRuines {
  const R = CONFIG.ruines;
  const G = R.grottes;
  const chunk = CONFIG.monde.tailleChunk;
  const graine = terrain.graine;
  const eau = terrain.niveauEau + R.margeEau;
  const casesRuines = new Map<string, Site | null>();
  const casesGrottes = new Map<string, Site | null>();

  /** Vrai si un site centré en (x, z), de rayon `rayon`, reste loin du village et des lieux occupés. */
  function loinDesLieux(x: number, z: number, rayon: number): boolean {
    if (Math.hypot(x, z) < R.distanceMinVillage + rayon) return false;
    for (const o of [CONFIG.mine.origine, CONFIG.maison.origine]) {
      if (Math.hypot(x - o.x, z - o.z) < R.distanceZonesInterieures + rayon) return false;
    }
    for (const zone of zones) if (Math.hypot(x - zone.x, z - zone.z) < zone.rayon + R.margeLieux + rayon) return false;
    return true;
  }

  /** Termine un site : passe les collisions et les emprises en coordonnées du monde, calcule son rayon. */
  function terminer(base: Omit<Site, 'rayon' | 'blocs' | 'obstacles' | 'emprises'>, c: Chantier): Site {
    let rayon = 0;
    for (const b of c.blocs) rayon = Math.max(rayon, Math.hypot(b.x, b.z) + Math.max(b.lx, b.lz) * 0.75);
    for (const e of c.emprises) rayon = Math.max(rayon, Math.hypot(e.x, e.z) + e.rayon);
    const versMonde = (o: ObstacleCercle): ObstacleCercle => ({ x: base.x + o.x, z: base.z + o.z, rayon: o.rayon });
    return { ...base, rayon, blocs: c.blocs, obstacles: c.obstacles.map(versMonde), emprises: c.emprises.map(versMonde) };
  }

  /** Pose le coffre sur la première place libre (les places abritées d'abord), avec sa collision et son emprise. */
  function poserCoffre(c: Chantier, id: string, x0: number, y0: number, z0: number): CoffreSite | null {
    const places = [...c.coffres.filter((p) => p.abrite), ...c.coffres.filter((p) => !p.abrite)];
    for (const p of places) {
      if (c.obstacles.some((o) => Math.hypot(o.x - p.x, o.z - p.z) < o.rayon + R.coffre.rayon + 0.15)) continue;
      const y = terrain.hauteur(x0 + p.x, z0 + p.z);
      if (Math.abs(y - y0) > R.deniveleMax + 0.5 || y < eau) continue;
      c.obstacles.push({ x: p.x, z: p.z, rayon: R.coffre.rayon });
      c.emprises.push({ x: p.x, z: p.z, rayon: 1 });
      return { id: `co:${id}`, x: x0 + p.x, y, z: z0 + p.z, lacet: p.lacet };
    }
    return null;
  }

  // --- Ruines ---------------------------------------------------------------------------------

  /** Sol acceptable pour le centre d'un site : hors de l'eau, à peu près plat sur tout le rayon. */
  function solDeSite(x: number, z: number): number | null {
    const y = terrain.hauteur(x, z);
    if (y < eau) return null;
    for (const [d, tolerance] of [[5, R.deniveleMax * 0.7], [R.rayonSite - 2, R.deniveleMax * 1.4]] as const) {
      for (let k = 0; k < 8; k++) {
        const a = (k * Math.PI) / 4;
        const h = terrain.hauteur(x + Math.cos(a) * d, z + Math.sin(a) * d);
        if (h < eau || Math.abs(h - y) > tolerance) return null;
      }
    }
    return y;
  }

  /** Sol acceptable sous une pièce de rayon `rayon` (coordonnées du monde) : son altitude, ou null. */
  function solDePiece(x: number, z: number, rayon: number, ySite: number): number | null {
    const y = terrain.hauteur(x, z);
    if (y < eau || Math.abs(y - ySite) > R.deniveleMax) return null;
    for (let k = 0; k < 6; k++) {
      const a = (k * Math.PI) / 3;
      const h = terrain.hauteur(x + Math.cos(a) * rayon, z + Math.sin(a) * rayon);
      if (h < eau || Math.abs(h - y) > R.deniveleMaxPiece) return null;
    }
    return y;
  }

  function construireRuine(id: string, x: number, y: number, z: number, alea: Aleatoire): Site | null {
    const c = new Chantier(alea, (px, pz) => terrain.hauteur(x + px, z + pz) - y);
    const voulues = tirerPoids(alea, R.poidsNombrePieces) + 1;
    const poids = TYPES_PIECES.map((t) => R.poidsPieces[t]);
    // Les pièces s'alignent le plus souvent sur un même plan (le site a une orientation), parfois de travers
    const axe = alea.entre(0, Math.PI * 2);
    const posees: Array<{ x: number; z: number; rayon: number }> = [];
    const types: TypePiece[] = [];
    for (let n = 0; n < voulues; n++) {
      const piece = tirerPiece(TYPES_PIECES[tirerPoids(alea, poids)], alea);
      const libre = R.rayonSite - piece.rayon;
      if (libre < 0) continue;
      for (let essai = 0; essai < 14; essai++) {
        // La première pièce près du centre, les autres autour
        const d = n === 0 ? alea.entre(0, Math.min(2, libre)) : Math.sqrt(alea.suivant()) * libre;
        const a = alea.entre(0, Math.PI * 2);
        const px = Math.cos(a) * d;
        const pz = Math.sin(a) * d;
        if (posees.some((p) => Math.hypot(p.x - px, p.z - pz) < p.rayon + piece.rayon + 0.5)) continue;
        const py = solDePiece(x + px, z + pz, piece.rayon, y);
        if (py === null) continue;
        const lacet = alea.suivant() < 0.7 ? axe + (alea.entier(0, 3) * Math.PI) / 2 + alea.entre(-0.12, 0.12) : alea.entre(0, Math.PI * 2);
        const repere: Repere = { x: px, y: py - y, z: pz, lacet };
        piece.construire(c, repere);
        posees.push({ x: px, z: pz, rayon: piece.rayon });
        types.push(piece.type);
        break;
      }
    }
    if (types.length === 0) return null;
    // Dalles de l'ancien sol entre les pièces (plus il y a de pièces, plus il en reste)
    const etendue = Math.max(...posees.map((p) => Math.hypot(p.x, p.z) + p.rayon));
    dallage(c, { x: 0, y: 0, z: 0, lacet: 0 }, Math.min(R.rayonSite - 1.5, etendue), alea.entier(1, 3) * types.length);
    const coffre = types.length >= 2 && alea.suivant() < R.probabiliteCoffre ? poserCoffre(c, id, x, y, z) : null;
    return terminer({ id, genre: 'ruine', x, y, z, pieces: types, coffre, cristaux: [] }, c);
  }

  function caseRuine(i: number, j: number): Site | null {
    const cle = `${i}:${j}`;
    const connu = casesRuines.get(cle);
    if (connu !== undefined) return connu;
    let site: Site | null = null;
    const g = graine + 5501;
    if (hacher2D(i, j, g) < R.probabilite) {
      const T = R.tailleCase;
      const marge = (R.rayonSite + 1.5) / T;
      for (let essai = 0; essai < 8 && !site; essai++) {
        const x = (i + marge + hacher2D(i, j, g + 1 + essai * 2) * (1 - 2 * marge)) * T;
        const z = (j + marge + hacher2D(i, j, g + 2 + essai * 2) * (1 - 2 * marge)) * T;
        if (!loinDesLieux(x, z, R.rayonSite)) continue;
        const y = solDeSite(x, z);
        if (y === null) continue;
        // Pas à cheval sur une grotte
        if (grottesAutour(x, z, R.rayonSite + 4).length > 0) continue;
        site = construireRuine(`ru:${i}:${j}`, x, y, z, creerAleatoire(Math.floor(hacher2D(i, j, g + 97 + essai) * 4294967296)));
      }
    }
    if (casesRuines.size >= CASES_MAX) casesRuines.clear();
    casesRuines.set(cle, site);
    return site;
  }

  // --- Grottes --------------------------------------------------------------------------------

  /**
   * Adosse une grotte à la paroi trouvée en partant de (x0, z0) dans la direction (dx, dz) (longueur 1).
   * Null si le sol devant n'est pas assez plat ou si la paroi n'est pas assez large.
   */
  function construireGrotteEn(id: string, i: number, j: number, x0: number, z0: number, dx: number, dz: number, alea: Aleatoire): Site | null {
    const base = terrain.hauteur(x0, z0);
    // On avance jusqu'au pied de la paroi : là où le sol commence à monter franchement
    let t = 0;
    while (t <= 7 && terrain.hauteur(x0 + dx * (t + 0.25), z0 + dz * (t + 0.25)) < base + 0.7) t += 0.25;
    if (t > 7) return null;
    const P = alea.entre(G.profondeurMin, G.profondeurMax);
    const w = alea.entre(G.demiLargeurMin, G.demiLargeurMax);
    const H = alea.entre(G.hauteurMin, G.hauteurMax);
    // Origine : le milieu de l'entrée ; u vers la paroi, v de côté
    const ox = x0 + dx * (t - P);
    const oz = z0 + dz * (t - P);
    const y = terrain.hauteur(ox, oz);
    if (y < eau) return null;
    const hauteurEn = (u: number, v: number) => terrain.hauteur(ox + dx * u + dz * v, oz + dz * u - dx * v);
    for (let u = -3; u <= P - 0.4; u += 0.8) {
      for (const v of [-w, 0, w]) {
        const h = hauteurEn(u, v);
        if (h < eau || Math.abs(h - y) > 0.85) return null;
      }
    }
    // La paroi doit monter sur toute la largeur, sinon l'alcôve dépasserait dans le vide
    for (const v of [-w - 1.5, 0, w + 1.5]) if (hauteurEn(P + 3.5, v) - y < G.hauteurParoiMin - 1) return null;
    const cx = ox + dx * (P / 2);
    const cz = oz + dz * (P / 2);
    if (!loinDesLieux(cx, cz, P + w)) return null;

    const c = new Chantier(alea, (px, pz) => terrain.hauteur(cx + px, cz + pz) - y);
    const repere: Repere = { x: ox - cx, y: 0, z: oz - cz, lacet: Math.atan2(dx, dz) };
    const places = construireGrotte(c, repere, { profondeur: P, demiLargeur: w, hauteur: H, charpente: alea.suivant() < G.probabiliteCharpente }, alea.entier(G.cristauxMin, G.cristauxMax));
    const infos = INFOS_DECOR['cristal-bleu'];
    const cristaux: ElementDecor[] = places.map((p, k) => {
      const echelle = alea.entre(infos.echelleMin, infos.echelleMax);
      return {
        id: `gc:${i}:${j}:${k}`,
        type: 'cristal-bleu',
        x: cx + p.x,
        y: terrain.hauteur(cx + p.x, cz + p.z) - infos.enfoncement * echelle,
        z: cz + p.z,
        rotation: alea.entre(0, Math.PI * 2),
        echelle,
        variante: alea.entier(0, infos.variantes - 1),
        teinte: alea.suivant(),
        rayonCollision: infos.rayonCollision * echelle,
      };
    });
    const coffre = alea.suivant() < G.probabiliteCoffre ? poserCoffre(c, id, cx, y, cz) : null;
    return terminer({ id, genre: 'grotte', x: cx, y, z: cz, pieces: [], coffre, cristaux }, c);
  }

  function caseGrotte(i: number, j: number): Site | null {
    const cle = `${i}:${j}`;
    const connu = casesGrottes.get(cle);
    if (connu !== undefined) return connu;
    let site: Site | null = null;
    const g = graine + 6607;
    if (hacher2D(i, j, g) < G.probabilite) {
      // Altitudes de la case sur une grille de 4 m (les sommets du maillage : hauteurBrute y vaut hauteur)
      const T = G.tailleCase;
      const n = Math.round(T / PAS_PAROI) + 1;
      const h = new Float32Array(n * n);
      for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) h[b * n + a] = terrain.hauteurBrute(i * T + a * PAS_PAROI, j * T + b * PAS_PAROI);
      // Pieds de paroi : sol plat derrière soi et sur les côtés, montée brusque devant
      const candidats: number[] = [];
      for (let b = MARGE_PAROI; b < n - MARGE_PAROI; b++) {
        for (let a = MARGE_PAROI; a < n - MARGE_PAROI; a++) {
          const y = h[b * n + a];
          if (y < eau) continue;
          for (let d = 0; d < 8; d++) {
            const [da, db] = DIRECTIONS[d];
            const en = (ka: number, kb: number) => h[(b + kb) * n + a + ka] - y;
            if (en(da, db) < G.hauteurParoiMin || en(2 * da, 2 * db) < G.hauteurParoiMin) continue;
            if (Math.abs(en(-da, -db)) > 1 || Math.abs(en(-2 * da, -2 * db)) > 1.8) continue;
            if (Math.abs(en(-db, da)) > 1.3 || Math.abs(en(db, -da)) > 1.3) continue;
            candidats.push((b * n + a) * 8 + d);
          }
        }
      }
      const alea = creerAleatoire(Math.floor(hacher2D(i, j, g + 1) * 4294967296));
      for (let essai = 0; essai < 6 && candidats.length > 0 && !site; essai++) {
        const k = alea.entier(0, candidats.length - 1);
        const code = candidats[k];
        candidats.splice(k, 1);
        const d = code % 8;
        const a = Math.floor(code / 8) % n;
        const b = Math.floor(code / 8 / n);
        const [da, db] = DIRECTIONS[d];
        const l = Math.hypot(da, db);
        site = construireGrotteEn(`gr:${i}:${j}`, i, j, i * T + a * PAS_PAROI, j * T + b * PAS_PAROI, da / l, db / l, alea);
      }
    }
    if (casesGrottes.size >= CASES_MAX) casesGrottes.clear();
    casesGrottes.set(cle, site);
    return site;
  }

  // --- Recherches -----------------------------------------------------------------------------

  /** Appelle `visiter` pour le site de chaque case (d'une des deux grilles) qui touche le carré donné. */
  function parcourir(taille: number, lire: (i: number, j: number) => Site | null, x0: number, z0: number, x1: number, z1: number, visiter: (s: Site) => void): void {
    const i1 = Math.floor(x1 / taille);
    const j1 = Math.floor(z1 / taille);
    for (let j = Math.floor(z0 / taille); j <= j1; j++) {
      for (let i = Math.floor(x0 / taille); i <= i1; i++) {
        const s = lire(i, j);
        if (s) visiter(s);
      }
    }
  }

  function grottesAutour(x: number, z: number, rayon: number): Site[] {
    const liste: Site[] = [];
    parcourir(G.tailleCase, caseGrotte, x - rayon, z - rayon, x + rayon, z + rayon, (s) => {
      if (Math.hypot(s.x - x, s.z - z) <= rayon + s.rayon) liste.push(s);
    });
    return liste;
  }

  function sitesAutour(x: number, z: number, rayon: number): Site[] {
    const liste = grottesAutour(x, z, rayon);
    parcourir(R.tailleCase, caseRuine, x - rayon, z - rayon, x + rayon, z + rayon, (s) => {
      if (Math.hypot(s.x - x, s.z - z) <= rayon + s.rayon) liste.push(s);
    });
    return liste;
  }

  function sitesDuChunk(cx: number, cz: number): Site[] {
    const x0 = cx * chunk;
    const z0 = cz * chunk;
    const liste: Site[] = [];
    const dedans = (s: Site) => {
      if (s.x >= x0 && s.x < x0 + chunk && s.z >= z0 && s.z < z0 + chunk) liste.push(s);
    };
    // (borne haute juste sous le bord : un chunk ne lit pas la case voisine pour rien)
    parcourir(R.tailleCase, caseRuine, x0, z0, x0 + chunk - 1e-6, z0 + chunk - 1e-6, dedans);
    parcourir(G.tailleCase, caseGrotte, x0, z0, x0 + chunk - 1e-6, z0 + chunk - 1e-6, dedans);
    return liste;
  }

  function obstaclesAutour(x: number, z: number, rayon: number): ObstacleCercle[] {
    const obstacles: ObstacleCercle[] = [];
    for (const s of sitesAutour(x, z, rayon)) {
      for (const o of s.obstacles) {
        const portee = rayon + o.rayon;
        if ((o.x - x) ** 2 + (o.z - z) ** 2 <= portee * portee) obstacles.push(o);
      }
    }
    return obstacles;
  }

  function dansEmprise(x: number, z: number): boolean {
    for (const s of sitesAutour(x, z, 0)) {
      for (const e of s.emprises) if ((e.x - x) ** 2 + (e.z - z) ** 2 < e.rayon * e.rayon) return true;
    }
    return false;
  }

  function cristal(id: string): ElementDecor | null {
    const m = /^gc:(-?\d+):(-?\d+):(\d+)$/.exec(id);
    if (!m) return null;
    return caseGrotte(Number(m[1]), Number(m[2]))?.cristaux[Number(m[3])] ?? null;
  }

  return { sitesDuChunk, sitesAutour, obstaclesAutour, dansEmprise, cristal };
}
