// Repères personnels : le joueur pose lui-même ses repères sur la carte agrandie (décision du 19/11/2026,
// la boussole ne guide plus vers les quêtes). 8 au plus, 5 types, un repère peut être « suivi » (la boussole écrit
// son nom et sa distance) ; le village peut aussi être suivi, sans repère à poser. Gardés dans la sauvegarde.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable.

/** Les cinq types de repères, dans l'ordre du menu de la carte. */
export const TYPES_REPERE = ['filon', 'cueillette', 'danger', 'tresor', 'lieu'] as const;
export type TypeRepereJoueur = (typeof TYPES_REPERE)[number];

/** Nom affiché de chaque type. */
export const NOMS_TYPES_REPERE: Readonly<Record<TypeRepereJoueur, string>> = {
  filon: 'Filon',
  cueillette: 'Cueillette',
  danger: 'Danger',
  tresor: 'Trésor',
  lieu: 'Lieu à revoir',
};

/** Nombre maximal de repères posés en même temps. */
export const MAX_REPERES = 8;

/** Un repère posé par le joueur, en coordonnées du monde. */
export interface RepereJoueur {
  readonly id: number;
  readonly type: TypeRepereJoueur;
  readonly x: number;
  readonly z: number;
}

/** Ce que suit la boussole : un repère (par son id), le village, ou rien. */
export type Suivi = number | 'village' | null;

export interface EtatReperes {
  readonly liste: readonly RepereJoueur[];
  /** Identifiant du prochain repère posé (jamais réutilisé) */
  readonly prochainId: number;
  readonly suivi: Suivi;
}

export function etatReperesInitial(): EtatReperes {
  return { liste: [], prochainId: 1, suivi: null };
}

export function estTypeRepere(valeur: unknown): valeur is TypeRepereJoueur {
  return typeof valeur === 'string' && (TYPES_REPERE as readonly string[]).includes(valeur);
}

export type ResultatPose = { ok: true; etat: EtatReperes; repere: RepereJoueur } | { ok: false; raison: 'plein' };

/** Message à afficher quand la pose est refusée. */
export const MESSAGE_REPERES_PLEIN = `${MAX_REPERES} repères au plus : retire-en un d’abord`;

/** Pose un repère ; refusé s'il y en a déjà `MAX_REPERES`. Le nouveau repère n'est pas suivi d'office. */
export function poserRepere(etat: EtatReperes, type: TypeRepereJoueur, x: number, z: number): ResultatPose {
  if (etat.liste.length >= MAX_REPERES) return { ok: false, raison: 'plein' };
  const repere: RepereJoueur = { id: etat.prochainId, type, x, z };
  return { ok: true, repere, etat: { ...etat, liste: [...etat.liste, repere], prochainId: etat.prochainId + 1 } };
}

/** Retire un repère (rien ne change s'il n'existe pas). S'il était suivi, la boussole ne suit plus rien. */
export function retirerRepere(etat: EtatReperes, id: number): EtatReperes {
  if (!etat.liste.some((r) => r.id === id)) return etat;
  return { ...etat, liste: etat.liste.filter((r) => r.id !== id), suivi: etat.suivi === id ? null : etat.suivi };
}

/** Suit un repère existant, le village, ou plus rien (`null`). Un id inconnu ne change rien. */
export function suivre(etat: EtatReperes, suivi: Suivi): EtatReperes {
  if (typeof suivi === 'number' && !etat.liste.some((r) => r.id === suivi)) return etat;
  if (etat.suivi === suivi) return etat;
  return { ...etat, suivi };
}

/**
 * Relit les repères d'une sauvegarde : tout ce qui est abîmé est ignoré (repère mal formé, type inconnu,
 * doublon d'id, au-delà de `MAX_REPERES`) ; une valeur absente donne l'état initial (anciennes parties).
 */
export function lireReperes(donnees: unknown): EtatReperes {
  if (typeof donnees !== 'object' || donnees === null) return etatReperesInitial();
  const d = donnees as { liste?: unknown; prochainId?: unknown; suivi?: unknown };
  const liste: RepereJoueur[] = [];
  if (Array.isArray(d.liste)) {
    for (const r of d.liste as unknown[]) {
      if (liste.length >= MAX_REPERES) break;
      if (typeof r !== 'object' || r === null) continue;
      const { id, type, x, z } = r as Record<string, unknown>;
      if (typeof id !== 'number' || !Number.isSafeInteger(id) || id < 1) continue;
      if (!estTypeRepere(type) || typeof x !== 'number' || typeof z !== 'number' || !Number.isFinite(x) || !Number.isFinite(z)) continue;
      if (liste.some((autre) => autre.id === id)) continue;
      liste.push({ id, type, x, z });
    }
  }
  const plusGrand = liste.reduce((m, r) => Math.max(m, r.id), 0);
  const prochainId =
    typeof d.prochainId === 'number' && Number.isSafeInteger(d.prochainId) && d.prochainId > plusGrand ? d.prochainId : plusGrand + 1;
  const suivi: Suivi =
    d.suivi === 'village' ? 'village' : typeof d.suivi === 'number' && liste.some((r) => r.id === d.suivi) ? d.suivi : null;
  return { liste, prochainId, suivi };
}
