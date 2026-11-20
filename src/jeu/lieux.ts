// Lieux de l'histoire (règles : src/regles/lieux.ts) : le camp des bandits et les ruines de la forteresse de Castalrock
// (identifiant interne `autel`) dans le monde. Modèles 3D (montrés seulement quand le joueur n'est pas trop loin),
// découverte en s'approchant, reforge du Cœur face au cristal, au centre de la cour (touche E), repères de la mini-carte et téléportation de test (F8). Les occupants du camp sont dans chef.ts.
import { CONFIG } from '../config';
import { NOMS_LIEUX, decouvrir, inviteAutel, prochainLieu, reforgerCoeur, type IdLieu } from '../regles/lieux';
import type { PointInteraction } from '../regles/village';
import { creerModeleAutel, creerModeleCamp } from '../scene/modelesLieux';
import type { Fondu } from '../ui/fondu';
import type { Repere } from '../ui/miniCarte';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesLieux {
  fondu: Fondu;
  rafraichirInventaire: () => void;
  /** Fait passer tout de suite les étapes d'histoire que l'état du jeu remplit (lieu découvert, Cœur reforgé) */
  verifierHistoire: () => void;
}

export function creerLieux(jeu: EtatJeu, ctx: Contexte, dep: DependancesLieux) {
  const { scene, terrain, mine, invite, lieux, planCamp, planAutel } = ctx;
  const camp = creerModeleCamp(planCamp);
  const autel = creerModeleAutel(planAutel, (x, z) => terrain.hauteur(x, z));
  scene.add(camp.objet, autel.objet);
  autel.definirReforge(jeu.lieux.coeurReforge, false);

  // Coffres de butin du camp : couvercle ouvert d'emblée pour ceux déjà vidés, ouverture animée pour les autres
  const ouvertureCoffres = new Map<string, number>();
  const coffresEnMouvement = new Set<string>();
  for (const id of camp.coffres.keys()) {
    const ouvert = jeu.tresorsOuverts.includes(id);
    ouvertureCoffres.set(id, ouvert ? 1 : 0);
    camp.coffres.get(id)?.definirOuverture(ouvert ? 1 : 0);
  }

  /** Les coffres de butin du camp (position et identifiant), pour l'interaction avec E (src/jeu/ruines.ts). */
  function coffresCamp(): ReadonlyArray<{ id: string; x: number; z: number }> {
    return planCamp.coffres;
  }

  /** Un coffre du camp vient d'être vidé : son couvercle s'ouvre. */
  function ouvrirCoffreCamp(id: string): void {
    if (ouvertureCoffres.has(id)) coffresEnMouvement.add(id);
  }

  const pointAutel: PointInteraction = { type: 'autel', x: lieux.autel.x, z: lieux.autel.z, rayon: planAutel.rayonInteraction, invite: inviteAutel(jeu.lieux) };

  /** À chaque image : modèles montrés de près seulement, animations, découverte des lieux. */
  function mettreAJour(dt: number): void {
    const { x, z } = jeu.etat;
    const dehors = !mine.contient(x, z);
    const D = CONFIG.lieux.distanceAffichage;
    camp.objet.visible = dehors && Math.hypot(x - lieux.camp.x, z - lieux.camp.z) < D;
    autel.objet.visible = dehors && Math.hypot(x - lieux.autel.x, z - lieux.autel.z) < D;
    if (camp.objet.visible) camp.mettreAJour(dt);
    for (const id of coffresEnMouvement) {
      const t = Math.min(1, (ouvertureCoffres.get(id) ?? 0) + dt / CONFIG.ruines.coffre.dureeOuverture);
      ouvertureCoffres.set(id, t);
      camp.coffres.get(id)?.definirOuverture(1 - (1 - t) ** 2);
      if (t >= 1) coffresEnMouvement.delete(id);
    }
    if (autel.objet.visible) autel.mettreAJour(dt);
    if (!dehors || jeu.visite) return;
    const r = decouvrir(jeu.lieux, lieux, x, z);
    if (r.nouveaux.length === 0) return;
    jeu.lieux = r.etat;
    for (const id of r.nouveaux) invite.annoncer(`Lieu découvert : ${NOMS_LIEUX[id]}`);
    dep.verifierHistoire();
  }

  /** Points d'interaction des lieux (le Cœur de Castal, au centre des ruines). */
  function interactions(): PointInteraction[] {
    return [pointAutel];
  }

  /** Touche E face au cristal : reforge le Cœur si tout y est, sinon dit ce qu'il manque. */
  function reforger(): void {
    const r = reforgerCoeur(jeu.lieux, { inventaire: jeu.inventaire, coffre: jeu.coffre, sac: jeu.sac });
    if (!r.ok) {
      invite.annoncer(r.message);
      return;
    }
    jeu.lieux = r.etat;
    jeu.inventaire = r.contenants.inventaire;
    jeu.coffre = r.contenants.coffre;
    jeu.sac = r.contenants.sac;
    pointAutel.invite = inviteAutel(jeu.lieux);
    autel.definirReforge(true, true);
    dep.rafraichirInventaire();
    invite.annoncer('Le Cœur de Castal est reforgé !');
    dep.verifierHistoire();
  }

  /** F8 (outil de test) : téléporte devant le prochain lieu de l'histoire, le camp puis la porte des ruines de Castalrock. */
  function teleporterAuProchain(): void {
    if (jeu.vie.pv <= 0) {
      invite.annoncer('Impossible pour le moment');
      return;
    }
    if (jeu.pilote) {
      invite.annoncer("Arrête d'abord le pilote (P)");
      return;
    }
    const id: IdLieu = prochainLieu(jeu.lieux);
    const { x, z, orientation } = id === 'camp' ? planCamp.arrivee : planAutel.arrivee;
    dep.fondu.jouer(() => {
      jeu.etat = { ...jeu.etat, x, y: terrain.hauteur(x, z), z, orientation, vx: 0, vy: 0, vz: 0, auSol: true, nage: false, glisse: false, grimpe: false, sautBloque: false };
      jeu.pointsSurs = [];
      // Le regard se tourne vers le lieu, dans toutes les vues
      ctx.vues.regarderVers(orientation);
      invite.annoncer(`${NOMS_LIEUX[id]} (test)`);
    });
  }

  /** Repères de la mini-carte : les lieux déjà découverts. */
  function reperes(): Repere[] {
    const liste: Repere[] = [];
    if (jeu.lieux.campDecouvert) liste.push({ type: 'camp', x: lieux.camp.x, z: lieux.camp.z });
    if (jeu.lieux.autelDecouvert) liste.push({ type: 'autel', x: lieux.autel.x, z: lieux.autel.z });
    return liste;
  }

  return { mettreAJour, coffresCamp, ouvrirCoffreCamp, interactions, reforger, teleporterAuProchain, reperes };
}

export type LieuxJeu = ReturnType<typeof creerLieux>;
