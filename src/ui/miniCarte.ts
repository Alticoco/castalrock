// Mini-carte ronde en haut à gauche (sous le compteur d'images) et carte agrandie (touche M, décor dans carteAgrandie.ts).
// Le terrain est dessiné par tuiles calculées petit à petit (budget de temps par image) et gardées en mémoire ;
// l'image de fond n'est refaite que si le joueur a bougé de plus de quelques mètres, tourné (carte tournante)
// ou si une tuile est arrivée. Les repères, la flèche du joueur et les flèches de bordure sont redessinés à chaque image.
// Aucune règle de jeu ici : l'appelant donne la position, l'orientation et les repères.

import { CONFIG } from '../config';
import { CAP_NORD, decalagesTuiles, placerRepere, projeter, type DecalageTuile } from '../regles/miniCarte';
import type { RepereJoueur, Suivi } from '../regles/reperes';
import { creerCarteAgrandie, type ActionsReperes } from './carteAgrandie';
import { COULEURS_REPERES } from './couleursReperes';
import { T as THEME, SUR_DECOR } from './theme';

export type TypeRepere = 'village' | 'mine' | 'feu' | 'baluchon' | 'sortie' | 'animal' | 'camp' | 'autel';

/** Un lieu à montrer sur la carte, en coordonnées du monde. */
export interface Repere {
  type: TypeRepere;
  x: number;
  z: number;
}

export interface VueCarte {
  /** Fond : le terrain du monde ou le plan de la mine */
  fond: 'monde' | 'mine';
  /** Position du joueur (centre de la carte) */
  x: number;
  z: number;
  /** Direction du regard du joueur (lacet : l'avant est (sin, cos)) */
  lacet: number;
  /** Lacet qui pointe vers le haut de la carte (PI = nord en haut) */
  cap: number;
  reperes: readonly Repere[];
  /** Repères posés par le joueur et ce que suit la boussole */
  reperesJoueur: readonly RepereJoueur[];
  suivi: Suivi;
  /** Vrai si le joueur peut poser des repères ici (pas dans la mine ni dans la maison) */
  posable: boolean;
  /** Texte écrit en haut de la carte (ex. « Maison »), facultatif */
  titre?: string;
}

export interface MiniCarte {
  readonly grande: boolean;
  /** Montre ou cache la petite carte (la carte agrandie reste possible). */
  definirVisible(visible: boolean): void;
  /** Change le diamètre de la petite carte (pixels CSS) ; le rayon de monde montré suit. */
  definirTaille(diametre: number): void;
  /** Ouvre ou ferme la carte agrandie. */
  definirGrande(grande: boolean): void;
  /** Branche les actions sur les repères du joueur (poser, retirer, suivre) faites depuis la carte agrandie. */
  brancher(actions: ActionsReperes): void;
  /** Redessine la carte (à appeler à chaque image tant qu'elle est montrée). */
  dessiner(vue: VueCarte): void;
}

/** Ce que la carte demande à l'extérieur : un calcul de tuile de terrain et le plan de la mine. */
export interface SourcesCarte {
  /** Remplit une tuile du terrain (RGBA, pixelsTuile × pixelsTuile). */
  remplirTuile(ti: number, tj: number, donnees: Uint8ClampedArray): void;
  planMine: {
    readonly origine: { x: number; z: number };
    readonly largeur: number;
    readonly profondeur: number;
    readonly ouvert: Uint8Array;
    readonly distance: Uint8Array;
  };
}

const COULEURS_FLECHES: Record<TypeRepere, string> = {
  village: '#ffd35a',
  mine: '#9fd0ff',
  feu: '#ff8a3a',
  baluchon: '#d79bff',
  sortie: '#ffd35a',
  camp: '#e2523f',
  autel: '#5cc8ff',
  // Jamais montré en flèche : un animal hors de la carte n'est pas dessiné
  animal: '#f6efe0',
};

// Petite carte : position à l'écran, encoche du nord (hexagone 36 x 40 px), taquets dorés et libellé de la touche
const GAUCHE_PETITE = 24;
const HAUT_PETITE = 52;
const BORDURE_PETITE = 2;
const ENCOCHE_LARGEUR = 36;
const ENCOCHE_HAUTEUR = 40;
const TAQUET_LONG = 12;
const TAQUET_COURT = 6;
/** Touche de la carte : en AZERTY la touche M a le code `Semicolon` (voir src/jeu/miniCarte.ts) */
const LIBELLE_CARTE = 'M · Ouvrir la carte';

function css(c: number): string {
  return `#${c.toString(16).padStart(6, '0')}`;
}

export function creerMiniCarte(racine: HTMLElement, sources: SourcesCarte): MiniCarte {
  const C = CONFIG.miniCarte;
  const T = C.tailleTuile;
  const dpr = Math.min(2, window.devicePixelRatio || 1);

  // Carte agrandie : voile, anneau, menu (le canvas du terrain vient se loger dans son disque)
  const grandeCarte = creerCarteAgrandie(racine);

  const canvas = document.createElement('canvas');
  canvas.dataset.role = 'mini-carte';

  // Encoche « N » : hexagone sur le bord du cercle, qui suit le nord quand la carte tourne
  const encoche = document.createElement('div');
  encoche.dataset.role = 'mini-carte-nord';
  encoche.style.cssText =
    `position:absolute;display:none;width:${ENCOCHE_LARGEUR}px;height:${ENCOCHE_HAUTEUR}px;pointer-events:none;user-select:none;`;
  encoche.innerHTML =
    `<svg width="${ENCOCHE_LARGEUR}" height="${ENCOCHE_HAUTEUR}" viewBox="0 0 36 40" aria-hidden="true" style="position:absolute;left:0;top:0">` +
    `<polygon points="18,1 35,10 35,26 18,39 1,26 1,10" fill="${THEME.fondFort}" stroke="${THEME.or}" stroke-width="2"/></svg>` +
    `<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:${THEME.titre};font-weight:700;` +
    'font-size:18px;color:#f5be5e;padding-top:1px">N</div>';

  // Trois taquets dorés (est, ouest, sud) : seulement quand la carte est fixe
  const taquets = [0, 1, 2].map(() => {
    const el = document.createElement('div');
    el.dataset.role = 'mini-carte-taquet';
    el.style.cssText = `position:absolute;display:none;background:${THEME.filet};border-radius:2px;pointer-events:none;`;
    return el;
  });

  // Libellé sous la carte
  const libelle = document.createElement('div');
  libelle.dataset.role = 'mini-carte-touche';
  libelle.textContent = LIBELLE_CARTE;
  libelle.style.cssText =
    `position:absolute;display:none;text-align:center;font-family:${THEME.corps};font-size:13px;${SUR_DECOR}pointer-events:none;user-select:none;`;
  racine.append(canvas, encoche, ...taquets, libelle);
  const g = canvas.getContext('2d');
  const fond = document.createElement('canvas');
  const gf = fond.getContext('2d');
  if (!g || !gf) throw new Error('Canvas 2D indisponible pour la mini-carte');

  let visible = true;
  let grande = false;
  let pixels = 0;
  let diametre = C.diametre;
  let placeEncoche = '';
  let taquetsVisibles: boolean | null = null;

  /** Taille en pixels CSS de la carte actuelle. */
  function tailleCss(): number {
    return grande
      ? Math.round(Math.min(C.grandeDiametreMax, window.innerHeight * C.partGrande, window.innerWidth * C.grandePartLargeur))
      : diametre;
  }

  /** Rayon du monde montré par la petite carte : grandit avec le diamètre, par pas, pour garder peu de variantes. */
  function rayonPetite(): number {
    const brut = C.rayon * Math.pow(diametre / C.diametre, C.exposantRayon);
    return Math.max(C.pasRayon, Math.round(brut / C.pasRayon) * C.pasRayon);
  }

  function appliquerStyle(): void {
    const t = tailleCss();
    // Carte agrandie : le canvas remplit le disque de carteAgrandie (l'anneau est son affaire) ; sinon il est dans la racine
    if (grande) {
      grandeCarte.disque.insertBefore(canvas, grandeCarte.disque.firstChild);
      canvas.style.cssText = `position:absolute;left:0;top:0;width:${t}px;height:${t}px;border-radius:50%;pointer-events:none;user-select:none;`;
    } else {
      racine.insertBefore(canvas, encoche);
      canvas.style.cssText =
        `position:absolute;width:${t}px;height:${t}px;border-radius:50%;box-sizing:border-box;` +
        `border:${BORDURE_PETITE}px solid ${THEME.filet};box-shadow:${THEME.ombre};` +
        `background:${css(C.couleurs.fond)};pointer-events:none;user-select:none;left:${GAUCHE_PETITE}px;top:${HAUT_PETITE}px;opacity:0.95;` +
        (visible ? '' : 'display:none;');
    }
    // Décors de la petite carte : encoche, taquets et libellé suivent la taille choisie
    const decors = visible && !grande;
    const echelle = Math.max(0.75, Math.min(1.3, diametre / C.diametre));
    encoche.style.display = decors ? 'block' : 'none';
    encoche.style.transform = `scale(${echelle})`;
    libelle.style.display = decors ? 'block' : 'none';
    libelle.style.left = `${GAUCHE_PETITE}px`;
    libelle.style.width = `${t}px`;
    libelle.style.top = `${HAUT_PETITE + t + 12}px`;
    // Bord droit de la petite carte : l'horloge s'y aligne, au-dessus (src/ui/horloge.ts)
    racine.style.setProperty('--droite-mini-carte', `${GAUCHE_PETITE + diametre}px`);
    const milieu = HAUT_PETITE + t / 2;
    const centreX = GAUCHE_PETITE + t / 2;
    // Est, ouest, sud : taquets de 6 x 12 px qui dépassent du bord
    const places: Array<[number, number, number, number]> = [
      [GAUCHE_PETITE + t - BORDURE_PETITE, milieu - TAQUET_LONG / 2, TAQUET_COURT, TAQUET_LONG],
      [GAUCHE_PETITE - TAQUET_COURT + BORDURE_PETITE, milieu - TAQUET_LONG / 2, TAQUET_COURT, TAQUET_LONG],
      [centreX - TAQUET_LONG / 2, HAUT_PETITE + t - BORDURE_PETITE, TAQUET_LONG, TAQUET_COURT],
    ];
    taquets.forEach((el, i) => {
      const [x, y, l, h] = places[i];
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.style.width = `${l}px`;
      el.style.height = `${h}px`;
      if (!decors) el.style.display = 'none';
    });
    placeEncoche = '';
    taquetsVisibles = null;
    grandeCarte.afficher(grande);
    pixels = Math.round(t * dpr);
    canvas.width = pixels;
    canvas.height = pixels;
    fond.width = pixels;
    fond.height = pixels;
    signature = '';
  }

  // --- Tuiles du terrain ---
  interface Tuile {
    canvas: HTMLCanvasElement;
  }
  const tuiles = new Map<number, Tuile>();
  const cle = (ti: number, tj: number) => (ti + 32768) * 65536 + (tj + 32768);
  const decalagesParRayon = new Map<number, DecalageTuile[]>();
  function decalages(rayon: number): DecalageTuile[] {
    let d = decalagesParRayon.get(rayon);
    if (!d) {
      d = decalagesTuiles(rayon, T);
      decalagesParRayon.set(rayon, d);
    }
    return d;
  }
  const donneesTuile = new Uint8ClampedArray(C.pixelsTuile * C.pixelsTuile * 4);

  function creerTuile(ti: number, tj: number): void {
    sources.remplirTuile(ti, tj, donneesTuile);
    const c = document.createElement('canvas');
    c.width = C.pixelsTuile;
    c.height = C.pixelsTuile;
    c.getContext('2d')?.putImageData(new ImageData(donneesTuile, C.pixelsTuile, C.pixelsTuile), 0, 0);
    tuiles.set(cle(ti, tj), { canvas: c });
  }

  function oublierLesLointaines(ti0: number, tj0: number): void {
    const maxD = C.rayonGrande / C.zoomMin / T + 4;
    for (const k of [...tuiles.keys()]) {
      const ti = Math.floor(k / 65536) - 32768;
      const tj = (k % 65536) - 32768;
      if (Math.hypot(ti - ti0, tj - tj0) > maxD) tuiles.delete(k);
    }
  }

  // Dernière situation pour laquelle toutes les tuiles autour étaient prêtes (évite de les recompter à chaque image)
  let completPour = '';

  /** Calcule les tuiles manquantes autour du joueur, du plus proche au plus lointain, dans le budget de temps. */
  function completerTuiles(x: number, z: number, rayon: number): boolean {
    const ti0 = Math.floor(x / T);
    const tj0 = Math.floor(z / T);
    const etat = `${ti0},${tj0},${rayon}`;
    if (completPour === etat) return false;
    const debut = performance.now();
    const budget = tuiles.size === 0 ? 40 : grande ? C.budgetMsGrande : C.budgetMs;
    let nouveau = false;
    let tout = true;
    for (const { di, dj } of decalages(rayon)) {
      if (tuiles.has(cle(ti0 + di, tj0 + dj))) continue;
      if (nouveau && performance.now() - debut > budget) {
        tout = false;
        break;
      }
      creerTuile(ti0 + di, tj0 + dj);
      nouveau = true;
    }
    if (tout) completPour = etat;
    if (tuiles.size > C.tuilesMax) oublierLesLointaines(ti0, tj0);
    return nouveau;
  }

  // --- Plan de la mine, dessiné une fois ---
  let planCanvas: HTMLCanvasElement | null = null;
  function planMine(): HTMLCanvasElement {
    if (planCanvas) return planCanvas;
    const p = sources.planMine;
    const c = document.createElement('canvas');
    c.width = p.largeur;
    c.height = p.profondeur;
    const cg = c.getContext('2d');
    if (!cg) return c;
    const img = cg.createImageData(p.largeur, p.profondeur);
    const sol = C.couleurs.mineSol;
    const roche = C.couleurs.mineRoche;
    for (let i = 0; i < p.largeur * p.profondeur; i++) {
      const ouvert = p.ouvert[i] === 1;
      // Le sol est un peu plus clair loin des murs : les salles se distinguent des galeries
      const k = ouvert ? 0.82 + Math.min(p.distance[i], 4) * 0.06 : 1;
      const col = ouvert ? sol : roche;
      img.data[i * 4] = ((col >> 16) & 255) * k;
      img.data[i * 4 + 1] = ((col >> 8) & 255) * k;
      img.data[i * 4 + 2] = (col & 255) * k;
      img.data[i * 4 + 3] = 255;
    }
    cg.putImageData(img, 0, 0);
    planCanvas = c;
    return c;
  }

  // --- Fond ---
  let signature = '';
  let derniereX = 0;
  let derniereZ = 0;

  function dessinerFond(vue: VueCarte, rayon: number): void {
    const k = pixels / 2 / rayon;
    const fx = Math.sin(vue.cap);
    const fz = Math.cos(vue.cap);
    // Matrice monde -> pixels : voir projeter() ; le joueur est au centre
    const px = -vue.x * fz + vue.z * fx;
    const py = -(vue.x * fx + vue.z * fz);
    gf!.setTransform(1, 0, 0, 1, 0, 0);
    gf!.fillStyle = css(C.couleurs.fond);
    gf!.fillRect(0, 0, pixels, pixels);
    gf!.setTransform(-fz * k, -fx * k, fx * k, -fz * k, pixels / 2 - px * k, pixels / 2 - py * k);
    gf!.imageSmoothingEnabled = false;
    if (vue.fond === 'mine') {
      const p = sources.planMine;
      gf!.drawImage(planMine(), p.origine.x, p.origine.z, p.largeur, p.profondeur);
    } else {
      const ti0 = Math.floor(vue.x / T);
      const tj0 = Math.floor(vue.z / T);
      for (const { di, dj } of decalages(rayon)) {
        const t = tuiles.get(cle(ti0 + di, tj0 + dj));
        // Léger recouvrement : pas de fine ligne entre deux tuiles quand la carte tourne
        if (t) gf!.drawImage(t.canvas, (ti0 + di) * T, (tj0 + dj) * T, T + 0.5, T + 0.5);
      }
    }
    gf!.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Icônes (dessinées en pixels, centrées en 0, 0 après translate) ---
  function dessinerIcone(type: TypeRepere, s: number): void {
    g!.lineWidth = Math.max(1, s * 0.18);
    g!.strokeStyle = 'rgba(30,20,10,0.95)';
    g!.lineJoin = 'round';
    switch (type) {
      case 'village': {
        // Petite maison : corps et toit
        g!.fillStyle = '#f4dca4';
        g!.beginPath();
        g!.rect(-s * 0.7, -s * 0.1, s * 1.4, s * 0.9);
        g!.fill();
        g!.stroke();
        g!.fillStyle = '#c0583a';
        g!.beginPath();
        g!.moveTo(-s * 0.95, -s * 0.1);
        g!.lineTo(0, -s * 0.95);
        g!.lineTo(s * 0.95, -s * 0.1);
        g!.closePath();
        g!.fill();
        g!.stroke();
        break;
      }
      case 'mine':
      case 'sortie': {
        // Entrée de galerie : disque de roche avec une arche sombre
        g!.fillStyle = type === 'mine' ? '#8d95a6' : '#ffd35a';
        g!.beginPath();
        g!.arc(0, 0, s, 0, Math.PI * 2);
        g!.fill();
        g!.stroke();
        g!.fillStyle = '#1b1612';
        g!.beginPath();
        g!.moveTo(-s * 0.45, s * 0.6);
        g!.lineTo(-s * 0.45, -s * 0.05);
        g!.arc(0, -s * 0.05, s * 0.45, Math.PI, 0);
        g!.lineTo(s * 0.45, s * 0.6);
        g!.closePath();
        g!.fill();
        break;
      }
      case 'feu': {
        // Flamme
        g!.fillStyle = '#ff8a2a';
        g!.beginPath();
        g!.moveTo(0, -s * 1.05);
        g!.bezierCurveTo(s * 0.9, -s * 0.2, s * 0.8, s * 0.9, 0, s * 0.9);
        g!.bezierCurveTo(-s * 0.8, s * 0.9, -s * 0.9, -s * 0.2, 0, -s * 1.05);
        g!.fill();
        g!.stroke();
        g!.fillStyle = '#ffe07a';
        g!.beginPath();
        g!.ellipse(0, s * 0.35, s * 0.3, s * 0.42, 0, 0, Math.PI * 2);
        g!.fill();
        break;
      }
      case 'animal': {
        // Animal (compétence Pisteur) : petit point clair
        g!.fillStyle = '#f6efe0';
        g!.beginPath();
        g!.arc(0, 0, s * 0.42, 0, Math.PI * 2);
        g!.fill();
        g!.stroke();
        break;
      }
      case 'camp': {
        // Camp des bandits : tente brune sur fond rouge sombre
        g!.fillStyle = '#7a2a24';
        g!.beginPath();
        g!.arc(0, 0, s, 0, Math.PI * 2);
        g!.fill();
        g!.stroke();
        g!.fillStyle = '#d9a066';
        g!.beginPath();
        g!.moveTo(0, -s * 0.62);
        g!.lineTo(s * 0.68, s * 0.5);
        g!.lineTo(-s * 0.68, s * 0.5);
        g!.closePath();
        g!.fill();
        g!.fillStyle = '#2a1812';
        g!.beginPath();
        g!.moveTo(0, -s * 0.05);
        g!.lineTo(s * 0.24, s * 0.5);
        g!.lineTo(-s * 0.24, s * 0.5);
        g!.closePath();
        g!.fill();
        break;
      }
      case 'autel': {
        // Autel du Cœur : cristal bleu (losange)
        g!.fillStyle = '#5cc8ff';
        g!.beginPath();
        g!.moveTo(0, -s * 1.1);
        g!.lineTo(s * 0.65, 0);
        g!.lineTo(0, s * 1.1);
        g!.lineTo(-s * 0.65, 0);
        g!.closePath();
        g!.fill();
        g!.stroke();
        g!.fillStyle = '#d6f3ff';
        g!.beginPath();
        g!.moveTo(0, -s * 0.7);
        g!.lineTo(s * 0.25, 0);
        g!.lineTo(0, s * 0.2);
        g!.closePath();
        g!.fill();
        break;
      }
      case 'baluchon': {
        // Baluchon : sac rond noué
        g!.fillStyle = '#b98a5a';
        g!.beginPath();
        g!.arc(0, s * 0.2, s * 0.8, 0, Math.PI * 2);
        g!.fill();
        g!.stroke();
        g!.fillStyle = '#d79bff';
        g!.beginPath();
        g!.rect(-s * 0.35, -s * 0.75, s * 0.7, s * 0.4);
        g!.fill();
        g!.stroke();
        break;
      }
    }
  }

  /** Triangle plein dont la pointe est en (0, 0) et qui regarde vers +x, après rotate. */
  function dessinerTriangle(longueur: number, largeur: number, couleur: string): void {
    g!.fillStyle = couleur;
    g!.strokeStyle = 'rgba(20,14,8,0.95)';
    g!.lineWidth = Math.max(1, dpr * 1.2);
    g!.lineJoin = 'round';
    g!.beginPath();
    g!.moveTo(longueur, 0);
    g!.lineTo(-longueur * 0.6, largeur);
    g!.lineTo(-longueur * 0.2, 0);
    g!.lineTo(-longueur * 0.6, -largeur);
    g!.closePath();
    g!.fill();
    g!.stroke();
  }

  function dessinerReperes(vue: VueCarte, rayon: number): void {
    const k = pixels / 2 / rayon;
    const c = pixels / 2;
    // Rayon utile du disque (la bordure CSS mange un peu de la carte)
    const rayonPx = c - (grande ? 1 : BORDURE_PETITE) * dpr;
    const s = (grande ? 8 : 5.5) * dpr;
    for (const r of vue.reperes) {
      const p = projeter(r.x - vue.x, r.z - vue.z, vue.cap);
      const lieu = placerRepere(p.x * k, p.y * k, rayonPx, C.margeFleche * dpr);
      if (lieu.dehors && r.type === 'animal') continue;
      g!.save();
      g!.translate(c + lieu.x, c + lieu.y);
      if (lieu.dehors) {
        // Hors de vue : une flèche à la bordure, tournée vers le repère
        g!.rotate(lieu.angle);
        dessinerTriangle(s * 1.1, s * 0.8, COULEURS_FLECHES[r.type]);
      } else {
        dessinerIcone(r.type, s);
      }
      g!.restore();
    }

    // Repères du joueur sur la petite carte : pastilles rondes, ou flèche à la bordure quand ils sont hors du disque
    // (sur la carte agrandie, ce sont des pastilles HTML : voir carteAgrandie.ts)
    if (!grande && vue.fond === 'monde') {
      for (const r of vue.reperesJoueur) {
        const p = projeter(r.x - vue.x, r.z - vue.z, vue.cap);
        const lieu = placerRepere(p.x * k, p.y * k, rayonPx, C.margeFleche * dpr);
        const suivi = vue.suivi === r.id;
        g!.save();
        g!.translate(c + lieu.x, c + lieu.y);
        if (lieu.dehors) {
          g!.rotate(lieu.angle);
          dessinerTriangle(s * (suivi ? 1.3 : 1.1), s * (suivi ? 0.95 : 0.8), COULEURS_REPERES[r.type]);
        } else {
          const rayonPastille = (suivi ? 4.5 : 3.5) * dpr;
          g!.fillStyle = COULEURS_REPERES[r.type];
          g!.strokeStyle = suivi ? THEME.accent : 'rgba(16,19,24,0.95)';
          g!.lineWidth = (suivi ? 2.2 : 1.5) * dpr;
          g!.beginPath();
          g!.arc(0, 0, rayonPastille, 0, Math.PI * 2);
          g!.stroke();
          g!.fill();
        }
        g!.restore();
      }
    }

    // Le joueur au centre, flèche dans le sens du regard
    const regard = projeter(Math.sin(vue.lacet), Math.cos(vue.lacet), vue.cap);
    g!.save();
    g!.translate(c, c);
    g!.rotate(Math.atan2(regard.y, regard.x));
    dessinerTriangle(s * 1.15, s * 0.8, '#ffffff');
    g!.restore();
  }

  /** Pose l'encoche sur le bord du cercle, face au nord, et montre les taquets seulement si la carte est fixe. */
  function placerDecors(cap: number): void {
    if (grande || !visible) return;
    const nord = projeter(0, -1, cap);
    const rayon = tailleCss() / 2;
    const x = Math.round(GAUCHE_PETITE + rayon + nord.x * rayon - ENCOCHE_LARGEUR / 2);
    const y = Math.round(HAUT_PETITE + rayon + nord.y * rayon - ENCOCHE_HAUTEUR / 2);
    const cle = `${x},${y}`;
    if (cle !== placeEncoche) {
      placeEncoche = cle;
      encoche.style.left = `${x}px`;
      encoche.style.top = `${y}px`;
    }
    const fixe = Math.abs(Math.sin(cap - CAP_NORD)) < 0.001 && Math.cos(cap - CAP_NORD) > 0;
    if (fixe !== taquetsVisibles) {
      taquetsVisibles = fixe;
      for (const el of taquets) el.style.display = fixe ? 'block' : 'none';
    }
  }

  appliquerStyle();
  window.addEventListener('resize', () => {
    if (grande) appliquerStyle();
  });

  return {
    get grande() {
      return grande;
    },
    definirVisible(v) {
      if (v === visible) return;
      visible = v;
      appliquerStyle();
    },
    definirTaille(d) {
      if (d === diametre) return;
      diametre = d;
      appliquerStyle();
    },
    definirGrande(v) {
      if (v === grande) return;
      grande = v;
      appliquerStyle();
    },
    brancher(actions) {
      grandeCarte.brancher(actions);
    },
    dessiner(vueJeu) {
      if (!visible && !grande) return;
      // La carte agrandie a toujours le nord en haut, même si la petite carte tourne
      const vue = grande ? { ...vueJeu, cap: CAP_NORD } : vueJeu;
      placerDecors(vue.cap);
      const enMine = vue.fond === 'mine';
      const rayon = grande ? (enMine ? C.rayonMine : C.rayonGrande) / grandeCarte.zoom : enMine ? C.rayonMine : rayonPetite();
      let sale = false;
      if (!enMine && completerTuiles(vue.x, vue.z, rayon)) sale = true;
      const forme = `${vue.fond}|${rayon}|${Math.round(vue.cap * 100)}`;
      const loin = Math.hypot(vue.x - derniereX, vue.z - derniereZ) > C.deplacementRedessin;
      if (sale || loin || forme !== signature) {
        signature = forme;
        derniereX = vue.x;
        derniereZ = vue.z;
        dessinerFond(vue, rayon);
      }
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, pixels, pixels);
      g.drawImage(fond, 0, 0);
      dessinerReperes(vue, rayon);
      if (grande) {
        grandeCarte.mettreAJour({
          diametre: tailleCss(),
          rayon,
          x: vue.x,
          z: vue.z,
          reperes: vue.reperesJoueur,
          suivi: vue.suivi,
          posable: vue.posable,
        });
      }
      if (vue.titre) {
        g.setTransform(1, 0, 0, 1, 0, 0);
        g.font = `700 ${Math.round(pixels * 0.1)}px ${THEME.titre}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineWidth = Math.max(2, pixels * 0.02);
        g.strokeStyle = 'rgba(14,26,36,0.9)';
        g.fillStyle = THEME.texte;
        g.strokeText(vue.titre, pixels / 2, pixels * 0.24);
        g.fillText(vue.titre, pixels / 2, pixels * 0.24);
      }
    },
  };
}
