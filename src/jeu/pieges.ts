// Pièges : pose (case 6, clic gauche), prise après quelques minutes de jeu, relève avec E, modèles 3D.
import { CONFIG } from '../config';
import { INFOS_DECOR, estArbre } from '../monde/decor';
import { positionDevant, verifierPoseFeu, MESSAGES_REFUS_FEU } from '../regles/campement';
import { pilesDuButin, repartirButin } from '../regles/butin';
import { ajouter, compter, retirer } from '../regles/inventaire';
import {
  MESSAGES_REFUS_PIEGE,
  OBJET_PIEGE,
  mettreAJourPieges,
  piegeAPortee,
  poserPiege,
  releverPiege,
  reprendrePiege,
  verifierPiege,
  type Piege,
} from '../regles/pieges';
import { creerModelePiege, type ModelePiege } from '../scene/modelePiege';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesPieges {
  rafraichirInventaire: () => void;
}

export function creerPieges(jeu: EtatJeu, ctx: Contexte, dep: DependancesPieges) {
  const { scene, terrain, decor, mine, compteur, invite } = ctx;
  const modeles = new Map<string, { modele: ModelePiege; prise: string }>();

  /** Les modèles 3D reflètent `jeu.pieges` (créés, placés, fourrure visible quand le piège est plein). */
  function synchroniser(): void {
    // Pièges repris : leur modèle quitte la scène
    for (const [id, m] of modeles) {
      if (jeu.pieges.some((p) => p.id === id)) continue;
      scene.remove(m.modele.objet);
      m.modele.liberer();
      modeles.delete(id);
    }
    for (const p of jeu.pieges) {
      let m = modeles.get(p.id);
      if (!m) {
        const modele = creerModelePiege();
        modele.placer(p.x, terrain.hauteur(p.x, p.z), p.z, (Number(p.id.slice(2)) * 2.3) % (Math.PI * 2));
        scene.add(modele.objet);
        m = { modele, prise: '?' };
        modeles.set(p.id, m);
      }
      const prise = p.etat === 'plein' ? (p.prise ?? '') : '';
      if (m.prise !== prise) {
        m.modele.definirPrise(p.etat === 'plein' && p.prise ? p.prise : null);
        m.prise = prise;
      }
    }
  }
  synchroniser();

  /** Clic gauche avec le piège en main : le pose devant le personnage. */
  function poser(): void {
    const { etat } = jeu;
    if (compter(jeu.inventaire, OBJET_PIEGE) < 1) {
      compteur.annoncerMessage('Pas de piège (à fabriquer à l’établi)');
      return;
    }
    const p = positionDevant(etat.x, etat.z, etat.orientation, CONFIG.pieges.distancePose);
    if (mine.contient(etat.x, etat.z) || mine.contient(p.x, p.z)) {
      compteur.annoncerMessage('Impossible de poser un piège ici');
      return;
    }
    const voisins = decor
      .elementsAutour(p.x, p.z, 6)
      .filter((e) => estArbre(e.type) || e.rayonCollision > 0)
      .map((e) => ({ x: e.x, z: e.z, rayon: estArbre(e.type) ? INFOS_DECOR[e.type].rayonCollision * e.echelle : e.rayonCollision }));
    const terrainOk = verifierPoseFeu(p.x, p.z, terrain, voisins);
    if (!terrainOk.ok) {
      compteur.annoncerMessage(MESSAGES_REFUS_FEU[terrainOk.raison].replace('feu', 'piège'));
      return;
    }
    const verdict = verifierPiege(jeu.pieges, p.x, p.z, terrain.biomeDominant(p.x, p.z).id);
    if (!verdict.ok) {
      compteur.annoncerMessage(MESSAGES_REFUS_PIEGE[verdict.raison]);
      return;
    }
    jeu.pieges = poserPiege(jeu.pieges, p.x, p.z, jeu.tempsJeu);
    jeu.inventaire = retirer(jeu.inventaire, OBJET_PIEGE, 1).conteneur;
    dep.rafraichirInventaire();
    synchroniser();
    compteur.annoncerMessage('Piège posé');
  }

  /** Le piège plein à portée de relève, ou null. */
  function pleinAPortee(): Piege | null {
    return piegeAPortee(jeu.pieges, jeu.etat.x, jeu.etat.z, 'plein');
  }

  /** Le piège vide (en attente) à portée, ou null : E le reprend. */
  function videAPortee(): Piege | null {
    return piegeAPortee(jeu.pieges, jeu.etat.x, jeu.etat.z, 'attente');
  }

  /** E près d'un piège vide : il revient dans l'inventaire. */
  function reprendreProche(): boolean {
    const piege = videAPortee();
    if (!piege) return false;
    const r = ajouter(jeu.inventaire, OBJET_PIEGE, 1);
    if (r.reste > 0) {
      invite.annoncer('Inventaire plein');
      return true;
    }
    jeu.inventaire = r.conteneur;
    jeu.pieges = reprendrePiege(jeu.pieges, piege.id);
    dep.rafraichirInventaire();
    synchroniser();
    compteur.annoncerMessage('Piège repris');
    return true;
  }

  /**
   * E : relève le piège plein proche (le butin va dans l'inventaire, le piège reste), sinon reprend le piège vide
   * proche. Renvoie vrai si un piège était là.
   */
  function releverProche(): boolean {
    const piege = pleinAPortee();
    if (!piege) return reprendreProche();
    const r = releverPiege(piege, jeu.tempsJeu);
    if (!r) return false;
    const rep = repartirButin(jeu.inventaire, jeu.sac, pilesDuButin(r.butin));
    if (rep.reste.length > 0) {
      invite.annoncer('Inventaire plein');
      return true;
    }
    jeu.inventaire = rep.inventaire;
    jeu.sac = rep.sac;
    jeu.pieges = jeu.pieges.map((p) => (p.id === piege.id ? r.piege : p));
    dep.rafraichirInventaire();
    synchroniser();
    compteur.annoncerObjets(rep.obtenu);
    invite.annoncer(r.proie === 'renard' ? 'Un renard dans le piège !' : 'Un lapin dans le piège !');
    return true;
  }

  /** À chaque image : les pièges dont le délai est passé se remplissent. */
  function mettreAJour(): void {
    const suite = mettreAJourPieges(jeu.pieges, jeu.tempsJeu);
    if (suite !== jeu.pieges) {
      jeu.pieges = suite;
      synchroniser();
    }
  }

  return { poser, releverProche, pleinAPortee, videAPortee, mettreAJour };
}

export type PiegesJeu = ReturnType<typeof creerPieges>;
