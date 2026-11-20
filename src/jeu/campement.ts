// Campement : feu de camp posable (G), repos à l'auberge ou au feu, et pilote automatique (P).
import { CONFIG } from '../config';
import { INFOS_DECOR, estArbre, type ElementDecor } from '../monde/decor';
import { compter, peutAjouterButin, retirer as retirerObjets } from '../regles/inventaire';
import { estRecoltable, peutRecolter, tirerButin } from '../regles/recolte';
import { niveauOutil } from '../regles/equipement';
import { aLeNoeud, pvMax } from '../regles/progression';
import { INFOS_ENNEMIS, creerVieJoueur } from '../regles/combat';
import { estAnimal, estMenacant } from '../regles/animaux';
import type { PointReapparition } from '../regles/mort';
import { estAdulte } from '../regles/repousse';
import {
  MESSAGES_REFUS_FEU,
  OBJET_KIT_FEU,
  pointReapparitionFeu,
  poserFeuCamp,
  positionDevant,
  seReposer,
  verifierPoseFeu,
} from '../regles/campement';
import {
  MESSAGES_ARRET,
  creerPilote,
  pasPilote,
  type CandidatElement,
  type CandidatEnnemi,
  type CiblePilote,
  type OrdrePilote,
} from '../regles/pilote';
import { creerFeuCamp, creerLumiereFeuCamp, type ModeleFeuCamp } from '../scene/feuCamp';
import { creerIndicateurPilote } from '../ui/indicateurPilote';
import type { Fondu } from '../ui/fondu';
import type { EvenementHistoire } from '../regles/histoire';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';
import { estOutil, type EmplacementBarre } from '../regles/barreOutils';
import type { OutilEnMain } from './outilEnMain';
import type { Recolte } from './recolte';
import type { Repousse } from './repousse';

export interface DependancesCampement {
  fondu: Fondu;
  outil: OutilEnMain;
  recolte: Recolte;
  repousse: Repousse;
  rafraichirInventaire: () => void;
  /** Coup d'épée sur l'ennemi à portée (renvoie vrai s'il y en a un) */
  frapperEnnemiVise: () => boolean;
  /** Se reposer fait avancer l'histoire (étape « passe la nuit ») */
  signalerHistoire: (ev: EvenementHistoire) => void;
  /** Une attaque de bandits est-elle en cours ? (pas de repos pendant l'attaque) */
  attaqueEnCours: () => boolean;
}

export function creerCampement(jeu: EtatJeu, ctx: Contexte, dep: DependancesCampement) {
  const { scene, terrain, decor, mine, entrees, compteur, invite } = ctx;
  let modeleFeu: ModeleFeuCamp | null = null;
  // Lumière du feu créée d'avance (éteinte) : le nombre de lumières de la scène ne change jamais à la pose du feu
  const lumiereFeu = creerLumiereFeuCamp();
  scene.add(lumiereFeu);
  const indicateurPilote = creerIndicateurPilote(ctx.ui);

  // --- Feu de camp ---

  /** Montre, déplace ou retire le modèle du feu pour qu'il reflète `jeu.feuCamp`. */
  function synchroniserModeleFeu(): void {
    const { feuCamp } = jeu;
    if (!feuCamp) {
      if (modeleFeu) {
        scene.remove(modeleFeu.objet);
        modeleFeu.liberer();
        modeleFeu = null;
      }
      return;
    }
    if (!modeleFeu) {
      modeleFeu = creerFeuCamp(lumiereFeu);
      scene.add(modeleFeu.objet);
    }
    modeleFeu.placer(feuCamp.x, terrain.hauteur(feuCamp.x, feuCamp.z), feuCamp.z);
  }
  synchroniserModeleFeu();

  /** Touche G : pose un feu de camp devant le personnage (un kit est consommé, l'ancien feu s'éteint). */
  function poserFeu(): void {
    const { etat } = jeu;
    if (compter(jeu.inventaire, OBJET_KIT_FEU) < 1) {
      compteur.annoncerMessage('Pas de kit de feu de camp');
      return;
    }
    const p = positionDevant(etat.x, etat.z, etat.orientation);
    if (mine.contient(etat.x, etat.z) || mine.contient(p.x, p.z)) {
      compteur.annoncerMessage('Impossible de poser un feu dans la mine');
      return;
    }
    const voisins = decor
      .elementsAutour(p.x, p.z, 6)
      .filter((e) => estArbre(e.type) || e.rayonCollision > 0)
      .map((e) => ({
        x: e.x,
        z: e.z,
        rayon: estArbre(e.type) ? INFOS_DECOR[e.type].rayonCollision * e.echelle : e.rayonCollision,
      }));
    const verdict = verifierPoseFeu(p.x, p.z, terrain, voisins);
    if (!verdict.ok) {
      compteur.annoncerMessage(MESSAGES_REFUS_FEU[verdict.raison]);
      return;
    }
    const reveil = pointReapparitionFeu({ x: p.x, z: p.z });
    if (terrain.estSousEau(reveil.x, reveil.z)) {
      compteur.annoncerMessage('Pas assez de place au sec autour du feu');
      return;
    }
    jeu.feuCamp = poserFeuCamp(jeu.feuCamp, p.x, p.z).feu;
    jeu.inventaire = retirerObjets(jeu.inventaire, OBJET_KIT_FEU, 1).conteneur;
    dep.rafraichirInventaire();
    synchroniserModeleFeu();
    jeu.pointReapparition = pointReapparitionFeu(jeu.feuCamp);
    compteur.annoncerMessage('Point de réapparition : feu de camp');
  }

  /**
   * Se reposer (auberge ou feu) : fondu au noir ; au plus noir, la vie revient au maximum, le lieu devient
   * le point de réapparition et, si c'est la nuit, le temps saute jusqu'au matin.
   */
  function reposer(point: PointReapparition | null, lieu: string): void {
    if (!point) return;
    if (dep.attaqueEnCours()) {
      invite.annoncer('Impossible de dormir : le village est attaqué !');
      return;
    }
    arreterPilote();
    dep.fondu.jouer(() => {
      if (jeu.vie.pv <= 0) return;
      const r = seReposer(pvMax(jeu.progression), jeu.tempsJeu);
      jeu.vie = creerVieJoueur(r.vie, pvMax(jeu.progression));
      jeu.tempsJeu = r.tempsJeu;
      jeu.pointReapparition = point;
      dep.signalerHistoire({ type: 'repos' });
      invite.annoncer(
        r.nuitPassee
          ? `Vous vous réveillez ${lieu} : il est 7 h. Point de réapparition : ${point.nom}`
          : `Vous vous reposez ${lieu}. Point de réapparition : ${point.nom}`,
      );
    });
  }

  /** Animation du feu (obscurité : 0 de jour, 1 de nuit), à chaque image. */
  function mettreAJourFeu(dt: number, obscurite: number): void {
    modeleFeu?.mettreAJour(dt, obscurite);
  }

  // --- Pilote automatique (touche P) ---

  // Case de la barre d'outils choisie par le joueur avant le pilote, rendue quand il s'arrête
  let emplacementAvantPilote: EmplacementBarre | null = null;

  function arreterPilote(message?: string): void {
    const actif = jeu.pilote !== null;
    jeu.pilote = null;
    if (actif && emplacementAvantPilote) dep.outil.choisirEmplacement(emplacementAvantPilote);
    emplacementAvantPilote = null;
    indicateurPilote.afficher(null);
    if (message) invite.annoncer(message);
  }

  function basculerPilote(): void {
    if (jeu.pilote) {
      arreterPilote('Pilote automatique désactivé');
      return;
    }
    emplacementAvantPilote = jeu.emplacement;
    // Le pilote frappe : jamais avec la pousse d'arbre ni la torche en main (elles reviennent à l'arrêt)
    if (!estOutil(jeu.emplacement)) dep.outil.choisirEmplacement(jeu.outilActuel);
    jeu.pilote = creerPilote(jeu.etat.x, jeu.etat.z);
    invite.annoncer('Pilote automatique activé');
  }

  function candidatsEnnemis(): CandidatEnnemi[] {
    // Le pilote ignore les animaux, sauf un sanglier en colère qui le charge
    return [...jeu.ennemis.values()]
      .filter(({ etat: e }) => !estAnimal(e.type) || estMenacant(e))
      .map(({ etat: e }) => ({
        id: e.id,
        x: e.x,
        z: e.z,
        rayon: INFOS_ENNEMIS[e.type].rayon,
        phase: e.phase,
      }));
  }

  /** Éléments récoltables de la zone du pilote (ni les buissons vides, ni les pousses encore jeunes). */
  function candidatsElements(zone: { x: number; z: number }): CandidatElement[] {
    return decor
      .elementsAutour(zone.x, zone.z, CONFIG.pilote.rayonZone)
      .filter((e) => {
        if (!estRecoltable(e.type) || e.id.startsWith('v:')) return false;
        // Le pilote ignore ce que sa pioche ne peut pas récolter
        if (!peutRecolter(e.type, niveauOutil(jeu.equipement, 'pioche'))) return false;
        if (!e.id.startsWith('p:')) return true;
        const stade = dep.repousse.stadeAffiche(e.id);
        return stade !== undefined && estAdulte(stade);
      })
      .map((e) => ({ id: e.id, x: e.x, z: e.z, rayon: INFOS_DECOR[e.type].rayonVisee * e.echelle }));
  }

  /** L'élément est encore là : un élément du décor tant qu'il n'est pas retiré, une pousse tant qu'elle est plantée. */
  function elementPresent(id: string): boolean {
    return id.startsWith('p:') ? jeu.plantes.some((p) => p.id === id) : !jeu.retires.some((r) => r.id === id);
  }

  function typeElementPilote(id: string): ElementDecor['type'] | null {
    return jeu.plantes.find((p) => p.id === id)?.type ?? decor.chercher(id)?.type ?? mine.element(id)?.type ?? null;
  }

  /** Le butin de l'élément tient-il dans l'inventaire porté ? */
  function butinTient(id: string): boolean {
    const type = typeElementPilote(id);
    return type !== null && estRecoltable(type) && peutAjouterButin(jeu.inventaire, tirerButin(type, id));
  }

  function elementDeLaCible(cible: CiblePilote): ElementDecor | null {
    return decor.elementsAutour(cible.x, cible.z, 1).find((e) => e.id === cible.id) ?? null;
  }

  /** Le pilote va frapper : l'épée pour un ennemi, sinon l'outil qui convient à l'élément. */
  function preparerOutilPilote(cible: CiblePilote): void {
    if (cible.genre === 'ennemi') {
      dep.outil.prendreEpee();
      return;
    }
    const e = elementDeLaCible(cible);
    if (e) dep.outil.choisirOutil(e);
  }

  /** À l'impact d'une frappe du pilote : coup d'épée ou d'outil sur sa cible (sans passer par le rayon de la caméra). */
  function frapperPourPilote(cible: CiblePilote): void {
    if (cible.genre === 'ennemi') {
      dep.frapperEnnemiVise();
      return;
    }
    const e = elementDeLaCible(cible);
    if (e && dep.recolte.aPortee(e)) dep.recolte.frapperElementVise(e);
  }

  /**
   * P : pilote automatique. Un écran ouvert, la chute ou la caméra libre l'arrêtent ; une touche de déplacement rend la main.
   * Renvoie l'ordre du pilote pour cette image (null s'il n'est pas actif).
   */
  function mettreAJourPilote(commande: boolean, axes: { avant: number; cote: number }, dt: number): OrdrePilote | null {
    const { etat, frappe, vie, progression } = jeu;
    if (commande && !jeu.visite && entrees.vientDAppuyer('KeyP')) basculerPilote();
    if (jeu.pilote && !commande) arreterPilote();
    let ordrePilote: OrdrePilote | null = null;
    if (jeu.pilote) {
      const zone = jeu.pilote.centre;
      const r = pasPilote(
        jeu.pilote,
        {
          joueur: { x: etat.x, z: etat.z },
          pvRatio: vie.pv / pvMax(progression),
          toucheDeplacement: axes.avant !== 0 || axes.cote !== 0 || entrees.sauter,
          ennemis: candidatsEnnemis(),
          elements: () => candidatsElements(zone),
          elementExiste: elementPresent,
          peutRecolter: butinTient,
          porteeEpee: CONFIG.combat.porteeEpee,
          porteeRecolte: CONFIG.recolte.portee,
        },
        dt,
        // Pilote expert : il marche aussi vite que le joueur
        aLeNoeud(progression, 'pilote-expert') ? { ...CONFIG.pilote, facteurLenteur: 1 } : CONFIG.pilote,
      );
      if (r.arret) {
        arreterPilote(MESSAGES_ARRET[r.arret]);
      } else {
        jeu.pilote = r.etat;
        ordrePilote = r.ordre;
        if (ordrePilote.frapper && r.etat.cible && frappe.progression < 0) preparerOutilPilote(r.etat.cible);
      }
    }
    indicateurPilote.afficher(jeu.pilote ? jeu.pilote.mode : null);
    return ordrePilote;
  }

  return { poserFeu, reposer, arreterPilote, mettreAJourPilote, frapperPourPilote, mettreAJourFeu };
}

export type Campement = ReturnType<typeof creerCampement>;
