// Thème commun de l'interface : style « Ardoise et laiton » (maquette validée le 19/11/2026).
// Panneaux sombres transparents, filet doré, accent bleu cristal, coins arrondis (25 à 30 px), boutons ronds.
// Titres en Cinzel, texte en Alegreya Sans (polices copiées dans public/polices/, licence OFL).
//
// Deux façons de s'en servir :
// - en TypeScript, les constantes `T` (couleurs, rayons, polices) et les morceaux de style (`PANNEAU`, `ETIQUETTE`…)
//   à coller dans un `style.cssText` ;
// - en CSS, les variables `--ath-…` et les animations installées une fois dans la page par `installerTheme()`.
// Changer une valeur ici change tout l'écran d'un coup. Aucune règle de jeu dans ce fichier.

/** Couleurs, rayons, ombres et polices de l'interface. */
export const T = {
  // Fonds
  /** Panneau transparent (boussole, barre d'outils, menus discrets) */
  fond: 'rgba(20,24,30,0.58)',
  /** Panneau léger (quêtes, en-têtes : on voit le décor à travers) */
  fondLeger: 'rgba(20,24,30,0.45)',
  /** Panneau plein (écrans d'inventaire, carte, fiches) */
  fondFort: 'rgba(16,19,24,0.88)',
  /** Fond d'une case (outil, objet) */
  fondCase: 'rgba(12,15,20,0.55)',
  /** Voile posé sur le jeu derrière un écran plein */
  voile: 'rgba(8,10,14,0.5)',
  /** Fond d'une jauge vide */
  fondJauge: 'rgba(14,16,20,0.55)',

  // Filets
  /** Filet doré des panneaux */
  filet: 'rgba(214,182,110,0.55)',
  /** Filet doré plus discret des cases */
  filetCase: 'rgba(214,182,110,0.33)',

  // Textes
  texte: '#F4ECDD',
  doux: '#D3C9B7',
  or: '#D9B871',
  /** Accent bleu cristal (case choisie, sac magique, repère suivi) */
  accent: '#7CCBF4',
  /** Texte sombre posé sur un aplat doré ou bleu */
  encre: '#0E1A24',

  // Mots-clés colorés dans les textes
  ressource: '#F5BE5E',
  ennemi: '#F2806F',
  lieu: '#82CDF5',
  personnage: '#96D98E',

  // Jauges
  vie: '#D9574B',
  mana: '#3F8FD6',
  xp: '#D9B871',
  xpGain: '#FFF0B8',
  usureBonne: '#8FD18B',
  usureMoyenne: '#F5BE5E',
  usureMauvaise: '#F2806F',

  // Formes
  /** Coins des panneaux (25 à 30 px) */
  rayonPanneau: '25px',
  /** Coins des grands écrans (inventaire, fiches) */
  rayonGrand: '30px',
  /** Coins des cases d'objets et d'outils */
  rayonCase: '12px',
  /** Petits éléments : touches, onglets, bulles */
  rayonPetit: '10px',
  /** Bouton rond */
  rayonRond: '50%',

  /** Ombre des panneaux : liseré doré intérieur très léger + ombre portée douce */
  ombre: 'inset 0 0 0 4px rgba(214,182,110,0.12), 0 8px 24px rgba(0,0,0,0.28)',
  /** Ombre des grands écrans */
  ombreForte: 'inset 0 0 0 4px rgba(214,182,110,0.14), 0 12px 36px rgba(0,0,0,0.35)',
  /** Ombre portée du texte posé directement sur le décor */
  ombreTexte: '0 1px 3px rgba(0,0,0,0.75)',
  /** Flou du décor derrière les panneaux transparents */
  flou: 'blur(6px)',

  // Polices
  titre: "'Cinzel', Georgia, serif",
  corps: "'Alegreya Sans', 'Segoe UI', system-ui, sans-serif",
} as const;

/** Types de mots-clés colorés dans les textes de quêtes et de dialogues. */
export type TypeMotCle = 'ressource' | 'ennemi' | 'lieu' | 'personnage';

// ---- Morceaux de style à coller dans un `cssText` ----

/** Panneau transparent avec filet doré, flou derrière et coins arrondis. */
export const PANNEAU =
  `background:${T.fond};border:1px solid ${T.filet};border-radius:${T.rayonPanneau};` +
  `box-shadow:${T.ombre};backdrop-filter:${T.flou};-webkit-backdrop-filter:${T.flou};box-sizing:border-box;`;

/** Grand panneau plein (écrans qui couvrent le jeu). */
export const PANNEAU_FORT =
  `background:${T.fondFort};border:1px solid ${T.filet};border-radius:${T.rayonGrand};` +
  `box-shadow:${T.ombreForte};box-sizing:border-box;`;

/** Petite étiquette dorée en capitales espacées (« QUÊTE PRINCIPALE »). */
export const ETIQUETTE = `font-family:${T.corps};font-size:11px;letter-spacing:0.16em;font-weight:700;color:${T.or};text-transform:uppercase;`;

/** Titre en Cinzel. */
export const TITRE = `font-family:${T.titre};font-weight:600;color:${T.texte};`;

/** Texte courant. */
export const CORPS = `font-family:${T.corps};color:${T.texte};`;

/** Texte posé directement sur le décor (blanc avec ombre). */
export const SUR_DECOR = `color:#FFFFFF;text-shadow:${T.ombreTexte};`;

/** Case d'objet ou d'outil. */
export const CASE =
  `position:relative;box-sizing:border-box;background:${T.fondCase};border:1px solid ${T.filetCase};border-radius:${T.rayonCase};`;

/** Bouton rond (zoom, recentrer…). */
export const BOUTON_ROND =
  `width:44px;height:44px;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer;` +
  `font-family:${T.corps};font-size:22px;font-weight:700;color:${T.texte};background:${T.fondCase};` +
  `border:1px solid ${T.filetCase};border-radius:30px;`;

/** Touche du clavier dessinée (« Tab », « K »). */
export const TOUCHE =
  `display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:20px;box-sizing:border-box;padding:0 5px;` +
  `font-family:${T.corps};font-size:11px;font-weight:700;color:${T.texte};background:${T.fondFort};` +
  `border:1px solid ${T.filet};border-radius:6px;text-shadow:none;`;

// ---- Écrans centrés (pause, quêtes, fabrication, marchand…) ----

/** Voile plein écran posé sur le jeu (flou + assombri) qui centre un panneau. Caché au départ : le module passe `display` à `flex`. */
export const VOILE_ECRAN =
  `position:absolute;inset:0;display:none;align-items:center;justify-content:center;pointer-events:auto;z-index:20;user-select:none;` +
  `font-family:${T.corps};color:${T.texte};background:${T.voile};backdrop-filter:${T.flou};-webkit-backdrop-filter:${T.flou};`;

/** Panneau d'un écran centré : colonne, grand panneau ardoise, défilement si l'écran est trop petit. */
export const PANNEAU_ECRAN =
  `${PANNEAU_FORT}display:flex;flex-direction:column;gap:12px;padding:24px 28px;max-height:92vh;overflow:auto;` +
  `font-family:${T.corps};color:${T.texte};`;

/** Titre d'un écran (Cinzel, doré) et titre de section (Cinzel plus petit). */
export const TITRE_ECRAN = `font-family:${T.titre};font-weight:700;font-size:22px;letter-spacing:0.04em;color:${T.or};`;
export const TITRE_SECTION = `font-family:${T.titre};font-weight:600;font-size:16px;letter-spacing:0.04em;color:${T.texte};`;

/** Séparateur : filet doré fin au-dessus d'un bloc. */
export const SEPARATEUR_HAUT = `border-top:1px solid ${T.filetCase};padding-top:10px;`;

/** Ligne de liste (recette, quête, article) : fond de case sombre, filet doré discret. */
export const LIGNE =
  `display:flex;align-items:center;gap:14px;padding:10px 14px;box-sizing:border-box;border-radius:${T.rayonCase};` +
  `background:${T.fondCase};border:1px solid ${T.filetCase};`;

const BOUTON_BASE =
  `flex:none;box-sizing:border-box;padding:8px 18px;border-radius:999px;font-family:${T.corps};font-size:15px;font-weight:700;line-height:1.2;`;

/** Bouton principal : aplat doré (actif) ou éteint (inactif, curseur interdit). */
export function styleBoutonPrincipal(actif = true): string {
  return actif
    ? `${BOUTON_BASE}background:${T.or};color:${T.encre};border:1px solid ${T.or};cursor:pointer;`
    : `${BOUTON_BASE}background:${T.fondCase};color:${T.doux};border:1px solid ${T.filetCase};opacity:0.55;cursor:not-allowed;`;
}

/** Bouton secondaire : fond sombre, filet doré, texte clair. */
export function styleBoutonSecondaire(): string {
  return `${BOUTON_BASE}background:${T.fondCase};color:${T.texte};border:1px solid ${T.filet};cursor:pointer;`;
}

/** Bouton d'un choix (distance de vue, taille…) : le choix actif est cerclé de bleu cristal. */
export function styleBoutonChoix(actif: boolean): string {
  return (
    `flex:1;box-sizing:border-box;padding:6px 10px;border-radius:999px;font-family:${T.corps};font-size:14px;cursor:pointer;` +
    (actif
      ? `background:rgba(124,203,244,0.18);color:${T.accent};border:1px solid ${T.accent};font-weight:700;`
      : `background:${T.fondCase};color:${T.doux};border:1px solid ${T.filetCase};font-weight:500;`)
  );
}

/** Onglet : l'actif est un aplat doré. */
export function styleOnglet(actif: boolean): string {
  return (
    `box-sizing:border-box;padding:6px 18px;border-radius:999px;font-family:${T.corps};font-size:15px;font-weight:700;cursor:pointer;` +
    (actif ? `background:${T.or};color:${T.encre};border:1px solid ${T.or};` : `background:transparent;color:${T.doux};border:1px solid ${T.filetCase};`)
  );
}

/** Couleur d'un message de résultat : vert pour une réussite, rouge pour un refus. */
export function couleurMessage(ok: boolean): string {
  return ok ? T.usureBonne : T.ennemi;
}

/** Curseur (input range) du thème : piste dorée fine, poignée ronde. Le style est dans la classe `ath-curseur`. */
export function curseur(): HTMLInputElement {
  const c = document.createElement('input');
  c.type = 'range';
  c.className = 'ath-curseur';
  c.style.cssText = 'width:100%;';
  return c;
}

/** Case à cocher du thème, suivie de son texte : renvoie la ligne cliquable et la case. */
export function caseACocher(texte: string, cochee: boolean): { ligne: HTMLLabelElement; case_: HTMLInputElement } {
  const ligne = document.createElement('label');
  ligne.style.cssText = `display:flex;align-items:center;gap:10px;font-size:15px;cursor:pointer;color:${T.texte};`;
  const case_ = document.createElement('input');
  case_.type = 'checkbox';
  case_.className = 'ath-case';
  case_.checked = cochee;
  ligne.append(case_, texte);
  return { ligne, case_ };
}

/** Losange doré (puce des titres d'étiquette), en SVG. */
export function losange(taille = 10, couleur: string = T.or, plein = true): string {
  const m = taille / 2;
  const trait = plein ? `fill="${couleur}"` : `fill="none" stroke="${couleur}" stroke-width="1.4"`;
  return (
    `<svg width="${taille}" height="${taille}" viewBox="0 0 ${taille} ${taille}" aria-hidden="true" style="flex-shrink:0">` +
    `<polygon points="${m},0 ${taille},${m} ${m},${taille} 0,${m}" ${trait}/></svg>`
  );
}

/** Échappe un texte pour l'insérer dans du HTML. */
export function echapper(texte: string): string {
  return texte.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Mot-clé coloré en gras (HTML), par exemple `motCle('Baies', 'ressource')`. */
export function motCle(texte: string, type: TypeMotCle): string {
  return `<span style="color:${T[type]};font-weight:700">${echapper(texte)}</span>`;
}

/** Couleur de la jauge d'usure selon la part restante (de 0 à 1). */
export function couleurUsure(part: number): string {
  if (part < 0.3) return T.usureMauvaise;
  if (part < 0.6) return T.usureMoyenne;
  return T.usureBonne;
}

/**
 * Colonne du bas de l'écran (nom de l'outil, vie / sorts / mana, barre d'outils, XP), partagée par plusieurs modules :
 * le premier qui la demande la crée, les autres la retrouvent. Chaque morceau se place avec `order` (1 à 4).
 */
export function colonneBas(racine: HTMLElement): HTMLElement {
  const existante = racine.querySelector<HTMLElement>('[data-role="colonne-bas"]');
  if (existante) return existante;
  const hors = document.createElement('div');
  hors.style.cssText = 'position:absolute;left:0;right:0;bottom:26px;display:flex;justify-content:center;pointer-events:none;user-select:none;';
  const colonne = document.createElement('div');
  colonne.dataset.role = 'colonne-bas';
  colonne.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:8px;font-family:${T.corps};`;
  hors.appendChild(colonne);
  racine.appendChild(hors);
  return colonne;
}

/** Ligne « vie, sorts, mana » de la colonne du bas (order 2), remplie par la vie, les sorts et le mana. */
export function ligneVitaux(racine: HTMLElement): HTMLElement {
  const colonne = colonneBas(racine);
  const existante = colonne.querySelector<HTMLElement>('[data-role="ligne-vitaux"]');
  if (existante) return existante;
  const ligne = document.createElement('div');
  ligne.dataset.role = 'ligne-vitaux';
  ligne.style.cssText = 'order:2;align-self:stretch;display:flex;align-items:center;justify-content:space-between;gap:12px;';
  colonne.appendChild(ligne);
  return ligne;
}

/** Barre de jauge de 150 × 16 px (vie, mana) : renvoie le cadre, le remplissage et les deux textes. */
export function jaugeLarge(couleur: string, etiquette: string): { cadre: HTMLElement; remplissage: HTMLElement; valeur: HTMLElement } {
  const cadre = document.createElement('div');
  cadre.style.cssText =
    `position:relative;width:150px;height:16px;box-sizing:border-box;border-radius:8px;background:${T.fondJauge};` +
    `border:1px solid ${T.filet};overflow:hidden;flex-shrink:0;`;
  const remplissage = document.createElement('div');
  remplissage.style.cssText = `height:100%;width:100%;background:${couleur};transition:width 0.15s;`;
  const textes = document.createElement('div');
  textes.style.cssText =
    `position:absolute;inset:0;display:flex;justify-content:space-between;align-items:center;padding:0 9px;font-size:11px;font-weight:700;` +
    'color:#FFFFFF;text-shadow:0 1px 2px rgba(0,0,0,0.6);line-height:1;';
  const nom = document.createElement('span');
  nom.textContent = etiquette;
  const valeur = document.createElement('span');
  textes.append(nom, valeur);
  cadre.append(remplissage, textes);
  return { cadre, remplissage, valeur };
}

/** Met une majuscule au début d'un nom (« minerai de fer » → « Minerai de fer »). */
export function majuscule(nom: string): string {
  return nom.length === 0 ? nom : nom.charAt(0).toLocaleUpperCase('fr') + nom.slice(1);
}

// ---- Installation dans la page ----

// Base du site donnée par Vite : « / » en développement, relative dans la version construite (qui marche donc
// à la racine d'un site comme dans un sous-dossier, par exemple une page GitHub)
const BASE = `${import.meta.env.BASE_URL}polices/`;

/** Polices copiées dans le projet (public/polices/, licence OFL : voir public/polices/SOURCES.md). */
const POLICES: readonly { famille: string; fichier: string; poids: number; style: 'normal' | 'italic' }[] = [
  { famille: 'Cinzel', fichier: 'cinzel-latin-600-normal.woff2', poids: 600, style: 'normal' },
  { famille: 'Cinzel', fichier: 'cinzel-latin-700-normal.woff2', poids: 700, style: 'normal' },
  { famille: 'Alegreya Sans', fichier: 'alegreya-sans-latin-400-normal.woff2', poids: 400, style: 'normal' },
  { famille: 'Alegreya Sans', fichier: 'alegreya-sans-latin-400-italic.woff2', poids: 400, style: 'italic' },
  { famille: 'Alegreya Sans', fichier: 'alegreya-sans-latin-500-normal.woff2', poids: 500, style: 'normal' },
  { famille: 'Alegreya Sans', fichier: 'alegreya-sans-latin-700-normal.woff2', poids: 700, style: 'normal' },
];

/** Animations partagées (maquette) : sorts, XP, compétences, personnage de l'inventaire. */
const ANIMATIONS = `
@keyframes ath-sort-pret{0%{transform:scale(1);filter:none}45%{transform:scale(1.18);filter:drop-shadow(0 0 6px rgba(255,228,150,0.95))}100%{transform:scale(1);filter:none}}
@keyframes ath-xp-gain{0%{transform:scaleX(0)}100%{transform:scaleX(1)}}
@keyframes ath-xp-texte{0%{opacity:0;transform:translate(-50%,4px)}15%,80%{opacity:1;transform:translate(-50%,0)}100%{opacity:0;transform:translate(-50%,0)}}
@keyframes ath-respire{0%,100%{box-shadow:0 0 0 3px rgba(217,184,113,0.20)}50%{box-shadow:0 0 0 7px rgba(217,184,113,0.06),0 0 18px rgba(217,184,113,0.55)}}
@keyframes ath-lueur{0%,100%{text-shadow:0 0 10px rgba(217,184,113,0.35)}50%{text-shadow:0 0 22px rgba(255,224,150,0.85)}}
@keyframes ath-balance{0%,100%{transform:rotate(-1deg) translateY(0)}50%{transform:rotate(1deg) translateY(-2px)}}
@keyframes ath-apparait{0%{opacity:0;transform:translateY(6px)}100%{opacity:1;transform:translateY(0)}}
.ath-curseur{-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;background:rgba(214,182,110,0.32);outline:none;cursor:pointer;margin:6px 0}
.ath-curseur::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;border-radius:50%;background:#D9B871;border:2px solid #0E1A24;box-shadow:0 0 0 1px rgba(214,182,110,0.7)}
.ath-curseur::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:#D9B871;border:2px solid #0E1A24}
.ath-curseur:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 3px #7CCBF4}
.ath-case{accent-color:#D9B871;width:18px;height:18px;margin:0;cursor:pointer}
`;

/**
 * Installe le thème dans la page (une seule fois) : polices, variables CSS `--ath-…`, animations,
 * et police par défaut de la couche d'interface `#ui`.
 */
export function installerTheme(racine?: HTMLElement): void {
  if (!document.getElementById('theme-ath')) {
    const polices = POLICES.map(
      (p) =>
        `@font-face{font-family:'${p.famille}';font-style:${p.style};font-weight:${p.poids};font-display:swap;` +
        `src:url('${BASE}${p.fichier}') format('woff2');}`,
    ).join('\n');
    const variables =
      ':root{' +
      Object.entries(T)
        .map(([cle, valeur]) => `--ath-${cle}:${valeur};`)
        .join('') +
      '}';
    const style = document.createElement('style');
    style.id = 'theme-ath';
    style.textContent = `${polices}\n${variables}\n${ANIMATIONS}`;
    document.head.appendChild(style);
  }
  if (racine) {
    racine.style.fontFamily = T.corps;
    racine.style.color = T.texte;
  }
}
