// Commandes : lecture des touches dans la boucle (écrans, caméras, actions), menu pause (Échap) et verrouillage du pointeur.
import { baluchonAPortee } from '../regles/mort';
import { TOUCHES_BARRE, emplacementApresTouche, emplacementVoisin } from '../regles/barreOutils';
import { compter } from '../regles/inventaire';
import { peutLeverBouclier } from '../regles/bouclier';
import { durabiliteMax, niveauOutil } from '../regles/equipement';
import type { OutilEnMain } from './outilEnMain';
import { APPARITION, niveauSuivant } from '../regles/village';
import { definirEmplacementActif, effacerSauvegarde } from '../moteur/stockage';
import { creerCameraVisite } from '../moteur/cameraVisite';
import { creerMenuPause } from '../ui/menuPause';
import { definirImagesParSeconde } from '../moteur/reglages';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';
import type { InventaireJeu } from './inventaireJeu';
import type { Fabrication } from './fabrication';
import type { ProgressionJeu } from './progression';
import type { Quetes } from './quetes';
import type { Mort } from './mort';
import type { Village } from './village';
import type { Campement } from './campement';
import type { Repousse } from './repousse';
import type { PiegesJeu } from './pieges';
import type { RuinesJeu } from './ruines';
import { pointReapparitionFeu } from '../regles/campement';
import type { Sorts } from './sorts';
import type { Visee } from './visee';
import type { ButinSol } from './butinSol';
import type { Sauvegarde } from './sauvegarde';
import type { Dialogue } from './dialogue';
import { OUTILS_DE_TEST } from '../moteur/modeTest';
import type { Marchand } from './marchand';
import type { Fondu } from '../ui/fondu';
import { choisirPointDeRetour } from '../regles/pointSur';
import { CONFIG } from '../config';
import type { Attaques } from './attaques';
import type { LieuxJeu } from './lieux';
import type { Fin } from './fin';

export interface DependancesCommandes {
  inventaire: InventaireJeu;
  fabrication: Fabrication;
  progression: ProgressionJeu;
  quetes: Quetes;
  marchand: Marchand;
  attaques: Attaques;
  lieux: LieuxJeu;
  mort: Mort;
  village: Village;
  campement: Campement;
  repousse: Repousse;
  pieges: PiegesJeu;
  ruines: RuinesJeu;
  sorts: Sorts;
  outil: OutilEnMain;
  visee: Visee;
  butinSol: ButinSol;
  sauvegarde: Sauvegarde;
  dialogue: Dialogue;
  fondu: Fondu;
  fin: Fin;
}

export function creerCommandes(jeu: EtatJeu, ctx: Contexte, dep: DependancesCommandes) {
  const { renderer, camera, terrain, entrees, vues, aide, aideTouches, compteurImages, barreOutils, compteur } = ctx;
  const { inventaire, fabrication, progression, quetes } = dep;

  /** Vrai si l'un des écrans (inventaire, fabrication, compétences, quêtes, marchand) ou le dialogue est ouvert. */
  function ecranOuvert(): boolean {
    return inventaire.ecran.ouvert || fabrication.ecran.ouvert || progression.ecran.ouvert || quetes.ecran.ouvert || dep.marchand.ecran.ouvert || dep.dialogue.ouvert || dep.fin.ouvert;
  }

  // F6 est une touche du navigateur (barre d'adresse), F7 aussi (navigation au curseur), F8 par précaution :
  // on les garde pour le jeu
  window.addEventListener('keydown', (e) => {
    if (OUTILS_DE_TEST && (e.code === 'F6' || e.code === 'F7' || e.code === 'F8')) e.preventDefault();
  });

  // --- Menu pause (Échap) ---
  // Pointeur verrouillé : le navigateur utilise d'abord Échap pour le libérer. On ouvre donc le menu
  // quand le pointeur est libéré sans que le jeu l'ait demandé, ou quand Échap est pressé pointeur libre.
  let dernierOuvertureMenu = -Infinity;
  const menuPause = creerMenuPause(ctx.ui, {
    reprendre: () => entrees.verrouiller(),
    sauvegarder: dep.sauvegarde.sauvegarder,
    aide: (visible) => aideTouches.afficher(visible),
    appliquerGraphismes: ctx.appliquerGraphismes,
    appliquerVolumes: ctx.appliquerVolumes,
    essayerBruitage: () => ctx.sons.jouer('hache'),
    coince: () => {
      if (jeu.vie.pv <= 0) return 'Impossible pour le moment';
      if (jeu.pilote) return "Arrête d'abord le pilote (P)";
      if (ctx.mine.contient(jeu.etat.x, jeu.etat.z)) return 'Utilisable seulement en extérieur';
      const R = CONFIG.personnage.pointSur;
      const repli = jeu.pointReapparition;
      const cible = choisirPointDeRetour(
        jeu.pointsSurs,
        jeu.etat,
        repli,
        R,
        (x, z) => terrain.pente(x, z) * 90 <= CONFIG.personnage.penteMaxDegres && terrain.hauteur(x, z) >= terrain.niveauEau,
      );
      dep.fondu.jouer(() => {
        jeu.etat = { ...jeu.etat, x: cible.x, y: terrain.hauteur(cible.x, cible.z), z: cible.z, vx: 0, vy: 0, vz: 0, auSol: true, nage: false, glisse: false, grimpe: false, sautBloque: false };
        jeu.pointsSurs = [];
        ctx.invite.annoncer('Te voilà sorti du trou');
      });
      return null;
    },
    // Retour au village (aide aux tests, à retirer peut-être du jeu final) : marche aussi depuis la mine ou la maison,
    // car « dedans » se déduit de la position
    village: () => {
      if (jeu.vie.pv <= 0) return 'Impossible pour le moment';
      if (jeu.pilote) return "Arrête d'abord le pilote (P)";
      dep.fondu.jouer(() => {
        const { x, z, orientation } = APPARITION;
        jeu.etat = { ...jeu.etat, x, y: terrain.hauteur(x, z), z, orientation, vx: 0, vy: 0, vz: 0, auSol: true, nage: false, glisse: false, grimpe: false, sautBloque: false };
        jeu.pointsSurs = [];
        ctx.invite.annoncer('De retour au village');
      });
      return null;
    },
    nouvellePartie: () => {
      dep.sauvegarde.interdire();
      effacerSauvegarde();
      window.location.reload();
    },
    finDisponible: () => jeu.finVue,
    relireFin: () => dep.fin.ouvrir(),
    // Autre emplacement : on garde d'abord la partie en cours, puis on interdit à la page qui se ferme d'écrire.
    // Si le navigateur refuse l'une des deux écritures, on ne change rien (sinon la progression serait perdue).
    changerEmplacement: (numero) => {
      if (!dep.sauvegarde.sauvegarder() || !definirEmplacementActif(numero)) {
        ctx.invite.annoncer('Le navigateur refuse la sauvegarde : changement de partie annulé');
        return;
      }
      dep.sauvegarde.interdire();
      window.location.reload();
    },
  });

  function ouvrirMenu(): void {
    dernierOuvertureMenu = performance.now();
    menuPause.ouvrir();
  }

  let pointeurEtaitVerrouille = false;
  document.addEventListener('pointerlockchange', () => {
    const verrouille = document.pointerLockElement === renderer.domElement;
    const liberationNonVoulue = pointeurEtaitVerrouille && !verrouille && !jeu.visite;
    pointeurEtaitVerrouille = verrouille;
    if (liberationNonVoulue && !ecranOuvert() && !ctx.miniCarte.grande) {
      ouvrirMenu();
    }
  });

  /** Vrai tant que le menu pause est ouvert : le jeu est figé (temps compris), seule l'image reste dessinée. */
  function enPause(): boolean {
    return menuPause.ouvert;
  }

  /**
   * Échap : ferme l'inventaire ou le menu, ou ouvre le menu (pointeur libre). Un Échap qui vient
   * d'ouvrir le menu (libération du pointeur) ne doit pas le refermer aussitôt.
   */
  function gererEchap(): void {
    if (entrees.vientDAppuyer('Escape') && performance.now() - dernierOuvertureMenu > 300) {
      if (menuPause.ouvert) {
        menuPause.fermer();
        entrees.verrouiller();
        // Le navigateur refuse de recapturer la souris sur la touche Échap (il lui faut un clic) : on le dit au lieu de
        // laisser le joueur chercher. Un clic sur « Reprendre » ou à côté du menu, lui, reprend la main directement.
        window.setTimeout(() => {
          if (!entrees.pointeurVerrouille && !menuPause.ouvert && !ecranOuvert() && !ctx.miniCarte.grande && !jeu.visite) {
            ctx.invite.annoncer('Clique dans le jeu pour reprendre la vue');
          }
        }, 250);
      } else if (inventaire.ecran.ouvert) {
        inventaire.basculerInventaire();
      } else if (fabrication.ecran.ouvert) {
        fabrication.basculerFabrication();
      } else if (progression.ecran.ouvert) {
        progression.basculerCompetences();
      } else if (quetes.ecran.ouvert) {
        quetes.basculerQuetes();
      } else if (dep.marchand.ecran.ouvert) {
        dep.marchand.basculer();
      } else if (dep.dialogue.ouvert) {
        dep.dialogue.fermer();
      } else if (ctx.miniCarte.grande) {
        // Carte agrandie : Échap la ferme (le pointeur est rendu par jeu/miniCarte.ts) sans ouvrir le menu
        ctx.miniCarte.definirGrande(false);
      } else if (!entrees.pointeurVerrouille) {
        ouvrirMenu();
      }
    }
  }

  /** Écrans (Tab ou I, K, J), F6, F7, F8, sauvegarde automatique, aide (H), images par seconde (F3), caméras (F, V). */
  function lireTouches(dt: number): void {
    // Tab ou I : inventaire
    if ((entrees.vientDAppuyer('Tab') || entrees.vientDAppuyer('KeyI')) && !jeu.visite && jeu.vie.pv > 0 && !fabrication.ecran.ouvert && !progression.ecran.ouvert && !quetes.ecran.ouvert && !dep.marchand.ecran.ouvert) {
      inventaire.basculerInventaire();
    }

    // K : écran des compétences
    if (entrees.vientDAppuyer('KeyK') && !jeu.visite && !inventaire.ecran.ouvert && !fabrication.ecran.ouvert && !quetes.ecran.ouvert && !dep.marchand.ecran.ouvert && jeu.vie.pv > 0) {
      progression.basculerCompetences();
    }

    // J : journal des quêtes (J de nouveau le referme ; le panneau d'annonces se ferme avec E ou Échap)
    if (entrees.vientDAppuyer('KeyJ') && !jeu.visite && jeu.vie.pv > 0) {
      if (quetes.ecran.mode === 'journal') quetes.basculerQuetes();
      else if (!quetes.ecran.ouvert && !inventaire.ecran.ouvert && !fabrication.ecran.ouvert && !progression.ecran.ouvert && !dep.marchand.ecran.ouvert) quetes.basculerQuetes('journal');
    }

    // F6 (outil de test) : niveau de village suivant, 1 -> 2 -> 3 -> 1
    if (OUTILS_DE_TEST && entrees.vientDAppuyer('F6')) {
      dep.village.definirNiveauVillage(niveauSuivant(jeu.niveauVillage), true);
      ctx.invite.annoncer(`Village : niveau ${jeu.niveauVillage} (test, non sauvegardé)`);
    }

    // F7 (outil de test) : une attaque de bandits tout de suite, quels que soient l'heure et l'acte de l'histoire
    if (OUTILS_DE_TEST && entrees.vientDAppuyer('F7')) dep.attaques.declencher();

    // F8 (outil de test) : téléportation devant le prochain lieu de l'histoire (le camp du Balafré, puis l'autel du Cœur)
    if (OUTILS_DE_TEST && entrees.vientDAppuyer('F8') && !ecranOuvert()) dep.lieux.teleporterAuProchain();

    dep.sauvegarde.mettreAJour(dt);

    // H : aide des touches ; F3 : images par seconde
    if (entrees.vientDAppuyer('KeyH')) aideTouches.basculer();
    if (entrees.vientDAppuyer('F3')) {
      compteurImages.basculer();
      definirImagesParSeconde(compteurImages.visible);
    }
    compteurImages.image(dt);

    // F : caméra de visite libre, F de nouveau : retour au personnage
    const ouvert = ecranOuvert();
    if (entrees.vientDAppuyer('KeyF') && !ouvert && (jeu.visite || jeu.vie.pv > 0)) {
      if (jeu.visite) {
        jeu.visite.liberer();
        jeu.visite = null;
        vues.reprendre();
        entrees.definirVerrouillage(true);
        aide.annoncer(vues.titre);
      } else {
        entrees.definirVerrouillage(false);
        jeu.visite = creerCameraVisite(camera, renderer.domElement, (x, z) => terrain.hauteur(x, z));
        aide.annoncer('Caméra libre (F pour revenir)');
      }
    }
    if (!jeu.visite && !ouvert && jeu.vie.pv > 0 && entrees.vientDAppuyer('KeyV')) {
      vues.suivante();
      entrees.definirVerrouillage(true);
      aide.annoncer(vues.titre);
    }
  }

  /** Le personnage reçoit-il les commandes ? (pas en caméra libre, aucun écran ouvert, debout) */
  function commandeActive(): boolean {
    return !jeu.visite && !ecranOuvert() && jeu.vie.pv > 0;
  }

  /** R (potion), E (interagir, refermer), axes de déplacement, G (feu de camp). Renvoie les axes. */
  function lireActions(commande: boolean): { avant: number; cote: number } {
    const { etat, baluchon } = jeu;

    // R : boire une potion de soin
    if (commande && entrees.vientDAppuyer('KeyR')) dep.mort.boire();

    // E : interagir avec l'objet du village proposé, ou refermer le coffre
    if (entrees.vientDAppuyer('KeyE')) {
      const proposee = dep.visee.interactionActuelle();
      if (inventaire.ecran.avecCoffre) inventaire.basculerInventaire();
      else if (fabrication.ecran.ouvert) fabrication.basculerFabrication();
      else if (quetes.ecran.mode === 'panneau') quetes.basculerQuetes();
      else if (dep.marchand.ecran.ouvert) dep.marchand.basculer();
      else if (commande && baluchon && baluchonAPortee(baluchon, etat.x, etat.z)) dep.mort.recupererSesAffaires();
      // Le butin au sol passe avant l'objet proposé seulement si une partie peut être prise
      else if (commande && dep.butinSol.ramassable()) dep.butinSol.ramasserProche();
      else if (commande && dep.pieges.releverProche()) { /* piège relevé */ }
      else if (commande && dep.ruines.ouvrirCoffreProche()) { /* coffre de ruine ouvert */ }
      // Feu de camp ou cheminée : écran de cuisine (au feu posé, on peut aussi se reposer)
      else if (commande && proposee && (proposee.type === 'feu' || proposee.type === 'cheminee')) {
        const feu = jeu.feuCamp;
        fabrication.basculerFabrication(
          'feu',
          proposee.type === 'feu' && feu
            ? () => {
                fabrication.basculerFabrication();
                dep.campement.reposer(pointReapparitionFeu(feu), 'au feu de camp');
              }
            : undefined,
        );
      }
      else if (commande && proposee) dep.village.surInteraction(proposee.type);
      else if (commande && dep.butinSol.procheAPortee()) dep.butinSol.ramasserProche();
    }
    const axes = commande ? entrees.axes() : { avant: 0, cote: 0 };

    // G : poser un feu de camp
    if (commande && !jeu.visite && entrees.vientDAppuyer('KeyG')) dep.campement.poserFeu();
    return axes;
  }

  /** Touches 1 à 6 (rangée de chiffres ou pavé numérique), puis molette. La case 4 (arc) ne se prend que si l'arc est possédé. */
  function lireBarreOutils(): void {
    for (const code of TOUCHES_BARRE) {
      const choisi = entrees.vientDAppuyer(code) ? emplacementApresTouche(jeu.emplacement, code) : null;
      if (!choisi) continue;
      if (choisi === 'arc' && !jeu.equipement.arc) {
        compteur.annoncerMessage("Pas d'arc (compétence Tir à l'arc, puis établi)");
        continue;
      }
      dep.outil.choisirEmplacement(choisi);
      if (choisi === 'arc' && compter(jeu.inventaire, 'fleche') < 1) compteur.annoncerMessage('Pas de flèche (à fabriquer à l’établi)');
      if (choisi === 'pousse' && compter(jeu.inventaire, 'pousse-arbre') < 1) compteur.annoncerMessage("Pas de pousse d'arbre");
      if (choisi === 'piege' && compter(jeu.inventaire, 'piege') < 1) compteur.annoncerMessage('Pas de piège (à fabriquer à l’établi)');
    }
    if (entrees.molette !== 0) {
      dep.outil.choisirEmplacement(emplacementVoisin(jeu.emplacement, entrees.molette, !jeu.equipement.arc));
    }
  }

  /** Après le déplacement (le rayon de visée vient d'être mis à jour) : barre d'outils, planter (clic droit, ou clic gauche avec les pousses) et sorts A, X, C. */
  function lireActionsVisee(commande: boolean): void {
    if (commande && !jeu.visite) {
      // Pendant le pilote, c'est lui qui choisit l'outil (celui du joueur revient à l'arrêt)
      if (!jeu.pilote) lireBarreOutils();
      // Clic droit : planter une pousse d'arbre (sauf avec l'épée et le bouclier : il lève alors le bouclier, voir
      // mouvement.ts) ; clic gauche aussi quand les pousses sont en main
      const clicDroitBouclier = peutLeverBouclier(jeu.emplacement, jeu.equipement.bouclier, jeu.progression.noeuds);
      if (jeu.emplacement === 'piege' && entrees.clicGaucheDebut) dep.pieges.poser();
      else if ((entrees.clicDroit && !clicDroitBouclier) || (jeu.emplacement === 'pousse' && entrees.clicGaucheDebut)) dep.repousse.planter();

      // A : boule de feu ; X : soin ; C : barrière (touches lues par position : A de l'AZERTY = KeyQ)
      // Pas de sort pendant l'escalade : les deux mains sont sur la paroi
      if (!jeu.etat.grimpe) {
        if (entrees.vientDAppuyer('KeyQ')) dep.sorts.utiliserSort('boule-de-feu');
        if (entrees.vientDAppuyer('KeyX')) dep.sorts.utiliserSort('soin');
        if (entrees.vientDAppuyer('KeyC')) dep.sorts.utiliserSort('barriere');
      }
    }

    // Barre d'outils visible : cases, case active, palier des outils (de base à cristal) et pousses portées
    const pousses = compter(jeu.inventaire, 'pousse-arbre');
    barreOutils.afficher({
      actif: jeu.emplacement,
      pousses,
      pieges: compter(jeu.inventaire, 'piege'),
      arc: jeu.equipement.arc,
      fleches: compter(jeu.inventaire, 'fleche'),
      niveaux: {
        epee: niveauOutil(jeu.equipement, 'epee'),
        hache: niveauOutil(jeu.equipement, 'hache'),
        pioche: niveauOutil(jeu.equipement, 'pioche'),
      },
      durabilites: {
        epee: jeu.equipement.durabilite.epee,
        hache: jeu.equipement.durabilite.hache,
        pioche: jeu.equipement.durabilite.pioche,
      },
      durabilitesMax: {
        epee: durabiliteMax(jeu.equipement, 'epee'),
        hache: durabiliteMax(jeu.equipement, 'hache'),
        pioche: durabiliteMax(jeu.equipement, 'pioche'),
      },
    });
  }

  return { enPause, gererEchap, lireTouches, commandeActive, ecranOuvert, lireActions, lireActionsVisee };
}

export type Commandes = ReturnType<typeof creerCommandes>;
