// Potager de la maison du joueur et seau de Mathilde : E au puits remplit le seau, E au potager l'arrose ou récolte.
// Rien n'est imposé : un potager pas arrosé ne pousse pas, mais ne meurt jamais.
import { CONFIG } from '../config';
import { ajouter, compter, retirer, type Conteneur } from '../regles/inventaire';
import { arroser, estArrose, recoltePrete, recolter } from '../regles/potager';
import { jourDeJeu } from '../regles/progression';
import { pointPotagerMaison, pointPuits, type PointInteraction } from '../regles/village';
import type { EvenementQuete } from '../regles/quetes';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesPotager {
  rafraichirInventaire: () => void;
  signalerQuete: (ev: EvenementQuete) => void;
}

export function creerPotager(jeu: EtatJeu, ctx: Contexte, dep: DependancesPotager) {
  const { invite } = ctx;
  const jour = (): number => jourDeJeu(jeu.tempsJeu);
  const possede = (objet: string): boolean => compter(jeu.inventaire, objet) + compter(jeu.sac, objet) > 0;

  /** Remplace un objet par un autre dans le conteneur qui le contient (inventaire porté d'abord, puis sac). */
  function transformer(de: string, vers: string): boolean {
    for (const cle of ['inventaire', 'sac'] as const) {
      const c: Conteneur = jeu[cle];
      if (compter(c, de) < 1) continue;
      const vide = retirer(c, de, 1).conteneur;
      jeu[cle] = ajouter(vide, vers, 1).conteneur;
      dep.rafraichirInventaire();
      return true;
    }
    return false;
  }

  /** Points proposés en ce moment : le puits avec un seau vide, le potager à récolter ou à arroser. */
  function interactions(): PointInteraction[] {
    const points: PointInteraction[] = [];
    const puits = pointPuits(jeu.niveauVillage);
    if (puits && possede('seau')) points.push(puits);
    const potager = pointPotagerMaison(jeu.niveauVillage);
    if (potager) {
      if (recoltePrete(jeu.potager, jour())) points.push({ ...potager, invite: 'récolter le potager' });
      else if (possede('seau-eau') && !estArrose(jeu.potager, jour())) points.push(potager);
    }
    return points;
  }

  function remplirLeSeau(): void {
    if (transformer('seau', 'seau-eau')) invite.annoncer("Le seau est plein d'eau");
  }

  function surPotager(): void {
    const j = jour();
    if (recoltePrete(jeu.potager, j)) {
      const r = recolter(jeu.potager, j, CONFIG.graine);
      let { inventaire, sac } = jeu;
      for (const pile of r.butin) {
        const porte = ajouter(inventaire, pile.objet, pile.quantite);
        const range = ajouter(sac, pile.objet, porte.reste);
        if (range.reste > 0) {
          invite.annoncer('Inventaire plein : la récolte attend');
          return;
        }
        inventaire = porte.conteneur;
        sac = range.conteneur;
      }
      jeu.inventaire = inventaire;
      jeu.sac = sac;
      jeu.potager = r.etat;
      dep.rafraichirInventaire();
      ctx.compteur.annoncerObjets(Object.fromEntries(r.butin.map((p) => [p.objet, p.quantite])));
      invite.annoncer('Tu récoltes ton potager. Il reprendra si tu l’arroses de nouveau');
      return;
    }
    if (!possede('seau-eau') || estArrose(jeu.potager, j)) return;
    transformer('seau-eau', 'seau');
    jeu.potager = arroser(jeu.potager, j);
    invite.annoncer('Le potager boit l’eau avec plaisir');
    dep.signalerQuete({ type: 'potagerArrose' });
  }

  function surInteraction(type: 'puits' | 'potager'): void {
    if (type === 'puits') remplirLeSeau();
    else surPotager();
  }

  return { interactions, surInteraction };
}

export type PotagerJeu = ReturnType<typeof creerPotager>;
