// Quêtes des villageois : quatre chaînes (Gaspard, le forgeron, Marthe, Mathilde), conditions, événements du jeu,
// rendu et récompenses. Pur : aucun import de three, aucun Math.random(). Tout est immuable.
// Chaque chaîne avance dans l'ordre ; les quatre avancent en parallèle. Une quête peut demander un niveau de
// village ou une quête d'une autre chaîne. Les quêtes « rapporter » se rendent au panneau d'annonces : les objets
// sont pris dans l'inventaire porté, puis dans le coffre du village. Les autres quêtes comptent des événements,
// une fois la quête acceptée (sauf « apprendre un nœud », qui regarde aussi ce que le joueur a déjà).

import { CONFIG } from '../config';
import { chercherNoeud } from './competences';
import { consommer } from './fabrication';
import { ajouter, compter, type Conteneur } from './inventaire';

export interface ObjetDemande {
  readonly objet: string;
  readonly quantite: number;
}

export type ObjectifQuete =
  /** Rapporter un objet (et, si `aussi` est donné, d'autres objets en même temps) */
  | { readonly type: 'rapporter'; readonly objet: string; readonly quantite: number; readonly aussi?: readonly ObjetDemande[] }
  | { readonly type: 'tuer'; readonly ennemi: string; readonly quantite: number }
  /** Fabriquer l'une des recettes données (identifiants de src/regles/fabrication.ts) */
  | { readonly type: 'fabriquer'; readonly recettes: readonly string[]; readonly quantite: number }
  | { readonly type: 'planter'; readonly quantite: number }
  /** Détruire des éléments du décor (types de src/regles/recolte.ts) */
  | { readonly type: 'detruire'; readonly elements: readonly string[]; readonly quantite: number }
  /** Lancer n fois un sort, n'importe lequel */
  | { readonly type: 'lancerSort'; readonly quantite: number }
  /** Avoir un nœud de l'arbre de compétences (identifiant de src/regles/competences.ts) */
  | { readonly type: 'apprendreNoeud'; readonly noeud: string }
  /** Arroser le potager de la maison avec un seau d'eau (src/regles/potager.ts) */
  | { readonly type: 'arroser'; readonly quantite: number };

export interface RecompenseQuete {
  readonly xp: number;
  readonly objets: ReadonlyArray<{ readonly objet: string; readonly quantite: number }>;
  /** Points de compétence donnés en plus de l'XP */
  readonly pointsCompetence?: number;
  /** Cette quête autorise le passage du village à ce niveau (il faut encore payer l'amélioration) */
  readonly debloqueVillage?: 2 | 3;
}

export type IdChaine = 'gaspard' | 'forgeron' | 'marthe' | 'mathilde' | 'relever';

export interface Chaine {
  readonly id: IdChaine;
  /** Villageois qui porte la chaîne */
  readonly nom: string;
  readonly titre: string;
  /** Chaîne donnée et rendue en personne seulement : absente du panneau d'annonces, hors des quêtes proposées */
  readonly enPersonne?: boolean;
}

export const CHAINES: readonly Chaine[] = [
  { id: 'gaspard', nom: 'Gaspard', titre: 'La menace des bandits' },
  { id: 'forgeron', nom: 'Le forgeron', titre: "De la pierre à l'acier" },
  { id: 'marthe', nom: 'Marthe', titre: 'Une auberge accueillante' },
  { id: 'mathilde', nom: 'Mathilde', titre: 'Les anciens savoirs' },
  { id: 'relever', nom: 'Le village', titre: 'Relever le village', enPersonne: true },
];

/** Ce qu'il faut avoir avant de pouvoir accepter une quête (en plus d'avoir fini la précédente de sa chaîne). */
export interface ConditionsQuete {
  readonly niveauVillage?: number;
  /** Identifiant d'une quête (d'une autre chaîne) qui doit être terminée */
  readonly quete?: string;
  /** Identifiant d'une étape d'histoire qui doit être terminée */
  readonly etape?: string;
}

export interface DefinitionQuete {
  readonly id: string;
  readonly chaine: IdChaine;
  readonly titre: string;
  /** Villageois qui signe l'annonce */
  readonly auteur: string;
  readonly description: string;
  readonly objectif: ObjectifQuete;
  readonly recompense: RecompenseQuete;
  readonly conditions?: ConditionsQuete;
  /** Objets remis au joueur quand il accepte la quête (seulement s'il n'en possède pas déjà un) */
  readonly objetsOfferts?: readonly string[];
}

/** Les quêtes, chaîne par chaîne, dans l'ordre où elles se débloquent à l'intérieur de chaque chaîne. */
export const QUETES: readonly DefinitionQuete[] = [
  // --- Gaspard, le chef : la menace des bandits (fil rouge) ---
  {
    id: 'nuisibles',
    chaine: 'gaspard',
    titre: 'Nuisibles',
    auteur: 'Gaspard',
    description: 'Des slimes abîment nos récoltes. Débarrasse-nous-en : un village qui a faim ne tient pas debout.',
    objectif: { type: 'tuer', ennemi: 'slime', quantite: 3 },
    recompense: { xp: 40, objets: [{ objet: 'or', quantite: 5 }] },
  },
  {
    id: 'pierres-puits',
    chaine: 'gaspard',
    titre: 'Des pierres pour le puits',
    auteur: 'Gaspard',
    description: 'La margelle du puits s’effrite. Il me faut de la pierre pour la refaire, et vite : un village qui se délabre attire les mauvaises gens.',
    objectif: { type: 'rapporter', objet: 'pierre', quantite: 10 },
    recompense: { xp: 50, objets: [{ objet: 'or', quantite: 5 }] },
  },
  {
    id: 'gobelins',
    chaine: 'gaspard',
    titre: 'Des traces suspectes',
    auteur: 'Gaspard',
    description: 'J’ai relevé des traces de gobelins près du village, et ils ne vont jamais loin sans quelqu’un derrière eux. Fais-leur passer l’envie de revenir.',
    objectif: { type: 'tuer', ennemi: 'gobelin', quantite: 3 },
    recompense: { xp: 80, objets: [{ objet: 'or', quantite: 15 }] },
  },
  {
    id: 'voyageurs-detrousses',
    chaine: 'gaspard',
    titre: 'Voyageurs détroussés',
    auteur: 'Gaspard',
    description: 'Deux colporteurs sont arrivés ici sans leurs marchandises, ni leurs bottes. Des bandits, sur la route. Retrouve-les et fais-les payer.',
    objectif: { type: 'tuer', ennemi: 'bandit', quantite: 2 },
    recompense: { xp: 110, objets: [{ objet: 'or', quantite: 20 }] },
  },
  {
    id: 'renforcer-village',
    chaine: 'gaspard',
    titre: 'Renforcer le village',
    auteur: 'Gaspard',
    description: 'Si les bandits viennent, je veux des palissades et des maisons solides. Apporte-moi du bois et de la pierre, et je t’autoriserai à agrandir le village.',
    objectif: { type: 'rapporter', objet: 'bois', quantite: 30, aussi: [{ objet: 'pierre', quantite: 20 }] },
    recompense: { xp: 150, objets: [{ objet: 'or', quantite: 20 }], debloqueVillage: 2 },
  },
  {
    id: 'le-guetteur',
    chaine: 'gaspard',
    titre: 'Le guetteur',
    auteur: 'Gaspard',
    description: 'Il nous faut un guetteur, armé de vrai fer, tout en haut de la colline. Quatre lingots de fer, et le village pourra encore grandir.',
    objectif: { type: 'rapporter', objet: 'lingot-fer', quantite: 4 },
    recompense: { xp: 220, objets: [{ objet: 'or', quantite: 30 }], debloqueVillage: 3 },
    conditions: { niveauVillage: 2 },
  },
  {
    id: 'pillards-organises',
    chaine: 'gaspard',
    titre: 'Les pillards s’organisent',
    auteur: 'Gaspard',
    description: 'Ils ne viennent plus en désordre : ils ont un camp, un chef, des ordres. Abats cinq de ces pillards, et nous saurons d’où ils viennent… Ce n’est que le début.',
    objectif: { type: 'tuer', ennemi: 'bandit', quantite: 5 },
    recompense: { xp: 300, objets: [{ objet: 'or', quantite: 50 }], pointsCompetence: 1 },
    conditions: { quete: 'armure-digne' },
  },

  // --- Relever le village : après l'attaque des bandits (étape d'histoire « Parle à Gaspard »), en personne ---
  {
    id: 'murs-hiver',
    chaine: 'relever',
    titre: 'Des murs avant l’hiver',
    auteur: 'Gaspard',
    description: 'Les toits de chaume sont partis en fumée et les murs de la maison de Mathilde ne tiendront pas l’hiver. Apporte-moi du bois et de la pierre : nous la rebâtissons.',
    objectif: { type: 'rapporter', objet: 'bois', quantite: 25, aussi: [{ objet: 'pierre', quantite: 15 }] },
    recompense: { xp: 150, objets: [{ objet: 'or', quantite: 15 }] },
    conditions: { etape: 'parler-gaspard-attaque' },
  },
  {
    id: 'ventre-batisseurs',
    chaine: 'relever',
    titre: 'Le ventre des bâtisseurs',
    auteur: 'Marthe',
    description: 'Ceux qui rebâtissent doivent manger, mon petit ! Cinq belles portions de viande cuite pour les ouvriers, et ils tiendront jusqu’au soir.',
    objectif: { type: 'rapporter', objet: 'viande-cuite', quantite: 5 },
    recompense: { xp: 120, objets: [{ objet: 'or', quantite: 10 }] },
  },
  {
    id: 'toit-chasseur',
    chaine: 'relever',
    titre: 'Un toit pour le chasseur',
    auteur: 'Hugo',
    description: 'Ma maison n’a plus de toit. Du bois, des fibres pour lier le chaume, de la pierre pour les bases : avec ça, je la relève.',
    objectif: { type: 'rapporter', objet: 'bois', quantite: 20, aussi: [{ objet: 'fibres', quantite: 12 }, { objet: 'pierre', quantite: 10 }] },
    recompense: { xp: 180, objets: [{ objet: 'or', quantite: 20 }] },
  },

  // --- Le forgeron : de la pierre à l'acier ---
  {
    id: 'premier-lingot',
    chaine: 'forgeron',
    titre: 'Le premier lingot',
    auteur: 'Le forgeron',
    description: 'Un bon forgeron commence par un bon lingot. Fonds du minerai de cuivre à la forge.',
    objectif: { type: 'fabriquer', recettes: ['lingot-cuivre'], quantite: 1 },
    recompense: { xp: 40, objets: [] },
  },
  {
    id: 'outils-cuivre',
    chaine: 'forgeron',
    titre: 'Outils de cuivre',
    auteur: 'Le forgeron',
    description: 'Le cuivre est tendre, mais c’est un début. Fais-toi une pioche en cuivre à l’établi.',
    objectif: { type: 'fabriquer', recettes: ['pioche-cuivre'], quantite: 1 },
    recompense: { xp: 60, objets: [{ objet: 'or', quantite: 5 }] },
  },
  {
    id: 'charbon-forge',
    chaine: 'forgeron',
    titre: 'Du charbon pour la forge',
    auteur: 'Le forgeron',
    description: 'Pas de fer sans feu, pas de feu sans charbon. Dix morceaux, et ne reviens pas les mains vides.',
    objectif: { type: 'rapporter', objet: 'charbon', quantite: 10 },
    recompense: { xp: 70, objets: [{ objet: 'or', quantite: 10 }] },
  },
  {
    id: 'vrai-forgeron',
    chaine: 'forgeron',
    titre: 'Un vrai forgeron',
    auteur: 'Le forgeron',
    description: 'Prouve ton talent : forge-toi une pioche en fer. Le métal ne ment pas.',
    objectif: { type: 'fabriquer', recettes: ['pioche-fer'], quantite: 1 },
    recompense: { xp: 100, objets: [{ objet: 'or', quantite: 15 }] },
  },
  {
    id: 'armure-digne',
    chaine: 'forgeron',
    titre: 'Une armure digne de ce nom',
    auteur: 'Le forgeron',
    description: 'Les bandits ne plaisantent pas, et toi non plus, j’espère. Une armure de mailles, forgée de tes mains.',
    objectif: { type: 'fabriquer', recettes: ['armure-mailles'], quantite: 1 },
    recompense: { xp: 150, objets: [{ objet: 'or', quantite: 20 }] },
  },
  {
    id: 'secret-acier',
    chaine: 'forgeron',
    titre: 'Le secret de l’acier',
    auteur: 'Le forgeron',
    description: 'L’acier, c’est du fer qu’on a appris à durcir. Mon vieil atelier ne suffit pas : reviens quand le village aura grandi, puis fonds-m’en trois lingots.',
    objectif: { type: 'fabriquer', recettes: ['lingot-acier'], quantite: 3 },
    recompense: { xp: 200, objets: [{ objet: 'or', quantite: 25 }] },
    conditions: { niveauVillage: 2 },
  },
  {
    id: 'lame-exception',
    chaine: 'forgeron',
    titre: 'Une lame d’exception',
    auteur: 'Le forgeron',
    description: 'Une épée d’acier, la meilleure lame que ces mains sachent faire. Elle ne se forge qu’après celles de cuivre et de fer : monte les marches une à une.',
    objectif: { type: 'fabriquer', recettes: ['epee-acier'], quantite: 1 },
    recompense: { xp: 300, objets: [{ objet: 'or', quantite: 40 }], pointsCompetence: 1 },
  },

  // --- Marthe, l'aubergiste : une auberge accueillante ---
  {
    id: 'bois-hiver',
    chaine: 'marthe',
    titre: "Du bois pour l'hiver",
    auteur: 'Marthe',
    description: "L'hiver approche et les réserves sont vides. Rapporte-moi du bois, s'il te plaît.",
    objectif: { type: 'rapporter', objet: 'bois', quantite: 15 },
    recompense: { xp: 40, objets: [{ objet: 'or', quantite: 5 }] },
  },
  {
    id: 'baies-tarte',
    chaine: 'marthe',
    titre: 'Des baies pour la tarte',
    auteur: 'Marthe',
    description: 'Ma tarte aux baies, tout le village en redemande ! Dix poignées, mon petit, les plus mûres que tu trouveras.',
    objectif: { type: 'rapporter', objet: 'baies', quantite: 10 },
    recompense: { xp: 50, objets: [{ objet: 'or', quantite: 5 }] },
  },
  {
    id: 'fourrures-hiver',
    chaine: 'marthe',
    titre: 'Fourrures pour l’hiver',
    auteur: 'Marthe',
    description: 'Mes pauvres voyageurs grelottent dans leurs chambres. Quatre belles fourrures de loup feront des couvertures, mais ne t’aventure pas avant que les gobelins soient chassés !',
    objectif: { type: 'rapporter', objet: 'fourrure', quantite: 4 },
    recompense: { xp: 80, objets: [{ objet: 'or', quantite: 10 }] },
    conditions: { quete: 'gobelins' },
  },
  {
    id: 'kits-voyageurs',
    chaine: 'marthe',
    titre: 'Un kit pour les voyageurs',
    auteur: 'Marthe',
    description: 'Depuis l’histoire des colporteurs, je ne laisse plus personne repartir sans de quoi allumer un feu. Fabrique-m’en deux kits de feu de camp.',
    objectif: { type: 'fabriquer', recettes: ['kit-feu-camp'], quantite: 2 },
    recompense: { xp: 100, objets: [{ objet: 'or', quantite: 15 }] },
    conditions: { quete: 'voyageurs-detrousses' },
  },
  {
    id: 'gibier',
    chaine: 'marthe',
    titre: 'Du gibier',
    auteur: 'Marthe',
    description: 'Mon garde-manger se vide plus vite que je ne le remplis. Rapporte-moi cinq belles pièces de viande crue : lapin, cerf ou sanglier, je ne fais pas la fine bouche.',
    objectif: { type: 'rapporter', objet: 'viande-crue', quantite: 5 },
    recompense: { xp: 110, objets: [{ objet: 'or', quantite: 15 }] },
  },
  {
    id: 'ragout-marthe',
    chaine: 'marthe',
    titre: 'Le ragoût de Marthe',
    auteur: 'Marthe',
    description: 'Un bon ragoût, il n’y a que ça de vrai ! Cuis-moi la viande au feu avec des plantes et des baies, trois marmites, et tu goûteras ma recette.',
    objectif: { type: 'fabriquer', recettes: ['ragout'], quantite: 3 },
    recompense: { xp: 130, objets: [{ objet: 'or', quantite: 20 }] },
  },
  {
    id: 'cuir-tanneur',
    chaine: 'marthe',
    titre: 'Le cuir du tanneur',
    auteur: 'Marthe',
    description: 'Le tanneur du village n’a plus une peau à travailler, et mes voyageurs veulent des ceintures. Six cuirs, et je te donne de quoi t’améliorer.',
    objectif: { type: 'rapporter', objet: 'cuir', quantite: 6 },
    recompense: { xp: 160, objets: [{ objet: 'or', quantite: 30 }], pointsCompetence: 1 },
  },

  // --- Mathilde, l'herboriste et ermite : les anciens savoirs ---
  {
    id: 'remedes',
    chaine: 'mathilde',
    titre: 'Remèdes de grand-mère',
    auteur: 'Mathilde',
    description: 'Mes tisanes manquent de plantes médicinales. Peux-tu en cueillir pour moi ?',
    objectif: { type: 'rapporter', objet: 'plante-medicinale', quantite: 5 },
    recompense: { xp: 50, objets: [{ objet: 'potion-soin', quantite: 1 }] },
  },
  {
    id: 'potager-soif',
    chaine: 'mathilde',
    titre: 'Un potager qui a soif',
    auteur: 'Mathilde',
    description: 'Ton potager est à l’abandon, voisin. Prends ce seau, remplis-le au puits de la place et arrose-le : la terre te le rendra.',
    objectif: { type: 'arroser', quantite: 1 },
    recompense: { xp: 60, objets: [{ objet: 'or', quantite: 5 }] },
    conditions: { etape: 'entrer-maison' },
    objetsOfferts: ['seau'],
  },
  {
    id: 'replanter',
    chaine: 'mathilde',
    titre: 'Replanter la forêt',
    auteur: 'Mathilde',
    description: 'Les arbres que nous coupons doivent repousser, la forêt se souvient de ceux qui la respectent. Plante des pousses (clic droit).',
    objectif: { type: 'planter', quantite: 3 },
    recompense: { xp: 60, objets: [{ objet: 'or', quantite: 5 }] },
  },
  {
    id: 'potions-village',
    chaine: 'mathilde',
    titre: 'Potions pour le village',
    auteur: 'Mathilde',
    description: 'Si des blessés arrivent, mes tisanes ne suffiront pas. Prépare trois potions de soin à l’établi : tu verras, c’est un art.',
    objectif: { type: 'fabriquer', recettes: ['potion-soin'], quantite: 3 },
    recompense: { xp: 80, objets: [{ objet: 'or', quantite: 10 }] },
  },
  {
    id: 'pierre-bleue',
    chaine: 'mathilde',
    titre: 'La pierre bleue',
    auteur: 'Mathilde',
    description: 'Dans la montagne dorment des cristaux bleus qui chantent, la nuit : la mine est {direction:mine} du village, à environ {distance:mine} pas. Rapporte-m’en cinq, avec une bonne pioche de fer pour les détacher.',
    objectif: { type: 'rapporter', objet: 'cristal-bleu', quantite: 5 },
    recompense: { xp: 120, objets: [{ objet: 'or', quantite: 10 }] },
    conditions: { quete: 'vrai-forgeron' },
  },
  {
    id: 'apprenti-mage',
    chaine: 'mathilde',
    titre: 'Apprenti mage',
    auteur: 'Mathilde',
    description: 'La magie s’apprend en la pratiquant. Lance dix sorts, de feu ou de soin, peu importe : laisse-la couler en toi.',
    objectif: { type: 'lancerSort', quantite: 10 },
    recompense: { xp: 140, objets: [{ objet: 'or', quantite: 10 }] },
  },
  {
    id: 'gelee-alchimique',
    chaine: 'mathilde',
    titre: 'Gelée alchimique',
    auteur: 'Mathilde',
    description: 'La gelée des slimes garde un peu de la magie des anciens. Dix pleines, pour mes alambics, et nous verrons ce qu’elle cache.',
    objectif: { type: 'rapporter', objet: 'gelee-slime', quantite: 10 },
    recompense: { xp: 200, objets: [{ objet: 'potion-soin', quantite: 2 }] },
  },
  {
    id: 'la-barriere',
    chaine: 'mathilde',
    titre: 'La barrière',
    auteur: 'Mathilde',
    description: 'Les bandits ne viennent pas que pour l’or : ils cherchent quelque chose, et je crois savoir quoi. Apprends le sort Barrière, il te protégera… Mais ce que je sais attendra la suite.',
    objectif: { type: 'apprendreNoeud', noeud: 'barriere' },
    recompense: { xp: 300, objets: [{ objet: 'or', quantite: 30 }], pointsCompetence: 1 },
  },
];

export function chercherQuete(id: string): DefinitionQuete | undefined {
  return QUETES.find((q) => q.id === id);
}

/** Les quêtes d'une chaîne, dans l'ordre. */
export function quetesDeChaine(id: IdChaine): DefinitionQuete[] {
  return QUETES.filter((q) => q.chaine === id);
}

/** Une quête acceptée et son compteur (utile aux objectifs d'événements ; 0 pour « rapporter »). */
export interface QueteEnCours {
  readonly id: string;
  readonly compteur: number;
}

export interface EtatQuetes {
  readonly enCours: readonly QueteEnCours[];
  readonly terminees: readonly string[];
}

export function creerEtatQuetes(): EtatQuetes {
  return { enCours: [], terminees: [] };
}

/** Ce que les conditions et l'objectif « apprendre un nœud » regardent : le village et les nœuds acquis. */
export interface ContexteQuetes {
  readonly niveauVillage: number;
  readonly noeuds: readonly string[];
  /**
   * Recettes d'équipement déjà possédées (outil de ce palier ou mieux, sacoche) : une quête « fabriquer »
   * de cet objet est remplie dès qu'on l'accepte, sinon elle serait impossible (« déjà possédé »).
   */
  readonly dejaPossedees?: readonly string[];
  /** Identifiants des étapes d'histoire terminées (voir `etapesTerminees` de histoire.ts) */
  readonly etapesTerminees?: readonly string[];
}

const CONTEXTE_DEFAUT: ContexteQuetes = { niveauVillage: 1, noeuds: [] };

export type StatutQuete = 'verrouillee' | 'proposee' | 'en-cours' | 'terminee';

/** Prochaine quête d'une chaîne : la première qui n'est pas terminée (acceptée ou non). */
export function queteSuivante(etat: EtatQuetes, chaine: IdChaine): DefinitionQuete | undefined {
  return quetesDeChaine(chaine).find((q) => !etat.terminees.includes(q.id));
}

/** Textes des conditions pas encore remplies (vide : la quête est disponible). */
export function conditionsManquantes(etat: EtatQuetes, quete: DefinitionQuete, ctx: ContexteQuetes = CONTEXTE_DEFAUT): string[] {
  const manque: string[] = [];
  const c = quete.conditions;
  if (c?.niveauVillage !== undefined && ctx.niveauVillage < c.niveauVillage) {
    manque.push(`Disponible quand le village sera niveau ${c.niveauVillage}`);
  }
  if (c?.quete !== undefined && !etat.terminees.includes(c.quete)) {
    const autre = chercherQuete(c.quete);
    manque.push(`Disponible après la quête « ${autre?.titre ?? c.quete} »${autre ? ` (${autre.auteur})` : ''}`);
  }
  if (c?.etape !== undefined && !(ctx.etapesTerminees ?? []).includes(c.etape)) {
    manque.push('Pas encore disponible');
  }
  return manque;
}

/** Quêtes visibles : la prochaine de chaque chaîne (au plus `proposeesMax`), conditions remplies ou non. */
export function quetesVisibles(etat: EtatQuetes): DefinitionQuete[] {
  const liste: DefinitionQuete[] = [];
  for (const c of CHAINES) {
    if (c.enPersonne) continue;
    const q = queteSuivante(etat, c.id);
    if (q) liste.push(q);
  }
  return liste.slice(0, CONFIG.quetes.proposeesMax);
}

/** Vrai si la quête est la prochaine de sa chaîne (chaîne « en personne »), ou l'une des quêtes proposées du panneau. */
function estVisible(etat: EtatQuetes, id: string): boolean {
  const quete = chercherQuete(id);
  if (!quete) return false;
  if (CHAINES.find((c) => c.id === quete.chaine)?.enPersonne) return queteSuivante(etat, quete.chaine)?.id === id;
  return quetesVisibles(etat).some((q) => q.id === id);
}

export function statutQuete(etat: EtatQuetes, id: string, ctx: ContexteQuetes = CONTEXTE_DEFAUT): StatutQuete {
  if (etat.terminees.includes(id)) return 'terminee';
  if (etat.enCours.some((q) => q.id === id)) return 'en-cours';
  const quete = chercherQuete(id);
  if (!quete || !estVisible(etat, id)) return 'verrouillee';
  return conditionsManquantes(etat, quete, ctx).length === 0 ? 'proposee' : 'verrouillee';
}

/** Quêtes acceptées, dans l'ordre des définitions. */
export function quetesEnCours(etat: EtatQuetes): DefinitionQuete[] {
  return QUETES.filter((q) => etat.enCours.some((c) => c.id === q.id));
}

export function quetesTerminees(etat: EtatQuetes): DefinitionQuete[] {
  return QUETES.filter((q) => etat.terminees.includes(q.id));
}

// --- Amélioration du village débloquée par les quêtes ----------------------------------------

/** Quête dont la récompense débloque le passage à ce niveau de village. */
export function queteDeblocageVillage(niveau: number): DefinitionQuete | undefined {
  return QUETES.find((q) => q.recompense.debloqueVillage === niveau);
}

/**
 * Plus haut niveau de village qu'on a le droit d'atteindre : 1 au départ, +1 par quête de déblocage terminée.
 * Un village déjà plus grand (ancienne sauvegarde) garde son niveau.
 */
export function niveauVillageDebloque(etat: EtatQuetes, niveauVillage = 1): number {
  let niveau = Math.max(1, niveauVillage);
  for (const q of quetesTerminees(etat)) niveau = Math.max(niveau, q.recompense.debloqueVillage ?? 1);
  return niveau;
}

// --- Objectifs --------------------------------------------------------------------------------

/** Tous les objets demandés par un objectif « rapporter » (l'objet principal d'abord). */
export function objetsDemandes(o: Extract<ObjectifQuete, { type: 'rapporter' }>): ObjetDemande[] {
  return [{ objet: o.objet, quantite: o.quantite }, ...(o.aussi ?? [])];
}

/** Quantité à atteindre pour l'objectif (somme des objets pour « rapporter », 1 pour un nœud). */
export function quantiteObjectif(o: ObjectifQuete): number {
  if (o.type === 'apprendreNoeud') return 1;
  if (o.type === 'rapporter') return objetsDemandes(o).reduce((total, d) => total + d.quantite, 0);
  return o.quantite;
}

/** Ce que les quêtes lisent chez le joueur. */
export interface PossessionQuetes {
  readonly inventaire: Conteneur;
  readonly coffre: Conteneur;
}

export interface ProgressionQuete {
  readonly actuel: number;
  readonly requis: number;
  readonly prete: boolean;
}

/** Avancement d'une quête acceptée (pour une quête « rapporter » : ce qu'on possède, plafonné à ce qui est demandé). */
export function progressionQuete(
  etat: EtatQuetes,
  quete: DefinitionQuete,
  possession: PossessionQuetes,
  ctx: ContexteQuetes = CONTEXTE_DEFAUT,
): ProgressionQuete {
  const o = quete.objectif;
  const requis = quantiteObjectif(o);
  const compteur = etat.enCours.find((c) => c.id === quete.id)?.compteur ?? 0;
  let actuel: number;
  if (o.type === 'rapporter') {
    actuel = objetsDemandes(o).reduce(
      (total, d) => total + Math.min(d.quantite, compter(possession.inventaire, d.objet) + compter(possession.coffre, d.objet)),
      0,
    );
  } else if (o.type === 'apprendreNoeud') {
    actuel = ctx.noeuds.includes(o.noeud) ? 1 : compteur;
  } else {
    actuel = compteur;
  }
  actuel = Math.min(actuel, requis);
  return { actuel, requis, prete: actuel >= requis };
}

/** Ce qu'on compte, pour « 9/15 bois » : nom des objets, ennemis, etc. */
export function uniteObjectif(o: ObjectifQuete, nomObjet: (id: string) => string): string {
  switch (o.type) {
    case 'rapporter':
      return objetsDemandes(o)
        .map((d) => nomObjet(d.objet))
        .join(' + ');
    case 'tuer':
      return o.quantite > 1 ? `${o.ennemi}s` : o.ennemi;
    case 'fabriquer':
      return o.quantite > 1 ? 'fabriqués' : 'fabriqué';
    case 'planter':
      return o.quantite > 1 ? 'pousses plantées' : 'pousse plantée';
    case 'detruire':
      return 'détruits';
    case 'lancerSort':
      return o.quantite > 1 ? 'sorts lancés' : 'sort lancé';
    case 'apprendreNoeud':
      return `nœud à apprendre (${chercherNoeud(o.noeud)?.nom ?? o.noeud})`;
    case 'arroser':
      return 'potager arrosé';
  }
}

export type RaisonRefusQuete = 'inconnue' | 'indisponible' | 'deja-acceptee' | 'pas-acceptee' | 'incomplete' | 'inventaire-plein';

export const MESSAGES_QUETES: Readonly<Record<RaisonRefusQuete, string>> = {
  inconnue: 'Quête inconnue',
  indisponible: "Cette quête n'est pas disponible",
  'deja-acceptee': 'Quête déjà acceptée',
  'pas-acceptee': "Quête pas encore acceptée",
  incomplete: "Il manque encore quelque chose",
  'inventaire-plein': 'Inventaire plein : la récompense ne rentre pas',
};

export type ResultatAcceptation =
  | { ok: true; etat: EtatQuetes; message: string }
  | { ok: false; raison: RaisonRefusQuete; etat: EtatQuetes; message: string };

/** Accepte une quête proposée. Une quête aux conditions non remplies est refusée avec le texte de ce qui manque. */
export function accepter(etat: EtatQuetes, id: string, ctx: ContexteQuetes = CONTEXTE_DEFAUT): ResultatAcceptation {
  const refus = (raison: RaisonRefusQuete, message = MESSAGES_QUETES[raison]): ResultatAcceptation => ({ ok: false, raison, etat, message });
  const quete = chercherQuete(id);
  if (!quete) return refus('inconnue');
  const statut = statutQuete(etat, id, ctx);
  if (statut === 'en-cours') return refus('deja-acceptee');
  if (statut !== 'proposee') {
    const manque = estVisible(etat, id) ? conditionsManquantes(etat, quete, ctx) : [];
    return refus('indisponible', manque.length > 0 ? manque.join(' ; ') : undefined);
  }
  const o = quete.objectif;
  const dejaFait = o.type === 'fabriquer' && o.recettes.some((r) => ctx.dejaPossedees?.includes(r));
  const compteur = dejaFait ? o.quantite : 0;
  return { ok: true, etat: { ...etat, enCours: [...etat.enCours, { id, compteur }] }, message: `Quête acceptée : ${quete.titre}` };
}

// --- Événements du jeu ------------------------------------------------------------------------

export type EvenementQuete =
  | { readonly type: 'elementDetruit'; readonly element: string }
  | { readonly type: 'ennemiTue'; readonly ennemi: string }
  /** Animal sauvage tué (cerf, lapin, renard, sanglier) : ne compte pas comme un ennemi */
  | { readonly type: 'animalTue'; readonly animal: string }
  | { readonly type: 'objetFabrique'; readonly recette: string }
  | { readonly type: 'pousseePlantee' }
  | { readonly type: 'sortLance' }
  | { readonly type: 'noeudAcquis'; readonly noeud: string }
  /** Le potager de la maison vient d'être arrosé */
  | { readonly type: 'potagerArrose' };

function compte(o: ObjectifQuete, ev: EvenementQuete): boolean {
  switch (ev.type) {
    case 'elementDetruit':
      return o.type === 'detruire' && o.elements.includes(ev.element);
    case 'ennemiTue':
      return o.type === 'tuer' && o.ennemi === ev.ennemi;
    case 'animalTue':
      // Aucune quête de chasse pour l'instant : l'événement est prêt pour la suite
      return false;
    case 'objetFabrique':
      return o.type === 'fabriquer' && o.recettes.includes(ev.recette);
    case 'pousseePlantee':
      return o.type === 'planter';
    case 'sortLance':
      return o.type === 'lancerSort';
    case 'noeudAcquis':
      return o.type === 'apprendreNoeud' && o.noeud === ev.noeud;
    case 'potagerArrose':
      return o.type === 'arroser';
  }
}

/** Fait avancer les quêtes acceptées que l'événement concerne (le compteur ne dépasse pas l'objectif). */
export function evenement(etat: EtatQuetes, ev: EvenementQuete): EtatQuetes {
  let change = false;
  const enCours = etat.enCours.map((c) => {
    const q = chercherQuete(c.id);
    if (!q || !compte(q.objectif, ev) || c.compteur >= quantiteObjectif(q.objectif)) return c;
    change = true;
    return { ...c, compteur: c.compteur + 1 };
  });
  return change ? { ...etat, enCours } : etat;
}

// --- Rendu et récompenses ---------------------------------------------------------------------

export interface ContenantsQuetes {
  readonly inventaire: Conteneur;
  readonly coffre: Conteneur;
  readonly sac: Conteneur;
}

export type ResultatRendu =
  | { ok: true; etat: EtatQuetes; contenants: ContenantsQuetes; xp: number; pointsCompetence: number; message: string }
  | { ok: false; raison: RaisonRefusQuete; etat: EtatQuetes; contenants: ContenantsQuetes; xp: 0; pointsCompetence: 0; message: string };

/**
 * Rend une quête prête : prend les objets demandés (inventaire porté, puis coffre), donne les objets de la
 * récompense (inventaire porté, puis sac magique) et renvoie l'XP et les points de compétence à donner.
 * Refus : rien n'est modifié, y compris si la récompense ne rentre pas.
 */
export function rendre(etat: EtatQuetes, id: string, contenants: ContenantsQuetes, ctx: ContexteQuetes = CONTEXTE_DEFAUT): ResultatRendu {
  const refus = (raison: RaisonRefusQuete): ResultatRendu => ({
    ok: false,
    raison,
    etat,
    contenants,
    xp: 0,
    pointsCompetence: 0,
    message: MESSAGES_QUETES[raison],
  });
  const quete = chercherQuete(id);
  if (!quete) return refus('inconnue');
  const statut = statutQuete(etat, id, ctx);
  if (statut !== 'en-cours') return refus(statut === 'proposee' ? 'pas-acceptee' : 'indisponible');
  if (!progressionQuete(etat, quete, contenants, ctx).prete) return refus('incomplete');

  let { inventaire, coffre, sac } = contenants;
  if (quete.objectif.type === 'rapporter') {
    for (const d of objetsDemandes(quete.objectif)) ({ inventaire, coffre } = consommer(inventaire, coffre, d));
  }
  for (const r of quete.recompense.objets) {
    const porte = ajouter(inventaire, r.objet, r.quantite);
    const range = ajouter(sac, r.objet, porte.reste);
    if (range.reste > 0) return refus('inventaire-plein');
    inventaire = porte.conteneur;
    sac = range.conteneur;
  }
  const niveau = quete.recompense.debloqueVillage;
  return {
    ok: true,
    etat: { enCours: etat.enCours.filter((c) => c.id !== id), terminees: [...etat.terminees, id] },
    contenants: { inventaire, coffre, sac },
    xp: quete.recompense.xp,
    pointsCompetence: quete.recompense.pointsCompetence ?? 0,
    message: `Quête terminée : ${quete.titre}${niveau ? `. Le village peut passer au niveau ${niveau}` : ''}`,
  };
}
