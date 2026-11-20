// Village fixe au centre du monde : description par niveau (bâtiments, décors, chemins),
// obstacles pour le déplacement et points d'interaction (touche E).
// Pur : aucun import de three, aucun Math.random(). Les modèles sont dans src/scene/modelesVillage.ts.
// Repère : origine = centre du village ; x vers la droite, z vers la sortie sud.
// Orientation d'un élément : lacet en radians, sa façade regarde vers (sin(o), cos(o)), comme le personnage.

import type { ObstacleCercle, ObstacleRectangle } from './deplacement';

export type NiveauVillage = 1 | 2 | 3;
export const NIVEAU_VILLAGE_MAX = 3;

/** Niveau suivant, en boucle (3 -> 1) : sert à la touche de test. */
export function niveauSuivant(niveau: NiveauVillage): NiveauVillage {
  return ((niveau % NIVEAU_VILLAGE_MAX) + 1) as NiveauVillage;
}

export type TypeElementVillage =
  | 'maison-chaume'
  | 'maison-tuiles'
  | 'maison-joueur'
  | 'forge'
  | 'forgeron'
  | 'auberge'
  | 'coffre'
  | 'etabli'
  | 'puits'
  | 'feu-camp'
  | 'souche'
  | 'lanterne'
  | 'cloture'
  | 'muret'
  | 'potager'
  | 'tour-guet'
  | 'panneau'
  | 'enclos';

export interface ElementVillage {
  id: string;
  type: TypeElementVillage;
  x: number;
  z: number;
  orientation: number;
  /** Emprise au sol : demi-largeur (perpendiculaire à la façade) et demi-profondeur, en mètres */
  demiLargeur: number;
  demiProfondeur: number;
}

/** Tronçon de chemin posé sur le sol, d'un point à un autre. */
export interface CheminVillage {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  largeur: number;
}

export type RevetementVillage = 'terre' | 'paves';

export interface DescriptionVillage {
  niveau: NiveauVillage;
  elements: ElementVillage[];
  chemins: CheminVillage[];
  /** Place centrale : disque de terre battue, pavé au niveau 3 */
  place: { x: number; z: number; rayon: number };
  revetement: RevetementVillage;
}

// --- Réglages de la disposition ---------------------------------------------------------------

/** Rayon utile du village : tout doit tenir dans le disque aplani (40 m), avec une marge. */
export const RAYON_VILLAGE = 38;
/** Directions des trois sorties (angle depuis +z, en degrés) : sud, nord-est, ouest. */
export const ANGLES_SORTIES: readonly number[] = [0, 130, 240];
/** Largeur des chemins principaux et des chemins vers les portes, en mètres */
const LARGEUR_CHEMIN = 3.2;
const LARGEUR_SENTIER = 1.9;
/** Rayon de l'enceinte (clôture au niveau 2, muret au niveau 3) et nombre de tronçons */
const RAYON_ENCEINTE = 34;
const TRONCONS_ENCEINTE = 36;
/** Là où le personnage apparaît dans une nouvelle partie : sur la place, tourné vers la sortie sud */
export const APPARITION = { x: 0, z: 3.5, orientation: 0 } as const;

const RAD = Math.PI / 180;

/** Demi-emprises par type : [demi-largeur, demi-profondeur]. */
const EMPRISES: Record<TypeElementVillage, readonly [number, number]> = {
  'maison-chaume': [3, 2.5],
  'maison-tuiles': [3, 2.5],
  'maison-joueur': [3, 2.5],
  forge: [3.5, 3],
  forgeron: [0.4, 0.4],
  auberge: [5, 4],
  coffre: [0.55, 0.4],
  etabli: [0.95, 0.5],
  puits: [1.15, 1.15],
  'feu-camp': [0.75, 0.75],
  souche: [0.34, 0.34],
  lanterne: [0.18, 0.18],
  cloture: [0, 0.14],
  muret: [0, 0.3],
  potager: [2.5, 2],
  'tour-guet': [1.6, 1.6],
  panneau: [0.6, 0.2],
  enclos: [3.5, 2.5],
};

/** Orientation qui fait regarder le centre du village depuis (x, z). */
function versLeCentre(x: number, z: number): number {
  return Math.atan2(-x, -z);
}

/** Point du monde correspondant à un point du repère d'un élément (lx vers sa droite, lz vers sa façade). */
export function pointLocal(e: { x: number; z: number; orientation: number }, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(e.orientation);
  const s = Math.sin(e.orientation);
  return { x: e.x + lx * c + lz * s, z: e.z - lx * s + lz * c };
}

function element(id: string, type: TypeElementVillage, x: number, z: number, orientation = versLeCentre(x, z)): ElementVillage {
  const [demiLargeur, demiProfondeur] = EMPRISES[type];
  return { id, type, x, z, orientation, demiLargeur, demiProfondeur };
}

// Maison du joueur, dans son repère : porte en façade, potager devant la fenêtre, tas de bûches contre le mur droit
export const MAISON_JOUEUR = {
  porteX: -0.5,
  potager: { x: 1.9, z: 3.25, demiLargeur: 0.95, demiProfondeur: 0.6 },
  buches: { x: 3.42, z: -0.4, demiLargeur: 0.42, demiProfondeur: 0.75 },
} as const;

// Forge : enclume et forgeron dans le repère de la forge (le forgeron regarde l'enclume, de profil vu de la place)
export const FORGE_ENCLUME = { x: 0.95, z: 1.6 } as const;
const FORGE_FORGERON = { x: 0.0, z: 1.6 } as const;

/** Description complète du village à un niveau donné. */
export function decrireVillage(niveau: NiveauVillage): DescriptionVillage {
  const e: ElementVillage[] = [];
  const chemins: CheminVillage[] = [];
  const place = { x: 0, z: 0, rayon: niveau >= 3 ? 9 : 7 };

  /** Bâtiment tourné vers le centre, avec son sentier de la porte à la place. */
  const batiment = (id: string, type: TypeElementVillage, x: number, z: number) => {
    const b = element(id, type, x, z);
    e.push(b);
    const porte = pointLocal(b, 0, b.demiProfondeur);
    const d = Math.hypot(porte.x, porte.z);
    const k = (place.rayon - 1) / d;
    if (k < 1) chemins.push({ x1: porte.x, z1: porte.z, x2: porte.x * k, z2: porte.z * k, largeur: LARGEUR_SENTIER });
    return b;
  };

  // --- Niveau 1 : hameau ---
  // La maison du joueur : on y entre par la porte (intérieur dans src/maison/)
  batiment('maison-1', 'maison-joueur', -6, -14);
  batiment('maison-2', 'maison-chaume', -14, 4);
  const forge = batiment('forge', 'forge', 14, 1);
  const pf = pointLocal(forge, FORGE_FORGERON.x, FORGE_FORGERON.z);
  // Le forgeron regarde l'enclume, à sa droite dans le repère de la forge
  e.push(element('forgeron', 'forgeron', pf.x, pf.z, forge.orientation + Math.PI / 2));
  // Coffre au bord nord de la place, bien visible depuis la place
  e.push(element('coffre', 'coffre', -1.2, -8.2));
  e.push(element('etabli', 'etabli', 8, 9.5));
  // Panneau d'annonces (quêtes) : sur la place, entre le coffre et le puits, hors des chemins
  e.push(element('panneau', 'panneau', -3.4, -4.6));
  e.push(element('puits', 'puits', -4.5, 2, 0));
  e.push(element('feu-camp', 'feu-camp', 3, -1.5, 0));
  e.push(element('souche-1', 'souche', 4.6, -0.4, 0.4));
  e.push(element('souche-2', 'souche', 2.2, -3.3, 1.9));
  e.push(element('souche-3', 'souche', 1.4, -0.2, 3.1));
  e.push(element('lanterne-1', 'lanterne', 7, -2));
  e.push(element('lanterne-2', 'lanterne', -7.5, 0));

  // Chemins principaux : du bord de la place vers les trois sorties
  for (const angle of ANGLES_SORTIES) {
    const sx = Math.sin(angle * RAD);
    const sz = Math.cos(angle * RAD);
    chemins.push({
      x1: sx * (place.rayon - 1),
      z1: sz * (place.rayon - 1),
      x2: sx * RAYON_VILLAGE,
      z2: sz * RAYON_VILLAGE,
      largeur: LARGEUR_CHEMIN,
    });
  }

  // --- Niveau 2 : auberge, troisième maison, clôtures, potager, lanternes ---
  if (niveau >= 2) {
    batiment('auberge', 'auberge', 3, -22);
    batiment('maison-3', 'maison-chaume', 8, 18);
    e.push(element('potager', 'potager', -7, 15, 0));
    // Enclos des moutons (7 x 5 m, barrière côté centre) : src/regles/ferme.ts, src/scene/modelesFerme.ts
    e.push(element('enclos', 'enclos', -18, 13));
    e.push(element('lanterne-3', 'lanterne', 2.6, 9.5));
    e.push(element('lanterne-4', 'lanterne', -1.2, -10.4));
    e.push(element('lanterne-5', 'lanterne', 8, -16));
  }

  // --- Niveau 3 : deux maisons de tuiles, tour de guet, place pavée, muret, lanternes aux portes ---
  if (niveau >= 3) {
    batiment('maison-4', 'maison-tuiles', -22, -4);
    batiment('maison-5', 'maison-tuiles', 21, 13);
    e.push(element('tour-guet', 'tour-guet', -16, 20));
    e.push(element('lanterne-6', 'lanterne', -14, -3.5));
    e.push(element('lanterne-7', 'lanterne', 13, 9));
    ANGLES_SORTIES.forEach((angle, i) => {
      // Une lanterne de chaque côté de chaque sortie, juste à l'intérieur de l'enceinte
      for (const cote of [-1, 1]) {
        const a = angle * RAD;
        const x = Math.sin(a) * (RAYON_ENCEINTE - 1.5) + Math.cos(a) * cote * 2.6;
        const z = Math.cos(a) * (RAYON_ENCEINTE - 1.5) - Math.sin(a) * cote * 2.6;
        e.push(element(`lanterne-porte-${i}-${cote > 0 ? 'd' : 'g'}`, 'lanterne', x, z));
      }
    });
  }

  // Enceinte : tronçons posés en cercle, ouverts devant chaque sortie
  if (niveau >= 2) {
    const type: TypeElementVillage = niveau >= 3 ? 'muret' : 'cloture';
    const pas = 360 / TRONCONS_ENCEINTE;
    const demiLongueur = RAYON_ENCEINTE * Math.tan((pas / 2) * RAD);
    for (let i = 0; i < TRONCONS_ENCEINTE; i++) {
      const angle = i * pas;
      const ouvert = ANGLES_SORTIES.some((s) => Math.abs(((angle - s + 540) % 360) - 180) < pas * 0.6);
      if (ouvert) continue;
      const x = Math.sin(angle * RAD) * RAYON_ENCEINTE;
      const z = Math.cos(angle * RAD) * RAYON_ENCEINTE;
      const t = element(`enceinte-${i}`, type, x, z);
      t.demiLargeur = demiLongueur;
      e.push(t);
    }
  }

  return { niveau, elements: e, chemins, place, revetement: niveau >= 3 ? 'paves' : 'terre' };
}

// --- Obstacles --------------------------------------------------------------------------------

export interface ObstaclesVillage {
  cercles: ObstacleCercle[];
  rectangles: ObstacleRectangle[];
}

const TYPES_RONDS: readonly TypeElementVillage[] = ['forgeron', 'puits', 'feu-camp', 'souche', 'lanterne'];

/** Obstacles d'un élément : son emprise, sauf pour la forge (ouverte) et l'auberge (tonneaux, banc). */
export function obstaclesElement(el: ElementVillage): ObstaclesVillage {
  const cercles: ObstacleCercle[] = [];
  const rectangles: ObstacleRectangle[] = [];
  const cercle = (lx: number, lz: number, rayon: number) => cercles.push({ ...pointLocal(el, lx, lz), rayon });
  const rectangle = (lx: number, lz: number, demiLargeur: number, demiProfondeur: number) =>
    rectangles.push({ ...pointLocal(el, lx, lz), demiLargeur, demiProfondeur, angle: el.orientation });

  if (TYPES_RONDS.includes(el.type)) {
    cercle(0, 0, el.demiLargeur);
  } else if (el.type === 'forge') {
    // Mur du fond et foyer, table à outils, poteaux de façade, enclume : le reste est ouvert
    rectangle(0, -2.15, 3.5, 0.95);
    rectangle(-2.35, -0.8, 0.75, 0.45);
    cercle(-3.1, 2.6, 0.3);
    cercle(3.1, 2.6, 0.3);
    cercle(FORGE_ENCLUME.x, FORGE_ENCLUME.z, 0.45);
  } else if (el.type === 'auberge') {
    rectangle(0, 0, el.demiLargeur, el.demiProfondeur);
    cercle(-3.3, 4.55, 0.45);
    cercle(-2.35, 4.75, 0.4);
    rectangle(3, 4.5, 0.8, 0.25);
  } else if (el.type === 'maison-joueur') {
    const { potager, buches } = MAISON_JOUEUR;
    rectangle(0, 0, el.demiLargeur, el.demiProfondeur);
    rectangle(potager.x, potager.z, potager.demiLargeur, potager.demiProfondeur);
    rectangle(buches.x, buches.z, buches.demiLargeur, buches.demiProfondeur);
  } else {
    rectangle(0, 0, el.demiLargeur, el.demiProfondeur);
  }
  return { cercles, rectangles };
}

/** Tous les obstacles du village à ce niveau. */
export function obstaclesVillage(niveau: NiveauVillage): ObstaclesVillage {
  const tout: ObstaclesVillage = { cercles: [], rectangles: [] };
  for (const el of decrireVillage(niveau).elements) {
    const o = obstaclesElement(el);
    tout.cercles.push(...o.cercles);
    tout.rectangles.push(...o.rectangles);
  }
  return tout;
}

// --- Interactions (touche E) ------------------------------------------------------------------

export type TypeInteraction = 'coffre' | 'etabli' | 'forgeron' | 'habitant' | 'panneau' | 'auberge' | 'feu' | 'mine' | 'maison' | 'lit' | 'cheminee' | 'marchand' | 'autel' | 'puits' | 'potager';

export interface PointInteraction {
  type: TypeInteraction;
  x: number;
  z: number;
  /** Rayon de l'objet : la portée se mesure jusqu'à son bord */
  rayon: number;
  /** Texte de l'invite, sans la touche : « ouvrir le coffre » */
  invite: string;
}

const INVITES: Record<TypeInteraction, string> = {
  coffre: 'ouvrir le coffre',
  etabli: "utiliser l'établi",
  forgeron: 'parler au forgeron',
  habitant: 'parler',
  panneau: 'lire les annonces',
  auberge: "se reposer à l'auberge",
  feu: 'feu de camp (cuisiner, se reposer)',
  mine: 'entrer dans la mine',
  maison: 'entrer chez vous',
  lit: 'se reposer dans votre lit',
  cheminee: 'cuisiner',
  marchand: 'parler au marchand',
  autel: 'reforger le Cœur',
  puits: 'remplir le seau',
  potager: 'arroser le potager',
};

/** Maison du joueur : sa porte (pied de la façade) et le point où l'on se tient à `distance` mètres devant, dos à la porte. */
export function porteMaisonJoueur(niveau: NiveauVillage, distance = 0): { x: number; z: number; orientation: number } | null {
  const maison = decrireVillage(niveau).elements.find((el) => el.type === 'maison-joueur');
  if (!maison) return null;
  return { ...pointLocal(maison, MAISON_JOUEUR.porteX, maison.demiProfondeur + distance), orientation: maison.orientation };
}

// Points du puits et du potager, gardés par niveau : ils sont lus à chaque image (visée)
const CACHE_POINTS = new Map<string, PointInteraction | null>();

/** Le puits de la place (point d'interaction « remplir le seau »), ou null. */
export function pointPuits(niveau: NiveauVillage): PointInteraction | null {
  if (!CACHE_POINTS.has(`pointPuits:${niveau}`)) CACHE_POINTS.set(`pointPuits:${niveau}`, pointPuitsCalcule(niveau));
  return CACHE_POINTS.get(`pointPuits:${niveau}`) ?? null;
}

function pointPuitsCalcule(niveau: NiveauVillage): PointInteraction | null {
  const puits = decrireVillage(niveau).elements.find((el) => el.type === 'puits');
  return puits ? { type: 'puits', x: puits.x, z: puits.z, rayon: Math.min(puits.demiLargeur, puits.demiProfondeur), invite: INVITES.puits } : null;
}

/** Le potager devant la maison du joueur (point d'interaction « arroser le potager »), ou null si le village n'a pas cette maison. */
export function pointPotagerMaison(niveau: NiveauVillage): PointInteraction | null {
  if (!CACHE_POINTS.has(`pointPotagerMaison:${niveau}`)) CACHE_POINTS.set(`pointPotagerMaison:${niveau}`, pointPotagerMaisonCalcule(niveau));
  return CACHE_POINTS.get(`pointPotagerMaison:${niveau}`) ?? null;
}

function pointPotagerMaisonCalcule(niveau: NiveauVillage): PointInteraction | null {
  const maison = decrireVillage(niveau).elements.find((el) => el.type === 'maison-joueur');
  if (!maison) return null;
  const { potager } = MAISON_JOUEUR;
  const p = pointLocal(maison, potager.x, potager.z);
  return { type: 'potager', x: p.x, z: p.z, rayon: Math.min(potager.demiLargeur, potager.demiProfondeur), invite: INVITES.potager };
}

/** Points d'interaction du village à ce niveau. */
export function interactionsVillage(niveau: NiveauVillage): PointInteraction[] {
  const points: PointInteraction[] = [];
  for (const el of decrireVillage(niveau).elements) {
    if (el.type !== 'coffre' && el.type !== 'etabli' && el.type !== 'forgeron' && el.type !== 'panneau') continue;
    points.push({ type: el.type, x: el.x, z: el.z, rayon: Math.min(el.demiLargeur, el.demiProfondeur), invite: INVITES[el.type] });
  }
  // Auberge (niveau 2 et plus) : repos devant la porte, et accès au coffre du village juste à côté
  const auberge = decrireVillage(niveau).elements.find((el) => el.type === 'auberge');
  if (auberge) {
    const porte = pointLocal(auberge, -0.5, auberge.demiProfondeur + 0.2);
    const coffre = pointLocal(auberge, 1.5, auberge.demiProfondeur + 0.3);
    points.push({ type: 'auberge', x: porte.x, z: porte.z, rayon: 0.6, invite: INVITES.auberge });
    points.push({ type: 'coffre', x: coffre.x, z: coffre.z, rayon: 0.4, invite: 'ouvrir le coffre du village (auberge)' });
  }
  // Feu de camp de la place : on peut y cuisiner
  const feu = decrireVillage(niveau).elements.find((el) => el.type === 'feu-camp');
  if (feu) points.push({ type: 'cheminee', x: feu.x, z: feu.z, rayon: 0.75, invite: 'cuisiner au feu de camp' });
  // Maison du joueur : on entre par la porte
  const porte = porteMaisonJoueur(niveau, 0.1);
  if (porte) points.push({ type: 'maison', x: porte.x, z: porte.z, rayon: 0.5, invite: INVITES.maison });
  return points;
}

/**
 * Point d'interaction utilisable : à moins de `portee` mètres (jusqu'au bord de l'objet) et regardé
 * (dans un cône de `demiAngle` radians autour du lacet `regard`). Le mieux centré l'emporte.
 */
export function interactionVisee(
  points: readonly PointInteraction[],
  x: number,
  z: number,
  regard: number,
  portee: number,
  demiAngle: number,
): PointInteraction | null {
  const rx = Math.sin(regard);
  const rz = Math.cos(regard);
  const seuil = Math.cos(demiAngle);
  let meilleur: PointInteraction | null = null;
  let meilleurScore = -Infinity;
  for (const p of points) {
    const dx = p.x - x;
    const dz = p.z - z;
    const d = Math.hypot(dx, dz);
    if (d - p.rayon > portee) continue;
    // Collé à l'objet : la direction n'a plus de sens, on l'accepte
    const alignement = d > 1e-6 ? (dx * rx + dz * rz) / d : 1;
    if (alignement < seuil) continue;
    if (alignement > meilleurScore) {
      meilleurScore = alignement;
      meilleur = p;
    }
  }
  return meilleur;
}
