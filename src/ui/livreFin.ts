// Livre de fin : un vieux livre ouvert au milieu de l'écran, qu'on feuillette double page par double page.
// Tout est dessiné en HTML et CSS (dégradés, ombres, bordures) : aucune image. Aucune règle de jeu ici,
// les textes viennent de `regles/fin.ts`.
//
// Usage : const livre = creerLivreFin(ui, () => { ...après la fermeture... }); livre.ouvrir(pagesLivreFin(bilan));
// Tant qu'il est ouvert, le clavier est capté (le jeu ne reçoit plus les touches).
import type { PageLivre } from '../regles/fin';
import { T, echapper, losange, styleBoutonPrincipal } from './theme';

export interface LivreFin {
  readonly ouvert: boolean;
  ouvrir(pages: readonly PageLivre[]): void;
  fermer(): void;
}

const ENCRE = '#3b2716';
const ENCRE_DOUCE = '#6b4e32';
const ROUGE = '#7a2e1b';
const DUREE_MS = 320;

const CSS = `
@keyframes lf-voile{0%{opacity:0}100%{opacity:1}}
@keyframes lf-ouvre{0%{opacity:0;transform:translateY(14px) scale(0.96)}100%{opacity:1;transform:translateY(0) scale(1)}}
@keyframes lf-suivante{0%{opacity:0;transform:translateX(18px)}100%{opacity:1;transform:translateX(0)}}
@keyframes lf-precedente{0%{opacity:0;transform:translateX(-18px)}100%{opacity:1;transform:translateX(0)}}
.lf-tour-av .lf-contenu{animation:lf-suivante ${DUREE_MS}ms ease-out}
.lf-tour-ar .lf-contenu{animation:lf-precedente ${DUREE_MS}ms ease-out}
.lf-contenu{display:flex;flex-direction:column;flex:1;min-height:0}
.lf-p{margin:0 0 0.85em 0;text-align:justify;hyphens:auto}
.lf-lettrine::first-letter{font-family:${T.titre};font-weight:700;font-size:3.2em;float:left;line-height:0.82;padding:0.06em 0.1em 0 0;color:${ROUGE};text-shadow:0 1px 0 rgba(255,240,200,0.5)}
.lf-bouton:focus-visible{outline:2px solid ${ROUGE};outline-offset:3px}
`;

/** Ornement : filet, losange, filet (centré). */
function ornement(): string {
  const filet = `<span style="display:block;height:1px;width:3.2em;background:linear-gradient(90deg,transparent,${ENCRE_DOUCE},transparent)"></span>`;
  return `<div aria-hidden="true" style="display:flex;align-items:center;justify-content:center;gap:0.6em;opacity:0.8">${filet}${losange(12, ROUGE)}${filet}</div>`;
}

/** Contenu HTML d'une page : titre, paragraphes (lettrine si plusieurs paragraphes). */
function htmlPage(page: PageLivre): string {
  const seule = page.paragraphes.length === 1 && page.titre !== undefined;
  const titre =
    page.titre === undefined
      ? ''
      : `<h2 style="margin:0 0 0.6em 0;text-align:center;font-family:${T.titre};font-weight:700;letter-spacing:0.06em;color:${ROUGE};` +
        `font-size:${page.fin || seule ? '2.3em' : '1.5em'};line-height:1.2;text-shadow:0 1px 0 rgba(255,240,200,0.5)">${echapper(page.titre)}</h2>${ornement()}<div style="height:0.9em"></div>`;
  const paragraphes = page.paragraphes
    .map((p, i) => {
      const centre = seule || page.fin === true;
      const style = centre ? 'text-align:center;' : '';
      const classe = i === 0 && !centre ? 'lf-p lf-lettrine' : 'lf-p';
      const italique = seule ? 'font-style:italic;color:' + ENCRE_DOUCE + ';' : '';
      return `<p class="${classe}" style="${style}${italique}">${echapper(p)}</p>`;
    })
    .join('');
  const haut = seule ? 'justify-content:center;' : '';
  return `<div class="lf-contenu" style="${haut}">${titre}${paragraphes}</div>`;
}

/** Page de droite vide (nombre de pages impair) : un simple ornement. */
function htmlOrnementSeul(): string {
  return `<div class="lf-contenu" style="justify-content:center;align-items:center;gap:1em">${ornement()}${losange(22, ENCRE_DOUCE, false)}${ornement()}</div>`;
}

export function creerLivreFin(racine: HTMLElement, surFermeture: () => void): LivreFin {
  let pages: readonly PageLivre[] = [];
  let double = 0;
  let ouvert = false;

  if (!document.getElementById('livre-fin-css')) {
    const style = document.createElement('style');
    style.id = 'livre-fin-css';
    style.textContent = CSS;
    document.head.appendChild(style);
  }

  const voile = document.createElement('div');
  voile.style.cssText =
    'position:absolute;inset:0;display:none;align-items:center;justify-content:center;flex-direction:column;gap:1.6vmin;pointer-events:auto;' +
    `z-index:1000;user-select:none;font-family:${T.corps};color:${ENCRE};` +
    'background:radial-gradient(ellipse at center,rgba(20,14,8,0.78) 0%,rgba(4,3,2,0.95) 100%);';

  // Livre : couverture de cuir, deux pages de parchemin, reliure au milieu
  const livre = document.createElement('div');
  livre.style.cssText =
    'position:relative;display:flex;box-sizing:border-box;width:min(92vw,112vh);aspect-ratio:1.45;max-height:82vh;padding:1.6em;' +
    'font-size:clamp(14px,2.35vmin,38px);border-radius:0.9em;' +
    'background:linear-gradient(145deg,#4a2c17,#2d1a0d 55%,#3d2412);border:1px solid #1b0f07;' +
    'box-shadow:0 2.4em 4em rgba(0,0,0,0.75),inset 0 0 0 0.2em rgba(214,182,110,0.22),inset 0 0 2.4em rgba(0,0,0,0.6);';

  const pagesZone = document.createElement('div');
  pagesZone.style.cssText =
    'position:relative;display:grid;grid-template-columns:1fr 1fr;flex:1;min-width:0;min-height:0;border-radius:0.35em;' +
    // tranche des feuillets, visible sous le livre
    'box-shadow:0 0.12em 0 #e6d6ac,0 0.24em 0 #b89b62,0 0.36em 0 #e6d6ac,0 0.48em 0 #a58850,0 0.9em 1.2em rgba(0,0,0,0.55);';

  const pageBase =
    'position:relative;display:flex;flex-direction:column;box-sizing:border-box;min-width:0;min-height:0;overflow:hidden;padding:2.2em 2.4em 1.6em;' +
    `font-size:1em;line-height:1.55;color:${ENCRE};font-weight:500;`;
  const parchemin = 'radial-gradient(ellipse at 50% 40%,#f3e4bd 0%,#e8d3a0 62%,#d2b57b 100%)';
  const gauche = document.createElement('div');
  gauche.style.cssText =
    `${pageBase}background:linear-gradient(90deg,rgba(0,0,0,0) 78%,rgba(60,35,12,0.38) 100%),${parchemin};` +
    'border-radius:0.35em 0 0 0.35em;box-shadow:inset 0.2em 0 0.7em rgba(90,55,20,0.5),inset 0 0 1.6em rgba(120,80,30,0.35);';
  const droite = document.createElement('div');
  droite.style.cssText =
    `${pageBase}background:linear-gradient(270deg,rgba(0,0,0,0) 78%,rgba(60,35,12,0.38) 100%),${parchemin};` +
    'border-radius:0 0.35em 0.35em 0;box-shadow:inset -0.2em 0 0.7em rgba(90,55,20,0.5),inset 0 0 1.6em rgba(120,80,30,0.35);';

  const corpsG = document.createElement('div');
  corpsG.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';
  const corpsD = document.createElement('div');
  corpsD.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0;';
  const pied = (alignement: string): HTMLElement => {
    const e = document.createElement('div');
    e.style.cssText = `text-align:${alignement};font-family:${T.titre};font-size:0.8em;color:${ENCRE_DOUCE};padding-top:0.5em;min-height:1.6em;`;
    return e;
  };
  const numeroG = pied('left');
  const numeroD = pied('right');
  const boutonZone = document.createElement('div');
  boutonZone.style.cssText = 'display:none;justify-content:center;padding-top:0.4em;';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'lf-bouton';
  bouton.textContent = 'Refermer le livre';
  bouton.style.cssText = `${styleBoutonPrincipal(true)}font-size:1em;padding:0.5em 1.4em;background:${ROUGE};border-color:#4d1a0e;color:#f6e9c8;box-shadow:0 0.15em 0.5em rgba(0,0,0,0.4);`;
  boutonZone.appendChild(bouton);

  gauche.append(corpsG, numeroG);
  droite.append(corpsD, boutonZone, numeroD);

  // Reliure : creux central, ombre et fine couture
  const reliure = document.createElement('div');
  reliure.setAttribute('aria-hidden', 'true');
  reliure.style.cssText =
    'position:absolute;top:0;bottom:0;left:50%;width:3.4em;transform:translateX(-50%);pointer-events:none;' +
    'background:linear-gradient(90deg,rgba(40,22,8,0) 0%,rgba(40,22,8,0.45) 42%,rgba(25,12,4,0.7) 50%,rgba(40,22,8,0.45) 58%,rgba(40,22,8,0) 100%);';
  const couture = document.createElement('div');
  couture.setAttribute('aria-hidden', 'true');
  couture.style.cssText =
    'position:absolute;top:0.8em;bottom:0.8em;left:50%;width:0;border-left:0.12em dashed rgba(90,55,20,0.45);transform:translateX(-50%);pointer-events:none;';

  pagesZone.append(gauche, droite, reliure, couture);
  livre.appendChild(pagesZone);

  const indication = document.createElement('div');
  indication.style.cssText =
    `display:flex;align-items:center;gap:1em;font-size:clamp(13px,1.9vmin,28px);color:${T.doux};text-shadow:${T.ombreTexte};opacity:0.85;`;
  const fleG = document.createElement('span');
  const fleD = document.createElement('span');
  const compteur = document.createElement('span');
  compteur.style.cssText = `font-family:${T.titre};letter-spacing:0.08em;`;
  indication.append(fleG, compteur, fleD);

  voile.append(livre, indication);
  racine.appendChild(voile);

  const nbDoubles = (): number => Math.max(1, Math.ceil(pages.length / 2));
  const derniere = (): boolean => double >= nbDoubles() - 1;

  function afficher(sens: 'av' | 'ar' | null): void {
    const g = pages[double * 2];
    const d = pages[double * 2 + 1];
    corpsG.innerHTML = g ? htmlPage(g) : htmlOrnementSeul();
    corpsD.innerHTML = d ? htmlPage(d) : htmlOrnementSeul();
    numeroG.textContent = g ? String(double * 2 + 1) : '';
    numeroD.textContent = d ? String(double * 2 + 2) : '';
    boutonZone.style.display = derniere() ? 'flex' : 'none';
    compteur.textContent = `${double + 1} / ${nbDoubles()}`;
    fleG.textContent = '◂';
    fleD.textContent = '▸';
    fleG.style.opacity = double > 0 ? '1' : '0.25';
    fleD.style.opacity = derniere() ? '0.25' : '1';
    // Animation de transition : on relance la classe à chaque tour
    pagesZone.classList.remove('lf-tour-av', 'lf-tour-ar');
    if (sens) {
      void pagesZone.offsetWidth;
      pagesZone.classList.add(sens === 'av' ? 'lf-tour-av' : 'lf-tour-ar');
    }
  }

  function tourner(sens: 1 | -1): void {
    const cible = double + sens;
    if (cible < 0 || cible >= nbDoubles()) return;
    double = cible;
    afficher(sens === 1 ? 'av' : 'ar');
  }

  function fermer(): void {
    if (!ouvert) return;
    ouvert = false;
    window.removeEventListener('keydown', surTouche, true);
    voile.style.display = 'none';
    surFermeture();
  }

  function surTouche(e: KeyboardEvent): void {
    // Le jeu ne doit rien recevoir tant que le livre est ouvert
    e.stopPropagation();
    switch (e.key) {
      case 'ArrowRight':
      case ' ':
      case 'e':
      case 'E':
        e.preventDefault();
        tourner(1);
        break;
      case 'ArrowLeft':
        e.preventDefault();
        tourner(-1);
        break;
      case 'Escape':
      case 'Enter':
        e.preventDefault();
        if (derniere() && !e.repeat) fermer();
        break;
      default:
        break;
    }
  }

  bouton.addEventListener('click', (e) => {
    e.stopPropagation();
    fermer();
  });
  voile.addEventListener('click', (e) => {
    if (!ouvert) return;
    // Clic sur la moitié droite : page suivante ; sur la moitié gauche : page précédente
    tourner(e.clientX >= window.innerWidth / 2 ? 1 : -1);
  });

  return {
    get ouvert() {
      return ouvert;
    },
    ouvrir(nouvellesPages) {
      if (ouvert) return;
      pages = nouvellesPages;
      double = 0;
      ouvert = true;
      afficher(null);
      voile.style.display = 'flex';
      voile.style.animation = 'lf-voile 600ms ease-out';
      livre.style.animation = 'lf-ouvre 700ms ease-out';
      window.addEventListener('keydown', surTouche, true);
    },
    fermer,
  };
}
