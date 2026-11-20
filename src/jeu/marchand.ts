// Marchand ambulant : sa présence sur la place (un jour sur trois, voir src/regles/marchand.ts), son modèle et sa
// charrette, les cercles d'obstacle qu'ils forment, l'interaction E, l'annonce de son arrivée et l'écran d'achat et de vente.
// Seul ce qui a été acheté pendant la visite en cours est sauvegardé (`jeu.marchand`).
import type { ObstacleCercle } from '../regles/deplacement';
import { definitionObjet } from '../regles/inventaire';
import {
  ACHATS,
  ANNONCE_ARRIVEE,
  VENTES,
  acheter,
  marchandPresent,
  numeroVisite,
  orPossede,
  placementMarchand,
  possede,
  salutation,
  stockRestant,
  vendre,
  type PossessionMarchand,
  type ResultatEchange,
} from '../regles/marchand';
import type { PointInteraction } from '../regles/village';
import { creerModeleMarchand } from '../scene/modeleMarchand';
import { creerEcranMarchand, type DonneesMarchand } from '../ui/ecranMarchand';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

// Au-delà de cette distance de la caméra, le marchand n'est pas dessiné, en mètres
const DISTANCE_AFFICHAGE = 160;
// Sa tête suit le joueur à moins de cette distance (mètres), jusqu'à cet angle (radians) et à cette vitesse (rad/s)
const DISTANCE_REGARD = 7;
const ANGLE_REGARD_MAX = 1.1;
const VITESSE_REGARD = 4;
// Un cercle d'obstacle « absent » est rangé très loin (un rayon nul arrêterait encore le joueur)
const LOIN = 1e7;

export interface DependancesMarchand {
  rafraichirInventaire: () => void;
}

export function creerMarchand(jeu: EtatJeu, ctx: Contexte, dep: DependancesMarchand) {
  const { scene, camera, terrain, entrees, invite } = ctx;
  const lieu = placementMarchand();

  const modele = creerModeleMarchand();
  modele.objet.visible = false;
  scene.add(modele.objet);

  /** Cercles d'obstacle du marchand puis de sa charrette : donnés aux habitants, qui les ajoutent à ceux du village. */
  const cercles: ObstacleCercle[] = [lieu.marchand, lieu.charrette].map(() => ({ x: LOIN, z: LOIN, rayon: 0 }));
  const point: PointInteraction = { type: 'marchand', x: lieu.marchand.x, z: lieu.marchand.z, rayon: lieu.marchand.rayon, invite: 'parler au marchand' };

  let present = marchandPresent(jeu.tempsJeu);
  let regard = 0;
  let ouvertures = 0;

  function possession(): PossessionMarchand {
    return { inventaire: jeu.inventaire, sac: jeu.sac, etat: jeu.marchand, tempsJeu: jeu.tempsJeu };
  }

  function donnees(): DonneesMarchand {
    const p = possession();
    const or = orPossede(p);
    return {
      or,
      achats: VENTES.map((v) => ({
        objet: v.objet,
        nom: v.lot > 1 ? `${definitionObjet(v.objet).nom} ×${v.lot}` : definitionObjet(v.objet).nom,
        prix: v.prix,
        stock: stockRestant(jeu.marchand, jeu.tempsJeu, v),
        abordable: or >= v.prix,
      })),
      ventes: ACHATS.map((a) => ({
        objet: a.objet,
        // Prévenir avant de vendre ce qui sert à reforger le Cœur
        nom: SERT_REFORGE.includes(a.objet) && !jeu.lieux.coeurReforge ? `${definitionObjet(a.objet).nom} (sert à reforger le Cœur)` : definitionObjet(a.objet).nom,
        prix: a.prix,
        possede: possede(p, a.objet),
      })),
    };
  }

  /** Applique un échange réussi (conteneurs, état du marchand, inventaire) puis montre son résultat dans l'écran. */
  function appliquer(r: ResultatEchange): void {
    if (r.ok) {
      jeu.inventaire = r.inventaire;
      jeu.sac = r.sac;
      jeu.marchand = r.etat;
      dep.rafraichirInventaire();
    }
    ecran.afficher(donnees(), { texte: r.message, ok: r.ok });
  }

  const ecran = creerEcranMarchand(
    ctx.ui,
    (objet, lots) => appliquer(acheter(possession(), objet, lots)),
    (objet, quantite) => appliquer(vendre(possession(), objet, quantite)),
    () => basculer(),
  );

  /** Objets demandés pour reforger le Cœur à l'autel. */
  const SERT_REFORGE: readonly string[] = ['cristal-bleu', 'lingot-acier'];

  /** Ouvre (s'il est là) ou ferme l'écran : pointeur libéré et personnage figé tant qu'il est ouvert. */
  function basculer(): void {
    if (ecran.ouvert) {
      ecran.fermer();
      entrees.definirVerrouillage(!jeu.visite);
      entrees.verrouiller();
    } else if (present && jeu.vie.pv > 0) {
      ouvertures += 1;
      ecran.ouvrir(salutation(numeroVisite(jeu.tempsJeu), ouvertures));
      entrees.definirVerrouillage(false);
      ecran.afficher(donnees());
    }
  }

  /** Point d'interaction du marchand (aucun quand il n'est pas sur la place). */
  function interactions(): PointInteraction[] {
    return present ? [point] : [];
  }

  /** À chaque image : arrivée et départ, modèle, cercles d'obstacle. */
  function mettreAJour(dt: number): void {
    const maintenant = marchandPresent(jeu.tempsJeu);
    if (maintenant && !present) invite.annoncer(ANNONCE_ARRIVEE);
    if (!maintenant && present && ecran.ouvert) {
      basculer();
      // Fermé sans clic du joueur : le navigateur peut refuser de reprendre la souris, d'où le « clique »
      invite.annoncer('Le marchand reprend la route (clique pour reprendre)');
    }
    present = maintenant;

    const { etat } = jeu;
    const loin = Math.hypot(camera.position.x - lieu.marchand.x, camera.position.z - lieu.marchand.z) > DISTANCE_AFFICHAGE;
    modele.objet.visible = present && !loin;
    [lieu.marchand, lieu.charrette].forEach((l, i) => {
      cercles[i].x = present ? l.x : LOIN;
      cercles[i].z = present ? l.z : LOIN;
      cercles[i].rayon = present ? l.rayon : 0;
    });
    if (!modele.objet.visible) return;

    // La tête suit le joueur quand il est près (dans l'angle permis), sinon revient droit devant
    const dx = etat.x - lieu.marchand.x;
    const dz = etat.z - lieu.marchand.z;
    let cible = 0;
    if (Math.hypot(dx, dz) < DISTANCE_REGARD && !ctx.mine.contient(etat.x, etat.z)) {
      const ecart = Math.atan2(dx, dz) - lieu.marchand.orientation;
      const ramene = Math.atan2(Math.sin(ecart), Math.cos(ecart));
      cible = Math.max(-ANGLE_REGARD_MAX, Math.min(ANGLE_REGARD_MAX, ramene));
    }
    const pas = VITESSE_REGARD * dt;
    regard += Math.max(-pas, Math.min(pas, cible - regard));
    modele.mettreAJour(dt, {
      x: lieu.marchand.x,
      y: terrain.altitudeVillage,
      z: lieu.marchand.z,
      orientation: lieu.marchand.orientation,
      regard,
    });
  }

  return {
    ecran,
    cercles,
    interactions,
    basculer,
    mettreAJour,
  };
}

export type Marchand = ReturnType<typeof creerMarchand>;
