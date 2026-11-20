import { CONFIG } from '../config';
// Progression : XP, niveaux, arbre de compétences (écran K) et taille du sac magique.
import { durabiliteMax, type EmplacementUsure } from '../regles/equipement';
import { agrandir } from '../regles/inventaire';
import { chercherNoeud } from '../regles/competences';
import { SANS_BARRIERE } from '../regles/sorts';
import type { EvenementQuete } from '../regles/quetes';
import {
  MESSAGES_NOEUD,
  acheterNoeud,
  aLeNoeud,
  casesSacTotal,
  casesTransport,
  donnerPoints,
  facteurDurabilite,
  gagnerXp,
  pvMax,
  reinitialiserArbre,
} from '../regles/progression';
import { creerEcranCompetences } from '../ui/ecranCompetences';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

export interface DependancesProgression {
  rafraichirInventaire: () => void;
  /** Un nœud acquis fait avancer la quête « apprendre un nœud » */
  signalerQuete: (ev: EvenementQuete) => void;
}

export function creerProgressionJeu(jeu: EtatJeu, ctx: Contexte, dep: DependancesProgression) {
  const { entrees, compteur, interfaceProgression } = ctx;

  /** Le sac magique grandit avec le niveau, sans jamais perdre d'objet. Renvoie vrai s'il a gagné des cases. */
  function ajusterSac(): boolean {
    const apres = agrandir(jeu.sac, casesSacTotal(jeu.progression));
    if (apres === jeu.sac) return false;
    jeu.sac = apres;
    return true;
  }
  ajusterSac();

  /** Donne de l'XP ; chaque niveau franchi donne un point de compétence, avec une notification. */
  function donnerXp(quantite: number): void {
    const r = gagnerXp(jeu.progression, quantite);
    jeu.progression = r.progression;
    if (r.niveauxGagnes === 0) return;
    const n = r.niveauxGagnes;
    interfaceProgression.annoncerNiveau(`Niveau ${jeu.progression.niveau} ! +${n} point${n > 1 ? 's' : ''} de compétence`);
    if (ajusterSac()) {
      dep.rafraichirInventaire();
      compteur.annoncerMessage('Sac magique : +1 case');
    }
    if (ecranCompetences.ouvert) ecranCompetences.afficher(jeu.progression);
  }

  /** Récompense de quête : un ou plusieurs points de compétence en plus de ceux des niveaux. */
  function donnerPointsCompetence(quantite = 1): void {
    jeu.progression = donnerPoints(jeu.progression, quantite);
    interfaceProgression.annoncerNiveau(`+${quantite} point${quantite > 1 ? 's' : ''} de compétence`);
    if (ecranCompetences.ouvert) ecranCompetences.afficher(jeu.progression);
  }

  /** Clic sur un nœud : le point est dépensé, et les effets immédiats s'appliquent (vie, cases, durabilité). */
  function acheterCompetence(id: string): void {
    const avant = jeu.progression;
    const r = acheterNoeud(avant, id);
    if (!r.ok) {
      ecranCompetences.afficher(avant, { texte: r.raison ? MESSAGES_NOEUD[r.raison] : '', ok: false });
      return;
    }
    jeu.progression = r.progression;
    // Robustesse : seul le maximum de vie monte (pas de soin gratuit : sinon, réinitialiser puis racheter soignerait à volonté)
    // Porteur : de nouvelles cases vides à l'inventaire porté
    // Taille visée = cases de départ + cases de l'arbre : une ancienne partie dont l'inventaire a gardé les
    // cases des anciens rangs de Transport ne les reçoit pas une deuxième fois
    const casesVisees = CONFIG.inventaire.casesPorte + casesTransport(jeu.progression);
    if (casesTransport(jeu.progression) > casesTransport(avant) && casesVisees > jeu.inventaire.cases.length) {
      jeu.inventaire = agrandir(jeu.inventaire, casesVisees);
      dep.rafraichirInventaire();
    }
    // Grand sac : le sac magique s'agrandit tout de suite
    if (ajusterSac()) dep.rafraichirInventaire();
    // Maître forgeron : durabilité maximale en hausse (la durabilité actuelle ne change pas)
    if (facteurDurabilite(jeu.progression) !== (jeu.equipement.facteurDurabilite ?? 1)) {
      jeu.equipement = { ...jeu.equipement, facteurDurabilite: facteurDurabilite(jeu.progression) };
    }
    ecranCompetences.afficher(jeu.progression, { texte: `${chercherNoeud(id)?.nom ?? id} : acquise`, ok: true });
    dep.signalerQuete({ type: 'noeudAcquis', noeud: id });
  }

  /**
   * Bouton « Réinitialiser » : tous les nœuds sont oubliés, les points rendus. Les effets suivent : vie et mana ramenés
   * aux nouveaux maximums, durabilité maximale recalculée. Les sorts et la barre des sorts se lisent à chaque image dans
   * les nœuds acquis : un sort oublié n'est plus lançable. La barrière en cours disparaît si elle n'est plus apprise.
   * Les cases d'inventaire et de sac déjà gagnées restent (jamais d'objet perdu).
   */
  function reinitialiserCompetences(): void {
    const avant = jeu.progression;
    if (avant.noeuds.length === 0) return;
    jeu.progression = reinitialiserArbre(avant);
    if (jeu.vie.pv > pvMax(jeu.progression)) jeu.vie = { ...jeu.vie, pv: pvMax(jeu.progression) };
    if (facteurDurabilite(jeu.progression) !== (jeu.equipement.facteurDurabilite ?? 1)) {
      const e = { ...jeu.equipement, facteurDurabilite: facteurDurabilite(jeu.progression) };
      // La durabilité actuelle ne dépasse pas le nouveau maximum (Maître forgeron oublié)
      const durabilite = { ...e.durabilite };
      for (const emplacement of Object.keys(durabilite) as EmplacementUsure[]) {
        durabilite[emplacement] = Math.min(durabilite[emplacement], durabiliteMax(e, emplacement));
      }
      jeu.equipement = { ...e, durabilite };
    }
    if (!aLeNoeud(jeu.progression, 'barriere')) jeu.barriere = SANS_BARRIERE;
    const rendus = jeu.progression.points - avant.points;
    ecranCompetences.afficher(jeu.progression, { texte: `Arbre réinitialisé : ${rendus} point${rendus > 1 ? 's' : ''} rendu${rendus > 1 ? 's' : ''}`, ok: true });
  }

  const ecranCompetences = creerEcranCompetences(ctx.ui, acheterCompetence, () => basculerCompetences(), reinitialiserCompetences);

  /** Ouvre ou ferme l'écran des compétences (touche K) : pointeur libéré et personnage figé tant qu'il est ouvert. */
  function basculerCompetences(): void {
    if (ecranCompetences.ouvert) {
      ecranCompetences.fermer();
      entrees.definirVerrouillage(!jeu.visite);
      entrees.verrouiller();
    } else {
      ecranCompetences.ouvrir();
      entrees.definirVerrouillage(false);
      ecranCompetences.afficher(jeu.progression);
    }
  }

  return { ecran: ecranCompetences, donnerXp, donnerPointsCompetence, basculerCompetences };
}

export type ProgressionJeu = ReturnType<typeof creerProgressionJeu>;
