// Mots-clés colorés dans les textes de quêtes : ressources en ambre, ennemis en rouge, lieux en bleu, personnages en vert.
// Le dictionnaire est construit à partir des données du jeu (habitants, ressources, ennemis, lieux, quêtes).
// Partie pure, sans DOM : testée dans motsCles.test.ts.

import { NOMS_HABITANTS } from '../regles/habitants';
import { NOMS_LIEUX } from '../regles/lieux';
import { NOMS_RESSOURCES } from '../regles/recolte';
import { definitionObjet } from '../regles/inventaire';
import { TYPES_ENNEMI } from '../regles/combat';
import { QUETES, objetsDemandes } from '../regles/quetes';
import { echapper, motCle, type TypeMotCle } from './theme';

/** Mots que les données ne donnent pas toutes seules : singuliers, métaux, chefs, lieux du village. */
const SUPPLEMENTS: ReadonlyArray<readonly [string, TypeMotCle]> = [
  ['cristal bleu', 'ressource'],
  ["pousse d'arbre", 'ressource'],
  ['plante médicinale', 'ressource'],
  ['fibre', 'ressource'],
  ['baie', 'ressource'],
  ['cuivre', 'ressource'],
  ['fer', 'ressource'],
  ['acier', 'ressource'],
  ['gelée de slime', 'ressource'],
  ["pièces d'or", 'ressource'],
  ['cuir', 'ressource'],
  ['fourrure', 'ressource'],
  ['Morvan', 'ennemi'],
  ['Morvan le Balafré', 'ennemi'],
  ['Village', 'lieu'],
  ['Mine', 'lieu'],
  ['Forge', 'lieu'],
  ['Auberge', 'lieu'],
  ['Castalrock', 'lieu'],
  ['camp du Balafré', 'lieu'],
  ['Le forgeron', 'personnage'],
];

/** Tous les mots-clés connus avec leur type, sans doublon (la casse est ignorée à la recherche). */
export function dictionnaireMotsCles(): Map<string, TypeMotCle> {
  const mots = new Map<string, TypeMotCle>();
  const ajouter = (mot: string, type: TypeMotCle) => {
    const cle = mot.toLocaleLowerCase('fr');
    if (cle.length >= 2 && !mots.has(cle)) mots.set(cle, type);
  };
  for (const nom of Object.values(NOMS_HABITANTS)) ajouter(nom, 'personnage');
  for (const nom of Object.values(NOMS_LIEUX)) ajouter(nom, 'lieu');
  for (const nom of Object.values(NOMS_RESSOURCES)) ajouter(nom, 'ressource');
  for (const type of TYPES_ENNEMI) ajouter(type, 'ennemi');
  // Les objets que demandent ou donnent les quêtes
  for (const q of QUETES) {
    if (q.objectif.type === 'rapporter') for (const d of objetsDemandes(q.objectif)) ajouter(definitionObjet(d.objet).nom, 'ressource');
    for (const o of q.recompense.objets) ajouter(definitionObjet(o.objet).nom, 'ressource');
  }
  for (const [mot, type] of SUPPLEMENTS) ajouter(mot, type);
  return mots;
}

function echapperRegex(texte: string): string {
  return texte.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/['’]/g, "['’]");
}

let motif: RegExp | null = null;
let types: Map<string, TypeMotCle> | null = null;

/** Expression qui reconnaît un mot connu entier (pluriel simple accepté), le plus long d'abord. */
function preparer(): { motif: RegExp; types: Map<string, TypeMotCle> } {
  if (!motif || !types) {
    types = dictionnaireMotsCles();
    const mots = [...types.keys()].sort((a, b) => b.length - a.length).map(echapperRegex);
    const lettre = String.raw`[\p{L}\p{N}]`;
    motif = new RegExp(`(?<!${lettre})(${mots.join('|')})(?:s|x)?(?!${lettre})`, 'giu');
  }
  return { motif, types };
}

/** Type d'un mot-clé exact (sans pluriel), ou `undefined`. Sert aux tests. */
export function typeDuMot(mot: string): TypeMotCle | undefined {
  return preparer().types.get(mot.toLocaleLowerCase('fr'));
}

/** Texte échappé en HTML où les noms connus sont colorés et en gras (« Cueillir des baies » → baies en ambre). */
export function colorerMotsCles(texte: string): string {
  const { motif: re, types: dico } = preparer();
  re.lastIndex = 0;
  let html = '';
  let reste = 0;
  for (const m of texte.matchAll(re)) {
    const debut = m.index ?? 0;
    const type = dico.get(m[1].toLocaleLowerCase('fr').replace(/’/g, "'"));
    html += echapper(texte.slice(reste, debut));
    html += type ? motCle(m[0], type) : echapper(m[0]);
    reste = debut + m[0].length;
  }
  return html + echapper(texte.slice(reste));
}
