// Ligne d'objectif sous le bandeau de la boussole (aujourd'hui : « Défends le village » pendant une attaque).
// L'objectif de l'histoire, lui, est dans le panneau de quêtes (suiviQuetes.ts).
// Aucune règle de jeu ici : l'appelant donne le texte (ou `null` pour la cacher).

import { PANNEAU, T } from './theme';

export interface ObjectifHistoire {
  /** Montre la ligne, ou la cache avec `null` (rien n'est touché si le texte n'a pas changé). */
  afficher(texte: string | null): void;
}

/** Hauteur par défaut depuis le haut de l'écran, sous le texte du point suivi de la boussole (px) */
const HAUT_DEFAUT = 94;

export function creerObjectifHistoire(racine: HTMLElement, haut = HAUT_DEFAUT): ObjectifHistoire {
  const bloc = document.createElement('div');
  bloc.dataset.role = 'ligne-objectif';
  bloc.style.cssText =
    `${PANNEAU}position:absolute;left:50%;top:${haut}px;transform:translateX(-50%);display:none;max-width:min(560px,70vw);` +
    `padding:4px 18px;border-radius:16px;font-family:${T.corps};font-size:15px;font-weight:700;` +
    `color:${T.ressource};text-shadow:${T.ombreTexte};user-select:none;pointer-events:none;text-align:center;`;
  racine.appendChild(bloc);

  let dernier: string | null = null;
  return {
    afficher(texte) {
      if (texte === dernier) return;
      dernier = texte;
      bloc.textContent = texte ?? '';
      bloc.style.display = texte ? 'block' : 'none';
    },
  };
}
