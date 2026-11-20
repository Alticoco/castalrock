// Village : interactions avec E (coffre, établi, panneau, auberge, feu, mine, forgeron, maison du joueur), amélioration,
// passages de la mine et de la maison.
import { maisonsEndommagees } from '../regles/reconstruction';
import { niveauVillageDebloque } from '../regles/quetes';
import { creerEtatPersonnage } from '../regles/deplacement';
import { ameliorer, type EtatAmelioration } from '../regles/ameliorationVillage';
import { CONFIG } from '../config';
import { pointReapparitionAuberge, pointReapparitionFeu } from '../regles/campement';
import { definirPointReapparition } from '../regles/mort';
import {
  interactionsVillage,
  obstaclesVillage,
  porteMaisonJoueur,
  type NiveauVillage,
  type PointInteraction,
  type TypeInteraction,
} from '../regles/village';
import type { MessageQuetes } from '../ui/ecranQuetes';
import type { Fondu } from '../ui/fondu';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';
import type { Campement } from './campement';
import type { Habitants } from './habitants';
import type { Marchand } from './marchand';
import type { EvenementHistoire } from '../regles/histoire';

import type { LieuxJeu } from './lieux';
import type { PotagerJeu } from './potager';

export interface DependancesVillage {
  fondu: Fondu;
  campement: Campement;
  habitants: Habitants;
  marchand: Marchand;
  /** Lieux de l'histoire : l'autel du Cœur est un point d'interaction */
  lieux: LieuxJeu;
  /** Puits (remplir le seau) et potager de la maison (arroser, récolter) */
  potager: PotagerJeu;
  basculerInventaire: (avecCoffre?: boolean) => void;
  basculerFabrication: (lieu?: 'etabli' | 'forge') => void;
  basculerQuetes: (mode?: 'panneau' | 'journal') => void;
  rafraichirInventaire: () => void;
  rafraichirQuetes: (message?: MessageQuetes) => void;
  donnerXp: (quantite: number) => void;
  /** Entrer dans la maison fait avancer l'histoire */
  signalerHistoire: (ev: EvenementHistoire) => void;
}

export function creerVillage(jeu: EtatJeu, ctx: Contexte, dep: DependancesVillage) {
  const { terrain, mine, maison, vues, invite } = ctx;
  /** Change le niveau du village : modèles, obstacles et points d'interaction. */
  function definirNiveauVillage(niveau: NiveauVillage, test = false): void {
    jeu.niveauVillage = niveau;
    if (!test) jeu.niveauVillageReel = niveau;
    jeu.obstaclesDuVillage = obstaclesVillage(niveau);
    jeu.interactions = interactionsVillage(niveau);
    ctx.village.definirNiveau(niveau);
  }
  ctx.village.definirNiveau(jeu.niveauVillage);

  // Maisons endommagées après l'attaque des bandits : déduites de l'histoire et des quêtes (rien de sauvegardé)
  let ensembleEndommagees = maisonsEndommagees(jeu.histoire, jeu.quetes);
  let histoireVue = jeu.histoire;
  let quetesVues = jeu.quetes;
  // Maisons détruites par l'attaque des bandits : affichées dès le chargement, puis à chaque changement de l'ensemble
  ctx.village.definirEndommages(ensembleEndommagees);
  /** Maisons endommagées en ce moment (identifiants du village : `maison-2`, `maison-3`). */
  const endommagees = (): ReadonlySet<string> => ensembleEndommagees;
  /** À appeler à chaque image : recalcule l'ensemble quand l'histoire ou les quêtes ont changé ; vrai s'il a changé. */
  function mettreAJourEndommagees(): boolean {
    if (jeu.histoire === histoireVue && jeu.quetes === quetesVues) return false;
    histoireVue = jeu.histoire;
    quetesVues = jeu.quetes;
    const nouveau = maisonsEndommagees(jeu.histoire, jeu.quetes);
    const change = nouveau.size !== ensembleEndommagees.size || [...nouveau].some((m) => !ensembleEndommagees.has(m));
    ensembleEndommagees = nouveau;
    if (change) ctx.village.definirEndommages(ensembleEndommagees);
    return change;
  }

  /** Améliore le village : ressources prises (inventaire puis coffre), nouveau niveau, XP. */
  function ameliorerLeVillage(): void {
    const avant: EtatAmelioration = {
      niveau: jeu.niveauVillageReel,
      inventaire: jeu.inventaire,
      coffre: jeu.coffre,
      niveauDebloque: niveauVillageDebloque(jeu.quetes, jeu.niveauVillageReel),
    };
    const r = ameliorer(avant);
    if (r.ok) {
      jeu.inventaire = r.etat.inventaire;
      jeu.coffre = r.etat.coffre;
      definirNiveauVillage(r.etat.niveau);
      dep.rafraichirInventaire();
      dep.donnerXp(r.xp);
      invite.annoncer(r.message);
    }
    dep.rafraichirQuetes({ texte: r.message, ok: r.ok });
  }

  /** E devant le portail ou devant la sortie : fondu au noir, puis le joueur est de l'autre côté. */
  function passerParLaMine(): void {
    dep.campement.arreterPilote();
    dep.fondu.jouer(() => {
      if (jeu.vie.pv <= 0) return;
      const p = mine.passage();
      jeu.etat = creerEtatPersonnage(p.x, terrain.hauteur(p.x, p.z), p.z, p.orientation);
      vues.regarderVers(p.orientation);
      jeu.mineVisitee = true;
      invite.annoncer(p.message);
    });
  }

  /** Devant la porte de la maison du joueur, dehors, dos à la porte (null si le village n'a pas cette maison). */
  const devantLaPorte = () => porteMaisonJoueur(jeu.niveauVillage, CONFIG.maison.distanceSortie);

  /** E devant la porte de la maison, dehors ou dedans : fondu au noir, puis le joueur est de l'autre côté. */
  function passerParLaMaison(): void {
    dep.campement.arreterPilote();
    dep.fondu.jouer(() => {
      if (jeu.vie.pv <= 0) return;
      const sortir = maison.contient(jeu.etat.x, jeu.etat.z);
      const p = sortir ? devantLaPorte() : maison.plan.arrivee;
      if (!p) return;
      jeu.etat = creerEtatPersonnage(p.x, terrain.hauteur(p.x, p.z), p.z, p.orientation);
      vues.regarderVers(p.orientation);
      invite.annoncer(sortir ? 'Vous sortez de chez vous' : 'Vous êtes chez vous');
      if (!sortir) dep.signalerHistoire({ type: 'entreeMaison' });
    });
  }

  /** E devant le lit : repos comme à l'auberge ; on réapparaîtra dehors, devant la porte. */
  function dormirDansLeLit(): void {
    const p = devantLaPorte();
    dep.campement.reposer(p ? definirPointReapparition(p.x, p.z, 'Votre maison') : null, 'dans votre lit');
  }

  /**
   * Point d'accroche des interactions du village : appelé quand le joueur appuie sur E devant un objet.
   * Le panneau d'annonces ouvre l'écran des quêtes ; le forgeron garde son rôle (forge).
   */
  function surInteraction(type: TypeInteraction): void {
    switch (type) {
      case 'coffre':
        dep.basculerInventaire(true);
        break;
      case 'etabli':
        dep.basculerFabrication('etabli');
        break;
      case 'panneau':
        dep.basculerQuetes('panneau');
        break;
      case 'auberge':
        dep.campement.reposer(pointReapparitionAuberge(jeu.niveauVillage), "à l'auberge");
        break;
      case 'feu':
        dep.campement.reposer(jeu.feuCamp ? pointReapparitionFeu(jeu.feuCamp) : null, 'au feu de camp');
        break;
      case 'mine':
        passerParLaMine();
        break;
      case 'maison':
        passerParLaMaison();
        break;
      case 'lit':
        dormirDansLeLit();
        break;
      case 'cheminee':
        invite.annoncer('Cuisiner : bientôt');
        break;
      case 'habitant':
        dep.habitants.parlerAuVise();
        break;
      case 'marchand':
        dep.marchand.basculer();
        break;
      case 'autel':
        dep.lieux.reforger();
        break;
      case 'puits':
      case 'potager':
        dep.potager.surInteraction(type);
        break;
      case 'forgeron':
        // Bertil à sa forge : le dialogue propose « Montre-moi la forge »
        dep.habitants.parlerAuVise();
        break;
    }
  }

  /**
   * Points d'interaction du moment : ceux du village, les habitants (Bertil remplace le forgeron fixe), le passage de la mine,
   * l'intérieur de la maison, et le feu de camp posé.
   */
  function interactionsActives(): PointInteraction[] {
    const fixes = jeu.interactions.filter((p) => p.type !== 'forgeron');
    const actives = [...fixes, ...dep.habitants.interactions(), ...dep.marchand.interactions(), mine.interaction(), ...maison.interactions(), ...dep.lieux.interactions(), ...dep.potager.interactions()];
    const { feuCamp } = jeu;
    if (feuCamp) actives.push({ type: 'feu', x: feuCamp.x, z: feuCamp.z, rayon: 0.5, invite: 'feu de camp (cuisiner, se reposer)' });
    return actives;
  }

  return { definirNiveauVillage, ameliorerLeVillage, surInteraction, interactionsActives, endommagees, mettreAJourEndommagees };
}

export type Village = ReturnType<typeof creerVillage>;
