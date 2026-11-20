// Indicateur discret du pilote automatique, au centre au-dessus de la barre d'outils. Aucune règle de jeu ici.

import type { ModePilote } from '../regles/pilote';
import { T } from './theme';

export interface IndicateurPilote {
  /** Affiche « Pilote automatique : récolte » ou « : combat », ou le cache avec `null`. */
  afficher(mode: ModePilote | null): void;
}

const TEXTES: Readonly<Record<ModePilote, string>> = {
  recolte: 'Pilote automatique : récolte',
  combat: 'Pilote automatique : combat',
};

export function creerIndicateurPilote(racine: HTMLElement): IndicateurPilote {
  const bloc = document.createElement('div');
  bloc.dataset.role = 'indicateur-pilote';
  bloc.style.cssText =
    // Juste au-dessus de la colonne du bas (le haut du centre est pris par la boussole)
    `position:absolute;left:50%;bottom:232px;transform:translateX(-50%);padding:4px 14px;border-radius:${T.rayonPanneau};` +
    `font-family:${T.corps};font-size:14px;color:#fff;background:${T.fond};border:1px solid ${T.filet};opacity:0;` +
    'transition:opacity 0.25s;user-select:none;pointer-events:none;text-shadow:0 1px 3px rgba(0,0,0,0.75);white-space:nowrap;';
  racine.appendChild(bloc);

  let dernier: ModePilote | null = null;
  return {
    afficher(mode) {
      if (mode === dernier) return;
      dernier = mode;
      if (mode) bloc.textContent = TEXTES[mode];
      bloc.style.opacity = mode ? '0.85' : '0';
    },
  };
}
