// Ruines et petites grottes dans le jeu (placement : src/monde/ruines.ts ; affichage : src/monde/renduRuines.ts) :
// petit coffre à ouvrir une seule fois avec E (contenu tiré de la graine, règles : src/regles/tresors.ts), et
// cristaux bleus des grottes, confiés au décor pour être récoltés à la pioche et repousser comme ceux de la mine.
import { CONFIG } from '../config';
import type { ElementDecor } from '../monde/decor';
import type { CoffreSite } from '../monde/ruines';
import { repartirButin } from '../regles/butin';
import { coffreAPortee, contenuDuCoffre, garderReste, ouvrirCoffre } from '../regles/tresors';
import type { Contexte } from './contexte';
import type { LieuxJeu } from './lieux';
import type { EtatJeu } from './partie';

export interface DependancesRuines {
  rafraichirInventaire: () => void;
  /** Coffres de butin du camp des bandits (ils s'ouvrent comme ceux des ruines) */
  lieux: LieuxJeu;
}

// Intervalle entre deux contrôles des cristaux des grottes, en secondes
const INTERVALLE_CRISTAUX = 0.4;

export function creerRuinesJeu(jeu: EtatJeu, ctx: Contexte, dep: DependancesRuines) {
  const { ruines, decor, mine, compteur, invite } = ctx;
  const C = CONFIG.ruines.coffre;
  // Cristaux de grotte actuellement confiés au décor
  const cristauxAffiches = new Map<string, ElementDecor>();
  let delaiCristaux = 0;
  ruines.definirCoffresOuverts(jeu.tresorsOuverts);

  /** Coffre fermé à portée du joueur (le plus proche) et son genre de site, ou null. */
  function coffreProche(): (CoffreSite & { grotte: boolean }) | null {
    const { x, z } = jeu.etat;
    if (mine.contient(x, z)) return null;
    const coffres: Array<CoffreSite & { grotte: boolean }> = [];
    for (const s of ruines.sitesCharges()) {
      if (s.coffre && Math.abs(s.x - x) < s.rayon + C.portee && Math.abs(s.z - z) < s.rayon + C.portee) coffres.push({ ...s.coffre, grotte: s.genre === 'grotte' });
    }
    // Coffres de butin du camp des bandits
    for (const c of dep.lieux.coffresCamp()) coffres.push({ id: c.id, x: c.x, z: c.z, y: 0, lacet: 0, grotte: false });
    return coffreAPortee(coffres, jeu.tresorsOuverts, x, z, C.portee);
  }

  /** Vrai si un coffre fermé est à portée (invite « E : ouvrir le coffre »). */
  function coffreFermeAPortee(): boolean {
    return coffreProche() !== null;
  }

  /** Touche E : ouvre le coffre à portée et donne son contenu. Renvoie vrai s'il y en avait un. */
  function ouvrirCoffreProche(): boolean {
    const coffre = coffreProche();
    if (!coffre) return false;
    const contenu = contenuDuCoffre(jeu.tresorsEntames, CONFIG.graine, coffre.id, coffre.grotte);
    const r = repartirButin(jeu.inventaire, jeu.sac, contenu);
    // Rien ne rentre : le coffre reste fermé, intact
    if (Object.keys(r.obtenu).length === 0) {
      invite.annoncer('Inventaire plein');
      return true;
    }
    jeu.inventaire = r.inventaire;
    jeu.sac = r.sac;
    // Ce qui ne rentre pas reste dans le coffre (sauvegardé) ; il n'est « ouvert » qu'une fois vide
    jeu.tresorsEntames = garderReste(jeu.tresorsEntames, coffre.id, r.reste);
    if (r.reste.length === 0) {
      jeu.tresorsOuverts = ouvrirCoffre(jeu.tresorsOuverts, coffre.id);
      ruines.ouvrirCoffre(coffre.id);
      dep.lieux.ouvrirCoffreCamp(coffre.id);
    }
    dep.rafraichirInventaire();
    compteur.annoncerObjets(r.obtenu);
    invite.annoncer(r.reste.length > 0 ? 'Inventaire plein : le reste attend dans le coffre' : 'Coffre ouvert');
    return true;
  }

  /** Les cristaux des grottes affichées sont dans le décor s'ils ne sont pas récoltés ; ceux des grottes parties en sortent. */
  function synchroniserCristaux(): void {
    const voulus = new Map<string, ElementDecor>();
    let recoltes: Set<string> | null = null;
    for (const s of ruines.sitesCharges()) {
      if (s.cristaux.length === 0) continue;
      recoltes ??= new Set(jeu.retires.map((r) => r.id));
      for (const c of s.cristaux) if (!recoltes.has(c.id)) voulus.set(c.id, c);
    }
    for (const id of [...cristauxAffiches.keys()]) {
      if (voulus.has(id)) continue;
      // Récolté : le décor l'a déjà retiré ; sinon sa grotte vient de disparaître avec son chunk
      if (!recoltes?.has(id)) decor.retirer(id);
      cristauxAffiches.delete(id);
    }
    for (const [id, c] of voulus) {
      if (cristauxAffiches.has(id)) continue;
      decor.ajouterDynamique({ ...c }, 1, true);
      cristauxAffiches.set(id, c);
    }
  }

  /** À chaque image : couvercles des coffres, et de temps en temps les cristaux des grottes. */
  function mettreAJour(dt: number): void {
    ruines.mettreAJour(dt);
    delaiCristaux -= dt;
    if (delaiCristaux <= 0) {
      delaiCristaux = INTERVALLE_CRISTAUX;
      synchroniserCristaux();
    }
  }

  return { coffreFermeAPortee, ouvrirCoffreProche, mettreAJour };
}

export type RuinesJeu = ReturnType<typeof creerRuinesJeu>;
