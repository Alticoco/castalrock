// Panneau de quêtes en haut à droite (sous l'heure) : la quête principale de l'histoire, puis les quêtes du village
// (la première en grand avec sa barre de progression, les autres repliées sur une ligne). Style « Ardoise et laiton ».
// Aucune règle de jeu ici : les appelants (src/jeu/quetes.ts et src/jeu/histoire.ts) donnent les textes et les nombres.

import { colorerMotsCles } from './motsCles';
import { CORPS, ETIQUETTE, PANNEAU, T, TITRE, echapper, losange, majuscule } from './theme';

/** Une quête du village en cours. */
export interface LigneQuete {
  titre: string;
  /** Qui donne la quête (« Marthe ») */
  donneur: string;
  /** Où la trouver (« L'auberge »), si les données le disent */
  lieu?: string;
  /** Phrase de l'objectif (« Rapporter baies ») : les noms connus y sont colorés */
  objectif: string;
  actuel: number;
  requis: number;
  /** Ce qu'on compte, pour la ligne repliée (« slimes », « bois ») */
  unite: string;
  /** Objectif atteint : la quête attend d'être rendue */
  prete: boolean;
}

/** L'étape en cours de l'histoire : titre de l'acte et objectif. */
export interface ObjectifPrincipal {
  /** « Acte I — S'installer » */
  acte: string;
  /** « Forge un outil en cuivre (2/5) » */
  objectif: string;
}

export interface SuiviQuetes {
  /** Quête principale ; `null` quand l'histoire est finie (rien n'est touché si le contenu n'a pas changé). */
  afficherHistoire(objectif: ObjectifPrincipal | null): void;
  /** Quêtes du village en cours, dans l'ordre : la première est dessinée en grand. */
  afficherQuetes(lignes: readonly LigneQuete[]): void;
}

// Largeur : 460 px au plus, réduite sur petit écran pour ne pas toucher le bandeau de la boussole (voir boussole.ts)
const LARGEUR = 'min(460px,max(280px,calc(30vw - 36px)))';
// Aligné sur le haut de la boussole (l'horloge, qui était au-dessus, est passée près de la mini-carte)
const HAUT_ECRAN = 18;
/** Les autres quêtes repliées : au plus 4 lignes, puis « + 2 autres » */
const LIGNES_REPLIEES_MAX = 4;
const TOUCHE_JOURNAL = 'J';

const SEPARATEUR =
  `<div style="display:flex;align-items:center;gap:8px;margin:4px 0"><div style="flex:1;height:1px;background:${T.filet};opacity:0.6"></div>` +
  `${losange(8)}<div style="flex:1;height:1px;background:${T.filet};opacity:0.6"></div></div>`;

function etiquette(texte: string): string {
  return `<div style="${ETIQUETTE}display:flex;align-items:center;gap:8px">${losange(10)}${echapper(texte)}</div>`;
}

function htmlHistoire(h: ObjectifPrincipal): string {
  return (
    `<div style="display:flex;flex-direction:column;gap:10px">${etiquette('Quête principale')}` +
    `<div style="${TITRE}font-size:20px;line-height:1.2">${echapper(h.acte)}</div>` +
    `<div style="display:flex;align-items:flex-start;gap:10px;font-size:15px;color:${T.doux}">` +
    `<span style="margin-top:4px;display:flex">${losange(12, T.or, false)}</span><span>${colorerMotsCles(h.objectif)}</span></div></div>`
  );
}

function htmlQuetes(lignes: readonly LigneQuete[]): string {
  const [premiere, ...autres] = lignes;
  const repliees = autres.slice(0, LIGNES_REPLIEES_MAX);
  const cachees = autres.length - repliees.length;
  const couleurProgres = premiere.prete ? T.personnage : T.texte;
  const part = premiere.requis > 0 ? Math.round((premiere.actuel / premiere.requis) * 100) : 0;
  const lieu = premiere.lieu ? ` · ${echapper(premiere.lieu)}` : '';

  let html =
    `<div style="display:flex;flex-direction:column;gap:10px"><div style="${ETIQUETTE}display:flex;align-items:center;justify-content:space-between">` +
    `<span>Quêtes du village</span><span style="letter-spacing:0;font-weight:500;color:${T.doux};text-transform:none;font-size:12px">${lignes.length} en cours</span></div>` +
    `<div data-role="quete-principale-village" style="display:flex;flex-direction:column;gap:6px">` +
    `<div style="display:flex;align-items:center;gap:8px">${losange(12, T.accent)}<span style="${TITRE}font-size:17px">${echapper(premiere.titre)}</span></div>` +
    `<div style="font-size:13px;color:${T.personnage};padding-left:20px">${echapper(premiere.donneur)}${lieu}</div>` +
    `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:15px;color:${T.doux};padding-left:20px">` +
    `<span>${colorerMotsCles(premiere.objectif)}</span>` +
    `<span style="font-weight:700;color:${couleurProgres};white-space:nowrap">${premiere.actuel} / ${premiere.requis}${premiere.prete ? ' · à rendre' : ''}</span></div>` +
    `<div style="margin-left:20px;height:5px;border-radius:3px;background:rgba(255,255,255,0.14);overflow:hidden">` +
    `<div style="width:${part}%;height:5px;background:${premiere.prete ? T.personnage : T.ressource};border-radius:3px"></div></div></div>`;

  if (repliees.length > 0 || cachees > 0) {
    html += `<div style="display:flex;flex-direction:column;gap:6px;margin-top:4px">`;
    for (const q of repliees) {
      const couleur = q.prete ? T.personnage : T.doux;
      html +=
        `<div data-role="quete-repliee" style="display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:15px">` +
        `<span style="display:flex;align-items:center;gap:8px;min-width:0">${losange(10, couleur, false)}<span>${echapper(q.titre)}</span></span>` +
        `<span style="color:${couleur};white-space:nowrap">${q.actuel} / ${q.requis} ${colorerMotsCles(majuscule(q.unite))}</span></div>`;
    }
    if (cachees > 0) html += `<div style="font-size:13px;color:${T.doux};padding-left:18px">+ ${cachees} autre${cachees > 1 ? 's' : ''}</div>`;
    html += `</div>`;
  }
  return `${html}</div>`;
}

export function creerSuiviQuetes(racine: HTMLElement): SuiviQuetes {
  const boite = document.createElement('div');
  boite.dataset.role = 'suivi-quetes';
  boite.style.cssText =
    `${PANNEAU}${CORPS}background:${T.fondLeger};position:absolute;right:24px;top:${HAUT_ECRAN}px;width:${LARGEUR};padding:16px 18px 14px;` +
    'max-height:calc(100vh - 340px);overflow:hidden;display:none;flex-direction:column;gap:10px;user-select:none;pointer-events:none;';
  const sectionHistoire = document.createElement('div');
  sectionHistoire.dataset.role = 'quetes-histoire';
  const separateur = document.createElement('div');
  separateur.innerHTML = SEPARATEUR;
  const sectionQuetes = document.createElement('div');
  sectionQuetes.dataset.role = 'quetes-village';
  const aide = document.createElement('div');
  aide.dataset.role = 'quetes-aide';
  aide.textContent = `${TOUCHE_JOURNAL} · Journal des quêtes`;
  aide.style.cssText = `font-size:12px;color:${T.doux};opacity:0.85;text-align:right;`;
  boite.append(sectionHistoire, separateur, sectionQuetes, aide);
  racine.appendChild(boite);

  let htmlH = '';
  let htmlQ = '';

  /** Montre ou cache les sections selon ce qu'elles contiennent ; le panneau disparaît s'il est vide. */
  function disposer(): void {
    const aH = htmlH !== '';
    const aQ = htmlQ !== '';
    sectionHistoire.style.display = aH ? 'block' : 'none';
    sectionQuetes.style.display = aQ ? 'block' : 'none';
    separateur.style.display = aH && aQ ? 'block' : 'none';
    boite.style.display = aH || aQ ? 'flex' : 'none';
  }

  return {
    afficherHistoire(objectif) {
      const nouveau = objectif ? htmlHistoire(objectif) : '';
      if (nouveau === htmlH) return;
      htmlH = nouveau;
      sectionHistoire.innerHTML = nouveau;
      disposer();
    },
    afficherQuetes(lignes) {
      const nouveau = lignes.length > 0 ? htmlQuetes(lignes) : '';
      if (nouveau === htmlQ) return;
      htmlQ = nouveau;
      sectionQuetes.innerHTML = nouveau;
      disposer();
    },
  };
}
