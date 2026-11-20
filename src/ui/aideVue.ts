// Petit texte en bas à gauche : nom de la vue (2 secondes après un changement). Les touches sont dans l'aide (H, ou menu Échap).
// Sa largeur s'arrête avant la colonne du bas (barre d'outils, XP).

import { T } from './theme';

const DUREE_ANNONCE_MS = 2000;

export interface AideVue {
  /** Affiche le nom de la vue pendant 2 secondes. */
  annoncer(nomVue: string): void;
}

export function creerAideVue(racine: HTMLElement): AideVue {
  const bloc = document.createElement('div');
  bloc.style.cssText =
    `position:absolute;left:14px;bottom:12px;max-width:calc(50% - 260px);font-family:${T.corps};color:#fff;` +
    'text-shadow:0 1px 3px rgba(0,0,0,0.75);user-select:none;';

  const annonce = document.createElement('div');
  annonce.style.cssText = `font-family:${T.titre};font-size:20px;font-weight:600;margin-bottom:6px;opacity:0;transition:opacity 0.35s;`;

  bloc.append(annonce);
  racine.appendChild(bloc);

  let minuterie: number | undefined;

  return {
    annoncer(nomVue) {
      annonce.textContent = nomVue;
      annonce.style.opacity = '1';
      if (minuterie !== undefined) window.clearTimeout(minuterie);
      minuterie = window.setTimeout(() => {
        annonce.style.opacity = '0';
      }, DUREE_ANNONCE_MS);
    },
  };
}
