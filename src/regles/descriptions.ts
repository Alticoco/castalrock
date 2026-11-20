// Textes de l'écran d'inventaire : une courte description par objet et le classement des onglets.
// Données de texte, pur : aucun import de three. C'est de l'affichage, aucune règle de jeu.

/** Phrase pour un objet qui n'a pas (encore) de description. */
export const DESCRIPTION_PAR_DEFAUT = 'Un objet étrange. Son usage reste à découvrir.';

/** Une phrase simple et utile par objet du catalogue (`src/regles/inventaire.ts`). */
const DESCRIPTIONS: Readonly<Record<string, string>> = {
  bois: 'Des bûches fraîchement coupées. Sert à bâtir, à fabriquer et à faire du feu.',
  'pousse-arbre': 'À replanter : un arbre repoussera à cet endroit.',
  pierre: 'Une pierre solide, utile pour le puits et les murs du village.',
  'minerai-cuivre': 'À fondre à la forge pour obtenir des lingots de cuivre.',
  'minerai-fer': 'Plus rare que le cuivre. Il faut du charbon pour le fondre.',
  charbon: 'Brûle longtemps et très chaud. Indispensable pour le fer et l’acier.',
  'cristal-bleu': 'Un cristal qui luit faiblement. On dit qu’il garde un peu de magie.',
  baies: 'Sucrées et juteuses. Se mangent telles quelles ou en tarte.',
  'plante-medicinale': 'Une herbe aux vertus apaisantes, base des potions de soin.',
  fibres: 'Des fibres solides. Elles servent à tresser une armure légère.',
  'lingot-cuivre': 'Prêt à être forgé en outils de cuivre.',
  'lingot-fer': 'Un métal résistant, pour des outils et des armures plus solides.',
  'lingot-acier': 'Le meilleur métal du village. Il demande un village bien développé.',
  'armure-fibres': 'Une armure légère de fibres tressées. Protège un peu des coups.',
  'armure-cuir': 'Une armure de cuir souple. Un bon début contre les bandits.',
  'armure-fourrure': 'Chaude et épaisse, elle encaisse mieux les coups.',
  'armure-mailles': 'Des anneaux de métal entrelacés. Solide et assez légère.',
  'armure-plaques': 'La meilleure protection : de lourdes plaques d’acier.',
  'casque-cuir': 'Un bonnet de cuir à oreillettes. Amortit un peu les coups à la tête.',
  'casque-fourrure': 'Une chapka au bord de fourrure : chaude, et elle protège bien.',
  'casque-mailles': 'Un camail de mailles qui retombe sur les épaules.',
  'casque-plaques': 'Un heaume d’acier à fente de visière. La meilleure protection pour la tête.',
  'potion-soin': 'Rend une bonne part de ta vie d’un coup. Se boit avec la touche R.',
  'kit-feu-camp': 'De quoi allumer un feu de camp (touche G) pour cuisiner et se reposer.',
  seau: 'Un seau de bois vide. Remplis-le au puits de la place (E), puis arrose ton potager.',
  'seau-eau': 'Un seau plein d’eau fraîche. Verse-le sur le potager de ta maison (E).',
  piege: 'À poser au sol : il attrape un lapin ou un renard après quelque temps.',
  'viande-cuite': 'Bien cuite au feu de camp. Rend de la vie et la régénère un moment.',
  ragout: 'Un plat chaud et copieux. Rend beaucoup de vie et la régénère longtemps.',
  'bouclier-bois': 'Un bouclier en planches. Lève-le avec le clic droit, l’épée en main.',
  'bouclier-renforce': 'Un bouclier cerclé de métal, qui encaisse bien plus de coups.',
  arc: 'Clic maintenu pour tendre, relâcher pour tirer. Il faut des flèches.',
  fleche: 'Des flèches pour l’arc. À fabriquer à l’établi.',
  'gelee-slime': 'Une gelée collante laissée par un slime. Étonnamment utile.',
  or: 'Des pièces d’or. Le marchand les accepte volontiers.',
  fourrure: 'Une fourrure épaisse de loup. Sert à l’armure de fourrure.',
  cuir: 'Du cuir tanné, laissé par les bandits et les animaux.',
  'viande-crue': 'À cuire au feu de camp avant de la manger.',
  'fourrure-renard': 'Une fourrure rousse et douce. Le marchand la reprend à bon prix.',
  'eclat-coeur': 'Un éclat du Cœur de Castal, arraché à Morvan. Il sert à reforger le Cœur.',
};

/** Description d'un objet (phrase par défaut si l'objet est inconnu). */
export function descriptionObjet(objet: string): string {
  return DESCRIPTIONS[objet] ?? DESCRIPTION_PAR_DEFAUT;
}

/** Description des emplacements de la barre d'outils (outils qui ne sont pas des objets d'inventaire). */
const DESCRIPTIONS_EMPLACEMENTS: Readonly<Record<string, string>> = {
  epee: 'Pour te battre. Un meilleur métal frappe plus fort, mais l’épée s’use.',
  hache: 'Pour couper les arbres. Une hache d’un meilleur métal va plus vite.',
  pioche: 'Pour casser les rochers et les filons. Il faut parfois un palier précis.',
  pousse: 'À planter pour faire repousser un arbre.',
  torche: 'Éclaire autour de toi la nuit et dans la mine.',
};

/** Description d'un emplacement de la barre ou de l'équipement (`epee`, `hache`, `pioche`, `pousse`, `torche`, `arc`, `piege`). */
export function descriptionEmplacement(emplacement: string): string {
  return DESCRIPTIONS_EMPLACEMENTS[emplacement] ?? descriptionObjet(emplacement);
}

export type OngletInventaire = 'tout' | 'ressources' | 'nourriture' | 'objets';

/** Onglets dans l'ordre d'affichage, avec leur nom. */
export const ONGLETS: ReadonlyArray<{ readonly id: OngletInventaire; readonly nom: string }> = [
  { id: 'tout', nom: 'Tout' },
  { id: 'ressources', nom: 'Ressources' },
  { id: 'nourriture', nom: 'Nourriture' },
  { id: 'objets', nom: 'Objets' },
];

/** Ce qui se mange ou se boit. */
const NOURRITURE: ReadonlySet<string> = new Set(['baies', 'viande-crue', 'viande-cuite', 'ragout', 'potion-soin']);

/** Matières premières (récoltées, butin, lingots). Tout le reste, y compris un objet inconnu, va dans « Objets ». */
const RESSOURCES: ReadonlySet<string> = new Set([
  'bois', 'pousse-arbre', 'pierre', 'minerai-cuivre', 'minerai-fer', 'charbon', 'cristal-bleu', 'plante-medicinale', 'fibres',
  'lingot-cuivre', 'lingot-fer', 'lingot-acier', 'gelee-slime', 'or', 'fourrure', 'cuir', 'fourrure-renard',
]);

/** Onglet dans lequel un objet est classé (hors « Tout », qui les contient tous). */
export function classementObjet(objet: string): Exclude<OngletInventaire, 'tout'> {
  if (NOURRITURE.has(objet)) return 'nourriture';
  if (RESSOURCES.has(objet)) return 'ressources';
  return 'objets';
}

/** Vrai si l'objet est visible (pas estompé) dans l'onglet donné. */
export function dansOnglet(objet: string, onglet: OngletInventaire): boolean {
  return onglet === 'tout' || classementObjet(objet) === onglet;
}
