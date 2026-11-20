// Amélioration du village (niveau 1 -> 2 -> 3) : coûts, vérification et application.
// Pur : aucun import de three, aucun Math.random(). Les ressources sont prises dans l'inventaire porté,
// puis dans le coffre du village. Le changement des modèles et des obstacles est fait par main.ts.

import { CONFIG } from '../config';
import { consommer, type Ingredient } from './fabrication';
import { compter, type Conteneur } from './inventaire';
import { queteDeblocageVillage } from './quetes';
import { NIVEAU_VILLAGE_MAX, type NiveauVillage } from './village';

/** Coût pour atteindre un niveau (clé : niveau visé). */
export const COUTS_AMELIORATION: Readonly<Record<2 | 3, readonly Ingredient[]>> = {
  2: [
    { objet: 'bois', quantite: 40 },
    { objet: 'pierre', quantite: 30 },
    { objet: 'or', quantite: 10 },
  ],
  3: [
    { objet: 'bois', quantite: 80 },
    { objet: 'pierre', quantite: 60 },
    { objet: 'lingot-fer', quantite: 6 },
    { objet: 'or', quantite: 40 },
  ],
};

/** Coût du niveau suivant, ou `null` si le village est au niveau maximal. */
export function coutAmelioration(niveau: NiveauVillage): readonly Ingredient[] | null {
  return niveau >= NIVEAU_VILLAGE_MAX ? null : COUTS_AMELIORATION[(niveau + 1) as 2 | 3];
}

export interface EtatAmelioration {
  readonly niveau: NiveauVillage;
  readonly inventaire: Conteneur;
  readonly coffre: Conteneur;
  /** Plus haut niveau autorisé par les quêtes (voir `niveauVillageDebloque` dans quetes.ts) */
  readonly niveauDebloque: number;
}

/** Vrai si une quête a déjà autorisé le passage au niveau suivant. */
export function ameliorationDebloquee(etat: Pick<EtatAmelioration, 'niveau' | 'niveauDebloque'>): boolean {
  return etat.niveauDebloque >= etat.niveau + 1;
}

/** Message de blocage : quelle quête de Gaspard autorise le niveau suivant. */
export function messageBlocage(niveauVise: number): string {
  const quete = queteDeblocageVillage(niveauVise);
  return quete
    ? `Gaspard n'autorise pas encore cet agrandissement : termine la quête « ${quete.titre} »`
    : "Cet agrandissement n'est pas encore autorisé";
}

/** Quantité possédée d'un objet : inventaire porté + coffre. */
export function quantiteDisponible(etat: Pick<EtatAmelioration, 'inventaire' | 'coffre'>, objet: string): number {
  return compter(etat.inventaire, objet) + compter(etat.coffre, objet);
}

/** Vrai si le niveau suivant existe et si toutes les ressources sont là. */
export function peutAmeliorer(etat: EtatAmelioration): boolean {
  const cout = coutAmelioration(etat.niveau);
  return cout !== null && ameliorationDebloquee(etat) && cout.every((i) => quantiteDisponible(etat, i.objet) >= i.quantite);
}

export type ResultatAmelioration =
  | { ok: true; etat: EtatAmelioration; xp: number; message: string }
  | { ok: false; etat: EtatAmelioration; xp: 0; message: string };

/** Améliore le village d'un niveau. Refus : l'état renvoyé est celui reçu, rien n'est consommé. */
export function ameliorer(etat: EtatAmelioration): ResultatAmelioration {
  const cout = coutAmelioration(etat.niveau);
  if (cout === null) return { ok: false, etat, xp: 0, message: 'Le village est au niveau maximal' };
  if (!ameliorationDebloquee(etat)) return { ok: false, etat, xp: 0, message: messageBlocage(etat.niveau + 1) };
  if (!peutAmeliorer(etat)) return { ok: false, etat, xp: 0, message: 'Il manque des ressources' };
  let { inventaire, coffre } = etat;
  for (const ingredient of cout) ({ inventaire, coffre } = consommer(inventaire, coffre, ingredient));
  return {
    ok: true,
    etat: { ...etat, niveau: (etat.niveau + 1) as NiveauVillage, inventaire, coffre },
    xp: CONFIG.village.xpAmelioration,
    message: 'Le village grandit !',
  };
}
