// Marchand ambulant : quand il est sur la place, ce qu'il vend et rachète (contre des pièces d'or, l'objet `or`),
// et les échanges. Pur : aucun import de three, aucun Math.random(). Les prix et les horaires sont dans CONFIG.marchand.
// Seul ce qui a été acheté pendant la visite en cours est sauvegardé : le stock d'une nouvelle visite est neuf.
// Les objets sont pris dans l'inventaire porté puis dans le sac magique, et rangés de même (comme les récompenses de quêtes).

import { CONFIG } from '../config';
import { ajouter, compter, definitionObjet, retirer, type Conteneur } from './inventaire';
import { heureDuJeu } from './temps';

export const OBJET_OR = 'or';

/** Ce qu'il vend : `lot` objets pour `prix` pièces d'or, `stock` lots par visite. */
export interface Vente {
  readonly objet: string;
  readonly lot: number;
  readonly prix: number;
  readonly stock: number;
}

/** Ce qu'il rachète : `prix` pièces d'or l'unité. */
export interface Achat {
  readonly objet: string;
  readonly prix: number;
}

export const VENTES: ReadonlyArray<Vente> = CONFIG.marchand.ventes;
export const ACHATS: ReadonlyArray<Achat> = CONFIG.marchand.achats;

export const chercherVente = (objet: string): Vente | undefined => VENTES.find((v) => v.objet === objet);
export const chercherAchat = (objet: string): Achat | undefined => ACHATS.find((a) => a.objet === objet);

// --- Quand passe-t-il ? -------------------------------------------------------------------------

/** Numéro du jour (de minuit à minuit, comme l'horloge) : le jour 0 est celui du début de partie, qui commence à `heureDepart`. */
export function jourCalendaire(tempsJeu: number): number {
  const { dureeJourSecondes, heureDepart } = CONFIG.temps;
  return Math.floor((Math.max(0, tempsJeu) + (heureDepart / 24) * dureeJourSecondes) / dureeJourSecondes);
}

/**
 * Numéro de la visite du jour (1, 2, 3...), ou de la dernière visite passée (0 : il n'est jamais encore venu).
 * Chaque visite a son stock neuf.
 */
export function numeroVisite(tempsJeu: number): number {
  const { premierJour, periodeJours } = CONFIG.marchand;
  const jour = jourCalendaire(tempsJeu);
  if (jour < premierJour) return 0;
  return 1 + Math.floor((jour - premierJour) / periodeJours);
}

/** Est-il sur la place ? Un jour sur `periodeJours` (le premier : `premierJour`), entre `heureArrivee` et `heureDepart`. */
export function marchandPresent(tempsJeu: number): boolean {
  const { premierJour, periodeJours, heureArrivee, heureDepart } = CONFIG.marchand;
  const jour = jourCalendaire(tempsJeu);
  if (jour < premierJour || (jour - premierJour) % periodeJours !== 0) return false;
  const heure = heureDuJeu(tempsJeu, CONFIG.temps);
  return heure >= heureArrivee && heure < heureDepart;
}

// --- Où est-il ? ---------------------------------------------------------------------------------

export interface PlacementMarchand {
  marchand: { x: number; z: number; orientation: number; rayon: number };
  charrette: { x: number; z: number; orientation: number; rayon: number };
}

/** Le marchand regarde le centre de la place ; sa charrette est à côté de lui (décalage dans son repère). */
export function placementMarchand(): PlacementMarchand {
  const { x, z, rayon, charrette } = CONFIG.marchand;
  const orientation = Math.atan2(-x, -z);
  const c = Math.cos(orientation);
  const s = Math.sin(orientation);
  return {
    marchand: { x, z, orientation, rayon },
    charrette: { x: x + charrette.x * c + charrette.z * s, z: z - charrette.x * s + charrette.z * c, orientation, rayon: charrette.rayon },
  };
}

// --- État sauvegardé -----------------------------------------------------------------------------

/** Lots déjà achetés pendant la visite `visite` (une autre visite : le stock est neuf). */
export interface EtatMarchand {
  visite: number;
  achetes: Record<string, number>;
}

export function creerEtatMarchand(): EtatMarchand {
  return { visite: 0, achetes: {} };
}

/** Lit un état de marchand brut (sauvegarde) ; `null` s'il est abîmé. */
export function lireEtatMarchand(v: unknown): EtatMarchand | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { visite, achetes } = v as { visite?: unknown; achetes?: unknown };
  if (!Number.isInteger(visite) || (visite as number) < 0) return null;
  if (typeof achetes !== 'object' || achetes === null || Array.isArray(achetes)) return null;
  const lus: Record<string, number> = {};
  for (const [objet, n] of Object.entries(achetes as Record<string, unknown>)) {
    if (!Number.isInteger(n) || (n as number) < 0 || (n as number) > 1_000_000) return null;
    lus[objet] = n as number;
  }
  return { visite: visite as number, achetes: lus };
}

/** Lots encore en vente à la visite en cours. */
export function stockRestant(etat: EtatMarchand, tempsJeu: number, vente: Vente): number {
  const pris = etat.visite === numeroVisite(tempsJeu) ? (etat.achetes[vente.objet] ?? 0) : 0;
  return Math.max(0, vente.stock - pris);
}

// --- Échanges ------------------------------------------------------------------------------------

export type RaisonRefus = 'absent' | 'inconnu' | 'rupture' | 'pas-assez-or' | 'inventaire-plein' | 'rien-a-vendre';

export const MESSAGES_REFUS: Readonly<Record<RaisonRefus, string>> = {
  absent: "Le marchand n'est plus là",
  inconnu: "Le marchand n'est pas intéressé",
  rupture: 'Plus rien en stock, repasse à ma prochaine visite',
  'pas-assez-or': "Pas assez d'or",
  'inventaire-plein': "Plus de place dans l'inventaire",
  'rien-a-vendre': "Tu n'en as pas à vendre",
};

/** Ce que les échanges lisent et renvoient : l'inventaire porté, le sac magique et l'état du marchand. */
export interface PossessionMarchand {
  readonly inventaire: Conteneur;
  readonly sac: Conteneur;
  readonly etat: EtatMarchand;
  readonly tempsJeu: number;
}

export type ResultatEchange =
  | {
      ok: true;
      inventaire: Conteneur;
      sac: Conteneur;
      etat: EtatMarchand;
      /** Quantité d'objets reçus (achat) ou donnés (vente) */
      quantite: number;
      /** Pièces d'or payées (achat) ou reçues (vente) */
      or: number;
      message: string;
    }
  | { ok: false; raison: RaisonRefus; message: string };

const refus = (raison: RaisonRefus): ResultatEchange => ({ ok: false, raison, message: MESSAGES_REFUS[raison] });

/** Nombre total d'un objet, inventaire porté et sac réunis. */
export function possede(p: Pick<PossessionMarchand, 'inventaire' | 'sac'>, objet: string): number {
  return compter(p.inventaire, objet) + compter(p.sac, objet);
}

/** Pièces d'or possédées (inventaire porté et sac). */
export const orPossede = (p: Pick<PossessionMarchand, 'inventaire' | 'sac'>): number => possede(p, OBJET_OR);

/** Retire des objets de l'inventaire porté, puis du sac pour le reste. */
function prendre(inventaire: Conteneur, sac: Conteneur, objet: string, quantite: number): { inventaire: Conteneur; sac: Conteneur } {
  const a = retirer(inventaire, objet, quantite);
  const b = retirer(sac, objet, quantite - a.retire);
  return { inventaire: a.conteneur, sac: b.conteneur };
}

/** Range des objets dans l'inventaire porté, puis dans le sac ; `reste` : ce qui ne rentre nulle part. */
function ranger(inventaire: Conteneur, sac: Conteneur, objet: string, quantite: number): { inventaire: Conteneur; sac: Conteneur; reste: number } {
  const a = ajouter(inventaire, objet, quantite);
  const b = ajouter(sac, objet, a.reste);
  return { inventaire: a.conteneur, sac: b.conteneur, reste: b.reste };
}

const minuscule = (objet: string): string => definitionObjet(objet).nom;

/**
 * Achat de `lots` lots (au plus : on en prend autant que le stock, l'or et la place le permettent).
 * Refus : marchand absent, objet qu'il ne vend pas, rupture de stock, pas assez d'or, inventaire plein.
 */
export function acheter(p: PossessionMarchand, objet: string, lots = 1): ResultatEchange {
  if (!marchandPresent(p.tempsJeu)) return refus('absent');
  const vente = chercherVente(objet);
  if (!vente) return refus('inconnu');
  const stock = stockRestant(p.etat, p.tempsJeu, vente);
  if (stock < 1) return refus('rupture');
  const abordables = Math.floor(orPossede(p) / vente.prix);
  if (abordables < 1) return refus('pas-assez-or');
  // L'or payé libère parfois une case : on essaie du plus grand nombre de lots au plus petit
  for (let n = Math.min(Math.max(1, Math.floor(lots)), stock, abordables); n >= 1; n--) {
    const paye = prendre(p.inventaire, p.sac, OBJET_OR, n * vente.prix);
    const recu = ranger(paye.inventaire, paye.sac, objet, n * vente.lot);
    if (recu.reste > 0) continue;
    const visite = numeroVisite(p.tempsJeu);
    const dejaPris = p.etat.visite === visite ? p.etat.achetes : {};
    return {
      ok: true,
      inventaire: recu.inventaire,
      sac: recu.sac,
      etat: { visite, achetes: { ...dejaPris, [objet]: (dejaPris[objet] ?? 0) + n } },
      quantite: n * vente.lot,
      or: n * vente.prix,
      message: `Acheté : ${n * vente.lot} ${minuscule(objet)} (-${n * vente.prix} or)`,
    };
  }
  return refus('inventaire-plein');
}

/**
 * Vente de `quantite` objets au plus (autant que l'on en possède, et que l'or reçu en laisse la place).
 * Refus : marchand absent, objet qu'il ne rachète pas, rien à vendre, inventaire plein (pour l'or).
 */
export function vendre(p: PossessionMarchand, objet: string, quantite = 1): ResultatEchange {
  if (!marchandPresent(p.tempsJeu)) return refus('absent');
  const achat = chercherAchat(objet);
  if (!achat) return refus('inconnu');
  const possedes = possede(p, objet);
  if (possedes < 1) return refus('rien-a-vendre');
  for (let n = Math.min(Math.max(1, Math.floor(quantite)), possedes); n >= 1; n--) {
    const donne = prendre(p.inventaire, p.sac, objet, n);
    const recu = ranger(donne.inventaire, donne.sac, OBJET_OR, n * achat.prix);
    if (recu.reste > 0) continue;
    return {
      ok: true,
      inventaire: recu.inventaire,
      sac: recu.sac,
      etat: p.etat,
      quantite: n,
      or: n * achat.prix,
      message: `Vendu : ${n} ${minuscule(objet)} (+${n * achat.prix} or)`,
    };
  }
  return refus('inventaire-plein');
}

// --- Paroles -------------------------------------------------------------------------------------

const SALUTATIONS: readonly string[] = [
  "Ah, un client ! Approche, approche, j'ai fait trois jours de route pour arriver jusqu'ici, alors regarde bien tout ce que j'ai.",
  "Les chemins sont longs et mes pieds sont fatigués, mais ton sourire me remet d'aplomb. Regarde mes marchandises, et si tu as du trop-plein, je te le prends.",
  "Bonjour, bonjour ! Potions, flèches, lingots... et je rachète tout ce que la forêt t'a donné. Je ne repasse que dans quelques jours, profites-en.",
  "Tiens, mon village préféré ! Pose ton sac, jette un œil, et dis-moi ce qui te ferait plaisir : je connais tous les prix par cœur.",
];

/** Salutation du marchand à l'ouverture de l'écran : change d'une ouverture à l'autre (`ouvertures` : nombre d'ouvertures déjà faites). */
export function salutation(visite: number, ouvertures: number): string {
  return SALUTATIONS[(Math.max(0, visite) + Math.max(0, ouvertures)) % SALUTATIONS.length];
}

export const ANNONCE_ARRIVEE = 'Un marchand ambulant est arrivé sur la place';
