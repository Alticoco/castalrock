import { CONFIG } from './config';
import { lancerBoucle } from './moteur/boucle';
import { creerFondu } from './ui/fondu';
import { creerContexte } from './jeu/contexte';
import { creerEtatJeu } from './jeu/partie';
import { lirePartieAuDemarrage, creerSauvegarde } from './jeu/sauvegarde';
import { creerOutilEnMain } from './jeu/outilEnMain';
import { creerProgressionJeu } from './jeu/progression';
import { creerInventaireJeu } from './jeu/inventaireJeu';
import { creerFabrication } from './jeu/fabrication';
import { creerQuetes } from './jeu/quetes';
import { creerHistoire } from './jeu/histoire';
import { creerRepousse } from './jeu/repousse';
import { creerRecolte } from './jeu/recolte';
import { creerMort } from './jeu/mort';
import { creerCombat } from './jeu/combat';
import { creerButinSol } from './jeu/butinSol';
import { creerSorts } from './jeu/sorts';
import { creerArcJeu } from './jeu/arc';
import { creerCampement } from './jeu/campement';
import { creerPieges } from './jeu/pieges';
import { creerVillage } from './jeu/village';
import { creerPotager } from './jeu/potager';
import { creerHabitants } from './jeu/habitants';
import { creerMarchand } from './jeu/marchand';
import { creerAttaques } from './jeu/attaques';
import { creerEmbuscades } from './jeu/embuscades';
import { creerFerme } from './jeu/ferme';
import { creerLieux } from './jeu/lieux';
import { creerChef } from './jeu/chef';
import { creerRuinesJeu } from './jeu/ruines';
import { creerDialogue } from './jeu/dialogue';
import { creerVisee } from './jeu/visee';
import { creerFin } from './jeu/fin';
import { creerCommandes } from './jeu/commandes';
import { creerMouvement } from './jeu/mouvement';
import { creerAmbiance } from './jeu/ambiance';
import { creerMiniCarteJeu } from './jeu/miniCarte';
import { creerSons } from './jeu/sons';

// Monde généré autour du personnage, vu en 1re ou en 3e personne (touche V)
// ou par la caméra de visite libre (touche F). Chaque système du jeu est un module de src/jeu/ ;
// ce fichier les crée (l'ordre de création des écrans est celui de l'interface), les relie et lance la boucle.
const { partie, sauvegardeMiseDeCote } = lirePartieAuDemarrage();
const ctx = creerContexte(partie);
const jeu = creerEtatJeu(partie, ctx);

const outil = creerOutilEnMain(jeu, ctx);
// Dépendances circulaires entre systèmes : la fonction de l'autre module est appelée « à la demande »
// (progression -> inventaire, inventaire -> quêtes, fabrication -> quêtes, quêtes -> village, combat -> sorts).
const progression = creerProgressionJeu(jeu, ctx, {
  rafraichirInventaire: () => inventaire.rafraichirInventaire(),
  signalerQuete: (ev) => quetes.signalerQuete(ev),
});
const inventaire = creerInventaireJeu(jeu, ctx, { rafraichirQuetes: () => quetes.rafraichirQuetes(), outil });
const fabrication = creerFabrication(jeu, ctx, {
  montrerOutilEnMain: outil.montrerOutilEnMain,
  rafraichirInventaire: inventaire.rafraichirInventaire,
  donnerXp: progression.donnerXp,
  signalerQuete: (ev) => quetes.signalerQuete(ev),
});
const quetes = creerQuetes(jeu, ctx, {
  rafraichirInventaire: inventaire.rafraichirInventaire,
  donnerXp: progression.donnerXp,
  donnerPointsCompetence: progression.donnerPointsCompetence,
  ameliorerLeVillage: () => village.ameliorerLeVillage(),
  signalerHistoire: (ev) => histoire.signalerEvenementQuete(ev),
});
const histoire = creerHistoire(jeu, ctx, {
  rafraichirInventaire: inventaire.rafraichirInventaire,
  donnerXp: progression.donnerXp,
  rafraichirQuetes: quetes.rafraichirQuetes,
});
const fondu = creerFondu(ctx.ui, CONFIG.campement.dureeFonduMs);

const repousse = creerRepousse(
  jeu,
  ctx,
  { rafraichirInventaire: inventaire.rafraichirInventaire, signalerQuete: quetes.signalerQuete },
  partie,
);
const recolte = creerRecolte(jeu, ctx, {
  outil,
  repousse,
  rafraichirInventaire: inventaire.rafraichirInventaire,
  donnerXp: progression.donnerXp,
  signalerQuete: quetes.signalerQuete,
});
// Boussole : le baluchon, sinon le bandit le plus proche pendant une attaque (plus de guidage vers les quêtes)
const mort = creerMort(jeu, ctx, {
  rafraichirInventaire: inventaire.rafraichirInventaire,
  cibleAttaque: () => attaques.cibleBoussole(),
});
const butinSol = creerButinSol(jeu, ctx, { rafraichirInventaire: inventaire.rafraichirInventaire });
const combat = creerCombat(jeu, ctx, {
  outil,
  surMort: mort.surMort,
  rafraichirInventaire: inventaire.rafraichirInventaire,
  donnerXp: progression.donnerXp,
  signalerQuete: quetes.signalerQuete,
  deposerButin: butinSol.deposer,
  mettreAJourBoules: (dt) => sorts.mettreAJourBoules(dt),
  mettreAJourChute: mort.mettreAJourChute,
});
const sorts = creerSorts(jeu, ctx, { infligerDegatsEnnemi: combat.infligerDegatsEnnemi, signalerQuete: quetes.signalerQuete });
const arc = creerArcJeu(jeu, ctx, { infligerDegatsEnnemi: combat.infligerDegatsEnnemi, rafraichirInventaire: inventaire.rafraichirInventaire });
const campement = creerCampement(jeu, ctx, {
  fondu,
  outil,
  recolte,
  repousse,
  rafraichirInventaire: inventaire.rafraichirInventaire,
  frapperEnnemiVise: combat.frapperEnnemiVise,
  signalerHistoire: histoire.signaler,
  attaqueEnCours: () => attaques.enCours(),
});
const pieges = creerPieges(jeu, ctx, { rafraichirInventaire: inventaire.rafraichirInventaire });
const marchand = creerMarchand(jeu, ctx, { rafraichirInventaire: inventaire.rafraichirInventaire });
const attaques = creerAttaques(jeu, ctx, {
  ajouterBanditAttaque: combat.ajouterBanditAttaque,
  retirerEnnemi: combat.retirerEnnemi,
  donnerXp: progression.donnerXp,
  rafraichirInventaire: inventaire.rafraichirInventaire,
});
// Embuscades : des bandits surgissent hors du village tant qu'un objectif demande d'en tuer
const embuscades = creerEmbuscades(jeu, ctx, {
  ajouterEnnemiSpecial: combat.ajouterEnnemiSpecial,
  retirerEnnemi: combat.retirerEnnemi,
  attaqueEnCours: attaques.enCours,
});
// Lieux de l'histoire : le camp des bandits (avec Morvan et ses gardes) et l'autel du Cœur
const lieux = creerLieux(jeu, ctx, { fondu, rafraichirInventaire: inventaire.rafraichirInventaire, verifierHistoire: histoire.verifier });
const chef = creerChef(jeu, ctx, {
  ajouterEnnemiSpecial: combat.ajouterEnnemiSpecial,
  retirerEnnemi: combat.retirerEnnemi,
  rafraichirInventaire: inventaire.rafraichirInventaire,
  verifierHistoire: histoire.verifier,
});
const habitants = creerHabitants(jeu, ctx, {
  parler: (id) => dialogue.ouvrir(id),
  cerclesSupplementaires: marchand.cercles,
  attaqueEnCours: attaques.enCours,
});
const dialogue = creerDialogue(jeu, ctx, { habitants, quetes, histoire, basculerFabrication: fabrication.basculerFabrication });
const potager = creerPotager(jeu, ctx, { rafraichirInventaire: inventaire.rafraichirInventaire, signalerQuete: quetes.signalerQuete });
const village = creerVillage(jeu, ctx, {
  potager,
  fondu,
  campement,
  habitants,
  marchand,
  lieux,
  basculerInventaire: inventaire.basculerInventaire,
  basculerFabrication: fabrication.basculerFabrication,
  basculerQuetes: quetes.basculerQuetes,
  rafraichirInventaire: inventaire.rafraichirInventaire,
  rafraichirQuetes: quetes.rafraichirQuetes,
  donnerXp: progression.donnerXp,
  signalerHistoire: histoire.signaler,
});
const sauvegarde = creerSauvegarde(jeu, ctx, sauvegardeMiseDeCote, partie?.arbreMigre === true);
// Ruines et petites grottes : coffres à ouvrir (E) et cristaux des grottes
// Poules et moutons du village (décor)
const ferme = creerFerme(jeu, ctx);
const ruines = creerRuinesJeu(jeu, ctx, { rafraichirInventaire: inventaire.rafraichirInventaire, lieux });
// Livre de fin : il s'ouvre une fois l'histoire terminée
const fin = creerFin(jeu, ctx, sauvegarde.sauvegarder);
const visee = creerVisee(jeu, ctx, { outil, recolte, combat, village, butinSol, pieges, ruines });
const commandes = creerCommandes(jeu, ctx, {
  inventaire,
  fabrication,
  progression,
  quetes,
  marchand,
  attaques,
  lieux,
  mort,
  village,
  campement,
  repousse,
  pieges,
  ruines,
  sorts,
  outil,
  visee,
  butinSol,
  sauvegarde,
  dialogue,
  fondu,
  fin,
});
const mouvement = creerMouvement(jeu, ctx, { arc, combat, campement, recolte });
const ambiance = creerAmbiance(jeu, ctx, { repousse, campement, pieges });
// Sons qui suivent l'état du jeu : pas, cris des créatures, musique de l'auberge
const sons = creerSons(jeu, ctx);
const miniCarte = creerMiniCarteJeu(jeu, ctx, { ecranOuvert: commandes.ecranOuvert, reperesLieux: lieux.reperes });

lancerBoucle((dt) => {
  commandes.gererEchap();
  // Armure et casque portés : montrés sur le personnage dès qu'ils changent (même en pause)
  outil.suivreTenue();
  // Pause ou livre de fin ouvert : le jeu est figé (temps compris), seule l'image reste dessinée
  if (commandes.enPause() || fin.ouvert) {
    ctx.entrees.finImage();
    ctx.renderer.render(ctx.scene, ctx.camera);
    return;
  }

  commandes.lireTouches(dt);
  const commande = commandes.commandeActive();
  const axes = commandes.lireActions(commande);
  const ordrePilote = campement.mettreAJourPilote(commande, axes, dt);
  mouvement.mettreAJour(dt, commande, axes, ordrePilote);
  commandes.lireActionsVisee(commande);
  arc.mettreAJour(dt, commande, commandes.ecranOuvert());
  visee.mettreAJour(dt, commande);
  combat.mettreAJour(dt, commandes.ecranOuvert());
  ctx.effets.mettreAJour(dt);
  mort.mettreAJourBaluchon(dt);
  butinSol.mettreAJour(dt);
  ambiance.mettreAJour(dt);
  village.mettreAJourEndommagees();
  habitants.mettreAJour(dt);
  ferme.mettreAJour(dt);
  marchand.mettreAJour(dt);
  dialogue.mettreAJour();
  histoire.mettreAJour(dt);
  fin.mettreAJour(dt, commandes.ecranOuvert() || ctx.miniCarte.grande);
  attaques.mettreAJour(dt, commandes.ecranOuvert());
  embuscades.mettreAJour(dt, commandes.ecranOuvert());
  lieux.mettreAJour(dt);
  chef.mettreAJour(dt, commandes.ecranOuvert());
  ruines.mettreAJour(dt);
  miniCarte.mettreAJour();
  sons.mettreAJour(dt, commandes.ecranOuvert());

  ctx.entrees.finImage();
  ctx.renderer.render(ctx.scene, ctx.camera);
});
