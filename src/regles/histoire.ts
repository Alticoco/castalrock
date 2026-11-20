// Chaîne principale de l'histoire (étape 42) : le prologue, les actes I à IV et l'épilogue, une étape active à la fois.
// Chaque étape a un objectif affiché sous la boussole, une récompense (XP et or), un paragraphe pour le journal et,
// quand il faut parler à quelqu'un, la réplique d'histoire que cette personne dit. Les étapes « événement » (parler,
// abattre, tuer, se reposer, entrer) avancent sur événement ; les étapes « état » (palier d'outils, niveau du village,
// lieu découvert, chef vaincu, Cœur reforgé) passent toutes seules dès que le jeu les remplit. Pur : aucun import de three, aucun Math.random(). Tout est immuable.
// Conception : docs/conception-chaine-principale.md ; textes : ton de docs/conception-histoire.md.

import { CONFIG } from '../config';
import type { IdHabitant } from './habitants';
import { retirer, compter, type Conteneur } from './inventaire';
import type { ObjetDemande } from './quetes';

export type IdActe = 'prologue' | 'I' | 'II' | 'III' | 'IV' | 'epilogue';

/** Titre complet de chaque acte (annoncé au passage d'un acte, et titre de section du journal). */
export const TITRES_ACTES: Readonly<Record<IdActe, string>> = {
  prologue: 'Prologue — L’arrivée',
  I: 'Acte I — S’installer',
  II: 'Acte II — La menace',
  III: 'Acte III — Le secret de Castalrock',
  IV: 'Acte IV — Le Balafré',
  epilogue: 'Épilogue',
};

/** Début court de l'objectif affiché : « Acte I — Forge un outil en cuivre ». */
const PREFIXES_ACTES: Readonly<Record<IdActe, string>> = {
  prologue: 'Prologue',
  I: 'Acte I',
  II: 'Acte II',
  III: 'Acte III',
  IV: 'Acte IV',
  epilogue: 'Épilogue',
};

export type ConditionHistoire =
  | { readonly type: 'parler'; readonly habitant: IdHabitant }
  /** Parler à tous, dans n'importe quel ordre */
  | { readonly type: 'parlerTous'; readonly habitants: readonly IdHabitant[] }
  /** Abattre des arbres (le branchement du jeu décide ce qui est un arbre) */
  | { readonly type: 'abattre'; readonly quantite: number }
  | { readonly type: 'tuer'; readonly ennemi: string; readonly quantite: number }
  /** Tuer des animaux sauvages, de n'importe quelle espèce */
  | { readonly type: 'animaux'; readonly quantite: number }
  | { readonly type: 'seReposer' }
  | { readonly type: 'entrerMaison' }
  /** Meilleur palier d'outil : 0 base, 1 cuivre, 2 fer, 3 acier, 4 cristal */
  | { readonly type: 'palierOutils'; readonly palier: number }
  | { readonly type: 'niveauVillage'; readonly niveau: number }
  /** S'approcher d'un lieu de l'histoire (voir src/regles/lieux.ts) */
  | { readonly type: 'decouvrir'; readonly lieu: string }
  /** Vaincre un chef (voir src/regles/chef.ts) */
  | { readonly type: 'vaincre'; readonly chef: string }
  /** S'approcher du centre du village (état) : `distance` en mètres */
  | { readonly type: 'procheVillage'; readonly distance: number }
  /** Une quête des villageois est rendue (état) */
  | { readonly type: 'queteRendue'; readonly quete: string }
  /** Reforger le Cœur de Castal, dans les ruines de la forteresse */
  | { readonly type: 'reforger' }
  /** Avoir les objets, puis parler à l'habitant : ils sont alors pris (inventaire, coffre, puis sac) */
  | { readonly type: 'remettre'; readonly habitant: IdHabitant; readonly objets: readonly ObjetDemande[] };

export interface RepliqueHistoire {
  readonly habitant: IdHabitant;
  readonly texte: string;
}

export interface EtapeHistoire {
  readonly id: string;
  readonly acte: IdActe;
  /** Texte affiché sous la boussole (sans le préfixe d'acte ni le compteur) */
  readonly objectif: string;
  readonly condition: ConditionHistoire;
  readonly recompense: { readonly xp: number; readonly or: number };
  /**
   * Réplique d'histoire dite à la place de la salutation quand l'étape est « parler » ou « remettre » ;
   * une par personne pour « parler à tous » (dite à la première rencontre).
   */
  readonly repliques?: readonly RepliqueHistoire[];
  /** Paragraphe ajouté au journal de l'histoire quand l'étape est terminée */
  readonly recit: string;
}

const recompense = (acte: IdActe) => CONFIG.histoire.recompenses[acte];

/** Les étapes, dans l'ordre. */
export const ETAPES_HISTOIRE: readonly EtapeHistoire[] = [
  // --- Prologue : l'arrivée ---
  {
    id: 'parler-gaspard',
    acte: 'prologue',
    objectif: 'Parle à Gaspard, sur la place',
    condition: { type: 'parler', habitant: 'gaspard' },
    recompense: recompense('prologue'),
    repliques: [
      {
        habitant: 'gaspard',
        texte:
          'Bienvenue au hameau, voyageur. Moi, c’est Gaspard : je veille sur ce qu’il reste de la vallée. ' +
          'Ici, on gagne sa place à la sueur de son front, et le village manque de bois. Tiens, je te prête une hache, une pioche et une épée en bois : de quoi commencer. Coupe-moi trois arbres, nous verrons ce que tu vaux.',
      },
    ],
    recit:
      'Tu es arrivé au hameau, la poussière de la route encore aux bottes. Gaspard, le chef du village, t’a accueilli sur la place et t’a prêté une hache, une pioche et une épée en bois, de quoi commencer, puis confié une première tâche : du bois.',
  },
  {
    id: 'couper-arbres',
    acte: 'prologue',
    objectif: 'Coupe 3 arbres',
    condition: { type: 'abattre', quantite: 3 },
    recompense: recompense('prologue'),
    recit: 'Trois arbres sont tombés sous ta hache. Le bois sent bon la résine, et le village commence à te regarder autrement.',
  },
  {
    id: 'passer-la-nuit',
    acte: 'prologue',
    objectif: 'Passe la nuit au feu de camp ou à l’auberge',
    condition: { type: 'seReposer' },
    recompense: recompense('prologue'),
    recit: 'La nuit est tombée sur le hameau. Tu t’es reposé près des flammes, et pour la première fois depuis longtemps, tu as dormi sans trembler.',
  },
  {
    id: 'entrer-maison',
    acte: 'prologue',
    objectif: 'Entre dans ta nouvelle maison, près du potager',
    condition: { type: 'entrerMaison' },
    recompense: recompense('prologue'),
    recit: 'Gaspard t’a désigné la vieille maison du potager. Les murs craquent un peu, mais c’est un toit, et désormais il est à toi.',
  },

  // --- Acte I : s'installer ---
  {
    id: 'connaitre-habitants',
    acte: 'I',
    objectif: 'Fais connaissance avec Marthe, Mathilde et Bertil',
    condition: { type: 'parlerTous', habitants: ['marthe', 'mathilde', 'bertil'] },
    recompense: recompense('I'),
    repliques: [
      {
        habitant: 'marthe',
        texte: 'Tiens, un nouveau visage ! Moi, c’est Marthe : l’auberge est à moi, et la soupe aussi. Si tu as faim ou sommeil, tu sais où venir.',
      },
      {
        habitant: 'mathilde',
        texte: 'Ah, c’est toi, le nouveau. Je m’appelle Mathilde. Je cueille, je distille, et je regarde le monde de loin : les plantes en savent plus long que les gens.',
      },
      {
        habitant: 'bertil',
        texte: 'Bertil, forgeron. Apporte-moi du minerai et du charbon, et je te ferai des outils dont tu seras fier.',
      },
    ],
    recit:
      'Marthe tient l’auberge et connaît tous les secrets du village, Mathilde herborise à l’écart, Bertil fait chanter l’enclume. Tu n’es plus un inconnu : tu es un voisin.',
  },
  {
    id: 'outil-cuivre',
    acte: 'I',
    objectif: 'Forge un outil en cuivre',
    condition: { type: 'palierOutils', palier: 1 },
    recompense: recompense('I'),
    recit: 'Dans la chaleur de la forge, tu as tiré ton premier outil de cuivre. Il est tendre et rougeoyant, mais c’est le premier maillon d’une longue chaîne.',
  },
  {
    id: 'slimes',
    acte: 'I',
    objectif: 'Débarrasse le village de 5 slimes',
    condition: { type: 'tuer', ennemi: 'slime', quantite: 5 },
    recompense: recompense('I'),
    recit: 'Les slimes rampaient jusque dans les potagers. Tu en as chassé cinq, et les habitants osent de nouveau sortir à la tombée du jour.',
  },
  {
    id: 'village-niveau-2',
    acte: 'I',
    objectif: 'Fais passer le village au niveau 2',
    condition: { type: 'niveauVillage', niveau: 2 },
    recompense: recompense('I'),
    recit: 'De nouvelles maisons, de nouvelles palissades : le hameau prend des airs de village. On dit qu’un chasseur cherche justement un endroit où s’installer.',
  },
  {
    // Hugo n'apparaît qu'au village niveau 2 : cette étape vient bien après la précédente
    id: 'saluer-hugo',
    acte: 'I',
    objectif: 'Va saluer Hugo, le chasseur qui s’installe',
    condition: { type: 'parler', habitant: 'hugo' },
    recompense: recompense('I'),
    repliques: [
      {
        habitant: 'hugo',
        texte:
          'Salut, l’ami. Hugo, chasseur. J’ai posé mes affaires à l’orée du village : c’est calme, ici, pour l’instant. ' +
          'Si tu veux apprendre à traquer et à tendre un piège, je suis ton homme.',
      },
    ],
    recit: 'Hugo s’est installé à la lisière, l’arc à l’épaule et le regard tranquille. Il connaît chaque piste de la vallée, et il a promis de t’apprendre à les lire.',
  },

  // --- Acte II : la menace ---
  {
    id: 'bandits-routes',
    acte: 'II',
    objectif: 'Repousse 3 bandits sur les routes',
    condition: { type: 'tuer', ennemi: 'bandit', quantite: 3 },
    recompense: recompense('II'),
    recit: 'Des voyageurs arrivaient au village détroussés. Tu as barré la route à trois bandits : ce ne sont pas de simples brigands de passage, ils semblent bien organisés.',
  },
  {
    id: 'chasse-hugo',
    acte: 'II',
    objectif: 'Chasse 2 bêtes sauvages avec les conseils de Hugo',
    condition: { type: 'animaux', quantite: 2 },
    recompense: recompense('II'),
    recit: 'Hugo t’a montré comment approcher le gibier sans bruit. Deux bêtes plus tard, la viande ne manque plus à l’auberge, et tu sais lire une piste.',
  },
  {
    id: 'outil-acier',
    acte: 'II',
    objectif: 'Forge un outil en acier',
    condition: { type: 'palierOutils', palier: 3 },
    recompense: recompense('II'),
    recit: 'L’acier a chanté sur l’enclume de Bertil. Un outil de cette trempe tiendrait tête à n’importe quelle lame de bandit.',
  },

  // --- Acte III : le secret de Castalrock ---
  {
    id: 'legende-mathilde',
    acte: 'III',
    objectif: 'Demande à Mathilde ce qu’elle sait de Castalrock',
    condition: { type: 'parler', habitant: 'mathilde' },
    recompense: recompense('III'),
    repliques: [
      {
        habitant: 'mathilde',
        texte:
          'Les bandits ne cherchent pas que de l’or, tu sais. Autrefois, la forteresse de Castalrock dominait la vallée, bâtie autour d’un grand cristal bleu : le Cœur de Castal. ' +
          'Une nuit, elle est tombée, et le Cœur a volé en éclats. Les cristaux de la mine en sont les fragments. ' +
          'Va voir Aldric, l’ermite : il vit dans la forêt, {direction:aldric} du village, à environ {distance:aldric} pas. Il en sait bien plus que moi.',
      },
    ],
    recit:
      'Mathilde t’a raconté la légende : la forteresse de Castalrock, le Cœur de cristal bleu brisé une nuit de malheur, et ses éclats qui dorment encore dans la mine. Les bandits les cherchent.',
  },
  {
    id: 'trouver-aldric',
    acte: 'III',
    objectif: 'Trouve Aldric l’ermite, {direction:aldric} du village, à environ {distance:aldric} pas',
    condition: { type: 'parler', habitant: 'aldric' },
    recompense: recompense('III'),
    repliques: [
      {
        habitant: 'aldric',
        texte:
          'Tiens, un visiteur. Peu de gens trouvent mon feu. Mathilde t’envoie, je suppose ? Alors tu sais déjà l’essentiel : le Cœur peut être reforgé, ' +
          'mais il faut des fragments, beaucoup, et une main qui ne tremble pas. Commence par m’en rapporter cinq, bien bleus, tirés de la mine : elle est {direction:mine} du village, à environ {distance:mine} pas.',
      },
    ],
    recit: 'Dans la forêt, près d’un petit feu, tu as trouvé Aldric l’ermite. Il parle peu, mais ses yeux ont vu Castalrock debout. Pour t’éprouver, il t’a demandé cinq cristaux bleus.',
  },
  {
    id: 'rentrer-village',
    acte: 'III',
    objectif: 'Rentre au village : de la fumée monte au-dessus des toits',
    condition: { type: 'procheVillage', distance: 30 },
    recompense: recompense('III'),
    recit: 'Pendant ton absence, une colonne de fumée s’est élevée au-dessus du village. Les bandits ont frappé : des toits de chaume béants, des planches, des échelles, et des villageois déjà à l’ouvrage.',
  },
  {
    id: 'parler-gaspard-attaque',
    acte: 'III',
    objectif: 'Parle à Gaspard',
    condition: { type: 'parler', habitant: 'gaspard' },
    recompense: recompense('III'),
    repliques: [
      {
        habitant: 'gaspard',
        texte:
          'Te voilà enfin. Ils sont venus cette nuit, pendant que tu étais chez Aldric : ils ont pillé ce qu’ils pouvaient et mis le feu aux toits de chaume. ' +
          'Tout le monde s’est réfugié à l’auberge, chez Marthe, et personne n’est blessé. Ton coffre et ta maison n’ont pas été touchés. ' +
          'Mais il nous manque des bras et des ressources pour tout rebâtir. Si tu peux nous aider, nous en avons grand besoin.',
      },
    ],
    recit: 'Gaspard t’a raconté l’attaque : les bandits sont venus de nuit, ont pillé et mis le feu aux toits de chaume. Tout le village s’est réfugié à l’auberge, sans blessé. Ton coffre et ta maison sont intacts, mais il faut des bras et des ressources pour tout rebâtir.',
  },
  {
    id: 'relever-village',
    acte: 'III',
    objectif: 'Aide le village à se relever',
    condition: { type: 'queteRendue', quete: 'toit-chasseur' },
    recompense: recompense('III'),
    recit: 'Avec ton aide, les murs se sont redressés, les toits ont retrouvé leur chaume et la marmite de Marthe fume de nouveau. Le village a mal, mais il tient debout.',
  },
  {
    id: 'cristaux-aldric',
    acte: 'III',
    objectif: 'Rapporte 5 cristaux bleus de la mine ({direction:mine} du village, à environ {distance:mine} pas) à Aldric',
    condition: { type: 'remettre', habitant: 'aldric', objets: [{ objet: 'cristal-bleu', quantite: 5 }] },
    recompense: recompense('III'),
    repliques: [
      {
        habitant: 'aldric',
        texte:
          'Cinq éclats, et tous encore tièdes de magie. Le Cœur n’est pas mort : il dort en morceaux. ' +
          'Reviens me voir quand Gaspard aura un plan. Il en aura un, il en a toujours.',
      },
    ],
    recit: 'Tu as déposé cinq éclats de cristal entre les mains d’Aldric. Il les a regardés longtemps : le Cœur de Castal n’est pas mort, il dort en morceaux.',
  },

  // --- Acte IV : le Balafré ---
  {
    id: 'plan-gaspard',
    acte: 'IV',
    objectif: 'Écoute le plan de Gaspard',
    condition: { type: 'parler', habitant: 'gaspard' },
    recompense: recompense('IV'),
    repliques: [
      {
        habitant: 'gaspard',
        texte:
          'Il est temps que je te dise tout. Les pillards ont un chef, Morvan, qu’on appelle le Balafré. Il ramasse les éclats du Cœur pour les vendre, ou pour s’en servir. ' +
          'Si nous ne l’arrêtons pas, il ne restera plus rien à reforger. Son camp est dans la forêt, {direction:camp} du village, à environ {distance:camp} pas : une palissade, des tentes, un grand feu. Trouve-le, et prends-lui l’Éclat qu’il porte. ' +
          'Aldric dit que le Cœur ne se reforge que là où il s’est brisé : dans les ruines de la vieille forteresse de Castalrock, tout en haut de la montagne, {direction:ruines} du village, à environ {distance:ruines} pas. C’est là qu’il faudra monter ensuite.',
      },
    ],
    recit: 'Gaspard a étalé son plan sur la table : Morvan le Balafré, chef des bandits, fouille la vallée à la recherche des éclats du Cœur. Il faut l’arrêter avant lui.',
  },
  {
    id: 'trouver-camp',
    acte: 'IV',
    objectif: 'Trouve le camp du Balafré, dans la forêt, {direction:camp} du village, à environ {distance:camp} pas',
    condition: { type: 'decouvrir', lieu: 'camp' },
    recompense: recompense('IV'),
    recit: 'Entre les arbres, une palissade de pieux, des tentes brunes et la fumée d’un grand feu : le camp du Balafré. Ses hommes montent la garde, et lui t’attend au milieu.',
  },
  {
    id: 'battre-morvan',
    acte: 'IV',
    objectif: 'Bats Morvan le Balafré',
    condition: { type: 'vaincre', chef: 'morvan' },
    recompense: recompense('IV'),
    recit: 'Morvan le Balafré est tombé, sa grande hache à côté de lui. Dans sa main serrée brillait un éclat bleu, plus gros que tous les autres : l’Éclat du Cœur.',
  },
  {
    id: 'reforger-coeur',
    acte: 'IV',
    objectif: 'Reforge le Cœur dans les ruines de Castalrock, {direction:ruines} du village, à environ {distance:ruines} pas (Éclat du Cœur, 10 cristaux bleus, 5 lingots d’acier)',
    condition: { type: 'reforger' },
    recompense: recompense('IV'),
    recit: 'En haut de la montagne, dans la cour de la vieille forteresse, le grand cristal attendait, terne et fendu, dans son berceau de pierre. L’Éclat a repris sa place, les cristaux et l’acier se sont fondus dans une lumière bleue. Le Cœur de Castal s’est élevé, entier, et il s’est remis à battre.',
  },

  // --- Épilogue ---
  {
    id: 'village-niveau-3',
    acte: 'epilogue',
    objectif: 'Fais prospérer le village (niveau 3)',
    condition: { type: 'niveauVillage', niveau: 3 },
    recompense: recompense('epilogue'),
    recit: 'Le village est devenu prospère : des toits partout, du monde sur la place, des lumières le soir. Le Cœur de Castal bat de nouveau. La vallée est à toi.',
  },
];

/** Message de fin, après la dernière étape. */
export const MESSAGE_FIN_HISTOIRE = 'Le Cœur de Castal bat de nouveau. La vallée est à toi.';

// --- État -------------------------------------------------------------------------------------

export interface EtatHistoire {
  /** Numéro de l'étape active (`ETAPES_HISTOIRE.length` : l'histoire est finie) */
  readonly etape: number;
  /** Avancement de l'étape active quand elle compte (arbres, ennemis, animaux) */
  readonly compteur: number;
  /** Habitants déjà rencontrés pour l'étape « parler à tous » */
  readonly vus: readonly string[];
}

export function creerEtatHistoire(): EtatHistoire {
  return { etape: 0, compteur: 0, vus: [] };
}

export function histoireFinie(etat: EtatHistoire): boolean {
  return etat.etape >= ETAPES_HISTOIRE.length;
}

/** L'étape active, ou `undefined` si l'histoire est finie. */
export function etapeCourante(etat: EtatHistoire): EtapeHistoire | undefined {
  return ETAPES_HISTOIRE[etat.etape];
}

/** Vrai si l'étape `id` est l'étape active ou déjà passée (histoire finie comprise). Identifiant inconnu : faux. */
export function etapeAtteinte(etat: EtatHistoire, id: string): boolean {
  const indice = ETAPES_HISTOIRE.findIndex((e) => e.id === id);
  return indice >= 0 && etat.etape >= indice;
}

/** Identifiants des étapes terminées. */
export function etapesTerminees(etat: EtatHistoire): string[] {
  return ETAPES_HISTOIRE.slice(0, Math.max(0, etat.etape)).map((e) => e.id);
}

function suivante(etat: EtatHistoire): EtatHistoire {
  return { etape: etat.etape + 1, compteur: 0, vus: [] };
}

/** Quantité à atteindre pour une étape qui compte, ou `null`. */
function quantiteAtteindre(c: ConditionHistoire): number | null {
  switch (c.type) {
    case 'abattre':
    case 'tuer':
    case 'animaux':
      return c.quantite;
    case 'parlerTous':
      return c.habitants.length;
    default:
      return null;
  }
}

/** « Acte I — Forge un outil en cuivre », avec « (2/5) » pour les étapes qui comptent ; `null` quand l'histoire est finie. */
export function objectifAffiche(etat: EtatHistoire, remplir: (texte: string) => string = (t) => t): string | null {
  const etape = etapeCourante(etat);
  if (!etape) return null;
  const total = quantiteAtteindre(etape.condition);
  const actuel = etape.condition.type === 'parlerTous' ? etat.vus.length : etat.compteur;
  return `${PREFIXES_ACTES[etape.acte]} — ${remplir(etape.objectif)}${total === null ? '' : ` (${Math.min(actuel, total)}/${total})`}`;
}

/** Les habitants à qui parler maintenant pour faire avancer l'histoire (vide : l'étape ne demande pas de parler). */
export function ciblesParler(etat: EtatHistoire): IdHabitant[] {
  const c = etapeCourante(etat)?.condition;
  if (!c) return [];
  if (c.type === 'parler' || c.type === 'remettre') return [c.habitant];
  if (c.type === 'parlerTous') return c.habitants.filter((h) => !etat.vus.includes(h));
  return [];
}

export interface RecitHistoire {
  readonly acte: IdActe;
  readonly objectif: string;
  readonly recit: string;
}

/** Les paragraphes du journal : un par étape terminée, dans l'ordre (à regrouper par acte à l'affichage). */
export function recitsTermines(etat: EtatHistoire): RecitHistoire[] {
  return ETAPES_HISTOIRE.slice(0, Math.max(0, etat.etape)).map((e) => ({ acte: e.acte, objectif: e.objectif, recit: e.recit }));
}

// --- Événements -------------------------------------------------------------------------------

export type EvenementHistoire =
  | { readonly type: 'parle'; readonly habitant: IdHabitant }
  | { readonly type: 'arbreAbattu' }
  | { readonly type: 'ennemiTue'; readonly ennemi: string }
  | { readonly type: 'animalTue' }
  | { readonly type: 'repos' }
  | { readonly type: 'entreeMaison' };

/** Ce que le joueur possède et que « remettre » peut prendre. */
export interface ContenantsHistoire {
  readonly inventaire: Conteneur;
  readonly coffre: Conteneur;
  readonly sac: Conteneur;
}

export interface ResultatEvenementHistoire {
  readonly etat: EtatHistoire;
  /** L'étape qui vient d'être terminée par cet événement */
  readonly terminee: EtapeHistoire | null;
  /** Réplique d'histoire à dire (première rencontre d'un habitant, ou étape de dialogue terminée) */
  readonly replique: string | null;
  /** Contenants après la remise d'objets (inchangés sinon) ; absents si l'appelant n'en a pas donné */
  readonly contenants?: ContenantsHistoire;
}

export function totalPossede(contenants: ContenantsHistoire, objet: string): number {
  return compter(contenants.inventaire, objet) + compter(contenants.coffre, objet) + compter(contenants.sac, objet);
}

/** Vrai si tous les objets demandés par une étape « remettre » sont possédés. */
export function peutRemettre(etat: EtatHistoire, contenants: ContenantsHistoire): boolean {
  const c = etapeCourante(etat)?.condition;
  return c?.type === 'remettre' && c.objets.every((o) => totalPossede(contenants, o.objet) >= o.quantite);
}

/** Prend les objets : inventaire porté d'abord, puis coffre du village, puis sac magique. */
export function prendreObjets(contenants: ContenantsHistoire, objets: readonly ObjetDemande[]): ContenantsHistoire {
  let { inventaire, coffre, sac } = contenants;
  for (const o of objets) {
    const a = retirer(inventaire, o.objet, o.quantite);
    const b = retirer(coffre, o.objet, o.quantite - a.retire);
    const c = retirer(sac, o.objet, o.quantite - a.retire - b.retire);
    inventaire = a.conteneur;
    coffre = b.conteneur;
    sac = c.conteneur;
  }
  return { inventaire, coffre, sac };
}

function termine(etat: EtatHistoire, etape: EtapeHistoire, replique: string | null, contenants?: ContenantsHistoire): ResultatEvenementHistoire {
  return { etat: suivante(etat), terminee: etape, replique, ...(contenants ? { contenants } : {}) };
}

/**
 * Applique un événement du jeu à l'étape active. Une seule étape peut se terminer par événement ;
 * `verifierEtatHistoire` fait ensuite passer celles que l'état du jeu remplit déjà.
 * `contenants` n'est utile que pour « parle » : une étape « remettre » ne passe que si les objets y sont.
 */
export function evenementHistoire(etat: EtatHistoire, ev: EvenementHistoire, contenants?: ContenantsHistoire): ResultatEvenementHistoire {
  const rien: ResultatEvenementHistoire = { etat, terminee: null, replique: null, ...(contenants ? { contenants } : {}) };
  const etape = etapeCourante(etat);
  if (!etape) return rien;
  const c = etape.condition;
  const repliqueDe = (h: IdHabitant) => etape.repliques?.find((r) => r.habitant === h)?.texte ?? null;

  /** Une unité de plus : l'étape est terminée quand le compteur atteint la quantité. */
  const compter1 = (quantite: number): ResultatEvenementHistoire => {
    const compteur = etat.compteur + 1;
    return compteur >= quantite ? termine(etat, etape, null, contenants) : { ...rien, etat: { ...etat, compteur } };
  };

  switch (ev.type) {
    case 'parle': {
      if (c.type === 'parler' && c.habitant === ev.habitant) return termine(etat, etape, repliqueDe(ev.habitant), contenants);
      if (c.type === 'parlerTous' && c.habitants.includes(ev.habitant) && !etat.vus.includes(ev.habitant)) {
        const vus = [...etat.vus, ev.habitant];
        const replique = repliqueDe(ev.habitant);
        return vus.length >= c.habitants.length
          ? termine(etat, etape, replique, contenants)
          : { ...rien, etat: { ...etat, vus }, replique };
      }
      if (c.type === 'remettre' && c.habitant === ev.habitant && contenants && peutRemettre(etat, contenants)) {
        return termine(etat, etape, repliqueDe(ev.habitant), prendreObjets(contenants, c.objets));
      }
      return rien;
    }
    case 'arbreAbattu':
      return c.type === 'abattre' ? compter1(c.quantite) : rien;
    case 'ennemiTue':
      return c.type === 'tuer' && c.ennemi === ev.ennemi ? compter1(c.quantite) : rien;
    case 'animalTue':
      return c.type === 'animaux' ? compter1(c.quantite) : rien;
    case 'repos':
      return c.type === 'seReposer' ? termine(etat, etape, null, contenants) : rien;
    case 'entreeMaison':
      return c.type === 'entrerMaison' ? termine(etat, etape, null, contenants) : rien;
  }
}

/** Ce que les étapes « état » regardent. */
export interface SituationHistoire {
  /** Meilleur palier d'outil : 0 base, 1 cuivre, 2 fer, 3 acier, 4 cristal */
  readonly palierOutils: number;
  readonly niveauVillage: number;
  /** Lieux de l'histoire déjà découverts (absent : aucun) */
  readonly lieuxDecouverts?: readonly string[];
  /** Chefs déjà vaincus (absent : aucun) */
  readonly chefsVaincus?: readonly string[];
  /** Le Cœur de Castal a été reforgé, dans les ruines de la forteresse */
  readonly coeurReforge?: boolean;
  /** Distance du joueur au centre du village, en mètres (absent : inconnue) */
  readonly distanceVillage?: number;
  /** Quêtes des villageois déjà rendues (absent : aucune) */
  readonly quetesRendues?: readonly string[];
}

export interface ResultatVerificationHistoire {
  readonly etat: EtatHistoire;
  /** Étapes passées par cette vérification, dans l'ordre (plusieurs d'un coup possible) */
  readonly terminees: readonly EtapeHistoire[];
}

/**
 * Fait passer, en boucle, les étapes « état » déjà remplies : une partie avancée traverse l'histoire
 * jusqu'à la première étape qu'il reste à faire.
 */
export function verifierEtatHistoire(etat: EtatHistoire, situation: SituationHistoire): ResultatVerificationHistoire {
  let courant = etat;
  const terminees: EtapeHistoire[] = [];
  for (;;) {
    const etape = etapeCourante(courant);
    if (!etape) break;
    const c = etape.condition;
    const rempli =
      (c.type === 'palierOutils' && situation.palierOutils >= c.palier) ||
      (c.type === 'niveauVillage' && situation.niveauVillage >= c.niveau) ||
      (c.type === 'decouvrir' && (situation.lieuxDecouverts ?? []).includes(c.lieu)) ||
      (c.type === 'vaincre' && (situation.chefsVaincus ?? []).includes(c.chef)) ||
      (c.type === 'reforger' && situation.coeurReforge === true) ||
      (c.type === 'procheVillage' && situation.distanceVillage !== undefined && situation.distanceVillage <= c.distance) ||
      (c.type === 'queteRendue' && (situation.quetesRendues ?? []).includes(c.quete));
    if (!rempli) break;
    terminees.push(etape);
    courant = suivante(courant);
  }
  return { etat: terminees.length > 0 ? courant : etat, terminees };
}

/**
 * Sauvegarde v19 -> v20 : l'étape 45 remplace les deux étapes provisoires de l'acte IV (« éclaireurs » et « porter à
 * Aldric », numéros 16 et 17) par trois étapes (camp, Morvan, autel : 16, 17 et 18). Une partie arrêtée sur l'une
 * des deux reprend à « Trouve le camp » (compteur remis à zéro) ; l'épilogue et la fin sont décalés d'un rang.
 */
export function migrerEtapeV19(etape: number): { etape: number; remiseAZero: boolean } {
  if (etape === 16 || etape === 17) return { etape: 16, remiseAZero: true };
  return { etape: etape >= 18 ? etape + 1 : etape, remiseAZero: false };
}

/**
 * Sauvegarde v23 -> v24 : trois étapes (« Rentre au village », « Parle à Gaspard », « Aide le village à se relever ») sont
 * insérées juste après « Trouve Aldric » (numéro 13). Toute étape après lui est décalée de 3 ; une partie arrêtée sur « Trouve
 * Aldric » ou avant ne change pas.
 */
export const ETAPE_TROUVER_ALDRIC_V23 = 13;
export function migrerEtapeV23(etape: number): number {
  return etape > ETAPE_TROUVER_ALDRIC_V23 ? etape + 3 : etape;
}

/** Lit un état sauvegardé : `null` si abîmé (étape hors limites, compteur négatif, habitants inconnus…). */
export function lireEtatHistoire(v: unknown): EtatHistoire | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const { etape, compteur, vus } = v as { etape?: unknown; compteur?: unknown; vus?: unknown };
  if (!Number.isInteger(etape) || (etape as number) < 0 || (etape as number) > ETAPES_HISTOIRE.length) return null;
  if (!Number.isInteger(compteur) || (compteur as number) < 0 || (compteur as number) > 1000) return null;
  if (!Array.isArray(vus) || vus.length > 20 || vus.some((h) => typeof h !== 'string')) return null;
  return { etape: etape as number, compteur: compteur as number, vus: [...new Set(vus as string[])] };
}
