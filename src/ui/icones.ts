// Icônes des objets (inventaire, barre d'outils, fabrication, marchand…) : petits SVG en ligne de 48 × 48.
// Style commun : low poly à facettes plates (clair, moyen, ombre), contour sombre régulier tout autour de la
// silhouette, lumière venant d'en haut à gauche, armes et outils en diagonale (pointe vers le haut à droite).
// Les outils (épée, hache, pioche) ont un dessin par palier : bois, cuivre, fer, acier, cristal.
// Aucune règle de jeu ici : ce module ne fait que dessiner.

import { NIVEAUX_OUTIL, OUTILS, type NiveauOutil } from '../regles/equipement';
import type { OutilRecolte } from '../regles/recolte';

// ---- Outils de dessin ----

/** Couleur du contour de toutes les icônes. */
const CONTOUR = '#17120e';
/** Épaisseur du trait de contour (la moitié dépasse de la silhouette). */
const TRAIT = 2.3;

/** Une facette : points du polygone (« x,y x,y … ») et couleur. */
type Facette = readonly [string, string];

/** Quatre tons d'une matière, du plus éclairé au plus sombre. */
interface Teintes {
  readonly reflet: string;
  readonly clair: string;
  readonly moyen: string;
  readonly ombre: string;
}

type Point = readonly [number, number];

function arrondi(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Liste de points au format SVG. */
function pts(points: readonly Point[]): string {
  return points.map(([x, y]) => `${arrondi(x)},${arrondi(y)}`).join(' ');
}

/** Symétrique gauche-droite (autour de x = 24) d'une liste de points SVG. */
function miroir(points: string): string {
  return points
    .split(' ')
    .map((p) => {
      const [x, y] = p.split(',').map(Number);
      return `${arrondi(48 - x)},${y}`;
    })
    .join(' ');
}

/** Rectangle (x1, y1) – (x2, y2) en points SVG. */
function rect(x1: number, y1: number, x2: number, y2: number): string {
  return `${x1},${y1} ${x2},${y1} ${x2},${y2} ${x1},${y2}`;
}

/** Polygone régulier (centre, rayon, nombre de côtés, angle de départ en degrés). */
function polygone(cx: number, cy: number, r: number, cotes: number, depart = 0): Point[] {
  const liste: Point[] = [];
  for (let i = 0; i < cotes; i++) {
    const a = ((depart + (360 * i) / cotes) * Math.PI) / 180;
    liste.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return liste;
}

/**
 * Ruban le long d'une courbe de Bézier quadratique (p0 → p2, tirée vers p1), d'épaisseur `e0` au départ et `e1` au bout :
 * renvoie ses deux bords (« dessus » à gauche du sens de marche, « dessous » à droite).
 */
function ruban(p0: Point, p1: Point, p2: Point, e0: number, e1: number, etapes = 6): { dessus: Point[]; dessous: Point[] } {
  const dessus: Point[] = [];
  const dessous: Point[] = [];
  for (let i = 0; i <= etapes; i++) {
    const t = i / etapes;
    const px = (1 - t) * (1 - t) * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0];
    const py = (1 - t) * (1 - t) * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1];
    // Tangente, pour placer l'épaisseur à angle droit
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]);
    const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]);
    const l = Math.hypot(dx, dy) || 1;
    const e = (e0 + (e1 - e0) * t) / 2;
    const nx = -dy / l;
    const ny = dx / l;
    dessus.push([px - nx * e, py - ny * e]);
    dessous.push([px + nx * e, py + ny * e]);
  }
  return { dessus, dessous };
}

/** Ligne brisée passant par des points (pour l'attribut `d` d'un chemin). */
function chemin(points: readonly Point[]): string {
  return 'M' + points.map(([x, y]) => `${arrondi(x)} ${arrondi(y)}`).join(' L');
}

/**
 * Une pièce : sa silhouette cernée de sombre (le contour suit l'union de toutes ses facettes), puis ses facettes.
 * Les facettes ont un mince trait de leur propre couleur pour cacher les jointures entre elles.
 */
function piece(facettes: readonly Facette[], contour = CONTOUR, trait = TRAIT): string {
  const formes = facettes.map(([p]) => `<polygon points="${p}"/>`).join('');
  const silhouette = `<g fill="${contour}" stroke="${contour}" stroke-width="${trait}" stroke-linejoin="round">${formes}</g>`;
  const couleurs = facettes
    .map(([p, c]) => `<polygon points="${p}" fill="${c}" stroke="${c}" stroke-width="0.35" stroke-linejoin="round"/>`)
    .join('');
  return silhouette + couleurs;
}

/** Halo lumineux et transparent autour de formes (cristal) : à dessiner avant les pièces. */
function halo(formes: readonly string[], couleur: string, largeur = 6): string {
  const polys = formes.map((p) => `<polygon points="${p}"/>`).join('');
  return (
    `<g fill="${couleur}" stroke="${couleur}" stroke-width="${largeur}" stroke-linejoin="round" opacity="0.22">${polys}</g>` +
    `<g fill="${couleur}" stroke="${couleur}" stroke-width="${largeur / 2}" stroke-linejoin="round" opacity="0.3">${polys}</g>`
  );
}

/** Trait simple, sans contour (veinures, reflets, coutures). */
function ligne(d: string, couleur: string, largeur: number, opacite = 1): string {
  const o = opacite < 1 ? ` opacity="${opacite}"` : '';
  return `<path d="${d}" fill="none" stroke="${couleur}" stroke-width="${largeur}" stroke-linecap="round" stroke-linejoin="round"${o}/>`;
}

/** Trait cerné de sombre (corde, ficelle, bâton fin). */
function cordon(d: string, couleur: string, largeur: number, contour = CONTOUR): string {
  return ligne(d, contour, largeur + TRAIT * 0.85) + ligne(d, couleur, largeur);
}

/** Petit rivet rond. */
function rivet(x: number, y: number, couleur: string, r = 0.75): string {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${couleur}" stroke="${CONTOUR}" stroke-width="0.45"/>`;
}

/** Bloc éclairé d'en haut à gauche : face claire, arête gauche en reflet, côté droit moyen, dessous sombre. */
function bloc(x1: number, y1: number, x2: number, y2: number, t: Teintes, bord = 1.1): Facette[] {
  return [
    [rect(x1, y1, x2, y2), t.clair],
    [rect(x1, y1, x1 + bord, y2), t.reflet],
    [rect(x2 - bord * 1.2, y1, x2, y2), t.moyen],
    [rect(x1, y2 - bord, x2, y2), t.ombre],
  ];
}

/**
 * Tourne un dessin de 45° (vertical → diagonale, le haut vers le haut à droite), avec une échelle éventuelle.
 * `decalage` : descend le dessin le long de son axe (vers le bas à gauche) avant de le tourner.
 */
function enDiagonale(dessin: string, echelle = 1, decalage = 0): string {
  const e = echelle === 1 ? '' : ` scale(${echelle})`;
  return `<g transform="translate(24 24) rotate(45)${e} translate(-24 ${-24 + decalage})">${dessin}</g>`;
}

// ---- Couleurs des matières ----

/** Matières d'un palier d'outil. */
interface Palette {
  /** Lame de l'épée, fer de la hache, pointes de la pioche */
  readonly lame: Teintes;
  /** Garde, douille, pommeau, frette */
  readonly garde: Teintes;
  /** Halo du cristal */
  readonly halo?: string;
}

const PALETTES: Readonly<Record<NiveauOutil, Palette>> = {
  // Bois clair (blond) à veinures : la tête de l'outil de départ
  base: {
    lame: { reflet: '#f6e2b4', clair: '#e5c48e', moyen: '#cda06a', ombre: '#a17444' },
    garde: { reflet: '#b9804f', clair: '#9c6538', moyen: '#7f4d29', ombre: '#5a3319' },
  },
  // Cuivre orangé martelé
  cuivre: {
    lame: { reflet: '#ffcfa0', clair: '#f29a5c', moyen: '#d47538', ombre: '#9e4c22' },
    garde: { reflet: '#f0a26a', clair: '#cf7a42', moyen: '#a95a2c', ombre: '#763a1a' },
  },
  // Fer sombre, gris-noir
  fer: {
    lame: { reflet: '#a2a9b3', clair: '#757d88', moyen: '#575e68', ombre: '#3a3f47' },
    garde: { reflet: '#7c838d', clair: '#5d636c', moyen: '#464b53', ombre: '#2d3137' },
  },
  // Acier clair, net, reflets bleutés
  acier: {
    lame: { reflet: '#ffffff', clair: '#e4eaf2', moyen: '#b8c4d3', ombre: '#8394aa' },
    garde: { reflet: '#f4f6fa', clair: '#ccd4de', moyen: '#9ea9b8', ombre: '#6c788a' },
  },
  // Cristal bleu lumineux à facettes, garde d'argent
  cristal: {
    lame: { reflet: '#effdff', clair: '#93e9ff', moyen: '#45bff3', ombre: '#1f84cf' },
    garde: { reflet: '#ffffff', clair: '#e2e7ef', moyen: '#b0bac8', ombre: '#7c8798' },
    halo: '#7fdcff',
  },
};

/** Bois des manches (brun) */
const MANCHE: Teintes = { reflet: '#c38652', clair: '#a76a3b', moyen: '#87512b', ombre: '#5f361a' };
/** Cuir des poignées */
const POIGNEE: Teintes = { reflet: '#a8714a', clair: '#8a5434', moyen: '#6c3d21', ombre: '#472612' };
/** Corde de chanvre (ligatures) */
const CORDE: Teintes = { reflet: '#f3e4b8', clair: '#e2cc92', moyen: '#bfa266', ombre: '#8f7442' };
/** Vert-de-gris du cuivre */
const PATINE = { clair: '#7cc7a8', moyen: '#4f9a80' };
/** Reflet bleuté de l'acier */
const BLEUTE = '#a9cdf2';
/** Bleu profond du cœur du cristal */
const CRISTAL_PROFOND = '#1766b0';

// ---- Épée ----

/** Profil de la lame (demi-largeur, y), de la pointe vers la garde (dessin vertical, centré sur x = 24). */
const PROFILS_LAME: Readonly<Record<NiveauOutil, readonly Point[]>> = {
  base: [[1.8, -1.6], [4.7, 3.2], [4.7, 30.5]],
  cuivre: [[0, -3.2], [3.7, 4.2], [4.8, 13], [4.2, 30.5]],
  fer: [[0, -3.4], [4.3, 4.6], [4.3, 30.5]],
  acier: [[0, -5.2], [3.8, 5.6], [3.8, 30.5]],
  cristal: [[0, -5.4], [4.6, 3.6], [4.6, 30.5]],
};

const BAS_LAME = 30.5;

function lameEpee(n: NiveauOutil): { dessin: string; silhouette: string } {
  const L = PALETTES[n].lame;
  const profil = PROFILS_LAME[n];
  const [w0, yPointe] = profil[0];
  const gauche = profil.map(([w, y]) => [24 - w, y] as Point);
  const droite = profil.map(([w, y]) => [24 + w, y] as Point);
  const haut: Point[] = w0 > 0 ? [] : [[24, yPointe]];
  const moitieG = pts([...haut, ...(w0 > 0 ? [[24, yPointe] as Point] : []), ...gauche, [24, BAS_LAME]]);
  const moitieD = pts([...haut, ...(w0 > 0 ? [[24, yPointe] as Point] : []), ...droite, [24, BAS_LAME]]);
  // Biseaux des tranchants (sans la pointe)
  const b = n === 'base' ? 1.1 : 1.3;
  const bordG = gauche.slice(1);
  const bordD = droite.slice(1);
  const biseauG = pts([...bordG, ...bordG.map(([x, y]) => [x + b, y] as Point).reverse()]);
  const biseauD = pts([...bordD, ...bordD.map(([x, y]) => [x - b, y] as Point).reverse()]);
  const facettes: Facette[] = [
    [moitieG, L.clair],
    [moitieD, L.moyen],
    [biseauG, L.reflet],
    [biseauD, L.ombre],
  ];
  const silhouette = pts([...(w0 > 0 ? [] : [[24, yPointe] as Point]), ...gauche, [24 - profil[profil.length - 1][0], BAS_LAME], [24 + profil[profil.length - 1][0], BAS_LAME], ...[...droite].reverse()]);
  let details = '';
  if (n === 'base') {
    // Bois : veinures et un nœud
    details +=
      ligne('M21.7 28.5 C21.1 21 22.5 14 21.7 6', L.ombre, 0.55) +
      ligne('M26.4 29 C27 22 25.7 15 26.5 8.5', L.ombre, 0.55) +
      ligne('M24.9 26 C25.3 21 24.6 17 25.1 12', L.ombre, 0.45, 0.7) +
      '<ellipse cx="22.6" cy="17.5" rx="0.85" ry="1.7" fill="' + L.ombre + '"/>';
  } else if (n === 'cuivre') {
    // Cuivre martelé : petites facettes de martelage et bague de vert-de-gris au talon
    facettes.push([rect(19.9, 28.6, 28.1, BAS_LAME), PATINE.moyen], [rect(19.9, 28.6, 24, BAS_LAME), PATINE.clair]);
    details +=
      ligne('M21.6 10 L22.6 11.2 M22 17 L23 18 M21.7 23.5 L22.7 24.6', L.moyen, 0.6) +
      ligne('M25.5 13 L26.6 14.2 M25.6 20 L26.7 21.2', L.ombre, 0.6) +
      `<polygon points="26.2,25.6 27.2,25 27.4,26.6" fill="${PATINE.clair}"/>`;
  } else if (n === 'fer') {
    // Fer : gorge sombre au centre
    facettes.push(['23.25,9 24,7.2 24.75,9 24.75,27.5 23.25,27.5', L.ombre], ['23.25,9 24,7.2 24,27.5 23.25,27.5', '#2f343b']);
  } else if (n === 'acier') {
    // Acier : arête vive au centre et reflet bleuté
    facettes.push(['23.4,10 24,7.5 24.6,10 24.6,28 23.4,28', BLEUTE], ['23.4,10 24,7.5 24,28 23.4,28', L.reflet]);
    details += ligne('M21.4 7 L21.4 26', L.reflet, 0.5, 0.8);
  } else {
    // Cristal : facettes en losanges et cœur bleu profond
    for (let k = 0; k < 4; k++) {
      const y = 5 + k * 6.3;
      facettes.push([pts([[24, y], [20.7, y + 3.1], [24, y + 6.3]]), k % 2 === 0 ? L.reflet : L.clair]);
      facettes.push([pts([[24, y + 3.1], [27.3, y + 6.3], [24, y + 9.4 > BAS_LAME ? BAS_LAME : y + 9.4]]), k % 2 === 0 ? L.ombre : L.moyen]);
    }
    facettes.push(['24,-1.5 21.6,3.6 24,4.8', L.reflet]);
    details += ligne('M24 0 L24 29', CRISTAL_PROFOND, 0.5, 0.55);
  }
  return { dessin: piece(facettes) + details, silhouette };
}

function gardeEpee(n: NiveauOutil): string {
  const G = PALETTES[n].garde;
  const L = PALETTES[n].lame;
  if (n === 'base') {
    // Bois sombre, ligature de corde en croix
    return (
      piece([[rect(14.6, 30.3, 33.4, 34.3), G.moyen], [rect(14.6, 30.3, 33.4, 32.2), G.clair], [rect(14.6, 30.3, 15.8, 34.3), G.reflet], [rect(14.6, 33.3, 33.4, 34.3), G.ombre]]) +
      cordon('M21.6 30.6 L26.4 34 M26.4 30.6 L21.6 34', CORDE.clair, 1.05)
    );
  }
  if (n === 'cuivre') {
    return piece([
      ['13,29 16,30.4 32,30.4 35,29 35.3,31.9 32,32.3 16,32.3 12.7,31.9', G.clair],
      ['12.7,31.9 16,32.3 32,32.3 35.3,31.9 34.2,34 31,34.5 17,34.5 13.8,34', G.moyen],
      ['13,29 14.3,29.6 14,34.1 12.7,31.9', G.reflet],
      ['24,30.5 25.7,32.4 24,34.3 22.3,32.4', G.reflet],
      ['24,30.5 25.7,32.4 24,32.4', G.clair],
    ]);
  }
  if (n === 'fer') {
    return (
      piece([...bloc(15.4, 30.7, 32.6, 33.9, G), ...bloc(12.4, 29.6, 15.6, 35, G), ...bloc(32.4, 29.6, 35.6, 35, G)]) +
      rivet(22.4, 32.2, G.reflet) +
      rivet(25.6, 32.2, G.reflet)
    );
  }
  // Acier et cristal : barre d'argent, pointes en losange aux deux bouts
  const bout = n === 'cristal' ? L : G;
  const losangeG: Facette[] = [
    ['15.4,32.2 11.8,29.4 9.2,32.2', bout.reflet],
    ['15.4,32.2 9.2,32.2 11.8,35', bout.moyen],
  ];
  const losangeD: Facette[] = [
    ['32.6,32.2 36.2,29.4 38.8,32.2', bout.clair],
    ['32.6,32.2 38.8,32.2 36.2,35', bout.ombre],
  ];
  let centre = '';
  if (n === 'cristal') {
    centre = piece([['24,30 26.3,32.3 24,34.6 21.7,32.3', L.moyen], ['24,30 21.7,32.3 24,32.3', L.reflet], ['24,30 26.3,32.3 24,32.3', L.clair]]);
  } else {
    centre = rivet(22.3, 32.2, G.moyen) + rivet(25.7, 32.2, G.moyen);
  }
  return piece([...losangeG, ...losangeD]) + piece(bloc(15, 30.7, 33, 33.7, G)) + centre;
}

function poigneeEpee(): string {
  const facettes: Facette[] = [
    [rect(21.8, 34.2, 26.2, 44.8), POIGNEE.moyen],
    [rect(21.8, 34.2, 23.6, 44.8), POIGNEE.clair],
  ];
  for (const y of [35.6, 38.3, 41, 43.7]) facettes.push([pts([[21.8, y], [26.2, y - 1.3], [26.2, y - 0.4], [21.8, y + 0.9]]), POIGNEE.ombre]);
  return piece(facettes);
}

function pommeauEpee(n: NiveauOutil): { dessin: string; silhouette: string } {
  const t = n === 'cristal' ? PALETTES.cristal.lame : PALETTES[n].garde;
  const octo = polygone(24, 47.4, 3, 8, 22.5);
  const gauche = octo.filter(([x]) => x <= 24.01);
  return {
    dessin: piece([
      [pts(octo), t.moyen],
      [pts([[24, 44.4], ...gauche, [24, 50.4]]), t.clair],
      [pts([[24, 47.4], octo[5], octo[6]]), t.reflet],
      [pts([[24, 47.4], octo[0], octo[1], octo[2]]), t.ombre],
    ]),
    silhouette: pts(octo),
  };
}

function epee(n: NiveauOutil): string {
  const lame = lameEpee(n);
  const pommeau = pommeauEpee(n);
  const lueur = n === 'cristal' ? halo([lame.silhouette, pommeau.silhouette], PALETTES.cristal.halo ?? '#7fdcff') : '';
  // Le pommeau et la poignée d'abord, puis la lame, puis la garde par-dessus
  return enDiagonale(lueur + pommeau.dessin + poigneeEpee() + lame.dessin + gardeEpee(n));
}

// ---- Manche (hache et pioche) ----

function manche(n: NiveauOutil, haut: number, bas: number): string {
  const G = PALETTES[n].garde;
  const facettes: Facette[] = [
    [pts([[22.5, haut], [24, haut], [24, bas], [22.4, bas - 0.5], [22, bas - 3.5], [22.6, bas - 7]]), MANCHE.clair],
    [pts([[24, haut], [25.5, haut], [25.4, bas - 7], [26, bas - 3.5], [25.6, bas - 0.5], [24, bas]]), MANCHE.moyen],
    [pts([[24.9, haut], [25.5, haut], [25.4, bas - 7], [26, bas - 3.5], [25.6, bas - 0.5], [25, bas - 0.3]]), MANCHE.ombre],
    [pts([[22.5, haut], [23.2, haut], [23.2, bas - 7], [22.6, bas - 7]]), MANCHE.reflet],
  ];
  let dessin = piece(facettes);
  // Nœuds du bois
  dessin += `<ellipse cx="23.6" cy="${arrondi(haut + (bas - haut) * 0.42)}" rx="0.55" ry="0.9" fill="${MANCHE.ombre}"/>`;
  dessin += `<ellipse cx="24.6" cy="${arrondi(haut + (bas - haut) * 0.7)}" rx="0.5" ry="0.8" fill="${MANCHE.ombre}"/>`;
  if (n === 'base') {
    // Ligature de corde au bas du manche
    dessin += cordon(`M21.9 ${bas - 4.6} L26.1 ${bas - 5.4} M21.9 ${bas - 3.2} L26.1 ${bas - 4}`, CORDE.clair, 0.9);
  } else {
    // Frette de métal au bout du manche
    dessin += piece([[rect(21.8, bas - 3.6, 26.2, bas - 2), G.clair], [rect(21.8, bas - 3.6, 23, bas - 2), G.reflet], [rect(21.8, bas - 2.6, 26.2, bas - 2), G.ombre]]);
    if (n === 'cristal') {
      const L = PALETTES.cristal.lame;
      dessin += piece([[pts([[22.6, bas], [25.4, bas], [24, bas + 2.6]]), L.moyen], [pts([[22.6, bas], [24, bas], [24, bas + 2.6]]), L.reflet]]);
    }
  }
  return dessin;
}

/** Attelle de métal sous la tête, avec deux rivets (fer, acier, cristal). */
function attelle(n: NiveauOutil, y: number): string {
  if (n === 'base' || n === 'cuivre') return '';
  const G = PALETTES[n].garde;
  return piece([[pts([[23.2, y], [24.8, y], [24.8, y + 5.4], [24, y + 6.6], [23.2, y + 5.4]]), G.clair], [pts([[24, y], [24.8, y], [24.8, y + 5.4], [24, y + 6.6]]), G.moyen]]) + rivet(24, y + 1.6, G.reflet, 0.55) + rivet(24, y + 4, G.reflet, 0.55);
}

/** Douille (le bloc qui tient la tête sur le manche). */
function douille(n: NiveauOutil, x1: number, y1: number, x2: number, y2: number): string {
  const G = PALETTES[n].garde;
  if (n === 'base') {
    // Bois sombre ligaturé de corde en croix
    return (
      piece(bloc(x1, y1, x2, y2, G)) +
      cordon(`M${x1 + 0.6} ${y1 + 1} L${x2 - 0.6} ${y2 - 1} M${x2 - 0.6} ${y1 + 1} L${x1 + 0.6} ${y2 - 1}`, CORDE.clair, 1.05) +
      cordon(`M${x1 - 0.2} ${y2 + 1.2} L${x2 + 0.2} ${y2 + 0.6} M${x1 - 0.2} ${y2 + 2.5} L${x2 + 0.2} ${y2 + 1.9}`, CORDE.clair, 0.9)
    );
  }
  let dessin = piece(bloc(x1, y1, x2, y2, G, 1.3));
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  if (n === 'cuivre') {
    dessin += piece([[pts([[cx, cy - 1.5], [cx + 1.5, cy], [cx, cy + 1.5], [cx - 1.5, cy]]), G.reflet], [pts([[cx, cy], [cx + 1.5, cy], [cx, cy + 1.5]]), G.moyen]], CONTOUR, 1);
    // Bague de vert-de-gris sous la douille
    dessin += piece([[rect(x1 + 0.6, y2, x2 - 0.6, y2 + 1.4), PATINE.moyen], [rect(x1 + 0.6, y2, cx, y2 + 1.4), PATINE.clair]]);
  } else if (n === 'cristal') {
    const L = PALETTES.cristal.lame;
    dessin += piece([[pts([[cx, cy - 2], [cx + 1.6, cy], [cx, cy + 2], [cx - 1.6, cy]]), L.moyen], [pts([[cx, cy - 2], [cx - 1.6, cy], [cx, cy]]), L.reflet]], CONTOUR, 1.2);
  } else {
    dessin += rivet(cx, cy - 2, G.reflet) + rivet(cx, cy + 2, G.reflet);
  }
  return dessin;
}

// ---- Hache ----

/** Forme du fer de hache (tourné vers la gauche du dessin vertical). */
interface FormeFer {
  /** y du haut et du bas du fer contre la douille */
  readonly cou: readonly [number, number];
  /** Pointe haute et pointe basse du tranchant */
  readonly haut: Point;
  readonly bas: Point;
  /** x du milieu du tranchant (le plus à gauche) */
  readonly tranchant: number;
  /** x de la taille (là où le fer est le plus étroit) */
  readonly taille: number;
}

const FERS: Readonly<Record<NiveauOutil, FormeFer>> = {
  base: { cou: [9.4, 16.2], haut: [11, 3.6], bas: [11, 21.6], tranchant: 8.6, taille: 16.6 },
  cuivre: { cou: [9.2, 16], haut: [10.2, 2.8], bas: [10.2, 22.6], tranchant: 7.8, taille: 16.2 },
  fer: { cou: [9, 16.4], haut: [9.8, 2.4], bas: [9.8, 23.2], tranchant: 7.2, taille: 16.6 },
  acier: { cou: [9.8, 15.4], haut: [10.2, 1.6], bas: [10.2, 24], tranchant: 7.8, taille: 15.4 },
  cristal: { cou: [9, 16.4], haut: [9.6, 2], bas: [9.6, 23.4], tranchant: 7, taille: 16.2 },
};

function ferHache(n: NiveauOutil, xCou: number): { dessin: string; silhouette: string } {
  const L = PALETTES[n].lame;
  const f = FERS[n];
  const [c0, c1] = f.cou;
  const [hx, hy] = f.haut;
  const [bx, by] = f.bas;
  const tr = f.tranchant;
  const mi = (hy + by) / 2;
  const cm = (c0 + c1) / 2;
  const q1 = (hy + mi) / 2;
  const q3 = (mi + by) / 2;
  const b = 2.1;
  const tranchant: Point[] = [[hx, hy], [tr + 0.7, q1], [tr, mi], [tr + 0.7, q3], [bx, by]];
  const interieur: Point[] = [[hx + b * 0.8, hy + b], [tr + 0.7 + b, q1 + 0.3], [tr + b, mi], [tr + 0.7 + b, q3 - 0.3], [bx + b * 0.8, by - b]];
  const dessus: Point[] = [[xCou, c0], [f.taille, c0 - 0.9]];
  const dessous: Point[] = [[f.taille, c1 + 1.2], [xCou, c1]];
  const facettes: Facette[] = [
    // Joue haute
    [pts([...dessus, [hx, hy], interieur[0], interieur[1], interieur[2], [xCou, cm]]), L.clair],
    // Joue basse
    [pts([[xCou, cm], interieur[2], interieur[3], interieur[4], [f.taille, c1], [xCou, c1 - 1.1]]), L.moyen],
    // Dessous dans l'ombre
    [pts([interieur[4], [bx, by], ...dessous, [xCou, c1 - 1.1], [f.taille, c1]]), L.ombre],
    // Tranchant aiguisé
    [pts([...tranchant, ...[...interieur].reverse()]), L.reflet],
  ];
  const silhouette = pts([...dessus, ...tranchant, ...dessous]);
  let details = '';
  if (n === 'base') {
    details +=
      ligne(`M${xCou - 1} ${c0 + 1.6} C${xCou - 4} ${c0 + 0.6} ${hx + 4} ${hy + 3} ${hx + 2.2} ${hy + 2.6}`, L.ombre, 0.5) +
      ligne(`M${xCou - 1} ${cm + 1} C${xCou - 4} ${cm + 0.2} ${tr + 6} ${mi + 1.8} ${tr + 2.6} ${mi + 1.6}`, L.ombre, 0.5) +
      ligne(`M${xCou - 1.5} ${c1 - 0.6} C${xCou - 4} ${c1 + 0.4} ${bx + 4} ${by - 2.5} ${bx + 2.4} ${by - 2.8}`, L.ombre, 0.5, 0.8);
  } else if (n === 'cuivre') {
    details +=
      ligne('M17 9.6 L18 10.6 M14.8 12.4 L15.8 13.4 M17.4 17.2 L18.4 18.2', L.moyen, 0.6) +
      `<polygon points="18.6,11.4 19.8,11 19.6,12.6 18.4,12.8" fill="${PATINE.clair}"/>` +
      `<polygon points="15.6,17.6 16.6,17.2 16.6,18.4" fill="${PATINE.moyen}"/>`;
  } else if (n === 'acier') {
    details += ligne(`M${hx + 1.4} ${hy + 2.2} Q${tr + 1.6} ${mi} ${bx + 1.4} ${by - 2.2}`, BLEUTE, 0.7, 0.9);
  } else if (n === 'cristal') {
    const X = PALETTES.cristal.lame;
    details += piece([[pts([[xCou, c0 + 0.5], [hx + 3, hy + 2.5], [tr + 3, mi - 1]]), X.reflet], [pts([[xCou, c1 - 0.5], [bx + 3, by - 2.5], [tr + 3, mi + 1]]), X.ombre]], CONTOUR, 0.01);
    details += ligne(`M${xCou - 1} ${cm} L${tr + 3} ${mi}`, CRISTAL_PROFOND, 0.5, 0.6);
  }
  return { dessin: piece(facettes) + details, silhouette };
}

function hache(n: NiveauOutil): string {
  const x1 = 20.6;
  const fer = ferHache(n, x1 + 0.2);
  const lueur = n === 'cristal' ? halo([fer.silhouette], PALETTES.cristal.halo ?? '#7fdcff') : '';
  const dessin =
    lueur +
    manche(n, 6.8, 46) +
    fer.dessin +
    douille(n, x1, 7.6, 27.4, 17.6) +
    attelle(n, 17.6) +
    // Bout du manche qui dépasse au-dessus de la douille
    piece([[rect(22.5, 5.6, 25.5, 7.6), MANCHE.clair], [rect(24, 5.6, 25.5, 7.6), MANCHE.moyen]]);
  return enDiagonale(dessin, 0.95, 4.6);
}

// ---- Pioche ----

/** Bras droit de la pioche : bord du dessus et bord du dessous (de la douille jusqu'à la pointe). */
function brasPioche(longueur: number, chute: number, epaisseur: number): { dessus: Point[]; dessous: Point[] } {
  const x0 = 27.2;
  const y0 = 10.6;
  // Le bras monte un peu puis retombe vers la pointe
  return ruban([x0, y0], [x0 + longueur * 0.62, y0 - 1.6], [x0 + longueur, y0 + chute], epaisseur, epaisseur * 0.08);
}

const BRAS: Readonly<Record<NiveauOutil, readonly [number, number, number]>> = {
  base: [14.4, 5.6, 5],
  cuivre: [15.8, 6.2, 4.8],
  fer: [16.6, 6.6, 5],
  acier: [17.2, 7.4, 4.2],
  cristal: [17.2, 7, 4.8],
};

function pioche(n: NiveauOutil): string {
  const L = PALETTES[n].lame;
  const [longueur, chute, epaisseur] = BRAS[n];
  const { dessus, dessous } = brasPioche(longueur, chute, epaisseur);
  const milieu = dessus.map(([x, y], i) => [(x + dessous[i][0]) / 2, (y + dessous[i][1]) / 2] as Point);
  const brasD = pts([...dessus, ...[...dessous].reverse()]);
  const hautD = pts([...dessus, ...[...milieu].reverse()]);
  const basD = pts([...milieu, ...[...dessous].reverse()]);
  const facettes: Facette[] = [
    // Bras gauche (côté lumière)
    [miroir(hautD), L.reflet],
    [miroir(basD), L.clair],
    // Bras droit
    [hautD, L.clair],
    [basD, L.moyen],
  ];
  // Pointe : dernier tiers du bras droit plus sombre dessous
  const k = dessus.length - 3;
  facettes.push([pts([...milieu.slice(k), ...dessous.slice(k).reverse()]), L.ombre]);
  let details = '';
  if (n === 'base') {
    // Pointes durcies au feu
    const brule = '#3e2b1d';
    const j = dessus.length - 2;
    const bout = pts([...dessus.slice(j), ...dessous.slice(j).reverse()]);
    facettes.push([bout, brule], [miroir(bout), '#5a3d27']);
    details += ligne(chemin(milieu.slice(1, 5)), L.ombre, 0.5, 0.7);
  } else if (n === 'cuivre') {
    details += `<polygon points="31.6,9.6 33,9.5 32.6,10.8" fill="${PATINE.clair}"/>` + `<polygon points="14.6,10.2 15.8,10.4 15.2,11.4" fill="${PATINE.moyen}"/>`;
  } else if (n === 'acier') {
    const reflet = dessus.slice(1, 6).map(([x, y]) => [x, y + 0.9] as Point);
    details += ligne(chemin(reflet), BLEUTE, 0.6, 0.9);
    details += ligne(chemin(reflet.map(([x, y]) => [48 - x, y] as Point)), L.reflet, 0.6, 0.9);
  } else if (n === 'cristal') {
    const coeur = milieu.slice(0, 6);
    details += ligne(chemin(coeur), CRISTAL_PROFOND, 0.5, 0.5);
    details += ligne(chemin(coeur.map(([x, y]) => [48 - x, y] as Point)), CRISTAL_PROFOND, 0.5, 0.4);
  }
  const lueur = n === 'cristal' ? halo([brasD, miroir(brasD)], PALETTES.cristal.halo ?? '#7fdcff') : '';
  const dessin =
    lueur +
    manche(n, 7.4, 50.8) +
    piece(facettes) +
    details +
    douille(n, 20.4, 7, 27.6, 14.6) +
    attelle(n, 14.6) +
    piece([[rect(22.5, 5.2, 25.5, 7), MANCHE.clair], [rect(24, 5.2, 25.5, 7), MANCHE.moyen]]);
  return enDiagonale(dessin, 0.92);
}

const DESSINS_OUTILS: Readonly<Record<OutilRecolte, (n: NiveauOutil) => string>> = { epee, hache, pioche };

// ---- Arc, flèche, torche, pousse d'arbre, piège, pièce d'or ----

/** Bois de l'arc */
const BOIS_ARC: Teintes = { reflet: '#dda06a', clair: '#bd7d45', moyen: '#97592d', ombre: '#6a3a1b' };
/** Fer des pointes de flèche */
const FER_FLECHE: Teintes = { reflet: '#eef2f7', clair: '#c3cbd6', moyen: '#8b96a6', ombre: '#5d6878' };
/** Plumes de l'empennage */
const PLUME = { clair: '#ea5d4f', moyen: '#b93a30' };
/** Terre (motte de la pousse et du piège) */
const TERRE: Teintes = { reflet: '#b48a5e', clair: '#9a7048', moyen: '#77512f', ombre: '#55381f' };
/** Feuillage */
const FEUILLE: Teintes = { reflet: '#b8ec7c', clair: '#8fd456', moyen: '#5ea83a', ombre: '#3c7f28' };

/** Flèche verticale (dessin à tourner) : pointe en haut à `haut`, encoche en bas à `bas`. */
function dessinFleche(haut: number, bas: number, plume = 7.5): string {
  const corps = piece([[rect(23.35, haut + 4.6, 24.65, bas), BOIS_ARC.clair], [rect(24, haut + 4.6, 24.65, bas), BOIS_ARC.moyen]]);
  const pointe = piece([
    [pts([[24, haut], [26.7, haut + 6.2], [24, haut + 5]]), FER_FLECHE.moyen],
    [pts([[24, haut], [21.3, haut + 6.2], [24, haut + 5]]), FER_FLECHE.reflet],
  ]);
  const y = bas - plume;
  const empennage = piece([
    [pts([[23.3, y], [20.3, y + 3], [20.3, bas + 0.6], [23.3, bas - 1.6]]), PLUME.clair],
    [pts([[24.7, y], [27.7, y + 3], [27.7, bas + 0.6], [24.7, bas - 1.6]]), PLUME.moyen],
  ]);
  const encoche = piece([[rect(22.9, bas - 0.4, 25.1, bas + 1.2), BOIS_ARC.ombre]]);
  return corps + empennage + encoche + pointe;
}

/** Milieu d'un ruban (entre ses deux bords). */
function milieuRuban(r: { dessus: Point[]; dessous: Point[] }): Point[] {
  return r.dessus.map(([x, y], i) => [(x + r.dessous[i][0]) / 2, (y + r.dessous[i][1]) / 2] as Point);
}

/** Arc bandé de profil, flèche encochée (la flèche vise le haut à droite). */
function dessinArc(): string {
  const gauche = ruban([24, 14.6], [12, 14], [5, 29], 3.4, 1.4);
  const droite = ruban([24, 14.6], [36, 14], [43, 29], 3.4, 1.4);
  const milieuG = milieuRuban(gauche);
  const milieuD = milieuRuban(droite);
  // Branche de gauche : son « dessous » est le bord extérieur (vers le haut)
  const branches = piece([
    [pts([...gauche.dessous, ...[...milieuG].reverse()]), BOIS_ARC.reflet],
    [pts([...milieuG, ...[...gauche.dessus].reverse()]), BOIS_ARC.clair],
    [pts([...droite.dessus, ...[...milieuD].reverse()]), BOIS_ARC.clair],
    [pts([...milieuD, ...[...droite.dessous].reverse()]), BOIS_ARC.moyen],
  ]);
  // Poignée de cuir
  const poignee = piece([
    [rect(21.6, 12.6, 26.4, 18), POIGNEE.moyen],
    [rect(21.6, 12.6, 24, 18), POIGNEE.clair],
    [rect(21.6, 14.6, 26.4, 15.4), POIGNEE.ombre],
  ]);
  // Bouts où s'attache la corde
  const bouts = piece([
    [pts(polygone(5.2, 29.2, 1.5, 6, 0)), BOIS_ARC.ombre],
    [pts(polygone(42.8, 29.2, 1.5, 6, 0)), BOIS_ARC.ombre],
  ]);
  const corde = cordon('M5.4 29.4 L24 31.6 L42.6 29.4', CORDE.reflet, 0.75);
  return enDiagonale(corde + branches + poignee + bouts + dessinFleche(-4.2, 31.6, 7));
}

function dessinFlecheSeule(): string {
  return enDiagonale(dessinFleche(-3.6, 48.6, 9.5));
}

/** Torche : manche de bois en biais, tête de toile ligaturée, grande flamme qui monte droit. */
function dessinTorche(): string {
  const manche = piece([
    [pts([[22.2, 22], [25.8, 22], [25.3, 47.4], [22.7, 47.4]]), MANCHE.moyen],
    [pts([[22.2, 22], [24, 22], [24, 47.4], [22.7, 47.4]]), MANCHE.clair],
    [pts([[22.2, 22], [23, 22], [23.3, 40], [22.6, 40]]), MANCHE.reflet],
  ]);
  const toile: Teintes = { reflet: '#efdcae', clair: '#d6bc88', moyen: '#b0955f', ombre: '#7f6840' };
  const tete = piece([
    [pts([[20.4, 15.2], [27.6, 15.2], [28.2, 19], [27.2, 23.6], [20.8, 23.6], [19.8, 19]]), toile.moyen],
    [pts([[20.4, 15.2], [24, 15.2], [24, 23.6], [20.8, 23.6], [19.8, 19]]), toile.clair],
    [pts([[20.4, 15.2], [21.6, 15.2], [21.2, 23.6], [20.8, 23.6], [19.8, 19]]), toile.reflet],
    [pts([[20.4, 15.2], [27.6, 15.2], [27.2, 13.8], [20.8, 13.8]]), '#3d2b1e'],
  ]);
  const liens = cordon('M19.9 18 L28.1 17.2 M20.3 21.6 L27.7 20.8', toile.ombre, 0.8);
  const baton = `<g transform="rotate(30 24 24)">${manche}${tete}${liens}</g>`;
  const flammes = piece(
    [
      ['28.5,0.6 31.6,5.6 34.4,3.4 35.8,9.6 34.6,15 31,18.6 26.2,18.6 22.4,15.2 21.4,10.2 23.2,6.4 24.8,9.4 25.6,4.2', '#e2491b'],
      ['28.6,4.6 31.4,9.4 33.2,8 33.4,12.8 31.8,16.8 28.5,18 25.2,16.8 23.8,12.8 25.3,10.4 26.6,11.8', '#ff8c1f'],
      ['28.6,8.6 31,12.6 30.8,16.2 28.5,17.4 26.2,16.2 25.9,13', '#ffc93c'],
      ['28.6,12.2 29.9,14.8 28.5,16.8 27.2,14.8', '#fff3b8'],
    ],
    '#4a1606',
  );
  const etincelles = piece(
    [
      [pts(polygone(37.2, 2.6, 1.1, 4, 0)), '#ffd45a'],
      [pts(polygone(19.6, 4.8, 0.9, 4, 0)), '#ffb23c'],
    ],
    '#4a1606',
    1.6,
  );
  return baton + flammes + etincelles;
}

/** Motte de terre facettée (pousse d'arbre, piège). */
function motte(x1: number, x2: number, haut: number, bas: number): string {
  const m = (x1 + x2) / 2;
  const l = x2 - x1;
  const milieu = haut + (bas - haut) * 0.45;
  return piece([
    [pts([[x1 + l * 0.1, milieu], [x1 + l * 0.3, haut], [x2 - l * 0.3, haut], [x2 - l * 0.1, milieu], [x2 - l * 0.28, milieu + 1.6], [x1 + l * 0.28, milieu + 1.6]]), TERRE.clair],
    [pts([[x1, bas - 2.6], [x1 + l * 0.1, milieu], [x1 + l * 0.28, milieu + 1.6], [m, milieu + 1.9], [m, bas], [x1 + l * 0.14, bas]]), TERRE.moyen],
    [pts([[m, milieu + 1.9], [x2 - l * 0.28, milieu + 1.6], [x2 - l * 0.1, milieu], [x2, bas - 2.6], [x2 - l * 0.14, bas], [m, bas]]), TERRE.ombre],
    [pts([[x1 + l * 0.3, haut], [m, haut], [m - l * 0.06, milieu - 0.4], [x1 + l * 0.18, milieu - 0.6]]), TERRE.reflet],
  ]);
}

/** Feuille en losange, pliée sur sa nervure (base, pointe, demi-largeur). */
function feuille(base: Point, pointe: Point, largeur: number, claire = true): string {
  const [bx, by] = base;
  const [px, py] = pointe;
  const dx = px - bx;
  const dy = py - by;
  const l = Math.hypot(dx, dy);
  const nx = (-dy / l) * largeur;
  const ny = (dx / l) * largeur;
  const cx = bx + dx * 0.45;
  const cy = by + dy * 0.45;
  const a: Point = [cx + nx, cy + ny];
  const b: Point = [cx - nx, cy - ny];
  // La moitié tournée vers le haut est la plus claire
  const [haute, basse] = a[1] < b[1] ? [a, b] : [b, a];
  return piece([
    [pts([base, haute, pointe]), claire ? FEUILLE.reflet : FEUILLE.clair],
    [pts([base, pointe, basse]), claire ? FEUILLE.moyen : FEUILLE.ombre],
  ]);
}

/** Pousse d'arbre : jeune plant à quatre feuilles sur sa motte de terre. */
function dessinPousse(): string {
  const tige = piece([
    [pts([[23, 36], [24.8, 36], [25, 24], [25.8, 14], [24.6, 14], [23.4, 24]]), '#7a5a2e'],
    [pts([[23, 36], [23.9, 36], [24, 24], [24.9, 14], [24.6, 14], [23.4, 24]]), '#9a7440'],
  ]);
  return (
    motte(7, 41, 31, 44) +
    tige +
    feuille([24, 28], [8.6, 21.8], 4.4) +
    feuille([24.6, 23.4], [40.6, 16.2], 4.4, false) +
    feuille([24.6, 18.6], [14.6, 9], 3.4) +
    feuille([25.4, 15], [29.6, 2.6], 3.4) +
    // Cailloux
    piece([[pts(polygone(13, 37.4, 1.6, 5, -90)), '#a9a6a0']], CONTOUR, 1.4) +
    piece([[pts(polygone(34.6, 39, 1.3, 5, -90)), '#8e8b85']], CONTOUR, 1.4)
  );
}

/** Piège : collet de bois et de corde (deux piquets, une branche cintrée, un nœud coulant) sur une motte. */
function dessinPiege(): string {
  const piquet = (x: number, incline: number): string =>
    piece([
      [pts([[x - 1.5, 38], [x + 1.5, 38], [x + 1.5 + incline, 17.4], [x + incline, 14.2], [x - 1.5 + incline, 17.4]]), MANCHE.moyen],
      [pts([[x - 1.5, 38], [x, 38], [x + incline, 14.2], [x - 1.5 + incline, 17.4]]), MANCHE.clair],
    ]);
  const branche = cordon('M11.4 19 C15 7.6 30 5.4 37.4 16.6', MANCHE.moyen, 2.6) + ligne('M12.2 17.6 C16 8.6 29 6.6 35.8 15.4', MANCHE.reflet, 0.8);
  const corde = cordon('M31.4 10.6 L28.4 33.2', CORDE.clair, 1.1);
  const noeud =
    `<ellipse cx="24" cy="36.4" rx="9.4" ry="3.6" fill="none" stroke="${CONTOUR}" stroke-width="3.6"/>` +
    `<ellipse cx="24" cy="36.4" rx="9.4" ry="3.6" fill="none" stroke="${CORDE.clair}" stroke-width="1.5"/>` +
    piece([[pts(polygone(28.8, 33.6, 1.7, 6, 0)), CORDE.moyen]], CONTOUR, 1.6);
  return motte(4, 44, 31.6, 44.6) + noeud + piquet(12, -0.8) + piquet(36, 0.8) + branche + corde;
}

/** Pièce d'or à facettes. */
function dessinOr(): string {
  const bord = polygone(24, 24, 18, 10, -90);
  const face = polygone(24, 24, 12.6, 10, -90);
  const facettes: Facette[] = [[pts(bord), '#d9a432']];
  // Moitié haute gauche du bord plus claire
  facettes.push([pts([bord[6], bord[7], bord[8], bord[9], bord[0], bord[1], face[1], face[0], face[9], face[8], face[7], face[6]]), '#f3cf62']);
  facettes.push([pts(face), '#e8bb43']);
  facettes.push([pts([[24, 24], face[7], face[8], face[9], face[0]]), '#f8de86']);
  facettes.push([pts([[24, 24], face[2], face[3], face[4], face[5]]), '#cf9a2c']);
  // Losange frappé au centre
  facettes.push(['24,16.6 29,24 24,31.4 19,24', '#b8841f'], ['24,16.6 19,24 24,24', '#fff0b0'], ['24,16.6 29,24 24,24', '#f0cd62']);
  return piece(facettes);
}

// ---- Ressources, nourriture, objets fabriqués ----

/** Direction d'où vient la lumière (en haut à gauche, un peu plus du haut). */
const LUMIERE: Point = [-0.6, -0.8];

/** Mélange de deux couleurs « #rrggbb » (t = 0 : la première, 1 : la seconde). */
function melange(a: string, b: string, t = 0.5): string {
  const ca = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const cb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

/**
 * Volume biseauté (rocher, pépite, baie, peau…) : une face plate au milieu et une facette par côté du contour,
 * dont le ton dépend de son orientation face à la lumière. `plat` : taille de la face du milieu (0 à 1).
 */
function caillou(contour: readonly Point[], centre: Point, t: Teintes, plat = 0.45, face?: string): Facette[] {
  const interieur = contour.map(([x, y]) => [centre[0] + (x - centre[0]) * plat, centre[1] + (y - centre[1]) * plat] as Point);
  const facettes: Facette[] = [];
  contour.forEach((a, i) => {
    const j = (i + 1) % contour.length;
    const b = contour[j];
    let nx = b[1] - a[1];
    let ny = a[0] - b[0];
    // Normale tournée vers l'extérieur
    if (nx * ((a[0] + b[0]) / 2 - centre[0]) + ny * ((a[1] + b[1]) / 2 - centre[1]) < 0) {
      nx = -nx;
      ny = -ny;
    }
    const d = (nx * LUMIERE[0] + ny * LUMIERE[1]) / (Math.hypot(nx, ny) || 1);
    const couleur = d > 0.45 ? t.reflet : d > -0.05 ? t.clair : d > -0.55 ? t.moyen : t.ombre;
    facettes.push([pts([a, b, interieur[j], interieur[i]]), couleur]);
  });
  facettes.push([pts(interieur), face ?? melange(t.clair, t.moyen, 0.35)]);
  return facettes;
}

/** Ovale à `n` côtés (polygone aplati). */
function ovale(cx: number, cy: number, rx: number, ry: number, n = 12, depart = 0): Point[] {
  return polygone(0, 0, 1, n, depart).map(([x, y]) => [cx + x * rx, cy + y * ry] as Point);
}

/** Écorce et bois coupé des bûches */
const ECORCE: Teintes = { reflet: '#b47c4a', clair: '#956036', moyen: '#7a4b29', ombre: '#57331b' };
const AUBIER = { clair: '#eed6a4', moyen: '#d4ab6c', cerne: '#b98a50' };

/** Bûche couchée : écorce sur la longueur (x1 → x2), bout coupé (cernes) à droite. */
function buche(x1: number, x2: number, cy: number, r: number): string {
  const h = r / 2;
  const corps = piece([
    [pts([[x1 + 1, cy - r], [x2, cy - r], [x2, cy - h], [x1 + 0.4, cy - h]]), ECORCE.reflet],
    [pts([[x1 + 0.4, cy - h], [x2, cy - h], [x2, cy + h], [x1, cy + h]]), ECORCE.clair],
    [pts([[x1, cy + h], [x2, cy + h], [x2, cy + r], [x1 + 0.8, cy + r]]), ECORCE.moyen],
    [pts([[x1 + 0.8, cy + r], [x1, cy + h], [x1 + 0.4, cy - h], [x1 + 1, cy - r], [x1 - 0.6, cy]]), ECORCE.ombre],
  ]);
  const bout = polygone(x2, cy, r, 6, -90).map(([x, y]) => [x2 + (x - x2) * 0.72, y] as Point);
  const cernes = polygone(x2, cy, r * 0.55, 6, -90).map(([x, y]) => [x2 + (x - x2) * 0.72, y] as Point);
  const coupe = piece([
    [pts(bout), AUBIER.clair],
    [pts([bout[3], bout[4], bout[5], [x2, cy]]), melange(AUBIER.clair, '#ffffff', 0.3)],
    [pts([bout[0], bout[1], bout[2], [x2, cy]]), AUBIER.moyen],
  ]);
  // Veinures de l'écorce et cernes
  const veines = ligne(`M${x1 + 4} ${cy - 0.6} L${x2 - 6} ${cy - 1.2} M${x1 + 7} ${cy + h + 1.4} L${x2 - 3} ${cy + h + 0.8}`, ECORCE.ombre, 0.6, 0.8);
  return corps + veines + coupe + `<polygon points="${pts(cernes)}" fill="none" stroke="${AUBIER.cerne}" stroke-width="0.6"/>` + `<circle cx="${x2}" cy="${cy}" r="0.8" fill="${AUBIER.cerne}"/>`;
}

function dessinBois(): string {
  return buche(11, 39, 15.6, 6.6) + buche(5, 35, 30.4, 7.6) + feuille([18, 9.4], [12, 3.2], 2.2);
}

const ROCHE: Teintes = { reflet: '#dad8d2', clair: '#b3b1ab', moyen: '#8a8883', ombre: '#5f5d59' };
/** Contour du rocher (pierre, minerais) */
const CONTOUR_ROCHER: readonly Point[] = [[7, 35], [9, 22], [18, 12], [31, 10], [40, 18], [42, 32], [35, 40], [15, 41]];

function rocher(t: Teintes): string {
  return piece(caillou(CONTOUR_ROCHER, [22, 22], t, 0.5));
}

function dessinPierre(): string {
  return rocher(ROCHE) + piece(caillou([[34, 42], [37, 37], [43, 36], [46, 40], [43, 45], [37, 45]], [39.5, 39.5], ROCHE, 0.4));
}

/** Pépite à facettes enchâssée dans la roche. */
function pepite(cx: number, cy: number, r: number, t: Teintes, depart = 15): string {
  return piece(caillou(polygone(cx, cy, r, 6, depart), [cx - r * 0.2, cy - r * 0.25], t, 0.4), CONTOUR, 1.6);
}

function dessinMinerai(roche: Teintes, pepites: Teintes, veine: string): string {
  return (
    rocher(roche) +
    ligne('M13 31 L19 24 L27 21 L33 14 M27 21 L31 30', veine, 1.1, 0.85) +
    pepite(14.6, 29.4, 3.6, pepites) +
    pepite(27.4, 20.2, 3.2, pepites, 40) +
    pepite(31.6, 31.4, 3.9, pepites, 0) +
    pepite(21.8, 36.4, 2.4, pepites, 30)
  );
}

const ROCHE_FER: Teintes = { reflet: '#8c8780', clair: '#6c6862', moyen: '#53504b', ombre: '#3a3835' };
const PEPITE_FER: Teintes = { reflet: '#eef5ff', clair: '#bccde3', moyen: '#8ea4c2', ombre: '#5e7392' };
const ROCHE_CUIVRE: Teintes = { reflet: '#93847a', clair: '#75675c', moyen: '#5a4e45', ombre: '#3e352e' };
const PEPITE_CUIVRE: Teintes = { reflet: '#ffd0a0', clair: '#ee9a54', moyen: '#c96e2e', ombre: '#8e4a1e' };
const CHARBON: Teintes = { reflet: '#6e6b76', clair: '#45434b', moyen: '#2e2c33', ombre: '#18171b' };

function dessinCharbon(): string {
  return (
    piece(caillou([[18, 22], [24, 10], [35, 7], [42, 15], [41, 27], [31, 31], [21, 29]], [29, 17], CHARBON, 0.45)) +
    piece(caillou([[5, 34], [9, 24], [18, 21], [25, 26], [26, 36], [19, 42], [9, 41]], [14, 29], CHARBON, 0.45)) +
    piece(caillou([[26, 38], [28, 31], [35, 29], [42, 33], [41, 40], [33, 43]], [33, 34], CHARBON, 0.4)) +
    // Éclats brillants
    `<polygon points="31,10 33.4,9.6 32,12" fill="#9a98a4"/><polygon points="12,25 14,24.4 13,26.4" fill="#9a98a4"/>`
  );
}

/** Prisme de cristal (pointe en haut), incliné de `angle` degrés autour de sa base. */
function prisme(cx: number, base: number, haut: number, w: number, angle: number, t: Teintes): string {
  const s = haut + w * 1.25;
  const g = cx - w;
  const d = cx + w;
  const a = cx - w / 3;
  const b = cx + w / 3;
  const dessin = piece([
    [pts([[g, base], [g, s], [cx, haut], [a, s + 1], [a, base]]), t.clair],
    [pts([[a, base], [a, s + 1], [cx, haut], [b, s + 1], [b, base]]), t.moyen],
    [pts([[b, base], [b, s + 1], [cx, haut], [d, s], [d, base]]), t.ombre],
    [pts([[g, s], [cx, haut], [a, s + 1]]), t.reflet],
    [pts([[a, s + 1], [cx, haut], [b, s + 1]]), t.clair],
  ]);
  return angle === 0 ? dessin : `<g transform="rotate(${angle} ${cx} ${base})">${dessin}</g>`;
}

function dessinCristalBleu(): string {
  const C = PALETTES.cristal.lame;
  const lueur = `<ellipse cx="24" cy="25" rx="17" ry="18" fill="${PALETTES.cristal.halo}" opacity="0.13"/>`;
  return (
    lueur +
    prisme(13.6, 40, 18.6, 4, -24, C) +
    prisme(34.4, 40, 15.6, 4.4, 22, C) +
    prisme(24, 40, 4.4, 5.8, 0, C) +
    piece(caillou([[5, 44], [8, 38.6], [17, 36.4], [31, 36.4], [40, 38], [43.6, 44]], [24, 40], ROCHE, 0.45))
  );
}

/** Peau tannée étalée (cuir) ou fourrure : silhouette, centre, couleurs. */
const PEAU: readonly Point[] = [[10, 9], [17, 6.5], [24, 8.5], [31, 6.5], [38, 9], [41.4, 16], [36.6, 21], [38.6, 33], [42, 40.4], [33, 41.6], [24, 38.6], [15, 41.6], [6, 40.4], [9.4, 33], [11.4, 21], [6.6, 16]];
const CUIR: Teintes = { reflet: '#dca06a', clair: '#bd7d45', moyen: '#9a5f30', ombre: '#6a3c1a' };

function dessinCuir(): string {
  return (
    piece(caillou(PEAU, [23, 22], CUIR, 0.7)) +
    `<polygon points="${pts(PEAU.map(([x, y]) => [23 + (x - 23) * 0.74, 22 + (y - 22) * 0.74] as Point))}" fill="none" stroke="${CUIR.ombre}" stroke-width="0.7" stroke-dasharray="1.6 1.3"/>`
  );
}

/** Fourrure : peau aux bords hérissés de touffes, mèches claires au milieu. */
function dessinFourrure(t: Teintes, ventre: string, meches: string): string {
  const herisse: Point[] = [];
  PEAU.forEach((p, i) => {
    const q = PEAU[(i + 1) % PEAU.length];
    herisse.push(p);
    // Touffe entre deux points : un peu vers l'extérieur
    const mx = (p[0] + q[0]) / 2;
    const my = (p[1] + q[1]) / 2;
    herisse.push([mx + (mx - 23) * 0.09, my + (my - 22) * 0.09]);
  });
  // Les touffes rentrent un peu entre deux pointes
  const silhouette = herisse.map(([x, y], i) => (i % 2 === 0 ? ([23 + (x - 23) * 0.95, 22 + (y - 22) * 0.95] as Point) : ([x, y] as Point)));
  return (
    piece(caillou(silhouette, [23, 21], t, 0.68)) +
    piece([[pts([[19, 16], [24, 20.5], [29, 16], [31, 30], [24, 35.6], [17, 30]]), ventre]], CONTOUR, 0.01) +
    ligne('M15.5 14 L18 18.4 M24 12 V17 M32.5 14 L30 18.4 M15 26 L18.4 28.4 M33 26 L29.6 28.4 M21 31 L24 33.6 L27 31', meches, 0.9)
  );
}

const LOUP: Teintes = { reflet: '#d8d8de', clair: '#a9a9b1', moyen: '#82828b', ombre: '#5a5a62' };
const RENARD: Teintes = { reflet: '#ffb877', clair: '#ef8638', moyen: '#cc6324', ombre: '#94421a' };

/** Os de la viande (diagonale vers le haut à droite). */
function os(): string {
  const OS: Teintes = { reflet: '#fffaf0', clair: '#f1e6d0', moyen: '#d6c7a8', ombre: '#ab9b7c' };
  return (
    piece([[pts([[27.4, 16.4], [37, 6.8], [39.6, 9.4], [30, 19]]), OS.moyen], [pts([[27.4, 16.4], [37, 6.8], [38.3, 8.1], [28.7, 17.7]]), OS.clair]]) +
    piece(caillou(polygone(36.4, 5.2, 2.7, 6, 0), [35.8, 4.6], OS, 0.4)) +
    piece(caillou(polygone(41.2, 10, 2.7, 6, 0), [40.6, 9.4], OS, 0.4))
  );
}

const CONTOUR_VIANDE: readonly Point[] = [[6, 30], [8, 21], [14, 14], [22, 11], [29, 13], [33.6, 19], [33.4, 27], [28, 34.4], [19, 39], [11, 38]];

function dessinViande(cuite: boolean): string {
  const t: Teintes = cuite
    ? { reflet: '#e09a52', clair: '#bf6f33', moyen: '#9a4f22', ombre: '#6a3014' }
    : { reflet: '#f58a80', clair: '#de5a50', moyen: '#bd3e38', ombre: '#862624' };
  const marques = cuite
    ? ligne('M12 30 L22 18 M16 34 L27 21 M21 36.6 L30 25.6', '#4e2410', 1.3, 0.9)
    : ligne('M12 27 C15 22 19 19 25 18 M15 32 C19 28 24 26 29 25', '#f6c2b4', 1, 0.95);
  return os() + piece(caillou(CONTOUR_VIANDE, [19, 24], t, 0.55)) + marques;
}

function dessinRagout(): string {
  const BOL: Teintes = { reflet: '#d09658', clair: '#ad733e', moyen: '#8a572d', ombre: '#5f3a1c' };
  const bord = ovale(24, 22, 18.4, 6, 16);
  const ventre: Point[] = [[5.6, 22], [6.6, 28.6], [10, 34.4], [16, 39], [24, 40.6], [32, 39], [38, 34.4], [41.4, 28.6], [42.4, 22]];
  const pied = piece([[pts([[17, 39.6], [31, 39.6], [30, 43.6], [18, 43.6]]), BOL.ombre], [pts([[17, 39.6], [24, 39.6], [24, 43.6], [18, 43.6]]), BOL.moyen]]);
  const bol = piece([
    [pts(ventre), BOL.moyen],
    [pts([[5.6, 22], [6.6, 28.6], [10, 34.4], [16, 39], [20, 40], [18, 22]]), BOL.clair],
    [pts([[5.6, 22], [6.6, 28.6], [9, 32.6], [10, 22]]), BOL.reflet],
    [pts([[32, 39], [38, 34.4], [41.4, 28.6], [42.4, 22], [36, 22], [30, 40]]), BOL.ombre],
    [pts(bord), BOL.clair],
  ]);
  const surface = ovale(24, 22.4, 15.6, 4.4, 14);
  const ragout = piece([[pts(surface), '#7a3a18'], [pts(surface.slice(6, 12)), '#9a5028']], CONTOUR, 0.8);
  const morceaux =
    `<polygon points="13,21 16.4,20 17,23 13.6,23.8" fill="#f08a3a" stroke="${CONTOUR}" stroke-width="0.5"/>` +
    `<polygon points="27,19.4 30.4,19 30.6,22 27.2,22.4" fill="#f5a04a" stroke="${CONTOUR}" stroke-width="0.5"/>` +
    `<polygon points="20,22.4 23.6,21.6 24,24.6 20.4,25" fill="#c06a3e" stroke="${CONTOUR}" stroke-width="0.5"/>` +
    `<circle cx="33.6" cy="22.6" r="1.4" fill="#9cc23a" stroke="${CONTOUR}" stroke-width="0.5"/><circle cx="18.6" cy="19.4" r="1.2" fill="#9cc23a" stroke="${CONTOUR}" stroke-width="0.5"/>`;
  const vapeur = ligne('M17 15 C14.6 12 19 10 16.6 5.6 M27.4 14.6 C25 11.4 29.6 9.6 27.2 4.6', '#f2ece2', 1.5, 0.75);
  return vapeur + pied + bol + ragout + morceaux;
}

function dessinBaies(): string {
  const BAIE: Teintes = { reflet: '#ff9aa2', clair: '#e64752', moyen: '#c02f3c', ombre: '#861d2a' };
  const baie = (cx: number, cy: number, r: number): string =>
    piece(caillou(polygone(cx, cy, r, 8, 22.5), [cx - r * 0.18, cy - r * 0.22], BAIE, 0.5)) + `<polygon points="${pts(polygone(cx - r * 0.38, cy - r * 0.4, r * 0.2, 4, 0))}" fill="#ffe2e4"/>`;
  return (
    cordon('M24 14 C24 10 26 7 29 5', '#5f8a2c', 1) +
    baie(24, 20.6, 7) +
    baie(31, 31, 7.2) +
    baie(16.4, 32, 7.6) +
    feuille([26, 9], [39, 6.6], 3.4) +
    feuille([23.6, 11], [12.6, 6], 3, false)
  );
}

/** Fleur à cinq pétales. */
function fleur(cx: number, cy: number, r: number): string {
  const etoile: Point[] = [];
  for (let i = 0; i < 10; i++) {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const rr = i % 2 === 0 ? r : r * 0.45;
    etoile.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
  }
  return (
    piece([[pts(etoile), '#dcd2a0'], [pts([[cx, cy], ...etoile.slice(5), etoile[0]]), '#f8f4d8']]) +
    `<circle cx="${cx}" cy="${cy}" r="${arrondi(r * 0.32)}" fill="#e8b53a" stroke="${CONTOUR}" stroke-width="0.5"/>`
  );
}

function dessinPlanteMedicinale(): string {
  return (
    cordon('M22.4 44 C22.4 34 20.4 25 17 15', '#5e9a32', 1.4) +
    cordon('M25.2 44 C26 34 29 24 33 13', '#4f8a2c', 1.4) +
    feuille([21, 31.6], [8.4, 27], 3.4) +
    feuille([26.6, 29.6], [39.6, 25.4], 3.4, false) +
    feuille([18.8, 21.6], [9.6, 14.6], 2.8) +
    feuille([30.4, 20.6], [39.4, 14], 2.8, false) +
    cordon('M20.6 37.8 L27 37.2 M20.8 39.6 L27 39', CORDE.clair, 0.9) +
    fleur(17, 13, 5.4) +
    fleur(33.4, 10.6, 5)
  );
}

function dessinFibres(): string {
  const tons = ['#e8d28c', '#c8a95a', '#dcc174', '#b8994c', '#e8d28c', '#c8a95a', '#dcc174'];
  const brins: Facette[] = [];
  for (let i = 0; i < 7; i++) {
    const bx = 17.6 + i * 2.1;
    const kx = 20 + i * 1.34;
    const tx = 7 + i * 5.6;
    const ty = 8 - Math.sin((i / 6) * Math.PI) * 3.6;
    brins.push([pts([[bx - 1, 44], [bx + 1, 44], [kx + 0.8, 31], [tx + 1.3, ty], [tx - 0.3, ty - 0.8], [kx - 0.8, 31]]), tons[i]]);
  }
  return piece(brins) + cordon('M18.4 29.6 L29.6 29.6 M18.4 32.4 L29.6 32.4', '#9a6a3a', 1.3);
}

/** Lingot : face du dessus claire, face avant moyenne, poinçon en losange. */
function lingot(t: Teintes): string {
  const un = (dx: number, dy: number): string =>
    `<g transform="translate(${dx} ${dy})">` +
    piece([
      [pts([[12, 14], [36, 14], [39.6, 22.6], [8.4, 22.6]]), t.clair],
      [pts([[12, 14], [36, 14], [35.6, 15.6], [12.4, 15.6]]), t.reflet],
      [pts([[12, 14], [12.4, 15.6], [9.6, 22.6], [8.4, 22.6]]), t.reflet],
      [pts([[8.4, 22.6], [39.6, 22.6], [43, 33], [5, 33]]), t.moyen],
      [pts([[5, 33], [43, 33], [42.4, 35], [5.6, 35]]), t.ombre],
      [pts([[39.6, 22.6], [43, 33], [42.4, 35], [41, 29]]), t.ombre],
    ]) +
    `<polygon points="24,15.6 28,18.3 24,21 20,18.3" fill="${t.moyen}"/><polygon points="24,15.6 20,18.3 24,18.3" fill="${t.ombre}"/>` +
    '</g>';
  return un(3, -6) + un(-2, 8);
}

/** Partie d'un polygone convexe comprise entre x = x1 et x = x2 (découpe de Sutherland-Hodgman). */
function bandeVerticale(poly: readonly Point[], x1: number, x2: number): Point[] {
  const couper = (liste: readonly Point[], dedans: (p: Point) => boolean, x: number): Point[] => {
    const sortie: Point[] = [];
    liste.forEach((a, i) => {
      const b = liste[(i + 1) % liste.length];
      const ia = dedans(a);
      const ib = dedans(b);
      if (ia) sortie.push(a);
      if (ia !== ib) sortie.push([x, a[1] + ((b[1] - a[1]) * (x - a[0])) / (b[0] - a[0])]);
    });
    return sortie;
  };
  return couper(couper(poly, (p) => p[0] >= x1, x1), (p) => p[0] <= x2, x2);
}

/** Silhouette des armures (tunique vue de face). */
const TUNIQUE: readonly Point[] = [[13, 8], [19, 6], [24, 10.6], [29, 6], [35, 8], [42.4, 14.4], [39, 23.4], [35, 21.4], [35.4, 42], [12.6, 42], [13, 21.4], [9, 23.4], [5.6, 14.4]];

function corpsArmure(t: Teintes): string {
  return piece([
    [pts(TUNIQUE), t.moyen],
    [pts([[13, 8], [19, 6], [24, 10.6], [24, 42], [12.6, 42], [13, 21.4]]), t.clair],
    [pts([[5.6, 14.4], [13, 8], [13, 21.4], [9, 23.4]]), t.reflet],
    [pts([[35, 8], [42.4, 14.4], [39, 23.4], [35, 21.4]]), t.ombre],
    [pts([[12.6, 39.4], [35.4, 39.4], [35.4, 42], [12.6, 42]]), t.ombre],
    [pts([[19, 6], [24, 10.6], [29, 6], [27, 5.4], [24, 8], [21, 5.4]]), melange(t.ombre, '#000000', 0.45)],
  ]);
}

function ceinture(y: number, cuir: string, boucle: string): string {
  return piece([[rect(12.8, y, 35.2, y + 3), cuir]], CONTOUR, 1.8) + piece([[rect(21.6, y - 0.4, 26.4, y + 3.4), boucle]], CONTOUR, 1.4) + `<rect x="23" y="${y + 0.8}" width="2" height="1.4" fill="${CONTOUR}"/>`;
}

function dessinArmure(type: 'fibres' | 'cuir' | 'fourrure' | 'mailles' | 'plaques'): string {
  if (type === 'fibres') {
    const t: Teintes = { reflet: '#f0dc96', clair: '#d8be70', moyen: '#b6984a', ombre: '#876a2e' };
    return corpsArmure(t) + ligne('M13.4 15 H34.6 M13.2 19.6 H34.8 M13 24.2 H35 M13 28.8 H35 M12.9 33.4 H35.1', t.ombre, 0.6, 0.8) + ligne('M18 11 V39 M24 12 V39 M30 11 V39', t.moyen, 0.5, 0.8) + cordon('M12.8 30.8 Q24 32.6 35.2 30.8', CORDE.clair, 1.3);
  }
  if (type === 'cuir') {
    return corpsArmure(CUIR) + ligne('M24 11.6 V39 M15.6 9.6 L16 39 M32.4 9.6 L32 39', CUIR.ombre, 0.6, 0.9) + `<path d="M8 17 L12.4 14" stroke="${CUIR.reflet}" stroke-width="0.7" stroke-dasharray="1.2 1"/>` + ceinture(29, '#4a2a14', '#e0b85a');
  }
  if (type === 'fourrure') {
    const t: Teintes = { reflet: '#b68e6a', clair: '#946e4e', moyen: '#765538', ombre: '#523a24' };
    const col: Point[] = [[8.6, 12.6], [12.6, 6.4], [16, 9], [19.4, 5.6], [22, 9.6], [24, 7.6], [26, 9.6], [28.6, 5.6], [32, 9], [35.4, 6.4], [39.4, 12.6], [36.6, 14.4], [34.4, 17.6], [31, 15.4], [28.4, 18.6], [24, 16], [19.6, 18.6], [17, 15.4], [13.6, 17.6], [11.4, 14.4]];
    return corpsArmure(t) + ceinture(30, '#3e2a18', '#c9c9cf') + piece(caillou(col, [24, 11], LOUP, 0.55));
  }
  if (type === 'mailles') {
    const t: Teintes = { reflet: '#dfe5ee', clair: '#b4bdca', moyen: '#8d97a6', ombre: '#5e6776' };
    let anneaux = '';
    for (let y = 13; y <= 37; y += 3) {
      const decal = ((y - 13) / 3) % 2 === 0 ? 0 : 1.5;
      for (let x = 14.4 + decal; x <= 33.6; x += 3) anneaux += `M${arrondi(x)} ${y} q1.5 1.6 3 0 `;
    }
    return corpsArmure(t) + ligne(anneaux, t.ombre, 0.55, 0.85) + ceinture(30.4, '#5a3418', '#d9b871');
  }
  const t = PALETTES.acier.lame;
  const epauliere = (miroirX: boolean): string => {
    const p = '5,14.8 12.6,7.6 17,9.8 15,16.6 9.4,22.6';
    return piece([[miroirX ? miroir(p) : p, miroirX ? t.moyen : t.reflet], [miroirX ? miroir('9.4,22.6 15,16.6 15.6,19.4 11,24.4') : '9.4,22.6 15,16.6 15.6,19.4 11,24.4', t.ombre]]);
  };
  return (
    corpsArmure(t) +
    // Plastron : arête centrale et reflet bleuté
    piece([[pts([[24, 11], [30.6, 13], [31.4, 30], [24, 33.6]]), t.moyen], [pts([[24, 11], [17.4, 13], [16.6, 30], [24, 33.6]]), t.reflet]], CONTOUR, 1.2) +
    ligne('M19.4 15 L18.8 27', BLEUTE, 0.9, 0.9) +
    // Lames de la braconnière
    piece([[rect(13, 34, 35, 37.4), t.clair], [rect(24, 34, 35, 37.4), t.moyen]], CONTOUR, 1.4) +
    piece([[rect(12.8, 37.4, 35.2, 40.8), t.moyen], [rect(24, 37.4, 35.2, 40.8), t.ombre]], CONTOUR, 1.4) +
    rivet(15, 35.7, t.reflet, 0.6) + rivet(33, 35.7, t.reflet, 0.6) +
    epauliere(false) + epauliere(true)
  );
}

function dessinCasque(type: 'cuir' | 'fourrure' | 'mailles' | 'plaques'): string {
  if (type === 'cuir') {
    const dome: Point[] = [[9.6, 30], [10.6, 19], [16, 11], [24, 8.4], [32, 11], [37.4, 19], [38.4, 30]];
    return (
      piece([
        [pts([...dome]), CUIR.moyen],
        [pts([[9.6, 30], [10.6, 19], [16, 11], [24, 8.4], [24, 30]]), CUIR.clair],
        [pts([[10.6, 19], [16, 11], [20, 9.4], [15.6, 19]]), CUIR.reflet],
        [pts([[32, 11], [37.4, 19], [38.4, 30], [33.4, 30]]), CUIR.ombre],
      ]) +
      ligne('M24 8.6 V28 M16.4 11.4 Q17.4 20 17 28 M31.6 11.4 Q30.6 20 31 28', CUIR.ombre, 0.6, 0.9) +
      // Bord roulé et rabats d'oreilles
      piece([[rect(8.6, 27, 39.4, 31.4), CUIR.moyen], [rect(8.6, 27, 24, 31.4), CUIR.clair]], CONTOUR, 2) +
      piece([[pts([[9.6, 31], [15.6, 31], [15, 39.4], [12, 41.6], [9.4, 39]]), CUIR.clair], [pts([[32.4, 31], [38.4, 31], [38.6, 39], [36, 41.6], [33, 39.4]]), CUIR.moyen]]) +
      cordon('M12.4 41 L15.6 44.4 M35.6 41 L32.4 44.4', CORDE.clair, 0.7)
    );
  }
  if (type === 'fourrure') {
    const DESSUS: Teintes = { reflet: '#b68e6a', clair: '#946e4e', moyen: '#765538', ombre: '#523a24' };
    const FOURRURE_CLAIRE: Teintes = { reflet: '#fbf6ea', clair: '#ece4d2', moyen: '#cdc3ac', ombre: '#a39881' };
    const bande: Point[] = [[5.6, 25.6], [9, 22.4], [14, 23.6], [19, 21.8], [24, 23.4], [29, 21.8], [34, 23.6], [39, 22.4], [42.4, 25.6], [41.6, 31.4], [42.6, 38.6], [38, 42.6], [35, 37], [30, 33.6], [24, 35], [18, 33.6], [13, 37], [10, 42.6], [5.4, 38.6], [6.4, 31.4]];
    return (
      piece([
        [pts([[10, 26], [11, 15], [17, 8.6], [24, 7], [31, 8.6], [37, 15], [38, 26]]), DESSUS.moyen],
        [pts([[10, 26], [11, 15], [17, 8.6], [24, 7], [24, 26]]), DESSUS.clair],
        [pts([[11, 15], [17, 8.6], [21, 7.6], [16, 15.4]]), DESSUS.reflet],
      ]) +
      ligne('M24 7.4 V23', DESSUS.ombre, 0.6) +
      piece(caillou(bande, [24, 27], FOURRURE_CLAIRE, 0.62))
    );
  }
  if (type === 'mailles') {
    const t: Teintes = { reflet: '#dfe5ee', clair: '#b4bdca', moyen: '#8d97a6', ombre: '#5e6776' };
    const capuche: Point[] = [[24, 4.6], [33, 7.6], [38.4, 16.6], [39, 29.6], [43.4, 37.6], [38.6, 44], [9.4, 44], [4.6, 37.6], [9, 29.6], [9.6, 16.6], [15, 7.6]];
    let anneaux = '';
    for (let y = 9; y <= 41; y += 3) {
      const decal = ((y - 9) / 3) % 2 === 0 ? 0 : 1.5;
      for (let x = 8 + decal; x <= 38; x += 3) {
        // Pas d'anneaux sur l'ouverture du visage
        if (x > 15 && x < 31 && y > 15 && y < 34) continue;
        anneaux += `M${arrondi(x)} ${y} q1.5 1.6 3 0 `;
      }
    }
    return (
      piece(caillou(capuche, [22, 20], t, 0.75)) +
      ligne(anneaux, t.ombre, 0.55, 0.8) +
      piece([[pts([[17, 21], [24, 14.6], [31, 21], [31, 31.4], [24, 35], [17, 31.4]]), '#1f2631'], [pts([[17, 21], [24, 14.6], [31, 21], [24, 19]]), '#2e3846']], CONTOUR, 1.4)
    );
  }
  const t = PALETTES.acier.lame;
  return (
    piece([
      [pts([[9.4, 42], [8.6, 20], [12.6, 10.4], [24, 4.8], [35.4, 10.4], [39.4, 20], [38.6, 42]]), t.moyen],
      [pts([[9.4, 42], [8.6, 20], [12.6, 10.4], [24, 4.8], [24, 42]]), t.clair],
      [pts([[8.6, 20], [12.6, 10.4], [24, 4.8], [20, 12], [13.4, 20]]), t.reflet],
      [pts([[35.4, 10.4], [39.4, 20], [38.6, 42], [34.4, 42], [34.6, 20]]), t.ombre],
    ]) +
    // Fente de la visière et trous d'aération
    piece([[rect(11.4, 19.6, 36.6, 23.4), '#151b26']], CONTOUR, 1) +
    ligne('M24 5.4 V19.4 M24 23.6 V41', t.ombre, 0.9) +
    ligne('M15.6 9.8 Q17.6 7.6 21 6.4', BLEUTE, 0.9, 0.9) +
    `<circle cx="29" cy="29" r="0.7" fill="#151b26"/><circle cx="31.6" cy="29" r="0.7" fill="#151b26"/><circle cx="29" cy="31.8" r="0.7" fill="#151b26"/><circle cx="31.6" cy="31.8" r="0.7" fill="#151b26"/>` +
    rivet(11.4, 38.6, t.reflet, 0.7) + rivet(36.6, 38.6, t.moyen, 0.7)
  );
}

function dessinBouclierBois(): string {
  const FER = PALETTES.fer.garde;
  const bord = polygone(24, 24, 19.6, 12, -90);
  const dedans = polygone(24, 24, 16.4, 12, -90);
  const planches: Facette[] = [];
  const tons = [CUIR.clair, CUIR.moyen, CUIR.clair, CUIR.moyen, CUIR.ombre];
  for (let i = 0; i < 5; i++) {
    const x1 = 7.6 + i * 6.56;
    planches.push([pts(bandeVerticale(dedans, x1, x1 + 6.56)), tons[i]]);
  }
  const bois = piece(planches, CONTOUR, 0.01) + ligne('M14.16 8 V40 M20.72 8 V40 M27.28 8 V40 M33.84 8 V40', CUIR.ombre, 0.6);
  const anneau = piece(caillou(bord, [24, 24], FER, 0.84, 'none'));
  return (
    anneau +
    bois +
    `<polygon points="${pts(dedans)}" fill="none" stroke="${CONTOUR}" stroke-width="1"/>` +
    piece(caillou(polygone(24, 24, 5.6, 8, 22.5), [23, 23], FER, 0.5)) +
    [0, 3, 6, 9].map((i) => rivet(arrondi(24 + 18 * Math.cos(((i * 30 - 90) * Math.PI) / 180)), arrondi(24 + 18 * Math.sin(((i * 30 - 90) * Math.PI) / 180)), FER.reflet, 0.8)).join('')
  );
}

function dessinBouclierRenforce(): string {
  const ARGENT = PALETTES.acier.garde;
  const FACE: Teintes = { reflet: '#9fb0c8', clair: '#7d8ea8', moyen: '#63738c', ombre: '#4a576c' };
  const ecu: Point[] = [[7.4, 7.4], [24, 4], [40.6, 7.4], [40.4, 24], [35, 35.4], [24, 44.4], [13, 35.4], [7.6, 24]];
  const face: Point[] = ecu.map(([x, y]) => [24 + (x - 24) * 0.8, 23 + (y - 23) * 0.8] as Point);
  return (
    piece(caillou(ecu, [24, 22], ARGENT, 0.8, 'none')) +
    piece([
      [pts(face), FACE.moyen],
      [pts([face[0], face[1], [24, 39.4], face[5], face[6], face[7]]), FACE.clair],
      [pts([face[0], face[1], [24, 12], [13.6, 14]]), FACE.reflet],
      [pts([face[1], face[2], face[3], [24, 27]]), melange(FACE.moyen, FACE.clair, 0.3)],
    ], CONTOUR, 1) +
    ligne('M24 7.4 V40.6', FACE.ombre, 0.8) +
    piece([['24,15 29,23.4 24,31.8 19,23.4', '#c99a3a'], ['24,15 19,23.4 24,23.4', '#fff0b0'], ['24,15 29,23.4 24,23.4', '#efcf72'], ['19,23.4 24,31.8 24,23.4', '#e2b552']], CONTOUR, 1.6)
  );
}

function dessinPotionSoin(): string {
  const VERRE: Teintes = { reflet: '#ffffff', clair: '#dcebf2', moyen: '#b4cbd6', ombre: '#87a1ae' };
  const ROUGE: Teintes = { reflet: '#ff9aa2', clair: '#ee4c58', moyen: '#c12e3c', ombre: '#8a1c2c' };
  const corps = polygone(24, 30, 13.6, 8, 22.5);
  const liquide: Point[] = [[35.2, 26.4], [35.2, 34.4], [28.6, 41], [19.4, 41], [12.8, 34.4], [12.8, 26.4]];
  return (
    piece([...caillou(corps, [22, 28], VERRE, 0.82, VERRE.clair), [rect(20.6, 9, 27.4, 17.4), VERRE.moyen], [rect(20.6, 9, 23.4, 17.4), VERRE.clair]]) +
    piece([
      [pts(liquide), ROUGE.moyen],
      [pts([[12.8, 26.4], [24, 26.4], [24, 41], [19.4, 41], [12.8, 34.4]]), ROUGE.clair],
      [pts([[19.4, 41], [28.6, 41], [35.2, 34.4], [35.2, 37], [29.6, 42], [18.4, 42]]), ROUGE.ombre],
      [rect(12.8, 26.4, 35.2, 28), ROUGE.reflet],
    ], CONTOUR, 0.01) +
    `<polygon points="15,22.4 18.6,18.8 19.8,20.2 16.4,25" fill="#ffffff" opacity="0.9"/>` +
    piece([[pts([[20.4, 3.6], [27.6, 3.6], [28.2, 9.4], [19.8, 9.4]]), '#a87c4a'], [pts([[20.4, 3.6], [24, 3.6], [24, 9.4], [19.8, 9.4]]), '#c99c62']]) +
    cordon('M20.4 12.6 L27.6 12.6', CORDE.clair, 1)
  );
}

/** Seau de bois cerclé de fer, avec son anse ; plein d'eau ou vide. */
function dessinSeau(eau: boolean): string {
  const BOIS: Teintes = { reflet: '#c89a62', clair: '#a8743f', moyen: '#8a5a30', ombre: '#5f3d20' };
  const EAU: Teintes = { reflet: '#d8f1ff', clair: '#7cc4ee', moyen: '#4a9ad2', ombre: '#2f6fa8' };
  const FER = PALETTES.fer.lame.moyen;
  const corps: Point[] = [[8, 17], [40, 17], [34.6, 41], [13.4, 41]];
  const bord = ovale(24, 17, 16, 4.4, 12);
  const dedans = ovale(24, 17, 14, 3.2, 12);
  return (
    cordon('M9 17 C8 3 40 3 39 17', '#c9ccd0', 1.2) +
    piece([
      [pts(corps), BOIS.moyen],
      [pts([[8, 17], [17, 17], [18.4, 41], [13.4, 41]]), BOIS.clair],
      [pts([[8, 17], [11.4, 17], [14.6, 41], [13.4, 41]]), BOIS.reflet],
      [pts([[31, 17], [40, 17], [34.6, 41], [30.6, 41]]), BOIS.ombre],
      [pts([[9.4, 24], [38.6, 24], [37.6, 27.6], [10.2, 27.6]]), FER],
      [pts([[11.6, 34.4], [36.4, 34.4], [35.6, 38], [12.4, 38]]), FER],
    ]) +
    piece([[pts(bord), '#8a8d93'], [pts(dedans), eau ? EAU.clair : BOIS.ombre]], CONTOUR, 1.6) +
    (eau
      ? piece([[pts(ovale(24, 17, 12, 2.4, 12)), EAU.moyen], [pts([[16, 16], [24, 14.8], [22, 16.8]]), EAU.reflet]], CONTOUR, 0.01)
      : ligne('M14 17.4 Q24 20 34 17.4', BOIS.moyen, 1, 0.7)) +
    ligne('M10 26 L10.6 27.2', '#ffffff', 0.9, 0.6)
  );
}

function dessinKitFeu(): string {
  const petiteBuche = (angle: number): string => `<g transform="rotate(${angle} 24 36)">${piece([[rect(9, 33, 39, 39), ECORCE.clair], [rect(9, 33, 39, 35), ECORCE.reflet], [rect(9, 37.4, 39, 39), ECORCE.moyen]])}</g>`;
  const flamme = piece(
    [
      ['24,8 27.6,14.4 30.6,12.4 31.6,20 29.6,27 24,30.4 18.4,27 16.6,20.4 18.6,15.4 20.6,18.6 21.2,12.4', '#e2491b'],
      ['24,14.2 27,19.6 28.6,18.6 28.4,24.6 24,28.6 19.8,25 20,20.6 21.8,22', '#ff8c1f'],
      ['24,19.6 26.4,24.2 24,27.6 21.6,24.2', '#ffd04a'],
    ],
    '#4a1606',
  );
  const pierre = (cx: number, cy: number, r: number): string => piece(caillou(polygone(cx, cy, r, 6, 0), [cx - 0.6, cy - 0.8], ROCHE, 0.45));
  return petiteBuche(-16) + petiteBuche(16) + flamme + pierre(7, 41, 3.6) + pierre(41, 41, 3.6) + pierre(24, 43.4, 3.2);
}

function dessinSacoche(): string {
  const S: Teintes = { reflet: '#dca86c', clair: '#bf8548', moyen: '#9a6232', ombre: '#6c401e' };
  return (
    cordon('M11.6 19 C11 5 37 5 36.4 19', S.moyen, 2.6) +
    piece([
      [pts([[8, 18], [40, 18], [42.4, 40], [38.6, 43.6], [9.4, 43.6], [5.6, 40]]), S.moyen],
      [pts([[8, 18], [24, 18], [24, 43.6], [9.4, 43.6], [5.6, 40]]), S.clair],
      [pts([[38.6, 43.6], [42.4, 40], [40, 18], [37.2, 18], [36.4, 43.6]]), S.ombre],
    ]) +
    piece([
      [pts([[7.4, 16.4], [40.6, 16.4], [39.4, 30], [24, 33.6], [8.6, 30]]), S.clair],
      [pts([[7.4, 16.4], [24, 16.4], [24, 33.6], [8.6, 30]]), S.reflet],
      [pts([[33, 16.4], [40.6, 16.4], [39.4, 30], [33.4, 31.4]]), S.moyen],
    ]) +
    `<path d="M10 19 H38 L37 28.6 L24 31.6 L11 28.6 Z" fill="none" stroke="${S.ombre}" stroke-width="0.6" stroke-dasharray="1.4 1.1"/>` +
    piece([[rect(21.4, 28.6, 26.6, 34.6), '#e0b85a'], [rect(21.4, 28.6, 24, 34.6), '#f4d488']], CONTOUR, 1.6) +
    `<rect x="22.8" y="30.4" width="2.4" height="2.4" fill="${S.ombre}"/>`
  );
}

/** Gelée de slime : boule verte translucide à facettes, reflet en haut à gauche. */
const GELEE: Teintes = { reflet: '#e6ffc9', clair: '#a6e870', moyen: '#62c148', ombre: '#378b34' };
const CONTOUR_GELEE: readonly Point[] = [[8, 38], [7, 29], [12, 19], [20, 13], [29, 13.4], [37, 19], [41, 29], [40, 38], [32, 42], [16, 42]];

function dessinGeleeSlime(): string {
  return (
    piece(caillou(CONTOUR_GELEE, [24, 30], GELEE, 0.5, '#8bd95e')) +
    `<polygon points="${pts([[14, 24], [17.6, 18.6], [23, 16.4], [20, 21.4], [16.6, 25.6]])}" fill="#ffffff" opacity="0.6"/>` +
    `<circle cx="31" cy="33" r="2.2" fill="#e6ffc9" opacity="0.55"/>`
  );
}

/** Éclat de Cœur : éclat de cristal bleu lumineux, naturel à gauche, cassé net sur la droite. */
function dessinEclatCoeur(): string {
  const C = PALETTES.cristal.lame;
  const silhouette = pts([[24, 4], [14, 14], [12, 32], [17, 43], [33, 43], [31, 18]]);
  return (
    halo([silhouette], PALETTES.cristal.halo ?? C.clair, 5) +
    piece([
      [pts([[24, 4], [14, 14], [23, 20]]), C.reflet],
      [pts([[14, 14], [12, 32], [17, 43], [23, 43], [23, 20]]), C.clair],
      [pts([[24, 4], [23, 20], [31, 18]]), C.clair],
      [pts([[23, 20], [23, 43], [29.4, 43], [28.4, 19]]), C.moyen],
      [pts([[28.4, 19], [31, 18], [33, 43], [29.4, 43]]), C.ombre],
    ])
  );
}

// ---- Table des icônes ----

const ICONES: Record<string, string> = {
  // Ressources
  bois: dessinBois(),
  pierre: dessinPierre(),
  'minerai-cuivre': dessinMinerai(ROCHE_CUIVRE, PEPITE_CUIVRE, '#d9803f'),
  'minerai-fer': dessinMinerai(ROCHE_FER, PEPITE_FER, '#a3b9d4'),
  charbon: dessinCharbon(),
  'cristal-bleu': dessinCristalBleu(),
  baies: dessinBaies(),
  'plante-medicinale': dessinPlanteMedicinale(),
  fibres: dessinFibres(),
  'pousse-arbre': dessinPousse(),
  // Butin
  cuir: dessinCuir(),
  fourrure: dessinFourrure(LOUP, '#dcdce2', LOUP.ombre),
  'fourrure-renard': dessinFourrure(RENARD, '#f6e8d2', RENARD.ombre),
  'viande-crue': dessinViande(false),
  or: dessinOr(),
  'gelee-slime': dessinGeleeSlime(),
  'eclat-coeur': dessinEclatCoeur(),
  // Objets fabriqués
  'lingot-cuivre': lingot(PALETTES.cuivre.lame),
  'lingot-fer': lingot(PALETTES.fer.lame),
  'lingot-acier': lingot(PALETTES.acier.lame),
  'armure-fibres': dessinArmure('fibres'),
  'armure-cuir': dessinArmure('cuir'),
  'armure-fourrure': dessinArmure('fourrure'),
  'armure-mailles': dessinArmure('mailles'),
  'armure-plaques': dessinArmure('plaques'),
  'casque-cuir': dessinCasque('cuir'),
  'casque-fourrure': dessinCasque('fourrure'),
  'casque-mailles': dessinCasque('mailles'),
  'casque-plaques': dessinCasque('plaques'),
  'bouclier-bois': dessinBouclierBois(),
  'bouclier-renforce': dessinBouclierRenforce(),
  'potion-soin': dessinPotionSoin(),
  'kit-feu-camp': dessinKitFeu(),
  seau: dessinSeau(false),
  'seau-eau': dessinSeau(true),
  sacoche: dessinSacoche(),
  'viande-cuite': dessinViande(true),
  ragout: dessinRagout(),
  // Barre d'outils
  arc: dessinArc(),
  fleche: dessinFlecheSeule(),
  torche: dessinTorche(),
  piege: dessinPiege(),
};

// Outils : un dessin par palier (`hache` est la hache en bois, `hache-fer` la hache en fer…)
for (const t of OUTILS) {
  for (const niveau of NIVEAUX_OUTIL) ICONES[niveau === 'base' ? t : `${t}-${niveau}`] = DESSINS_OUTILS[t](niveau);
}

const ICONE_INCONNUE = '<rect x="8" y="8" width="32" height="32" rx="6" fill="#8a8a90"/><text x="24" y="32" text-anchor="middle" font-size="22" fill="#fff">?</text>';

/** Icône SVG en ligne d'un objet du catalogue, d'un outil (`hache`, `hache-fer`...) ou d'une recette. */
export function icone(objet: string): string {
  return `<svg viewBox="0 0 48 48" width="100%" height="100%">${ICONES[objet] ?? ICONE_INCONNUE}</svg>`;
}

/** Toutes les clés d'icônes connues (page d'essai `essai/icones.html`). */
export function clesIcones(): string[] {
  return Object.keys(ICONES);
}
