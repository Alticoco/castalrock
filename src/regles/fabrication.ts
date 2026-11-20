// Fabrication : recettes de l'établi et de la forge, vérification des ingrédients, consommation et effets.
// Pur : aucun import de three, aucun Math.random(). Tout est immuable.
// Les ingrédients sont pris dans l'inventaire porté, puis dans le coffre du village.
// Le résultat va dans l'inventaire porté ; s'il n'y a pas de place, rien n'est consommé.

import { CONFIG } from '../config';
import { chercherNoeud, type IdNoeud } from './competences';
import {
  TYPES_BOUCLIER,
  equiperBouclier,
  equiperOutil,
  niveauPrecedent,
  rangNiveau,
  type Equipement,
  type NiveauOutil,
  type TypeBouclier,
} from './equipement';
import { ETAPES_HISTOIRE, type EtatHistoire } from './histoire';
import { ajouter, compter, retirer, type Conteneur } from './inventaire';
import type { OutilRecolte } from './recolte';

export type LieuFabrication = 'etabli' | 'forge' | 'feu';

export const NOMS_LIEUX: Readonly<Record<LieuFabrication, string>> = {
  etabli: 'Établi',
  forge: 'Forge',
  feu: 'Cuisine au feu',
};

export interface Ingredient {
  readonly objet: string;
  readonly quantite: number;
}

/** Ce que produit une recette : un objet dans l'inventaire, un outil d'un palier équipé, ou la sacoche. */
export type ResultatRecette =
  | { readonly type: 'objet'; readonly objet: string; readonly quantite: number }
  | { readonly type: 'outil'; readonly outil: OutilRecolte; readonly niveau: NiveauOutil }
  | { readonly type: 'bouclier'; readonly bouclier: TypeBouclier }
  | { readonly type: 'arc' }
  | { readonly type: 'sacoche' };

export interface Recette {
  readonly id: string;
  readonly nom: string;
  readonly lieu: LieuFabrication;
  /** Courte description affichée sous le nom */
  readonly description: string;
  /** Clé de l'icône dessinée par l'écran (objet du catalogue ou outil d'un palier) */
  readonly icone: string;
  readonly ingredients: readonly Ingredient[];
  readonly resultat: ResultatRecette;
  /** Niveau du village nécessaire (1 si absent) */
  readonly niveauVillageMin?: number;
  /** Nœud de l'arbre de compétences nécessaire (aucun si absent) */
  readonly noeudRequis?: IdNoeud;
  /** Étape d'histoire à avoir terminée (identifiant dans `ETAPES_HISTOIRE`) ; aucune si absent */
  readonly etapeHistoireRequise?: string;
}

const pctParade = (bonus: number) => Math.round(Math.min(1, CONFIG.progression.arbre.parade + bonus) * 100);

const NOMS_OUTIL: Readonly<Record<OutilRecolte, string>> = { hache: 'Hache', pioche: 'Pioche', epee: 'Épée' };
const NOMS_PALIER: Readonly<Record<NiveauOutil, string>> = {
  base: 'en bois',
  cuivre: 'en cuivre',
  fer: 'en fer',
  acier: 'en acier',
  cristal: 'en cristal',
};
const DESCRIPTIONS_OUTIL: Readonly<Record<OutilRecolte, string>> = {
  hache: 'Coupe les arbres plus vite',
  pioche: 'Casse rochers et filons plus vite',
  epee: 'Une lame plus mordante',
};

/** Recette d'un outil d'un palier : lingot du palier + bois (épée : 3 lingots, 1 bois ; hache et pioche : 2 et 2). Cristal : + 4 cristaux bleus, après l'étape `cristaux-aldric`. */
function recetteOutil(outil: OutilRecolte, niveau: 'cuivre' | 'fer' | 'acier' | 'cristal', lingot: string): Recette {
  const facteur = CONFIG.fabrication.paliers[niveau].degats;
  return {
    id: `${outil}-${niveau}`,
    nom: `${NOMS_OUTIL[outil]} ${NOMS_PALIER[niveau]}`,
    lieu: niveau === 'cuivre' ? 'etabli' : 'forge',
    description: `${DESCRIPTIONS_OUTIL[outil]} (×${String(facteur).replace('.', ',')}, équipée tout de suite)`,
    icone: `${outil}-${niveau}`,
    ingredients: [
      ...(outil === 'epee'
        ? [{ objet: lingot, quantite: 3 }, { objet: 'bois', quantite: 1 }]
        : [{ objet: lingot, quantite: 2 }, { objet: 'bois', quantite: 2 }]),
      ...(niveau === 'cristal' ? [{ objet: 'cristal-bleu', quantite: 4 }] : []),
    ],
    resultat: { type: 'outil', outil, niveau },
    ...(niveau === 'acier' || niveau === 'cristal' ? { niveauVillageMin: CONFIG.fabrication.villageAcier } : {}),
    ...(niveau === 'cristal' ? { etapeHistoireRequise: 'cristaux-aldric' } : {}),
  };
}

export const RECETTES: readonly Recette[] = [
  {
    id: 'armure-fibres',
    nom: 'Armure de fibres',
    lieu: 'etabli',
    description: 'Défense légère : −15 % de dégâts',
    icone: 'armure-fibres',
    ingredients: [
      { objet: 'fibres', quantite: 10 },
      { objet: 'bois', quantite: 4 },
    ],
    resultat: { type: 'objet', objet: 'armure-fibres', quantite: 1 },
  },
  {
    id: 'armure-cuir',
    nom: 'Armure de cuir',
    lieu: 'etabli',
    description: 'Souple et solide : −25 % de dégâts',
    icone: 'armure-cuir',
    ingredients: [
      { objet: 'cuir', quantite: 6 },
      { objet: 'fibres', quantite: 4 },
    ],
    resultat: { type: 'objet', objet: 'armure-cuir', quantite: 1 },
  },
  {
    id: 'armure-fourrure',
    nom: 'Armure de fourrure',
    lieu: 'etabli',
    description: 'Chaude et épaisse : −30 % de dégâts',
    icone: 'armure-fourrure',
    ingredients: [
      { objet: 'fourrure', quantite: 4 },
      { objet: 'cuir', quantite: 2 },
    ],
    resultat: { type: 'objet', objet: 'armure-fourrure', quantite: 1 },
  },
  {
    id: 'casque-cuir',
    nom: 'Bonnet de cuir',
    lieu: 'etabli',
    description: 'Bonnet de cuir à oreillettes : −4 % de dégâts',
    icone: 'casque-cuir',
    ingredients: [
      { objet: 'cuir', quantite: 3 },
      { objet: 'fibres', quantite: 2 },
    ],
    resultat: { type: 'objet', objet: 'casque-cuir', quantite: 1 },
  },
  {
    id: 'casque-fourrure',
    nom: 'Chapka de fourrure',
    lieu: 'etabli',
    description: 'Chapka au bord de fourrure : −6 % de dégâts',
    icone: 'casque-fourrure',
    ingredients: [
      { objet: 'fourrure', quantite: 2 },
      { objet: 'cuir', quantite: 1 },
    ],
    resultat: { type: 'objet', objet: 'casque-fourrure', quantite: 1 },
  },
  {
    id: 'potion-soin',
    nom: 'Potion de soin',
    lieu: 'etabli',
    description: 'Rend de la vie (utilisée au combat)',
    icone: 'potion-soin',
    ingredients: [
      { objet: 'plante-medicinale', quantite: 3 },
      { objet: 'baies', quantite: 2 },
    ],
    resultat: { type: 'objet', objet: 'potion-soin', quantite: 1 },
  },
  {
    id: 'kit-feu-camp',
    nom: 'Kit de feu de camp',
    lieu: 'etabli',
    description: "À poser avec G ; on s'y repose et on y cuisine avec E",
    icone: 'kit-feu-camp',
    ingredients: [
      { objet: 'bois', quantite: 5 },
      { objet: 'pierre', quantite: 3 },
    ],
    resultat: { type: 'objet', objet: 'kit-feu-camp', quantite: 1 },
  },
  {
    id: 'piege',
    nom: 'Piège',
    lieu: 'etabli',
    description: 'Se pose avec la case 6 en prairie ou en forêt : attrape un lapin, parfois un renard',
    icone: 'piege',
    ingredients: [
      { objet: 'bois', quantite: 3 },
      { objet: 'fibres', quantite: 6 },
    ],
    resultat: { type: 'objet', objet: 'piege', quantite: 1 },
  },
  {
    id: 'sacoche',
    nom: 'Sacoche en fibres',
    lieu: 'etabli',
    description: `+${CONFIG.fabrication.casesSacoche} cases d'inventaire (une seule fois)`,
    icone: 'sacoche',
    ingredients: [
      { objet: 'fibres', quantite: 8 },
      { objet: 'bois', quantite: 2 },
    ],
    resultat: { type: 'sacoche' },
  },
  {
    id: 'arc',
    nom: 'Arc',
    lieu: 'etabli',
    description: 'Pour chasser de loin : case 4, clic maintenu pour tendre (équipé tout de suite)',
    icone: 'arc',
    ingredients: [
      { objet: 'bois', quantite: 6 },
      { objet: 'fibres', quantite: 4 },
    ],
    resultat: { type: 'arc' },
    noeudRequis: 'tir-a-l-arc',
  },
  {
    id: 'fleches',
    nom: `Flèches ×${CONFIG.arc.flechesParRecette}`,
    lieu: 'etabli',
    description: "Munitions de l'arc : une flèche par tir",
    icone: 'fleche',
    ingredients: [
      { objet: 'bois', quantite: 3 },
      { objet: 'pierre', quantite: 2 },
      { objet: 'fibres', quantite: 2 },
    ],
    resultat: { type: 'objet', objet: 'fleche', quantite: CONFIG.arc.flechesParRecette },
  },
  {
    id: 'bouclier-bois',
    nom: 'Bouclier en bois',
    lieu: 'etabli',
    description: `Clic droit avec l'épée : −${pctParade(0)} % de dégâts de face (équipé tout de suite)`,
    icone: 'bouclier-bois',
    ingredients: [
      { objet: 'bois', quantite: 8 },
      { objet: 'fibres', quantite: 4 },
    ],
    resultat: { type: 'bouclier', bouclier: 'bois' },
    noeudRequis: 'parade',
  },
  // Cuisine : au feu de camp (posé ou de la place) et à la cheminée de la maison
  {
    id: 'viande-cuite',
    nom: 'Viande cuite',
    lieu: 'feu',
    description: `Rend ${CONFIG.cuisine.aliments['viande-cuite'].soin} PV, puis ${CONFIG.cuisine.aliments['viande-cuite'].regenParSeconde} PV/s pendant ${CONFIG.cuisine.aliments['viande-cuite'].regenDuree} s`,
    icone: 'viande-cuite',
    ingredients: [{ objet: 'viande-crue', quantite: 1 }],
    resultat: { type: 'objet', objet: 'viande-cuite', quantite: 1 },
  },
  {
    id: 'ragout',
    nom: 'Ragoût',
    lieu: 'feu',
    description: `Rend ${CONFIG.cuisine.aliments.ragout.soin} PV, puis ${CONFIG.cuisine.aliments.ragout.regenParSeconde} PV/s pendant ${CONFIG.cuisine.aliments.ragout.regenDuree} s`,
    icone: 'ragout',
    ingredients: [
      { objet: 'viande-cuite', quantite: 2 },
      { objet: 'plante-medicinale', quantite: 1 },
      { objet: 'baies', quantite: 2 },
    ],
    resultat: { type: 'objet', objet: 'ragout', quantite: 1 },
  },
  // Outils en cuivre : à l'établi, avec des lingots de cuivre
  recetteOutil('hache', 'cuivre', 'lingot-cuivre'),
  recetteOutil('pioche', 'cuivre', 'lingot-cuivre'),
  recetteOutil('epee', 'cuivre', 'lingot-cuivre'),
  // Forge : lingots, outils en fer et en acier, armures de métal
  {
    id: 'lingot-cuivre',
    nom: 'Lingot de cuivre',
    lieu: 'forge',
    description: 'Du minerai de cuivre fondu',
    icone: 'lingot-cuivre',
    ingredients: [{ objet: 'minerai-cuivre', quantite: 2 }],
    resultat: { type: 'objet', objet: 'lingot-cuivre', quantite: 1 },
  },
  {
    id: 'lingot-fer',
    nom: 'Lingot de fer',
    lieu: 'forge',
    description: 'Du minerai fondu avec du charbon, pour les outils',
    icone: 'lingot-fer',
    ingredients: [
      { objet: 'minerai-fer', quantite: 2 },
      { objet: 'charbon', quantite: 1 },
    ],
    resultat: { type: 'objet', objet: 'lingot-fer', quantite: 1 },
  },
  {
    id: 'lingot-acier',
    nom: "Lingot d'acier",
    lieu: 'forge',
    description: 'Du fer durci au charbon (village niveau 2)',
    icone: 'lingot-acier',
    ingredients: [
      { objet: 'lingot-fer', quantite: 2 },
      { objet: 'charbon', quantite: 2 },
    ],
    resultat: { type: 'objet', objet: 'lingot-acier', quantite: 1 },
    niveauVillageMin: CONFIG.fabrication.villageAcier,
  },
  recetteOutil('hache', 'fer', 'lingot-fer'),
  recetteOutil('pioche', 'fer', 'lingot-fer'),
  recetteOutil('epee', 'fer', 'lingot-fer'),
  recetteOutil('hache', 'acier', 'lingot-acier'),
  recetteOutil('pioche', 'acier', 'lingot-acier'),
  recetteOutil('epee', 'acier', 'lingot-acier'),
  recetteOutil('hache', 'cristal', 'lingot-acier'),
  recetteOutil('pioche', 'cristal', 'lingot-acier'),
  recetteOutil('epee', 'cristal', 'lingot-acier'),
  {
    id: 'armure-mailles',
    nom: 'Armure de mailles',
    lieu: 'forge',
    description: 'Mailles de fer : −40 % de dégâts',
    icone: 'armure-mailles',
    ingredients: [{ objet: 'lingot-fer', quantite: 6 }],
    resultat: { type: 'objet', objet: 'armure-mailles', quantite: 1 },
  },
  {
    id: 'armure-plaques',
    nom: 'Armure de plaques',
    lieu: 'forge',
    description: 'Plaques d\'acier : −55 % de dégâts (village niveau 2)',
    icone: 'armure-plaques',
    ingredients: [{ objet: 'lingot-acier', quantite: 6 }],
    resultat: { type: 'objet', objet: 'armure-plaques', quantite: 1 },
    niveauVillageMin: CONFIG.fabrication.villageAcier,
  },
  {
    id: 'casque-mailles',
    nom: 'Camail de mailles',
    lieu: 'forge',
    description: 'Camail de mailles de fer : −8 % de dégâts',
    icone: 'casque-mailles',
    ingredients: [
      { objet: 'lingot-fer', quantite: 3 },
    ],
    resultat: { type: 'objet', objet: 'casque-mailles', quantite: 1 },
  },
  {
    id: 'casque-plaques',
    nom: "Heaume d'acier",
    lieu: 'forge',
    description: "Heaume d'acier à visière : −10 % de dégâts (village niveau 2)",
    icone: 'casque-plaques',
    ingredients: [
      { objet: 'lingot-acier', quantite: 3 },
    ],
    resultat: { type: 'objet', objet: 'casque-plaques', quantite: 1 },
    niveauVillageMin: CONFIG.fabrication.villageAcier,
  },
  {
    id: 'bouclier-renforce',
    nom: 'Bouclier renforcé',
    lieu: 'forge',
    description: `Bois plaqué de fer : −${pctParade(CONFIG.bouclier.bonusRenforce)} % de dégâts de face (équipé tout de suite)`,
    icone: 'bouclier-renforce',
    ingredients: [
      { objet: 'bois', quantite: 6 },
      { objet: 'lingot-fer', quantite: 3 },
    ],
    resultat: { type: 'bouclier', bouclier: 'renforce' },
    noeudRequis: 'parade',
  },
];

/** Ce que la fabrication lit et modifie. */
export interface EtatFabrication {
  readonly inventaire: Conteneur;
  readonly coffre: Conteneur;
  readonly equipement: Equipement;
  /** Facteur sur le coût des réparations (compétence Artisanat) ; 1 si absent */
  readonly facteurCoutReparation?: number;
  /** Niveau du village (conditions de recette) ; 1 si absent */
  readonly niveauVillage?: number;
  /** Nœuds de l'arbre de compétences acquis (conditions de recette) ; aucun si absent */
  readonly noeuds?: readonly string[];
  /** Avancement de l'histoire (conditions de recette) ; rien de terminé si absent */
  readonly histoire?: EtatHistoire;
}

export type RaisonRefusFabrication =
  | 'inconnue'
  | 'ingredients'
  | 'inventaire-plein'
  | 'deja-possede'
  | 'village-insuffisant'
  | 'competence-manquante'
  | 'palier-precedent'
  | 'histoire-manquante';

export const MESSAGES_FABRICATION: Readonly<Record<RaisonRefusFabrication, string>> = {
  inconnue: 'Recette inconnue',
  ingredients: 'Il manque des ingrédients',
  'inventaire-plein': 'Inventaire plein',
  'deja-possede': 'Déjà possédé',
  'village-insuffisant': 'Le village doit être plus grand',
  'competence-manquante': 'Il manque une compétence',
  'palier-precedent': "Il faut d'abord l'outil du palier précédent",
  'histoire-manquante': "Aldric doit d'abord t'apprendre ce que sont les cristaux bleus",
};

/** Message d'un refus pour une recette précise (précise le niveau de village ou l'outil manquant). */
export function messageRefus(recette: Recette | undefined, raison: RaisonRefusFabrication): string {
  if (recette && raison === 'village-insuffisant') return `Il faut le village niveau ${recette.niveauVillageMin ?? 1}`;
  if (recette?.noeudRequis && raison === 'competence-manquante') {
    return `Il faut la compétence ${chercherNoeud(recette.noeudRequis)?.nom ?? recette.noeudRequis}`;
  }
  if (recette && raison === 'palier-precedent' && recette.resultat.type === 'outil') {
    const { outil, niveau } = recette.resultat;
    const avant = niveauPrecedent(niveau);
    if (avant) return `Il faut d'abord une ${NOMS_OUTIL[outil].toLowerCase()} ${NOMS_PALIER[avant]}`;
  }
  return MESSAGES_FABRICATION[raison];
}

export function recettesDuLieu(lieu: LieuFabrication): readonly Recette[] {
  return RECETTES.filter((r) => r.lieu === lieu);
}

export function chercherRecette(id: string): Recette | undefined {
  return RECETTES.find((r) => r.id === id);
}

/** Quantité d'un objet disponible pour fabriquer : inventaire porté + coffre du village. */
export function quantitePossedee(etat: EtatFabrication, objet: string): number {
  return compter(etat.inventaire, objet) + compter(etat.coffre, objet);
}

function manqueIngredient(etat: EtatFabrication, recette: Recette): boolean {
  return recette.ingredients.some((i) => quantitePossedee(etat, i.objet) < i.quantite);
}

/** Vrai si le résultat de la recette est déjà possédé (sacoche, outil déjà de ce palier ou d'un palier supérieur). */
export function dejaPossede(etat: EtatFabrication, recette: Recette): boolean {
  const r = recette.resultat;
  if (r.type === 'sacoche') return etat.equipement.sacoche;
  if (r.type === 'outil') return rangNiveau(etat.equipement.outils[r.outil]) >= rangNiveau(r.niveau);
  if (r.type === 'arc') return etat.equipement.arc;
  if (r.type === 'bouclier') {
    const possede = etat.equipement.bouclier;
    return possede !== null && TYPES_BOUCLIER.indexOf(possede) >= TYPES_BOUCLIER.indexOf(r.bouclier);
  }
  return false;
}

/** Vrai si l'étape d'histoire requise n'est pas terminée (rang courant supérieur au sien). */
function histoireManquante(etat: EtatFabrication, recette: Recette): boolean {
  if (!recette.etapeHistoireRequise) return false;
  const rang = ETAPES_HISTOIRE.findIndex((e) => e.id === recette.etapeHistoireRequise);
  return rang < 0 || (etat.histoire?.etape ?? 0) <= rang;
}

/** Vrai si l'outil possédé n'est pas celui du palier juste avant : on ne saute pas de palier. */
function palierPrecedentManquant(etat: EtatFabrication, recette: Recette): boolean {
  const r = recette.resultat;
  if (r.type !== 'outil') return false;
  const avant = niveauPrecedent(r.niveau);
  return avant !== null && rangNiveau(etat.equipement.outils[r.outil]) < rangNiveau(avant);
}

/** Raison pour laquelle la recette est impossible avant même d'essayer, ou `null`. (« Inventaire plein » ne se voit qu'en fabriquant.) */
export function raisonImpossible(etat: EtatFabrication, recette: Recette): RaisonRefusFabrication | null {
  if (dejaPossede(etat, recette)) return 'deja-possede';
  if ((etat.niveauVillage ?? 1) < (recette.niveauVillageMin ?? 1)) return 'village-insuffisant';
  if (recette.noeudRequis && !(etat.noeuds ?? []).includes(recette.noeudRequis)) return 'competence-manquante';
  if (histoireManquante(etat, recette)) return 'histoire-manquante';
  if (palierPrecedentManquant(etat, recette)) return 'palier-precedent';
  if (manqueIngredient(etat, recette)) return 'ingredients';
  return null;
}

export type ResultatFabrication =
  | { ok: true; etat: EtatFabrication; message: string }
  | { ok: false; raison: RaisonRefusFabrication; etat: EtatFabrication; message: string };

function refus(etat: EtatFabrication, raison: RaisonRefusFabrication, recette?: Recette): ResultatFabrication {
  return { ok: false, raison, etat, message: messageRefus(recette, raison) };
}

/** Retire un ingrédient : d'abord l'inventaire porté, puis le coffre. */
export function consommer(inventaire: Conteneur, coffre: Conteneur, ingredient: Ingredient) {
  const dansInventaire = retirer(inventaire, ingredient.objet, ingredient.quantite);
  const dansCoffre = retirer(coffre, ingredient.objet, ingredient.quantite - dansInventaire.retire);
  return { inventaire: dansInventaire.conteneur, coffre: dansCoffre.conteneur };
}

/** Économe : chance de ne pas consommer chaque ingrédient de base, avec un tirage dans [0, 1[ (générateur à graine). */
export interface BonusEconome {
  readonly chance: number;
  readonly tirage: () => number;
}

/** Fabrique une recette. En cas de refus, l'état renvoyé est celui reçu : rien n'est consommé. */
export function fabriquer(etat: EtatFabrication, idRecette: string, econome?: BonusEconome): ResultatFabrication {
  const recette = chercherRecette(idRecette);
  if (!recette) return refus(etat, 'inconnue');
  const raison = raisonImpossible(etat, recette);
  if (raison) return refus(etat, raison, recette);

  let inventaire = etat.inventaire;
  let coffre = etat.coffre;
  for (const ingredient of recette.ingredients) {
    // Économe : un ingrédient de base (bois, pierre, fibres) peut être épargné
    if (econome && econome.chance > 0 && CONFIG.progression.ingredientsDeBase.includes(ingredient.objet) && econome.tirage() < econome.chance) continue;
    ({ inventaire, coffre } = consommer(inventaire, coffre, ingredient));
  }

  let equipement = etat.equipement;
  const res = recette.resultat;
  if (res.type === 'objet') {
    // Les ingrédients consommés ont pu libérer des cases : on teste après consommation
    const ajout = ajouter(inventaire, res.objet, res.quantite);
    if (ajout.reste > 0) return refus(etat, 'inventaire-plein', recette);
    inventaire = ajout.conteneur;
  } else if (res.type === 'outil') {
    equipement = equiperOutil(equipement, res.outil, res.niveau);
  } else if (res.type === 'bouclier') {
    equipement = equiperBouclier(equipement, res.bouclier);
  } else if (res.type === 'arc') {
    equipement = { ...equipement, arc: true };
  } else {
    inventaire = { cases: [...inventaire.cases, ...Array.from({ length: CONFIG.fabrication.casesSacoche }, () => null)] };
    equipement = { ...equipement, sacoche: true };
  }
  return { ok: true, etat: { ...etat, inventaire, coffre, equipement }, message: `Fabriqué : ${recette.nom}` };
}
