// Repousse et plantation : éléments récoltés qui reviennent, pousses d'arbres plantées (clic droit).
import { CONFIG } from '../config';
import { INFOS_DECOR, estArbre, type ElementDecor } from '../monde/decor';
import { compter, retirer as retirerObjets } from '../regles/inventaire';
import type { DonneesPartie } from '../regles/sauvegarde';
import type { EvenementQuete } from '../regles/quetes';
import {
  aReapparaitre,
  creerPlante,
  echelleDuStade,
  estAdulte,
  estBuisson,
  MESSAGES_REFUS,
  stadeDeCroissance,
  verifierPlantation,
  type Plante,
  type Stade,
} from '../regles/repousse';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesRepousse {
  rafraichirInventaire: () => void;
  signalerQuete: (ev: EvenementQuete) => void;
}

/** `partie` : partie chargée (on cache de nouveau ce qui était retiré et on replante les arbres), ou null. */
export function creerRepousse(jeu: EtatJeu, ctx: Contexte, dep: DependancesRepousse, partie: DonneesPartie | null) {
  const { decor, mine, terrain, compteur, vues } = ctx;
  // Stade affiché de chaque arbre planté
  const stadesAffiches = new Map<string, Stade>();
  let delaiVerifRepousse = 0;

  /** Un buisson cueilli reste en place, sans baies : élément affiché à part, non récoltable. */
  function montrerBuissonVide(buisson: ElementDecor): void {
    decor.ajouterDynamique({ ...buisson, id: `v:${buisson.id}`, variante: 1, rayonCollision: 0 }, 1, false);
  }

  /** Élément du décor correspondant à un arbre planté. */
  function elementDePlante(p: Plante): ElementDecor {
    const infos = INFOS_DECOR[p.type];
    return {
      id: p.id,
      type: p.type,
      x: p.x,
      y: terrain.hauteur(p.x, p.z) - infos.enfoncement * p.echelle,
      z: p.z,
      rotation: p.rotation,
      echelle: p.echelle,
      variante: p.variante,
      teinte: 0.5,
      rayonCollision: infos.rayonCollision * p.echelle,
    };
  }

  function afficherPlante(p: Plante): void {
    const stade = stadeDeCroissance(p, jeu.tempsJeu);
    stadesAffiches.set(p.id, stade);
    decor.ajouterDynamique(elementDePlante(p), echelleDuStade(stade), estAdulte(stade));
  }

  // Partie chargée : on cache de nouveau ce qui était retiré et on replante les arbres
  if (partie) {
    for (const r of partie.retires) {
      decor.retirer(r.id);
      const e = decor.chercher(r.id) ?? mine.element(r.id) ?? ctx.ruines.cristal(r.id);
      if (!e) continue;
      jeu.retires.push({ ...r, type: e.type, x: e.x, z: e.z });
      if (estBuisson(e.type)) montrerBuissonVide(e);
    }
    jeu.plantes.forEach(afficherPlante);
  }

  /** Un élément vient d'être récolté : retiré du monde (buisson : il reste, sans baies), ou arbre planté abattu. */
  function marquerRecolte(cible: ElementDecor): void {
    decor.retirer(cible.id);
    if (cible.id.startsWith('p:')) {
      jeu.plantes = jeu.plantes.filter((p) => p.id !== cible.id);
      stadesAffiches.delete(cible.id);
      return;
    }
    jeu.retires.push({ id: cible.id, instant: jeu.tempsJeu, type: cible.type, x: cible.x, z: cible.z });
    if (estBuisson(cible.type)) montrerBuissonVide(cible);
  }

  /** Environ une fois par seconde : réapparitions et croissance des pousses. */
  function verifierRepousse(): void {
    for (const r of aReapparaitre(jeu.retires, jeu.tempsJeu, { x: jeu.etat.x, z: jeu.etat.z })) {
      if (r.id.startsWith('m:')) mine.remettre(r.id);
      else decor.restaurer(r.id);
      if (estBuisson(r.type)) decor.retirer(`v:${r.id}`);
      // L'élément est de nouveau intact
      const pv = { ...jeu.etatRecolte.pv };
      delete pv[r.id];
      jeu.etatRecolte = { pv };
      jeu.retires = jeu.retires.filter((x) => x.id !== r.id);
    }
    for (const p of jeu.plantes) {
      const stade = stadeDeCroissance(p, jeu.tempsJeu);
      if (stadesAffiches.get(p.id) === stade) continue;
      stadesAffiches.set(p.id, stade);
      decor.definirStade(p.id, echelleDuStade(stade), estAdulte(stade));
    }
  }

  /** Appelé à chaque image, après le temps du jeu : vérifie la repousse environ une fois par seconde. */
  function mettreAJour(dt: number): void {
    delaiVerifRepousse -= dt;
    if (delaiVerifRepousse <= 0) {
      delaiVerifRepousse = CONFIG.repousse.intervalleVerification;
      verifierRepousse();
    }
  }

  /** Point du sol visé (centre de l'écran), ou null si le rayon part dans le ciel. */
  function pointDuSolVise(): { x: number; z: number } | null {
    const { origine, direction } = vues.rayonVisee;
    const sous = (d: number) =>
      origine.y + direction.y * d < terrain.hauteur(origine.x + direction.x * d, origine.z + direction.z * d);
    let avant = 0;
    for (let d = 0.5; d <= 80; d += 0.5) {
      if (sous(d)) {
        let a = avant;
        let b = d;
        for (let k = 0; k < 8; k++) {
          const m = (a + b) / 2;
          if (sous(m)) b = m;
          else a = m;
        }
        return { x: origine.x + direction.x * b, z: origine.z + direction.z * b };
      }
      avant = d;
    }
    return null;
  }

  /** Clic droit : plante une pousse d'arbre au point visé si le sol s'y prête. */
  function planter(): void {
    const { etat } = jeu;
    if (mine.contient(etat.x, etat.z)) {
      compteur.annoncerMessage('Rien ne pousse dans la mine');
      return;
    }
    if (compter(jeu.inventaire, 'pousse-arbre') < 1) {
      compteur.annoncerMessage("Pas de pousse d'arbre");
      return;
    }
    const point = pointDuSolVise();
    if (!point) {
      compteur.annoncerMessage('Vise le sol pour planter');
      return;
    }
    // Arbres (même jeunes) et obstacles proches ; un jeune arbre compte avec sa taille adulte
    const voisins = decor
      .elementsAutour(point.x, point.z, 6)
      .filter((e) => estArbre(e.type) || e.rayonCollision > 0)
      .map((e) => ({
        x: e.x,
        z: e.z,
        rayon: estArbre(e.type) ? INFOS_DECOR[e.type].rayonCollision * e.echelle : e.rayonCollision,
      }));
    const verdict = verifierPlantation(point.x, point.z, terrain, voisins, { x: etat.x, z: etat.z });
    if (!verdict.ok) {
      compteur.annoncerMessage(MESSAGES_REFUS[verdict.raison]);
      return;
    }
    const plante = creerPlante(jeu.compteurPlantes, point.x, point.z, terrain.biomeDominant(point.x, point.z).id, jeu.tempsJeu);
    jeu.compteurPlantes += 1;
    jeu.plantes.push(plante);
    afficherPlante(plante);
    jeu.inventaire = retirerObjets(jeu.inventaire, 'pousse-arbre', 1).conteneur;
    dep.rafraichirInventaire();
    dep.signalerQuete({ type: 'pousseePlantee' });
    compteur.annoncerMessage('Pousse plantée');
  }

  /** Stade affiché d'un arbre planté (undefined si l'identifiant n'est pas celui d'une pousse). */
  function stadeAffiche(id: string): Stade | undefined {
    return stadesAffiches.get(id);
  }

  return { marquerRecolte, mettreAJour, planter, stadeAffiche };
}

export type Repousse = ReturnType<typeof creerRepousse>;
