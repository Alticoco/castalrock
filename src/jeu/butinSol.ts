// Butin d'ennemi laissé au sol : quand l'inventaire porté et le sac magique sont pleins, ce qui ne rentre pas
// reste dans un petit sac (le modèle du baluchon, en plus petit, sans rayon de lumière). Touche E pour le ramasser :
// ce qui rentre est pris, le reste reste au sol. Le sac disparaît après quelques minutes ; il n'est pas sauvegardé.
import { CONFIG } from '../config';
import { butinAPortee, repartirButin, vieillirButins, type ButinAuSol } from '../regles/butin';
import type { Pile } from '../regles/inventaire';
import { creerModeleBaluchon, type ModeleBaluchon } from '../scene/modeleBaluchon';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesButinSol {
  rafraichirInventaire: () => void;
}

export function creerButinSol(jeu: EtatJeu, ctx: Contexte, dep: DependancesButinSol) {
  const { scene, compteur, invite } = ctx;
  const B = CONFIG.butinSol;
  let sacs: ButinAuSol[] = [];
  const modeles = new Map<string, ModeleBaluchon>();
  let compteurId = 0;

  function retirerModele(id: string): void {
    const modele = modeles.get(id);
    if (!modele) return;
    scene.remove(modele.objet);
    modele.liberer();
    modeles.delete(id);
  }

  /** Laisse `contenu` au sol en (x, y, z), dans un nouveau petit sac (le plus ancien disparaît s'il y en a trop). */
  function deposer(x: number, y: number, z: number, contenu: readonly Pile[]): void {
    if (contenu.length === 0) return;
    const id = `butin-${compteurId++}`;
    sacs.push({ id, x, y, z, contenu, age: 0 });
    const modele = creerModeleBaluchon({ echelle: B.echelle, avecRayon: false });
    modele.placer(x, y, z);
    scene.add(modele.objet);
    modeles.set(id, modele);
    if (sacs.length > B.maximum) invite.annoncer('Trop de sacs au sol : le plus ancien a disparu');
    while (sacs.length > B.maximum) retirerModele(sacs.shift()!.id);
  }

  /** Sac à portée du joueur (le plus proche), ou null. */
  function procheAPortee(): ButinAuSol | null {
    return butinAPortee(sacs, jeu.etat.x, jeu.etat.z, B.portee);
  }

  /** Vrai si un sac est à portée ET qu'au moins une partie de son contenu rentre (inventaire ou sac magique). */
  function ramassable(): boolean {
    const sac = procheAPortee();
    return sac !== null && Object.keys(repartirButin(jeu.inventaire, jeu.sac, sac.contenu).obtenu).length > 0;
  }

  /** Touche E : prend ce qui rentre du sac proche, le reste y reste. Renvoie vrai s'il y avait un sac à portée. */
  function ramasserProche(): boolean {
    const sac = procheAPortee();
    if (!sac) return false;
    const r = repartirButin(jeu.inventaire, jeu.sac, sac.contenu);
    jeu.inventaire = r.inventaire;
    jeu.sac = r.sac;
    dep.rafraichirInventaire();
    compteur.annoncerObjets(r.obtenu);
    if (r.reste.length === 0) {
      sacs = sacs.filter((s) => s.id !== sac.id);
      retirerModele(sac.id);
    } else {
      sacs = sacs.map((s) => (s.id === sac.id ? { ...s, contenu: r.reste } : s));
      invite.annoncer(Object.keys(r.obtenu).length > 0 ? 'Inventaire plein : une partie reste au sol' : 'Inventaire plein');
    }
    return true;
  }

  /** À chaque image : les sacs vieillissent et disparaissent au bout de `dureeVie`. */
  function mettreAJour(dt: number): void {
    if (sacs.length === 0) return;
    const restants = vieillirButins(sacs, dt, B.dureeVie);
    if (restants.length !== sacs.length) {
      const gardes = new Set(restants.map((s) => s.id));
      for (const s of sacs) if (!gardes.has(s.id)) retirerModele(s.id);
    }
    sacs = restants;
  }

  return { deposer, procheAPortee, ramassable, ramasserProche, mettreAJour };
}

export type ButinSol = ReturnType<typeof creerButinSol>;
