// Dialogue avec un habitant (E devant lui) : la boîte en bas de l'écran, ses touches (E ou clic pour continuer,
// 1 à 9 pour choisir), sa fermeture (Échap, ou en s'éloignant) et ce que les choix déclenchent (accepter ou rendre
// une quête, ouvrir la forge). La réplique d'histoire de l'étape en cours passe avant l'accueil. Les textes viennent de src/regles/dialogues.ts, les quêtes de src/jeu/quetes.ts.
import { CONFIG } from '../config';
import { OUTILS, niveauOutil, rangNiveau } from '../regles/equipement';
import { HABITANTS, type IdHabitant } from '../regles/habitants';
import { heureDuJeu } from '../regles/temps';
import { objectifBanditsActif } from '../regles/embuscades';
import { repliqueDialogue, type ActionDialogue, type EcranDialogue, type Replique, type SituationDialogue } from '../regles/dialogues';
import { remplisseurIndices } from './indices';
import { creerEcranDialogue } from '../ui/dialogue';
import type { Contexte } from './contexte';
import type { EtatJeu } from './partie';
import type { Habitants } from './habitants';
import type { Histoire } from './histoire';
import type { Quetes } from './quetes';

export interface DependancesDialogue {
  habitants: Habitants;
  quetes: Quetes;
  histoire: Histoire;
  /** Ouvre l'écran de la forge (le dialogue de Bertil : « Montre-moi la forge ») */
  basculerFabrication: (lieu: 'etabli' | 'forge') => void;
}

/** Touches qui ouvrent un autre écran (inventaire, compétences, journal) */
const TOUCHES_ECRANS = ['Tab', 'KeyI', 'KeyK', 'KeyJ'];

/** Touches de choix : la rangée de chiffres et le pavé numérique, dans l'ordre des options */
const TOUCHES_CHOIX = Array.from({ length: 9 }, (_, i) => [`Digit${i + 1}`, `Numpad${i + 1}`]);

export function creerDialogue(jeu: EtatJeu, ctx: Contexte, dep: DependancesDialogue) {
  const { entrees } = ctx;
  const remplir = remplisseurIndices(ctx);
  let habitant: IdHabitant | null = null;
  let ecran: EcranDialogue = { type: 'accueil' };
  let courante: Replique | null = null;
  // Le E qui ouvre le dialogue ne doit pas aussi passer la première réplique
  let ignorerImage = false;
  // Nombre de conversations déjà eues avec chacun : les variantes de texte changent d'une fois sur l'autre
  const conversations = new Map<IdHabitant, number>();
  let graine = 0;

  const boite = creerEcranDialogue(
    ctx.ui,
    () => continuer(),
    (rang) => choisir(rang),
  );

  function situation(): SituationDialogue {
    return {
      heure: heureDuJeu(jeu.tempsJeu, CONFIG.temps),
      niveauVillage: jeu.niveauVillageReel,
      quetes: jeu.quetes,
      contexteQuetes: dep.quetes.contexteQuetes(),
      possession: { inventaire: jeu.inventaire, coffre: jeu.coffre },
      palierOutils: Math.max(...OUTILS.map((o) => rangNiveau(niveauOutil(jeu.equipement, o)))),
      mineVisitee: jeu.mineVisitee,
      chasseBandits: objectifBanditsActif(jeu.quetes, jeu.histoire),
      graine,
    };
  }

  function afficher(): void {
    if (!habitant) return;
    const brute = repliqueDialogue(habitant, ecran, situation());
    courante = { ...brute, texte: remplir(brute.texte) };
    boite.afficher({
      nom: courante.nom,
      texte: courante.texte,
      note: courante.note,
      peutContinuer: courante.suite !== undefined,
      options: courante.options,
    });
  }

  function aller(suivant: EcranDialogue): void {
    ecran = suivant;
    afficher();
  }

  function appliquer(action: ActionDialogue): void {
    switch (action.type) {
      case 'aller':
        aller(action.ecran);
        break;
      case 'accepter': {
        const r = dep.quetes.accepterUneQuete(action.idQuete);
        aller(r.ok ? { type: 'accepte', idQuete: action.idQuete } : { type: 'message', texte: r.message });
        break;
      }
      case 'rendre': {
        const r = dep.quetes.rendreUneQuete(action.idQuete);
        aller(r.ok ? { type: 'rendu', idQuete: action.idQuete } : { type: 'message', texte: r.message });
        break;
      }
      case 'forge':
        fermer(false);
        dep.basculerFabrication('forge');
        break;
      case 'fermer':
        fermer();
        break;
    }
  }

  function continuer(): void {
    if (courante?.suite) aller(courante.suite);
  }

  function choisir(rang: number): void {
    const option = courante?.options[rang];
    if (option) appliquer(option.action);
  }

  /** Commence la conversation avec un habitant : le pointeur est libéré, l'habitant se tourne vers le joueur. */
  function ouvrir(id: IdHabitant): void {
    if (habitant || jeu.vie.pv <= 0) return;
    habitant = id;
    ignorerImage = true;
    const n = conversations.get(id) ?? 0;
    conversations.set(id, n + 1);
    graine = n * 101 + HABITANTS.indexOf(id) + 1;
    dep.habitants.definirEnDialogue(id);
    entrees.definirVerrouillage(false);
    // L'histoire vise cet habitant : sa réplique d'histoire passe d'abord (l'étape est validée), puis le dialogue normal continue
    const repliqueHistoire = dep.histoire.parler(id);
    aller(repliqueHistoire ? { type: 'message', texte: repliqueHistoire } : { type: 'accueil' });
  }

  /** Ferme la boîte (Échap, « Au revoir », trop loin) ; `reverrouiller` faux quand un autre écran prend la suite. */
  function fermer(reverrouiller = true): void {
    if (!habitant) return;
    terminer();
    entrees.definirVerrouillage(!jeu.visite);
    if (reverrouiller) entrees.verrouiller();
  }

  /** Fin de la conversation, sans toucher au pointeur (un autre écran vient de s'ouvrir et le garde libre). */
  function terminer(): void {
    habitant = null;
    courante = null;
    boite.fermer();
    dep.habitants.definirEnDialogue(null);
  }

  /** À chaque image : touches du dialogue, et fin de la conversation si l'on s'éloigne trop. */
  function mettreAJour(): void {
    if (!habitant) return;
    if (ignorerImage) {
      ignorerImage = false;
      return;
    }
    const place = dep.habitants.position(habitant);
    const loin = !place || Math.hypot(place.x - jeu.etat.x, place.z - jeu.etat.z) > CONFIG.dialogue.distanceMax;
    if (loin || jeu.vie.pv <= 0) {
      fermer(false);
      return;
    }
    // Inventaire, compétences ou journal ouverts par-dessus : la conversation s'arrête, l'écran garde la main
    if (TOUCHES_ECRANS.some((c) => entrees.vientDAppuyer(c))) {
      terminer();
      return;
    }
    // Un clic sur le jeu (hors de la boîte) = partir, comme Échap ; le clic ne sert pas aussi de frappe
    if (entrees.clicGaucheDebut) {
      fermer();
      entrees.consommerClic();
      return;
    }
    if (entrees.vientDAppuyer('KeyE')) continuer();
    TOUCHES_CHOIX.forEach((codes, rang) => {
      if (courante && rang < courante.options.length && codes.some((c) => entrees.vientDAppuyer(c))) choisir(rang);
    });
  }

  return {
    get ouvert() {
      return habitant !== null;
    },
    ouvrir,
    fermer,
    mettreAJour,
  };
}

export type Dialogue = ReturnType<typeof creerDialogue>;
