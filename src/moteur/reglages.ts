// Réglages du joueur qui ne font pas partie de la partie (gardés même après « Nouvelle partie ») :
// sensibilité de la souris et options graphiques (distance de vue, ombres, images par seconde), mini-carte (affichée, tournante, taille)
// et volumes des sons (général, effets, musique).
// Gardés dans le navigateur, try/catch partout.

import { CONFIG } from '../config';
import {
  estDistanceVue,
  estQualiteOmbres,
  type DistanceVue,
  type QualiteOmbres,
} from '../regles/affichage';

const CLE = 'castalrock.reglages';

interface Reglages {
  /** Multiplicateur de la sensibilité de la souris (1 = réglage d'origine) */
  sensibilite: number;
  distanceVue: DistanceVue;
  ombres: QualiteOmbres;
  /** Compteur d'images par seconde affiché */
  imagesParSeconde: boolean;
  /** Mini-carte affichée en haut à gauche */
  miniCarte: boolean;
  /** La mini-carte tourne avec le joueur (sinon : nord en haut) */
  miniCarteTourne: boolean;
  /** Diamètre de la mini-carte, en pixels */
  tailleMiniCarte: number;
  /** Volumes des sons, de 0 à 1 */
  volumeGeneral: number;
  volumeEffets: number;
  volumeMusique: number;
  /** Bruits de pas du joueur entendus */
  bruitsDePas: boolean;
}

export type CanalVolume = 'general' | 'effets' | 'musique';
const CLE_VOLUME = { general: 'volumeGeneral', effets: 'volumeEffets', musique: 'volumeMusique' } as const;

/** Ramène un volume entre 0 et 1, arrondi au centième ; `defaut` si la valeur n'est pas un nombre. */
export function bornerVolume(valeur: number, defaut: number): number {
  if (!Number.isFinite(valeur)) return defaut;
  return Math.min(1, Math.max(0, Math.round(valeur * 100) / 100));
}

/** Ramène un diamètre de mini-carte dans les bornes du réglage, arrondi au pas. */
export function bornerTailleMiniCarte(valeur: number): number {
  const { diametre, diametreMin, diametreMax, diametrePas } = CONFIG.miniCarte;
  if (!Number.isFinite(valeur)) return diametre;
  const arrondi = Math.round(valeur / diametrePas) * diametrePas;
  return Math.min(diametreMax, Math.max(diametreMin, arrondi));
}

/** Ramène une sensibilité dans les bornes du réglage, arrondie au pas. */
export function bornerSensibilite(valeur: number): number {
  const { min, max, pas, defaut } = CONFIG.cameras.reglageSensibilite;
  if (!Number.isFinite(valeur)) return defaut;
  const arrondi = Math.round(valeur / pas) * pas;
  return Math.min(max, Math.max(min, Number(arrondi.toFixed(2))));
}

function parDefaut(): Reglages {
  return {
    sensibilite: CONFIG.cameras.reglageSensibilite.defaut,
    distanceVue: CONFIG.graphismes.distanceVue.defaut as DistanceVue,
    ombres: CONFIG.graphismes.ombres.defaut as QualiteOmbres,
    imagesParSeconde: CONFIG.graphismes.imagesParSecondeDefaut,
    miniCarte: true,
    miniCarteTourne: false,
    tailleMiniCarte: CONFIG.miniCarte.diametre,
    volumeGeneral: CONFIG.sons.volumeGeneral,
    volumeEffets: CONFIG.sons.volumeEffets,
    volumeMusique: CONFIG.sons.volumeMusique,
    bruitsDePas: true,
  };
}

function lire(): Reglages {
  const defaut = parDefaut();
  try {
    const texte = window.localStorage.getItem(CLE);
    const brut = texte ? (JSON.parse(texte) as Partial<Record<keyof Reglages, unknown>>) : {};
    return {
      sensibilite: bornerSensibilite(Number(brut.sensibilite ?? defaut.sensibilite)),
      distanceVue: estDistanceVue(brut.distanceVue) ? brut.distanceVue : defaut.distanceVue,
      ombres: estQualiteOmbres(brut.ombres) ? brut.ombres : defaut.ombres,
      imagesParSeconde: typeof brut.imagesParSeconde === 'boolean' ? brut.imagesParSeconde : defaut.imagesParSeconde,
      miniCarte: typeof brut.miniCarte === 'boolean' ? brut.miniCarte : defaut.miniCarte,
      miniCarteTourne: typeof brut.miniCarteTourne === 'boolean' ? brut.miniCarteTourne : defaut.miniCarteTourne,
      tailleMiniCarte: bornerTailleMiniCarte(Number(brut.tailleMiniCarte ?? defaut.tailleMiniCarte)),
      volumeGeneral: bornerVolume(Number(brut.volumeGeneral ?? defaut.volumeGeneral), defaut.volumeGeneral),
      volumeEffets: bornerVolume(Number(brut.volumeEffets ?? defaut.volumeEffets), defaut.volumeEffets),
      volumeMusique: bornerVolume(Number(brut.volumeMusique ?? defaut.volumeMusique), defaut.volumeMusique),
      bruitsDePas: typeof brut.bruitsDePas === 'boolean' ? brut.bruitsDePas : defaut.bruitsDePas,
    };
  } catch {
    return defaut;
  }
}

let reglages: Reglages | null = null;

function actuels(): Reglages {
  reglages ??= lire();
  return reglages;
}

function changer(partie: Partial<Reglages>): void {
  reglages = { ...actuels(), ...partie };
  try {
    window.localStorage.setItem(CLE, JSON.stringify(reglages));
  } catch {
    // Stockage refusé : le réglage vaut pour cette session seulement
  }
}

/** Multiplicateur de sensibilité actuel. */
export function sensibilite(): number {
  return actuels().sensibilite;
}

/** Change la sensibilité et la garde dans le navigateur. Renvoie la valeur retenue. */
export function definirSensibilite(valeur: number): number {
  changer({ sensibilite: bornerSensibilite(valeur) });
  return actuels().sensibilite;
}

export function distanceVue(): DistanceVue {
  return actuels().distanceVue;
}

export function definirDistanceVue(valeur: DistanceVue): void {
  changer({ distanceVue: valeur });
}

export function qualiteOmbres(): QualiteOmbres {
  return actuels().ombres;
}

export function definirQualiteOmbres(valeur: QualiteOmbres): void {
  changer({ ombres: valeur });
}

export function imagesParSeconde(): boolean {
  return actuels().imagesParSeconde;
}

export function definirImagesParSeconde(visible: boolean): void {
  changer({ imagesParSeconde: visible });
}

export function miniCarteVisible(): boolean {
  return actuels().miniCarte;
}

export function definirMiniCarteVisible(visible: boolean): void {
  changer({ miniCarte: visible });
}

export function miniCarteTourne(): boolean {
  return actuels().miniCarteTourne;
}

export function definirMiniCarteTourne(tourne: boolean): void {
  changer({ miniCarteTourne: tourne });
}

/** Diamètre actuel de la mini-carte, en pixels. */
export function tailleMiniCarte(): number {
  return actuels().tailleMiniCarte;
}

/** Change le diamètre de la mini-carte et le garde dans le navigateur. Renvoie la valeur retenue. */
export function definirTailleMiniCarte(valeur: number): number {
  changer({ tailleMiniCarte: bornerTailleMiniCarte(valeur) });
  return actuels().tailleMiniCarte;
}

/** Les trois volumes des sons, de 0 à 1. */
export function volumesSon(): { general: number; effets: number; musique: number } {
  const r = actuels();
  return { general: r.volumeGeneral, effets: r.volumeEffets, musique: r.volumeMusique };
}

/** Vrai si les bruits de pas du joueur sont entendus. */
export function bruitsDePas(): boolean {
  return actuels().bruitsDePas;
}

export function definirBruitsDePas(actifs: boolean): void {
  changer({ bruitsDePas: actifs });
}

/** Change un volume et le garde dans le navigateur. Renvoie la valeur retenue. */
export function definirVolume(canal: CanalVolume, valeur: number): number {
  const cle = CLE_VOLUME[canal];
  changer({ [cle]: bornerVolume(valeur, actuels()[cle]) });
  return actuels()[cle];
}

/**
 * Filtre des sauts de souris faux. `accepter(mx, my)` renvoie faux pour un mouvement à ignorer :
 * plus grand que `sautSourisMax` ET que `facteurSautSouris` fois la moyenne des mouvements récents.
 * Un vrai geste rapide monte progressivement (la moyenne suit), le saut faux arrive d'un coup.
 */
export function creerFiltreSouris(): { accepter(mx: number, my: number): boolean } {
  let moyenne = 0;
  return {
    accepter(mx, my) {
      const taille = Math.max(Math.abs(mx), Math.abs(my));
      const { sautSourisMax, facteurSautSouris } = CONFIG.cameras;
      if (taille > sautSourisMax && taille > facteurSautSouris * Math.max(moyenne, 1)) return false;
      moyenne = moyenne * 0.8 + taille * 0.2;
      return true;
    },
  };
}
