// Terrain du monde : altitude, pente, biomes et eau en tout point, à partir d'une graine.
// Pur : aucun import de three, aucun Math.random(). Méthode reprise d'un projet précédent.
//
// Le relief est la somme de plusieurs couches :
// 1. chaque biome a son relief (collines douces, montagnes en bruit « crête », marais bas),
//    mélangés selon les poids des biomes pour des transitions douces ;
// 2. des falaises : marches brusques le long de lignes sinueuses, dans certaines zones ;
// 3. des rivières : vallées creusées là où un bruit passe par zéro (bruit « crête ») ;
// 4. des lacs : cuvettes là où un autre bruit est haut ;
// 5. le village : disque aplani autour de l'origine, avec un raccord progressif.
// Les lieux de l'histoire (camp des bandits, ruines de la forteresse de Castalrock) sont aplanis de la même façon par `retoucheReplats`, en retouche.

import { CONFIG } from '../config';
import { BIOMES, INDICE_BIOME, type Biome } from './biomes';
import { creerBruit2D, fbm, fbmCrete, lisser, melanger } from './bruit';

export interface Vecteur3 {
  x: number;
  y: number;
  z: number;
}

export interface Terrain {
  readonly graine: number;
  /** Altitude de la surface de l'eau, en mètres */
  readonly niveauEau: number;
  /** Altitude du sol du village (disque aplani autour de l'origine) */
  readonly altitudeVillage: number;
  /**
   * Altitude du sol en mètres, exactement celle du maillage affiché
   * (interpolée sur les triangles de la grille). Peut être sous l'eau.
   */
  hauteur(x: number, z: number): number;
  /** Altitude « continue » du bruit ; égale à hauteur() aux sommets de la grille. */
  hauteurBrute(x: number, z: number): number;
  /** Normale (unitaire, vers le haut) du triangle de sol sous (x, z). */
  normale(x: number, z: number): Vecteur3;
  /** Pente du sol : 0 = plat, 1 = vertical (angle avec l'horizontale divisé par 90°). */
  pente(x: number, z: number): number;
  /**
   * Poids de chaque biome (dans l'ordre de BIOMES), de somme 1.
   * `sortie` permet de réutiliser un tableau et d'éviter une allocation.
   */
  poidsBiomes(x: number, z: number, sortie?: number[]): number[];
  /** Biome de plus grand poids en (x, z). */
  biomeDominant(x: number, z: number): Biome;
  /** Vrai si le sol en (x, z) est sous la surface de l'eau. */
  estSousEau(x: number, z: number): boolean;
}

const NB = BIOMES.length;
const I_PRAIRIE = INDICE_BIOME.prairie;
const I_FORET = INDICE_BIOME.foret;
const I_MONTAGNE = INDICE_BIOME.montagne;

/** Crée le terrain d'une graine. Même graine = même terrain, partout. */
export function creerTerrain(
  graine: number,
  /** Retouche locale de l'altitude (replat de l'entrée de la mine) : reçoit l'altitude calculée, renvoie la nouvelle */
  retouche?: (x: number, z: number, h: number) => number,
): Terrain {
  const R = CONFIG.monde.relief;
  const V = CONFIG.monde.village;
  const niveauEau = CONFIG.monde.niveauEau;
  const pas = CONFIG.monde.pasGrille;

  // Un bruit indépendant par couche (graines dérivées)
  const bClimatA = creerBruit2D(graine + 11);
  const bClimatB = creerBruit2D(graine + 12);
  const bCollines = creerBruit2D(graine + 21);
  const bDetail = creerBruit2D(graine + 22);
  const bMontagnes = creerBruit2D(graine + 31);
  const bFalaises = creerBruit2D(graine + 41);
  const bMasqueFalaises = creerBruit2D(graine + 42);
  const bRivieres = creerBruit2D(graine + 51);
  const bMasqueRivieres = creerBruit2D(graine + 52);
  const bMeandreX = creerBruit2D(graine + 53);
  const bMeandreZ = creerBruit2D(graine + 54);
  const bLacs = creerBruit2D(graine + 61);

  // Tableau de poids réutilisé par hauteurBrute (évite une allocation par appel)
  const poidsInterne: number[] = new Array(NB).fill(0);

  /**
   * Poids des biomes à partir de la carte des climats. `etalement` règle la largeur
   * des transitions : étroites pour l'identité du biome (couleurs, décor),
   * larges pour mélanger le relief (sinon chaque frontière ferait une marche).
   */
  function calculerPoids(x: number, z: number, etalement: number, sortie: number[]): number[] {
    const fc = R.frequenceClimat;
    const rudesse = fbm(bClimatA, x * fc, z * fc, 2) * 1.6;
    const humidite = fbm(bClimatB, x * fc + 71.3, z * fc - 37.9, 2) * 1.6;
    let somme = 0;
    for (let i = 0; i < NB; i++) {
      const c = BIOMES[i].climat;
      const da = rudesse - c.rudesse;
      const dh = humidite - c.humidite;
      const v = Math.exp(-(da * da + dh * dh) / etalement) + 1e-9;
      sortie[i] = v;
      somme += v;
    }
    // Autour du village, la prairie est imposée puis s'efface progressivement
    const d = Math.hypot(x, z);
    const k = lisser(V.rayon, V.zonePrairie, d);
    for (let i = 0; i < NB; i++) {
      sortie[i] = (sortie[i] / somme) * k + (i === I_PRAIRIE ? 1 - k : 0);
    }
    return sortie;
  }

  function poidsBiomes(x: number, z: number, sortie: number[] = new Array(NB).fill(0)): number[] {
    return calculerPoids(x, z, R.etalementBiomes, sortie);
  }

  function hauteurBrute(x: number, z: number): number {
    const w = calculerPoids(x, z, R.etalementRelief, poidsInterne);
    const d = Math.hypot(x, z);
    // 0 près du village, 1 loin : y empêche rivières, lacs et falaises
    const protection = lisser(V.rayon + V.raccord, V.rayon + V.raccord + V.zoneProtegee, d);

    // 1. Relief de chaque biome, mélangé selon des poids aux transitions larges
    const collines = fbm(bCollines, x * R.frequenceCollines, z * R.frequenceCollines, 4);
    const detail = fbm(bDetail, x * R.frequenceDetail, z * R.frequenceDetail, 2);
    let h = 0;
    for (let i = 0; i < NB; i++) {
      if (w[i] < 1e-4) continue;
      const r = BIOMES[i].relief;
      let hi = r.base + collines * r.collines + detail * r.detail;
      if (i === I_MONTAGNE) {
        // Chaînes de montagnes : crêtes nettes, sommets entre 50 et 120 m environ
        const crete = fbmCrete(bMontagnes, x * R.frequenceMontagnes, z * R.frequenceMontagnes, R.octavesMontagnes);
        hi += Math.pow(crete, R.formeMontagnes) * R.hauteurMontagnes;
      }
      h += w[i] * hi;
    }

    // 2. Falaises : une marche de quelques mètres le long d'une ligne sinueuse,
    //    seulement dans certaines zones (on peut donc les contourner)
    const masqueF =
      lisser(0.05, 0.25, fbm(bMasqueFalaises, x * 0.0035, z * 0.0035, 2)) *
      (w[I_PRAIRIE] + w[I_FORET]) *
      protection;
    if (masqueF > 0.001) {
      const ligne = fbm(bFalaises, x * R.frequenceFalaises, z * R.frequenceFalaises, 2);
      h += lisser(-R.raideurFalaise, R.raideurFalaise, ligne) * R.hauteurFalaise * masqueF;
    }

    // 3. Rivières : là où le bruit passe par zéro, on creuse une vallée puis un lit sous l'eau.
    //    Un masque les interrompt (gués, vallées sèches) ; peu de rivières en montagne.
    const masqueR =
      lisser(-0.25, 0.05, fbm(bMasqueRivieres, x * 0.0015, z * 0.0015, 2)) *
      protection *
      (1 - 0.85 * w[I_MONTAGNE]);
    if (masqueR > 0.001) {
      const mx = x + fbm(bMeandreX, x * 0.008, z * 0.008, 2) * 30;
      const mz = z + fbm(bMeandreZ, x * 0.008, z * 0.008, 2) * 30;
      const axe = Math.abs(fbm(bRivieres, mx * R.frequenceRivieres, mz * R.frequenceRivieres, 2));
      const vallee = (1 - lisser(0, R.largeurVallee, axe)) * masqueR;
      h = Math.min(h, melanger(h, niveauEau + 1.5, vallee));
      const lit = (1 - lisser(0, R.largeurLit, axe)) * masqueR;
      h = Math.min(h, melanger(h, niveauEau - R.profondeurRiviere, lit));
    }

    // 4. Lacs : cuvettes sous le niveau de l'eau (pas en montagne)
    const lac = lisser(R.seuilLacs, R.seuilLacs + 0.15, fbm(bLacs, x * R.frequenceLacs, z * R.frequenceLacs, 2));
    const k = lac * protection * (1 - w[I_MONTAGNE]);
    if (k > 0.001) h = Math.min(h, melanger(h, niveauEau - R.profondeurLacs, k));

    // 5. Village : disque plat, raccord progressif vers le terrain autour
    const kv = lisser(V.rayon, V.rayon + V.raccord, d);
    const altitude = V.altitude + (h - V.altitude) * kv;
    return retouche ? retouche(x, z, altitude) : altitude;
  }

  // Petit cache : les 4 coins de la dernière case de grille demandée
  // (le personnage interroge souvent hauteur, normale et pente au même endroit)
  let caseX = NaN;
  let caseZ = NaN;
  let h00 = 0;
  let h10 = 0;
  let h01 = 0;
  let h11 = 0;

  function chargerCase(ix: number, iz: number): void {
    if (ix === caseX && iz === caseZ) return;
    caseX = ix;
    caseZ = iz;
    h00 = hauteurBrute(ix * pas, iz * pas);
    h10 = hauteurBrute((ix + 1) * pas, iz * pas);
    h01 = hauteurBrute(ix * pas, (iz + 1) * pas);
    h11 = hauteurBrute((ix + 1) * pas, (iz + 1) * pas);
  }

  // Même découpage en triangles que maillage.ts :
  // triangle A (fx >= fz) = coins 00, 11, 10 ; triangle B = coins 00, 01, 11.
  function hauteur(x: number, z: number): number {
    const gx = x / pas;
    const gz = z / pas;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    chargerCase(ix, iz);
    const fx = gx - ix;
    const fz = gz - iz;
    if (fx >= fz) return h00 + (h10 - h00) * fx + (h11 - h10) * fz;
    return h00 + (h11 - h01) * fx + (h01 - h00) * fz;
  }

  function normale(x: number, z: number): Vecteur3 {
    const gx = x / pas;
    const gz = z / pas;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    chargerCase(ix, iz);
    let dhdx: number;
    let dhdz: number;
    if (gx - ix >= gz - iz) {
      dhdx = (h10 - h00) / pas;
      dhdz = (h11 - h10) / pas;
    } else {
      dhdx = (h11 - h01) / pas;
      dhdz = (h01 - h00) / pas;
    }
    const l = Math.sqrt(dhdx * dhdx + 1 + dhdz * dhdz);
    return { x: -dhdx / l, y: 1 / l, z: -dhdz / l };
  }

  function pente(x: number, z: number): number {
    const ny = normale(x, z).y;
    return Math.acos(Math.min(1, ny)) / (Math.PI / 2);
  }

  function biomeDominant(x: number, z: number): Biome {
    const w = poidsBiomes(x, z);
    let meilleur = 0;
    for (let i = 1; i < NB; i++) if (w[i] > w[meilleur]) meilleur = i;
    return BIOMES[meilleur];
  }

  return {
    graine,
    niveauEau,
    altitudeVillage: V.altitude,
    hauteur,
    hauteurBrute,
    normale,
    pente,
    poidsBiomes: (x, z, sortie) => poidsBiomes(x, z, sortie),
    biomeDominant,
    estSousEau: (x, z) => hauteur(x, z) < niveauEau,
  };
}

/** Un replat : disque aplani à `altitude`, raccordé au terrain autour sur `raccord` mètres (comme le village). */
export interface Replat {
  x: number;
  z: number;
  altitude: number;
  rayon: number;
  raccord: number;
}

/**
 * Retouche qui aplanit le terrain autour de quelques lieux (camp des bandits, grand replat de la forteresse de Castalrock) : à passer à `creerTerrain`.
 * Hors des replats et de leur raccord, l'altitude n'est pas touchée.
 */
export function retoucheReplats(replats: readonly Replat[]): (x: number, z: number, h: number) => number {
  return (x, z, h) => {
    let altitude = h;
    for (const r of replats) {
      const limite = r.rayon + r.raccord;
      const dx = x - r.x;
      const dz = z - r.z;
      if (Math.abs(dx) > limite || Math.abs(dz) > limite) continue;
      const k = lisser(r.rayon, limite, Math.hypot(dx, dz));
      altitude = r.altitude + (altitude - r.altitude) * k;
    }
    return altitude;
  };
}
