// Arbre de compétences : les nœuds (nom, parent, effet), leur état et leurs effets cumulés.
// Pur : aucun import de three, aucun Math.random(). Valeurs dans CONFIG.progression.arbre.
// Un point par niveau ; chaque nœud coûte `cout` point(s) et demande son parent (ou l'un de ses parents).
// L'achat et la progression sont dans progression.ts ; ce fichier ne connaît que la liste des nœuds acquis.

import { CONFIG } from '../config';

const A = CONFIG.progression.arbre;

export const BRANCHES = ['combat', 'defense', 'recolte', 'artisanat', 'magie', 'chasse'] as const;
export type Branche = (typeof BRANCHES)[number];

export const NOMS_BRANCHES: Readonly<Record<Branche, string>> = {
  combat: 'Combat',
  defense: 'Défense',
  recolte: 'Récolte',
  artisanat: 'Artisanat',
  magie: 'Magie',
  chasse: 'Chasse',
};

export type IdNoeud =
  | 'lame-affutee'
  | 'enchainement'
  | 'riposte'
  | 'coup-puissant'
  | 'robustesse'
  | 'parade'
  | 'bouclier-solide'
  | 'peau-dure'
  | 'second-souffle'
  | 'bucheron'
  | 'mineur'
  | 'abondance'
  | 'pilote-expert'
  | 'cueilleur'
  | 'forgeron'
  | 'econome'
  | 'maitre-forgeron'
  | 'porteur'
  | 'grand-sac'
  | 'boule-de-feu'
  | 'soin'
  | 'barriere'
  | 'reserve'
  | 'boule-de-feu-ii'
  | 'tir-a-l-arc'
  | 'tir-charge'
  | 'pisteur'
  | 'depeceur';

export interface Noeud {
  readonly id: IdNoeud;
  readonly nom: string;
  readonly branche: Branche;
  /** Prérequis : il suffit d'en avoir UN d'acquis (liste vide = nœud de départ de la branche) */
  readonly parents: readonly IdNoeud[];
  readonly cout: number;
  /** Ce que fait le nœud, en une phrase */
  readonly description: string;
  /** L'effet chiffré, court */
  readonly effet: string;
  /** Place dans la colonne de la branche : rangée (0 = haut) et colonne (0 à 2, demi-valeurs permises). Sert à l'écran. */
  readonly ligne: number;
  readonly colonne: number;
}

const pct = (x: number) => `${Math.round(x * 100)} %`;

function noeud(
  id: IdNoeud,
  nom: string,
  branche: Branche,
  parents: readonly IdNoeud[],
  place: readonly [ligne: number, colonne: number],
  effet: string,
  description: string,
): Noeud {
  return {
    id,
    nom,
    branche,
    parents,
    cout: 1,
    description,
    effet,
    ligne: place[0],
    colonne: place[1],
  };
}

export const NOEUDS: readonly Noeud[] = [
  // Combat
  noeud('lame-affutee', 'Lame affûtée', 'combat', [], [0, 1], `+${pct(A.lameAffutee)} de dégâts à l'épée`, "Une lame bien aiguisée frappe plus fort."),
  noeud('enchainement', 'Enchaînement', 'combat', ['lame-affutee'], [1, 0], `Frappes ${pct(A.enchainement)} plus rapides`, 'Les coups s\'enchaînent plus vite.'),
  noeud(
    'riposte',
    'Riposte',
    'combat',
    ['enchainement'],
    [2, 0],
    `Coup suivant ×${A.riposte.facteur} après une parade`,
    `Après une parade réussie, le coup suivant fait ×${A.riposte.facteur}.`,
  ),
  noeud(
    'coup-puissant',
    'Coup puissant',
    'combat',
    ['lame-affutee'],
    [1, 2],
    `Clic maintenu ${A.coupPuissant.duree} s : coup ×${A.coupPuissant.facteur}`,
    `Clic maintenu ${A.coupPuissant.duree} s, puis un coup à ×${A.coupPuissant.facteur}.`,
  ),
  // Défense
  noeud('robustesse', 'Robustesse', 'defense', [], [0, 1], `+${A.robustesse} PV max`, 'Un corps plus résistant : plus de points de vie.'),
  noeud(
    'parade',
    'Parade',
    'defense',
    ['robustesse'],
    [1, 0],
    'Bouclier : clic droit maintenu',
    'Débloque le bouclier (clic droit maintenu avec l\'épée).',
  ),
  noeud(
    'bouclier-solide',
    'Bouclier solide',
    'defense',
    ['parade'],
    [2, 0],
    'Bloque 100 % des coups de face',
    'La parade bloque 100 % des dégâts reçus de face.',
  ),
  noeud('peau-dure', 'Peau dure', 'defense', ['robustesse'], [1, 2], `+${pct(A.peauDure)} de réduction des dégâts`, "Une peau plus coriace : l'armure protège davantage."),
  noeud(
    'second-souffle',
    'Second souffle',
    'defense',
    ['peau-dure'],
    [2, 2],
    'Survit à 1 PV, une fois par jour',
    'Une fois par jour de jeu, un coup mortel vous laisse à 1 PV.',
  ),
  // Récolte
  noeud('bucheron', 'Bûcheron', 'recolte', [], [0, 0], `+${pct(A.bucheron)} de dégâts sur les arbres`, 'Les arbres tombent plus vite.'),
  noeud('mineur', 'Mineur', 'recolte', [], [0, 1], `+${pct(A.mineur)} de dégâts sur rochers et filons`, 'Les rochers et les filons cèdent plus vite.'),
  noeud(
    'abondance',
    'Abondance',
    'recolte',
    ['bucheron', 'mineur'],
    [1, 0.5],
    `${pct(A.abondance)} de chance d'une ressource en plus`,
    'Chaque arbre, rocher ou filon a une chance de donner une ressource de plus (demande Bûcheron ou Mineur).',
  ),
  noeud('pilote-expert', 'Pilote expert', 'recolte', ['abondance'], [2, 0.5], 'Le pilote travaille à pleine vitesse', 'Le pilote automatique marche et frappe aussi vite que vous.'),
  noeud('cueilleur', 'Cueilleur', 'recolte', [], [0, 2], `+${A.cueilleur} baie ou plante par cueillette`, 'Chaque cueillette de baies ou de plantes donne un peu plus.'),
  // Artisanat
  noeud('forgeron', 'Forgeron', 'artisanat', [], [0, 0.5], `Réparations à ${pct(A.forgeron)} du prix`, 'Les réparations à la forge coûtent moitié moins.'),
  noeud('econome', 'Économe', 'artisanat', ['forgeron'], [1, 0], `${pct(A.econome)} de chance d'économiser un ingrédient`, 'Chaque ingrédient de base (bois, pierre, fibres) a une chance de ne pas être consommé.'),
  noeud(
    'maitre-forgeron',
    'Maître forgeron',
    'artisanat',
    ['forgeron'],
    [1, 1],
    `+${pct(A.maitreForgeron)} de durabilité`,
    'Outils et armures fabriqués plus durables : durabilité maximale en hausse.',
  ),
  noeud('porteur', 'Porteur', 'artisanat', [], [0, 2], `+${A.porteur} cases d'inventaire`, "Plus de place dans l'inventaire porté."),
  noeud('grand-sac', 'Grand sac', 'artisanat', ['porteur'], [1, 2], `+${A.grandSac} cases dans le sac magique`, 'Plus de place dans le sac magique.'),
  // Magie
  noeud('boule-de-feu', 'Boule de feu', 'magie', [], [0, 1], 'Sort A', 'Lance une boule de feu (touche A).'),
  noeud('soin', 'Soin', 'magie', ['boule-de-feu'], [1, 0], 'Sort X', 'Rend des points de vie (touche X).'),
  noeud(
    'barriere',
    'Barrière',
    'magie',
    ['soin'],
    [2, 0],
    `Sort C : absorbe ${A.barriere.absorbe} dégâts, ${A.barriere.duree} s`,
    `Bouclier magique (touche C) qui absorbe ${A.barriere.absorbe} dégâts pendant ${A.barriere.duree} s.`,
  ),
  noeud('reserve', 'Réserve', 'magie', ['barriere'], [3, 0], `+${A.reserve} mana max`, 'Une réserve de mana plus grande.'),
  noeud('boule-de-feu-ii', 'Boule de feu II', 'magie', ['boule-de-feu'], [1, 2], `Explosion ${pct(A.bouleDeFeuII - 1)} plus large`, "L'explosion de la boule de feu touche plus large."),
  // Chasse (lot 2b)
  noeud('tir-a-l-arc', "Tir à l'arc", 'chasse', [], [0, 0.5], "Débloque l'arc (case 4)", "Permet de fabriquer un arc à l'établi : clic maintenu pour tendre, relâcher pour tirer."),
  noeud(
    'tir-charge',
    'Tir chargé',
    'chasse',
    ['tir-a-l-arc'],
    [1, 0],
    `Flèche à pleine tension ×${A.tirCharge.degats}`,
    `Une flèche tirée à pleine tension fait ×${A.tirCharge.degats} dégâts et va plus loin.`,
  ),
  noeud('pisteur', 'Pisteur', 'chasse', ['tir-a-l-arc'], [1, 1], 'Animaux sur la mini-carte', `Les animaux à moins de ${A.pisteur} m se voient sur la mini-carte.`),
  noeud('depeceur', 'Dépeceur', 'chasse', [], [0, 2], `+${A.depeceur} viande ou cuir par animal`, 'Chaque animal tué donne un peu plus de viande (ou de cuir, à défaut).'),
];

export const NOEUDS_PAR_ID: ReadonlyMap<string, Noeud> = new Map(NOEUDS.map((n) => [n.id, n]));

export function chercherNoeud(id: string): Noeud | undefined {
  return NOEUDS_PAR_ID.get(id);
}

export function noeudsDeLaBranche(branche: Branche): readonly Noeud[] {
  return NOEUDS.filter((n) => n.branche === branche);
}

/** Tout ce qui a une liste de nœuds acquis. */
export interface AvecNoeuds {
  readonly noeuds: readonly string[];
}

/** Vrai si le nœud est acquis (étape 33 : bouclier, parade, riposte...). */
export function aLeNoeud(p: AvecNoeuds, id: IdNoeud): boolean {
  return p.noeuds.includes(id);
}

export type EtatNoeud = 'acquis' | 'disponible' | 'verrouille';

/** Acquis ; disponible (son prérequis est acquis, il reste à le payer) ; ou verrouillé. */
export function etatNoeud(noeuds: readonly string[], id: IdNoeud): EtatNoeud {
  if (noeuds.includes(id)) return 'acquis';
  const n = NOEUDS_PAR_ID.get(id);
  if (!n) return 'verrouille';
  return n.parents.length === 0 || n.parents.some((p) => noeuds.includes(p)) ? 'disponible' : 'verrouille';
}

/** Effets cumulés d'une liste de nœuds acquis (les valeurs neutres si rien n'est acquis). */
export interface EffetsArbre {
  /** + part de dégâts à l'épée (0,15 = +15 %) */
  degatsEpee: number;
  /** + part de vitesse de frappe */
  vitesseFrappe: number;
  pvMax: number;
  /** Points de réduction ajoutés à celle de l'armure (0,10 = 10 %) */
  reductionArmure: number;
  secondSouffle: boolean;
  degatsArbres: number;
  degatsRochers: number;
  /** Baies ou plantes en plus par cueillette */
  cueillette: number;
  /** Chance d'une ressource en plus (0 à 1) */
  abondance: number;
  piloteExpert: boolean;
  /** Facteur sur le coût des réparations (1 = plein tarif) */
  coutReparation: number;
  /** Chance de ne pas consommer un ingrédient de base */
  econome: number;
  /** Facteur sur la durabilité maximale (1 = normale) */
  durabilite: number;
  casesInventaire: number;
  casesSac: number;
  manaMax: number;
  /** Facteur sur le rayon de l'explosion de la boule de feu */
  rayonExplosion: number;
}

export function effetsArbre(noeuds: readonly string[]): EffetsArbre {
  const a = (id: IdNoeud) => noeuds.includes(id);
  return {
    degatsEpee: a('lame-affutee') ? A.lameAffutee : 0,
    vitesseFrappe: a('enchainement') ? A.enchainement : 0,
    pvMax: a('robustesse') ? A.robustesse : 0,
    reductionArmure: a('peau-dure') ? A.peauDure : 0,
    secondSouffle: a('second-souffle'),
    degatsArbres: a('bucheron') ? A.bucheron : 0,
    degatsRochers: a('mineur') ? A.mineur : 0,
    cueillette: a('cueilleur') ? A.cueilleur : 0,
    abondance: a('abondance') ? A.abondance : 0,
    piloteExpert: a('pilote-expert'),
    coutReparation: a('forgeron') ? A.forgeron : 1,
    econome: a('econome') ? A.econome : 0,
    durabilite: a('maitre-forgeron') ? 1 + A.maitreForgeron : 1,
    casesInventaire: a('porteur') ? A.porteur : 0,
    casesSac: a('grand-sac') ? A.grandSac : 0,
    manaMax: a('reserve') ? A.reserve : 0,
    rayonExplosion: a('boule-de-feu-ii') ? A.bouleDeFeuII : 1,
  };
}
