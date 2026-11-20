// Heure du jeu au-dessus du coin droit de la mini-carte : petit soleil ou petite lune (la nuit) et « 12:01 », sans panneau.

import { formaterHeure } from '../regles/temps';
import { T, SUR_DECOR } from './theme';

export interface Horloge {
  /** Affiche l'heure du jeu (0 à 24) ; `jour` choisit l'icône soleil ou lune. */
  afficher(heure: number, jour: boolean): void;
}

/** Soleil : disque et huit rayons (dessin de la maquette). */
const SOLEIL =
  '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="4" fill="#FFE08A"/>' +
  '<g stroke="#FFE08A" stroke-width="1.6" stroke-linecap="round"><line x1="9" y1="0.8" x2="9" y2="2.8"/><line x1="9" y1="15.2" x2="9" y2="17.2"/>' +
  '<line x1="0.8" y1="9" x2="2.8" y2="9"/><line x1="15.2" y1="9" x2="17.2" y2="9"/><line x1="3.2" y1="3.2" x2="4.6" y2="4.6"/>' +
  '<line x1="13.4" y1="13.4" x2="14.8" y2="14.8"/><line x1="3.2" y1="14.8" x2="4.6" y2="13.4"/><line x1="13.4" y1="4.6" x2="14.8" y2="3.2"/></g></svg>';

/** Lune : croissant bleu pâle. */
const LUNE =
  '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M12.5 2.2A7 7 0 1 0 15.8 11.5 5.6 5.6 0 0 1 12.5 2.2Z" fill="#CFE3F7"/></svg>';

export function creerHorloge(racine: HTMLElement): Horloge {
  const bloc = document.createElement('div');
  bloc.dataset.role = 'horloge';
  bloc.style.cssText =
    // Au-dessus du coin droit de la mini-carte, en miroir du compteur d'images placé au-dessus de son coin gauche
    // (`--droite-mini-carte` : bord droit de la petite carte, tenu à jour par src/ui/miniCarte.ts)
    `position:absolute;left:calc(var(--droite-mini-carte, 224px) + 10px);top:12px;transform:translateX(-100%);` +
    `display:flex;align-items:center;gap:6px;font-family:${T.corps};font-size:15px;font-weight:500;` +
    `${SUR_DECOR}user-select:none;pointer-events:none;`;
  const icone = document.createElement('span');
  icone.style.cssText = 'display:flex;';
  const heureTexte = document.createElement('span');
  bloc.append(icone, heureTexte);
  racine.appendChild(bloc);

  let dernierTexte = '';
  let dernierJour: boolean | null = null;
  return {
    afficher(heure, jour) {
      if (jour !== dernierJour) {
        dernierJour = jour;
        icone.innerHTML = jour ? SOLEIL : LUNE;
      }
      const texte = formaterHeure(heure);
      if (texte === dernierTexte) return;
      dernierTexte = texte;
      heureTexte.textContent = texte;
    },
  };
}
