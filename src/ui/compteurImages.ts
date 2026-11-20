// Compteur d'images par seconde (moyenne sur 1 s), en haut à gauche. Touche F3 : afficher ou masquer.

import { T } from './theme';

export interface CompteurImages {
  /** À appeler à chaque image avec la durée écoulée, en secondes. */
  image(dt: number): void;
  basculer(): void;
  /** Affiche ou masque le compteur. */
  definir(visible: boolean): void;
  /** Vrai si le compteur est affiché. */
  readonly visible: boolean;
}

export function creerCompteurImages(racine: HTMLElement): CompteurImages {
  const bloc = document.createElement('div');
  bloc.style.cssText =
    `position:absolute;left:14px;top:12px;padding:2px 10px;border-radius:${T.rayonPetit};font-family:${T.corps};font-size:13px;font-weight:700;` +
    `color:${T.texte};background:${T.fond};border:1px solid ${T.filetCase};opacity:0.9;user-select:none;pointer-events:none;display:none;`;
  racine.appendChild(bloc);

  let visible = false;
  let images = 0;
  let duree = 0;

  function definir(v: boolean): void {
    visible = v;
    bloc.style.display = visible ? 'block' : 'none';
    if (visible) bloc.textContent = '… i/s';
  }

  return {
    image(dt) {
      images++;
      duree += dt;
      if (duree < 1) return;
      if (visible) bloc.textContent = `${Math.round(images / duree)} i/s`;
      images = 0;
      duree = 0;
    },
    get visible() {
      return visible;
    },
    basculer() {
      definir(!visible);
    },
    definir,
  };
}
