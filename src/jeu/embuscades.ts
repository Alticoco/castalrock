// Embuscades de bandits (règles : src/regles/embuscades.ts) : tant qu'un objectif demande de tuer des bandits, le temps
// passé hors du village déclenche un groupe qui surgit autour du joueur. Les bandits (identifiants `embuscade:...`)
// sont des bandits ordinaires pour le combat et les quêtes. Rien n'est sauvegardé : le compteur repart de zéro au chargement.
import { CONFIG } from '../config';
import { creerAleatoire } from '../regles/aleatoire';
import type { MondeApparition } from '../regles/apparitions';
import {
  MESSAGE_EMBUSCADE,
  PREFIXE_BANDIT_EMBUSCADE,
  avancerCompteur,
  choisirGroupe,
  creerCompteur,
  objectifBanditsActif,
} from '../regles/embuscades';
import { zonesLibresLieux } from '../regles/lieux';
import { heureDuJeu, phaseDeLHeure } from '../regles/temps';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';

// Graine du générateur des embuscades (délais, directions, tailles de groupe)
const GRAINE_EMBUSCADES = 7411;

export interface DependancesEmbuscades {
  /** Fait apparaître un bandit hors des points d'apparition (combat) */
  ajouterEnnemiSpecial: (id: string, type: 'bandit', x: number, z: number) => void;
  /** Retire un ennemi du monde (combat) */
  retirerEnnemi: (id: string) => void;
  /** Une attaque du village est-elle en cours ? */
  attaqueEnCours: () => boolean;
}

export function creerEmbuscades(jeu: EtatJeu, ctx: Contexte, dep: DependancesEmbuscades) {
  const { terrain, mine, invite } = ctx;
  const alea = creerAleatoire((CONFIG.graine ^ GRAINE_EMBUSCADES) >>> 0);
  let compteur = creerCompteur(alea);
  // Identifiants du groupe d'embuscade présent ; numéro du groupe lancé depuis le démarrage
  let ids: string[] = [];
  let numero = 0;

  const monde: MondeApparition = {
    biome: (x, z) => terrain.biomeDominant(x, z).id,
    hauteur: (x, z) => terrain.hauteur(x, z),
    niveauEau: terrain.niveauEau,
    pente: (x, z) => terrain.pente(x, z),
    zonesSansEnnemi: zonesLibresLieux(ctx.lieux).map((z) => ({ ...z, rayon: z.rayon + CONFIG.apparitions.margeLieux })),
  };

  /** Bandits d'embuscade encore debout ; les autres (morts ou retirés) sont oubliés. */
  function vivants(): string[] {
    ids = ids.filter((id) => {
      const present = jeu.ennemis.get(id);
      return present !== undefined && present.etat.phase !== 'mort';
    });
    return ids;
  }

  /** Les bandits trop loin du joueur disparaissent. */
  function retirerLesLointains(): void {
    const { x, z } = jeu.etat;
    for (const id of ids) {
      const present = jeu.ennemis.get(id);
      if (present && Math.hypot(present.etat.x - x, present.etat.z - z) > CONFIG.embuscades.distanceDisparition) dep.retirerEnnemi(id);
    }
  }

  function surgir(): boolean {
    const positions = choisirGroupe(monde, { x: jeu.etat.x, z: jeu.etat.z }, jeu.etat.orientation, alea);
    if (!positions) return false;
    numero += 1;
    ids = positions.map((p, i) => {
      const id = `${PREFIXE_BANDIT_EMBUSCADE}${numero}:${i}`;
      dep.ajouterEnnemiSpecial(id, 'bandit', p.x, p.z);
      return id;
    });
    invite.annoncer(MESSAGE_EMBUSCADE);
    return true;
  }

  /** À chaque image. `fige` : un écran est ouvert, le temps ne compte pas. */
  function mettreAJour(dt: number, fige: boolean): void {
    retirerLesLointains();
    if (fige) return;
    const { x, z } = jeu.etat;
    const camp = ctx.lieux.camp;
    const avant = compteur;
    const r = avancerCompteur(
      compteur,
      dt,
      {
        objectifActif: objectifBanditsActif(jeu.quetes, jeu.histoire),
        distanceVillage: Math.hypot(x, z),
        dedans: mine.contient(x, z),
        biome: terrain.biomeDominant(x, z).id,
        attaqueEnCours: dep.attaqueEnCours(),
        distanceCamp: Math.hypot(x - camp.x, z - camp.z),
        morvanVaincu: jeu.lieux.morvanVaincu,
        nuit: phaseDeLHeure(heureDuJeu(jeu.tempsJeu, CONFIG.temps), CONFIG.temps) === 'nuit',
        groupePresent: vivants().length > 0,
      },
      alea,
    );
    compteur = r.compteur;
    // Aucune position valide autour du joueur : on garde le compteur « prêt » et on réessaie à l'image suivante
    if (r.declenche && !surgir()) compteur = { ecoule: avant.ecoule + dt, delai: avant.delai };
  }

  return { mettreAJour };
}

export type Embuscades = ReturnType<typeof creerEmbuscades>;
