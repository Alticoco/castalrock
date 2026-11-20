// Dialogues des habitants : ce que dit chacun (salutation, quête, sujets de conversation) selon l'heure, le niveau
// du village et ce que le joueur a déjà fait, et les choix qu'il lui propose. Pur : aucun import de three, aucun
// Math.random() (les variantes sont tirées d'une graine). Rien n'est sauvegardé : tout se déduit de l'état du jeu.
// Le dialogue est un petit graphe d'écrans : `repliqueDialogue` donne le texte et les options d'un écran, et chaque
// option est une action que src/jeu/dialogue.ts applique (changer d'écran, accepter ou rendre une quête, forge, fin).
// Les quêtes elles-mêmes (conditions, rendu, récompenses) restent dans src/regles/quetes.ts.

import { creerAleatoire, hacher } from './aleatoire';
import { NOMS_HABITANTS, periodeDeLHeure, type IdHabitant, type PeriodeHabitant } from './habitants';
import { definitionObjet } from './inventaire';
import {
  chercherQuete,
  conditionsManquantes,
  progressionQuete,
  queteSuivante,
  statutQuete,
  type ContexteQuetes,
  type DefinitionQuete,
  type EtatQuetes,
  type IdChaine,
  type PossessionQuetes,
  type RecompenseQuete,
} from './quetes';

/** Chaîne de quêtes que porte chaque habitant (`null` : Hugo et Aldric n'en ont pas). */
export const CHAINE_DE_HABITANT: Readonly<Record<IdHabitant, IdChaine | null>> = {
  gaspard: 'gaspard',
  marthe: 'marthe',
  mathilde: 'mathilde',
  bertil: 'forgeron',
  hugo: null,
  aldric: null,
};

/** Ce que les répliques savent du joueur et du monde. */
export interface SituationDialogue {
  /** Heure du jeu, de 0 à 24 */
  heure: number;
  niveauVillage: number;
  quetes: EtatQuetes;
  contexteQuetes: ContexteQuetes;
  possession: PossessionQuetes;
  /** Meilleur palier d'outil : 0 base, 1 cuivre, 2 fer, 3 acier, 4 cristal */
  palierOutils: number;
  /** Vrai une fois entré dans la mine */
  mineVisitee: boolean;
  /** Vrai quand une quête acceptée ou l'étape d'histoire en cours demande de tuer des bandits */
  chasseBandits?: boolean;
  /** Fait varier les variantes : change à chaque nouvelle conversation, reste fixe pendant celle-ci */
  graine: number;
}

export type SujetDialogue = 'village' | 'legende' | 'bandits' | 'chasse' | 'pieges' | 'ruines';

export type EcranDialogue =
  | { readonly type: 'accueil' }
  | { readonly type: 'menu' }
  | { readonly type: 'travail' }
  | { readonly type: 'plus-tard' }
  | { readonly type: 'pas-pret' }
  | { readonly type: 'parler' }
  | { readonly type: 'sujet'; readonly sujet: SujetDialogue; readonly rang: number }
  | { readonly type: 'accepte'; readonly idQuete: string }
  | { readonly type: 'rendu'; readonly idQuete: string }
  | { readonly type: 'message'; readonly texte: string };

export type ActionDialogue =
  | { readonly type: 'aller'; readonly ecran: EcranDialogue }
  | { readonly type: 'accepter'; readonly idQuete: string }
  | { readonly type: 'rendre'; readonly idQuete: string }
  | { readonly type: 'forge' }
  | { readonly type: 'fermer' };

export interface OptionDialogue {
  readonly libelle: string;
  readonly action: ActionDialogue;
}

/** Une réplique : le texte de l'habitant, une ligne de détail éventuelle, puis soit une suite (E), soit des choix. */
export interface Replique {
  readonly nom: string;
  readonly texte: string;
  readonly note?: string;
  /** Écran suivant quand le joueur passe la réplique (E ou clic) ; absent quand il doit choisir une option */
  readonly suite?: EcranDialogue;
  readonly options: readonly OptionDialogue[];
}

// --- Aide -------------------------------------------------------------------------------------

/** Nombre stable tiré d'un texte (FNV-1a) : mélange la graine, l'habitant et l'écran. */
function graineDe(...parties: ReadonlyArray<string | number>): number {
  return hacher(parties.join('|'));
}

function tirer<T>(liste: readonly T[], s: SituationDialogue, id: IdHabitant, cle: string): T {
  return liste[creerAleatoire(graineDe(s.graine, id, cle)).entier(0, liste.length - 1)];
}

const faite = (s: SituationDialogue, idQuete: string): boolean => s.quetes.terminees.includes(idQuete);

/** Vrai pendant la reconstruction du village : après le retour d'Aldric, tant que la dernière quête n'est pas rendue. */
const reconstruction = (s: SituationDialogue): boolean => (s.contexteQuetes.etapesTerminees ?? []).includes('rentrer-village') && !faite(s, 'toit-chasseur');

/** Récompense d'une quête en une ligne : « 40 XP + 2 Potion de soin + 1 point de compétence ». */
export function texteRecompense(r: RecompenseQuete): string {
  return [
    `${r.xp} XP`,
    ...r.objets.map((o) => `${o.quantite} ${definitionObjet(o.objet).nom}`),
    ...(r.pointsCompetence ? [`${r.pointsCompetence} point${r.pointsCompetence > 1 ? 's' : ''} de compétence`] : []),
    ...(r.debloqueVillage ? [`autorise le village niveau ${r.debloqueVillage}`] : []),
  ].join(' + ');
}

// --- Les voix ---------------------------------------------------------------------------------

interface Reaction {
  readonly si: (s: SituationDialogue) => boolean;
  readonly textes: readonly string[];
}

/** Un sujet de conversation : pour chaque avancement, des variantes, chacune étant une suite de répliques (1 à 2). */
interface TextesSujet {
  readonly debut: ReadonlyArray<readonly string[]>;
  readonly avance: ReadonlyArray<readonly string[]>;
}

interface Voix {
  readonly salutations: Readonly<Record<PeriodeHabitant, readonly string[]>>;
  /** Première réaction qui correspond à l'état du jeu : elle suit la salutation */
  readonly reactions: readonly Reaction[];
  readonly menu: readonly string[];
  readonly parler: readonly string[];
  readonly travail: {
    readonly aucune: readonly string[];
    readonly verrouillee: readonly string[];
    readonly enCours: readonly string[];
    readonly accepte: readonly string[];
    readonly plusTard: readonly string[];
    readonly pasPret: readonly string[];
    readonly rendu: readonly string[];
  };
  readonly sujets: Readonly<Partial<Record<SujetDialogue, TextesSujet>>>;
  /** Ce qui fait passer les sujets de l'état « début » à l'état « avancé » */
  readonly avance: (s: SituationDialogue) => boolean;
}

// Raccourci pour les habitants sans quête : les textes de travail ne servent pas
const SANS_TRAVAIL = { aucune: [''], verrouillee: [''], enCours: [''], accepte: [''], plusTard: [''], pasPret: [''], rendu: [''] } as const;

const VOIX: Readonly<Record<IdHabitant, Voix>> = {
  // Gaspard : le chef, un peu inquiet et protecteur
  gaspard: {
    salutations: {
      jour: [
        'Ah, te voilà. Rien à signaler, et c’est justement ce qui m’inquiète.',
        'Bonjour. Garde l’œil ouvert, ces temps-ci : on ne sait jamais ce qui rôde.',
        'Content de te voir. Le hameau tient debout, et c’est en partie grâce à toi.',
      ],
      soir: [
        'Le soir tombe. Reste près du feu, c’est plus prudent.',
        'Encore debout ? Les nuits sont longues, par ici. Viens te réchauffer.',
        'Les lumières s’allument une à une. J’aime ça, et je m’en méfie un peu.',
      ],
      nuit: ['Il est tard. Rentre vite, je fais ma ronde.', 'À cette heure, on dort. Ou on veille, comme moi.'],
    },
    reactions: [
      { si: reconstruction, textes: ['Regarde ce qu’ils ont fait de nos toits… Mais personne n’a baissé les bras : on rebâtit, planche après planche.'] },
      { si: (s) => s.chasseBandits === true, textes: ['Ils rôdent loin du village, dans les prairies et les bois. La nuit, ils s’enhardissent. Ouvre l’œil.'] },
      { si: (s) => faite(s, 'pillards-organises'), textes: ['Cinq pillards de moins, et un camp enfin repéré. Tu fais honneur au village.', 'Tu as fait reculer les pillards. Je n’osais plus l’espérer.'] },
      { si: (s) => s.niveauVillage >= 3 || faite(s, 'le-guetteur'), textes: ['Regarde ce village, quand même. Je n’aurais jamais cru le voir aussi grand.', 'Un guetteur en haut de la colline : je dors enfin un peu mieux.'] },
      { si: (s) => s.niveauVillage >= 2 || faite(s, 'renforcer-village'), textes: ['Les palissades tiennent bon. Merci pour le bois et la pierre.', 'Le village prend de la carrure. Il en faudra, de la carrure.'] },
      { si: (s) => faite(s, 'voyageurs-detrousses'), textes: ['Les colporteurs t’en sont reconnaissants. Moi aussi.'] },
      { si: (s) => faite(s, 'gobelins'), textes: ['Plus de gobelins près des champs. Tu as fait du bon travail.'] },
      { si: (s) => s.palierOutils >= 2, textes: ['Une arme de fer au côté… Ça rassure tout le monde.'] },
      { si: (s) => faite(s, 'nuisibles'), textes: ['Les slimes se font rares dans les champs. Merci.'] },
    ],
    menu: ['Autre chose ?', 'Je t’écoute.'],
    parler: ['De quoi veux-tu parler ?', 'Parle. J’ai un peu de temps.'],
    travail: {
      aucune: ['Pour l’instant, je n’ai rien à te demander. Profite du calme… et ne t’y fie pas.', 'Tu as déjà fait plus que je n’osais espérer. Je te ferai signe si ça se gâte.'],
      verrouillee: ['Une chose à la fois. Ce que j’ai en tête doit attendre un peu.', 'J’y songe, mais ce n’est pas encore le moment.'],
      enCours: ['Tu as déjà ma demande en main. Va au bout, ensuite nous verrons.', 'Une tâche à la fois, voyons. Termine d’abord ce que je t’ai confié.'],
      accepte: ['Merci. Sois prudent, et reviens-moi entier.', 'Bien. Je compte sur toi. Ne prends pas de risques inutiles.'],
      plusTard: ['Comme tu voudras. Mais ne tarde pas trop.', 'Je comprends. La proposition reste valable.'],
      pasPret: ['Pas encore, non. Je ne voudrais pas te presser, mais le temps compte.', 'Il te manque encore quelque chose. Reviens quand ce sera fait.'],
      rendu: ['Voilà qui me rassure un peu. Merci, vraiment.', 'Bon travail. Le village te doit une fière chandelle.'],
    },
    sujets: {
      village: {
        debut: [['Le hameau est petit, mais les gens y tiennent. Mon rôle, c’est qu’ils puissent dormir tranquilles.'], ['Quelques maisons, un puits, un feu. C’est peu, mais c’est chez nous.']],
        avance: [['Regarde-le, ce village : plus de toits, plus de monde. Plus de choses à perdre, aussi.']],
      },
      bandits: {
        debut: [['Des pillards rôdent sur les routes. Pour l’instant, ils n’approchent pas trop. Ça ne durera pas.']],
        avance: [['Ils ne viennent plus en désordre : ils ont un chef, un camp, des ordres. Je n’aime pas ça du tout.', 'On parle d’un certain Morvan, le Balafré. Je préférerais ne jamais croiser son visage.']],
      },
      legende: {
        debut: [['Castalrock ? La forteresse de la montagne, tombée il y a des siècles. Mathilde en sait plus que moi.']],
        avance: [['Un grand cristal bleu protégeait la vallée, paraît-il. Les bandits le cherchent. Moi, je voudrais surtout qu’il nous épargne.']],
      },
    },
    avance: (s) => s.niveauVillage >= 2 || faite(s, 'voyageurs-detrousses'),
  },

  // Marthe : aubergiste, chaleureuse et gouailleuse
  marthe: {
    salutations: {
      jour: [
        'Tiens, voilà mon grand costaud ! T’as faim ? Dis pas non.',
        'Eh bien, quelle mine ! Assieds-toi cinq minutes, ça n’a jamais tué personne.',
        'Bonjour, mon petit ! Ça sent bon la soupe aujourd’hui, hein ?',
      ],
      soir: [
        'Ah, c’est l’heure où ça jacasse ! Viens, y a de la place près du feu.',
        'Bonsoir ! Une journée de plus au compteur, et personne n’est mort de faim. J’en suis fière.',
        'Le soir, j’ai plus de langue que de cuillère. Alors, raconte !',
      ],
      nuit: ['Mais va dormir, enfin ! Les bonnes gens sont couchés.'],
    },
    reactions: [
      { si: reconstruction, textes: ['Tout ce monde dans mon auberge, mon petit ! On dort serrés, mais on est vivants, et on a faim : les bâtisseurs ne vont pas se nourrir d’air.'] },
      { si: (s) => faite(s, 'cuir-tanneur'), textes: ['Mes ceintures sont presque toutes vendues, grâce à ton cuir !'] },
      { si: (s) => faite(s, 'ragout-marthe'), textes: ['Alors, mon ragoût, t’y as repensé ? Moi, j’y pense tous les jours.', 'Mon ragoût fait le tour du village, grâce à toi.'] },
      { si: (s) => faite(s, 'gibier'), textes: ['Merci pour le gibier : la marmite ne désemplit pas !'] },
      { si: (s) => s.niveauVillage >= 2, textes: ['Avec la place qu’on prend, bientôt il me faudra une deuxième marmite.', 'Ça défile, à l’auberge, depuis que le village grandit !'] },
      { si: (s) => faite(s, 'baies-tarte'), textes: ['Ma tarte aux baies a eu un succès fou. Tu y as eu droit, au moins ?'] },
      { si: (s) => faite(s, 'bois-hiver'), textes: ['Ton bois chauffe encore toute la salle. Bénis soient tes bras !'] },
    ],
    menu: ['Allez, autre chose ?', 'Dis-moi tout, mon petit.'],
    parler: ['Je suis une vraie pie : de quoi veux-tu qu’on cause ?', 'Pose ta question, j’ai toujours une histoire en réserve.'],
    travail: {
      aucune: ['Là, mon grand, plus rien à te demander. Tu m’as sauvé la mise cent fois.', 'Mes réserves sont pleines, pour une fois ! Reviens quand j’aurai de nouveau faim de quelque chose.'],
      verrouillee: ['Oh, j’ai bien une idée, mais il faut d’abord que tu aies fait autre chose. Patience !', 'Pas tout de suite, mon petit. Fais déjà ce qu’il faut, on en reparlera.'],
      enCours: ['Tu as déjà de quoi faire avec ma commande, non ? Reviens quand c’est réglé.', 'Eh, une chose après l’autre ! Je t’ai déjà demandé quelque chose.'],
      accepte: ['Voilà qui est parlé ! Fais vite, la marmite n’attend pas.', 'Tu es un ange. Un ange avec une grande hache, mais un ange.'],
      plusTard: ['Pas de souci. Mais si tu passes devant mon feu, ne te sauve pas sans manger !', 'Comme tu veux, mon petit. Je ne bouge pas, hein.'],
      pasPret: ['Eh, doucement, il t’en manque encore. Je sais compter, tu sais !', 'Pas encore, mon grand. Mes yeux sont vieux, mais pas à ce point.'],
      rendu: ['Ah, c’est du beau travail ! Tiens, tu l’as bien mérité.', 'Parfait ! Tu vas finir par me rendre jalouse.'],
    },
    sujets: {
      village: {
        debut: [['Le hameau ? Des gens courageux, un peu têtus, un peu trop bavards. Je les adore.', 'L’auberge, c’est pas grand-chose, mais le lit est chaud et la soupe aussi.']],
        avance: [['Voyageurs, marchands, curieux… Ça défile, à l’auberge ! Faut les nourrir, tout ce monde.']],
      },
      bandits: {
        debut: [['Les bandits ? Des gaillards sans manières. Ils ont dévalisé deux colporteurs, tu savais ? Arrivés ici en chemise !']],
        avance: [['Moi, j’ai mon rouleau à pâtisserie. Mais je préfère que ce soit toi qui t’en occupes.']],
      },
      legende: {
        debut: [['La forteresse ? Ma grand-mère disait qu’une lumière bleue veillait sur la vallée. Moi, je veillais surtout sur le gâteau.']],
        avance: [['Mathilde me parle d’un cristal qui chante. Moi, je dis : un cristal, ça ne se mange pas. Mais ça fait rêver, c’est vrai.']],
      },
    },
    avance: (s) => s.niveauVillage >= 2 || faite(s, 'voyageurs-detrousses'),
  },

  // Mathilde : herboriste, douce et savante
  mathilde: {
    salutations: {
      jour: [
        'Bonjour. Tu as de la terre sur les bottes : c’est bon signe, la terre dit tout.',
        'Ah, c’est toi. Regarde ces feuilles : elles guérissent presque d’elles-mêmes.',
        'Bienvenue. Chaque plante a une histoire, tu sais. Veux-tu que je te la conte ?',
      ],
      soir: [
        'Le soir, les herbes sentent plus fort. Respire, tu verras.',
        'Bonsoir. Le jour s’en va, la sève descend. C’est l’heure des remèdes.',
        'Tu es venu voir les étoiles ? Elles sont plus proches ici que dans les livres.',
      ],
      nuit: ['La nuit, les plantes dorment. Fais comme elles.'],
    },
    reactions: [
      { si: reconstruction, textes: ['Ma maison n’a plus de toit, et mes herbes ont pris le feu. Je dors à l’auberge, mais je cueille déjà ce qui reste : il faut bien soigner les courbatures des bâtisseurs.'] },
      { si: (s) => faite(s, 'la-barriere'), textes: ['Tu as appris la Barrière. Les anciens en seraient fiers.'] },
      { si: (s) => faite(s, 'pierre-bleue'), textes: ['Tes cristaux bleus… je les écoute chanter, le soir. Une étrange mélodie.'] },
      { si: (s) => s.mineVisitee, textes: ['Tu as respiré l’air de la mine, je le sens : un peu de pierre, un peu de nuit.'] },
      { si: (s) => faite(s, 'potions-village'), textes: ['Tes potions sont bien faites. Le village te remercie, même s’il l’ignore.'] },
      { si: (s) => faite(s, 'remedes'), textes: ['Mes tisanes n’ont jamais eu si bon goût. Merci pour les plantes.'] },
    ],
    menu: ['Y a-t-il autre chose ?', 'Je t’écoute.'],
    parler: ['De quoi aimerais-tu qu’on parle ?', 'Choisis. Je répondrai de mon mieux.'],
    travail: {
      aucune: ['Je n’ai plus de demande pour l’instant. Tu as déjà tant appris. Reviens quand tu auras de nouvelles questions.', 'Rien à te confier aujourd’hui. Ce que je sais attendra la suite.'],
      verrouillee: ['J’y pense, mais ce n’est pas encore le moment. Les choses viennent quand elles sont prêtes.', 'Pas tout de suite. Termine d’abord ce qui t’attend ailleurs.'],
      enCours: ['Tu as déjà ma demande. Prends ton temps, mais reviens m’en parler.', 'Une chose après l’autre, doucement. Je t’ai déjà confié quelque chose.'],
      accepte: ['Merci. Fais attention à toi, et à ce que tu cueilles.', 'Bien. Sans hâte, mais sans trop attendre non plus.'],
      plusTard: ['Bien sûr. Les plantes savent attendre, et moi aussi.', 'Pas de hâte. Reviens quand tu voudras.'],
      pasPret: ['Il manque encore un peu, je crois. Respire, ça viendra.', 'Pas encore tout à fait. Mais tu y es presque.'],
      rendu: ['C’est très bien. Tu as la main, vraiment. Tiens, pour toi.', 'Merci. Tu m’aides plus que tu ne le crois.'],
    },
    sujets: {
      village: {
        debut: [['Le hameau est fragile, mais il a de belles racines. Il suffit de bien l’entretenir.']],
        avance: [['Un village qui grandit, c’est comme une forêt qui repousse : de la patience, et beaucoup de soin.']],
      },
      legende: {
        debut: [['Il fut un temps où Castalrock brillait sur la montagne. Un grand cristal bleu en était le cœur.', 'On l’appelait le Cœur de Castal. Il rendait la vallée fertile et tenait les monstres loin de nos portes.']],
        avance: [
          ['Une nuit, la forteresse est tombée, et le Cœur a volé en éclats. Les cristaux de la mine en sont des fragments : voilà pourquoi ils chantent.', 'Si tu veux en savoir plus, va voir Aldric, un vieil ermite qui vit seul dans la forêt, loin d’ici. Il en sait bien plus que moi.'],
        ],
      },
      bandits: {
        debut: [['Les bandits ? Ils ne cherchent pas que de l’or. Je crois qu’ils cherchent… autre chose.']],
        avance: [['Ils ramassent les éclats de cristal. Je ne sais pas à quoi ils les destinent, mais cela m’inquiète profondément.']],
      },
    },
    avance: (s) => s.niveauVillage >= 2 || s.mineVisitee || faite(s, 'pierre-bleue'),
  },

  // Bertil : le forgeron, bourru et fier de son métier
  bertil: {
    salutations: {
      jour: [
        'Hm. Tu veux quoi ? Ah, c’est toi. Entre, c’est chaud.',
        'Le fer se bat tant qu’il est chaud. Parle vite, alors.',
        'Si t’es là pour l’enclume, c’est par là. Sinon, cause.',
      ],
      soir: [
        'Le marteau se repose. Moi aussi. Un peu.',
        'Journée de forge, soirée de repos. C’est une bonne règle.',
        'T’as de la suie… ah non, c’est la mienne.',
      ],
      nuit: ['La forge est froide. Reviens demain.'],
    },
    reactions: [
      { si: reconstruction, textes: ['Ma forge a tenu, elle. Les clous, les ferrures, c’est moi : j’y passe mes journées, et je n’ai pas le temps de causer.'] },
      { si: (s) => s.palierOutils >= 4, textes: ['Du cristal dans les outils… Jamais vu ça. Ça me vexe un peu, et ça me fascine beaucoup.'] },
      { si: (s) => s.palierOutils >= 3, textes: ['De l’acier ! Ça, c’est de l’ouvrage. Tu l’entretiens, au moins ?'] },
      { si: (s) => s.palierOutils >= 2, textes: ['Du fer, maintenant. On se rapproche d’un vrai travail.'] },
      { si: (s) => s.palierOutils >= 1, textes: ['Du cuivre. C’est tendre, mais c’est un début.'] },
      { si: () => true, textes: ['Tu tapes encore avec du bois ? Viens donc forger quelque chose.'] },
    ],
    menu: ['Quoi d’autre ?', 'Hm. Autre chose ?'],
    parler: ['De quoi ? Fais court.', 'Cause. J’ai un œil sur le feu.'],
    travail: {
      aucune: ['Plus rien à te demander. Tu as appris plus vite que la plupart.', 'Rien en ce moment. Mais si tu forges autre chose, fais-le bien.'],
      verrouillee: ['Pas encore. Y a des marches à monter une à une, pas à sauter.', 'Reviens quand t’auras fait le reste. Je suis pas pressé, moi.'],
      enCours: ['T’as déjà de l’ouvrage. Finis-le.', 'Une chose à la fois. Rends-moi d’abord celle-là.'],
      accepte: ['Bon. Fais ça proprement.', 'Bien. Ne me rapporte pas de la camelote.'],
      plusTard: ['Comme tu veux. Le fer, lui, il attend pas.', 'Hm. Reviens quand tu seras prêt.'],
      pasPret: ['C’est pas fini. Un travail à moitié, c’est pas un travail.', 'Tu veux me montrer quoi, là ? Reviens quand c’est fait.'],
      rendu: ['Pas mal. Je dirais pas mieux, mais pas mal.', 'Voilà du boulot honnête. Tiens, c’est mérité.'],
    },
    sujets: {
      village: {
        debut: [['Le village ? Petit, mais solide. Comme moi.', 'Il me faudra un atelier plus grand, un jour. Quand le village aura grandi.']],
        avance: [['Depuis que le village a grandi, la forge respire mieux. J’ai de la place pour de l’acier, enfin.']],
      },
      bandits: {
        debut: [['Des bandits ? Ça casse des portes, ça vole des chevaux. Ça forge pas. Je les méprise.']],
        avance: [['Leurs épées, c’est de la mauvaise ferraille, mais en nombre, ça fait mal. Forge-toi une bonne armure.']],
      },
      legende: {
        debut: [['La légende de Castalrock ? Les vieux disent que ses lames étaient forgées au feu d’un cristal.', 'J’aimerais bien voir ça. Un métal qui chante.']],
        avance: [['Ces cristaux de la mine, on dit que ce sont les morceaux du Cœur de Castal. Si on savait les travailler… Le rêve de tout forgeron.']],
      },
    },
    avance: (s) => s.niveauVillage >= 2 || s.palierOutils >= 2,
  },

  // Hugo : le chasseur, taiseux
  hugo: {
    salutations: {
      jour: ['Hm.', 'Salut. Chut : tu vas faire fuir le gibier.', 'Tu marches fort. Les lapins t’entendent à cent pas.'],
      soir: ['Le soir, les bêtes bougent. Moi aussi.', 'Bonne chasse, aujourd’hui ?', 'Rien à dire. Tout est calme. Pour l’instant.'],
      nuit: ['La nuit, je rentre. Les loups chassent mieux que moi.'],
    },
    reactions: [
      { si: reconstruction, textes: ['Plus de toit, mais j’ai encore mon arc. Je rapporte du gibier, et je tiens la lisière : ils ne passeront pas deux fois.'] },
      { si: (s) => faite(s, 'voyageurs-detrousses'), textes: ['Les bandits sur la route : tu t’es bien débrouillé.'] },
      { si: (s) => faite(s, 'gobelins'), textes: ['Il paraît que tu as chassé les gobelins. Bien.'] },
      { si: (s) => s.niveauVillage >= 3, textes: ['Le village est grand, maintenant. Moins de gibier près des murs.'] },
      { si: (s) => s.palierOutils >= 2, textes: ['Bonne lame. Ça se voit.'] },
      { si: (s) => s.mineVisitee, textes: ['Tu as de la poussière de mine sur les épaules. Ça ne gêne pas les bêtes.'] },
    ],
    menu: ['Autre chose ?', 'Hm ?'],
    parler: ['Quoi ?', 'Je t’écoute. Peu de mots.'],
    travail: {
      aucune: ['Rien pour toi. La forêt suffit.', 'Pas besoin d’aide. Pas aujourd’hui.'],
      verrouillee: ['Pas encore. Chaque chose en son temps.', 'Plus tard.'],
      enCours: ['Tu as déjà ce que je t’ai demandé à faire. Va.', 'Une chose à la fois.'],
      accepte: ['Bien. Je compte sur toi.', 'Merci. Je ne l’oublierai pas.'],
      plusTard: ['Comme tu veux.', 'Ça attendra.'],
      pasPret: ['Il en manque. Reviens quand tu auras tout.', 'Pas encore assez.'],
      rendu: ['Merci. Vraiment.', 'C’est fait. Je te dois une bonne prise.'],
    },
    sujets: {
      chasse: {
        debut: [['Le cerf, c’est le silence. Le sanglier, c’est le courage. Le lapin, c’est la patience.', 'Cuir, fourrure, viande : rien ne se perd. Marthe en fait de bons ragoûts.']],
        avance: [['Les loups rôdent plus près. Un gros, gris, qui commande les autres. Je l’ai vu une fois. Une seule.']],
      },
      pieges: {
        debut: [['Un piège bien posé travaille pendant que tu dors. Pose-le au bon endroit, et reviens le lendemain.', 'L’arc, lui, viendra. J’ai le bois, il me manque la corde. Patience.']],
        avance: [['L’arc, ça se prépare. Le bois est choisi, la corde viendra. Repasse me voir bientôt.']],
      },
      bandits: {
        debut: [['Des traces de bottes, loin du sentier. Pas des chasseurs, ceux-là. Ils se cachent.']],
        avance: [['Ils campent quelque part dans les bois. Je n’y vais pas seul. Toi non plus, si j’étais toi.']],
      },
    },
    avance: (s) => faite(s, 'gobelins') || s.niveauVillage >= 3 || s.palierOutils >= 2,
  },

  // Aldric : l'ermite, énigmatique
  aldric: {
    salutations: {
      jour: [
        'Tu as trouvé mon feu. Peu de gens y parviennent. Peu de gens le cherchent.',
        'Assieds-toi… ou ne t’assieds pas. Le cristal chantera quand même.',
        'Les vieilles pierres m’ont dit que tu viendrais. Elles disent beaucoup de choses.',
      ],
      soir: [
        'Le feu tient compagnie aux vieux fous. Merci d’en être un instant.',
        'Le soir, la vallée respire. Écoute : tu l’entends ?',
        'Tu marches dans la forêt à la tombée du jour. Courageux, ou pressé.',
      ],
      nuit: ['Les étoiles parlent, la nuit. Écoute. Chut.', 'La nuit est la meilleure des bibliothèques.'],
    },
    reactions: [
      { si: (s) => faite(s, 'la-barriere'), textes: ['La Barrière… Mathilde t’a bien enseigné. Elle garde la vallée mieux que bien des murs.'] },
      { si: (s) => faite(s, 'pierre-bleue'), textes: ['Tu as tenu des éclats entre tes mains. Ils se souviennent de toi.'] },
      { si: (s) => s.mineVisitee, textes: ['Tu sens le cristal. Tu es descendu là-bas, n’est-ce pas ? Tu en gardes la lueur dans les yeux.'] },
      { si: (s) => s.niveauVillage >= 2, textes: ['Le hameau grandit. La vallée respire un peu mieux.'] },
    ],
    menu: ['Autre chose, peut-être ?', 'Que cherches-tu d’autre ?'],
    parler: ['Les questions ont toujours plusieurs réponses. Choisis la tienne.', 'De quoi veux-tu que nous parlions ?'],
    travail: SANS_TRAVAIL,
    sujets: {
      legende: {
        debut: [
          ['Castalrock fut bâtie autour d’un cristal : le Cœur de Castal. Il rendait la vallée fertile et tenait les monstres à distance.', 'Une nuit, la forteresse est tombée. Le Cœur a volé en éclats. Les cristaux de la mine ? Ses éclats. Les slimes ? Sa magie qui s’écoule.'],
        ],
        avance: [
          ['Les éclats appellent les éclats, dit-on. Ceux qui les ramassent, comme les bandits, jouent avec une force qu’ils ne comprennent pas.', 'Le Cœur peut être reforgé, là où il s’est brisé : dans les ruines de la forteresse, tout en haut de la montagne. Mais pour cela, il faut savoir. Reviens quand tu auras vu les ruines : alors, je te dirai le reste.'],
        ],
      },
      ruines: {
        debut: [
          ['Dans la forêt, il reste les ruines des avant-postes de la forteresse. Des murs sans toit, de la mousse, des souvenirs.', 'Va les voir. Regarde bien. Puis reviens me trouver : j’aurai quelque chose à te dire.'],
          ['Les ruines ne parlent qu’à ceux qui les regardent longtemps. Va. Reviens quand tu auras vu les ruines.'],
        ],
        avance: [['As-tu vu les ruines ? Reviens quand tu les auras vues. Ce que j’ai à dire n’a de sens que devant elles.']],
      },
      bandits: {
        debut: [['Ces gens ramassent les éclats pour les vendre. Pauvres fous : on ne vend pas un cœur.']],
        avance: [['Leur chef, le Balafré, voudrait rassembler les éclats. Il veut ce qu’il ne saura jamais porter.']],
      },
    },
    avance: (s) => s.mineVisitee || s.niveauVillage >= 2 || faite(s, 'la-barriere') || faite(s, 'pierre-bleue'),
  },
};

/** Libellé de chaque sujet dans la liste « Parle-moi de… » */
export const LIBELLES_SUJETS: Readonly<Record<SujetDialogue, string>> = {
  village: 'Du village',
  legende: 'De la légende du Cœur de Castal',
  bandits: 'Des bandits',
  chasse: 'De la chasse',
  pieges: 'Des pièges et de l’arc',
  ruines: 'Des ruines',
};

/** Sujets proposés par un habitant, dans l'ordre. */
export function sujetsDe(id: IdHabitant): SujetDialogue[] {
  return Object.keys(VOIX[id].sujets) as SujetDialogue[];
}

// --- Quêtes -----------------------------------------------------------------------------------

/**
 * Quête de l'habitant à l'écran : la prochaine de la chaîne « Relever le village » si c'est lui qui la donne (et qu'elle
 * est disponible), sinon la prochaine de sa propre chaîne ; et son statut.
 */
function queteDe(id: IdHabitant, quetes: EtatQuetes, ctx: ContexteQuetes): { quete: DefinitionQuete; statut: ReturnType<typeof statutQuete> } | null {
  const relever = queteSuivante(quetes, 'relever');
  if (relever && relever.auteur === NOMS_HABITANTS[id]) {
    const statut = statutQuete(quetes, relever.id, ctx);
    if (statut !== 'verrouillee') return { quete: relever, statut };
  }
  const chaine = CHAINE_DE_HABITANT[id];
  if (!chaine) return null;
  const quete = queteSuivante(quetes, chaine);
  return quete ? { quete, statut: statutQuete(quetes, quete.id, ctx) } : null;
}

function queteDeChaine(id: IdHabitant, s: SituationDialogue) {
  return queteDe(id, s.quetes, s.contexteQuetes);
}

/**
 * Ce que l'habitant montre au-dessus de sa tête : « ! » jaune une quête à proposer, « ? » une quête à lui rendre,
 * « ! » doré l'étape d'histoire en cours (prioritaire ; décidé par src/jeu/habitants.ts, pas par `marqueurHabitant`).
 */
export type MarqueurHabitant = 'aucun' | 'proposee' | 'a-rendre' | 'histoire';

export function marqueurHabitant(id: IdHabitant, quetes: EtatQuetes, contexte: ContexteQuetes, possession: PossessionQuetes): MarqueurHabitant {
  const trouvee = queteDe(id, quetes, contexte);
  if (!trouvee) return 'aucun';
  const { quete, statut } = trouvee;
  if (statut === 'proposee') return 'proposee';
  if (statut === 'en-cours' && progressionQuete(quetes, quete, possession, contexte).prete) return 'a-rendre';
  return 'aucun';
}

// --- Écrans -----------------------------------------------------------------------------------

function optionsMenu(id: IdHabitant, s: SituationDialogue): OptionDialogue[] {
  const options: OptionDialogue[] = [];
  const q = queteDeChaine(id, s);
  if (q?.statut === 'en-cours') {
    const prete = progressionQuete(s.quetes, q.quete, s.possession, s.contexteQuetes).prete;
    options.push({
      libelle: 'J’ai ce que tu m’as demandé',
      action: prete ? { type: 'rendre', idQuete: q.quete.id } : { type: 'aller', ecran: { type: 'pas-pret' } },
    });
  } else if (q || CHAINE_DE_HABITANT[id]) {
    options.push({ libelle: 'Tu as du travail pour moi ?', action: { type: 'aller', ecran: { type: 'travail' } } });
  }
  if (id === 'bertil') options.push({ libelle: 'Montre-moi la forge', action: { type: 'forge' } });
  options.push({ libelle: 'Parle-moi de…', action: { type: 'aller', ecran: { type: 'parler' } } });
  options.push({ libelle: 'Au revoir', action: { type: 'fermer' } });
  return options;
}

/** Salutation du moment : une phrase selon l'heure, puis (s'il y en a une) une réaction à ce que le joueur a fait. */
export function salutationDialogue(id: IdHabitant, s: SituationDialogue): string {
  const voix = VOIX[id];
  // Aldric ne suit pas la routine du village : il est toujours là, la nuit comme le jour
  const periode = periodeDeLHeure(s.heure);
  const phrase = tirer(voix.salutations[periode], s, id, `salut-${periode}`);
  const reaction = voix.reactions.find((r) => r.si(s));
  return reaction ? `${phrase} ${tirer(reaction.textes, s, id, 'reaction')}` : phrase;
}

function repliqueSimple(id: IdHabitant, texte: string, options: readonly OptionDialogue[], suite?: EcranDialogue, note?: string): Replique {
  return { nom: NOMS_HABITANTS[id], texte, options, ...(suite ? { suite } : {}), ...(note ? { note } : {}) };
}

/** Texte et options d'un écran du dialogue. */
export function repliqueDialogue(id: IdHabitant, ecran: EcranDialogue, s: SituationDialogue): Replique {
  const voix = VOIX[id];
  const retourMenu: EcranDialogue = { type: 'menu' };
  switch (ecran.type) {
    case 'accueil':
      return repliqueSimple(id, salutationDialogue(id, s), optionsMenu(id, s));
    case 'menu':
      return repliqueSimple(id, tirer(voix.menu, s, id, 'menu'), optionsMenu(id, s));
    case 'travail': {
      const q = queteDeChaine(id, s);
      const t = voix.travail;
      if (!q) return repliqueSimple(id, tirer(t.aucune, s, id, 'aucune'), [], retourMenu);
      if (q.statut === 'en-cours') return repliqueSimple(id, tirer(t.enCours, s, id, 'en-cours'), [], retourMenu);
      if (q.statut === 'proposee') {
        return repliqueSimple(
          id,
          q.quete.description,
          [
            { libelle: 'Accepter', action: { type: 'accepter', idQuete: q.quete.id } },
            { libelle: 'Plus tard', action: { type: 'aller', ecran: { type: 'plus-tard' } } },
          ],
          undefined,
          `${q.quete.titre} — Récompense : ${texteRecompense(q.quete.recompense)}`,
        );
      }
      const manque = conditionsManquantes(s.quetes, q.quete, s.contexteQuetes).join(' ; ');
      return repliqueSimple(id, tirer(t.verrouillee, s, id, 'verrouillee'), [], retourMenu, manque || undefined);
    }
    case 'plus-tard':
      return repliqueSimple(id, tirer(voix.travail.plusTard, s, id, 'plus-tard'), [], retourMenu);
    case 'pas-pret': {
      const q = queteDeChaine(id, s);
      const p = q ? progressionQuete(s.quetes, q.quete, s.possession, s.contexteQuetes) : null;
      return repliqueSimple(id, tirer(voix.travail.pasPret, s, id, 'pas-pret'), [], retourMenu, q && p ? `${q.quete.titre} : ${p.actuel}/${p.requis}` : undefined);
    }
    case 'accepte': {
      const quete = chercherQuete(ecran.idQuete);
      return repliqueSimple(id, tirer(voix.travail.accepte, s, id, 'accepte'), [], retourMenu, quete ? `Quête acceptée : ${quete.titre}` : undefined);
    }
    case 'rendu': {
      const quete = chercherQuete(ecran.idQuete);
      return repliqueSimple(id, tirer(voix.travail.rendu, s, id, 'rendu'), [], retourMenu, quete ? `Quête terminée : ${quete.titre} — ${texteRecompense(quete.recompense)}` : undefined);
    }
    case 'message':
      return repliqueSimple(id, ecran.texte, [], retourMenu);
    case 'parler': {
      const options: OptionDialogue[] = sujetsDe(id).map((sujet) => ({
        libelle: LIBELLES_SUJETS[sujet],
        action: { type: 'aller', ecran: { type: 'sujet', sujet, rang: 0 } },
      }));
      options.push({ libelle: 'Une autre fois', action: { type: 'aller', ecran: retourMenu } });
      return repliqueSimple(id, tirer(voix.parler, s, id, 'parler'), options);
    }
    case 'sujet': {
      const textes = voix.sujets[ecran.sujet];
      if (!textes) return repliqueSimple(id, tirer(voix.menu, s, id, 'menu'), optionsMenu(id, s));
      const variantes = voix.avance(s) ? textes.avance : textes.debut;
      const lignes = tirer(variantes, s, id, `sujet-${ecran.sujet}-${voix.avance(s) ? 'avance' : 'debut'}`);
      const rang = Math.min(ecran.rang, lignes.length - 1);
      const suite: EcranDialogue = rang + 1 < lignes.length ? { type: 'sujet', sujet: ecran.sujet, rang: rang + 1 } : { type: 'parler' };
      return repliqueSimple(id, lignes[rang], [], suite);
    }
  }
}
