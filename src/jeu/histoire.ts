// Histoire : la chaîne principale (src/regles/histoire.ts) branchée sur le jeu. Reçoit les événements (arbre abattu,
// ennemi ou animal tué, repos, entrée dans la maison, parole à un habitant), vérifie toutes les secondes les étapes
// « état » (palier d'outils, niveau du village, lieu découvert, Morvan vaincu, Cœur reforgé), donne l'XP et l'or de chaque étape terminée, annonce l'étape et
// l'acte à l'écran, et tient la section « Quête principale » du panneau de quêtes.
import { CONFIG } from '../config';
import { INFOS_DECOR, type TypeDecor } from '../monde/decor';
import { OUTILS, niveauOutil, rangNiveau } from '../regles/equipement';
import {
  ETAPES_HISTOIRE,
  MESSAGE_FIN_HISTOIRE,
  TITRES_ACTES,
  etapeCourante,
  evenementHistoire,
  objectifAffiche,
  verifierEtatHistoire,
  type EtapeHistoire,
  type EtatHistoire,
  type EvenementHistoire,
} from '../regles/histoire';
import type { IdHabitant } from '../regles/habitants';
import { ajouter } from '../regles/inventaire';
import { lieuxDecouverts } from '../regles/lieux';
import type { EvenementQuete } from '../regles/quetes';
import type { Contexte } from './contexte';
import { remplisseurIndices } from './indices';
import type { EtatJeu } from './partie';

/** Durée d'un message à l'écran (voir src/ui/invite.ts) plus une marge : le suivant attend son tour, en ms */
const DELAI_ENTRE_MESSAGES_MS = 2400;

export interface DependancesHistoire {
  rafraichirInventaire: () => void;
  donnerXp: (quantite: number) => void;
  /** Redessine le journal (onglet « Histoire ») s'il est ouvert */
  rafraichirQuetes: () => void;
}

/** Les événements des quêtes qui comptent aussi pour l'histoire (les arbres : ce que le décor dit être un arbre). */
function evenementDeQuete(ev: EvenementQuete): EvenementHistoire | null {
  switch (ev.type) {
    case 'elementDetruit':
      return INFOS_DECOR[ev.element as TypeDecor]?.arbre ? { type: 'arbreAbattu' } : null;
    case 'ennemiTue':
      return { type: 'ennemiTue', ennemi: ev.ennemi };
    case 'animalTue':
      return { type: 'animalTue' };
    default:
      return null;
  }
}

export function creerHistoire(jeu: EtatJeu, ctx: Contexte, dep: DependancesHistoire) {
  const { invite } = ctx;
  const { suiviQuetes, mine } = ctx;
  const remplir = remplisseurIndices(ctx);
  let delai = 0;
  const messages: string[] = [];
  let minuterie: number | undefined;

  /** Les messages passent l'un après l'autre (étape finie, puis nouvel acte). */
  function annoncer(texte: string): void {
    if (minuterie === undefined) {
      invite.annoncer(texte);
      minuterie = window.setTimeout(suite, DELAI_ENTRE_MESSAGES_MS);
    } else {
      messages.push(texte);
    }
  }
  function suite(): void {
    const prochain = messages.shift();
    if (prochain === undefined) {
      minuterie = undefined;
      return;
    }
    invite.annoncer(prochain);
    minuterie = window.setTimeout(suite, DELAI_ENTRE_MESSAGES_MS);
  }

  /** Met à jour la section « Quête principale » du panneau de quêtes : titre de l'acte et objectif (avec son compteur). */
  function rafraichirObjectif(): void {
    const etape = etapeCourante(jeu.histoire);
    const complet = objectifAffiche(jeu.histoire, remplir);
    if (!etape || complet === null) {
      suiviQuetes.afficherHistoire(null);
      return;
    }
    // « Acte I — Forge un outil en cuivre (2/5) » : on garde ce qui suit le préfixe d'acte
    const coupe = complet.indexOf(' — ');
    suiviQuetes.afficherHistoire({ acte: TITRES_ACTES[etape.acte], objectif: coupe >= 0 ? complet.slice(coupe + 3) : complet });
  }

  /** Récompense d'une étape : XP, puis or (inventaire porté, puis sac magique). */
  function recompenser(etape: EtapeHistoire): void {
    dep.donnerXp(etape.recompense.xp);
    const porte = ajouter(jeu.inventaire, 'or', etape.recompense.or);
    const range = ajouter(jeu.sac, 'or', porte.reste);
    jeu.inventaire = porte.conteneur;
    jeu.sac = range.conteneur;
  }

  /** Nouvel état et étapes terminées : récompenses, messages (étape faite, puis nouvel acte ou fin), affichages. */
  function appliquer(etat: EtatHistoire, terminees: readonly EtapeHistoire[]): void {
    jeu.histoire = etat;
    for (const etape of terminees) {
      recompenser(etape);
      annoncer(`Histoire : ${etape.objectif} — fait`);
      // Les outils en cristal se débloquent à la forge quand Aldric a expliqué les cristaux (src/regles/fabrication.ts)
      if (etape.id === 'cristaux-aldric') annoncer('Bertil sait maintenant forger le cristal : passe à sa forge');
      const suivante = ETAPES_HISTOIRE[ETAPES_HISTOIRE.indexOf(etape) + 1];
      if (!suivante) annoncer(MESSAGE_FIN_HISTOIRE);
      else if (suivante.acte !== etape.acte) annoncer(TITRES_ACTES[suivante.acte]);
    }
    if (terminees.length > 0) dep.rafraichirInventaire();
    rafraichirObjectif();
    dep.rafraichirQuetes();
  }

  /** Fait passer les étapes « état » déjà remplies (palier d'outils, niveau du village, lieux, Morvan, Cœur). */
  function verifier(): void {
    const palierOutils = Math.max(...OUTILS.map((o) => rangNiveau(niveauOutil(jeu.equipement, o))));
    const r = verifierEtatHistoire(jeu.histoire, {
      palierOutils,
      niveauVillage: jeu.niveauVillageReel,
      lieuxDecouverts: lieuxDecouverts(jeu.lieux),
      chefsVaincus: jeu.lieux.morvanVaincu ? ['morvan'] : [],
      coeurReforge: jeu.lieux.coeurReforge,
      distanceVillage: mine.contient(jeu.etat.x, jeu.etat.z) ? undefined : Math.hypot(jeu.etat.x, jeu.etat.z),
      quetesRendues: jeu.quetes.terminees,
    });
    if (r.terminees.length > 0) appliquer(r.etat, r.terminees);
  }

  /** Un événement du jeu : l'étape active avance si elle le concerne, puis les étapes « état » suivantes sont vérifiées. */
  function signaler(ev: EvenementHistoire): void {
    const r = evenementHistoire(jeu.histoire, ev);
    if (r.etat === jeu.histoire) return;
    appliquer(r.etat, r.terminee ? [r.terminee] : []);
    verifier();
  }

  /** Même branchement que les quêtes : ennemi ou animal tué, élément détruit. */
  function signalerEvenementQuete(ev: EvenementQuete): void {
    const evenement = evenementDeQuete(ev);
    if (evenement) signaler(evenement);
  }

  /**
   * Le joueur aborde un habitant : fait avancer l'histoire (rencontre, parole à rendre, objets remis) et renvoie la
   * réplique d'histoire à dire d'abord, ou `null` (le dialogue normal commence alors tout de suite).
   */
  function parler(id: IdHabitant): string | null {
    const r = evenementHistoire(jeu.histoire, { type: 'parle', habitant: id }, { inventaire: jeu.inventaire, coffre: jeu.coffre, sac: jeu.sac });
    if (r.etat === jeu.histoire) return null;
    if (r.contenants) {
      jeu.inventaire = r.contenants.inventaire;
      jeu.coffre = r.contenants.coffre;
      jeu.sac = r.contenants.sac;
    }
    appliquer(r.etat, r.terminee ? [r.terminee] : []);
    verifier();
    return r.replique === null ? null : remplir(r.replique);
  }

  /** À chaque image : les étapes « état » sont revérifiées environ une fois par seconde. */
  function mettreAJour(dt: number): void {
    delai += dt;
    if (delai < CONFIG.histoire.intervalleVerification) return;
    delai = 0;
    verifier();
  }

  verifier();
  rafraichirObjectif();

  return { signaler, signalerEvenementQuete, parler, verifier, mettreAJour };
}

export type Histoire = ReturnType<typeof creerHistoire>;
