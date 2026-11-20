// Barre d'outils : les six emplacements choisis par le joueur (touches 1 à 6, molette).
// Pur : aucun import de three.

import type { OutilRecolte } from './recolte';

/**
 * Ce que le joueur tient : l'un des trois outils, un objet posable de la case 6 (pousses d'arbre ou piège : clic gauche = poser)
 * la torche (elle éclaire) ou l'arc (clic maintenu : tendre, relâcher : tirer). `piege` n'a pas de case à lui :
 * c'est la case 6 quand on y rappuie.
 */
export type EmplacementBarre = OutilRecolte | 'pousse' | 'piege' | 'torche' | 'arc';

/** Dans l'ordre des touches : 1 = épée, 2 = hache, 3 = pioche, 4 = arc, 5 = torche, 6 = objets posables (pousses d'arbre, piège). */
export const EMPLACEMENTS_BARRE: readonly EmplacementBarre[] = ['epee', 'hache', 'pioche', 'arc', 'torche', 'pousse'];

/** Touches de la barre : rangée de chiffres puis pavé numérique, une par emplacement. */
export const TOUCHES_BARRE: readonly string[] = ['Digit', 'Numpad'].flatMap((rangee) => EMPLACEMENTS_BARRE.map((_, i) => `${rangee}${i + 1}`));

/** Vrai si l'emplacement est un outil qui frappe (épée, hache, pioche) : ni les objets posables, ni la torche, ni l'arc. */
export function estOutil(emplacement: EmplacementBarre): emplacement is OutilRecolte {
  return emplacement !== 'pousse' && emplacement !== 'piege' && emplacement !== 'torche' && emplacement !== 'arc';
}

/**
 * Emplacement choisi en appuyant sur une touche de la barre. Rappuyer sur 6 alors qu'on tient déjà un objet posable
 * passe des pousses d'arbre au piège, et inversement ; toute autre touche choisit sa case (la 6 donne les pousses).
 */
export function emplacementApresTouche(actuel: EmplacementBarre, code: string): EmplacementBarre | null {
  const choisi = emplacementDeTouche(code);
  if (choisi === 'pousse' && actuel === 'pousse') return 'piege';
  return choisi;
}

/** Emplacement d'une touche (`Digit1`, `Numpad3`...), ou null si ce n'est pas une touche de la barre. */
export function emplacementDeTouche(code: string): EmplacementBarre | null {
  const m = /^(?:Digit|Numpad)([1-9])$/.exec(code);
  if (!m) return null;
  return EMPLACEMENTS_BARRE[Number(m[1]) - 1] ?? null;
}

/**
 * Emplacement voisin (sens > 0 : suivant, sens < 0 : précédent), en bouclant.
 * `sansArc` : l'arc n'est pas possédé, la molette saute sa case.
 */
export function emplacementVoisin(actuel: EmplacementBarre, sens: number, sansArc = false): EmplacementBarre {
  const n = EMPLACEMENTS_BARRE.length;
  const pas = sens > 0 ? 1 : -1;
  const i = EMPLACEMENTS_BARRE.indexOf(actuel === 'piege' ? 'pousse' : actuel);
  const voisin = EMPLACEMENTS_BARRE[(i + pas + n) % n];
  return sansArc && voisin === 'arc' ? EMPLACEMENTS_BARRE[(i + 2 * pas + n) % n] : voisin;
}
