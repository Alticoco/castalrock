// Barre de vie d'un chef : en haut de l'écran, au centre, avec son nom, tant que le joueur est près de lui.
// Aucune règle de jeu ici : l'appelant donne le nom et la part de vie restante (ou `null` pour la cacher).

import { T, TITRE } from './theme';

export interface BarreChef {
  /** Montre la barre (`ratio` : vie restante de 0 à 1), ou la cache avec `null`. */
  afficher(chef: { nom: string; ratio: number } | null): void;
}

export function creerBarreChef(racine: HTMLElement, haut = 126): BarreChef {
  const bloc = document.createElement('div');
  bloc.dataset.role = 'barre-chef';
  bloc.style.cssText =
    `position:absolute;left:50%;top:${haut}px;transform:translateX(-50%);width:min(460px,60vw);display:none;` +
    `font-family:${T.corps};color:${T.texte};text-shadow:${T.ombreTexte};user-select:none;pointer-events:none;text-align:center;`;
  const nom = document.createElement('div');
  nom.style.cssText = `${TITRE}font-size:17px;letter-spacing:0.06em;margin-bottom:4px;color:${T.texte};text-shadow:0 0 6px rgba(0,0,0,0.9),${T.ombreTexte};`;
  const cadre = document.createElement('div');
  cadre.style.cssText =
    `height:14px;border-radius:7px;background:${T.fondJauge};overflow:hidden;border:1px solid ${T.filet};box-shadow:0 2px 8px rgba(0,0,0,0.45);`;
  const jauge = document.createElement('div');
  jauge.dataset.role = 'barre-chef-jauge';
  jauge.style.cssText = `height:100%;width:100%;background:${T.vie};transition:width 0.2s;`;
  cadre.appendChild(jauge);
  bloc.append(nom, cadre);
  racine.appendChild(bloc);

  let visible = false;
  let dernierNom = '';
  let dernierPourcent = -1;
  return {
    afficher(chef) {
      if (!chef) {
        if (visible) {
          visible = false;
          bloc.style.display = 'none';
        }
        return;
      }
      if (!visible) {
        visible = true;
        bloc.style.display = 'block';
      }
      if (chef.nom !== dernierNom) {
        dernierNom = chef.nom;
        nom.textContent = chef.nom;
      }
      // Largeur au demi pour cent près : le style n'est touché que si la vie a changé
      const pourcent = Math.round(Math.max(0, Math.min(1, chef.ratio)) * 200) / 2;
      if (pourcent !== dernierPourcent) {
        dernierPourcent = pourcent;
        jauge.style.width = `${pourcent}%`;
      }
    },
  };
}
